export const APP_ROUTES = Object.freeze({
  home: "/",
  login: "/",

  // Clean user-facing slugs.
  frontendDashboard: "/dashboard",
  frontendProfile: "/profile",
  frontendTracks: "/tracks",
  frontendLeaderboards: "/leaderboards",
  frontendRankingRewards: "/ranking-rewards",
  frontendLeaderboard: ({ scope = "global", track = "" } = {}) => {
    const params = new URLSearchParams({ scope });
    if (track) params.set("track", track);
    return `/leaderboards?${params.toString()}`;
  },
  frontendTrackOverviewPattern: "/tracks/:trackSlug",
  frontendTrackOverview: (trackSlug) => `/tracks/${trackSlug}`,
  frontendExerciseWorkspacePattern: "/:trackSlug/:sectionSlug/:exerciseSlug/:taskId",
  frontendExerciseWorkspace: (trackSlug, sectionSlug, exerciseSlug, taskId) => `/${trackSlug}/${sectionSlug}/${exerciseSlug}/${taskId}`,
  contactUs: "/contact-us",

  // Public legal and policy pages.
  legal: "/legal-centre",
  legalLegacy: "/legal",
  privacyPolicy: "/privacy-policy",
  termsAndConditions: "/terms-and-conditions",
  cookiePolicy: "/cookie-policy",
  acceptableUsePolicy: "/acceptable-use-policy",
  dataDeletion: "/data-deletion",
  securityPractices: "/security",

  // Legacy frontend-prefixed slugs kept for redirects.
  frontendRoot: "/frontend",
  frontendDashboardLegacy: "/frontend/dashboard",
  frontendTracksLegacy: "/frontend/tracks",
  frontendWorkspaceLegacy: "/frontend/workspace",
  frontendWorkspaceRedirect: "/workspace",

  // Admin routes (query-driven canonical pattern).
  adminRoot: "/admin",
  adminDashboard: "/admin/dashboard",
  adminDashboardTab: (tab = "overview") => `/admin/dashboard?tab=${encodeURIComponent(tab)}`,

  // Legacy path-based admin section slugs kept for redirects.
  adminOverviewLegacy: "/admin/overview",
  adminTracksLegacy: "/admin/tracks",
  adminMediaLegacy: "/admin/media",
  adminUsersLegacy: "/admin/users",

  // Legacy backend slugs from previous rename, kept for compatibility.
  backendRootLegacy: "/backend",
  backendDashboardLegacy: "/backend/dashboard",

  // Convenience alias used by existing links.
  userDashboard: "/dashboard",
});
