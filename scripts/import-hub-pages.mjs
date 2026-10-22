#!/usr/bin/env node
/**
 * Bring cc-hub and gpt-hub pages that are not already on the wall into games/.
 *
 *   node scripts/import-hub-pages.mjs --dry-run
 *   node scripts/import-hub-pages.mjs
 *
 * Already on the wall: the live SHA-256 matches a page under games/, or the
 * 2026-10-19 intake records that source file, the live bytes still equal
 * sourceSha256, and the recorded destination still exists. Known Three.js
 * and Rapier URLs are rewritten by scripts/ingest.mjs. Nothing is overwritten.
 */

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { planHubPage, settleHubPlans } from './lib/hub-pages.mjs';
import { slugify } from './lib/parse.mjs';
import { GAMES_DIR, ROOT } from './scan.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CC = process.env.CC_HUB || '/home/micha/dev/cc-hub';
const GPT = process.env.GPT_HUB || '/home/micha/dev/gpt-hub';
const STAGE_ROOT = process.env.HUB_PAGES_STAGE || path.join(process.env.HOME || '/home/micha', '.cache/ai-hub-hub-pages');
const STAGE = path.join(STAGE_ROOT, 'pages');
const DRY = process.argv.includes('--dry-run');
const HTML = /\.html?$/i;
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

async function walkHtml(dir, out) {
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) await walkHtml(abs, out);
    else if (entry.isFile() && HTML.test(entry.name)) out.push(abs);
  }
}

async function installedPages() {
  const files = [];
  await walkHtml(GAMES_DIR, files);
  const installed = [];
  for (const abs of files) {
    const data = await readFile(abs);
    installed.push({ sha256: sha256(data), destination: path.relative(GAMES_DIR, abs).split(path.sep).join('/') });
  }
  return installed;
}

function excerpt(buf) {
  return buf.subarray(0, Math.min(buf.length, 80_000)).toString('utf8');
}

async function candidates() {
  const list = [];
  const gptRoot = await readdir(GPT, { withFileTypes: true });
  for (const entry of gptRoot) {
    if (entry.isFile() && HTML.test(entry.name)) {
      list.push({ abs: path.join(GPT, entry.name), sourcePath: `gpt-hub/${entry.name}` });
    }
  }
  list.push({
    abs: path.join(CC, 'arc-the-ladle/arc-the-ladle.html'),
    sourcePath: 'cc-hub/arc-the-ladle/arc-the-ladle.html',
  });
  list.push({
    abs: path.join(GPT, 'Starfoxglove-Starfox64-gpt-6-astra-20261018-1745/play.html'),
    sourcePath: 'gpt-hub/Starfoxglove-Starfox64-gpt-6-astra-20261018-1745/play.html',
  });
  return list.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
}

function runIngest(extra) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(HERE, 'ingest.mjs'), STAGE, '--metadata', path.join(STAGE_ROOT, 'provenance.json'), '--json', ...extra], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    const chunks = [];
    child.stdout.on('data', (chunk) => chunks.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      const text = Buffer.concat(chunks).toString('utf8');
      if (code !== 0) reject(new Error(`ingest exited ${code}\n${text.slice(-2000)}`));
      else resolve(JSON.parse(text));
    });
  });
}

const intakeDoc = JSON.parse(await readFile(path.join(ROOT, 'docs/imports/2026-10-19-root-html-intake.json'), 'utf8'));
const intake = intakeDoc.artifacts.filter((row) => row.sourceRoot === 'cc-hub' || row.sourceRoot === 'gpt-hub');
const installed = await installedPages();
const installedNames = new Set(installed.map((entry) => entry.destination.split('/').pop()));
const before = new Map();
for (const row of intake) {
  const name = String(row.destination).split('/').pop();
  const abs = path.join(GAMES_DIR, name);
  try {
    before.set(name, sha256(await readFile(abs)));
  } catch {
    before.set(name, null);
  }
}

const drafts = [];
for (const item of await candidates()) {
  const data = await readFile(item.abs);
  const info = await stat(item.abs);
  drafts.push({
    ...planHubPage({
      sourcePath: item.sourcePath,
      pageText: excerpt(data),
      sha256: sha256(data),
      modifiedAt: info.mtime.toISOString(),
      intake,
      installed,
    }),
    sourceFile: item.abs,
    sourceBytes: data.length,
  });
}
const plans = settleHubPlans(drafts, [...installedNames]);
const counts = {};
for (const plan of plans) counts[plan.action] = (counts[plan.action] || 0) + 1;
console.log(counts);

