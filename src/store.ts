import type { Board, Card, Column, ID, ViewState, WorldState } from "./types";
import type { Op } from "./core/ops";
import { applyOp, type CardLoc, findBoard, findCard, findColumn, isAncestor, nextColumnOf } from "./core/state";
import { addLabelTo, removeLabelFrom } from "./core/labels";
import { ARCHIVE_BOARD_ID } from "./core/done";
import { archiveBoardObject, archiveSweepOps } from "./core/archive";
import { uid } from "./dom";

/**
 * The client store: an optimistic in-memory WorldState. Every mutation is
 * expressed as an Op, applied locally through the shared reducer (instant UI),
 * and emitted to an op sink (the sync client persists it to the server). The
 * public method surface is unchanged from the pre-refactor store.
 */
export class Store {
  world: WorldState;
  view: ViewState = {
    panX: 0, panY: 0, zoom: 1,
    focusedCardId: null, detailCardId: null, paletteOpen: false, archiveOpen: false,
    labelFilter: [],
  };

  private dataSubs = new Set<() => void>();
  private viewSubs = new Set<() => void>();
  private opSink: ((op: Op) => void) | null = null;

  constructor(initial: WorldState) {
    this.world = initial;
  }

  // ---- subscriptions / sync wiring ----
  subscribeData(fn: () => void) { this.dataSubs.add(fn); return () => this.dataSubs.delete(fn); }
  subscribeView(fn: () => void) { this.viewSubs.add(fn); return () => this.viewSubs.delete(fn); }
  emitData() { this.dataSubs.forEach((f) => f()); }
  emitView() { this.viewSubs.forEach((f) => f()); }

  /** Wire the persistence sink (sync client). Ops flow here after local apply. */
  setOpSink(fn: (op: Op) => void) { this.opSink = fn; }

  /** Replace the whole world (e.g. loaded from the server). Does NOT emit ops. */
  load(world: WorldState) {
    this.world = world;
    if (this.view.focusedCardId && !findCard(world, this.view.focusedCardId)) this.view.focusedCardId = null;
    this.emitData();
  }

  /** Apply locally, persist via the sink, and re-render. */
  private commit(op: Op) {
    applyOp(this.world, op);
    this.opSink?.(op);
    this.emitData();
  }

  // ---- lookups (delegate to the shared core) ----
  findCard(id: ID): CardLoc | null { return findCard(this.world, id); }
  findColumn(id: ID) { return findColumn(this.world, id); }
  findBoard(id: ID): Board | null { return findBoard(this.world, id); }
  nextColumnOf(id: ID): Column | null { return nextColumnOf(this.world, id); }

  // ---- card mutations ----
  addCard(columnId: ID, title: string, atTop = true): Card | null {
    const col = this.findColumn(columnId);
    if (!col || !title.trim()) return null;
    const cardObj: Card = {
      id: uid("card"), title: title.trim(), notes: "", due: null, labels: [],
      blockedBy: [], parent: null, comments: [], enteredColumnAt: Date.now(),
    };
    this.commit({ t: "addCard", columnId, index: atTop ? 0 : col.column.cards.length, card: cardObj });
    return cardObj;
  }

  insertCard(columnId: ID, card: Card, index: number) {
    this.commit({ t: "addCard", columnId, index, card });
  }

  updateCard(id: ID, patch: Partial<Card>) {
    if (!this.findCard(id)) return;
    this.commit({ t: "updateCard", id, patch });
  }

  /** Add a label to a card (normalized + deduped + capped). No-op if unchanged. */
  addLabel(id: ID, raw: string) {
    const loc = this.findCard(id);
    if (!loc) return;
    const labels = addLabelTo(loc.card.labels, raw);
    if (labels.length !== loc.card.labels.length) this.updateCard(id, { labels });
  }

  removeLabel(id: ID, name: string) {
    const loc = this.findCard(id);
    if (!loc) return;
    this.updateCard(id, { labels: removeLabelFrom(loc.card.labels, name) });
  }

  /** Mark `id` as blocked by `by` (a dependency). */
  blockCard(id: ID, by: ID) {
    if (id === by || !this.findCard(id) || !this.findCard(by)) return;
    this.commit({ t: "blockCard", id, by });
  }

  unblockCard(id: ID, by: ID) {
    if (!this.findCard(id)) return;
    this.commit({ t: "unblockCard", id, by });
  }

  /** Set (or clear) a card's parent, guarding self-parenting and cycles. */
  setParent(id: ID, parent: ID | null) {
    if (!this.findCard(id)) return;
    if (parent !== null && (parent === id || !this.findCard(parent) || isAncestor(this.world, id, parent))) return;
    this.commit({ t: "setParent", id, parent });
  }

  deleteCard(id: ID): { columnId: ID; index: number; card: Card } | null {
    const loc = this.findCard(id);
    if (!loc) return null;
    const info = { columnId: loc.column.id, index: loc.cardIndex, card: loc.card };
    if (this.view.focusedCardId === id) this.view.focusedCardId = null;
    if (this.view.detailCardId === id) this.view.detailCardId = null;
    this.commit({ t: "deleteCard", id });
    return info;
  }

