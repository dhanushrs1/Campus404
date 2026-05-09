
/**
 * List all media files, with optional search query and category filter.
 * @param {{ query?: string, category?: string, skip?: number, limit?: number }} options
 * @returns {Promise<{ items: object[] }>}
 */
export async function listMedia({ query = "", category = "", skip = 0, limit = 30 } = {}) {
  const params = new URLSearchParams();
  if (query && query.trim()) params.set("q", query.trim());
  if (category && category !== "all") params.set("category", category);
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
export async function uploadMediaFiles(files) {
  if (!files || files.length === 0) {
    throw new Error("Select at least one file to upload.");
  }

  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }

  const res = await fetch(apiUrl("/api/admin/media/upload"), {
    method: "POST",
    headers: {
      // No Content-Type — the browser sets multipart/form-data with the correct boundary.
