import React, { useState, useEffect, useRef } from 'react';
import { API_URL } from '../../../config';
import './BadgesManager.css';

const token = () => localStorage.getItem('token');
const authH = () => ({ Authorization: `Bearer ${token()}` });

const FALLBACK_BADGE = '🏆';

export default function BadgesManager() {
  const [badges,   setBadges]   = useState([]);
  const [modules,  setModules]  = useState([]); // flat list from all labs
  const [loading,  setLoading]  = useState(true);
  const [toast,    setToast]    = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editing,  setEditing]  = useState(null); // badge object or null

  const [form, setForm] = useState({ name: '', description: '', module_id: '', image_url: '' });
  const [imageFile, setImageFile] = useState(null);
  const fileRef = useRef(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchBadges = () => {
    fetch(`${API_URL}/admin/badges`, { headers: authH() })
      .then(r => r.json()).then(d => setBadges(Array.isArray(d) ? d : [])).catch(() => {});
  };

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/admin/badges`, { headers: authH() }).then(r => r.json()),
      fetch(`${API_URL}/labs`, { headers: authH() }).then(r => r.json()).then(d => d.items || []).then(async labs => {
        const all = await Promise.all(labs.map(l =>
          fetch(`${API_URL}/modules?lab_id=${l.id}`, { headers: authH() }).then(r => r.json())
        ));
        return all.flat().map(m => ({ ...m, lab_id: m.lab_id }));
      }),
    ]).then(([b, m]) => { setBadges(Array.isArray(b) ? b : []); setModules(Array.isArray(m) ? m : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const openCreate = () => { setEditing(null); setForm({ name: '', description: '', module_id: '', image_url: '' }); setImageFile(null); setShowForm(true); };
  const openEdit   = (b) => { setEditing(b); setForm({ name: b.name, description: b.description || '', module_id: b.module_id || '', image_url: b.image_url || '' }); setImageFile(null); setShowForm(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return showToast('Name is required.', 'error');

    const fd = new FormData();
    fd.append('name', form.name);
    if (form.description) fd.append('description', form.description);
    if (form.module_id)   fd.append('module_id', form.module_id);
    if (form.image_url && !imageFile) fd.append('image_url', form.image_url);
    if (imageFile) fd.append('image', imageFile);

    const url    = editing ? `${API_URL}/admin/badges/${editing.id}` : `${API_URL}/admin/badges`;
    const method = editing ? 'PATCH' : 'POST';
    const res = await fetch(url, { method, headers: authH(), body: fd });
    if (!res.ok) { showToast((await res.json()).detail || 'Error', 'error'); return; }

    showToast(editing ? 'Badge updated!' : 'Badge created!');
    setShowForm(false);
    fetchBadges();
  };

  const handleDelete = async (badge) => {
    if (!confirm(`Delete badge "${badge.name}"?`)) return;
    await fetch(`${API_URL}/admin/badges/${badge.id}`, { method: 'DELETE', headers: authH() });
    showToast('Badge deleted.');
    fetchBadges();
  };

  const unlinkedModules = modules.filter(m => !badges.some(b => b.module_id === m.id) || (editing && editing.module_id === m.id));

  return (
    <div className="bm-wrap">
      {toast && <div className={`bm-toast ${toast.type}`}>{toast.msg}</div>}

      <div className="bm-header">
        <div>
          <h2 className="bm-title">Badge Manager</h2>
          <p className="bm-subtitle">{badges.length} badge{badges.length !== 1 ? 's' : ''} configured</p>
        </div>
        <button className="bm-btn-primary" onClick={openCreate}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Badge
        </button>
      </div>

      {loading ? (
        <div className="bm-spinner-wrap"><div className="bm-spinner" /></div>
      ) : (
        <div className="bm-grid">
          {badges.length === 0 && (
            <div className="bm-empty">No badges yet. Create one to link to a module!</div>
          )}
          {badges.map(badge => (
            <div key={badge.id} className="bm-card">
              <div className="bm-card-icon">
                {badge.image_url ? <img src={badge.image_url} alt={badge.name} /> : <span>{FALLBACK_BADGE}</span>}
              </div>
              <div className="bm-card-body">
                <h3 className="bm-card-name">{badge.name}</h3>
                {badge.description && <p className="bm-card-desc">{badge.description}</p>}
                <div className="bm-card-meta">
                  {badge.module_title ? (
                    <span className="bm-module-tag">📦 {badge.module_title}</span>
                  ) : (
                    <span className="bm-unlinked-tag">⚠ Not linked to module</span>
                  )}
                  <span className="bm-earned">✦ {badge.earned_count} earned</span>
                </div>
              </div>
              <div className="bm-card-actions">
                <button className="bm-action-btn" onClick={() => openEdit(badge)}>Edit</button>
                <button className="bm-action-btn danger" onClick={() => handleDelete(badge)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m5 0V4h4v2"/></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Create/Edit Modal ── */}
      {showForm && (
        <div className="bm-overlay" onClick={() => setShowForm(false)}>
          <div className="bm-modal" onClick={e => e.stopPropagation()}>
            <div className="bm-modal-header">
              <h3>{editing ? 'Edit Badge' : 'Create Badge'}</h3>
              <button className="bm-modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>

            <form onSubmit={handleSubmit} className="bm-form">
              {/* Badge preview */}
              <div className="bm-preview">
                {imageFile ? (
                  <img src={URL.createObjectURL(imageFile)} alt="preview" className="bm-preview-img" />
                ) : form.image_url ? (
                  <img src={form.image_url} alt="preview" className="bm-preview-img" />
                ) : (
                  <span className="bm-preview-fallback">{FALLBACK_BADGE}</span>
                )}
                <div className="bm-preview-actions">
                  <button type="button" className="bm-img-btn" onClick={() => fileRef.current.click()}>
                    ↑ Upload Image
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => { setImageFile(e.target.files[0]); setForm(f => ({ ...f, image_url: '' })); }} />
                  <span className="bm-or">or</span>
                  <input
                    type="url"
                    className="bm-input"
                    placeholder="External image URL (https://...)"
                    value={form.image_url}
                    onChange={e => { setForm(f => ({ ...f, image_url: e.target.value })); setImageFile(null); }}
                  />
                </div>
              </div>

              <div className="bm-field">
                <label className="bm-label">Badge Name *</label>
                <input className="bm-input" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Python Novice" required />
              </div>

              <div className="bm-field">
                <label className="bm-label">Description</label>
                <input className="bm-input" value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Short description of this badge" />
              </div>

              <div className="bm-field">
                <label className="bm-label">Link to Module</label>
                <select className="bm-select" value={form.module_id}
                  onChange={e => setForm(f => ({ ...f, module_id: e.target.value }))}>
                  <option value="">— No module (standalone badge) —</option>
                  {unlinkedModules.map(m => (
                    <option key={m.id} value={m.id}>{m.title} (ID: {m.unique_id})</option>
                  ))}
                </select>
                <small className="bm-hint">Users earn this badge when they complete all challenges in the selected module.</small>
              </div>

              <div className="bm-form-actions">
                <button type="submit" className="bm-btn-save">
                  {editing ? '✓ Save Changes' : '+ Create Badge'}
                </button>
                <button type="button" className="bm-btn-cancel" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
