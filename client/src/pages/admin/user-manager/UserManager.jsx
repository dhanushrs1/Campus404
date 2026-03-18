import React, { useCallback, useEffect, useRef, useState } from 'react';
import { API_URL } from '../../../config';
import './UserManager.css';

const token = () => localStorage.getItem('token');
const authH = () => ({ Authorization: `Bearer ${token()}` });

const parseResponse = async (res) => {
  const raw = await res.text();
  let data = null;

  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new Error(data?.detail || data?.message || raw || `Request failed (${res.status})`);
  }

  return data;
};

const getCurrentUserId = () => {
  try {
    const jwt = token();
    if (!jwt) return null;
    const payload = JSON.parse(atob(jwt.split('.')[1]));
    return payload.id ?? null;
  } catch {
    return null;
  }
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
  if (user.first_name || user.last_name) {
    return `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim();
  }
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
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
};

const formatAuditAction = (action) => {
  if (!action) return 'Unknown action';
  const map = {
    'user.xp.increase': 'XP increased',
    'user.xp.decrease': 'XP decreased',
    'user.xp.set': 'XP set',
    'user.xp.reset': 'XP reset',
    'user.progress.reset': 'Progress reset',
    'user.badge.grant': 'Badge granted',
    'user.badge.revoke': 'Badge revoked',
    'user.role.update': 'Role updated',
    'user.ban.update': 'Ban status updated',
    'user.delete': 'User deleted',
  };
  return map[action] || action;
};

const RoleBadge = ({ role, banned }) => {
  if (banned) return <span className="role-badge banned">Banned</span>;
  if (role === 'admin') return <span className="role-badge admin">Admin</span>;
  if (role === 'editor') return <span className="role-badge editor">Editor</span>;
  return <span className="role-badge student">Student</span>;
};

const ActionMenu = ({ user, isSelf, onAction, onOpenInsights, closeSelf }) => {
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) closeSelf();
    };
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

const UserActivityModal = ({
  open,
  data,
  loading,
  error,
  busy,
  onClose,
  onRefresh,
  onAdjustXp,
  onReset,
  onGrantBadge,
  onRevokeBadge,
}) => {
  const [xpForm, setXpForm] = useState({ operation: 'increase', amount: 50, reason: '' });
  const [resetForm, setResetForm] = useState({
    target_type: 'module',
    module_id: '',
    challenge_id: '',
    clear_attempts: true,
    clear_completions: true,
    clear_badges: false,
    reset_streaks: false,
    set_xp_to: '',
    reason: '',
  });
  const [badgeForm, setBadgeForm] = useState({ badge_id: '', force: false, reason: '' });

  if (!open) return null;

  const user = data?.user;
  const summary = data?.summary;

  const defaultModuleId = data?.reset_options?.modules?.[0]
    ? String(data.reset_options.modules[0].module_id)
    : '';
  const defaultLevelId = data?.reset_options?.levels?.[0]
    ? String(data.reset_options.levels[0].challenge_id)
    : '';
  const defaultBadgeId = data?.badge_catalog?.find((badge) => !badge.already_owned)
    ? String(data.badge_catalog.find((badge) => !badge.already_owned).badge_id)
    : '';

  const resolvedModuleId = resetForm.module_id || defaultModuleId;
  const resolvedLevelId = resetForm.challenge_id || defaultLevelId;
  const resolvedBadgeId = badgeForm.badge_id || defaultBadgeId;
  const selectedBadge = data?.badge_catalog?.find((badge) => Number(badge.badge_id) === Number(resolvedBadgeId));

  return (
    <div className="um-modal-backdrop" onClick={onClose}>
      <div className="um-modal" onClick={(e) => e.stopPropagation()}>
        <div className="um-modal-header">
          <div className="um-modal-user">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" className="um-modal-avatar" />
            ) : (
              <div className={`um-modal-avatar-init ${user?.role || 'student'}`}>{getInitials(user)}</div>
            )}
            <div>
              <h3>{toName(user)}</h3>
              <p>@{user?.username} · {user?.email}</p>
              <div className="um-modal-meta-row">
                <RoleBadge role={user?.role} banned={Boolean(user?.is_banned)} />
                <span>{user?.is_verified ? 'Verified' : 'Unverified'}</span>
                <span>Joined {formatDate(user?.created_at)}</span>
                <span>Last login {formatDateTime(user?.last_login_at)}</span>
              </div>
            </div>
          </div>

          <div className="um-modal-header-actions">
            <button type="button" className="um-ghost-btn" onClick={onRefresh} disabled={loading || busy}>Refresh</button>
            <button type="button" className="um-close-btn" onClick={onClose}>Close</button>
          </div>
        </div>

        <div className="um-modal-content">
          {loading && (
            <div className="um-modal-loading">
              <div className="um-spinner" />
            </div>
          )}

          {!loading && error && (
            <div className="um-modal-error">
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && data && (
            <>
              <section className="um-insight-grid">
                <div className="um-insight-card"><small>Total XP</small><strong>{(user?.total_xp || 0).toLocaleString()}</strong></div>
                <div className="um-insight-card"><small>Levels Attended</small><strong>{summary?.levels_attended ?? 0}</strong></div>
                <div className="um-insight-card"><small>Total Attempts</small><strong>{summary?.total_attempts ?? 0}</strong></div>
                <div className="um-insight-card"><small>Levels Completed</small><strong>{summary?.levels_completed ?? 0}/{summary?.published_levels ?? 0}</strong></div>
                <div className="um-insight-card"><small>Completion Rate</small><strong>{summary?.completion_percent ?? 0}%</strong></div>
                <div className="um-insight-card"><small>Badges Earned</small><strong>{summary?.badges_earned ?? 0}</strong></div>
              </section>

              <section className="um-panel-section">
                <h4>Progress by Module</h4>
                {(data.module_progress || []).length === 0 ? (
                  <p className="um-soft-empty">No module progress yet.</p>
                ) : (
                  <div className="um-module-list">
                    {data.module_progress.map((mod) => (
                      <details key={mod.module_id} className="um-module-card">
                        <summary>
                          <div>
                            <strong>{mod.module_title}</strong>
                            <span>{mod.lab_title}</span>
                          </div>
                          <div className="um-module-metrics">
                            <span>{mod.completed_levels}/{mod.published_levels} completed</span>
                            <span>{mod.attended_levels} attended</span>
                            <span>{mod.module_earned_xp}/{mod.module_total_xp} XP</span>
                            <span>{mod.progress_percent}%</span>
                          </div>
                        </summary>
                        <div className="um-levels-table-wrap">
                          <table className="um-levels-table">
                            <thead>
                              <tr>
                                <th>Level</th>
                                <th>Type</th>
                                <th>Status</th>
                                <th>Attempts</th>
                                <th>XP</th>
                                <th>Latest</th>
                              </tr>
                            </thead>
                            <tbody>
                              {mod.levels.map((level) => (
                                <tr key={level.challenge_id}>
                                  <td>{level.display_title}</td>
                                  <td>{level.challenge_type}</td>
                                  <td>{level.is_completed ? 'Completed' : (level.attempt_count > 0 ? 'Attempted' : 'Not started')}</td>
                                  <td>{level.attempt_count}</td>
                                  <td>{level.xp_awarded}/{level.xp_reward}</td>
                                  <td>{formatDateTime(level.last_attempt_at || level.completed_at)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    ))}
                  </div>
                )}
              </section>

              <section className="um-panel-section">
                <h4>Recent Activity</h4>
                {(data.recent_activity || []).length === 0 ? (
                  <p className="um-soft-empty">No activity found.</p>
                ) : (
                  <div className="um-activity-list">
                    {data.recent_activity.map((item, idx) => (
                      <div key={`${item.type}-${item.challenge_id}-${idx}`} className="um-activity-item">
                        <div className={`um-activity-dot ${item.type === 'completion' ? 'done' : (item.passed ? 'pass' : 'try')}`} />
                        <div>
                          <p>
                            <strong>{item.type === 'completion' ? 'Completion' : 'Attempt'}</strong>
                            {' · '}
                            {item.display_title}
                            {' · '}
                            {item.module_title}
                            {item.type === 'attempt' ? ` · Attempt #${item.attempt_number}` : ''}
                            {item.type === 'attempt' ? ` · ${item.passed ? 'Passed' : 'Failed'}` : ''}
                            {' · '}
                            XP {item.xp_awarded || 0}
                          </p>
                          <span>{formatDateTime(item.occurred_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="um-panel-section">
                <h4>Admin Audit Trail</h4>
                {(data.recent_admin_actions || []).length === 0 ? (
                  <p className="um-soft-empty">No admin actions recorded for this user yet.</p>
                ) : (
                  <div className="um-audit-list">
                    {data.recent_admin_actions.map((entry) => {
                      const context = entry.context || {};
                      const contextParts = Object.entries(context)
                        .filter(([, value]) => value !== null && value !== undefined && value !== '')
                        .slice(0, 5)
                        .map(([key, value]) => `${key}: ${typeof value === 'boolean' ? String(value) : value}`);

                      return (
                        <div key={entry.audit_id} className="um-audit-item">
                          <div className="um-audit-head">
                            <strong>{formatAuditAction(entry.action)}</strong>
                            <span>{formatDateTime(entry.created_at)}</span>
                          </div>
                          <p>
                            By {entry.actor_display_name || entry.actor_username || `Admin #${entry.actor_admin_id || 'unknown'}`}
                            {entry.reason ? ` · Reason: ${entry.reason}` : ''}
                          </p>
                          {contextParts.length > 0 && (
                            <small>{contextParts.join(' · ')}</small>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="um-panel-section">
                <h4>Custom Admin Controls</h4>
                <div className="um-control-grid">
                  <div className="um-control-card">
                    <h5>Adjust XP</h5>
                    <label>Operation</label>
                    <select
                      value={xpForm.operation}
                      onChange={(e) => setXpForm((prev) => ({ ...prev, operation: e.target.value }))}
                    >
                      <option value="increase">Increase XP</option>
                      <option value="decrease">Decrease XP</option>
                      <option value="set">Set Exact XP</option>
                      <option value="reset">Reset XP to 0</option>
                    </select>

                    {xpForm.operation !== 'reset' && (
                      <>
                        <label>Amount</label>
                        <input
                          type="number"
                          min="0"
                          value={xpForm.amount}
                          onChange={(e) => setXpForm((prev) => ({ ...prev, amount: e.target.value }))}
                        />
                      </>
                    )}

                    <label>Reason (optional)</label>
                    <input
                      value={xpForm.reason}
                      onChange={(e) => setXpForm((prev) => ({ ...prev, reason: e.target.value }))}
                      placeholder="Support adjustment note"
                    />

                    <button
                      type="button"
                      className="um-primary-btn"
                      disabled={busy}
                      onClick={() => onAdjustXp(xpForm)}
                    >
                      Apply XP Update
                    </button>
                  </div>

                  <div className="um-control-card">
                    <h5>Reset Progress</h5>
                    <label>Target</label>
                    <select
                      value={resetForm.target_type}
                      onChange={(e) => setResetForm((prev) => ({ ...prev, target_type: e.target.value }))}
                    >
                      <option value="module">Specific Module</option>
                      <option value="level">Specific Level</option>
                      <option value="all">All Progress</option>
                    </select>

                    {resetForm.target_type === 'module' && (
                      <>
                        <label>Module</label>
                        <select
                          value={resolvedModuleId}
                          onChange={(e) => setResetForm((prev) => ({ ...prev, module_id: e.target.value }))}
                        >
                          <option value="">Select module</option>
                          {(data.reset_options?.modules || []).map((module) => (
                            <option key={module.module_id} value={module.module_id}>
                              {module.lab_title} · {module.module_title}
                            </option>
                          ))}
                        </select>
                      </>
                    )}

                    {resetForm.target_type === 'level' && (
                      <>
                        <label>Level</label>
                        <select
                          value={resolvedLevelId}
                          onChange={(e) => setResetForm((prev) => ({ ...prev, challenge_id: e.target.value }))}
                        >
                          <option value="">Select level</option>
                          {(data.reset_options?.levels || []).map((level) => (
                            <option key={level.challenge_id} value={level.challenge_id}>
                              {level.lab_title} · {level.module_title} · {level.display_title}
                            </option>
                          ))}
                        </select>
                      </>
                    )}

                    <div className="um-check-grid">
                      <label><input type="checkbox" checked={resetForm.clear_attempts} onChange={(e) => setResetForm((prev) => ({ ...prev, clear_attempts: e.target.checked }))} /> Clear attempts</label>
                      <label><input type="checkbox" checked={resetForm.clear_completions} onChange={(e) => setResetForm((prev) => ({ ...prev, clear_completions: e.target.checked }))} /> Clear completions</label>
                      <label><input type="checkbox" checked={resetForm.clear_badges} onChange={(e) => setResetForm((prev) => ({ ...prev, clear_badges: e.target.checked }))} /> Clear related badges</label>
                      <label><input type="checkbox" checked={resetForm.reset_streaks} onChange={(e) => setResetForm((prev) => ({ ...prev, reset_streaks: e.target.checked }))} /> Reset streaks</label>
                    </div>

                    <label>Set XP to (optional)</label>
                    <input
                      type="number"
                      min="0"
                      value={resetForm.set_xp_to}
                      onChange={(e) => setResetForm((prev) => ({ ...prev, set_xp_to: e.target.value }))}
                      placeholder="Leave empty to auto-recalculate"
                    />

                    <label>Reason (optional)</label>
                    <input
                      value={resetForm.reason}
                      onChange={(e) => setResetForm((prev) => ({ ...prev, reason: e.target.value }))}
                      placeholder="Reset note"
                    />

                    <button
                      type="button"
                      className="um-danger-btn"
                      disabled={busy}
                      onClick={() => onReset({
                        ...resetForm,
                        module_id: resolvedModuleId,
                        challenge_id: resolvedLevelId,
                      })}
                    >
                      Run Reset
                    </button>
                  </div>

                  <div className="um-control-card">
                    <h5>Badge Manual Controls</h5>
                    <label>Badge</label>
                    <select
                      value={resolvedBadgeId}
                      onChange={(e) => setBadgeForm((prev) => ({ ...prev, badge_id: e.target.value }))}
                    >
                      <option value="">Select badge</option>
                      {(data.badge_catalog || []).map((badge) => (
                        <option key={badge.badge_id} value={badge.badge_id}>
                          {badge.name} {badge.already_owned ? '[Owned]' : badge.eligible ? '[Eligible]' : '[Needs validation]'}
                        </option>
                      ))}
                    </select>

                    {selectedBadge && (
                      <p className={`um-badge-hint ${selectedBadge.eligible ? 'ok' : 'warn'}`}>
                        {selectedBadge.validation_message}
                      </p>
                    )}

                    <label className="um-force-check">
                      <input
                        type="checkbox"
                        checked={badgeForm.force}
                        onChange={(e) => setBadgeForm((prev) => ({ ...prev, force: e.target.checked }))}
                      />
                      Force grant if validation fails
                    </label>

                    <label>Reason (optional)</label>
                    <input
                      value={badgeForm.reason}
                      onChange={(e) => setBadgeForm((prev) => ({ ...prev, reason: e.target.value }))}
                      placeholder="Support issue, manual override, etc."
                    />

                    <button
                      type="button"
                      className="um-primary-btn"
                      disabled={busy}
                      onClick={() => onGrantBadge({ ...badgeForm, badge_id: resolvedBadgeId })}
                    >
                      Grant Badge
                    </button>

                    <div className="um-owned-badge-list">
                      <h6>Owned Badges</h6>
                      {(data.owned_badges || []).length === 0 ? (
                        <p className="um-soft-empty">No badges earned yet.</p>
                      ) : (
                        data.owned_badges.map((badge) => (
                          <div key={badge.badge_id} className="um-owned-badge-row">
                            <div>
                              <strong>{badge.name}</strong>
                              <span>{badge.module_title || 'Standalone badge'}</span>
                            </div>
                            <button type="button" className="um-link-danger" disabled={busy} onClick={() => onRevokeBadge(badge.badge_id, badge.name)}>
                              Revoke
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

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

  useEffect(() => {
    fetchUsers(page, search, roleFilter);
  }, [page, roleFilter, search, fetchUsers]);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchInput(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      setSearch(value);
    }, 350);
  };

  const handleAction = async (userId, action, value) => {
    setOpenMenu(null);
    try {
      let url = '';
      let method = 'PATCH';
      let reasonInput = '';

      if (action === 'role') {
        reasonInput = window.prompt('Reason for role change (optional):', '') ?? '';
      } else if (action === 'ban') {
        reasonInput = window.prompt('Reason for ban status change (optional):', '') ?? '';
      }

      if (action === 'role') {
        const params = new URLSearchParams({ role: String(value) });
        if (reasonInput.trim()) params.set('reason', reasonInput.trim());
        url = `${API_URL}/admin/users/${userId}/role?${params.toString()}`;
      } else if (action === 'ban') {
        const params = new URLSearchParams({ banned: String(value) });
        if (reasonInput.trim()) params.set('reason', reasonInput.trim());
        url = `${API_URL}/admin/users/${userId}/ban?${params.toString()}`;
      } else if (action === 'delete') {
        method = 'DELETE';
        if (!window.confirm('Delete this user permanently? This cannot be undone.')) return;
        reasonInput = window.prompt('Reason for permanent deletion (optional):', '') ?? '';
        const params = new URLSearchParams();
        if (reasonInput.trim()) params.set('reason', reasonInput.trim());
        const suffix = params.toString() ? `?${params.toString()}` : '';
        url = `${API_URL}/admin/users/${userId}${suffix}`;
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

    const payload = {
      operation: form.operation,
      amount: form.operation === 'reset' ? 0 : Number(form.amount || 0),
      reason: form.reason?.trim() || null,
    };

    setDetailBusy(true);
    try {
      const res = await fetch(`${API_URL}/admin/users/${detailUserId}/xp`, {
        method: 'POST',
        headers: { ...authH(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await parseResponse(res);
      showToast(data.message || 'XP updated.');
      await fetchUserDetails(detailUserId);
      fetchUsers(page, search, roleFilter);
    } catch (err) {
      showToast(err.message || 'Failed to update XP.', 'error');
    } finally {
      setDetailBusy(false);
    }
  };

  const handleReset = async (form) => {
    if (!detailUserId) return;

    if (form.target_type === 'module' && !form.module_id) {
      showToast('Select a module to reset.', 'error');
      return;
    }
    if (form.target_type === 'level' && !form.challenge_id) {
      showToast('Select a level to reset.', 'error');
      return;
    }

    if (!window.confirm('Apply this reset operation? This may remove attempts, completions, badges, or XP.')) {
      return;
    }

    const payload = {
      target_type: form.target_type,
      module_id: form.target_type === 'module' ? Number(form.module_id) : null,
      challenge_id: form.target_type === 'level' ? Number(form.challenge_id) : null,
      clear_attempts: Boolean(form.clear_attempts),
      clear_completions: Boolean(form.clear_completions),
      clear_badges: Boolean(form.clear_badges),
      reset_streaks: Boolean(form.reset_streaks),
      set_xp_to: form.set_xp_to === '' ? null : Number(form.set_xp_to),
      reason: form.reason?.trim() || null,
    };

    setDetailBusy(true);
    try {
      const res = await fetch(`${API_URL}/admin/users/${detailUserId}/progress/reset`, {
        method: 'POST',
        headers: { ...authH(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await parseResponse(res);
      showToast(data.message || 'Reset completed.');
      await fetchUserDetails(detailUserId);
      fetchUsers(page, search, roleFilter);
    } catch (err) {
      showToast(err.message || 'Failed to reset progress.', 'error');
    } finally {
      setDetailBusy(false);
    }
  };

  const handleGrantBadge = async (form) => {
    if (!detailUserId) return;
    if (!form.badge_id) {
      showToast('Select a badge to grant.', 'error');
      return;
    }

    const payload = {
      badge_id: Number(form.badge_id),
      force: Boolean(form.force),
      reason: form.reason?.trim() || null,
    };

    setDetailBusy(true);
    try {
      const res = await fetch(`${API_URL}/admin/users/${detailUserId}/badges/grant`, {
        method: 'POST',
        headers: { ...authH(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await parseResponse(res);
      showToast(data.message || 'Badge granted.');
      await fetchUserDetails(detailUserId);
      fetchUsers(page, search, roleFilter);
    } catch (err) {
      showToast(err.message || 'Failed to grant badge.', 'error');
    } finally {
      setDetailBusy(false);
    }
  };

  const handleRevokeBadge = async (badgeId, badgeName) => {
    if (!detailUserId) return;
    if (!window.confirm(`Revoke badge "${badgeName || badgeId}" from this user?`)) return;

    const reasonInput = window.prompt('Reason for badge revoke (optional):', '');
    if (reasonInput === null) return;

    const params = new URLSearchParams();
    if (reasonInput.trim()) params.set('reason', reasonInput.trim());
    const querySuffix = params.toString() ? `?${params.toString()}` : '';

    setDetailBusy(true);
    try {
      const res = await fetch(`${API_URL}/admin/users/${detailUserId}/badges/${badgeId}${querySuffix}`, {
        method: 'DELETE',
        headers: authH(),
      });
      const data = await parseResponse(res);
      showToast(data.message || 'Badge revoked.');
      await fetchUserDetails(detailUserId);
      fetchUsers(page, search, roleFilter);
    } catch (err) {
      showToast(err.message || 'Failed to revoke badge.', 'error');
    } finally {
      setDetailBusy(false);
    }
  };

  return (
    <div className="user-manager">
      {toastMsg && <div className={`um-toast ${toastMsg.type}`}>{toastMsg.msg}</div>}

      <div className="um-header">
        <div>
          <h2 className="um-title">User Manager</h2>
          <p className="um-subtitle">
            {total.toLocaleString()} total users · Page {page} of {totalPages}
          </p>
        </div>
      </div>

      <div className="um-filters">
        <div className="um-search-wrap">
          <svg className="um-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            className="um-search"
            placeholder="Search by name, username, or email"
            value={searchInput}
            onChange={handleSearchChange}
          />
        </div>

        <div className="um-role-tabs">
          {ROLE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`role-tab ${roleFilter === opt.value ? 'active' : ''}`}
              onClick={() => { setRoleFilter(opt.value); setPage(1); }}
            >
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
              <th>User</th>
              <th>Role</th>
              <th>XP</th>
              <th>Joined</th>
              <th>Last Login</th>
              <th>Actions</th>
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
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="" className="um-avatar-img" />
                    ) : (
                      <div className={`um-avatar-init ${user.role}`}>{getInitials(user)}</div>
                    )}

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
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" /></svg>
                    </button>

                    {openMenu === user.id && (
                      <ActionMenu
                        user={user}
                        isSelf={currentUserId === user.id}
                        onAction={handleAction}
                        onOpenInsights={openUserInsights}
                        closeSelf={() => setOpenMenu(null)}
                      />
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
          Showing {Math.min((page - 1) * PER_PAGE + 1, total)}-{Math.min(page * PER_PAGE, total)} of {total.toLocaleString()}
        </span>

        <div className="um-page-btns">
          <button className="um-page-btn" onClick={() => setPage(1)} disabled={page === 1}>«</button>
          <button className="um-page-btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>‹ Prev</button>
          {[...Array(Math.min(5, totalPages))].map((_, i) => {
            const pg = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
            return (
              <button key={pg} className={`um-page-btn ${pg === page ? 'active' : ''}`} onClick={() => setPage(pg)}>{pg}</button>
            );
          })}
          <button className="um-page-btn" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next ›</button>
          <button className="um-page-btn" onClick={() => setPage(totalPages)} disabled={page === totalPages}>»</button>
        </div>
      </div>

      <UserActivityModal
        open={detailOpen}
        data={detailData}
        loading={detailLoading}
        error={detailError}
        busy={detailBusy}
        onClose={() => setDetailOpen(false)}
        onRefresh={() => fetchUserDetails(detailUserId)}
        onAdjustXp={handleAdjustXp}
        onReset={handleReset}
        onGrantBadge={handleGrantBadge}
        onRevokeBadge={handleRevokeBadge}
      />
    </div>
  );
};

export default UserManager;
