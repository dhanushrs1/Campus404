import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import defaultAvatar from '../../assets/images/avatars/default_avatar.jpg';
import { resolveAssetUrl, useSiteSettings } from '../../utils/siteSettings';
import './Header.css';

// ==========================================
// Hand-crafted SVG Icons 
// ==========================================
const Icons = {
  Labs: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2v7.31"/><path d="M14 9.3V1.99"/><path d="M8.5 2h7"/><path d="M14 9.3a6.5 6.5 0 1 1-4 0"/><path d="M5.52 16h12.96"/></svg>,
  Tracks: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Roadmaps: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>,
  Sandbox: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>,
  Badge: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>,
  Message: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  Lightning: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  Bell: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  ChevronDown: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
};

const GUIDE_MENU = [
  { icon: 'Labs', title: 'Labs', desc: 'Hands-on coding challenges', href: '/labs' },
  { icon: 'Tracks', title: 'Tracks', desc: 'Structured learning paths', href: '/tracks' },
  { icon: 'Roadmaps', title: 'Roadmaps', desc: 'Tech career maps', href: '/roadmaps' },
  { icon: 'Sandbox', title: 'Sandbox', desc: 'Free coding playground', href: '/sandbox' },
];

const DEMO_NOTIFICATIONS = [
  { id: 1, type: 'badge', title: 'New badge earned!', body: 'You earned the "First Lab" badge.', time: '2m ago', unread: true },
  { id: 2, type: 'message', title: 'Someone replied', body: 'John replied to your discussion.', time: '15m ago', unread: true },
  { id: 3, type: 'lightning', title: 'Daily challenge ready', body: 'Today\'s challenge is live. Go solve it!', time: '1h ago', unread: false },
];

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');
  const isLoggedIn = !!token;
  const isAdmin = role === 'admin';
  const siteSettings = useSiteSettings();
  
  const [activeMenu, setActiveMenu] = useState(null);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const notifRef = useRef(null);
  const userMenuRef = useRef(null);

  const unreadCount = DEMO_NOTIFICATIONS.filter(n => n.unread).length;
  const logoSrc = resolveAssetUrl(siteSettings.site_logo_url);
  const logoAlt = `${siteSettings.site_name || 'Campus404'} logo`;
  const logoWidth = Math.max(64, Number(siteSettings.site_logo_width) || 220);
  const logoHeight = Math.max(24, Number(siteSettings.site_logo_height) || 48);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

  if (location.pathname.startsWith('/admin')) return null;

  return (
    <header className={`site-header ${scrolled ? 'scrolled' : ''}`}>
      <div className="header-inner">
      
        {/* -- Logo -- */}
        <Link to={isLoggedIn ? '/dashboard' : '/'} className="header-logo">
          {logoSrc ? (
            <img
              src={logoSrc}
              alt={logoAlt}
              className="header-logo-image"
              style={{
                width: `${logoWidth}px`,
                height: `${logoHeight}px`,
                maxWidth: 'min(40vw, 320px)',
                maxHeight: '54px',
              }}
            />
          ) : (
            <>
              <span className="logo-mark">C</span>
              <span className="logo-text">{siteSettings.site_name || 'Campus404'}</span>
            </>
          )}
        </Link>
        
        {/* -- Navigation -- */}
        <nav className="header-nav" onMouseLeave={() => setActiveMenu(null)}>
          {/* SINGLE Mega Menu Item */}
          <div className="nav-item">
            <button className={`nav-trigger ${activeMenu === 'guide' ? 'active' : ''}`} onMouseEnter={() => setActiveMenu('guide')}>
              Explore <span className="nav-chevron"><Icons.ChevronDown /></span>
            </button>
            {activeMenu === 'guide' && (
              <div className="mega-menu">
                <div className="mega-grid">
                  {GUIDE_MENU.map((item) => {
                    const Icon = Icons[item.icon];
                    return (
                      <Link to={item.href} key={item.title} className="mega-item">
                        <div className="mega-icon-clean"><Icon /></div>
                        <div>
                          <span className="mega-title">{item.title}</span>
                          <span className="mega-desc">{item.desc}</span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Standard direct links */}
          <Link to="/challenges" className="nav-link">Challenges</Link>
          <Link to="/leaderboard" className="nav-link">Leaderboard</Link>
          <Link to="/workshop" className="nav-link">Workshop</Link>
        </nav>
        
        {/* -- Right Actions -- */}
        <div className="header-actions">
          {(!isLoggedIn) ? (
            <>
              <Link to="/login" className="btn-header-ghost">Log In</Link>
              <Link to="/register" className="btn-header-primary">Sign Up</Link>
            </>
          ) : (
            <>
              {isAdmin && (
                <Link to="/admin" className="admin-pill">Admin Panel</Link>
              )}
              
              {/* Creative Notifications */}
              <div className="notif-wrap" ref={notifRef}>
                <button className="icon-btn" onClick={() => setShowNotifs(!showNotifs)}>
                  <Icons.Bell />
                  {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
                </button>
                {showNotifs && (
                  <div className="notif-dropdown creative-notifs">
                    <div className="notif-header">
                      <span>Notifications</span>
                      <button className="notif-clear" onClick={() => setShowNotifs(false)}>Mark all read</button>
                    </div>
                    <div className="notif-list">
                      {DEMO_NOTIFICATIONS.map(n => {
                        const IconGroup = {
                          badge: { Icon: Icons.Badge, cls: 'bg-emerald' },
                          message: { Icon: Icons.Message, cls: 'bg-blue' },
                          lightning: { Icon: Icons.Lightning, cls: 'bg-amber' }
                        };
                        const setting = IconGroup[n.type];
                        const IconComp = setting.Icon;
                        return (
                          <div key={n.id} className={`notif-item ${n.unread ? 'unread' : ''}`}>
                            <div className={`notif-art ${setting.cls}`}>
                              <IconComp />
                            </div>
                            <div className="notif-body">
                              <h4 className="notif-title">{n.title}</h4>
                              <p className="notif-text">{n.body}</p>
                              <span className="notif-time">{n.time}</span>
                            </div>
                            {n.unread && <div className="notif-dot" />}
                          </div>
                        );
                      })}
                    </div>
                    <div className="notif-footer">
                      <Link to="/notifications" onClick={() => setShowNotifs(false)}>View all alerts</Link>
                    </div>
                  </div>
                )}
              </div>
              
              {/* User Dropdown */}
              <div className="user-wrap" ref={userMenuRef}>
                <button className="avatar-btn" onClick={() => setShowUserMenu(!showUserMenu)}>
                  <img src={defaultAvatar} alt="User" className="avatar-img" />
                  <div className="user-status" />
                </button>
                {showUserMenu && (
                  <div className="user-dropdown">
                    <ul className="menu-list">
                      <li><Link to="/profile">My Profile</Link></li>
                      <li><Link to="/settings">Account Settings</Link></li>
                      <div className="menu-divider" />
                      <li><button className="logout-btn" onClick={handleLogout}>Log Out</button></li>
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
