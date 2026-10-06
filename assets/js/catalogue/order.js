/**
 * catalogue/order.js — the table's sorting and grouping, as data. Pure, so
 * the order of 373 rows is pinned down by tests rather than by eye.
 *
 * A sort is a column and a direction, written `added` or `-added` in the
 * address. Empty values (most games name no model) sink to the bottom
 * whichever way a column runs, and ties always fall back to the name, A to Z,
 * so one query always lists one way.
 */

import { playersOf, sameKey, SINGLE } from '../manifest.js';
import { DAY, buildsOf, dayText, valuesOf } from './query.js';

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

export const byName = (a, b) => collator.compare(a.name, b.name) || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);

/** The most players a game seats; a game for one sorts before a party game. */
function mostSeats(game) {
  const seats = playersOf(game).map((value) => (value === SINGLE ? 1 : Number.parseInt(value, 10) || 0));
  return seats.length ? Math.max(...seats) : null;
}

/** A field's first value: a game naming two models sorts and groups by the first, as on the Wall. */
const first = (value) => valuesOf(value)[0] ?? null;

/** The sortable columns, and what each one sorts by. */
export const COLUMNS = [
  { key: 'name', label: 'Name', value: (g) => g.name, text: true },
  { key: 'genre', label: 'Genre', value: (g) => first(g.genre), text: true },
  { key: 'lineage', label: 'Lineage', value: (g) => (g.lineage.original ? null : g.lineage.title), text: true },
  { key: 'model', label: 'Model', value: (g) => first(g.model), text: true },
  { key: 'players', label: 'Players', value: mostSeats },
  { key: 'size', label: 'Size', value: (g) => g.bytes || null },
  { key: 'added', label: 'Added', value: (g) => g.addedAt || null },
  { key: 'builds', label: 'Builds', value: buildsOf },
];

export const DEFAULT_SORT = { key: 'name', dir: 1 };

/** `-added` → newest first; anything unknown → A to Z. */
export function readSort(param) {
  const m = /^(-)?([a-z]+)$/.exec(param || '');
  return m && COLUMNS.some((column) => column.key === m[2]) ? { key: m[2], dir: m[1] ? -1 : 1 } : DEFAULT_SORT;
}

/** The address form, or nothing for the default. */
export const writeSort = ({ key, dir }) => (key === DEFAULT_SORT.key && dir === 1 ? '' : `${dir < 0 ? '-' : ''}${key}`);

/** A header click: a new column starts ascending, the same column turns round. */
export const nextSort = (sort, key) => (sort.key === key ? { key, dir: -sort.dir } : { key, dir: 1 });

const isEmpty = (value) => value == null || value === '';

export function sortRecords(list, { key, dir }) {
  const column = COLUMNS.find((c) => c.key === key) || COLUMNS[0];
  return list
    .map((game) => [game, column.value(game)])
    .sort(([a, x], [b, y]) => {
      if (isEmpty(x) || isEmpty(y)) return isEmpty(x) === isEmpty(y) ? byName(a, b) : isEmpty(x) ? 1 : -1;
      return (column.text ? collator.compare(x, y) : x - y) * dir || byName(a, b);
    })
    .map(([game]) => game);
}

/* --- groups ------------------------------------------------------------- */

export const GROUPS = [
  { key: '', label: 'None' },
  { key: 'genre', label: 'Genre' },
  { key: 'lineage', label: 'Lineage' },
  { key: 'model', label: 'Model' },
  { key: 'week', label: 'Week added' },
];

export const readGroup = (param) => (GROUPS.some((group) => group.key === param) ? param : '');

/** Monday of the UTC week a moment falls in. 1 January 1970 was a Thursday. */
export function weekOf(ms) {
  const day = Math.floor(ms / DAY);
  return (day - ((day + 3) % 7)) * DAY;
}

/**
 * How each grouping files a game: a key and a label, or null for the bucket
 * that collects everything without one. Lineage groups by series, but a
 * series the library holds only one attempt at would be a heading over a
 * single row, so those share one bucket at the end.
 */
const GROUPERS = {
  genre: () => ({ of: (g) => (first(g.genre) ? [sameKey(first(g.genre)), first(g.genre)] : null), rest: 'No genre' }),
  model: () => ({
    of: (g) => (first(g.model) ? [sameKey(first(g.model)), first(g.model)] : null),
    rest: 'No model named',
  }),
  lineage(library) {
    const counts = new Map();
    for (const game of library) {
      if (!game.lineage.original)
        counts.set(sameKey(game.lineage.series), (counts.get(sameKey(game.lineage.series)) || 0) + 1);
    }
    return {
      of(g) {
        if (g.lineage.original) return ['original', 'Original'];
        const key = sameKey(g.lineage.series);
        return counts.get(key) > 1 ? [`series:${key}`, g.lineage.series] : null;
      },
      rest: 'Other sources',
      // Originals have no lineage to sort by, so under that sort they sink to the end, as their rows do.
      sinks: (key) => key === 'original',
    };
  },
  week: () => ({
    of: (g) => (g.addedAt ? [weekOf(g.addedAt), `Week of ${dayText(weekOf(g.addedAt))}`] : null),
    rest: 'Undated',
    time: true,
  }),
};

/**
 * Fold sorted records into groups, each with its records in the same order
 * and its total size. Groups list biggest first, the catch-all last; weeks
 * newest first. Sorting by the grouped column itself orders the groups by
 * their labels instead, in the column's direction.
 */
export function groupRecords(sorted, groupKey, { sort = DEFAULT_SORT, library = sorted } = {}) {
  const grouper = GROUPERS[groupKey]?.(library);
  if (!grouper) return null;
  const groups = new Map();
  const rest = { key: 'rest', label: grouper.rest, games: [], bytes: 0, rest: true };
  for (const game of sorted) {
    const filed = grouper.of(game);
    let group = rest;
    if (filed) {
      const [key, label] = filed;
      if (!groups.has(key)) groups.set(key, { key, label, games: [], bytes: 0 });
      group = groups.get(key);
    }
    group.games.push(game);
    group.bytes += game.bytes || 0;
  }
  const list = [...groups.values()];
  const bySort = sort.key === groupKey;
  if (grouper.time) {
    const dir = sort.key === 'added' && sort.dir > 0 ? 1 : -1;
    list.sort((a, b) => (a.key - b.key) * dir);
  } else if (bySort) {
    list.sort((a, b) => collator.compare(a.label, b.label) * sort.dir);
  } else {
    list.sort((a, b) => b.games.length - a.games.length || collator.compare(a.label, b.label));
  }
  const sinking = bySort && grouper.sinks ? list.filter((group) => grouper.sinks(group.key)) : [];
  const floating = list.filter((group) => !sinking.includes(group));
  return [...floating, ...(rest.games.length ? [rest] : []), ...sinking];
}
