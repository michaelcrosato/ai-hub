import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

import { createRound, rankRace, checkStandings, limitFor, SLOT_COLORS } from '../lib/hub/round.js';
import { createBridge, createLocalNetwork, LIMITS } from '../lib/hub/bridge.js';
import { sessionOf, NOT_A_FACET } from '../assets/js/manifest.js';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

/** A clock the test moves by hand: timers fire in order as it advances. */
function fakeClock(start = 1_000) {
  let now = start;
  let next = 0;
  const queue = [];
  return {
    now: () => now,
    setTimeout(fn, ms) {
      const handle = ++next;
      queue.push({ handle, at: now + Math.max(0, ms), fn });
      return handle;
    },
    clearTimeout(handle) {
      const at = queue.findIndex((t) => t.handle === handle);
      if (at !== -1) queue.splice(at, 1);
    },
    advance(ms) {
      const end = now + ms;
      for (;;) {
        queue.sort((a, b) => a.at - b.at || a.handle - b.handle);
        if (!queue.length || queue[0].at > end) break;
        const timer = queue.shift();
        now = timer.at;
        timer.fn();
      }
      now = end;
    },
  };
}

/* --- the client (lib/hub/session.js), run in a sandbox ---------------------- */

async function loadClient({ search = '?aihub=1', framed = true } = {}) {
  const source = await read('lib/hub/session.js');
  const clock = fakeClock(0);
  const posted = [];
  const listeners = [];
  const parent = { postMessage: (msg, origin) => posted.push({ msg: JSON.parse(JSON.stringify(msg)), origin }) };
  const warnings = [];
  const saved = { getItem: (k) => (k === 'unlocks' ? 'all of them' : null), setItem: () => {} };
  const realRequest = function () {
    return 'the real requestFullscreen';
  };
  const window = {
    location: { search },
    performance: { now: clock.now },
    console: { warn: (text) => warnings.push(text) },
    addEventListener: (type, fn) => type === 'message' && listeners.push(fn),
    localStorage: saved,
    sessionStorage: saved,
    Element: Object.assign(function Element() {}, { prototype: { requestFullscreen: realRequest } }),
    document: { documentElement: { tag: 'html' }, events: [], dispatchEvent(e) { this.events.push(e.type); } },
    Event: function Event(type) { this.type = type; },
  };
  window.parent = framed ? parent : window;
  // Each sandbox gets its own Math, so a client that seeds Math.random seeds only its own page.
  const context = vm.createContext({ window, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, Promise, JSON, Math: Object.create(Math), Object, Array, String, Number, Date, isFinite });
  vm.runInContext(source, context);
  const hub = window.AIHub;
  const fromHub = (data, origin = 'https://hub.test') => listeners.forEach((fn) => fn({ source: parent, data, origin }));
  const flush = () => new Promise((resolve) => setImmediate(resolve));
  return { hub, posted, fromHub, clock, warnings, parent, listeners, flush, math: context.Math, window, realRequest };
}

const WELCOME = { aihub: 1, type: 'welcome', me: 1, host: 0, players: [{ id: 0, name: 'Red Fox', color: '#e8443a' }, { id: 1, name: 'Blue Otter', color: '#3b82f6' }], mode: 'versus', seed: 42, limitMs: 180_000, round: 3 };

test('the client is inactive without ?aihub=1 in a frame, and connect() answers null', async () => {
  for (const options of [{ search: '' }, { framed: false }]) {
    const { hub, posted } = await loadClient(options);
    assert.equal(hub.active, false);
    assert.equal(await hub.connect({ mode: 'race' }), null);
    assert.equal(posted.length, 0);
  }
});

test('the client says hello until welcomed, then resolves with the round', async () => {
  const { hub, posted, fromHub, clock } = await loadClient();
  const info = hub.connect({ mode: 'versus', seats: [2, 4] });
  assert.deepEqual(posted[0].msg, { aihub: 1, type: 'hello', v: 1, client: '1.3.0', mode: 'versus', seats: [2, 4] });
  assert.equal(posted[0].origin, '*');
  clock.advance(1_000);
  assert.equal(posted.length, 3);
  fromHub(WELCOME);
  const round = await info;
  assert.equal(round.me, 1);
  assert.equal(round.isHost, false);
  assert.equal(round.players.length, 2);
  assert.equal(round.splash, false, 'a hub that shows no splash leaves the ready prompt to the game');
  assert.equal(hub.seed, 42);
  clock.advance(2_000);
  assert.equal(posted.length, 3, 'no hello after the welcome');
  hub.ready();
  hub.ready();
  assert.deepEqual(posted.slice(3).map((p) => [p.msg.type, p.origin]), [['ready', 'https://hub.test']]);
});

test('the client gives up after ten seconds with no hub, and plays solo with its own Math.random', async () => {
  const { hub, clock, window, math } = await loadClient({ search: '?aihub=1&aihub-seed=9' });
  assert.equal(window.localStorage.getItem('unlocks'), null);
  const info = hub.connect({ mode: 'parallel' });
  clock.advance(10_600);
  assert.equal(await info, null);
  assert.equal(hub.active, false);
  assert.equal(hub.seeded, false);
  assert.equal(math.random, Math.random, 'Math.random is the real one again');
  assert.equal(window.localStorage.getItem('unlocks'), null, 'the empty storage stays: what the game writes never lands on the real saves');
  const own = await loadClient({ search: '?aihub=1' });
  const mine = () => 0.5;
  own.math.random = mine;
  own.hub.connect();
  own.clock.advance(10_600);
  assert.equal(own.math.random, mine, 'a Math.random the game set itself is left alone');
});

