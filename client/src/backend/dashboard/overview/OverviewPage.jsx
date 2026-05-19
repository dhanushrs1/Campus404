import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Award,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Code2,
  Database,
  FolderTree,
  Globe2,
  Inbox,
  User,
  Users,
  HelpCircle
} from "lucide-react";
import {
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
import { authenticatedFetch } from "../../../shared/authSession.js";
import {
  formatNumber,
  formatRelativeTime,
  percentOf,
  prettyStatus,
  toNumber,
} from "../adminUtils.js";
import "./OverviewPage.css";

// ... existing helper functions and chart components ...

const TONE_COLORS = {
  blue: "#3b82f6",
  indigo: "#6366f1",
  amber: "#f59e0b",
  green: "#10b981",
};

const TONE_BACKGROUNDS = {
  blue: "#eff6ff",
  indigo: "#eef2ff",
  amber: "#fffbeb",
  green: "#ecfdf5",
};

const TONE_SHADOWS = {
  blue: "rgba(59, 130, 246, 0.16)",
  indigo: "rgba(99, 102, 241, 0.16)",
  amber: "rgba(245, 158, 11, 0.16)",
  green: "rgba(16, 185, 129, 0.16)",
};

function statTrendTone(value) {
  const numberValue = Number(value);
  if (Number.isNaN(numberValue) || numberValue === 0) return "neutral";
  return numberValue > 0 ? "positive" : "negative";
}

function formatCompactNumber(value) {
  const numberValue = toNumber(value);
  if (Math.abs(numberValue) < 1000) return formatNumber(numberValue);

  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(numberValue);
}

function displayNameFromUsername(username) {
  const cleaned = String(username || "admin").replace(/^@/, "").trim();
  if (!cleaned) return "Admin";
  return cleaned
    .split(/[._-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatVisitLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "?";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function normalizeVisitDay(day) {
  const visits = toNumber(day?.visits ?? day?.total_visits ?? day?.sessions ?? day?.unique_visits);
  return {
    date: day?.date,
    label: formatVisitLabel(day?.date),
    visits,
    unique_visits: toNumber(day?.unique_visits ?? day?.unique_visitors ?? visits),
  };
}

function VisitTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="overview-chart-tooltip">
      <strong>{label}</strong>: {formatNumber(payload[0]?.value ?? 0)} visits
    </div>
  );
}

function DailyVisitsChart({ data }) {
  const hasVisits = data.some((day) => toNumber(day.visits) > 0);

  if (!data.length || !hasVisits) {
    return (
      <div className="overview-empty">
        <Globe2 size={32} />
        <p>No visits recorded yet</p>
      </div>
    );
  }

  return (
    <div style={{ height: "300px", marginTop: "20px" }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} allowDecimals={false} />
          <Tooltip content={<VisitTooltip />} cursor={{ fill: "#f8fafc" }} />
          <Bar dataKey="visits" name="Visits" radius={[4, 4, 0, 0]} fill="#3b82f6" />
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
      const response = await authenticatedFetch(apiUrl(path));

      if (response.status === 401) {
        onSessionExpired?.();
        throw new Error("Session expired.");
      }

      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.detail || `Unable to load ${path}`);
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

      if (statsResult.status === "rejected" && healthResult.status === "rejected") {
        setError("Unable to load admin dashboard.");
      }
    }

    void loadDashboard();
    return () => { disposed = true; };
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
  const trackPerformance = Array.isArray(dashboardStats.track_performance) ? dashboardStats.track_performance : [];

  const todayVisits = visitActivity[visitActivity.length - 1]?.visits ?? toNumber(dashboardStats.visits_last_24h);
  
  const adminName = displayNameFromUsername(username);

  const commandHealth = [
    { label: "Database", value: dashboardStats.database_health || "unknown", icon: Database, tone: "indigo" },
    { label: "Judge Engine", value: dashboardStats.judge_health || dashboardHealth.judge_health || "unknown", icon: Activity, tone: "blue" },
  ];

  const metricCards = [
    { label: "Total Learners", value: dashboardStats.total_users ?? 0, help: "Aggregate registered users across platform", icon: Users, tone: "blue", trend: dashboardStats.new_users_24h || 0, trendLabel: "new today" },
    { label: "Active Today", value: dashboardStats.active_users_24h ?? 0, help: "Learners who solved exercises today", icon: User, tone: "indigo", trend: percentOf(dashboardStats.active_users_24h, dashboardStats.total_users), trendLabel: "% of total" },
    { label: "XP Awarded (24h)", value: dashboardStats.xp_awarded_24h ?? 0, help: "Experience points earned naturally", icon: Award, tone: "amber", trend: dashboardStats.xp_last_7_days || 0, trendLabel: "this week" },
    { label: "Visits Today", value: todayVisits, help: "Total tracked visits today, including repeat visits from the same visitor.", icon: Globe2, tone: "green", trend: dashboardStats.unique_visits_24h || 0, trendLabel: "unique visitors" },
  ];

  const attentionItems = [
    { label: "Failed judge runs", value: dashboardStats.failed_attempts_last_24h ?? 0, icon: Activity, target: "submissions" },
    { label: "Pending content", value: dashboardStats.pending_content ?? 0, icon: ClipboardCheck, target: "curriculum" },
    { label: "Unread messages", value: dashboardStats.unread_messages ?? 0, icon: Inbox, target: "contacts" },
  ];

  return (
    <div className="overview-container">
      {error && <div style={{ color: "red" }}>{error}</div>}

      <header className="overview-hero">
        <div className="overview-hero-text">
          <h2>Overview Dashboard</h2>
          <p>Welcome back, {adminName}. Here's the health and performance matrix.</p>
          
          <div className="hero-system-status">
            {commandHealth.map((h, i) => {
              const isHealthy = h.value === "healthy";
              const isUnknown = h.value === "unknown";
              const statusType = isHealthy ? "healthy" : (isUnknown ? "warn" : "error");
              const statusText = isHealthy ? "Active" : (isUnknown ? "Standby" : "Offline");
              return (
                <div className={`hero-status-badge hero-status--${statusType}`} key={i}>
                  <span className="system-pulse-dot"></span>
                  <strong>{h.label}:</strong> {statusText}
                </div>
              );
            })}
          </div>
        </div>
        <div className="overview-hero-visual">
          <img src={ASSETS.tracks.adminCommandCenter} alt="Dashboard Graphic" />
        </div>
      </header>

      <section className="overview-stats-grid">
        {metricCards.map(({ label, value, help, icon: Icon, tone, trend, trendLabel }) => (
          <article
            className="overview-stat-card"
            key={label}
            style={{
              "--overview-accent": TONE_COLORS[tone] || TONE_COLORS.blue,
              "--overview-accent-bg": TONE_BACKGROUNDS[tone] || TONE_BACKGROUNDS.blue,
              "--overview-accent-shadow": TONE_SHADOWS[tone] || TONE_SHADOWS.blue,
            }}
          >
            <div className="overview-stat-header">
              <div className="overview-stat-title">
                <div className="overview-stat-icon">
                  <Icon size={20} />
                </div>
                <h3 className="overview-stat-name">{label}</h3>
              </div>
              <span className="ap-tooltip-wrap" data-tooltip={help}><HelpCircle size={16} className="overview-stat-help" /></span>
            </div>
            
            <div className="overview-stat-body">
              <div className="overview-stat-value" title={formatNumber(value)}>{formatCompactNumber(value)}</div>
              <div className={`overview-stat-trend ${statTrendTone(trend)}`}>{trend} {trendLabel}</div>
            </div>
          </article>
        ))}
      </section>

      <section className="overview-panels-grid">
        
        <article className="overview-panel overview-panel-visits">
          <div className="overview-panel-title">
            <h3><Globe2 size={20} /> Daily Visits</h3>
            <button onClick={() => onNavigate("analytics")}>Full Analytics</button>
          </div>
          <DailyVisitsChart data={visitActivity} />
        </article>

        <article className="overview-panel overview-panel-attention">
          <div className="overview-panel-title">
            <h3><Activity size={20} /> Needs Attention</h3>
          </div>
          <div>
            {attentionItems.map((item, i) => (
              <div className="overview-list-item" key={i} onClick={() => onNavigate(item.target)}>
                <div style={{ color: "#64748b" }}><item.icon size={18} /></div>
                <div className="overview-list-item-content">
                  <div className="overview-list-item-title">{item.label}</div>
                </div>
                <div className="overview-list-item-value">{formatNumber(item.value)}</div>
              </div>
            ))}
          </div>
        </article>

        <article className="overview-panel overview-panel-live">
          <div className="overview-panel-title">
            <h3><CheckCircle2 size={20} /> Recent Executions</h3>
            <button onClick={() => onNavigate("submissions")}>View Activity</button>
          </div>
          <div>
            {attempts.slice(0, 5).map((attempt, i) => (
              <div className="overview-list-item" key={i} onClick={() => onNavigate("submissions")}>
                <Code2 size={18} color={String(attempt.status || "").toLowerCase() === "failed" ? "#e11d48" : "#10b981"} />
                <div className="overview-list-item-content">
                  <div className="overview-list-item-title">{attempt.exercise_title || "Unknown Exercise"}</div>
                  <div className="overview-list-item-sub">{prettyStatus(attempt.status || "accepted")} - {attempt.username || "Learner"}</div>
                </div>
                <div className="overview-list-item-value" style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                  {formatRelativeTime(attempt.created_at)}
                </div>
              </div>
            ))}
            {attempts.length === 0 && <div className="overview-empty">No executions yet.</div>}
          </div>
        </article>

        <article className="overview-panel overview-panel-tracks">
          <div className="overview-panel-title">
            <h3><FolderTree size={20} /> Top Tracks</h3>
            <button onClick={() => onNavigate("curriculum")}>Manage Curriculum</button>
          </div>
          <div>
            {trackPerformance.slice(0, 5).map((track, i) => (
              <div className="overview-list-item" key={i} onClick={() => onNavigate("curriculum")}>
                <BookOpen size={18} color="#3b82f6" />
                <div className="overview-list-item-content">
                  <div className="overview-list-item-title">{track.title}</div>
                  <div className="overview-list-item-sub">{formatNumber(track.enrolled)} learners</div>
                </div>
                <div className="overview-list-item-value">{track.progress_rate || 0}%</div>
              </div>
            ))}
            {trackPerformance.length === 0 && <div className="overview-empty">No tracks configured yet.</div>}
          </div>
        </article>

      </section>
    </div>
  );
}
