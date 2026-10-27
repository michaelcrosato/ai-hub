/**
 * catalogue/app.js — the Catalogue: the hub as a reading room.
 *
 * Every game at once, as a record. The query text in the address is the one
 * source of truth: the chips, the facets, the figures, the summary and the
 * ledger are all read off it, and anything clicked writes back into it, so
 * every state of the desk is a link you can send someone. The cursor row is
 * in the address too (#/g/<slug>), which is how a link opens on a record.
 *
 * Wide screens get three panes: facets, the desk (figures over the ledger),
 * and the spec sheet. Narrower ones get one column, with the facets in a
 * sheet, the figures behind a toggle, and a record opening as a page of its
 * own that Back closes.
 */

import { h } from '../dom.js';
import { loadLibrary } from '../library.js';
import { store } from '../store.js';
import { router } from '../router.js';
import { plural } from '../format.js';
import { createPlayer } from '../ui/player.js';
import { viewSwitch } from '../ui/views.js';
import { accountButton } from '../account/button.js';
import {
  FIELDS,
  brush,
  contextOf,
  dayToken,
  isFiltering,
  parse,
  select,
  setField,
  sizeToken,
  toggleTerm,
  valuesOf,
  withoutTerm,
} from './query.js';
import { facetTerm, summarise, tallyDays, tallyFacets, tallySizes } from './tally.js';
import { groupRecords, nextSort, readGroup, readSort, sortRecords, writeSort } from './order.js';
import { toCSV, toMarkdown } from './export.js';
import { vocabularyOf } from './suggest.js';
import { createQueryBar } from './querybar.js';
import { createFacets } from './facets.js';
import { createFigures } from './figures.js';
import { createLedger } from './ledger.js';
import { createSheet } from './sheet.js';
import { createCompare } from './compare.js';
import { createSummary } from './summary.js';
import { createToolbar } from './toolbar.js';

const $ = (id) => document.getElementById(id);
const root = document.body;
const panes = ['masthead', 'summary', 'facets', 'desk', 'sheet'].map($);

$('views').append(viewSwitch('catalogue'), accountButton());

/** Wide enough for three panes; below it, records open as pages. */
const wide = matchMedia('(min-width: 1200px)');

/* --- what this device remembers about the desk ----------------------------- */

const prefs = () => ({ density: 'compact', figures: true, ...(store.ui().catalogue || {}) });
const setPrefs = (patch) => store.setUi({ catalogue: { ...prefs(), ...patch } });
/** On a phone the figures start hidden and are not remembered: they cost a screen. */
let narrowFigures = false;
const figuresOn = () => (wide.matches ? prefs().figures : narrowFigures);

/* --- state ------------------------------------------------------------------ */

let library = [];
let bySlug = new Map();
let parsed = parse('');
let selection = [];
let listed = [];
let sort = readSort(null);
let groupKey = '';
let listKey = '';
let device = 0;
let cursor = null;
/** The record the sheet shows; undefined until it has shown anything, even the colophon. */
let shown;
let marks = new Set();
let comparing = [];
let pushed = { record: false, compare: false, play: false };
let ui = null;

const MAX_MARKS = 4;

const context = () =>
  contextOf({
    now: Date.now(),
    isFave: store.isFave,
    isPlayed: (slug) => store.lastPlayed(slug) > 0 || store.plays(slug) > 0,
  });

const currentPath = () => (cursor ? `/g/${cursor}` : '/');

/** Write the query. The text is kept exactly as typed, trailing space and all. */
const writeQuery = (text) => router.setQuery({ q: text });

/* --- small affordances ------------------------------------------------------ */

let toastTimer = 0;
function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 2800);
}

let countTimer = 0;
/** Tell a screen reader how many records the query leaves, once typing pauses. */
function announceCount(n) {
  clearTimeout(countTimer);
  countTimer = setTimeout(() => {
    $('announce').textContent = `${plural(n, 'record')}`;
  }, 700);
}

async function copyText(text, done) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = h('textarea', { class: 'visually-hidden', readonly: true });
    area.value = text;
    document.body.append(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
  toast(done);
}

