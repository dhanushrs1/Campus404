import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header/Header';
import Footer from '../../components/Footer/Footer';
import { API_URL } from '../../config';
import { resolveAssetUrl } from '../../utils/siteSettings';
import './LabsExplorer.css';

const token = () => localStorage.getItem('token');
const authH = () => ({ Authorization: `Bearer ${token()}` });

const LANG_LABELS = {
  71: 'Python', 63: 'JavaScript', 62: 'Java', 54: 'C++', 50: 'C',
  60: 'Go', 72: 'Ruby', 73: 'Rust', 74: 'TypeScript', 82: 'SQL', 0: 'Web',
};
const LANG_COLORS = {
  71: '#3b82f6', 63: '#f59e0b', 62: '#ef4444', 54: '#8b5cf6', 50: '#6b7280',
  60: '#06b6d4', 72: '#e11d48', 74: '#60a5fa', 82: '#059669', 0: '#f97316',
};

const resolveIsoUrl = (lab) => {
  if (lab.isometric_image_url) return resolveAssetUrl(lab.isometric_image_url) || lab.isometric_image_url;
  if (lab.isometric_image_path) return `/uploads/${lab.isometric_image_path.replace(/^\/+/, '')}`;
  return null;
};

/* Circular Progress Ring */
const ProgressRing = ({ pct, color, size = 56, stroke = 4 }) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg className="le-progress-ring" width={size} height={size}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.8s ease', transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
        className="le-ring-text" fill={color}>{Math.round(pct)}%</text>
    </svg>
  );
};

/* Fallback Building SVG */
const FallbackBuilding = ({ color }) => (
  <svg className="le-fallback-svg" viewBox="0 0 200 200" fill="none">
    <rect x="40" y="60" width="120" height="120" rx="12" fill={color + '18'} stroke={color + '44'} strokeWidth="2"/>
    <rect x="60" y="40" width="80" height="40" rx="8" fill={color + '22'} stroke={color + '55'} strokeWidth="2"/>
    <rect x="70" y="100" width="24" height="30" rx="4" fill={color + '30'}/>
    <rect x="106" y="100" width="24" height="30" rx="4" fill={color + '30'}/>
    <rect x="85" y="145" width="30" height="35" rx="4" fill={color + '40'}/>
    <circle cx="100" cy="24" r="12" fill={color + '33'} stroke={color + '55'} strokeWidth="2"/>
  </svg>
);

