// Board-snap preference, persisted in the world (synced to the DB) — see store.boardSnap
// / store.setBoardSnap. Absent = on.

import { ctx } from "./context";

export function boardSnapOn(): boolean {
  return ctx.store.boardSnap;
}

export function toggleBoardSnap(): boolean {
  const on = !boardSnapOn();
  ctx.store.setBoardSnap(on);
  return on;
}
