import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    // proxy persistence calls to the Deno + SQLite API (no CORS in dev)
    proxy: {
      "/api": { target: "http://localhost:8787", changeOrigin: true },
    },
  },
  build: { target: "es2022" },
});
