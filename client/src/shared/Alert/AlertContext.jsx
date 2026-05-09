import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle, XCircle, AlertCircle, Info, X } from "lucide-react";
import "./AlertContext.css";

const AlertContext = createContext(null);

export function AlertProvider({ children }) {
  const [alerts, setAlerts] = useState([]);

  const addAlert = useCallback((message, type = "success", duration = 4000) => {
    const id = Date.now().toString() + Math.random().toString();
    setAlerts((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        removeAlert(id);
      }, duration);
    }
  }, []);

  const removeAlert = useCallback((id) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== id));
  }, []);

  return (
    <AlertContext.Provider value={{ addAlert }}>
      {children}
      <div className="global-alert-container">
        {alerts.map((alert) => (
          <div key={alert.id} className={`global-alert global-alert--${alert.type}`}>
            <div className="global-alert-icon">
              {alert.type === "success" && <CheckCircle size={20} />}
              {alert.type === "error" && <XCircle size={20} />}
              {alert.type === "warning" && <AlertCircle size={20} />}
              {alert.type === "info" && <Info size={20} />}
            </div>
            <div className="global-alert-message">{alert.message}</div>
            <button
              type="button"
              className="global-alert-close"
              onClick={() => removeAlert(alert.id)}
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error("useAlert must be used within an AlertProvider");
  }
  return context;
}
