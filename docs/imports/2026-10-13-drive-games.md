# Drive game import — 13 October 2026

**130 new games; 0 existing games replaced; all 374 existing entries preserved.** The catalogue grows to 504 entries. The import was built on `b96da1c` in a dedicated branch; this report does not authorize a merge.

## Source and selection

Authenticated Drive downloads covered all 166 HTML files and 71 Site archives. Every raw file matched its SHA-256 in the backup manifest. The three database/save backups were not imported. Drive timestamps are backup upload times; decisions use original source dates, embedded versions, source commits, game code, assets and save identifiers.

The backup already omitted 149 older HTML revisions before upload. Those absent files were not re-reviewed or counted as newly skipped here. The linked audit covers every one of the 237 actual game-source candidates.

| Decision | Files |
|---|---:|
| Imported new game | 130 |
| Tools, reports, engine demonstrations and non-game libraries | 38 |
| Superseded source within this backup | 2 |
| Malformed source retained, not deployed | 1 |
| Earlier same-game build; preserve later hub integration | 41 |
| Byte-identical HTML already in the hub | 11 |
| Archive represented by selected standalone game | 14 |

[Complete per-file audit, hashes and source IDs](2026-10-13-drive-games.json) · [Browser launch evidence](2026-10-13-browser-checks.json)

## Identity and version decisions

- Same names do not merge games. The new entries separately retain the Breakwater skating, city-building, helicopter and Foundry Reach games; the RPG **The Last Bell** and boxing **Last Bell**; the different Lumenwake and Nacre games; and the Ashport runtime-preview district and fuller Night Run world.
- **Iron Tide: Free Command / Second Pass** is an open-ocean independent U-boat sandbox. The Site **Iron Tide** is a dual-role escort/U-boat patrol arena with separate mission and progression code. Both remain available.
- **AXIOM: Outward Expedition** uses the contracts/newFrontier expedition model. **AXIOM: Living Frontier / Experimental Preview** uses regional terrain, supply, town and restoration systems. Both are distinct game implementations. Within the latter lineage, the newer experimental source supersedes the older Living Frontier Site snapshot; its own experimental/unfinished-system notices remain intact.
- **g-zero 0.6.1** supersedes ION CIRCUIT Magnetic 101: the shared race model, 100-rival field, GAMEBOOT payload and contributor attribution establish lineage. The later handling revision intentionally has its own lap-record key; that key is unchanged.
- The 14 archive/export overlaps were compared at module/content level. Cinderwing has exact embedded game, art, score and engine modules; Stillwake shares the game/actors/platform scripts; SALTLINE shares its race model/game/audio; Rust Requiem shares all game/renderer/art modules. Iron Wake and Viper Wake have byte-identical archive and standalone entry pages. Other exports carry the same source-level game systems/assets or compiled client model.
- The 41 retained hub versions have later shared-engine, display, or repair work. Their commit evidence and shared functions/save strings are recorded in the audit. No original game paths, favourites identifiers, existing screenshots, catalogue overrides or library files are changed.

## Integration

- **Petals of Steel:** Restored the authenticated raw embedded module loader after automatic library localization interfered with its blob-only Content Security Policy. The policy is unchanged.
- **Rink Ruckus:** Restored the original module loader and pointed its download base at local Three.js 0.186.1. The package.json from its pinned upstream commit confirms that exact version.
- **The Ashen Compact:** Rebuilt the static game from the matching archive. The standalone export had collapsed $$ to $ during JavaScript String.replace substitution, causing a duplicate declaration. Source build produces a syntactically valid bundle with unchanged game logic.
- **Afterlight Arena Lab:** Vendored the exact Babylon.js 9.28.0 package script plus license/notice; dynamic Three.js 0.186.1 loads use the existing local shelf.
- **Breakwater helicopter:** Corrected the standalone nested entry favicon path from ../../favicon.svg to ../favicon.svg.
- **Client adapters:** 12 React Site clients were built with a minimal React mount, their existing global CSS, Tailwind and pinned game dependencies. No Site auth/server/database routes were bundled; asset URLs are rooted under each game mount. Oddside uses React.lazy in place of the client-only next/dynamic entry wrapper.
- **Archives:** Copied runtime assets and licenses only. Source ZIPs, database/save backups, report/review pages and tooling were omitted. Required game modes and connected in-game pages remain together.
- **Save identity:** No localStorage/sessionStorage save identifiers were intentionally changed. New mounts preserve the supplied storage schemes; source-defined g-zero handling-record isolation remains intact.
- **Superkick Riot:** Restored its package loader and redirected package fetches to the exact declared local dependencies: Three.js 0.186.1 and Rapier 0.20.0. This preserves the source-pinned physics version and avoids first-launch CDN requests.
- **Embedded engines:** Standalone exports with embedded engine/module loaders retain their original bytes instead of an added import map. This preserves their exact Three.js/Rapier versions, including Flareline’s explicit Rapier 0.20.0 requirement.
- **Vesper Ninth Relay:** Repaired one malformed data-setting CSS selector that incorrectly contained an aria-label attribute; the intended settings option query is unchanged.

Build recipes: original static Vite projects use their package manifests/lockfiles and `npm run build -- --base ./`. AXIOM uses its existing `vite.client.config.ts` with `--base ./`. React Site games mount the existing `app/page` component and `app/globals.css` with React, Vite, Tailwind and the required WASM plugin; `@` resolves to the source root. This keeps the game component graph while omitting the Site server/layout/auth graph. All required source-pinned Three.js/Rapier/React versions are preserved. Runtime files, rather than source ZIPs or dependency installation directories, are published.

## Validation and limits