const recordLink = (game) => `${location.origin}/catalogue#/g/${game.slug}`;

/* --- the desk ---------------------------------------------------------------- */

function emptyNote() {
  const last = parsed.terms.filter((term) => !term.incomplete).at(-1);
  return h(
    'div',
    { class: 'void' },
    h('p', { class: 'void__title' }, 'No records match'),
    h('p', { class: 'void__query' }, h('code', {}, parsed.text.trim())),
    h(
      'div',
      { class: 'void__actions' },
      h(
        'button',
        { type: 'button', class: 'btn btn--play', onclick: () => writeQuery('') },
        h('span', { class: 'btn__text' }, 'Clear the query')
      ),
      last &&
        parsed.terms.filter((term) => !term.incomplete).length > 1 &&
        h(
          'button',
          { type: 'button', class: 'btn btn--quiet', onclick: () => writeQuery(withoutTerm(parsed.text, last)) },
          h('span', { class: 'btn__text' }, `Drop ${last.raw}`)
        )
    )
  );
}

function renderToolbar() {
  ui.toolbar.render({
    figuresOn: figuresOn(),
    groupKey,
    densityKey: prefs().density,
    sortValue: writeSort(sort) || 'name',
    markCount: marks.size,
    filterCount: parsed.terms.filter((term) => !term.incomplete && !term.problem).length,
  });
}

function renderDesk() {
  const c = context();
  ui.query.render(parsed, {
    onRemove: (term) => {
      writeQuery(withoutTerm(parsed.text, term));
      ui.query.focus();
    },
    onClear: () => {
      writeQuery('');
      ui.query.focus();
    },
  });
  // The accent means "in your selection", so it only appears once there is one.
  root.classList.toggle('is-querying', isFiltering(parsed));
  ui.facets.render(tallyFacets(library, parsed, c, { selection }), { filtering: isFiltering(parsed) });
  const positive = (field) => parsed.groups.fields.get(field)?.any || [];
  if (figuresOn()) {
    ui.figures.render({
      ...tallyDays(library, parsed, c, { selection }),
      ...tallySizes(library, parsed, c, { selection }),
      added: positive('added'),
      size: positive('size'),
      now: c.now,
    });
  }
  const origin = positive('origin');
  ui.summary.render(summarise(selection), {
    total: library.length,
    origin: origin.length === 1 ? origin[0].key.split(':')[1] : '',
  });
  ui.ledger.render(listed, groupRecords(listed, groupKey, { sort, library }), {
    sort,
    max: Math.max(0, ...listed.map((game) => game.bytes || 0)),
    description: `${plural(listed.length, 'record')}, sorted by ${sort.key}${sort.dir < 0 ? ', descending' : ''}`,
    empty: emptyNote,
  });
  ui.ledger.setCursor(cursor);
  $('done').textContent = listed.length ? `Show ${plural(listed.length, 'record')}` : 'No records match';
  renderToolbar();
  announceCount(listed.length);
}

/** Work the selection out again, but only when something it depends on moved. */
function recompute(query) {
  const text = query.get('q') || '';
  const nextSortValue = readSort(query.get('sort'));
  const nextGroup = readGroup(query.get('group'));
  // Favourites and plays only matter to a query that asks about them.
  const key = JSON.stringify([text, nextSortValue, nextGroup, asksDevice(text) ? device : 0]);
  if (key === listKey) return;
  listKey = key;
  parsed = parse(text);
  sort = nextSortValue;
  groupKey = nextGroup;
  selection = select(library, parsed, context());
  listed = sortRecords(selection, sort);
  renderDesk();
}

const asksDevice = (text) => /\bis:/i.test(text);

/** Redraw the desk even though the address has not moved. */
function refresh() {
  listKey = '';
  recompute(router.current().query);
}

/* --- the cursor and the sheet ------------------------------------------------- */

let sheetTimer = 0;
let sheetAt = 0;

