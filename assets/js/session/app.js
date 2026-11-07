/**
 * session/app.js — an AI Hub session: friends join, the hub deals games at
 * random (Random Mode), plays each round through lib/hub/, and keeps score.
 *
 * Every tab is one seat. The seated tab with the lowest seat is the host: it
 * holds the session's state (round, seed, what has been played, the table),
 * picks the next game, and runs each round's coordinator (lib/hub/round.js).
 * It sends the whole state to the others whenever it changes and every second,
 * so a tab that joins late, or takes over when the host leaves, knows
 * everything. A shared world whose host leaves dies with it and is void; a
 * parallel or ghost round is scored from what the others played.
 *
 * Three transports with one shape: across devices (session/net.js: Supabase
 * Realtime for presence and control, a WebRTC mesh for game traffic, rounds
 * saved to the database), between tabs of one browser (?transport=local,
 * session/local.js), and a test relay the browser tests inject
 * (?transport=relay).
 *
 * Across devices the host signs in with Google and gets an invite link,
 * /session#<code>; friends open it and join as guests, no account needed.
 *
 * Between rounds every seat sees the results, then the next game's splash: a
 * countdown the host sets (10, 20 or 30 seconds) that starts the round by
 * itself, Ready (every seat ready starts it at once) and I need more time
 * (+10 s; while most seats ask, the countdown holds). A game can show its own
 * card instead: once it has loaded, the hub's steps aside, and the game gets
 * the countdown and sends the answers (lib/hub/README.md, "The card"). The
 * games load underneath and ready up by themselves; the host's round
 * coordinator starts the round when the splash is over and every game has
 * loaded.
 */

import { h, clear } from '../dom.js';
import { t, tx, list, fillPage } from '../lang.js';
import { languageMenu } from '../ui/language.js';
import { loadManifest, normalize, sessionOf } from '../manifest.js';
import { fnv1a, cabinetPalette, paletteVars } from '../color.js';
import { createPlayer } from '../ui/player.js';
import { createBridge, attachFrame, postTo, cleanProgress } from '/lib/hub/bridge.js';
import { createRound, limitFor, rankResults, seedsRandom, SELF_REPORTED, SLOT_COLORS } from '/lib/hub/round.js';
import { createLocalNet } from './local.js';
import { createRelayNet, supabaseRelay, plainProblem } from './net.js';
import { nameChoices } from './names.js';
import { pickNext, eligible, sessionPool, roundGame, filterChoices, anyFilter, describeFilters, toggleFilter, countGames, cleanQueue, takeQueued, pickable, modeName, MOST_PICKS } from './pick.js';
import { createChooser } from './chooser.js';
import { FRIENDS_PATH, inviteCode, joinHref, togetherLine } from '../friends/together.js';
import { emblem } from '../ui/friends.js';
import { scoreRound, addRound, leaderboard, liveOrder, FORMATS, DEFAULT_FORMAT, formatOf, formatOver, formatProgress, sessionAwards, awardText, finalTable } from './score.js';

fillPage();
// The page's header carries the Language menu (it stays hidden while English is the only language).
document.querySelector('.session-head')?.append(languageMenu());

const SEATS = 4;
const STATE_EVERY_MS = 2_000;
const DISCOVER_MS = 700;
/** "I need more time" adds this much to the splash's countdown. */
const MORE_MS = 10_000;
/** How long the splash counts down, in seconds: the host picks in the lobby. */
const CARD_SECONDS = [10, 20, 30];
const DEFAULT_CARD_SECONDS = 20;
const RELAY_KEY = 'ai-hub:relay-only';
/** The controller on the splash: Cross is Ready, Triangle asks for more time. */
const PAD = { cross: 0, triangle: 3 };

const params = new URLSearchParams(location.search);
const seconds = (name) => (Number(params.get(name)) > 0 ? Number(params.get(name)) * 1000 : null);
/** Knobs for trying games quickly: the host's address sets them for the session. */
const knobs = {
  limitMs: seconds('limit'),
  resultsMs: seconds('results') ?? 5_000,
  splashMs: seconds('splash'),
  graceMs: seconds('grace'),
  examples: params.get('examples') === '1',
};
/** The game a session was hosted with (from a game's page in the Friends view): first in the host's picks. */
const firstPick = params.get('first');
const asSeat = Number(params.get('as')) >= 1 && Number(params.get('as')) <= SEATS ? Number(params.get('as')) - 1 : null;
const transport =
  params.get('transport') === 'local' ? 'local' : params.get('transport') === 'relay' && window.__sessionRelay ? 'relay' : 'online';
let code = decodeURIComponent(location.hash.slice(1)) || (transport === 'online' ? '' : 'local');
let key = asSeat !== null ? `seat${asSeat + 1}` : `t${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`;
/** Online: the seat the database gave, the session's id and the client. */
let fixedSeat = asSeat;
let online = null;
let user = null;
let problem = null;
let removed = false;
let superseded = false;

const app = document.getElementById('session');
const strip = document.getElementById('strip');
const overlay = document.getElementById('results');

/**
 * The host's game picker, over the lobby: what it adds plays first
 * (state.queue). It offers the games that seat the players here now, and the
 * ones that will once more sit down: a pick waits for them.
 */
const chooser = createChooser(document.getElementById('chooser'), {
  games: () => {
    const all = new Map();
    for (let n = Math.max(1, seated().length); n <= SEATS; n++) for (const game of pickable(pool, n, { webgpu: seatsCan().webgpu })) all.set(game.slug, game);
    return [...all.values()];
  },
  fitsNow: (game) => pickable([game], seated().length, { webgpu: seatsCan().webgpu }).length > 0,
  picked: () => cleanQueue(state?.queue),
  most: MOST_PICKS,
  onToggle(slug, on) {
    if (!isHost() || !state) return;
    const queue = cleanQueue(state.queue);
    publish({ ...state, notice: null, queue: on ? cleanQueue([...queue, slug]) : queue.filter((s) => s !== slug) });
  },
});

/** The reference games, one per kind of round, for a session with nothing else to play. */
const EXAMPLES = [
  { slug: 'hub-example-arena', name: 'Star Arena', tagline: 'Shared world: first to ten stars', path: '/lib/hub/examples/arena.html', themeColor: '#1b1530', sessionMode: 'shared-world', sessionMinutes: '2', sessionGoal: t('session.example.arena_goal'), sessionHowto: t('session.example.arena_howto') },
  { slug: 'hub-example-ghost', name: 'Comet Dash', tagline: 'Ghost: race the others’ ghosts', path: '/lib/hub/examples/ghost.html', themeColor: '#0f1b2e', sessionMode: 'ghost', sessionMinutes: '1', sessionGoal: t('session.example.ghost_goal'), sessionHowto: t('session.example.ghost_howto') },
  { slug: 'hub-example-parallel', name: 'Starfall', tagline: 'Parallel: one minute of falling stars', path: '/lib/hub/examples/parallel.html', themeColor: '#15103a', sessionMode: 'parallel', sessionPlayers: '1-4', sessionMinutes: '1', sessionGoal: t('session.example.parallel_goal'), sessionHowto: t('session.example.parallel_howto') },
].map((g) => normalize({ sessionPlayers: '2-4', ...g, type: 'Game', session: '1', tags: ['touch'], builds: [{ id: 'current', path: g.path }] }));

let pool = [];
let net = null;
let name = null;
let reroll = 0;
let state = null;          // the session, as the host last published it
let status = null;         // the current round's coordinator status
let wasHost = false;
let coordinator = null;    // host only: the running round
let bridge = null;         // this tab's game frame in the current round
let detach = null;
const early = [];          // traffic for a round whose frame isn't open yet
/** Host only: who asked for more time on the splash. Kept off the shared state, so nobody learns who. */
let marks = new Set();
/** This tab's own answer on the splash, which it shows itself. */
let myAnswer = { round: null, ready: false, more: false, moreAt: 0 };

const player = createPlayer(document.getElementById('player'), {
  // The host's ✕ ends Random Mode for everyone; a guest's leaves the session.
  onExit: () => (isHost() ? backToLobby() : leaveSession()),
  // The host's 🎲 skips to the next game.
  onRoll: () => isHost() && coordinator?.abort('skipped'),
  canRoll: () => isHost(),
  confirmExit: () =>
    isHost()
      ? { title: t('session.exit.end_title'), detail: t('session.exit.end_detail'), action: t('session.exit.end_action') }
      : { title: t('session.exit.leave_title'), detail: t('session.exit.leave_detail'), action: t('session.exit.leave_action') },
  keepFocus: () => !overlay.hidden,
  honorStandalone: false,
  askToRate: false,
  backLabel: t('session.exit.leave_action'),
  src: (build) => roundSrc(build.path, pendingRound),
  onFrame: (frame) => attachRound(frame),
});

/**
 * The game's address in a round. For a game tagged parallel or ghost, the seed
 * rides in it too: the client seeds Math.random with it before the game's own
 * scripts run, so every copy starts the same (lib/hub/README.md, "The client").
 */
function roundSrc(path, cur) {
  const join = path.includes('?') ? '&' : '?';
  return cur?.seeded ? `${path}${join}aihub=1&aihub-seed=${cur.seed >>> 0}` : `${path}${join}aihub=1`;
}

/* --- who is here ----------------------------------------------------------- */

