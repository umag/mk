import type { Board, Card, Column, Comment, ID } from "../types";

// An Op is a serializable, replayable mutation. The same ops drive the
// optimistic in-browser store AND the Deno+SQLite server (shared reducer), so
// the client and server can never disagree about what a change means.
// Ops are deterministic: anything time-based (enteredColumnAt) is carried in the
// op, never read from the clock inside the reducer.

export type Op =
  | { t: "addBoard"; board: Board }
  | { t: "moveBoard"; id: ID; x: number; y: number }
  | { t: "renameBoard"; id: ID; title: string }
  | { t: "setBoardCollapsed"; id: ID; collapsed: boolean }
  | { t: "deleteBoard"; id: ID }
  | { t: "addColumn"; boardId: ID; index: number; column: Column }
  | { t: "renameColumn"; id: ID; name: string }
  | { t: "setWip"; id: ID; wip: number | null }
  | { t: "moveColumn"; boardId: ID; from: number; to: number }
  | { t: "moveColumnTo"; columnId: ID; toBoardId: ID; index: number }
  | { t: "deleteColumn"; id: ID }
  | { t: "addCard"; columnId: ID; index: number; card: Card }
  | { t: "updateCard"; id: ID; patch: Partial<Card> }
  | { t: "moveCard"; id: ID; toColumnId: ID; index: number; at: number }
  | { t: "deleteCard"; id: ID }
  | { t: "addComment"; cardId: ID; comment: Comment };

export type OpType = Op["t"];
