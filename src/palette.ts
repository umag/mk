import { clear, el, svg } from "./dom";
import { icons, type IconName } from "./icons";
import { ctx } from "./context";
import { collapseAllBoards, computeBoardSpot } from "./render";
import { isArchiveBoard } from "./core/done";
import { collectLabels } from "./core/labels";
import { clearLabelFilter, setLabelFilter } from "./filter";
import { boardSnapOn, toggleBoardSnap } from "./settings";

/** Switch to the hidden Archive board and frame it. */
export function enterArchive() {
  const s = ctx.store;
  s.ensureArchiveBoard();
  s.view.archiveOpen = true;
  ctx.setFocus(null);
  ctx.rerender();
  const a = s.archiveBoard;
  if (a) {
    requestAnimationFrame(() => {
      const elm = ctx.world.querySelector<HTMLElement>(`[data-board-id="${a.id}"]`);
      ctx.centerOn(a.x, a.y, elm?.offsetWidth ?? 280, elm?.offsetHeight ?? 220);
    });
  }
}

/** Return to the normal canvas from the Archive view. */
export function exitArchive() {
  const s = ctx.store;
  if (!s.view.archiveOpen) return;
  s.view.archiveOpen = false;
  ctx.rerender();
  const b0 = s.world.boards.find((b) => !isArchiveBoard(b));
  if (b0) {
    requestAnimationFrame(() => {
      const elm = ctx.world.querySelector<HTMLElement>(`[data-board-id="${b0.id}"]`);
      ctx.centerOn(b0.x, b0.y, elm?.offsetWidth ?? 280, elm?.offsetHeight ?? 220);
    });
  }
}

interface Cmd {
  group: string;
  icon: IconName;
  label: string;
  sub?: string;
  meta?: string;
  /** Extra text folded into search matching but not shown (e.g. a card's labels). */
  keywords?: string;
  run: () => void;
}

let backdrop: HTMLElement | null = null;
let panel: HTMLElement | null = null;
let input: HTMLInputElement | null = null;
let list: HTMLElement | null = null;
let filtered: Cmd[] = [];
let active = 0;

export function isPaletteOpen() {
  return !!panel;
}

export function openPalette() {
  if (panel) return;
  ctx.store.view.paletteOpen = true;
  backdrop = el("div", { class: "backdrop", on: { pointerdown: closePalette } });
  panel = el("div", { class: "cmdk", data: { testid: "command-palette" }, attrs: { role: "dialog", "aria-modal": "true", "aria-label": "Command palette" } });
  input = el("input", {
    class: "cmdk-input",
    data: { testid: "command-palette-input" },
    attrs: { type: "text", placeholder: "Search boards & cards, or run a command…", "aria-label": "Command palette", autocomplete: "off" },
  });
  list = el("div", { class: "cmdk-list", attrs: { role: "listbox" } });
  panel.append(
    el("div", { class: "cmdk-head" }, svg(icons.search), input),
    list,
  );
  document.body.append(backdrop, panel);
  input.addEventListener("input", refresh);
  input.addEventListener("keydown", onKey);
  refresh();
  input.focus();
}

export function closePalette() {
  if (!panel) return;
  ctx.store.view.paletteOpen = false;
  backdrop?.remove();
  panel.remove();
  backdrop = panel = input = list = null;
}

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") { e.preventDefault(); closePalette(); }
  else if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
  else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
  else if (e.key === "Enter") { e.preventDefault(); filtered[active]?.run(); }
}

function move(d: number) {
  if (!filtered.length) return;
  active = (active + d + filtered.length) % filtered.length;
  paint();
  list?.querySelector(".cmdk-item.active")?.scrollIntoView({ block: "nearest" });
}

