import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite configuration for a pure static frontend build.
// API calls should go through NGINX (/api/*) at runtime.
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
  },
});
