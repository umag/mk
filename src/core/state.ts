import type { Board, Card, Column, ID, WorldState } from "../types";
import type { Op } from "./ops";

export interface CardLoc {
  board: Board;
  column: Column;
  card: Card;
  colIndex: number;
  cardIndex: number;
}

export function findBoard(s: WorldState, id: ID): Board | null {
  return s.boards.find((b) => b.id === id) ?? null;
}

export function findColumn(s: WorldState, id: ID): { board: Board; column: Column; index: number } | null {
  for (const board of s.boards) {
    const index = board.columns.findIndex((c) => c.id === id);
    if (index >= 0) return { board, column: board.columns[index]!, index };
  }
  return null;
}

export function findCard(s: WorldState, id: ID): CardLoc | null {
  for (const board of s.boards) {
    for (let colIndex = 0; colIndex < board.columns.length; colIndex++) {
      const column = board.columns[colIndex]!;
      const cardIndex = column.cards.findIndex((c) => c.id === id);
      if (cardIndex >= 0) {
        return { board, column, card: column.cards[cardIndex]!, colIndex, cardIndex };
      }
    }
  }
  return null;
}

export function nextColumnOf(s: WorldState, cardId: ID): Column | null {
  const loc = findCard(s, cardId);
  if (!loc) return null;
  return loc.board.columns[loc.colIndex + 1] ?? null;
}

const clampIndex = (i: number, len: number) => Math.max(0, Math.min(i, len));

/**
 * The single source of truth for how an Op transforms world state. Mutates `s`
 * in place and returns it (callers re-render off the same reference). Pure with
 * respect to its inputs — no clock, no randomness — so client and server replay
 * identically.
 */
export function applyOp(s: WorldState, op: Op): WorldState {
  switch (op.t) {
    case "addBoard":
      if (!findBoard(s, op.board.id)) s.boards.push(op.board);
      break;
    case "moveBoard": {
      const b = findBoard(s, op.id);
      if (b) { b.x = op.x; b.y = op.y; }
      break;
    }
    case "renameBoard": {
      const b = findBoard(s, op.id);
      if (b && op.title.trim()) b.title = op.title.trim();
      break;
    }
    case "deleteBoard": {
      const i = s.boards.findIndex((b) => b.id === op.id);
      if (i >= 0) s.boards.splice(i, 1);
      break;
    }
    case "addColumn": {
      const b = findBoard(s, op.boardId);
      if (b && !b.columns.some((c) => c.id === op.column.id)) {
        b.columns.splice(clampIndex(op.index, b.columns.length), 0, op.column);
      }
      break;
    }
    case "renameColumn": {
      const f = findColumn(s, op.id);
      if (f && op.name.trim()) f.column.name = op.name.trim();
      break;
    }
    case "setWip": {
      const f = findColumn(s, op.id);
      if (f) f.column.wip = op.wip;
      break;
    }
    case "moveColumn": {
      const b = findBoard(s, op.boardId);
      if (b && op.from >= 0 && op.from < b.columns.length) {
        const [col] = b.columns.splice(op.from, 1);
        if (col) b.columns.splice(clampIndex(op.to, b.columns.length), 0, col);
      }
      break;
    }
    case "moveColumnTo": {
      const src = findColumn(s, op.columnId);
      const dest = findBoard(s, op.toBoardId);
      if (src && dest) {
        src.board.columns.splice(src.index, 1);
        dest.columns.splice(clampIndex(op.index, dest.columns.length), 0, src.column);
      }
      break;
    }
    case "deleteColumn": {
      const f = findColumn(s, op.id);
      if (f) f.board.columns.splice(f.index, 1);
      break;
    }
    case "addCard": {
      const f = findColumn(s, op.columnId);
      if (f && !f.column.cards.some((c) => c.id === op.card.id)) {
        f.column.cards.splice(clampIndex(op.index, f.column.cards.length), 0, op.card);
      }
      break;
    }
    case "updateCard": {
      const loc = findCard(s, op.id);
      if (loc) Object.assign(loc.card, op.patch);
      break;
    }
    case "moveCard": {
      const loc = findCard(s, op.id);
      const dest = findColumn(s, op.toColumnId);
      if (loc && dest) {
        loc.column.cards.splice(loc.cardIndex, 1);
        if (loc.column !== dest.column) loc.card.enteredColumnAt = op.at;
        dest.column.cards.splice(clampIndex(op.index, dest.column.cards.length), 0, loc.card);
      }
      break;
    }
    case "deleteCard": {
      const loc = findCard(s, op.id);
      if (loc) loc.column.cards.splice(loc.cardIndex, 1);
      break;
    }
    case "addComment": {
      const loc = findCard(s, op.cardId);
      if (loc) loc.card.comments.push(op.comment);
      break;
    }
  }
  return s;
}

export function applyOps(s: WorldState, ops: Op[]): WorldState {
  for (const op of ops) applyOp(s, op);
  return s;
}
