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
 * Phase 2 runs over the local transport (tabs of one browser); the network
 * transport for real sessions has the same shape (see session/local.js).
 */

import { h, clear } from '../dom.js';
import { loadManifest, normalize, sessionOf } from '../manifest.js';
import { fnv1a } from '../color.js';
import { createPlayer } from '../ui/player.js';
import { createBridge, attachFrame, postTo } from '/lib/hub/bridge.js';
import { createRound, limitFor, SLOT_COLORS } from '/lib/hub/round.js';
import { createLocalNet } from './local.js';
import { nameChoices } from './names.js';
import { pickNext, eligible } from './pick.js';
import { scoreRound, addRound, leaderboard } from './score.js';

const SEATS = 4;
const STATE_EVERY_MS = 2_000;
const DISCOVER_MS = 700;

const params = new URLSearchParams(location.search);
const seconds = (name) => (Number(params.get(name)) > 0 ? Number(params.get(name)) * 1000 : null);
/** Knobs for trying games quickly: the host's address sets them for the session. */
const knobs = {
  limitMs: seconds('limit'),
  readyMs: seconds('ready'),
  resultsMs: seconds('results') ?? 10_000,
  examples: params.get('examples') === '1',
};
const asSeat = Number(params.get('as')) >= 1 && Number(params.get('as')) <= SEATS ? Number(params.get('as')) - 1 : null;
const code = decodeURIComponent(location.hash.slice(1)) || 'local';
const key = asSeat !== null ? `seat${asSeat + 1}` : `t${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`;

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
let nextTimer = 0;
let bridge = null;         // this tab's game frame in the current round
let detach = null;
const early = [];          // traffic for a round whose frame isn't open yet

const player = createPlayer(document.getElementById('player'), {
  onExit: leaveSession,
  onRoll: () => {},
  roll: false,
  honorStandalone: false,
  backLabel: 'Leave the session',
  src: (build) => `${build.path}${build.path.includes('?') ? '&' : '?'}aihub=1`,
  onFrame: (frame) => attachRound(frame),
});

/* --- who is here ----------------------------------------------------------- */

const seated = () =>
  net
    .members()
    .filter((m) => Number.isInteger(m.slot) && m.name)
    .sort((a, b) => a.slot - b.slot);
const hostKey = () => seated()[0]?.key ?? null;
const isHost = () => hostKey() === key;
const mine = () => net?.me();

function claimSeat() {
  const others = net.members().filter((m) => m.key !== key && Number.isInteger(m.slot));
  const taken = new Set(others.map((m) => m.slot));
  const slot = asSeat ?? [...Array(SEATS).keys()].find((s) => !taken.has(s));
  net.update({ slot: slot ?? null, name, status: slot === undefined ? 'full' : 'here' });
}

/** Two tabs that picked one seat at once: the later one moves. */
function settleSeat() {
  const me = mine();
  if (asSeat !== null || !Number.isInteger(me.slot)) return;
  const clash = net
    .members()
    .find((m) => m.key !== key && m.slot === me.slot && (m.joinedAt < me.joinedAt || (m.joinedAt === me.joinedAt && m.key < key)));
  if (clash) claimSeat();
}

function membersChanged() {
  settleSeat();
  const host = isHost();
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
    nextAt: null,
    notice: null,
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
    next.nextAt = Date.now() + (next.knobs?.resultsMs ?? knobs.resultsMs);
  }
  publish(next);
  if (state.phase === 'results') scheduleNext();
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

function startRound() {
  clearTimeout(nextTimer);
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
  coordinator = createRound({
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
      coordinator = null;
      publish({ ...withRoundRecorded(state, record), nextAt: Date.now() + (state.knobs?.resultsMs ?? knobs.resultsMs) });
      scheduleNext();
    },
  });
  publish({ ...state, round, cycle: pick.cycle, played: pick.played, phase: 'round', current, nextAt: null, notice: null });
}

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
    rows: [],
  };
  let totals = s.totals;
  if (record.status === 'played' && record.standings) {
    const scored = scoreRound({ standings: record.standings, mode: cur.mode, won: record.won });
    for (const [id, r] of scored) {
      const p = record.players.find((q) => q.id === id);
      const raw = record.results?.[id] ?? (record.scores ? { score: record.scores[id] } : null);
      entry.rows.push({ key: keyOf(id), name: p.name, slot: p.slot, place: r.place, points: r.points, win: r.win, out: p.out, ...(raw || {}) });
    }
    entry.rows.sort((a, b) => a.place - b.place || a.slot - b.slot);
    totals = addRound(totals, entry.rows);
  }
  return { ...s, phase: 'results', current: null, history: [...s.history, entry], totals };
}

