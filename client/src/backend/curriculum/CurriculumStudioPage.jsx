import { Editor } from "@monaco-editor/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Code2,
  Eye,
  FileCode2,
  FlaskConical,
  FolderTree,
  Image,
  Layers3,
  Lightbulb,
  Loader2,
  Plus,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import {
  checkTrackPublish,
  createExercise,
  createSection,
  createTrack,
  getCurriculumTree,
  getExerciseStudio,
  previewExerciseStudio,
  saveExerciseStudio,
  validateExerciseStudio,
} from "../../shared/curriculumApi.js";
import MediaPickerModal from "../media/components/MediaPickerModal.jsx";
import "./CurriculumStudioPage.css";

const MODE_OPTIONS = [
  ["code", "Code"],
  ["multi_file_code", "Multi-file"],
  ["frontend_preview", "Frontend preview"],
  ["theory", "Theory"],
  ["quiz", "Quiz"],
  ["project", "Project"],
];

const TABS = [
  ["basics", "Basics", Layers3],
  ["lesson", "Lesson", BookOpen],
  ["files", "Files", FileCode2],
  ["validation", "Validation", FlaskConical],
  ["quiz", "Quiz", CheckCircle2],
  ["hints", "Hints", Lightbulb],
  ["rewards", "Rewards", Award],
];

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function languageForPath(path = "") {
  const lower = path.toLowerCase();
  if (lower.endsWith(".py")) return "python";
  if (lower.endsWith(".html")) return "html";
  if (lower.endsWith(".css")) return "css";
  if (lower.endsWith(".js")) return "javascript";
  if (lower.endsWith(".ts")) return "typescript";
  if (lower.endsWith(".java")) return "java";
  if (lower.endsWith(".cpp") || lower.endsWith(".c")) return "cpp";
  return "plaintext";
}

function editorLanguage(path = "", language = "") {
  if (language && language !== "plaintext") return language === "javascript" ? "javascript" : language;
  return languageForPath(path);
}

function defaultFiles(mode) {
  if (mode === "frontend_preview") {
    return [
      { file_path: "index.html", language: "html", starter_code: "<main>\n  <h1>Campus404</h1>\n</main>\n", solution_code: "", is_entrypoint: true, is_editable: true, order: 1 },
      { file_path: "styles.css", language: "css", starter_code: "body {\n  font-family: system-ui;\n}\n", solution_code: "", is_entrypoint: false, is_editable: true, order: 2 },
      { file_path: "script.js", language: "javascript", starter_code: "", solution_code: "", is_entrypoint: false, is_editable: true, order: 3 },
    ];
  }
  return [
    { file_path: "main.py", language: "python", starter_code: "# Write your code here\n", solution_code: "", is_entrypoint: true, is_editable: true, order: 1 },
  ];
}

function defaultDraft(mode = "code") {
  return {
    exercise: {
      title: "",
      slug: "",
      mode,
      order: 1,
      theory_content: "",
      instructions_md: "",
      xp_reward: 20,
      unlock_rule: "previous_completed",
      reference_solution_url: "",
      docs_url: "",
      passing_score_pct: 70,
      attempts_allowed: null,
      validation_config: {},
      auto_submit_on_pass: false,
      is_published: false,
    },
    files: defaultFiles(mode),
    test_cases: [
      { label: "Visible check", stdin: "", expected_stdout: "", expected_outputs: [], match_mode: "normalize", is_hidden: false, timeout_ms: 5000, memory_limit_mb: 128, custom_judge_options: {}, order: 1 },
    ],
    hints: [],
    quiz: { passing_score_pct: 70, attempts_allowed: null, questions: [] },
  };
}

