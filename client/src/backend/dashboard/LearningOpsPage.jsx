import { useEffect, useState } from "react";
import { Activity, ClipboardCheck, FolderTree, Radio, Trophy } from "lucide-react";
import { apiUrl } from "../../shared/api.js";
import { authenticatedFetch } from "../../shared/authSession.js";
import { IconBubble } from "../shared/AdminWidgets.jsx";
import { prettyStatus, statusTone } from "./adminUtils.js";

export default function LearningOpsPage({ variant = "health", onSessionExpired }) {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let disposed = false;

    async function loadHealth() {
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
      }
    }

    void loadHealth();
    return () => {
      disposed = true;
    };
  }, [onSessionExpired]);

  const title = variant === "leaderboards"
    ? "Leaderboard Operations"
    : variant === "submissions"
      ? "Submission Monitor"
      : "System Health";

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
