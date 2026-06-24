import { describe, expect, it } from "vitest";
import {
  checkLockout,
  clientIpFromHeaders,
  constantTimeEqual,
  DEFAULT_LOCKOUT,
  DEFAULT_SLIDE,
  generateSessionToken,
  hashPassphrase,
  isAuthEnabled,
  isBlockedHost,
  MIN_SECRET_LENGTH,
  newExpiry,
  parseCookieHeader,
  PBKDF2_ITERATIONS,
  recordFailure,
  recordSuccess,
  serializeSetCookie,
  sha256Base64url,
  shouldRenew,
  validateSecretStrength,
  verifyApiToken,
  verifyPassphrase,
} from "../src/auth";

// TDD RED: src/auth.ts is intentionally not implemented yet. These unit tests
// pin the contract of the PURE, cross-runtime auth module (Web Crypto only — no
// clock or mutable state baked in; the stateful lockout map + env wiring live in
// server/auth.ts). The server guard and cookie wiring are covered by e2e.

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const MAX_COOKIE_SECONDS = 400 * 24 * 3600; // browser ceiling

describe("environment", () => {
  it("has Web Crypto subtle available (vitest node env / Node >=19)", () => {
    expect(globalThis.crypto?.subtle).toBeTruthy();
  });
});

describe("constantTimeEqual", () => {
  // NOTE: timing-safety itself is not unit-testable; these pin functional
  // correctness only. Constant-time behaviour is verified by code review.
  it("returns true for equal strings", () => {
    expect(constantTimeEqual("abc123", "abc123")).toBe(true);
  });
  it("returns false for unequal strings of equal length", () => {
    expect(constantTimeEqual("abc123", "abc124")).toBe(false);
  });
  it("returns false for different-length strings", () => {
    expect(constantTimeEqual("abc", "abcd")).toBe(false);
  });
  it("returns true for two empty strings", () => {
    expect(constantTimeEqual("", "")).toBe(true);
  });
});

