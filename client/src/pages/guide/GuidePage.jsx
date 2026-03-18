import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '../../components/Header/Header';
import Footer from '../../components/Footer/Footer';
import { api } from '../admin/curriculum/api';
import { DEFAULT_SITE_SETTINGS, useSiteSettings } from '../../utils/siteSettings';
import './GuidePage.css';

const MAX_HEADING_DEPTH = 4;

const slugifyHeading = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'section';

const parseGuideContent = (html, depth) => {
  const safeHtml = html || '';
  const clampedDepth = Math.max(2, Math.min(MAX_HEADING_DEPTH, Number(depth) || 3));

  if (!safeHtml || typeof window === 'undefined' || typeof window.DOMParser !== 'function') {
    return { guideHtml: safeHtml, tocItems: [] };
  }

  try {
    const parser = new window.DOMParser();
    const doc = parser.parseFromString(`<article>${safeHtml}</article>`, 'text/html');
    const root = doc.body.firstElementChild;
    if (!root) return { guideHtml: safeHtml, tocItems: [] };

    const selectors = [];
    for (let level = 2; level <= clampedDepth; level += 1) {
      selectors.push(`h${level}`);
    }

    const headings = Array.from(root.querySelectorAll(selectors.join(',')));
    const idCount = new Map();
    const tocItems = [];

    headings.forEach((heading) => {
      const text = heading.textContent?.trim();
      if (!text) return;

      const baseId = `guide-${slugifyHeading(text)}`;
      const seen = idCount.get(baseId) || 0;
      idCount.set(baseId, seen + 1);

      const id = seen === 0 ? baseId : `${baseId}-${seen + 1}`;
      heading.id = id;

      const level = Number(heading.tagName.slice(1)) || 2;
      tocItems.push({ id, text, level });
    });

    return { guideHtml: root.innerHTML, tocItems };
  } catch {
    return { guideHtml: safeHtml, tocItems: [] };
  }
};

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const estimateMinutes = (html) => {
  const text = (html || '').replace(/<[^>]+>/g, ' ');
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
};

const indentClassByLevel = (level) => {
  if (level <= 2) return '';
  if (level === 3) return 'level-3';
  return 'level-4';
};

