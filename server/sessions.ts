import type { DatabaseSync } from "node:sqlite";
import {
  DEFAULT_SLIDE,
  generateSessionToken,
  newExpiry,
  sha256Base64url,
  shouldRenew,
  type SlideConfig,
} from "../src/auth.ts";

// Server-side session store. Tokens are stored as their SHA-256 digest — the raw
// token lives only in the browser cookie, so a leaked DB file can't be replayed.
// Single active session: a new login revokes any prior one. Sliding TTL: verify()
// pushes expires_at forward (debounced) so continuous use never forces a relogin.

export type SessionStore = ReturnType<typeof createSessionStore>;

export function createSessionStore(
  db: DatabaseSync,
  slide: SlideConfig = DEFAULT_SLIDE,
) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)",
  );
  const insert = db.prepare(
    "INSERT INTO sessions (token_hash, created_at, expires_at) VALUES (?,?,?)",
  );
  const selectByHash = db.prepare(
    "SELECT expires_at FROM sessions WHERE token_hash=?",
  );
  const deleteByHash = db.prepare("DELETE FROM sessions WHERE token_hash=?");
  const deleteAll = db.prepare("DELETE FROM sessions");
  const deleteExpired = db.prepare(
    "DELETE FROM sessions WHERE expires_at <= ?",
  );
  const updateExpiry = db.prepare(
    "UPDATE sessions SET expires_at=? WHERE token_hash=?",
  );

  return {
    slide,

    /** Mint a new session, revoking any prior one (single active session). */
    async create(now: number): Promise<{ token: string; expiresAt: number }> {
      const token = generateSessionToken();
      const expiresAt = newExpiry(now, slide);
      const tokenHash = await sha256Base64url(token);
      db.exec("BEGIN"); // revoke-prior + insert atomically — never leave zero sessions
      try {
        deleteAll.run();
        insert.run(tokenHash, now, expiresAt);
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
      return { token, expiresAt };
    },

    /** Validate a cookie token; slide its expiry forward (debounced). Returns the
     *  refreshed expiry when a slide happened so the caller can re-Set-Cookie. */
    async verify(
      token: string,
      now: number,
    ): Promise<{ valid: boolean; refreshedExpiresAt?: number }> {
      if (!token) return { valid: false };
      const tokenHash = await sha256Base64url(token);
      const row = selectByHash.get(tokenHash) as
        | { expires_at: number }
        | undefined;
      if (!row) return { valid: false };
      if (row.expires_at <= now) {
        deleteByHash.run(tokenHash);
        return { valid: false };
      }
      if (shouldRenew(row.expires_at, now, slide)) {
        const refreshed = newExpiry(now, slide);
        updateExpiry.run(refreshed, tokenHash);
        return { valid: true, refreshedExpiresAt: refreshed };
      }
      return { valid: true };
    },

    /** Revoke a session (logout). */
    async destroy(token: string): Promise<void> {
      if (token) deleteByHash.run(await sha256Base64url(token));
    },

    /** Delete expired sessions; returns the count removed. */
    prune(now: number): number {
      const r = deleteExpired.run(now) as { changes?: number | bigint };
      return Number(r.changes ?? 0);
    },
  };
}
