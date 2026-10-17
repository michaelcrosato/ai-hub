# Grand Theft Five-Finger Drive-SD — implementation handoff

Release candidate: the game systems, level, expansion fixture and automated checks are implemented. The four-hour soak passes. Production delivery is in progress. The original plan's human/hardware gates are not silently marked passed; see QA.md for exact limits.

## Run and resume

Open `index.html` through HTTP. From ai-hub, run `node scripts/dev.mjs`. The game has no runtime dependencies or build step. Do not replace the pinned engine with a moving download.

| File | Ownership |
| --- | --- |
| `src/app.js` | Modes, title, Shell menus, audio, checkpoint UI and replay ownership |
| `src/input.js` | Physical activity observer and shared controller action adapter |
| `src/session.js` | Disposable world, persistent identities, fixed-step phases and saves |
| `src/vehicles.js`, `actors.js`, `city.js` | Car/seat geometry, crew/combat, witnesses/police |
| `src/mission.js`, `director.js` | Goal validation, transactions, legal AI actions and recovery |
| `src/presentation.js` | Original shapes, bounded raster caches and HUD |
| `content/district.js` | World geometry, roads/traffic data, crew, equipment and main mission |
| `content/spare-key.js` | Alternate mission using the existing goal contract |
| `tools/browser.html` | Browser contracts, benchmark, complete mission, view fixtures, eight-action filmstrips and soak |

## Stage ledger

- [x] P0 Repository/tools: active instructions read; existing tests passed; full history restored for hub date fixtures; no conflicting open PR found.
- [x] P1 Engine: full my-3D2dge 0.46.1 at `cfa866aa45474868350cad1a7fc015e612f9305f`; all three views render.
- [x] P2 Input/lifecycle: exact idle timing, raw physical ownership, analog values, neutral guard and demo save isolation tested.
- [x] P3 Movement/vehicles: six types, swept compound collision, oriented bullet hits, seats, safe exits, occupied entry, grip, damage and service options implemented and tested.
- [x] P4 City/police: traffic signals/queues, civilian reports, perception, heat, search, recognition, roadblocks and arrest implemented; regression evidence in QA.
- [x] P5 Combat/crew: finite weapons, armor, stagger, protection, abilities, persistent switching, duties and cross-zone rescue implemented.
- [x] P6 Mission/persistence: both approaches and escapes, two-slot verified saves, idempotent payouts, services and restore tests implemented.
- [ ] P7 Full acceptance: automated level completion passes. A full normal-rate manual playthrough and pacing review remain unavailable in this host.
- [ ] P8 Full acceptance: art, animation, five score arrangements, controller-first menus and visual fixes complete. Eight-action filmstrips, keyboard rebind/reset, short settings pages and audio lifecycle reviewed. Physical controller navigation, real-time feel and listening review remain unverified.
- [x] P9 Final soak: autonomous variants, watchdog, failure reset, mobile mode and silent boot complete. Four simulated hours: 87 wins, no failures, recoveries or errors.
- [x] P10 Expansion: eight yard stations and The Spare Key. Test registers a new content-only mission ID after core load, completes both vehicle choices, restores and pays once.
- [ ] P11 Full acceptance: 52 contracts, 21 missions, expansion, replay and the four-hour soak pass. Manual/reference-device and performance limits remain explicitly open in QA.
- [ ] P12 Delivery: catalogue scan and hub tests pass; commit/push/READY and live iframe checks pending.

## Design changes and resolved defects

- The 160 × 120 tile district has three scouting beats. They teach the escape routes and keep city play dominant. Isometric share and automated duration are measured in QA; human pacing remains a target.
- Use a 320 × 180 logical minimum, integer scaling and aspect expansion. Large menus stay in the engine Shell. The camera leaves room below the actor for the HUD. Captions page every word at standard or large size, with contrast and separate shake controls. Action poses reuse the engine rig; vehicle details show occupants, wheel motion, doors and smoke.
- Ground views use Mover/TileMap; the gantry uses Platformer/PlatformMap, a carrying lift and a moving cargo obstacle. Identity sits above controller type.
- Game-specific heap A*, road data, car bodies, seats, crime/dispatch, missions and checkpoint envelopes extend the engine. No second engine is hidden beside it.
- The director operates the same action frames and interactions as a player. It can leave a blocked car, enter Records to revive a downed operator, and lead the crew back through the normal portal. It never teleports, grants supplies or sets success.
- A failing seeded run exposed the cross-zone rescue gap. A real shared portal/revive path fixed it. The four-hour run then exposed seed 552: companions stayed in combat while the leader waited at delivery. Follow-duty actors now navigate while returning fire, and the watchdog counts crew approach progress. Seed 552 is retained in the mission suite.
- Saves verify the written slot before advancing the pointer and load the latest generation before writing. Restore clears transient bullets/targets/interactions; stable platform references are rebuilt by ID.
- Local engine patches retain analog triggers, copy input frames, add unscaled/pre-input hooks, conservatively cull map walls, cap voice admission, and expose short Shell setting pages. Exact hashes are in ENGINE-PATCHES.md.
- Whole-map cold baking remains a scaling cost. Larger districts should add streaming/cell ownership above the same map contracts rather than copy this district indefinitely.

## Completion workflow

Run content validation, game contracts, 20 seeded missions plus the seed-552 regression, expansion and replay. Compare native/isolated runners before the long soak. Run the four-hour simulation after gameplay changes, and browser contracts plus the half-hour foreground observation after lifecycle changes. Preserve any failing seed. Run the repository tests and scanner before delivery. Large generated evidence remains outside committed source.

The repository's authorized workflow is `main` → commit → push `origin/main` → Vercel production READY → direct game and hub iframe smoke test. Recheck remote state before pushing and preserve unrelated work. No root dependency or generated catalogue is required.

## Remaining verification blockers

No physical DualSense is attached. Only cloud Chrome is available; its roughly 1 FPS animation cadence prevents a normal manual playthrough, listening/animation review and sustained 60 Hz certification. Local browsers cannot launch under the managed socket restrictions. Do not bypass those restrictions or present emulation as hardware evidence. The exact unmet plan items and measured results are in QA.md.
