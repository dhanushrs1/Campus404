import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  AtSign,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";
import { APP_ROUTES } from "../../../routes/paths.js";
import { apiUrl } from "../../../shared/api.js";
import { ASSETS } from "../../../shared/assets.js";
import { consumeAuthReturnTo, saveAuthSession } from "../../../shared/authSession.js";
import "./OAuthCallbackPage.css";

const CAMPUS_AVATARS = [
  { id: "capGlassesBlackHoodie", label: "404 cap avatar", gender: "male", src: ASSETS.avatars.capGlassesBlackHoodie },
  { id: "blackHairBlueClipHoodie", label: "blue clip avatar", gender: "male", src: ASSETS.avatars.blackHairBlueClipHoodie },
  { id: "blackHairGlassesWhiteHoodie", label: "glasses avatar", gender: "male", src: ASSETS.avatars.blackHairGlassesWhiteHoodie },
  { id: "blondeGreenHoodie", label: "blonde avatar", gender: "female", src: ASSETS.avatars.blondeGreenHoodie },
  { id: "blueHeadphonesBlackHoodie", label: "headphones avatar", gender: "male", src: ASSETS.avatars.blueHeadphonesBlackHoodie },
  { id: "blueStreak404Hoodie", label: "blue streak avatar", gender: "male", src: ASSETS.avatars.blueStreak404Hoodie },
  { id: "brownBunYellowHoodie", label: "yellow hoodie avatar", gender: "female", src: ASSETS.avatars.brownBunYellowHoodie },
  { id: "brownPonytailBlueHoodie", label: "ponytail avatar", gender: "female", src: ASSETS.avatars.brownPonytailBlueHoodie },
  { id: "curlyBlackBlueHoodie", label: "curly hair avatar", gender: "male", src: ASSETS.avatars.curlyBlackBlueHoodie },
  { id: "curlyBlackBlueStarHoodie", label: "star hoodie avatar", gender: "male", src: ASSETS.avatars.curlyBlackBlueStarHoodie },
  { id: "curlyBlackOrangeHoodie", label: "orange hoodie avatar", gender: "male", src: ASSETS.avatars.curlyBlackOrangeHoodie },
  { id: "pinkBobBlackHoodie", label: "pink bob avatar", gender: "female", src: ASSETS.avatars.pinkBobBlackHoodie },
  { id: "silverSpikyGreenHoodie", label: "silver hair avatar", gender: "male", src: ASSETS.avatars.silverSpikyGreenHoodie },
  { id: "spikyBrownBlueWhiteHoodie", label: "spiky brown avatar", gender: "male", src: ASSETS.avatars.spikyBrownBlueWhiteHoodie },
  { id: "whiteCapWinkBlackHoodie", label: "white cap avatar", gender: "male", src: ASSETS.avatars.whiteCapWinkBlackHoodie },
  { id: "yellowHeadbandBunHoodie", label: "yellow headband avatar", gender: "female", src: ASSETS.avatars.yellowHeadbandBunHoodie },
];

const MIXED_AVATAR_ORDER = [
  "curlyBlackBlueHoodie",
  "brownPonytailBlueHoodie",
  "blueStreak404Hoodie",
  "blondeGreenHoodie",
  "blackHairGlassesWhiteHoodie",
  "pinkBobBlackHoodie",
  "spikyBrownBlueWhiteHoodie",
  "yellowHeadbandBunHoodie",
  "blueHeadphonesBlackHoodie",
  "brownBunYellowHoodie",
  "capGlassesBlackHoodie",
  "curlyBlackOrangeHoodie",
  "blackHairBlueClipHoodie",
  "silverSpikyGreenHoodie",
  "whiteCapWinkBlackHoodie",
  "curlyBlackBlueStarHoodie",
];

const AVATAR_PAGE_SIZE = 4;
const AVATAR_LOOP_COPIES = 5;
const AVATAR_LOOP_MIDDLE_COPY = Math.floor(AVATAR_LOOP_COPIES / 2);
const AVATAR_LOOP_RESET_DELAY_MS = 420;

