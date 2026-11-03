import { test } from 'node:test';
import assert from 'node:assert/strict';

import { moduleSpecifiers, partSizes, resolveMapped, shelfClosure, shelfMappings, shelfPath } from './lib/release.mjs';

/** An in-memory shelf: { path: text }. */
function shelf(files) {
  const paths = Object.keys(files);
  const under = (dir) => paths.filter((p) => p.startsWith(`${dir.replace(/\/$/, '')}/`));
  return {
    isFile: (p) => p in files,
    isDir: (p) => under(p).length > 0,
    list: (dir, { depth } = {}) =>
      depth === 1
        ? [...new Set(under(dir).map((p) => p.slice(0, p.indexOf('/', dir.replace(/\/$/, '').length + 1))))]
        : under(dir),
    read: (p) => files[p],
  };
}

const R = 'lib/vendor/three/0.180.0/';
const THREE = {
  [`${R}build/three.module.js`]: "export * from './three.core.js';",
  [`${R}build/three.core.js`]: '',
  [`${R}build/three.webgpu.js`]: "export * from './three.core.js';",
  [`${R}examples/jsm/controls/OrbitControls.js`]: "import { Vector3 } from 'three';\nimport { a } from '../utils/a.js';",
  [`${R}examples/jsm/utils/a.js`]: '',
  [`${R}examples/jsm/utils/unused.js`]: '',
  [`${R}examples/jsm/libs/draco/draco_decoder.js`]: '',
  [`${R}examples/jsm/libs/draco/draco_decoder.wasm`]: '',
  [`${R}LICENSE`]: '',
};
const MAP = `<script type="importmap">{"imports": {
  "three": "/${R}build/three.module.js",
  "three/addons/": "/${R}examples/jsm/"
}, "scopes": {"/${R}": {"three": "/${R}build/three.module.js"}}}</script>`;

test('a game publishes the shelf files it imports, and what those import, not the whole release', () => {
  const page = `${MAP}<script type="module">import * as THREE from 'three';
    import { OrbitControls } from 'three/addons/controls/OrbitControls.js';</script>`;
  const { files } = shelfClosure([[page]], shelf(THREE), { maxFolderFiles: 3 });
  assert.ok(files.has(`${R}examples/jsm/controls/OrbitControls.js`));
  assert.ok(files.has(`${R}examples/jsm/utils/a.js`), 'relative imports inside the shelf are followed');
  assert.ok(files.has(`${R}build/three.core.js`), 'the build a release ships is kept whole');
  assert.ok(files.has(`${R}LICENSE`));
  assert.ok(!files.has(`${R}examples/jsm/utils/unused.js`));
  assert.ok(!files.has(`${R}examples/jsm/libs/draco/draco_decoder.wasm`));
});

test('an import map that lists the shelf but imports nothing from it publishes no addons', () => {
  const { files } = shelfClosure([[MAP]], shelf(THREE), { maxFolderFiles: 3 });
  assert.ok(!files.has(`${R}examples/jsm/controls/OrbitControls.js`));
});

test('a decoder folder named outright is published whole', () => {
  const page = `loader.setDecoderPath('/${R}examples/jsm/libs/draco/');`;
  const { files } = shelfClosure([[page]], shelf(THREE), { maxFolderFiles: 3 });
  assert.ok(files.has(`${R}examples/jsm/libs/draco/draco_decoder.wasm`));
});

test('import maps a game builds in code are read too', () => {
  const page = `const imports = {
    'three': new URL('/${R}build/three.module.js', location.href).href,
    'three/addons/': new URL('/${R}examples/jsm/', location.href).href,
  };
  const code = "import { OrbitControls } from \\"three/addons/controls/OrbitControls.js\\";";`;
  const { files } = shelfClosure([[page]], shelf(THREE), { maxFolderFiles: 3 });
  assert.ok(files.has(`${R}examples/jsm/controls/OrbitControls.js`));
});

test('a release named by folder resolves the "three/…" names a game hands it in code', () => {
  const page = `const BASE = '/${R}'; const want = ['three/examples/jsm/controls/OrbitControls.js'];`;
  const { files } = shelfClosure([[page]], shelf(THREE), { maxFolderFiles: 3 });
  assert.ok(files.has(`${R}examples/jsm/controls/OrbitControls.js`));
});

test('a version filled in at run time covers every release on the shelf', () => {
  const files = { ...THREE, 'lib/vendor/three/0.186.1/build/three.module.js': '' };
  const page = 'import(`/lib/vendor/three/${version}/build/three.module.js`)';
  const { files: out } = shelfClosure([[page]], shelf(files), { maxFolderFiles: 3 });
  assert.ok(out.has(`${R}build/three.module.js`));
  assert.ok(out.has('lib/vendor/three/0.186.1/build/three.module.js'));
});

test('paths a game names that are not on the shelf are reported, not invented', () => {
  const page = `<script src="/${R}examples/jsm/gone.js"></script>`;
  const { files, missing } = shelfClosure([[page]], shelf(THREE), { maxFolderFiles: 3 });
  assert.ok(missing.has(`${R}examples/jsm/gone.js`));
  assert.ok(!files.has(`${R}examples/jsm/gone.js`));
});

test('module specifiers, mappings and shelf paths read the forms games use', () => {
  assert.deepEqual(moduleSpecifiers(`import a from "x"; import "y"; import('./z.js'); new URL('w.wasm', import.meta.url)`).sort(), [
    './z.js', 'w.wasm', 'x', 'y',
  ]);
  assert.deepEqual(shelfMappings(`"three": "/lib/vendor/three/1/build/three.module.js", "other": "/x.js"`), [
    ['three', '/lib/vendor/three/1/build/three.module.js'],
  ]);
  assert.equal(resolveMapped('three/addons/a.js', [['three/', '/t/'], ['three/addons/', '/a/']]), '/a/a.js');
  assert.equal(resolveMapped('nope', [['three', '/t.js']]), null);
  assert.equal(shelfPath('https://site.example/lib/vendor/three/1/../1/build/x.js?v=2'), 'lib/vendor/three/1/build/x.js');
  assert.equal(shelfPath('../../lib/vendor/three/1/examples/jsm/'), 'lib/vendor/three/1/examples/jsm');
  assert.equal(shelfPath('/games/x.js'), null);
});

test('files over the 25 MiB limit are published as parts under it, in order, adding up', () => {
  const MiB = 1024 * 1024;
  assert.equal(partSizes(25 * MiB), null);
  assert.deepEqual(partSizes(38 * MiB), [20 * MiB, 18 * MiB]);
  assert.deepEqual(partSizes(40 * MiB + 1), [20 * MiB, 20 * MiB, 1]);
});
