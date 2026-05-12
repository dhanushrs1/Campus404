import { apiUrl } from "./api.js";

function getAuthHeaders() {
  const token = localStorage.getItem("campus404_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request(endpoint, options = {}) {
  const res = await fetch(apiUrl(endpoint), {
    ...options,
    headers: { ...getAuthHeaders(), ...options.headers },
  });
  if (!res.ok) {
    let message = "An error occurred";
    try {
      const data = await res.json();
      if (data.detail) {
        if (Array.isArray(data.detail)) {
          message = data.detail.map((err) => err.msg).join(", ");
        } else {
          message = data.detail;
        }
      }
    } catch {}
    throw new Error(message);
  }
  if (res.status !== 204) {
    return res.json();
  }
  return null;
}

// Tracks
export const getTracks = () => request("/api/admin/tracks");
export const createTrack = (data) => request("/api/admin/tracks", { method: "POST", body: JSON.stringify(data) });
export const updateTrack = (id, data) => request(`/api/admin/tracks/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteTrack = (id) => request(`/api/admin/tracks/${id}`, { method: "DELETE" });
export const reorderTracks = (item_ids) => request("/api/admin/tracks/reorder", { method: "PUT", body: JSON.stringify({ item_ids }) });

export async function uploadTrackFeaturedImage(file) {
  const token = localStorage.getItem("campus404_token");
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(apiUrl("/api/admin/uploads/track-featured-image"), {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (!res.ok) {
    let message = "Image upload failed";
    try {
      const data = await res.json();
      if (data.detail) {
        if (Array.isArray(data.detail)) {
          message = data.detail.map((err) => err.msg).join(", ");
        } else {
          message = data.detail;
        }
      }
    } catch {
      // Keep generic message when server payload is not JSON.
    }
    throw new Error(message);
  }

  return res.json();
}

// Sections
export const getSections = (trackId) => request(`/api/admin/tracks/${trackId}/sections`);
export const createSection = (trackId, data) => request(`/api/admin/tracks/${trackId}/sections`, { method: "POST", body: JSON.stringify(data) });
export const updateSection = (sectionId, data) => request(`/api/admin/sections/${sectionId}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteSection = (id) => request(`/api/admin/sections/${id}`, { method: "DELETE" });
export const reorderSections = (item_ids) => request("/api/admin/sections/reorder", { method: "PUT", body: JSON.stringify({ item_ids }) });

// Exercises
export const getExercises = (sectionId) => request(`/api/admin/sections/${sectionId}/exercises`);
export const createExercise = (sectionId, data) => request(`/api/admin/sections/${sectionId}/exercises`, { method: "POST", body: JSON.stringify(data) });
export const updateExercise = (exerciseId, data) => request(`/api/admin/exercises/${exerciseId}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteExercise = (id) => request(`/api/admin/exercises/${id}`, { method: "DELETE" });
export const reorderExercises = (item_ids) => request("/api/admin/exercises/reorder", { method: "PUT", body: JSON.stringify({ item_ids }) });

// Learning engine studio
export const getCurriculumTree = () => request("/api/admin/curriculum/tree");
export const getExerciseStudio = (exerciseId) => request(`/api/admin/exercises/${exerciseId}/studio`);
export const saveExerciseStudio = (exerciseId, data) => request(`/api/admin/exercises/${exerciseId}/studio`, { method: "PUT", body: JSON.stringify(data) });
export const validateExerciseStudio = (exerciseId, data = {}) => request(`/api/admin/exercises/${exerciseId}/validate`, { method: "POST", body: JSON.stringify(data) });
export const previewExerciseStudio = (exerciseId) => request(`/api/admin/exercises/${exerciseId}/preview`, { method: "POST", body: JSON.stringify({}) });
export const checkTrackPublish = (trackId) => request(`/api/admin/tracks/${trackId}/publish-check`, { method: "POST", body: JSON.stringify({}) });
export const getLearningEngineHealth = () => request("/api/admin/learning-engine/health");

// Tasks
export const getTasks = (exerciseId) => request(`/api/admin/exercises/${exerciseId}/tasks`);
export const createTask = (exerciseId, data) => request(`/api/admin/exercises/${exerciseId}/tasks`, { method: "POST", body: JSON.stringify(data) });
export const updateTask = (taskId, data) => request(`/api/admin/tasks/${taskId}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteTask = (id) => request(`/api/admin/tasks/${id}`, { method: "DELETE" });
export const reorderTasks = (item_ids) => request("/api/admin/tasks/reorder", { method: "PUT", body: JSON.stringify({ item_ids }) });

/**
 * Bulk-save an exercise's full task list.
 * For each task: if it has an id → PUT (update), else → POST (create).
 * Runs sequentially to preserve ordering.
 */
export async function bulkSaveTasks(exerciseId, tasks) {
  const results = [];
  for (const task of tasks) {
    const payload = {
      step_number: task.step_number,
      instructions_md: task.instructions_md,
      starter_code: task.files ? JSON.stringify(task.files) : (task.starter_code ?? null),
      solution_code: task.solution_code ?? null,
      test_cases: task.test_cases ?? [],
    };
    if (task.id) {
      results.push(await request(`/api/admin/tasks/${task.id}`, { method: "PUT", body: JSON.stringify(payload) }));
    } else {
      results.push(await request(`/api/admin/exercises/${exerciseId}/tasks`, { method: "POST", body: JSON.stringify(payload) }));
    }
  }
  return results;
}
