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

const CircularProgress = ({ pct, color }) => {
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="lc-circular-progress-wrap" style={{ width: '64px', height: '64px' }}>
      <svg className="lc-circular-progress" width="100%" height="100%" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="16" fill="transparent" stroke="rgba(255,255,255,0.2)" strokeWidth="3.5" />
        <circle
          cx="20"
          cy="20"
          r="16"
          fill="transparent"
          stroke={color || '#ffffff'}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 20 20)"
          style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
        />
      </svg>
      <div className="lc-circular-text" style={{ fontSize: '1rem' }}>{pct}%</div>
    </div>
  );
};

export default function ChallengeLevels() {
  const { slug, moduleId, challengeId } = useParams();
  const navigate = useNavigate();
  const [lab, setLab] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const heroRef = useRef(null);

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

  useEffect(() => {
    const handleScroll = () => {
      if (heroRef.current) {
        heroRef.current.style.backgroundPositionY = `${window.scrollY * 0.4}px`;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (loading) {
    return (
      <div className="lc-loading">
        <div className="lc-loading-ring" />
        <p>Loading challenge levels...</p>
      </div>
    );
  }

  if (error || !lab) {
    return (
      <div className="lc-error">
        <h2>Oops — {error || 'Challenge not found'}</h2>
        <button onClick={() => navigate('/dashboard')}>← Go back</button>
      </div>
    );
  }

  const mod = lab.modules.find((m) => m.module_id === parseInt(moduleId, 10));
  if (!mod) {
    return (
      <div className="lc-error">
        <h2>Module not found in this curriculum.</h2>
        <button onClick={() => navigate(`/labs/${slug}`)}>← Back to Course</button>
      </div>
    );
  }

  const groups = mod.challenge_groups || [];
  const selectedGroup = groups.find((group) => Number(group.challenge_id) === Number(challengeId));
  if (!selectedGroup) {
    return (
      <div className="lc-error">
        <h2>Challenge not found in this module.</h2>
        <button onClick={() => navigate(`/labs/${slug}/modules/${moduleId}`)}>← Back to Challenges</button>
      </div>
    );
  }

  const heroImg = resolveModuleBannerUrl(mod);
  const levels = selectedGroup.levels || [];
  const pct = selectedGroup.level_count > 0
    ? Math.round((selectedGroup.completed_levels / selectedGroup.level_count) * 100)
    : 0;

  return (
    <div className="mc-page">
      <Header />

      <section
        className={`lc-hero ${!heroImg ? 'lc-hero-no-img' : ''} mc-hero-slim`}
        ref={heroRef}
        style={heroImg ? { backgroundImage: `url(${heroImg})` } : { backgroundColor: '#0A192F' }}
      >
        {heroImg && <div className="lc-hero-overlay" />}
        <div className="lc-hero-content mc-hero-content">
          <button className="mc-back-btn" onClick={() => navigate(`/labs/${slug}/modules/${moduleId}`)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
            Back to Challenges
          </button>

          <div className="lc-hero-top-info" style={{ marginTop: '1.5rem' }}>
            <div>
              <div className="lc-hero-lang" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', borderColor: 'rgba(255,255,255,0.2)' }}>
                {mod.title}
              </div>
              <h1 className="lc-hero-title">{selectedGroup.title}</h1>
              {selectedGroup.description && <p className="lc-hero-desc">{selectedGroup.description}</p>}
              <div className="lc-hero-meta">
                <span><strong>{levels.length}</strong> levels</span>
                <span className="lc-dot">·</span>
                <span><strong>{selectedGroup.total_xp}</strong> XP total</span>
              </div>
            </div>
            <CircularProgress pct={pct} color="#4ade80" />
          </div>
        </div>
      </section>

      <div className="mc-body">
        <div className="mc-map-container">
          <div className="mc-timeline">
            {levels.map((level, index) => {
              const uniqueUrl = `/labs/${slug}/modules/${moduleId}/challenges/${challengeId}/level/${index + 1}`;
              const previous = levels[index - 1];
              const isCurrent = !level.is_completed && !level.is_locked && (!previous || previous.is_completed);

              return (
                <div key={level.challenge_id} className={`mc-timeline-node ${level.is_completed ? 'completed' : ''} ${level.is_locked ? 'locked' : ''} ${isCurrent ? 'current' : ''}`}>
                  <div className="mc-node-line"></div>

                  <div className="mc-node-status">
                    {level.is_completed ? (
                      <div className="mc-status-icon success">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      </div>
                    ) : level.is_locked ? (
                      <div className="mc-status-icon locked">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zm-7 6c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" /><path d="M7 11V7c0-2.76 2.24-5 5-5s5 2.24 5 5v4h-2V7c0-1.66-1.34-3-3-3S7 5.34 7 7v4H7z" /></svg>
                      </div>
                    ) : (
                      <div className="mc-status-icon active">
                        <div className="mc-pulse-dot"></div>
                      </div>
                    )}
                  </div>

                  <div className="mc-node-card" onClick={() => !level.is_locked && navigate(uniqueUrl)}>
                    <div className="mc-node-card-header">
                      <h3>{level.display_title || `Level ${index + 1}`}</h3>
                      <span className="mc-node-xp">+{level.xp_reward} XP</span>
                    </div>
                    {isCurrent && <button className="mc-node-start-btn">Start Level</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
