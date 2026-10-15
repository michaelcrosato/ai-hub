import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../games/grok-roundup-astral-crest/index.html', import.meta.url), 'utf8');
const assets = JSON.parse(/window\.__ASSETS=(\{.*?\});<\/script>/s.exec(html)[1]);
const scripts = JSON.parse(/gd=(\[[^\]]+\]);function PS/.exec(html)[1]);
const effect = /function PS\(\).*?useEffect\)\(\(\)=>\{(.*?)\},\[\]\)/s.exec(html)[1];
async function boot(failAt) {
  const loaded = [], errors = []; let boots = 0;
  const window = { __assetURL: src => { assert.ok(assets[src], `missing embedded script: ${src}`); return src; }, __bootCrest: () => { boots++; assert.deepEqual(loaded, scripts); } };
  const document = { createElement: () => ({}), head: { appendChild: script => {
    queueMicrotask(() => { if (script.src === failAt) script.onerror(new Error('load failed')); else { loaded.push(script.src); script.onload(); } });
  } } };
  vm.runInNewContext(effect, { window, document, gd: scripts, console: { error: e => errors.push(e.message) } });
  await new Promise(resolve => setImmediate(resolve));
  return { loaded, errors, boots, requested: window.__crestWantBoot };
}
test('Astral Crest standalone boot loads all seven embedded dependencies in order before starting', async () => {
  assert.equal(scripts.length, 7);
  assert.deepEqual(await boot(), { loaded: scripts, errors: [], boots: 1, requested: true });
});
test('Astral Crest does not start with a missing dependency', async () => {
  const r = await boot(scripts[2]);
  assert.equal(r.boots, 0); assert.deepEqual(r.loaded, scripts.slice(0, 2)); assert.deepEqual(r.errors, ['load failed']);
});
