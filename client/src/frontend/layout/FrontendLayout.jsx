import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Header from "../components/Header/Header.jsx";
import Footer from "../components/Footer/Footer.jsx";
import AuthModal from "../components/AuthModal/AuthModal.jsx";
import { APP_ROUTES } from "../../routes/paths.js";
import { apiUrl } from "../../shared/api.js";
import { clearAuthSession, readAuthSession } from "../../shared/authSession.js";
import "./FrontendLayout.css";

// Normal frontend shell. OAuth callback handling lives on its own fast route.
export default function FrontendLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialSession = readAuthSession();

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
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
      setIsAuthModalOpen(true);
    }
  }, [location.state]);

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
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
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
      />
    </>
  );
}
