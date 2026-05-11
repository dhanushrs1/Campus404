import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Layers,
  Loader2,
  Search,
  Zap,
} from "lucide-react";
import { APP_ROUTES } from "../../../routes/paths.js";
import { getTrackTree } from "../../../shared/learningApi.js";
import { getCompletedExerciseIds } from "../../../shared/learningProgress.js";
import { readAuthSession } from "../../../shared/authSession.js";
import { ASSETS } from "../../../shared/assets.js";
import "./TracksPage.css";

const HERO_BACKGROUND_IMAGE = ASSETS.tracks.pythonCampusHero;
const TRACK_IMAGE_FALLBACK = ASSETS.tracks.pythonCampusHero;

const LANGUAGE_LABELS = Object.freeze({
  71: "Python",
  93: "JavaScript",
  62: "Java",
  54: "C++",
  50: "C",
  73: "Rust",
  60: "Go",
});

const TRACK_VISUALS = Object.freeze({
  python: {
    label: "Python",
    image: ASSETS.tracks.pythonCampusHero,
  },
  javascript: {
    label: "JavaScript",
    image: ASSETS.tracks.workspaceMonitor,
  },
  java: {
    label: "Java",
    image: ASSETS.tracks.studentCodingDesk,
  },
  cpp: {
    label: "C++",
    image: ASSETS.tracks.projectLaptop,
  },
  c: {
    label: "C",
    image: ASSETS.tracks.projectLaptop,
  },
  react: {
    label: "React",
    image: ASSETS.tracks.workspaceMonitor,
  },
  web: {
    label: "Web",
    image: ASSETS.tracks.workspaceMonitor,
  },
  git: {
    label: "Git",
    image: ASSETS.tracks.lessonChecklist,
  },
  dsa: {
    label: "DSA",
    image: ASSETS.tracks.lessonChecklist,
  },
  projects: {
    label: "Projects",
    image: ASSETS.tracks.projectLaptop,
  },
  tools: {
    label: "Tools",
    image: ASSETS.tracks.lessonChecklist,
  },
  general: {
    label: "Track",
    image: TRACK_IMAGE_FALLBACK,
  },
});

function getLanguageName(languageId) {
  return LANGUAGE_LABELS[Number(languageId)] || "General";
}

function slugify(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^\w ]+/g, "")
    .replace(/ +/g, "-");
}

function getSearchText(track) {
  return [
    track.title,
    track.description,
    track.languageName,
    ...(track.sections ?? []).map((section) => section.title),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function inferTrackIconType(track) {
  const title = String(track.title || "").toLowerCase();
  const description = String(track.description || "").toLowerCase();
  const language = getLanguageName(track.language_id).toLowerCase();
  const haystack = `${title} ${description} ${language}`;

  if (haystack.includes("python")) return "python";
  if (haystack.includes("javascript") || haystack.includes("js ")) return "javascript";
  if (haystack.includes("react")) return "react";
  if (haystack.includes("java")) return "java";
  if (haystack.includes("c++") || haystack.includes("cpp")) return "cpp";
  if (language === "c" || haystack.includes(" c programming")) return "c";
  if (haystack.includes("git") || haystack.includes("github")) return "git";
  if (haystack.includes("algorithm") || haystack.includes("data structure") || haystack.includes("dsa")) return "dsa";
  if (haystack.includes("web") || haystack.includes("html") || haystack.includes("css")) return "web";
  if (haystack.includes("project")) return "projects";
  if (haystack.includes("tool")) return "tools";

  return "general";
}

function normalizeTracks(rawTracks) {
  return (rawTracks ?? [])
    .slice()
    .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0))
    .map((track) => {
      let firstExerciseMeta = null;

      const sections = (track.sections ?? [])
        .slice()
        .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0))
        .map((section) => ({
          ...section,
          exercises: (section.exercises ?? [])
            .slice()
            .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0)),
        }));

      for (const section of sections) {
        if ((section.exercises ?? []).length > 0) {
          firstExerciseMeta = {
            sectionTitle: section.title,
            exerciseId: section.exercises[0].id,
            exerciseTitle: section.exercises[0].title,
          };
          break;
        }
      }

      return {
        ...track,
        sections,
        firstExerciseMeta,
      };
    });
}