function decodeJwt(token) {
  try {
    const encodedPayload = token.split(".")[1];
    const normalizedPayload = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      "=",
    );
    return JSON.parse(atob(paddedPayload));
  } catch {
    return {};
  }
}

function normalizeGenderHint(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["male", "m", "man", "boy"].includes(normalized)) return "male";
  if (["female", "f", "woman", "girl"].includes(normalized)) return "female";
  return "";
}

function orderedCampusAvatars(genderHint) {
  const hint = normalizeGenderHint(genderHint);
  if (hint === "male" || hint === "female") {
    const preferred = CAMPUS_AVATARS.filter((avatar) => avatar.gender === hint);
    const remaining = CAMPUS_AVATARS.filter((avatar) => avatar.gender !== hint);
    return [...preferred, ...remaining];
  }

  return MIXED_AVATAR_ORDER
    .map((id) => CAMPUS_AVATARS.find((avatar) => avatar.id === id))
    .filter(Boolean);
}

function normalizeUsername(value) {
  return value.toLowerCase().replace(/[^a-z0-9_\-]/g, "").slice(0, 64);
}

function suggestUsername(fullName, email) {
  const emailName = String(email || "").split("@")[0];
  const base = emailName || fullName || "";
  return normalizeUsername(base.replace(/[\s.]+/g, "_"));
}

function splitDisplayName(value) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" ") || null,
  };
}

