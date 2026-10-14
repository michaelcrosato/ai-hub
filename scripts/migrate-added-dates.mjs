#!/usr/bin/env node
/** One-time repair of the legacy source-date-as-added catalogue. Run from a
 * full clone. Source timestamps survive separately and repeat runs are inert. */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gitAddedDates } from './lib/dates.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sorted = (value) =>
  JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))), null, 2) + '\n';

export async function migrateAddedDates(directory = root) {
  const addedFile = path.join(directory, 'data/added.json');
  const sourceFile = path.join(directory, 'data/source-dates.json');
  const added = JSON.parse(await readFile(addedFile, 'utf8'));
  let sourceDates;
  try {
    sourceDates = JSON.parse(await readFile(sourceFile, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    sourceDates = {};
  }
  const history = await gitAddedDates(directory, { requireFullHistory: true });
  const missing = Object.keys(added).filter((file) => !history.has(file));
  if (missing.length)
    throw new Error(`No Git import date for ${missing.length} entries: ${missing.slice(0, 5).join(', ')}`);
  let changed = 0;
  for (const [file, priorDate] of Object.entries(added)) {
    sourceDates[file] ??= priorDate;
    const imported = history.get(file);
    if (Date.parse(priorDate) !== Date.parse(imported)) changed++;
    added[file] = imported;
  }
  await writeFile(sourceFile, sorted(sourceDates));
  await writeFile(addedFile, sorted(added));
  return { entries: Object.keys(added).length, changed };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  console.log(await migrateAddedDates());
}
