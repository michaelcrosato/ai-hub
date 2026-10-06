import test from 'node:test';
import assert from 'node:assert/strict';

import { grade, gradeView, hasBars } from './lib/fill.mjs';

const view = (surface, paint) => ({ vw: 1600, vh: 900, surface, paint });

test('a canvas covering the window fills it', () => {
  assert.equal(gradeView(view({ x: 1, y: 1 }, { x: 1, y: 1 })), 'fills');
});

test('a layout reaching every edge without one big surface is panels', () => {
  assert.equal(gradeView(view({ x: 0.82, y: 0.92 }, { x: 1, y: 1 })), 'panels');
  assert.equal(gradeView(view(null, { x: 1, y: 0.99 })), 'panels');
});

test('a centred frame is boxed', () => {
  assert.equal(gradeView(view({ x: 0.8, y: 0.8 }, { x: 0.8, y: 0.91 })), 'boxed');
});

test('a fixed aspect ratio that fits only one axis is boxed', () => {
  assert.equal(gradeView(view({ x: 1, y: 0.36 }, { x: 1, y: 0.36 })), 'boxed');
});

test('a failed load is an error', () => {
  assert.equal(gradeView({ error: 'timeout' }), 'error');
});

test('the game takes its worst window', () => {
  const full = view({ x: 1, y: 1 }, { x: 1, y: 1 });
  assert.equal(grade({ wide: full, tall: full }), 'fills');
  assert.equal(grade({ wide: full, tall: view({ x: 1, y: 0.36 }, { x: 1, y: 0.36 }) }), 'boxed');
  assert.equal(grade({ wide: full, tall: view(null, { x: 1, y: 1 }) }), 'panels');
});

test('bars are two flat matching strips around a busy middle', () => {
  const black = { mean: [0, 0, 0], sd: 0.5 };
  const busy = { mean: [90, 120, 80], sd: 40 };
  assert.equal(hasBars({ a: black, b: black, mid: busy }), true);
  assert.equal(hasBars({ a: black, b: { mean: [200, 0, 0], sd: 0 }, mid: busy }), false);
  assert.equal(hasBars({ a: busy, b: black, mid: busy }), false);
  assert.equal(hasBars({ a: black, b: black, mid: black }), false);
});
