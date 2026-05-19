import { apiUrl } from "./api.js";
import { authenticatedFetch, ensureAuthSession } from "./authSession.js";

const SESSION_EXPIRED_STATUS = 401;

async function readAccessToken() {
  const session = await ensureAuthSession();
  return session.token;
}

async function parseResponse(response) {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = data?.detail;
    const message = Array.isArray(detail)
      ? detail.map((item) => item?.msg).filter(Boolean).join(" ")
      : detail || data?.message || `Request failed (${response.status}).`;
    const error = new Error(message || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function submitContactMessage(payload) {
  const response = await fetch(apiUrl("/api/contact-messages"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseResponse(response);
}

export async function fetchAdminContactMessages({ status = "all", search = "", limit = 50, offset = 0 } = {}) {
  const token = await readAccessToken();
  if (!token) {
    const error = new Error("Session expired. Please sign in again.");
    error.status = SESSION_EXPIRED_STATUS;
    throw error;
  }

  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (status && status !== "all") {
    params.set("status_filter", status);
  }
  if (search.trim()) {
    params.set("search", search.trim());
  }

  const response = await authenticatedFetch(apiUrl(`/api/admin/contact-messages?${params.toString()}`));

  return parseResponse(response);
}

export async function updateAdminContactMessage(messageId, payload) {
  const token = await readAccessToken();
  if (!token) {
    const error = new Error("Session expired. Please sign in again.");
    error.status = SESSION_EXPIRED_STATUS;
    throw error;
  }

  const response = await authenticatedFetch(apiUrl(`/api/admin/contact-messages/${messageId}`), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseResponse(response);
}
