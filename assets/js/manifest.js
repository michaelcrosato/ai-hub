/**
 * manifest.js — load data/games.json and work out what the wall can filter by.
 *
 * The filter rails are never declared anywhere. They are read off whatever the
 * games actually carry, so the day you add `"engine": "three.js"` to a handful
 * of entries in data/overrides.json an Engine rail appears by itself, and the
 * day you stop it disappears again. That is the whole trick behind "auto-only
 * metadata now, room for more later".
 */

/** Fields that describe a specific game rather than classify it. Never a rail.
 *  The drawer reuses this to decide which fields are worth listing as facts. */
export const NOT_A_FACET = new Set([
  'slug', 'name', 'tagline', 'description', 'title', 'search', 'path', 'cover',
  'icon', 'themeColor', 'version', 'added', 'updated', 'bytes', 'buildCount',
  'builds', 'lang', 'file', 'id', 'label', 'hub', 'hidden',
  // Reserved by the router's query string: a facet may not shadow these.
  'q', 'sort', 'fav',
]);

/** A rail needs at least this many distinct values, and this many games covered. */
const MIN_VALUES = 2;
const MIN_COVERAGE = 2;

export async function loadManifest(url = '/data/games.json') {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) {
    throw new Error(`games.json responded ${response.status}`);
  }
  const data = await response.json();
  if (!data || !Array.isArray(data.games)) {
    throw new Error('games.json has no games array');
  }
  return {
    ...data,
    games: data.games.map(normalize),
  };
}

function normalize(game) {
  return {
    ...game,
    name: game.name || game.slug,
    tagline: game.tagline || '',
    description: game.description || '',
    tags: Array.isArray(game.tags) ? game.tags : game.tags ? [String(game.tags)] : [],
    builds: Array.isArray(game.builds) ? game.builds : [],
    buildCount: game.buildCount || (game.builds ? game.builds.length : 1),
    bytes: Number(game.bytes) || 0,
    search: game.search || `${game.name} ${game.tagline} ${game.description}`.toLowerCase(),
    addedAt: Date.parse(game.added) || 0,
    updatedAt: Date.parse(game.updated || game.added) || 0,
  };
}

const prettyLabel = (key) =>
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());

/**
 * Every string-valued field carried by enough games becomes a rail, sorted by
 * how many games use it so the useful ones sit on the left.
 */
export function deriveFacets(games) {
  const counters = new Map();

  for (const game of games) {
    for (const [key, value] of Object.entries(game)) {
      if (NOT_A_FACET.has(key)) continue;
      const values = Array.isArray(value) ? value : [value];
      for (const raw of values) {
        if (typeof raw !== 'string') continue;
        const text = raw.trim();
        if (!text) continue;
        if (!counters.has(key)) counters.set(key, new Map());
        const counts = counters.get(key);
        counts.set(text, (counts.get(text) || 0) + 1);
      }
    }
  }

  const facets = [];
  for (const [key, counts] of counters) {
    if (counts.size < MIN_VALUES) continue;
    const coverage = [...counts.values()].reduce((a, b) => a + b, 0);
    if (coverage < MIN_COVERAGE) continue;
    facets.push({
      key,
      label: prettyLabel(key),
      coverage,
      options: [...counts.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)),
    });
  }

  return facets.sort((a, b) => b.coverage - a.coverage || a.label.localeCompare(b.label));
}

/** True when a game carries `value` in `key`, whether that field is a string or a list. */
export function matchesFacet(game, key, value) {
  const held = game[key];
  if (Array.isArray(held)) return held.some((v) => String(v).trim() === value);
  return typeof held === 'string' && held.trim() === value;
}
