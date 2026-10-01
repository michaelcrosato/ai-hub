# Dustshot: Red Mesa

A browser-game vertical slice inspired by the pace, directional gunplay, scrolling western town, hidden wanted-poster progression and upgrade economy of the NES version of *Gun.Smoke*. All code, models, UI, names, audio, level layout and visual assets in this project are original/procedural.

## Play

The game runs on the hub's shared 3D stack (`/lib/three/`, `/lib/kit/`), so serve the repository root, not this folder:

```bash
python3 -m http.server 8080   # from the repo root
```

Open `http://localhost:8080/games/GS-Dustshot-Red-Mesa-2026-09-17-model-unknown/`. Nothing loads from the network except the game's own files and `/lib/`.

## Controls

| | Keyboard and mouse | Controller | Touch |
|---|---|---|---|
| Move | WASD / arrows | left stick, D-pad | left thumb (floating stick) |
| Aim | mouse | right stick | right thumb |
| Fire | left click, Space, J | RT, X, or push the right stick | right thumb (aims and fires) |
| Trade at the shop | E | Y | TRADE button (appears at the shop) |
| Zoom | wheel, + / - | LB / RB | pinch |
| Pause | Esc, P | Start | II pill |
| Menus | arrows + Enter | stick / D-pad + A, B backs out | tap |

Settings (quality, resolution, touch layout, vibration) are on the title screen and in the pause menu (also **F9**).

## Campaign

1. **Cinder Creek.** Fight north through town, break suspicious crates for the hidden WANTED poster, pick up the Spurred Boots and Silver Rounds, buy one or two upgrades at the gunsmith, then take the stockade from Marshal Vex.
2. **Red Mesa Pass.** Your level, cash, upgrades and equipment ride on into a red-rock canyon held by Iron Mae Calloway's gang. Dynamiters lob fused sticks (watch the red landing rings), powder kegs blow up anything near them when shot, and the trading post sells the Scattergun Load and Snake-Oil Tonic. Iron Mae sweeps the claim with a gatling wagon and lights the fuses once she is hurt.

Clearing Cinder Creek saves a checkpoint, so **Continue** on the title screen starts Red Mesa Pass with the kit you finished with. Each stage keeps a best score and best time per difficulty (Greenhorn, Gunslinger, Desperado). Career Renown adds only `$10` starting cash per rank and no combat power.

## Rendering stack

- three.js r186 `WebGPURenderer` through the hub kit (`kit/boot.js`): WebGPU where available, WebGL2 otherwise, quality tiers and dynamic resolution.
- The kit's TSL post chain (faint bloom, FXAA on medium), ACES filmic tone mapping, a PCF sun shadow sized by tier, exponential fog, `kit/points.js` dust.
- Each stage's scenery is merged into one mesh per material; every shop sign shares one canvas atlas. Characters, crates and pickups are merged templates recycled per kind; bullets, dynamite, rings and sparks are instanced pools. Nothing is created or disposed during play.

## Balance

Base weapon: two projectiles, 12 damage each, 0.17 s fire interval. Marshal Vex has 1120 HP, spread fire and a half-health reinforcement phase, and is beatable at level 1 with no paid upgrades when the player dodges. Iron Mae has 1900 HP and is beatable with a level-4 kit and no upgrades. Mid-run upgrade prices are `$210–$320`.

## Tests

```bash
npm test   # node tests/sim.test.mjs
```

The deterministic simulation checks cover both stages' routes and warrant gates, poster recovery, boss clears at the base and mid kits, dynamite and keg blasts, carry-over between stages, the shop economy, and that no spawn, pickup or shop spot sits inside a collider.
