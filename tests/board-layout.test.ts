import { describe, expect, it } from "vitest";
import { type Rect, rectsOverlap, relaxOverlaps, resolveOverlap } from "../src/board-layout";

const r = (x: number, y: number, w = 100, h = 100): Rect => ({ x, y, w, h });

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
