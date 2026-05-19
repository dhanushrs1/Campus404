import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { APP_ROUTES } from "../routes/paths.js";
import { apiUrl } from "./api.js";
import {
  authenticatedFetch,
  clearAuthSession,
  ensureAuthSession,
  isElevatedRole,
  readAuthSession,
  syncAuthSession,
} from "./authSession.js";

function getReturnTo(location) {
  return `${location.pathname}${location.search}${location.hash}`;
}

function redirectState(location, reason = "auth-required") {
  return {
    authRequired: true,
    reason,
    from: getReturnTo(location),
  };
}

function AccessCheckScreen({ label = "Checking access..." }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        color: "#14213d",
        background: "#f6f9ff",
        fontWeight: 700,
      }}
    >
      {label}
    </div>
  );
}

export function RequireAuth({ children }) {
  const location = useLocation();
  const [status, setStatus] = useState(() => (
    readAuthSession().isAuthenticated ? "authorized" : "checking"
  ));

  useEffect(() => {
    let disposed = false;

    async function verifySession() {
      const session = await ensureAuthSession();
      if (disposed) return;
      setStatus(session.isAuthenticated ? "authorized" : "anonymous");
    }

    void verifySession();
    return () => {
      disposed = true;
    };
  }, [location.hash, location.pathname, location.search]);

  if (status === "checking") {
    return <AccessCheckScreen />;
  }

  if (status !== "authorized") {
    return <AuthRequiredScreen location={location} />;
  }

  return children;
}

function AuthRequiredScreen({ location }) {
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("campus404:open-auth-modal", {
        detail: { returnTo: getReturnTo(location), reason: "auth-required" },
      }),
    );
  }, [location]);

  return <AccessCheckScreen label="Sign in to continue..." />;
}

export function RequireAdmin({ children }) {
  const location = useLocation();
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    let disposed = false;
    setStatus("checking");

    async function verifyAdminSession() {
      try {
        const currentSession = await ensureAuthSession();

        if (disposed) return;

        if (!currentSession.isAuthenticated) {
          setStatus("anonymous");
          return;
        }

        const response = await authenticatedFetch(apiUrl("/auth/me"));

        if (disposed) return;

        if (response.status === 401) {
          clearAuthSession();
          setStatus("anonymous");
          return;
        }

        if (!response.ok) {
          setStatus("forbidden");
          return;
        }

        const user = await response.json();
        syncAuthSession(user);
        setStatus(isElevatedRole(user.role) ? "authorized" : "forbidden");
      } catch {
        if (!disposed) {
          setStatus("forbidden");
        }
      }
    }

    verifyAdminSession();

    return () => {
      disposed = true;
    };
  }, [location.hash, location.pathname, location.search]);

  if (status === "anonymous") {
    return (
      <Navigate
        to={APP_ROUTES.home}
        replace
        state={redirectState(location, "admin-auth-required")}
      />
    );
  }

  if (status === "forbidden") {
    return <Navigate to={APP_ROUTES.frontendDashboard} replace />;
  }

  if (status !== "authorized") {
    return <AccessCheckScreen label="Checking admin access..." />;
  }

  return children;
}
