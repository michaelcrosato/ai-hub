/**
 * couch/app.js — the Couch: the hub as a games console's home screen, for a
 * TV across the room, the arrow keys, or a controller.
 *
 * Wiring. Load the library, build the home screen, and keep four layers in
 * step with the address, each over the last:
 *
 *   home      #/
 *   search    #/?find=1, or #/?q=orbit (what the view switch carries)
 *   page      #/g/<slug>
 *   player    #/play/<slug>[/<build>]
 *
 * Keys and pads are read as the same actions (see input.js and pad.js) and
 * handed to whichever layer is on top. While a game plays the couch claims
 * no keys and no buttons, except one way out a controller can reach: View
 * and Menu held together.
 */

import { h, icon } from '../dom.js';
import { loadLibrary } from '../library.js';
import { store } from '../store.js';
import { router } from '../router.js';
import { createPlayer } from '../ui/player.js';
import { createBar } from './bar.js';
import { createHome } from './home.js';
import { createPage } from './page.js';
import { createFind } from './find.js';
import { keyAction, createRepeatGate, MOVES } from './input.js';
import { watchPads } from './pad.js';
import { createToast, syncStars, PAD_GLYPHS } from './ui.js';
import { shelfOf, SHELVES } from '../filter.js';

const couch = document.getElementById('couch');
const heroEl = document.getElementById('hero');
const findEl = document.getElementById('find');
const pageEl = document.getElementById('page');
const playerEl = document.getElementById('player');
const toast = createToast(document.getElementById('toast'));

const stats = {
  isFave: (slug) => store.isFave(slug),
  plays: (slug) => store.plays(slug),
  lastPlayed: (slug) => store.lastPlayed(slug),
};

/* --- which input is in hand ------------------------------------------------ */

// 'keys', 'pad', 'pointer' or 'touch'. Moves made with keys or a pad glide
// into place; a pointer points at what it wants and nothing moves under it.
let input = matchMedia('(hover: none)').matches ? 'touch' : 'keys';
let padOn = false;
const via = () => input;

/**
 * The button prompts follow the last thing pressed: keycaps for keys, pad
 * buttons for a pad, none for a thumb. A mouse leaves them as they were,
 * unless there were none.
 */
function use(next) {
  input = next;
  const body = document.body.dataset;
  body.input = next;
  if (next === 'keys' || next === 'pad') body.prompts = next;
  else if (next === 'touch' && !padOn) body.prompts = 'none';
  else if (next === 'pointer' && body.prompts === 'none') body.prompts = 'keys';
}
use(input);

// Read in the capture phase, ahead of the rows' own pointer handlers, so a
// tile focused by the mouse already knows it was the mouse.
addEventListener(
  'pointermove',
  (event) => {
    if (event.pointerType === 'mouse' && (event.movementX || event.movementY)) {
      use('pointer');
      home?.poke();
    }
  },
  true
);
addEventListener(
  'pointerdown',
  (event) => {
    use(event.pointerType === 'mouse' ? 'pointer' : 'touch');
    home?.poke();
  },
  true
);
addEventListener('wheel', () => home?.poke(), { passive: true });

/* --- history: Back goes back, never out of the hub --------------------------- */

// Each history entry is stamped with how many entries of ours lie beneath it,
// so closing an overlay steps back only when there is somewhere of ours to go.
let depth = 0;
const stamp = () => history.replaceState({ ...history.state, couch: depth }, '');
addEventListener('popstate', () => {
  if (Number.isInteger(history.state?.couch)) depth = history.state.couch;
});

function go(path, { replace = false, query } = {}) {
  if (!replace) depth += 1;
  router.go(path, query ? { replace, query } : { replace });
  stamp();
}

function setQuery(patch) {
  router.setQuery(patch);
  stamp();
}

/**
 * One step back; or, reached by a link with nothing of ours beneath, home in
 * place: with the search still up when `query` is left alone (a page opened
 * over it), or as given (closing the search itself).
 */
function back(query) {
  if (depth > 0) history.back();
  else go('/', { replace: true, query });
}

const closeSearch = () => back(new URLSearchParams());

/* --- the layers ------------------------------------------------------------- */

let library = null;
let home = null;
let find = null;
let page = null;
let launchedFrom = null;
let deepPlay = false;
/** The history's length once a game's entry is pushed: what it adds after is its own. */
let lengthAtPlay = 0;
let rebuildOnReturn = false;
/** Something to do once the home screen is back on top (a surprise asked for from search). */
let onHome = null;

const bar = createBar(document.getElementById('bar'), {
  onSearch: () => openSearch(),
  onSurprise: () => home?.surprise(),
});

