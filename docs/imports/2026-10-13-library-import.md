# October 9–13 Library import

Window: October 9 00:00 through October 13 10:00 America/Los_Angeles
(2026-10-09T07:00:00Z through 2026-10-13T17:00:00Z).

Materialized the 11 exact Library IDs supplied by the source inventory using the
Library connector, downloaded their signed transfers into this executor, verified
sizes and SHA-256, and applied returned Library version xattrs. No parent-local
path was used as evidence. Original Library timestamps are in the provenance and
added-date records. Existing added dates and game bytes remain unchanged.

- Nine standalone runnable games imported, byte-identical to their source HTML.
- Cinderwing is byte-identical to `games/drive-cinderwing/index.html`; skipped.
- Living Details — Letters Across Water is a preview study; excluded.
- Catalogue: 511 → 520 games. No older builds, URLs, or save keys were replaced.
- Browser checks: all nine render canvas elements, accept a start control, and
  produce no captured page errors or failed requests during the short smoke test.
  This is not a full playthrough.
- Immediate real rerun: zero imports, ten unchanged inputs, registry and added
  dates byte-identical. Plans, reports, provenance and source hashes accompany
  this note.

Distinct game identities are supported by embedded source declarations and
implementation/namespace comparison, not title similarity. Morrowglass is the
recovered-v2 Living Places branch. Hollow Bell is the first-person Drowned Oath
branch. Rain Ledger is an independent follow-on case. Witness Roads, After Hours,
Broken Seals, and Work of Returning explicitly declare standalone companion or
side-story scope. None supersedes its related published Site.

Remaining blockers: 22 Sites qualified in the parent inventory, but the tested
Sites archive could not be materialized through Library: `404: Library file
ownership could not be verified`. No alternate route around that boundary was
attempted. A supported Sites source-export capability is still needed. Current
cloud skill packages are unavailable in this executor (`skill package is not
available`), so source access relied on exposed tool schemas. Browser-chat content
search was separately denied because memory is disabled; no denied chat contents
were accessed. Coverage is limited to the supplied accessible Library artifacts,
not every browser conversation or the pending Sites.

Validation caveat: the existing frame-strip test failed on untouched game content
at 510/511 before imports. New HTML games remain eligible without screenshots;
this batch does not change that admission rule or manufacture strips to satisfy it.
