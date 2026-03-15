import React, { useState, useEffect, useCallback, useRef } from 'react';
import { API_URL } from '../../../config';
import './MediaLibrary.css';

const TYPE_TABS = [
  { value: '',      label: 'All' },
  { value: 'image', label: 'Images' },
  { value: 'svg',   label: 'SVG' },
  { value: 'pdf',   label: 'PDF' },
];

const ALLOWED_TYPES = '.jpg,.jpeg,.png,.gif,.webp,.avif,.svg,.pdf,.ico';

const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const units = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
};

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

const isImage = (ext) =>
  ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'ico'].includes(ext);

// Get role from token
const getUserRole = () => {
  try {
    const token = localStorage.getItem('token');
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.role ?? null;
  } catch { return null; }
};

const MediaLibrary = () => {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const PER_PAGE = 40;
  const isAdmin = getUserRole() === 'admin';

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchMedia = useCallback(async (pg, filter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: pg, per_page: PER_PAGE });
      if (filter) params.set('type_filter', filter);
      const res = await fetch(`${API_URL}/admin/media?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to load media');
      setItems(data.items);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMedia(page, typeFilter); }, [page, typeFilter, fetchMedia]);

  const uploadFiles = async (files) => {
    const arr = Array.from(files);
    if (!arr.length) return;
    setUploading(true);
    let succeeded = 0;

    for (let i = 0; i < arr.length; i++) {
      const file = arr[i];
      const fd = new FormData();
      fd.append('file', file);
      setUploadProgress(Math.round(((i) / arr.length) * 100));
      try {
        const res = await fetch(`${API_URL}/admin/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          body: fd,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Upload failed');
        succeeded++;
      } catch (e) {
        showToast(`${file.name}: ${e.message}`, 'error');
      }
    }

    setUploadProgress(100);
    setTimeout(() => { setUploading(false); setUploadProgress(0); }, 600);
    if (succeeded > 0) {
      showToast(`${succeeded} file${succeeded > 1 ? 's' : ''} uploaded successfully!`);
      fetchMedia(1, typeFilter);
      setPage(1);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    uploadFiles(e.dataTransfer.files);
  };

  const handleDelete = async (item) => {
    if (!isAdmin) return;
    if (!confirm(`Delete "${item.filename}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${API_URL}/admin/media?path=${encodeURIComponent(item.path)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Delete failed');
      showToast('File deleted.');
      if (selected?.path === item.path) setSelected(null);
      fetchMedia(page, typeFilter);
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const copyUrl = (url) => {
    navigator.clipboard.writeText(url);
    showToast('URL copied to clipboard!');
  };

  return (
    <div className="ml-wrap">
      {/* Toast */}
      {toast && <div className={`ml-toast ${toast.type}`}>{toast.msg}</div>}

      {/* Header */}
      <div className="ml-header">
        <div>
          <h2 className="ml-title">Media Library</h2>
          <p className="ml-subtitle">{total.toLocaleString()} file{total !== 1 ? 's' : ''} · WordPress-style organisation</p>
        </div>
      </div>

      {/* Upload Zone */}
      <div
        className={`ml-upload-zone ${dragOver ? 'drag-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_TYPES}
          multiple
          style={{ display: 'none' }}
          onChange={(e) => uploadFiles(e.target.files)}
        />
        <div className="ml-upload-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>
        <div className="ml-upload-text">
          <strong>Drop files here</strong> or click to browse
        </div>
        <div className="ml-upload-hint">
          JPG, PNG, GIF, WebP, AVIF, SVG, PDF — max 20 MB each<br/>
          SVGs are automatically sanitized for security
        </div>

        {uploading && (
          <div className="ml-progress-bar">
            <div className="ml-progress-fill" style={{ width: `${uploadProgress}%` }} />
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="ml-filter-row">
        <div className="ml-type-tabs">
          {TYPE_TABS.map(t => (
            <button
              key={t.value}
              className={`ml-tab ${typeFilter === t.value ? 'active' : ''}`}
              onClick={() => { setTypeFilter(t.value); setPage(1); }}
            >{t.label}</button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="ml-body">
        <div className={`ml-grid ${loading ? 'loading' : ''}`}>
          {items.length === 0 && !loading && (
            <div className="ml-empty">No files found.</div>
          )}
          {items.map(item => (
            <div
              key={item.path}
              className={`ml-item ${selected?.path === item.path ? 'selected' : ''}`}
              onClick={() => setSelected(prev => prev?.path === item.path ? null : item)}
            >
              <div className="ml-thumb">
                {isImage(item.ext) || item.ext === 'svg' ? (
                  <img src={item.url} alt={item.filename} loading="lazy" />
                ) : (
                  <div className="ml-file-icon">
                    <span>.{item.ext.toUpperCase()}</span>
                  </div>
                )}
              </div>
              <div className="ml-item-meta">
                <span className="ml-item-name">{item.filename.split('-').pop()}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Detail Panel */}
        {selected && (
          <div className="ml-detail">
            <button className="ml-detail-close" onClick={() => setSelected(null)}>✕</button>
            <div className="ml-detail-preview">
              {isImage(selected.ext) || selected.ext === 'svg' ? (
                <img src={selected.url} alt={selected.filename} />
              ) : (
                <div className="ml-file-icon large"><span>.{selected.ext.toUpperCase()}</span></div>
              )}
            </div>
            <div className="ml-detail-info">
              <h4 className="ml-detail-name">{selected.filename}</h4>
              <table className="ml-detail-table">
                <tbody>
                  <tr><td>Type</td><td>.{selected.ext.toUpperCase()}</td></tr>
                  <tr><td>Size</td><td>{formatBytes(selected.size)}</td></tr>
                  <tr><td>Uploaded</td><td>{formatDate(selected.uploaded_at)}</td></tr>
                  <tr><td>Path</td><td className="ml-path-cell">{selected.path}</td></tr>
                </tbody>
              </table>

              <div className="ml-detail-url-row">
                <input readOnly value={selected.url} className="ml-url-input" />
                <button className="ml-copy-btn" onClick={() => copyUrl(selected.url)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  Copy
                </button>
              </div>

              <div className="ml-detail-actions">
                <a href={selected.url} target="_blank" rel="noopener noreferrer" className="ml-btn-outline">
                  Open ↗
                </a>
                {isAdmin && (
                  <button className="ml-btn-danger" onClick={() => handleDelete(selected)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m5 0V4h4v2"/></svg>
                    Delete
                  </button>
                )}
              </div>
              {!isAdmin && (
                <p className="ml-editor-note">Only admins can delete files.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="ml-pagination">
          <span className="ml-page-info">Page {page} of {totalPages} · {total} files</span>
          <div className="ml-page-btns">
            <button className="ml-page-btn" onClick={() => setPage(1)} disabled={page===1}>«</button>
            <button className="ml-page-btn" onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}>‹</button>
            <span className="ml-page-current">{page}</span>
            <button className="ml-page-btn" onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages}>›</button>
            <button className="ml-page-btn" onClick={() => setPage(totalPages)} disabled={page===totalPages}>»</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MediaLibrary;