export default function GuidePage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const siteSettings = useSiteSettings();

  const [viewState, setViewState] = useState(() => ({
    slug: null,
    post: null,
    error: null,
  }));
  const [activeHeadingId, setActiveHeadingId] = useState('');
  const [shareNotice, setShareNotice] = useState('');

  const tocDepth = Number(siteSettings.guide_toc_depth) || DEFAULT_SITE_SETTINGS.guide_toc_depth;
  const showToc = Boolean(siteSettings.guide_show_toc);
  const showSocialShare = Boolean(siteSettings.guide_show_social_share);
  const authorName = siteSettings.guide_default_author || DEFAULT_SITE_SETTINGS.guide_default_author;

  useEffect(() => {
    let cancelled = false;

    api.getGuidePageBySlug(slug)
      .then((data) => {
        if (cancelled) return;
        setViewState({ slug, post: data, error: null });
      })
      .catch((err) => {
        if (cancelled) return;
        setViewState({
          slug,
          post: null,
          error: err.message || 'Unable to load this guide.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const loading = viewState.slug !== slug;
  const post = loading ? null : viewState.post;
  const error = loading ? null : viewState.error;

  const parsedGuide = useMemo(
    () => parseGuideContent(post?.content_html, tocDepth),
    [post?.content_html, tocDepth],
  );

  const readingMinutes = useMemo(() => estimateMinutes(post?.content_html), [post?.content_html]);
  const chapterCount = useMemo(() => {
    const chapterHeadings = parsedGuide.tocItems.filter((item) => item.level === 2);
    return chapterHeadings.length || parsedGuide.tocItems.length;
  }, [parsedGuide.tocItems]);

  const shareUrl = useMemo(() => {
    if (!slug) return '';
    if (typeof window === 'undefined') return `/guide/${slug}`;
    return `${window.location.origin}/guide/${slug}`;
  }, [slug]);

  useEffect(() => {
    if (!showToc || parsedGuide.tocItems.length === 0) return undefined;

    const pickActiveHeading = () => {
      const offset = 140;
      let current = parsedGuide.tocItems[0]?.id || '';

      parsedGuide.tocItems.forEach((item) => {
        const node = document.getElementById(item.id);
        if (!node) return;
        if (node.getBoundingClientRect().top - offset <= 0) {
          current = item.id;
        }
      });

      setActiveHeadingId(current);
    };

    const timer = window.setTimeout(pickActiveHeading, 0);
    window.addEventListener('scroll', pickActiveHeading, { passive: true });

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', pickActiveHeading);
    };
  }, [parsedGuide.tocItems, showToc]);

  useEffect(() => {
    if (!shareNotice) return undefined;
    const timer = window.setTimeout(() => setShareNotice(''), 2400);
    return () => window.clearTimeout(timer);
  }, [shareNotice]);

  const jumpToHeading = (headingId) => {
    const target = document.getElementById(headingId);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveHeadingId(headingId);
  };

  const copyGuideLink = async () => {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareNotice('Guide link copied.');
    } catch {
      setShareNotice('Could not copy link.');
    }
  };

  const openShareTarget = (target) => {
    if (!shareUrl || !post?.title) return;

    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedTitle = encodeURIComponent(`Study Guide: ${post.title}`);
    const encodedMessage = encodeURIComponent(`${post.title}\n${shareUrl}`);

    const urls = {
      x: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      whatsapp: `https://wa.me/?text=${encodedMessage}`,
    };

    const shareTarget = urls[target];
    if (!shareTarget) return;
    window.open(shareTarget, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <div className="guide-page-shell">
        <Header />
        <main className="guide-page-loading">Loading guide...</main>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="guide-page-shell">
        <Header />
        <main className="guide-page-error">
          <h2>{error || 'Guide not found'}</h2>
          <p>The guide you are looking for does not exist or has been moved.</p>
          <button onClick={() => navigate(-1)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
            Go Back
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="guide-page-shell">
      <Header />
      <main className="guide-page-main">
        <div className="guide-page-layout">
          <article className="guide-page-article">
            <button className="guide-page-back" onClick={() => navigate(-1)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
              Back to Curriculum
            </button>

            <header className="guide-page-header">
              <p className="guide-page-kicker">Student Guide</p>
              <h1>{post.title}</h1>
              {post.excerpt ? <p className="guide-page-excerpt">{post.excerpt}</p> : null}

              <div className="guide-page-meta">
                <span><strong>Author:</strong> {authorName}</span>
                <span><strong>Read Time:</strong> {readingMinutes} min</span>
                <span><strong>Updated:</strong> {formatDate(post.updated_at)}</span>
                <span><strong>Chapters:</strong> {chapterCount}</span>
              </div>
            </header>

            {post.featured_image_url ? (
              <img className="guide-page-featured" src={post.featured_image_url} alt={post.title} />
            ) : null}

            <section className="guide-page-content" dangerouslySetInnerHTML={{ __html: parsedGuide.guideHtml }} />
          </article>

          <aside className="guide-page-sidebar">
            {showToc && parsedGuide.tocItems.length > 0 ? (
              <section className="guide-side-card" aria-label="Table of Contents">
                <div className="guide-side-title-row">
                  <h3>Table of Contents</h3>
                  <span>{parsedGuide.tocItems.length} topics</span>
                </div>

                <ul className="guide-toc-list">
                  {parsedGuide.tocItems.map((item) => (
                    <li key={item.id} className={`${indentClassByLevel(item.level)} ${activeHeadingId === item.id ? 'active' : ''}`}>
                      <button type="button" onClick={() => jumpToHeading(item.id)}>
                        {item.text}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {showSocialShare ? (
              <section className="guide-side-card">
                <h3>Share this Guide</h3>
                <p>Help classmates access this chapter quickly.</p>
                <div className="guide-share-grid">
                  <button type="button" onClick={copyGuideLink}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    Copy Link
                  </button>
                  <button type="button" onClick={() => openShareTarget('x')}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4l11.733 16h4.267l-11.733 -16z"/><path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772"/></svg>
                    X
                  </button>
                  <button type="button" onClick={() => openShareTarget('linkedin')}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>
                    LinkedIn
                  </button>
                  <button type="button" onClick={() => openShareTarget('whatsapp')}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.16 11.08a10 10 0 1 0-2.3 5.48L22 22l-5.46-1.85a9.97 9.97 0 0 0 4.62-9.07z"/></svg>
                    WhatsApp
                  </button>
                </div>
                {shareNotice ? <div className="guide-share-notice">{shareNotice}</div> : null}
              </section>
            ) : null}
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}
