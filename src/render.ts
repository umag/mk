import { clear, el, svg } from "./dom";
import { icons } from "./icons";
import { captureBoardRects, captureCardRects, flipBoards, flipCards } from "./flip";
import { ctx } from "./context";
import { boardMenu, cardMenu, columnMenu } from "./menu";
import { dueLabel, dueStateOf } from "./core/due";
import { BOARD_GAP, relaxOverlaps } from "./board-layout";
import type { Board, Card, Column, DueState } from "./types";

/** Hooks run at the end of every world render (capture re-injects its active input here). */
export const afterRender: Array<() => void> = [];

let skipFlipOnce = false;
export function skipNextFlip() {
  skipFlipOnce = true;
}

let pendingRenameColumn: string | null = null;
/** Ask the next render to drop the given column's name straight into edit mode. */
export function requestColumnRename(columnId: string) {
  pendingRenameColumn = columnId;
  ctx.rerender();
}

const DONE_RE = /done|complete|shipped|archive|closed/i;
const isDoneColumn = (board: Board, index: number) =>
  index === board.columns.length - 1 || DONE_RE.test(board.columns[index]?.name ?? "");

const dueClass = (s: DueState): string =>
  s === "overdue" || s === "today" ? "hot" : s === "soon" ? "soon" : "cool";

export function renderWorld(): void {
  const { world, store } = ctx;
  const prev = captureCardRects(world);
  const prevBoards = captureBoardRects(world);

  // remove existing boards (preserve the focus ring, a sibling in the world layer)
  world.querySelectorAll(".board").forEach((b) => b.remove());

  const empty = world.parentElement?.querySelector(".empty-canvas") as HTMLElement | null;
  if (empty) empty.style.display = store.world.boards.length ? "none" : "grid";

  for (const board of store.world.boards) {
    world.appendChild(buildBoard(board));
  }

  if (skipFlipOnce) skipFlipOnce = false;
  else flipCards(world, prev);
  flipBoards(world, prevBoards);

  ctx.updateFocusRing();
  ctx.updateChrome();
  for (const fn of afterRender) fn();

  if (pendingRenameColumn) {
    const id = pendingRenameColumn;
    pendingRenameColumn = null;
    startRename(id);
  }

  scheduleRelax();
}

// After a render that changed board sizes (added cards/columns, cross-board
// move), nudge any overlapping boards apart so boards never overlap.
let relaxScheduled = false;
function scheduleRelax() {
  if (relaxScheduled) return;
  relaxScheduled = true;
  requestAnimationFrame(() => {
    relaxScheduled = false;
    if (ctx.world.querySelector(".board.dragging")) return; // not mid-drag
    const boards = [...ctx.world.querySelectorAll<HTMLElement>(".board")]
      .map((e) => {
        const b = ctx.store.findBoard(e.dataset.boardId ?? "");
        return b ? { id: b.id, x: b.x, y: b.y, w: e.offsetWidth, h: e.offsetHeight } : null;
      })
      .filter((r): r is { id: string; x: number; y: number; w: number; h: number } => r !== null);
    const changed = relaxOverlaps(boards, BOARD_GAP);
    changed.forEach((pos, id) => ctx.store.moveBoard(id, pos.x, pos.y));
  });
}

function buildBoard(board: Board): HTMLElement {
  const total = board.columns.reduce((n, c) => n + c.cards.length, 0);
  const flow = board.columns.map((c) => c.name.toLowerCase()).join(" → ");

  const head = el(
    "div",
    {
      class: "board-head",
      data: { boardHandle: board.id },
    },
    el("span", { class: "board-grip" }, svg(icons.grip)),
    el("h2", { class: "board-title", data: { boardTitle: board.id }, text: board.title }),
    el("span", { class: "board-flow", text: flow }),
    el("span", { class: "board-count", text: String(total) }),
    el("button", {
      class: "board-menu",
      attrs: { "aria-label": "Board menu" },
      on: {
        pointerdown: (e: MouseEvent) => e.stopPropagation(),
        click: (e: MouseEvent) => { e.stopPropagation(); boardMenu(board, e.currentTarget as HTMLElement); },
      },
    }, svg(icons.more)),
  );

  const cols = el("div", { class: "board-cols" });
  board.columns.forEach((column, i) => cols.appendChild(buildColumn(board, column, i)));
  cols.appendChild(
    el("button", {
      class: "col-add-col",
      attrs: { "aria-label": "Add column" },
      on: {
        click: () => {
          const col = ctx.store.addColumn(board.id);
          if (col) ctx.startCapture(col.id);
        },
      },
    }, svg(icons.plus)),
  );

  return el("section", { class: "board", data: { boardId: board.id }, style: { "--bx": `${board.x}px`, "--by": `${board.y}px` } as Record<string, string> }, head, cols);
}