test('the client ignores messages that are not from its parent', async () => {
  const { hub, listeners } = await loadClient();
  hub.connect();
  listeners.forEach((fn) => fn({ source: {}, data: WELCOME, origin: 'https://evil.test' }));
  assert.equal(hub.me, null);
});

test('the client keeps time from the start, and queues events until a handler listens', async () => {
  const { hub, fromHub, clock, flush } = await loadClient();
  hub.connect();
  fromHub(WELCOME);
  assert.equal(hub.time(), -Infinity);
  fromHub({ aihub: 1, type: 'start', in: 3_000 });
  fromHub({ aihub: 1, type: 'message', from: 0, data: { n: 1 } });
  fromHub({ aihub: 1, type: 'message', from: 0, data: { n: 2 } });
  assert.equal(hub.time(), -3_000);
  clock.advance(3_500);
  assert.equal(hub.time(), 500);
  const got = [];
  hub.on('message', (data, from) => got.push([data.n, from]));
  fromHub({ aihub: 1, type: 'message', from: 0, data: { n: 3 } });
  clock.advance(0);
  await flush();
  assert.deepEqual(got, [[1, 0], [2, 0], [3, 0]]);
});

test('the client drops sends over 16 KB or past the rate, with a warning', async () => {
  const { hub, posted, fromHub, warnings, clock } = await loadClient();
  hub.connect();
  fromHub(WELCOME);
  assert.equal(hub.send({ big: 'x'.repeat(17_000) }), false);
  let sent = 0;
  for (let i = 0; i < 60; i++) if (hub.send({ i })) sent++;
  assert.equal(sent, 40, 'a burst of 40, then nothing until the bucket refills');
  clock.advance(500);
  assert.equal(hub.send({ i: 'later' }), true);
  assert.ok(warnings.some((w) => w.includes('16384')));
  assert.ok(warnings.some((w) => w.includes('messages a second')));
  const last = posted.at(-1).msg;
  assert.deepEqual(last, { aihub: 1, type: 'send', data: { i: 'later' }, reliable: true });
  hub.send({ x: 1 }, { to: 0, reliable: false });
  assert.deepEqual(posted.at(-1).msg, { aihub: 1, type: 'send', data: { x: 1 }, reliable: false, to: 0 });
});

test('the client lets only the host finish, once, and a racer report once', async () => {
  const { hub, posted, fromHub } = await loadClient();
  hub.connect();
  fromHub(WELCOME);
  hub.finish({ standings: [[1], [0]] });
  assert.ok(!posted.some((p) => p.msg.type === 'finish'));
  hub.result({ time: 12_345 });
  hub.result({ time: 1 });
  assert.deepEqual(posted.filter((p) => p.msg.type === 'result').map((p) => p.msg.time), [12_345]);
  const host = await loadClient();
  host.hub.connect();
  host.fromHub({ ...WELCOME, me: 0 });
  host.hub.finish({ standings: [[0], [1]], scores: { 0: 10, 1: 4 } });
  host.hub.finish({ standings: [[1], [0]] });
  assert.deepEqual(host.posted.filter((p) => p.msg.type === 'finish').map((p) => p.msg.standings), [[[0], [1]]]);
});

test('an outcome field that is not JSON is left out, not the whole outcome', async () => {
  const { hub, posted, fromHub, warnings } = await loadClient();
  hub.connect();
  fromHub({ ...WELCOME, me: 0 });
  const cycle = { name: 'loop' };
  cycle.self = cycle;
  hub.finish({ standings: [[0], [1]], scores: { 0: 5, 1: 2 }, stats: { 0: cycle } });
  assert.deepEqual(posted.filter((p) => p.msg.type === 'finish').map(({ msg: { aihub, ...m } }) => m), [{ type: 'finish', standings: [[0], [1]], scores: { 0: 5, 1: 2 } }]);
  assert.ok(warnings.some((w) => /stats is not JSON/.test(w)));
});

test('a result is judged on the numbers the game gave: NaN, Infinity, null and empty text are no time', async () => {
  const results = [];
  for (const outcome of [{ time: NaN, score: 120 }, { time: Infinity }, { time: null, score: '' }, { score: '95', time: undefined }, { time: 61_000, score: 3, stats: { Jumps: 9 } }]) {
    const { hub, posted, fromHub } = await loadClient();
    hub.connect();
    fromHub({ ...WELCOME, mode: 'race' });
    hub.result(outcome);
    hub.progress({ score: null });
    results.push(posted.filter((p) => ['result', 'progress'].includes(p.msg.type)).map(({ msg: { aihub, ...m } }) => m));
  }
  assert.deepEqual(results, [
    [{ type: 'result', score: 120 }],
    [],
    [],
    [{ type: 'result', score: 95 }],
    [{ type: 'result', time: 61_000, score: 3, stats: { Jumps: 9 } }],
  ]);
});

test('the client seeds the same generator on every device, one stream per label', async () => {
  const a = await loadClient();
  const b = await loadClient();
  for (const c of [a, b]) {
    c.hub.connect();
    c.fromHub(WELCOME);
  }
  const take = (rng) => Array.from({ length: 5 }, () => rng());
  assert.deepEqual(take(a.hub.rng('course')), take(b.hub.rng('course')));
  assert.notDeepEqual(take(a.hub.rng('course')), take(a.hub.rng('stars')));
  assert.ok(take(a.hub.rng('x')).every((n) => n >= 0 && n < 1));
});

