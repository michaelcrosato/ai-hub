import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseAddedHistory } from './lib/dates.mjs';
import { migrateAddedDates } from './migrate-added-dates.mjs';

test('first arrival dates follow renames, while a copied game is a new arrival', () => {
  const history = '\0' + '2026-09-01T12:00:00Z\0\nA\0games/old name.html\0'
    + '\0' + '2026-10-13T12:00:00Z\0\nR100\0games/old name.html\0games/renamed/index.html\0'
    + 'C100\0games/renamed/index.html\0games/copied.html\0';
  const dates = parseAddedHistory(history);
  assert.equal(dates.get('renamed/index.html'), '2026-09-01T12:00:00.000Z');
  assert.equal(dates.get('copied.html'), '2026-10-13T12:00:00.000Z');
});

test('legacy migration uses actual hub commits, retains source dates, and is idempotent', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'hub-dates-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  const commit = (date, message) => execFileSync('git', ['commit', '-qm', message], {
    cwd: root,
    env: { ...process.env, GIT_AUTHOR_DATE: '2025-01-01T00:00:00Z', GIT_COMMITTER_DATE: date },
  });
  git('init', '-q');
  git('config', 'user.email', 'dates-test@example.com');
  git('config', 'user.name', 'Date fixture');
  await mkdir(path.join(root, 'games'));
  await mkdir(path.join(root, 'data'));
  await writeFile(path.join(root, 'games/old.html'), '<title>Old</title>');
  git('add', 'games');
  commit('2026-10-01T12:00:00Z', 'Import old source');
  await rename(path.join(root, 'games/old.html'), path.join(root, 'games/renamed.html'));
  await writeFile(path.join(root, 'games/new.html'), '<title>New</title>');
  git('add', 'games');
  commit('2026-10-13T12:00:00Z', 'Rename old, import new');
  const legacy = { 'renamed.html': '2026-09-20T12:00:00.000Z', 'new.html': '2026-09-01T12:00:00.000Z' };
  await writeFile(path.join(root, 'data/added.json'), JSON.stringify(legacy));
  assert.deepEqual(await migrateAddedDates(root), { entries: 2, changed: 2 });
  const added = JSON.parse(await readFile(path.join(root, 'data/added.json'), 'utf8'));
  assert.deepEqual(added, { 'new.html': '2026-10-13T12:00:00.000Z', 'renamed.html': '2026-10-01T12:00:00.000Z' });
  assert.deepEqual(JSON.parse(await readFile(path.join(root, 'data/source-dates.json'), 'utf8')), legacy);
  const sourceText = await readFile(path.join(root, 'data/source-dates.json'), 'utf8');
  assert.deepEqual(await migrateAddedDates(root), { entries: 2, changed: 0 });
  assert.equal(await readFile(path.join(root, 'data/source-dates.json'), 'utf8'), sourceText);
});
