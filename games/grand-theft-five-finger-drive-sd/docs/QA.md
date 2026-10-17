# Verification record

Date: 2026-10-17 UTC. Candidate based on ai-hub `34037cd8e8dc1fb3d3bf7b11701c502b67682b8f`. The final delivery commit and deployment are recorded in HANDOFF.md after release.

This is an evidence record. A simulated controller is not a physical DualSense. A browser CPU benchmark is not a display-refresh measurement. AI completion does not establish human pacing.

## Environment and method

- ChatGPT Work Mode / Codex, Linux x86_64, Bash, Node.js 24.19.0, npm 11.9.0, Python 3.12.14, Git 2.51.1.
- Cloud Chrome 154.0.0.0, Linux, Canvas 2D, no WebGPU. Browser UI viewport approximately 1348 × 936; benchmark iframe 1920 × 1080 with a 320 × 180 logical buffer.
- Full my-3D2dge 0.46.1 engine, fixed 1/120 step, deterministic seeds. Contract/mission tests execute the game scripts through an isolated Node VM. The final soak uses the same scripts in the native Node context, after a full seed-552 mission produced the identical `9dc5219a` state hash in both runners. Neither runner replaces the simulation.
- The cloud browser repeatedly reports about 1 rendered frame/second even with the document visible and focused. Browser `advance()` checks measure actual updates and draws separately from that scheduler.
- Local Playwright Chromium and the upstream handoff browser-runner tools could not launch under the managed socket restrictions. The browser QA page drives the same engine advance/fixture contracts in supported cloud Chrome. No protection was disabled. Physical USB/Bluetooth controllers, Firefox and WebKit were unavailable.

## Executed suites

Run game commands from `games/grand-theft-five-finger-drive-sd`.

| Command / check | Recorded result | Evidence |
| --- | --- | --- |
| `node --test tests/contracts.test.mjs` | 52/52 passed (28.85 s) | `/workspace/scratch/91dce3218030/contracts-release.log` |
| `node tests/mission.mjs 20` | 21/21 passed: seeds 700–719 plus delivery regression seed 552; 432.75 s | `missions-release.json` and `.log` in the workspace scratch root |
| `node tests/expansion.mjs` | Both compact and van branches complete, restore and pay once. A new mission ID registers after all core scripts have loaded. | `expansion-release.json`; fixture source is committed |
| `node tests/replay.mjs` | 17,295 recorded ticks reproduced state hash `19450f0f`; success and no errors. | `replay-release.json` |
| `node --expose-gc tests/soak.mjs 14400` | 14,400.333 simulated seconds; 87/87 wins; zero failures, recoveries or engine errors; 429.75 real seconds. The earlier seed-552 failure is retained separately. | `soak-release.json`; failing evidence in scratch `sd-evidence/soak-delivery-regression.json` |
| Browser contracts | 20/20 passed on the final browser build | `sd-browser-contracts-release.txt` and `tools/browser.html` |
| Content authoring validation | Both missions, six vehicles and three weapons validate; blocked/unreachable/duplicate/unknown cases have negative tests | `tools/validate.mjs` |
| Native/isolated runner equivalence | Complete seed 552 succeeds with identical `9dc5219a` state hashes | `tests/runner.mjs`, `runner-compare.log` |
| Browser full mission | Forceful/Market seed 703 and Quiet/Canal rescue seed 700 both succeed through all three views with no engine errors. Seed 700: 152.917 simulated seconds. Corrected seed 552 also succeeds in 166.917 simulated seconds with all views and no errors. | `sd-browser-release-mission.txt`, `sd-browser-seed552.txt` |
| Browser foreground observation | 1,800.585 seconds, 1,759 visible/focused samples, one interruption/restart, zero engine errors; 41 actors/14 cars. Median 1 FPS, only 86.925 simulated seconds, no full cycle. | `sd-browser-soak.json` |
| Hub `node --test "scripts/**/*.test.mjs"` | 234/234 passed on merged main; final root suite 117.23 seconds | `hub-release-tests.log` |
| Hub `node scripts/scan.mjs` | 701 games; exactly one matching entry, correct source, series, engine and relative path | Generated catalogue is not committed |

