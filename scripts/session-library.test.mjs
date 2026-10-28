// The library's session games, as the wall and Random Mode see them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { scan } from './scan.mjs';
import { normalize, sessionOf } from '../assets/js/manifest.js';
import { selectGames } from '../assets/js/filter.js';

const overrides = JSON.parse(readFileSync(new URL('../data/overrides.json', import.meta.url), 'utf8'));
const stats = { isFave: () => false, plays: () => 0, lastPlayed: () => 0 };
const MODE_TAGS = ['versus', 'co-op', 'race'];

const library = (await scan({ quiet: true })).games.map(normalize);
const sessionGames = library.filter((game) => sessionOf(game)?.supported);

test('every session game is catalogued for 1–4 players and tagged with how it plays together', () => {
  assert.ok(sessionGames.length > 0);
  for (const game of sessionGames) {
    const entry = overrides[game.slug];
    assert.ok(entry, `${game.slug} has a data/overrides.json entry`);
    assert.equal(entry.players, '1–4', `${game.slug} seats "1–4"`);
    const tags = (entry.tags || []).filter((tag) => MODE_TAGS.includes(tag));
    assert.ok(tags.includes(game.sessionMode), `${game.slug} is tagged ${game.sessionMode}, its session mode`);
  }
});

test('Multiplayer > 4 players on the wall finds every session game', () => {
  const four = selectGames(library, { query: '', sort: 'name', favesOnly: false, shelf: 'games', facets: { players: ['4 players'] } }, stats);
  const found = new Set(four.map((game) => game.slug));
  assert.deepEqual(sessionGames.filter((game) => !found.has(game.slug)).map((game) => game.slug), []);
});
