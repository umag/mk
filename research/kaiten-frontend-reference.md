# Kaiten — Frontend / Code Reference (scraped from the live app)

> Extracted by driving a live Kaiten instance with Playwright on 2026-06-22 and reading the
> live DOM, computed styles, CSS custom properties, loaded fonts and asset manifest.
> This is *reference* for building micro-kaiten — Kaiten's stack and tokens, with the
> deliberate ways micro-kaiten diverges noted. All values are real, read off the running app.

## Tech stack (fingerprinted)

| Layer | Kaiten | Evidence |
|---|---|---|
| UI framework | **React** | MUI requires it; `app-emotion-styles` + MUI class trees |
| Component lib | **MUI (Material-UI)** | `MuiButtonBase-root MuiButton-outlined MuiButton-colorGrey …` |
| Styling | **Emotion** (CSS-in-JS) + atomic classes | `style[data-emotion="app-emotion-styles …"]`, hashed `v5-v5xxx` classes |
| Fonts | **Roboto** 400/500 loaded (100–900 declared), fallback Helvetica/Arial | `document.fonts`; `font-family: Roboto, Helvetica, Arial, sans-serif` |
| Build/CDN | webpack-style **hashed bundles** on a static CDN | `…/static/hashed/{manifest,lib,main,<chunk>}.<hash>.{js,css}` |
| 3rd-party | Dropbox dropins, Google APIs, CloudPayments | `<script src>` list |
| App version | Kaiten **58.39.0** | login footer |

> **micro-kaiten contrast:** Vite + TS, no component library, hand-rolled CSS with **OKLCH
> custom properties** (not a JS theme), Fraunces/Inter/JetBrains Mono (not Roboto). Kaiten
> is a generic MUI dark theme; micro-kaiten's whole point is bespoke editorial craft.

## Design tokens (computed, real values)

### Surfaces — MUI dark greyscale
| Role | Value | Hex |
|---|---|---|
| Canvas (darkest, most-used) | `rgb(18,18,18)` | `#121212` |
| Body / app background | `rgb(33,33,33)` | `#212121` |
| Raised surface / card | `rgb(66,66,66)` | `#424242` |
| Surface alt | `rgb(48,48,48)` · `rgb(45,45,45)` · `rgb(71,71,71)` | `#303030 #2D2D2D #474747` |
| Mid grey (borders/disabled) | `rgb(117,117,117)` | `#757575` |

### Accent — MUI **Purple**
| Role | Value | Hex |
|---|---|---|
| Primary accent (most-used) | `rgb(156,39,176)` | `#9C27B0` (Purple 500) |
| Accent hover / button fill | `rgb(171,71,188)` | `#AB47BC` (Purple 400) |
| Muted/selected purple | `rgb(105,57,114)` | `#693972` |

### Text — white on dark
`#FFFFFF` primary · `rgba(255,255,255,0.7)` secondary · `#9E9E9E`/`#808080` hint/disabled.

### Semantic color system — CSS custom properties (the label/state palette)
Kaiten exposes a small set of named palette colors (prefix `--pm-`, "project management"),
each MUI-standard, **each with a 0.16-alpha "highlight" variant** for fills/selection:

```
--pm-color-blue:   #2196f3    --pm-color-highlight-blue:   rgba(33,150,243,.16)
--pm-color-green:  #4caf50    --pm-color-highlight-green:  rgba(76,175,80,.16)
--pm-color-yellow: #fbc02d    --pm-color-highlight-yellow: rgba(251,192,45,.16)
--pm-color-orange: #ff9800    --pm-color-highlight-orange: rgba(255,152,0,.16)
--pm-color-red:    #f44336    --pm-color-highlight-red:    rgba(244,67,54,.16)
--pm-color-cyan:   #00bcd4    --pm-color-highlight-cyan:   rgba(0,188,212,.16)
--pm-color-grey:   #757575    --pm-color-highlight-grey:   rgba(117,117,117,.16)
--app-tree-width:  300px      (left sidebar width)
```
These back the card colors, labels (метки) and the deadline states (grey→yellow→red→green).
Note there are **only ~15 CSS vars** — MUI carries the rest of the theme in JS, not CSS.

### Shape & type metrics
- Button radius **8px**, padding `4px 8px`, letter-spacing `0.4px` (MUI button).
- Base font **14px** / line-height **20px** / letter-spacing **0.15px** (MUI body2).
- Column header: weight **500**, letter-spacing `0.1px`.
- Sidebar width **300px** (`--app-tree-width`).

> **micro-kaiten contrast:** 16px base (not 14px), warm-neutral OKLCH surfaces (hue 80) not
> pure-grey, a single amber accent (not purple), and **no chip-color palette** — micro-kaiten
> rejects the `--pm-color-*` label system entirely (cards carry content·due·comments only).

## Component markup patterns (real, trimmed)

**Card** — native HTML5 draggable, deep-link anchor, stable test hooks:
```html
<div data-testid="board-card-item" data-role="board-card-item"
     id="board-card-61298427" data-card-id="61298427"
     data-test-title="курсы актерского" class="boardCard v5-v5589" draggable="true">
  <a href="/space/36022/boards/card/61298427" target="_blank" rel="noopener"></a>
  <div data-testid="card-type-change-button" title="Card. Нажмите, чтобы изменить тип">
    <span class="…"></span>          <!-- the type color dot -->
  </div>
  …                                  <!-- title, facade-members, facade-deadline, facade-comments-counter -->
</div>
```
Takeaways worth copying: **`data-card-id` + `data-testid` on every card** (clean test/automation
surface), a real `<a href>` to the card for deep-linking/open-in-new-tab, `draggable="true"`
(HTML5 DnD), and a per-card **type color dot** as the left marker.

**Column add control** is a MUI outlined button `data-test="create-new-card…"`.

## Assets
- CSS: `…/hashed/main.<hash>.css`, `…/hashed/<chunk>.<hash>.css`
- JS: `…/hashed/manifest.<hash>.js`, `lib.<hash>.js`, `<chunk>.<hash>.js` (code-split)
- Source is **minified/bundled** — not human-readable; the value is the DOM contract +
  tokens above, not the JS itself.

## What to borrow vs. leave
- **Borrow:** `data-testid`/`data-card-id` on every interactive node (excellent for our
  Playwright e2e); deep-link `<a href>` per card; the 0.16-alpha "highlight" trick for
  selection states; deadline color-state mapping (grey/yellow/red/green).
- **Leave:** the MUI look, Roboto, pure-grey surfaces, the multi-color `--pm-color-*` chip
  palette, 14px base. These are exactly micro-kaiten's anti-references.
