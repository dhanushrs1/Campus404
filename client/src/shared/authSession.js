export const AUTH_STORAGE_KEYS = Object.freeze([
  "campus404_token",
  "campus404_role",
  "campus404_username",
  "campus404_avatar_url",
  "campus404_setup_token",
]);

export const ELEVATED_ROLES = new Set(["ADMIN", "EDITOR"]);

function getStorage() {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
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

export function clearAuthSession() {
  const storage = getStorage();
  if (!storage) return;

  AUTH_STORAGE_KEYS.forEach((key) => storage.removeItem(key));
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
}
