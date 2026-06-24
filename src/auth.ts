// Pure, cross-runtime auth primitives — Web Crypto only, no clock and no mutable
// module state. Shared by the Deno server (server/auth.ts wires these to env +
// a sessions table + the request guard) and unit-testable under vitest, exactly
// as src/core/state.ts is shared between client and server. Anything stateful
// (the per-IP lockout map) or runtime-specific (Deno.env) lives in server/auth.ts.
//
// This is the Access context — deliberately separate from the Kanban domain in
// src/core/ (boards/cards/ops). It shares no data model with it.

// ── tunables ────────────────────────────────────────────────────────────────
export const PBKDF2_ITERATIONS = 600_000; // OWASP floor for PBKDF2-HMAC-SHA256
export const MIN_SECRET_LENGTH = 16;
const SALT_BYTES = 16; // 128-bit salt
const TOKEN_BYTES = 32; // 256-bit session token
const MAX_COOKIE_SECONDS = 400 * 24 * 3600; // browsers cap cookie lifetime at ~400 days

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

// ── base64url ─────────────────────────────────────────────────────────────────
function bytesToBase64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") +
    "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Hand Web Crypto a plain ArrayBuffer — sidesteps the TS5.7 ArrayBufferLike vs
 *  BufferSource generic mismatch without copying when the view spans its buffer. */
function ab(u: Uint8Array): ArrayBuffer {
  return u.byteOffset === 0 && u.byteLength === u.buffer.byteLength
    ? (u.buffer as ArrayBuffer)
    : (u.buffer.slice(
      u.byteOffset,
      u.byteOffset + u.byteLength,
    ) as ArrayBuffer);
}

const utf8 = (s: string): ArrayBuffer => ab(new TextEncoder().encode(s));

// ── constant-time compare (functional; timing-safety verified by review) ──────
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false; // length of fixed-size digests isn't secret
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ── hashing ───────────────────────────────────────────────────────────────────
export async function sha256Base64url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", utf8(input));
  return bytesToBase64url(new Uint8Array(digest));
}

async function pbkdf2(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    utf8(passphrase),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: ab(salt), iterations, hash: "SHA-256" },
    key,
    256,
  );
  return new Uint8Array(bits);
}

/** Hash a passphrase -> "pbkdf2-sha256$<iters>$<saltB64url>$<hashB64url>". */
export async function hashPassphrase(
  passphrase: string,
  salt?: Uint8Array,
  iterations = PBKDF2_ITERATIONS,
): Promise<string> {
  const s = salt ?? crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await pbkdf2(passphrase, s, iterations);
  return `pbkdf2-sha256$${iterations}$${bytesToBase64url(s)}$${
    bytesToBase64url(hash)
  }`;
}

/** Verify a passphrase against a stored hash. Never throws; bad input -> false. */
export async function verifyPassphrase(
  passphrase: string,
  stored: string,
): Promise<boolean> {
  try {
    const parts = stored.split("$");
    if (parts.length !== 4 || parts[0] !== "pbkdf2-sha256") return false;
    const iterations = Number(parts[1]);
    if (!Number.isInteger(iterations) || iterations <= 0) return false;
    const salt = base64urlToBytes(parts[2]);
    const hash = await pbkdf2(passphrase, salt, iterations);
    return constantTimeEqual(bytesToBase64url(hash), parts[3]);
  } catch {
    return false;
  }
}

// ── session / API tokens ──────────────────────────────────────────────────────
/** A 256-bit random token, base64url (43 chars). Stored hashed via sha256Base64url. */
export function generateSessionToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return bytesToBase64url(bytes);
}

/** Verify a presented bearer token against its stored SHA-256 digest. */
export async function verifyApiToken(
  presented: string,
  expectedSha256B64url: string,
): Promise<boolean> {
  if (!presented) return false;
  return constantTimeEqual(
    await sha256Base64url(presented),
    expectedSha256B64url,
  );
}

// ── cookie codec ──────────────────────────────────────────────────────────────
export interface CookieOptions {
  maxAgeSeconds: number;
  secure: boolean; // false only for http localhost dev
  httpOnly?: boolean; // default true
  sameSite?: "Strict" | "Lax" | "None"; // default Strict
  path?: string; // default "/"
}

export function serializeSetCookie(
  name: string,
  value: string,
  opts: CookieOptions,
): string {
  const maxAge = Math.max(
    0,
    Math.min(Math.floor(opts.maxAgeSeconds), MAX_COOKIE_SECONDS),
  );
  const parts = [
    `${name}=${value}`,
    `Path=${opts.path ?? "/"}`,
    `Max-Age=${maxAge}`,
    `SameSite=${opts.sameSite ?? "Strict"}`,
  ];
  if (opts.httpOnly ?? true) parts.push("HttpOnly");
  if (opts.secure) parts.push("Secure");
  return parts.join("; ");
}

export function parseCookieHeader(
  header: string | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (k) out[k] = part.slice(i + 1).trim();
  }
  return out;
}

// ── lockout policy (pure; sliding window, caller passes `now`) ─────────────────
export interface LockoutConfig {
  maxFailures: number;
  windowMs: number;
  lockMs: number;
}
export const DEFAULT_LOCKOUT: LockoutConfig = {
  maxFailures: 5,
  windowMs: 15 * MINUTE,
  lockMs: 15 * MINUTE,
};

/** Failure timestamps within the window + the active lock expiry. Serializable. */
export interface AttemptState {
  failures: number[];
  lockedUntil: number;
}

