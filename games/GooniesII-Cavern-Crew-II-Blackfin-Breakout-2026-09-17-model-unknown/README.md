# Cavern Crew II: Blackfin Breakout

A finished browser-game vertical slice inspired by the playful rescue-adventure tone, nonlinear exploration, item gates, hidden routes, traps, and arcade combat of **The Goonies II**. All characters, level geometry, names, dialogue, music, and art are original.

## Play

From this folder:

```bash
python3 serve.py
```

It serves the whole repository (the game loads the wall's shared `/lib/three` and `/lib/kit`) and prints the game's URL. There is no build step and nothing loads from the internet.

## Mission

1. Open the orange locker in the boathouse and equip the sling-kit.
2. Explore the central trap hub and recover the **Gear Seal**.
3. Take the flooded branch, find the **Grip Sneakers**, and recover the **Tide Seal**.
4. Take the north stairs to the lookout, find the **Quartz Headlamp**, and recover the **Echo Seal**.
5. Spend scrap at the hub workbench. Paid upgrades are useful but not required.
6. Use all three seals to open the Smuggler Gate.
7. Cross the rope bridge, clear the vault, and free Mara.

### Secret: the old pump room (optional)

A sign in the flooded grotto points at hollow-sounding rock in its east wall. Three sling hits crack it open onto the smugglers' pump room, where Dex — the second lost crew member — is caged under flood water. Spitters lob slime globs, three steam vents cycle on and off, and each of the three rusty valves shuts one vent and lowers the water. Drain the room, free Dex, and he hands over his **Triple-Stone Pouch**: every sling shot throws three stones from then on. The results screen counts the crew you brought home.

## Controls

The title screen shows the controls for the device in use.

- **Keyboard and mouse:** WASD or arrows move · Space, F, J or left click shoot (hold to keep throwing) · E or Enter use · Shift or K dash · right-drag or Q/R turn the camera · wheel or +/− zoom · Esc or P pause · M sound.
- **Gamepad:** left stick or D-pad move · A or RT shoot · X or Y use · B or LT dash · right stick camera · LB/RB zoom · Start pause. Menus work with the D-pad, A and B.
- **Touch:** floating stick on the left · SHOT · DASH · USE (appears next to things you can use) · drag the view to turn the camera · pinch to zoom · II pill to pause.

## Features

- Pause menu (resume, settings, sound, save and quit), automatic save at checkpoints, seals, the gate, the bench and pause; **Continue** on the title screen.
- Three difficulties: **Relaxed** (three extra hearts, slower enemies, no scrap lost on a knockout), **Normal** (the original tuning) and **Tough** (enemies take 50% more hits and attack faster).
- Results screen with time, level, enemies, crew rescued, upgrades and knockouts; best escape time and most crew rescued per difficulty.
- Controller rumble and phone haptics on hits, throws, valves and the rescue; hit flash, camera shake and enemy hit pop.

## Rendering stack

- The wall's shared stack: **three.js r186** `WebGPURenderer` (WebGPU, with its WebGL2 backend as the fallback), booted by `kit/boot.js`, which also owns quality tiers, the settings panel (F9), input and the touch controls.
- TSL node-material water ripple, ACES filmic tone mapping, fog, a directional shadow that follows the player (sized by the quality tier), flickering torch lights and a headlamp spotlight.
- The static cave is merged into one mesh per material (about a dozen draw calls); characters share geometry and materials; stones, slime globs and debris come from fixed pools, so nothing is allocated mid-game.
- Low-poly, brick-like characters and environments built entirely from procedural geometry. No external models or textures.

## Progression design

- Three objective seals grant 48 XP total, enough for level 2 even if combat is minimized.
- A normal pre-gate clear provides 158 XP, enough for level 3 before the final route.
- Guaranteed crates and the fixed scrap pickup provide 12 scrap, enough for **Sling Power +1** and the **Padded Jacket** without random drops.
- A level-2 player with no paid upgrades needs 7 hits on the final brute; the normal upgraded route needs 4.
- Death returns the player to the last safe checkpoint with full health and a small scrap penalty (none on Relaxed), so failure does not force a grind reset.
- The secret pump room adds 38 XP of objectives, 4 scrap and four optional enemies; it never gates the main mission.

## QA

```bash
npm test
```

`tests/validate.mjs` checks route clearance (including the secret branch), floor continuity, stairs, gate and cracked-wall ordering, UI wiring, the shared-stack import map, difficulty bounds and progression.

`tests/playthrough.mjs` simulates the intended full mission, the same run with the pump-room side quest, and that run on Tough.

See `QA.md` for the latest tuning result.