- Baseline: `node --test "scripts/**/*.test.mjs"` ran 180 tests: 179 passed, with one pre-existing failure because Capital Strike has no three-frame screenshot strip. The import does not alter Capital Strike.
- `node scripts/check-libraries.mjs` verified 52 packages, 20,378 file hashes, all WASM binaries and physics for all 38 Rapier variants/releases.
- `node scripts/scan.mjs` confirms 504 catalogue entries with 130 new independent game IDs. `data/games.json` remains generated and uncommitted.
- Final repository tests: 179/180 pass, with the same existing Capital Strike screenshot failure (503 of 504 catalogue entries have strips). All 130 new entries have three captured frames.
- Hub navigation, Cinderwing iframe launch, return to the wall and mobile-sized Viper Wake launch passed; see `2026-10-13-hub-checks.json`.
- Raw and selected runtime files were screened for embedded private keys, API tokens, credential files and unrelated data exports. No credential matches were found. Database/save backups, Site auth/server code, reports and raw source archives are excluded from deployed game folders.
- Browser evidence uses local HTTP, Chromium 154 and software WebGL. Checks record launch exceptions, failed requests, visible text, start-button/key input, and three actual captured frames. These are launch checks, not full campaign completion, multiplayer, hardware-WebGPU or device certification.

### Unresolved or unavailable source

- **Windward — Flight School:** its supplied HTML duplicates its 35,795-byte HTML prefix inside a minified engine regex, causing `SyntaxError: missing ) after argument list`. No intact matching source archive is in this backup. The authenticated original is retained unchanged under `sources/drive-import-2026-10-13/`, which `.vercelignore` excludes from deployment. A faithful two-character reconstruction now passes syntax and reaches the flight lesson in an isolated browser test; see the follow-up below. It is not counted among the 130 catalogue entries.
- **Emberfall — The Endless Descent:** the backup manifest reports no saved version or usable source. No replacement was invented; the existing, differently identified Emberfall game is unchanged.
- **Nacre: The Gilded Debt:** the game source is included; the partial private save backup is excluded. Cloud save/auth and other Site-only online services are not hosted by this static hub. No sign-in was attempted.
- **RIFTBOUND:** source requires WebGPU and reports no adapter in this software-rendered browser. Its entry is preserved, but gameplay requires validation on hardware supporting WebGPU.
- Four Site games had optional Google Fonts certificate failures; fallback typography rendered. AXIOM Contact and MIDWAY attempted CDN engines before using their embedded fallback. These failed attempts are included in the evidence.
- Any remaining launch/resource limitations are recorded per entry in the browser evidence and summarized in the PR.

## Follow-up evidence

[Browser semantics, baseline failure and Windward repair assessment](2026-10-13-import-follow-up.md).

## New games

