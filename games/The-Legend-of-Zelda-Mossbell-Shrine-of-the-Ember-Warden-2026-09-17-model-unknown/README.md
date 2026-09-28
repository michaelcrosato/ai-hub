# Mossbell: Shrine of the Ember Warden

A finished, original low-poly action-adventure vertical slice inspired by the exploration/combat rhythm of early top-down fantasy adventures. It does not use Nintendo assets, maps, characters, music, or story text.

## Run

Serve this folder over HTTP. Example:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080/`.

The modern 3D path uses three.js r186 from jsDelivr. On first successful load, the service worker caches fetched modules. If the CDN cannot load, or if the modern renderer cannot initialize, the game switches to the local WebGL1 compatibility renderer. You can also force it with `?legacy=1`. Add `?low=1` to disable shadows and post-processing.

## Controls

- Desktop: WASD or arrows to move, Space to attack, Shift to guard, E to use, Q to dash, mouse wheel to zoom.
- Mobile: left joystick to move, BLADE to attack, GUARD to defend, USE/DASH for context action, two-finger pinch to zoom.
- The touch controls accept simultaneous movement, guard, and action input.

## Mission loop

1. Explore Sunmeadow and ring three gold chimes.
2. Enter the Mossbound Gate.
3. Claim the Bronzeleaf Edge from the ruin chest.
4. Defeat two ruin wardens to open the inner seal.
5. Defeat the Ember Warden.
6. Claim the Ember Bell to complete the slice.

## Rendering and performance

- Primary: `WebGPURenderer` with WebGPU.
- Backup: the same renderer with its WebGL2 backend.
- Legacy backup: local direct WebGL1 renderer with the same mission and progression but reduced visuals.
- AgX tone mapping, PBR/flat-shaded materials, dynamic sun shadows, fog, emissive cues, instanced grass, dynamic lights, procedural particles, and TSL bloom through three.js `RenderPipeline`.
- Adaptive pixel ratio reduces GPU load when sustained frame rate is low. `?low=1` removes the expensive effects.
- All 3D content is procedural primitives. There are no external texture, model, or audio asset downloads.

## Progression tuning

The required path does not require grinding. The ruin chest grants enough XP to reach level 2 if the player avoided every optional enemy. It also upgrades the blade. At level 2, each warden takes about three blade hits and the boss takes about nine. Optional meadow fights can put the player near or at level 3 before the boss, which gives a modest health/damage advantage rather than gating completion.

## QA notes

- Protected spawn zones prevent procedural trees from blocking quest landmarks.
- A collision/reachability pass verifies routes between all mandatory objectives.
- The cliff line makes the gate the only northbound route; tower colliders stop corner cutting.
- Railings protect the stair transition and are collidable.
- Player death returns to the latest checkpoint with full health and no XP loss.
- The boss resets on a shrine return so the encounter cannot be trivialized by death-state persistence.