function formatProviderName(provider) {
  const value = String(provider || "").trim();
  if (!value) return "Provider";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function normalizeAvatarLoopIndex(index, optionCount) {
  if (!optionCount) return 0;
  return ((index % optionCount) + optionCount) % optionCount;
}

function getMiddleAvatarLoopIndex(avatarIndex, optionCount) {
  if (!optionCount) return 0;
  return (optionCount > 1 ? AVATAR_LOOP_MIDDLE_COPY : 0) * optionCount + avatarIndex;
}

function getNearestAvatarLoopIndex(currentLoopIndex, targetAvatarIndex, optionCount) {
  if (!optionCount) return 0;

  const currentAvatarIndex = normalizeAvatarLoopIndex(currentLoopIndex, optionCount);
  let delta = targetAvatarIndex - currentAvatarIndex;

  if (delta > optionCount / 2) delta -= optionCount;
  if (delta < -optionCount / 2) delta += optionCount;

  return currentLoopIndex + delta;
}

function getCallbackError(error, banReason, status, setupToken, token) {
  if (error === "banned") {
    return [
      "Your account cannot be logged in or created because it has been banned from the website.",
      banReason ? `Reason: ${banReason}` : "",
      "For more information, contact the site administrator.",
    ].filter(Boolean).join(" ");
  }

  if (error) return error;
  if (status === "active" && !token) return "Sign-in finished without a session token. Please try again.";
  if (status !== "pending_username" || !setupToken) {
    return "This page can only be reached after signing in with Google or GitHub.";
  }

  return "";
}

function CallbackStatus({ icon, title, copy, actionLabel, onAction }) {
  return (
    <main className="oauthCallback">
      <section className="oauthCallback__statusCard">
        <div className="oauthCallback__statusIcon">{icon}</div>
        <h1>{title}</h1>
        <p>{copy}</p>
        {actionLabel && (
          <button type="button" className="btn btn-brand oauthCallback__statusButton" onClick={onAction}>
            {actionLabel}
          </button>
        )}
      </section>
    </main>
  );
}

export default function OAuthCallbackPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const status = params.get("status");
  const token = params.get("token");
  const role = params.get("role");
  const username = params.get("username");
  const avatarUrl = params.get("avatar_url");
  const setupToken = params.get("setup_token");
  const error = params.get("error");
  const banReason = params.get("reason");

  useEffect(() => {
    if (status !== "active" || !token) return;

    const nextRole = (role ?? "student").toUpperCase();
    const nextAvatarUrl = (avatarUrl ?? "").trim();
    saveAuthSession({
      access_token: token,
      role: nextRole,
      username: username ?? "",
      avatar_url: nextAvatarUrl,
    });
    navigate(consumeAuthReturnTo(APP_ROUTES.frontendDashboard), { replace: true });
  }, [avatarUrl, navigate, role, status, token, username]);

  const setupTokenPayload = useMemo(() => (setupToken ? decodeJwt(setupToken) : {}), [setupToken]);
  const providerAvatarUrl = (setupTokenPayload.avatar_url || "").trim();
  const providerName = formatProviderName(setupTokenPayload.provider);
  const fullName = (setupTokenPayload.full_name || "").trim();
  const email = (setupTokenPayload.email || "").trim();
  const genderHint = setupTokenPayload.gender || setupTokenPayload.gender_hint || "";

  const rawAvatarOptions = useMemo(() => {
    const providerAvatar = providerAvatarUrl
      ? [{
          id: "provider-avatar",
          label: `${providerName} avatar`,
          gender: "provider",
          source: "provider",
          src: providerAvatarUrl,
        }]
      : [];

    return [...providerAvatar, ...orderedCampusAvatars(genderHint)];
  }, [genderHint, providerAvatarUrl, providerName]);

  const [displayName, setDisplayName] = useState(fullName);
  const [usernameInput, setUsernameInput] = useState(() => suggestUsername(fullName, email));
  const [selectedAvatarId, setSelectedAvatarId] = useState("");
  const [failedAvatarIds, setFailedAvatarIds] = useState(() => new Set());
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isUsernameAvailable, setIsUsernameAvailable] = useState(null);
  const [selectedAvatarLoopIndex, setSelectedAvatarLoopIndex] = useState(null);
  const avatarButtonRefs = useRef(new Map());
  const avatarScrollBehaviorRef = useRef("auto");

  const avatarOptions = useMemo(
    () => rawAvatarOptions.filter((avatar) => !failedAvatarIds.has(avatar.id)),
    [failedAvatarIds, rawAvatarOptions],
  );

  const preferredAvatarId = useMemo(() => (
    avatarOptions.find((avatar) => avatar.source !== "provider")?.id || avatarOptions[0]?.id || ""
  ), [avatarOptions]);

  useEffect(() => {
    setDisplayName(fullName);
    setUsernameInput(suggestUsername(fullName, email));
    setFailedAvatarIds(new Set());
    setIsUsernameAvailable(null);
    setIsCheckingUsername(false);
  }, [email, fullName, setupToken]);

  useEffect(() => {
    if (!avatarOptions.length) return;
    setSelectedAvatarId((currentAvatarId) => (
      avatarOptions.some((avatar) => avatar.id === currentAvatarId)
        ? currentAvatarId
        : preferredAvatarId
    ));
  }, [avatarOptions, preferredAvatarId]);

  useEffect(() => {
    if (usernameInput.length < 3) {
      setIsUsernameAvailable(null);
      setIsCheckingUsername(false);
      return;
    }

    setIsCheckingUsername(true);
    const timeoutId = window.setTimeout(async () => {
      try {
        const res = await fetch(apiUrl(`/auth/check-username?username=${encodeURIComponent(usernameInput)}`));
        if (res.ok) {
          const data = await res.json();
          setIsUsernameAvailable(data.available);
        } else {
          setIsUsernameAvailable(null);
        }
      } catch {
        setIsUsernameAvailable(null);
      } finally {
        setIsCheckingUsername(false);
      }
    }, 450);

    return () => window.clearTimeout(timeoutId);
  }, [usernameInput]);

  const selectedAvatarIndex = (() => {
    const explicitIndex = avatarOptions.findIndex((avatar) => avatar.id === selectedAvatarId);
    if (explicitIndex >= 0) return explicitIndex;

    const preferredIndex = avatarOptions.findIndex((avatar) => avatar.id === preferredAvatarId);
    return preferredIndex >= 0 ? preferredIndex : 0;
  })();
  const selectedAvatar = avatarOptions[selectedAvatarIndex] || avatarOptions[0];
  const activeAvatarLoopIndex = avatarOptions.length
    ? selectedAvatarLoopIndex ?? getMiddleAvatarLoopIndex(selectedAvatarIndex, avatarOptions.length)
    : 0;
  const loopedAvatarOptions = useMemo(() => {
    if (!avatarOptions.length) return [];

    const copyCount = avatarOptions.length > 1 ? AVATAR_LOOP_COPIES : 1;
    return Array.from({ length: copyCount }, (_, copyIndex) => (
      avatarOptions.map((avatar, index) => ({
        ...avatar,
        avatarIndex: index,
        loopIndex: (copyIndex * avatarOptions.length) + index,
        loopKey: `${copyIndex}-${avatar.id}`,
      }))
    )).flat();
  }, [avatarOptions]);
  const avatarPageCount = Math.ceil(avatarOptions.length / AVATAR_PAGE_SIZE);
  const activeAvatarPage = Math.floor(selectedAvatarIndex / AVATAR_PAGE_SIZE);
  const canSubmit = (
    displayName.trim()
    && usernameInput.length >= 3
    && isUsernameAvailable !== false
    && !isCheckingUsername
    && !loading
    && selectedAvatar
  );
  const initialError = getCallbackError(error, banReason, status, setupToken, token);

  useEffect(() => {
    if (!avatarOptions.length) {
      setSelectedAvatarLoopIndex(null);
      return;
    }

    setSelectedAvatarLoopIndex((currentLoopIndex) => {
      if (
        Number.isInteger(currentLoopIndex)
        && normalizeAvatarLoopIndex(currentLoopIndex, avatarOptions.length) === selectedAvatarIndex
      ) {
        return currentLoopIndex;
      }

      avatarScrollBehaviorRef.current = "auto";
      return getMiddleAvatarLoopIndex(selectedAvatarIndex, avatarOptions.length);
    });
  }, [avatarOptions.length, selectedAvatarIndex]);

  useEffect(() => {
    if (!avatarOptions.length) return undefined;

    const selectedAvatarButton = avatarButtonRefs.current.get(activeAvatarLoopIndex);
    if (!selectedAvatarButton) return undefined;

    const frameId = window.requestAnimationFrame(() => {
      selectedAvatarButton.scrollIntoView({
        behavior: avatarScrollBehaviorRef.current,
        block: "nearest",
        inline: "center",
      });
      avatarScrollBehaviorRef.current = "smooth";
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [activeAvatarLoopIndex, avatarOptions.length]);

  useEffect(() => {
    if (!avatarOptions.length || avatarOptions.length <= 1 || !Number.isInteger(selectedAvatarLoopIndex)) {
      return undefined;
    }

    const middleStart = avatarOptions.length * AVATAR_LOOP_MIDDLE_COPY;
    const middleEnd = middleStart + avatarOptions.length;
    if (selectedAvatarLoopIndex >= middleStart && selectedAvatarLoopIndex < middleEnd) {
      return undefined;
    }

    const resetLoopIndex = getMiddleAvatarLoopIndex(
      normalizeAvatarLoopIndex(selectedAvatarLoopIndex, avatarOptions.length),
      avatarOptions.length,
    );
    const resetTimeoutId = window.setTimeout(() => {
      avatarScrollBehaviorRef.current = "auto";
      setSelectedAvatarLoopIndex(resetLoopIndex);
    }, AVATAR_LOOP_RESET_DELAY_MS);

    return () => window.clearTimeout(resetTimeoutId);
  }, [avatarOptions.length, selectedAvatarLoopIndex]);

  const selectAvatarAtLoopIndex = (nextLoopIndex) => {
    if (!avatarOptions.length) return;

    const renderedAvatarCount = avatarOptions.length * (avatarOptions.length > 1 ? AVATAR_LOOP_COPIES : 1);
    const nextAvatarIndex = normalizeAvatarLoopIndex(nextLoopIndex, avatarOptions.length);
    const safeLoopIndex = nextLoopIndex >= 0 && nextLoopIndex < renderedAvatarCount
      ? nextLoopIndex
      : getMiddleAvatarLoopIndex(nextAvatarIndex, avatarOptions.length);

    avatarScrollBehaviorRef.current = "smooth";
    setSelectedAvatarLoopIndex(safeLoopIndex);
    setSelectedAvatarId(avatarOptions[nextAvatarIndex].id);
  };

  const handleAvatarStep = (direction) => {
    if (!avatarOptions.length) return;
    selectAvatarAtLoopIndex(activeAvatarLoopIndex + direction);
  };

  const jumpToAvatarPage = (pageIndex) => {
    const nextIndex = Math.min(pageIndex * AVATAR_PAGE_SIZE, avatarOptions.length - 1);
    if (nextIndex < 0) return;
    selectAvatarAtLoopIndex(getNearestAvatarLoopIndex(activeAvatarLoopIndex, nextIndex, avatarOptions.length));
  };

  const handleAvatarImageError = (avatar) => {
    setFailedAvatarIds((currentFailedIds) => {
      if (currentFailedIds.has(avatar.id)) return currentFailedIds;
      const nextFailedIds = new Set(currentFailedIds);
      nextFailedIds.add(avatar.id);
      return nextFailedIds;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const { firstName, lastName } = splitDisplayName(displayName);
    if (!setupToken || !firstName || usernameInput.length < 3 || !selectedAvatar) return;

    setLoading(true);
    setErrMsg("");

    try {
      const res = await fetch(apiUrl("/auth/complete-profile"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${setupToken}`,
        },
        body: JSON.stringify({
          username: usernameInput.trim(),
          first_name: firstName,
          last_name: lastName,
          avatar: selectedAvatar.src,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrMsg(data.detail ?? "Something went wrong. Please try again.");
        return;
      }

      const nextRole = (data.role ?? "student").toUpperCase();
      const nextUsername = data.username ?? "";
      const nextAvatarUrl = (data.avatar_url ?? selectedAvatar.src ?? "").trim();
      saveAuthSession({
        access_token: data.access_token,
        role: nextRole,
        username: nextUsername,
        avatar_url: nextAvatarUrl,
      });
      navigate(consumeAuthReturnTo(APP_ROUTES.frontendDashboard), { replace: true });
    } catch {
      setErrMsg("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (status === "active" && token) {
    return (
      <CallbackStatus
        icon={<Loader2 size={30} className="oauthCallback__spin" />}
        title="Signing you in"
        copy="We are opening your Campus404 workspace."
      />
    );
  }

  if (initialError) {
    return (
      <CallbackStatus
        icon={<AlertCircle size={34} />}
        title={error === "banned" ? "Account banned" : "Authentication failed"}
        copy={initialError}
        actionLabel="Return home"
        onAction={() => navigate(APP_ROUTES.home, { replace: true })}
      />
    );
  }

  return (
    <main className="oauthCallback">
      <section className="oauthCallback__modal" aria-label="Complete your Campus404 profile">
        <img className="oauthCallback__pixels oauthCallback__pixels--top" src={ASSETS.decorations.pixelSquaresFade} alt="" />
        <img className="oauthCallback__pixels oauthCallback__pixels--bottom" src={ASSETS.decorations.pixelSquaresFade} alt="" />

        <button
          type="button"
          className="oauthCallback__close"
          onClick={() => navigate(APP_ROUTES.home, { replace: true })}
          aria-label="Close profile setup"
        >
          <X size={22} />
        </button>

        <div className="oauthCallback__avatarPanel">
          <div className="oauthCallback__avatarBadge">
            <Sparkles size={21} />
          </div>
          <h1>Choose your avatar</h1>
          <p>This helps others recognize you in the community.</p>

          <div className="oauthCallback__avatarStage">
            <button
              type="button"
              className="oauthCallback__avatarNav"
              onClick={() => handleAvatarStep(-1)}
              aria-label="Previous avatar"
            >
              <ChevronLeft size={20} />
            </button>

            <div className="oauthCallback__avatarRail" aria-live="polite">
              {loopedAvatarOptions.map((avatar) => {
                const isSelected = avatar.loopIndex === activeAvatarLoopIndex;
                const distanceFromSelected = Math.abs(avatar.loopIndex - activeAvatarLoopIndex);
                const visualDistance = distanceFromSelected > 2 ? "far" : String(distanceFromSelected);

                return (
                  <button
                    key={avatar.loopKey}
                    ref={(node) => {
                      if (node) {
                        avatarButtonRefs.current.set(avatar.loopIndex, node);
                      } else {
                        avatarButtonRefs.current.delete(avatar.loopIndex);
                      }
                    }}
                    type="button"
                    className={`oauthCallback__avatarOption${isSelected ? " oauthCallback__avatarOption--selected" : ""}${avatar.source === "provider" ? " oauthCallback__avatarOption--provider" : ""}`}
                    data-distance={visualDistance}
                    onClick={() => selectAvatarAtLoopIndex(avatar.loopIndex)}
                    aria-label={`Select ${avatar.label}`}
                    aria-pressed={isSelected}
                    tabIndex={isSelected || distanceFromSelected <= 2 ? 0 : -1}
                  >
                    <img
                      src={avatar.src}
                      alt=""
                      draggable="false"
                      referrerPolicy={avatar.source === "provider" ? "no-referrer" : undefined}
                      onError={() => handleAvatarImageError(avatar)}
                    />
                    {isSelected && <Sparkles className="oauthCallback__avatarSpark" size={18} aria-hidden="true" />}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className="oauthCallback__avatarNav"
              onClick={() => handleAvatarStep(1)}
              aria-label="Next avatar"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="oauthCallback__avatarDots" aria-label="Avatar pages">
            {Array.from({ length: avatarPageCount }).map((_, pageIndex) => (
              <button
                key={pageIndex}
                type="button"
                className={pageIndex === activeAvatarPage ? "is-active" : ""}
                onClick={() => jumpToAvatarPage(pageIndex)}
                aria-label={`Show avatar group ${pageIndex + 1}`}
                aria-pressed={pageIndex === activeAvatarPage}
              />
            ))}
          </div>

          <div className="oauthCallback__avatarNote">
            <RefreshCw size={19} />
            <span>You can change your avatar anytime from profile settings.</span>
          </div>
        </div>

        <div className="oauthCallback__profilePanel">
          <div className="oauthCallback__profileHeader">
            <img src={ASSETS.brand.logo} alt="Campus404" />
            <h2>Complete your profile</h2>
            <p>Your identity is verified. Personalize your profile and activate your workspace.</p>
          </div>

          <form className="oauthCallback__form" onSubmit={handleSubmit}>
            <div className="oauthCallback__field">
              <label htmlFor="callback-display-name">What should we call you? *</label>
              <div className="oauthCallback__inputWrap oauthCallback__inputWrap--plain">
                <input
                  id="callback-display-name"
                  type="text"
                  placeholder="e.g. Dhanush R.S"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={128}
                  required
                  autoComplete="name"
                />
              </div>
            </div>

            <div className="oauthCallback__field">
              <label htmlFor="callback-username">Username *</label>
              <div className="oauthCallback__inputWrap">
                <AtSign size={18} className="oauthCallback__inputIcon" />
                <input
                  id="callback-username"
                  type="text"
                  placeholder="devraj_23"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(normalizeUsername(e.target.value))}
                  maxLength={64}
                  required
                  autoComplete="username"
                  autoFocus
                />
                {isCheckingUsername ? (
                  <Loader2 size={18} className="oauthCallback__usernameStatus oauthCallback__spin" />
                ) : usernameInput.length >= 3 && isUsernameAvailable !== null ? (
                  isUsernameAvailable ? (
                    <CheckCircle size={18} className="oauthCallback__usernameStatus oauthCallback__usernameStatus--available" />
                  ) : (
                    <XCircle size={18} className="oauthCallback__usernameStatus oauthCallback__usernameStatus--taken" />
                  )
                ) : null}
              </div>
              <span className="oauthCallback__inputHint">
                {usernameInput.length >= 3 && isUsernameAvailable === false
                  ? "This username is already taken."
                  : "3-64 characters. Letters, numbers, _ and - only."}
              </span>
            </div>

            {errMsg && <div className="oauthCallback__error">{errMsg}</div>}

            <button type="submit" className="btn btn-brand oauthCallback__submit" disabled={!canSubmit}>
              {loading ? (
                <>
                  <Loader2 size={16} className="oauthCallback__spin" />
                  Activating...
                </>
              ) : (
                <>
                  Activate Workspace
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            <p className="oauthCallback__trust">
              <ShieldCheck size={17} />
              <span>You can update your details anytime in settings.</span>
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}
