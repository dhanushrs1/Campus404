import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Image,
  LayoutDashboard,
  Users,
  User,
  LogOut,
  Globe,
  ChevronRight,
  ShieldCheck,
  ChevronLeft,
  Menu,
  FolderTree,
  Settings2,
  Award,
  Inbox,
  Activity,
  BarChart3,
  ClipboardCheck,
} from "lucide-react";
import { APP_ROUTES } from "../routes/paths.js";
import { apiUrl } from "../shared/api.js";
import { ASSETS } from "../shared/assets.js";
import UserManagement from "./users/UserManagement.jsx";
import CurriculumStudioPage from "./curriculum/CurriculumStudioPage.jsx";
import MediaLibraryPage from "./media/MediaLibraryPage.jsx";
import BadgeLibraryPage from "./media/BadgeLibraryPage.jsx";
import AdminAccountPage from "./account/AdminAccountPage.jsx";
import AdminSettingsPage from "./settings/AdminSettingsPage.jsx";
import AdminContactInbox from "./contacts/AdminContactInbox.jsx";
import { clearAuthSession, readAuthSession } from "../shared/authSession.js";
import { fetchAdminContactMessages } from "../shared/contactApi.js";
import "./AdminDashboardPage.css";

// ── Sidebar items ──────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "curriculum", label: "Curriculum Studio", icon: FolderTree },
  { key: "users", label: "Learners", icon: Users },
  { key: "submissions", label: "Submissions", icon: ClipboardCheck },
  { key: "leaderboards", label: "Leaderboards", icon: BarChart3 },
  { key: "rewards", label: "Rewards & Badges", icon: Award },
  { key: "media", label: "Media Library", icon: Image },
  { key: "contacts", label: "Contact Inbox", icon: Inbox },
  { key: "health", label: "System Health", icon: Activity },
  { key: "account", label: "My Account", icon: User },
  { key: "settings", label: "Settings", icon: Settings2 },
];

const NAV_KEY_SET = new Set(NAV_ITEMS.map((item) => item.key));
const NAV_ALIASES = {
  tracks: "curriculum",
  badges: "rewards",
};
const CURRICULUM_QUERY_KEYS = [
  "trackPage",
  "mode",
  "trackId",
  "nodeType",
  "sectionId",
  "exerciseId",
  "taskId",
  "levelTab",
  "studioExerciseId",
  "page",
  "perPage",
];

// ── Live clock ─────────────────────────────────────────────────────────────

function useLiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

// ── Sidebar ────────────────────────────────────────────────────────────────

