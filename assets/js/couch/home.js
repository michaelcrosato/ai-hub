/**
 * couch/home.js — the home screen: one game at a time, huge, over rows of the
 * library moved through like channels.
 *
 * Focus is the browser's own: a real button or link always holds it, so Tab,
 * screen readers and the mouse all agree with the arrows. The arrows move it
 * the way a remote does: along a row, or to the row above or below, landing
 * on whatever sits closest to straight ahead. Up from the first row reaches
 * the hero's buttons, and up again the bar.
 *
 * Before anyone touches anything the hero shows today's spotlight and no
 * tile is focused. After a minute with no input, it starts showing other
 * games on its own, like a console left on; any input brings it back.
 */

import { h } from '../dom.js';
import { shelfOf, SHELVES } from '../filter.js';
import { buildRails, spotlightOf } from './rails.js';
import { nearest } from './nav.js';
import { createStage } from './stage.js';
import { createHero } from './hero.js';
import { createShelf } from './shelf.js';
import { reducedMotion } from './ui.js';

/** A tile rests this long before it plays its own stills. */
const PREVIEW_MS = 1200;
const PREVIEW_STILL_MS = 1600;
/** The hero follows the mouse once it settles, not every tile it crosses. */
const HOVER_MS = 140;
/** Hero updates closer together than this are a held arrow: no entrance for each. */
const RAPID_MS = 220;
const IDLE_MS = 60_000;
const ATTRACT_MS = 8000;
/** Rows of what is yours or new. Surprise, and a game reached by a link, land
 *  in the library's own rows instead: the genre, series or shelf it belongs to. */
const PERSONAL = new Set(['recent', 'faves', 'fresh']);
const GAMES = SHELVES[0].key;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const pick = (list) => list[Math.floor(Math.random() * list.length)];

