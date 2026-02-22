import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Header from '../components/Header'
import Footer from '../components/Footer'

function LevelCard({ level }) {
  return (
    <div className="level-card">
      <div className="level-card-header">
        <span className="level-badge">Lab {level.lab_id}</span>
        <span className="level-order">#{level.order_number}</span>
      </div>

      <h2 className="level-title">{level.title}</h2>

      {level.broken_code && (
        <pre className="level-code">
          <code>
            {level.broken_code.length > 160
              ? level.broken_code.slice(0, 160) + '\n…'
              : level.broken_code}
          </code>
        </pre>
      )}

      {level.hint_text && (
        <p className="level-hint">
          <span className="hint-icon">💡</span> {level.hint_text}
        </p>
      )}

      <div className="level-card-footer">
        {level.repo_link ? (
          <a
            href={level.repo_link}
            target="_blank"
            rel="noreferrer"
            className="level-repo-link"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            View Repo
          </a>
        ) : (
          <span className="level-repo-locked">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            Unlocks after 5 failed attempts
          </span>
        )}

        <Link to={`/workspace?challenge=${level.id}`} className="btn-start-level" style={{ display: 'inline-block', textAlign: 'center', textDecoration: 'none' }}>
          Start Challenge →
        </Link>
      </div>
    </div>
  )
}

export default function Levels() {
  const [levels, setLevels] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/levels')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(data => { setLevels(data); setLoading(false) })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [])

  return (
    <div className="page">
      <Header />
      <main className="app-main">

        <div className="section-header">
          <div>
            <h1 className="section-title">Challenges</h1>
            <p className="section-sub">Debug broken code. Earn XP. Level up.</p>
          </div>
          {!loading && !error && (
            <span className="level-count">{levels.length} levels</span>
          )}
        </div>

        {loading && (
          <div className="state-box">
            <div className="spinner" />
            <p>Loading challenges…</p>
          </div>
        )}

        {error && (
          <div className="state-box error">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p>Could not load levels: <code>{error}</code></p>
          </div>
        )}

        {!loading && !error && levels.length === 0 && (
          <div className="state-box">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
            </svg>
            <p>No challenges published yet.</p>
            <Link to="/admin" style={{fontSize:'0.8rem',opacity:0.5}}>Add levels in the admin panel →</Link>
          </div>
        )}

        {!loading && !error && levels.length > 0 && (
          <div className="levels-grid">
            {levels.map(level => (
              <LevelCard key={level.id} level={level} />
            ))}
          </div>
        )}

      </main>
      <Footer />
    </div>
  )
}
