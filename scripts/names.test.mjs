// No two entries on the wall show the same name: the scan numbers colliding
// names in the order they were added (scripts/lib/names.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { numberNames, nameKey } from './lib/names.mjs';
import { scan } from './scan.mjs';
import { normalize } from '../assets/js/manifest.js';
import { selectGames, shelfOf, stackGames } from '../assets/js/filter.js';

const stats = { isFave: () => false, plays: () => 0, lastPlayed: () => 0 };
const state = (patch = {}) => ({ query: '', sort: 'name', favesOnly: false, facets: {}, shelf: null, ...patch });
const entry = (slug, name, added, extra = {}) => ({ slug, name, added, ...extra });

test('the oldest entry keeps the plain name and later ones are numbered in the order added', () => {
  const games = numberNames([
    entry('third', 'Ashbound', '2026-10-15T00:00:00Z'),
    entry('first', 'Ashbound', '2026-09-29T00:00:00Z'),
    entry('second', 'ashbound ', '2026-10-04T00:00:00Z'),
    entry('alone', 'Undertow', '2026-09-01T00:00:00Z'),
  ]);
  const name = (slug) => games.find((g) => g.slug === slug);
  assert.equal(name('first').name, 'Ashbound');
  assert.equal(name('first').plainName, undefined);
  assert.equal(name('second').name, 'ashbound (2)');
  assert.equal(name('second').plainName, 'ashbound ');
  assert.equal(name('third').name, 'Ashbound (3)');
  assert.equal(name('alone').name, 'Undertow');
});

test('same-day arrivals fall back to the source date, then the slug', () => {
  const games = numberNames([
    entry('b-run', 'Astral Vixen', '2026-10-22T02:14:24Z', { sourceDate: '2026-10-21T02:14:00Z' }),
    entry('a-run', 'Astral Vixen', '2026-10-22T02:14:24Z', { sourceDate: '2026-10-21T02:14:00Z' }),
    entry('earlier-made', 'Astral Vixen', '2026-10-22T02:14:24Z', { sourceDate: '2026-10-20T23:55:00Z' }),
  ]);
  assert.deepEqual(games.map((g) => [g.slug, g.name]), [
    ['b-run', 'Astral Vixen (3)'],
    ['a-run', 'Astral Vixen (2)'],
    ['earlier-made', 'Astral Vixen'],
  ]);
});

test('accents and case never make two names different, and a number never lands on a taken name', () => {
  const games = numberNames([
    entry('one', 'Pokémon Drift', '2026-01-01T00:00:00Z'),
    entry('two', 'Pokemon drift', '2026-02-01T00:00:00Z'),
    entry('taken', 'Pokemon Drift (2)', '2026-03-01T00:00:00Z'),
  ]);
  const names = games.map((g) => g.name);
  assert.equal(new Set(names.map(nameKey)).size, names.length);
  assert.equal(games[1].name, 'Pokemon drift (3)');
  assert.equal(games[2].name, 'Pokemon Drift (2)');
});

test('a numbered entry is still found by its plain name and still stacks with its namesakes', () => {
  const games = numberNames([
    entry('strata-a', 'Strata', '2026-09-01T00:00:00Z'),
    entry('strata-b', 'Strata', '2026-09-02T00:00:00Z'),
    entry('strata-c', 'Strata', '2026-09-03T00:00:00Z'),
    entry('other', 'Lantern', '2026-09-04T00:00:00Z'),
  ]).map(normalize);
  const found = selectGames(games, state({ query: 'strata' }), stats).map((g) => g.name);
  assert.deepEqual(found.sort(), ['Strata', 'Strata (2)', 'Strata (3)']);
  const stacks = stackGames(selectGames(games, state(), stats), state(), 'source');
  const stack = stacks.find((item) => item.stack);
  assert.equal(stack.label, 'Strata');
  assert.equal(stack.games.length, 3);
});

test('the library: every entry shows its own name, and none waits on the Unsure shelf', async () => {
  const { games } = await scan({ quiet: true });
  const seen = new Map();
  const clashes = [];
  for (const game of games) {
    const key = nameKey(game.name);
    if (seen.has(key)) clashes.push(`${game.name} (${seen.get(key)}, ${game.slug})`);
    else seen.set(key, game.slug);
  }
  assert.deepEqual(clashes, [], 'names shown twice on the wall');
  assert.ok(games.some((g) => g.plainName), 'the library has namesakes, so some names are numbered');
  const unsure = games.map(normalize).filter((g) => shelfOf(g) === 'unsure');
  assert.deepEqual(unsure.map((g) => g.slug), [], 'entries on the Unsure shelf');
  for (const game of games.filter((g) => g.plainName)) {
    assert.ok(game.genre && game.type, `${game.slug} keeps its genre and type`);
  }
});
