import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AdvancedRichEditor from '../../../components/AdvancedRichEditor/AdvancedRichEditor';
import MediaPickerModal from '../../../components/MediaPickerModal/MediaPickerModal';
import { api } from '../curriculum/api';
import './GuideEditor.css';

const toSlug = (input) =>
  input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

const INITIAL_FORM = {
  title: '',
  slug: '',
  excerpt: '',
  content_html: '',
  featured_image_path: '',
  is_published: false,
};

export default function GuideEditor() {
  const navigate = useNavigate();
  const { postId } = useParams();
  const isEdit = Boolean(postId);

  const [form, setForm] = useState(INITIAL_FORM);
  const [slugManual, setSlugManual] = useState(false);
  const [featuredPreview, setFeaturedPreview] = useState(null);

  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState('featured');
  const [editorImage, setEditorImage] = useState(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const load = async () => {
      try {
        if (!isEdit) return;

        const post = await api.getGuidePage(postId);
        if (cancelled || !post) return;

        setForm({
          title: post.title || '',
          slug: post.slug || '',
          excerpt: post.excerpt || '',
          content_html: post.content_html || '',
          featured_image_path: post.featured_image_path || '',
          is_published: Boolean(post.is_published),
        });
        setSlugManual(true);
        setFeaturedPreview(post.featured_image_url || null);
      } catch (error) {
        if (!cancelled) showToast(error.message, 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [isEdit, postId]);

  const handleTitleChange = (title) => {
    setField('title', title);
    if (!slugManual) setField('slug', toSlug(title));
  };

  const handleSlugChange = (slug) => {
    setSlugManual(true);
    setField('slug', toSlug(slug));
  };

  const openFeaturedPicker = () => {
    setPickerMode('featured');
    setShowPicker(true);
  };

  const openEditorImagePicker = () => {
    setPickerMode('editor');
    setShowPicker(true);
  };

  const handleMediaSelect = ({ url, path, alt }) => {
    if (pickerMode === 'featured') {
      setField('featured_image_path', path || '');
      setFeaturedPreview(url || null);
    } else {
      setEditorImage({
        id: `img_${Date.now()}`,
        url,
        alt,
      });
    }
    setShowPicker(false);
  };

  const validate = () => {
    if (!form.title.trim()) return 'Title is required.';
    if (!form.slug.trim()) return 'Slug is required.';
    if (!form.content_html.trim()) return 'Guide content is required.';
    return null;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const validationError = validate();
    if (validationError) {
      showToast(validationError, 'error');
      return;
    }

    const payload = {
      title: form.title.trim(),
      slug: form.slug.trim(),
      excerpt: form.excerpt.trim() || null,
      content_html: form.content_html,
      featured_image_path: form.featured_image_path || null,
      is_published: form.is_published,
    };

    setSaving(true);
    try {
      if (isEdit) {
        await api.updateGuidePage(postId, payload);
        showToast('Guide updated.');
      } else {
        await api.createGuidePage(payload);
        showToast('Guide created.');
      }
      setTimeout(() => navigate('/admin/guide'), 500);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="guide-editor-loading">Loading guide editor...</div>;
  }

  return (
    <div className="guide-editor-wrap">
      {toast && <div className={`guide-editor-toast ${toast.type}`}>{toast.msg}</div>}

      {showPicker && (
        <MediaPickerModal
          title={pickerMode === 'featured' ? 'Select Featured Image' : 'Insert Image'}
          showAlt={pickerMode === 'editor'}
          onSelect={handleMediaSelect}
          onClose={() => setShowPicker(false)}
        />
      )}

      <div className="guide-editor-top">
        <button type="button" className="guide-editor-back" onClick={() => navigate('/admin/guide')}>
          Back to Guide Manager
        </button>
        <h2>{isEdit ? 'Edit Guide' : 'Create Guide'}</h2>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="guide-editor-layout">
          <section className="guide-editor-main">
            <div className="guide-editor-card">
              <label htmlFor="guide-title">Title</label>
              <input
                id="guide-title"
                value={form.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="e.g. SQL Joins Explained with Visual Examples"
              />
            </div>

            <div className="guide-editor-card">
              <label htmlFor="guide-slug">Slug</label>
              <div className="guide-editor-slug-row">
                <span>/guide/</span>
                <input
                  id="guide-slug"
                  value={form.slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="sql-joins-explained"
                />
              </div>
            </div>

            <div className="guide-editor-card">
              <label htmlFor="guide-excerpt">Excerpt</label>
              <textarea
                id="guide-excerpt"
                rows={3}
                maxLength={320}
                value={form.excerpt}
                onChange={(e) => setField('excerpt', e.target.value)}
                placeholder="Short summary shown in Guide cards..."
              />
              <small>{form.excerpt.length}/320</small>
            </div>

            <div className="guide-editor-card">
              <div className="guide-editor-card-header">
                <label>Featured Image</label>
                <button type="button" onClick={openFeaturedPicker}>Choose Image</button>
              </div>

              {featuredPreview ? (
                <div className="guide-featured-block">
                  <img src={featuredPreview} alt="Featured preview" />
                  <div>
                    <button type="button" onClick={openFeaturedPicker}>Replace</button>
                    <button
                      type="button"
                      onClick={() => {
                        setFeaturedPreview(null);
                        setField('featured_image_path', '');
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <p className="guide-editor-muted">No featured image selected.</p>
              )}
            </div>

            <div className="guide-editor-card">
              <div className="guide-editor-card-header">
                <label>Guide Content</label>
                <button type="button" onClick={openEditorImagePicker}>Insert Image</button>
              </div>
              <AdvancedRichEditor
                value={form.content_html}
                onChange={(html) => setField('content_html', html)}
                onRequestImage={openEditorImagePicker}
                imageToInsert={editorImage}
                placeholder="Create your Guide content with headings, tables, lists, code blocks, and images..."
              />
            </div>
          </section>

          <aside className="guide-editor-sidebar">
            <div className="guide-editor-card">
              <h4>Publish</h4>
              <label className="guide-toggle">
                <input
                  type="checkbox"
                  checked={form.is_published}
                  onChange={(e) => setField('is_published', e.target.checked)}
                />
                <span className="track" />
                <span>{form.is_published ? 'Published' : 'Draft'}</span>
              </label>
            </div>

            <div className="guide-editor-card guide-actions-card">
              <button type="submit" disabled={saving} className="guide-save-btn">
                {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Guide'}
              </button>
              <button type="button" onClick={() => navigate('/admin/guide')}>
                Cancel
              </button>
            </div>
          </aside>
        </div>
      </form>
    </div>
  );
}
