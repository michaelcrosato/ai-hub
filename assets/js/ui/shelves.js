/**
 * ui/shelves.js — the big buttons under the sign.
 *
 * Games has a row to itself: it is the wall people come for. Under it, five
 * equal buttons: the Source of what is showing (All, Original, Inspired), the
 * other shelf (Tech demos & tools), and Surprise me. Each is drawn as an arcade
 * push-button: dark plastic when up, lit and sunk when chosen, so the state of
 * the wall reads at a glance from across the room.
 */

import { h } from '../dom.js';
import { SHELVES } from '../filter.js';

const line = { fill: 'none', stroke: 'currentColor', 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
const dot = (cx, cy, r = 2.3) => h('circle', { cx, cy, r, fill: 'currentColor' });

const ART = {
  // A gamepad, cable and all.
  games: () => [
    h('path', { ...line, d: 'M32 22v-5c0-3 2-5 5-5h6' }),
    h('path', {
      ...line,
      d: 'M20 22h24c7 0 12.5 5.4 12.5 12.2 0 1-.1 2-.4 3l-2.3 8.6a6.2 6.2 0 0 1-10.7 2.4L38.6 43H25.4l-4.5 5.2a6.2 6.2 0 0 1-10.7-2.4l-2.3-8.6c-.3-1-.4-2-.4-3C7.5 27.4 13 22 20 22z',
    }),
    h('path', { ...line, d: 'M20 29v10M15 34h10' }),
    dot(42, 31),
    dot(47.5, 36.5),
  ],
  // A wireframe cube with a spark: something built to show what an engine can do.
  tools: () => [
    h('path', { ...line, d: 'M31 10l18 10v22L31 52 13 42V20z' }),
    h('path', { ...line, d: 'M13 20l18 10 18-10M31 30v22' }),
    h('path', { ...line, 'stroke-dasharray': '2.5 3.5', d: 'M13 42l18-10 18 10M31 10v22' }),
    h('path', { ...line, d: 'M53 5v8M49 9h8' }),
  ],
  // Four tiles: the whole wall.
  all: () => [
    h('rect', { ...line, x: 12, y: 12, width: 17, height: 17, rx: 3 }),
    h('rect', { ...line, x: 35, y: 12, width: 17, height: 17, rx: 3 }),
    h('rect', { ...line, x: 12, y: 35, width: 17, height: 17, rx: 3 }),
    h('rect', { ...line, x: 35, y: 35, width: 17, height: 17, rx: 3 }),
  ],
  // A spark: its own idea.
  original: () => [
    h('path', { ...line, d: 'M32 8l5.5 18.5L56 32l-18.5 5.5L32 56l-5.5-18.5L8 32l18.5-5.5z' }),
  ],
  // Two cards, one tracing the other: after a classic.
  inspired: () => [
    h('rect', { ...line, x: 10, y: 14, width: 30, height: 36, rx: 4, 'stroke-dasharray': '3 4' }),
    h('rect', { ...line, x: 24, y: 10, width: 30, height: 36, rx: 4 }),
    h('path', { ...line, d: 'M31 22h16M31 30h12' }),
  ],
  // A die, five showing.
  surprise: () => [
    h('rect', { ...line, x: 10, y: 10, width: 44, height: 44, rx: 8 }),
    dot(21, 21, 3.2),
    dot(43, 21, 3.2),
    dot(32, 32, 3.2),
    dot(21, 43, 3.2),
    dot(43, 43, 3.2),
  ],
};

const art = (key) =>
  h('span', { class: 'shelf__art', 'aria-hidden': 'true' }, h('svg', { viewBox: '0 0 64 64', focusable: 'false' }, ART[key]()));

const button = (key, label, sub, onclick, extra = {}) => {
  const note = h('span', { class: 'shelf__count' }, sub);
  const el = h(
    'button',
    { class: `shelf shelf--${key}`, type: 'button', 'aria-pressed': 'false', onclick, ...extra },
    art(key),
    h('span', { class: 'shelf__text' }, h('span', { class: 'shelf__label' }, label), note)
  );
  return { el, note };
};

const SOURCES = [
  { key: 'all', origin: '', label: 'All', sub: 'Original and inspired' },
  { key: 'original', origin: 'original', label: 'Original', sub: 'Its own idea' },
  { key: 'inspired', origin: 'inspired', label: 'Inspired', sub: 'After a classic' },
];

export function createShelves(root, { onSelect, onSource, onSurprise }) {
  const [games, tools] = SHELVES.map((shelf) => ({
    shelf,
    ...button(shelf.key, shelf.label, '', () => onSelect(shelf.key)),
  }));
  const sources = SOURCES.map((source) => ({
    source,
    ...button(source.key, source.label, source.sub, () => onSource(source.origin)),
  }));
  const surprise = button('surprise', 'Surprise me', 'A random game', () => onSurprise(), {
    title: 'Play a random game from the ones showing',
    'aria-pressed': null,
  });

  root.append(
    h('div', { class: 'shelves__row shelves__row--lead' }, games.el),
    h('div', { class: 'shelves__row' }, ...sources.map((s) => s.el), tools.el, surprise.el)
  );

  return {
    /**
     * @param counts   Map of shelf key → how many are on that shelf right now
     * @param origins  Original and Inspired with how many the other filters leave
     */
    render(current, counts, { origin = '', origins = [], canSurprise = true } = {}) {
      for (const { shelf, el, note } of [games, tools]) {
        el.setAttribute('aria-pressed', String(shelf.key === current));
        note.textContent = String(counts.get(shelf.key) || 0);
        // An empty shelf is not worth a big button; the current one always shows.
        el.hidden = !counts.get(shelf.key) && shelf.key !== current;
      }
      // All, Original and Inspired are ways onto the Games shelf: from Tech
      // demos & tools, pressing one goes back to games, so none is lit there.
      const onGames = current === SHELVES[0].key;
      for (const { source, el } of sources) {
        const on = onGames && source.origin === origin;
        const option = origins.find((o) => o.value === source.origin);
        el.setAttribute('aria-pressed', String(on));
        el.disabled = onGames && !on && option ? option.count === 0 : false;
      }
      surprise.el.disabled = !canSurprise;
    },
  };
}
