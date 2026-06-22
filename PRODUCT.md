# Product

## Register

product

## Users

A single person — the maker — who self-hosts their own tools. A developer, keyboard-first,
comfortable in dark rooms and terminals, who reads for hours and cares about eye comfort
(16px type, high-contrast ink).

Their context is **sprawl**: dozens of Claude tabs, a wall of browser tabs, a mortgage
crawling through paperwork, dev projects, errands, things to read — all live in different
places at once, and nothing holds them together. They are not managing a team. They are
trying to give one busy life a single home, and to always know the next small move.

The job to be done: *capture a thought the instant it appears, put it where it belongs, and
push it forward one step at a time — without friction, without losing the thread.*

## Product Purpose

micro-kaiten is a **self-hosted personal kanban canvas** — many boards laid out in one
spatial area instead of one board at a time. A large **Inbox** board is the catch-all; the
rest are specialized (Dev, Mortgage, Life, Reading, …). You pan across the canvas; you don't
tab-switch between apps.

The signature mechanic is **advance**: one keystroke moves a card to the next column, and the
button always names where it's going (`→ Doing`, `→ Waiting`). Capture is the other
first-class act — a new card is always one key away, and the input stays hot so you can dump
five thoughts in five seconds.

Success looks like: it replaces the tab chaos. The maker reaches for micro-kaiten first,
captures without thinking, and always sees what's next. It runs on their own server on a
light stack (Deno + SQLite), single-user, no cloud, no accounts, no team overhead.

## Brand Personality

**Calm · Precise · Spatial.** Distinctive and opinionated — this is one person's command
deck, not a committee's SaaS product. The voice is quiet and a little literary (editorial
typography, considered language), never corporate or cheerful-for-its-own-sake. The feeling on
opening it is *relief*: the noise drops, the work is laid out in space, and the next move is
obvious. Best-in-class board and card craft is the whole point — the tool earns its place by
feeling better to use than anything it replaces.

## Anti-references

- **Jira, GitHub Projects, Plane** — corporate-SaaS busyness, configuration overload, chrome
  that crowds out the work, generic blue/teal palettes.
- **Trello** — label/tag soup, flat sea of identical cards, one board at a time.
- **Kandev / generic kanban tools** — undistinguished, template-feeling, no point of view.
- Behaviors to avoid: tunnel-vision single-board views, modal-heavy flows, loud or alarming
  color (the old vermillion read as an alarm — rejected), tiny cramped type, anything that
  makes capturing or advancing slower than it has to be.

Positive reference (not an anti-reference): **kaiten.ru** — its calm multi-board restraint and
clean card density are the bar to clear, reinterpreted as our own thing.

## Design Principles

1. **Capture without friction.** The fastest thing in the app is getting a thought *in*. New
   card is always one keystroke away; the input stays focused for the next one. If capture
   ever feels slower than a sticky note, we've failed.
2. **One canvas, not many tabs.** Everything lives in one spatial place. You pan and zoom; you
   never hunt across tabs or boards. **Scroll lives on the canvas, never the board** — long
   lists grow the canvas down, long swimlanes grow it sideways.
3. **One keystroke moves the work forward.** Advancing a card is the heartbeat of the tool. It
   must be instant, obvious (name the next column), and satisfying to repeat.
4. **Calm over loud.** Restraint in color and chrome so the content leads. Color signals
   *action* and *urgency* only — never decoration. The interface should recede.
5. **Built for one expert pair of hands.** Keyboard-first, dense where density earns its keep,
   and comfortable to read for hours. Opinionated on the maker's behalf, not designed by
   committee.

## Accessibility & Inclusion

Single-user, a11y-light by the maker's explicit choice — but never at the cost of the two
things that matter here:

- **Keyboard-first is non-negotiable.** Full keyboard navigation, an always-visible focus
  ring, discoverable hotkeys (an on-screen HUD).
- **Eye comfort / contrast.** 16px base type; neutral-warm, high-contrast ink on dark
  surfaces; body and interactive text meet WCAG AA. No light-gray-on-dark "elegance."
- **Reduced motion honored.** The default motion is weighted/tactile; `prefers-reduced-motion`
  falls back to an instant crossfade.
- Screen-reader exhaustiveness and color-blind-specific encodings are deprioritized for now.
  Optional sound (e.g. the advance "tick") is **off by default** and never the only signal.
