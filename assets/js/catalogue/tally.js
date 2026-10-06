/**
 * catalogue/tally.js — the counting behind the facets, the charts and the
 * summary strip. Pure: the library, a parsed query and a context in; numbers
 * out.
 *
 * Every bar in the Catalogue is drawn in three layers, so they all read alike:
 *   total     the whole library, the ghost behind
 *   other     what every filter except the bar's own field lets through
 *   selected  what the whole query selects: the only layer in colour
 * With nothing picked on a facet, other and selected are the same bar. Once a
 * value is picked, its neighbours keep showing what picking them instead (or
 * as well) would give, which is what makes the facets usable as a chart.
 */

import { playersOf, sameKey, MULTI, SINGLE } from '../manifest.js';
import { DAY, buildsOf, formatTerm, parse, select, sizeText, sizeToken, startsWord, valuesOf } from './query.js';

const KB = 1024;
const MB = KB * KB;
const GB = MB * KB;

/** The Wall's file-size brackets, written as the query terms that select them. */
export const SIZE_BRACKETS = [
  { label: 'Under 250 KB', term: 'size:<250kb' },
  { label: '250 KB–1 MB', term: 'size:250kb..1mb' },
  { label: '1–4 MB', term: 'size:1mb..4mb' },
  { label: 'Over 4 MB', term: 'size:>=4mb' },
];
const brackets = SIZE_BRACKETS.map((bracket) => ({ ...bracket, test: parse(bracket.term).terms[0].test }));
const bracketOf = (game) => brackets.find((bracket) => bracket.test(game))?.label;

const seatsTerm = (value) =>
  value === SINGLE ? 'players:single' : value === MULTI ? 'players:multi' : `players:${Number.parseInt(value, 10)}`;

/**
 * The facets, in the order the panel lists them. `values` is what a game puts
 * on the facet; `term` writes the query term for a value when the plain
 * `field:value` would not do. `order` pins a scale's order; the rest list by
 * how much of the library carries them, which stays put as the selection
 * changes, so a bar never jumps out from under the pointer.
 */
export const FACETS = [
  { field: 'type', label: 'Type', values: (g) => [g.type || 'Game'] },
  {
    field: 'origin',
    label: 'Origin',
    values: (g) => [g.lineage.original ? 'Original' : 'Inspired'],
    order: ['Original', 'Inspired'],
    term: (value) => `origin:${value.toLowerCase()}`,
  },
  { field: 'genre', label: 'Genre', values: (g) => valuesOf(g.genre) },
  { field: 'players', label: 'Players', values: playersOf, order: [SINGLE, MULTI], term: seatsTerm },
  { field: 'model', label: 'Model', values: (g) => valuesOf(g.model) },
  { field: 'series', label: 'Series', values: (g) => (g.lineage.original ? [] : [g.lineage.series]) },
  { field: 'tag', label: 'Tags', values: (g) => valuesOf(g.tags), limit: 24 },
  {
    field: 'size',
    label: 'Size',
    values: (g) => [bracketOf(g)].filter(Boolean),
    order: SIZE_BRACKETS.map((bracket) => bracket.label),
    term: (value) => SIZE_BRACKETS.find((bracket) => bracket.label === value).term,
  },
];

function countValues(games, values) {
  const counts = new Map();
  for (const game of games) {
    for (const value of new Set(values(game))) counts.set(value, (counts.get(value) || 0) + 1);
  }
  return counts;
}

const natural = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

/**
 * The term a facet value writes. Text fields match the start of any word, so
 * a value that starts a word of another value ("GPT-6" in "GPT-6 Astra Pro")
 * is written exact, or picking it would pick both.
 */
export function facetTerm(facet, value, vocabulary) {
  if (facet.term) return facet.term(value);
  const needle = sameKey(value);
  const clash = vocabulary.some((other) => other !== value && startsWord(sameKey(other), needle));
  return formatTerm(facet.field, value.toLowerCase(), { exact: clash });
}

/**
 * What never changes for a library: each facet's values, their totals, their
 * order, and the term and key each one writes. Worked out once, so a render
 * only counts.
 */
const shelves = new WeakMap();
function shelvesOf(library) {
  let shelf = shelves.get(library);
  if (shelf) return shelf;
  shelf = FACETS.map((facet) => {
    const totals = countValues(library, facet.values);
    const vocabulary = [...totals.keys()];
    const place = (value) => {
      const at = facet.order ? facet.order.indexOf(value) : -1;
      return at === -1 ? Infinity : at;
    };
    let options = vocabulary
      .map((value) => ({ value, total: totals.get(value) }))
      .sort((a, b) =>
        facet.order
          ? place(a.value) - place(b.value) || natural.compare(a.value, b.value)
          : b.total - a.total || natural.compare(a.value, b.value)
      );
    if (facet.limit) options = options.slice(0, facet.limit);
    for (const option of options) {
      option.term = facetTerm(facet, option.value, vocabulary);
      option.key = parse(option.term).terms[0].key;
    }
    return { facet, options, max: Math.max(1, ...options.map((option) => option.total)) };
  });
  shelves.set(library, shelf);
  return shelf;
}

/**
 * Every facet with its options counted in three layers. `pressed` says the
 * query already holds that value's own term (so clicking takes it out), and
 * `excluded` that it holds it negated.
 */
