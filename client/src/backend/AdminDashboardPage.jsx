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
} from "lucide-react";
import { APP_ROUTES } from "../routes/paths.js";
import { apiUrl } from "../shared/api.js";
import { ASSETS } from "../shared/assets.js";
import UserManagement from "./users/UserManagement.jsx";
import TrackManagerPage from "./curriculum/file-manager/TrackManagerPage.jsx";
import MediaLibraryPage from "./media/MediaLibraryPage.jsx";
import BadgeLibraryPage from "./media/BadgeLibraryPage.jsx";
import AdminAccountPage from "./account/AdminAccountPage.jsx";
import AdminSettingsPage from "./settings/AdminSettingsPage.jsx";
import "./AdminDashboardPage.css";

// ── Sidebar items ──────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "tracks", label: "Track Manager", icon: FolderTree },
  { key: "media", label: "Media Library", icon: Image },
    { key: "badges", label: "Badge Library", icon: Award },
  { key: "users", label: "User Management", icon: Users },
  { key: "account", label: "My Account", icon: User },
  { key: "settings", label: "Settings", icon: Settings2 },
];

const NAV_KEY_SET = new Set(NAV_ITEMS.map((item) => item.key));
const TRACK_QUERY_KEYS = [
  "trackPage",
  "mode",
  "trackId",
  "nodeType",
  "sectionId",
  "exerciseId",
  "taskId",
  "levelTab",
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

function AdminSidebar({ activeKey, onSelect, isOpen, onToggle, onLogout }) {
  const VERSION = import.meta.env.VITE_APP_VERSION ?? "1.0.0";

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
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            className={`ap-sidebar__item ${activeKey === key ? "ap-sidebar__item--active" : ""}`}
            onClick={() => onSelect(key)}
          >
            <Icon size={18} className="ap-sidebar__itemIcon" />
            
            {isOpen && <span className="ap-sidebar__itemLabel">{label}</span>}
            {isOpen && activeKey === key && <ChevronRight size={14} className="ap-sidebar__chevron" />}
            
            {/* Custom Tooltip for closed state */}
            {!isOpen && (
              <span className="ap-sidebar__tooltip">{label}</span>
            )}
          </button>
        ))}
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
  return (
    <div className="ap-page">
      <div className="ap-page__empty">
        <LayoutDashboard size={40} strokeWidth={1.2} />
        <h2>Overview</h2>
        <p>Dashboard metrics and summaries will appear here.</p>
      </div>
    </div>
  );
}



// ── Access denied ──────────────────────────────────────────────────────────

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

  const [role, setRole] = useState("USER");
  const [username, setUsername] = useState("guest");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const activeKey = useMemo(() => {
    const tab = (searchParams.get("tab") || "").toLowerCase();
    return NAV_KEY_SET.has(tab) ? tab : "overview";
  }, [searchParams]);

  const handleMenuSelect = useCallback(
    (key) => {
      if (!NAV_KEY_SET.has(key) || key === activeKey) {
        return;
      }

      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", key);

        // Track manager uses additional query params; clear them when leaving the tab.
        if (key !== "tracks") {
          TRACK_QUERY_KEYS.forEach((queryKey) => next.delete(queryKey));
        }

        return next;
      });
    },
    [activeKey, setSearchParams]
  );

  useEffect(() => {
    const tab = (searchParams.get("tab") || "").toLowerCase();
    if (!NAV_KEY_SET.has(tab)) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", "overview");
        return next;
      }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const clearSessionAndRedirect = useCallback(() => {
    ["campus404_token", "campus404_role", "campus404_username", "campus404_avatar_url", "campus404_setup_token"].forEach(
      (k) => localStorage.removeItem(k)
    );
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
    setRole((localStorage.getItem("campus404_role") || "USER").toUpperCase());
    setUsername(localStorage.getItem("campus404_username") || "guest");
    setAvatarUrl(localStorage.getItem("campus404_avatar_url") || "");
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
            {activeKey === "tracks" && <TrackManagerPage />}
          {activeKey === "media" && <MediaLibraryPage />}            {activeKey === "badges" && <BadgeLibraryPage />}          {activeKey === "users" && (
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
