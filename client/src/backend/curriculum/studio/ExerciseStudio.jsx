import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  GripVertical,
  FileCode2,
  FilePlus,
  BookOpen,
  Code2,
  FlaskConical,
  Check,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  X,
  Play,
  Zap,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Editor from "@monaco-editor/react";
import { getTasks, bulkSaveTasks, deleteTask } from "../../../shared/curriculumApi.js";
import { apiUrl } from "../../../shared/api.js";
import "./ExerciseStudio.css";

import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import MediaPickerModal from "../../media/components/MediaPickerModal.jsx";

//      Helpers                                                                   

let _uid = 0;
function uid() { return `_new_${++_uid}`; }

function makeBlankTask(stepNumber) {
  return {
    _localId: uid(),
    id: null,
    step_number: stepNumber,
    instructions_md: `# Level ${stepNumber}\n\nWrite your instructions here.`,
    files: [{ filename: "main.py", content: "# Write your code here\n", is_main: true }],
    test_cases: [{ input: "", expected_outputs: [""], match_mode: "normalize" }],
    solution_code: "",
  };
}

function normalizeTask(raw, stepNumber) {
  let files;
  try {
    files = raw.starter_code ? JSON.parse(raw.starter_code) : null;
  } catch {
    files = null;
  }
  if (!Array.isArray(files)) {
    files = [{ filename: "main.py", content: raw.starter_code || "", is_main: true }];
  }

  let testCases = raw.test_cases ?? [];
  if (!Array.isArray(testCases)) {
    try { testCases = JSON.parse(testCases); } catch { testCases = []; }
  }

  // Migrate old {expected_output}  †’ new {expected_outputs, match_mode}
  testCases = testCases.map((tc) => ({
    input: tc.input ?? "",
    expected_outputs: tc.expected_outputs ?? (tc.expected_output ? [tc.expected_output] : [""]),
    match_mode: tc.match_mode ?? "normalize",
  }));

  return {
    _localId: String(raw.id),
    id: raw.id,
    step_number: stepNumber ?? raw.step_number ?? 1,
    instructions_md: raw.instructions_md ?? "",
    files,
    test_cases: testCases.length > 0 ? testCases : [{ input: "", expected_outputs: [""], match_mode: "normalize" }],
    solution_code: raw.solution_code ?? "",
  };
}

//      Sortable Level Item                                                        

