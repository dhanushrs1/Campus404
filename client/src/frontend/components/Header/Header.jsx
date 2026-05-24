import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  BookOpen,
  FileText,
  Home,
  LayoutDashboard,
  Mail,
  Menu,
  Shield,
  Trophy,
  X,
} from "lucide-react";
import { APP_ROUTES } from "../../../routes/paths.js";
import { ASSETS } from "../../../shared/assets.js";
import "./Header.css";

const NAV_MENU_ITEMS = [
  {
    key: "home",
    label: "Home",
    path: APP_ROUTES.home,
    icon: Home,
    description: "Return to the Campus404 home page.",
  },
  {
    key: "tracks",
    label: "Tracks",
    path: APP_ROUTES.frontendTracks,
    icon: BookOpen,
    description: "Explore practical coding tracks and learning paths.",
  },
  {
    key: "leaderboards",
    label: "Leaderboards",
    path: APP_ROUTES.frontendLeaderboard({ scope: "global" }),
    icon: Trophy,
    description: "See global and track XP rankings.",
  },
  {
    key: "legal",
    label: "Legal Centre",
    path: APP_ROUTES.legal,
    icon: FileText,
    description: "Review privacy, terms, security, and platform policies.",
  },
  {
    key: "contact",
    label: "Contact",
    path: APP_ROUTES.contactUs,
    icon: Mail,
    description: "Reach the Campus404 and Cognex team.",
  },
];

const DESKTOP_NAV_ITEMS = NAV_MENU_ITEMS.filter((item) => item.key !== "home");

