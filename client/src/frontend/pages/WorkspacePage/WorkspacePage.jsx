import DOMPurify from "dompurify";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  Play, Square, ChevronLeft, ChevronRight, Loader2, Terminal,
  CheckCircle, XCircle, AlertTriangle, Send, User,
  List, ArrowLeft, Check, Lock, Printer, Copy
} from "lucide-react";
import { getExerciseWorkspace, evaluateTask, saveTaskProgress, getAllTaskProgress } from "../../../shared/learningApi.js";
import { APP_ROUTES } from "../../../routes/paths.js";
import { PythonIcon, JavaIcon, CppIcon, CIcon, JSIcon, SQLIcon, TextIcon } from "../../components/LanguageIcons/LanguageIcons.jsx";
import { ASSETS } from "../../../shared/assets.js";
import "./WorkspacePage.css";

const settingOptopus = ASSETS.mascot.workspaceGuide;
const successOptopus = ASSETS.mascot.workspaceGuide;

/* ── Language helpers ──────────────────────────────────────────────────── */
const LANG_MAP = {
  71:  { name: "Python",     ext: "py",   mono: "python",     Icon: PythonIcon, starter: "# Write code below\n" },
  63:  { name: "JavaScript", ext: "js",   mono: "javascript", Icon: JSIcon,     starter: "// Write code below\n" },
  62:  { name: "Java",       ext: "java", mono: "java",       Icon: JavaIcon,   starter: "// Write code below\n" },
  54:  { name: "C++",        ext: "cpp",  mono: "cpp",        Icon: CppIcon,    starter: "// Write code below\n" },
  50:  { name: "C",          ext: "c",    mono: "c",          Icon: CIcon,      starter: "// Write code below\n" },
  60:  { name: "Go",         ext: "go",   mono: "go",         Icon: TextIcon,   starter: "// Write code below\n" },
  73:  { name: "Rust",       ext: "rs",   mono: "rust",       Icon: TextIcon,   starter: "// Write code below\n" },
  74:  { name: "TypeScript", ext: "ts",   mono: "typescript", Icon: JSIcon,     starter: "// Write code below\n" },
};
const DEFAULT_LANG = LANG_MAP[71];

function getLangInfo(languageId) {
  return LANG_MAP[languageId] || DEFAULT_LANG;
}

/* ── File icon component ───────────────────────────────────────────────── */
function FileIcon({ ext }) {
  const lang = Object.values(LANG_MAP).find(l => l.ext === ext);
  const IconComponent = lang ? lang.Icon : TextIcon;
  return (
    <span className="ws-file-icon">
      <IconComponent size={16} />
    </span>
  );
}

/* ── Verdict helpers ───────────────────────────────────────────────────── */
const VERDICT_META = {
  Accepted:             { color: "var(--state-success)", Icon: CheckCircle },
  "Wrong Answer":       { color: "#f59e0b", Icon: XCircle },
  "Runtime Error":      { color: "var(--state-error)", Icon: XCircle },
  "Compilation Error":  { color: "var(--state-error)", Icon: AlertTriangle },
  "Time Limit Exceeded":{ color: "#f59e0b", Icon: AlertTriangle },
  "Internal Error":     { color: "var(--state-error)", Icon: AlertTriangle },
};

/* ── Parse starter code from task ──────────────────────────────────────── */
function parseStarterCode(task, langInfo) {
  if (!task?.starter_code) return { filename: `script.${langInfo.ext}`, content: langInfo.starter };
  
  try {
    const files = JSON.parse(task.starter_code);
    if (Array.isArray(files) && files.length > 0) {
      const mainFile = files.find(f => f.is_main) || files[0];
      return { filename: mainFile.filename, content: mainFile.content || "" };
    }
  } catch {
    // starter_code is plain text, not JSON
    return { filename: `script.${langInfo.ext}`, content: task.starter_code };
  }
  return { filename: `script.${langInfo.ext}`, content: langInfo.starter };
}

