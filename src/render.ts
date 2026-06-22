import { clear, el, linkify, svg } from "./dom";
import { icons } from "./icons";
import { captureBoardRects, captureCardRects, flipBoards, flipCards } from "./flip";
import { ctx } from "./context";
import { boardMenu, cardMenu, columnMenu } from "./menu";
import { dueLabel, dueStateOf } from "./core/due";
import { isArchiveBoard, isDoneColumn } from "./core/done";
import { anchorIndex, BOARD_GAP, originOf, relaxOverlaps } from "./board-layout";
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

// Color-as-state: red (--hot) is reserved for overdue alone; due-today and
// due-soon are warm (--due), far future is quiet. Mirrors Kaiten's
// grey→yellow→red mapping and DESIGN.md's "red appears only on overdue" rule.
const dueClass = (s: DueState): string =>
  s === "overdue" ? "hot" : s === "today" || s === "soon" ? "soon" : "cool";

export function renderWorld(): void {
  const { world, store } = ctx;
  const prev = captureCardRects(world);
  const prevBoards = captureBoardRects(world);

  // remove existing boards (preserve the focus ring, a sibling in the world layer)
  world.querySelectorAll(".board").forEach((b) => b.remove());

  // Normal canvas hides the Archive board; "Go to Archive" shows only it.
  const archiveOpen = store.view.archiveOpen;
  const boards = store.world.boards.filter((b) =>
    archiveOpen ? isArchiveBoard(b) : !isArchiveBoard(b)
  );

  // reflect archive mode in the top bar (path + back affordance)
  const sub = document.querySelector(".brand-sub");
  if (sub) sub.textContent = archiveOpen ? "~/archive" : "~/canvas/personal";
  const back = document.querySelector<HTMLElement>(".archive-back");
  if (back) back.style.display = archiveOpen ? "inline-flex" : "none";

  const empty = world.parentElement?.querySelector(".empty-canvas") as HTMLElement | null;
  if (empty) empty.style.display = !archiveOpen && boards.length === 0 ? "grid" : "none";

  for (const board of boards) {
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
    const origin = originOf(boards);
    const changed = relaxOverlaps(boards, BOARD_GAP, origin);
    changed.forEach((pos, id) => ctx.store.moveBoard(id, pos.x, pos.y));
  });
}

function buildBoard(board: Board): HTMLElement {
  const total = board.columns.reduce((n, c) => n + c.cards.length, 0);
  const flow = board.columns.map((c) => c.name.toLowerCase()).join(" → ");
  const archive = isArchiveBoard(board);
  // Anchor is computed over the real boards only; the Archive board is never one.
  const real = ctx.store.world.boards.filter((b) => !isArchiveBoard(b));
  const isAnchor = !archive && real[anchorIndex(real)]?.id === board.id;

  const head = el(
    "div",
    {
      class: "board-head",
      data: { boardHandle: board.id },
      attrs: isAnchor ? { title: "Anchor board — pinned to the canvas corner" } : {},
    },
    el(
      "span",
      { class: "board-grip", attrs: isAnchor ? { "aria-label": "Anchor (pinned)" } : {} },
      svg(archive ? icons.box : isAnchor ? icons.pin : icons.grip),
    ),
    el("h2", { class: "board-title", data: { boardTitle: board.id, testid: "board-title" }, text: board.title }),
    el("span", { class: "board-flow", text: archive ? "auto-archived after 10 days done" : flow }),
    el("span", { class: "board-count", data: { testid: "board-count" }, text: String(total) }),
    archive ? null : el("button", {
      class: "board-menu",
      data: { testid: "board-menu-button" },
      attrs: { "aria-label": "Board menu" },
      on: {
        pointerdown: (e: MouseEvent) => e.stopPropagation(),
        click: (e: MouseEvent) => { e.stopPropagation(); boardMenu(board, e.currentTarget as HTMLElement); },
      },
    }, svg(icons.more)),
  );

  const cols = el("div", { class: "board-cols" });
  board.columns.forEach((column, i) => cols.appendChild(buildColumn(board, column, i)));
  if (!archive) {
    cols.appendChild(
      el("button", {
        class: "col-add-col",
        data: { testid: "add-column-button" },
        attrs: { "aria-label": "Add column" },
        on: {
          click: () => {
            const col = ctx.store.addColumn(board.id);
            if (col) ctx.startCapture(col.id);
          },
        },
      }, svg(icons.plus)),
    );
  }

  return el("section", { class: `board${isAnchor ? " is-anchor" : ""}${archive ? " is-archive" : ""}`, data: { boardId: board.id, testid: "board" }, style: { "--bx": `${board.x}px`, "--by": `${board.y}px` } as Record<string, string> }, head, cols);
}

