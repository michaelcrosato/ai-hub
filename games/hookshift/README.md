# Hookshift: Iron Canopy

A finished browser-game vertical slice inspired by the grappling-first traversal rhythm and jungle-military tone of the NES era. All game names, geometry, characters, UI, sounds, and level content in this build are original/procedural; no source-game assets are included.

## Play

Fastest path:

```bash
cd hookshift-iron-canopy
python3 -m http.server 8080
```

Open `http://localhost:8080` in a current browser. The static build pins Three.js `0.186.0` from jsDelivr, so the first load requires internet access.

Optional Vite workflow:

```bash
npm install
npm run dev
```

## Mission

Infiltrate Relay Spire 7, cross two grappling gaps, choose high or low routes through a jungle bunker, collect equipment caches, disable patrols/turrets, secure the midpoint checkpoint, climb the relay structure, and hold ACT at the transmitter console.

There is **no normal jump**. Grappling, swinging, reeling, ledge movement, and small automatic step-ups are the core traversal model.

## Controls

Desktop:

- `A / D` or arrows: move / add swing force
- `W / S`: reel cable in / out
- `Space` or `K`: attach/release grapple
- `F` or `J`: fire
- `E`: interact

Mobile:

- Left virtual stick: move and reel
- GRAPPLE: attach/release nearest valid anchor
- Tap a visible grapple ring: target that anchor directly
- FIRE: hold for automatic fire
- ACT: hold at the transmitter console
- Two-finger pinch on the playfield: camera zoom

## Rendering

- Primary: Three.js r186 `WebGPURenderer` / WebGPU
- First fallback: `WebGPURenderer` WebGL2 backend, with an explicit forced-WebGL2 retry if WebGPU initialization fails
- Emergency fallback: custom raw WebGL1 low-detail renderer driven by the same mission state
- AgX tone mapping
- PBR/flat-shaded low-poly materials
- dynamic sun shadows
- exponential fog and layered depth scenery
- emissive grapple/weapon/relay accents
- Three.js `RenderPipeline` with TSL bloom when available
- adaptive render-scale reduction if early frame rate is below 46 FPS

The target quality preset caps pixel ratio lower on coarse-pointer/mobile devices to control bandwidth and thermals.

## Gameplay and progression tuning

- Base grapple range: 10.6 m
- Largest consecutive anchor gap: about 10.24 m, so the critical route never requires grinding or an optional gear cache
- Rank 2: 80 XP, +1 m cable range
- Rank 3: 180 XP, +1 max vitality
- Expected first six hostiles: 210 XP total, enough to reach Rank 3 without clearing the whole map
- Gear caches: Mag-Clamp (+2 m grapple), Servo Reel (faster reel), Pulse Cell (faster fire)
- Player starts with 5 vitality; Rank 3 raises it to 6
- Two field patches are placed before the final tower
- Mid-mission checkpoint prevents replaying the opening gorge after a late death

## Validation performed

`npm run test:smoke` checks the anchor chain, expected-route XP, rank thresholds, and required gear definitions. `node --check` was also run on the main game module and WebGL1 fallback module.

The workspace used to assemble this slice cannot initialize EGL/SwiftShader in its headless Chromium, so a hardware-rendered automated browser playthrough could not be executed in this environment. The route and progression values were therefore refined with deterministic geometry/balance checks plus code-level collision/control review.

## Files

- `src/main.js` — game loop, physics, rendering, controls, AI, combat, progression, level assembly
- `src/data.js` — level layout and balance values
- `src/webgl1Fallback.js` — emergency WebGL1 renderer
- `src/style.css` — responsive/mobile-first HUD and controls
- `scripts/smoke.mjs` — route/progression smoke checks
