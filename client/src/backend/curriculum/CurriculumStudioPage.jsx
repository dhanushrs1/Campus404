import { Editor } from "@monaco-editor/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Award,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Code2,
  Eye,
  FileCode2,
  FilePlus2,
  FlaskConical,
  HelpCircle,
  Image,
  Layers3,
  Lightbulb,
  Link2,
  ListChecks,
  Loader2,
  PanelRight,
  Plus,
  Save,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import {
  checkTrackPublish,
  createExercise,
  createSection,
  createTrack,
  deleteExercise,
  deleteSection,
  deleteTrack,
  getCurriculumTree,
  getExerciseStudio,
  previewExerciseStudio,
  saveExerciseStudio,
  updateSection,
  updateTrack,
  validateExerciseStudio,
} from "../../shared/curriculumApi.js";
import BadgePickerModal from "../media/components/BadgePickerModal.jsx";
import MediaPickerModal from "../media/components/MediaPickerModal.jsx";
import "./CurriculumStudioPage.css";

const MODE_OPTIONS = [
  { value: "code", label: "Code", description: "Single-file coding challenge", icon: Code2 },
  { value: "multi_file_code", label: "Multi-file", description: "Code with helper files", icon: FileCode2 },
  { value: "frontend_preview", label: "Frontend", description: "HTML/CSS/JS with visual acceptance checks", icon: PanelRight },
  { value: "theory", label: "Theory", description: "Read, try, and complete", icon: BookOpen },
  { value: "quiz", label: "Quiz", description: "Multiple-choice assessment", icon: ListChecks },
  { value: "project", label: "Project", description: "Larger deliverable with validation", icon: Layers3 },
];

const LANGUAGE_OPTIONS = [
  { value: 71, label: "Python 3" },
  { value: 63, label: "JavaScript" },
  { value: 74, label: "TypeScript" },
  { value: 62, label: "Java" },
  { value: 54, label: "C++" },
  { value: 50, label: "C" },
  { value: 60, label: "Go" },
  { value: 73, label: "Rust" },
];

const CODE_MODES = new Set(["code", "multi_file_code", "frontend_preview", "project"]);
const TESTED_CODE_MODES = new Set(["code", "multi_file_code", "project"]);

const FRONTEND_RULES = [
  ["required_files", "Required files", "index.html"],
  ["required_text", "Required text", "Campus404"],
  ["required_selectors", "Required selectors", ".profile-card"],
  ["css_contains", "CSS snippets", "display: grid"],
  ["js_contains", "JavaScript snippets", "addEventListener"],
];

const MODE_TABS = {
  code: [
    { key: "overview", label: "Basics", icon: Layers3 },
    { key: "lesson", label: "Teach", icon: BookOpen },
    { key: "workspace", label: "Broken Code", icon: Code2 },
    { key: "validation", label: "Output Checks", icon: FlaskConical },
    { key: "hints", label: "Assist", icon: Lightbulb },
    { key: "publish", label: "Release", icon: CheckCircle2 },
  ],
  multi_file_code: [
    { key: "overview", label: "Basics", icon: Layers3 },
    { key: "lesson", label: "Teach", icon: BookOpen },
    { key: "workspace", label: "File System", icon: FileCode2 },
    { key: "validation", label: "Test Matrix", icon: FlaskConical },
    { key: "hints", label: "Assist", icon: Lightbulb },
    { key: "publish", label: "Release", icon: CheckCircle2 },
  ],
  frontend_preview: [
    { key: "overview", label: "Basics", icon: Layers3 },
    { key: "lesson", label: "Brief", icon: BookOpen },
    { key: "workspace", label: "Website Files", icon: FileCode2 },
    { key: "validation", label: "Frontend Rules", icon: FlaskConical },
    { key: "hints", label: "Assist", icon: Lightbulb },
    { key: "publish", label: "Release", icon: CheckCircle2 },
  ],
  quiz: [
    { key: "overview", label: "Basics", icon: Layers3 },
    { key: "quiz", label: "Quiz Builder", icon: ListChecks },
    { key: "publish", label: "Release", icon: CheckCircle2 },
  ],
  theory: [
    { key: "overview", label: "Basics", icon: Layers3 },
    { key: "lesson", label: "Lesson Content", icon: BookOpen },
    { key: "publish", label: "Release", icon: CheckCircle2 },
  ],
  project: [
    { key: "overview", label: "Basics", icon: Layers3 },
    { key: "lesson", label: "Project Brief", icon: BookOpen },
    { key: "workspace", label: "Project Files", icon: FileCode2 },
    { key: "validation", label: "Acceptance Tests", icon: FlaskConical },
    { key: "hints", label: "Assist", icon: Lightbulb },
    { key: "publish", label: "Release", icon: CheckCircle2 },
  ],
};

const EXERCISE_MODE_CONFIG = {
  code: {
    ...MODE_OPTIONS.find((item) => item.value === "code"),
    tabs: MODE_TABS.code,
    hasFiles: true,
    tested: true,
    supportsMultipleFiles: false,
    validationKind: "judge",
  },
  multi_file_code: {
    ...MODE_OPTIONS.find((item) => item.value === "multi_file_code"),
    tabs: MODE_TABS.multi_file_code,
    hasFiles: true,
    tested: true,
    supportsMultipleFiles: true,
    validationKind: "judge",
  },
  frontend_preview: {
    ...MODE_OPTIONS.find((item) => item.value === "frontend_preview"),
    tabs: MODE_TABS.frontend_preview,
    hasFiles: true,
    tested: false,
    supportsMultipleFiles: true,
    validationKind: "frontend_preview",
  },
  theory: {
    ...MODE_OPTIONS.find((item) => item.value === "theory"),
    tabs: MODE_TABS.theory,
    hasFiles: false,
    tested: false,
    supportsMultipleFiles: false,
    validationKind: "none",
  },
  quiz: {
    ...MODE_OPTIONS.find((item) => item.value === "quiz"),
    tabs: MODE_TABS.quiz,
    hasFiles: false,
    tested: false,
    supportsMultipleFiles: false,
    validationKind: "quiz",
  },
  project: {
    ...MODE_OPTIONS.find((item) => item.value === "project"),
    tabs: MODE_TABS.project,
    hasFiles: true,
    tested: true,
    supportsMultipleFiles: true,
    validationKind: "judge",
  },
};

const EMPTY_TRACK_DRAFT = {
  title: "",
  slug: "",
  description: "",
  featured_image_url: "",
  language_id: 71,
  is_published: false,
};

const EMPTY_SECTION_DRAFT = {
  title: "",
  slug: "",
  badge_url: "",
};

const EMPTY_EXERCISE_FORM = {
  title: "",
  slug: "",
  mode: "code",
  order: 1,
  sectionId: null,
};

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function nextAutoSlug(currentSlug, previousTitle, nextTitle) {
  const current = String(currentSlug || "").trim();
  const previousAuto = slugify(previousTitle);
  return !current || current === previousAuto ? slugify(nextTitle) : current;
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
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".go")) return "go";
  if (lower.endsWith(".rs")) return "rust";
  return "plaintext";
}

function editorLanguage(path = "", language = "") {
  if (language && language !== "plaintext") return language === "javascript" ? "javascript" : language;
  return languageForPath(path);
}

function defaultFiles(mode) {
  if (mode === "frontend_preview") {
    return [
      {
        file_path: "index.html",
        language: "html",
        starter_code: '<main class="profile-card">\n  <h1>Campus404</h1>\n</main>\n',
        solution_code: '<main class="profile-card">\n  <h1>Campus404</h1>\n</main>\n',
        is_entrypoint: true,
        is_editable: true,
        order: 1,
      },
      {
        file_path: "styles.css",
        language: "css",
        starter_code: ".profile-card {\n  padding: 24px;\n}\n",
        solution_code: ".profile-card {\n  padding: 24px;\n}\n",
        is_entrypoint: false,
        is_editable: true,
        order: 2,
      },
      {
        file_path: "script.js",
        language: "javascript",
        starter_code: "",
        solution_code: "",
        is_entrypoint: false,
        is_editable: true,
        order: 3,
      },
    ];
  }

  if (mode === "multi_file_code") {
    return [
      {
        file_path: "main.py",
        language: "python",
        starter_code: "from helpers import build_message\n\nprint(build_message())\n",
        solution_code: "from helpers import build_message\n\nprint(build_message())\n",
        is_entrypoint: true,
        is_editable: true,
        order: 1,
      },
      {
        file_path: "helpers.py",
        language: "python",
        starter_code: "def build_message():\n    return \"Campus404\"\n",
        solution_code: "def build_message():\n    return \"Campus404\"\n",
        is_entrypoint: false,
        is_editable: true,
        order: 2,
      },
    ];
  }

  return [
    {
      file_path: "main.py",
      language: "python",
      starter_code: "# Write your code here\n",
      solution_code: "",
      is_entrypoint: true,
      is_editable: true,
      order: 1,
    },
  ];
}

function defaultValidationConfig(mode) {
  if (mode !== "frontend_preview") return {};
  return {
    required_files: ["index.html", "styles.css"],
    required_text: [],
    required_selectors: [],
    css_contains: [],
    js_contains: [],
  };
}

function defaultTestCases(mode) {
  if (!TESTED_CODE_MODES.has(mode)) return [];
  return [
    {
      label: "Visible check",
      stdin: "",
      expected_stdout: "",
      expected_outputs: [""],
      match_mode: "normalize",
      is_hidden: false,
      timeout_ms: 5000,
      memory_limit_mb: 128,
      custom_judge_options: {},
      order: 1,
    },
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
      validation_config: defaultValidationConfig(mode),
      auto_submit_on_pass: false,
      is_published: false,
    },
    files: CODE_MODES.has(mode) ? defaultFiles(mode) : [],
    test_cases: defaultTestCases(mode),
    hints: [],
    quiz: {
      passing_score_pct: 70,
      attempts_allowed: null,
      questions: [],
    },
  };
}

function normalizeDraft(payload) {
  const exercise = payload?.exercise || {};
  const mode = exercise.mode || "code";
  const files = Array.isArray(exercise.files) ? exercise.files : [];
  const testCases = Array.isArray(exercise.test_cases) ? exercise.test_cases : [];

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
      validation_config: exercise.validation_config || defaultValidationConfig(mode),
      auto_submit_on_pass: Boolean(exercise.auto_submit_on_pass),
      is_published: Boolean(exercise.is_published),
    },
    files: CODE_MODES.has(mode)
      ? (files.length ? files : defaultFiles(mode)).map((file, index) => ({
          file_path: file.file_path || `file-${index + 1}.txt`,
          language: file.language || languageForPath(file.file_path),
          starter_code: file.starter_code || "",
          solution_code: file.solution_code || "",
          is_entrypoint: Boolean(file.is_entrypoint),
          is_editable: file.is_editable !== false,
          order: file.order || index + 1,
        }))
      : [],
    test_cases: TESTED_CODE_MODES.has(mode)
      ? (testCases.length ? testCases : defaultTestCases(mode)).map((testCase, index) => {
          const expectedOutputs = Array.isArray(testCase.expected_outputs)
            ? testCase.expected_outputs
            : (testCase.expected_stdout ? [testCase.expected_stdout] : [""]);
          return {
            label: testCase.label || `Check ${index + 1}`,
            stdin: testCase.stdin || "",
            expected_stdout: testCase.expected_stdout || expectedOutputs[0] || "",
            expected_outputs: expectedOutputs.length ? expectedOutputs : [""],
            match_mode: testCase.match_mode || "normalize",
            is_hidden: Boolean(testCase.is_hidden),
            timeout_ms: testCase.timeout_ms ?? 5000,
            memory_limit_mb: testCase.memory_limit_mb ?? 128,
            custom_judge_options: testCase.custom_judge_options || {},
            order: testCase.order || index + 1,
          };
        })
      : [],
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

