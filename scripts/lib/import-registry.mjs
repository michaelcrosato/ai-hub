import { createHash } from 'node:crypto';

export const SCHEMA = 1;
export const PIPELINE = 'ingest-bundle-v1';
export const digest = data => createHash('sha256').update(data).digest('hex');
export const emptyRegistry = () => ({ schemaVersion: SCHEMA, pipelineVersion: PIPELINE, records: [] });
export function fingerprint(files) {
  const entries = [...files].map(([name, data]) => ({ path: name, sha256: digest(data), bytes: data.length }))
    .sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  return { sha256: digest(JSON.stringify(entries)), files: entries };
}
export function provenance(value = {}) {
  const result = {};
  for (const key of ['gameId', 'identityEvidence', 'sourceKind', 'artifactId', 'revision', 'sourceDate', 'predecessorRevision']) {
    if (value[key] != null) result[key] = String(value[key]);
  }
  if (result.gameId && !result.identityEvidence) throw new Error('gameId requires explicit identityEvidence; titles and engine keys are insufficient');
  if (result.sourceDate && !Number.isFinite(Date.parse(result.sourceDate))) throw new Error('invalid sourceDate');
  return result;
}
export function decide(records, candidate) {
  const identity = candidate.provenance.gameId;
  const related = identity ? records.filter(r => r.provenance?.gameId === identity) : [];
  const exact = records.find(r => r.pipelineVersion === PIPELINE && r.output.sha256 === candidate.output.sha256 &&
    (!identity || r.provenance?.gameId === identity));
  if (!related.length) return exact ? { action: 'unchanged', destination: exact.destination } : { action: 'import' };
  const prior = related.at(-1);
  const old = prior.provenance, next = candidate.provenance;
  // A repeated, known revision needs no registry churn. Bytes alone cannot certify a new revision.
  if (exact && (!next.revision || related.some(r => r.provenance.revision === next.revision && r.output.sha256 === candidate.output.sha256))) {
    return { action: 'unchanged', destination: exact.destination };
  }
  if (old.sourceDate && next.sourceDate && Date.parse(next.sourceDate) <= Date.parse(old.sourceDate)) {
    return { action: 'skip-older', destination: prior.destination };
  }
  if (old.revision && next.predecessorRevision === old.revision && old.sourceDate && next.sourceDate &&
      Date.parse(next.sourceDate) > Date.parse(old.sourceDate)) {
    return exact ? { action: 'record-revision', destination: exact.destination, predecessor: prior.destination }
      : { action: 'import-newer', predecessor: prior.destination };
  }
  return { action: 'review-lineage', destination: prior.destination };
}
