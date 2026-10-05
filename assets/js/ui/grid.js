/**
 * ui/grid.js — the wall, rendered in chunks.
 *
 * At a hundred-plus cabinets every tile carries an inline SVG, so building the
 * whole list on every keystroke would stutter. Cabinets go in a batch at a
 * time, pulled by an IntersectionObserver on a sentinel at the end, and the
 * ones off screen are skipped by `content-visibility` in CSS.
 */

import { h, clear } from '../dom.js';
import { cabinet, stackCabinet } from './cabinet.js';

const CHUNK = 36;

/**
 * @param stackHref  where pressing a stack goes: the wall narrowed to it
 */
export function createGrid(root, { stackHref = () => '#/' } = {}) {
  let games = [];
  let caption = () => null;
  let shown = 0;
  let firstPaint = true;

  const sentinel = h('div', { class: 'wall__more', 'aria-hidden': 'true' });

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) grow();
    },
    { rootMargin: '600px 0px' }
  );

  function grow() {
    if (shown >= games.length) {
      observer.unobserve(sentinel);
      sentinel.remove();
      return;
    }
    const next = games.slice(shown, shown + CHUNK);
    const batch = document.createDocumentFragment();
    next.forEach((item, i) => {
      const tile = item.stack
        ? stackCabinet(item, shown + i, stackHref(item))
        : cabinet(item, shown + i, caption(item));
      if (firstPaint) tile.classList.add('is-fresh');
      batch.append(tile);
    });
    root.insertBefore(batch, sentinel);
    shown += next.length;
    if (shown >= games.length) {
      observer.unobserve(sentinel);
      sentinel.remove();
      return;
    }
    // Re-arm. An observer only reports *changes*, so if a jump to the bottom
    // (End, a scrollbar drag, a hard flick) leaves the sentinel in view after
    // this batch, it would never fire again and the wall would stop filling.
    // Observing afresh always delivers the current state on the next frame.
    observer.unobserve(sentinel);
    observer.observe(sentinel);
  }

  return {
    /**
     * `list` holds games and stacks of games; `lead` sits above them, full
     * width; `label(game)` can name something other than the genre on a tile.
     */
    render(list, { lead = null, label = () => null } = {}) {
      games = list;
      caption = label;
      shown = 0;
      clear(root);
      if (lead) root.append(lead);
      root.append(sentinel);
      observer.observe(sentinel);
      grow();
      // The strike-on animation is a one-time arrival, not a transition effect.
      if (firstPaint) {
        firstPaint = false;
        setTimeout(() => {
          for (const tile of root.querySelectorAll('.cab.is-fresh')) tile.classList.remove('is-fresh');
        }, 2200);
      }
    },

    /** Replace the whole wall with a message: loading, empty, or broken. */
    message(...content) {
      observer.unobserve(sentinel);
      clear(root);
      root.append(h('p', { class: 'wall__status' }, ...content));
    },

    // A game folded into a stack comes home to the stack.
    tile: (slug) =>
      root.querySelector(`.cab[data-slug="${CSS.escape(slug)}"]`) ||
      root.querySelector(`.cab[data-members~="${CSS.escape(slug)}"]`),
  };
}
