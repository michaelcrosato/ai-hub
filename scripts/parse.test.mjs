import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  decodeEntities,
  parseAttrs,
  extractHead,
  parseHead,
  splitTitle,
  slugify,
  parseVersion,
  compareVersions,
  weightClass,
} from './lib/parse.mjs';

test('decodeEntities handles named, numeric and hex references', () => {
  assert.equal(decodeEntities('Hover &amp; Out!'), 'Hover & Out!');
  assert.equal(decodeEntities('A &mdash; B'), 'A — B');
  assert.equal(decodeEntities('A &#8212; B'), 'A — B');
  assert.equal(decodeEntities('A &#x2014; B'), 'A — B');
  assert.equal(decodeEntities('Little Orbit &middot; Coffee'), 'Little Orbit · Coffee');
  assert.equal(decodeEntities('&quot;quoted&quot;'), '"quoted"');
  assert.equal(decodeEntities('a&nbsp;b'), 'a b');
});

test('decodeEntities leaves unknown references alone and does not double-decode', () => {
  assert.equal(decodeEntities('&notarealentity;'), '&notarealentity;');
  assert.equal(decodeEntities('&amp;amp;'), '&amp;');
});

test('parseAttrs reads double, single and unquoted values, lowercasing names', () => {
  assert.deepEqual(parseAttrs('meta content="#050c12" name="theme-color"'), {
    content: '#050c12',
    name: 'theme-color',
  });
  assert.deepEqual(parseAttrs("meta name='a' content='b'"), { name: 'a', content: 'b' });
  assert.deepEqual(parseAttrs('meta charset=utf-8'), { charset: 'utf-8' });
  assert.deepEqual(parseAttrs('meta NAME="X" Content="Y"'), { name: 'X', content: 'Y' });
});

test('extractHead stops at </head> and survives a file with none', () => {
  assert.equal(
    extractHead('<html><head><title>T</title></head><body>huge</body>'),
    '<html><head><title>T</title>'
  );
  assert.equal(extractHead('<title>T</title>'), '<title>T</title>');
  assert.equal(extractHead('<HTML><HEAD><title>T</title></HEAD>'), '<HTML><HEAD><title>T</title>');
});

// The regression that motivated this file: undertow.html writes its meta tags with
// `content` BEFORE `name`. A name-then-content regex silently drops every field.
test('parseHead is attribute-order agnostic', () => {
  const forward = parseHead(
    '<head><meta name="description" content="Forward order"/>' +
      '<meta name="theme-color" content="#111111"><title>Fwd</title></head>'
  );
  const reversed = parseHead(
    '<head><meta content="Forward order" name="description"/>' +
      '<meta content="#111111" name="theme-color"/><title>Fwd</title></head>'
  );
  assert.equal(forward.description, 'Forward order');
  assert.equal(reversed.description, 'Forward order', 'reversed attribute order must still parse');
  assert.equal(reversed.themeColor, '#111111');
  assert.equal(reversed.title, 'Fwd');
});

test('parseHead pulls title, lang, data-uri icon and hub:* extras', () => {
  const head = parseHead(
    '<html lang="en"><head><title>Hover &amp; Out! &mdash; Desert Rescue</title>' +
      '<link rel="icon" href="data:image/svg+xml,%3Csvg%3E">' +
      '<meta name="hub:model" content="Claude Opus 5">' +
      '<meta name="hub:tags" content="flight, rescue"></head>'
  );
  assert.equal(head.title, 'Hover & Out! — Desert Rescue');
  assert.equal(head.lang, 'en');
  assert.equal(head.icon, 'data:image/svg+xml,%3Csvg%3E');
  assert.equal(head.hub.model, 'Claude Opus 5');
  assert.deepEqual(head.hub.tags, ['flight', 'rescue']);
});

test('hub:inspired-by is read as the source, and never beats an explicit hub:source', () => {
  const old = parseHead('<head><meta name="hub:inspired-by" content="Blast Corps"></head>');
  assert.deepEqual(old.hub, { source: 'Blast Corps' });
  const both = parseHead(
    '<head><meta name="hub:source" content="Doom II"><meta name="hub:inspired-by" content="Doom"></head>'
  );
  assert.deepEqual(both.hub, { source: 'Doom II' });
});