The corrected four-hour release soak uses the final gameplay rules, including combat regrouping and the Watch Demo input handoff. Definition validation and final cosmetic details were added while it ran; those add no valid-world gameplay mutation. Menu, caption, rig and vehicle-detail changes have targeted contract/browser coverage. The thirty-minute foreground observation was on the integrated candidate before those final presentation changes.

Headless population remains 41 actors and 14 cars at every reset. Collected heap samples range from 11.97 to 12.97 MB while the test retains all run traces; that is not an isolated measurement of retained world memory. Browser heap samples are non-GC observations and are not compared as equivalent collection points.

Large raw logs, browser captures and temporary reports stay outside committed source. The commands, fixtures, assertions, reviewed numbers and limitations are committed so another agent can reproduce them.

## What the contract suite covers

Engine classes and clock ownership; exact idle boundary; title-menu versus live-pause timing; all connected pads, both sticks and analog triggers; raw keyboard actions; interrupt-before-bot and neutral guard; demo storage isolation; corruption, torn writes, blocked storage and newer schemas; generation continuity; reward idempotency; inventory and zone restore; safe seats and blocked exits; six swept vehicle footprints; observed and interrupted witness reports; vehicle/paint recognition; finite ammo and reload; armor, team rules, stagger and brief protection; occupied entry; bounded event history and voice admission; moving lift carry/restore; side-zone watchdog; crew wheel cancellation; cross-zone rescue; optional activity rewards; replay hashes; fall/arrest recovery; gate rollback; failed-demo and recovery resets; rotated vehicle bullet hits; traffic red-light braking and release.

The 30/60/120/144 Hz schedule test compares equal fixed-tick states. Replay tests include real mission actions, crew switches and companion tasks. No cross-browser bit-for-bit claim is made.

## Rendering and visual review

The original 480 × 270 minimum was changed to 320 × 180. Integer scaling and aspect expansion remain enabled. This keeps the HUD large at television distances. Camera framing reserves space below the actor for the HUD. Standard/large captions page all words in at most two lines, within the bottom safe margin. Contrast and shake have separate settings. Captions use a high-contrast strip at the bottom, and the redundant gantry label was removed after it overlapped the objective.

Measured 1080p CPU results (milliseconds):

| Candidate | Median frame | p95 frame | p95 simulation | p95 draw | Cold maximum |
| --- | ---: | ---: | ---: | ---: | ---: |
| Viewport wall culling and portrait cache | 11.3 | 24.2 | 4.5 | 21.5 | 1308.0 |
| Added bounded engine-font raster cache | 8.1 | 20.7 | 5.4 | 15.8 | 891.0 |
| Cached build with draw profiling | 6.7 | 15.1 | 4.5 | 11.1 | 1085.3 |
| Audio enabled during concurrent test jobs | 19.0 | 62.1 | 16.9 | 55.2 | 5749.7 |
| Final build, audio enabled, headless jobs finished | 8.4 | 19.5 | 4.8 | 16.8 | 1388.9 |

Each benchmark has 120 warm-up frames and 180 sampled frames. One profiled run meets the initial CPU targets; the final run meets the simulation target but exceeds the 16.7 ms total-frame target. The final run has no engine errors and a 31 ms warm maximum; its full browser contract, audio and benchmark record is `sd-browser-final-contracts-audio-benchmark.txt` in scratch. Variance is material, and concurrent shared CPU load may contribute, but that cause is an inference. The cloud scheduler prevents a 60 Hz end-to-end certification. Cold map/shape baking accounts for large initial draws, with one observed cold frame above five seconds. The load target is therefore not certified; deployment load is checked separately. Do not turn this short benchmark into a hardware-independent performance claim.

