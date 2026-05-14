import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Header from "../components/Header/Header.jsx";
import Footer from "../components/Footer/Footer.jsx";
import AuthModal from "../components/AuthModal/AuthModal.jsx";
import { APP_ROUTES } from "../../routes/paths.js";
import { apiUrl } from "../../shared/api.js";
import { clearAuthSession, readAuthSession, saveAuthReturnTo } from "../../shared/authSession.js";
import "./FrontendLayout.css";

function shouldTrackVisit(pathname) {
  const path = String(pathname || "/").toLowerCase();
  return !["/admin", "/auth", "/api"].some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

// Normal frontend shell. OAuth callback handling lives on its own fast route.
export default function FrontendLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialSession = readAuthSession();

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authReturnTo, setAuthReturnTo] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(initialSession.isAuthenticated);
  const [userRole, setUserRole] = useState(initialSession.role);
  const [displayName, setDisplayName] = useState(initialSession.username);
  const [avatarUrl, setAvatarUrl] = useState(initialSession.avatarUrl);

  useEffect(() => {
    const session = readAuthSession();

    if (session.isAuthenticated) {
      setIsAuthenticated(true);
      setUserRole(session.role);
      setDisplayName(session.username);
      setAvatarUrl(session.avatarUrl);
      return;
    }
  }, []);

  useEffect(() => {
    if (location.state?.authRequired) {
      const nextReturnTo = location.state.from || `${location.pathname}${location.search}${location.hash}`;
      setAuthReturnTo(nextReturnTo);
      saveAuthReturnTo(nextReturnTo);
      setIsAuthModalOpen(true);
    }
  }, [location.hash, location.pathname, location.search, location.state]);

  useEffect(() => {
    if (!shouldTrackVisit(location.pathname)) return;

    const todayKey = new Date().toISOString().slice(0, 10);
    const storageKey = `campus404_visit_recorded_${todayKey}`;
    try {
      if (window.sessionStorage.getItem(storageKey)) return;
      window.sessionStorage.setItem(storageKey, "1");
    } catch {
      // Storage can be unavailable in strict privacy modes; the backend still deduplicates by IP/day.
    }

    const path = `${location.pathname}${location.search}`;
    fetch(apiUrl("/api/analytics/visit"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path,
        referrer: document.referrer || null,
      }),
      keepalive: true,
    }).catch(() => {
      try {
        window.sessionStorage.removeItem(storageKey);
      } catch {
        // Nothing else to do; analytics must never interrupt navigation.
      }
    });
  }, [location.pathname, location.search]);

  useEffect(() => {
    function handleOpenAuth(event) {
      const nextReturnTo = event.detail?.returnTo || `${location.pathname}${location.search}${location.hash}`;
      setAuthReturnTo(nextReturnTo);
      saveAuthReturnTo(nextReturnTo);
      setIsAuthModalOpen(true);
    }

    window.addEventListener("campus404:open-auth-modal", handleOpenAuth);
    return () => {
      window.removeEventListener("campus404:open-auth-modal", handleOpenAuth);
    };
  }, [location.hash, location.pathname, location.search]);

  const openAuthModal = () => {
    const nextReturnTo = `${location.pathname}${location.search}${location.hash}`;
    setAuthReturnTo(nextReturnTo);
    saveAuthReturnTo(nextReturnTo);
    setIsAuthModalOpen(true);
  };

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem("campus404_token");
      if (token) {
        await fetch(apiUrl("/auth/logout"), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch {
      // Ignore network errors on logout.
    }

    clearAuthSession();
    setIsAuthenticated(false);
    setUserRole("USER");
    setDisplayName("");
    setAvatarUrl("");
    navigate(APP_ROUTES.home);
  };

  return (
    <>
      <Header
        isAuthenticated={isAuthenticated}
        userRole={userRole}
        displayName={displayName}
        avatarUrl={avatarUrl}
        onOpenAuthModal={openAuthModal}
        onLogout={handleLogout}
        onAdminPanelEntry={undefined}
      />

      <main style={{ minHeight: "calc(100vh - 400px)" }}>
        <Outlet />
      </main>

      <Footer />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        returnTo={authReturnTo || `${location.pathname}${location.search}${location.hash}`}
      />
    </>
  );
}
