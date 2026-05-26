import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Award,
  CalendarClock,
  CheckCircle2,
  Crown,
  Flame,
  Gift,
  Loader2,
  Lock,
  Medal,
  Sparkles,
  Star,
  Trophy,
} from "lucide-react";
import { APP_ROUTES } from "../../../routes/paths.js";
import { ASSETS } from "../../../shared/assets.js";
import { getGlobalLeaderboard, getMyProgress, getMyXpEvents } from "../../../shared/learningApi.js";
import "./RankingRewardsPage.css";

const REWARD_TIERS = [
  {
    title: "Weekly Spark",
    description: "Earn 75 XP in the last seven days to stay eligible for weekly recognition.",
    target: 75,
    metric: "weeklyXp",
    icon: Flame,
  },
  {
    title: "Badge Collector",
    description: "Collect 3 badges from lessons, streaks, and track milestones.",
    target: 3,
    metric: "badges",
    icon: Award,
  },
  {
    title: "Track Master",
    description: "Complete one full track to unlock track-master reward eligibility.",
    target: 1,
    metric: "completedTracks",
    icon: Medal,
  },
  {
    title: "Global Podium",
    description: "Reach the top 3 global leaderboard ranks for champion reward consideration.",
    target: 3,
    metric: "rank",
    icon: Crown,
  },
];

function formatNumber(value) {
  return new Intl.NumberFormat().format(Number(value) || 0);
}

function eventDate(value) {
  const date = new Date(value || "");
  return Number.isNaN(date.getTime()) ? null : date;
}

function rankProgress(rank, target) {
  if (!rank) return 0;
  if (rank <= target) return 100;
  return Math.max(8, Math.min(92, Math.round((target / rank) * 100)));
}

