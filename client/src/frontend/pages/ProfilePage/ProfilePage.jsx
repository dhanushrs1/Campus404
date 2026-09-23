import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Award,
  BadgeCheck,
  Boxes,
  CalendarCheck2,
  Check,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  ExternalLink,
  FileBadge2,
  Flame,
  GitBranch,
  Globe2,
  IdCard,
  Link as LinkIcon,
  Loader2,
  LockKeyhole,
  MapPin,
  Medal,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Trophy,
  UserRound,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { APP_ROUTES } from "../../../routes/paths.js";
import { ASSETS } from "../../../shared/assets.js";
import { clearAuthSession, syncAuthSession } from "../../../shared/authSession.js";
import {
  claimCertificate,
  claimDailyCheckIn,
  createAccountChangeRequest,
  createMyProject,
  deleteMyProject,
  getMyProfile,
  getMySessions,
  revokeMySessions,
  updateMyProfile,
  updateMyProject,
} from "../../../shared/profileApi.js";
import AvatarImage from "../../components/AvatarImage/AvatarImage.jsx";
import "./ProfilePage.css";

const TABS = [
  { key: "passport", label: "Campus Passport", icon: IdCard },
  { key: "edit", label: "Edit Profile", icon: Pencil },
  { key: "rewards", label: "Rewards", icon: WalletCards },
  { key: "showcase", label: "Showcase", icon: Boxes },
  { key: "account", label: "Account & Privacy", icon: ShieldCheck },
];

const AVATAR_OPTIONS = Object.entries(ASSETS.avatars).map(([id, src]) => ({ id, src }));

const EMPTY_PROJECT = {
  title: "",
  description: "",
  project_url: "",
  image_url: "",
  tags: "",
  is_public: true,
};

function formatNumber(value) {
  return new Intl.NumberFormat().format(Number(value) || 0);
}

