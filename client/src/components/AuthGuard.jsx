import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

/**
 * AuthGuard component:
 * 1. If 'requireAuth' is true: redirects to /login if token is missing.
 * 2. If 'requireAuth' is false (for public pages like /login): redirects to /dashboard if token exists.
 * 3. Handles Admin role restriction if 'requireAdmin' is true.
 */
const AuthGuard = ({ children, requireAuth = true, requireAdmin = false }) => {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');
  const location = useLocation();

  if (requireAuth) {
    if (!token) {
      // Not logged in, redirect to login
      return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (requireAdmin && role !== 'admin') {
      // Logged in but not admin, redirect to user dashboard
      return <Navigate to="/dashboard" replace />;
    }

    return children;
  } else {
    // Only for public/auth pages (Login/Register/Forgot)
    if (token) {
      // Already logged in, redirect based on role
      if (role === 'admin') {
        return <Navigate to="/admin" replace />;
      }
      return <Navigate to="/dashboard" replace />;
    }

    return children;
  }
};

export default AuthGuard;
