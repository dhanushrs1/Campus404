import React, { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_SITE_SETTINGS,
  emitSiteSettingsUpdated,
  fetchAdminSiteSettings,
  resolveAssetUrl,
  saveAdminSiteSettings,
} from '../../../utils/siteSettings';
import MediaPickerModal from '../../../components/MediaPickerModal/MediaPickerModal';
import './Settings.css';

/* ─── Constants ─── */
const PICKER_TARGET_TO_FIELD = {
  logo: 'site_logo_url',
  icon: 'site_icon_url',
};

const PICKER_TITLES = {
  logo: 'Select Site Logo',
  icon: 'Select Site Icon',
};

const PICKER_SUCCESS_LABEL = {
  logo: 'Site logo',
  icon: 'Site icon',
};

const SETTINGS_SECTIONS = [
  {
    id: 'branding',
    label: 'Branding',
    description: 'Site identity, logo, icon, and SEO basics.',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  },
  {
    id: 'guide',
    label: 'Guide',
    description: 'Guide layout, TOC, and sharing behavior.',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
      </svg>
    ),
  },
];

/* ─── Helpers ─── */
const formatDate = (iso) => {
  if (!iso) return 'Not saved yet';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return 'Not saved yet';
  return parsed.toLocaleString('en-US', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const getErrorMessage = (error) => {
  if (!error) return 'Request failed';
  if (typeof error === 'string') return error;
  return error.message || 'Request failed';
};

const toStoredAssetUrl = (url, path) => {
  if (path) return `/uploads/${String(path).replace(/^\/+/, '')}`;
  if (!url) return '';
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin === window.location.origin ? parsed.pathname : parsed.toString();
  } catch {
    return url;
  }
};

/* ─── SVG Icons ─── */
const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);

const IconCopy = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);

const IconEye = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

/* ─── Toggle Component ─── */
const Toggle = ({ id, checked, onChange }) => (
  <label className="settings-toggle-switch">
    <input id={id} type="checkbox" checked={checked} onChange={onChange} />
    <span className="settings-toggle-slider" />
  </label>
);

/* ─── Asset Block Component ─── */
const AssetBlock = ({ title, hint, hasAsset, thumbContent, urlText, onChoose, onRemove, onCopy, thumbClass = '' }) => (
  <div className="settings-asset-block">
    <div className="settings-asset-block-header">
      <div>
        <p className="settings-asset-block-title">{title}</p>
        <p className="settings-asset-block-hint">{hint}</p>
      </div>
      <div className="settings-asset-actions">
        <button type="button" className="btn-upload" onClick={onChoose}>
          Choose from Media
        </button>
        {hasAsset && (
          <button type="button" className="btn-icon-danger" onClick={onRemove} title="Remove" aria-label={`Remove ${title}`}>
            <IconTrash />
          </button>
        )}
      </div>
    </div>
    <div className="settings-asset-body">
      {hasAsset ? (
        <div className="settings-asset-preview">
          <div className={`settings-asset-thumb ${thumbClass}`}>
            {thumbContent}
          </div>
          <div className="settings-asset-meta">
            <p className="settings-asset-meta-label">File path</p>
            <p className="settings-asset-url">{urlText}</p>
          </div>
          <button type="button" className="btn-icon-ghost" onClick={onCopy} title="Copy URL" aria-label="Copy URL">
            <IconCopy />
          </button>
        </div>
      ) : (
        <p className="settings-asset-empty">No file selected yet — click "Choose from Media" to pick one.</p>
      )}
    </div>
  </div>
);

