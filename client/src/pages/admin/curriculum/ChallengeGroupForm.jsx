import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../curriculum/api';
import './ChallengeGroupForm.css';

const INITIAL = {
  module_id: 0,
  title: '',
  description: '',
  is_published: true,
};

export default function ChallengeGroupForm() {
  const navigate = useNavigate();
  const { challengeGroupId } = useParams();
  const isEdit = Boolean(challengeGroupId);
  const [params] = useSearchParams();

  const [form, setForm] = useState(INITIAL);
  const [module, setModule] = useState(null);
  const [lab, setLab] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (isEdit) {
          const group = await api.getChallengeGroup(challengeGroupId);
          const mod = await api.getModule(group.module_id);
          const labData = await api.getLab(mod.lab_id);

          setForm({
            module_id: group.module_id,
            title: group.title || '',
            description: group.description || '',
            is_published: Boolean(group.is_published),
          });
          setModule(mod);
          setLab(labData);
        } else {
          const moduleId = Number(params.get('module_id'));
          if (!moduleId) {
            showToast('Missing module context.', 'error');
            return;
          }
          const mod = await api.getModule(moduleId);
          const labData = await api.getLab(mod.lab_id);

          setForm((prev) => ({
            ...prev,
            module_id: moduleId,
          }));
          setModule(mod);
          setLab(labData);
        }
      } catch (e) {
        showToast(e.message || 'Failed to load challenge form.', 'error');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [challengeGroupId, isEdit, params]);

  const set = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      showToast('Title is required.', 'error');
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await api.updateChallengeGroup(challengeGroupId, {
          title: form.title,
          description: form.description || null,
          is_published: Boolean(form.is_published),
        });
        showToast('Challenge updated.');
      } else {
        await api.createChallengeGroup({
          module_id: Number(form.module_id),
          title: form.title,
          description: form.description || null,
          is_published: Boolean(form.is_published),
        });
        showToast('Challenge created.');
      }

      setTimeout(() => navigate(`/admin/modules/${form.module_id}/challenges`), 700);
    } catch (e) {
      showToast(e.message || 'Save failed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteChallenge = async () => {
    if (!isEdit) return;
    if (!confirm(`Delete challenge "${form.title || challengeGroupId}" and all its levels?`)) return;

    setSaving(true);
    try {
      await api.deleteChallengeGroup(challengeGroupId);
      showToast('Challenge deleted.');
      setTimeout(() => navigate(`/admin/modules/${form.module_id}/challenges`), 600);
    } catch (e) {
      showToast(e.message || 'Delete failed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cgf-wrap">
      {toast && <div className={`cgf-toast ${toast.type}`}>{toast.msg}</div>}

      <div className="cgf-breadcrumb">
        <button type="button" onClick={() => navigate('/admin/labs')}>Labs</button>
        {lab && (
          <>
            <span>{'>'}</span>
            <button type="button" onClick={() => navigate(`/admin/labs/${lab.id}/edit`)}>{lab.title}</button>
          </>
        )}
        {module && (
          <>
            <span>{'>'}</span>
            <button type="button" onClick={() => navigate(`/admin/modules/${module.id}/edit`)}>{module.title}</button>
          </>
        )}
        <span>{'>'}</span>
        <span>{isEdit ? 'Edit Challenge' : 'New Challenge'}</span>
      </div>

      <div className="cgf-header">
        <div>
          <h2>{isEdit ? 'Edit Challenge Group' : 'Create Challenge Group'}</h2>
          {module && <p>Module: <strong>{module.title}</strong></p>}
        </div>
      </div>

      {!isEdit && (
        <div className="cgf-steps">
          <div className="cgf-step done"><span>1</span>Create Lab</div>
          <div className="cgf-step-line done" />
          <div className="cgf-step done"><span>2</span>Add Module</div>
          <div className="cgf-step-line done" />
          <div className="cgf-step current"><span>3</span>Add Challenge</div>
          <div className="cgf-step-line" />
          <div className="cgf-step"><span>4</span>Add Levels</div>
        </div>
      )}

      {loading ? (
        <div className="cgf-loading">Loading challenge details...</div>
      ) : (
        <form className="cgf-form" onSubmit={handleSubmit}>
          <div className="cgf-card">
            <div className="cgf-field">
              <label>Challenge Title</label>
              <input
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="e.g. If Statements"
              />
            </div>

            <div className="cgf-field">
              <label>Description</label>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="Optional short summary for this concept group"
              />
            </div>

            <div className="cgf-field toggle">
              <label>Publish</label>
              <label className="cgf-switch">
                <input
                  type="checkbox"
                  checked={form.is_published}
                  onChange={(e) => set('is_published', e.target.checked)}
                />
                <span className="cgf-switch-ui" />
                <span className="cgf-switch-label">{form.is_published ? 'Published' : 'Draft'}</span>
              </label>
            </div>
          </div>

          <div className="cgf-actions">
            <button type="submit" className="cgf-btn primary" disabled={saving}>
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Challenge'}
            </button>
            <button
              type="button"
              className="cgf-btn ghost"
              onClick={() => navigate(`/admin/modules/${form.module_id}/challenges`)}
            >
              Cancel
            </button>
            {isEdit && (
              <button
                type="button"
                className="cgf-btn danger"
                onClick={handleDeleteChallenge}
                disabled={saving}
              >
                Delete Challenge
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
