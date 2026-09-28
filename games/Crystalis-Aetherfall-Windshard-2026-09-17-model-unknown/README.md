# Aetherfall: Windshard

A finished browser-game vertical slice inspired by the tone and gameplay structure of **Crystalis (NES)**, with original characters, map layout, names, models, UI, text, and audio.

## Play

The game is a static site. Serve the folder over HTTP and open it in a modern browser with an internet connection for the pinned Three.js modules:

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

The first render path is WebGPU. If WebGPU cannot initialize, the game uses WebGL2. If WebGL2 is unavailable, it loads a Three.js r162 legacy WebGL1 renderer.

Renderer test overrides:

- `?renderer=webgpu`
- `?renderer=webgl2`
- `?renderer=webgl1`

## Controls

Desktop: WASD/arrows move, Space attack, hold Space after the Wind Core for a charged wind shot, Shift dash, E interact, mouse wheel zoom.

Mobile: analog stick, BLADE (tap/hold), DASH, ACT. Two-finger pinch controls camera zoom. Movement and action buttons support simultaneous touch pointers.

## Vertical-slice loop

1. Follow the world marker to Gale Mill and speak to Nilo.
2. Defeat ridge raiders and recover three rotor sparks.
3. Restart the mill to open Zephyr Grotto.
4. Claim the Wind Core; it adds a charged projectile attack.
5. Use the charged shot to break the rune wall.
6. Defeat the Stone Gale boss.

An optional side-path chest contains the Ridge Guard, which reduces incoming damage by 16%.

## Rendering

- Three.js 0.186.0 for WebGPU/WebGL2.
- `WebGPURenderer` is the primary backend.
- Current `RenderPipeline` + TSL bloom on WebGPU.
- AgX tone mapping, PBR materials, real-time directional shadows, emissive effects, instanced grass, fog, and adaptive pixel ratio.
- Three.js 0.162.0 is used only for the WebGL1 legacy path because modern Three.js dropped WebGL1 support after r162.

## Balance goals

The required route grants enough experience to reach level 2 before the boss. Extra field enemies can reach level 3, but the Stone Gale has no level immunity or hard damage gate. Dash invulnerability and readable projectile patterns make a no-grind clear viable.
