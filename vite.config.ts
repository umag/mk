import { defineConfig } from "vite";

// Node global — declared locally because the frontend tsconfig sets `types: []`
// (no @types/node), and this file is type-checked by `npm run gate`.
declare const process: { env: Record<string, string | undefined> };

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    // proxy persistence calls to the Deno + SQLite API (no CORS in dev).
    // changeOrigin:false preserves the original Host (localhost:5173) so it matches
    // the browser Origin — otherwise the server's CSRF Origin check rejects writes.
    // MK_API_TARGET overrides the backend (used by the auth-browser e2e on its own ports).
    proxy: {
      "/api": { target: process.env.MK_API_TARGET ?? "http://localhost:8787", changeOrigin: false },
    },
  },
  build: { target: "es2022" },
});