test('parseHead ignores non-data icon hrefs that would not resolve from the hub', () => {
  assert.equal(parseHead('<link rel="icon" href="./favicon.png">').icon, null);
  assert.equal(
    parseHead('<link rel="shortcut icon" href="data:image/png;base64,AA">').icon,
    'data:image/png;base64,AA'
  );
});

test('parseHead tolerates a > inside a quoted attribute value', () => {
  assert.equal(
    parseHead('<meta name="description" content="faster > slower">').description,
    'faster > slower'
  );
});

test('splitTitle separates a display name from its tagline, verbatim', () => {
  assert.deepEqual(splitTitle('Little Orbit · The Coffee Post — A Comfortable Walk'), {
    name: 'Little Orbit',
    tagline: 'The Coffee Post — A Comfortable Walk',
  });
  assert.deepEqual(splitTitle('Void Explorer — AURORA / Surface 0.4'), {
    name: 'Void Explorer',
    tagline: 'AURORA / Surface 0.4',
  });
  assert.deepEqual(splitTitle('Undertow — Seven Guardians Below'), {
    name: 'Undertow',
    tagline: 'Seven Guardians Below',
  });
  assert.deepEqual(splitTitle('Hover & Out! — Desert Rescue'), {
    name: 'Hover & Out!',
    tagline: 'Desert Rescue',
  });
});

test('splitTitle leaves untitled or unsplittable titles whole', () => {
  assert.deepEqual(splitTitle('Tetris'), { name: 'Tetris', tagline: '' });
  assert.deepEqual(
    splitTitle('Q - Deep'),
    { name: 'Q - Deep', tagline: '' },
    'left side too short to be a name'
  );
  assert.deepEqual(splitTitle('   '), { name: '', tagline: '' });
});

test('slugify produces url-safe, collapsed, accent-free slugs', () => {
  assert.equal(slugify('Hover & Out!'), 'hover-out');
  assert.equal(slugify('Little_Orbit_Optimized'), 'little-orbit-optimized');
  assert.equal(slugify('Void-Explorer-AURORA'), 'void-explorer-aurora');
  assert.equal(slugify('Café Noir'), 'cafe-noir');
  assert.equal(slugify('  spaced   out  '), 'spaced-out');
  assert.equal(slugify('---'), '');
});

test('parseVersion recognises explicit v-prefixed and dotted versions', () => {
  assert.deepEqual(parseVersion('Void-Explorer-AURORA-v0.4'), {
    base: 'Void-Explorer-AURORA',
    version: '0.4',
  });
  assert.deepEqual(parseVersion('snake-1.2'), { base: 'snake', version: '1.2' });
  assert.deepEqual(parseVersion('snake v3'), { base: 'snake', version: '3' });
  assert.deepEqual(parseVersion('snake_V2.1.0'), { base: 'snake', version: '2.1.0' });
});

// False positives hide a game; false negatives just show two tiles. Prefer the latter.
test('parseVersion refuses bare trailing integers and glued digits', () => {
  assert.deepEqual(parseVersion('snake-2'), { base: 'snake-2', version: null });
  assert.deepEqual(parseVersion('game2048'), { base: 'game2048', version: null });
  assert.deepEqual(parseVersion('undertow'), { base: 'undertow', version: null });
  assert.deepEqual(parseVersion('Little_Orbit_Optimized'), {
    base: 'Little_Orbit_Optimized',
    version: null,
  });
});

test('parseVersion treats a bare version filename as a build inside a game folder', () => {
  assert.deepEqual(parseVersion('v0.5'), { base: '', version: '0.5' });
  assert.deepEqual(parseVersion('2.0'), { base: '', version: '2.0' });
});

test('compareVersions orders numerically, not lexically', () => {
  assert.ok(compareVersions('0.4', '0.5') < 0);
  assert.ok(compareVersions('1.10', '1.9') > 0, '1.10 is newer than 1.9');
  assert.ok(compareVersions('1.0', '1') > 0);
  assert.equal(compareVersions('2.1', '2.1'), 0);
  assert.ok(compareVersions(null, '0.1') < 0, 'unversioned sorts below any version');
  assert.equal(compareVersions(null, null), 0);
});

test('weightClass buckets by file size', () => {
  assert.equal(weightClass(90 * 1024), 'Featherweight');
  assert.equal(weightClass(600 * 1024), 'Lightweight');
  assert.equal(weightClass(3 * 1024 * 1024), 'Middleweight');
  assert.equal(weightClass(10.5 * 1024 * 1024), 'Heavyweight');
});