function buildAll(): Cmd[] {
  const s = ctx.store;
  const cmds: Cmd[] = s.view.archiveOpen
    ? [{ group: "Actions", icon: "board", label: "Back to canvas", sub: "Leave the Archive", run: () => { closePalette(); exitArchive(); } }]
    : [
      { group: "Actions", icon: "plus", label: "New board", sub: "Add a board to the canvas", run: () => {
        const spot = computeBoardSpot();
        const b = s.addBoard(spot.x, spot.y);
        closePalette();
        ctx.centerOn(b.x, b.y, 280, 220);
        ctx.requestColumnRename(b.columns[0]!.id);
      } },
      { group: "Actions", icon: "jump", label: "Zoom to fit", sub: "Frame every board", run: () => { closePalette(); fitAll(); } },
      { group: "Actions", icon: "chevronUp", label: "Collapse all boards", sub: "Fold every board to a bar", run: () => { closePalette(); collapseAllBoards(); } },
      { group: "Actions", icon: "chevronDown", label: "Expand all boards", sub: "Unfold every board", run: () => { closePalette(); s.setAllBoardsCollapsed(false); } },
      {
        group: "Actions",
        icon: "board",
        label: boardSnapOn() ? "Disable board snapping" : "Enable board snapping",
        sub: boardSnapOn() ? "Let boards float freely on drop" : "Magnet boards to the anchor on drop",
        // Just flip the setting — don't rerender, so enabling snapping leaves the current
        // layout untouched. Snapping applies to future drops/folds, not retroactively.
        run: () => { closePalette(); toggleBoardSnap(); },
      },
      { group: "Actions", icon: "box", label: "Go to Archive", sub: "Done cards land here after 10 days", run: () => { closePalette(); enterArchive(); } },
    ];
  for (const b of s.world.boards) {
    if (isArchiveBoard(b)) continue; // the Archive is reached via its own command
    const n = b.columns.reduce((a, c) => a + c.cards.length, 0);
    cmds.push({
      group: "Boards", icon: "board", label: b.title, sub: `${b.columns.length} columns · ${n} cards`,
      run: () => { closePalette(); revealBoard(b.id); },
    });
  }
  // Filter by label — pick a label to narrow the canvas to its cards.
  if (!s.view.archiveOpen) {
    for (const { name, count } of collectLabels(s.world)) {
      cmds.push({
        group: "Filter by label", icon: "tag", label: `#${name}`, sub: `${count} card${count === 1 ? "" : "s"}`,
        keywords: name,
        run: () => { closePalette(); setLabelFilter([name]); },
      });
    }
    if (s.view.labelFilter.length) {
      cmds.push({
        group: "Filter by label", icon: "close", label: "Clear label filter",
        sub: `Active: ${s.view.labelFilter.join(", ")}`,
        run: () => { closePalette(); clearLabelFilter(); },
      });
    }
  }
  for (const b of s.world.boards) {
    if (isArchiveBoard(b)) continue;
    for (const col of b.columns) {
      for (const card of col.cards) {
        cmds.push({
          group: "Cards", icon: "advance", label: card.title, sub: `${b.title} · ${col.name}`,
          meta: card.due ?? undefined,
          keywords: card.labels.join(" "),
          run: () => { closePalette(); revealBoard(b.id); ctx.setFocus(card.id, { reveal: true }); ctx.openDetail(card.id); },
        });
      }
    }
  }
  return cmds;
}

function refresh() {
  const q = (input?.value ?? "").trim().toLowerCase();
  const all = buildAll();
  if (!q) {
    // default view: actions + boards + first handful of cards
    const cards = all.filter((c) => c.group === "Cards").slice(0, 5);
    filtered = [...all.filter((c) => c.group !== "Cards"), ...cards];
  } else {
    filtered = all.filter((c) => (c.label + " " + (c.sub ?? "") + " " + (c.keywords ?? "")).toLowerCase().includes(q));
  }
  active = 0;
  paint();
}

function paint() {
  if (!list) return;
  clear(list);
  if (!filtered.length) {
    list.appendChild(el("div", { class: "cmdk-empty", text: "No matches" }));
    return;
  }
  let lastGroup = "";
  filtered.forEach((c, i) => {
    if (c.group !== lastGroup) {
      list!.appendChild(el("div", { class: "cmdk-group-label", text: c.group }));
      lastGroup = c.group;
    }
    list!.appendChild(
      el("button", {
        class: `cmdk-item${i === active ? " active" : ""}`,
        data: { testid: "command-palette-item" },
        attrs: { role: "option" },
        on: { click: () => c.run(), pointermove: () => { if (active !== i) { active = i; paint(); } } },
      },
        el("span", { class: "ic" }, svg(icons[c.icon])),
        el("span", {}, el("div", { text: c.label }), c.sub ? el("div", { class: "sub", text: c.sub }) : null),
        c.meta ? el("span", { class: "meta", text: c.meta }) : null,
      ),
    );
  });
}

function revealBoard(boardId: string) {
  const s = ctx.store;
  const b = s.findBoard(boardId);
  if (!b) return;
  if (s.view.archiveOpen) { s.view.archiveOpen = false; ctx.rerender(); } // jumping out of the Archive
  requestAnimationFrame(() => {
    const elm = ctx.world.querySelector<HTMLElement>(`[data-board-id="${boardId}"]`);
    ctx.centerOn(b.x, b.y, elm?.offsetWidth ?? 280, elm?.offsetHeight ?? 200);
  });
}

function fitAll() {
  const s = ctx.store;
  const boards = s.world.boards.filter((b) => !isArchiveBoard(b));
  if (!boards.length) return;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const b of boards) {
    const elm = ctx.world.querySelector<HTMLElement>(`[data-board-id="${b.id}"]`);
    const w = elm?.offsetWidth ?? 280, h = elm?.offsetHeight ?? 200;
    minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + w); maxY = Math.max(maxY, b.y + h);
  }
  ctx.centerOn(minX, minY, maxX - minX, maxY - minY);
}
