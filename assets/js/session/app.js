/**
 * session/app.js — an AI Hub session: friends join, the hub deals games at
 * random (Random Mode), plays each round through lib/hub/, and keeps score.
 *
 * Every tab is one seat. The seated tab with the lowest seat is the host: it
 * holds the session's state (round, seed, what has been played, the table),
 * picks the next game, and runs each round's coordinator (lib/hub/round.js).
 * It sends the whole state to the others whenever it changes and every couple
 * of seconds, so a tab that joins late, or takes over when the host leaves,
 * knows everything. A round whose host leaves dies with it and is void.
 *
 * Three transports with one shape: across devices (session/net.js: Supabase
 * Realtime for presence and control, a WebRTC mesh for game traffic, rounds
 * saved to the database), between tabs of one browser (?transport=local,
 * session/local.js), and a test relay the browser tests inject
 * (?transport=relay).
 *
 * Across devices the host signs in with Google and gets an invite link,
 * /session#<code>; friends open it and join as guests, no account needed.
 */

import { h, clear } from '../dom.js';
import { loadManifest, normalize, sessionOf } from '../manifest.js';
import { fnv1a } from '../color.js';
import { createPlayer } from '../ui/player.js';
import { createBridge, attachFrame, postTo } from '/lib/hub/bridge.js';
import { createRound, limitFor, SLOT_COLORS } from '/lib/hub/round.js';
import { createLocalNet } from './local.js';
import { createRelayNet, supabaseRelay } from './net.js';
import { nameChoices } from './names.js';
import { pickNext, eligible, sessionPool } from './pick.js';
import { scoreRound, addRound, leaderboard, FORMATS, DEFAULT_FORMAT, formatOf, formatOver, formatProgress, sessionAwards, finalTable } from './score.js';

const SEATS = 4;
const STATE_EVERY_MS = 2_000;
const DISCOVER_MS = 700;
/** Between rounds: the results, then the next game's card while it loads underneath. */
const NEXT_UP_MS = 3_000;
const RELAY_KEY = 'ai-hub:relay-only';

const params = new URLSearchParams(location.search);
const seconds = (name) => (Number(params.get(name)) > 0 ? Number(params.get(name)) * 1000 : null);
/** Knobs for trying games quickly: the host's address sets them for the session. */
const knobs = {
  limitMs: seconds('limit'),
  readyMs: seconds('ready'),
  resultsMs: seconds('results') ?? 5_000,
  examples: params.get('examples') === '1',
};
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

/** The two reference games, for a session with nothing else to play. */
const EXAMPLES = [
  { slug: 'hub-example-arena', name: 'Star Arena', tagline: 'Versus: first to ten stars', path: '/lib/hub/examples/arena.html', themeColor: '#1b1530', sessionMode: 'versus', sessionMinutes: '2' },
  { slug: 'hub-example-race', name: 'Comet Dash', tagline: 'Race with ghosts', path: '/lib/hub/examples/race.html', themeColor: '#0f1b2e', sessionMode: 'race', sessionMinutes: '1' },
].map((g) => normalize({ ...g, type: 'Game', session: '1', sessionPlayers: '2-4', builds: [{ id: 'current', path: g.path }] }));

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

const player = createPlayer(document.getElementById('player'), {
  onExit: leaveSession,
  onRoll: () => {},
  roll: false,
  honorStandalone: false,
  askToRate: false,
  backLabel: 'Leave the session',
  src: (build) => `${build.path}${build.path.includes('?') ? '&' : '?'}aihub=1`,
  onFrame: (frame) => attachRound(frame),
});

/* --- who is here ----------------------------------------------------------- */

const seated = () =>
  (net?.members() ?? [])
    .filter((m) => Number.isInteger(m.slot) && m.name)
    .sort((a, b) => a.slot - b.slot);
const hostKey = () => seated()[0]?.key ?? null;
const isHost = () => hostKey() === key;
const mine = () => net?.me();

function claimSeat() {
  const others = net.members().filter((m) => m.key !== key && Number.isInteger(m.slot));
  const taken = new Set(others.map((m) => m.slot));
  const slot = fixedSeat ?? [...Array(SEATS).keys()].find((s) => !taken.has(s));
  net.update({ slot: slot ?? null, name, status: slot === undefined ? 'full' : 'here' });
}

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
    final: null,
    knobs,
  };
}

