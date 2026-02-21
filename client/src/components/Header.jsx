import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import AuthModal from './AuthModal'

export default function Header() {
  const { pathname } = useLocation()
  const [modal, setModal] = useState(null) // null | 'login' | 'register'

  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <Link to="/" className="header-brand">
            <span className="brand-hex">{'</'}</span>
            <span className="brand-name">Campus<span className="brand-accent">404</span></span>
          </Link>

          <nav className="header-nav">
            <Link
              to="/levels"
              className={`nav-link ${pathname === '/levels' ? 'active' : ''}`}
            >
              Challenges
            </Link>
            <Link
              to="/dashboard"
              className={`nav-link ${pathname === '/dashboard' ? 'active' : ''}`}
            >
              Dashboard
            </Link>
          </nav>

          <div className="header-actions">
            <button className="btn-ghost-sm" onClick={() => setModal('login')}>Log In</button>
            <button className="btn-orange-sm" onClick={() => setModal('register')}>Register</button>
          </div>
        </div>
      </header>

      {modal && (
        <AuthModal
          defaultTab={modal}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}
