# Latest default-branch game imports

Base: `2b52222b` (includes Dust & Mercy PR #32 and the audio inventory work).

| Repository | Main commit | Disposition |
| --- | --- | --- |
| starfox-riftlight-g47cli | `0b3d3427c7cb7f837de6e6c8335c219b57306b4b` | Added Vesper Lane, 8 runtime files |
| ac-riftlight-g47cli | `af4b7a60cdc5a2664cd851362a2de2cbebc510ba` | Added Ochre Veil, 14 runtime files |
| 90spcrpg | `a8e595e6d63387d6716288bfd12c6ca45b080117` | Ashwick already current; preserved |
| policegame-2 | `b6c533378f4588e595bd1e498e78bee982e09f18` | Harbor Patrol already current; preserved |
| policegame | `65bcdd9f5db7cfb5cd818c0f9727c720ac3e245f` | Pier 17 already current; preserved |

## Provenance and packaging

All 127 installed files across the three existing imports match their registry
SHA-256 hashes and current source bytes. Rebuilt Harbor Patrol and Ashwick using
their existing tools. Staging those exact runtime file sets through the existing
importer reports unchanged for all three. No replacement or duplicate is needed.
Policegame PR #5 (Bellwether city prototype) remains open and unmerged at
`f6a9c17034eaabcea19d8b52f482b426d01b6f1c`; it was not imported.

New identities are supported by source repository and campaign content:
Lark/Glass Trench and its branching flight stages; Ochre Ward/Salt Quay and
Merro Voss's three-investigation memory. Existing games contain neither campaign's
markers. Shared inspirations and engine are not treated as identity.

Imported the modular HTML entries, all required JS and engine license files.
Vesper's source symlink to its bundled engine is materialized as the same bytes.
Standalone duplicate HTML exports, examples, tests and authoring documentation
are excluded. No engine substitution, asset generation, recompression or gameplay
patches. All raw and installed bundle fingerprints match. Source repositories
were not changed. Existing game content, IDs, URLs, metadata, save keys and added
dates remain intact, including Dust & Mercy and distinct same-name games.

The existing importer records explicit GitHub provenance and dependency hashes.
A repeat dry-run over all five current runtime packages returns five unchanged,
zero imports, zero failures, zero build requirements and no unused metadata.

## Validation

- Vesper Lane: 26/26 source rules tests.
- Ochre Veil: 14/14 source rules tests.
- Ashwick: 139/139 checks, all three release stages, build and installed browser
  smoke checks at 1440×900 and 390×844 pass. Initial dependency absence was resolved
  by installing its pinned development dependency in the source checkout.
- Harbor Patrol: 50/50 tests, build, syntax and content validation pass. Installed
  browser start, keyboard movement and save/reload preserve the player's position.
- Pier 17: 138/138 tests, content validation and installed browser save suite pass,
  including legacy migration, recovery and resumable activities.
- Hub: 211/211 tests and build pass with the current audio scanner. All five
  games also start inside the hub player iframe without page errors.
- Both new games: real Chromium/WebGL startup, rendering and keyboard movement
  at 640×480 and 390×844; fire/burst/roll for Vesper and movement/jump/high profile
  for Ochre exercised without page errors or failed HTTP assets. Engine errors
  are empty. Neither new game's gameplay code implements persistent save storage;
  reload persistence is not claimed for them. Existing save-bearing games retain
  their exact bytes and namespaces.
- Captured and inspected three actual gameplay views per new game, 640×480 JPEG
  quality 58. No blank/loading/error frames. Existing screenshot strips retained.
- Catalog and audio inventory regenerated using the current scanner. All five
  have empty audio tags; this is a static inventory result, not a silence claim.

The adjacent audit JSON includes exact provenance, hashes, browser state and
source test reports. Full campaign completion, physical controllers, real mobile
hardware, Firefox and WebKit were not repeated for this import.
