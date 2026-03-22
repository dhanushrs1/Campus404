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
  71: 'Python 3', 63: 'JavaScript', 62: 'Java', 54: 'C++', 50: 'C',
  60: 'Go', 72: 'Ruby', 73: 'Rust', 74: 'TypeScript', 82: 'SQL', 0: 'HTML/CSS/JS',
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

/* ── Fallback Building SVG (if no isometric image is uploaded) ──────── */
const FallbackBuilding = ({ color }) => (
  <svg className="le-fallback-svg" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="40" y="60" width="120" height="120" rx="12" fill={color + '18'} stroke={color + '44'} strokeWidth="2"/>
    <rect x="60" y="40" width="80" height="40" rx="8" fill={color + '22'} stroke={color + '55'} strokeWidth="2"/>
    <rect x="70" y="100" width="24" height="30" rx="4" fill={color + '30'}/>
    <rect x="106" y="100" width="24" height="30" rx="4" fill={color + '30'}/>
    <rect x="85" y="145" width="30" height="35" rx="4" fill={color + '40'}/>
    <circle cx="100" cy="24" r="12" fill={color + '33'} stroke={color + '55'} strokeWidth="2"/>
    <line x1="100" y1="12" x2="100" y2="6" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    <line x1="90" y1="18" x2="85" y2="13" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="110" y1="18" x2="115" y2="13" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export default function LabsExplorer() {
  const navigate = useNavigate();
  const [labs, setLabs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/labs?published_only=true`, { headers: authH() })
      .then(r => { if (!r.ok) throw new Error('Failed to load labs'); return r.json(); })
      .then(data => setLabs(data.items || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="le-page">
      <Header />

      {/* ── Hero Section ──────────────────────────────────── */}
      <section className="le-hero">
        <div className="le-hero-inner">
          <span className="le-hero-pill">🧪 Labs</span>
          <h1 className="le-hero-title">
            Explore <span className="le-hero-accent">Labs</span>
          </h1>
          <p className="le-hero-desc">
            Hands-on coding labs with real challenges. Pick a lab, solve problems, earn XP.
          </p>
        </div>
      </section>

      {/* ── Grid ──────────────────────────────────────────── */}
      <main className="le-main">
        {loading ? (
          <div className="le-state">
            <div className="le-spinner" />
            <p>Loading labs…</p>
          </div>
        ) : error ? (
          <div className="le-state le-state-error">
            <p>⚠️ {error}</p>
          </div>
        ) : labs.length === 0 ? (
          <div className="le-state">
            <p>No labs available yet. Check back soon!</p>
          </div>
        ) : (
          <div className="le-grid">
            {labs.map(lab => {
              const langLabel = LANG_LABELS[lab.language_id] || `Lang ${lab.language_id}`;
              const langColor = LANG_COLORS[lab.language_id] || '#888';
              const isoSrc = resolveIsoUrl(lab);

              return (
                <button
                  key={lab.id}
                  className="le-card"
                  onClick={() => navigate(`/labs/${lab.slug}`)}
                >
                  {/* Isometric image area */}
                  <div className="le-card-image">
                    {isoSrc ? (
                      <img src={isoSrc} alt={lab.title} className="le-iso-img" />
                    ) : (
                      <FallbackBuilding color={langColor} />
                    )}
                  </div>

                  {/* Info card below */}
                  <div className="le-card-info">
                    <span className="le-lang-badge" style={{ background: langColor + '18', color: langColor, borderColor: langColor + '40' }}>
                      {langLabel}
                    </span>
                    <h3 className="le-card-title">{lab.title}</h3>
                    {lab.description && (
                      <p className="le-card-desc">{lab.description}</p>
                    )}
                    <div className="le-card-meta">
                      <span><strong>{lab.module_count}</strong> modules</span>
                      <span className="le-dot">·</span>
                      <span><strong>{lab.total_xp}</strong> XP</span>
                    </div>
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
