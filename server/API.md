# micro-kaiten API

A small HTTP API over the workspace, served by the Deno + SQLite backend
(`server/main.ts`). Every write goes through the **same reducer the browser
uses** (`src/core/state.ts`), so the app and the API can never disagree about
what a change means.

- **Base URL:** `http://localhost:8787` (override the port with `MK_PORT`).
  In dev, Vite proxies `/api/*` to it, so `http://localhost:5173/api/...` works too.
- **Auth (optional).** Off by default (single-user / localhost). Set `MK_AUTH_SECRET`
  to require a login — then every `/api/*` route except `/api/health` and `/api/session`
  needs the browser session cookie **or** an `Authorization: Bearer <MK_API_TOKEN>`
  header. See [Authentication](#authentication) below.
- **Content type:** JSON in, JSON out. Send `Content-Type: application/json` on writes.
- **Errors:** `400` bad input · `401` unauthenticated · `404` unknown id · `405` wrong
  method · `409` conflict · `413` payload too large · `415` wrong content-type · `429`
  too many login attempts · `500` unexpected. Body is `{ "error": "..." }`.

## Authentication

Unset `MK_AUTH_SECRET` ⇒ **auth is off**: `GET /api/session` returns `{ "enabled": false }`
and every route is open (keep it on localhost only). A **production** server (when
`MK_STATIC` is set) refuses to start without `MK_AUTH_SECRET` so it is never silently open.

| Var | Meaning |
| --- | --- |
| `MK_AUTH_SECRET` | The login passphrase (≥ 16 chars). Enables auth. Stored only as a PBKDF2 hash in memory; never logged. |
| `MK_API_TOKEN` | Optional shared bearer token for automation, independent of the login. |
| `MK_PROXY_DEPTH` | Trusted reverse-proxy hops for per-IP login rate-limiting (default `1`). |
| `MK_INSECURE_COOKIES` | Set `1` only for plain-http local testing (drops the `Secure` cookie flag). |

**Browser (cookie session)**

| Method | Path | Body | Result |
| --- | --- | --- | --- |
| GET | `/api/session` | — | `{ "enabled": false }` or `{ "enabled": true, "authed": bool }` |
| POST | `/api/session` | `{ "passphrase": "..." }` | `{ "ok": true }` + sets `mk_session` (HttpOnly, Secure, SameSite=Strict, ~365-day sliding cookie). `401` wrong passphrase · `429 { error, retryAfter }` (seconds; also a `Retry-After` header) when locked out after 5 failures |
| DELETE | `/api/session` | — | `{ "ok": true }`, revokes the session + clears the cookie |

**Automation (bearer token)** — send `Authorization: Bearer <MK_API_TOKEN>` on any request:

```bash
curl -H "Authorization: Bearer $MK_API_TOKEN" http://localhost:8787/api/cards
```

The login session is sliding (each use extends it), so an active browser never has to
re-login; a `401` mid-session means the session expired — POST `/api/session` again.

## Data model

```
Board  { id, title, x, y, columns: Column[] }
Column { id, name, wip: number|null, cards: Card[] }
Card   { id, title, notes, due: "YYYY-MM-DD"|null, labels: string[], blockedBy: id[], parent: id|null, comments: Comment[], enteredColumnAt: number(ms) }
Comment{ id, author, at, text }
```

`due` urgency and the "time in column" metric are **derived** from `due` /
`enteredColumnAt` — you never set them directly. A column is **"done"** when it's
the last column on its board or its name matches `done|complete|shipped|archive|closed`.

REST resources are returned enriched with their location, e.g. a **card view**:

```json
{ "id": "...", "title": "...", "notes": "", "due": null, "comments": [],
  "enteredColumnAt": 1750000000000,
  "boardId": "...", "boardTitle": "Inbox", "columnId": "...", "columnName": "Capture", "index": 0 }
```

---

## Cards

| Method | Path | Body | Result |
|---|---|---|---|
| `GET` | `/api/cards` | — | array of card views |
| `POST` | `/api/cards` | `{ columnId, title, notes?, due?, labels?, index? }` | `201` card view |
| `GET` | `/api/cards/:id` | — | card view · `404` |
| `PATCH` | `/api/cards/:id` | `{ title?, notes?, due?, labels? }` | card view |
| `DELETE` | `/api/cards/:id` | — | `{ ok: true }` |
| `POST` | `/api/cards/:id/move` | `{ toColumnId, index? }` | card view |
| `POST` | `/api/cards/:id/advance` | — | card view · `409` if last column |
| `POST` | `/api/cards/:id/comments` | `{ text, author? }` | `201` comment |
| `POST` | `/api/cards/:id/block` | `{ by }` | card view — mark blocked by another card |
| `POST` | `/api/cards/:id/unblock` | `{ by }` | card view |
| `POST` | `/api/cards/:id/parent` | `{ parent: id\|null }` | card view — set/clear parent (subtask) |

The server mints `id`, `enteredColumnAt`, and comment `id`/`at`. `due` accepts an
ISO date string or `null`. `index` defaults to `0` (top of the column). `labels`
is a string array (normalized, deduped, max 6).

`GET /api/cards` filters via query params: `boardId`, `columnId`, `due`
(`overdue|today|soon|none`), `label` (exact, case-insensitive), and `q` (matches
the title or any label).

```bash
# create a card, then advance it to the next column
curl -s localhost:8787/api/cards -H 'content-type: application/json' \
  -d '{"columnId":"col-abc","title":"Pay the broker","due":"2026-07-01"}'
curl -s -X POST localhost:8787/api/cards/<id>/advance
```

---

## Boards

A **board summary** (list) is `{ id, title, x, y, columns: <count>, cards: <count>, archived }`.
`GET /api/boards/:id` returns the **full** board (columns + cards).

| Method | Path | Body | Result |
|---|---|---|---|
| `GET` | `/api/boards` | — | array of board summaries |
| `POST` | `/api/boards` | `{ title?, x?, y?, columns? }` | `201` full board |
| `GET` | `/api/boards/:id` | — | full board · `404` |
| `PATCH` | `/api/boards/:id` | `{ title?, x?, y? }` | full board |
| `DELETE` | `/api/boards/:id` | — | `{ ok: true }` · `400` on the Archive board |
| `POST` | `/api/boards/:id/columns` | `{ name?, index?, wip? }` | `201` column view |

`columns` on create is an array of column **names** (defaults to
`["To do","Doing","Done"]`). `x`/`y` are canvas coordinates; new boards are
nudged clear of overlaps by the app on next render.

```bash
curl -s localhost:8787/api/boards -H 'content-type: application/json' \
  -d '{"title":"Reading","columns":["Queue","Reading","Done"]}'
```

---

## Columns

A **column view** is `{ id, name, wip, cards: Card[], boardId, boardTitle, index }`.

| Method | Path | Body | Result |
|---|---|---|---|
| `GET` | `/api/columns/:id` | — | column view · `404` |
| `PATCH` | `/api/columns/:id` | `{ name?, wip? }` | column view |
| `DELETE` | `/api/columns/:id` | — | `{ ok: true }` |
| `POST` | `/api/columns/:id/move` | `{ toBoardId?, index }` | column view |

`wip` is a soft limit; send `null` to clear it. `move` reorders the column within
its board, or moves it to `toBoardId` at `index` when that differs from the current board.

---

## Auto-archive

Cards that have sat in a **done** column for **≥ 10 days** are moved to a special,
normally-hidden **Archive** board (id `archive`). The sweep runs **server-side** on
boot and **hourly**, so archiving happens headlessly with no browser open (the
browser app also runs the same sweep when it's open). The threshold and logic live
in `src/core/done.ts` / `src/core/archive.ts` and are shared by client and server.

The Archive is a normal board for read purposes (`GET /api/boards/archive`,
`GET /api/columns/<its column>`), but `DELETE /api/boards/archive` is refused (`400`)
since it's managed automatically.

---

## Link unfurl

| Method | Path | Result |
|---|---|---|
| `GET` | `/api/unfurl?url=<http(s) url>` | `{ url, title }` — the page's `og:title` or `<title>` |

Fetched **server-side** (browsers can't read cross-origin `<title>` due to CORS),
with a 6s timeout, `text/html` only, body capped at 512 KB. **YouTube** links
(`youtube.com` / `youtu.be`) use YouTube's oEmbed endpoint for the video title
(the watch page serves a JS/consent shell to bots). `title` is `null` on any
failure (timeout, non-HTML, bot-gated page) — callers fall back to the URL.
The app uses this when you create a card from a pasted link: the card appears
immediately with the URL as its title and in its notes, then the title swaps to
the fetched page title. Existing cards whose title is a bare URL are backfilled
the same way on load.

## Low-level endpoints

The REST routes above are sugar over these, which the app itself uses for sync:

| Method | Path | Body | Result |
|---|---|---|---|
| `GET` | `/api/health` | — | `{ ok: true, boards: <count> }` |
| `GET` | `/api/workspace` | — | the whole `WorldState` |
| `PUT` | `/api/workspace` | `WorldState` | replaces everything |
| `POST` | `/api/ops` | `{ ops: Op[] }` | applies ops through the reducer |

`Op` is the discriminated union in `src/core/ops.ts` (`addCard`, `moveCard`,
`updateCard`, `deleteCard`, `addComment`, `addBoard`, `addColumn`, …). Unlike the
REST routes, ops require you to supply ids and timestamps yourself, and `PUT
/api/workspace` is last-write-wins over the entire state — prefer the REST routes
for external use.