function normalizeDraft(payload) {
  const exercise = payload?.exercise || {};
  const mode = exercise.mode || "code";
  return {
    exercise: {
      title: exercise.title || "",
      slug: exercise.slug || "",
      mode,
      order: exercise.order || 1,
      theory_content: exercise.theory_content || "",
      instructions_md: exercise.instructions_md || "",
      xp_reward: exercise.xp_reward ?? 20,
      unlock_rule: exercise.unlock_rule || "previous_completed",
      reference_solution_url: exercise.reference_solution_url || "",
      docs_url: exercise.docs_url || "",
      passing_score_pct: exercise.passing_score_pct ?? 70,
      attempts_allowed: exercise.attempts_allowed ?? null,
      validation_config: exercise.validation_config || {},
      auto_submit_on_pass: Boolean(exercise.auto_submit_on_pass),
      is_published: Boolean(exercise.is_published),
    },
    files: (exercise.files?.length ? exercise.files : defaultFiles(mode)).map((file, index) => ({
      file_path: file.file_path || `file-${index + 1}.txt`,
      language: file.language || languageForPath(file.file_path),
      starter_code: file.starter_code || "",
      solution_code: file.solution_code || "",
      is_entrypoint: Boolean(file.is_entrypoint),
      is_editable: file.is_editable !== false,
      order: file.order || index + 1,
    })),
    test_cases: (exercise.test_cases || []).map((testCase, index) => ({
      label: testCase.label || `Check ${index + 1}`,
      stdin: testCase.stdin || "",
      expected_stdout: testCase.expected_stdout || "",
      expected_outputs: testCase.expected_outputs || [],
      match_mode: testCase.match_mode || "normalize",
      is_hidden: Boolean(testCase.is_hidden),
      timeout_ms: testCase.timeout_ms ?? 5000,
      memory_limit_mb: testCase.memory_limit_mb ?? 128,
      custom_judge_options: testCase.custom_judge_options || {},
      order: testCase.order || index + 1,
    })),
    hints: (exercise.hints || []).map((hint, index) => ({
      content_md: hint.content_md || "",
      unlock_rule: hint.unlock_rule || "after_failed_run",
      penalty_xp: hint.penalty_xp ?? null,
      order: hint.order || index + 1,
    })),
    quiz: {
      passing_score_pct: exercise.passing_score_pct ?? 70,
      attempts_allowed: exercise.attempts_allowed ?? null,
      questions: (exercise.quiz_questions || []).map((question, index) => ({
        question_text: question.question_text || "",
        question_type: question.question_type || "multiple_choice",
        code_snippet: question.code_snippet || "",
        explanation_md: question.explanation_md || "",
        order: question.order || index + 1,
        options: (question.options || []).map((option, optionIndex) => ({
          option_text: option.option_text || "",
          is_correct: Boolean(option.is_correct),
          explanation_md: option.explanation_md || "",
          order: option.order || optionIndex + 1,
        })),
      })),
    },
  };
}

function previewSrcDoc(files) {
  const byPath = Object.fromEntries((files || []).map((file) => [file.file_path.toLowerCase(), file.starter_code || ""]));
  const html = byPath["index.html"] || "";
  const css = byPath["styles.css"] || byPath["style.css"] || "";
  const js = byPath["script.js"] || byPath["main.js"] || "";
  return `<!doctype html><html><head><style>${css}</style></head><body>${html}<script>${js}</script></body></html>`;
}

function parseJsonBlock(value, fallback, label) {
  if (!String(value || "").trim()) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`${label} must be valid JSON.`);
  }
}