function SortableLevelItem({ task, index, isActive, onClick, onDelete, canDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task._localId,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`es-level-item ${isActive ? "es-level-item--active" : ""} ${isDragging ? "es-level-item--dragging" : ""}`}
      onClick={onClick}
    >
      <button
        className="es-level-drag"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        aria-label="Drag to reorder"
      >
        <GripVertical size={14} />
      </button>
      <span className="es-level-label">Level {index + 1}</span>
      {canDelete && (
        <button
          className="es-level-delete"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          aria-label="Delete level"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

//      Theory Tab                                                                

function TheoryTab({ value, onChange }) {
  const quillRef = useRef(null);
  const [showMediaPicker, setShowMediaPicker] = useState(false);

  const modules = useMemo(
    () => ({
      toolbar: {
        container: [
          [{ header: [1, 2, 3, false] }],
          ["bold", "italic", "underline", "strike", "blockquote", "code-block"],
          [{ color: [] }, { background: [] }],
          [{ align: [] }],
          [{ list: "ordered" }, { list: "bullet" }],
          ["link", "image"],
          ["clean"],
        ],
        handlers: {
          image: function () {
            setShowMediaPicker(true);
          },
        },
      },
    }),
    []
  );

  function handleMediaSelect(item) {
    if (item && item.url) {
      const editor = quillRef.current.getEditor();
      const range = editor.getSelection() ?? { index: editor.getLength() };
      editor.insertEmbed(range.index, "image", item.url);
      editor.setSelection(range.index + 1);
    }
    setShowMediaPicker(false);
  }

  function handleInsertHint() {
    const editor = quillRef.current.getEditor();
    const range = editor.getSelection() ?? { index: editor.getLength() };
    editor.clipboard.dangerouslyPasteHTML(
      range.index,
      `<div class="cfm-hint-box" style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px;margin-bottom:12px;border-radius:4px;">&#128161; <strong>Hint:</strong> Provide your hint here...</div><p><br/></p>`
    );
  }

  function handleInsertRepo() {
    const url = prompt("Enter GitHub Repository Link:");
    if (url) {
      const editor = quillRef.current.getEditor();
      const range = editor.getSelection() ?? { index: editor.getLength() };
      editor.clipboard.dangerouslyPasteHTML(
        range.index,
        `<div class="cfm-repo-box" style="background:#f1f5f9;border-left:4px solid #475569;padding:12px;margin-bottom:12px;border-radius:4px;">&#128230; <strong>Reference Repo:</strong> <a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a></div><p><br/></p>`
      );
    }
  }

  return (
    <div className="es-theory">
      <div className="es-theory-toolbar">
        <span className="es-theory-hint">Advanced Rich Text Editor</span>
        <div style={{ display: "flex", gap: "8px" }}>
          <button type="button" className="es-preview-toggle" onClick={handleInsertHint}>
            + Hint Box
          </button>
          <button type="button" className="es-preview-toggle" onClick={handleInsertRepo}>
            + Repo Box
          </button>
        </div>
      </div>

      <div className="es-theory-quill-wrapper">
        <ReactQuill
          ref={quillRef}
          theme="snow"
          value={value}
          onChange={(html) => onChange(html)}
          modules={modules}
          placeholder="Write your level theory and instructions here..."
        />
      </div>

      {showMediaPicker && (
        <MediaPickerModal
          isOpen={showMediaPicker}
          onClose={() => setShowMediaPicker(false)}
          onSelect={handleMediaSelect}
        />
      )}
    </div>
  );
}

//      Workspace Tab                                                              

function WorkspaceTab({ files, onChange }) {
  const [activeFile, setActiveFile] = useState(0);
  const [newFilename, setNewFilename] = useState("");
  const [addingFile, setAddingFile] = useState(false);

  const activeIndex = Math.min(activeFile, files.length - 1);
  const currentFile = files[activeIndex] ?? files[0];

  function updateFileContent(content) {
    const updated = files.map((f, i) => (i === activeIndex ? { ...f, content } : f));
    onChange(updated);
  }

  function addFile() {
    const name = newFilename.trim() || "new_file.py";
    if (files.some((f) => f.filename === name)) return;
    const updated = [...files, { filename: name, content: "", is_main: false }];
    onChange(updated);
    setActiveFile(updated.length - 1);
    setAddingFile(false);
    setNewFilename("");
  }

  function removeFile(idx) {
    if (files.length <= 1) return;
    const updated = files.filter((_, i) => i !== idx);
    setActiveFile(Math.max(0, activeIndex - 1));
    onChange(updated);
  }

  function getLanguage(filename) {
    if (filename.endsWith(".py")) return "python";
    if (filename.endsWith(".js")) return "javascript";
    if (filename.endsWith(".ts")) return "typescript";
    if (filename.endsWith(".java")) return "java";
    if (filename.endsWith(".cpp") || filename.endsWith(".c")) return "cpp";
    if (filename.endsWith(".json")) return "json";
    if (filename.endsWith(".html")) return "html";
    if (filename.endsWith(".css")) return "css";
    return "plaintext";
  }

  return (
    <div className="es-workspace">
      {/* File Tree */}
      <div className="es-file-tree">
        <div className="es-file-tree-header">FILES</div>
        <div className="es-file-list">
          {files.map((f, i) => (
            <div
              key={f.filename}
              className={`es-file-item ${i === activeIndex ? "es-file-item--active" : ""}`}
              onClick={() => setActiveFile(i)}
            >
              <FileCode2 size={13} className="es-file-icon" />
              <span className="es-file-name">{f.filename}</span>
              {files.length > 1 && (
                <button
                  className="es-file-remove"
                  onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                  title="Remove file"
                >
                  <X size={10} />
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="es-file-add-area">
          {addingFile ? (
            <div className="es-file-add-input">
              <input
                autoFocus
                value={newFilename}
                onChange={(e) => setNewFilename(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addFile(); if (e.key === "Escape") setAddingFile(false); }}
                placeholder="filename.py"
              />
              <button onClick={addFile}><Check size={12} /></button>
              <button onClick={() => setAddingFile(false)}><X size={12} /></button>
            </div>
          ) : (
            <button className="es-file-add-btn" onClick={() => setAddingFile(true)}>
              <FilePlus size={13} /> Add File
            </button>
          )}
        </div>
      </div>

      {/* Monaco Editor */}
      <div className="es-monaco-pane">
        <div className="es-monaco-header">
          <span className="es-monaco-filename">{currentFile?.filename}</span>
        </div>
        <div className="es-monaco-editor">
          <Editor
            height="100%"
            language={getLanguage(currentFile?.filename ?? "main.py")}
            value={currentFile?.content ?? ""}
            onChange={(val) => updateFileContent(val ?? "")}
            theme="vs-dark"
            options={{
              fontSize: 13,
              fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              lineNumbers: "on",
              renderLineHighlight: "gutter",
              tabSize: 4,
              wordWrap: "on",
              padding: { top: 12, bottom: 12 },
            }}
          />
        </div>
      </div>
    </div>
  );
}

//      Evaluation Tab                                                            
// Admin-only. Never rendered on the student side.

const MATCH_MODES = [
  { value: "normalize", label: "Smart match", desc: "Strips whitespace, ignores case" },
  { value: "exact",     label: "Exact",       desc: "Byte-for-byte match" },
  { value: "any_of",   label: "Any of",      desc: "Pass if output matches any accepted value" },
];

const LANG_EXT = {
  ".py": 71, ".js": 63, ".ts": 74, ".java": 62,
  ".cpp": 54, ".c": 50, ".go": 60, ".rb": 72, ".rs": 73,
};

function detectLangId(files) {
  const main = files?.find((f) => f.is_main) ?? files?.[0];
  if (!main) return 71;
  const ext = Object.keys(LANG_EXT).find((e) => main.filename.endsWith(e));
  return LANG_EXT[ext] ?? 71;
}

async function judgeRun(sourceCode, languageId, stdin) {
  const payload = { source_code: sourceCode, language_id: languageId, stdin: stdin || undefined };
  const res = await fetch(apiUrl("/api/v1/judge/submissions"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`Judge error ${res.status}: ${msg}`);
  }
  const { job_id } = await res.json();
  const pollUrl = apiUrl(`/api/v1/judge/submissions/${job_id}`);
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const p = await fetch(pollUrl).catch(() => null);
    if (!p?.ok) continue;
    const r = await p.json();
    if (r.status === "completed" || r.verdict) return r;
  }
  throw new Error("Judge timed out (20s). Check if the judge service is running.");
}

//     Run Code Popup (admin-only)                                                 

function RunCodeModal({ testCases, onApply, onClose }) {
  const [code, setCode] = useState("");
  const [langId, setLangId] = useState(71);
  const [results, setResults] = useState([]); // per-case: { output, verdict, error }
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState("");

  const hasResults = results.some((r) => r);

  async function handleRun() {
    if (!code.trim()) return;
    setRunning(true);
    setRunError("");
    setResults([]);
    const next = [];
    try {
      for (const tc of testCases) {
        const r = await judgeRun(code, langId, tc.input || null);
        next.push({ output: (r.output ?? "").trim(), verdict: r.verdict, error: r.error });
      }
      setResults(next);
    } catch (err) {
      setRunError(err.message);
    } finally {
      setRunning(false);
    }
  }

  function handleApply() {
    onApply(results);
    onClose();
  }

  return (
    <div className="rcm-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="rcm-modal">
        <div className="rcm-header">
          <div className="rcm-header-text">
            <span className="rcm-title">Run Solution Code</span>
            <span className="rcm-subtitle">Paste your solution  €” the judge will run it against every test case input</span>
          </div>
          <button className="rcm-close" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>

        <div className="rcm-body">
          {/* Code input */}
          <div className="rcm-code-section">
            <div className="rcm-code-toolbar">
              <label className="rcm-label">Solution Code</label>
              <select
                className="rcm-lang-select"
                value={langId}
                onChange={(e) => setLangId(Number(e.target.value))}
              >
                <option value={71}>Python 3</option>
                <option value={63}>JavaScript</option>
                <option value={74}>TypeScript</option>
                <option value={62}>Java</option>
                <option value={54}>C++</option>
                <option value={50}>C</option>
                <option value={60}>Go</option>
              </select>
            </div>
            <div className="rcm-editor-wrapper" style={{ height: "300px", borderRadius: "8px", overflow: "hidden", border: "1px solid #3f3f46" }}>
              <Editor
                height="100%"
                language={
                  langId === 71 ? "python" :
                  langId === 63 ? "javascript" :
                  langId === 74 ? "typescript" :
                  langId === 62 ? "java" :
                  langId === 54 || langId === 50 ? "cpp" :
                  langId === 60 ? "go" : "plaintext"
                }
                theme="vs-dark"
                value={code}
                onChange={(value) => setCode(value || "")}
                options={{
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 14,
                }}
              />
            </div>
          </div>

          {/* Test case results */}
          {testCases.length > 0 && (
            <div className="rcm-cases">
              <span className="rcm-label">Test Case Results ({testCases.length} cases)</span>
              <div className="rcm-cases-list">
                {testCases.map((tc, i) => {
                  const r = results[i];
                  return (
                    <div key={i} className={`rcm-case ${r ? (r.verdict === "Accepted" || !r.error ? "rcm-case--ok" : "rcm-case--err") : ""}`}>
                      <div className="rcm-case-header">
                        <span className="rcm-case-num">#{i + 1}</span>
                        {tc.input && <code className="rcm-case-input">stdin: {tc.input.slice(0, 40)}</code>}
                        {r && (
                          <span className={`rcm-case-verdict rcm-verdict--${r.verdict === "Accepted" ? "ok" : "err"}`}>
                            {r.verdict}
                          </span>
                        )}
                      </div>
                      {r && (
                        <div className="rcm-case-output">
                          {r.output && <div className="rcm-output-code" style={{ whiteSpace: "pre-wrap", marginBottom: r.error ? "8px" : "0" }}>{r.output}</div>}
                          {r.error && <div className="rcm-output-err" style={{ whiteSpace: "pre-wrap" }}>{r.error}</div>}
                          {!r.output && !r.error && <div className="rcm-output-code" style={{ opacity: 0.5 }}>(no output)</div>}
                        </div>
                      )}
                      {!r && running && <div className="rcm-case-pending">Running €¦</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Error banner */}
        {runError && (
          <div className="rcm-error-bar">
            <AlertCircle size={14} />
            {runError}
          </div>
        )}

        <div className="rcm-footer">
          <button className="rcm-btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="rcm-btn-run"
            onClick={handleRun}
            disabled={running || !code.trim()}
          >
            {running ? <Loader2 size={14} className="es-spin" /> : <Play size={14} />}
            {running ? "Running €¦" : " –¶  Run"}
          </button>
          {hasResults && (
            <button className="rcm-btn-apply" onClick={handleApply}>
              <Check size={14} /> Apply Outputs to Test Cases
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

//Evaluation Tab   

function EvaluationTab({ testCases, onChange }) {
  const [showModal, setShowModal] = useState(false);

  function updateCase(idx, field, value) {
    onChange(testCases.map((tc, i) => (i === idx ? { ...tc, [field]: value } : tc)));
  }

  function updateOutput(tcIdx, outIdx, value) {
    onChange(testCases.map((tc, i) => {
      if (i !== tcIdx) return tc;
      const outs = [...(tc.expected_outputs ?? [""])];
      outs[outIdx] = value;
      return { ...tc, expected_outputs: outs };
    }));
  }

  function addOutput(tcIdx) {
    onChange(testCases.map((tc, i) =>
      i === tcIdx ? { ...tc, expected_outputs: [...(tc.expected_outputs ?? [""]), ""] } : tc
    ));
  }

  function removeOutput(tcIdx, outIdx) {
    onChange(testCases.map((tc, i) => {
      if (i !== tcIdx) return tc;
      const outs = (tc.expected_outputs ?? [""]).filter((_, j) => j !== outIdx);
      return { ...tc, expected_outputs: outs.length > 0 ? outs : [""] };
    }));
  }

  function addCase() {
    onChange([...testCases, { input: "", expected_outputs: [""], match_mode: "normalize" }]);
  }

  function removeCase(idx) {
    if (testCases.length <= 1) return;
    onChange(testCases.filter((_, i) => i !== idx));
  }

  function handleApplyResults(results) {
    onChange(testCases.map((tc, i) => {
      const r = results[i];
      if (!r || r.error || !r.output) return tc;
      return { ...tc, expected_outputs: [r.output] };
    }));
  }

  return (
    <div className="es-evaluation">
      <div className="es-eval-toolbar">
        <div>
          <span className="es-eval-title">Test Cases</span>
          <span className="es-eval-subtitle">Hidden from students  €” judge runs each input and checks the output</span>
        </div>
        <button
          className="es-run-icon-btn"
          onClick={() => setShowModal(true)}
          title="Run your solution code to auto-fill expected outputs"
          aria-label="Run solution"
        >
          <Play size={14} /> Run
        </button>
      </div>

      <div className="es-testcase-list">
        {testCases.map((tc, idx) => (
          <div key={idx} className="es-tc-card">
            <div className="es-tc-card-meta">
              <span className="es-tc-num">#{idx + 1}</span>
              <select
                className="es-tc-mode"
                value={tc.match_mode ?? "normalize"}
                onChange={(e) => updateCase(idx, "match_mode", e.target.value)}
                title="Output matching strategy"
              >
                {MATCH_MODES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              {testCases.length > 1 && (
                <button className="es-tc-del" onClick={() => removeCase(idx)} title="Delete test case" aria-label="Delete">
                  <Trash2 size={13} />
                </button>
              )}
            </div>

            <div className="es-tc-section">
              <label className="es-tc-label">Input <span className="es-tc-label-sub">stdin</span></label>
              <textarea
                className="es-tc-textarea"
                value={tc.input ?? ""}
                onChange={(e) => updateCase(idx, "input", e.target.value)}
                placeholder="Leave blank if program takes no input"
                rows={2}
                spellCheck={false}
              />
            </div>

            <div className="es-tc-section">
              <label className="es-tc-label">
                Accepted Output <span className="es-tc-label-sub">any match = pass</span>
              </label>
              <div className="es-tc-outputs">
                {(tc.expected_outputs ?? [""]).map((out, outIdx) => (
                  <div key={outIdx} className="es-tc-output-row">
                    <textarea
                      className="es-tc-textarea"
                      value={out}
                      onChange={(e) => updateOutput(idx, outIdx, e.target.value)}
                      placeholder="Expected output €¦"
                      rows={2}
                      spellCheck={false}
                    />
                    {(tc.expected_outputs?.length ?? 1) > 1 && (
                      <button className="es-tc-output-del" onClick={() => removeOutput(idx, outIdx)} title="Remove" aria-label="Remove">
                        <X size={11} />
                      </button>
                    )}
                  </div>
                ))}
                <button className="es-tc-add-output" onClick={() => addOutput(idx)}>
                  <Plus size={11} /> Add alternative
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button className="es-add-testcase-btn" onClick={addCase}>
        <Plus size={13} /> Add Test Case
      </button>

      <div className="es-eval-note">
        <Zap size={11} />
        Infinite loops are killed after 5 s  €” verdict: <code>Time Limit Exceeded</code>
      </div>

      {showModal && (
        <RunCodeModal
          testCases={testCases}
          onApply={handleApplyResults}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

//      Level Editor (Tabs)                                                        

const TABS = [
  { key: "theory", label: "Theory & Instructions", icon: BookOpen },
  { key: "workspace", label: "Workspace", icon: Code2 },
  { key: "evaluation", label: "Evaluation", icon: FlaskConical },
];

function LevelEditor({ task, onChange }) {
  const [activeTab, setActiveTab] = useState("theory");

  function updateInstructions(val) {
    onChange({ ...task, instructions_md: val });
  }
  function updateFiles(val) {
    onChange({ ...task, files: val });
  }
  function updateTestCases(val) {
    onChange({ ...task, test_cases: val });
  }

  return (
    <div className="es-level-editor">
      {/* Tab Bar */}
      <div className="es-tab-bar">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            className={`es-tab-btn ${activeTab === key ? "es-tab-btn--active" : ""}`}
            onClick={() => setActiveTab(key)}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="es-tab-content">
        {activeTab === "theory" && (
          <TheoryTab value={task.instructions_md} onChange={updateInstructions} />
        )}
        {activeTab === "workspace" && (
          <WorkspaceTab files={task.files} onChange={updateFiles} />
        )}
        {activeTab === "evaluation" && (
          <EvaluationTab
            testCases={task.test_cases}
            onChange={updateTestCases}
            solutionFiles={task.files}
          />
        )}
      </div>
    </div>
  );
}

//      Main Studio                                                                

export default function ExerciseStudio({ exerciseId, exerciseTitle, onBack }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedLocalId, setSelectedLocalId] = useState(null);
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved | error
  const saveTimerRef = useRef(null);

  // DnD sensors
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // Load tasks on mount
  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getTasks(exerciseId);
        const sorted = (data ?? []).sort((a, b) => a.step_number - b.step_number);
        const normalized = sorted.map((t, i) => normalizeTask(t, i + 1));
        setTasks(normalized);
        if (normalized.length > 0) setSelectedLocalId(normalized[0]._localId);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [exerciseId]);

  // Update a task in state
  const updateTask = useCallback((localId, updated) => {
    setTasks((prev) => prev.map((t) => (t._localId === localId ? updated : t)));
  }, []);

  // Add a new level
  function addLevel() {
    const next = makeBlankTask(tasks.length + 1);
    setTasks((prev) => [...prev, next]);
    setSelectedLocalId(next._localId);
  }

  // Delete a level (persisted tasks are deleted via API; new ones just removed from state)
  async function deleteLevel(localId) {
    const task = tasks.find((t) => t._localId === localId);
    if (!task) return;

    if (task.id) {
      try {
        await deleteTask(task.id);
      } catch (err) {
        setError("Failed to delete level: " + err.message);
        return;
      }
    }

    const remaining = tasks.filter((t) => t._localId !== localId).map((t, i) => ({ ...t, step_number: i + 1 }));
    setTasks(remaining);

    if (selectedLocalId === localId) {
      setSelectedLocalId(remaining.length > 0 ? remaining[0]._localId : null);
    }
  }

  // DnD reorder
  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setTasks((prev) => {
      const oldIdx = prev.findIndex((t) => t._localId === active.id);
      const newIdx = prev.findIndex((t) => t._localId === over.id);
      const reordered = arrayMove(prev, oldIdx, newIdx);
      return reordered.map((t, i) => ({ ...t, step_number: i + 1 }));
    });
  }

  // Save all
  async function handleSave() {
    setSaveStatus("saving");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    try {
      await bulkSaveTasks(exerciseId, tasks);
      // Reload to get real IDs for newly created tasks
      const data = await getTasks(exerciseId);
      const sorted = (data ?? []).sort((a, b) => a.step_number - b.step_number);
      setTasks(sorted.map((t, i) => normalizeTask(t, i + 1)));
      setSaveStatus("saved");
      saveTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2500);
    } catch (err) {
      setError(err.message);
      setSaveStatus("error");
      saveTimerRef.current = setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }

  const activeTask = tasks.find((t) => t._localId === selectedLocalId) ?? null;

  return (
    <div className="es-root">
      {/*     Top Header                                                    */}
      <div className="es-topbar">
        <button className="es-back-btn" onClick={onBack} title="Back to exercises">
          <ArrowLeft size={16} /> Exercises
        </button>
        <div className="es-topbar-center">
          <span className="es-topbar-editing">Editing:</span>
          <span className="es-topbar-title">{exerciseTitle}</span>
        </div>
        <div className="es-topbar-actions">
          {error && (
            <span className="es-save-error">
              <AlertCircle size={14} /> {error}
            </span>
          )}
          <button
            className={`es-save-btn ${saveStatus === "saved" ? "es-save-btn--saved" : ""} ${saveStatus === "error" ? "es-save-btn--error" : ""}`}
            onClick={handleSave}
            disabled={saveStatus === "saving" || tasks.length === 0}
          >
            {saveStatus === "saving" ? (
              <><Loader2 size={15} className="es-spin" /> Saving €¦</>
            ) : saveStatus === "saved" ? (
              <><Check size={15} /> Saved</>
            ) : (
              <><Save size={15} /> Save Exercise</>
            )}
          </button>
        </div>
      </div>

      {/*     Body                                                          */}
      {loading ? (
        <div className="es-loading">
          <Loader2 size={28} className="es-spin" />
          <span>Loading exercise €¦</span>
        </div>
      ) : (
        <div className="es-body">
          {/* Left Sidebar  €” Levels */}
          <div className="es-sidebar">
            <div className="es-sidebar-header">LEVELS</div>
            <div className="es-sidebar-list">
              {tasks.length === 0 ? (
                <p className="es-sidebar-empty">No levels yet. Add one below.</p>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={tasks.map((t) => t._localId)} strategy={verticalListSortingStrategy}>
                    {tasks.map((task, idx) => (
                      <SortableLevelItem
                        key={task._localId}
                        task={task}
                        index={idx}
                        isActive={selectedLocalId === task._localId}
                        onClick={() => setSelectedLocalId(task._localId)}
                        onDelete={() => deleteLevel(task._localId)}
                        canDelete={tasks.length > 1}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </div>
            <button className="es-add-level-btn" onClick={addLevel}>
              <Plus size={14} /> Add Level
            </button>
          </div>

          {/* Main Editor Area */}
          <div className="es-main">
            {!activeTask ? (
              <div className="es-main-empty">
                <BookOpen size={40} strokeWidth={1.2} />
                <p>Select a level from the sidebar, or add one to get started.</p>
              </div>
            ) : (
              <LevelEditor
                key={activeTask._localId}
                task={activeTask}
                onChange={(updated) => updateTask(activeTask._localId, updated)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
