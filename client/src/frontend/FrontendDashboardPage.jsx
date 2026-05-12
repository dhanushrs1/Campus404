import { useEffect, useState } from "react";
import { Activity, Award, Loader2, Star, Trophy } from "lucide-react";
import { getGlobalLeaderboard, getMyProgress, getMyXpEvents } from "../shared/learningApi.js";
import "./FrontendDashboardPage.css";

export default function FrontendDashboardPage() {
  const [progress, setProgress] = useState(null);
  const [xpEvents, setXpEvents] = useState([]);
  const [rank, setRank] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let disposed = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [progressPayload, eventsPayload, leaderboardPayload] = await Promise.all([
          getMyProgress(),
          getMyXpEvents(8),
          getGlobalLeaderboard({ pageSize: 10 }).catch(() => null),
        ]);
        if (disposed) return;
        setProgress(progressPayload);
        setXpEvents(eventsPayload || []);
        setRank(leaderboardPayload?.current_user_rank || null);
      } catch (err) {
        if (!disposed) setError(err.message || "Unable to load dashboard.");
      } finally {
        if (!disposed) setLoading(false);
      }
    }
    load();
    return () => {
      disposed = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="frontendDashboardPage frontendDashboardPage--state">
        <Loader2 size={28} className="frontendDashboardPage__spin" />
        Loading your profile...
      </div>
    );
  }

  if (error) {
    return (
      <div className="frontendDashboardPage frontendDashboardPage--state">
        {error}
      </div>
    );
  }

  const tracks = progress?.tracks || [];
  const badges = progress?.badges || [];

  return (
    <div className="frontendDashboardPage">
      <header className="frontendDashboardPage__header">
        <p className="frontendDashboardPage__eyebrow">Learner Profile</p>
        <h1>Your Campus404 Progress</h1>
        <p>XP, badges, track progress, and recent learning events are synced from the backend reward engine.</p>
      </header>

      <section className="frontendDashboardPage__stats">
        <article>
          <Star size={22} />
          <span>Total XP</span>
          <strong>{progress?.total_xp || 0}</strong>
        </article>
        <article>
          <Activity size={22} />
          <span>Current Streak</span>
          <strong>{progress?.current_streak || 0}</strong>
        </article>
        <article>
          <Trophy size={22} />
          <span>Global Rank</span>
          <strong>{rank ? `#${rank.rank}` : "Unranked"}</strong>
        </article>
        <article>
          <Award size={22} />
          <span>Badges</span>
          <strong>{badges.length}</strong>
        </article>
      </section>

      <section className="frontendDashboardPage__grid">
        <article className="frontendDashboardPage__panel">
          <h2>Track XP Breakdown</h2>
          {tracks.length === 0 ? (
            <p>No track progress yet. Start a track to build your profile.</p>
          ) : (
            <div className="frontendDashboardPage__trackList">
              {tracks.map((track) => (
                <div key={track.track_id}>
                  <div>
                    <strong>{track.title}</strong>
                    <span>{track.completed_exercises} / {track.total_exercises} exercises</span>
                  </div>
                  <small>{track.total_xp} XP</small>
                  <div className="frontendDashboardPage__bar">
                    <span style={{ width: `${track.progress_percent || 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="frontendDashboardPage__panel">
          <h2>Badges</h2>
          {badges.length === 0 ? (
            <p>Badges you earn will appear here.</p>
          ) : (
            <div className="frontendDashboardPage__badgeGrid">
              {badges.map((item) => (
                <div key={item.id}>
                  {item.badge?.icon_url ? <img src={item.badge.icon_url} alt="" /> : <Award size={24} />}
                  <strong>{item.badge?.title || "Badge"}</strong>
                  <span>{item.badge?.description || "Awarded by Campus404"}</span>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="frontendDashboardPage__panel frontendDashboardPage__panel--wide">
          <h2>Recent XP Events</h2>
          {xpEvents.length === 0 ? (
            <p>No XP events yet.</p>
          ) : (
            <ol className="frontendDashboardPage__eventList">
              {xpEvents.map((event) => (
                <li key={event.id}>
                  <span>{event.reason}</span>
                  <strong>+{event.points} XP</strong>
                </li>
              ))}
            </ol>
          )}
        </article>
      </section>
    </div>
  );
}
