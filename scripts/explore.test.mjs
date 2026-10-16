import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize } from '../assets/js/manifest.js';
import { selection } from '../assets/js/explore/common.js';
import { VIEWS } from '../assets/js/ui/views.js';
import { readFile } from 'node:fs/promises';

const games = [
  { slug: 'kart', name: 'Moon Kart', genre: 'Racing' },
  { slug: 'orbit', name: 'Orbit', type: 'Tech demo' },
  { slug: 'review', name: 'Moon Mystery', unsure: true },
  { slug: 'hidden', name: 'Moon Secret', restricted: true },
].map(normalize);
const stats = { isFave: (slug) => slug === 'kart' };
const pick = (query, showAll) =>
  selection(games, new URLSearchParams(query), stats, showAll).map((game) => game.slug);

test('new views share wall shelf, text search, favourites and visibility rules', () => {
  assert.deepEqual(pick(''), ['kart']);
  assert.deepEqual(pick('shelf=all'), ['kart', 'review', 'orbit']);
  assert.deepEqual(pick('shelf=tools'), ['orbit']);
  assert.deepEqual(pick('shelf=unsure'), ['review']);
  assert.deepEqual(pick('shelf=all&q=moon'), ['kart', 'review']);
  assert.deepEqual(pick('shelf=all&fav=1'), ['kart']);
  assert.deepEqual(pick('shelf=all&q=secret'), []);
  assert.deepEqual(pick('shelf=all&q=secret', true), ['hidden']);
  assert.deepEqual(pick('shelf=invalid'), ['kart']);
});

test('all six switch destinations exist, with each new renderer wired to its page', async () => {
  assert.equal(VIEWS.length, 6);
  assert.equal(new Set(VIEWS.map((view) => view.href)).size, 6);
  for (const view of VIEWS) {
    const page = await readFile(
      new URL(`..${view.href === '/' ? '' : view.href}/index.html`, import.meta.url),
      'utf8',
    );
    if (['atlas', 'timeline', 'deck'].includes(view.key)) {
      assert.ok(page.includes(`data-view="${view.key}"`));
      assert.ok(page.includes('/assets/js/explore/app.js'));
      assert.ok(page.includes(`/assets/css/${view.key}.css`));
    }
  }
});
