import { useState, useEffect, useRef } from 'react'

/* ── Animated matrix rain canvas behind the modal ─────────── */
function MatrixRain({ canvasRef }) {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animId

    const resize = () => {
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const chars = '01{}[]()=></>defclassreturnimportasyncawait'
    const cols  = Math.floor(canvas.width / 18)
    const drops = Array(cols).fill(1)

    const draw = () => {
      ctx.fillStyle = 'rgba(10,10,15,0.18)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.font = '13px JetBrains Mono, monospace'

      drops.forEach((y, i) => {
        const char  = chars[Math.floor(Math.random() * chars.length)]
        const alpha = Math.random() > 0.92 ? 0.9 : 0.18
        ctx.fillStyle = `rgba(255,107,43,${alpha})`
        ctx.fillText(char, i * 18, y * 18)
        if (y * 18 > canvas.height && Math.random() > 0.975) drops[i] = 0
        drops[i]++
      })
      animId = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [canvasRef])

  return null
}

/* ── GitHub icon SVG ──────────────────────────────────────── */
const GithubIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
  </svg>
)

/* ── Field component ──────────────────────────────────────── */
function Field({ id, label, type = 'text', placeholder, icon, autoComplete }) {
  const [show, setShow] = useState(false)
  const isPassword = type === 'password'

  return (
    <div className="am-field">
      <label htmlFor={id}>{label}</label>
      <div className="am-input-wrap">
        <span className="am-field-icon">{icon}</span>
        <input
          id={id}
          type={isPassword && show ? 'text' : type}
          placeholder={placeholder}
          autoComplete={autoComplete}
        />
        {isPassword && (
          <button
            type="button"
            className="am-eye"
            onClick={() => setShow(s => !s)}
            tabIndex={-1}
            aria-label="Toggle password visibility"
          >
            {show ? '🙈' : '👁️'}
          </button>
        )}
      </div>
    </div>
  )
}

/* ── Main AuthModal ───────────────────────────────────────── */
export default function AuthModal({ onClose, defaultTab = 'login' }) {
  const [tab, setTab]       = useState(defaultTab)
  const canvasRef           = useRef(null)

  // Close on Escape
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    // Lock body scroll
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const handleBackdrop = e => {
    if (e.target === e.currentTarget) onClose()
  }

  const handleSubmit = e => {
    e.preventDefault()
    // TODO: integrate with POST /api/auth/login or /api/auth/register
    alert(`${tab === 'login' ? 'Login' : 'Register'} — auth not implemented yet.`)
  }

  const handleGitHub = () => {
    // TODO: redirect to /api/auth/github (OAuth flow)
    alert('GitHub OAuth — not implemented yet.')
  }

  return (
    <div className="am-overlay" onClick={handleBackdrop} role="dialog" aria-modal="true">

      {/* Floating code-rain canvas */}
      <canvas ref={canvasRef} className="am-canvas" aria-hidden="true" />
      <MatrixRain canvasRef={canvasRef} />

      <div className="am-card">

        {/* Close button */}
        <button className="am-close" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        {/* Brand */}
        <div className="am-brand">
          <div className="am-brand-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <polyline points="16 18 22 12 16 6"/>
              <polyline points="8 6 2 12 8 18"/>
            </svg>
          </div>
          <div>
            <div className="am-brand-name">Campus<span>404</span></div>
            <div className="am-brand-tag">Debug. Learn. Level Up.</div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="am-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'login'}
            className={`am-tab ${tab === 'login' ? 'am-tab-active' : ''}`}
            onClick={() => setTab('login')}
          >
            Log In
          </button>
          <button
            role="tab"
            aria-selected={tab === 'register'}
            className={`am-tab ${tab === 'register' ? 'am-tab-active' : ''}`}
            onClick={() => setTab('register')}
          >
            Register
          </button>
          <div
            className="am-tab-slider"
            style={{ transform: tab === 'register' ? 'translateX(100%)' : 'translateX(0)' }}
          />
        </div>

        {/* GitHub OAuth */}
        <button className="am-github" onClick={handleGitHub} type="button">
          <GithubIcon />
          Continue with GitHub
          <span className="am-github-badge">Recommended</span>
        </button>

        {/* Divider */}
        <div className="am-divider"><span>or continue with email</span></div>

        {/* Form */}
        <form className="am-form" onSubmit={handleSubmit}>
          {tab === 'register' && (
            <Field
              id="am-username"
              label="Username"
              type="text"
              placeholder="choose_a_username"
              autoComplete="username"
              icon="⌨️"
            />
          )}

          <Field
            id="am-email"
            label="Email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            icon="✉️"
          />

          <Field
            id="am-password"
            label="Password"
            type="password"
            placeholder={tab === 'register' ? 'min 8 characters' : '••••••••'}
            autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
            icon="🔑"
          />

          {tab === 'register' && (
            <Field
              id="am-confirm"
              label="Confirm Password"
              type="password"
              placeholder="repeat your password"
              autoComplete="new-password"
              icon="🔒"
            />
          )}

          <button className="am-submit" type="submit">
            {tab === 'login' ? (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                  <polyline points="10 17 15 12 10 7"/>
                  <line x1="15" y1="12" x2="3" y2="12"/>
                </svg>
                Enter the Campus
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <line x1="19" y1="8" x2="19" y2="14"/>
                  <line x1="22" y1="11" x2="16" y2="11"/>
                </svg>
                Create My Account
              </>
            )}
          </button>
        </form>

        {/* Footer note */}
        <p className="am-footer-note">
          {tab === 'login'
            ? <>No account? <button className="am-link" onClick={() => setTab('register')}>Register free →</button></>
            : <>Already a member? <button className="am-link" onClick={() => setTab('login')}>Log in →</button></>
          }
        </p>

        {/* Under-construction badge */}
        <div className="am-wip">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
          </svg>
          Auth &amp; GitHub OAuth are under active development
        </div>

      </div>
    </div>
  )
}
