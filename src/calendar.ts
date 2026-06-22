import { clear, el, svg } from "./dom";
import { icons } from "./icons";

// A bespoke date picker matching the Night Editorial system — replaces the
// browser's native date control (which can't be themed). Opens as a fixed
// popover anchored to a field, escaping the card-detail sheet's overflow.
// Keyboard-first: arrows move the cursor, Enter picks, Esc closes.

let open: HTMLElement | null = null;
let cleanup: (() => void) | null = null;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]; // week starts Monday

const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

function parseISO(iso: string | null): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isCalendarOpen(): boolean {
  return open !== null;
}

export function closeCalendar(): void {
  if (!open) return;
  open.remove();
  open = null;
  cleanup?.();
  cleanup = null;
}

/**
 * Open the date picker anchored under `anchor`. `onPick(iso)` receives the chosen
 * ISO date, or `null` when cleared. The popover closes itself after a choice.
 */
export function openCalendar(
  anchor: HTMLElement,
  currentISO: string | null,
  onPick: (iso: string | null) => void,
): void {
  closeCalendar();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selected = parseISO(currentISO);
  let view = new Date(selected ?? today);
  view.setDate(1);
  let cursor = new Date(selected ?? today); // keyboard cursor

  const pop = el("div", {
    class: "cal-pop",
    data: { testid: "calendar" },
    attrs: { role: "dialog", "aria-label": "Choose a due date" },
  });

  const pick = (d: Date) => { onPick(isoOf(d)); closeCalendar(); };
  const shiftMonth = (n: number) => { view = new Date(view.getFullYear(), view.getMonth() + n, 1); render(); };

  function render() {
    clear(pop);

    pop.appendChild(el(
      "div",
      { class: "cal-head" },
      el("button", {
        class: "cal-nav",
        attrs: { "aria-label": "Previous month" },
        on: { click: () => shiftMonth(-1) },
      }, svg(icons.chevronLeft)),
      el("div", { class: "cal-title", data: { testid: "calendar-title" }, text: `${MONTHS[view.getMonth()]} ${view.getFullYear()}` }),
      el("button", {
        class: "cal-nav",
        attrs: { "aria-label": "Next month" },
        on: { click: () => shiftMonth(1) },
      }, svg(icons.chevronRight)),
    ));

    const grid = el("div", { class: "cal-grid" });
    for (const w of WEEKDAYS) grid.appendChild(el("div", { class: "cal-wd", text: w }));

    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7; // days from Monday to the 1st
    const start = addDays(first, -offset);
    for (let i = 0; i < 42; i++) {
      const d = addDays(start, i);
      const cls = ["cal-day"];
      if (d.getMonth() !== view.getMonth()) cls.push("other");
      if (sameDay(d, today)) cls.push("today");
      if (selected && sameDay(d, selected)) cls.push("selected");
      if (sameDay(d, cursor)) cls.push("cursor");
      grid.appendChild(el("button", {
        class: cls.join(" "),
        data: { testid: "calendar-day" },
        attrs: {
          tabindex: "-1",
          "aria-label": d.toDateString(),
          "aria-current": sameDay(d, today) ? "date" : false,
          "aria-selected": selected && sameDay(d, selected) ? "true" : false,
        },
        on: { click: () => pick(d) },
      }, String(d.getDate())));
    }
    pop.appendChild(grid);

    pop.appendChild(el(
      "div",
      { class: "cal-foot" },
      el("button", { class: "cal-foot-btn", data: { testid: "calendar-today" }, on: { click: () => pick(today) } }, "Today"),
      el("button", { class: "cal-foot-btn", data: { testid: "calendar-clear" }, on: { click: () => { onPick(null); closeCalendar(); } } }, "Clear"),
    ));
  }

  render();
  document.body.appendChild(pop);

  // position: fixed, under the anchor, clamped to the viewport, flipping up if needed
  const r = anchor.getBoundingClientRect();
  const pw = pop.offsetWidth;
  const ph = pop.offsetHeight;
  const left = Math.max(8, Math.min(r.left, innerWidth - pw - 8));
  let top = r.bottom + 6;
  if (top + ph > innerHeight - 8) top = Math.max(8, r.top - ph - 6);
  pop.style.left = `${left}px`;
  pop.style.top = `${top}px`;

  const onKey = (e: KeyboardEvent) => {
    let delta = 0;
    switch (e.key) {
      case "Escape": e.preventDefault(); e.stopPropagation(); closeCalendar(); return;
      case "Enter": e.preventDefault(); e.stopPropagation(); pick(cursor); return;
      case "ArrowLeft": delta = -1; break;
      case "ArrowRight": delta = 1; break;
      case "ArrowUp": delta = -7; break;
      case "ArrowDown": delta = 7; break;
      case "PageUp": e.preventDefault(); e.stopPropagation(); shiftMonth(-1); return;
      case "PageDown": e.preventDefault(); e.stopPropagation(); shiftMonth(1); return;
      default: return;
    }
    e.preventDefault();
    e.stopPropagation();
    cursor = addDays(cursor, delta);
    view = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    render();
  };
  const onDown = (e: PointerEvent) => {
    if (open && !open.contains(e.target as Node) && !anchor.contains(e.target as Node)) closeCalendar();
  };
  // defer so the click that opened the popover doesn't immediately close it
  setTimeout(() => {
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onDown, true);
  });
  cleanup = () => {
    window.removeEventListener("keydown", onKey, true);
    window.removeEventListener("pointerdown", onDown, true);
  };
  open = pop;
}
