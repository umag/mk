import { describe, expect, it } from "vitest";
import type { Board, Card, WorldState } from "../src/types";
import { applyOp, findCard, nextColumnOf } from "../src/core/state";

const card = (id: string, title = id): Card => ({
  id, title, notes: "", due: null, labels: [], comments: [], enteredColumnAt: 0,
});

function world(): WorldState {
  const board: Board = {
    id: "b1", title: "B", x: 0, y: 0,
    columns: [
      { id: "c1", name: "Todo", wip: null, cards: [card("k1"), card("k2")] },
      { id: "c2", name: "Doing", wip: 2, cards: [] },
      { id: "c3", name: "Done", wip: null, cards: [] },
    ],
  };
  return { boards: [board] };
}

describe("lookups", () => {
  it("finds a card and its next column", () => {
    const s = world();
    expect(findCard(s, "k1")?.column.id).toBe("c1");
    expect(nextColumnOf(s, "k1")?.id).toBe("c2");
  });
  it("returns null for the next column of a last-column card", () => {
    const s = world();
    applyOp(s, { t: "moveCard", id: "k1", toColumnId: "c3", index: 0, at: 5 });
    expect(nextColumnOf(s, "k1")).toBeNull();
  });
});

describe("card ops", () => {
  it("adds a card at an index", () => {
    const s = world();
    applyOp(s, { t: "addCard", columnId: "c1", index: 0, card: card("k0") });
    expect(s.boards[0]!.columns[0]!.cards.map((c) => c.id)).toEqual(["k0", "k1", "k2"]);
  });
  it("is idempotent on duplicate card id (safe op replay)", () => {
    const s = world();
    const op = { t: "addCard", columnId: "c1", index: 0, card: card("k1") } as const;
    applyOp(s, op);
    expect(s.boards[0]!.columns[0]!.cards.filter((c) => c.id === "k1")).toHaveLength(1);
  });
  it("moves a card across columns and resets enteredColumnAt to op.at", () => {
    const s = world();
    applyOp(s, { t: "moveCard", id: "k1", toColumnId: "c2", index: 0, at: 1234 });
    expect(findCard(s, "k1")?.column.id).toBe("c2");
    expect(findCard(s, "k1")?.card.enteredColumnAt).toBe(1234);
  });
  it("keeps enteredColumnAt when reordering within the same column", () => {
    const s = world();
    applyOp(s, { t: "moveCard", id: "k1", toColumnId: "c1", index: 1, at: 9999 });
    expect(s.boards[0]!.columns[0]!.cards.map((c) => c.id)).toEqual(["k2", "k1"]);
    expect(findCard(s, "k1")?.card.enteredColumnAt).toBe(0);
  });
  it("updates and deletes a card", () => {
    const s = world();
    applyOp(s, { t: "updateCard", id: "k2", patch: { title: "edited", due: "Jun 24" } });
    expect(findCard(s, "k2")?.card.title).toBe("edited");
    applyOp(s, { t: "deleteCard", id: "k2" });
    expect(findCard(s, "k2")).toBeNull();
  });
  it("appends a comment", () => {
    const s = world();
    applyOp(s, { t: "addComment", cardId: "k1", comment: { id: "cm1", author: "You", at: "now", text: "hi" } });
    expect(findCard(s, "k1")?.card.comments).toHaveLength(1);
  });
});

describe("column + board ops", () => {
  it("inserts a column at an index and reorders columns", () => {
    const s = world();
    applyOp(s, { t: "addColumn", boardId: "b1", index: 1, column: { id: "cx", name: "Review", wip: null, cards: [] } });
    expect(s.boards[0]!.columns.map((c) => c.id)).toEqual(["c1", "cx", "c2", "c3"]);
    applyOp(s, { t: "moveColumn", boardId: "b1", from: 1, to: 3 });
    expect(s.boards[0]!.columns.map((c) => c.id)).toEqual(["c1", "c2", "c3", "cx"]);
  });
  it("renames and deletes a column", () => {
    const s = world();
    applyOp(s, { t: "renameColumn", id: "c2", name: "WIP" });
    expect(s.boards[0]!.columns[1]!.name).toBe("WIP");
    applyOp(s, { t: "deleteColumn", id: "c2" });
    expect(s.boards[0]!.columns.map((c) => c.id)).toEqual(["c1", "c3"]);
  });
  it("moves a column to another board", () => {
    const s = world();
    applyOp(s, { t: "addBoard", board: { id: "b2", title: "Two", x: 0, y: 0, columns: [] } });
    applyOp(s, { t: "moveColumnTo", columnId: "c2", toBoardId: "b2", index: 0 });
    expect(s.boards[0]!.columns.map((c) => c.id)).toEqual(["c1", "c3"]);
    expect(s.boards[1]!.columns.map((c) => c.id)).toEqual(["c2"]);
  });

  it("adds, moves, and deletes a board", () => {
    const s = world();
    applyOp(s, { t: "addBoard", board: { id: "b2", title: "Two", x: 10, y: 20, columns: [] } });
    applyOp(s, { t: "moveBoard", id: "b2", x: 99, y: 88 });
    expect(s.boards[1]).toMatchObject({ id: "b2", x: 99, y: 88 });
    applyOp(s, { t: "deleteBoard", id: "b1" });
    expect(s.boards.map((b) => b.id)).toEqual(["b2"]);
  });
});
