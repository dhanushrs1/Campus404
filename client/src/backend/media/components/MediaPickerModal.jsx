import { useState, useEffect } from "react";
import { X, Search, Image as ImageIcon, CheckCircle, Upload } from "lucide-react";
import { getMediaStorageSettings, listMedia, getOptimizedCloudinaryUrl } from "../../../shared/mediaApi.js";
import UploadMediaModal from "./UploadMediaModal.jsx";
import "./MediaPickerModal.css";

export default function MediaPickerModal({ isOpen, onClose, onSelect }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("image"); // Default to images
  const [selectedItem, setSelectedItem] = useState(null);
  const [storageTargetLabel, setStorageTargetLabel] = useState("Cloudinary CDN");
  
  const [showUpload, setShowUpload] = useState(false);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const LIMIT = 30;

  useEffect(() => {
    if (isOpen && !showUpload) {
      setSkip(0);
      setHasMore(true);
      fetchMedia(0);
      void fetchStorageTarget();
    }
  }, [isOpen, category, query, showUpload]);

  async function fetchStorageTarget() {
    try {
      const settings = await getMediaStorageSettings();
      const active = (settings?.active_provider || "cloudinary").toLowerCase();
      setStorageTargetLabel(active === "cloudinary" ? "Cloudinary CDN" : "Cloudinary CDN");
    } catch {
      setStorageTargetLabel("Cloudinary CDN");
    }
  }

  async function fetchMedia(currentSkip = 0) {
    if (currentSkip === 0) setLoading(true);
    setError("");
    try {
      const res = await listMedia({ query, category, skip: currentSkip, limit: LIMIT });
      if (currentSkip === 0) {
        setItems(res?.items || []);
      } else {
        setItems(prev => [...prev, ...(res?.items || [])]);
      }
      setHasMore((res?.items?.length || 0) === LIMIT);
      setSkip(currentSkip);
    } catch (err) {
      setError(err.message || "Failed to load media.");
    } finally {
      if (currentSkip === 0) setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="mp-modal-overlay">
      <div className="mp-modal">
        <div className="mp-modal__header">
          <h2>Select Media</h2>
          <button className="mp-modal__close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="mp-modal__controls">
          <div className="mp-search">
            <Search size={16} className="mp-search__icon" />
            <input
              type="text"
              placeholder="Search images..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button className="mp-btn mp-btn--primary" onClick={() => setShowUpload(true)}>
            <Upload size={16} /> Upload New
          </button>
        </div>

        <div className="mp-modal__controls" style={{ paddingTop: 0 }}>
          <div className="mp-storage-note">
            Admin uploads are stored in: <strong>{storageTargetLabel}</strong>
          </div>
        </div>

        <div className="mp-modal__body">
          {error && <div className="mp-error">{error}</div>}
          {loading ? (
            <div className="mp-loading">Loading...</div>
          ) : items.length === 0 ? (
            <div className="mp-empty">
              <ImageIcon size={40} />
              <p>No media found.</p>
            </div>
          ) : (
            <div className="mp-grid">
              {items.map((item) => {
                const isSelected = selectedItem?.url === item.url;
                return (
                  <div
                    key={item.url}
                    className={`mp-card ${isSelected ? "mp-card--selected" : ""}`}
                    onClick={() => setSelectedItem(item)}
                  >
                    <div className="mp-card__img-wrapper">
                      {item.category === "image" ? (
                        <img src={getOptimizedCloudinaryUrl(item.url, item.category, 400)} alt={item.original_filename} loading="lazy" />
                      ) : (
                        <div className="mp-card__fallback">
                          <ImageIcon size={32} />
                        </div>
                      )}
                      {isSelected && (
                        <div className="mp-card__check">
                          <CheckCircle size={24} fill="var(--accent-primary)" color="#fff" />
                        </div>
                      )}
                    </div>
                    <div className="mp-card__title" title={item.original_filename}>
                      {item.original_filename}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {hasMore && !loading && items.length > 0 && (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <button 
                className="mp-btn mp-btn--ghost" 
                onClick={() => fetchMedia(skip + LIMIT)}
              >
                Load More
              </button>
            </div>
          )}
        </div>

        <div className="mp-modal__footer">
          <button className="mp-btn mp-btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="mp-btn mp-btn--primary"
            disabled={!selectedItem}
            onClick={() => onSelect(selectedItem)}
          >
            Select Image
          </button>
        </div>
      </div>

      {showUpload && (
        <UploadMediaModal
          isOpen={showUpload}
          onClose={() => setShowUpload(false)}
          onUploaded={() => {
            setShowUpload(false);
            fetchMedia();
          }}
          storageTargetLabel={storageTargetLabel}
        />
      )}
    </div>
  );
}