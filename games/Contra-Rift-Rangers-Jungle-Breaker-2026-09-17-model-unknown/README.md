# Rift Rangers: Jungle Breaker

A browser run-and-gun inspired by the cadence and jungle-assault tone of NES-era
Contra, with original procedural low-poly art and original level layouts.

## Run

It runs on the hub's shared 3D stack: three.js r186 (`WebGPURenderer`, WebGPU
with an automatic WebGL2 fallback) loaded through the standard import map, and
the kit in `/lib/kit/` for startup, quality tiers, settings (F9), input and
touch controls. Serve the repository root (`pnpm dev`) and open
`/games/Contra-Rift-Rangers-Jungle-Breaker-2026-09-17-model-unknown/`.

## Operations

**Operation 01 // Jungle Front**
1. Break the first jungle outpost.
2. Choose the upper bridge (weapon cache) or the ground route (armor, health).
3. Cross the creek checkpoint.
4. Destroy the fortified bunker core.
5. Reach the extraction pad.

**Operation 02 // Rift Falls** (unlocked by clearing Operation 01)
1. Take the cliff ledge (snipers, the S-FAN spread gun) or the gully below it.
2. Cross the river under the falls while mortar crews shell the banks.
3. Clear the relay compound and its bridge.
4. Bring down the Rift Walker: it fires three-way volleys, lobs shells and
   stomps a shockwave along the ground (jump it). Below half health it
   overheats and speeds up.

New enemies in Operation 02: mortar crews (a red ring marks where the shell
lands; a bridge deck is cover), snipers (a laser paints you, blinks, then one
fast round) and the Rift Walker. Each operation hides three intel drives off
the main line.

The player can finish at weapon level 1. A normal route reaches level 2; a
thorough route or the weapon cache reaches level 3. Deaths return you to the
last checkpoint with XP and defeated enemies kept.

## Controls

| | Keyboard / mouse | Controller | Touch |
|---|---|---|---|
| Move | WASD / arrows | left stick / D-pad | left thumb stick |
| Jump | Space | A | JUMP |
| Fire (auto-aims) | J / left click | X / RT | FIRE (hold) |
| Grenade | K / Shift / right click | B / LT | GREN |
| Zoom | wheel, + / − | LB / RB | pinch |
| Pause | Esc / P | Start | II |

Menus work with the D-pad or stick, A to pick and B to go back.

## Progress

Stored in this browser: unlocked operations, best score, rank and time per
operation and difficulty, and the last checkpoint (CONTINUE on the title).
Difficulties: Recruit (7 vitals, slower fire), Ranger (the original tuning),
Veteran (4 vitals, faster fire, x1.5 score). `?unlock` in the URL unlocks every
operation for testing.

## Checks

```bash
node test/balance.mjs
node test/mission-sim.mjs
```

Boss time-to-kill, XP thresholds, route progression, checkpoint spacing and
stair rise for every operation.
