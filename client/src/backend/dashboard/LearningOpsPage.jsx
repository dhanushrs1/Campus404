import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Code2,
  FolderTree,
  Radio,
  RefreshCw,
  Search,
  Trophy,
} from "lucide-react";
import { apiUrl } from "../../shared/api.js";
import { authenticatedFetch } from "../../shared/authSession.js";
import { IconBubble } from "../shared/AdminWidgets.jsx";
import { formatRelativeTime, prettyStatus, statusTone, toNumber } from "./adminUtils.js";
import "./LearningOpsPage.css";

const ATTEMPT_FILTERS = [
  { key: "all", label: "All" },
  { key: "passed", label: "Passed" },
  { key: "failed", label: "Failed" },
  { key: "submitted", label: "Submitted" },
  { key: "running", label: "Running" },
];

const ATTEMPT_MODES = [
  { key: "all", label: "All modes" },
  { key: "code", label: "Code" },
  { key: "multi_file_code", label: "Multi-file" },
  { key: "frontend_preview", label: "Frontend" },
  { key: "project", label: "Project" },
  { key: "theory", label: "Theory" },
  { key: "quiz", label: "Quiz" },
];

const EMPTY_ATTEMPT_DATA = {
  items: [],
  next_cursor: null,
  has_more: false,
  limit: 50,
  summary: {},
};

function normalizedAttemptStatus(value) {
  return String(value || "running").trim().toLowerCase();
}

function attemptTone(status) {
  const normalized = normalizedAttemptStatus(status);
  if (normalized === "failed") return "bad";
  if (normalized === "running") return "warn";
  if (normalized === "passed" || normalized === "submitted") return "good";
  return "neutral";
}

function attemptProgress(attempt) {
  const total = toNumber(attempt?.tests_total);
  const passed = Math.min(total, Math.max(0, toNumber(attempt?.tests_passed)));
  return {
    total,
    passed,
    percent: total > 0 ? Math.round((passed / total) * 100) : 0,
  };
}

function summarizeAttempts(attempts) {
  const statuses = { passed: 0, failed: 0, submitted: 0, running: 0, other: 0 };
  const learners = new Set();
  let checksPassed = 0;
  let checksTotal = 0;

  attempts.forEach((attempt) => {
    const status = normalizedAttemptStatus(attempt.status);
    if (Object.prototype.hasOwnProperty.call(statuses, status)) {
      statuses[status] += 1;
    } else {
      statuses.other += 1;
    }

    if (attempt.username) learners.add(String(attempt.username).toLowerCase());

    const progress = attemptProgress(attempt);
    checksPassed += progress.passed;
    checksTotal += progress.total;
  });

  return {
    statuses,
    learners: learners.size,
    checksPassed,
    checksTotal,
    checkRate: checksTotal > 0 ? Math.round((checksPassed / checksTotal) * 100) : 0,
    successful: statuses.passed + statuses.submitted,
  };
}

function formatAttemptTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function attemptLocation(attempt) {
  return [attempt.track_title, attempt.section_title].filter(Boolean).join(" / ") || "No track context";
}

