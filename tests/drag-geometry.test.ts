import { describe, expect, it } from "vitest";
import { cardDropY, slotForY } from "../src/drag-geometry";

const BIAS = 16;

describe("cardDropY (drag comparison point = card centre, biased toward motion)", () => {
  it("equals the cursor when the card is grabbed at its centre", () => {
    // grabOffsetY = half the height, no direction → cursor maps to itself
    expect(cardDropY(500, 30, 60, 0, BIAS)).toBe(500);
  });

  it("sits below the cursor by half a card when grabbed at the top edge", () => {
    // grabbed at the top (offset 0) → the comparison point is the card's middle,
    // half a card BELOW the cursor — this is what removes the 'sticky half-card'.
    expect(cardDropY(500, 0, 60, 0, BIAS)).toBe(530);
  });

  it("nudges toward the drag direction by exactly the bias", () => {
    expect(cardDropY(500, 30, 60, 1, BIAS)).toBe(516); // moving down → look ahead down
    expect(cardDropY(500, 30, 60, -1, BIAS)).toBe(484); // moving up → look ahead up
    expect(cardDropY(500, 30, 60, 0, BIAS)).toBe(500); // still → no bias (stable)
  });
});

describe("slotForY (insertion index from cached midpoints)", () => {
  const mids = [100, 200, 300]; // three neighbours' vertical midpoints

  it("inserts at the top above the first midpoint", () => {
    expect(slotForY(mids, 50)).toBe(0);
  });

  it("inserts at the bottom below the last midpoint", () => {
    expect(slotForY(mids, 350)).toBe(3);
  });

  it("lands in the slot whose midpoint the point has not yet passed", () => {
    expect(slotForY(mids, 150)).toBe(1);
    expect(slotForY(mids, 250)).toBe(2);
  });

  it("treats a point exactly on a midpoint as past it (insert after)", () => {
    expect(slotForY(mids, 200)).toBe(2); // y < 200 is false → not slot 1
  });

  it("returns 0 for an empty column", () => {
    expect(slotForY([], 123)).toBe(0);
  });

  it("is non-decreasing as the point moves down — stable, no flicker", () => {
    let prev = -1;
    for (let y = 0; y <= 400; y += 5) {
      const s = slotForY(mids, y);
      expect(s).toBeGreaterThanOrEqual(prev);
      prev = s;
    }
  });
});

describe("responsiveness: the slot flips before the cursor reaches the midpoint", () => {
  it("a top-grabbed card opens the next slot earlier than a cursor-only rule would", () => {
    const mids = [200]; // one neighbour, midpoint at y=200
    const cardH = 60, grabTop = 0;
    // cursor still ABOVE the neighbour's midpoint (170 < 200)...
    const y = cardDropY(170, grabTop, cardH, 1, BIAS); // 170 + 30 + 16 = 216
    expect(slotForY(mids, y)).toBe(1); // ...yet the card body has already passed it
    // a naive cursor-only rule would still report slot 0 at cursorY=170
    expect(slotForY(mids, 170)).toBe(0);
  });

  it("the whole decision is pure numbers — no DOM, so the per-frame path can't reflow", () => {
    // sanity: a long column resolves in one cheap pass (cached mids, O(n))
    const mids = Array.from({ length: 500 }, (_, i) => i * 10);
    expect(slotForY(mids, 2345)).toBe(235);
  });
});
