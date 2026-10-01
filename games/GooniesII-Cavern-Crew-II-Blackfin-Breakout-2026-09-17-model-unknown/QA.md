# QA and refinement notes

## Route and interaction pass

- Spawn is on valid floor and clear of collision.
- Sling locker, all three seals, workbench, gate console, rescue point, valves, Dex's cage and pickups are on valid floor footprints.
- Intended routes pass collision sampling at 0.18-unit intervals:
  - spawn → sling locker
  - locker → hub
  - hub → Gear Seal
  - hub → flooded grotto → Tide Seal
  - hub → stairs → lookout → Echo Seal
  - unlocked gate → rope bridge → rescue vault
  - grotto → broken cracked wall → pump room (secret)
  - pump room → three valves → Dex's cage (secret)
- The cracked wall blocks the pump tunnel until it is broken, and its collision is gone afterwards.
- The flooded grotto seal island is non-blocking visual geometry.
- Stair rise/run is 3/8 units, or about 20.6°. The stair steps are now drawn with their tops on the walkable ramp (they used to be built back to front).
- Corridor clear widths are 4.6–6.2 units for a 1.1-unit-diameter player.
- Rope bridge edges use rail collisions.
- Camera uses follow damping, orbit yaw and pitch, pinch/wheel/LB-RB zoom, and a ray-vs-wall shortening pass against cave walls.

## Controls pass

- All input goes through the shared kit's actions: keyboard and mouse, gamepad and touch.
- Touch: floating stick on the left half, SHOT/DASH buttons, USE only while something is in reach, II pill under the HUD. One finger on the view turns the camera, two pinch to zoom.
- Menus (title, bench, pause, results) work with mouse, touch, keyboard and gamepad (D-pad or stick to move, A to confirm, B or Start to go back).
- Sling shots use a 64° forward auto-aim cone up to 9 units to reduce precision burden on phones.

## Progression pass

Deterministic full-route simulation result (Normal):

- Level at completion: 4
- XP: 254
- Seals: 3/3
- Guaranteed paid upgrades: 2
- Final max health: 10
- Final shot damage after the normal first sling upgrade: 2.15
- Final brute: 4 shots on the normal route
- Total required shots for the simulated normal combat route: 26
- Random enemy scrap is not required for the two guaranteed upgrade choices.

With the secret pump room: level 5, crew 2/2, 4 scrap left after both upgrades. The same run on Tough needs 6 shots on the final brute.

A low-progression check also confirms that a level-2 player with no paid damage upgrade needs 7 shots on the final brute, so the mission is not gated behind XP grinding.

## Automated checks

Both of these pass:

```bash
node tests/validate.mjs
node tests/playthrough.mjs
```

The wall's static audit also passes: `node scripts/audit3d.mjs games/GooniesII-Cavern-Crew-II-Blackfin-Breakout-2026-09-17-model-unknown` (run from the repository root).
