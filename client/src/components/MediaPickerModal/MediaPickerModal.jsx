/**
 * MediaPickerModal — Reusable WordPress-style media picker.
 *
 * Props:
 *   onSelect(result)  — called with { url, path, alt } when the user clicks "Insert"
 *   onClose()         — called when the modal is dismissed
 *   single            — if true, immediately calls onSelect after picking (no Insert btn)
 *   showAlt           — show alt text field (default true)
 *   title             — modal header text (default "Select Image")
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { API_URL } from '../../config';
import './MediaPickerModal.css';

const IMAGE_EXTS = new Set(['jpg','jpeg','png','gif','webp','avif','ico','svg']);

const formatBytes = (b) => {
  if (!b) return '';
  const k = 1024;
  const units = ['B','KB','MB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${(b / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
};

export default function MediaPickerModal({
  onSelect,
  onClose,
  single = false,
  showAlt = true,
  title = 'Select Image',
}) {
  const [tab,         setTab]         = useState('library');  // 'library' | 'upload'
  const [items,       setItems]       = useState([]);
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(1);
  const [totalPages,  setTotalPages]  = useState(1);
  const [loading,     setLoading]     = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const [selected,    setSelected]    = useState(null);
  const [alt,         setAlt]         = useState('');
  const [uploadErr,   setUploadErr]   = useState('');
  const [dragOver,    setDragOver]    = useState(false);
  const fileRef = useRef(null);

  const PER_PAGE = 30;
  const token = () => localStorage.getItem('token');
  const authH = () => ({ Authorization: `Bearer ${token()}` });

  const fetchMedia = useCallback(async (pg = 1) => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/admin/media?page=${pg}&per_page=${PER_PAGE}&type_filter=image`,
        { headers: authH() }
      );
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.total_pages || 1);
      setPage(pg);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchMedia(1); }, [fetchMedia]);

  const doUpload = async (file) => {
    if (!file) return;
    setUploadErr('');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API_URL}/upload`, { method: 'POST', headers: authH(), body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Upload failed');
      // Switch to library tab and select the newly uploaded image
      setTab('library');
      await fetchMedia(1);
      setSelected(data);
      setAlt('');
    } catch (e) { setUploadErr(e.message); }
    finally { setUploading(false); }
  };

  const pick = (item) => {
    setSelected(item);
    setAlt('');
    if (single) onSelect({ url: item.url, path: item.path, alt: '' });
  };

  const handleInsert = () => {
    if (!selected) return;
    onSelect({ url: selected.url, path: selected.path, alt: alt.trim() });
  };

  // Close on backdrop click
  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="mpm-overlay" onClick={handleBackdrop}>
      <div className="mpm-modal">

        {/* ── Header ── */}
        <div className="mpm-header">
          <h3 className="mpm-title">{title}</h3>
          <button className="mpm-close" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* ── Tab bar ── */}
        <div className="mpm-tabs">
          <button className={`mpm-tab ${tab === 'library' ? 'active' : ''}`} onClick={() => setTab('library')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            Media Library {total > 0 && <span className="mpm-count">{total}</span>}
          </button>
          <button className={`mpm-tab ${tab === 'upload' ? 'active' : ''}`} onClick={() => setTab('upload')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Upload New
          </button>
        </div>

        {/* ── Body ── */}
        <div className="mpm-body">

          {/* LIBRARY TAB */}
          {tab === 'library' && (
            <div className="mpm-library">
              {loading ? (
                <div className="mpm-loading"><div className="mpm-spinner" /></div>
              ) : items.length === 0 ? (
                <div className="mpm-empty">
                  <p>No images uploaded yet.</p>
                  <button className="mpm-btn-link" onClick={() => setTab('upload')}>Upload your first image →</button>
                </div>
              ) : (
                <div className="mpm-grid">
                  {items.map(item => (
                    <button
                      key={item.path}
                      className={`mpm-item ${selected?.path === item.path ? 'selected' : ''}`}
                      onClick={() => pick(item)}
                      title={item.filename}
                    >
                      {IMAGE_EXTS.has(item.ext) ? (
                        <img src={item.url} alt={item.filename} loading="lazy" />
                      ) : (
                        <div className="mpm-file-badge">.{item.ext.toUpperCase()}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mpm-pagination">
                  <button className="mpm-pg-btn" disabled={page === 1} onClick={() => fetchMedia(page - 1)}>‹ Prev</button>
                  <span>{page} / {totalPages}</span>
                  <button className="mpm-pg-btn" disabled={page === totalPages} onClick={() => fetchMedia(page + 1)}>Next ›</button>
                </div>
              )}
            </div>
          )}

          {/* UPLOAD TAB */}
          {tab === 'upload' && (
            <div className="mpm-upload-wrap">
              <div
                className={`mpm-dropzone ${dragOver ? 'drag-over' : ''} ${uploading ? 'uploading' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); doUpload(e.dataTransfer.files[0]); }}
                onClick={() => !uploading && fileRef.current.click()}
              >
                <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }}
                  onChange={e => doUpload(e.target.files[0])} />

                {uploading ? (
                  <><div className="mpm-spinner" /><p>Uploading…</p></>
                ) : (
                  <>
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    <p><strong>Drop file here</strong> or click to browse</p>
                    <small>JPG, PNG, WebP, AVIF, GIF, SVG, PDF — max 20 MB<br/>SVGs are automatically sanitized</small>
                  </>
                )}
              </div>
              {uploadErr && <p className="mpm-upload-err">{uploadErr}</p>}
            </div>
          )}
        </div>

        {/* ── Footer: alt text + insert ── */}
        {selected && !single && (
          <div className="mpm-footer">
            <div className="mpm-selected-preview">
              <img src={selected.url} alt="" />
              <div className="mpm-selected-info">
                <span className="mpm-selected-name">{selected.filename}</span>
                {selected.size && <span className="mpm-selected-size">{formatBytes(selected.size)}</span>}
              </div>
            </div>

            {showAlt && (
              <div className="mpm-alt-row">
                <label htmlFor="mpm-alt">Alt Text</label>
                <input
                  id="mpm-alt"
                  type="text"
                  value={alt}
                  maxLength={200}
                  onChange={e => setAlt(e.target.value)}
                  placeholder="Describe the image for screen readers…"
                />
              </div>
            )}

            <div className="mpm-footer-actions">
              <button className="mpm-btn-cancel" onClick={onClose}>Cancel</button>
              <button className="mpm-btn-insert" onClick={handleInsert}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                Insert Image
              </button>
            </div>
          </div>
        )}

        {/* If nothing selected yet show a hint */}
        {!selected && tab === 'library' && (
          <div className="mpm-footer mpm-footer-hint">
            <span>Click an image to select it</span>
          </div>
        )}
      </div>
    </div>
  );
}