/** Holding an arrow moves the cursor every frame; the sheet follows at a calmer pace. */
function showRecord(game) {
  clearTimeout(sheetTimer);
  if (shown === game) return;
  const draw = () => {
    sheetAt = performance.now();
    shown = game;
    if (game) ui.sheet.show(game);
    else ui.sheet.colophon(colophonFacts());
  };
  if (performance.now() - sheetAt > 140) draw();
  else sheetTimer = setTimeout(draw, 140);
}

const colophonFacts = () => ({
  total: library.length,
  compiled: Date.parse(ui.manifest.generatedAt) || Date.now(),
  bytes: library.reduce((n, game) => n + (game.bytes || 0), 0),
});

/** Open a record: the cursor on a wide screen, a page on a narrow one. */
function openRecord(slug, { focus = false } = {}) {
  if (!bySlug.has(slug)) return;
  pendingFocus = focus;
  if (wide.matches) router.go(`/g/${slug}`, { replace: true });
  else {
    pushed.record = !cursor;
    router.go(`/g/${slug}`, { replace: Boolean(cursor) });
  }
}

let pendingFocus = false;
let firstRoute = true;

/** Move the cursor by `delta` rows; ±Infinity is the top or the bottom. */
function step(delta) {
  const order = ui.ledger.order();
  if (!order.length) return;
  const at = cursor ? order.indexOf(cursor) : -1;
  const last = order.length - 1;
  let next;
  if (delta === Infinity) next = last;
  else if (delta === -Infinity) next = 0;
  else if (at === -1) next = delta > 0 ? 0 : last;
  else next = Math.min(last, Math.max(0, at + delta));
  openRecord(order[next], { focus: true });
}

/** From the query bar into the ledger: onto the cursor row, or the first. */
function enterLedger() {
  if (cursor && ui.ledger.row(cursor)) ui.ledger.setCursor(cursor, { scroll: true, focus: true });
  else step(1);
}

function leaveRecord() {
  if (pushed.record && cursor) {
    pushed.record = false;
    history.back();
  } else router.go('/', { replace: true });
}

/* --- marks and compare ------------------------------------------------------------ */

function toggleMark(slug) {
  if (marks.has(slug)) marks.delete(slug);
  else if (marks.size >= MAX_MARKS) toast('Compare takes up to four records. Unmark one first.');
  else marks.add(slug);
  ui.ledger.setMarks(marks);
  ui.sheet.refresh();
  renderToolbar();
}

function clearMarks() {
  marks.clear();
  ui.ledger.setMarks(marks);
  ui.sheet.refresh();
  renderToolbar();
}

function openCompare() {
  if (marks.size < 2) return;
  const query = new URLSearchParams(router.current().query);
  query.set('cmp', [...marks].join(','));
  pushed.compare = true;
  router.go(currentPath(), { query });
}

function closeCompare() {
  if (pushed.compare) {
    pushed.compare = false;
    history.back();
  } else router.setQuery({ cmp: '' });
}

function removeFromCompare(slug) {
  marks.delete(slug);
  const rest = comparing.filter((other) => other !== slug);
  if (rest.length < 2) closeCompare();
  else router.setQuery({ cmp: rest.join(',') });
}

/* --- playing -------------------------------------------------------------------- */

let player;

function play(slug, build) {
  const game = bySlug.get(slug);
  if (!game) return;
  const chosen = build && build !== game.builds[0] ? `/${build.version || build.id}` : '';
  pushed.play = true;
  router.go(`/play/${slug}${chosen}`);
}

const findBuild = (game, token) =>
  (token && game.builds.find((b) => b.version === token || b.id === token)) ||
  game.builds[0] || { id: 'page', path: game.path };

const thumbOf = (slug) => ui.ledger.row(slug)?.querySelector('.ledger__thumb') || null;

function openPlayer(route) {
  const game = bySlug.get(route.slug);
  const build = findBuild(game, route.build);
  if (player.isOpen() && player.current()?.slug === game.slug && player.currentBuild()?.id === build.id) return;
  ui.query.closeHelp();
  player.open(game, build, { fromTile: player.isOpen() ? null : thumbOf(game.slug) });
}