| Game | Source | Entry |
|---|---|---|
| Cinderwing · Operation Breakwater | Cinderwing.html | [Play source](../../games/drive-cinderwing/index.html) |
| Lumenfall · The Hollow Below | Lumenfall.html | [Play source](../../games/drive-lumenfall/index.html) |
| STILLWAKE — The last signal | Stillwake.html | [Play source](../../games/drive-stillwake/index.html) |
| The Ashen Compact | The-Ashen-Compact.html | [Play source](../../games/drive-the-ashen-compact/index.html) |
| SALTLINE — Cape Meridian | SALTLINE-Cape-Meridian.html | [Play source](../../games/drive-saltline-cape-meridian/index.html) |
| RUST // REQUIEM — Floodgate | Rust-Requiem-Play.html | [Play source](../../games/drive-rust-requiem-play/index.html) |
| Rally Cove — Arcade Tennis | Rally-Cove.html | [Play source](../../games/drive-rally-cove/index.html) |
| First Tide — The Sunken Nursery | First-Tide.html | [Play source](../../games/drive-first-tide/index.html) |
| Threadlight — The Lantern Orchard | Threadlight.html | [Play source](../../games/drive-threadlight/index.html) |
| Ashport — Runtime Preview | Ashport_Runtime_Preview.html | [Play source](../../games/drive-ashport-runtime-preview/index.html) |
| VESPER//ZERO — The Rain Ledger | Vesper-Zero-Offline.html | [Play source](../../games/drive-vesper-zero-offline/index.html) |
| AXIOM — Outward Expedition | AXIOM-Contact-0.6.0-play.html | [Play source](../../games/drive-axiom-contact-0-6-0-play/index.html) |
| BLACKWAKE — Living Harbor / Fixed | BLACKWAKE-Living-Harbor-Fixed.html | [Play source](../../games/drive-blackwake-living-harbor-fixed/index.html) |
| g-zero — Magnetic Grand Prix | g-zero-0.6.1.html | [Play source](../../games/drive-g-zero-0-6-1/index.html) |
| Lumen & Loam — The Bellwater Covenant | Lumen-and-Loam.html | [Play source](../../games/drive-lumen-and-loam/index.html) |
| Lumenwake · The Bellwood | Lumenwake(1).html | [Play source](../../games/drive-lumenwake-1/index.html) |
| Lumenwake — The Stillwater Garden | Lumenwake.html | [Play source](../../games/drive-lumenwake/index.html) |
| The Last Bell - Build 04 Renderer | the-last-bell.html | [Play source](../../games/drive-the-last-bell/index.html) |
| IRON TIDE — Free Command · Second Pass | Iron_Tide_Second_Pass.html | [Play source](../../games/drive-iron-tide-second-pass/index.html) |
| Before the Echo · Pearl Harbor | Before-the-Echo-v0.2.html | [Play source](../../games/drive-before-the-echo-v0-2/index.html) |
| MIDWAY — The Turning Tide | MIDWAY-v1.1.html | [Play source](../../games/drive-midway-v1-1/index.html) |
| Iron Wake — Open Sea | iron-wake.html | [Play source](../../games/drive-iron-wake/index.html) |
| Bellwether — The Drowned Orchard | Bellwether.html | [Play source](../../games/drive-bellwether/index.html) |
| NULL//TEMPLE VOL.04.1 — Reality Forge | NULL-TEMPLE-VOL4.1-REALITY-FORGE.html | [Play source](../../games/drive-null-temple-vol4-1-reality-forge/index.html) |
| BREAKWATER — Foundry Reach | BREAKWATER.html | [Play source](../../games/drive-breakwater/index.html) |
| The Ninth Bell — The Drowned Abbey | the-ninth-bell.html | [Play source](../../games/drive-the-ninth-bell/index.html) |
| MERIDIAN DOWN — Operation Glasswater | MERIDIAN_DOWN.html | [Play source](../../games/drive-meridian-down/index.html) |
| Depthward | 3dpixel2d (1)(1).html | [Play source](../../games/drive-3dpixel2d-1-1/index.html) |
| KINETIC — Stick Combat Lab | kinetic-stick-combat-mobile.html | [Play source](../../games/drive-kinetic-stick-combat-mobile/index.html) |
| RIFTBOUND · Into the Ash | RIFTBOUND.html | [Play source](../../games/drive-riftbound/index.html) |
| Emberdeep · my-3D2dge | Emberdeep-Foundry.html | [Play source](../../games/drive-emberdeep-foundry/index.html) |
| StarTropics — C-Island Echo | startropics-c-island-echo-20260930-gpt-6.html | [Play source](../../games/drive-startropics-c-island-echo-20260930-gpt-6/index.html) |
| Dead Signal | alienisolation-deadsignal-20260929-gpt6.html | [Play source](../../games/drive-alienisolation-deadsignal-20260929-gpt6/index.html) |
| Procedural Dungeon Fluid Crawler | procedural_dungeon_crawler.html | [Play source](../../games/drive-procedural-dungeon-crawler/index.html) |
| Rivet and the Lost Wind — Sunspun Canyon | frameforge-2d.html | [Play source](../../games/drive-frameforge-2d/index.html) |
| AEROLITH — Windward Circuit | pilotwings64-aerolith-windward-circuit-20260929-gpt-6.html | [Play source](../../games/drive-pilotwings64-aerolith-windward-circuit-20260929-gpt-6/index.html) |
| Skybound 64 — Lighthouse Loop | pilotwings64-skybound64-20260929-gpt.html | [Play source](../../games/drive-pilotwings64-skybound64-20260929-gpt/index.html) |
| Skyward Courier · Flight Trial | pilotwings64-skyward-courier-20260929-gpt6.html | [Play source](../../games/drive-pilotwings64-skyward-courier-20260929-gpt6/index.html) |
| Wake Warden: The Ironwater Run | wake-warden.html | [Play source](../../games/drive-wake-warden/index.html) |
| Viper Wake — The Emerald Run | viper-wake.html | [Play source](../../games/drive-viper-wake/index.html) |
| Nightglass · The First Shard | solstice-nightglass-the-first-shard-20260930-gpt-6.html | [Play source](../../games/drive-solstice-nightglass-the-first-shard-20260930-gpt-6/index.html) |
| Vesper Vault · Solstice | solstice-vesper-vault-20260929-gpt6.html | [Play source](../../games/drive-solstice-vesper-vault-20260929-gpt6/index.html) |
| Skyport — Island Licence | pilotwings-skyport-20260929-gpt6.html | [Play source](../../games/drive-pilotwings-skyport-20260929-gpt6/index.html) |
| Skybound Flight Club | pilotwings-skybound-flight-club-20260929-gpt-6-codex.html | [Play source](../../games/drive-pilotwings-skybound-flight-club-20260929-gpt-6-codex/index.html) |
| Pocket Parade | katamari-damacy-pocket-parade-20260929-gpt-6.html | [Play source](../../games/drive-katamari-damacy-pocket-parade-20260929-gpt-6/index.html) |
| Diamond After Dark · The Kingdome Nightcap | ken-griffey-jr-presents-major-league-baseball-diamond-after-dark-air-pass-20260929-gpt-5-6-sol.html | [Play source](../../games/drive-ken-griffey-jr-presents-major-league-baseball-diamond-after-dark-air-pass-20260929-gpt-5-6-sol/index.html) |
| Rink Ruckus! — Three.js r186 | ike-ike-nekketsu-hockey-bu-rink-ruckus-r186-20260929-gpt-6-astra-pro.html | [Play source](../../games/drive-ike-ike-nekketsu-hockey-bu-rink-ruckus-r186-20260929-gpt-6-astra-pro/index.html) |
| SUPERKICK RIOT · Three r186 / Rapier 0.20.0 | world-cup-soccer-superkick-riot-20260929-gpt-6-astra-pro.html | [Play source](../../games/drive-world-cup-soccer-superkick-riot-20260929-gpt-6-astra-pro/index.html) |
| Boundary Breakers — Arcade Cricket | Boundary-Breakers-r186.html | [Play source](../../games/drive-boundary-breakers-r186/index.html) |
| BLACK TIDE — Living Dock | metal-gear-solid-black-tide-20260929-gpt-6-astra-pro.html | [Play source](../../games/drive-metal-gear-solid-black-tide-20260929-gpt-6-astra-pro/index.html) |
| WRECKLINE — r186 / Rapier 0.20.0 | blast-corps-wreckline-20260929-gpt-6-astra-pro.html | [Play source](../../games/drive-blast-corps-wreckline-20260929-gpt-6-astra-pro/index.html) |
| Third Avenue — The Air Between | Third-Avenue-The-Air-Between.html | [Play source](../../games/drive-third-avenue-the-air-between/index.html) |
| THREE PM. — The Room Responds | three-pm-v4.html | [Play source](../../games/drive-three-pm-v4/index.html) |
| Iron Bells — Hold at Carentan | company-of-heroes-iron-bells-20260929-gpt-6-astra-pro.html | [Play source](../../games/drive-company-of-heroes-iron-bells-20260929-gpt-6-astra-pro/index.html) |
| Stone & Valor — The Carentan Operation | company-of-heroes-stone-and-valor-20260929-gpt-6-astra-pro.html | [Play source](../../games/drive-company-of-heroes-stone-and-valor-20260929-gpt-6-astra-pro/index.html) |
| Verdant Oath — Secret of Mana | secretofmana-verdant-oath-20260929-gpt-6-astra-pro.html | [Play source](../../games/drive-secretofmana-verdant-oath-20260929-gpt-6-astra-pro/index.html) |
| Death Riff · Rock n’ Roll Racing vertical slice | Rock-and-Roll-Racing-Death-Riff-20260929-GPT-6-Astra-Pro.html | [Play source](../../games/drive-rock-and-roll-racing-death-riff-20260929-gpt-6-astra-pro/index.html) |
| Echoes of the Earth — Secret of Mana | secret-of-mana-echoes-of-the-earth-20260929-codex-gpt.html | [Play source](../../games/drive-secret-of-mana-echoes-of-the-earth-20260929-codex-gpt/index.html) |
| Phoenix Signal · my-3D2dge | burningrangers-phoenixsignal-20260929-GPT-6-Astra-Pro.html | [Play source](../../games/drive-burningrangers-phoenixsignal-20260929-gpt-6-astra-pro/index.html) |
| Wildcode · Endless Frontier | Wildcode.html | [Play source](../../games/drive-wildcode/index.html) |
| Before Three — A New York Work–Life Sim | Before-Three-v3.html | [Play source](../../games/drive-before-three-v3/index.html) |
| Reverie in Bloom — Living Air | nights-into-dreams-reverie-in-bloom-living-air-20260929-GPT-6-Astra-Pro.html | [Play source](../../games/drive-nights-into-dreams-reverie-in-bloom-living-air-20260929-gpt-6-astra-pro/index.html) |
| ASHEN WING — The Deep Gulch · Air Pass 02 | panzer-dragoon-saga-ashen-wing-air-pass-20260929-gpt-6-astra-pro.html | [Play source](../../games/drive-panzer-dragoon-saga-ashen-wing-air-pass-20260929-gpt-6-astra-pro/index.html) |
| Oaths of the Silver Tide · Atmosphere Pass II | shiningforceiii-oaths-of-the-silver-tide-atmosphere-20260929-gpt-6-astra-pro.html | [Play source](../../games/drive-shiningforceiii-oaths-of-the-silver-tide-atmosphere-20260929-gpt-6-astra-pro/index.html) |
| FLARELINE — Render the Air / Two Missions | burning-rangers-flareline-render-the-air-20260929-gpt-6-astra-pro.html | [Play source](../../games/drive-burning-rangers-flareline-render-the-air-20260929-gpt-6-astra-pro/index.html) |
| Shutter Safari · Rendering the Air · Beach & Tunnel | pokemon-snap-shutter-safari-rendering-the-air-20260929-gpt-6-astra-pro.html | [Play source](../../games/drive-pokemon-snap-shutter-safari-rendering-the-air-20260929-gpt-6-astra-pro/index.html) |
| Azure Reliquary · The Living Air | panzerdragoon-azure-reliquary-air-pass-20260929-gpt-6-astra-pro.html | [Play source](../../games/drive-panzerdragoon-azure-reliquary-air-pass-20260929-gpt-6-astra-pro/index.html) |
| SABLEWING — The Meccania Passage · Air Pass | panzer-dragoon-ii-zwei-sablewing-air-pass-20260929-gpt-6-astra-pro.html | [Play source](../../games/drive-panzer-dragoon-ii-zwei-sablewing-air-pass-20260929-gpt-6-astra-pro/index.html) |
| Petals of Steel — Living Stage | sakurawars-petals-of-steel-living-stage-20260929-gpt-6-astra-pro.html | [Play source](../../games/drive-sakurawars-petals-of-steel-living-stage-20260929-gpt-6-astra-pro/index.html) |
| Dustline Rally — Twin Stages · Live Edition | sega-rally-championship-dustline-rally-live-edition-20260929-gpt-6-astra-pro.html | [Play source](../../games/drive-sega-rally-championship-dustline-rally-live-edition-20260929-gpt-6-astra-pro/index.html) |
| Whisper of the Ember Seed · Secret of Mana tribute | secret-of-mana-whisper-of-the-ember-seed-20260928-gpt-6-astra-pro.html | [Play source](../../games/drive-secret-of-mana-whisper-of-the-ember-seed-20260928-gpt-6-astra-pro/index.html) |
| Diamond Heat ’94 — Play Ball | ken-griffey-jr-presents-major-league-baseball-diamond-heat-94-20260928-gpt-6-astra-pro.html | [Play source](../../games/drive-ken-griffey-jr-presents-major-league-baseball-diamond-heat-94-20260928-gpt-6-astra-pro/index.html) |
| AFTERLIGHT — Arena Lab | Afterlight_Arena_Lab.html | [Play source](../../games/drive-afterlight-arena-lab/index.html) |
| Diamond Daydreams · Sunset Series | baseballstars-diamond-daydreams-20260928-gpt-6-astra-pro.html | [Play source](../../games/drive-baseballstars-diamond-daydreams-20260928-gpt-6-astra-pro/index.html) |
| BREAKLINE — Rugby. Turned up. | BREAKLINE.html | [Play source](../../games/drive-breakline/index.html) |
| BLOCK PARTY FC — Football, turned up. | Block-Party-FC.html | [Play source](../../games/drive-block-party-fc/index.html) |
| Last Train to Dawn — a Final Fantasy VI chapter | last-train-to-dawn-gpt-6-astra-pro.html | [Play source](../../games/drive-last-train-to-dawn-gpt-6-astra-pro/index.html) |
| Lanternwake — The Hollow Bell | lanternwake-hollow-bell.zip | [Play source](../../games/drive-site-lanternwake-hollow-bell/index.html) |
| Wayfarer: The Glass Tide | wayfarer-glass-tide.zip | [Play source](../../games/drive-site-wayfarer-glass-tide/index.html) |
| Tidebell — Echoes of the Drowned Abbey | tidebell-drowned-abbey.zip | [Play source](../../games/drive-site-tidebell-drowned-abbey/index.html) |
| Vesper · The Hollow Choir | vesper-hollow-choir.zip | [Play source](../../games/drive-site-vesper-hollow-choir/index.html) |
| Emberwake — The Silent Bell | emberwake-the-silent-bell.zip | [Play source](../../games/drive-site-emberwake-the-silent-bell/index.html) |
| BRASSWING — Operation Glass Tide | brasswing-glass-tide.zip | [Play source](../../games/drive-site-brasswing-glass-tide/index.html) |
| Dusk Vector | dusk-vector.zip | [Play source](../../games/drive-site-dusk-vector/index.html) |
| Dust & Volt | dust-and-volt.zip | [Play source](../../games/drive-site-dust-and-volt/index.html) |
| Last Bell — The Foundry Bout | last-bell.zip | [Play source](../../games/drive-site-last-bell/index.html) |
| BRASSLINE — The Night Shift | brassline-dock-nine.zip | [Play source](../../games/drive-site-brassline-dock-nine/index.html) |
| IONWAKE — The Glass Reach | ionwake.zip | [Play source](../../games/drive-site-ionwake/index.html) |
| Copperline — A Valley in Motion | copperline-valley.zip | [Play source](../../games/drive-site-copperline-valley/index.html) |
| Windpost — Sunpetal Summit | windpost-sunpetal-summit.zip | [Play source](../../games/drive-site-windpost-sunpetal-summit/index.html) |
| AFTERFRAME — The Last Broadcast | afterframe-last-broadcast.zip | [Play source](../../games/drive-site-afterframe-last-broadcast/index.html) |
| Foldlight · The Lanternwood | foldlight-lanternwood.zip | [Play source](../../games/drive-site-foldlight-lanternwood/index.html) |
| VESPER · The Folded Observatory | vesper-folded-observatory.zip | [Play source](../../games/drive-site-vesper-folded-observatory/index.html) |
| The Lantern Seam | the-lantern-seam.zip | [Play source](../../games/drive-site-the-lantern-seam/index.html) |
| HUSHLINE — The Listening Vault | hushline-listening-vault.zip | [Play source](../../games/drive-site-hushline-listening-vault/index.html) |
| Breakwater — The Freight Yard | breakwater-yard-session.zip | [Play source](../../games/drive-site-breakwater-yard-session/index.html) |
| CINDERWAKE · The Hollow Bell | cinderwake-hollow-bell.zip | [Play source](../../games/drive-site-cinderwake-hollow-bell/index.html) |
| Breakwater — The Harbor Charter | breakwater-city.zip | [Play source](../../games/drive-site-breakwater-city/index.html) |
| The Last Signal | the-last-signal.zip | [Play source](../../games/drive-site-the-last-signal/index.html) |
| BREAKWATER | breakwater.zip | [Play source](../../games/drive-site-breakwater/index.html) |
| Static Veil — The Ninth Relay | static-veil.zip | [Play source](../../games/drive-site-static-veil/index.html) |
| Reedbound — The Quiet Marsh | reedbound-quiet-marsh.zip | [Play source](../../games/drive-site-reedbound-quiet-marsh/index.html) |
| Nacre: The Gilded Debt | nacre-gilded-debt.zip | [Play source](../../games/drive-site-nacre-gilded-debt/index.html) |
| Dust & Mercy — The Bitter Creek Run | dust-and-mercy.zip | [Play source](../../games/drive-site-dust-and-mercy/index.html) |
| Sands of the Skywell | sands-of-the-skywell.zip | [Play source](../../games/drive-site-sands-of-the-skywell/index.html) |
| Low Tide — The Missing Signal | low-tide-aonami.zip | [Play source](../../games/drive-site-low-tide-aonami/index.html) |
| Ashport: Night Run | ashport-night-run.zip | [Play source](../../games/drive-site-ashport-night-run/index.html) |
| LOW TIDE — The Last Pickup | low-tide-last-pickup.zip | [Play source](../../games/drive-site-low-tide-last-pickup/index.html) |
| Low Tide: The Last Signal | low-tide-last-signal.zip | [Play source](../../games/drive-site-low-tide-last-signal/index.html) |
| Lumenwake — The Drowned Garden | lumenwake-garden.zip | [Play source](../../games/drive-site-lumenwake-garden/index.html) |
| Sable Signal | sable-signal.zip | [Play source](../../games/drive-site-sable-signal/index.html) |
| GHOSTLINE · Dead Frequency | ghostline-dead-frequency.zip | [Play source](../../games/drive-site-ghostline-dead-frequency/index.html) |
| Lanternwake · The Drowned Bell | lanternwake-drowned-bell.zip | [Play source](../../games/drive-site-lanternwake-drowned-bell/index.html) |
| Nightjar — The Ash Ledger | nightjar-ash-ledger.zip | [Play source](../../games/drive-site-nightjar-ash-ledger/index.html) |
| Tidehaven — Pelican Bay | tidehaven-pelican-bay.zip | [Play source](../../games/drive-site-tidehaven-pelican-bay/index.html) |
| Emberwake: The Drowned Bell | emberwake-drowned-bell.zip | [Play source](../../games/drive-site-emberwake-drowned-bell/index.html) |
| DUSTLINE — The Silent Array | dustline-silent-array.zip | [Play source](../../games/drive-site-dustline-silent-array/index.html) |
| QUIET CURRENT — Operation Glass Harbour | quiet-current.zip | [Play source](../../games/drive-site-quiet-current/index.html) |
| VESPER — The Ninth Relay | vesper-ninth-relay.zip | [Play source](../../games/drive-site-vesper-ninth-relay/index.html) |
| Dustwake: The Salt Reach | dustwake-glasswell.zip | [Play source](../../games/drive-site-dustwake-glasswell/index.html) |
| Pale Signal | pale-signal.zip | [Play source](../../games/drive-site-pale-signal/index.html) |
| Oddside Clinic | oddside-clinic.zip | [Play source](../../games/drive-site-oddside-clinic/index.html) |
| NACRE · The Stillwater Archive | nacre-stillwater-archive.zip | [Play source](../../games/drive-site-nacre-stillwater-archive/index.html) |
| Tidebloom | tidebloom.zip | [Play source](../../games/drive-site-tidebloom/index.html) |
| Hollow Tide | hollow-tide.zip | [Play source](../../games/drive-site-hollow-tide/index.html) |
| IRON TIDE — Breakwater | iron-tide-breakwater.zip | [Play source](../../games/drive-site-iron-tide-breakwater/index.html) |
| NIGHT SHIFT — Breakwater | night-shift-breakwater.zip | [Play source](../../games/drive-site-night-shift-breakwater/index.html) |
| AXIOM · Experimental Preview | axiom-experimental-preview.zip | [Play source](../../games/drive-site-axiom-experimental-preview/index.html) |
| Iron Tide | iron-tide.zip | [Play source](../../games/drive-site-iron-tide/index.html) |
| Ashen Hollow | ashen-hollow.zip | [Play source](../../games/drive-site-ashen-hollow/index.html) |

