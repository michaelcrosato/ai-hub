/**
 * friends/together.js — what the hub can play with friends, for every view.
 *
 * Two ways to play together:
 * - online, each on their own device, in an AI Hub session: a game that
 *   declares a session protocol this hub runs (hub:session), played in one of
 *   three modes (shared world, ghost, parallel);
 * - on one screen, a controller each: a game whose own `players` seats more
 *   than one (couch co-op). That stays the game's own; the hub only lists it.
 *
 * Every view links a game that plays together to its page in the Friends
 * view (friendsHref), which explains how it plays and hosts a session that
 * opens with it (hostHref). Pure: no DOM, so the tests read it as the views do.
 */

import { sessionOf, playersOf, MULTI, sameKey } from '../manifest.js';
import { shelfOf, isVisible, tokenize } from '../filter.js';
import { LENGTHS } from '../session/pick.js';

export const FRIENDS_PATH = '/friends';
export const SESSION_PATH = '/session';
/** A session seats this many, each on their own device. */
export const MOST_SEATS = 4;

/** The ways to play together, in the order the Friends view shows them. */
export const WAYS = [
  {
    key: 'shared-world',
    label: 'Shared world',
    title: 'One world for everyone',
    blurb: 'Co-op and versus: everyone in the same game, run by the host’s copy.',
  },
  {
    key: 'ghost',
    label: 'Ghost',
    title: 'Race each other’s ghosts',
    blurb: 'Your own copy of the game, with the others racing through it as ghosts.',
  },
  {
    key: 'parallel',
    label: 'Parallel',
    title: 'Same start, side by side',
    blurb: 'Everyone plays their own copy from the same start, and a live scoreboard shows who is ahead.',
  },
  {
    key: 'couch',
    label: 'One screen',
    title: 'Couch co-op',
    blurb: 'One screen and a controller each. The game seats everyone itself.',
  },
];

export const wayOf = (key) => WAYS.find((way) => way.key === key) ?? null;

/** A game friends can play in a session: a protocol this hub runs, on the Games shelf, not hidden. */
export function playsOnline(game, { showAll = false } = {}) {
  return Boolean(sessionOf(game)?.supported) && shelfOf(game) === 'games' && isVisible(game, showAll);
}

/** A game that seats several players on one screen by itself. */
export function playsOnOneScreen(game, { showAll = false } = {}) {
  return shelfOf(game) === 'games' && isVisible(game, showAll) && playersOf(game).includes(MULTI);
}

export const playsTogether = (game, options) => playsOnline(game, options) || playsOnOneScreen(game, options);

/** "2–4 players", "4 players". */
export const seatsText = ([low, high]) => (low === high ? `${low} players` : `${low}–${high} players`);

/** The seats a game's own `players` names, for one screen: [2, 4] for "1–4". */
function screenSeats(game) {
  const [low, high = low] = (String(game.players ?? '').match(/\d+/g) || []).map(Number);
  return low ? [Math.max(1, low), Math.max(low, high)] : null;
}

/**
 * How a game plays together, for a card or a page. Null for a game that does
 * not. `online` is the session's side, `screen` the game's own seats; a game
 * may have both, and the session's way comes first.
 */
export function togetherOf(game, options) {
  const online = playsOnline(game, options) ? sessionOf(game) : null;
  const screen = playsOnOneScreen(game, options) ? screenSeats(game) : null;
  if (!online && !screen) return null;
  const way = wayOf(online ? online.mode ?? 'parallel' : 'couch');
  return {
    way,
    online: Boolean(online),
    screen,
    seats: online ? online.seats : screen,
    minutes: online?.minutes ?? null,
    goal: online?.goal ?? null,
    howto: online?.howto ?? null,
    webgpu: online ? game.webgpu === 'required' : false,
    touch: Array.isArray(game.tags) && game.tags.includes('touch'),
  };
}

/** One line under a game's name: "Shared world · 1–4 players · about 4 min". */
export function togetherLine(game, options) {
  const t = togetherOf(game, options);
  if (!t) return '';
  return [t.way.label, seatsText(t.seats), t.minutes && `about ${t.minutes} min`].filter(Boolean).join(' · ');
}

/** Where "Play with friends" on a game leads: its page in the Friends view. */
export const friendsHref = (game) => `${FRIENDS_PATH}#/g/${encodeURIComponent(game.slug)}`;

/**
 * Host a session. With a game, the session opens with it before the hub
 * deals the rest. `local` keeps it to tabs of this browser, with the hub's
 * reference games added to the deal.
 */
