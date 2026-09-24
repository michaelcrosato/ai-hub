import { test } from 'node:test';
import assert from 'node:assert/strict';

import { classify, assignSlugs, prettify } from './lib/layout.mjs';

const pick = ({ key, version, collection }) => ({ key, version, collection });

test('a root-level file is its own game, versioned only when unmistakable', () => {
  assert.deepEqual(pick(classify('snake.html')), { key: 'snake', version: null, collection: null });
  assert.deepEqual(pick(classify('Void-Explorer-AURORA-v0.4.html')), {
    key: 'void-explorer-aurora',
    version: '0.4',
    collection: null,
  });
  assert.equal(classify('snake-2.html').key, 'snake-2');
});

test('builds group case- and punctuation-insensitively', () => {
  assert.equal(classify('Void_Explorer-v0.4.html').key, classify('void-explorer-v0.5.html').key);
});

test('bare-version files in a folder are builds of the game the folder names', () => {
  assert.deepEqual(pick(classify('void-explorer/v0.5.html')), {
    key: 'void-explorer',
    version: '0.5',
    collection: null,
  });
  assert.equal(classify('void-explorer/v0.4.html').key, classify('void-explorer/v0.5.html').key);
});

test('any other file in a folder is its own game in that collection — never a hidden build', () => {
  const a = classify('claude/snake.html');
  const b = classify('claude/tetris.html');
  assert.notEqual(a.key, b.key);
  assert.equal(a.collection, 'claude');
  assert.equal(b.collection, 'claude');
  assert.equal(a.version, null);
});

test('same filename in two collections stays two games', () => {
  assert.notEqual(classify('claude/snake.html').key, classify('gpt/snake.html').key);
});

test('a folder that shares the game name is its home, not a collection of one', () => {
  assert.deepEqual(pick(classify('snake/snake-v2.html')), { key: 'snake', version: '2', collection: null });
});

test('a project folder is one game; versioned folders are builds of it', () => {
  assert.deepEqual(pick(classify('orbit/index.html', { project: true })), {
    key: 'orbit',
    version: null,
    collection: null,
  });
  assert.deepEqual(pick(classify('orbit-v2/index.html', { project: true })), {
    key: 'orbit',
    version: '2',
    collection: null,
  });
  assert.deepEqual(pick(classify('orbit/v3/index.html', { project: true })), {
    key: 'orbit',
    version: '3',
    collection: null,
  });
  assert.deepEqual(pick(classify('claude/orbit/index.html', { project: true })), {
    key: 'claude/orbit',
    version: null,
    collection: 'claude',
  });
});

test('slugs prefer the plain name, qualify on a clash, and favour shallow games', () => {
  const slugs = assignSlugs([
    { key: 'gpt/snake', family: 'snake' },
    { key: 'claude/snake', family: 'snake' },
    { key: 'snake', family: 'snake' },
  ]);
  assert.equal(slugs.get('snake'), 'snake');
  assert.equal(slugs.get('claude/snake'), 'claude-snake');
  assert.equal(slugs.get('gpt/snake'), 'gpt-snake');
});

test('slugs fall back to a counter when even the qualified name is taken', () => {
  const slugs = assignSlugs([
    { key: 'a-b', family: 'x' },
    { key: 'a/b', family: 'x' },
    { key: 'c', family: 'x' },
  ]);
  assert.equal(new Set(slugs.values()).size, 3);
});

test('prettify turns folder names into labels', () => {
  assert.equal(prettify('claude-opus_4'), 'Claude Opus 4');
  assert.equal(prettify('GPT 5'), 'GPT 5');
});
