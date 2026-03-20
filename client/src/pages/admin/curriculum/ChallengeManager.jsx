import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../curriculum/api';
import './ChallengeManager.css';

export default function ChallengeManager() {
  const navigate = useNavigate();
  const { moduleId } = useParams();

  const [lab, setLab] = useState(null);
  const [module, setModule] = useState(null);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const mod = await api.getModule(moduleId);
      setModule(mod);

      const [labData, challengeGroups] = await Promise.all([
        api.getLab(mod.lab_id),
        api.getChallengeGroups(moduleId),
      ]);

      setLab(labData);
      setGroups((challengeGroups || []).sort((a, b) => a.order_index - b.order_index));
    } catch (e) {
      showToast(e.message || 'Failed to load challenge groups.', 'error');
    } finally {
      setLoading(false);
    }
  }, [moduleId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (group) => {
    if (!confirm(`Delete challenge "${group.title}" and all its levels?`)) return;
    try {
      await api.deleteChallengeGroup(group.id);
      showToast('Challenge deleted.');
      fetchData();
    } catch (e) {
      showToast(e.message || 'Delete failed.', 'error');
    }
  };

  return (
    <div className="cgm-wrap">
      {toast && <div className={`cgm-toast ${toast.type}`}>{toast.msg}</div>}

      <div className="cgm-breadcrumb">
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
            <button type="button" onClick={() => navigate(`/admin/modules/${moduleId}/edit`)}>{module.title}</button>
          </>
        )}
        <span>{'>'}</span>
        <span>Challenges</span>
      </div>

      <div className="cgm-header">
        <div>
          <h2>Challenge Manager</h2>
          {module && <p>Module: <strong>{module.title}</strong></p>}
        </div>
        <div className="cgm-actions">
          <button type="button" className="cgm-btn ghost" onClick={() => navigate(`/admin/modules/${moduleId}/edit`)}>
            Back to Module
          </button>
          <button
            type="button"
            className="cgm-btn primary"
            onClick={() => navigate(`/admin/challenge-groups/create?module_id=${moduleId}`)}
          >
            + New Challenge
          </button>
        </div>
      </div>

      {loading ? (
        <div className="cgm-loading">Loading challenges...</div>
      ) : groups.length === 0 ? (
        <div className="cgm-empty">
          <h4>No challenge groups yet</h4>
          <p>Create your first concept group for this module.</p>
          <button type="button" className="cgm-btn primary" onClick={() => navigate(`/admin/challenge-groups/create?module_id=${moduleId}`)}>
            Create Challenge Group
          </button>
        </div>
      ) : (
        <div className="cgm-list">
          {groups.map((group, idx) => (
            <div key={group.id} className="cgm-item">
              <div className="cgm-item-main">
                <span className="cgm-order">{idx + 1}</span>
                <div>
                  <h4>{group.title}</h4>
                  {group.description && <p>{group.description}</p>}
                  <div className="cgm-meta">
                    <span>{group.level_count} levels</span>
                    <span>{group.total_xp} XP</span>
                    <span>{group.is_published ? 'Published' : 'Draft'}</span>
                  </div>
                </div>
              </div>

              <div className="cgm-item-actions">
                <button type="button" onClick={() => navigate(`/admin/challenges/${group.id}/levels`)}>Levels</button>
                <button type="button" onClick={() => navigate(`/admin/challenge-groups/${group.id}/edit`)}>Edit</button>
                <button
                  type="button"
                  className="danger cgm-icon-btn"
                  title="Delete challenge"
                  aria-label="Delete challenge"
                  onClick={() => handleDelete(group)}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
