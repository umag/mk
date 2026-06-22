import type { Board, Card, WorldState } from "./types";
import { uid } from "./dom";

const DAY = 86_400_000;

/** ISO date `offset` days from today (negative = past). */
function isoIn(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

let n = 0;
function card(
  title: string,
  opts: { dueInDays?: number; comments?: string[]; notes?: string; inCol?: number } = {},
): Card {
  return {
    id: uid("card"),
    title,
    notes: opts.notes ?? "",
    due: opts.dueInDays == null ? null : isoIn(opts.dueInDays),
    comments: (opts.comments ?? []).map((text, i) => ({
      id: uid("cm"),
      author: "You",
      at: `Jun ${18 + i}, ${String(9 + i).padStart(2, "0")}:15`,
      text,
    })),
    enteredColumnAt: Date.now() - (opts.inCol ?? ++n % 5) * DAY,
  };
}

export function seedWorld(): WorldState {
  const boards: Board[] = [
    {
      id: uid("board"),
      title: "Inbox",
      x: 40,
      y: 40,
      columns: [
        {
          id: uid("col"),
          name: "Capture",
          wip: null,
          cards: [
            card("Reply to bank re: mortgage rate lock", {
              dueInDays: -2,
              inCol: 3,
              notes:
                "Rate lock expires **Friday**. Need written confirmation of the new APR before signing anything.\n\n- Confirm the locked rate vs. today's offer\n- Ask whether the lock survives a valuation delay\n- Get it in email, not over the phone",
              comments: [
                "Lock expires Friday — don't let this slip. They quoted 4.71% but the paperwork still says 4.89%.",
                "Called — they'll email the corrected APR by EOD. Chase if nothing lands by 3pm, then advance this.",
              ],
            }),
            card("26 Claude tabs — archive the keepers, close the rest", {
              comments: ["The local-first one and the OKLCH thread are worth saving."],
            }),
            card("Call plumber about the kitchen leak", { dueInDays: 0 }),
            card("Read: “Local-first software” essay"),
            card("Renew car insurance before it lapses", { dueInDays: 8 }),
          ],
        },
        { id: uid("col"), name: "Triaged", wip: null, cards: [] },
      ],
    },
    {
      id: uid("board"),
      title: "micro-kaiten · Dev",
      x: 392,
      y: 40,
      // Dev / Mortgage / Life stack down the right; Inbox runs tall on the left.
      columns: [
        {
          id: uid("col"),
          name: "Backlog",
          wip: null,
          cards: [
            card("SQLite schema for boards & cards", {
              comments: ["boards, columns, cards, comments. Keep card order as a float index."],
              notes: "Single-writer, WAL mode. Order via fractional indexing so reorders are O(1).",
              inCol: 2,
            }),
            card("Drag a card between boards"),
          ],
        },
        {
          id: uid("col"),
          name: "Doing",
          wip: 2,
          cards: [
            card("Canvas pan & zoom — scroll grows the canvas, not the board", {
              dueInDays: 1,
              comments: ["Inertia on trackpad. Space-drag to pan with the mouse."],
              inCol: 1,
            }),
          ],
        },
        {
          id: uid("col"),
          name: "Review",
          wip: null,
          cards: [card("One-click advance with next-column label", { comments: ["⇧⏎ for instant."] })],
        },
        {
          id: uid("col"),
          name: "Done",
          wip: null,
          cards: [card("Deno server skeleton", { inCol: 4 })],
        },
      ],
    },
    {
      id: uid("board"),
      title: "Mortgage",
      x: 392,
      y: 440,
      columns: [
        {
          id: uid("col"),
          name: "To do",
          wip: null,
          cards: [card("Upload last 3 payslips to broker", { dueInDays: -1 })],
        },
        {
          id: uid("col"),
          name: "Waiting",
          wip: null,
          cards: [
            card("Chase valuation report", {
              dueInDays: 5,
              comments: ["Surveyor booked for the 28th.", "Lender said 3 working days after that.", "Pushed them again.", "Still nothing."],
            }),
          ],
        },
        { id: uid("col"), name: "Done", wip: null, cards: [card("Submit application", { inCol: 4 })] },
      ],
    },
    {
      id: uid("board"),
      title: "Life & Errands",
      x: 392,
      y: 720,
      columns: [
        {
          id: uid("col"),
          name: "Today",
          wip: null,
          cards: [card("Groceries + pharmacy run"), card("Gym — easy 5k")],
        },
        { id: uid("col"), name: "This week", wip: null, cards: [card("Book dentist check-up", { dueInDays: 5 })] },
        { id: uid("col"), name: "Someday", wip: null, cards: [card("Plan the Italy trip 🇮🇹")] },
      ],
    },
  ];

  return { boards };
}
