import { Link } from "react-router-dom";
import { ArrowRight, Clock3, FileText } from "lucide-react";
import { APP_ROUTES } from "../../../routes/paths.js";
import { ASSETS } from "../../../shared/assets.js";
import Seo from "../../../shared/Seo.jsx";
import "./LegalPage.css";

const LEGAL_LINKS = [
  {
    title: "Privacy Policy",
    path: APP_ROUTES.privacyPolicy,
    icon: ASSETS.icons.privacyPolicy,
    readTime: "6 min read",
    summary: "How Campus404 collects, uses, protects, and manages account, OAuth, learning, and platform data.",
  },
  {
    title: "Terms and Conditions",
    path: APP_ROUTES.termsAndConditions,
    icon: ASSETS.icons.termsAndConditions,
    readTime: "5 min read",
    summary: "The rules for accounts, learning tracks, workspace features, content, and service use.",
  },
  {
    title: "Cookie Policy",
    path: APP_ROUTES.cookiePolicy,
    icon: ASSETS.icons.cookiePolicy,
    readTime: "3 min read",
    summary: "How cookies and browser storage support sign-in, preferences, progress, and security.",
  },
  {
    title: "Acceptable Use Policy",
    path: APP_ROUTES.acceptableUsePolicy,
    icon: ASSETS.icons.acceptableUsePolicy,
    readTime: "4 min read",
    summary: "Clear limits for abuse, attacks, harmful content, automation misuse, and workspace safety.",
  },
  {
    title: "Data Deletion",
    path: APP_ROUTES.dataDeletion,
    icon: ASSETS.icons.dataDeletion,
    readTime: "3 min read",
    summary: "How users can request deletion of account, OAuth profile, learning, and workspace records.",
  },
  {
    title: "Security Practices",
    path: APP_ROUTES.securityPractices,
    icon: ASSETS.icons.securityPractices,
    readTime: "4 min read",
    summary: "Campus404 safeguards for authentication, admin access, code execution, storage, and reporting.",
  },
];

export default function LegalCenterPage() {
  return (
    <main className="legalPage legalPage--centre">
      <Seo
        title="Legal Centre"
        description="Campus404 legal centre with privacy, terms, cookie, acceptable use, data deletion, and security policy pages."
        pathname={APP_ROUTES.legal}
      />

      <section className="legalPage__hero">
        <div className="legalPage__heroStage legalPage__heroStage--centre">
          <div className="legalPage__heroCopyBlock">
            <p className="legalPage__eyebrow">Legal Centre</p>
            <h1>Campus404 Policies</h1>
            <p className="legalPage__heroCopy">
              A calm place to review the public policies behind account access,
              privacy, platform rules, deletion requests, and security.
            </p>
            <div className="legalPage__heroStats" aria-label="Legal centre summary">
              <span>
                <FileText size={15} aria-hidden="true" />
                {LEGAL_LINKS.length} public pages
              </span>
              <span>
                <Clock3 size={15} aria-hidden="true" />
                Designed for quick reading
              </span>
            </div>
          </div>

          <div className="legalPage__heroArt" aria-hidden="true">
            <img src={ASSETS.icons.helpDesk} alt="" />
          </div>
        </div>
      </section>

      <section className="legalPage__shell legalPage__grid" aria-label="Legal pages">
        {LEGAL_LINKS.map((page) => (
          <Link key={page.title} to={page.path} className="legalPage__card">
            <span className="legalPage__cardIcon" aria-hidden="true">
              <img src={page.icon} alt="" />
            </span>
            <span className="legalPage__cardBody">
              <span className="legalPage__cardMeta">{page.readTime}</span>
              <span className="legalPage__cardTitle">{page.title}</span>
              <span className="legalPage__cardCopy">{page.summary}</span>
            </span>
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        ))}
      </section>
    </main>
  );
}
