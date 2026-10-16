import { h } from '../dom.js';
import { loadLibrary } from '../library.js';
import { router } from '../router.js';
import { store } from '../store.js';
import { createPlayer } from '../ui/player.js';
import { createDetail } from '../ui/detail.js';
import { viewSwitch } from '../ui/views.js';
import { selection } from './common.js';

const names = { atlas: 'Atlas', timeline: 'Timeline', deck: 'Deck' };
const key = document.body.dataset.view;
const label = names[key];
const $ = (id) => document.getElementById(id);
const shell = $('explore-shell');
const root = $('explore-content');
const search = $('explore-search');
const shelf = $('explore-shelf');
const fav = $('explore-fav');
const detailRoot = $('detail');
let library;
let view;
let pool = [];
let rendered = null;
let dirty = true;
let shownDetail = null;
let returnFocus = null;
let focusToken = null;
let playFrom = null;
let launched = false;
let lengthAtPlay = 0;
let returnPath = '/';
let openedDetail = false;

$('views').append(viewSwitch(key));

const play = (game, from, build = game.builds[0]) => {
  if (!build) return;
  playFrom = from instanceof HTMLElement ? from : document.activeElement;
  returnPath = router.current().name === 'detail' ? `/g/${game.slug}` : '/';
  launched = true;
  const suffix = build === game.builds[0] ? '' : `/${build.version || build.id}`;
  router.go(`/play/${game.slug}${suffix}`);
};

function leavePlayer() {
  const playing = location.href;
  if (launched) history.go(-1 - Math.max(0, history.length - lengthAtPlay));
  else router.go(returnPath, { replace: true });
  // A game may have replaced the top-level history entry or its own entries.
  setTimeout(() => {
    if (player.isOpen() && location.href === playing) router.go(returnPath, { replace: true });
  }, 400);
}

const player = createPlayer($('player'), {
  backLabel: `Back to the ${label.toLowerCase()}`,
  onExit: leavePlayer,
  onRoll() {
    const unplayed = key === 'deck' && router.current().query.get('unplayed') === '1';
    const choices = (view?.getPool?.() || pool).filter(
      (game) => game.slug !== player.current()?.slug && (!unplayed || !store.plays(game.slug)),
    );
    if (choices.length)
      router.go(`/play/${choices[Math.floor(Math.random() * choices.length)].slug}`, { replace: true });
  },
});

const detail = createDetail(detailRoot, {
  onPlay: (game, build) => play(game, document.activeElement, build),
});

function closeDetail() {
  if (openedDetail) history.back();
  else router.go('/', { replace: true });
}

function rememberFocus(from) {
  returnFocus = from instanceof HTMLElement ? from : document.activeElement;
  focusToken = ['data-atlas-focus', 'data-timeline-focus']
    .map((name) => [name, returnFocus?.getAttribute(name)])
    .find(([, value]) => value);
}

function restoreFocus() {
  let target = returnFocus;
  if (!target?.isConnected && focusToken) {
    target = [...root.querySelectorAll(`[${focusToken[0]}]`)].find(
      (node) => node.getAttribute(focusToken[0]) === focusToken[1],
    );
  }
  if (!target?.isConnected || target.disabled || !target.getClientRects().length || target.closest('[inert]'))
    target = root;
  target.focus({ preventScroll: true });
  if (document.activeElement !== target) root.focus({ preventScroll: true });
}

