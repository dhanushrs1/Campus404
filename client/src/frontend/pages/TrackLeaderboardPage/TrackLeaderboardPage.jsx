import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ChevronRight, Trophy, Users } from "lucide-react";
import { getTrackLeaderboard, getTrackTree } from "../../../shared/learningApi.js";
import { APP_ROUTES } from "../../../routes/paths.js";
import { ASSETS } from "../../../shared/assets.js";
import "./TrackLeaderboardPage.css";

function slugify(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^\w ]+/g, "")
    .replace(/ +/g, "-");
}

function sortByOrder(items = []) {
  return [...items].sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));
}

function normalizeTrack(track) {
  return {
    ...track,
    sections: sortByOrder(track.sections || []),
  };
}

function getAvatarInitial(username) {
  return (username || "C").trim().charAt(0).toUpperCase() || "C";
}

export default function TrackLeaderboardPage() {
  const { trackSlug } = useParams();
  const [tracks, setTracks] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let disposed = false;

    getTrackTree()
      .then((payload) => {
        if (!disposed) {
          setTracks((payload || []).map(normalizeTrack));
        }
      })
      .catch((err) => {
        if (!disposed) {
          setError(err.message || "Unable to load track leaderboard.");
        }
      })
      .finally(() => {
        if (!disposed) {
          setLoading(false);
        }
      });

    return () => {
      disposed = true;
    };
  }, []);

  const track = useMemo(() => {
    if (!tracks.length) return null;
    return tracks.find((item) => slugify(item.title) === trackSlug);
  }, [tracks, trackSlug]);

  useEffect(() => {
    let disposed = false;

    if (!track?.id) {
      setLeaderboard([]);
      return () => {
        disposed = true;
      };
    }

    getTrackLeaderboard(track.id, 20)
      .then((payload) => {
        if (!disposed) {
          setLeaderboard(Array.isArray(payload) ? payload : []);
        }
      })
      .catch((err) => {
        if (!disposed) {
          setError(err.message || "Unable to load leaderboard.");
        }
      });

    return () => {
      disposed = true;
    };
  }, [track?.id]);

  if (loading) {
    return (
      <div className="trackLeaderboardPage trackLeaderboardPage--state">
        <div className="trackLeaderboardPage__stateCard">
          <img src={ASSETS.brand.favicon} alt="" />
          <p>Loading leaderboard...</p>
        </div>
      </div>
    );
  }

  if (error || !track) {
    return (
      <div className="trackLeaderboardPage trackLeaderboardPage--state">
        <div className="trackLeaderboardPage__stateCard">
          <img src={ASSETS.icons.trophyCup} alt="" />
          <p>{error || "Track leaderboard not found."}</p>
          <Link to={APP_ROUTES.frontendTracks}>Back to Tracks</Link>
        </div>
      </div>
    );
  }

  const learnerCount = Number(track.learner_count || leaderboard.length || 0);
  const totalExercises = (track.sections || []).reduce(
    (sum, section) => sum + Number(section.exercises?.length || 0),
    0,
  );

  return (
    <div className="trackLeaderboardPage">
      <div className="trackLeaderboardPage__shell">
        <nav className="trackLeaderboardPage__breadcrumb" aria-label="Breadcrumb">
          <Link to={APP_ROUTES.home}>Home</Link>
          <ChevronRight size={14} />
          <Link to={APP_ROUTES.frontendTracks}>Tracks</Link>
          <ChevronRight size={14} />
          <Link to={APP_ROUTES.frontendTrackOverview(trackSlug)}>{track.title}</Link>
          <ChevronRight size={14} />
          <span>Leaderboard</span>
        </nav>

        <section className="trackLeaderboardPage__hero">
          <Link className="trackLeaderboardPage__backLink" to={APP_ROUTES.frontendTrackOverview(trackSlug)}>
            <ArrowLeft size={16} />
            Back to Track
          </Link>
          <div>
            <p>Track Leaderboard</p>
            <h1>{track.title}</h1>
          </div>
          <div className="trackLeaderboardPage__heroStats">
            <span><Users size={16} /> {learnerCount} learners</span>
            <span><Trophy size={16} /> {totalExercises} exercises</span>
          </div>
        </section>

        <section className="trackLeaderboardPage__board" aria-label={`${track.title} leaderboard`}>
          {leaderboard.length > 0 ? (
            <ol>
              {leaderboard.map((learner) => (
                <li key={learner.user_id}>
                  <span className="trackLeaderboardPage__rank">#{learner.rank}</span>
                  <span className="trackLeaderboardPage__avatar">
                    {learner.avatar ? (
                      <img src={learner.avatar} alt="" draggable="false" />
                    ) : (
                      getAvatarInitial(learner.username)
                    )}
                  </span>
                  <span className="trackLeaderboardPage__name">{learner.username}</span>
                  <span>{learner.completed_tasks} tasks</span>
                  <span>{learner.completed_exercises} exercises</span>
                  <strong>
                    <img src={ASSETS.icons.xpStar} alt="" />
                    {learner.xp} XP
                  </strong>
                </li>
              ))}
            </ol>
          ) : (
            <div className="trackLeaderboardPage__empty">
              <img src={ASSETS.icons.trophyCup} alt="" />
              <h2>No rankings yet</h2>
              <p>Complete the first tasks in this track to create the leaderboard.</p>
              <Link to={APP_ROUTES.frontendTrackOverview(trackSlug)}>Start Learning</Link>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