export default function LearningOpsPage({ variant = "health", onSessionExpired }) {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState("");
  const [healthLoading, setHealthLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reloadVersion, setReloadVersion] = useState(0);

  const [attemptData, setAttemptData] = useState(EMPTY_ATTEMPT_DATA);
  const [attemptError, setAttemptError] = useState("");
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [attemptsLoadingMore, setAttemptsLoadingMore] = useState(false);
  const [attemptStatus, setAttemptStatus] = useState("all");
  const [attemptMode, setAttemptMode] = useState("all");
  const [attemptSearchInput, setAttemptSearchInput] = useState("");
  const [attemptSearch, setAttemptSearch] = useState("");

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setAttemptSearch(attemptSearchInput.trim());
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [attemptSearchInput]);

  useEffect(() => {
    let disposed = false;

    async function loadHealth() {
      setError("");
      setHealthLoading(true);
      try {
        const response = await authenticatedFetch(apiUrl("/api/admin/learning-engine/health"));

        if (response.status === 401) {
          onSessionExpired?.();
          return;
        }

        if (!response.ok) {
          throw new Error(`Unable to load learning engine health (${response.status}).`);
        }

        const payload = await response.json();
        if (!disposed) setHealth(payload);
      } catch (err) {
        if (!disposed) setError(err.message || "Unable to load learning engine health.");
      } finally {
        if (!disposed) {
          setHealthLoading(false);
          setRefreshing(false);
        }
      }
    }

    void loadHealth();
    return () => {
      disposed = true;
    };
  }, [onSessionExpired, reloadVersion]);

  const loadAttempts = useCallback(
    async ({ append = false, cursor = null } = {}) => {
      if (variant !== "submissions") return;

      setAttemptError("");
      if (append) {
        setAttemptsLoadingMore(true);
      } else {
        setAttemptsLoading(true);
      }

      try {
        const params = new URLSearchParams({ limit: "50" });
        if (attemptStatus !== "all") params.set("status", attemptStatus);
        if (attemptMode !== "all") params.set("mode", attemptMode);
        if (attemptSearch) params.set("search", attemptSearch);
        if (cursor) params.set("cursor", cursor);

        const response = await authenticatedFetch(apiUrl(`/api/admin/submissions/attempts?${params.toString()}`));

        if (response.status === 401) {
          onSessionExpired?.();
          return;
        }

        if (!response.ok) {
          throw new Error(`Unable to load submission attempts (${response.status}).`);
        }

        const payload = await response.json();
        setAttemptData((current) => {
          if (!append) return payload;

          return {
            ...payload,
            items: [...(current.items || []), ...(payload.items || [])],
          };
        });
      } catch (err) {
        setAttemptError(err.message || "Unable to load submission attempts.");
      } finally {
        setAttemptsLoading(false);
        setAttemptsLoadingMore(false);
      }
    },
    [attemptMode, attemptSearch, attemptStatus, onSessionExpired, variant],
  );

  useEffect(() => {
    if (variant !== "submissions") return;
    void loadAttempts();
  }, [loadAttempts, reloadVersion, variant]);

  const attempts = Array.isArray(attemptData.items) ? attemptData.items : [];
  const attemptSummary = useMemo(() => summarizeAttempts(attempts), [attempts]);

  const refreshHealth = () => {
    if (refreshing) return;
    setRefreshing(true);
    setReloadVersion((current) => current + 1);
  };

  const title = variant === "leaderboards"
    ? "Leaderboard Operations"
    : variant === "submissions"
      ? "Submission Monitor"
      : "System Health";

  if (variant === "submissions") {
    const healthSignals = [
      { label: "Judge", value: health?.judge_health, icon: Radio },
      { label: "Content", value: health?.content_health, icon: FolderTree },
      { label: "Leaderboard", value: health?.leaderboard_health, icon: Trophy },
    ];

    return (
      <div className="ap-page lo-page sm-page">
        <header className="sm-hero">
          <div className="sm-hero__copy">
            <span className="sm-kicker"><ClipboardCheck size={16} /> Learning engine</span>
            <h2>Submission Monitor</h2>
            <p>Server-paginated learner attempts with safe filters, judge status, and stored check coverage.</p>
          </div>

          <div className="sm-hero__actions">
            <div className="sm-health-strip" aria-label="Learning engine signals">
              {healthSignals.map(({ label, value, icon: Icon }) => (
                <span className={`sm-health-pill is-${statusTone(value)}`} key={label}>
                  <Icon size={14} />
                  {label}
                  <strong>{prettyStatus(value || "loading")}</strong>
                </span>
              ))}
            </div>
            <button
              className="sm-refresh"
              type="button"
              onClick={refreshHealth}
              disabled={refreshing || healthLoading || attemptsLoading}
            >
              <RefreshCw size={15} className={refreshing ? "sm-spin" : ""} />
              Refresh
            </button>
          </div>
        </header>

        {error && <div className="ap-inline-error">{error}</div>}
        {attemptError && <div className="ap-inline-error">{attemptError}</div>}

        <section className="sm-summary-strip" aria-label="Loaded submission window summary">
          <article>
            <span>Loaded window</span>
            <strong>{attempts.length}</strong>
            <small>{attemptData.has_more ? "More attempts available" : "End of current query"}</small>
          </article>
          <article>
            <span>Learners</span>
            <strong>{attemptSummary.learners}</strong>
            <small>Unique in loaded rows</small>
          </article>
          <article>
            <span><CheckCircle2 size={14} /> Passed/submitted</span>
            <strong>{attemptSummary.successful}</strong>
            <small>{attemptSummary.checkRate}% check pass rate</small>
          </article>
          <article className={attemptSummary.statuses.failed ? "is-alert" : ""}>
            <span><AlertTriangle size={14} /> Failed</span>
            <strong>{attemptSummary.statuses.failed}</strong>
            <small>{attemptSummary.checksPassed} / {attemptSummary.checksTotal} checks passed</small>
          </article>
        </section>

        <section className="sm-console">
          <header className="sm-console__header">
            <div>
              <h3>Attempt Operations</h3>
              <p>Showing at most 50 rows per request. Filters and search run on the backend.</p>
            </div>
          </header>

          <div className="sm-toolbar">
            <div className="sm-filter-tabs" role="group" aria-label="Filter attempts by status">
              {ATTEMPT_FILTERS.map((filter) => (
                <button
                  className={attemptStatus === filter.key ? "is-active" : ""}
                  key={filter.key}
                  type="button"
                  onClick={() => setAttemptStatus(filter.key)}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <label className="sm-mode-select">
              <select value={attemptMode} onChange={(event) => setAttemptMode(event.target.value)} aria-label="Filter attempts by mode">
                {ATTEMPT_MODES.map((mode) => (
                  <option value={mode.key} key={mode.key}>{mode.label}</option>
                ))}
              </select>
            </label>

            <label className="sm-search">
              <Search size={16} />
              <input
                value={attemptSearchInput}
                onChange={(event) => setAttemptSearchInput(event.target.value)}
                placeholder="Search learner, exercise, track, or attempt id..."
                aria-label="Search submission attempts"
              />
            </label>
          </div>

          <div className="sm-table-wrap">
            <table className="sm-attempt-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Learner</th>
                  <th>Exercise</th>
                  <th>Mode</th>
                  <th>Status</th>
                  <th>Checks</th>
                  <th>Signals</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((attempt) => {
                  const progress = attemptProgress(attempt);
                  const tone = attemptTone(attempt.status);

                  return (
                    <tr className={`is-${tone}`} key={attempt.id}>
                      <td data-label="Time">
                        <span className="sm-time" title={formatAttemptTime(attempt.created_at)}>
                          {formatRelativeTime(attempt.created_at)}
                          <small>{formatAttemptTime(attempt.created_at)}</small>
                        </span>
                      </td>
                      <td data-label="Learner">
                        <span className="sm-learner">
                          <strong>@{attempt.username || "learner"}</strong>
                          <small>Attempt #{attempt.id}</small>
                        </span>
                      </td>
                      <td data-label="Exercise">
                        <span className="sm-exercise">
                          <strong>{attempt.exercise_title || "Untitled exercise"}</strong>
                          <small>{attemptLocation(attempt)}</small>
                        </span>
                      </td>
                      <td data-label="Mode">
                        <span className="sm-mode"><Code2 size={14} /> {prettyStatus(attempt.mode || "code")}</span>
                      </td>
                      <td data-label="Status">
                        <span className={`sm-status is-${tone}`}>{prettyStatus(attempt.status)}</span>
                      </td>
                      <td data-label="Checks">
                        <span className="sm-check-inline">
                          <span>
                            <strong>{progress.total > 0 ? `${progress.passed} / ${progress.total}` : "No tests"}</strong>
                            <small>{progress.total > 0 ? `${progress.percent}% passed` : "No judge checks"}</small>
                          </span>
                          <i aria-hidden="true"><b style={{ width: `${progress.total > 0 ? progress.percent : 100}%` }} /></i>
                        </span>
                      </td>
                      <td data-label="Signals">
                        <span className="sm-signals">
                          {toNumber(attempt.used_hint_count) > 0 && <em>{attempt.used_hint_count} hints</em>}
                          {attempt.viewed_solution && <em>solution viewed</em>}
                          {toNumber(attempt.xp_awarded) > 0 && <em>{attempt.xp_awarded} XP</em>}
                          {toNumber(attempt.used_hint_count) <= 0 && !attempt.viewed_solution && toNumber(attempt.xp_awarded) <= 0 && <small>-</small>}
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {!attemptsLoading && attempts.length === 0 && (
                  <tr>
                    <td className="sm-table-empty" colSpan="7">
                      <ClipboardCheck size={20} />
                      <strong>No attempts match this view</strong>
                      <span>Try another status, mode, or search term.</span>
                    </td>
                  </tr>
                )}

                {attemptsLoading && attempts.length === 0 && (
                  <tr>
                    <td className="sm-table-empty" colSpan="7">
                      <RefreshCw size={20} className="sm-spin" />
                      <strong>Loading attempts</strong>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <footer className="sm-console__footer">
            <span>
              {attemptData.has_more
                ? `Loaded ${attempts.length} rows. More are available by cursor.`
                : `Loaded ${attempts.length} rows for the current query.`}
            </span>
            <button
              type="button"
              className="sm-load-more"
              disabled={!attemptData.has_more || attemptsLoadingMore || attemptsLoading}
              onClick={() => loadAttempts({ append: true, cursor: attemptData.next_cursor })}
            >
              <RefreshCw size={15} className={attemptsLoadingMore ? "sm-spin" : ""} />
              {attemptsLoadingMore ? "Loading..." : "Load more"}
            </button>
          </footer>
        </section>
      </div>
    );
  }

  return (
    <div className="ap-page ap-ops-page">
      <section className="ap-ops-hero">
        <IconBubble icon={variant === "leaderboards" ? Trophy : variant === "submissions" ? ClipboardCheck : Activity} tone="blue" />
        <div>
          <p>Learning engine</p>
          <h2>{title}</h2>
          <span>Production signals for judge availability, content readiness, learner submissions, and leaderboard integrity.</span>
        </div>
      </section>

      {error && <div className="ap-inline-error">{error}</div>}

      <section className="ap-metric-grid ap-metric-grid--compact">
        <article className="ap-metric-card">
          <IconBubble icon={FolderTree} tone={statusTone(health?.content_health)} />
          <div><span>Content health</span><strong>{prettyStatus(health?.content_health || "loading")}</strong><p>Drafts and publish checks</p></div>
        </article>
        <article className="ap-metric-card">
          <IconBubble icon={Radio} tone={statusTone(health?.judge_health)} />
          <div><span>Judge health</span><strong>{prettyStatus(health?.judge_health || "loading")}</strong><p>Code execution service</p></div>
        </article>
        <article className="ap-metric-card">
          <IconBubble icon={Trophy} tone={statusTone(health?.leaderboard_health)} />
          <div><span>Leaderboard health</span><strong>{prettyStatus(health?.leaderboard_health || "loading")}</strong><p>XP ranking pipeline</p></div>
        </article>
      </section>

      <section className="ap-ops-table">
        <header>
          <div>
            <h3>Recent attempts</h3>
            <p>Latest learner runs stored by the backend. User code still executes only inside Judge.</p>
          </div>
        </header>
        <div className="ap-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Learner</th>
                <th>Exercise</th>
                <th>Mode</th>
                <th>Status</th>
                <th>Checks</th>
              </tr>
            </thead>
            <tbody>
              {(health?.recent_attempts || []).map((attempt) => (
                <tr key={attempt.id}>
                  <td>{attempt.username}</td>
                  <td>{attempt.exercise_title}</td>
                  <td>{prettyStatus(attempt.mode || "code")}</td>
                  <td><span className={`ap-status-pill is-${statusTone(attempt.status)} ap-status-pill--${attempt.status}`}>{prettyStatus(attempt.status)}</span></td>
                  <td>{attempt.tests_passed} / {attempt.tests_total}</td>
                </tr>
              ))}
              {(!health?.recent_attempts || health.recent_attempts.length === 0) && (
                <tr>
                  <td colSpan="5">No submissions yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
