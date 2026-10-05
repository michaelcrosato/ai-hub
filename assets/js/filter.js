/**
 * filter.js — pure search, facet and sort logic. No DOM, no storage, so it can
 * be tested directly under `node --test`.
 *
 * `stats` is the small read-only view of your device history the sorts need:
 * { isFave(slug), plays(slug), lastPlayed(slug) }.
 */

import { matchesFacet, fold, sameKey, ORIGINAL } from './manifest.js';

const byName = (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });

export const SORTS = [
  { key: 'name', label: 'A to Z', compare: byName },
  { key: 'newest', label: 'Newest first', compare: (a, b) => b.addedAt - a.addedAt || byName(a, b) },
  { key: 'updated', label: 'Recently updated', compare: (a, b) => b.updatedAt - a.updatedAt || byName(a, b) },
  {
    key: 'played',
    label: 'Most played',
    compare: (a, b, s) => s.plays(b.slug) - s.plays(a.slug) || byName(a, b),
  },
  {
    key: 'recent',
    label: 'Recently played',
    compare: (a, b, s) => s.lastPlayed(b.slug) - s.lastPlayed(a.slug) || byName(a, b),
  },
  { key: 'biggest', label: 'Biggest first', compare: (a, b) => b.bytes - a.bytes || byName(a, b) },
];

export const DEFAULT_SORT = SORTS[0].key;

/**
 * The three shelves the wall is split into, by the catalogue's `type`. A game
 * nobody has catalogued is a game: that is what almost everything dropped
 * into games/ is.
 */
export const SHELVES = [
  { key: 'games', label: 'Games', noun: ['game', 'games'], holds: (type) => !type || type === 'Game' },
  { key: 'demos', label: 'Tech demos', noun: ['tech demo', 'tech demos'], holds: (type) => type === 'Tech demo' },
  {
    key: 'tools',
    label: 'Tools & websites',
    noun: ['tool or website', 'tools & websites'],
    holds: (type) => type === 'Tool' || type === 'Website',
  },
];

export const DEFAULT_SHELF = SHELVES[0].key;

export const shelfOf = (game) => (SHELVES.find((s) => s.holds(game.type)) || SHELVES[0]).key;

/** On the wall at all: restricted games only when dev settings ask for everything. */
export const isVisible = (game, showAll) => showAll || game.restricted !== true;

/** Visible and on the shelf being looked at. `state.shelf` of null means every shelf. */
const inScope = (game, state) =>
  isVisible(game, state.showAll) && (!state.shelf || shelfOf(game) === state.shelf);

/** Inside the series, and the one game in it, that the Source rail narrowed to. */
const inLineage = (game, state) =>
  (!state.series || sameKey(game.lineage.series) === sameKey(state.series)) &&
  (!state.source || sameKey(game.lineage.title) === sameKey(state.source));

export const tokenize = (query) => fold(query).split(/\s+/).filter(Boolean);

const hasAllTokens = (game, tokens) => tokens.every((t) => game.search.includes(t));

/** Name matches outrank blurb matches, so typing "orbit" surfaces Little Orbit first. */
function relevance(game, tokens) {
  const name = fold(game.name);
  let score = 0;
  for (const token of tokens) {
    if (name.startsWith(token)) score += 4;
    else if (name.includes(token)) score += 2;
  }
  return score;
}

function passesFacets(game, facets, skipKey) {
  for (const [key, values] of Object.entries(facets || {})) {
    if (key === skipKey || !values || !values.length) continue;
    if (!values.some((value) => matchesFacet(game, key, value))) return false;
  }
  return true;
}

export function selectGames(games, state, stats) {
  const tokens = tokenize(state.query);

  let out = games.filter(
    (game) =>
      inScope(game, state) &&
      inLineage(game, state) &&
      (!state.favesOnly || stats.isFave(game.slug)) &&
      passesFacets(game, state.facets) &&
      (!tokens.length || hasAllTokens(game, tokens))
  );

  const sorter = SORTS.find((s) => s.key === state.sort) || SORTS[0];
  out.sort((a, b) => sorter.compare(a, b, stats));

  // Stable, so the chosen sort still decides the order inside each relevance tier.
  if (tokens.length) out.sort((a, b) => relevance(b, tokens) - relevance(a, tokens));

  return out;
}