export default function Header({
  isAuthenticated = false,
  userRole = "USER",
  displayName = "",
  avatarUrl = "",
  onOpenAuthModal,
  onLogout,
  onAdminPanelEntry,
}) {
  const location = useLocation();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const profileMenuRef = useRef(null);
  const isElevatedUser = userRole === "ADMIN" || userRole === "EDITOR";
  const currentPath = location.pathname;

  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  const closeProfileMenu = () => {
    setIsProfileMenuOpen(false);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const openMobileMenu = () => {
    setIsProfileMenuOpen(false);
    setIsMobileMenuOpen(true);
  };

  const handleElevatedPanelClick = () => {
    if (typeof onAdminPanelEntry === "function") {
      onAdminPanelEntry();
    }
  };

  const openMobileAuth = () => {
    closeMobileMenu();
    if (typeof onOpenAuthModal === "function") {
      onOpenAuthModal();
    }
  };

  return (
    <>
      <header className="nav-bar">
        <div className="container nav-inner">
          <Link to={APP_ROUTES.home} className="brand-mark" aria-label="Campus404 home">
            <img className="brand-mark__logo" src={ASSETS.brand.logo} alt="" />
          </Link>

          <nav className="nav-menu" aria-label="Primary navigation">
            {DESKTOP_NAV_ITEMS.map((menuItem) => {
              const isActive = (
                (menuItem.key === "leaderboards" && currentPath === APP_ROUTES.frontendLeaderboards)
                || currentPath === menuItem.path
              );
              return (
                <Link key={menuItem.key} to={menuItem.path} className={`nav-menu-link ${isActive ? "is-active" : ""}`}>
                  {menuItem.label}
                </Link>
              );
            })}
          </nav>

          <div className="nav-actions">
            {!isAuthenticated ? (
              <>
                <button onClick={onOpenAuthModal} className="btn btn-ghost">
                  Sign In
                </button>
                <button onClick={onOpenAuthModal} className="btn btn-brand">
                  Start Coding
                </button>
              </>
            ) : (
              <>
                {isElevatedUser ? (
                  <Link
                    to={APP_ROUTES.adminDashboardTab("overview")}
                    className="btn btn-brand nav-dashboard-btn"
                    aria-label="Open elevated panel"
                    onClick={handleElevatedPanelClick}
                  >
                    <Shield size={15} />
                    <span className="nav-dashboard-label">
                      {userRole === "EDITOR" ? "Editor" : "Admin"}
                    </span>
                  </Link>
                ) : (
                  <Link
                    to={APP_ROUTES.frontendDashboard}
                    className="btn btn-brand nav-dashboard-btn"
                    aria-label="Open dashboard"
                  >
                    <LayoutDashboard size={15} />
                    <span className="nav-dashboard-label">Dashboard</span>
                  </Link>
                )}

                <div
                  className="nav-profile-wrap"
                  ref={profileMenuRef}
                  onMouseEnter={() => setIsProfileMenuOpen(true)}
                  onMouseLeave={() => setIsProfileMenuOpen(false)}
                >
                  <button
                    type="button"
                    className="nav-profile nav-profile-button"
                    title={displayName ? `@${displayName}` : "Profile"}
                    onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                    aria-expanded={isProfileMenuOpen}
                    aria-haspopup="true"
                  >
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={displayName ? `${displayName} profile` : "User profile"}
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="nav-profile-fallback">
                        {(displayName?.charAt(0) || "U").toUpperCase()}
                      </span>
                    )}
                  </button>

                  {isProfileMenuOpen && (
                    <div className="nav-profile-menu">
                      <div className="nav-profile-menu-head">
                        <span className="nav-profile-menu-avatar">
                          {avatarUrl ? (
                            <img
                              src={avatarUrl}
                              alt=""
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <span>{(displayName?.charAt(0) || "U").toUpperCase()}</span>
                          )}
                        </span>
                        <span className="nav-profile-menu-copy">
                          <strong>{displayName || "Campus404 User"}</strong>
                          <small>{userRole === "EDITOR" ? "Editor" : userRole === "ADMIN" ? "Admin" : "Learner"}</small>
                        </span>
                      </div>
                      <Link
                        to={APP_ROUTES.frontendDashboard}
                        className="nav-profile-item"
                        onClick={closeProfileMenu}
                      >
                        Profile
                      </Link>
                      <Link
                        to={APP_ROUTES.frontendDashboard}
                        className="nav-profile-item"
                        onClick={closeProfileMenu}
                      >
                        Settings
                      </Link>
                      <button
                        type="button"
                        className="nav-profile-item nav-profile-item--danger"
                        onClick={() => {
                          closeProfileMenu();
                          if (typeof onLogout === "function") {
                            onLogout();
                          }
                        }}
                      >
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}

            <button
              type="button"
              className="mobile-menu-trigger"
              onClick={openMobileMenu}
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
          </div>
        </div>
      </header>

      <div
        className={`mobile-offcanvas ${isMobileMenuOpen ? "open" : ""}`}
        aria-hidden={!isMobileMenuOpen}
      >
        <button
          type="button"
          className="mobile-offcanvas-overlay"
          onClick={closeMobileMenu}
          aria-label="Close menu"
        ></button>

        <div className="mobile-offcanvas-inner">
          <div className="mobile-offcanvas-header">
            <Link
              to={APP_ROUTES.home}
              className="brand-mark"
              onClick={closeMobileMenu}
              aria-label="Campus404 home"
            >
              <img className="brand-mark__logo" src={ASSETS.brand.logo} alt="" />
            </Link>
            <button
              type="button"
              className="mobile-offcanvas-close"
              onClick={closeMobileMenu}
              aria-label="Close menu"
            >
              <X size={22} />
            </button>
          </div>

          <div className="mobile-offcanvas-body">
            <p className="mobile-menu-title">Menu</p>
            <nav className="mobile-nav-links" aria-label="Mobile navigation">
              {NAV_MENU_ITEMS.map((menuItem) => {
                const Icon = menuItem.icon;

                return (
                  <Link
                    key={menuItem.key}
                    to={menuItem.path}
                    className="mobile-nav-item"
                    onClick={closeMobileMenu}
                  >
                    <span className="mobile-nav-item__icon">
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    <span>{menuItem.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="mobile-menu-actions">
              {!isAuthenticated ? (
                <>
                  <button type="button" onClick={openMobileAuth} className="btn btn-ghost">
                    Sign In
                  </button>
                  <button type="button" onClick={openMobileAuth} className="btn btn-brand">
                    Start Coding
                  </button>
                </>
              ) : (
                <Link
                  to={isElevatedUser ? APP_ROUTES.adminDashboardTab("overview") : APP_ROUTES.frontendDashboard}
                  className="btn btn-brand"
                  onClick={() => {
                    closeMobileMenu();
                    if (isElevatedUser) {
                      handleElevatedPanelClick();
                    }
                  }}
                >
                  <LayoutDashboard size={15} />
                  <span>{isElevatedUser ? "Open Panel" : "Open Dashboard"}</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
