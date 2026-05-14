import { Link } from "react-router-dom";
import { ChevronRight, LogOut, Menu } from "lucide-react";
import { APP_ROUTES } from "../../routes/paths.js";
import { ASSETS } from "../../shared/assets.js";
import { NAV_SECTIONS } from "../dashboard/adminNavigation.js";

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
  const version = import.meta.env.VITE_APP_VERSION ?? "1.0.0";
  const contactBadgeLabel = unreadContactCount > 99 ? "99+" : String(unreadContactCount);

  return (
    <aside className={`ap-sidebar ${isOpen ? "is-open" : "is-closed"}`} aria-label="Admin console">
      <div className="ap-sidebar__brand-row">
        <Link to={APP_ROUTES.home} className="ap-sidebar__brand" aria-label="Campus404 home">
          <img src={isOpen ? ASSETS.brand.logo : ASSETS.brand.favicon} alt="Campus404" />
        </Link>
        <button type="button" className="ap-sidebar__toggle" onClick={onToggle} aria-label="Toggle admin navigation">
          <Menu size={18} />
        </button>
      </div>

      <nav className="ap-sidebar__nav" aria-label="Admin navigation">
        {NAV_SECTIONS.map((section) => (
          <section className="ap-nav-section" key={section.title}>
            <h2>{section.title}</h2>
            {section.items.map(({ key, label, icon: Icon }) => {
              const isActive = activeKey === key;
              const showContactBadge = key === "contacts" && unreadContactCount > 0;

              return (
                <button
                  key={key}
                  type="button"
                  className={`ap-nav-item ${isActive ? "is-active" : ""}`}
                  onClick={() => onSelect(key)}
                  title={!isOpen ? label : undefined}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon size={18} />
                  {isOpen && <span>{label}</span>}
                  {showContactBadge && <b>{contactBadgeLabel}</b>}
                  {isOpen && isActive && <ChevronRight size={15} className="ap-nav-item__arrow" />}
                </button>
              );
            })}
          </section>
        ))}
      </nav>

      <div className="ap-sidebar__profile">
        <div className="ap-sidebar__avatar">
          {avatarUrl ? <img src={avatarUrl} alt={username} /> : <span>{(username || "A")[0].toUpperCase()}</span>}
        </div>
        {isOpen && (
          <div className="ap-sidebar__profile-copy">
            <strong>@{username || "admin"}</strong>
            <span>{role || "ADMIN"}</span>
          </div>
        )}
        {isOpen && <ChevronRight size={15} className="ap-sidebar__profile-arrow" />}
      </div>

      <button type="button" className="ap-sidebar__logout" onClick={onLogout}>
        <LogOut size={17} />
        {isOpen && <span>Sign out</span>}
      </button>

      {isOpen && <p className="ap-sidebar__version">Version v{version}</p>}
    </aside>
  );
}
