import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  BookOpenCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock3,
  FileBadge2,
  FileQuestion,
  Flame,
  Play,
  RotateCcw,
  ShieldCheck,
  Trophy,
  Users,
} from "lucide-react";
import { getAllTaskProgress, getTrackLeaderboard, getTrackTree } from "../../../shared/learningApi.js";
import { getCompletedExerciseIds } from "../../../shared/learningProgress.js";
import { APP_ROUTES } from "../../../routes/paths.js";
import { ASSETS } from "../../../shared/assets.js";
import "./TrackOverviewPage.css";

const DEFAULT_DIFFICULTY = "Beginner";
const EXERCISE_XP = 20;
const QUIZ_XP = 30;
const PROJECT_XP = 150;
const FINAL_XP = 200;

const FALLBACK_SKILLS = [
  "Python Basics & Syntax",
  "Conditions & Decision Making",
  "Loops & Iteration",
  "Functions & Reusability",
  "Data Structures",
  "Problem Solving",
];

const LANGUAGE_TIME_FACTOR = Object.freeze({
  50: 1.2,
  54: 1.2,
  60: 1.1,
  62: 1.18,
  63: 1.05,
  71: 1,
  73: 1.25,
  74: 1.08,
});

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
    sections: sortByOrder(track.sections || []).map((section) => ({
      ...section,
      exercises: sortByOrder(section.exercises || []),
    })),
  };
}

