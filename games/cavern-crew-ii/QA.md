# QA and refinement notes

## Route and interaction pass

- Spawn is on valid floor and clear of collision.
- Sling locker, all three seals, workbench, gate console, rescue point, and pickups are on valid floor footprints.
- Intended routes pass collision sampling at 0.18-unit intervals:
  - spawn → sling locker
  - locker → hub
  - hub → Gear Seal
  - hub → flooded grotto → Tide Seal
  - hub → stairs → lookout → Echo Seal
  - unlocked gate → rope bridge → rescue vault
- The flooded grotto seal island was changed from a collider to non-blocking visual geometry after the first validator pass found that it blocked the objective.
- Stair rise/run is 3/8 units, or about 20.6°, to avoid harsh camera and movement transitions.
- Corridor clear widths are 4.6–6.2 units for a 1.1-unit-diameter player.
- Rope bridge edges use rail collisions.
- Camera uses follow damping, orbit yaw, pinch/wheel zoom, and a raycast shortening pass against cave walls.

## Mobile controls pass

- Left virtual joystick supports an independent pointer ID.
- SHOT, USE, and DASH use separate pointer events, so movement and actions work simultaneously.
- The 3D canvas tracks two pointers for pinch zoom while the joystick remains independent.
- A single touch on the 3D view rotates the camera.
- Sling shots use a 64° forward auto-aim cone up to 9 units to reduce precision burden on phones.

## Progression pass

Deterministic full-route simulation result:

- Level at completion: 4
- XP: 254
- Seals: 3/3
- Guaranteed paid upgrades: 2
- Final max health: 10
- Final shot damage after the normal first sling upgrade: 2.15
- Final brute: 4 shots on the normal route
- Total required shots for the simulated normal combat route: 26
- Random enemy scrap is not required for the two guaranteed upgrade choices.

A low-progression check also confirms that a level-2 player with no paid damage upgrade needs 7 shots on the final brute, so the mission is not gated behind XP grinding.

## Automated checks

Both of these pass:

```bash
node tests/validate.mjs
node tests/playthrough.mjs
```

The execution environment used to assemble this project cannot resolve external CDN hosts from its local Chromium process, so the final Three.js render path could not be visually smoke-tested here. The project uses pinned official CDN modules and is designed to run when served over HTTP/HTTPS with normal internet access.
