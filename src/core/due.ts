import type { DueState } from "../types";

// Due dates are stored as ISO "YYYY-MM-DD". Urgency and display label are
// derived (never stored), so a date entered once stays correct as days pass.

const DAY = 86_400_000;

function parseISO(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function dueStateOf(iso: string | null, now: number = Date.now()): DueState {
  if (!iso) return "none";
  const d = parseISO(iso);
  if (!d) return "none";
  const today = startOfDay(now);
  const due = startOfDay(d.getTime());
  if (due < today) return "overdue";
  if (due === today) return "today";
  if (due <= today + 7 * DAY) return "soon";
  return "none"; // far future carries no urgency color
}

export function dueLabel(iso: string | null, now: number = Date.now()): string {
  if (!iso) return "";
  const d = parseISO(iso);
  if (!d) return "";
  if (startOfDay(d.getTime()) === startOfDay(now)) return "today";
  return `${d.toLocaleString("en-US", { month: "short" })} ${d.getDate()}`;
}
