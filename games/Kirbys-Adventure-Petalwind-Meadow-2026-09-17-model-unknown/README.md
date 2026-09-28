# Petalwind Meadow

An original 2.5D low-poly browser platformer vertical slice inspired by the playful pacing and inhale/borrow loop of 8-bit dream platformers. It uses no Nintendo art, audio, level data, names, or other game assets.

## Run it

### Fast static-server path

The checked-in import map pins Three.js r186 for the WebGPU/WebGL2 path and Three.js r162 for the WebGL1 legacy path. A network connection is required for the pinned jsDelivr module URLs.

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`.

### Local npm/Vite path

```bash
npm install
npm run dev
```

The package pins `three@0.186.0` and aliases `three@0.162.0` as `three-legacy` for the WebGL1 fallback.

## Renderer strategy

- Primary: `WebGPURenderer` from Three.js r186.
- Automatic modern fallback: Three.js r186 WebGL2 backend.
- Legacy fallback: Three.js r162 `WebGLRenderer` when WebGL2 is unavailable, because WebGL1 support was removed from current Three.js after r162.
- Modern effects: Neutral tone mapping, VSM shadows, emissive materials, fog, adaptive pixel ratio, and the r186 `RenderPipeline` + TSL BloomNode path.

## Controls

Desktop: A/D or arrow keys move, Space jumps. Release Space after a jump and hold it again to hover. J inhales. K uses a borrowed ability or a basic air puff. Mouse wheel zooms.

Mobile: left virtual joystick, JUMP, IN, and A buttons. Two-finger pinch changes camera zoom. Controls support independent simultaneous pointers.

## Vertical slice

The mission is a single complete sequence through Petalwind Meadow:

1. Learn jump/hover and inhale on the opening meadow.
2. Collect the first Dewbell and the guaranteed Spring Soles upgrade.
3. Choose the high hover route or the lower shortcut across the broken causeway. Each route has its own equipment reward and a shared second Dewbell objective.
4. Two Dewbells open the arena gate.
5. Fight the Bramble Bell miniboss. A bright ability enemy is placed immediately before the arena so the intended fight does not require grinding.
6. Collect the boss Dewbell and ring the Moon Gate.

Normal exploration reaches level 2 before the boss and level 3 at completion. A minimal no-grind run can fight the boss at level 1 and still finish.

## Tests used during refinement

```bash
node tests/sim-test.mjs
node tests/route-sim.mjs
node tests/geometry-test.mjs
node --check src/game.js
```

The route simulations cover both causeway branches, XP/gear progression, boss action counts, and a minimal no-grind/no-borrowed-ability case. Geometry checks cover branch gaps, lower-route climb height, arena-gate placement, and goal reachability.

## Project structure

- `src/main.js`: renderer capability selection.
- `src/modern.js`: WebGPU/WebGL2 renderer and TSL bloom pipeline.
- `src/legacy.js`: WebGL1 legacy renderer.
- `src/game.js`: world, controls, gameplay, UI, physics, enemies, boss, particles, camera, audio, and completion loop.
- `src/balance.js`: progression and combat tuning.
- `src/style.css`: responsive HUD and multitouch controls.