function formatPlural(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function getTaskIds(exercise) {
  return Array.isArray(exercise.task_ids) ? exercise.task_ids : [];
}

function buildSkills(sections) {
  const labels = sections
    .map((section) => section.title)
    .filter(Boolean)
    .slice(0, 6);

  for (const skill of FALLBACK_SKILLS) {
    if (labels.length >= 6) break;
    if (!labels.includes(skill)) labels.push(skill);
  }

  return labels;
}

function estimateTrackMinutes(track) {
  if (!track) return 0;

  const sections = track.sections || [];
  const exercises = sections.flatMap((section) => section.exercises || []);
  const taskCount = exercises.reduce((sum, exercise) => {
    const taskIds = getTaskIds(exercise);
    return sum + Number(exercise.total_tasks || taskIds.length || 1);
  }, 0);

  const languageFactor = LANGUAGE_TIME_FACTOR[Number(track.language_id)] || 1.08;
  const conceptReadingMinutes = exercises.length * 7;
  const codingMinutes = taskCount * 14 * languageFactor;
  const reviewMinutes = sections.length * 8;
  const quizMinutes = sections.length * 10;
  const projectMinutes = exercises.length > 0 ? 90 * languageFactor : 0;
  const finalExamMinutes = exercises.length > 0 ? 45 * languageFactor : 0;

  return Math.round(
    conceptReadingMinutes
    + codingMinutes
    + reviewMinutes
    + quizMinutes
    + projectMinutes
    + finalExamMinutes,
  );
}

function formatDuration(minutes) {
  if (!minutes) return "Coming soon";

  const rounded = Math.max(15, Math.round(minutes / 15) * 15);
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;

  if (hours <= 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function getAvatarInitial(username) {
  return (username || "C").trim().charAt(0).toUpperCase() || "C";
}

function LockAsset({ className = "" }) {
  return <img className={`trackOverviewPage__lockIcon ${className}`} src={ASSETS.icons.lockBlue} alt="" />;
}

function MilestoneCard({ imageSrc, imageAlt, title, description, xp, variant = "locked" }) {
  const label = variant === "final" ? "Final gate" : "Capstone gate";

  return (
    <article className={`trackOverviewPage__milestone trackOverviewPage__milestone--${variant}`}>
      <div className="trackOverviewPage__milestoneNode" aria-hidden="true" />

      <div className="trackOverviewPage__milestoneBody">
        <div className="trackOverviewPage__milestoneArtFrame">
          <img className="trackOverviewPage__milestoneArt" src={imageSrc} alt={imageAlt} />
        </div>
        <div className="trackOverviewPage__milestoneCopy">
          <span className="trackOverviewPage__milestoneEyebrow">{label}</span>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>

      <div className="trackOverviewPage__milestoneMeta">
        <span className="trackOverviewPage__xp">
          <img src={ASSETS.icons.xpStar} alt="" />
          +{xp} XP
        </span>
        <span className="trackOverviewPage__lockedPill trackOverviewPage__lockedPill--iconOnly" aria-label="Locked" title="Locked">
          <LockAsset />
        </span>
      </div>
    </article>
  );
}

export default function TrackOverviewPage() {
  const { trackSlug } = useParams();
  const navigate = useNavigate();

  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedSections, setExpandedSections] = useState({});
  const [completedExerciseIds, setCompletedExerciseIds] = useState(() => getCompletedExerciseIds());
  const [completedTaskIds, setCompletedTaskIds] = useState([]);
  const [trackLeaderboard, setTrackLeaderboard] = useState([]);

  useEffect(() => {
    let disposed = false;

    async function fetchData() {
      try {
        const [payload, taskProgressRes] = await Promise.all([
          getTrackTree(),
          getAllTaskProgress().catch(() => []),
        ]);

        if (disposed) return;

        setTracks((payload || []).map(normalizeTrack));
        setCompletedTaskIds(taskProgressRes.map((progress) => progress.task_id));
      } catch (err) {
        if (!disposed) {
          setError(err.message || "Failed to load curriculum data.");
        }
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    }

    fetchData();

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

  const track = useMemo(() => {
    if (!tracks.length) return null;
    return tracks.find((item) => slugify(item.title) === trackSlug);
  }, [tracks, trackSlug]);

  useEffect(() => {
    let disposed = false;

    if (!track?.id) {
      setTrackLeaderboard([]);
      return () => {
        disposed = true;
      };
    }

    getTrackLeaderboard(track.id, 5)
      .then((payload) => {
        if (!disposed) {
          setTrackLeaderboard(Array.isArray(payload) ? payload : []);
        }
      })
      .catch(() => {
        if (!disposed) {
          setTrackLeaderboard([]);
        }
      });

    return () => {
      disposed = true;
    };
  }, [track?.id]);

  const learningState = useMemo(() => {
    if (!track) {
      return {
        exerciseStatusMap: {},
        sectionProgressMap: {},
        activeExerciseMeta: null,
        activeSectionId: null,
        firstExerciseMeta: null,
        completedExercises: 0,
        completedSections: 0,
        totalExercises: 0,
        totalLessons: 0,
        earnedXp: 0,
        progressPercent: 0,
      };
    }

    const exerciseStatusMap = {};
    const sectionProgressMap = {};
    let firstExerciseMeta = null;
    let activeExerciseMeta = null;
    let lastExerciseMeta = null;
    let activeSectionId = null;
    let lockFollowingExercises = false;
    let totalExercises = 0;
    let completedExercises = 0;
    let completedSections = 0;
    let totalLessons = 0;

    for (const section of track.sections || []) {
      const exercises = section.exercises || [];
      let completedInSection = 0;

      exercises.forEach((exercise, exerciseIndex) => {
        totalExercises += 1;

        const taskIds = getTaskIds(exercise);
        const totalTasks = Number(exercise.total_tasks || taskIds.length || 1);
        const completedTasks = taskIds.filter((taskId) => completedTaskIds.includes(taskId)).length;
        const isCompleted = completedExerciseIds.includes(Number(exercise.id));
        const isLocked = lockFollowingExercises;
        const isInProgress = !isCompleted && !isLocked && completedTasks > 0;

        totalLessons += totalTasks;

        if (isCompleted) {
          completedExercises += 1;
          completedInSection += 1;
        }

        const meta = {
          sectionId: section.id,
          sectionTitle: section.title,
          exerciseId: exercise.id,
          exerciseTitle: exercise.title,
          exerciseIndex,
        };

        if (!firstExerciseMeta) firstExerciseMeta = meta;
        lastExerciseMeta = meta;

        if (!activeExerciseMeta && !isCompleted && !isLocked) {
          activeExerciseMeta = meta;
          activeSectionId = section.id;
        }

        exerciseStatusMap[exercise.id] = {
          isCompleted,
          isLocked,
          isInProgress,
          totalTasks,
          completedTasks,
        };

        if (!isCompleted) {
          lockFollowingExercises = true;
        }
      });

      if (exercises.length > 0 && completedInSection === exercises.length) {
        completedSections += 1;
      }

      sectionProgressMap[section.id] = {
        completed: completedInSection,
        total: exercises.length,
        percent: exercises.length > 0 ? Math.round((completedInSection / exercises.length) * 100) : 0,
      };
    }

    const progressPercent = totalExercises > 0
      ? Math.round((completedExercises / totalExercises) * 100)
      : 0;

    const earnedXp = completedExercises * EXERCISE_XP + completedSections * QUIZ_XP;
    return {
      exerciseStatusMap,
      sectionProgressMap,
      activeExerciseMeta: activeExerciseMeta || lastExerciseMeta || firstExerciseMeta,
      activeSectionId: activeSectionId || firstExerciseMeta?.sectionId || null,
      firstExerciseMeta,
      completedExercises,
      completedSections,
      totalExercises,
      totalLessons: totalLessons || totalExercises,
      earnedXp,
      progressPercent,
    };
  }, [completedExerciseIds, completedTaskIds, track]);

  const skills = useMemo(() => buildSkills(track?.sections || []), [track]);

  function navigateToExercise(meta) {
    if (!track || !meta?.exerciseId) return;

    navigate(
      APP_ROUTES.frontendExerciseWorkspace(
        trackSlug,
        slugify(meta.sectionTitle),
        slugify(meta.exerciseTitle),
        meta.exerciseId,
      ),
      {
        state: {
          trackTitle: track.title,
          sectionTitle: meta.sectionTitle,
          exerciseTitle: meta.exerciseTitle,
        },
      },
    );
  }

  function handlePrimaryAction() {
    navigateToExercise(learningState.activeExerciseMeta || learningState.firstExerciseMeta);
  }

  function handleExerciseClick(exercise, section, status) {
    if (status?.isLocked) return;

    navigateToExercise({
      sectionId: section.id,
      sectionTitle: section.title,
      exerciseId: exercise.id,
      exerciseTitle: exercise.title,
    });
  }

  function toggleSection(sectionId, isExpanded) {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !isExpanded,
    }));
  }

  if (loading) {
    return (
      <div className="trackOverviewPage trackOverviewPage--loading">
        <div className="trackOverviewPage__stateCard">
          <img src={ASSETS.brand.favicon} alt="" />
          <p>Loading track overview...</p>
        </div>
      </div>
    );
  }

  if (error || !track) {
    return (
      <div className="trackOverviewPage trackOverviewPage--error">
        <div className="trackOverviewPage__stateCard">
          <img src={ASSETS.icons.lockBlue} alt="" />
          <p>{error || "Track not found."}</p>
          <button className="btn btn-ghost" onClick={() => navigate(APP_ROUTES.frontendTracks)}>
            Back to Tracks
          </button>
        </div>
      </div>
    );
  }

  const heroImage = track.featured_image_url || ASSETS.tracks.pythonCampusHero;
  const activeMeta = learningState.activeExerciseMeta;
  const actionLabel = learningState.completedExercises > 0 ? "Resume Learning" : "Start Track";
  const completedTaskRatio = activeMeta
    ? learningState.exerciseStatusMap[activeMeta.exerciseId]
    : null;
  const activeProgress = completedTaskRatio?.totalTasks
    ? Math.round((completedTaskRatio.completedTasks / completedTaskRatio.totalTasks) * 100)
    : 0;
  const estimatedDuration = formatDuration(estimateTrackMinutes(track));
  const learnerCount = Number(track.learner_count || 0);
  const learnerLabel = learnerCount > 0
    ? `${learnerCount} ${learnerCount === 1 ? "learner" : "learners"} learning`
    : "Be the first learner";
  const leaderboardPreview = trackLeaderboard.slice(0, 5);
  const learnerProofEntries = leaderboardPreview.slice(0, 3);

  return (
    <div className="trackOverviewPage">
      <div className="trackOverviewPage__heroShell">
        <section
          className="trackOverviewPage__hero"
          style={{ "--track-hero-image": `url(${heroImage})` }}
        >
          <div className="trackOverviewPage__heroContent">
            <h1>{track.title}</h1>
            <p>
              {track.description || "Learn programming from the ground up through hands-on coding and real projects."}
            </p>

            <div className="trackOverviewPage__heroBadges" aria-label="Track summary">
              <span className="trackOverviewPage__heroBadge trackOverviewPage__heroBadge--level">
                <ShieldCheck size={15} />
                {DEFAULT_DIFFICULTY}
              </span>
              <span className="trackOverviewPage__heroBadge trackOverviewPage__heroBadge--lessons">
                <BookOpenCheck size={15} />
                {formatPlural(learningState.totalLessons, "Lesson")}
              </span>
              <span className="trackOverviewPage__heroBadge trackOverviewPage__heroBadge--exercises">
                <Circle size={15} />
                {formatPlural(learningState.totalExercises, "Exercise")}
              </span>
              <span className="trackOverviewPage__heroBadge trackOverviewPage__heroBadge--time">
                <Clock3 size={15} />
                {estimatedDuration}
              </span>
            </div>

            <div className="trackOverviewPage__heroFooter">
              <button
                type="button"
                className="trackOverviewPage__primaryAction"
                onClick={handlePrimaryAction}
                disabled={!learningState.firstExerciseMeta}
              >
                <Play size={18} />
                {actionLabel}
              </button>

              <div className="trackOverviewPage__learnerProof" aria-label={learnerLabel}>
                <div className="trackOverviewPage__learnerStack" aria-hidden="true">
                  {learnerProofEntries.length > 0 ? (
                    learnerProofEntries.map((learner) => (
                      <span key={learner.user_id}>
                        {learner.avatar ? (
                          <img src={learner.avatar} alt="" draggable="false" />
                        ) : (
                          getAvatarInitial(learner.username)
                        )}
                      </span>
                    ))
                  ) : (
                    <>
                      <span>C</span>
                      <span>4</span>
                      <span><Users size={13} /></span>
                    </>
                  )}
                </div>
                <p>{learnerLabel}</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="trackOverviewPage__shell">
        <div className="trackOverviewPage__contentGrid">
          <main className="trackOverviewPage__mainColumn">
            <section className="trackOverviewPage__notice">
              <img src={ASSETS.icons.hintBulb} alt="" />
              <p>
                Open an exercise to view and complete its levels in the Workspace.
                Levels are not shown here to keep your learning path focused.
              </p>
              <img className="trackOverviewPage__noticeCloud" src={ASSETS.decorations.pixelCloud} alt="" />
            </section>

            <section className="trackOverviewPage__roadmap" aria-label={`${track.title} roadmap`}>
              <div className="trackOverviewPage__timelineFlag" aria-hidden="true">
                <img src={ASSETS.icons.timelineFlag} alt="" />
              </div>

              {(track.sections || []).map((section, index) => {
                const progress = learningState.sectionProgressMap[section.id] || { completed: 0, total: 0, percent: 0 };
                const isCompleted = progress.total > 0 && progress.completed === progress.total;
                const isActiveSection = section.id === learningState.activeSectionId;
                const sectionState = isCompleted
                  ? "completed"
                  : isActiveSection
                    ? "active"
                    : "locked";
                const isSectionLocked = sectionState === "locked";
                const isDefaultExpanded = section.id === learningState.activeSectionId || (!learningState.activeSectionId && index === 0);
                const isExpanded = expandedSections[section.id] ?? isDefaultExpanded;

                return (
                  <article
                    key={section.id}
                    className={`trackOverviewPage__section trackOverviewPage__section--${sectionState} ${isExpanded ? "is-expanded" : ""}`}
                    style={{ "--chapter-index": index }}
                  >
                    <div className="trackOverviewPage__sectionNode" aria-hidden="true" />

                    <button
                      type="button"
                      className="trackOverviewPage__sectionHeader"
                      onClick={() => toggleSection(section.id, isExpanded)}
                      aria-expanded={isExpanded}
                      data-locked={isSectionLocked ? "true" : undefined}
                    >
                      <div className="trackOverviewPage__sectionTitleRow">
                        <span
                          className={`trackOverviewPage__sectionStatus trackOverviewPage__sectionStatus--${sectionState}`}
                          style={{ "--status-progress": `${progress.percent}%` }}
                          aria-hidden="true"
                        >
                          {isCompleted ? (
                            <CheckCircle2 size={16} />
                          ) : (
                            <span>{index + 1}</span>
                          )}
                        </span>
                        <div>
                          <h2>{section.title}</h2>
                          <p>{section.description || "Practice core concepts with focused coding exercises."}</p>
                        </div>
                      </div>
                      <div className="trackOverviewPage__sectionMeta">
                        {isSectionLocked ? (
                          <span className="trackOverviewPage__lockedLabel">
                            <LockAsset />
                            Locked
                          </span>
                        ) : (
                          <>
                            <span>{progress.percent}%</span>
                            <small>({progress.completed}/{progress.total})</small>
                          </>
                        )}
                        <ChevronDown size={18} className={isExpanded ? "is-open" : ""} />
                      </div>
                    </button>

                    <div className={`trackOverviewPage__exercisePanel ${isExpanded ? "is-expanded" : ""}`}>
                      <div className="trackOverviewPage__exerciseList">
                        {(section.exercises || []).map((exercise, exerciseIndex) => {
                          const status = learningState.exerciseStatusMap[exercise.id] || {};
                          const exerciseProgress = status.totalTasks
                            ? Math.round((status.completedTasks / status.totalTasks) * 100)
                            : 0;
                          const isActiveExercise = activeMeta?.exerciseId === exercise.id;
                          const actionVariant = status.isCompleted
                            ? "review"
                            : status.isLocked
                              ? "locked"
                              : status.isInProgress
                                ? "continue"
                                : "start";
                          const actionText = status.isCompleted
                            ? "Review"
                            : status.isLocked
                              ? "Locked"
                              : status.isInProgress
                                ? "Continue"
                                : "Start";

                          return (
                            <div
                              key={exercise.id}
                              className={`trackOverviewPage__exercise trackOverviewPage__exercise--${actionVariant}`}
                              style={{ "--exercise-index": exerciseIndex }}
                              onClick={() => handleExerciseClick(exercise, section, status)}
                              role="button"
                              tabIndex={status.isLocked ? -1 : 0}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  handleExerciseClick(exercise, section, status);
                                }
                              }}
                            >
                              <div className="trackOverviewPage__exerciseLeft">
                                <span
                                  className={`trackOverviewPage__exerciseStatus trackOverviewPage__exerciseStatus--${
                                    status.isCompleted ? "completed" : isActiveExercise ? "active" : "inactive"
                                  }`}
                                  style={{ "--exercise-progress": `${exerciseProgress}%` }}
                                  aria-hidden="true"
                                >
                                  {status.isCompleted ? (
                                    <CheckCircle2 size={18} />
                                  ) : (
                                    <span>{exerciseIndex + 1}</span>
                                  )}
                                </span>
                                <div>
                                  <h3>Exercise {exerciseIndex + 1}: {exercise.title}</h3>
                                  <p>
                                    {status.totalTasks > 1
                                      ? `${status.completedTasks}/${status.totalTasks} levels complete`
                                      : "Practice this concept in the Workspace."}
                                  </p>
                                </div>
                              </div>

                              <div className="trackOverviewPage__exerciseRight">
                                <span className="trackOverviewPage__xp">
                                  <img src={ASSETS.icons.xpStar} alt="" />
                                  +{EXERCISE_XP} XP
                                </span>
                                <button
                                  type="button"
                                  className={`trackOverviewPage__exerciseAction trackOverviewPage__exerciseAction--${actionVariant}`}
                                  disabled={status.isLocked}
                                  aria-label={status.isLocked ? "Locked" : actionText}
                                  title={status.isLocked ? "Locked" : undefined}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleExerciseClick(exercise, section, status);
                                  }}
                                >
                                  {status.isCompleted && <RotateCcw size={13} />}
                                  {!status.isCompleted && !status.isLocked && <Play size={13} />}
                                  {status.isLocked && <LockAsset />}
                                  {!status.isLocked && actionText}
                                </button>
                                <ChevronRight size={17} className="trackOverviewPage__exerciseChevron" />
                              </div>
                            </div>
                          );
                        })}

                        <div className="trackOverviewPage__exercise trackOverviewPage__exercise--quiz">
                          <div className="trackOverviewPage__exerciseLeft">
                            <span className="trackOverviewPage__exerciseStatus trackOverviewPage__exerciseStatus--quiz">
                              <FileQuestion size={15} />
                            </span>
                            <div>
                              <h3>{section.title} Quiz</h3>
                              <p>Complete all exercises in this section to unlock the quiz.</p>
                            </div>
                          </div>
                          <div className="trackOverviewPage__exerciseRight">
                            <span className="trackOverviewPage__xp">
                              <img src={ASSETS.icons.xpStar} alt="" />
                              +{QUIZ_XP} XP
                            </span>
                            <span className="trackOverviewPage__lockedPill trackOverviewPage__lockedPill--iconOnly" aria-label="Locked" title="Locked">
                              <LockAsset />
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}

              <MilestoneCard
                imageSrc={ASSETS.tracks.projectLaptop}
                imageAlt="Project laptop"
                title="Track Project"
                description="Build a real-world project to apply your skills."
                xp={PROJECT_XP}
                variant="project"
              />

              <MilestoneCard
                imageSrc={ASSETS.icons.trophyCup}
                imageAlt="Trophy cup"
                title="Final Exam"
                description="Test your knowledge and become a Python pro."
                xp={FINAL_XP}
                variant="final"
              />
            </section>
          </main>

          <aside className="trackOverviewPage__sidebar" aria-label="Track progress and rewards">
            <section className="trackOverviewPage__sideCard trackOverviewPage__progressCard">
              <h2>Your Progress</h2>
              <div className="trackOverviewPage__progressTop">
                <div
                  className="trackOverviewPage__donut"
                  style={{ "--progress-value": `${learningState.progressPercent}%` }}
                  aria-label={`${learningState.progressPercent}% overall completion`}
                >
                  <span>{learningState.progressPercent}%</span>
                </div>
                <p>Overall Completion</p>
              </div>

              <div className="trackOverviewPage__statList">
                <div>
                  <span><img src={ASSETS.icons.xpStar} alt="" /> Exercises Completed</span>
                  <strong>{learningState.completedExercises} / {learningState.totalExercises}</strong>
                </div>
                <div>
                  <span><FileBadge2 size={14} /> Quizzes Passed</span>
                  <strong>0 / {track.sections?.length || 0}</strong>
                </div>
                <div>
                  <span><LockAsset /> Project Status</span>
                  <strong>Locked</strong>
                </div>
                <div>
                  <span><Trophy size={14} /> Final Exam</span>
                  <strong>Locked</strong>
                </div>
              </div>
            </section>

            <section className="trackOverviewPage__sideCard trackOverviewPage__leaderboardCard">
              <div className="trackOverviewPage__leaderboardHeader">
                <h2>Track Leaderboard</h2>
                <span>Top 5</span>
              </div>

              {leaderboardPreview.length > 0 ? (
                <ol className="trackOverviewPage__leaderboardList">
                  {leaderboardPreview.map((learner) => (
                    <li key={learner.user_id}>
                      <span className="trackOverviewPage__leaderboardRank">#{learner.rank}</span>
                      <span className="trackOverviewPage__leaderboardAvatar">
                        {learner.avatar ? (
                          <img src={learner.avatar} alt="" draggable="false" />
                        ) : (
                          getAvatarInitial(learner.username)
                        )}
                      </span>
                      <span className="trackOverviewPage__leaderboardName">{learner.username}</span>
                      <strong>{learner.xp} XP</strong>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="trackOverviewPage__leaderboardEmpty">
                  Complete tasks to open the first track rankings.
                </p>
              )}

              <Link to={APP_ROUTES.frontendTrackLeaderboard(trackSlug)} className="trackOverviewPage__outlineAction">
                <Trophy size={15} />
                Explore Leaderboard
              </Link>
            </section>

            <section className="trackOverviewPage__sideCard trackOverviewPage__continueCard">
              <h2>Continue Where You Left Off</h2>
              <div className="trackOverviewPage__continueBody">
                <img src={ASSETS.tracks.projectLaptop} alt="" />
                <div>
                  <p>{activeMeta?.sectionTitle || "Start the track"}</p>
                  <h3>{activeMeta ? `Exercise ${activeMeta.exerciseIndex + 1}: ${activeMeta.exerciseTitle}` : "First exercise"}</h3>
                  <div className="trackOverviewPage__miniProgress" aria-hidden="true">
                    <span style={{ width: `${activeProgress}%` }} />
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="trackOverviewPage__wideAction"
                onClick={handlePrimaryAction}
                disabled={!learningState.firstExerciseMeta}
              >
                Open Workspace
              </button>
            </section>

            <section className="trackOverviewPage__sideCard trackOverviewPage__rewardsCard" id="track-rewards">
              <h2>Track Rewards</h2>
              <div className="trackOverviewPage__rewardGrid">
                <div>
                  <img src={ASSETS.icons.xpStar} alt="" />
                  <strong>{learningState.earnedXp}</strong>
                  <span>Total XP</span>
                </div>
                <div>
                  <img src={ASSETS.icons.trophyCup} alt="" />
                  <strong>{learningState.completedSections}</strong>
                  <span>Badges Earned</span>
                </div>
                <div>
                  <img src={ASSETS.icons.streakFire} alt="" />
                  <strong>7</strong>
                  <span>Day Streak</span>
                </div>
              </div>
              <button type="button" className="trackOverviewPage__outlineAction">
                <Trophy size={15} />
                View All Rewards
              </button>
            </section>

            <section className="trackOverviewPage__sideCard trackOverviewPage__certificateCard">
              <img src={ASSETS.rewards.certificateTrophy} alt="" />
              <div>
                <h2>Certificate Path</h2>
                <p>
                  {learningState.progressPercent >= 100
                    ? "Your certificate is ready to claim."
                    : "Complete every exercise, project, and exam to unlock it."}
                </p>
              </div>
              <span className={learningState.progressPercent >= 100 ? "is-ready" : ""}>
                {learningState.progressPercent >= 100 ? "Ready" : "Locked"}
              </span>
            </section>

            <section className="trackOverviewPage__sideCard trackOverviewPage__skillsCard">
              <h2>Skills You'll Learn</h2>
              <ul>
                {skills.map((skill) => (
                  <li key={skill}>
                    <Check size={14} />
                    {skill}
                  </li>
                ))}
              </ul>
              <Link to={APP_ROUTES.frontendTracks} className="trackOverviewPage__textLink">
                View Full Skills Map
                <ChevronRight size={14} />
              </Link>
            </section>

            <section
              className="trackOverviewPage__helperCard"
              style={{ "--helper-cloud": `url(${ASSETS.decorations.pixelCloud})` }}
            >
              <img src={ASSETS.mascot.workspaceGuide} alt="" />
              <div>
                <h2>Need a hand?</h2>
                <p>I'm here to help you crush this track.</p>
              </div>
              <Flame size={18} aria-hidden="true" />
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
