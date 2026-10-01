# Strata FPS starter — hub edition

This folder contains the editable FPS starter, two sample levels, the page
contract, and an instruction guide. It is based on Strata Episode Kit v0.2.
It does not contain the spatial editor or the driving sample.

It began as a single HTML file that loaded three.js 0.180 and Rapier 0.19.3
from a CDN. This edition is a plain folder of ES modules on the hub's shared
3D stack: three.js r186 (WebGPU, with WebGL2 where WebGPU is missing),
Rapier 0.20 and the shared kit, all from the site's `/lib` folder.

## Start

Open `index.html` from the hub. The page opens on the sample's menu; pick an
episode and select the play button. "Starter guide" in the menu opens this
guide, the source browser and the logic checks.

The page needs the hub's `/lib/three`, `/lib/rapier` and `/lib/kit` folders at
the site root. Opening the file directly from disk does not work: serve the
repository root, for example `python -m http.server 8000 --bind 127.0.0.1`,
then open `http://localhost:8000/games/<this folder>/index.html`.

## For a coding agent

Start with the user's game brief. Make a copy of this folder and build on that copy.
Do not replace the engine merely to create a different level.

The source of truth is in:
- `index.html`, `script#strata-config`: ordinary JSON for title, save ID, movement, and weapon settings.
- `strata/episode/level.js`: Loading Bay geometry, prefabs, spawn, and wiring.
- `strata/episode/pump-house.js`: Pump House geometry and the supply prefabs (medkit, ammunition box).
- `strata/episode/local-ai.js`: the sentries and the difficulty table.
- `strata/episode/main.js`: weapons, HUD, supplies, objectives, saves, and local behavior.
- `strata/episode/session.js`: the standalone save/completion adapter and the two-episode campaign.
- `strata/fps/FpsGame.js`: the FPS host and lifecycle hooks.
- `app.js`: the page shell — kit boot, menus, episode order, preferences, best times.
- Other modules: reusable movement, physics, rendering, validation, and page contract.
- `style.css` and `section#game-app` in index.html: the sample's presentation.

These files are readable JavaScript, not TypeScript, not bundled and not base64.
They are the code used at runtime. There is no second compiled copy to update.

Strata modules import each other with relative paths. three.js is imported as
`three/webgpu` and shared helpers as `kit/...`; the import map in index.html
resolves both to `/lib`. Do not add a CDN import or a second copy of three.js.

## Keep the design small

Put special AI, controls, physics, and objectives in the episode folder.
Reuse the FPS host only when the sequence is an FPS.
A driving sequence can be another HTML page with another simulation.
The page kit (`strata/kit/`) must not import three.js, Rapier, or FPS code.
Keep one fixed simulation clock. Do not add a second animation loop in episode code:
the page's `kit.start()` loop calls `game.frame(dt)`.
Use Scope to release listeners and resources. Pause on focus loss.
Use bounded JSON and named exits. Never put scene objects in saves.
Preserve unrelated shared data. Change saveId for a new standalone game.
Use a state migration when the meaning of saved data changes.
Do not add a general framework or dependency for one local mechanic.

## Input

Games ask about actions, never devices. `strata/engine/Input.js` defines them for
the shared kit: keyboard and mouse, gamepad and touch all drive the same actions
(move, look, fire, jump, crouch, interact, reload, sprint, respawn, pause).
Presses are latched until a fixed step consumes them. Keyboard keys can be rebound
in the menu; gamepad and touch use the hub's standard layout. Look sensitivity,
invert Y, graphics quality and touch layout are the kit's shared settings (F9).

## Coordinate and level rules

One world unit is one meter. Y is up. The default view faces negative Z.
Document rotations use degrees. three.js and Rapier use radians internally.
Most built-in object origins are at their base.
Entity scale must be from 0.05 through 100 on each axis.
A level needs exactly one spawn component.
Create and register custom prefabs and component validators before level validation.
Visual shapes and collision shapes are separate data.
Sensor-based components need sensor colliders. A trigger on a solid block does not
make that block a sensor. Use the trigger prefab or define a sensor collider.

