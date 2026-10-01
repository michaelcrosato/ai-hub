# Validation report

## Automated checks

`npm run test:all` passes (node, no browser).

Coverage includes:

- XP level thresholds and permanent max-health progression.
- 70-coin Springstaff Coil purchase and 60-coin Trailcoat purchase.
- Stock springstaff: Brassback Sentinel in five clean bounce hits; Orrery Warden in six.
- Upgraded springstaff: either guardian in three clean bounce hits.
- Boss knockout: full-health checkpoint inside the locked arena.
- Vault I: high-route jump reachability from the opening ledge through the Moon Gear perch; breakable lower cache, safe landing, return ledges, and rejoin without forced damage.
- Vault II: every required jump on the way in and on the escape back (moving platforms tried across their whole cycle), the optional high arches, the cistern drop through the cracked cache, the Star Key, steam-vent timing, Gearbats, Warden hops and floor sparks, a scripted clear and the per-vault, per-difficulty record.
- Full objective → guardian → treasure → escape → completion loop.
- Save and continue: a run exported at a checkpoint restores the same state.

The repository's `node scripts/audit3d.mjs` passes for this game (standard import map, kit boot, no WebGL-only APIs).

## Browser/GPU validation note

The upgrade to the shared 3D stack (three.js r186 through the hub kit) was not browser-tested by its author; the hub's automated checks run afterwards.
