import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import defaultAvatar from '../../assets/images/avatars/default_avatar.jpg';
import './Header.css';

const MEGA_MENU = [
  {
    label: 'Learn',
    items: [
      { icon: '🧪', title: 'Labs', desc: 'Hands-on coding challenges', href: '/labs' },
      { icon: '📚', title: 'Tracks', desc: 'Structured learning paths', href: '/tracks' },
      { icon: '🗺️', title: 'Roadmaps', desc: 'Tech career maps', href: '/roadmaps' },
      { icon: '🏆', title: 'Contests', desc: 'Timed coding battles', href: '/contests' },
    ],
  },
  {
    label: 'Practice',
    items: [
      { icon: '⚡', title: 'Challenges', desc: 'Daily coding problems', href: '/challenges' },
      { icon: '🎯', title: 'Skill Tests', desc: 'Test your knowledge', href: '/skill-tests' },
      { icon: '🤝', title: 'Peer Review', desc: 'Review others\' code', href: '/peer-review' },
      { icon: '🔬', title: 'Sandbox', desc: 'Free coding playground', href: '/sandbox' },
    ],
  },
  {
    label: 'Community',
    items: [
      { icon: '💬', title: 'Discussions', desc: 'Ask & share knowledge', href: '/discussions' },
      { icon: '🏅', title: 'Leaderboard', desc: 'Top campus coders', href: '/leaderboard' },
      { icon: '👤', title: 'Profile', desc: 'Your coding journey', href: '/profile' },
      { icon: '🎓', title: 'Mentors', desc: 'Learn from the best', href: '/mentors' },
    ],
  },
];

