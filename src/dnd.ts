import { el } from "./dom";
import { ctx } from "./context";
import { playSound } from "./sound";
import { anchorIndex, BOARD_GAP, boardLandingSpot, clampInsideOrigin, originOf } from "./board-layout";
import { isArchiveBoard } from "./core/done";
import { type AutoPan, startEdgeAutoPan } from "./edge-autopan";
import { cardDropY, slotForY } from "./drag-geometry";
import { boardSnapOn } from "./settings";

const THRESHOLD = 5;
// Boards are a pure drag handle (header buttons are excluded in onDown, the title has
// no click action), so they need almost no click-vs-drag tolerance. A small threshold
// removes the "stays put then jumps" deadzone you feel when dragging slowly.
const BOARD_THRESHOLD = 2;
// Card-drop intent: decide the slot from the dragged card's CENTRE (not the cursor
// tip), nudged a few px toward the drag direction, so the placeholder flips as soon
// as the card body passes a neighbour instead of after half a card of travel. Tunable.
const DROP_BIAS = 16;

export function initDnd() {
  ctx.world.addEventListener("pointerdown", onDown);
}

function onDown(e: PointerEvent) {
  if (e.button !== 0) return;
  const target = e.target as HTMLElement;
  if (target.closest("a, .adv, .board-menu, .col-menu, .col-empty, .col-add, .rename-input, input, textarea, .capture-row")) return;
  if (ctx.viewport.classList.contains("space-ready")) return; // space-drag pans

  if (target.closest(".board-head")) return startBoardDrag(e, target.closest<HTMLElement>(".board-head")!);
  if (target.closest(".col-head")) return startColumnDrag(e, target.closest<HTMLElement>(".col-head")!);

  const card = target.closest<HTMLElement>(".card");
  if (card) return startCardInteraction(e, card);
}

// ---------- card: drag, or click-to-open ----------
function startCardInteraction(e: PointerEvent, card: HTMLElement) {
  const cardId = card.dataset.cardId!;
  const startX = e.clientX;
  const startY = e.clientY;
  let dragging = false;
  let clone: HTMLElement | null = null;
  let placeholder: HTMLElement | null = null;
  let offX = 0;
  let offY = 0;
  let cardH = 0;
  let prevY = startY;
  let dragDir = 0; // -1 up / +1 down — the last clear vertical direction, drives the bias
  let lastEv: PointerEvent | null = null;
  let frame = 0;

  // Each column's neighbour midpoints, captured once on first entry. Cards don't move
  // during a card drag (no pan, no reorder), so comparing against these ORIGINAL
  // midpoints keeps the slot mapping stable AND lets the per-frame path skip the
  // per-card getBoundingClientRect that made the drag stutter.
  const midsCache = new Map<HTMLElement, number[]>();
  const colMids = (wrap: HTMLElement): number[] => {
    let mids = midsCache.get(wrap);
    if (!mids) {
      mids = [...wrap.querySelectorAll<HTMLElement>(".card")]
        .filter((c) => c !== card)
        .map((c) => { const r = c.getBoundingClientRect(); return r.top + r.height / 2; });
      midsCache.set(wrap, mids);
    }
    return mids;
  };

  // Drop target (column + index) at a pointer, from the cached midpoints + the
  // card-centre compare point. Shared by the live preview and the commit so the drop
  // always lands where the placeholder showed.
  const targetAt = (ev: PointerEvent): { col: HTMLElement; wrap: HTMLElement; empty: boolean; index: number } | null => {
    const col = columnUnder(ev); // column chosen by the cursor (you point at a column)
    if (!col) return null;
    const wrap = col.querySelector<HTMLElement>(".col-cards");
    if (!wrap) return null;
    if (wrap.querySelector(".col-empty")) return { col, wrap, empty: true, index: 0 };
    const y = cardDropY(ev.clientY, offY, cardH, dragDir, DROP_BIAS);
    return { col, wrap, empty: false, index: slotForY(colMids(wrap), y) };
  };

  // One placeholder update per animation frame — pointermove can fire several times a
  // frame on high-Hz pointers; coalescing caps the layout-touching work to the refresh
  // rate so the drag stays smooth.
  const paint = () => {
    frame = 0;
    if (!placeholder || !lastEv) return;
    clearColHighlight();
    const t = targetAt(lastEv);
    if (!t) { placeholder.remove(); return; }
    t.col.classList.add("drop-target"); // the whole column lights up for the drag's duration
    if (t.empty) { t.wrap.querySelector(".col-empty")!.classList.add("drop-hot"); placeholder.remove(); return; }
    const cards = [...t.wrap.querySelectorAll<HTMLElement>(".card")].filter((c) => c !== card);
    const before = cards[t.index] ?? null;
    if (before) t.wrap.insertBefore(placeholder, before);
    else t.wrap.appendChild(placeholder);
  };

  const move = (ev: PointerEvent) => {
    if (!dragging) {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < THRESHOLD) return;
      dragging = true;
      const r = card.getBoundingClientRect();
      offX = startX - r.left;
      offY = startY - r.top;
      cardH = r.height;
      clone = card.cloneNode(true) as HTMLElement;
      clone.classList.add("is-clone");
      clone.classList.remove("focus");
      clone.style.width = `${r.width}px`;
      clone.querySelector(".key-hint")?.remove();
      document.body.appendChild(clone);
      card.classList.add("dragging");
      placeholder = el("div", { class: "drop-placeholder", style: { "--ph-h": `${r.height}px` } as Record<string, string> });
      playSound("pickup");
    }
    const dy = ev.clientY - prevY;
    if (Math.abs(dy) > 1) dragDir = Math.sign(dy); // keep the last clear direction; ignore jitter
    prevY = ev.clientY;
    clone!.style.left = `${ev.clientX - offX}px`; // cheap style write — keep the clone smooth every event
    clone!.style.top = `${ev.clientY - offY}px`;
    lastEv = ev;
    if (!frame) frame = requestAnimationFrame(paint); // defer the layout-touching work to one rAF
  };

  const up = (ev: PointerEvent) => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    if (frame) { cancelAnimationFrame(frame); frame = 0; }
    if (!dragging) {
      ctx.setFocus(cardId);
      ctx.openDetail(cardId);
      return;
    }
    clone?.remove();
    const t = targetAt(ev); // same cached geometry the placeholder used → drop matches preview
    placeholder?.remove();
    clearColHighlight();
    card.classList.remove("dragging");
    if (t) { ctx.store.moveCard(cardId, t.col.dataset.columnId!, t.index); ctx.setFocus(cardId); playSound("drop"); }
    else ctx.rerender();
  };

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

