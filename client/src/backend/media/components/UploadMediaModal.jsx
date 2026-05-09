import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  File,
  FileText,
  Loader2,
  Music,
  ShieldCheck,
  Upload,
  Video,
  X,
  Image as ImageIcon,
} from "lucide-react";
import { uploadMediaFiles } from "../../../shared/mediaApi.js";
import "./UploadMediaModal.css";

// ── Constants ──────────────────────────────────────────────────────────────
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".jfif", ".pjpeg", ".avif",
  ".png", ".webp", ".gif", ".bmp", ".svg",
  ".mp4", ".webm", ".mov",
  ".mp3", ".wav", ".ogg",
  ".pdf", ".txt", ".md", ".json", ".csv", ".zip",
]);

// ── Helpers ────────────────────────────────────────────────────────────────
function formatBytes(value) {
  const size = Number(value || 0);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function getFileExt(name) {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

function classifyFile(file) {
  const t = (file.type || "").toLowerCase();
  const ext = getFileExt(file.name);
  if (t.startsWith("image/") || [".jpg",".jpeg",".jfif",".pjpeg",".avif",".png",".webp",".gif",".bmp",".svg"].includes(ext))
    return "image";
  if (t.startsWith("video/") || [".mp4",".webm",".mov"].includes(ext))
    return "video";
  if (t.startsWith("audio/") || [".mp3",".wav",".ogg"].includes(ext))
    return "audio";
  if (t === "application/pdf" || ext === ".pdf")
    return "pdf";
  return "other";
}

function validateFile(file) {
  const ext = getFileExt(file.name);
  if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
    return `"${file.name}" has an unsupported file type (${ext}).`;
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `"${file.name}" exceeds the 5 MB size limit (${formatBytes(file.size)}).`;
  }
  if (file.size === 0) {
    return `"${file.name}" is empty and cannot be uploaded.`;
  }
  return null;
}

const FILE_ICONS = {
  image: ImageIcon,
  video: Video,
  audio: Music,
  pdf: FileText,
  other: File,
};

const FILE_COLORS = {
  image: "#6366f1",
  video: "#ec4899",
  audio: "#f59e0b",
  pdf: "#ef4444",
  other: "#64748b",
};

// ── File Preview Item ──────────────────────────────────────────────────────
function FilePreviewItem({ item, onRemove }) {
  const Icon = FILE_ICONS[item.kind] || File;

  return (
    <div className={`umm-file ${item.error ? "umm-file--error" : ""}`}>
      <div className="umm-file__thumb">
        {item.previewUrl && item.kind === "image" ? (
          <img src={item.previewUrl} alt={item.name} className="umm-file__img" />
        ) : item.previewUrl && item.kind === "video" ? (
          <video src={item.previewUrl} className="umm-file__img" muted />
        ) : (
          <div
            className="umm-file__icon"
            style={{ color: FILE_COLORS[item.kind] || "#64748b" }}
          >
            <Icon size={20} strokeWidth={1.5} />
          </div>
        )}
        {item.error && (
          <div className="umm-file__erricon">
            <AlertCircle size={12} />
          </div>
        )}
      </div>

      <div className="umm-file__info">
        <span className="umm-file__name" title={item.name}>{item.name}</span>
        {item.error ? (
          <span className="umm-file__error-msg">{item.error}</span>
        ) : (
          <span className="umm-file__meta">
            <span className="umm-file__kind">{item.kind}</span>
            <span className="umm-file__size">{formatBytes(item.size)}</span>
          </span>
        )}
      </div>

      <button
        type="button"
        className="umm-file__remove"
        onClick={() => onRemove(item.key)}
        title="Remove from queue"
      >
        <X size={12} />
      </button>
    </div>
  );
}

// ── Upload Progress Bar ───────────────────────────────────────────────────
function UploadProgress({ current, total }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="umm-progress">
      <div className="umm-progress__bar" style={{ width: `${pct}%` }} />
      <span className="umm-progress__label">{pct}%</span>
    </div>
  );
}