describe("passphrase hashing (PBKDF2-HMAC-SHA256)", () => {
  it("exposes a strong default iteration count (>= 600k)", () => {
    expect(PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(600_000);
  });

  it("produces the documented pbkdf2-sha256$iters$salt$hash format with a real salt", async () => {
    const stored = await hashPassphrase("correct horse battery staple");
    const parts = stored.split("$");
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe("pbkdf2-sha256");
    expect(Number(parts[1])).toBeGreaterThanOrEqual(600_000);
    // salt must be url-safe base64 and >= 128 bits (>= 22 base64url chars)
    expect(parts[2]).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(parts[2].length).toBeGreaterThanOrEqual(22);
    expect(parts[3].length).toBeGreaterThan(0); // hash
  });

  it("verifies the correct passphrase", async () => {
    const stored = await hashPassphrase("s3kr3t-passphrase");
    expect(await verifyPassphrase("s3kr3t-passphrase", stored)).toBe(true);
  });

  it("rejects an incorrect passphrase", async () => {
    const stored = await hashPassphrase("s3kr3t-passphrase");
    expect(await verifyPassphrase("wrong-passphrase", stored)).toBe(false);
  });

  it("uses a random salt — same passphrase hashes differently each time", async () => {
    const a = await hashPassphrase("same");
    const b = await hashPassphrase("same");
    expect(a).not.toBe(b);
    expect(await verifyPassphrase("same", a)).toBe(true);
    expect(await verifyPassphrase("same", b)).toBe(true);
  });

  it("embeds the iteration count it was created with", async () => {
    const stored = await hashPassphrase("x", undefined, 600_001);
    expect(stored.split("$")[1]).toBe("600001");
    expect(await verifyPassphrase("x", stored)).toBe(true);
  });

  it("does not throw on a malformed stored string — returns false", async () => {
    expect(await verifyPassphrase("x", "not-a-valid-hash")).toBe(false);
  });
});

describe("session tokens", () => {
  it("generates a 32-byte (256-bit) token, base64url-encoded to 43 chars", () => {
    const t = generateSessionToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("generates unique tokens", () => {
    const set = new Set(
      Array.from({ length: 200 }, () => generateSessionToken()),
    );
    expect(set.size).toBe(200);
  });

  it("sha256Base64url is deterministic and url-safe (32-byte digest -> 43 chars)", async () => {
    const a = await sha256Base64url("token-value");
    const b = await sha256Base64url("token-value");
    expect(a).toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("sha256Base64url differs for different inputs", async () => {
    expect(await sha256Base64url("a")).not.toBe(await sha256Base64url("b"));
  });
});

describe("verifyApiToken (SHA-256 + constant-time)", () => {
  // Stored value is the SHA-256 digest of the token (at-rest hashing), never the raw token.
  it("accepts the token whose SHA-256 matches the stored hash", async () => {
    const token = generateSessionToken();
    const stored = await sha256Base64url(token);
    expect(await verifyApiToken(token, stored)).toBe(true);
  });
  it("rejects a wrong token", async () => {
    const stored = await sha256Base64url("the-real-token");
    expect(await verifyApiToken("a-different-token", stored)).toBe(false);
  });
  it("rejects empty input", async () => {
    const stored = await sha256Base64url("the-real-token");
    expect(await verifyApiToken("", stored)).toBe(false);
  });
});

describe("cookie codec", () => {
  it("serializes a hardened Set-Cookie by default (HttpOnly, SameSite=Strict, Secure, Path)", () => {
    const c = serializeSetCookie("mk_session", "abc", {
      maxAgeSeconds: DAY / 1000,
      secure: true,
    });
    expect(c.startsWith("mk_session=abc")).toBe(true);
    expect(c).toContain("HttpOnly");
    expect(c).toContain("SameSite=Strict");
    expect(c).toContain("Secure");
    expect(c).toContain("Path=/");
    expect(c).toMatch(/Max-Age=\d+/);
  });

  it("omits Secure when secure=false (http localhost dev)", () => {
    const c = serializeSetCookie("mk_session", "abc", {
      maxAgeSeconds: 3600,
      secure: false,
    });
    expect(c).not.toContain("Secure");
    expect(c).toContain("HttpOnly");
  });

  it("preserves a normal Max-Age that is under the ceiling", () => {
    const c = serializeSetCookie("mk_session", "abc", {
      maxAgeSeconds: 3600,
      secure: true,
    });
    expect(Number(c.match(/Max-Age=(\d+)/)![1])).toBe(3600);
  });

  it("clamps Max-Age to the 400-day browser ceiling but keeps it positive", () => {
    const tenYears = 3650 * 24 * 3600;
    const c = serializeSetCookie("mk_session", "abc", {
      maxAgeSeconds: tenYears,
      secure: true,
    });
    const maxAge = Number(c.match(/Max-Age=(\d+)/)![1]);
    expect(maxAge).toBeGreaterThan(0); // never an expire-immediately cookie
    expect(maxAge).toBeLessThanOrEqual(MAX_COOKIE_SECONDS);
    expect(maxAge).toBe(MAX_COOKIE_SECONDS); // clamps to exactly the ceiling
  });

  it("parses a Cookie header into a map (trims both name and value sides)", () => {
    expect(parseCookieHeader("mk_session=abc; other=1")).toEqual({
      mk_session: "abc",
      other: "1",
    });
  });
  it("tolerates whitespace and returns {} for null/empty", () => {
    expect(parseCookieHeader("  a=1 ;  b=2 ")).toEqual({ a: "1", b: "2" });
    expect(parseCookieHeader(null)).toEqual({});
    expect(parseCookieHeader("")).toEqual({});
  });
});

describe("lockout policy (pure — caller passes now)", () => {
  const cfg = { maxFailures: 3, windowMs: 10 * MINUTE, lockMs: 15 * MINUTE };

  it("ships sane defaults (>=5 failures, multi-minute window/lock)", () => {
    expect(DEFAULT_LOCKOUT.maxFailures).toBeGreaterThanOrEqual(5);
    expect(DEFAULT_LOCKOUT.windowMs).toBeGreaterThanOrEqual(MINUTE);
    expect(DEFAULT_LOCKOUT.lockMs).toBeGreaterThanOrEqual(MINUTE);
  });

  it("allows when there is no prior attempt state", () => {
    expect(checkLockout(undefined, 1000).allowed).toBe(true);
  });

  it("locks out after maxFailures within the window", () => {
    let s = recordFailure(undefined, 0, cfg);
    s = recordFailure(s, 1000, cfg);
    s = recordFailure(s, 2000, cfg);
    const res = checkLockout(s, 3000, cfg);
    expect(res.allowed).toBe(false);
    expect(res.retryAfterMs).toBeGreaterThan(0);
  });

  it("unlocks once the lock window has elapsed", () => {
    let s = recordFailure(undefined, 0, cfg);
    s = recordFailure(s, 1, cfg);
    s = recordFailure(s, 2, cfg);
    expect(checkLockout(s, 2, cfg).allowed).toBe(false);
    expect(checkLockout(s, 2 + 15 * MINUTE + 1, cfg).allowed).toBe(true);
  });

  it("uses a sliding window — failures older than windowMs do not count toward lockout", () => {
    // Two failures, then a long gap past windowMs, then one more: should NOT be locked
    // (only 1 failure inside the current window).
    let s = recordFailure(undefined, 0, cfg);
    s = recordFailure(s, 1000, cfg);
    s = recordFailure(s, cfg.windowMs + 5000, cfg); // first two are now outside the window
    expect(checkLockout(s, cfg.windowMs + 6000, cfg).allowed).toBe(true);
  });

  it("recordSuccess clears the attempt state", () => {
    let s = recordFailure(undefined, 0, cfg);
    s = recordFailure(s, 1, cfg);
    expect(recordSuccess(s)).toBeUndefined();
  });
});

describe("sliding session expiry (pure)", () => {
  it("defaults to a >= 365-day TTL with a ~1-day debounce", () => {
    expect(DEFAULT_SLIDE.ttlMs).toBeGreaterThanOrEqual(365 * DAY);
    expect(DEFAULT_SLIDE.debounceMs).toBeGreaterThanOrEqual(DAY - MINUTE);
    expect(DEFAULT_SLIDE.debounceMs).toBeLessThan(DEFAULT_SLIDE.ttlMs);
  });

  it("newExpiry is now + ttl", () => {
    expect(newExpiry(1000, { ttlMs: 100, debounceMs: 10 })).toBe(1100);
  });

  it("does not renew a freshly minted session (within debounce)", () => {
    const now = 1_000_000;
    const cfg = { ttlMs: 365 * DAY, debounceMs: DAY };
    const exp = newExpiry(now, cfg);
    expect(shouldRenew(exp, now + MINUTE, cfg)).toBe(false);
  });

  it("renews a session older than the debounce window", () => {
    const now = 1_000_000;
    const cfg = { ttlMs: 365 * DAY, debounceMs: DAY };
    const exp = newExpiry(now, cfg);
    expect(shouldRenew(exp, now + 2 * DAY, cfg)).toBe(true);
  });

  it("reports renewal needed for an already-expired session (caller still guards expiry)", () => {
    const now = 1_000_000;
    const cfg = { ttlMs: 365 * DAY, debounceMs: DAY };
    const exp = newExpiry(now, cfg);
    expect(shouldRenew(exp, exp + MINUTE, cfg)).toBe(true);
  });
});

describe("isBlockedHost (SSRF classifier)", () => {
  it.each([
    "localhost",
    "LOCALHOST", // case-insensitive
    "foo.localhost",
    "127.0.0.1",
    "127.5.5.5",
    "0.0.0.0",
    "10.0.0.1",
    "10.255.255.255",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254", // cloud metadata
    "169.254.1.1",
    "100.64.0.1", // CGNAT
    "::1",
    "fe80::1",
    "FE80::1", // case-insensitive IPv6
    "fc00::1",
    "fd12:3456::1",
    "::ffff:127.0.0.1", // IPv4-mapped IPv6 loopback
    "::ffff:10.0.0.1", // IPv4-mapped RFC-1918
    "::ffff:169.254.169.254", // IPv4-mapped metadata
    "::ffff:192.168.1.1",
    "::ffff:c0a8:0101", // IPv4-mapped IPv6 in HEX form (== 192.168.1.1)
    "::ffff:a9fe:fea9", // hex-form cloud metadata (== 169.254.169.254)
    "[::ffff:0a00:0001]", // bracketed hex-form RFC-1918
  ])("blocks private/internal host %s", (h) => {
    expect(isBlockedHost(h)).toBe(true);
  });

  it.each([
    "example.com",
    "www.youtube.com",
    "8.8.8.8",
    "1.1.1.1",
    "172.32.0.1", // just outside RFC-1918
    "172.15.255.255",
    "11.0.0.1",
    "93.184.216.34",
  ])("allows ordinary public host %s", (h) => {
    expect(isBlockedHost(h)).toBe(false);
  });
});

describe("clientIpFromHeaders (trusted proxy hop)", () => {
  it("takes the rightmost XFF entry for a single trusted proxy (depth 1)", () => {
    expect(clientIpFromHeaders("9.9.9.9, 1.2.3.4", null, 1)).toBe("1.2.3.4");
  });

  it("ignores a spoofed leftmost XFF value", () => {
    expect(clientIpFromHeaders("evil-spoof, 203.0.113.7", null, 1)).toBe(
      "203.0.113.7",
    );
  });

  it("takes the hop `depth` from the right for chained proxies", () => {
    expect(clientIpFromHeaders("1.1.1.1, 2.2.2.2, 3.3.3.3", null, 2)).toBe(
      "2.2.2.2",
    );
  });

  it("falls back to X-Real-IP when XFF is absent", () => {
    expect(clientIpFromHeaders(null, "203.0.113.9", 1)).toBe("203.0.113.9");
  });

  it("trims whitespace around entries", () => {
    expect(clientIpFromHeaders("  9.9.9.9 ,  1.2.3.4  ", null, 1)).toBe(
      "1.2.3.4",
    );
  });

  it("returns null at depth 0 with no usable header (direct connection)", () => {
    expect(clientIpFromHeaders(null, null, 0)).toBeNull();
  });

  it("at depth 0 IGNORES client-set forwarding headers (no trusted proxy)", () => {
    // Direct exposure: a client could set these itself, so they must not be trusted.
    expect(clientIpFromHeaders("1.2.3.4", "5.6.7.8", 0)).toBeNull();
  });

  it("returns null when nothing usable is present", () => {
    expect(clientIpFromHeaders(null, null, 1)).toBeNull();
  });
});

describe("auth enablement + secret strength", () => {
  it("isAuthEnabled is true only for a non-empty secret", () => {
    expect(isAuthEnabled(undefined)).toBe(false);
    expect(isAuthEnabled(null)).toBe(false);
    expect(isAuthEnabled("")).toBe(false);
    expect(isAuthEnabled("a-secret")).toBe(true);
  });

  it("exposes a minimum secret length of at least 16", () => {
    expect(MIN_SECRET_LENGTH).toBeGreaterThanOrEqual(16);
  });

  it("validateSecretStrength pins the exact threshold at MIN_SECRET_LENGTH", () => {
    const tooShort = "a".repeat(MIN_SECRET_LENGTH - 1);
    const justEnough = "a".repeat(MIN_SECRET_LENGTH);
    expect(validateSecretStrength(tooShort).ok).toBe(false);
    expect(validateSecretStrength(tooShort).reason).toBeTruthy();
    expect(validateSecretStrength(justEnough).ok).toBe(true);
  });
});
