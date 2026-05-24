import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Code2,
  Gift,
  Globe2,
  Heart,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Trophy,
  Users,
} from "lucide-react";
import { APP_ROUTES } from "../../../routes/paths.js";
import { ASSETS } from "../../../shared/assets.js";
import { getLeaderboard, getTrackTree } from "../../../shared/learningApi.js";
import AvatarImage from "../../components/AvatarImage/AvatarImage.jsx";
import "./LeaderboardPage.css";

const RANGE_OPTIONS = [
  { value: "all_time", label: "All Time" },
  { value: "weekly", label: "This Week" },
  { value: "monthly", label: "This Month" },
];

const AVATAR_POOL = Object.values(ASSETS.avatars);

function slugify(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^\w ]+/g, "")
    .replace(/ +/g, "-");
}

function compactNumber(value) {
  const number = Number(value) || 0;
  if (number === 0) return "0";
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: number >= 100000 ? 1 : 0,
  }).format(number);
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(Number(value) || 0);
}

function formatRankDisplay(rank) {
  const number = Number(rank);
  if (!number) return "#--";
  return `#${number >= 100000 ? compactNumber(number) : formatNumber(number)}`;
}

function formatRankLabel(rank) {
  const number = Number(rank);
  if (!number) return "Rank unavailable";
  return `Rank #${formatNumber(number)}`;
}

function readPageSize(value) {
  const size = Number(value);
  return size === 25 || size === 50 ? size : null;
}

function rankTone(rank) {
  if (rank === 1) return "gold";
  if (rank === 2) return "silver";
  if (rank === 3) return "bronze";
  return "default";
}

function rankMedal(rank) {
  if (rank === 1) return ASSETS.icons.rankMedalGold;
  if (rank === 2) return ASSETS.icons.rankMedalSilver;
  if (rank === 3) return ASSETS.icons.rankMedalBronze;
  return "";
}

function trackOptionValue(track) {
  if (!track) return "";
  return track.slug || String(track.id || "");
}

function learnerXp(learner) {
  return Number(learner?.track_xp ?? learner?.total_xp ?? 0);
}

function learnerAvatar(learner) {
  if (learner?.avatar_url) return learner.avatar_url;
  const index = Math.abs(Number(learner?.user_id) || 0) % AVATAR_POOL.length;
  return AVATAR_POOL[index] || ASSETS.avatars.curlyBlackBlueHoodie;
}

function learnerName(learner) {
  return learner?.display_name || learner?.username || "Campus Learner";
}

function visiblePageNumbers(page, totalPages) {
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  return [...pages].filter((item) => item >= 1 && item <= totalPages).sort((a, b) => a - b);
}

function openAuthModal() {
  window.dispatchEvent(
    new CustomEvent("campus404:open-auth-modal", {
      detail: {
        returnTo: `${window.location.pathname}${window.location.search}${window.location.hash}`,
      },
    }),
  );
}

function PodiumCard({ learner, place }) {
  const medal = rankMedal(place);

  return (
    <article className={`lbPodiumCard lbPodiumCard--${rankTone(place)} ${place === 1 ? "is-champion" : ""}`}>
      {medal ? (
        <img className="lbPodiumCard__medal" src={medal} alt="" draggable="false" decoding="async" />
      ) : (
        <span className="lbPodiumCard__rank">{place}</span>
      )}
      {learner ? (
        <>
          <span className="lbPodiumCard__avatar">
            <AvatarImage
              src={learnerAvatar(learner)}
              fallbackKey={learner?.user_id || learner?.username}
              alt=""
              draggable="false"
              decoding="async"
            />
          </span>
          <strong>{learnerName(learner)}</strong>
          <small>@{learner.username || "learner"}</small>
          <b>{formatNumber(learnerXp(learner))} XP</b>
        </>
      ) : (
        <>
          <span className="lbPodiumCard__avatar is-empty">
            <Users size={24} />
          </span>
          <strong>Waiting for learner</strong>
          <small>@campus404</small>
          <b>0 XP</b>
        </>
      )}
    </article>
  );
}

