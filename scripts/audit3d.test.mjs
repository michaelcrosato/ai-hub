import { test } from 'node:test';
import assert from 'node:assert/strict';

import { auditText, stripComments } from './audit3d.mjs';

const GOOD = `<script type="importmap">{"imports":{"three":"/lib/three/three.webgpu.js","three/webgpu":"/lib/three/three.webgpu.js","three/tsl":"/lib/three/three.tsl.js","three/addons/":"/lib/three/addons/","kit/":"/lib/kit/"}}</script>
<script type="module">import { boot } from 'kit/boot.js'; const kit = await boot({});</script>`;

test('a game on the kit passes', () => {
  assert.deepEqual(auditText(GOOD).errors, []);
});

test('old renderers, shader patches and CDN copies fail', () => {
  const ids = (t) => auditText(GOOD + t).errors.map((e) => e.id);
  assert.deepEqual(ids('<script>new THREE.WebGLRenderer()</script>'), ['webgl-renderer']);
  assert.deepEqual(ids('<script>const m = new ShaderMaterial({})</script>'), ['shader-material']);
  assert.deepEqual(ids('<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js"></script>'), ['cdn-three']);
  assert.deepEqual(ids('<script>sun.shadow.map?.dispose(); sun.shadow.map = null;</script>'), ['shadow-map-dispose']);
});

test('missing kit pieces fail', () => {
  const ids = auditText('<script>console.log(1)</script>').errors.map((e) => e.id);
  assert.deepEqual(ids, ['import-map', 'kit-map', 'kit-boot']);
});

test('comments that mention old APIs do not count', () => {
  assert.deepEqual(auditText(GOOD + '<script>// replaces the old EffectComposer\n/* onBeforeCompile shader, now TSL */</script>').errors, []);
  assert.match(stripComments('x = "https://example.com"; // note'), /https:\/\/example\.com/);
  assert.match(stripComments('<input accept="audio/*"> new WebGLRenderer() /* end */'), /WebGLRenderer/, 'a MIME glob is not a comment');
});

test('a requestAnimationFrame loop warns only when the kit loop is missing', () => {
  const warns = (t) => auditText(GOOD + t).warnings.map((w) => w.id);
  assert.deepEqual(warns('<script>requestAnimationFrame(tick)</script>'), ['raf-loop']);
  assert.deepEqual(warns('<script>kit.start(step); requestAnimationFrame(tick)</script>'), []);
});
