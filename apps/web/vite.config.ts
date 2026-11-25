// defineConfig (from vitest) types both the Vite settings and the test settings
import { defineConfig } from "vitest/config";
// The plugin that teaches Vite to understand React
import react from "@vitejs/plugin-react";

// Where the API runs during development (change with the VITE_API_TARGET setting if your API uses another port)
const apiTarget = process.env.VITE_API_TARGET ?? "http://localhost:5000";

// Vite settings
export default defineConfig({
  // Use the React plugin
  plugins: [react()],
  // The development server
  server: {
    // The web app opens at http://localhost:5173
    port: 5173,
    // PROXY: the browser talks only to this server, and Vite forwards these paths to the API.
    // Because the browser sees ONE address, there is no CORS problem and no API address hard-coded in the code.
    proxy: {
      // All REST calls start with /api
      "/api": apiTarget,
      // Real-time (Socket.IO) traffic; ws: true lets WebSocket connections pass through too
      "/socket.io": { target: apiTarget, ws: true },
    },
  },
  // Test settings (Vitest)
  test: {
    // Simulate a browser inside Node so React components can render in tests
    environment: "jsdom",
    // Runs before every test file
    setupFiles: ["src/test/setup.ts"],
  },
});
