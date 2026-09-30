# Aetherfall: Windshard

A finished browser-game vertical slice inspired by the tone and gameplay structure of **Crystalis (NES)**, with original characters, map layout, names, models, UI, text, and audio.

## Play

The game runs on the wall's shared 3D stack, so serve it from the repository root (it loads `/lib/three/` and `/lib/kit/`):

```bash
pnpm dev   # from the repo root, then open /games/Crystalis-Aetherfall-Windshard-2026-09-17-model-unknown/
```

Progress saves at shrines and quest milestones (localStorage). The title screen offers Continue, a new run, the difficulty (Easy / Normal / Hard) and the shared Settings panel. Best clear times are kept per difficulty.

## Controls

| | Keyboard / mouse | Gamepad | Touch |
|---|---|---|---|
| Move | WASD / arrows | Left stick / D-pad | Left thumb |
| Blade (hold to charge after the Wind Core) | Space, J, left click | A, X, RT | BLADE |
| Dash (brief invulnerability) | Shift, K, right click | B, LT | DASH |
| Act (talk, open, rest, ring) | E | Y | ACT (appears when near) |
| Zoom | Wheel, + / − | LB / RB | Pinch |
| Pause | Esc, P | Start | II |

Menus work with arrows or the stick plus Enter / A; B or Esc backs out of the pause menu.

## Vertical-slice loop

1. Follow the world marker to Gale Mill and speak to Nilo.
2. Defeat ridge raiders and recover three rotor sparks.
3. Restart the mill to open Zephyr Grotto.
4. Claim the Wind Core; it adds a charged projectile attack.
5. Use the charged shot to break the rune wall.
6. Defeat the Stone Gale boss. Afterwards the ridge stays open to explore.

An optional side-path chest contains the Ridge Guard, which reduces incoming damage by 16%.

### The Hollow (side path)

North of the field, through the gap in the cliffs, lies the Hollow: a terraced ruin with three old windbells and a sealed vault, guarded by burrowers that dig toward you and can only be hit once they surface. The bells answer only to wind: once you hold the Wind Core, strike each bell (blade, charged shot or Act). A rung bell hums for about half a minute; ring all three so they sing together and the vault opens. It holds the **Tempest Ring**, which splits every charged shot into three.

Shrines in the village, the mill yard and the grotto attune as you pass them and are where you return after a fall; Act at a shrine restores life and saves. Fallen foes may leave a wind-leaf that heals, and field foes return after a while once you are away from their post.

## Rendering

- three.js r186 `WebGPURenderer` through the shared kit (`/lib/kit/boot.js`), WebGPU first with the kit's WebGL2 fallback.
- Bloom through `kit/post.js` (TSL), AgX tone mapping, flat-shaded PBR materials, emissive effects, fog.
- A sun shadow that follows the hero, sized by the quality tier.
- Cliffs, trees, arena stones, terrace stones, pillars and grass are instanced; shots, hit sparks and pickups are pooled.

## Balance goals

The required route grants enough experience to reach level 2 before the boss. Extra field enemies and the Hollow can reach level 3, but the Stone Gale has no level immunity or hard damage gate. Dash invulnerability and readable projectile patterns (the boss telegraphs its lunge) make a no-grind clear viable.

`node test-progression.mjs` checks these numbers; `python3 test-routes.py` checks the original progression gates against a 2D model of the colliders.
