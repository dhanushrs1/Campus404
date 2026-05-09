/**
 * campus404 — Media API client
 * Handles list, upload, and delete operations for the admin media library.
 */

import { apiUrl } from "./api.js";

// ── Auth helpers ──────────────────────────────────────────────────────────

function getToken() {
  return localStorage.getItem("campus404_token") ?? "";
}

function getAuthHeader() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Error extraction ──────────────────────────────────────────────────────

function extractErrorMessage(data, fallback) {
  if (!data) return fallback;

  if (typeof data.detail === "string" && data.detail.trim()) {
    return data.detail;
  }

  if (Array.isArray(data.detail) && data.detail.length > 0) {
    const first = data.detail[0];
    if (typeof first === "string") return first;
    if (first && typeof first.msg === "string") return first.msg;
  }

  if (typeof data.message === "string" && data.message.trim()) {
    return data.message;
  }

  return fallback;
}

async function parseErrorResponse(res, fallback) {
  try {
    const data = await res.json();
    return extractErrorMessage(data, fallback);
  } catch {
    return fallback;
  }
}

// ── Typed API calls ───────────────────────────────────────────────────────

/**
 * List all media files, with optional search query and category filter.
 * @param {{ query?: string, category?: string, folder?: string, skip?: number, limit?: number }} options
 * @returns {Promise<{ items: object[] }>}
 */
export async function listMedia({ query = "", category = "", folder = "", skip = 0, limit = 30 } = {}) {
  const params = new URLSearchParams();
  if (query && query.trim()) params.set("q", query.trim());
  if (category && category !== "all") params.set("category", category);
  if (folder) params.set("folder", folder);
  params.set("skip", skip.toString());
  params.set("limit", limit.toString());

  const suffix = params.size ? `?${params.toString()}` : "";
  const res = await fetch(apiUrl(`/api/admin/media${suffix}`), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
  });

  if (!res.ok) {
    const msg = await parseErrorResponse(res, `Failed to load media (${res.status}).`);
    throw new Error(msg);
  }

  return res.json();
}

/**
 * Upload one or more files to the admin media library.
 * NOTE: Do NOT set Content-Type — the browser sets it automatically for FormData.
 * @param {File[]} files
 * @returns {Promise<{ items: object[] }>}
 */
export async function uploadMediaFiles(files, folder = "media") {
  if (!files || files.length === 0) {
    throw new Error("Select at least one file to upload.");
  }

  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }
  formData.append("folder", folder);

  const res = await fetch(apiUrl("/api/admin/media/upload"), {
    method: "POST",
    headers: {
      // No Content-Type — the browser sets multipart/form-data with the correct boundary.
      ...getAuthHeader(),
    },
    body: formData,
  });

  if (!res.ok) {
    const msg = await parseErrorResponse(res, `Upload failed (${res.status}).`);
    throw new Error(msg);
  }

  return res.json();
}

/**
 * Delete a media file by its relative path.
 * @param {{ relativePath: string }} options
 * @returns {Promise<{ message: string }>}
 */
export async function deleteMediaFile({ relativePath }) {
  if (!relativePath) {
    throw new Error("relative_path is required for deletion.");
  }

  const res = await fetch(apiUrl("/api/admin/media"), {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify({ relative_path: relativePath }),
  });

  if (!res.ok) {
    // 404 means the file was already removed from disk — treat cleanly
    if (res.status === 404) {
      return { message: "File already removed." };
    }
    const msg = await parseErrorResponse(res, `Delete failed (${res.status}).`);
    throw new Error(msg);
  }

  return res.json();
}

/**
 * Fetch current admin media storage settings.
 * @returns {Promise<object>}
 */
export async function getMediaStorageSettings() {
  const res = await fetch(apiUrl("/api/admin/media/storage-settings"), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
  });

  if (!res.ok) {
    const msg = await parseErrorResponse(res, `Failed to load storage settings (${res.status}).`);
    throw new Error(msg);
  }

  return res.json();
}

/**
 * Update non-sensitive admin media storage settings.
 * @param {object} payload
 * @returns {Promise<object>}
 */
export async function updateMediaStorageSettings(payload) {
  const res = await fetch(apiUrl("/api/admin/media/storage-settings"), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const msg = await parseErrorResponse(res, `Failed to update storage settings (${res.status}).`);
    throw new Error(msg);
  }

  return res.json();
}

/**
 * Test Cloudinary connectivity using environment credentials and optional overrides.
 * @param {object} payload
 * @returns {Promise<{ok:boolean, message:string}>}
 */
export async function testMediaStorageSettings(payload) {
  const res = await fetch(apiUrl("/api/admin/media/storage-settings/test"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const msg = await parseErrorResponse(res, `Storage test failed (${res.status}).`);
    throw new Error(msg);
  }

  return res.json();
}

/**
 * Returns a Cloudinary URL optimized for performance (auto format, reduced quality, specific width)
 * Only affects images that are stored on Cloudinary.
 * @param {string} url - Original URL
 * @param {string} category - Media category
 * @param {number} width - Max width constraint
 * @returns {string}
 */
export function getOptimizedCloudinaryUrl(url, category = "image", width = 400) {
  if (category !== "image" || !url || !url.includes("cloudinary.com/")) {
    return url;
  }
  return url.replace("/upload/", `/upload/f_auto,q_auto,w_${width}/`);
}
