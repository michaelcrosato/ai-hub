# Refinement and test notes

## Mission and route pass

Automated 2D collision/path checks (`test-routes.py`) use the world measurements of the original progression gates.

- Shrine start → Keeper Nilo: open, about 33 m.
- Keeper → field raider: open, about 10.5 m.
- Field → mill console: open, about 13.8 m.
- Mill → Wind Core with seal active: blocked.
- Mill → Wind Core after mill activation: open, about 20.4 m.
- Wind Core → boss with rune wall active: blocked.
- Wind Core → boss after charged-shot break: open, about 12.1 m.
- Start → optional Ridge Guard: open, about 50.6 m.

The ridge and rune-gate collision banks were added after the first route pass found long unintended bypasses around both progression blockers. The Hollow sits west of the ridge line (`ridgeSouth`), so it opens no path around the grotto seal or the rune wall.

## Progression pass

- Required route before boss: 66 XP, level 2, 86 HP, 15 base attack with Windshard II.
- Charged wind damage at level 2: 27; Stone Gale takes 9 charged hits.
- Stone Gale touch damage defeats an unarmored level-2 player in 8 hits.
- A modest optional route reaches level 3; Ridge Guard raises boss-touch survival to 10 hits.
- The Hollow's one-time rewards (3 bells + vault, 54 XP) stay within level 3 before the boss.
- Boss stone armor reduces melee damage to 55%, so charged wind is clearly better without making melee impossible.
- No enemy has a player-level immunity or hard level requirement.

## Input pass

- All input goes through the shared kit's actions: keyboard/mouse, gamepad and touch drive the same movement and combat state.
- A blade release during the attack cooldown is buffered for 0.2 s instead of being dropped; a dash pressed up to 0.12 s early still fires.
- The touch ACT button only shows while something can be acted on.
- Title, pause, death and results menus work with arrows or the stick and Enter / A.

## Upgrade pass (shared 3D stack) — not yet tested in a browser

Written without running the game; the QA pass should check first:

- Boot on WebGPU and WebGL2, title screen renders behind the menu, no console errors.
- New game, Continue after reload, death → shrine respawn, boss fight → results → Keep exploring.
- The Hollow: burrowers surface and can be hit, the three bells ring, the vault opens, the Tempest Ring fires three shots.
- Phone layout: touch controls clear of the HUD, the II pill under the objective card.