## Exact existing duplicates

| Source | Resolution |
|---|---|
| iron-circuit-gpt-6-astra-pro.html | games/Mega-Man-2-Iron-Circuit-2026-09-27-GPT-6-Astra-Pro.html |
| Black-Archive.html | games/original-Black-Archive-Offline-Edition-2026-09-27-model-unknown.html |
| echoes-of-the-first-dawn.html | games/FF-Echoes-of-the-First-Dawn-2026-09-26-GPT-6-Astra-Pro.html |
| first-earth-living-worlds.html | games/Populous-First-Earth-The-Living-Worlds-2026-09-25-GPT-6-Astra-Pro.html |
| lions-of-the-unwritten.html | games/FFT-Lions-of-the-Unwritten-2026-09-25-GPT-6-Astra-Pro.html |
| sixfold-dawn.html | games/DWIII-Sixfold-Dawn-The-Erdrick-Chronicle-2026-09-25-GPT-6-Astra-Pro.html |
| sevenfold-frontier.html | games/SF-Sevenfold-Frontier-2026-09-25-GPT-6-Astra-Pro.html |
| afterlight-the-fourfold-blade.html | games/Crystalis-Afterlight-The-Fourfold-Blade-Attempt-02-2026-09-25-GPT-6-Astra-Pro.html |
| diskbound.html | games/Rygar-Diskbound-Echoes-of-Argool-2026-09-24-model-unknown.html |
| windwake.html | games/Crystalis-Windwake-Four-Blades-One-Sky-2026-09-24-model-unknown.html |
| Shard_and_Sorcery(1).html | games/Crystalis-Shard-and-Sorcery-The-Waking-World-2026-09-24-model-unknown.html |

