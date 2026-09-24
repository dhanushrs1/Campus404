import React from "react";

const API_BASE = (import.meta.env.VITE_API_URL ?? "").trim();
const REPORT_PATH = "/api/diagnostics/client-errors";
const REPORT_INTERVAL_MS = 12000;
const lastReportTimes = new Map();
let installed = false;

function diagnosticsUrl(path) {
  return `${API_BASE}${path}`;
}

function routePath() {
  if (typeof window === "undefined") return "";
  return `${window.location.pathname}${window.location.search}`.slice(0, 512);
}

function endpointText(input) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input?.url || String(input || "");
}

function errorMessage(value, fallback) {
  if (value instanceof Error && value.message) return value.message;
  return String(value || fallback || "Frontend operational error");
}

function sanitizeDetails(value) {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !/(token|cookie|password|secret|authorization|source_code)/i.test(key))
      .slice(0, 30),
  );
}

function reportKey(payload) {
  return [
    payload.error_kind,
    payload.message,
    payload.route_path,
    payload.operation,
    payload.status_code,
  ].join("|").slice(0, 900);
}

function shouldReport(payload) {
  const key = reportKey(payload);
  const now = Date.now();
  const previous = lastReportTimes.get(key) || 0;
  if (now - previous < REPORT_INTERVAL_MS) return false;
  lastReportTimes.set(key, now);
  if (lastReportTimes.size > 120) {
    const oldest = lastReportTimes.keys().next().value;
    lastReportTimes.delete(oldest);
  }
  return true;
}

function authHeaders() {
  try {
    const token = window.localStorage.getItem("campus404_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export function reportClientError(payload) {
  if (typeof window === "undefined") return;
  const operation = String(payload?.operation || "");
  if (operation.includes(REPORT_PATH)) return;

  const report = {
    error_kind: String(payload?.error_kind || "browser_error").slice(0, 64),
    severity: String(payload?.severity || "error").slice(0, 32),
    message: errorMessage(payload?.message, "Frontend operational error").slice(0, 8192),
    stack_trace: payload?.stack_trace ? String(payload.stack_trace).slice(0, 40000) : null,
    component_stack: payload?.component_stack ? String(payload.component_stack).slice(0, 40000) : null,
    route_path: String(payload?.route_path || routePath()).slice(0, 512),
    route_template: payload?.route_template ? String(payload.route_template).slice(0, 512) : null,
    operation: operation.slice(0, 512) || null,
    method: payload?.method ? String(payload.method).slice(0, 16) : null,
    status_code: Number.isFinite(Number(payload?.status_code)) ? Number(payload.status_code) : null,
    request_id: payload?.request_id ? String(payload.request_id).slice(0, 96) : null,
    client_occurred_at: new Date().toISOString(),
    details: sanitizeDetails(payload?.details),
  };

  if (!shouldReport(report)) return;

  void fetch(diagnosticsUrl(REPORT_PATH), {
    method: "POST",
    credentials: "include",
    keepalive: true,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(report),
  }).catch(() => undefined);
}

export function reportRequestFailure({ input, options = {}, response = null, error = null } = {}) {
  const endpoint = endpointText(input);
  if (endpoint.includes(REPORT_PATH)) return;
  const statusCode = Number(response?.status || 0);
  if (!error && statusCode < 500) return;
  const method = String(options?.method || input?.method || "GET").toUpperCase();
  reportClientError({
    error_kind: error ? "network_error" : "api_5xx",
    severity: statusCode >= 500 ? "error" : "warning",
    message: error
      ? `${method} ${endpoint || "request"} failed before a response: ${errorMessage(error)}`
      : `${method} ${endpoint || "request"} returned HTTP ${statusCode}.`,
    stack_trace: error instanceof Error ? error.stack : null,
    operation: endpoint,
    method,
    status_code: statusCode || null,
    request_id: response?.headers?.get?.("x-request-id") || null,
  });
}

export function installDiagnosticsReporter() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (event) => {
    reportClientError({
      error_kind: "browser_error",
      message: event.message || errorMessage(event.error),
      stack_trace: event.error?.stack || null,
      details: {
        filename: event.filename || "",
        line: event.lineno || null,
        column: event.colno || null,
      },
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    reportClientError({
      error_kind: "unhandled_rejection",
      message: errorMessage(reason, "Unhandled promise rejection"),
      stack_trace: reason instanceof Error ? reason.stack : null,
    });
  });
}

export class DiagnosticsErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { crashed: false };
  }

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  componentDidCatch(error, info) {
    reportClientError({
      error_kind: "react_render_error",
      severity: "critical",
      message: errorMessage(error, "React render failure"),
      stack_trace: error?.stack || null,
      component_stack: info?.componentStack || null,
    });
  }

  render() {
    if (!this.state.crashed) return this.props.children;
    return (
      <main style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        color: "#13213a",
        background: "#f6f9ff",
      }}>
        <section style={{ maxWidth: "420px", textAlign: "center" }}>
          <h1 style={{ margin: "0 0 10px", fontSize: "1.35rem" }}>The page could not render.</h1>
          <p style={{ margin: "0 0 16px", color: "#52627d" }}>The error was reported for admin review.</p>
          <button type="button" onClick={() => window.location.reload()}>Reload</button>
        </section>
      </main>
    );
  }
}
