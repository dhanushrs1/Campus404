function removeTrailingSlash(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function getRuntimeOrigin() {
  if (typeof window === "undefined") {
    return "";
  }

  return removeTrailingSlash(window.location.origin);
}

export function buildAppUrl(pathname) {
  const safePathname = pathname?.startsWith("/")
    ? pathname
    : `/${pathname ?? ""}`;

  const origin = getRuntimeOrigin();
  if (!origin) {
    return safePathname;
  }

  return new URL(safePathname, `${origin}/`).toString();
}

export function getApiBaseUrl() {
  const envBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  if (envBaseUrl) {
    return removeTrailingSlash(envBaseUrl);
  }

  const origin = getRuntimeOrigin();
  return origin ? `${origin}/api` : "/api";
}