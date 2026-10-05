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
  'frames', 'frameLabel',
  'icon', 'themeColor', 'version', 'added', 'updated', 'bytes', 'buildCount',
  'builds', 'lang', 'file', 'id', 'label', 'hub', 'hidden', 'addedAt', 'updatedAt',
  // `type` has its own control — the shelf buttons — and `restricted` is a
  // switch, not something to browse by.
  'type', 'restricted',
  // Reserved by the router's query string: a facet may not shadow these.
  'q', 'sort', 'fav', 'shelf', 'origin',
  // Worked out here, below, rather than catalogued.
  'lineage', 'rails',
]);

/** Fields that are searched and listed in the drawer but get no rail: the
 *  Source rail and the stacks on the wall take `source` and `series`, and
 *  which harness built a game is not something anyone browses by. */
const NO_RAIL = new Set(['source', 'series', 'harness']);

/** What a game with no `source` riffs on: nothing, it is its own idea. */
export const ORIGINAL = 'Original';

export const SINGLE = 'Single player';
export const MULTI = 'Multiplayer';
/** "4 players": a head count, a closer look at Multiplayer. */
const SEATS = /^\d+ players$/;
/** Past this a head count names a crowd, not a choice anyone makes. */
const MOST_SEATS = 12;

const KB = 1024;
const MB = 1024 * KB;
const SIZES = [
  { under: 250 * KB, label: 'Under 250 KB' },
  { under: 1 * MB, label: '250 KB–1 MB' },
  { under: 4 * MB, label: '1–4 MB' },
  { under: Infinity, label: 'Over 4 MB' },
];

/**
 * Who a game is for, read off its `players` ("1–4"): alone, together, and,
 * for together, every head count it seats, so a party of three finds what
 * fits. A game that says nothing is for one: that is what nearly every game
 * dropped in is. A tool or demo that says nothing is not for players at all.
 */
export function playersOf(game) {
  const [low, high = low] = (String(game.players ?? '').match(/\d+/g) || []).map(Number);
  if (!low) return !game.type || game.type === 'Game' ? [SINGLE] : [];
  const out = low === 1 ? [SINGLE] : [];
  if (high > 1) out.push(MULTI);
  for (let n = Math.max(2, low); n <= Math.min(high, MOST_SEATS); n++) out.push(`${n} players`);
  return out;
}

/** The bracket a file's size falls in. */
export const sizeOf = (bytes) => SIZES.find((size) => bytes < size.under).label;

/** Rails read through a lens rather than as written. The fields themselves
 *  stay as they are, for the drawer and the search. */
const LENSES = {
  players: playersOf,
  fileSize: (game) => (game.bytes > 0 ? [sizeOf(game.bytes)] : []),
};

/** Rails that read in their own order, smallest first, rather than most
 *  common first. Values a scale does not list follow it, in natural order. */
const SCALES = {
  players: [SINGLE, MULTI],
  fileSize: SIZES.map((size) => size.label),
};

/** Options that open from another option instead of sitting on the rail. */
const UNDER = {
  players: (value) => (SEATS.test(value) ? MULTI : null),
};

/** Rails that exist are still found, never declared; these few just go first
 *  when they do, because they are how people actually browse. A field nobody
 *  fills in simply never shows up. */
const LEAD = ['genre', 'collection', 'players'];

/** A rail needs at least this many distinct values, and this many games covered. */
const MIN_VALUES = 2;
const MIN_COVERAGE = 2;
/** Past a handful of values, a field whose values are nearly all different — a
 *  build id, an author URL — narrows nothing. It is searchable, never a rail. */
const SMALL_RAIL = 8;
const MAX_UNIQUE_SHARE = 0.6;

