import { describe, expect, it } from "vitest";
import {
  anchorIndex,
  BOARD_GAP,
  clampInsideOrigin,
  compactToAnchor,
  originOf,
  type Rect,
  rectsOverlap,
  relaxOverlaps,
  resolveOverlap,
} from "../src/board-layout";

const r = (x: number, y: number, w = 100, h = 100): Rect => ({ x, y, w, h });

describe("compactToAnchor (magnet)", () => {
  const gap = 28;
  // anchor (tall, left) + a right column: top, a short folded 'mid', and 'bot'
  // sitting far below with a gap above it.
  const boards = [
    { id: "anchor", x: 0, y: 0, w: 200, h: 600 },
    { id: "top", x: 240, y: 0, w: 200, h: 200 },
    { id: "mid", x: 240, y: 260, w: 200, h: 40 },
    { id: "bot", x: 240, y: 520, w: 200, h: 200 },
  ];

  it("keeps the anchor fixed and pulls the column up to close the gap", () => {
    const changed = compactToAnchor(boards, gap, originOf(boards));
    expect(changed.has("anchor")).toBe(false); // immovable
    expect(changed.get("bot")).toEqual({ x: 228, y: 296 }); // slid up from y=520
  });

  it("keeps side-by-side boards side-by-side (no stacking under the anchor)", () => {
    const changed = compactToAnchor(boards, gap, originOf(boards));
    // the column tightens to the anchor's right edge + gap, not below it
    expect(changed.get("top")).toEqual({ x: 228, y: 0 });
  });

  it("never leaves boards overlapping", () => {
    const changed = compactToAnchor(boards, gap, originOf(boards));
    const final = boards.map((b) => ({ ...b, ...(changed.get(b.id) ?? {}) }));
    for (let i = 0; i < final.length; i++) {
      for (let j = i + 1; j < final.length; j++) {
        expect(rectsOverlap(final[i]!, final[j]!, 0)).toBe(false);
      }
    }
  });
});

describe("rectsOverlap", () => {
  it("detects overlap and respects the gap", () => {
    expect(rectsOverlap(r(0, 0), r(50, 50), 0)).toBe(true);
    expect(rectsOverlap(r(0, 0), r(200, 0), 0)).toBe(false);
    expect(rectsOverlap(r(0, 0), r(110, 0), 20)).toBe(true); // inside the gap
    expect(rectsOverlap(r(0, 0), r(130, 0), 20)).toBe(false); // clears the gap
  });
});

describe("resolveOverlap", () => {
  const gap = 20;

  it("leaves a non-overlapping board where it is", () => {
    expect(resolveOverlap(r(300, 0), [r(0, 0)], gap)).toEqual({ x: 300, y: 0 });
  });

  it("pushes out along the axis of least penetration", () => {
    const other = r(0, 0, 200, 200);
    const moved = r(180, 40); // small x penetration, deep y → push along x
    const out = resolveOverlap(moved, [other], gap);
    expect(out.x).toBeGreaterThanOrEqual(other.x + other.w + gap); // >= 220
    expect(out.y).toBe(40);
  });

  it("clears overlaps against several boards", () => {
    const others = [r(0, 0), r(0, 120)];
    const out = resolveOverlap(r(10, 10), others, gap);
    const placed = r(out.x, out.y);
    expect(others.every((o) => !rectsOverlap(placed, o, gap))).toBe(true);
  });
});

