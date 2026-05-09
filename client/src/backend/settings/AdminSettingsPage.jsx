import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Loader2,
  PlugZap,
  Save,
  Settings2,
} from "lucide-react";
import {
  getMediaStorageSettings,
  testMediaStorageSettings,
  updateMediaStorageSettings,
} from "../../shared/mediaApi.js";
import { logAdminActivity } from "../../shared/api.js";
import "./AdminSettingsPage.css";

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

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [testMessage, setTestMessage] = useState("");

  const [folderPrefix, setFolderPrefix] = useState("campus404");

  const [cloudConfigured, setCloudConfigured] = useState(false);
  const [lastTestedAt, setLastTestedAt] = useState("");
  const [lastTestStatus, setLastTestStatus] = useState("");

  function hydrateFromResponse(settings) {
    const cloudinary = settings?.providers?.cloudinary || {};

    setFolderPrefix(cloudinary.folder_prefix || "campus404");
    setCloudConfigured(Boolean(cloudinary.configured));
    setLastTestedAt(cloudinary.last_tested_at || "");
    setLastTestStatus(cloudinary.last_test_status || "");
  }

  async function loadSettings() {
    setLoading(true);
    setError("");
    try {
      const data = await getMediaStorageSettings();
      hydrateFromResponse(data);
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
        <section className="as-section">
          <div className="as-section__header">
            <h3>
              <Settings2 size={16} />
              Add-ons
            </h3>
            <span className="as-section__meta">Media storage is always available. No disable mode.</span>
          </div>

          <form className="as-card" onSubmit={handleSave}>
            <div className="as-card__header">
              <h4>Media Storage</h4>
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
      )}
    </div>
  );
}
