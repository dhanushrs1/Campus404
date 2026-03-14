import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Header from '../../components/Header/Header';
import Footer from '../../components/Footer/Footer';
import './LabCurriculum.css';

const token = () => localStorage.getItem('token');
const authH = () => ({ Authorization: `Bearer ${token()}` });

const LANG_LABELS = {
  71: 'Python 3', 63: 'JavaScript', 62: 'Java', 54: 'C++', 50: 'C',
  60: 'Go', 72: 'Ruby', 73: 'Rust', 74: 'TypeScript', 82: 'SQL', 0: 'HTML/CSS/JS',
};

const LANG_COLORS = {
  71: '#3b82f6', 63: '#f59e0b', 62: '#ef4444', 54: '#8b5cf6', 50: '#6b7280',
  60: '#06b6d4', 72: '#e11d48', 74: '#60a5fa', 82: '#059669', 0: '#f97316',
};

// Heroic cover images (picsum based on seed for determinism)
const HERO_DEFAULTS = [
  'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1400&q=80',
  'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1400&q=80',
  'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1400&q=80',
  'https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=1400&q=80',
];

export default function LabCurriculum() {
  const { slug }   = useParams();
  const navigate   = useNavigate();
  const [lab,      setLab]      = useState(null);
  const [stats,    setStats]    = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [openMod,  setOpenMod]  = useState(null); // expanded module id
  const heroRef    = useRef(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/labs/${slug}/progress`, { headers: authH() }).then(r => {
        if (!r.ok) throw new Error('Lab not found');
        return r.json();
      }),
      fetch('/api/me/stats', { headers: authH() }).then(r => r.json()).catch(() => null),
    ]).then(([labData, statsData]) => {
      setLab(labData);
      setStats(statsData);
      // auto-open first unlocked, incomplete module
      const first = labData.modules.find(m => !m.is_locked && !m.is_completed);
      if (first) setOpenMod(first.module_id);
      else if (labData.modules[0]) setOpenMod(labData.modules[0].module_id);
    }).catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  // Parallax hero
  useEffect(() => {
    const handleScroll = () => {
      if (heroRef.current) {
        heroRef.current.style.backgroundPositionY = `${window.scrollY * 0.4}px`;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (loading) return (
    <div className="lc-loading">
      <div className="lc-loading-ring" />
      <p>Loading curriculum...</p>
    </div>
  );
  if (error) return (
    <div className="lc-error">
      <h2>Oops — {error}</h2>
      <button onClick={() => navigate('/dashboard')}>← Go back</button>
    </div>
  );
  if (!lab) return null;

  const heroImg = lab.hero_image_url || HERO_DEFAULTS[lab.lab_id % HERO_DEFAULTS.length] || HERO_DEFAULTS[0];
  const langLabel = LANG_LABELS[lab.language_id] || `Lang ${lab.language_id}`;
  const langColor = LANG_COLORS[lab.language_id] || '#888';
  const progressPct = lab.total_xp > 0 ? Math.round((lab.earned_xp / lab.total_xp) * 100) : 0;

  return (
    <div className="lc-page">
      <Header />

      {/* ── HERO ─────────────────────────────────────────── */}
      <section
        className="lc-hero"
        ref={heroRef}
        style={{ backgroundImage: `url(${heroImg})` }}
      >
        <div className="lc-hero-overlay" />
        <div className="lc-hero-content">
          <div className="lc-hero-lang" style={{ background: langColor + '22', color: langColor, borderColor: langColor + '55' }}>
            {langLabel}
          </div>
          <h1 className="lc-hero-title">{lab.title}</h1>
          {lab.description && <p className="lc-hero-desc">{lab.description}</p>}
          <div className="lc-hero-meta">
            <span><strong>{lab.modules.length}</strong> modules</span>
            <span className="lc-dot">·</span>
            <span><strong>{lab.total_xp}</strong> XP total</span>
            <span className="lc-dot">·</span>
            <span><strong>{lab.modules.reduce((s,m) => s + m.challenge_count, 0)}</strong> challenges</span>
          </div>
          {/* Progress bar */}
          <div className="lc-hero-progress">
            <div className="lc-hero-pbar">
              <div className="lc-hero-pfill" style={{ width: `${progressPct}%` }} />
            </div>
            <span className="lc-hero-ppct">{progressPct}% complete</span>
          </div>
        </div>
      </section>

      {/* ── BODY ─────────────────────────────────────────── */}
      <div className="lc-body">

        {/* LEFT: Module accordion */}
        <main className="lc-main">
          <div className="lc-section-label">
            <span>Course Modules</span>
            <span className="lc-section-count">{lab.modules.length} modules</span>
          </div>

          <div className="lc-modules">
            {lab.modules.map((mod, idx) => {
              const isOpen     = openMod === mod.module_id;
              const modPct     = mod.total_xp > 0 ? Math.round((mod.earned_xp / mod.total_xp) * 100) : 0;
              const earnedBadge = mod.badge?.earned_at;

              return (
                <div
                  key={mod.module_id}
                  className={`lc-mod ${mod.is_locked ? 'locked' : ''} ${mod.is_completed ? 'completed' : ''} ${isOpen ? 'open' : ''}`}
                >
                  {/* Module Header */}
                  <button
                    className="lc-mod-header"
                    onClick={() => !mod.is_locked && setOpenMod(isOpen ? null : mod.module_id)}
                    disabled={mod.is_locked}
                  >
                    {/* Order marker */}
                    <div className="lc-mod-num">
                      {mod.is_locked ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      ) : mod.is_completed ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      ) : (
                        <span>{idx + 1}</span>
                      )}
                    </div>

                    <div className="lc-mod-info">
                      <div className="lc-mod-title-row">
                        <span className="lc-mod-title">{mod.title}</span>
                        {mod.badge && (
                          <span className={`lc-badge-chip ${earnedBadge ? 'earned' : ''}`} title={mod.badge.name}>
                            {mod.badge.image_url ? (
                              <img src={mod.badge.image_url} alt={mod.badge.name} className="lc-badge-chip-img" />
                            ) : '🏆'}
                            {earnedBadge ? 'Earned!' : mod.badge.name}
                          </span>
                        )}
                        {mod.is_locked && <span className="lc-lock-label">Complete previous module first</span>}
                      </div>
                      {mod.description && <p className="lc-mod-desc">{mod.description}</p>}
                      <div className="lc-mod-meta">
                        <span>{mod.challenge_count} challenges</span>
                        <span>·</span>
                        <span>{mod.total_xp} XP</span>
                        {!mod.is_locked && <span>· {mod.completed_challenges}/{mod.challenge_count} done</span>}
                      </div>

                      {/* Mini progress bar */}
                      {!mod.is_locked && (
                        <div className="lc-mod-pbar">
                          <div className="lc-mod-pfill" style={{ width: `${modPct}%` }} />
                        </div>
                      )}
                    </div>

                    <div className="lc-mod-chevron">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                        style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .25s' }}>
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </div>
                  </button>

                  {/* Challenge list — accordion body */}
                  {isOpen && !mod.is_locked && (
                    <div className="lc-challenges">
                      {mod.challenges.map((ch, ci) => {
                        const uniqueUrl = `/workspace/module/${mod.module_id}/level/${ch.level_number}`;
                        return (
                          <div key={ch.challenge_id}
                            className={`lc-ch ${ch.is_completed ? 'done' : ''} ${ch.is_locked ? 'locked' : ''}`}
                          >
                            {/* State icon */}
                            <div className="lc-ch-icon">
                              {ch.is_locked ? (
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                              ) : ch.is_completed ? (
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                              ) : (
                                <span className="lc-ch-num">{ci + 1}</span>
                              )}
                            </div>

                            <div className="lc-ch-body">
                              <span className="lc-ch-title">{ch.display_title}</span>
                              <span className="lc-ch-xp">+{ch.xp_reward} XP</span>
                            </div>

                            {!ch.is_locked && (
                              <button
                                className={`lc-ch-btn ${ch.is_completed ? 'review' : 'start'}`}
                                onClick={() => navigate(uniqueUrl)}
                              >
                                {ch.is_completed ? 'Review' : 'Start →'}
                              </button>
                            )}
                          </div>
                        );
                      })}

                      {/* Module completed state */}
                      {mod.is_completed && mod.badge && (
                        <div className="lc-module-complete-banner">
                          <div className="lc-badge-reveal">
                            {mod.badge.image_url ? (
                              <img src={mod.badge.image_url} alt={mod.badge.name} className="lc-badge-img-big" />
                            ) : <span className="lc-badge-trophy">🏆</span>}
                            <div>
                              <strong>{mod.badge.name}</strong>
                              <p>{mod.badge.description || 'Badge earned for completing this module!'}</p>
                              <span className="lc-badge-date">
                                {mod.badge.earned_at ? `Earned ${new Date(mod.badge.earned_at).toLocaleDateString()}` : 'Keep going to earn this badge!'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </main>

        {/* RIGHT: Progress Sidebar */}
        <aside className="lc-sidebar">
          {/* User card */}
          {stats && (
            <div className="lc-user-card">
              <div className="lc-user-avatar">
                {stats.avatar_url ? (
                  <img src={stats.avatar_url} alt={stats.username} />
                ) : (
                  <div className="lc-avatar-fallback">
                    {(stats.first_name?.[0] || stats.username?.[0] || '?').toUpperCase()}
                  </div>
                )}
              </div>
              <div className="lc-user-info">
                <div className="lc-user-name">{stats.first_name ? `${stats.first_name} ${stats.last_name || ''}`.trim() : stats.username}</div>
                <div className="lc-user-handle">@{stats.username}</div>
              </div>
            </div>
          )}

          {/* Stats grid */}
          {stats && (
            <div className="lc-stats-grid">
              <div className="lc-stat-item xp">
                <div className="lc-stat-val">{stats.total_xp.toLocaleString()}</div>
                <div className="lc-stat-label">Total XP</div>
              </div>
              <div className="lc-stat-item streak">
                <div className="lc-stat-val">
                  🔥 {stats.current_streak}
                </div>
                <div className="lc-stat-label">Day Streak</div>
              </div>
              <div className="lc-stat-item challenges">
                <div className="lc-stat-val">{stats.completed_challenges}</div>
                <div className="lc-stat-label">Solved</div>
              </div>
              <div className="lc-stat-item badges">
                <div className="lc-stat-val">{stats.badges_earned}</div>
                <div className="lc-stat-label">Badges</div>
              </div>
            </div>
          )}

          {/* Lab progress */}
          <div className="lc-lab-progress-card">
            <div className="lc-lp-header">
              <span>Lab Progress</span>
              <span className="lc-lp-pct">{progressPct}%</span>
            </div>
            <div className="lc-lp-bar">
              <div className="lc-lp-fill" style={{ width: `${progressPct}%`, background: langColor }} />
            </div>
            <div className="lc-lp-xp">{lab.earned_xp} / {lab.total_xp} XP</div>
          </div>

          {/* Badges earned */}
          {lab.modules.some(m => m.badge) && (
            <div className="lc-badges-card">
              <h4 className="lc-badges-title">Module Badges</h4>
              <div className="lc-badges-grid">
                {lab.modules.filter(m => m.badge).map(mod => {
                  const earned = mod.badge.earned_at;
                  return (
                    <div key={mod.module_id} className={`lc-badge-item ${earned ? 'earned' : 'locked'}`} title={mod.badge.name}>
                      <div className="lc-badge-icon">
                        {mod.badge.image_url ? (
                          <img src={mod.badge.image_url} alt={mod.badge.name} />
                        ) : (
                          <span>{earned ? '🏆' : '🔒'}</span>
                        )}
                      </div>
                      <span className="lc-badge-name">{mod.badge.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Continue button */}
          {(() => {
            const nextCh = lab.modules
              .flatMap(m => m.challenges.map(c => ({ ...c, moduleId: m.module_id, uniqueId: m.unique_id, modLocked: m.is_locked })))
              .find(c => !c.is_completed && !c.is_locked && !c.modLocked);
            return nextCh ? (
              <button className="lc-continue-btn" style={{ background: langColor }}
                onClick={() => navigate(`/workspace/module/${nextCh.moduleId}-${nextCh.uniqueId}/level/${nextCh.level_number}`)}>
                {lab.earned_xp === 0 ? 'Start Lab →' : 'Continue →'}
              </button>
            ) : lab.earned_xp === lab.total_xp && lab.total_xp > 0 ? (
              <div className="lc-complete-badge">
                <span>🎉</span> Lab Complete!
              </div>
            ) : null;
          })()}
        </aside>
      </div>

      <Footer />
    </div>
  );
}
