# Current GitHub games and Living Details correction

Imported 21 absent GitHub games/labs, one proven Tideline successor, and the
playable Living Details Library study: **520 → 543 catalogue entries**. The
GitHub scope is current default branches, not the October 9–13 Library window.
All 38 source heads were checked again after building and matched the recorded
commits. Source repositories were not pushed or edited; generated tracked build
output was restored after staging.

`2026-10-13-github-audit.json` records every requested repository and disposition.
The plan/report and registry hash entry HTML **and every packaged dependency**.
An immediate rerun reports **23 unchanged, zero imported**, with registry and
added dates byte-identical. Existing game bytes, URLs, save identifiers and all
520 prior catalogue entries remain available. Original source dates are retained.

Tideline's installed HTML exactly matches `index.html` at reachable Git ancestor
`b30418f9b143021c1d064f50db9372b55abab86b`. That evidence annotates its seeded
registry identity; the descendant is `import-newer`. Both build URLs remain
available; this registry phase does not automatically retire old catalogue tiles.
Dust & Mercy's Snowbound campaign is distinct from the installed Bitter Creek
Run, with different campaign content and save namespaces. Crown & Cinder and
Crown & Cinders are distinct games, not versions inferred from similar titles.

Living Details was incorrectly excluded earlier because it was labelled a
preview. It is a standalone playable environment study: movement, ten rooms,
object interactions, journal and separate saves. Movement, room change, journal
and its `threads-living-details-study:v1` storage were verified. This correction
uses the previously materialized exact Library ID and original timestamp.

## Exceptions and scope

- Depthward is byte-identical and G-Zero is older; neither is re-imported.
- RobotWarrior, Stillpoint, BC64, 2D Lab, Ashfall Incarnate and AXIOM lack a
  proven newer lineage relative to installed builds. Their working files remain.
- Agent Native Engine and BC65 are native projects. Four Grok projects require
  server runtimes and have no identified static HTML export. No database
  migrations, save/database exports or gameplay rewrites were performed.
- Geometric Lightfield's official build references a missing Sites Vite plugin.
  Neon Fare builds but its Vinext export fails under a static subdirectory.
- RBB's solo mode is included; its co-op server is not. Spawnforge's built-in
  creature sandbox works; filesystem watch/save requires its local editor server
  (`/__creatures` returns 404 here). Crownfall's absent optional audio is reported.
- Sites export remains separate and blocked by unavailable official helper
  assets in this executor. No Sites editing or publication occurred.

Packaging uses official build outputs. `github-packaging.json` (with this date
prefix) lists relative-base adjustments for static hosting; no save keys or
story/game logic were changed. No private backups, source `.env` files, database
files, source archives, or source maps were admitted.

## Verification

- Registry regression suite after review corrections: **15/15 passed**.
- Full Node suite after corrections: **195/195 passed**.
- Screenshot policy now matches optional admission: validate every available
  three-frame strip and report coverage instead of requiring screenshots for
  every entry. **510/543 have strips; 33 lack them**: 1 before these imports,
  9 added by PR5, 23 by this batch. This is increased missing coverage, not an
  unchanged failure. No screenshot baseline was regenerated.
- Bounded browser startup checks reached the staged entries. Isolated WebGL
  checks exercised available start controls, including Dust & Mercy, Crownfall,
  Oath of the Rose and Spawnforge's running creature scene. Detailed exceptions
  are in `2026-10-13-github-browser-checks.json`. Software GPU context loss and
  bounded interaction timeouts prevent claiming comprehensive gameplay tests.
- Dry run left the tracked repository diff unchanged; rerun preserved registry
  and added-date bytes and imported nothing. Existing timestamps were unchanged.

Example review without reading game source:

```sh
node -e 'const r=require("./docs/imports/2026-10-13-github-report.json"); console.log(r.counts, r.failed, r.needsBuild)'
node -e 'const r=require("./docs/imports/2026-10-13-github-audit.json"); console.log(r.counts); console.log(r.repositories.filter(x=>!x.action.startsWith("import")))'
```

## Corrective tooling review

Decision version 2 fixes provenance collisions across same-basename input roots
and multi-project ZIPs, preserves explicitly distinct identities against anonymous
seeded byte matches, and records confirmed byte-identical successor revisions
without game-file churn. Classification reads are size-bounded before loading
HTML; uppercase entry filenames normalize to the recorded `index.html` path;
missing metadata option values fail before import. Archive-retention instructions
and redirected JSON examples now match behavior.

This batch uses 23 unique top-level source labels, each with matching explicit
metadata. All 23 decisions were rechecked with the fixes and remain unchanged.
The earlier Library batch also used distinct source filenames; Cinderwing's
known identical build was intentionally excluded. No missed batch items were
found from the reported provenance-key collisions.
