import type { Op } from "../src/core/ops.ts";
import type { Board, Card, Column, WorldState } from "../src/types.ts";
import { applyOps, findBoard, findCard, findColumn, nextColumnOf } from "../src/core/state.ts";
import { ARCHIVE_BOARD_ID } from "../src/core/done.ts";
import { dueStateOf } from "../src/core/due.ts";
import { sanitizeLabels } from "../src/core/labels.ts";
import { archiveSweepOps } from "../src/core/archive.ts";
import { loadAll, openDb, saveAll } from "./db.ts";

// micro-kaiten persistence API. The same applyOps reducer the browser uses runs
// here too, so the server can never diverge from the client's intent. On top of
// the op-replay endpoints there is a small REST card API for external use, and a
// server-side archive sweep so cards auto-archive even with no browser open.

const DB_PATH = Deno.env.get("MK_DB") ?? "./mk.db";
const PORT = Number(Deno.env.get("MK_PORT") ?? 8787);

const db = openDb(DB_PATH);
let state: WorldState = loadAll(db);

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

const mkId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

/** Apply ops through the shared reducer and persist in one shot. */
function commit(ops: Op[]): void {
  applyOps(state, ops);
  saveAll(db, state);
}

/** A card flattened with its location — the external REST resource shape. */
function cardView(id: string) {
  const loc = findCard(state, id);
  if (!loc) return null;
  return {
    ...loc.card,
    boardId: loc.board.id,
    boardTitle: loc.board.title,
    columnId: loc.column.id,
    columnName: loc.column.name,
    index: loc.cardIndex,
  };
}

const boardSummary = (b: Board) => ({
  id: b.id,
  title: b.title,
  x: b.x,
  y: b.y,
  columns: b.columns.length,
  cards: b.columns.reduce((n, c) => n + c.cards.length, 0),
  collapsed: !!b.collapsed,
  archived: b.id === ARCHIVE_BOARD_ID,
});

function columnView(id: string) {
  const loc = findColumn(state, id);
  if (!loc) return null;
  return {
    id: loc.column.id,
    name: loc.column.name,
    wip: loc.column.wip,
    cards: loc.column.cards,
    boardId: loc.board.id,
    boardTitle: loc.board.title,
    index: loc.index,
  };
}

function flatCards() {
  return state.boards.flatMap((b) =>
    b.columns.flatMap((col) =>
      col.cards.map((c, i) => ({
        ...c,
        boardId: b.id,
        boardTitle: b.title,
        columnId: col.id,
        columnName: col.name,
        index: i,
      }))
    )
  );
}

