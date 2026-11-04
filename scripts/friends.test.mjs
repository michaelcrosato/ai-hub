// What the hub can play with friends, as every view reads it: which games
// play in a session and which on one screen, how each is filed, the Friends
// view's selection and rows, its game-night picks, and the links into a
// session. Pinned here.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { normalize } from '../assets/js/manifest.js';
import {
  WAYS,
  playsOnline,
  playsOnOneScreen,
  playsTogether,
  togetherOf,
  togetherLine,
  seatsText,
  friendsHref,
  hostHref,
  joinHref,
  inviteCode,
  selectTogether,
  rowsOf,
  spotlightOf,
  SPOTLIGHT,
  tally,
} from '../assets/js/friends/together.js';
import { VIEWS } from '../assets/js/ui/views.js';

const game = (slug, patch = {}) => normalize({ slug, name: slug, type: 'Game', added: '2026-10-01', ...patch });
const online = (slug, mode = 'shared-world', patch = {}) =>
  game(slug, { session: '1', sessionPlayers: '1-4', sessionMode: mode, sessionMinutes: '4', sessionGoal: 'Most points', ...patch });
const slugs = (list) => list.map((g) => g.slug);

function library() {
  return [
    online('arena', 'co-op', { added: '2026-10-05', genre: 'Action' }),
    online('kart', 'race', { added: '2026-10-04', genre: 'Racing', sessionMinutes: '3' }),
    online('stars', 'parallel', { added: '2026-10-03', sessionMinutes: '8' }),
    online('duel', 'versus', { added: '2026-10-02', sessionPlayers: '2-2' }),
    online('gpu', 'parallel', { added: '2026-10-01', webgpu: 'required' }),
    game('couch', { players: '1–4', added: '2026-09-30' }),
    game('pair', { players: '2', added: '2026-09-29' }),
    game('solo'),
    online('future', 'parallel', { session: '2' }),
    online('hidden', 'parallel', { restricted: true }),
    online('demo', 'parallel', { type: 'Tech demo' }),
  ];
}

test('a game plays together online when it declares a protocol this hub runs and sits on the Games shelf', () => {
  const games = library();
  assert.deepEqual(slugs(games.filter((g) => playsOnline(g))), ['arena', 'kart', 'stars', 'duel', 'gpu']);
  assert.equal(playsOnline(games.find((g) => g.slug === 'hidden'), { showAll: true }), true, 'dev settings show hidden games');
  assert.deepEqual(slugs(games.filter((g) => playsOnOneScreen(g))), ['couch', 'pair']);
  assert.equal(playsTogether(games.find((g) => g.slug === 'solo')), false);
});

test('each game is filed under one way: its session mode, the old tags as the new modes, else one screen', () => {
  const by = Object.fromEntries(library().filter((g) => playsTogether(g)).map((g) => [g.slug, togetherOf(g).way.key]));
  assert.deepEqual(by, { arena: 'shared-world', kart: 'ghost', stars: 'parallel', duel: 'shared-world', gpu: 'parallel', couch: 'couch', pair: 'couch' });
  assert.deepEqual(WAYS.map((w) => w.key), ['shared-world', 'ghost', 'parallel', 'couch']);
});

test('how a game plays together, in one line and in facts', () => {
  const [arena, kart, , duel, gpu, couch] = library();
  assert.equal(togetherLine(arena), 'Shared world · 1–4 players · about 4 min');
  assert.equal(togetherLine(kart), 'Ghost · 1–4 players · about 3 min');
  assert.equal(togetherLine(duel), 'Shared world · 2 players · about 4 min');
  assert.equal(togetherLine(couch), 'One screen · 1–4 players');
  assert.equal(togetherOf(gpu).webgpu, true);
  assert.equal(togetherOf(couch).online, false);
  assert.deepEqual(togetherOf(couch).screen, [1, 4]);
  assert.equal(togetherLine(game('solo')), '');
  assert.equal(seatsText([3, 3]), '3 players');
});

test('the links: a game’s page in the Friends view, a session hosted with it, and an invite', () => {
  const arena = library()[0];
  assert.equal(friendsHref(arena), '/friends#/g/arena');
  assert.equal(hostHref(arena), '/session?first=arena');
  assert.equal(hostHref(arena, { local: true }), '/session?transport=local&first=arena#try');
  assert.equal(hostHref(), '/session');
  assert.equal(hostHref(null, { local: true }), '/session?transport=local&examples=1#try');
  assert.equal(joinHref('abcdefgh23'), '/session#abcdefgh23');
});

