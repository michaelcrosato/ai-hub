/**
 * couch/page.js — More info: a game's own page, sliding up over the home
 * screen like a store page on a console. Its stills large on the left; what
 * it is, how to play it and the facts on the right; and two rows underneath
 * to browse sideways, where a tile opens that game's page in place of this.
 *
 * Arrows land on whatever is nearest that way (see nav.js), except in the
 * gallery, where left and right step through the stills first.
 */

import { h, icon, ICONS } from '../dom.js';
import { cabinetPalette, paletteVars } from '../color.js';
import { store } from '../store.js';
import { bytes, date } from '../format.js';
import { attemptsAt, similarGames } from '../similar.js';
import { parseControls, proseParts } from './howto.js';
import { eyebrow, pageFacts } from './facts.js';
import { nearest } from './nav.js';
import { tile, keyRun, keycap, prompt, glide, reducedMotion } from './ui.js';
import { viewSwitch } from '../ui/views.js';

/** Each still holds this long before the gallery moves on by itself. */
const ADVANCE_MS = 5000;
const OPEN = 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5';
const LEAVE_MS = 360;

/** The stills, large, stepping on by themselves, with a thumbnail per still to show where you are. */
function gallery(game) {
  const frames = game.frames?.length ? game.frames : [game.cover];
  const shots = frames.map((url) => h('img', { class: 'gallery__shot', src: url, alt: '', decoding: 'async' }));
  const count = h('span', { class: 'gallery__count', 'aria-hidden': 'true' });
  const stage = h(
    'div',
    { class: 'gallery__stage', tabindex: '0', role: 'img', dataset: { nav: 'page' } },
    shots,
    count,
    frames.length > 1 && h('span', { class: 'gallery__hint', 'aria-hidden': 'true' }, keycap({ key: '←' }), keycap({ key: '→' }))
  );
  const thumbs = frames.map((url, i) =>
    h(
      'button',
      { type: 'button', class: 'thumb', tabindex: '-1', 'aria-label': `Still ${i + 1} of ${frames.length}`, onclick: () => go(i) },
      h('img', { src: url, alt: '', loading: 'lazy', decoding: 'async' }),
      h('span', { class: 'thumb__bar' })
    )
  );
  let at = 0;
  let timer = 0;

  function go(i) {
    at = (i + frames.length) % frames.length;
    shots.forEach((shot, k) => shot.classList.toggle('is-on', k === at));
    thumbs.forEach((thumb, k) => {
      thumb.classList.remove('is-on');
      thumb.setAttribute('aria-current', String(k === at));
    });
    void thumbs[at].offsetWidth; // restart its progress bar
    thumbs[at].classList.add('is-on');
    count.textContent = `${at + 1} / ${frames.length}`;
    stage.setAttribute('aria-label', `${game.name}, still ${at + 1} of ${frames.length}`);
    clearTimeout(timer);
    if (frames.length > 1 && !reducedMotion()) timer = setTimeout(() => go(at + 1), ADVANCE_MS);
  }
  go(0);

  return {
    el: h('figure', { class: 'gallery' }, stage, frames.length > 1 && h('div', { class: 'gallery__thumbs' }, thumbs)),
    stage,
    /** Left and right step through the stills; past either end, focus moves on. */
    step(dir) {
      const next = at + (dir === 'right' ? 1 : -1);
      if (next < 0 || next >= frames.length) return false;
      go(next);
      return true;
    },
    /** A press on the stills shows the next one, round to the first. */
    next: () => go(at + 1),
    stop: () => clearTimeout(timer),
  };
}

/** How to play: each control as keycaps and what they do. */
function howTo(game) {
  const rows = parseControls(game.controls);
  if (!rows.length) return null;
  const prose = (text) => proseParts(text).map((part) => (part.key ? keycap(part) : part.text));
  return h(
    'section',
    { class: 'howto' },
    h('h3', { class: 'page__label' }, 'How to play'),
    h(
      'dl',
      { class: 'howto__rows' },
      rows.map((row) => h('div', { class: 'howto__row' }, h('dt', {}, keyRun(row.keys)), h('dd', {}, prose(row.action))))
    )
  );
}

function facts(game) {
  return h(
    'dl',
    { class: 'facts' },
    pageFacts(game).map((fact) =>
      h('div', { class: 'facts__item' }, h('dt', {}, fact.label), h('dd', {}, fact.value, fact.note && h('span', { class: 'facts__note' }, fact.note)))
    )
  );
}

