import { ctx } from "./context";
import { isPaletteOpen } from "./palette";
import { isDetailOpen } from "./detail";

export function initKeyboard() {
  window.addEventListener("keydown", onKey);
}

function isTyping(t: EventTarget | null): boolean {
  const e = t as HTMLElement | null;
  return !!e && (e.tagName === "INPUT" || e.tagName === "TEXTAREA" || e.isContentEditable);
}

function onKey(e: KeyboardEvent) {
  if (isPaletteOpen() || isDetailOpen()) return; // overlays own their keys

  const meta = e.metaKey || e.ctrlKey;
  if (meta && e.key.toLowerCase() === "k") {
    e.preventDefault();
    ctx.openPalette();
    return;
  }
  if (isTyping(e.target) || meta) return;

  const s = ctx.store;
  const id = s.view.focusedCardId;

  switch (e.key) {
    case "/":
      e.preventDefault();
      ctx.openPalette();
      break;
    case "n":
    case "N":
      e.preventDefault();
      newCard();
      break;
    case "Enter":
    case "o":
    case "O":
      if (id) { e.preventDefault(); ctx.openDetail(id); }
      break;
    case "a":
    case "A":
      if (id) { e.preventDefault(); ctx.advance(id, e.shiftKey); }
      break;
    case "Delete":
    case "Backspace":
      if (id) { e.preventDefault(); ctx.deleteCard(id); }
      break;
    case "m":
    case "M":
      e.preventDefault();
      (document.querySelector(".mute-btn") as HTMLElement | null)?.click();
      break;
    case "ArrowDown":
    case "j":
    case "J":
      e.preventDefault();
      nav(0, 1);
      break;
    case "ArrowUp":
    case "k":
    case "K":
      e.preventDefault();
      nav(0, -1);
      break;
    case "ArrowRight":
    case "l":
    case "L":
      e.preventDefault();
      nav(1, 0);
      break;
    case "ArrowLeft":
    case "h":
    case "H":
      e.preventDefault();
      nav(-1, 0);
      break;
    case "Escape":
      ctx.setFocus(null);
      break;
  }
}

function newCard() {
  const s = ctx.store;
  const id = s.view.focusedCardId;
  if (id) {
    const loc = s.findCard(id);
    if (loc) return ctx.startCapture(loc.column.id);
  }
  const first = s.world.boards[0]?.columns[0];
  if (first) ctx.startCapture(first.id);
}

function nav(dx: number, dy: number) {
  const s = ctx.store;
  const id = s.view.focusedCardId;
  if (!id) {
    const firstCol = s.world.boards[0]?.columns.find((c) => c.cards.length);
    if (firstCol) ctx.setFocus(firstCol.cards[0].id, { reveal: true });
    return;
  }
  const loc = s.findCard(id);
  if (!loc) return;
  const { board, colIndex, cardIndex } = loc;

  if (dy !== 0) {
    const col = board.columns[colIndex];
    const ni = cardIndex + dy;
    if (ni >= 0 && ni < col.cards.length) ctx.setFocus(col.cards[ni].id, { reveal: true });
  } else if (dx !== 0) {
    let ci = colIndex + dx;
    while (ci >= 0 && ci < board.columns.length) {
      const col = board.columns[ci];
      if (col.cards.length) {
        const t = col.cards[Math.min(cardIndex, col.cards.length - 1)];
        ctx.setFocus(t.id, { reveal: true });
        return;
      }
      ci += dx;
    }
  }
}
