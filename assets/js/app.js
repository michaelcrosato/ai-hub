/**
 * app.js — wiring.
 *
 * Load the manifest, work out the rails, render the wall, and keep three
 * views in sync with the URL: the wall, the drawer and the player. The wall is
 * only ever rebuilt when the filter state actually changes, which is why a
 * play session returns you to the same scroll position with the same search
 * still typed.
 *
 * The wall shows one shelf at a time — Games, or Tech demos & tools —
 * and the rails are worked out for the shelf in view, so a Games wall never
 * offers a "Tech Demo" genre with nothing behind it.
 *
 * Attempts at the same thing stack: a series is one cabinet until you open
 * it, then each game in it is one, then every attempt at that game is laid
 * out. Each step is a link, so Back climbs out again.
 */

import { h, icon, ICONS } from './dom.js';
import { loadManifest, deriveFacets, sameKey, originOf, ORIGINAL } from './manifest.js';
import { plural } from './format.js';
import {
  selectGames,
  facetCounts,
  sourceCounts,
  stackGames,
  DEFAULT_SORT,
  SORTS,
  SHELVES,
  SHELF_ALIASES,
  ORIGINS,
  GROUPINGS,
  DEFAULT_SHELF,
  shelfOf,
  isVisible,
} from './filter.js';
import { store } from './store.js';
import { router } from './router.js';
import { createGrid } from './ui/grid.js';
import { createControls, SIZES, currentSize } from './ui/controls.js';
import { createShelves } from './ui/shelves.js';
import { createDetail } from './ui/detail.js';
import { createPlayer } from './ui/player.js';
import { createDev } from './ui/dev.js';
import { viewSwitch } from './ui/views.js';

const wallEl = document.getElementById('wall');
document.querySelector('.sign__side')?.prepend(viewSwitch('wall'));
const countEl = document.getElementById('count');

/** The wall as it is now, narrowed (or widened) to one series and game. */
function hrefWith(patch) {
  const query = new URLSearchParams(router.current().query);
  for (const [key, value] of Object.entries(patch)) {
    if (value) query.set(key, value);
    else query.delete(key);
  }
  const text = query.toString();
  return `#/${text ? `?${text}` : ''}`;
}

/** Where a series or a game sits in the Source rail, as the query that opens it. */
const lineageQuery = ({ original, series, title }) => ({
  origin: original ? 'original' : 'inspired',
  series: original ? '' : series,
  source: title || '',
});

const grid = createGrid(wallEl, {
  // A source stack opens that series or game; a genre or model stack
  // filters the wall to it.
  stackHref: (stack) =>
    stack.level === 'facet' ? hrefWith({ [stack.facet]: stack.label }) : hrefWith(lineageQuery(stack)),
});

/** How the wall stacks, remembered per device. */
const grouping = () => {
  const key = store.ui().group;
  return GROUPINGS.some((g) => g.key === key) ? key : GROUPINGS[0].key;
};

const stats = {
  isFave: (slug) => store.isFave(slug),
  plays: (slug) => store.plays(slug),
  lastPlayed: (slug) => store.lastPlayed(slug),
};

let manifest = { games: [] };
let games = [];
let facets = [];
let bySlug = new Map();
let lastKey = '';
let showing = [];
let hops = 0;
let scrollBeforePlay = 0;
/** History's length when the game opened; see leaveGame. */
let historyAtPlay = 0;

/* --- what is on the wall ------------------------------------------------- */

const showAll = () => store.dev().showAll;

/** Rails for one shelf, remembered until the shelf or visibility changes. */
const facetCache = new Map();
function facetsFor(shelf) {
  const key = `${shelf}|${showAll()}`;
  if (!facetCache.has(key)) {
    facetCache.set(key, deriveFacets(games.filter((g) => isVisible(g, showAll()) && shelfOf(g) === shelf)));
  }
  return facetCache.get(key);
}

/* --- state lives in the URL --------------------------------------------- */

