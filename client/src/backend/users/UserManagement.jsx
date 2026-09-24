import { useEffect, useState, useMemo } from "react";
import { 
  Search, 
  ShieldAlert, 
  Shield, 
  User as UserIcon, 
  PenTool, 
  Loader2,
  X,
  History,
  Ban,
  ShieldOff,
  ShieldCheck,
  MonitorSmartphone,
  Globe2,
  GraduationCap,
  Lock,
  RefreshCw
} from "lucide-react";
import { apiUrl } from "../../shared/api.js";
import { authenticatedFetch } from "../../shared/authSession.js";
import "./UserManagement.css";

const ELEVATED_ROLES = new Set(["ADMIN", "EDITOR"]);
const SESSION_EXPIRED_ERROR = "__SESSION_EXPIRED__";

function normalizeRole(role) {
  const normalized = String(role ?? "").trim().toLowerCase();
  if (normalized === "user") return "student";
  return normalized || "student";
}

function normalizeUserRecord(user) {
  const parsedId = Number(user?.id);

  return {
    id: Number.isFinite(parsedId) ? parsedId : -1,
    email: String(user?.email ?? "").trim() || "unknown@example.com",
    first_name: String(user?.first_name ?? "").trim() || "Unknown",
    last_name: String(user?.last_name ?? "").trim(),
    username: String(user?.username ?? "").trim() || "unknown",
    auth_provider: String(user?.auth_provider ?? "oauth").trim() || "oauth",
    role: normalizeRole(user?.role),
    is_active: typeof user?.is_active === "boolean" ? user.is_active : true,
    ban_reason: user?.ban_reason ?? null,
    created_at: user?.created_at ?? new Date().toISOString(),
    last_login: user?.last_login ?? null,
    avatar: user?.avatar || null,
  };
}

function titleCaseRole(role) {
  const normalized = normalizeRole(role);
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatDate(value, includeTime = false) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

function UserAvatar({ avatar, initial }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [avatar]);

  const showImage = Boolean(avatar) && !failed;
  return (
    <div className={`um-avatar ${showImage ? "has-image" : ""}`}>
      {showImage ? (
        <img className="um-avatar__image" src={avatar} alt="" onError={() => setFailed(true)} />
      ) : (
        initial
      )}
    </div>
  );
}



