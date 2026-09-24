# Refinement and test notes

## Mission and route pass

Automated 2D collision/path checks use the same world measurements as the runtime scene.

- Shrine start → Keeper Nilo: open, about 33 m.
- Keeper → field raider: open, about 10.5 m.
- Field → mill console: open, about 13.8 m.
- Mill → Wind Core with seal active: blocked.
- Mill → Wind Core after mill activation: open, about 20.4 m.
- Wind Core → boss with rune wall active: blocked.
- Wind Core → boss after charged-shot break: open, about 12.1 m.
- Start → optional Ridge Guard: open, about 50.6 m.

The ridge and rune-gate collision banks were added after the first route pass found long unintended bypasses around both progression blockers.

## Progression pass

- Required route before boss: 66 XP, level 2, 86 HP, 15 base attack with Windshard II.
- Charged wind damage at level 2: 27; Stone Gale takes 9 charged hits.
- Stone Gale touch damage defeats an unarmored level-2 player in 8 hits.
- A modest optional route reaches level 3; Ridge Guard raises boss-touch survival to 10 hits.
- Boss stone armor reduces melee damage to 55%, so charged wind is clearly better without making melee impossible.
- No enemy has a player-level immunity or hard level requirement.

## Input pass

- Keyboard and touch use the same movement/combat state.
- Dash input is cleared on release/cancel, so a dash pressed during cooldown is not queued unexpectedly.
- Touch stick and action buttons use independent pointer IDs so movement + attack/dash/interact work at the same time.
- Pinch zoom ignores active action-button touches to prevent accidental camera zoom while attacking.

## Environment limitation

The project’s JavaScript syntax, state progression, balance, and route topology were tested in the build environment. A full rendered browser smoke test could not load the pinned CDN modules because outbound browser requests to the CDN are blocked in this environment. The runtime URLs and Three.js APIs were checked against current Three.js 0.186.0 documentation.
