import { APP_ROUTES } from "../../../routes/paths.js";
import { ASSETS } from "../../../shared/assets.js";
import LegalPolicyLayout from "./LegalPolicyLayout.jsx";
import "./LegalPage.css";

const READ_TIME = "3 min read";

const SECTIONS = [
  {
    title: "Requesting Deletion",
    content: (
      <p>
        Users can request deletion of account data, OAuth profile data, learning
        progress, workspace records, and related personal information through the
        official Campus404 support channel or any self-service account deletion flow
        that is added to the product.
      </p>
    ),
  },
  {
    title: "What To Include",
    content: (
      <ul>
        <li>Your Campus404 username.</li>
        <li>The email address used to sign in.</li>
        <li>The OAuth provider used, such as Google or GitHub.</li>
        <li>A clear statement that you want your account and associated personal data deleted.</li>
      </ul>
    ),
  },
  {
    title: "What May Be Deleted",
    content: (
      <ul>
        <li>Profile information such as name, username, email, avatar, and provider identity.</li>
        <li>Learning progress, completed tasks, leaderboard entries, and workspace-related records.</li>
        <li>Uploaded user content associated with your account, where technically and legally possible.</li>
      </ul>
    ),
  },
  {
    title: "What May Be Retained",
    content: (
      <p>
        Some records may be retained for a limited period if needed for security,
        fraud prevention, dispute handling, legal compliance, backup recovery, or
        audit integrity. Retained data should be minimized and protected.
      </p>
    ),
  },
  {
    title: "OAuth Provider Controls",
    content: (
      <p>
        You can also revoke Campus404 access from your Google or GitHub account
        settings. Revoking provider access does not automatically delete data already
        stored by Campus404, so submit a deletion request if you want stored account
        data removed.
      </p>
    ),
  },
];

export default function DataDeletionPage() {
  return (
    <LegalPolicyLayout
      title="Data Deletion"
      description="How users can request deletion of Campus404 account data, OAuth profile data, progress, and workspace records."
      pathname={APP_ROUTES.dataDeletion}
      icon={ASSETS.icons.dataDeletion}
      readTime={READ_TIME}
      intro="How users can request deletion of account data, OAuth profile data, progress, and workspace records."
      sections={SECTIONS}
    />
  );
}