const seated = () =>
  (net?.members() ?? [])
    .filter((m) => Number.isInteger(m.slot) && m.name)
    .sort((a, b) => a.slot - b.slot);
const hostKey = () => seated()[0]?.key ?? null;
/** What the seated players' browsers can run, for the deal and the lobby's count alike. */
const seatsCan = () => ({ webgpu: seated().every((m) => m.gpu === true), touchOnly: seated().some((m) => m.touch === true) });
const isHost = () => hostKey() === key;
const mine = () => net?.me();

function claimSeat() {
  const others = net.members().filter((m) => m.key !== key && Number.isInteger(m.slot));
  const taken = new Set(others.map((m) => m.slot));
  const slot = fixedSeat ?? [...Array(SEATS).keys()].find((s) => !taken.has(s));
  net.update({ slot: slot ?? null, name, status: slot === undefined ? 'full' : 'here', gpu: webgpu, touch: touchOnly });
}

/** Nothing but a touch screen to play with: the deal then keeps to games tagged touch. */
const touchOnly = matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;

/**
 * Whether this browser can play a game that needs WebGPU (hub:webgpu
 * "required"): an adapter, not just the API. Every seat says so in its
 * presence, and the deal skips such games unless every seat can.
 */
let webgpu = false;
(async () => {
  try {
    const adapter = await navigator.gpu?.requestAdapter();
    // A software adapter (SwiftShader) has the API but not the speed to play on.
    webgpu = Boolean(adapter) && !(adapter.info?.isFallbackAdapter ?? adapter.isFallbackAdapter);
  } catch {
    webgpu = false;
  }
  if (net && name) net.update({ gpu: webgpu });
})();

/** Two tabs that picked one seat at once: the later one moves. */
function settleSeat() {
  const me = mine();
  if (fixedSeat !== null || !Number.isInteger(me.slot)) return;
  const clash = net
    .members()
    .find((m) => m.key !== key && m.slot === me.slot && (m.joinedAt < me.joinedAt || (m.joinedAt === me.joinedAt && m.key < key)));
  if (clash) claimSeat();
}

function membersChanged() {
  settleSeat();
  const host = isHost();
  if (net.clock && net.clock.following !== (host ? null : hostKey())) net.clock.follow(hostKey(), host);
  if (host && !wasHost) takeOver();
  wasHost = host;
  if (host && coordinator && state?.current) {
    const here = new Set(net.members().map((m) => m.key));
    for (const p of state.current.players) if (!here.has(p.key)) coordinator.leave(p.key, 'left');
  }
  render();
}

/* --- the session state (the host's) ------------------------------------------ */

function freshState() {
  return {
    v: 0,
    seed: crypto.getRandomValues(new Uint32Array(1))[0],
    round: 0,
    cycle: 0,
    played: [],
    totals: {},
    history: [],
    phase: 'lobby',
    current: null,
    reveal: null,
    notice: null,
    format: DEFAULT_FORMAT,
    filters: {},
    queue: [],
    cardSeconds: DEFAULT_CARD_SECONDS,
    final: null,
    knobs,
  };
}

/** The game a fresh session opens with, then off the address, so a reload or a shared link never brings it back. */
function withFirstPick(next) {
  if (!firstPick) return next;
  const query = new URLSearchParams(location.search);
  query.delete('first');
  const text = query.toString();
  history.replaceState(null, '', `${location.pathname}${text ? `?${text}` : ''}${location.hash}`);
  return { ...next, queue: cleanQueue([firstPick]) };
}

function publish(next) {
  state = { ...next, v: (next.v || 0) + 1, host: key };
  net.broadcast({ k: 's', t: 'state', state });
  applyState();
}

/** This tab became the host: carry on from the last state it saw. */
function takeOver() {
  // Online, the database's host follows this page's (migration 0011), so removing a player and ending the session work after a handover.
  if (online) online.sb.rpc('claim_session_host', { p_session: online.sessionId }).then(() => {}, () => {});
  let next = state ? { ...state } : withFirstPick(freshState());
  if (!state) next.knobs = knobs;
  if (next.phase === 'round' && next.current && next.current.coordinator !== key) {
    next = withRoundRecorded(next, scoreLeftRound(next.current) ?? { status: 'void', reason: 'host-left', standings: null, players: [] });
    saveRound(next.history.at(-1));
    if (formatOver(next.format, next.history, next.totals)) return endSession(next);
    next.reveal = revealFor(next);
  }
  publish(next);
  dealNext();
}

/**
 * The round's coordinator left with the old host's tab. A shared world dies
 * with its host, but a parallel or ghost round needs none: score it from
 * the last status this tab saw, each player's result or else their last
 * progress, instead of throwing away what the others played. Null when there
 * is nothing to score.
 */
function scoreLeftRound(cur) {
  const s = status;
  if (!s || s.round !== cur.round || !SELF_REPORTED.includes(cur.mode) || !['countdown', 'playing', 'grace'].includes(s.phase)) return null;
  const players = s.players.map((p) => ({ id: p.id, key: p.key, slot: p.slot, name: p.name, color: p.color, out: p.out ?? (p.key === cur.coordinator ? 'left' : null) }));
  const results = new Map();
  for (const p of s.players) {
    if (p.result) results.set(p.id, p.result);
    else if (!p.out && p.key !== cur.coordinator && boardRound === cur.round && progressById.has(p.id)) results.set(p.id, { score: progressById.get(p.id).score, fallback: true });
  }
  if (!results.size) return null;
  const ranked = rankResults(results, players.filter((p) => !p.out || results.has(p.id)).map((p) => p.id));
  const gone = players.filter((p) => p.out && !results.has(p.id)).map((p) => p.id);
  const scores = Object.fromEntries([...results].map(([id, r]) => [id, Number.isFinite(r.time) ? r.time : r.score]));
  return { status: 'played', reason: 'host-left', standings: gone.length ? [...ranked, gone] : ranked, players, results: Object.fromEntries(results), scores };
}

function applyState() {
  const cur = state?.current;
  if (state.phase === 'round' && cur && cur.players.some((p) => p.key === key)) {
    if (!bridge || bridge.round !== cur.round) openRound(cur);
  } else if (state.phase !== 'results' && player.isOpen()) {
    closeRound();
  }
  if (state.phase !== 'round') status = null;
  render();
}

/* --- rounds: the host's side ----------------------------------------------- */

/**
 * Deal the next game and start its round. From the lobby the next game's card
 * shows while it loads; after a round, it loads under that round's results.
 */
function startRound({ under = false } = {}) {
  if (!isHost() || !state) return;
  const players = seated().map((m) => ({ key: m.key, slot: m.slot, name: m.name }));
  // The host's own picks first, in their order; then Random Mode deals.
  const queued = takeQueued(pool, state.queue, { n: players.length, webgpu: seatsCan().webgpu });
  const pick = queued
    ? { game: queued.game, cycle: state.cycle, played: [...state.played, queued.game.slug], queue: queued.queue, picked: true }
    : pickNext(pool, { seed: state.seed, n: players.length, cycle: state.cycle, played: state.played, ...seatsCan(), filters: state.filters });
  if (!pick) {
    // The notice travels as a code and a count: every player reads it in their own language.
    publish({ ...state, phase: 'lobby', notice: { id: anyFilter(state.filters) ? 'filters' : 'library', count: players.length } });
    return;
  }
  const { game } = pick;
  const info = sessionOf(game);
  const round = state.round + 1;
  const limits = state.knobs || {};
  const current = {
    round,
    slug: game.slug,
    name: game.name,
    path: game.path,
    mode: info.mode,
    seeded: seedsRandom(game.sessionMode),
    limitMs: limits.limitMs ?? limitFor(info.minutes),
    seed: fnv1a(`${state.seed}:${round}`),
    players,
    coordinator: key,
    picked: pick.picked === true,
  };
  const handle = createRound({
    round,
    players,
    hostKey: key,
    mode: info.mode,
    seed: current.seed,
    limitMs: current.limitMs,
    gate: true,
    timings: limits.graceMs ? { loadGraceMs: limits.graceMs } : {},
    deliver: (to, m) => net.send(to, { k: 'h', r: round, m }),
    onStatus: (s) => {
      status = s;
      net.broadcast({ k: 's', t: 'status', status: s });
      render();
    },
    onEnd: (record) => {
      if (coordinator !== handle) return;
      coordinator = null;
      const next = withRoundRecorded(state, record);
      saveRound(next.history.at(-1));
      if (formatOver(next.format, next.history, next.totals)) return endSession(next);
      publish({ ...next, reveal: revealFor(next) });
      dealNext();
    },
  });
  coordinator = handle;
  marks = new Set();
  const reveal = under && state.reveal ? state.reveal : { at: hostNow(), resultsUntil: hostNow(), results: false };
  // The splash's countdown runs from the moment the results make way for it.
  current.splash = { until: Math.max(reveal.resultsUntil, hostNow()) + splashMsOf(state), paused: null, ready: [], marked: 0, notice: 0, released: false };
  publish({ ...state, round, cycle: pick.cycle, played: pick.played, queue: pick.queue ?? cleanQueue(state.queue), phase: 'round', current, reveal, notice: null });
}

