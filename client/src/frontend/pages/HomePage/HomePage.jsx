import { Link } from "react-router-dom";
import { ArrowRight, Gamepad2 } from "lucide-react";
import { APP_ROUTES } from "../../../routes/paths.js";
import { ASSETS } from "../../../shared/assets.js";
import "./HomePage.css";

export default function HomePage() {
  return (
    <section className="homeHero">
      <div
        className="homeHero__stage"
        style={{
          "--hero-campus-image": `url(${ASSETS.campus.kvgCampus})`,
          "--hero-pixel-corner": `url(${ASSETS.decorations.pixelCorner})`,
        }}
      >
        <div className="homeHero__pixels" aria-hidden="true" />

        <div className="homeHero__content">
          <p className="homeHero__eyebrow">campus404 academy</p>

          <h1>
            <span className="homeHero__titleLine">Learn coding</span>
            <span className="homeHero__titleLine homeHero__titleAccent">
              by fixing
            </span>
            <span className="homeHero__titleLine homeHero__titleAccent">
              errors.
            </span>
          </h1>

          <p className="homeHero__copy">
            A beginner-first coding academy. Learn, practice, and build real
            projects in a campus built for coders. No fluff. Just skills that
            stick.
          </p>

          <div className="homeHero__actions" aria-label="Hero actions">
            <Link
              to={APP_ROUTES.frontendDashboard}
              className="homeHero__button homeHero__button--primary"
            >
              <span>Start Learning Free</span>
              <ArrowRight size={22} />
            </Link>

            <Link
              to={APP_ROUTES.frontendTracks}
              className="homeHero__button homeHero__button--secondary"
            >
              <span>Explore Tracks</span>
              <Gamepad2 size={20} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