function columnUnder(ev: PointerEvent): HTMLElement | null {
  for (const node of document.elementsFromPoint(ev.clientX, ev.clientY)) {
    const col = (node as HTMLElement).closest?.(".column") as HTMLElement | null;
    if (col) return col;
  }
  return null;
}

function clearColHighlight() {
  document.querySelectorAll(".column.drop-target").forEach((n) => n.classList.remove("drop-target"));
  document.querySelectorAll(".col-empty.drop-hot").forEach((n) => n.classList.remove("drop-hot"));
}

function boardUnder(ev: PointerEvent): HTMLElement | null {
  for (const node of document.elementsFromPoint(ev.clientX, ev.clientY)) {
    const b = (node as HTMLElement).closest?.(".board") as HTMLElement | null;
    if (b) return b;
  }
  return null;
}

// ---------- column reorder (within a board) + move across boards ----------
function startColumnDrag(e: PointerEvent, head: HTMLElement) {
  const colEl = head.closest<HTMLElement>(".column")!;
  const originBoardEl = colEl.closest<HTMLElement>(".board")!;
  const originBoardId = originBoardEl.dataset.boardId!;
  const columnId = colEl.dataset.columnId!;
  const originBoard = ctx.store.findBoard(originBoardId);
  if (!originBoard) return;
  const fromIndex = originBoard.columns.findIndex((c) => c.id === columnId);
  const startX = e.clientX;
  const startY = e.clientY;
  let dragging = false;
  let target = { boardId: originBoardId, index: fromIndex };
  const line = el("div", { class: "col-drop-line" });

  const move = (ev: PointerEvent) => {
    if (!dragging) {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < THRESHOLD) return;
      dragging = true;
      colEl.classList.add("col-dragging");
      playSound("pickup");
    }
    const boardEl = boardUnder(ev) ?? originBoardEl;
    const colsWrap = boardEl.querySelector<HTMLElement>(".board-cols");
    if (!colsWrap) return;
    const cols = [...colsWrap.querySelectorAll<HTMLElement>(".column")].filter((c) => c !== colEl);
    let t = cols.findIndex((c) => ev.clientX < c.getBoundingClientRect().left + c.offsetWidth / 2);
    if (t === -1) t = cols.length;
    target = { boardId: boardEl.dataset.boardId!, index: t };
    const ref = cols[t] ?? colsWrap.querySelector(".col-add-col");
    if (ref) colsWrap.insertBefore(line, ref);
    else colsWrap.appendChild(line);
    document.querySelectorAll(".board.col-drop-board").forEach((b) => b.classList.remove("col-drop-board"));
    if (boardEl !== originBoardEl) boardEl.classList.add("col-drop-board");
  };

  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    line.remove();
    colEl.classList.remove("col-dragging");
    document.querySelectorAll(".board.col-drop-board").forEach((b) => b.classList.remove("col-drop-board"));
    if (!dragging) return;
    if (target.boardId === originBoardId) {
      if (target.index !== fromIndex) { ctx.store.moveColumn(originBoardId, fromIndex, target.index); playSound("drop"); }
    } else {
      ctx.store.moveColumnToBoard(columnId, target.boardId, target.index);
      playSound("drop");
    }
  };

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