function TechIcon({ type = "general", size = "md" }) {
  const normalizedType = TRACK_VISUALS[type] ? type : "general";

  return (
    <span className={`tracksPage__techIcon tracksPage__techIcon--${normalizedType} tracksPage__techIcon--${size}`} aria-hidden="true">
      {normalizedType === "python" && (
        <svg viewBox="0 0 48 48" role="presentation">
          <path fill="#3776ab" d="M23.8 6c-8.2 0-7.7 3.5-7.7 3.5v3.7h8v1.1H13c-4.1 0-7.6 2.5-8.7 7.3-1.3 5.5-1.4 8.9 0 14.6 1 4.3 3.3 7.3 7.4 7.3h4.8v-6.7c0-4.6 4-8.7 8.7-8.7h7.9c3.7 0 6.7-3 6.7-6.7V9.5S40.8 6 23.8 6Z" />
          <path fill="#ffd43b" d="M24.2 42c8.2 0 7.7-3.5 7.7-3.5v-3.7h-8v-1.1H35c4.1 0 7.6-2.5 8.7-7.3 1.3-5.5 1.4-8.9 0-14.6-1-4.3-3.3-7.3-7.4-7.3h-4.8v6.7c0 4.6-4 8.7-8.7 8.7h-7.9c-3.7 0-6.7 3-6.7 6.7v11.9S7.2 42 24.2 42Z" transform="rotate(180 24 24)" />
          <circle cx="19" cy="11" r="2" fill="#fff" />
          <circle cx="29" cy="37" r="2" fill="#1f2937" opacity="0.65" />
        </svg>
      )}

      {normalizedType === "javascript" && (
        <svg viewBox="0 0 48 48" role="presentation">
          <rect width="36" height="36" x="6" y="6" rx="7" fill="#f7df1e" />
          <path fill="#18181b" d="M17.2 31.5c.8 1.3 1.5 2.3 3.3 2.3 1.7 0 2.8-.8 2.8-4V17.9h4.3v12c0 4.5-2.6 6.5-6.5 6.5-3.5 0-5.5-1.8-6.5-4l2.6-.9Zm12.8-.5c1.1 1.8 2.5 3.1 5 3.1 2.1 0 3.4-1 3.4-2.5 0-1.8-1.4-2.4-3.7-3.4l-1.3-.6c-3.7-1.6-6.1-3.5-6.1-7.6 0-3.8 2.9-6.7 7.4-6.7 3.2 0 5.5 1.1 7.2 4l-2.5 1.6c-.9-1.6-1.9-2.2-3.4-2.2-1.5 0-2.5 1-2.5 2.2 0 1.5 1 2.2 3.2 3.2l1.3.6c4.3 1.9 6.8 3.7 6.8 8 0 4.6-3.6 7-8.4 7-4.7 0-7.8-2.3-9.3-5.2L30 31Z" transform="scale(.72) translate(10 8)" />
        </svg>
      )}

      {normalizedType === "java" && (
        <svg viewBox="0 0 48 48" role="presentation">
          <path fill="#f97316" d="M25.6 5.6c3.6 3-4.8 6.8-2.4 10.6 1 1.5 2.5 2.5 2.5 2.5s-5.2-1-6.3-4.3c-1.3-4 7.7-5.9 6.2-8.8Z" />
          <path fill="#ef4444" d="M30.7 9.8c2.6 4.3-5.2 5.2-4.9 9.1.1 1.5 1.5 2.7 1.5 2.7s-4.2-1-4.5-4c-.5-4.4 7.7-4.2 7.9-7.8Z" />
          <path fill="#2563eb" d="M15.2 25.6h18.1c0 7.3-3.9 12.1-9.1 12.1s-9-4.8-9-12.1Z" />
          <path fill="#1d4ed8" d="M33.1 27.3h3c2 0 3.5 1.4 3.5 3.2 0 2.9-2.8 4.8-6.5 4.8v-2.5c2.5 0 3.9-.9 3.9-2.1 0-.6-.5-1-1.2-1h-2.7v-2.4Z" />
          <path fill="#111827" d="M12 39.2c3 1.4 20.7 1.4 24 0-2.4 3.1-21.5 3.1-24 0Z" opacity=".75" />
        </svg>
      )}

      {normalizedType === "cpp" && (
        <svg viewBox="0 0 48 48" role="presentation">
          <path fill="#00599c" d="m24 5 16.5 9.5v19L24 43 7.5 33.5v-19L24 5Z" />
          <path fill="#fff" d="M24.4 32.5c-5.3 0-9-3.7-9-8.5s3.7-8.5 9-8.5c3.1 0 5.4 1.1 7.1 3.2l-3 2.7c-.9-1.1-2.2-1.8-3.8-1.8-2.6 0-4.5 1.9-4.5 4.4s1.9 4.4 4.5 4.4c1.6 0 2.9-.7 3.8-1.9l3 2.8c-1.7 2.1-4 3.2-7.1 3.2Z" />
          <path stroke="#fff" strokeLinecap="round" strokeWidth="2.4" d="M33.2 20.5v7M29.7 24h7M41 20.5v7M37.5 24h7" />
        </svg>
      )}

      {normalizedType === "react" && (
        <svg viewBox="0 0 48 48" role="presentation">
          <circle cx="24" cy="24" r="4" fill="#61dafb" />
          <g fill="none" stroke="#0ea5e9" strokeWidth="2.4">
            <ellipse cx="24" cy="24" rx="18" ry="7" />
            <ellipse cx="24" cy="24" rx="18" ry="7" transform="rotate(60 24 24)" />
            <ellipse cx="24" cy="24" rx="18" ry="7" transform="rotate(120 24 24)" />
          </g>
        </svg>
      )}

      {normalizedType === "git" && (
        <svg viewBox="0 0 48 48" role="presentation">
          <rect width="30" height="30" x="9" y="9" rx="5" fill="#f05032" transform="rotate(45 24 24)" />
          <path fill="#fff" d="M20 15.8a2.7 2.7 0 1 1 3.8 2.5l3.9 3.9a2.8 2.8 0 1 1-1.8 1.9L22 20.2v7.7a2.7 2.7 0 1 1-2.5 0v-9.6a2.7 2.7 0 0 1 .5-2.5Z" />
        </svg>
      )}

      {["web", "dsa", "projects", "tools", "general", "c"].includes(normalizedType) && (
        <svg viewBox="0 0 48 48" role="presentation">
          {normalizedType === "web" && (
            <>
              <circle cx="24" cy="24" r="17" fill="#2563eb" />
              <path fill="none" stroke="#fff" strokeLinecap="round" strokeWidth="2.3" d="M9 24h30M24 7c5 4.9 7.5 10.6 7.5 17S29 36.1 24 41M24 7c-5 4.9-7.5 10.6-7.5 17S19 36.1 24 41M13.2 14.6h21.6M13.2 33.4h21.6" />
            </>
          )}
          {normalizedType === "dsa" && (
            <>
              <rect width="36" height="36" x="6" y="6" rx="10" fill="#4f46e5" />
              <path
                fill="none"
                stroke="#ffffff"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3"
                d="M20 14c-3 0-4.5 1.6-4.5 4.7v2.6c0 1.7-.9 2.7-2.5 2.7 1.6 0 2.5 1 2.5 2.7v2.6c0 3.1 1.5 4.7 4.5 4.7M28 14c3 0 4.5 1.6 4.5 4.7v2.6c0 1.7.9 2.7 2.5 2.7-1.6 0-2.5 1-2.5 2.7v2.6c0 3.1-1.5 4.7-4.5 4.7"
              />
            </>
          )}
          {normalizedType === "projects" && (
            <>
              <rect width="36" height="28" x="6" y="12" rx="6" fill="#14b8a6" />
              <path fill="#99f6e4" d="M8 16.5C8 14 10 12 12.5 12H21l3 4.5h16V20H8v-3.5Z" />
              <path stroke="#fff" strokeLinecap="round" strokeWidth="2.3" d="M17 29h14M21 24h6" />
            </>
          )}
          {normalizedType === "tools" && (
            <>
              <rect width="36" height="36" x="6" y="6" rx="10" fill="#64748b" />
              <path fill="#fff" d="M30.4 13.5a7 7 0 0 0-8.8 8.8l-8 8a3 3 0 0 0 4.2 4.2l8-8a7 7 0 0 0 8.8-8.8l-4.7 4.7-3.9-3.9 4.4-5Z" />
            </>
          )}
          {normalizedType === "general" && (
            <>
              <rect width="36" height="36" x="6" y="6" rx="10" fill="#2563eb" />
              <path fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.6" d="m19 17-7 7 7 7M29 17l7 7-7 7M26 14l-4 20" />
            </>
          )}
          {normalizedType === "c" && (
            <>
              <path fill="#2563eb" d="m24 5 16.5 9.5v19L24 43 7.5 33.5v-19L24 5Z" />
              <path fill="#fff" d="M25.1 32.5c-5.6 0-9.5-3.8-9.5-8.5s3.9-8.5 9.5-8.5c3.1 0 5.7 1.1 7.3 3.2l-3 2.7c-1-1.2-2.3-1.8-4-1.8-2.8 0-4.8 1.9-4.8 4.4s2 4.4 4.8 4.4c1.7 0 3-.6 4-1.9l3 2.8c-1.6 2.1-4.2 3.2-7.3 3.2Z" />
            </>
          )}
        </svg>
      )}
    </span>
  );
}