test('side by side: with aihub-seed in its address, the client seeds Math.random before the game runs', async () => {
  const a = await loadClient({ search: '?aihub=1&aihub-seed=4242' });
  const b = await loadClient({ search: '?aihub-seed=4242&aihub=1' });
  const take = (c) => Array.from({ length: 6 }, () => c.math.random());
  assert.equal(a.hub.seeded, true);
  const first = take(a);
  assert.deepEqual(first, take(b), 'every copy draws the same numbers');
  assert.ok(first.every((n) => n >= 0 && n < 1));
  const other = await loadClient({ search: '?aihub=1&aihub-seed=7' });
  assert.notDeepEqual(take(other), first);
  for (const options of [{ search: '?aihub=1' }, { search: '?aihub-seed=4242' }, { search: '?aihub=1&aihub-seed=4242', framed: false }]) {
    const c = await loadClient(options);
    assert.equal(c.hub.seeded, false, JSON.stringify(options));
    assert.equal(c.math.random, Math.random, 'Math.random is left alone outside side by side');
  }
});

test('in a session the game gets an empty storage of its own, so every round starts as a first launch', async () => {
  const { window } = await loadClient();
  const store = window.localStorage;
  assert.equal(store.getItem('unlocks'), null, 'nothing saved on the device carries in');
  store.setItem('best', 120);
  store.level = '3';
  assert.equal(store.getItem('best'), '120');
  assert.equal(store.getItem('level'), '3', 'items set as properties are items too');
  assert.equal(store.best, '120');
  assert.equal(store.length, 2);
  assert.deepEqual(Object.keys(store).sort(), ['best', 'level']);
  assert.equal(store.key(0), 'best');
  store.removeItem('best');
  delete store.level;
  assert.equal(store.length, 0);
  assert.notEqual(window.sessionStorage, window.localStorage);
  const solo = await loadClient({ search: '' });
  assert.equal(solo.window.localStorage.getItem('unlocks'), 'all of them', 'outside a session the real storage is left alone');
});

test('in a session a game that asks for fullscreen gets the hub’s whole page, and its own toggle still works', async () => {
  const { hub, window, posted, fromHub } = await loadClient();
  hub.connect();
  posted.length = 0;
  const canvas = Object.create(window.Element.prototype);
  const toggle = () => (window.document.fullscreenElement ? window.document.exitFullscreen() : canvas.requestFullscreen());
  assert.equal(await toggle(), undefined);
  fromHub({ aihub: 1, type: 'fullscreen', on: true });
  assert.deepEqual(window.document.fullscreenElement, { tag: 'html' }, 'the hub’s page is in fullscreen, as far as the game can tell');
  assert.deepEqual(window.document.events, ['fullscreenchange']);
  await toggle();
  fromHub({ aihub: 1, type: 'fullscreen', on: false });
  assert.equal(window.document.fullscreenElement, null);
  assert.deepEqual(posted.map((p) => p.msg), [{ aihub: 1, type: 'fullscreen', on: true }, { aihub: 1, type: 'fullscreen', on: false }]);
  const solo = await loadClient({ search: '' });
  assert.equal(solo.window.Element.prototype.requestFullscreen, solo.realRequest, 'outside a session the game’s own fullscreen is left alone');
});

test('the client keeps every welcome field and passes on events it has never heard of', async () => {
  const { hub, fromHub, clock, flush } = await loadClient();
  const info = hub.connect();
  fromHub({ ...WELCOME, format: 'party', active: false, send: 'not a function', limits: { ratePerS: 5, burst: 5 } });
  const round = await info;
  assert.equal(round.format, 'party', 'a field a newer hub adds needs no newer client');
  assert.equal(hub.format, 'party');
  assert.equal(hub.active, true, 'the client’s own fields are not the welcome’s to change');
  assert.equal(typeof hub.send, 'function');
  let sent = 0;
  for (let i = 0; i < 20; i++) if (hub.send({ i })) sent++;
  assert.equal(sent, 5, 'the welcome’s limits replace the built-in ones');
  const got = [];
  hub.on('cheer', (detail) => got.push(detail));
  fromHub({ aihub: 1, type: 'cheer', who: 2, loud: true });
  clock.advance(0);
  await flush();
  assert.deepEqual(JSON.parse(JSON.stringify(got)), [{ who: 2, loud: true }]);
});

test('progress reaches the hub at most once a second, the latest value last, and stops with the result', async () => {
  const { hub, posted, fromHub, clock } = await loadClient();
  hub.connect();
  fromHub({ ...WELCOME, mode: 'parallel' });
  const progress = () => posted.filter((p) => p.msg.type === 'progress').map((p) => p.msg);
  hub.progress({ score: 1, label: 'Floor 1' });
  for (let i = 2; i <= 9; i++) hub.progress({ score: i, label: `Floor ${i} of a building far too tall to name` });
  hub.progress({ score: NaN });
  assert.deepEqual(progress(), [{ aihub: 1, type: 'progress', score: 1, label: 'Floor 1' }]);
  clock.advance(1_000);
  assert.deepEqual(progress().at(-1), { aihub: 1, type: 'progress', score: 9, label: 'Floor 9 of a building fa' });
  assert.equal(progress().length, 2);
  hub.progress({ score: 10 });
  hub.result({ score: 10, extra: { kept: true } });
  clock.advance(5_000);
  assert.equal(progress().length, 2, 'nothing after the result');
  assert.deepEqual(posted.at(-1).msg, { aihub: 1, type: 'result', score: 10, extra: { kept: true } }, 'the whole outcome goes to the hub, which checks it');
});

/* --- the round (lib/hub/round.js) ------------------------------------------- */

