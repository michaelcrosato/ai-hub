# Verification notes

- `node --check` passes for `bootstrap.js`, `game.js`, and `legacy-webgl1.js`.
- Balance simulation passes for both the mandatory route and a combat-heavy route.
- Mandatory route result: Level 2, 115 max hull, 12 salvage, one Mk II upgrade affordable, 40 armored-only stock rover shots to the 360-HP boss (actual fight is shorter when the core opens).
- Combat-heavy route result: Level 3, 130 max hull, 24 salvage, Mk II upgrade affordable.
- Route refinements include collision rails on the bridge, a destructible choke point, a dismount-only vault entrance, readable signs, an optional Tinker Pad branch, a checkpoint after the gate, and explicit completion feedback.
- This execution container cannot initialize a Chromium GPU/EGL context, so an end-to-end GPU screenshot was not available here. The main WebGPU/WebGL2 path uses current Three.js r186 APIs verified against the official documentation; a raw WebGL1 safety path is included and can be forced with `?legacy=1`.
