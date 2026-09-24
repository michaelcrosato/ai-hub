# Runeclash: The Hollow Palace

A finished browser-game vertical slice inspired by the *play structure and tone* of NES-era side-scrolling action RPGs, with an original world, characters, geometry, palette, names, music, and sound effects.

## Run

1. Install Node.js 20+.
2. In this folder, run `npm start`.
3. Open `http://127.0.0.1:4173` in a current browser.

The game pins three.js r186 from jsDelivr for the primary renderer and three.js r162 only for the WebGL 1 compatibility renderer, so the first run needs internet access.

## Graphics path

- **Primary:** three.js r186 `WebGPURenderer`, which uses WebGPU when available.
- **Fallback 1:** the same r186 renderer automatically uses its WebGL 2 backend.
- **Fallback 2:** three.js r162 `WebGLRenderer` is loaded only on WebGL 1-only hardware. Current three.js removed WebGL 1 after r162.
- **Modern effects:** TSL `RenderPipeline` + half-resolution bloom, ACES filmic tone mapping, emissive materials, dynamic directional shadows, limited local lights, fog, flat-shaded low-poly geometry, and adaptive pixel ratio.

## Mission

1. Cross the moonlit approach and climb the broad stair run.
2. Fight through the upper gallery and open the Sun-Key chest.
3. Unlock the lower gate.
4. Optional: climb the side ledges to obtain the Ember Edge weapon upgrade.
5. Earn experience from normal enemies; at level-up choose Attack, Vitality, or Focus.
6. Reach the restored Warden Gate checkpoint and defeat the Ash Warden.
7. Claim the Ember Sigil at the far altar to complete the slice.

The boss is tuned to take at most 12 clean base-blade hits at level 1. The optional weapon cache and earned level reduce that burden, but grinding is not required. Death restores the last checkpoint and keeps mission progress.

## Controls

**Desktop:** A/D or arrows move, Space/W/Up jump, J/X slash, K/Shift guard, Q/C Spark, E/Enter action, mouse wheel zoom.

**Mobile:** left joystick, separate Jump/Slash/Guard/Spark/Action buttons with independent pointer capture for multitouch, and two-finger pinch on the playfield to zoom. The HUD and control layout use safe-area insets and compact landscape rules.

## Tests

- `npm test` validates traversal collision, stair stepping, keyed progression, XP/stat upgrades, optional equipment, guard mitigation, checkpoint recovery, boss base-damage budget, and mission completion.
- `npm run check` syntax-checks every local JavaScript module.

## Originality note

This project does not use Nintendo code, sprites, maps, names, logos, music, character models, symbols, or extracted assets. It is an original homage built around broad mechanics such as side-view sword combat, palace exploration, RPG experience, keys, and guarded enemies.