test('an invite code is found in the code, the link, or a message with the link in it', () => {
  assert.equal(inviteCode('abcdefgh23'), 'abcdefgh23');
  assert.equal(inviteCode('  ABCDEFGH23 '), 'abcdefgh23');
  assert.equal(inviteCode('https://crosato-arcade.vercel.app/session#abcdefgh23'), 'abcdefgh23');
  assert.equal(inviteCode('Join me! https://example.workers.dev/session#k2m3n4p5q6 see you'), 'k2m3n4p5q6');
  assert.equal(inviteCode('the code is k2m3n4p5q6'), 'k2m3n4p5q6');
  assert.equal(inviteCode('abcde-fgh23'), 'abcdefgh23');
  assert.equal(inviteCode('abcdefgh2'), null, 'too short');
  assert.equal(inviteCode('abcdefgh10'), null, 'no 0 or 1: the hub never hands them out');
  assert.equal(inviteCode('hellothere'), null, 'nor l or o');
  assert.equal(inviteCode('pizza night'), null, 'words with a space between are not a code');
  assert.equal(inviteCode('https://example.com/session'), null);
  assert.equal(inviteCode(''), null);
  assert.equal(inviteCode(null), null);
});

test('the Friends view narrows by the party’s size, the way it plays, a round’s length and a search', () => {
  const games = library();
  assert.deepEqual(slugs(selectTogether(games)), ['arena', 'kart', 'stars', 'duel', 'gpu', 'couch', 'pair'], 'newest first');
  assert.deepEqual(slugs(selectTogether(games, { players: 3 })), ['arena', 'kart', 'stars', 'gpu', 'couch'], 'a duel seats two, a pair game two');
  assert.deepEqual(slugs(selectTogether(games, { players: 2 })), ['arena', 'kart', 'stars', 'duel', 'gpu', 'couch', 'pair']);
  assert.deepEqual(slugs(selectTogether(games, { way: 'ghost' })), ['kart']);
  assert.deepEqual(slugs(selectTogether(games, { way: 'couch' })), ['couch', 'pair']);
  assert.deepEqual(slugs(selectTogether(games, { length: 'short' })), ['kart'], 'a length is a session round’s: one-screen games have none');
  assert.deepEqual(slugs(selectTogether(games, { length: 'long' })), ['stars']);
  assert.deepEqual(slugs(selectTogether(games, { q: 'racing' })), ['kart']);
  assert.deepEqual(slugs(selectTogether(games, { q: 'racing', way: 'parallel' })), []);
});

test('rows come one per way, in order, and an empty way has none', () => {
  const rows = rowsOf(selectTogether(library()));
  assert.deepEqual(rows.map((r) => [r.key, slugs(r.games)]), [
    ['shared-world', ['arena', 'duel']],
    ['ghost', ['kart']],
    ['parallel', ['stars', 'gpu']],
    ['couch', ['couch', 'pair']],
  ]);
  assert.deepEqual(rowsOf(selectTogether(library(), { way: 'ghost' })).map((r) => r.key), ['ghost']);
});

test('the game-night picks are the hub’s own, else the newest shared worlds', () => {
  const picks = SPOTLIGHT.slice(0, 3).map((slug, i) => online(slug, 'race', { added: `2026-09-0${i + 1}` }));
  assert.deepEqual(slugs(spotlightOf([...library(), ...picks])), SPOTLIGHT.slice(0, 3));
  assert.deepEqual(slugs(spotlightOf(library())), ['arena', 'duel'], 'none of the picks here: the shared worlds stand in');
  assert.deepEqual(spotlightOf([game('solo')]), []);
});

test('the counts: every game that plays together, online, and on one screen only', () => {
  const t = tally(library());
  assert.equal(t.all, 7);
  assert.equal(t.online, 5);
  assert.equal(t.screen, 2);
  assert.deepEqual(t.by, { 'shared-world': 2, ghost: 1, parallel: 2, couch: 2 });
});

test('Friends is a view of its own in every switch, second after the Wall', () => {
  assert.deepEqual(VIEWS.map((v) => v.key), ['wall', 'friends', 'couch', 'catalogue', 'atlas', 'timeline', 'deck']);
  assert.equal(VIEWS[1].href, '/friends');
});
