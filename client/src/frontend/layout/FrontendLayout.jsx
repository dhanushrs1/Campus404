import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Header from "../components/Header/Header.jsx";
import Footer from "../components/Footer/Footer.jsx";
import AuthModal from "../components/AuthModal/AuthModal.jsx";
import { APP_ROUTES } from "../../routes/paths.js";
import { apiUrl } from "../../shared/api.js";
import "./FrontendLayout.css";

// Normal frontend shell. OAuth callback handling lives on its own fast route.
export default function FrontendLayout() {
  const navigate = useNavigate();

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState("USER");
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("campus404_token");
    const role = localStorage.getItem("campus404_role");
    const name = localStorage.getItem("campus404_username") ?? "";
    const storedAvatarUrl = localStorage.getItem("campus404_avatar_url") ?? "";

    if (token && role) {
      setIsAuthenticated(true);
      setUserRole(role.toUpperCase());
      setDisplayName(name);
      setAvatarUrl(storedAvatarUrl);
    }
  }, []);

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

    localStorage.removeItem("campus404_token");
    localStorage.removeItem("campus404_role");
    localStorage.removeItem("campus404_username");
    localStorage.removeItem("campus404_avatar_url");
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
