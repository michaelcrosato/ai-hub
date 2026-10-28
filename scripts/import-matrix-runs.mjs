#!/usr/bin/env node
/**
 * Bring packaged gpt-matrix runs onto the wall.
 *
 * Each run's game is the single HTML file directly inside workspace/. The
 * file is renamed to GameTitle-SOURCE-model-effort-YYYYMMDD-HHMM.html and
 * handed to `scripts/ingest.mjs`, which skips byte-identical pages, refuses
 * to overwrite anything, and rewrites known Three.js and Rapier URLs.
 *
 *   node scripts/import-matrix-runs.mjs --dry-run
 *   node scripts/import-matrix-runs.mjs
 */

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { link, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { planMatrixRun, finalizeMatrixPlans, matrixPageText } from './lib/matrix-runs.mjs';
import { slugify } from './lib/parse.mjs';
import { ROOT, GAMES_DIR } from './scan.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUNS = process.env.MATRIX_RUNS || '/home/micha/dev/gpt-matrix/data/runs';
const STAGE_ROOT = process.env.MATRIX_STAGE || path.join(process.env.HOME || '/home/micha', '.cache/ai-hub-matrix-intake');
const STAGE = path.join(STAGE_ROOT, 'pages');
const DRY = process.argv.includes('--dry-run');
const HTML = /\.html?$/i;

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

async function walkHtml(dir, out) {
  let entries;
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
  let n = 0;
  for (const abs of files) {
    const data = await readFile(abs);
    installed.push({ sha256: sha256(data), destination: path.relative(GAMES_DIR, abs).split(path.sep).join('/') });
    n += 1;
    if (n % 200 === 0) console.log(`  hashed ${n} installed pages`);
  }
  console.log(`  hashed ${installed.length} installed pages`);
  return installed;
}

function excerpt(buf) {
  return matrixPageText(buf);
}

async function planRuns() {
  const ids = (await readdir(RUNS, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  const drafts = [];
  for (const runId of ids) {
    const runDir = path.join(RUNS, runId);
    const workspace = path.join(runDir, 'workspace');
    let entries = [];
    try {
      entries = await readdir(workspace, { withFileTypes: true });
    } catch {
      entries = [];
    }
    const files = entries.filter((entry) => entry.isFile() && HTML.test(entry.name)).map((entry) => `workspace/${entry.name}`);
    let finalization = null;
    try {
      finalization = JSON.parse(await readFile(path.join(runDir, 'finalization.json'), 'utf8'));
    } catch {
      finalization = null;
    }
    const packaged = files.length === 1 ? path.join(workspace, files[0].slice('workspace/'.length)) : null;
    let pageText = '';
    let contentHash = '';
    let modifiedAt = null;
    let sourceBytes = 0;
    if (packaged) {
      const data = await readFile(packaged);
      pageText = excerpt(data);
      contentHash = sha256(data);
      sourceBytes = data.length;
      modifiedAt = (await stat(packaged)).mtime.toISOString();
    }
    const plan = planMatrixRun({ runId, files, pageText, finalization, contentHash, modifiedAt });
    drafts.push({ ...plan, sourceBytes, sourceFile: packaged });
  }
  return { ids, drafts };
}

function provenanceFor(plans) {
  const sources = {};
  for (const plan of plans) {
    if (plan.action !== 'import') continue;
    sources[`pages/${plan.destination}`] = {
      sourceKind: 'gpt-matrix-run',
      artifactId: plan.runId,
      sourceDate: plan.sourceDate,
    };
  }
  return { schemaVersion: 1, sources };
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
      else {
        try {
          resolve(JSON.parse(text));
        } catch (error) {
          reject(new Error(`ingest JSON: ${error.message}\n${text.slice(-2000)}`));
        }
      }
    });
  });
}

async function stagePlans(plans) {
  await rm(STAGE, { recursive: true, force: true });
  await mkdir(STAGE, { recursive: true });
  let linked = 0;
  for (const plan of plans) {
    if (plan.action !== 'import') continue;
    const dest = path.join(STAGE, plan.destination);
    try {
      await link(plan.sourceFile, dest);
    } catch {
      const { copyFile } = await import('node:fs/promises');
      await copyFile(plan.sourceFile, dest);
    }
    linked += 1;
  }
  await writeFile(path.join(STAGE_ROOT, 'provenance.json'), JSON.stringify(provenanceFor(plans)));
  return linked;
}

function applyReport(plans, report) {
  const byFrom = new Map((report?.decisions || []).map((row) => [row.from, row]));
  return plans.map((plan) => {
    if (plan.action !== 'import') return plan;
    const row = byFrom.get(`pages/${plan.destination}`);
    if (!row) return { ...plan, action: 'failed', reason: 'missing from ingest report' };
    if (row.action === 'import' || row.action === 'import-newer') {
      return { ...plan, action: 'import', destination: row.destination || plan.destination, ingestAction: row.action };
    }
    if (row.action === 'unchanged' || row.action === 'skip-older' || row.action === 'record-revision') {
      return {
        action: 'unchanged',
        reason: row.action === 'unchanged' ? 'byte-identical to an installed game' : row.action,
        runId: plan.runId,
        packagedPath: plan.packagedPath,
        packagedName: plan.packagedName,
        contentHash: plan.contentHash,
        sourceBytes: plan.sourceBytes,
        sourceFile: plan.sourceFile,
        destination: row.destination || plan.destination,
        ingestAction: row.action,
      };
    }
    return { ...plan, action: 'failed', reason: row.action || 'ingest rejected the page', ingestAction: row.action };
  });
}

