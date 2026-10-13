import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fingerprint, decide, PIPELINE } from './lib/import-registry.mjs';
const repo = path.resolve(import.meta.dirname, '..');
async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'import-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(path.join(repo, 'scripts'), path.join(root, 'scripts'), { recursive: true });
  await mkdir(path.join(root, 'lib/vendor'), { recursive: true });
  await cp(path.join(repo, 'lib/vendor/manifest.json'), path.join(root, 'lib/vendor/manifest.json'));
  await mkdir(path.join(root, 'games'));
  await mkdir(path.join(root, 'data'));
  await mkdir(path.join(root, 'input'));
  return { root, run: (...args) => JSON.parse(execFileSync(process.execPath, ['scripts/ingest.mjs', ...args, '--json'], { cwd: root, encoding: 'utf8' })) };
}
const html = '<title>Same title</title><canvas></canvas><script>let game=1</script>';
test('unchanged reruns preserve files and registry; changed dependency imports', async t => {
  const { root, run } = await fixture(t);
  await mkdir(path.join(root, 'input/game'));
  await writeFile(path.join(root, 'input/game/index.html'), html + '<script src="main.js"></script>');
  await writeFile(path.join(root, 'input/game/main.js'), 'let x=1');
  assert.equal(run('input/game').counts.projects, 1);
  const before = await readFile(path.join(root, 'data/import-registry.json'), 'utf8');
  assert.equal(run('input/game').counts.unchanged, 1);
  assert.equal(await readFile(path.join(root, 'data/import-registry.json'), 'utf8'), before);
  await writeFile(path.join(root, 'input/game/main.js'), 'let x=2');
  assert.equal(run('input/game').counts.projects, 1);
  assert.deepEqual((await readdir(path.join(root, 'games'))).sort(), ['game', 'game-2']);
});
test('same title and even identical bytes do not collapse explicitly distinct identities', async t => {
  const { root, run } = await fixture(t);
  for (const id of ['a','b']) {
    await writeFile(path.join(root, `input/${id}.html`), html);
    await writeFile(path.join(root, 'meta.json'), JSON.stringify({ schemaVersion: 1, sources: { [`${id}.html`]: { gameId: id, identityEvidence: 'owner-confirmed independent game' } } }));
    assert.equal(run(`input/${id}.html`, '--metadata', 'meta.json').counts.pages, 1);
  }
});
test('dry run creates no repository files; malformed input does not stop healthy input', async t => {
  const { root, run } = await fixture(t);
  await writeFile(path.join(root, 'input/good.html'), html);
  await writeFile(path.join(root, 'input/bad.zip'), 'broken');
  const result = run('input/bad.zip', 'input/good.html', '--dry-run');
  assert.equal(result.counts.failed, 1);
  assert.equal(result.counts.pages, 1);
  assert.deepEqual(await readdir(path.join(root, 'data')), []);
  assert.deepEqual(await readdir(path.join(root, 'games')), []);
});
test('no downgrade, unproven lineage held, proven successor preserved as new build', () => {
  const output = fingerprint(new Map([['index.html', Buffer.from('old')]]));
  const old = { pipelineVersion: PIPELINE, output, destination: 'old/index.html', provenance: { gameId: 'one', revision: 'r2', sourceDate: '2026-10-12T00:00:00Z' } };
  const next = { output: fingerprint(new Map([['index.html', Buffer.from('new')]])), provenance: { gameId: 'one', revision: 'r3', sourceDate: '2026-10-11T00:00:00Z' } };
  assert.equal(decide([old], next).action, 'skip-older');
  next.provenance.sourceDate = '2026-10-13T00:00:00Z';
  assert.equal(decide([old], next).action, 'review-lineage');
  next.provenance.predecessorRevision = 'r2';
  assert.equal(decide([old], next).action, 'import-newer');
});
test('private database project is bounded failure and next input continues', async t => {
  const { root, run } = await fixture(t);
  await mkdir(path.join(root, 'input/private'));
  await writeFile(path.join(root, 'input/private/index.html'), html);
  await writeFile(path.join(root, 'input/private/users.sqlite'), 'private');
  await writeFile(path.join(root, 'input/good.html'), html);
  const result = run('input/private', 'input/good.html');
  assert.equal(result.counts.failed, 1);
  assert.equal(result.counts.pages, 1);
  assert.deepEqual(await readdir(path.join(root, 'games')), ['good.html']);
});
test('oversized file is bounded; populated dry-run preserves registry and dates', async t => {
  const { root, run } = await fixture(t);
  await writeFile(path.join(root, 'input/ok.html'), html);
  run('input/ok.html');
  const registry = await readFile(path.join(root, 'data/import-registry.json'), 'utf8');
  const dates = await readFile(path.join(root, 'data/added.json'), 'utf8');
  const { open } = await import('node:fs/promises');
  const f = await open(path.join(root, 'input/large.html'), 'w');
  await f.truncate(96 * 1024 * 1024); await f.close();
  const report = run('input/large.html', 'input/ok.html', '--dry-run');
  assert.equal(report.counts.failed, 1);
  assert.equal(report.counts.unchanged, 1);
  assert.equal(await readFile(path.join(root, 'data/import-registry.json'), 'utf8'), registry);
  assert.equal(await readFile(path.join(root, 'data/added.json'), 'utf8'), dates);
});
test('persisted identity refuses older and unproven builds without touching installed bytes', async t => {
  const { root, run } = await fixture(t);
  const meta = { gameId: 'confirmed-game', identityEvidence: 'Owner verified this revision chain', sourceDate: '2026-10-12T00:00:00Z', revision: 'r2' };
  async function stage(body) {
    await writeFile(path.join(root, 'input/game.html'), body);
    await writeFile(path.join(root, 'meta.json'), JSON.stringify({ schemaVersion: 1, sources: { 'game.html': meta } }));
    return run('input/game.html', '--metadata', 'meta.json');
  }
  const first = await stage(html);
  assert.equal(first.counts.pages, 1);
  const installed = first.decisions[0].destination;
  const registry = await readFile(path.join(root, 'data/import-registry.json'), 'utf8');
  meta.sourceDate = '2026-10-11T00:00:00Z'; meta.revision = 'r1';
  assert.equal((await stage(html + '<!-- old -->')).counts['skip-older'], 1);
  assert.equal(await readFile(path.join(root, 'data/import-registry.json'), 'utf8'), registry);
  meta.sourceDate = '2026-10-13T00:00:00Z'; meta.revision = 'r3';
  assert.equal((await stage(html + '<!-- next -->')).counts['review-lineage'], 1);
  meta.predecessorRevision = 'r2';
  assert.equal((await stage(html + '<!-- next -->')).counts['import-newer'], 1);
  assert.equal(await readFile(path.join(root, 'games', installed), 'utf8'), html);
});
