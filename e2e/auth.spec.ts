import { expect, request as pwRequest, test } from "@playwright/test";
import { type ChildProcess, spawn } from "node:child_process";

// Auth gate e2e. Spawns its OWN Deno API server with MK_AUTH_SECRET + MK_API_TOKEN
// on a dedicated port + throwaway DB, so it never collides with the ambient
// auth-disabled dev server the other specs use (workers:1, shared server). Asserts
// the HTTP contract directly via APIRequestContext — no browser/Vite needed.

const PORT = 8901;
const BASE = `http://localhost:${PORT}`;
const SECRET = "e2e-test-passphrase-1234";
const API_TOKEN = "e2e-api-token-abcdef";

let server: ChildProcess;

async function waitForHealth(timeoutMs = 15_000): Promise<void> {
  const ctx = await pwRequest.newContext();
  const deadline = Date.now() + timeoutMs;
  try {
    while (Date.now() < deadline) {
      try {
        const r = await ctx.get(`${BASE}/api/health`);
        if (r.ok()) return;
      } catch {
        // server not up yet
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error("auth server did not become healthy in time");
  } finally {
    await ctx.dispose();
  }
}

test.describe.serial("auth gate", () => {
  test.beforeAll(async () => {
    server = spawn(
      "deno",
      [
        "run",
        "--allow-net",
        "--allow-read",
        "--allow-write",
        "--allow-env",
        "--allow-ffi",
        "server/main.ts",
      ],
      {
        env: {
          ...process.env,
          MK_AUTH_SECRET: SECRET,
          MK_API_TOKEN: API_TOKEN,
          MK_PORT: String(PORT),
          MK_DB: `/tmp/mk-e2e-auth-${PORT}.db`,
          MK_INSECURE_COOKIES: "1", // allow the cookie over http in the test
        },
        stdio: "ignore",
      },
    );
    await waitForHealth();
  });

  test.afterAll(() => {
    server?.kill("SIGTERM");
  });

  test("GET /api/health is open without auth (allowlist + guard order)", async () => {
    const ctx = await pwRequest.newContext();
    expect((await ctx.get(`${BASE}/api/health`)).status()).toBe(200);
    await ctx.dispose();
  });

  test("an unauthenticated API call returns 401, not 500", async () => {
    const ctx = await pwRequest.newContext();
    const res = await ctx.get(`${BASE}/api/workspace`);
    expect(res.status()).toBe(401); // proves the guard RETURNS a Response (not throws -> 500)
    await ctx.dispose();
  });

  test("session status reports enabled + unauthed before login", async () => {
    const ctx = await pwRequest.newContext();
    expect(await (await ctx.get(`${BASE}/api/session`)).json()).toEqual({
      enabled: true,
      authed: false,
    });
    await ctx.dispose();
  });

  test("a wrong passphrase is rejected; the right one unlocks the API; logout re-locks it", async () => {
    const ctx = await pwRequest.newContext(); // persists cookies across requests
    expect(
      (await ctx.post(`${BASE}/api/session`, { data: { passphrase: "wrong" } }))
        .status(),
    ).toBe(401);

    const ok = await ctx.post(`${BASE}/api/session`, {
      data: { passphrase: SECRET },
    });
    expect(ok.status()).toBe(200);
    expect((await ctx.get(`${BASE}/api/workspace`)).status()).toBe(200);
    expect(await (await ctx.get(`${BASE}/api/session`)).json()).toMatchObject({
      authed: true,
    });

    expect((await ctx.delete(`${BASE}/api/session`)).status()).toBe(200);
    expect((await ctx.get(`${BASE}/api/workspace`)).status()).toBe(401);
    await ctx.dispose();
  });

  test("a cross-origin state-changing request is refused (CSRF belt)", async () => {
    const ctx = await pwRequest.newContext();
    await ctx.post(`${BASE}/api/session`, { data: { passphrase: SECRET } }); // authenticate (cookie)
    const res = await ctx.post(`${BASE}/api/ops`, {
      headers: { origin: "https://evil.example.com" },
      data: { ops: [] },
    });
    expect(res.status()).toBe(403);
    await ctx.dispose();
  });

  test("single active session — a second login revokes the first", async () => {
    const first = await pwRequest.newContext();
    await first.post(`${BASE}/api/session`, { data: { passphrase: SECRET } });
    expect((await first.get(`${BASE}/api/workspace`)).status()).toBe(200);

    const second = await pwRequest.newContext();
    await second.post(`${BASE}/api/session`, { data: { passphrase: SECRET } });
    expect((await second.get(`${BASE}/api/workspace`)).status()).toBe(200);

    // the first session's cookie is now revoked
    expect((await first.get(`${BASE}/api/workspace`)).status()).toBe(401);
    await first.dispose();
    await second.dispose();
  });

  test("a valid bearer token authenticates automation; a wrong one is rejected", async () => {
    const ctx = await pwRequest.newContext();
    expect(
      (await ctx.get(`${BASE}/api/workspace`, {
        headers: { authorization: `Bearer ${API_TOKEN}` },
      })).status(),
    ).toBe(200);
    expect(
      (await ctx.get(`${BASE}/api/workspace`, {
        headers: { authorization: "Bearer not-the-token" },
      })).status(),
    ).toBe(401);
    await ctx.dispose();
  });

  test("repeated bad logins lock out with a Retry-After hint", async () => {
    const ctx = await pwRequest.newContext();
    let res = await ctx.post(`${BASE}/api/session`, {
      data: { passphrase: "bad" },
    });
    for (let i = 0; i < 6 && res.status() !== 429; i++) {
      res = await ctx.post(`${BASE}/api/session`, {
        data: { passphrase: "bad" },
      });
    }
    expect(res.status()).toBe(429);
    expect((await res.json()).retryAfter).toBeGreaterThan(0);
    expect(Number(res.headers()["retry-after"])).toBeGreaterThan(0);
    await ctx.dispose();
  });
});
