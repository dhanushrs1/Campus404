import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Header from '../components/Header'
import Footer from '../components/Footer'

function LabCard({ lab }) {
  return (
    <Link to={`/labs/${lab.id}`} className="level-card" style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className="level-card-header">
        <span className="level-badge">Lab {lab.id}</span>
        <span className="level-order">#{lab.order_number}</span>
      </div>

      <h2 className="level-title" style={{ marginTop: '8px' }}>{lab.name}</h2>

      {lab.description && (
        <p className="level-hint" style={{ marginTop: '12px' }}>
          {lab.description.length > 120 ? lab.description.slice(0, 120) + '...' : lab.description}
        </p>
      )}

      <div className="level-card-footer" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
        <span className="btn-start-level" style={{ opacity: 1, padding: '8px 16px' }}>
          Explore Lab →
        </span>
      </div>
    </Link>
  )
}

export default function Labs() {
  const [labs, setLabs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/labs')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(data => { setLabs(data); setLoading(false) })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [])

  return (
    <div className="page">
      <Header />
      <main className="app-main">

        <div className="section-header">
          <div>
            <h1 className="section-title">Labs</h1>
            <p className="section-sub">Choose a lab to begin your mission.</p>
          </div>
          {!loading && !error && (
            <span className="level-count">{labs.length} labs</span>
          )}
        </div>

        {loading && (
          <div className="state-box">
            <div className="spinner" />
            <p>Scanning for active labs…</p>
          </div>
        )}

        {error && (
          <div className="state-box error">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p>Could not load labs: <code>{error}</code></p>
          </div>
        )}

        {!loading && !error && labs.length === 0 && (
          <div className="state-box">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
            </svg>
            <p>No labs available yet.</p>
          </div>
        )}

        {!loading && !error && labs.length > 0 && (
          <div className="levels-grid">
            {labs.map(lab => (
              <LabCard key={lab.id} lab={lab} />
            ))}
          </div>
        )}

      </main>
      <Footer />
    </div>
  )
}
