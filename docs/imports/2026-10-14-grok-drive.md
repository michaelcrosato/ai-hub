# Recursive Grok Drive import

Imported 67 runnable browser games from Drive folder
`1KhS2PEBoe4jA9gesoqE6_E9RHf9Z8ww-`, bringing the catalogue from 542 to 609.
The source inventory includes all 519 files (5,595,804,772 bytes), including
the 60 HTML files in `roundup-2026-10-10`. No date cutoff was applied.

The existing 3,539 game files remain byte-identical. All 542 previous catalogue
entries retain their paths, builds and added dates. No existing build was
superseded. Drive creation/modification timestamps are preserved in the audit
as upload metadata; unknown original source dates remain unknown.

## Decisions and exceptions

| Source-file disposition | Count |
| --- | ---: |
| Imported | 67 |
| Complete runtime duplicate of an admitted export | 6 |
| Server-backed project needing a static export | 393 |
| Multipart members, reassembled into 14 verified archives | 34 |
| Manifests, README instructions and historical progress metadata | 11 |
| Corrupt ZIPs | 2 |
| AdventureForge exports with unresolved version overlap | 2 |
| LYNX exports failing nested-path routing | 2 |
| Empty project exports | 2 |

All 14 reassembled archives passed ZIP CRC checks; the eight supplied SHA-256
checksums matched. Those 14 logical projects also need static exports, in
addition to the 393 ordinary ZIPs listed above. Five historical failed exports
and one successful-but-missing manifest export are recorded separately; they
are not counted as files found in this folder.

The seven admitted packaged exports are Lumen Isle, Golden Hour Coaster,
Iso Pixel, Farlane, Hero's Quest, Sunharbor and AdventureForge. AdventureForge
uses the documented standalone client build inside the illustrated Zork
archive. Its human-play interface works locally. The overlapping export with
an optional Grok service is retained outside the repository for lineage review;
upload dates do not establish which version is newer. No migrations, servers,
AI service provisioning or source-project ports were performed.

## Packaging and validation

Existing embedded WOFF2/JPEG bytes were extracted into local assets and
deduplicated within each of the 60 HTML games. AdventureForge's CSS PNG was
likewise extracted. Four included PNGs received Pillow `optimize=True` with
decoded dimensions, pixels and alpha verified identical. For these 61 packages,
size fell from **118,543,324 to 101,779,677 bytes**: **16,763,647 bytes saved**.
There was no art generation, lossy quality reduction, audio removal or gameplay
change. The original source files remain outside the repository.

Included model/texture URLs, Vite dynamic preloads and Sunharbor's Havok WASM
URLs were localized for game subdirectories. Fonts retain WOFF2 format, images
retain their original formats, and browser checks found no missing runtime
assets or JavaScript errors in the 67 admitted games. Checks cover startup,
available start controls and brief keyboard interaction, not complete playthroughs.
Turnglass's automated start-button click timed out after a successful initial
render; that limitation is recorded. Screenshots remain optional.

The importer also now ignores example script tags inside inline script/style
bodies and HTML comments when checking missing dependencies. Six runnable
standalone games had previously been misclassified as needing a build. A
regression test also confirms genuinely missing scripts are still rejected.

Validation: 197 tests pass; repeat ingestion returns **67 unchanged, zero
imports**, with the registry and added-date files byte-identical. Existing
files and catalogue entries were compared against the pre-import snapshot.
Imported bundles disable Git text normalization so their checked-in bytes
match registry fingerprints. Source archives, environment files, databases,
save backups and conversation exports are not published.

## Reports and rerun

- `2026-10-14-grok-drive-audit.json`: every source artifact, raw hashes,
  timestamps, multipart verification, exceptions, optimization and browser checks.
- `2026-10-14-grok-drive-import-report.json`: versioned importer decisions and
  complete prepared/output bundle fingerprints.
- `2026-10-14-grok-drive-rerun-report.json`: unchanged rerun decisions.
- `2026-10-14-grok-drive-verification.json`: preservation and test evidence.

Prepared runtime inputs and provenance remain in the import executor. Raw
artifact hashes in the audit are distinct from prepared runtime bundle hashes
in the registry. No identity or successor claim is inferred from a title,
filename or shared engine save prefix.

```sh
node scripts/ingest.mjs /workspace/drive-grok-runtime/candidates \
  --metadata /workspace/drive-grok-audit/candidate-metadata.json \
  --dry-run --json > /tmp/grok-plan.json
node -e 'const r=require("/tmp/grok-plan.json"); console.log(r.counts, r.failed, r.needsBuild)'
```