/** Lowercase and accent-free, so "pokemon" finds "Pokémon". */
export const fold = (text) =>
  String(text ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/**
 * Everything a search should reach: the name and blurb, plus every field that
 * classifies the game — model, collection, tags, or any field invented later.
 */
function haystack(game) {
  const parts = [game.name, game.tagline, game.description, game.slug];
  for (const [key, value] of Object.entries(game)) {
    if (NOT_A_FACET.has(key)) continue;
    for (const v of Array.isArray(value) ? value : [value]) {
      if (typeof v === 'string') parts.push(v);
    }
  }
  return fold(parts.filter(Boolean).join(' '));
}

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

export function normalize(game) {
  const out = {
    ...game,
    name: game.name || game.slug,
    tagline: game.tagline || '',
    description: game.description || '',
    tags: Array.isArray(game.tags) ? game.tags : game.tags ? [String(game.tags)] : [],
    builds: Array.isArray(game.builds) ? game.builds : [],
    buildCount: game.buildCount || (game.builds ? game.builds.length : 1),
    bytes: Number(game.bytes) || 0,
    addedAt: Date.parse(game.added) || 0,
    updatedAt: Date.parse(game.updated || game.added) || 0,
  };
  out.lineage = lineageOf(out);
  out.rails = railsOf(out);
  out.search = haystack(out);
  return out;
}

/**
 * What a game puts on each rail, worked out once: every field that
 * classifies it, as trimmed strings, plus the ones read through a lens.
 */
function railsOf(game) {
  const rails = {};
  for (const [key, value] of Object.entries(game)) {
    if (NOT_A_FACET.has(key) || NO_RAIL.has(key) || key in LENSES) continue;
    const values = (Array.isArray(value) ? value : [value])
      .filter((v) => typeof v === 'string')
      .map((v) => v.trim())
      .filter(Boolean);
    if (values.length) rails[key] = values;
  }
  for (const [key, read] of Object.entries(LENSES)) {
    const values = read(game);
    if (values.length) rails[key] = values;
  }
  return rails;
}

/** Same text for grouping: case, accents and spacing never split a stack. */
export const sameKey = (text) => fold(text).replace(/\s+/g, ' ').trim();

/**
 * Where a game sits among the attempts at the same thing: original or
 * inspired, its series, then the one game it is an attempt at. An inspired
 * game is an attempt at its `source`, within the source's `series` (the
 * source itself when the catalogue names none). An original is an attempt at
 * itself, so originals sharing a name (six Stratas) stack, and a lone one
 * stands alone.
 */
export function lineageOf(game) {
  const source = typeof game.source === 'string' ? game.source.trim() : '';
  const series = typeof game.series === 'string' ? game.series.trim() : '';
  return {
    original: !source && !series,
    series: series || source || ORIGINAL,
    title: source || String(game.name ?? game.slug ?? '').trim(),
  };
}

/** The first step of the Source rail: 'original' or 'inspired'. */
export const originOf = (game) => (game.lineage.original ? 'original' : 'inspired');

/** "fileSize" reads "File size", in the sentence case the rest of the wall uses. */
const prettyLabel = (key) =>
  key
    .replace(/([a-z0-9])([A-Z])/g, (_, a, b) => `${a} ${b.toLowerCase()}`)
    .replace(/[-_]+/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());

const natural = (a, b) => a.value.localeCompare(b.value, 'en', { numeric: true });

/**
 * Every string-valued field carried by enough games becomes a rail, sorted by
 * how many games use it so the useful ones sit on the left.
 */
export function deriveFacets(games) {
  const counters = new Map();

  for (const game of games) {
    for (const [key, values] of Object.entries(game.rails)) {
      if (!counters.has(key)) counters.set(key, new Map());
      const counts = counters.get(key);
      for (const text of new Set(values)) counts.set(text, (counts.get(text) || 0) + 1);
    }
  }

  const facets = [];
  for (const [key, counts] of counters) {
    if (counts.size < MIN_VALUES) continue;
    const coverage = [...counts.values()].reduce((a, b) => a + b, 0);
    if (coverage < MIN_COVERAGE) continue;
    if (counts.size > SMALL_RAIL) {
      const shared = [...counts.values()].filter((n) => n > 1).length;
      if (!shared || counts.size / coverage > MAX_UNIQUE_SHARE) continue;
    }
    const scale = SCALES[key];
    const place = (option) => {
      const at = scale.indexOf(option.value);
      return at === -1 ? scale.length : at;
    };
    facets.push({
      key,
      label: prettyLabel(key),
      coverage,
      options: [...counts.entries()]
        .map(([value, count]) => {
          const under = UNDER[key]?.(value);
          return under ? { value, count, under } : { value, count };
        })
        // Natural order within a count, so "Batch 2" sits before "Batch 10".
        .sort(scale ? (a, b) => place(a) - place(b) || natural(a, b) : (a, b) => b.count - a.count || natural(a, b)),
    });
  }

  const rank = (key) => {
    const at = LEAD.indexOf(key);
    return at === -1 ? LEAD.length : at;
  };
  return facets.sort(
    (a, b) => rank(a.key) - rank(b.key) || b.coverage - a.coverage || a.label.localeCompare(b.label)
  );
}

/** True when a game puts `value` on the `key` rail. */
export const matchesFacet = (game, key, value) => Boolean(game.rails[key]?.includes(value));
