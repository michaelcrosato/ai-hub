/**
 * session/pick.js — which game the session plays next.
 *
 * The host's own picks come first, in the order they were picked (the queue:
 * "Up next" in the lobby, and the game a session was hosted with). Then
 * Random Mode deals.
 *
 * Every game that declares a supported session protocol, seats the players
 * present, and sits on the Games shelf is in the pool. The pool is dealt in an
 * order fixed by the session's seed (the Deck's shuffle), and no game comes
 * round twice until every game in the pool has had its turn: then a new cycle
 * deals the pool again in a new order.
 *
 * The host can narrow the pool in the lobby: how the game is played together,
 * how long a round runs, the genre, and what made it: the model, how hard the
 * model was asked to think, and when it came into the library.
 */

import { sessionOf, sameKey } from '../manifest.js';
import { SELF_REPORTED } from '../../../lib/hub/round.js';
import { t, date, list, compare } from '../lang.js';
import { isVisible, shelfOf } from '../filter.js';
import { shuffleDeck } from '../explore/deck.js';

/**
 * How long a round runs, from hub:session-minutes. A game that does not say
 * gets the longest round limit there is, so it counts as long.
 */
export const LENGTHS = [
  { value: 'short', label: t('session.length.short'), blurb: t('session.length.short_blurb'), holds: (minutes) => minutes !== null && minutes <= 3 },
  { value: 'medium', label: t('session.length.medium'), blurb: t('session.length.medium_blurb'), holds: (minutes) => minutes !== null && minutes > 3 && minutes < 7 },
  { value: 'long', label: t('session.length.long'), blurb: t('session.length.long_blurb'), holds: (minutes) => minutes === null || minutes >= 7 },
];

/** What a way of playing together is called on screen. */
export const modeName = (mode) =>
  mode === 'parallel' ? t('session.mode.parallel') : mode === 'ghost' ? t('session.mode.ghost') : mode === 'shared-world' ? t('session.mode.shared_world') : t('session.mode.game');

const MODES = [
  { value: 'parallel', label: t('session.mode.parallel'), blurb: t('session.mode.parallel_blurb') },
  { value: 'ghost', label: t('session.mode.ghost'), blurb: t('session.mode.ghost_blurb') },
  { value: 'shared-world', label: t('session.mode.shared_world'), blurb: t('session.mode.shared_world_blurb') },
];

/**
 * How hard the model was asked to think, as the catalogue records it, least
 * first. An effort not listed here follows them, A to Z.
 */
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'];
const effortAt = (value) => (EFFORTS.includes(value) ? EFFORTS.indexOf(value) : EFFORTS.length);
const effortName = (value) =>
  value === 'low' ? t('session.effort.low')
  : value === 'medium' ? t('session.effort.medium')
  : value === 'high' ? t('session.effort.high')
  : value === 'xhigh' ? t('session.effort.xhigh')
  : value === 'max' ? t('session.effort.max')
  : value === 'ultra' ? t('session.effort.ultra')
  : value.charAt(0).toUpperCase() + value.slice(1);

/** The month a game came into the library, "2026-10": a UTC month, as the Explore timeline files arrivals. */
const monthOf = (game) => {
  const at = Date.parse(game.added);
  return Number.isFinite(at) ? new Date(at).toISOString().slice(0, 7) : null;
};
/** "2026-10" reads "October 2026". Anything else came over the network, and reads as it is. */
const monthName = (value) => (/^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? date(new Date(`${value}-01T12:00:00Z`), { month: 'long', year: 'numeric', timeZone: 'UTC' }) : value);

/**
 * The host's filters on the deal, as groups: a group with values chosen keeps
 * the games that have one of them, and a group with none chosen keeps them
 * all. `fixed` lists a group's values in the order the lobby shows them; the
 * others are found on the games, in `rank` order or most games first. `name`
 * is what the lobby calls a value, and `say` puts a group's choice in words.
 */
export const FILTERS = [
  {
    key: 'modes',
    label: t('session.filter.play'),
    read: (game) => sessionOf(game)?.mode,
    fixed: MODES,
  },
  {
    key: 'lengths',
    label: t('session.filter.length'),
    read: (game) => LENGTHS.find((length) => length.holds(sessionOf(game)?.minutes ?? null))?.value,
    fixed: LENGTHS.map(({ value, label, blurb }) => ({ value, label, blurb })),
  },
  { key: 'genres', label: t('session.filter.genre'), read: (game) => game.genre },
  { key: 'models', label: t('session.filter.model'), read: (game) => game.model },
  {
    key: 'efforts',
    label: t('session.filter.effort'),
    read: (game) => game.effort,
    rank: (a, b) => effortAt(a) - effortAt(b) || compare(a, b),
    name: effortName,
    blurb: (value) => t('session.filter.effort_blurb', { effort: value }),
    say: (text) => t('session.filter.effort_say', { text }),
  },
  {
    key: 'months',
    label: t('session.filter.added'),
    read: monthOf,
    rank: (a, b) => b.localeCompare(a),
    name: monthName,
    say: (text) => t('session.filter.added_say', { text }),
  },
];

