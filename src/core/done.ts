import type { Board } from "../types";

// Shared "done"/archive vocabulary, used by both the renderer and the store.

/** The hidden Archive board uses reserved ids so it's found (and persisted) for free. */
export const ARCHIVE_BOARD_ID = "archive";
export const ARCHIVE_COLUMN_ID = "archive-col";

/** A card that has sat this long in a done column gets auto-archived. */
export const ARCHIVE_AFTER_MS = 10 * 86_400_000; // 10 days

const DONE_RE = /done|complete|shipped|archive|closed/i;

/** A column counts as "done" when it's the last one or its name reads as done. */
export function isDoneColumn(board: Board, index: number): boolean {
  return index === board.columns.length - 1 || DONE_RE.test(board.columns[index]?.name ?? "");
}

/** The special, normally-hidden Archive board. */
export const isArchiveBoard = (b: { id: string }): boolean => b.id === ARCHIVE_BOARD_ID;