export default function TracksPage() {
  const navigate = useNavigate();
  const searchInputRef = useRef(null);
  const [isAuthenticated] = useState(() => readAuthSession().isAuthenticated);

  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [completedExerciseIds, setCompletedExerciseIds] = useState(() => (
    isAuthenticated ? getCompletedExerciseIds() : []
  ));
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let disposed = false;

    async function loadTracks() {
      setLoading(true);
      setError("");

      try {
        const payload = await getTrackTree();
        if (disposed) {
          return;
        }

        const normalized = normalizeTracks(payload);
        setTracks(normalized);
      } catch (err) {
        if (!disposed) {
          setError(err.message || "Unable to load tracks right now.");
        }
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    }

    loadTracks();

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    function refreshProgress() {
      setCompletedExerciseIds(isAuthenticated ? getCompletedExerciseIds() : []);
    }

    window.addEventListener("focus", refreshProgress);
    return () => {
      window.removeEventListener("focus", refreshProgress);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    function isEditingText(target) {
      return target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target instanceof HTMLSelectElement
        || target?.isContentEditable;
    }

    function handleSearchShortcut(event) {
      if (event.defaultPrevented) return;

      const isSlashShortcut = event.key === "/"
        && !event.altKey
        && !event.ctrlKey
        && !event.metaKey;
      const isCommandShortcut = event.key.toLowerCase() === "k"
        && (event.ctrlKey || event.metaKey)
        && !event.altKey;

      if (!isSlashShortcut && !isCommandShortcut) return;
      if (isEditingText(event.target)) return;

      event.preventDefault();
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }

    window.addEventListener("keydown", handleSearchShortcut);
    return () => {
      window.removeEventListener("keydown", handleSearchShortcut);
    };
  }, []);

  const cards = useMemo(() => {
    return tracks.map((track, index) => {
      const sections = track.sections ?? [];
      const sectionCount = sections.length;
      const languageName = getLanguageName(track.language_id);
      const iconType = inferTrackIconType(track);
      const visual = TRACK_VISUALS[iconType] || TRACK_VISUALS.general;

      let totalExercises = 0;
      let completedExercises = 0;

      for (const section of sections) {
        for (const exercise of section.exercises ?? []) {
          totalExercises += 1;
          if (completedExerciseIds.includes(Number(exercise.id))) {
            completedExercises += 1;
          }
        }
      }

      const progressPercent = totalExercises > 0
        ? Math.round((completedExercises * 100) / totalExercises)
        : 0;

      const enrichedTrack = {
        ...track,
        index,
        sectionCount,
        totalExercises,
        completedExercises,
        progressPercent,
        languageName,
        iconType,
        visualLabel: visual.label || languageName,
        imageUrl: track.featured_image_url || visual.image || TRACK_IMAGE_FALLBACK,
      };

      return {
        ...enrichedTrack,
        searchText: getSearchText(enrichedTrack),
      };
    });
  }, [completedExerciseIds, tracks]);

  const stats = useMemo(() => {
    return cards.reduce(
      (acc, track) => ({
        trackCount: acc.trackCount + 1,
        sectionCount: acc.sectionCount + track.sectionCount,
        lessonCount: acc.lessonCount + track.totalExercises,
      }),
      { trackCount: 0, sectionCount: 0, lessonCount: 0 },
    );
  }, [cards]);

  const filteredCards = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const nextCards = cards.filter((track) => {
      return !query || track.searchText.includes(query);
    });

    return nextCards;
  }, [cards, searchQuery]);

  const continueCards = useMemo(() => {
    return cards.filter((track) => (
      track.completedExercises > 0
      && track.totalExercises > 0
      && track.progressPercent < 100
    ));
  }, [cards]);

  function openTrackWorkspace(track) {
    if (!track.title) return;
    navigate(APP_ROUTES.frontendTrackOverview(slugify(track.title)));
  }

  function handleTrackCardKeyDown(event, track) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    openTrackWorkspace(track);
  }

  return (
    <div className="tracksPage">
      <section className="tracksPage__hero">
        <div
          className="tracksPage__heroStage"
          style={{
            backgroundImage: `linear-gradient(90deg, rgba(3, 13, 35, 0.88), rgba(3, 13, 35, 0.58) 48%, rgba(3, 13, 35, 0.22)), url(${HERO_BACKGROUND_IMAGE})`,
          }}
        >
          <div className="container">
            <div className="tracksPage__heroInner">
              <h1>Explore Learning Tracks</h1>
              <p>
                Choose a track, continue your progress, and jump back into the latest coding workspace instantly.
              </p>

              <label className="tracksPage__search" htmlFor="tracks-search">
                <Search size={20} aria-hidden="true" />
                <input
                  ref={searchInputRef}
                  id="tracks-search"
                  type="search"
                  aria-label="Search tracks. Press slash or Control K to focus."
                  aria-keyshortcuts="/ Control+K Meta+K"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search tracks, topics, or technologies..."
                />
                <span className="tracksPage__searchShortcut" aria-hidden="true">/ or Ctrl K</span>
              </label>

              <div className="tracksPage__heroStats" aria-label="Track library summary">
                <span>{stats.trackCount} tracks</span>
                <span>{stats.sectionCount} sections</span>
                <span>{stats.lessonCount} lessons</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container tracksPage__content">
        {loading && (
          <div className="tracksPage__status tracksPage__status--loading" role="status">
            <Loader2 size={18} className="tracksPage__spin" />
            Loading tracks...
          </div>
        )}

        {!loading && error && (
          <div className="tracksPage__status tracksPage__status--error" role="alert">
            {error}
          </div>
        )}

        {!loading && !error && tracks.length === 0 && (
          <div className="tracksPage__status">
            No tracks are published yet. Please check again shortly.
          </div>
        )}

        {!loading && !error && tracks.length > 0 && (
          <>
            {continueCards.length > 0 && (
              <section className="tracksPage__continue" aria-labelledby="continue-learning-heading">
                <div className="tracksPage__sectionHeader">
                  <div>
                    <h2 id="continue-learning-heading">
                      <Zap size={21} aria-hidden="true" />
                      Continue Learning
                    </h2>
                    <p>Pick up where you left off and keep building.</p>
                  </div>
                </div>

                <div className="tracksPage__continueRail" tabIndex={0} aria-label="Continue learning tracks">
                  {continueCards.map((track) => (
                    <article
                      className="tracksPage__continueCard"
                      key={`continue-${track.id}`}
                      style={{ backgroundImage: `linear-gradient(90deg, rgba(2, 6, 23, 0.9), rgba(2, 6, 23, 0.58)), url(${track.imageUrl})` }}
                    >
                      <div className="tracksPage__continueTop">
                        <TechIcon type={track.iconType} size="sm" />
                        <span>{track.visualLabel}</span>
                      </div>
                      <h3>{track.title}</h3>
                      <p>{track.description || "Structured lessons designed for practical coding mastery."}</p>
                      <div className="tracksPage__continueBottom">
                        <div className="tracksPage__linearProgress" aria-hidden="true">
                          <span style={{ width: `${track.progressPercent}%` }} />
                        </div>
                        <div className="tracksPage__continueMeta">
                          <span>{track.completedExercises} of {track.totalExercises || 1} lessons completed</span>
                          <strong>{track.progressPercent}%</strong>
                        </div>
                      </div>
                      <button type="button" onClick={() => openTrackWorkspace(track)}>
                        {track.progressPercent > 0 ? "Continue" : "Start"}
                        <ArrowRight size={14} />
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            )}

            <section className="tracksPage__allTracks" aria-labelledby="all-tracks-heading">
              <div className="tracksPage__sectionHeader tracksPage__sectionHeader--compact">
                <div>
                  <h2 id="all-tracks-heading">All Tracks</h2>
                  <p>{filteredCards.length} track{filteredCards.length === 1 ? "" : "s"} available</p>
                </div>
              </div>

              {filteredCards.length === 0 ? (
                <div className="tracksPage__status">
                  No tracks matched your search. Try another keyword.
                </div>
              ) : (
                <div className="tracksPage__grid" aria-label="Track archive cards">
                  {filteredCards.map((track) => {
                    const hasStarted = track.completedExercises > 0;
                    const isComplete = track.progressPercent >= 100;
                    const actionLabel = hasStarted ? "Resume" : "View Track";

                    return (
                      <article
                        className="tracksPage__card"
                        key={track.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`${actionLabel} ${track.title}`}
                        onClick={() => openTrackWorkspace(track)}
                        onKeyDown={(event) => handleTrackCardKeyDown(event, track)}
                      >
                        <div className="tracksPage__cardMedia">
                          <span className="tracksPage__cardSymbol" aria-hidden="true">
                            <TechIcon type={track.iconType} size="md" />
                          </span>
                          <img
                            src={track.imageUrl}
                            alt={`${track.title} featured`}
                            loading="lazy"
                          />
                        </div>

                        <div className="tracksPage__cardBody">
                          <div className="tracksPage__cardHeader">
                            <h3>{track.title}</h3>
                            <span className="tracksPage__cardActionIcon" aria-hidden="true">
                              <ArrowRight size={15} />
                            </span>
                          </div>

                          <p>{track.description || "Structured lessons designed for practical coding mastery."}</p>

                          <div className="tracksPage__cardFooter">
                            <div className="tracksPage__metaRow">
                              <span>
                                <Layers size={14} aria-hidden="true" />
                                {track.sectionCount} sections
                              </span>
                              <span>
                                <BookOpen size={14} aria-hidden="true" />
                                {track.totalExercises} lessons
                              </span>
                            </div>

                            {hasStarted && (
                              <div
                                className="tracksPage__progressRing"
                                style={{ "--progress-value": `${track.progressPercent}%` }}
                                aria-label={`${track.progressPercent}% complete`}
                              >
                                <div className="tracksPage__progressInner">
                                  {isComplete ? (
                                    <CheckCircle2 size={16} className="tracksPage__progressDone" />
                                  ) : (
                                    <strong>{track.progressPercent}%</strong>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
