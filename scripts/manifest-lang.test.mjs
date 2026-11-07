import test from 'node:test';
import assert from 'node:assert/strict';
import { normalize, shown, termName, setWords } from '../assets/js/manifest.js';

const game = normalize({
  slug: 'orb', name: 'Orb', description: 'A ball game.', controls: 'Arrows', genre: 'Shooter', type: 'Tool', tags: ['boss fights'],
});

test('shown and termName give the translation, else the English', () => {
  setWords({
    games: { orb: { description: 'Un jeu de balle.', controls: '', sessionGoal: 7 } },
    terms: { genre: { Shooter: 'Tir' }, tag: { 'boss fights': 'combats de boss' } },
  });
  assert.equal(shown(game, 'description'), 'Un jeu de balle.');
  assert.equal(shown(game, 'controls'), 'Arrows');   // empty: English
  assert.equal(shown(game, 'sessionGoal'), undefined); // not a string, no English either
  assert.equal(shown({ slug: 'other', description: 'x' }, 'description'), 'x');
  assert.equal(termName('genre', 'Shooter'), 'Tir');
  assert.equal(termName('tag', 'boss fights'), 'combats de boss');
  assert.equal(termName('type', 'Tool'), 'Tool');    // no entry
  assert.equal(game.description, 'A ball game.');    // the data stays English
});

test('malformed words mean English', () => {
  for (const bad of [null, 'x', [], 5, { games: 'x', terms: [] }, { games: { orb: 'x' }, terms: { genre: 'x' } }]) {
    setWords(bad);
    assert.equal(shown(game, 'description'), 'A ball game.');
    assert.equal(termName('genre', 'Shooter'), 'Shooter');
  }
});

test('the search covers the translated texts and terms, and the originals', () => {
  setWords({ games: { orb: { description: 'Un jeu de balle.' } }, terms: { genre: { Shooter: 'Tir' } } });
  const found = normalize({ slug: 'orb', name: 'Orb', description: 'A ball game.', genre: 'Shooter' });
  assert.match(found.search, /jeu de balle/);
  assert.match(found.search, /\btir\b/);
  assert.match(found.search, /a ball game/);
  setWords({});
});
