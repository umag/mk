import type { Store } from "./store";
import type { ID } from "./types";

/** Shared, mutable app context. Populated by main.ts during boot; imported by feature modules. */
export interface Ctx {
  store: Store;
  viewport: HTMLElement;
  world: HTMLElement;
  minimap: HTMLElement;
  scrollV: HTMLElement;
  scrollH: HTMLElement;

  rerender(): void;
  updateFocusRing(): void;
  updateChrome(): void;
  screenToWorld(sx: number, sy: number): { x: number; y: number };
  centerOn(x: number, y: number, w?: number, h?: number): void;

  setFocus(id: ID | null, opts?: { reveal?: boolean }): void;
  advance(id: ID, instant?: boolean): void;
  deleteCard(id: ID): void;
  requestColumnRename(columnId: ID): void;
  startCapture(columnId: ID): void;
  openDetail(id: ID): void;
  closeDetail(): void;
  openPalette(): void;
  closePalette(): void;
  toast(msg: string, opts?: { undo?: () => void }): void;
}

export const ctx = {} as Ctx;
