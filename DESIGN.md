# Design — micro-kaiten

**Theme: Night Editorial · Lamplight Amber.** A dark, type-led, keyboard-first canvas. Warm
charcoal surfaces under a calm amber accent that glows like a desk lamp, never an alarm.
Editorial typography (a serif for titles, a clean sans for content, a mono for keys and meta)
at a comfortable 16px base. Restrained, spatial, opinionated — a personal command deck.

Reference renders (the look of record):
- `.impeccable/explorations/e-synthesis-canvas.png` — the board canvas
- `.impeccable/explorations/f-card-detail.png` — the card detail view
- `.impeccable/explorations/h-tactility.png` — the advance motion (weighted)

All color is **OKLCH**. The accent is the only hue with real chroma; everything else is a
warm near-neutral. Color means *action* or *urgency* — never decoration.

---

## Design laws

Two laws, taken from the Kaiten study (the positive reference) and held as hard constraints —
every component answers to them:

- **One glance (Один взгляд).** A card's state — what it is, when it's due, how much
  conversation it carries — reads in a single look. If a signal needs a second glance to
  decode, it's too quiet or too noisy. The card facade carries *content · due · comments* and
  nothing more; everything past that lives in the detail sheet.
- **One status = one state (Один статус — одно состояние).** A column means exactly one level
  of readiness; nothing ambiguous shares a column. The board stays legible because position
  alone is unambiguous — and that is precisely what lets **advance** be a single, obvious
  keystroke.

---

## Color

### Surfaces (warm charcoal, hue 80)
| Token | OKLCH | Role |
|---|---|---|
| `--bg` | `oklch(0.185 0.006 80)` | canvas background (with a dot grid + soft top glow) |
| `--bg-2` | `oklch(0.205 0.006 80)` | top bar, raised gradients |
| `--panel` | `oklch(0.222 0.006 80)` | board panel |
| `--panel-hi` | `oklch(0.245 0.007 80)` | board header gradient top |
| `--col` | `oklch(0.205 0.006 80)` | column / inset field background |
| `--card` | `oklch(0.255 0.007 80)` | card surface |
| `--card-hi` | `oklch(0.285 0.008 80)` | focused / hovered card |
| `--line` | `oklch(0.32 0.008 80)` | borders, dividers |
| `--line-soft` | `oklch(0.275 0.007 80)` | hairline borders, soft separators |

### Ink (warm off-white, hue 85)
| Token | OKLCH | Role |
|---|---|---|
| `--ink` | `oklch(0.93 0.01 85)` | primary text — card titles, board content (AA on `--bg`) |
| `--ink-2` | `oklch(0.78 0.01 85)` | secondary text, notes/comment body |
| `--ink-3` | `oklch(0.62 0.01 85)` | tertiary — column labels, quiet meta |
| `--ink-4` | `oklch(0.50 0.01 85)` | faint — hints, placeholder, decorative meta only |

Never lighter (lower-chroma greys) for body text. If contrast is close, move toward `--ink`.

### Accent — Lamplight Amber
| Token | OKLCH | Role |
|---|---|---|
| `--accent` | `oklch(0.80 0.09 73)` | primary action: New card, armed advance button, active focus ring, quick-add ring, caret |
| `--accent-2` | `oklch(0.72 0.10 68)` | accent hover / "due soon" dot / button shadow tint |
| `--accent-ink` | `oklch(0.24 0.03 70)` | text/icon on an accent fill (dark-on-amber, passes AA) |
| `--accent-ghost` | `oklch(0.80 0.09 73 / 0.13)` | focus halo, soft accent fills, glow-pulse ring |

The accent is calm by design (chroma ~0.09). It was deliberately pulled back from a saturated
vermillion, which read as an alarm. **Clean treatment — no CRT bloom, no scanlines.**

### Semantic
| Token | OKLCH | Role |
|---|---|---|
| `--hot` | `oklch(0.66 0.15 32)` | **overdue only** — the only saturated red in the system, used sparingly |
| `--hot-bg` | `oklch(0.66 0.15 32 / 0.14)` | overdue pill background |
| `--due` | `oklch(0.72 0.10 68)` | due-soon **and due-today** dot/text (warm, calm) |
| `--done` | `oklch(0.74 0.06 155)` | done/shipped marker, completed column label (muted sage) |

