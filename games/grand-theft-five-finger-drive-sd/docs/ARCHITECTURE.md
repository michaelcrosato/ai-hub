# Architecture and contracts

## Runtime

The full pinned my-3D2dge engine owns the clock, input sampling, render queue, camera, pixel projection, body movement, bullets, audio, UI and settings. `Drive.App` owns modes and `Drive.Session` owns one disposable world. There is no second engine.

One fixed step is 1/120 second. Engine rendering is independent of the simulation cadence. Ambient cars and pedestrians update at 30 Hz; their motion still uses substeps and the same collision contracts. Crew, combat, witnesses and mission logic update at the base cadence. Seeded xorshift streams separate combat and traffic decisions. No gameplay decision uses `Math.random()`.

`Session.step` orders vehicle movement, actors and actions, swept bullets, witnesses/police, mission validation, event dispatch, pose updates and camera targets. Events have a bounded queue and a 160-entry debug history. World disposal clears listeners, bullets, particles and transient interactions. Scene transitions reuse the play scene; a portal changes the map and controller adapter instead of destroying the crew.

## Input ownership

An action frame contains source, move/aim vectors, analog steering/throttle/brake, held actions, and pressed/released edges. Sources include physical, demo, companion, traffic and police. Synthetic AI frames never enter the physical-activity monitor.

`Physical` observes raw keyboard, pointer, wheel and touch events in capture phase and polls every connected pad, including both sticks and analog-only trigger changes. The engine's new input hook runs before Shell, pause or world update. A demo interrupt consumes input, disposes the demo world, requests title, and holds a neutral-release guard. A new confirm is required. The wall-clock hook permits a title menu to time out while its world is paused. Hidden documents do not accumulate idle time.

The normal pause menu, map and crew selector consume their input. Settings are category pages with at most five setting controls plus Back. Rebinding shows three actions per page and uses the engine capture/conflict checks. A narrow Shell settingKeys extension retains engine sliders/toggles without a long scrolling settings list. The selected driver's triggers affect driving. A passenger can fire while a companion drives. Top-down movement uses the engine's inverse projection; gantry input maps to Platformer x/z movement and ladders. Mobile disables engine touch controls on every input frame.

## World and geometry

The district is 160 × 120 tiles, each 16 units. All ground collision, sight and navigation consult the same TileMap. A car uses three overlapping circles along its oriented body. Movement sweeps in steps of at most three units. Exits test several side/front/rear positions and commit only a free position. Seats acquire and commit in one simulation phase; a failed exit leaves the actor seated.

The spatial grid indexes actors and cars by zone. Road axes, traffic loops, signal periods, patrol points and spawn anchors are content data. Foot A* queries terrain and nearby cars/props. Vehicle A* prefers roads and uses a larger clearance. A binary heap bounds search work. AI driving uses the same acceleration, steering, grip, reverse and collision as the player. Companions leave Records through the shared portal interaction; the director prioritizes a downed crew member even across a zone boundary. Replanning and a reverse maneuver recover many blocked routes. The demo may leave a blocked vehicle and continue on foot.

The service gantry is a PlatformMap, with a Platformer body for each actor in that zone. A moving lift carries grounded actors and a moving cargo obstacle blocks motion and bullets. A fall costs health and returns the actor to the safety-line anchor. The records room is a TileMap with shelves, a wall opening, guards, a camera and the ledger terminal. Portal contracts retain identity, health, ammo, tasks, ability clocks, mission state and other crew members.

## City and combat

Civilians must see a crime to start a report. Reports need 1.6 seconds of valid sight. Death, lost sight, distance or a zone change cancels them. A vault alarm reports its fixed depot location. Police keep a last known point, then investigate/search and reduce heat. Recognition includes a known vehicle and paint color; a different car or respray can break distant recognition. Close observation can identify the crew again. Heat can deploy a roadblock and support arrest.

Weapons, melee, falls, explosions and vehicle contact share `Session.damage`. Bullets use swept line/circle tests and TileMap rays. Team rules prevent crew fire from damaging the crew. Armor, stagger, brief dodge/hazard/revive protection and cover run through this service; ammo and reload are finite. A downed actor has a rescue window, with companion or player revive through normal logic. Losing a crew member gives a retry result.

## Mission and persistence

Mission definitions contain data, not arbitrary callbacks. Schema-1 registration rejects duplicate mission IDs, missing references and unknown goals. Startup validates definitions and budgets; the authoring validator flood-fills ordinary ground routes and rejects blocked spawns or unreachable destinations. Supported goal kinds are interact, vehicle, reach, entry, flag, gather, escape and deliver. `updateMission` validates outcomes after simulation. A bot cannot set progress, payout or completion directly. Branches, start points and vehicle choices are content fields.