/** The splash's countdown: the host's address can set it for trying games, else the lobby's choice. State comes over the network, so anything else is the default. */
const cardSecondsOf = (s) => (CARD_SECONDS.includes(s?.cardSeconds) ? s.cardSeconds : DEFAULT_CARD_SECONDS);
const splashMsOf = (s) => s?.knobs?.splashMs ?? cardSecondsOf(s) * 1000;

/** After a round: its results for `resultsMs`, then the next game's splash. */
function revealFor(s) {
  return { at: hostNow(), resultsUntil: hostNow() + (s.knobs?.resultsMs ?? knobs.resultsMs), results: s.history.length > 0 };
}

/* --- the splash: the host keeps its countdown ------------------------------- */

/** The seats the splash waits on: the round's players who are still in it. */
function splashSeats(cur = state?.current) {
  if (!cur) return [];
  const here = new Set((net?.members() ?? []).map((m) => m.key));
  const out = new Set((status?.round === cur.round ? status.players : []).filter((p) => p.out).map((p) => p.key));
  return cur.players.map((p) => p.key).filter((k) => here.has(k) && !out.has(k));
}

/** A seat pressed Ready or I need more time (host only). */
function applyPress(who, what, round) {
  const cur = state?.current;
  const sp = cur?.splash;
  if (!isHost() || !sp || sp.released || cur.round !== round || !cur.players.some((p) => p.key === who)) return;
  let { ready, until, paused, notice } = sp;
  if (what === 'ready') {
    ready = [...new Set([...ready, who])];
    marks.delete(who);
  } else if (what === 'more') {
    if (marks.has(who)) marks.delete(who);
    else {
      marks.add(who);
      ready = ready.filter((k) => k !== who);
      if (paused !== null) paused += MORE_MS;
      else until += MORE_MS;
      notice = hostNow();
    }
  } else return;
  const seats = splashSeats(cur);
  for (const k of marks) if (!seats.includes(k)) marks.delete(k);
  // More than half asking holds the countdown; fewer than half lets it run again.
  if (paused === null && marks.size > seats.length / 2) paused = Math.max(0, until - hostNow());
  else if (paused !== null && marks.size < seats.length / 2) {
    until = hostNow() + paused;
    paused = null;
  }
  publish({ ...state, current: { ...cur, splash: { ...sp, ready, until, paused, notice, marked: marks.size } } });
  tickSplash();
}

/** Host: end the splash when its countdown runs out or every seat is ready. */
function tickSplash() {
  const cur = state?.current;
  const sp = cur?.splash;
  if (!isHost() || !coordinator || !sp || sp.released || state.phase !== 'round') return;
  const seats = splashSeats(cur);
  if (!seats.length) return;
  const allReady = seats.every((k) => sp.ready.includes(k));
  if (!allReady && (sp.paused !== null || hostNow() < sp.until)) return;
  publish({ ...state, reveal: { ...state.reveal, resultsUntil: Math.min(state.reveal?.resultsUntil ?? 0, hostNow()) }, current: { ...cur, splash: { ...sp, released: true } } });
  coordinator.release();
}

/** This tab presses a splash button: the host applies it, everyone else tells the host. */
function press(what) {
  const cur = state?.current;
  if (!cur?.splash || cur.splash.released || !cur.players.some((p) => p.key === key)) return;
  if (myAnswer.round !== cur.round) myAnswer = { round: cur.round, ready: false, more: false, moreAt: 0 };
  if (what === 'ready') {
    if (myAnswer.ready) return;
    myAnswer = { ...myAnswer, ready: true, more: false };
  } else {
    myAnswer = { ...myAnswer, ready: false, more: !myAnswer.more, moreAt: hostNow() };
  }
  if (isHost()) applyPress(key, what, cur.round);
  else net.send(hostKey(), { k: 's', t: 'press', r: cur.round, what });
  renderResults();
}

/** After a round's results: deal the next game at once, loading under them. */
function dealNext() {
  if (isHost() && state?.phase === 'results') startRound({ under: true });
}

/** Drop the running round without recording it (back to the lobby, or the session ended). */
function discardRound(reason = 'skipped') {
  const handle = coordinator;
  coordinator = null;
  handle?.abort(reason);
}

/** The session's time: the host's clock, so every tab lifts the reveal together. */
const hostNow = () => net?.clock?.now?.() ?? Date.now();

/** The state with the current round written into the history and the table. */
function withRoundRecorded(s, record) {
  const cur = s.current;
  const keyOf = (id) => record.players.find((p) => p.id === id)?.key ?? cur.players[id]?.key;
  const entry = {
    round: cur.round,
    slug: cur.slug,
    name: cur.name,
    mode: cur.mode,
    status: record.status,
    reason: record.reason,
    won: record.won,
    rows: [],
    scores: record.scores ?? null,
    before: Object.fromEntries(leaderboard(s.totals).map((row, i) => [row.key, i + 1])),
  };
  let totals = s.totals;
  if (record.status === 'played' && record.standings) {
    const scored = scoreRound({ standings: record.standings, won: record.won });
    for (const [id, r] of scored) {
      const p = record.players.find((q) => q.id === id);
      const raw = record.results?.[id] ?? (record.scores ? { score: record.scores[id] } : null);
      const awards = (record.awards || []).filter((a) => a.id === id).map(({ title, detail }) => (detail ? { title, detail } : { title }));
      entry.rows.push({ key: keyOf(id), name: p.name, slot: p.slot, place: r.place, points: r.points, win: r.win, out: p.out, ...(raw || {}), stats: record.stats?.[id] ?? null, awards });
    }
    entry.rows.sort((a, b) => a.place - b.place || a.slot - b.slot);
    totals = addRound(totals, entry.rows);
  }
  return { ...s, phase: 'results', current: null, history: [...s.history, entry], totals };
}

/** Online: write the round into the session's record (the first member to report it wins). */
async function saveRound(entry) {
  if (!online || !entry) return;
  const { error } = await online.sb.rpc('record_round', {
    p_session: online.sessionId,
    p_round: entry.round,
    p_slug: entry.slug,
    p_mode: entry.mode ?? null,
    p_status: entry.status === 'played' ? 'played' : entry.reason === 'skipped' ? 'skipped' : 'void',
    p_reason: entry.reason,
    p_scores: entry.scores,
    p_results: entry.rows.map((r) => ({ user_id: r.key, place: r.place, points: r.points, won: r.win, stats: r.stats ?? null, awards: r.awards?.length ? r.awards : null })),
  });
  if (error) console.warn('[session] round not saved:', error.message);
}


/* --- rounds: every seat's side --------------------------------------------- */

function openRound(cur) {
  closeRound();
  // Only a game this browser's library knows is loaded, from the library's own path.
  const found = roundGame(cur, [...pool, ...EXAMPLES]);
  if (!found) {
    // Still loading (the library opens it when it arrives) or not in this copy: the seat sits it out.
    console.warn(`[session] round ${cur.round}: ${cur.slug} is not in this library`);
    return;
  }
  pendingRound = cur;
  player.open(found.game, found.build);
  renderStrip();
}

let pendingRound = null;
let toGame = null;
function attachRound(frame) {
  const cur = pendingRound;
  if (!cur) return;
  toGame = postTo(frame);
  bridge = createBridge({
    key,
    round: cur.round,
    coordinator: cur.coordinator,
    post: toGame,
    net,
    clock: net.clock ?? Date,
    onIssue: (i) => console.warn(`[session] ${i.problem}`),
    onProgress: (id, p) => noteProgress(cur.round, id, p),
    onFullscreen: fullscreen,
    onAnswer: (what) => press(what),
  });
  detach = attachFrame(frame, (msg) => bridge.fromGame(msg));
  for (const [from, env] of early.splice(0)) if (env.r === cur.round) bridge.fromNet(from, env);
}

