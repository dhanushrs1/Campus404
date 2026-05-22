import {
  Activity,
  AlertTriangle,
  Award,
  BarChart3,
  ClipboardCheck,
  FolderTree,
  Home,
  Image,
  Inbox,
  Settings2,
  TrendingUp,
  User,
  Users,
} from "lucide-react";

export const NAV_SECTIONS = [
  {
    title: "Platform",
    items: [
      { key: "overview", label: "Overview", icon: Home },
      { key: "analytics", label: "Analytics", icon: TrendingUp },
      { key: "curriculum", label: "Curriculum Builder", icon: FolderTree },
    ],
  },
  {
    title: "Learners & Engagement",
    items: [
      { key: "users", label: "Learners", icon: Users },
      { key: "submissions", label: "Submissions", icon: ClipboardCheck },
      { key: "leaderboards", label: "Leaderboards", icon: BarChart3 },
      { key: "rewards", label: "Rewards & Badges", icon: Award },
    ],
  },
  {
    title: "Resources & Support",
    items: [
      { key: "media", label: "Media Library", icon: Image },
      { key: "contacts", label: "Contact Inbox", icon: Inbox },
    ],
  },
  {
    title: "Operations",
    items: [
      { key: "health", label: "System Health", icon: Activity },
      { key: "errors", label: "Error Handling", icon: AlertTriangle, adminOnly: true },
      { key: "account", label: "My Account", icon: User },
      { key: "settings", label: "Settings", icon: Settings2 },
    ],
  },
];

export const NAV_ITEMS = NAV_SECTIONS.flatMap((section) => section.items);
export const NAV_KEY_SET = new Set(NAV_ITEMS.map((item) => item.key));

export const NAV_ALIASES = {
  tracks: "curriculum",
  exercises: "curriculum",
  badges: "rewards",
};

export const CURRICULUM_QUERY_KEYS = [
  "trackPage",
  "mode",
  "trackId",
  "nodeType",
  "sectionId",
  "exerciseId",
  "taskId",
  "levelTab",
  "studioExerciseId",
  "page",
  "perPage",
];

export const ELEVATED = new Set(["ADMIN", "EDITOR"]);
