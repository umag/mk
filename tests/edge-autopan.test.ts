import { describe, expect, it } from "vitest";
import { edgePanVelocity } from "../src/edge-autopan";

// A viewport rectangle in client (screen) coordinates. edgePanVelocity reads
// left/top/width/height — never assumes the viewport sits at the page origin.
const vp = { left: 0, top: 0, width: 1000, height: 800 };
const BAND = 80; // px of edge band
const MAX = 24; // px/frame cap
// Contract: a LINEAR ramp. depth = clamp(band - distanceToEdge, 0, band);
// magnitude = maxSpeed * depth / band. So at the band boundary magnitude is 0,
// at the very edge it is maxSpeed, and beyond the edge it stays capped.

describe("edgePanVelocity", () => {
  it("is a no-op in the dead centre", () => {
    expect(edgePanVelocity(500, 400, vp, BAND, MAX)).toEqual({ dx: 0, dy: 0 });
  });

  it("is a no-op anywhere outside the edge bands", () => {
    expect(edgePanVelocity(100, 400, vp, BAND, MAX)).toEqual({ dx: 0, dy: 0 });
    expect(edgePanVelocity(900, 400, vp, BAND, MAX)).toEqual({ dx: 0, dy: 0 });
    expect(edgePanVelocity(500, 100, vp, BAND, MAX)).toEqual({ dx: 0, dy: 0 });
    expect(edgePanVelocity(500, 700, vp, BAND, MAX)).toEqual({ dx: 0, dy: 0 });
  });

  it("pins the X band boundary: zero exactly at band-distance, non-zero just inside", () => {
    // right edge is at x=1000; the band begins at x = 1000 - BAND = 920
    expect(edgePanVelocity(920, 400, vp, BAND, MAX)).toEqual({ dx: 0, dy: 0 }); // exactly at the boundary
    expect(edgePanVelocity(921, 400, vp, BAND, MAX).dx).toBeLessThan(0); // just inside
  });

  it("pins the Y band boundary symmetrically (no >/>= off-by-one on the vertical axis)", () => {
    // bottom band begins at y = 800 - BAND = 720; top band ends at y = BAND = 80
    expect(edgePanVelocity(500, 720, vp, BAND, MAX)).toEqual({ dx: 0, dy: 0 }); // at the bottom boundary
    expect(edgePanVelocity(500, 721, vp, BAND, MAX).dy).toBeLessThan(0); // just inside the bottom band
    expect(edgePanVelocity(500, 80, vp, BAND, MAX)).toEqual({ dx: 0, dy: 0 }); // at the top boundary
    expect(edgePanVelocity(500, 79, vp, BAND, MAX).dy).toBeGreaterThan(0); // just inside the top band
  });

  it("pans content left (dx<0) near the right edge and right (dx>0) near the left edge", () => {
    expect(edgePanVelocity(995, 400, vp, BAND, MAX).dx).toBeLessThan(0);
    expect(edgePanVelocity(5, 400, vp, BAND, MAX).dx).toBeGreaterThan(0);
  });

  it("pans content up (dy<0) near the bottom edge and down (dy>0) near the top edge", () => {
    expect(edgePanVelocity(500, 795, vp, BAND, MAX).dy).toBeLessThan(0);
    expect(edgePanVelocity(500, 5, vp, BAND, MAX).dy).toBeGreaterThan(0);
  });

  it("drives only the band-crossing axis (no diagonal drift along a single edge)", () => {
    expect(edgePanVelocity(995, 400, vp, BAND, MAX).dy).toBe(0); // right edge, mid-height
    expect(edgePanVelocity(500, 5, vp, BAND, MAX).dx).toBe(0); // top edge, mid-width
  });

  it("scales the magnitude linearly with depth into the band", () => {
    // 50% depth (40px from the edge) => exactly half of maxSpeed
    expect(Math.abs(edgePanVelocity(960, 400, vp, BAND, MAX).dx)).toBeCloseTo(MAX / 2, 5);
    // and it is monotone: deeper => stronger
    const shallow = Math.abs(edgePanVelocity(950, 400, vp, BAND, MAX).dx);
    const deep = Math.abs(edgePanVelocity(995, 400, vp, BAND, MAX).dx);
    expect(deep).toBeGreaterThan(shallow);
  });

  it("caps at maxSpeed at the edge AND holds the cap beyond it (no falloff)", () => {
    expect(Math.abs(edgePanVelocity(1000, 400, vp, BAND, MAX).dx)).toBeCloseTo(MAX, 5);
    // pointer dragged past the viewport edge stays at the cap, neither larger nor decaying
    expect(Math.abs(edgePanVelocity(1200, 400, vp, BAND, MAX).dx)).toBeCloseTo(MAX, 5);
  });

  it("drives both axes independently in a corner (each at its own per-axis depth)", () => {
    const v = edgePanVelocity(995, 795, vp, BAND, MAX);
    expect(v.dx).toBeLessThan(0);
    expect(v.dy).toBeLessThan(0);
    // each axis matches the pure single-edge magnitude at the same depth
    expect(Math.abs(v.dx)).toBeCloseTo(Math.abs(edgePanVelocity(995, 400, vp, BAND, MAX).dx), 5);
    expect(Math.abs(v.dy)).toBeCloseTo(Math.abs(edgePanVelocity(500, 795, vp, BAND, MAX).dy), 5);
  });

  it("measures the band against rect.left/top, not absolute 0", () => {
    const offset = { left: 200, top: 100, width: 1000, height: 800 };
    // 5px inside the offset viewport's right edge (left + width - 5 = 1195)
    expect(edgePanVelocity(1195, 500, offset, BAND, MAX).dx).toBeLessThan(0);
    // 5px inside the offset viewport's LEFT edge (left + 5 = 205)
    expect(edgePanVelocity(205, 500, offset, BAND, MAX).dx).toBeGreaterThan(0);
    // 5px inside the offset viewport's TOP edge (top + 5 = 105)
    expect(edgePanVelocity(700, 105, offset, BAND, MAX).dy).toBeGreaterThan(0);
    // the offset viewport's centre is (700, 500) — a no-op there
    expect(edgePanVelocity(700, 500, offset, BAND, MAX)).toEqual({ dx: 0, dy: 0 });
  });

  it("handles a degenerate (zero) band safely — no divide-by-zero NaN into the transform", () => {
    expect(edgePanVelocity(1000, 400, vp, 0, MAX)).toEqual({ dx: 0, dy: 0 });
  });
});
