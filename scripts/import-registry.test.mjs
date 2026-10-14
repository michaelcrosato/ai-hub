import { test } from 'node:test';
import * as zlib from 'node:zlib';
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
test('version-like filenames alone cannot collapse distinct games into one catalogue tile', async t => {
  const { root, run } = await fixture(t);
  await writeFile(path.join(root, 'input/snake-v1.html'), html);
  await writeFile(path.join(root, 'input/snake-v2.html'), html + '<script>let different=2</script>');
  assert.equal(run('input/snake-v1.html', 'input/snake-v2.html').counts.pages, 2);
  const manifest = JSON.parse(await readFile(path.join(root, 'data/games.json'), 'utf8'));
  assert.equal(manifest.games.length, 2);
});

test('same basenames in separate input roots get distinct provenance keys', async t => {
  const { root, run } = await fixture(t);
  for (const id of ['a', 'b']) {
    await mkdir(path.join(root, `input/${id}`));
    await writeFile(path.join(root, `input/${id}/game.html`), html + id);
  }
  const args = ['input/a/game.html', 'input/b/game.html'];
  const plan = run(...args, '--dry-run');
  assert.deepEqual(plan.decisions.map(x => x.from), ['a/game.html', 'b/game.html']);
  const sources = Object.fromEntries(plan.decisions.map((x, i) => [x.from, { gameId: `distinct-${i}`, identityEvidence: 'Independent original campaign', revision: 'r1', sourceDate: '2026-10-12T00:00:00Z' }]));
  await writeFile(path.join(root, 'meta.json'), JSON.stringify({ schemaVersion: 1, sources }));
  assert.equal(run(...args, '--metadata', 'meta.json').counts.pages, 2);
  assert.equal(run(...args, '--metadata', 'meta.json').counts.unchanged, 2);
});

// Stored ZIP fixture; no external archiver required.
function projectZip(files) {
  const locals = [], central = []; let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const n = Buffer.from(name), data = Buffer.from(content), l = Buffer.alloc(30), c = Buffer.alloc(46);
    // Match zip.test.mjs: older Node 20 also skips CRC validation in openZip.
    const crc = typeof zlib.crc32 === 'function' ? zlib.crc32(data) >>> 0 : 0;
    l.writeUInt32LE(crc, 14); c.writeUInt32LE(crc, 16);
    l.writeUInt32LE(0x04034b50); l.writeUInt16LE(20, 4); l.writeUInt32LE(data.length, 18); l.writeUInt32LE(data.length, 22); l.writeUInt16LE(n.length, 26);
    c.writeUInt32LE(0x02014b50); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt32LE(data.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(offset, 42);
    locals.push(l,n,data); central.push(c,n); offset += l.length+n.length+data.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22), count = Object.keys(files).length;
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(count, 8); end.writeUInt16LE(count, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals,cd,end]);
}

test('multiple projects inside one ZIP have independent metadata and decisions', async t => {
  const { root, run } = await fixture(t);
  await writeFile(path.join(root, 'input/games.zip'), projectZip({ 'a/index.html': html + 'a', 'b/index.html': html + 'b' }));
  const plan = run('input/games.zip', '--dry-run');
  assert.deepEqual(plan.decisions.map(x => x.from), ['games.zip › a', 'games.zip › b']);
  const sources = Object.fromEntries(plan.decisions.map((x, i) => [x.from, { gameId: `zip-game-${i}`, identityEvidence: 'Independent campaign', revision: 'r1', sourceDate: '2026-10-12T00:00:00Z' }]));
  await writeFile(path.join(root, 'meta.json'), JSON.stringify({ schemaVersion: 1, sources }));
  assert.equal(run('input/games.zip', '--metadata', 'meta.json').counts.projects, 2);
  assert.equal(run('input/games.zip', '--metadata', 'meta.json').counts.unchanged, 2);
});

