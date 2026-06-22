import { clear, el, svg } from "./dom";
import { icons } from "./icons";
import { ctx } from "./context";
import { collectLabels, labelHue, toggleInFilter } from "./core/labels";

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
