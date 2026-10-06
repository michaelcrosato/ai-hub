/**
 * couch/find.js — search, the way a TV does it: an on-screen keyboard on the
 * left for the arrows and the pad, the query large across the top, and the
 * results on the right, narrowing as you type. A physical keyboard types
 * straight in wherever focus is; on a phone the grid steps aside for the
 * phone's own keyboard.
 *
 * It searches the same haystack as the wall, through selectGames.
 */

import { h, icon, ICONS } from '../dom.js';
import { selectGames } from '../filter.js';
import { nearest } from './nav.js';
import { tile, glide, prompt, reducedMotion } from './ui.js';
import { typed } from './input.js';
import { viewSwitch } from '../ui/views.js';

const KEYS = 'abcdefghijklmnopqrstuvwxyz1234567890'.split('');
/** Results are drawn a batch at a time as focus or the scroll nears the end. */
const BATCH = 24;
/** Words to start from when nothing is typed yet. */
const STARTERS = ['RPG', 'Shooter', 'Racing', 'Flight', 'Platformer', 'Puzzle', 'Space', 'Co-op'];
const DELETE = 'M21 6H9l-6 6 6 6h12zM18 9l-6 6M12 9l6 6';
/** Phones bring their own keyboard; the grid would only be in its way. */
const ownKeyboard = () => matchMedia('(pointer: coarse), (max-width: 40rem)').matches;