function setup({ n = 3, mode = 'versus', limitMs = 60_000, gate = false } = {}) {
  const clock = fakeClock();
  const sent = [];
  const ended = [];
  const players = Array.from({ length: n }, (_, slot) => ({ key: `k${slot}`, slot, name: `P${slot}` }));
  const round = createRound({
    round: 7,
    players,
    hostKey: 'k0',
    mode,
    seed: 99,
    limitMs,
    clock,
    gate,
    deliver: (key, msg) => sent.push([key, msg]),
    onEnd: (record) => ended.push(record),
  });
  const to = (key, type) => sent.filter(([k, m]) => k === key && (!type || m.type === type)).map(([, m]) => m);
  const allHello = () => players.forEach((p) => round.receive(p.key, { type: 'hello', v: 1, mode, seats: [2, 4] }));
  const allReady = () => players.forEach((p) => round.receive(p.key, { type: 'ready' }));
  return { round, clock, sent, ended, to, allHello, allReady, players };
}

test('a round welcomes each player with contiguous ids, the host and the seat colours', () => {
  const { round, to, allHello } = setup({ n: 3 });
  allHello();
  const w = to('k2', 'welcome')[0];
  assert.equal(w.me, 2);
  assert.equal(w.host, 0);
  assert.equal(w.round, 7);
  assert.deepEqual(w.players, [0, 1, 2].map((id) => ({ id, name: `P${id}`, color: SLOT_COLORS[id] })));
  assert.deepEqual(w.keys, ['k0', 'k1', 'k2']);
  assert.equal(round.phase, 'loading');
});

test('a round starts three seconds after everyone is ready, and calls time at the limit', () => {
  const { round, clock, to, allHello, allReady } = setup({ limitMs: 60_000 });
  allHello();
  allReady();
  assert.equal(round.phase, 'countdown');
  assert.equal(to('k1', 'start')[0].at, clock.now() + 3_000);
  clock.advance(3_000);
  assert.equal(round.phase, 'playing');
  clock.advance(60_000);
  assert.deepEqual(to('k1', 'time-up').map((m) => m.graceMs), [5_000]);
  clock.advance(5_000);
  assert.equal(round.record.status, 'void');
  assert.equal(round.record.reason, 'no-result', 'versus with no finish from the host');
});

test("the host's finish ends a versus round; players already gone are placed last", () => {
  const { round, to, ended, allHello, allReady, clock } = setup({ n: 4 });
  allHello();
  allReady();
  clock.advance(4_000);
  round.leave('k3', 'disconnected');
  assert.deepEqual(to('k1', 'leave').map((m) => [m.id, m.reason]), [[3, 'disconnected']]);
  round.receive('k1', { type: 'finish', standings: [[1], [0, 2]] });
  assert.equal(round.record, null, 'only the host may finish');
  round.receive('k0', { type: 'finish', standings: [[1], [0]] });
  assert.equal(round.record, null, 'standings that leave out a present player are ignored');
  round.receive('k0', { type: 'finish', standings: [[1], [0, 2]], scores: { 0: 5, 1: 9, 2: 5 } });
  assert.equal(ended.length, 1);
  assert.equal(round.record.status, 'played');
  assert.deepEqual(round.record.standings, [[1], [0, 2], [3]]);
  assert.deepEqual(to('k2', 'end')[0], { round: 7, type: 'end', reason: 'finished', standings: [[1], [0, 2], [3]] });
  assert.equal(to('k3', 'end').length, 0, 'nothing goes to a player who left');
  assert.equal(round.record.issues.length, 2);
});

test('a gated round tells the games the hub collects ready, and starts only when the hub releases it', () => {
  const { round, clock, to, allHello, allReady } = setup({ n: 3, gate: true });
  allHello();
  assert.equal(to('k1', 'welcome')[0].splash, true);
  allReady();
  clock.advance(120_000);
  assert.equal(round.phase, 'loading', 'a splash held for as long as the players need: no deadline runs out');
  assert.equal(to('k0', 'leave').length, 0);
  round.release();
  assert.equal(round.phase, 'countdown');
  assert.equal(to('k2', 'start')[0].at, clock.now() + 3_000);
});

test('released, a gated round waits up to twenty seconds for a game still loading, then starts without it', () => {
  const { round, clock, to, players } = setup({ n: 3, gate: true });
  for (const p of players) round.receive(p.key, { type: 'hello', v: 1, mode: 'versus', client: '1.2.0' });
  round.receive('k0', { type: 'ready' });
  round.receive('k1', { type: 'ready' });
  round.release();
  clock.advance(19_000);
  assert.equal(round.phase, 'loading');
  clock.advance(1_000);
  assert.deepEqual(to('k0', 'leave').map((m) => [m.id, m.reason]), [[2, 'not-ready']]);
  assert.deepEqual(to('k2', 'end').map((m) => m.reason), ['sat-out']);
  assert.equal(round.phase, 'countdown');
});

test('a slow game that loads within the grace starts the round with everyone, and one that never said hello sits out', () => {
  const late = setup({ n: 2, gate: true });
  late.allHello();
  late.round.receive('k0', { type: 'ready' });
  late.round.release();
  late.clock.advance(8_000);
  late.round.receive('k1', { type: 'ready' });
  assert.equal(late.round.phase, 'countdown');
  assert.equal(late.to('k0', 'leave').length, 0);

  const silent = setup({ n: 2, gate: true });
  silent.round.receive('k0', { type: 'hello', v: 1, mode: 'versus' });
  silent.round.receive('k0', { type: 'ready' });
  silent.round.release();
  silent.clock.advance(20_000);
  assert.deepEqual(silent.to('k0', 'leave').map((m) => [m.id, m.reason]), [[1, 'not-ready']]);
});

