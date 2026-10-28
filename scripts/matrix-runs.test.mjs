import { test } from 'node:test';
import assert from 'node:assert/strict';

import { contentHash, matrixPageText, planMatrixBatch } from './lib/matrix-runs.mjs';

const PAGE = `<!--
SOURCE INFORMATION
Date: 2026-10-21 01:01 America/Vancouver (development start).
Source: StarFox 64. Original spiritual successor; no source assets used.
Model: OpenAI; requested gpt-6.1-sol; reasoning effort max; actual model identity unknown.
-->
<!doctype html>
<html><head>
<title>Foxtrail 64 — The Sunbreak Run</title>
<meta name="description" content="Foxtrail 64 — The Sunbreak Run is an original shooter game inspired by Star Fox 64.">
</head><body>
<p>Controls: WASD to steer, Space to fire.</p>
<script src="https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js"></script>
</body></html>`;

const FIN = {
  metrics: {
    requestedModel: 'gpt-6.1-sol',
    effort: 'max',
    startedAt: '2026-10-21T08:01:01.600Z',
  },
};

const PACKED = 'workspace/Foxtrail-64-StarFox 64-gpt-6.1-sol-max-20261021-0634.html';

test('a workspace-root packaged page is named and tagged from its own notes and the run', () => {
  const [plan] = planMatrixBatch([{ runId: 'run-a', files: [PACKED, 'workspace/kit/gpu-probe.html', 'original-artifacts/copy.html'], pageText: PAGE, finalization: FIN }]);
  assert.equal(plan.action, 'import');
  assert.equal(plan.packagedPath, PACKED);
  assert.equal(plan.destination, 'Foxtrail-64-The-Sunbreak-Run-Star-Fox-64-gpt-6.1-sol-max-20261021-0101.html');
  assert.equal(plan.overrides.name, 'Foxtrail 64');
  assert.equal(plan.overrides.tagline, 'The Sunbreak Run');
  assert.equal(plan.overrides.description, 'Foxtrail 64 — The Sunbreak Run is an original shooter game inspired by Star Fox 64.');
  assert.equal(plan.overrides.type, 'Game');
  assert.equal(plan.overrides.genre, 'Shooter');
  assert.equal(plan.overrides.source, 'Star Fox 64');
  assert.equal(plan.overrides.series, 'Star Fox');
  assert.equal(plan.overrides.model, 'GPT-6.1 Sol');
  assert.equal(plan.overrides.effort, 'max');
  assert.equal(plan.overrides.controls, 'WASD to steer, Space to fire.');
  assert.ok(plan.overrides.tags.length >= 2 && plan.overrides.tags.length <= 5);
  assert.ok(plan.overrides.tags.includes('3d'));
  assert.equal(plan.overrides.unsure, undefined);
  assert.equal(plan.dateBasis, 'run startedAt');
});

test('a source note that keeps talking after the title stays Star Fox 64', () => {
  const page = PAGE.replace(
    'Source: StarFox 64. Original spiritual successor; no source assets used.',
    'Source: StarFox 64 (spiritual inspiration only; no source-game assets).',
  );
  const [plan] = planMatrixBatch([{ runId: 'note', files: [PACKED], pageText: page, finalization: FIN }]);
  assert.equal(plan.overrides.source, 'Star Fox 64');
  assert.equal(plan.overrides.series, 'Star Fox');
  assert.equal(plan.overrides.genre, 'Shooter');
  assert.match(plan.destination, /Star-Fox-64-gpt-6\.1-sol-max-20261021-0101\.html$/);
});

test('a page clock is used when the run record has no start time, and the batch stamp is not', () => {
  const [plan] = planMatrixBatch([{ runId: 'run-clock', files: [PACKED], pageText: PAGE, finalization: { metrics: { requestedModel: 'gpt-6-astra', effort: 'ultra' } } }]);
  assert.equal(plan.destination, 'Foxtrail-64-The-Sunbreak-Run-Star-Fox-64-gpt-6-astra-ultra-20261021-0101.html');
  assert.equal(plan.dateBasis, 'page source notes');
  assert.equal(plan.overrides.model, 'GPT-6 Astra');
  assert.equal(plan.overrides.effort, 'ultra');
});

