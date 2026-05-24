const publicAsset = (path) => `${import.meta.env.BASE_URL}assets/${path}`;

export const ASSETS = Object.freeze({
  brand: {
    logo: publicAsset("brand/campus404-logo.svg"),
    favicon: publicAsset("brand/campus404-favicon.svg"),
    faviconPng: publicAsset("brand/campus404-favicon.png"),
  },
  avatars: {
    capGlassesBlackHoodie: publicAsset("avatars/pixel-404-cap-glasses-black-hoodie.webp"),
    blackHairBlueClipHoodie: publicAsset("avatars/pixel-black-hair-blue-clip-hoodie.webp"),
    blackHairGlassesWhiteHoodie: publicAsset("avatars/pixel-black-hair-glasses-white-hoodie.webp"),
    blondeGreenHoodie: publicAsset("avatars/pixel-blonde-green-hoodie.webp"),
    blueHeadphonesBlackHoodie: publicAsset("avatars/pixel-blue-headphones-black-hoodie.webp"),
    blueStreak404Hoodie: publicAsset("avatars/pixel-blue-streak-404-hoodie.webp"),
    brownBunYellowHoodie: publicAsset("avatars/pixel-brown-bun-yellow-hoodie.webp"),
    brownPonytailBlueHoodie: publicAsset("avatars/pixel-brown-ponytail-blue-hoodie.webp"),
    curlyBlackBlueHoodie: publicAsset("avatars/pixel-curly-black-blue-hoodie.webp"),
    curlyBlackBlueStarHoodie: publicAsset("avatars/pixel-curly-black-blue-star-hoodie.webp"),
    curlyBlackOrangeHoodie: publicAsset("avatars/pixel-curly-black-orange-hoodie.webp"),
    pinkBobBlackHoodie: publicAsset("avatars/pixel-pink-bob-black-hoodie.webp"),
    silverSpikyGreenHoodie: publicAsset("avatars/pixel-silver-spiky-green-hoodie.webp"),
    spikyBrownBlueWhiteHoodie: publicAsset("avatars/pixel-spiky-brown-blue-white-hoodie.webp"),
    whiteCapWinkBlackHoodie: publicAsset("avatars/pixel-white-cap-wink-black-hoodie.webp"),
    yellowHeadbandBunHoodie: publicAsset("avatars/pixel-yellow-headband-bun-hoodie.webp"),
  },
  campus: {
    kvgCampus: publicAsset("campus/kvg-campus.avif"),
  },
  contact: {
    heroBuildLearn: publicAsset("contact/contact-hero-build-learn.webp"),
  },
  decorations: {
    pixelCloud: publicAsset("decorations/pixel-cloud.png"),
    pixelCorner: publicAsset("decorations/pixel-corner.svg"),
    pixelSquaresFade: publicAsset("decorations/pixel-squares-fade.webp"),
  },
  icons: {
    acceptableUsePolicy: publicAsset("icons/Acceptable Use Policy.webp"),
    cookiePolicy: publicAsset("icons/Cookie Policy.webp"),
    dataDeletion: publicAsset("icons/Data Deletion.webp"),
    helpDesk: publicAsset("icons/help-desk.webp"),
    hintBulb: publicAsset("icons/hint-bulb.png"),
    lockBlue: publicAsset("icons/lock-blue.png"),
    privacyPolicy: publicAsset("icons/Privacy Policy.webp"),
    leaderboardHeroPodium: publicAsset("icons/leaderboard-hero-podium.webp"),
    leaderboardPodiumTrophy: publicAsset("icons/leaderboard-podium-trophy.svg"),
    leaderboardRewardChest: publicAsset("icons/leaderboard-reward-chest.svg"),
    leaderboardSummitFlag: publicAsset("icons/leaderboard-summit-flag.svg"),
    rankMedalBronze: publicAsset("icons/rank-medal-bronze.svg"),
    rankMedalGold: publicAsset("icons/rank-medal-gold.svg"),
    rankMedalSilver: publicAsset("icons/rank-medal-silver.svg"),
    securityPractices: publicAsset("icons/Security Practices.webp"),
    streakFire: publicAsset("icons/streak-fire.png"),
    termsAndConditions: publicAsset("icons/Terms and Conditions.webp"),
    timelineFlag: publicAsset("icons/timeline-flag.png"),
    trophyCup: publicAsset("icons/trophy-cup.png"),
    xpStar: publicAsset("icons/xp-star.png"),
  },
  mascot: {
    workspaceGuide: publicAsset("mascot/opto-workspace-guide.png"),
  },
  rewards: {
    certificateTrophy: publicAsset("rewards/certificate-trophy.png"),
  },
  tracks: {
    adminCommandCenter: publicAsset("tracks/admin-command-center.webp"),
    lessonChecklist: publicAsset("tracks/lesson-checklist.png"),
    projectLaptop: publicAsset("tracks/project-laptop.png"),
    pythonCampusHero: publicAsset("tracks/python-campus-hero.png"),
    studentCodingDesk: publicAsset("tracks/student-coding-desk.webp"),
    workspaceMonitor: publicAsset("tracks/workspace-monitor.png"),
  },
});

export default ASSETS;