test('a player who never says hello sits out; one who never readies is told it sat out', () => {
  const { round, clock, to } = setup({ n: 3 });
  round.receive('k0', { type: 'hello', v: 1, mode: 'versus' });
  round.receive('k1', { type: 'hello', v: 1, mode: 'versus' });
  clock.advance(10_000);
  assert.deepEqual(to('k0', 'leave').map((m) => [m.id, m.reason]), [[2, 'not-ready']]);
  round.receive('k0', { type: 'ready' });
  clock.advance(35_000);
  assert.deepEqual(to('k0', 'leave').map((m) => m.id), [2, 1]);
  assert.deepEqual(to('k1', 'end').map((m) => m.reason), ['sat-out']);
  assert.equal(round.phase, 'countdown', 'the round goes on with whoever is ready');
});

test('a versus round is void when the host is not ready, leaves, or hides too long', () => {
  let s = setup({ n: 2 });
  s.allHello();
  s.round.receive('k1', { type: 'ready' });
  s.clock.advance(45_000);
  assert.equal(s.round.record.reason, 'host-not-ready');

  s = setup({ n: 3 });
  s.allHello();
  s.allReady();
  s.clock.advance(5_000);
  s.round.leave('k0');
  assert.equal(s.round.record.reason, 'host-left');
  assert.deepEqual(s.to('k1', 'end').map((m) => m.reason), ['host-left']);

  s = setup({ n: 2 });
  s.allHello();
  s.allReady();
  s.clock.advance(4_000);
  s.round.receive('k0', { type: 'vis', hidden: true });
  s.clock.advance(19_000);
  s.round.receive('k0', { type: 'vis', hidden: false });
  s.round.receive('k0', { type: 'vis', hidden: true });
  s.clock.advance(19_000);
  assert.equal(s.round.record, null, 'shown again in time');
  s.clock.advance(1_000);
  assert.equal(s.round.record.reason, 'host-hidden');
});

test('a race survives its host leaving and ranks finishers, then scores, then silence', () => {
  const { round, clock, allHello, allReady, to } = setup({ n: 4, mode: 'race', limitMs: 30_000 });
  allHello();
  allReady();
  clock.advance(5_000);
  round.receive('k2', { type: 'result', time: 9_000 });
  round.receive('k2', { type: 'result', time: 1 });
  round.leave('k0');
  assert.equal(round.record, null);
  clock.advance(28_000);
  assert.equal(to('k1', 'time-up').length, 1);
  round.receive('k1', { type: 'result', score: 4_200 });
  clock.advance(5_000);
  assert.equal(round.record.status, 'played');
  assert.deepEqual(round.record.standings, [[2], [1], [3], [0]]);
  assert.deepEqual(round.record.scores, { 1: 4_200, 2: 9_000 });
});

test('a racer who finished and then left keeps their place', () => {
  const { round, clock, allHello, allReady } = setup({ n: 3, mode: 'race' });
  allHello();
  allReady();
  clock.advance(4_000);
  round.receive('k0', { type: 'result', time: 5_000 });
  round.leave('k0');
  round.leave('k2');
  round.receive('k1', { type: 'result', time: 9_000 });
  assert.deepEqual(round.record.standings, [[0], [1], [2]]);
});

test('a player still in a race or side by side who never reports is ranked by their last progress', () => {
  const { round, clock, allHello, allReady } = setup({ n: 3, mode: 'parallel', limitMs: 30_000 });
  allHello();
  allReady();
  clock.advance(4_000);
  round.progress(0, 300);
  round.progress(1, 800);
  round.progress(2, 50);
  round.leave('k2');
  round.receive('k1', { type: 'result', score: 700 });
  round.progress(1, 9_999);
  clock.advance(29_000 + 5_000);
  assert.deepEqual(round.record.standings, [[1], [0], [2]], 'a reported result wins over later progress, and leaving with only progress counts as beaten');
  assert.deepEqual(round.record.results[0], { score: 300, fallback: true });
});

test('a race takes no time from null, empty text or true, whatever client sent it', () => {
  const { round, clock, allHello, allReady } = setup({ n: 2, mode: 'race' });
  allHello();
  allReady();
  clock.advance(4_000);
  round.receive('k0', { type: 'result', time: null, score: 40 });
  round.receive('k1', { type: 'result', time: '', score: true });
  round.receive('k1', { type: 'result', time: '52000' });
  assert.deepEqual(round.record.results, { 0: { score: 40 }, 1: { time: 52_000 } });
  assert.deepEqual(round.record.standings, [[1], [0]], 'a finisher beats a score; a null time is no 0 ms finish');
});

test('a race ends as soon as every racer has reported', () => {
  const { round, clock, allHello, allReady } = setup({ n: 2, mode: 'race' });
  allHello();
  allReady();
  clock.advance(4_000);
  round.receive('k0', { type: 'result', time: 30_000 });
  round.receive('k1', { type: 'result', time: 25_000 });
  assert.deepEqual(round.record.standings, [[1], [0]]);
});

