import { buildAppUrl } from "../../config/runtime.js";
import { APP_ROUTES } from "../../routes/paths.js";
import "./NotFoundPage.css";

export default function NotFoundPage() {
  return (
    <main className="notFoundPage">
      <section className="notFoundPage__panel">
        <p className="notFoundPage__code">404</p>
        <h1>Page Not Found</h1>
        <p>
          The slug you requested does not exist in the current route structure.
        </p>
        <a className="notFoundPage__link" href={buildAppUrl(APP_ROUTES.login)}>
          Go to Common Login
        </a>
      </section>
    </main>
  );
}