function buildColumn(board: Board, column: Column, index: number): HTMLElement {
  const archive = isArchiveBoard(board);
  const done = isDoneColumn(board, index);
  const over = column.wip != null && column.cards.length > column.wip;

  const head = el(
    "div",
    { class: "col-head" },
    el("span", {
      class: "col-name",
      data: { colName: column.id, testid: "column-name" },
      attrs: archive ? {} : { title: "Click to rename" },
      text: column.name,
      on: archive ? {} : { click: () => startRename(column.id) },
    }),
    el("span", { class: "col-count", data: { testid: "column-count" }, text: String(column.cards.length) }),
    column.wip != null
      ? el("span", { class: `col-wip${over ? " over" : ""}`, data: { testid: "column-wip" }, text: `WIP ${column.wip}` })
      : null,
    archive ? null : el("button", {
      class: "col-menu",
      data: { testid: "column-menu-button" },
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
      archive
        ? el("div", { class: "col-archive-empty", text: "Nothing archived yet." })
        : el("button", {
          class: "col-empty",
          data: { colEmpty: column.id, testid: "column-add-card" },
          text: "+ Add a card",
          on: { click: () => ctx.startCapture(column.id) },
        }),
    );
  } else {
    column.cards.forEach((card) => cardWrap.appendChild(buildCard(card)));
  }

  return el("section", { class: `column${done ? " is-done" : ""}`, data: { columnId: column.id, testid: "column" }, attrs: { "data-col-index": String(index) } }, head, cardWrap);
}

function buildCard(card: Card): HTMLElement {
  // Facade: title always; date + comment glyph only when present. Advancing is
  // implied (focus + `A`), so no per-card button. The card is fixed-width and
  // its meta never wraps, so nothing shifts as text changes. (DESIGN: one glance.)
  const dueState = card.due ? dueStateOf(card.due) : "none";

  const children: Array<Node | null> = [
    el("div", { class: "card-title", data: { testid: "card-title" } }, ...linkify(card.title)),
  ];

  if (card.due || card.comments.length) {
    const foot = el("div", { class: "card-foot" });
    if (card.due) {
      foot.appendChild(el("span", { class: `due ${dueClass(dueState)}`, data: { testid: "card-due" }, text: dueLabel(card.due) }));
    }
    if (card.comments.length) {
      foot.appendChild(el("span", { class: "cmt", data: { testid: "card-comments" } }, svg(icons.comment), String(card.comments.length)));
    }
    children.push(foot);
  }

  const focused = ctx.store.view.focusedCardId === card.id;
  return el(
    "article",
    {
      class: `card${card.due ? ` due-${dueState}` : ""}${focused ? " focus" : ""}`,
      data: { cardId: card.id, testid: "card" },
      attrs: { tabindex: "-1" },
      on: {
        contextmenu: (e: MouseEvent) => { e.preventDefault(); ctx.setFocus(card.id); cardMenu(card, e.clientX, e.clientY); },
      },
    },
    ...children,
  );
}

// ---- inline column rename ----
function startRename(columnId: string) {
  const span = ctx.world.querySelector<HTMLElement>(`[data-col-name="${columnId}"]`);
  if (!span) return;
  const input = el("input", {
    class: "rename-input",
    data: { testid: "column-rename-input" },
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
  const boards = ctx.store.world.boards.filter((b) => !isArchiveBoard(b));
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