/* ── Detect judge language ID from file extension ──────────────────────── */
function detectJudgeLangId(filename, trackLangId) {
  const extMap = { ".py": 71, ".js": 63, ".ts": 74, ".java": 62, ".cpp": 54, ".c": 50, ".go": 60, ".rs": 73 };
  const ext = Object.keys(extMap).find(e => filename.endsWith(e));
  return ext ? extMap[ext] : (trackLangId || 71);
}

function slugify(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^\w ]+/g, "")
    .replace(/ +/g, "-");
}

/* ── Advanced Garbage Code Preventer ── */
function isLikelyGarbageCode(code, langId) {
  const cleanCode = code.trim();
  
  // 1. Far too short to be executable (e.g. "kkk")
  // Most valid basic programs checking assertions have at least 5+ characters.
  if (cleanCode.length < 5) return true;

  // 2. Just a single contiguous string with no syntax punctuation at all
  // Basically checks if someone just smashed their keyboard like "asdfasdfasdf" or "kkk"
  if (/^[a-zA-Z0-9_\s]+$/.test(cleanCode)) {
    // True python code needs parentheses `()`, quotes `""`, or operators `=`.
    return true;
  }

  // 3. Must contain at least SOME standard syntax identifier
  // e.g., brackets, parentheses, quotes, equals signs, math operators, colons, or dots
  const hasSyntax = /[()={};:,"'+[\]*/.-]/.test(cleanCode);
  if (!hasSyntax) return true;

  // 4. Strongly typed C-family languages typically require some brackets or semicolons
  // 62: Java, 54: C++, 50: C, 73: Rust, 60: Go, 74: TypeScript
  if ([62, 54, 50, 73, 60, 74].includes(langId)) {
    if (!/[{}]/.test(cleanCode) && !/[()]/.test(cleanCode) && !/import/.test(cleanCode)) return true;
  }

  return false;
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════════════ */
export default function WorkspacePage() {
  const { trackSlug, sectionSlug, exerciseSlug, taskId: exerciseId } = useParams();
  const navigate = useNavigate();

  /* ── Data state ── */
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* ── Levels state ── */
  const [activeTaskIndex, setActiveTaskIndex] = useState(0);
  const [completedTasks, setCompletedTasks] = useState(new Set()); // Store IDs of completed tasks

  /* ── Editor state ── */
  const [code, setCode] = useState("");
  const [filename, setFilename] = useState("script.py");

  /* ── Execution state ── */
  const [output, setOutput] = useState(null);
  const [running, setRunning] = useState(false);

  /* ── UI state ── */
  const [tocOpen, setTocOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [showEmptyWarning, setShowEmptyWarning] = useState(false);
  const [warningMsg, setWarningMsg] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setAvatarUrl(localStorage.getItem("campus404_avatar_url") || "");
  }, []);

  /* ── Load exercise data ── */
  useEffect(() => {
    let disposed = false;
    async function load() {
      if (!exerciseId) { setLoading(false); setError("Missing exercise id."); return; }
      setLoading(true);
      setError("");
      setOutput(null);
      setActiveTaskIndex(0);
      setCompletedTasks(new Set());
      try {
        const [payload, progressPayload] = await Promise.all([
          getExerciseWorkspace(exerciseId),
          getAllTaskProgress().catch(() => []) // gracefully handle errors
        ]);
        if (!disposed) {
          setData(payload);
          
          const completedSet = new Set(
            progressPayload
              .filter(p => p.status === "completed")
              .map(p => p.task_id)
          );
          setCompletedTasks(completedSet);

          const langInfo = getLangInfo(payload.language_id);
          const tasks = payload.tasks || [];
          
          // Determine the first uncompleted task
          let initialIndex = 0;
          for (let i = 0; i < tasks.length; i++) {
            if (!completedSet.has(tasks[i].id)) {
              initialIndex = i;
              break;
            }
          }
          setActiveTaskIndex(initialIndex);

          const task = tasks[initialIndex];
          const parsed = parseStarterCode(task, langInfo);
          setFilename(parsed.filename);
          setCode(parsed.content);
        }
      } catch (err) {
        if (!disposed) setError(err.message || "Unable to load workspace.");
      } finally {
        if (!disposed) setLoading(false);
      }
    }
    load();
    return () => { disposed = true; };
  }, [exerciseId]);

  /* ── Change Level ── */
  function handleTaskSelect(idx) {
    if (!data || !data.tasks || idx < 0 || idx >= data.tasks.length) return;
    setActiveTaskIndex(idx);
    setShowEmptyWarning(false);
    const langInfo = getLangInfo(data.language_id);
    const task = data.tasks[idx];
    const parsed = parseStarterCode(task, langInfo);
    setFilename(parsed.filename);
    setCode(parsed.content);
    setOutput(null);
  }

  /* ── Derived values ── */
  const langInfo = useMemo(() => data ? getLangInfo(data.language_id) : DEFAULT_LANG, [data]);
  const activeTask = data?.tasks?.[activeTaskIndex];
  
  // Exercise-level navigation (siblings)
  const currentExIndex = useMemo(() => {
    if (!data) return 0;
    const idx = data.exercises_in_section.findIndex(e => e.id === data.id);
    return idx >= 0 ? idx : 0;
  }, [data]);
  const totalExercises = data?.total_exercises_in_section || 0;
  const prevExercise = data?.exercises_in_section?.[currentExIndex - 1] || null;
  const nextExercise = data?.exercises_in_section?.[currentExIndex + 1] || null;

  // Track progress over tasks
  const totalTasks = data?.tasks?.length || 1;
  const progress = Math.round((completedTasks.size / totalTasks) * 100);

  /* ── Code execution (Secure) ── */
  async function runCode() {
    if (running || !data || !activeTask) return;

    const langId = detectJudgeLangId(filename, data.language_id);
    
    // Prevent empty or unmodified code submission
    const parsedStarter = parseStarterCode(activeTask, langInfo);
    if (!code.trim() || code.trim() === parsedStarter.content.trim()) {
      setWarningMsg("You need to write some code before executing it.");
      setShowEmptyWarning(true);
      setTimeout(() => setShowEmptyWarning(false), 4500); // Change this number to adjust disappear time (in milliseconds)
      return;
    }

    // Advanced heuristics to block pure garbage syntax ("kkk" etc.)
    if (isLikelyGarbageCode(code, langId)) {
      setWarningMsg("This doesn't look like valid logic. Please write proper syntax before running.");
      setShowEmptyWarning(true);
      setTimeout(() => setShowEmptyWarning(false), 4500); // Change this number to adjust disappear time (in milliseconds)
      return;
    }

    setRunning(true);
    setOutput(null);

    try {
      // We use our protected backend evaluate proxy which checks against hidden test cases.
      const res = await evaluateTask(data.id, activeTask.id, code, langId);
      setOutput(res);

      if (res.verdict === "Accepted") {
        setWarningMsg("Well done! Let's solve the next level.");
        setShowEmptyWarning(true);
      }
    } catch (err) {
      setOutput({ error: err.message, verdict: "Internal Error" });
    } finally {
      setRunning(false);
    }
  }

  function handleSubmit() {
    if (!data || !activeTask || verdict !== "Accepted") return;
    
    setShowEmptyWarning(false);
    
    setCompletedTasks(prev => {
      const next = new Set(prev);
      next.add(activeTask.id);
      return next;
    });

    // Save progress to backend quietly
    saveTaskProgress(activeTask.id).catch(console.error);

    // Optionally auto-advance
    if (activeTaskIndex < totalTasks - 1) {
      handleTaskSelect(activeTaskIndex + 1);
    }
  }

  /* ── Tab key in editor ── */
  function handleTabKey(e) {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const { selectionStart: s, selectionEnd: en } = e.target;
    const next = code.slice(0, s) + "  " + code.slice(en);
    setCode(next);
    requestAnimationFrame(() => {
      e.target.selectionStart = e.target.selectionEnd = s + 2;
    });
  }

  /* ── Navigation ── */
  function goToExercise(ex) {
    if (!ex || !ex.id) return;
    navigate(APP_ROUTES.frontendExerciseWorkspace(trackSlug, sectionSlug, slugify(ex.title), ex.id));
  }

  /* ── Verdict display ── */
  const verdict = output?.verdict;
  const vm = VERDICT_META[verdict] ?? {};

  /* ── Printing ── */
  function handlePrint() {
    if (verdict !== "Accepted") return;
    
    const printWindow = window.open('', '_blank');
    const safeOutput = (output?.output || "Passed all hidden tests successfully!")
      .replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const safeCode = code.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    
    const htmlContent = `
      <html>
        <head>
          <title>Copy/Print - ${data?.title || 'Exercise'}</title>
          <style>
            body { font-family: sans-serif; padding: 30px; color: #333; line-height: 1.6; max-width: 900px; margin: auto; }
            h1 { font-size: 24px; color: #111; margin-bottom: 5px; }
            h2 { font-size: 18px; color: #555; margin-top: 0; font-weight: normal; margin-bottom: 30px; }
            .theory { margin-bottom: 20px; font-size: 15px; }
            .code-block, .output-block { background: #f8f9fa; padding: 15px; border-radius: 6px; font-family: monospace; white-space: pre-wrap; font-size: 13px; border: 1px solid #e9ecef; }
            .section-title { margin-top: 30px; border-bottom: 2px solid #eee; padding-bottom: 8px; font-weight: bold; color: #222; margin-bottom: 15px; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <h1>${data?.track_title || 'Track'} &rsaquo; ${data?.section_title || 'Section'}</h1>
          <h2>${data?.title || 'Exercise'} (Level ${activeTaskIndex + 1})</h2>
          
          <div class="section-title">Theory & Instructions</div>
          <div class="theory">
            ${activeTask?.instructions_md || data?.theory_content || "No instructions provided."}
          </div>
          
          <div class="section-title">Executed Code</div>
          <pre class="code-block">${safeCode}</pre>
          
          <div class="section-title">Execution Output</div>
          <pre class="output-block">${safeOutput}</pre>
          
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }

  /* ══ LOADING STATE ══ */
  if (loading) {
    return (
      <div className="ws-root ws-loading-screen">
        <Loader2 size={32} className="ws-spin" />
        <p>Loading workspace…</p>
      </div>
    );
  }

  /* ══ ERROR STATE ══ */
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

  const fileExt = filename.split(".").pop() || langInfo.ext;

  return (
    <div className="ws-root">
      <div className="ws-mobile-overlay">
        Please rotate your device to horizontal to use the Code Workspace. Desktop experience is highly recommended.
      </div>
      
      {/* ════ POPUP CODE WARNING / SUCCESS ════ */}
      <div className={`ws-empty-warning-popup ${showEmptyWarning ? 'is-visible' : ''}`}>
        <div className="ws-empty-warning-character">
          <img 
            src={verdict === "Accepted" ? successOptopus : settingOptopus} 
            alt="Guide" 
            draggable="false"
            onContextMenu={(e) => e.preventDefault()}
            onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.innerHTML = '🤖'; }} 
          />
        </div>
        <div className="ws-empty-warning-bubble">
          <p><strong>{verdict === "Accepted" ? "Awesome!" : "Hey there!"}</strong> {warningMsg}</p>
          {verdict === "Accepted" && (
            <button 
              className="btn btn-brand" 
              onClick={handleSubmit}
              style={{ marginTop: '10px', fontSize: '0.85rem', padding: '6px 12px' }}
            >
              <Check size={14} style={{ marginRight: '6px' }} /> 
              Next Level
            </button>
          )}
        </div>
      </div>
      {/* ═══════════ TOP HEADER BAR ═══════════ */}
      <header className="ws-header">
        <div className="ws-header-left">
          <Link to={APP_ROUTES.home} className="ws-brand-mark">
            <img src={ASSETS.brand.logo} alt="Campus404" />
          </Link>
          <div className="ws-header-breadcrumb">
            <span className="ws-header-track">{data.track_title}</span>
            <ChevronRight size={12} className="ws-header-sep" />
            <span className="ws-header-section">{data.section_title}</span>
          </div>
        </div>

        <div className="ws-header-center">
          <div className="ws-runtime-status">
            <span className="ws-status-dot"></span>
            <span className="ws-runtime-text">Execution Engine: Ready</span>
          </div>
          <div className="ws-progress-bar">
            <div className="ws-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="ws-progress-text">{progress}%</span>
        </div>

        <div className="ws-header-right">
          <div className="ws-tooltip-wrapper">
            <button className="ws-icon-btn ws-bug-btn">
              <AlertTriangle size={18} />
            </button>
            <span className="ws-custom-tooltip-text">Report an issue</span>
          </div>
          <span className="ws-header-exercise-badge">
            Level {activeTaskIndex + 1}/{totalTasks}
          </span>
          <div className="ws-user-profile" title="User Profile">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <User size={18} />
            )}
          </div>
        </div>
      </header>

      {/* ═══════════ MAIN BODY ═══════════ */}
      <div className="ws-body">

        {/* ─── LEFT PANEL: Theory + Table of Contents ─── */}
        <div className="ws-left-panel">
          <div className="ws-left-scrollable">
            {/* Exercise Label */}
            <div className="ws-exercise-label">{data.title}</div>

            {/* Task/Level Title */}
            <h1 className="ws-exercise-title">
              Level {activeTaskIndex + 1}
            </h1>

            {/* Content: Prefer task instructions, fallback to exercise theory if missing */}
            <div
              className="ws-theory-content"
              dangerouslySetInnerHTML={{ 
                __html: DOMPurify.sanitize(activeTask?.instructions_md || data.theory_content || "") 
              }}
            />
          </div>

          {/* Table of Contents Toggle (Levels) */}
          <div className="ws-toc-section">
            <button
              className="ws-toc-toggle"
              onClick={() => setTocOpen(v => !v)}
            >
              <List size={14} />
              <span>Exercise Levels</span>
              <ChevronRight size={14} className={`ws-toc-chevron ${tocOpen ? "is-open" : ""}`} />
            </button>

            {tocOpen && (
              <div className="ws-toc-list">
                {data.tasks.map((task, idx) => {
                  const isCompleted = completedTasks.has(task.id);
                  const isActive = idx === activeTaskIndex;
                  // Unlock logic: 
                  // The first task is always available (idx === 0). 
                  // A task is unlocked if the immediate previous task is completed.
                  const previousTaskCompleted = idx === 0 || completedTasks.has(data.tasks[idx - 1].id);
                  const isLocked = !isCompleted && !previousTaskCompleted;

                  return (
                    <button
                      key={task.id}
                      className={`ws-toc-item ${isActive ? "is-active" : ""} ${isCompleted ? "is-completed" : ""} ${isLocked ? "is-locked" : ""}`}
                      onClick={() => !isLocked && handleTaskSelect(idx)}
                      disabled={isLocked}
                      title={isLocked ? "Complete previous level to unlock" : ""}
                    >
                      <span className="ws-toc-num">
                        {isCompleted ? <Check size={12} className="ws-check-icon" /> : 
                         isLocked ? <Lock size={12} /> : String(idx + 1).padStart(2, "0")}
                      </span>
                      <span className="ws-toc-name">Level {idx + 1}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ─── RIGHT PANEL: Code Editor + Terminal ─── */}
        <div className="ws-right-panel">
          {/* File Tab */}
          <div className="ws-file-tabs">
            <div className="ws-file-tab is-active">
              <FileIcon ext={fileExt} />
              <span>{filename}</span>
            </div>
            <div className="ws-editor-actions">
              <div className="ws-tooltip-wrapper">
                <button className="ws-icon-btn" onClick={() => {
                  navigator.clipboard.writeText(code);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}>
                  {copied ? <Check size={16} color="var(--state-success)" /> : <Copy size={16} color="var(--text-secondary)" />}
                </button>
                <span className="ws-custom-tooltip-text" style={{ right: 0, left: 'auto' }}>
                  {copied ? "Copied!" : "Copy Code to Clipboard"}
                </span>
              </div>
              <div className="ws-tooltip-wrapper">
                <button 
                  className="ws-icon-btn" 
                  onClick={handlePrint}
                  disabled={verdict !== "Accepted"}
                  style={{ opacity: verdict === "Accepted" ? 1 : 0.4 }}
                >
                  <Printer size={16} color={verdict === "Accepted" ? "var(--accent-primary)" : "var(--text-tertiary)"} />
                </button>
                <span className="ws-custom-tooltip-text" style={{ right: 0, left: 'auto' }}>
                  {verdict === "Accepted" ? "Print Exercise Result & Code" : "Run code successfully to enable printing"}
                </span>
              </div>
            </div>
          </div>

          {/* Code Editor */}
          <div className="ws-editor-area">
            <div className="ws-line-nums" aria-hidden="true">
              {code.split("\n").map((_, i) => (
                <span key={i}>{i + 1}</span>
              ))}
            </div>
            <textarea
              className="ws-editor"
              value={code}
              onChange={e => setCode(e.target.value)}
              onKeyDown={handleTabKey}
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
            />
          </div>

          {/* Editor Toolbar */}
          <div className="ws-editor-toolbar">
            <div className="ws-toolbar-icons">
              {/* Optional decorators */}
            </div>
            <div className="ws-toolbar-actions">
              <button
                className="btn ws-run-btn"
                onClick={runCode}
                disabled={running}
              >
                {running ? <Square size={13} /> : <Play size={13} />}
                {running ? "Checking…" : "Run & Check"}
              </button>
            </div>
          </div>

          {/* Terminal */}
          <div className="ws-terminal">
            <div className="ws-terminal-header">
              <Terminal size={13} />
              <span>Terminal Output</span>
              {verdict && vm.Icon && (
                <span className="ws-terminal-verdict" style={{ color: vm.color }}>
                  <vm.Icon size={12} /> {verdict}
                </span>
              )}
            </div>
            <div className="ws-terminal-body">
              {!running && !output && (
                <div className="ws-terminal-placeholder">
                  <div className="ws-terminal-placeholder-icon">&gt;_</div>
                  <p>Click <strong>Run & Check</strong> to evaluate against test cases.</p>
                </div>
              )}

              {running && (
                <div className="ws-terminal-running">
                  <Loader2 size={18} className="ws-spin" />
                  <p>Running code over all test cases…</p>
                </div>
              )}

              {!running && output && (
                <div className="ws-terminal-result">
                  {verdict !== "Accepted" && verdict && (
                    <div className="ws-terminal-verdict-large" style={{ color: vm.color, fontWeight: '700', fontSize: '1.2rem', marginBottom: '8px' }}>
                      {verdict}
                    </div>
                  )}
                  {verdict !== "Accepted" && output.passed_cases !== undefined && (
                    <div className="ws-terminal-cases-meta">
                      Passed {output.passed_cases} out of {output.total_cases} test cases.
                    </div>
                  )}

                  {output.output && (
                    <div className="ws-terminal-output-block">
                      <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-tertiary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your Console Output</div>
                      <pre className="ws-terminal-stdout">{output.output}</pre>
                    </div>
                  )}
                  {output.error && (
                    <div className="ws-terminal-error-block">
                      <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-tertiary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Error</div>
                      <pre className="ws-terminal-stderr">{output.error}</pre>
                    </div>
                  )}
                  {!output.output && !output.error && !output.passed && (
                     <pre className="ws-terminal-stderr">Check your logic. Output did not match expected hidden test case.</pre>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════ BOTTOM FOOTER BAR (Exercise Navigation) ═══════════ */}
      <footer className="ws-footer">
        <div className="ws-footer-left">
          <span className="ws-footer-level">{data.section_title}</span>
          <span className="ws-footer-exercise-info">
            Exercise {currentExIndex + 1} / {totalExercises}
          </span>
        </div>
        <div className="ws-footer-right">
          <button
            className="btn btn-ghost ws-nav-back"
            onClick={() => navigate(APP_ROUTES.frontendTrackOverview(trackSlug))}
          >
            <ChevronLeft size={14} />
            Back to Track
          </button>
          
          <button
            className="btn btn-brand ws-nav-next"
            onClick={() => goToExercise(nextExercise)}
            disabled={!nextExercise || progress < 100}
            title={progress < 100 ? "Complete all levels to unlock" : ""}
          >
            {progress < 100 && <Lock size={12} style={{ marginRight: '6px' }} />}
            Next Exercise
            <ChevronRight size={14} />
          </button>
        </div>
      </footer>
    </div>
  );
}
