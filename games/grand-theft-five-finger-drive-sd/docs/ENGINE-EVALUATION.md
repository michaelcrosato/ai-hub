# Engine evaluation — implementation

This evaluation covers the integrated game. Source information is in `SOURCE-INFO.md` and is also recorded separately in the README and HTML.

## What the game uses

- The full **my-3D2dge 0.46.1** handoff and its MIT-licensed assets. The pin is commit `cfa866aa45474868350cad1a7fc015e612f9305f`.
- `E.Game` for the fixed-step loop, scenes, pause, camera, headless advance, errors and rendering.
- `TileMap` for district/records terrain, floor baking, wall depth order, collision, heights and sight. `PlatformMap` and `Platformer` provide the real side-scrolling gantry.
- `Mover` for foot movement, jump, dodge and ledge handling. `Humanoid` provides procedural bodies, poses and portraits.
- `Bullets` for projectile ownership/lifecycle/drawing, with game-side swept impact tests and shared damage.
- The shape/material registry and pixel renderer for original cars, street props, windows and signage. The game also uses the engine's crate/barrel assets.
- `Input`, analog stick data, settings, rebinding, glyphs, `Shell`, menu focus, and sound synthesis/music.

These are live dependencies, not an unused vendor file. The contract suite checks engine classes and clock ownership; browser checks render all three views.

## What the game did not use

The agent edition, 3D first/third-person camera, WebGPU lighting, networking, mocap and unrelated starter scenes are not part of the game. No alternate renderer or game framework is installed.

The game does not use FlowField as its navigation service. A shared heap-based A* query handles different foot/car clearances, car obstacles and road preference. It does not use the engine Store directly for checkpoints; a game-specific two-slot checksummed envelope provides corruption recovery and demo isolation. The custom action-stream replay is separate from the engine's page-recording session tool. Police dispatch, seats, vehicle dynamics, crime reports, economy and mission graphs are game systems added above the engine.

The full bundle remains intact because this is the user's requested foundation, including its menu and asset tools. The game does not ship sample campaigns or link to another engine.

## Findings

The compact fixed-step API and headless `advance()` made it practical to test complete missions, not only individual functions. The three projections share enough conventions to keep a persistent crew across views, while the gantry correctly needs a different body/map pair. The standard Shell supplies useful focus, rebinding and accessibility options; its default sizing required game-specific TV styling and short setting/binding pages. Its existing blendable rig poses also cover reload, revive, interaction, down/recovery and victory without another character renderer.

Vehicle motion and city behavior were the largest additions. Oriented car bodies, collision sweeps, safe exits, road navigation and search behavior need explicit contracts outside the generic Mover. The renderer's one-anchor depth sort is suitable for these short vehicle bodies; larger future vehicles should use multiple depth pieces. Whole-district floor baking has a noticeable cold cost and is not a streaming-world solution.

The initial wall pass scanned every map cell. A small local viewport-culling patch now inverts the existing screen rectangle and visits only a conservative tile range. A regression test compares its queued tiles against the pinned full-scan algorithm in both ground views. The draw benchmark and cloud-browser frame-rate limit are reported in QA; this document does not imply a physical-device 60 FPS certification.

## The one engine change I would prioritize

**A public input-frame API with explicit physical-source ownership.** A kiosk game needs to see an unmapped physical key, a secondary pad's stick or an analog trigger before menus and paused scenes consume input. It must also distinguish those observations from AI/replay actions. The local extension retains analog button values, returns a copied action frame, and adds pre-input and unscaled-frame hooks. A supported upstream contract for those operations would remove the most fragile integration point.

Keep that change narrow. The city game's missions, police and car handling should remain content/game modules, not a compulsory engine rewrite. Exact patches and checks are in `ENGINE-PATCHES.md`.
