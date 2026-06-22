import { el } from "./dom";
import { ctx } from "./context";
import { playSound } from "./sound";
import { anchorIndex, BOARD_GAP, clampInsideOrigin, originOf, type Rect, resolveOverlap } from "./board-layout";
import { isArchiveBoard } from "./core/done";

const THRESHOLD = 5;

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

  const move = (ev: PointerEvent) => {
    if (!dragging) {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < THRESHOLD) return;
      dragging = true;
      const r = card.getBoundingClientRect();
      offX = startX - r.left;
      offY = startY - r.top;
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
    clone!.style.left = `${ev.clientX - offX}px`;
    clone!.style.top = `${ev.clientY - offY}px`;
    updatePlaceholder(ev, card, placeholder!);
  };

  const up = (ev: PointerEvent) => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    if (!dragging) {
      ctx.setFocus(cardId);
      ctx.openDetail(cardId);
      return;
    }
    clone?.remove();
    const drop = resolveDrop(ev, card);
    placeholder?.remove();
    clearColHighlight();
    card.classList.remove("dragging");
    if (drop) { ctx.store.moveCard(cardId, drop.columnId, drop.index); ctx.setFocus(cardId); playSound("drop"); }
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

function dropIndex(wrap: HTMLElement, ev: PointerEvent, dragOrigin: HTMLElement): number {
  const cards = [...wrap.querySelectorAll<HTMLElement>(".card")].filter((c) => c !== dragOrigin);
  for (let i = 0; i < cards.length; i++) {
    const r = cards[i]!.getBoundingClientRect();
    if (ev.clientY < r.top + r.height / 2) return i;
  }
  return cards.length;
}

function updatePlaceholder(ev: PointerEvent, dragOrigin: HTMLElement, placeholder: HTMLElement) {
  const col = columnUnder(ev);
  clearColHighlight();
  if (!col) { placeholder.remove(); return; }
  col.classList.add("drop-target"); // the whole column lights up for the drag's duration
  const wrap = col.querySelector<HTMLElement>(".col-cards");
  if (!wrap) return;
  const empty = wrap.querySelector(".col-empty");
  if (empty) { empty.classList.add("drop-hot"); placeholder.remove(); return; }
  const idx = dropIndex(wrap, ev, dragOrigin);
  const cards = [...wrap.querySelectorAll<HTMLElement>(".card")].filter((c) => c !== dragOrigin);
  const before = cards[idx] ?? null;
  if (before) wrap.insertBefore(placeholder, before);
  else wrap.appendChild(placeholder);
}

function resolveDrop(ev: PointerEvent, dragOrigin: HTMLElement): { columnId: string; index: number } | null {
  const col = columnUnder(ev);
  if (!col) return null;
  const columnId = col.dataset.columnId!;
  const wrap = col.querySelector<HTMLElement>(".col-cards");
  if (!wrap) return null;
  if (wrap.querySelector(".col-empty")) return { columnId, index: 0 };
  return { columnId, index: dropIndex(wrap, ev, dragOrigin) };
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
  let scheduled = false;

  const move = (ev: PointerEvent) => {
    if (!dragging) {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < THRESHOLD) return;
      dragging = true;
      boardEl.classList.add("dragging");
    }
    const zoom = ctx.store.view.zoom;
    ({ x, y } = clampInsideOrigin({
      x: board.x + (ev.clientX - startX) / zoom,
      y: board.y + (ev.clientY - startY) / zoom,
    }, origin));
    boardEl.style.setProperty("--bx", `${x}px`);
    boardEl.style.setProperty("--by", `${y}px`);
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(() => { scheduled = false; ctx.updateFocusRing(); ctx.updateChrome(); });
    }
  };

  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    boardEl.classList.remove("dragging");
    if (!dragging) return;
    // snap clear of other boards (never overlap), staying inside the anchor corner
    const moved: Rect = { x, y, w: boardEl.offsetWidth, h: boardEl.offsetHeight };
    const others = otherBoardRects(boardEl);
    const resolved = resolveOverlap(moved, others, BOARD_GAP, 64, origin);
    ctx.store.moveBoard(boardId, resolved.x, resolved.y);
  };

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

/** World-coord rects of every board except the one being dragged. */
function otherBoardRects(exclude: HTMLElement): Rect[] {
  const out: Rect[] = [];
  ctx.world.querySelectorAll<HTMLElement>(".board").forEach((e) => {
    if (e === exclude) return;
    const b = ctx.store.findBoard(e.dataset.boardId ?? "");
    if (b) out.push({ x: b.x, y: b.y, w: e.offsetWidth, h: e.offsetHeight });
  });
  return out;
}
