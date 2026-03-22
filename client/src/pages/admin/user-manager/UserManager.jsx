import React, { useCallback, useEffect, useRef, useState } from 'react';
import { API_URL } from '../../../config';
import './UserManager.css';

const token = () => localStorage.getItem('token');
const authH = () => ({ Authorization: `Bearer ${token()}` });

const parseResponse = async (res) => {
  const raw = await res.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
  if (!res.ok) throw new Error(data?.detail || data?.message || raw || `Request failed (${res.status})`);
  return data;
};

const getCurrentUserId = () => {
  try {
    const jwt = token();
    if (!jwt) return null;
    const payload = JSON.parse(atob(jwt.split('.')[1]));
    return payload.id ?? null;
  } catch { return null; }
};

const ROLE_OPTIONS = [
  { value: 'all', label: 'All Roles' },
  { value: 'student', label: 'Student' },
  { value: 'editor', label: 'Editor' },
  { value: 'admin', label: 'Admin' },
  { value: 'banned', label: 'Banned' },
];

const toName = (user) => {
  if (!user) return 'Unknown User';
  if (user.first_name || user.last_name) return `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim();
  return user.username;
};

const getInitials = (user) => {
  if (!user) return 'U';
  if (user.first_name && user.last_name) return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
  if (user.first_name) return user.first_name.slice(0, 2).toUpperCase();
  return String(user.username || 'U').slice(0, 2).toUpperCase();
};

const formatDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatDateTime = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const formatAuditAction = (action) => {
  if (!action) return 'Unknown action';
  const map = {
    'user.xp.increase': 'XP increased', 'user.xp.decrease': 'XP decreased',
    'user.xp.set': 'XP set', 'user.xp.reset': 'XP reset',
    'user.progress.reset': 'Progress reset', 'user.badge.grant': 'Badge granted',
    'user.badge.revoke': 'Badge revoked', 'user.role.update': 'Role updated',
    'user.ban.update': 'Ban status updated', 'user.delete': 'User deleted',
  };
  return map[action] || action;
};

const RoleBadge = ({ role, banned }) => {
  if (banned) return <span className="role-badge banned">Banned</span>;
  if (role === 'admin') return <span className="role-badge admin">Admin</span>;
  if (role === 'editor') return <span className="role-badge editor">Editor</span>;
  return <span className="role-badge student">Student</span>;
};

/* ─── Action Dropdown Menu ─── */
const ActionMenu = ({ user, isSelf, onAction, onOpenInsights, closeSelf }) => {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) closeSelf(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [closeSelf]);

  return (
    <div className="action-menu" ref={ref}>
      <button onClick={() => onOpenInsights(user.id)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
        View Activity & Manage
      </button>
      {isSelf ? (
        <p className="action-menu-self">This is your account. Role, ban, and delete actions are blocked.</p>
      ) : (
        <>
          <div className="action-menu-divider" />
          {user.role !== 'admin' && (
            <button onClick={() => onAction(user.id, 'role', 'admin')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              Promote to Admin
            </button>
          )}
          {user.role !== 'editor' && (
            <button onClick={() => onAction(user.id, 'role', 'editor')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Make Editor
            </button>
          )}
          {user.role !== 'student' && (
            <button onClick={() => onAction(user.id, 'role', 'student')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
              Demote to Student
            </button>
          )}
          <div className="action-menu-divider" />
          {user.is_banned ? (
            <button onClick={() => onAction(user.id, 'ban', false)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/></svg>
              Unban User
            </button>
          ) : (
            <button className="danger" onClick={() => onAction(user.id, 'ban', true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
              Ban User
            </button>
          )}
          <button className="danger" onClick={() => onAction(user.id, 'delete')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m5 0V4h4v2"/></svg>
            Delete Permanently
          </button>
        </>
      )}
    </div>
  );
};

/* ─── Modal Tab Content ─── */
const MODAL_TABS = [
  { id: 'activity', label: 'Activity' },
  { id: 'progress', label: 'Progress' },
  { id: 'controls', label: 'Admin Controls' },
];

const ModalContent = ({
  data, user, summary,
  xpForm, setXpForm,
  resetForm, setResetForm,
  badgeForm, setBadgeForm,
  resolvedModuleId, resolvedLevelId, resolvedBadgeId, selectedBadge,
  busy, onAdjustXp, onReset, onGrantBadge, onRevokeBadge,
}) => {
  const [activeTab, setActiveTab] = useState('activity');

  return (
    <>
      {/* Stats strip */}
      <div className="um-stats-strip">
        {[
          { label: 'Total XP', value: (user?.total_xp || 0).toLocaleString() },
          { label: 'Completed', value: `${summary?.levels_completed ?? 0}/${summary?.published_levels ?? 0}` },
          { label: 'Completion', value: `${summary?.completion_percent ?? 0}%` },
          { label: 'Attempts', value: summary?.total_attempts ?? 0 },
          { label: 'Badges', value: summary?.badges_earned ?? 0 },
          { label: 'Attended', value: summary?.levels_attended ?? 0 },
        ].map(({ label, value }) => (
          <div key={label} className="um-stat-item">
            <span className="um-stat-label">{label}</span>
            <strong className="um-stat-value">{value}</strong>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="um-tab-bar">
        {MODAL_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`um-tab-btn${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="um-tab-content">

        {/* ── Activity Tab ── */}
        {activeTab === 'activity' && (
          <div className="um-tab-pane">
            <div className="um-pane-section">
              <h4 className="um-section-title">Recent Activity</h4>
              {(data.recent_activity || []).length === 0 ? (
                <p className="um-empty-state">No activity recorded yet.</p>
              ) : (
                <div className="um-activity-feed">
                  {data.recent_activity.map((item, idx) => {
                    const isCompletion = item.type === 'completion';
                    const isPassed = item.passed;
                    const dot = isCompletion ? 'done' : (isPassed ? 'pass' : 'try');
                    return (
                      <div key={`${item.type}-${item.challenge_id}-${idx}`} className="um-feed-item">
                        <div className={`um-feed-dot ${dot}`} />
                        <div className="um-feed-body">
                          <div className="um-feed-top">
                            <span className={`um-feed-type ${dot}`}>
                              {isCompletion ? 'Completed' : (isPassed ? 'Passed' : 'Attempted')}
                            </span>
                            <span className="um-feed-title">{item.display_title}</span>
                            <span className="um-feed-module">{item.module_title}</span>
                          </div>
                          <div className="um-feed-bottom">
                            {!isCompletion && <span>Attempt #{item.attempt_number}</span>}
                            <span className="um-feed-xp">+{item.xp_awarded || 0} XP</span>
                            <span className="um-feed-time">{formatDateTime(item.occurred_at)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="um-pane-section">
              <h4 className="um-section-title">Admin Audit Trail</h4>
              {(data.recent_admin_actions || []).length === 0 ? (
                <p className="um-empty-state">No admin actions recorded.</p>
              ) : (
                <div className="um-audit-feed">
                  {data.recent_admin_actions.map((entry) => {
                    const context = entry.context || {};
                    const parts = Object.entries(context)
                      .filter(([, v]) => v !== null && v !== undefined && v !== '')
                      .slice(0, 5)
                      .map(([k, v]) => `${k}: ${typeof v === 'boolean' ? String(v) : v}`);
                    return (
                      <div key={entry.audit_id} className="um-audit-card">
                        <div className="um-audit-card-top">
                          <strong>{formatAuditAction(entry.action)}</strong>
                          <span className="um-audit-time">{formatDateTime(entry.created_at)}</span>
                        </div>
                        <p className="um-audit-by">
                          By {entry.actor_display_name || entry.actor_username || `Admin #${entry.actor_admin_id || '?'}`}
                          {entry.reason ? ` · ${entry.reason}` : ''}
                        </p>
                        {parts.length > 0 && <p className="um-audit-ctx">{parts.join(' · ')}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Progress Tab ── */}
        {activeTab === 'progress' && (
          <div className="um-tab-pane">
            <div className="um-pane-section">
              <h4 className="um-section-title">Progress by Module</h4>
              {(data.module_progress || []).length === 0 ? (
                <p className="um-empty-state">No module progress yet.</p>
              ) : (
                <div className="um-module-list">
                  {data.module_progress.map((mod) => (
                    <details key={mod.module_id} className="um-module-card">
                      <summary className="um-module-summary">
                        <div className="um-module-info">
                          <strong>{mod.module_title}</strong>
                          <span>{mod.lab_title}</span>
                        </div>
                        <div className="um-module-pills">
                          <span className="um-pill">{mod.completed_levels}/{mod.published_levels} done</span>
                          <span className="um-pill">{mod.module_earned_xp}/{mod.module_total_xp} XP</span>
                          <span className="um-pill progress">{mod.progress_percent}%</span>
                          <svg className="um-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 12 15 18 9"/>
                          </svg>
                        </div>
                      </summary>
                      <div className="um-module-table-wrap">
                        <table className="um-levels-table">
                          <thead>
                            <tr>
                              <th>Level</th><th>Type</th><th>Status</th>
                              <th>Attempts</th><th>XP</th><th>Last activity</th>
                            </tr>
                          </thead>
                          <tbody>
                            {mod.levels.map((level) => {
                              const status = level.is_completed ? 'completed'
                                : level.attempt_count > 0 ? 'attempted' : 'not-started';
                              return (
                                <tr key={level.challenge_id}>
                                  <td>{level.display_title}</td>
                                  <td><span className="um-type-tag">{level.challenge_type}</span></td>
                                  <td>
                                    <span className={`um-status-tag ${status}`}>
                                      {status === 'completed' ? '✓ Completed' : status === 'attempted' ? 'Attempted' : 'Not started'}
                                    </span>
                                  </td>
                                  <td>{level.attempt_count}</td>
                                  <td>{level.xp_awarded}/{level.xp_reward}</td>
                                  <td className="um-td-time">{formatDateTime(level.last_attempt_at || level.completed_at)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Admin Controls Tab ── */}
        {activeTab === 'controls' && (
          <div className="um-tab-pane">
            <div className="um-controls-grid">

              {/* Adjust XP */}
              <div className="um-ctrl-card">
                <div className="um-ctrl-card-header">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                  <h5>Adjust XP</h5>
                </div>
                <div className="um-ctrl-body">
                  <label className="um-ctrl-label">Operation</label>
                  <select className="um-ctrl-input" value={xpForm.operation}
                    onChange={(e) => setXpForm((p) => ({ ...p, operation: e.target.value }))}>
                    <option value="increase">Increase XP</option>
                    <option value="decrease">Decrease XP</option>
                    <option value="set">Set Exact XP</option>
                    <option value="reset">Reset XP to 0</option>
                  </select>

                  {xpForm.operation !== 'reset' && (
                    <>
                      <label className="um-ctrl-label">Amount</label>
                      <input className="um-ctrl-input" type="number" min="0" value={xpForm.amount}
                        onChange={(e) => setXpForm((p) => ({ ...p, amount: e.target.value }))} />
                    </>
                  )}

                  <label className="um-ctrl-label">Reason <span className="um-optional">(optional)</span></label>
                  <input className="um-ctrl-input" value={xpForm.reason}
                    onChange={(e) => setXpForm((p) => ({ ...p, reason: e.target.value }))}
                    placeholder="Support adjustment note" />

                  <button type="button" className="um-primary-btn" disabled={busy} onClick={() => onAdjustXp(xpForm)}>
                    Apply XP Update
                  </button>
                </div>
              </div>

              {/* Reset Progress */}
              <div className="um-ctrl-card danger-card">
                <div className="um-ctrl-card-header danger">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                  <h5>Reset Progress</h5>
                </div>
                <div className="um-ctrl-body">
                  <label className="um-ctrl-label">Target</label>
                  <select className="um-ctrl-input" value={resetForm.target_type}
                    onChange={(e) => setResetForm((p) => ({ ...p, target_type: e.target.value }))}>
                    <option value="module">Specific Module</option>
                    <option value="level">Specific Level</option>
                    <option value="all">All Progress</option>
                  </select>

                  {resetForm.target_type === 'module' && (
                    <>
                      <label className="um-ctrl-label">Module</label>
                      <select className="um-ctrl-input" value={resolvedModuleId}
                        onChange={(e) => setResetForm((p) => ({ ...p, module_id: e.target.value }))}>
                        <option value="">Select module</option>
                        {(data.reset_options?.modules || []).map((m) => (
                          <option key={m.module_id} value={m.module_id}>{m.lab_title} · {m.module_title}</option>
                        ))}
                      </select>
                    </>
                  )}

                  {resetForm.target_type === 'level' && (
                    <>
                      <label className="um-ctrl-label">Level</label>
                      <select className="um-ctrl-input" value={resolvedLevelId}
                        onChange={(e) => setResetForm((p) => ({ ...p, challenge_id: e.target.value }))}>
                        <option value="">Select level</option>
                        {(data.reset_options?.levels || []).map((l) => (
                          <option key={l.challenge_id} value={l.challenge_id}>
                            {l.lab_title} · {l.module_title} · {l.display_title}
                          </option>
                        ))}
                      </select>
                    </>
                  )}

                  <div className="um-check-grid">
                    {[
                      { key: 'clear_attempts', label: 'Clear attempts' },
                      { key: 'clear_completions', label: 'Clear completions' },
                      { key: 'clear_badges', label: 'Clear related badges' },
                      { key: 'reset_streaks', label: 'Reset streaks' },
                    ].map(({ key, label }) => (
                      <label key={key} className="um-check-row">
                        <input type="checkbox" checked={resetForm[key]}
                          onChange={(e) => setResetForm((p) => ({ ...p, [key]: e.target.checked }))} />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>

                  <label className="um-ctrl-label">Override XP to <span className="um-optional">(optional)</span></label>
                  <input className="um-ctrl-input" type="number" min="0" value={resetForm.set_xp_to}
                    onChange={(e) => setResetForm((p) => ({ ...p, set_xp_to: e.target.value }))}
                    placeholder="Leave empty to auto-recalculate" />

                  <label className="um-ctrl-label">Reason <span className="um-optional">(optional)</span></label>
                  <input className="um-ctrl-input" value={resetForm.reason}
                    onChange={(e) => setResetForm((p) => ({ ...p, reason: e.target.value }))}
                    placeholder="Reset note" />

                  <button type="button" className="um-danger-btn" disabled={busy}
                    onClick={() => onReset({ ...resetForm, module_id: resolvedModuleId, challenge_id: resolvedLevelId })}>
                    Run Reset
                  </button>
                </div>
              </div>

              {/* Badge Controls */}
              <div className="um-ctrl-card">
                <div className="um-ctrl-card-header">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
                  </svg>
                  <h5>Badge Controls</h5>
                </div>
                <div className="um-ctrl-body">
                  <label className="um-ctrl-label">Badge to Grant</label>
                  <select className="um-ctrl-input" value={resolvedBadgeId}
                    onChange={(e) => setBadgeForm((p) => ({ ...p, badge_id: e.target.value }))}>
                    <option value="">Select badge</option>
                    {(data.badge_catalog || []).map((b) => (
                      <option key={b.badge_id} value={b.badge_id}>
                        {b.name} {b.already_owned ? '[Owned]' : b.eligible ? '[Eligible]' : '[Needs validation]'}
                      </option>
                    ))}
                  </select>

                  {selectedBadge && (
                    <div className={`um-badge-hint ${selectedBadge.eligible ? 'ok' : 'warn'}`}>
                      {selectedBadge.validation_message}
                    </div>
                  )}

                  <label className="um-check-row">
                    <input type="checkbox" checked={badgeForm.force}
                      onChange={(e) => setBadgeForm((p) => ({ ...p, force: e.target.checked }))} />
                    <span>Force grant if validation fails</span>
                  </label>

                  <label className="um-ctrl-label">Reason <span className="um-optional">(optional)</span></label>
                  <input className="um-ctrl-input" value={badgeForm.reason}
                    onChange={(e) => setBadgeForm((p) => ({ ...p, reason: e.target.value }))}
                    placeholder="Support issue, manual override, etc." />

                  <button type="button" className="um-primary-btn" disabled={busy}
                    onClick={() => onGrantBadge({ ...badgeForm, badge_id: resolvedBadgeId })}>
                    Grant Badge
                  </button>

                  <div className="um-owned-badges">
                    <p className="um-owned-badges-title">Owned Badges</p>
                    {(data.owned_badges || []).length === 0 ? (
                      <p className="um-empty-state sm">No badges earned yet.</p>
                    ) : (
                      data.owned_badges.map((badge) => (
                        <div key={badge.badge_id} className="um-owned-badge-row">
                          <div>
                            <strong>{badge.name}</strong>
                            <span>{badge.module_title || 'Standalone'}</span>
                          </div>
                          <button type="button" className="um-revoke-btn" disabled={busy}
                            onClick={() => onRevokeBadge(badge.badge_id, badge.name)}>
                            Revoke
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

/* ─── User Activity Modal (shell) ─── */
const UserActivityModal = ({
  open, data, loading, error, busy,
  onClose, onRefresh, onAdjustXp, onReset, onGrantBadge, onRevokeBadge,
}) => {
  const [xpForm, setXpForm] = useState({ operation: 'increase', amount: 50, reason: '' });
  const [resetForm, setResetForm] = useState({
    target_type: 'module', module_id: '', challenge_id: '',
    clear_attempts: true, clear_completions: true,
    clear_badges: false, reset_streaks: false, set_xp_to: '', reason: '',
  });
  const [badgeForm, setBadgeForm] = useState({ badge_id: '', force: false, reason: '' });

  if (!open) return null;

  const user = data?.user;
  const summary = data?.summary;
  const defaultModuleId = data?.reset_options?.modules?.[0] ? String(data.reset_options.modules[0].module_id) : '';
  const defaultLevelId = data?.reset_options?.levels?.[0] ? String(data.reset_options.levels[0].challenge_id) : '';
  const defaultBadgeId = data?.badge_catalog?.find((b) => !b.already_owned)
    ? String(data.badge_catalog.find((b) => !b.already_owned).badge_id) : '';
  const resolvedModuleId = resetForm.module_id || defaultModuleId;
  const resolvedLevelId = resetForm.challenge_id || defaultLevelId;
  const resolvedBadgeId = badgeForm.badge_id || defaultBadgeId;
  const selectedBadge = data?.badge_catalog?.find((b) => Number(b.badge_id) === Number(resolvedBadgeId));

  return (
    <div className="um-modal-backdrop" onClick={onClose}>
      <div className="um-modal" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="um-modal-header">
          <div className="um-modal-user">
            {user?.avatar_url
              ? <img src={user.avatar_url} alt="" className="um-modal-avatar" />
              : <div className={`um-modal-avatar-init ${user?.role || 'student'}`}>{getInitials(user)}</div>
            }
            <div className="um-modal-user-info">
              <h3>{toName(user)}</h3>
              <p className="um-modal-handle">@{user?.username} · {user?.email}</p>
              <div className="um-modal-badges-row">
                <RoleBadge role={user?.role} banned={Boolean(user?.is_banned)} />
                <span className={`um-status-pill ${user?.is_verified ? 'verified' : 'unverified'}`}>
                  {user?.is_verified ? '✓ Verified' : 'Unverified'}
                </span>
                <span className="um-status-pill neutral">Joined {formatDate(user?.created_at)}</span>
                <span className="um-status-pill neutral">Last login {formatDateTime(user?.last_login_at)}</span>
              </div>
            </div>
          </div>

          <div className="um-modal-header-right">
            <button type="button" className="um-icon-btn" onClick={onRefresh} disabled={loading || busy} title="Refresh">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
            </button>
            <button type="button" className="um-modal-close" onClick={onClose} aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="um-modal-body">
          {loading && (
            <div className="um-modal-center"><div className="um-spinner" /></div>
          )}
          {!loading && error && (
            <div className="um-modal-center">
              <div className="um-modal-err-box">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            </div>
          )}
          {!loading && !error && data && (
            <ModalContent
              data={data} user={user} summary={summary}
              xpForm={xpForm} setXpForm={setXpForm}
              resetForm={resetForm} setResetForm={setResetForm}
              badgeForm={badgeForm} setBadgeForm={setBadgeForm}
              resolvedModuleId={resolvedModuleId}
              resolvedLevelId={resolvedLevelId}
              resolvedBadgeId={resolvedBadgeId}
              selectedBadge={selectedBadge}
              busy={busy}
              onAdjustXp={onAdjustXp} onReset={onReset}
              onGrantBadge={onGrantBadge} onRevokeBadge={onRevokeBadge}
            />
          )}
        </div>
      </div>
    </div>
  );
};

/* ─── UserManager Page ─── */
const UserManager = () => {
  const PER_PAGE = 20;
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [openMenu, setOpenMenu] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailUserId, setDetailUserId] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detailBusy, setDetailBusy] = useState(false);
  const searchTimer = useRef(null);
  const currentUserId = getCurrentUserId();

  const showToast = (msg, type = 'success') => {
    setToastMsg({ msg, type });
    setTimeout(() => setToastMsg(null), 3000);
  };

  const fetchUsers = useCallback(async (pg, q, role) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: pg, per_page: PER_PAGE });
      if (q) params.set('search', q);
      if (role !== 'all') params.set('role', role);
      const res = await fetch(`${API_URL}/admin/users?${params}`, { headers: authH() });
      const data = await parseResponse(res);
      setUsers(data.users || []);
      setTotal(data.total || 0);
      setTotalPages(data.total_pages || 1);
    } catch (err) {
      showToast(err.message || 'Failed to load users.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUserDetails = useCallback(async (userId) => {
    if (!userId) return;
    setDetailLoading(true);
    setDetailError('');
    try {
      const res = await fetch(`${API_URL}/admin/users/${userId}/activity`, { headers: authH() });
      const data = await parseResponse(res);
      setDetailData(data);
    } catch (err) {
      setDetailError(err.message || 'Failed to load user activity.');
      setDetailData(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(page, search, roleFilter); }, [page, roleFilter, search, fetchUsers]);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchInput(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setPage(1); setSearch(value); }, 350);
  };

  const handleAction = async (userId, action, value) => {
    setOpenMenu(null);
    try {
      let url = '', method = 'PATCH', reasonInput = '';
      if (action === 'role') reasonInput = window.prompt('Reason for role change (optional):', '') ?? '';
      else if (action === 'ban') reasonInput = window.prompt('Reason for ban status change (optional):', '') ?? '';

      if (action === 'role') {
        const p = new URLSearchParams({ role: String(value) });
        if (reasonInput.trim()) p.set('reason', reasonInput.trim());
        url = `${API_URL}/admin/users/${userId}/role?${p}`;
      } else if (action === 'ban') {
        const p = new URLSearchParams({ banned: String(value) });
        if (reasonInput.trim()) p.set('reason', reasonInput.trim());
        url = `${API_URL}/admin/users/${userId}/ban?${p}`;
      } else if (action === 'delete') {
        method = 'DELETE';
        if (!window.confirm('Delete this user permanently? This cannot be undone.')) return;
        reasonInput = window.prompt('Reason for permanent deletion (optional):', '') ?? '';
        const p = new URLSearchParams();
        if (reasonInput.trim()) p.set('reason', reasonInput.trim());
        url = `${API_URL}/admin/users/${userId}${p.toString() ? `?${p}` : ''}`;
      }

      const res = await fetch(url, { method, headers: authH() });
      const data = await parseResponse(res);
      showToast(data.message || 'Action completed.');
      fetchUsers(page, search, roleFilter);
      if (detailOpen && detailUserId === userId) fetchUserDetails(userId);
    } catch (err) {
      showToast(err.message || 'Action failed.', 'error');
    }
  };

  const openUserInsights = async (userId) => {
    setOpenMenu(null);
    setDetailOpen(true);
    setDetailUserId(userId);
    fetchUserDetails(userId);
  };

  const handleAdjustXp = async (form) => {
    if (!detailUserId) return;
    const payload = { operation: form.operation, amount: form.operation === 'reset' ? 0 : Number(form.amount || 0), reason: form.reason?.trim() || null };
    setDetailBusy(true);
    try {
      const res = await fetch(`${API_URL}/admin/users/${detailUserId}/xp`, {
        method: 'POST', headers: { ...authH(), 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const data = await parseResponse(res);
      showToast(data.message || 'XP updated.');
      await fetchUserDetails(detailUserId);
      fetchUsers(page, search, roleFilter);
    } catch (err) {
      showToast(err.message || 'Failed to update XP.', 'error');
    } finally { setDetailBusy(false); }
  };

  const handleReset = async (form) => {
    if (!detailUserId) return;
    if (form.target_type === 'module' && !form.module_id) { showToast('Select a module.', 'error'); return; }
    if (form.target_type === 'level' && !form.challenge_id) { showToast('Select a level.', 'error'); return; }
    if (!window.confirm('Apply this reset operation? This may remove attempts, completions, badges, or XP.')) return;
    const payload = {
      target_type: form.target_type,
      module_id: form.target_type === 'module' ? Number(form.module_id) : null,
      challenge_id: form.target_type === 'level' ? Number(form.challenge_id) : null,
      clear_attempts: Boolean(form.clear_attempts), clear_completions: Boolean(form.clear_completions),
      clear_badges: Boolean(form.clear_badges), reset_streaks: Boolean(form.reset_streaks),
      set_xp_to: form.set_xp_to === '' ? null : Number(form.set_xp_to),
      reason: form.reason?.trim() || null,
    };
    setDetailBusy(true);
    try {
      const res = await fetch(`${API_URL}/admin/users/${detailUserId}/progress/reset`, {
        method: 'POST', headers: { ...authH(), 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const data = await parseResponse(res);
      showToast(data.message || 'Reset completed.');
      await fetchUserDetails(detailUserId);
      fetchUsers(page, search, roleFilter);
    } catch (err) {
      showToast(err.message || 'Failed to reset progress.', 'error');
    } finally { setDetailBusy(false); }
  };

  const handleGrantBadge = async (form) => {
    if (!detailUserId) return;
    if (!form.badge_id) { showToast('Select a badge.', 'error'); return; }
    const payload = { badge_id: Number(form.badge_id), force: Boolean(form.force), reason: form.reason?.trim() || null };
    setDetailBusy(true);
    try {
      const res = await fetch(`${API_URL}/admin/users/${detailUserId}/badges/grant`, {
        method: 'POST', headers: { ...authH(), 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const data = await parseResponse(res);
      showToast(data.message || 'Badge granted.');
      await fetchUserDetails(detailUserId);
      fetchUsers(page, search, roleFilter);
    } catch (err) {
      showToast(err.message || 'Failed to grant badge.', 'error');
    } finally { setDetailBusy(false); }
  };

  const handleRevokeBadge = async (badgeId, badgeName) => {
    if (!detailUserId) return;
    if (!window.confirm(`Revoke badge "${badgeName || badgeId}" from this user?`)) return;
    const reasonInput = window.prompt('Reason for badge revoke (optional):', '');
    if (reasonInput === null) return;
    const params = new URLSearchParams();
    if (reasonInput.trim()) params.set('reason', reasonInput.trim());
    const suffix = params.toString() ? `?${params}` : '';
    setDetailBusy(true);
    try {
      const res = await fetch(`${API_URL}/admin/users/${detailUserId}/badges/${badgeId}${suffix}`, {
        method: 'DELETE', headers: authH(),
      });
      const data = await parseResponse(res);
      showToast(data.message || 'Badge revoked.');
      await fetchUserDetails(detailUserId);
      fetchUsers(page, search, roleFilter);
    } catch (err) {
      showToast(err.message || 'Failed to revoke badge.', 'error');
    } finally { setDetailBusy(false); }
  };

  return (
    <div className="user-manager">
      {toastMsg && <div className={`um-toast ${toastMsg.type}`}>{toastMsg.msg}</div>}

      <div className="um-header">
        <div>
          <h2 className="um-title">User Manager</h2>
          <p className="um-subtitle">{total.toLocaleString()} total users · Page {page} of {totalPages}</p>
        </div>
      </div>

      <div className="um-filters">
        <div className="um-search-wrap">
          <svg className="um-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input type="text" className="um-search" placeholder="Search by name, username, or email"
            value={searchInput} onChange={handleSearchChange} />
        </div>
        <div className="um-role-tabs">
          {ROLE_OPTIONS.map((opt) => (
            <button key={opt.value} className={`role-tab ${roleFilter === opt.value ? 'active' : ''}`}
              onClick={() => { setRoleFilter(opt.value); setPage(1); }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="um-table-wrap">
        {loading && <div className="um-loading"><div className="um-spinner" /></div>}
        <table className="um-table">
          <thead>
            <tr>
              <th>User</th><th>Role</th><th>XP</th>
              <th>Joined</th><th>Last Login</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && !loading && (
              <tr><td colSpan="6" className="um-empty">No users found.</td></tr>
            )}
            {users.map((user) => (
              <tr key={user.id} className={user.is_banned ? 'banned-row' : ''}>
                <td>
                  <div className="um-user-cell">
                    {user.avatar_url
                      ? <img src={user.avatar_url} alt="" className="um-avatar-img" />
                      : <div className={`um-avatar-init ${user.role}`}>{getInitials(user)}</div>
                    }
                    <div className="um-user-info">
                      <span className="um-fullname">{toName(user)}</span>
                      <span className="um-username">@{user.username}</span>
                      <span className="um-email">{user.email}</span>
                    </div>
                  </div>
                </td>
                <td><RoleBadge role={user.role} banned={user.is_banned} /></td>
                <td><span className="um-xp">{(user.total_xp || 0).toLocaleString()} XP</span></td>
                <td className="um-date">{formatDate(user.created_at)}</td>
                <td className="um-date">{formatDateTime(user.last_login_at)}</td>
                <td>
                  <div className="um-action-wrap">
                    <button className="um-action-btn" onClick={() => setOpenMenu(openMenu === user.id ? null : user.id)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
                      </svg>
                    </button>
                    {openMenu === user.id && (
                      <ActionMenu user={user} isSelf={currentUserId === user.id}
                        onAction={handleAction} onOpenInsights={openUserInsights}
                        closeSelf={() => setOpenMenu(null)} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="um-pagination">
        <span className="um-page-info">
          Showing {Math.min((page - 1) * PER_PAGE + 1, total)}–{Math.min(page * PER_PAGE, total)} of {total.toLocaleString()}
        </span>
        <div className="um-page-btns">
          <button className="um-page-btn" onClick={() => setPage(1)} disabled={page === 1}>«</button>
          <button className="um-page-btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>‹ Prev</button>
          {[...Array(Math.min(5, totalPages))].map((_, i) => {
            const pg = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
            return <button key={pg} className={`um-page-btn ${pg === page ? 'active' : ''}`} onClick={() => setPage(pg)}>{pg}</button>;
          })}
          <button className="um-page-btn" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next ›</button>
          <button className="um-page-btn" onClick={() => setPage(totalPages)} disabled={page === totalPages}>»</button>
        </div>
      </div>

      <UserActivityModal
        open={detailOpen} data={detailData} loading={detailLoading}
        error={detailError} busy={detailBusy}
        onClose={() => setDetailOpen(false)}
        onRefresh={() => fetchUserDetails(detailUserId)}
        onAdjustXp={handleAdjustXp} onReset={handleReset}
        onGrantBadge={handleGrantBadge} onRevokeBadge={handleRevokeBadge}
      />
    </div>
  );
};

export default UserManager;
