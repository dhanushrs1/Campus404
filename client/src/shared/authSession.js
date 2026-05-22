import { reportRequestFailure } from "./diagnosticsReporter.jsx";

export const AUTH_STORAGE_KEYS = Object.freeze([
  "campus404_token",
  "campus404_role",
  "campus404_username",
  "campus404_avatar_url",
  "campus404_setup_token",
]);

export const ELEVATED_ROLES = new Set(["ADMIN", "EDITOR"]);
const API_BASE = (import.meta.env.VITE_API_URL ?? "").trim();
const AUTH_CHANGED_EVENT = "campus404:auth-changed";

let refreshPromise = null;

function authApiUrl(path) {
  return `${API_BASE}${path}`;
}

function getStorage() {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

function emitAuthChanged() {
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT, { detail: readAuthSession() }));
    }
  } catch {
    // Auth state updates are best effort for tabs/components that are currently mounted.
  }
}

export function normalizeRole(role) {
  return String(role || "USER").trim().toUpperCase() || "USER";
}

export function isElevatedRole(role) {
  return ELEVATED_ROLES.has(normalizeRole(role));
}

export function decodeJwtPayload(token) {
  try {
    const encodedPayload = String(token || "").split(".")[1];
    if (!encodedPayload) return {};

    const normalizedPayload = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      "=",
    );

    return JSON.parse(atob(paddedPayload));
  } catch {
    return {};
  }
}

export function isAccessTokenActive(token) {
  const payload = decodeJwtPayload(token);
  const expiresAt = Number(payload.exp || 0);

  return Boolean(
    token
    && payload.sub
    && payload.status === "active"
    && Number.isFinite(expiresAt)
    && expiresAt * 1000 > Date.now(),
  );
}

export function readAuthSession() {
  const storage = getStorage();
  if (!storage) {
    return {
      token: "",
      role: "USER",
      username: "",
      avatarUrl: "",
      isAuthenticated: false,
    };
  }

  const token = storage.getItem("campus404_token") || "";
  const payload = decodeJwtPayload(token);
  const role = normalizeRole(payload.role || storage.getItem("campus404_role"));

  return {
    token,
    role,
    username: storage.getItem("campus404_username") || payload.sub || "",
    avatarUrl: storage.getItem("campus404_avatar_url") || "",
    isAuthenticated: isAccessTokenActive(token),
  };
}

export function saveAuthSession(session) {
  const storage = getStorage();
  if (!storage || !session) return readAuthSession();

  const token = String(session.access_token || session.token || "").trim();
  if (token) {
    storage.setItem("campus404_token", token);
  }

  const payload = decodeJwtPayload(token);
  const role = normalizeRole(session.role || payload.role || storage.getItem("campus404_role"));
  storage.setItem("campus404_role", role);

  const username = String(session.username || payload.sub || storage.getItem("campus404_username") || "").trim();
  if (username) {
    storage.setItem("campus404_username", username);
  }

  const avatar = String(session.avatar_url || session.avatar || "").trim();
  if (avatar) {
    storage.setItem("campus404_avatar_url", avatar);
  } else if (Object.prototype.hasOwnProperty.call(session, "avatar_url") || Object.prototype.hasOwnProperty.call(session, "avatar")) {
    storage.removeItem("campus404_avatar_url");
  }

  emitAuthChanged();
  return readAuthSession();
}

export function clearAuthSession() {
  const storage = getStorage();
  if (!storage) return;

  AUTH_STORAGE_KEYS.forEach((key) => storage.removeItem(key));
  emitAuthChanged();
}

function normalizeReturnTo(value) {
  const raw = String(value || "").trim();
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "";
  }
  if (raw.startsWith("/auth/callback")) {
    return "";
  }
  return raw;
}

export function saveAuthReturnTo(value) {
  const storage = getStorage();
  const safeValue = normalizeReturnTo(value);
  if (!storage || !safeValue) return;
  storage.setItem("campus404_auth_return_to", safeValue);
}

export function consumeAuthReturnTo(fallback = "/dashboard") {
  const storage = getStorage();
  if (!storage) return fallback;

  const stored = normalizeReturnTo(storage.getItem("campus404_auth_return_to"));
  storage.removeItem("campus404_auth_return_to");
  return stored || fallback;
}

export function syncAuthSession(user) {
  const storage = getStorage();
  if (!storage || !user) return;

  if (user.role) {
    storage.setItem("campus404_role", normalizeRole(user.role));
  }
  if (user.username) {
    storage.setItem("campus404_username", String(user.username));
  }

  const avatar = String(user.avatar || user.avatar_url || "").trim();
  if (avatar) {
    storage.setItem("campus404_avatar_url", avatar);
  } else if (Object.prototype.hasOwnProperty.call(user, "avatar") || Object.prototype.hasOwnProperty.call(user, "avatar_url")) {
    storage.removeItem("campus404_avatar_url");
  }

  emitAuthChanged();
}

export async function refreshAuthSession({ force = false } = {}) {
  const current = readAuthSession();
  if (!force && current.isAuthenticated) {
    return current;
  }

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch(authApiUrl("/auth/refresh"), {
          method: "POST",
          credentials: "include",
        });

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            clearAuthSession();
          }
          return readAuthSession();
        }

        const data = await response.json();
        return saveAuthSession(data);
      } catch {
        return readAuthSession();
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
}

export async function ensureAuthSession() {
  const session = readAuthSession();
  if (session.isAuthenticated) {
    return session;
  }
  return refreshAuthSession({ force: true });
}

function withAuthorization(headers, token) {
  const nextHeaders = new Headers(headers || {});
  if (token) {
    nextHeaders.set("Authorization", `Bearer ${token}`);
  } else {
    nextHeaders.delete("Authorization");
  }
  return nextHeaders;
}

async function fetchWithDiagnostics(input, options) {
  try {
    const response = await fetch(input, options);
    reportRequestFailure({ input, options, response });
    return response;
  } catch (error) {
    reportRequestFailure({ input, options, error });
    throw error;
  }
}

export async function authenticatedFetch(input, options = {}) {
  const session = await ensureAuthSession();
  const fetchOptions = {
    ...options,
    credentials: options.credentials || "include",
    headers: withAuthorization(options.headers, session.token),
  };

  let response = await fetchWithDiagnostics(input, fetchOptions);
  if (response.status !== 401) {
    return response;
  }

  const refreshed = await refreshAuthSession({ force: true });
  if (!refreshed.isAuthenticated || refreshed.token === session.token) {
    return response;
  }

  response = await fetchWithDiagnostics(input, {
    ...options,
    credentials: options.credentials || "include",
    headers: withAuthorization(options.headers, refreshed.token),
  });

  if (response.status === 401) {
    clearAuthSession();
  }

  return response;
}
