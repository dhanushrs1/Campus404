import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAlert } from "../../../shared/Alert/AlertContext.jsx";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  FileCode2,
  Folder,
  FolderOpen,
  ImagePlus,
  Plus,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import {
  createExercise,
  createSection,
  createTask,
  deleteExercise,
  deleteSection,
  deleteTask,
  deleteTrack,
  getExercises,
  getSections,
  getTasks,
  getTracks,
  reorderExercises,
  reorderSections,
  reorderTasks,
  updateExercise,
  updateSection,
  updateTask,
  updateTrack,
} from "../../../shared/curriculumApi.js";
import ExerciseStudio from "../studio/ExerciseStudio.jsx";
import MediaPickerModal from "../../media/components/MediaPickerModal.jsx";
import BadgePickerModal from "../../media/components/BadgePickerModal.jsx";
import "./TrackManagerShared.css";

const LANGUAGE_OPTIONS = [
  { value: 71, label: "Python (3.8.1)" },
  { value: 93, label: "JavaScript (Node.js 18.15.0)" },
  { value: 62, label: "Java (OpenJDK 13.0.1)" },
  { value: 54, label: "C++ (GCC 9.2.0)" },
  { value: 50, label: "C (GCC 9.2.0)" },
  { value: 73, label: "Rust (1.40.0)" },
  { value: 60, label: "Go (1.40.0)" },
];

const TRACK_EDITOR_QUERY_KEYS = [
  "trackPage",
  "mode",
  "trackId",
  "nodeType",
  "sectionId",
  "exerciseId",
  "taskId",
  "levelTab",
];

function formatTaskTitle(task) {
  return `Level ${task.step_number}`;
}

function moveWithSwap(list, index, direction) {
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= list.length) {
    return list;
  }

  const next = [...list];
  const current = next[index];
  next[index] = next[nextIndex];
  next[nextIndex] = current;
  return next;
}

function parseJsonSafe(value) {
  if (!value || !value.trim()) {
    return [];
  }
  return JSON.parse(value);
}

