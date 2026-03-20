import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { api } from '../curriculum/api';
import BadgePickerModal from '../../../components/BadgePickerModal/BadgePickerModal';
import MediaPickerModal from '../../../components/MediaPickerModal/MediaPickerModal';
import { API_URL } from '../../../config';
import './ModuleForm.css';

const INITIAL = { lab_id: 0, title: '', description: '', banner_image_path: '', order_index: 0, badge_id: '', guide_id: '' };
const DESC_MAX = 160;

const token = () => localStorage.getItem('token');
const authH = () => ({ Authorization: `Bearer ${token()}` });

export default function ModuleForm() {
  const navigate      = useNavigate();
  const [params]      = useSearchParams();
  const { moduleId }  = useParams();
  const isEdit        = Boolean(moduleId);

  const [form,    setForm]    = useState(INITIAL);
  const [lab,     setLab]     = useState(null);   // for context breadcrumb
  const [modules, setModules] = useState([]);      // existing modules for order hint
  const [challengeGroups, setChallengeGroups] = useState([]); // existing challenge groups if editing
  const [badges,  setBadges]  = useState([]);      // all available badges
  const [guides,  setGuides]  = useState([]);      // all available guides
  const [origBadge, setOrigBadge] = useState(null);// originally assigned badge id
  const [showBadgePicker, setShowBadgePicker] = useState(false);
  const [showGuidePicker, setShowGuidePicker] = useState(false);
  const [showBannerPicker, setShowBannerPicker] = useState(false);
  const [bannerUrl, setBannerUrl] = useState(null);
  const [errors,  setErrors]  = useState({});
  const [saving,  setSaving]  = useState(false);
  const [toast,   setToast]   = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    // Fetch all badges to allow assignment
    fetch(`${API_URL}/admin/badges`, { headers: authH() })
      .then(r => r.json())
      .then(bList => setBadges(bList || []))
      .catch(() => {});

    api.getGuidePages().then(gList => setGuides(gList || [])).catch(() => {});

    if (isEdit) {
      api.getModule(moduleId).then(m => {
        setForm(f => ({
          ...f,
          lab_id: m.lab_id,
          title: m.title,
          description: m.description || '',
          banner_image_path: m.banner_image_path || '',
          order_index: m.order_index,
          guide_id: m.guide_id || '',
        }));
        setBannerUrl(m.banner_url || (m.banner_image_path ? `/uploads/${String(m.banner_image_path).replace(/^\/+/, '')}` : null));
        return api.getLab(m.lab_id);
      }).then(setLab).catch(e => showToast(e.message, 'error'));

      api.getChallengeGroups(moduleId).then(list => {
        setChallengeGroups(list || []);
      }).catch(() => {});
    } else {
      const labId = Number(params.get('lab_id'));
      if (labId) {
        setForm(f => ({ ...f, lab_id: labId }));
        api.getLab(labId).then(setLab).catch(() => {});
        api.getModules(labId).then(list => {
          setModules(list);
          setForm(f => ({ ...f, order_index: list.length }));
        }).catch(() => {});
      }
    }
  }, [moduleId, isEdit, params]);

  // Once badges are loaded, figure out which badge belongs to this module (if editing)
  useEffect(() => {
    if (isEdit && badges.length > 0) {
      const b = badges.find(x => x.module_id === Number(moduleId));
      if (b) {
        setForm(f => ({ ...f, badge_id: b.id }));
        setOrigBadge(b.id);
      }
    }
  }, [isEdit, badges, moduleId]);

  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: null }));
  };

  const handleDesc = (val) => {
    if (val.length <= DESC_MAX) set('description', val);
  };

  const handleBannerPick = ({ url, path }) => {
    if (!path) return;
    set('banner_image_path', path);
    setBannerUrl(url || `/uploads/${String(path).replace(/^\/+/, '')}`);
    setShowBannerPicker(false);
  };


  const validate = () => {
    const errs = {};
    if (!form.title.trim()) errs.title = 'Title is required.';
    if (!form.lab_id)        errs.lab_id = 'No lab selected. Go back and create a lab first.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleBadgeAssignment = async (modId) => {
    const normalizedBadgeId = form.badge_id ? Number(form.badge_id) : null;

    // If badge_id changed, remove from old, add to new
    if (normalizedBadgeId !== origBadge) {
      if (origBadge) {
        // Unlink old badge
        const fd = new FormData();
        fd.append('module_id', '');
        await fetch(`${API_URL}/admin/badges/${origBadge}`, { method: 'PATCH', headers: authH(), body: fd }).catch(() => {});
      }
      if (normalizedBadgeId) {
        // Link new badge
        const fd = new FormData();
        fd.append('module_id', modId);
        await fetch(`${API_URL}/admin/badges/${normalizedBadgeId}`, { method: 'PATCH', headers: authH(), body: fd }).catch(() => {});
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      if (isEdit) {
        await api.updateModule(moduleId, {
          title: form.title,
          description: form.description,
          guide_id: form.guide_id ? Number(form.guide_id) : null,
          banner_image_path: form.banner_image_path || null,
          order_index: Number(form.order_index),
        });
        await handleBadgeAssignment(moduleId);
        showToast('Module updated!');
        setTimeout(() => navigate(`/admin/labs`), 1200);
      } else {
        const mod = await api.createModule({
          lab_id:      form.lab_id,
          title:       form.title,
          description: form.description,
          guide_id:    form.guide_id ? Number(form.guide_id) : null,
          banner_image_path: form.banner_image_path || null,
          order_index: Number(form.order_index),
        });
        await handleBadgeAssignment(mod.id);
        showToast('Module created! Redirecting to challenge setup…');
        setTimeout(() => navigate(`/admin/modules/${mod.id}/challenges`), 1200);
      }
    } catch (e) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const handleDeleteModule = async () => {
    if (!isEdit) return;
    if (!confirm(`Delete module "${form.title || moduleId}" and all its challenges/levels?`)) return;
    setSaving(true);
    try {
      await api.deleteModule(moduleId);
      showToast('Module deleted.');
      setTimeout(() => navigate('/admin/labs'), 600);
    } catch (e) {
      showToast(e.message || 'Delete failed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const selectedBadgeObj = badges.find(b => b.id === Number(form.badge_id));
  const selectedGuideObj = guides.find(g => g.id === Number(form.guide_id));
  const selectedModuleId = isEdit ? Number(moduleId) : null;
  const selectableGuides = guides.filter(g => !g.module_id || (selectedModuleId && g.module_id === selectedModuleId));

  return (
    <div className="mf-wrap">
      {toast && <div className={`mf-toast ${toast.type}`}>{toast.msg}</div>}
      {showBannerPicker && (
        <MediaPickerModal
          title="Select Module Banner"
          showAlt={false}
          onSelect={handleBannerPick}
          onClose={() => setShowBannerPicker(false)}
        />
      )}

      {/* Breadcrumb */}
      <div className="mf-breadcrumb">
        <button onClick={() => navigate('/admin/labs')}>Labs</button>
        {lab && <><span>›</span><button onClick={() => navigate(`/admin/labs/${lab.id}/edit`)} className="mf-bc-lab">{lab.title}</button></>}
        <span>›</span>
        <span>{isEdit ? 'Edit Module' : 'New Module'}</span>
      </div>

      <div className="mf-header">
        <h2 className="mf-title">
          {isEdit ? 'Edit Module' : 'Add Module'}
          {isEdit && (
            <span style={{ fontSize: '0.6em', marginLeft: '12px', fontWeight: 'normal', color: '#666' }}>
              ID: {moduleId} 
              <button 
                type="button" 
                onClick={() => {
                  navigator.clipboard.writeText(moduleId);
                  showToast('Module ID copied!');
                }}
                style={{ marginLeft: '8px', padding: '2px 8px', fontSize: '12px', cursor: 'pointer', border: '1px solid #ccc', borderRadius: '4px', background: '#f5f5f5' }}
              >
                Copy
              </button>
            </span>
          )}
        </h2>
        {lab && <p className="mf-subtitle">Lab: <strong>{lab.title}</strong></p>}
        {isEdit && (
          <button type="button" className="mf-icon-danger" title="Delete module" aria-label="Delete module" onClick={handleDeleteModule} disabled={saving}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        )}
      </div>

      {/* Progress steps */}
      {!isEdit && (
        <div className="mf-steps">
          <div className="mf-step done"><span>1</span> Create Lab</div>
          <div className="mf-step-line done" />
          <div className="mf-step current"><span>2</span> Add Module</div>
          <div className="mf-step-line" />
          <div className="mf-step"><span>3</span> Add Challenge</div>
          <div className="mf-step-line" />
          <div className="mf-step"><span>4</span> Add Levels</div>
        </div>
      )}

      <form className="mf-form" onSubmit={handleSubmit}>
        <div className="mf-card">
          <div className="mf-field">
            <label>Module Title <span className="req">*</span></label>
            <input value={form.title} onChange={e => set('title', e.target.value)}
              placeholder="e.g. Variables & Data Types" className={errors.title ? 'error' : ''} />
            {errors.title && <span className="mf-err">{errors.title}</span>}
          </div>

          <div className="mf-field">
            <div className="mf-label-row">
              <label>Description</label>
              <span className={`mf-char-count ${form.description.length >= DESC_MAX ? 'at-limit' : ''}`}>
                {form.description.length}/{DESC_MAX}
              </span>
            </div>
            <textarea rows={3} value={form.description} onChange={e => handleDesc(e.target.value)}
              placeholder="Optional: What will students learn in this module?" maxLength={DESC_MAX} />
          </div>

          <div className="mf-field">
            <label>Module Banner Image</label>
            {bannerUrl ? (
              <div className="mf-banner-set">
                <img src={bannerUrl} alt="Module banner" className="mf-banner-preview" />
                <div className="mf-banner-set-actions">
                  <button type="button" className="mf-banner-change" onClick={() => setShowBannerPicker(true)}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Change image
                  </button>
                  <button
                    type="button"
                    className="mf-banner-remove"
                    onClick={() => {
                      set('banner_image_path', '');
                      setBannerUrl(null);
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="mf-banner-placeholder-btn" onClick={() => setShowBannerPicker(true)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <span>Set module banner image</span>
                <small>Opens media library</small>
              </button>
            )}
          </div>

          <div className="mf-field">
            <label>Module Reward Badge (Optional)</label>
            <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: '8px' }}>Assign an existing badge to reward students upon completion.</p>
            
            <div className="mf-selected-badge-preview">
              {selectedBadgeObj ? (
                <div className="mf-sb-card">
                  <div className="mf-sb-icon">
                    {selectedBadgeObj.image_url ? <img src={selectedBadgeObj.image_url} alt={selectedBadgeObj.name} /> : <span>🏆</span>}
                  </div>
                  <div className="mf-sb-info">
                    <div className="mf-sb-name">{selectedBadgeObj.name}</div>
                    <div className="mf-sb-desc">{selectedBadgeObj.description || 'No description'}</div>
                  </div>
                  <button type="button" className="mf-sb-remove" onClick={() => set('badge_id', '')}>
                    ✕ Remove
                  </button>
                </div>
              ) : (
                <div className="mf-sb-empty">
                  No badge assigned
                </div>
              )}
              
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button type="button" onClick={() => setShowBadgePicker(true)} className="mf-btn-select-badge">
                  {selectedBadgeObj ? 'Change Badge' : 'Select Badge'}
                </button>
                <button type="button" onClick={() => setShowGuidePicker(v => !v)} className="mf-btn-assign-guide">
                  {selectedGuideObj ? 'Change Guide' : 'Assign Guide'}
                </button>
                <button type="button" onClick={() => navigate('/admin/badges')} className="mf-btn-manage-badges">
                  Manage Badges
                </button>
              </div>

              <div className="mf-guide-summary">
                {selectedGuideObj ? (
                  <>
                    <span className="mf-guide-pill">Guide Assigned</span>
                    <strong>{selectedGuideObj.title}</strong>
                    <small>/guide/{selectedGuideObj.slug}</small>
                  </>
                ) : (
                  <span className="mf-guide-empty">No guide assigned</span>
                )}
              </div>

              {showGuidePicker && (
                <div className="mf-guide-picker">
                  <label>Assign Guide Article</label>
                  <select
                    className="mf-select"
                    value={form.guide_id || ''}
                    onChange={(e) => set('guide_id', e.target.value)}
                  >
                    <option value="">No guide</option>
                    {selectableGuides.map((guide) => (
                      <option key={guide.id} value={guide.id}>
                        {guide.title}
                      </option>
                    ))}
                  </select>
                  <div className="mf-guide-picker-actions">
                    <button type="button" className="mf-guide-picker-done" onClick={() => setShowGuidePicker(false)}>
                      Done
                    </button>
                    <button
                      type="button"
                      className="mf-guide-picker-clear"
                      onClick={() => {
                        set('guide_id', '');
                        setShowGuidePicker(false);
                      }}
                    >
                      Clear Guide
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {errors.lab_id && <div className="mf-err-banner">{errors.lab_id}</div>}
        </div>

        {/* Existing challenge groups list if editing */}
        {isEdit && (
          <div className="mf-existing" style={{ marginTop: '1.5rem' }}>
            <h4 className="mf-existing-title">Challenges in this Module</h4>
            {challengeGroups.length > 0 ? challengeGroups.sort((a, b) => a.order_index - b.order_index).map((c, idx) => (
              <div key={c.id} className="mf-existing-item" style={{ justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span className="mf-existing-num" style={{ background: '#e0ebff', color: '#0047FF' }}>{idx + 1}</span>
                  <span className="mf-existing-name">{c.title}</span>
                  <span className="mf-existing-stats" style={{ display: 'inline-block', minWidth: '120px' }}>{c.level_count} levels</span>
                  <span className="mf-existing-stats" style={{ display: 'inline-block', minWidth: '80px' }}>{c.total_xp} XP</span>
                  <span className="mf-existing-stats" style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: '4px' }}>{c.is_published ? 'published' : 'draft'}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/challenge-groups/${c.id}/edit`)}
                    style={{ background: '#fff', border: '1px solid #ccc', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    Edit Challenge
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/challenges/${c.id}/levels`)}
                    style={{ background: '#f0f4ff', border: '1px solid #b9c8ff', color: '#003acc', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    Manage Levels
                  </button>
                </div>
              </div>
            )) : (
              <div className="mf-existing-item">
                <span className="mf-existing-name">No challenges yet. Add the first challenge group to start this module.</span>
              </div>
            )}
            <button 
              type="button" 
              onClick={() => navigate(`/admin/modules/${moduleId}/challenges`)}
              style={{ marginTop: '1rem', background: '#f0f4ff', color: '#0047FF', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}
            >
              + Manage Challenges
            </button>
          </div>
        )}

        {/* Existing modules list for reference only when creating */}
        {!isEdit && modules.length > 0 && (
          <div className="mf-existing">
            <h4 className="mf-existing-title">Existing Modules in this Lab</h4>
            {modules.map((m, i) => (
              <div key={m.id} className="mf-existing-item">
                <span className="mf-existing-num">{i + 1}</span>
                <span className="mf-existing-name">{m.title}</span>
                <span className="mf-existing-stats">{m.challenge_count} levels · {m.total_xp} XP</span>
              </div>
            ))}
          </div>
        )}

        <div className="mf-actions">
          <button type="submit" className="mf-btn-save" disabled={saving}>
            {saving ? <><div className="mf-spinner" /> Saving…</> : isEdit ? 'Save Changes' : '→ Create & Manage Challenges'}
          </button>
          <button type="button" className="mf-btn-cancel" onClick={() => navigate(-1)}>Cancel</button>
        </div>
      </form>

      {showBadgePicker && (
        <BadgePickerModal
          badges={badges}
          currentBadgeId={origBadge}
          onClose={() => setShowBadgePicker(false)}
          onSelect={(id) => {
            set('badge_id', id);
            setShowBadgePicker(false);
          }}
        />
      )}
    </div>
  );
}
