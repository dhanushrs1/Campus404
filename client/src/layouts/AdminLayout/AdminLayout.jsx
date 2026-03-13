import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import './AdminLayout.css';

const AdminLayout = () => {
  const location = useLocation();

  const navItems = [
    { path: '/admin', label: 'Dashboard', icon: '📊' },
    { path: '/admin/labs', label: 'Labs Manager', icon: '🧪' },
    { path: '/admin/users', label: 'User Manager', icon: '👥' },
  ];

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <h2>Campus404 <span>Admin</span></h2>
        </div>
        <nav className="admin-sidebar-nav">
          {navItems.map((item) => (
            <Link 
              key={item.path} 
              to={item.path}
              className={`admin-nav-item ${location.pathname === item.path ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <Link to="/login" className="admin-logout-btn">
            Logout
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="admin-main-wrapper">
        {/* Topbar */}
        <header className="admin-topbar">
          <div className="topbar-search">
             <input type="text" placeholder="Search admin..." />
          </div>
          <div className="topbar-profile">
            <div className="profile-avatar">A</div>
            <div className="profile-info">
              <span className="profile-name">Admin User</span>
              <span className="profile-role">Superadmin</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