function scheduleNext() {
  clearTimeout(nextTimer);
  if (!state?.nextAt) return;
  nextTimer = setTimeout(() => {
    if (isHost() && state.phase === 'results') startRound();
  }, Math.max(0, state.nextAt - Date.now()));
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

function leaveSession() {
  closeRound();
  net?.close();
  location.href = '/';
}

/* --- the screens ------------------------------------------------------------- */

const swatch = (slot) => h('span', { class: 'seat__dot', style: { background: SLOT_COLORS[slot] ?? '#888' } });
const nameOf = (k) => net.members().find((m) => m.key === k)?.name;

function render() {
  document.body.dataset.phase = !name ? 'join' : state?.phase ?? 'lobby';
  document.body.dataset.host = isHost() ? '1' : '0';
  document.body.dataset.round = String(state?.current?.round ?? state?.round ?? 0);
  window.__session = { key, state, status, seat: mine()?.slot ?? null };
  clear(app);
  if (!name) app.append(joinScreen());
  else if (mine().status === 'full') app.append(h('section', { class: 'panel' }, h('h2', {}, 'This session is full'), h('p', {}, 'Four players are already in it.')));
  else if (state?.phase === 'ended') app.append(endScreen());
  else app.append(lobbyScreen());
  renderStrip();
  renderResults();
}

function joinScreen() {
  const taken = net.members().map((m) => m.name).filter(Boolean);
  const choices = nameChoices(`${code}:${key}:${reroll}`, 6, taken);
  return h(
    'section',
    { class: 'panel join' },
    h('h2', {}, 'Pick your name'),
    h('p', { class: 'hint' }, 'Everyone in the session sees it. Names come from the hub: there is no chat, so talk in an app of your own.'),
    h('div', { class: 'join__names' }, choices.map((choice) => h('button', { type: 'button', class: 'join__name', onclick: () => join(choice) }, choice))),
    h('button', { type: 'button', class: 'link', onclick: () => { reroll++; render(); } }, 'Other names')
  );
}

function join(choice) {
  name = choice;
  claimSeat();
  render();
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
          m && m.key === hostKey() && h('span', { class: 'seat__tag' }, 'Host')
        );
      })
    ),
    h(
      'p',
      { class: 'hint' },
      'To add a player on this computer, open this page again in another tab: ',
      h('a', { href: `${location.pathname}?transport=local${knobs.examples ? '&examples=1' : ''}#${encodeURIComponent(code)}`, target: '_blank' }, 'new seat')
    ),
    state?.notice && h('p', { class: 'notice' }, state.notice),
    inRound && h('p', { class: 'notice' }, `${cur.name} is being played. You join from the next round.`),
    host && state?.phase === 'lobby'
      ? h(
          'div',
          { class: 'lobby__start' },
          h('button', { type: 'button', class: 'primary', id: 'start', disabled: !fits || undefined, onclick: startRound }, 'Start Random Mode'),
          h('span', { class: 'hint' }, fits ? `${fits} game${fits === 1 ? '' : 's'} fit ${n} player${n === 1 ? '' : 's'}` : `No game fits ${n} player${n === 1 ? '' : 's'} yet`)
        )
      : state?.phase === 'lobby' && h('p', { class: 'hint' }, `Waiting for ${nameOf(hostKey()) ?? 'the host'} to start.`),
    host && state?.phase !== 'lobby' && h('button', { type: 'button', class: 'link', onclick: endSession }, 'End the session'),
    standingsTable()
  );
}

