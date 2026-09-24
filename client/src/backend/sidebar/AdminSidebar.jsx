import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, LogOut, Menu } from "lucide-react";
import { APP_ROUTES } from "../../routes/paths.js";
import { ASSETS } from "../../shared/assets.js";
import { NAV_ITEMS } from "../dashboard/adminNavigation.js";
import "./AdminSidebar.css";

export default function AdminSidebar({
  activeKey,
  onSelect,
  isOpen,
  onToggle,
  onLogout,
  username,
  role,
  avatarUrl,
  unreadContactCount = 0,
}) {
  const [tooltip, setTooltip] = useState(null);
  const version = import.meta.env.VITE_APP_VERSION ?? "1.0.0";
  const contactBadgeLabel = unreadContactCount > 99 ? "99+" : String(unreadContactCount);
  const visibleNavItems = NAV_ITEMS.filter((item) => !item.adminOnly || String(role || "").toUpperCase() === "ADMIN");

  const showTooltip = (event, label) => {
    if (isOpen) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltip({ label, top: rect.top + rect.height / 2 });
  };

  const hideTooltip = () => setTooltip(null);

  return (
    <aside className={`mod-sidebar ${isOpen ? "is-open" : "is-collapsed"}`} aria-label="Admin console">
      <div className="mod-sidebar-top">
        <Link to={APP_ROUTES.home} className="mod-brand" aria-label="Campus404 home">
          <img src={isOpen ? ASSETS.brand.logo : ASSETS.brand.favicon} alt="Campus404" />
        </Link>
        <button
          type="button"
          className="mod-sidebar-toggle"
          onClick={onToggle}
          aria-label="Toggle admin navigation"
        >
          <Menu size={18} />
        </button>
      </div>

      <nav className="mod-sidebar-nav" aria-label="Admin navigation">
        {visibleNavItems.map(({ key, label, icon: Icon }) => {
          const isActive = activeKey === key;
          const showContactBadge = key === "contacts" && unreadContactCount > 0;

          return (
            <button
              key={key}
              type="button"
              className={`mod-nav-item ${isActive ? "is-active" : ""}`}
              onClick={() => onSelect(key)}
              onMouseEnter={(event) => showTooltip(event, label)}
              onMouseLeave={hideTooltip}
              onFocus={(event) => showTooltip(event, label)}
              onBlur={hideTooltip}
              data-tooltip={label}
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon size={18} />
              {isOpen && <span>{label}</span>}
              {showContactBadge && <b>{contactBadgeLabel}</b>}
              {isOpen && isActive && <ChevronRight size={15} className="mod-nav-arrow" />}
            </button>
          );
        })}
      </nav>

      <div className="mod-sidebar-profile">
        <div className="mod-avatar">
          {avatarUrl ? <img src={avatarUrl} alt={username || "Admin"} /> : <span>{(username || "A")[0].toUpperCase()}</span>}
        </div>
        {isOpen && (
          <div className="mod-profile-text">
            <strong>@{username || "admin"}</strong>
            <span>{role || "ADMIN"}</span>
          </div>
        )}
        {isOpen && <ChevronRight size={15} className="mod-profile-arrow" />}
      </div>

      <button type="button" className="mod-logout" onClick={onLogout}>
        <LogOut size={17} />
        {isOpen && <span>Sign out</span>}
      </button>

      {isOpen && <p className="mod-version">Version v{version}</p>}
      {!isOpen && tooltip && (
        <div className="mod-sidebar-tooltip" style={{ top: tooltip.top }}>
          {tooltip.label}
        </div>
      )}
    </aside>
  );
}
