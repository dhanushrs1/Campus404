import { apiUrl } from "./api.js";
import { authenticatedFetch, clearAuthSession } from "./authSession.js";

function buildHeaders() {
  const token = localStorage.getItem("campus404_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request(endpoint, options = {}) {
  const response = await authenticatedFetch(apiUrl(endpoint), {
    method: options.method || "GET",
    ...options,
    headers: { ...buildHeaders(), ...(options.headers || {}) },
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload = await response.json();
      if (Array.isArray(payload.detail)) {
        message = payload.detail.map((item) => item.msg || item.message || String(item)).join(", ");
      } else {
        message = payload.detail || payload.message || message;
      }
    } catch {
      // Keep generic error when body is not JSON.
    }
    if (response.status === 401) {
      clearAuthSession();
      message = message || "Please sign in to continue.";
    }
    const readinessHints = [
      "no such table",
      "unknown column",
      "doesn't exist",
      "relation",
      "database",
      "migration",
    ];
    if (readinessHints.some((hint) => String(message).toLowerCase().includes(hint))) {
      message = `${message} Run the latest API migrations and seed content, then refresh the workspace.`;
    }
    const error = new Error(message);
    error.status = response.status;
    error.endpoint = endpoint;
    throw error;
  }

  return response.json();
}

export function getTrackTree() {
  return request("/api/tracks");
}

export function getTrackLeaderboard(trackIdentifier, limit = 5) {
  const pageSize = Number(limit) > 25 ? 50 : 25;
  return getLeaderboard({ scope: "track", track: trackIdentifier, pageSize })
    .then((payload) => (payload.entries || []).slice(0, Number(limit) || 5));
}

export function getTrackDetailTree(trackIdentifier) {
  return request(`/api/tracks/${trackIdentifier}/tree`);
}

export function getExerciseForLearner(exerciseId) {
  return request(`/api/exercises/${exerciseId}`);
}

export function getExerciseWorkspace(exerciseId) {
  return request(`/api/exercises/${exerciseId}/workspace`);
}

export function getWorkspaceExercise(exerciseId) {
  return request(`/api/workspace/exercises/${exerciseId}`);
}

export function runExercise(exerciseId, payload) {
  return request(`/api/workspace/exercises/${exerciseId}/run`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function submitExercise(exerciseId, payload = {}) {
  return request(`/api/workspace/exercises/${exerciseId}/submit`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function useExerciseHint(exerciseId, hintId) {
  return request(`/api/workspace/exercises/${exerciseId}/hint/${hintId}`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function recordReferenceAccess(exerciseId, reference_url = null) {
  return request(`/api/workspace/exercises/${exerciseId}/reference-access`, {
    method: "POST",
    body: JSON.stringify({ reference_url }),
  });
}

export function completeTheoryExercise(exerciseId, payload = {}) {
  return request(`/api/workspace/exercises/${exerciseId}/complete-theory`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function startQuiz(exerciseId) {
  return request(`/api/workspace/quizzes/${exerciseId}/start`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function answerQuiz(exerciseId, payload) {
  return request(`/api/workspace/quizzes/${exerciseId}/answer`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function finishQuiz(exerciseId, payload) {
  return request(`/api/workspace/quizzes/${exerciseId}/finish`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getTrackProgress(trackId) {
  return request(`/api/tracks/${trackId}/progress`);
}

export function getGlobalLeaderboard({ timeRange = "all_time", page = 1, pageSize = 25 } = {}) {
  return getLeaderboard({ scope: "global", timeRange, page, pageSize });
}

export function getTrackXpLeaderboard(trackId, { timeRange = "all_time", page = 1, pageSize = 25 } = {}) {
  return getLeaderboard({ scope: "track", track: trackId, timeRange, page, pageSize });
}

export function getLeaderboard({
  scope = "global",
  track = "",
  timeRange = "",
  search = "",
  sort = "",
  page = 1,
  pageSize = null,
} = {}) {
  const params = new URLSearchParams({
    scope,
    page: String(page),
  });
  if (track) params.set("track", track);
  if (timeRange) params.set("time_range", timeRange);
  if (search) params.set("search", search);
  if (sort) params.set("sort", sort);
  if (pageSize) params.set("page_size", String(pageSize));
  return request(`/api/leaderboards?${params.toString()}`);
}

export function getAdminLeaderboardSettings() {
  return request("/api/admin/settings/leaderboards");
}

export function updateAdminLeaderboardSettings(payload) {
  return request("/api/admin/settings/leaderboards", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function updateAdminTrackLeaderboardSettings(trackId, payload) {
  return request(`/api/admin/settings/leaderboards/tracks/${trackId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function getMyProgress() {
  return request("/api/users/me/progress");
}

export function getMyXpEvents(limit = 50) {
  return request(`/api/users/me/xp-events?limit=${encodeURIComponent(limit)}`);
}

export function getMyBadges() {
  return request("/api/users/me/badges");
}

export function evaluateTask(exerciseId, taskId, sourceCode, languageId) {
  return request(`/api/exercises/${exerciseId}/tasks/${taskId}/evaluate`, {
    method: "POST",
    body: JSON.stringify({ source_code: sourceCode, language_id: languageId }),
  });
}

export function saveTaskProgress(taskId, payload = {}) {
  return request(`/api/progress/task/${taskId}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getAllTaskProgress() {
  return request("/api/progress/task");
}


