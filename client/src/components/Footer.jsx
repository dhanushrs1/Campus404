import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <span className="brand-hex">{'</'}</span>
          <span className="brand-name">Campus<span className="brand-accent">404</span></span>
          <p className="footer-tagline">Learn by fixing bugs.</p>
        </div>

        <div className="footer-links">
          <div className="footer-col">
            <span className="footer-col-title">Platform</span>
            <Link to="/levels">Challenges</Link>
            <Link to="/dashboard">Dashboard</Link>
          </div>
          <div className="footer-col">
            <span className="footer-col-title">Account</span>
            <Link to="/login">Log In</Link>
            <Link to="/register">Register</Link>
          </div>
          <div className="footer-col">
            <span className="footer-col-title">Built with</span>
            <span className="footer-tech">FastAPI · React · MySQL</span>
            <span className="footer-tech">Docker · Nginx · Judge0</span>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Campus404. All rights reserved.</span>
      </div>
    </footer>
  )
}