## Earlier builds skipped to avoid downgrades

| Source | Resolution |
|---|---|
| BRICKYARD-BLITZ-AI-UPDATE.html | games/NFL-Blitz-BRICKYARD-BLITZ-All-out-arcade-football-2026-09-27-model-unknown/index.html |
| SLAPSHOT.html | games/original-SLAPSHOT-Brick-League-2026-09-27-model-unknown/index.html |
| brick-league-play.html | games/original-BRICK-LEAGUE-Big-hits-Brick-energy-2026-09-27-model-unknown/index.html |
| rooftop-rivals-gpt-6-astra-pro.html | games/Street-Fighter-II-Turbo-Rooftop-Rivals-Turbo-Duel-2026-09-27-GPT-6-Astra-Pro.html |
| Iron-Tether-GPT-6-Astra-Pro.html | games/Bionic-Commando-IRON-TETHER-Operation-Breakwater-2026-09-27-GPT-6-Astra-Pro.html |
| shellshift-gpt-6-astra-pro.html | games/Teenage-Mutant-Ninja-Turtles-Shellshift-Big-Apple-After-Dark-2026-09-27-GPT-6-Astra-Pro.html |
| echoes-of-the-emerald-seal-gpt-6-astra-pro.html | games/The-Legend-of-Zelda-A-Link-to-the-Past-Echoes-of-the-Emerald-Seal-2026-09-27-GPT-6-Astra-Pro.html |
| echoes-of-courage-gpt-6-astra-pro(2).html | games/The-Legend-of-Zelda-A-Link-to-the-Past-Echoes-of-Courage-Eastern-Palace-2026-09-27-GPT-6-Astra-Pro.html |
| Midnight-Riot.html | games/original-Midnight-Riot-After-Hours-All-Out-2026-09-27-model-unknown.html |
| Rift-Rangers-Jungle-Breaker-Rebuilt.html | games/Contra-Rift-Rangers-Jungle-Breaker-2026-09-17-model-unknown/index.html |
| Subterra-Spark-Rebuilt.html | games/BM-Subterra-Spark-Vaultbreaker-2026-09-17-model-unknown/index.html |
| iron-signal-fixed.html | games/OpenRA-RA-IRON-SIGNAL-2026-09-26-GPT-6-Astra-Pro/index.html |
| Poringbound-PLAY.html | games/RO-Poringbound-The-Amber-Oath-2026-09-26-GPT-6-Astra-Pro/index.html |
| Ashen-Zodiac.html | games/FFT-Ashen-Zodiac-A-Chronicle-of-Ivalice-2026-09-26-GPT-6-Astra-Pro/index.html |
| Ashbound-1.1.html | games/TESIII-Ashbound-The-Three-Prophecies-2026-09-26-GPT-6-Astra-Pro/index.html |
| void-meridian.html | games/Elite-Void-Meridian-Space-Trader-2026-09-26-GPT-6-Astra-Pro.html |
| ash-and-oath.html | games/TESIII-Ash-and-Oath-2026-09-26-GPT-6-Astra-Pro.html |
| fourfold-oath.html | games/FF-Fourfold-Oath-The-Broken-Dawn-2026-09-26-GPT-6-Astra-Pro.html |
| orbs-of-the-first-dawn.html | games/FF-Orbs-of-the-First-Dawn-2026-09-26-GPT-6-Astra-Pro.html |
| ember-crown.html | games/DW-Ember-Crown-The-Light-of-Alefgard-2026-09-26-GPT-6-Astra-Pro.html |
| fourfold-echoes-of-the-first-dawn.html | games/FF-Fourfold-Echoes-of-the-First-Dawn-Attempt-02-2026-09-26-GPT-6-Astra-Pro.html |
| fourfold-the-still-sky.html | games/FFIII-Fourfold-The-Still-Sky-Attempt-01-2026-09-26-GPT-6-Astra-Pro.html |
| the-lions-oath-fixed.html | games/FFT-The-Lion-s-Oath-2026-09-25-GPT-6-Astra-Pro/index.html |
| Little-World-singing.html | games/original-Little-World-Sing-play-grow-2026-09-17-model-unknown/index.html |
| Shard-and-Sky-Living-Leaf-Second-Pass.html | games/Crystalis-Shard-and-Sky-Living-Leaf-Second-Pass-2026-09-24-model-unknown.html |
| Electric-Sheepish-Before-the-Rain.html | games/BR-Before-the-Rain-Electric-Sheepish-2026-09-24-model-unknown/index.html |
| Rain-Check-Street-of-Rain.html | games/Blade-Runner-RAIN-CHECK-The-Street-of-Rain-2026-09-24-model-unknown/index.html |
| Neon-Skies-Fixed.html | games/AC3-Neon-Skies-Mach-and-Mischief-2026-09-24-model-unknown/index.html |
| Soft-Shave-v2.html | games/original-Soft-Shave-A-small-moment-of-calm-2026-09-24-model-unknown.html |
| still-fixed.html | games/original-still.-touch-not-controls.-2026-09-23-model-unknown/index.html |
| Pine-Run.html | games/Crazy-Taxi-PINE-RUN-Arcade-Cab-Co.-2026-09-20-model-unknown.html |
| keto-courier.html | games/original-Keto-Courier-a-tiny-fuel-adventure-2026-09-20-model-unknown.html |
| Bannerbound.html | games/Final-Fantasy-Tactics-Bannerbound-The-Hollow-Crown-Attempt-02-2026-09-20-model-unknown.html |
| Bannerbound-The-Hollow-Bell.html | games/Final-Fantasy-Tactics-Bannerbound-The-Hollow-Bell-Attempt-01-2026-09-20-model-unknown.html |
| Sunspindle.html | games/Rygar-Sunspindle-The-Amber-Trail-2026-09-19-model-unknown.html |
| Crown_and_Clay.html | games/Civilization-Crown-and-Clay-The-First-Dawn-Attempt-02-2026-09-19-model-unknown/index.html |
| Crown-and-Clay.html | games/Civilization-Crown-and-Clay-One-more-little-turn.-Attempt-01-2026-09-19-model-unknown.html |
| Wyrm_and_Wonder.html | games/DW-Wyrm-and-Wonder-The-Sunbell-Quest-2026-09-19-model-unknown.html |
| Bramblebound.html | games/DWIV-Bramblebound-The-Bellkeeper-s-Secret-Attempt-02-2026-09-19-model-unknown.html |
| undertow-weapon-water.html | games/original-Undertow-Seven-Guardians-Below-2026-09-16-model-unknown.html |
| Mercenary-Strike-v0.3.html | games/Desert-Strike-Mercenary-Strike-First-Lift-Attempt-01-2026-09-19-model-unknown.html |