/**
 * How many games each facet option would yield. Counted against everything
 * *except* that facet, so the other choices in a rail you are already using
 * still show what selecting them instead would give you. One pass over the
 * games per rail, however many options the rail has.
 */
export function facetCounts(games, state, stats, facets) {
  const tokens = tokenize(state.query);
  const pool = games.filter(
    (game) =>
      inScope(game, state) &&
      inLineage(game, state) &&
      (!state.favesOnly || stats.isFave(game.slug)) &&
      (!tokens.length || hasAllTokens(game, tokens))
  );
  const counts = new Map();

  for (const facet of facets) {
    const inner = new Map(facet.options.map((option) => [option.value, 0]));
    for (const game of pool) {
      if (!passesFacets(game, state.facets, facet.key)) continue;
      const held = game[facet.key];
      const values = new Set((Array.isArray(held) ? held : [held]).map((v) => String(v ?? '').trim()));
      for (const value of values) if (inner.has(value)) inner.set(value, inner.get(value) + 1);
    }
    counts.set(facet.key, inner);
  }

  return counts;
}

const byCount = (a, b) => b.count - a.count || a.value.localeCompare(b.value, 'en', { numeric: true });

/** One option per distinct value, labelled the way the first game spells it. */
function tally(list, pick) {
  const by = new Map();
  for (const game of list) {
    const value = pick(game);
    const key = sameKey(value);
    if (!by.has(key)) by.set(key, { value, count: 0 });
    by.get(key).count += 1;
  }
  return [...by.values()].sort(byCount);
}

/**
 * The Source rail: every series and how many games it holds, then, once a
 * series is picked, every game inside it. Counted like the facet rails, against
 * everything except the rail's own choice, so the other series still say what
 * picking them instead would show.
 */
export function sourceCounts(games, state, stats) {
  const tokens = tokenize(state.query);
  const pool = games.filter(
    (game) =>
      inScope(game, state) &&
      (!state.favesOnly || stats.isFave(game.slug)) &&
      passesFacets(game, state.facets) &&
      (!tokens.length || hasAllTokens(game, tokens))
  );
  const series = tally(pool, (game) => game.lineage.series);
  const titles = state.series
    ? tally(
        pool.filter((game) => sameKey(game.lineage.series) === sameKey(state.series)),
        (game) => game.lineage.title
      )
    : [];
  return { series, titles };
}

/**
 * Fold the wall into stacks, one level of the Source rail at a time. With no
 * series picked, each series is one stack; originals have no series to share,
 * so they stack by name instead. Inside a series, each game it holds is a
 * stack. Inside one game, every attempt stands on its own.
 *
 * A stack of one is just that game, a series that holds a single game stacks
 * as that game, and a wall that would fold into one lone stack shows what is
 * in it instead. A stack takes the place of its first game, so the sort still
 * decides the order, except A to Z, which files a stack under its own name.
 */
export function stackGames(list, state) {
  if (state.source) return list;
  const original = sameKey(ORIGINAL);
  const groups = new Map();
  for (const game of list) {
    const level = !state.series && sameKey(game.lineage.series) !== original ? 'series' : 'title';
    const key = `${level}:${sameKey(game.lineage[level])}`;
    if (!groups.has(key)) groups.set(key, { level, games: [] });
    groups.get(key).games.push(game);
  }
  if (groups.size === 1) return list;

  const items = [...groups.values()].map(({ level, games }) => {
    if (games.length === 1) return games[0];
    const { series, title } = games[0].lineage;
    const titles = new Set(games.map((game) => sameKey(game.lineage.title))).size;
    const asTitle = level === 'title' || titles === 1;
    return {
      stack: true,
      level: asTitle ? 'title' : 'series',
      label: asTitle ? title : series,
      series,
      title: asTitle ? title : null,
      titles,
      games,
    };
  });

  if (state.sort === 'name' && !tokenize(state.query).length) {
    const label = (item) => (item.stack ? item.label : item.name);
    items.sort((a, b) => label(a).localeCompare(label(b), 'en', { sensitivity: 'base' }));
  }
  return items;
}