function standingsTable() {
  const rows = leaderboard(state?.totals || {});
  if (!rows.length) return null;
  return h(
    'table',
    { class: 'table' },
    h('caption', {}, `Standings after ${state.history.length} round${state.history.length === 1 ? '' : 's'}`),
    h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, 'Player'), h('th', {}, 'Points'), h('th', {}, 'Wins'), h('th', {}, 'Rounds'))),
    h(
      'tbody',
      {},
      rows.map((row, i) =>
        h('tr', {}, h('td', {}, String(i + 1)), h('td', {}, swatch(row.slot), ' ', row.name), h('td', {}, String(row.points)), h('td', {}, String(row.wins)), h('td', {}, String(row.rounds)))
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
    h('span', { class: 'strip__title' }, `Round ${cur.round} · ${cur.name}`),
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

function renderResults() {
  clear(overlay);
  overlay.hidden = state?.phase !== 'results';
  if (overlay.hidden) return;
  const last = state.history.at(-1);
  const left = Math.max(0, Math.ceil(((state.nextAt ?? Date.now()) - Date.now()) / 1000));
  overlay.append(
    h(
      'div',
      { class: 'results__card' },
      h('p', { class: 'eyebrow' }, `Round ${last.round}`),
      h('h2', {}, last.name),
      last.status === 'played'
        ? h(
            'ol',
            { class: 'results__rows' },
            last.rows.map((row) =>
              h(
                'li',
                {},
                h('span', { class: 'results__place' }, String(row.place)),
                swatch(row.slot),
                h('span', { class: 'results__name' }, row.name, row.out ? ` (${row.out === 'not-ready' ? 'sat out' : 'left'})` : ''),
                h('span', { class: 'results__score' }, resultText(row)),
                h('span', { class: 'results__points' }, `+${row.points}`)
              )
            )
          )
        : h('p', { class: 'notice' }, `No points this round: ${REASONS[last.reason] ?? last.reason}.`),
      standingsTable(),
      h(
        'div',
        { class: 'results__next' },
        h('span', { class: 'hint' }, `Next game in ${left} s`),
        isHost() && h('button', { type: 'button', class: 'primary', onclick: startRound }, 'Next game now'),
        isHost() && h('button', { type: 'button', onclick: () => { clearTimeout(nextTimer); publish({ ...state, phase: 'lobby', nextAt: null }); } }, 'Back to the lobby'),
        isHost() && h('button', { type: 'button', onclick: endSession }, 'End the session')
      )
    )
  );
}

function endSession() {
  clearTimeout(nextTimer);
  coordinator?.abort('session-ended');
  coordinator = null;
  publish({ ...state, phase: 'ended', current: null, nextAt: null });
}

function endScreen() {
  return h(
    'section',
    { class: 'panel' },
    h('h2', {}, 'Session over'),
    standingsTable() || h('p', { class: 'hint' }, 'No rounds were played.'),
    h(
      'ol',
      { class: 'history' },
      state.history.map((e) =>
        h('li', {}, `Round ${e.round}: ${e.name} — `, e.status === 'played' ? `won by ${e.rows.filter((r) => r.place === 1).map((r) => r.name).join(' and ')}` : 'no points')
      )
    ),
    h('a', { class: 'primary', href: '/' }, 'Back to the wall')
  );
}

/* --- start ------------------------------------------------------------------ */

function notLocal() {
  app.append(
    h(
      'section',
      { class: 'panel' },
      h('h2', {}, 'Playing together is coming'),
      h('p', {}, 'Sessions across devices arrive with sign-in. Until then, try one on this computer: open each seat in its own tab.'),
      h('a', { class: 'primary', href: `${location.pathname}?transport=local&examples=1#try` }, 'Try a session in this browser')
    )
  );
}

async function main() {
  if (params.get('transport') !== 'local') return notLocal();
  const library = await loadManifest().then((d) => d.games, () => []);
  pool = knobs.examples ? [...library, ...EXAMPLES] : library;
  net = createLocalNet({ code, key });
  net.onMembers(membersChanged);
  net.onMessage(route);
  setInterval(() => {
    if (isHost() && state) net.broadcast({ k: 's', t: 'state', state });
    if (state?.phase === 'results') renderResults();
  }, STATE_EVERY_MS / 2);
  addEventListener('visibilitychange', () => bridge?.visibility(document.hidden));
  render();
  if (asSeat !== null) {
    setTimeout(() => {
      if (!name) join(nameChoices(`${code}:${key}:0`, 6, net.members().map((m) => m.name).filter(Boolean))[0]);
    }, DISCOVER_MS);
  }
}

main();