function openSearch() {
  if (!find?.isOpen()) go('/', { query: new URLSearchParams({ find: '1' }) });
}

function fave(slug) {
  const game = library.bySlug.get(slug);
  if (!game) return;
  const on = store.toggleFave(slug);
  toast.show(h('span', {}, h('b', {}, game.name), on ? ' added to your favourites' : ' removed from your favourites'));
}

/**
 * Out of a game, back the browser's way so the history stays true. A game
 * that keeps its state in its address adds history entries of its own, which
 * Back would step through first, leaving the game up; so those are stepped
 * over too, and if the address still has not moved, the couch leaves in place.
 */
function leaveGame() {
  const playing = location.href;
  const under = page?.isOpen() ? `/g/${page.game().slug}` : '/';
  if (depth > 0) history.go(-1 - Math.max(0, history.length - lengthAtPlay));
  else go(under, { replace: true });
  setTimeout(() => {
    if (player.isOpen() && location.href === playing) go(under, { replace: true });
  }, 400);
}

const player = createPlayer(playerEl, {
  backLabel: 'Back to the couch',
  onExit: leaveGame,
  // Another game from the Games shelf, never the one already up.
  onRoll() {
    const slug = player.current()?.slug;
    const pool = library.games.filter((game) => game.slug !== slug && shelfOf(game) === SHELVES[0].key);
    if (pool.length) go(`/play/${pool[Math.floor(Math.random() * pool.length)].slug}`, { replace: true });
  },
});

const top = () => (player.isOpen() ? 'player' : page?.isOpen() ? 'page' : find?.isOpen() ? 'find' : 'home');
const layer = (name) => ({ home, find, page })[name] || null;

function setInert(now) {
  couch.inert = now !== 'home';
  findEl.inert = now === 'page' || now === 'player';
  pageEl.inert = now === 'player';
}

/** The rows, and the stars on every tile already drawn, as this device now remembers them. */
function refresh() {
  home.rebuild();
  syncStars();
}

const findBuild = (game, token) => (token && game.builds.find((b) => b.version === token || b.id === token)) || game.builds[0];

function onRoute(route) {
  const query = route.query;
  const game = route.slug ? library.bySlug.get(route.slug) : null;
  // An unknown game, or one kept off the wall, goes back home.
  if (route.slug && !game) return go('/', { replace: true, query: new URLSearchParams() });

  const searching = query.has('q') || query.has('find');
  const want = {
    search: searching ? query.get('q') || '' : null,
    // A game played from its page keeps the page under it, to come back to.
    page: route.name === 'detail' ? game : route.name === 'play' && page.isOpen() ? page.game() : null,
    play: route.name === 'play' ? game : null,
  };
  const next = want.play ? 'player' : want.page ? 'page' : want.search !== null ? 'find' : 'home';
  const before = top();
  if (next !== before) layer(before)?.leave();

  if (want.search === null) find.close();
  else find.open(want.search);

  if (!want.page) page.close();
  else if (page.game() !== want.page || !page.isOpen()) page.open(want.page);

  if (want.play) {
    const build = findBuild(game, route.build);
    if (player.isOpen() && player.current()?.slug === game.slug && player.currentBuild()?.id === build.id) return;
    if (!player.isOpen()) {
      deepPlay = depth === 0;
      lengthAtPlay = history.length;
    }
    const from = launchedFrom || (document.activeElement?.classList.contains('tile') ? document.activeElement : null);
    launchedFrom = null;
    setInert('player');
    player.open(game, build, { fromTile: from });
    if (padOn) toast.show(exitHint(), { ms: 4000 });
    return;
  }

  setInert(next);
  if (player.isOpen()) {
    const slug = player.current()?.slug;
    if (rebuildOnReturn) {
      rebuildOnReturn = false;
      refresh();
    }
    // Back where it launched from, in place, before the game shrinks into it.
    // The couch is hidden while a game plays, and a hidden element cannot
    // take focus, so it is shown first (as the wall does).
    document.body.classList.remove('is-playing');
    layer(next).enter(next === 'home' ? { landOn: deepPlay ? slug : null } : undefined);
    toast.hide();
    player.close({ toTile: next === 'home' ? home.tileFor(slug) : null });
    return;
  }
  if (next !== before) layer(next).enter();
  if (next === 'home' && onHome) {
    const then = onHome;
    onHome = null;
    then();
  }
}

/* --- the way out of a game, for a controller ------------------------------- */

