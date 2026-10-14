import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { scan } from './scan.mjs';

test('confirmed Tideline successor is the only visible tile while legacy URLs retain their bytes', async () => {
  const registry = JSON.parse(await readFile(new URL('../data/import-registry.json', import.meta.url), 'utf8'));
  const old = registry.records.find(r => r.destination === 'drive-tideline-surface/index.html');
  const next = registry.records.find(r => r.destination === 'github-tideline/index.html');
  assert.equal(next.provenance.gameId, old.provenance.gameId);
  assert.equal(next.provenance.predecessorRevision, old.provenance.revision);
  assert.ok(Date.parse(next.provenance.sourceDate) > Date.parse(old.provenance.sourceDate));
  const manifest = await scan({ quiet: true });
  assert.ok(!manifest.games.some(g => g.slug === 'drive-tideline-surface'));
  assert.ok(manifest.games.some(g => g.slug === 'github-tideline'));
  for (const record of [old, next]) {
    const bytes = await readFile(new URL(`../games/${record.destination}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), record.output.files.find(f => f.path === 'index.html').sha256);
  }
});