function publish(next) {
  state = { ...next, v: (next.v || 0) + 1, host: key };
  net.broadcast({ k: 's', t: 'state', state });
  applyState();
}

/** This tab became the host: carry on from the last state it saw. */
function takeOver() {
  let next = state ? { ...state } : freshState();
  if (!state) next.knobs = knobs;
  if (next.phase === 'round' && next.current && next.current.coordinator !== key) {
    next = withRoundRecorded(next, { status: 'void', reason: 'host-left', standings: null, players: [] });
    saveRound(next.history.at(-1));
    next.reveal = revealFor(next);
  }
  publish(next);
  dealNext();
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
  const pick = pickNext(pool, { seed: state.seed, n: players.length, cycle: state.cycle, played: state.played });
  if (!pick) {
    publish({ ...state, phase: 'lobby', notice: `No game in the library fits ${players.length} player${players.length === 1 ? '' : 's'} yet.` });
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
    limitMs: limits.limitMs ?? limitFor(info.minutes),
    seed: fnv1a(`${state.seed}:${round}`),
    players,
    coordinator: key,
  };
  const handle = createRound({
    round,
    players,
    hostKey: key,
    mode: info.mode,
    seed: current.seed,
    limitMs: current.limitMs,
    timings: limits.readyMs ? { readyMs: limits.readyMs } : {},
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
  const reveal = under && state.reveal ? state.reveal : { at: hostNow(), until: hostNow() + NEXT_UP_MS, results: false };
  publish({ ...state, round, cycle: pick.cycle, played: pick.played, phase: 'round', current, reveal, notice: null });
}

/** When the reveal after a round ends: its results for `resultsMs`, then the next game's card. */
function revealFor(s) {
  const total = (s.knobs?.resultsMs ?? knobs.resultsMs) + NEXT_UP_MS;
  return { at: hostNow(), until: hostNow() + total, results: s.history.length > 0 };
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
    const scored = scoreRound({ standings: record.standings, mode: cur.mode, won: record.won });
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
  const game = pool.find((g) => g.slug === cur.slug) || normalize({ slug: cur.slug, name: cur.name, path: cur.path, type: 'Game' });
  pendingRound = cur;
  player.open(game, { path: cur.path });
}

let pendingRound = null;
function attachRound(frame) {
  const cur = pendingRound;
  if (!cur) return;
  bridge = createBridge({
    key,
    round: cur.round,
    coordinator: cur.coordinator,
    post: postTo(frame),
    net,
    clock: net.clock ?? Date,
    onIssue: (i) => console.warn(`[session] ${i.problem}`),
  });
  detach = attachFrame(frame, (msg) => bridge.fromGame(msg));
  for (const [from, env] of early.splice(0)) if (env.r === cur.round) bridge.fromNet(from, env);
}

function closeRound() {
  detach?.();
  detach = null;
  bridge = null;
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
  if (bridge && env.r === bridge.round) return bridge.fromNet(from, env);
  if ((!bridge || env.r > bridge.round) && early.length < 200) early.push([from, env]);
}

async function leaveSession() {
  closeRound();
  if (online) await online.sb.rpc('leave_session', { p_session: online.sessionId }).then(() => {}, () => {});
  net?.close();
  location.href = '/';
}

/** The host removes a player for the rest of the session (online: the database bars them). */
async function kick(member) {
  if (!confirm(`Remove ${member.name} from this session?`)) return;
  if (online) {
    const { error } = await online.sb.rpc('kick_from_session', { p_session: online.sessionId, p_user: member.key });
    if (error) return alert(`Could not remove ${member.name}: ${error.message}`);
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
    traffic: bridge ? { ...bridge.stats } : null,
    clock: net?.clock ? { offset: net.clock.offset, rtt: net.clock.rtt, following: net.clock.following } : null,
  };
  clear(app);
  if (removed) app.append(h('section', { class: 'panel' }, h('h2', {}, 'You were removed from this session'), h('a', { class: 'primary', href: '/' }, 'Back to the wall')));
  else if (superseded)
    app.append(
      h(
        'section',
        { class: 'panel' },
        h('h2', {}, 'This session is open in another tab'),
        h('p', {}, 'You joined it again somewhere else with the same account, so this tab stepped aside. To play with a second account, use a private window.'),
        h('button', { type: 'button', class: 'primary', onclick: () => location.reload() }, 'Play here instead')
      )
    );
  else if (!name && transport === 'online' && !code && !(user && !user.guest)) app.append(hostIntro());
  else if (!name) app.append(joinScreen());
  else if (mine().status === 'full') app.append(h('section', { class: 'panel' }, h('h2', {}, 'This session is full'), h('p', {}, 'Four players are already in it.')));
  else if (state?.phase === 'ended') app.append(endScreen());
  else app.append(lobbyScreen());
  renderStrip();
  renderResults();
}

function hostIntro() {
  return h(
    'section',
    { class: 'panel' },
    h('h2', {}, 'Play together'),
    h('p', {}, 'Host a session and send your friends the invite link. They join from it without an account. The hub deals the games, keeps time and keeps score. There is no chat, so talk in an app of your own.'),
    h('button', { type: 'button', class: 'primary', onclick: () => import('../account/auth.js').then((a) => a.signInWithGoogle()).catch(() => alert('Sign-in is unavailable right now.')) }, 'Sign in with Google to host'),
    h('p', { class: 'hint' }, 'Got an invite link? Open it to join. ', h('a', { href: `${location.pathname}?transport=local&examples=1#try` }, 'Or try a session in this browser.'))
  );
}

function joinScreen() {
  const taken = net ? net.members().map((m) => m.name).filter(Boolean) : [];
  const choices = nameChoices(`${code}:${key}:${reroll}`, 6, taken);
  return h(
    'section',
    { class: 'panel join' },
    h('h2', {}, transport === 'online' && !code ? 'Pick your name to host' : 'Pick your name'),
    problem && h('p', { class: 'notice' }, problem),
    h('p', { class: 'hint' }, 'Everyone in the session sees it. Names come from the hub: there is no chat, so talk in an app of your own.'),
    h('div', { class: 'join__names' }, choices.map((choice) => h('button', { type: 'button', class: 'join__name', onclick: () => join(choice) }, choice))),
    h('button', { type: 'button', class: 'link', onclick: () => { reroll++; render(); } }, 'Other names')
  );
}

async function join(choice) {
  problem = null;
  if (transport === 'online' && !net) {
    try {
      await joinOnline(choice);
    } catch (error) {
      problem = error.message || String(error);
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
    if (!user || user.guest) throw new Error('Sign in with Google to host a session.');
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
  const fits = eligible(pool, n).length;
  const cur = state?.current;
  const host = isHost();
  const inRound = state?.phase === 'round' && cur && !cur.players.some((p) => p.key === key);
  return h(
    'section',
    { class: 'panel lobby' },
    h('h2', {}, 'Players'),
    h(
      'ol',
      { class: 'seats' },
      [...Array(SEATS).keys()].map((slot) => {
        const m = seats.find((s) => s.slot === slot);
        return h(
          'li',
          { class: `seat${m ? '' : ' is-empty'}` },
          swatch(slot),
          h('span', { class: 'seat__name' }, m ? m.name : 'Open seat'),
          m?.key === key && h('span', { class: 'seat__tag' }, 'You'),
          m && m.key === hostKey() && h('span', { class: 'seat__tag' }, 'Host'),
          m && m.key !== key && net.link?.(m.key) === 'failed' && h('span', { class: 'seat__tag' }, 'No connection'),
          m && m.key !== key && isHost() && transport !== 'local' && h('button', { type: 'button', class: 'link seat__kick', onclick: () => kick(m) }, 'Remove')
        );
      })
    ),
    transport === 'online' ? inviteLine() : h(
      'p',
      { class: 'hint' },
      'To add a player on this computer, open this page again in another tab: ',
      h('a', { href: `${location.pathname}?transport=local${knobs.examples ? '&examples=1' : ''}#${encodeURIComponent(code)}`, target: '_blank' }, 'new seat')
    ),
    state?.notice && h('p', { class: 'notice' }, state.notice),
    inRound && h('p', { class: 'notice' }, `${cur.name} is being played. You join from the next round.`),
    formatPicker(),
    host && state?.phase === 'lobby'
      ? h(
          'div',
          { class: 'lobby__start' },
          h('button', { type: 'button', class: 'primary', id: 'start', disabled: !fits || undefined, onclick: () => startRound() }, 'Start Random Mode'),
          h('span', { class: 'hint' }, fits ? `${fits} game${fits === 1 ? '' : 's'} fit ${n} player${n === 1 ? '' : 's'}` : `No game fits ${n} player${n === 1 ? '' : 's'} yet`)
        )
      : state?.phase === 'lobby' && h('p', { class: 'hint' }, `Waiting for ${nameOf(hostKey()) ?? 'the host'} to start.`),
    host && state?.phase !== 'lobby' && h('button', { type: 'button', class: 'link', onclick: () => endSession() }, 'End the session'),
    transport === 'online' && relaySwitch(),
    standingsTable()
  );
}

/** How this session is won: the host picks before the first round; everyone sees it. */
function formatPicker() {
  const chosen = state?.format ?? DEFAULT_FORMAT;
  const editable = isHost() && state?.phase === 'lobby' && !state.history.length;
  if (!editable) return h('p', { class: 'hint format-line' }, `${formatOf(chosen).label}: ${formatOf(chosen).blurb}.`);
  return h(
    'fieldset',
    { class: 'formats' },
    h('legend', {}, 'How to win'),
    Object.entries(FORMATS).map(([id, format]) =>
      h(
        'label',
        { class: `format${id === chosen ? ' is-chosen' : ''}` },
        h('input', { type: 'radio', name: 'format', value: id, checked: id === chosen, onchange: () => publish({ ...state, format: id }) }),
        h('span', { class: 'format__name' }, format.label),
        h('span', { class: 'format__blurb' }, format.blurb)
      )
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
    h('span', { class: 'relay-switch__name' }, 'Relay only'),
    h('span', { class: 'hint' }, 'Reach the others only through the relay server, so they never see your IP address. It can add a little lag.')
  );
}

function inviteLine() {
  const link = `${location.origin}/session#${code}`;
  return h(
    'p',
    { class: 'invite' },
    h('span', { class: 'hint' }, 'Invite link: '),
    h('code', {}, link),
    ' ',
    h('button', { type: 'button', onclick: (e) => navigator.clipboard?.writeText(link).then(() => (e.target.textContent = 'Copied')) }, 'Copy')
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
    h('caption', {}, `Standings after ${state.history.length} round${state.history.length === 1 ? '' : 's'}`),
    h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, 'Player'), h('th', {}, 'Points'), h('th', {}, 'Wins'), h('th', {}, 'Awards'), h('th', {}, 'Rounds'))),
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

/** Over the game while a round runs: who we're waiting for, and the host's controls. */
function renderStrip() {
  clear(strip);
  const cur = state?.current;
  strip.hidden = !(state?.phase === 'round' && cur && player.isOpen());
  if (strip.hidden) return;
  const waiting = status?.phase === 'loading' ? status.players.filter((p) => !p.ready && !p.out).map((p) => p.name) : [];
  strip.append(
    h('span', { class: 'strip__title' }, `${formatProgress(state.format, state.history, state.totals)} · ${cur.name}`),
    waiting.length ? h('span', {}, `Waiting for ${waiting.join(', ')}`) : status?.phase === 'grace' && h('span', {}, 'Time!'),
    isHost() && h('button', { type: 'button', onclick: () => coordinator?.timeUp() }, 'End round'),
    isHost() && h('button', { type: 'button', onclick: () => coordinator?.abort('skipped') }, 'Skip game')
  );
}

const REASONS = {
  'host-left': 'the host left',
  'host-not-ready': 'the host was not ready',
  'host-hidden': "the host's tab was hidden",
  'host-error': 'the game failed for the host',
  'no-result': 'the game reported no result',
  'no-players': 'nobody could play',
  skipped: 'the host skipped it',
};

const resultText = (row) =>
  Number.isFinite(row.time) ? `${(row.time / 1000).toFixed(2)} s` : Number.isFinite(row.score) ? String(row.score) : '';

/* --- between rounds: the results, then the next game -------------------------- */

let shown = '';
let lifted = true;

/** Which part of the reveal is on: the last round's results, the next game's card, or nothing. */
function revealStage() {
  const reveal = state?.reveal;
  if (!reveal || state.phase === 'ended') return 'none';
  const left = reveal.until - hostNow();
  // Everyone readied early: the countdown has begun, so lift the card for it.
  if (status && state.current && status.round === state.current.round && status.phase !== 'loading') return 'none';
  if (left <= 0) return 'none';
  if (reveal.results && left > NEXT_UP_MS && state.history.length) return 'results';
  return state.current ? 'next' : state.history.length ? 'results' : 'none';
}

function renderResults() {
  const stage = revealStage();
  const id = `${stage}:${state?.round}:${state?.history.length}`;
  if (id !== shown) {
    shown = id;
    clear(overlay);
    overlay.hidden = stage === 'none';
    if (stage === 'results') overlay.append(resultsCard(state.history.at(-1)));
    if (stage === 'next') overlay.append(nextUpCard(state.current));
  }
  const left = Math.max(0, Math.ceil((((state?.reveal?.until ?? 0) - (stage === 'results' ? NEXT_UP_MS : 0)) - hostNow()) / 1000));
  const count = overlay.querySelector('.results__count');
  if (count) count.textContent = stage === 'results' ? `Next game in ${left + Math.round(NEXT_UP_MS / 1000)} s` : '';
  // The card lifted: hand the keyboard to the game, which is waiting for a key.
  if (stage === 'none' && !lifted) document.querySelector('#player iframe')?.focus();
  lifted = stage === 'none';
}

const MEDALS = ['🥇', '🥈', '🥉'];
/** "Ana", "Ana and Bo", "Ana, Bo and Cy". */
const names = (list) => (list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list.at(-1)}` : list[0] ?? '');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const statsLine = (stats) =>
  stats ? Object.entries(stats).map(([name, value]) => `${name} ${typeof value === 'number' ? Math.round(value * 100) / 100 : value}`).join(' · ') : '';

function headline(entry) {
  if (entry.status !== 'played') return `No points this round: ${REASONS[entry.reason] ?? entry.reason}.`;
  const winners = entry.rows.filter((r) => r.place === 1);
  if (entry.mode === 'co-op') return entry.won ? 'The team did it!' : 'So close. The team fell short.';
  if (winners.length === entry.rows.length && winners.length > 1) return 'Dead heat!';
  if (winners.length > 1) return `${names(winners.map((r) => r.name))} share the win!`;
  return winners.length ? `${winners[0].name} wins!` : 'Round over';
}

function resultsCard(entry) {
  const host = isHost();
  return h(
    'div',
    { class: 'results__card is-results' },
    h('p', { class: 'eyebrow' }, `Round ${entry.round} · ${entry.name}`),
    h('h2', { class: 'results__headline' }, headline(entry)),
    entry.status === 'played' &&
      h(
        'ol',
        { class: 'results__rows' },
        entry.rows.map((row, i) =>
          h(
            'li',
            { style: { '--i': i } },
            h('span', { class: 'results__place' }, row.place <= 3 && entry.mode !== 'co-op' ? MEDALS[row.place - 1] : String(row.place)),
            swatch(row.slot),
            h(
              'span',
              { class: 'results__who' },
              h('span', { class: 'results__name' }, row.name, row.out ? ` (${row.out === 'not-ready' ? 'sat out' : 'left'})` : ''),
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
      host && h('button', { type: 'button', class: 'primary', onclick: () => publish({ ...state, reveal: { ...state.reveal, until: hostNow() + NEXT_UP_MS } }) }, 'Next game now'),
      host && h('button', { type: 'button', onclick: backToLobby }, 'Back to the lobby'),
      host && h('button', { type: 'button', onclick: () => endSession() }, 'End the session')
    )
  );
}

const MODE_LINES = { race: 'Race', versus: 'Versus', 'co-op': 'Co-op' };

/** The next game: a quick spin through the deck that lands on it, then what it takes to win. */
function nextUpCard(cur) {
  const game = pool.find((g) => g.slug === cur.slug);
  const info = game ? sessionOf(game) : null;
  const others = eligible(pool, cur.players.length).filter((g) => g.slug !== cur.slug);
  const reel = [...Array(Math.min(7, others.length))].map((_, i) => others[(cur.round * 7 + i * 3) % others.length].name);
  return h(
    'div',
    { class: 'results__card is-next' },
    h('p', { class: 'eyebrow' }, `Next up · ${formatProgress(state.format, state.history, state.totals)}`),
    h('div', { class: 'reel', 'aria-hidden': 'true' }, h('div', { class: 'reel__strip', style: { '--n': reel.length } }, reel.map((n) => h('span', {}, n)), h('span', { class: 'is-it' }, cur.name))),
    h('h2', { class: 'next__name' }, cur.name),
    h(
      'p',
      { class: 'next__mode' },
      h('span', { class: 'chip' }, MODE_LINES[cur.mode] ?? 'Game'),
      ' ',
      `${cur.players.length} player${cur.players.length === 1 ? '' : 's'}`
    ),
    info?.goal && h('p', { class: 'next__goal' }, info.goal),
    info?.howto && h('p', { class: 'next__howto' }, info.howto),
    h('p', { class: 'hint' }, 'Loading… press any key when it asks.'),
    isHost() && h('div', { class: 'results__next' }, h('button', { type: 'button', onclick: backToLobby }, 'Back to the lobby'))
  );
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
    h('p', { class: 'eyebrow' }, `${formatOf(state.format).label} · ${plural(state.history.filter((e) => e.status === 'played').length, 'round')}`),
    h('h2', {}, rows.length ? (champions.length > 1 ? `${names(champions.map((r) => r.name))} share the crown!` : `${champions[0].name} wins the session!`) : 'Session over'),
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
                h('span', { class: 'podium__points' }, `${row.points} pts`)
              )
            : h('div', { class: 'podium__step is-empty' })
        )
      ),
    final.awards.length > 0 &&
      h(
        'ul',
        { class: 'finale__awards' },
        final.awards.map((a) =>
          h('li', {}, h('strong', {}, `🏆 ${a.title}`), ` ${names(a.keys.map(nameOfKey))} — ${a.detail}`, final.bonus ? h('span', { class: 'bonus' }, ` +${final.bonus}`) : null)
        )
      ),
    rows.length
      ? h(
          'table',
          { class: 'table' },
          h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, 'Player'), h('th', {}, 'Points'), final.bonus ? h('th', {}, 'Bonus') : null, h('th', {}, 'Wins'), h('th', {}, 'Awards'))),
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
      : h('p', { class: 'hint' }, 'No rounds were played.'),
    h(
      'ol',
      { class: 'history' },
      state.history.map((e) =>
        h(
          'li',
          {},
          `Round ${e.round}: ${e.name} — `,
          e.status === 'played'
            ? e.mode === 'co-op'
              ? e.won ? 'the team won' : 'the team fell short'
              : `won by ${names(e.rows.filter((r) => r.place === 1).map((r) => r.name))}`
            : 'no points'
        )
      )
    ),
    h('a', { class: 'primary', href: '/' }, 'Back to the wall')
  );
}

/* --- start ------------------------------------------------------------------ */

async function main() {
  // The library can take a moment: the page works without it, and counts games once it is in.
  pool = EXAMPLES;
  loadManifest().then(
    (d) => {
      pool = sessionPool(d.games, EXAMPLES, knobs.examples);
      render();
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
  setInterval(() => state && renderResults(), 200);
  addEventListener('visibilitychange', () => bridge?.visibility(document.hidden));
  render();
  if (asSeat !== null && net) {
    setTimeout(() => {
      if (!name) join(nameChoices(`${code}:${key}:0`, 6, net.members().map((m) => m.name).filter(Boolean))[0]);
    }, DISCOVER_MS);
  }
}

main();