function formatDate(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "Recently";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function compactDate(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function splitTags(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
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
    <div className="profilePulse" aria-label="404 Pulse activity">
      {days.map((day) => {
        const xp = Number(day.xp) || 0;
        const level = xp <= 0 ? 0 : Math.max(1, Math.ceil((xp / maxXp) * 4));
        return (
          <span
            key={day.date}
            className="profilePulse__cell"
            data-level={level}
            title={`${day.date}: ${formatNumber(xp)} XP`}
          />
        );
      })}
    </div>
  );
}

function BadgeShelf({ badges = [], certificates = [] }) {
  const proofItems = [
    ...certificates.map((item) => ({ ...item, proofType: "certificate" })),
    ...badges.map((item) => ({ ...item, proofType: "badge" })),
  ].slice(0, 8);

  if (!proofItems.length) {
    return <p className="profileEmptyText">Proof Shelf unlocks as you complete tracks, sections, and challenges.</p>;
  }

  return (
    <div className="profileProofGrid">
      {proofItems.map((item) => (
        <article key={`${item.proofType}-${item.id}`}>
          <span>
            {item.proofType === "certificate" ? (
              <FileBadge2 size={24} />
            ) : item.icon_url ? (
              <img src={item.icon_url} alt="" />
            ) : (
              <Award size={24} />
            )}
          </span>
          <strong>{item.title}</strong>
          <small>{item.proofType === "certificate" ? item.certificate_code : compactDate(item.awarded_at)}</small>
        </article>
      ))}
    </div>
  );
}

function ProjectCard({ project, editable = false, onEdit, onDelete }) {
  return (
    <article className="profileProjectCard">
      <div className="profileProjectCard__media">
        {project.image_url ? <img src={project.image_url} alt="" /> : <GitBranch size={28} />}
      </div>
      <div>
        <div className="profileProjectCard__head">
          <h3>{project.title}</h3>
          {editable && (
            <span className={`profileProjectCard__state ${project.is_public ? "is-public" : ""}`}>
              {project.is_public ? "Public" : "Private"}
            </span>
          )}
        </div>
        {project.description && <p>{project.description}</p>}
        <div className="profileProjectCard__tags">
          {(project.tags || []).map((tag) => <span key={tag}>{tag}</span>)}
        </div>
        <a href={project.project_url} target="_blank" rel="noreferrer">
          {linkLabel(project.project_url)} <ExternalLink size={14} />
        </a>
      </div>
      {editable && (
        <div className="profileProjectCard__actions">
          <button type="button" onClick={() => onEdit?.(project)} aria-label={`Edit ${project.title}`}>
            <Pencil size={16} />
          </button>
          <button type="button" onClick={() => onDelete?.(project.id)} aria-label={`Delete ${project.title}`}>
            <Trash2 size={16} />
          </button>
        </div>
      )}
    </article>
  );
}

export default function ProfilePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => searchParams.get("tab") || "passport");
  const [profileData, setProfileData] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState({});
  const [projectDraft, setProjectDraft] = useState(EMPTY_PROJECT);
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [accountRequest, setAccountRequest] = useState({
    request_type: "email_change",
    requested_email: "",
    requested_provider: "github",
    note: "",
  });

  const loadProfile = async () => {
    setLoading(true);
    setError("");
    try {
      const [profilePayload, sessionPayload] = await Promise.all([
        getMyProfile(),
        getMySessions().catch(() => []),
      ]);
      setProfileData(profilePayload);
      setSessions(Array.isArray(sessionPayload) ? sessionPayload : []);
      setDraft(profilePayload.profile || {});
    } catch (err) {
      setError(err.message || "Unable to load profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && TABS.some((item) => item.key === tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  function openTab(tab) {
    setActiveTab(tab);
    setSearchParams(tab === "passport" ? {} : { tab }, { preventScrollReset: true });
  }

  const account = profileData?.account || {};
  const profile = profileData?.profile || {};
  const metrics = profileData?.metrics || {};
  const rewards = profileData?.rewards || {};
  const projects = Array.isArray(profileData?.projects) ? profileData.projects : [];
  const badges = Array.isArray(profileData?.badges) ? profileData.badges : [];
  const certificates = profileData?.certificates || { claimed: [], eligible_tracks: [] };
  const activity = Array.isArray(profileData?.activity) ? profileData.activity : [];
  const publicProfilePath = account.username ? APP_ROUTES.frontendPublicProfile(account.username) : APP_ROUTES.frontendProfile;

  const heroLinks = useMemo(() => ([
    profile.website_url && { icon: Globe2, label: linkLabel(profile.website_url), href: profile.website_url },
    profile.github_url && { icon: GitBranch, label: "GitHub", href: profile.github_url },
    profile.linkedin_url && { icon: LinkIcon, label: "LinkedIn", href: profile.linkedin_url },
    profile.portfolio_url && { icon: ExternalLink, label: "Portfolio", href: profile.portfolio_url },
  ].filter(Boolean)), [profile]);

  const saveProfile = async (event) => {
    event?.preventDefault();
    setSaving(true);
    setNotice("");
    setError("");
    try {
      const next = await updateMyProfile({
        display_name: draft.display_name,
        headline: draft.headline,
        bio: draft.bio,
        location_text: draft.location_text,
        website_url: draft.website_url,
        github_url: draft.github_url,
        linkedin_url: draft.linkedin_url,
        portfolio_url: draft.portfolio_url,
        avatar_source: draft.avatar_source,
        selected_avatar_url: draft.selected_avatar_url,
        is_public: draft.is_public,
        show_badges: draft.show_badges,
        show_certificates: draft.show_certificates,
        show_activity: draft.show_activity,
        show_projects: draft.show_projects,
        show_rank: draft.show_rank,
        show_connections: draft.show_connections,
      });
      setProfileData(next);
      setDraft(next.profile || {});
      syncAuthSession({ username: next.account?.username, role: next.account?.role, avatar: next.profile?.active_avatar_url });
      setNotice("Profile saved.");
    } catch (err) {
      setError(err.message || "Unable to save profile.");
    } finally {
      setSaving(false);
    }
  };

  const claimDaily = async () => {
    setSaving(true);
    setNotice("");
    try {
      const result = await claimDailyCheckIn();
      await loadProfile();
      setNotice(result.already_claimed ? "Daily check-in already claimed." : `Claimed ${result.awarded + result.bonus_awarded} Campus Credits.`);
    } catch (err) {
      setError(err.message || "Unable to claim reward.");
    } finally {
      setSaving(false);
    }
  };

  const submitProject = async (event) => {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    try {
      const payload = {
        title: projectDraft.title,
        description: projectDraft.description,
        project_url: projectDraft.project_url,
        image_url: projectDraft.image_url || null,
        tags: splitTags(projectDraft.tags),
        is_public: Boolean(projectDraft.is_public),
      };
      if (editingProjectId) {
        await updateMyProject(editingProjectId, payload);
      } else {
        await createMyProject(payload);
      }
      setProjectDraft(EMPTY_PROJECT);
      setEditingProjectId(null);
      await loadProfile();
      setNotice("Build Drop saved.");
    } catch (err) {
      setError(err.message || "Unable to save project.");
    } finally {
      setSaving(false);
    }
  };

  const editProject = (project) => {
    setEditingProjectId(project.id);
    setProjectDraft({
      title: project.title || "",
      description: project.description || "",
      project_url: project.project_url || "",
      image_url: project.image_url || "",
      tags: (project.tags || []).join(", "),
      is_public: Boolean(project.is_public),
    });
  };

  const removeProject = async (projectId) => {
    setSaving(true);
    setNotice("");
    try {
      await deleteMyProject(projectId);
      await loadProfile();
      setNotice("Build Drop removed.");
    } catch (err) {
      setError(err.message || "Unable to remove project.");
    } finally {
      setSaving(false);
    }
  };

  const claimTrackCertificate = async (trackId) => {
    setSaving(true);
    setNotice("");
    try {
      await claimCertificate(trackId);
      await loadProfile();
      setNotice("Certificate claimed.");
    } catch (err) {
      setError(err.message || "Unable to claim certificate.");
    } finally {
      setSaving(false);
    }
  };

  const submitAccountRequest = async (event) => {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    try {
      await createAccountChangeRequest({
        request_type: accountRequest.request_type,
        requested_email: accountRequest.request_type === "email_change" ? accountRequest.requested_email : null,
        requested_provider: accountRequest.request_type === "provider_change" ? accountRequest.requested_provider : null,
        note: accountRequest.note,
      });
      setAccountRequest({ request_type: "email_change", requested_email: "", requested_provider: "github", note: "" });
      setNotice("Account change request submitted.");
    } catch (err) {
      setError(err.message || "Unable to submit account request.");
    } finally {
      setSaving(false);
    }
  };

  const revokeSessions = async () => {
    setSaving(true);
    try {
      await revokeMySessions();
      clearAuthSession();
      window.location.assign(APP_ROUTES.home);
    } catch (err) {
      setError(err.message || "Unable to revoke sessions.");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="profilePage profilePage--state">
        <Loader2 size={28} className="profilePage__spin" />
        Loading Campus Passport...
      </main>
    );
  }

  if (error && !profileData) {
    return <main className="profilePage profilePage--state">{error}</main>;
  }

  return (
    <main className="profilePage">
      <section className="profileHero">
        <div className="profileHero__identity">
          <AvatarImage
            src={profile.active_avatar_url || account.avatar}
            fallbackKey={account.username}
            alt=""
          />
          <div>
            <span className="profileHero__eyebrow"><Sparkles size={16} /> Campus Passport</span>
            <h1>{profile.display_name || account.username}</h1>
            <p>@{account.username}</p>
            {profile.headline && <strong>{profile.headline}</strong>}
          </div>
        </div>

        <div className="profileHero__meta">
          {profile.location_text && <span><MapPin size={15} /> {profile.location_text}</span>}
          <span><Users size={15} /> {formatNumber(metrics.connections_count)} Connected</span>
          <span><Flame size={15} /> {formatNumber(metrics.current_streak)} Streak</span>
          <Link to={publicProfilePath}>
            Public Profile <ChevronRight size={15} />
          </Link>
        </div>
      </section>

      <nav className="profileTabs" aria-label="Profile sections">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              className={activeTab === tab.key ? "is-active" : ""}
              onClick={() => openTab(tab.key)}
            >
              <Icon size={17} />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {(notice || error) && (
        <div className={`profileNotice ${error ? "is-error" : ""}`}>
          {error || notice}
          <button type="button" onClick={() => { setNotice(""); setError(""); }} aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      )}

      {activeTab === "passport" && (
        <section className="profileGrid">
          <article className="profilePanel profilePanel--wide profilePassport">
            <div>
              <h2>404 Pulse</h2>
              <p>{formatNumber(metrics.total_xp)} XP across {formatNumber(metrics.completed_exercises)} completed exercises.</p>
            </div>
            <ActivityGrid days={activity} />
          </article>

          <article className="profileStat">
            <img src={ASSETS.icons.xpStar} alt="" />
            <span>Total XP</span>
            <strong>{formatNumber(metrics.total_xp)}</strong>
          </article>
          <article className="profileStat">
            <CircleDollarSign size={24} />
            <span>Campus Credits</span>
            <strong>{formatNumber(rewards.balance)}</strong>
          </article>
          <article className="profileStat">
            <Trophy size={24} />
            <span>Global Rank</span>
            <strong>{metrics.global_rank ? `#${formatNumber(metrics.global_rank)}` : "Unranked"}</strong>
          </article>
          <article className="profileStat">
            <Medal size={24} />
            <span>Proof Shelf</span>
            <strong>{formatNumber(metrics.badges_count + metrics.certificates_count)}</strong>
          </article>

          <article className="profilePanel">
            <h2>Proof Shelf</h2>
            <BadgeShelf badges={badges} certificates={certificates.claimed || []} />
          </article>

          <article className="profilePanel">
            <h2>Build Drops</h2>
            {projects.filter((project) => project.is_public).length ? (
              <div className="profileProjectList">
                {projects.filter((project) => project.is_public).slice(0, 3).map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            ) : (
              <p className="profileEmptyText">Pin your best work from the Showcase tab.</p>
            )}
          </article>

          <article className="profilePanel profilePanel--wide profileLinks">
            <h2>Profile Links</h2>
            {heroLinks.length ? heroLinks.map((item) => {
              const Icon = item.icon;
              return (
                <a key={item.href} href={item.href} target="_blank" rel="noreferrer">
                  <Icon size={17} />
                  {item.label}
                  <ExternalLink size={14} />
                </a>
              );
            }) : <p className="profileEmptyText">Add links in Edit Profile.</p>}
          </article>
        </section>
      )}

      {activeTab === "edit" && (
        <form className="profileEditGrid" onSubmit={saveProfile}>
          <section className="profilePanel profilePanel--wide">
            <div className="profileSectionHead">
              <div>
                <h2>Avatar Studio</h2>
                <p>Choose a Campus404 avatar or switch back to your OAuth avatar.</p>
              </div>
              <button type="submit" className="btn btn-brand" disabled={saving}>
                {saving ? <Loader2 size={16} className="profilePage__spin" /> : <Save size={16} />}
                Save
              </button>
            </div>
            <div className="avatarStudio">
              {draft.provider_avatar_url && (
                <button
                  type="button"
                  className={draft.avatar_source === "provider" ? "is-active" : ""}
                  onClick={() => setDraft((current) => ({ ...current, avatar_source: "provider" }))}
                >
                  <AvatarImage src={draft.provider_avatar_url} fallbackKey="provider" alt="" />
                  <span>Google/GitHub</span>
                </button>
              )}
              {AVATAR_OPTIONS.map((avatar) => (
                <button
                  key={avatar.id}
                  type="button"
                  className={draft.avatar_source !== "provider" && draft.selected_avatar_url === avatar.src ? "is-active" : ""}
                  onClick={() => setDraft((current) => ({
                    ...current,
                    avatar_source: "selected",
                    selected_avatar_url: avatar.src,
                  }))}
                >
                  <img src={avatar.src} alt="" />
                  <span>Campus</span>
                </button>
              ))}
            </div>
          </section>

          <section className="profilePanel profileFormPanel">
            <h2>Identity</h2>
            <label>Display name<input value={draft.display_name || ""} onChange={(event) => setDraft((current) => ({ ...current, display_name: event.target.value }))} /></label>
            <label>Headline<input value={draft.headline || ""} onChange={(event) => setDraft((current) => ({ ...current, headline: event.target.value }))} /></label>
            <label>Bio<textarea value={draft.bio || ""} rows={5} onChange={(event) => setDraft((current) => ({ ...current, bio: event.target.value }))} /></label>
            <label>Location<input value={draft.location_text || ""} onChange={(event) => setDraft((current) => ({ ...current, location_text: event.target.value }))} /></label>
          </section>

          <section className="profilePanel profileFormPanel">
            <h2>Links</h2>
            <label>Website<input value={draft.website_url || ""} onChange={(event) => setDraft((current) => ({ ...current, website_url: event.target.value }))} /></label>
            <label>GitHub<input value={draft.github_url || ""} onChange={(event) => setDraft((current) => ({ ...current, github_url: event.target.value }))} /></label>
            <label>LinkedIn<input value={draft.linkedin_url || ""} onChange={(event) => setDraft((current) => ({ ...current, linkedin_url: event.target.value }))} /></label>
            <label>Portfolio<input value={draft.portfolio_url || ""} onChange={(event) => setDraft((current) => ({ ...current, portfolio_url: event.target.value }))} /></label>
          </section>

          <section className="profilePanel profilePanel--wide profileToggleGrid">
            <h2>Public Showcase</h2>
            {[
              ["is_public", "Public Campus Passport"],
              ["show_badges", "Proof Shelf"],
              ["show_certificates", "Certificates"],
              ["show_activity", "404 Pulse"],
              ["show_projects", "Build Drops"],
              ["show_rank", "Rank"],
              ["show_connections", "Connected count"],
            ].map(([key, label]) => (
              <label key={key} className="profileSwitch">
                <input
                  type="checkbox"
                  checked={Boolean(draft[key])}
                  onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.checked }))}
                />
                <span>{label}</span>
              </label>
            ))}
          </section>
        </form>
      )}

      {activeTab === "rewards" && (
        <section className="profileGrid">
          <article className="profilePanel profilePanel--wide rewardsHero">
            <div>
              <span><WalletCards size={18} /> Campus Credits</span>
              <h2>{formatNumber(rewards.balance)} Credits</h2>
              <p>Credits are earned from daily visits, verified task completions, and streak milestones.</p>
            </div>
            <button className="btn btn-brand" type="button" onClick={claimDaily} disabled={saving || rewards.daily_check_in_claimed}>
              {rewards.daily_check_in_claimed ? <Check size={16} /> : <CalendarCheck2 size={16} />}
              {rewards.daily_check_in_claimed ? "Claimed Today" : "Daily Check-In"}
            </button>
          </article>

          <article className="profilePanel rewardRule">
            <CalendarCheck2 size={24} />
            <strong>+10</strong>
            <span>Daily visit</span>
          </article>
          <article className="profilePanel rewardRule">
            <ClipboardCheck size={24} />
            <strong>+5</strong>
            <span>Verified completion</span>
          </article>
          <article className="profilePanel rewardRule">
            <Flame size={24} />
            <strong>+25</strong>
            <span>Every 7-day streak</span>
          </article>

          <article className="profilePanel profilePanel--wide">
            <div className="profileSectionHead">
              <div>
                <h2>Campus Store</h2>
                <p>Store redemption opens in v2. Your Credits are already being tracked.</p>
              </div>
              <Link className="btn btn-ghost" to={APP_ROUTES.frontendStore}>
                Preview Store <ChevronRight size={15} />
              </Link>
            </div>
          </article>

          <article className="profilePanel profilePanel--wide">
            <h2>Credit Ledger</h2>
            <ol className="creditLedger">
              {(rewards.recent_ledger || []).map((item) => (
                <li key={item.id}>
                  <CircleDollarSign size={17} />
                  <span>
                    <strong>{item.reason}</strong>
                    <small>{formatDate(item.created_at)}</small>
                  </span>
                  <b>{item.amount > 0 ? "+" : ""}{formatNumber(item.amount)}</b>
                </li>
              ))}
              {!(rewards.recent_ledger || []).length && <li className="creditLedger__empty">No Credits yet.</li>}
            </ol>
          </article>
        </section>
      )}

      {activeTab === "showcase" && (
        <section className="profileGrid">
          <article className="profilePanel profilePanel--wide">
            <div className="profileSectionHead">
              <div>
                <h2>Build Drops</h2>
                <p>Pin up to 6 projects on your public Campus Passport.</p>
              </div>
              {editingProjectId && (
                <button type="button" className="btn btn-ghost" onClick={() => { setEditingProjectId(null); setProjectDraft(EMPTY_PROJECT); }}>
                  <RefreshCw size={15} />
                  New
                </button>
              )}
            </div>
            <form className="projectForm" onSubmit={submitProject}>
              <input placeholder="Project title" value={projectDraft.title} onChange={(event) => setProjectDraft((current) => ({ ...current, title: event.target.value }))} required />
              <input placeholder="Project URL" value={projectDraft.project_url} onChange={(event) => setProjectDraft((current) => ({ ...current, project_url: event.target.value }))} required />
              <input placeholder="Image URL" value={projectDraft.image_url} onChange={(event) => setProjectDraft((current) => ({ ...current, image_url: event.target.value }))} />
              <input placeholder="Tags: React, Python" value={projectDraft.tags} onChange={(event) => setProjectDraft((current) => ({ ...current, tags: event.target.value }))} />
              <textarea placeholder="Short description" value={projectDraft.description} rows={3} onChange={(event) => setProjectDraft((current) => ({ ...current, description: event.target.value }))} />
              <label className="profileSwitch">
                <input type="checkbox" checked={projectDraft.is_public} onChange={(event) => setProjectDraft((current) => ({ ...current, is_public: event.target.checked }))} />
                <span>Public Build Drop</span>
              </label>
              <button className="btn btn-brand" type="submit" disabled={saving}>
                <Plus size={16} />
                {editingProjectId ? "Update Build Drop" : "Add Build Drop"}
              </button>
            </form>
          </article>

          <article className="profilePanel">
            <h2>Your Build Drops</h2>
            <div className="profileProjectList">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} editable onEdit={editProject} onDelete={removeProject} />
              ))}
              {!projects.length && <p className="profileEmptyText">No projects pinned yet.</p>}
            </div>
          </article>

          <article className="profilePanel">
            <h2>Certificates</h2>
            <div className="certificateList">
              {(certificates.claimed || []).map((certificate) => (
                <div key={certificate.id}>
                  <FileBadge2 size={20} />
                  <span>
                    <strong>{certificate.title}</strong>
                    <small>{certificate.certificate_code}</small>
                  </span>
                </div>
              ))}
              {(certificates.eligible_tracks || []).filter((track) => !track.claimed).map((track) => (
                <button key={track.track_id} type="button" onClick={() => claimTrackCertificate(track.track_id)} disabled={saving}>
                  <BadgeCheck size={18} />
                  Claim {track.title}
                </button>
              ))}
              {!(certificates.claimed || []).length && !(certificates.eligible_tracks || []).some((track) => !track.claimed) && (
                <p className="profileEmptyText">Complete a full track to unlock certificates.</p>
              )}
            </div>
          </article>
        </section>
      )}

      {activeTab === "account" && (
        <section className="profileGrid">
          <article className="profilePanel profileAccountCard">
            <h2>Account</h2>
            <dl>
              <div><dt>Email</dt><dd>{account.email}</dd></div>
              <div><dt>Provider</dt><dd>{account.auth_provider}</dd></div>
              <div><dt>Joined</dt><dd>{formatDate(account.created_at)}</dd></div>
            </dl>
          </article>

          <article className="profilePanel">
            <h2>Change Request</h2>
            <form className="accountRequestForm" onSubmit={submitAccountRequest}>
              <select value={accountRequest.request_type} onChange={(event) => setAccountRequest((current) => ({ ...current, request_type: event.target.value }))}>
                <option value="email_change">Change login email</option>
                <option value="provider_change">Change OAuth provider</option>
              </select>
              {accountRequest.request_type === "email_change" ? (
                <input type="email" placeholder="new@email.com" value={accountRequest.requested_email} onChange={(event) => setAccountRequest((current) => ({ ...current, requested_email: event.target.value }))} />
              ) : (
                <select value={accountRequest.requested_provider} onChange={(event) => setAccountRequest((current) => ({ ...current, requested_provider: event.target.value }))}>
                  <option value="github">GitHub</option>
                  <option value="google">Google</option>
                </select>
              )}
              <textarea placeholder="Optional note" rows={3} value={accountRequest.note} onChange={(event) => setAccountRequest((current) => ({ ...current, note: event.target.value }))} />
              <button className="btn btn-brand" type="submit" disabled={saving}>
                <ShieldCheck size={16} />
                Submit Request
              </button>
            </form>
          </article>

          <article className="profilePanel profilePanel--wide">
            <div className="profileSectionHead">
              <div>
                <h2>Active Sessions</h2>
                <p>Review recent browser sessions connected to this account.</p>
              </div>
              <button type="button" className="btn btn-ghost" onClick={revokeSessions} disabled={saving}>
                <LockKeyhole size={16} />
                Revoke All
              </button>
            </div>
            <div className="sessionList">
              {sessions.map((session) => (
                <article key={session.id}>
                  <UserRound size={18} />
                  <span>
                    <strong>{session.logout_time ? "Signed out" : "Active session"}</strong>
                    <small>{formatDate(session.login_time)} {session.ip_address ? `- ${session.ip_address}` : ""}</small>
                  </span>
                </article>
              ))}
              {!sessions.length && <p className="profileEmptyText">No session history yet.</p>}
            </div>
          </article>
        </section>
      )}
    </main>
  );
}
