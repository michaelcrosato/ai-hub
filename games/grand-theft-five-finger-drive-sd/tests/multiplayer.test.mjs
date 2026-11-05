import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {boot, advance, root} from './harness.mjs';
import {findClients} from '../../../scripts/lib/hub-client.mjs';

function hubStub({empty = false, me = 0} = {}) {
  const handlers = new Map(), calls = [];
  const hub = {active: true, now: -Infinity, calls,
    info: {me, seed: 552, mode: 'ghost', isHost: me === 0, host: 0,
      players: [0, 1, 2, 3].map(id => ({id, name: `Player ${id + 1}`}))},
    connect: async options => { calls.push(['connect', options]); return empty ? null : hub.info; },
    on: (event, fn) => { if (!handlers.has(event)) handlers.set(event, new Set()); handlers.get(event).add(fn); return () => handlers.get(event).delete(fn); },
    emit: (event, ...args) => { for (const fn of [...(handlers.get(event) || [])]) fn(...args); },
    time: () => hub.now,
    ready: () => calls.push(['ready']), progress: x => calls.push(['progress', x]),
    result: x => calls.push(['result', x]), send: (x, options) => { calls.push(['send', x, options]); return true; },
    fail: x => calls.push(['fail', x])};
  return hub;
}
async function setup(options) {
  const hub = hubStub(options), env = boot({globals: {AIHub: hub}});
  await Promise.resolve(); await Promise.resolve();
  env.game.advance(1 / 120);
  return {...env, hub};
}
function go(env) { env.hub.now = 0; env.game.advance(1 / 120); }
const packet = (n = 1) => ({v: 1, n, zone: 'city', x: 400, y: 400, z: 0, facing: 0, crew: 'mara', car: null, moving: true});

