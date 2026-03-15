import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { api } from '../curriculum/api';
import BadgePickerModal from '../../../components/BadgePickerModal/BadgePickerModal';
import { API_URL } from '../../../config';
import './ModuleForm.css';

const INITIAL = { lab_id: 0, title: '', description: '', order_index: 0, badge_id: '' };
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
  const [challenges, setChallenges] = useState([]); // existing challenges if editing
  const [badges,  setBadges]  = useState([]);      // all available badges
  const [origBadge, setOrigBadge] = useState(null);// originally assigned badge id
  const [showBadgePicker, setShowBadgePicker] = useState(false);
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

    if (isEdit) {
      api.getModule(moduleId).then(m => {
        setForm(f => ({ ...f, lab_id: m.lab_id, title: m.title, description: m.description || '', order_index: m.order_index }));
        return api.getLab(m.lab_id);
      }).then(setLab).catch(e => showToast(e.message, 'error'));

      api.getChallenges(moduleId).then(list => {
        setChallenges(list || []);
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


  const validate = () => {
    const errs = {};
    if (!form.title.trim()) errs.title = 'Title is required.';
    if (!form.lab_id)        errs.lab_id = 'No lab selected. Go back and create a lab first.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleBadgeAssignment = async (modId) => {
    // If badge_id changed, remove from old, add to new
    if (form.badge_id !== origBadge) {
      if (origBadge) {
        // Unlink old badge
        const fd = new FormData();
        fd.append('module_id', '');
        await fetch(`${API_URL}/admin/badges/${origBadge}`, { method: 'PATCH', headers: authH(), body: fd }).catch(() => {});
      }
      if (form.badge_id) {
        // Link new badge
        const fd = new FormData();
        fd.append('module_id', modId);
        await fetch(`${API_URL}/admin/badges/${form.badge_id}`, { method: 'PATCH', headers: authH(), body: fd }).catch(() => {});
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      if (isEdit) {
        await api.updateModule(moduleId, { title: form.title, description: form.description, order_index: Number(form.order_index) });
        await handleBadgeAssignment(moduleId);
        showToast('Module updated!');
        setTimeout(() => navigate(`/admin/labs`), 1200);
      } else {
        const mod = await api.createModule({
          lab_id:      form.lab_id,
          title:       form.title,
          description: form.description,
          order_index: Number(form.order_index),
        });
        await handleBadgeAssignment(mod.id);
        showToast('Module created! Redirecting to add challenges…');
        setTimeout(() => navigate(`/admin/challenges/create?module_id=${mod.id}`), 1200);
      }
    } catch (e) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const selectedBadgeObj = badges.find(b => b.id === form.badge_id);

  return (
    <div className="mf-wrap">
      {toast && <div className={`mf-toast ${toast.type}`}>{toast.msg}</div>}

      {/* Breadcrumb */}
      <div className="mf-breadcrumb">
        <button onClick={() => navigate('/admin/labs')}>Labs</button>
        {lab && <><span>›</span><span className="mf-bc-lab">{lab.title}</span></>}
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
      </div>

      {/* Progress steps */}
      {!isEdit && (
        <div className="mf-steps">
          <div className="mf-step done"><span>1</span> Create Lab</div>
          <div className="mf-step-line done" />
          <div className="mf-step current"><span>2</span> Add Module</div>
          <div className="mf-step-line" />
          <div className="mf-step"><span>3</span> Add Challenges</div>
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
                <button type="button" onClick={() => navigate('/admin/badges')} className="mf-btn-manage-badges">
                  Manage Badges
                </button>
              </div>
            </div>
          </div>

          {errors.lab_id && <div className="mf-err-banner">{errors.lab_id}</div>}
        </div>

        {/* Existing challenges list if editing */}
        {isEdit && challenges.length > 0 && (
          <div className="mf-existing" style={{ marginTop: '1.5rem' }}>
            <h4 className="mf-existing-title">Challenges / Levels in this Module</h4>
            {challenges.sort((a, b) => a.level_number - b.level_number).map((c) => (
              <div key={c.id} className="mf-existing-item" style={{ justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span className="mf-existing-num" style={{ background: '#e0ebff', color: '#0047FF' }}>{c.level_number}</span>
                  <span className="mf-existing-name">{c.title}</span>
                  <span className="mf-existing-stats" style={{ display: 'inline-block', minWidth: '60px' }}>{c.xp_reward} XP</span>
                  <span className="mf-existing-stats" style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: '4px' }}>{c.challenge_type}</span>
                </div>
                <button 
                  type="button" 
                  onClick={() => navigate(`/admin/challenges/${c.id}/edit`)}
                  style={{ background: '#fff', border: '1px solid #ccc', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Edit Challenge
                </button>
              </div>
            ))}
            <button 
              type="button" 
              onClick={() => navigate(`/admin/challenges/create?module_id=${moduleId}`)}
              style={{ marginTop: '1rem', background: '#f0f4ff', color: '#0047FF', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}
            >
              + Add New Challenge
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
                <span className="mf-existing-stats">{m.challenge_count} challenges · {m.total_xp} XP</span>
              </div>
            ))}
          </div>
        )}

        <div className="mf-actions">
          <button type="submit" className="mf-btn-save" disabled={saving}>
            {saving ? <><div className="mf-spinner" /> Saving…</> : isEdit ? 'Save Changes' : '→ Create & Add Challenges'}
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
