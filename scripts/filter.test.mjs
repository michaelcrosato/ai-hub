// The wall's search and facet logic is plain ES modules with no DOM, so it is
// tested here directly, against a library shaped like the real one at scale.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { normalize, deriveFacets, matchesFacet } from '../assets/js/manifest.js';
import { selectGames, facetCounts, shelfOf } from '../assets/js/filter.js';

const stats = { isFave: () => false, plays: () => 0, lastPlayed: () => 0 };
const state = (patch = {}) => ({ query: '', sort: 'name', favesOnly: false, facets: {}, ...patch });

const library = Array.from({ length: 400 }, (_, i) =>
  normalize({
    slug: `game-${i}`,
    name: i === 7 ? 'Pokémon Drift' : `Game ${i}`,
    weight: ['Featherweight', 'Lightweight', 'Middleweight'][i % 3],
    collection: `Folder ${i % 12}`,
    buildId: `unique-${i}`,
    tags: i % 2 ? ['puzzle'] : ['action', 'retro'],
    added: new Date(2026, 0, 1 + (i % 28)).toISOString(),
  })
);

test('fields where nearly every value is different never become rails', () => {
  const keys = deriveFacets(library).map((f) => f.key);
  assert.ok(keys.includes('weight'));
  assert.ok(keys.includes('collection'));
  assert.ok(keys.includes('tags'));
  assert.ok(!keys.includes('buildId'));
});

test('a handful of distinct values still makes a rail', () => {
  const few = ['Opus', 'Sonnet', 'GPT'].map((model, i) => normalize({ slug: `s${i}`, name: `S${i}`, model }));
  assert.deepEqual(deriveFacets(few).map((f) => f.key), ['model']);
});

test('search reaches custom fields and ignores accents', () => {
  assert.deepEqual(selectGames(library, state({ query: 'pokemon' }), stats).map((g) => g.slug), ['game-7']);
  assert.equal(selectGames(library, state({ query: 'folder 3' }), stats).length > 0, true);
});

test('single-pass facet counts match counting option by option', () => {
  const facets = deriveFacets(library);
  const s = state({ facets: { weight: ['Lightweight'] }, query: 'game' });
  const counts = facetCounts(library, s, stats, facets);
  for (const facet of facets) {
    for (const option of facet.options) {
      const others = { ...s.facets };
      delete others[facet.key];
      const expected = selectGames(library, { ...s, facets: { ...others, [facet.key]: [option.value] } }, stats).length;
      assert.equal(counts.get(facet.key).get(option.value), expected, `${facet.key}=${option.value}`);
    }
  }
  assert.equal(matchesFacet(library[0], 'tags', 'retro'), true);
});

test('shelves split by type, uncatalogued games are games, restricted ones stay off the wall', () => {
  const lib = [
    normalize({ slug: 'a', name: 'A' }),
    normalize({ slug: 'b', name: 'B', type: 'Game' }),
    normalize({ slug: 'c', name: 'C', type: 'Tech demo' }),
    normalize({ slug: 'd', name: 'D', type: 'Tool' }),
    normalize({ slug: 'e', name: 'E', type: 'Website' }),
    normalize({ slug: 'f', name: 'F', type: 'Game', restricted: true }),
  ];
  assert.deepEqual(lib.map(shelfOf), ['games', 'games', 'demos', 'tools', 'tools', 'games']);
  const slugs = (patch) => selectGames(lib, state(patch), stats).map((g) => g.slug);
  assert.deepEqual(slugs({ shelf: 'games' }), ['a', 'b']);
  assert.deepEqual(slugs({ shelf: 'games', showAll: true }), ['a', 'b', 'f']);
  assert.deepEqual(slugs({ shelf: 'tools' }), ['d', 'e']);
  assert.deepEqual(slugs({ shelf: null }), ['a', 'b', 'c', 'd', 'e']);
  const genreless = facetCounts(lib, state({ shelf: 'demos' }), stats, []);
  assert.equal(genreless.size, 0);
});
