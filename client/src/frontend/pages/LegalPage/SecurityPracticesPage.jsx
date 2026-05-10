import { APP_ROUTES } from "../../../routes/paths.js";
import { ASSETS } from "../../../shared/assets.js";
import LegalPolicyLayout from "./LegalPolicyLayout.jsx";
import "./LegalPage.css";

const READ_TIME = "4 min read";

const SECTIONS = [
  {
    title: "Security Overview",
    content: (
      <p>
        Campus404 uses role-based access controls, protected API endpoints, session
        validation, admin activity logging, and separated services for core platform
        functions. These practices reduce risk while supporting a practical learning
        environment.
      </p>
    ),
  },
  {
    title: "Authentication And Access",
    content: (
      <ul>
        <li>Protected learning pages require a valid authenticated session.</li>
        <li>Admin and editor functionality requires elevated role checks on both frontend routes and backend APIs.</li>
        <li>Sessions may be revoked or invalidated when account status, security state, or session version changes.</li>
      </ul>
    ),
  },
  {
    title: "Code Execution",
    content: (
      <p>
        Code evaluation is routed through backend-controlled services and hidden test
        cases. Execution services should be isolated from public networks and
        protected with resource limits, timeouts, and monitoring.
      </p>
    ),
  },
  {
    title: "Uploads And Media",
    content: (
      <p>
        Admin-managed uploads should pass authentication, file type checks, size
        limits, and storage controls. Private asset namespaces should not be publicly
        accessible.
      </p>
    ),
  },
  {
    title: "Reporting Issues",
    content: (
      <p>
        If you find a security issue, report it through the official contact channel
        configured for the production deployment. Include steps to reproduce, affected
        URLs, expected impact, and any safe proof of concept.
      </p>
    ),
  },
  {
    title: "Responsible Disclosure",
    content: (
      <ul>
        <li>Do not access, modify, delete, or expose other users' data.</li>
        <li>Do not run destructive tests, automated attacks, spam, or denial-of-service activity.</li>
        <li>Give the Campus404 team reasonable time to investigate and fix the issue before public disclosure.</li>
      </ul>
    ),
  },
];

export default function SecurityPracticesPage() {
  return (
    <LegalPolicyLayout
      title="Security Practices"
      description="Campus404 security practices for authentication, admin access, code execution, storage, and responsible reporting."
      pathname={APP_ROUTES.securityPractices}
      icon={ASSETS.icons.securityPractices}
      readTime={READ_TIME}
      intro="Campus404 safeguards for authentication, admin access, code execution, storage, and responsible issue reporting."
      sections={SECTIONS}
    />
  );
}
