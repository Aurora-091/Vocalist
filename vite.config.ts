import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    allowedHosts: true,
    proxy: {
      "/v1": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/webhooks": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/ws": {
        target: "http://localhost:3000",
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    target: "es2020",
    rollupOptions: {
      output: {
        manualChunks(id) {
          // App-only pages — never loaded on the marketing domain, split out
          if (
            id.includes("src/pages/Dashboard") ||
            id.includes("src/pages/Agents") ||
            id.includes("src/pages/Campaign") ||
            id.includes("src/pages/Calls") ||
            id.includes("src/pages/Contacts") ||
            id.includes("src/pages/Analytics") ||
            id.includes("src/pages/Knowledge") ||
            id.includes("src/pages/Numbers") ||
            id.includes("src/pages/Billing") ||
            id.includes("src/pages/Settings") ||
            id.includes("src/pages/Voice") ||
            id.includes("src/pages/Outcomes") ||
            id.includes("src/pages/Integrations") ||
            id.includes("src/pages/Onboarding") ||
            id.includes("src/components/layout/AppShell") ||
            id.includes("src/apps/admin")
          ) {
            return "app";
          }
          if (id.includes("node_modules/react-dom")) return "react-dom";
          if (id.includes("node_modules/@supabase")) return "supabase";
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/setupTests.ts",
    globals: true,
    include: ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
  },
});