test('side by side: each copy reports itself, nothing waits on a host, and the round ranks like a race', () => {
  const { round, clock, allHello, allReady, to } = setup({ n: 3, mode: 'parallel', limitMs: 30_000 });
  allHello();
  allReady();
  clock.advance(4_000);
  round.leave('k0');
  assert.equal(round.record, null, 'the first seat leaving ends nothing: there is no shared world');
  round.receive('k1', { type: 'result', score: 900, stats: { stars: 12 }, awards: [{ title: 'Star streak' }] });
  round.receive('k2', { type: 'finish', standings: [[2], [1]] });
  clock.advance(29_000);
  assert.equal(to('k2', 'time-up').length, 1);
  round.receive('k2', { type: 'result', score: 1_400 });
  assert.equal(round.record.status, 'played', 'the round ends as soon as everyone left in it has reported');
  assert.deepEqual(round.record.standings, [[2], [1], [0]]);
  assert.deepEqual(round.record.stats, { 1: { stars: 12 } });
  assert.deepEqual(round.record.awards, [{ id: 1, title: 'Star streak' }]);
  assert.match(round.record.issues.map((i) => i.problem).join('|'), /finish is for versus and co-op; parallel games report result/);
});

test('a fatal error voids the round only when it comes from the host of a shared world', () => {
  let s = setup({ n: 3 });
  s.allHello();
  s.round.receive('k2', { type: 'error', message: 'no WebGL', fatal: true });
  assert.equal(s.round.record, null);
  assert.deepEqual(s.to('k0', 'leave').map((m) => m.reason), ['disconnected']);
  s.round.receive('k0', { type: 'error', message: 'no WebGL', fatal: true });
  assert.equal(s.round.record.reason, 'host-error');
});

test('timeUp() and abort() end a round on the hub’s say-so', () => {
  const s = setup({ n: 2 });
  s.allHello();
  s.allReady();
  s.clock.advance(3_500);
  s.round.timeUp();
  s.round.timeUp();
  assert.equal(s.to('k1', 'time-up').length, 1);
  s.round.abort('session-ended');
  assert.deepEqual(s.to('k1', 'end').map((m) => m.reason), ['session-ended']);
});

test('race ranking groups ties, and standings checks catch every mistake', () => {
  const results = new Map([[0, { time: 5 }], [1, { time: 5 }], [2, { score: 10 }], [3, { score: 30 }]]);
  assert.deepEqual(rankRace(results, [0, 1, 2, 3, 4]), [[0, 1], [3], [2], [4]]);
  assert.deepEqual(checkStandings([[1], 0], [0, 1], [0, 1, 2]), { ok: true, standings: [[1], [0], [2]] });
  assert.match(checkStandings([[0], [0, 1]], [0, 1], [0, 1]).problem, /twice/);
  assert.match(checkStandings([[0], [5]], [0], [0, 1]).problem, /unknown/);
  assert.match(checkStandings('first', [0], [0]).problem, /not an array/);
  assert.equal(limitFor(4), 360_000);
  assert.equal(limitFor(30), 900_000);
  assert.equal(limitFor(undefined), 450_000);
});

test('a server, a copy with no player of its own, hosts the world, is never ranked, and takes the round with it when it goes', () => {
  const make = () => {
    const clock = fakeClock();
    const sent = [];
    const players = [0, 1].map((slot) => ({ key: `k${slot}`, slot, name: `P${slot}` }));
    const round = createRound({ round: 2, players, hostKey: 'k0', serverKey: 's', mode: 'versus', seed: 5, limitMs: 60_000, clock, deliver: (key, msg) => sent.push([key, msg]) });
    const to = (key, type) => sent.filter(([k, m]) => k === key && m.type === type).map(([, m]) => m);
    for (const key of ['k0', 'k1', 's']) round.receive(key, { type: 'hello', v: 1, mode: 'versus', seats: [2, 4] });
    return { round, clock, to };
  };
  const { round, clock, to } = make();
  const [player] = to('k0', 'welcome');
  const [server] = to('s', 'welcome');
  assert.deepEqual([player.me, player.host, player.players.map((p) => p.id), player.server], [0, 2, [0, 1], undefined]);
  assert.deepEqual([server.me, server.host, server.players.map((p) => p.id), server.server, server.keys], [2, 2, [0, 1], true, ['k0', 'k1', 's']]);
  round.receive('k0', { type: 'ready' });
  round.receive('k1', { type: 'ready' });
  assert.equal(round.phase, 'loading', 'the round waits for the server to load too');
  round.receive('s', { type: 'ready' });
  assert.equal(round.phase, 'countdown');
  clock.advance(4_000);
  round.receive('k0', { type: 'finish', standings: [[0], [1]] });
  assert.equal(round.record, null, 'a player cannot finish: the server hosts');
  round.receive('s', { type: 'finish', standings: [[1], [0]] });
  assert.deepEqual(round.record.standings, [[1], [0]]);
  assert.equal(round.record.hostId, 2);
  assert.deepEqual(round.record.players.map((p) => p.id), [0, 1], 'the server is no player');

  const second = make();
  for (const key of ['k0', 'k1', 's']) second.round.receive(key, { type: 'ready' });
  second.clock.advance(4_000);
  second.round.leave('s');
  assert.deepEqual([second.round.record.status, second.round.record.reason], ['void', 'host-left']);
});

/* --- the bridge (lib/hub/bridge.js) ----------------------------------------- */

function bridgeSetup() {
  const clock = fakeClock(10_000);
  const posted = [];
  const net = [];
  const issues = [];
  const progress = [];
  const bridge = createBridge({
    key: 'b',
    round: 4,
    coordinator: 'hub',
    post: (msg) => posted.push(msg),
    net: { send: (to, env, opts) => net.push([to, env, opts]) },
    clock,
    onIssue: (i) => issues.push(i.problem),
    onProgress: (id, p) => progress.push([id, p]),
  });
  const welcome = (extra = {}) =>
    bridge.fromNet('hub', { k: 'h', r: 4, m: { round: 4, type: 'welcome', me: 1, host: 0, players: [], keys: ['a', 'b', 'c'], mode: 'race', seed: 1, limitMs: 9, ...extra } });
  return { bridge, posted, net, issues, clock, welcome, progress };
}

