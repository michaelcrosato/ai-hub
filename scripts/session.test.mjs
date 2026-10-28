import test from 'node:test';
import assert from 'node:assert/strict';

import { nameChoices, isNickname, ADJECTIVES, ANIMALS } from '../assets/js/session/names.js';
import { eligible, pickNext, sessionPool } from '../assets/js/session/pick.js';
import { placesOf, scoreRound, addRound, leaderboard, formatOver, formatProgress, sessionAwards, finalTable } from '../assets/js/session/score.js';
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

test('the reference examples fill in while no library game supports sessions, or when the host asks for them', () => {
  const examples = [game('example')];
  const plain = [game('no-session', { session: undefined })];
  const ready = [game('fits')];
  assert.deepEqual(sessionPool(plain, examples).map((g) => g.slug), ['no-session', 'example']);
  assert.deepEqual(sessionPool(ready, examples).map((g) => g.slug), ['fits']);
  assert.deepEqual(sessionPool(ready, examples, true).map((g) => g.slug), ['fits', 'example']);
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

/** A played round of the given rows, as the session's history keeps it. */
const played = (rows) => ({ status: 'played', rows: rows.map(([key, place, points, win, awards = []]) => ({ key, place, points, win, awards })) });
const tableOf = (history) =>
  history.reduce((t, e) => (e.status === 'played' ? addRound(t, e.rows.map((r) => ({ ...r, name: r.key, slot: 0 }))) : t), {});

test('a session ends by its format: rounds that counted, a points target, or never', () => {
  const history = [played([['a', 1, 1, true], ['b', 2, 0, false]]), { status: 'void', rows: [] }];
  assert.equal(formatOver('sprint', history, tableOf(history)), false);
  const five = [...Array(5)].map(() => played([['a', 1, 1, true], ['b', 2, 0, false]]));
  assert.equal(formatOver('sprint', [...five, { status: 'void', rows: [] }], tableOf(five)), true);
  assert.equal(formatOver('party', five, tableOf(five)), false);
  assert.equal(formatOver('first12', five, { a: { points: 11 } }), false);
  assert.equal(formatOver('first12', five, { a: { points: 12 } }), true);
  assert.equal(formatOver('endless', [...five, ...five], tableOf(five)), false);
  assert.equal(formatProgress('party', five, tableOf(five)), 'Round 6 of 8');
  assert.equal(formatProgress('sprint', five.slice(0, 4), tableOf(five)), 'Final round');
  assert.equal(formatProgress('first12', five, tableOf(five)), 'First to 12: a has 5');
});

test('session awards go to the most game awards, the longest win streak and the best average place; ties share', () => {
  const history = [
    played([['a', 1, 2, true, [{ title: 'Hat-trick' }]], ['b', 2, 1, false], ['c', 3, 0, false]]),
    played([['a', 1, 2, true], ['b', 2, 1, false, [{ title: 'Fastest lap' }]], ['c', 3, 0, false]]),
    played([['b', 1, 2, true, [{ title: 'Untouchable' }, { title: 'Combo king' }]], ['a', 2, 1, false], ['c', 3, 0, false]]),
  ];
  const awards = sessionAwards(history, tableOf(history));
  assert.deepEqual(awards.map((x) => [x.title, x.keys]), [
    ['Showstopper', ['b']],
    ['Hot streak', ['a']],
    ['Steady hand', ['a']],
  ]);
  const level = [played([['a', 1, 1, true], ['b', 1, 1, true], ['c', 3, 0, false]])];
  assert.deepEqual(sessionAwards(level, tableOf(level)).map((x) => [x.title, x.keys]), [['Steady hand', ['a', 'b']]]);
  const all = [played([['a', 1, 0, true], ['b', 1, 0, true]])];
  assert.deepEqual(sessionAwards(all, tableOf(all)), [], 'an award every player shares is no award');
});

test('the final table adds the bonus for each session award and shares places only on a full tie', () => {
  const totals = {
    a: { key: 'a', name: 'Ana', points: 6, wins: 2, rounds: 3, placeSum: 4 },
    b: { key: 'b', name: 'Bo', points: 5, wins: 1, rounds: 3, placeSum: 5 },
    c: { key: 'c', name: 'Cy', points: 5, wins: 1, rounds: 3, placeSum: 5 },
  };
  const awards = [{ title: 'Showstopper', keys: ['b'] }, { title: 'Hot streak', keys: ['b'] }];
  assert.deepEqual(finalTable(totals, awards, 3).map((r) => [r.key, r.points, r.bonus, r.place]), [
    ['b', 11, 6, 1],
    ['a', 6, 0, 2],
    ['c', 5, 0, 3],
  ]);
  assert.deepEqual(finalTable(totals, [], 3).map((r) => [r.key, r.place]), [['a', 1], ['b', 2], ['c', 2]]);
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
