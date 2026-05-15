import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Code2,
  Database,
  FolderTree,
  Globe2,
  Inbox,
  Trophy,
  User,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiUrl } from "../../../shared/api.js";
import { ASSETS } from "../../../shared/assets.js";
import { EmptyState, IconBubble, TrendPill } from "../../shared/AdminWidgets.jsx";
import {
  clampNumber,
  formatNumber,
  formatRelativeTime,
  formatShortDate,
  percentChange,
  percentOf,
  prettyStatus,
  statusTone,
  toNumber,
} from "../adminUtils.js";

const TONE_COLORS = {
  blue: "#1f62ff",
  indigo: "#5b5dff",
  amber: "#d97706",
  green: "#18a96f",
};

function displayNameFromUsername(username) {
  const cleaned = String(username || "admin").replace(/^@/, "").trim();
  if (!cleaned) return "Admin";
  return cleaned
    .split(/[._-\s]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function normalizeVisitDay(day) {
  return {
    date: day?.date,
    label: formatShortDate(day?.date),
    unique_visits: toNumber(day?.unique_visits ?? day?.visits ?? day?.sessions),
  };
}

function KpiSparkChart({ data, dataKey, tone = "blue" }) {
  const hasData = Array.isArray(data) && data.length > 1;
  if (!hasData) {
    return <div className="ao-kpi-card__empty-line" aria-hidden="true" />;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 2, left: 2, bottom: 0 }}>
        <defs>
          <linearGradient id={`ao-kpi-${tone}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={TONE_COLORS[tone] || TONE_COLORS.blue} stopOpacity={0.26} />
            <stop offset="100%" stopColor={TONE_COLORS[tone] || TONE_COLORS.blue} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={TONE_COLORS[tone] || TONE_COLORS.blue}
          strokeWidth={3}
          fill={`url(#ao-kpi-${tone})`}
          dot={false}
          isAnimationActive
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function VisitTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const visits = payload[0]?.value ?? 0;
  return (
    <div className="ao-recharts-tooltip">
      <strong>{label}</strong>
      <span>{formatNumber(visits)} unique visits</span>
    </div>
  );
}

function DailyVisitsChart({ data }) {
  const hasVisits = data.some((day) => toNumber(day.unique_visits) > 0);

  if (!data.length || !hasVisits) {
    return (
      <div className="ao-visit-chart-empty">
        <EmptyState icon={Globe2} title="No visits recorded yet">
          Public-site visits will appear here after the new analytics endpoint receives traffic.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="ao-visit-chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 18, right: 12, left: -8, bottom: 4 }}>
          <CartesianGrid stroke="#e4edf8" strokeDasharray="4 7" vertical={false} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#607294", fontSize: 12, fontWeight: 800 }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: "#607294", fontSize: 12, fontWeight: 800 }} allowDecimals={false} />
          <Tooltip content={<VisitTooltip />} cursor={{ fill: "rgba(31, 98, 255, 0.08)" }} />
          <Bar dataKey="unique_visits" name="Unique visits" radius={[8, 8, 3, 3]} fill="#1f62ff" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function OverviewPage({ username, onNavigate, onSessionExpired }) {
  const [stats, setStats] = useState(null);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let disposed = false;

    async function requestJson(path) {
      const token = localStorage.getItem("campus404_token");
      const response = await fetch(apiUrl(path), {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (response.status === 401) {
        onSessionExpired?.();
        throw new Error("Session expired.");
      }

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.detail || `Unable to load ${path} (${response.status}).`);
      }
      return payload;
    }

    async function loadDashboard() {
      setError("");
      const [statsResult, healthResult] = await Promise.allSettled([
        requestJson("/api/admin/dashboard/stats"),
        requestJson("/api/admin/learning-engine/health"),
      ]);

      if (disposed) return;

      if (statsResult.status === "fulfilled") setStats(statsResult.value);
      if (healthResult.status === "fulfilled") setHealth(healthResult.value);

      const failures = [statsResult, healthResult].filter((result) => result.status === "rejected");
      if (failures.length === 2) {
        setError(failures[0].reason?.message || "Unable to load admin dashboard.");
      }
    }

    void loadDashboard();
    return () => {
      disposed = true;
    };
  }, [onSessionExpired]);

  const dashboardStats = stats || {};
  const dashboardHealth = health || {};
  const activity = Array.isArray(dashboardStats.activity_by_day) ? dashboardStats.activity_by_day : [];
  const visitActivity = useMemo(() => {
    const source = Array.isArray(dashboardStats.visit_activity_by_day) && dashboardStats.visit_activity_by_day.length
      ? dashboardStats.visit_activity_by_day
      : activity;
    return source.map(normalizeVisitDay);
  }, [activity, dashboardStats.visit_activity_by_day]);
  const attempts = Array.isArray(dashboardHealth.recent_attempts) ? dashboardHealth.recent_attempts : [];
  const topLearners = Array.isArray(dashboardStats.top_learners) ? dashboardStats.top_learners : [];
  const recentUsers = Array.isArray(dashboardStats.recent_users) ? dashboardStats.recent_users : [];
  const trackPerformance = Array.isArray(dashboardStats.track_performance) ? dashboardStats.track_performance : [];
  const topEntryPaths = Array.isArray(dashboardStats.top_entry_paths) ? dashboardStats.top_entry_paths : [];
  const today = activity[activity.length - 1] || {};
  const yesterday = activity[activity.length - 2] || {};
  const todayVisits = visitActivity[visitActivity.length - 1]?.unique_visits ?? toNumber(dashboardStats.unique_visits_24h);
  const yesterdayVisits = visitActivity[visitActivity.length - 2]?.unique_visits ?? 0;
  const visitTotal7d = visitActivity.reduce((total, day) => total + toNumber(day.unique_visits), 0);
  const bestVisitDay = visitActivity.reduce(
    (best, day) => (toNumber(day.unique_visits) > toNumber(best.unique_visits) ? day : best),
    { label: "No day", unique_visits: 0 },
  );
  const contentReadiness = percentOf(dashboardStats.published_exercises, dashboardStats.total_exercises);
  const engagementRate = percentOf(dashboardStats.active_users_24h, dashboardStats.total_users);
  const reviewQueueCount = toNumber(dashboardStats.pending_content) + toNumber(dashboardStats.failed_attempts_last_24h);
  const adminName = displayNameFromUsername(username);
  const todayLabel = new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  const topEntryLabel = topEntryPaths[0]?.path ? `Top entry ${topEntryPaths[0].path}` : "No entry paths yet";
  const learnerAvatars = [
    ASSETS.avatars.curlyBlackBlueHoodie,
    ASSETS.avatars.blueHeadphonesBlackHoodie,
    ASSETS.avatars.brownPonytailBlueHoodie,
    ASSETS.avatars.spikyBrownBlueWhiteHoodie,
    ASSETS.avatars.pinkBobBlackHoodie,
  ];

  const commandHealth = [
    { label: "Judge", value: dashboardStats.judge_health || dashboardHealth.judge_health || "unknown", icon: Activity },
    { label: "Database", value: dashboardStats.database_health || "unknown", icon: Database },
    { label: "Leaderboards", value: dashboardHealth.leaderboard_health || dashboardStats.leaderboard_health || "unknown", icon: Trophy },
    { label: "Content", value: dashboardHealth.content_health || "unknown", icon: FolderTree },
  ];

  const metricCards = [
    {
      label: "Total Learners",
      value: dashboardStats.total_users ?? 0,
      detail: `${formatNumber(dashboardStats.new_users_24h ?? 0)} new today`,
      icon: Users,
      tone: "blue",
      trend: percentChange(today.new_users, yesterday.new_users),
      seriesKey: "new_users",
      series: activity,
    },
    {
      label: "Active Today",
      value: dashboardStats.active_users_24h ?? 0,
      detail: `${engagementRate}% of learners`,
      icon: User,
      tone: "indigo",
      trend: percentChange(today.active_users, yesterday.active_users),
      seriesKey: "active_users",
      series: activity,
    },
    {
      label: "XP Awarded Today",
      value: dashboardStats.xp_awarded_24h ?? 0,
      detail: `${formatNumber(dashboardStats.xp_last_7_days ?? 0)} XP this week`,
      icon: Award,
      tone: "amber",
      trend: percentChange(today.xp, yesterday.xp),
      seriesKey: "xp",
      series: activity,
    },
    {
      label: "Unique Visits Today",
      value: todayVisits,
      detail: topEntryLabel,
      icon: Globe2,
      tone: "green",
      trend: percentChange(todayVisits, yesterdayVisits),
      seriesKey: "unique_visits",
      series: visitActivity,
    },
  ];

  const attentionItems = [
    { label: "Failed judge runs", detail: "Inspect submissions", value: dashboardStats.failed_attempts_last_24h ?? 0, tone: "red", icon: Activity, target: "submissions" },
    { label: "Pending content", detail: "Drafts and unpublished items", value: dashboardStats.pending_content ?? 0, tone: "amber", icon: ClipboardCheck, target: "curriculum" },
    { label: "Unread messages", detail: "Contact inbox", value: dashboardStats.unread_messages ?? 0, tone: "violet", icon: Inbox, target: "contacts" },
    { label: "Draft exercises", detail: "Not visible to learners", value: dashboardStats.draft_exercises ?? 0, tone: "blue", icon: Code2, target: "curriculum" },
  ];

  const liveActivity = [
    ...attempts.slice(0, 4).map((attempt) => ({
      label: `${attempt.username || "Learner"} ${attempt.status === "failed" ? "needs review on" : "completed"} ${attempt.exercise_title || "an exercise"}`,
      time: formatRelativeTime(attempt.created_at),
      tone: attempt.status === "failed" ? "red" : "green",
      icon: attempt.status === "failed" ? Activity : CheckCircle2,
    })),
    ...recentUsers.slice(0, 2).map((learner) => ({
      label: `New learner registered: ${learner.display_name || learner.username}`,
      time: learner.created_at ? formatRelativeTime(learner.created_at) : "recently",
      tone: "blue",
      icon: User,
    })),
  ].slice(0, 6);

  const readyCount = toNumber(dashboardStats.published_exercises);
  const reviewCount = toNumber(dashboardStats.pending_content);
  const draftCount = Math.max(toNumber(dashboardStats.total_exercises) - readyCount - reviewCount, 0);
  const totalContent = Math.max(toNumber(dashboardStats.total_exercises), readyCount + reviewCount + draftCount, 1);
  const readinessSlices = [
    { label: "Ready", value: readyCount, percent: percentOf(readyCount, totalContent), tone: "green" },
    { label: "In Review", value: reviewCount, percent: percentOf(reviewCount, totalContent), tone: "amber" },
    { label: "Draft", value: draftCount, percent: percentOf(draftCount, totalContent), tone: "muted" },
  ];

  return (
    <div className="ao-page ao-reference-page">
      {error && <div className="ap-inline-error">{error}</div>}

      <section className="ao-command-hero">
        <div className="ao-command-hero__copy">
          <span className="ao-command-hero__eyebrow">{todayLabel}</span>
          <h2>Welcome back, {adminName}</h2>
          <p>Here is the real-time pulse of Campus404 today.</p>
          <div className="ao-command-health">
            {commandHealth.map(({ label, value, icon: Icon }) => (
              <div className="ao-command-health__item" key={label}>
                <Icon size={22} />
                <span>{label}</span>
                <strong className={`is-${statusTone(value)}`}>{prettyStatus(value)}</strong>
              </div>
            ))}
          </div>
        </div>
        <img className="ao-command-hero__image" src={ASSETS.tracks.adminCommandCenter} alt="" />
      </section>

      <section className="ao-kpi-grid ao-kpi-grid--reference" aria-label="Platform metrics">
        {metricCards.map(({ label, value, detail, icon: Icon, tone, trend, series, seriesKey }) => (
          <article className={`ao-kpi-card ao-kpi-card--${tone}`} key={label}>
            <div className="ao-kpi-card__head">
              <span className="ao-kpi-card__icon"><Icon size={25} /></span>
              <div className="ao-kpi-card__text">
                <span className="ao-kpi-card__label" title={label}>{label}</span>
                <p className="ao-kpi-card__detail">{detail}</p>
              </div>
              <div className="ao-kpi-card__value-stack">
                <strong className="ao-kpi-card__value">{typeof value === "number" ? formatNumber(value) : value}</strong>
                <TrendPill value={trend} />
              </div>
            </div>
            <div className="ao-kpi-card__graph" aria-hidden="true">
              <KpiSparkChart data={series} dataKey={seriesKey} tone={tone} />
            </div>
          </article>
        ))}
      </section>

      <section className="ao-reference-grid">
        <article className="ao-panel ao-panel--activity ao-panel--visits">
          <header className="ao-panel__header">
            <div>
              <h3><Globe2 size={17} /> Daily Unique Visits</h3>
              <p>One counted visit per IP address per day.</p>
            </div>
            <button type="button" onClick={() => onNavigate("analytics")}>Analytics <ChevronRight size={13} /></button>
          </header>
          <DailyVisitsChart data={visitActivity} />
          <footer className="ao-activity-totals ao-visit-totals">
            <div>
              <span>Today</span>
              <strong>{formatNumber(todayVisits)}</strong>
              <TrendPill value={percentChange(todayVisits, yesterdayVisits)} />
            </div>
            <div>
              <span>7-day total</span>
              <strong>{formatNumber(visitTotal7d)}</strong>
            </div>
            <div>
              <span>Best day</span>
              <strong>{formatNumber(bestVisitDay.unique_visits)}</strong>
              <em>{bestVisitDay.label}</em>
            </div>
            <div>
              <span>Avg/day</span>
              <strong>{formatNumber(Math.round(visitTotal7d / Math.max(visitActivity.length, 1)))}</strong>
            </div>
          </footer>
        </article>

        <article className="ao-panel ao-panel--attention">
          <header className="ao-panel__header">
            <div>
              <h3><Activity size={16} /> Needs Attention</h3>
              <p>Issues that can block learners.</p>
            </div>
            <b>{formatNumber(reviewQueueCount)}</b>
          </header>
          <div className="ao-attention-list">
            {attentionItems.map((item) => (
              <button type="button" key={item.label} onClick={() => onNavigate(item.target)}>
                <IconBubble icon={item.icon} tone={item.tone} />
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </span>
                <em className={`is-${item.tone}`}>{formatNumber(item.value)}</em>
              </button>
            ))}
          </div>
        </article>

        <article className="ao-panel ao-panel--entry-paths">
          <header className="ao-panel__header">
            <div>
              <h3>Entry Paths</h3>
              <p>First public page seen by unique visitors.</p>
            </div>
          </header>
          <div className="ao-entry-path-list">
            {topEntryPaths.map((entry) => (
              <div key={entry.path}>
                <span>{entry.path || "/"}</span>
                <strong>{formatNumber(entry.visits)} visits</strong>
              </div>
            ))}
            {topEntryPaths.length === 0 && <EmptyState icon={Globe2} title="No entry paths yet">Entry paths appear after public traffic is recorded.</EmptyState>}
          </div>
        </article>

        <article className="ao-panel ao-panel--track-health">
          <header className="ao-panel__header">
            <div>
              <h3>Track Health</h3>
              <p>Enrollment and completion by track.</p>
            </div>
            <button type="button" onClick={() => onNavigate("curriculum")}>View tracks</button>
          </header>
          <div className="ao-track-health-list">
            {trackPerformance.slice(0, 4).map((track, index) => (
              <button type="button" key={track.track_id} onClick={() => onNavigate("curriculum")}>
                <IconBubble icon={[Code2, BookOpen, Award, FolderTree][index % 4]} tone={["green", "blue", "amber", "violet"][index % 4]} />
                <span>
                  <strong>{track.title}</strong>
                  <small>{formatNumber(track.enrolled)} learners</small>
                </span>
                <div aria-label={`${track.progress_rate || 0}%`}>
                  <i style={{ width: `${clampNumber(track.progress_rate)}%` }} />
                </div>
                <em>{track.progress_rate || 0}%</em>
              </button>
            ))}
            {trackPerformance.length === 0 && <EmptyState icon={FolderTree} title="No tracks yet">Create tracks in Curriculum Builder to see health here.</EmptyState>}
          </div>
        </article>

        <article className="ao-panel ao-panel--live">
          <header className="ao-panel__header">
            <div>
              <h3>Live Activity</h3>
              <p>Latest learner and judge events.</p>
            </div>
            <button type="button" onClick={() => onNavigate("submissions")}>View all</button>
          </header>
          <div className="ao-live-list">
            {liveActivity.map((item, index) => (
              <div key={`${item.label}-${index}`}>
                <span className={`ao-live-dot ao-live-dot--${item.tone}`} />
                <IconBubble icon={item.icon} tone={item.tone} />
                <strong>{item.label}</strong>
                <em>{item.time}</em>
              </div>
            ))}
            {liveActivity.length === 0 && <EmptyState icon={Activity} title="No live activity yet">Learner activity will appear here when the platform receives events.</EmptyState>}
          </div>
        </article>

        <article className="ao-panel ao-panel--recent-runs">
          <header className="ao-panel__header">
            <div>
              <h3>Recent Judge Runs</h3>
            </div>
            <button type="button" onClick={() => onNavigate("submissions")}>View all</button>
          </header>
          <div className="ao-runs-list">
            {attempts.slice(0, 5).map((attempt) => (
              <button type="button" key={attempt.id} onClick={() => onNavigate("submissions")}>
                <IconBubble icon={Code2} tone={attempt.status === "failed" ? "red" : "green"} />
                <span>
                  <strong>{attempt.exercise_title || "Exercise"}</strong>
                  <small className={attempt.status === "failed" ? "is-bad" : ""}>{prettyStatus(attempt.status || "accepted")} - {attempt.tests_total ? `${attempt.tests_passed}/${attempt.tests_total}` : prettyStatus(attempt.mode)}</small>
                </span>
                <em>{formatRelativeTime(attempt.created_at)}</em>
              </button>
            ))}
            {attempts.length === 0 && <EmptyState icon={ClipboardCheck} title="No judge runs yet">Workspace runs will appear here.</EmptyState>}
          </div>
        </article>

        <article className="ao-panel ao-panel--top-learners">
          <header className="ao-panel__header">
            <div>
              <h3>Top Learners</h3>
            </div>
            <button type="button" onClick={() => onNavigate("leaderboards")}>Leaderboard</button>
          </header>
          <div className="ao-top-list">
            {topLearners.slice(0, 5).map((learner, index) => {
              const name = learner.display_name || learner.username;
              return (
                <button type="button" key={learner.user_id} onClick={() => onNavigate("leaderboards")}>
                  <b>#{index + 1}</b>
                  <span>{learner.avatar_url ? <img src={learner.avatar_url} alt={name} /> : <img src={learnerAvatars[index % learnerAvatars.length]} alt="" />}</span>
                  <strong>{name}</strong>
                  <em>{formatNumber(learner.total_xp)} XP</em>
                </button>
              );
            })}
            {topLearners.length === 0 && <EmptyState icon={Trophy} title="No XP yet">Top learners will appear here after XP is awarded.</EmptyState>}
          </div>
        </article>

        <article className="ao-panel ao-panel--readiness">
          <header className="ao-panel__header">
            <div>
              <h3>Content Readiness</h3>
            </div>
          </header>
          <div className="ao-readiness-body">
            <div
              className="ao-readiness-donut"
              style={{
                "--ready": `${readinessSlices[0].percent}%`,
                "--review": `${readinessSlices[1].percent}%`,
              }}
            >
              <strong>{contentReadiness}%</strong>
              <span>Ready</span>
            </div>
            <div className="ao-readiness-legend">
              {readinessSlices.map((item) => (
                <div key={item.label}>
                  <i className={`is-${item.tone}`} />
                  <span>{item.label}</span>
                  <strong>{item.percent}% ({formatNumber(item.value)})</strong>
                </div>
              ))}
            </div>
          </div>
          <footer className="ao-readiness-stats">
            <div>
              <span>Total Exercises</span>
              <strong>{formatNumber(dashboardStats.total_exercises ?? 0)}</strong>
            </div>
            <div>
              <span>Needs Review</span>
              <strong>{formatNumber(reviewCount)}</strong>
            </div>
          </footer>
        </article>
      </section>
    </div>
  );
}
