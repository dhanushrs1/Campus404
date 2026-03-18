import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import defaultAvatar from '../../assets/images/avatars/default_avatar.jpg';
import { resolveAssetUrl, useSiteSettings } from '../../utils/siteSettings';
import './AdminLayout.css';

const VERSION = 'v1.0.0-alpha';

const NAV_ITEMS = [
  {
    path: '/admin',
    exact: true,
    label: 'Dashboard',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    path: '/admin/users',
    label: 'User Manager',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    path: '/admin/labs',
    label: 'Labs Manager',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v11m0 0a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2m-6 0H5a2 2 0 0 1-2-2V9m0 0h18"/>
      </svg>
    ),
  },
  {
    path: '/admin/guide',
    label: 'Guide',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
      </svg>
    ),
  },
  {
    path: '/admin/media',
    label: 'Media Library',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
      </svg>
    ),
  },
  {
    path: '/admin/badges',
    label: 'Badges',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
      </svg>
    ),
  },
  {
    path: '/admin/system-logs',
    label: 'System Logs',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 6h16M4 12h16M4 18h16"/>
      </svg>
    ),
    role: 'admin',
  },
  {
    path: '/admin/analytics',
    label: 'Analytics',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },
  {
    path: '/admin/settings',
    label: 'Settings',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  },
];

const AdminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const siteSettings = useSiteSettings();
  const [time, setTime] = useState(new Date());
  const [collapsed, setCollapsed] = useState(false);

  const username = localStorage.getItem('username') || 'Admin';
  const siteName = siteSettings.site_name || 'Campus404';
  const adminLogoSrc = resolveAssetUrl(siteSettings.site_logo_url);
  const adminIconSrc = resolveAssetUrl(siteSettings.site_icon_url);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    navigate('/login');
  };

  const isActive = (item) => {
    if (item.exact) return location.pathname === item.path;
    return location.pathname.startsWith(item.path);
  };

  const formatTime = (d) =>
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formatDate = (d) =>
    d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div className={`admin-layout ${collapsed ? 'sidebar-collapsed' : ''}`}>
      {/* ── Sidebar ── */}
      <aside className="admin-sidebar">
        {/* Brand */}
        <div className="sidebar-brand">
          {collapsed ? (
            <button
              type="button"
              className="sidebar-expand-trigger"
              onClick={() => setCollapsed(false)}
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <span className="collapsed-brand-glyph">
                {adminIconSrc ? (
                  <img src={adminIconSrc} alt={`${siteName} icon`} className="sidebar-icon-image" />
                ) : (
                  <span className="sidebar-logo-mark">C</span>
                )}
              </span>
              <span className="collapsed-expand-glyph" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </span>
            </button>
          ) : (
            <>
              <Link to="/admin" className="sidebar-logo">
                <div className="sidebar-logo-expanded">
                  <div className="sidebar-logo-brand-row">
                    {adminLogoSrc ? (
                      <img src={adminLogoSrc} alt={`${siteName} logo`} className="sidebar-logo-image" />
                    ) : (
                      <>
                        <span className="sidebar-logo-mark">C</span>
                        <span className="logo-name">{siteName}</span>
                      </>
                    )}
                  </div>
                  <span className="logo-badge">Admin</span>
                </div>
              </Link>
              <button
                type="button"
                className="collapse-btn"
                onClick={() => setCollapsed(true)}
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M15 18l-6-6 6-6"/>
                </svg>
              </button>
            </>
          )}
        </div>

        {/* Live clock — removed from sidebar, now in topbar */}


        {/* Nav */}
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item, i) => {
            // Role enforcement for sidebar items
            if (item.role && item.role !== localStorage.getItem('role')) return null;

            if (item.divider) {
              return !collapsed ? (
                <p key={i} className="sidebar-section-label">{item.label}</p>
              ) : <div key={i} className="sidebar-divider-line" />;
            }
            return (
              <Link
                key={item.path}
                to={item.disabled ? '#' : item.path}
                className={`sidebar-nav-item ${isActive(item) ? 'active' : ''} ${item.disabled ? 'disabled' : ''}`}
                title={collapsed ? item.label : undefined}
                onClick={e => item.disabled && e.preventDefault()}
              >
                <span className="nav-icon">{item.icon}</span>
                {!collapsed && <span className="nav-label">{item.label}</span>}
                {!collapsed && item.disabled && <span className="nav-soon">Soon</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          {!collapsed && <span className="sidebar-version">{VERSION}</span>}
          <button className="sidebar-logout" onClick={handleLogout} title="Log out">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
            {!collapsed && <span>Log out</span>}
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="admin-main-wrapper">
        {/* Topbar */}
        <header className="admin-topbar">
          <div className="topbar-left">
            <h1 className="topbar-page-title">
              {NAV_ITEMS.find(n => !n.divider && !n.disabled && isActive(n))?.label || 'Admin'}
            </h1>
          </div>
          <div className="topbar-right">
            {/* Live clock */}
            <div className="topbar-clock">
              <span className="topbar-clock-time">{formatTime(time)}</span>
              <span className="topbar-clock-date">{formatDate(time)}</span>
            </div>
            <Link to="/dashboard" className="topbar-view-site" target="_blank">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/>
              </svg>
              View Site
            </Link>
            <div className="topbar-profile">
              <img src={defaultAvatar} alt="Admin avatar" className="topbar-avatar" />
              <div className="topbar-profile-info">
                <span className="topbar-name">{username}</span>
                <span className="topbar-role">Administrator</span>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
