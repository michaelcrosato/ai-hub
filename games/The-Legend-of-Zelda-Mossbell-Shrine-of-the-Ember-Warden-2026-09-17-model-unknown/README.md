# Mossbell: Shrine of the Ember Warden

An original low-poly action-adventure vertical slice inspired by the exploration/combat rhythm of early top-down fantasy adventures. It does not use Nintendo assets, maps, characters, music, or story text.

## Run

The game runs on the hub's shared 3D kit (`/lib/kit/`, three.js r186 from `/lib/three/`), so serve the repository root and open `/games/<this folder>/`:

```bash
python3 -m http.server 8080   # from the repository root
```

There is no CDN, no build step and no asset download: every model is procedural geometry and every sound is synthesized.

## Controls

| | Keyboard / mouse | Gamepad | Touch |
|---|---|---|---|
| Move | WASD / arrows | left stick / D-pad | left thumb (floating stick) |
| Blade | Space, J, left click | A, X, RT | BLADE |
| Guard (hold) | Shift, K, right click | LT, LB | GUARD |
| Dash | Q | B, RB | DASH |
| Use / read / open | E | Y | USE (appears near things) |
| Zoom | wheel, − / + | right stick | pinch |
| Pause | Esc, P | Start | II |
| Mute | M | | |

Menus work with every device: stick, D-pad or arrows move, A or Enter chooses, B or Start backs out. The settings gear (or F9) opens the kit's quality and control settings.

## Mission loop

1. Explore Sunmeadow and ring three gold chimes.
2. Enter the Mossbound Gate.
3. Claim the Bronzeleaf Edge from the ruin chest.
4. Defeat two ruin wardens to open the inner seal.
5. Defeat the Ember Warden. Below half health it burns hotter.
6. Claim the Ember Bell to complete the slice.

### Side path: the Rootkey Vault

- Two **thornbacks** guard a root-sealed cache in the eastern glade. Their shells turn a blade aside from the front: sidestep the charge and strike a flank, catch them after they ram a wall, tree or standing stone, or meet the charge with a raised guard to bounce them off the shield.
- The cache holds the **Rootkey**, which opens a root-bound door in the west wall of the first shrine chamber.
- Inside, roots seal the door until the vault keepers fall. Then three echo bells must be struck from the smallest voice to the deepest.
- The vault floor raises a chest with a **Heart Container** and the **Ember Charm** (your dash scorches every foe it passes through, and recovers faster).

## Progress and options

- Progress saves at every chime, chest, kill, checkpoint and pause. **Continue** on the title screen resumes at the last checkpoint with full health.
- Difficulty: **Story** (gentler hits, more healing), **Normal** (the original tuning) and **Hard** (heavier blows, quicker foes, a fiercer Ember Warden). Best clear times are kept per difficulty.
- The pause menu returns you to the last checkpoint, opens settings, and toggles music and sound.

## Rendering

- `WebGPURenderer` through `kit/boot.js`: WebGPU where available, WebGL2 otherwise. Quality tiers, dynamic resolution and the settings panel come from the kit.
- AgX tone mapping, flat-shaded PBR materials, a sun shadow that follows the player (so the shrine has shadows too), fog, torch lights and kit bloom.
- Trees, rocks, stones and grass are merged into a handful of meshes; sparks and projectiles are two pooled instanced batches.

## Progression tuning

The required path does not require grinding. The ruin chest grants enough XP to reach level 2 if the player avoided every optional enemy. It also upgrades the blade. At level 2, each warden takes about three blade hits and the boss takes about nine. Optional meadow fights and the Rootkey Vault can put the player at level 3 or above before the boss, which gives a modest health/damage advantage rather than gating completion.

## QA notes

- Protected spawn zones prevent procedural trees from blocking quest landmarks.
- The cliff line makes the gate the only northbound route; tower colliders stop corner cutting.
- Railings protect the stair transition and are collidable. Chimes, signs and chests are solid too.
- Player death returns to the latest checkpoint with full health and no XP loss.
- The boss resets on a shrine return, and so does an unfinished vault fight.
