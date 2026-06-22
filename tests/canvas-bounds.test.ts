import { describe, expect, it } from "vitest";
import { type Rect, sceneBounds, clampPan } from "../src/canvas-bounds";

describe("sceneBounds", () => {
  it("is the union of board rects expanded by the margin", () => {
    const boards: Rect[] = [
      { x: 0, y: 0, w: 100, h: 100 },
      { x: 200, y: 50, w: 100, h: 200 },
    ];
    expect(sceneBounds(boards, 20)).toEqual({ minX: -20, minY: -20, maxX: 320, maxY: 270 });
  });

  it("falls back to a margin box around the origin when there are no boards", () => {
    expect(sceneBounds([], 50)).toEqual({ minX: -50, minY: -50, maxX: 50, maxY: 50 });
  });

  it("pins the top-left hard to the anchor origin (no margin there)", () => {
    const boards: Rect[] = [
      { x: 40, y: 40, w: 100, h: 100 },
      { x: 300, y: 200, w: 100, h: 100 },
    ];
    // left/top flush to the anchor corner; right/bottom keep the margin
    expect(sceneBounds(boards, 20, { x: 40, y: 40 })).toEqual({
      minX: 40,
      minY: 40,
      maxX: 420,
      maxY: 320,
    });
  });
});

describe("clampPan", () => {
  const scene = { minX: 0, minY: 0, maxX: 1000, maxY: 800 };

  it("keeps a larger scene from revealing void past either edge", () => {
    const vp = { w: 500, h: 400 };
    // pan way past the left/top: clamp so scene's far edge meets the viewport's far edge
    const c = clampPan({ x: 9999, y: 9999 }, 1, scene, vp);
    expect(c.x).toBe(0); // scene left flush to viewport left
    expect(c.y).toBe(0);
    // pan way past the right/bottom
    const d = clampPan({ x: -9999, y: -9999 }, 1, scene, vp);
    expect(d.x).toBe(vp.w - scene.maxX); // 500 - 1000 = -500
    expect(d.y).toBe(vp.h - scene.maxY); // 400 - 800 = -400
  });

  it("leaves an in-range pan untouched", () => {
    const vp = { w: 500, h: 400 };
    expect(clampPan({ x: -200, y: -100 }, 1, scene, vp)).toEqual({ x: -200, y: -100 });
  });

  it("respects zoom when computing the reachable range", () => {
    const vp = { w: 500, h: 400 };
    const d = clampPan({ x: -9999, y: 0 }, 2, scene, vp);
    expect(d.x).toBe(vp.w - scene.maxX * 2); // 500 - 2000 = -1500
  });

  it("centers a scene smaller than the viewport instead of letting it drift", () => {
    const small = { minX: 0, minY: 0, maxX: 200, maxY: 100 };
    const vp = { w: 600, h: 500 };
    const c = clampPan({ x: 9999, y: -9999 }, 1, small, vp);
    // centered: pan = (viewport - scene*zoom)/2 - min*zoom
    expect(c.x).toBe((600 - 200) / 2); // 200
    expect(c.y).toBe((500 - 100) / 2); // 200
  });
});