/** A row of tiles that browse sideways: each opens its own game's page. */
function rail(title, list) {
  if (!list.length) return null;
  const tiles = list.map((game) => tile(game, { href: `#/g/${game.slug}` }));
  tiles[0].tabIndex = 0;
  return h('section', { class: 'page__rail' }, h('h3', { class: 'page__label' }, title), h('div', { class: 'rail__track' }, tiles));
}

export function createPage(root, { games, via, onPlay, onFave, onBrowse, onBack }) {
  let game = null;
  let shown = null;
  let held = null;
  let leaving = 0;
  const fave = { button: null, star: null };
  root.setAttribute('aria-labelledby', 'page-name');
  // One switch for every page drawn: it takes this game to the other views.
  const views = viewSwitch('couch', { className: 'page__views' });
  for (const link of views.querySelectorAll('a')) link.dataset.nav = 'page';

  root.addEventListener('click', (event) => {
    const el = event.target.closest?.('.tile');
    if (!el) return;
    event.preventDefault();
    onBrowse(el.dataset.slug);
  });

  root.addEventListener('focusin', (event) => {
    const el = event.target;
    const track = el.classList.contains('tile') ? el.parentElement : null;
    // The tile Tab reaches in a row, and where an arrow coming into the row lands.
    if (track) for (const t of track.children) t.tabIndex = t === el ? 0 : -1;
    if (via() !== 'keys' && via() !== 'pad') return;
    if (track) glide(track, { left: el.offsetLeft - parseFloat(getComputedStyle(track).paddingLeft) });
    reveal(el.closest('.page__rail') || el);
  });

  /** Glide the page so a part of it is in full view, with room around it. */
  function reveal(el) {
    const view = root.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    const room = view.height * 0.08;
    if (box.top < view.top + room) glide(root, { top: root.scrollTop + box.top - view.top - room });
    else if (box.bottom > view.bottom - room) glide(root, { top: root.scrollTop + box.bottom - view.bottom + room });
  }

  function syncFave() {
    if (!game || !fave.button) return;
    const on = store.isFave(game.slug);
    fave.button.setAttribute('aria-pressed', String(on));
    fave.star.setAttribute('fill', on ? 'currentColor' : 'none');
  }
  store.subscribe(syncFave);

  function builds(next) {
    if (next.builds.length < 2) return null;
    return h(
      'section',
      { class: 'builds' },
      h('h3', { class: 'page__label' }, 'Builds'),
      h(
        'div',
        { class: 'builds__list' },
        next.builds.map((build, i) =>
          h(
            'button',
            { type: 'button', class: 'build', dataset: { nav: 'page' }, onclick: () => onPlay(next, build) },
            h('span', { class: 'build__name' }, build.version ? `v${build.version}` : build.label || 'Build'),
            h('span', { class: 'build__meta' }, i === 0 ? 'Current' : date(build.added)),
            h('span', { class: 'build__meta' }, bytes(build.bytes))
          )
        )
      )
    );
  }

  function render(next) {
    shown?.stop();
    game = next;
    const current = next.builds[0];
    fave.star = icon(ICONS.star);
    fave.button = h(
      'button',
      { type: 'button', class: 'btn btn--fave', 'aria-label': 'Favourite', dataset: { nav: 'page' }, 'aria-pressed': 'false', onclick: () => onFave(next) },
      fave.star,
      h('span', { class: 'btn__label' }, 'Favourite'),
      prompt('fave')
    );
    shown = gallery(next);
    const attempts = attemptsAt(next, games);
    root.replaceChildren(
      h(
        'div',
        { class: 'page__sheet', style: paletteVars(cabinetPalette(next)) },
        h('div', { class: 'page__glow', 'aria-hidden': 'true' }, h('img', { src: next.cover, alt: '', decoding: 'async' })),
        h(
          'header',
          { class: 'page__top' },
          h(
            'button',
            { type: 'button', class: 'page__back', 'aria-label': 'Back', dataset: { nav: 'page' }, onclick: onBack },
            icon(ICONS.back),
            h('span', {}, 'Back'),
            prompt('back')
          ),
          views
        ),
        h(
          'div',
          { class: 'page__main' },
          shown.el,
          h(
            'div',
            { class: 'page__info' },
            h('p', { class: 'page__eyebrow' }, eyebrow(next).join(' · ')),
            h('h2', { class: 'page__name', id: 'page-name' }, next.name),
            next.tagline && h('p', { class: 'page__tagline' }, next.tagline),
            next.description && h('p', { class: 'page__blurb' }, next.description),
            h(
              'div',
              { class: 'page__actions' },
              h(
                'button',
                { type: 'button', class: 'btn btn--play', dataset: { nav: 'page', action: 'play' }, onclick: () => onPlay(next, current) },
                icon(ICONS.play, { fill: 'currentColor', stroke: 'none' }),
                h('span', { class: 'btn__label' }, 'Play'),
                prompt('play')
              ),
              fave.button,
              current &&
                h(
                  'a',
                  { class: 'btn btn--open', href: current.path, target: '_blank', rel: 'noopener', dataset: { nav: 'page' } },
                  icon(OPEN),
                  h('span', { class: 'btn__label' }, 'Open on its own page')
                )
            ),
            howTo(next),
            facts(next),
            next.tags.length > 0 && h('ul', { class: 'tags', 'aria-label': 'Tags' }, next.tags.map((tag) => h('li', { class: 'tag' }, tag))),
            builds(next)
          )
        ),
        rail(`Other attempts at ${next.lineage.title}`, attempts),
        rail('More like this', similarGames(next, games, { limit: 16 }))
      )
    );
    root.scrollTop = 0;
    syncFave();
  }

  const playButton = () => root.querySelector('[data-action="play"]');

  /** Every element an arrow can land on, other than the one focused. */
  const targets = (from) =>
    [...root.querySelectorAll('[data-nav="page"], .tile')].filter((el) => el !== from && el.getClientRects().length);

  function move(dir) {
    const el = document.activeElement;
    if (!root.contains(el) || el === root) return playButton()?.focus({ preventScroll: true });
    if (el === shown.stage && (dir === 'left' || dir === 'right') && shown.step(dir)) return;
    const found = nearest(
      el.getBoundingClientRect(),
      targets(el).map((target) => ({ el: target, rect: target.getBoundingClientRect() })),
      dir
    )?.el;
    // Into a row from outside it, land where the row was left (its first
    // tile, to begin with), not on whichever tile happens to sit below.
    const entry = found?.classList.contains('tile') && found.parentElement !== el.parentElement;
    (entry ? found.parentElement.querySelector('[tabindex="0"]') || found : found)?.focus({ preventScroll: true });
  }

  function ends(which) {
    const el = document.activeElement;
    if (!el?.classList.contains('tile')) return;
    const tiles = [...el.parentElement.children];
    (which === 'first' ? tiles[0] : tiles.at(-1)).focus({ preventScroll: true });
  }

  return {
    isOpen: () => !root.hidden && !root.classList.contains('is-leaving'),
    game: () => game,

    /** Open on a game, or turn the open page to another one, focus on its Play. */
    open(next) {
      clearTimeout(leaving);
      const already = !root.hidden && !root.classList.contains('is-leaving');
      root.classList.remove('is-leaving');
      render(next);
      root.hidden = false;
      if (already) playButton()?.focus({ preventScroll: true });
      else if (!reducedMotion()) {
        root.classList.remove('is-entering');
        void root.offsetWidth;
        root.classList.add('is-entering');
      }
    },

    close() {
      if (root.hidden || root.classList.contains('is-leaving')) return;
      shown?.stop();
      held = null;
      const done = () => {
        root.hidden = true;
        root.classList.remove('is-leaving');
        root.replaceChildren();
        game = null;
      };
      if (reducedMotion()) return done();
      root.classList.add('is-leaving');
      leaving = setTimeout(done, LEAVE_MS);
    },

    leave() {
      if (root.contains(document.activeElement)) held = document.activeElement;
    },

    /** Focus where it was before a game was played from here, or on Play. */
    enter() {
      const el = held?.isConnected ? held : playButton();
      held = null;
      el?.focus({ preventScroll: true });
    },

    act(action) {
      switch (action) {
        case 'up':
        case 'down':
        case 'left':
        case 'right':
          move(action);
          return true;
        case 'prevRail':
        case 'nextRail':
          move(action === 'prevRail' ? 'up' : 'down');
          return true;
        case 'first':
        case 'last':
          ends(action);
          return true;
        case 'press': {
          const el = document.activeElement;
          if (el === shown.stage) shown.next();
          else if (root.contains(el)) el.click();
          else if (game) onPlay(game, game.builds[0]);
          return true;
        }
        case 'info': {
          const el = document.activeElement;
          if (el?.classList.contains('tile')) onBrowse(el.dataset.slug);
          return true;
        }
        case 'fave':
          if (game) onFave(game);
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