function ActivityModal({ user, onClose, onSessionExpired }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const res = await authenticatedFetch(apiUrl(`/auth/admin/users/${user.id}/sessions`));
        if (res.status === 401) {
          onSessionExpired?.();
          throw new Error(SESSION_EXPIRED_ERROR);
        }
        if (!res.ok) throw new Error("Failed to fetch sessions.");
        const data = await res.json();
        setSessions(data);
      } catch (err) {
        if (err.message !== SESSION_EXPIRED_ERROR) setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchActivities();
  }, [user.id, onSessionExpired]);

  return (
    <div className="um-modal-overlay">
      <div className="um-modal um-modal--large" role="dialog" aria-modal="true" aria-labelledby="um-activity-title">
        <div className="um-modal__header">
          <h3 id="um-activity-title">Activity Log: @{user.username}</h3>
          <button type="button" className="um-modal__close" onClick={onClose} aria-label="Close activity log"><X size={18} /></button>
        </div>
        <div className="um-activity-content">
          {loading ? (
            <div className="um-activity-empty"><Loader2 className="um-spin" size={24} /></div>
          ) : error ? (
            <div className="um-activity-empty is-error">{error}</div>
          ) : sessions.length === 0 ? (
            <div className="um-activity-empty">No activity found for this user.</div>
          ) : (
            <div className="um-timeline">
              {sessions.map((session, i) => (
                <div key={session.id} className="um-timeline-item">
                  <div className={`um-timeline-dot ${i === 0 && !session.logout_time ? 'um-timeline-dot--active' : 'um-timeline-dot--login'}`} />
                  <div className="um-timeline-card">
                    <div className="um-timeline-header">
                      <span className={`um-timeline-status ${!session.logout_time ? 'um-timeline-status--online' : ''}`}>
                        {!session.logout_time ? "Active Session" : "Logged Out"}
                      </span>
                      <span className="um-timeline-time">
                        {new Date(session.login_time).toLocaleString(undefined, {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <div className="um-timeline-details">
                      {session.ip_address && (
                        <p><Globe2 size={12} /> {session.ip_address}</p>
                      )}
                      {session.device_info && (
                        <p><MonitorSmartphone size={12} /> {session.device_info}</p>
                      )}
                      {session.logout_time && (
                        <p><History size={12} /> Logged out at {new Date(session.logout_time).toLocaleTimeString(undefined, {hour: '2-digit', minute:'2-digit'})}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RoleModal({ user, currentRole, onClose, onConfirm }) {
  const [role, setRole] = useState(currentRole);

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm(user.id, role);
  };

  const options = [
    { value: "student", label: "Student", desc: "Standard user account with base permissions." },
    { value: "editor", label: "Editor", desc: "Can manage curriculum tasks and edit content." },
    { value: "admin", label: "Admin", desc: "Full access to user management and platform settings." }
  ];

  if (!user) return null;

  return (
    <div className="um-modal-overlay">
      <div className="um-modal" role="dialog" aria-modal="true" aria-labelledby="um-role-title">
        <div className="um-modal__header">
          <h3 id="um-role-title">Change Role: @{user.username}</h3>
          <button type="button" className="um-modal__close" onClick={onClose} aria-label="Close role dialog"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="um-modal__body">
          <p className="um-modal__desc">
            Select the permissions this account should receive when staged changes are saved.
          </p>
          <div className="um-input-group">
            {options.map((opt) => (
              <label 
                key={opt.value} 
                className={`um-role-option ${role === opt.value ? 'um-role-option--selected' : ''}`}
              >
                <input 
                  type="radio" 
                  name="role" 
                  value={opt.value} 
                  checked={role === opt.value} 
                  onChange={() => setRole(opt.value)} 
                />
                <div className="um-role-option__info">
                  <strong>{opt.label}</strong>
                  <span>{opt.desc}</span>
                </div>
              </label>
            ))}
          </div>
          <div className="um-modal__actions">
            <button type="button" className="um-btn um-btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="um-btn um-btn--primary">Stage Role</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BanModal({ user, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await onConfirm(user.id, reason, user.is_active);
    setLoading(false);
  };

  if (!user) return null;

  return (
    <div className="um-modal-overlay">
      <div className="um-modal" role="dialog" aria-modal="true" aria-labelledby="um-ban-title">
        <div className="um-modal__header">
          <h3 id="um-ban-title">Ban User: @{user.username}</h3>
          <button type="button" className="um-modal__close" onClick={onClose} aria-label="Close ban dialog"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="um-modal__body">
          <p className="um-modal__desc">
            This will stage a ban for <strong>{user.first_name}</strong> until the pending changes are saved.
          </p>
          <div className="um-input-group">
            <label>Reason for Ban *</label>
            <textarea 
              value={reason} 
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Violation of community guidelines..."
              required
              rows={3}
            />
          </div>
          <div className="um-modal__actions">
            <button type="button" className="um-btn um-btn--ghost" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="um-btn um-btn--danger" disabled={loading || !reason.trim()}>
              {loading ? <Loader2 size={16} className="um-spin" /> : "Stage Ban"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function UserManagement({
  role: currentUserRole,
  username: currentUsername,
  onSessionExpired,
}) {
  const normalizedCurrentRole = (currentUserRole || "").toUpperCase();
  const canViewUsers = ELEVATED_ROLES.has(normalizedCurrentRole);
  const canManageUsers = normalizedCurrentRole === "ADMIN";

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [banModalUser, setBanModalUser] = useState(null);
  const [roleModalUser, setRoleModalUser] = useState(null);
  const [activityModalUser, setActivityModalUser] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [pendingChanges, setPendingChanges] = useState({});

  const clearPendingForUser = (userId) => {
    setPendingChanges((prev) => {
      if (!prev[userId]) return prev;
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  };

  const stageRoleChange = (userId, nextRole, baseRole) => {
    const normalizedNext = normalizeRole(nextRole);
    const normalizedBase = normalizeRole(baseRole);

    setPendingChanges((prev) => {
      const existing = prev[userId] || {};
      const next = { ...existing };

      if (normalizedNext === normalizedBase) {
        delete next.role;
      } else {
        next.role = normalizedNext;
      }

      if (next.role === undefined && next.is_active === undefined) {
        const updated = { ...prev };
        delete updated[userId];
        return updated;
      }

      return { ...prev, [userId]: next };
    });
  };

  const stageStatusChange = (userId, isActive, banReason = null) => {
    const normalizedNext = Boolean(isActive);
    const baseUser = users.find((user) => user.id === userId);
    const normalizedBase = Boolean(baseUser?.is_active);

    setPendingChanges((prev) => {
      const existing = prev[userId] || {};
      const next = { ...existing };

      if (normalizedNext === normalizedBase) {
        delete next.is_active;
        delete next.ban_reason;
      } else {
        next.is_active = normalizedNext;
        next.ban_reason = normalizedNext ? null : (banReason || "No reason provided").trim();
      }

      if (next.role === undefined && next.is_active === undefined) {
        const updated = { ...prev };
        delete updated[userId];
        return updated;
      }

      return { ...prev, [userId]: next };
    });
  };

  const fetchUsers = async ({ silent = false } = {}) => {
    if (!canViewUsers) {
      setUsers([]);
      setPendingChanges({});
      setLoading(false);
      return;
    }

    try {
      if (!silent) {
        setLoading(true);
      }
      setIsRefreshing(true);
      setErrorMessage("");

      const res = await authenticatedFetch(apiUrl("/auth/admin/users"));

      if (res.status === 401) {
        onSessionExpired?.();
        throw new Error(SESSION_EXPIRED_ERROR);
      }

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.detail ?? `Unable to load users (${res.status}).`);
      }

      const rawUsers = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
          ? data.items
          : [];

      const normalizedUsers = rawUsers.map(normalizeUserRecord);
      setUsers(normalizedUsers);
      setPendingChanges({});
    } catch (e) {
      if (e instanceof Error && e.message === SESSION_EXPIRED_ERROR) {
        return;
      }
      console.error("Failed to fetch users", e);
      setUsers([]);
      setErrorMessage(e instanceof Error ? e.message : "Failed to load users.");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [canViewUsers]);

  const handleSaveAllChanges = async (e) => {
    if (e) e.preventDefault();
    if (!canManageUsers) return;

    if (Object.keys(pendingChanges).length === 0) return;

    setActionLoading("global-save");
    try {
      setErrorMessage("");
      
      const newUsersList = [...users];

      for (const [userIdStr, pending] of Object.entries(pendingChanges)) {
        const userId = Number(userIdStr);
        let userIndex = newUsersList.findIndex((u) => u.id === userId);
        if (userIndex === -1) continue;
        
        let user = newUsersList[userIndex];
        let latestUser = normalizeUserRecord(user);

        if (
          typeof pending.role === "string" &&
          normalizeRole(pending.role) !== normalizeRole(user.role)
        ) {
          const roleRes = await authenticatedFetch(apiUrl(`/auth/admin/users/${user.id}/role`), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ role: pending.role }),
          });

          if (roleRes.status === 401) {
            onSessionExpired?.();
            throw new Error(SESSION_EXPIRED_ERROR);
          }

          const roleData = await roleRes.json().catch(() => null);
          if (!roleRes.ok) {
            throw new Error(roleData?.detail ?? `Unable to update role for user ${user.username}.`);
          }

          if (roleData) {
            latestUser = normalizeUserRecord(roleData);
          }
        }

        if (
          typeof pending.is_active === "boolean" &&
          pending.is_active !== Boolean(latestUser.is_active)
        ) {
          const statusRes = await authenticatedFetch(apiUrl(`/auth/admin/users/${user.id}/status`), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              is_active: pending.is_active,
              ban_reason: pending.is_active
                ? null
                : (pending.ban_reason || latestUser.ban_reason || "No reason provided").trim(),
            }),
          });

          if (statusRes.status === 401) {
            onSessionExpired?.();
            throw new Error(SESSION_EXPIRED_ERROR);
          }

          const statusData = await statusRes.json().catch(() => null);
          if (!statusRes.ok) {
            throw new Error(statusData?.detail ?? `Unable to update status for user ${user.username}.`);
          }

          if (statusData) {
            latestUser = normalizeUserRecord(statusData);
          }
        }
        
        // Update user in the local array
        newUsersList[userIndex] = latestUser;
      }

      setUsers(newUsersList);
      setPendingChanges({});
    } catch (e) {
      if (e instanceof Error && e.message === SESSION_EXPIRED_ERROR) {
        return;
      }
      console.error("Failed to save changes", e);
      setErrorMessage(e instanceof Error ? e.message : "Failed to save changes.");
    } finally {
      setActionLoading(null);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const pending = pendingChanges[user.id] || {};
      const effectiveRole = normalizeRole(pending.role ?? user.role);

      if (roleFilter !== "all" && effectiveRole !== roleFilter) return false;

      if (search) {
        const s = search.toLowerCase();
        return (
          String(user.username ?? "").toLowerCase().includes(s) ||
          String(user.email ?? "").toLowerCase().includes(s) ||
          String(user.first_name ?? "").toLowerCase().includes(s) ||
          String(user.last_name ?? "").toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [users, search, roleFilter, pendingChanges]);

  const pendingUserCount = Object.keys(pendingChanges).length;

  const userSummary = useMemo(() => {
    return users.reduce((summary, user) => {
      const pending = pendingChanges[user.id] || {};
      const effectiveRole = normalizeRole(pending.role ?? user.role);
      const effectiveIsActive =
        typeof pending.is_active === "boolean" ? pending.is_active : Boolean(user.is_active);

      summary.total += 1;
      if (effectiveIsActive) summary.active += 1;
      if (effectiveRole === "admin" || effectiveRole === "editor") summary.staff += 1;
      return summary;
    }, { total: 0, active: 0, staff: 0 });
  }, [pendingChanges, users]);

  const getRoleIcon = (role, size = 14) => {
    const normalized = normalizeRole(role);
    if (normalized === "admin") return <Shield size={size} />;
    if (normalized === "editor") return <PenTool size={size} />;
    return <GraduationCap size={size} />;
  };

  const getStatusMeta = (effectiveIsActive, hasPending) => {
    if (hasPending) {
      return {
        tone: "pending",
        label: "Pending",
        help: "Staged changes are waiting to be saved.",
      };
    }
    if (!effectiveIsActive) {
      return {
        tone: "banned",
        label: "Banned",
        help: "This account is banned and cannot sign in.",
      };
    }
    return {
      tone: "active",
      label: "Active",
      help: "This account is active and can sign in.",
    };
  };

  if (!canViewUsers) {
    return (
      <div className="um-restricted">
        <ShieldAlert size={48} className="um-restricted__icon" />
        <h2>Access Restricted</h2>
        <p>You do not have permission to view User Management.</p>
        <p className="um-restricted__sub">
          Only administrators and editors can view users. Only administrators can change roles and status.
        </p>
      </div>
    );
  }

  return (
    <div className="um-container">
      <header className="um-header">
        <div className="um-header-content">
          <span className="um-kicker"><Lock size={15} /> Account operations</span>
          <h2 className="um-title">User Management</h2>
          <p className="um-subtitle">Roles, account status, and recent session activity across the platform.</p>
        </div>

        <div className="um-header-actions">
          <button
            type="button"
            className="um-refresh-btn"
            disabled={isRefreshing || pendingUserCount > 0}
            onClick={() => fetchUsers({ silent: true })}
            title={pendingUserCount > 0 ? "Save or discard staged changes before refreshing" : "Refresh users"}
          >
            <RefreshCw size={16} className={isRefreshing ? "um-spin" : ""} />
            Refresh
          </button>

          {pendingUserCount > 0 && canManageUsers && (
            <div className="um-global-actions">
              <button
                type="button"
                className="um-reset-btn"
                disabled={actionLoading === "global-save"}
                onClick={() => setPendingChanges({})}
              >
                Discard all
              </button>
              <button
                type="button"
                className="um-save-btn"
                disabled={actionLoading === "global-save"}
                onClick={handleSaveAllChanges}
              >
                {actionLoading === "global-save" ? "Saving..." : "Save changes"}
              </button>
            </div>
          )}
        </div>
      </header>

      <section className="um-summary" aria-label="User summary">
        <article>
          <span className="um-summary-mark"><UserIcon size={19} /></span>
          <div><span>Accounts</span><strong>{userSummary.total}</strong></div>
        </article>
        <article className="is-active">
          <span className="um-summary-mark"><ShieldCheck size={19} /></span>
          <div><span>Active</span><strong>{userSummary.active}</strong></div>
        </article>
        <article className="is-staff">
          <span className="um-summary-mark"><Shield size={19} /></span>
          <div><span>Staff access</span><strong>{userSummary.staff}</strong></div>
        </article>
        <article className="is-pending">
          <span className="um-summary-mark"><PenTool size={19} /></span>
          <div><span>Staged users</span><strong>{pendingUserCount}</strong></div>
        </article>
      </section>

      <section className="um-directory">
        <header className="um-directory__header">
          <div>
            <h3>User directory</h3>
            <p>{loading ? "Loading accounts..." : `${filteredUsers.length} of ${users.length} accounts shown`}</p>
          </div>
          <span className={`um-access-badge ${canManageUsers ? "is-admin" : "is-readonly"}`}>
            {canManageUsers ? "Admin controls" : "View only"}
          </span>
        </header>

        <div className="um-controls">
          <label className="um-search">
            <Search size={16} className="um-search__icon" />
            <input
              type="text"
              placeholder="Search by name, @username, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button type="button" className="um-search__clear" onClick={() => setSearch("")} aria-label="Clear user search">
                <X size={14} />
              </button>
            )}
          </label>

          <div className="um-filters" aria-label="Filter users by role">
            {["all", "admin", "editor", "student"].map((r) => (
              <button
                key={r}
                type="button"
                className={`um-filter-btn ${roleFilter === r ? "um-filter-btn--active" : ""}`}
                onClick={() => setRoleFilter(r)}
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="um-table-wrapper">
          <table className="um-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Contact Details</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Last Sign In</th>
                <th className="um-table__actions-head">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="um-table__empty">
                    <Loader2 size={24} className="um-spin" />
                  </td>
                </tr>
              ) : errorMessage ? (
                <tr>
                  <td colSpan="7" className="um-table__empty is-error">{errorMessage}</td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="7" className="um-table__empty">No users found.</td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const pending = pendingChanges[user.id] || {};
                  const isMe =
                    String(user.username || "").toLowerCase() ===
                    String(currentUsername || "").toLowerCase();

                  const effectiveRole = normalizeRole(pending.role ?? user.role);
                  const effectiveIsActive =
                    typeof pending.is_active === "boolean" ? pending.is_active : Boolean(user.is_active);
                  const hasPending =
                    pending.role !== undefined || pending.is_active !== undefined;

                  const fullName = `${user.first_name || "Unknown"} ${user.last_name || ""}`.trim();
                  const initial = (fullName.charAt(0) || "?").toUpperCase();
                  const statusMeta = getStatusMeta(effectiveIsActive, hasPending);
                  const effectiveBanReason = !effectiveIsActive
                    ? String(pending.ban_reason ?? user.ban_reason ?? "").trim()
                    : "";

                  return (
                    <tr key={user.id} className={!effectiveIsActive ? "um-row-banned" : ""}>
                      <td data-label="User">
                        <div className="um-user-cell">
                          <UserAvatar avatar={user.avatar} initial={initial} />
                          <div className="um-user-info">
                            <span className="um-name">
                              {fullName}
                              {isMe && <span className="um-badge-me">You</span>}
                            </span>
                            <span className="um-username">@{user.username}</span>
                          </div>
                        </div>
                      </td>

                      <td data-label="Contact">
                        <div className="um-email-cell">
                          <span>{user.email}</span>
                          <span className="um-provider">via {user.auth_provider}</span>
                        </div>
                      </td>

                      <td data-label="Role">
                        <div className="um-role-cell">
                          <span className={`um-role-pill um-role-pill--${effectiveRole}`}>
                            {getRoleIcon(effectiveRole, 15)}
                            {titleCaseRole(effectiveRole)}
                          </span>
                          {pending.role !== undefined && <small>Staged role</small>}
                        </div>
                      </td>

                      <td data-label="Status">
                        <div className="um-status-cell">
                          <span className={`um-status-pill um-status-pill--${statusMeta.tone}`} title={statusMeta.help}>
                            <span className={`um-status-dot um-status-dot--${statusMeta.tone}`} />
                            {statusMeta.label}
                          </span>
                          {effectiveBanReason && <small>{effectiveBanReason}</small>}
                          {hasPending && canManageUsers && (
                            <button
                              type="button"
                              className="um-pending-clear"
                              onClick={() => clearPendingForUser(user.id)}
                              aria-label={`Discard staged changes for ${user.username}`}
                              title="Discard staged changes"
                            >
                              <X size={13} />
                            </button>
                          )}
                        </div>
                      </td>

                      <td data-label="Joined">
                        <span className="um-date">
                          {formatDate(user.created_at)}
                        </span>
                      </td>

                      <td data-label="Last Sign In">
                        <span className="um-date">{formatDate(user.last_login, true)}</span>
                      </td>

                      <td data-label="Actions">
                        <div className="um-inline-actions">
                          {/* View Activity */}
                          <div className="um-action-btn-wrapper">
                            <button
                              className="um-action-btn um-action-btn--neutral"
                              onClick={() => setActivityModalUser(user)}
                              type="button"
                              aria-label="View Activity"
                              title="View activity"
                            >
                              <History size={14} />
                            </button>
                          </div>

                          {/* Change Role */}
                          <div className="um-action-btn-wrapper">
                            <button
                              className="um-action-btn um-action-btn--accent"
                              onClick={() => canManageUsers && !isMe && setRoleModalUser({ ...user, role: effectiveRole, base_role: user.role })}
                              disabled={!canManageUsers || isMe}
                              type="button"
                              aria-label="Change Role"
                              title={isMe ? "Cannot change your own role" : "Change role"}
                            >
                              <ShieldCheck size={14} />
                            </button>
                          </div>

                          {/* Ban / Unban */}
                          <div className="um-action-btn-wrapper">
                            <button
                              className={`um-action-btn ${effectiveIsActive ? 'um-action-btn--danger' : 'um-action-btn--success'}`}
                              onClick={() => {
                                if (!canManageUsers || isMe) return;
                                if (effectiveIsActive) {
                                  setBanModalUser({ ...user, is_active: effectiveIsActive });
                                } else {
                                  stageStatusChange(user.id, true, null);
                                }
                              }}
                              disabled={!canManageUsers || isMe}
                              type="button"
                              aria-label={effectiveIsActive ? "Ban User" : "Unban User"}
                              title={isMe ? "Cannot ban yourself" : effectiveIsActive ? "Ban user" : "Unban user"}
                            >
                              {effectiveIsActive ? <Ban size={14} /> : <ShieldOff size={14} />}
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {banModalUser && (
        <BanModal
          user={banModalUser}
          onClose={() => setBanModalUser(null)}
          onConfirm={async (userId, reason) => {
            stageStatusChange(userId, false, reason);
            setBanModalUser(null);
          }}
        />
      )}

      {roleModalUser && (
        <RoleModal
          user={roleModalUser}
          currentRole={roleModalUser.role}
          onClose={() => setRoleModalUser(null)}
          onConfirm={(userId, role) => {
            stageRoleChange(userId, role, roleModalUser.base_role ?? roleModalUser.role);
            setRoleModalUser(null);
          }}
        />
      )}

      {activityModalUser && (
        <ActivityModal
          user={activityModalUser}
          onClose={() => setActivityModalUser(null)}
          onSessionExpired={onSessionExpired}
        />
      )}
    </div>
  );
}