await rm(STAGE, { recursive: true, force: true });
await mkdir(STAGE, { recursive: true });
const sources = {};
let staged = 0;
for (const plan of plans) {
  if (plan.action !== 'import') continue;
  await copyFile(plan.sourceFile, path.join(STAGE, plan.destination));
  sources[`pages/${plan.destination}`] = { sourceKind: 'hub-page', artifactId: plan.sourcePath, sourceDate: plan.sourceDate };
  staged += 1;
}
await writeFile(path.join(STAGE_ROOT, 'provenance.json'), JSON.stringify({ schemaVersion: 1, sources }));
console.log(`staged ${staged}`);
const report = await runIngest(DRY ? ['--dry-run'] : []);
await writeFile(path.join(STAGE_ROOT, DRY ? 'ingest-dry-run.json' : 'ingest-report.json'), JSON.stringify({
  counts: report.counts,
  failed: report.failed,
  renamed: report.renamed,
  dependencies: report.dependencies,
  duplicates: report.duplicates,
}, null, 2));

const byFrom = new Map();
for (const row of report.pages || []) byFrom.set(path.basename(row.from), row);
for (const row of report.decisions || []) byFrom.set(path.basename(row.from || ''), row);
const overrides = JSON.parse(await readFile(path.join(ROOT, 'data/overrides.json'), 'utf8'));
let overridesAdded = 0;
const records = [];
for (const plan of plans) {
  if (plan.action !== 'import') {
    records.push({
      sourcePath: plan.sourcePath,
      action: plan.action,
      reason: plan.reason,
      sourceSha256: plan.sha256 || null,
      destination: plan.destination || null,
    });
    continue;
  }
  const landed = (report.pages || []).find((row) => row.from.endsWith(plan.destination));
  const destination = landed ? landed.rel : plan.destination;
  const abs = path.join(GAMES_DIR, destination);
  let installedSha = null;
  if (!DRY) {
    try {
      installedSha = sha256(await readFile(abs));
    } catch {
      installedSha = null;
    }
  }
  const catalogueSlug = slugify(path.basename(destination, path.extname(destination)));
  if (!overrides[catalogueSlug] && plan.overrides) {
    overrides[catalogueSlug] = plan.overrides;
    overridesAdded += 1;
  }
  records.push({
    sourcePath: plan.sourcePath,
    action: landed ? 'import' : (DRY ? 'import' : 'failed'),
    reason: plan.reason,
    sourceSha256: plan.sha256,
    installedSha256: installedSha,
    destination,
    catalogueSlug,
    sourceDate: plan.sourceDate,
    dateBasis: plan.dateBasis,
    timeBasis: plan.timeBasis,
    metadata: plan.overrides,
  });
}
if (!DRY && overridesAdded) await writeFile(path.join(ROOT, 'data/overrides.json'), `${JSON.stringify(overrides, null, 2)}\n`);

const afterChanged = [];
if (!DRY) {
  for (const [name, hash] of before) {
    let now = null;
    try {
      now = sha256(await readFile(path.join(GAMES_DIR, name)));
    } catch {
      now = null;
    }
    if (now !== hash) afterChanged.push(name);
  }
}

const audit = {
  schemaVersion: 1,
  batchDate: '2026-10-22',
  preparedAt: new Date().toISOString(),
  dryRun: DRY,
  filenamePolicy: 'GameTitle-SOURCE-model-effort-YYYYMMDD-HHMM.html. Explicit filename or source-note dates are kept. A missing time is the source file modification time in America/Vancouver.',
  counts: { candidates: plans.length, ...counts, staged, overridesAdded, intakeDestinationsChanged: afterChanged.length },
  intakeDestinationsChanged: afterChanged,
  ingest: report.counts,
  unsupportedLibraries: report.dependencies || [],
  records,
};
const auditPath = path.join(ROOT, 'docs/imports', DRY ? '2026-10-22-cc-gpt-hub-pages-dry-run.json' : '2026-10-22-cc-gpt-hub-pages.json');
if (!DRY) await writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`);
await writeFile(path.join(STAGE_ROOT, 'audit.json'), `${JSON.stringify(audit, null, 2)}\n`);
console.log(JSON.stringify(audit.counts));
if (afterChanged.length) console.log('CHANGED INTAKE', afterChanged.join('\n'));
