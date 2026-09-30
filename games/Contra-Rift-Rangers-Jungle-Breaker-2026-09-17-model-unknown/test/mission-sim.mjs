// Route and layout checks for every operation: node test/mission-sim.mjs
import { BALANCE, levelForXp } from '../src/balance.js';
import { MISSIONS } from '../src/missions.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
function bossTtk(level) {
  const w = BALANCE.weapons[level - 1];
  return BALANCE.enemy.boss.hp / (w.damage * w.rate * w.shots);
}

// Operation 01 route styles (the original design notes).
const speedRouteXp = 2 * BALANCE.enemy.grunt.xp + BALANCE.enemy.turret.xp;
const normalGroundXp = 7 * BALANCE.enemy.grunt.xp + BALANCE.enemy.turret.xp + BALANCE.enemy.drone.xp;
const upperExploreXp = 5 * BALANCE.enemy.grunt.xp + BALANCE.enemy.turret.xp + BALANCE.enemy.drone.xp + 95;
assert(levelForXp(speedRouteXp) === 1, 'Speed route must remain possible without forced leveling.');
assert(bossTtk(1) < 7, 'Unupgraded weapon must be viable against the boss.');
assert(levelForXp(normalGroundXp) >= 2, 'Normal ground route should naturally reach level 2.');
assert(levelForXp(upperExploreXp) === 3, 'Upper exploration plus cache should reach the final weapon tier.');
assert(BALANCE.grenade.radius >= 4, 'Grenade radius is too strict for touch controls.');

const report = {};
for (const m of MISSIONS) {
  const stops = [m.start, ...m.checkpoints.map((c) => c.x), m.pad];
  const gaps = stops.slice(1).map((v, i) => v - stops[i]);
  const runback = Math.max(...gaps) / BALANCE.player.speed;
  assert(runback < 7, `${m.name}: checkpoint runback is too long (${runback.toFixed(2)}s).`);
  for (const c of m.checkpoints) assert(c.at > c.x, `${m.name}: a checkpoint must trigger past its respawn point.`);
  for (let i = 1; i < m.objectives.length; i++) assert(m.objectives[i].at > (m.objectives[i - 1].at || 0), `${m.name}: objectives out of order.`);
  assert(m.bossAt > m.objectives[m.objectives.length - 1].at, `${m.name}: the boss must wake after the last objective starts.`);
  assert(m.finishAt > m.gate.x && m.finishAt < m.maxX, `${m.name}: extraction must lie past the gate and inside the level.`);
  for (const b of m.bridges) {
    const upRise = b.top / Math.max(3, Math.round((b.x1 - b.x0) / 0.45));
    assert(upRise < 0.55, `${m.name}: stair rise ${upRise.toFixed(2)} is higher than a walkable step.`);
  }
  const bosses = m.enemies.filter(([t]) => t === 'boss' || t === 'walker');
  assert(bosses.length === 1, `${m.name}: exactly one boss.`);
  const xp = m.enemies.filter(([t]) => t !== 'boss' && t !== 'walker').reduce((s, [t]) => s + BALANCE.enemy[t].xp, 0);
  assert(levelForXp(xp) === 3, `${m.name}: clearing every enemy should reach the final weapon tier.`);
  const intel = m.pickups.filter(([t]) => t === 'intel').length;
  assert(intel >= 3, `${m.name}: at least three intel drives.`);
  report[m.id] = { maxCheckpointRunbackSeconds: +runback.toFixed(2), enemies: m.enemies.length, fullClearXp: xp, intel };
}

console.log(
  JSON.stringify(
    {
      speedRoute: { xp: speedRouteXp, level: levelForXp(speedRouteXp), bossTtkSeconds: +bossTtk(1).toFixed(2) },
      normalGround: { xp: normalGroundXp, level: levelForXp(normalGroundXp) },
      upperExplore: { xp: upperExploreXp, level: levelForXp(upperExploreXp) },
      missions: report,
      status: 'mission route checks passed',
    },
    null,
    2
  )
);
