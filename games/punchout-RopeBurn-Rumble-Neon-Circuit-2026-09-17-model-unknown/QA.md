# QA notes

## Automated checks

```bash
node tests/smoke.mjs                 # from this folder
node scripts/audit3d.mjs games/punchout-RopeBurn-Rumble-Neon-Circuit-2026-09-17-model-unknown   # from the repo root
```

`tests/smoke.mjs` drives the real fight rules (`sim.js`) with seeded bot policies, 120 bouts per policy and opponent, and asserts the balance guard rails and the progression flow (guard release, the fight clock, gear purchase and circuit gear, old and damaged saves, unlocks, bests, 10-point scoring).

Win rates at Pro difficulty with the default level-1 loadout:

| | Gus Granite | Vera Voltage | Duke Dynamo |
|---|---|---|---|
| Blind mash | 0% | 0% | 0% |
| Rough novice | ~30% | ~22% | ~10% |
| Competent read/counter | 100% | ~99% | ~97% |

Novice win rate by difficulty (Sparring / Pro / Brutal): Gus ~68 / 32 / 17%, Vera ~62 / 20 / 6%, Duke ~28 / 9 / 2%.

These policies are synthetic. They are not a prediction of human win rates; they check that progression is not required to win, that the circuit gets harder, and that mashing does not work.

## Browser checks

The wall's checkers (`scripts/check3d.py`, `sweep3d.py`, `matrix3d.py`) boot the game on WebGPU, WebGL2 and a phone profile. The start flow is two buttons: ENTER THE RING, then START THE BOUT.
