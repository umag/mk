import { autoGrow, clear, el, linkify, svg } from "./dom";
import { icons } from "./icons";
import { ctx } from "./context";
import { sinceLabel } from "./store";
import { dueLabel, dueStateOf } from "./core/due";
import { closeCalendar, isCalendarOpen, openCalendar } from "./calendar";
import { closeLabelSuggest, isLabelSuggestOpen, labelChip, labelInput } from "./filter";
import { type Item, isMenuOpen, openMenu } from "./menu";
import { closeCardPicker, isCardPickerOpen, openCardPicker, relatedCardRow } from "./relations";
import { blockersOf, childProgress, childrenOf } from "./core/relations";
import { playSound } from "./sound";
import type { Card, ID } from "./types";

let backdrop: HTMLElement | null = null;
let sheet: HTMLElement | null = null;
let currentId: string | null = null;
let editingNotes = false;
let addingLabel = false;

export function openDetail(cardId: string) {
  if (!ctx.store.findCard(cardId)) return;
  currentId = cardId;
  ctx.store.view.detailCardId = cardId;
  editingNotes = false;
  addingLabel = false;

  backdrop = el("div", { class: "backdrop", on: { pointerdown: closeDetail } });
  sheet = el("div", { class: "detail", data: { testid: "card-detail" }, attrs: { role: "dialog", "aria-modal": "true", "aria-label": "Card detail" } });
  document.body.append(backdrop, sheet);
  rebuild();
  playSound("open");
  window.addEventListener("keydown", onKey, true);
}

export function closeDetail() {
  if (!sheet) return;
  flushDescription(); // persist any in-flight description edit before tearing down
  closeCalendar();
  closeLabelSuggest();
  closeCardPicker();
  window.removeEventListener("keydown", onKey, true);
  backdrop?.remove();
  sheet.remove();
  backdrop = sheet = null;
  ctx.store.view.detailCardId = null;
  currentId = null;
}

export function isDetailOpen() {
  return !!sheet;
}

function onKey(e: KeyboardEvent) {
  if (!sheet) return;
  // While a popover owns the keys, let it handle them (it closes on its own Esc).
  if (isCalendarOpen() || isMenuOpen() || isLabelSuggestOpen() || isCardPickerOpen()) return;
  const typing = isField(e.target);
  if (e.key === "Escape") {
    const t = e.target as HTMLElement | null;
    if (t?.dataset?.testid === "comment-input") return; // the composer handles Esc (discard)
    if (editingNotes) { flushDescription(); editingNotes = false; rebuild(); }
    else if (addingLabel) { addingLabel = false; rebuild(); }
    else closeDetail();
    e.stopPropagation();
    return;
  }
  if (typing) return;
  if (e.key.toLowerCase() === "w") { e.preventDefault(); e.stopPropagation(); closeDetail(); }
  else if (e.key.toLowerCase() === "a") { e.preventDefault(); e.stopPropagation(); advanceFromDetail(); }
  else if (e.key.toLowerCase() === "e") { e.preventDefault(); e.stopPropagation(); addingLabel = false; editingNotes = true; rebuild(); }
  else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); e.stopPropagation(); deleteFromDetail(); }
}

/** Persist the open description editor's current text (used before leaving edit mode). */
function flushDescription() {
  const ta = sheet?.querySelector<HTMLTextAreaElement>(".notes-edit");
  if (ta && currentId) ctx.store.updateCard(currentId, { notes: ta.value });
}

function deleteFromDetail() {
  if (!currentId) return;
  const id = currentId;
  closeDetail();
  ctx.deleteCard(id);
}

function advanceFromDetail() {
  if (!currentId) return;
  if (!ctx.store.nextColumnOf(currentId)) return;
  ctx.advance(currentId);
  rebuild();
}

