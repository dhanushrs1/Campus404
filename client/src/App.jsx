import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AdminDashboardPage from "./backend/AdminDashboardPage.jsx";
import HomePage from "./frontend/pages/HomePage/HomePage.jsx";
import WorkspacePage from "./frontend/pages/WorkspacePage/WorkspacePage.jsx";
import TracksPage from "./frontend/pages/TracksPage/TracksPage.jsx";
import TrackOverviewPage from "./frontend/pages/TrackOverviewPage/TrackOverviewPage.jsx";
import TrackLeaderboardPage from "./frontend/pages/TrackLeaderboardPage/TrackLeaderboardPage.jsx";
import ContactPage from "./frontend/pages/ContactPage/ContactPage.jsx";
import LegalCenterPage from "./frontend/pages/LegalPage/LegalCenterPage.jsx";
import PrivacyPolicyPage from "./frontend/pages/LegalPage/PrivacyPolicyPage.jsx";
import TermsAndConditionsPage from "./frontend/pages/LegalPage/TermsAndConditionsPage.jsx";
import CookiePolicyPage from "./frontend/pages/LegalPage/CookiePolicyPage.jsx";
import AcceptableUsePolicyPage from "./frontend/pages/LegalPage/AcceptableUsePolicyPage.jsx";
import DataDeletionPage from "./frontend/pages/LegalPage/DataDeletionPage.jsx";
import SecurityPracticesPage from "./frontend/pages/LegalPage/SecurityPracticesPage.jsx";
import NotFoundPage from "./shared/404/NotFoundPage.jsx";
import FrontendDashboardPage from "./frontend/FrontendDashboardPage.jsx";
import FrontendLayout from "./frontend/layout/FrontendLayout.jsx";
import { APP_ROUTES } from "./routes/paths.js";
import { AlertProvider } from "./shared/Alert/AlertContext.jsx";
import { RequireAdmin, RequireAuth } from "./shared/RouteGuards.jsx";

const OAuthCallbackPage = lazy(() => import("./frontend/pages/OAuthCallbackPage/OAuthCallbackPage.jsx"));

function OAuthCallbackRoute() {
  return (
    <Suspense
      fallback={
        <div style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          color: "#14213d",
          background: "#f6f9ff",
          fontWeight: 700,
        }}>
          Signing you in...
        </div>
      }
    >
      <OAuthCallbackPage />
    </Suspense>
  );
}

export default function App() {
  return (
    <AlertProvider>
      <Routes>
        <Route path="/auth/callback" element={<OAuthCallbackRoute />} />

        {/* Workspace - fullscreen IDE, no header/footer */}
        <Route
          path={APP_ROUTES.frontendExerciseWorkspacePattern}
          element={(
            <RequireAuth>
              <WorkspacePage />
            </RequireAuth>
          )}
        />

        {/* Frontend Unified Layout wrapping user-facing pages */}
        <Route element={<FrontendLayout />}>
          <Route path={APP_ROUTES.home} element={<HomePage />} />

          <Route
            path={APP_ROUTES.frontendRoot}
            element={<Navigate to={APP_ROUTES.frontendTracks} replace />}
          />
          <Route
            path={APP_ROUTES.frontendDashboardLegacy}
            element={<Navigate to={APP_ROUTES.frontendDashboard} replace />}
          />
          <Route
            path={APP_ROUTES.frontendTracksLegacy}
            element={<Navigate to={APP_ROUTES.frontendTracks} replace />}
          />
          <Route
            path={APP_ROUTES.frontendWorkspaceLegacy}
            element={<Navigate to={APP_ROUTES.frontendTracks} replace />}
          />
          <Route
            path={APP_ROUTES.frontendWorkspaceRedirect}
            element={<Navigate to={APP_ROUTES.frontendTracks} replace />}
          />
          <Route
            path={APP_ROUTES.frontendDashboard}
            element={(
              <RequireAuth>
                <FrontendDashboardPage />
              </RequireAuth>
            )}
          />
          <Route
            path={APP_ROUTES.frontendTracks}
            element={<TracksPage />}
          />
          <Route
            path={APP_ROUTES.frontendTrackLeaderboardPattern}
            element={<TrackLeaderboardPage />}
          />
          <Route
            path={APP_ROUTES.frontendTrackOverviewPattern}
            element={(
              <RequireAuth>
                <TrackOverviewPage />
              </RequireAuth>
            )}
          />
          <Route path={APP_ROUTES.contactUs} element={<ContactPage />} />
          <Route
            path={APP_ROUTES.legalLegacy}
            element={<Navigate to={APP_ROUTES.legal} replace />}
          />
          <Route path={APP_ROUTES.legal} element={<LegalCenterPage />} />
          <Route path={APP_ROUTES.privacyPolicy} element={<PrivacyPolicyPage />} />
          <Route path={APP_ROUTES.termsAndConditions} element={<TermsAndConditionsPage />} />
          <Route path={APP_ROUTES.cookiePolicy} element={<CookiePolicyPage />} />
          <Route path={APP_ROUTES.acceptableUsePolicy} element={<AcceptableUsePolicyPage />} />
          <Route path={APP_ROUTES.dataDeletion} element={<DataDeletionPage />} />
          <Route path={APP_ROUTES.securityPractices} element={<SecurityPracticesPage />} />
        </Route>

        {/* Admin Panel remains isolated without global header/footer */}
        <Route
          path={APP_ROUTES.adminRoot}
          element={<Navigate to={APP_ROUTES.adminDashboardTab("overview")} replace />}
        />
        <Route
          path={APP_ROUTES.adminDashboard}
          element={(
            <RequireAdmin>
              <AdminDashboardPage />
            </RequireAdmin>
          )}
        />
        <Route
          path={APP_ROUTES.adminOverviewLegacy}
          element={<Navigate to={APP_ROUTES.adminDashboardTab("overview")} replace />}
        />
        <Route
          path={APP_ROUTES.adminTracksLegacy}
          element={<Navigate to={APP_ROUTES.adminDashboardTab("tracks")} replace />}
        />
        <Route
          path={APP_ROUTES.adminMediaLegacy}
          element={<Navigate to={APP_ROUTES.adminDashboardTab("media")} replace />}
        />
        <Route
          path={APP_ROUTES.adminUsersLegacy}
          element={<Navigate to={APP_ROUTES.adminDashboardTab("users")} replace />}
        />
        <Route
          path={APP_ROUTES.backendRootLegacy}
          element={<Navigate to={APP_ROUTES.adminDashboardTab("overview")} replace />}
        />
        <Route
          path={APP_ROUTES.backendDashboardLegacy}
          element={<Navigate to={APP_ROUTES.adminDashboardTab("overview")} replace />}
        />
        <Route path="/admin/*" element={<Navigate to={APP_ROUTES.adminDashboardTab("overview")} replace />} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AlertProvider>
  );
}
