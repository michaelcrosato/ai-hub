// "Other attempts" and "more like this" are shared by the Couch and the
// Catalogue, and are plain functions of the catalogue, so they are pinned here.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { normalize } from '../assets/js/manifest.js';
import { attemptsAt, likeness, similarGames } from '../assets/js/similar.js';

const game = (slug, patch = {}) => normalize({ slug, name: slug, added: '2026-09-01', tags: [], ...patch });

const slugs = (list) => list.map((g) => g.slug);

test('attempts are the same title in the same series, newest first, never the game itself', () => {
  const a = game('slug-1', { name: 'Brass Hopper', source: 'Metal Slug', added: '2026-09-01' });
  const b = game('slug-2', { name: 'Metal Snail', source: 'Metal Slug', added: '2026-09-07' });
  const c = game('slug-3', { name: 'Shellshift', source: 'Contra', added: '2026-09-09' });
  assert.deepEqual(slugs(attemptsAt(a, [a, b, c])), ['slug-2']);
});

test('originals sharing a name are attempts at each other; a lone original has none', () => {
  const a = game('strata-1', { name: 'Strata', added: '2026-09-01' });
  const b = game('strata-2', { name: 'Strata', added: '2026-09-03' });
  const c = game('lone', { name: 'Lone' });
  assert.deepEqual(slugs(attemptsAt(a, [a, b, c])), ['strata-2']);
  assert.deepEqual(attemptsAt(c, [a, b, c]), []);
});

test('an attempt is never "like" its own game', () => {
  const a = game('a', { source: 'Metal Slug', genre: 'Shooter', tags: ['2d'] });
  const b = game('b', { source: 'Metal Slug', genre: 'Shooter', tags: ['2d'] });
  assert.equal(likeness(a, b), 0);
});

test('series, genre and shared tags make games alike; nothing in common does not', () => {
  const base = game('base', { source: 'Star Fox', series: 'Star Fox', genre: 'Flight', tags: ['3d', 'on-rails', 'boss fights'] });
  const sibling = game('sib', { source: 'Star Fox 64', series: 'Star Fox', genre: 'Flight', tags: ['3d'] });
  const genreOnly = game('genre', { genre: 'Flight', tags: ['sim'] });
  const tagsOnly = game('tags', { genre: 'Racing', tags: ['3d', 'on-rails', 'boss fights'] });
  const stranger = game('stranger', { genre: 'Puzzle', tags: ['cards'], type: 'Tool' });
  const all = [base, sibling, genreOnly, tagsOnly, stranger];
  assert.ok(likeness(base, sibling) > likeness(base, genreOnly));
  assert.ok(likeness(base, tagsOnly) > likeness(base, genreOnly));
  assert.deepEqual(slugs(similarGames(base, all)), ['sib', 'tags', 'genre']);
});

test('tags match regardless of case and accents, and the limit holds', () => {
  const base = game('base', { tags: ['Pokémon', 'Pixel Art'] });
  const others = Array.from({ length: 20 }, (_, i) => game(`o${i}`, { tags: ['pokemon', 'pixel art'] }));
  const found = similarGames(base, [base, ...others], { limit: 5 });
  assert.equal(found.length, 5);
  assert.ok(likeness(base, others[0]) >= 4);
});
