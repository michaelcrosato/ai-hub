# Petalwind Meadow — QA report

## Rendering stack validation

The project targets Three.js r186. The modern path uses `WebGPURenderer`, `RenderPipeline`, TSL `pass()`, and `BloomNode`. It prefers WebGPU and keeps the renderer's WebGL2 backend as the normal fallback. A separate Three.js r162 build is used only when the browser has WebGL1 but no WebGL2, because current Three.js no longer supports WebGL1 in `WebGLRenderer`.

The source imports and initialization sequence were checked against the r186 WebGPU renderer and bloom examples. All project JavaScript files pass Node syntax checks.

## Gameplay route QA

A browser integration harness runs the real game update loop with a no-draw Three-compatible test renderer. It validates gameplay independently of GPU availability.

Both the upper and lower routes passed:

- horizontal movement;
- jump response;
- first Dewbell collection;
- guaranteed Spring Soles pickup;
- inhale and borrowed-ability acquisition;
- route-specific second Dewbell;
- route-specific equipment pickup;
- level 2 reached on a normal, non-grind route;
- arena boss spawn;
- boss defeat through the real ability input and cooldown path;
- boss Dewbell collection;
- final Moon Gate completion feedback;
- no browser JavaScript errors.

The upper route finishes with Spring Soles + Glow Pin. The lower route finishes with Spring Soles + Berry Brooch.

## Balance refinement

Initial testing showed that level 2 did not reduce the boss action count. Damage growth was increased to 18% per level. The tuned results are:

- normal route before boss: 86 XP, level 2;
- level 1 boss: 7 full-strength borrowed-ability hits;
- level 2 boss: 6 hits;
- minimal run with no normal-enemy XP and only the basic puff: 13 actions, still completable;
- normal route reaches level 3 at completion;
- upper-route Glow Pin reduces ability cooldown from 0.68 s to 0.5848 s;
- lower-route Berry Brooch gives one additional heart.

## Traversal and collision checks

- maximum upper-route platform edge gap: 2.2 world units;
- maximum lower-route platform edge gap: 1.8 world units;
- lower-route climbs stay at or below 1.8 world units;
- arena gate meets the approach ground without a collision-sized dead gap;
- the goal trigger is reachable before the world clamp;
- stairs are one-way top surfaces so they do not snag horizontal movement;
- decorative railings are intentionally non-colliding so mobile players do not catch on thin geometry.

## Mobile UI QA

A 390 × 844 touch viewport was checked with touch emulation. The HUD and touch controls are visible. The joystick and action cluster do not overlap. The help and sound buttons were moved below the HUD after the first mobile screenshot showed that their original bottom-corner positions overlapped the joystick/JUMP area.

Touch targets after refinement:

- joystick zone: 142 × 142 px;
- JUMP: 76 × 76 px;
- ability: 67 × 67 px;
- inhale: 52 × 52 px.

The implementation uses independent pointer IDs for the joystick and action buttons and listens for two-finger pinch on the render canvas.

## Environment limitation

This build environment blocks external package/CDN downloads and local browser navigation by policy. Therefore the actual r186 GPU renderer could not be executed here. The modern renderer code is pinned to the verified r186 API and the gameplay/UI paths were browser-tested with the no-draw QA renderer. On a normal connected browser, the import map or npm dependencies load the real Three.js renderer.