function closePlayer() {
  const slug = player.current()?.slug;
  player.close({ toTile: thumbOf(slug) });
  pushed.play = false;
  // Back where you were, once the address has settled: on the cursor row,
  // or on the record's own Play button.
  requestAnimationFrame(() => {
    if (comparing.length >= 2) ui.compare.focus();
    else if (wide.matches && cursor && ui.ledger.row(cursor))
      ui.ledger.setCursor(cursor, { scroll: true, focus: true });
    else if (cursor) ui.sheet.focusPlay();
    else ui.ledger.focusEntry();
  });
}

/* --- the address ---------------------------------------------------------------- */

function setInert(open) {
  for (const pane of panes) pane.inert = Boolean(open) && pane !== open;
}

function onRoute(route) {
  if ((route.name === 'detail' || route.name === 'play') && !bySlug.has(route.slug)) {
    router.go('/', { replace: true });
    return;
  }
  recompute(route.query);

  if (route.name === 'play') {
    cursor = route.slug;
    ui.ledger.setCursor(cursor);
    showRecord(bySlug.get(cursor));
    openPlayer(route);
    return;
  }
  if (player.isOpen()) closePlayer();

  const slug = route.name === 'detail' ? route.slug : null;
  const moved = slug !== cursor;
  cursor = slug;
  // A link that opens on a record puts that row in the middle of the desk.
  ui.ledger.setCursor(cursor, { scroll: moved && wide.matches, focus: pendingFocus, centre: firstRoute });
  pendingFocus = false;
  firstRoute = false;
  showRecord(slug ? bySlug.get(slug) : null);

  const reading = Boolean(slug) && !wide.matches;
  root.classList.toggle('is-reading', reading);
  if (!slug) pushed.record = false;

  const asked = [...new Set((route.query.get('cmp') || '').split(',').filter((s) => bySlug.has(s)))].slice(
    0,
    MAX_MARKS
  );
  const wasComparing = comparing.length >= 2;
  if (asked.length >= 2) {
    const changed = asked.join() !== comparing.join();
    comparing = asked;
    if (changed) {
      marks = new Set(comparing);
      ui.ledger.setMarks(marks);
      ui.compare.show(
        comparing.map((s) => bySlug.get(s)),
        timeline()
      );
      if (!wasComparing) $('scroll').scrollTop = 0;
      renderToolbar();
    }
    root.classList.add('is-comparing');
    // Opened from here, focus follows; arriving by a link, it stays put.
    if (!wasComparing && pushed.compare) ui.compare.focus();
  } else if (wasComparing) {
    comparing = [];
    ui.compare.hide();
    root.classList.remove('is-comparing');
    pushed.compare = false;
    ui.ledger.focusEntry();
  }
  setInert(root.classList.contains('is-filtering') ? $('facets') : reading ? $('sheet') : null);
}

const timeline = () => {
  const dates = library.map((game) => game.addedAt).filter(Boolean);
  return { from: Math.min(...dates), to: Math.max(...dates) };
};

/* --- the filters sheet, on a narrow screen ------------------------------------------ */

function openFilters() {
  root.classList.add('is-filtering');
  setInert($('facets'));
  $('facets').querySelector('.facet .bar')?.focus();
}

function closeFilters() {
  root.classList.remove('is-filtering');
  setInert(null);
  document.querySelector('.tool--filters')?.focus();
}

/* --- keys ------------------------------------------------------------------------- */

const typing = (el) =>
  Boolean(el) &&
  (el.isContentEditable ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    (el.tagName === 'INPUT' && !['checkbox', 'radio', 'button'].includes(el.type)));

/** Where the record keys apply: nothing focused, or the ledger's own cursor link. */
const onLedger = (el) => !el || el === document.body || el.classList?.contains('ledger__name');

let lastG = 0;

