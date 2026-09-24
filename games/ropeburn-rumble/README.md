# RopeBurn Rumble — Neon Circuit

An original, mobile-first arcade boxing vertical slice inspired by the read-and-react rhythm of 8-bit console boxing games. It uses no copied characters, sprites, music, names, or game data.

## Run

Serve this folder over HTTP. For example:

```bash
python3 serve.py
```

Then open `http://localhost:8765`. You can set a different port with `PORT=9000 python3 serve.py`.

The game dynamically loads Three.js r186 (`three@0.186.0`) from cdnjs. `WebGPURenderer` uses WebGPU first and WebGL2 as its built-in fallback. If the modern module cannot load or initialize, the same fight simulation continues with a local raw-WebGL1 compatibility renderer. A Canvas safe mode is included only for devices with no WebGL context at all.

## Controls

- Mobile: left joystick = slip/duck; L/R = punch; hold Guard; Rush when the meter is full; pinch the arena to zoom.
- Keyboard: A/D = slip; S = duck/body modifier; J/K = punches; L = guard; Space = Rush.

## Vertical slice

- Three 60-second rounds, score decision if no TKO.
- Telegraphed enemy jab, cross, hook, and uppercut patterns.
- Late-windup counters, stamina/guard break, momentum special, knockdowns, get-up sequence.
- Between-round temporary corner boosts.
- Persistent XP, credits, equipment unlocks, and modest stat progression in local storage.
- Procedural Web Audio effects.
- Low-poly arena and fighters, PBR lighting, shadows, ACES tone mapping, fog, hit flashes, impact meshes, camera shake, and dynamic pixel ratio on the Three.js path.

## Rendering compatibility

Current Three.js does not support WebGL 1. Support ended after r162. This project therefore keeps the current Three.js renderer for WebGPU/WebGL2 and implements the last-resort WebGL1 path directly with small GLSL shaders, while sharing all gameplay/state logic.

## Test

Run `node tests/smoke.cjs` for the deterministic combat and input smoke test. See `QA.md` for the current test results.
