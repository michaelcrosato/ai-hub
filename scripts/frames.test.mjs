// Frame rotation is a pure function, and every published game gets its strip
// from the same scan that builds the wall. Both are imported from the modules
// the site actually runs — nothing here re-implements them.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { frameAt, frameCycleLength } from '../assets/js/frames.js';
import { normalize } from '../assets/js/manifest.js';
import { scan, encodeLabel, STRIP_ENCODE } from './scan.mjs';

test('the title frame leads a cycle and shows at least as often as either other frame', () => {
  const frames = ['/covers/example/0.jpg', '/covers/example/1.jpg', '/covers/example/2.jpg'];
  const ticks = frameCycleLength(frames.length);
  const chosen = Array.from({ length: ticks }, (_, tick) => frameAt(frames, tick));

  assert.equal(chosen[0], frames[0]);
  assert.equal(new Set(chosen).size, frames.length);
  for (const url of chosen) assert.ok(frames.includes(url));

  const titleCount = chosen.filter((url) => url === frames[0]).length;
  assert.ok(titleCount * 2 >= ticks);
  for (const url of frames.slice(1)) {
    const count = chosen.filter((item) => item === url).length;
    assert.ok(titleCount >= count, `${url} appeared more often than the title`);
  }
  assert.equal(frameAt(frames, ticks), frames[0]);
});

test('scan validates available strips while admitting games without optional screenshots', async t => {
  const manifest = await scan({ quiet: true });
  const games = manifest.games.map(normalize);
  assert.ok(games.length > 3, 'the catalogue should be the whole wall, not the pilot');

  const strips = games.filter((game) => Array.isArray(game.frames) && game.frames.length > 1);
  t.diagnostic(`Screenshot coverage: ${strips.length}/${games.length}; ${games.length - strips.length} missing optional strips`);
  assert.ok(strips.length > 0, 'existing strips must still be discovered');
  for (const game of games.filter(game => !strips.includes(game))) {
    assert.ok(!game.frames || game.frames.length <= 1, game.slug);
    assert.equal(frameAt(game.frames || [], 0), game.frames?.[0] || null);
  }
  assert.equal(encodeLabel(STRIP_ENCODE), '640×480 JPEG quality 58');

  for (const game of strips) {
    assert.equal(game.frames.length, 3, game.slug);
    assert.equal(game.cover, game.frames[0], game.slug);
    assert.equal(game.frameLabel, encodeLabel(STRIP_ENCODE), game.slug);
    assert.deepEqual(game.frames, [...new Set(game.frames)], game.slug);
    assert.deepEqual(
      game.frames,
      [0, 1, 2].map((index) => `/covers/${encodeURIComponent(game.slug)}/${index}.jpg`),
      game.slug
    );

    const ticks = frameCycleLength(game.frames.length);
    const chosen = Array.from({ length: ticks }, (_, tick) => frameAt(game.frames, tick));
    assert.equal(chosen[0], game.frames[0], game.slug);
    for (const url of chosen) assert.ok(game.frames.includes(url), game.slug);
    const titleCount = chosen.filter((url) => url === game.frames[0]).length;
    for (const url of game.frames.slice(1)) {
      assert.ok(titleCount >= chosen.filter((item) => item === url).length, game.slug);
    }
  }
});
