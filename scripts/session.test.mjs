import test from 'node:test';
import assert from 'node:assert/strict';

import { nameChoices, isNickname, ADJECTIVES, ANIMALS } from '../assets/js/session/names.js';
import { eligible, pickNext } from '../assets/js/session/pick.js';
import { placesOf, scoreRound, addRound, leaderboard } from '../assets/js/session/score.js';
import { createLocalNet } from '../assets/js/session/local.js';

const game = (slug, extra = {}) => ({ slug, name: slug, type: 'Game', session: '1', sessionPlayers: '2-4', sessionMode: 'race', ...extra });

test('every generated name fits the protocol: two listed words, letters and a space, 16 characters at most', () => {
  for (const a of ADJECTIVES) for (const b of ANIMALS) assert.match(`${a} ${b}`, /^[A-Za-z]+ [A-Za-z]+$/), assert.ok(`${a} ${b}`.length <= 16);
  assert.equal(isNickname('Teal Otter'), true);
  assert.equal(isNickname('Teal Otter!'), false);
  assert.equal(isNickname('<b>Teal</b> Otter'), false);
  assert.equal(isNickname('Teal Otter Jr'), false);
});

test('name choices are the same for a seed, all different, and never one already taken', () => {
  const first = nameChoices('s:1', 6);
  assert.deepEqual(nameChoices('s:1', 6), first);
  assert.equal(new Set(first).size, 6);
  assert.equal(new Set(first.map((n) => n.split(' ')[1])).size, 6, 'no two with the same animal');
  const again = nameChoices('s:1', 6, first.slice(0, 3));
  assert.ok(again.every((n) => !first.slice(0, 3).includes(n)));
  assert.ok(first.every(isNickname));
});

test('Random Mode only deals games that declare a supported session and seat the players', () => {
  const games = [
    game('fits'),
    game('three-only', { sessionPlayers: '3-3' }),
    game('future', { session: '2' }),
    game('no-session', { session: undefined }),
    game('restricted', { restricted: true }),
    game('demo', { type: 'Tech demo' }),
    game('unsure', { unsure: true }),
  ];
  assert.deepEqual(eligible(games, 2).map((g) => g.slug), ['fits']);
  assert.deepEqual(eligible(games, 3).map((g) => g.slug), ['fits', 'three-only']);
  assert.deepEqual(eligible(games, 5), []);
});

test('Random Mode plays every game once before any comes round again, in an order set by the seed', () => {
  const games = ['a', 'b', 'c', 'd'].map((s) => game(s));
  let state = { seed: 42, n: 2, cycle: 0, played: [] };
  const dealt = [];
  for (let i = 0; i < 8; i++) {
    const next = pickNext(games, state);
    dealt.push(next.game.slug);
    state = { ...state, cycle: next.cycle, played: next.played };
  }
  assert.deepEqual([...dealt.slice(0, 4)].sort(), ['a', 'b', 'c', 'd']);
  assert.deepEqual([...dealt.slice(4)].sort(), ['a', 'b', 'c', 'd']);
  assert.equal(state.cycle, 1);
  const again = [];
  let replay = { seed: 42, n: 2, cycle: 0, played: [] };
  for (let i = 0; i < 4; i++) {
    const next = pickNext(games, replay);
    again.push(next.game.slug);
    replay = { ...replay, cycle: next.cycle, played: next.played };
  }
  assert.deepEqual(again, dealt.slice(0, 4), 'the same seed deals the same order');
  assert.equal(pickNext(games, { seed: 1, n: 7 }), null);
});

test('a player scores one point per player beaten; ties share a place; leavers placed last score nothing', () => {
  assert.deepEqual([...placesOf([[2], [0, 3], [1]])], [[2, 1], [0, 2], [3, 2], [1, 4]]);
  const scored = scoreRound({ standings: [[2], [0, 3], [1]], mode: 'versus' });
  assert.deepEqual(Object.fromEntries([...scored].map(([id, r]) => [id, [r.place, r.points, r.win]])), {
    0: [2, 1, false],
    1: [4, 0, false],
    2: [1, 3, true],
    3: [2, 1, false],
  });
  const coop = scoreRound({ standings: [[0, 1, 2]], mode: 'co-op', won: true });
  assert.ok([...coop.values()].every((r) => r.points === 0 && r.win));
  const lost = scoreRound({ standings: [[0, 1]], mode: 'co-op', won: false });
  assert.ok([...lost.values()].every((r) => !r.win));
});

