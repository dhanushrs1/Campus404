import { apiUrl } from "./api.js";

function buildHeaders() {
  const token = localStorage.getItem("campus404_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request(endpoint, options = {}) {
  const response = await fetch(apiUrl(endpoint), {
    method: options.method || "GET",
    headers: buildHeaders(),
    ...options,
  });

  if (!response.ok) {
    let message = "Request failed";
    try {
      const payload = await response.json();
      message = payload.detail || message;
    } catch {
      // Keep generic error when body is not JSON.
    }
    throw new Error(message);
  }

  return response.json();
}

export function getTrackTree() {
  return request("/api/tracks");
}

export function getTrackLeaderboard(trackIdentifier, limit = 5) {
  return request(`/api/tracks/${trackIdentifier}/leaderboard?limit=${encodeURIComponent(limit)}`);
}

export function getExerciseForLearner(exerciseId) {
  return request(`/api/exercises/${exerciseId}`);
}

export function getExerciseWorkspace(exerciseId) {
  return request(`/api/exercises/${exerciseId}/workspace`);
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