/** What a game has in a group, as trimmed words: one, several (a game may name two models) or none. */
const valuesOf = (value) =>
  (Array.isArray(value) ? value : [value]).filter((v) => typeof v === 'string' && v.trim()).map((v) => v.trim());

/** What the lobby calls a value. */
const labelOf = (group, value) => group.fixed?.find((o) => o.value === value)?.label ?? group.name?.(value) ?? value;

/** The values chosen in one group. Filters come over the network from the host, so anything else is none. */
const chosenIn = (filters, key) => (Array.isArray(filters?.[key]) ? filters[key].filter((v) => typeof v === 'string') : []);

/** Whether the host has narrowed the deal at all. */
export const anyFilter = (filters) => FILTERS.some(({ key }) => chosenIn(filters, key).length > 0);

/** Whether a game passes the host's filters. */
export const passes = (game, filters) =>
  FILTERS.every(({ key, read }) => {
    const chosen = chosenIn(filters, key);
    return !chosen.length || valuesOf(read(game)).some((value) => chosen.includes(value));
  });

/** The filters with one value chosen or taken back. */
export function toggleFilter(filters, key, value, on) {
  const rest = chosenIn(filters, key).filter((v) => v !== value);
  return { ...filters, [key]: on ? [...rest, value] : rest };
}

