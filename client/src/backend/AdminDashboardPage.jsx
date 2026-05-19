import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { APP_ROUTES } from "../routes/paths.js";
import { apiUrl } from "../shared/api.js";
import UserManagement from "./users/UserManagement.jsx";
import CurriculumStudioPage from "./curriculum/CurriculumStudioPage.jsx";
import MediaLibraryPage from "./media/MediaLibraryPage.jsx";
import BadgeLibraryPage from "./media/BadgeLibraryPage.jsx";
import AdminAccountPage from "./account/AdminAccountPage.jsx";
import AdminSettingsPage from "./settings/AdminSettingsPage.jsx";
import AdminContactInbox from "./contacts/AdminContactInbox.jsx";
import { authenticatedFetch, clearAuthSession, readAuthSession } from "../shared/authSession.js";
import { fetchAdminContactMessages } from "../shared/contactApi.js";
import AdminSidebar from "./sidebar/AdminSidebar.jsx";
import AdminTopBar from "./topbar/AdminTopBar.jsx";
import LearningOpsPage from "./dashboard/LearningOpsPage.jsx";
import AnalyticsPage from "./dashboard/analytics/AnalyticsPage.jsx";
import OverviewPage from "./dashboard/overview/OverviewPage.jsx";
import {
  CURRICULUM_QUERY_KEYS,
  ELEVATED,
  NAV_ALIASES,
  NAV_KEY_SET,
} from "./dashboard/adminNavigation.js";
import "./shared/AdminSharedUI.css";
import "./AdminDashboardPage.css";
import "./styles/admin-buttons.css";

const ADMIN_SIDEBAR_STORAGE_KEY = "campus404_admin_sidebar_open";

function readStoredSidebarOpen() {
  if (typeof window === "undefined") return true;

  try {
    const storedValue = window.localStorage.getItem(ADMIN_SIDEBAR_STORAGE_KEY);
    return storedValue === null ? true : storedValue === "true";
  } catch {
    return true;
  }
}

function AccessDenied() {
  return (
    <main className="ap-denied">
      <div className="ap-denied__card">
        <ShieldCheck size={40} />
        <h1>Access Restricted</h1>
        <p>This console is available only to admins and editors.</p>
        <Link className="ap-denied__link" to={APP_ROUTES.frontendDashboard}>
          Go to Dashboard
        </Link>
      </div>
    </main>
  );
}

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSession = readAuthSession();

  const [role, setRole] = useState(initialSession.role);
  const [username, setUsername] = useState(initialSession.username || "guest");
  const [avatarUrl, setAvatarUrl] = useState(initialSession.avatarUrl);
  const [isSidebarOpen, setIsSidebarOpen] = useState(readStoredSidebarOpen);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [contactUnreadCount, setContactUnreadCount] = useState(0);

  const activeKey = useMemo(() => {
    const tab = (searchParams.get("tab") || "").toLowerCase();
    const normalized = NAV_ALIASES[tab] || tab;
    return NAV_KEY_SET.has(normalized) ? normalized : "overview";
  }, [searchParams]);

  const handleMenuSelect = useCallback(
    (key) => {
      if (!NAV_KEY_SET.has(key) || key === activeKey) return;

      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", key);
        if (key !== "curriculum") {
          CURRICULUM_QUERY_KEYS.forEach((queryKey) => next.delete(queryKey));
        }
        return next;
      }, { preventScrollReset: true, replace: true });
    },
    [activeKey, setSearchParams],
  );

  const handleSidebarToggle = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(ADMIN_SIDEBAR_STORAGE_KEY, String(isSidebarOpen));
    } catch {
      // Layout preference persistence should never block the admin console.
    }
  }, [isSidebarOpen]);

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
    if (!nextProfile || typeof nextProfile !== "object") return;

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

    async function verifySession() {
      try {
        const res = await authenticatedFetch(apiUrl("/auth/me"));

        if (res.status === 401) {
          if (isActive) handleSessionExpired();
          return;
        }

        if (!res.ok) return;

        const data = await res.json();
        if (!isActive || !data) return;

        const nextRole = String(data.role || "USER").toUpperCase();
        const nextUsername = String(data.username || "guest");

        setRole(nextRole);
        setUsername(nextUsername);
        localStorage.setItem("campus404_role", nextRole);
        localStorage.setItem("campus404_username", nextUsername);
      } catch {
        // Admin APIs enforce authorization; transient profile checks should not eject the user.
      }
    }

    void verifySession();
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
      await fetch(apiUrl("/auth/logout"), {
        method: "POST",
        credentials: "include",
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        keepalive: true,
      });
    } catch {
      // Ignore network failures during logout; the local session is still cleared.
    } finally {
      setIsLoggingOut(false);
      clearSessionAndRedirect();
    }
  }, [clearSessionAndRedirect, isLoggingOut]);

  if (!ELEVATED.has(role)) {
    return <AccessDenied />;
  }

  return (
    <main className={`ap-root mod-root ${isSidebarOpen ? "sidebar-open" : "sidebar-closed"}`}>
      <AdminSidebar
        activeKey={activeKey}
        onSelect={handleMenuSelect}
        isOpen={isSidebarOpen}
        onToggle={handleSidebarToggle}
        onLogout={handleLogout}
        username={username}
        role={role}
        avatarUrl={avatarUrl}
        unreadContactCount={contactUnreadCount}
      />

      <div className="ap-content mod-content">
        <AdminTopBar
          username={username}
          avatarUrl={avatarUrl}
        />

        <div className={`ap-body ${activeKey === "overview" ? "ap-body--overview" : ""}`}>
          {activeKey === "overview" && (
            <OverviewPage
              username={username}
              onNavigate={handleMenuSelect}
              onSessionExpired={handleSessionExpired}
            />
          )}
          {activeKey === "analytics" && <AnalyticsPage onSessionExpired={handleSessionExpired} />}
          {activeKey === "contacts" && (
            <AdminContactInbox
              onSessionExpired={handleSessionExpired}
              onUnreadCountChange={setContactUnreadCount}
            />
          )}
          {activeKey === "curriculum" && <CurriculumStudioPage role={role} />}
          {activeKey === "media" && <MediaLibraryPage />}
          {activeKey === "rewards" && <BadgeLibraryPage />}
          {activeKey === "submissions" && <LearningOpsPage variant="submissions" onSessionExpired={handleSessionExpired} />}
          {activeKey === "leaderboards" && <LearningOpsPage variant="leaderboards" onSessionExpired={handleSessionExpired} />}
          {activeKey === "health" && <LearningOpsPage variant="health" onSessionExpired={handleSessionExpired} />}
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
