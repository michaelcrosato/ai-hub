# QA and refinement record

## Route and collision pass

Grid reachability was checked with the player collision radius against the generated tree field and fixed colliders. The checked sequence was:

`Start -> West Chime / East Chime / Old Chime -> open gate -> first chamber -> chest -> Warden A -> Warden B -> open inner seal -> boss entry -> boss`.

An initial test found a generated tree overlapping the Old Chime. The procedural placement now reserves clear zones around all three chimes and the onboarding sign. The full sequence then passed.

Approximate shortest-path distances after the fix: Start to West 16.8 units; Start to East 19.8; Start to Old 29.6; Old to post-gate checkpoint 19.1; checkpoint to chest 5.0; chest to first warden 7.9; between wardens 7.0; second warden to boss entry 11.4; boss entry to boss 7.0.

The side path adds: East Chime to the eastern glade cache about 20 units; the post-chest checkpoint to the vault door about 9 units. The glade sits in open meadow (no generated trees there), ringed by five standing stones that stop thornback charges.

## Progression pass

No optional kills:

- Start: Level 1, 60 HP, 12 blade damage.
- Chest: +40 XP guarantees Level 2 if still Level 1; Bronzeleaf Edge adds +5 blade damage. Level 2 grants one heart.
- Level 2 combat damage: 18.5.
- Ruin warden: 38 HP, about 3 blade hits.
- Ember Warden: 150 HP, about 9 blade hits.
- Boss heavy strike: 16 damage before guard. 70 HP at Level 2 gives about 5 unguarded heavy hits or 12 guarded heavy hits to defeat the player.
- Boss projectiles: 10 damage, about 7 hits at Level 2.

Optional meadow enemies give enough XP to approach or reach Level 3 before the boss. This is a reward, not a requirement. The Rootkey Vault adds two thornbacks (44 HP, 26 XP each), one vault thornback and two vault mosslings, a Heart Container (+10 HP) and the Ember Charm (dash damage 8 + 2 per level).

Difficulty scales damage taken (Story 0.6×, Hard 1.45×), enemy speed (0.92× / 1.12×), healing-mint chance (40% / 12%), boss volley interval (6.4 s / 4.3 s) and, on Hard, a 12-shot ring once the Ember Warden is below half health. Normal keeps the numbers above.

## Upgrade-pass fixes (shared 3D stack)

- Opening the ruin chest after both wardens fell used to set the quest back to "Break the two ruin wardens", which left the boss permanently inactive. The chest now only advances the quest.
- The Ember Warden's wind-up spin was overwritten every frame; it now shows, with a filling floor ring before the slam lands.
- Respawning cleared neither projectiles nor the boss wind-up; both reset now.
- Every spark and projectile created its own geometry and material and never released them; they are pooled.
- Shrine torch posts and the shrine sign floated above the floor; the relic rolled sideways instead of spinning.
- Enemies walked through trees, doors and walls; they now collide, and projectiles stop at walls.
- The page could be served stale by its old cache-first service worker; that worker now removes itself.

## Mobile pass targets

- Touch controls come from the kit: a floating stick, BLADE / GUARD / DASH and a USE button that appears only near something usable, plus a pause pill.
- Pinch zoom is handled by the kit on the render surface and does not consume stick or button pointers.
- Camera zoom is clamped; portrait screens pull the camera back further so fights stay readable.
- HUD reflows below 760 px width and on short landscape screens; bottom HUD elements keep clear of the touch controls through the kit's `--kit-touch-*` variables.
