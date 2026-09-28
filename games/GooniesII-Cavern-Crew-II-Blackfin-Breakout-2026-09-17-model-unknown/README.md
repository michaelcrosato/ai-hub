# Cavern Crew II: Blackfin Breakout

A finished browser-game vertical slice inspired by the playful rescue-adventure tone, nonlinear exploration, item gates, hidden routes, traps, and arcade combat of **The Goonies II**. All characters, level geometry, names, dialogue, music, and art are original.

## Play

From this folder:

```bash
python3 serve.py
```

Then open `http://localhost:8765`.

An internet connection is required when the page first loads because the project pins official Three.js modules from jsDelivr. There is no build step.

## Mission

1. Open the orange locker in the boathouse and equip the sling-kit.
2. Explore the central trap hub and recover the **Gear Seal**.
3. Take the flooded branch, find the **Grip Sneakers**, and recover the **Tide Seal**.
4. Take the north stairs to the lookout, find the **Quartz Headlamp**, and recover the **Echo Seal**.
5. Spend scrap at the hub workbench. Paid upgrades are useful but not required.
6. Use all three seals to open the Smuggler Gate.
7. Cross the rope bridge, clear the vault, and free Mara.

## Controls

### Phone / tablet

- Left virtual joystick: move.
- **SHOT**: sling projectile with a forgiving forward-cone auto-aim.
- **USE**: lockers, seals, workbench, gate, rescue cage.
- **DASH**: short invulnerable burst.
- Drag one finger on the 3D view: rotate camera.
- Pinch the 3D view: zoom camera.

### Desktop

- WASD or arrow keys: move.
- Space or F: shoot.
- E or Enter: use/interact.
- Shift: dash.
- Left click: shoot.
- Right-drag: rotate camera.
- Mouse wheel: zoom.

## Rendering stack

- **Three.js 0.186.0** modern path.
- **WebGPURenderer** is the primary renderer. It uses WebGPU when available and its WebGL2 backend otherwise.
- **Three.js 0.162.0** is a separate WebGL1 compatibility path because current Three.js no longer supports WebGL1.
- TSL node-material water ripple on WebGPU/WebGL2.
- ACES filmic tone mapping, PBR materials, fog, directional shadow map, local point lights, headlamp spotlight, instanced cave detail, and adaptive device-pixel ratio.
- Low-poly, brick-like characters and environments built entirely from procedural geometry. No external models or textures.

## Mobile-first performance profile

- Mobile DPR starts at 1.45 maximum and adapts down if sustained frame rate falls.
- Mobile directional shadow map is 1024×1024; desktop uses 2048×2048.
- Point lights do not cast shadows.
- Cave clutter uses instancing.
- Camera collision prevents common wall clipping while keeping the camera high enough for touch navigation.
- Main corridors are 4.6–6.2 world units wide for a 1.1-unit-diameter player.

## Progression design

- Three objective seals grant 48 XP total, enough for level 2 even if combat is minimized.
- A normal pre-gate clear provides 158 XP, enough for level 3 before the final route.
- Guaranteed crates and the fixed scrap pickup provide 12 scrap, enough for **Sling Power +1** and the **Padded Jacket** without random drops.
- A level-2 player with no paid upgrades needs 7 hits on the final brute; the normal upgraded route needs 4.
- Death returns the player to the last safe checkpoint with full health and only a small scrap penalty, so failure does not force a grind reset.

## QA

Run both deterministic QA passes:

```bash
npm test
```

`tests/validate.mjs` checks route clearance, floor continuity, stairs, gate ordering, UI wiring, fallback pins, and progression bounds.

`tests/playthrough.mjs` simulates the intended full mission, combat XP, guaranteed scrap spending, final fight, and rescue completion path.

See `QA.md` for the latest tuning result.