// ---------- board reposition ----------
function startBoardDrag(e: PointerEvent, head: HTMLElement) {
  const boardEl = head.closest<HTMLElement>(".board")!;
  const boardId = boardEl.dataset.boardId!;
  const board = ctx.store.findBoard(boardId);
  if (!board) return;

  // The anchor board (leftmost, then topmost) is pinned — it defines the
  // canvas's top-left border, so it doesn't move. Every other board is clamped
  // to its corner: you can't drag a board above or left of the anchor.
  if (isArchiveBoard(board)) return; // the Archive board is view-only, not draggable
  const boards = ctx.store.world.boards.filter((b) => !isArchiveBoard(b));
  const ai = anchorIndex(boards);
  if (ai >= 0 && boards[ai]!.id === boardId) return;
  // Clamp against the OTHER boards' corner, so the dragged board can't lower
  // the wall it's being held against (the pinned anchor is always among them).
  const origin = originOf(boards.filter((b) => b.id !== boardId));

  const startX = e.clientX;
  const startY = e.clientY;
  let dragging = false;
  let x = board.x;
  let y = board.y;
  // Captured ONCE when the drag actually starts so the per-frame path never touches
  // the DOM/layout: board sizes (boards can't resize mid-drag), every board's store
  // position, and the viewport rect. Reading offsetWidth / getBoundingClientRect each
  // frame forces a synchronous reflow — that is what made the drag stutter.
  type Snap = { id: string; x: number; y: number; w: number; h: number };
  let snapshot: Snap[] = [];
  let vpRect: DOMRect | null = null;
  // World-space offset from the board's origin to the grab point. Placing the board
  // from toWorld(cursor) - grab (not a start-delta) keeps it under the cursor even
  // while the canvas auto-pans.
  let grabX = 0;
  let grabY = 0;
  let lastPointer = { x: startX, y: startY };
  let ghost: HTMLElement | null = null;
  let refreshRaf = 0;
  let autoPan: AutoPan | null = null;

  // screenToWorld against the cached viewport rect + live pan — no layout read.
  const toWorld = (cx: number, cy: number) => {
    const { panX, panY, zoom } = ctx.store.view;
    const r = vpRect!;
    return { x: (cx - r.left - panX) / zoom, y: (cy - r.top - panY) / zoom };
  };

  // The landing the dragged board will magnet to, plus every neighbour's move — the
  // SAME compaction the drop commits, computed from the cached snapshot, so the ghost
  // can never disagree with where the board actually settles.
  const landingNow = (dropX: number, dropY: number) => {
    const rects = snapshot.map((s) => (s.id === boardId ? { ...s, x: dropX, y: dropY } : s));
    return boardLandingSpot(rects, boardId, BOARD_GAP);
  };

  const placeGhost = () => {
    if (!boardSnapOn()) { ghost?.remove(); ghost = null; return; } // free mode: no magnet target to preview
    const { landing } = landingNow(Math.round(x), Math.round(y));
    if (!ghost) {
      const me = snapshot.find((s) => s.id === boardId);
      ghost = el("div", { class: "board-drop-ghost" });
      ghost.style.width = `${me?.w ?? boardEl.offsetWidth}px`;
      ghost.style.height = `${me?.h ?? boardEl.offsetHeight}px`;
      ctx.world.appendChild(ghost);
    }
    ghost.style.setProperty("--gx", `${landing.x}px`);
    ghost.style.setProperty("--gy", `${landing.y}px`);
  };

  // Cheap, runs every pointer event: keep the board pinned under the cursor (pan-aware).
  // Move via TRANSFORM (a composited translate from the board's rendered/store
  // position), NOT left/top — changing left/top relayouts the board and every card it
  // holds each frame, which is the incremental stutter on big boards. transform doesn't
  // touch layout, so the board glides smoothly at any size.
  const moveBoardEl = (cx: number, cy: number) => {
    const w = toWorld(cx, cy);
    ({ x, y } = clampInsideOrigin({ x: w.x - grabX, y: w.y - grabY }, origin));
    boardEl.style.transform = `translate(${x - board.x}px, ${y - board.y}px)`;
  };

  // The heavier work — the magnet-ghost recompute + focus ring — coalesced to one
  // frame. The minimap (updateChrome) is NOT refreshed here: board store positions
  // don't change mid-drag, so the minimap only needs updating when the canvas pans
  // (the auto-pan tick does that).
  const refresh = () => {
    if (refreshRaf) return;
    refreshRaf = requestAnimationFrame(() => {
      refreshRaf = 0;
      placeGhost();
      ctx.updateFocusRing();
    });
  };

  const move = (ev: PointerEvent) => {
    if (!dragging) {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < BOARD_THRESHOLD) return;
      dragging = true;
      boardEl.classList.add("dragging");
      // Snapshot sizes + positions + viewport rect ONCE — the per-frame path stays reflow-free.
      vpRect = ctx.viewport.getBoundingClientRect();
      snapshot = [...ctx.world.querySelectorAll<HTMLElement>(".board")]
        .map((bEl) => {
          const id = bEl.dataset.boardId ?? "";
          const b = ctx.store.findBoard(id);
          if (!b || isArchiveBoard(b)) return null;
          return { id, x: b.x, y: b.y, w: bEl.offsetWidth, h: bEl.offsetHeight };
        })
        .filter((s): s is Snap => s !== null);
      const grab = toWorld(startX, startY);
      grabX = grab.x - board.x;
      grabY = grab.y - board.y;
      autoPan = startEdgeAutoPan(
        () => ({ x: lastPointer.x, y: lastPointer.y, rect: vpRect! }),
        // pan changed under a still cursor: re-place the board, refresh the ghost, and
        // update the minimap (the one case where the viewport actually moved).
        () => { moveBoardEl(lastPointer.x, lastPointer.y); refresh(); ctx.updateChrome(); },
      );
    }
    lastPointer = { x: ev.clientX, y: ev.clientY };
    moveBoardEl(ev.clientX, ev.clientY); // immediate: the board tracks the cursor every event
    refresh(); // ghost + chrome once per frame
  };

  const teardown = () => {
    autoPan?.stop();
    if (refreshRaf) { cancelAnimationFrame(refreshRaf); refreshRaf = 0; }
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancel);
    ghost?.remove();
    ghost = null;
    boardEl.classList.remove("dragging");
  };

  const up = () => {
    teardown();
    if (!dragging) { boardEl.style.transform = ""; return; }
    const dropped = { x: Math.round(x), y: Math.round(y) };
    // Bake the live transform into left/top at the drop point (atomically — set the
    // vars, then clear the transform, with no layout read between, so there's no flash).
    // The post-drop FLIP then glides from where you released to the magnet target.
    boardEl.style.setProperty("--bx", `${dropped.x}px`);
    boardEl.style.setProperty("--by", `${dropped.y}px`);
    boardEl.style.transform = "";
    if (boardSnapOn()) {
      // Magnet: pack every board toward the anchor corner, taking the dragged board at
      // its drop spot, then a soft clack. boardLandingSpot is the single source of truth.
      const { changed, landing } = landingNow(dropped.x, dropped.y);
      ctx.store.moveBoard(boardId, landing.x, landing.y);
      changed.forEach((pos, id) => { if (id !== boardId) ctx.store.moveBoard(id, pos.x, pos.y); });
      playSound("magnet");
    } else {
      // Free mode: leave the board exactly where it was dropped (overlap allowed) and
      // bring it to the front so the board you just moved wins on z over any it overlaps.
      ctx.store.moveBoard(boardId, dropped.x, dropped.y);
      ctx.store.raiseBoard(boardId);
      playSound("drop");
    }
  };

  // Interrupted gesture (browser took over): abort without committing and
  // restore the board to its stored position.
  const cancel = () => {
    const was = dragging;
    teardown();
    boardEl.style.transform = ""; // drop the live offset
    if (was) ctx.rerender(); // rebuild at the stored position
  };

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", cancel);
}