test('a run whose only HTML files are probes or templates is skipped', () => {
  const [plan] = planMatrixBatch([{
    runId: 'probes',
    files: [
      'workspace/kit/gpu-probe.html',
      'workspace/kit/template.html',
      'workspace/kit/shell.html',
      'original-artifacts/kit/index.html',
      'workspace/hub-report.json',
    ],
    pageText: PAGE,
    finalization: FIN,
  }]);
  assert.equal(plan.action, 'skip');
  assert.equal(plan.reason, 'no packaged game html');
  assert.equal(plan.packagedPath, undefined);
  assert.equal(plan.destination, undefined);
});

test('a byte-identical copy of an installed page is skipped and names that destination', () => {
  const [plan] = planMatrixBatch(
    [{ runId: 'dup', files: [PACKED], pageText: PAGE, finalization: FIN }],
    { installed: [{ sha256: contentHash(PAGE), destination: 'Already-There.html' }] },
  );
  assert.equal(plan.action, 'unchanged');
  assert.equal(plan.destination, 'Already-There.html');
  assert.equal(plan.overrides, undefined);
});

test('same packaged filename with different bytes stays two entries, neither marked Unsure', () => {
  const other = PAGE
    .replace('Foxtrail 64', 'Foxtrail 65')
    .replace('01:01 America/Vancouver', '02:15 America/Vancouver')
    .replace('2026-10-21T08:01:01.600Z', '2026-10-21T09:15:00.000Z');
  const plans = planMatrixBatch([
    { runId: 'one', files: [PACKED], pageText: PAGE, finalization: FIN },
    { runId: 'two', files: [PACKED], pageText: other, finalization: { metrics: { requestedModel: 'gpt-6.1-sol', effort: 'low', startedAt: '2026-10-21T09:15:00.000Z' } } },
  ]);
  assert.equal(plans.length, 2);
  assert.deepEqual(plans.map((plan) => plan.action), ['import', 'import']);
  assert.notEqual(plans[0].contentHash, plans[1].contentHash);
  assert.notEqual(plans[0].destination, plans[1].destination);
  for (const plan of plans) {
    assert.equal(plan.overrides.unsure, undefined);
    assert.equal(plan.overrides.reviewNote, undefined);
    assert.equal(plan.packagedName, PACKED.slice('workspace/'.length));
  }
  assert.match(plans[1].destination, /^Foxtrail-65-The-Sunbreak-Run-Star-Fox-64-gpt-6\.1-sol-low-20261021-0215\.html$/);
});

const TOMB_FIN = {
  metrics: {
    requestedModel: 'gpt-6-astra',
    effort: 'xhigh',
    startedAt: '2026-10-26T06:21:22.713Z',
  },
};

test('a packaged page whose only inspiration is sourceGame records that classic, the run model and effort, and is not labelled original', () => {
  const page = `<!doctype html>
<html><head>
<title>Crypt Trip · The Sunken Sun</title>
<meta name="description" content="A tomb run under a drowned sun.">
</head><body>
<p>Controls: WASD to move, Space to jump.</p>
<script type="application/json" id="gpt-hub-exit-interview">{"identity":{"sourceGame":"Tomb Raider (1996)","sourceUrl":"https://developers.openai.com/api/docs/models/gpt-6-astra"}}</script>
</body></html>`;
  const [plan] = planMatrixBatch([{
    runId: 'tomb',
    files: ['workspace/Crypt-Trip-The-Sunken-Sun-Wrong-Classic-1990-gpt-6-astra-xhigh-20261026-0532.html'],
    pageText: page,
    finalization: TOMB_FIN,
  }]);
  assert.equal(plan.action, 'import');
  assert.equal(plan.overrides.source, 'Tomb Raider (1996)');
  assert.equal(plan.overrides.model, 'GPT-6 Astra');
  assert.equal(plan.overrides.effort, 'xhigh');
  assert.equal(plan.overrides.name, 'Crypt Trip');
  assert.equal(plan.overrides.tagline, 'The Sunken Sun');
  assert.equal(plan.dateBasis, 'run startedAt');
  assert.equal(plan.sourceDate, '2026-10-26T06:21:22.713Z');
  assert.match(plan.destination, /Tomb-Raider-1996-gpt-6-astra-xhigh-/);
  assert.doesNotMatch(plan.destination, /(^|-)original(-|\.)/i);
  assert.doesNotMatch(plan.destination, /Wrong-Classic/);
  assert.doesNotMatch(JSON.stringify(plan.overrides), /developers\.openai\.com/);
});

