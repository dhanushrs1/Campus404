import React from 'react';
import './UserManager.css';

const UserManager = () => {
  return (
    <div className="user-manager-page">
      <div className="admin-page-header">
        <div className="header-actions">
          <div>
            <h1>User Manager</h1>
            <p>View, manage, and moderate platform users.</p>
          </div>
          <button className="primary-admin-btn">+ Invite Admin</button>
        </div>
      </div>

      <div className="users-list-container">
        <div className="users-filter-bar">
          <input type="text" placeholder="Search by name, email, or role..." className="user-search-input" />
          <select className="user-role-filter">
            <option value="all">All Roles</option>
            <option value="student">Student</option>
            <option value="editor">Editor</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <div className="users-table">
          <div className="table-header">
            <div className="col-user">User</div>
            <div className="col-role">Role</div>
            <div className="col-joined">Joined</div>
            <div className="col-actions">Actions</div>
          </div>
          
          {/* Demo Data Rows */}
          <div className="table-row">
            <div className="col-user">
              <div className="user-avatar">JD</div>
              <div className="user-details">
                <strong>John Doe</strong>
                <span>john@example.com</span>
              </div>
            </div>
            <div className="col-role"><span className="badge student">Student</span></div>
            <div className="col-joined">Oct 24, 2023</div>
            <div className="col-actions">
              <button className="action-btn">Manage</button>
            </div>
          </div>

          <div className="table-row">
            <div className="col-user">
              <div className="user-avatar admin">S</div>
              <div className="user-details">
                <strong>Sarah Smith</strong>
                <span>sarah@campus404.com</span>
              </div>
            </div>
            <div className="col-role"><span className="badge admin">Admin</span></div>
            <div className="col-joined">Sep 1, 2023</div>
            <div className="col-actions">
              <button className="action-btn">Manage</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserManager;