/** A game asked for fullscreen: the hub's whole page takes it, so the scoreboard and the cards stay over the game. */
function fullscreen(on) {
  const page = document.documentElement;
  if (on && !document.fullscreenElement) page.requestFullscreen?.().catch(() => {});
  else if (!on && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
}

// The game hears when the page goes in or out of fullscreen, so its own toggle stays right.
document.addEventListener('fullscreenchange', () => toGame?.({ aihub: 1, type: 'fullscreen', on: Boolean(document.fullscreenElement) }));

function closeRound() {
  detach?.();
  detach = null;
  bridge = null;
  toGame = null;
  if (player.isOpen()) player.close({ silent: true });
}

function route(from, env) {
  if (!env) return;
  if (env.k === 's') {
    if (env.t === 'state' && env.state && from === hostKey() && from !== key) {
      state = env.state;
      applyState();
    } else if (env.t === 'status' && from === hostKey()) {
      status = env.status;
      render();
    } else if (env.t === 'press' && isHost()) {
      applyPress(from, env.what, env.r);
    } else if (env.t === 'kick' && from === hostKey() && env.key === key) {
      removed = true;
      closeRound();
      net.close();
      render();
    }
    return;
  }
  if (env.k === 'c') {
    if (coordinator && state?.current?.round === env.r) coordinator.receive(from, env.m);
    return;
  }
  if (env.k === 'p') {
    // The scoreboard, and on the host the round, hear progress whatever became of this page's own game.
    const cur = state?.current;
    const p = cleanProgress(env.d);
    if (p && cur?.round === env.r && cur.players[env.f]?.key === from) noteProgress(env.r, env.f, p);
    return;
  }
  if (bridge && env.r === bridge.round) return bridge.fromNet(from, env);
  if ((!bridge || env.r > bridge.round) && early.length < 200) early.push([from, env]);
}

async function leaveSession() {
  closeRound();
  if (online) await online.sb.rpc('leave_session', { p_session: online.sessionId }).then(() => {}, () => {});
  net?.close();
  location.href = FRIENDS_PATH;
}

/** The host removes a player for the rest of the session (online: the database bars them). */
async function kick(member) {
  if (!confirm(t('session.kick.confirm', { name: member.name }))) return;
  if (online) {
    const { error } = await online.sb.rpc('kick_from_session', { p_session: online.sessionId, p_user: member.key });
    if (error) return alert(t('session.kick.failed', { name: member.name, reason: error.message }));
  }
  net.broadcast({ k: 's', t: 'kick', key: member.key });
  coordinator?.leave(member.key, 'kicked');
}

/* --- the screens ------------------------------------------------------------- */

const swatch = (slot) => h('span', { class: 'seat__dot', style: { background: SLOT_COLORS[slot] ?? '#888' } });
const nameOf = (k) => net?.members().find((m) => m.key === k)?.name;

function render() {
  document.body.dataset.phase = !name ? 'join' : state?.phase ?? 'lobby';
  document.body.dataset.host = isHost() ? '1' : '0';
  document.body.dataset.round = String(state?.current?.round ?? state?.round ?? 0);
  window.__session = {
    key,
    state,
    status,
    seat: mine()?.slot ?? null,
    links: Object.fromEntries((net?.members() ?? []).filter((m) => m.key !== key).map((m) => [m.key, net.link?.(m.key) ?? 'local'])),
    // Live, not as of the last render: a host with nothing new to draw mid-round still counts.
    get traffic() {
      return bridge ? { ...bridge.stats } : null;
    },
    get progress() {
      return boardRound === state?.current?.round ? Object.fromEntries(progressById) : {};
    },
    clock: net?.clock ? { offset: net.clock.offset, rtt: net.clock.rtt, following: net.clock.following } : null,
    /** Which card is up: the hub's ('splash'), the game's own ('own'), the results, or none. */
    get card() {
      return revealStage();
    },
  };
  player.refresh();
  // The lobby is drawn afresh on every change: keep the keyboard where it was.
  const focused = app.contains(document.activeElement) && document.activeElement.id;
  clear(app);
  if (removed) app.append(h('section', { class: 'panel panel--note' }, h('h2', {}, t('session.removed.title')), h('a', { class: 'primary', href: FRIENDS_PATH }, t('session.back_to_friends'))));
  else if (superseded)
    app.append(
      h(
        'section',
        { class: 'panel panel--note' },
        h('h2', {}, t('session.superseded.title')),
        h('p', {}, t('session.superseded.text')),
        h('button', { type: 'button', class: 'primary', onclick: () => location.reload() }, t('session.superseded.play_here'))
      )
    );
  else if (!name && transport === 'online' && !code && !(user && !user.guest)) app.append(hostIntro());
  else if (!name) app.append(joinScreen());
  else if (mine().status === 'full')
    app.append(h('section', { class: 'panel panel--note' }, h('h2', {}, t('session.full.title')), h('p', {}, t('session.full.text')), h('a', { class: 'primary', href: FRIENDS_PATH }, t('session.back_to_friends'))));
  else if (state?.phase === 'ended') app.append(endScreen());
  else app.append(lobbyScreen());
  if (focused) document.getElementById(focused)?.focus();
  // Only the host picks, and only in the lobby.
  if (isHost() && name && state?.phase === 'lobby') chooser.refresh();
  else chooser.close();
  renderStrip();
  renderResults();
  renderBoard();
}

/** The game this session opens with, as a card: on the way in, before the lobby. */
function firstCard() {
  const game = firstPick && pool.find((g) => g.slug === firstPick);
  if (!game) return null;
  return h(
    'div',
    { class: 'first-pick', style: paletteVars(cabinetPalette(game)) },
    game.cover && h('img', { class: 'first-pick__shot', src: game.cover, alt: '', loading: 'eager', decoding: 'async', onerror: (e) => e.currentTarget.remove() }),
    h('span', { class: 'first-pick__text' }, h('span', { class: 'first-pick__label' }, t('session.first_pick.label')), h('span', { class: 'first-pick__name' }, game.name), h('span', { class: 'first-pick__meta' }, togetherLine(game)))
  );
}

/** Paste an invite: the code, the link, or a message with the link in it. */
function joinBox() {
  const input = h('input', { type: 'text', id: 'invite-paste', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', placeholder: t('session.join_box.placeholder') });
  const note = h('span', { class: 'hint join-box__note' }, t('session.join_box.note'));
  return h(
    'form',
    {
      class: 'join-box',
      onsubmit(event) {
        event.preventDefault();
        const found = inviteCode(input.value);
        if (!found) {
          note.textContent = t('session.join_box.no_code');
          input.focus();
          return;
        }
        // This page reads its session from the address once: a new hash on the same page needs a reload.
        const target = new URL(joinHref(found), location.href);
        if (target.pathname === location.pathname && target.search === location.search) {
          location.hash = target.hash;
          location.reload();
        } else location.href = target.href;
      },
    },
    h('label', { class: 'join-box__label', for: 'invite-paste' }, t('session.join_box.label')),
    h('span', { class: 'join-box__field' }, input, h('button', { type: 'submit' }, t('session.join_box.join'))),
    note
  );
}

function hostIntro() {
  const tryHref = `${location.pathname}?transport=local${firstPick ? `&first=${encodeURIComponent(firstPick)}` : '&examples=1'}#try`;
  return h(
    'section',
    { class: 'panel intro' },
    emblem({ size: 44, className: 'intro__emblem' }),
    h('h2', {}, t('session.intro.title')),
    h('p', { class: 'intro__blurb' }, t('session.intro.blurb')),
    firstCard(),
    h(
      'button',
      { type: 'button', class: 'primary primary--big', onclick: () => import('../account/auth.js').then((a) => a.signInWithGoogle()).catch(() => alert(t('session.intro.sign_in_failed'))) },
      t('session.intro.sign_in')
    ),
    joinBox(),
    h('p', { class: 'hint' }, tx('session.intro.try', { link: h('a', { href: tryHref }, t('session.intro.try_link')) }))
  );
}

function joinScreen() {
  const taken = net ? net.members().map((m) => m.name).filter(Boolean) : [];
  const choices = nameChoices(`${code}:${key}:${reroll}`, 6, taken);
  const hosting = transport === 'online' && !code;
  const free = net ? [...Array(SEATS).keys()].find((slot) => !net.members().some((m) => m.slot === slot && m.name)) : 0;
  return h(
    'section',
    { class: 'panel join' },
    h('p', { class: 'eyebrow' }, hosting ? t('session.join.hosting') : code && code !== 'local' && code !== 'try' ? t('session.join.joining') : t('session.join.taking')),
    h('h2', {}, hosting ? t('session.join.pick_host') : t('session.join.pick')),
    problem && h('p', { class: 'notice' }, problem),
    h('p', { class: 'hint' }, t('session.join.hint')),
    (hosting || !net?.members().some((m) => m.name)) && firstCard(),
    h(
      'div',
      { class: 'join__names', style: { '--seat': SLOT_COLORS[free ?? 0] ?? SLOT_COLORS[0] } },
      choices.map((choice) => h('button', { type: 'button', class: 'join__name', onclick: () => join(choice) }, choice))
    ),
    h('button', { type: 'button', class: 'link', onclick: () => { reroll++; render(); } }, t('session.join.other_names'))
  );
}

async function join(choice) {
  problem = null;
  if (transport === 'online' && !net) {
    try {
      await joinOnline(choice);
    } catch (error) {
      problem = plainProblem(error);
      render();
      return;
    }
  }
  name = choice;
  claimSeat();
  render();
}

/** Online: host a new session or take a seat in one, then open its channel and mesh. */
async function joinOnline(choice) {
  const { client } = await import('../account/cloud.js');
  const auth = await import('../account/auth.js');
  const sb = await client();
  user = await auth.currentUser();
  let sessionId;
  if (!code) {
    if (!user || user.guest) throw new Error(t('session.join.sign_in_to_host'));
    const { data, error } = await sb.rpc('create_session', { p_nickname: choice });
    if (error) throw error;
    ({ session_id: sessionId, code, slot: fixedSeat } = data[0]);
    history.replaceState(null, '', `${location.pathname}${location.search}#${code}`);
  } else {
    if (!user) user = await auth.signInAsGuest();
    const { data, error } = await sb.rpc('join_session', { p_code: code, p_nickname: choice });
    if (error) throw error;
    ({ session_id: sessionId, slot: fixedSeat } = data[0]);
  }
  key = user.id;
  online = { sb, sessionId };
  const ice = await sb.functions.invoke('turn', { method: 'POST' }).then(
    ({ data }) => data?.iceServers,
    () => null
  );
  let relayOnly = false;
  try {
    relayOnly = localStorage.getItem('ai-hub:relay-only') === '1';
  } catch {
    /* no storage: direct connections allowed */
  }
  const relay = await supabaseRelay(sb, sessionId, key);
  net = createRelayNet({ key, relay, iceServers: ice || [{ urls: 'stun:stun.cloudflare.com:3478' }], relayOnly });
  wire();
}

function wire() {
  net.onMembers(membersChanged);
  net.onMessage(route);
  net.onSuperseded?.(() => {
    superseded = true;
    closeRound();
    render();
  });
}

function lobbyScreen() {
  const seats = seated();
  const n = seats.length;
  const fits = countGames(eligible(pool, n, { ...seatsCan(), filters: state?.filters }));
  const none = anyFilter(state?.filters) ? t('session.lobby.none_filters', { count: n }) : t('session.lobby.none_yet', { count: n });
  const cur = state?.current;
  const host = isHost();
  const inRound = state?.phase === 'round' && cur && !cur.players.some((p) => p.key === key);
  const next = takeQueued(pool, state?.queue, { n, webgpu: seatsCan().webgpu });
  return h(
    'section',
    { class: 'panel lobby' },
    h(
      'div',
      { class: 'lobby__main' },
      h(
        'header',
        { class: 'lobby__head' },
        h('h2', {}, t('session.lobby.table')),
        h('span', { class: 'lobby__count' }, t('session.lobby.seats_taken', { taken: n, total: SEATS }))
      ),
      h(
        'ol',
        { class: 'seats' },
        [...Array(SEATS).keys()].map((slot) => {
          const m = seats.find((s) => s.slot === slot);
          return h(
            'li',
            { class: `seat${m ? '' : ' is-empty'}${m?.key === key ? ' is-me' : ''}`, style: { '--seat': SLOT_COLORS[slot] } },
            h('span', { class: 'seat__puck', 'aria-hidden': 'true' }, String(slot + 1)),
            h('span', { class: 'seat__name' }, m ? m.name : t('session.lobby.open_seat')),
            h(
              'span',
              { class: 'seat__tags' },
              m?.key === key && h('span', { class: 'seat__tag' }, t('session.lobby.you')),
              m && m.key === hostKey() && h('span', { class: 'seat__tag' }, t('session.lobby.host')),
              m && m.key !== key && net.link?.(m.key) === 'failed' && h('span', { class: 'seat__tag is-bad' }, t('session.lobby.no_connection')),
              !m && h('span', { class: 'seat__tag is-quiet' }, transport === 'online' ? t('session.lobby.waiting_friend') : t('session.lobby.open_tab'))
            ),
            m && m.key !== key && isHost() && transport !== 'local' && h('button', { type: 'button', class: 'link seat__kick', onclick: () => kick(m) }, t('session.lobby.remove'))
          );
        })
      ),
      transport === 'online'
        ? inviteLine()
        : h(
            'p',
            { class: 'invite invite--local' },
            h('span', { class: 'invite__label' }, t('session.lobby.more_players')),
            h('span', {}, tx('session.lobby.open_again', { link: h('a', { href: `${location.pathname}?transport=local${knobs.examples ? '&examples=1' : ''}#${encodeURIComponent(code)}`, target: '_blank' }, t('session.lobby.new_seat')) }))
          ),
      state?.notice && h('p', { class: 'notice' }, noticeText(state.notice)),
      inRound && h('p', { class: 'notice' }, t('session.lobby.in_round', { game: cur.name })),
      upNext(n),
      host && state?.phase === 'lobby'
        ? h(
            'div',
            { class: 'lobby__start' },
            h(
              'button',
              { type: 'button', class: 'primary primary--big', id: 'start', disabled: !fits && !next ? true : undefined, onclick: () => startRound() },
              next ? t('session.lobby.start_with', { game: next.game.name }) : t('session.lobby.start_random')
            ),
            h('span', { class: 'hint' }, next ? (fits ? t('session.lobby.then_deals_from', { count: fits }) : t('session.lobby.then_deals')) : fits ? t('session.lobby.fits', { count: fits, games: t('session.games', { count: fits }), players: t('session.players', { count: n }) }) : none)
          )
        : state?.phase === 'lobby' && h('p', { class: 'hint lobby__wait' }, nameOf(hostKey()) ? t('session.lobby.waiting_host', { name: nameOf(hostKey()) }) : t('session.lobby.waiting_host_unknown')),
      host && (state?.phase !== 'lobby' || state.history.length > 0) && h('button', { type: 'button', class: 'link', onclick: () => endSession() }, t('session.end_session'))
    ),
    h(
      'aside',
      { class: 'lobby__side', 'aria-label': t('session.lobby.settings') },
      formatPicker(),
      cardPicker(),
      filterPicker(n),
      transport === 'online' && relaySwitch()
    ),
    standingsTable()
  );
}

/**
 * The host's picks: the games the session plays first, in order, before the
 * hub deals the rest. The host adds and removes them in the lobby; everyone
 * sees them.
 */
function upNext(n) {
  const host = isHost() && state?.phase === 'lobby';
  const queue = cleanQueue(state?.queue);
  const can = new Set(pickable(pool, n, { webgpu: seatsCan().webgpu }).map((g) => g.slug));
  const items = queue.map((slug) => ({ slug, game: pool.find((g) => g.slug === slug) })).filter((item) => item.game);
  if (!host && !items.length) return null;
  const remove = (slug) => publish({ ...state, notice: null, queue: queue.filter((s) => s !== slug) });
  return h(
    'section',
    { class: 'upnext', 'aria-labelledby': 'upnext-title' },
    h(
      'header',
      { class: 'upnext__head' },
      h('h3', { id: 'upnext-title' }, t('session.upnext.title')),
      host && items.length < MOST_PICKS && h('button', { type: 'button', class: 'upnext__add', id: 'choose', onclick: () => chooser.open() }, items.length ? t('session.upnext.pick_more') : t('session.upnext.pick'))
    ),
    items.length
      ? h(
          'ol',
          { class: 'upnext__list' },
          items.map(({ slug, game }, i) =>
            h(
              'li',
              { class: `upnext__item${can.has(slug) ? '' : ' is-waiting'}`, style: paletteVars(cabinetPalette(game)) },
              h('span', { class: 'upnext__n' }, String(i + 1)),
              game.cover ? h('img', { class: 'upnext__shot', src: game.cover, alt: '', loading: 'lazy', decoding: 'async', onerror: (e) => e.currentTarget.remove() }) : h('span', { class: 'upnext__shot' }),
              h(
                'span',
                { class: 'upnext__text' },
                h('span', { class: 'upnext__name' }, game.name),
                h('span', { class: 'upnext__meta' }, can.has(slug) ? togetherLine(game) : sessionOf(game)?.seats?.[0] > n ? t('session.upnext.waits_players', { count: sessionOf(game).seats[0] }) : t('session.upnext.waits_webgpu'))
              ),
              host && h('button', { type: 'button', class: 'upnext__remove', 'aria-label': t('session.upnext.remove', { game: game.name }), onclick: () => remove(slug) }, '✕')
            )
          )
        )
      : h('p', { class: 'hint upnext__empty' }, t('session.upnext.empty')),
    items.length > 0 && h('p', { class: 'hint upnext__then' }, t('session.upnext.then'))
  );
}

/** How this session is won: the host picks before the first round; everyone sees it. */
function formatPicker() {
  const chosen = state?.format ?? DEFAULT_FORMAT;
  const editable = isHost() && state?.phase === 'lobby' && !state.history.length;
  if (!editable) return h('p', { class: 'hint format-line' }, t('session.format.line', { format: formatOf(chosen).label, blurb: formatOf(chosen).blurb }));
  return h(
    'fieldset',
    { class: 'formats' },
    h('legend', {}, t('session.format.legend')),
    Object.entries(FORMATS).map(([id, format]) =>
      h(
        'label',
        { class: `format${id === chosen ? ' is-chosen' : ''}` },
        h('input', { type: 'radio', name: 'format', id: `format-${id}`, value: id, checked: id === chosen, onchange: () => publish({ ...state, format: id }) }),
        h('span', { class: 'format__name' }, format.label),
        h('span', { class: 'format__blurb' }, format.blurb)
      )
    )
  );
}

/** How long the next game's card counts down: the host picks in the lobby, between rounds too; everyone sees it. */
function cardPicker() {
  const chosen = cardSecondsOf(state);
  if (state?.knobs?.splashMs) return null;
  if (!isHost() || state?.phase !== 'lobby') return h('p', { class: 'hint format-line' }, t('session.card.line', { count: chosen }));
  return h(
    'fieldset',
    { class: 'filters' },
    h('legend', {}, t('session.card.legend')),
    h(
      'div',
      { class: 'filters__group', role: 'radiogroup', 'aria-label': t('session.card.timer') },
      h('span', { class: 'filters__label', 'aria-hidden': 'true' }, t('session.card.timer')),
      h(
        'div',
        { class: 'filters__options' },
        CARD_SECONDS.map((sec) =>
          h(
            'label',
            { class: `filter${sec === chosen ? ' is-chosen' : ''}`, title: t('session.card.option_hint', { count: sec }) },
            h('input', { type: 'radio', name: 'card-seconds', id: `card-${sec}`, value: sec, checked: sec === chosen, onchange: () => publish({ ...state, cardSeconds: sec }) }),
            h('span', { class: 'filter__name' }, t('session.card.option', { seconds: sec }))
          )
        )
      )
    )
  );
}

/**
 * Which games the deal draws from: the host narrows it in the lobby (before the
 * first round, or after going back to it), and everyone else sees what was
 * chosen. A group with nothing chosen keeps every game.
 */
function filterPicker(n) {
  const filters = state?.filters ?? {};
  if (!isHost() || state?.phase !== 'lobby') {
    const chosen = describeFilters(filters);
    return chosen && h('p', { class: 'hint format-line' }, t('session.filter.games_line', { chosen }));
  }
  const groups = filterChoices(pool, n, { ...seatsCan(), filters }).filter((g) => g.options.length > 1 || g.options.some((o) => o.chosen));
  if (!groups.length) return null;
  return h(
    'fieldset',
    { class: 'filters' },
    h('legend', {}, t('session.filter.legend')),
    groups.map((group) =>
      h(
        'div',
        { class: 'filters__group', role: 'group', 'aria-label': group.label },
        h('span', { class: 'filters__label', 'aria-hidden': 'true' }, group.label),
        h(
          'div',
          { class: 'filters__options' },
          group.options.map((o) =>
            h(
              'label',
              { class: `filter${o.chosen ? ' is-chosen' : ''}${o.count ? '' : ' is-empty'}`, title: o.blurb },
              h('input', {
                type: 'checkbox',
                id: `filter-${group.key}-${o.value.replace(/[^a-z0-9]+/gi, '-')}`,
                checked: o.chosen,
                disabled: !o.chosen && !o.count,
                onchange: (e) => publish({ ...state, notice: null, filters: toggleFilter(filters, group.key, o.value, e.target.checked) }),
              }),
              h('span', { class: 'filter__name' }, o.label),
              h('span', { class: 'filter__count' }, String(o.count))
            )
          )
        )
      )
    ),
    h(
      'p',
      { class: 'hint filters__note' },
      anyFilter(filters)
        ? h('button', { type: 'button', class: 'link', id: 'filters-clear', onclick: () => publish({ ...state, notice: null, filters: {} }) }, t('session.filter.clear'))
        : t('session.filter.note')
    )
  );
}

/** Relay only: every connection goes through the TURN relay, so nobody sees this device's address. */
function relaySwitch() {
  let on = false;
  try {
    on = localStorage.getItem(RELAY_KEY) === '1';
  } catch {
    /* no storage: the switch still works for this page */
  }
  return h(
    'label',
    { class: 'relay-switch' },
    h('input', {
      type: 'checkbox',
      checked: on,
      onchange: (e) => {
        try {
          if (e.target.checked) localStorage.setItem(RELAY_KEY, '1');
          else localStorage.removeItem(RELAY_KEY);
        } catch {
          /* kept for this page only */
        }
        net?.relayOnly?.(e.target.checked);
      },
    }),
    h('span', { class: 'relay-switch__name' }, t('session.relay.name')),
    h('span', { class: 'hint' }, t('session.relay.hint'))
  );
}

function inviteLine() {
  const link = `${location.origin}/session#${code}`;
  const copy = h(
    'button',
    { type: 'button', class: 'invite__copy', onclick: () => navigator.clipboard?.writeText(link).then(() => (copy.textContent = t('session.invite.copied')), () => (copy.textContent = t('session.invite.select'))) },
    t('session.invite.copy')
  );
  const share =
    typeof navigator.share === 'function' &&
    h(
      'button',
      { type: 'button', class: 'invite__share', onclick: () => navigator.share({ title: t('session.invite.share_title'), text: t('session.invite.share_text'), url: link }).catch(() => {}) },
      t('session.invite.share')
    );
  return h(
    'div',
    { class: 'invite' },
    h('span', { class: 'invite__label' }, t('session.invite.label')),
    h('code', { class: 'invite__link' }, link),
    h('span', { class: 'invite__buttons' }, copy, share),
    h('span', { class: 'hint invite__note' }, t('session.invite.note'))
  );
}

function standingsTable({ before = null } = {}) {
  const rows = leaderboard(state?.totals || {});
  if (!rows.length) return null;
  const move = (row, i) => {
    const was = before?.[row.key];
    if (!was || was === i + 1) return null;
    return h('span', { class: `move ${was > i + 1 ? 'is-up' : 'is-down'}` }, was > i + 1 ? `▲${was - i - 1}` : `▼${i + 1 - was}`);
  };
  return h(
    'table',
    { class: 'table' },
    h('caption', {}, t('session.standings.caption', { count: state.history.length })),
    h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, t('session.table.player')), h('th', {}, t('session.table.points')), h('th', {}, t('session.table.wins')), h('th', {}, t('session.table.awards')), h('th', {}, t('session.table.rounds')))),
    h(
      'tbody',
      {},
      rows.map((row, i) =>
        h(
          'tr',
          {},
          h('td', {}, String(i + 1), ' ', move(row, i)),
          h('td', {}, swatch(row.slot), ' ', row.name),
          h('td', {}, String(row.points)),
          h('td', {}, String(row.wins)),
          h('td', {}, String(row.awards || 0)),
          h('td', {}, String(row.rounds))
        )
      )
    )
  );
}

