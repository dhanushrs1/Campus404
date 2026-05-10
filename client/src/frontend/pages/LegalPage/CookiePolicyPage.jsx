import { APP_ROUTES } from "../../../routes/paths.js";
import { ASSETS } from "../../../shared/assets.js";
import LegalPolicyLayout from "./LegalPolicyLayout.jsx";
import "./LegalPage.css";

const READ_TIME = "3 min read";

const SECTIONS = [
  {
    title: "Overview",
    content: (
      <p>
        Campus404 may use cookies, localStorage, sessionStorage, and similar browser
        technologies. These help the platform keep users signed in, remember profile
        display information, preserve learning state, support security, and operate
        the app.
      </p>
    ),
  },
  {
    title: "Types Of Storage We Use",
    content: (
      <ul>
        <li>Essential storage for authentication, session status, role checks, and protected-route access.</li>
        <li>Preference storage for avatar display, username display, local progress state, and interface behavior.</li>
        <li>Security and diagnostics data for abuse prevention, audit logging, and troubleshooting.</li>
        <li>Optional analytics or marketing storage only if enabled in a production deployment.</li>
      </ul>
    ),
  },
  {
    title: "Examples",
    content: (
      <p>
        The app may store values such as an access token, role, username, avatar URL,
        and completed exercise IDs in the browser. These values support the logged-in
        learning experience and should be cleared when a user logs out or when a
        session expires.
      </p>
    ),
  },
  {
    title: "Managing Cookies And Storage",
    content: (
      <ul>
        <li>You can clear cookies and local storage in your browser settings.</li>
        <li>Blocking essential storage may prevent sign-in, protected pages, progress tracking, or workspace features from working.</li>
        <li>If analytics or marketing tools are added later, provide users with any required consent or opt-out controls before enabling them.</li>
      </ul>
    ),
  },
];

export default function CookiePolicyPage() {
  return (
    <LegalPolicyLayout
      title="Cookie Policy"
      description="How Campus404 uses cookies and browser storage for sign-in, security, preferences, and learning features."
      pathname={APP_ROUTES.cookiePolicy}
      icon={ASSETS.icons.cookiePolicy}
      readTime={READ_TIME}
      intro="How cookies and browser storage support sign-in, preferences, progress, platform safety, and reliable learning features."
      sections={SECTIONS}
    />
  );
}