function buildColumn(board: Board, column: Column, index: number): HTMLElement {
  const done = isDoneColumn(board, index);
  const over = column.wip != null && column.cards.length > column.wip;

  const head = el(
    "div",
    { class: "col-head" },
    el("span", {
      class: "col-name",
      data: { colName: column.id },
      text: column.name,
      on: { dblclick: () => startRename(column.id) },
    }),
    el("span", { class: "col-count", text: String(column.cards.length) }),
    column.wip != null
      ? el("span", { class: `col-wip${over ? " over" : ""}`, text: `WIP ${column.wip}` })
      : null,
    el("button", {
      class: "col-menu",
      attrs: { "aria-label": "Column menu" },
      on: {
        pointerdown: (e: MouseEvent) => e.stopPropagation(),
        click: (e: MouseEvent) => { e.stopPropagation(); columnMenu(board, column, e.currentTarget as HTMLElement); },
      },
    }, svg(icons.more)),
  );

  const cardWrap = el("div", { class: "col-cards", data: { colCards: column.id } });
  if (column.cards.length === 0) {
    cardWrap.appendChild(
      el("button", {
        class: "col-empty",
        data: { colEmpty: column.id },
        text: "+ Add a card",
        on: { click: () => ctx.startCapture(column.id) },
      }),
    );
  } else {
    column.cards.forEach((card) => cardWrap.appendChild(buildCard(board, column, index, card)));
  }

  return el("section", { class: `column${done ? " is-done" : ""}`, data: { columnId: column.id }, attrs: { "data-col-index": String(index) } }, head, cardWrap);
}

function buildCard(board: Board, column: Column, colIndex: number, card: Card): HTMLElement {
  const next = board.columns[colIndex + 1];
  const last = !next;

  const foot = el("div", { class: "card-foot" });
  if (card.due) {
    foot.appendChild(el("span", { class: `due ${dueClass(dueStateOf(card.due))}`, text: dueLabel(card.due) }));
  }
  if (card.comments.length) {
    foot.appendChild(el("span", { class: "cmt" }, svg(icons.comment), String(card.comments.length)));
  }
  if (last) {
    foot.appendChild(el("span", { class: "done-chip" }, svg(icons.check), "done"));
  } else {
    foot.appendChild(
      el(
        "button",
        {
          class: "adv",
          attrs: { "aria-label": `Advance to ${next.name}` },
          on: {
            click: (e: MouseEvent) => {
              e.stopPropagation();
              ctx.setFocus(card.id);
              ctx.advance(card.id, e.shiftKey);
            },
          },
        },
        "→ ",
        el("span", { class: "nx", text: next.name }),
      ),
    );
  }

  return el(
    "article",
    {
      class: `card${ctx.store.view.focusedCardId === card.id ? " focus" : ""}`,
      data: { cardId: card.id },
      attrs: { tabindex: "-1" },
      on: {
        contextmenu: (e: MouseEvent) => { e.preventDefault(); ctx.setFocus(card.id); cardMenu(card, e.clientX, e.clientY); },
      },
    },
    el("div", { class: "card-title", text: card.title }),
    foot,
  );
}

// ---- inline column rename ----
function startRename(columnId: string) {
  const span = ctx.world.querySelector<HTMLElement>(`[data-col-name="${columnId}"]`);
  if (!span) return;
  const input = el("input", {
    class: "rename-input",
    attrs: { value: span.textContent ?? "", "aria-label": "Rename column" },
  });
  span.replaceWith(input);
  input.focus();
  input.select();
  const commit = () => ctx.store.renameColumn(columnId, input.value);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    if (e.key === "Escape") ctx.rerender();
  });
  input.addEventListener("blur", commit);
}

