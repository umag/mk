# may-kaiten — Kaiten-informed evolution roadmap

> Derived from `research/` (kaiten.ru study) filtered through PRODUCT.md / DESIGN.md.
> One umbrella, six slices. Each slice is a sibling issue under
> `may-kaiten-kaiten-evolution`; **checklists** is the chosen first slice and has a
> full review-hardened plan (in the issue model, planVersion 3). The rest are scoped
> here at plan-grade: goal, approach, data/ops impact, effort, risk, deps, fit.
> Effort: S ≈ ½–1 day · M ≈ 1–2 days · L ≈ 3+ days. All grounded in the current
> code (shared op-reducer in `core/state.ts`; data model in `types.ts`; overlays
> like `detail.ts`/`palette.ts`; persistence in `server/db.ts`).

## Recommended sequence
1. **Checklists / subtasks** — chosen, planned (S–M).
2. **Calm facade signals + WIP-breach** — S–M, low risk. Extends the facade-progress
   pattern checklists establishes; do it right after.
3. **"What's next" cross-board agenda** — M, low risk, fully independent.
4. **Soft archive (vs hard delete)** — M–L, medium risk (data + new view).
5. **Card duplicate + keyboard move-to-column** — S, low risk. Quick win, slot anywhere.
6. **Swimlanes** — L, high risk. Last: biggest data-model + render/dnd change.

Rationale: ship the low-risk, high-"glance"/"next-move" view features first; take on
data-model changes (archive) next; keep the large, invasive swimlanes rewrite for last
when the facade/dnd/persistence patterns are well-worn.

---

## 1. Checklists / subtasks  ·  S–M  ·  chosen first slice
Full plan lives in the issue model (`swamp data get may-kaiten-kaiten-evolution current`).
Card gains `checklist: ChecklistItem[]`; 3 dedicated ops; neutral facade progress;
Checklist section in detail; new `checklist_items` table. See the approved-pending plan.

---

## 2. Calm facade signals + WIP-breach  ·  S–M  ·  low risk
**Goal.** Read more of a card/column at a glance without chips: comment count, a subtle
"stuck Nd" stale marker, and a quiet WIP-over-limit column state.
**Approach.** Almost pure render-layer; the data already exists. `render.ts` adds a
comment-count glyph (from `card.comments.length`) and a stale marker derived from
`enteredColumnAt` (reuse `sinceLabel`); a new `core/stale.ts` returns a staleness level
against a constant threshold (e.g. 7d). Column header gains a breach state when
`cards.length > wip`.
**Scope.** `src/render.ts` (M), `src/styles.css` (M), `src/core/stale.ts` (A),
`DESIGN.md` (M — document the new facade signals), `tests/stale.test.ts` (A), e2e (M).
**Data/ops.** None — fully derived from existing state.
**Risk.** Low. The one design call: WIP-breach and stale must stay calm — neutral/
`--ink-3` markers, and reuse `--hot` only where genuine urgency already applies (overdue).
No new accent. Settle the breach token against DESIGN's "colour = action" rule.
**Deps.** After checklists (shares the card-foot render area; checklists sets the
progress pattern). **Fit.** "Один взгляд" / calm.

## 3. "What's next" cross-board agenda  ·  M  ·  low risk
**Goal.** A calm overlay listing upcoming + overdue cards by due date across *all* boards,
with jump-to-card. Serves "always know the next small move" across the sprawl.
**Approach.** A read-only overlay like `palette.ts`/`detail.ts`. New `src/agenda.ts`
flattens `store.world` to cards with a `due`, groups by `dueStateOf` (overdue / today /
this-week / later), renders a grouped list; click → `openDetail` or pan-to-card. Opened
by a hotkey and a command-palette entry.
**Scope.** `src/agenda.ts` (A), `src/keyboard.ts` (M — hotkey, e.g. `G`),
`src/palette.ts` (M — command entry), `src/canvas.ts` (M — optional pan-to-card),
`src/styles.css` (M), `tests/agenda.test.ts` (A — grouping/sort), e2e (M). Reuses
`core/due.ts`.
**Data/ops.** None — pure view.
**Risk.** Low (read-only). **Deps.** Independent. **Fit.** Directly serves the core JTBD
("always know the next move"); a calm answer to Kaiten's heavy Calendar/Timeline views.

