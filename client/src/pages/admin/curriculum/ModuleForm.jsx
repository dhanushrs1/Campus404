import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { api } from '../curriculum/api';
import './ModuleForm.css';

const INITIAL = { lab_id: 0, title: '', description: '', order_index: 0 };
const DESC_MAX = 160;


export default function ModuleForm() {
  const navigate      = useNavigate();
  const [params]      = useSearchParams();
  const { moduleId }  = useParams();
  const isEdit        = Boolean(moduleId);

  const [form,    setForm]    = useState(INITIAL);
  const [lab,     setLab]     = useState(null);   // for context breadcrumb
  const [modules, setModules] = useState([]);      // existing modules for order hint
  const [errors,  setErrors]  = useState({});
  const [saving,  setSaving]  = useState(false);
  const [toast,   setToast]   = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    if (isEdit) {
      api.getModule(moduleId).then(m => {
        setForm({ lab_id: m.lab_id, title: m.title, description: m.description || '', order_index: m.order_index });
        return api.getLab(m.lab_id);
      }).then(setLab).catch(e => showToast(e.message, 'error'));
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      if (isEdit) {
        await api.updateModule(moduleId, { title: form.title, description: form.description, order_index: Number(form.order_index) });
        showToast('Module updated!');
        setTimeout(() => navigate(`/admin/labs`), 1200);
      } else {
        const mod = await api.createModule({
          lab_id:      form.lab_id,
          title:       form.title,
          description: form.description,
          order_index: Number(form.order_index),
        });
        showToast('Module created! Redirecting to add challenges…');
        setTimeout(() => navigate(`/admin/challenges/create?module_id=${mod.id}`), 1200);
      }
    } catch (e) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  };

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

          {errors.lab_id && <div className="mf-err-banner">{errors.lab_id}</div>}
        </div>

        {/* Existing modules list */}
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
          <button type="button" className="mf-btn-cancel" onClick={() => navigate('/admin/labs')}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