test('the table adds rounds up and ranks by points, then wins, then average place', () => {
  let totals = {};
  totals = addRound(totals, [
    { key: 'a', name: 'Ana', slot: 0, place: 1, points: 2, win: true },
    { key: 'b', name: 'Bo', slot: 1, place: 2, points: 1, win: false },
    { key: 'c', name: 'Cy', slot: 2, place: 3, points: 0, win: false },
  ]);
  totals = addRound(totals, [
    { key: 'b', name: 'Bo', slot: 1, place: 1, points: 1, win: true },
    { key: 'c', name: 'Cy', slot: 2, place: 2, points: 0, win: false },
  ]);
  const table = leaderboard(totals);
  assert.deepEqual(table.map((r) => [r.key, r.points, r.wins, r.rounds]), [
    ['a', 2, 1, 1],
    ['b', 2, 1, 2],
    ['c', 0, 0, 2],
  ]);
});

/** BroadcastChannel stand-in: every channel of one name hears every other. */
function fakeChannels() {
  const open = new Map();
  return class FakeChannel {
    constructor(name) {
      this.name = name;
      if (!open.has(name)) open.set(name, new Set());
      open.get(name).add(this);
    }
    postMessage(data) {
      const copy = JSON.parse(JSON.stringify(data));
      for (const ch of open.get(this.name)) if (ch !== this) setTimeout(() => ch.onmessage?.({ data: copy }));
    }
    close() {
      open.get(this.name).delete(this);
    }
  };
}

test('the local transport shows who is here and carries envelopes to one tab or all', async () => {
  const Channel = fakeChannels();
  globalThis.addEventListener ??= () => {};
  globalThis.removeEventListener ??= () => {};
  const a = createLocalNet({ code: 't', key: 'a', Channel });
  const b = createLocalNet({ code: 't', key: 'b', Channel });
  const c = createLocalNet({ code: 'other', key: 'c', Channel });
  a.update({ slot: 0, name: 'Teal Otter' });
  b.update({ slot: 1, name: 'Gold Lynx' });
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(a.members().map((m) => [m.key, m.slot]).sort(), [['a', 0], ['b', 1]]);
  const got = [];
  b.onMessage((from, env) => got.push([from, env.n]));
  a.onMessage((from, env) => got.push([`${from}→a`, env.n]));
  a.send('b', { n: 1 });
  a.broadcast({ n: 2 });
  a.send('a', { n: 3 });
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(got.sort(), [['a', 1], ['a', 2], ['a→a', 3]]);
  b.close();
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(a.members().map((m) => m.key), ['a']);
  a.close();
  c.close();
});

test("the clock takes the host's time from the quickest round trip", async () => {
  const { offsetFrom, createClock } = await import('../assets/js/session/clock.js');
  // [sent, host's clock, received]: the host runs 500 ms ahead; the slow sample is skewed.
  assert.deepEqual(offsetFrom([[1000, 1700, 1400], [2000, 2510, 2020], [3000, 3600, 3300]]), { rtt: 20, offset: 500 });
  assert.equal(offsetFrom([]), null);
  let local = 10_000;
  const clock = createClock({ now: () => local, ask: async () => [local, local + 250, local + 4], samples: 3, every: 1e9 });
  clock.follow('host', false);
  await clock.sync();
  assert.equal(clock.following, 'host');
  assert.equal(clock.now(), 10_000 + 248);
  clock.follow('me', true);
  assert.equal(clock.following, null);
  assert.equal(clock.now(), 10_000, 'the host is the clock');
  clock.stop();
});
