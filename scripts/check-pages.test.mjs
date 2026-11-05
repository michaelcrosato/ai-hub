import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { inlineScripts, parseError } from './check-pages.mjs';

const page = (...scripts) => `<!doctype html><html><head><title>t</title></head><body>${scripts.join('\n')}</body></html>`;

test('a page splits into its inline JavaScript the way a browser splits it', () => {
  const scripts = inlineScripts(
    page(
      '<script type="importmap">{"imports":{}}</script>',
      '<script src="engine.js"></script>',
      '<script type="application/json">{"a":1}</script>',
      '<script>let a = 1;</script>',
      '<script type="module">import x from "y"; export const z = x;</script>',
      '<script type="x-shader/x-fragment">void main() {}</script>',
    ),
  );
  assert.deepEqual(scripts.map(({ n, module }) => [n, module]), [[4, false], [5, true]]);
  assert.equal(parseError(scripts[0]), null);
});

test('"</script>" inside an inlined library ends the script there, and the rest cannot parse', () => {
  const library = '/*!\n## Host it\n<script src="engine.js"></script>\n*/\nwindow.Engine = {};';
  const [first] = inlineScripts(page(`<script>${library}</script>`));
  assert.match(parseError(first), /Invalid or unexpected token|Unterminated comment/);
  const [escaped] = inlineScripts(page(`<script>${library.replace('</script>', '<\\/script>')}</script>`));
  assert.equal(parseError(escaped), null, 'written as <\\/script> it means the same and parses');
});

test('an apostrophe in single-quoted text is found', () => {
  const [script] = inlineScripts(page("<script>say('It's burning its own fuel!');</script>"));
  assert.match(parseError(script), /missing \) after argument list/);
});

test('the command checks modules too, and fails when a page cannot parse', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'check-pages-'));
  try {
    const good = path.join(dir, 'good.html');
    const bad = path.join(dir, 'bad.html');
    writeFileSync(good, page('<script type="module">import * as THREE from "three"; console.log(THREE);</script>'));
    writeFileSync(bad, page('<script type="module">const f = () => {\n  return 1;\n\nexport const g = 2;</script>'));
    const run = (file) => spawnSync(process.execPath, [new URL('./check-pages.mjs', import.meta.url).pathname, file], { encoding: 'utf8' });
    assert.equal(run(good).status, 0, run(good).stdout);
    const failed = run(bad);
    assert.equal(failed.status, 1);
    assert.match(failed.stdout, /script 1 \(module, from line 1\)/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
