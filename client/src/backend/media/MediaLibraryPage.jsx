import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  FileAudio,
  FileText,
  Film,
  Grid3X3,
  Image as ImageIcon,
  ImagePlus,
  List,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { deleteMediaFile, getMediaStorageSettings, listMedia, getOptimizedCloudinaryUrl } from "../../shared/mediaApi.js";
import UploadMediaModal from "./components/UploadMediaModal.jsx";
import "./MediaLibraryPage.css";

// ── Formatters ─────────────────────────────────────────────────────────────

function formatBytes(value) {
  const size = Number(value || 0);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Category Badge ─────────────────────────────────────────────────────────

const CAT_ICONS = {
  image: ImageIcon,
  video: Film,
  audio: FileAudio,
  document: FileText,
  file: FileText,
};

function CategoryBadge({ category }) {
  const Icon = CAT_ICONS[category] || FileText;
  const cls = `ml-cat-badge ml-cat-badge--${category || "file"}`;
  return (
    <span className={cls}>
      <Icon size={9} />
      {category || "file"}
    </span>
  );
}

// ── Media Preview ──────────────────────────────────────────────────────────

function MediaPreview({ item, size = 24 }) {
  const [imgError, setImgError] = useState(false);

  if (item.category === "image" && item.url && !imgError) {
    return (
      <img
        src={getOptimizedCloudinaryUrl(item.url, item.category, 600)}
        alt={item.filename || ""}
        className="ml-preview"
        onError={() => setImgError(true)}
        loading="lazy"
      />
    );
  }

  if (item.category === "video" && item.url) {
    return <video className="ml-preview" src={item.url} preload="metadata" muted><track kind="captions" /></video>;
  }

  const Icon = CAT_ICONS[item.category] || FileText;
  return (
    <div className="ml-preview ml-preview--generic">
      <Icon size={size} strokeWidth={1.5} style={{ color: "var(--text-tertiary)" }} />
    </div>
  );
}

// ── Delete Confirm Modal ───────────────────────────────────────────────────

function DeleteConfirmModal({ item, onConfirm, onCancel, isDeleting }) {
  return (
    <div className="ml-confirm-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="ml-confirm-modal" role="dialog" aria-modal="true">
        <div className="ml-confirm-modal__header">
          <h3>Delete Media File?</h3>
          <button className="ml-modal-close" onClick={onCancel} disabled={isDeleting}>
            <X size={18} />
          </button>
        </div>
        <div className="ml-confirm-modal__body">
          <p className="ml-confirm-modal__desc">
            <strong>{item.original_filename || item.filename}</strong> will be permanently removed
            from the media library and cannot be recovered.
          </p>
          <div className="ml-confirm-modal__actions">
            <button
              type="button"
              className="ml-btn ml-btn--ghost"
              onClick={onCancel}
              disabled={isDeleting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="ml-btn ml-btn--danger-solid"
              onClick={onConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 size={14} className="ml-spin" /> : <Trash2 size={14} />}
              {isDeleting ? "Deleting…" : "Delete permanently"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Media Card (Grid) ──────────────────────────────────────────────────────

function MediaCard({ item, onDelete, onCopy, copied, isDeleting }) {
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <>
      {showConfirm && (
        <DeleteConfirmModal
          item={item}
          onConfirm={() => { setShowConfirm(false); onDelete(item); }}
          onCancel={() => setShowConfirm(false)}
          isDeleting={isDeleting}
        />
      )}
      <article className="ml-card">
        <div className="ml-card__preview-wrap">
          <MediaPreview item={item} size={28} />
          {item.url && (
            <div className="ml-card__overlay">
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="ml-overlay-btn" title="Open">
                <ExternalLink size={13} />
              </a>
            </div>
          )}
        </div>

        <div className="ml-card__body">
          <div className="ml-card__name" title={item.original_filename || item.filename}>
            {item.original_filename || item.filename}
          </div>
          <div className="ml-card__meta">
            <CategoryBadge category={item.category} />
            <span className="ml-card__size">{formatBytes(item.size)}</span>
          </div>
          <div className="ml-card__date">{formatDate(item.uploaded_at || item.modified_at)}</div>
          {item.uploaded_by_name && (
            <div className="ml-card__uploader">by {item.uploaded_by_name}</div>
          )}
        </div>

        <div className="ml-card__actions">
          {item.url && (
            <button
              type="button"
              className={`ml-action-btn ${copied === item.url ? "ml-action-btn--copied" : ""}`}
              onClick={() => onCopy(item.url)}
              title="Copy URL"
            >
              {copied === item.url ? <Check size={12} /> : <Copy size={12} />}
              {copied === item.url ? "Copied" : "Copy URL"}
            </button>
          )}
          <button
            type="button"
            className="ml-action-btn ml-action-btn--delete"
            onClick={() => setShowConfirm(true)}
            disabled={isDeleting}
            title="Delete"
          >
            {isDeleting ? <Loader2 size={12} className="ml-spin" /> : <Trash2 size={12} />}
          </button>
        </div>
      </article>
    </>
  );
}

// ── List Row ───────────────────────────────────────────────────────────────

function MediaListRow({ item, onDelete, onCopy, copied, isDeleting }) {
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <>
      {showConfirm && (
        <DeleteConfirmModal
          item={item}
          onConfirm={() => { setShowConfirm(false); onDelete(item); }}
          onCancel={() => setShowConfirm(false)}
          isDeleting={isDeleting}
        />
      )}
      <tr>
        <td>
          <div className="ml-list-thumb">
            <MediaPreview item={item} size={18} />
          </div>
        </td>
        <td>
          <div className="ml-list-name-cell">
            <span className="ml-list-primary" title={item.original_filename || item.filename}>
              {item.original_filename || item.filename}
            </span>
            <span className="ml-list-secondary">{item.filename}</span>
          </div>
        </td>
        <td><CategoryBadge category={item.category} /></td>
        <td><span className="ml-list-meta">{formatBytes(item.size)}</span></td>
        <td><span className="ml-list-meta">{formatDateTime(item.uploaded_at || item.modified_at)}</span></td>
        <td><span className="ml-list-meta">{item.uploaded_by_name || "—"}</span></td>
        <td>
          <div className="ml-inline-actions">
            {item.url && (
              <>
                <button
                  type="button"
                  className={`ml-icon-btn ${copied === item.url ? "ml-icon-btn--copied" : ""}`}
                  onClick={() => onCopy(item.url)}
                  title="Copy URL"
                >
                  {copied === item.url ? <Check size={13} /> : <Copy size={13} />}
                </button>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-icon-btn"
                  title="Open"
                >
                  <ExternalLink size={13} />
                </a>
              </>
            )}
            <button
              type="button"
              className="ml-icon-btn ml-icon-btn--danger"
              onClick={() => setShowConfirm(true)}
              disabled={isDeleting}
              title="Delete"
            >
              {isDeleting ? <Loader2 size={13} className="ml-spin" /> : <Trash2 size={13} />}
            </button>
          </div>
        </td>
      </tr>
    </>
  );
}

// ── Filter Tabs config ─────────────────────────────────────────────────────

const FILTER_TABS = [
  { key: "all", label: "All" },
  { key: "image", label: "Images" },
  { key: "video", label: "Videos" },
  { key: "audio", label: "Audio" },
  { key: "document", label: "Documents" },
];

// ── Main Page ──────────────────────────────────────────────────────────────

export default function MediaLibraryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [copied, setCopied] = useState("");
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [deletingKey, setDeletingKey] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [storageTargetLabel, setStorageTargetLabel] = useState("Cloudinary CDN");
  
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const LIMIT = 30;

  const debounceTimer = useRef(null);

  useEffect(() => {
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedQuery(query), 350);
    return () => clearTimeout(debounceTimer.current);
  }, [query]);

  useEffect(() => {
    setSkip(0);
    setHasMore(true);
    void loadMedia(false, 0);
  }, [debouncedQuery, category]);

  useEffect(() => {
    void loadStorageSettings();
  }, []);

  async function loadStorageSettings() {
    try {
      const settings = await getMediaStorageSettings();
      const active = (settings?.active_provider || "cloudinary").toLowerCase();
      setStorageTargetLabel(active === "cloudinary" ? "Cloudinary CDN" : "Cloudinary CDN");
    } catch {
      setStorageTargetLabel("Cloudinary CDN");
    }
  }

  async function loadMedia(isRefresh = false, currentSkip = 0) {
    if (isRefresh) setRefreshing(true);
    else if (currentSkip === 0) setLoading(true);
    else setLoadingMore(true);
    
    setError("");
    try {
      const res = await listMedia({ query: debouncedQuery, category, skip: currentSkip, limit: LIMIT });
      if (currentSkip === 0) {
        setItems(res.items || []);
      } else {
        setItems(prev => [...prev, ...(res.items || [])]);
      }
      setHasMore((res.items?.length || 0) === LIMIT);
      setSkip(currentSkip);
    } catch (err) {
      setError(err.message || "Failed to load media.");
    } finally {
      if (currentSkip === 0) setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }

  const handleCopy = useCallback(async (url) => {
    try {
      const full = url.startsWith("http") ? url : `${window.location.origin}${url}`;
      await navigator.clipboard.writeText(full);
      setCopied(url);
      setTimeout(() => setCopied((c) => (c === url ? "" : c)), 2000);
    } catch {
      setError("Could not copy to clipboard.");
    }
  }, []);

  const handleDelete = useCallback(async (item) => {
    setDeletingKey(item.relative_path);
    setError("");
    try {
      await deleteMediaFile({ relativePath: item.relative_path });
      setItems((prev) => prev.filter((i) => i.relative_path !== item.relative_path));
    } catch (err) {
      setError(err.message || "Could not delete file.");
    } finally {
      setDeletingKey("");
    }
  }, []);

  const totalSize = items.reduce((acc, it) => acc + Number(it.size || 0), 0);

  return (
    <div className="ml-container">
      <UploadMediaModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploaded={() => {
          setSkip(0);
          setHasMore(true);
          void loadMedia(true, 0);
        }}
        storageTargetLabel={storageTargetLabel}
      />

      {/* Header — same pattern as um-header */}
      <div className="ml-header">
        <div className="ml-header-content">
          <h2 className="ml-title">Media Library</h2>
          <p className="ml-subtitle">Upload and manage images, videos, audio, and documents from admin panel. Active destination: {storageTargetLabel}.</p>
        </div>
        <div className="ml-header-actions">
          <button
            type="button"
            className="ml-btn ml-btn--ghost ml-btn--icon"
            onClick={() => {
              setSkip(0);
              setHasMore(true);
              void loadMedia(true, 0);
            }}
            disabled={refreshing || loading}
            title="Refresh"
          >
            <RefreshCw size={15} className={refreshing ? "ml-spin" : ""} />
          </button>
          <button
            type="button"
            className="ml-btn ml-btn--primary"
            onClick={() => setIsUploadModalOpen(true)}
          >
            <ImagePlus size={15} />
            Upload Media
          </button>
        </div>
      </div>

      {/* Stats */}
      {items.length > 0 && (
        <div className="ml-stats">
          <div className="ml-stat">
            <span className="ml-stat__value">{items.length}</span>
            <span>files</span>
          </div>
          <div className="ml-stat-sep" />
          <div className="ml-stat">
            <span className="ml-stat__value">{formatBytes(totalSize)}</span>
            <span>total size</span>
          </div>
        </div>
      )}

      {/* Controls — same pattern as um-controls */}
      <div className="ml-controls">
        <div className="ml-search">
          <Search size={16} className="ml-search__icon" />
          <input
            type="text"
            placeholder="Search by filename, type…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search media files"
          />
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          {/* Category filter — same as um-filters */}
          <div className="ml-filters" role="tablist">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={category === tab.key}
                className={`ml-filter-btn ${category === tab.key ? "ml-filter-btn--active" : ""}`}
                onClick={() => setCategory(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* View toggle */}
          <div className="ml-view-toggle">
            <button
              type="button"
              className={`ml-view-btn ${viewMode === "grid" ? "ml-view-btn--active" : ""}`}
              onClick={() => setViewMode("grid")}
              title="Grid view"
            >
              <Grid3X3 size={14} />
            </button>
            <button
              type="button"
              className={`ml-view-btn ${viewMode === "list" ? "ml-view-btn--active" : ""}`}
              onClick={() => setViewMode("list")}
              title="List view"
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="ml-error" role="alert">
          {error}
          <button type="button" className="ml-error__dismiss" onClick={() => setError("")}>×</button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="ml-state-box">
          <Loader2 size={24} className="ml-spin" style={{ color: "var(--text-secondary)" }} />
          <p>Loading media library…</p>
        </div>
      ) : items.length === 0 ? (
        <div className="ml-state-box">
          <ImagePlus size={40} strokeWidth={1.2} />
          <p>No media files found.</p>
          <button type="button" className="ml-btn ml-btn--primary" onClick={() => setIsUploadModalOpen(true)}>
            Upload your first file
          </button>
        </div>
      ) : viewMode === "grid" ? (
        <div className="ml-grid">
          {items.map((item) => (
            <MediaCard
              key={item.id ?? item.relative_path}
              item={item}
              onDelete={handleDelete}
              onCopy={handleCopy}
              copied={copied}
              isDeleting={deletingKey === item.relative_path}
            />
          ))}
        </div>
      ) : (
        <div className="ml-table-wrapper">
          <table className="ml-table">
            <thead>
              <tr>
                <th style={{ width: 48 }}></th>
                <th>File</th>
                <th>Type</th>
                <th>Size</th>
                <th>Uploaded</th>
                <th>By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <MediaListRow
                  key={item.id ?? item.relative_path}
                  item={item}
                  onDelete={handleDelete}
                  onCopy={handleCopy}
                  copied={copied}
                  isDeleting={deletingKey === item.relative_path}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Load More Button */}
      {hasMore && !loading && items.length > 0 && (
        <div style={{ textAlign: "center", padding: "20px 0" }}>
           <button 
             className="ml-btn ml-btn--ghost" 
             onClick={() => loadMedia(false, skip + LIMIT)}
             disabled={loadingMore}
           >
             {loadingMore ? "Loading..." : "Load More"}
           </button>
        </div>
      )}
    </div>
  );
}
