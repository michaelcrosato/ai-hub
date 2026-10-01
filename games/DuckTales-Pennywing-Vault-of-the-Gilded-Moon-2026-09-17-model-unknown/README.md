# Pennywing: Vault of the Gilded Moon

A mobile-first browser-game vertical slice inspired by the treasure-platforming rhythm of classic 8-bit adventure games. It uses original characters, names, level geometry, audio, and art assets.

## Play

Serve the hub's repository root (the game needs `/lib/three/` and `/lib/kit/`) and open `/games/DuckTales-Pennywing-Vault-of-the-Gilded-Moon-2026-09-17-model-unknown/`. Nothing loads from the network beyond the game's own files and `/lib/`.

### Controls

| | Keyboard / mouse | Controller | Touch |
|---|---|---|---|
| Move | A/D or ←/→ | left stick or D-pad | floating stick, left half |
| Jump | Space, W, ↑ or Z | A | JUMP |
| Bounce (springstaff pogo) | hold X, K, J, Shift or the mouse button | hold X, B or RT | hold BOUNCE |
| Use (Springsmith) | E or Enter | Y | USE (shown at the shrine) |
| Zoom | wheel or +/− | LB / RB | pinch |
| Pause | Esc or P | Start | II |

Menus work with the mouse, arrows/WASD + Enter, a controller (D-pad/stick + A, B to go back) or touch. Settings (quality, touch layout, vibration) sit in the title and pause menus; F9 opens them anywhere.

## Expeditions

**Vault I — the Vault of the Gilded Moon** (the original mission)

1. Explore the main path, fast high road, or risky lower treasure detour.
2. Recover the **Moon Gear** from the upper route.
3. Spend treasure at the **Springsmith** if desired.
4. Defeat the **Brassback Sentinel** with springstaff bounces.
5. Claim the **Gilded Moon**.
6. Escape to the entrance before the vault timer expires while masonry falls around the route.

**Vault II — the Sunken Orrery** (new)

A flooded clockwork observatory: stepping-stone pillars over the overflow, optional high arches, a drained cistern under the aqueduct that hides the **Star Key** (and a cracked cache), scalding steam vents on a cycle, Gearbats, a sliding carriage and a piston lift over the flood, and the **Orrery Warden** — a six-hit guardian that charges, hops, and sends sparks along the dome floor when it lands. Then a 70-second escape.

The stock springstaff defeats the Sentinel in five clean bounces and the Warden in six; the 70-coin Springstaff Coil upgrade cuts both to three. Upgrades are optional. Explorer XP grants extra hearts, and upgrades and XP persist through `localStorage`.

## Features

- Three difficulties (Explorer, Adventurer — the original balance — and Daredevil), with best time, best treasure and clears kept per vault and difficulty, and an S/A/B/C rank on the results screen.
- Checkpoints along each vault, autosave, and **Continue expedition** from the title.
- Pause menu (resume, restart, save and quit, settings, sound), the Springsmith's Heart Tonic, buffered jumps and coyote time, a guardian health bar, camera shake, particles and controller rumble.

## Rendering stack

- Three.js r186 `WebGPURenderer` through the hub kit: WebGPU, or WebGL2 where WebGPU is missing. Quality tiers scale resolution, shadows, MSAA/FXAA and particle counts.
- AgX tone mapping, a camera-following directional shadow, fog, emissive low-poly materials, TSL bloom, a TSL caustic shimmer on the water.
- Static geometry merged per material, coins and gems instanced, shared geometry and materials: a vault draws in a few dozen calls.

All playable geometry is generated at runtime from Three.js primitives. No copied sprites, maps, character models, music, or textures are included.

## Tests

```bash
npm run test:all
```

The tests cover XP thresholds, permanent upgrades, five-hit and three-hit boss balance, completion state, the full objective loop, high-road jump reachability, the lower treasure route rejoin, and for Vault II every required jump in both directions, the cistern drop, vents, Gearbats, the Warden (six/three hits, hops and sparks), a scripted clear, and save/continue.

## Project layout

- `src/game/core.js` — deterministic gameplay, collision, enemies, guardians, difficulty, progression, mission state, run export/import.
- `src/game/level.js`, `src/game/level2.js`, `src/game/levels.js` — the vaults' collision and content data.
- `src/game/sceneFactory.js` — low-poly runtime scene construction, pools, particles and animation.
- `src/game/audio.js` — original procedural Web Audio effects and chiptune-style music.
- `src/main.js` — kit boot, input actions, menus, camera, HUD, saves.
