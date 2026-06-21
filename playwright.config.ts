import { defineConfig, devices } from "@playwright/test";

// BDD-style end-to-end scenarios run against the live dev stack
// (Vite on :5173 proxying /api to the Deno+SQLite server on :8787).
export default defineConfig({
  testDir: "./e2e",
  timeout: 25_000,
  expect: { timeout: 6_000 },
  fullyParallel: false,
  workers: 1, // one shared Deno+SQLite server — tests must not mutate it concurrently
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5173",
    headless: true,
    viewport: { width: 1400, height: 860 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
