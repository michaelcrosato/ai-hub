# Subterra Spark: Vaultbreaker

A small original top-down rover-and-pilot shooter inspired by the exploration/combat structure and colourful subterranean tone of **Blaster Master**. All art, level geometry, characters, enemies, names and audio are original and procedural.

## Run

The game runs on the hub's shared 3D stack (three.js r186 `WebGPURenderer` with automatic WebGL2 fallback, plus the kit in `/lib/kit/`), so serve the **repository root** and open the game folder:

```bash
python3 -m http.server 8080        # from the repo root
# open http://localhost:8080/games/BM-Subterra-Spark-Vaultbreaker-2026-09-17-model-unknown/
```

Nothing loads from the network except the game's own files and `/lib/`.

## Files

| File | What it holds |
|---|---|
| `index.html` | head tags, the standard import map, HUD and menu markup |
| `src/main.js` | boot, input actions, game state, enemies, bosses, saving, menus, loop |
| `src/areas.js` | both areas as data + build functions, difficulty, loadouts, upgrades, enemy stats |
| `src/models.js` | shared materials (TSL gate curtains and lava), cached geometry, every model, the static-geometry merger |
| `src/audio.js` | synthesised sound: blips, noise bursts, Crawler engine, area drones |
| `src/style.css` | HUD and menus (kept clear of the kit's touch controls) |
| `tests/balance-sim.mjs` | `node tests/balance-sim.mjs`: XP/salvage economy over the real area layouts |

## Areas

**Area 01 · Cinder Aquifer** (the original mission)

1. Destroy the crystal choke point with the Crawler.
2. Follow the upper route to Vault 03, dismount and clear it on foot.
3. Recover the phase capacitor and return to the surface.
4. Install the capacitor at the east gate terminal.
5. Optionally buy fittings at the Tinker Pad (Coil Barrel Mk II, then the Arc Splitter; a hull patch once fully fitted).
6. Defeat the M.O.L.E. excavation engine (hit its core right after a charge).

**Area 02 · Ember Foundry** (new)

1. Knock out the two slag pylons that feed the heat field (one sits across the lava river).
2. Vault 07: two security waves, then cross the lava trench for the coolant core.
3. Cool the east heat gate and dig out the T.H.R.E.S.H. burrower, which surfaces under you (watch the ring) and calls hopper drones when enraged.

New enemies in the foundry: **hoppers** crouch, then leap at you; **mortars** lob shells at a marked ring. The Crawler shrugs off lava; a pilot on foot burns fast.

Clearing Area 01 carries your level, salvage and fittings into Area 02; starting Area 02 directly gives a standard level-3 Crawler. Progress, best times and grades (S/A/B/C against par) are saved per area and difficulty (Scout, Pilot, Veteran), and a run in progress can be continued from its last checkpoint.

## Controls

| | Keyboard / mouse | Gamepad | Touch |
|---|---|---|---|
| Move | WASD / arrows | left stick / D-pad | left thumb |
| Aim | mouse | right stick | right thumb (aims and fires) |
| Fire | left click / F / J | RT / X | FIRE |
| Boost | Space / Shift / right click | A / LT | BOOST |
| Action (mount, dismount, doors, terminal, Tinker Pad) | E | Y | ACTION (shown when there is something to do) |
| Zoom / view | wheel, + / −, Z | LB / RB, right-stick click | pinch, View pill |
| Pause | Esc / P | Start | II pill |

Menus work with the mouse, keyboard (arrows + Enter), gamepad (D-pad/stick + A, B to go back) and touch. Settings (quality, resolution, touch layout…) are in the pause menu and on the title screen, or F9.
