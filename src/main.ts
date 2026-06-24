import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/jetbrains-mono";
import "./styles.css";

import { clear, el, isUrl, svg } from "./dom";
import { icons } from "./icons";
import { ctx } from "./context";
import { Store } from "./store";
import { seedWorld } from "./seed";
import { renderWorld, updateChrome, updateFocusRing, skipNextFlip, requestColumnRename, requestBoardRename, setBoardFocus } from "./render";
import { glowPulse, reduceMotion } from "./flip";
import { initCanvas, applyTransform, screenToWorld, centerOn, nudgeZoom, setZoom } from "./canvas";
import { initDnd } from "./dnd";
import { initCapture, startCapture } from "./capture";
import { initKeyboard } from "./keyboard";
import { initToast, toast } from "./toast";
import { openDetail, closeDetail } from "./detail";
import { closePalette, createBoard, exitArchive, newCard, openPalette, targetBoardForNewCard } from "./palette";
import { isMenuOpen, openMenu } from "./menu";
import { openFilterPopover } from "./filter";
import { playSound, toggleMute } from "./sound";
import { enqueueOp, loadWorkspace, onAuthRequired, onSynced, onSyncStatus, pushSnapshot, setSyncEnabled, unfurl } from "./sync/client";
import { fetchAuthStatus, logout } from "./sync/auth";
import { showLogin } from "./login";
import type { ID } from "./types";

function buildShell() {
  // Was the New ▾ menu open when its trigger was pressed? Lets a second click on the
  // trigger toggle the menu closed (the menu's own pointerdown-to-close fires first).
  let newMenuWasOpen = false;
  const world = el("div", { class: "canvas-world" });
  const viewport = el(
    "div",
    { class: "canvas-viewport", attrs: { role: "application", "aria-label": "Board canvas" } },
    world,
    el(
      "div",
      { class: "empty-canvas" },
      el(
        "div",
        { class: "inner" },
        el("h2", { text: "A quiet canvas." }),
        el("p", { html: "Press <kbd>⇧N</kbd> to add a board, then <kbd>N</kbd> to capture your first card." }),
      ),
    ),
    el("div", { class: "cscroll v" }, el("i", {})),
    el("div", { class: "cscroll h" }, el("i", {})),
    el("div", { class: "minimap", attrs: { "aria-hidden": "true" } }, el("div", { class: "minimap-inner" })),
    buildHud(),
  );

  const topbar = el(
    "header",
    { class: "topbar" },
    el(
      "div",
      { class: "brand" },
      el("span", { class: "brand-name", html: "micro·<em>kaiten</em>" }),
      el("span", { class: "brand-sub", text: "~/canvas/personal" }),
      el("span", { class: "sync-dot", attrs: { title: "Offline — in-memory only", "aria-hidden": "true" } }),
      el("button", {
        class: "archive-back",
        attrs: { title: "Back to canvas (Esc)", "aria-label": "Back to canvas" },
        style: { display: "none" } as Record<string, string>,
        on: { click: () => exitArchive() },
      }, svg(icons.chevronLeft), "Canvas"),
    ),
    el("div", { class: "topbar-spacer" }),
    el(
      "button",
      {
        class: "btn new-menu-btn",
        data: { testid: "new-menu-button" },
        attrs: { "aria-haspopup": "menu", "aria-expanded": "false", "aria-label": "New", title: "New — card (N) · board (⇧N)" },
        on: {
          pointerdown: () => { newMenuWasOpen = isMenuOpen(); },
          click: (e: MouseEvent) => {
            if (newMenuWasOpen) { newMenuWasOpen = false; return; } // 2nd click toggles it closed
            const target = targetBoardForNewCard();
            openMenu(e.currentTarget as HTMLElement, [
              { label: "New card", icon: "plus", kbd: "N", hint: target ? `→ ${target.title}` : undefined, run: () => newCard() },
              { label: "New board", icon: "board", kbd: "⇧N", run: () => createBoard() },
            ]);
          },
        },
      },
      "New",
      svg(icons.chevronDown, "caret"),
    ),
    el(
      "button",
      { class: "btn cmd-trigger", data: { testid: "command-trigger" }, on: { click: () => openPalette() } },
      svg(icons.search),
      "Search or run a command",
      el("span", { class: "gap" }),
      el("kbd", { text: "⌘K" }),
    ),
    el(
      "button",
      {
        class: "btn icon-btn filter-btn",
        data: { testid: "filter-button" },
        attrs: { "aria-label": "Filter by label", title: "Filter by label" },
        on: { click: (e: MouseEvent) => openFilterPopover(e.currentTarget as HTMLElement) },
      },
      svg(icons.filter),
      el("span", { class: "filter-count" }),
    ),
    el(
      "div",
      { class: "zoom" },
      el("button", { data: { testid: "zoom-out" }, attrs: { "aria-label": "Zoom out" }, text: "−", on: { click: () => nudgeZoom(-1) } }),
      el("span", { class: "lvl", data: { testid: "zoom-level" }, text: "100%", on: { click: () => setZoom(1) } }),
      el("button", { data: { testid: "zoom-in" }, attrs: { "aria-label": "Zoom in" }, text: "+", on: { click: () => nudgeZoom(1) } }),
    ),
    el("button", { class: "btn icon-btn mute-btn", data: { testid: "mute-button" }, attrs: { "aria-label": "Toggle sounds", title: "Sounds (M)" }, on: { click: toggleMuteUI } }, svg(icons.sound)),
    el("div", { class: "avatar", data: { testid: "account-button" }, attrs: { "aria-hidden": "true" } }),
  );

  const filterBar = el("div", {
    class: "filter-bar",
    data: { testid: "filter-bar" },
    attrs: { role: "status", "aria-live": "polite" },
    style: { display: "none" } as Record<string, string>,
  });

  const app = document.getElementById("app")!;
  app.append(topbar, filterBar, viewport);
  return { viewport, world };
}