test('the bridge hands a game’s fullscreen requests to the hub page, whenever they come', () => {
  const asked = [];
  const bridge = createBridge({ key: 'b', round: 1, coordinator: 'hub', post: () => {}, net: { send: () => {} }, clock: fakeClock(), onFullscreen: (on) => asked.push(on) });
  bridge.fromGame({ aihub: 1, type: 'fullscreen', on: true });
  bridge.fromGame({ aihub: 1, type: 'fullscreen' });
  assert.deepEqual(asked, [true, false]);
});

test('the bridge tells the game the limits it enforces', () => {
  const { posted, welcome } = bridgeSetup();
  welcome();
  assert.deepEqual(posted[0].limits, { maxBytes: LIMITS.maxBytes, ratePerS: LIMITS.ratePerS, burst: LIMITS.burst });
});

test('progress reaches this hub and every other player over the network, about once a second, never a game', () => {
  const { bridge, posted, net, issues, clock, welcome, progress } = bridgeSetup();
  bridge.fromGame({ aihub: 1, type: 'progress', score: 1 });
  welcome();
  bridge.fromGame({ aihub: 1, type: 'progress', score: 120, label: '  Lap 2 of 3 and a very long tail  ' });
  assert.deepEqual(progress, [[1, { score: 120, label: 'Lap 2 of 3 and a very lo' }]]);
  assert.deepEqual(net.map(([to, env, opts]) => [to, env.k, env.f, opts.reliable]), [['a', 'p', 1, false], ['c', 'p', 1, false]]);
  bridge.fromGame({ aihub: 1, type: 'progress', score: 130 });
  clock.advance(1_000);
  bridge.fromGame({ aihub: 1, type: 'progress', score: 'lots' });
  bridge.fromGame({ aihub: 1, type: 'progress', score: 140 });
  assert.deepEqual(progress.map(([, p]) => p.score), [120, 140]);
  assert.deepEqual(issues, ['progress before welcome', 'progress needs a finite score'], 'a report too close to the last is dropped quietly: the next one carries the newest score');

  bridge.fromNet('a', { k: 'p', r: 4, f: 0, d: { score: 77, label: 'Floor 3' } });
  bridge.fromNet('c', { k: 'p', r: 4, f: 0, d: { score: 99 } });
  bridge.fromNet('a', { k: 'p', r: 3, f: 0, d: { score: 55 } });
  assert.deepEqual(progress.slice(2), [[0, { score: 77, label: 'Floor 3' }]], 'a spoofed sender or another round is dropped');
  assert.ok(!posted.some((m) => m.type === 'progress'), 'games never see progress');
});

test('progress stops with the end of the round, and from a player who left', () => {
  const { bridge, welcome, progress } = bridgeSetup();
  welcome();
  bridge.fromNet('hub', { k: 'h', r: 4, m: { type: 'leave', id: 2, reason: 'left' } });
  bridge.fromNet('c', { k: 'p', r: 4, f: 2, d: { score: 5 } });
  bridge.fromNet('hub', { k: 'h', r: 4, m: { type: 'end', reason: 'finished' } });
  bridge.fromNet('a', { k: 'p', r: 4, f: 0, d: { score: 6 } });
  assert.deepEqual(progress, []);
});

test('the bridge forwards the first hello, and refuses game traffic before the welcome', () => {
  const { bridge, net, issues } = bridgeSetup();
  bridge.fromGame({ aihub: 1, type: 'hello', v: 1, client: '1.1.0', mode: 'race', seats: [2, 4] });
  bridge.fromGame({ aihub: 1, type: 'hello', v: 1 });
  bridge.fromGame({ aihub: 1, type: 'send', data: { a: 1 } });
  bridge.fromGame({ aihub: 1, type: 'shout' });
  assert.deepEqual(net.map(([to, env]) => [to, env.k, env.m.type]), [['hub', 'c', 'hello']]);
  assert.deepEqual(issues, ['send before welcome', 'unknown message type "shout"']);
});

test('the bridge strips the routing keys from the welcome and delivers traffic queued before it', () => {
  const { bridge, posted, welcome } = bridgeSetup();
  bridge.fromNet('a', { k: 'g', r: 4, f: 0, d: { early: true } });
  bridge.fromNet('a', { k: 'g', r: 3, f: 0, d: { stale: true } });
  welcome();
  assert.equal(posted[0].type, 'welcome');
  assert.equal(posted[0].keys, undefined);
  assert.equal(posted[0].round, 4);
  assert.deepEqual(posted.slice(1), [{ aihub: 1, type: 'message', from: 0, data: { early: true } }]);
  bridge.fromNet('c', { k: 'g', r: 4, f: 0, d: { spoof: true } });
  assert.equal(posted.length, 2, 'traffic whose sender does not match its id is dropped');
});

test('the bridge routes sends to one player or everyone still here, within the limits', () => {
  const { bridge, net, issues, welcome, clock } = bridgeSetup();
  welcome();
  bridge.fromGame({ aihub: 1, type: 'send', data: { all: 1 }, reliable: false });
  assert.deepEqual(net.map(([to, env, opts]) => [to, env.f, opts.reliable]), [['a', 1, false], ['c', 1, false]]);
  bridge.fromNet('hub', { k: 'h', r: 4, m: { type: 'leave', id: 2, reason: 'left' } });
  bridge.fromGame({ aihub: 1, type: 'send', data: { all: 2 } });
  assert.deepEqual(net.slice(2).map(([to]) => to), ['a']);
  bridge.fromGame({ aihub: 1, type: 'send', data: 1, to: 1 });
  bridge.fromGame({ aihub: 1, type: 'send', data: 'x'.repeat(LIMITS.maxBytes + 10) });
  assert.match(issues.join('|'), /no player 1 to send to/);
  assert.match(issues.join('|'), /over the 16384-byte limit/);
  for (let i = 0; i < 50; i++) bridge.fromGame({ aihub: 1, type: 'send', data: i, to: 0 });
  assert.match(issues.at(-1), /messages a second/);
  clock.advance(1_000);
  const before = net.length;
  bridge.fromGame({ aihub: 1, type: 'send', data: 'again', to: 0 });
  assert.equal(net.length, before + 1);
});