/* ─── Main Component ─── */
const Settings = () => {
  const [initialData, setInitialData] = useState(DEFAULT_SITE_SETTINGS);
  const [formData, setFormData]       = useState(DEFAULT_SITE_SETTINGS);
  const [activeSection, setActiveSection] = useState('branding');
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [toast, setToast]       = useState(null);
  const [activePicker, setActivePicker] = useState(null);

  const token = localStorage.getItem('token') || '';

  /* Load */
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        if (!token) throw new Error('Admin authentication is required.');
        const settings = await fetchAdminSiteSettings(token);
        if (!mounted) return;
        setInitialData(settings);
        setFormData(settings);
      } catch (err) {
        if (!mounted) return;
        setError(getErrorMessage(err));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [token]);

  /* Toast timer */
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  /* Has changes */
  const hasChanges = useMemo(() => {
    const keys = [
      'site_name', 'meta_description', 'site_logo_url', 'site_logo_width',
      'site_logo_height', 'site_icon_url', 'guide_default_author',
      'guide_show_toc', 'guide_toc_depth', 'guide_show_social_share',
    ];
    return keys.some((k) => (initialData[k] ?? null) !== (formData[k] ?? null));
  }, [formData, initialData]);

  const onField = (field, value) => setFormData((p) => ({ ...p, [field]: value }));
  const onNumberField = (field, value, fallback) => {
    const parsed = Number(value);
    onField(field, Number.isFinite(parsed) ? parsed : fallback);
  };

  const openPicker  = (target) => { setActivePicker(target); setError(''); };
  const closePicker = () => setActivePicker(null);

  const handleMediaPick = ({ url, path }) => {
    if (!activePicker) return;
    const field = PICKER_TARGET_TO_FIELD[activePicker];
    const chosenUrl = toStoredAssetUrl(url, path);
    if (!field || !chosenUrl) { closePicker(); return; }
    setFormData((p) => ({ ...p, [field]: chosenUrl }));
    setToast({ type: 'success', message: `${PICKER_SUCCESS_LABEL[activePicker]} selected.` });
    closePicker();
  };

  const clearAsset = (target) => {
    const field = PICKER_TARGET_TO_FIELD[target];
    if (field) setFormData((p) => ({ ...p, [field]: null }));
  };

  const handleSave = async () => {
    if (!token) { setError('Admin authentication is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        site_name: (formData.site_name || '').trim(),
        meta_description: (formData.meta_description || '').trim() || null,
        site_logo_url: (formData.site_logo_url || '').trim() || null,
        site_logo_width: Number(formData.site_logo_width) || DEFAULT_SITE_SETTINGS.site_logo_width,
        site_logo_height: Number(formData.site_logo_height) || DEFAULT_SITE_SETTINGS.site_logo_height,
        site_icon_url: (formData.site_icon_url || '').trim() || null,
        guide_default_author: (formData.guide_default_author || '').trim() || DEFAULT_SITE_SETTINGS.guide_default_author,
        guide_show_toc: Boolean(formData.guide_show_toc),
        guide_toc_depth: Number(formData.guide_toc_depth) || DEFAULT_SITE_SETTINGS.guide_toc_depth,
        guide_show_social_share: Boolean(formData.guide_show_social_share),
      };
      const saved = await saveAdminSiteSettings(payload, token);
      setInitialData(saved);
      setFormData(saved);
      emitSiteSettingsUpdated(saved);
      setToast({ type: 'success', message: 'Settings saved and applied.' });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => { setFormData(initialData); setError(''); };

  const logoPreview = resolveAssetUrl(formData.site_logo_url);
  const iconPreview = resolveAssetUrl(formData.site_icon_url);

  /* ─── Loading ─── */
  if (loading) {
    return (
      <div className="settings-page">
        <div className="settings-shell">
          <div className="settings-loading">
            <div className="settings-loading-dot" />
            Loading settings…
          </div>
        </div>
      </div>
    );
  }

  /* ─── Branding Section ─── */
  const BrandingSection = () => (
    <div className="settings-group">
      {/* Site Info */}
      <div>
        <p className="settings-section-title">Site Information</p>
        <p className="settings-section-desc">Basic identity details used across the platform and in search results.</p>
      </div>

      <label className="settings-field">
        <span className="settings-field-label">Site Name</span>
        <input
          type="text"
          value={formData.site_name || ''}
          onChange={(e) => onField('site_name', e.target.value)}
          placeholder="Campus404"
        />
      </label>

      <label className="settings-field">
        <span className="settings-field-label">Meta Description</span>
        <textarea
          value={formData.meta_description || ''}
          onChange={(e) => onField('meta_description', e.target.value)}
          placeholder="Hands-on coding labs and guided learning tracks."
          rows={3}
        />
        <span className="settings-field-hint">Used by search engines and social sharing previews.</span>
      </label>

      <hr className="settings-divider" />

      {/* Logo */}
      <div>
        <p className="settings-section-title">Logo & Icon</p>
        <p className="settings-section-desc">Displayed in the navigation bar and browser tab. Pick from the Media Library.</p>
      </div>

      <div className="settings-row-2col">
        <label className="settings-field">
          <span className="settings-field-label">Logo Width (px)</span>
          <input
            type="number" min="64" max="600"
            value={formData.site_logo_width || DEFAULT_SITE_SETTINGS.site_logo_width}
            onChange={(e) => onNumberField('site_logo_width', e.target.value, DEFAULT_SITE_SETTINGS.site_logo_width)}
          />
        </label>
        <label className="settings-field">
          <span className="settings-field-label">Logo Height (px)</span>
          <input
            type="number" min="24" max="240"
            value={formData.site_logo_height || DEFAULT_SITE_SETTINGS.site_logo_height}
            onChange={(e) => onNumberField('site_logo_height', e.target.value, DEFAULT_SITE_SETTINGS.site_logo_height)}
          />
        </label>
      </div>

      <AssetBlock
        title="Site Logo"
        hint="Recommended: SVG or PNG, transparent background."
        hasAsset={!!formData.site_logo_url}
        thumbContent={logoPreview ? <img src={logoPreview} alt="Logo" /> : 'IMG'}
        thumbClass="logo-thumb"
        urlText={formData.site_logo_url}
        onChoose={() => openPicker('logo')}
        onRemove={() => clearAsset('logo')}
        onCopy={() => { navigator.clipboard.writeText(formData.site_logo_url); setToast({ type: 'success', message: 'Logo URL copied!' }); }}
      />

      <AssetBlock
        title="Site Icon / Favicon"
        hint="Recommended: square PNG or ICO, minimum 32×32px."
        hasAsset={!!formData.site_icon_url}
        thumbContent={iconPreview ? <img src={iconPreview} alt="Icon" /> : 'ICO'}
        urlText={formData.site_icon_url}
        onChoose={() => openPicker('icon')}
        onRemove={() => clearAsset('icon')}
        onCopy={() => { navigator.clipboard.writeText(formData.site_icon_url); setToast({ type: 'success', message: 'Icon URL copied!' }); }}
      />
    </div>
  );

  /* ─── Guide Section ─── */
  const GuideSection = () => (
    <div className="settings-group">
      <div>
        <p className="settings-section-title">Guide Settings</p>
        <p className="settings-section-desc">Control how textbook-style guides are presented to students.</p>
      </div>

      <label className="settings-field">
        <span className="settings-field-label">Default Guide Author</span>
        <input
          type="text"
          maxLength={120}
          value={formData.guide_default_author || ''}
          onChange={(e) => onField('guide_default_author', e.target.value)}
          placeholder="Campus404 Guide Team"
        />
        <span className="settings-field-hint">Shown on guide pages when no specific author is set.</span>
      </label>

      <hr className="settings-divider" />

      <div>
        <p className="settings-section-title">Table of Contents</p>
        <p className="settings-section-desc">Auto-generate a TOC from guide headings.</p>
      </div>

      <label className="settings-toggle-row" htmlFor="guide-show-toc">
        <div className="settings-toggle-text">
          <strong>Enable Auto TOC</strong>
          <p>Automatically build a Table of Contents from guide headings.</p>
        </div>
        <Toggle
          id="guide-show-toc"
          checked={Boolean(formData.guide_show_toc)}
          onChange={(e) => onField('guide_show_toc', e.target.checked)}
        />
      </label>

      <label className="settings-field">
        <span className="settings-field-label">TOC Heading Depth</span>
        <select
          value={Number(formData.guide_toc_depth) || DEFAULT_SITE_SETTINGS.guide_toc_depth}
          onChange={(e) => onNumberField('guide_toc_depth', e.target.value, DEFAULT_SITE_SETTINGS.guide_toc_depth)}
          disabled={!formData.guide_show_toc}
        >
          <option value="2">H2 only</option>
          <option value="3">H2 – H3</option>
          <option value="4">H2 – H4</option>
        </select>
        <span className="settings-field-hint">Recommended: H2–H3 for chapter-like navigation.</span>
      </label>

      <hr className="settings-divider" />

      <div>
        <p className="settings-section-title">Social Sharing</p>
        <p className="settings-section-desc">Allow readers to share guide pages on social platforms.</p>
      </div>

      <label className="settings-toggle-row" htmlFor="guide-show-share">
        <div className="settings-toggle-text">
          <strong>Show Social Share Buttons</strong>
          <p>Display share actions (copy link, X, LinkedIn, WhatsApp) on guide pages.</p>
        </div>
        <Toggle
          id="guide-show-share"
          checked={Boolean(formData.guide_show_social_share)}
          onChange={(e) => onField('guide_show_social_share', e.target.checked)}
        />
      </label>

      {/* Guide Preview — only useful preview kept */}
      <div className="guide-preview-panel">
        <div className="guide-preview-panel-header">
          <IconEye />
          <span>Guide Page Preview</span>
        </div>
        <div className="guide-preview-body">
          <h4>Mastering SQL JOINs with Real Campus Data</h4>
          <div className="guide-preview-meta">
            <span>By {formData.guide_default_author || DEFAULT_SITE_SETTINGS.guide_default_author}</span>
            <span>14 min read</span>
            <span>Updated Mar 18, 2026</span>
          </div>

          {formData.guide_show_toc ? (
            <div className="guide-preview-toc">
              <h5>Table of Contents</h5>
              <ul>
                <li>Why JOINs Matter in Real Projects</li>
                <li>INNER JOIN Patterns</li>
                {Number(formData.guide_toc_depth) >= 3 && <li className="sub">Common INNER JOIN mistakes</li>}
                <li>LEFT JOIN for Missing Data</li>
                {Number(formData.guide_toc_depth) >= 4 && <li className="sub deeper">Visualizing join cardinality</li>}
              </ul>
            </div>
          ) : (
            <p className="guide-preview-disabled">Auto TOC is disabled.</p>
          )}

          {formData.guide_show_social_share ? (
            <div className="guide-preview-share">
              <button type="button">Copy Link</button>
              <button type="button">X</button>
              <button type="button">LinkedIn</button>
              <button type="button">WhatsApp</button>
            </div>
          ) : (
            <p className="guide-preview-disabled">Social share actions are hidden.</p>
          )}
        </div>
      </div>
    </div>
  );

  /* ─── Render ─── */
  return (
    <div className="settings-page">
      {toast && <div className={`settings-toast ${toast.type}`}>{toast.message}</div>}

      {activePicker && (
        <MediaPickerModal
          title={PICKER_TITLES[activePicker] || 'Select Media'}
          showAlt={true}
          onSelect={handleMediaPick}
          onClose={closePicker}
        />
      )}

      <div className="settings-shell">
        {/* Header */}
        <div className="settings-header">
          <div className="settings-header-left">
            <h2>Settings</h2>
            <p className="settings-subtitle">Configure branding and guide experience from one hub.</p>
          </div>
          <span className="settings-updated">Last saved: {formatDate(formData.updated_at)}</span>
        </div>

        {/* Panel */}
        <div className="settings-panel">
          {/* Sidebar */}
          <nav className="settings-tabs" aria-label="Settings Sections">
            <span className="settings-tabs-label">Configuration</span>
            {SETTINGS_SECTIONS.map((sec) => (
              <button
                key={sec.id}
                type="button"
                className={`settings-tab-btn${activeSection === sec.id ? ' active' : ''}`}
                onClick={() => setActiveSection(sec.id)}
              >
                {sec.icon}
                {sec.label}
              </button>
            ))}
          </nav>

          {/* Content */}
          <section className="settings-content">
            <div className="settings-content-inner">
              {error && (
                <div className="settings-error-bar">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {error}
                </div>
              )}

              {activeSection === 'branding' ? <BrandingSection /> : <GuideSection />}
            </div>

            {/* Footer Actions */}
            <div className="settings-actions">
              <button type="button" className="btn-secondary" onClick={handleReset} disabled={!hasChanges || saving}>
                Discard Changes
              </button>
              <button type="button" className="btn-primary" onClick={handleSave} disabled={!hasChanges || saving}>
                {saving ? 'Saving…' : 'Save Settings'}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Settings;