export default function LabsExplorer() {
  const navigate = useNavigate();
  const [labs, setLabs]           = useState([]);
  const [progress, setProgress]   = useState({});
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [userStats, setUserStats] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const labsRes = await fetch(`${API_URL}/labs?published_only=true`, { headers: authH() });
        if (!labsRes.ok) throw new Error('Failed to load labs');
        const labsData = await labsRes.json();
        const labsList = labsData.items || [];
        setLabs(labsList);

        // Fetch user stats
        try {
          const statsRes = await fetch(`${API_URL}/progress/me/stats`, { headers: authH() });
          if (statsRes.ok) setUserStats(await statsRes.json());
        } catch (_) { /* optional */ }

        // Fetch progress for each lab
        const progressMap = {};
        await Promise.allSettled(
          labsList.map(async (lab) => {
            try {
              const res = await fetch(`${API_URL}/progress/labs/${lab.slug}/progress`, { headers: authH() });
              if (res.ok) {
                const data = await res.json();
                progressMap[lab.slug] = {
                  earned_xp: data.earned_xp || 0,
                  total_xp: data.total_xp || 0,
                  pct: data.total_xp > 0 ? Math.round((data.earned_xp / data.total_xp) * 100) : 0,
                  modules_completed: (data.modules || []).filter(m => m.is_completed).length,
                  modules_total: (data.modules || []).length,
                };
              }
            } catch (_) { /* silently skip */ }
          })
        );
        setProgress(progressMap);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="le-page">
      <Header />

      {/* ═══ HERO ═══ */}
      <section className="le-hero">
        <img
          src="https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1600&q=80"
          alt="" className="le-hero-bg" aria-hidden="true"
        />
        <div className="le-hero-overlay" />
        <div className="le-hero-content">
          <span className="le-hero-pill">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2v7.31"/><path d="M14 9.3V1.99"/><path d="M8.5 2h7"/><path d="M14 9.3a6.5 6.5 0 1 1-4 0"/></svg>
            Coding Labs
          </span>
          <h1 className="le-hero-title">Choose Your <span className="le-accent">Lab</span></h1>
          <p className="le-hero-desc">
            Pick a lab, solve real challenges, and level up your skills. Track your progress as you go.
          </p>
          {userStats && (
            <div className="le-hero-stats">
              <div className="le-hero-stat">
                <span className="le-hero-stat-val">{userStats.total_xp || 0}</span>
                <span className="le-hero-stat-label">Total XP</span>
              </div>
              <div className="le-hero-stat-sep" />
              <div className="le-hero-stat">
                <span className="le-hero-stat-val">{userStats.completed_challenges || 0}</span>
                <span className="le-hero-stat-label">Solved</span>
              </div>
              <div className="le-hero-stat-sep" />
              <div className="le-hero-stat">
                <span className="le-hero-stat-val">{userStats.current_streak || 0}</span>
                <span className="le-hero-stat-label">Streak</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ═══ LABS GRID ═══ */}
      <main className="le-main">
        {loading ? (
          <div className="le-state"><div className="le-spinner" /><p>Loading labs...</p></div>
        ) : error ? (
          <div className="le-state le-state-error"><p>{error}</p></div>
        ) : labs.length === 0 ? (
          <div className="le-state"><p>No labs available yet. Check back soon!</p></div>
        ) : (
          <div className="le-grid">
            {labs.map(lab => {
              const langLabel = LANG_LABELS[lab.language_id] || `Lang ${lab.language_id}`;
              const langColor = LANG_COLORS[lab.language_id] || '#888';
              const isoSrc = resolveIsoUrl(lab);
              const prog = progress[lab.slug];
              const pct = prog ? prog.pct : 0;
              const isStarted = pct > 0;
              const isComplete = pct >= 100;

              return (
                <button key={lab.id} className={`le-card ${isComplete ? 'completed' : ''}`}
                  onClick={() => navigate(`/labs/${lab.slug}`)}>

                  {/* Status badge */}
                  {isComplete && <span className="le-status-badge le-completed-badge">Completed</span>}
                  {isStarted && !isComplete && <span className="le-status-badge le-progress-badge">In Progress</span>}

                  {/* Isometric image - floats above the card */}
                  <div className="le-card-image">
                    {isoSrc ? (
                      <img src={isoSrc} alt={lab.title} className="le-iso-img" />
                    ) : (
                      <FallbackBuilding color={langColor} />
                    )}
                  </div>

                  {/* Info section */}
                  <div className="le-card-body">
                    <span className="le-lang-badge" style={{ background: langColor + '10', color: langColor, borderColor: langColor + '25' }}>
                      {langLabel}
                    </span>
                    <h3 className="le-card-title">{lab.title}</h3>
                    {lab.description && <p className="le-card-desc">{lab.description}</p>}

                    {/* Stats box (First image standard style) */}
                    <div className="le-card-stats">
                      <span className="le-card-stat">{lab.module_count || 0} modules</span>
                      <span className="le-card-stat-sep">&middot;</span>
                      <span className="le-card-stat">{lab.total_xp || 0} XP</span>
                    </div>

                    {/* Progress area */}
                    {prog && (
                      <div className="le-card-progress">
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <span className="le-card-xp-text">{prog.earned_xp} / {prog.total_xp} XP</span>
                          <div className="le-card-xp-bar">
                            <div className="le-card-xp-fill" style={{ width: `${pct}%`, background: isComplete ? '#10b981' : langColor }} />
                          </div>
                        </div>
                        <div className="le-progress-ring-wrap">
                          <ProgressRing pct={pct} color={isComplete ? '#10b981' : langColor} size={42} stroke={4} />
                        </div>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
