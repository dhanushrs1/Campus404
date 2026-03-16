import { useEffect, useState } from 'react';
import { API_URL, APP_NAME } from '../config';

const STORAGE_KEY = 'campus404.siteSettings.v1';
export const SITE_SETTINGS_EVENT = 'campus404:site-settings-updated';

export const DEFAULT_SITE_SETTINGS = Object.freeze({
  site_name: APP_NAME || 'Campus404',
  meta_description: 'Campus404 hands-on coding labs and guided learning tracks.',
  site_logo_url: null,
  site_logo_width: 220,
  site_logo_height: 48,
  site_icon_url: null,
  logo_is_svg: false,
  icon_is_svg: false,
  updated_at: null,
});

const safeTrim = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
};

const getMimeFromUrl = (url) => {
  const clean = safeTrim(url);
  if (!clean) return 'image/png';
  const lower = clean.toLowerCase();
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.ico')) return 'image/x-icon';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.avif')) return 'image/avif';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return 'image/png';
};

export const normalizeSiteSettings = (value = {}) => {
  const merged = { ...DEFAULT_SITE_SETTINGS, ...(value || {}) };

  const width = Number(merged.site_logo_width);
  const height = Number(merged.site_logo_height);

  return {
    ...merged,
    site_name: safeTrim(merged.site_name) || DEFAULT_SITE_SETTINGS.site_name,
    meta_description: safeTrim(merged.meta_description),
    site_logo_url: safeTrim(merged.site_logo_url),
    site_logo_width: Number.isFinite(width) ? Math.min(600, Math.max(64, width)) : DEFAULT_SITE_SETTINGS.site_logo_width,
    site_logo_height: Number.isFinite(height) ? Math.min(240, Math.max(24, height)) : DEFAULT_SITE_SETTINGS.site_logo_height,
    site_icon_url: safeTrim(merged.site_icon_url),
    logo_is_svg: Boolean(merged.logo_is_svg),
    icon_is_svg: Boolean(merged.icon_is_svg),
    updated_at: safeTrim(merged.updated_at),
  };
};

export const resolveAssetUrl = (url) => {
  const clean = safeTrim(url);
  if (!clean) return null;
  if (clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('//')) return clean;
  if (clean.startsWith('/')) return clean;
  return `/${clean}`;
};

const readCachedSettings = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeSiteSettings(JSON.parse(raw));
  } catch {
    return null;
  }
};

const persistSettings = (settings) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore private mode / storage limit failures.
  }
};

const ensureMetaTag = (type, key) => {
  const selector = type === 'property' ? `meta[property="${key}"]` : `meta[name="${key}"]`;
  let tag = document.head.querySelector(selector);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(type, key);
    document.head.appendChild(tag);
  }
  return tag;
};

const ensureLinkTag = (rel) => {
  let tag = document.head.querySelector(`link[rel="${rel}"]`);
  if (!tag) {
    tag = document.createElement('link');
    tag.setAttribute('rel', rel);
    document.head.appendChild(tag);
  }
  return tag;
};

const ensureJsonLdTag = () => {
  const selector = 'script[type="application/ld+json"][data-site-settings="organization"]';
  let tag = document.head.querySelector(selector);
  if (!tag) {
    tag = document.createElement('script');
    tag.type = 'application/ld+json';
    tag.setAttribute('data-site-settings', 'organization');
    document.head.appendChild(tag);
  }
  return tag;
};

export const applyDocumentSiteSettings = (rawSettings) => {
  const settings = normalizeSiteSettings(rawSettings);

  const logoUrl = resolveAssetUrl(settings.site_logo_url);
  const fallbackIconUrl = resolveAssetUrl(settings.site_icon_url);
  const effectiveMetaImage = logoUrl || fallbackIconUrl;

  const faviconUrl = resolveAssetUrl(settings.site_icon_url) || '/vite.svg';
  const faviconType = getMimeFromUrl(faviconUrl);

  document.title = settings.site_name;

  const description = ensureMetaTag('name', 'description');
  description.setAttribute('content', settings.meta_description || DEFAULT_SITE_SETTINGS.meta_description);

  const ogSiteName = ensureMetaTag('property', 'og:site_name');
  ogSiteName.setAttribute('content', settings.site_name);

  const ogTitle = ensureMetaTag('property', 'og:title');
  ogTitle.setAttribute('content', settings.site_name);

  if (effectiveMetaImage) {
    const ogImage = ensureMetaTag('property', 'og:image');
    ogImage.setAttribute('content', effectiveMetaImage);

    const twitterImage = ensureMetaTag('name', 'twitter:image');
    twitterImage.setAttribute('content', effectiveMetaImage);
  }

  const icon = ensureLinkTag('icon');
  icon.setAttribute('type', faviconType);
  icon.setAttribute('href', faviconUrl);

  const shortcut = ensureLinkTag('shortcut icon');
  shortcut.setAttribute('type', faviconType);
  shortcut.setAttribute('href', faviconUrl);

  const appleTouch = ensureLinkTag('apple-touch-icon');
  appleTouch.setAttribute('href', faviconUrl);

  const jsonLd = ensureJsonLdTag();
  jsonLd.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: settings.site_name,
    logo: logoUrl || fallbackIconUrl || undefined,
    url: window.location.origin,
  });

  return settings;
};

const parseResponse = async (response) => {
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    throw new Error(body?.detail || `Request failed (${response.status})`);
  }

  return body;
};

export const fetchPublicSiteSettings = async (force = false) => {
  if (!force) {
    const cached = readCachedSettings();
    if (cached) return cached;
  }

  const response = await fetch(`${API_URL}/site-settings`);
  const payload = await parseResponse(response);
  const normalized = normalizeSiteSettings(payload);
  persistSettings(normalized);
  return normalized;
};

export const fetchAdminSiteSettings = async (token) => {
  const response = await fetch(`${API_URL}/admin/site-settings`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const payload = await parseResponse(response);
  const normalized = normalizeSiteSettings(payload);
  persistSettings(normalized);
  return normalized;
};

export const saveAdminSiteSettings = async (payload, token) => {
  const response = await fetch(`${API_URL}/admin/site-settings`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const body = await parseResponse(response);
  const normalized = normalizeSiteSettings(body);
  persistSettings(normalized);
  return normalized;
};

export const emitSiteSettingsUpdated = (rawSettings) => {
  const normalized = normalizeSiteSettings(rawSettings);
  persistSettings(normalized);
  applyDocumentSiteSettings(normalized);
  window.dispatchEvent(new CustomEvent(SITE_SETTINGS_EVENT, { detail: normalized }));
  return normalized;
};

export const useSiteSettings = () => {
  const [settings, setSettings] = useState(() => readCachedSettings() || DEFAULT_SITE_SETTINGS);

  useEffect(() => {
    let mounted = true;

    fetchPublicSiteSettings()
      .then((next) => {
        if (!mounted) return;
        const normalized = applyDocumentSiteSettings(next);
        setSettings(normalized);
      })
      .catch(() => {
        if (!mounted) return;
        setSettings((prev) => normalizeSiteSettings(prev));
      });

    const onUpdate = (event) => {
      const normalized = applyDocumentSiteSettings(event.detail || DEFAULT_SITE_SETTINGS);
      setSettings(normalized);
    };

    window.addEventListener(SITE_SETTINGS_EVENT, onUpdate);

    return () => {
      mounted = false;
      window.removeEventListener(SITE_SETTINGS_EVENT, onUpdate);
    };
  }, []);

  return settings;
};
