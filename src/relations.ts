import { clear, el, svg } from "./dom";
import { icons } from "./icons";
import { ctx } from "./context";
import { findCard } from "./core/state";
import { isCardDone } from "./core/relations";
import { isArchiveBoard } from "./core/done";
import type { ID } from "./types";

// UI for card relationships (dependencies + subtasks): a bespoke "pick a card"
// popover and a row renderer for a related card. Same picker drives both the
// "blocked by" and "add subtask" flows.

let pick: HTMLElement | null = null;

export function isCardPickerOpen() {
  return !!pick;
}
export function closeCardPicker() {
  if (!pick) return;
  pick.remove();
  pick = null;
  window.removeEventListener("pointerdown", onDown, true);
}
function onDown(e: PointerEvent) {
  if (pick && !pick.contains(e.target as Node)) closeCardPicker();
}

/** Bespoke "pick a card" popover. `exclude` hides self + already-related cards. */
export function openCardPicker(anchor: HTMLElement, opts: { exclude: Set<ID>; onPick: (id: ID) => void; placeholder?: string }) {
  if (pick) { closeCardPicker(); return; }
  let q = "";
  pick = el("div", { class: "card-pick", data: { testid: "card-picker" }, attrs: { role: "dialog", "aria-label": "Pick a card" } });
  const input = el("input", {
    class: "card-pick-input",
    data: { testid: "card-picker-input" },
    attrs: { type: "text", placeholder: opts.placeholder ?? "Search cards…", "aria-label": "Search cards", autocomplete: "off" },
  });
  const list = el("div", { class: "card-pick-list", attrs: { role: "listbox" } });
  pick.append(el("div", { class: "card-pick-head" }, svg(icons.search), input), list);
  document.body.appendChild(pick);
  const r = anchor.getBoundingClientRect();
  pick.style.left = `${Math.max(8, Math.min(r.left, innerWidth - pick.offsetWidth - 8))}px`;
  pick.style.top = `${r.bottom + 6}px`;

  const candidates = () => {
    const ql = q.trim().toLowerCase();
    const out: Array<{ id: ID; title: string; sub: string }> = [];
    for (const b of ctx.store.world.boards) {
      if (isArchiveBoard(b)) continue;
      for (const col of b.columns) {
        for (const k of col.cards) {
          if (opts.exclude.has(k.id)) continue;
          if (ql && !k.title.toLowerCase().includes(ql)) continue;
          out.push({ id: k.id, title: k.title, sub: `${b.title} · ${col.name}` });
          if (out.length >= 8) return out;
        }
      }
    }
    return out;
  };
  const paint = () => {
    clear(list);
    const items = candidates();
    if (!items.length) {
      list.appendChild(el("div", { class: "card-pick-empty", text: q ? "No matches" : "No other cards" }));
      return;
    }
    for (const it of items) {
      list.appendChild(el("button", {
        class: "card-pick-item",
        data: { testid: "card-picker-item", cardId: it.id },
        attrs: { type: "button", role: "option" },
        on: { click: () => { opts.onPick(it.id); closeCardPicker(); } },
      }, el("span", { class: "rel-title", text: it.title }), el("span", { class: "rel-sub", text: it.sub })));
    }
  };
  input.addEventListener("input", () => { q = input.value; paint(); });
  input.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); closeCardPicker(); } });
  paint();
  setTimeout(() => {
    input.focus();
    window.addEventListener("pointerdown", onDown, true);
  });
}

/** A row for a related card — navigate on click, optional ✕ to remove. */
export function relatedCardRow(
  cardId: ID,
  opts: { icon: keyof typeof icons; onOpen: () => void; onRemove?: () => void; showDone?: boolean },
): HTMLElement | null {
  const loc = findCard(ctx.store.world, cardId);
  if (!loc) return null; // dangling (target deleted) — skip
  const done = !!opts.showDone && isCardDone(ctx.store.world, cardId);
  const row = el("div", { class: `rel-row${done ? " is-done" : ""}`, data: { testid: "rel-card", cardId } },
    el("button", {
      class: "rel-main",
      attrs: { type: "button", title: "Open card" },
      on: { click: (e: MouseEvent) => { e.stopPropagation(); opts.onOpen(); } },
    },
      svg(icons[opts.icon], "rel-ic"),
      el("span", { class: "rel-text" },
        el("span", { class: "rel-title", text: loc.card.title }),
        el("span", { class: "rel-sub", text: `${loc.board.title} · ${loc.column.name}` })),
      done ? el("span", { class: "rel-done", text: "done" }) : null,
    ),
  );
  if (opts.onRemove) {
    row.appendChild(el("button", {
      class: "rel-x",
      data: { testid: "rel-card-remove" },
      attrs: { type: "button", "aria-label": "Remove" },
      on: { click: (e: MouseEvent) => { e.stopPropagation(); opts.onRemove!(); } },
    }, svg(icons.close)));
  }
  return row;
}
