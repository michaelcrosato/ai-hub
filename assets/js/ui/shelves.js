/**
 * ui/shelves.js — the big buttons under the sign.
 *
 * Games, and Tech demos & tools. Games is the wall people come for, so it is
 * the default and the other is a press away. Each is drawn as an arcade
 * push-button: dark plastic when up, lit and sunk when chosen, so the current
 * shelf reads at a glance from across the room. Surprise me sits beside them
 * as a third button the same size: it is the other way into a game.
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

export function createShelves(root, { onSelect, onSurprise }) {
  const buttons = new Map();

  for (const shelf of SHELVES) {
    const count = h('span', { class: 'shelf__count' });
    const button = h(
      'button',
      {
        class: 'shelf',
        type: 'button',
        dataset: { shelf: shelf.key },
        'aria-pressed': 'false',
        onclick: () => onSelect(shelf.key),
      },
      art(shelf.key),
      h('span', { class: 'shelf__text' }, h('span', { class: 'shelf__label' }, shelf.label), count)
    );
    buttons.set(shelf.key, { button, count });
    root.append(button);
  }

  const surprise = h(
    'button',
    {
      class: 'shelf shelf--surprise',
      type: 'button',
      title: 'Play a random game from the ones showing',
      onclick: () => onSurprise(),
    },
    art('surprise'),
    h(
      'span',
      { class: 'shelf__text' },
      h('span', { class: 'shelf__label' }, 'Surprise me'),
      h('span', { class: 'shelf__count' }, 'A random game')
    )
  );
  root.append(surprise);

  return {
    /** @param counts Map of shelf key → how many are on that shelf right now */
    render(current, counts, { canSurprise = true } = {}) {
      surprise.disabled = !canSurprise;
      for (const [key, { button, count }] of buttons) {
        const n = counts.get(key) || 0;
        button.setAttribute('aria-pressed', String(key === current));
        count.textContent = String(n);
        // An empty shelf is not worth a big button; the current one always shows.
        button.hidden = n === 0 && key !== current;
      }
    },
  };
}
