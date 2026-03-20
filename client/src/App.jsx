import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/authentication/login/Login';
import Register from './pages/authentication/register/Register';
import ForgotPassword from './pages/authentication/forgot-password/ForgotPassword';
import Dashboard from './pages/Dashboard';

import AdminLayout    from './layouts/AdminLayout/AdminLayout';
import AdminDash      from './pages/admin/dashboard/Dashboard';
import LabsManager    from './pages/admin/labs-manager/LabsManager';
import UserManager    from './pages/admin/user-manager/UserManager';
import MediaLibrary   from './pages/admin/media-library/MediaLibrary';
import BadgesManager  from './pages/admin/badges/BadgesManager';
import SystemLogs     from './pages/admin/system-logs/SystemLogs';
import Analytics      from './pages/admin/analytics/Analytics';
import Settings       from './pages/admin/settings/Settings';
import GuideManager   from './pages/admin/guide/GuideManager';
import GuideEditor    from './pages/admin/guide/GuideEditor';

import LabForm        from './pages/admin/curriculum/LabForm';
import ModuleForm     from './pages/admin/curriculum/ModuleForm';
import ChallengeForm  from './pages/admin/curriculum/ChallengeForm';
import ChallengeManager from './pages/admin/curriculum/ChallengeManager';
import ChallengeGroupForm from './pages/admin/curriculum/ChallengeGroupForm';
import LevelManager from './pages/admin/curriculum/LevelManager';

import AuthGuard from './components/AuthGuard';
import Workspace      from './pages/workspace/Workspace';
import LabCurriculum  from './pages/workspace/LabCurriculum';
import ModuleCurriculum from './pages/workspace/ModuleCurriculum';
import ChallengeLevels from './pages/workspace/ChallengeLevels';
import GuidePage from './pages/guide/GuidePage';

function App() {
  return (
    <Routes>
      <Route path="/" element={
        <AuthGuard requireAuth={false}>
          <Navigate to="/login" replace />
        </AuthGuard>
      } />

      {/* Workspace route with challenge context */}
      <Route path="/labs/:slug/modules/:moduleId/challenges/:challengeId/level/:levelNumber" element={
        <AuthGuard requireAuth={true}>
          <Workspace />
        </AuthGuard>
      } />

      {/* Legacy workspace route */}
      <Route path="/labs/:slug/modules/:moduleId/level/:levelNumber" element={
        <AuthGuard requireAuth={true}>
          <Workspace />
        </AuthGuard>
      } />

      {/* Slug route that opens the beautiful curriculum layout */}
      <Route path="/labs/:slug" element={
        <AuthGuard requireAuth={true}>
          <LabCurriculum />
        </AuthGuard>
      } />

      {/* Dynamic route that opens the specific gamified module path */}
      <Route path="/labs/:slug/modules/:moduleId" element={
        <AuthGuard requireAuth={true}>
          <ModuleCurriculum />
        </AuthGuard>
      } />

      <Route path="/labs/:slug/modules/:moduleId/challenges/:challengeId" element={
        <AuthGuard requireAuth={true}>
          <ChallengeLevels />
        </AuthGuard>
      } />

      <Route path="/labs" element={
        <AuthGuard requireAuth={true}>
          <Navigate to="/dashboard" replace />
        </AuthGuard>
      } />

      <Route path="/guide/:slug" element={
        <AuthGuard requireAuth={true}>
          <GuidePage />
        </AuthGuard>
      } />

      <Route path="/login" element={
        <AuthGuard requireAuth={false}>
          <Login />
        </AuthGuard>
      } />
      
      <Route path="/register" element={
        <AuthGuard requireAuth={false}>
          <Register />
        </AuthGuard>
      } />
      
      <Route path="/forgot-password" element={
        <AuthGuard requireAuth={false}>
          <ForgotPassword />
        </AuthGuard>
      } />

      <Route path="/dashboard" element={
        <AuthGuard requireAuth={true}>
          <Dashboard />
        </AuthGuard>
      } />
      
      {/* Admin routes with Layout wrapper */}
      <Route path="/admin" element={
        <AuthGuard requireAuth={true} requireAdmin={true}>
          <AdminLayout />
        </AuthGuard>
      }>
        <Route index element={<AdminDash />} />
        <Route path="labs"  element={<LabsManager />} />
        <Route path="labs/create"       element={<LabForm />} />
        <Route path="labs/:labId/edit"  element={<LabForm />} />
        <Route path="modules/create"         element={<ModuleForm />} />
        <Route path="modules/:moduleId/edit" element={<ModuleForm />} />
        <Route path="modules/:moduleId/challenges" element={<ChallengeManager />} />
        <Route path="challenge-groups/create" element={<ChallengeGroupForm />} />
        <Route path="challenge-groups/:challengeGroupId/edit" element={<ChallengeGroupForm />} />
        <Route path="challenges/:challengeId/levels" element={<LevelManager />} />
        <Route path="levels/create" element={<ChallengeForm />} />
        <Route path="levels/:levelId/edit" element={<ChallengeForm />} />
        <Route path="challenges/create"             element={<ChallengeForm />} />
        <Route path="challenges/:challengeId/edit"  element={<ChallengeForm />} />
        <Route path="users" element={<UserManager />} />
        <Route path="media" element={<MediaLibrary />} />
        <Route path="badges" element={<BadgesManager />} />
        <Route path="system-logs" element={<SystemLogs />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="settings" element={<Settings />} />
        <Route path="guide" element={<GuideManager />} />
        <Route path="guide/create" element={<GuideEditor />} />
        <Route path="guide/:postId/edit" element={<GuideEditor />} />
      </Route>
    </Routes>
  );
}

export default App;
