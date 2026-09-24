# QA and refinement record

## Route and collision pass

Grid reachability was checked with the player collision radius against the generated tree field and fixed colliders. The checked sequence was:

`Start -> West Chime / East Chime / Old Chime -> open gate -> first chamber -> chest -> Warden A -> Warden B -> open inner seal -> boss entry -> boss`.

An initial test found a generated tree overlapping the Old Chime. The procedural placement now reserves clear zones around all three chimes and the onboarding sign. The full sequence then passed.

Approximate shortest-path distances after the fix: Start to West 16.8 units; Start to East 19.8; Start to Old 29.6; Old to post-gate checkpoint 19.1; checkpoint to chest 5.0; chest to first warden 7.9; between wardens 7.0; second warden to boss entry 11.4; boss entry to boss 7.0.

## Progression pass

No optional kills:

- Start: Level 1, 60 HP, 12 blade damage.
- Chest: +40 XP guarantees Level 2 if still Level 1; Bronzeleaf Edge adds +5 blade damage. Level 2 grants one heart.
- Level 2 combat damage: 18.5.
- Ruin warden: 38 HP, about 3 blade hits.
- Ember Warden: 150 HP, about 9 blade hits.
- Boss heavy strike: 16 damage before guard. 70 HP at Level 2 gives about 5 unguarded heavy hits or 12 guarded heavy hits to defeat the player.
- Boss projectiles: 10 damage, about 7 hits at Level 2.

Optional meadow enemies give enough XP to approach or reach Level 3 before the boss. This is a reward, not a requirement.

## Mobile pass targets

- Joystick and action buttons use independent pointer capture for multitouch.
- Pinch zoom is handled on the render surface and does not consume joystick/button pointers.
- Camera zoom is clamped to keep combat readable in portrait and landscape layouts.
- HUD reflows below 760 px width; the boss bar moves above the mobile action area.
- Adaptive render pixel ratio has a mobile cap of 1.45 DPR and can reduce toward 0.85 DPR on sustained low frame rate.
