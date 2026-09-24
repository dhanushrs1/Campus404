import DOMPurify from "dompurify";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileCode2,
  Folder,
  FolderOpen,
  Lightbulb,
  Loader2,
  Lock,
  Play,
  Search,
  Send,
  Sparkles,
  Terminal,
  Trophy,
  User,
  XCircle,
} from "lucide-react";
import {
  answerQuiz,
  completeTheoryExercise,
  finishQuiz,
  getWorkspaceExercise,
  recordReferenceAccess,
  runExercise,
  startQuiz,
  submitExercise,
  useExerciseHint,
} from "../../../shared/learningApi.js";
import { APP_ROUTES } from "../../../routes/paths.js";
import { ASSETS } from "../../../shared/assets.js";
import AvatarImage from "../../components/AvatarImage/AvatarImage.jsx";
import "./WorkspacePage.css";

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\w ]+/g, "")
    .replace(/ +/g, "-");
}

function normalizeMode(mode) {
  return mode === "task" ? "code" : mode || "code";
}

function languageForPath(path = "") {
  const lower = path.toLowerCase();
  if (lower.endsWith(".py")) return "python";
  if (lower.endsWith(".js")) return "javascript";
  if (lower.endsWith(".ts")) return "typescript";
  if (lower.endsWith(".html")) return "html";
  if (lower.endsWith(".css")) return "css";
  if (lower.endsWith(".java")) return "java";
  if (lower.endsWith(".cpp") || lower.endsWith(".c")) return "cpp";
  return "plaintext";
}

function filesFromPayload(payload) {
  const files = Array.isArray(payload?.files) ? payload.files : [];
  if (files.length > 0) {
    return files.map((file, index) => ({
      file_path: file.file_path || `file-${index + 1}.txt`,
      content: file.starter_code || "",
      language: file.language || languageForPath(file.file_path),
      is_entrypoint: Boolean(file.is_entrypoint),
      is_editable: file.is_editable !== false,
      order: file.order || index + 1,
    }));
  }

  return [
    {
      file_path: "main.py",
      content: "# Write your code here\n",
      language: "python",
      is_entrypoint: true,
      is_editable: true,
      order: 1,
    },
  ];
}

function previewSrcDoc(files) {
  const byPath = Object.fromEntries(files.map((file) => [file.file_path.toLowerCase(), file.content || ""]));
  const html = byPath["index.html"] || "";
  const css = byPath["styles.css"] || byPath["style.css"] || "";
  const js = byPath["script.js"] || byPath["main.js"] || "";

  if (!html.trim()) {
    return `<!doctype html><html><head><style>${css}</style></head><body><main class="preview-empty">Add index.html content to preview your work.</main><script>${js}</script></body></html>`;
  }

  const hasHead = /<head[\s>]/i.test(html);
  const hasBody = /<body[\s>]/i.test(html);
  if (hasHead || hasBody) {
    return html
      .replace(/<\/head>/i, `<style>${css}</style></head>`)
      .replace(/<\/body>/i, `<script>${js}</script></body>`);
  }
  return `<!doctype html><html><head><style>${css}</style></head><body>${html}<script>${js}</script></body></html>`;
}

function StatusBanner({ result, submitResult }) {
  if (submitResult?.xp_awarded > 0) {
    return (
      <div className="ws-mode-banner ws-mode-banner--success">
        <Trophy size={18} />
        Completed. +{submitResult.xp_awarded} XP earned.
      </div>
    );
  }
  if (!result) return null;
  if (result.passed) {
    return (
      <div className="ws-mode-banner ws-mode-banner--success">
        <CheckCircle2 size={18} />
        All checks passed. Submit is ready.
      </div>
    );
  }
  return (
    <div className="ws-mode-banner ws-mode-banner--error">
      <XCircle size={18} />
      {result.error || result.verdict || "Some checks failed."}
    </div>
  );
}

