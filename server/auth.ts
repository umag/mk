import type { DatabaseSync } from "node:sqlite";
import {
  type AttemptState,
  checkLockout,
  clientIpFromHeaders,
  DEFAULT_LOCKOUT,
  hashPassphrase,
  isAuthEnabled,
  parseCookieHeader,
  recordFailure,
  serializeSetCookie,
  sha256Base64url,
  validateSecretStrength,
  verifyApiToken,
  verifyPassphrase,
} from "../src/auth.ts";
import { createSessionStore } from "./sessions.ts";

// Server-side auth glue: reads env, holds the stateful per-IP lockout map, and
// produces Response objects for the guard + /api/session routes. The guard NEVER
// throws (server/main.ts maps thrown errors to 500, which would turn 401s into
// 500s) — it always returns a Response (deny) or null (proceed).
//
// Browser auth = httpOnly+Secure+SameSite=Strict session cookie (POST /api/session).
// Automation auth = Authorization: Bearer <MK_API_TOKEN>. Auth is OFF when
// MK_AUTH_SECRET is unset, but a production server (MK_STATIC) refuses to start
// unauthenticated.

export const COOKIE_NAME = "mk_session";

export interface AuthContext {
  refreshCookie: string | null;
}

export type Auth = Awaited<ReturnType<typeof createAuth>>;

const json = (
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

function clientIp(req: Request, proxyDepth: number): string {
  return clientIpFromHeaders(
    req.headers.get("x-forwarded-for"),
    req.headers.get("x-real-ip"),
    proxyDepth,
  ) ?? "unknown";
}

/** Secure cookies require HTTPS; drop Secure only for plain-http localhost dev. */
function cookieSecure(req: Request): boolean {
  if (Deno.env.get("MK_INSECURE_COOKIES") === "1") return false;
  if ((req.headers.get("x-forwarded-proto") ?? "").includes("https")) {
    return true;
  }
  const host = (req.headers.get("host") ?? "").split(":")[0];
  return !(host === "localhost" || host === "127.0.0.1" || host === "::1");
}

/** True when the request carries an Origin from a different host (CSRF signal).
 *  Compares against the proxy-forwarded host (X-Forwarded-Host) when present, else
 *  Host — so it holds both same-origin (prod) and behind a reverse proxy. */
function crossOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false; // same-origin fetches and non-browser clients omit Origin
  const target = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  try {
    return new URL(origin).host !== target;
  } catch {
    return true;
  }
}

