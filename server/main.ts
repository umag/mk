import type { Op } from "../src/core/ops.ts";
import type { WorldState } from "../src/types.ts";
import { applyOps } from "../src/core/state.ts";
import { loadAll, openDb, saveAll } from "./db.ts";

// may-kaiten persistence API. The same applyOps reducer the browser uses runs
// here too, so the server can never diverge from the client's intent.

const DB_PATH = Deno.env.get("MK_DB") ?? "./may-kaiten.db";
const PORT = Number(Deno.env.get("MK_PORT") ?? 8787);

const db = openDb(DB_PATH);
let state: WorldState = loadAll(db);

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

Deno.serve({ port: PORT }, async (req) => {
  const { pathname } = new URL(req.url);
  try {
    if (pathname === "/api/health") return json({ ok: true, boards: state.boards.length });
    if (pathname === "/api/workspace" && req.method === "GET") return json(state);
    if (pathname === "/api/workspace" && req.method === "PUT") {
      state = (await req.json()) as WorldState;
      saveAll(db, state);
      return json({ ok: true, boards: state.boards.length });
    }
    if (pathname === "/api/ops" && req.method === "POST") {
      const { ops } = (await req.json()) as { ops: Op[] };
      applyOps(state, ops);
      saveAll(db, state);
      return json({ ok: true, applied: ops.length });
    }
    return json({ error: "not found" }, 404);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

console.log(`may-kaiten API → http://localhost:${PORT}  (db: ${DB_PATH}, ${state.boards.length} boards)`);
