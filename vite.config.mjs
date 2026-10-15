import { defineConfig } from "vite";

export default defineConfig({
  // Serve the SPA at "/" and let Express handle /api, /login, /register, etc.
  base: "/",

  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      // Forward these prefixes from :5173 to the Express server on :3000.
      "/api": { target: "http://localhost:3000", changeOrigin: false },
      "/login": { target: "http://localhost:3000", changeOrigin: false },
      "/register": { target: "http://localhost:3000", changeOrigin: false },
      "/logout": { target: "http://localhost:3000", changeOrigin: false },
      "/dashboard": { target: "http://localhost:3000", changeOrigin: false },
      "/health": { target: "http://localhost:3000", changeOrigin: false },
    },
  },

  build: {
    // Build into server/public/dist so Express can serve the SPA directly.
    outDir: "server/public/dist",
    emptyOutDir: true,
    // Keep the old "/data/*.json" assets around in case you want to fall back.
    assetsDir: "assets",
  },
});
