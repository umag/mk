import { clear, el, svg } from "./dom";
import { icons } from "./icons";
import { ctx } from "./context";
import { collectLabels, type LabelUse, labelHue, toggleInFilter } from "./core/labels";

// Label filtering UI: a top-bar funnel button opens a popover of labels-in-use,
// a filter bar shows the active selection, and clicking a label chip anywhere
// toggles it. The selection lives in view.labelFilter (transient); every change
// goes through ctx.rerender() so the canvas and this UI stay in lock-step.

/** A small label chip; `--lh` carries the derived hue so CSS does the colour. */
export function labelChip(
  name: string,
  opts: { active?: boolean; onClick?: () => void; onRemove?: () => void; title?: string } = {},
): HTMLElement {
  const chip = el("button", {
    class: `label-chip${opts.active ? " is-active" : ""}`,
    data: { testid: "label-chip", label: name },
    style: { "--lh": String(labelHue(name)) } as Record<string, string>,
    attrs: { type: "button", title: opts.title ?? (opts.onClick ? `Filter by ${name}` : name) },
    on: {
      // never let a chip start a card/board drag
      pointerdown: (e: PointerEvent) => e.stopPropagation(),
      ...(opts.onClick ? { click: (e: MouseEvent) => { e.stopPropagation(); opts.onClick!(); } } : {}),
    },
  }, el("span", { class: "label-dot" }), el("span", { class: "label-text", text: name }));
  if (opts.onRemove) {
    chip.appendChild(
      el("span", {
        class: "label-x",
        data: { testid: "label-remove" },
        attrs: { role: "button", "aria-label": `Remove ${name}` },
        on: { click: (e: MouseEvent) => { e.stopPropagation(); opts.onRemove!(); } },
      }, svg(icons.close)),
    );
  }
  return chip;
}

export function setLabelFilter(names: string[]) {
  ctx.store.view.labelFilter = names;
  ctx.rerender();
}

export function toggleLabelFilter(name: string) {
  setLabelFilter(toggleInFilter(ctx.store.view.labelFilter, name));
}

export function clearLabelFilter() {
  if (ctx.store.view.labelFilter.length) setLabelFilter([]);
}

// ---- the active-filter bar (below the top bar) ----

/** Re-sync the funnel badge + filter bar. Called at the end of every render. */
export function updateFilterBar() {
  const filter = ctx.store.view.labelFilter;
  const badge = document.querySelector<HTMLElement>(".filter-count");
  if (badge) {
    badge.textContent = filter.length ? String(filter.length) : "";
    badge.classList.toggle("on", filter.length > 0);
  }
  const bar = document.querySelector<HTMLElement>(".filter-bar");
  if (!bar) return;
  clear(bar);
  if (!filter.length || ctx.store.view.archiveOpen) { bar.style.display = "none"; return; }
  bar.style.display = "flex";
  bar.appendChild(svg(icons.filter, "filter-bar-icon"));
  bar.appendChild(el("span", { class: "filter-bar-label", text: "Showing cards labelled" }));
  for (const name of filter) {
    bar.appendChild(labelChip(name, { active: true, onRemove: () => toggleLabelFilter(name) }));
  }
  bar.appendChild(
    el("button", {
      class: "filter-clear",
      data: { testid: "filter-clear" },
      attrs: { type: "button" },
      on: { click: clearLabelFilter },
    }, "Clear"),
  );
}

// ---- bespoke label input with a themed suggestion popover ----
// (No native <datalist>: its combobox arrow can't be themed — same reason the
//  date picker is bespoke. Auto-sizes to its content; suggests labels-in-use.)

let lsEl: HTMLElement | null = null;
let lsItems: LabelUse[] = [];
let lsActive = -1;

export function isLabelSuggestOpen() {
  return !!lsEl;
}

export function closeLabelSuggest() {
  if (!lsEl) return;
  lsEl.remove();
  lsEl = null;
  lsItems = [];
  lsActive = -1;
  window.removeEventListener("pointerdown", onLsDown, true);
}

function onLsDown(e: PointerEvent) {
  const t = e.target as Node;
  if (lsEl && !lsEl.contains(t) && !(t instanceof Element && t.closest(".label-add"))) closeLabelSuggest();
}

