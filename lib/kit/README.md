# The 3D kit

Every 3D game on the wall runs on one foundation:

| Piece | Version | Where |
|---|---|---|
| three.js | r186 (0.186.1), `WebGPURenderer` from `three/webgpu`, WebGL2 fallback | `/lib/three/` |
| Rapier | 0.20.0 (SIMD build where wasm SIMD exists, plain build otherwise) | `/lib/rapier/` |
| The kit | boot, renderer, quality tiers, settings menu, input, touch, physics, post, points | `/lib/kit/` |

The rule of thumb: **share the foundation, not the gameplay.** Hosting, startup,
renderer setup, quality tiers, the settings panel, input plumbing and physics
setup come from here. Every game keeps its own mechanics, feel and art. Games
stay comparable because they follow the same conventions (versions, units,
action names), not because they share gameplay code.

`example.html` in this folder is a complete small game that uses every piece.
Read it before migrating anything.

---

## 1. The page head

Every 3D game carries this block, unchanged, in `<head>` before any module
script. No game embeds or downloads its own copy of three.js, and nothing
loads from a CDN.

```html
<script type="importmap">
{
  "imports": {
    "three": "/lib/three/three.webgpu.js",
    "three/webgpu": "/lib/three/three.webgpu.js",
    "three/tsl": "/lib/three/three.tsl.js",
    "three/addons/": "/lib/three/addons/",
    "kit/": "/lib/kit/"
  }
}
</script>
<link rel="modulepreload" href="/lib/three/three.core.js" />
<link rel="modulepreload" href="/lib/three/three.webgpu.js" />
```

- `three` and `three/webgpu` are the same file, so addons that import
  `'three'` share one copy. `WebGLRenderer` does not exist in it, on purpose.
- Addons live under `three/addons/` exactly as in `examples/jsm/`. WebGL-only
  ones (EffectComposer and `postprocessing/`, `shaders/`, `Sky.js`,
  `Water.js`, `Reflector.js`, `Lensflare.js`, `CSM.js`) are not shipped. Use
  their node versions: `objects/SkyMesh.js`, `objects/WaterMesh.js`,
  `objects/Water2Mesh.js`, TSL `reflector()`, `objects/LensflareMesh.js`,
  `csm/CSMShadowNode.js`, `lines/webgpu/Line2.js`.
- Keep the hub's head tags: `<title>`, `<meta name="description">`,
  `<meta name="theme-color">`, the icon link and `og:image`. The wall reads them.

## 2. Boot

```js
import * as THREE from 'three/webgpu';
import { boot } from 'kit/boot.js';

const kit = await boot({
  title: 'Skybreak',        // loading card; defaults to document.title
  physics: true,            // loads Rapier → kit.RAPIER (omit if the game has no physics engine)
  input: { /* actions, see §4 */ },
  // renderer: { antialias: false },  // e.g. a deliberately pixelated look
  // mount: document.querySelector('#stage'),  // if the canvas lives in a panel, not the window
  // canvas: existingCanvas,  // reuse a canvas the page already has
  // gear: 'tl',              // settings button corner: tr (default), tl, br, bl, none
  // holdLoading: true,       // keep the loading card until kit.loading.done()
});

const scene = new THREE.Scene();
const camera = kit.fitCamera(new THREE.PerspectiveCamera(60, 1, 0.1, 500));
await kit.renderer.compileAsync(scene, camera);   // optional: no shader hitches on the first frames

kit.start((dt, t) => {           // dt in seconds (clamped to 0.1), t in seconds
  update(dt);
  kit.renderer.render(scene, camera);   // or post.render()
});
```

What `boot()` does, so games don't:

- Shows a loading card, then removes it after the first frame (or on
  `kit.loading.done()` with `holdLoading`). Use `kit.loading.progress(0.5, 'Loading textures…')`
  while building. A game with its own title screen keeps it: the card only
  covers startup.
- Starts `WebGPURenderer`: WebGPU with a conservative device (see §6), WebGL2
  if WebGPU is missing, refuses, or failed on this device before. If the GPU
  device is lost it says so and offers a restart on WebGL2.
