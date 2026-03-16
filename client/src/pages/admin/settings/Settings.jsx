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

const formatDate = (iso) => {
  if (!iso) return 'Not saved yet';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return 'Not saved yet';
  return parsed.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getErrorMessage = (error) => {
  if (!error) return 'Request failed';
  if (typeof error === 'string') return error;
  return error.message || 'Request failed';
};

const toStoredAssetUrl = (url, path) => {
  if (path) {
    const normalizedPath = String(path).replace(/^\/+/, '');
    return `/uploads/${normalizedPath}`;
  }
  if (!url) return '';

  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.origin === window.location.origin) return parsed.pathname;
    return parsed.toString();
  } catch {
    return url;
  }
};

const Settings = () => {
  const [initialData, setInitialData] = useState(DEFAULT_SITE_SETTINGS);
  const [formData, setFormData] = useState(DEFAULT_SITE_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [activePicker, setActivePicker] = useState(null);

  const token = localStorage.getItem('token') || '';

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
    return () => {
      mounted = false;
    };
  }, [token]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timeout);
  }, [toast]);

  const hasChanges = useMemo(() => {
    const keys = [
      'site_name',
      'meta_description',
      'site_logo_url',
      'site_logo_width',
      'site_logo_height',
      'site_icon_url',
    ];

    return keys.some((key) => (initialData[key] ?? null) !== (formData[key] ?? null));
  }, [formData, initialData]);

  const onField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const onNumberField = (field, value, fallback) => {
    const parsed = Number(value);
    onField(field, Number.isFinite(parsed) ? parsed : fallback);
  };

  const openPicker = (target) => {
    setActivePicker(target);
    setError('');
  };

  const closePicker = () => {
    setActivePicker(null);
  };

  const handleMediaPick = ({ url, path }) => {
    if (!activePicker) return;

    const field = PICKER_TARGET_TO_FIELD[activePicker];
    const chosenUrl = toStoredAssetUrl(url, path);
    if (!field || !chosenUrl) {
      closePicker();
      return;
    }

    setFormData((prev) => ({ ...prev, [field]: chosenUrl }));

    setToast({ type: 'success', message: `${PICKER_SUCCESS_LABEL[activePicker]} selected from Media Library.` });
    closePicker();
  };

  const clearAsset = (target) => {
    const field = PICKER_TARGET_TO_FIELD[target];
    if (!field) return;

    setFormData((prev) => ({ ...prev, [field]: null }));
  };

  const handleSave = async () => {
    if (!token) {
      setError('Admin authentication is required.');
      return;
    }

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
      };

      const saved = await saveAdminSiteSettings(payload, token);
      setInitialData(saved);
      setFormData(saved);
      emitSiteSettingsUpdated(saved);
      setToast({ type: 'success', message: 'Site settings saved and applied live.' });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setFormData(initialData);
    setError('');
  };

  const logoPreview = resolveAssetUrl(formData.site_logo_url);
  const iconPreview = resolveAssetUrl(formData.site_icon_url);

  if (loading) {
    return (
      <div className="settings-page">
        <div className="settings-shell">
          <h2>Settings</h2>
          <p className="settings-muted">Loading site settings...</p>
        </div>
      </div>
    );
  }

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
        <div className="settings-header">
          <div>
            <h2>Settings</h2>
            <p className="settings-subtitle">Configure site logo and favicon from Media Library in one place.</p>
          </div>
          <span className="settings-updated">Last saved: {formatDate(formData.updated_at)}</span>
        </div>

        <div className="settings-panel">
          <div className="settings-grid">
            <div className="settings-card">
              <h3>Site Settings</h3>

              <label className="settings-field">
                <span>Site Name</span>
                <input
                  type="text"
                  value={formData.site_name || ''}
                  onChange={(e) => onField('site_name', e.target.value)}
                  placeholder="Campus404"
                />
              </label>

              <label className="settings-field">
                <span>Meta Description</span>
                <textarea
                  value={formData.meta_description || ''}
                  onChange={(e) => onField('meta_description', e.target.value)}
                  placeholder="Hands-on coding labs and guided learning tracks."
                  rows={3}
                />
              </label>

              <div className="settings-row two-col">
                <label className="settings-field">
                  <span>Logo Width (px)</span>
                  <input
                    type="number"
                    min="64"
                    max="600"
                    value={formData.site_logo_width || DEFAULT_SITE_SETTINGS.site_logo_width}
                    onChange={(e) => onNumberField('site_logo_width', e.target.value, DEFAULT_SITE_SETTINGS.site_logo_width)}
                  />
                </label>
                <label className="settings-field">
                  <span>Logo Height (px)</span>
                  <input
                    type="number"
                    min="24"
                    max="240"
                    value={formData.site_logo_height || DEFAULT_SITE_SETTINGS.site_logo_height}
                    onChange={(e) => onNumberField('site_logo_height', e.target.value, DEFAULT_SITE_SETTINGS.site_logo_height)}
                  />
                </label>
              </div>

              <div className="settings-asset-card">
                <div className="settings-asset-header">
                  <div>
                    <h4>Site Logo</h4>
                    <p>Use Media Library to select an existing logo or upload inside the popup.</p>
                  </div>
                  <div className="settings-asset-actions">
                    <button type="button" className="btn-upload" onClick={() => openPicker('logo')}>Choose from Media</button>
                    {formData.site_logo_url && (
                      <button
                        type="button"
                        className="btn-asset-remove-icon"
                        onClick={() => clearAsset('logo')}
                        title="Remove site logo"
                        aria-label="Remove site logo"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                          <path d="M10 11v6M14 11v6"/>
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
                {formData.site_logo_url ? (
                  <div className="settings-asset-preview">
                    <div className="settings-asset-thumb large">
                      {logoPreview ? <img src={logoPreview} alt="Site logo" /> : 'IMG'}
                    </div>
                    <div className="settings-asset-meta">
                      <p className="settings-asset-label">Current Logo</p>
                      <p className="settings-asset-url">{formData.site_logo_url}</p>
                    </div>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ padding: '0.4rem', marginLeft: 'auto', display: 'grid', placeItems: 'center' }}
                      title="Copy URL"
                      aria-label="Copy URL"
                      onClick={() => {
                        navigator.clipboard.writeText(formData.site_logo_url);
                        setToast({ type: 'success', message: 'Logo URL copied!' });
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    </button>
                  </div>
                ) : (
                  <p className="settings-asset-status">No logo selected yet.</p>
                )}
              </div>

              <div className="settings-asset-card">
                <div className="settings-asset-header">
                  <div>
                    <h4>Site Icon / Favicon</h4>
                    <p>Pick a square icon from Media Library. You can upload in the same popup.</p>
                  </div>
                  <div className="settings-asset-actions">
                    <button type="button" className="btn-upload" onClick={() => openPicker('icon')}>Choose from Media</button>
                    {formData.site_icon_url && (
                      <button
                        type="button"
                        className="btn-asset-remove-icon"
                        onClick={() => clearAsset('icon')}
                        title="Remove site icon"
                        aria-label="Remove site icon"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                          <path d="M10 11v6M14 11v6"/>
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
                {formData.site_icon_url ? (
                  <div className="settings-asset-preview">
                    <div className="settings-asset-thumb">
                      {iconPreview ? <img src={iconPreview} alt="Site icon" /> : 'ICO'}
                    </div>
                    <div className="settings-asset-meta">
                      <p className="settings-asset-label">Current Icon</p>
                      <p className="settings-asset-url">{formData.site_icon_url}</p>
                    </div>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ padding: '0.4rem', marginLeft: 'auto', display: 'grid', placeItems: 'center' }}
                      title="Copy URL"
                      aria-label="Copy URL"
                      onClick={() => {
                        navigator.clipboard.writeText(formData.site_icon_url);
                        setToast({ type: 'success', message: 'Icon URL copied!' });
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    </button>
                  </div>
                ) : (
                  <p className="settings-asset-status">No icon selected yet.</p>
                )}
              </div>
            </div>

            <div className="settings-card preview-card">
              <h3>Live Preview</h3>

              <div className="preview-block">
                <p className="preview-title">Header Preview</p>
                <div className="preview-navbar">
                  <div className="preview-navbar-logo">
                    {logoPreview ? (
                      <img
                        src={logoPreview}
                        alt={`${formData.site_name || 'Campus404'} logo preview`}
                        style={{
                          width: `${Math.max(64, Number(formData.site_logo_width) || 220)}px`,
                          height: `${Math.max(24, Number(formData.site_logo_height) || 48)}px`,
                          maxWidth: '260px',
                          maxHeight: '56px',
                        }}
                      />
                    ) : (
                      <div className="preview-fallback-logo">
                        <span className="mark">C</span>
                        <span>{formData.site_name || 'Campus404'}</span>
                      </div>
                    )}
                  </div>
                  <div className="preview-navbar-links">
                    <span>Explore</span>
                    <span>Challenges</span>
                    <span>Leaderboard</span>
                  </div>
                </div>
              </div>

              <div className="preview-block">
                <p className="preview-title">Browser Tab Preview</p>
                <div className="preview-browser-tab">
                  <div className="preview-icon-wrap">
                    {iconPreview ? <img src={iconPreview} alt="Favicon preview" /> : <span>C</span>}
                  </div>
                  <span className="preview-tab-title">{formData.site_name || 'Campus404'} - Dashboard</span>
                </div>
                <p className="settings-muted">Browsers typically render favicon at 16x16 and 32x32 pixels.</p>
              </div>

              <div className="preview-block">
                <p className="preview-title">Search Result Preview</p>
                <div className="search-preview">
                  <div className="search-preview-head">
                    <div className="search-preview-favicon">
                      {iconPreview ? <img src={iconPreview} alt="Icon" /> : <span>C</span>}
                    </div>
                    <div>
                      <p className="search-preview-brand">{formData.site_name || 'Campus404'}</p>
                      <p className="search-preview-url">{window.location.origin}</p>
                    </div>
                  </div>
                  <h4>{formData.site_name || 'Campus404'} | Learn coding through labs</h4>
                  <p>{formData.meta_description || DEFAULT_SITE_SETTINGS.meta_description}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && <div className="settings-error">{error}</div>}

        <div className="settings-actions">
          <button type="button" className="btn-secondary" onClick={handleReset} disabled={!hasChanges || saving}>
            Reset Changes
          </button>
          <button type="button" className="btn-primary" onClick={handleSave} disabled={!hasChanges || saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;