async function writeOverrides(plans) {
  const file = path.join(ROOT, 'data/overrides.json');
  const overrides = JSON.parse(await readFile(file, 'utf8'));
  let added = 0;
  let kept = 0;
  for (const plan of plans) {
    if (plan.action !== 'import' || !plan.overrides) continue;
    const slug = slugify(path.basename(plan.destination, path.extname(plan.destination)));
    plan.catalogueSlug = slug;
    if (overrides[slug]) {
      kept += 1;
      plan.overrideStatus = 'existing-left-in-place';
      continue;
    }
    overrides[slug] = plan.overrides;
    plan.overrideStatus = 'written';
    added += 1;
  }
  if (!DRY && added) await writeFile(file, `${JSON.stringify(overrides, null, 2)}\n`);
  return { added, kept };
}

function recordOf(plan) {
  return {
    runId: plan.runId,
    action: plan.action,
    reason: plan.reason,
    packagedPath: plan.packagedPath || null,
    packagedName: plan.packagedName || null,
    sourceFile: plan.sourceFile ? path.relative(RUNS, plan.sourceFile).split(path.sep).join('/') : null,
    sourceBytes: plan.sourceBytes || 0,
    sourceSha256: plan.contentHash || null,
    destination: plan.destination || null,
    catalogueSlug: plan.catalogueSlug || (plan.action === 'import' && plan.destination ? slugify(path.basename(plan.destination, path.extname(plan.destination))) : null),
    sourceDate: plan.sourceDate || null,
    dateBasis: plan.dateBasis || null,
    renamed: Boolean(plan.renamed),
    ingestAction: plan.ingestAction || null,
    overrideStatus: plan.overrideStatus || null,
    metadata: plan.action === 'import' ? plan.overrides : null,
  };
}

const { ids, drafts } = await planRuns();
console.log(`  planned ${ids.length} run directories`);
const installed = await installedPages();
let plans = finalizeMatrixPlans(drafts, installed);
const reasons = {};
for (const plan of plans) {
  const key = `${plan.action}: ${plan.reason}`;
  reasons[key] = (reasons[key] || 0) + 1;
}
console.log(reasons);
const long = plans.filter((plan) => plan.destination && plan.destination.length > 200);
if (long.length) {
  console.log(`  ${long.length} destination names exceed 200 characters`);
  for (const plan of long.slice(0, 5)) console.log(`    ${plan.destination.length} ${plan.destination}`);
}
const linked = await stagePlans(plans);
console.log(`  staged ${linked} pages (${DRY ? 'dry-run' : 'import'})`);
const report = await runIngest(DRY ? ['--dry-run'] : []);
const reportFile = path.join(STAGE_ROOT, DRY ? 'ingest-dry-run.json' : 'ingest-report.json');
await writeFile(reportFile, JSON.stringify({
  counts: report.counts,
  failed: report.failed,
  renamed: report.renamed,
  dependencies: report.dependencies,
  duplicates: report.duplicates,
}, null, 2));
plans = applyReport(plans, report);
const overrideCounts = await writeOverrides(plans);
const runs = plans.map(recordOf);
const seen = new Set(runs.map((row) => row.runId));
if (seen.size !== ids.length) throw new Error(`intake accounts for ${seen.size} of ${ids.length} runs`);
const counts = {};
for (const row of runs) counts[row.action] = (counts[row.action] || 0) + 1;
const audit = {
  schemaVersion: 1,
  batchDate: '2026-10-27',
  preparedAt: new Date().toISOString(),
  dryRun: DRY,
  runsRoot: RUNS,
  filenamePolicy: 'GameTitle-SOURCE-model-effort-YYYYMMDD-HHMM.html from the page title, inspiration, requested model, effort, and the run start. The shared package stamp is not used as the run time.',
  counts: { runs: ids.length, ...counts, overridesAdded: overrideCounts.added, overridesKept: overrideCounts.kept },
  ingest: report.counts,
  unsupportedLibraries: report.dependencies || [],
  runs,
};
const auditPath = DRY
  ? path.join(STAGE_ROOT, 'audit-dry-run.json')
  : path.join(ROOT, 'docs/imports', counts.import ? '2026-10-27-matrix-runs.json' : '2026-10-27-matrix-runs-rerun.json');
await writeFile(auditPath, JSON.stringify(audit, null, 2));
console.log(JSON.stringify(audit.counts, null, 2));
console.log(`  ingest report ${reportFile}`);
console.log(`  audit ${auditPath}`);
