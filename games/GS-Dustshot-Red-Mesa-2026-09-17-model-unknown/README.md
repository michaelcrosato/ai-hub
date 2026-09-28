# Dustshot: Red Mesa

A finished browser-game vertical slice inspired by the pace, three-direction gunplay, scrolling western town, hidden wanted-poster progression, and upgrade economy of the NES version of *Gun.Smoke*. All code, models, UI, names, audio, level layout, and visual assets in this project are original/procedural.

## Play

Run a local web server from this folder:

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080` in a modern browser. A network connection is required on the first load because the Three.js runtime is pinned to jsDelivr. The included service worker caches successfully fetched modules and local game files for later visits.

For a renderer-independent emergency test, add `?fallback=1` to the URL. Add `?legacy=1` to request the WebGL1 compatibility path.

## Controls

**Mobile:** left virtual joystick moves. Right virtual joystick aims and fires. Use two fingers on the world view to pinch-zoom. Multitouch input keeps both joysticks independent. Move near the gunsmith and tap **TRADE** to buy upgrades.

**Desktop:** WASD or arrow keys move. Mouse aims. Hold the primary mouse button or Space to fire. Mouse wheel zooms. Press **E** near the gunsmith to trade.

## Mission loop

1. Fight north through Cinder Creek.
2. Break suspicious crates and recover the hidden WANTED poster.
3. Pick up optional equipment: Spurred Boots and Silver Rounds.
4. Buy one or two meaningful upgrades at the gunsmith. The economy is tuned so the player must choose rather than buy the full shop at the midpoint.
5. The poster opens the stockade fight with Marshal Vex.
6. Beat the boss to complete the slice. Completion gives score, accuracy, time, level, damage-taken feedback, and career XP.

Career Renown adds only `$10` starting cash per rank. It does not add direct combat power. The base kit is tuned to beat the boss without grinding.

## Rendering stack

- Three.js **r186 / 0.186.0** modern path.
- `WebGPURenderer` is the primary renderer. It selects WebGPU where available and uses its WebGL2 backend when WebGPU is unavailable.
- Three.js `RenderPipeline` plus TSL bloom on the modern path when the post-effect module loads.
- ACES filmic tone mapping, directional shadows, hemisphere fill light, exponential fog, procedural dust, low-poly geometry, generated canvas signs, and dynamic camera shake.
- Mobile pixel-ratio caps and a low-quality shadow toggle reduce bandwidth and fill cost.
- WebGL1 backup uses Three.js **r162 / 0.162.0** because Three.js removed WebGL1 support from `WebGLRenderer` in r163.
- Canvas2D is an emergency last fallback if a Three.js CDN import cannot load.

Current Three.js references used during implementation:
- https://threejs.org/docs/pages/WebGPURenderer.html
- https://threejs.org/docs/pages/RenderPipeline.html
- https://github.com/mrdoob/three.js/wiki/Migration-Guide
- https://www.npmjs.com/package/three

## Balance and refinement notes

The route uses a wide central lane, edge-biased obstacles, sliding circle-vs-AABB collision, visible porches, stairs, rails, town signs, a gated objective, and a reversible camera route so a missed poster can be recovered. An early fence was moved to the street edge after route simulation showed it could trap a direct path toward the poster.

Base weapon: two projectiles, 12 damage each, 0.17 s fire interval. Standard enemies need about two to four clean volleys. The boss has 1120 HP, spread fire, a half-health reinforcement phase, and is beatable at level 1 with no paid upgrades when the player dodges. Normal full-stage play lands near level 5.

Mid-run upgrade prices are `$210–$290`. Typical midpoint income supports about two purchases. Optional equipment and XP improve comfort but are not required for completion.

## Validation

Run:

```bash
npm test
```

The deterministic simulation checks verify:
- the central path and warrant gate;
- breakable poster recovery;
- a level-1, no-upgrade boss clear;
- upgrade economy constraints.

The project also includes an emergency 2D path so gameplay can still initialize if external Three.js modules are unavailable. The sandbox used to build this package blocks headless-browser navigation, so the renderer path was statically checked and the gameplay loop was exercised through deterministic simulation tests rather than a WebGPU browser run in the build environment.