function normalizeCurriculumTree(tracks = []) {
  return [...tracks]
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0) || Number(a.id || 0) - Number(b.id || 0))
    .map((track, trackIndex) => ({
      ...track,
      order: trackIndex + 1,
      sections: [...(track.sections || [])]
        .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0) || Number(a.id || 0) - Number(b.id || 0))
        .map((section, sectionIndex) => ({
          ...section,
          order: sectionIndex + 1,
          exercises: [...(section.exercises || [])]
            .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0) || Number(a.id || 0) - Number(b.id || 0))
            .map((exercise, exerciseIndex) => ({
              ...exercise,
              order: exerciseIndex + 1,
            })),
        })),
    }));
}

function normalizeTrackDraft(track) {
  if (!track) return EMPTY_TRACK_DRAFT;
  return {
    title: track.title || "",
    slug: track.slug || "",
    description: track.description || "",
    featured_image_url: track.featured_image_url || "",
    language_id: Number(track.language_id || 71),
    is_published: Boolean(track.is_published),
  };
}

function normalizeSectionDraft(section) {
  if (!section) return EMPTY_SECTION_DRAFT;
  return {
    title: section.title || "",
    slug: section.slug || "",
    badge_url: section.badge_url || "",
  };
}

function normalizeConfig(config) {
  const next = { ...(config || {}) };
  FRONTEND_RULES.forEach(([key]) => {
    next[key] = Array.isArray(next[key]) ? next[key].map((item) => String(item || "")).filter(Boolean) : [];
  });
  return next;
}

function hasFrontendRules(config) {
  const normalized = normalizeConfig(config);
  return FRONTEND_RULES.some(([key]) => (normalized[key] || []).some((item) => String(item || "").trim()));
}

function hasExpectedOutput(testCase) {
  const outputs = Array.isArray(testCase?.expected_outputs)
    ? testCase.expected_outputs
    : (testCase?.expected_stdout ? [testCase.expected_stdout] : []);
  return outputs.some((item) => String(item ?? "").trim());
}