function readState(query) {
  const asked = query.get('shelf') || DEFAULT_SHELF;
  const shelf = SHELF_ALIASES[asked] || asked;
  const state = {
    shelf: SHELVES.some((s) => s.key === shelf) ? shelf : DEFAULT_SHELF,
    showAll: showAll(),
    query: query.get('q') || '',
    sort: query.get('sort') || store.ui().sort || DEFAULT_SORT,
    favesOnly: query.get('fav') === '1',
    origin: ORIGINS.some((o) => o.key === query.get('origin')) ? query.get('origin') : '',
    series: query.get('series') || '',
    source: query.get('source') || '',
    facets: {},
  };
  // A link that names only the series or the game still gets the steps above
  // it, so the rail and the trail can show where it sits. Originals have no
  // series: "Original" there is the step itself.
  if (state.series && !state.origin) {
    state.origin = sameKey(state.series) === sameKey(ORIGINAL) ? 'original' : 'inspired';
  }
  if (state.origin === 'original') state.series = '';
  if (state.source && !state.series && state.origin !== 'original') {
    const found = games.find(
      (g) => sameKey(g.lineage.title) === sameKey(state.source) && (!state.origin || originOf(g) === state.origin)
    );
    if (found) {
      state.origin = originOf(found);
      if (state.origin === 'inspired') state.series = found.lineage.series;
    }
  }
  if (!SORTS.some((s) => s.key === state.sort)) state.sort = DEFAULT_SORT;
  facets = facetsFor(state.shelf);
  for (const facet of facets) {
    const raw = query.get(facet.key);
    if (raw) state.facets[facet.key] = raw.split(',').filter(Boolean);
  }
  return state;
}

// The fave count joins the key only while the Favourites filter is on, so
// un-starring a game inside that view actually removes it from the wall. The
// dev settings join it because they change what a cabinet shows.
const stateKey = (state) =>
  JSON.stringify([
    state.shelf,
    state.query,
    state.sort,
    state.favesOnly,
    state.origin,
    state.series,
    state.source,
    grouping(),
    state.facets,
    state.favesOnly ? store.faveCount() : 0,
    store.dev(),
  ]);

/* --- views --------------------------------------------------------------- */

const shelves = createShelves(document.getElementById('shelves'), {
  onSelect(shelf) {
    // A genre picked on one shelf rarely exists on another, so switching
    // shelves starts its rails fresh. The search stays: it travels well.
    const patch = { shelf: shelf === DEFAULT_SHELF ? '' : shelf, origin: '', series: '', source: '' };
    for (const facet of facets) patch[facet.key] = '';
    router.setQuery(patch);
  },
  // All, Original and Inspired sort the Games shelf, so from the other shelf
  // they go back to games, with that shelf's filters let go.
  onSource(origin) {
    const patch = { shelf: '', origin, series: '', source: '' };
    if (readState(router.current().query).shelf !== DEFAULT_SHELF) for (const facet of facets) patch[facet.key] = '';
    router.setQuery(patch);
  },
  // Drawn from what the shelf and filters leave showing, so "Surprise me"
  // on the Games shelf is always a game.
  onSurprise() {
    if (!showing.length) return;
    const game = showing[Math.floor(Math.random() * showing.length)];
    router.go(`/play/${game.slug}`);
  },
});

const controls = createControls(document.getElementById('controls'), {
  searchRoot: document.getElementById('search'),
  onChange(patch) {
    if (patch.sort) store.setUi({ sort: patch.sort });
    router.setQuery(patch);
  },
  onGroup: (group) => store.setUi({ group }),
  onSize(size) {
    store.setUi({ size });
    applySize();
  },
});

/** Every attempt at the same game on the same shelf, as a link to them all. */
function attemptsOf(game) {
  const { series, title } = game.lineage;
  const shelf = shelfOf(game);
  const count = games.filter(
    (g) =>
      isVisible(g, showAll()) &&
      shelfOf(g) === shelf &&
      sameKey(g.lineage.title) === sameKey(title) &&
      sameKey(g.lineage.series) === sameKey(series)
  ).length;
  if (count < 2) return null;
  const query = new URLSearchParams();
  if (shelf !== DEFAULT_SHELF) query.set('shelf', shelf);
  for (const [key, value] of Object.entries(lineageQuery(game.lineage))) if (value) query.set(key, value);
  return { text: `All ${count} attempts at ${title}`, href: `#/?${query}` };
}

