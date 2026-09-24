import { apiUrl } from "./api.js";
import { authenticatedFetch } from "./authSession.js";

async function parseAdminResponse(response, fallback) {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload?.detail || payload?.message || fallback);
    error.status = response.status;
    throw error;
  }
  return payload;
}

export async function fetchErrorHandlingSummary() {
  const response = await authenticatedFetch(apiUrl("/api/admin/error-handling/summary"));
  return parseAdminResponse(response, "Unable to load error handling summary.");
}

export async function fetchErrorGroups({
  limit = 50,
  offset = 0,
  status = "all",
  severity = "all",
  source = "all",
  search = "",
  hours = "",
} = {}) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (status && status !== "all") params.set("status_filter", status);
  if (severity && severity !== "all") params.set("severity", severity);
  if (source && source !== "all") params.set("source_service", source);
  if (search.trim()) params.set("search", search.trim());
  if (hours) params.set("hours", String(hours));
  const response = await authenticatedFetch(apiUrl(`/api/admin/error-groups?${params.toString()}`));
  return parseAdminResponse(response, "Unable to load operational errors.");
}

export async function fetchErrorGroupDetail(groupId) {
  const response = await authenticatedFetch(apiUrl(`/api/admin/error-groups/${groupId}`));
  return parseAdminResponse(response, "Unable to load error detail.");
}

export async function updateErrorGroupStatus(groupId, status) {
  const response = await authenticatedFetch(apiUrl(`/api/admin/error-groups/${groupId}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  return parseAdminResponse(response, "Unable to update error status.");
}

export async function fetchEndpointChecks() {
  const response = await authenticatedFetch(apiUrl("/api/admin/endpoint-checks"));
  return parseAdminResponse(response, "Unable to load endpoint checks.");
}

export async function runEndpointChecks() {
  const response = await authenticatedFetch(apiUrl("/api/admin/endpoint-checks/run"), {
    method: "POST",
  });
  return parseAdminResponse(response, "Unable to run endpoint checks.");
}
