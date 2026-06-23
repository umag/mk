import { DatabaseSync } from "node:sqlite";
import type { Board, Card, Column, WorldState } from "../src/types.ts";

export type DB = DatabaseSync;

export function openDb(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS boards  (id TEXT PRIMARY KEY, title TEXT, x REAL, y REAL, collapsed INTEGER, fold_w REAL, pos INTEGER);
    CREATE TABLE IF NOT EXISTS columns (id TEXT PRIMARY KEY, board_id TEXT, name TEXT, wip INTEGER, pos INTEGER);
    CREATE TABLE IF NOT EXISTS cards   (id TEXT PRIMARY KEY, column_id TEXT, title TEXT, notes TEXT, due TEXT, labels TEXT, blocked_by TEXT, parent TEXT, entered_at INTEGER, pos INTEGER);
    CREATE TABLE IF NOT EXISTS comments(id TEXT PRIMARY KEY, card_id TEXT, author TEXT, at TEXT, text TEXT, pos INTEGER);
  `);
  // Migrate older DBs (columns added nullable).
  const cardCols = db.prepare("PRAGMA table_info(cards)").all() as Array<{ name: string }>;
  const hasCardCol = (n: string) => cardCols.some((c) => c.name === n);
  if (!hasCardCol("labels")) db.exec("ALTER TABLE cards ADD COLUMN labels TEXT");
  if (!hasCardCol("blocked_by")) db.exec("ALTER TABLE cards ADD COLUMN blocked_by TEXT");
  if (!hasCardCol("parent")) db.exec("ALTER TABLE cards ADD COLUMN parent TEXT");
  const boardCols = db.prepare("PRAGMA table_info(boards)").all() as Array<{ name: string }>;
  if (!boardCols.some((c) => c.name === "collapsed")) db.exec("ALTER TABLE boards ADD COLUMN collapsed INTEGER");
  if (!boardCols.some((c) => c.name === "fold_w")) db.exec("ALTER TABLE boards ADD COLUMN fold_w REAL");
  return db;
}

/** Parse the JSON labels column defensively — tolerate null/legacy/garbage. */
function parseLabels(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function loadAll(db: DatabaseSync): WorldState {
  const boards = db.prepare("SELECT id,title,x,y,collapsed,fold_w FROM boards ORDER BY pos").all() as Array<{ id: string; title: string; x: number; y: number; collapsed: number | null; fold_w: number | null }>;
  const colStmt = db.prepare("SELECT id,name,wip FROM columns WHERE board_id=? ORDER BY pos");
  const cardStmt = db.prepare("SELECT id,title,notes,due,labels,blocked_by,parent,entered_at FROM cards WHERE column_id=? ORDER BY pos");
  const cmtStmt = db.prepare("SELECT id,author,at,text FROM comments WHERE card_id=? ORDER BY pos");

  return {
    boards: boards.map((b): Board => ({
      id: b.id, title: b.title, x: b.x, y: b.y, collapsed: !!b.collapsed, foldW: b.fold_w ?? undefined,
      columns: (colStmt.all(b.id) as Array<{ id: string; name: string; wip: number | null }>).map((c): Column => ({
        id: c.id, name: c.name, wip: c.wip,
        cards: (cardStmt.all(c.id) as Array<{ id: string; title: string; notes: string; due: string | null; labels: string | null; blocked_by: string | null; parent: string | null; entered_at: number }>).map((k): Card => ({
          id: k.id, title: k.title, notes: k.notes, due: k.due, labels: parseLabels(k.labels), blockedBy: parseLabels(k.blocked_by), parent: k.parent ?? null, enteredColumnAt: k.entered_at,
          comments: (cmtStmt.all(k.id) as Array<{ id: string; author: string; at: string; text: string }>).map((m) => ({ id: m.id, author: m.author, at: m.at, text: m.text })),
        })),
      })),
    })),
  };
}

/** Rewrite the whole workspace in one transaction — simple and correct at personal scale. */
export function saveAll(db: DatabaseSync, world: WorldState): void {
  db.exec("BEGIN");
  try {
    db.exec("DELETE FROM comments; DELETE FROM cards; DELETE FROM columns; DELETE FROM boards;");
    const ib = db.prepare("INSERT INTO boards (id,title,x,y,collapsed,fold_w,pos) VALUES (?,?,?,?,?,?,?)");
    const ic = db.prepare("INSERT INTO columns (id,board_id,name,wip,pos) VALUES (?,?,?,?,?)");
    const ik = db.prepare("INSERT INTO cards (id,column_id,title,notes,due,labels,blocked_by,parent,entered_at,pos) VALUES (?,?,?,?,?,?,?,?,?,?)");
    const im = db.prepare("INSERT INTO comments (id,card_id,author,at,text,pos) VALUES (?,?,?,?,?,?)");
    world.boards.forEach((b, bi) => {
      ib.run(b.id, b.title, b.x, b.y, b.collapsed ? 1 : 0, b.foldW ?? null, bi);
      b.columns.forEach((c, ci) => {
        ic.run(c.id, b.id, c.name, c.wip, ci);
        c.cards.forEach((k, ki) => {
          ik.run(k.id, c.id, k.title, k.notes, k.due, JSON.stringify(k.labels ?? []), JSON.stringify(k.blockedBy ?? []), k.parent, k.enteredColumnAt, ki);
          k.comments.forEach((m, mi) => im.run(m.id, k.id, m.author, m.at, m.text, mi));
        });
      });
    });
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
