import type { Op } from "../core/ops";
import type { WorldState } from "../types";

// Optimistic sync: ops are applied locally first (instant UI), then flushed to
// the Deno+SQLite API in debounced batches. If no server is reachable, sync
// silently disables itself and the app runs purely in-memory.

const API = "/api";
const DEBOUNCE_MS = 250;

let enabled = false;
let queue: Op[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;
let onStatus: ((online: boolean) => void) | null = null;
let onFlushed: (() => void) | null = null;

export function onSyncStatus(fn: (online: boolean) => void) { onStatus = fn; }
export function onSynced(fn: () => void) { onFlushed = fn; }

export function setSyncEnabled(v: boolean) {
  enabled = v;
  onStatus?.(v);
  if (v && queue.length) schedule();
}

export function enqueueOp(op: Op) {
  if (!enabled) return; // in-memory-only mode
  queue.push(op);
  schedule();
}

function schedule() {
  if (timer != null) return;
  timer = setTimeout(flush, DEBOUNCE_MS);
}

async function flush() {
  timer = null;
  if (flushing || queue.length === 0) return;
  flushing = true;
  const batch = queue;
  queue = [];
  try {
    const res = await fetch(`${API}/ops`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ops: batch }),
    });
    if (!res.ok) throw new Error(`sync ${res.status}`);
    onFlushed?.();
  } catch {
    queue = batch.concat(queue); // requeue, then back off
    enabled = false;
    onStatus?.(false);
  } finally {
    flushing = false;
    if (enabled && queue.length) schedule();
  }
}

/** GET the persisted workspace. Returns null when the server is unreachable. */
export async function loadWorkspace(): Promise<WorldState | null> {
  try {
    const res = await fetch(`${API}/workspace`);
    if (!res.ok) return null;
    const data = (await res.json()) as WorldState;
    return data && Array.isArray(data.boards) ? data : { boards: [] };
  } catch {
    return null;
  }
}

/** Ask the server to fetch a URL's page title (server-side, to dodge CORS). */
export async function unfurl(url: string): Promise<string | null> {
  try {
    const res = await fetch(`${API}/unfurl?url=${encodeURIComponent(url)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { title?: string | null };
    return data.title ?? null;
  } catch {
    return null;
  }
}

/** Seed the server with the current world (used when the server starts empty). */
export async function pushSnapshot(world: WorldState): Promise<boolean> {
  try {
    const res = await fetch(`${API}/workspace`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(world),
    });
    return res.ok;
  } catch {
    return false;
  }
}
