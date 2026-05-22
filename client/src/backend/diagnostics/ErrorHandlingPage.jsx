import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleSlash,
  Database,
  Download,
  Loader2,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
  X,
} from "lucide-react";
import {
  fetchEndpointChecks,
  fetchErrorGroupDetail,
  fetchErrorGroups,
  fetchErrorHandlingSummary,
  runEndpointChecks,
  updateErrorGroupStatus,
} from "../../shared/diagnosticsApi.js";
import "./ErrorHandlingPage.css";

const SESSION_EXPIRED_STATUS = 401;
const STATUS_OPTIONS = ["all", "open", "acknowledged", "resolved"];
const SEVERITY_OPTIONS = ["all", "critical", "error", "warning"];
const TIME_OPTIONS = [
  { value: "", label: "30 days" },
  { value: "24", label: "24 hours" },
  { value: "168", label: "7 days" },
];

function formatDateTime(value, utc = false) {
  if (!value) return "Not checked";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not checked";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    ...(utc ? { timeZone: "UTC", timeZoneName: "short" } : {}),
  }).format(date);
}

function titleCase(value) {
  return String(value || "unknown")
    .replace(/[_:-]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function csvValue(value) {
  const normalized = value == null
    ? ""
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);
  return `"${normalized.replace(/"/g, "\"\"")}"`;
}

function downloadCsv(filename, columns, rows) {
  const header = columns.map((column) => csvValue(column.label)).join(",");
  const body = rows.map((row) => columns.map((column) => csvValue(column.value(row))).join(","));
  const blob = new Blob([`\ufeff${[header, ...body].join("\r\n")}`], {
    type: "text/csv;charset=utf-8",
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
}

function csvDateTag() {
  return new Date().toISOString().slice(0, 10);
}

function healthTone(value) {
  const status = String(value || "unknown").toLowerCase();
  if (status === "healthy" || status === "ok") return "good";
  if (status === "unknown") return "warn";
  return "bad";
}

function statusTone(value) {
  const status = String(value || "").toLowerCase();
  if (status === "healthy" || status === "resolved") return "good";
  if (status === "acknowledged") return "warn";
  if (status === "failed" || status === "open" || status === "critical") return "bad";
  if (status === "registered_only" || status === "not_checked") return "neutral";
  return "neutral";
}

function prettyProbeStatus(route) {
  if (route?.recent_issue?.open_groups > 0 && route.probe_status !== "failed") {
    return "Observed issue";
  }
  if (route?.probe_status === "registered_only") {
    return "Registered";
  }
  return titleCase(route?.probe_status || "not checked");
}

function endpointDetail(route) {
  if (route?.error) return route.error;
  if (route?.skip_reason) return route.skip_reason;
  if (route?.recent_issue?.open_groups) return `${route.recent_issue.open_groups} recent open group(s)`;
  if (route?.probe_path && route.probe_path !== route.path) return `Checked sample ${route.probe_path}`;
  return "-";
}

function RestrictedDiagnostics() {
  return (
    <div className="eh-restricted">
      <ShieldAlert size={34} />
      <h2>Error Handling</h2>
      <p>Detailed operational diagnostics are available only to platform admins.</p>
    </div>
  );
}

function HealthCard({ label, value, detail, icon: Icon }) {
  return (
    <article className={`eh-health is-${healthTone(value)}`}>
      <Icon size={18} />
      <div>
        <span>{label}</span>
        <strong>{titleCase(value || "unknown")}</strong>
        <p>{detail || "No detail available."}</p>
      </div>
    </article>
  );
}

export default function ErrorHandlingPage({ role, onSessionExpired }) {
  const [summary, setSummary] = useState(null);
  const [groups, setGroups] = useState([]);
  const [total, setTotal] = useState(0);
  const [endpoints, setEndpoints] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    status: "open",
    severity: "all",
    source: "all",
    hours: "",
    search: "",
  });

  const sources = useMemo(() => summary?.sources || [], [summary]);
  const canView = String(role || "").toUpperCase() === "ADMIN";

  const handleLoadError = useCallback((err, fallback) => {
    if (err?.status === SESSION_EXPIRED_STATUS) {
      onSessionExpired?.();
      return;
    }
    setError(err instanceof Error ? err.message : fallback);
  }, [onSessionExpired]);

  const loadOverview = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    setError("");
    try {
      const [nextSummary, nextEndpoints] = await Promise.all([
        fetchErrorHandlingSummary(),
        fetchEndpointChecks(),
      ]);
      setSummary(nextSummary);
      setEndpoints(nextEndpoints);
    } catch (err) {
      handleLoadError(err, "Unable to load diagnostics overview.");
    } finally {
      setLoading(false);
    }
  }, [canView, handleLoadError]);

  const loadGroups = useCallback(async () => {
    if (!canView) return;
    try {
      const data = await fetchErrorGroups(filters);
      setGroups(Array.isArray(data?.items) ? data.items : []);
      setTotal(Number(data?.total) || 0);
    } catch (err) {
      handleLoadError(err, "Unable to load operational errors.");
    }
  }, [canView, filters, handleLoadError]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadGroups();
    }, filters.search ? 180 : 0);
    return () => window.clearTimeout(timer);
  }, [filters, loadGroups]);

  async function openGroup(groupId) {
    setError("");
    try {
      setDetail(await fetchErrorGroupDetail(groupId));
    } catch (err) {
      handleLoadError(err, "Unable to load error detail.");
    }
  }

  async function setGroupStatus(group, nextStatus) {
    setUpdatingId(group.id);
    setError("");
    try {
      const updated = await updateErrorGroupStatus(group.id, nextStatus);
      setGroups((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setDetail((current) => current?.group?.id === updated.id ? { ...current, group: updated } : current);
      await loadOverview();
    } catch (err) {
      handleLoadError(err, "Unable to update error triage status.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleRunChecks() {
    setChecking(true);
    setError("");
    try {
      setEndpoints(await runEndpointChecks());
    } catch (err) {
      handleLoadError(err, "Unable to run endpoint checks.");
    } finally {
      setChecking(false);
    }
  }

  function handleExportGroups() {
    downloadCsv(`campus404-error-groups-${csvDateTag()}.csv`, [
      { label: "ID", value: (group) => group.id },
      { label: "Title", value: (group) => group.title },
      { label: "Source", value: (group) => group.source_service },
      { label: "Kind", value: (group) => group.error_kind },
      { label: "Severity", value: (group) => group.severity },
      { label: "Status", value: (group) => group.status },
      { label: "Route", value: (group) => group.route_template },
      { label: "Operation", value: (group) => group.operation },
      { label: "HTTP Status", value: (group) => group.last_status_code },
      { label: "Occurrences", value: (group) => group.occurrence_count },
      { label: "First Seen", value: (group) => group.first_seen_at },
      { label: "Last Seen", value: (group) => group.last_seen_at },
      { label: "Message", value: (group) => group.last_message },
    ], groups);
  }

  function handleExportEndpoints() {
    downloadCsv(`campus404-endpoints-${csvDateTag()}.csv`, [
      { label: "Method", value: (route) => route.method },
      { label: "Path", value: (route) => route.path },
      { label: "Category", value: (route) => route.category },
      { label: "Probe Status", value: (route) => prettyProbeStatus(route) },
      { label: "HTTP Status", value: (route) => route.http_status },
      { label: "Checked At", value: (route) => route.checked_at },
      { label: "Checked Sample Path", value: (route) => route.probe_path },
      { label: "Skip Reason", value: (route) => route.skip_reason },
      { label: "Probe Error", value: (route) => route.error },
      { label: "Recent Open Error Groups", value: (route) => route.recent_issue?.open_groups || 0 },
    ], endpointRoutes);
  }

  if (!canView) return <RestrictedDiagnostics />;

  const serviceHealth = summary?.service_health || {};
  const metrics = summary?.groups || {};
  const endpointRoutes = Array.isArray(endpoints?.routes) ? endpoints.routes : [];
  const endpointSummary = endpoints?.latest_run?.summary || {};
  const skippedEndpointCount = endpointSummary.registered_only
    || endpointRoutes.filter((route) => route.probe_status === "registered_only").length;

  return (
    <div className="eh-page">
      <header className="eh-header">
        <div>
          <h2>Error Handling</h2>
          <p>Operational failures, service health, and safe endpoint checks for the platform.</p>
        </div>
        <button type="button" onClick={loadOverview} disabled={loading}>
          {loading ? <Loader2 size={15} className="eh-spin" /> : <RefreshCw size={15} />}
          Refresh
        </button>
      </header>

      {error && (
        <div className="eh-banner" role="alert">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      <section className="eh-health-grid" aria-label="Service health">
        <HealthCard label="API" value={serviceHealth.api?.status} detail={serviceHealth.api?.detail} icon={Server} />
        <HealthCard label="Database" value={serviceHealth.database?.status} detail={serviceHealth.database?.detail} icon={Database} />
        <HealthCard label="Judge" value={serviceHealth.judge?.status} detail={serviceHealth.judge?.detail} icon={Activity} />
        <HealthCard label="Redis" value={serviceHealth.redis?.status} detail={serviceHealth.redis?.detail} icon={Server} />
      </section>

      <section className="eh-metrics" aria-label="Error summary">
        <article className="is-open">
          <span className="eh-metric-mark"><AlertTriangle size={18} /></span>
          <div><span>Open groups</span><strong>{metrics.open || 0}</strong></div>
        </article>
        <article className="is-acknowledged">
          <span className="eh-metric-mark"><ShieldAlert size={18} /></span>
          <div><span>Acknowledged</span><strong>{metrics.acknowledged || 0}</strong></div>
        </article>
        <article className="is-resolved">
          <span className="eh-metric-mark"><CheckCircle2 size={18} /></span>
          <div><span>Resolved</span><strong>{metrics.resolved || 0}</strong></div>
        </article>
        <article className="is-recent">
          <span className="eh-metric-mark"><Activity size={18} /></span>
          <div><span>Occurrences 24h</span><strong>{summary?.recent_occurrences_24h || 0}</strong></div>
        </article>
      </section>

      <section className="eh-panel">
        <div className="eh-panel-title">
          <div>
            <h3>Operational error groups</h3>
            <p>{total} grouped failure{total === 1 ? "" : "s"} in the current filter.</p>
          </div>
          <button type="button" onClick={handleExportGroups} disabled={!groups.length} title="Export visible error groups as CSV">
            <Download size={15} />
            Export CSV
          </button>
        </div>

        <div className="eh-filters">
          <label className="eh-search">
            <Search size={15} />
            <input
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              placeholder="Search message or route..."
            />
          </label>
          <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
            {STATUS_OPTIONS.map((option) => <option value={option} key={option}>{titleCase(option)}</option>)}
          </select>
          <select value={filters.severity} onChange={(event) => setFilters((current) => ({ ...current, severity: event.target.value }))}>
            {SEVERITY_OPTIONS.map((option) => <option value={option} key={option}>{titleCase(option)}</option>)}
          </select>
          <select value={filters.source} onChange={(event) => setFilters((current) => ({ ...current, source: event.target.value }))}>
            <option value="all">All sources</option>
            {sources.map((item) => (
              <option value={item.source_service} key={item.source_service}>{titleCase(item.source_service)}</option>
            ))}
          </select>
          <select value={filters.hours} onChange={(event) => setFilters((current) => ({ ...current, hours: event.target.value }))}>
            {TIME_OPTIONS.map((item) => <option value={item.value} key={item.label}>{item.label}</option>)}
          </select>
        </div>

        <div className="eh-table-wrap">
          <table className="eh-table">
            <thead>
              <tr>
                <th>Error</th>
                <th>Source</th>
                <th>Status</th>
                <th>Count</th>
                <th>Last seen</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr key={group.id}>
                  <td>
                    <button type="button" className="eh-error-link" onClick={() => openGroup(group.id)}>
                      <strong>{group.title}</strong>
                      <span>{group.route_template || group.operation || "Route unavailable"}</span>
                    </button>
                  </td>
                  <td>
                    <span>{titleCase(group.source_service)}</span>
                    <small>{titleCase(group.error_kind)}</small>
                  </td>
                  <td><b className={`eh-pill is-${statusTone(group.status)}`}>{titleCase(group.status)}</b></td>
                  <td>{group.occurrence_count}</td>
                  <td title={formatDateTime(group.last_seen_at, true)}>{formatDateTime(group.last_seen_at)}</td>
                  <td>
                    <div className="eh-row-actions">
                      {group.status !== "acknowledged" && (
                        <button type="button" onClick={() => setGroupStatus(group, "acknowledged")} disabled={updatingId === group.id}>
                          Acknowledge
                        </button>
                      )}
                      {group.status !== "resolved" && (
                        <button type="button" onClick={() => setGroupStatus(group, "resolved")} disabled={updatingId === group.id}>
                          Resolve
                        </button>
                      )}
                      {group.status === "resolved" && (
                        <button type="button" onClick={() => setGroupStatus(group, "open")} disabled={updatingId === group.id}>
                          Reopen
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!groups.length && (
                <tr>
                  <td colSpan="6" className="eh-empty">
                    <CheckCircle2 size={20} />
                    No operational error groups match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="eh-panel">
        <div className="eh-panel-title eh-panel-title--checks">
          <div>
            <h3>Endpoint diagnostics</h3>
            <p>
              {endpointRoutes.length} registered routes. Latest check: {formatDateTime(endpoints?.latest_run?.completed_at)}.
            </p>
          </div>
          <div className="eh-title-actions">
            <button type="button" onClick={handleExportEndpoints} disabled={!endpointRoutes.length} title="Export endpoint inventory as CSV">
              <Download size={15} />
              Export CSV
            </button>
            <button type="button" onClick={handleRunChecks} disabled={checking}>
              {checking ? <Loader2 size={15} className="eh-spin" /> : <Activity size={15} />}
              Run Endpoint Checks
            </button>
          </div>
        </div>

        <div className="eh-endpoint-summary" aria-label="Endpoint check results">
          <article className="is-good">
            <strong>{endpointSummary.healthy || 0}</strong>
            <span>Live checks passed</span>
          </article>
          <article className="is-bad">
            <strong>{endpointSummary.failed || 0}</strong>
            <span>Live checks failed</span>
          </article>
          <article className="is-neutral">
            <strong>{skippedEndpointCount}</strong>
            <span>Registered, check skipped</span>
          </article>
        </div>

        <div className="eh-probe-note">
          <CircleSlash size={17} />
          <p>
            <strong>Registered, check skipped</strong> means the API route exists. The live checker skips writes,
            OAuth flows, uploads, progress-changing reads, and routes that need a real job or record case.
          </p>
        </div>

        <div className="eh-table-wrap">
          <table className="eh-table eh-table--endpoints">
            <thead>
              <tr>
                <th>Endpoint</th>
                <th>Category</th>
                <th>Check result</th>
                <th>HTTP</th>
                <th>Last checked</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {endpointRoutes.map((route) => {
                const routeTone = route.recent_issue?.open_groups > 0 && route.probe_status !== "failed"
                  ? "bad"
                  : statusTone(route.probe_status);
                return (
                  <tr key={route.route_id}>
                    <td><code>{route.method} {route.path}</code></td>
                    <td>{titleCase(route.category)}</td>
                    <td><b className={`eh-pill is-${routeTone}`}>{prettyProbeStatus(route)}</b></td>
                    <td>{route.http_status || "-"}</td>
                    <td>{formatDateTime(route.checked_at)}</td>
                    <td>{endpointDetail(route)}</td>
                  </tr>
                );
              })}
              {!endpointRoutes.length && (
                <tr><td colSpan="6" className="eh-empty"><CircleSlash size={20} /> Endpoint inventory is loading.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {detail && (
        <div className="eh-drawer-overlay" role="presentation" onMouseDown={() => setDetail(null)}>
          <aside className="eh-drawer" role="dialog" aria-modal="true" aria-labelledby="eh-detail-title" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <p>{titleCase(detail.group.source_service)} / {titleCase(detail.group.error_kind)}</p>
                <h3 id="eh-detail-title">{detail.group.title}</h3>
              </div>
              <button type="button" aria-label="Close error detail" onClick={() => setDetail(null)}><X size={18} /></button>
            </header>
            <div className="eh-detail-meta">
              <span className={`eh-pill is-${statusTone(detail.group.status)}`}>{titleCase(detail.group.status)}</span>
              <span>{detail.group.occurrence_count} occurrences</span>
              <span>First {formatDateTime(detail.group.first_seen_at, true)}</span>
              <span>Last {formatDateTime(detail.group.last_seen_at, true)}</span>
            </div>
            <section className="eh-occurrences">
              {(detail.occurrences || []).map((item) => (
                <article key={item.id}>
                  <div className="eh-occurrence-head">
                    <strong>{formatDateTime(item.occurred_at, true)}</strong>
                    <span>{item.method || "-"} {item.route_path || item.operation || "Route unavailable"}</span>
                  </div>
                  <dl>
                    <div><dt>Status</dt><dd>{item.status_code || "-"}</dd></div>
                    <div><dt>Request</dt><dd>{item.request_id || "-"}</dd></div>
                    <div><dt>User</dt><dd>{item.username || "Anonymous"}</dd></div>
                    <div><dt>IP</dt><dd>{item.ip_address || "-"}</dd></div>
                  </dl>
                  <p>{item.message}</p>
                  {item.stack_trace && <pre>{item.stack_trace}</pre>}
                  {item.component_stack && <pre>{item.component_stack}</pre>}
                  {item.details && <pre>{JSON.stringify(item.details, null, 2)}</pre>}
                </article>
              ))}
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
