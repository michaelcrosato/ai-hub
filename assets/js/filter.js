/**
 * filter.js — pure search, facet and sort logic. No DOM, no storage, so it can
 * be tested directly under `node --test`.
 *
 * `stats` is the small read-only view of your device history the sorts need:
 * { isFave(slug), plays(slug), lastPlayed(slug) }.
 */

import { matchesFacet, fold } from './manifest.js';

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
    (game) => (!state.favesOnly || stats.isFave(game.slug)) && (!tokens.length || hasAllTokens(game, tokens))
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