### Usage rules
- Exactly one accent hue (amber = *action*). Red (`--hot`) appears *only* on overdue — not on
  due-today, not on a WIP-breach, not on a stale card. Sage (`--done`) *only* on completion.
  Everything else is surface + ink.
- **Calm state signals.** Advisory states (a WIP column over its limit, a card gone stale, **a
  blocked card**) are signalled by a **contrast jump** — faint ink → full `--ink` + weight + a
  subtle neutral lift — never by a new hue. Full-contrast ink is the loudest a non-urgent signal ever gets. Color
  is reserved for genuine urgency (overdue) and the one action accent.
- Inactive/disabled states never carry full-saturation accent.
- Tinted neutrals lean very slightly warm (hue 80–85, chroma ≤ 0.01) — the warmth lives in the
  ink and accent, not in a loud surface tint.

### Color-as-state — the deadline ramp

Color encodes *state* applied to deadlines — Kaiten's most transferable idea, in our calm
register. The ramp, from no-pressure to urgent to resolved:

| State | Token | Treatment |
|---|---|---|
| no due / far future | `--ink-4` | quiet grey dot, no color |
| due soon (≤ 7d) | `--due` | warm dot + text |
| **due today** | `--due` | warm — *today is not red*; it's the last calm step |
| **overdue** | `--hot` | the system's only saturated red |
| completed | `--done` | muted sage |

**Bounded future triggers (pre-specified calm).** When multi-state signals arrive (roadmap:
stale card, WIP breach) they obey the *calm state signal* rule above — neutral contrast-jump
markers, never red. Red stays overdue-only; an over-limit or stale card is advisory, not an
alarm.

### Selection & highlight fills

One fill pattern for every "active / selected / will-receive-the-drop" state: a **translucent
accent wash** — `--accent-ghost` (amber at ~0.13 alpha), optionally over a 1px accent inset.
(Kaiten uses the identical trick at 0.16 alpha across its whole `--pm-color-*` palette; we use
one calm amber.) It covers the focus halo, the command-palette active row, the column
drop-target, and the quick-add ring — the same wash everywhere, so "active" always looks the
same. Never a solid accent block for selection; the wash keeps the surface calm.

---

## Typography

Base **16px** (`html { font-size: 16px }`); all sizes in `rem`. Three families, each with one
job — that *is* the hierarchy (alongside weight), so the size scale stays tight (~1.25).

| Family | Use | Notes |
|---|---|---|
| **Fraunces** (`--serif`) | display: brand wordmark, board titles, card-detail title | `font-optical-sizing: auto`, weight ~560, letter-spacing −0.02em, italic for the accented word |
| **Inter** (`--sans`) | body: card titles, notes, comments, buttons, UI labels | weight 400–650; the workhorse |
| **JetBrains Mono** (`--mono`) | meta & keys: column labels, counts, dates, `kbd`, breadcrumbs, board flow | uppercase + 0.08em tracking for column labels |

Scale (rem): board title `1.32`; card-detail title `1.62`; **card title `1.0`** (the comfort
anchor); notes `1.0`/1.62 line-height; comment body `0.96`; meta/mono `0.74–0.8`; `kbd`
`0.72`. Prose (notes) caps at ~65–75ch; dense card/meta text may run tighter.

`text-wrap: balance` on board/card-detail titles; `text-wrap: pretty` on notes.

---

## Spacing, radius & elevation

- **Spacing:** 4px base step. Common: card padding `13–14px`; column gap `14px`; board padding
  `15px`; section gaps `18–22px`. Vary for rhythm; don't make everything uniform.
- **Radius:** board `12px`; card `10px`; buttons/fields `8–9px`; card-detail sheet `16px`;
  pills/`kbd` `5–6px`. (`--r: 12px; --rc: 10px`.)
- **Elevation** (shadow, never a flat outline alone): boards float over the canvas with a soft
  ambient shadow + a 1px inner top highlight; cards have a faint lift; the focused card and the
  card-detail sheet sit highest. Shadows are warm-black and diffuse, not hard.

---

## The canvas model (product-defining — get this right)

