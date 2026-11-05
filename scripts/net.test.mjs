import test from 'node:test';
import assert from 'node:assert/strict';

import { createRelayNet, supabaseRelay, plainProblem } from '../assets/js/session/net.js';

/** A stand-in for the session's Realtime channel: presence is pushed by the test. */
function fakeRelay() {
  let presence = () => {};
  return {
    tracked: [],
    closed: false,
    track(meta) {
      this.tracked.push(meta);
    },
    onPresence(fn) {
      presence = fn;
      fn([]);
    },
    push: (list) => presence(list),
    send() {},
    on() {},
    close() {
      this.closed = true;
    },
  };
}

test('of two tabs on one account, the older steps aside and the newer stays', () => {
  const oldRelay = fakeRelay();
  const older = createRelayNet({ key: 'michael', relay: oldRelay });
  older.update({ name: 'Silver Fox' });
  const oldTab = oldRelay.tracked.at(-1);
  const newRelay = fakeRelay();
  const newer = createRelayNet({ key: 'michael', relay: newRelay });
  newer.update({ name: 'Witty Otter' });
  const newTab = newRelay.tracked.at(-1);
  // Make the order certain whatever the clock did between the two lines above.
  newTab.joinedAt = oldTab.joinedAt + 1;
  newer.me().joinedAt = newTab.joinedAt;

  let olderOut = false;
  let newerOut = false;
  older.onSuperseded(() => (olderOut = true));
  newer.onSuperseded(() => (newerOut = true));
  const both = [{ key: 'michael', tabs: [{ tab: oldTab.tab, at: oldTab.joinedAt }, { tab: newTab.tab, at: newTab.joinedAt }] }];
  oldRelay.push(both);
  newRelay.push(both);

  assert.equal(olderOut, true);
  assert.equal(oldRelay.closed, true);
  assert.equal(newerOut, false);
  assert.equal(newRelay.closed, false);
  newer.close();
});

test('other players, and a lone tab, never step aside', () => {
  const relay = fakeRelay();
  const net = createRelayNet({ key: 'guest', relay });
  net.update({ name: 'Peppy Falcon' });
  const mine = relay.tracked.at(-1);
  let out = false;
  net.onSuperseded(() => (out = true));
  relay.push([
    { key: 'guest', tabs: [{ tab: mine.tab, at: mine.joinedAt }] },
    { key: 'michael', tabs: [{ tab: 'a', at: mine.joinedAt + 5 }, { tab: 'b', at: mine.joinedAt + 9 }] },
  ]);
  assert.equal(out, false);
  assert.deepEqual(net.members().map((m) => m.key), ['guest', 'michael']);
  net.close();
});

test('after a dropped connection rejoins the channel, this tab is tracked again', async () => {
  let subscribed;
  const tracks = [];
  const channel = {
    on: () => channel,
    subscribe(fn) {
      subscribed = fn;
      fn('SUBSCRIBED');
    },
    track: (meta) => tracks.push(meta),
    presenceState: () => ({}),
  };
  const sb = { realtime: { setAuth: async () => {} }, channel: () => channel };
  const relay = await supabaseRelay(sb, 'session-1', 'guest');
  assert.deepEqual(tracks, []);
  relay.track({ name: 'Jolly Walrus', slot: 1 });
  subscribed('SUBSCRIBED');
  assert.deepEqual(tracks, [{ name: 'Jolly Walrus', slot: 1 }, { name: 'Jolly Walrus', slot: 1 }]);
});

test('a failed host or join says why in plain words', () => {
  const unreachable = 'Game night cannot reach its server right now. Check your connection and try again in a minute.';
  assert.equal(plainProblem(new TypeError('Failed to fetch')), unreachable, 'offline, or the project is paused');
  assert.equal(plainProblem({ message: 'TypeError: NetworkError when attempting to fetch resource.' }), unreachable);
  assert.equal(plainProblem({ message: 'Service Unavailable', status: 503 }), unreachable);
  assert.equal(plainProblem({ message: 'this session is full', code: 'P0001' }), 'this session is full', "the database's own refusal passes through");
  assert.equal(plainProblem(new Error('Sign in with Google to host a session.')), 'Sign in with Google to host a session.');
  assert.equal(plainProblem(null), 'Something went wrong. Try again in a minute.');
});