test('one exact session client is the first script; tags match the adapter', () => {
  const html = readFileSync(new URL('index.html', root), 'utf8');
  const clients = findClients(html);
  assert.equal(clients.length, 1); assert.equal(clients[0].pristine, true);
  assert.match(html, /<meta charset="utf-8">\s*<script>\s*\/\*! aihub-session 1.4.0/);
  assert.match(html, /hub:session-mode" content="ghost"/);
  assert.match(html, /hub:session-players" content="1-4"/);
});
test('connect and ready need no input; simulation waits for the common zero', async () => {
  const e = await setup();
  assert.equal(e.hub.calls.filter(x => x[0] === 'ready').length, 1);
  assert.equal(e.app.session.seed, 552); assert.equal(e.app.session.tick, 0);
  e.hub.now = -1; advance(e.game, 2); assert.equal(e.app.session.tick, 0);
  go(e); assert.ok(e.app.session.tick > 0); assert.equal(e.app.hub.phase, 'playing');
  assert.equal(e.game.scenes.play.pausable, false);
});
test('progress and ghost traffic stay bounded and use only the hub', async () => {
  const e = await setup(); go(e);
  for (let i = 1; i <= 100; i++) { e.hub.now = i * 10; e.game.advance(.01); }
  const sent = e.hub.calls.filter(x => x[0] === 'send');
  assert.ok(sent.length >= 10 && sent.length <= 11);
  assert.ok(sent.every(x => JSON.stringify(x[1]).length < 1200 && x[2].reliable === false));
  assert.ok(e.hub.calls.some(x => x[0] === 'progress'));
});
test('ghosts reject malformed, unknown, stale and departed senders', async () => {
  const e = await setup(); go(e); const race = e.app.hub;
  for (const data of [null, {...packet(), x: Infinity}, {...packet(), x: 999999}, {...packet(), car: 'unknown'}, {...packet(), zone: '__proto__'}]) e.hub.emit('message', data, 1);
  e.hub.emit('message', packet(), 9); e.hub.emit('message', packet(), 0);
  assert.equal(race.peers.size, 0);
  const hash = e.G.stateHash(e.app.session.serialize());
  e.hub.emit('message', packet(2), 1); assert.equal(race.peers.size, 1);
  e.hub.emit('message', {...packet(1), x: 999}, 1); assert.equal(race.peers.get(1).x, 400);
  assert.equal(e.G.stateHash(e.app.session.serialize()), hash);
  e.hub.emit('leave', {id: 1}); e.hub.emit('message', packet(3), 1); assert.equal(race.peers.size, 0);
  e.hub.emit('message', packet(), 2); e.hub.now = 6001; race.frame(); assert.equal(race.peers.size, 0);
});
test('win reports hub elapsed time once; timeout does not replace it', async () => {
  const e = await setup(); go(e); e.hub.now = 12345;
  e.app.session.complete(); e.hub.emit('time-up', {graceMs: 2000});
  const results = e.hub.calls.filter(x => x[0] === 'result');
  assert.equal(results.length, 1); assert.equal(results[0][1].time, 12345);
  assert.equal(e.app.hub.phase, 'finished');
});
test('failure and time-up rank unfinished runs by objectives', async () => {
  for (const failure of [false, true]) {
    const e = await setup(); go(e); e.app.session.progress = 3;
    if (failure) e.app.session.fail('Crew down'); else e.hub.emit('time-up', {graceMs: 100});
    const result = e.hub.calls.find(x => x[0] === 'result')[1];
    assert.equal(result.score, 3000); assert.equal(result.time, undefined);
  }
});
test('end stops input, sound, simulation and all outgoing messages', async () => {
  const e = await setup(); go(e); e.hub.emit('end', {reason: 'session-ended'});
  const count = e.hub.calls.length, tick = e.app.session.tick;
  e.hub.now = 100000; advance(e.game, 1);
  e.app.start(); e.app.retry(); e.app.title(); e.hub.emit('time-up', {graceMs: 1});
  assert.equal(e.hub.calls.length, count); assert.equal(e.app.session.tick, tick);
  assert.equal(e.app.hub.phase, 'ended'); assert.equal(e.game.audio.muted, true);
});
test('host departure does not stop a ghost race; each copy has the same start', async () => {
  const a = await setup({me: 1}), b = await setup({me: 2});
  assert.equal(a.G.stateHash(a.app.session.serialize()), b.G.stateHash(b.app.session.serialize()));
  go(a); a.hub.emit('leave', {id: 0}); a.hub.now = 3000; advance(a.game, .2);
  assert.equal(a.app.hub.phase, 'playing'); assert.ok(a.app.session.tick > 1);
});
test('null connect falls back to the standalone title', async () => {
  const e = await setup({empty: true});
  assert.equal(e.app.hub, null); assert.equal(e.app.mode, 'title');
  assert.equal(e.game.o.autoPause, true);
});
test('local turns share a seed, isolate saves, block retries and score once', () => {
  const {app, game, G} = boot(); let clock = 0;
  app.party = new G.LocalRace(app, 2, 701); app.party.now = () => clock;
  const race = app.party; race.card(); race.start(); game.advance(1 / 120);
  assert.equal(app.session.seed, 701); assert.notEqual(app.session.save.store, app.storage);
  const saved = JSON.stringify(app.storage.data); app.session.checkpoint();
  assert.equal(JSON.stringify(app.storage.data), saved); assert.ok(app.session.save.store.writes > 0);
  const session = app.session; app.retry(); app.start(); assert.equal(app.session, session);
  clock = 10000; app.result(true); app.result(true); assert.equal(race.results.length, 1);
  race.seat++; race.card(); race.start(); game.advance(1 / 120);
  assert.equal(app.session.seed, 701); assert.equal(app.session.progress, 0);
  app.session.progress = 2; clock += race.limitMs; race.frame();
  assert.equal(race.results.length, 2); assert.equal(race.results[0].time, 10000);
  assert.equal(race.results[1].score, 2000); assert.equal(app.mode, 'party-results');
  app.title(); assert.equal(app.party, null); assert.equal(app.mode, 'title');
});

test('existing 1.0.0 checkpoints remain readable after the multiplayer update', () => {
  const {app, G} = boot(); app.start();
  const payload = app.session.serialize(); payload.gameVersion = '1.0.0';
  const save = new G.Save(app.storage); assert.equal(save.write(payload), true);
  assert.equal(save.load().gameVersion, '1.0.0');
  payload.gameVersion = '9.9.9'; assert.equal(save.payloadValid(payload), false);
});

test('back and close leave local race cards without resuming a finished turn', () => {
  const {app, game} = boot();
  app.localRace(2); app.shell.back();
  assert.equal(app.party, null); assert.equal(app.mode, 'title');
  game.advance(0); app.localRace(2); app.party.start(); game.advance(1 / 120);
  app.party.finish(false); app.shell._close();
  assert.equal(app.party, null); assert.equal(app.mode, 'title'); game.dispose();
});

test('a complete hub mission reaches all three views and reports one timed result', async () => {
  const e = await setup(); go(e);
  const s = e.app.session, persistent = JSON.stringify(e.app.storage.data);
  // The test supplies ordinary director actions. The live hub adapter never runs AI.
  for (let i = 0; i < 120 * 600 && !s.outcome; i++) {
    if (e.game.paused && s.stage?.id === 'brief') e.app.setApproach('quiet');
    e.app.testAction = s.bot.action();
    e.hub.now += 1000 / 120; e.game.advance(1 / 120);
  }
  assert.equal(s.outcome, 'success');
  assert.equal(s.progress, s.definition.stages.length);
  assert.ok(Object.values(s.metrics.views).every(time => time > 0));
  const results = e.hub.calls.filter(c => c[0] === 'result');
  assert.equal(results.length, 1); assert.ok(results[0][1].time > 0);
  assert.equal(JSON.stringify(e.app.storage.data), persistent);
  assert.equal(e.game.errors.length, 0); e.game.dispose();
});
