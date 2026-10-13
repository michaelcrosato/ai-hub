#!/usr/bin/env node
// Seed only facts supported by the audit. No title/engine-key identity inference.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from './scan.mjs';
import { emptyRegistry, fingerprint, digest, PIPELINE } from './lib/import-registry.mjs';
const auditPath = 'docs/imports/2026-10-13-remainder-audit.json';
const audit = JSON.parse(await readFile(path.join(ROOT, auditPath), 'utf8'));
const registry = emptyRegistry();
const exceptions = [];
async function tree(dir, prefix = '') {
  const rows = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const rel = prefix + e.name;
    if (e.isDirectory()) rows.push(...await tree(path.join(dir, e.name), rel + '/'));
    else if (e.isFile()) rows.push([rel, await readFile(path.join(dir, e.name))]);
  }
  return rows;
}
for (const d of audit.decisions) {
  if (!d.destination || !d.entry_sha256 || !d.destination.startsWith('games/')) continue;
  const destination = d.destination.slice(6);
  try {
    if (digest(await readFile(path.join(ROOT, d.destination))) !== d.entry_sha256) throw new Error('audit entry hash differs');
    const singlePage = !destination.endsWith('/index.html');
    const root = path.posix.dirname(destination);
    const output = fingerprint(new Map(singlePage ? [['index.html', await readFile(path.join(ROOT, d.destination))]] : await tree(path.join(ROOT, 'games', root))));
    registry.records.push({ pipelineVersion: PIPELINE, provenance: {
      sourceKind: 'drive', artifactId: d.source_id, ...(d.source_commit ? { revision: d.source_commit } : {}),
      sourceDate: d.source_modified,
      // An artifact ID is not necessarily a game identity. Retain project hints as evidence only.
    }, raw: { sha256: d.source_sha256, kind: 'audited-source-artifact', files: null }, output,
    root, destination, ...(singlePage ? { singlePage: true } : {}),
    audit: { file: auditPath, decision: d.decision, reason: d.reason, projectIdHint: d.project_id ?? null,
      sourceVersion: d.source_version, replacement: d.replacement ?? null, evidence: d.evidence ?? null } });
  } catch (e) { exceptions.push({ source: d.source_id, destination, reason: e.message }); }
}
const target = path.join(ROOT, 'data/import-registry.json');
// Never replace an evolved registry.
try { await readFile(target); throw new Error('Registry already exists; seed only into an uninitialized checkout'); }
catch (e) { if (e.code !== 'ENOENT') throw e; }
if (!process.argv.includes('--dry-run')) await writeFile(target, JSON.stringify(registry, null, 2) + '\n');
console.log(JSON.stringify({ schemaVersion: 1, records: registry.records.length, exceptions }, null, 2));
