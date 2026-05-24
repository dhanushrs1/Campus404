import { Link } from "react-router-dom";
import { ArrowLeft, CalendarClock, Gift, Sparkles, Trophy } from "lucide-react";
import { APP_ROUTES } from "../../../routes/paths.js";
import { ASSETS } from "../../../shared/assets.js";
import "./RankingRewardsPage.css";

export default function RankingRewardsPage() {
  return (
    <main className="rankingRewardsPage">
      <section className="rankingRewardsPage__hero">
        <div>
          <Link to={APP_ROUTES.frontendLeaderboard({ scope: "global" })} className="rankingRewardsPage__back">
            <ArrowLeft size={16} />
            Back to Leaderboard
          </Link>
          <span className="rankingRewardsPage__eyebrow"><Gift size={17} /> Ranking Rewards</span>
          <h1>Season rewards are coming soon.</h1>
          <p>Campus404 ranking rewards will unlock prizes for consistent learners, track champions, and challenge winners.</p>
        </div>

        <div className="rankingRewardsPage__art" aria-hidden="true">
          <img className="rankingRewardsPage__cloud" src={ASSETS.decorations.pixelCloud} alt="" />
          <img className="rankingRewardsPage__trophy" src={ASSETS.icons.trophyCup} alt="" />
          <img className="rankingRewardsPage__certificate" src={ASSETS.rewards.certificateTrophy} alt="" />
        </div>
      </section>

      <section className="rankingRewardsPage__grid" aria-label="Upcoming reward tracks">
        <article>
          <Trophy size={22} />
          <h2>Global Champions</h2>
          <p>Rewards for learners who stay near the top of the all-time and weekly global rankings.</p>
        </article>
        <article>
          <Sparkles size={22} />
          <h2>Track Masters</h2>
          <p>Track-specific rewards for deep progress in Python, frontend, projects, and future courses.</p>
        </article>
        <article>
          <CalendarClock size={22} />
          <h2>Season Events</h2>
          <p>Timed reward seasons will arrive after challenge rooms and event leaderboards are ready.</p>
        </article>
      </section>
    </main>
  );
}
