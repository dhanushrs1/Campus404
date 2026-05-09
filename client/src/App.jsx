import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AdminDashboardPage from "./backend/AdminDashboardPage.jsx";
import HomePage from "./frontend/pages/HomePage/HomePage.jsx";
import WorkspacePage from "./frontend/pages/WorkspacePage/WorkspacePage.jsx";
import TracksPage from "./frontend/pages/TracksPage/TracksPage.jsx";
import TrackOverviewPage from "./frontend/pages/TrackOverviewPage/TrackOverviewPage.jsx";
import TrackLeaderboardPage from "./frontend/pages/TrackLeaderboardPage/TrackLeaderboardPage.jsx";
import NotFoundPage from "./shared/404/NotFoundPage.jsx";
import FrontendDashboardPage from "./frontend/FrontendDashboardPage.jsx";
import FrontendLayout from "./frontend/layout/FrontendLayout.jsx";
import { APP_ROUTES } from "./routes/paths.js";
import { AlertProvider } from "./shared/Alert/AlertContext.jsx";

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
        <Route path={APP_ROUTES.frontendExerciseWorkspacePattern} element={<WorkspacePage />} />

        {/* Frontend Unified Layout wrapping user-facing pages */}
        <Route element={<FrontendLayout />}>
          <Route path={APP_ROUTES.home} element={<HomePage />} />

        <Route
          path={APP_ROUTES.frontendRoot}
          element={<Navigate to={APP_ROUTES.frontendDashboard} replace />}
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
        <Route path={APP_ROUTES.frontendDashboard} element={<FrontendDashboardPage />} />
        <Route path={APP_ROUTES.frontendTracks} element={<TracksPage />} />
        <Route path={APP_ROUTES.frontendTrackLeaderboardPattern} element={<TrackLeaderboardPage />} />
        <Route path={APP_ROUTES.frontendTrackOverviewPattern} element={<TrackOverviewPage />} />
      </Route>

      {/* Admin Panel remains isolated without global header/footer */}
      <Route
        path={APP_ROUTES.adminRoot}
        element={<Navigate to={APP_ROUTES.adminDashboardTab("overview")} replace />}
      />
      <Route
        path={APP_ROUTES.adminDashboard}
        element={<AdminDashboardPage />}
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
