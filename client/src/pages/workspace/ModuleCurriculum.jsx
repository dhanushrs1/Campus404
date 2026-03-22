import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../../components/Header/Header';
import Footer from '../../components/Footer/Footer';
import { API_URL } from '../../config';
import { resolveAssetUrl } from '../../utils/siteSettings';
import './LabCurriculum.css';
import './ModuleCurriculum.css';

const token = () => localStorage.getItem('token');
const authH = () => ({ Authorization: `Bearer ${token()}` });

const resolveModuleBannerUrl = (module) => {
  if (!module) return null;
  const candidates = [
    module.banner_url,
    module.banner_image_url,
    module.banner_image_path ? `/uploads/${String(module.banner_image_path).replace(/^\/+/, '')}` : null,
  ].filter(Boolean);
  if (!candidates.length) return null;
  return resolveAssetUrl(candidates[0]) || candidates[0];
};

/* ── Circular progress ring ── */
const CircularProgress = ({ pct, size = 72, stroke = 5, color = '#4ade80' }) => {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <div className="mc-ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 1s ease' }} />
      </svg>
      <div className="mc-ring-text">{pct}%</div>
    </div>
  );
};

/* ── Guide button — only renders if guide exists ── */
const GuideButton = ({ guideSlug }) => {
  const navigate = useNavigate();
  if (!guideSlug) return null;
  return (
    <button
      className="mc-guide-btn"
      onClick={(e) => { e.stopPropagation(); navigate(`/guide/${guideSlug}`); }}
      title="Open the guide for this module"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
      Guide
    </button>
  );
};

