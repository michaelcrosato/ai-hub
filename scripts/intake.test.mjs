import { test } from 'node:test';
import assert from 'node:assert/strict';

import { chooseWebRoot, needsBuild, isJunk, packageName } from './lib/intake.mjs';
import { rootAbsoluteRefs, relativizeRefs } from './lib/parse.mjs';

const PLAIN = '<html><head><title>x</title></head><body><script src="game.js"></script></body></html>';
const VITE_SOURCE = '<html><body><script type="module" src="/src/main.ts"></script></body></html>';
const VITE_BUILT = '<html><head><script type="module" src="/assets/index-a1b2.js"></script></head></html>';

const reader = (pages) => (p) => pages[p] ?? PLAIN;

test('a plain folder with an index.html is one project', () => {
  const files = ['index.html', 'game.js', 'sprites/hero.png'];
  assert.deepEqual(chooseWebRoot(files, reader({})), { kind: 'projects', roots: [''] });
});

test('a single wrapping folder is found', () => {
  const files = ['orbit/index.html', 'orbit/game.js'];
  assert.deepEqual(chooseWebRoot(files, reader({})), { kind: 'projects', roots: ['orbit'] });
});

test('a finished build beats the source around it', () => {
  const files = ['index.html', 'package.json', 'src/main.ts', 'dist/index.html', 'dist/assets/index-a1b2.js'];
  const verdict = chooseWebRoot(files, reader({ 'index.html': VITE_SOURCE, 'dist/index.html': VITE_BUILT }));
  assert.deepEqual(verdict, { kind: 'projects', roots: ['dist'] });
});

test('source with no build inside is reported, not half-imported', () => {
  const files = ['index.html', 'package.json', 'src/main.ts', 'vite.config.ts'];
  assert.deepEqual(chooseWebRoot(files, reader({ 'index.html': VITE_SOURCE })), {
    kind: 'needs-build',
    root: '',
  });
  assert.equal(chooseWebRoot(['package.json', 'src/app.jsx'], reader({})).kind, 'needs-build');
});

test('several playable folders side by side are several projects', () => {
  const files = ['a/index.html', 'a/game.js', 'b/index.html', 'b/game.js', 'a/docs/index.html', 'a/docs/game.js'];
  assert.deepEqual(chooseWebRoot(files, reader({})), { kind: 'projects', roots: ['a', 'b'] });
});

test('one page that loads its own files becomes a project; bare pages stay loose', () => {
  assert.deepEqual(chooseWebRoot(['game/Space.html', 'game/art/ship.png', 'README.md'], reader({})), {
    kind: 'page',
    root: 'game',
    entry: 'game/Space.html',
  });
  assert.deepEqual(chooseWebRoot(['snake.html', 'tetris.html', 'notes.txt'], reader({})), {
    kind: 'loose',
    files: ['snake.html', 'tetris.html'],
  });
  assert.deepEqual(chooseWebRoot(['README.md'], reader({})), { kind: 'empty' });
});

test('needsBuild spots bundler inputs', () => {
  assert.equal(needsBuild(VITE_SOURCE), true);
  assert.equal(needsBuild('<script src="./app.tsx"></script>'), true);
  assert.equal(needsBuild('<link href="%PUBLIC_URL%/favicon.ico">'), true);
  assert.equal(needsBuild('<script type="importmap">{"imports":{"three":"./node_modules/three/build/three.module.js"}}</script>'), true);
  assert.equal(needsBuild(VITE_BUILT), false);
  assert.equal(needsBuild(PLAIN), false);
  // A finished game that happens to keep its code in src/ and use an importmap.
  assert.equal(
    needsBuild('<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three/+esm"}}</script><script type="module" src="./src/main.js"></script>'),
    false
  );
});

test('secrets and clutter are never imported', () => {
  for (const p of ['.env', 'app/.env.local', 'node_modules/x/index.js', '__MACOSX/._a', '.git/HEAD', 'certs/server.key', 'id_rsa']) {
    assert.equal(isJunk(p), true, p);
  }
  for (const p of ['index.html', 'src/environment.js', 'keyboard.png', 'assets/key.png']) {
    assert.equal(isJunk(p), false, p);
  }
});

