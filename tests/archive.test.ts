import { describe, expect, it } from "vitest";
import { Store } from "../src/store";
import { ARCHIVE_BOARD_ID, ARCHIVE_COLUMN_ID } from "../src/core/done";
import type { Card, WorldState } from "../src/types";

const DAY = 86_400_000;
const card = (id: string, enteredColumnAt: number): Card => ({
  id, title: id, notes: "", due: null, comments: [], enteredColumnAt,
});

function world(now: number): WorldState {
  return {
    boards: [{
      id: "b1", title: "Board", x: 0, y: 0,
      columns: [
        { id: "todo", name: "To do", wip: null, cards: [card("fresh-todo", now - 30 * DAY)] },
        { id: "done", name: "Done", wip: null, cards: [
          card("old-done", now - 11 * DAY), // ≥10 days in done → archive
          card("new-done", now - 2 * DAY), //  <10 days → stays
        ] },
      ],
    }],
  };
}

describe("auto-archive", () => {
  const now = 1_750_000_000_000;

  it("creates the Archive board on demand (idempotent)", () => {
    const s = new Store({ boards: [] });
    s.ensureArchiveBoard();
    s.ensureArchiveBoard();
    const boards = s.world.boards.filter((b) => b.id === ARCHIVE_BOARD_ID);
    expect(boards.length).toBe(1);
    expect(s.archiveBoard?.columns[0]?.id).toBe(ARCHIVE_COLUMN_ID);
  });

  it("moves only cards that sat ≥10 days in a done column", () => {
    const s = new Store(world(now));
    const moved = s.archiveDoneCards(now);
    expect(moved).toBe(1);
    expect(s.archiveBoard?.columns[0]?.cards.map((c) => c.id)).toEqual(["old-done"]);
    expect(s.findColumn("done")?.column.cards.map((c) => c.id)).toEqual(["new-done"]);
    expect(s.findColumn("todo")?.column.cards.map((c) => c.id)).toEqual(["fresh-todo"]);
  });

  it("never archives non-done columns and is a no-op on a second pass", () => {
    const s = new Store(world(now));
    s.archiveDoneCards(now);
    expect(s.archiveDoneCards(now)).toBe(0); // already archived
    expect(s.findColumn("todo")?.column.cards.length).toBe(1); // fresh-todo untouched
  });
});
