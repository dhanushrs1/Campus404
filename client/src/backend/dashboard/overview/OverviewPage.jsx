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
  HelpCircle
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
import { authenticatedFetch } from "../../../shared/authSession.js";
import { EmptyState, IconBubble } from "../../shared/AdminWidgets.jsx";
import {
  clampNumber,
  formatNumber,
  formatRelativeTime,
  percentChange,
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
  return {
    date: day?.date,
    label: formatVisitLabel(day?.date),
    unique_visits: toNumber(day?.unique_visits ?? day?.visits ?? day?.sessions),
  };
}

function KpiSparkChart({ data, dataKey, tone = "blue" }) {
  const hasData = Array.isArray(data) && data.length > 1;
  if (!hasData) return null;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={"spark-"} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={TONE_COLORS[tone] || TONE_COLORS.blue} stopOpacity={0.2} />
            <stop offset="95%" stopColor={TONE_COLORS[tone] || TONE_COLORS.blue} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={TONE_COLORS[tone] || TONE_COLORS.blue}
          strokeWidth={2}
          fill={"url(#spark-)"}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function VisitTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1e293b", color: "white", padding: "8px 12px", borderRadius: "8px", fontSize: "0.875rem" }}>
      <strong>{label}</strong>: {formatNumber(payload[0]?.value ?? 0)} visits
    </div>
  );
}

function DailyVisitsChart({ data }) {
  const hasVisits = data.some((day) => toNumber(day.unique_visits) > 0);

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
          <Bar dataKey="unique_visits" name="Unique visits" radius={[4, 4, 0, 0]} fill="#3b82f6" />
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

  const todayVisits = visitActivity[visitActivity.length - 1]?.unique_visits ?? toNumber(dashboardStats.unique_visits_24h);
  
  const adminName = displayNameFromUsername(username);
  const todayLabel = new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

  const commandHealth = [
    { label: "Database", value: dashboardStats.database_health || "unknown", icon: Database, tone: "indigo" },
    { label: "Judge Engine", value: dashboardStats.judge_health || dashboardHealth.judge_health || "unknown", icon: Activity, tone: "blue" },
  ];

  const metricCards = [
    { label: "Total Learners", value: dashboardStats.total_users ?? 0, help: "Aggregate registered users across platform", icon: Users, tone: "blue", trend: dashboardStats.new_users_24h || 0, trendLabel: "new today", seriesKey: "new_users", series: activity },
    { label: "Active Today", value: dashboardStats.active_users_24h ?? 0, help: "Learners who solved exercises today", icon: User, tone: "indigo", trend: percentOf(dashboardStats.active_users_24h, dashboardStats.total_users), trendLabel: "% of total", seriesKey: "active_users", series: activity },
    { label: "XP Awarded (24h)", value: dashboardStats.xp_awarded_24h ?? 0, help: "Experience points earned naturally", icon: Award, tone: "amber", trend: dashboardStats.xp_last_7_days || 0, trendLabel: "this week", seriesKey: "xp", series: activity },
    { label: "Visits Today", value: todayVisits, help: "Unique site visits", icon: Globe2, tone: "green", trend: "-", trendLabel: "avg", seriesKey: "unique_visits", series: visitActivity },
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
          <span>{todayLabel}</span>
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
        {metricCards.map(({ label, value, help, icon: Icon, tone, trend, trendLabel, series, seriesKey }) => (
          <article className="overview-stat-card" key={label}>
            <div className="overview-stat-header">
              <div className="overview-stat-title">
                <div className="overview-stat-icon" style={{ backgroundColor: "#f8fafc", color: TONE_COLORS[tone] }}>
                  <Icon size={20} />
                </div>
                <h3 className="overview-stat-name">{label}</h3>
              </div>
              <span className="overview-stat-tooltip-wrap" data-tooltip={help}><HelpCircle size={16} className="overview-stat-help" /></span>
            </div>
            
            <div className="overview-stat-body">
              <div className="overview-stat-value">{formatNumber(value)}</div>
              <div className="overview-stat-trend neutral">{trend} {trendLabel}</div>
            </div>
            
            <div className="overview-stat-chart">
              <KpiSparkChart data={series} dataKey={seriesKey} tone={tone} />
            </div>
          </article>
        ))}
      </section>

      <section className="overview-panels-grid">
        
        <article className="overview-panel overview-panel-visits">
          <div className="overview-panel-title">
            <h3><Globe2 size={20} /> Daily Unique Visits</h3>
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