test('explicit identity never collapses into an anonymous seeded exact match', async t => {
  const { root, run } = await fixture(t);
  await writeFile(path.join(root, 'input/anonymous.html'), html);
  run('input/anonymous.html');
  await writeFile(path.join(root, 'input/identified.html'), html);
  await writeFile(path.join(root, 'meta.json'), JSON.stringify({ schemaVersion: 1, sources: { 'identified.html': { gameId: 'independent', identityEvidence: 'Explicitly independent original game' } } }));
  assert.equal(run('input/identified.html', '--metadata', 'meta.json').counts.pages, 1);
  assert.equal((await readdir(path.join(root, 'games'))).length, 2);
});

test('byte-identical successor remembers revision without rewriting games; next successor uses it', async t => {
  const { root, run } = await fixture(t);
  const meta = { gameId: 'game', identityEvidence: 'Confirmed source revision chain', revision: 'r1', sourceDate: '2026-10-11T00:00:00Z' };
  await writeFile(path.join(root, 'input/game.html'), html);
  const stage = async (...args) => {
    await writeFile(path.join(root, 'meta.json'), JSON.stringify({ schemaVersion: 1, sources: { 'game.html': meta } }));
    return run('input/game.html', '--metadata', 'meta.json', ...args);
  };
  await stage();
  const before = await readFile(path.join(root, 'data/import-registry.json'), 'utf8');
  const dates = await readFile(path.join(root, 'data/added.json'), 'utf8');
  Object.assign(meta, { revision: 'r2', predecessorRevision: 'r1', sourceDate: '2026-10-12T00:00:00Z' });
  assert.equal((await stage('--dry-run')).counts['record-revision'], 1);
  assert.equal(await readFile(path.join(root, 'data/import-registry.json'), 'utf8'), before);
  assert.equal((await stage()).counts['record-revision'], 1);
  assert.equal(await readFile(path.join(root, 'data/added.json'), 'utf8'), dates);
  const remembered = await readFile(path.join(root, 'data/import-registry.json'), 'utf8');
  assert.equal((await stage()).counts.unchanged, 1);
  assert.equal(await readFile(path.join(root, 'data/import-registry.json'), 'utf8'), remembered);
  assert.deepEqual(await readdir(path.join(root, 'games')), ['same-title.html']);
  Object.assign(meta, { revision: 'r3', predecessorRevision: 'r2', sourceDate: '2026-10-13T00:00:00Z' });
  await writeFile(path.join(root, 'input/game.html'), html + 'new');
  assert.equal((await stage()).counts['import-newer'], 1);
});

test('uppercase index normalizes destination and remains unchanged on rerun', async t => {
  const { root, run } = await fixture(t);
  await mkdir(path.join(root, 'input/game'));
  await writeFile(path.join(root, 'input/game/INDEX.HTML'), html);
  assert.equal(run('input/game').counts.projects, 1);
  assert.equal(await readFile(path.join(root, 'games/game/index.html'), 'utf8'), html);
  assert.equal(run('input/game').counts.unchanged, 1);
});

test('classification bounds oversized index before read and continues sibling input', async t => {
  const { root, run } = await fixture(t);
  await mkdir(path.join(root, 'input/large'));
  const { open } = await import('node:fs/promises');
  const f = await open(path.join(root, 'input/large/index.html'), 'w');
  await f.truncate(96 * 1024 * 1024); await f.close();
  await writeFile(path.join(root, 'input/good.html'), html);
  const report = run('input/large', 'input/good.html');
  assert.equal(report.counts.failed, 1);
  assert.equal(report.counts.pages, 1);
});

test('missing metadata option value stops before any import', async t => {
  const { root, run } = await fixture(t);
  await writeFile(path.join(root, 'input/game.html'), html);
  assert.throws(() => run('input/game.html', '--metadata'));
  assert.deepEqual(await readdir(path.join(root, 'games')), []);
});
