# Kaiten — Design Language & Philosophy (scraped reference)

> Source: kaiten.ru (homepage + product blog), scraped 2026-06-22. Kaiten is the
> Russian Kanban/work-management SaaS that `PRODUCT.md` names as the positive
> reference — "its calm multi-board restraint and clean card density are the bar to
> clear." This document captures *their* language so we can reinterpret it as ours,
> not copy it. Russian terms are quoted verbatim with English glosses.

---

## 1. Brand philosophy

- **"Кайтен — порядок в рабочих процессах"** — *Kaiten brings order to workflows.*
  Order is the headline promise, not speed, not collaboration. (Our analogue: opening
  the app should feel like *relief*, the noise dropping.)
- **Consolidation** — pull fragmented tools into one operational view; one place where
  every process is visible across teams and departments.
- **Transparency through visualization** — the recurring claim is that *seeing* the
  work is itself the solution. Key phrases: **"Взгляд сверху"** (bird's-eye view),
  **"Узкие места"** (bottlenecks), **"Визуализация"** (visualization as the
  differentiator).

## 2. Product philosophy — process-first, not tool-first

- **"Не меняйте процесс под инструмент"** — *Don't reshape your process to fit the
  tool.* The tool adapts to the team's real workflow rather than mandating a structure.
- **"Один статус — одно состояние"** — *one status = one state.* A column must mean
  exactly one level of readiness; nothing ambiguous shares a column. This is the
  cleanliness rule that keeps a board legible at a glance.
- **"Один взгляд"** — *one glance.* A well-configured card lets you read status,
  deadline, priority and bottlenecks in a single look. (This is the same bar we set
  for card density.)
- Everything ships in the tariff — card hierarchies, dependencies, blocking, reporting,
  analytics — "without add-ons or plugins." The pitch is *completeness*, not a
  marketplace.

## 3. Tone of voice

Direct, practical, results-oriented Russian business prose. Measurable outcomes (time
saved, tasks made visible, resources freed). Conversational with concrete examples,
local-expertise framing ("российский сервис", registered Russian software). Occasional
fire/rocket emoji for speed/growth — playful but sparing.

> **Divergence for may-kaiten:** our voice is quieter and more literary (editorial
> typography, single-maker command deck) — *not* the SaaS-business register. Take
> Kaiten's clarity and "one glance" discipline; leave the corporate-outcome tone.

## 4. Visual & interface language

Kaiten doesn't publish a brandbook, so the visual language is read from the UI itself:

- **Dashboard-centric, multi-board on one screen.** The signature move is several
  boards visible at once ("Compact Mode" / **компактный режим**) instead of one board
  at a time — the exact instinct behind our canvas. They achieve it by *collapsing*
  boards/lanes; we achieve it by *panning a spatial canvas*.
- **Color = meaning, applied to state.** Color is functional, attached to deadlines,
  blockers and WIP breaches (see §5) rather than decoration. Aligns with our rule
  "color signals action or urgency, never decoration."
- **Density without clutter.** Cards carry a lot (labels, avatars, fields, covers) but
  the prescriptive blog content is all about *removing* noise — collapse, archive,
  filter, configure the facade down. The aspiration is dense-but-calm.
- **Imagery:** clean interface screenshots; covers (**обложки**) let real images
  (product photos, screenshots) ride on a card.

> **Divergence:** Kaiten leans on **метки** (colored label chips) heavily. may-kaiten
> deliberately rejects "label/tag/colored chip soup" — our cards carry *content · due ·
> comments* only. So adopt Kaiten's facade *philosophy* (one glance, configurable,
> color-as-state) but not its chip density.

## 5. The color-as-state system (most transferable piece)

Kaiten encodes urgency in a handful of state colors — this is the part worth stealing
wholesale (we already do a version of it):

| Element | Kaiten behavior | may-kaiten echo |
|---|---|---|
| **Срок** (deadline) | gray = time left · yellow = due today · red = overdue · green = completed on time | `--ink` due dot → `--due` (warm) soon → `--hot` (red) overdue → `--done` (sage) complete |
| **Блокировка** (blocker) | bright red badge — **"яркая красная плашка"** — optionally names the blocking card | — (we have no blockers yet; red is reserved for overdue) |
| **Застоявшаяся карточка** (stale card) | red icon, bottom-right corner, when a card sits in one stage too long | analogue: our card-detail "time-in-column" metric |
| **WIP-лимит** breach | the **entire column turns red** when the limit is exceeded | optional `WIP n` chip; column-level warning is a candidate feature |
| **Обязательные поля** (required fields) | highlighted in color; a warning shows on the card facade when empty | quick-add validation surface |

Principle: red is rare and always means *urgency/impediment*. Matches our "red appears
only on overdue" discipline — Kaiten just has more red triggers (blocker, stale, WIP)
because it's a team tool.

