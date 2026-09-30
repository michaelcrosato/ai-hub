// Boss time-to-kill and weapon progression checks: node test/balance.mjs
import { BALANCE, DIFFICULTY } from '../src/balance.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
const dps = (w) => w.damage * w.rate;
const w1 = BALANCE.weapons[0];
const w2 = BALANCE.weapons[1];
const boss = BALANCE.enemy.boss;
const walker = BALANCE.enemy.walker;
const ttkL1 = boss.hp / dps(w1);
const ttkL2 = boss.hp / dps(w2);
const walkerL1 = walker.hp / dps(w1);
const walkerVeteranL1 = (walker.hp * DIFFICULTY.veteran.bossHp) / dps(w1);
const routeXp = 6 * BALANCE.enemy.grunt.xp + BALANCE.enemy.turret.xp + BALANCE.enemy.drone.xp;
const fullXp = 10 * BALANCE.enemy.grunt.xp + 2 * BALANCE.enemy.turret.xp + 2 * BALANCE.enemy.drone.xp;

assert(ttkL1 < 7.0, `Level-1 boss TTK too high: ${ttkL1.toFixed(2)}s`);
assert(ttkL2 < 5.0, `Level-2 boss TTK too high: ${ttkL2.toFixed(2)}s`);
assert(walkerL1 < 12, `Level-1 Rift Walker TTK too high: ${walkerL1.toFixed(2)}s`);
assert(walkerVeteranL1 < 14, `Veteran Rift Walker TTK too high: ${walkerVeteranL1.toFixed(2)}s`);
assert(routeXp >= BALANCE.xpThresholds[1], 'A normal non-grind route must reach level 2.');
assert(fullXp >= BALANCE.xpThresholds[2], 'A thorough route must reach level 3.');
for (const d of Object.values(DIFFICULTY)) assert(d.maxHealth >= 4, `${d.label}: too few vitals for touch play.`);
assert(DIFFICULTY.ranger.maxHealth === BALANCE.player.maxHealth, 'Ranger must keep the original tuning.');
console.log(
  JSON.stringify(
    { ttkL1: +ttkL1.toFixed(2), ttkL2: +ttkL2.toFixed(2), walkerL1: +walkerL1.toFixed(2), walkerVeteranL1: +walkerVeteranL1.toFixed(2), routeXp, fullXp, status: 'balance checks passed' },
    null,
    2
  )
);
