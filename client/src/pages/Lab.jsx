import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import Header from '../components/Header'
import Footer from '../components/Footer'

function ChallengeCard({ challenge, isUnlocked }) {
  return (
    <div className={`level-card ${isUnlocked ? '' : 'locked'}`} style={{ opacity: isUnlocked ? 1 : 0.6, pointerEvents: isUnlocked ? 'auto' : 'none', position: 'relative' }}>
      {!isUnlocked && (
        <div style={{ position: 'absolute', top: '16px', right: '16px', color: 'var(--text-3)' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
      )}
      <div className="level-card-header">
        <span className="level-badge" style={{ background: isUnlocked ? 'var(--brand-glow)' : 'rgba(255,255,255,0.05)', color: isUnlocked ? 'var(--brand-light)' : 'var(--text-3)', borderColor: isUnlocked ? 'var(--brand-border)' : 'var(--border-md)' }}>
          Challenge {challenge.order_number}
        </span>
      </div>

      <h2 className="level-title" style={{ marginTop: '8px', color: isUnlocked ? 'var(--text-1)' : 'var(--text-2)' }}>{challenge.title}</h2>

      {challenge.instructions && (
        <p className="level-hint" style={{ marginTop: '12px', background: 'transparent', border: 'none', padding: 0 }}>
          {challenge.instructions.length > 80 ? challenge.instructions.replace(/<[^>]+>/g, '').slice(0, 80) + '...' : challenge.instructions.replace(/<[^>]+>/g, '')}
        </p>
      )}

      <div className="level-card-footer" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
        <Link to={`/workspace?challenge=${challenge.id}`} className="btn-start-level" style={{ opacity: isUnlocked ? 1 : 0.5 }}>
          {isUnlocked ? 'Start Challenge →' : 'Locked'}
        </Link>
      </div>
    </div>
  )
}

function ModuleSection({ module, isUnlocked, moduleIndex }) {
  return (
    <div style={{ marginBottom: '40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
        <div style={{ 
          width: '36px', height: '36px', borderRadius: '8px',
          background: isUnlocked ? 'var(--brand-glow)' : 'rgba(255,255,255,0.05)', 
          border: `1px solid ${isUnlocked ? 'var(--brand-border)' : 'var(--border-md)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: isUnlocked ? 'var(--brand-light)' : 'var(--text-3)',
          fontWeight: 'bold', fontSize: '1.1rem'
        }}>
          {module.order_number}
        </div>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: '700', color: isUnlocked ? 'var(--text-1)' : 'var(--text-2)' }}>
            {module.title} {!isUnlocked && <span style={{ fontSize: '0.8rem', fontWeight: '500', color: 'var(--text-3)', marginLeft: '8px', padding: '2px 8px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>Locked</span>}
          </h2>
          {module.description && <p style={{ fontSize: '0.85rem', color: 'var(--text-3)', marginTop: '4px' }}>{module.description}</p>}
        </div>
      </div>

      <div className="levels-grid" style={{ paddingLeft: '20px', borderLeft: `2px dashed ${isUnlocked ? 'var(--brand-border)' : 'var(--border-md)'}` }}>
        {module.challenges.length === 0 ? (
          <p style={{ color: 'var(--text-3)', fontSize: '0.85rem' }}>No challenges in this module yet.</p>
        ) : (
          module.challenges.map((challenge, challengeIndex) => {
            // Logic: first challenge of first module is unlocked. Everything else is locked.
            const isChallengeUnlocked = isUnlocked && challengeIndex === 0;
            return <ChallengeCard key={challenge.id} challenge={challenge} isUnlocked={isChallengeUnlocked} />
          })
        )}
      </div>
    </div>
  )
}

export default function Lab() {
  const { labId } = useParams()
  const [modules, setModules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch(`/api/labs/${labId}/modules`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(data => { setModules(data); setLoading(false) })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [labId])

  return (
    <div className="page">
      <Header />
      <main className="app-main">

        <div className="section-header">
          <div>
            <Link to="/labs" style={{ color: 'var(--brand-light)', fontSize: '0.85rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              Back to Labs
            </Link>
            <h1 className="section-title">Lab Modules</h1>
            <p className="section-sub">Complete challenges to unlock the next modules.</p>
          </div>
        </div>

        {loading && (
          <div className="state-box">
            <div className="spinner" />
            <p>Decrypting lab modules…</p>
          </div>
        )}

        {error && (
          <div className="state-box error">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p>Could not load modules: <code>{error}</code></p>
          </div>
        )}

        {!loading && !error && modules.length === 0 && (
          <div className="state-box">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
            </svg>
            <p>No modules available for this lab yet.</p>
          </div>
        )}

        {!loading && !error && modules.length > 0 && (
          <div>
            {modules.map((module, index) => {
              // Logic: only the first module is unlocked.
              const isModuleUnlocked = index === 0;
              return (
                <ModuleSection 
                  key={module.id} 
                  module={module} 
                  moduleIndex={index} 
                  isUnlocked={isModuleUnlocked} 
                />
              )
            })}
          </div>
        )}

      </main>
      <Footer />
    </div>
  )
}
