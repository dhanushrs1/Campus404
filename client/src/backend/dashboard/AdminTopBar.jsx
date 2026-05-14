import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Globe, Plus, Search } from "lucide-react";
import { APP_ROUTES } from "../../routes/paths.js";
import { NAV_ITEMS } from "./adminNavigation.js";

function useLiveClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return now;
}

export default function AdminTopBar({ activeKey, username, avatarUrl, onSelect }) {
  const now = useLiveClock();
  const pageTitle = NAV_ITEMS.find((item) => item.key === activeKey)?.label ?? "Overview";
  const timeStr = now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const greeting = now.getHours() >= 17 ? "Good evening" : now.getHours() >= 12 ? "Good afternoon" : "Good morning";

  return (
    <header className="ap-topbar">
      <div className="ap-topbar__intro">
        <p>{greeting}, {username || "admin"}</p>
        <h1>{pageTitle}</h1>
      </div>

      <label className="ap-command-search">
        <Search size={17} />
        <input type="search" placeholder="Search learners, content, submissions..." />
        <kbd>Ctrl K</kbd>
      </label>

      <div className="ap-topbar__actions">
        <button type="button" className="ap-quick-action" onClick={() => onSelect("curriculum")}>
          <Plus size={17} />
          Quick Action
        </button>
        <Link className="ap-visit-site" to={APP_ROUTES.home} target="_blank" rel="noopener noreferrer">
          <Globe size={16} />
          Visit Site
        </Link>
        <div className="ap-topbar__datetime" aria-label={`${dateStr}, ${timeStr}`}>
          <CalendarDays size={16} />
          <div>
            <span>{dateStr}</span>
            <strong>{timeStr}</strong>
          </div>
        </div>
        <div className="ap-topbar__avatar">
          {avatarUrl ? <img src={avatarUrl} alt={username} /> : <span>{(username || "A")[0].toUpperCase()}</span>}
        </div>
      </div>
    </header>
  );
}