- Picks the quality tier, sets the pixel ratio, sizes the canvas to the window
  (or `mount`) and keeps it sized. Dynamic resolution holds the frame rate
  when the Resolution setting is Auto.
- Wires keyboard, mouse, gamepad and touch into `kit.input` and builds the
  on-screen touch controls from the actions.
- Adds the settings gear (also **F9**, and `kit.menu.open()` for a game's own
  pause menu). Opening it pauses the loop.
- Runs the loop with `setAnimationLoop`. Never call `requestAnimationFrame` for
  the game loop yourself.
- Publishes `window.__kit` (`backend`, `tier`, `frames`, `fps`, `errors`,
  `ready`, `bootMs`) for automated checks.

The kit object:

| | |
|---|---|
| `kit.renderer` | the initialised `WebGPURenderer` |
| `kit.backend` | `'webgpu'` or `'webgl2'`; `kit.backendLabel` for a HUD |
| `kit.tier` | `{ name, pixelRatio, msaa, shadowMapSize, post, detail, drawDistance }` |
| `kit.onQuality(fn)` | the player changed quality: re-apply shadow sizes, counts, draw distance |
| `kit.shadow(light, 2048)` | size a light's shadow map for the tier (2048 at *high*) and keep it sized when quality changes; `kit.shadowSize(2048)` gives just the number |
| `kit.detail(count)` | a count (particles, props, crowd) scaled for the tier |
| `kit.input`, `kit.touch` | §4 |
| `kit.fitCamera(cam)`, `kit.onResize(fn)`, `kit.size` | sizing |
| `kit.start(fn)`, `kit.stop()`, `kit.pause(bool)`, `kit.onPause(fn)` | the loop (pause audio in `onPause`) |
| `kit.menu` | `open()`, `close()`, `toggle()`, `isOpen`, `setGear(corner)` |
| `kit.RAPIER` | Rapier namespace when `physics: true` |
| `kit.setPixelHeight(lines)` | fixed low-resolution rendering with hard pixels (0 = native), §5 |
| `kit.toast(text)` | a small notice |

## 3. Quality tiers

| | low | medium | high | ultra |
|---|---|---|---|---|
| pixel ratio cap | 1 | 1.5 | 2 | 3 |
| MSAA | off | off (FXAA in `createPost`) | 4× | 4× |
| shadow map (for a game that uses 2048 at high) | 512 | 1024 | 2048 | 4096 |
| post | lite | lite | full | full |
| `detail` / `drawDistance` | 0.5 / 0.7 | 0.75 / 0.85 | 1 / 1 | 1.25 / 1.25 |

Auto picks **medium** on phones and tablets (a Galaxy S25 holds 60 fps there)
and **high** on desktops (tuned for an RTX 3060). Ultra is only chosen by hand.

**Tiers scale cost, never the art style.** Everything that defines a game's
look stays on at every tier: bloom on a neon game, fog, outlines, toon
shading, the palette. A tier makes these cheaper (smaller maps, fewer
particles, lower resolution), it does not remove them. If a game genuinely
needs to drop an expensive extra (screen-space reflections, a second shadow
cascade), do that only on `low`.

## 4. Input: keyboard and mouse, gamepad, touch, always all three

Games ask about **actions**, never devices. Define them in `boot({ input })`:

```js
input: {
  move:   { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick' },
  look:   { type: 'look', mouse: 'locked', gamepad: 'rightStick', touch: 'drag' },
  jump:   { keys: ['Space'], gamepad: ['A'], touch: 'Jump' },
  fire:   { keys: ['KeyJ'], mouse: [0], gamepad: ['RT', 'X'], touch: 'Fire' },
  gas:    { type: 'axis', keys: { pos: ['KeyW', 'ArrowUp'], neg: ['KeyS', 'ArrowDown'] },
            gamepad: { pos: 'RT', neg: 'LT' }, touch: { pos: 'Gas', neg: 'Brake' } },
  pause:  { keys: ['Escape', 'KeyP'], gamepad: ['Start'], touch: { label: 'II', slot: 'top' } },
}
```

Reading them each frame:

```js
const mv = kit.input.vector('move');      // {x, y}; y is up/forward; length ≤ 1
const lk = kit.input.look('look');        // {x, y} radians of turn this frame (sensitivity and invert-Y applied)
if (kit.input.pressed('jump')) …          // went down this frame
if (kit.input.down('fire')) …             // held
kit.input.value('gas');                   // -1..1 (axes) or 0..1 (analog triggers)
kit.input.zoom();                         // mouse wheel + pinch this frame, + is in
kit.input.pointer;                        // {x, y, nx, ny, down, justDown, justUp, type} over the canvas
kit.input.source;                         // 'keyboard' | 'gamepad' | 'touch' — for button prompts
kit.input.rumble(0.5, 120);               // controller rumble / phone haptics
kit.input.lockPointer();                  // call from a click to start mouse-look
```

The **standard bindings**, so every game feels familiar:

| Action | Keyboard / mouse | Gamepad | Touch |
|---|---|---|---|
| move | WASD + arrows | left stick + D-pad | floating stick, left half |
| look / aim | mouse (pointer lock for first/third person; drag for orbit cameras) | right stick | drag on the right side |
| primary (jump / confirm / accelerate) | Space (Enter in menus) | A | big button |
| fire / attack | left click or J | RT or X | button |
| secondary (special / brake / back) | right click, K, Shift | B, LT | button |
| interact | E | X or Y | button (show only when relevant: `kit.touch.setShown`) |
| pause / menu | Esc or P | Start | top pill |
| camera zoom | wheel | RB/LB or right-stick click | pinch |