function stripHtml(value = "") {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function previewSrcDoc(files) {
  const byPath = Object.fromEntries((files || []).map((file) => [String(file.file_path || "").toLowerCase(), file.starter_code || ""]));
  const html = byPath["index.html"] || "";
  const css = byPath["styles.css"] || byPath["style.css"] || "";
  const js = byPath["script.js"] || byPath["main.js"] || "";
  return `<!doctype html><html><head><meta charset="utf-8" /><style>${css}</style></head><body>${html}<script>${js}</script></body></html>`;
}

function normalizeRole(role) {
  return String(role || "USER").trim().toUpperCase() || "USER";
}

function buildSavePayload(draft) {
  const mode = draft.exercise.mode || "code";
  const codeMode = CODE_MODES.has(mode);
  const testedMode = TESTED_CODE_MODES.has(mode);
  const files = codeMode
    ? draft.files.map((file, index) => ({
        file_path: file.file_path || `file-${index + 1}.txt`,
        language: file.language || languageForPath(file.file_path),
        starter_code: file.starter_code || "",
        solution_code: file.solution_code || "",
        is_entrypoint: Boolean(file.is_entrypoint),
        is_editable: file.is_editable !== false,
        order: index + 1,
      }))
    : [];

  if (files.length && !files.some((file) => file.is_entrypoint)) {
    files[0].is_entrypoint = true;
  }

  const testCases = testedMode
    ? draft.test_cases.map((testCase, index) => {
        const outputs = (testCase.expected_outputs || [])
          .map((item) => String(item ?? ""))
          .filter((item, itemIndex, list) => item || list.length === 1 || itemIndex === 0);
        return {
          label: testCase.label || `Check ${index + 1}`,
          stdin: testCase.stdin || "",
          expected_stdout: outputs[0] || "",
          expected_outputs: outputs.length ? outputs : [""],
          match_mode: testCase.match_mode || "normalize",
          is_hidden: Boolean(testCase.is_hidden),
          timeout_ms: testCase.timeout_ms ? Number(testCase.timeout_ms) : null,
          memory_limit_mb: testCase.memory_limit_mb ? Number(testCase.memory_limit_mb) : null,
          custom_judge_options: testCase.custom_judge_options || {},
          order: index + 1,
        };
      })
    : [];

  const quiz = mode === "quiz"
    ? {
        passing_score_pct: Number(draft.quiz.passing_score_pct) || 70,
        attempts_allowed: draft.quiz.attempts_allowed ? Number(draft.quiz.attempts_allowed) : null,
        questions: draft.quiz.questions.map((question, questionIndex) => ({
          question_text: question.question_text || "",
          question_type: question.question_type || "multiple_choice",
          code_snippet: question.code_snippet || "",
          explanation_md: question.explanation_md || "",
          order: questionIndex + 1,
          options: question.options.map((option, optionIndex) => ({
            option_text: option.option_text || "",
            is_correct: Boolean(option.is_correct),
            explanation_md: option.explanation_md || "",
            order: optionIndex + 1,
          })),
        })),
      }
    : null;

  return {
    exercise: {
      ...draft.exercise,
      xp_reward: Number(draft.exercise.xp_reward) || 0,
      order: Number(draft.exercise.order) || 1,
      passing_score_pct: Number(draft.exercise.passing_score_pct) || 70,
      attempts_allowed: draft.exercise.attempts_allowed ? Number(draft.exercise.attempts_allowed) : null,
      validation_config: mode === "frontend_preview" ? normalizeConfig(draft.exercise.validation_config) : (draft.exercise.validation_config || {}),
      reference_solution_url: draft.exercise.reference_solution_url || "",
      docs_url: draft.exercise.docs_url || "",
    },
    files,
    test_cases: testCases,
    hints: draft.hints.map((hint, index) => ({
      content_md: hint.content_md || "",
      unlock_rule: hint.unlock_rule || "after_failed_run",
      penalty_xp: hint.penalty_xp ? Number(hint.penalty_xp) : null,
      order: index + 1,
    })),
    quiz,
  };
}

function getMediaUrl(media) {
  return media?.url || media?.secure_url || media?.public_url || "";
}

function useBeforeUnload(enabled) {
  useEffect(() => {
    if (!enabled) return undefined;
    const handler = (event) => {
      event.preventDefault();
      event.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [enabled]);
}

function StatusPill({ live, ready, children }) {
  let tone = "draft";
  if (ready) tone = "ready";
  else if (live) tone = "live";
  return <span className={`cs-pill cs-pill--${tone}`}>{children}</span>;
}

function EmptyState({ icon: Icon = Sparkles, title, children }) {
  return (
    <div className="cs-empty">
      <Icon size={28} />
      <h2>{title}</h2>
      {children && <p>{children}</p>}
    </div>
  );
}

function getStageSummary(key, mode) {
  const shared = {
    overview: "Mode, naming, access rules, XP, and mode-specific scoring.",
    lesson: mode === "frontend_preview" ? "Learner brief, page goal, examples, and visual expectations." : "Learner instructions, theory, examples, and supporting media.",
    workspace: mode === "code" ? "Starter or broken entry file beside the reference solution." : "Files, entrypoint, editable helper files, and previewable content.",
    validation: mode === "frontend_preview" ? "Required files, selectors, text, CSS, and JavaScript checks." : "Visible and hidden checks with accepted stdout outputs.",
    quiz: "Questions, answer options, explanations, and pass score.",
    hints: "Docs, reference links, staged hints, and XP penalties.",
    publish: "Route preview, validation run, readiness check, and publish state.",
  };
  return shared[key] || "Configure this stage for the selected exercise mode.";
}

function getModeChecklist(mode) {
  const checklist = {
    frontend_preview: ["Brief", "Website files", "Preview", "Frontend rules"],
    code: ["Prompt", "Starter code", "Solution", "Output checks"],
    multi_file_code: ["Prompt", "File tree", "Entrypoint", "Output checks"],
    project: ["Brief", "Project files", "Acceptance tests", "Hints"],
    quiz: ["Question set", "Options", "Answer key", "Pass score"],
    theory: ["Lesson content", "Instructions", "XP reward", "Publish state"],
  };
  return checklist[mode] || checklist.code;
}

function getModeRecipe(mode) {
  const recipes = {
    frontend_preview: ["Website files", "Live preview", "Frontend rules", "Hints", "Release gate"],
    code: ["Single entry file", "Starter code", "Solution code", "Expected output tests", "Release gate"],
    multi_file_code: ["Safe file tree", "Entrypoint", "Starter files", "Solution files", "Expected output tests"],
    project: ["Project brief", "File workspace", "Acceptance tests", "Hints", "Release gate"],
    quiz: ["Questions", "Options", "One correct answer", "Passing score", "Release gate"],
    theory: ["Theory content", "Instructions", "XP reward", "Release gate"],
  };
  return recipes[mode] || recipes.code;
}

function FieldList({ items, label, placeholder, onChange, onAdd, onRemove }) {
  const list = items?.length ? items : [""];
  return (
    <div className="cs-rule-list">
      <div className="cs-list-head">
        <h3>{label}</h3>
        <button type="button" className="cs-btn cs-btn--ghost" onClick={onAdd}>
          <Plus size={14} /> Add
        </button>
      </div>
      {list.map((item, index) => (
        <div className="cs-rule-row" key={`${label}-${index}`}>
          <input value={item} onChange={(event) => onChange(index, event.target.value)} placeholder={placeholder} />
          <button type="button" className="cs-icon-btn" onClick={() => onRemove(index)} title="Remove">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

export default function CurriculumStudioPage({ role = "EDITOR" }) {
  const instructionQuillRef = useRef(null);
  const theoryQuillRef = useRef(null);

  const [tree, setTree] = useState([]);
  const [treeFilter, setTreeFilter] = useState("");
  const [selectedNode, setSelectedNode] = useState({ type: "tracks", trackId: null });
  const [studio, setStudio] = useState(null);
  const [draft, setDraft] = useState(defaultDraft());
  const [exerciseSnapshot, setExerciseSnapshot] = useState(JSON.stringify(buildSavePayload(defaultDraft())));
  const [activeTab, setActiveTab] = useState("overview");
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [lessonSourceMode, setLessonSourceMode] = useState("visual");
  const [mediaTarget, setMediaTarget] = useState(null);
  const [showBadgePicker, setShowBadgePicker] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [trackForm, setTrackForm] = useState(EMPTY_TRACK_DRAFT);
  const [sectionForm, setSectionForm] = useState(EMPTY_SECTION_DRAFT);
  const [exerciseForm, setExerciseForm] = useState(EMPTY_EXERCISE_FORM);
  const [loadingTree, setLoadingTree] = useState(true);
  const [loadingStudio, setLoadingStudio] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [validation, setValidation] = useState(null);
  const [publishCheck, setPublishCheck] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const normalizedRole = normalizeRole(role);
  const canManageContent = normalizedRole === "ADMIN" || normalizedRole === "EDITOR";
  const canPublishDelete = normalizedRole === "ADMIN";

  const selectedTrack = useMemo(() => {
    return tree.find((track) => Number(track.id) === Number(selectedNode?.trackId)) || null;
  }, [selectedNode?.trackId, tree]);

  const selectedSection = useMemo(() => {
    for (const track of tree) {
      const section = (track.sections || []).find((item) => Number(item.id) === Number(selectedNode?.sectionId));
      if (section) return section;
    }
    return null;
  }, [selectedNode?.sectionId, tree]);

  const selectedExercise = useMemo(() => {
    for (const track of tree) {
      for (const section of track.sections || []) {
        const exercise = (section.exercises || []).find((item) => Number(item.id) === Number(selectedNode?.exerciseId));
        if (exercise) return exercise;
      }
    }
    return null;
  }, [selectedNode?.exerciseId, tree]);

  const activeFile = draft.files[activeFileIndex] || draft.files[0] || null;
  const mode = draft.exercise.mode || "code";
  const modeConfig = EXERCISE_MODE_CONFIG[mode] || EXERCISE_MODE_CONFIG.code;
  const modeMeta = modeConfig;
  const studioView = selectedNode?.type === "exercise" ? "exercise" : (selectedNode?.trackId ? "track" : "tracks");
  const exerciseDirty = selectedNode?.type === "exercise" && JSON.stringify(buildSavePayload(draft)) !== exerciseSnapshot;
  const anyDirty = exerciseDirty;

  useBeforeUnload(anyDirty);

  const availableTabs = useMemo(() => {
    return (EXERCISE_MODE_CONFIG[mode] || EXERCISE_MODE_CONFIG.code).tabs;
  }, [mode]);

  useEffect(() => {
    if (!availableTabs.some((tab) => tab.key === activeTab)) {
      setActiveTab("overview");
    }
  }, [activeTab, availableTabs]);

  const filteredTracks = useMemo(() => {
    const query = treeFilter.trim().toLowerCase();
    if (!query) return tree;
    return tree.filter((track) => `${track.title || ""} ${track.description || ""}`.toLowerCase().includes(query));
  }, [tree, treeFilter]);

  const selectedExercisePosition = useMemo(() => {
    if (!selectedSection || !selectedExercise) return null;
    const exercises = selectedSection.exercises || [];
    const index = exercises.findIndex((exercise) => Number(exercise.id) === Number(selectedExercise.id));
    return index >= 0 ? { position: index + 1, total: exercises.length } : null;
  }, [selectedExercise, selectedSection]);

  const loadTree = useCallback(async (preferredNode = selectedNode) => {
    setLoadingTree(true);
    setError("");
    try {
      const payload = await getCurriculumTree();
      const tracks = normalizeCurriculumTree(payload.tracks || []);
      setTree(tracks);
      const nextNode = resolveNodeFromTree(tracks, preferredNode);
      setSelectedNode(nextNode);
    } catch (err) {
      setError(err.message || "Unable to load curriculum.");
    } finally {
      setLoadingTree(false);
    }
  }, [selectedNode]);

  useEffect(() => {
    void loadTree({ type: "tracks", trackId: null });
  }, []);

  useEffect(() => {
    if (selectedNode?.type !== "exercise" || !selectedNode.exerciseId) {
      setStudio(null);
      setValidation(null);
      setPublishCheck(null);
      setPreviewUrl("");
      return undefined;
    }

    let disposed = false;
    async function loadStudio() {
      setLoadingStudio(true);
      setError("");
      try {
        const payload = await getExerciseStudio(selectedNode.exerciseId);
        if (disposed) return;
        const nextDraft = normalizeDraft(payload);
        setStudio(payload);
        setDraft(nextDraft);
        setExerciseSnapshot(JSON.stringify(buildSavePayload(nextDraft)));
        setPublishCheck(payload.publish_check || null);
        setValidation(null);
        setPreviewUrl("");
        setActiveTab("overview");
        setActiveFileIndex(0);
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
  }, [selectedNode?.exerciseId, selectedNode?.type]);

  function resolveNodeFromTree(tracks, node) {
    if (!tracks.length) return { type: "tracks", trackId: null };

    if (!node?.trackId || node?.type === "tracks") {
      return { type: "tracks", trackId: null };
    }

    if (node?.type === "exercise" && node.exerciseId) {
      for (const track of tracks) {
        for (const section of track.sections || []) {
          const exercise = (section.exercises || []).find((item) => Number(item.id) === Number(node.exerciseId));
          if (exercise) {
            return { type: "exercise", trackId: track.id, sectionId: section.id, exerciseId: exercise.id };
          }
        }
      }
    }

    if (node?.type === "section" && node.sectionId) {
      for (const track of tracks) {
        const section = (track.sections || []).find((item) => Number(item.id) === Number(node.sectionId));
        if (section) return { type: "section", trackId: track.id, sectionId: section.id };
      }
    }

    if (node?.type === "track" && node.trackId) {
      const track = tracks.find((item) => Number(item.id) === Number(node.trackId));
      if (track) return { type: "track", trackId: track.id };
    }

    return { type: "track", trackId: tracks[0].id };
  }

  function selectNode(node) {
    setSelectedNode(node);
    setNotice("");
    setError("");
  }

  function updateExercise(field, value) {
    setDraft((current) => ({ ...current, exercise: { ...current.exercise, [field]: value } }));
  }

  function updateExerciseTitle(value) {
    setDraft((current) => ({
      ...current,
      exercise: {
        ...current.exercise,
        title: value,
        slug: nextAutoSlug(current.exercise.slug, current.exercise.title, value),
      },
    }));
  }

  function updateMode(nextMode) {
    setDraft((current) => {
      const hasFiles = current.files.length > 0;
      const nextFiles = CODE_MODES.has(nextMode)
        ? (hasFiles ? current.files : defaultFiles(nextMode))
        : [];
      const nextTests = TESTED_CODE_MODES.has(nextMode)
        ? (current.test_cases.length ? current.test_cases : defaultTestCases(nextMode))
        : [];
      return {
        ...current,
        exercise: {
          ...current.exercise,
          mode: nextMode,
          validation_config: nextMode === "frontend_preview"
            ? normalizeConfig(current.exercise.validation_config || defaultValidationConfig(nextMode))
            : current.exercise.validation_config || {},
        },
        files: nextMode === "frontend_preview" && !current.files.some((file) => file.file_path.toLowerCase() === "index.html")
          ? defaultFiles(nextMode)
          : nextFiles,
        test_cases: nextTests,
      };
    });
    setActiveTab("overview");
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

  function updateTestCase(index, patch) {
    setDraft((current) => ({
      ...current,
      test_cases: current.test_cases.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
    }));
  }

  function updateConfigList(key, index, value) {
    setDraft((current) => {
      const config = normalizeConfig(current.exercise.validation_config);
      const list = config[key]?.length ? [...config[key]] : [""];
      list[index] = value;
      return {
        ...current,
        exercise: {
          ...current.exercise,
          validation_config: { ...config, [key]: list },
        },
      };
    });
  }

  function addConfigItem(key) {
    setDraft((current) => {
      const config = normalizeConfig(current.exercise.validation_config);
      return {
        ...current,
        exercise: {
          ...current.exercise,
          validation_config: { ...config, [key]: [...(config[key] || []), ""] },
        },
      };
    });
  }

  function removeConfigItem(key, index) {
    setDraft((current) => {
      const config = normalizeConfig(current.exercise.validation_config);
      const nextList = (config[key] || []).filter((_, itemIndex) => itemIndex !== index);
      return {
        ...current,
        exercise: {
          ...current.exercise,
          validation_config: { ...config, [key]: nextList.length ? nextList : [""] },
        },
      };
    });
  }

  function addFile() {
    setDraft((current) => {
      const extension = mode === "frontend_preview" ? "html" : "py";
      const next = [
        ...current.files,
        {
          file_path: `file-${current.files.length + 1}.${extension}`,
          language: extension === "html" ? "html" : "python",
          starter_code: "",
          solution_code: "",
          is_entrypoint: current.files.length === 0,
          is_editable: true,
          order: current.files.length + 1,
        },
      ];
      return { ...current, files: next };
    });
    setActiveFileIndex(draft.files.length);
  }

  function removeFile(index) {
    setDraft((current) => {
      const files = current.files.filter((_, itemIndex) => itemIndex !== index);
      if (files.length && !files.some((file) => file.is_entrypoint)) {
        files[0] = { ...files[0], is_entrypoint: true };
      }
      return { ...current, files };
    });
    setActiveFileIndex((value) => Math.max(0, Math.min(value, draft.files.length - 2)));
  }

  function setEntrypoint(index) {
    setDraft((current) => ({
      ...current,
      files: current.files.map((file, itemIndex) => ({ ...file, is_entrypoint: itemIndex === index })),
    }));
  }

  function addTestCase() {
    setDraft((current) => ({
      ...current,
      test_cases: [
        ...current.test_cases,
        {
          label: `Check ${current.test_cases.length + 1}`,
          stdin: "",
          expected_stdout: "",
          expected_outputs: [""],
          match_mode: "normalize",
          is_hidden: true,
          timeout_ms: 5000,
          memory_limit_mb: 128,
          custom_judge_options: {},
          order: current.test_cases.length + 1,
        },
      ],
    }));
  }

  function addQuestion() {
    setDraft((current) => ({
      ...current,
      quiz: {
        ...current.quiz,
        questions: [
          ...current.quiz.questions,
          {
            question_text: "",
            question_type: "multiple_choice",
            code_snippet: "",
            explanation_md: "",
            order: current.quiz.questions.length + 1,
            options: [
              { option_text: "", is_correct: true, explanation_md: "", order: 1 },
              { option_text: "", is_correct: false, explanation_md: "", order: 2 },
            ],
          },
        ],
      },
    }));
  }

  function insertMediaUrl(url) {
    if (!url) return;
    if (mediaTarget === "track-form") {
      setTrackForm((current) => ({ ...current, featured_image_url: url }));
      return;
    }
    if (mediaTarget === "instructions" || mediaTarget === "theory") {
      const ref = mediaTarget === "instructions" ? instructionQuillRef.current : theoryQuillRef.current;
      if (lessonSourceMode === "visual" && ref) {
        const editor = ref.getEditor();
        const range = editor.getSelection(true) || { index: editor.getLength() };
        editor.insertEmbed(range.index, "image", url);
        editor.setSelection(range.index + 1);
        return;
      }
      updateExercise(mediaTarget === "instructions" ? "instructions_md" : "theory_content", `${draft.exercise[mediaTarget === "instructions" ? "instructions_md" : "theory_content"] || ""}<p><img src="${url}" alt="" /></p>`);
    }
  }

  function closeDialog() {
    setDialog(null);
    setError("");
  }

  function openCreateTrackDialog() {
    setTrackForm(EMPTY_TRACK_DRAFT);
    setDialog({ type: "track-create" });
  }

  function openEditTrackDialog() {
    if (!selectedTrack) return;
    setTrackForm(normalizeTrackDraft(selectedTrack));
    setDialog({ type: "track-edit" });
  }

  function openCreateSectionDialog() {
    if (!selectedTrack) return;
    setSectionForm(EMPTY_SECTION_DRAFT);
    setDialog({ type: "section-create" });
  }

  function openEditSectionDialog(section) {
    if (!section) return;
    setSectionForm(normalizeSectionDraft(section));
    setDialog({ type: "section-edit", sectionId: section.id });
  }

  function openCreateExerciseDialog(section) {
    if (!section) return;
    setExerciseForm({
      ...EMPTY_EXERCISE_FORM,
      sectionId: section.id,
      order: getNextExerciseOrder(section.id),
    });
    setDialog({ type: "exercise-create", sectionId: section.id });
  }

  function getNextExerciseOrder(sectionId) {
    const section = (selectedTrack?.sections || []).find((item) => Number(item.id) === Number(sectionId));
    return (section?.exercises?.length || 0) + 1;
  }

  function openDeleteTrackDialog() {
    if (!selectedTrack || !canPublishDelete) return;
    setDialog({ type: "delete-track", trackId: selectedTrack.id, title: selectedTrack.title });
  }

  function openDeleteSectionDialog(section) {
    if (!section || !canPublishDelete) return;
    setDialog({ type: "delete-section", sectionId: section.id, title: section.title, trackId: selectedTrack?.id });
  }

  function openDeleteExerciseDialog(section, exercise) {
    if (!section || !exercise || !canPublishDelete) return;
    setDialog({
      type: "delete-exercise",
      exerciseId: exercise.id,
      sectionId: section.id,
      trackId: selectedTrack?.id,
      title: exercise.title,
    });
  }

  async function handleConfirmDelete() {
    if (!dialog || !canPublishDelete) return;
    setSaving(true);
    setError("");
    try {
      if (dialog.type === "delete-track" && dialog.trackId) {
        await deleteTrack(dialog.trackId);
        setNotice("Track deleted.");
        closeDialog();
        await loadTree({ type: "tracks", trackId: null });
      } else if (dialog.type === "delete-section" && dialog.sectionId) {
        await deleteSection(dialog.sectionId);
        setNotice("Section deleted.");
        const trackId = dialog.trackId || selectedTrack?.id;
        closeDialog();
        await loadTree({ type: "track", trackId });
      } else if (dialog.type === "delete-exercise" && dialog.exerciseId) {
        await deleteExercise(dialog.exerciseId);
        setNotice("Exercise deleted.");
        const trackId = dialog.trackId || selectedTrack?.id;
        closeDialog();
        await loadTree({ type: "track", trackId });
      }
    } catch (err) {
      setError(err.message || "Unable to delete item.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmitTrackForm(event) {
    event.preventDefault();
    const title = trackForm.title.trim();
    if (!title) {
      setError("Track title is required.");
      return;
    }
    const payload = {
      title,
      slug: trackForm.slug.trim() || slugify(title),
      description: trackForm.description,
      language_id: Number(trackForm.language_id) || 71,
      featured_image_url: trackForm.featured_image_url,
    };
    if (canPublishDelete) {
      payload.is_published = Boolean(trackForm.is_published);
    }
    setSaving(true);
    setError("");
    try {
      if (dialog?.type === "track-edit" && selectedTrack?.id) {
        const saved = await updateTrack(selectedTrack.id, payload);
        setNotice("Track saved.");
        closeDialog();
        await loadTree({ type: "track", trackId: saved.id || selectedTrack.id });
      } else {
        const created = await createTrack(payload);
        setNotice("Track created.");
        closeDialog();
        await loadTree({ type: "track", trackId: created.id });
      }
    } catch (err) {
      setError(err.message || "Unable to save track.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmitSectionForm(event) {
    event.preventDefault();
    const title = sectionForm.title.trim();
    if (!title || !selectedTrack?.id) {
      setError("Section title is required.");
      return;
    }
    const payload = {
      title,
      slug: sectionForm.slug.trim() || slugify(title),
      badge_url: sectionForm.badge_url,
    };
    setSaving(true);
    setError("");
    try {
      if (dialog?.type === "section-edit" && dialog.sectionId) {
        await updateSection(dialog.sectionId, payload);
        setNotice("Section saved.");
      } else {
        await createSection(selectedTrack.id, payload);
        setNotice("Section created.");
      }
      closeDialog();
      await loadTree({ type: "track", trackId: selectedTrack.id });
    } catch (err) {
      setError(err.message || "Unable to save section.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmitExerciseForm(event) {
    event.preventDefault();
    const title = exerciseForm.title.trim();
    const sectionId = exerciseForm.sectionId || dialog?.sectionId;
    if (!title || !sectionId || !selectedTrack?.id) {
      setError("Exercise title and section are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const created = await createExercise(sectionId, {
        title,
        slug: exerciseForm.slug.trim() || slugify(title),
        mode: exerciseForm.mode,
        order: getNextExerciseOrder(sectionId),
        instructions_md: "<p>Describe the learner goal, examples, and checks.</p>",
        theory_content: exerciseForm.mode === "theory" ? "<p>Write the theory lesson here.</p>" : "",
        validation_config: defaultValidationConfig(exerciseForm.mode),
        xp_reward: 20,
        is_published: false,
      });
      setNotice("Exercise created. Complete the studio details next.");
      closeDialog();
      await loadTree({
        type: "exercise",
        trackId: selectedTrack.id,
        sectionId,
        exerciseId: created.id,
      });
    } catch (err) {
      setError(err.message || "Unable to create exercise.");
    } finally {
      setSaving(false);
    }
  }

  async function saveExerciseDraft({ silent = false } = {}) {
    if (!selectedNode?.exerciseId) return null;
    const publishChanged = Boolean(draft.exercise.is_published) !== Boolean(studio?.exercise?.is_published);
    if (publishChanged && draft.exercise.is_published && draftIssues.length) {
      setError(`Cannot publish yet: ${draftIssues[0]}`);
      return null;
    }
    if (publishChanged && !canPublishDelete) {
      setError("Only administrators can publish exercises.");
      return null;
    }
    setSaving(true);
    setError("");
    try {
      const payload = buildSavePayload(draft);
      if (!canPublishDelete) {
        delete payload.exercise.is_published;
      }
      const saved = await saveExerciseStudio(selectedNode.exerciseId, payload);
      const nextDraft = normalizeDraft(saved);
      setStudio(saved);
      setDraft(nextDraft);
      setExerciseSnapshot(JSON.stringify(buildSavePayload(nextDraft)));
      setPublishCheck(saved.publish_check || null);
      if (!silent) setNotice("Exercise saved.");
      await loadTree(selectedNode);
      return saved;
    } catch (err) {
      setError(err.message || "Unable to save exercise.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveSelected() {
    setNotice("");
    if (selectedNode?.type === "exercise") await saveExerciseDraft();
  }

  async function handleValidate() {
    if (!selectedNode?.exerciseId) return;
    if (draftIssues.length) {
      setValidation({
        passed: false,
        verdict: "Configuration Error",
        passed_cases: 0,
        total_cases: 0,
        visible_results: [],
        error: draftIssues[0],
      });
      setError(draftIssues[0]);
      return;
    }
    setValidating(true);
    setError("");
    setNotice("");
    try {
      if (exerciseDirty) {
        const saved = await saveExerciseDraft({ silent: true });
        if (!saved) return;
      }
      const result = await validateExerciseStudio(selectedNode.exerciseId, { use_solution: true, include_hidden: true });
      setValidation(result);
      setNotice(result.passed ? "Validation passed." : "Validation needs review.");
    } catch (err) {
      setError(err.message || "Validation failed.");
    } finally {
      setValidating(false);
    }
  }

  async function handlePreview() {
    if (!selectedNode?.exerciseId) return;
    setError("");
    setNotice("");
    try {
      if (exerciseDirty) {
        const saved = await saveExerciseDraft({ silent: true });
        if (!saved) return;
      }
      const payload = await previewExerciseStudio(selectedNode.exerciseId);
      setPreviewUrl(payload.learner_preview_url || "");
      setNotice("Learner preview is ready.");
    } catch (err) {
      setError(err.message || "Unable to prepare preview.");
    }
  }

  async function handleTrackPublishCheck() {
    if (!selectedNode?.trackId) return;
    setChecking(true);
    setError("");
    try {
      const result = await checkTrackPublish(selectedNode.trackId);
      setPublishCheck(result);
      setNotice("Publish check refreshed.");
    } catch (err) {
      setError(err.message || "Unable to check track.");
    } finally {
      setChecking(false);
    }
  }

  const fileWarnings = useMemo(() => {
    const warnings = [];
    const paths = new Set();
    draft.files.forEach((file) => {
      const path = String(file.file_path || "").trim();
      if (!path) warnings.push("A file path is empty.");
      if (path.startsWith("/") || path.includes("..")) warnings.push(`${path || "File"} uses an unsafe path.`);
      const key = path.toLowerCase();
      if (paths.has(key)) warnings.push(`${path} is duplicated.`);
      paths.add(key);
    });
    if (draft.files.length && !draft.files.some((file) => file.is_entrypoint)) warnings.push("Choose one entrypoint file.");
    return warnings;
  }, [draft.files]);

  const draftIssues = useMemo(() => {
    const issues = [];
    const currentMode = draft.exercise.mode || "code";
    const currentConfig = EXERCISE_MODE_CONFIG[currentMode] || EXERCISE_MODE_CONFIG.code;
    const files = draft.files || [];
    const entryFile = files.find((file) => file.is_entrypoint) || files[0] || null;
    const hasLesson = Boolean(stripHtml(draft.exercise.instructions_md) || stripHtml(draft.exercise.theory_content));

    if (!String(draft.exercise.title || "").trim()) issues.push("Exercise title is required.");
    if (!hasLesson) issues.push("Add learner instructions or lesson content.");
    if (Number(draft.exercise.xp_reward) < 0) issues.push("XP reward cannot be negative.");
    if (fileWarnings.length) issues.push(...fileWarnings);

    if (currentConfig.hasFiles) {
      if (!files.length) issues.push("Add at least one workspace file.");
      if (files.length && !entryFile) issues.push("Choose an entrypoint file.");
    }

    if (currentConfig.tested) {
      if (!String(entryFile?.starter_code || "").trim()) issues.push("Add starter or broken code for the entry file.");
      if (!String(entryFile?.solution_code || "").trim()) issues.push("Add solution code for validation.");
      if (!draft.test_cases.length) {
        issues.push("Add at least one test case.");
      } else if (!draft.test_cases.some(hasExpectedOutput)) {
        issues.push("Add at least one non-empty accepted output.");
      }
    }

    if (currentMode === "frontend_preview" && !hasFrontendRules(draft.exercise.validation_config)) {
      issues.push("Add at least one frontend acceptance rule.");
    }

    if (currentMode === "quiz") {
      if (!draft.quiz.questions.length) issues.push("Add at least one quiz question.");
      draft.quiz.questions.forEach((question, index) => {
        const options = question.options || [];
        const correctCount = options.filter((option) => option.is_correct).length;
        if (!String(question.question_text || "").trim()) issues.push(`Question ${index + 1} needs text.`);
        if (options.length < 2) issues.push(`Question ${index + 1} needs at least two options.`);
        if (options.some((option) => !String(option.option_text || "").trim())) issues.push(`Question ${index + 1} has an empty option.`);
        if (correctCount !== 1) issues.push(`Question ${index + 1} needs exactly one correct option.`);
      });
    }

    if (currentMode === "theory" && !stripHtml(draft.exercise.theory_content || draft.exercise.instructions_md)) {
      issues.push("Add theory lesson content.");
    }

    return Array.from(new Set(issues));
  }, [draft, fileWarnings]);

  const curriculumTotals = useMemo(() => {
    return tree.reduce((totals, track) => {
      const sections = track.sections || [];
      totals.tracks += 1;
      totals.sections += sections.length;
      totals.exercises += sections.reduce((sum, section) => sum + (section.exercises?.length || 0), 0);
      if (track.is_published) totals.publishedTracks += 1;
      return totals;
    }, { tracks: 0, sections: 0, exercises: 0, publishedTracks: 0 });
  }, [tree]);

  return (
    <div className={`cs-root cs-root--${studioView}`}>
      {(error || notice) && (
        <div className={`cs-message ${error ? "is-error" : "is-notice"}`}>
          {error ? <AlertCircle size={16} /> : <Check size={16} />}
          <span>{error || notice}</span>
        </div>
      )}

      {studioView === "tracks" && renderTracksScreen()}
      {studioView === "track" && renderTrackWorkspace()}
      {studioView === "exercise" && renderExerciseStudioShell()}

      <MediaPickerModal
        isOpen={Boolean(mediaTarget)}
        onClose={() => setMediaTarget(null)}
        onSelect={(media) => {
          insertMediaUrl(getMediaUrl(media));
          setMediaTarget(null);
        }}
      />
      <BadgePickerModal
        isOpen={showBadgePicker}
        onClose={() => setShowBadgePicker(false)}
        onSelect={(badge) => {
          setSectionForm((current) => ({ ...current, badge_url: getMediaUrl(badge) }));
          setShowBadgePicker(false);
        }}
      />
      {renderDialog()}
    </div>
  );

  function renderTracksScreen() {
    return (
      <main className="cs-screen cs-track-index">
        <header className="cs-index-hero">
          <div>
            <span className="cs-kicker">Curriculum operations</span>
            <h1>Curriculum Builder</h1>
            <p>Manage banners, sections, exercises, and release checks from one compact workspace.</p>
          </div>
          <button type="button" className="cs-btn cs-btn--primary" onClick={openCreateTrackDialog} disabled={!canManageContent}>
            <Plus size={15} /> Create Track
          </button>
        </header>

        <section className="cs-index-toolbar" aria-label="Curriculum filters and totals">
          <div className="cs-index-toolbar__search">
            <div className="cs-global-search" role="search">
              <Search size={16} />
              <input aria-label="Search available tracks" value={treeFilter} onChange={(event) => setTreeFilter(event.target.value)} placeholder="Search available tracks" />
              {treeFilter && (
                <button type="button" onClick={() => setTreeFilter("")} aria-label="Clear track search">
                  <X size={14} />
                </button>
              )}
            </div>
            <span className="cs-search-meta">{filteredTracks.length} shown</span>
          </div>
          <div className="cs-stats-strip">
            <div className="cs-stat-card">
              <span className="cs-stat-card__icon"><Layers3 size={15} /></span>
              <span className="cs-stat-card__copy"><strong>{curriculumTotals.tracks}</strong><small>Tracks</small></span>
            </div>
            <div className="cs-stat-card">
              <span className="cs-stat-card__icon"><BookOpen size={15} /></span>
              <span className="cs-stat-card__copy"><strong>{curriculumTotals.sections}</strong><small>Sections</small></span>
            </div>
            <div className="cs-stat-card">
              <span className="cs-stat-card__icon cs-stat-card__icon--live"><CheckCircle2 size={15} /></span>
              <span className="cs-stat-card__copy"><strong>{curriculumTotals.publishedTracks}</strong><small>Live</small></span>
            </div>
          </div>
        </section>

        {loadingTree ? (
          <div className="cs-loading"><Loader2 className="cs-spin" size={24} /><p>Loading curriculum tracks...</p></div>
        ) : (
          <section className="cs-track-grid" aria-label="Available tracks">
            {filteredTracks.map((track) => {
              const sections = track.sections || [];
              const exerciseCount = sections.reduce((sum, section) => sum + (section.exercises?.length || 0), 0);
              return (
                <button type="button" className="cs-track-tile" key={track.id} onClick={() => selectNode({ type: "track", trackId: track.id })}>
                  <span
                    className={`cs-track-tile__image ${track.featured_image_url ? "has-image" : ""}`}
                    style={track.featured_image_url ? { backgroundImage: `url(${track.featured_image_url})` } : undefined}
                  >
                    {!track.featured_image_url && <Image size={24} />}
                  </span>
                  <span className="cs-track-tile__body">
                    <span className="cs-track-tile__top">
                      <strong>{track.title}</strong>
                      <StatusPill live={track.is_published}>{track.is_published ? "Live" : "Draft"}</StatusPill>
                    </span>
                    <span>{track.description || "No description added yet."}</span>
                    <span className="cs-track-tile__meta">
                      <small>{sections.length} sections</small>
                      <small>{exerciseCount} exercises</small>
                    </span>
                  </span>
                  <ChevronRight size={18} />
                </button>
              );
            })}
            {!filteredTracks.length && <EmptyState icon={Search} title="No tracks found">Create a track or clear the search filter.</EmptyState>}
          </section>
        )}
      </main>
    );
  }

  function renderTrackWorkspace() {
    if (!selectedTrack) {
      return <EmptyState title="Track not found">Go back to the track list and select an available track.</EmptyState>;
    }
    const sections = selectedTrack.sections || [];
    const exerciseCount = sections.reduce((sum, section) => sum + (section.exercises?.length || 0), 0);
    return (
      <main className="cs-screen cs-track-workspace">
        <header
          className={`cs-track-hero ${selectedTrack.featured_image_url ? "has-image" : ""}`}
          style={selectedTrack.featured_image_url ? { backgroundImage: `linear-gradient(90deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.84)), url(${selectedTrack.featured_image_url})` } : undefined}
        >
          <div>
            <nav className="cs-breadcrumb" aria-label="Breadcrumb">
              <button type="button" onClick={() => selectNode({ type: "tracks", trackId: null })}>Tracks</button>
              <ChevronRight size={14} />
              <span>{selectedTrack.title}</span>
            </nav>
            <span className="cs-kicker">Track map</span>
            <h1>{selectedTrack.title}</h1>
            <p>{selectedTrack.description || "Add a description in the track settings modal."}</p>
            <div className="cs-hero-metrics">
              <span>{sections.length} sections</span>
              <span>{exerciseCount} exercises</span>
              <StatusPill live={selectedTrack.is_published}>{selectedTrack.is_published ? "Live" : "Draft"}</StatusPill>
            </div>
          </div>
          <div className="cs-hero-actions">
            <button type="button" className="cs-btn cs-btn--ghost" onClick={() => selectNode({ type: "tracks", trackId: null })}>
              <ChevronRight className="cs-flip" size={14} /> Back to tracks
            </button>
            <button type="button" className="cs-btn cs-btn--ghost" onClick={openEditTrackDialog}>
              <Settings2 size={14} /> Edit Track
            </button>
            <button type="button" className="cs-btn cs-btn--ghost" onClick={openCreateSectionDialog} disabled={!canManageContent}>
              <Plus size={14} /> Add Section
            </button>
            {canPublishDelete && (
              <button type="button" className="cs-btn cs-btn--danger" onClick={openDeleteTrackDialog}>
                <Trash2 size={14} /> Delete Track
              </button>
            )}
            <button type="button" className="cs-btn cs-btn--primary" onClick={handleTrackPublishCheck} disabled={checking}>
              {checking ? <Loader2 className="cs-spin" size={14} /> : <CheckCircle2 size={14} />}
              Release Gate
            </button>
          </div>
        </header>

        {publishCheck && <section className="cs-status-strip">{renderPublishReadiness()}</section>}

        <section className="cs-section-flow">
          {sections.map((section, sectionIndex) => (
            <article className="cs-flow-section" key={section.id}>
              <header className="cs-flow-section__head">
                <div className="cs-section-number">{sectionIndex + 1}</div>
                <div>
                  <h2>{section.title}</h2>
                  <span>{(section.exercises || []).length} exercises</span>
                </div>
                {section.badge_url ? <img src={section.badge_url} alt="" /> : <BookOpen size={18} />}
                <div className="cs-flow-actions">
                  <button type="button" className="cs-btn cs-btn--ghost" onClick={() => openEditSectionDialog(section)}>Edit</button>
                  {canPublishDelete && (
                    <button type="button" className="cs-btn cs-btn--danger" onClick={() => openDeleteSectionDialog(section)}>
                      <Trash2 size={14} /> Delete
                    </button>
                  )}
                  <button type="button" className="cs-btn cs-btn--primary" onClick={() => openCreateExerciseDialog(section)} disabled={!canManageContent}>
                    <Plus size={14} /> Add Exercise
                  </button>
                </div>
              </header>
              <div className="cs-exercise-stack">
                {(section.exercises || []).map((exercise) => (
                  <div
                    className="cs-exercise-row"
                    key={exercise.id}
                  >
                    <FileCode2 size={15} />
                    <button
                      type="button"
                      className="cs-exercise-row__main"
                      onClick={() => selectNode({ type: "exercise", trackId: selectedTrack.id, sectionId: section.id, exerciseId: exercise.id })}
                    >
                      <span>{exercise.title}</span>
                    </button>
                    <small>{String(exercise.mode || "code").replaceAll("_", " ")}</small>
                    {canPublishDelete && (
                      <button type="button" className="cs-icon-btn cs-icon-btn--danger" onClick={() => openDeleteExerciseDialog(section, exercise)} title="Delete exercise">
                        <Trash2 size={14} />
                      </button>
                    )}
                    <ChevronRight size={15} />
                  </div>
                ))}
                {!(section.exercises || []).length && (
                  <button type="button" className="cs-exercise-empty" onClick={() => openCreateExerciseDialog(section)}>
                    <Plus size={15} /> Add the first exercise
                  </button>
                )}
              </div>
            </article>
          ))}
          {!sections.length && (
            <EmptyState icon={BookOpen} title="No sections yet">Add a section to start building this track.</EmptyState>
          )}
        </section>
      </main>
    );
  }

  function renderExerciseStudioShell() {
    if (loadingStudio) {
      return (
        <main className="cs-screen">
          <div className="cs-loading"><Loader2 className="cs-spin" size={24} /><p>Loading exercise studio...</p></div>
        </main>
      );
    }
    return (
      <main className="cs-screen cs-exercise-studio">
        <header className="cs-exercise-hero">
          <div>
            <nav className="cs-breadcrumb" aria-label="Breadcrumb">
              <button type="button" onClick={() => selectNode({ type: "tracks", trackId: null })}>Tracks</button>
              <ChevronRight size={14} />
              <button type="button" onClick={() => selectNode({ type: "track", trackId: selectedTrack?.id })}>{selectedTrack?.title || "Track"}</button>
              {selectedSection && <><ChevronRight size={14} /><span>{selectedSection.title}</span></>}
            </nav>
            <span className="cs-mode-kicker">{modeMeta.label}</span>
            <h1>{draft.exercise.title || selectedExercise?.title || "Exercise"}</h1>
            <p>{modeMeta.description}. The workbench below is shaped from this mode recipe, so unrelated controls stay out of the way.</p>
            <div className="cs-recipe-strip" aria-label={`${modeMeta.label} required setup`}>
              {getModeRecipe(mode).map((item) => <span key={item}>{item}</span>)}
            </div>
          </div>
          <div className="cs-hero-actions">
            <button type="button" className="cs-btn cs-btn--ghost" onClick={() => selectNode({ type: "track", trackId: selectedTrack?.id })}>
              <ChevronRight className="cs-flip" size={14} /> Back to track
            </button>
            {CODE_MODES.has(mode) && (
              <button type="button" className="cs-btn cs-btn--ghost" onClick={handleValidate} disabled={validating || saving}>
                {validating ? <Loader2 className="cs-spin" size={14} /> : <FlaskConical size={14} />}
                Validate
              </button>
            )}
            {canPublishDelete && selectedSection && selectedExercise && (
              <button type="button" className="cs-btn cs-btn--danger" onClick={() => openDeleteExerciseDialog(selectedSection, selectedExercise)}>
                <Trash2 size={14} /> Delete
              </button>
            )}
            <button type="button" className="cs-btn cs-btn--primary" onClick={handleSaveSelected} disabled={saving || !selectedNode?.exerciseId || !canManageContent}>
              {saving ? <Loader2 className="cs-spin" size={14} /> : <Save size={14} />}
              Save
            </button>
          </div>
        </header>
        {(publishCheck || validation || previewUrl || exerciseDirty || draftIssues.length > 0) && <section className="cs-status-strip">{renderExerciseSignals()}</section>}
        {renderExerciseEditor()}
      </main>
    );
  }

  function renderPublishReadiness() {
    const issueList = publishCheck?.issues || [];
    return (
      <div className="cs-status-card">
        <div className="cs-list-head">
          <h3>Release gate</h3>
          <StatusPill ready={publishCheck?.ready}>{publishCheck?.ready ? "Ready" : "Needs review"}</StatusPill>
        </div>
        {!issueList.length ? (
          <p>No blocking issues detected for the current check.</p>
        ) : (
          <ul className="cs-issue-list">
            {issueList.slice(0, 8).map((issue, index) => (
              <li key={`${issue.message}-${index}`} className={issue.severity === "warning" ? "is-warning" : ""}>
                {issue.severity === "warning" ? <AlertCircle size={13} /> : <ChevronRight size={13} />}
                <span>{issue.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  function renderExerciseSignals() {
    return (
      <>
        {exerciseDirty && (
          <div className="cs-status-card">
            <h3>Unsaved changes</h3>
            <p>Save the exercise before leaving this studio.</p>
          </div>
        )}
        {draftIssues.length > 0 && (
          <div className="cs-status-card">
            <div className="cs-list-head">
              <h3>Configuration checks</h3>
              <StatusPill>{draftIssues.length}</StatusPill>
            </div>
            <ul className="cs-issue-list">
              {draftIssues.slice(0, 6).map((issue, index) => (
                <li key={`${issue}-${index}`} className="is-warning">
                  <AlertCircle size={13} />
                  <span>{issue}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {publishCheck && renderPublishReadiness()}
        {validation && (
          <div className="cs-status-card">
            <h3>Check run</h3>
            <div className={`cs-validation ${validation.passed ? "is-pass" : "is-fail"}`}>
              <strong>{validation.verdict}</strong>
              <span>{validation.passed_cases} / {validation.total_cases} checks passed</span>
              {validation.error && <pre>{validation.error}</pre>}
              {(validation.visible_results || []).length > 0 && (
                <ul className="cs-result-list">
                  {validation.visible_results.map((item, index) => (
                    <li key={`${item.label}-${index}`} className={item.passed ? "is-pass" : "is-fail"}>
                      {item.passed ? <Check size={13} /> : <X size={13} />}
                      <span>{item.label}</span>
                      <small>{item.verdict}</small>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
        {previewUrl && (
          <div className="cs-status-card">
            <h3>Learner route</h3>
            <p>The student-facing route is prepared for this exercise.</p>
            <a className="cs-preview-link" href={previewUrl} target="_blank" rel="noreferrer">Open learner route</a>
          </div>
        )}
      </>
    );
  }

  function renderDialog() {
    if (!dialog) return null;
    const title = {
      "track-create": "New Track",
      "track-edit": "Edit Track",
      "section-create": "New Section",
      "section-edit": "Edit Section",
      "exercise-create": "New Exercise",
      "delete-track": "Delete Track",
      "delete-section": "Delete Section",
      "delete-exercise": "Delete Exercise",
    }[dialog.type] || "Studio";
    const scope = {
      "track-create": "Track",
      "track-edit": "Track",
      "section-create": "Section",
      "section-edit": "Section",
      "exercise-create": "Exercise",
      "delete-track": "Danger",
      "delete-section": "Danger",
      "delete-exercise": "Danger",
    }[dialog.type] || "Studio";
    const HeaderIcon = dialog.type?.startsWith("delete-") ? AlertCircle : Settings2;

    return (
      <div className="cs-modal-backdrop" role="presentation" onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeDialog();
      }}>
        <section className={`cs-modal ${dialog.type?.startsWith("delete-") ? "cs-modal--danger" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
          <header className="cs-modal__head">
            <div className="cs-modal__title">
              <span className="cs-modal__mark"><HeaderIcon size={17} /></span>
              <div className="cs-modal__copy">
                <span>Builder Console</span>
                <h2>{title}</h2>
              </div>
            </div>
            <div className="cs-modal__head-actions">
              <span className={`cs-modal__scope ${scope === "Danger" ? "is-danger" : ""}`}>{scope}</span>
              <button type="button" className="cs-icon-btn" onClick={closeDialog} title="Close"><X size={16} /></button>
            </div>
          </header>
          {(dialog.type === "track-create" || dialog.type === "track-edit") && renderTrackDialogForm()}
          {(dialog.type === "section-create" || dialog.type === "section-edit") && renderSectionDialogForm()}
          {dialog.type === "exercise-create" && renderExerciseDialogForm()}
          {dialog.type?.startsWith("delete-") && renderDeleteDialogForm()}
        </section>
      </div>
    );
  }

  function renderDeleteDialogForm() {
    const itemLabel = {
      "delete-track": "track",
      "delete-section": "section",
      "delete-exercise": "exercise",
    }[dialog.type] || "item";
    return (
      <div className="cs-modal__body">
        <div className="cs-danger-panel">
          <AlertCircle size={22} />
          <div>
            <strong>Delete {dialog.title || itemLabel}?</strong>
            <span>This permanently removes the selected {itemLabel} and its nested curriculum content.</span>
          </div>
        </div>
        <footer className="cs-modal__foot">
          <button type="button" className="cs-btn cs-btn--ghost" onClick={closeDialog}>Cancel</button>
          <button type="button" className="cs-btn cs-btn--danger" onClick={handleConfirmDelete} disabled={saving}>
            {saving ? <Loader2 className="cs-spin" size={14} /> : <Trash2 size={14} />}
            Delete
          </button>
        </footer>
      </div>
    );
  }

  function renderTrackDialogForm() {
    return (
      <form className="cs-modal__body" onSubmit={handleSubmitTrackForm}>
        <div className="cs-form-grid">
          <label>Track title<input value={trackForm.title} onChange={(event) => setTrackForm((current) => ({ ...current, title: event.target.value, slug: nextAutoSlug(current.slug, current.title, event.target.value) }))} autoFocus /></label>
          <label>Slug<input value={trackForm.slug} onChange={(event) => setTrackForm((current) => ({ ...current, slug: event.target.value }))} placeholder={slugify(trackForm.title)} /></label>
          <label>Language<select value={trackForm.language_id} onChange={(event) => setTrackForm((current) => ({ ...current, language_id: Number(event.target.value) }))}>{LANGUAGE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label className="cs-toggle"><input type="checkbox" checked={trackForm.is_published} disabled={!canPublishDelete} onChange={(event) => setTrackForm((current) => ({ ...current, is_published: event.target.checked }))} /> Published track</label>
          <label className="cs-field-full">Description<textarea value={trackForm.description} onChange={(event) => setTrackForm((current) => ({ ...current, description: event.target.value }))} rows={5} /></label>
          <label className="cs-field-full">Banner image URL <small>Recommended 1600 x 420 px, JPG/PNG/WebP</small><input value={trackForm.featured_image_url} onChange={(event) => setTrackForm((current) => ({ ...current, featured_image_url: event.target.value }))} placeholder="https://.../track-banner.webp" /></label>
        </div>
        <div className="cs-modal-preview">
          {trackForm.featured_image_url ? <img src={trackForm.featured_image_url} alt="" /> : <div><Image size={24} /><span>No banner selected<br />Use 1600 x 420 px</span></div>}
          <div className="cs-inline-actions">
            <button type="button" className="cs-btn cs-btn--ghost" onClick={() => setMediaTarget("track-form")}><Upload size={14} /> Pick image</button>
            {trackForm.featured_image_url && <button type="button" className="cs-btn cs-btn--danger" onClick={() => setTrackForm((current) => ({ ...current, featured_image_url: "" }))}><Trash2 size={14} /> Remove</button>}
          </div>
        </div>
        <footer className="cs-modal__foot">
          <button type="button" className="cs-btn cs-btn--ghost" onClick={closeDialog}>Cancel</button>
          <button type="submit" className="cs-btn cs-btn--primary" disabled={saving || !trackForm.title.trim()}>{saving ? <Loader2 className="cs-spin" size={14} /> : <Save size={14} />} Save Track</button>
        </footer>
      </form>
    );
  }

  function renderSectionDialogForm() {
    return (
      <form className="cs-modal__body" onSubmit={handleSubmitSectionForm}>
        <div className="cs-form-grid">
          <label>Section title<input value={sectionForm.title} onChange={(event) => setSectionForm((current) => ({ ...current, title: event.target.value, slug: nextAutoSlug(current.slug, current.title, event.target.value) }))} autoFocus /></label>
          <label>Slug<input value={sectionForm.slug} onChange={(event) => setSectionForm((current) => ({ ...current, slug: event.target.value }))} placeholder={slugify(sectionForm.title)} /></label>
          <label className="cs-field-full">Completion badge URL<input value={sectionForm.badge_url} onChange={(event) => setSectionForm((current) => ({ ...current, badge_url: event.target.value }))} /></label>
        </div>
        <div className="cs-inline-actions">
          <button type="button" className="cs-btn cs-btn--ghost" onClick={() => setShowBadgePicker(true)}><Award size={14} /> Pick badge</button>
          {sectionForm.badge_url && <button type="button" className="cs-btn cs-btn--danger" onClick={() => setSectionForm((current) => ({ ...current, badge_url: "" }))}><Trash2 size={14} /> Remove badge</button>}
        </div>
        {sectionForm.badge_url && <img className="cs-badge-preview" src={sectionForm.badge_url} alt="" />}
        <footer className="cs-modal__foot">
          <button type="button" className="cs-btn cs-btn--ghost" onClick={closeDialog}>Cancel</button>
          <button type="submit" className="cs-btn cs-btn--primary" disabled={saving || !sectionForm.title.trim()}>{saving ? <Loader2 className="cs-spin" size={14} /> : <Save size={14} />} Save Section</button>
        </footer>
      </form>
    );
  }

  function renderExerciseDialogForm() {
    const targetSection = (selectedTrack?.sections || []).find((section) => Number(section.id) === Number(exerciseForm.sectionId || dialog?.sectionId));
    return (
      <form className="cs-modal__body" onSubmit={handleSubmitExerciseForm}>
        <div className="cs-modal-note">
          <strong>{targetSection?.title || "Selected section"}</strong>
          <span>The exercise will open in the correct studio view after it is created.</span>
        </div>
        <div className="cs-form-grid">
          <label>Exercise title<input value={exerciseForm.title} onChange={(event) => setExerciseForm((current) => ({ ...current, title: event.target.value, slug: nextAutoSlug(current.slug, current.title, event.target.value) }))} autoFocus /></label>
          <label>Slug<input value={exerciseForm.slug} onChange={(event) => setExerciseForm((current) => ({ ...current, slug: event.target.value }))} placeholder={slugify(exerciseForm.title)} /></label>
          <label>Mode<select value={exerciseForm.mode} onChange={(event) => setExerciseForm((current) => ({ ...current, mode: event.target.value }))}>{MODE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <div className="cs-auto-order-card">
            <strong>Auto order</strong>
            <span>New exercise will be #{getNextExerciseOrder(exerciseForm.sectionId || dialog?.sectionId)} in this section.</span>
          </div>
        </div>
        <div className="cs-mode-preview">
          {(EXERCISE_MODE_CONFIG[exerciseForm.mode]?.tabs || EXERCISE_MODE_CONFIG.code.tabs).map((tab) => <span key={tab.key}>{tab.label}</span>)}
        </div>
        <footer className="cs-modal__foot">
          <button type="button" className="cs-btn cs-btn--ghost" onClick={closeDialog}>Cancel</button>
          <button type="submit" className="cs-btn cs-btn--primary" disabled={saving || !exerciseForm.title.trim()}>{saving ? <Loader2 className="cs-spin" size={14} /> : <Plus size={14} />} Create Exercise</button>
        </footer>
      </form>
    );
  }

  function renderExerciseEditor() {
    const activeStage = availableTabs.find((item) => item.key === activeTab) || availableTabs[0];
    const ActiveIcon = activeStage?.icon || Layers3;
    return (
      <section className="cs-workbench">
        <aside className="cs-step-rail" aria-label={`${modeMeta.label} workflow`}>
          <div className="cs-step-rail__head">
            <span>Build flow</span>
            <strong>{modeMeta.label}</strong>
          </div>
          {availableTabs.map(({ key, label, icon: Icon }, index) => (
            <button
              key={key}
              type="button"
              className={`cs-step-card ${activeTab === key ? "is-active" : ""}`}
              onClick={() => setActiveTab(key)}
            >
              <span className="cs-step-card__number">{index + 1}</span>
              <Icon size={15} />
              <span>
                <strong>{label}</strong>
              </span>
              <span className="cs-help-trigger cs-step-help" data-tooltip={getStageSummary(key, mode)} aria-label={getStageSummary(key, mode)}>
                <HelpCircle size={14} />
              </span>
            </button>
          ))}
        </aside>

        <article className="cs-stage-surface">
          <header className="cs-stage-header">
            <div>
              <span>{modeMeta.label} step</span>
              <h2><ActiveIcon size={18} /> {activeStage?.label || "Basics"}</h2>
              <p>{getStageSummary(activeStage?.key, mode)}</p>
            </div>
            <StatusPill ready={!draftIssues.length}>{draftIssues.length ? `${draftIssues.length} checks` : "Clean"}</StatusPill>
          </header>
          <div className="cs-stage-body">
            {activeTab === "overview" && renderExerciseOverview()}
            {activeTab === "lesson" && renderLessonEditor()}
            {activeTab === "workspace" && renderWorkspaceEditor()}
            {activeTab === "validation" && renderValidationEditor()}
            {activeTab === "quiz" && renderQuizEditor()}
            {activeTab === "hints" && renderHintsEditor()}
            {activeTab === "publish" && renderPublishEditor()}
          </div>
        </article>
      </section>
    );
  }

  function renderExerciseOverview() {
    const showPassingScore = TESTED_CODE_MODES.has(mode);
    const showAttempts = CODE_MODES.has(mode);
    const showAutoSubmit = CODE_MODES.has(mode);
    const modeChecklist = getModeChecklist(mode);

    return (
      <div className="cs-overview-layout">
        <section className="cs-setup-panel cs-setup-panel--modes">
          <div className="cs-section-title">
            <div>
              <span>Exercise type</span>
              <h2>Choose the editor shape</h2>
            </div>
          </div>
          <div className="cs-mode-grid">
            {MODE_OPTIONS.map((item) => (
              <button type="button" key={item.value} className={mode === item.value ? "is-active" : ""} onClick={() => updateMode(item.value)}>
                <item.icon size={16} />
                <strong>{item.label}</strong>
                <span className="cs-help-trigger" data-tooltip={item.description} aria-label={item.description}>
                  <HelpCircle size={14} />
                </span>
              </button>
            ))}
          </div>
        </section>

        <aside className="cs-setup-summary">
          <span className="cs-mode-kicker">{modeMeta.label}</span>
          <h3>{modeMeta.description}</h3>
          <div className="cs-setup-checklist">
            {modeChecklist.map((item) => (
              <span key={item}><Check size={13} /> {item}</span>
            ))}
          </div>
          {draftIssues.length > 0 ? (
            <div className="cs-setup-alert">
              <AlertCircle size={15} />
              <span>{draftIssues.length} item{draftIssues.length === 1 ? "" : "s"} need attention before release.</span>
            </div>
          ) : (
            <div className="cs-setup-alert is-clean">
              <CheckCircle2 size={15} />
              <span>Basics are clean for this mode.</span>
            </div>
          )}
        </aside>

        <section className="cs-setup-panel">
          <div className="cs-section-title">
            <div>
              <span>Identity</span>
              <h2>Name and sequence</h2>
            </div>
          </div>
          <div className="cs-form-grid">
            <label>Exercise title<input value={draft.exercise.title} onChange={(event) => updateExerciseTitle(event.target.value)} /></label>
            <label>Slug<input value={draft.exercise.slug} onChange={(event) => updateExercise("slug", event.target.value)} placeholder={slugify(draft.exercise.title)} /></label>
            <div className="cs-auto-order-card" aria-label="Automatic exercise order">
              <strong>Auto order</strong>
              <span>
                {selectedExercisePosition
                  ? `Exercise ${selectedExercisePosition.position} of ${selectedExercisePosition.total}`
                  : "Sequence is managed from the section list"}
              </span>
            </div>
          </div>
        </section>

        <section className="cs-setup-panel">
          <div className="cs-section-title">
            <div>
              <span>Access</span>
              <h2>Unlock and reward</h2>
            </div>
          </div>
          <div className="cs-form-grid">
            <label>Unlock rule<select value={draft.exercise.unlock_rule} onChange={(event) => updateExercise("unlock_rule", event.target.value)}><option value="previous_completed">Previous completed</option><option value="always">Always unlocked</option><option value="manual">Manual review</option></select></label>
            <label>XP reward<input type="number" value={draft.exercise.xp_reward} onChange={(event) => updateExercise("xp_reward", Number(event.target.value) || 0)} /></label>
            <label className="cs-toggle"><input type="checkbox" checked={draft.exercise.is_published} disabled={!canPublishDelete} onChange={(event) => updateExercise("is_published", event.target.checked)} /> Published exercise</label>
          </div>
        </section>

        {(showPassingScore || showAttempts || showAutoSubmit) && (
          <section className="cs-setup-panel">
            <div className="cs-section-title">
              <div>
                <span>Evaluation</span>
                <h2>{mode === "frontend_preview" ? "Preview rule behavior" : "Check behavior"}</h2>
              </div>
            </div>
            <div className="cs-form-grid">
              {showPassingScore && <label>Passing score<input type="number" value={draft.exercise.passing_score_pct} onChange={(event) => updateExercise("passing_score_pct", Number(event.target.value) || 70)} /></label>}
              {showAttempts && <label>Attempts allowed<input type="number" value={draft.exercise.attempts_allowed || ""} onChange={(event) => updateExercise("attempts_allowed", event.target.value ? Number(event.target.value) : null)} placeholder="Unlimited" /></label>}
              {showAutoSubmit && <label className="cs-toggle"><input type="checkbox" checked={draft.exercise.auto_submit_on_pass} onChange={(event) => updateExercise("auto_submit_on_pass", event.target.checked)} /> Auto-submit after passing checks</label>}
            </div>
          </section>
        )}
      </div>
    );
  }

  function renderLessonEditor() {
    return (
      <div className="cs-form-stack">
        <div className="cs-lesson-toolbar">
          <div className="cs-segmented">
            <button type="button" className={lessonSourceMode === "visual" ? "is-active" : ""} onClick={() => setLessonSourceMode("visual")}>Visual</button>
            <button type="button" className={lessonSourceMode === "source" ? "is-active" : ""} onClick={() => setLessonSourceMode("source")}>HTML</button>
          </div>
          <div className="cs-inline-actions">
            <button type="button" className="cs-btn cs-btn--ghost" onClick={() => setMediaTarget("instructions")}><Image size={14} /> Image in instructions</button>
            <button type="button" className="cs-btn cs-btn--ghost" onClick={() => setMediaTarget("theory")}><Image size={14} /> Image in theory</button>
          </div>
        </div>

        {lessonSourceMode === "visual" ? (
          <div className="cs-rich-grid">
            <div className="cs-rich-editor">
              <div className="cs-editor-label"><BookOpen size={14} /> Instructions</div>
              <ReactQuill ref={instructionQuillRef} theme="snow" value={draft.exercise.instructions_md} onChange={(value) => updateExercise("instructions_md", value)} modules={richModules} />
            </div>
            <div className="cs-rich-editor">
              <div className="cs-editor-label"><PanelRight size={14} /> Theory content</div>
              <ReactQuill ref={theoryQuillRef} theme="snow" value={draft.exercise.theory_content} onChange={(value) => updateExercise("theory_content", value)} modules={richModules} />
            </div>
          </div>
        ) : (
          <div className="cs-form-grid">
            <label className="cs-field-full">Instructions HTML<textarea value={draft.exercise.instructions_md} onChange={(event) => updateExercise("instructions_md", event.target.value)} rows={10} /></label>
            <label className="cs-field-full">Theory HTML<textarea value={draft.exercise.theory_content} onChange={(event) => updateExercise("theory_content", event.target.value)} rows={10} /></label>
          </div>
        )}

      </div>
    );
  }

  function renderWorkspaceEditor() {
    if (!CODE_MODES.has(mode)) return null;
    const supportsMultipleFiles = modeConfig.supportsMultipleFiles;
    return (
      <div className={`cs-files-layout ${supportsMultipleFiles ? "" : "cs-files-layout--single"}`}>
        {supportsMultipleFiles && (
          <div className="cs-file-rail">
            <div className="cs-list-head">
              <h3>Files</h3>
              <button type="button" className="cs-icon-btn" onClick={addFile} title="Add file"><FilePlus2 size={15} /></button>
            </div>
            <div className="cs-file-list">
              {draft.files.map((file, index) => (
                <button key={`${file.file_path}-${index}`} type="button" className={index === activeFileIndex ? "is-active" : ""} onClick={() => setActiveFileIndex(index)}>
                  <FileCode2 size={14} />
                  <span>{file.file_path}</span>
                  {file.is_entrypoint && <small>main</small>}
                </button>
              ))}
            </div>
            {fileWarnings.length > 0 && (
              <ul className="cs-warning-list">
                {fileWarnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}
              </ul>
            )}
          </div>
        )}

        {activeFile ? (
          <div className="cs-file-editor">
            <div className="cs-form-grid cs-form-grid--compact">
              <label>Path<input value={activeFile.file_path} onChange={(event) => updateFile(activeFileIndex, "file_path", event.target.value)} /></label>
              <label>Language<input value={activeFile.language} onChange={(event) => updateFile(activeFileIndex, "language", event.target.value)} /></label>
              <label className="cs-toggle"><input type="checkbox" checked={activeFile.is_editable} onChange={(event) => updateFile(activeFileIndex, "is_editable", event.target.checked)} /> Editable</label>
              {supportsMultipleFiles && <button type="button" className="cs-btn cs-btn--ghost" onClick={() => setEntrypoint(activeFileIndex)}>Set entrypoint</button>}
              {supportsMultipleFiles && <button type="button" className="cs-btn cs-btn--danger" onClick={() => removeFile(activeFileIndex)} disabled={draft.files.length <= 1}><Trash2 size={14} /> Remove</button>}
            </div>
            {!supportsMultipleFiles && fileWarnings.length > 0 && (
              <ul className="cs-warning-list">
                {fileWarnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}
              </ul>
            )}
            <div className="cs-code-columns">
              <div>
                <h3>{mode === "frontend_preview" ? "Workspace code" : "Starter / broken code"}</h3>
                <Editor height="360px" theme="vs-dark" language={editorLanguage(activeFile.file_path, activeFile.language)} value={activeFile.starter_code} onChange={(value) => updateFile(activeFileIndex, "starter_code", value || "")} options={{ minimap: { enabled: false }, fontSize: 13, wordWrap: "on", scrollBeyondLastLine: false }} />
              </div>
              <div>
                <h3>{mode === "frontend_preview" ? "Reference version" : "Solution code"}</h3>
                <Editor height="360px" theme="vs-dark" language={editorLanguage(activeFile.file_path, activeFile.language)} value={activeFile.solution_code} onChange={(value) => updateFile(activeFileIndex, "solution_code", value || "")} options={{ minimap: { enabled: false }, fontSize: 13, wordWrap: "on", scrollBeyondLastLine: false }} />
              </div>
            </div>
            {mode === "frontend_preview" && (
              <div className="cs-preview-frame">
                <div className="cs-list-head">
                  <h3>Live preview</h3>
                  <span>Uses starter workspace files</span>
                </div>
                <iframe title="Frontend preview" srcDoc={previewSrcDoc(draft.files)} sandbox="allow-scripts" />
              </div>
            )}
          </div>
        ) : (
          <EmptyState icon={FileCode2} title="No files">Add a file to define the learner workspace.</EmptyState>
        )}
      </div>
    );
  }

  function renderValidationEditor() {
    if (mode === "frontend_preview") {
      const config = normalizeConfig(draft.exercise.validation_config);
      return (
        <div className="cs-form-stack">
          <div className="cs-section-title">
            <div>
              <span>Guided frontend checks</span>
              <h2>Build acceptance rules without writing JSON</h2>
            </div>
          </div>
          <div className="cs-rule-grid">
            {FRONTEND_RULES.map(([key, label, placeholder]) => (
              <FieldList
                key={key}
                label={label}
                placeholder={placeholder}
                items={config[key]}
                onChange={(index, value) => updateConfigList(key, index, value)}
                onAdd={() => addConfigItem(key)}
                onRemove={(index) => removeConfigItem(key, index)}
              />
            ))}
          </div>
          <details className="cs-json-details">
            <summary>Generated validation config JSON</summary>
            <pre>{JSON.stringify(normalizeConfig(draft.exercise.validation_config), null, 2)}</pre>
          </details>
        </div>
      );
    }

    return (
      <div className="cs-form-stack">
        <div className="cs-list-head">
          <h3>Test cases</h3>
          <button type="button" className="cs-btn cs-btn--ghost" onClick={addTestCase}><Plus size={14} /> Add test</button>
        </div>
        {draft.test_cases.map((testCase, index) => (
          <div className="cs-test-card" key={`test-${index}`}>
            <div className="cs-form-grid cs-form-grid--compact">
              <label>Label<input value={testCase.label} onChange={(event) => updateTestCase(index, { label: event.target.value })} /></label>
              <label>Match<select value={testCase.match_mode} onChange={(event) => updateTestCase(index, { match_mode: event.target.value })}><option value="normalize">Smart match</option><option value="exact">Exact</option><option value="any_of">Any accepted output</option></select></label>
              <label>Timeout ms<input type="number" value={testCase.timeout_ms || ""} onChange={(event) => updateTestCase(index, { timeout_ms: Number(event.target.value) || null })} /></label>
              <label>Memory MB<input type="number" value={testCase.memory_limit_mb || ""} onChange={(event) => updateTestCase(index, { memory_limit_mb: Number(event.target.value) || null })} /></label>
              <label className="cs-toggle"><input type="checkbox" checked={testCase.is_hidden} onChange={(event) => updateTestCase(index, { is_hidden: event.target.checked })} /> Hidden</label>
              <button type="button" className="cs-btn cs-btn--danger" onClick={() => setDraft((current) => ({ ...current, test_cases: current.test_cases.filter((_, itemIndex) => itemIndex !== index) }))}><Trash2 size={14} /> Remove</button>
            </div>
            <label>Input stdin<textarea value={testCase.stdin} onChange={(event) => updateTestCase(index, { stdin: event.target.value })} rows={3} /></label>
            <div className="cs-rule-list">
              <div className="cs-list-head"><h3>Accepted outputs</h3><button type="button" className="cs-btn cs-btn--ghost" onClick={() => updateTestCase(index, { expected_outputs: [...(testCase.expected_outputs || [""]), ""] })}><Plus size={14} /> Add output</button></div>
              {(testCase.expected_outputs || [""]).map((output, outputIndex) => (
                <div className="cs-rule-row" key={`output-${index}-${outputIndex}`}>
                  <textarea value={output} onChange={(event) => {
                    const outputs = [...(testCase.expected_outputs || [""])];
                    outputs[outputIndex] = event.target.value;
                    updateTestCase(index, { expected_outputs: outputs, expected_stdout: outputs[0] || "" });
                  }} rows={2} placeholder="Expected stdout" />
                  <button type="button" className="cs-icon-btn" onClick={() => {
                    const outputs = (testCase.expected_outputs || [""]).filter((_, itemIndex) => itemIndex !== outputIndex);
                    updateTestCase(index, { expected_outputs: outputs.length ? outputs : [""], expected_stdout: outputs[0] || "" });
                  }}><X size={14} /></button>
                </div>
              ))}
            </div>
          </div>
        ))}
        {!draft.test_cases.length && <EmptyState icon={FlaskConical} title="No tests">Add at least one test case for code and project exercises.</EmptyState>}
      </div>
    );
  }

  function renderQuizEditor() {
    return (
      <div className="cs-form-stack">
        <div className="cs-form-grid">
          <label>Passing percent<input type="number" value={draft.quiz.passing_score_pct} onChange={(event) => setDraft((current) => ({ ...current, quiz: { ...current.quiz, passing_score_pct: Number(event.target.value) || 70 } }))} /></label>
          <label>Attempts allowed<input type="number" value={draft.quiz.attempts_allowed || ""} onChange={(event) => setDraft((current) => ({ ...current, quiz: { ...current.quiz, attempts_allowed: event.target.value ? Number(event.target.value) : null } }))} placeholder="Unlimited" /></label>
        </div>
        <button type="button" className="cs-btn cs-btn--ghost cs-align-start" onClick={addQuestion}><Plus size={14} /> Add question</button>
        {draft.quiz.questions.map((question, qIndex) => (
          <div className="cs-question-card" key={`question-${qIndex}`}>
            <div className="cs-list-head">
              <h3>Question {qIndex + 1}</h3>
              <button type="button" className="cs-icon-btn cs-icon-btn--danger" onClick={() => setDraft((current) => ({ ...current, quiz: { ...current.quiz, questions: current.quiz.questions.filter((_, itemIndex) => itemIndex !== qIndex) } }))}><Trash2 size={14} /></button>
            </div>
            <label>Question<textarea value={question.question_text} onChange={(event) => setDraft((current) => ({ ...current, quiz: { ...current.quiz, questions: current.quiz.questions.map((item, itemIndex) => itemIndex === qIndex ? { ...item, question_text: event.target.value } : item) } }))} rows={3} /></label>
            <label>Code snippet<textarea value={question.code_snippet} onChange={(event) => setDraft((current) => ({ ...current, quiz: { ...current.quiz, questions: current.quiz.questions.map((item, itemIndex) => itemIndex === qIndex ? { ...item, code_snippet: event.target.value } : item) } }))} rows={4} /></label>
            <label>Explanation<textarea value={question.explanation_md} onChange={(event) => setDraft((current) => ({ ...current, quiz: { ...current.quiz, questions: current.quiz.questions.map((item, itemIndex) => itemIndex === qIndex ? { ...item, explanation_md: event.target.value } : item) } }))} rows={3} /></label>
            <div className="cs-option-list">
              {question.options.map((option, optionIndex) => (
                <div key={`option-${qIndex}-${optionIndex}`} className="cs-option-row">
                  <input type="radio" name={`correct-${qIndex}`} checked={option.is_correct} onChange={() => setDraft((current) => ({ ...current, quiz: { ...current.quiz, questions: current.quiz.questions.map((item, itemIndex) => itemIndex === qIndex ? { ...item, options: item.options.map((opt, optIndex) => ({ ...opt, is_correct: optIndex === optionIndex })) } : item) } }))} />
                  <input value={option.option_text} onChange={(event) => setDraft((current) => ({ ...current, quiz: { ...current.quiz, questions: current.quiz.questions.map((item, itemIndex) => itemIndex === qIndex ? { ...item, options: item.options.map((opt, optIndex) => optIndex === optionIndex ? { ...opt, option_text: event.target.value } : opt) } : item) } }))} placeholder={`Option ${optionIndex + 1}`} />
                  <button type="button" className="cs-icon-btn" onClick={() => setDraft((current) => ({ ...current, quiz: { ...current.quiz, questions: current.quiz.questions.map((item, itemIndex) => itemIndex === qIndex ? { ...item, options: item.options.filter((_, optIndex) => optIndex !== optionIndex) } : item) } }))}><X size={14} /></button>
                </div>
              ))}
            </div>
            <button type="button" className="cs-btn cs-btn--ghost cs-align-start" onClick={() => setDraft((current) => ({ ...current, quiz: { ...current.quiz, questions: current.quiz.questions.map((item, itemIndex) => itemIndex === qIndex ? { ...item, options: [...item.options, { option_text: "", is_correct: false, explanation_md: "", order: item.options.length + 1 }] } : item) } }))}><Plus size={14} /> Add option</button>
          </div>
        ))}
        {!draft.quiz.questions.length && <EmptyState icon={ListChecks} title="No quiz questions">Add questions and choose one correct option per question.</EmptyState>}
      </div>
    );
  }

  function renderHintsEditor() {
    return (
      <div className="cs-form-stack">
        <div className="cs-form-grid">
          <label><Link2 size={14} /> Docs URL<input value={draft.exercise.docs_url} onChange={(event) => updateExercise("docs_url", event.target.value)} /></label>
          <label><Link2 size={14} /> Reference solution URL<input value={draft.exercise.reference_solution_url} onChange={(event) => updateExercise("reference_solution_url", event.target.value)} /></label>
        </div>
        <button type="button" className="cs-btn cs-btn--ghost cs-align-start" onClick={() => setDraft((current) => ({ ...current, hints: [...current.hints, { content_md: "", unlock_rule: "after_failed_run", penalty_xp: null, order: current.hints.length + 1 }] }))}><Plus size={14} /> Add hint</button>
        {draft.hints.map((hint, index) => (
          <div className="cs-test-card" key={`hint-${index}`}>
            <div className="cs-form-grid cs-form-grid--compact">
              <label>Unlock<select value={hint.unlock_rule} onChange={(event) => setDraft((current) => ({ ...current, hints: current.hints.map((item, itemIndex) => itemIndex === index ? { ...item, unlock_rule: event.target.value } : item) }))}><option value="always">Always</option><option value="after_first_run">After first run</option><option value="after_failed_run">After failed run</option></select></label>
              <label>XP penalty<input type="number" value={hint.penalty_xp || ""} onChange={(event) => setDraft((current) => ({ ...current, hints: current.hints.map((item, itemIndex) => itemIndex === index ? { ...item, penalty_xp: event.target.value ? Number(event.target.value) : null } : item) }))} /></label>
              <button type="button" className="cs-btn cs-btn--danger" onClick={() => setDraft((current) => ({ ...current, hints: current.hints.filter((_, itemIndex) => itemIndex !== index) }))}><Trash2 size={14} /> Remove</button>
            </div>
            <label>Hint content<textarea value={hint.content_md} onChange={(event) => setDraft((current) => ({ ...current, hints: current.hints.map((item, itemIndex) => itemIndex === index ? { ...item, content_md: event.target.value } : item) }))} rows={4} /></label>
          </div>
        ))}
        {!draft.hints.length && <p className="cs-muted">Hints are optional. Add them when learners need staged support.</p>}
      </div>
    );
  }

  function renderPublishEditor() {
    return (
      <div className="cs-form-stack">
        <div className="cs-publish-grid">
          {selectedNode?.type === "exercise" && (
            <div className="cs-publish-action">
              <Eye size={18} />
              <div>
                <strong>Learner route</strong>
                <span>Save current edits and prepare the student-facing route only when you need it.</span>
              </div>
              <button type="button" className="cs-btn cs-btn--ghost" onClick={handlePreview} disabled={saving}>Prepare route</button>
            </div>
          )}
          {selectedNode?.type === "exercise" && CODE_MODES.has(mode) && (
            <div className="cs-publish-action">
              <FlaskConical size={18} />
              <div>
                <strong>Solution validation</strong>
                <span>Runs saved solution files against tests and acceptance rules for this exercise type.</span>
              </div>
              <button type="button" className="cs-btn cs-btn--ghost" onClick={handleValidate} disabled={validating || saving}>
                {validating ? <Loader2 className="cs-spin" size={14} /> : <FlaskConical size={14} />}
                Validate
              </button>
            </div>
          )}
          {selectedNode?.trackId && (
            <div className="cs-publish-action">
              <CheckCircle2 size={18} />
              <div>
                <strong>Track readiness</strong>
                <span>Checks missing files, tests, quiz answers, and draft state before publishing.</span>
              </div>
              <button type="button" className="cs-btn cs-btn--ghost" onClick={handleTrackPublishCheck} disabled={checking}>
                {checking ? <Loader2 className="cs-spin" size={14} /> : <CheckCircle2 size={14} />}
                Refresh
              </button>
            </div>
          )}
        </div>
        {previewUrl && <a className="cs-preview-link" href={previewUrl} target="_blank" rel="noreferrer">Open learner route</a>}
      </div>
    );
  }

}

const richModules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline", "strike"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["blockquote", "code-block"],
    ["link", "image"],
    ["clean"],
  ],
};
