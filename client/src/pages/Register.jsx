import Header from '../components/Header'
import Footer from '../components/Footer'
import { Link } from 'react-router-dom'

export default function Register() {
  function handleSubmit(e) {
    e.preventDefault()
    // TODO: POST /api/auth/register → auto-login → redirect to /dashboard
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
          <h1 className="auth-title">Create account</h1>
          <p className="auth-sub">Join the waitlist and be the first to play.</p>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="field-group">
              <label htmlFor="username">Username</label>
              <input id="username" type="text" placeholder="choose_a_username" autoComplete="username" required />
            </div>
            <div className="field-group">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" placeholder="you@example.com" autoComplete="email" />
            </div>
            <div className="field-group">
              <label htmlFor="password">Password</label>
              <input id="password" type="password" placeholder="min 8 characters" autoComplete="new-password" required />
            </div>
            <button type="submit" className="auth-submit">Create Account</button>
          </form>

          <p className="auth-switch">
            Already have an account? <Link to="/login">Log in →</Link>
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
