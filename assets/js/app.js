/**
 * app.js — wiring.
 *
 * Load the manifest, work out the rails, render the wall, and keep three
 * views in sync with the URL: the wall, the drawer and the player. The wall is
 * only ever rebuilt when the filter state actually changes, which is why a
 * play session returns you to the same scroll position with the same search
 * still typed.
 */

import { h } from './dom.js';
import { loadManifest, deriveFacets } from './manifest.js';
import { selectGames, facetCounts, DEFAULT_SORT, SORTS } from './filter.js';
import { store } from './store.js';
import { router } from './router.js';
import { createGrid } from './ui/grid.js';
import { createControls } from './ui/controls.js';
import { createDetail } from './ui/detail.js';
import { createPlayer } from './ui/player.js';

const wallEl = document.getElementById('wall');
const countEl = document.getElementById('count');

const grid = createGrid(wallEl);

const stats = {
  isFave: (slug) => store.isFave(slug),
  plays: (slug) => store.plays(slug),
  lastPlayed: (slug) => store.lastPlayed(slug),
};

let games = [];
let facets = [];
let bySlug = new Map();
let lastKey = '';
let hops = 0;
let scrollBeforePlay = 0;

/* --- state lives in the URL --------------------------------------------- */

function readState(query) {
  const state = {
    query: query.get('q') || '',
    sort: query.get('sort') || store.ui().sort || DEFAULT_SORT,
    favesOnly: query.get('fav') === '1',
    facets: {},
  };
  if (!SORTS.some((s) => s.key === state.sort)) state.sort = DEFAULT_SORT;
  for (const facet of facets) {
    const raw = query.get(facet.key);
    if (raw) state.facets[facet.key] = raw.split(',').filter(Boolean);
  }
  return state;
}

// The fave count joins the key only while the Favourites filter is on, so
// un-starring a game inside that view actually removes it from the wall.
const stateKey = (state) =>
  JSON.stringify([
    state.query,
    state.sort,
    state.favesOnly,
    state.facets,
    state.favesOnly ? store.faveCount() : 0,
  ]);

/* --- views --------------------------------------------------------------- */

const controls = createControls(document.getElementById('controls'), {
  onChange(patch) {
    if (patch.sort) store.setUi({ sort: patch.sort });
    router.setQuery(patch);
  },
});

const detail = createDetail(document.getElementById('detail'), {
  onPlay: (game, build) => router.go(`/play/${game.slug}/${build.version || build.id}`),
});

const player = createPlayer(document.getElementById('player'), {
  onExit: () => (hops > 1 ? history.back() : router.go('/', { replace: true })),
});

function renderCount(shown) {
  countEl.replaceChildren(
    h('b', {}, String(shown)),
    shown === games.length
      ? `${games.length === 1 ? 'game' : 'games'} on the wall`
      : `of ${games.length} games`
  );
}

function renderWall(state) {
  const key = stateKey(state);
  const changed = key !== lastKey;
  const visible = selectGames(games, state, stats);

  controls.render(state, { facets, counts: facetCounts(games, state, stats, facets) });
  renderCount(visible.length);

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

const findBuild = (game, token) =>
  (token && game.builds.find((b) => b.version === token || b.id === token)) || game.builds[0];

function onRoute(route) {
  hops++;
  const state = readState(route.query);
  renderWall(state);

  const game = route.name === 'wall' ? null : bySlug.get(route.slug);

  if (route.name === 'play' && game) {
    const build = findBuild(game, route.build);
    const already = player.isOpen() && player.current()?.slug === game.slug && player.currentBuild()?.id === build.id;
    if (!already) {
      if (!player.isOpen()) scrollBeforePlay = window.scrollY;
      detail.close();
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

/* --- keyboard ------------------------------------------------------------ */

addEventListener('keydown', (event) => {
  if (player.isOpen()) return;
  const typing = /^(input|textarea|select)$/i.test(event.target?.tagName || '');

  if (event.key === 'Escape' && detail.isOpen()) {
    router.go('/');
  } else if (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey) {
    event.preventDefault();
    controls.focusSearch();
  }
});

/* --- go ------------------------------------------------------------------ */

grid.message('Loading the wall…');

loadManifest()
  .then((manifest) => {
    games = manifest.games;
    facets = deriveFacets(games);
    bySlug = new Map(games.map((game) => [game.slug, game]));

    if (!games.length) {
      grid.message('No games yet. Drop an .html file into ', h('code', {}, 'games/'), ' and refresh.');
      renderCount(0);
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
