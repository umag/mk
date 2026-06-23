import { ctx } from "./context";
import { reduceMotion } from "./flip";
import { type Rect, sceneBounds, clampPan } from "./canvas-bounds";
import { originOf } from "./board-layout";

const GRID = 28;
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 1.6;
const SCENE_MARGIN = 180; // world px of breathing room around the boards

// Board SIZES are measured lazily and cached: reading offsetWidth forces layout,
// and a board's size only changes when its content does (cards/columns/fold), not
// while panning. Positions come straight from the store (no layout) so a live drag
// stays accurate. invalidateScene() clears the cache (called after every render).
const sizeCache = new Map<string, { w: number; h: number }>();
export function invalidateScene() {
  sizeCache.clear();
}

/** Current board rectangles in world coords (store position + cached size). */
export function boardRectsNow(): Rect[] {
  const out: Rect[] = [];
  ctx.world.querySelectorAll<HTMLElement>(".board").forEach((b) => {
    const id = b.dataset.boardId ?? "";
    const board = ctx.store.findBoard(id);
    if (!board) return;
    let size = sizeCache.get(id);
    if (!size) {
      size = { w: b.offsetWidth, h: b.offsetHeight };
      sizeCache.set(id, size);
    }
    out.push({ x: board.x, y: board.y, w: size.w, h: size.h });
  });
  return out;
}

let spaceHeld = false;
let raf = 0;

// The minimap + scrollbars are visual feedback, not interaction-critical, so
// coalesce their refresh to one rAF — multiple pan ticks per frame share it.
let chromeRaf = 0;
function scheduleChrome() {
  if (chromeRaf) return;
  chromeRaf = requestAnimationFrame(() => {
    chromeRaf = 0;
    ctx.updateChrome();
  });
}

export function initCanvas() {
  const vp = ctx.viewport;

  vp.addEventListener("wheel", onWheel, { passive: false });
  vp.addEventListener("pointerdown", onPointerDown);

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !isTyping(e.target)) {
      spaceHeld = true;
      vp.classList.add("space-ready");
      e.preventDefault();
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "Space") {
      spaceHeld = false;
      vp.classList.remove("space-ready");
    }
  });

  window.addEventListener("resize", () => {
    applyTransform();
  });

  applyTransform();
}

function isTyping(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}

export function applyTransform() {
  const view = ctx.store.view;
  // BOUNDED canvas: clamp the pan to the board extents so it can't drift into
  // void. The anchor's top-left is a hard border (no margin above/left of it).
  const rects = boardRectsNow();
  const scene = sceneBounds(rects, SCENE_MARGIN, originOf(rects));
  const clamped = clampPan(
    { x: view.panX, y: view.panY },
    view.zoom,
    scene,
    { w: ctx.viewport.clientWidth, h: ctx.viewport.clientHeight },
  );
  view.panX = clamped.x;
  view.panY = clamped.y;

  const { panX, panY, zoom } = view;
  // Write the concrete properties directly. Driving these through *inherited* CSS
  // custom properties (--pan-x etc.) invalidates the computed style of every
  // descendant card on each change — a large cost at hundreds of cards. The
  // transform / background are non-inherited, so only these two nodes restyle.
  ctx.world.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;

  const g = GRID * zoom;
  ctx.viewport.style.backgroundSize = `${g}px ${g}px`;
  ctx.viewport.style.backgroundPosition = `${panX}px ${panY}px`;

  const lvl = document.querySelector(".zoom .lvl");
  if (lvl) lvl.textContent = `${Math.round(zoom * 100)}%`;

  scheduleChrome();
}

export function screenToWorld(sx: number, sy: number): { x: number; y: number } {
  const r = ctx.viewport.getBoundingClientRect();
  const { panX, panY, zoom } = ctx.store.view;
  return { x: (sx - r.left - panX) / zoom, y: (sy - r.top - panY) / zoom };
}

