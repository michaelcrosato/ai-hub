import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

import { createTracker } from '../assets/js/account/plays.js';
import { safeReturn } from '../assets/js/account/auth.js';
import { duration } from '../assets/js/account/button.js';
import { store } from '../assets/js/store.js';
import { LIBRARY, SUPABASE_KEY } from '../assets/js/account/config.js';

function trackerSetup() {
  let t = 1_000_000;
  let visible = true;
  let saved = [];
  const sent = [];
  let online = true;
  let n = 0;
  const tracker = createTracker({
    now: () => t,
    visible: () => visible,
    load: () => saved,
    save: (list) => (saved = list),
    send: async (play) => {
      sent.push({ ...play });
      return online;
    },
    newId: () => `id${++n}`,
  });
  return {
    tracker,
    advance: (ms) => (t += ms),
    hide: (v) => (visible = !v),
    offline: (v) => (online = !v),
    saved: () => saved,
    sent,
  };
}

test('play time counts only while the page is in view, and is written ahead as it goes', async () => {
  const s = trackerSetup();
  s.tracker.start({ slug: 'snake', view: 'wall' });
  for (let i = 0; i < 6; i++) {
    s.advance(5_000);
    s.tracker.tick();
  }
  s.hide(true);
  for (let i = 0; i < 12; i++) {
    s.advance(5_000);
    s.tracker.tick();
  }
  s.hide(false);
  s.advance(5_000);
  assert.equal(s.saved()[0].activeSeconds, 30, 'written ahead before the game closes');
  const seconds = s.tracker.stop();
  assert.equal(seconds, 35);
  await new Promise((r) => setImmediate(r));
  assert.equal(s.sent.at(-1).activeSeconds, 35);
  assert.deepEqual(s.saved(), [], 'sent, so nothing left to send');
});

test('a stall (a sleeping laptop) counts at most ten seconds, not the whole gap', () => {
  const s = trackerSetup();
  s.tracker.start({ slug: 'snake' });
  s.advance(3_600_000);
  assert.equal(s.tracker.stop(), 10);
});

test('plays that could not be sent wait on the device for the next try', async () => {
  const s = trackerSetup();
  s.offline(true);
  s.tracker.start({ slug: 'a' });
  s.advance(4_000);
  s.tracker.stop();
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(s.saved().map((p) => [p.slug, p.open]), [['a', false]]);
  s.offline(false);
  await s.tracker.flush();
  assert.deepEqual(s.saved(), []);
});

test('starting another game ends the one before it', () => {
  const s = trackerSetup();
  s.tracker.start({ slug: 'a' });
  s.advance(5_000);
  s.tracker.start({ slug: 'b' });
  assert.equal(s.tracker.open.slug, 'b');
  assert.ok(s.sent.some((p) => p.slug === 'a' && p.open === false));
});

test('sign-in only ever returns to a page on this site, never to /auth/ itself', () => {
  const origin = 'https://crosato-arcade.vercel.app';
  assert.equal(safeReturn('https://crosato-arcade.vercel.app/couch#/g/snake?q=a', origin), '/couch#/g/snake?q=a');
  assert.equal(safeReturn('/catalogue?x=1', origin), '/catalogue?x=1');
  assert.equal(safeReturn('https://evil.example/', origin), '/');
  assert.equal(safeReturn('//evil.example/x', origin), '/');
  assert.equal(safeReturn('/auth/?code=1', origin), '/');
  assert.equal(safeReturn('javascript:alert(1)', origin), '/');
});

test('play time reads plainly', () => {
  assert.equal(duration(20), 'under a minute');
  assert.equal(duration(125), '2 min');
  assert.equal(duration(3_600), '1 h');
  assert.equal(duration(11_100), '3 h 5 min');
});

test("the store shows a signed-in player's plays from every device, without saving them", () => {
  store.forget('history');
  store.recordPlay('here');
  store.setCloudPlays({ here: { plays: 5, lastPlayed: 1, seconds: 600 }, elsewhere: { plays: 2, lastPlayed: 2, seconds: 60 } });
  assert.equal(store.plays('here'), 5);
  assert.ok(store.lastPlayed('here') > 1, 'the more recent of the two');
  assert.equal(store.plays('elsewhere'), 2);
  assert.equal(store.playedCount(), 2);
  assert.equal(store.playSeconds('here'), 600);
  assert.equal(store.totalPlaySeconds(), 660);
  store.setCloudPlays({});
  assert.equal(store.plays('here'), 1);
  assert.equal(store.playedCount(), 1);
  store.forget('history');
});

test('the vendored supabase-js is the pinned release, byte for byte, with its license', async () => {
  const bundle = await readFile(new URL(`..${LIBRARY}`, import.meta.url));
  // sha256 of dist/umd/supabase.js in @supabase/supabase-js@2.117.3 from the npm registry.
  assert.equal(createHash('sha256').update(bundle).digest('hex'), 'd6a5c4414a5d4ce646d9c1de223aa7067d3ff664c15394ffeb7fcffc763354a3');
  assert.match(await readFile(new URL(`..${LIBRARY.replace('supabase.js', 'LICENSE')}`, import.meta.url), 'utf8'), /MIT License/);
  assert.match(SUPABASE_KEY, /^sb_publishable_/, 'only the publishable key belongs in the page');
});
