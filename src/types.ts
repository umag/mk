export type ID = string;

/** Derived urgency of a card's due date — drives the dot/text color. */
export type DueState = "none" | "soon" | "today" | "overdue";

export interface Comment {
  id: ID;
  author: string;
  /** Display timestamp, e.g. "Jun 20, 18:42". In-memory build keeps it pre-formatted. */
  at: string;
  text: string;
}

export interface Card {
  id: ID;
  title: string;
  notes: string;
  /** ISO "YYYY-MM-DD", or null when unscheduled. Urgency/label are derived (see core/due.ts). */
  due: string | null;
  /** Free-form colour-coded tags. Colour is derived from the text (see core/labels.ts). */
  labels: string[];
  /** Ids of cards that block this one (a dependency). "Blocked" is derived: a
   *  blocker stops counting once it reaches a done column / the archive. */
  blockedBy: ID[];
  /** Parent card id for hierarchy (subtasks). null = top-level. */
  parent: ID | null;
  comments: Comment[];
  /** When the card entered its current column — powers the "time in column" metric. */
  enteredColumnAt: number;
}

export interface Column {
  id: ID;
  name: string;
  /** Soft work-in-progress limit, shown as a chip; null = no limit. */
  wip: number | null;
  cards: Card[];
}

export interface Board {
  id: ID;
  title: string;
  /** Top-left position in canvas/world coordinates (unscaled px). */
  x: number;
  y: number;
  columns: Column[];
  /** Folded to just its header (title + card count) to reclaim canvas space. */
  collapsed?: boolean;
}

export interface WorldState {
  boards: Board[];
}

/** Transient view state — pan/zoom, focus, open overlays. Never persisted with the data. */
export interface ViewState {
  panX: number;
  panY: number;
  zoom: number;
  focusedCardId: ID | null;
  detailCardId: ID | null;
  paletteOpen: boolean;
  /** Viewing the hidden Archive board instead of the normal canvas. */
  archiveOpen: boolean;
  /** Active label filter (OR). Empty = no filter. Transient; never persisted. */
  labelFilter: string[];
}
