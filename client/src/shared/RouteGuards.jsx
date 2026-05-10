import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { APP_ROUTES } from "../routes/paths.js";
import { apiUrl } from "./api.js";
import {
  clearAuthSession,
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
  const session = readAuthSession();

  useEffect(() => {
    if (!session.isAuthenticated && session.token) {
      clearAuthSession();
    }
  }, [session.isAuthenticated, session.token]);

  if (!session.isAuthenticated) {
    return (
      <Navigate
        to={APP_ROUTES.home}
        replace
        state={redirectState(location)}
      />
    );
  }

  return children;
}

export function RequireAdmin({ children }) {
  const location = useLocation();
  const session = readAuthSession();
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    const currentSession = readAuthSession();

    if (!currentSession.isAuthenticated) {
      if (currentSession.token) {
        clearAuthSession();
      }
      setStatus("anonymous");
      return undefined;
    }

    if (!isElevatedRole(currentSession.role)) {
      setStatus("forbidden");
      return undefined;
    }

    let disposed = false;
    setStatus("checking");

    async function verifyAdminSession() {
      try {
        const response = await fetch(apiUrl("/auth/me"), {
          headers: {
            Authorization: `Bearer ${currentSession.token}`,
          },
        });

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
  }, [session.token]);

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
