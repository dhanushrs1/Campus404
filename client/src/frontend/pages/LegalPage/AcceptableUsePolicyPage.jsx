import { APP_ROUTES } from "../../../routes/paths.js";
import { ASSETS } from "../../../shared/assets.js";
import LegalPolicyLayout from "./LegalPolicyLayout.jsx";
import "./LegalPage.css";

const READ_TIME = "4 min read";

const SECTIONS = [
  {
    title: "Purpose",
    content: (
      <p>
        Campus404 is built for learning, practice, and responsible experimentation.
        This policy explains behavior that is not allowed on the platform.
      </p>
    ),
  },
  {
    title: "Prohibited Activity",
    content: (
      <ul>
        <li>Bypassing authentication, authorization, rate limits, workspace locks, admin protections, or other access controls.</li>
        <li>Running malicious code, malware, credential theft tools, destructive payloads, or code intended to attack systems.</li>
        <li>Attempting to overload, scan, exploit, reverse engineer, or disrupt Campus404 infrastructure or connected services.</li>
        <li>Uploading, submitting, or sharing unlawful, hateful, abusive, infringing, private, or harmful content.</li>
        <li>Scraping, harvesting, or exposing user data, leaderboard data, private files, tokens, or admin-only content.</li>
        <li>Impersonating another person, misrepresenting affiliation, or manipulating progress, rankings, badges, or submissions.</li>
        <li>Using the service for spam, fraud, harassment, or any activity that harms users, infrastructure, or learning integrity.</li>
      </ul>
    ),
  },
  {
    title: "Code Execution",
    content: (
      <p>
        Workspace execution is provided for educational tasks. Do not use it for
        attacks, mining, evasion, persistence, exfiltration, network abuse, or
        attempts to escape isolation.
      </p>
    ),
  },
  {
    title: "Enforcement",
    content: (
      <p>
        Campus404 may remove content, block submissions, suspend accounts, revoke
        sessions, restrict roles, preserve logs, or take other action when this
        policy is violated or when security risk is detected.
      </p>
    ),
  },
];

export default function AcceptableUsePolicyPage() {
  return (
    <LegalPolicyLayout
      title="Acceptable Use Policy"
      description="Rules for safe and responsible use of Campus404 accounts, code execution, content, and community features."
      pathname={APP_ROUTES.acceptableUsePolicy}
      icon={ASSETS.icons.acceptableUsePolicy}
      readTime={READ_TIME}
      intro="Rules for safe, responsible use of Campus404 accounts, code execution, content, and learning features."
      sections={SECTIONS}
    />
  );
}