const detail = createDetail(document.getElementById('detail'), {
  onPlay: (game, build) => router.go(`/play/${game.slug}/${build.version || build.id}`),
  attempts: attemptsOf,
});

/**
 * Back to the wall. Back is the way out, but a game may add history entries
 * of its own (a hash per level, say), and one step back would only walk back
 * through those, so it steps over all of them. Should the address still not
 * have moved, the wall is put back in its place.
 */
function leaveGame() {
  const playing = location.href;
  if (hops > 1) history.go(-1 - Math.max(0, history.length - historyAtPlay));
  else router.go('/', { replace: true });
  setTimeout(() => {
    if (player.isOpen() && location.href === playing) router.go('/', { replace: true });
  }, 400);
}

const player = createPlayer(document.getElementById('player'), {
  onExit: leaveGame,
  // Another game from what the wall was showing, never the one already up.
  onRoll() {
    const current = player.current()?.slug;
    const pool = showing.filter((game) => game.slug !== current);
    if (!pool.length) return;
    router.go(`/play/${pool[Math.floor(Math.random() * pool.length)].slug}`, { replace: true });
  },
});

const dev = createDev(document.getElementById('dev'), { library: () => manifest });

function renderCount(state, shown) {
  const shelf = SHELVES.find((s) => s.key === state.shelf);
  const total = games.filter((g) => isVisible(g, state.showAll) && shelfOf(g) === state.shelf).length;
  const noun = (n) => shelf.noun[n === 1 ? 0 : 1];
  countEl.replaceChildren(
    h('b', {}, String(shown)),
    shown === total ? `${noun(total)} on the wall` : `of ${total} ${noun(total)}`,
    // A reminder that this is not the wall everyone else sees.
    ...(state.showAll
      ? [h('button', { type: 'button', class: 'sign__dev', onclick: () => dev.open() }, 'Dev: showing hidden content')]
      : [])
  );
}

/**
 * Where the wall is inside the Source rail, with a way back up each step. It
 * sits at the top of the wall itself, because opening a stack scrolls there.
 */
function trail(state, shown) {
  if (!state.origin) return null;
  // Spelled the way the catalogue does, whatever case the link used.
  const spelled = (step, value) =>
    games.find((g) => sameKey(g.lineage[step]) === sameKey(value))?.lineage[step] || value;
  const steps = [
    [ORIGINS.find((o) => o.key === state.origin).label, { series: '', source: '' }],
    state.series && [spelled('series', state.series), { source: '' }],
    state.source && [spelled('title', state.source)],
  ].filter(Boolean);
  return h(
    'nav',
    { class: 'trail', 'aria-label': 'Source' },
    h(
      'a',
      { class: 'trail__up', href: hrefWith({ origin: '', series: '', source: '' }) },
      icon(ICONS.back),
      'All sources'
    ),
    steps.map(([text, up], i) => [
      h('span', { class: 'trail__step', 'aria-hidden': 'true' }, '›'),
      i === steps.length - 1 ? h('b', {}, text) : h('a', { href: hrefWith(up) }, text),
    ]),
    h('span', { class: 'trail__count' }, plural(shown, state.source ? 'attempt' : 'game'))
  );
}

function renderWall(state) {
  const key = stateKey(state);
  const changed = key !== lastKey;
  const visible = selectGames(games, state, stats);
  const sources = sourceCounts(games, state, stats);
  showing = visible;

  const perShelf = new Map(
    SHELVES.map((s) => [s.key, games.filter((g) => isVisible(g, state.showAll) && shelfOf(g) === s.key).length])
  );
  shelves.render(state.shelf, perShelf, {
    origin: state.origin,
    origins: sources.origins,
    canSurprise: visible.length > 0,
  });
  controls.render(state, {
    facets,
    counts: facetCounts(games, state, stats, facets),
  });
  renderCount(state, visible.length);

  if (!changed) return;
  const isRefine = lastKey !== '';
  lastKey = key;

  if (!visible.length) {
    grid.message(
      'Nothing on the wall matches that. ',
      h(
        'button',
        {
          type: 'button',
          onclick: () => {
            const cleared = { q: '', fav: '', origin: '', series: '', source: '' };
            for (const facet of facets) cleared[facet.key] = '';
            router.setQuery(cleared);
          },
        },
        'Clear the filters'
      )
    );
    return;
  }

  grid.render(stackGames(visible, state, grouping()), {
    lead: trail(state, visible.length),
    // Among inspired games, which game each one is an attempt at says more
    // than its genre; inside a series every tile is the same genre anyway.
    label: (game) =>
      state.origin === 'inspired' && !state.source && sameKey(game.lineage.title) !== sameKey(game.name)
        ? game.lineage.title
        : null,
  });
  // Refining a search should show you the top of the new results, but the
  // first paint must not steal the scroll position from a deep link.
  if (isRefine && wallEl.getBoundingClientRect().top < 0) {
    wallEl.scrollIntoView({ block: 'start', behavior: 'auto' });
  }
}

