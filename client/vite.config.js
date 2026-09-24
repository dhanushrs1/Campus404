import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite configuration for a pure static frontend build.
// API calls should go through NGINX (/api/*) at runtime.
const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || "http://127.0.0.1:8000";
const backendProxy = {
  target: apiProxyTarget,
  changeOrigin: true,
};

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": backendProxy,
      "^/auth/(?!callback(?:/)?(?:\\?|$))": backendProxy,
      "/uploads": backendProxy,
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
  },
});