export default function CurriculumStudioPage() {
  const [tree, setTree] = useState([]);
  const [treeFilter, setTreeFilter] = useState("");
  const [selectedTrackId, setSelectedTrackId] = useState(null);
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [selectedExerciseId, setSelectedExerciseId] = useState(null);
  const [studio, setStudio] = useState(null);
  const [draft, setDraft] = useState(defaultDraft());
  const [activeTab, setActiveTab] = useState("basics");
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [validationConfigText, setValidationConfigText] = useState("{}");
  const [newTrackTitle, setNewTrackTitle] = useState("");
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newExerciseTitle, setNewExerciseTitle] = useState("");
  const [newExerciseMode, setNewExerciseMode] = useState("code");
  const [loadingTree, setLoadingTree] = useState(true);
  const [loadingStudio, setLoadingStudio] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState(null);
  const [publishCheck, setPublishCheck] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showMediaPicker, setShowMediaPicker] = useState(false);

  const selectedTrack = useMemo(() => tree.find((track) => Number(track.id) === Number(selectedTrackId)) || null, [tree, selectedTrackId]);
  const selectedSection = useMemo(() => {
    for (const track of tree) {
      const section = (track.sections || []).find((item) => Number(item.id) === Number(selectedSectionId));
      if (section) return section;
    }
    return null;
  }, [tree, selectedSectionId]);

  const filteredTree = useMemo(() => {
    const query = treeFilter.trim().toLowerCase();
    if (!query) return tree;
    return tree
      .map((track) => ({
        ...track,
        sections: (track.sections || [])
          .map((section) => ({
            ...section,
            exercises: (section.exercises || []).filter((exercise) => `${exercise.title} ${exercise.mode}`.toLowerCase().includes(query)),
          }))
          .filter((section) => `${section.title}`.toLowerCase().includes(query) || section.exercises.length > 0),
      }))
      .filter((track) => `${track.title}`.toLowerCase().includes(query) || track.sections.length > 0);
  }, [tree, treeFilter]);

  const activeFile = draft.files[activeFileIndex] || draft.files[0];

  const loadTree = useCallback(async (preferredExerciseId = selectedExerciseId) => {
    setLoadingTree(true);
    setError("");
    try {
      const payload = await getCurriculumTree();
      const tracks = payload.tracks || [];
      setTree(tracks);
      let nextExercise = preferredExerciseId;
      if (!nextExercise) {
        nextExercise = tracks.flatMap((track) => track.sections || []).flatMap((section) => section.exercises || [])[0]?.id || null;
      }
      if (nextExercise) {
        selectExerciseFromTree(tracks, nextExercise);
      }
    } catch (err) {
      setError(err.message || "Unable to load curriculum.");
    } finally {
      setLoadingTree(false);
    }
  }, [selectedExerciseId]);

  function selectExerciseFromTree(tracks, exerciseId) {
    for (const track of tracks) {
      for (const section of track.sections || []) {
        const exercise = (section.exercises || []).find((item) => Number(item.id) === Number(exerciseId));
        if (exercise) {
          setSelectedTrackId(track.id);
          setSelectedSectionId(section.id);
          setSelectedExerciseId(exercise.id);
          return;
        }
      }
    }
  }

  useEffect(() => {
    void loadTree(null);
  }, []);

  useEffect(() => {
    if (!selectedExerciseId) return;
    let disposed = false;
    async function loadStudio() {
      setLoadingStudio(true);
      setError("");
      try {
        const payload = await getExerciseStudio(selectedExerciseId);
        if (disposed) return;
        setStudio(payload);
        const nextDraft = normalizeDraft(payload);
        setDraft(nextDraft);
        setValidationConfigText(JSON.stringify(nextDraft.exercise.validation_config || {}, null, 2));
        setActiveFileIndex(0);
        setValidation(null);
        setPreviewUrl("");
        setPublishCheck(payload.publish_check || null);
      } catch (err) {
        if (!disposed) setError(err.message || "Unable to load exercise studio.");
      } finally {
        if (!disposed) setLoadingStudio(false);
      }
    }
    void loadStudio();
    return () => {
      disposed = true;
    };
  }, [selectedExerciseId]);

  function updateExercise(field, value) {
    setDraft((current) => ({ ...current, exercise: { ...current.exercise, [field]: value } }));
  }

  function updateMode(mode) {
    setDraft((current) => {
      const hasFrontendFiles = current.files.some((file) => file.file_path.toLowerCase() === "index.html");
      return {
        ...current,
        exercise: { ...current.exercise, mode },
        files: mode === "frontend_preview" && !hasFrontendFiles ? defaultFiles(mode) : current.files,
      };
    });
  }

  function updateFile(index, field, value) {
    setDraft((current) => ({
      ...current,
      files: current.files.map((file, itemIndex) => {
        if (itemIndex !== index) return file;
        const next = { ...file, [field]: value };
        if (field === "file_path") next.language = languageForPath(value);
        return next;
      }),
    }));
  }

  function setEntrypoint(index) {
    setDraft((current) => ({
      ...current,
      files: current.files.map((file, itemIndex) => ({ ...file, is_entrypoint: itemIndex === index })),
    }));
  }

  async function handleSave() {
    if (!selectedExerciseId) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const validationConfig = parseJsonBlock(validationConfigText, {}, "Frontend validation config");
      const payload = {
        exercise: { ...draft.exercise, validation_config: validationConfig },
        files: draft.files.map((file, index) => ({ ...file, order: index + 1 })),
        test_cases: draft.test_cases.map((testCase, index) => ({ ...testCase, order: index + 1 })),
        hints: draft.hints.map((hint, index) => ({ ...hint, order: index + 1 })),
        quiz: draft.exercise.mode === "quiz" ? {
          passing_score_pct: Number(draft.quiz.passing_score_pct) || 70,
          attempts_allowed: draft.quiz.attempts_allowed ? Number(draft.quiz.attempts_allowed) : null,
          questions: draft.quiz.questions,
        } : null,
      };
      const saved = await saveExerciseStudio(selectedExerciseId, payload);
      const nextDraft = normalizeDraft(saved);
      setStudio(saved);
      setDraft(nextDraft);
      setValidationConfigText(JSON.stringify(nextDraft.exercise.validation_config || {}, null, 2));
      setPublishCheck(saved.publish_check || null);
      setNotice("Exercise saved.");
      await loadTree(selectedExerciseId);
    } catch (err) {
      setError(err.message || "Unable to save exercise.");
    } finally {
      setSaving(false);
    }
  }

  async function handleValidate() {
    if (!selectedExerciseId) return;
    setValidating(true);
    setError("");
    try {
      const result = await validateExerciseStudio(selectedExerciseId, { use_solution: true, include_hidden: true });
      setValidation(result);
    } catch (err) {
      setError(err.message || "Validation failed.");
    } finally {
      setValidating(false);
    }
  }

  async function handlePreview() {
    if (!selectedExerciseId) return;
    try {
      const payload = await previewExerciseStudio(selectedExerciseId);
      setPreviewUrl(payload.learner_preview_url || "");
      setNotice("Learner preview is ready.");
    } catch (err) {
      setError(err.message || "Unable to prepare preview.");
    }
  }

  async function handleTrackPublishCheck() {
    if (!selectedTrackId) return;
    try {
      setPublishCheck(await checkTrackPublish(selectedTrackId));
      setNotice("Publish check refreshed.");
    } catch (err) {
      setError(err.message || "Unable to check track.");
    }
  }

  async function handleCreateTrack() {
    const title = newTrackTitle.trim();
    if (!title) return;
    const created = await createTrack({ title, slug: slugify(title), language_id: 71, is_published: false });
    setNewTrackTitle("");
    setSelectedTrackId(created.id);
    await loadTree(selectedExerciseId);
  }

  async function handleCreateSection() {
    const title = newSectionTitle.trim();
    if (!title || !selectedTrackId) return;
    const created = await createSection(selectedTrackId, { title, slug: slugify(title) });
    setNewSectionTitle("");
    setSelectedSectionId(created.id);
    await loadTree(selectedExerciseId);
  }

  async function handleCreateExercise() {
    const title = newExerciseTitle.trim();
    if (!title || !selectedSectionId) return;
    const created = await createExercise(selectedSectionId, {
      title,
      slug: slugify(title),
      mode: newExerciseMode,
      instructions_md: "Describe the learner goal, examples, and checks.",
      theory_content: newExerciseMode === "theory" ? "Write the theory lesson here." : "",
      xp_reward: 20,
      is_published: false,
    });
    setNewExerciseTitle("");
    await loadTree(created.id);
  }

  return (
    <div className="cs-root">
      <aside className="cs-tree">
        <div className="cs-panel-head">
          <div>
            <span>Production curriculum</span>
            <h2>Curriculum Studio</h2>
          </div>
          {loadingTree && <Loader2 className="cs-spin" size={18} />}
        </div>

        <label className="cs-search">
          <Search size={14} />
          <input value={treeFilter} onChange={(event) => setTreeFilter(event.target.value)} placeholder="Search tracks, sections, levels" />
        </label>

        <div className="cs-create-stack">
          <div className="cs-create-row">
            <input value={newTrackTitle} onChange={(event) => setNewTrackTitle(event.target.value)} placeholder="New track title" />
            <button type="button" onClick={handleCreateTrack}><Plus size={14} /></button>
          </div>
          <div className="cs-create-row">
            <input value={newSectionTitle} onChange={(event) => setNewSectionTitle(event.target.value)} placeholder="New section in selected track" disabled={!selectedTrackId} />
            <button type="button" onClick={handleCreateSection} disabled={!selectedTrackId}><Plus size={14} /></button>
          </div>
          <div className="cs-create-row cs-create-row--exercise">
            <input value={newExerciseTitle} onChange={(event) => setNewExerciseTitle(event.target.value)} placeholder="New exercise in selected section" disabled={!selectedSectionId} />
            <select value={newExerciseMode} onChange={(event) => setNewExerciseMode(event.target.value)} disabled={!selectedSectionId}>
              {MODE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <button type="button" onClick={handleCreateExercise} disabled={!selectedSectionId}><Plus size={14} /></button>
          </div>
        </div>

        <div className="cs-tree-list">
          {filteredTree.map((track) => (
            <section className={`cs-track-node ${Number(track.id) === Number(selectedTrackId) ? "is-selected" : ""}`} key={track.id}>
              <button type="button" className="cs-track-title" onClick={() => setSelectedTrackId(track.id)}>
                <FolderTree size={15} />
                <span>{track.title}</span>
                <small>{track.is_published ? "Live" : "Draft"}</small>
              </button>
              {(track.sections || []).map((section) => (
                <div className="cs-section-node" key={section.id}>
                  <button type="button" onClick={() => { setSelectedTrackId(track.id); setSelectedSectionId(section.id); }}>
                    <ChevronDown size={13} />
                    <span>{section.title}</span>
                  </button>
                  <div className="cs-exercise-list">
                    {(section.exercises || []).map((exercise) => (
                      <button
                        type="button"
                        key={exercise.id}
                        className={Number(exercise.id) === Number(selectedExerciseId) ? "is-active" : ""}
                        onClick={() => {
                          setSelectedTrackId(track.id);
                          setSelectedSectionId(section.id);
                          setSelectedExerciseId(exercise.id);
                        }}
                      >
                        <Code2 size={13} />
                        <span>{exercise.title}</span>
                        <small>{(exercise.mode || "code").replaceAll("_", " ")}</small>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          ))}
        </div>
      </aside>

      <main className="cs-workbench">
        <header className="cs-toolbar">
          <div>
            <span>{studio?.track?.title || selectedTrack?.title || "Track"}</span>
            <h1>{draft.exercise.title || "Select an exercise"}</h1>
            <p>{selectedSection?.title || studio?.section?.title || "Choose content from the tree."}</p>
          </div>
          <div className="cs-toolbar-actions">
            <button type="button" className="cs-btn" onClick={handlePreview} disabled={!selectedExerciseId}><Eye size={15} /> Preview</button>
            <button type="button" className="cs-btn" onClick={handleValidate} disabled={!selectedExerciseId || validating}>
              {validating ? <Loader2 className="cs-spin" size={15} /> : <FlaskConical size={15} />}
              Validate
            </button>
            <button type="button" className="cs-btn cs-btn--primary" onClick={handleSave} disabled={!selectedExerciseId || saving}>
              {saving ? <Loader2 className="cs-spin" size={15} /> : <Save size={15} />}
              Save
            </button>
          </div>
        </header>

        {(error || notice) && (
          <div className={`cs-message ${error ? "is-error" : "is-notice"}`}>
            {error ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
            <span>{error || notice}</span>
          </div>
        )}

        {loadingStudio ? (
          <div className="cs-loading"><Loader2 className="cs-spin" /> Loading editor...</div>
        ) : !selectedExerciseId ? (
          <div className="cs-empty">
            <FolderTree size={34} />
            <h2>Create or select an exercise</h2>
            <p>The new studio edits production learning-engine content, validation, XP, and quiz data in one place.</p>
          </div>
        ) : (
          <div className="cs-editor-grid">
            <section className="cs-editor">
              <nav className="cs-tabs">
                {TABS.map(([key, label, Icon]) => (
                  <button key={key} type="button" className={activeTab === key ? "is-active" : ""} onClick={() => setActiveTab(key)}>
                    <Icon size={14} />
                    {label}
                  </button>
                ))}
              </nav>

              {activeTab === "basics" && (
                <div className="cs-form-grid">
                  <label>Title<input value={draft.exercise.title} onChange={(event) => updateExercise("title", event.target.value)} /></label>
                  <label>Slug<input value={draft.exercise.slug} onChange={(event) => updateExercise("slug", event.target.value)} /></label>
                  <label>Mode<select value={draft.exercise.mode} onChange={(event) => updateMode(event.target.value)}>{MODE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  <label>Order<input type="number" value={draft.exercise.order} onChange={(event) => updateExercise("order", Number(event.target.value))} /></label>
                  <label>Unlock rule<select value={draft.exercise.unlock_rule} onChange={(event) => updateExercise("unlock_rule", event.target.value)}><option value="previous_completed">Previous completed</option><option value="always">Always unlocked</option><option value="manual">Manual</option></select></label>
                  <label className="cs-toggle"><input type="checkbox" checked={draft.exercise.is_published} onChange={(event) => updateExercise("is_published", event.target.checked)} /> Published</label>
                </div>
              )}

              {activeTab === "lesson" && (
                <div className="cs-form-stack">
                  <div className="cs-inline-actions">
                    <button type="button" className="cs-btn" onClick={() => setShowMediaPicker(true)}><Image size={14} /> Insert media URL</button>
                  </div>
                  <label>Instructions markdown<textarea value={draft.exercise.instructions_md} onChange={(event) => updateExercise("instructions_md", event.target.value)} rows={9} /></label>
                  <label>Theory content<textarea value={draft.exercise.theory_content} onChange={(event) => updateExercise("theory_content", event.target.value)} rows={10} /></label>
                </div>
              )}

              {activeTab === "files" && (
                <div className="cs-files-layout">
                  <div className="cs-file-list">
                    {draft.files.map((file, index) => (
                      <button key={`${file.file_path}-${index}`} type="button" className={index === activeFileIndex ? "is-active" : ""} onClick={() => setActiveFileIndex(index)}>
                        <FileCode2 size={14} />
                        <span>{file.file_path}</span>
                        {file.is_entrypoint && <small>main</small>}
                      </button>
                    ))}
                    <button type="button" className="cs-add-row" onClick={() => setDraft((current) => ({ ...current, files: [...current.files, { file_path: `file-${current.files.length + 1}.py`, language: "python", starter_code: "", solution_code: "", is_entrypoint: false, is_editable: true, order: current.files.length + 1 }] }))}>
                      <Plus size={14} /> Add file
                    </button>
                  </div>
                  {activeFile && (
                    <div className="cs-file-editor">
                      <div className="cs-form-grid cs-form-grid--compact">
                        <label>Path<input value={activeFile.file_path} onChange={(event) => updateFile(activeFileIndex, "file_path", event.target.value)} /></label>
                        <label>Language<input value={activeFile.language} onChange={(event) => updateFile(activeFileIndex, "language", event.target.value)} /></label>
                        <label className="cs-toggle"><input type="checkbox" checked={activeFile.is_editable} onChange={(event) => updateFile(activeFileIndex, "is_editable", event.target.checked)} /> Editable</label>
                        <button type="button" className="cs-btn" onClick={() => setEntrypoint(activeFileIndex)}>Set entrypoint</button>
                        <button type="button" className="cs-btn cs-btn--danger" onClick={() => setDraft((current) => ({ ...current, files: current.files.filter((_, index) => index !== activeFileIndex) }))} disabled={draft.files.length <= 1}><Trash2 size={14} /> Remove</button>
                      </div>
                      <div className="cs-code-columns">
                        <div>
                          <h3>Starter code</h3>
                          <Editor height="330px" theme="vs-dark" language={editorLanguage(activeFile.file_path, activeFile.language)} value={activeFile.starter_code} onChange={(value) => updateFile(activeFileIndex, "starter_code", value || "")} options={{ minimap: { enabled: false }, fontSize: 13 }} />
                        </div>
                        <div>
                          <h3>Solution code</h3>
                          <Editor height="330px" theme="vs-dark" language={editorLanguage(activeFile.file_path, activeFile.language)} value={activeFile.solution_code} onChange={(value) => updateFile(activeFileIndex, "solution_code", value || "")} options={{ minimap: { enabled: false }, fontSize: 13 }} />
                        </div>
                      </div>
                      {draft.exercise.mode === "frontend_preview" && (
                        <div className="cs-preview-frame">
                          <iframe title="Admin frontend preview" sandbox="allow-scripts" srcDoc={previewSrcDoc(draft.files)} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "validation" && (
                <div className="cs-form-stack">
                  <label>Frontend validation config JSON<textarea value={validationConfigText} onChange={(event) => setValidationConfigText(event.target.value)} rows={7} /></label>
                  <div className="cs-list-head">
                    <h3>Test cases</h3>
                    <button type="button" className="cs-btn" onClick={() => setDraft((current) => ({ ...current, test_cases: [...current.test_cases, { label: `Check ${current.test_cases.length + 1}`, stdin: "", expected_stdout: "", expected_outputs: [], match_mode: "normalize", is_hidden: true, timeout_ms: 5000, memory_limit_mb: 128, custom_judge_options: {}, order: current.test_cases.length + 1 }] }))}><Plus size={14} /> Add test</button>
                  </div>
                  {draft.test_cases.map((testCase, index) => (
                    <div className="cs-test-card" key={`test-${index}`}>
                      <div className="cs-form-grid cs-form-grid--compact">
                        <label>Label<input value={testCase.label} onChange={(event) => setDraft((current) => ({ ...current, test_cases: current.test_cases.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item) }))} /></label>
                        <label>Match<select value={testCase.match_mode} onChange={(event) => setDraft((current) => ({ ...current, test_cases: current.test_cases.map((item, itemIndex) => itemIndex === index ? { ...item, match_mode: event.target.value } : item) }))}><option value="normalize">Normalize</option><option value="exact">Exact</option><option value="any_of">Any of</option></select></label>
                        <label>Timeout ms<input type="number" value={testCase.timeout_ms || ""} onChange={(event) => setDraft((current) => ({ ...current, test_cases: current.test_cases.map((item, itemIndex) => itemIndex === index ? { ...item, timeout_ms: Number(event.target.value) || null } : item) }))} /></label>
                        <label className="cs-toggle"><input type="checkbox" checked={testCase.is_hidden} onChange={(event) => setDraft((current) => ({ ...current, test_cases: current.test_cases.map((item, itemIndex) => itemIndex === index ? { ...item, is_hidden: event.target.checked } : item) }))} /> Hidden</label>
                        <button type="button" className="cs-btn cs-btn--danger" onClick={() => setDraft((current) => ({ ...current, test_cases: current.test_cases.filter((_, itemIndex) => itemIndex !== index) }))}><Trash2 size={14} /> Remove</button>
                      </div>
                      <label>stdin<textarea value={testCase.stdin} onChange={(event) => setDraft((current) => ({ ...current, test_cases: current.test_cases.map((item, itemIndex) => itemIndex === index ? { ...item, stdin: event.target.value } : item) }))} rows={3} /></label>
                      <label>Expected stdout<textarea value={testCase.expected_stdout} onChange={(event) => setDraft((current) => ({ ...current, test_cases: current.test_cases.map((item, itemIndex) => itemIndex === index ? { ...item, expected_stdout: event.target.value, expected_outputs: event.target.value ? [event.target.value] : [] } : item) }))} rows={3} /></label>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "quiz" && (
                <div className="cs-form-stack">
                  <div className="cs-form-grid">
                    <label>Passing percent<input type="number" value={draft.quiz.passing_score_pct} onChange={(event) => setDraft((current) => ({ ...current, quiz: { ...current.quiz, passing_score_pct: Number(event.target.value) || 70 } }))} /></label>
                    <label>Attempts allowed<input type="number" value={draft.quiz.attempts_allowed || ""} onChange={(event) => setDraft((current) => ({ ...current, quiz: { ...current.quiz, attempts_allowed: event.target.value ? Number(event.target.value) : null } }))} /></label>
                  </div>
                  <button type="button" className="cs-btn" onClick={() => setDraft((current) => ({ ...current, quiz: { ...current.quiz, questions: [...current.quiz.questions, { question_text: "", question_type: "multiple_choice", code_snippet: "", explanation_md: "", order: current.quiz.questions.length + 1, options: [{ option_text: "", is_correct: true, explanation_md: "", order: 1 }, { option_text: "", is_correct: false, explanation_md: "", order: 2 }] }] } }))}><Plus size={14} /> Add question</button>
                  {draft.quiz.questions.map((question, qIndex) => (
                    <div className="cs-question-card" key={`question-${qIndex}`}>
                      <label>Question<textarea value={question.question_text} onChange={(event) => setDraft((current) => ({ ...current, quiz: { ...current.quiz, questions: current.quiz.questions.map((item, itemIndex) => itemIndex === qIndex ? { ...item, question_text: event.target.value } : item) } }))} rows={3} /></label>
                      <label>Code snippet<textarea value={question.code_snippet} onChange={(event) => setDraft((current) => ({ ...current, quiz: { ...current.quiz, questions: current.quiz.questions.map((item, itemIndex) => itemIndex === qIndex ? { ...item, code_snippet: event.target.value } : item) } }))} rows={4} /></label>
                      <div className="cs-option-list">
                        {question.options.map((option, optionIndex) => (
                          <label key={`option-${qIndex}-${optionIndex}`} className="cs-option-row">
                            <input type="radio" name={`correct-${qIndex}`} checked={option.is_correct} onChange={() => setDraft((current) => ({ ...current, quiz: { ...current.quiz, questions: current.quiz.questions.map((item, itemIndex) => itemIndex === qIndex ? { ...item, options: item.options.map((opt, optIndex) => ({ ...opt, is_correct: optIndex === optionIndex })) } : item) } }))} />
                            <input value={option.option_text} onChange={(event) => setDraft((current) => ({ ...current, quiz: { ...current.quiz, questions: current.quiz.questions.map((item, itemIndex) => itemIndex === qIndex ? { ...item, options: item.options.map((opt, optIndex) => optIndex === optionIndex ? { ...opt, option_text: event.target.value } : opt) } : item) } }))} placeholder={`Option ${optionIndex + 1}`} />
                          </label>
                        ))}
                      </div>
                      <div className="cs-inline-actions">
                        <button type="button" className="cs-btn" onClick={() => setDraft((current) => ({ ...current, quiz: { ...current.quiz, questions: current.quiz.questions.map((item, itemIndex) => itemIndex === qIndex ? { ...item, options: [...item.options, { option_text: "", is_correct: false, explanation_md: "", order: item.options.length + 1 }] } : item) } }))}><Plus size={14} /> Add option</button>
                        <button type="button" className="cs-btn cs-btn--danger" onClick={() => setDraft((current) => ({ ...current, quiz: { ...current.quiz, questions: current.quiz.questions.filter((_, itemIndex) => itemIndex !== qIndex) } }))}><Trash2 size={14} /> Remove question</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "hints" && (
                <div className="cs-form-stack">
                  <div className="cs-form-grid">
                    <label>Docs URL<input value={draft.exercise.docs_url} onChange={(event) => updateExercise("docs_url", event.target.value)} /></label>
                    <label>Reference solution URL<input value={draft.exercise.reference_solution_url} onChange={(event) => updateExercise("reference_solution_url", event.target.value)} /></label>
                  </div>
                  <button type="button" className="cs-btn" onClick={() => setDraft((current) => ({ ...current, hints: [...current.hints, { content_md: "", unlock_rule: "after_failed_run", penalty_xp: null, order: current.hints.length + 1 }] }))}><Plus size={14} /> Add hint</button>
                  {draft.hints.map((hint, index) => (
                    <div className="cs-test-card" key={`hint-${index}`}>
                      <div className="cs-form-grid cs-form-grid--compact">
                        <label>Unlock<select value={hint.unlock_rule} onChange={(event) => setDraft((current) => ({ ...current, hints: current.hints.map((item, itemIndex) => itemIndex === index ? { ...item, unlock_rule: event.target.value } : item) }))}><option value="always">Always</option><option value="after_first_run">After first run</option><option value="after_failed_run">After failed run</option></select></label>
                        <label>XP penalty<input type="number" value={hint.penalty_xp || ""} onChange={(event) => setDraft((current) => ({ ...current, hints: current.hints.map((item, itemIndex) => itemIndex === index ? { ...item, penalty_xp: event.target.value ? Number(event.target.value) : null } : item) }))} /></label>
                        <button type="button" className="cs-btn cs-btn--danger" onClick={() => setDraft((current) => ({ ...current, hints: current.hints.filter((_, itemIndex) => itemIndex !== index) }))}><Trash2 size={14} /> Remove</button>
                      </div>
                      <label>Hint markdown<textarea value={hint.content_md} onChange={(event) => setDraft((current) => ({ ...current, hints: current.hints.map((item, itemIndex) => itemIndex === index ? { ...item, content_md: event.target.value } : item) }))} rows={4} /></label>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "rewards" && (
                <div className="cs-form-stack">
                  <div className="cs-form-grid">
                    <label>XP reward<input type="number" value={draft.exercise.xp_reward} onChange={(event) => updateExercise("xp_reward", Number(event.target.value) || 0)} /></label>
                    <label>Passing score<input type="number" value={draft.exercise.passing_score_pct} onChange={(event) => updateExercise("passing_score_pct", Number(event.target.value) || 70)} /></label>
                    <label>Attempts allowed<input type="number" value={draft.exercise.attempts_allowed || ""} onChange={(event) => updateExercise("attempts_allowed", event.target.value ? Number(event.target.value) : null)} /></label>
                    <label className="cs-toggle"><input type="checkbox" checked={draft.exercise.auto_submit_on_pass} onChange={(event) => updateExercise("auto_submit_on_pass", event.target.checked)} /> Auto-submit when checks pass</label>
                  </div>
                  <button type="button" className="cs-btn" onClick={handleTrackPublishCheck}><CheckCircle2 size={14} /> Check track readiness</button>
                </div>
              )}
            </section>

            <aside className="cs-inspector">
              <div className="cs-inspector-card">
                <h3>Publish readiness</h3>
                <span className={`cs-status ${publishCheck?.ready ? "is-ready" : "is-review"}`}>
                  {publishCheck?.ready ? "Ready" : "Needs review"}
                </span>
                {(publishCheck?.issues || []).length === 0 ? (
                  <p>No blocking issues detected.</p>
                ) : (
                  <ul className="cs-issue-list">
                    {publishCheck.issues.slice(0, 8).map((issue, index) => (
                      <li key={`${issue.message}-${index}`} className={issue.severity === "warning" ? "is-warning" : ""}>
                        {issue.severity === "warning" ? <AlertCircle size={13} /> : <ChevronRight size={13} />}
                        <span>{issue.message}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="cs-inspector-card">
                <h3>Validation</h3>
                {!validation ? <p>Run validation to check solution files against visible and hidden tests.</p> : (
                  <div className={`cs-validation ${validation.passed ? "is-pass" : "is-fail"}`}>
                    <strong>{validation.verdict}</strong>
                    <span>{validation.passed_cases} / {validation.total_cases} checks passed</span>
                    {validation.error && <pre>{validation.error}</pre>}
                  </div>
                )}
              </div>
              <div className="cs-inspector-card">
                <h3>Content summary</h3>
                <dl className="cs-summary">
                  <div><dt>Mode</dt><dd>{draft.exercise.mode.replaceAll("_", " ")}</dd></div>
                  <div><dt>Files</dt><dd>{draft.files.length}</dd></div>
                  <div><dt>Tests</dt><dd>{draft.test_cases.length}</dd></div>
                  <div><dt>Hints</dt><dd>{draft.hints.length}</dd></div>
                  <div><dt>XP</dt><dd>{draft.exercise.xp_reward}</dd></div>
                </dl>
                {previewUrl && <a className="cs-preview-link" href={previewUrl} target="_blank" rel="noreferrer">Open learner preview</a>}
              </div>
            </aside>
          </div>
        )}
      </main>

      <MediaPickerModal
        isOpen={showMediaPicker}
        onClose={() => setShowMediaPicker(false)}
        onSelect={(media) => {
          const url = media?.url || media?.secure_url || media?.public_url || "";
          if (url) updateExercise("instructions_md", `${draft.exercise.instructions_md || ""}\n\n![Media](${url})`);
          setShowMediaPicker(false);
        }}
      />
    </div>
  );
}
