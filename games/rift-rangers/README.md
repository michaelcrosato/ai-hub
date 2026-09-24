# Rift Rangers: Jungle Breaker

A finished browser-game vertical slice inspired by the run-and-gun cadence and jungle assault tone of NES-era Contra, with original procedural low-poly art, original level layout, and original presentation.

## Run

No package install is required. The game imports pinned Three.js builds from jsDelivr.

```bash
npm start
```

Open `http://localhost:8080`.

## Renderer strategy

- Primary: Three.js `0.186.0` `WebGPURenderer` using WebGPU when available.
- Backup: the same modern renderer on its built-in WebGL2 backend.
- Last-resort WebGL1: a separate compatibility path using Three.js `0.162.0`, the last release line before WebGL1 support was removed from `WebGLRenderer`.
- Modern path: ACES filmic tone mapping, dynamic resolution scaling, soft shadows, exponential fog, emissive materials, instanced foliage, and TSL/RenderPipeline bloom.

## Mission

1. Break the first jungle outpost.
2. Choose the upper bridge or ground route.
3. Cross the creek checkpoint.
4. Destroy the fortified bunker core.
5. Reach the extraction pad.

The player can finish at weapon level 1. A normal route naturally reaches level 2; a thorough route or weapon-cache pickup reaches level 3. This keeps upgrades useful without making grinding mandatory.

## Controls

Desktop: WASD/arrow keys move, Space jumps, J or left mouse fires, K throws a grenade, mouse wheel zooms, Esc pauses.

Mobile: left virtual joystick moves, FIRE can be held while moving, JUMP and G are independent touch buttons, and two-finger pinch changes camera zoom. Multi-touch is supported so movement and actions can occur at the same time.

## Validation

```bash
npm run check
```

This performs JavaScript syntax checks and progression/boss time-to-kill balance assertions.