function rebuild() {
  if (!sheet || !currentId) return;
  closeCalendar(); // the picker anchors to a field this rebuild is about to replace
  const loc = ctx.store.findCard(currentId);
  if (!loc) { closeDetail(); return; }
  const { board, column, card, colIndex } = loc;
  const next = board.columns[colIndex + 1] ?? null;
  const dueState = dueStateOf(card.due);
  const dueHot = dueState === "overdue"; // red is overdue-only (see DESIGN.md color-as-state)
  const dueWarm = dueState === "today" || dueState === "soon";
  clear(sheet);

  // header — crumb + delete + close (hotkey hints removed; buttons carry their own)
  sheet.appendChild(
    el(
      "div",
      { class: "detail-head" },
      el(
        "span",
        { class: "crumb" },
        el("span", { class: `dot${dueHot ? " hot" : dueWarm ? " soon" : ""}` }),
        el("b", { text: board.title }),
        el("span", { class: "sep", text: "/" }),
        el("span", { text: column.name }),
      ),
      el("span", { class: "meta-spacer" }),
      el("button", {
        class: "detail-close detail-danger",
        data: { testid: "card-detail-delete" },
        attrs: { "aria-label": "Delete card", title: "Delete card (⌫)" },
        on: { click: deleteFromDetail },
      }, svg(icons.trash)),
      el("button", {
        class: "detail-close",
        data: { testid: "card-detail-close" },
        attrs: { "aria-label": "Close", title: "Close (Esc / W)" },
        on: { click: closeDetail },
      }, svg(icons.close)),
    ),
  );

  // left column: title, meta, labels, description (scrolls independently)
  const body = el("div", { class: "detail-left" });

  // title (click to edit)
  const title = el("h1", {
    class: "detail-title",
    data: { testid: "card-detail-title" },
    text: card.title,
    attrs: { title: "Click to edit" },
    on: { click: () => editTitle(card) },
  });
  body.appendChild(title);

  // meta bar — only what's set; the "+" adds due date / label / description
  const meta = el("div", { class: "meta-bar" });
  const setDue = (iso: string | null) => { ctx.store.updateCard(card.id, { due: iso }); rebuild(); };
  if (card.due) {
    meta.appendChild(
    el(
      "div",
      {
        class: `field due-field${dueHot ? " due-hot" : dueWarm ? " due-soon" : ""}`,
        data: { testid: "card-detail-due" },
        on: {
          click: (e: MouseEvent) => {
            if ((e.target as HTMLElement).closest(".due-clear")) return;
            openCalendar(e.currentTarget as HTMLElement, card.due, setDue);
          },
        },
      },
      svg(icons.calendar),
      el("span", { class: "due-text", text: `Due ${dueLabel(card.due)}` }),
      el("button", {
        class: "due-clear",
        data: { testid: "card-detail-due-clear" },
        attrs: { "aria-label": "Clear due date", title: "Clear" },
        on: { click: (e: MouseEvent) => { e.stopPropagation(); setDue(null); } },
      }, svg(icons.close)),
    ),
    );
  }
  meta.appendChild(el("span", { class: "field" }, svg(icons.clock), el("span", { class: "lbl", text: "in column" }), ` ${sinceLabel(card.enteredColumnAt)}`));
  // the single "+" affordance — only offers what the card doesn't have yet
  const addBtn = el("button", {
    class: "field add-meta",
    data: { testid: "card-detail-add" },
    attrs: { "aria-label": "Add due date or label", title: "Add to card" },
    on: {
      click: () => {
        const items: Item[] = [];
        if (!card.due) items.push({ label: "Due date", icon: "calendar", run: () => openCalendar(addBtn, null, setDue) });
        items.push({ label: "Label", icon: "tag", run: () => { editingNotes = false; addingLabel = true; rebuild(); } });
        items.push({ label: "Blocked by…", icon: "blocked", run: () => openCardPicker(addBtn, {
          exclude: new Set<ID>([card.id, ...card.blockedBy]),
          placeholder: "Card that blocks this…",
          onPick: (id) => { ctx.store.blockCard(card.id, id); rebuild(); },
        }) });
        items.push({ label: "Add subtask…", icon: "subtasks", run: () => openCardPicker(addBtn, {
          exclude: new Set<ID>([card.id, ...childrenOf(ctx.store.world, card.id)]),
          placeholder: "Card to make a subtask…",
          onPick: (id) => { ctx.store.setParent(id, card.id); rebuild(); },
        }) });
        openMenu(addBtn, items);
      },
    },
  }, svg(icons.plus));
  meta.appendChild(addBtn);

  meta.appendChild(el("span", { class: "meta-spacer" }));
  if (next) {
    meta.appendChild(
      el("button", {
        class: "advance-btn",
        data: { testid: "card-detail-advance" },
        attrs: { "aria-label": `Advance to ${next.name}`, title: `Advance to ${next.name}` },
        on: { click: advanceFromDetail },
      },
        svg(icons.advance),
        el("span", { class: "adv-next", text: next.name }),
        el("kbd", { text: "A" })),
    );
  } else {
    meta.appendChild(el("span", { class: "advance-btn is-last" }, svg(icons.check), "Last column"));
  }
  body.appendChild(meta);

  // labels — chips (click ✕ to remove) + an add input with suggestions
  if (card.labels.length || addingLabel) {
    const chip = (name: string) => labelChip(name, { onRemove: () => { ctx.store.removeLabel(card.id, name); rebuild(); } });
    const labelsRow = el("div", { class: "detail-labels", data: { testid: "card-detail-labels" } }, svg(icons.tag, "detail-labels-icon"));
    for (const name of card.labels) labelsRow.appendChild(chip(name));
    if (addingLabel) {
      const editor = labelInput({
        existing: () => card.labels,
        onAdd: (name) => {
          const before = card.labels.length;
          ctx.store.addLabel(card.id, name);
          if (card.labels.length !== before) editor.insertAdjacentElement("beforebegin", chip(name)); // in place — keep focus
        },
        onStop: () => { addingLabel = false; rebuild(); },
      });
      labelsRow.appendChild(editor);
      setTimeout(() => editor.focus());
    }
    body.appendChild(labelsRow);
  }

  // relationships — parent, subtasks (with roll-up), and blockers. Added via "+".
  const openCard = (id: ID) => { closeDetail(); ctx.setFocus(id, { reveal: true }); ctx.openDetail(id); };

  if (card.parent) {
    const pid = card.parent;
    const row = relatedCardRow(pid, { icon: "subtasks", onOpen: () => openCard(pid), onRemove: () => { ctx.store.setParent(card.id, null); rebuild(); } });
    if (row) {
      const section = el("div", { class: "section rel-section", data: { testid: "card-detail-parent" } });
      section.appendChild(el("div", { class: "section-h", text: "Parent" }));
      section.appendChild(row);
      body.appendChild(section);
    }
  }

  const kids = childrenOf(ctx.store.world, card.id);
  if (kids.length) {
    const { done, total } = childProgress(ctx.store.world, card.id);
    const section = el("div", { class: "section rel-section", data: { testid: "card-detail-subtasks" } });
    section.appendChild(el("div", { class: "section-h" }, "Subtasks", el("span", { class: "rel-count", text: `${done}/${total}` })));
    for (const id of kids) {
      const row = relatedCardRow(id, { icon: "subtasks", showDone: true, onOpen: () => openCard(id), onRemove: () => { ctx.store.setParent(id, null); rebuild(); } });
      if (row) section.appendChild(row);
    }
    body.appendChild(section);
  }

  const blockers = blockersOf(ctx.store.world, card);
  if (blockers.length) {
    const section = el("div", { class: "section rel-section", data: { testid: "card-detail-blockers" } });
    section.appendChild(el("div", { class: "section-h", text: "Blocked by" }));
    for (const { id } of blockers) {
      const row = relatedCardRow(id, { icon: "blocked", showDone: true, onOpen: () => openCard(id), onRemove: () => { ctx.store.unblockCard(card.id, id); rebuild(); } });
      if (row) section.appendChild(row);
    }
    body.appendChild(section);
  }

  // description — no header; the field's placeholder is its own call to action.
  // Always present (empty = a click-to-edit hint, like the comment composer).
  const editDesc = () => { addingLabel = false; editingNotes = true; rebuild(); };
  {
    const section = el("div", { class: "section" });
    if (editingNotes) {
      const ta = el("textarea", { class: "notes-edit", data: { testid: "card-detail-notes-edit" }, attrs: { "aria-label": "Description", placeholder: "Describe this card.  Markdown: **bold**, - bullets" } });
      ta.value = card.notes;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const persist = () => ctx.store.updateCard(card.id, { notes: ta.value });
      const done = () => { clearTimeout(timer); persist(); editingNotes = false; rebuild(); };
      section.appendChild(ta);
      section.appendChild(
        el("div", { class: "desc-actions" },
          el("button", { class: "hint", data: { testid: "card-detail-desc-done" }, on: { click: done } }, "Done ", el("kbd", { text: "⌘↵" }))),
      );
      // Autosave while typing — never on blur, so copying out and back keeps edit mode.
      ta.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(persist, 500); });
      ta.addEventListener("keydown", (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); done(); } });
      setTimeout(() => { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); });
    } else if (card.notes.trim()) {
      section.appendChild(el("div", { class: "notes-view", attrs: { title: "Click to edit" }, on: { click: editDesc } }, renderNotes(card.notes)));
    } else {
      section.appendChild(el("button", { class: "desc-empty", data: { testid: "card-detail-desc-add" }, on: { click: editDesc } }, "Add a description…"));
    }
    body.appendChild(section);
  }

  // right column: the comments thread (scrolls), with the composer pinned at its foot
  const right = el("div", { class: "detail-right" });
  const thread = el("div", { class: "detail-comments", data: { testid: "card-detail-comments" } });
  thread.appendChild(el("div", { class: "section-h comments-h", text: card.comments.length ? `Comments · ${card.comments.length}` : "Comments" }));
  for (const c of card.comments) {
    thread.appendChild(
      el("div", { class: "comment" },
        el("div", { class: "avatar-sm", text: c.author.slice(0, 1) }),
        el("div", {},
          el("div", { class: "who" }, el("b", { text: c.author }), el("time", { text: c.at })),
          el("div", { class: "txt", text: c.text }),
        ),
      ),
    );
  }
  right.appendChild(thread);

  // composer — just a line until focused; then it reveals discard + send
  const composer = el("div", { class: "composer" });
  const ta = el("textarea", { data: { testid: "comment-input" }, attrs: { placeholder: "Add a comment…", rows: "1", "aria-label": "Add a comment" } });
  const send = () => {
    const v = ta.value.trim();
    if (!v) return;
    ctx.store.addComment(card.id, v);
    rebuild();
  };
  const sync = () => composer.classList.toggle("is-active", document.activeElement === ta || ta.value.trim().length > 0);
  const cancel = () => { ta.value = ""; ta.blur(); sync(); };
  ta.addEventListener("focus", sync);
  ta.addEventListener("input", sync);
  ta.addEventListener("blur", () => setTimeout(sync, 120)); // let a button click land first
  ta.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); send(); }
    else if (e.key === "Escape") { e.stopPropagation(); cancel(); } // abandon, don't close the sheet
  });
  composer.append(
    ta,
    el("div", { class: "composer-actions" },
      el("button", {
        class: "composer-cancel",
        data: { testid: "comment-cancel" },
        attrs: { "aria-label": "Discard comment", title: "Discard (Esc)" },
        on: { click: cancel },
      }, svg(icons.close)),
      el("button", { class: "send", data: { testid: "comment-send" }, on: { click: send } }, "Send", el("kbd", { text: "⌘↵" })),
    ),
  );
  right.appendChild(composer);

  const main = el("div", { class: "detail-main" }, body, right);
  sheet.appendChild(main);
}

