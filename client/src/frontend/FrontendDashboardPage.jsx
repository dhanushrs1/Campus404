import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  Award,
  CalendarClock,
  ChevronRight,
  Flame,
  Loader2,
  Medal,
  Star,
  Target,
} from "lucide-react";
import { APP_ROUTES } from "../routes/paths.js";
import { ASSETS } from "../shared/assets.js";
import { readAuthSession } from "../shared/authSession.js";
import { getGlobalLeaderboard, getMyProgress, getMyXpEvents } from "../shared/learningApi.js";
import AvatarImage from "./components/AvatarImage/AvatarImage.jsx";
import "./FrontendDashboardPage.css";

function formatNumber(value) {
  return new Intl.NumberFormat().format(Number(value) || 0);
}

function formatDate(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "Recently";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function trackPath(track) {
  const slug = track?.slug || track?.track_slug || track?.track_id;
  return slug ? APP_ROUTES.frontendTrackOverview(slug) : APP_ROUTES.frontendTracks;
}

export default function FrontendDashboardPage() {
  const [progress, setProgress] = useState(null);
  const [xpEvents, setXpEvents] = useState([]);
  const [rank, setRank] = useState(null);
  const [session, setSession] = useState(() => readAuthSession());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setSession(readAuthSession());
  }, []);

  useEffect(() => {
    let disposed = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [progressPayload, eventsPayload, leaderboardPayload] = await Promise.all([
          getMyProgress(),
          getMyXpEvents(12),
          getGlobalLeaderboard({ pageSize: 25 }).catch(() => null),
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

  const dashboard = useMemo(() => {
    const tracks = Array.isArray(progress?.tracks) ? progress.tracks : [];
    const badges = Array.isArray(progress?.badges) ? progress.badges : [];
    const totalExercises = tracks.reduce((total, track) => total + (Number(track.total_exercises) || 0), 0);
    const completedExercises = tracks.reduce((total, track) => total + (Number(track.completed_exercises) || 0), 0);
    const activeTrack = tracks
      .slice()
      .sort((a, b) => Number(b.progress_percent || 0) - Number(a.progress_percent || 0))[0] || null;
    const weeklyXp = xpEvents.reduce((total, event) => {
      const date = new Date(event.created_at || event.awarded_at || event.timestamp || "");
      if (Number.isNaN(date.getTime())) return total;
      const isRecent = Date.now() - date.getTime() <= 7 * 24 * 60 * 60 * 1000;
      return isRecent ? total + (Number(event.points) || 0) : total;
    }, 0);

    return {
      tracks,
      badges,
      totalExercises,
      completedExercises,
      activeTrack,
      weeklyXp,
    };
  }, [progress, xpEvents]);

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

  const displayName = session.username ? `@${session.username}` : "Learner";
  const activeTrack = dashboard.activeTrack;
  const rankLabel = rank?.rank ? `#${rank.rank}` : "Unranked";

  return (
    <div className="frontendDashboardPage">
      <section className="frontendDashboardPage__hero" aria-label="Learner profile summary">
        <div className="frontendDashboardPage__identity">
          <AvatarImage
            src={session.avatarUrl || ASSETS.avatars.brownPonytailBlueHoodie}
            fallbackKey={session.username || "learner"}
            alt=""
          />
          <div>
            <p className="frontendDashboardPage__eyebrow">Learner Profile</p>
            <h1>Your Campus404 progress</h1>
            <span>{displayName}</span>
          </div>
        </div>

        <div className="frontendDashboardPage__heroCopy">
          <p>XP, badges, rank, streak, and track growth are synced from the backend reward engine.</p>
          <div className="frontendDashboardPage__heroActions">
            <Link className="btn btn-brand" to={APP_ROUTES.frontendTracks}>Continue Learning</Link>
            <Link className="btn btn-ghost" to={APP_ROUTES.frontendRankingRewards}>Rewards</Link>
          </div>
        </div>

        <div className="frontendDashboardPage__rankPlate">
          <img src={ASSETS.icons.rankMedalGold} alt="" draggable="false" />
          <span>Global Rank</span>
          <strong>{rankLabel}</strong>
        </div>
      </section>

      <section className="frontendDashboardPage__stats" aria-label="Learning stats">
        <article>
          <Star size={22} />
          <span>Total XP</span>
          <strong>{formatNumber(progress?.total_xp)}</strong>
        </article>
        <article>
          <Flame size={22} />
          <span>Current Streak</span>
          <strong>{formatNumber(progress?.current_streak)}</strong>
        </article>
        <article>
          <Target size={22} />
          <span>Exercises Done</span>
          <strong>{formatNumber(dashboard.completedExercises)} / {formatNumber(dashboard.totalExercises)}</strong>
        </article>
        <article>
          <Award size={22} />
          <span>Badges</span>
          <strong>{formatNumber(dashboard.badges.length)}</strong>
        </article>
      </section>

      <section className="frontendDashboardPage__focusGrid">
        <article className="frontendDashboardPage__focusCard">
          <div>
            <span><Activity size={17} /> Current Focus</span>
            <h2>{activeTrack?.title || "Start your first track"}</h2>
            <p>
              {activeTrack
                ? `${activeTrack.completed_exercises || 0} of ${activeTrack.total_exercises || 0} exercises completed.`
                : "Pick a track, complete lessons, and build your XP profile."}
            </p>
          </div>
          <div className="frontendDashboardPage__focusProgress">
            <strong>{activeTrack?.progress_percent || 0}%</strong>
            <div className="frontendDashboardPage__bar">
              <span style={{ width: `${activeTrack?.progress_percent || 0}%` }} />
            </div>
          </div>
          <Link className="btn btn-brand" to={trackPath(activeTrack)}>
            Open Track <ChevronRight size={16} />
          </Link>
        </article>

        <article className="frontendDashboardPage__rewardCard">
          <span><Medal size={17} /> Reward Readiness</span>
          <h2>{formatNumber(dashboard.weeklyXp)} XP this week</h2>
          <p>Your best reward path is more weekly XP plus badge milestones. The rewards page now shows eligibility live.</p>
          <Link className="frontendDashboardPage__textLink" to={APP_ROUTES.frontendRankingRewards}>
            Check reward tiers <ChevronRight size={15} />
          </Link>
        </article>
      </section>

      <section className="frontendDashboardPage__grid">
        <article className="frontendDashboardPage__panel">
          <h2>Track Progress</h2>
          {dashboard.tracks.length === 0 ? (
            <p>No track progress yet. Start a track to build your profile.</p>
          ) : (
            <div className="frontendDashboardPage__trackList">
              {dashboard.tracks.map((track) => (
                <div key={track.track_id}>
                  <div>
                    <strong>{track.title}</strong>
                    <span>{track.completed_exercises} / {track.total_exercises} exercises</span>
                  </div>
                  <small>{formatNumber(track.total_xp)} XP</small>
                  <div className="frontendDashboardPage__bar">
                    <span style={{ width: `${track.progress_percent || 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="frontendDashboardPage__panel">
          <h2>Badge Showcase</h2>
          {dashboard.badges.length === 0 ? (
            <p>Badges you earn will appear here.</p>
          ) : (
            <div className="frontendDashboardPage__badgeGrid">
              {dashboard.badges.slice(0, 6).map((item) => (
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
          <h2>Recent XP History</h2>
          {xpEvents.length === 0 ? (
            <p>No XP events yet.</p>
          ) : (
            <ol className="frontendDashboardPage__eventList">
              {xpEvents.map((event) => (
                <li key={event.id}>
                  <CalendarClock size={17} />
                  <span>
                    <strong>{event.reason}</strong>
                    <small>{formatDate(event.created_at || event.awarded_at || event.timestamp)}</small>
                  </span>
                  <b>+{formatNumber(event.points)} XP</b>
                </li>
              ))}
            </ol>
          )}
        </article>
      </section>
    </div>
  );
}
