import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, CalendarDays, Globe, Search } from "lucide-react";
import { APP_ROUTES } from "../../routes/paths.js";
import "./AdminTopBar.css";

function useLiveClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return now;
}

export default function AdminTopBar({ username, avatarUrl }) {
  const now = useLiveClock();
  const safeUsername = username || "admin";
  const initial = safeUsername.charAt(0).toUpperCase();
  const timeStr = now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <header className="mod-topbar">
      <div className="mod-topbar-main">
        <label className="mod-search">
          <Search size={17} />
          <input type="search" placeholder="Search learners, content, submissions..." />
        </label>
      </div>

      <div className="mod-topbar-actions">
        <button type="button" className="mod-icon-btn" aria-label="Notifications">
          <Bell size={17} />
          <span aria-hidden="true" />
        </button>
        <Link className="mod-btn" to={APP_ROUTES.home} target="_blank" rel="noopener noreferrer">
          <Globe size={16} />
          <span>Visit Site</span>
        </Link>
        <div className="mod-topbar-date" aria-label={`${dateStr}, ${timeStr}`}>
          <CalendarDays size={16} />
          <span>{dateStr}</span>
          <strong>{timeStr}</strong>
        </div>
        <div className="mod-topbar-profile">
          <div className="mod-avatar">
            {avatarUrl ? <img src={avatarUrl} alt={safeUsername} /> : <span>{initial}</span>}
          </div>
          <div>
            <strong>@{safeUsername}</strong>
          </div>
        </div>
      </div>
    </header>
  );
}