function onKey(event) {
  if (!ui || player.isOpen() || event.defaultPrevented) return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const target = event.target;
  const { key } = event;

  if (key === 'Escape') {
    if (ui.query.helpOpen()) ui.query.closeHelp();
    else if (root.classList.contains('is-filtering')) closeFilters();
    else if (comparing.length >= 2) closeCompare();
    else if (ui.query.isFocused()) ui.query.blur();
    else if (root.classList.contains('is-reading')) leaveRecord();
    else if (marks.size) clearMarks();
    else return;
    event.preventDefault();
    return;
  }
  if (typing(target)) return;
  if (key === '/' || key === '?') {
    event.preventDefault();
    if (key === '?') ui.query.toggleHelp();
    else ui.query.focus();
    return;
  }
  // The filters sheet and the comparison are views of their own: Escape leaves them.
  if (root.classList.contains('is-filtering') || comparing.length >= 2) return;

  const game = cursor && bySlug.get(cursor);
  const inLedger = onLedger(target) || ui.ledger.contains(target);
  switch (key) {
    case 'ArrowDown':
    case 'ArrowUp':
      if (!inLedger) return;
      step(key === 'ArrowDown' ? 1 : -1);
      break;
    case 'j':
    case 'k':
      step(key === 'j' ? 1 : -1);
      break;
    case 'Home':
    case 'End':
      if (!inLedger) return;
      step(key === 'Home' ? -Infinity : Infinity);
      break;
    case 'PageDown':
    case 'PageUp':
      if (!inLedger) return;
      step(key === 'PageDown' ? 10 : -10);
      break;
    case 'g':
      if (performance.now() - lastG < 700) {
        lastG = 0;
        step(-Infinity);
      } else lastG = performance.now();
      break;
    case 'G':
      step(Infinity);
      break;
    case 'Enter':
      if (!game || !onLedger(target)) return;
      play(game.slug);
      break;
    case ' ':
      if (!game || !onLedger(target)) return;
      toggleMark(game.slug);
      break;
    case 'f':
      if (!game) return;
      store.toggleFave(game.slug);
      break;
    case 'o':
      if (!game) return;
      window.open(findBuild(game).path, '_blank', 'noopener');
      break;
    case 'c':
      if (marks.size < 2) return;
      openCompare();
      break;
    default:
      return;
  }
  event.preventDefault();
}

/* --- go ----------------------------------------------------------------------------- */