/**
 * Over the game while a round runs: who we're waiting for, and the host's
 * controls. It rides in the player's own corner bar, so a session looks like
 * playing alone with the table added on.
 */
function renderStrip() {
  clear(strip);
  const cur = state?.current;
  strip.hidden = !(state?.phase === 'round' && cur && player.isOpen());
  if (strip.hidden) return;
  const slot = player.slot();
  if (slot && strip.parentNode !== slot) slot.append(strip);
  // Once the splash is over, the games still loading hold up the start.
  const waiting = status?.phase === 'loading' && cur.splash?.released ? status.players.filter((p) => !p.ready && !p.out).map((p) => p.name) : [];
  // Native append would print a false or null child as text: drop them first.
  strip.append(...[
    h('span', { class: 'strip__title' }, formatProgress(state.format, state.history, state.totals)),
    waiting.length ? h('span', {}, t('session.strip.waiting', { names: list(waiting) })) : status?.phase === 'grace' ? h('span', {}, t('session.strip.time')) : null,
    isHost() && h('button', { type: 'button', onclick: () => coordinator?.timeUp() }, t('session.strip.end_round')),
  ].filter(Boolean));
}

/* --- the scoreboard: everyone's progress, live, over the game ----------------- */

const BOARD_KEY = 'ai-hub:board';
/** Over the game, top right, clear of the corner bar: one row a player, for games that report progress. */
const board = h('aside', { class: 'session-board', 'aria-label': t('session.board.label'), hidden: true });
let boardRound = null;
let progressById = new Map();

