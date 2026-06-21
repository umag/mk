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
): { x: number; y: number } {
  let x = moved.x;
  let y = moved.y;
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

    if (penX < penY) x += mcx < hcx ? -penX : penX;
    else y += mcy < hcy ? -penY : penY;
  }
  return { x: Math.round(x), y: Math.round(y) };
}

/**
 * Resolve overlaps across a whole set of boards (e.g. after one grows). Places
 * boards top-to-bottom, pushing each clear of those already placed — so the
 * top-left anchor stays put and growth nudges neighbours down/right. Returns
 * only the boards whose position changed.
 */
export function relaxOverlaps(
  boards: Array<Rect & { id: string }>,
  gap: number,
): Map<string, { x: number; y: number }> {
  const changed = new Map<string, { x: number; y: number }>();
  const order = [...boards].sort((a, b) => a.y - b.y || a.x - b.x);
  const placed: Rect[] = [];
  for (const b of order) {
    const pos = resolveOverlap({ x: b.x, y: b.y, w: b.w, h: b.h }, placed, gap);
    placed.push({ x: pos.x, y: pos.y, w: b.w, h: b.h });
    if (pos.x !== b.x || pos.y !== b.y) changed.set(b.id, pos);
  }
  return changed;
}
