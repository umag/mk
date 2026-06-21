// Pure geometry for a BOUNDED canvas. The reachable area is the union of the
// boards (plus a margin) — not an infinite plane — so panning can never drift
// into empty void. All values are in unscaled world coordinates.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Union of every board rect, expanded outward by `margin` for breathing room. */
export function sceneBounds(boards: Rect[], margin: number): Bounds {
  if (boards.length === 0) {
    return { minX: -margin, minY: -margin, maxX: margin, maxY: margin };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of boards) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }
  return { minX: minX - margin, minY: minY - margin, maxX: maxX + margin, maxY: maxY + margin };
}

/**
 * Clamp a pan offset so the scene can't scroll past the viewport edges.
 * screenX = worldX * zoom + panX.
 * - scene larger than the viewport on an axis → clamp pan into the valid range.
 * - scene smaller → center it (so it can't drift around in the void).
 */
export function clampPan(
  pan: { x: number; y: number },
  zoom: number,
  scene: Bounds,
  viewport: { w: number; h: number },
): { x: number; y: number } {
  return {
    x: clampAxis(pan.x, zoom, scene.minX, scene.maxX, viewport.w),
    y: clampAxis(pan.y, zoom, scene.minY, scene.maxY, viewport.h),
  };
}

function clampAxis(pan: number, zoom: number, min: number, max: number, viewportLen: number): number {
  const sceneLen = (max - min) * zoom;
  const lo = viewportLen - max * zoom; // far edge of scene flush to far edge of viewport
  const hi = -min * zoom; //               near edge of scene flush to near edge of viewport
  const r = sceneLen <= viewportLen ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, pan));
  return r + 0; // normalize -0 → 0
}