function editTitle(card: Card) {
  const node = sheet?.querySelector<HTMLElement>(".detail-title");
  if (!node) return;
  const input = el("textarea", { class: "detail-title-input", data: { testid: "card-detail-title-input" }, attrs: { rows: "1", "aria-label": "Edit title" } });
  input.value = card.title;
  node.replaceWith(input);
  autoGrow(input); // grow with the title instead of scrolling inside the field
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
  const commit = () => { const v = input.value.trim(); if (v) ctx.store.updateCard(card.id, { title: v }); rebuild(); };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    else if (e.key === "Escape") { e.stopPropagation(); rebuild(); }
  });
  input.addEventListener("blur", commit);
}

// minimal, safe markdown: paragraphs, **bold**, "- " bullet lists
function renderNotes(src: string): HTMLElement {
  const wrap = el("div", { class: "notes" });
  const blocks = src.split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split("\n");
    if (lines.every((l) => l.trim().startsWith("- "))) {
      const ul = el("ul", {});
      for (const l of lines) ul.appendChild(inlineInto(el("li", {}), l.replace(/^\s*-\s/, "")));
      wrap.appendChild(ul);
    } else {
      wrap.appendChild(inlineInto(el("p", {}), block.replace(/\n/g, " ")));
    }
  }
  return wrap;
}

function inlineInto(node: HTMLElement, text: string): HTMLElement {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  for (const p of parts) {
    if (/^\*\*[^*]+\*\*$/.test(p)) node.appendChild(el("strong", { text: p.slice(2, -2) }));
    else if (p) for (const n of linkify(p)) node.appendChild(n);
  }
  return node;
}

const isField = (t: EventTarget | null): boolean => {
  const e = t as HTMLElement | null;
  return !!e && (e.tagName === "INPUT" || e.tagName === "TEXTAREA" || e.isContentEditable);
};
