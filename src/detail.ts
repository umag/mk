import { clear, el, svg } from "./dom";
import { icons } from "./icons";
import { ctx } from "./context";
import { sinceLabel } from "./store";
import { dueLabel, dueStateOf } from "./core/due";
import { playSound } from "./sound";
import type { Card } from "./types";

let backdrop: HTMLElement | null = null;
let sheet: HTMLElement | null = null;
let currentId: string | null = null;
let editingNotes = false;

export function openDetail(cardId: string) {
  if (!ctx.store.findCard(cardId)) return;
  currentId = cardId;
  ctx.store.view.detailCardId = cardId;
  editingNotes = false;

  backdrop = el("div", { class: "backdrop", on: { pointerdown: closeDetail } });
  sheet = el("div", { class: "detail", attrs: { role: "dialog", "aria-modal": "true", "aria-label": "Card detail" } });
  document.body.append(backdrop, sheet);
  rebuild();
  playSound("open");
  window.addEventListener("keydown", onKey, true);
}

export function closeDetail() {
  if (!sheet) return;
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
  const typing = isField(e.target);
  if (e.key === "Escape") {
    if (editingNotes) { editingNotes = false; rebuild(); }
    else closeDetail();
    e.stopPropagation();
    return;
  }
  if (typing) return;
  if (e.key.toLowerCase() === "w") { e.preventDefault(); e.stopPropagation(); closeDetail(); }
  else if (e.key.toLowerCase() === "a") { e.preventDefault(); e.stopPropagation(); advanceFromDetail(); }
  else if (e.key.toLowerCase() === "e") { e.preventDefault(); e.stopPropagation(); editingNotes = true; rebuild(); }
  else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); e.stopPropagation(); deleteFromDetail(); }
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
  const loc = ctx.store.findCard(currentId);
  if (!loc) { closeDetail(); return; }
  const { board, column, card, colIndex } = loc;
  const next = board.columns[colIndex + 1] ?? null;
  const dueState = dueStateOf(card.due);
  const dueHot = dueState === "overdue" || dueState === "today";
  clear(sheet);

  // header — crumb + delete + close (hotkey hints removed; buttons carry their own)
  sheet.appendChild(
    el(
      "div",
      { class: "detail-head" },
      el(
        "span",
        { class: "crumb" },
        el("span", { class: `dot${dueHot ? " hot" : ""}` }),
        el("b", { text: board.title }),
        el("span", { class: "sep", text: "/" }),
        el("span", { text: column.name }),
      ),
      el("span", { class: "meta-spacer" }),
      el("button", {
        class: "detail-close detail-danger",
        attrs: { "aria-label": "Delete card", title: "Delete card (⌫)" },
        on: { click: deleteFromDetail },
      }, svg(icons.trash)),
      el("button", {
        class: "detail-close",
        attrs: { "aria-label": "Close", title: "Close (Esc / W)" },
        on: { click: closeDetail },
      }, svg(icons.close)),
    ),
  );

  // body
  const body = el("div", { class: "detail-body" });

  // title (click to edit)
  const title = el("h1", {
    class: "detail-title",
    text: card.title,
    attrs: { title: "Click to edit" },
    on: { click: () => editTitle(card) },
  });
  body.appendChild(title);

  // meta bar
  const meta = el("div", { class: "meta-bar" });
  const dueInput = el("input", { attrs: { type: "date", "aria-label": "Due date" } });
  dueInput.value = card.due ?? "";
  dueInput.addEventListener("change", () => {
    ctx.store.updateCard(card.id, { due: dueInput.value || null });
    rebuild();
  });
  meta.appendChild(
    el(
      "div",
      {
        class: `field due-field${card.due && dueHot ? " due-hot" : ""}`,
        on: {
          click: (e: MouseEvent) => {
            if ((e.target as HTMLElement).closest(".due-clear")) return;
            dueInput.showPicker?.();
            dueInput.focus();
          },
        },
      },
      svg(icons.calendar),
      el("span", { class: "due-text", text: card.due ? `Due ${dueLabel(card.due)}` : "Add due date" }),
      dueInput,
      card.due
        ? el("button", {
          class: "due-clear",
          attrs: { "aria-label": "Clear due date", title: "Clear" },
          on: { click: (e: MouseEvent) => { e.stopPropagation(); ctx.store.updateCard(card.id, { due: null }); rebuild(); } },
        }, svg(icons.close))
        : null,
    ),
  );
  meta.appendChild(el("span", { class: "field" }, svg(icons.clock), el("span", { class: "lbl", text: "in column" }), ` ${sinceLabel(card.enteredColumnAt)}`));
  meta.appendChild(el("span", { class: "meta-spacer" }));
  if (next) {
    meta.appendChild(
      el("button", { class: "advance-btn", on: { click: advanceFromDetail } },
        svg(icons.advance), `Advance to ${next.name}`, el("kbd", { text: "A" })),
    );
  } else {
    meta.appendChild(el("span", { class: "advance-btn is-last" }, svg(icons.check), "Last column"));
  }
  body.appendChild(meta);

  // notes
  const notes = el("div", { class: "section" });
  notes.appendChild(
    el("div", { class: "section-h" }, "Notes",
      editingNotes ? null : el("button", { class: "hint", on: { click: () => { editingNotes = true; rebuild(); } } }, el("kbd", { text: "E" }), " to edit")),
  );
  if (editingNotes) {
    const ta = el("textarea", { class: "notes-edit", attrs: { "aria-label": "Edit notes", placeholder: "Markdown — **bold**, - bullets" } });
    ta.value = card.notes;
    notes.appendChild(ta);
    const save = () => { ctx.store.updateCard(card.id, { notes: ta.value }); editingNotes = false; rebuild(); };
    ta.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); save(); }
    });
    ta.addEventListener("blur", save);
    setTimeout(() => { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); });
  } else if (card.notes.trim()) {
    notes.appendChild(renderNotes(card.notes));
  } else {
    notes.appendChild(el("div", { class: "notes notes-empty", text: "No notes yet — click to add some.", on: { click: () => { editingNotes = true; rebuild(); } } }));
  }
  body.appendChild(notes);

  body.appendChild(el("div", { class: "detail-rule" }));

  // comments
  const comments = el("div", { class: "section" });
  comments.appendChild(el("div", { class: "section-h", text: `Comments · ${card.comments.length}` }));
  if (card.comments.length === 0) {
    comments.appendChild(el("div", { class: "comments-empty", text: "No comments yet." }));
  }
  for (const c of card.comments) {
    comments.appendChild(
      el("div", { class: "comment" },
        el("div", { class: "avatar-sm", text: c.author.slice(0, 1) }),
        el("div", {},
          el("div", { class: "who" }, el("b", { text: c.author }), el("time", { text: c.at })),
          el("div", { class: "txt", text: c.text }),
        ),
      ),
    );
  }
  body.appendChild(comments);
  sheet.appendChild(body);

  // composer
  const ta = el("textarea", { attrs: { placeholder: "Add a note…  ⌘⏎ to send", rows: "1", "aria-label": "Add a comment" } });
  const send = () => {
    const v = ta.value.trim();
    if (!v) return;
    ctx.store.addComment(card.id, v);
    rebuild();
  };
  ta.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); send(); }
  });
  sheet.appendChild(
    el("div", { class: "composer" }, ta, el("button", { class: "send", on: { click: send } }, "Send", el("kbd", { text: "⌘↵" }))),
  );
}

function editTitle(card: Card) {
  const node = sheet?.querySelector<HTMLElement>(".detail-title");
  if (!node) return;
  const input = el("textarea", { class: "detail-title-input", attrs: { rows: "1", "aria-label": "Edit title" } });
  input.value = card.title;
  node.replaceWith(input);
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
    else if (p) node.appendChild(document.createTextNode(p));
  }
  return node;
}

const isField = (t: EventTarget | null): boolean => {
  const e = t as HTMLElement | null;
  return !!e && (e.tagName === "INPUT" || e.tagName === "TEXTAREA" || e.isContentEditable);
};
