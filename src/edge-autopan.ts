// Edge auto-pan: while a board is being dragged, scroll the canvas when the
// pointer nears a viewport edge so off-screen drop targets become reachable.
// The velocity math is a pure function (unit-tested); the rAF controller drives
// it and hands control back each frame so the drag can re-place its board+ghost.

import { panBy } from "./canvas";

export interface ViewportRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PanDelta {
  dx: number;
  dy: number;
}

/** Default edge band (screen px) and per-frame speed cap. */
export const EDGE_BAND = 80;
export const EDGE_MAX_SPEED = 24;

/**
 * The pan delta (screen px) to apply for a pointer at (px,py) within `rect`.
 * Zero in the interior; a LINEAR ramp from the band boundary (0) to the very
 * edge (maxSpeed), held at maxSpeed beyond the edge. The sign is the pan to
 * apply: near the RIGHT/BOTTOM edge we pan content negative (reveal more there),
 * near LEFT/TOP positive. Screen-space and zoom-independent — measured against
 * rect.left/top. A non-positive band is a safe no-op (no divide-by-zero).
 */
export function edgePanVelocity(
  px: number,
  py: number,
  rect: ViewportRect,
  band: number,
  maxSpeed: number,
): PanDelta {
  return {
    dx: axisVelocity(px, rect.left, rect.width, band, maxSpeed),
    dy: axisVelocity(py, rect.top, rect.height, band, maxSpeed),
  };
}

function axisVelocity(p: number, start: number, len: number, band: number, maxSpeed: number): number {
  if (band <= 0) return 0;
  const near = p - start; // distance from the low (left/top) edge
  const far = start + len - p; // distance from the high (right/bottom) edge
  if (near < band) return ramp(band - near, band, maxSpeed); // toward the low edge: positive
  if (far < band) return -ramp(band - far, band, maxSpeed); // toward the high edge: negative
  return 0;
}

// depth is how far past the band boundary the pointer is (0..∞); clamp to the
// band so a pointer dragged beyond the edge holds the cap rather than exceeding it.
function ramp(depth: number, band: number, maxSpeed: number): number {
  return (maxSpeed * Math.min(depth, band)) / band;
}

export interface AutoPan {
  stop(): void;
}

/**
 * Run an edge auto-pan loop for the duration of a drag. `getPointer` returns the
 * latest pointer client position and the viewport rect (or null to skip a frame);
 * `onTick` runs after each non-zero pan so the drag can re-place its board+ghost
 * under the now-moved world. Frame-direct (no inertia) so it stays functional
 * under reduced motion — it is navigation, not decorative motion. `stop()` is
 * idempotent; the drag handler owns teardown and calls it on pointerup/cancel.
 */
export function startEdgeAutoPan(
  getPointer: () => { x: number; y: number; rect: ViewportRect } | null,
  onTick: () => void,
  band = EDGE_BAND,
  maxSpeed = EDGE_MAX_SPEED,
): AutoPan {
  let raf = requestAnimationFrame(function frame() {
    const p = getPointer();
    if (p) {
      const { dx, dy } = edgePanVelocity(p.x, p.y, p.rect, band, maxSpeed);
      if (dx !== 0 || dy !== 0) {
        const applied = panBy(dx, dy);
        // A pinned axis (scene already flush to the viewport) reports no movement;
        // only re-place the drag when the canvas actually moved.
        if (applied.dx !== 0 || applied.dy !== 0) onTick();
      }
    }
    raf = requestAnimationFrame(frame);
  });
  return {
    stop() {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    },
  };
}