// ---- focus: the focused card itself carries the .focus treatment (matches the mocks) ----
export function updateFocusRing(): void {
  const id = ctx.store.view.focusedCardId;
  ctx.world.querySelectorAll<HTMLElement>(".card.focus").forEach((c) => {
    if (c.dataset.cardId !== id) c.classList.remove("focus");
  });
  if (id) {
    ctx.world.querySelector<HTMLElement>(`[data-card-id="${id}"]`)?.classList.add("focus");
  }
}

// ---- chrome: minimap + canvas scrollbars ----
interface Rect { x: number; y: number; w: number; h: number; }

/** A non-overlapping spot for a new board: below the lowest board, at the left edge. */
export function computeBoardSpot(): { x: number; y: number } {
  const boards = ctx.store.world.boards;
  if (!boards.length) return { x: 24, y: 24 };
  let minX = Infinity;
  let maxBottom = -Infinity;
  for (const b of boards) {
    const elm = ctx.world.querySelector<HTMLElement>(`[data-board-id="${b.id}"]`);
    const h = elm?.offsetHeight ?? 220;
    minX = Math.min(minX, b.x);
    maxBottom = Math.max(maxBottom, b.y + h);
  }
  return { x: Math.round(minX), y: Math.round(maxBottom + 40) };
}

function boardRects(): Rect[] {
  const out: Rect[] = [];
  ctx.world.querySelectorAll<HTMLElement>(".board").forEach((b) => {
    const id = b.dataset.boardId!;
    const board = ctx.store.findBoard(id);
    if (!board) return;
    out.push({ x: board.x, y: board.y, w: b.offsetWidth, h: b.offsetHeight });
  });
  return out;
}

function viewportWorldRect(): Rect {
  const { panX, panY, zoom } = ctx.store.view;
  return {
    x: -panX / zoom,
    y: -panY / zoom,
    w: ctx.viewport.clientWidth / zoom,
    h: ctx.viewport.clientHeight / zoom,
  };
}

export function updateChrome(): void {
  const boards = boardRects();
  const vp = viewportWorldRect();
  const all = [...boards, vp];
  if (!all.length) return;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of all) {
    minX = Math.min(minX, r.x); minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w); maxY = Math.max(maxY, r.y + r.h);
  }
  const pad = 60;
  minX -= pad; minY -= pad; maxX += pad; maxY += pad;
  const sceneW = maxX - minX || 1;
  const sceneH = maxY - minY || 1;

  // minimap
  const mm = ctx.minimap;
  const inner = mm.querySelector(".minimap-inner") as HTMLElement;
  clear(inner);
  const mw = mm.clientWidth, mh = mm.clientHeight;
  const s = Math.min(mw / sceneW, mh / sceneH);
  const ox = (mw - sceneW * s) / 2;
  const oy = (mh - sceneH * s) / 2;
  const place = (r: Rect, cls: string) =>
    el("div", {
      class: cls,
      style: {
        left: `${ox + (r.x - minX) * s}px`,
        top: `${oy + (r.y - minY) * s}px`,
        width: `${Math.max(2, r.w * s)}px`,
        height: `${Math.max(2, r.h * s)}px`,
      },
    });
  boards.forEach((r) => inner.appendChild(place(r, "minimap-board")));
  inner.appendChild(place(vp, "minimap-view"));

  // scrollbars (thumb = viewport coverage of the scene)
  const vThumb = ctx.scrollV.firstElementChild as HTMLElement;
  const trackH = ctx.scrollV.clientHeight;
  vThumb.style.top = `${Math.max(0, ((vp.y - minY) / sceneH) * trackH)}px`;
  vThumb.style.height = `${Math.min(trackH, (vp.h / sceneH) * trackH)}px`;

  const hThumb = ctx.scrollH.firstElementChild as HTMLElement;
  const trackW = ctx.scrollH.clientWidth;
  hThumb.style.left = `${Math.max(0, ((vp.x - minX) / sceneW) * trackW)}px`;
  hThumb.style.width = `${Math.min(trackW, (vp.w / sceneW) * trackW)}px`;
}
