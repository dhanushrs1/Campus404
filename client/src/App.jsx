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

import LabForm        from './pages/admin/curriculum/LabForm';
import ModuleForm     from './pages/admin/curriculum/ModuleForm';
import ChallengeForm  from './pages/admin/curriculum/ChallengeForm';

import AuthGuard from './components/AuthGuard';

function App() {
  return (
    <Routes>
      <Route path="/" element={
        <AuthGuard requireAuth={false}>
          <Navigate to="/login" replace />
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
        <Route path="challenges/create"             element={<ChallengeForm />} />
        <Route path="challenges/:challengeId/edit"  element={<ChallengeForm />} />
        <Route path="users" element={<UserManager />} />
        <Route path="media" element={<MediaLibrary />} />
      </Route>
    </Routes>
  );
}

export default App;