const DEMO_NOTIFICATIONS = [
  { id: 1, icon: '🏆', title: 'New badge earned!', body: 'You earned the "First Lab" badge.', time: '2m ago', unread: true },
  { id: 2, icon: '💬', title: 'Someone replied', body: 'John replied to your discussion.', time: '15m ago', unread: true },
  { id: 3, icon: '⚡', title: 'Daily challenge ready', body: 'Today\'s challenge is live. Go solve it!', time: '1h ago', unread: false },
];

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');
  const isLoggedIn = !!token;
  const isAdmin = role === 'admin';
  const isOnDashboard = location.pathname === '/dashboard';
  const isOnAdmin = location.pathname.startsWith('/admin');

  const [activeMega, setActiveMega] = useState(null);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const notifRef = useRef(null);
  const userMenuRef = useRef(null);

  const unreadCount = DEMO_NOTIFICATIONS.filter(n => n.unread).length;

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifs(false);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setShowUserMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    navigate('/login');
  };

  return (
    <header className={`site-header ${scrolled ? 'scrolled' : ''}`}>
      <div className="header-inner">

        {/* ── Logo ── */}
        <Link to={isLoggedIn ? '/dashboard' : '/'} className="header-logo">
          <span className="logo-mark">C</span>
          <span className="logo-text">Campus<span className="logo-404">404</span></span>
        </Link>

        {/* ── Desktop Nav ── */}
        <nav className="header-nav" onMouseLeave={() => setActiveMega(null)}>
          {MEGA_MENU.map((menu) => (
            <div
              key={menu.label}
              className="nav-item"
              onMouseEnter={() => setActiveMega(menu.label)}
            >
              <button className="nav-trigger">
                {menu.label}
                <svg className="nav-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {activeMega === menu.label && (
                <div className="mega-menu">
                  <div className="mega-grid">
                    {menu.items.map((item) => (
                      <Link key={item.title} to={item.href} className="mega-item" onClick={() => setActiveMega(null)}>
                        <span className="mega-icon">{item.icon}</span>
                        <div>
                          <span className="mega-title">{item.title}</span>
                          <span className="mega-desc">{item.desc}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* ── Right Actions ── */}
        <div className="header-actions">

          {/* Notifications */}
          {isLoggedIn && (
            <div className="notif-wrap" ref={notifRef}>
              <button
                className="icon-btn notif-btn"
                onClick={() => { setShowNotifs(v => !v); setShowUserMenu(false); }}
                aria-label="Notifications"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
              </button>

              {showNotifs && (
                <div className="notif-dropdown">
                  <div className="notif-header">
                    <span>Notifications</span>
                    <button className="notif-clear">Mark all read</button>
                  </div>
                  <ul className="notif-list">
                    {DEMO_NOTIFICATIONS.map(n => (
                      <li key={n.id} className={`notif-item ${n.unread ? 'unread' : ''}`}>
                        <span className="notif-icon">{n.icon}</span>
                        <div className="notif-body">
                          <p className="notif-title">{n.title}</p>
                          <p className="notif-text">{n.body}</p>
                          <span className="notif-time">{n.time}</span>
                        </div>
                        {n.unread && <span className="notif-dot" />}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Admin pill — only for admins */}
          {isLoggedIn && isAdmin && !isOnAdmin && (
            <Link to="/admin" className="admin-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
              </svg>
              Admin Panel
            </Link>
          )}

          {/* Dashboard button — only when not on dashboard */}
          {isLoggedIn && !isOnDashboard && !isOnAdmin && (
            <Link to="/dashboard" className="btn-header-primary">Dashboard</Link>
          )}

          {/* Not logged in */}
          {!isLoggedIn && (
            <>
              <Link to="/login" className="btn-header-ghost">Log In</Link>
              <Link to="/register" className="btn-header-primary">Sign Up</Link>
            </>
          )}

          {/* User Avatar + Menu */}
          {isLoggedIn && (
            <div className="user-wrap" ref={userMenuRef}>
              <button
                className="avatar-btn"
                onClick={() => { setShowUserMenu(v => !v); setShowNotifs(false); }}
                aria-label="User menu"
              >
                <img src={defaultAvatar} alt="Avatar" className="avatar-img" />
                <span className="avatar-status" />
              </button>

              {showUserMenu && (
                <div className="user-dropdown">
                  <div className="user-dropdown-header">
                    <img src={defaultAvatar} alt="Avatar" className="ud-avatar" />
                    <div>
                      <p className="ud-name">My Profile</p>
                      <p className="ud-role">{isAdmin ? '✦ Administrator' : '⚡ Student'}</p>
                    </div>
                  </div>
                  <ul className="ud-list">
                    <li><Link to="/profile" className="ud-item">👤 My Profile</Link></li>
                    <li><Link to="/settings" className="ud-item">⚙️ Settings</Link></li>
                    {isAdmin && <li><Link to="/admin" className="ud-item">🛡️ Admin Panel</Link></li>}
                    <li className="ud-divider" />
                    <li><button onClick={handleLogout} className="ud-item ud-logout">🚪 Log Out</button></li>
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Mobile Hamburger */}
          <button
            className={`hamburger ${mobileOpen ? 'open' : ''}`}
            onClick={() => setMobileOpen(v => !v)}
            aria-label="Toggle menu"
          >
            <span /><span /><span />
          </button>
        </div>
      </div>

      {/* ── Mobile Menu ── */}
      {mobileOpen && (
        <div className="mobile-menu">
          {MEGA_MENU.map(menu => (
            <div key={menu.label} className="mobile-section">
              <p className="mobile-section-label">{menu.label}</p>
              {menu.items.map(item => (
                <Link key={item.title} to={item.href} className="mobile-link" onClick={() => setMobileOpen(false)}>
                  {item.icon} {item.title}
                </Link>
              ))}
            </div>
          ))}
          {!isLoggedIn && (
            <div className="mobile-auth">
              <Link to="/login" className="btn-header-ghost" onClick={() => setMobileOpen(false)}>Log In</Link>
              <Link to="/register" className="btn-header-primary" onClick={() => setMobileOpen(false)}>Sign Up</Link>
            </div>
          )}
          {isLoggedIn && (
            <button onClick={() => { handleLogout(); setMobileOpen(false); }} className="mobile-logout">Log Out</button>
          )}
        </div>
      )}
    </header>
  );
};

export default Header;