function buildHud() {
  const key = (k: string, label: string, strong = false) =>
    el("span", {}, el("kbd", { text: k }), strong ? el("b", { text: label }) : label);
  return el(
    "div",
    { class: "hud", attrs: { "aria-hidden": "true" } },
    key("N", "card", true),
    key("⇧N", "board", true),
    el("span", { class: "sep" }),
    key("↵", "edit", true),
    key("A", "advance", true),
    el("span", {}, el("kbd", { text: "J" }), el("kbd", { text: "K" }), "move"),
    el("span", {}, el("kbd", { text: "⌫" }), "delete"),
    el("span", {}, el("kbd", { text: "Space" }), "pan"),
    key("/", "search"),
  );
}

function toggleMuteUI() {
  const muted = toggleMute();
  const btn = document.querySelector(".mute-btn");
  if (btn) { clear(btn); btn.appendChild(svg(muted ? icons.mute : icons.sound)); }
  btn?.classList.toggle("is-muted", muted);
  toast(muted ? "Sounds <b>off</b>" : "Sounds <b>on</b>");
}

function deleteCard(id: ID) {
  const info = ctx.store.deleteCard(id);
  if (!info) return;
  playSound("delete");
  toast(`Deleted <b>${escapeHtml(info.card.title)}</b>`, {
    undo: () => ctx.store.insertCard(info.columnId, info.card, info.index),
  });
}

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

function setFocus(id: ID | null, opts?: { reveal?: boolean }) {
  ctx.store.view.focusedCardId = id;
  // Focusing a card makes its board the active one (so New card targets it).
  if (id) {
    const loc = ctx.store.findCard(id);
    if (loc) setBoardFocus(loc.board.id);
  }
  updateFocusRing();
  if (id && opts?.reveal) {
    const elc = ctx.world.querySelector<HTMLElement>(`[data-card-id="${id}"]`);
    if (elc) {
      const board = elc.closest<HTMLElement>(".board");
      const r = elc.getBoundingClientRect();
      const vp = ctx.viewport.getBoundingClientRect();
      // only re-center if the card is out of view
      if (r.top < vp.top + 70 || r.bottom > vp.bottom - 70 || r.left < vp.left + 20 || r.right > vp.right - 20) {
        const b = board ? ctx.store.findBoard(board.dataset.boardId!) : null;
        if (b && board) centerOn(b.x, b.y, board.offsetWidth, board.offsetHeight);
      }
    }
  }
}

function advance(id: ID, instant = false) {
  if (!ctx.store.nextColumnOf(id)) return;
  if (instant || reduceMotion()) skipNextFlip();
  const res = ctx.store.advanceCard(id);
  if (!res) return;
  ctx.store.view.focusedCardId = id;
  updateFocusRing();
  playSound("advance");
  if (!instant) {
    const elc = ctx.world.querySelector<HTMLElement>(`[data-card-id="${id}"]`);
    if (elc) glowPulse(elc);
  }
}

