import assert from 'node:assert/strict';
import { GameSimulation, levelFromXP, DEFAULT_PROFILE } from '../src/game/core.js';
import { coins } from '../src/game/level.js';

const quiet = () => {};

assert.equal(levelFromXP(0), 1);
assert.equal(levelFromXP(79), 1);
assert.equal(levelFromXP(80), 2);
assert.equal(levelFromXP(190), 3);
assert.equal(levelFromXP(340), 4);

{
  const sim = new GameSimulation({ onEvent: quiet });
  const first = coins[0];
  sim.player.x = first.x; sim.player.y = first.y;
  sim.updateCollectibles();
  assert.equal(sim.runCoins, 5, 'coin adds run currency');
  assert.equal(sim.profile.xp, 1, 'coin adds XP');
  assert(sim.collected.has(first.id), 'coin is marked collected');
}

{
  const sim = new GameSimulation({ onEvent: quiet });
  sim.runCoins = 69;
  assert.equal(sim.buyUpgrade('staff').ok, false, 'staff upgrade respects price');
  sim.runCoins = 70;
  assert.equal(sim.buyUpgrade('staff').ok, true, 'staff upgrade can be bought in first run');
  assert.equal(sim.profile.staffLevel, 2);
  assert.equal(sim.getBossDamage(), 2);
  assert.equal(sim.runCoins, 0);
}

{
  const sim = new GameSimulation({ profile: { ...DEFAULT_PROFILE, xp: 80 }, onEvent: quiet });
  assert.equal(sim.profile.level, 2);
  assert.equal(sim.player.maxHp, 5, 'level two grants one max heart');
  sim.runCoins = 60;
  const before = sim.player.maxHp;
  assert.equal(sim.buyUpgrade('coat').ok, true);
  assert.equal(sim.player.maxHp, before + 1, 'coat grants a permanent heart');
}

function bossHit(sim) {
  const b = sim.boss;
  b.active = true; b.alive = true; b.mode = 'idle'; b.modeTimer = 99; b.invuln = 0; b.vx = 0;
  sim.player.x = b.x;
  sim.player.y = b.y + b.h / 2 + 0.32;
  sim.player.vy = -6;
  sim.player.pogo = true;
  sim.player.invuln = 0;
  sim.updateBoss(0);
}

{
  const sim = new GameSimulation({ onEvent: quiet });
  for (let i = 0; i < 4; i++) { bossHit(sim); assert.equal(sim.boss.alive, true); }
  bossHit(sim);
  assert.equal(sim.boss.alive, false, 'stock staff clears boss in five pogo hits');
  assert.equal(sim.phase, 'crown');
}

{
  const sim = new GameSimulation({ profile: { staffLevel: 2 }, onEvent: quiet });
  bossHit(sim); assert.equal(sim.boss.hp, 3);
  bossHit(sim); assert.equal(sim.boss.hp, 1);
  bossHit(sim); assert.equal(sim.boss.alive, false, 'upgraded staff clears boss in three pogo hits');
}

{
  const sim = new GameSimulation({ onEvent: quiet });
  sim.phase = 'escape'; sim.hasCrown = true; sim.escapeTime = 10;
  sim.player.x = 2.4; sim.player.y = 0.7;
  sim.updateMission(0.01);
  assert.equal(sim.completed, true, 'escape completes at entrance');
  assert.equal(sim.profile.clears, 1);
  assert(sim.profile.bestTime != null);
}


{
  const sim = new GameSimulation({ onEvent: quiet });
  sim.hasGear = true;
  sim.player.x = 65.4; sim.player.y = 0.7;
  sim.updateMission(0);
  assert.equal(sim.boss.active, true);
  assert(sim.player.checkpointX > 64.7, 'boss checkpoint is inside the locked arena');
  sim.player.hp = 1; sim.player.invuln = 0;
  sim.damagePlayer(1, sim.player.x + 1);
  assert.equal(sim.player.hp, sim.player.maxHp, 'a knockout restores full health at checkpoint');
  assert(sim.player.x > 64.7, 'boss knockout cannot trap player outside the gate');
}

console.log('logic.test.mjs: all assertions passed');
