import Header from '../components/Header'
import Footer from '../components/Footer'
import { Link } from 'react-router-dom'

export default function Login() {
  function handleSubmit(e) {
    e.preventDefault()
    // TODO: POST /api/auth/login → store JWT → redirect to /dashboard
    alert('Auth not implemented yet.')
  }

  return (
    <div className="page">
      <Header />
      <main className="auth-main">
        <div className="auth-card">
          <div className="auth-brand">
            <span className="brand-hex">{'</'}</span>
            <span className="brand-name">Campus<span className="brand-accent">404</span></span>
          </div>
          <h1 className="auth-title">Welcome back</h1>
          <p className="auth-sub">Log in to continue your challenges.</p>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="field-group">
              <label htmlFor="username">Username</label>
              <input id="username" type="text" placeholder="your_username" autoComplete="username" required />
            </div>
            <div className="field-group">
              <label htmlFor="password">Password</label>
              <input id="password" type="password" placeholder="••••••••" autoComplete="current-password" required />
            </div>
            <button type="submit" className="auth-submit">Log In</button>
          </form>

          <p className="auth-switch">
            Don't have an account? <Link to="/register">Register →</Link>
          </p>

          <div className="auth-notice">
            🚧 Authentication is under development.
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