function applySize() {
  for (const size of SIZES) wallEl.classList.toggle(`is-${size.key}`, size.key === currentSize());
}

const findBuild = (game, token) =>
  (token && game.builds.find((b) => b.version === token || b.id === token)) || game.builds[0];

function onRoute(route) {
  hops++;
  const state = readState(route.query);
  renderWall(state);

  // A hidden game is not on the wall, and a link to one does not reach it
  // either, unless dev settings are showing everything.
  const found = route.name === 'wall' ? null : bySlug.get(route.slug);
  const game = found && isVisible(found, state.showAll) ? found : null;
  if (found && !game) {
    router.go('/', { replace: true });
    return;
  }

  if (route.name === 'play' && game) {
    const build = findBuild(game, route.build);
    const already = player.isOpen() && player.current()?.slug === game.slug && player.currentBuild()?.id === build.id;
    if (!already) {
      if (!player.isOpen()) {
        scrollBeforePlay = window.scrollY;
        historyAtPlay = history.length;
      }
      detail.close();
      dev.close();
      player.open(game, build, { fromTile: grid.tile(game.slug) });
    }
    return;
  }

  if (player.isOpen()) {
    const slug = player.current()?.slug;
    // Scroll first: the exit animation needs the tile's rect where it will be,
    // and body scrolling is locked until the playing class comes off.
    document.body.classList.remove('is-playing');
    window.scrollTo(0, scrollBeforePlay);
    player.close({ toTile: grid.tile(slug) });
  }

  if (route.name === 'detail' && game) {
    if (!detail.isOpen()) detail.open(game, { closeTo: () => router.go('/') });
    return;
  }

  detail.close();
}

/* --- keyboard, and the way into dev settings ------------------------------ */

addEventListener('keydown', (event) => {
  if (player.isOpen()) return;
  const typing = /^(input|textarea|select)$/i.test(event.target?.tagName || '');

  // Shift + F2: no browser claims it, and F2 already means "edit" to most
  // people who would go looking for it.
  if (event.key === 'F2' && event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
    event.preventDefault();
    dev.isOpen() ? dev.close() : dev.open();
  } else if (event.key === 'Escape' && dev.isOpen()) {
    dev.close();
  } else if (event.key === 'Escape' && detail.isOpen()) {
    router.go('/');
  } else if (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey) {
    event.preventDefault();
    controls.focusSearch();
  }
});

// Phones have no F-keys: five quick taps on the sign's name instead.
{
  let taps = [];
  document.querySelector('.sign__name')?.addEventListener('click', () => {
    const now = performance.now();
    taps = [...taps.filter((t) => now - t < 2500), now];
    if (taps.length >= 5) {
      taps = [];
      dev.open();
    }
  });
}

/* --- go ------------------------------------------------------------------ */

applySize();
grid.message('Loading the wall…');

loadManifest()
  .then((loaded) => {
    manifest = loaded;
    games = loaded.games;
    bySlug = new Map(games.map((game) => [game.slug, game]));

    if (!games.length) {
      grid.message('No games yet. Drop an .html file into ', h('code', {}, 'games/'), ' and refresh.');
      return;
    }

    router.subscribe(onRoute);
    router.start();
    store.subscribe(() => renderWall(readState(router.current().query)));
  })
  .catch((error) => {
    console.error(error);
    grid.message(
      "Couldn't load the game list. Run ",
      h('code', {}, 'pnpm scan'),
      ' to rebuild ',
      h('code', {}, 'data/games.json'),
      ', then refresh.'
    );
  });
