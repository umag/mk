// Boards live freely on the canvas but must never overlap. This resolves a
// moved/resized board to the nearest non-overlapping position (keeping a gap),
// by repeatedly pushing it out of whatever it hits along the shallower axis.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Minimum space kept between boards (shared by drag-snap and grow-relax). */
export const BOARD_GAP = 28;

/**
 * The canvas anchor: the leftmost — then, among equals, topmost — board. Its
 * top-left corner is the fixed origin of the canvas: no board may be moved
 * above or left of it, and the anchor itself is pinned (not draggable). With
 * that clamp in force the anchor is stable — nothing can become more top-left.
 * Returns -1 for an empty set.
 */
export function anchorIndex(boards: Array<{ x: number; y: number }>): number {
  let best = -1;
  for (let i = 0; i < boards.length; i++) {
    if (best === -1) { best = i; continue; }
    const a = boards[best]!;
    const b = boards[i]!;
    if (b.x < a.x || (b.x === a.x && b.y < a.y)) best = i;
  }
  return best;
}

/**
 * Top-left origin corner the canvas is anchored to: the component-wise minimum
 * (leftmost edge, topmost edge) across all boards — NOT one board's corner. In
 * a tidy layout the anchor sits exactly here, but taking the mins independently
 * is what keeps the clamp a no-op during grow-relax (so it never drags a board
 * that's higher than the anchor downward). Returns 0,0 for an empty set.
 */
export function originOf(boards: Array<{ x: number; y: number }>): { x: number; y: number } {
  if (boards.length === 0) return { x: 0, y: 0 };
  let x = Infinity;
  let y = Infinity;
  for (const b of boards) {
    x = Math.min(x, b.x);
    y = Math.min(y, b.y);
  }
  return { x, y };
}

/** Keep a board's top-left inside the canvas — never above or left of the origin. */
export function clampInsideOrigin(
  pos: { x: number; y: number },
  origin: { x: number; y: number },
): { x: number; y: number } {
  return { x: Math.max(pos.x, origin.x), y: Math.max(pos.y, origin.y) };
}

export function rectsOverlap(a: Rect, b: Rect, gap: number): boolean {
  return (
    a.x < b.x + b.w + gap &&
    a.x + a.w + gap > b.x &&
    a.y < b.y + b.h + gap &&
    a.y + a.h + gap > b.y
  );
}

export function resolveOverlap(
  moved: Rect,
  others: Rect[],
  gap: number,
  maxIters = 64,
  floor?: { x: number; y: number },
): { x: number; y: number } {
  // Boards fan out from the anchor's top-left corner, so overlaps are always
  // resolved by pushing DOWN or RIGHT along the shallower axis — never up/left.
  // The canvas is unbounded down/right, so this always converges (no wedging),
  // and a board can never be shoved above or left of the `floor` (the origin),
  // which is what kept a corner-stuck board oscillating every frame.
  const fx = floor?.x ?? -Infinity;
  const fy = floor?.y ?? -Infinity;
  let x = Math.max(moved.x, fx);
  let y = Math.max(moved.y, fy);
  for (let i = 0; i < maxIters; i++) {
    const me: Rect = { x, y, w: moved.w, h: moved.h };
    const hit = others.find((o) => rectsOverlap(me, o, gap));
    if (!hit) break;

    const mcx = x + moved.w / 2;
    const mcy = y + moved.h / 2;
    const hcx = hit.x + hit.w / 2;
    const hcy = hit.y + hit.h / 2;
    const penX = (moved.w + hit.w) / 2 + gap - Math.abs(mcx - hcx);
    const penY = (moved.h + hit.h) / 2 + gap - Math.abs(mcy - hcy);

    if (penX < penY) x += penX; // push right
    else y += penY; // push down
  }
  return { x: Math.round(x), y: Math.round(y) };
}

/**
 * Resolve overlaps across a whole set of boards (e.g. after one grows). Places
 * boards top-to-bottom, pushing each clear of those already placed — so the
 * top-left anchor stays put and growth nudges neighbours down/right. With an
 * `origin`, no board is placed above or left of it (the canvas corner). Returns
 * only the boards whose position changed.
 */
export function relaxOverlaps(
  boards: Array<Rect & { id: string }>,
  gap: number,
  origin?: { x: number; y: number },
): Map<string, { x: number; y: number }> {
  const changed = new Map<string, { x: number; y: number }>();
  const order = [...boards].sort((a, b) => a.y - b.y || a.x - b.x);
  const placed: Rect[] = [];
  for (const b of order) {
    const pos = resolveOverlap({ x: b.x, y: b.y, w: b.w, h: b.h }, placed, gap, 64, origin);
    placed.push({ x: pos.x, y: pos.y, w: b.w, h: b.h });
    if (pos.x !== b.x || pos.y !== b.y) changed.set(b.id, pos);
  }
  return changed;
}

/**
 * "Magnet": pull boards toward the anchor corner, closing gaps without overlap —
 * used when a board folds and frees space, so the neighbours slide in. The anchor
 * stays put; every other board is pulled up then left as far as it can go,
 * iterating to a stable spot. A board only stacks on another that *genuinely*
 * shares its lane (real axis overlap, not merely within the gap), so a
 * side-by-side layout stays side-by-side. Returns only the boards that moved.
 */
export function compactToAnchor(
  boards: Array<Rect & { id: string }>,
  gap: number,
  origin: { x: number; y: number },
): Map<string, { x: number; y: number }> {
  const changed = new Map<string, { x: number; y: number }>();
  if (boards.length === 0) return changed;
  const ai = anchorIndex(boards);
  const placed: Rect[] = [];
  if (ai >= 0) {
    const a = boards[ai]!;
    placed.push({ x: a.x, y: a.y, w: a.w, h: a.h }); // anchor is immovable
  }
  const others = boards
    .filter((_, i) => i !== ai)
    .sort((a, b) => (a.y + a.x) - (b.y + b.x) || a.y - b.y || a.x - b.x);
  for (const b of others) {
    let x = Math.max(b.x, origin.x);
    let y = Math.max(b.y, origin.y);
    for (let iter = 0; iter < 8; iter++) {
      const px = x, py = y;
      // pull up: just below boards that genuinely share our vertical lane
      let ny = origin.y;
      for (const p of placed) if (x < p.x + p.w && x + b.w > p.x) ny = Math.max(ny, p.y + p.h + gap);
      y = ny;
      // pull left: just right of boards that genuinely share our horizontal lane
      let nx = origin.x;
      for (const p of placed) if (y < p.y + p.h && y + b.h > p.y) nx = Math.max(nx, p.x + p.w + gap);
      x = nx;
      if (x === px && y === py) break;
    }
    x = Math.round(x);
    y = Math.round(y);
    placed.push({ x, y, w: b.w, h: b.h });
    if (x !== b.x || y !== b.y) changed.set(b.id, { x, y });
  }
  return changed;
}
