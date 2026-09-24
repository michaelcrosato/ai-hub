import { BALANCE } from '../src/game.js';

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function levelFor(xp) { return xp >= BALANCE.xpThresholds[2] ? 3 : xp >= BALANCE.xpThresholds[1] ? 2 : 1; }
function bossTtk(level) { const w = BALANCE.weapons[level - 1]; return BALANCE.enemy.boss.hp / (w.damage * w.rate * w.shots); }

const speedRouteXp = 2 * BALANCE.enemy.grunt.xp + BALANCE.enemy.turret.xp;
const normalGroundXp = 7 * BALANCE.enemy.grunt.xp + BALANCE.enemy.turret.xp + BALANCE.enemy.drone.xp;
const upperExploreXp = 5 * BALANCE.enemy.grunt.xp + BALANCE.enemy.turret.xp + BALANCE.enemy.drone.xp + 95;
const checkpoints = [2, 42, 76, 90, 113];
const gaps = checkpoints.slice(1).map((v,i) => v - checkpoints[i]);
const maxCleanRunback = Math.max(...gaps) / BALANCE.player.speed;
const stairRise = 3 / 9;

assert(levelFor(speedRouteXp) === 1, 'Speed route must remain possible without forced leveling.');
assert(bossTtk(1) < 7, 'Unupgraded weapon must be viable against the boss.');
assert(levelFor(normalGroundXp) >= 2, 'Normal ground route should naturally reach level 2.');
assert(levelFor(upperExploreXp) === 3, 'Upper exploration plus cache should reach the final weapon tier.');
assert(maxCleanRunback < 7, 'Checkpoint runback is too long.');
assert(stairRise < 0.4, 'Upper-route stair rise is too abrupt for mobile movement.');
assert(BALANCE.grenade.radius >= 4, 'Grenade radius is too strict for touch controls.');

console.log(JSON.stringify({
  speedRoute: { xp: speedRouteXp, level: levelFor(speedRouteXp), bossTtkSeconds: +bossTtk(1).toFixed(2) },
  normalGround: { xp: normalGroundXp, level: levelFor(normalGroundXp) },
  upperExplore: { xp: upperExploreXp, level: levelFor(upperExploreXp) },
  maxCheckpointRunbackSeconds: +maxCleanRunback.toFixed(2),
  stairRisePerStep: +stairRise.toFixed(3),
  status: 'mission route checks passed'
}, null, 2));
