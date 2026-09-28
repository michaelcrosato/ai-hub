import assert from 'node:assert/strict';
import { GameSimulation } from '../src/game/core.js';
import { coins, gems, relics, crown } from '../src/game/level.js';

const events = [];
const sim = new GameSimulation({ onEvent: (e) => events.push(e), seed: 7 });

function visit(x, y, frames = 4) {
  sim.player.x = x; sim.player.y = y; sim.player.vx = 0; sim.player.vy = 0; sim.player.grounded = false;
  for (let i = 0; i < frames; i++) sim.step(1 / 60, {});
}

// Exploration pass: collect the safe opening line, then the lower treasure route.
for (const c of coins.slice(0, 5)) visit(c.x, c.y);
for (const g of gems.slice(0, 4)) visit(g.x, g.y);
assert(sim.runCoins >= 105, 'optional treasure route funds an upgrade before the boss');
assert.equal(sim.buyUpgrade('staff').ok, true, 'treasure detour funds the springstaff upgrade');

// High road objective.
visit(relics[0].x, relics[0].y);
assert.equal(sim.hasGear, true, 'Moon Gear can be acquired from the high route');

// Enter arena and execute three clean upgraded bounce hits.
visit(66.2, 0.8);
assert.equal(sim.boss.active, true, 'boss arena activates after the key gate');
for (let i = 0; i < 3; i++) {
  sim.boss.invuln = 0;
  sim.boss.mode = 'idle'; sim.boss.modeTimer = 99; sim.boss.vx = 0;
  sim.player.x = sim.boss.x;
  sim.player.y = sim.boss.y + sim.boss.h / 2 + 0.35;
  sim.player.vy = -7; sim.player.pogo = true; sim.player.invuln = 0;
  sim.updateBoss(0);
}
assert.equal(sim.boss.alive, false, 'guardian route is winnable without grinding');

// Claim treasure, trigger escape, and traverse representative checkpoints back to the entrance.
visit(crown.x, crown.y);
assert.equal(sim.phase, 'escape');
for (const x of [80, 72, 62, 52, 42, 33, 23, 10, 2.4]) {
  visit(x, x === 33 ? 1.8 : 0.8, 3);
  if (sim.completed) break;
}
assert.equal(sim.completed, true, 'mission loop reaches completion');
assert(sim.escapeTime > 0, 'scripted escape fits the intended timer');
assert(events.some(e => e.type === 'complete'), 'completion feedback event is emitted');

console.log(JSON.stringify({
  result: 'pass',
  finalLevel: sim.profile.level,
  treasurePercent: sim.getTreasurePercent(),
  deaths: sim.deaths,
  events: events.length,
  staffLevel: sim.profile.staffLevel
}, null, 2));
