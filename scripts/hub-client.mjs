#!/usr/bin/env node
/**
 * hub-client.mjs — which session client every game carries, and an upgrade
 * of all of them at once.
 *
 *   node scripts/hub-client.mjs                    list the copies by version, and any edited one
 *   node scripts/hub-client.mjs --write            replace every pristine older copy with lib/hub/session.js
 *   node scripts/hub-client.mjs --write games/a…   only under these paths, for a batch at a time
 *
 * Reads every .html and .js under games/ and lib/hub/examples/. A copy is
 * replaced only when it is exactly a released client (scripts/lib/hub-client.mjs),
 * so an edited one is listed and left alone. Clients only add (lib/hub/README.md,
 * Versions), so a game on an older client keeps working: upgrade when a game
 * should use something new, then run scripts/hub-check.mjs on a few of them
 * before pushing.
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describeClient, findClients, upgradeText } from './lib/hub-client.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WRITE = process.argv.includes('--write');
const ONLY = process.argv.slice(2).filter((a) => !a.startsWith('--')).map((a) => path.resolve(ROOT, a));
const SKIP = new Set(['node_modules', '.git', '__MACOSX']);
const wanted = (file) => !ONLY.length || ONLY.some((p) => file === p || file.startsWith(p + path.sep));

async function* files(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* files(full);
    else if (/\.(html?|m?js)$/i.test(entry.name)) yield full;
  }
}

const current = describeClient(await readFile(path.join(ROOT, 'lib/hub/session.js'), 'utf8'));
const tally = new Map();
const edited = [];
let upgraded = 0;

for (const dir of ['games', 'lib/hub/examples']) {
  for await (const file of files(path.join(ROOT, dir))) {
    if (!wanted(file)) continue;
    const text = await readFile(file, 'utf8');
    if (!text.includes('aihub-session')) continue;
    const rel = path.relative(ROOT, file);
    const copies = findClients(text);
    for (const copy of copies) {
      const label = copy.pristine ? copy.version : `${copy.version ?? '?'} (edited)`;
      tally.set(label, (tally.get(label) || 0) + 1);
      if (!copy.pristine) edited.push(rel);
    }
    if (!WRITE) continue;
    const result = upgradeText(text, current);
    if (!result.changed) continue;
    await writeFile(file, result.text);
    upgraded++;
  }
}

console.log(`lib/hub/session.js is ${current.version}`);
for (const [label, n] of [...tally].sort()) console.log(`  ${String(n).padStart(5)}  ${label}`);
if (edited.length) {
  console.log(`\nEdited copies, left alone (paste the client unmodified):`);
  for (const rel of [...new Set(edited)]) console.log(`  ${rel}`);
}
if (WRITE) console.log(`\n${upgraded} file${upgraded === 1 ? '' : 's'} upgraded to ${current.version}`);
