import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Code2,
  Database,
  FolderTree,
  Globe2,
  Radio,
  Trophy,
  Users,
} from "lucide-react";
import { apiUrl } from "../../../shared/api.js";
import { EmptyState, IconBubble, TrendPill, UsageChart } from "../../shared/AdminWidgets.jsx";
import {
  addDays,
  buildActivitySeries,
  clampNumber,
  formatNumber,
  formatRelativeTime,
  formatShortDate,
  isoDate,
  percentChange,
  percentOf,
  prettyStatus,
  startOfMonth,
  statusTone,
  sumActivity,
  toNumber,
} from "../adminUtils.js";

function MonthCalendar({ activity, selectedDate, onSelectDate }) {
  const selected = new Date(selectedDate);
  const safeSelected = Number.isNaN(selected.getTime()) ? new Date() : selected;
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(safeSelected));

  useEffect(() => {
    setVisibleMonth(startOfMonth(safeSelected));
  }, [selectedDate]);

  const monthStart = startOfMonth(visibleMonth);
  const firstDay = monthStart.getDay();
  const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  const cells = [
    ...Array.from({ length: firstDay }, (_, index) => ({ key: `blank-${index}`, blank: true })),
    ...Array.from({ length: daysInMonth }, (_, index) => {
      const date = new Date(monthStart.getFullYear(), monthStart.getMonth(), index + 1, 12);
      return { key: isoDate(date), date };
    }),
  ];
  const activityMap = new Map((activity || []).map((item) => [item.date, item]));
  const maxVolume = Math.max(...(activity || []).map((item) => toNumber(item.sessions) + toNumber(item.exercise_attempts)), 1);
  const monthLabel = monthStart.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="aa-calendar">
      <header>
        <button type="button" onClick={() => setVisibleMonth(startOfMonth(new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1)))} aria-label="Previous month">
          {"<"}
        </button>
        <strong>{monthLabel}</strong>
        <button type="button" onClick={() => setVisibleMonth(startOfMonth(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1)))} aria-label="Next month">
          {">"}
        </button>
      </header>
      <div className="aa-calendar__weekdays" aria-hidden="true">
        {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
      </div>
      <div className="aa-calendar__grid">
        {cells.map((cell) => {
          if (cell.blank) return <span key={cell.key} />;
          const key = isoDate(cell.date);
          const day = activityMap.get(key) || {};
          const volume = toNumber(day.sessions) + toNumber(day.exercise_attempts);
          const intensity = volume <= 0 ? 0 : Math.max(1, Math.ceil((volume / maxVolume) * 4));
          const isSelected = key === isoDate(safeSelected);

          return (
            <button
              type="button"
              key={key}
              className={`${isSelected ? "is-selected" : ""} is-heat-${intensity}`}
              onClick={() => onSelectDate(key)}
              aria-label={`${key}: ${formatNumber(volume)} activity events`}
            >
              <span>{cell.date.getDate()}</span>
              <small>{volume ? formatNumber(volume) : ""}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function AnalyticsPage({ onSessionExpired }) {
  const [stats, setStats] = useState(null);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState("");
  const [rangeDays, setRangeDays] = useState(30);
  const [selectedDate, setSelectedDate] = useState(() => isoDate(new Date()));

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

    async function loadAnalytics() {
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
        setError(failures[0].reason?.message || "Unable to load analytics.");
      }
    }

    void loadAnalytics();
    return () => {
      disposed = true;
    };
  }, [onSessionExpired]);

  const dashboardStats = stats || {};
  const dashboardHealth = health || {};
  const activity = useMemo(
    () => buildActivitySeries(dashboardStats?.activity_by_day || [], rangeDays, selectedDate),
    [dashboardStats?.activity_by_day, rangeDays, selectedDate],
  );
  const previousActivity = useMemo(
    () => buildActivitySeries(dashboardStats?.activity_by_day || [], rangeDays, addDays(new Date(selectedDate), -rangeDays)),
    [dashboardStats?.activity_by_day, rangeDays, selectedDate],
  );
  const attempts = dashboardHealth?.recent_attempts || [];
  const trackPerformance = dashboardStats?.track_performance || [];
  const topLearners = dashboardStats?.top_learners || [];
  const topEntryPaths = Array.isArray(dashboardStats?.top_entry_paths) ? dashboardStats.top_entry_paths : [];
  const totals = {
    visits: sumActivity(activity, "sessions"),
    activeUsers: sumActivity(activity, "active_users"),
    runs: sumActivity(activity, "exercise_attempts"),
    passed: sumActivity(activity, "passed_attempts"),
    quizzes: sumActivity(activity, "quiz_completions"),
    xp: sumActivity(activity, "xp"),
    newUsers: sumActivity(activity, "new_users"),
  };
  const previousTotals = {
    visits: sumActivity(previousActivity, "sessions"),
    activeUsers: sumActivity(previousActivity, "active_users"),
    runs: sumActivity(previousActivity, "exercise_attempts"),
    passed: sumActivity(previousActivity, "passed_attempts"),
    quizzes: sumActivity(previousActivity, "quiz_completions"),
    xp: sumActivity(previousActivity, "xp"),
    newUsers: sumActivity(previousActivity, "new_users"),
  };
  const passRate = percentOf(totals.passed, totals.runs);
  const contentReadiness = percentOf(dashboardStats?.published_exercises, dashboardStats?.total_exercises);
  const engagementRate = percentOf(dashboardStats?.active_users_24h, dashboardStats?.total_users);
  const maxTrack = Math.max(...trackPerformance.map((track) => toNumber(track.enrolled)), 1);
  const channelRows = topEntryPaths.map((entry, index) => ({
    label: entry.path || "/",
    value: toNumber(entry.visits),
    tone: ["blue", "green", "violet", "amber"][index % 4],
  }));
  const maxChannel = Math.max(...channelRows.map((row) => row.value), 1);
  const funnelRows = [
    { label: "Visited platform", value: totals.visits, percent: 100 },
    { label: "Opened workspace", value: totals.runs, percent: percentOf(totals.runs, totals.visits) },
    { label: "Passed checks", value: totals.passed, percent: passRate },
    { label: "Completed quiz", value: totals.quizzes, percent: percentOf(totals.quizzes, totals.runs) },
  ];
  const analyticsCards = [
    { label: "Users", value: totals.visits, detail: `${formatNumber(totals.newUsers)} new users`, trend: percentChange(totals.visits, previousTotals.visits), icon: Users, tone: "blue" },
    { label: "Active Learners", value: totals.activeUsers, detail: `${engagementRate}% active today`, trend: percentChange(totals.activeUsers, previousTotals.activeUsers), icon: Activity, tone: "green" },
    { label: "Learning Events", value: totals.runs + totals.quizzes, detail: `${formatNumber(totals.quizzes)} quiz events`, trend: percentChange(totals.runs + totals.quizzes, previousTotals.runs + previousTotals.quizzes), icon: Code2, tone: "violet" },
    { label: "XP Velocity", value: totals.xp, detail: `${formatNumber(Math.round(totals.xp / Math.max(rangeDays, 1)))} XP/day`, trend: percentChange(totals.xp, previousTotals.xp), icon: Trophy, tone: "amber" },
  ];

  return (
    <div className="aa-page">
      <section className="aa-hero">
        <div>
          <span><BarChart3 size={16} /> Advanced Analytics</span>
          <h2>Learning intelligence dashboard</h2>
          <p>Measure acquisition, engagement, learning conversion, content readiness, and judge reliability across custom reporting windows.</p>
        </div>
        <div className="aa-controls">
          <div className="aa-range-tabs" role="group" aria-label="Analytics date range">
            {[7, 20, 30, 90].map((days) => (
              <button type="button" key={days} className={rangeDays === days ? "is-active" : ""} onClick={() => setRangeDays(days)}>
                {days} days
              </button>
            ))}
          </div>
          <label className="aa-date-input">
            <CalendarDays size={16} />
            <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value || isoDate(new Date()))} />
          </label>
        </div>
      </section>

      {error && <div className="ap-inline-error">{error}</div>}

      <section className="aa-metric-grid">
        {analyticsCards.map(({ label, value, detail, trend, icon: Icon, tone }) => (
          <article className={`aa-metric aa-metric--${tone}`} key={label}>
            <IconBubble icon={Icon} tone={tone} />
            <span>{label}</span>
            <strong>{formatNumber(value)}</strong>
            <p>{detail}</p>
            <TrendPill value={trend} />
          </article>
        ))}
      </section>

      <section className="aa-grid">
        <article className="aa-panel aa-panel--chart">
          <header>
            <div>
              <h3>{rangeDays}-day event exploration</h3>
              <p>{formatShortDate(activity[0]?.date)} to {formatShortDate(activity[activity.length - 1]?.date)}</p>
            </div>
            <div className="aa-chart-summary">
              <span>{formatNumber(totals.visits)} visits</span>
              <span>{formatNumber(totals.runs)} code runs</span>
              <span>{formatNumber(totals.quizzes)} quizzes</span>
            </div>
          </header>
          <div className="ao-legend ao-legend--reference">
            <span><i className="is-blue" /> Visits</span>
            <span><i className="is-green" /> Active Learners</span>
            <span><i className="is-violet" /> Code Runs</span>
            <span><i className="is-amber" /> Quiz Completions</span>
            <span><i className="is-cyan" /> Submissions</span>
          </div>
          <UsageChart activity={activity} maxDays={rangeDays} />
        </article>

        <article className="aa-panel aa-panel--calendar">
          <header>
            <div>
              <h3>Monthly timetable</h3>
              <p>Select a day to rebuild the analytics window.</p>
            </div>
          </header>
          <MonthCalendar activity={activity} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
        </article>

        <article className="aa-panel">
          <header>
            <div>
              <h3>Entry paths</h3>
              <p>First public page seen by unique visitors.</p>
            </div>
          </header>
          <div className="aa-bar-list">
            {channelRows.map((row) => (
              <div key={row.label}>
                <header>
                  <span>{row.label}</span>
                  <strong>{formatNumber(row.value)}</strong>
                </header>
                <div><i className={`is-${row.tone}`} style={{ width: `${percentOf(row.value, maxChannel)}%` }} /></div>
              </div>
            ))}
            {channelRows.length === 0 && (
              <EmptyState icon={Globe2} title="No entry paths yet">
                Entry paths appear after public traffic is recorded.
              </EmptyState>
            )}
          </div>
        </article>

        <article className="aa-panel">
          <header>
            <div>
              <h3>Conversion funnel</h3>
              <p>From visit to completed learning action.</p>
            </div>
          </header>
          <div className="aa-funnel">
            {funnelRows.map((row) => (
              <div key={row.label}>
                <span>{row.label}</span>
                <strong>{formatNumber(row.value)}</strong>
                <div><i style={{ width: `${clampNumber(row.percent)}%` }} /></div>
                <em>{row.percent}%</em>
              </div>
            ))}
          </div>
        </article>

        <article className="aa-panel">
          <header>
            <div>
              <h3>Track engagement</h3>
              <p>Enrollment and completion pressure by track.</p>
            </div>
          </header>
          <div className="aa-track-table">
            {trackPerformance.slice(0, 6).map((track) => (
              <div key={track.track_id}>
                <span>
                  <strong>{track.title}</strong>
                  <small>{track.is_published ? "Published" : "Draft"}</small>
                </span>
                <div><i style={{ width: `${percentOf(track.enrolled, maxTrack)}%` }} /></div>
                <em>{formatNumber(track.enrolled)} learners</em>
                <b>{track.progress_rate || 0}%</b>
              </div>
            ))}
          </div>
        </article>

        <article className="aa-panel">
          <header>
            <div>
              <h3>Reliability monitor</h3>
              <p>Judge and platform health signals.</p>
            </div>
          </header>
          <div className="aa-reliability">
            <div>
              <IconBubble icon={Radio} tone={statusTone(dashboardStats?.judge_health || dashboardHealth?.judge_health)} />
              <span>Judge</span>
              <strong className={`is-${statusTone(dashboardStats?.judge_health || dashboardHealth?.judge_health)}`}>{prettyStatus(dashboardStats?.judge_health || dashboardHealth?.judge_health || "unknown")}</strong>
            </div>
            <div>
              <IconBubble icon={Database} tone={statusTone(dashboardStats?.database_health || "healthy")} />
              <span>Database</span>
              <strong className={`is-${statusTone(dashboardStats?.database_health || "healthy")}`}>{prettyStatus(dashboardStats?.database_health || "healthy")}</strong>
            </div>
            <div>
              <IconBubble icon={FolderTree} tone={contentReadiness >= 75 ? "green" : "amber"} />
              <span>Content readiness</span>
              <strong>{contentReadiness}%</strong>
            </div>
            <div>
              <IconBubble icon={Users} tone={engagementRate >= 30 ? "green" : "amber"} />
              <span>Engagement</span>
              <strong>{engagementRate}%</strong>
            </div>
          </div>
        </article>

        <article className="aa-panel aa-panel--wide">
          <header>
            <div>
              <h3>Recent high-signal events</h3>
              <p>Latest submissions and learner movement in the selected context.</p>
            </div>
          </header>
          <div className="aa-event-table">
            {attempts.slice(0, 6).map((attempt) => (
              <div key={attempt.id}>
                <IconBubble icon={attempt.status === "failed" ? Activity : CheckCircle2} tone={attempt.status === "failed" ? "red" : "green"} />
                <span>
                  <strong>{attempt.exercise_title || "Exercise"}</strong>
                  <small>{attempt.username || "learner"} - {prettyStatus(attempt.mode || "code")}</small>
                </span>
                <em>{prettyStatus(attempt.status || "submitted")}</em>
                <b>{formatRelativeTime(attempt.created_at)}</b>
              </div>
            ))}
          </div>
        </article>

        <article className="aa-panel aa-panel--wide">
          <header>
            <div>
              <h3>Top learner contribution</h3>
              <p>XP distribution across the current leaders.</p>
            </div>
          </header>
          <div className="aa-learner-strip">
            {topLearners.slice(0, 5).map((learner, index) => {
              const name = learner.display_name || learner.username;
              const maxXp = Math.max(...topLearners.map((item) => toNumber(item.total_xp)), 1);
              return (
                <div key={learner.user_id}>
                  <b>#{index + 1}</b>
                  <span>{name}</span>
                  <strong>{formatNumber(learner.total_xp)} XP</strong>
                  <div><i style={{ width: `${percentOf(learner.total_xp, maxXp)}%` }} /></div>
                </div>
              );
            })}
          </div>
        </article>
      </section>
    </div>
  );
}