export default function ModuleCurriculum() {
  const { slug, moduleId } = useParams();
  const navigate = useNavigate();
  const [lab, setLab] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const heroRef = useRef(null);

  useEffect(() => {
    fetch(`${API_URL}/labs/${slug}/progress`, { headers: authH() })
      .then(r => {
        if (!r.ok) throw new Error('Lab not found');
        return r.json();
      })
      .then(data => setLab(data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    const handleScroll = () => {
      if (heroRef.current) {
        heroRef.current.style.backgroundPositionY = `${window.scrollY * 0.35}px`;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (loading) return (
    <div className="mc-loading">
      <div className="mc-loading-ring" />
      <p>Loading module...</p>
    </div>
  );

  if (error || !lab) return (
    <div className="mc-error-wrap">
      <div className="mc-error-card">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <h2>{error || 'Module not found'}</h2>
        <button onClick={() => navigate('/dashboard')}>← Back to Dashboard</button>
      </div>
    </div>
  );

  const mod = lab.modules.find(m => m.module_id === parseInt(moduleId, 10));

  if (!mod) return (
    <div className="mc-error-wrap">
      <div className="mc-error-card">
        <h2>Module not found</h2>
        <button onClick={() => navigate(`/labs/${slug}`)}>← Back to {lab.title}</button>
      </div>
    </div>
  );

  const heroImg = resolveModuleBannerUrl(mod);
  const modPct = mod.challenge_count > 0
    ? Math.round((mod.completed_challenges / mod.challenge_count) * 100)
    : 0;
  const challengeGroups = mod.challenge_groups || [];
  const modIdx = lab.modules.findIndex(m => m.module_id === parseInt(moduleId, 10));
  const totalModules = lab.modules.length;

  return (
    <div className="mc-page">
      <Header />

      {/* ── HERO ── */}
      <section
        className="mc-hero"
        ref={heroRef}
        style={heroImg
          ? { backgroundImage: `url(${heroImg})` }
          : { background: 'linear-gradient(135deg, #0a192f 0%, #0d2847 50%, #0a192f 100%)' }
        }
      >
        <div className="mc-hero-overlay" />
        <div className="mc-hero-inner">
          {/* Back breadcrumb */}
          <button className="mc-back-btn" onClick={() => navigate(`/labs/${slug}`)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
            </svg>
            {lab.title}
          </button>

          <div className="mc-hero-body">
            <div className="mc-hero-left">
              <div className="mc-hero-tag">
                <span>Module {modIdx >= 0 ? modIdx + 1 : ''} of {totalModules}</span>
              </div>

              <h1 className="mc-hero-title">{mod.title}</h1>
              {mod.description && <p className="mc-hero-desc">{mod.description}</p>}

              <div className="mc-hero-chips">
                <div className="mc-chip">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                  {mod.total_xp} XP
                </div>
                <div className="mc-chip">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                  </svg>
                  {challengeGroups.length} Challenges
                </div>
                <div className="mc-chip">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                  {mod.completed_challenges}/{mod.challenge_count} done
                </div>
                {mod.guide_slug && (
                  <div className="mc-chip guide-chip" onClick={() => navigate(`/guide/${mod.guide_slug}`)}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                    </svg>
                    Guide
                  </div>
                )}
              </div>
            </div>

            <CircularProgress pct={modPct} size={84} stroke={5} color="#4ade80" />
          </div>
        </div>
      </section>

      {/* ── BODY ── */}
      <div className="mc-body">

        {/* Main challenge list */}
        <main className="mc-main">
          <div className="mc-section-label">
            <span>Challenges</span>
            <span className="mc-section-count">{challengeGroups.length} total</span>
          </div>

          {challengeGroups.length === 0 ? (
            <div className="mc-empty-state">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
              </svg>
              <h3>No challenges yet</h3>
              <p>Your instructor hasn't published any challenge groups for this module yet.</p>
            </div>
          ) : (
            <div className="mc-challenges-list">
              {challengeGroups.map((group, ci) => {
                const levels = group.levels || [];
                const groupCompleted = levels.length > 0 && levels.every(l => l.is_completed);
                const groupLocked = levels.length === 0 ? false : levels.every(l => l.is_locked);
                const groupXp = group.total_xp || levels.reduce((s, l) => s + Number(l.xp_reward || 0), 0);
                const completedLevels = levels.filter(l => l.is_completed).length;
                const uniqueUrl = `/labs/${slug}/modules/${mod.module_id}/challenges/${group.challenge_id}`;

                const prev = challengeGroups[ci - 1];
                const prevDone = !prev || ((prev.levels || []).length > 0 && (prev.levels || []).every(l => l.is_completed));
                const isCurrent = !groupCompleted && !groupLocked && prevDone;

                let state = 'locked';
                if (groupCompleted) state = 'completed';
                else if (isCurrent) state = 'current';
                else if (!groupLocked) state = 'available';

                return (
                  <div
                    key={group.challenge_id || `c-${ci}`}
                    className={`mc-challenge-card state-${state}`}
                    onClick={() => !groupLocked && navigate(uniqueUrl)}
                  >
                    {/* Connector line (not last) */}
                    {ci < challengeGroups.length - 1 && (
                      <div className={`mc-connector ${groupCompleted ? 'done' : ''}`} />
                    )}

                    {/* Status node */}
                    <div className="mc-node">
                      {groupCompleted ? (
                        <div className="mc-node-icon done">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                      ) : groupLocked ? (
                        <div className="mc-node-icon locked">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zm-7 6c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" />
                            <path d="M7 11V7c0-2.76 2.24-5 5-5s5 2.24 5 5v4h-2V7c0-1.66-1.34-3-3-3S9 5.34 9 7v4H7z" />
                          </svg>
                        </div>
                      ) : isCurrent ? (
                        <div className="mc-node-icon current">
                          <div className="mc-pulse" />
                        </div>
                      ) : (
                        <div className="mc-node-icon available">
                          <span>{ci + 1}</span>
                        </div>
                      )}
                    </div>

                    {/* Card content */}
                    <div className="mc-card-body">
                      <div className="mc-card-top">
                        <div className="mc-card-title-row">
                          <h3>{group.title || `Challenge ${ci + 1}`}</h3>
                          <div className="mc-card-right">
                            <span className="mc-xp-badge">{groupXp} XP</span>
                            {/* Guide button — only when guide exists */}
                            <GuideButton guideSlug={mod.guide_slug} />
                          </div>
                        </div>
                        <div className="mc-card-meta">
                          <span>{levels.length} {levels.length === 1 ? 'level' : 'levels'}</span>
                          {!groupLocked && levels.length > 0 && (
                            <span className="mc-meta-sep">·</span>
                          )}
                          {!groupLocked && levels.length > 0 && (
                            <span>{completedLevels}/{levels.length} completed</span>
                          )}
                          {groupLocked && <span className="mc-locked-tag">🔒 Complete previous to unlock</span>}
                        </div>
                      </div>

                      {/* Level preview dots */}
                      {!groupLocked && levels.length > 0 && (
                        <div className="mc-levels-strip">
                          {levels.map((lvl, li) => (
                            <div
                              key={lvl.challenge_id || li}
                              className={`mc-level-dot ${lvl.is_completed ? 'done' : lvl.is_locked ? 'locked' : 'open'}`}
                              title={`Level ${li + 1}${lvl.is_completed ? ' — Completed' : ''}`}
                            />
                          ))}
                          {levels.length > 0 && (
                            <span className="mc-level-label">
                              {completedLevels > 0 ? `${Math.round((completedLevels / levels.length) * 100)}%` : 'Not started'}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Progress bar */}
                      {!groupLocked && levels.length > 0 && (
                        <div className="mc-progress-bar">
                          <div
                            className="mc-progress-fill"
                            style={{ width: `${Math.round((completedLevels / levels.length) * 100)}%` }}
                          />
                        </div>
                      )}

                      {/* CTA */}
                      {isCurrent && (
                        <button
                          className="mc-start-btn"
                          onClick={(e) => { e.stopPropagation(); navigate(uniqueUrl); }}
                        >
                          {completedLevels > 0 ? 'Continue Challenge' : 'Start Challenge'}
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                          </svg>
                        </button>
                      )}

                      {groupCompleted && (
                        <div className="mc-done-tag">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Completed
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Badge earned banner */}
          {mod.is_completed && mod.badge && (
            <div className="mc-badge-banner">
              <div className="mc-badge-icon-wrap">
                {mod.badge.image_url
                  ? <img src={mod.badge.image_url} alt={mod.badge.name} />
                  : <span>🏆</span>
                }
              </div>
              <div className="mc-badge-info">
                <strong>{mod.badge.name}</strong>
                <p>{mod.badge.description || 'Badge earned for completing this module!'}</p>
                {mod.badge.earned_at && (
                  <span>Earned {new Date(mod.badge.earned_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                )}
              </div>
              <div className="mc-badge-confetti">🎉</div>
            </div>
          )}
        </main>

        {/* Sidebar */}
        <aside className="mc-sidebar">
          {/* Module progress card */}
          <div className="mc-sidebar-card">
            <div className="mc-sc-header">
              <span>Module Progress</span>
              <strong className="mc-sc-pct">{modPct}%</strong>
            </div>
            <div className="mc-sc-bar">
              <div className="mc-sc-fill" style={{ width: `${modPct}%` }} />
            </div>
            <div className="mc-sc-stats">
              <div className="mc-sc-stat">
                <span>{mod.completed_challenges}</span>
                <label>Done</label>
              </div>
              <div className="mc-sc-stat">
                <span>{mod.challenge_count - mod.completed_challenges}</span>
                <label>Left</label>
              </div>
              <div className="mc-sc-stat">
                <span>{mod.total_xp} XP</span>
                <label>Reward</label>
              </div>
            </div>
          </div>

          {/* Guide card — only when guide exists */}
          {mod.guide_slug && (
            <div className="mc-sidebar-card mc-guide-card" onClick={() => navigate(`/guide/${mod.guide_slug}`)}>
              <div className="mc-guide-card-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
              </div>
              <div className="mc-guide-card-text">
                <strong>Module Guide</strong>
                <p>Open the guide post for this module</p>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mc-guide-arrow">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </div>
          )}

          {/* Other modules in this lab */}
          <div className="mc-sidebar-card">
            <div className="mc-sc-label">Other Modules</div>
            <div className="mc-other-modules">
              {lab.modules.map((m, idx) => {
                const pct = m.challenge_count > 0
                  ? Math.round((m.completed_challenges / m.challenge_count) * 100)
                  : 0;
                const isSelf = m.module_id === parseInt(moduleId, 10);
                return (
                  <div
                    key={m.module_id}
                    className={`mc-other-mod ${isSelf ? 'active' : ''} ${m.is_locked ? 'locked' : ''}`}
                    onClick={() => !m.is_locked && !isSelf && navigate(`/labs/${slug}/modules/${m.module_id}`)}
                  >
                    <div className={`mc-other-num ${m.is_completed ? 'done' : m.is_locked ? 'locked' : ''}`}>
                      {m.is_locked ? '🔒' : m.is_completed ? '✓' : idx + 1}
                    </div>
                    <div className="mc-other-info">
                      <span>{m.title}</span>
                      {!m.is_locked && (
                        <div className="mc-other-bar">
                          <div className="mc-other-fill" style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>

      <Footer/>
    </div>
  );
}