/**
 * session/chooser.js — the host picks the games the session plays first.
 *
 * A dialog over the lobby with every game the players present can play
 * (seated, and runnable on every seat's browser), searchable and by the way it
 * plays. A tap puts a game at the end of "Up next", or takes it off again;
 * Done closes it. It lives outside the lobby, which redraws itself on every
 * change, so the list and the search survive the lobby's redraws.
 */

import { h, clear, append, icon, ICONS } from '../dom.js';
import { cabinetPalette, paletteVars } from '../color.js';
import { tokenize } from '../filter.js';
import { WAYS, togetherOf, togetherLine } from '../friends/together.js';

/** The session's three ways to play: couch co-op is no session's. */
const MODES = WAYS.filter((way) => way.key !== 'couch');

/**
 * @param games()       the games the host can pick
 * @param fitsNow(game)  whether it seats the players here now; one that
 *                       needs more waits in the list until they sit down
 * @param picked()      the queue, in order
 * @param onToggle(slug, on)
 * @param most          how many the queue holds
 */
export function createChooser(root, { games, fitsNow = () => true, picked, onToggle, most }) {
  let q = '';
  let way = '';
  let returnTo = null;

  const search = h('input', {
    type: 'search',
    id: 'chooser-search',
    placeholder: 'Search the games',
    autocomplete: 'off',
    enterkeyhint: 'search',
    oninput: () => {
      q = search.value;
      draw();
    },
  });
  const ways = h('div', { class: 'chooser__ways', role: 'radiogroup', 'aria-label': 'How it plays' });
  const count = h('p', { class: 'chooser__count', role: 'status' });
  const list = h('ul', { class: 'chooser__list' });
  const done = h('button', { type: 'button', class: 'primary chooser__done', onclick: () => close() }, 'Done');
  const panel = h(
    'div',
    { class: 'chooser__panel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'chooser-title' },
    h('header', { class: 'chooser__head' }, h('h2', { id: 'chooser-title' }, 'Pick the games'), done),
    h('p', { class: 'hint chooser__hint' }, 'They play first, in the order you pick them. Then the hub deals the rest at random.'),
    h('label', { class: 'chooser__search' }, h('span', { class: 'visually-hidden' }, 'Search the games'), icon(ICONS.search, { width: 16, height: 16 }), search),
    ways,
    count,
    list
  );
  root.append(h('button', { type: 'button', class: 'chooser__scrim', tabindex: '-1', 'aria-label': 'Close', onclick: () => close() }), panel);

  function drawWays(all) {
    const option = (value, label) =>
      h(
        'button',
        {
          type: 'button',
          role: 'radio',
          class: 'chooser__way',
          'aria-checked': String(way === value),
          onclick: () => {
            way = value;
            draw();
          },
        },
        label,
        h('span', { class: 'chooser__way-count' }, String(value ? all.filter((g) => togetherOf(g)?.way.key === value).length : all.length))
      );
    clear(ways);
    append(ways, [option('', 'All'), MODES.map((m) => option(m.key, m.label))]);
  }

  function draw() {
    const all = games();
    const queue = picked();
    const tokens = tokenize(q);
    const shown = all
      .filter((game) => (!way || togetherOf(game)?.way.key === way) && tokens.every((t) => game.search?.includes(t)))
      .sort((a, b) => a.name.localeCompare(b.name));
    const full = queue.length >= most;
    drawWays(all);
    count.textContent = `${shown.length} game${shown.length === 1 ? '' : 's'} · ${queue.length} picked${full ? ' (the most there can be)' : ''}`;
    clear(list);
    append(list, [
      shown.map((game) => {
        const at = queue.indexOf(game.slug);
        const on = at !== -1;
        return h(
          'li',
          {},
          h(
            'button',
            {
              type: 'button',
              class: `chooser__game${on ? ' is-on' : ''}`,
              'aria-pressed': String(on),
              disabled: !on && full ? true : null,
              style: paletteVars(cabinetPalette(game)),
              dataset: { slug: game.slug },
              onclick: () => onToggle(game.slug, !on),
            },
            game.cover ? h('img', { class: 'chooser__shot', src: game.cover, alt: '', loading: 'lazy', decoding: 'async', onerror: (e) => e.currentTarget.remove() }) : h('span', { class: 'chooser__shot' }),
            h(
              'span',
              { class: 'chooser__text' },
              h('span', { class: 'chooser__name' }, game.name),
              h('span', { class: 'chooser__meta' }, fitsNow(game) ? togetherLine(game) : `${togetherLine(game)} · waits for more players`)
            ),
            h('span', { class: 'chooser__mark', 'aria-hidden': 'true' }, on ? String(at + 1) : '+')
          )
        );
      }),
    ]);
    if (!shown.length) list.append(h('li', { class: 'hint chooser__empty' }, 'No game here fits.'));
  }

  function open() {
    returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    root.hidden = false;
    document.body.classList.add('has-chooser');
    draw();
    search.focus();
  }

  function close() {
    if (root.hidden) return;
    root.hidden = true;
    document.body.classList.remove('has-chooser');
    const back = returnTo?.isConnected ? returnTo : document.getElementById('choose') || document.getElementById('start');
    back?.focus();
    returnTo = null;
  }

  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'Tab') {
      const controls = [...panel.querySelectorAll('button:not(:disabled), input')];
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  });

  return {
    open,
    close,
    isOpen: () => !root.hidden,
    /** Redraw while open: the queue or the players changed. Focus stays on the game it was on. */
    refresh() {
      if (root.hidden) return;
      const slug = document.activeElement?.closest?.('.chooser__game')?.dataset.slug;
      draw();
      if (slug) list.querySelector(`.chooser__game[data-slug="${CSS.escape(slug)}"]`)?.focus();
    },
  };
}
