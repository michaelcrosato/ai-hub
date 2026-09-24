# Subterra Spark: Vaultbreaker

A small original browser-game vertical slice inspired by the exploration/combat structure and colorful subterranean tone of **Blaster Master**. All art, level geometry, characters, enemies, names, and audio are original and procedural.

## Run

The game is a static site. WebGPU requires a secure context, so use localhost or HTTPS rather than opening `index.html` directly.

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

The primary path uses Three.js r186 (`0.186.0`) from jsDelivr. `WebGPURenderer` prefers WebGPU and uses its WebGL2 backend when WebGPU is unavailable. A local raw-WebGL1 legacy path loads only when WebGPU and WebGL2 are unavailable, or when the Three.js module cannot load.

## Mission loop

1. Destroy the crystal choke point with the Crawler.
2. Follow the upper route to Vault 03.
3. Dismount and clear the vault on foot.
4. Recover the phase capacitor and return outside.
5. Install the capacitor at the east gate.
6. Optionally spend 12 salvage at the Tinker Pad for a 24% weapon upgrade.
7. Defeat the M.O.L.E. excavation engine.

Normal mission enemies provide enough XP and salvage for useful progression. Side-route pickups reduce difficulty but are not required.

## Controls

Desktop: WASD move, mouse aim, left mouse/F fire, Space boost, E action/mount/dismount, wheel zoom.

Mobile: left movement stick, right aim stick, FIRE, BOOST, ACTION. Two-finger pinch on the play field adjusts camera distance. The controls use independent pointer IDs so movement, aiming, and firing work at the same time.

## Rendering features

- Three.js r186 WebGPURenderer with WebGPU-first selection and WebGL2 fallback.
- TSL animated phase-gate shader shared across WebGPU/WebGL2 backends.
- ACES filmic tone mapping, physically based materials, fog, dynamic emissive lighting, real-time shadows.
- WebGPU `BundleGroup` for static world geometry when available.
- Procedural low-poly geometry and CanvasTexture signage. No external art assets.
- Device-pixel-ratio cap for mobile thermals/bandwidth.

## Notes

The game needs internet access to load the pinned Three.js r186 module from jsDelivr. The WebGL1 legacy path has no external dependency.
