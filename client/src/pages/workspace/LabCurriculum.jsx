import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Header from '../../components/Header/Header';
import Footer from '../../components/Footer/Footer';
import { API_URL } from '../../config';
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
  const heroRef    = useRef(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/labs/${slug}/progress`, { headers: authH() }).then(r => {
        if (!r.ok) throw new Error('Lab not found');
        return r.json();
      }),
      fetch(`${API_URL}/me/stats`, { headers: authH() }).then(r => r.json()).catch(() => null),
    ]).then(([labData, statsData]) => {
      setLab(labData);
      setStats(statsData);
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

          <div className="lc-modules-grid">
            {lab.modules.map((mod, idx) => {
              const modPct = mod.challenge_count > 0 ? Math.round((mod.completed_challenges / mod.challenge_count) * 100) : 0;
              const earnedBadge = mod.badge?.earned_at;

              return (
                <div
                  key={mod.module_id}
                  className={`lc-mod-card ${mod.is_locked ? 'locked' : ''} ${mod.is_completed ? 'completed' : ''}`}
                  onClick={() => !mod.is_locked && navigate(`/labs/${slug}/modules/${mod.module_id}`)}
                >
                  <div className="lc-mod-card-header">
                    <span className="lc-mod-num">{mod.is_locked ? '🔒' : idx + 1}</span>
                  </div>
                  
                  <h3 className="lc-mod-title">{mod.title}</h3>
                  {mod.description && <p className="lc-mod-desc">{mod.description}</p>}
                  
                  <div className="lc-mod-meta">
                    <div className="lc-mod-stat">{mod.challenge_count} Challenges</div>
                    <div className="lc-mod-stat">{mod.total_xp} XP</div>
                  </div>

                  {!mod.is_locked && (
                    <div className="lc-mod-pbar">
                      <div className="lc-mod-pfill" style={{ width: `${modPct}%` }} />
                    </div>
                  )}
                  
                  {earnedBadge && (
                     <div className="lc-mod-earned-badge">
                        {mod.badge.image_url ? (
                           <img src={mod.badge.image_url} alt={mod.badge.name} className="lc-badge-chip-img" />
                        ) : '🏆'}
                        <span>Earned!</span>
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
                  onClick={() => navigate(`/labs/${slug}/modules/${nextCh.moduleId}/level/${nextCh.level_number}`)}>
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
