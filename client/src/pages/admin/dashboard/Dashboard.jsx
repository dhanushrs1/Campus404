import React from 'react';
import './Dashboard.css';

const Dashboard = () => {
  return (
    <div className="admin-dashboard-page">
      <div className="admin-page-header">
        <h1>Admin Dashboard</h1>
        <p>Platform overview and key metrics.</p>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-title">Total Users</div>
          <div className="metric-value">1,248</div>
          <div className="metric-trend positive">↑ 12% this week</div>
        </div>
        <div className="metric-card">
          <div className="metric-title">Active Labs</div>
          <div className="metric-value">42</div>
          <div className="metric-trend positive">↑ 3 new labs</div>
        </div>
        <div className="metric-card">
          <div className="metric-title">Total Submissions</div>
          <div className="metric-value">8,930</div>
          <div className="metric-trend">Steady</div>
        </div>
        <div className="metric-card">
          <div className="metric-title">System Health</div>
          <div className="metric-value text-success">99.9%</div>
          <div className="metric-trend">All systems operational</div>
        </div>
      </div>

      <div className="recent-activity-section">
        <h2>Recent Activity</h2>
        <div className="activity-card">
          <p className="placeholder-text">Detailed activity feed will go here.</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