export default function RankingRewardsPage() {
  const [progress, setProgress] = useState(null);
  const [xpEvents, setXpEvents] = useState([]);
  const [allTimeRank, setAllTimeRank] = useState(null);
  const [weeklyRank, setWeeklyRank] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let disposed = false;

    async function loadRewards() {
      setLoading(true);
      const [progressResult, xpResult, allTimeResult, weeklyResult] = await Promise.allSettled([
        getMyProgress(),
        getMyXpEvents(40),
        getGlobalLeaderboard({ pageSize: 25 }),
        getGlobalLeaderboard({ timeRange: "weekly", pageSize: 25 }),
      ]);

      if (disposed) return;
      setProgress(progressResult.status === "fulfilled" ? progressResult.value : null);
      setXpEvents(xpResult.status === "fulfilled" ? xpResult.value || [] : []);
      setAllTimeRank(allTimeResult.status === "fulfilled" ? allTimeResult.value?.current_user_rank || null : null);
      setWeeklyRank(weeklyResult.status === "fulfilled" ? weeklyResult.value?.current_user_rank || null : null);
      setLoading(false);
    }

    loadRewards();
    return () => {
      disposed = true;
    };
  }, []);

  const rewardStats = useMemo(() => {
    const tracks = Array.isArray(progress?.tracks) ? progress.tracks : [];
    const badges = Array.isArray(progress?.badges) ? progress.badges : [];
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const weeklyXp = xpEvents.reduce((total, event) => {
      const createdAt = eventDate(event.created_at || event.awarded_at || event.timestamp);
      if (!createdAt || createdAt.getTime() < sevenDaysAgo) return total;
      return total + (Number(event.points) || 0);
    }, 0);

    return {
      totalXp: Number(progress?.total_xp) || 0,
      badges: badges.length,
      completedTracks: tracks.filter((track) => Number(track.progress_percent) >= 100).length,
      weeklyXp,
      allTimeRank: Number(allTimeRank?.rank) || null,
      weeklyRank: Number(weeklyRank?.rank) || null,
    };
  }, [allTimeRank, progress, weeklyRank, xpEvents]);

  const eligibility = REWARD_TIERS.map((tier) => {
    if (tier.metric === "rank") {
      const rank = rewardStats.allTimeRank;
      return {
        ...tier,
        current: rank || 0,
        label: rank ? `#${formatNumber(rank)} global` : "Unranked",
        unlocked: Boolean(rank && rank <= tier.target),
        percent: rankProgress(rank, tier.target),
      };
    }

    const current = Number(rewardStats[tier.metric]) || 0;
    return {
      ...tier,
      current,
      label: `${formatNumber(current)} / ${formatNumber(tier.target)}`,
      unlocked: current >= tier.target,
      percent: Math.min(100, Math.round((current / tier.target) * 100)),
    };
  });

  return (
    <main className="rankingRewardsPage">
      <section className="rankingRewardsPage__hero">
        <div className="rankingRewardsPage__copy">
          <Link to={APP_ROUTES.frontendLeaderboard({ scope: "global" })} className="rankingRewardsPage__back">
            <ArrowLeft size={16} />
            Back to Leaderboard
          </Link>
          <span className="rankingRewardsPage__eyebrow"><Gift size={17} /> Ranking Rewards</span>
          <h1>Turn leaderboard progress into rewards.</h1>
          <p>Track your rank, XP, badges, and weekly momentum. The reward board shows what you already qualify for and what to chase next.</p>
          <div className="rankingRewardsPage__heroActions">
            <Link className="btn btn-brand" to={APP_ROUTES.frontendTracks}>Earn More XP</Link>
            <Link className="btn btn-ghost" to={APP_ROUTES.frontendDashboard}>View Profile</Link>
          </div>
        </div>

        <div className="rankingRewardsPage__summary" aria-label="Your reward summary">
          {loading ? (
            <div className="rankingRewardsPage__loading">
              <Loader2 size={26} className="rankingRewardsPage__spin" />
              Loading rewards...
            </div>
          ) : (
            <>
              <div className="rankingRewardsPage__rankCard">
                <img src={ASSETS.icons.rankMedalGold} alt="" draggable="false" />
                <span>Global Rank</span>
                <strong>{rewardStats.allTimeRank ? `#${formatNumber(rewardStats.allTimeRank)}` : "Unranked"}</strong>
              </div>
              <div className="rankingRewardsPage__summaryGrid">
                <span><Star size={18} /> {formatNumber(rewardStats.totalXp)} XP</span>
                <span><Flame size={18} /> {formatNumber(rewardStats.weeklyXp)} weekly XP</span>
                <span><Award size={18} /> {formatNumber(rewardStats.badges)} badges</span>
                <span><Trophy size={18} /> {formatNumber(rewardStats.completedTracks)} tracks complete</span>
                <span><Medal size={18} /> {rewardStats.weeklyRank ? `#${formatNumber(rewardStats.weeklyRank)} weekly` : "Weekly unranked"}</span>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="rankingRewardsPage__tiers" aria-label="Reward eligibility">
        {eligibility.map((tier) => {
          const Icon = tier.icon;
          return (
            <article className={tier.unlocked ? "is-unlocked" : ""} key={tier.title}>
              <div className="rankingRewardsPage__tierIcon">
                {tier.unlocked ? <CheckCircle2 size={22} /> : <Icon size={22} />}
              </div>
              <div>
                <span>{tier.unlocked ? "Eligible" : "In progress"}</span>
                <h2>{tier.title}</h2>
                <p>{tier.description}</p>
              </div>
              <strong>{tier.label}</strong>
              <div className="rankingRewardsPage__bar" aria-hidden="true">
                <span style={{ width: `${tier.percent}%` }} />
              </div>
            </article>
          );
        })}
      </section>

      <section className="rankingRewardsPage__rules" aria-label="Reward rules">
        <article>
          <CalendarClock size={22} />
          <h2>Weekly Review</h2>
          <p>Weekly XP and leaderboard position decide short-term recognition. Stay active across the week to keep your profile visible.</p>
        </article>
        <article>
          <Sparkles size={22} />
          <h2>Badge Weight</h2>
          <p>Badges prove depth, not just speed. Complete lessons, quizzes, projects, and streak milestones to improve reward eligibility.</p>
        </article>
        <article>
          <Lock size={22} />
          <h2>Fair Play</h2>
          <p>Rewards are based on backend-verified XP, submissions, track progress, and badge events. Manual score changes do not count.</p>
        </article>
      </section>
    </main>
  );
}