function TableRank({ rank }) {
  const medal = rankMedal(rank);
  if (medal) {
    return <img className="lbTableRankMedal" src={medal} alt={`${rank} place`} draggable="false" decoding="async" />;
  }
  return <span className="lbTableRankNumber">{rank}</span>;
}

export default function LeaderboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const scope = searchParams.get("scope") === "track" ? "track" : "global";
  const trackQuery = searchParams.get("track") || "";
  const requestedTimeRange = RANGE_OPTIONS.some((item) => item.value === searchParams.get("time_range"))
    ? searchParams.get("time_range")
    : "";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const requestedPageSize = readPageSize(searchParams.get("page_size"));

  const [tracks, setTracks] = useState([]);
  const [leaderboard, setLeaderboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const needsTrackSelection = scope === "track" && !trackQuery;

  function updateQuery(next) {
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      Object.entries(next).forEach(([key, value]) => {
        if (value === "" || value === null || value === undefined) {
          params.delete(key);
        } else {
          params.set(key, String(value));
        }
      });
      if (!params.get("scope")) params.set("scope", "global");
      params.delete("search");
      params.delete("sort");
      return params;
    }, { preventScrollReset: true });
  }

  useEffect(() => {
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      const hadPublicOnlyParams = params.has("search") || params.has("sort");
      params.delete("search");
      params.delete("sort");
      return hadPublicOnlyParams ? params : current;
    }, { replace: true, preventScrollReset: true });
  }, [setSearchParams]);

  useEffect(() => {
    let disposed = false;

    getTrackTree()
      .then((payload) => {
        if (!disposed) setTracks(Array.isArray(payload) ? payload : []);
      })
      .catch(() => {
        if (!disposed) setTracks([]);
      });

    return () => {
      disposed = true;
    };
  }, []);

  const selectedTrack = useMemo(() => {
    if (!trackQuery) return null;
    return tracks.find((track) => {
      const slug = track.slug || slugify(track.title);
      return String(track.id) === trackQuery || slug === trackQuery;
    }) || null;
  }, [trackQuery, tracks]);

  const trackOptions = useMemo(
    () => [...tracks].sort((a, b) => (
      Number(a.order || 0) - Number(b.order || 0)
      || String(a.title || "").localeCompare(String(b.title || ""))
    )),
    [tracks],
  );

  useEffect(() => {
    if (scope !== "track" || trackQuery || !trackOptions.length) return;
    updateQuery({ scope: "track", track: trackOptionValue(trackOptions[0]), time_range: "", page: 1 });
  }, [scope, trackOptions, trackQuery]);

  useEffect(() => {
    let disposed = false;
    setLoading(true);
    setError("");
    if (needsTrackSelection) {
      setLeaderboard(null);
      setLoading(false);
      return () => {
        disposed = true;
      };
    }

    getLeaderboard({
      scope,
      track: scope === "track" ? trackQuery : "",
      timeRange: scope === "global" ? requestedTimeRange : "",
      page,
      pageSize: requestedPageSize,
    })
      .then((payload) => {
        if (!disposed) setLeaderboard(payload);
      })
      .catch((err) => {
        if (!disposed) setError(err.message || "Unable to load leaderboard.");
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });

    return () => {
      disposed = true;
    };
  }, [needsTrackSelection, page, requestedPageSize, requestedTimeRange, scope, trackQuery]);

  const entries = Array.isArray(leaderboard?.entries) ? leaderboard.entries : [];
  const disabled = leaderboard && leaderboard.enabled === false;
  const resolvedTimeRange = requestedTimeRange || leaderboard?.time_range || "all_time";
  const pageSize = requestedPageSize || leaderboard?.page_size || 25;
  const totalLearners = Number(leaderboard?.total || 0);
  const totalPages = Math.max(1, Math.ceil(totalLearners / pageSize));
  const pageNumbers = visiblePageNumbers(page, totalPages);
  const topByRank = [1, 2, 3].map((rank) => entries.find((learner) => Number(learner.rank) === rank) || entries[rank - 1]);
  const podiumLearners = [topByRank[1], topByRank[0], topByRank[2]];
  const currentRank = leaderboard?.current_user_rank;
  const spotlight = entries.find((learner) => Number(learner.rank) > 3) || entries[0];
  const title = scope === "track"
    ? (leaderboard?.track?.title || selectedTrack?.title || "Track Leaderboard")
    : "Global Leaderboard";
  const heroTitle = scope === "track" ? title : "Compete. Learn. Level Up.";
  const heroDescription = scope === "track"
    ? "Climb this track leaderboard by earning XP, completing exercises, and building steady progress lesson by lesson."
    : "Climb the ranks, earn XP, and build consistency. Every step forward makes you better.";
  const hasAccurateTotals = Boolean(leaderboard && !disabled && !error && !needsTrackSelection);
  const badgesTotal = Number(leaderboard?.badges_total);
  const heroLearners = hasAccurateTotals ? formatNumber(totalLearners) : "--";
  const heroXp = hasAccurateTotals ? formatNumber(leaderboard?.xp_total || 0) : "--";
  const heroBadges = hasAccurateTotals && Number.isFinite(badgesTotal) ? formatNumber(badgesTotal) : "--";
  const showingStart = entries.length ? ((page - 1) * pageSize) + 1 : 0;
  const showingEnd = entries.length ? showingStart + entries.length - 1 : 0;
  const rangeIndex = Math.max(0, RANGE_OPTIONS.findIndex((range) => range.value === resolvedTimeRange));
  const hasPreviousPage = page > 1;
  const hasNextPage = Boolean(leaderboard?.has_more);
  const showPageNumbers = totalPages > 1;
  const showPagerControls = hasPreviousPage || hasNextPage || showPageNumbers;

  const handleScopeClick = (nextScope) => {
    if (nextScope === "global") {
      updateQuery({ scope: "global", track: "", page: 1 });
      return;
    }
    updateQuery({
      scope: "track",
      track: selectedTrack ? trackQuery : trackOptionValue(trackOptions[0]),
      time_range: "",
      page: 1,
    });
  };

  const handleTrackChange = (value) => {
    updateQuery({ scope: "track", track: value, time_range: "", page: 1 });
  };

  return (
    <div className="leaderboardPage">
      <section className="lbHeroBand" aria-labelledby="leaderboard-title">
        <div className="lbHero">
          <div className="lbHero__copy">
            <span className="lbEyebrow"><Trophy size={18} /> Leaderboard</span>
            <h1 id="leaderboard-title">{heroTitle}</h1>
            <p>{heroDescription}</p>
            <div className="lbHero__stats" aria-label="Leaderboard stats">
              <span>
                <Users className="lbHero__statIcon" size={30} aria-hidden="true" />
                <b>{heroLearners}</b>
                Learners
              </span>
              <span>
                <img src={ASSETS.icons.xpStar} alt="" draggable="false" />
                <b>{heroXp}</b>
                XP earned
              </span>
              <span>
                <img src={ASSETS.icons.leaderboardPodiumTrophy} alt="" draggable="false" />
                <b>{heroBadges}</b>
                Badges earned
              </span>
            </div>
          </div>
          <div className="lbHero__art" aria-hidden="true">
            <img
              src={ASSETS.icons.leaderboardHeroPodium}
              alt=""
              draggable="false"
              decoding="async"
              fetchPriority="high"
            />
          </div>
        </div>
      </section>

      <main className="leaderboardPage__shell">
        <section className="lbFilters" aria-label="Leaderboard filters">
          <div
            className="lbSegments"
            role="group"
            aria-label="Leaderboard scope"
            data-active-index={scope === "global" ? "0" : "1"}
          >
            <button type="button" className={scope === "global" ? "is-active" : ""} onClick={() => handleScopeClick("global")}>
              <Globe2 size={16} /> Global
            </button>
            <button type="button" className={scope === "track" ? "is-active" : ""} onClick={() => handleScopeClick("track")}>
              <Code2 size={16} /> Track
            </button>
          </div>

          {scope === "global" && (
            <div
              className="lbRangeTabs"
              role="group"
              aria-label="Leaderboard range"
              data-active-index={String(rangeIndex)}
            >
              {RANGE_OPTIONS.map((range) => (
                <button
                  key={range.value}
                  type="button"
                  className={resolvedTimeRange === range.value ? "is-active" : ""}
                  onClick={() => updateQuery({ time_range: range.value, page: 1 })}
                >
                  {range.label}
                </button>
              ))}
            </div>
          )}

          {scope === "track" && (
            <label className="lbTrackPicker">
              <span>Track</span>
              <select
                value={trackQuery}
                onChange={(event) => handleTrackChange(event.target.value)}
                aria-label="Track filter"
                disabled={!trackOptions.length}
              >
                <option value="">{trackOptions.length ? "Auto select track" : "No tracks available"}</option>
                {trackOptions.map((track) => {
                  const value = trackOptionValue(track);
                  return <option value={value} key={track.id}>{track.title}</option>;
                })}
              </select>
            </label>
          )}
        </section>

        <section className="lbPodium" aria-label="Top ranked learners">
          {podiumLearners.map((learner, index) => {
            const place = [2, 1, 3][index];
            return <PodiumCard learner={learner} place={place} key={place} />;
          })}
        </section>

        <section className="lbYourRank">
          <div className="lbYourRank__identity">
          <span className="lbYourRank__avatar">
            {currentRank ? (
              <AvatarImage
                src={learnerAvatar(currentRank)}
                fallbackKey={currentRank?.user_id || currentRank?.username}
                alt=""
                draggable="false"
              />
            ) : <ShieldCheck size={30} />}
          </span>
            <div className="lbYourRank__rank">
              <span>Your Rank</span>
              <strong title={formatRankLabel(currentRank?.rank)} aria-label={formatRankLabel(currentRank?.rank)}>
                {formatRankDisplay(currentRank?.rank)}
              </strong>
            </div>
          </div>
          <dl className="lbYourRank__metric">
            <div>
              <dt>XP Earned</dt>
              <dd><img src={ASSETS.icons.xpStar} alt="" /> {formatNumber(learnerXp(currentRank))} XP</dd>
            </div>
          </dl>
          <div className="lbYourRank__cta">
            <strong>Great progress!</strong>
            <span>Keep climbing the ranks.</span>
            {currentRank ? (
              <Link className="btn btn-brand lbYourRank__button" to={APP_ROUTES.frontendProfile}>
                View Profile <ArrowRight size={15} />
              </Link>
            ) : (
              <button className="btn btn-brand lbYourRank__button" type="button" onClick={openAuthModal}>
                Sign In <ArrowRight size={15} />
              </button>
            )}
          </div>
          <div className="lbYourRank__art" aria-hidden="true">
            <img className="lbYourRank__flag" src={ASSETS.icons.leaderboardSummitFlag} alt="" draggable="false" decoding="async" />
          </div>
        </section>

        <div className="lbContentGrid">
          <section className="lbTableCard" aria-label={`${title} rankings`}>
            {loading ? (
              <div className="lbState">
                <img src={ASSETS.icons.trophyCup} alt="" />
                <p>Loading leaderboard...</p>
              </div>
            ) : error ? (
              <div className="lbState">
                <Trophy size={30} />
                <p>{error}</p>
              </div>
            ) : needsTrackSelection ? (
              <div className="lbState">
                <Target size={30} />
                <h2>Select a track</h2>
                <p>Choose a track to view course-only rankings.</p>
              </div>
            ) : disabled ? (
              <div className="lbState">
                <img src={ASSETS.icons.trophyCup} alt="" />
                <h2>Leaderboard disabled</h2>
                <p>{leaderboard.disabled_reason || "This leaderboard is not currently available."}</p>
              </div>
            ) : entries.length ? (
              <>
                <div className="lbTableWrap">
                  <table className="lbTable">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Learner</th>
                        <th>Total XP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((learner) => (
                        <tr key={learner.user_id} className={currentRank?.user_id === learner.user_id ? "is-current" : ""}>
                          <td><TableRank rank={Number(learner.rank)} /></td>
                          <td>
                            <span className="lbLearnerCell">
                              <AvatarImage
                                src={learnerAvatar(learner)}
                                fallbackKey={learner?.user_id || learner?.username}
                                alt=""
                                draggable="false"
                                decoding="async"
                              />
                              <span>
                                <strong>{currentRank?.user_id === learner.user_id ? "You" : learnerName(learner)}</strong>
                                <small>@{learner.username || "learner"}</small>
                              </span>
                            </span>
                          </td>
                          <td>
                            <b className="lbXpText">
                              <img src={ASSETS.icons.xpStar} alt="" />
                              {formatNumber(learnerXp(learner))} XP
                            </b>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <footer className="lbPager">
                  <span>Showing {showingStart}-{showingEnd} of {formatNumber(totalLearners || entries.length)} learners</span>
                  {showPagerControls && (
                    <div>
                      {hasPreviousPage && (
                        <button type="button" onClick={() => updateQuery({ page: page - 1 })} aria-label="Previous page">
                          <ChevronLeft size={17} />
                        </button>
                      )}
                      {showPageNumbers && pageNumbers.map((number, index) => (
                        <span key={number} className="lbPager__itemWrap">
                          {index > 0 && number - pageNumbers[index - 1] > 1 && <i>...</i>}
                          <button type="button" className={number === page ? "is-active" : ""} onClick={() => updateQuery({ page: number })}>
                            {number}
                          </button>
                        </span>
                      ))}
                      {hasNextPage && (
                        <button type="button" onClick={() => updateQuery({ page: page + 1 })} aria-label="Next page">
                          <ChevronRight size={17} />
                        </button>
                      )}
                    </div>
                  )}
                </footer>
              </>
            ) : (
              <div className="lbState">
                <Star size={30} />
                <h2>No rankings yet</h2>
                <p>XP activity will create this leaderboard automatically.</p>
              </div>
            )}
          </section>

          <aside className="lbSideRail">
            <section className="lbInfoCard">
              <h2><Sparkles size={17} /> How ranking works</h2>
              <ul>
                <li><img src={ASSETS.icons.xpStar} alt="" /> Earn XP by completing exercises and solving challenges.</li>
                <li><img src={ASSETS.icons.streakFire} alt="" /> Consistency matters - keep your streak alive.</li>
                <li><BarChart3 size={18} /> Rankings update in real time across all learners.</li>
                <li><Heart size={18} /> Be respectful and keep learning. That is our motto.</li>
              </ul>
            </section>

            <section className="lbRewardCard">
              <div>
                <h2><Gift size={17} /> Track Rewards</h2>
                <p>Top learners on each track earn exclusive rewards.</p>
                <Link className="btn btn-ghost lbRewardCard__button" to={APP_ROUTES.frontendRankingRewards}>
                  Explore Rewards <ArrowRight size={15} />
                </Link>
              </div>
              <img src={ASSETS.icons.leaderboardRewardChest} alt="" draggable="false" decoding="async" />
            </section>

            <section className="lbSpotlightCard">
              <h2><Sparkles size={17} /> Weekly Spotlight</h2>
              {spotlight ? (
                <div>
                  <AvatarImage
                    src={learnerAvatar(spotlight)}
                    fallbackKey={spotlight?.user_id || spotlight?.username}
                    alt=""
                    draggable="false"
                    decoding="async"
                  />
                  <span>
                    <strong>{learnerName(spotlight)}</strong>
                    <small>@{spotlight.username || "learner"}</small>
                    <b>+{formatNumber(learnerXp(spotlight))} XP this week</b>
                  </span>
                </div>
              ) : (
                <p>First spotlight opens after learners start earning XP.</p>
              )}
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
