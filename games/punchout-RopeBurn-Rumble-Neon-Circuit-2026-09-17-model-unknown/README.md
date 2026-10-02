# RopeBurn Rumble — Neon Circuit

An original, mobile-first arcade boxing game inspired by the read-and-react rhythm of 8-bit console boxing games. It uses no copied characters, sprites, music, names, or game data.

## Run

The game runs on the wall's shared 3D stack (three.js r186 `WebGPURenderer` with automatic WebGL2 fallback, booted by `/lib/kit/`), so serve the repository root, not this folder:

```bash
python3 -m http.server 8000   # from the repo root
```

Then open `http://localhost:8000/games/punchout-RopeBurn-Rumble-Neon-Circuit-2026-09-17-model-unknown/`.

## Files

- `index.html` — the page, its cards and the HUD.
- `sim.js` — the fight rules: attacks, the three opponents, difficulty, gear, scoring and progress. No DOM, no three.js.
- `ring.js` — the arena, the fighters and their animation on `kit.renderer`.
- `game.js` — boot, input actions, cards, HUD, sound.
- `tests/smoke.mjs` — bot bouts and progression checks (`node tests/smoke.mjs`).

## Controls

| | Keyboard / mouse | Controller | Touch |
|---|---|---|---|
| Slip | A / D (arrows) | left stick / D-pad ← → | stick ← → |
| Duck (hold for body shots) | S | stick ↓ | stick ↓ |
| Punch left / right | J / K, left / right click | X / A (LB / RB) | L / R |
| Guard (hold) | L or Shift | B or LT | GUARD |
| Rush (full meter) | Space | Y or RT | RUSH |
| Pause | Esc or P | Start | II |
| Zoom | wheel | — | pinch |
| Sound on / off | M | pause menu | pause menu |

Menus work with the stick, D-pad or arrows, A / Enter to choose and B / Esc to go back.

## The Neon Circuit

- **Bout 01 — Gus Granite**, Southside Breaker: the original bout. Jabs, crosses, hooks and uppercuts.
- **Bout 02 — Vera Voltage**, Neon Southpaw: fast tells, fake jabs she blocks your swing on (the glove never flashes on a fake), and a quick 1-2.
- **Title bout — Duke Dynamo**, Circuit Champion: a tight shell, a heavy hand and the haymaker, which can only be ducked and leaves him wide open.

Beat an opponent to open the next. Three difficulties (Sparring, Pro, Brutal) change tell speed, damage and rewards.

## Rules

- Three 60-second rounds. Three knockdowns is a TKO; two of yours stops the bout; otherwise the judges score it (10-point must: the busier round wins 10-9, each knockdown costs a point).
- Every enemy punch is telegraphed by a sign over the ring and a glowing glove. Punch while the glove flashes bright, late in the windup, to counter.
- Stamina feeds punches and guard; a guard can break. Momentum fills the Rush meter.
- Between rounds you pick one temporary corner boost.
- XP, levels, credits, gear, the circuit, best scores and fastest knockouts are saved in local storage.
- Procedural Web Audio: punches, bell, crowd ambience that swells on big moments.

## Test

`node tests/smoke.mjs` plays seeded bot bouts against every opponent and difficulty and checks progression. See `QA.md`.