function noteProgress(round, id, p) {
  if (boardRound !== round) {
    boardRound = round;
    progressById = new Map();
  }
  progressById.set(id, p);
  // The round ranks a player who never reports by the last progress seen (lib/hub/round.js).
  if (coordinator && state?.current?.round === round) coordinator.progress(id, p.score);
  renderBoard();
}

const boardFolded = () => {
  try {
    return localStorage.getItem(BOARD_KEY) === 'folded';
  } catch {
    return false;
  }
};

function foldBoard() {
  try {
    localStorage.setItem(BOARD_KEY, boardFolded() ? 'shown' : 'folded');
  } catch {
    /* storage blocked: it just does not stick */
  }
  renderBoard();
  // Most games pause when their window loses focus: give it straight back.
  player.focusGame();
}

function renderBoard() {
  const cur = state?.current;
  board.hidden = true;
  if (!cur || boardRound !== cur.round || !player.isOpen() || revealStage() !== 'none') return;
  const players = status && status.round === cur.round ? status.players : cur.players.map((p, id) => ({ ...p, id, color: SLOT_COLORS[p.slot] }));
  const rows = liveOrder(players.map((p) => ({ id: p.id, key: p.key, name: p.name, color: p.color, out: p.out, result: p.result ?? null, progress: progressById.get(p.id) ?? null })));
  board.hidden = !rows.some((r) => r.progress || r.result);
  if (board.hidden) return;
  const root = document.getElementById('player');
  if (board.parentNode !== root) root.append(board);
  const folded = boardFolded();
  clear(board);
  // The button never takes focus from the game (pointerdown's default would).
  board.append(h('button', { type: 'button', class: 'board__toggle', 'aria-expanded': String(!folded), onpointerdown: (e) => e.preventDefault(), onclick: foldBoard }, folded ? t('session.board.folded') : t('session.board.shown')));
  if (folded) return;
  board.append(
    h(
      'ol',
      { class: 'board__rows' },
      ...rows.map((r, i) =>
        h(
          'li',
          { class: r.key === key ? 'is-me' : r.out ? 'is-out' : '', style: `--seat: ${r.color}` },
          h('span', { class: 'board__place' }, r.out ? '–' : String(i + 1)),
          h('span', { class: 'board__name' }, r.name),
          h('span', { class: 'board__label' }, r.out ? t('session.board.left') : r.result ? t('session.board.done') : (r.progress?.label ?? '')),
          h('span', { class: 'board__score' }, r.result ? resultText(r.result) : r.progress ? String(r.progress.score) : '')
        )
      )
    )
  );
}

/** Why a round gave no points, for the headline: lowercase, the end of a sentence. */
const REASONS = {
  'host-left': () => t('session.reason.host_left'),
  'host-not-ready': () => t('session.reason.host_not_ready'),
  'host-hidden': () => t('session.reason.host_hidden'),
  'host-error': () => t('session.reason.host_error'),
  'no-result': () => t('session.reason.no_result'),
  'no-players': () => t('session.reason.no_players'),
  skipped: () => t('session.reason.skipped'),
};
const reasonText = (reason) => (Object.hasOwn(REASONS, reason) ? REASONS[reason]() : reason);

