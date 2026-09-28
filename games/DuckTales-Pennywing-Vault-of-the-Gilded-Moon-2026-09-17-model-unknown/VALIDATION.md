# Validation report

## Automated checks

`npm run test:all` passes.

Coverage includes:

- XP level thresholds and permanent max-health progression.
- 70-coin Springstaff Coil purchase and 60-coin Trailcoat purchase.
- Stock springstaff: guardian defeat in five clean bounce hits.
- Upgraded springstaff: guardian defeat in three clean bounce hits.
- Boss knockout: full-health checkpoint inside the locked arena.
- High-route physical jump reachability from the opening ledge through the Moon Gear perch.
- Breakable lower cache, safe landing, return ledges, and rejoin without forced damage or respawn.
- Full Moon Gear → guardian → Gilded Moon → escape → completion state loop.

## Browser/GPU validation note

The build container can serve the project and all JavaScript files pass syntax checks. Its installed headless Chromium cannot initialize EGL/ANGLE, so a GPU-rendered screenshot could not be produced in this environment. The game therefore uses feature-gated renderer selection and includes explicit `?webgl2=1` and `?legacy=1` paths for device testing.
