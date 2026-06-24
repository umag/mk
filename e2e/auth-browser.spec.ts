import { expect, test } from "@playwright/test";
import { type ChildProcess, spawn } from "node:child_process";

// Browser-level login through the REAL Vite dev proxy. Regression guard for the
// CSRF-vs-proxy bug: with `changeOrigin:true` the proxy rewrote Host→backend while
// the browser Origin stayed :5902, so the server's Origin check 403'd login. This
// spins up its OWN auth-enabled Deno server + a Vite dev server (proxy aimed at it
// via MK_API_TARGET) on dedicated ports, then drives a real browser through login.

const API_PORT = 8902;
const WEB_PORT = 5902;
const BASE = `http://localhost:${WEB_PORT}`;
const SECRET = "browser-e2e-passphrase";

let api: ChildProcess;
let web: ChildProcess;

async function waitFor(url: string, timeoutMs = 40_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url);
      if (r.ok || r.status === 404) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`timed out waiting for ${url}`);
}

test.describe.serial("auth gate — browser via Vite proxy", () => {
  test.beforeAll(async () => {
    api = spawn(
      "deno",
      ["run", "--allow-net", "--allow-read", "--allow-write", "--allow-env", "--allow-ffi", "server/main.ts"],
      {
        env: {
          ...process.env,
          MK_AUTH_SECRET: SECRET,
          MK_PORT: String(API_PORT),
          MK_DB: `/tmp/mk-e2e-browser-${API_PORT}.db`,
          MK_INSECURE_COOKIES: "1",
        },
        stdio: "ignore",
      },
    );
    web = spawn("npx", ["vite", "--port", String(WEB_PORT), "--strictPort"], {
      env: { ...process.env, MK_API_TARGET: `http://localhost:${API_PORT}` },
      stdio: "ignore",
    });
    await waitFor(`http://localhost:${API_PORT}/api/health`);
    await waitFor(BASE);
  });

  test.afterAll(() => {
    api?.kill("SIGTERM");
    web?.kill("SIGTERM");
  });

  test("login through the dev proxy works end-to-end in a real browser", async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByTestId("login-overlay")).toBeVisible({ timeout: 20_000 });

    // Wrong passphrase → inline error (the POST traverses the Vite proxy).
    await page.getByTestId("login-input").fill("not-the-passphrase");
    await page.getByTestId("login-submit").click();
    await expect(page.getByTestId("login-error")).toHaveText(/incorrect/i);

    // Correct passphrase → gate clears and the app comes online. This is the
    // regression guard: the proxied POST /api/session must NOT 403 on an
    // Origin/Host mismatch introduced by the proxy.
    await page.getByTestId("login-input").fill(SECRET);
    await page.getByTestId("login-submit").click();
    await expect(page.getByTestId("login-overlay")).toHaveCount(0);
    await expect(page.locator(".sync-dot.online")).toBeVisible({ timeout: 15_000 });

    const cookie = (await page.context().cookies()).find((c) => c.name === "mk_session");
    expect(cookie?.httpOnly).toBe(true);

    // Log out via the avatar → "Log out" menu item → gate returns, cookie cleared.
    await page.getByTestId("account-button").click();
    await page.getByTestId("menu-item-log-out").click();
    await expect(page.getByTestId("login-overlay")).toBeVisible({ timeout: 10_000 });
    const after = (await page.context().cookies()).find((c) => c.name === "mk_session");
    expect(after?.value ?? "").toBe(""); // cleared (Max-Age=0) — gone or empty
  });
});