function CompletionSummary({ data, submitResult, nextExercise, onNext }) {
  const isCompleted = Boolean(submitResult || data?.status === "completed");
  if (!isCompleted) return null;

  const xpAwarded = Number(submitResult?.xp_awarded || 0);
  const streak = Number(data?.current_streak || 0);

  return (
    <section className="ws-completion-card" aria-label="Exercise completion summary">
      <div className="ws-completion-card__badge">
        <Trophy size={22} />
      </div>
      <div className="ws-completion-card__copy">
        <span>Level complete</span>
        <h2>{xpAwarded > 0 ? `+${xpAwarded} XP earned` : "Progress saved"}</h2>
        <p>
          {nextExercise
            ? `Next up: ${nextExercise.title}`
            : "You reached the end of this section. Check your profile or rewards next."}
        </p>
      </div>
      <div className="ws-completion-card__stats">
        <span><Sparkles size={15} /> {data?.user_xp || 0} total XP</span>
        <span>Streak {streak}</span>
      </div>
      <div className="ws-completion-card__actions">
        {nextExercise ? (
          <button type="button" className="btn btn-brand" onClick={onNext}>
            Next Level <ChevronRight size={15} />
          </button>
        ) : (
          <Link className="btn btn-brand" to={APP_ROUTES.frontendTracks}>
            Tracks <ChevronRight size={15} />
          </Link>
        )}
        <Link className="btn btn-ghost" to={APP_ROUTES.frontendRankingRewards}>Rewards</Link>
      </div>
    </section>
  );
}