// ── Main Modal ─────────────────────────────────────────────────────────────
export default function UploadMediaModal({ isOpen, onClose, onUploaded, storageTargetLabel = "Cloudinary CDN" }) {
  const [fileQueue, setFileQueue] = useState([]); // { key, file, name, size, kind, previewUrl, error }
  const [isUploading, setIsUploading] = useState(false);
  const [uploaded, setUploaded] = useState(null); // count on success
  const [globalError, setGlobalError] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef(null);
  const dragCounter = useRef(0);

  // Revoke object URLs when queue changes or modal closes
  useEffect(() => {
    return () => {
      fileQueue.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, [fileQueue]);

  const resetAll = useCallback(() => {
    fileQueue.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    setFileQueue([]);
    setGlobalError("");
    setUploaded(null);
    setIsDragging(false);
    dragCounter.current = 0;
  }, [fileQueue]);

  const closeAndReset = useCallback(() => {
    resetAll();
    onClose?.();
  }, [resetAll, onClose]);

  const addFiles = useCallback((rawFiles) => {
    if (!rawFiles || rawFiles.length === 0) return;
    setGlobalError("");
    setUploaded(null);

    const incoming = Array.from(rawFiles);
    setFileQueue((prev) => {
      const existingKeys = new Set(prev.map((i) => i.key));
      const next = [...prev];

      for (const file of incoming) {
        const key = `${file.name}::${file.size}::${file.lastModified}`;
        if (existingKeys.has(key)) continue; // deduplicate

        const kind = classifyFile(file);
        const error = validateFile(file);
        const canPreview = !error && (kind === "image" || kind === "video" || kind === "audio");
        const previewUrl = canPreview ? URL.createObjectURL(file) : null;

        next.push({ key, file, name: file.name, size: file.size, kind, previewUrl, error });
      }

      return next;
    });
  }, []);

  const removeFile = useCallback((key) => {
    setFileQueue((prev) => {
      const item = prev.find((i) => i.key === key);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((i) => i.key !== key);
    });
  }, []);

  // Drag handlers
  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    dragCounter.current += 1;
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  async function handleSubmit(e) {
    e.preventDefault();
    const validFiles = fileQueue.filter((i) => !i.error).map((i) => i.file);
    if (validFiles.length === 0) {
      setGlobalError("No valid files to upload. Please check file errors above.");
      return;
    }

    setIsUploading(true);
    setGlobalError("");
    try {
      const response = await uploadMediaFiles(validFiles);
      const count = (response.items || []).length;
      setUploaded(count);
      onUploaded?.(response.items || []);
      // Clear valid files, keep errored ones for user review
      setFileQueue((prev) => prev.filter((i) => i.error));
    } catch (err) {
      setGlobalError(err.message || "Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }

  const validCount = fileQueue.filter((i) => !i.error).length;
  const errorCount = fileQueue.filter((i) => i.error).length;
  const totalSize = fileQueue
    .filter((i) => !i.error)
    .reduce((acc, i) => acc + Number(i.size || 0), 0);

  const summaryText = useMemo(() => {
    if (fileQueue.length === 0) return null;
    const parts = [];
    if (validCount > 0)
      parts.push(`${validCount} file${validCount !== 1 ? "s" : ""} ready (${formatBytes(totalSize)})`);
    if (errorCount > 0)
      parts.push(`${errorCount} with error${errorCount !== 1 ? "s" : ""}`);
    return parts.join(" · ");
  }, [fileQueue, validCount, errorCount, totalSize]);

  if (!isOpen) return null;

  return (
    <div
      className="umm-overlay"
      onClick={(e) => e.target === e.currentTarget && !isUploading && closeAndReset()}
    >
      <div
        className="umm-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Upload media files"
      >
        {/* Header */}
        <div className="umm-header">
          <div className="umm-header__info">
            <h3>Upload Media</h3>
            <p>Images, videos, audio &amp; documents. Max 5 MB per file.</p>
          </div>
          <button
            type="button"
            className="umm-close"
            onClick={closeAndReset}
            disabled={isUploading}
            aria-label="Close modal"
          >
            <X size={14} />
          </button>
        </div>

        <form className="umm-form" onSubmit={handleSubmit}>
          {/* Success banner */}
          {uploaded !== null && (
            <div className="umm-success" role="status">
              <Check size={15} />
              {uploaded} file{uploaded !== 1 ? "s" : ""} uploaded successfully!
            </div>
          )}

          {/* Drop zone */}
          <div
            className={`umm-dropzone ${isDragging ? "umm-dropzone--active" : ""}`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="umm-dropzone__icon">
              <Upload size={20} strokeWidth={1.5} />
            </div>
            <div className="umm-dropzone__text">
              <span className="umm-dropzone__primary">
                {isDragging ? "Release to add files" : "Drag files here or click to browse"}
              </span>
              <span className="umm-dropzone__secondary">
                JPG, PNG, WebP, GIF, SVG, MP4, MP3, PDF, ZIP and more
              </span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="umm-hidden-input"
              onChange={(e) => {
                addFiles(e.target.files);
                // Reset input so same file can be re-added if removed
                e.target.value = "";
              }}
              aria-label="Select media files"
            />
          </div>

          {/* File queue */}
          {fileQueue.length > 0 && (
            <div className="umm-queue">
              <div className="umm-queue__header">
                <span className="umm-queue__summary">{summaryText}</span>
                {fileQueue.length > 1 && (
                  <button
                    type="button"
                    className="umm-queue__clear"
                    onClick={resetAll}
                    disabled={isUploading}
                  >
                    Clear all
                  </button>
                )}
              </div>
              <div className="umm-queue__list">
                {fileQueue.map((item) => (
                  <FilePreviewItem
                    key={item.key}
                    item={item}
                    onRemove={removeFile}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Upload progress */}
          {isUploading && (
            <UploadProgress current={0} total={1} />
          )}

          {/* Global error */}
          {globalError && (
            <div className="umm-error" role="alert">
              <AlertCircle size={14} />
              {globalError}
            </div>
          )}

          {/* Security note */}
          <div className="umm-security">
            <ShieldCheck size={12} />
            Uploads happen directly from this admin panel and are stored in {storageTargetLabel}. Files still pass admin auth and type/size validation first.
          </div>

          {/* Actions */}
          <div className="umm-actions">
            <button
              type="button"
              className="umm-btn umm-btn--ghost"
              onClick={closeAndReset}
              disabled={isUploading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="umm-btn umm-btn--primary"
              disabled={isUploading || validCount === 0}
            >
              {isUploading ? (
                <>
                  <Loader2 size={13} className="umm-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload size={13} />
                  Upload {validCount > 0 ? `${validCount} File${validCount !== 1 ? "s" : ""}` : "Files"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
