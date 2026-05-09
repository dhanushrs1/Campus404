/**
 * campus404 — API URL resolver
 *
 * Docker / production (VITE_API_URL is empty or unset):
 *   All fetch("/auth/...") calls go to the SAME ORIGIN (port 80).
 *   NGINX proxies /auth/* and /api/* to FastAPI automatically.
 *   No hostname needed — just a path prefix of "".
 *
 * Local dev without Docker (set VITE_API_URL=http://localhost:8000 in client/.env):
 *   Overrides to reach FastAPI directly on port 8000.
 */

const _raw = import.meta.env.VITE_API_URL ?? "";

// Treat empty string, whitespace, or undefined the same — same-origin mode
export const API_BASE = _raw.trim();

/**
 * Build a full API URL from a path.
 * @param {string} path - e.g. "/auth/complete-profile"
 * @returns {string}
 */
export function apiUrl(path) {
  // Same-origin: returns just the path — works through NGINX on any host
  // With explicit base: returns "http://some-host:port/path"
  return `${API_BASE}${path}`;
}

function readAccessToken() {
  return localStorage.getItem("campus404_token") ?? "";
}

/**
 * Record admin/editor actions for audit logging.
 * keepalive=true helps when this is called right before navigation.
 */
export async function logAdminActivity(payload) {
  const token = readAccessToken();
  if (!token) {
    return { logged: false, reason: "missing-token" };
  }

  try {
    const response = await fetch(apiUrl("/auth/admin-activity"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      keepalive: true,
    });

    if (!response.ok) {
      return { logged: false, status: response.status };
    }

    return await response.json();
  } catch {
    return { logged: false, reason: "network-error" };
  }
}

/**
 * Retrieve the latest admin/editor audit logs for dashboard rendering.
 */
export async function fetchAdminActivityLogs({ limit = 25, offset = 0, role = "", activityType = "", username = "" } = {}) {
  const token = readAccessToken();
  if (!token) {
    return { items: [], total: 0 };
  }

  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (role) {
    params.set("role", role);
  }
  if (activityType) {
    params.set("activity_type", activityType);
  }
  if (username) {
    params.set("username", username);
  }

  const response = await fetch(apiUrl(`/auth/admin-activity?${params.toString()}`), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to load admin activity logs (${response.status}).`);
  }

  return response.json();
}