/** The filters in words, one group after another: "Shared world · Short · Racing or Fighting · Max effort". Null for none. */
export function describeFilters(filters) {
  const parts = FILTERS.map((group) => {
    const labels = chosenIn(filters, group.key).map((v) => labelOf(group, v));
    if (!labels.length) return null;
    const text = list(labels, 'disjunction');
    return group.say ? group.say(text) : text;
  }).filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

/**
 * The games a session of `n` players can play. The seats' browsers decide
 * too: a game that cannot play without WebGPU (hub:webgpu "required") only
 * when every seat has it (`webgpu`); and when a seat has nothing but a touch
 * screen (`touchOnly`), the games tagged touch, if any fit. Then the host's
 * `filters`.
 */
export function eligible(games, n, { webgpu = false, touchOnly = false, filters = null } = {}) {
  const fit = games.filter((game) => {
    const session = sessionOf(game);
    return (
      session?.supported &&
      session.seats[0] <= n &&
      n <= session.seats[1] &&
      (webgpu || game.webgpu !== 'required') &&
      isVisible(game, false) &&
      shelfOf(game) === 'games' &&
      passes(game, filters)
    );
  });
  const touch = touchOnly ? fit.filter((game) => Array.isArray(game.tags) && game.tags.includes('touch')) : [];
  return touch.length ? touch : fit;
}

/** One game, however many builds of it the library holds: the same source, or for an original the same name. */
export const lineageKey = (game) => `${sameKey(game.lineage?.series ?? '')}\u0000${sameKey(game.lineage?.title ?? game.slug)}`;

/** How many games a list holds, as the deal counts them: titles, not builds. */
export const countGames = (games) => new Set(games.map(lineageKey)).size;

/**
 * What the lobby offers in each filter group: the values the games that seat
 * the players have, each with how many games the deal would have if it alone
 * were chosen in its group, the other groups as they are. A chosen value stays
 * on offer when no game has it any more, so it can be taken back.
 */
export function filterChoices(games, n, { filters = null, ...seats } = {}) {
  const fit = eligible(games, n, { webgpu: seats.webgpu });
  return FILTERS.map((group) => {
    const chosen = chosenIn(filters, group.key);
    const seen = new Map();
    for (const game of fit) {
      for (const value of valuesOf(group.read(game))) seen.set(value, (seen.get(value) || new Set()).add(lineageKey(game)));
    }
    const option = (value) => ({ value, label: labelOf(group, value), ...(group.blurb && { blurb: group.blurb(value) }) });
    const mostFirst = (a, b) => seen.get(b).size - seen.get(a).size || compare(a, b);
    const known = group.fixed ?? [...seen.keys()].sort(group.rank ?? mostFirst).map(option);
    const offered = [...known.filter((o) => seen.has(o.value) || chosen.includes(o.value)), ...chosen.filter((v) => !known.some((o) => o.value === v)).map(option)];
    const options = offered.map((o) => ({
      ...o,
      chosen: chosen.includes(o.value),
      count: countGames(eligible(fit, n, { ...seats, filters: { ...filters, [group.key]: [o.value] } })),
    }));
    return { key: group.key, label: group.label, options };
  });
}

/**
 * The games a session deals from. The reference examples join the library when
 * the host asks for them (?examples=1), and also while no library game supports
 * sessions, so that "Play with friends" always has something to play.
 */
export function sessionPool(library, examples, wanted = false) {
  const any = library.some((game) => sessionOf(game)?.supported);
  return wanted || !any ? [...library, ...examples] : library;
}

/**
 * The game a round deals, as this browser's own library has it, and the build
 * to load. Round state arrives over the network, where any seat can pose as
 * the host, so its path is never loaded: the slug picks the game, and the path
 * only chooses among that game's own builds. Null when this library has no
 * such game (an older copy of it, or one still loading).
 */
export function roundGame(cur, games) {
  const game = games.find((g) => g.slug === cur?.slug);
  if (!game) return null;
  const builds = game.builds?.length ? game.builds : [{ path: game.path }];
  return { game, build: builds.find((b) => b.path === cur.path) || builds[0] };
}

/** Each player in a world of their own (parallel, ghost) or all in one (shared world): the two decks the deal alternates. */
export const deckOf = (game) => (SELF_REPORTED.includes(sessionOf(game)?.mode) ? 'own' : 'shared');

/**
 * The next game, and the cycle and played list that follow it. Null when
 * nothing fits `n` players.
 *
 * Parallel and ghost games far outnumber the shared worlds, so a single
 * shuffle would bury the few shared worlds. While both decks have games, the
 * deal alternates between them, starting with a shared world. Within
 * a deck it deals games, not builds: one build of each lineage, picked at
 * random, and no lineage comes round again until the deck is played through,
 * so a source with hundreds of runs is one game among the others.
 */
export function pickNext(games, { seed, n, cycle = 0, played = [], webgpu = false, touchOnly = false, filters = null }) {
  const pool = eligible(games, n, { webgpu, touchOnly, filters });
  if (!pool.length) return null;
  const decks = new Set(pool.map(deckOf));
  const last = played.length ? pool.find((game) => game.slug === played.at(-1)) : null;
  const want = decks.size > 1 ? (last && deckOf(last) === 'shared' ? 'own' : 'shared') : [...decks][0];
  const lineages = new Map();
  for (const game of pool.filter((g) => deckOf(g) === want)) {
    const key = lineageKey(game);
    if (!lineages.has(key)) lineages.set(key, []);
    lineages.get(key).push(game);
  }
  const done = new Set(played);
  const lastSlug = played.at(-1);
  const order = (c) => shuffleDeck([...lineages].map(([slug, builds]) => ({ slug, builds })), `${seed}:${c}:${want}`);
  let next = order(cycle).find((lineage) => !lineage.builds.some((game) => done.has(game.slug)));
  if (!next) {
    // That deck is played through: it starts again in a new order, and the other deck carries on.
    cycle += 1;
    const again = new Set([...lineages.values()].flat().map((game) => game.slug));
    played = played.filter((slug) => !again.has(slug));
    // Not the game just played, while the deck has another.
    const fresh = order(cycle);
    next = fresh.find((lineage) => !lineage.builds.some((game) => game.slug === lastSlug)) ?? fresh[0];
  }
  const game = shuffleDeck(next.builds, `${seed}:${cycle}:${next.slug}`)[0];
  return { game, cycle, played: [...played, game.slug] };
}

/** The host's picks wait in the queue, this many at most. */
export const MOST_PICKS = 12;

/**
 * The queue as the host published it: slugs, each once, at most MOST_PICKS.
 * It comes over the network, so anything else is dropped.
 */
export function cleanQueue(queue) {
  const out = [];
  for (const slug of Array.isArray(queue) ? queue : []) {
    if (typeof slug === 'string' && slug && slug.length <= 200 && !out.includes(slug) && out.length < MOST_PICKS) out.push(slug);
  }
  return out;
}

/**
 * The games the host can pick by hand for `n` players: every game that seats
 * them and every seat's browser can run. The host's filters narrow only the
 * deal, and the touch rule only what the deal reaches for: a pick is the
 * host's own choice.
 */
export const pickable = (games, n, { webgpu = false } = {}) => eligible(games, n, { webgpu });

/**
 * The first of the host's picks that seats the players now, and the queue
 * without it: a pick that does not fit yet keeps its place for later. Null
 * when none fits.
 */
export function takeQueued(games, queue, { n, webgpu = false }) {
  const can = new Map(pickable(games, n, { webgpu }).map((game) => [game.slug, game]));
  const list = cleanQueue(queue);
  const at = list.findIndex((slug) => can.has(slug));
  if (at === -1) return null;
  return { game: can.get(list[at]), queue: [...list.slice(0, at), ...list.slice(at + 1)] };
}