/** The lobby's notice from the host: a code and a count (older state carried the words themselves). */
const noticeText = (notice) =>
  typeof notice === 'string' ? notice : notice?.id === 'filters' ? t('session.notice.filters', { count: notice.count }) : notice?.id === 'library' ? t('session.notice.library', { count: notice.count }) : '';

const resultText = (row) =>
  Number.isFinite(row.time) ? t('session.result.seconds', { seconds: (row.time / 1000).toFixed(2) }) : Number.isFinite(row.score) ? String(row.score) : '';

/* --- between rounds: the results, then the next game -------------------------- */

let shown = '';
let lifted = true;

/** "1.1.0" < "1.2.0": a game whose client predates the splash shows its own ready prompt. */
const olderThan = (version, than) => {
  const a = String(version || '0').split('.').map(Number);
  const b = than.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((a[i] || 0) !== b[i]) return (a[i] || 0) < b[i];
  return false;
};

/** This seat's game is an older one still waiting for its own ready key. */
function waitsForMyKey() {
  const me = status?.round === state?.current?.round ? status.players.find((p) => p.key === key) : null;
  return Boolean(me && me.hello && !me.ready && !me.out && olderThan(me.client, '1.2.0'));
}

/** Which part of the reveal is on: the last round's results, the next game's splash, or nothing. */
function revealStage() {
  if (!state || state.phase === 'ended') return 'none';
  const cur = state.current;
  // The 3-2-1 has begun: lift the card for it.
  if (status && cur && status.round === cur.round && status.phase !== 'loading') return 'none';
  if (state.reveal?.results && state.history.length && hostNow() < state.reveal.resultsUntil) return 'results';
  if (cur && state.phase === 'round' && cur.splash) {
    if (bridge?.round === cur.round && bridge.showsCard) return 'own';
    return cur.splash.released && waitsForMyKey() ? 'none' : 'splash';
  }
  return 'none';
}

/** The game's own card: what it needs to show the countdown and who is ready, sent when any of it changes. */
let cardSent = '';
function sendCard(cur) {
  const sp = cur.splash;
  const seats = splashSeats(cur);
  const ids = status?.round === cur.round ? new Map(status.players.map((p) => [p.key, p.id])) : new Map([...cur.players].sort((a, b) => a.slot - b.slot).map((p, id) => [p.key, id]));
  if (myAnswer.round !== cur.round) myAnswer = { round: cur.round, ready: false, more: false, moreAt: 0 };
  const paused = sp.paused !== null && !sp.released;
  const left = sp.released || paused ? null : Math.max(0, sp.until - hostNow());
  const card = {
    left,
    paused,
    starting: sp.released,
    ready: sp.ready.filter((k) => seats.includes(k) && ids.has(k)).map((k) => ids.get(k)).sort((a, b) => a - b),
    asking: sp.marked,
    asked: myAnswer.more,
  };
  // Once a second at least, as the countdown ticks, and at once when anything else changes.
  const id = JSON.stringify({ ...card, left: left === null ? null : Math.ceil(left / 1000), round: cur.round });
  if (id === cardSent) return;
  cardSent = id;
  bridge.card(card);
}

function renderResults() {
  const stage = revealStage();
  const id = `${stage}:${state?.round}:${state?.history.length}`;
  if (id !== shown) {
    shown = id;
    clear(overlay);
    overlay.hidden = stage === 'none' || stage === 'own';
    if (stage === 'results') overlay.append(resultsCard(state.history.at(-1)));
    if (stage === 'splash') {
      overlay.append(splashCard(state.current));
      overlay.querySelector('.splash__ready')?.focus({ preventScroll: true });
    }
  }
  const count = overlay.querySelector('.results__count');
  if (count && stage === 'results') count.textContent = t('session.results.next_in', { seconds: Math.max(0, Math.ceil((state.reveal.resultsUntil - hostNow()) / 1000)) });
  if (stage === 'splash') updateSplash(state.current);
  if (stage === 'own') sendCard(state.current);
  // The card lifted, or the game shows its own: hand the keyboard to the game.
  const toGameNow = stage === 'none' || stage === 'own';
  if (toGameNow && !lifted) document.querySelector('#player iframe')?.focus();
  lifted = toGameNow;
}

const MEDALS = ['🥇', '🥈', '🥉'];
/** "Ana", "Ana and Bo", "Ana, Bo and Cy". */
const names = (people) => list(people);
const statsLine = (stats) =>
  stats ? Object.entries(stats).map(([name, value]) => `${name} ${typeof value === 'number' ? Math.round(value * 100) / 100 : value}`).join(' · ') : '';

/** A shared world that said whether the team won: shown as the team's result, without medals. */
const teamResult = (entry) => typeof entry.won === 'boolean';

function headline(entry) {
  if (entry.status !== 'played') return t('session.results.no_points', { reason: reasonText(entry.reason) });
  const winners = entry.rows.filter((r) => r.place === 1);
  if (teamResult(entry)) return entry.won ? t('session.results.team_won') : t('session.results.team_short');
  if (winners.length === entry.rows.length && winners.length > 1) return t('session.results.dead_heat');
  if (winners.length > 1) return t('session.results.share_win', { names: names(winners.map((r) => r.name)) });
  return winners.length ? t('session.results.wins', { name: winners[0].name }) : t('session.results.over');
}

function resultsCard(entry) {
  const host = isHost();
  return h(
    'div',
    { class: 'results__card is-results' },
    h('p', { class: 'eyebrow' }, t('session.results.eyebrow', { round: entry.round, game: entry.name })),
    h('h2', { class: 'results__headline' }, headline(entry)),
    entry.status === 'played' &&
      h(
        'ol',
        { class: 'results__rows' },
        entry.rows.map((row, i) =>
          h(
            'li',
            { style: { '--i': i } },
            h('span', { class: 'results__place' }, row.place <= 3 && !teamResult(entry) ? MEDALS[row.place - 1] : String(row.place)),
            swatch(row.slot),
            h(
              'span',
              { class: 'results__who' },
              h('span', { class: 'results__name' }, row.name, row.out ? [' ', row.out === 'not-ready' ? t('session.results.sat_out') : t('session.results.left')] : ''),
              row.awards?.length > 0 &&
                h('span', { class: 'results__awards' }, row.awards.map((a) => h('span', { class: 'award', title: a.detail || '' }, '🏅 ', a.title, a.detail ? h('small', {}, ` ${a.detail}`) : null))),
              row.stats && h('span', { class: 'results__stats' }, statsLine(row.stats))
            ),
            h('span', { class: 'results__score' }, resultText(row)),
            h('span', { class: 'results__points' }, `+${row.points}`)
          )
        )
      ),
    standingsTable({ before: entry.before }),
    h(
      'div',
      { class: 'results__next' },
      h('span', { class: 'hint results__count' }),
      host && h('button', { type: 'button', class: 'primary', onclick: nextGameNow }, t('session.results.next_now')),
      host && h('button', { type: 'button', onclick: backToLobby }, t('session.back_to_lobby')),
      host && h('button', { type: 'button', onclick: () => endSession() }, t('session.end_session'))
    )
  );
}


/** Host: skip the rest of the results; the splash starts its countdown now. */
function nextGameNow() {
  const cur = state.current;
  const splash = cur?.splash && !cur.splash.released && cur.splash.paused === null ? { ...cur.splash, until: hostNow() + splashMsOf(state) } : cur?.splash;
  publish({ ...state, reveal: { ...state.reveal, resultsUntil: hostNow() }, current: cur ? { ...cur, splash } : cur });
}

/** The next game's splash: a quick spin through the deck that lands on it, what it takes to win, and the countdown. */
function splashCard(cur) {
  const game = pool.find((g) => g.slug === cur.slug);
  const info = game ? sessionOf(game) : null;
  // The spin passes the other games once each, starting somewhere new every round.
  const others = [...new Set(eligible(pool, cur.players.length, { ...seatsCan(), filters: state.filters }).filter((g) => g.slug !== cur.slug).map((g) => g.name))];
  const start = others.length ? cur.round % others.length : 0;
  const reel = [...others.slice(start), ...others.slice(0, start)].filter((n) => n !== cur.name).slice(0, 6);
  const playing = cur.players.some((p) => p.key === key);
  return h(
    'div',
    { class: 'results__card is-next' },
    h('p', { class: 'eyebrow' }, (cur.picked ? t('session.splash.pick', { progress: formatProgress(state.format, state.history, state.totals) }) : t('session.splash.next', { progress: formatProgress(state.format, state.history, state.totals) }))),
    reel.length > 0 && h('div', { class: 'reel', 'aria-hidden': 'true' }, h('div', { class: 'reel__strip', style: { '--n': reel.length } }, reel.map((n) => h('span', {}, n)), h('span', { class: 'is-it' }, cur.name))),
    h('h2', { class: 'next__name' }, cur.name),
    h(
      'p',
      { class: 'next__mode' },
      h('span', { class: 'chip' }, modeName(cur.mode)),
      ' ',
      t('session.players', { count: cur.players.length })
    ),
    info?.goal && h('p', { class: 'next__goal' }, info.goal),
    info?.howto && h('p', { class: 'next__howto' }, info.howto),
    h('p', { class: 'splash__count', 'aria-live': 'polite' }),
    playing &&
      h(
        'div',
        { class: 'splash__buttons' },
        h('button', { type: 'button', class: 'primary splash__ready', onclick: () => press('ready') }, t('session.splash.ready'), h('small', {}, ' ', t('session.splash.ready_keys'))),
        h('button', { type: 'button', class: 'splash__more', onclick: () => press('more') }, t('session.splash.more'), h('small', {}, ' ', t('session.splash.more_key')))
      ),
    h('p', { class: 'hint splash__note', 'aria-live': 'polite' }),
    isHost() && h('div', { class: 'results__next' }, h('button', { type: 'button', onclick: backToLobby }, t('session.back_to_lobby')))
  );
}