Checkpoints use a checksummed schema-1 envelope, monotonically increasing generation and two alternating slots. A torn or corrupt latest write falls back to the previous valid slot. Unsupported versions are rejected. A blocked store leaves the current session usable. The payload includes the mission, tick, RNG streams, crew/NPC state, car occupants, witness clocks, gates, camera disable time, lift phase, rewards and test-yard identity. The snapshot can include projectile state for diagnostics, but checkpoint restore clears bullets, target locks, interactions and input. Runtime Platformer ground references are resolved by stable lift ID. Gate and yard terrain is rebuilt from flags. Reward IDs make payout idempotent.

Each demo has a MemoryStore and never writes a checkpoint. Settings persist only through explicit human changes. Every new demo receives a new Session. The title can draw the previous disposed scene as a frozen background to avoid cold allocation on the interrupting event.

## Attract director and diagnostics

Three full-run variants cycle quiet/forceful approaches and Canal/Market escapes. They exercise walking, entering cars, driving, combat, crew switching, both secondary views, regrouping, heat loss and delivery. The director emits action frames and uses ordinary navigation and interactions. It does not teleport or grant health, ammo, objectives or wins.

Progress checks include objective, zone, gantry waypoint, heat and movement. At five seconds without progress, replan. At twelve seconds, try an alternate action such as leaving a blocked car. At twenty seconds, request a clean recovery after the current simulation tick. A separate objective timeout catches moving loops. Outcomes wait eight seconds before cycling. Recovery never mutates an old world after disposal.

`game.debug` exposes snapshot, seed, state hash, event log, objective trace, raw replay, start/title, yard and expansion entry points. The authoritative state hash includes physical and durable gameplay state while excluding derived navigation and trigonometric caches. A replay records fixed-tick action frames, control/route selection and companion tasks, plus an initial checkpoint. It is bounded to 30 minutes per run. `playReplay()` feeds that stream through the normal simulation. A replay depends on the same engine and game revision.

An explicit Watch the crew request waits for its initiating input to become neutral, then consumes that event before starting. Later input still interrupts immediately. Companion combat intents retain navigation when a following crew member is far from the leader; hold/defend duties remain stationary. Watchdog progress includes a shrinking crew distance, so a leader waiting at extraction does not force a reset while companions are approaching.

## Rendering and audio

The primary render uses a 320 × 180 logical minimum with integer pixel scaling and expansion to the actual aspect ratio. The UI uses large HTML Shell menus and a compact pixel HUD. Shape art, building decoration and vehicle colors are local definitions. Engine Humanoid rigs supply actors. Actor composites, HUD portraits and engine-font strings are cached. The text cache has a hard 256-entry cap. Wall culling in the local engine patch skips cells outside the inverse-projected viewport but retains the original per-tile cull and depth order.

Audio uses the engine synthesizer. No audio files or network streaming are required. Five original arrangements cover title, exploration, tension, pursuit and success. Dialogue ducks the music; short cues cover shooting, movement, doors, impacts, skills, objectives and results. Playback waits for a physical gesture, honors mute and demo-sound settings, and remains silent in headless tests. The game limits short effect bursts and the local engine voice admission patch caps active/scheduled voices at 24. Reset stops the music scheduler; one-shot effects finish within their short envelopes. It does not include streaming radio.

## Presentation ownership

`poseState` and `animateActor` translate existing gameplay fields into the engine Humanoid's blended poses. They do not advance cooldowns, resolve hits or change mission state. The serialized state excludes rigs and cosmetic draw history. A contract compares the state hash before and after posing. Aim, reload, terminal/seat interaction, kneeling revive, down/recovery and victory are distinct. `carDetails` uses the existing depth queue for near-side wheel spokes, window occupants, an opening door and damaged-engine smoke. Quantized shape variants add slight body roll without altering the collider. Muzzle flashes use a transient shot timestamp and disappear with reduced flashes enabled. A gradual dusk tint affects the world before HUD drawing.

Caption layout uses the engine font's measured wrapping. Standard and large modes display at most two lines and advance through every page during the dialogue interval. Text, contrast and shake preferences are engine Settings entries, reused by short Shell pages. At 1920-pixel width, main menu labels resolve to at least 32 CSS pixels. The mobile-only layout is retained until a keyboard or gamepad activity event requests manual controls. That event still exits attract mode and passes through the neutral guard.