test('package names lose branch and "source" suffixes', () => {
  assert.equal(packageName('orbit-main'), 'orbit');
  assert.equal(packageName('Space Game Source'), 'Space Game');
  assert.equal(packageName('_private'), 'private');
  assert.equal(packageName('src'), 'src');
  assert.equal(packageName('dreambound-crown-release'), 'dreambound-crown');
});

test('root-absolute references are found and made relative, and only those that exist', () => {
  assert.deepEqual(rootAbsoluteRefs(VITE_BUILT + '<a href="/">home</a><img src="//cdn.x/y.png">'), [
    '/assets/index-a1b2.js',
  ]);
  const have = new Set(['assets/index-a1b2.js']);
  const out = relativizeRefs(VITE_BUILT + '<link href="/missing.css">', (p) => have.has(p));
  assert.match(out, /src="\.\/assets\/index-a1b2\.js"/);
  assert.match(out, /href="\/missing\.css"/);
  assert.match(relativizeRefs('<img src="/a.png">', () => true, 2), /src="\.\.\/\.\.\/a\.png"/);
});

test('secrets are flagged, harmless templates are not', async () => {
  const { isSecret } = await import('./lib/intake.mjs');
  for (const p of ['.env', 'app/.env.production', 'deploy/server.pem', 'id_rsa', '.npmrc']) assert.equal(isSecret(p), true, p);
  for (const p of ['.env.example', 'app/.env.sample', 'src/env.js', 'keys.png']) assert.equal(isSecret(p), false, p);
});

test('a Drive folder download or a zip of zips is a container, a package is not', async () => {
  const { isContainer } = await import('./lib/intake.mjs');
  assert.equal(isContainer('files-20260924T024324Z-1-001.zip', ['files/a.html']), true);
  assert.equal(isContainer('bundle.zip', ['a.html', 'more/pack.zip']), true);
  assert.equal(isContainer('orbit-main.zip', ['orbit/index.html', 'orbit/game.js']), false);
});

test('browser-saved and generic filenames are recognised as saying nothing', async () => {
  const { UNINFORMATIVE_NAME } = await import('./lib/intake.mjs');
  for (const stem of ['index', 'index(3)', 'index (12)', 'index(20260910-200340)', 'game', 'Untitled-2']) {
    assert.equal(UNINFORMATIVE_NAME.test(stem), true, stem);
  }
  for (const stem of ['index-of-souls', 'undertow', 'gameboy-tetris', 'snake-2']) {
    assert.equal(UNINFORMATIVE_NAME.test(stem), false, stem);
  }
});

test('a page whose own scripts are not in the package is waiting for a build', () => {
  const files = ['night-signal/public/index.html', 'night-signal/package.json', 'night-signal/src/main.mts'];
  const verdict = chooseWebRoot(files, () => '<script type="module" src="./main.mjs"></script>');
  assert.equal(verdict.kind, 'needs-build');
  // present scripts, CDN scripts and root-absolute ones that exist are all fine
  const ok = ['game/index.html', 'game/js/app.js', 'game/lib/x.js'];
  const html = '<script src="js/app.js"></script><script src="https://cdn.jsdelivr.net/npm/three"></script><script src="/game/lib/x.js"></script>';
  assert.deepEqual(chooseWebRoot(ok, () => html), { kind: 'projects', roots: ['game'] });
});

test('an example page inside a package that needs a build is not the game', () => {
  const files = ['kit/index.html', 'kit/package.json', 'kit/src/portal.ts', 'kit/examples/contributor/index.html'];
  const pages = { 'kit/index.html': '<script type="module" src="./build/portal.js"></script>', 'kit/examples/contributor/index.html': '<p>hi</p>' };
  assert.equal(chooseWebRoot(files, (p) => pages[p]).kind, 'needs-build');
});
