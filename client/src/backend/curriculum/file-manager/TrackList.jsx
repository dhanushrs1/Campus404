import { useState, useEffect } from "react";
import { 
  BarChart2, 
  ChevronLeft, 
  ChevronRight, 
  Edit3, 
  Eye, 
  ImagePlus, 
  Trash2, 
  X,
  ExternalLink,
  Loader2,
  AlertTriangle
} from "lucide-react";
import { deleteTrack, getSections, getExercises, getTasks } from "../../../shared/curriculumApi.js";
import { logAdminActivity } from "../../../shared/api.js";
import "./TrackList.css";

const LANGUAGE_OPTIONS = [
  { value: 71, label: "Python (3.8.1)" },
  { value: 93, label: "JavaScript (Node.js 18.15.0)" },
  { value: 62, label: "Java (OpenJDK 13.0.1)" },
  { value: 54, label: "C++ (GCC 9.2.0)" },
  { value: 50, label: "C (GCC 9.2.0)" },
  { value: 73, label: "Rust (1.40.0)" },
  { value: 60, label: "Go (1.40.0)" },
];

export default function TrackList({
  tracks,
  onEditTrack,
  refreshTracks,
  currentPage,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
}) {

  // Modals state
  const [previewTrack, setPreviewTrack] = useState(null);
  const [deleteTrackCandidate, setDeleteTrackCandidate] = useState(null);

  // Stats state for Preview Modal
  const [statsLoading, setStatsLoading] = useState(false);
  const [trackStats, setTrackStats] = useState({ sections: 0, exercises: 0, levels: 0 });

  // Delete Confirmation state
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const safeItemsPerPage = Number.isInteger(itemsPerPage) && itemsPerPage > 0 ? itemsPerPage : 12;
  const safeCurrentPage = Number.isInteger(currentPage) && currentPage > 0 ? currentPage : 1;

  // Pagination logic
  const totalPages = Math.ceil(tracks.length / safeItemsPerPage) || 1;
  const normalizedPage = Math.min(safeCurrentPage, totalPages);
  const startIndex = (normalizedPage - 1) * safeItemsPerPage;
  const endIndex = Math.min(startIndex + safeItemsPerPage, tracks.length);
  const visibleTracks = tracks.slice(startIndex, endIndex);

  // Ensure current page is valid when total items or items per page change.
  useEffect(() => {
    if (normalizedPage !== safeCurrentPage) {
      onPageChange?.(normalizedPage);
    }
  }, [normalizedPage, onPageChange, safeCurrentPage]);

  const handleItemsPerPageChange = (e) => {
    const next = Number(e.target.value);
    onItemsPerPageChange?.(next);
  };

  const handlePageChange = (direction) => {
    if (direction === "prev" && normalizedPage > 1) {
      onPageChange?.(normalizedPage - 1);
    } else if (direction === "next" && normalizedPage < totalPages) {
      onPageChange?.(normalizedPage + 1);
    }
  };

  // Preview Modal logic
  const openPreview = async (track) => {
    setPreviewTrack(track);
    setStatsLoading(true);
    try {
      let sectionsCount = 0;
      let exercisesCount = 0;
      let levelsCount = 0;

      const sections = await getSections(track.id) || [];
      sectionsCount = sections.length;

      for (const section of sections) {
        const exercises = await getExercises(section.id) || [];
        exercisesCount += exercises.length;

        for (const exercise of exercises) {
          const tasks = await getTasks(exercise.id) || [];
          levelsCount += tasks.length;
        }
      }

      setTrackStats({
        sections: sectionsCount,
        exercises: exercisesCount,
        levels: levelsCount
      });
    } catch (error) {
      console.error("Failed to load stats:", error);
    } finally {
      setStatsLoading(false);
    }
  };

  const closePreview = () => {
    setPreviewTrack(null);
    setTrackStats({ sections: 0, exercises: 0, levels: 0 });
  };

  const handleGoToEditor = (trackId) => {
    closePreview();
    onEditTrack(trackId);
  };

  // Delete Modal logic
  const openDeleteConfirm = (track) => {
    setDeleteTrackCandidate(track);
    setConfirmText("");
  };

  const closeDeleteConfirm = () => {
    setDeleteTrackCandidate(null);
    setConfirmText("");
    setIsDeleting(false);
  };

  const handleDelete = async () => {
    if (confirmText !== "CONFIRM" || !deleteTrackCandidate) return;

    setIsDeleting(true);
    try {
      await deleteTrack(deleteTrackCandidate.id);
      
      // Log admin activity
      await logAdminActivity({
        activity_type: "DELETE_TRACK",
        target_path: `/api/admin/tracks/${deleteTrackCandidate.id}`,
        details: {
          track_id: deleteTrackCandidate.id,
          track_title: deleteTrackCandidate.title
        }
      });

      await refreshTracks();
      closeDeleteConfirm();
    } catch (err) {
      console.error("Failed to delete track:", err);
      alert("Failed to delete track. Please check console for details.");
      setIsDeleting(false);
    }
  };

  if (!tracks || tracks.length === 0) {
    return <div className="cfm-tree-empty">No tracks yet. Create your first track.</div>;
  }

  return (
    <>
      <div className="cfm-list-controls">
        <div className="cfm-screen-options">
          <label htmlFor="itemsPerPage">Screen Options: Tracks per page</label>
          <select 
            id="itemsPerPage" 
            value={safeItemsPerPage} 
            onChange={handleItemsPerPageChange}
          >
            <option value="6">6</option>
            <option value="12">12</option>
            <option value="24">24</option>
            <option value="48">48</option>
          </select>
        </div>

        <div className="cfm-pagination">
          <span className="cfm-pagination-info">
            Showing {startIndex + 1}-{endIndex} of {tracks.length}
          </span>
          <button 
            type="button" 
            className="cfm-pagination-btn"
            onClick={() => handlePageChange("prev")}
            disabled={normalizedPage === 1}
            title="Previous Page"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="cfm-pagination-info">
            Page {normalizedPage} of {totalPages}
          </span>
          <button 
            type="button" 
            className="cfm-pagination-btn"
            onClick={() => handlePageChange("next")}
            disabled={normalizedPage === totalPages}
            title="Next Page"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="cfm-track-grid">
        {visibleTracks.map((track) => {
          const langLabel = LANGUAGE_OPTIONS.find(l => l.value === track.language_id)?.label || `Language ID: ${track.language_id}`;
          return (
            <div key={track.id} className="cfm-track-card">
              <div className="cfm-track-card__img">
                {track.featured_image_url ? (
                  <img src={track.featured_image_url} alt={track.title} />
                ) : (
                  <ImagePlus size={24} />
                )}
              </div>
              
              <div className="cfm-track-card__content">
                <div className="cfm-track-card__header">
                  <h3>{track.title}</h3>
                  <span className="cfm-track-card__lang">{langLabel}</span>
                </div>
                <p className="cfm-track-card__desc">
                  {track.description || "No description provided."}
                </p>
              </div>

              <div className="cfm-track-card__actions">
                <div className="cfm-track-card__action-group">
                  <button 
                    className="cfm-track-card__icon-btn cfm-tooltip-trigger" 
                    onClick={() => openPreview(track)}
                    aria-label="Details"
                    data-tooltip="Details"
                  >
                    <Eye size={16} />
                  </button>
                  <button 
                    className="cfm-track-card__icon-btn cfm-tooltip-trigger" 
                    onClick={() => alert("Analytics feature coming soon")}
                    aria-label="Analytics"
                    data-tooltip="Analytics"
                  >
                    <BarChart2 size={16} />
                  </button>
                </div>
                
                <div className="cfm-track-card__action-group">
                  <button 
                    className="cfm-btn cfm-btn--ghost" 
                    onClick={() => onEditTrack(track.id)}
                  >
                      <Edit3 size={14} className="cfm-btn-icon" /> Edit
                  </button>
                  <button 
                    className="cfm-track-card__icon-btn cfm-track-card__icon-btn--danger cfm-tooltip-trigger" 
                    onClick={() => openDeleteConfirm(track)}
                    aria-label="Delete"
                    data-tooltip="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Preview Modal */}
      {previewTrack && (
        <div className="cfm-modal-overlay" onClick={closePreview}>
          <div className="cfm-modal" onClick={e => e.stopPropagation()}>
            <div className="cfm-modal-header">
              <h3>Track Preview</h3>
              <button className="cfm-modal-close" onClick={closePreview}>
                <X size={18} />
              </button>
            </div>
            <div className="cfm-modal-content">
              <h4 className="cfm-preview-title">{previewTrack.title}</h4>
              <p className="cfm-preview-description">
                {previewTrack.description || "No description provided."}
              </p>

              {statsLoading ? (
                <div className="cfm-preview-loading">
                  <Loader2 size={24} className="cfm-spin" />
                </div>
              ) : (
                <div className="cfm-preview-stats">
                  <div className="cfm-stat-box">
                    <span className="cfm-stat-value">{trackStats.sections}</span>
                    <span className="cfm-stat-label">Sections</span>
                  </div>
                  <div className="cfm-stat-box">
                    <span className="cfm-stat-value">{trackStats.exercises}</span>
                    <span className="cfm-stat-label">Exercises</span>
                  </div>
                  <div className="cfm-stat-box">
                    <span className="cfm-stat-value">{trackStats.levels}</span>
                    <span className="cfm-stat-label">Levels</span>
                  </div>
                </div>
              )}

              <div className="cfm-preview-actions">
                <button 
                  className="cfm-btn" 
                  onClick={() => handleGoToEditor(previewTrack.id)}
                >
                  <ExternalLink size={14} className="cfm-btn-icon" />
                  Open in Track Editor
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTrackCandidate && (
        <div className="cfm-modal-overlay" onClick={closeDeleteConfirm}>
          <div className="cfm-modal" onClick={e => e.stopPropagation()}>
            <div className="cfm-modal-header">
              <h3 className="cfm-modal-title-danger">Confirm Deletion</h3>
              <button className="cfm-modal-close" onClick={closeDeleteConfirm}>
                <X size={18} />
              </button>
            </div>
            
            <div className="cfm-modal-content">
              <div className="cfm-delete-warning">
                <AlertTriangle size={24} className="cfm-delete-warning-icon" />
                <div className="cfm-delete-warning-text">
                  <p><strong>Warning:</strong> You are about to permanently delete this track.</p>
                  <p>
                    Track:
                    <span className="cfm-delete-track-name">{deleteTrackCandidate.title}</span>
                  </p>
                  <p>This action will also delete all associated sections, exercises, and levels. This cannot be undone.</p>
                </div>
              </div>

              <div className="cfm-confirm-input">
                <label htmlFor="confirmDelete">Please type <strong>CONFIRM</strong> to verify.</label>
                <input 
                  id="confirmDelete"
                  type="text" 
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="CONFIRM"
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="cfm-modal-footer">
              <button 
                className="cfm-btn cfm-btn--ghost" 
                onClick={closeDeleteConfirm}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button 
                className="cfm-btn cfm-btn--danger" 
                onClick={handleDelete}
                disabled={confirmText !== "CONFIRM" || isDeleting}
              >
                {isDeleting ? <Loader2 size={14} className="cfm-spin" /> : "Delete Track"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
