# Runeclash: The Hollow Palace

A browser-game slice inspired by the *play structure and tone* of NES-era side-scrolling action RPGs, with an original world, characters, geometry, palette, names, music, and sound effects.

## Run

It runs on the wall's shared 3D stack: open `/games/Zelda-II-The-Adventure-of-Link-Runeclash-The-Hollow-Palace-2026-09-17-model-unknown/` from the ai-hub dev server (any static server at the repo root works). It loads three.js and the kit from `/lib/`, nothing from the network.

## Graphics path

- three.js r186 `WebGPURenderer` through `lib/kit/boot.js`: WebGPU where available, the WebGL2 backend otherwise.
- Quality tiers, resolution scaling and the settings panel come from the kit (Settings in the title and pause menus, or F9).
- TSL bloom (`kit/post.js`), ACES tone mapping, emissive materials, a key-light shadow that follows the camera, four torch point lights, fog, flat-shaded low-poly geometry.
- Static palace geometry is baked into one mesh per material; characters are compacted per material; hit sparks are one instanced batch.

## Palaces

**The Hollow Palace**
1. Cross the moonlit approach and climb the broad stair run.
2. Fight through the upper gallery and open the Sun-Key chest.
3. Unlock the lower gate.
4. Optional: climb the side ledges to obtain the Ember Edge weapon upgrade.
5. Earn experience from enemies; at level-up choose Attack, Vitality, or Focus.
6. Reach the restored Warden Gate checkpoint and defeat the Ash Warden.
7. Claim the Ember Sigil at the far altar.

**The Ember Undercroft** (unlocked by clearing the Hollow Palace; your level and gear carry over)
1. Jump the lava pits. Lava burns and sets you back on the near bank; it only ends the run when it takes your last health.
2. Ember wisps hover high and dive; ash casters hold ledges and lob bolts.
3. Light the three cinder braziers (slash them, Spark them, or use Action) to open the Ember Gate.
4. Optional: climb the forge ledges for the Vessel of Embers (+20 maximum health).
5. Defeat the Cinder Golem: overhead slam, leaps that land with shockwaves (jump them), and a cinder spray.
6. Claim the Ember Crown.

Death restores the last checkpoint and keeps mission progress. Runs save at checkpoints and key moments; Continue on the title picks up where you left off. Story, Normal and Hard difficulties scale damage taken and enemy health. Results show time, level, restores and a rank, with the best time per palace and difficulty.

## Controls

- **Keyboard / mouse:** A/D or arrows move, Space/W/↑ jump, J/X or left click slash, hold K/Shift or right click guard, Q/C Spark, E/Enter action, wheel or Z zoom, Esc/P pause.
- **Controller:** stick or D-pad move, A jump, X/RT slash, hold B/LT guard, RB Spark, Y action, LB zoom, Start pause. Menus work with the D-pad and A/B.
- **Touch:** the stick appears under the left thumb; Jump, Slash, Guard, Spark buttons on the right; Action appears near chests, gates and slates; pinch to zoom; II pauses.

## Tests

- `npm test` validates traversal collision, stair stepping, keyed progression, XP/stat upgrades, optional equipment, guard mitigation, checkpoint recovery, boss damage budgets, save round-trips, difficulty, and the Undercroft's lava, braziers, ledges, wisps and golem.
- `npm run check` syntax-checks every module.

## Originality note

This project does not use Nintendo code, sprites, maps, names, logos, music, character models, symbols, or extracted assets. It is an original homage built around broad mechanics such as side-view sword combat, palace exploration, RPG experience, keys, and guarded enemies.
