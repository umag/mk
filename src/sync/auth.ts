// Client-side auth gateway — talks to /api/session (cookie-based). Kept separate
// from sync/client.ts (optimistic op-sync) since it's a different concern.

const API = "/api";

export interface AuthStatus {
  enabled: boolean;
  authed: boolean;
}

/** Boot probe. Returns null on a network error (server unreachable → offline mode,
 *  NOT a login prompt), {enabled:false} when auth is off, else {enabled, authed}. */
export async function fetchAuthStatus(): Promise<AuthStatus | null> {
  try {
    const res = await fetch(`${API}/session`);
    if (!res.ok) return null;
    const data = (await res.json()) as { enabled?: boolean; authed?: boolean };
    return { enabled: !!data.enabled, authed: !!data.authed };
  } catch {
    return null; // server down
  }
}

export interface LoginResult {
  ok: boolean;
  status: number;
  retryAfter?: number; // seconds, when locked out (429)
  error?: string;
}

export async function login(passphrase: string): Promise<LoginResult> {
  try {
    const res = await fetch(`${API}/session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ passphrase }),
    });
    if (res.ok) return { ok: true, status: res.status };
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      retryAfter?: number;
    };
    return {
      ok: false,
      status: res.status,
      retryAfter: data.retryAfter,
      error: data.error,
    };
  } catch {
    return { ok: false, status: 0, error: "network error" };
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${API}/session`, { method: "DELETE" });
  } catch {
    // best-effort — the cookie is cleared server-side; ignore transport errors
  }
}
