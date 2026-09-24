import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Globe2,
  History,
  Loader2,
  LogOut,
  MonitorSmartphone,
  Save,
  ShieldCheck,
  User,
} from "lucide-react";
import { apiUrl, fetchAdminActivityLogs } from "../../shared/api.js";
import { authenticatedFetch, syncAuthSession } from "../../shared/authSession.js";
import "./AdminAccountPage.css";

const SESSION_EXPIRED_ERROR = "__SESSION_EXPIRED__";

function getAuthHeaders() {
  const token = localStorage.getItem("campus404_token") || "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatDateTime(value) {
  if (!value) return "Not available";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Not available";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatActivityType(value) {
  return String(value || "activity")
    .replace(/[_:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function normalizeProfile(raw) {
  return {
    id: Number(raw?.id || 0),
    username: String(raw?.username || ""),
    role: String(raw?.role || "USER").toUpperCase(),
    email: String(raw?.email || ""),
    first_name: String(raw?.first_name || ""),
    last_name: String(raw?.last_name || ""),
    auth_provider: String(raw?.auth_provider || "oauth"),
    avatar: String(raw?.avatar || ""),
    is_active: Boolean(raw?.is_active),
    created_at: raw?.created_at || null,
    last_login: raw?.last_login || null,
    session_version: Number(raw?.session_version || 1),
  };
}

async function parseErrorResponse(response, fallback) {
  try {
    const data = await response.json();
    if (typeof data?.detail === "string" && data.detail.trim()) {
      return data.detail;
    }
    if (typeof data?.message === "string" && data.message.trim()) {
      return data.message;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

export default function AdminAccountPage({ onSessionExpired, onProfileUpdated }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [profile, setProfile] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [activity, setActivity] = useState([]);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    avatar: "",
  });

  const activeSessionCount = useMemo(() => {
    return sessions.filter((item) => !item.logout_time).length;
  }, [sessions]);

  async function fetchWithAuth(url, options = {}) {
    const response = await authenticatedFetch(url, options);

    if (response.status === 401) {
      onSessionExpired?.();
      throw new Error(SESSION_EXPIRED_ERROR);
    }

    return response;
  }

  async function loadData() {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const profileResponse = await fetchWithAuth(apiUrl("/auth/account/profile"));
      if (!profileResponse.ok) {
        throw new Error(await parseErrorResponse(profileResponse, "Failed to load account profile."));
      }

      const profileData = normalizeProfile(await profileResponse.json());
      setProfile(profileData);
      setForm({
        first_name: profileData.first_name,
        last_name: profileData.last_name,
        avatar: profileData.avatar,
      });

      const sessionsResponse = await fetchWithAuth(apiUrl("/auth/account/sessions?limit=12"));
      if (!sessionsResponse.ok) {
        throw new Error(await parseErrorResponse(sessionsResponse, "Failed to load account sessions."));
      }
      const sessionsData = await sessionsResponse.json();
      setSessions(Array.isArray(sessionsData) ? sessionsData : []);

      try {
        const activityData = await fetchAdminActivityLogs({ limit: 12, username: profileData.username });
        setActivity(Array.isArray(activityData?.items) ? activityData.items : []);
      } catch {
        setActivity([]);
      }
    } catch (err) {
      if (err?.message !== SESSION_EXPIRED_ERROR) {
        setError(err?.message || "Failed to load account data.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleSaveProfile(event) {
    event.preventDefault();
    if (!profile) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = {};

      const nextFirstName = form.first_name.trim();
      const nextLastName = form.last_name.trim();
      const nextAvatar = form.avatar.trim();

      if (nextFirstName && nextFirstName !== profile.first_name) {
        payload.first_name = nextFirstName;
      }
      if (nextLastName !== (profile.last_name || "")) {
        payload.last_name = nextLastName || null;
      }
      if (nextAvatar !== (profile.avatar || "")) {
        payload.avatar = nextAvatar || null;
      }

      if (!Object.keys(payload).length) {
        setSuccess("No changes to save.");
        return;
      }

      const response = await fetchWithAuth(apiUrl("/auth/account/profile"), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await parseErrorResponse(response, "Failed to update profile."));
      }

      const updated = normalizeProfile(await response.json());
      setProfile(updated);
      setForm({
        first_name: updated.first_name,
        last_name: updated.last_name,
        avatar: updated.avatar,
      });

      syncAuthSession(updated);

      onProfileUpdated?.({
        username: updated.username,
        role: updated.role,
        avatar: updated.avatar,
      });

      setSuccess("Profile updated successfully.");
    } catch (err) {
      if (err?.message !== SESSION_EXPIRED_ERROR) {
        setError(err?.message || "Failed to update profile.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleRevokeSessions() {
    const approved = window.confirm(
      "This will sign you out on every device, including this browser. Continue?"
    );
    if (!approved) return;

    setRevoking(true);
    setError("");

    try {
      const response = await fetchWithAuth(apiUrl("/auth/account/sessions/revoke-all"), {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
        },
      });

      if (!response.ok) {
        throw new Error(await parseErrorResponse(response, "Failed to revoke sessions."));
      }

      onSessionExpired?.();
    } catch (err) {
      if (err?.message !== SESSION_EXPIRED_ERROR) {
        setError(err?.message || "Failed to revoke sessions.");
      }
    } finally {
      setRevoking(false);
    }
  }

  return (
    <div className="aa-page">
      <div className="aa-header">
        <h2>My Account</h2>
        <p>Manage your admin/editor identity, account profile, and advanced session security.</p>
      </div>

      {error && (
        <div className="aa-banner aa-banner--error" role="alert">
          <AlertTriangle size={15} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="aa-banner aa-banner--success" role="status">
          <CheckCircle2 size={15} />
          <span>{success}</span>
        </div>
      )}

      {loading ? (
        <div className="aa-loading">
          <Loader2 size={18} className="aa-spin" />
          <span>Loading account details...</span>
        </div>
      ) : (
        <>
          <div className="aa-grid">
            <form className="aa-card" onSubmit={handleSaveProfile}>
              <div className="aa-card__header">
                <h3>
                  <User size={16} />
                  Profile
                </h3>
                <p>Keep your identity details current across the admin panel.</p>
              </div>

              <div className="aa-profile-top">
                <div className="aa-avatar" aria-label="Account avatar">
                  {profile?.avatar ? (
                    <img src={profile.avatar} alt={profile.username} />
                  ) : (
                    <span>{String(profile?.username || "A")[0].toUpperCase()}</span>
                  )}
                </div>
                <div>
                  <strong>@{profile?.username}</strong>
                  <span>{profile?.role}</span>
                </div>
              </div>

              <div className="aa-fields">
                <label>
                  <span>First Name</span>
                  <input
                    type="text"
                    value={form.first_name}
                    onChange={(e) => setForm((prev) => ({ ...prev, first_name: e.target.value }))}
                    placeholder="First name"
                    required
                  />
                </label>

                <label>
                  <span>Last Name</span>
                  <input
                    type="text"
                    value={form.last_name}
                    onChange={(e) => setForm((prev) => ({ ...prev, last_name: e.target.value }))}
                    placeholder="Last name"
                  />
                </label>

                <label className="aa-field-full">
                  <span>Avatar URL</span>
                  <input
                    type="url"
                    value={form.avatar}
                    onChange={(e) => setForm((prev) => ({ ...prev, avatar: e.target.value }))}
                    placeholder="https://example.com/avatar.png"
                  />
                </label>
              </div>

              <div className="aa-meta">
                <p><strong>Email:</strong> {profile?.email}</p>
                <p><strong>Provider:</strong> {profile?.auth_provider}</p>
                <p><strong>Joined:</strong> {formatDateTime(profile?.created_at)}</p>
                <p><strong>Last Login:</strong> {formatDateTime(profile?.last_login)}</p>
              </div>

              <div className="aa-actions">
                <button className="aa-btn aa-btn--primary" type="submit" disabled={saving}>
                  {saving ? <Loader2 size={14} className="aa-spin" /> : <Save size={14} />}
                  {saving ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </form>

            <section className="aa-card">
              <div className="aa-card__header">
                <h3>
                  <ShieldCheck size={16} />
                  Advanced Security
                </h3>
                <p>Review auth posture and revoke all active sessions when needed.</p>
              </div>

              <div className="aa-security-stats">
                <div>
                  <span>Session Version</span>
                  <strong>{profile?.session_version ?? 1}</strong>
                </div>
                <div>
                  <span>Active Sessions</span>
                  <strong>{activeSessionCount}</strong>
                </div>
                <div>
                  <span>Account State</span>
                  <strong>{profile?.is_active ? "Active" : "Restricted"}</strong>
                </div>
              </div>

              <div className="aa-note">
                <ShieldCheck size={14} />
                <span>Use session revoke after shared-device use or suspicious account activity.</span>
              </div>

              <div className="aa-actions aa-actions--stacked">
                <button
                  type="button"
                  className="aa-btn aa-btn--danger"
                  onClick={handleRevokeSessions}
                  disabled={revoking}
                >
                  {revoking ? <Loader2 size={14} className="aa-spin" /> : <LogOut size={14} />}
                  {revoking ? "Revoking..." : "Sign Out All Sessions"}
                </button>
              </div>
            </section>
          </div>

          <div className="aa-grid aa-grid--secondary">
            <section className="aa-card">
              <div className="aa-card__header">
                <h3>
                  <History size={16} />
                  Recent Sessions
                </h3>
              </div>

              {sessions.length === 0 ? (
                <p className="aa-empty">No recent sessions found.</p>
              ) : (
                <ul className="aa-list">
                  {sessions.map((session) => (
                    <li key={session.id}>
                      <div className="aa-list-head">
                        <span className={`aa-chip ${session.logout_time ? "" : "aa-chip--active"}`}>
                          {session.logout_time ? "Ended" : "Active"}
                        </span>
                        <time>{formatDateTime(session.login_time)}</time>
                      </div>
                      <div className="aa-list-meta">
                        <span><Globe2 size={12} /> {session.ip_address || "Unknown IP"}</span>
                        <span><MonitorSmartphone size={12} /> {session.device_info || "Unknown device"}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="aa-card">
              <div className="aa-card__header">
                <h3>
                  <History size={16} />
                  Recent Admin Activity
                </h3>
              </div>

              {activity.length === 0 ? (
                <p className="aa-empty">No recent activity captured for this account.</p>
              ) : (
                <ul className="aa-list">
                  {activity.map((entry) => (
                    <li key={entry.id}>
                      <div className="aa-list-head">
                        <span className="aa-chip">{formatActivityType(entry.activity_type)}</span>
                        <time>{formatDateTime(entry.created_at)}</time>
                      </div>
                      <div className="aa-list-meta">
                        <span>{entry.target_path || "No target path"}</span>
                        <span>{entry.city || entry.region || entry.country || "Location unavailable"}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
