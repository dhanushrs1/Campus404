import React, { useState, useEffect } from 'react';
import './Dashboard.css';

import { API_URL } from '../../../config';

const parseResponse = async (res) => {
  const raw = await res.text();
  let data = null;

  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new Error(data?.detail || data?.message || raw || 'Failed to fetch dashboard stats');
  }

  return data;
};

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/admin/stats`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const data = await parseResponse(res);
        setStats(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !stats) {
    return (
      <div className="admin-dashboard-page">
        <div className="admin-page-header">
          <h1>Admin Dashboard</h1>
          <p>Loading live metrics...</p>
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="admin-dashboard-page">
         <div className="admin-page-header">
           <h1>Admin Dashboard</h1>
           <p className="text-danger">Error: {error}</p>
         </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard-page">
      <div className="admin-page-header">
        <h1>Admin Dashboard</h1>
        <p>Live platform overview and key metrics.</p>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-title">Total Users</div>
          <div className="metric-value">{stats?.users?.total || 0}</div>
          <div className="metric-trend positive">
            {stats?.users?.students || 0} Students | {stats?.users?.admins || 0} Admins
          </div>
        </div>
        
        <div className="metric-card">
          <div className="metric-title">Active Labs</div>
          <div className="metric-value">{stats?.curriculum?.labs || 0}</div>
          <div className="metric-trend positive">
             {stats?.curriculum?.modules || 0} Modules built
          </div>
        </div>
        
        <div className="metric-card">
          <div className="metric-title">Total Code Submissions</div>
          <div className="metric-value">{stats?.curriculum?.submissions || 0}</div>
          <div className="metric-trend">Across {stats?.curriculum?.challenges || 0} challenges</div>
        </div>
        
        <div className="metric-card">
          <div className="metric-title">System Health & APIs</div>
          <div className="health-grid">
             <div className="status-badge">
               <div className={`status-indicator ${stats?.health?.system === 'online' ? 'online' : ''}`}></div>
               Core Database & API
             </div>
             <div className="status-badge" title="Checks connection to the internal Docker isolated sandbox engine">
               <div className={`status-indicator ${stats?.health?.judge0 === 'online' ? 'online' : ''}`}></div>
               Judge0 Sandbox Engine
             </div>
          </div>
        </div>
      </div>

      <div className="recent-activity-section">
        <h2>Quick Actions</h2>
        <div className="activity-card" style={{ padding: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-start', flexWrap: 'wrap' }}>
          <a href="/admin/users" className="status-badge" style={{ padding: '0.6rem 1rem', textDecoration: 'none', background: '#003acc', color: 'white', border: 'none' }}>
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
             Manage Users
          </a>
          <a href="/admin/labs" className="status-badge" style={{ padding: '0.6rem 1rem', textDecoration: 'none', background: '#003acc', color: 'white', border: 'none' }}>
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v11m0 0a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2m-6 0H5a2 2 0 0 1-2-2V9m0 0h18"></path></svg>
             Manage Curriculum
          </a>
          <a href="/admin/system-logs" className="status-badge" style={{ padding: '0.6rem 1rem', textDecoration: 'none', background: '#0A192F', color: 'white', border: 'none' }}>
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
             View System Logs
          </a>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
