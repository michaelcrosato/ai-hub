# Verification notes

- `node --check` passes for every module in `src/`.
- `node scripts/audit3d.mjs games/BM-Subterra-Spark-Vaultbreaker-2026-09-17-model-unknown` (from the repo root) reports no broken rules.
- `node tests/balance-sim.mjs` replays the XP/salvage economy over the real area layouts:
  - Area 01 mandatory route (vault only): level 2, Coil Barrel Mk II affordable, about 32 armoured-only shots to the 360-HP M.O.L.E.
  - Area 01 combat-heavy route: level 3 with both fittings.
  - Area 02 from the standard loadout (vault waves only): both fittings affordable, about 21 exposed-head shots to the 600-HP burrower.
- Browser checks (WebGPU, WebGL2, phone profile, layout sweep) run in the hub's QA pipeline (`scripts/check3d.py`, `sweep3d.py`, `matrix3d.py`).