export function createHome({ couch, stageEl, heroEl, railsEl, bar, games, stats, via, isTop, onPlay, onInfo, onFave }) {
  const bySlug = new Map(games.map((game) => [game.slug, game]));
  const stage = createStage(stageEl);
  const hero = createHero(heroEl, { onPlay: (game) => onPlay(game, heroEl), onInfo, onFave });
  const shelf = createShelf(railsEl, { href: (game) => `#/play/${game.slug}` });
  heroEl.append(
    h(
      'p',
      { class: 'hero__idle', 'aria-hidden': 'true' },
      h('span', { class: 'for-keys' }, 'Press any key to come back'),
      h('span', { class: 'for-pad' }, 'Press any button to come back'),
      h('span', { class: 'for-touch' }, 'Touch the screen to come back')
    )
  );

  /** The game in the hero, and whether it is still today's untouched pick. */
  let current = spotlightOf(games);
  let spotlight = Boolean(current);
  /** The last tile focused, by row and game, to come back to. */
  let last = null;
  let lastHero = null;
  let lastBar = null;
  /** What focus was on when an overlay or a game took over. */
  let held = null;
  /** How a tile focused on purpose is put in place: 'glide', 'snap' or 'stay'.
   *  Null means "as the input would": glide for keys and pads, stay for a pointer. */
  let placing = null;
  let heroTimer = 0;
  let shownAt = 0;
  let shuffling = false;

  /* --- what the hero shows ------------------------------------------------ */

  function present(game, delay = 0) {
    clearTimeout(heroTimer);
    const go = () => {
      const rapid = performance.now() - shownAt < RAPID_MS;
      current = game;
      hero.show(game, { spotlight, still: rapid });
      shownAt = performance.now();
      stage.show(game);
    };
    if (delay) heroTimer = setTimeout(go, delay);
    else go();
  }

  /* --- focus -------------------------------------------------------------- */

  const zoneOf = (el) =>
    el?.classList?.contains('tile') && railsEl.contains(el) ? 'rail' : el?.dataset?.nav === 'hero' || el?.dataset?.nav === 'bar' ? el.dataset.nav : null;

  const lastTile = () => (last ? shelf.find(last.slug, (row) => row.key === last.key) : null);

  /** Focus an element. A tile then glides into the band, snaps there, or stays put. */
  function focus(el, { place = 'glide' } = {}) {
    if (!el) return;
    placing = place;
    if (document.activeElement === el) tileIn(el);
    else el.focus({ preventScroll: true });
    placing = null;
  }

  function tileIn(el) {
    const row = shelf.rowOf(el);
    if (!row || zoneOf(el) !== 'rail') return;
    shelf.mark(row, el);
    last = { key: row.key, slug: el.dataset.slug };
    const mode = via();
    const place = placing ?? (mode === 'keys' || mode === 'pad' ? 'glide' : 'stay');
    if (place !== 'stay') {
      shelf.band(row, { instant: place === 'snap' });
      shelf.anchor(row, el, { instant: place === 'snap' });
    }
    spotlight = false;
    const game = bySlug.get(el.dataset.slug);
    present(game, mode === 'pointer' && !placing ? HOVER_MS : 0);
    preview.schedule(el, game);
  }

  couch.addEventListener('focusin', (event) => {
    const el = event.target;
    if (zoneOf(el) === 'rail') return tileIn(el);
    if (zoneOf(el) === 'hero') lastHero = el;
    if (zoneOf(el) === 'bar') lastBar = el;
  });

  couch.addEventListener('focusout', (event) => {
    if (zoneOf(event.target) === 'rail') preview.stop();
  });

  /* --- the mouse and the thumb -------------------------------------------- */

  // Hover focuses, but only a pointer that really moved: a row gliding under
  // a resting mouse must not steal focus from the arrows.
  railsEl.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse' || (!event.movementX && !event.movementY)) return;
    const el = event.target.closest?.('.tile');
    if (el && el !== document.activeElement) el.focus({ preventScroll: true });
  });

  // On touch the first tap picks a tile and the second plays it. Whether it
  // was already picked is read before the tap moves focus onto it.
  let tap = { touch: false, picked: false };
  railsEl.addEventListener(
    'pointerdown',
    (event) => {
      const el = event.target.closest?.('.tile');
      tap = { touch: event.pointerType !== 'mouse', picked: Boolean(el) && el === document.activeElement };
    },
    true
  );
  railsEl.addEventListener('click', (event) => {
    const el = event.target.closest?.('.tile');
    const first = tap.touch && !tap.picked;
    // Read once: a later Enter or pad press clicks with no tap behind it.
    tap = { touch: false, picked: false };
    // A tile is a link, so it can still be opened in a new tab; a plain
    // press plays it here, through the app's own way of moving.
    if (!el || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (first) focus(el, { place: 'stay' });
    else onPlay(bySlug.get(el.dataset.slug), el);
  });

  /* --- moving ------------------------------------------------------------- */

  const rectOf = (el) => el.getBoundingClientRect();

  /** To another row, landing on the tile nearest straight above or below. */
  function toRow(index, from, dir) {
    const rows = shelf.rows();
    const row = rows[Math.max(0, Math.min(rows.length - 1, index))];
    if (!row || row.el.contains(from)) return;
    const tiles = shelf.tilesOf(row);
    const found = nearest(rectOf(from), tiles.map((el) => ({ el, rect: rectOf(el) })), dir);
    focus(found?.el || tiles[0]);
  }

  function along(list, el, step) {
    const next = list[list.indexOf(el) + step];
    if (next) focus(next);
  }

  const heroEntry = () => lastHero || hero.button('play');
  const barEntry = () => lastBar || bar.items().find((el) => el.getAttribute('aria-label') === 'Search') || bar.items()[0];

  function move(dir) {
    const el = document.activeElement;
    const zone = zoneOf(el);
    const step = dir === 'right' || dir === 'down' ? 1 : -1;
    const rows = shelf.rows();

    if (!zone) {
      // Nothing focused: the spotlight, or focus lost to a click elsewhere.
      if (lastTile()) return focus(lastTile());
      if (dir === 'up') return focus(heroEntry());
      return focus(shelf.tilesOf(rows[0])[0]);
    }
    if (zone === 'bar') {
      if (dir === 'down') return focus(heroEntry());
      if (dir === 'left' || dir === 'right') along(bar.items(), el, step);
      return;
    }
    if (zone === 'hero') {
      if (dir === 'up') return focus(barEntry());
      if (dir === 'down') return toRow(0, el, 'down');
      return along(hero.buttons(), el, step);
    }
    const row = shelf.rowOf(el);
    if (dir === 'left' || dir === 'right') return along(shelf.tilesOf(row), el, step);
    const index = rows.indexOf(row);
    if (dir === 'up' && index === 0) return focus(heroEntry());
    toRow(index + step, el, dir);
  }

  /** Several rows at once (PageUp, PageDown), or one row without leaving the rows (LB, RB). */
  function jump(by) {
    const el = document.activeElement;
    const rows = shelf.rows();
    if (zoneOf(el) !== 'rail') {
      if (by > 0) focus(lastTile() || shelf.tilesOf(rows[0])[0]);
      return;
    }
    toRow(rows.indexOf(shelf.rowOf(el)) + by, el, by > 0 ? 'down' : 'up');
  }

  function ends(which) {
    const el = document.activeElement;
    const zone = zoneOf(el);
    const list = zone === 'rail' ? shelf.tilesOf(shelf.rowOf(el)) : zone === 'hero' ? hero.buttons() : zone === 'bar' ? bar.items() : null;
    if (list) focus(which === 'first' ? list[0] : list.at(-1));
  }

  /* --- surprise ----------------------------------------------------------- */

  /** A random game into focus, after a quick shuffle through the hero. */
  async function surprise() {
    if (shuffling) return;
    const seen = new Map();
    for (const row of shelf.rows()) for (const game of row.games) seen.set(game.slug, game);
    const pool = [...seen.values()].filter((game) => shelfOf(game) === GAMES && game !== current);
    if (!pool.length) return;
    const chosen = pick(pool);
    if (!reducedMotion()) {
      shuffling = true;
      heroEl.classList.add('is-shuffling');
      for (let i = 0; i < 7; i++) {
        hero.show(pick(pool), { quick: true });
        await wait(46 + i * 18);
      }
      heroEl.classList.remove('is-shuffling');
      shuffling = false;
    }
    shownAt = 0;
    focus(shelf.find(chosen.slug, (row) => !PERSONAL.has(row.key)));
  }

  /* --- a tile's own stills ------------------------------------------------ */

  const preview = (() => {
    let timer = 0;
    let stop = null;

    function play(el, game) {
      const order = [...game.frames.slice(1), game.frames[0]];
      const layers = [0, 1].map(() => h('img', { class: 'tile__still', alt: '', decoding: 'async' }));
      const bars = h('span', { class: 'tile__bars', 'aria-hidden': 'true' }, order.map(() => h('span', { class: 'tile__bar' })));
      el.append(...layers, bars);
      let step = 0;
      let next = 0;
      const show = () => {
        const at = step % order.length;
        [...bars.children].forEach((bar, i) => {
          bar.classList.toggle('is-done', i < at);
          bar.classList.toggle('is-running', i === at);
        });
        // The last still is the tile's own cover: fade the layers away to it.
        const [on, off] = step % 2 ? layers : [...layers].reverse();
        if (at === order.length - 1) layers.forEach((layer) => layer.classList.remove('is-on'));
        else {
          on.src = order[at];
          on.decode().then(() => {
            on.classList.add('is-on');
            off.classList.remove('is-on');
          }, () => {});
        }
        step += 1;
        next = setTimeout(show, PREVIEW_STILL_MS);
      };
      show();
      return () => {
        clearTimeout(next);
        for (const node of [...layers, bars]) node.remove();
      };
    }

    return {
      schedule(el, game) {
        this.stop();
        if (reducedMotion() || (game?.frames || []).length < 2) return;
        timer = setTimeout(() => (stop = play(el, game)), PREVIEW_MS);
      },
      stop() {
        clearTimeout(timer);
        stop?.();
        stop = null;
      },
    };
  })();

  /* --- left alone --------------------------------------------------------- */

  const attract = (() => {
    let idle = 0;
    let turn = 0;
    let on = false;

    function start() {
      if (!isTop() || reducedMotion()) return;
      on = true;
      document.body.classList.add('is-attract');
      preview.stop();
      const pool = games.filter((game) => shelfOf(game) === GAMES);
      const next = () => {
        const game = pick(pool);
        hero.show(game);
        stage.show(game, { now: true });
        turn = setTimeout(next, ATTRACT_MS);
      };
      next();
    }

    function stop() {
      on = false;
      clearTimeout(turn);
      document.body.classList.remove('is-attract');
      hero.show(current, { spotlight });
      stage.show(current, { now: true });
    }

    return {
      /** Any input. True when it only woke the screen, and should do nothing else. */
      poke() {
        clearTimeout(idle);
        const woke = on;
        if (on) stop();
        if (isTop()) idle = setTimeout(start, IDLE_MS);
        return woke;
      },
      halt() {
        clearTimeout(idle);
        if (on) stop();
      },
    };
  })();

  /* --- what the app asks of it ------------------------------------------- */

  function act(action) {
    if (shuffling) return true;
    const el = document.activeElement;
    switch (action) {
      case 'up':
      case 'down':
      case 'left':
      case 'right':
        move(action);
        return true;
      case 'pageUp':
      case 'pageDown':
        jump(action === 'pageUp' ? -3 : 3);
        return true;
      case 'prevRail':
      case 'nextRail':
        jump(action === 'prevRail' ? -1 : 1);
        return true;
      case 'first':
      case 'last':
        ends(action);
        return true;
      case 'press':
        // A focused button or tile presses itself; with nothing focused, the hero's game plays.
        if (zoneOf(el)) el.click();
        else if (current) onPlay(current, heroEl);
        return true;
      case 'info':
        if (current) onInfo(current);
        return true;
      case 'fave':
        if (current) onFave(current);
        return true;
      case 'surprise':
        surprise();
        return true;
      case 'back':
        // Deep in the rows, back goes to the top row.
        if (zoneOf(el) === 'rail' && shelf.rows().indexOf(shelf.rowOf(el)) > 0) toRow(0, el, 'up');
        return true;
      default:
        return false;
    }
  }

  /** Rebuild the rows from the library and this device's history, keeping focus where it was. */
  function rebuild() {
    const onTile = zoneOf(document.activeElement) === 'rail';
    shelf.render(buildRails(games, stats));
    const el = lastTile();
    if (!el) return;
    shelf.mark(shelf.rowOf(el), el);
    // Rows may have come or gone above the focused one: back into the band at once.
    if (onTile) focus(el, { place: 'snap' });
  }

  // The rows are sized by the window: after a resize, put the focused one back in the band.
  let resized = 0;
  addEventListener('resize', () => {
    clearTimeout(resized);
    resized = setTimeout(() => {
      const el = zoneOf(document.activeElement) === 'rail' ? document.activeElement : null;
      if (el) focus(el, { place: 'snap' });
    }, 150);
  });

  // First paint: today's pick, nothing focused yet.
  rebuild();
  if (current) {
    hero.show(current, { spotlight });
    stage.show(current, { now: true });
  }

  return {
    act,
    rebuild,
    surprise,
    /** Any input; true when it only woke the screen from attract mode. */
    poke: () => attract.poke(),
    /** An overlay or a game takes over: remember focus, and stop everything behind it moving. */
    leave() {
      if (couch.contains(document.activeElement)) held = document.activeElement;
      attract.halt();
      preview.stop();
      stage.pause();
    },
    /**
     * Back on the home screen, focus exactly where it was: the same button,
     * or the same game in the same row (its tile may have been rebuilt while
     * away). `landOn` names a game reached by a link, with nowhere to go back
     * to: its tile is focused instead.
     */
    enter({ landOn = null } = {}) {
      stage.resume();
      const el = held?.classList.contains('tile')
        ? lastTile()
        : held?.isConnected
          ? held
          : landOn && shelf.find(landOn, (row) => !PERSONAL.has(row.key));
      held = null;
      if (el) focus(el, { place: 'snap' });
      stage.show(current, { now: true });
      attract.poke();
    },
    tileFor: (slug) => (last?.slug === slug && lastTile()) || null,
  };
}