const glyph = (d) => h('span', { class: 'pad-glyph' }, icon(d));
const exitHint = (progress = 0) =>
  h(
    'span',
    { class: 'toast__exit' },
    h('svg', { class: 'toast__ring', viewBox: '0 0 24 24', 'aria-hidden': 'true' }, h('circle', { cx: 12, cy: 12, r: 10, pathLength: 1, style: { 'stroke-dashoffset': String(1 - progress) } })),
    'Hold ',
    glyph(PAD_GLYPHS.view),
    ' + ',
    glyph(PAD_GLYPHS.menu),
    ' to come back'
  );

function onChord(progress, fired) {
  if (!player.isOpen()) return;
  if (fired) return leaveGame();
  if (progress > 0) toast.show(exitHint(progress), { ms: 0 });
  else toast.hide();
}

/* --- keys and pads ------------------------------------------------------- */

const gate = createRepeatGate();

/** Enter on a button or link presses it the browser's way, and so does Space on a button. */
const pressesItself = (event) => {
  const el = document.activeElement;
  if (event.key === 'Enter') return Boolean(el?.closest('button, a[href], input'));
  return event.key === ' ' && Boolean(el?.closest('button'));
};

function dispatch(action) {
  const now = top();
  if (now === 'player') return false;
  if (action === 'search' && now === 'home') {
    openSearch();
    return true;
  }
  return layer(now).act(action);
}

addEventListener('keydown', (event) => {
  if (player.isOpen() || !home) return;
  use('keys');
  if (home.poke()) return event.preventDefault();
  if (top() === 'find' && find.key(event)) return;
  const action = keyAction(event);
  if (!action || (action === 'press' && pressesItself(event))) return;
  event.preventDefault();
  if (MOVES.has(action) && !gate(event, performance.now())) return;
  dispatch(action);
});

/** While a game plays, its own frame has focus, and some browsers only show it the pad. */
function readPads() {
  try {
    const inner = player.isOpen() && playerEl.querySelector('iframe')?.contentWindow?.navigator.getGamepads?.();
    if (inner && [...inner].some(Boolean)) return inner;
  } catch {
    /* the frame navigated away from this origin */
  }
  return navigator.getGamepads?.() || [];
}

/* --- go ----------------------------------------------------------------- */

loadLibrary()
  .then((loaded) => {
    library = loaded;
    const { games } = loaded;
    if (!games.length) throw new Error('no games');

    const play = (game, from) => {
      launchedFrom = from;
      go(`/play/${game.slug}`);
    };

    home = createHome({
      couch,
      stageEl: document.getElementById('stage'),
      heroEl,
      railsEl: document.getElementById('rails'),
      bar,
      games,
      stats,
      via,
      isTop: () => top() === 'home',
      onPlay: play,
      onInfo: (game) => go(`/g/${game.slug}`),
      onFave: (game) => fave(game.slug),
    });

    page = createPage(pageEl, {
      games,
      via,
      onPlay: (game, build) => go(build && build !== game.builds[0] ? `/play/${game.slug}/${build.version || build.id}` : `/play/${game.slug}`),
      onFave: (game) => fave(game.slug),
      onBrowse: (slug) => go(`/g/${slug}`, { replace: true }),
      onBack: () => back(),
    });

    find = createFind(findEl, {
      games,
      stats,
      showAll: loaded.showAll,
      via,
      onQuery: (text) => setQuery({ q: text, find: text ? '' : '1' }),
      onPlay: (slug, el) => play(library.bySlug.get(slug), el),
      onInfo: (slug) => go(`/g/${slug}`),
      onFave: fave,
      onSurprise() {
        // The surprise lands on the home screen, once search has closed.
        onHome = () => home.surprise();
        closeSearch();
      },
      onBack: closeSearch,
    });

    // A new favourite or a play changes the rows. While a game runs the
    // rebuild waits, so nothing competes with the game loading.
    store.subscribe(() => {
      if (player.isOpen()) rebuildOnReturn = true;
      else refresh();
    });

    watchPads({
      playing: () => player.isOpen(),
      read: readPads,
      onConnect(on) {
        padOn = on;
        bar.setPad(on);
        if (on) use('pad');
        else if (input === 'pad') use('keys');
      },
      onAction(action) {
        use('pad');
        if (home.poke()) return;
        dispatch(action);
      },
      onChord,
    });

    router.subscribe(onRoute);
    stamp();
    router.start();
  })
  .catch((error) => {
    console.error(error);
    heroEl.replaceChildren(
      h('p', { class: 'hero__eyebrow' }, 'Nothing to show'),
      h('h2', { class: 'hero__name' }, 'The couch is empty'),
      h('p', { class: 'hero__blurb' }, "Couldn't load the game list. Run pnpm scan to rebuild data/games.json, then refresh.")
    );
  });