describe("anchor / origin", () => {
  it("picks the leftmost board as the anchor", () => {
    const boards = [{ x: 392, y: 40 }, { x: 40, y: 40 }, { x: 392, y: 440 }];
    expect(anchorIndex(boards)).toBe(1);
    expect(originOf(boards)).toEqual({ x: 40, y: 40 });
  });

  it("breaks ties on x by choosing the topmost", () => {
    const boards = [{ x: 40, y: 300 }, { x: 40, y: 40 }];
    expect(anchorIndex(boards)).toBe(1);
  });

  it("origin takes leftmost and topmost edges independently (not one board's corner)", () => {
    // leftmost board is low; topmost board is to the right — origin is neither's corner.
    // (Anchoring to a single board's corner here caused grow-relax to shove boards down.)
    const boards = [{ x: 40, y: 300 }, { x: 400, y: 40 }];
    expect(originOf(boards)).toEqual({ x: 40, y: 40 });
  });

  it("returns a safe default for an empty canvas", () => {
    expect(anchorIndex([])).toBe(-1);
    expect(originOf([])).toEqual({ x: 0, y: 0 });
  });

  it("clamps a position so it can't cross above or left of the origin", () => {
    const origin = { x: 40, y: 40 };
    expect(clampInsideOrigin({ x: 10, y: 10 }, origin)).toEqual({ x: 40, y: 40 });
    expect(clampInsideOrigin({ x: 500, y: 10 }, origin)).toEqual({ x: 500, y: 40 });
    expect(clampInsideOrigin({ x: 500, y: 600 }, origin)).toEqual({ x: 500, y: 600 });
  });

  it("a board dropped onto the corner snaps clear WITHOUT crossing the floor (no oscillation)", () => {
    // The bug: at the corner the shallow-axis push is UP, which a clamp would
    // undo every frame. With a floor, resolveOverlap pushes down/right instead.
    const anchor: Rect = { x: 40, y: 40, w: 260, h: 520 };
    const origin = { x: anchor.x, y: anchor.y };
    const dropped: Rect = { x: 40, y: 40, w: 360, h: 300 }; // exactly on the corner
    const out = resolveOverlap(dropped, [anchor], BOARD_GAP, 64, origin);
    expect(out.x).toBeGreaterThanOrEqual(origin.x); // never left of the anchor
    expect(out.y).toBeGreaterThanOrEqual(origin.y); // never above the anchor
    expect(rectsOverlap({ ...dropped, ...out }, anchor, BOARD_GAP)).toBe(false);
    // and it is a FIXED POINT: re-resolving doesn't move it (the loop converged)
    const again = resolveOverlap({ ...dropped, ...out }, [anchor], BOARD_GAP, 64, origin);
    expect(again).toEqual(out);
  });

  it("relaxOverlaps with an origin keeps every board inside the corner and converges", () => {
    const origin = { x: 40, y: 40 };
    // two boards stacked on the corner (the polluted state) + two neighbours
    const boards = [
      { id: "inbox", x: 40, y: 40, w: 564, h: 733 },
      { id: "dev", x: 40, y: 40, w: 1056, h: 358 },
      { id: "mort", x: 632, y: 426, w: 810, h: 287 },
      { id: "life", x: 40, y: 801, w: 810, h: 313 },
    ];
    const changed = relaxOverlaps(boards, BOARD_GAP, origin);
    const resolved = boards.map((b) => ({ ...b, ...(changed.get(b.id) ?? {}) }));
    for (const b of resolved) {
      expect(b.x).toBeGreaterThanOrEqual(origin.x);
      expect(b.y).toBeGreaterThanOrEqual(origin.y);
    }
    for (let i = 0; i < resolved.length; i++) {
      for (let j = i + 1; j < resolved.length; j++) {
        expect(rectsOverlap(resolved[i]!, resolved[j]!, BOARD_GAP)).toBe(false);
      }
    }
    // fixed point: a second pass over the resolved set changes nothing
    expect(relaxOverlaps(resolved, BOARD_GAP, origin).size).toBe(0);
  });
});

describe("relaxOverlaps", () => {
  const gap = 20;
  it("leaves a non-overlapping set unchanged", () => {
    const boards = [{ id: "a", ...r(0, 0) }, { id: "b", ...r(0, 140) }];
    expect(relaxOverlaps(boards, gap).size).toBe(0);
  });
  it("pushes a lower board down when an upper board grows into it; anchor stays", () => {
    const boards = [{ id: "a", ...r(0, 0, 100, 200) }, { id: "b", ...r(0, 120) }];
    const out = relaxOverlaps(boards, gap);
    expect(out.has("a")).toBe(false); // top-left anchor unchanged
    expect(out.get("b")!.y).toBeGreaterThanOrEqual(220); // a.bottom (200) + gap
  });
});