function render(route) {
  if (!library || !view) return;
  const game = library.bySlug.get(route.slug);
  if (route.slug && !game) {
    $('explore-notice').textContent = 'That entry is unavailable. Browse the library below.';
    router.go('/', { replace: true });
    return;
  }
  const queryText = route.query.toString();
  search.value = route.query.get('q') || '';
  shelf.value = ['all', 'tools', 'unsure'].includes(route.query.get('shelf'))
    ? route.query.get('shelf')
    : 'games';
  fav.setAttribute('aria-pressed', String(route.query.get('fav') === '1'));
  if (queryText !== rendered || dirty) {
    pool = selection(library.games, route.query, store, library.showAll);
    $('explore-count').textContent =
      `${pool.length.toLocaleString()} ${pool.length === 1 ? 'entry' : 'entries'} in this selection`;
    dirty = false;
    rendered = queryText;
    view.update({ games: pool, query: route.query, selected: route.slug || null });
  }
  view.setSelected?.(route.name === 'detail' ? route.slug : null);

  if (route.name === 'play') {
    const build =
      game.builds.find((item) => route.build && (item.id === route.build || item.version === route.build)) ||
      game.builds[0];
    if (!build) {
      router.go(`/g/${game.slug}`, { replace: true });
      return;
    }
    shell.inert = true;
    detailRoot.inert = true;
    if (player.current()?.slug === game.slug && player.currentBuild()?.id === build.id) return;
    if (!player.isOpen()) lengthAtPlay = history.length;
    player.open(game, build, { fromTile: playFrom });
    playFrom = null;
    return;
  }

  const wasPlaying = player.isOpen();
  player.close();
  shell.inert = route.name === 'detail';
  detailRoot.inert = false;
  document.body.classList.toggle('has-detail', route.name === 'detail');
  if (route.name === 'detail') {
    if (shownDetail !== game.slug || !detail.isOpen()) {
      detail.open(game, { closeTo: closeDetail });
      shownDetail = game.slug;
    } else if (wasPlaying) detailRoot.querySelector('.detail__play')?.focus();
  } else {
    const wasDetail = detail.isOpen();
    detail.close();
    shownDetail = null;
    openedDetail = false;
    if (wasDetail || wasPlaying) restoreFocus();
  }
  launched = false;
}

const writeScope = (patch) => {
  $('explore-notice').textContent = '';
  router.setQuery({ ...patch, district: null, month: null, card: null, deckDone: null });
};
search.addEventListener('input', () => writeScope({ q: search.value }));
shelf.addEventListener('change', () => writeScope({ shelf: shelf.value === 'games' ? null : shelf.value }));
fav.addEventListener('click', () =>
  writeScope({ fav: router.current().query.get('fav') === '1' ? null : '1' }),
);
$('explore-reset').addEventListener('click', () =>
  router.go('/', { replace: true, query: new URLSearchParams() }),
);
document.querySelector('.skip').addEventListener('click', (event) => {
  event.preventDefault();
  root.focus();
  root.scrollIntoView();
});

addEventListener('keydown', (event) => {
  if (player.isOpen() || event.altKey || event.ctrlKey || event.metaKey) return;
  if (detail.isOpen()) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDetail();
    } else if (event.key === 'Tab') {
      const controls = [...detailRoot.querySelectorAll('.detail__panel button, .detail__panel a[href]')];
      const first = controls[0];
      const last = controls.at(-1);
      if (
        event.shiftKey &&
        (document.activeElement === first || !detailRoot.contains(document.activeElement))
      ) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    return;
  }
  if (event.key === '/' && !event.target.closest('input, textarea, select, [contenteditable]')) {
    event.preventDefault();
    search.focus();
  }
});

async function boot() {
  try {
    const [loaded, renderer] = await Promise.all([loadLibrary(), import(`./${key}.js`)]);
    library = loaded;
    if (library.showAll)
      $('explore-notice').textContent = 'Dev settings: restricted content is visible on this device.';
    view = renderer.createView(root, {
      info(game, from) {
        rememberFocus(from);
        openedDetail = true;
        router.go(`/g/${game.slug}`);
      },
      play(game, from) {
        rememberFocus(from);
        play(game, from);
      },
      setQuery: (patch) => router.setQuery(patch),
      fave: (game) => store.toggleFave(game.slug),
      isFave: store.isFave,
    });
    store.subscribe(() => {
      dirty = true;
      if (!player.isOpen()) render(router.current());
    });
    router.subscribe(render);
    router.start();
  } catch (error) {
    console.error(error);
    root.replaceChildren(
      h(
        'section',
        { class: 'explore-error', role: 'alert' },
        h('h2', {}, 'The library could not be opened'),
        h('p', {}, 'Check your connection and try again.'),
        h('button', { type: 'button', onclick: () => location.reload() }, 'Try again'),
      ),
    );
  }
}
boot();
