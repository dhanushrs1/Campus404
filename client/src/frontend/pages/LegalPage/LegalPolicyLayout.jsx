import { Link } from "react-router-dom";
import { CalendarDays, ChevronRight, Clock3 } from "lucide-react";
import { APP_ROUTES } from "../../../routes/paths.js";
import Seo from "../../../shared/Seo.jsx";

export const LEGAL_LAST_UPDATED = "May 10, 2026";

export default function LegalPolicyLayout({
  title,
  description,
  pathname,
  icon,
  readTime,
  intro,
  sections,
  lastUpdated = LEGAL_LAST_UPDATED,
}) {
  return (
    <main className="legalPage legalPage--policy">
      <Seo title={title} description={description} pathname={pathname} />

      <section className="legalPage__hero">
        <div className="legalPage__heroStage legalPage__heroStage--policy">
          <div className="legalPage__heroCopyBlock">
            <nav className="legalPage__breadcrumb" aria-label="Breadcrumb">
              <Link to={APP_ROUTES.home}>Home</Link>
              <ChevronRight size={14} aria-hidden="true" />
              <Link to={APP_ROUTES.legal}>Legal Centre</Link>
            </nav>
            <p className="legalPage__eyebrow">Campus404 Legal</p>
            <h1>{title}</h1>
            <p className="legalPage__heroCopy">{intro}</p>
            <div className="legalPage__heroStats" aria-label="Policy metadata">
              <span>
                <CalendarDays size={15} aria-hidden="true" />
                Updated {lastUpdated}
              </span>
              <span>
                <Clock3 size={15} aria-hidden="true" />
                {readTime}
              </span>
            </div>
          </div>

          <div className="legalPage__heroArt legalPage__heroArt--policy" aria-hidden="true">
            <img src={icon} alt="" />
          </div>
        </div>
      </section>

      <section className="legalPage__readerShell">
        <article className="legalPage__article">
          {sections.map((section) => (
            <section key={section.title} className="legalPage__section">
              <h2>{section.title}</h2>
              {section.content}
            </section>
          ))}
        </article>
      </section>
    </main>
  );
}
