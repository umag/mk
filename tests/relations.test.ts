import { describe, expect, it } from "vitest";
import { applyOp } from "../src/core/state";
import { blocksOf, childProgress, childrenOf, isBlocked, isCardDone } from "../src/core/relations";
import type { Card, WorldState } from "../src/types";

const card = (id: string, over: Partial<Card> = {}): Card => ({
  id, title: id, notes: "", due: null, labels: [], blockedBy: [], parent: null, comments: [], enteredColumnAt: 0, ...over,
});

function world(): WorldState {
  return {
    boards: [{
      id: "b1", title: "B", x: 0, y: 0,
      columns: [
        { id: "todo", name: "To do", wip: null, cards: [card("a"), card("b"), card("p"), card("c1"), card("c2")] },
        { id: "done", name: "Done", wip: null, cards: [card("z")] }, // last column ⇒ done
      ],
    }],
  };
}

describe("blocking", () => {
  it("blockCard is one-directional and deduped", () => {
    const s = world();
    applyOp(s, { t: "blockCard", id: "a", by: "b" });
    applyOp(s, { t: "blockCard", id: "a", by: "b" }); // dupe ignored
    const a = s.boards[0].columns[0].cards.find((k) => k.id === "a")!;
    expect(a.blockedBy).toEqual(["b"]);
    expect(blocksOf(s, "b")).toEqual(["a"]);
  });
  it("a card is blocked until the blocker is done", () => {
    const s = world();
    applyOp(s, { t: "blockCard", id: "a", by: "b" });
    expect(isBlocked(s, { blockedBy: ["b"] })).toBe(true);
    applyOp(s, { t: "blockCard", id: "a", by: "z" }); // z is in the Done column
    expect(isCardDone(s, "z")).toBe(true);
    expect(isBlocked(s, { blockedBy: ["z"] })).toBe(false); // resolved blocker doesn't block
  });
  it("self-block is rejected", () => {
    const s = world();
    applyOp(s, { t: "blockCard", id: "a", by: "a" });
    expect(s.boards[0].columns[0].cards.find((k) => k.id === "a")!.blockedBy).toEqual([]);
  });
});

describe("parent / child", () => {
  it("childrenOf + childProgress roll up done children", () => {
    const s = world();
    applyOp(s, { t: "setParent", id: "c1", parent: "p" });
    applyOp(s, { t: "setParent", id: "z", parent: "p" }); // z is done
    expect(childrenOf(s, "p").sort()).toEqual(["c1", "z"]);
    expect(childProgress(s, "p")).toEqual({ done: 1, total: 2 });
  });
  it("rejects self-parenting and cycles", () => {
    const s = world();
    applyOp(s, { t: "setParent", id: "c1", parent: "p" });
    applyOp(s, { t: "setParent", id: "p", parent: "c1" }); // would cycle (c1 is a child of p)
    expect(s.boards[0].columns[0].cards.find((k) => k.id === "p")!.parent).toBeNull();
    applyOp(s, { t: "setParent", id: "a", parent: "a" }); // self
    expect(s.boards[0].columns[0].cards.find((k) => k.id === "a")!.parent).toBeNull();
  });
});

describe("delete cleanup", () => {
  it("removes the deleted card from blockers and orphans its children", () => {
    const s = world();
    applyOp(s, { t: "blockCard", id: "a", by: "b" });
    applyOp(s, { t: "setParent", id: "c1", parent: "p" });
    applyOp(s, { t: "deleteCard", id: "b" });
    applyOp(s, { t: "deleteCard", id: "p" });
    expect(s.boards[0].columns[0].cards.find((k) => k.id === "a")!.blockedBy).toEqual([]);
    expect(s.boards[0].columns[0].cards.find((k) => k.id === "c1")!.parent).toBeNull();
  });
});