test('a sourceGame past the first 80 KB still reaches the planner through the shipped excerpt', () => {
  const head = '<!doctype html><html><head><title>Crypt Trip · The Sunken Sun</title></head><body>\n';
  const tail = '<script type="application/json" id="gpt-hub-exit-interview">{"identity":{"sourceGame":"Tomb Raider (1996)\\\\"}}</script></body></html>';
  const buf = Buffer.concat([Buffer.from(head), Buffer.alloc(90_000, 32), Buffer.from(tail)]);
  assert.ok(buf.indexOf('"sourceGame"') > 80_000);
  const [plan] = planMatrixBatch([{
    runId: 'late',
    files: ['workspace/Crypt-Trip-The-Sunken-Sun-Tomb-Raider-1996-gpt-6-astra-xhigh-20261026-0532.html'],
    pageText: matrixPageText(buf),
    finalization: TOMB_FIN,
  }]);
  assert.equal(plan.action, 'import');
  assert.equal(plan.overrides.source, 'Tomb Raider (1996)');
  assert.equal(plan.overrides.model, 'GPT-6 Astra');
  assert.equal(plan.overrides.effort, 'xhigh');
  assert.doesNotMatch(plan.destination, /(^|-)original(-|\.)/i);
});

test('a page with no inspiration field takes the classic from the packaged filename and ignores a model-doc sourceUrl', () => {
  const page = `<!doctype html>
<html><head>
<title>Coast Cadet — Sunset Circuit</title>
</head><body>
<script>{"sourceUrl":"https://developers.openai.com/api/docs/models/gpt-6.1-sol","longContextThreshold":272000}</script>
</body></html>`;
  const [plan] = planMatrixBatch([{
    runId: 'coast',
    files: ['workspace/Coast-Cadet-Top-Skater-1997-gpt-6.1-sol-xhigh-20261024-1635.html'],
    pageText: page,
    finalization: {
      metrics: {
        requestedModel: 'gpt-6.1-sol',
        effort: 'xhigh',
        startedAt: '2026-10-24T20:00:00.000Z',
      },
    },
  }]);
  assert.equal(plan.action, 'import');
  assert.equal(plan.overrides.source, 'Top Skater (1997)');
  assert.equal(plan.overrides.model, 'GPT-6.1 Sol');
  assert.equal(plan.overrides.effort, 'xhigh');
  assert.equal(plan.dateBasis, 'run startedAt');
  assert.match(plan.destination, /Coast-Cadet-Sunset-Circuit-Top-Skater-1997-gpt-6\.1-sol-xhigh-/);
  assert.doesNotMatch(plan.destination, /(^|-)original(-|\.)/i);
  assert.doesNotMatch(plan.overrides.source, /openai|sourceUrl|docs\/models/i);
  assert.doesNotMatch(JSON.stringify(plan.overrides), /developers\.openai\.com/);
});

test('a run whose HTML is only nested templates, shells, or probes is skipped', () => {
  const [plan] = planMatrixBatch([{
    runId: 'nested-only',
    files: [
      'workspace/templates/index.html',
      'workspace/shells/boot.html',
      'workspace/probes/gpu.html',
      'workspace/src/template-shell.html',
    ],
    pageText: PAGE,
    finalization: FIN,
  }]);
  assert.equal(plan.action, 'skip');
  assert.equal(plan.reason, 'no packaged game html');
  assert.equal(plan.destination, undefined);
});