export function tallyFacets(library, parsed, ctx = {}, { selection = select(library, parsed, ctx) } = {}) {
  return shelvesOf(library).map(({ facet, options, max }) => {
    const own = parsed.groups.fields.get(facet.field);
    const pool = own ? select(library, parsed, ctx, { except: facet.field }) : selection;
    const others = countValues(pool, facet.values);
    const picked = own ? countValues(selection, facet.values) : others;
    return {
      field: facet.field,
      label: facet.label,
      max,
      filtered: Boolean(own),
      options: options.map((option) => ({
        ...option,
        other: others.get(option.value) || 0,
        selected: picked.get(option.value) || 0,
        pressed: Boolean(own?.any.some((term) => term.key === option.key)),
        excluded: Boolean(own?.none.some((term) => term.key === option.key)),
      })),
    };
  });
}

/* --- added over time ------------------------------------------------------ */

const dayOf = (game) => Math.floor(game.addedAt / DAY);

/**
 * One column per UTC day, from the first addition to the last, empty days
 * included, so the axis is honest about the gaps. Each day keeps its games,
 * for the tooltip that names them.
 */
export function tallyDays(library, parsed, ctx = {}, { selection = select(library, parsed, ctx) } = {}) {
  const dated = library.filter((game) => game.addedAt > 0);
  if (!dated.length) return { days: [], from: 0, to: 0 };
  let first = Infinity;
  let last = -Infinity;
  for (const game of dated) {
    first = Math.min(first, dayOf(game));
    last = Math.max(last, dayOf(game));
  }
  const days = Array.from({ length: last - first + 1 }, (_, i) => ({
    start: (first + i) * DAY,
    total: 0,
    other: 0,
    selected: 0,
    games: [],
    picked: [],
  }));
  const pool = parsed.groups.fields.has('added') ? select(library, parsed, ctx, { except: 'added' }) : selection;
  for (const game of dated) {
    const day = days[dayOf(game) - first];
    day.total++;
    day.games.push(game);
  }
  for (const game of pool) if (game.addedAt > 0) days[dayOf(game) - first].other++;
  for (const game of selection) {
    if (!(game.addedAt > 0)) continue;
    const day = days[dayOf(game) - first];
    day.selected++;
    day.picked.push(game);
  }
  return { days, from: first * DAY, to: (last + 1) * DAY };
}

/* --- file size ----------------------------------------------------------- */

const LADDER = [1, 2, 5, 10, 20, 50, 100, 200, 500];
const STEPS = [1, KB, MB, GB].flatMap((unit) => LADDER.map((m) => m * unit));

/**
 * Bin edges on a 1–2–5 ladder, from the step at or below the smallest file
 * to the first step above the largest: even on a log scale, and every edge a
 * round number someone would type.
 */
export function sizeEdges(min, max) {
  const lo = STEPS.findLast((step) => step <= min) ?? STEPS[0];
  const hi = STEPS.find((step) => step > max) ?? STEPS.at(-1);
  return STEPS.filter((step) => step >= lo && step <= hi);
}

/** A log-binned histogram of file size. Each bin carries the term that selects it. */
export function tallySizes(library, parsed, ctx = {}, { selection = select(library, parsed, ctx) } = {}) {
  const sized = library.filter((game) => game.bytes > 0);
  if (!sized.length) return { bins: [] };
  const edges = sizeEdges(Math.min(...sized.map((g) => g.bytes)), Math.max(...sized.map((g) => g.bytes)));
  const bins = edges.slice(0, -1).map((lo, i) => ({
    lo,
    hi: edges[i + 1],
    term: `size:${sizeToken(lo)}..${sizeToken(edges[i + 1])}`,
    label: `${sizeText(lo)}–${sizeText(edges[i + 1])}`,
    total: 0,
    other: 0,
    selected: 0,
  }));
  const binOf = (bytes) => bins.find((bin) => bytes >= bin.lo && bytes < bin.hi);
  const pool = parsed.groups.fields.has('size') ? select(library, parsed, ctx, { except: 'size' }) : selection;
  for (const game of sized) binOf(game.bytes).total++;
  for (const game of pool) if (game.bytes > 0) binOf(game.bytes).other++;
  for (const game of selection) if (game.bytes > 0) binOf(game.bytes).selected++;
  return { bins };
}

/* --- the summary strip ------------------------------------------------------ */

const byName = (a, b) => natural.compare(a.name, b.name);

/** The handful of numbers the strip leads with, for whatever is selected. */
export function summarise(selection) {
  let bytes = 0;
  let originals = 0;
  let several = 0;
  let modelRecords = 0;
  let newest = null;
  const models = new Map();
  const sizes = [];
  for (const game of selection) {
    bytes += game.bytes || 0;
    if (game.bytes > 0) sizes.push(game.bytes);
    if (game.lineage.original) originals++;
    if (buildsOf(game) > 1) several++;
    const named = valuesOf(game.model);
    if (named.length) modelRecords++;
    for (const model of named) models.set(model, (models.get(model) || 0) + 1);
    if (!newest || game.addedAt > newest.addedAt || (game.addedAt === newest.addedAt && byName(game, newest) < 0))
      newest = game;
  }
  sizes.sort((a, b) => a - b);
  const mid = sizes.length >> 1;
  return {
    count: selection.length,
    bytes,
    median: !sizes.length ? 0 : sizes.length % 2 ? sizes[mid] : (sizes[mid - 1] + sizes[mid]) / 2,
    originals,
    inspired: selection.length - originals,
    models: [...models]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || natural.compare(a.name, b.name)),
    modelRecords,
    newest,
    several,
  };
}
