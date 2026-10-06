/**
 * couch/bar.js — the strip along the top, small and quiet like a console's:
 * where you are on the left; the other views, search, surprise, a controller
 * when one is connected, and the time on the right.
 */

import { h, icon, ICONS } from '../dom.js';
import { viewSwitch } from '../ui/views.js';

const PAD = 'M7.5 8h9a4.5 4.5 0 0 1 4.3 5.8l-1 3.4a2.3 2.3 0 0 1-3.9.9L14.3 16H9.7l-1.6 2.1a2.3 2.3 0 0 1-3.9-.9l-1-3.4A4.5 4.5 0 0 1 7.5 8zM8 11v3M6.5 12.5h3M15.5 12h.01M17.5 13.5h.01';

const TIME = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });

export function createBar(root, { onSearch, onSurprise }) {
  const round = (label, glyph, onclick) =>
    h('button', { type: 'button', class: 'bar__round', 'aria-label': label, title: label, dataset: { nav: 'bar' }, onclick }, icon(glyph));

  const clock = h('time', { class: 'bar__clock' });
  const pad = h('span', { class: 'bar__pad' }, icon(PAD), h('span', {}, 'Controller'));
  const views = viewSwitch('couch', { className: 'bar__views' });
  for (const link of views.querySelectorAll('a')) link.dataset.nav = 'bar';

  root.append(
    h('h1', { class: 'bar__mark' }, h('span', { class: 'bar__hub' }, 'AI Hub'), h('span', { class: 'bar__room' }, 'Couch')),
    h(
      'div',
      { class: 'bar__side' },
      views,
      round('Search', ICONS.search, onSearch),
      round('Surprise me: a random game', ICONS.dice, onSurprise),
      pad,
      clock
    )
  );

  function tick() {
    const now = new Date();
    clock.textContent = TIME.format(now);
    clock.dateTime = now.toISOString();
    setTimeout(tick, 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 50);
  }
  tick();

  return {
    /** Shown only while a controller is connected. */
    setPad: (on) => pad.classList.toggle('is-on', on),
    items: () => [...root.querySelectorAll('[data-nav="bar"]')],
  };
}