function build(manifest) {
  const vocabulary = vocabularyOf(library);
  // Accession numbers: the order every game, hidden ones too, joined the
  // catalogue, so a record keeps its number whatever is showing.
  const accession = new Map(
    [...manifest.games]
      .sort((a, b) => a.addedAt - b.addedAt || (a.slug < b.slug ? -1 : 1))
      .map((game, i) => [game.slug, i + 1])
  );
  const values = new Map();
  const termFor = (field, value) => {
    if (!values.has(field)) {
      const read = FIELDS[field].read;
      values.set(field, [...new Set(library.flatMap((game) => valuesOf(read(game))))]);
    }
    return facetTerm({ field }, value, values.get(field));
  };

  ui = { manifest };
  ui.query = createQueryBar($('query'), { vocabulary, onInput: writeQuery, onLeave: enterLedger });
  ui.facets = createFacets($('facets-body'), {
    onToggle: (term) => writeQuery(toggleTerm(parsed.text, term)),
    onClearField: (field) => writeQuery(setField(parsed.text, field, '')),
    onClearAll: () => writeQuery(''),
  });
  ui.figures = createFigures($('figures'), {
    onPick(field, a, b, { extend }) {
      const written =
        field === 'added'
          ? a === b
            ? `added:${dayToken(a.start)}`
            : `added:${dayToken(a.start)}..${dayToken(b.start)}`
          : `size:${sizeToken(a.lo)}..${sizeToken(b.hi)}`;
      writeQuery(extend ? toggleTerm(parsed.text, written) : brush(parsed.text, field, written));
    },
    onClear: (field) => writeQuery(setField(parsed.text, field, '')),
  });
  ui.summary = createSummary($('summary'), {
    onOrigin: (origin) => writeQuery(brush(parsed.text, 'origin', `origin:${origin}`)),
    onSelect: (slug) => openRecord(slug),
    onQuery: (term) => writeQuery(toggleTerm(parsed.text, term)),
  });
  ui.toolbar = createToolbar($('toolbar'), {
    onFigures() {
      if (wide.matches) setPrefs({ figures: !prefs().figures });
      else narrowFigures = !narrowFigures;
      applyPrefs();
      refresh();
    },
    onGroup: (key) => router.setQuery({ group: key }),
    onDensity: (density) => {
      setPrefs({ density });
      applyPrefs();
    },
    onSort: (value) => router.setQuery({ sort: writeSort(readSort(value)) }),
    onFilters: openFilters,
    onCompare: openCompare,
    onClearMarks: clearMarks,
    onCSV() {
      const blob = new Blob([toCSV(listed, { isFave: store.isFave })], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = h('a', { href: url, download: `ai-hub-catalogue-${dayToken(Date.now())}.csv`, hidden: true });
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast(`Downloaded ${plural(listed.length, 'record')} as CSV`);
    },
    onMarkdown: () =>
      copyText(
        toMarkdown(listed, { link: recordLink }),
        `Copied ${plural(listed.length, 'record')} as a Markdown table`
      ),
  });
  ui.ledger = createLedger($('records'), {
    onSort: (key) => router.setQuery({ sort: writeSort(nextSort(sort, key)) }),
    onOpen: (slug) => openRecord(slug, { focus: true }),
    onPlay: play,
    onFave: (slug) => store.toggleFave(slug),
    onMark: toggleMark,
  });
  ui.sheet = createSheet($('sheet'), {
    library,
    accession,
    termFor,
    isFave: store.isFave,
    isMarked: (slug) => marks.has(slug),
    onPlay: play,
    onFave: (slug) => store.toggleFave(slug),
    onMark: toggleMark,
    onSelect: (slug) => openRecord(slug),
    onQuery: (term) => writeQuery(toggleTerm(parsed.text, term)),
    onCopy: (game) => copyText(recordLink(game), `Copied the link to ${game.name}`),
    onBack: leaveRecord,
    onStart: () => step(1),
  });
  ui.compare = createCompare($('compare'), {
    onPlay: play,
    onRemove: removeFromCompare,
    onClose: closeCompare,
    onSelect: (slug) => openRecord(slug),
  });

  $('done').addEventListener('click', closeFilters);
  $('colophon').textContent = `${plural(library.length, 'record')} · compiled ${new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(Date.parse(manifest.generatedAt) || Date.now())}`;
}

function applyPrefs() {
  root.dataset.density = prefs().density;
  $('figures').hidden = !figuresOn();
}

player = createPlayer($('player'), {
  backLabel: 'Back to the catalogue',
  onExit: () => (pushed.play ? history.back() : router.go(`/g/${player.current()?.slug}`, { replace: true })),
  // Another game from what the ledger lists, never the one already up.
  onRoll() {
    const current = player.current()?.slug;
    const pool = listed.filter((game) => game.slug !== current);
    if (pool.length) router.go(`/play/${pool[Math.floor(Math.random() * pool.length)].slug}`, { replace: true });
  },
});

addEventListener('keydown', onKey);

loadLibrary()
  .then(({ manifest, games }) => {
    library = games;
    bySlug = new Map(games.map((game) => [game.slug, game]));
    if (!games.length) {
      $('records').replaceChildren(
        h('p', { class: 'desk__status' }, 'No games yet. Drop an .html file into games/ and refresh.')
      );
      return;
    }
    build(manifest);
    applyPrefs();
    ui.ledger.setFaves(store.isFave);
    store.subscribe(() => {
      device++;
      ui.ledger.setFaves(store.isFave);
      ui.sheet.refresh();
      if (asksDevice(parsed.text)) refresh();
    });
    wide.addEventListener('change', () => {
      // The filters sheet is a narrow screen's; a wide one shows the panel.
      if (wide.matches) root.classList.remove('is-filtering');
      applyPrefs();
      listKey = '';
      onRoute(router.current());
    });
    router.subscribe(onRoute);
    router.start();
    root.classList.add('is-ready');
  })
  .catch((error) => {
    console.error(error);
    $('records').replaceChildren(
      h(
        'p',
        { class: 'desk__status' },
        "Couldn't load the catalogue. Run ",
        h('code', {}, 'pnpm scan'),
        ' to rebuild data/games.json, then refresh.'
      )
    );
  });