- Presses are latched: a tap that goes down and up between two frames still
  reports `pressed()` once. `kit.input.settle()` makes everything currently
  held count as already held (the kit calls it when its settings panel
  closes, so the button that closed it does not also fire in the game; call
  it yourself after the game's own modal UI).
- Enter and Space on a focused DOM button or link are left to the button
  (a native click), not reported as actions, so menus never double-fire.
- `touch: 'stick'` gives a floating joystick that appears under the thumb;
  `'stick-right'` a second one for twin-stick aim; `touch: 'drag'` on a look
  action turns free screen area into a camera drag. Up to about five buttons
  fit the cluster; put rarer actions in the top row (`slot: 'top'`).
- `kit.touch.suspend(true)` hides the controls for the game's own menus and
  cutscenes (and `false` brings them back); it is tracked separately from
  the kit's settings panel. The top row of pills defaults to top-centre;
  move it clear of the HUD with `boot({ touch: { top: 'right', topOffset: 56 } })`
  or `kit.touch.placeTop('left', 60)`. The gear takes a corner the HUD does
  not use (`gear: 'tl'`), or `gear: 'none'` when the game's own pause menu has
  a Settings button calling `kit.menu.open()`.
- Touch controls appear on touch devices and hide as soon as a keyboard or
  gamepad is used. A pointer-driven game (tactics, strategy, city builders)
  needs no stick: taps arrive as `kit.input.pointer`, pinch and wheel as
  `kit.input.zoom()`, and two-finger/drag camera moves as look.
- A game's own DOM menus must work with a gamepad too: drive them from actions
  (move up/down, primary to confirm, secondary or pause to go back).
- Delete a game's bespoke keyboard, gamepad and touch handlers once the actions
  replace them. Text fields are left alone automatically.

## 5. Rendering rules (both backends, same picture)

`WebGPURenderer` runs node materials. The built-in materials
(`MeshStandardMaterial`, `MeshBasicMaterial`, `MeshLambertMaterial`,
`MeshPhongMaterial`, `MeshToonMaterial`, `SpriteMaterial`, `LineBasicMaterial`…)
work unchanged; they are converted to node materials behind the scenes.
Everything below is **not** available and must be rewritten:

| WebGL-only | Use instead |
|---|---|
| `new THREE.WebGLRenderer()` | `boot()` → `kit.renderer` |
| `ShaderMaterial`, `RawShaderMaterial` | a `*NodeMaterial` with TSL nodes (`colorNode`, `positionNode`, `emissiveNode`, `opacityNode`, `normalNode`, `fragmentNode`, `vertexNode`) |
| `material.onBeforeCompile` | the same node slots on the node material |
| `EffectComposer` + passes | `kit/post.js` (`createPost`) or `THREE.RenderPipeline` with TSL: `bloom`, `fxaa`, `smaa`, `ao` (GTAO), `ssao`, `outline`, `dof`, `film`, `rgbShift`, `chromaticAberration`, `afterImage`, `pixelationPass`, `lut3D`, `vignette`, `scanlines`, `sepia`, `dotScreen`, `gaussianBlur`, `godrays`, `ssr`, `traa` from `three/addons/tsl/display/*.js` |
| `THREE.Points` with `size > 1` | `kit/points.js` (`createPoints`) — WebGPU draws `Points` at 1 px |
| `PCFSoftShadowMap` | `PCFShadowMap` (set `light.shadow.radius` for softness) or `VSMShadowMap` |
| `renderer.getContext()`, raw `gl.*` calls | not available; use three.js objects |
| `readRenderTargetPixels` | `await renderer.readRenderTargetPixelsAsync(...)` |
| fullscreen `ShaderMaterial` quad | `new THREE.QuadMesh(nodeMaterial)` and `quad.render(renderer)` |
| `Sky`, `Water`, `Reflector`, `Lensflare`, `CSM`, `Line2` (WebGL) | `SkyMesh`, `WaterMesh`, `reflector()`, `LensflareMesh`, `CSMShadowNode`, `lines/webgpu/Line2.js` |

### GLSL → TSL cheat sheet

```js
import { Fn, uniform, attribute, varying, texture, uv, vec2, vec3, vec4, float, color,
         time, sin, cos, mix, smoothstep, step, fract, floor, clamp, saturate, dot, normalize,
         length, pow, abs, max, min, If, Discard, positionLocal, positionWorld, positionView,
         normalLocal, normalWorld, normalView, cameraPosition, screenUV, screenSize,
         instanceIndex, vertexColor, hash, mx_noise_float, triNoise3D, select } from 'three/tsl';
```

| GLSL | TSL |
|---|---|
| `uniform float uTime;` | `const uTime = uniform(0)` → set `uTime.value = t` (or use the built-in `time` node) |
| `uniform vec3 uColor;` | `const uColor = uniform(new THREE.Color(0xff0000))` |
| `uniform sampler2D map; texture2D(map, vUv)` | `texture(mapTexture, uv())` |
| `attribute float aSize;` | `attribute('aSize', 'float')` |
| `varying vec3 vPos; vPos = position;` | `const vPos = varying(positionLocal)` (or just use `positionLocal` in the fragment node) |
| `gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.)` | `material.positionNode = p` (local-space position; projection is automatic) |
| `gl_FragColor = vec4(c, a)` | `material.colorNode = vec4(c, a)`; for unlit use `MeshBasicNodeMaterial`; to bypass lighting and output directly use `fragmentNode` |
| `if (a < 0.5) discard;` | `If(a.lessThan(0.5), () => { Discard(); })` or `material.alphaTestNode` |
| a GLSL function | `const fn = Fn(([a, b]) => { … return x; })`, call `fn(a, b)` |
| `vec3 x = …; x += y;` (mutable) | `const x = vec3(…).toVar(); x.addAssign(y)` |
| `a * b + c`, `a / b` | `a.mul(b).add(c)`, `a.div(b)` (JS operators do not work on nodes) |
| `gl_FragCoord.xy / resolution` | `screenUV` (and `screenSize`) |
| `cameraPosition`, `modelMatrix * vec4(position,1)` | `cameraPosition`, `positionWorld` |
| per-instance data | `instanceIndex`, `instancedBufferAttribute(attr)` |
| noise | `mx_noise_float(p)`, `triNoise3D(p, speed, time)`, `hash(n)` |

Setting a uniform from JS each frame: keep the node (`const u = uniform(0)`)
and write `u.value`. Swapping textures: `const t = texture(tex)` then
`t.value = otherTex`.

### Traps

- **Colour and light from before r152/r155.** Games written for three.js r140
  and similar used linear output and "legacy" light units. Moving to r186
  brightens and shifts colours. Match the original look: if the old code never
  set `renderer.outputEncoding = sRGBEncoding`, put
  `THREE.ColorManagement.enabled = false` before creating materials and set
  `kit.renderer.outputColorSpace = THREE.LinearSRGBColorSpace`; otherwise keep
  the defaults and mark colour textures with `texture.colorSpace = THREE.SRGBColorSpace`.
  For light intensities, multiply ambient, hemisphere and directional
  intensities by `Math.PI`, and for point/spot lights also set `decay = 1`
  (the old default) and multiply by `Math.PI`. Then compare with the baseline
  screenshot and tune until it matches.
- **Face culling from hand-written WebGL.** Many hand-written renderers never
  enabled `CULL_FACE`, so every triangle drew from both sides and their
  meshes rely on it (inconsistent winding, one-sided walls and roofs).
  three.js culls back faces by default: use `side: THREE.DoubleSide` on those
  materials (or fix the winding), and walk around the level to confirm no
  faces vanish. The reverse holds too: if the old code culled, keep `FrontSide`.
- Renamed or removed APIs: `outputEncoding` → `outputColorSpace`,
  `texture.encoding` → `texture.colorSpace`, `THREE.Math` → `THREE.MathUtils`,
  `PostProcessing` → `RenderPipeline`, `pass.setResolution` → `setResolutionScale`,
  `useLegacyLights` gone.
- The first frames compile pipelines. Call `await kit.renderer.compileAsync(scene, camera)`
  after building the scene, and pre-warm materials that appear later (hidden
  meshes in the scene) so the first explosion does not stutter.
- Changing material structure (adding a map, toggling `transparent`) rebuilds
  the pipeline. Prefer uniforms and visibility over creating materials mid-game.
- Many materials cost more than many meshes: share materials, use
  `InstancedMesh` for repeated props, merge static geometry
  (`BufferGeometryUtils.mergeGeometries`).
- `renderer.info.render.calls` still works for checking draw calls.
- A transparent canvas needs `boot({ renderer: { alpha: true } })`; the kit
  defaults to opaque.
- **Never dispose or null `light.shadow.map`** to resize a shadow map (a
  common WebGLRenderer trick). In r186 the shadow node owns its render target
  and re-sizes it from `light.shadow.mapSize` on the next frame; disposing it
  breaks rendering. Just set `mapSize`, or use `kit.shadow(light, base)`.
- `VSMShadowMap` on the WebGPU backend also renders receivers into the shadow
  map and can show moiré acne on slopes that WebGL2 does not; set
  `light.shadow.normalBias` to about 0.04 (and check both backends).
- `createPost`'s `output(color, ctx)` runs again when the player changes
  quality (the chain is rebuilt so FXAA and bloom size follow the tier), so
  keep it free of side effects; `ctx.tier` is the new tier.

### Retro looks (PS1, N64, Super FX, pixelated modes)

Many games render at a low internal resolution with hard pixels, snap
vertices like a PlayStation, or dither colour. The kit does these one way:

```js
import { vertexSnap, dither15 } from 'kit/retro.js';
const kit = await boot({ pixelHeight: 360, renderer: { antialias: false } }); // 360 lines, upscaled with hard pixels
kit.setPixelHeight(0);                       // back to native resolution (e.g. a "Retro" toggle in the game's menu)
vertexSnap(material, { width: 320, height: 240 });   // wobbly PS1 vertices; works with instancing and skinning
const grid = vertexSnap(first); vertexSnap(second, { grid }); // share one grid uniform across materials
createPost(kit, scene, camera, { output: (c) => dither15(c) });  // ordered 15-bit colour dither
```

Nearest-filtered textures: `tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false`.

## 6. WebGPU features: conservative by default

By default the kit creates the WebGPU device itself and asks only for widely
supported optional features (texture compression, float32 filtering,
depth32float-stencil8, rg11b10 render targets, indirect first instance, core
features and limits). Features that have misbehaved on some mobile drivers
(`shader-f16`, `subgroups`, `timestamp-query`, `dual-source-blending`,
`clip-distances`) are left off.

**Advanced WebGPU** (settings panel, off by default, applies after a reload)
lets three.js request every feature the adapter offers and allows heavier
effects. A game can read `kit.settings.get().advanced` to enable its own
extras (compute-driven particles, SSR, GTAO, more shadow cascades). Every
advanced extra must degrade to the normal look when it is off, and must work
on the WebGL2 path too or be skipped there without changing the scene.

## 7. Physics: Rapier 0.20

Use Rapier when a game needs rigid bodies, joints, vehicles or robust
collision queries. Simple kinematic movement against boxes or a heightfield
does not need it; keep hand-written collision when it is small and works.
Games already on cannon, ammo, Havok or an older Rapier move to Rapier 0.20.

```js
import { createWorld, fixedStep } from 'kit/physics.js';
const kit = await boot({ physics: true, … });
const world = createWorld(kit.RAPIER);            // gravity -9.81, 60 Hz
const step = fixedStep(60);
kit.start((dt) => { step.advance(dt, () => world.step()); … });
```

Conventions: meters, seconds, kilograms, gravity −9.81 on Y. A game built at
another scale passes `createWorld(RAPIER, { lengthUnit })` (this also lifts
the 400 units/s speed cap for big-unit worlds). Angular speed caps at 45° per
step, so cars use `world.createVehicleController(chassis)` (raycast vehicle),
not jointed wheel bodies, and bullets are `castRay`/`castShape`, not fast
rigid bodies. Bodies sleep after 0.5 s; wake them when you move them by hand.
Tune restitution, friction and braking against 0.20, not older defaults.

## 8. Leave it better

Whenever a game is touched, also take the cheap wins:

- **Loading:** no CDN requests; big inline base64 assets (images, audio,
  models over ~500 KB in total) move to files next to the game (convert the
  game to a project folder, §9); textures get mipmaps and sensible sizes;
  audio decodes lazily after the first gesture.
- **Runtime:** no per-frame allocations in hot loops (reuse vectors), shared
  geometries and materials, `InstancedMesh`/merged geometry for repeated
  props, frustum culling left on, dispose what is removed, no layout reads
  (DOM measuring) every frame, HUD DOM writes only when values change.
- **Bugs:** fix what you find (errors in the console, stuck states, broken
  restart, resize bugs, audio that never unlocks, things that break on
  pause).
- **Polish:** small, clear improvements only: camera smoothing, input
  buffering, readable HUD at phone sizes, pause on `kit.onPause`,
  controller rumble on hits. Don't redesign the game.

## 9. Files and structure

- A game is either one HTML file in `games/` or a project folder
  `games/<name>/index.html` with its own files. The wall's slug comes from the
  file or folder name, so converting `games/X.html` into `games/X/index.html`
  keeps the same slug (and the same cover). Do that when it helps: extracting
  megabytes of inline assets, or unpacking embedded source into real modules.
  Delete the old single file in the same change.
- Inline `<script>` code that used a global `THREE` becomes a
  `<script type="module">` importing from `three/webgpu`. Module scope is not
  global: anything an inline `onclick="…"` handler calls must be put on
  `window` or the handler replaced with `addEventListener`.
- Minified bundles with three.js baked in cannot keep that copy. Rebuild the
  game from its readable source when the file carries one (JSON-packed
  modules, embedded source maps); otherwise rewrite it on the kit, keeping
  all of its content (levels, story, characters, text, balance numbers).

## 10. Checking a game

Run the checker on both backends and the phone profile:

```
python3 scripts/check3d.py games/<Game>.html --keys KeyW,Space --click
```

It serves the repo, loads the game in Linux Chromium forced to WebGL2 and in
Windows Chrome on the real GPU (WebGPU), then in a Pixel 7 profile with touch,
and reports `window.__kit`, console errors, a blank-screen check and
screenshots. `--keys` and `--click` are played on both desktop paths (on
WebGPU as synthetic events once the game has booted, before its screenshot),
so the screenshots can show gameplay rather than the title screen. A game passes when all three paths boot, render frames, log no
errors, and the WebGPU and WebGL2 screenshots show the same scene as each
other and as the pre-migration baseline.
