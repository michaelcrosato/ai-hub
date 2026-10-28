import test from 'node:test';
import assert from 'node:assert/strict';

import { createRelayNet } from '../assets/js/session/net.js';

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