export function hostHref(game = null, { local = false } = {}) {
  const query = new URLSearchParams();
  if (local) query.set('transport', 'local');
  if (local && !game) query.set('examples', '1');
  if (game) query.set('first', game.slug);
  const text = query.toString();
  return `${SESSION_PATH}${text ? `?${text}` : ''}${local ? '#try' : ''}`;
}

/** The address a guest joins from. */
export const joinHref = (code) => `${SESSION_PATH}#${code}`;

/**
 * Ten letters and digits from an alphabet with no look-alikes, as the
 * database hands them out (new_session_code: no l, o, 0 or 1).
 */
const CODE = /^[a-km-np-z2-9]{10}$/;

/**
 * The invite code in whatever was pasted: the code itself, or the invite
 * link, or a message with the link in it. Null when there is none.
 */
export function inviteCode(text) {
  const raw = String(text ?? '').trim().toLowerCase();
  if (!raw) return null;
  const hash = raw.match(/#([a-z0-9]+)/);
  if (hash && CODE.test(hash[1])) return hash[1];
  const bare = raw.replace(/-+/g, '');
  if (CODE.test(bare)) return bare;
  const word = raw.split(/[^a-z0-9]+/).find((part) => CODE.test(part));
  return word ?? null;
}

/** Head counts the Friends view filters by. */
export const PARTY_SIZES = [2, 3, 4];

/** Whether a game seats `n` together, in a session or on one screen. */
function seats(game, n, options) {
  const t = togetherOf(game, options);
  if (!t) return false;
  const online = t.online && sessionOf(game).seats[0] <= n && n <= sessionOf(game).seats[1];
  const screen = t.screen && t.screen[0] <= n && n <= t.screen[1] && n >= 2;
  return Boolean(online || screen);
}

/** The way a game is filed under in the Friends view: the session's, else one screen. */
const filedUnder = (game, options) => togetherOf(game, options)?.way.key ?? null;

/**
 * The games for the Friends view's selection: what plays together, narrowed by
 * the search (every word, as the wall searches), the party's size, the way it
 * plays and a session round's length. Newest first, names to break ties.
 */
export function selectTogether(games, { q = '', players = 0, way = '', length = '' } = {}, options) {
  const tokens = tokenize(q);
  const n = Number(players) || 0;
  const span = LENGTHS.find((l) => l.value === length);
  return games
    .filter((game) => {
      const t = togetherOf(game, options);
      if (!t) return false;
      if (way && filedUnder(game, options) !== way) return false;
      if (n && !seats(game, n, options)) return false;
      if (span && !(t.online && span.holds(t.minutes))) return false;
      return tokens.every((token) => game.search?.includes(token));
    })
    .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0) || a.name.localeCompare(b.name));
}

/** The selection as the Friends view's rows: one per way, in WAYS order, empty ones left out. */
export function rowsOf(games, options) {
  return WAYS.map((way) => ({ ...way, games: games.filter((game) => filedUnder(game, options) === way.key) })).filter(
    (row) => row.games.length > 0
  );
}

/**
 * The hub's own game-night picks, built for sessions by hand: a world for
 * everyone, ghost races and a parallel run. Whatever of them this library
 * has, else the newest shared worlds, so the shelf is never empty.
 */
export const SPOTLIGHT = [
  'original-blaze-cup',
  'merry-go-kart-64-mario-kart-64-claude-opus-5-5-high-20261018-1558',
  'grand-theft-motto-iii-grand-theft-auto-iii-claude-opus-5-5-medium-20261019-0657',
  'arwingdings-star-fox-64-claude-opus-5-5-unknown-20261018-1213',
  'brine-line-64-wave-race-64-claude-opus-5-5-medium-20261018-1913',
  'desktop-urethane-switchyard',
  'luckyandwild-slick-and-skid-highway-heat',
];

export function spotlightOf(games, { most = 6, ...options } = {}) {
  const online = games.filter((game) => playsOnline(game, options));
  const bySlug = new Map(online.map((game) => [game.slug, game]));
  const picks = SPOTLIGHT.map((slug) => bySlug.get(slug)).filter(Boolean);
  if (picks.length >= Math.min(3, most)) return picks.slice(0, most);
  const seen = new Set(picks.map((game) => sameKey(game.name)));
  const fill = selectTogether(online, { way: 'shared-world' }, options).filter((game) => !seen.has(sameKey(game.name)));
  return [...picks, ...fill].slice(0, most);
}

/** How many games play together each way, and in all: for the Friends view's counts. */
export function tally(games, options) {
  const together = games.filter((game) => playsTogether(game, options));
  const online = together.filter((game) => playsOnline(game, options));
  const by = Object.fromEntries(WAYS.map((way) => [way.key, 0]));
  for (const game of together) by[filedUnder(game, options)] += 1;
  return { all: together.length, online: online.length, screen: together.length - online.length, by };
}
