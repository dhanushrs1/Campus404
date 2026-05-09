import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Code,
  Database,
  LayoutDashboard,
  Menu,
  Server,
  Shield,
  Terminal,
  X,
} from "lucide-react";
import { APP_ROUTES } from "../../../routes/paths.js";
import { ASSETS } from "../../../shared/assets.js";
import "./Header.css";

const NAV_MENU_ITEMS = [
  {
    key: "tracks",
    type: "link",
    label: "Tracks",
    path: APP_ROUTES.frontendTracks,
  },
  {
    key: "architecture",
    type: "link",
    label: "Architecture",
    path: APP_ROUTES.home,
  },
  {
    key: "execution-api",
    type: "link",
    label: "Execution API",
    path: APP_ROUTES.home,
  },
  {
    key: "resources",
    type: "mega",
    label: "Resources",
  },
  {
    key: "documentation",
    type: "link",
    label: "Documentation",
    path: APP_ROUTES.home,
  },
];

const MEGA_MENU_ITEMS = [
  {
    title: "Frontend",
    icon: Code,
    path: APP_ROUTES.home,
  },
  {
    title: "Backend API",
    icon: Server,
    path: APP_ROUTES.home,
  },
  {
    title: "Database",
    icon: Database,
    path: APP_ROUTES.home,
  },
  {
    title: "Systems",
    icon: Terminal,
    path: APP_ROUTES.home,
  },
];

export default function Header({
  isAuthenticated = false,
  userRole = "USER",
  displayName = "",
  avatarUrl = "",
  onOpenAuthModal,
  onLogout,
  onAdminPanelEntry,
}) {
  const [isMegaMenuOpen, setIsMegaMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileMegaViewOpen, setIsMobileMegaViewOpen] = useState(false);

  const megaMenuRef = useRef(null);
  const profileMenuRef = useRef(null);
  const hasMegaMenuItems = MEGA_MENU_ITEMS.length > 0;
  const isElevatedUser = userRole === "ADMIN" || userRole === "EDITOR";

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (megaMenuRef.current && !megaMenuRef.current.contains(event.target)) {
        setIsMegaMenuOpen(false);
      }
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
    setIsMobileMegaViewOpen(false);
  };

  const openMobileMenu = () => {
    setIsMegaMenuOpen(false);
    setIsProfileMenuOpen(false);
    setIsMobileMenuOpen(true);
  };

  const handleElevatedPanelClick = () => {
    if (typeof onAdminPanelEntry === "function") {
      onAdminPanelEntry();
    }
  };

  return (
    <>
      <header className="nav-bar">
        <div className="container nav-inner">
          <Link to={APP_ROUTES.home} className="brand-mark" aria-label="Campus404 home">
            <img className="brand-mark__logo" src={ASSETS.brand.logo} alt="" />
          </Link>

          <nav className="nav-menu">
            {NAV_MENU_ITEMS.map((menuItem) => {
              if (menuItem.type === "link") {
                return (
                  <Link key={menuItem.key} to={menuItem.path} className="nav-menu-link">
                    {menuItem.label}
                  </Link>
                );
              }

              if (!hasMegaMenuItems) {
                return null;
              }

              return (
                <div
                  key={menuItem.key}
                  className="nav-mega"
                  ref={megaMenuRef}
                  onMouseEnter={() => setIsMegaMenuOpen(true)}
                  onMouseLeave={() => setIsMegaMenuOpen(false)}
                >
                  <button
                    type="button"
                    className="nav-mega-trigger"
                    onClick={() => setIsMegaMenuOpen((prev) => !prev)}
                    aria-expanded={isMegaMenuOpen}
                    aria-haspopup="true"
                  >
                    {menuItem.label}
                    <ChevronDown size={14} className={`mega-chevron ${isMegaMenuOpen ? "open" : ""}`} />
                  </button>

                  {isMegaMenuOpen && (
                    <div className="nav-mega-panel">
                      <div className="nav-mega-grid">
                        {MEGA_MENU_ITEMS.map((megaItem) => {
                          const Icon = megaItem.icon;
                          return (
                            <Link
                              key={megaItem.title}
                              to={megaItem.path}
                              className="nav-mega-item"
                              onClick={() => setIsMegaMenuOpen(false)}
                            >
                              <Icon size={18} />
                              <span>{megaItem.title}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
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
                          onLogout();
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
              className="mobile-menu-trigger mobile-menu-trigger--right"
              onClick={openMobileMenu}
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Off-Canvas Menu */}
      <div className={`mobile-offcanvas ${isMobileMenuOpen ? "open" : ""}`} aria-hidden={!isMobileMenuOpen}>
        <button
          type="button"
          className="mobile-offcanvas-overlay"
          onClick={closeMobileMenu}
          aria-label="Close menu"
        ></button>
        <div className="mobile-offcanvas-inner">
          <div className="mobile-offcanvas-header">
            <Link to={APP_ROUTES.home} className="brand-mark" onClick={closeMobileMenu} aria-label="Campus404 home">
              <img className="brand-mark__logo" src={ASSETS.brand.logo} alt="" />
            </Link>
            <button type="button" className="mobile-offcanvas-close" onClick={closeMobileMenu}>
              <X size={24} />
            </button>
          </div>

          <div className="mobile-nav-links">
            {NAV_MENU_ITEMS.map((menuItem) => {
              if (menuItem.type === "link") {
                return (
                  <Link
                    key={menuItem.key}
                    to={menuItem.path}
                    className="mobile-nav-item"
                    onClick={closeMobileMenu}
                  >
                    {menuItem.label}
                  </Link>
                );
              }

              if (!hasMegaMenuItems) {
                return null;
              }

              return (
                <button
                  key={menuItem.key}
                  type="button"
                  className="mobile-nav-item mobile-nav-item--button"
                  onClick={() => setIsMobileMegaViewOpen(true)}
                >
                  <span>{menuItem.label}</span>
                  <ChevronRight size={16} />
                </button>
              );
            })}
          </div>

          <div className={`mobile-subpanel ${isMobileMegaViewOpen ? "open" : ""}`}>
            <div className="mobile-subpanel-header">
              <button
                type="button"
                className="mobile-subpanel-back"
                onClick={() => setIsMobileMegaViewOpen(false)}
              >
                <ArrowLeft size={16} />
                <span>Back</span>
              </button>
              <span className="mobile-subpanel-title">Resources</span>
            </div>

            <div className="mobile-subpanel-list">
              {MEGA_MENU_ITEMS.map((megaItem) => {
                const Icon = megaItem.icon;

                return (
                  <Link
                    key={megaItem.title}
                    to={megaItem.path}
                    className="mobile-mega-link"
                    onClick={closeMobileMenu}
                  >
                    <Icon size={18} />
                    <span>{megaItem.title}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
