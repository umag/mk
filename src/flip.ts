// FLIP motion under a scaled ancestor. We measure positions in *world* (unscaled)
// coordinates so a translate delta is correct at any zoom level.

export const reduceMotion = (): boolean =>
  globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/** Unscaled position of an element relative to the world layer (via the offset chain). */
export function worldPos(elm: HTMLElement, world: HTMLElement): { x: number; y: number } {
  let x = 0;
  let y = 0;
  let e: HTMLElement | null = elm;
  while (e && e !== world) {
    x += e.offsetLeft;
    y += e.offsetTop;
    e = e.offsetParent as HTMLElement | null;
  }
  return { x, y };
}

export type RectMap = Map<string, { x: number; y: number }>;

export function captureCardRects(world: HTMLElement): RectMap {
  const m: RectMap = new Map();
  world.querySelectorAll<HTMLElement>("[data-card-id]").forEach((e) => {
    m.set(e.dataset.cardId!, worldPos(e, world));
  });
  return m;
}

/** Play the slide for cards that moved, and a gentle entrance for new ones. */
export function flipCards(world: HTMLElement, prev: RectMap): void {
  if (reduceMotion()) return;
  world.querySelectorAll<HTMLElement>("[data-card-id]").forEach((e) => {
    const id = e.dataset.cardId!;
    const before = prev.get(id);
    const after = worldPos(e, world);
    if (!before) {
      e.animate(
        [
          { opacity: 0, transform: "translateY(-6px) scale(0.97)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: 200, easing: "cubic-bezier(0.22,1,0.36,1)" },
      );
      return;
    }
    const dx = before.x - after.x;
    const dy = before.y - after.y;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    e.animate(
      [
        { transform: `translate(${dx}px, ${dy}px)` },
        { transform: "translate(0, 0)" },
      ],
      { duration: 260, easing: "cubic-bezier(0.2,1,0.3,1)" }, // weighted ease-out
    );
  });
}

export function captureBoardRects(world: HTMLElement): RectMap {
  const m: RectMap = new Map();
  world.querySelectorAll<HTMLElement>("[data-board-id]").forEach((e) => {
    m.set(e.dataset.boardId!, worldPos(e, world));
  });
  return m;
}

/** Glide a board from its old position to its new one (drag-snap / grow-relax). */
export function flipBoards(world: HTMLElement, prev: RectMap): void {
  if (reduceMotion()) return;
  world.querySelectorAll<HTMLElement>("[data-board-id]").forEach((e) => {
    const before = prev.get(e.dataset.boardId!);
    if (!before) return; // new boards don't animate in
    const after = worldPos(e, world);
    const dx = before.x - after.x;
    const dy = before.y - after.y;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    e.animate(
      [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }],
      { duration: 300, easing: "cubic-bezier(0.2,1,0.3,1)" },
    );
  });
}

/** The settle glow that pulses on a card after it lands. */
export function glowPulse(card: HTMLElement): void {
  if (reduceMotion()) return;
  const ring = document.createElement("div");
  ring.className = "glow-pulse";
  card.appendChild(ring);
  const anim = ring.animate(
    [
      { opacity: 0.85, transform: "scale(1)" },
      { opacity: 0, transform: "scale(1.04)" },
    ],
    { duration: 460, easing: "cubic-bezier(0.22,1,0.36,1)" },
  );
  anim.finished.then(() => ring.remove()).catch(() => ring.remove());
}
