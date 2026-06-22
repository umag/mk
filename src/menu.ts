import { el, svg } from "./dom";
import { icons } from "./icons";
import { ctx } from "./context";
import { playSound } from "./sound";
import type { Board, Card, Column } from "./types";

let open: HTMLElement | null = null;

interface Item {
  label: string;
  icon: keyof typeof icons;
  kbd?: string;
  danger?: boolean;
  run: () => void;
}
const SEP: Item = { label: "—", icon: "more", run: () => {} };

// Stable testid per action, derived from the label ("Delete card" → menu-item-delete-card).
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function showAt(x: number, y: number, items: Item[]) {
  closeMenu();
  const menu = el("div", { class: "menu", data: { testid: "context-menu" }, attrs: { role: "menu" } });
  for (const it of items) {
    if (it.label === "—") { menu.appendChild(el("div", { class: "menu-sep" })); continue; }
    menu.appendChild(
      el("button", {
        class: `menu-item${it.danger ? " danger" : ""}`,
        data: { testid: `menu-item-${slug(it.label)}` },
        attrs: { role: "menuitem" },
        on: { click: () => { it.run(); closeMenu(); } },
      },
        svg(icons[it.icon]),
        el("span", { text: it.label }),
        it.kbd ? el("kbd", { class: "menu-kbd", text: it.kbd }) : null,
      ),
    );
  }
  document.body.appendChild(menu);
  const mw = menu.offsetWidth, mh = menu.offsetHeight;
  const left = Math.max(8, Math.min(x, innerWidth - mw - 8));
  const top = y + mh > innerHeight - 8 ? Math.max(8, y - mh) : y;
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  open = menu;
  setTimeout(() => {
    window.addEventListener("pointerdown", onDocDown);
    window.addEventListener("keydown", onEsc);
  });
}

function fromAnchor(anchor: HTMLElement, items: Item[]) {
  const r = anchor.getBoundingClientRect();
  showAt(r.right - 190, r.bottom + 6, items);
}

function onDocDown(e: PointerEvent) {
  if (open && !open.contains(e.target as Node)) closeMenu();
}
function onEsc(e: KeyboardEvent) {
  if (e.key === "Escape") closeMenu();
}

export function closeMenu() {
  if (!open) return;
  open.remove();
  open = null;
  window.removeEventListener("keydown", onEsc);
  window.removeEventListener("pointerdown", onDocDown);
}

export function boardMenu(board: Board, anchor: HTMLElement) {
  fromAnchor(anchor, [
    { label: "Add column", icon: "column", run: () => { const c = ctx.store.addColumn(board.id); if (c) ctx.requestColumnRename(c.id); } },
    { label: "Rename board", icon: "board", run: () => renameBoardInline(board) },
    SEP,
    { label: "Delete board", icon: "trash", danger: true, run: () => {
      ctx.store.deleteBoard(board.id);
      playSound("delete");
      ctx.toast(`Deleted <b>${escapeHtml(board.title)}</b>`);
    } },
  ]);
}

export function columnMenu(board: Board, column: Column, anchor: HTMLElement) {
  const idx = board.columns.findIndex((c) => c.id === column.id);
  fromAnchor(anchor, [
    { label: "Add card", icon: "plus", kbd: "N", run: () => ctx.startCapture(column.id) },
    { label: "Insert column right", icon: "plus", run: () => { const c = ctx.store.addColumnAt(board.id, idx + 1); if (c) ctx.requestColumnRename(c.id); } },
    SEP,
    { label: "Delete column", icon: "trash", danger: true, run: () => {
      ctx.store.deleteColumn(column.id);
      playSound("delete");
      ctx.toast(`Deleted column <b>${escapeHtml(column.name)}</b>`);
    } },
  ]);
}

export function cardMenu(card: Card, x: number, y: number) {
  const canAdvance = !!ctx.store.nextColumnOf(card.id);
  showAt(x, y, [
    { label: "Edit card", icon: "enter", kbd: "↵", run: () => ctx.openDetail(card.id) },
    ...(canAdvance ? [{ label: "Advance", icon: "advance" as const, kbd: "A", run: () => ctx.advance(card.id) }] : []),
    SEP,
    { label: "Delete card", icon: "trash", danger: true, kbd: "⌫", run: () => ctx.deleteCard(card.id) },
  ]);
}

function renameBoardInline(board: Board) {
  const h2 = ctx.world.querySelector<HTMLElement>(`[data-board-title="${board.id}"]`);
  if (!h2) return;
  const input = el("input", { class: "rename-input", data: { testid: "board-rename-input" }, attrs: { value: board.title, "aria-label": "Rename board" } });
  input.style.fontFamily = "var(--serif)";
  input.style.fontSize = "1.32rem";
  h2.replaceWith(input);
  input.focus(); input.select();
  const commit = () => ctx.store.renameBoard(board.id, input.value);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    else if (e.key === "Escape") ctx.rerender();
  });
  input.addEventListener("blur", commit);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}