export async function createAuth(db: DatabaseSync) {
  const secret = Deno.env.get("MK_AUTH_SECRET");
  const apiToken = Deno.env.get("MK_API_TOKEN");
  // Trusted reverse-proxy hops for client-IP extraction. 0 = no proxy (direct
  // exposure) → forwarding headers are NOT trusted; default 1 (single proxy, e.g. Traefik).
  const rawDepth = Deno.env.get("MK_PROXY_DEPTH");
  const proxyDepth = rawDepth === undefined
    ? 1
    : Math.max(0, Number(rawDepth) || 0);
  const isProd = !!Deno.env.get("MK_STATIC");
  const enabled = isAuthEnabled(secret);

  if (isProd && !enabled) {
    console.error(
      "FATAL: MK_AUTH_SECRET is not set but MK_STATIC indicates production. Refusing to serve an UNAUTHENTICATED public server. Set MK_AUTH_SECRET (>= 16 chars), or drop MK_STATIC for local dev.",
    );
    Deno.exit(1);
  }
  if (enabled) {
    const strength = validateSecretStrength(secret!);
    if (!strength.ok) {
      console.error(`FATAL: MK_AUTH_SECRET is too weak: ${strength.reason}`);
      Deno.exit(1);
    }
  }

  // Derive secret material once at boot; never keep/print the raw values.
  const secretHash = enabled ? await hashPassphrase(secret!) : "";
  const apiTokenHash = apiToken ? await sha256Base64url(apiToken) : "";
  const sessions = createSessionStore(db);
  const attempts = new Map<string, AttemptState>();

  console.log(
    enabled
      ? `auth: ENABLED (cookie session + ${
        apiTokenHash ? "bearer token" : "no API token"
      })`
      : "auth: DISABLED (MK_AUTH_SECRET unset) — single-user/localhost only, DO NOT expose publicly",
  );

  function lockedResponse(retryAfterMs: number): Response {
    const retryAfter = Math.ceil(retryAfterMs / 1000);
    return json({ error: "too many attempts", retryAfter }, 429, {
      "retry-after": String(retryAfter),
    });
  }

  function setSessionCookie(
    req: Request,
    token: string,
    expiresAt: number,
    now: number,
  ): string {
    return serializeSetCookie(COOKIE_NAME, token, {
      maxAgeSeconds: Math.floor((expiresAt - now) / 1000),
      secure: cookieSecure(req),
    });
  }

  return {
    enabled,
    proxyDepth,

    /** Gate a non-allowlisted request. Returns a Response to deny, or null to
     *  proceed (and sets ctx.refreshCookie when a sliding session is renewed). */
    async guard(req: Request, ctx: AuthContext): Promise<Response | null> {
      if (!enabled) return null;

      // CSRF belt (SameSite=Strict already blocks cross-site cookies): refuse a
      // state-changing request whose Origin host differs from the target host.
      const m = req.method;
      if (m !== "GET" && m !== "HEAD" && m !== "OPTIONS" && crossOrigin(req)) {
        return json({ error: "cross-origin request refused" }, 403);
      }

      const authz = req.headers.get("authorization") ?? "";
      if (authz.startsWith("Bearer ")) {
        if (
          apiTokenHash &&
          (await verifyApiToken(authz.slice(7).trim(), apiTokenHash))
        ) return null;
        return json({ error: "unauthorized" }, 401);
      }

      const now = Date.now();
      const token = parseCookieHeader(req.headers.get("cookie"))[COOKIE_NAME] ??
        "";
      const res = await sessions.verify(token, now);
      if (res.valid) {
        if (res.refreshedExpiresAt) {
          ctx.refreshCookie = setSessionCookie(
            req,
            token,
            res.refreshedExpiresAt,
            now,
          );
        }
        return null;
      }
      return json({ error: "unauthorized" }, 401);
    },

    /** POST /api/session — passphrase login. Open, but per-IP rate-limited. */
    async login(req: Request): Promise<Response> {
      if (!enabled) return json({ error: "auth disabled" }, 400);
      if (crossOrigin(req)) {
        return json({ error: "cross-origin request refused" }, 403);
      }
      if (
        !(req.headers.get("content-type") ?? "").includes("application/json")
      ) {
        return json({ error: "content-type must be application/json" }, 415);
      }
      // Slurp + cap the body (chunked-safe — don't trust Content-Length).
      const raw = await req.text();
      if (raw.length > 4096) return json({ error: "payload too large" }, 413);
      const ip = clientIp(req, proxyDepth);
      const now = Date.now();
      const pre = checkLockout(attempts.get(ip), now, DEFAULT_LOCKOUT);
      if (!pre.allowed) return lockedResponse(pre.retryAfterMs);

      let passphrase = "";
      try {
        const body = JSON.parse(raw);
        if (typeof body?.passphrase === "string") passphrase = body.passphrase;
      } catch {
        // fall through — empty passphrase fails verification
      }
      // Never run the expensive PBKDF2 on an oversized body (pre-auth DoS guard).
      if (passphrase.length > 1024) passphrase = "";

      if (!(await verifyPassphrase(passphrase, secretHash))) {
        const st = recordFailure(attempts.get(ip), now, DEFAULT_LOCKOUT);
        attempts.set(ip, st);
        const post = checkLockout(st, now, DEFAULT_LOCKOUT);
        return post.allowed
          ? json({ error: "invalid passphrase" }, 401)
          : lockedResponse(post.retryAfterMs);
      }

      attempts.delete(ip); // success clears the failure history
      const { token, expiresAt } = await sessions.create(now);
      return json({ ok: true }, 200, {
        "set-cookie": setSessionCookie(req, token, expiresAt, now),
      });
    },

    /** DELETE /api/session — logout (revokes the server session + clears cookie). */
    async logout(req: Request): Promise<Response> {
      if (crossOrigin(req)) {
        return json({ error: "cross-origin request refused" }, 403);
      }
      const token = parseCookieHeader(req.headers.get("cookie"))[COOKIE_NAME] ??
        "";
      await sessions.destroy(token);
      const clear = serializeSetCookie(COOKIE_NAME, "", {
        maxAgeSeconds: 0,
        secure: cookieSecure(req),
      });
      return json({ ok: true }, 200, { "set-cookie": clear });
    },

    /** GET /api/session — boot probe: {enabled:false} | {enabled:true, authed}. */
    async status(req: Request): Promise<Response> {
      if (!enabled) return json({ enabled: false });
      const token = parseCookieHeader(req.headers.get("cookie"))[COOKIE_NAME] ??
        "";
      const authed = token
        ? (await sessions.verify(token, Date.now())).valid
        : false;
      return json({ enabled: true, authed });
    },

    /** Hourly housekeeping — drop expired sessions. */
    pruneSessions(now: number): number {
      return sessions.prune(now);
    },
  };
}
