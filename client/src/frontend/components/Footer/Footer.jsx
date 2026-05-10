import { Link } from "react-router-dom";
import {
  BookOpen,
  Camera,
  Code,
  Mail,
  MessageCircle,
  Network,
} from "lucide-react";
import { APP_ROUTES } from "../../../routes/paths.js";
import { ASSETS } from "../../../shared/assets.js";
import "./Footer.css";

const FOOTER_COLUMNS = [
  {
    title: "Platform",
    links: [
      { label: "Tracks", to: APP_ROUTES.frontendTracks },
      { label: "Practice", to: APP_ROUTES.frontendDashboard },
      { label: "Projects", to: APP_ROUTES.frontendDashboard },
      { label: "Pricing", to: APP_ROUTES.home },
    ],
  },
  {
    title: "Community",
    links: [
      { label: "Leaderboard", to: APP_ROUTES.frontendDashboard },
      { label: "Discussions", to: APP_ROUTES.home },
      { label: "Events", to: APP_ROUTES.home },
      { label: "Blog", to: APP_ROUTES.home },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Docs", to: APP_ROUTES.home },
      { label: "Guides", to: APP_ROUTES.home },
      { label: "FAQs", to: APP_ROUTES.home },
      { label: "Status", to: APP_ROUTES.home },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Legal Centre", to: APP_ROUTES.legal },
      { label: "Privacy Policy", to: APP_ROUTES.privacyPolicy },
      { label: "Terms", to: APP_ROUTES.termsAndConditions },
      { label: "Cookie Policy", to: APP_ROUTES.cookiePolicy },
      { label: "Acceptable Use", to: APP_ROUTES.acceptableUsePolicy },
      { label: "Data Deletion", to: APP_ROUTES.dataDeletion },
      { label: "Security", to: APP_ROUTES.securityPractices },
    ],
  },
];

const SOCIAL_LINKS = [
  { label: "Community", href: "#", icon: MessageCircle },
  { label: "GitHub", href: "#", icon: Code },
  { label: "Instagram", href: "#", icon: Camera },
  { label: "LinkedIn", href: "#", icon: Network },
];

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer__inner">
        <section className="footerMain" aria-label="Footer navigation">
          <div className="footerBrand">
            <Link
              to={APP_ROUTES.home}
              className="footerBrand__mark"
              aria-label="Campus404 home"
            >
              <img src={ASSETS.brand.logo} alt="" />
            </Link>

            <p>Learn. Fix. Build. Repeat.</p>

            <div className="footerSocials" aria-label="Social links">
              {SOCIAL_LINKS.map(({ label, href, icon: Icon }) => (
                <a key={label} href={href} aria-label={label}>
                  <Icon size={24} />
                </a>
              ))}
            </div>
          </div>

          <nav className="footerLinks" aria-label="Footer links">
            {FOOTER_COLUMNS.map((column) => (
              <div key={column.title} className="footerLinks__column">
                <h3>{column.title}</h3>
                <ul>
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <Link to={link.to}>{link.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <form className="footerLoop" onSubmit={(event) => event.preventDefault()}>
            <div className="footerLoop__head">
              <Mail size={34} />
              <div>
                <h3>Stay in the Loop</h3>
                <p>Get tips, updates, and new content directly to your inbox.</p>
              </div>
            </div>

            <div className="footerLoop__form">
              <label className="footerLoop__label" htmlFor="footer-email">
                Email address
              </label>
              <input id="footer-email" type="email" placeholder="you@example.com" />
              <button type="submit">
                <BookOpen size={18} />
                <span>Subscribe</span>
              </button>
            </div>
          </form>
        </section>

        <div className="footerBottom">
          <p>&copy; {new Date().getFullYear()} Campus404. All rights reserved.</p>

          <nav aria-label="Legal links">
            <Link to={APP_ROUTES.privacyPolicy}>Privacy</Link>
            <Link to={APP_ROUTES.termsAndConditions}>Terms</Link>
            <Link to={APP_ROUTES.cookiePolicy}>Cookies</Link>
            <Link to={APP_ROUTES.securityPractices}>Security</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
