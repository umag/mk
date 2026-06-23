// Pure geometry for card drag-and-drop. Keeping the per-frame decision a pure
// function of cached numbers (no DOM reads) is what keeps the drag responsive:
// the hot path never forces a layout reflow. All coordinates are client (screen) px.

/**
 * The y to test against neighbour midpoints when dropping a card: the dragged
 * card's vertical CENTRE — `cursorY - grabOffsetY` is the card's top, `+ height/2`
 * its middle — nudged `dir * bias` px toward the drag direction. Measuring the card
 * body (not the cursor tip) is why the slot flips as soon as the card passes a
 * neighbour, instead of after half a card of travel.
 */
export function cardDropY(
  cursorY: number,
  grabOffsetY: number,
  cardHeight: number,
  dir: number,
  bias: number,
): number {
  return cursorY - grabOffsetY + cardHeight / 2 + dir * bias;
}

/**
 * Insertion index for a card at compare-position `y` among neighbours whose
 * vertical midpoints are `mids` (ascending screen order). Returns the first slot
 * whose midpoint `y` has not yet passed — i.e. the count of midpoints at or above
 * `y`. A `y` exactly on a midpoint counts as past it (inserts after). Pure: `mids`
 * is captured once at drag start, so the hot path reads no layout.
 */
export function slotForY(mids: number[], y: number): number {
  for (let i = 0; i < mids.length; i++) {
    if (y < mids[i]!) return i;
  }
  return mids.length;
}
