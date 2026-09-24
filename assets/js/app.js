/**
 * app.js — wiring.
 *
 * Load the manifest, work out the rails, render the wall, and keep three
 * views in sync with the URL: the wall, the drawer and the player. The wall is
 * only ever rebuilt when the filter state actually changes, which is why a
 * play session returns you to the same scroll position with the same search
 * still typed.
 *
 * The wall shows one shelf at a time — Games, Tech demos, Tools & websites —
 * and the rails are worked out for the shelf in view, so a Games wall never
 * offers a "Tech Demo" genre with nothing behind it.
 */

import { h } from './dom.js';
import { loadManifest, deriveFacets } from './manifest.js';
import {
  selectGames,
  facetCounts,
  DEFAULT_SORT,
  SORTS,
  SHELVES,
  DEFAULT_SHELF,
  shelfOf,
  isVisible,
} from './filter.js';
import { store } from './store.js';
import { router } from './router.js';
import { createGrid } from './ui/grid.js';
import { createControls } from './ui/controls.js';
import { createShelves } from './ui/shelves.js';
import { createDetail } from './ui/detail.js';
import { createPlayer } from './ui/player.js';
import { createDev } from './ui/dev.js';

const wallEl = document.getElementById('wall');
const countEl = document.getElementById('count');

const grid = createGrid(wallEl);

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
  const shelf = query.get('shelf') || DEFAULT_SHELF;
  const state = {
    shelf: SHELVES.some((s) => s.key === shelf) ? shelf : DEFAULT_SHELF,
    showAll: showAll(),
    query: query.get('q') || '',
    sort: query.get('sort') || store.ui().sort || DEFAULT_SORT,
    favesOnly: query.get('fav') === '1',
    facets: {},
  };
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
    state.facets,
    state.favesOnly ? store.faveCount() : 0,
    store.dev(),
  ]);

/* --- views --------------------------------------------------------------- */

const shelves = createShelves(document.getElementById('shelves'), {
  onSelect(shelf) {
    // A genre picked on one shelf rarely exists on another, so switching
    // shelves starts its rails fresh. The search stays: it travels well.
    const patch = { shelf: shelf === DEFAULT_SHELF ? '' : shelf };
    for (const facet of facets) patch[facet.key] = '';
    router.setQuery(patch);
  },
});

const controls = createControls(document.getElementById('controls'), {
  railsRoot: document.getElementById('filters'),
  onChange(patch) {
    if (patch.sort) store.setUi({ sort: patch.sort });
    router.setQuery(patch);
  },
  onDensity(next) {
    store.setUi({ density: next });
    applyDensity();
  },
  // Drawn from what the shelf and filters leave showing, so "Surprise me"
  // on the Games shelf is always a game.
  onSurprise() {
    if (!showing.length) return;
    const game = showing[Math.floor(Math.random() * showing.length)];
    router.go(`/play/${game.slug}`);
  },
});

const detail = createDetail(document.getElementById('detail'), {
  onPlay: (game, build) => router.go(`/play/${game.slug}/${build.version || build.id}`),
});

const player = createPlayer(document.getElementById('player'), {
  onExit: () => (hops > 1 ? history.back() : router.go('/', { replace: true })),
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

function renderWall(state) {
  const key = stateKey(state);
  const changed = key !== lastKey;
  const visible = selectGames(games, state, stats);
  showing = visible;

  const perShelf = new Map(
    SHELVES.map((s) => [s.key, games.filter((g) => isVisible(g, state.showAll) && shelfOf(g) === s.key).length])
  );
  shelves.render(state.shelf, perShelf);
  controls.render(state, { facets, counts: facetCounts(games, state, stats, facets), shown: visible.length });
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
            const cleared = { q: '', fav: '' };
            for (const facet of facets) cleared[facet.key] = '';
            router.setQuery(cleared);
          },
        },
        'Clear the filters'
      )
    );
    return;
  }

  grid.render(visible);
  // Refining a search should show you the top of the new results, but the
  // first paint must not steal the scroll position from a deep link.
  if (isRefine && wallEl.getBoundingClientRect().top < 0) {
    wallEl.scrollIntoView({ block: 'start', behavior: 'auto' });
  }
}

function applyDensity() {
  wallEl.classList.toggle('is-compact', store.ui().density === 'compact');
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
      if (!player.isOpen()) scrollBeforePlay = window.scrollY;
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

applyDensity();
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
