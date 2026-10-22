import { test } from 'node:test';
import assert from 'node:assert/strict';

import { planHubPage } from './lib/hub-pages.mjs';

const PAGE = `<!doctype html>
<html><head><title>Arkhamish After Hours</title>
<meta name="description" content="A night shift through a rain-soaked city, original and unofficial.">
</head><body>
<!-- SOURCE INFORMATION
Date: 2026-10-20 00:14
SOURCE: Batman: Arkham Knight
Model: OpenAI gpt-6.1-sol ultra
-->
<canvas id="game"></canvas>
</body></html>`;

test('an intake-recorded page stays unchanged', () => {
  const plan = planHubPage({
    sourcePath: 'gpt-hub/Already.html',
    pageText: PAGE,
    sha256: 'abc',
    modifiedAt: '2026-10-20T07:14:00.000Z',
    intake: [{ sourceRoot: 'gpt-hub', sourceFile: 'Already.html', sourceSha256: 'abc', destination: 'Already-On-The-Wall.html' }],
    installed: [{ sha256: 'localized', destination: 'games/Already-On-The-Wall.html' }],
  });
  assert.equal(plan.action, 'unchanged');
  assert.equal(plan.destination, 'Already-On-The-Wall.html');
});

test('a byte-identical page stays unchanged', () => {
  const plan = planHubPage({
    sourcePath: 'gpt-hub/Copy.html',
    pageText: PAGE,
    sha256: 'same',
    modifiedAt: '2026-10-20T07:14:00.000Z',
    intake: [],
    installed: [{ sha256: 'same', destination: 'games/Copy-Installed.html' }],
  });
  assert.equal(plan.action, 'unchanged');
  assert.match(plan.reason, /byte-identical/);
});

test('a new self-contained page is named and tagged as a game', () => {
  const plan = planHubPage({
    sourcePath: 'gpt-hub/Arkhamish-After-Hours-Batman-Arkham-Knight-gpt-6.1-sol-ultra-20261020-0014.html',
    pageText: PAGE,
    sha256: 'new',
    modifiedAt: '2026-10-20T07:14:00.000Z',
    intake: [],
    installed: [],
  });
  assert.equal(plan.action, 'import');
  assert.match(plan.destination, /^Arkhamish-After-Hours-Batman-Arkham-Knight-gpt-6\.1-sol-ultra-20261020-0014\.html$/);
  assert.equal(plan.overrides.type, 'Game');
  assert.equal(plan.overrides.genre, 'Action');
  assert.equal(plan.overrides.source, 'Batman: Arkham Knight');
  assert.ok(plan.overrides.tags.length >= 2 && plan.overrides.tags.length <= 5);
  assert.equal(plan.overrides.model, 'GPT-6.1 Sol');
  assert.equal(plan.overrides.effort, 'ultra');
});

test('a template, a shell, and a test are not games', () => {
  for (const sourcePath of ['gpt-hub/template.html', 'cc-hub/src/shell.html', 'cc-hub/arc-the-ladle/arc-the-ladle.test.html', 'gpt-hub/gpu-probe.html']) {
    const plan = planHubPage({
      sourcePath,
      pageText: PAGE,
      sha256: 'x',
      modifiedAt: '2026-10-20T07:14:00.000Z',
      intake: [],
      installed: [],
    });
    assert.equal(plan.action, 'skip', sourcePath);
  }
});

test('a build-tree copy of an already imported page is not a second game', () => {
  const plan = planHubPage({
    sourcePath: 'gpt-hub/Starfoxglove/dist/index.html',
    pageText: '<html><title>Starfoxglove</title></html>',
    sha256: 'source-hash',
    modifiedAt: '2026-10-18T18:00:00.000Z',
    intake: [{ sourceRoot: 'gpt-hub', sourceFile: 'Starfoxglove.html', sourceSha256: 'source-hash', destination: 'Starfoxglove-Installed.html' }],
    installed: [{ sha256: 'localized-hash', destination: 'games/Starfoxglove-Installed.html' }],
  });
  assert.equal(plan.action, 'skip');
  assert.match(plan.reason, /build-tree/);
});
