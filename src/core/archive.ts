import type { Board, WorldState } from "../types";
import type { Op } from "./ops";
import { ARCHIVE_AFTER_MS, ARCHIVE_BOARD_ID, ARCHIVE_COLUMN_ID, isArchiveBoard, isDoneColumn } from "./done";

/** The canonical (empty) Archive board. */
export function archiveBoardObject(): Board {
  return {
    id: ARCHIVE_BOARD_ID,
    title: "Archive",
    x: 40,
    y: 40,
    columns: [{ id: ARCHIVE_COLUMN_ID, name: "Archived", wip: null, cards: [] }],
  };
}

/**
 * Pure planner for the archive sweep: the ops that (1) create the Archive board
 * if it's missing and (2) move every card that has sat in a done column for
 * ≥ ARCHIVE_AFTER_MS into it. `now` is passed in, so the plan is deterministic
 * and identical whether the browser store or the headless server runs it.
 */
export function archiveSweepOps(s: WorldState, now: number): Op[] {
  const ops: Op[] = [];
  if (!s.boards.some(isArchiveBoard)) ops.push({ t: "addBoard", board: archiveBoardObject() });
  for (const b of s.boards) {
    if (isArchiveBoard(b)) continue;
    b.columns.forEach((col, i) => {
      if (!isDoneColumn(b, i)) return;
      for (const c of col.cards) {
        if (now - c.enteredColumnAt >= ARCHIVE_AFTER_MS) {
          ops.push({ t: "moveCard", id: c.id, toColumnId: ARCHIVE_COLUMN_ID, index: 0, at: now });
        }
      }
    });
  }
  return ops;
}