function toPositiveInt(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export default function TrackEditorPage({ trackId, onBackToList }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const hasHydratedFromUrl = useRef(false);

  const [tracks, setTracks] = useState([]);
  const [sectionsByTrack, setSectionsByTrack] = useState({});
  const [exercisesBySection, setExercisesBySection] = useState({});
  const [tasksByExercise, setTasksByExercise] = useState({});

  const [expanded, setExpanded] = useState({});
  const [branchLoading, setBranchLoading] = useState({});

  const [selectedNode, setSelectedNode] = useState({ type: "track", trackId });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newExerciseTitle, setNewExerciseTitle] = useState("");

  const [trackTitle, setTrackTitle] = useState("");
  const [trackDescription, setTrackDescription] = useState("");
  const [trackLanguageId, setTrackLanguageId] = useState("71");
  const [trackFeaturedImageUrl, setTrackFeaturedImageUrl] = useState("");
  const [trackIsPublished, setTrackIsPublished] = useState(false);

  const [sectionTitle, setSectionTitle] = useState("");
  const [sectionBadgeUrl, setSectionBadgeUrl] = useState("");
  const [exerciseTitle, setExerciseTitle] = useState("");
  const [exerciseMode, setExerciseMode] = useState("code");
  const [exerciseXpReward, setExerciseXpReward] = useState("20");
  const [exerciseUnlockRule, setExerciseUnlockRule] = useState("previous_completed");
  const [exerciseInstructionsMd, setExerciseInstructionsMd] = useState("");
  const [exerciseTheoryContent, setExerciseTheoryContent] = useState("");
  const [exerciseReferenceUrl, setExerciseReferenceUrl] = useState("");
  const [exerciseDocsUrl, setExerciseDocsUrl] = useState("");
  const [exercisePassingScorePct, setExercisePassingScorePct] = useState("70");
  const [exerciseAttemptsAllowed, setExerciseAttemptsAllowed] = useState("");
  const [exerciseAutoSubmitOnPass, setExerciseAutoSubmitOnPass] = useState(false);
  const [exerciseIsPublished, setExerciseIsPublished] = useState(true);

  const [taskInstructions, setTaskInstructions] = useState("");
  const [taskStarterCode, setTaskStarterCode] = useState("");
  const [taskSolutionCode, setTaskSolutionCode] = useState("");
  const [taskTestCases, setTaskTestCases] = useState("[]");

  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [showBadgePicker, setShowBadgePicker] = useState(false);
  const [studioExercise, setStudioExercise] = useState(null);
  const [levelTab, setLevelTab] = useState("theory");

  const { addAlert } = useAlert();

  const trackMap = useMemo(() => {
    return new Map(tracks.map((track) => [track.id, track]));
  }, [tracks]);

  const sectionMap = useMemo(() => {
    const map = new Map();
    Object.values(sectionsByTrack).forEach((sections) => {
      sections.forEach((section) => map.set(section.id, section));
    });
    return map;
  }, [sectionsByTrack]);

  const exerciseMap = useMemo(() => {
    const map = new Map();
    Object.values(exercisesBySection).forEach((exercises) => {
      exercises.forEach((exercise) => map.set(exercise.id, exercise));
    });
    return map;
  }, [exercisesBySection]);

  const taskMap = useMemo(() => {
    const map = new Map();
    Object.values(tasksByExercise).forEach((tasks) => {
      tasks.forEach((task) => map.set(task.id, task));
    });
    return map;
  }, [tasksByExercise]);

  useEffect(() => {
    void loadTracks();
  }, [trackId]);

  useEffect(() => {
    setSelectedNode({ type: "track", trackId });
    setExpanded((prev) => ({ ...prev, [`track-${trackId}`]: true }));
    void loadSections(trackId);
  }, [trackId]);

  useEffect(() => {
    if (!selectedNode) {
      return;
    }

    if (selectedNode.type === "track") {
      void loadSections(selectedNode.trackId);
    }

    if (selectedNode.type === "section") {
      void loadExercises(selectedNode.sectionId);
    }

    if (selectedNode.type === "exercise" || selectedNode.type === "task") {
      void loadTasks(selectedNode.exerciseId);
    }

    if (selectedNode.type === "track") {
      const track = trackMap.get(selectedNode.trackId);
      if (!track) {
        return;
      }
      setTrackTitle(track.title || "");
      setTrackDescription(track.description || "");
      setTrackLanguageId(String(track.language_id || 71));
      setTrackFeaturedImageUrl(track.featured_image_url || "");
      setTrackIsPublished(Boolean(track.is_published));
      return;
    }

    if (selectedNode.type === "section") {
      const section = sectionMap.get(selectedNode.sectionId);
      if (!section) {
        return;
      }
      setSectionTitle(section.title || "");
      setSectionBadgeUrl(section.badge_url || "");
      return;
    }

    if (selectedNode.type === "exercise") {
      const exercise = exerciseMap.get(selectedNode.exerciseId);
      if (!exercise) {
        return;
      }
      setExerciseTitle(exercise.title || "");
      setExerciseMode(exercise.mode || "code");
      setExerciseXpReward(String(exercise.xp_reward ?? 20));
      setExerciseUnlockRule(exercise.unlock_rule || "previous_completed");
      setExerciseInstructionsMd(exercise.instructions_md || "");
      setExerciseTheoryContent(exercise.theory_content || "");
      setExerciseReferenceUrl(exercise.reference_solution_url || "");
      setExerciseDocsUrl(exercise.docs_url || "");
      setExercisePassingScorePct(String(exercise.passing_score_pct ?? 70));
      setExerciseAttemptsAllowed(exercise.attempts_allowed ? String(exercise.attempts_allowed) : "");
      setExerciseAutoSubmitOnPass(Boolean(exercise.auto_submit_on_pass));
      setExerciseIsPublished(exercise.is_published !== false);
      return;
    }

    if (selectedNode.type === "task") {
      const task = taskMap.get(selectedNode.taskId);
      if (!task) {
        return;
      }
      setTaskInstructions(task.instructions_md || "");
      setTaskStarterCode(task.starter_code || "");
      setTaskSolutionCode(task.solution_code || "");
      setTaskTestCases(JSON.stringify(task.test_cases || [], null, 2));
    }
  }, [selectedNode, trackMap, sectionMap, exerciseMap, taskMap]);

  useEffect(() => {
    if (loading) {
      return;
    }

    const nodeType = searchParams.get("nodeType");
    const sectionId = toPositiveInt(searchParams.get("sectionId"));
    const exerciseId = toPositiveInt(searchParams.get("exerciseId"));
    const taskId = toPositiveInt(searchParams.get("taskId"));
    const levelTabParam = searchParams.get("levelTab");

    if (levelTabParam === "code" || levelTabParam === "theory") {
      setLevelTab(levelTabParam);
    } else {
      setLevelTab("theory");
    }

    let nextNode = {
      type: "track",
      trackId,
    };

    const nextExpanded = {
      [`track-${trackId}`]: true,
    };

    if (nodeType === "section" && sectionId) {
      nextNode = {
        type: "section",
        trackId,
        sectionId,
      };
      nextExpanded[`section-${sectionId}`] = true;
    }

    if (nodeType === "exercise" && sectionId && exerciseId) {
      nextNode = {
        type: "exercise",
        trackId,
        sectionId,
        exerciseId,
      };
      nextExpanded[`section-${sectionId}`] = true;
      nextExpanded[`exercise-${exerciseId}`] = true;
    }

    if (nodeType === "task" && sectionId && exerciseId && taskId) {
      nextNode = {
        type: "task",
        trackId,
        sectionId,
        exerciseId,
        taskId,
      };
      nextExpanded[`section-${sectionId}`] = true;
      nextExpanded[`exercise-${exerciseId}`] = true;
    }

    setExpanded((prev) => ({ ...prev, ...nextExpanded }));
    setSelectedNode(nextNode);

    hasHydratedFromUrl.current = true;
  }, [loading, searchParams, trackId]);

  useEffect(() => {
    if (!hasHydratedFromUrl.current || loading) {
      return;
    }

    const next = new URLSearchParams(searchParams);
    TRACK_EDITOR_QUERY_KEYS.forEach((queryKey) => next.delete(queryKey));

    next.set("tab", "tracks");
    next.set("trackPage", "editor");
    next.set("trackId", String(trackId));

    const node =
      selectedNode && selectedNode.trackId === trackId
        ? selectedNode
        : { type: "track", trackId };

    next.set("nodeType", node.type);

    if (node.sectionId) {
      next.set("sectionId", String(node.sectionId));
    }

    if (node.exerciseId) {
      next.set("exerciseId", String(node.exerciseId));
    }

    if (node.taskId) {
      next.set("taskId", String(node.taskId));
    }

    if (node.type === "task" && levelTab === "code") {
      next.set("levelTab", "code");
    }

    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [levelTab, loading, searchParams, selectedNode, setSearchParams, trackId]);

  async function loadTracks() {
    setLoading(true);
    setError("");
    try {
      const data = await getTracks();
      setTracks(data || []);
    } catch (err) {
      setError(err.message || "Failed to load tracks.");
    } finally {
      setLoading(false);
    }
  }

  async function loadSections(currentTrackId, force = false) {
    if (!force && sectionsByTrack[currentTrackId]) {
      return;
    }

    const key = `track-${currentTrackId}`;
    setBranchLoading((prev) => ({ ...prev, [key]: true }));
    try {
      const data = await getSections(currentTrackId);
      setSectionsByTrack((prev) => ({ ...prev, [currentTrackId]: data || [] }));
    } catch (err) {
      setError(err.message || "Failed to load sections.");
    } finally {
      setBranchLoading((prev) => ({ ...prev, [key]: false }));
    }
  }

  async function loadExercises(sectionId, force = false) {
    if (!force && exercisesBySection[sectionId]) {
      return;
    }

    const key = `section-${sectionId}`;
    setBranchLoading((prev) => ({ ...prev, [key]: true }));
    try {
      const data = await getExercises(sectionId);
      setExercisesBySection((prev) => ({ ...prev, [sectionId]: data || [] }));
    } catch (err) {
      setError(err.message || "Failed to load exercises.");
    } finally {
      setBranchLoading((prev) => ({ ...prev, [key]: false }));
    }
  }

  async function loadTasks(exerciseId, force = false) {
    if (!force && tasksByExercise[exerciseId]) {
      return;
    }

    const key = `exercise-${exerciseId}`;
    setBranchLoading((prev) => ({ ...prev, [key]: true }));
    try {
      const data = await getTasks(exerciseId);
      setTasksByExercise((prev) => ({ ...prev, [exerciseId]: data || [] }));
    } catch (err) {
      setError(err.message || "Failed to load levels.");
    } finally {
      setBranchLoading((prev) => ({ ...prev, [key]: false }));
    }
  }

  function isExpanded(key) {
    return Boolean(expanded[key]);
  }

  async function toggleTrack(currentTrackId) {
    const key = `track-${currentTrackId}`;
    const nextExpanded = !isExpanded(key);
    setExpanded((prev) => ({ ...prev, [key]: nextExpanded }));
    if (nextExpanded) {
      await loadSections(currentTrackId);
    }
  }

  async function toggleSection(sectionId) {
    const key = `section-${sectionId}`;
    const nextExpanded = !isExpanded(key);
    setExpanded((prev) => ({ ...prev, [key]: nextExpanded }));
    if (nextExpanded) {
      await loadExercises(sectionId);
    }
  }

  async function toggleExercise(exerciseId) {
    const key = `exercise-${exerciseId}`;
    const nextExpanded = !isExpanded(key);
    setExpanded((prev) => ({ ...prev, [key]: nextExpanded }));
    if (nextExpanded) {
      await loadTasks(exerciseId);
    }
  }

  async function handleSaveTrack() {
    if (!selectedNode || selectedNode.type !== "track") {
      return;
    }

    setSaving(true);
    setError("");
    try {
      await updateTrack(selectedNode.trackId, {
        title: trackTitle.trim(),
        description: trackDescription.trim(),
        language_id: Number(trackLanguageId),
        featured_image_url: trackFeaturedImageUrl.trim(),
        is_published: trackIsPublished,
      });
      await loadTracks();
      addAlert("Track saved successfully!", "success");
    } catch (err) {
      setError(err.message || "Failed to save track.");
      addAlert(err.message || "Failed to save track.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteTrack(currentTrackId) {
    const ok = window.confirm("Delete this track and all nested items?");
    if (!ok) {
      return;
    }

    setSaving(true);
    setError("");
    try {
      await deleteTrack(currentTrackId);
      await loadTracks();
      onBackToList?.();
    } catch (err) {
      setError(err.message || "Failed to delete track.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateSection(currentTrackId) {
    if (!newSectionTitle.trim()) {
      return;
    }

    setSaving(true);
    setError("");
    try {
      await createSection(currentTrackId, { title: newSectionTitle.trim() });
      setNewSectionTitle("");
      await loadSections(currentTrackId, true);
      setExpanded((prev) => ({ ...prev, [`track-${currentTrackId}`]: true }));
    } catch (err) {
      setError(err.message || "Failed to create section.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveSection() {
    if (!selectedNode || selectedNode.type !== "section") {
      return;
    }

    if (sectionBadgeUrl) {
      const allSections = Array.from(sectionMap.values());
      const isDuplicate = allSections.some(
        sec => sec.id !== selectedNode.sectionId && sec.badge_url === sectionBadgeUrl
      );
      if (isDuplicate) {
        setError("This badge is already assigned to another section. Please pick a unique badge.");
        addAlert("This badge is already assigned to another section. Please pick a unique badge.", "error");
        return;
      }
    }

    setSaving(true);
    setError("");
    try {
      await updateSection(selectedNode.sectionId, { 
        title: sectionTitle.trim(),
        badge_url: sectionBadgeUrl 
      });
      await loadSections(selectedNode.trackId, true);
      addAlert("Section saved successfully!", "success");
    } catch (err) {
      setError(err.message || "Failed to save section.");
      addAlert(err.message || "Failed to save section.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSection(currentTrackId, sectionId) {
    const ok = window.confirm("Delete this section and all exercises in it?");
    if (!ok) {
      return;
    }

    setSaving(true);
    setError("");
    try {
      await deleteSection(sectionId);
      setSelectedNode({ type: "track", trackId: currentTrackId });
      await loadSections(currentTrackId, true);
    } catch (err) {
      setError(err.message || "Failed to delete section.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSectionMove(currentTrackId, sectionId, direction) {
    const sections = sectionsByTrack[currentTrackId] || [];
    const index = sections.findIndex((section) => section.id === sectionId);
    const reordered = moveWithSwap(sections, index, direction);
    if (reordered === sections) {
      return;
    }

    setSectionsByTrack((prev) => ({ ...prev, [currentTrackId]: reordered }));
    try {
      await reorderSections(reordered.map((section) => section.id));
    } catch (err) {
      setError(err.message || "Failed to reorder sections.");
      await loadSections(currentTrackId, true);
    }
  }

  async function handleCreateExercise(sectionId) {
    if (!newExerciseTitle.trim()) {
      return;
    }

    setSaving(true);
    setError("");
    try {
      await createExercise(sectionId, { title: newExerciseTitle.trim(), mode: "code", xp_reward: 20 });
      setNewExerciseTitle("");
      await loadExercises(sectionId, true);
      setExpanded((prev) => ({ ...prev, [`section-${sectionId}`]: true }));
    } catch (err) {
      setError(err.message || "Failed to create exercise.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveExercise() {
    if (!selectedNode || selectedNode.type !== "exercise") {
      return;
    }

    setSaving(true);
    setError("");
    try {
      await updateExercise(selectedNode.exerciseId, {
        title: exerciseTitle.trim(),
        mode: exerciseMode,
        xp_reward: Number(exerciseXpReward) || 0,
        unlock_rule: exerciseUnlockRule,
        instructions_md: exerciseInstructionsMd,
        theory_content: exerciseTheoryContent,
        reference_solution_url: exerciseReferenceUrl.trim(),
        docs_url: exerciseDocsUrl.trim(),
        passing_score_pct: Number(exercisePassingScorePct) || 70,
        attempts_allowed: exerciseAttemptsAllowed ? Number(exerciseAttemptsAllowed) : null,
        auto_submit_on_pass: exerciseAutoSubmitOnPass,
        is_published: exerciseIsPublished,
      });
      await loadExercises(selectedNode.sectionId, true);
      addAlert("Exercise saved successfully!", "success");
    } catch (err) {
      setError(err.message || "Failed to save exercise.");
      addAlert(err.message || "Failed to save exercise.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteExercise(sectionId, exerciseId) {
    const ok = window.confirm("Delete this exercise and all levels?");
    if (!ok) {
      return;
    }

    setSaving(true);
    setError("");
    try {
      await deleteExercise(exerciseId);
      setSelectedNode({ type: "section", sectionId, trackId: selectedNode?.trackId || trackId });
      await loadExercises(sectionId, true);
    } catch (err) {
      setError(err.message || "Failed to delete exercise.");
    } finally {
      setSaving(false);
    }
  }

  async function handleExerciseMove(sectionId, exerciseId, direction) {
    const exercises = exercisesBySection[sectionId] || [];
    const index = exercises.findIndex((exercise) => exercise.id === exerciseId);
    const reordered = moveWithSwap(exercises, index, direction);
    if (reordered === exercises) {
      return;
    }

    setExercisesBySection((prev) => ({ ...prev, [sectionId]: reordered }));
    try {
      await reorderExercises(reordered.map((exercise) => exercise.id));
    } catch (err) {
      setError(err.message || "Failed to reorder exercises.");
      await loadExercises(sectionId, true);
    }
  }

  async function handleCreateTask(exerciseId) {
    setSaving(true);
    setError("");
    try {
      const existing = tasksByExercise[exerciseId] || [];
      const nextLevelNumber = existing.length + 1;

      await createTask(exerciseId, {
        step_number: nextLevelNumber,
        instructions_md: `# Level ${nextLevelNumber}\n\nDescribe the level objective here.`,
        starter_code: "",
        solution_code: "",
        test_cases: [],
      });

      await loadTasks(exerciseId, true);
      setExpanded((prev) => ({ ...prev, [`exercise-${exerciseId}`]: true }));
    } catch (err) {
      setError(err.message || "Failed to create level.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveTask() {
    if (!selectedNode || selectedNode.type !== "task") {
      return;
    }

    let parsedTestCases;
    try {
      parsedTestCases = parseJsonSafe(taskTestCases);
    } catch {
      setError("Levels test cases must be valid JSON.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await updateTask(selectedNode.taskId, {
        instructions_md: taskInstructions,
        starter_code: taskStarterCode,
        solution_code: taskSolutionCode,
        test_cases: parsedTestCases,
      });
      await loadTasks(selectedNode.exerciseId, true);
      addAlert("Level saved successfully!", "success");
    } catch (err) {
      setError(err.message || "Failed to save level.");
      addAlert(err.message || "Failed to save level.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteTask(exerciseId, taskId) {
    const ok = window.confirm("Delete this level?");
    if (!ok) {
      return;
    }

    setSaving(true);
    setError("");
    try {
      await deleteTask(taskId);
      setSelectedNode({
        type: "exercise",
        exerciseId,
        sectionId: selectedNode?.sectionId || null,
        trackId: selectedNode?.trackId || trackId,
      });
      await loadTasks(exerciseId, true);
    } catch (err) {
      setError(err.message || "Failed to delete level.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTaskMove(exerciseId, taskId, direction) {
    const tasks = tasksByExercise[exerciseId] || [];
    const index = tasks.findIndex((task) => task.id === taskId);
    const reordered = moveWithSwap(tasks, index, direction);
    if (reordered === tasks) {
      return;
    }

    setTasksByExercise((prev) => ({ ...prev, [exerciseId]: reordered }));
    try {
      await reorderTasks(reordered.map((task) => task.id));
      await loadTasks(exerciseId, true);
    } catch (err) {
      setError(err.message || "Failed to reorder levels.");
      await loadTasks(exerciseId, true);
    }
  }

  async function handleMediaSelect(item) {
    if (item && item.url) {
      if (selectedNode && selectedNode.type === "track") {
        setTrackFeaturedImageUrl(item.url);
        try {
          await updateTrack(selectedNode.trackId, {
            featured_image_url: item.url,
          });
          await loadTracks();
        } catch (err) {
          setError(err.message || "Failed to update featured image.");
        }
      }
    }
    setShowMediaPicker(false);
  }

  async function handleBadgeSelect(item) {
    if (item && item.url) {
      if (selectedNode && selectedNode.type === "section") {
        const allSections = Array.from(sectionMap.values());
        const isDuplicate = allSections.some(
          (sec) => sec.id !== selectedNode.sectionId && sec.badge_url === item.url
        );
        if (isDuplicate) {
          setError("This badge is already assigned to another section. Please pick a unique badge.");
          addAlert("This badge is already assigned to another section. Please pick a unique badge.", "error");
          setShowBadgePicker(false);
          return;
        }

        setSectionBadgeUrl(item.url);
        try {
          await updateSection(selectedNode.sectionId, {
            badge_url: item.url,
          });
          await loadSections(selectedNode.trackId, true);
        } catch (err) {
          setError(err.message || "Failed to update badge image.");
        }
      }
    }
    setShowBadgePicker(false);
  }

  function renderTree() {
    if (loading) {
      return <div className="cfm-tree-empty">Loading curriculum...</div>;
    }

    const filteredTracks = tracks.filter((track) => track.id === trackId);

    if (!filteredTracks.length) {
      return <div className="cfm-tree-empty">Track not found. Go back to track list.</div>;
    }

    return (
      <ul className="cfm-tree-list">
        {filteredTracks.map((track) => {
          const trackKey = `track-${track.id}`;
          const sections = sectionsByTrack[track.id] || [];
          const trackOpen = isExpanded(trackKey);
          const trackSelected = selectedNode?.type === "track" && selectedNode?.trackId === track.id;

          return (
            <li key={track.id}>
              <div className={`cfm-node-row cfm-node-row--track ${trackSelected ? "is-selected" : ""}`}>
                <button
                  type="button"
                  className="cfm-node-expand"
                  onClick={() => void toggleTrack(track.id)}
                  title={trackOpen ? "Collapse track" : "Expand track"}
                >
                  {trackOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                <button
                  type="button"
                  className="cfm-node-main"
                  onClick={() => setSelectedNode({ type: "track", trackId: track.id })}
                >
                  {trackOpen ? <FolderOpen size={15} /> : <Folder size={15} />}
                  <span className="cfm-node-label">{track.title}</span>
                </button>
              </div>

              {trackOpen && (
                <div className="cfm-children">
                  {branchLoading[trackKey] && <div className="cfm-loading-row">Loading sections...</div>}
                  {!branchLoading[trackKey] && sections.length === 0 && (
                    <div className="cfm-loading-row cfm-loading-row--muted">No sections</div>
                  )}

                  {!branchLoading[trackKey] && sections.map((section) => {
                    const sectionKey = `section-${section.id}`;
                    const exercises = exercisesBySection[section.id] || [];
                    const sectionOpen = isExpanded(sectionKey);
                    const sectionSelected = selectedNode?.type === "section" && selectedNode?.sectionId === section.id;

                    return (
                      <div key={section.id}>
                        <div className={`cfm-node-row cfm-node-row--section ${sectionSelected ? "is-selected" : ""}`}>
                          <button
                            type="button"
                            className="cfm-node-expand"
                            onClick={() => void toggleSection(section.id)}
                            title={sectionOpen ? "Collapse section" : "Expand section"}
                          >
                            {sectionOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                          <button
                            type="button"
                            className="cfm-node-main"
                            onClick={() =>
                              setSelectedNode({
                                type: "section",
                                sectionId: section.id,
                                trackId: track.id,
                              })
                            }
                          >
                            <BookOpen size={14} />
                            <span className="cfm-node-label">{section.title}</span>
                          </button>
                        </div>

                        {sectionOpen && (
                          <div className="cfm-children">
                            {branchLoading[sectionKey] && <div className="cfm-loading-row">Loading exercises...</div>}
                            {!branchLoading[sectionKey] && exercises.length === 0 && (
                              <div className="cfm-loading-row cfm-loading-row--muted">No exercises</div>
                            )}

                            {!branchLoading[sectionKey] && exercises.map((exercise) => {
                              const exerciseKey = `exercise-${exercise.id}`;
                              const tasks = tasksByExercise[exercise.id] || [];
                              const exerciseOpen = isExpanded(exerciseKey);
                              const exerciseSelected = selectedNode?.type === "exercise" && selectedNode?.exerciseId === exercise.id;

                              return (
                                <div key={exercise.id}>
                                  <div className={`cfm-node-row cfm-node-row--exercise ${exerciseSelected ? "is-selected" : ""}`}>
                                    <button
                                      type="button"
                                      className="cfm-node-expand"
                                      onClick={() => void toggleExercise(exercise.id)}
                                      title={exerciseOpen ? "Collapse exercise" : "Expand exercise"}
                                    >
                                      {exerciseOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    </button>
                                    <button
                                      type="button"
                                      className="cfm-node-main"
                                      onClick={() =>
                                        setSelectedNode({
                                          type: "exercise",
                                          trackId: track.id,
                                          sectionId: section.id,
                                          exerciseId: exercise.id,
                                        })
                                      }
                                    >
                                      <FileCode2 size={14} />
                                      <span className="cfm-node-label">{exercise.title}</span>
                                    </button>
                                  </div>

                                  {exerciseOpen && (
                                    <div className="cfm-children">
                                      {branchLoading[exerciseKey] && <div className="cfm-loading-row">Loading levels...</div>}
                                      {!branchLoading[exerciseKey] && tasks.length === 0 && (
                                        <div className="cfm-loading-row cfm-loading-row--muted">No levels</div>
                                      )}

                                      {!branchLoading[exerciseKey] && tasks.map((task) => {
                                        const taskSelected = selectedNode?.type === "task" && selectedNode?.taskId === task.id;

                                        return (
                                          <div
                                            key={task.id}
                                            className={`cfm-node-row cfm-node-row--task ${taskSelected ? "is-selected" : ""}`}
                                          >
                                            <span className="cfm-node-expand cfm-node-expand--leaf" />
                                            <button
                                              type="button"
                                              className="cfm-node-main"
                                              onClick={() =>
                                                setSelectedNode({
                                                  type: "task",
                                                  trackId: track.id,
                                                  sectionId: section.id,
                                                  exerciseId: exercise.id,
                                                  taskId: task.id,
                                                })
                                              }
                                            >
                                              <span className="cfm-level-dot" />
                                              <span className="cfm-node-label">{formatTaskTitle(task)}</span>
                                            </button>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  function renderTrackPanel() {
    if (!selectedNode || selectedNode.type !== "track") {
      return null;
    }

    const track = trackMap.get(selectedNode.trackId);
    if (!track) {
      return null;
    }

    const sections = sectionsByTrack[track.id] || [];

    return (
      <div className="cfm-editor-panel">
        <div className="cfm-editor-header">
          <h3>Track Settings</h3>
          <div className="cfm-editor-actions">
            <label className="cfm-status-toggle">
              <input
                type="checkbox"
                checked={trackIsPublished}
                onChange={(e) => setTrackIsPublished(e.target.checked)}
              />
              <span className={`cfm-status-badge ${trackIsPublished ? 'published' : 'draft'}`}>
                {trackIsPublished ? 'Published' : 'Draft'}
              </span>
            </label>
            <button type="button" className="cfm-btn cfm-btn--danger" onClick={() => void handleDeleteTrack(track.id)}>
              <Trash2 size={14} /> Delete Track
            </button>
          </div>
        </div>

        <div className="cfm-fields-grid">
          <label>
            <span>Title</span>
            <input value={trackTitle} onChange={(event) => setTrackTitle(event.target.value)} />
          </label>

          <label>
            <span>Language</span>
            <select value={trackLanguageId} onChange={(event) => setTrackLanguageId(event.target.value)}>
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="cfm-field-full">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Description</span>
              <span style={{ fontSize: '0.75rem', color: trackDescription.length > 160 ? 'var(--state-error)' : 'var(--text-secondary)' }}>
                {trackDescription.length} / 160
              </span>
            </div>
            <textarea
              rows={3}
              value={trackDescription}
              onChange={(event) => setTrackDescription(event.target.value.slice(0, 160))}
              placeholder="Track description"
              maxLength={160}
            />
          </label>
        </div>

        <div className="cfm-image-upload-box">
          <div className="cfm-image-upload-box__header">
            <ImagePlus size={18} />
            <strong>Banner Image</strong>
          </div>
          <p>
            Select an image from the Media Library or upload a new one to
            link it to this track. We recommend a wide horizontal banner format.
          </p>

          {!trackFeaturedImageUrl ? (
            <div className="cfm-image-upload-box__row">
              <button
                type="button"
                className="cfm-btn cfm-btn--ghost"
                onClick={() => setShowMediaPicker(true)}
              >
                <Upload size={14} /> Select from Media Library
              </button>
            </div>
          ) : (
            <div className="cfm-image-preview-container cfm-banner-preview">
              <img
                src={trackFeaturedImageUrl}
                alt="Track banner"
                className="cfm-image-preview"
              />
              <div className="cfm-image-preview-overlay">
                <button
                  type="button"
                  title="Replace image"
                  className="cfm-btn cfm-btn--ghost"
                  onClick={() => setShowMediaPicker(true)}
                >
                  <Upload size={14} /> Replace
                </button>
                <button
                  type="button"
                  title="Remove image"
                  className="cfm-btn cfm-btn--danger"
                  onClick={() => setTrackFeaturedImageUrl("")}
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="cfm-editor-footer">
          <button type="button" className="cfm-btn" onClick={() => void handleSaveTrack()} disabled={saving}>
            <Save size={14} /> Save Track
          </button>
        </div>

        <div className="cfm-sublist-box">
          <div className="cfm-sublist-box__header">
            <h4>Sections in this Track</h4>
          </div>

          <div className="cfm-inline-create">
            <input
              value={newSectionTitle}
              onChange={(event) => setNewSectionTitle(event.target.value)}
              placeholder="New section title"
            />
            <button type="button" className="cfm-btn cfm-btn--ghost" onClick={() => void handleCreateSection(track.id)}>
              <Plus size={14} /> Add Section
            </button>
          </div>

          <ul className="cfm-sublist">
            {sections.map((section, index) => (
              <li key={section.id}>
                <button
                  type="button"
                  className="cfm-sublist-link"
                  onClick={() =>
                    setSelectedNode({
                      type: "section",
                      trackId: track.id,
                      sectionId: section.id,
                    })
                  }
                >
                  {section.title}
                </button>
                {section.badge_url && (
                  <div className="cfm-sublist-badge" style={{ display: 'flex', alignItems: 'center', margin: '0 12px', opacity: 0.8 }}>
                    <img src={section.badge_url} alt="Badge" style={{ width: '28px', height: '28px', objectFit: 'contain' }} title="Assigned Badge" />
                  </div>
                )}
                <div className="cfm-sublist-actions">
                  <button type="button" onClick={() => void handleSectionMove(track.id, section.id, -1)} disabled={index === 0} title="Move up">&#8593;</button>
                  <button type="button" onClick={() => void handleSectionMove(track.id, section.id, 1)} disabled={index === sections.length - 1} title="Move down">&#8595;</button>
                  <button
                    type="button"
                    className="cfm-sublist-delete"
                    onClick={() => void handleDeleteSection(track.id, section.id)}
                    title="Delete section"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  function renderSectionPanel() {
    if (!selectedNode || selectedNode.type !== "section") {
      return null;
    }

    const section = sectionMap.get(selectedNode.sectionId);
    if (!section) {
      return null;
    }

    const exercises = exercisesBySection[section.id] || [];

    return (
      <div className="cfm-editor-panel">
        <div className="cfm-editor-header">
          <h3>Section Settings</h3>
          <button
            type="button"
            className="cfm-btn cfm-btn--danger"
            onClick={() => void handleDeleteSection(selectedNode.trackId, section.id)}
          >
            <Trash2 size={14} /> Delete Section
          </button>
        </div>

        <div className="cfm-inline-form">
          <label style={{ flex: 1 }}>
            <span>Section title</span>
            <input value={sectionTitle} onChange={(event) => setSectionTitle(event.target.value)} />
          </label>
        </div>

        <div className="cfm-inline-form" style={{ marginTop: '1rem', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 4 }}>Section Completion Badge (Optional)</span>
            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
              Upload or pick a unique image from the Badge Library. The same badge cannot be assigned to another section.<br/>
              <b>Format:</b> PNG or SVG with transparent background recommended.<br/>
              <b>Size:</b> Maximum 5MB. Ideal resolution is 200x200px.
            </span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input 
                placeholder="Image URL or pick from badges..." 
                value={sectionBadgeUrl} 
                onChange={(e) => setSectionBadgeUrl(e.target.value)} 
                style={{ flex: 1 }}
              />
              <button type="button" className="cfm-btn cfm-btn--ghost" onClick={() => setShowBadgePicker(true)}>
                Pick Badge
              </button>
            </div>
            {sectionBadgeUrl && (
              <img src={sectionBadgeUrl} alt="Badge Preview" style={{ marginTop: '8px', maxHeight: '50px', borderRadius: '4px', objectFit: 'contain' }} />
            )}
          </div>
          <button type="button" className="cfm-btn" style={{ marginTop: '20px' }} onClick={() => void handleSaveSection()}>
            <Save size={14} /> Save Section
          </button>
        </div>

        <div className="cfm-sublist-box">
          <div className="cfm-sublist-box__header">
            <h4>Exercises in this Section</h4>
          </div>

          <div className="cfm-inline-create">
            <input
              value={newExerciseTitle}
              onChange={(event) => setNewExerciseTitle(event.target.value)}
              placeholder="New exercise title"
            />
            <button type="button" className="cfm-btn cfm-btn--ghost" onClick={() => void handleCreateExercise(section.id)}>
              <Plus size={14} /> Add Exercise
            </button>
          </div>

          <ul className="cfm-sublist">
            {exercises.map((exercise) => (
              <li key={exercise.id}>
                <button
                  type="button"
                  className="cfm-sublist-link"
                  onClick={() =>
                    setSelectedNode({
                      type: "exercise",
                      trackId: selectedNode.trackId,
                      sectionId: section.id,
                      exerciseId: exercise.id,
                    })
                  }
                >
                  {exercise.title}
                </button>
                <div className="cfm-sublist-actions">
                  <button type="button" onClick={() => void handleExerciseMove(section.id, exercise.id, -1)} title="Move up">▲</button>
                  <button type="button" onClick={() => void handleExerciseMove(section.id, exercise.id, 1)} title="Move down">▼</button>
                  <button
                    type="button"
                    className="cfm-sublist-delete"
                    onClick={() => void handleDeleteExercise(section.id, exercise.id)}
                    title="Delete exercise"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  function renderExercisePanel() {
    if (!selectedNode || selectedNode.type !== "exercise") {
      return null;
    }

    const exercise = exerciseMap.get(selectedNode.exerciseId);
    if (!exercise) {
      return null;
    }

    const tasks = tasksByExercise[exercise.id] || [];

    return (
      <div className="cfm-editor-panel">
        <div className="cfm-editor-header">
          <h3>Exercise Settings</h3>
          <div className="cfm-editor-actions">
            <button
              type="button"
              className="cfm-btn cfm-btn--ghost"
              onClick={() =>
                setStudioExercise({
                  id: exercise.id,
                  title: exercise.title,
                })
              }
            >
              <FileCode2 size={14} /> Open Level Studio
            </button>
            <button
              type="button"
              className="cfm-btn cfm-btn--danger"
              onClick={() => void handleDeleteExercise(selectedNode.sectionId, exercise.id)}
            >
              <Trash2 size={14} /> Delete Exercise
            </button>
          </div>
        </div>

        <div className="cfm-inline-form">
          <label>
            <span>Exercise title</span>
            <input value={exerciseTitle} onChange={(event) => setExerciseTitle(event.target.value)} />
          </label>
          <label>
            <span>Mode</span>
            <select value={exerciseMode} onChange={(event) => setExerciseMode(event.target.value)}>
              <option value="code">Code</option>
              <option value="multi_file_code">Multi-file code</option>
              <option value="frontend_preview">Frontend preview</option>
              <option value="theory">Theory</option>
              <option value="quiz">Quiz</option>
              <option value="project">Project</option>
            </select>
          </label>
          <button type="button" className="cfm-btn" onClick={() => void handleSaveExercise()}>
            <Save size={14} /> Save Exercise
          </button>
        </div>

        <div className="cfm-fields-grid" style={{ marginTop: "1rem" }}>
          <label>
            <span>XP reward</span>
            <input value={exerciseXpReward} onChange={(event) => setExerciseXpReward(event.target.value)} inputMode="numeric" />
          </label>
          <label>
            <span>Unlock rule</span>
            <select value={exerciseUnlockRule} onChange={(event) => setExerciseUnlockRule(event.target.value)}>
              <option value="previous_completed">Previous completed</option>
              <option value="always_unlocked">Always unlocked</option>
              <option value="section_unlocked">Section unlocked</option>
            </select>
          </label>
          <label>
            <span>Passing score %</span>
            <input value={exercisePassingScorePct} onChange={(event) => setExercisePassingScorePct(event.target.value)} inputMode="numeric" />
          </label>
          <label>
            <span>Attempts allowed</span>
            <input value={exerciseAttemptsAllowed} onChange={(event) => setExerciseAttemptsAllowed(event.target.value)} inputMode="numeric" placeholder="Unlimited" />
          </label>
          <label className="cfm-field-full">
            <span>Instructions (Markdown)</span>
            <textarea rows={4} value={exerciseInstructionsMd} onChange={(event) => setExerciseInstructionsMd(event.target.value)} />
          </label>
          <label className="cfm-field-full">
            <span>Theory content</span>
            <textarea rows={4} value={exerciseTheoryContent} onChange={(event) => setExerciseTheoryContent(event.target.value)} />
          </label>
          <label className="cfm-field-full">
            <span>Reference solution URL</span>
            <input value={exerciseReferenceUrl} onChange={(event) => setExerciseReferenceUrl(event.target.value)} />
          </label>
          <label className="cfm-field-full">
            <span>Docs URL</span>
            <input value={exerciseDocsUrl} onChange={(event) => setExerciseDocsUrl(event.target.value)} />
          </label>
          <label className="cfm-status-toggle">
            <input type="checkbox" checked={exerciseAutoSubmitOnPass} onChange={(event) => setExerciseAutoSubmitOnPass(event.target.checked)} />
            <span className="cfm-status-badge published">Auto-submit on pass</span>
          </label>
          <label className="cfm-status-toggle">
            <input type="checkbox" checked={exerciseIsPublished} onChange={(event) => setExerciseIsPublished(event.target.checked)} />
            <span className={`cfm-status-badge ${exerciseIsPublished ? "published" : "draft"}`}>{exerciseIsPublished ? "Published" : "Draft"}</span>
          </label>
        </div>

        <div className="cfm-sublist-box">
          <div className="cfm-sublist-box__header">
            <h4>Levels in this Exercise</h4>
            <button type="button" className="cfm-btn cfm-btn--ghost" onClick={() => void handleCreateTask(exercise.id)}>
              <Plus size={14} /> Add Level
            </button>
          </div>

          <ul className="cfm-sublist">
            {tasks.map((task) => (
              <li key={task.id}>
                <button
                  type="button"
                  className="cfm-sublist-link"
                  onClick={() =>
                    setSelectedNode({
                      type: "task",
                      trackId: selectedNode.trackId,
                      sectionId: selectedNode.sectionId,
                      exerciseId: exercise.id,
                      taskId: task.id,
                    })
                  }
                >
                  {formatTaskTitle(task)}
                </button>
                <div className="cfm-sublist-actions">
                  <button type="button" onClick={() => void handleTaskMove(exercise.id, task.id, -1)} title="Move up">▲</button>
                  <button type="button" onClick={() => void handleTaskMove(exercise.id, task.id, 1)} title="Move down">▼</button>
                  <button
                    type="button"
                    className="cfm-sublist-delete"
                    onClick={() => void handleDeleteTask(exercise.id, task.id)}
                    title="Delete level"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  function renderTaskPanel() {
    if (!selectedNode || selectedNode.type !== "task") {
      return null;
    }

    const task = taskMap.get(selectedNode.taskId);
    if (!task) {
      return null;
    }

    return (
      <div className="cfm-editor-panel">
        <div className="cfm-editor-header">
          <h3>{formatTaskTitle(task)}</h3>
          <button
            type="button"
            className="cfm-btn cfm-btn--danger"
            onClick={() => void handleDeleteTask(selectedNode.exerciseId, task.id)}
          >
            <Trash2 size={14} /> Delete Level
          </button>
        </div>

        <div className="cfm-tabs">
          <button
            className={`cfm-tab ${levelTab === "theory" ? "cfm-tab--active" : ""}`}
            onClick={() => setLevelTab("theory")}
          >
            Theory
          </button>
          <button
            className={`cfm-tab ${levelTab === "code" ? "cfm-tab--active" : ""}`}
            onClick={() => setLevelTab("code")}
          >
            Code Editor
          </button>
        </div>

        {levelTab === "theory" && (
          <div className="cfm-fields-grid">
            <label className="cfm-field-full">
              <span>Instructions (Markdown)</span>
              <textarea
                rows={12}
                value={taskInstructions}
                onChange={(event) => setTaskInstructions(event.target.value)}
                placeholder="Advanced text editor content here..."
              />
            </label>
          </div>
        )}

        {levelTab === "code" && (
          <div className="cfm-fields-grid">
            <label className="cfm-field-full">
              <span>Starter Code</span>
              <textarea
                rows={4}
                value={taskStarterCode}
                onChange={(event) => setTaskStarterCode(event.target.value)}
              />
            </label>

            <label className="cfm-field-full">
              <span>Solution Code</span>
              <textarea
                rows={4}
                value={taskSolutionCode}
                onChange={(event) => setTaskSolutionCode(event.target.value)}
              />
            </label>

            <label className="cfm-field-full">
              <span>Test Cases (JSON array)</span>
              <textarea
                rows={6}
                className="cfm-code-area"
                value={taskTestCases}
                onChange={(event) => setTaskTestCases(event.target.value)}
              />
            </label>
          </div>
        )}

        <div className="cfm-editor-footer">
          <button type="button" className="cfm-btn" onClick={() => void handleSaveTask()}>
            <Save size={14} /> Save Level
          </button>
        </div>
      </div>
    );
  }

  if (studioExercise) {
    return (
      <ExerciseStudio
        exerciseId={studioExercise.id}
        exerciseTitle={studioExercise.title}
        onBack={() => setStudioExercise(null)}
      />
    );
  }

  return (
    <div className="cfm-root cfm-editor-mode">
      <div className="cfm-topbar">
        <div>
          <h2>Track Editor</h2>
          <p>Edit this track and manage section → exercise → levels.</p>
        </div>
        <div className="cfm-topbar-actions">
          <button type="button" className="cfm-btn" onClick={onBackToList}>
            Back to Tracks
          </button>
        </div>
      </div>

      {error && <div className="cfm-error">{error}</div>}

      <div className="cfm-layout">
        <aside className="cfm-tree-panel">
          <div className="cfm-tree-wrapper">{renderTree()}</div>
        </aside>

        <section className="cfm-detail-panel">
          {!selectedNode && (
            <div className="cfm-empty-detail">
              Select a node from the left explorer to edit details.
            </div>
          )}

          {renderTrackPanel()}
          {renderSectionPanel()}
          {renderExercisePanel()}
          {renderTaskPanel()}
        </section>
      </div>

      <MediaPickerModal
        isOpen={showMediaPicker}
        onClose={() => setShowMediaPicker(false)}
        onSelect={handleMediaSelect}
      />
      <BadgePickerModal
        isOpen={showBadgePicker}
        onClose={() => setShowBadgePicker(false)}
        onSelect={handleBadgeSelect}
      />
    </div>
  );
}