Built-in components: spawn, switch, door, mover, trigger, pickup, checkpoint,
pad, hazard, goal, relay, counter, and logic. The sample adds two local ones:
`board-car` (Loading Bay's exit) and `supply` (medkits and ammunition boxes).
Doors and moving platforms use kinematic bodies. Carrying applies to dynamic bodies.
A moving platform can carry the player by translation. Rotating support is not included.

Example door component:
```json
{"type":"door","channel":"gate","axis":"y","distance":3.6,"speed":2}
```
Send a signal with `game.runtime.signals.send('gate', true, 'local-rule')`.
Signal work is processed by the existing fixed-step runtime.

## FPS host API

`await FpsGame.create(kit, level, options)` initializes Rapier and creates the game.
`kit` comes from `boot()` in `kit/boot.js`; the game draws with `kit.renderer`.
`game.play()` should be called from a click or key press; with a mouse it captures the pointer.
`game.pause()` clears input and pauses simulation. `game.frame(dt)` runs one frame.
`game.dispose()` releases the owned runtime, input, and scene resources (not the kit).

Options:
- configure({prefabs, schemas, behaviors}): register local definitions before validation.
- beforeStep(dt, game): run local rules before the physics step.
- afterStep(dt, game): read results after the physics step.
- render(dt, game): update visual-only state after runtime interpolation.
- mode(running): update the pause screen.
- notice(text): show an error or status message.
- cue(kind): play a sound for a level event (door, pickup, pad, checkpoint, switch).
- complete(): handle a built-in goal. Pump House's gate uses it; the Loading Bay car calls the exit itself.

Useful objects: game.player, game.input, game.runtime, game.view (scene, camera,
effects), game.assets, game.scope. `game.player.motor.settings` contains live
movement settings. The RenderWorld and PhysicsWorld classes own their resources.
Keep those roles separate. Do not change physics bodies in a render hook.

## Standalone saves and real page exits

The standalone adapter uses the page contract for save validation and named completion.
Its virtual route base is never fetched. Loading Bay's car takes the `finish` exit to
Pump House; Pump House's gate takes the `finish` exit to the result. Both stay in this page.

Browser local storage is preferred, so progress survives a reload; memory storage is
used when storage is blocked. Progress saves itself when a sentry falls or a cell or
supply is taken, and Save checkpoint stores it at once. A checkpoint stores defeated
sentries, collected cells and supplies, health, armor, ammo and run statistics. It does
not store arbitrary rigid-body poses. Loading one starts at the episode's safe spawn.
Export and Import move a save between browsers; Reset deletes it (best times stay).

For a real collection, serve same-origin HTML pages with a campaign manifest.
Use `connectEpisode(id, manifestURL, notice)` from `strata/kit/browser.js`.
Add each entry and its named exits to that manifest. Call `session.complete(exit,
{local, shared})` when the exit is reached. Loading another document creates a fresh
runtime. The player may need another click to capture the mouse.
The page contract does not sandbox untrusted contributors.

## Source export

The guide can export this folder as a ZIP: the page, the modules, the tests, this
guide and the license. The exported page still expects `/lib/three`, `/lib/rapier`
and `/lib/kit` at the site root. Run `node tests/run.mjs` for the pure tests.

## Acceptance checks

Run the pure logic checks after each change (`node tests/run.mjs`, or Run logic checks
in the guide). Then play-test in a browser on both renderers (`?kit-backend=webgl2`
forces the fallback): start, pause, resume, walk, sprint, jump, step, crouch, blocked
stand, reload, shoot a wall, shoot a sentry, carry a crate, throw it, die, respawn,
save, import, restart, finish both episodes, open the guide, and play again.
Check the browser console. Test with a gamepad and on a touch device.
Do not report a supplied or blocked test as passed.

## Current verification

60 pure checks pass in Node.js. They cover both sample levels, the movement policy,
weapon timing, JSON validation, cleanup ownership, and the two-episode save transitions.
Rendering, Rapier integration and complete play were not verified by these checks.
This is a starter, not a production-certified engine.

## Dependencies and license

Strata source: MIT, copyright 2026 Strata contributors. Preserve LICENSE.txt.
Runtime libraries come from the hub's shared stack:
- three.js r186: `/lib/three/` (WebGPURenderer, node materials, addons)
- Rapier 0.20: `/lib/rapier/` (through `kit/physics.js`)
- The shared kit: `/lib/kit/` (boot, input, touch controls, quality tiers, post)

The third-party library bytes are not part of this folder. Their terms remain separate.
The optional GLB adapter loads a separate local model file from `assets/`.

References:
https://threejs.org/manual/en/installation.html
https://rapier.rs/docs/user_guides/javascript/getting_started_js/
https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules
https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API
