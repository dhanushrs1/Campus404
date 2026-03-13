import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/authentication/login/Login';
import Register from './pages/authentication/register/Register';
import ForgotPassword from './pages/authentication/forgot-password/ForgotPassword';
import Dashboard from './pages/Dashboard';

import AdminLayout from './layouts/AdminLayout/AdminLayout';
import AdminDash from './pages/admin/dashboard/Dashboard';
import LabsManager from './pages/admin/labs-manager/LabsManager';
import UserManager from './pages/admin/user-manager/UserManager';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/dashboard" element={<Dashboard />} />
      
      {/* Admin routes with Layout wrapper */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminDash />} />
        <Route path="labs" element={<LabsManager />} />
        <Route path="users" element={<UserManager />} />
      </Route>
    </Routes>
  );
}

export default App;
