import { BALANCE } from '../src/game.js';

function assert(cond, msg) { if (!cond) throw new Error(msg); }
const w1 = BALANCE.weapons[0];
const w2 = BALANCE.weapons[1];
const boss = BALANCE.enemy.boss;
const ttkL1 = boss.hp / (w1.damage * w1.rate);
const ttkL2 = boss.hp / (w2.damage * w2.rate);
const routeXp = 6 * BALANCE.enemy.grunt.xp + BALANCE.enemy.turret.xp + BALANCE.enemy.drone.xp;
const fullXp = 10 * BALANCE.enemy.grunt.xp + 2 * BALANCE.enemy.turret.xp + 2 * BALANCE.enemy.drone.xp;

assert(ttkL1 < 7.0, `Level-1 boss TTK too high: ${ttkL1.toFixed(2)}s`);
assert(ttkL2 < 5.0, `Level-2 boss TTK too high: ${ttkL2.toFixed(2)}s`);
assert(routeXp >= BALANCE.xpThresholds[1], 'A normal non-grind route must reach level 2.');
assert(fullXp >= BALANCE.xpThresholds[2], 'A thorough route must reach level 3.');
assert(BALANCE.player.maxHealth >= 5, 'Player health too low for mobile-first forgiveness.');
console.log(JSON.stringify({ ttkL1: +ttkL1.toFixed(2), ttkL2: +ttkL2.toFixed(2), routeXp, fullXp, status: 'balance checks passed' }, null, 2));