function WorkspaceSidebar({ sections, activeExerciseId, viewAll, setViewAll, search, setSearch, goToExercise }) {
  const query = search.trim().toLowerCase();

  return (
    <aside className="ws-level-sidebar">
      <div className="ws-sidebar-tools">
        <label className="ws-level-search">
          <Search size={14} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search levels" />
        </label>
        <button type="button" onClick={() => setViewAll((value) => !value)}>
          {viewAll ? "Active only" : "View all levels"}
        </button>
      </div>

      <div className="ws-section-list">
        {(sections || []).map((section) => {
          const exercises = (section.exercises || []).filter((exercise) => (
            !query || `${exercise.title} ${exercise.mode}`.toLowerCase().includes(query)
          ));
          const isActiveSection = exercises.some((exercise) => Number(exercise.id) === Number(activeExerciseId));
          const expanded = viewAll || isActiveSection || query;

          return (
            <section className={`ws-section-group ${expanded ? "is-expanded" : ""}`} key={section.id}>
              <div className="ws-section-title">
                {expanded ? <FolderOpen size={15} /> : <Folder size={15} />}
                <span>{section.title}</span>
                <strong>{section.progress_percent || 0}%</strong>
              </div>
              {expanded && (
                <div className="ws-level-list">
                  {exercises.map((exercise) => {
                    const active = Number(exercise.id) === Number(activeExerciseId);
                    const locked = exercise.status === "locked";
                    return (
                      <button
                        type="button"
                        key={exercise.id}
                        className={`ws-level-row ${active ? "is-active" : ""} ${exercise.status === "completed" ? "is-completed" : ""}`}
                        disabled={locked}
                        onClick={() => goToExercise(section, exercise)}
                      >
                        <span>
                          {locked ? <Lock size={13} /> : exercise.status === "completed" ? <Check size={13} /> : <FileCode2 size={13} />}
                        </span>
                        <span>{exercise.title}</span>
                        <small>{normalizeMode(exercise.mode).replaceAll("_", " ")}</small>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </aside>
  );
}

function CodeEditorPane({ files, setFiles, activePath, setActivePath, mode }) {
  const activeFile = files.find((file) => file.file_path === activePath) || files[0];

  function updateActive(content) {
    setFiles((current) => current.map((file) => (
      file.file_path === activeFile.file_path ? { ...file, content } : file
    )));
  }

  return (
    <div className={`ws-mode-center ${mode === "frontend_preview" ? "ws-mode-center--preview" : ""}`}>
      <div className="ws-file-strip">
        {files.map((file) => (
          <button
            type="button"
            key={file.file_path}
            className={file.file_path === activeFile.file_path ? "is-active" : ""}
            onClick={() => setActivePath(file.file_path)}
          >
            <FileCode2 size={14} />
            {file.file_path}
          </button>
        ))}
      </div>

      <div className="ws-editor-shell">
        <div className="ws-editor-meta">
          <span>{activeFile?.file_path}</span>
          <small>{activeFile?.is_editable === false ? "Read-only" : languageForPath(activeFile?.file_path)}</small>
        </div>
        <textarea
          className="ws-code-editor"
          spellCheck={false}
          value={activeFile?.content || ""}
          readOnly={activeFile?.is_editable === false}
          onChange={(event) => updateActive(event.target.value)}
        />
      </div>
    </div>
  );
}

function TerminalPane({ running, result }) {
  return (
    <div className="ws-terminal ws-terminal--engine">
      <div className="ws-terminal-header">
        <Terminal size={14} />
        <span>Checks</span>
      </div>
      <div className="ws-terminal-body">
        {running && (
          <div className="ws-terminal-running">
            <Loader2 size={18} className="ws-spin" />
            Running checks...
          </div>
        )}
        {!running && !result && (
          <div className="ws-terminal-placeholder">
            <p>Run the exercise to see output and visible test results.</p>
          </div>
        )}
        {!running && result && (
          <div className="ws-terminal-result">
            <strong>{result.verdict}</strong>
            <p>{result.passed_cases || 0} / {result.total_cases || 0} checks passed</p>
            {result.visible_results?.length > 0 && (
              <ul className="ws-visible-tests">
                {result.visible_results.map((item, index) => (
                  <li key={`${item.label}-${index}`} className={item.passed ? "is-pass" : "is-fail"}>
                    {item.passed ? <Check size={13} /> : <XCircle size={13} />}
                    <span>{item.label}</span>
                    <small>{item.verdict}</small>
                  </li>
                ))}
              </ul>
            )}
            {result.output && <pre className="ws-terminal-stdout">{result.output}</pre>}
            {result.error && <pre className="ws-terminal-stderr">{result.error}</pre>}
          </div>
        )}
      </div>
    </div>
  );
}

function FrontendPreviewPane({ files }) {
  return (
    <div className="ws-preview-pane">
      <div className="ws-preview-toolbar">
        <span>Live Preview</span>
      </div>
      <iframe title="Frontend preview" sandbox="allow-scripts" srcDoc={previewSrcDoc(files)} />
    </div>
  );
}

function TheoryMode({ data, onComplete, completing }) {
  return (
    <div className="ws-theory-mode">
      <article
        className="ws-theory-lesson"
        dangerouslySetInnerHTML={{
          __html: DOMPurify.sanitize(data.theory_content || data.instructions_md || ""),
        }}
      />
      <button type="button" className="btn btn-brand ws-wide-action" onClick={onComplete} disabled={completing}>
        {completing ? <Loader2 size={16} className="ws-spin" /> : <CheckCircle2 size={16} />}
        I Tried It
      </button>
    </div>
  );
}

function QuizMode({ data, quizAttemptId, answers, setAnswers, onStart, onAnswer, onFinish, finishing }) {
  const questions = data.quiz_questions || [];
  const answered = Object.keys(answers).length;

  return (
    <div className="ws-quiz-mode">
      <div className="ws-quiz-header">
        <BookOpen size={18} />
        <div>
          <h2>{data.title}</h2>
          <p>{answered} / {questions.length} answered. Passing score: {data.passing_score_pct}%.</p>
        </div>
      </div>
      {!quizAttemptId ? (
        <button type="button" className="btn btn-brand ws-wide-action" onClick={onStart}>
          <Play size={16} />
          Start Quiz
        </button>
      ) : (
        <div className="ws-question-list">
          {questions.map((question, index) => (
            <section className="ws-question-card" key={question.id}>
              <span>Question {index + 1}</span>
              <h3>{question.question_text}</h3>
              {question.code_snippet && <pre>{question.code_snippet}</pre>}
              <div className="ws-option-list">
                {(question.options || []).map((option) => (
                  <button
                    type="button"
                    key={option.id}
                    className={Number(answers[question.id]) === Number(option.id) ? "is-selected" : ""}
                    onClick={() => {
                      setAnswers((current) => ({ ...current, [question.id]: option.id }));
                      onAnswer(question.id, option.id);
                    }}
                  >
                    {option.option_text}
                  </button>
                ))}
              </div>
            </section>
          ))}
          <button
            type="button"
            className="btn btn-brand ws-wide-action"
            onClick={onFinish}
            disabled={finishing || answered < questions.length}
          >
            {finishing ? <Loader2 size={16} className="ws-spin" /> : <Send size={16} />}
            Finish Quiz
          </button>
        </div>
      )}
    </div>
  );
}

function InstructionPanel({ data, hints, onUseHint, onOpenReference }) {
  return (
    <aside className="ws-instruction-panel">
      <div className="ws-instruction-card">
        <span className="ws-mode-pill">{normalizeMode(data.mode).replaceAll("_", " ")}</span>
        <h1>{data.title}</h1>
        <div
          className="ws-instruction-copy"
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(data.instructions_md || data.theory_content || ""),
          }}
        />
      </div>

      <div className="ws-instruction-card">
        <h2>
          <Lightbulb size={16} />
          Hints
        </h2>
        {(hints || []).length === 0 && <p className="ws-muted">No hints for this level.</p>}
        {(hints || []).map((hint) => (
          <div className={`ws-hint-row ${hint.is_unlocked ? "is-unlocked" : "is-locked"}`} key={hint.id}>
            <div>
              <strong>Hint {hint.order}</strong>
              <small>{hint.penalty_xp ? `-${hint.penalty_xp} XP` : "No XP penalty"}</small>
            </div>
            {hint.is_unlocked ? (
              <>
                {hint.content_md && <p>{hint.content_md}</p>}
                {!hint.has_used && (
                  <button type="button" onClick={() => onUseHint(hint.id)}>
                    Reveal
                  </button>
                )}
              </>
            ) : (
              <span><Lock size={13} /> Locked</span>
            )}
          </div>
        ))}
      </div>

      {(data.reference_solution_url || data.docs_url) && (
        <div className="ws-instruction-card">
          <h2>Reference</h2>
          <button type="button" className="ws-reference-button" onClick={onOpenReference}>
            Open reference
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </aside>
  );
}

export default function WorkspacePage() {
  const { trackSlug, sectionSlug, exerciseSlug, taskId: exerciseId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [files, setFiles] = useState([]);
  const [activePath, setActivePath] = useState("");
  const [hints, setHints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [submitResult, setSubmitResult] = useState(null);
  const [attemptId, setAttemptId] = useState(null);
  const [viewAll, setViewAll] = useState(false);
  const [search, setSearch] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [quizAttemptId, setQuizAttemptId] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState({});

  useEffect(() => {
    setAvatarUrl(localStorage.getItem("campus404_avatar_url") || "");
  }, []);

  useEffect(() => {
    let disposed = false;
    async function load() {
      setLoading(true);
      setError("");
      setRunResult(null);
      setSubmitResult(null);
      setAttemptId(null);
      setQuizAttemptId(null);
      setQuizAnswers({});
      try {
        const payload = await getWorkspaceExercise(exerciseId);
        if (disposed) return;
        const nextFiles = filesFromPayload(payload);
        setData(payload);
        setFiles(nextFiles);
        setActivePath((nextFiles.find((file) => file.is_entrypoint) || nextFiles[0])?.file_path || "");
        setHints(payload.hints || []);
      } catch (err) {
        if (!disposed) setError(err.message || "Unable to load workspace.");
      } finally {
        if (!disposed) setLoading(false);
      }
    }
    if (exerciseId) {
      load();
    }
    return () => {
      disposed = true;
    };
  }, [exerciseId]);

  const mode = normalizeMode(data?.mode);
  const activeIndex = useMemo(() => {
    if (!data?.exercises_in_section) return 0;
    return data.exercises_in_section.findIndex((exercise) => Number(exercise.id) === Number(data.id));
  }, [data]);
  const nextExercise = data?.exercises_in_section?.[activeIndex + 1] || null;
  const previousExercise = data?.exercises_in_section?.[activeIndex - 1] || null;

  const progressPercent = useMemo(() => {
    const sections = data?.sections || [];
    const exercises = sections.flatMap((section) => section.exercises || []);
    if (!exercises.length) return 0;
    const completed = exercises.filter((exercise) => exercise.status === "completed").length;
    return Math.round((completed / exercises.length) * 100);
  }, [data]);

  function goToExercise(section, exercise) {
    if (!exercise || exercise.status === "locked") return;
    navigate(APP_ROUTES.frontendExerciseWorkspace(
      trackSlug,
      slugify(section?.slug || section?.title || sectionSlug),
      slugify(exercise.slug || exercise.title || exerciseSlug),
      exercise.id,
    ));
  }

  async function handleRun() {
    if (!data || running) return;
    setRunning(true);
    setRunResult(null);
    setSubmitResult(null);
    try {
      const result = await runExercise(data.id, { files });
      setRunResult(result);
      setAttemptId(result.attempt_id);
      if (result.passed && data.auto_submit_on_pass) {
        await handleSubmit(result.attempt_id);
      }
    } catch (err) {
      setRunResult({ passed: false, verdict: "Internal Error", error: err.message, passed_cases: 0, total_cases: 0 });
    } finally {
      setRunning(false);
    }
  }

  async function handleSubmit(forcedAttemptId = attemptId) {
    if (!data || submitting) return;
    setSubmitting(true);
    try {
      const result = await submitExercise(data.id, { attempt_id: forcedAttemptId, files });
      setSubmitResult(result);
      setData((current) => current ? { ...current, status: "completed" } : current);
    } catch (err) {
      setRunResult((current) => ({ ...(current || {}), passed: false, verdict: "Submit Locked", error: err.message }));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTheoryComplete() {
    if (!data) return;
    setSubmitting(true);
    try {
      const result = await completeTheoryExercise(data.id);
      setSubmitResult(result);
      setData((current) => current ? { ...current, status: "completed" } : current);
    } catch (err) {
      setError(err.message || "Unable to complete theory lesson.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUseHint(hintId) {
    if (!data) return;
    const result = await useExerciseHint(data.id, hintId);
    setHints((current) => current.map((hint) => (
      hint.id === hintId ? { ...result.hint, is_unlocked: true, has_used: true } : hint
    )));
  }

  async function handleOpenReference() {
    if (!data) return;
    const response = await recordReferenceAccess(data.id, data.reference_solution_url || data.docs_url);
    if (response.reference_url) {
      window.open(response.reference_url, "_blank", "noopener,noreferrer");
    }
  }

  async function handleQuizStart() {
    if (!data) return;
    const result = await startQuiz(data.id);
    setQuizAttemptId(result.attempt_id);
    setData((current) => current ? { ...current, quiz_questions: result.questions } : current);
  }

  async function handleQuizAnswer(questionId, optionId) {
    if (!data || !quizAttemptId) return;
    await answerQuiz(data.id, { attempt_id: quizAttemptId, question_id: questionId, option_id: optionId });
  }

  async function handleQuizFinish() {
    if (!data || !quizAttemptId) return;
    setSubmitting(true);
    try {
      const result = await finishQuiz(data.id, { attempt_id: quizAttemptId, answers: quizAnswers });
      setSubmitResult(result);
      setRunResult({ passed: result.passed, verdict: result.passed ? "Accepted" : "Try Again", passed_cases: result.score, total_cases: result.total_questions });
      if (result.passed) {
        setData((current) => current ? { ...current, status: "completed" } : current);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="ws-root ws-loading-screen">
        <Loader2 size={32} className="ws-spin" />
        <p>Loading workspace...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="ws-root ws-error-screen">
        <p>{error || "Exercise not found."}</p>
        <button className="ws-back-link" onClick={() => navigate(APP_ROUTES.frontendTracks)}>
          <ArrowLeft size={14} /> Back to Tracks
        </button>
      </div>
    );
  }

  const canSubmit = mode === "theory" || mode === "quiz" || runResult?.passed || submitResult;

  return (
    <div className="ws-root ws-learning-engine">
      <div className="ws-mobile-overlay">
        Rotate your device to landscape to use the Workspace.
      </div>
      <header className="ws-header">
        <div className="ws-header-left">
          <Link to={APP_ROUTES.home} className="ws-brand-mark">
            <img src={ASSETS.brand.logo} alt="Campus404" />
          </Link>
          <div className="ws-header-breadcrumb">
            <span>{data.track_title}</span>
            <ChevronRight size={12} />
            <span>{data.section_title}</span>
          </div>
        </div>
        <div className="ws-header-center">
          <span className="ws-progress-text">{progressPercent}%</span>
          <div className="ws-progress-bar">
            <div className="ws-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
          <span className="ws-xp-chip"><Sparkles size={14} /> {data.user_xp || 0} XP</span>
          <span className="ws-xp-chip">Streak {data.current_streak || 0}</span>
        </div>
        <div className="ws-header-right">
          <span className="ws-header-exercise-badge">Level {activeIndex + 1}</span>
          <div className="ws-user-profile">
            {avatarUrl ? (
              <AvatarImage src={avatarUrl} fallbackKey={data?.username || avatarUrl} alt="" />
            ) : <User size={18} />}
          </div>
        </div>
      </header>

      <div className="ws-engine-body">
        <WorkspaceSidebar
          sections={data.sections}
          activeExerciseId={data.id}
          viewAll={viewAll}
          setViewAll={setViewAll}
          search={search}
          setSearch={setSearch}
          goToExercise={goToExercise}
        />

        <main className={`ws-engine-main ws-engine-main--${mode}`}>
          <StatusBanner result={runResult} submitResult={submitResult} />
          <CompletionSummary
            data={data}
            submitResult={submitResult}
            nextExercise={nextExercise}
            onNext={() => nextExercise && goToExercise({ title: data.section_title, slug: sectionSlug }, nextExercise)}
          />

          {["code", "multi_file_code", "project"].includes(mode) && (
            <>
              <CodeEditorPane files={files} setFiles={setFiles} activePath={activePath} setActivePath={setActivePath} mode={mode} />
              <TerminalPane running={running} result={runResult} />
            </>
          )}

          {mode === "frontend_preview" && (
            <div className="ws-preview-layout">
              <CodeEditorPane files={files} setFiles={setFiles} activePath={activePath} setActivePath={setActivePath} mode={mode} />
              <FrontendPreviewPane files={files} />
            </div>
          )}

          {mode === "theory" && (
            <TheoryMode data={data} onComplete={handleTheoryComplete} completing={submitting} />
          )}

          {mode === "quiz" && (
            <QuizMode
              data={data}
              quizAttemptId={quizAttemptId}
              answers={quizAnswers}
              setAnswers={setQuizAnswers}
              onStart={handleQuizStart}
              onAnswer={handleQuizAnswer}
              onFinish={handleQuizFinish}
              finishing={submitting}
            />
          )}
        </main>

        <InstructionPanel
          data={data}
          hints={hints}
          onUseHint={handleUseHint}
          onOpenReference={handleOpenReference}
        />
      </div>

      <footer className="ws-footer">
        <div className="ws-footer-left">
          <button type="button" className="btn btn-ghost" onClick={() => navigate(APP_ROUTES.frontendTrackOverview(trackSlug))}>
            <ChevronLeft size={14} />
            Back to Track
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!previousExercise}
            onClick={() => previousExercise && goToExercise({ title: data.section_title, slug: sectionSlug }, previousExercise)}
          >
            Previous
          </button>
        </div>
        <div className="ws-footer-right">
          {["code", "multi_file_code", "frontend_preview", "project"].includes(mode) && (
            <>
              <button type="button" className="btn ws-run-btn" onClick={handleRun} disabled={running}>
                {running ? <Loader2 size={14} className="ws-spin" /> : <Play size={14} />}
                {mode === "frontend_preview" ? "Run Preview Checks" : "Run"}
              </button>
              <button type="button" className="btn btn-brand" onClick={() => handleSubmit()} disabled={!canSubmit || submitting}>
                {submitting ? <Loader2 size={14} className="ws-spin" /> : <Send size={14} />}
                Submit
              </button>
            </>
          )}
          <button
            type="button"
            className="btn btn-brand"
            disabled={!nextExercise || (!submitResult && data.status !== "completed")}
            onClick={() => nextExercise && goToExercise({ title: data.section_title, slug: sectionSlug }, nextExercise)}
          >
            Next Exercise
            <ChevronRight size={14} />
          </button>
        </div>
      </footer>
    </div>
  );
}