function AdminSidebar({ activeKey, onSelect, isOpen, onToggle, onLogout, unreadContactCount = 0 }) {
  const VERSION = import.meta.env.VITE_APP_VERSION ?? "1.0.0";
  const contactBadgeLabel = unreadContactCount > 99 ? "99+" : String(unreadContactCount);

  return (
    <aside className={`ap-sidebar ${isOpen ? "ap-sidebar--open" : "ap-sidebar--closed"}`}>
      {/* Brand row with toggle */}
      <div className="ap-sidebar__top">
        {isOpen ? (
          <div className="ap-sidebar__brandArea">
            <Link to={APP_ROUTES.home} className="ap-sidebar__brand" aria-label="Campus404 home">
              <img src={ASSETS.brand.logo} alt="" />
            </Link>
            <span className="ap-sidebar__adminTag">CONSOLE</span>
          </div>
        ) : (
          <div className="ap-sidebar__brandArea ap-sidebar__brandArea--closed">
            <img className="ap-sidebar__brandIcon" src={ASSETS.brand.favicon} alt="" />
          </div>
        )}

        <button 
          className="ap-sidebar__toggle" 
          onClick={onToggle}
          title={isOpen ? "Close sidebar" : "Open sidebar"}
        >
          {isOpen ? <ChevronLeft size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="ap-sidebar__nav" aria-label="Admin navigation">
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
          const hasContactBadge = key === "contacts" && unreadContactCount > 0;

          return (
            <button
              key={key}
              type="button"
              className={`ap-sidebar__item ${activeKey === key ? "ap-sidebar__item--active" : ""}`}
              onClick={() => onSelect(key)}
            >
              <Icon size={18} className="ap-sidebar__itemIcon" />

              {isOpen && <span className="ap-sidebar__itemLabel">{label}</span>}
              {hasContactBadge && (
                <span className="ap-sidebar__itemBadge" aria-label={`${unreadContactCount} new contact messages`}>
                  {contactBadgeLabel}
                </span>
              )}
              {isOpen && activeKey === key && <ChevronRight size={14} className="ap-sidebar__chevron" />}

              {!isOpen && (
                <span className="ap-sidebar__tooltip">{label}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="ap-sidebar__footer">
        <button type="button" className="ap-sidebar__logoutItem" onClick={onLogout}>
          <LogOut size={16} />
          {isOpen && <span>Sign out</span>}
        </button>
        {isOpen ? (
          <p className="ap-sidebar__version">Version: v{VERSION}</p>
        ) : (
          <p className="ap-sidebar__version ap-sidebar__version--closed">v{VERSION}</p>
        )}
      </div>
    </aside>
  );
}

// ── Top bar ────────────────────────────────────────────────────────────────

function AdminTopBar({ activeKey, username, role, avatarUrl, onLogout, isLoggingOut }) {
  const now = useLiveClock();

  const pageTitle = NAV_ITEMS.find((i) => i.key === activeKey)?.label ?? "Dashboard";

  const timeStr = now.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <header className="ap-topbar">
      <div className="ap-topbar__left">
        <h1 className="ap-topbar__title">{pageTitle}</h1>
      </div>

      <div className="ap-topbar__right">
        {/* Clock */}
        <div className="ap-topbar__clock">
          <span className="ap-topbar__time">{timeStr}</span>
        </div>

        {/* Visit site */}
        <Link
          className="ap-topbar__visitBtn"
          to={APP_ROUTES.home}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Globe size={14} />
          Visit Site
        </Link>
        
        <div className="ap-topbar__divider"></div>

        {/* User Profile Info */}
        <div className="ap-topbar__userProfile">
          <div className="ap-topbar__userInfo">
            <span className="ap-topbar__userName">@{username || "admin"}</span>
            <span className="ap-topbar__userRole">{role || "ADMIN"}</span>
          </div>
          <div className="ap-topbar__avatar" aria-label={`Signed in as ${username}`}>
            {avatarUrl ? (
              <img src={avatarUrl} alt={username} />
            ) : (
              <span>{(username || "A")[0].toUpperCase()}</span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

// ── Pages ──────────────────────────────────────────────────────────────────

function OverviewPage() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let disposed = false;
    async function loadStats() {
      try {
        const token = localStorage.getItem("campus404_token");
        const response = await fetch(apiUrl("/api/admin/dashboard/stats"), {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (!response.ok) {
          throw new Error("Unable to load admin metrics.");
        }
        const payload = await response.json();
        if (!disposed) setStats(payload);
      } catch (err) {
        if (!disposed) setError(err.message || "Unable to load admin metrics.");
      }
    }
    loadStats();
    return () => {
      disposed = true;
    };
  }, []);

  const cards = [
    ["Total users", stats?.total_users ?? 0],
    ["Active learners", stats?.active_learners ?? 0],
    ["Exercises solved", stats?.exercises_solved ?? 0],
    ["Quiz completions", stats?.quiz_completions ?? 0],
    ["Pending content", stats?.pending_content ?? 0],
    ["Leaderboard health", stats?.leaderboard_health ?? "loading"],
    ["Judge health", stats?.judge_health ?? "loading"],
  ];

  return (
    <div className="ap-page">
      <div className="ap-overview-metrics">
        {cards.map(([label, value]) => (
          <article key={label}>
            <LayoutDashboard size={18} />
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
      {error && <p className="ap-overview-error">{error}</p>}
    </div>
  );
}



// ── Access denied ──────────────────────────────────────────────────────────

function LearningOpsPage({ variant = "health" }) {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let disposed = false;
    async function loadHealth() {
      try {
        const token = localStorage.getItem("campus404_token");
        const response = await fetch(apiUrl("/api/admin/learning-engine/health"), {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (!response.ok) {
          throw new Error(`Unable to load learning engine health (${response.status}).`);
        }
        const payload = await response.json();
        if (!disposed) setHealth(payload);
      } catch (err) {
        if (!disposed) setError(err.message || "Unable to load learning engine health.");
      }
    }
    loadHealth();
    return () => {
      disposed = true;
    };
  }, []);

  const title = variant === "leaderboards"
    ? "Leaderboard Operations"
    : variant === "submissions"
      ? "Submission Monitor"
      : "System Health";

  return (
    <div className="ap-page ap-ops-page">
      <div className="ap-ops-hero">
        <div>
          <span>Learning engine</span>
          <h2>{title}</h2>
          <p>Production signals for judge availability, content readiness, learner submissions, and leaderboard integrity.</p>
        </div>
      </div>
      {error && <p className="ap-overview-error">{error}</p>}
      <div className="ap-overview-metrics">
        <article>
          <Activity size={18} />
          <span>Content health</span>
          <strong>{health?.content_health ?? "loading"}</strong>
        </article>
        <article>
          <Activity size={18} />
          <span>Judge health</span>
          <strong>{health?.judge_health ?? "loading"}</strong>
        </article>
        <article>
          <BarChart3 size={18} />
          <span>Leaderboard health</span>
          <strong>{health?.leaderboard_health ?? "loading"}</strong>
        </article>
      </div>
      <section className="ap-ops-table">
        <header>
          <h3>Recent attempts</h3>
          <p>Latest learner runs stored by the backend. User code still executes only inside Judge.</p>
        </header>
        <div className="ap-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Learner</th>
                <th>Exercise</th>
                <th>Mode</th>
                <th>Status</th>
                <th>Checks</th>
              </tr>
            </thead>
            <tbody>
              {(health?.recent_attempts || []).map((attempt) => (
                <tr key={attempt.id}>
                  <td>{attempt.username}</td>
                  <td>{attempt.exercise_title}</td>
                  <td>{String(attempt.mode || "code").replaceAll("_", " ")}</td>
                  <td><span className={`ap-status-pill ap-status-pill--${attempt.status}`}>{attempt.status}</span></td>
                  <td>{attempt.tests_passed} / {attempt.tests_total}</td>
                </tr>
              ))}
              {(!health?.recent_attempts || health.recent_attempts.length === 0) && (
                <tr>
                  <td colSpan="5">No submissions yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}


function AccessDenied() {
  return (
    <main className="ap-denied">
      <div className="ap-denied__card">
        <ShieldCheck size={36} />
        <h1>Access Restricted</h1>
        <p>This panel is available only to admins and editors.</p>
        <Link className="ap-denied__link" to={APP_ROUTES.frontendDashboard}>
          Go to Dashboard
        </Link>
      </div>
    </main>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────

const ELEVATED = new Set(["ADMIN", "EDITOR"]);

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSession = readAuthSession();

  const [role, setRole] = useState(initialSession.role);
  const [username, setUsername] = useState(initialSession.username || "guest");
  const [avatarUrl, setAvatarUrl] = useState(initialSession.avatarUrl);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [contactUnreadCount, setContactUnreadCount] = useState(0);

  const activeKey = useMemo(() => {
    const tab = (searchParams.get("tab") || "").toLowerCase();
    const normalized = NAV_ALIASES[tab] || tab;
    return NAV_KEY_SET.has(normalized) ? normalized : "overview";
  }, [searchParams]);

  const handleMenuSelect = useCallback(
    (key) => {
      if (!NAV_KEY_SET.has(key) || key === activeKey) {
        return;
      }

      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", key);

        // Curriculum Studio uses additional query params; clear them when leaving the tab.
        if (key !== "curriculum") {
          CURRICULUM_QUERY_KEYS.forEach((queryKey) => next.delete(queryKey));
        }

        return next;
      });
    },
    [activeKey, setSearchParams]
  );

  useEffect(() => {
    const tab = (searchParams.get("tab") || "").toLowerCase();
    const normalized = NAV_ALIASES[tab] || tab;
    if (normalized !== tab && NAV_KEY_SET.has(normalized)) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", normalized);
        return next;
      }, { replace: true });
      return;
    }
    if (!NAV_KEY_SET.has(normalized)) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", "overview");
        return next;
      }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const clearSessionAndRedirect = useCallback(() => {
    clearAuthSession();
    setRole("USER");
    setUsername("guest");
    setAvatarUrl("");
    navigate(APP_ROUTES.home, { replace: true });
  }, [navigate]);

  const handleSessionExpired = useCallback(() => {
    clearSessionAndRedirect();
  }, [clearSessionAndRedirect]);

  const handleProfileUpdated = useCallback((nextProfile) => {
    if (!nextProfile || typeof nextProfile !== "object") {
      return;
    }

    const nextUsername = String(nextProfile.username || "").trim();
    const nextRole = String(nextProfile.role || "").trim().toUpperCase();
    const hasAvatarKey = Object.prototype.hasOwnProperty.call(nextProfile, "avatar");

    if (nextUsername) {
      setUsername(nextUsername);
      localStorage.setItem("campus404_username", nextUsername);
    }

    if (nextRole) {
      setRole(nextRole);
      localStorage.setItem("campus404_role", nextRole);
    }

    if (hasAvatarKey) {
      const nextAvatar = String(nextProfile.avatar || "").trim();
      setAvatarUrl(nextAvatar);
      if (nextAvatar) {
        localStorage.setItem("campus404_avatar_url", nextAvatar);
      } else {
        localStorage.removeItem("campus404_avatar_url");
      }
    }
  }, []);

  useEffect(() => {
    const session = readAuthSession();
    setRole(session.role);
    setUsername(session.username || "guest");
    setAvatarUrl(session.avatarUrl);
  }, []);

  useEffect(() => {
    let isActive = true;

    const verifySession = async () => {
      const token = localStorage.getItem("campus404_token");
      if (!token) {
        return;
      }

      try {
        const res = await fetch(apiUrl("/auth/me"), {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 401) {
          if (isActive) {
            handleSessionExpired();
          }
          return;
        }

        if (!res.ok) {
          return;
        }

        const data = await res.json();
        if (!isActive || !data) {
          return;
        }

        const nextRole = String(data.role || "USER").toUpperCase();
        const nextUsername = String(data.username || "guest");

        setRole(nextRole);
        setUsername(nextUsername);
        localStorage.setItem("campus404_role", nextRole);
        localStorage.setItem("campus404_username", nextUsername);
      } catch {
        // Ignore transient network failures; authorization is enforced by protected API endpoints.
      }
    };

    verifySession();
    return () => {
      isActive = false;
    };
  }, [handleSessionExpired]);

  useEffect(() => {
    if (!ELEVATED.has(role)) {
      setContactUnreadCount(0);
      return undefined;
    }

    let disposed = false;

    async function loadContactUnreadCount() {
      try {
        const data = await fetchAdminContactMessages({ status: "unread", limit: 1 });
        if (!disposed) {
          setContactUnreadCount(Number(data?.total) || 0);
        }
      } catch (err) {
        if (err?.status === 401) {
          handleSessionExpired();
        }
      }
    }

    void loadContactUnreadCount();
    const intervalId = window.setInterval(loadContactUnreadCount, 60000);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
    };
  }, [handleSessionExpired, role]);

  const handleLogout = useCallback(async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      const token = localStorage.getItem("campus404_token");
      if (token) {
        await fetch(apiUrl("/auth/logout"), {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          keepalive: true,
        });
      }
    } catch {
      // ignore
    } finally {
      setIsLoggingOut(false);
      clearSessionAndRedirect();
    }
  }, [clearSessionAndRedirect, isLoggingOut]);

  if (!ELEVATED.has(role)) {
    return <AccessDenied />;
  }

  return (
    <main className={`ap-root ${isSidebarOpen ? "sidebar-open" : "sidebar-closed"}`}>
      <AdminSidebar
        activeKey={activeKey}
        onSelect={handleMenuSelect}
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen((prev) => !prev)}
        onLogout={handleLogout}
        unreadContactCount={contactUnreadCount}
      />

      <div className="ap-content">
        <AdminTopBar 
          activeKey={activeKey} 
          username={username} 
          role={role}
          avatarUrl={avatarUrl} 
          onLogout={handleLogout}
          isLoggingOut={isLoggingOut}
        />

        <div className="ap-body">
          {activeKey === "overview" && <OverviewPage />}
          {activeKey === "contacts" && (
            <AdminContactInbox
              onSessionExpired={handleSessionExpired}
              onUnreadCountChange={setContactUnreadCount}
            />
          )}
          {activeKey === "curriculum" && <CurriculumStudioPage />}
          {activeKey === "media" && <MediaLibraryPage />}
          {activeKey === "rewards" && <BadgeLibraryPage />}
          {activeKey === "submissions" && <LearningOpsPage variant="submissions" />}
          {activeKey === "leaderboards" && <LearningOpsPage variant="leaderboards" />}
          {activeKey === "health" && <LearningOpsPage variant="health" />}
          {activeKey === "users" && (
            <UserManagement
              role={role}
              username={username}
              onSessionExpired={handleSessionExpired}
            />
          )}
          {activeKey === "account" && (
            <AdminAccountPage
              onSessionExpired={handleSessionExpired}
              onProfileUpdated={handleProfileUpdated}
            />
          )}
          {activeKey === "settings" && <AdminSettingsPage />}
        </div>
      </div>
    </main>
  );
}
