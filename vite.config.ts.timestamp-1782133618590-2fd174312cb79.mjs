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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9wcm9qZWN0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9wcm9qZWN0L3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3Byb2plY3Qvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZXN0L2NvbmZpZ1wiO1xuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdFwiO1xuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCwgVVJMIH0gZnJvbSBcIm5vZGU6dXJsXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtyZWFjdCgpXSxcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICBcIkBcIjogZmlsZVVSTFRvUGF0aChuZXcgVVJMKFwiLi9zcmNcIiwgaW1wb3J0Lm1ldGEudXJsKSksXG4gICAgfSxcbiAgfSxcbiAgc2VydmVyOiB7XG4gICAgcG9ydDogNTE3MyxcbiAgICBhbGxvd2VkSG9zdHM6IHRydWUsXG4gICAgcHJveHk6IHtcbiAgICAgIFwiL3YxXCI6IHtcbiAgICAgICAgdGFyZ2V0OiBcImh0dHA6Ly9sb2NhbGhvc3Q6MzAwMFwiLFxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICB9LFxuICAgICAgXCIvd2ViaG9va3NcIjoge1xuICAgICAgICB0YXJnZXQ6IFwiaHR0cDovL2xvY2FsaG9zdDozMDAwXCIsXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBcIi93c1wiOiB7XG4gICAgICAgIHRhcmdldDogXCJodHRwOi8vbG9jYWxob3N0OjMwMDBcIixcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICB3czogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbiAgYnVpbGQ6IHtcbiAgICBvdXREaXI6IFwiZGlzdFwiLFxuICAgIHNvdXJjZW1hcDogdHJ1ZSxcbiAgICB0YXJnZXQ6IFwiZXMyMDIwXCIsXG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgb3V0cHV0OiB7XG4gICAgICAgIG1hbnVhbENodW5rcyhpZCkge1xuICAgICAgICAgIC8vIEFwcC1vbmx5IHBhZ2VzIFx1MjAxNCBuZXZlciBsb2FkZWQgb24gdGhlIG1hcmtldGluZyBkb21haW4sIHNwbGl0IG91dFxuICAgICAgICAgIGlmIChcbiAgICAgICAgICAgIGlkLmluY2x1ZGVzKFwic3JjL3BhZ2VzL0Rhc2hib2FyZFwiKSB8fFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoXCJzcmMvcGFnZXMvQWdlbnRzXCIpIHx8XG4gICAgICAgICAgICBpZC5pbmNsdWRlcyhcInNyYy9wYWdlcy9DYW1wYWlnblwiKSB8fFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoXCJzcmMvcGFnZXMvQ2FsbHNcIikgfHxcbiAgICAgICAgICAgIGlkLmluY2x1ZGVzKFwic3JjL3BhZ2VzL0NvbnRhY3RzXCIpIHx8XG4gICAgICAgICAgICBpZC5pbmNsdWRlcyhcInNyYy9wYWdlcy9BbmFseXRpY3NcIikgfHxcbiAgICAgICAgICAgIGlkLmluY2x1ZGVzKFwic3JjL3BhZ2VzL0tub3dsZWRnZVwiKSB8fFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoXCJzcmMvcGFnZXMvTnVtYmVyc1wiKSB8fFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoXCJzcmMvcGFnZXMvQmlsbGluZ1wiKSB8fFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoXCJzcmMvcGFnZXMvU2V0dGluZ3NcIikgfHxcbiAgICAgICAgICAgIGlkLmluY2x1ZGVzKFwic3JjL3BhZ2VzL1ZvaWNlXCIpIHx8XG4gICAgICAgICAgICBpZC5pbmNsdWRlcyhcInNyYy9wYWdlcy9PdXRjb21lc1wiKSB8fFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoXCJzcmMvcGFnZXMvSW50ZWdyYXRpb25zXCIpIHx8XG4gICAgICAgICAgICBpZC5pbmNsdWRlcyhcInNyYy9wYWdlcy9PbmJvYXJkaW5nXCIpIHx8XG4gICAgICAgICAgICBpZC5pbmNsdWRlcyhcInNyYy9jb21wb25lbnRzL2xheW91dC9BcHBTaGVsbFwiKSB8fFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoXCJzcmMvYXBwcy9hZG1pblwiKVxuICAgICAgICAgICkge1xuICAgICAgICAgICAgcmV0dXJuIFwiYXBwXCI7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9yZWFjdC1kb21cIikpIHJldHVybiBcInJlYWN0LWRvbVwiO1xuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9Ac3VwYWJhc2VcIikpIHJldHVybiBcInN1cGFiYXNlXCI7XG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gIH0sXG4gIHRlc3Q6IHtcbiAgICBlbnZpcm9ubWVudDogXCJqc2RvbVwiLFxuICAgIHNldHVwRmlsZXM6IFwiLi9zcmMvc2V0dXBUZXN0cy50c1wiLFxuICAgIGdsb2JhbHM6IHRydWUsXG4gICAgaW5jbHVkZTogW1wic3JjLyoqLyoue3Rlc3Qsc3BlY30ue2pzLG1qcyxjanMsdHMsbXRzLGN0cyxqc3gsdHN4fVwiXSxcbiAgfSxcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUF5TixTQUFTLG9CQUFvQjtBQUN0UCxPQUFPLFdBQVc7QUFDbEIsU0FBUyxlQUFlLFdBQVc7QUFGK0YsSUFBTSwyQ0FBMkM7QUFJbkwsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUyxDQUFDLE1BQU0sQ0FBQztBQUFBLEVBQ2pCLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLEtBQUssY0FBYyxJQUFJLElBQUksU0FBUyx3Q0FBZSxDQUFDO0FBQUEsSUFDdEQ7QUFBQSxFQUNGO0FBQUEsRUFDQSxRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixjQUFjO0FBQUEsSUFDZCxPQUFPO0FBQUEsTUFDTCxPQUFPO0FBQUEsUUFDTCxRQUFRO0FBQUEsUUFDUixjQUFjO0FBQUEsTUFDaEI7QUFBQSxNQUNBLGFBQWE7QUFBQSxRQUNYLFFBQVE7QUFBQSxRQUNSLGNBQWM7QUFBQSxNQUNoQjtBQUFBLE1BQ0EsT0FBTztBQUFBLFFBQ0wsUUFBUTtBQUFBLFFBQ1IsY0FBYztBQUFBLFFBQ2QsSUFBSTtBQUFBLE1BQ047QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsT0FBTztBQUFBLElBQ0wsUUFBUTtBQUFBLElBQ1IsV0FBVztBQUFBLElBQ1gsUUFBUTtBQUFBLElBQ1IsZUFBZTtBQUFBLE1BQ2IsUUFBUTtBQUFBLFFBQ04sYUFBYSxJQUFJO0FBRWYsY0FDRSxHQUFHLFNBQVMscUJBQXFCLEtBQ2pDLEdBQUcsU0FBUyxrQkFBa0IsS0FDOUIsR0FBRyxTQUFTLG9CQUFvQixLQUNoQyxHQUFHLFNBQVMsaUJBQWlCLEtBQzdCLEdBQUcsU0FBUyxvQkFBb0IsS0FDaEMsR0FBRyxTQUFTLHFCQUFxQixLQUNqQyxHQUFHLFNBQVMscUJBQXFCLEtBQ2pDLEdBQUcsU0FBUyxtQkFBbUIsS0FDL0IsR0FBRyxTQUFTLG1CQUFtQixLQUMvQixHQUFHLFNBQVMsb0JBQW9CLEtBQ2hDLEdBQUcsU0FBUyxpQkFBaUIsS0FDN0IsR0FBRyxTQUFTLG9CQUFvQixLQUNoQyxHQUFHLFNBQVMsd0JBQXdCLEtBQ3BDLEdBQUcsU0FBUyxzQkFBc0IsS0FDbEMsR0FBRyxTQUFTLGdDQUFnQyxLQUM1QyxHQUFHLFNBQVMsZ0JBQWdCLEdBQzVCO0FBQ0EsbUJBQU87QUFBQSxVQUNUO0FBQ0EsY0FBSSxHQUFHLFNBQVMsd0JBQXdCLEVBQUcsUUFBTztBQUNsRCxjQUFJLEdBQUcsU0FBUyx3QkFBd0IsRUFBRyxRQUFPO0FBQUEsUUFDcEQ7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLE1BQU07QUFBQSxJQUNKLGFBQWE7QUFBQSxJQUNiLFlBQVk7QUFBQSxJQUNaLFNBQVM7QUFBQSxJQUNULFNBQVMsQ0FBQyxzREFBc0Q7QUFBQSxFQUNsRTtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
