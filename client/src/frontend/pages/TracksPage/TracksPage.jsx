import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, Layers, Loader2 } from "lucide-react";
import { APP_ROUTES } from "../../../routes/paths.js";
import { getTrackTree } from "../../../shared/learningApi.js";
import { getCompletedExerciseIds } from "../../../shared/learningProgress.js";
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

function getLanguageName(languageId) {
  return LANGUAGE_LABELS[Number(languageId)] || "General";
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

export default function TracksPage() {
  const navigate = useNavigate();

  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [completedExerciseIds, setCompletedExerciseIds] = useState(() => getCompletedExerciseIds());

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
      setCompletedExerciseIds(getCompletedExerciseIds());
    }

    window.addEventListener("focus", refreshProgress);
    return () => {
      window.removeEventListener("focus", refreshProgress);
    };
  }, []);

  const stats = useMemo(() => {
    let sectionCount = 0;

    for (const track of tracks) {
      sectionCount += track.sections?.length ?? 0;
    }

    return {
      trackCount: tracks.length,
      sectionCount,
    };
  }, [tracks]);

  const cards = useMemo(() => {
    return tracks.map((track) => {
      const sections = track.sections ?? [];
      const sectionCount = sections.length;

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

      return {
        ...track,
        sectionCount,
        progressPercent,
      };
    });
  }, [completedExerciseIds, tracks]);

  function slugify(text) {
    return (text || "")
      .toLowerCase()
      .replace(/[^\w ]+/g, "")
      .replace(/ +/g, "-");
  }

  function openTrackWorkspace(track) {
    if (!track.title) return;
    navigate(APP_ROUTES.frontendTrackOverview(slugify(track.title)));
  }

  return (
    <div className="tracksPage">
      <section className="tracksPage__hero">
        <div
          className="tracksPage__heroStage"
          style={{
            backgroundImage: `linear-gradient(120deg, rgba(2, 6, 23, 0.68), rgba(2, 6, 23, 0.3)), url(${HERO_BACKGROUND_IMAGE})`,
          }}
        >
          <div className="container">
            <div className="tracksPage__heroInner">
              <h1>Explore Learning Tracks</h1>
              <p>
                Choose a track, continue your progress, and jump back into the latest coding workspace instantly.
              </p>
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
          <section className="tracksPage__grid" aria-label="Track archive cards">
            {cards.map((track) => {
              const isComplete = track.progressPercent >= 100;
              return (
                <article className="tracksPage__card" key={track.id}>
                  <div className="tracksPage__cardMedia">
                    <img
                      src={track.featured_image_url || TRACK_IMAGE_FALLBACK}
                      alt={`${track.title} featured`}
                      loading="lazy"
                    />
                    <span className="tracksPage__cardLanguage">{getLanguageName(track.language_id)}</span>
                  </div>

                  <div className="tracksPage__cardBody">
                    <div className="tracksPage__cardTop">
                      <div>
                        <h3>{track.title}</h3>
                        <p>{track.description || "Structured lessons designed for practical coding mastery."}</p>
                        <span className="tracksPage__sectionsCount">{track.sectionCount} sections</span>
                      </div>

                      <div className="tracksPage__progressWrap">
                        <div
                          className="tracksPage__progressRing"
                          style={{ "--progress-value": `${track.progressPercent}%` }}
                        >
                          <div className="tracksPage__progressInner">
                            {isComplete ? (
                              <CheckCircle2 size={22} className="tracksPage__progressDone" />
                            ) : (
                              <strong>{track.progressPercent}%</strong>
                            )}
                          </div>
                        </div>
                        {/* <span className={`tracksPage__progressLabel ${isComplete ? "is-complete" : ""}`}>
                          {isComplete ? "Completed" : "In Progress"}
                        </span> */}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-brand tracksPage__cta"
                      onClick={() => openTrackWorkspace(track)}
                    >
                      View Track
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}