## Equivalent archive packages

| Source | Resolution |
|---|---|
| cinderwing-breakwater.zip | Cinderwing.html |
| stillwake-last-signal.zip | Stillwake.html |
| lumenfall-hollow-below.zip | Lumenfall.html |
| the-ashen-compact.zip | The-Ashen-Compact.html |
| saltline-cape-meridian.zip | SALTLINE-Cape-Meridian.html |
| rust-requiem-floodgate.zip | Rust-Requiem-Play.html |
| rally-cove.zip | Rally-Cove.html |
| first-tide.zip | First-Tide.html |
| threadlight-lantern-orchard.zip | Threadlight.html |
| vesper-zero.zip | Vesper-Zero-Offline.html |
| iron-wake.zip | iron-wake.html |
| riftbound-into-the-ash.zip | RIFTBOUND.html |
| viper-wake.zip | viper-wake.html |
| wildcode-endless-frontier.zip | Wildcode.html |

## Superseded backup builds

| Source | Resolution |
|---|---|
| ION-CIRCUIT-MAGNETIC-101.html | g-zero-0.6.1.html |
| axiom-living-frontier.zip | axiom-experimental-preview.zip |

## Non-game exclusions

| Source | Resolution |
|---|---|
| CANON_OVERDRIVE_REEL.html | Source UI/code is a tool, report, engine demonstration, review, or educational library rather than a standalone game. |
| Morph-Lab-v12.html | Source UI/code is a tool, report, engine demonstration, review, or educational library rather than a standalone game. |
| AXIOM-Audit-Workbench.html | Source UI/code is a tool, report, engine demonstration, review, or educational library rather than a standalone game. |
| Morph-Lab-v5-Review.html | Source UI/code is a tool, report, engine demonstration, review, or educational library rather than a standalone game. |
| 2d-graphics-showcase-boot.html | Source UI/code is a tool, report, engine demonstration, review, or educational library rather than a standalone game. |
| tideline-surface.html | Source UI/code is a tool, report, engine demonstration, review, or educational library rather than a standalone game. |
| DITHER-Player.html | Source UI/code is a tool, report, engine demonstration, review, or educational library rather than a standalone game. |
| DITHER.html | Source UI/code is a tool, report, engine demonstration, review, or educational library rather than a standalone game. |
| ION-CIRCUIT-OFFLINE-BUILDER.html | Source UI/code is a tool, report, engine demonstration, review, or educational library rather than a standalone game. |
| Pixel-Forge-3D-Recovery.html | Source UI/code is a tool, report, engine demonstration, review, or educational library rather than a standalone game. |
| Lumenwake_Design_Report.html | Source UI/code is a tool, report, engine demonstration, review, or educational library rather than a standalone game. |
| Pixel-Forge-Prepare.html | Source UI/code is a tool, report, engine demonstration, review, or educational library rather than a standalone game. |
| pixel-engine.html | Source UI/code is a tool, report, engine demonstration, review, or educational library rather than a standalone game. |
| BREAKWATER-review.html | Source UI/code is a tool, report, engine demonstration, review, or educational library rather than a standalone game. |
| MERIDIAN_DOWN_Production_Report.html | Source UI/code is a tool, report, engine demonstration, review, or educational library rather than a standalone game. |
| Pixel-Field.html | Source UI/code is a tool, report, engine demonstration, review, or educational library rather than a standalone game. |
| Emberdeep-Visual-Workshop.html | Source UI/code is a tool, report, engine demonstration, review, or educational library rather than a standalone game. |
| pavilion-phone.html | Source UI/code is a tool, report, engine demonstration, review, or educational library rather than a standalone game. |
| Pavilion-review.html | Source UI/code is a tool, report, engine demonstration, review, or educational library rather than a standalone game. |
| WCST-WG61SL.html | Source UI/code is a tool, report, engine demonstration, review, or educational library rather than a standalone game. |
| crowd-lab(1).html | Source UI/code is a tool, report, engine demonstration, review, or educational library rather than a standalone game. |
| crowd-forge.html | Source UI/code is a tool, report, engine demonstration, review, or educational library rather than a standalone game. |
| stick-lab.html | Source UI/code is a tool, report, engine demonstration, review, or educational library rather than a standalone game. |
| frameforge-2d(1).html | Source UI/code is a tool, report, engine demonstration, review, or educational library rather than a standalone game. |
| 3dpixel2d.html | Source UI/code is a tool, report, engine demonstration, review, or educational library rather than a standalone game. |
| grove-skeletal-demo.html | Source UI/code is a tool, report, engine demonstration, review, or educational library rather than a standalone game. |
| iso-pixel-demo.html | Source UI/code is a tool, report, engine demonstration, review, or educational library rather than a standalone game. |
| my-3d2dge(2).html | Source UI/code is a tool, report, engine demonstration, review, or educational library rather than a standalone game. |
| co55-engine(6).html | Source UI/code is a tool, report, engine demonstration, review, or educational library rather than a standalone game. |
| orbs-of-the-first-dawn-report.html | Source UI/code is a tool, report, engine demonstration, review, or educational library rather than a standalone game. |
| lions-of-the-unwritten-scene-review.html | Source UI/code is a tool, report, engine demonstration, review, or educational library rather than a standalone game. |
| first-earth-visual-audit.html | Source UI/code is a tool, report, engine demonstration, review, or educational library rather than a standalone game. |
| FFT_Dashboard_Guide.html | Source UI/code is a tool, report, engine demonstration, review, or educational library rather than a standalone game. |
| Story-Time-v1.3.html | Source UI/code is a tool, report, engine demonstration, review, or educational library rather than a standalone game. |
| undertow-sound-preview.html | Source UI/code is a tool, report, engine demonstration, review, or educational library rather than a standalone game. |
| wcst-wg6ah.zip | Source implements a graphics/physics demonstration or crowd stress test, not a standalone game. |
| crowd-lab-webgpu.zip | Source implements a graphics/physics demonstration or crowd stress test, not a standalone game. |
| mosslight-pixel-island.zip | Source implements a graphics/physics demonstration or crowd stress test, not a standalone game. |
