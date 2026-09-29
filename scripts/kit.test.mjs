import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  sanitize,
  DEFAULTS,
  autoTier,
  resolveTier,
  pixelRatioFor,
  chooseBackend,
  urlOverrides,
  webgpuFailedRecently,
  FAILURE_MEMORY_MS,
  TIERS,
} from '../lib/kit/settings.js';
import { normalizeAction, deadzone, clampUnit, Latch } from '../lib/kit/input.js';
import { DynamicResolution, FpsCounter, skipForCap } from '../lib/kit/loop.js';
import { fixedStep } from '../lib/kit/physics.js';

test('sanitize keeps valid values and drops junk', () => {
  assert.deepEqual(sanitize(null), DEFAULTS);
  const s = sanitize({ quality: 'ultra', backend: 'webgl2', resolution: 0.2, fpsCap: 45, touchScale: 9, advanced: 'yes', invertY: true });
  assert.equal(s.quality, 'ultra');
  assert.equal(s.backend, 'webgl2');
  assert.equal(s.resolution, 0.5, 'resolution is clamped to 0.5..1');
  assert.equal(s.fpsCap, 0, 'only 0/30/60 caps');
  assert.equal(s.touchScale, 1.3);
  assert.equal(s.advanced, false, 'booleans must be booleans');
  assert.equal(s.invertY, true);
  assert.equal(sanitize({ quality: 'insane' }).quality, 'auto');
  assert.equal(sanitize({ resolution: 'auto' }).resolution, 'auto');
});

test('auto tier: phones medium, desktops high, weak machines lower', () => {
  assert.equal(autoTier({ coarsePointer: true, screenMin: 412, memory: 8 }), 'medium');
  assert.equal(autoTier({ coarsePointer: true, screenMin: 412, memory: 2 }), 'low');
  assert.equal(autoTier({ coarsePointer: false, screenMin: 1080, memory: 8, cores: 12 }), 'high');
  assert.equal(autoTier({ coarsePointer: false, screenMin: 1080, memory: 2, cores: 2 }), 'medium');
  assert.equal(resolveTier('ultra').name, 'ultra');
  assert.equal(resolveTier('auto', { coarsePointer: true, screenMin: 400 }).name, 'medium');
});

test('pixel ratio respects the screen, the tier cap and the scale', () => {
  assert.equal(pixelRatioFor(TIERS.medium, 3, 1), 1.5);
  assert.equal(pixelRatioFor(TIERS.high, 1, 1), 1);
  assert.equal(pixelRatioFor(TIERS.high, 3, 0.75), 1.5);
  assert.equal(pixelRatioFor(TIERS.low, 1, 0.1), 0.5, 'never below half');
});

test('backend choice falls back to WebGL2 and remembers failures for a while', () => {
  assert.equal(chooseBackend('auto', { hasWebGPU: true }), 'webgpu');
  assert.equal(chooseBackend('auto', { hasWebGPU: false }), 'webgl2');
  assert.equal(chooseBackend('auto', { hasWebGPU: true, webgpuFailed: true }), 'webgl2');
  assert.equal(chooseBackend('webgpu', { hasWebGPU: true, webgpuFailed: true }), 'webgpu', 'an explicit choice wins');
  assert.equal(chooseBackend('webgpu', { hasWebGPU: false }), 'webgl2');
  const now = 1_000_000_000_000;
  assert.equal(webgpuFailedRecently({ webgpuFailed: now - 1000 }, now), true);
  assert.equal(webgpuFailedRecently({ webgpuFailed: now - FAILURE_MEMORY_MS - 1 }, now), false);
  assert.equal(webgpuFailedRecently({}, now), false);
});

test('URL overrides for test runs', () => {
  assert.deepEqual(urlOverrides('?kit-backend=webgl2&kit-quality=low&kit-fps=1'), { backend: 'webgl2', quality: 'low', showFps: true });
  assert.deepEqual(urlOverrides(''), {});
});

