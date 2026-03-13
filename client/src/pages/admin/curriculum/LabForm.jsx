import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../curriculum/api';
import MediaPickerModal from '../../../components/MediaPickerModal/MediaPickerModal';
import './LabForm.css';

const SLUG_RE   = /^[a-z0-9-]+$/;
const toSlug    = (s) => s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
const DESC_MAX  = 160;

const INITIAL = { title: '', slug: '', description: '', banner_image_path: '', language_id: 71, is_published: false };

export default function LabForm() {
  const navigate     = useNavigate();
  const { labId }    = useParams();
  const isEdit       = Boolean(labId);

  const [form,       setForm]       = useState(INITIAL);
  const [bannerUrl,  setBannerUrl]  = useState(null);
  const [slugManual, setSlugManual] = useState(false);
  const [errors,     setErrors]     = useState({});
  const [saving,     setSaving]     = useState(false);
  const [toast,      setToast]      = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [languages,  setLanguages]  = useState([]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    // Load languages for selector
    fetch('/api/languages').then(r => r.json()).then(setLanguages).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    api.getLab(labId).then(lab => {
      setForm({
        title:             lab.title,
        slug:              lab.slug,
        description:       lab.description || '',
        banner_image_path: lab.banner_image_path || '',
        language_id:       lab.language_id || 71,
        is_published:      lab.is_published,
      });
      setBannerUrl(lab.banner_url);
      setSlugManual(true);
    }).catch(e => showToast(e.message, 'error'));
  }, [labId, isEdit]);

  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: null }));
  };

  const handleTitle = (val) => {
    set('title', val);
    if (!slugManual) set('slug', toSlug(val));
  };

  const handleSlug = (val) => {
    set('slug', val.toLowerCase().replace(/[^a-z0-9-]/g, ''));
    setSlugManual(true);
  };

  const handleDesc = (val) => {
    if (val.length <= DESC_MAX) set('description', val);
  };

  // Called by MediaPickerModal when user clicks Insert
  const handleBannerPick = ({ url, path }) => {
    set('banner_image_path', path);
    setBannerUrl(url);
    setShowPicker(false);
  };

  const validate = () => {
    const errs = {};
    if (!form.title.trim()) errs.title = 'Title is required.';
    if (!form.slug.trim())  errs.slug  = 'Slug is required.';
    else if (!SLUG_RE.test(form.slug)) errs.slug = 'Only lowercase letters, numbers, hyphens.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    const payload = { ...form, banner_image_path: form.banner_image_path || null };
    try {
      if (isEdit) {
        await api.updateLab(labId, payload);
        showToast('Lab updated!');
        setTimeout(() => navigate('/admin/labs'), 1000);
      } else {
        const lab = await api.createLab(payload);
        showToast('Lab created! Redirecting to add modules…');
        setTimeout(() => navigate(`/admin/modules/create?lab_id=${lab.id}`), 1200);
      }
    } catch (e) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="lf-wrap">
      {toast && <div className={`lf-toast ${toast.type}`}>{toast.msg}</div>}
      {showPicker && (
        <MediaPickerModal
          title="Select Banner Image"
          showAlt={false}
          onSelect={handleBannerPick}
          onClose={() => setShowPicker(false)}
        />
      )}

      <div className="lf-header">
        <button className="lf-back" onClick={() => navigate('/admin/labs')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Back to Labs
        </button>
        <h2 className="lf-title">{isEdit ? 'Edit Lab' : 'Create New Lab'}</h2>
      </div>

      <form className="lf-form" onSubmit={handleSubmit}>
        <div className="lf-grid">
          {/* LEFT */}
          <div className="lf-main">
            <div className="lf-field">
              <label>Lab Title <span className="req">*</span></label>
              <input value={form.title} onChange={e => handleTitle(e.target.value)}
                placeholder="e.g. Introduction to Python" className={errors.title ? 'error' : ''} />
              {errors.title && <span className="lf-err">{errors.title}</span>}
            </div>

            <div className="lf-field">
              <label>URL Slug <span className="req">*</span></label>
              <div className="lf-slug-input">
                <span className="lf-slug-prefix">/labs/</span>
                <input value={form.slug} onChange={e => handleSlug(e.target.value)}
                  placeholder="intro-to-python" className={errors.slug ? 'error' : ''} />
              </div>
              {errors.slug && <span className="lf-err">{errors.slug}</span>}
            </div>

            <div className="lf-field">
              <div className="lf-label-row">
                <label>Description</label>
                <span className={`lf-char-count ${form.description.length >= DESC_MAX ? 'at-limit' : ''}`}>
                  {form.description.length}/{DESC_MAX}
                </span>
              </div>
              <textarea rows={3} value={form.description} onChange={e => handleDesc(e.target.value)}
                placeholder="A brief summary of what this lab covers…" maxLength={DESC_MAX} />
            </div>

            {/* Banner — WordPress-style picker */}
            <div className="lf-field">
              <label>Banner Image</label>
              {bannerUrl ? (
                <div className="lf-banner-set">
                  <img src={bannerUrl} alt="Banner" className="lf-banner-preview" />
                  <div className="lf-banner-set-actions">
                    <button type="button" className="lf-banner-change" onClick={() => setShowPicker(true)}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      Change image
                    </button>
                    <button type="button" className="lf-banner-remove"
                      onClick={() => { set('banner_image_path', ''); setBannerUrl(null); }}>
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className="lf-banner-placeholder-btn" onClick={() => setShowPicker(true)}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  <span>Set banner image</span>
                  <small>Opens media library</small>
                </button>
              )}
            </div>
          </div>

          {/* RIGHT: sidebar */}
          <div className="lf-sidebar">
            <div className="lf-card">
              <h4 className="lf-card-title">Publish Settings</h4>
              <label className="lf-toggle">
                <input type="checkbox" checked={form.is_published}
                  onChange={e => set('is_published', e.target.checked)} />
                <span className="lf-toggle-track" />
                <span className="lf-toggle-label">{form.is_published ? 'Published' : 'Draft'}</span>
              </label>
            </div>

            <div className="lf-card">
              <h4 className="lf-card-title">Language</h4>
              <select
                className="lf-select"
                value={form.language_id}
                onChange={e => set('language_id', Number(e.target.value))}
              >
                {languages.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
              <small className="lf-hint">Sets the default language for all levels in this lab</small>
            </div>

            <div className="lf-card lf-actions-card">
              <button type="submit" className="lf-btn-save" disabled={saving}>
                {saving ? <><div className="lf-btn-spinner" /> Saving…</> : isEdit ? '✓ Save Changes' : '→ Create & Add Modules'}
              </button>
              <button type="button" className="lf-btn-cancel" onClick={() => navigate('/admin/labs')}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