export function createFind(root, { games, stats, showAll, via, onQuery, onPlay, onInfo, onFave, onSurprise, onBack }) {
  let query = '';
  let list = [];
  let drawn = 0;
  let held = null;

  const field = h('input', {
    class: 'find__field',
    type: 'search',
    placeholder: 'Search',
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
    enterkeyhint: 'search',
    'aria-label': 'Search games',
    dataset: { nav: 'find' },
  });
  const echo = h('div', { class: 'find__echo', 'aria-hidden': 'true' });
  const count = h('p', { class: 'find__count', role: 'status' });
  const grid = h('div', { class: 'find__grid' });
  const results = h('div', { class: 'find__results' }, grid);
  const more = h('div', { class: 'find__more', 'aria-hidden': 'true' });
  // The switch takes what is typed to the other views as their search.
  const views = viewSwitch('couch', { className: 'find__views' });
  for (const link of views.querySelectorAll('a')) link.dataset.nav = 'find';

  const key = (label, props, ...kids) => h('button', { type: 'button', class: 'osk__key', dataset: { nav: 'find', ...props.dataset }, ...props.attrs }, ...kids, label);
  const osk = h(
    'div',
    { class: 'osk', role: 'group', 'aria-label': 'On-screen keyboard' },
    KEYS.map((char) => key(char.toUpperCase(), { dataset: { char }, attrs: { 'aria-label': char.toUpperCase() } })),
    key('Space', { dataset: { char: ' ', wide: '' } }, h('span', { class: 'osk__pad', 'aria-hidden': 'true' }, 'Y')),
    key('', { dataset: { edit: 'delete', wide: '' }, attrs: { 'aria-label': 'Delete' } }, icon(DELETE), h('span', { class: 'osk__pad', 'aria-hidden': 'true' }, 'X')),
    key('Clear', { dataset: { edit: 'clear', wide: '' } })
  );

  root.append(
    h(
      'div',
      { class: 'find__sheet' },
      h(
        'header',
        { class: 'find__top' },
        h(
          'button',
          { type: 'button', class: 'page__back', 'aria-label': 'Back', dataset: { nav: 'find' }, onclick: onBack },
          icon(ICONS.back),
          h('span', {}, 'Back'),
          prompt('back')
        ),
        h('label', { class: 'find__query' }, icon(ICONS.search, { class: 'find__glass' }), h('span', { class: 'find__line' }, field, echo), count),
        views
      ),
      h('div', { class: 'find__body' }, osk, results)
    )
  );

  /* --- typing ---------------------------------------------------------- */

  function set(text, { push = true } = {}) {
    const next = text.replace(/\s+/g, ' ').replace(/^ /, '').slice(0, 60);
    if (next === query && field.value === next) return;
    query = next;
    if (field.value !== next) field.value = next;
    draw();
    if (push) onQuery(query);
  }

  osk.addEventListener('click', (event) => {
    const el = event.target.closest('.osk__key');
    if (!el) return;
    if (el.dataset.char != null) set(query + el.dataset.char);
    else if (el.dataset.edit === 'delete') set(query.slice(0, -1));
    else set('');
  });

  field.addEventListener('input', () => set(field.value));

  /* --- results --------------------------------------------------------- */

  function drawMore() {
    const next = list.slice(drawn, drawn + BATCH).map((game) => tile(game, { href: `#/play/${game.slug}` }));
    if (more.isConnected) more.before(...next);
    else grid.append(...next, more);
    drawn += next.length;
    more.hidden = drawn >= list.length;
  }

  new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && drawn < list.length && drawMore(), {
    root: results,
    rootMargin: '0px 0px 40% 0px',
  }).observe(more);

  function empty(...kids) {
    grid.replaceChildren(h('div', { class: 'find__empty' }, kids));
  }

  function draw() {
    echo.replaceChildren(query ? h('span', {}, query) : h('span', { class: 'find__hint' }, 'Search'), h('span', { class: 'find__caret' }));
    const had = grid.contains(document.activeElement) ? document.activeElement : null;
    list = query.trim() ? selectGames(games, { query, shelf: null, showAll, sort: 'name', favesOnly: false, facets: {} }, stats) : [];
    drawn = 0;
    grid.replaceChildren();
    results.scrollTop = 0;
    if (!query.trim()) {
      count.textContent = '';
      empty(
        h('p', { class: 'find__big' }, `Type to search ${games.length} games`),
        h('p', { class: 'find__small' }, 'Names, blurbs, genres, the classics they riff on, the models that made them.'),
        h('div', { class: 'find__starters' }, STARTERS.map((word) => h('button', { type: 'button', class: 'chip chip--button', dataset: { nav: 'find' }, onclick: () => set(word) }, word)))
      );
    } else if (!list.length) {
      count.textContent = 'No games';
      empty(
        h('p', { class: 'find__big' }, `Nothing matches “${query.trim()}”`),
        h('p', { class: 'find__small' }, 'Try fewer letters, or let the couch pick for you.'),
        h('button', { type: 'button', class: 'btn btn--play', dataset: { nav: 'find' }, onclick: onSurprise }, icon(ICONS.dice), h('span', { class: 'btn__label' }, 'Surprise me'), prompt('surprise'))
      );
    } else {
      count.textContent = list.length === 1 ? '1 game' : `${list.length} games`;
      drawMore();
    }
    // Typing while something in the results had focus keeps focus there:
    // on the same game if it is still found, else on the first thing showing.
    if (had) {
      const same = had.dataset.slug && grid.querySelector(`[data-slug="${CSS.escape(had.dataset.slug)}"]`);
      (same || grid.querySelector('.tile, [data-nav]') || osk.firstElementChild).focus({ preventScroll: true });
    }
  }

  /* --- moving ---------------------------------------------------------- */

  root.addEventListener('focusin', (event) => {
    const el = event.target;
    if (!el.classList.contains('tile') || (via() !== 'keys' && via() !== 'pad')) return;
    const view = results.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    const room = box.height * 0.3;
    if (box.top < view.top + room) glide(results, { top: results.scrollTop + box.top - view.top - room });
    else if (box.bottom > view.bottom - room) glide(results, { top: results.scrollTop + box.bottom - view.bottom + room });
  });

  root.addEventListener('click', (event) => {
    const el = event.target.closest?.('.tile');
    if (!el) return;
    event.preventDefault();
    onPlay(el.dataset.slug, el);
  });

  const targets = (from) => [...root.querySelectorAll('[data-nav="find"], .find__grid .tile')].filter((el) => el !== from && el.getClientRects().length);

  function move(dir) {
    const el = document.activeElement;
    if (!root.contains(el)) return focusStart();
    // In the field, left and right belong to the caret.
    if (el === field && (dir === 'left' || dir === 'right')) return;
    const rect = el.getBoundingClientRect();
    const pool = targets(el).map((target) => ({ el: target, rect: target.getBoundingClientRect() }));
    // The keyboard and the results sit side by side: down never slides across
    // into the other one, and across finds the nearest row on the other side.
    const across = dir === 'left' || dir === 'right';
    const found = nearest(rect, pool, dir, { strict: true }) || (across && nearest(rect, pool, dir, { strict: false }));
    found?.el.focus({ preventScroll: true });
  }

  function focusStart() {
    const first = ownKeyboard() ? field : query && grid.querySelector('.tile') ? grid.querySelector('.tile') : osk.firstElementChild;
    first.focus({ preventScroll: true });
  }

  const inGrid = () => document.activeElement?.classList.contains('tile') && grid.contains(document.activeElement);
  const onKeys = () => osk.contains(document.activeElement);

  return {
    isOpen: () => !root.hidden,
    query: () => query,

    /** Open with this text (the address's ?q=), or bring the text in line with it. */
    open(text = '') {
      if (root.hidden) {
        root.hidden = false;
        if (!reducedMotion()) {
          root.classList.remove('is-entering');
          void root.offsetWidth;
          root.classList.add('is-entering');
        }
        query = null;
      }
      if (text !== query) set(text, { push: false });
    },

    close() {
      root.hidden = true;
      held = null;
    },

    leave() {
      if (root.contains(document.activeElement)) held = document.activeElement;
    },

    enter() {
      const el = held?.isConnected ? held : null;
      held = null;
      if (el) el.focus({ preventScroll: true });
      else focusStart();
    },

    /**
     * Keys that type rather than act. True when the key was taken here: a
     * letter typed into the query, Backspace deleting one, anything typed in
     * the field itself (save Esc and up, which still act), and Enter or down
     * in the field, which go to the results.
     */
    key(event) {
      if (event.target === field) {
        if (event.key === 'Enter' || event.key === 'ArrowDown') {
          event.preventDefault();
          (grid.querySelector('.tile') || osk.firstElementChild).focus({ preventScroll: true });
          return true;
        }
        // Everything else typed into the field is the field's own; Backspace
        // with nothing left to delete goes back, as it does everywhere else.
        if (event.key === 'Backspace') return Boolean(field.value);
        return event.key !== 'Escape' && event.key !== 'ArrowUp';
      }
      if (event.key === 'Backspace' && query) {
        event.preventDefault();
        set(query.slice(0, -1));
        return true;
      }
      if (typed(event)) {
        // A space typed before any letter is dropped, never a press of the focused key.
        event.preventDefault();
        set(query + event.key);
        return true;
      }
      return false;
    },

    act(action) {
      const el = document.activeElement;
      switch (action) {
        case 'up':
        case 'down':
        case 'left':
        case 'right':
          move(action);
          return true;
        case 'press':
          if (root.contains(el)) el.click();
          else focusStart();
          return true;
        // On the keyboard the pad's X deletes and Y types a space, as consoles do.
        case 'fave':
          if (onKeys()) set(query.slice(0, -1));
          else if (inGrid()) onFave(el.dataset.slug);
          return true;
        case 'info':
          if (onKeys()) set(`${query} `);
          else if (inGrid()) onInfo(el.dataset.slug);
          return true;
        case 'surprise':
          onSurprise();
          return true;
        case 'back':
          onBack();
          return true;
        default:
          return true;
      }
    },
  };
}
