# Hookshift: Iron Canopy

A grappling-first side-scroller with the jungle-military tone of the NES era.
Every name, model, sound and level in it is original and procedural; no
source-game assets are included.

There is **no normal jump**. Grappling, swinging, reeling, ledge movement and
small automatic step-ups are the whole traversal model.

## Play

It is a static page on the ai-hub wall. It loads three.js r186 and the shared
kit from `/lib/` (see `lib/kit/README.md`), so serve the repository root
(`pnpm dev`) and open `/games/Bionic-Commando-Hookshift-Iron-Canopy-2026-09-17-model-unknown/`.
Nothing is downloaded from a CDN and there is no build step.

## Missions

- **01 Iron Canopy**: infiltrate Relay Spire 7. Cross two grappling gaps, pick
  the high or low route through the jungle bunker, collect the gear caches,
  secure the midpoint checkpoint, climb the relay structure and hold ACT at the
  transmitter console.
- **02 Storm Spillway**: a flooded dam valley in a thunderstorm. Cable-trolley
  anchors slide along their lines, hover drones drop to your firing line, the
  floodwater is lethal, and two checkpoints split the run. Jam the uplink at the
  top of the floodgate tower.

Each mission has three difficulties (Recruit, Regular, Veteran), a par time, a
grade (S/A/B/C from time, field resets and accuracy) and a best time per
difficulty. Reaching a checkpoint saves the run, and the briefing offers to
continue it. All of this is kept in `localStorage`.

## Controls

| | Keyboard / mouse | Gamepad | Touch |
|---|---|---|---|
| Move / swing | A / D or arrows | left stick or D-pad | stick (left half) |
| Reel in / out | W / S or arrows | stick up / down | stick up / down |
| Grapple / release | Space or K, or click a ring | A | GRAPPLE, or tap a ring |
| Fire | F / J or left click | X or RT | FIRE (hold) |
| Act (console) | E | Y | ACT (appears at the console) |
| Zoom | wheel, + / − | LB / RB | pinch |
| Pause | Esc or P | Start | II |

Menus work with every device: the stick or arrows move between buttons, A /
Space / Enter select, B or Start backs out of the pause menu.

## Rendering

- three.js r186 `WebGPURenderer` started by `kit/boot.js`: WebGPU, with WebGL2
  as the fallback, quality tiers, dynamic resolution and the settings panel.
- AgX tone mapping, flat-shaded PBR low-poly models, a sun shadow that follows
  the camera, exponential fog, TSL bloom from `kit/post.js`.
- Static level geometry is merged into one mesh per material; bullets come
  from a pool; sparks are one instanced mesh; the storm's rain, floodwater and
  spill gates are animated in TSL on the GPU.

## Tuning

- Base grapple range: 10.6 m. Every mandatory swing in both missions fits inside
  it, so no gear cache or rank is required to finish.
- Rank 2: 80 XP, +1 m cable range. Rank 3: 180 XP, +1 max vitality.
- Gear caches: Mag-Clamp (+2 m grapple), Servo Reel (faster reel), Pulse Cell
  (faster fire). Two field patches per mission.
- Vitality 5 (Recruit 7, Veteran 4), +1 at Rank 3.

## Files

- `index.html`: the page, HUD and the briefing, pause and results cards
- `src/main.js`: game loop, movement and rope, enemies, combat, progression,
  missions, menus, audio and level assembly
- `src/data.js`: level layouts and balance values for both missions
- `src/style.css`: HUD and cards, laid out around the kit's touch controls
- `scripts/smoke.mjs`: route and progression checks for mission 01 (`node scripts/smoke.mjs`)
