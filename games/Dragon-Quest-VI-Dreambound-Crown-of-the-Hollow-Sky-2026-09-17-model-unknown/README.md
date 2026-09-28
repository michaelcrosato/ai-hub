# Dreambound: Crown of the Hollow Sky

A finished browser-RPG vertical slice built with Three.js r186. It is an original project inspired by the pacing and systems of classic quest RPGs: a mountain village, a simple errand, a parallel-world mystery, exploration, and menu-driven party combat.

No source-game characters, maps, music, dialogue, or proprietary art are included.

## Quick run — no install

The default build loads Three.js r186 from jsDelivr. Serve the folder with any local HTTP server:

```bash
./serve.sh
# then open http://localhost:8080
```

On Windows, run `serve.bat`, then open `http://localhost:8080`.

Python is the only local requirement for this route. An internet connection is required once to load Three.js from the CDN.

## npm / Vite run

If you prefer a fully local dependency install:

```bash
npm install
npm run dev
```

For production bundling:

```bash
npm run build
npm run preview
```

## Controls

### Desktop
- Move: WASD / Arrow keys
- Interact / advance dialogue: E / Space / Enter
- Dash: Shift
- Pause: Escape / M
- Battle: click commands

### Mobile
- Left thumb: virtual movement stick
- Right: ACTION and DASH buttons
- Top-right: menu
- Battle: tap commands

## Complete vertical-slice loop

1. Speak to Elder Rowan in Starweave village.
2. Descend Moonstep Pass, survive a field encounter, and find Puck, the crown-maker.
3. Investigate the sky-rift and cross into the Echo Below.
4. Use the mirror well to return.
5. Recover the Starbell Crown and return to the village.
6. Defend the festival in a three-person turn-based boss battle.
7. Complete the slice and unlock free-roam.

## Rendering and game features

- Three.js r186
- ACES filmic tone mapping and sRGB output
- Soft dynamic shadows with mobile/desktop shadow budgets
- Custom low-poly gradient sky shader
- Animated portal and water shaders
- Bloom post-processing and output pass
- Distance fog and multi-source key/fill/rim lighting
- Runtime internal-resolution scaling based on measured frame rate
- Procedural low-poly characters, houses, terrain, foliage, particles, and monsters
- Synthesized WebAudio music and SFX; no audio assets
- Mobile-first touch controls and safe-area-aware UI
- Keyboard controls on desktop
- Local save/continue state
- Quest journal, dialogue system, item chest, healing items, party skills, guard, loss/retry, victory state

## Source layout

- `index.html` — entry point and CDN import map
- `src/main.js` — game, world, battle, rendering, input, audio
- `src/style.css` — mobile-first HUD and menus
- `package.json` — optional Vite workflow