## 6. Core vocabulary (their terms → ours)

| Kaiten (RU) | Gloss | may-kaiten term |
|---|---|---|
| Пространство | Space (top container) | the canvas / a board group |
| Доска | Board (kanban board) | Board (a draggable panel) |
| Колонка | Column / stage | Column |
| Подколонка | Sub-column | — |
| Дорожка | Swimlane (horizontal lane) | swimlane (grows canvas sideways) |
| Карточка | Card (one task) | Card |
| Ячейка | Cell (column × lane intersection) | — |
| Фасад карточки | Card facade (the card's face) | card foot row |
| Метка | Label / colored tag | *(rejected — no chips)* |
| Обложка | Cover image | — |
| WIP-лимит | WIP limit | `WIP n` chip |
| Очередь / В работе / Проверка / Готово | Backlog / In progress / Review / Done | board flow `backlog → doing → done` |
| Архив / автоархивация | Archive / auto-archive | archive |

## 7. Three hierarchy levels

`Пространство (Space) → Доска (Board) → Карточка (Card)`. Boards can be **pinned/linked
across spaces** (**"доска, привязанная к пространству"**) so one board appears as a
sidebar panel in several spaces — their answer to "the same Inbox in many contexts."
Our spatial canvas collapses this: one space, many boards laid out in 2D.

---

## 8. Live app observations (authenticated — the real product)

Driven with Playwright into `aopab.kaiten.ru` space 36022 ("Обустройство квартиры")
on 2026-06-22. This is the actual running UI, not marketing:

- **The product ships a dark theme, and it's good.** Near-black warm charcoal canvas,
  dark-gray cards, light text — the same register as our Night Editorial theme. Strong
  validation that a dark kanban canvas reads as calm, not gloomy.
- **In-app accent is purple/violet**, not the marketing coral — used on the primary
  `+`, the active tab underline, upgrade/AI badges. (We diverge: our accent is amber.
  The lesson is *one* accent carrying action, which both apps honour.) Exact computed
  hex tokens (canvas `#121212`, surfaces `#212121`/`#424242`, accent `#9C27B0`, the
  `--pm-color-*` palette) and the tech stack are in **`kaiten-frontend-reference.md`**;
  the full screen-by-screen UI inventory is in **`kaiten-interface-map.md`**.
- **Logo:** a layered concentric diamond/rhombus mark (red → teal → purple core) +
  "Kaiten" wordmark, top-left. The login art is flat editorial line-work (coral +
  mustard-amber + purple) of a person flying over kanban boards — playful, not corporate.
- **Cards are genuinely clean in practice.** On a real 37-card board the faces showed
  just *title* + an optional small round avatar — no chip soup. This is the "clean card
  density" PRODUCT.md targets, confirmed in the wild.
- **Multi-board canvas is real:** two boards ("Backlog", "Sprint") sit side by side in
  one space, each with its own columns — exactly our "many boards in one spatial area."
  (Kaiten lays them in a fixed row; we make the canvas pannable 2D.)
- **The advance mechanic exists here too.** The card detail's action bar has a pill that
  **names the next column** (`→ НА ДЕНЬ`) — the same idea as our advance button, though
  Kaiten tucks it in the detail modal rather than making it the board's heartbeat.
- **Card detail is a modal** over a dimmed canvas (deep-linkable URL
  `/boards/card/<id>`), with a left column of params (location breadcrumb, type chip,
  participants, deadline, description) and a right panel of Comments / "Спросить ИИ"
  (Ask AI). Mirrors our "one allowed modal — a focused peek."
- **Movement feedback is quiet:** dragging a card just relocates it and ticks the column
  counts (1→0 / 0→1); the emptied column reveals its quick-add input. No fanfare — which
  is exactly where our *weighted* advance motion can out-class Kaiten and still stay calm.

> Net: Kaiten in practice is closer to may-kaiten's aesthetic than its marketing
> suggests — dark, clean, multi-board, single-accent, advance-capable. Our edges to
> press: amber-warm editorial type over their neutral SaaS sans, a truly pannable
> canvas over a fixed board row, advance as the board's *heartbeat* (not buried in a
> modal), and tactile movement motion over their silent relocate.

---

## What to carry into may-kaiten

1. **"Один взгляд" / "Один статус — одно состояние"** — keep as design laws; they're
   already implicit in our card and column rules.
2. **Color-as-state, red is rare** — we already do this; Kaiten validates the palette
   discipline and suggests *additional* state triggers (stale, WIP) if we ever go
   multi-state.
3. **Multi-board-at-once restraint** — Kaiten reaches it by collapse/compact; we reach
   it by canvas. Same goal, better mechanic.
4. **Reject:** label/chip density, the corporate-outcome voice, modal-heavy config.
