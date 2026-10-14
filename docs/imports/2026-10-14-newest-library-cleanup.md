# Newest ordering, screenshots and catalogue cleanup

All 617 catalogue entries now have a complete real screenshot strip and a genre
and shelf category. This pass adds 108 missing strips, replaces 23 recent Drive
strips whose cover showed startup/loading/error state, and fills all 237 recent
import category gaps. Every published strip contains three decoded 640×480 JPEGs
at the shared quality 58 setting: 1,851 frames across the whole catalogue.

Newest first now means when a game joined AI Hub. The importer previously put
source creation/modification dates in the added field, which made older import
batches outrank games added later. The migration recovers first arrival from
complete Git history for all 624 entry files, follows recognized renames, and
preserves the previous source timestamps in `data/source-dates.json`. Original
registry provenance remains unchanged. Future imports persist arrival and source
dates separately. Source chronology/version still selects the current build;
all 617 selected game paths remain unchanged by the date migration.

The actual Sort → Newest first click was verified in a fresh browser in both
source-stack and no-stack views. The latest five GitHub games lead, followed by
Cinder Choir and Threads, then Morrowglass, then the earlier Grok batch. Source
stacks use their newest representative. Source dates are excluded from filter
rails; save keys and hidden/restricted flags remain unchanged.

The 101 non-Drive and 136 Drive classifications are based on installed source,
About/help text, declared inspirations and rendered evidence. Every entry has
Game/Tech demo/Tool and a genre; editors and rendering showcases are on the
Tools/demos shelf. Unknown model variants stay unset. Shared source labels and
franchises are normalized so source stacks and exact catalogue facets agree.
Final Fantasy Tactics is the credit-backed inspiration for the misleadingly
named `github-ffxii` import. Metadata and input lines reflect actual capabilities.

Screenshots were captured from the real runtimes and visually inspected. Blank,
loading and adapter-error images were rejected. Slow software renderers needed
held keys or explicit onboarding controls. Capital Strike, Polyreaver, Final
Fealty, Riftbound and Flareline were captured with headless Windows Chrome on
hardware WebGPU. The remaining captures used local headless Chrome/Chromium.
The new and replaced strips' published hashes, source-backed classification
proofs, date/order evidence and repairs are in
`2026-10-14-newest-library-audit.json`. Local raw captures/contact sheets are
ignored under `.cache/newest-audit/`.

Two shipped favicon paths were corrected to their existing adjacent crest.svg
files (`github-bk`, `github-crown-of-ash-gpt6`); installed registry output hashes
were refreshed while raw source hashes/provenance stayed intact. No gameplay
logic was changed. Iso Pixel's optional character model and Crownfall's optional
placeholder audio remain source limitations. Pipkin begins through its visible
mouse control; its source title consumes keyboard confirm, so that limitation is
recorded rather than claiming a keyboard start. Full campaigns or every browser
backend were not tested by a screenshot pass.

Validation: hub build and all 202 tests pass. All 617 records have genre/type,
cover frame zero and three real JPEG files. All 1,851 JPEGs decode at the expected
size, and access flags match the previous catalogue. Regression tests cover
first-arrival migration, rename/copy behavior, old source dates in new imports,
idempotent import reruns, unchanged build selection and newest source stacks.