function formatNow(): string {
  const d = new Date();
  const month = d.toLocaleString("en-US", { month: "short" });
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${month} ${d.getDate()}, ${hh}:${mm}`;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&#x27;/gi, "'").replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function extractTitle(html: string): string | null {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
  const tt = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const raw = (og?.[1] ?? tt?.[1] ?? "").trim();
  return raw ? (decodeEntities(raw).replace(/\s+/g, " ").trim() || null) : null;
}

/** YouTube serves a consent/JS shell to bots, so scraping is unreliable — use
 *  its oEmbed endpoint, which returns the video title as plain JSON. */
async function youtubeTitle(url: string): Promise<string | null> {
  let host: string;
  try { host = new URL(url).hostname.replace(/^www\./, ""); } catch { return null; }
  if (!/(^|\.)(youtube\.com|youtu\.be)$/.test(host)) return null;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 6000);
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, { signal: ctl.signal });
    if (!res.ok) return null;
    const data = (await res.json()) as { title?: string };
    return data.title?.trim() || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch a URL and pull its title (YouTube oEmbed, else og:title / <title>). */
async function fetchTitle(url: string): Promise<string | null> {
  const yt = await youtubeTitle(url);
  if (yt) return yt;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 6000);
  try {
    const res = await fetch(url, {
      signal: ctl.signal,
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (compatible; micro-kaiten/1.0; +link-unfurl)", "accept": "text/html,application/xhtml+xml" },
    });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("text/html")) {
      await res.body?.cancel();
      return null;
    }
    const html = (await res.text()).slice(0, 524_288); // cap at 512 KB
    return extractTitle(html);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Move long-done cards into the Archive. Runs headless — no browser required. */
function sweepArchive(): void {
  // Safety: never write on an empty world (a fresh/unseeded DB, or a transient
  // empty read). Otherwise the sweep's saveAll could overwrite real data.
  if (state.boards.length === 0) return;
  const ops = archiveSweepOps(state, Date.now());
  if (!ops.length) return;
  applyOps(state, ops);
  saveAll(db, state);
  const moved = ops.filter((o) => o.t === "moveCard").length;
  if (moved) console.log(`auto-archived ${moved} card(s)`);
}

sweepArchive();
setInterval(sweepArchive, 60 * 60 * 1000); // hourly

// Serve the built frontend (Docker / production) for any non-API request, with
// SPA fallback to index.html. In dev this never runs — Vite serves the app and
// proxies /api here. STATIC_DIR is empty by default so dev stays API-only.
const STATIC_DIR = Deno.env.get("MK_STATIC") ?? "";
const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
  ".svg": "image/svg+xml", ".json": "application/json", ".woff2": "font/woff2",
  ".woff": "font/woff", ".png": "image/png", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json",
};
async function serveStatic(pathname: string): Promise<Response> {
  if (!STATIC_DIR) return json({ error: "not found" }, 404);
  if (pathname.includes("..")) return json({ error: "not found" }, 404);
  const rel = pathname === "/" ? "/index.html" : pathname;
  const ext = rel.slice(rel.lastIndexOf("."));
  try {
    const data = await Deno.readFile(STATIC_DIR + rel);
    return new Response(data, { headers: { "content-type": MIME[ext] ?? "application/octet-stream" } });
  } catch {
    try {
      const html = await Deno.readFile(STATIC_DIR + "/index.html"); // SPA fallback
      return new Response(html, { headers: { "content-type": MIME[".html"] } });
    } catch {
      return json({ error: "not found" }, 404);
    }
  }
}

Deno.serve({ port: PORT }, async (req) => {
  const { pathname, searchParams } = new URL(req.url);
  const parts = pathname.split("/").filter(Boolean); // e.g. ["api","cards","<id>","move"]
  const method = req.method;
  try {
    if (parts[0] !== "api") return await serveStatic(pathname);

    // ---- op-replay + whole-workspace (the app's own sync) ----
    if (parts[1] === "health" && parts.length === 2) return json({ ok: true, boards: state.boards.length });
    if (parts[1] === "workspace" && parts.length === 2) {
      if (method === "GET") return json(state);
      if (method === "PUT") {
        state = (await req.json()) as WorldState;
        saveAll(db, state);
        return json({ ok: true, boards: state.boards.length });
      }
    }
    if (parts[1] === "ops" && parts.length === 2 && method === "POST") {
      const { ops } = (await req.json()) as { ops: Op[] };
      applyOps(state, ops);
      saveAll(db, state);
      return json({ ok: true, applied: ops.length });
    }

    // ---- unfurl: fetch a page's <title> server-side (browsers can't, due to CORS) ----
    if (parts[1] === "unfurl" && parts.length === 2 && method === "GET") {
      const target = searchParams.get("url") ?? "";
      if (!/^https?:\/\//i.test(target)) return json({ error: "http(s) url required" }, 400);
      return json({ url: target, title: await fetchTitle(target) });
    }

    // ---- REST card API (external use: server mints ids + timestamps) ----
    if (parts[1] === "cards") {
      const id = parts[2];
      const sub = parts[3];

      // /api/cards?boardId=&columnId=&due=overdue|today|soon|none&q=
      if (!id) {
        if (method === "GET") {
          let cards = flatCards();
          const boardId = searchParams.get("boardId");
          const columnId = searchParams.get("columnId");
          const due = searchParams.get("due");
          const label = searchParams.get("label");
          const q = searchParams.get("q");
          if (boardId) cards = cards.filter((c) => c.boardId === boardId);
          if (columnId) cards = cards.filter((c) => c.columnId === columnId);
          if (due) cards = cards.filter((c) => dueStateOf(c.due) === due);
          if (label) { const ll = label.toLowerCase(); cards = cards.filter((c) => c.labels.some((l) => l.toLowerCase() === ll)); }
          if (q) {
            const ql = q.toLowerCase();
            cards = cards.filter((c) => c.title.toLowerCase().includes(ql) || c.labels.some((l) => l.toLowerCase().includes(ql)));
          }
          return json(cards);
        }
        if (method === "POST") {
          const body = (await req.json()) as { columnId?: string; title?: string; notes?: string; due?: string | null; labels?: string[]; index?: number };
          if (!body.columnId || !findColumn(state, body.columnId)) return json({ error: "unknown columnId" }, 400);
          if (!body.title || !body.title.trim()) return json({ error: "title required" }, 400);
          const card: Card = {
            id: mkId("card"),
            title: body.title.trim(),
            notes: body.notes ?? "",
            due: body.due ?? null,
            labels: Array.isArray(body.labels) ? sanitizeLabels(body.labels) : [],
            blockedBy: [],
            parent: null,
            comments: [],
            enteredColumnAt: Date.now(),
          };
          commit([{ t: "addCard", columnId: body.columnId, index: body.index ?? 0, card }]);
          return json(cardView(card.id), 201);
        }
        return json({ error: "method not allowed" }, 405);
      }

      // /api/cards/:id
      if (!sub) {
        if (method === "GET") return cardView(id) ? json(cardView(id)) : json({ error: "not found" }, 404);
        if (method === "PATCH") {
          if (!findCard(state, id)) return json({ error: "not found" }, 404);
          const patch = (await req.json()) as Partial<Pick<Card, "title" | "notes" | "due" | "labels">>;
          const clean: Partial<Card> = {};
          if (typeof patch.title === "string") clean.title = patch.title;
          if (typeof patch.notes === "string") clean.notes = patch.notes;
          if (patch.due === null || typeof patch.due === "string") clean.due = patch.due;
          if (Array.isArray(patch.labels)) clean.labels = sanitizeLabels(patch.labels);
          commit([{ t: "updateCard", id, patch: clean }]);
          return json(cardView(id));
        }
        if (method === "DELETE") {
          if (!findCard(state, id)) return json({ error: "not found" }, 404);
          commit([{ t: "deleteCard", id }]);
          return json({ ok: true });
        }
        return json({ error: "method not allowed" }, 405);
      }

      // /api/cards/:id/{move,advance,comments}
      if (method === "POST") {
        if (!findCard(state, id)) return json({ error: "not found" }, 404);
        if (sub === "move") {
          const body = (await req.json()) as { toColumnId?: string; index?: number };
          if (!body.toColumnId || !findColumn(state, body.toColumnId)) return json({ error: "unknown toColumnId" }, 400);
          commit([{ t: "moveCard", id, toColumnId: body.toColumnId, index: body.index ?? 0, at: Date.now() }]);
          return json(cardView(id));
        }
        if (sub === "advance") {
          const next = nextColumnOf(state, id);
          if (!next) return json({ error: "already in the last column" }, 409);
          commit([{ t: "moveCard", id, toColumnId: next.id, index: 0, at: Date.now() }]);
          return json(cardView(id));
        }
        if (sub === "comments") {
          const body = (await req.json()) as { text?: string; author?: string };
          if (!body.text || !body.text.trim()) return json({ error: "text required" }, 400);
          const comment = { id: mkId("cm"), author: body.author ?? "You", at: formatNow(), text: body.text.trim() };
          commit([{ t: "addComment", cardId: id, comment }]);
          return json(comment, 201);
        }
        if (sub === "block") {
          const body = (await req.json()) as { by?: string };
          if (!body.by || !findCard(state, body.by)) return json({ error: "unknown 'by' card" }, 400);
          commit([{ t: "blockCard", id, by: body.by }]);
          return json(cardView(id));
        }
        if (sub === "unblock") {
          const body = (await req.json()) as { by?: string };
          if (!body.by) return json({ error: "'by' required" }, 400);
          commit([{ t: "unblockCard", id, by: body.by }]);
          return json(cardView(id));
        }
        if (sub === "parent") {
          const body = (await req.json()) as { parent?: string | null };
          const parent = body.parent ?? null;
          if (parent !== null && !findCard(state, parent)) return json({ error: "unknown parent" }, 400);
          commit([{ t: "setParent", id, parent }]); // reducer guards self/cycles
          return json(cardView(id));
        }
      }
    }

    // ---- REST board API ----
    if (parts[1] === "boards") {
      const id = parts[2];
      const sub = parts[3];

      if (!id) {
        if (method === "GET") {
          const archived = searchParams.get("archived"); // "true" | "false"
          let boards = state.boards;
          if (archived === "true") boards = boards.filter((b) => b.id === ARCHIVE_BOARD_ID);
          else if (archived === "false") boards = boards.filter((b) => b.id !== ARCHIVE_BOARD_ID);
          return json(boards.map(boardSummary));
        }
        if (method === "POST") {
          const body = (await req.json()) as { title?: string; x?: number; y?: number; columns?: string[] };
          const names = Array.isArray(body.columns) && body.columns.length ? body.columns : ["To do", "Doing", "Done"];
          const board: Board = {
            id: mkId("board"),
            title: body.title?.trim() || "New board",
            x: body.x ?? 40,
            y: body.y ?? 40,
            columns: names.map((name): Column => ({ id: mkId("col"), name: String(name), wip: null, cards: [] })),
          };
          commit([{ t: "addBoard", board }]);
          return json(findBoard(state, board.id), 201);
        }
        return json({ error: "method not allowed" }, 405);
      }

      // /api/boards/:id/columns — create a column on a board
      if (sub === "columns" && method === "POST") {
        const b = findBoard(state, id);
        if (!b) return json({ error: "not found" }, 404);
        const body = (await req.json()) as { name?: string; index?: number; wip?: number | null };
        const column: Column = {
          id: mkId("col"),
          name: body.name?.trim() || "New column",
          wip: typeof body.wip === "number" ? body.wip : null,
          cards: [],
        };
        commit([{ t: "addColumn", boardId: id, index: body.index ?? b.columns.length, column }]);
        return json(columnView(column.id), 201);
      }

      // /api/boards/:id
      if (!sub) {
        const b = findBoard(state, id);
        if (method === "GET") return b ? json(b) : json({ error: "not found" }, 404);
        if (method === "PATCH") {
          if (!b) return json({ error: "not found" }, 404);
          const body = (await req.json()) as { title?: string; x?: number; y?: number; collapsed?: boolean };
          const ops: Op[] = [];
          if (typeof body.title === "string" && body.title.trim()) ops.push({ t: "renameBoard", id, title: body.title });
          if (typeof body.x === "number" || typeof body.y === "number") {
            ops.push({ t: "moveBoard", id, x: body.x ?? b.x, y: body.y ?? b.y });
          }
          if (typeof body.collapsed === "boolean") ops.push({ t: "setBoardCollapsed", id, collapsed: body.collapsed });
          commit(ops);
          return json(findBoard(state, id));
        }
        if (method === "DELETE") {
          if (!b) return json({ error: "not found" }, 404);
          if (id === ARCHIVE_BOARD_ID) return json({ error: "the Archive board is managed automatically" }, 400);
          commit([{ t: "deleteBoard", id }]);
          return json({ ok: true });
        }
        return json({ error: "method not allowed" }, 405);
      }
    }

    // ---- REST column API ----
    if (parts[1] === "columns") {
      const id = parts[2];
      const sub = parts[3];
      if (id && !sub) {
        const loc = findColumn(state, id);
        if (method === "GET") return loc ? json(columnView(id)) : json({ error: "not found" }, 404);
        if (method === "PATCH") {
          if (!loc) return json({ error: "not found" }, 404);
          const body = (await req.json()) as { name?: string; wip?: number | null };
          const ops: Op[] = [];
          if (typeof body.name === "string" && body.name.trim()) ops.push({ t: "renameColumn", id, name: body.name });
          if (body.wip === null || typeof body.wip === "number") ops.push({ t: "setWip", id, wip: body.wip });
          commit(ops);
          return json(columnView(id));
        }
        if (method === "DELETE") {
          if (!loc) return json({ error: "not found" }, 404);
          commit([{ t: "deleteColumn", id }]);
          return json({ ok: true });
        }
        return json({ error: "method not allowed" }, 405);
      }
      // /api/columns/:id/move — reorder within a board or move across boards
      if (id && sub === "move" && method === "POST") {
        const loc = findColumn(state, id);
        if (!loc) return json({ error: "not found" }, 404);
        const body = (await req.json()) as { toBoardId?: string; index?: number };
        const index = body.index ?? 0;
        if (body.toBoardId && body.toBoardId !== loc.board.id) {
          if (!findBoard(state, body.toBoardId)) return json({ error: "unknown toBoardId" }, 400);
          commit([{ t: "moveColumnTo", columnId: id, toBoardId: body.toBoardId, index }]);
        } else {
          commit([{ t: "moveColumn", boardId: loc.board.id, from: loc.index, to: index }]);
        }
        return json(columnView(id));
      }
    }

    return json({ error: "not found" }, 404);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

console.log(`micro-kaiten API → http://localhost:${PORT}  (db: ${DB_PATH}, ${state.boards.length} boards)`);