/** The splash's live parts, every tick: the countdown, who is ready, and the notes. */
function updateSplash(cur) {
  const sp = cur?.splash;
  if (!sp) return;
  if (myAnswer.round !== cur.round) myAnswer = { round: cur.round, ready: false, more: false, moreAt: 0 };
  const seats = splashSeats(cur);
  const readyCount = sp.ready.filter((k) => seats.includes(k)).length;
  const loading = status?.round === cur.round ? status.players.filter((p) => !p.ready && !p.out).length : 0;
  const count = overlay.querySelector('.splash__count');
  if (count) {
    count.textContent = sp.released
      ? loading
        ? t('session.splash.loading', { count: loading })
        : t('session.splash.starting')
      : sp.paused !== null
        ? t('session.splash.paused')
        : t('session.splash.starts_in', { seconds: Math.max(0, Math.ceil((sp.until - hostNow()) / 1000)) });
    count.classList.toggle('is-paused', sp.paused !== null && !sp.released);
  }
  const ready = overlay.querySelector('.splash__ready');
  const more = overlay.querySelector('.splash__more');
  if (ready) {
    ready.disabled = sp.released || myAnswer.ready;
    ready.firstChild.textContent = myAnswer.ready ? t('session.splash.ready_done') : t('session.splash.ready');
  }
  if (more) {
    more.disabled = sp.released;
    more.setAttribute('aria-pressed', String(myAnswer.more));
    more.firstChild.textContent = myAnswer.more ? t('session.splash.more_undo') : t('session.splash.more');
  }
  const note = overlay.querySelector('.splash__note');
  if (note) {
    const someoneAsked = sp.notice && hostNow() - sp.notice < 4_000 && !(myAnswer.more && Math.abs(sp.notice - myAnswer.moreAt) < 1_500);
    note.textContent = [
      t('session.splash.ready_count', { ready: readyCount, total: seats.length }),
      myAnswer.more ? t('session.splash.you_asked') : someoneAsked ? t('session.splash.someone_asked') : sp.marked ? t('session.splash.n_asking', { count: sp.marked }) : '',
    ]
      .filter(Boolean)
      .join(' · ');
  }
}

function backToLobby() {
  discardRound('skipped');
  publish({ ...state, phase: 'lobby', current: null, reveal: null });
}

/** End the session: everyone sees the final table, with the session's awards. */
function endSession(from = state) {
  discardRound('session-ended');
  if (online) online.sb.rpc('end_session', { p_session: online.sessionId }).then(() => {}, () => {});
  const format = formatOf(from.format);
  const awards = sessionAwards(from.history, from.totals);
  const table = finalTable(from.totals, awards, format.bonus);
  publish({ ...from, phase: 'ended', current: null, reveal: null, final: { awards, table, bonus: format.bonus } });
}

function endScreen() {
  const final = state.final ?? { awards: [], table: finalTable(state.totals || {}, [], 0), bonus: 0 };
  const rows = final.table;
  const champions = rows.filter((r) => r.place === 1);
  const nameOfKey = (k) => rows.find((r) => r.key === k)?.name ?? '';
  // The top three in table order, drawn second–first–third; a shared place shares its medal.
  const podium = [rows[1], rows[0], rows[2]];
  return h(
    'section',
    { class: 'panel finale' },
    h('p', { class: 'eyebrow' }, t('session.finale.eyebrow', { format: formatOf(state.format).label, rounds: t('session.rounds', { count: state.history.filter((e) => e.status === 'played').length }) })),
    h('h2', {}, rows.length ? (champions.length > 1 ? t('session.finale.share_crown', { names: names(champions.map((r) => r.name)) }) : t('session.finale.wins', { name: champions[0].name })) : t('session.finale.over')),
    rows.length > 0 &&
      h(
        'div',
        { class: 'podium' },
        podium.map((row, i) =>
          row
            ? h(
                'div',
                { class: `podium__step is-${['second', 'first', 'third'][i]}` },
                h('span', { class: 'podium__medal' }, MEDALS[row.place - 1] ?? ''),
                swatch(row.slot),
                h('span', { class: 'podium__name' }, row.name),
                h('span', { class: 'podium__points' }, t('session.finale.pts', { points: row.points }))
              )
            : h('div', { class: 'podium__step is-empty' })
        )
      ),
    final.awards.length > 0 &&
      h(
        'ul',
        { class: 'finale__awards' },
        final.awards.map((a) => {
          const text = awardText(a);
          return h('li', {}, h('strong', {}, `🏆 ${text.title}`), ' ', t('session.finale.award_line', { names: names(a.keys.map(nameOfKey)), detail: text.detail }), final.bonus ? h('span', { class: 'bonus' }, ` +${final.bonus}`) : null);
        })
      ),
    rows.length
      ? h(
          'table',
          { class: 'table' },
          h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, t('session.table.player')), h('th', {}, t('session.table.points')), final.bonus ? h('th', {}, t('session.table.bonus')) : null, h('th', {}, t('session.table.wins')), h('th', {}, t('session.table.awards')))),
          h(
            'tbody',
            {},
            rows.map((row) =>
              h(
                'tr',
                {},
                h('td', {}, String(row.place)),
                h('td', {}, swatch(row.slot), ' ', row.name),
                h('td', {}, String(row.points)),
                final.bonus ? h('td', {}, row.bonus ? `+${row.bonus}` : '') : null,
                h('td', {}, String(row.wins)),
                h('td', {}, String(row.awards || 0))
              )
            )
          )
        )
      : h('p', { class: 'hint' }, t('session.finale.none')),
    h(
      'ol',
      { class: 'history' },
      state.history.map((e) =>
        h(
          'li',
          {},
          e.status === 'played'
            ? teamResult(e)
              ? e.won ? t('session.history.team_won', { round: e.round, game: e.name }) : t('session.history.team_short', { round: e.round, game: e.name })
              : t('session.history.won_by', { round: e.round, game: e.name, names: names(e.rows.filter((r) => r.place === 1).map((r) => r.name)) })
            : t('session.history.no_points', { round: e.round, game: e.name })
        )
      )
    ),
    h('div', { class: 'finale__out' }, h('a', { class: 'primary', href: FRIENDS_PATH }, t('session.back_to_friends')), h('a', { class: 'link', href: '/' }, t('session.to_wall')))
  );
}

/**
 * The controller on the splash: Cross is Ready, Triangle asks for more time.
 * The pads are read through the game's frame as well, which may be the one
 * that has focus.
 */
let padWas = [];
function splashPad() {
  requestAnimationFrame(splashPad);
  if (revealStage() !== 'splash') {
    padWas = [];
    return;
  }
  const lists = [];
  try {
    lists.push(document.querySelector('#player iframe')?.contentWindow?.navigator?.getGamepads?.() || []);
  } catch {
    /* cross-origin */
  }
  lists.push(navigator.getGamepads?.() || []);
  const pad = lists.flatMap((l) => [...l]).find((p) => p && p.connected);
  const now = pad ? pad.buttons.map((b) => b.pressed) : [];
  if (now[PAD.cross] && !padWas[PAD.cross]) press('ready');
  if (now[PAD.triangle] && !padWas[PAD.triangle]) press('more');
  padWas = now;
}

/* --- start ------------------------------------------------------------------ */

async function main() {
  // The library can take a moment: the page works without it, and counts games once it is in.
  pool = EXAMPLES;
  loadManifest().then(
    (d) => {
      pool = sessionPool(d.games, EXAMPLES, knobs.examples);
      // A round dealt while the library was loading could not open yet.
      if (state) applyState();
      else render();
    },
    () => {}
  );
  if (transport === 'local') {
    net = createLocalNet({ code, key });
    wire();
  } else if (transport === 'relay') {
    net = createRelayNet({ key, relay: window.__sessionRelay(key), iceServers: [] });
    wire();
  } else {
    user = await import('../account/auth.js').then((a) => a.currentUser(), () => null);
  }
  setInterval(() => {
    if (net && isHost() && state) net.broadcast({ k: 's', t: 'state', state });
  }, STATE_EVERY_MS / 2);
  setInterval(() => {
    if (!state) return;
    tickSplash();
    renderResults();
  }, 200);
  requestAnimationFrame(splashPad);
  addEventListener('visibilitychange', () => bridge?.visibility(document.hidden));
  render();
  if (asSeat !== null && net) {
    setTimeout(() => {
      if (!name) join(nameChoices(`${code}:${key}:0`, 6, net.members().map((m) => m.name).filter(Boolean))[0]);
    }, DISCOVER_MS);
  }
}

main();
