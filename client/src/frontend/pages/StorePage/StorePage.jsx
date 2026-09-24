import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CircleDollarSign,
  Clock3,
  Droplet,
  Gift,
  Loader2,
  Shirt,
  Sparkles,
  Store,
} from "lucide-react";
import { APP_ROUTES } from "../../../routes/paths.js";
import { ASSETS } from "../../../shared/assets.js";
import { readAuthSession } from "../../../shared/authSession.js";
import { getMyRewards } from "../../../shared/profileApi.js";
import "./StorePage.css";

const STORE_ITEMS = [
  {
    title: "Campus404 Hoodie",
    credits: 2400,
    icon: Shirt,
    image: ASSETS.avatars.blueStreak404Hoodie,
  },
  {
    title: "404 Cap",
    credits: 1200,
    icon: Gift,
    image: ASSETS.avatars.capGlassesBlackHoodie,
  },
  {
    title: "Build Bottle",
    credits: 900,
    icon: Droplet,
    image: ASSETS.icons.xpStar,
  },
];

function formatNumber(value) {
  return new Intl.NumberFormat().format(Number(value) || 0);
}

export default function StorePage() {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const session = readAuthSession();
    if (!session.isAuthenticated) return;
    setLoading(true);
    getMyRewards()
      .then((payload) => setBalance(Number(payload.balance) || 0))
      .catch(() => setBalance(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="storePage">
      <section className="storeHero">
        <div>
          <span><Store size={18} /> Campus Store</span>
          <h1>Campus Credits will unlock real rewards.</h1>
          <p>Store redemption is planned for a future release. Until then, daily check-ins, task completions, and streaks keep adding Credits to your wallet.</p>
          <div className="storeHero__actions">
            <Link className="btn btn-brand" to={APP_ROUTES.frontendProfile}>
              View Wallet <ArrowRight size={15} />
            </Link>
            <Link className="btn btn-ghost" to={APP_ROUTES.frontendTracks}>
              Earn Credits
            </Link>
          </div>
        </div>
        <aside className="storeWallet">
          <img src={ASSETS.icons.leaderboardRewardChest} alt="" />
          <span>Campus Credits</span>
          <strong>
            {loading ? <Loader2 size={22} className="storePage__spin" /> : balance === null ? "Sign in" : formatNumber(balance)}
          </strong>
        </aside>
      </section>

      <section className="storeStatus">
        <article>
          <Clock3 size={22} />
          <h2>Coming Soon</h2>
          <p>Checkout, shipping details, and redemption review will arrive in a future milestone.</p>
        </article>
        <article>
          <CircleDollarSign size={22} />
          <h2>Credits Active</h2>
          <p>Your wallet already tracks Campus Credits from verified learning activity.</p>
        </article>
        <article>
          <Sparkles size={22} />
          <h2>Merch Preview</h2>
          <p>Hoodies, caps, bottles, and limited Campus404 drops will use this reward wallet.</p>
        </article>
      </section>

      <section className="storeItems" aria-label="Coming soon store items">
        {STORE_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.title}>
              <div className="storeItems__image">
                <img src={item.image} alt="" />
                <Icon size={24} />
              </div>
              <span>Coming Soon</span>
              <h2>{item.title}</h2>
              <strong>{formatNumber(item.credits)} Credits</strong>
            </article>
          );
        })}
      </section>
    </main>
  );
}
