import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Award,
  BadgeCheck,
  Boxes,
  CalendarDays,
  Check,
  ExternalLink,
  FileBadge2,
  Flame,
  GitBranch,
  Globe2,
  Link as LinkIcon,
  Loader2,
  MapPin,
  Sparkles,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";
import { APP_ROUTES } from "../../../routes/paths.js";
import { ASSETS } from "../../../shared/assets.js";
import { readAuthSession } from "../../../shared/authSession.js";
import { connectToProfile, disconnectFromProfile, getPublicProfile } from "../../../shared/profileApi.js";
import AvatarImage from "../../components/AvatarImage/AvatarImage.jsx";
import "./PublicProfilePage.css";

function formatNumber(value) {
  return new Intl.NumberFormat().format(Number(value) || 0);
}

function linkLabel(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return String(url || "").replace(/^https?:\/\//, "");
  }
}

function ActivityGrid({ days = [] }) {
  const maxXp = Math.max(...days.map((day) => Number(day.xp) || 0), 1);
  return (
    <div className="publicProfilePulse" aria-label="404 Pulse activity">
      {days.map((day) => {
        const xp = Number(day.xp) || 0;
        const level = xp <= 0 ? 0 : Math.max(1, Math.ceil((xp / maxXp) * 4));
        return <span key={day.date} data-level={level} title={`${day.date}: ${formatNumber(xp)} XP`} />;
      })}
    </div>
  );
}

function openAuthModal(username) {
  window.dispatchEvent(
    new CustomEvent("campus404:open-auth-modal", {
      detail: { returnTo: APP_ROUTES.frontendPublicProfile(username) },
    }),
  );
}

export default function PublicProfilePage() {
  const { username = "" } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const loadProfile = async () => {
    setLoading(true);
    setError("");
    try {
      setProfile(await getPublicProfile(username));
    } catch (err) {
      setError(err.message || "Unable to load profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [username]);

  const handleConnection = async () => {
    const session = readAuthSession();
    if (!session.isAuthenticated) {
      openAuthModal(username);
      return;
    }
    setWorking(true);
    try {
      const next = profile.viewer_connected
        ? await disconnectFromProfile(username)
        : await connectToProfile(username);
      setProfile(next);
    } catch (err) {
      setError(err.message || "Unable to update connection.");
    } finally {
      setWorking(false);
    }
  };

  if (loading) {
    return (
      <main className="publicProfilePage publicProfilePage--state">
        <Loader2 size={28} className="publicProfilePage__spin" />
        Loading Campus Passport...
      </main>
    );
  }

  if (error && !profile) {
    return (
      <main className="publicProfilePage publicProfilePage--state">
        <p>{error}</p>
        <Link className="btn btn-brand" to={APP_ROUTES.frontendLeaderboards}>Back to Leaderboards</Link>
      </main>
    );
  }

  const metrics = profile.metrics || {};
  const links = [
    profile.website_url && { href: profile.website_url, label: linkLabel(profile.website_url), icon: Globe2 },
    profile.github_url && { href: profile.github_url, label: "GitHub", icon: GitBranch },
    profile.linkedin_url && { href: profile.linkedin_url, label: "LinkedIn", icon: LinkIcon },
    profile.portfolio_url && { href: profile.portfolio_url, label: "Portfolio", icon: ExternalLink },
  ].filter(Boolean);

  return (
    <main className="publicProfilePage">
      <Link className="publicProfileBack" to={APP_ROUTES.frontendLeaderboards}>
        <ArrowLeft size={16} />
        Leaderboards
      </Link>

      <section className="publicProfileHero">
        <div className="publicProfileHero__identity">
          <AvatarImage src={profile.avatar_url} fallbackKey={profile.username} alt="" />
          <div>
            <span><Sparkles size={16} /> Campus Passport</span>
            <h1>{profile.display_name}</h1>
            <p>@{profile.username}</p>
            {profile.headline && <strong>{profile.headline}</strong>}
          </div>
        </div>
        <div className="publicProfileHero__actions">
          {profile.location_text && <small><MapPin size={14} /> {profile.location_text}</small>}
          {!profile.is_self && (
            <button type="button" className={profile.viewer_connected ? "is-connected" : ""} onClick={handleConnection} disabled={working}>
              {working ? <Loader2 size={16} className="publicProfilePage__spin" /> : profile.viewer_connected ? <Check size={16} /> : <UserPlus size={16} />}
              {profile.viewer_connected ? "Connected" : "Connect"}
            </button>
          )}
        </div>
      </section>

      {error && <div className="publicProfileNotice">{error}</div>}

      <section className="publicProfileStats">
        <article><img src={ASSETS.icons.xpStar} alt="" /><span>Total XP</span><strong>{formatNumber(metrics.total_xp)}</strong></article>
        <article><Trophy size={24} /><span>Global Rank</span><strong>{metrics.global_rank ? `#${formatNumber(metrics.global_rank)}` : "Unranked"}</strong></article>
        <article><Flame size={24} /><span>Streak</span><strong>{formatNumber(metrics.current_streak)}</strong></article>
        <article><Users size={24} /><span>Connected</span><strong>{formatNumber(metrics.connections_count)}</strong></article>
      </section>

      <section className="publicProfileGrid">
        <article className="publicProfilePanel publicProfilePanel--wide">
          <h2><CalendarDays size={18} /> 404 Pulse</h2>
          {profile.activity?.length ? <ActivityGrid days={profile.activity} /> : <p>No public activity yet.</p>}
        </article>

        <article className="publicProfilePanel">
          <h2><BadgeCheck size={18} /> Proof Shelf</h2>
          <div className="publicProofShelf">
            {(profile.certificates || []).map((item) => (
              <div key={`certificate-${item.id}`}>
                <FileBadge2 size={24} />
                <strong>{item.title}</strong>
                <small>{item.certificate_code}</small>
              </div>
            ))}
            {(profile.badges || []).map((item) => (
              <div key={`badge-${item.id}`}>
                {item.icon_url ? <img src={item.icon_url} alt="" /> : <Award size={24} />}
                <strong>{item.title}</strong>
                <small>Badge</small>
              </div>
            ))}
            {!profile.certificates?.length && !profile.badges?.length && <p>No public proof yet.</p>}
          </div>
        </article>

        <article className="publicProfilePanel">
          <h2><Boxes size={18} /> Build Drops</h2>
          <div className="publicBuildDrops">
            {(profile.projects || []).map((project) => (
              <a key={project.id} href={project.project_url} target="_blank" rel="noreferrer">
                <span>{project.image_url ? <img src={project.image_url} alt="" /> : <GitBranch size={22} />}</span>
                <strong>{project.title}</strong>
                {project.description && <small>{project.description}</small>}
              </a>
            ))}
            {!profile.projects?.length && <p>No public builds pinned yet.</p>}
          </div>
        </article>

        <article className="publicProfilePanel publicProfilePanel--wide publicProfileLinks">
          <h2>Links</h2>
          {links.length ? links.map((item) => {
            const Icon = item.icon;
            return (
              <a key={item.href} href={item.href} target="_blank" rel="noreferrer">
                <Icon size={17} />
                {item.label}
                <ExternalLink size={14} />
              </a>
            );
          }) : <p>No public links.</p>}
        </article>
      </section>
    </main>
  );
}
