import React from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header/Header';
import Footer from '../components/Footer/Footer';
import './Home.css';

/* ── Inline SVG icons (no dependency) ────────────────────── */
const Icons = {
  Flask: () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2v7.31"/><path d="M14 9.3V1.99"/><path d="M8.5 2h7"/><path d="M14 9.3a6.5 6.5 0 1 1-4 0"/><path d="M5.52 16h12.96"/>
    </svg>
  ),
  Code: () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
    </svg>
  ),
  Trophy: () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
    </svg>
  ),
  Map: () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>
    </svg>
  ),
  Terminal: () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
    </svg>
  ),
  Users: () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  Arrow: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
    </svg>
  ),
};

const FEATURES = [
  {
    icon: 'Flask',
    title: 'Interactive Labs',
    desc: 'Hands-on coding labs with real-world challenges. Write, run, and test code directly in your browser.',
    color: '#3b82f6',
  },
  {
    icon: 'Code',
    title: 'Progressive Challenges',
    desc: 'Level up through increasingly complex problems. Each challenge builds on what you have already learned.',
    color: '#8b5cf6',
  },
  {
    icon: 'Trophy',
    title: 'Badges & XP',
    desc: 'Earn experience points and unlock badges as you complete modules. Track your growth over time.',
    color: '#f59e0b',
  },
  {
    icon: 'Map',
    title: 'Structured Roadmaps',
    desc: 'Follow curated learning paths designed by experienced developers. No more tutorial rabbit holes.',
    color: '#059669',
  },
  {
    icon: 'Terminal',
    title: 'Sandbox Playground',
    desc: 'Free coding playground with 40+ languages. Experiment, prototype, and break things safely.',
    color: '#ef4444',
  },
  {
    icon: 'Users',
    title: 'Active Community',
    desc: 'Join discussions, share solutions, and learn from peers on the leaderboard. You are never coding alone.',
    color: '#06b6d4',
  },
];

const LANGUAGES = ['Python', 'JavaScript', 'Java', 'C++', 'Go', 'Rust', 'TypeScript', 'Ruby', 'SQL'];

export default function Home() {
  const isLoggedIn = !!localStorage.getItem('token');

  return (
    <div className="hp-page">
      <Header />

      {/* HERO */}
      <section className="hp-hero">
        <div className="hp-hero-glow" />
        <div className="hp-hero-inner">
          <span className="hp-hero-pill">🚀 The platform for serious developers</span>
          <h1 className="hp-hero-title">
            Code. Learn.<br />
            <span className="hp-hero-accent">Level Up.</span>
          </h1>
          <p className="hp-hero-desc">
            Master programming through hands-on labs, progressive challenges, and structured
            roadmaps. Earn XP, collect badges, and track your growth &mdash; all in one place.
          </p>
          <div className="hp-hero-cta">
            {isLoggedIn ? (
              <>
                <Link to="/labs" className="hp-btn-primary">Explore Labs <Icons.Arrow /></Link>
                <Link to="/dashboard" className="hp-btn-ghost">My Dashboard</Link>
              </>
            ) : (
              <>
                <Link to="/register" className="hp-btn-primary">Start for Free <Icons.Arrow /></Link>
                <Link to="/login" className="hp-btn-ghost">Log In</Link>
              </>
            )}
          </div>
          <div className="hp-hero-langs">
            {LANGUAGES.map(lang => (
              <span key={lang} className="hp-lang-chip">{lang}</span>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="hp-section">
        <div className="hp-section-inner">
          <div className="hp-section-header">
            <span className="hp-section-pill">&#10024; Features</span>
            <h2 className="hp-section-title">Everything you need to grow</h2>
            <p className="hp-section-desc">
              A complete learning ecosystem designed to take you from beginner to job-ready.
            </p>
          </div>
          <div className="hp-features-grid">
            {FEATURES.map(f => {
              const Icon = Icons[f.icon];
              return (
                <div key={f.title} className="hp-feature-card">
                  <div className="hp-feature-icon" style={{ background: f.color + '12', color: f.color }}>
                    <Icon />
                  </div>
                  <h3 className="hp-feature-title">{f.title}</h3>
                  <p className="hp-feature-desc">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="hp-section hp-section-alt">
        <div className="hp-section-inner">
          <div className="hp-section-header">
            <span className="hp-section-pill">&#128203; How it works</span>
            <h2 className="hp-section-title">Three steps to mastery</h2>
          </div>
          <div className="hp-steps">
            <div className="hp-step">
              <div className="hp-step-num">1</div>
              <h3>Pick a Lab</h3>
              <p>Choose from labs in Python, JavaScript, Java, and more. Each lab has structured modules with progressive difficulty.</p>
            </div>
            <div className="hp-step-line" />
            <div className="hp-step">
              <div className="hp-step-num">2</div>
              <h3>Solve Challenges</h3>
              <p>Write code in our in-browser editor, run it against test cases, and earn XP for every challenge you complete.</p>
            </div>
            <div className="hp-step-line" />
            <div className="hp-step">
              <div className="hp-step-num">3</div>
              <h3>Earn &amp; Grow</h3>
              <p>Unlock badges, climb the leaderboard, and build a portfolio of completed challenges that proves your skills.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA BANNER */}
      <section className="hp-cta-section">
        <div className="hp-cta-inner">
          <h2 className="hp-cta-title">Ready to start coding?</h2>
          <p className="hp-cta-desc">
            Join thousands of developers building real skills through hands-on practice.
          </p>
          <div className="hp-cta-buttons">
            {isLoggedIn ? (
              <Link to="/labs" className="hp-btn-primary hp-btn-lg">Browse Labs <Icons.Arrow /></Link>
            ) : (
              <>
                <Link to="/register" className="hp-btn-primary hp-btn-lg">Create Free Account <Icons.Arrow /></Link>
                <Link to="/login" className="hp-btn-ghost hp-btn-lg">Already have an account?</Link>
              </>
            )}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
