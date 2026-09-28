# Pennywing: Vault of the Gilded Moon

A finished mobile-first browser-game vertical slice inspired by the treasure-platforming rhythm of classic 8-bit adventure games. It uses original characters, names, level geometry, audio, and art assets.

## Play

1. Run `npm start` (there are no npm dependencies), or serve this folder with any static HTTP server.
2. Open `http://localhost:4173`.
3. The game loads Three.js from jsDelivr, so the first load needs internet access.

### Controls

- Mobile: left joystick to move; `JUMP`; hold `BOUNCE` to springstaff-pogo; `USE` at the Springsmith; two-finger pinch on the playfield to zoom.
- Desktop: `A/D` or arrow keys; `Space` jump; `X`, `K`, or Shift bounce; `E` use; mouse wheel zoom.
- Debug renderer selection: add `?webgl2=1` to force the r186 WebGL2 backend, or `?legacy=1` to force the r162 WebGL1 fallback.

## Mission loop

1. Explore the main path, fast high road, or risky lower treasure detour.
2. Recover the **Moon Gear** from the upper route.
3. Spend treasure at the **Springsmith** if desired.
4. Defeat the **Brassback Sentinel** with springstaff bounces.
5. Claim the **Gilded Moon**.
6. Escape to the entrance before the vault timer expires while masonry falls around the route.

The stock springstaff defeats the guardian in five clean bounces. The 70-coin Springstaff Coil upgrade reduces this to three. The upgrade is optional. Explorer XP can grant extra health during the first run, and upgrades persist through `localStorage`.

## Rendering stack

- Primary: Three.js r186 `WebGPURenderer` using WebGPU.
- First fallback: the same r186 renderer with its WebGL2 backend.
- Legacy fallback: Three.js r162 `WebGLRenderer` with an explicit WebGL1 context, because modern Three.js removed WebGL1 support after r162.
- Modern effects: AgX tone mapping, dynamic directional shadows, fog, emissive low-poly materials, r186 TSL `RenderPipeline` bloom, MSAA, mobile pixel-ratio limits, lower-bandwidth mobile output buffers, and instanced background masonry.
- Legacy effects: reduced lights, no shadow map, no post-processing, lower pixel ratio, and simplified background masonry.

All playable geometry is generated at runtime from Three.js primitives. No copied sprites, maps, character models, music, or textures are included.

## Tests

Run:

```bash
npm test
node tests/routes.test.mjs
node tests/autoplay.mjs
```

The tests cover XP thresholds, permanent upgrades, five-hit and three-hit boss balance, completion state, the full objective loop, high-road jump reachability, and the lower treasure route rejoin.

## Project layout

- `src/game/core.js` — deterministic gameplay, collision, enemies, boss, progression, mission state.
- `src/game/level.js` — level collision and content data.
- `src/game/sceneFactory.js` — low-poly runtime scene construction and animation.
- `src/game/modernRenderer.js` — WebGPU/WebGL2 r186 path and TSL bloom.
- `src/game/legacyRenderer.js` — WebGL1 r162 path.
- `src/game/input.js` — keyboard, mobile joystick, multitouch buttons, pinch zoom.
- `src/game/audio.js` — original procedural Web Audio effects and chiptune-style ambience.
- `src/main.js` — HUD, renderer selection, upgrade UI, mission feedback, save data.
