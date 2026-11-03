/**
 * session/pick.js — Random Mode: which game the session plays next.
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
import { SELF_REPORTED, MODE_NAMES } from '../../../lib/hub/round.js';
import { isVisible, shelfOf } from '../filter.js';
import { shuffleDeck } from '../explore/deck.js';

/**
 * How long a round runs, from hub:session-minutes. A game that does not say
 * gets the longest round limit there is, so it counts as long.
 */
export const LENGTHS = [
  { value: 'short', label: 'Short', blurb: 'Up to 3 minutes a round', holds: (minutes) => minutes !== null && minutes <= 3 },
  { value: 'medium', label: 'Medium', blurb: '4 to 6 minutes a round', holds: (minutes) => minutes !== null && minutes > 3 && minutes < 7 },
  { value: 'long', label: 'Long', blurb: '7 minutes or more a round', holds: (minutes) => minutes === null || minutes >= 7 },
];

const MODE_BLURBS = {
  parallel: 'Everyone plays their own copy, from the same start',
  ghost: 'Your own copy, with the others shown in it as ghosts',
  'shared-world': 'One world for everyone',
};

/**
 * How hard the model was asked to think, as the catalogue records it, least
 * first. An effort not listed here follows them, A to Z.
 */
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'];
const effortAt = (value) => (EFFORTS.includes(value) ? EFFORTS.indexOf(value) : EFFORTS.length);
const effortName = (value) => (value === 'xhigh' ? 'Extra high' : value.charAt(0).toUpperCase() + value.slice(1));

/** The month a game came into the library, "2026-10": a UTC month, as the Explore timeline files arrivals. */
const monthOf = (game) => {
  const at = Date.parse(game.added);
  return Number.isFinite(at) ? new Date(at).toISOString().slice(0, 7) : null;
};
const MONTH = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' });
/** "2026-10" reads "October 2026". Anything else came over the network, and reads as it is. */
const monthName = (value) => (/^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? MONTH.format(new Date(`${value}-01T12:00:00Z`)) : value);

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
    label: 'Play',
    read: (game) => sessionOf(game)?.mode,
    fixed: Object.entries(MODE_NAMES).map(([value, label]) => ({ value, label, blurb: MODE_BLURBS[value] })),
  },
  {
    key: 'lengths',
    label: 'Length',
    read: (game) => LENGTHS.find((length) => length.holds(sessionOf(game)?.minutes ?? null))?.value,
    fixed: LENGTHS.map(({ value, label, blurb }) => ({ value, label, blurb })),
  },
  { key: 'genres', label: 'Genre', read: (game) => game.genre },
  { key: 'models', label: 'Model', read: (game) => game.model },
  {
    key: 'efforts',
    label: 'Effort',
    read: (game) => game.effort,
    rank: (a, b) => effortAt(a) - effortAt(b) || a.localeCompare(b),
    name: effortName,
    blurb: (value) => `Made at ${value} effort`,
    say: (text) => `${text} effort`,
  },
  {
    key: 'months',
    label: 'Added',
    read: monthOf,
    rank: (a, b) => b.localeCompare(a),
    name: monthName,
    say: (text) => `Added in ${text}`,
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
    const text = labels.length > 1 ? `${labels.slice(0, -1).join(', ')} or ${labels.at(-1)}` : labels[0];
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
    const mostFirst = (a, b) => seen.get(b).size - seen.get(a).size || a.localeCompare(b);
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
