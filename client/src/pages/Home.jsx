import { useState } from 'react'
import Header from '../components/Header'
import Footer from '../components/Footer'
import AuthModal from '../components/AuthModal'

export default function Home() {
  const [modal, setModal] = useState(null)

  return (
    <div className="page">
      <Header />
      <main className="home-main">

        {/* Hero */}
        <section className="hero">
          <div className="hero-pill">🚀 Launching Soon</div>
          <h1 className="hero-title">
            Level Up Your Skills<br />
            <span className="hero-highlight">by Fixing Real Bugs</span>
          </h1>
          <p className="hero-desc">
            Campus404 is a gamified coding platform where you learn by debugging
            broken code — not reading passive tutorials. Real challenges.
            Real satisfaction.
          </p>
          <div className="hero-cta">
            <button className="btn-primary-lg" onClick={() => setModal('register')}>
              Get Early Access
            </button>
            <button className="btn-ghost-lg" onClick={() => setModal('login')}>
              Log In →
            </button>
          </div>
        </section>

        {/* Coming Soon Banner */}
        <section className="coming-soon-banner">
          <div className="cs-inner">
            <div className="cs-icon">⚙️</div>
            <div>
              <h2 className="cs-title">Full Platform Coming Soon</h2>
              <p className="cs-sub">
                The interactive map, leaderboard, and full gamification loop
                are under active development. Register now to join the waitlist.
              </p>
            </div>
            <button className="btn-orange-lg" onClick={() => setModal('register')}>
              Join Waitlist
            </button>
          </div>
        </section>

        {/* Feature highlights */}
        <section className="features-grid">
          {[
            { icon: '🐛', title: 'Debug-First Learning', desc: 'Every level gives you broken code. Your job is to fix it — the best way to actually understand code.' },
            { icon: '🗺️', title: 'Explore an Isometric Map', desc: 'Navigate a visual world where each zone is a lab, and each building is a challenge. Coming soon.' },
            { icon: '⚡', title: 'Instant Execution', desc: 'Code runs in a sandboxed Judge0 environment — no setup, no config, just fix and submit.' },
            { icon: '🏅', title: 'Earn XP & Badges', desc: 'Complete levels to earn XP. Unlock badges as you master different areas of programming.' },
          ].map(f => (
            <div key={f.title} className="feature-card">
              <div className="feature-icon">{f.icon}</div>
              <h3 className="feature-title">{f.title}</h3>
              <p className="feature-desc">{f.desc}</p>
            </div>
          ))}
        </section>

      </main>
      <Footer />

      {modal && <AuthModal defaultTab={modal} onClose={() => setModal(null)} />}
    </div>
  )
}
