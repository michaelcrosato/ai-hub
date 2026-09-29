# Petalwind Meadow

An original 2.5D low-poly browser platformer vertical slice inspired by the playful pacing and inhale/borrow loop of 8-bit dream platformers. It uses no Nintendo art, audio, level data, names, or other game assets.

## Stack

Runs on the wall's shared 3D stack: three.js r186 `WebGPURenderer` (WebGPU, WebGL2 fallback) started by `/lib/kit/boot.js`, with the kit's quality tiers, settings panel (gear or F9), input actions and touch controls. Bloom comes from `kit/post.js`. Serve the repository root (the page loads `/lib/...`), for example `python3 -m http.server` from the repo, and open `/games/Kirbys-Adventure-Petalwind-Meadow-2026-09-17-model-unknown/`.

## Controls

| | Keyboard / mouse | Gamepad | Touch |
|---|---|---|---|
| Move | A/D or ←/→ | left stick or D-pad | floating stick |
| Jump / hover | Space (release, then hold again in the air to hover) | A | JUMP |
| Inhale | J or left click | X or RT | INHALE |
| Borrowed ability | K, Shift or right click | B or LT | ABILITY |
| Zoom | mouse wheel | LB / RB | pinch |
| Pause | Esc or P | Start | II |

Menus take Space/Enter or A to confirm, the stick or arrows to move between buttons, and B or Start to go back.

## Vertical slice

The mission is a single complete sequence through Petalwind Meadow:

1. Learn jump/hover and inhale on the opening meadow.
2. Collect the first Dewbell and the guaranteed Spring Soles upgrade.
3. Choose the high hover route or the lower shortcut across the broken causeway. Each route has its own equipment reward and a shared second Dewbell objective.
4. Two Dewbells open the arena gate.
5. Fight the Bramble Bell miniboss. A bright ability enemy is placed immediately before the arena so the intended fight does not require grinding.
6. Collect the boss Dewbell and ring the Moon Gate.

Normal exploration reaches level 2 before the boss and level 3 at completion. A minimal no-grind run can fight the boss at level 1 and still finish.

## Balance checks

```bash
node tests/sim-test.mjs
node tests/route-sim.mjs
node tests/geometry-test.mjs
```

The route simulations cover both causeway branches, XP/gear progression, boss action counts, and a minimal no-grind/no-borrowed-ability case. Geometry checks cover branch gaps, lower-route climb height, arena-gate placement, and goal reachability.

## Project structure

- `src/main.js`: boot through the kit, renderer settings, bloom, the frame loop.
- `src/game.js`: world, gameplay, menus, HUD, enemies, boss, particles, camera and audio.
- `src/balance.js`: progression and combat tuning.
- `src/style.css`: HUD and panels.
