import React, { useState, useEffect, useCallback, useRef } from 'react';
import './UserManager.css';

// Decode JWT to get current user's id without a library
const getCurrentUserId = () => {
  try {
    const token = localStorage.getItem('token');
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.id ?? null;
  } catch { return null; }
};

const ROLE_OPTIONS = [
  { value: 'all',     label: 'All Roles' },
  { value: 'student', label: 'Student' },
  { value: 'editor',  label: 'Editor' },
  { value: 'admin',   label: 'Admin' },
  { value: 'banned',  label: 'Banned' },
];

const RoleBadge = ({ role, banned }) => {
  if (banned) return <span className="role-badge banned">Banned</span>;
  if (role === 'admin')  return <span className="role-badge admin">Admin</span>;
  if (role === 'editor') return <span className="role-badge editor">Editor</span>;
  return <span className="role-badge student">Student</span>;
};

const ActionMenu = ({ user, isSelf, onAction, closeSelf }) => {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) closeSelf(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [closeSelf]);

  if (isSelf) {
    return (
      <div className="action-menu" ref={ref}>
        <p className="action-menu-self">⚠️ This is your account.<br/>You cannot manage yourself.</p>
      </div>
    );
  }

  return (
    <div className="action-menu" ref={ref}>
      {/* Role changes */}

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
      {/* Ban / unban */}
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
    </div>
  );
};

const UserManager = () => {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [openMenu, setOpenMenu] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);
  const PER_PAGE = 20;
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
      const res = await fetch(`/api/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to load users');
      setUsers(data.users);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(page, search, roleFilter); }, [page, roleFilter, fetchUsers]);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setPage(1); fetchUsers(1, val, roleFilter); }, 400);
  };

  const handleAction = async (userId, action, value) => {
    setOpenMenu(null);
    try {
      let url, method = 'PATCH';
      if (action === 'role') url = `/api/admin/users/${userId}/role?role=${value}`;
      else if (action === 'ban') url = `/api/admin/users/${userId}/ban?banned=${value}`;
      else if (action === 'delete') { url = `/api/admin/users/${userId}`; method = 'DELETE'; }

      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Action failed');
      showToast(data.message);
      fetchUsers(page, search, roleFilter);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const getInitials = (u) => {
    if (u.first_name && u.last_name) return `${u.first_name[0]}${u.last_name[0]}`.toUpperCase();
    return u.username.slice(0, 2).toUpperCase();
  };

  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="user-manager">
      {/* Toast */}
      {toastMsg && (
        <div className={`um-toast ${toastMsg.type}`}>{toastMsg.msg}</div>
      )}

      {/* Header */}
      <div className="um-header">
        <div>
          <h2 className="um-title">User Manager</h2>
          <p className="um-subtitle">
            {total.toLocaleString()} total users · Page {page} of {totalPages}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="um-filters">
        <div className="um-search-wrap">
          <svg className="um-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            className="um-search"
            placeholder="Search by name, username, or email…"
            value={search}
            onChange={handleSearchChange}
          />
        </div>
        <div className="um-role-tabs">
          {ROLE_OPTIONS.map(opt => (
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

      {/* Table */}
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
            {users.map(user => (
              <tr key={user.id} className={user.is_banned ? 'banned-row' : ''}>
                <td>
                  <div className="um-user-cell">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="" className="um-avatar-img" />
                    ) : (
                      <div className={`um-avatar-init ${user.role}`}>{getInitials(user)}</div>
                    )}
                    <div className="um-user-info">
                      <span className="um-fullname">
                        {user.first_name || user.last_name
                          ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim()
                          : user.username}
                      </span>
                      <span className="um-username">@{user.username}</span>
                      <span className="um-email">{user.email}</span>
                    </div>
                  </div>
                </td>
                <td><RoleBadge role={user.role} banned={user.is_banned} /></td>
                <td><span className="um-xp">{user.total_xp.toLocaleString()} XP</span></td>
                <td className="um-date">{formatDate(user.created_at)}</td>
                <td className="um-date">{formatDate(user.last_login_at)}</td>
                <td>
                  <div className="um-action-wrap">
                    <button
                      className="um-action-btn"
                      onClick={() => setOpenMenu(openMenu === user.id ? null : user.id)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
                    </button>
                    {openMenu === user.id && (
                      <ActionMenu
                        user={user}
                        isSelf={currentUserId === user.id}
                        onAction={handleAction}
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

      {/* Pagination */}
      <div className="um-pagination">
        <span className="um-page-info">
          Showing {Math.min((page - 1) * PER_PAGE + 1, total)}–{Math.min(page * PER_PAGE, total)} of {total.toLocaleString()}
        </span>
        <div className="um-page-btns">
          <button className="um-page-btn" onClick={() => setPage(1)} disabled={page === 1}>«</button>
          <button className="um-page-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹ Prev</button>
          {[...Array(Math.min(5, totalPages))].map((_, i) => {
            const pg = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
            return (
              <button
                key={pg}
                className={`um-page-btn ${pg === page ? 'active' : ''}`}
                onClick={() => setPage(pg)}
              >{pg}</button>
            );
          })}
          <button className="um-page-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next ›</button>
          <button className="um-page-btn" onClick={() => setPage(totalPages)} disabled={page === totalPages}>»</button>
        </div>
      </div>
    </div>
  );
};

export default UserManager;