- **Scroll lives on the canvas, never on a board or column.** Boards and columns have **no
  internal scrollbars**. A board is sized to its content: a long list makes the board **taller**
  (canvas grows down); long swimlanes make it **wider** (canvas grows sideways).
- The canvas pans (drag / `Space`-drag / trackpad) with **inertia**, and zooms. Background is a
  warm dot grid with a soft radial glow at top and a gentle vignette, so empty space reads as
  "more canvas," not emptiness.
- **Boards** are draggable panels positioned in 2D space. Specialized boards are neighbours of
  a big **Inbox**.
- **The anchor board defines the canvas corner.** The leftmost — then topmost — board (the
  Inbox, in practice) is the **anchor**: its top-left corner is the canvas's fixed top-left
  border. The anchor is **pinned** (not draggable) and carries an amber **pin** glyph in place
  of the drag grip. Every other board is **clamped** to the anchor's corner — you can't drag a
  board above or left of it; boards only ever fan out to the **right and below**, snapping clear
  of each other (never overlapping). Panning can't reveal void above or left of the anchor.
- **No free-floating — boards magnet to the corner.** Dropping a board (or folding/unfolding one)
  packs the layout **toward the anchor (up + left)**, closing gaps, with a soft *magnet* clack. You
  float freely **while dragging**; the snap happens on release. Boards in genuinely different lanes
  stay side-by-side (the pack doesn't stack everything into one column).
- **Fold a board to a horizontal bar** that **keeps its width**: a `^` chevron collapses it to its
  header (title + card count, `⌄` to unfold), freeing canvas *height* so the boards below magnet up.
  The folded width is remembered (persisted) so the bar stays the board's length. `⌘K → Collapse all
  boards` / `Expand all boards` does the whole canvas at once. Folded bars are still draggable; the
  Archive is never foldable.
- A **minimap** (bottom-right) shows board rectangles + the current viewport; thin **canvas
  scrollbars** ride the right/bottom edges. A zoom indicator lives in the top bar.

---

## Components

Every interactive element ships all of: default, hover, focus, active, disabled, loading,
selected. Same shape, same vocabulary everywhere.

- **Top bar** — Fraunces wordmark `micro·kaiten` (accent on the italic "kaiten") + mono path;
  the **New card** primary button (`+ New card  N`); a command/search field (`⌘K`); zoom.
- **New card / quick capture** *(top-priority action)* — global `N` and the top-bar button both
  open capture instantly. Each board's first column carries an always-visible **quick-add**
  input; when active it gets the accent ring + blinking caret, and **stays focused after submit**
  so you can capture in a burst. **Paste a link** and the card appears at once with the URL as
  title + notes, then its title swaps to the fetched page title (server-side unfurl; falls back
  to the URL). Existing URL-titled cards are backfilled the same way on load.
- **Board** — panel with a header (Fraunces title, mono `flow` like `backlog → doing → done`,
  count) over a row of columns.
- **Column** — mono uppercase label + count, optional `WIP n` chip; completed column label uses
  `--done`. No scrollbar — it grows. **Click the label to rename it inline** (no menu detour);
  drag the header to reorder.
- **Card** — fixed-width `--card` surface; **title** always (16px). A foot appears **only when
  there's meta**: a **due** date (left, mono, never wraps) and/or a **comment** glyph + count
  (right). Nothing shifts as text changes — the card is a fixed size and its fields are anchored,
  not text-driven. When a due is set the whole card is tinted by deadline state: a calm warm
  border for soon/today, a faint red border + wash for overdue (red `--hot` is overdue-only).
  Cards carry *title · labels · due · comments*, plus calm relationship signals when present — a
  **⊘ Blocked** badge (advisory ink, never red) and a **subtask roll-up** (`done/total`). Labels are
  colour-coded chips with the hue derived from the text (restraint, not chip-soup); there is **no
  per-card advance button**. Bare http(s) URLs in the title (and in detail notes) render as
  **clickable amber links** (`a.link`, open in a new tab); the link swallows the click so it never
  drags or opens the card.
- **Advance** — advancing is **implied, not a button on every card**: focus a card and press `A`
  (`⇧A` = instant), surfaced in the HUD. The card-detail sheet holds the one advance control —
  an **arrow + the (truncated) next-column name** + `A` hint (e.g. `→ Triaged`), never a wordy
  "Advance to …".
- **Card detail sheet** — a **two-column** editorial sheet over a blurred, dimmed canvas. Left =
  the main content: Fraunces title; a meta bar with **due**, a **time-in-column** metric and a
  prominent **`→ {Next}` advance** button; **labels**; **relationships** (Parent · Subtasks with a
  done/total roll-up · Blocked-by); and a **Description** whose placeholder is its own call to action
  (markdown, autosaved as you type — never on blur, so copy/paste keeps edit mode). Right = a
  **comments** panel with a `⌘⏎` composer pinned at its foot. A single **`+`** adds the things a card
  doesn't have yet (due date · label · blocker · subtask) via bespoke pickers, and empty fields
  aren't shown. (Card detail is the one allowed "modal" — a focused peek, not a flow blocker.)
- **Relationships** — cards relate two ways: **dependencies** (a card is *blocked by* others; the
  block **auto-resolves** once a blocker reaches a done column / the archive — no manual unblock, and
  signalled by the calm advisory badge, never red) and **parent/child subtasks** (a parent rolls up
  `done/total`, done children struck through). Both are added from the detail `+` via a bespoke
  **card picker** (search by title), shown as navigable rows (click to pan to the card), with
  self/cycle guards.
- **Date picker** — a **bespoke** calendar popover (never the browser's native control, which
  can't be themed). Opens under the due field on `--panel-hi` with `--sh-pop`; mono numerals,
  Monday-start week, amber-fill on the selected day, `--accent` text on today, dimmed `--ink-4`
  for adjacent-month days; `Today` / `Clear` footer. Keyboard-first: arrows move the cursor,
  `⏎` picks, `Esc` closes, `PageUp/Dn` change month. Sits above the sheet at `--z-popover`.
- **Archive board** — a special, **normally-hidden** board (reserved id) that holds cards which
  sat in a done column for **≥ 10 days** (swept on load and hourly; cards just *move* there via
  the normal reducer, so it persists like any edit). It's excluded from the canvas, the anchor,
  the minimap, and the palette's board/card lists. You reach it only via **⌘K → "Go to Archive"**;
  the top bar then reads `~/archive` with a `← Canvas` button, and `Esc` returns. The Archive is
  read-only (no add/menu/rename/drag, box glyph instead of the grip) — a quiet shelf, not a lane.
- **Hotkey HUD** — persistent bottom-left bar listing the live keys: `N` new · `⏎` advance ·
  `O` open · `J K` move · `Space` pan · `/` search. Keyboard-first is surfaced, not hidden.
- **kbd** — mono, 1px border with a 2px bottom border (keycap), on `--bg`.

---

## Iconography

Single line-icon set, ~1.8–2.4 stroke, `currentColor`, ~14–17px in UI. The **arrow** (`→`) is
the product's signature glyph (advance). No filled/duotone mixing, no decorative icons.

---

## Motion — Weighted (the chosen default)

Tactile and physical, but never blocking. Every action is **optimistic and interruptible** —
the outcome is immediate; the motion is feedback you can fire over.

- **Advance** (`⏎`): card lifts (shadow grows, slight scale) → arcs to the next column with a
  brief motion trail → settles with a momentum ease and a small spring, then a `--accent-ghost`
  **glow pulse** on arrival; the column count ticks. ~150ms, re-arms to the next column. Fire
  again mid-flight and it keeps moving. `⇧⏎` = **instant** (no motion) for blitzing triage.
- **Quick-add**: the new card drops/expands into place (height + fade); input stays hot.
- **Drag**: card lifts off the canvas (shadow + scale + grab cursor); columns reflow to open a
  gap.
- **Canvas pan/zoom**: inertia/momentum, so the surface feels physical.
- **Focus move** (`J`/`K`): the focus ring **glides** between cards rather than teleporting.
- **Optional sound**: a soft mechanical "tick" on advance — **off by default**, a toggle, never
  the sole signal.

Easing: ease-out curves (quart/quint) with a *small* spring on settle (no bounce/elastic
elsewhere). Most transitions 120–180ms.

**Reduced motion:** `prefers-reduced-motion: reduce` → instant crossfades, no slide/spring/
trail, glow pulse reduced to a static ring. The "weight" is purely visual sugar; nothing
depends on it.

---

## Accessibility

- Keyboard-first: every action has a key; focus ring always visible (accent, 1px + ghost halo).
- WCAG AA on body and interactive text. 16px base. Warm high-contrast ink — no light-gray body.
- `--accent-ink` on `--accent` fills is dark-on-amber and passes AA.
- Reduced motion honored (see Motion). Sound off by default and redundant.

---

## Automation & data contract

The interface is also a test surface: keyboard-first means the e2e suite drives the same
paths the maker does. Borrowed from Kaiten's clean DOM contract (`research/kaiten-frontend-reference.md`):

- **Stable hooks on every interactive node.** Cards, boards and columns carry semantic `data-*`
  ids (`data-card-id`, `data-board-id`, `data-column-id`) that the app and Playwright both
  select on — never positional or class-based selectors for behaviour.
- **`data-testid` for the e2e.** Every interactive node carries a stable `data-testid` naming
  *what kind* of control it is — `card`, `card-advance-button`, `column-menu-button`,
  `new-card-button`, `command-palette-item`, `menu-item-<action>` (slugged from the label).
  Combined with the `data-*` ids above: testids say *what*, ids say *which*. Set them via the
  `el` helper's `data: { testid: … }` (lowercase key — `data-testId` would emit the wrong
  `data-test-id`). New controls get a testid when they're added, not retrofitted later.
- **Divergence — no per-card deep link.** Kaiten cards are `<a href="/…/card/<id>">` for
  open-in-new-tab and deep-linking. micro-kaiten is one spatial canvas: you *pan* to a card, you
  don't route to it, so cards stay `<article>` with no anchor. Deep-linking, if ever wanted,
  attaches to the detail sheet — not the card face.

---

## Anti-patterns (what micro-kaiten never does)

- Inner scrollbars on boards or columns (scroll is canvas-level only).
- Chip *soup* on cards — many loud tags competing for the eye. (Calm, hue-from-text labels and a
  single advisory **Blocked** badge are restraint, not absence.)
- Loud or alarming color; saturated accents on idle/disabled states; red anywhere but overdue.
- Red (or any new hue) on a WIP-breach, a stale card, a **blocked card**, or due-today — advisory
  states stay calm (a contrast jump, never an alarm color). Red is overdue-only.
- Side-stripe accent borders, gradient text, decorative glassmorphism, hero-metric templates,
  identical icon-card grids, tracked all-caps eyebrows on every section.
- Modal-first flows (card detail is the single, deliberate exception).
- Tiny cramped type; light-gray body text; CRT glow/scanlines (evaluated, rejected as too
  bright for long reading).

---

## Validated against Kaiten (live app, 2026-06-22)

The system was checked against the category leader — a live Kaiten instance, driven and
captured in `research/`. The findings *confirmed* the direction rather than redirecting it:

- **The dark warm canvas is right.** Kaiten's real product ships a near-black warm-charcoal
  canvas with light text and reads as calm, not gloomy — exactly Night Editorial's bet.
- **One accent, carrying action.** Kaiten uses a single in-app accent (purple) for the primary
  `+`, the active tab, badges. We keep the *one-accent* discipline; the hue diverges (amber,
  warm/editorial) by choice.
- **Clean cards survive density.** A real 37-card board showed just title + a small avatar — no
  chip soup. Our calm facade (content · labels · due · comments, plus advisory blocked/subtask
  signals) clears the same bar.
- **Advance exists, but buried.** Kaiten's "→ next column" pill hides in the card-detail modal;
  we make advance the board's *heartbeat* (focused-card button + `⏎`). That is our signature edge.

**Deliberate divergences (evidence-backed, not oversights):** amber not purple · warm OKLCH
surfaces (hue 80) not MUI pure-grey · 16px base not 14px · no `--pm-color-*` label/chip palette
· pannable 2D canvas not a fixed board row · tactile *weighted* advance not a silent relocate.
Full study: `research/kaiten-design-language.md`, `kaiten-frontend-reference.md`,
`kaiten-interface-map.md`.
