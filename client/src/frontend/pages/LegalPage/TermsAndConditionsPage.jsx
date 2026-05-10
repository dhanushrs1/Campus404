import { APP_ROUTES } from "../../../routes/paths.js";
import { ASSETS } from "../../../shared/assets.js";
import LegalPolicyLayout from "./LegalPolicyLayout.jsx";
import "./LegalPage.css";

const READ_TIME = "5 min read";

const SECTIONS = [
  {
    title: "Agreement",
    content: (
      <>
        <p>
          These Terms and Conditions govern use of Campus404. By accessing the service,
          creating an account, signing in with OAuth, using learning tracks, or using
          the coding workspace, you agree to these terms.
        </p>
        <p>
          If you are using Campus404 for a school, company, or organization, you are
          responsible for confirming that you have authority and permission to use the
          service in that context.
        </p>
      </>
    ),
  },
  {
    title: "Accounts",
    content: (
      <ul>
        <li>You are responsible for keeping your account secure and for activity under your session.</li>
        <li>You must provide accurate profile information and may not impersonate another person or organization.</li>
        <li>Admins and editors must use elevated access only for legitimate platform management.</li>
        <li>Campus404 may suspend or restrict accounts that violate these terms or create security risk.</li>
      </ul>
    ),
  },
  {
    title: "Learning Content And Workspace",
    content: (
      <p>
        Campus404 provides educational content, exercises, code evaluation, progress
        tracking, and leaderboard features. Results, hints, feedback, and rankings
        are educational signals and may not always be complete, error-free, or
        suitable for every learning goal.
      </p>
    ),
  },
  {
    title: "User Content And Code",
    content: (
      <ul>
        <li>You keep ownership of code or content that you submit, subject to the rights needed for Campus404 to run, evaluate, store, display, and improve the service.</li>
        <li>Do not submit content that is unlawful, harmful, infringing, malicious, private to others, or intended to disrupt the platform.</li>
        <li>Code submitted to the workspace may be executed in isolated infrastructure and logged for progress, security, debugging, and abuse prevention.</li>
      </ul>
    ),
  },
  {
    title: "Acceptable Use",
    content: (
      <p>
        You must follow the Acceptable Use Policy. Attempts to bypass authentication,
        abuse the judge system, attack infrastructure, scrape restricted data, or
        misuse admin tools are prohibited.
      </p>
    ),
  },
  {
    title: "Intellectual Property",
    content: (
      <p>
        Campus404 branding, curriculum design, site interfaces, visual assets, and
        platform code are owned by Campus404 or its licensors unless stated otherwise.
        You may not copy or redistribute platform materials except as allowed by the
        service or written permission.
      </p>
    ),
  },
  {
    title: "Service Changes",
    content: (
      <p>
        Campus404 may update, pause, remove, or replace features, content, routes,
        policies, or infrastructure as the platform evolves.
      </p>
    ),
  },
  {
    title: "Disclaimers",
    content: (
      <p>
        The service is provided for learning and educational use. Campus404 does not
        guarantee uninterrupted availability, error-free content, a specific learning
        outcome, job placement, certification acceptance, or compatibility with every
        browser, device, or development environment.
      </p>
    ),
  },
  {
    title: "Limitation Of Liability",
    content: (
      <p>
        To the maximum extent allowed by applicable law, Campus404 is not liable for
        indirect, incidental, special, consequential, punitive, or lost-profit damages
        arising from use of the service.
      </p>
    ),
  },
  {
    title: "Updates To These Terms",
    content: (
      <p>
        We may update these terms when the product, legal requirements, or operational
        practices change. The last updated date shows when this page was most recently
        revised.
      </p>
    ),
  },
];

export default function TermsAndConditionsPage() {
  return (
    <LegalPolicyLayout
      title="Terms and Conditions"
      description="The terms that govern access to Campus404 accounts, tracks, workspace features, and platform services."
      pathname={APP_ROUTES.termsAndConditions}
      icon={ASSETS.icons.termsAndConditions}
      readTime={READ_TIME}
      intro="The rules for using Campus404 accounts, learning tracks, workspace tools, content, and platform services."
      sections={SECTIONS}
    />
  );
}
