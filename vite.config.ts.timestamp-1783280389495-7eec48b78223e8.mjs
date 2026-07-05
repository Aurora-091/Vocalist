// vite.config.ts
import { defineConfig } from "file:///home/project/node_modules/vitest/dist/config.js";
import react from "file:///home/project/node_modules/@vitejs/plugin-react/dist/index.js";
import { fileURLToPath, URL } from "node:url";
var __vite_injected_original_import_meta_url = "file:///home/project/vite.config.ts";
var vite_config_default = defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", __vite_injected_original_import_meta_url))
    }
  },
  server: {
    port: 5173,
    allowedHosts: true,
    proxy: {
      "/v1": {
        target: "http://localhost:3000",
        changeOrigin: true
      },
      "/webhooks": {
        target: "http://localhost:3000",
        changeOrigin: true
      },
      "/ws": {
        target: "http://localhost:3000",
        changeOrigin: true,
        ws: true
      }
    }
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    target: "es2020",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("src/pages/Dashboard") || id.includes("src/pages/Agents") || id.includes("src/pages/Campaign") || id.includes("src/pages/Calls") || id.includes("src/pages/Contacts") || id.includes("src/pages/Analytics") || id.includes("src/pages/Knowledge") || id.includes("src/pages/Numbers") || id.includes("src/pages/Billing") || id.includes("src/pages/Settings") || id.includes("src/pages/Voice") || id.includes("src/pages/Outcomes") || id.includes("src/pages/Integrations") || id.includes("src/pages/Onboarding") || id.includes("src/components/layout/AppShell") || id.includes("src/apps/admin")) {
            return "app";
          }
          if (id.includes("node_modules/react-dom")) return "react-dom";
          if (id.includes("node_modules/@supabase")) return "supabase";
          if (id.includes("node_modules/posthog-js")) return "posthog";
        }
      }
    }
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/setupTests.ts",
    globals: true,
    include: ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"]
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9wcm9qZWN0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9wcm9qZWN0L3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3Byb2plY3Qvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZXN0L2NvbmZpZ1wiO1xuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdFwiO1xuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCwgVVJMIH0gZnJvbSBcIm5vZGU6dXJsXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtyZWFjdCgpXSxcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICBcIkBcIjogZmlsZVVSTFRvUGF0aChuZXcgVVJMKFwiLi9zcmNcIiwgaW1wb3J0Lm1ldGEudXJsKSksXG4gICAgfSxcbiAgfSxcbiAgc2VydmVyOiB7XG4gICAgcG9ydDogNTE3MyxcbiAgICBhbGxvd2VkSG9zdHM6IHRydWUsXG4gICAgcHJveHk6IHtcbiAgICAgIFwiL3YxXCI6IHtcbiAgICAgICAgdGFyZ2V0OiBcImh0dHA6Ly9sb2NhbGhvc3Q6MzAwMFwiLFxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICB9LFxuICAgICAgXCIvd2ViaG9va3NcIjoge1xuICAgICAgICB0YXJnZXQ6IFwiaHR0cDovL2xvY2FsaG9zdDozMDAwXCIsXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBcIi93c1wiOiB7XG4gICAgICAgIHRhcmdldDogXCJodHRwOi8vbG9jYWxob3N0OjMwMDBcIixcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICB3czogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbiAgYnVpbGQ6IHtcbiAgICBvdXREaXI6IFwiZGlzdFwiLFxuICAgIHNvdXJjZW1hcDogdHJ1ZSxcbiAgICB0YXJnZXQ6IFwiZXMyMDIwXCIsXG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgb3V0cHV0OiB7XG4gICAgICAgIG1hbnVhbENodW5rcyhpZCkge1xuICAgICAgICAgIC8vIEFwcC1vbmx5IHBhZ2VzIFx1MjAxNCBuZXZlciBsb2FkZWQgb24gdGhlIG1hcmtldGluZyBkb21haW4sIHNwbGl0IG91dFxuICAgICAgICAgIGlmIChcbiAgICAgICAgICAgIGlkLmluY2x1ZGVzKFwic3JjL3BhZ2VzL0Rhc2hib2FyZFwiKSB8fFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoXCJzcmMvcGFnZXMvQWdlbnRzXCIpIHx8XG4gICAgICAgICAgICBpZC5pbmNsdWRlcyhcInNyYy9wYWdlcy9DYW1wYWlnblwiKSB8fFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoXCJzcmMvcGFnZXMvQ2FsbHNcIikgfHxcbiAgICAgICAgICAgIGlkLmluY2x1ZGVzKFwic3JjL3BhZ2VzL0NvbnRhY3RzXCIpIHx8XG4gICAgICAgICAgICBpZC5pbmNsdWRlcyhcInNyYy9wYWdlcy9BbmFseXRpY3NcIikgfHxcbiAgICAgICAgICAgIGlkLmluY2x1ZGVzKFwic3JjL3BhZ2VzL0tub3dsZWRnZVwiKSB8fFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoXCJzcmMvcGFnZXMvTnVtYmVyc1wiKSB8fFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoXCJzcmMvcGFnZXMvQmlsbGluZ1wiKSB8fFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoXCJzcmMvcGFnZXMvU2V0dGluZ3NcIikgfHxcbiAgICAgICAgICAgIGlkLmluY2x1ZGVzKFwic3JjL3BhZ2VzL1ZvaWNlXCIpIHx8XG4gICAgICAgICAgICBpZC5pbmNsdWRlcyhcInNyYy9wYWdlcy9PdXRjb21lc1wiKSB8fFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoXCJzcmMvcGFnZXMvSW50ZWdyYXRpb25zXCIpIHx8XG4gICAgICAgICAgICBpZC5pbmNsdWRlcyhcInNyYy9wYWdlcy9PbmJvYXJkaW5nXCIpIHx8XG4gICAgICAgICAgICBpZC5pbmNsdWRlcyhcInNyYy9jb21wb25lbnRzL2xheW91dC9BcHBTaGVsbFwiKSB8fFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoXCJzcmMvYXBwcy9hZG1pblwiKVxuICAgICAgICAgICkge1xuICAgICAgICAgICAgcmV0dXJuIFwiYXBwXCI7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9yZWFjdC1kb21cIikpIHJldHVybiBcInJlYWN0LWRvbVwiO1xuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9Ac3VwYWJhc2VcIikpIHJldHVybiBcInN1cGFiYXNlXCI7XG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwibm9kZV9tb2R1bGVzL3Bvc3Rob2ctanNcIikpIHJldHVybiBcInBvc3Rob2dcIjtcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbiAgdGVzdDoge1xuICAgIGVudmlyb25tZW50OiBcImpzZG9tXCIsXG4gICAgc2V0dXBGaWxlczogXCIuL3NyYy9zZXR1cFRlc3RzLnRzXCIsXG4gICAgZ2xvYmFsczogdHJ1ZSxcbiAgICBpbmNsdWRlOiBbXCJzcmMvKiovKi57dGVzdCxzcGVjfS57anMsbWpzLGNqcyx0cyxtdHMsY3RzLGpzeCx0c3h9XCJdLFxuICB9LFxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXlOLFNBQVMsb0JBQW9CO0FBQ3RQLE9BQU8sV0FBVztBQUNsQixTQUFTLGVBQWUsV0FBVztBQUYrRixJQUFNLDJDQUEyQztBQUluTCxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsTUFBTSxDQUFDO0FBQUEsRUFDakIsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLE1BQ0wsS0FBSyxjQUFjLElBQUksSUFBSSxTQUFTLHdDQUFlLENBQUM7QUFBQSxJQUN0RDtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLGNBQWM7QUFBQSxJQUNkLE9BQU87QUFBQSxNQUNMLE9BQU87QUFBQSxRQUNMLFFBQVE7QUFBQSxRQUNSLGNBQWM7QUFBQSxNQUNoQjtBQUFBLE1BQ0EsYUFBYTtBQUFBLFFBQ1gsUUFBUTtBQUFBLFFBQ1IsY0FBYztBQUFBLE1BQ2hCO0FBQUEsTUFDQSxPQUFPO0FBQUEsUUFDTCxRQUFRO0FBQUEsUUFDUixjQUFjO0FBQUEsUUFDZCxJQUFJO0FBQUEsTUFDTjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCxRQUFRO0FBQUEsSUFDUixXQUFXO0FBQUEsSUFDWCxRQUFRO0FBQUEsSUFDUixlQUFlO0FBQUEsTUFDYixRQUFRO0FBQUEsUUFDTixhQUFhLElBQUk7QUFFZixjQUNFLEdBQUcsU0FBUyxxQkFBcUIsS0FDakMsR0FBRyxTQUFTLGtCQUFrQixLQUM5QixHQUFHLFNBQVMsb0JBQW9CLEtBQ2hDLEdBQUcsU0FBUyxpQkFBaUIsS0FDN0IsR0FBRyxTQUFTLG9CQUFvQixLQUNoQyxHQUFHLFNBQVMscUJBQXFCLEtBQ2pDLEdBQUcsU0FBUyxxQkFBcUIsS0FDakMsR0FBRyxTQUFTLG1CQUFtQixLQUMvQixHQUFHLFNBQVMsbUJBQW1CLEtBQy9CLEdBQUcsU0FBUyxvQkFBb0IsS0FDaEMsR0FBRyxTQUFTLGlCQUFpQixLQUM3QixHQUFHLFNBQVMsb0JBQW9CLEtBQ2hDLEdBQUcsU0FBUyx3QkFBd0IsS0FDcEMsR0FBRyxTQUFTLHNCQUFzQixLQUNsQyxHQUFHLFNBQVMsZ0NBQWdDLEtBQzVDLEdBQUcsU0FBUyxnQkFBZ0IsR0FDNUI7QUFDQSxtQkFBTztBQUFBLFVBQ1Q7QUFDQSxjQUFJLEdBQUcsU0FBUyx3QkFBd0IsRUFBRyxRQUFPO0FBQ2xELGNBQUksR0FBRyxTQUFTLHdCQUF3QixFQUFHLFFBQU87QUFDbEQsY0FBSSxHQUFHLFNBQVMseUJBQXlCLEVBQUcsUUFBTztBQUFBLFFBQ3JEO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxNQUFNO0FBQUEsSUFDSixhQUFhO0FBQUEsSUFDYixZQUFZO0FBQUEsSUFDWixTQUFTO0FBQUEsSUFDVCxTQUFTLENBQUMsc0RBQXNEO0FBQUEsRUFDbEU7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
