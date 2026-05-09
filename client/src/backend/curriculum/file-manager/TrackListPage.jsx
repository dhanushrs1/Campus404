import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { createTrack, getTracks } from "../../../shared/curriculumApi.js";
import TrackList from "./TrackList.jsx";
import "./TrackManagerShared.css";

const LANGUAGE_OPTIONS = [
  { value: 71, label: "Python (3.8.1)" },
  { value: 93, label: "JavaScript (Node.js 18.15.0)" },
  { value: 62, label: "Java (OpenJDK 13.0.1)" },
  { value: 54, label: "C++ (GCC 9.2.0)" },
  { value: 50, label: "C (GCC 9.2.0)" },
  { value: 73, label: "Rust (1.40.0)" },
  { value: 60, label: "Go (1.40.0)" },
];

const PAGE_SIZES = [6, 12, 24, 48];
const TRACK_EDITOR_QUERY_KEYS = ["mode", "trackId", "nodeType", "sectionId", "exerciseId", "taskId", "levelTab"];

function toPositiveInt(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function toPageSize(value) {
  const parsed = Number(value);
  return PAGE_SIZES.includes(parsed) ? parsed : 12;
}

export default function TrackListPage({ onEditTrack }) {
  const [searchParams, setSearchParams] = useSearchParams();

  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [newTrackTitle, setNewTrackTitle] = useState("");
  const [newTrackLanguageId, setNewTrackLanguageId] = useState("71");
  const [isCreatingTrack, setIsCreatingTrack] = useState(false);

  const currentPage = useMemo(() => {
    return toPositiveInt(searchParams.get("page")) || 1;
  }, [searchParams]);

  const itemsPerPage = useMemo(() => {
    return toPageSize(searchParams.get("perPage"));
  }, [searchParams]);

  useEffect(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      let changed = false;

      if ((next.get("tab") || "").toLowerCase() !== "tracks") {
        next.set("tab", "tracks");
        changed = true;
      }

      if ((next.get("trackPage") || "").toLowerCase() !== "list") {
        next.set("trackPage", "list");
        changed = true;
      }

      TRACK_EDITOR_QUERY_KEYS.forEach((queryKey) => {
        if (next.has(queryKey)) {
          next.delete(queryKey);
          changed = true;
        }
      });

      const rawPage = toPositiveInt(next.get("page"));
      if (!rawPage && next.has("page")) {
        next.delete("page");
        changed = true;
      }

      const rawPerPage = Number(next.get("perPage"));
      if (!PAGE_SIZES.includes(rawPerPage) && next.has("perPage")) {
        next.delete("perPage");
        changed = true;
      }

      return changed ? next : prev;
    }, { replace: true });
  }, [setSearchParams]);

  useEffect(() => {
    void loadTracks();
  }, []);

  async function loadTracks() {
    setLoading(true);
    setError("");
    try {
      const data = await getTracks();
      setTracks(data || []);
    } catch (err) {
      setError(err.message || "Failed to load tracks.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTrack(event) {
    event.preventDefault();
    if (!newTrackTitle.trim()) {
      return;
    }

    setSaving(true);
    setError("");
    try {
      await createTrack({
        title: newTrackTitle.trim(),
        description: "New Track Description",
        language_id: Number(newTrackLanguageId),
      });
      setNewTrackTitle("");
      setIsCreatingTrack(false);
      await loadTracks();
    } catch (err) {
      setError(err.message || "Failed to create track.");
    } finally {
      setSaving(false);
    }
  }

  function handlePageChange(nextPage) {
    const safeNextPage = toPositiveInt(nextPage) || 1;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", "tracks");
      next.set("trackPage", "list");

      if (safeNextPage > 1) {
        next.set("page", String(safeNextPage));
      } else {
        next.delete("page");
      }

      if (itemsPerPage !== 12) {
        next.set("perPage", String(itemsPerPage));
      } else {
        next.delete("perPage");
      }

      return next;
    }, { replace: true });
  }

  function handleItemsPerPageChange(nextPerPage) {
    const safeNextPerPage = toPageSize(nextPerPage);

    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", "tracks");
      next.set("trackPage", "list");
      next.delete("page");

      if (safeNextPerPage !== 12) {
        next.set("perPage", String(safeNextPerPage));
      } else {
        next.delete("perPage");
      }

      return next;
    }, { replace: true });
  }

  return (
    <div className="cfm-root">
      <div className="cfm-topbar">
        <div>
          <h2>Track Manager</h2>
          <p>Manage your curriculum tracks. Edit opens a dedicated editor page.</p>
        </div>
        <button type="button" className="cfm-btn" onClick={() => setIsCreatingTrack((prev) => !prev)}>
          <Plus size={14} /> New Track
        </button>
      </div>

      {error && <div className="cfm-error">{error}</div>}

      {isCreatingTrack && (
        <div className="cfm-track-create-panel">
          <h3>Create a New Track</h3>
          <form onSubmit={handleCreateTrack} className="cfm-track-create-inline">
            <div className="cfm-track-create-fields">
              <input
                value={newTrackTitle}
                onChange={(event) => setNewTrackTitle(event.target.value)}
                placeholder="Track title"
                required
              />
              <select
                value={newTrackLanguageId}
                onChange={(event) => setNewTrackLanguageId(event.target.value)}
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className="cfm-track-create-actions">
                <button type="submit" className="cfm-btn" disabled={saving}>
                  {saving ? <Loader2 size={14} className="cfm-spin" /> : "Create Track"}
                </button>
                <button type="button" className="cfm-btn cfm-btn--ghost" onClick={() => setIsCreatingTrack(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="cfm-tree-empty">Loading tracks...</div>
      ) : (
        <TrackList
          tracks={tracks}
          onEditTrack={onEditTrack}
          refreshTracks={loadTracks}
          currentPage={currentPage}
          itemsPerPage={itemsPerPage}
          onPageChange={handlePageChange}
          onItemsPerPageChange={handleItemsPerPageChange}
        />
      )}
    </div>
  );
}