Reviewed city, Records and gantry captures show local art, projected depth, clear player marking, crew portraits, objectives, prompts and all three views. The earlier caption overlap and unsupported separator glyph were fixed. Captures are `sd-city-reviewed.jpg`, `sd-records-final.jpg` and `sd-gantry-reviewed.jpg` in scratch. An eight-action filmstrip covers walking/aiming, reload, revive, jumping, seat entry, driving, down/recovery and victory. Reload, interaction and downed states now use blended engine poses. Wheels, occupants, opening doors and smoke give vehicle feedback. The eight-action frames were inspected in two viewport captures (`sd-animation-release-top.jpg`, `sd-animation-release-bottom.jpg`). Full animation/vehicle feel still needs a normal-rate interactive host.

## Acceptance status

| IDs | Evidence / status |
| --- | --- |
| A01–A02 | Engine is a live dependency; original assets and retained MIT notices documented. |
| A03 | Isometric is default and dominant. Corrected 20-seed candidate measured 74.98–81.74% isometric; a rescue detour is just below the strict 75% target. Runs without a rescue detour remain at or above 77.19%. Human-run proportion is unmeasured. |
| A04–A05 | Both approaches/routes complete; explicit arrest, fall, lost vehicle, down/revive and interrupted-action recovery contracts. 52 contracts and all 21 seeded runs pass. |
| A06–A08 | Shared controller/keyboard/mouse model, input contracts and menu navigation verified. Physical controller verification remains unavailable. |
| A09 | Shell pages have at most six actions, visible focus and 32+ pixel main labels at 1080p; short Sound and binding pages reviewed. A real B-key rebind saved, then defaults were restored. Actual couch-distance usability needs a person on a normal-rate display. |
| A10–A17 | Collision, traffic, perception, damage, crew, portals and persistence covered by contracts and mission runs. |
| A18–A24 | Boundary, menu timing, immediate interrupt, debounce, shared AI actions, reset paths and save isolation tested. The four-hour release loop completes 87 wins with no recovery or failure. |
| A25–A26 | Touch gameplay controls disabled; mobile title has only Settings. Raw touch interruption and lifecycle contracts exist. Real mobile and cross-browser verification unavailable. |
| A27–A28 | Three-view visual review and audio lifecycle implemented. Browser runtime has no game errors. Browser audio activation, mute, duck and scheduler disposal pass. Physical listening and normal-rate animation/feel remain unverified. |
| A29–A30 | Content-only new mission, save/restore/payout and replay/diagnostic tools verified. |
| A31 | Warm CPU p95 varies from 15.1 to 62.1 ms. The 16.7/6 ms, sustained 60 Hz and five-second load targets are not certified in this environment. |
| A32 | Local scan passes; production hub iframe and direct URL checks pending. |
| A33 | Requested source facts exist separately in README, HTML and SOURCE-INFO. Final chat must repeat them. |
| A34 | Architecture, authoring, patch provenance and this evidence record supplied. Release details pending. |

## Exact remaining external checks

1. Connect a real DualSense over USB and Bluetooth. Record OS, browser, pad ID/mapping, dead zone, triggers, disconnect and optional vibration. Never call the synthetic fixtures hardware tests.
2. Run a complete keyboard and controller playthrough on a normal-rate browser. Verify control feel, first-time 12–18 minute / practiced 8–12 minute pacing targets, animation, audio mix and ten-foot readability. The automated mission takes 2.3–2.9 simulated minutes and does not prove those human targets.
3. Repeat performance and lifecycle checks in Firefox/WebKit and on the intended TV/reference device. The cloud browser's 1 FPS scheduler prevents an honest sustained 60 Hz claim.

No runtime service, paid asset, account, key, server or physical controller is required to load the game. The limits above concern verification, not an online dependency.

## Regressions retained

The initial long run reached a legal watchdog restart at delivery in seed 552. Mara had reached Broadcast Pier while two following companions remained in combat roughly 700 units away. Their combat branch had suppressed movement indefinitely. The fix combines legal navigation and fire for distant followers and recognizes crew approach as useful watchdog progress. The reproduced seed now succeeds in isolated Node, native Node and rendered Chrome. The earlier failure report is preserved; it is not counted as a passing endurance run.

Watch Demo now consumes the selection event and waits for its release, preventing the title's own confirm from immediately cancelling the requested demo. Three input-family regression cases cover that handoff.
