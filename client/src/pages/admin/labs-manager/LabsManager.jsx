import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../curriculum/api';
import './LabsManager.css';

const LANG_MAP = {
  71: { name: 'Python 3',          color: '#3b82f6', bg: '#eff6ff' },
  63: { name: 'JavaScript',        color: '#f59e0b', bg: '#fffbeb' },
  62: { name: 'Java',              color: '#ef4444', bg: '#fff5f5' },
  54: { name: 'C++',               color: '#8b5cf6', bg: '#f5f3ff' },
  50: { name: 'C',                 color: '#6b7280', bg: '#f9fafb' },
  60: { name: 'Go',                color: '#06b6d4', bg: '#ecfeff' },
  72: { name: 'Ruby',              color: '#e11d48', bg: '#fff1f2' },
  73: { name: 'Rust',              color: '#b45309', bg: '#fefce8' },
  78: { name: 'Kotlin',            color: '#7c3aed', bg: '#f5f3ff' },
  74: { name: 'TypeScript',        color: '#3b82f6', bg: '#eff6ff' },
  82: { name: 'SQL',               color: '#059669', bg: '#f0fdf4' },
  79: { name: 'Bash',              color: '#374151', bg: '#f3f4f6' },
  0:  { name: 'HTML/CSS/JS',       color: '#f97316', bg: '#fff7ed' },
};

const getLang = (id) => LANG_MAP[id] || { name: `Lang ${id}`, color: '#888', bg: '#f9f9f9' };

const copyToClipboard = async (text, setCopied) => {
  try {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  } catch { /* ignore */ }
};

export default function LabsManager() {
  const navigate    = useNavigate();
  const [labs,    setLabs]    = useState([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(false);
  const [toast,   setToast]   = useState(null);
  const [langFilter, setLangFilter] = useState(null); // null = all
  const [copiedId, setCopiedId] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchLabs = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (langFilter) params.language_id = langFilter;
      const data = await api.getLabs(params);
      setLabs(data.items);
      setTotal(data.total);
    } catch (e) { showToast(e.message, 'error'); }
    finally { setLoading(false); }
  }, [langFilter]);

  useEffect(() => { fetchLabs(); }, [fetchLabs]);

  const handleDelete = async (lab) => {
    if (!confirm(`Delete lab "${lab.title}"? This will also delete all its Modules and Challenges.`)) return;
    try {
      await api.deleteLab(lab.id);
      showToast('Lab deleted.');
      fetchLabs();
    } catch (e) { showToast(e.message, 'error'); }
  };

  // Unique languages in the current full list for filter tabs
  const usedLangIds = [...new Set(labs.map(l => l.language_id))];

  return (
    <div className="lm-wrap">
      {toast && <div className={`lm-toast ${toast.type}`}>{toast.msg}</div>}

      <div className="lm-header">
        <div>
          <h2 className="lm-title">Labs Manager</h2>
          <p className="lm-subtitle">{total} lab{total !== 1 ? 's' : ''} total</p>
        </div>
        <button className="lm-btn-primary" onClick={() => navigate('/admin/labs/create')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Lab
        </button>
      </div>

      {/* Language filter tabs */}
      <div className="lm-tabs">
        <button className={`lm-tab ${!langFilter ? 'active' : ''}`} onClick={() => setLangFilter(null)}>
          All
        </button>
        {usedLangIds.map(id => {
          const lang = getLang(id);
          return (
            <button key={id}
              className={`lm-tab ${langFilter === id ? 'active' : ''}`}
              style={langFilter === id ? { background: lang.color, borderColor: lang.color, color: '#fff' } : {}}
              onClick={() => setLangFilter(langFilter === id ? null : id)}
            >
              {lang.name}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="lm-spinner-wrap"><div className="lm-spinner" /></div>
      ) : labs.length === 0 ? (
        <div className="lm-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v11"/></svg>
          <p>No labs yet. <button onClick={() => navigate('/admin/labs/create')}>Create your first lab →</button></p>
        </div>
      ) : (
        <div className="lm-grid">
          {labs.map(lab => {
            const lang = getLang(lab.language_id);
            const isCopied = copiedId === lab.id;
            const frontendUrl = `${window.location.origin}/labs/${lab.slug}`;
            return (
              <div key={lab.id} className="lm-card">
                <div className="lm-card-banner">
                  {lab.banner_url ? (
                    <img src={lab.banner_url} alt={lab.title} />
                  ) : (
                    <div className="lm-card-banner-placeholder">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    </div>
                  )}
                  <span className="lm-published-badge" style={{ background: lab.is_published ? '#059669' : '#9ca3af' }}>
                    {lab.is_published ? 'Live' : 'Draft'}
                  </span>
                </div>

                <div className="lm-card-body">
                  <div className="lm-card-top">
                    <span className="lm-lang-badge" style={{ background: lang.bg, color: lang.color }}>
                      {lang.name}
                    </span>
                  </div>

                  <h3 className="lm-card-title">{lab.title}</h3>
                  {lab.description && <p className="lm-card-desc">{lab.description}</p>}

                  {/* Copy URL row */}
                  <div className="lm-url-row">
                    <span className="lm-url-text">/labs/{lab.slug}</span>
                    <button
                      className={`lm-copy-btn ${isCopied ? 'copied' : ''}`}
                      onClick={() => { copyToClipboard(frontendUrl, (v) => { if (v) setCopiedId(lab.id); else setCopiedId(null); }); }}
                      title="Copy frontend URL"
                    >
                      {isCopied ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      )}
                      {isCopied ? 'Copied!' : 'Copy URL'}
                    </button>
                  </div>

                  <div className="lm-card-stats">
                    <span><strong>{lab.module_count}</strong> modules</span>
                    <span><strong>{lab.total_xp}</strong> XP</span>
                  </div>

                  <div className="lm-card-actions">
                    <button className="lm-action-btn" onClick={() => navigate(`/admin/labs/${lab.id}/edit`)}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
                      Edit
                    </button>
                    <button className="lm-action-btn primary" onClick={() => navigate(`/admin/modules/create?lab_id=${lab.id}`)}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Add Module
                    </button>
                    <button className="lm-action-btn danger" onClick={() => handleDelete(lab)}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m5 0V4h4v2"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
