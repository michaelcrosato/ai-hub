/**
 * couch/nav.js — where an arrow press lands, worked out from where things sit
 * on the screen, the way a TV remote moves: the nearest thing that way.
 *
 * Rects are plain { left, top, right, bottom }, so node --test can lay out a
 * screen without having one.
 */

const across = (dir) => dir === 'left' || dir === 'right';
const middle = (rect) => ({ x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 });

/** Edge to edge, how far `to` lies past `from` that way. Overlaps count as 0. */
function gap(from, to, dir) {
  const d =
    dir === 'right' ? to.left - from.right
    : dir === 'left' ? from.left - to.right
    : dir === 'down' ? to.top - from.bottom
    : from.top - to.bottom;
  return Math.max(0, d);
}

/** True when `to` lies that way from `from`: its middle and its near edge both past from's. */
function ahead(from, to, dir) {
  const a = middle(from);
  const b = middle(to);
  if (dir === 'right') return b.x > a.x && to.left > from.left;
  if (dir === 'left') return b.x < a.x && to.right < from.right;
  if (dir === 'down') return b.y > a.y && to.top > from.top;
  return b.y < a.y && to.bottom < from.bottom;
}

/** How much the two share across the direction of travel: the beam. */
function shared(from, to, dir) {
  return across(dir)
    ? Math.min(from.bottom, to.bottom) - Math.max(from.top, to.top)
    : Math.min(from.right, to.right) - Math.max(from.left, to.left);
}

/** How far off straight ahead `to` is, middle to middle. */
function drift(from, to, dir) {
  const a = middle(from);
  const b = middle(to);
  return across(dir) ? Math.abs(a.y - b.y) : Math.abs(a.x - b.x);
}

/**
 * The candidate ({ rect, … }) an arrow press lands on, or null at an edge.
 *
 * Sideways, only what shares the beam counts (`strict`), so the end of a rail
 * is an end, not a jump to whatever lies diagonally past it. Up and down take
 * the nearest row that way, wherever it sits across, and then whatever in it
 * is closest to straight ahead: that is how a press from a tile reaches the
 * buttons above it. Where two grids sit side by side, a layer asks for strict
 * both ways, so down never slides sideways into the other grid.
 */
export function nearest(from, candidates, dir, { strict = across(dir) } = {}) {
  const pool = candidates.filter((c) => ahead(from, c.rect, dir) && (!strict || shared(from, c.rect, dir) > 0));
  if (!pool.length) return null;
  // The nearest row (or column): anything within half an item of the closest edge.
  const size = (rect) => (across(dir) ? rect.right - rect.left : rect.bottom - rect.top);
  const closest = Math.min(...pool.map((c) => gap(from, c.rect, dir)));
  const reach = closest + Math.min(...pool.map((c) => size(c.rect))) / 2;
  return pool
    .filter((c) => gap(from, c.rect, dir) <= reach)
    .reduce((best, c) => (drift(from, c.rect, dir) < drift(from, best.rect, dir) ? c : best));
}
