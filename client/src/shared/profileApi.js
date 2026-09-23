import { apiUrl } from "./api.js";
import { authenticatedFetch, clearAuthSession, readAuthSession } from "./authSession.js";

function authHeaders() {
  const token = localStorage.getItem("campus404_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function parseResponse(response, endpoint) {
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload = await response.json();
      message = Array.isArray(payload.detail)
        ? payload.detail.map((item) => item.msg || item.message || String(item)).join(", ")
        : (payload.detail || payload.message || message);
    } catch {
      // Keep the generic message for empty or non-JSON responses.
    }
    if (response.status === 401) {
      clearAuthSession();
    }
    const error = new Error(message);
    error.status = response.status;
    error.endpoint = endpoint;
    throw error;
  }

  if (response.status === 204) return null;
  return response.json();
}

async function privateRequest(endpoint, options = {}) {
  const response = await authenticatedFetch(apiUrl(endpoint), {
    method: options.method || "GET",
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  return parseResponse(response, endpoint);
}

async function publicRequest(endpoint, options = {}) {
  const session = readAuthSession();
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");
  if (session.token) {
    headers.set("Authorization", `Bearer ${session.token}`);
  }
  const response = await fetch(apiUrl(endpoint), {
    method: options.method || "GET",
    credentials: "include",
    ...options,
    headers,
  });
  return parseResponse(response, endpoint);
}

export function getMyProfile() {
  return privateRequest("/api/users/me/profile");
}

export function updateMyProfile(payload) {
  return privateRequest("/api/users/me/profile", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function getPublicProfile(username) {
  return publicRequest(`/api/users/${encodeURIComponent(username)}/public-profile`);
}

export function connectToProfile(username) {
  return privateRequest(`/api/users/${encodeURIComponent(username)}/connection`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function disconnectFromProfile(username) {
  return privateRequest(`/api/users/${encodeURIComponent(username)}/connection`, {
    method: "DELETE",
  });
}

export function getMyProjects() {
  return privateRequest("/api/users/me/projects");
}

export function createMyProject(payload) {
  return privateRequest("/api/users/me/projects", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateMyProject(projectId, payload) {
  return privateRequest(`/api/users/me/projects/${encodeURIComponent(projectId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteMyProject(projectId) {
  return privateRequest(`/api/users/me/projects/${encodeURIComponent(projectId)}`, {
    method: "DELETE",
  });
}

export function getMyRewards() {
  return privateRequest("/api/users/me/rewards");
}

export function claimDailyCheckIn() {
  return privateRequest("/api/users/me/rewards/daily-check-in", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function getMyCertificates() {
  return privateRequest("/api/users/me/certificates");
}

export function claimCertificate(trackId) {
  return privateRequest(`/api/users/me/certificates/${encodeURIComponent(trackId)}/claim`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function getMySessions() {
  return privateRequest("/api/users/me/sessions");
}

export function revokeMySessions() {
  return privateRequest("/api/users/me/sessions/revoke-all", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function createAccountChangeRequest(payload) {
  return privateRequest("/api/users/me/account-change-requests", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
