import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../../components/Header/Header';
import Footer from '../../components/Footer/Footer';
import './LabCurriculum.css'; // Reusing some base styles
import './ModuleCurriculum.css';

const token = () => localStorage.getItem('token');
const authH = () => ({ Authorization: `Bearer ${token()}` });

export default function ModuleCurriculum() {
  const { slug, moduleId } = useParams();
  const navigate = useNavigate();
  const [lab, setLab] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`/api/labs/${slug}/progress`, { headers: authH() })
      .then(r => {
        if (!r.ok) throw new Error('Lab not found');
        return r.json();
      })
      .then(data => setLab(data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return (
    <div className="lc-loading">
      <div className="lc-loading-ring" />
      <p>Loading module map...</p>
    </div>
  );
  
  if (error || !lab) return (
    <div className="lc-error">
      <h2>Oops — {error || 'Module not found'}</h2>
      <button onClick={() => navigate('/dashboard')}>← Go back</button>
    </div>
  );

  const mod = lab.modules.find(m => m.module_id === parseInt(moduleId));

  if (!mod) return (
    <div className="lc-error">
      <h2>Module not found in this curriculum.</h2>
      <button onClick={() => navigate(`/labs/${slug}`)}>← Back to Course</button>
    </div>
  );

  return (
    <div className="mc-page">
      <Header />
      
      <div className="mc-header">
        <button className="mc-back-btn" onClick={() => navigate(`/labs/${slug}`)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          Back to Curriculum
        </button>
        <div className="mc-title-box">
          <h1 className="mc-title">{mod.title}</h1>
          {mod.description && <p className="mc-desc">{mod.description}</p>}
        </div>
      </div>

      <div className="mc-body">
        <div className="lc-gamified-path mc-map-container" style={{ display: 'block', borderTop: 'none', background: '#fff' }}>
          {(() => {
            const NODE_HEIGHT = 130;
            const CYCLE = [60, -60]; // Zigzag alternates right and left
            const points = mod.challenges.map((c, i) => ({
              x: CYCLE[i % CYCLE.length],
              y: i * NODE_HEIGHT + (NODE_HEIGHT / 2)
            }));
            
            let pathD = '';
            if (points.length > 0) {
              pathD = `M ${points[0].x} ${points[0].y}`;
              for (let i = 1; i < points.length; i++) {
                pathD += ` L ${points[i].x} ${points[i].y}`;
              }
            }

            let lastActiveIdx = mod.challenges.findIndex(c => !c.is_completed && !c.is_locked);
            if (lastActiveIdx === -1) lastActiveIdx = mod.challenges.length - 1;

            const activePoints = points.slice(0, lastActiveIdx + 1);
            let pathD_active = '';
            if (activePoints.length > 0) {
              pathD_active = `M ${activePoints[0].x} ${activePoints[0].y}`;
              for (let i = 1; i < activePoints.length; i++) {
                pathD_active += ` L ${activePoints[i].x} ${activePoints[i].y}`;
              }
            }

            return (
              <div className="lc-game-board" style={{ height: mod.challenges.length * NODE_HEIGHT }}>
                {/* Path background */}
                <svg className="lc-game-svg" viewBox={`-200 0 400 ${mod.challenges.length * NODE_HEIGHT}`}>
                  <path d={pathD} stroke="#e5e5e5" strokeWidth="20" fill="none" strokeDasharray="0 24" strokeLinecap="round" strokeLinejoin="round" />
                  <path d={pathD_active} stroke="#003acc" strokeWidth="20" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>

                {/* Nodes */}
                <div className="lc-game-nodes">
                  {mod.challenges.map((ch, ci) => {
                    const uniqueUrl = `/labs/${slug}/modules/${mod.module_id}/level/${ch.level_number}`;
                    const p = points[ci];
                    const isCurrent = ci === lastActiveIdx;
                    const isLast = ci === mod.challenges.length - 1;

                    return (
                      <div 
                        key={ch.challenge_id} 
                        className={`lc-game-node-wrap ${ch.is_completed ? 'completed' : ''} ${ch.is_locked ? 'locked' : ''} ${isCurrent ? 'current' : ''} ${p.x < 0 ? 'pos-left' : 'pos-right'}`}
                        style={{ top: p.y, left: `calc(50% + ${p.x}px)` }}
                      >
                        <button 
                          className={`lc-game-node-btn ${isLast ? 'final-node' : ''}`} 
                          onClick={() => !ch.is_locked && navigate(uniqueUrl)}
                          disabled={ch.is_locked}
                        >
                          {ch.is_completed ? (
                            isLast ? (
                              <span style={{ fontSize: '1.8rem' }}>👑</span>
                            ) : (
                              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                            )
                          ) : (
                            isLast ? (
                              <span style={{ fontSize: '1.8rem', opacity: ch.is_locked ? 0.3 : 1, filter: ch.is_locked ? 'grayscale(100%)' : 'none' }}>👑</span>
                            ) : (
                              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                            )
                          )}

                          {/* External Locked Badge */}
                          {ch.is_locked && (
                            <div className="lc-gn-ext-lock">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zm-7 6c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/><path d="M7 11V7c0-2.76 2.24-5 5-5s5 2.24 5 5v4h-2V7c0-1.66-1.34-3-3-3S7 5.34 7 7v4H7z"/></svg>
                            </div>
                          )}
                        </button>
                        
                        {/* Action Tooltip / Label */}
                        <div className="lc-game-label">
                          <span className="lc-gn-title">{ch.display_title || `Level ${ch.level_number}`}</span>
                          <span className="lc-gn-xp">+{ch.xp_reward} XP</span>
                        </div>
                        
                        {/* Bouncy Floating Start Bubble */}
                        {isCurrent && (
                          <div className="lc-gn-start-bubble" onClick={() => navigate(uniqueUrl)}>
                            <span className="lc-gn-bubble-text">START</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Module completed state */}
          {mod.is_completed && mod.badge && (
            <div className="lc-module-complete-banner" style={{ margin: '2rem', borderRadius: '16px' }}>
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
      </div>
      <Footer />
    </div>
  );
}