# Import registry and structured plans

A runnable HTML file remains sufficient. Metadata and screenshots are optional.
Existing game files, destinations, and save identifiers are never overwritten.

```sh
pnpm ingest /tmp/exports --dry-run --json > /tmp/import-plan.json
pnpm ingest /tmp/exports --metadata /tmp/provenance.json --json > /tmp/import-report.json
node -e 'const r=require("/tmp/import-report.json"); console.log(r.counts, r.failed, r.needsBuild, r.decisions.filter(x=>/review|older/.test(x.action)))'
```

`--json` emits one JSON object instead of human logging. `counts`, `decisions`,
`failed`, `needsBuild`, `dependencies`, and `leftovers` let reviewers inspect
exceptions without reading game source. Use `node scripts/ingest.mjs` for stdout
consumers if your package manager prints its own command banner. Dry run writes
no repository files (ZIP containers may use automatically removed OS temp files).
Shell redirection is the caller's responsibility; write plans outside the checkout.

Optional provenance format (keys match `from` in a dry-run plan):

```json
{
  "schemaVersion": 1,
  "sources": {
    "exports/my-game": {
      "gameId": "owner-confirmed:my-game-main-branch",
      "identityEvidence": "Owner confirmed this artifact is the next build of this game, separate from its side story",
      "sourceKind": "sites",
      "artifactId": "exact-source-id",
      "revision": "revision-3",
      "predecessorRevision": "revision-2",
      "sourceDate": "2026-10-13T16:00:00Z"
    }
  }
}
```

Identity is explicit and requires evidence. Do not supply a title, filename,
shared engine key, or save-key prefix as identity evidence. Artifact IDs and
revisions are retained separately; source dates must be original source dates,
not download or backup-upload times. Revision strings are opaque, never sorted
as version numbers. A known identity with older/equal date is `skip-older`;
changed content with uncertain lineage is `review-lineage`. A later dated,
explicit successor is `import-newer`, written to a new destination with its
predecessor recorded in the report. This phase does not retire older URLs or
change the catalogue's version grouping automatically.

`data/import-registry.json` uses schema 1 and pipeline `ingest-bundle-v1`.
SHA-256 fingerprints include sorted relative paths, byte lengths, and hashes
of every runtime bundle file, both raw and transformed. Changed assets or JS
therefore cannot disappear behind an unchanged index hash. Matching installed
files are verified before skipping. Single-page names are canonicalized for
content comparison; explicitly distinct identities are kept even with identical
bytes. Registry data is only rewritten when records change. There is no persistent
mtime-based cache. Changing transformations requires a pipeline-version migration.

The committed seed contains 203 audit-backed source/destination records from
`docs/imports/2026-10-13-remainder-audit.json`, verified against installed entry
hashes. These are records, not 203 additional games. Raw hashes are explicitly
marked as audited source-artifact hashes, not reconstructed raw bundle hashes.
Unsupported game identity or revision lineage is left unset. Audit reasons,
replacement references, and evidence remain available; project IDs are hints,
not inferred identity. `node scripts/seed-import-registry.mjs --dry-run` regenerates
the seed plan only in an uninitialized checkout; it refuses to overwrite a registry.

Limits: 10,000 files and 95 MiB per project/archive (including expanded ZIP size).
Malformed/oversized input and recognizable save/database files are reported;
healthy sibling inputs continue. Opaque leftover archives are no longer copied
into `sources/`. Inspect exports and supply runtime-only content: filename
checks cannot establish that arbitrary JSON contains no private data.
No source deletion, network publication, game execution, screenshot admission
check, or numerical token-savings claim is part of this phase.