## 4. Soft archive (vs hard delete)  ·  M–L  ·  medium risk
**Goal.** Recoverable archive instead of (or alongside) hard delete; an archive view with
restore; optional auto-archive of a board's last column. Keep boards clean, reversible.
**Approach.** Add `archivedAt: number | null` to `Card`. New ops `archiveCard` /
`unarchiveCard` (dedicated, like the existing collection ops). Reducer/render hide
archived cards from boards; a new `src/archive.ts` overlay lists them per board with a
restore action. `server/db.ts` gains an `archived_at` column (additive). Detail offers
Archive next to Delete (keep hard delete too — Kaiten keeps both).
**Scope.** `types.ts`, `core/ops.ts`, `core/state.ts`, `store.ts`, `render.ts` (hide
archived), `detail.ts` (archive action + key), `src/archive.ts` (A), `server/db.ts`
(M — additive column + load/save), `keyboard.ts`/`palette.ts` (M), `DESIGN.md`, tests,
e2e.
**Data/ops.** New nullable Card field + 2 ops + additive schema column.
**Risk.** Medium — touches the data model, persistence, and delete/menu semantics; the
facade filter must not break counts (column count should exclude archived). **Deps.**
Independent; benefits from the menu/detail work in #2/#5. **Fit.** "Keep boards clean,"
reversible-by-design.

## 5. Card duplicate + keyboard move-to-column  ·  S  ·  low risk
**Goal.** Duplicate a card; move a card to an arbitrary column via keyboard/menu (not
only advance/drag) — Kaiten's Duplicate + Move.
**Approach.** `store.duplicateCard(id)` clones with a fresh `uid` and inserts below the
source (reusing `addCard`); a "Move to column…" entry in `palette.ts` (or a detail
control) drives the existing `moveCard` op. No new ops or schema.
**Scope.** `src/store.ts` (M), `src/palette.ts` (M), `src/detail.ts` or `src/menu.ts`
(M), `tests/state.test.ts` (M), e2e (M).
**Data/ops.** None new (reuses `addCard`/`moveCard`).
**Risk.** Low. **Deps.** None — slot in as a quick win anytime. **Fit.** Pure ergonomics;
keep it minimal, no scope creep.

## 6. Swimlanes (дорожки)  ·  L  ·  high risk
**Goal.** Horizontal lanes within a board that split cards by category while sharing the
columns — and (per PRODUCT.md) **grow the canvas sideways**. Closes the explicit
vision↔implementation gap (the data model has no lane dimension today).
**Approach.** The invasive one. Today `Column.cards: Card[]`. Lanes need a (lane × column)
cell grid: add `Board.lanes: Lane[]` and address cards by `(laneId, columnId)` — either a
`laneId` on Card or a cell-keyed structure. New ops (`addLane`, `renameLane`, `moveLane`,
`moveCardToCell`); `moveCard`/`advance` become cell-aware. Render becomes a grid;
drag-and-drop drop targets become cells; `board-layout.ts`/`canvas-bounds.ts` size lanes
(taller per lane, wider canvas). Persistence: a `lanes` table + `card.lane_id`, with a
one-time backfill (existing cards → a default lane).
**Scope.** `types.ts`, `core/ops.ts`, `core/state.ts`, `render.ts`, `dnd.ts`,
`board-layout.ts`, `canvas-bounds.ts`, `store.ts`, `server/db.ts` (table + backfill),
`detail.ts` (lane in location crumb), `seed.ts`, tests, e2e — effectively the whole
board core.
**Data/ops.** New aggregate child (Lane), Card↔lane reference, schema migration with
backfill (the only real migration in the roadmap).
**Risk.** High — touches the core render/dnd/layout, the data model, and persistence at
once; needs its own design spike + likely its own multi-round plan review. **Deps.** Do
last. **Fit.** Honors PRODUCT.md's stated canvas vision; biggest single bet — worth a
dedicated planning pass (and possibly an HTML design artifact) before implementation.

---

## Notes
- Each slice is a separate `@magistr/issue-lifecycle` issue when started (e.g.
  `may-kaiten-facade-signals`, `may-kaiten-agenda`, `may-kaiten-archive`,
  `may-kaiten-swimlanes`). They are sequenced, not parallel — one canvas, one set of
  core files, so serial keeps the op-reducer/render churn legible.
- Deliberately **not** on the roadmap (Kaiten has them, may-kaiten rejects by
  philosophy): labels/tags/chips, the 13-report analytics suite, multi-view modes
  (Table/Timeline/Calendar — the agenda is our calm substitute), participants/requester/
  roles (single-user), per-card blockers (a "Waiting" column already covers it).