async function boot() {
  const store = new Store(seedWorld());
  const { viewport, world } = buildShell();

  // wire shared context
  ctx.store = store;
  ctx.viewport = viewport;
  ctx.world = world;
  ctx.minimap = viewport.querySelector(".minimap")!;
  ctx.scrollV = viewport.querySelector(".cscroll.v")!;
  ctx.scrollH = viewport.querySelector(".cscroll.h")!;
  ctx.rerender = renderWorld;
  ctx.updateChrome = updateChrome;
  ctx.updateFocusRing = updateFocusRing;
  ctx.screenToWorld = screenToWorld;
  ctx.centerOn = centerOn;
  ctx.setFocus = setFocus;
  ctx.setBoardFocus = setBoardFocus;
  ctx.advance = advance;
  ctx.deleteCard = deleteCard;
  ctx.requestColumnRename = requestColumnRename;
  ctx.requestBoardRename = requestBoardRename;
  ctx.startCapture = startCapture;
  ctx.openDetail = openDetail;
  ctx.closeDetail = closeDetail;
  ctx.openPalette = openPalette;
  ctx.closePalette = closePalette;
  ctx.toast = toast;

  store.subscribeData(renderWorld);
  store.setOpSink(enqueueOp);
  onSyncStatus(updateSyncDot);
  onSynced(pulseSyncDot);
  onAuthRequired(handleAuthRequired);

  initToast();

  // Auth gate: probe /api/session first. Network error → null → proceed (offline
  // mode). {enabled:false} → no gate (dev / no secret). enabled+unauthed → login.
  const auth = await fetchAuthStatus();
  if (auth?.enabled && !auth.authed) await showLogin();
  if (auth?.enabled) wireAccountMenu(); // avatar → "Log out" (only when auth is on)

  // Hydrate from the server BEFORE first paint — no seed→server flash, no capture
  // race. loadWorkspace() resolves fast on localhost and fails fast when down.
  const remote = await loadWorkspace();
  let seedServer = false;
  if (remote === null) {
    setSyncEnabled(false); // no server → pure in-memory
  } else {
    setSyncEnabled(true);
    if (remote.boards.length) store.world = remote;
    else seedServer = true;
  }

  // The hidden Archive board + auto-archive of cards long-done (≥10 days).
  store.ensureArchiveBoard();
  store.archiveDoneCards();

  renderWorld();
  initCanvas();

  // anchor: pin the first real (non-archive) board near the top-left corner
  const b0 = store.world.boards.find((b) => b.id !== "archive");
  if (b0) { store.view.panX = 24 - b0.x; store.view.panY = 20 - b0.y; }
  applyTransform();

  initDnd();
  initCapture();
  initKeyboard();

  // Backfill: cards whose title is still a bare URL get unfurled (title from the
  // page, URL kept in notes). Needs the server's /api/unfurl, so only when online.
  if (remote !== null) convertUrlCards(store);

  if (seedServer) void pushSnapshot(store.world); // first run: seed the empty server

  // Long sessions: re-run the sweep hourly so cards archive without a reload.
  setInterval(() => store.archiveDoneCards(), 60 * 60 * 1000);
}

/** One-time-ish backfill: any card whose title is a bare URL gets unfurled. */
function convertUrlCards(store: Store) {
  for (const b of store.world.boards) {
    if (b.id === "archive") continue;
    for (const col of b.columns) {
      for (const c of col.cards) {
        if (!isUrl(c.title)) continue;
        const url = c.title.trim();
        unfurl(url).then((title) => {
          const loc = store.findCard(c.id);
          if (!title || !loc || !isUrl(loc.card.title)) return; // skip if edited meanwhile
          const notes = loc.card.notes.includes(url)
            ? loc.card.notes
            : url + (loc.card.notes ? "\n\n" + loc.card.notes : "");
          store.updateCard(c.id, { title, notes });
        });
      }
    }
  }
}

function updateSyncDot(online: boolean) {
  const dot = document.querySelector(".sync-dot");
  if (!dot) return;
  dot.classList.toggle("online", online);
  dot.classList.remove("reauth"); // online/offline is a different state than expired-session
  dot.setAttribute("title", online ? "Synced to local server" : "Offline — in-memory only");
}

// Turn the (otherwise decorative) top-bar avatar into an Account button whose menu
// offers Log out. Wired only when auth is enabled, so dev/no-auth is unchanged.
function wireAccountMenu() {
  const avatar = document.querySelector<HTMLElement>(".avatar");
  if (!avatar) return;
  avatar.classList.add("interactive");
  avatar.removeAttribute("aria-hidden");
  avatar.setAttribute("role", "button");
  avatar.setAttribute("tabindex", "0");
  avatar.setAttribute("aria-haspopup", "menu");
  avatar.setAttribute("aria-label", "Account");
  avatar.setAttribute("title", "Account");
  const open = () => openMenu(avatar, [{ label: "Log out", icon: "chevronLeft", run: () => void doLogout() }]);
  avatar.addEventListener("click", open);
  avatar.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
  });
}

async function doLogout() {
  await logout(); // DELETE /api/session — revokes the session + clears the cookie
  setSyncEnabled(false); // stop syncing under the now-dead session
  await showLogin(); // gate until the user logs back in
  setSyncEnabled(true); // resume sync on the new session
}

// Re-auth in flight guard, so a burst of queued ops yields one login prompt.
let reauthing = false;
async function handleAuthRequired() {
  const dot = document.querySelector(".sync-dot");
  if (dot) {
    dot.classList.remove("online");
    dot.classList.add("reauth");
    dot.setAttribute("title", "Session expired — log in to keep syncing");
  }
  if (reauthing) return;
  reauthing = true;
  await showLogin();
  reauthing = false;
  setSyncEnabled(true); // flush the ops held during the expired-session window
}

/** Quiet confirmation that a batch persisted. */
function pulseSyncDot() {
  const dot = document.querySelector<HTMLElement>(".sync-dot");
  if (!dot || !dot.classList.contains("online")) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  dot.animate(
    [{ transform: "scale(1)" }, { transform: "scale(1.9)" }, { transform: "scale(1)" }],
    { duration: 420, easing: "cubic-bezier(0.22,1,0.36,1)" },
  );
}

void boot();