export function labelInput(opts: {
  existing: () => string[];
  onAdd: (name: string) => void;
  onStop?: () => void;
}): HTMLInputElement {
  const input = el("input", {
    class: "label-add",
    data: { testid: "card-detail-label-input" },
    attrs: { type: "text", placeholder: "label…", "aria-label": "Add a label", autocomplete: "off", maxlength: "24", size: "6" },
  }) as HTMLInputElement;

  const resize = () => { input.size = Math.max(6, input.value.length + 1); };

  const compute = (): LabelUse[] => {
    const q = input.value.trim().toLowerCase();
    const have = new Set(opts.existing().map((l) => l.toLowerCase()));
    return collectLabels(ctx.store.world)
      .filter((l) => !have.has(l.name.toLowerCase()) && (!q || l.name.toLowerCase().includes(q)))
      .slice(0, 6);
  };

  const paintActive = () => {
    lsEl?.querySelectorAll(".label-suggest-item").forEach((n, i) => n.classList.toggle("active", i === lsActive));
  };

  const render = () => {
    lsItems = compute();
    if (!lsItems.length) { closeLabelSuggest(); return; }
    if (lsActive >= lsItems.length) lsActive = -1;
    if (!lsEl) {
      lsEl = el("div", { class: "label-suggest", data: { testid: "label-suggest" }, attrs: { role: "listbox" } });
      document.body.appendChild(lsEl);
      setTimeout(() => window.addEventListener("pointerdown", onLsDown, true));
    }
    clear(lsEl);
    lsItems.forEach((it, i) => {
      lsEl!.appendChild(el("button", {
        class: `label-suggest-item${i === lsActive ? " active" : ""}`,
        data: { testid: "label-suggest-item", label: it.name },
        attrs: { type: "button", role: "option" },
        on: {
          pointerdown: (e: MouseEvent) => e.preventDefault(), // keep the input focused
          click: () => add(it.name),
          pointermove: () => { if (lsActive !== i) { lsActive = i; paintActive(); } },
        },
      }, labelChip(it.name), el("span", { class: "label-suggest-count", text: String(it.count) })));
    });
    const r = input.getBoundingClientRect();
    lsEl.style.left = `${r.left}px`;
    lsEl.style.top = `${r.bottom + 5}px`;
  };

  const add = (name: string) => {
    closeLabelSuggest();
    input.value = "";
    resize();
    opts.onAdd(name);
    input.focus();
    render(); // surface the remaining suggestions for burst-adding
  };

  input.addEventListener("focus", () => { lsActive = -1; render(); });
  input.addEventListener("input", () => { resize(); lsActive = -1; render(); });
  input.addEventListener("blur", () => setTimeout(() => {
    if (document.activeElement?.classList.contains("label-add")) return; // refocus during burst
    closeLabelSuggest();
    if (!input.value.trim()) opts.onStop?.();
  }, 150));
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); if (lsItems.length) { lsActive = (lsActive + 1) % lsItems.length; paintActive(); } }
    else if (e.key === "ArrowUp") { e.preventDefault(); if (lsItems.length) { lsActive = (lsActive - 1 + lsItems.length) % lsItems.length; paintActive(); } }
    else if (e.key === "Enter") {
      e.preventDefault();
      const chosen = lsActive >= 0 && lsItems[lsActive] ? lsItems[lsActive]!.name : input.value.trim();
      if (chosen) add(chosen);
    } else if (e.key === "Escape") {
      e.stopPropagation();
      if (lsEl) closeLabelSuggest();
      else opts.onStop?.();
    }
  });
  resize();
  return input;
}

// ---- the funnel popover (pick from labels-in-use) ----

let pop: HTMLElement | null = null;

export function isFilterPopoverOpen() {
  return !!pop;
}

export function closeFilterPopover() {
  if (!pop) return;
  pop.remove();
  pop = null;
  window.removeEventListener("pointerdown", onDocDown);
  window.removeEventListener("keydown", onEsc);
}

function onDocDown(e: PointerEvent) {
  const t = e.target as Node;
  if (pop && !pop.contains(t) && !(t instanceof Element && t.closest(".filter-btn"))) closeFilterPopover();
}
function onEsc(e: KeyboardEvent) {
  if (e.key === "Escape") { e.stopPropagation(); closeFilterPopover(); }
}

export function openFilterPopover(anchor: HTMLElement) {
  if (pop) { closeFilterPopover(); return; }
  pop = el("div", { class: "filter-pop", data: { testid: "filter-popover" }, attrs: { role: "dialog", "aria-label": "Filter by label" } });
  paint();
  document.body.appendChild(pop);
  const r = anchor.getBoundingClientRect();
  const pw = pop.offsetWidth;
  pop.style.left = `${Math.max(8, Math.min(r.left, innerWidth - pw - 8))}px`;
  pop.style.top = `${r.bottom + 6}px`;
  setTimeout(() => {
    window.addEventListener("pointerdown", onDocDown);
    window.addEventListener("keydown", onEsc);
  });
}

function paint() {
  if (!pop) return;
  clear(pop);
  const labels = collectLabels(ctx.store.world);
  const filter = ctx.store.view.labelFilter;

  pop.appendChild(el("div", { class: "filter-pop-head", text: "Filter by label" }));

  if (!labels.length) {
    pop.appendChild(el("div", { class: "filter-pop-empty", text: "No labels yet. Add one from a card." }));
    return;
  }

  const listEl = el("div", { class: "filter-pop-list", attrs: { role: "listbox" } });
  for (const { name, count } of labels) {
    const active = filter.some((f) => f.toLowerCase() === name.toLowerCase());
    listEl.appendChild(
      el("button", {
        class: `filter-pop-item${active ? " active" : ""}`,
        data: { testid: "filter-option", label: name },
        attrs: { type: "button", role: "option", "aria-selected": active ? "true" : "false" },
        on: { click: () => { toggleLabelFilter(name); paint(); } },
      },
        el("span", { class: `filter-check${active ? " on" : ""}` }, active ? svg(icons.check) : null),
        labelChip(name),
        el("span", { class: "filter-pop-count", text: String(count) }),
      ),
    );
  }
  pop.appendChild(listEl);

  if (filter.length) {
    pop.appendChild(
      el("button", {
        class: "filter-pop-clear",
        data: { testid: "filter-popover-clear" },
        attrs: { type: "button" },
        on: { click: () => { clearLabelFilter(); paint(); } },
      }, "Clear filter"),
    );
  }
}
