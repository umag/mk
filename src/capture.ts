import { el, isUrl, svg } from "./dom";
import { icons } from "./icons";
import { ctx } from "./context";
import { afterRender, updateFocusRing } from "./render";
import { playSound } from "./sound";
import { unfurl } from "./sync/client";

let activeColumnId: string | null = null;
let suppressBlur = false;
let captureAtTop = true; // false = quick-add at the bottom of the column (hover affordance)

/**
 * Add a card and focus it. When the text is a pasted link, drop the URL into the
 * notes immediately and fetch the page title in the background to become the card
 * title (falls back to leaving the URL as the title if the fetch yields nothing).
 */
function commitCard(columnId: string, val: string) {
  const card = ctx.store.addCard(columnId, val, captureAtTop);
  if (!card) return;
  ctx.store.view.focusedCardId = card.id;
  updateFocusRing();
  playSound("add");
  if (isUrl(val)) {
    // Defer the URL→notes (and fetched title) to the async unfurl result, so we
    // don't fire a second synchronous rerender inside the capture keydown — that
    // races the capture-input reapply and throws before unfurl is even called.
    unfurl(val).then((title) => {
      ctx.store.updateCard(card.id, title ? { notes: val, title } : { notes: val });
    });
  }
}

export function initCapture() {
  // re-inject the live input after every re-render so capture survives card adds
  afterRender.push(reapply);
}

export function startCapture(columnId: string, atTop = true) {
  captureAtTop = atTop;
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
  // Guarded: a concurrent re-render (e.g. an async unfurl title update) can
  // detach this node first — removing it again throws otherwise.
  try { wrap.querySelector(".col-empty")?.remove(); } catch { /* already detached */ }
  try { wrap.querySelector(".col-add")?.remove(); } catch { /* already detached */ }
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
      commitCard(columnId, val); // → rerender → reapply (fresh input on top)
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
    if (val && col) commitCard(col, val);
    else ctx.rerender();
  });

  if (captureAtTop) wrap.prepend(row);
  else wrap.append(row);
  input.focus();
}
