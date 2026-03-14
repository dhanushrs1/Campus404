import React, { useState } from 'react';
import './BadgePickerModal.css';

const FALLBACK_BADGE = '🏆';

export default function BadgePickerModal({
  onSelect,
  onClose,
  badges = [], // List of all badges
  currentBadgeId = null, // The badge currently assigned to this module
}) {
  const [selectedId, setSelectedId] = useState(currentBadgeId);

  // Close on backdrop click
  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleSelect = () => {
    onSelect(selectedId);
  };

  return (
    <div className="bpm-overlay" onClick={handleBackdrop}>
      <div className="bpm-modal">
        <div className="bpm-header">
          <h3 className="bpm-title">Select a Reward Badge</h3>
          <button className="bpm-close" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="bpm-body">
          <div className="bpm-grid">
            <button
              className={`bpm-item ${selectedId === '' || selectedId === null ? 'selected' : ''}`}
              onClick={() => setSelectedId('')}
            >
              <div className="bpm-card-icon bpm-none">🚫</div>
              <div className="bpm-card-name">No Badge</div>
            </button>

            {badges.map(badge => {
              const isLocked = badge.module_id && badge.id !== currentBadgeId;
              
              return (
                <button
                  key={badge.id}
                  className={`bpm-item ${selectedId === badge.id ? 'selected' : ''} ${isLocked ? 'locked' : ''}`}
                  onClick={() => !isLocked && setSelectedId(badge.id)}
                  disabled={isLocked}
                  title={isLocked ? `Already assigned to ${badge.module_title || 'a module'}` : ''}
                >
                  <div className="bpm-card-icon">
                    {badge.image_url ? <img src={badge.image_url} alt={badge.name} /> : <span>{FALLBACK_BADGE}</span>}
                  </div>
                  <div className="bpm-card-name">{badge.name}</div>
                  {isLocked && <div className="bpm-locked-tag">Assigned</div>}
                </button>
              );
            })}
            
            {badges.length === 0 && (
               <div className="bpm-empty">No badges available. Create one in the Badges Manager!</div>
            )}
          </div>
        </div>

        <div className="bpm-footer">
          <button className="bpm-btn-cancel" onClick={onClose}>Cancel</button>
          <button className="bpm-btn-insert" onClick={handleSelect}>Confirm Selection</button>
        </div>
      </div>
    </div>
  );
}