// The switch between the Wall, the Couch and the Catalogue carries the open
// game and the search across. What travels is pinned here.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { carriedHash, plainWords } from '../assets/js/ui/views.js';

test('field filters stay behind; plain words travel', () => {
  assert.equal(plainWords('genre:shooter -tag:3d orbit'), 'orbit');
  assert.equal(plainWords('source:"metal slug" hopper size:<1mb'), 'hopper');
  assert.equal(plainWords('"little orbit"'), 'little orbit');
  assert.equal(plainWords('-racing kart'), 'kart');
  assert.equal(plainWords(''), '');
  assert.equal(plainWords(null), '');
});

test('the open game and the search are carried; the rest of the state is not', () => {
  assert.equal(carriedHash('#/'), '');
  assert.equal(carriedHash('#/?shelf=tools&genre=Racing'), '');
  assert.equal(carriedHash('#/g/undertow?sort=newest'), '#/g/undertow');
  assert.equal(carriedHash('#/play/undertow/v0-4'), '#/g/undertow');
  assert.equal(carriedHash('#/?q=orbit'), '#/?q=orbit');
  assert.equal(carriedHash('#/g/undertow?q=genre%3Arpg+deep'), '#/g/undertow?q=deep');
  assert.equal(carriedHash('#/?q=genre%3Arpg'), '');
});