export function checkLockout(
  state: AttemptState | undefined,
  now: number,
  cfg: LockoutConfig = DEFAULT_LOCKOUT,
): { allowed: boolean; retryAfterMs: number } {
  if (!state) return { allowed: true, retryAfterMs: 0 };
  if (state.lockedUntil > now) {
    return { allowed: false, retryAfterMs: state.lockedUntil - now };
  }
  const recent = state.failures.filter((t) => t > now - cfg.windowMs);
  if (recent.length >= cfg.maxFailures) {
    return { allowed: false, retryAfterMs: cfg.lockMs };
  }
  return { allowed: true, retryAfterMs: 0 };
}

export function recordFailure(
  state: AttemptState | undefined,
  now: number,
  cfg: LockoutConfig = DEFAULT_LOCKOUT,
): AttemptState {
  const failures = [
    ...(state?.failures.filter((t) => t > now - cfg.windowMs) ?? []),
    now,
  ];
  const lockedUntil = failures.length >= cfg.maxFailures
    ? now + cfg.lockMs
    : (state?.lockedUntil ?? 0);
  return { failures, lockedUntil };
}

export function recordSuccess(_state?: AttemptState): undefined {
  return undefined; // clear all attempt history on a successful login
}

// ── sliding session expiry (pure) ─────────────────────────────────────────────
export interface SlideConfig {
  ttlMs: number;
  debounceMs: number;
}
export const DEFAULT_SLIDE: SlideConfig = { ttlMs: 365 * DAY, debounceMs: DAY };

export function newExpiry(
  now: number,
  cfg: SlideConfig = DEFAULT_SLIDE,
): number {
  return now + cfg.ttlMs;
}

/** Renew when the session's age has crossed the debounce window. Avoids a DB
 *  write + Set-Cookie on every request while keeping active sessions alive. */
export function shouldRenew(
  expiresAt: number,
  now: number,
  cfg: SlideConfig = DEFAULT_SLIDE,
): boolean {
  return cfg.ttlMs - (expiresAt - now) >= cfg.debounceMs;
}

// ── SSRF host classifier (pure; operates on literal hostnames/IPs) ─────────────
function isBlockedIPv4(ip: string): boolean {
  const o = ip.split(".").map(Number);
  if (
    o.length !== 4 || o.some((n) => !Number.isInteger(n) || n < 0 || n > 255)
  ) return true; // malformed -> block
  const [a, b] = o;
  if (a === 0) return true; // 0.0.0.0/8 unspecified
  if (a === 127) return true; // loopback
  if (a === 10) return true; // RFC-1918
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC-1918
  if (a === 192 && b === 168) return true; // RFC-1918
  if (a === 169 && b === 254) return true; // link-local + cloud metadata
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  return false;
}

function isBlockedIPv6(ip: string): boolean {
  if (ip === "::1" || ip === "::") return true; // loopback / unspecified
  if (/^fe[89ab]/.test(ip)) return true; // link-local fe80::/10
  if (/^f[cd]/.test(ip)) return true; // ULA fc00::/7
  // IPv4-mapped in hex-group form (::ffff:c0a8:0101 == 192.168.1.1) — the dotted
  // form is handled in isBlockedHost; block the hex form wholesale (it always maps
  // to an IPv4 we'd otherwise have to re-derive; over-blocking the rare public
  // hex-mapped host is the safe SSRF default).
  if (/^::ffff:[0-9a-f]{1,4}:[0-9a-f]{1,4}$/.test(ip)) return true;
  return false;
}

/** True = do NOT fetch (loopback / private / link-local / ULA / CGNAT / metadata). */
export function isBlockedHost(hostname: string): boolean {
  let h = hostname.trim().toLowerCase();
  if (h.startsWith("[") && h.endsWith("]")) h = h.slice(1, -1);
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  const mapped = h.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/); // IPv4-mapped IPv6
  if (mapped) h = mapped[1];
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return isBlockedIPv4(h);
  if (h.includes(":")) return isBlockedIPv6(h);
  return false; // ordinary hostname — DNS-resolution-time + redirect checks are the server's job
}

// ── trusted client IP from proxy headers (pure) ───────────────────────────────
/** The IP `proxyDepth` hops from the right of X-Forwarded-For (the hop appended
 *  by the trusted proxy), falling back to X-Real-IP. Ignores spoofed left entries. */
export function clientIpFromHeaders(
  xff: string | null | undefined,
  xRealIp: string | null | undefined,
  proxyDepth: number,
): string | null {
  if (proxyDepth < 1) return null; // no trusted proxy → don't trust client-set forwarding headers
  if (xff) {
    const ips = xff.split(",").map((s) => s.trim()).filter(Boolean);
    const idx = ips.length - proxyDepth;
    if (idx >= 0 && idx < ips.length) return ips[idx];
  }
  const real = xRealIp?.trim();
  return real ? real : null;
}

// ── enablement + secret strength ──────────────────────────────────────────────
export function isAuthEnabled(secret: string | null | undefined): boolean {
  return typeof secret === "string" && secret.length > 0;
}

export function validateSecretStrength(
  secret: string,
): { ok: boolean; reason?: string } {
  if (secret.length < MIN_SECRET_LENGTH) {
    return {
      ok: false,
      reason: `secret must be at least ${MIN_SECRET_LENGTH} characters`,
    };
  }
  return { ok: true };
}
