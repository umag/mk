import type { Card, WorldState } from "../types";
import { isArchiveBoard } from "./done";

// Free-form card labels. A label is just text; its colour is *derived* from the
// text (see labelHue), so there is no label registry to keep in sync — the same
// tag always reads the same colour on every card. All logic here is pure so it
// can be unit-tested and shared by the browser store and the server.

export const MAX_LABEL_LEN = 24;
export const MAX_LABELS_PER_CARD = 6;

/** Tidy raw label text: drop a leading "#", trim, collapse inner whitespace and
 *  cap the length. Casing is preserved. Returns null when nothing usable remains. */
export function normalizeLabel(raw: string): string | null {
  const s = raw.trim().replace(/^#+/, "").replace(/\s+/g, " ").trim().slice(0, MAX_LABEL_LEN).trim();
  return s.length ? s : null;
}

const sameLabel = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

/** Add a normalized label to a list — case-insensitive dedupe, capped count.
 *  Always returns a new array (never mutates the input). */
export function addLabelTo(labels: readonly string[], raw: string): string[] {
  const name = normalizeLabel(raw);
  if (!name || labels.some((l) => sameLabel(l, name)) || labels.length >= MAX_LABELS_PER_CARD) {
    return [...labels];
  }
  return [...labels, name];
}

/** Remove a label (case-insensitive). Returns a new array. */
export function removeLabelFrom(labels: readonly string[], name: string): string[] {
  return labels.filter((l) => !sameLabel(l, name));
}

/** Build the full label list for a set of raw inputs, normalized + deduped + capped. */
export function sanitizeLabels(raw: readonly string[]): string[] {
  return raw.reduce<string[]>((acc, x) => (typeof x === "string" ? addLabelTo(acc, x) : acc), []);
}

/** Deterministic hue (0–359) from a label name, so a tag's colour is stable
 *  everywhere it appears. Case-insensitive (FNV-ish rolling hash). */
export function labelHue(name: string): number {
  const s = name.toLowerCase();
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 360;
}

export interface LabelUse {
  name: string;
  count: number;
}

/** Distinct labels in use across the real (non-archive) boards, busiest first
 *  then alphabetical. Drives the filter popover and the search palette. */
export function collectLabels(world: WorldState): LabelUse[] {
  const seen = new Map<string, LabelUse>();
  for (const board of world.boards) {
    if (isArchiveBoard(board)) continue;
    for (const column of board.columns) {
      for (const card of column.cards) {
        for (const name of card.labels ?? []) {
          const key = name.toLowerCase();
          const cur = seen.get(key);
          if (cur) cur.count++;
          else seen.set(key, { name, count: 1 });
        }
      }
    }
  }
  return [...seen.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** OR semantics: a card matches when it carries ANY of the selected labels.
 *  An empty selection matches everything (no filter). */
export function cardMatchesFilter(card: Pick<Card, "labels">, filter: readonly string[]): boolean {
  if (!filter.length) return true;
  const have = (card.labels ?? []).map((l) => l.toLowerCase());
  return filter.some((f) => have.includes(f.toLowerCase()));
}

/** Toggle a label in a filter selection (case-insensitive), preserving order. */
export function toggleInFilter(filter: readonly string[], name: string): string[] {
  return filter.some((f) => sameLabel(f, name))
    ? filter.filter((f) => !sameLabel(f, name))
    : [...filter, name];
}
