# Multiplayer and portable HTML

Version 1.1.0, 2026-11-04 America/Vancouver (2026-11-05 UTC).

User instruction: **Follow https://github.com/michaelcrosato/ai-hub/tree/main/lib/hub for multiplayer integration into ai-hub as well as for the game on its own.**

The implementation follows AI Hub Session Protocol v1 and client 1.4.0 from repository base commit `ced4525b0527500367332427362db6785ab197a0`. The exact `lib/hub/session.js` client is the first executable script in the HTML head. Tests check that it is unmodified. The engine remains my-3D2dge 0.46.1 at its existing pin and local patch hash.

## Play rules

| Mode | Players | Start and finish |
| --- | --- | --- |
| AI Hub ghost race | 1–4 | Same seeded city and crew. A common hub countdown. Deliver the ledger first. |
| Standalone local race | 2–4 | Pass one controller between turns. Each player gets the same seed and an 18-minute turn. |
| Standalone solo | 1 | The original mission, free roam, expansion, checkpoints and autonomous attract loop. |

Each racer controls their own three-person crew. Ghosts show the other players' controlled actor or vehicle in the same zone. They have seat colours and fixed P1–P4 labels. They cannot block cars, fire bullets, alert police, change objectives or enter a save.

A successful run reports elapsed milliseconds; less time ranks first. An unfinished run reports 1,000 points for each completed objective. Finishers rank above unfinished runs. Local menus show the same order. Local ties retain turn order. Pause menus do not stop the local race clock. **End this turn** replaces checkpoint retry in the local pause menu.

Online sessions use AI Hub. Standalone multiplayer uses local turns. The export includes no separate account, relay server or matchmaking service.

## Ownership and lifecycle

`src/multiplayer.js` contains the adapter. It uses the existing game and mission; it does not fork simulation rules.

- `connect({mode: 'ghost', seats: [1, 4]})` creates an isolated mission from the hub seed. `ready()` follows world creation without an input prompt.
- The title and demo are skipped inside a hub round. The pre-input hook holds simulation until `AIHub.time() >= 0`.
- Progress is sent at most once per second. Small ghost packets are sent at most 10 times per second through `AIHub.send`, with `reliable: false`.
- Packet validation checks sender membership, sequence, version, zone, finite coordinates, map bounds, crew and vehicle IDs. Old, malformed and departed-player packets are discarded. Ghosts expire after five seconds without an update.
- A win, failure or time-up produces one result. The adapter stops simulation while the hub shows the result. Host departure does not stop the remaining own-world races.
- `end` removes listeners and ghosts, clears input and rumble, stops music and mutes sound. It sends no later game traffic. Options cannot pause a hub round; Create + Options remains available to the hub.
- Both race modes use memory-only checkpoint storage. Solo 1.0.0 checkpoints remain readable in 1.1.0. Race turns cannot retry a checkpoint or restart the mission to reset their clock.
- Local turn cards and results handle Back, Close and Options without leaving a live finished turn behind.

The catalogue override declares 1–4 players and the `race` tag. The repository's catalogue test maps the current `ghost` protocol mode to the public `race` tag, and `shared-world` to `versus` or `co-op`. Older session modes continue to work.

## Export

Run `node tools/bundle.mjs /absolute/output/NAME.html` from this game folder. Use the naming form `GameTitle-SOURCE-model-effort-stamp.html`. The current export uses `gpt-6-astra` and `unknown` for the unexposed active effort level. The stamp uses America/Vancouver local time.

The bundle includes the official client, engine, game, content, CSS, icon, source information, engine evaluation and MIT license. Runtime scripts execute after the canvas exists. It needs no external asset files. The output must be outside the game source folder, so it does not create a duplicate hub catalogue entry. Generated exports are not committed.

## Verify and extend

Run `node --test tests/*.test.mjs`. The tests include a complete hub mission through all three views, original checkpoint compatibility, local save isolation, protocol lifecycle, malformed packets, departure, one-result ownership and a complete boot of the generated HTML.

The official browser harness is `/lib/hub/harness.html?game=/games/grand-theft-five-finger-drive-sd/index.html&players=4&latency=150&jitter=50&loss=5&auto=1`. Add `scenario=host-leave` for a host departure. QA.md records the cases actually run.

New missions can keep the adapter if they use the existing stage contract. Update the race selection, goal text and suggested duration for that content. New zones must extend the packet bounds allowlist and drawing policy. A shared-city mode needs a separate authority and replication design; ghost messages contain presentation data only.

Physical controller feel and a session across separate real devices still need hardware checks. The browser harness tests the hub protocol with simulated latency and loss. It does not certify real-device latency or the earlier 60 Hz target.
