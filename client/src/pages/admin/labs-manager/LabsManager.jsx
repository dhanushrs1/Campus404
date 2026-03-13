import React from 'react';
import './LabsManager.css';

const LabsManager = () => {
  return (
    <div className="labs-manager-page">
      <div className="admin-page-header">
        <div className="header-actions">
          <div>
            <h1>Labs Manager</h1>
            <p>Create, edit, and manage coding challenges.</p>
          </div>
          <button className="primary-admin-btn">+ Create New Lab</button>
        </div>
      </div>

      <div className="labs-list-container">
        <div className="labs-table">
          <div className="table-header">
            <div className="col-name">Lab Name</div>
            <div className="col-difficulty">Difficulty</div>
            <div className="col-status">Status</div>
            <div className="col-actions">Actions</div>
          </div>
          
          {/* Demo Data Rows */}
          <div className="table-row">
            <div className="col-name">
              <strong>Two Sum Optimization</strong>
              <span>Algorithms • Array</span>
            </div>
            <div className="col-difficulty"><span className="badge easy">Easy</span></div>
            <div className="col-status"><span className="badge active">Published</span></div>
            <div className="col-actions">
              <button className="action-btn">Edit</button>
            </div>
          </div>

          <div className="table-row">
            <div className="col-name">
              <strong>Distributed Rate Limiter</strong>
              <span>System Design • Concurrency</span>
            </div>
            <div className="col-difficulty"><span className="badge hard">Hard</span></div>
            <div className="col-status"><span className="badge draft">Draft</span></div>
            <div className="col-actions">
              <button className="action-btn">Edit</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LabsManager;
