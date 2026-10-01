# Dreambound: Crown of the Hollow Sky

A finished browser-RPG vertical slice. It is an original project inspired by the pacing and systems of classic quest RPGs: a mountain village, a simple errand, a parallel-world mystery, exploration, and menu-driven party combat.

No source-game characters, maps, music, dialogue, or proprietary art are included.

## Running it

The game runs on the wall's shared 3D stack: three.js r186 (`WebGPURenderer`, with WebGL2 as the fallback) from `/lib/three/` and the kit from `/lib/kit/`, loaded through the import map in `index.html`. Serve the repository root (not just this folder) with any static server and open `/games/Dragon-Quest-VI-Dreambound-Crown-of-the-Hollow-Sky-2026-09-17-model-unknown/`. Nothing loads from the network.

## Controls

| | Keyboard and mouse | Gamepad | Touch |
|---|---|---|---|
| Move | WASD / arrows | left stick / D-pad | left thumb stick |
| Talk, confirm, advance dialogue | E / Space / Enter | A (or X) | ACTION button, tap the dialogue |
| Dash | Shift | hold B or LT | DASH button |
| Turn the camera | drag with the mouse | right stick | drag on the right |
| Zoom | wheel, + / - | RB / LB | pinch |
| Menu | Esc / P / M | Start | ☰ button |
| Battle commands | 1–4, or arrows + Enter; Backspace undoes | D-pad + A; B undoes | tap a command |

The settings panel (quality, resolution, touch layout, vibration) opens from the menu or with F9.

## The journey

1. Speak to Elder Rowan in Starweave village.
2. Descend Moonstep Pass, survive a field encounter, and find Puck, the crown-maker.
3. Investigate the sky-rift and cross into the Echo Below.
4. Use the mirror well to return.
5. Recover the Starbell Crown and return to the village.
6. Defend the festival in a three-person turn-based boss battle.
7. Complete the slice and unlock free-roam.
8. After the festival: go back through the humming rift, find the Horned King's throne in the Echo Below and win the true ending.

Side quest: light the five lantern stones along Moonstep Pass for the Lantern Charm (+12 max HP for every hero in battle) and two Brightleaf Herbs.

## Features

- Procedural low-poly characters, houses, terrain, foliage and monsters; static props baked into a few meshes
- TSL sky, water and portal materials; bloom; ACES tone mapping; fog; soft sun shadows that follow the party
- Quality tiers, dynamic resolution and the WebGL2 fallback from the kit
- Synthesized WebAudio music and sound effects (no audio files), with music and sound toggles
- Save and continue (position included), best times, Normal and Gentle difficulty
- Damage numbers, screen shake, controller rumble, command undo, button prompts for keyboard, gamepad or touch

## Source layout

- `index.html` — entry point and the shared import map
- `src/main.js` — game, world, battle, rendering, input, audio
- `src/style.css` — HUD and menus
