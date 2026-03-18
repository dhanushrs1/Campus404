import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../curriculum/api';
import './GuideManager.css';

const formatDate = (value) => {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export default function GuideManager() {
  const navigate = useNavigate();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 260);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (statusFilter === 'published') params.published = true;
      if (statusFilter === 'draft') params.published = false;
      const data = await api.getGuidePages(params);
      setPosts(data || []);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const stats = useMemo(() => {
    const total = posts.length;
    const published = posts.filter((post) => post.is_published).length;
    return { total, published, drafts: total - published };
  }, [posts]);

  const handleDelete = async (post) => {
    if (!window.confirm(`Delete guide "${post.title}"?`)) return;
    try {
      await api.deleteGuidePage(post.id);
      showToast('Guide deleted.');
      fetchPosts();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  return (
    <div className="guide-manager-wrap">
      {toast && <div className={`guide-manager-toast ${toast.type}`}>{toast.msg}</div>}

      <div className="guide-manager-header">
        <div>
          <h2>Guide Manager</h2>
          <p>Create and manage structured Guide pages.</p>
        </div>
        <button className="guide-primary-btn" onClick={() => navigate('/admin/guide/create')}>
          New Guide
        </button>
      </div>

      <div className="guide-manager-stats">
        <div>
          <span>Total</span>
          <strong>{stats.total}</strong>
        </div>
        <div>
          <span>Published</span>
          <strong>{stats.published}</strong>
        </div>
        <div>
          <span>Drafts</span>
          <strong>{stats.drafts}</strong>
        </div>
      </div>

      <div className="guide-manager-controls">
        <input
          type="text"
          placeholder="Search guides by title, slug, or excerpt..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <div className="guide-filter-tabs">
          <button
            type="button"
            className={statusFilter === 'all' ? 'active' : ''}
            onClick={() => setStatusFilter('all')}
          >
            All
          </button>
          <button
            type="button"
            className={statusFilter === 'published' ? 'active' : ''}
            onClick={() => setStatusFilter('published')}
          >
            Published
          </button>
          <button
            type="button"
            className={statusFilter === 'draft' ? 'active' : ''}
            onClick={() => setStatusFilter('draft')}
          >
            Drafts
          </button>
        </div>
      </div>

      {loading ? (
        <div className="guide-manager-loading">Loading guides...</div>
      ) : posts.length === 0 ? (
        <div className="guide-manager-empty">
          <h3>No guides found</h3>
          <p>Start by creating your first study guide.</p>
          <button className="guide-primary-btn" onClick={() => navigate('/admin/guide/create')}>
            Create Guide
          </button>
        </div>
      ) : (
        <div className="guide-manager-grid">
          {posts.map((post) => (
            <article key={post.id} className="guide-card">
              <div className="guide-card-head">
                <span className={`guide-status ${post.is_published ? 'published' : 'draft'}`}>
                  {post.is_published ? 'Published' : 'Draft'}
                </span>
              </div>

              {post.featured_image_url && (
                <img src={post.featured_image_url} alt={post.title} className="guide-card-image" />
              )}

              <h3>{post.title}</h3>
              <p className="guide-card-slug">/guide/{post.slug}</p>
              {post.excerpt ? <p className="guide-card-excerpt">{post.excerpt}</p> : null}

              <div className="guide-card-meta">Updated {formatDate(post.updated_at)}</div>

              <div className="guide-card-actions">
                <button type="button" onClick={() => navigate(`/admin/guide/${post.id}/edit`)}>
                  Edit
                </button>
                <button type="button" onClick={() => window.open(`/guide/${post.slug}`, '_blank')}>
                  View
                </button>
                <button type="button" className="danger" onClick={() => handleDelete(post)}>
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
