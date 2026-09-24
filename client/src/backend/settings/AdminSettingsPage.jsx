import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Loader2,
  PlugZap,
  Save,
  Search,
  Settings2,
  Trophy,
} from "lucide-react";
import {
  getMediaStorageSettings,
  testMediaStorageSettings,
  updateMediaStorageSettings,
} from "../../shared/mediaApi.js";
import {
  getAdminLeaderboardSettings,
  updateAdminLeaderboardSettings,
  updateAdminTrackLeaderboardSettings,
} from "../../shared/learningApi.js";
import { logAdminActivity } from "../../shared/api.js";
import "./AdminSettingsPage.css";

const RANGE_OPTIONS = [
  { value: "all_time", label: "All time" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const PAGE_SIZE_OPTIONS = [25, 50];

function formatDateTime(value) {
  if (!value) return "Not tested yet";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Not tested yet";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminSettingsPage({ role = "USER" }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingLeaderboard, setSavingLeaderboard] = useState(false);
  const [savingTrackId, setSavingTrackId] = useState(null);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [trackSearch, setTrackSearch] = useState("");

  const [folderPrefix, setFolderPrefix] = useState("campus404");

  const [cloudConfigured, setCloudConfigured] = useState(false);
  const [lastTestedAt, setLastTestedAt] = useState("");
  const [lastTestStatus, setLastTestStatus] = useState("");
  const [leaderboardSettings, setLeaderboardSettings] = useState({
    global_enabled: true,
    default_range: "all_time",
    page_size: 25,
    tracks: [],
  });

  const canManageLeaderboards = String(role || "").toUpperCase() === "ADMIN";

  function hydrateFromResponse(settings) {
    const cloudinary = settings?.providers?.cloudinary || {};

    setFolderPrefix(cloudinary.folder_prefix || "campus404");
    setCloudConfigured(Boolean(cloudinary.configured));
    setLastTestedAt(cloudinary.last_tested_at || "");
    setLastTestStatus(cloudinary.last_test_status || "");
  }

  function hydrateLeaderboardSettings(settings) {
    setLeaderboardSettings({
      global_enabled: settings?.global_enabled !== false,
      default_range: settings?.default_range || "all_time",
      page_size: Number(settings?.page_size) === 50 ? 50 : 25,
      tracks: Array.isArray(settings?.tracks) ? settings.tracks : [],
    });
  }

  async function loadSettings() {
    setLoading(true);
    setError("");
    try {
      const [mediaSettings, leaderboardPayload] = await Promise.all([
        getMediaStorageSettings(),
        getAdminLeaderboardSettings(),
      ]);
      hydrateFromResponse(mediaSettings);
      hydrateLeaderboardSettings(leaderboardPayload);
    } catch (err) {
      setError(err.message || "Failed to load settings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSettings();
  }, []);

  async function handleTestConnection() {
    setTesting(true);
    setError("");
    setSuccess("");
    setTestMessage("");

    try {
      const payload = {
        cloudinary_folder_prefix: folderPrefix.trim() || "campus404",
      };

      const result = await testMediaStorageSettings(payload);
      setTestMessage(result?.message || "Connection test completed.");
      if (!result?.ok) {
        setError(result?.message || "Cloudinary test failed.");
      }

      await loadSettings();

      await logAdminActivity({
        activity_type: "TEST_STORAGE_PROVIDER",
        target_path: "/api/admin/media/storage-settings/test",
        details: {
          provider: "cloudinary",
          success: Boolean(result?.ok),
        },
      });
    } catch (err) {
      setError(err.message || "Cloudinary test failed.");
    } finally {
      setTesting(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        active_provider: "cloudinary",
        cloudinary_folder_prefix: folderPrefix.trim() || "campus404",
      };

      const res = await updateMediaStorageSettings(payload);
      hydrateFromResponse(res?.settings || {});
      setSuccess("Storage settings saved successfully.");

      await logAdminActivity({
        activity_type: "UPDATE_STORAGE_SETTINGS",
        target_path: "/api/admin/media/storage-settings",
        details: {
          active_provider: "cloudinary",
          cloudinary_configured: Boolean(res?.settings?.providers?.cloudinary?.configured),
        },
      });
    } catch (err) {
      setError(err.message || "Failed to save storage settings.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveLeaderboardSettings(e) {
    e.preventDefault();
    if (!canManageLeaderboards) return;

    setSavingLeaderboard(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        global_enabled: Boolean(leaderboardSettings.global_enabled),
        default_range: leaderboardSettings.default_range,
        page_size: Number(leaderboardSettings.page_size) || 25,
      };
      const data = await updateAdminLeaderboardSettings(payload);
      hydrateLeaderboardSettings(data);
      setSuccess("Leaderboard settings saved successfully.");

      await logAdminActivity({
        activity_type: "UPDATE_LEADERBOARD_SETTINGS",
        target_path: "/api/admin/settings/leaderboards",
        details: payload,
      });
    } catch (err) {
      setError(err.message || "Failed to save leaderboard settings.");
    } finally {
      setSavingLeaderboard(false);
    }
  }

  function updateTrackDraft(trackId, patch) {
    setLeaderboardSettings((current) => ({
      ...current,
      tracks: current.tracks.map((track) => (
        Number(track.id) === Number(trackId) ? { ...track, ...patch } : track
      )),
    }));
  }

  async function handleSaveTrackLeaderboard(trackId) {
    if (!canManageLeaderboards) return;

    const track = leaderboardSettings.tracks.find((item) => Number(item.id) === Number(trackId));
    if (!track) return;

    setSavingTrackId(trackId);
    setError("");
    setSuccess("");

    try {
      const payload = {
        leaderboard_enabled: Boolean(track.leaderboard_enabled),
        leaderboard_default_range: track.leaderboard_default_range,
        leaderboard_page_size: Number(track.leaderboard_page_size) || 25,
      };
      const saved = await updateAdminTrackLeaderboardSettings(trackId, payload);
      updateTrackDraft(trackId, saved);
      setSuccess(`${saved.title} leaderboard settings saved.`);

      await logAdminActivity({
        activity_type: "UPDATE_TRACK_LEADERBOARD_SETTINGS",
        target_path: `/api/admin/settings/leaderboards/tracks/${trackId}`,
        details: payload,
      });
    } catch (err) {
      setError(err.message || "Failed to save track leaderboard settings.");
    } finally {
      setSavingTrackId(null);
    }
  }

  const visibleLeaderboardTracks = leaderboardSettings.tracks.filter((track) => {
    const query = trackSearch.trim().toLowerCase();
    if (!query) return true;
    return `${track.title} ${track.slug || ""}`.toLowerCase().includes(query);
  });

  return (
    <div className="as-page">
      <div className="as-header">
        <h2>Settings</h2>
        <p>Add-ons and runtime configuration for admin-managed services.</p>
      </div>

      {error && (
        <div className="as-banner as-banner--error" role="alert">
          <AlertTriangle size={15} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="as-banner as-banner--success" role="status">
          <CheckCircle2 size={15} />
          <span>{success}</span>
        </div>
      )}

      {testMessage && !error && (
        <div className="as-banner as-banner--info" role="status">
          <PlugZap size={15} />
          <span>{testMessage}</span>
        </div>
      )}

      {loading ? (
        <div className="as-loading">
          <Loader2 size={18} className="as-spin" />
          <span>Loading settings...</span>
        </div>
      ) : (
        <>
          <section className="as-section">
            <div className="as-section__header">
              <h3>
                <Settings2 size={16} />
                Media Storage
              </h3>
              <span className="as-section__meta">Media storage is always available. No disable mode.</span>
            </div>

            <form className="as-card" onSubmit={handleSave}>
              <div className="as-card__header">
                <h4>Cloudinary Storage</h4>
                <p>Admin uploads are stored and served from Cloudinary CDN only.</p>
              </div>

              <div className="as-provider-grid">
                <div className="as-provider is-active">
                  <Cloud size={16} />
                  <div>
                    <strong>Cloudinary CDN</strong>
                    <span>{cloudConfigured ? "Configured from environment and required for all uploads." : "Set CLOUDINARY_* environment variables to enable uploads."}</span>
                  </div>
                </div>
              </div>

              <div className="as-fields">
                <label>
                  <span>Folder Prefix</span>
                  <input
                    type="text"
                    value={folderPrefix}
                    onChange={(e) => setFolderPrefix(e.target.value)}
                    placeholder="campus404"
                  />
                  <small className="as-hint">Credentials are loaded from environment variables and are not editable here.</small>
                </label>
              </div>

              <div className="as-status-row">
                <span>
                  Cloudinary status:
                  <strong className={cloudConfigured ? "is-ok" : "is-muted"}>
                    {cloudConfigured ? " Configured" : " Not configured"}
                  </strong>
                </span>
                <span>
                  Last test:
                  <strong className={lastTestStatus === "ok" ? "is-ok" : "is-muted"}>
                    {" "}{formatDateTime(lastTestedAt)}
                  </strong>
                </span>
              </div>

              <div className="as-actions">
                <button
                  type="button"
                  className="as-btn as-btn--ghost"
                  onClick={handleTestConnection}
                  disabled={testing}
                >
                  {testing ? <Loader2 size={14} className="as-spin" /> : <PlugZap size={14} />}
                  {testing ? "Testing..." : "Test Cloudinary"}
                </button>

                <button
                  type="submit"
                  className="as-btn as-btn--primary"
                  disabled={saving}
                >
                  {saving ? <Loader2 size={14} className="as-spin" /> : <Save size={14} />}
                  {saving ? "Saving..." : "Save Settings"}
                </button>
              </div>
            </form>
          </section>

          <section className="as-section">
            <div className="as-section__header">
              <h3>
                <Trophy size={16} />
                Leaderboard Settings
              </h3>
              <span className="as-section__meta">{canManageLeaderboards ? "Global and per-track public leaderboard controls." : "View only. Admin role is required to edit."}</span>
            </div>

            <form className="as-card" onSubmit={handleSaveLeaderboardSettings}>
              <div className="as-card__header">
                <h4>Global Defaults</h4>
                <p>Controls the public global leaderboard and defaults for new leaderboard views.</p>
              </div>

              <div className="as-fields as-fields--three">
                <label className="as-toggle">
                  <input
                    type="checkbox"
                    checked={leaderboardSettings.global_enabled}
                    disabled={!canManageLeaderboards}
                    onChange={(event) => setLeaderboardSettings((current) => ({ ...current, global_enabled: event.target.checked }))}
                  />
                  <span>Global leaderboard enabled</span>
                </label>
                <label>
                  <span>Default range</span>
                  <select
                    value={leaderboardSettings.default_range}
                    disabled={!canManageLeaderboards}
                    onChange={(event) => setLeaderboardSettings((current) => ({ ...current, default_range: event.target.value }))}
                  >
                    {RANGE_OPTIONS.map((range) => <option value={range.value} key={range.value}>{range.label}</option>)}
                  </select>
                </label>
                <label>
                  <span>Default page size</span>
                  <select
                    value={leaderboardSettings.page_size}
                    disabled={!canManageLeaderboards}
                    onChange={(event) => setLeaderboardSettings((current) => ({ ...current, page_size: Number(event.target.value) }))}
                  >
                    {PAGE_SIZE_OPTIONS.map((size) => <option value={size} key={size}>Top {size}</option>)}
                  </select>
                </label>
              </div>

              <div className="as-actions">
                <button type="submit" className="as-btn as-btn--primary" disabled={!canManageLeaderboards || savingLeaderboard}>
                  {savingLeaderboard ? <Loader2 size={14} className="as-spin" /> : <Save size={14} />}
                  {savingLeaderboard ? "Saving..." : "Save Leaderboard Defaults"}
                </button>
              </div>
            </form>

            <div className="as-card">
              <div className="as-card__header as-card__header--split">
                <div>
                  <h4>Track Leaderboards</h4>
                  <p>Enable rankings only for tracks where competitive XP makes sense.</p>
                </div>
                <label className="as-search">
                  <Search size={15} />
                  <input value={trackSearch} onChange={(event) => setTrackSearch(event.target.value)} placeholder="Search 100+ tracks..." />
                </label>
              </div>

              <div className="as-track-settings">
                <table>
                  <thead>
                    <tr>
                      <th>Track</th>
                      <th>Status</th>
                      <th>Enabled</th>
                      <th>Range</th>
                      <th>Page Size</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleLeaderboardTracks.map((track) => (
                      <tr key={track.id}>
                        <td>
                          <strong>{track.title}</strong>
                          <small>{track.slug || `track-${track.id}`}</small>
                        </td>
                        <td><span className={`as-pill ${track.is_published ? "is-live" : "is-draft"}`}>{track.is_published ? "Live" : "Draft"}</span></td>
                        <td>
                          <label className="as-switch">
                            <input
                              type="checkbox"
                              checked={track.leaderboard_enabled}
                              disabled={!canManageLeaderboards}
                              onChange={(event) => updateTrackDraft(track.id, { leaderboard_enabled: event.target.checked })}
                            />
                            <span />
                          </label>
                        </td>
                        <td>
                          <select
                            value={track.leaderboard_default_range}
                            disabled={!canManageLeaderboards}
                            onChange={(event) => updateTrackDraft(track.id, { leaderboard_default_range: event.target.value })}
                          >
                            {RANGE_OPTIONS.map((range) => <option value={range.value} key={range.value}>{range.label}</option>)}
                          </select>
                        </td>
                        <td>
                          <select
                            value={track.leaderboard_page_size}
                            disabled={!canManageLeaderboards}
                            onChange={(event) => updateTrackDraft(track.id, { leaderboard_page_size: Number(event.target.value) })}
                          >
                            {PAGE_SIZE_OPTIONS.map((size) => <option value={size} key={size}>Top {size}</option>)}
                          </select>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="as-btn as-btn--ghost"
                            disabled={!canManageLeaderboards || savingTrackId === track.id}
                            onClick={() => handleSaveTrackLeaderboard(track.id)}
                          >
                            {savingTrackId === track.id ? <Loader2 size={14} className="as-spin" /> : <Save size={14} />}
                            Save
                          </button>
                        </td>
                      </tr>
                    ))}
                    {visibleLeaderboardTracks.length === 0 && (
                      <tr>
                        <td colSpan="6" className="as-table-empty">No tracks match this search.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
