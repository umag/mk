# Design — may-kaiten

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
| `--due` | `oklch(0.72 0.10 68)` | due-soon dot/text (warm, calm) |
| `--done` | `oklch(0.74 0.06 155)` | done/shipped marker, completed column label (muted sage) |

### Usage rules
- Exactly one accent hue. Red (`--hot`) appears *only* on overdue items. Sage (`--done`) *only*
  on completion. Everything else is surface + ink.
- Inactive/disabled states never carry full-saturation accent.
- Tinted neutrals lean very slightly warm (hue 80–85, chroma ≤ 0.01) — the warmth lives in the
  ink and accent, not in a loud surface tint.

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
- **Boards** are draggable panels positioned in 2D space. A big **Inbox** anchors the canvas;
  specialized boards are neighbors.
- A **minimap** (bottom-right) shows board rectangles + the current viewport; thin **canvas
  scrollbars** ride the right/bottom edges. A zoom indicator lives in the top bar.

---

## Components

Every interactive element ships all of: default, hover, focus, active, disabled, loading,
selected. Same shape, same vocabulary everywhere.

- **Top bar** — Fraunces wordmark `may·kaiten` (accent on the italic "kaiten") + mono path;
  the **New card** primary button (`+ New card  N`); a command/search field (`⌘K`); zoom.
- **New card / quick capture** *(top-priority action)* — global `N` and the top-bar button both
  open capture instantly. Each board's first column carries an always-visible **quick-add**
  input; when active it gets the accent ring + blinking caret, and **stays focused after submit**
  so you can capture in a burst.
- **Board** — panel with a header (Fraunces title, mono `flow` like `backlog → doing → done`,
  count) over a row of columns.
- **Column** — mono uppercase label + count, optional `WIP n` chip; completed column label uses
  `--done`. No scrollbar — it grows.
- **Card** — `--card` surface; title at 16px; a foot row with a **due** dot+date (warm; red
  `--hot` only when overdue), a **comment** count (mono + bubble icon), and the **advance
  button**. Cards carry *content · due · comments* only — **no labels/tags**.
- **Advance button** — `→ {NextColumn}` naming the destination. Ghost by default; on the focused
  card it fills with `--accent` + `--accent-ink` and shows a `⏎ advance` key hint above the card.
- **Card detail sheet** — centered editorial sheet over a blurred, dimmed canvas. Header:
  breadcrumb (`Board / Column · card #`) + key hints (`E` edit, `⏎` advance) + close. Body:
  Fraunces title; a meta bar with **due** and a **time-in-column** metric and a prominent
  **Advance to {Next} ⏎** button; a **Notes** section (markdown body — the "card content"
  priority); a **Comments** thread with avatars + timestamps and a `⌘⏎` composer. (Card detail
  is the one allowed "modal" — it's a focused peek, not a flow blocker.)
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

## Anti-patterns (what may-kaiten never does)

- Inner scrollbars on boards or columns (scroll is canvas-level only).
- Labels/tags/colored chip soup on cards.
- Loud or alarming color; saturated accents on idle/disabled states; red anywhere but overdue.
- Side-stripe accent borders, gradient text, decorative glassmorphism, hero-metric templates,
  identical icon-card grids, tracked all-caps eyebrows on every section.
- Modal-first flows (card detail is the single, deliberate exception).
- Tiny cramped type; light-gray body text; CRT glow/scanlines (evaluated, rejected as too
  bright for long reading).