test('the bridge turns the start time into a countdown and stops after the end', () => {
  const { bridge, posted, net, welcome, clock } = bridgeSetup();
  welcome();
  bridge.fromNet('hub', { k: 'h', r: 4, m: { type: 'start', at: clock.now() + 2_500 } });
  assert.deepEqual(posted.at(-1), { aihub: 1, type: 'start', in: 2_500 });
  bridge.fromNet('a', { k: 'h', r: 4, m: { type: 'end', reason: 'void' } });
  assert.equal(bridge.ended, false, 'only the coordinator ends a round');
  bridge.fromNet('hub', { k: 'h', r: 4, m: { type: 'end', reason: 'finished', standings: [[0], [1]] } });
  assert.deepEqual(posted.at(-1), { aihub: 1, type: 'end', reason: 'finished', standings: [[0], [1]] });
  const sent = net.length;
  bridge.fromGame({ aihub: 1, type: 'send', data: 1 });
  bridge.fromNet('a', { k: 'g', r: 4, f: 0, d: 1 });
  assert.equal(net.length, sent);
  assert.equal(posted.at(-1).type, 'end');
});

test('the simulated network keeps reliable messages in order and only loses unreliable ones', async () => {
  const net = createLocalNetwork({ latency: 5, jitter: 5, loss: 1 });
  const a = net.endpoint('a');
  const b = net.endpoint('b');
  const got = [];
  b.onMessage((from, env) => got.push(env.n));
  for (let n = 0; n < 20; n++) a.send('b', { n }, { reliable: true });
  for (let n = 100; n < 110; n++) a.send('b', { n }, { reliable: false });
  // Wait for the reliable twenty however busy the machine is (loss 1 drops every
  // unreliable one before it is scheduled), then a little longer for strays.
  const deadline = Date.now() + 5_000;
  while (got.length < 20 && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 10));
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.deepEqual(got, Array.from({ length: 20 }, (_, n) => n));
});

/* --- the spec, the examples and the catalogue --------------------------------- */

test('the client reports the splash, and hands the harness whatever the game probes', async () => {
  const { hub, fromHub } = await loadClient();
  assert.equal(hub.inspect(), null, 'nothing to inspect until the game probes');
  let world = 0;
  hub.probe(() => ({ scene: 'play', menu: false, world: ++world, input: { x: 1 } }));
  assert.deepEqual(hub.inspect(), { scene: 'play', menu: false, world: 1, input: { x: 1 } });
  hub.probe(() => {
    throw new Error('not built yet');
  });
  assert.equal(hub.inspect().error, 'not built yet', 'a probe that throws says why instead of breaking the harness');
  const info = hub.connect({ mode: 'versus', seats: [2, 4] });
  fromHub({ ...WELCOME, splash: true });
  assert.equal((await info).splash, true);
  assert.equal(hub.splash, true);
});

test('the spec and the three examples carry the client byte for byte', async () => {
  const client = await read('lib/hub/session.js');
  assert.match(client, /^\/\*! aihub-session 1\.3\.0 /);
  for (const file of ['lib/hub/README.md', 'lib/hub/examples/arena.html', 'lib/hub/examples/race.html', 'lib/hub/examples/parallel.html']) {
    assert.ok((await read(file)).includes(client), `${file} must contain lib/hub/session.js unchanged`);
  }
});

test('the examples declare session support in their heads', async () => {
  const { parseHead } = await import('./lib/parse.mjs');
  for (const [file, mode, seats] of [['lib/hub/examples/arena.html', 'versus', [2, 4]], ['lib/hub/examples/race.html', 'race', [2, 4]], ['lib/hub/examples/parallel.html', 'parallel', [1, 4]]]) {
    const { hub } = parseHead(await read(file));
    assert.equal(hub.session, '1');
    assert.equal(hub.sessionMode, mode);
    assert.deepEqual(sessionOf(hub).seats, seats);
  }
});

test('a game’s session support reads as one line, and none of its fields becomes a rail', () => {
  assert.equal(sessionOf({}), null);
  assert.equal(sessionOf({ session: 'yes' }), null);
  const game = { session: '1', sessionPlayers: '2–4', sessionMode: 'race', sessionMinutes: '4', sessionGoal: 'First over the line', sessionHowto: 'Steer ← →' };
  assert.deepEqual(sessionOf(game), {
    version: 1,
    seats: [2, 4],
    mode: 'race',
    minutes: 4,
    goal: 'First over the line',
    howto: 'Steer ← →',
    supported: true,
    label: '2–4 players · Race · about 4 min',
  });
  assert.equal(sessionOf({ session: '1', sessionGoal: 'x'.repeat(90) }).goal.length, 60);
  assert.equal(sessionOf({ session: '2' }).supported, false);
  assert.equal(sessionOf({ session: '1', sessionPlayers: '4' }).label, '4 players');
  for (const key of Object.keys(game)) assert.ok(NOT_A_FACET.has(key));
});
