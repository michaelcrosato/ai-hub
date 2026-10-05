// The wall's search and facet logic is plain ES modules with no DOM, so it is
// tested here directly, against a library shaped like the real one at scale.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readFileSync } from 'node:fs';

import { normalize, deriveFacets, matchesFacet, lineageOf, playersOf } from '../assets/js/manifest.js';
import { selectGames, facetCounts, shelfOf, sourceCounts, stackGames } from '../assets/js/filter.js';

const stats = { isFave: () => false, plays: () => 0, lastPlayed: () => 0 };
const state = (patch = {}) => ({ query: '', sort: 'name', favesOnly: false, facets: {}, ...patch });

const library = Array.from({ length: 400 }, (_, i) =>
  normalize({
    slug: `game-${i}`,
    name: i === 7 ? 'Pokémon Drift' : `Game ${i}`,
    bytes: [90, 600, 3 * 1024][i % 3] * 1024,
    collection: `Folder ${i % 12}`,
    buildId: `unique-${i}`,
    tags: i % 2 ? ['puzzle'] : ['action', 'retro'],
    added: new Date(2026, 0, 1 + (i % 28)).toISOString(),
  })
);

test('fields where nearly every value is different never become rails', () => {
  const keys = deriveFacets(library).map((f) => f.key);
  assert.ok(keys.includes('fileSize'));
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
  const s = state({ facets: { fileSize: ['250 KB–1 MB'] }, query: 'game' });
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

test('players read as alone or together, and together as every head count a game seats', () => {
  assert.deepEqual(playersOf({ players: '1–4' }), ['Single player', 'Multiplayer', '2 players', '3 players', '4 players']);
  assert.deepEqual(playersOf({ players: '2' }), ['Multiplayer', '2 players']);
  assert.deepEqual(playersOf({ players: '1' }), ['Single player']);
  // Saying nothing is a one-player game; a tool saying nothing is not a game at all.
  assert.deepEqual(playersOf({}), ['Single player']);
  assert.deepEqual(playersOf({ type: 'Tool' }), []);

  const lib = ['1–2', '1–8', '2', undefined, undefined].map((players, i) =>
    normalize({ slug: `p${i}`, name: `P${i}`, players })
  );
  const rail = deriveFacets(lib).find((f) => f.key === 'players');
  assert.equal(rail.label, 'Players');
  assert.deepEqual(
    rail.options.filter((o) => !o.under).map((o) => o.value),
    ['Single player', 'Multiplayer']
  );
  const seats = rail.options.filter((o) => o.under === 'Multiplayer');
  assert.deepEqual(seats.map((o) => o.value), ['2 players', '3 players', '4 players', '5 players', '6 players', '7 players', '8 players']);
  const seated = (value) => selectGames(lib, state({ facets: { players: [value] } }), stats).map((g) => g.slug);
  assert.deepEqual(seated('Single player'), ['p0', 'p1', 'p3', 'p4']);
  assert.deepEqual(seated('Multiplayer'), ['p0', 'p1', 'p2']);
  assert.deepEqual(seated('3 players'), ['p1']);
  // The drawer still reads the catalogue's own words.
  assert.equal(lib[0].players, '1–2');
});

test('file size is a rail in size order, and the harness never is', () => {
  const lib = [5, 300, 2000, 9000, 6, 7].map((kb, i) =>
    normalize({ slug: `f${i}`, name: `F${i}`, bytes: kb * 1024, harness: i % 2 ? 'Codex' : 'Claude Code' })
  );
  const facets = deriveFacets(lib);
  assert.deepEqual(facets.map((f) => f.key), ['fileSize']);
  assert.equal(facets[0].label, 'File size');
  assert.deepEqual(facets[0].options.map((o) => o.value), ['Under 250 KB', '250 KB–1 MB', '1–4 MB', 'Over 4 MB']);
  assert.deepEqual(selectGames(lib, state({ query: 'codex' }), stats).length, 3);
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
  assert.deepEqual(lib.map(shelfOf), ['games', 'games', 'tools', 'tools', 'tools', 'games']);
  const slugs = (patch) => selectGames(lib, state(patch), stats).map((g) => g.slug);
  assert.deepEqual(slugs({ shelf: 'games' }), ['a', 'b']);
  assert.deepEqual(slugs({ shelf: 'games', showAll: true }), ['a', 'b', 'f']);
  assert.deepEqual(slugs({ shelf: 'tools' }), ['c', 'd', 'e']);
  assert.deepEqual(slugs({ shelf: null }), ['a', 'b', 'c', 'd', 'e']);
  const genreless = facetCounts(lib, state({ shelf: 'tools' }), stats, []);
  assert.equal(genreless.size, 0);
});

// Shaped like the real wall: a series with several games, a game with several
// attempts, originals that share a name, and ones that stand alone.
const lineup = [
  { slug: 'dq-a', name: 'Bramblebound', source: 'Dragon Quest' },
  { slug: 'dq-b', name: 'Lantern Road', source: 'Dragon Quest' },
  { slug: 'dq3', name: 'Moonward III', source: 'Dragon Quest III', series: 'Dragon Quest' },
  { slug: 'dq9-a', name: 'Starfall Pilgrims', source: 'Dragon Quest IX', series: 'Dragon Quest' },
  { slug: 'dq9-b', name: 'Starward Errand', source: 'Dragon Quest IX', series: 'Dragon Quest' },
  { slug: 'cr-a', name: 'Aetherfall', source: 'Crystalis' },
  { slug: 'cr-b', name: 'Windwake', source: 'crystalis' },
  { slug: 'okami', name: 'Bark & Brush', source: 'Okami' },
  { slug: 'strata-1', name: 'Strata' },
  { slug: 'strata-2', name: 'STRATA' },
  { slug: 'undertow', name: 'Undertow' },
].map(normalize);

const wall = (patch = {}) => selectGames(lineup, state({ origin: '', series: '', source: '', ...patch }), stats);
const tiles = (patch = {}) =>
  stackGames(wall(patch), state({ origin: '', series: '', source: '', ...patch })).map((item) =>
    item.stack ? `[${item.level} ${item.label} ${item.games.length}]` : item.slug
  );

test('a game is an attempt at its source, inside its series; an original is an attempt at itself', () => {
  assert.deepEqual(lineageOf({ name: 'Moonward III', source: 'Dragon Quest III', series: 'Dragon Quest' }), {
    original: false,
    series: 'Dragon Quest',
    title: 'Dragon Quest III',
  });
  assert.deepEqual(lineageOf({ name: 'Aetherfall', source: 'Crystalis' }), {
    original: false,
    series: 'Crystalis',
    title: 'Crystalis',
  });
  assert.deepEqual(lineageOf({ name: 'Strata' }), { original: true, series: 'Original', title: 'Strata' });
});

test('source and series are searchable but never a loose rail of their own', () => {
  const keys = deriveFacets(lineup).map((f) => f.key);
  assert.ok(!keys.includes('source') && !keys.includes('series') && !keys.includes('lineage'));
  assert.deepEqual(wall({ query: 'dragon quest ix' }).map((g) => g.slug), ['dq9-a', 'dq9-b']);
});

test('the wall stacks by series, then by game, then lays out every attempt', () => {
  assert.deepEqual(tiles(), [
    'okami',
    '[title Crystalis 2]',
    '[series Dragon Quest 5]',
    '[title Strata 2]',
    'undertow',
  ]);
  // A to Z files a stack under its own name and a cabinet under the one on its marquee.
  assert.deepEqual(tiles({ series: 'Dragon Quest' }), [
    '[title Dragon Quest 2]',
    '[title Dragon Quest IX 2]',
    'dq3',
  ]);
  assert.deepEqual(tiles({ series: 'dragon quest', source: 'Dragon Quest IX' }), ['dq9-a', 'dq9-b']);
  // One series holding one game: no point showing a single stack of it.
  assert.deepEqual(tiles({ series: 'Crystalis' }), ['cr-a', 'cr-b']);
  // Every game is original or inspired, and each side stacks the way the whole wall does.
  assert.deepEqual(tiles({ origin: 'original' }), ['[title Strata 2]', 'undertow']);
  assert.deepEqual(tiles({ origin: 'inspired' }), ['okami', '[title Crystalis 2]', '[series Dragon Quest 5]']);
  assert.deepEqual(tiles({ origin: 'original', query: 'dragon' }), []);
  const stack = stackGames(wall(), state({})).find((item) => item.stack && item.label === 'Strata');
  assert.equal(stack.original, true);
});

test('stacks keep the sort, and a search can leave a stack of one, which is just the game', () => {
  const newest = (patch) =>
    stackGames(wall(patch), state({ origin: '', series: '', source: '', sort: 'newest', ...patch })).map((item) =>
      item.stack ? item.label : item.slug
    );
  // Same added date everywhere, so newest falls back to names: the stack sits where its first game does.
  assert.deepEqual(newest({}), ['Crystalis', 'okami', 'Dragon Quest', 'Strata', 'undertow']);
  assert.deepEqual(tiles({ query: 'starward' }), ['dq9-b']);
});

test('the Source rail is Original or Inspired, greying out whichever the filters empty', () => {
  const rail = (patch) => sourceCounts(lineup, state({ origin: '', series: '', source: '', ...patch }), stats);
  const shape = (options) => options.map((o) => `${o.label} ${o.count}/${o.total}`);
  assert.deepEqual(shape(rail({}).origins), ['Original 3/3', 'Inspired 8/8']);
  // Counted against everything but the rail's own choice, so the other side still says what it holds.
  assert.deepEqual(shape(rail({ origin: 'inspired', query: 'starfall' }).origins), ['Original 0/3', 'Inspired 1/8']);
  assert.deepEqual(shape(sourceCounts(lineup.slice(0, 3), state({}), stats).origins), ['Inspired 3/3']);
});

test('the catalogue gives every source one series', () => {
  const overrides = JSON.parse(readFileSync(new URL('../data/overrides.json', import.meta.url), 'utf8'));
  const seen = new Map();
  for (const [slug, entry] of Object.entries(overrides)) {
    if (slug === '_readme') continue;
    assert.equal(entry.inspiredBy, undefined, `${slug}: inspiredBy is now source`);
    if (!entry.source) continue;
    const series = entry.series || entry.source;
    if (!seen.has(entry.source)) seen.set(entry.source, { series, slug });
    const first = seen.get(entry.source);
    assert.equal(series, first.series, `${slug} puts ${entry.source} in ${series}, ${first.slug} in ${first.series}`);
  }
});
