import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { DiagnosticsErrorBoundary, installDiagnosticsReporter } from "./shared/diagnosticsReporter.jsx";
import "./styles/base.css";
import "./styles/pixel-buttons.css";
import "./styles/rounded-surfaces.css";

installDiagnosticsReporter();

// StrictMode helps reveal unsafe patterns early in development.
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <DiagnosticsErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </DiagnosticsErrorBoundary>
  </React.StrictMode>
);