test('actions normalise from the short forms', () => {
  const move = normalizeAction('move', { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick' });
  assert.deepEqual(move.keys.up, ['KeyW', 'ArrowUp']);
  assert.deepEqual(move.gamepad, ['leftStick', 'dpad']);
  const jump = normalizeAction('jump', { keys: 'Space', gamepad: 'A' });
  assert.deepEqual(jump.keys, ['Space']);
  assert.deepEqual(jump.gamepad, ['A']);
  const look = normalizeAction('look', { type: 'look' });
  assert.equal(look.mouseLook, 'locked');
  assert.deepEqual(look.gamepad, ['rightStick']);
  const gas = normalizeAction('gas', { type: 'axis', keys: { pos: 'KeyW', neg: ['KeyS'] }, gamepad: { pos: 'RT', neg: 'LT' } });
  assert.deepEqual(gas.keys, { pos: ['KeyW'], neg: ['KeyS'] });
});

test('stick deadzone and unit clamp', () => {
  assert.deepEqual(deadzone(0.1, 0.05), { x: 0, y: 0 });
  const d = deadzone(1, 0);
  assert.equal(d.x, 1);
  const half = deadzone(0.58, 0);
  assert.ok(half.x > 0.45 && half.x < 0.55, 'rescaled past the deadzone');
  const c = clampUnit(1, 1);
  assert.ok(Math.abs(Math.hypot(c.x, c.y) - 1) < 1e-9, 'diagonals are not faster');
});

test('dynamic resolution steps down under load and recovers slowly', () => {
  const dr = new DynamicResolution({ min: 0.6, targetMs: 1000 / 60 });
  let t = 0;
  const run = (ms, seconds) => {
    let changed = 0;
    for (let i = 0; i < (seconds * 1000) / ms; i++) {
      t += ms;
      if (dr.sample(ms, t)) changed += 1;
    }
    return changed;
  };
  run(33, 3.2);
  assert.ok(dr.scale < 1 && dr.scale >= 0.6, `dropped to ${dr.scale}`);
  run(33, 10);
  assert.equal(dr.scale, 0.6, 'bottoms out at min');
  run(16, 6);
  assert.ok(dr.scale > 0.6, 'recovers once frames are comfortable');
  const before = dr.scale;
  dr.sample(5000, t + 5000);
  assert.equal(dr.scale, before, 'a stall is ignored');
});

test('fps counter and frame cap', () => {
  const f = new FpsCounter();
  let t = 0;
  for (let i = 0; i < 40; i++) f.tick((t += 1000 / 60));
  assert.ok(Math.abs(f.fps - 60) <= 1);
  assert.equal(skipForCap(100, 90, 30), true);
  assert.equal(skipForCap(125, 90, 30), false);
  assert.equal(skipForCap(100, 99, 0), false);
});

test('fixed step runs whole steps and returns the remainder', () => {
  const fs = fixedStep(60, 5);
  let steps = 0;
  const alpha = fs.advance(0.05, () => steps++);
  assert.equal(steps, 3);
  assert.ok(alpha > 0 && alpha < 1);
  steps = 0;
  fs.advance(10, () => steps++);
  assert.equal(steps, 5, 'a long stall cannot spiral');
});

test('a tap inside one frame still counts once', () => {
  const l = new Latch();
  l.add('Space');
  l.delete('Space');
  assert.equal(l.has('Space'), true, 'seen by the next update');
  assert.equal(l.size, 0, 'not held');
  l.flush();
  assert.equal(l.has('Space'), false, 'gone after that update');
  l.add('KeyW');
  l.flush();
  assert.equal(l.has('KeyW'), true, 'held keys survive a flush');
  assert.deepEqual([...l], ['KeyW']);
});

test('vector clamp can be turned off for independent axes', () => {
  assert.equal(normalizeAction('move', { type: 'vector' }).clamp, true);
  assert.equal(normalizeAction('steer', { type: 'vector', clamp: false }).clamp, false);
});
