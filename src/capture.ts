import { el, svg } from "./dom";
import { icons } from "./icons";
import { ctx } from "./context";
import { afterRender, updateFocusRing } from "./render";
import { playSound } from "./sound";

let activeColumnId: string | null = null;
let suppressBlur = false;

export function initCapture() {
  // re-inject the live input after every re-render so capture survives card adds
  afterRender.push(reapply);
}

export function startCapture(columnId: string) {
  activeColumnId = columnId;
  const wrap = cardsWrap(columnId);
  if (wrap) inject(wrap, columnId);
  else ctx.rerender();
}

export function stopCapture() {
  if (!activeColumnId) return;
  suppressBlur = true;
  activeColumnId = null;
  ctx.rerender();
}

function cardsWrap(columnId: string): HTMLElement | null {
  return ctx.world.querySelector<HTMLElement>(`[data-col-cards="${columnId}"]`);
}

function reapply() {
  if (!activeColumnId) return;
  const wrap = cardsWrap(activeColumnId);
  if (!wrap) { activeColumnId = null; return; }
  inject(wrap, activeColumnId);
}

function inject(wrap: HTMLElement, columnId: string) {
  suppressBlur = false;
  wrap.querySelector(".col-empty")?.remove();
  if (wrap.querySelector(".capture-row")) return;

  const input = el("input", {
    data: { testid: "capture-input" },
    attrs: { type: "text", placeholder: "Capture a thought…", "aria-label": "New card title", autocomplete: "off" },
  });
  const row = el("div", { class: "capture-row" }, svg(icons.plus), input);

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = input.value.trim();
      if (!val) { stopCapture(); return; }
      suppressBlur = true;
      input.value = "";
      const card = ctx.store.addCard(columnId, val, true); // → rerender → reapply (fresh input on top)
      if (card) {
        ctx.store.view.focusedCardId = card.id; // focus the new card
        updateFocusRing();
        playSound("add");
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      stopCapture();
    }
  });

  input.addEventListener("blur", () => {
    if (suppressBlur) return;
    const val = input.value.trim();
    const col = activeColumnId;
    activeColumnId = null;
    if (val && col) {
      const card = ctx.store.addCard(col, val, true);
      if (card) { ctx.store.view.focusedCardId = card.id; updateFocusRing(); playSound("add"); }
    } else {
      ctx.rerender();
    }
  });

  wrap.prepend(row);
  input.focus();
}
