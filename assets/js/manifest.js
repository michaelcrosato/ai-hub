/**
 * manifest.js — load data/games.json and work out what the wall can filter by.
 *
 * The filter rails are never declared anywhere. They are read off whatever the
 * games actually carry, so the day you add `"engine": "three.js"` to a handful
 * of entries in data/overrides.json an Engine rail appears by itself, and the
 * day you stop it disappears again. That is the whole trick behind "auto-only
 * metadata now, room for more later".
 */

import { modeOf } from '../../lib/hub/round.js';
import { t, lang, compare, fake, FAKE } from './lang.js';

/** Fields that describe a specific game rather than classify it. Never a rail.
 *  The drawer reuses this to decide which fields are worth listing as facts. */
export const NOT_A_FACET = new Set([
  'slug', 'name', 'plainName', 'tagline', 'description', 'title', 'search', 'path', 'cover',
  'frames', 'frameLabel', 'audioReview',
  'icon', 'themeColor', 'version', 'added', 'updated', 'sourceDate', 'bytes', 'buildCount',
  'builds', 'lang', 'file', 'id', 'label', 'hub', 'addedAt', 'updatedAt',
  // `type` has its own control — the shelf buttons — and `restricted` is a
  // switch, not something to browse by.
  'type', 'restricted',
  // Reserved by the router's query string: a facet may not shadow these.
  'q', 'sort', 'fav', 'shelf', 'origin',
  // Worked out here, below, rather than catalogued.
  'lineage', 'rails',
  // AI Hub session support: shown as one line (sessionOf), never as separate facts.
  'session', 'sessionPlayers', 'sessionMode', 'sessionMinutes', 'sessionGoal', 'sessionHowto', 'sessionNote', 'webgpu',
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
/** `label` is the value a game's file-size rail carries (data); `shown` is what players read. */
const SIZES = [
  { under: 250 * KB, label: 'Under 250 KB', shown: () => t('filter.filesize.under_250kb') },
  { under: 1 * MB, label: '250 KB–1 MB', shown: () => t('filter.filesize.250kb_1mb') },
  { under: 4 * MB, label: '1–4 MB', shown: () => t('filter.filesize.1_4mb') },
  { under: Infinity, label: 'Over 4 MB', shown: () => t('filter.filesize.over_4mb') },
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

/** The AI Hub Session Protocol versions this hub can run (lib/hub/README.md). */
export const SESSION_PROTOCOLS = [1];

/**
 * What a game says about playing it in an AI Hub session, read off its
 * hub:session metas: the protocol, the seats, the mode, the round length, how
 * to win and the controls, plus the one line the details show. Null for a
 * game that says nothing.
 */
export function sessionOf(game) {
  const version = Number(game.session);
  if (!Number.isInteger(version) || version < 1) return null;
  const [low, high = low] = (String(game.sessionPlayers ?? '').match(/\d+/g) || []).map(Number);
  const seats = low ? [low, high] : [2, 4];
  const mode = modeOf(game.sessionMode);
  const minutes = Number(game.sessionMinutes) > 0 ? Number(game.sessionMinutes) : null;
  const parts = [
    seats[0] === seats[1]
      ? t('game.session.seats', { count: seats[0] })
      : t('game.session.seat_range', { low: seats[0], high: seats[1] }),
  ];
  if (mode) parts.push(mode === 'parallel' ? t('session.mode.parallel') : mode === 'ghost' ? t('session.mode.ghost') : t('session.mode.shared_world'));
  if (minutes) parts.push(t('game.session.minutes', { minutes }));
  const line = (text, most) => String(text ?? '').trim().slice(0, most) || null;
  return {
    version,
    seats,
    mode,
    minutes,
    goal: line(shown(game, 'sessionGoal'), 60),
    howto: line(shown(game, 'sessionHowto'), 80),
    supported: SESSION_PROTOCOLS.includes(version),
    label: parts.join(' · '),
  };
}

/** The bracket a file's size falls in. */
export const sizeOf = (bytes) => SIZES.find((size) => bytes < size.under).label;

/**
 * What a rail's value reads as on screen. Values stay as they are in the data
 * (the address, the stacks and the filters compare them); only the words the
 * hub writes itself are translated: single player, multiplayer, a head count
 * and a size bracket; a genre and a tag read in the player's language when
 * the catalogue has a translation. A model shows as it is.
 */
export function valueLabel(key, value) {
  if (key === 'players') {
    if (value === SINGLE) return t('filter.players.single');
    if (value === MULTI) return t('filter.players.multi');
    if (SEATS.test(value)) return t('filter.players.seats', { count: Number.parseInt(value, 10) });
  }
  if (key === 'genre') return termName('genre', value);
  if (key === 'tags') return termName('tag', value);
  if (key === 'fileSize') return SIZES.find((size) => size.label === value)?.shown() ?? value;
  return value;
}

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

/**
 * Filters are still found, never declared; this only says the order the known
 * ones take. Genre and Players get boxes of their own on the toolbar; the rest
 * sit under Filters in this order, and a field invented tomorrow joins the end.
 */
const ORDER = ['genre', 'players', 'model', 'tags', 'fileSize', 'collection'];
const rankOf = (key) => (ORDER.includes(key) ? ORDER.indexOf(key) : ORDER.length);

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
 * The translation of the catalogue's own texts and terms for the chosen
 * language: data/lang/<code>.json. Game fields stay English data; only
 * display goes through shown() and termName(). Any part may be missing.
 */
let words = {};
const own = (o, k) => (o && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined);
const usable = (v) => (typeof v === 'string' && v.trim() !== '' ? v : null);

/** Sets the translation (anything that is not an object means none). */
export function setWords(data) {
  words = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
}

/**
 * A game's description, controls, goal or how-to as players read it: the
 * translation when there is a usable one, else the game's own text. Test
 * languages show the English made fake, so raw data stands out.
 */
export function shown(game, field) {
  const own_ = game?.[field];
  if (FAKE.includes(lang)) return typeof own_ === 'string' && own_ ? fake(own_) : own_;
  return usable(own(own(own(words, 'games'), game?.slug), field)) ?? own_;
}

/** A genre, type or tag as players read it ('genre' | 'type' | 'tag'); filters and URLs keep the value. */
export function termName(kind, value) {
  if (typeof value !== 'string' || !value) return value;
  if (FAKE.includes(lang)) return fake(value);
  return usable(own(own(own(words, 'terms'), kind), value)) ?? value;
}

/**
 * Everything a search should reach: the name and blurb, plus every field that
 * classifies the game — model, collection, tags, or any field invented later —
 * and the translated texts and terms, so players can search in their language.
 */
function haystack(game) {
  const parts = [game.name, game.tagline, game.description, game.slug];
  for (const [key, value] of Object.entries(game)) {
    if (NOT_A_FACET.has(key)) continue;
    for (const v of Array.isArray(value) ? value : [value]) {
      if (typeof v === 'string') parts.push(v);
    }
  }
  const mine = own(own(words, 'games'), game.slug);
  for (const field of ['description', 'controls', 'sessionGoal', 'sessionHowto', 'howto', 'goal']) parts.push(usable(own(mine, field)));
  for (const [kind, key] of [['genre', 'genre'], ['type', 'type'], ['tag', 'tags']]) {
    for (const v of [].concat(game[key] ?? [])) parts.push(usable(own(own(own(words, 'terms'), kind), v)));
  }
  return fold(parts.filter(Boolean).join(' '));
}

/** The translation file for the chosen language, next to the games file; none on any trouble. */
async function loadWords(url) {
  if (lang === 'en' || FAKE.includes(lang)) return {};
  try {
    const res = await fetch(new URL(`lang/${lang}.json`, new URL(url, globalThis.location?.href || 'http://localhost/')).href);
    return res.ok ? await res.json() : {};
  } catch {
    return {};
  }
}

export async function loadManifest(url = '/data/games.json') {
  const [response, translation] = await Promise.all([fetch(url, { cache: 'no-cache' }), loadWords(url)]);
  if (!response.ok) {
    throw new Error(t('filter.manifest.status', { status: response.status }));
  }
  const data = await response.json();
  if (!data || !Array.isArray(data.games)) {
    throw new Error(t('filter.manifest.no_games'));
  }
  setWords(translation);
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
    title: source || String(plainNameOf(game) ?? game.slug ?? '').trim(),
  };
}

/** The name before the wall numbered it apart from an older entry's: "Ashbound" for "Ashbound (2)". */
export const plainNameOf = (game) => game.plainName || game.name;

/** The first step of the Source rail: 'original' or 'inspired'. */
export const originOf = (game) => (game.lineage.original ? 'original' : 'inspired');

/** "fileSize" reads "File size", in the sentence case the rest of the wall uses. */
const prettyLabel = (key) =>
  key
    .replace(/([a-z0-9])([A-Z])/g, (_, a, b) => `${a} ${b.toLowerCase()}`)
    .replace(/[-_]+/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());

/** The rails the hub knows by name; one invented tomorrow reads off its field name. */
const FACET_LABELS = {
  genre: () => t('filter.facet.genre'),
  players: () => t('filter.facet.players'),
  model: () => t('filter.facet.model'),
  tags: () => t('filter.facet.tags'),
  fileSize: () => t('filter.facet.file_size'),
  collection: () => t('filter.facet.collection'),
};
const facetLabel = (key) => (FACET_LABELS[key] ? FACET_LABELS[key]() : prettyLabel(key));

/** The first row of a rail's menu, the one that clears it: "Any genre". */
const ANY_FACET = {
  genre: () => t('filter.any.genre'),
  players: () => t('filter.any.players'),
  model: () => t('filter.any.model'),
  tags: () => t('filter.any.tags'),
  fileSize: () => t('filter.any.file_size'),
  collection: () => t('filter.any.collection'),
};
const anyFacet = (key) =>
  ANY_FACET[key] ? ANY_FACET[key]() : t('filter.any.other', { facet: prettyLabel(key).toLocaleLowerCase(lang) });

const natural = (a, b) => a.value.localeCompare(b.value, lang, { numeric: true });

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
      label: facetLabel(key),
      any: anyFacet(key),
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

  return facets.sort(
    (a, b) => rankOf(a.key) - rankOf(b.key) || b.coverage - a.coverage || compare(a.label, b.label)
  );
}

/** True when a game puts `value` on the `key` rail. */
export const matchesFacet = (game, key, value) => Boolean(game.rails[key]?.includes(value));