export function setZoom(nextZoom: number, anchorScreenX?: number, anchorScreenY?: number) {
  const r = ctx.viewport.getBoundingClientRect();
  const ax = anchorScreenX ?? r.left + r.width / 2;
  const ay = anchorScreenY ?? r.top + r.height / 2;
  const v = ctx.store.view;
  const z = clamp(nextZoom, ZOOM_MIN, ZOOM_MAX);
  // keep the world point under the anchor fixed
  const wx = (ax - r.left - v.panX) / v.zoom;
  const wy = (ay - r.top - v.panY) / v.zoom;
  v.panX = ax - r.left - wx * z;
  v.panY = ay - r.top - wy * z;
  v.zoom = z;
  applyTransform();
}

export function nudgeZoom(dir: 1 | -1) {
  setZoom(round2(ctx.store.view.zoom + dir * 0.1));
}

export function centerOn(x: number, y: number, w = 0, h = 0) {
  const v = ctx.store.view;
  const r = ctx.viewport.getBoundingClientRect();
  const cx = x + w / 2;
  const cy = y + h / 2;
  const targetPanX = r.width / 2 - cx * v.zoom;
  const targetPanY = r.height / 2 - cy * v.zoom;
  animatePan(targetPanX, targetPanY);
}

function onWheel(e: WheelEvent) {
  e.preventDefault();
  cancelMomentum();
  const v = ctx.store.view;
  if (e.ctrlKey || e.metaKey) {
    // pinch-zoom (trackpad) or ctrl+wheel
    setZoom(v.zoom * (1 - e.deltaY * 0.01), e.clientX, e.clientY);
  } else {
    v.panX -= e.deltaX;
    v.panY -= e.deltaY;
    applyTransform();
  }
}

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return;
  const onBoard = (e.target as HTMLElement).closest(".board");
  // pan when: clicking empty canvas, OR space held anywhere
  if (onBoard && !spaceHeld) return;
  if ((e.target as HTMLElement).closest(".minimap, .hud, .cscroll")) return;

  e.preventDefault();
  cancelMomentum();
  const vp = ctx.viewport;
  vp.classList.add("panning");
  vp.setPointerCapture(e.pointerId);

  const v = ctx.store.view;
  let lastX = e.clientX;
  let lastY = e.clientY;
  let lastT = e.timeStamp;
  let vx = 0;
  let vy = 0;

  const move = (ev: PointerEvent) => {
    const dx = ev.clientX - lastX;
    const dy = ev.clientY - lastY;
    v.panX += dx;
    v.panY += dy;
    const dt = ev.timeStamp - lastT || 16;
    vx = dx / dt;
    vy = dy / dt;
    lastX = ev.clientX; lastY = ev.clientY; lastT = ev.timeStamp;
    applyTransform();
  };
  const up = (ev: PointerEvent) => {
    vp.classList.remove("panning");
    vp.releasePointerCapture(e.pointerId);
    vp.removeEventListener("pointermove", move);
    vp.removeEventListener("pointerup", up);
    vp.removeEventListener("pointercancel", up);
    if (ev.timeStamp - lastT < 60) startMomentum(vx, vy);
  };
  vp.addEventListener("pointermove", move);
  vp.addEventListener("pointerup", up);
  vp.addEventListener("pointercancel", up);
}

// ---- inertia ----
function startMomentum(vx: number, vy: number) {
  if (reduceMotion()) return;
  const v = ctx.store.view;
  let mx = vx * 16;
  let my = vy * 16;
  if (Math.hypot(mx, my) < 0.5) return;
  const step = () => {
    mx *= 0.92; my *= 0.92;
    v.panX += mx; v.panY += my;
    applyTransform();
    if (Math.hypot(mx, my) > 0.15) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
}

function animatePan(toX: number, toY: number) {
  cancelMomentum();
  const v = ctx.store.view;
  if (reduceMotion()) { v.panX = toX; v.panY = toY; applyTransform(); return; }
  const fromX = v.panX, fromY = v.panY;
  const t0 = performance.now();
  const dur = 320;
  const ease = (t: number) => 1 - Math.pow(1 - t, 3);
  const step = (now: number) => {
    const t = Math.min(1, (now - t0) / dur);
    const k = ease(t);
    v.panX = fromX + (toX - fromX) * k;
    v.panY = fromY + (toY - fromY) * k;
    applyTransform();
    if (t < 1) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
}

function cancelMomentum() { if (raf) cancelAnimationFrame(raf); raf = 0; }

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round2 = (n: number) => Math.round(n * 100) / 100;
