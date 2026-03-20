import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../curriculum/api';
import './LevelManager.css';

export default function LevelManager() {
  const navigate = useNavigate();
  const { challengeId } = useParams();

  const [lab, setLab] = useState(null);
  const [module, setModule] = useState(null);
  const [challengeGroup, setChallengeGroup] = useState(null);
  const [levels, setLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const group = await api.getChallengeGroup(challengeId);
      setChallengeGroup(group);

      const mod = await api.getModule(group.module_id);
      const [labData, levelList] = await Promise.all([
        api.getLab(mod.lab_id),
        api.getLevels(challengeId),
      ]);

      setModule(mod);
      setLab(labData);
      setLevels((levelList || []).sort((a, b) => a.level_number - b.level_number));
    } catch (e) {
      showToast(e.message || 'Failed to load levels.', 'error');
    } finally {
      setLoading(false);
    }
  }, [challengeId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (level) => {
    if (!confirm(`Delete level "${level.display_title}"?`)) return;
    try {
      await api.deleteLevel(level.id);
      showToast('Level deleted.');
      fetchData();
    } catch (e) {
      showToast(e.message || 'Delete failed.', 'error');
    }
  };

  return (
    <div className="lvm-wrap">
      {toast && <div className={`lvm-toast ${toast.type}`}>{toast.msg}</div>}

      <div className="lvm-breadcrumb">
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
        {challengeGroup && (
          <>
            <span>{'>'}</span>
            <button type="button" onClick={() => navigate(`/admin/modules/${challengeGroup.module_id}/challenges`)}>{challengeGroup.title}</button>
          </>
        )}
        <span>{'>'}</span>
        <span>Levels</span>
      </div>

      <div className="lvm-header">
        <div>
          <h2>Level Manager</h2>
          {challengeGroup && <p>Challenge: <strong>{challengeGroup.title}</strong></p>}
        </div>
        <div className="lvm-actions">
          {challengeGroup && (
            <button
              type="button"
              className="lvm-btn ghost"
              onClick={() => navigate(`/admin/modules/${challengeGroup.module_id}/challenges`)}
            >
              Back to Challenges
            </button>
          )}
          <button
            type="button"
            className="lvm-btn primary"
            onClick={() => navigate(`/admin/levels/create?challenge_id=${challengeId}`)}
          >
            + New Level
          </button>
        </div>
      </div>

      {loading ? (
        <div className="lvm-loading">Loading levels...</div>
      ) : levels.length === 0 ? (
        <div className="lvm-empty">
          <h4>No levels yet</h4>
          <p>Create the first level under this challenge group.</p>
          <button type="button" className="lvm-btn primary" onClick={() => navigate(`/admin/levels/create?challenge_id=${challengeId}`)}>
            Create Level
          </button>
        </div>
      ) : (
        <div className="lvm-list">
          {levels.map((level, idx) => (
            <div key={level.id} className="lvm-item">
              <div className="lvm-item-main">
                <span className="lvm-order">{idx + 1}</span>
                <div>
                  <h4>{level.display_title || `Level ${idx + 1}`}</h4>
                  <div className="lvm-meta">
                    <span>{level.xp_reward} XP</span>
                    <span>{level.challenge_type === 'exam' ? 'Exam' : 'Standard'}</span>
                    <span>{level.is_published ? 'Published' : 'Draft'}</span>
                  </div>
                </div>
              </div>

              <div className="lvm-item-actions">
                <button type="button" onClick={() => navigate(`/admin/levels/${level.id}/edit`)}>Edit</button>
                <button
                  type="button"
                  className="danger lvm-icon-btn"
                  title="Delete level"
                  aria-label="Delete level"
                  onClick={() => handleDelete(level)}
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
