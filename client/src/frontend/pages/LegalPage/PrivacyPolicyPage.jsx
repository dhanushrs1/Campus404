import { APP_ROUTES } from "../../../routes/paths.js";
import { ASSETS } from "../../../shared/assets.js";
import LegalPolicyLayout from "./LegalPolicyLayout.jsx";
import "./LegalPage.css";

const READ_TIME = "6 min read";

const SECTIONS = [
  {
    title: "Overview",
    content: (
      <>
        <p>
          Campus404 is a coding learning platform. This Privacy Policy explains how we
          handle information when people visit the site, sign in, create a profile,
          use learning tracks, submit code, or interact with admin-managed services.
        </p>
        <p>
          This policy applies to the public website, account area, learning features,
          coding workspace, leaderboard features, OAuth sign-in, and admin-managed
          platform services.
        </p>
      </>
    ),
  },
  {
    title: "Information We Collect",
    content: (
      <ul>
        <li>Account information such as name, username, email address, avatar, authentication provider, and role.</li>
        <li>OAuth information returned by providers such as Google or GitHub when you choose to sign in.</li>
        <li>Learning activity such as track progress, completed tasks, submissions, XP-style progress, and leaderboard activity.</li>
        <li>Code and exercise content submitted through the workspace for evaluation.</li>
        <li>Technical data such as IP address, browser details, device information, timestamps, logs, and request metadata.</li>
        <li>Uploaded media and admin-managed content when an authorized admin or editor uses the admin panel.</li>
      </ul>
    ),
  },
  {
    title: "How We Use Information",
    content: (
      <ul>
        <li>To create and manage accounts, sessions, profiles, learning progress, and role-based access.</li>
        <li>To provide coding exercises, workspace execution, feedback, leaderboards, and curriculum features.</li>
        <li>To keep the service safe, detect abuse, enforce platform rules, and investigate technical issues.</li>
        <li>To maintain admin audit logs for administrative and security accountability.</li>
        <li>To improve reliability, usability, content quality, and learning features.</li>
      </ul>
    ),
  },
  {
    title: "OAuth And Third-Party Services",
    content: (
      <>
        <p>
          If you sign in with Google or GitHub, those providers may share profile
          information according to the permissions shown during sign-in. Campus404 uses
          that information only to create or authenticate your account and personalize
          your profile.
        </p>
        <p>
          Campus404 may use trusted infrastructure, storage, analytics, authentication,
          security, and code execution providers to operate the product.
        </p>
      </>
    ),
  },
  {
    title: "Google User Data",
    content: (
      <p>
        When Google sign-in is enabled, Campus404 uses Google account data only for
        authentication, account creation, profile display, access control, safety,
        and support. We do not sell Google user data, use it for advertising, or
        transfer it except as needed to provide the service, protect users, comply
        with law, or with your consent.
      </p>
    ),
  },
  {
    title: "Cookies And Browser Storage",
    content: (
      <p>
        Campus404 may use browser storage for session tokens, role information,
        profile display data, learning progress state, and security-related
        preferences. See the Cookie Policy for more detail.
      </p>
    ),
  },
  {
    title: "Sharing And Disclosure",
    content: (
      <ul>
        <li>We do not sell personal information.</li>
        <li>We may share information with service providers that help operate hosting, storage, authentication, code execution, security, and communications.</li>
        <li>We may disclose information if required by law, to protect users or the service, or to investigate misuse.</li>
        <li>Leaderboard entries may show public profile details such as username, avatar, completed tasks, and XP-style scores.</li>
      </ul>
    ),
  },
  {
    title: "Retention And Choices",
    content: (
      <>
        <p>
          We keep information for as long as needed to provide the service, comply with
          obligations, prevent abuse, resolve disputes, and maintain security logs.
          Account and learning data may be deleted or anonymized after a valid deletion
          request, unless retention is required for security or legal reasons.
        </p>
        <ul>
          <li>You can request access, correction, export, or deletion of your account data.</li>
          <li>You can revoke Google or GitHub access from the relevant provider account settings.</li>
          <li>You can clear local browser storage, though doing so may sign you out or remove local progress state.</li>
        </ul>
      </>
    ),
  },
  {
    title: "Children And Students",
    content: (
      <p>
        Campus404 should be used by minors only with appropriate parent, guardian,
        school, or institutional permission where required. If you believe a child
        provided personal information without the required permission, request
        deletion through the Data Deletion page.
      </p>
    ),
  },
  {
    title: "Contact",
    content: (
      <p>
        For privacy requests, use the Data Deletion page or the official Campus404
        support channel published for your deployment.
      </p>
    ),
  },
];

export default function PrivacyPolicyPage() {
  return (
    <LegalPolicyLayout
      title="Privacy Policy"
      description="How Campus404 collects, uses, protects, and manages account, learning, OAuth, and platform data."
      pathname={APP_ROUTES.privacyPolicy}
      icon={ASSETS.icons.privacyPolicy}
      readTime={READ_TIME}
      intro="Your privacy matters to us. This policy explains how we collect, use, and protect your information."
      sections={SECTIONS}
    />
  );
}
