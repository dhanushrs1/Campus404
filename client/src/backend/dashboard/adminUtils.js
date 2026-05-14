export function formatNumber(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return value ?? "0";
  return new Intl.NumberFormat().format(parsed);
}

export function prettyStatus(value) {
  return String(value || "unknown")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export function statusTone(value) {
  const normalized = String(value || "").toLowerCase();
  if (["healthy", "ready", "online", "synced", "stable", "operational"].includes(normalized)) return "good";
  if (["needs_review", "degraded", "warning", "unknown"].includes(normalized)) return "warn";
  if (["unreachable", "failed", "offline", "error"].includes(normalized)) return "bad";
  return "neutral";
}

export function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function clampNumber(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, toNumber(value)));
}

export function percentOf(value, total) {
  const denominator = toNumber(total);
  if (denominator <= 0) return 0;
  return Math.round((toNumber(value) / denominator) * 100);
}

export function percentChange(current, previous) {
  const now = toNumber(current);
  const before = toNumber(previous);
  if (before <= 0) return now > 0 ? 100 : 0;
  return Math.round(((now - before) / before) * 100);
}

export function sumActivity(activity, key) {
  return (activity || []).reduce((total, day) => total + toNumber(day?.[key]), 0);
}

export function formatDayLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "");
  return date.toLocaleDateString(undefined, { weekday: "short" });
}

export function formatShortDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "");
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function isoDate(date) {
  const next = new Date(date);
  next.setHours(12, 0, 0, 0);
  return next.toISOString().slice(0, 10);
}

export function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12);
}

export function buildActivitySeries(activity, rangeDays = 7, endDateValue = new Date()) {
  const source = Array.isArray(activity) ? activity : [];
  const byDate = new Map(source.map((item) => [item.date, item]));
  const endDate = new Date(endDateValue);
  const safeEnd = Number.isNaN(endDate.getTime()) ? new Date() : endDate;
  const safeRange = Math.max(1, Math.min(120, Number(rangeDays) || 7));

  return Array.from({ length: safeRange }, (_, index) => {
    const date = addDays(safeEnd, index - safeRange + 1);
    const key = isoDate(date);
    const direct = byDate.get(key);
    if (direct) return direct;

    return {
      date: key,
      sessions: 0,
      unique_visits: 0,
      active_users: 0,
      exercise_attempts: 0,
      passed_attempts: 0,
      quiz_completions: 0,
      xp: 0,
      new_users: 0,
    };
  });
}

export function formatRelativeTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

export function healthScore(checks) {
  if (!checks.length) return 0;
  const scoreByTone = { good: 100, warn: 64, neutral: 52, bad: 18 };
  const total = checks.reduce((sum, check) => sum + (scoreByTone[statusTone(check.value)] ?? 52), 0);
  return Math.round(total / checks.length);
}
