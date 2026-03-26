import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../../components/Header/Header';
import Footer from '../../components/Footer/Footer';
import { API_URL } from '../../config';
import './ChallengeLevels.css';

const token = () => localStorage.getItem('token');
const authH = () => ({ Authorization: `Bearer ${token()}` });

export default function ChallengeLevels() {
  const { slug, moduleId, challengeId } = useParams();
  const navigate = useNavigate();
  const [lab, setLab] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/labs/${slug}/progress`, { headers: authH() })
      .then((r) => {
        if (!r.ok) throw new Error('Lab not found');
        return r.json();
      })
      .then((data) => setLab(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="cl-loading">
        <div className="cl-loading-ring" />
        <p>Loading challenge levels...</p>
      </div>
    );
  }

  if (error || !lab) {
    return (
      <div className="cl-error">
        <h2>Oops — {error || 'Challenge not found'}</h2>
        <button onClick={() => navigate('/dashboard')}>← Go back</button>
      </div>
    );
  }

  const mod = lab.modules.find((m) => m.module_id === parseInt(moduleId, 10));
  if (!mod) {
    return (
      <div className="cl-error">
        <h2>Module not found in this curriculum.</h2>
        <button onClick={() => navigate(`/labs/${slug}`)}>← Back to Course</button>
      </div>
    );
  }

  const groups = mod.challenge_groups || [];
  const selectedGroup = groups.find((group) => Number(group.challenge_id) === Number(challengeId));
  if (!selectedGroup) {
    return (
      <div className="cl-error">
        <h2>Challenge not found in this module.</h2>
        <button onClick={() => navigate(`/labs/${slug}/modules/${moduleId}`)}>← Back to Challenges</button>
      </div>
    );
  }

  const levels = selectedGroup.levels || [];
  const totalXp = Number(selectedGroup.total_xp || 0) || levels.reduce((sum, level) => sum + Number(level.xp_reward || 0), 0);
  const pct = levels.length > 0
    ? Math.round((selectedGroup.completed_levels / levels.length) * 100)
    : 0;
  const currentLevelIndex = levels.findIndex((level) => !level.is_locked && !level.is_completed);
  const nextLevel = currentLevelIndex >= 0 ? levels[currentLevelIndex] : null;

  const xPattern = [16, 82, 26, 76, 20, 84];
  const topPadding = 90;
  const rowGap = 150;
  const positions = levels.map((_, index) => ({
    x: xPattern[index % xPattern.length],
    y: topPadding + (index * rowGap),
  }));
  const mapHeight = Math.max(320, topPadding + Math.max(levels.length - 1, 0) * rowGap + 140);
  const segments = positions.slice(0, -1).map((pos, index) => {
    const next = positions[index + 1];
    const curveY = (pos.y + next.y) / 2;
    const isActive = levels[index]?.is_completed && !levels[index + 1]?.is_locked;
    return {
      d: `M ${pos.x} ${pos.y} C ${pos.x} ${curveY}, ${next.x} ${curveY}, ${next.x} ${next.y}`,
      isActive,
    };
  });

  return (
    <div className="cl-page">
      <Header />

      <section className="cl-hero">
        <div className="cl-hero-pattern" />
        <div className="cl-hero-inner">
          <button className="cl-back-btn" onClick={() => navigate(`/labs/${slug}/modules/${moduleId}`)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
            Back to Challenges
          </button>

          <div className="cl-hero-grid">
            <div className="cl-hero-copy">
              <span className="cl-kicker">Quest Path</span>
              <h1>{selectedGroup.title}</h1>
              <p>{selectedGroup.description || 'Follow the level route, complete each mission, and unlock the final reward.'}</p>

              <div className="cl-hero-chips">
                <span className="cl-chip">Module: {mod.title}</span>
                <span className="cl-chip">{levels.length} Levels</span>
                <span className="cl-chip">{totalXp} XP Pool</span>
              </div>
            </div>

            <div className="cl-premium-panel" role="presentation">
              <div className="cl-premium-row">
                <span>Completion</span>
                <strong>{pct}%</strong>
              </div>
              <div className="cl-premium-bar" aria-label="Completion progress">
                <div className="cl-premium-fill" style={{ width: `${pct}%` }} />
              </div>

              <div className="cl-premium-stats">
                <div>
                  <label>Completed</label>
                  <strong>{selectedGroup.completed_levels}</strong>
                </div>
                <div>
                  <label>Locked</label>
                  <strong>{levels.filter((level) => level.is_locked).length}</strong>
                </div>
                <div>
                  <label>Open</label>
                  <strong>{levels.filter((level) => !level.is_locked && !level.is_completed).length}</strong>
                </div>
              </div>

              <p className="cl-next-level">
                {nextLevel ? `Up next: ${nextLevel.display_title || `Level ${currentLevelIndex + 1}`}` : 'All levels completed. Great run!'}
              </p>
            </div>
          </div>
        </div>
      </section>

      <main className="cl-body">
        {levels.length === 0 ? (
          <div className="cl-empty">
            <h3>No levels published yet</h3>
            <p>The challenge exists, but there are no levels available right now.</p>
          </div>
        ) : (
          <section className="cl-game-map" style={{ minHeight: `${mapHeight}px` }}>
            <svg className="cl-track" viewBox={`0 0 100 ${mapHeight}`} preserveAspectRatio="none" aria-hidden="true">
              {segments.map((segment, index) => (
                <path key={`base-${index}`} d={segment.d} className="cl-track-line" />
              ))}
              {segments.map((segment, index) => (
                <path key={`active-${index}`} d={segment.d} className={`cl-track-line-active ${segment.isActive ? 'is-active' : ''}`} />
              ))}
            </svg>

            {levels.map((level, index) => {
              const uniqueUrl = `/labs/${slug}/modules/${moduleId}/challenges/${challengeId}/level/${index + 1}`;
              const isCompleted = Boolean(level.is_completed);
              const isLocked = Boolean(level.is_locked);
              const isOpen = !isCompleted && !isLocked;
              const isCurrent = currentLevelIndex === index && isOpen;

              return (
                <article
                  key={level.challenge_id}
                  className={`cl-level-node ${isCompleted ? 'completed' : ''} ${isLocked ? 'locked' : ''} ${isCurrent ? 'current' : ''}`}
                  style={{ left: `${positions[index].x}%`, top: `${positions[index].y}px` }}
                >
                  <button
                    type="button"
                    className="cl-level-badge"
                    onClick={() => !isLocked && navigate(uniqueUrl)}
                    disabled={isLocked}
                    aria-label={`${level.display_title || `Level ${index + 1}`} - ${isCompleted ? 'Completed' : isLocked ? 'Locked' : 'Open'}`}
                  >
                    {isCompleted ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    ) : isLocked ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zm-7 6c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" /><path d="M7 11V7c0-2.76 2.24-5 5-5s5 2.24 5 5v4h-2V7c0-1.66-1.34-3-3-3S7 5.34 7 7v4H7z" /></svg>
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </button>

                  <div className={`cl-level-card ${positions[index].x > 50 ? 'to-left' : 'to-right'}`}>
                    <div className="cl-level-card-top">
                      <h3>{level.display_title || `Level ${index + 1}`}</h3>
                      <span>+{level.xp_reward || 0} XP</span>
                    </div>
                    <p>{isCompleted ? 'Completed' : isLocked ? 'Locked' : isCurrent ? 'Ready to start' : 'Open'}</p>
                    {isOpen && (
                      <button type="button" className="cl-start-btn" onClick={() => navigate(uniqueUrl)}>
                        {isCurrent ? 'Start Level' : 'Play'}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