  moveCard(cardId: ID, toColumnId: ID, toIndex: number) {
    if (!this.findCard(cardId) || !this.findColumn(toColumnId)) return;
    this.commit({ t: "moveCard", id: cardId, toColumnId, index: toIndex, at: Date.now() });
  }

  advanceCard(cardId: ID): { to: Column } | null {
    const next = this.nextColumnOf(cardId);
    if (!next) return null;
    this.commit({ t: "moveCard", id: cardId, toColumnId: next.id, index: 0, at: Date.now() });
    return { to: next };
  }

  addComment(cardId: ID, text: string) {
    if (!this.findCard(cardId) || !text.trim()) return;
    this.commit({ t: "addComment", cardId, comment: { id: uid("cm"), author: "You", at: formatNow(), text: text.trim() } });
  }

  // ---- column mutations ----
  addColumn(boardId: ID, name = "New column"): Column | null {
    const board = this.findBoard(boardId);
    return board ? this.addColumnAt(boardId, board.columns.length, name) : null;
  }

  addColumnAt(boardId: ID, index: number, name = "New column"): Column | null {
    if (!this.findBoard(boardId)) return null;
    const column: Column = { id: uid("col"), name, wip: null, cards: [] };
    this.commit({ t: "addColumn", boardId, index, column });
    return column;
  }

  renameColumn(columnId: ID, name: string) {
    if (!this.findColumn(columnId) || !name.trim()) return;
    this.commit({ t: "renameColumn", id: columnId, name });
  }

  deleteColumn(columnId: ID) {
    if (!this.findColumn(columnId)) return;
    this.commit({ t: "deleteColumn", id: columnId });
  }

  moveColumn(boardId: ID, from: number, to: number) {
    this.commit({ t: "moveColumn", boardId, from, to });
  }

  moveColumnToBoard(columnId: ID, toBoardId: ID, index: number) {
    if (!this.findColumn(columnId) || !this.findBoard(toBoardId)) return;
    this.commit({ t: "moveColumnTo", columnId, toBoardId, index });
  }

  // ---- board mutations ----
  addBoard(x: number, y: number, title = "New board"): Board {
    const board: Board = {
      id: uid("board"), title, x, y,
      columns: [
        { id: uid("col"), name: "To do", wip: null, cards: [] },
        { id: uid("col"), name: "Doing", wip: null, cards: [] },
        { id: uid("col"), name: "Done", wip: null, cards: [] },
      ],
    };
    this.commit({ t: "addBoard", board });
    return board;
  }

  renameBoard(id: ID, title: string) {
    if (!this.findBoard(id) || !title.trim()) return;
    this.commit({ t: "renameBoard", id, title });
  }

  setBoardCollapsed(id: ID, collapsed: boolean, w?: number) {
    const b = this.findBoard(id);
    if (!b || !!b.collapsed === collapsed) return;
    this.commit({ t: "setBoardCollapsed", id, collapsed, w });
  }

  /** Unfold every real (non-Archive) board at once. (Folding-all keeps each width,
   *  so it's driven from the renderer where the DOM widths are measured.) */
  setAllBoardsCollapsed(collapsed: boolean) {
    for (const b of this.world.boards) {
      if (b.id === ARCHIVE_BOARD_ID || !!b.collapsed === collapsed) continue;
      this.commit({ t: "setBoardCollapsed", id: b.id, collapsed });
    }
  }

  deleteBoard(id: ID) {
    if (!this.findBoard(id)) return;
    this.commit({ t: "deleteBoard", id });
  }

  moveBoard(id: ID, x: number, y: number) {
    if (!this.findBoard(id)) return;
    this.commit({ t: "moveBoard", id, x, y });
  }

  // ---- archive ----
  get archiveBoard(): Board | null { return this.findBoard(ARCHIVE_BOARD_ID); }

  /** Create the hidden Archive board once (idempotent; safe for existing data). */
  ensureArchiveBoard(): void {
    if (this.findBoard(ARCHIVE_BOARD_ID)) return;
    this.commit({ t: "addBoard", board: archiveBoardObject() });
  }

  /**
   * Move every card that has sat in a done column for ≥ the threshold into the
   * Archive (shared planner with the server). Returns how many were archived.
   */
  archiveDoneCards(now = Date.now()): number {
    const ops = archiveSweepOps(this.world, now);
    for (const op of ops) this.commit(op);
    return ops.reduce((n, op) => n + (op.t === "moveCard" ? 1 : 0), 0);
  }
}

function formatNow(): string {
  const d = new Date();
  const month = d.toLocaleString("en-US", { month: "short" });
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${month} ${d.getDate()}, ${hh}:${mm}`;
}

/** "just now" / "3h" / "2d" since a column-entry timestamp. */
export function sinceLabel(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
