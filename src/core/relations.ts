import type { Card, ID, WorldState } from "../types";
import { findCard } from "./state";
import { isArchiveBoard, isDoneColumn } from "./done";

// Derived card relationships — dependencies (blocking) and parent/child hierarchy.
// All pure over WorldState so the store and the renderer agree. "Done" (a card in
// a done column or the archive) is the resolution signal: a blocker stops blocking
// once it's done, and child progress counts done children.

export function isCardDone(s: WorldState, cardId: ID): boolean {
  const loc = findCard(s, cardId);
  if (!loc) return false;
  return isArchiveBoard(loc.board) || isDoneColumn(loc.board, loc.colIndex);
}

/** A card is blocked while any blocker still exists and isn't done. */
export function isBlocked(s: WorldState, card: Pick<Card, "blockedBy">): boolean {
  return (card.blockedBy ?? []).some((id) => findCard(s, id) != null && !isCardDone(s, id));
}

/** Resolved blockers (ids that still exist), each flagged done/unresolved. */
export function blockersOf(s: WorldState, card: Pick<Card, "blockedBy">): Array<{ id: ID; done: boolean }> {
  return (card.blockedBy ?? [])
    .filter((id) => findCard(s, id) != null)
    .map((id) => ({ id, done: isCardDone(s, id) }));
}

/** Cards this one blocks (reverse of blockedBy). */
export function blocksOf(s: WorldState, cardId: ID): ID[] {
  const out: ID[] = [];
  for (const b of s.boards) {
    for (const c of b.columns) for (const k of c.cards) {
      if ((k.blockedBy ?? []).includes(cardId)) out.push(k.id);
    }
  }
  return out;
}

/** Direct children (cards whose parent is this card). */
export function childrenOf(s: WorldState, cardId: ID): ID[] {
  const out: ID[] = [];
  for (const b of s.boards) {
    for (const c of b.columns) for (const k of c.cards) {
      if (k.parent === cardId) out.push(k.id);
    }
  }
  return out;
}

/** Subtask roll-up: how many of a card's children are done. */
export function childProgress(s: WorldState, cardId: ID): { done: number; total: number } {
  const kids = childrenOf(s, cardId);
  return { done: kids.filter((id) => isCardDone(s, id)).length, total: kids.length };
}

/** Map of parent id → child ids, built in one pass (avoids O(n²) on the canvas). */
export function childIndex(s: WorldState): Map<ID, ID[]> {
  const m = new Map<ID, ID[]>();
  for (const b of s.boards) {
    for (const c of b.columns) for (const k of c.cards) {
      if (k.parent) {
        const arr = m.get(k.parent);
        if (arr) arr.push(k.id);
        else m.set(k.parent, [k.id]);
      }
    }
  }
  return m;
}
