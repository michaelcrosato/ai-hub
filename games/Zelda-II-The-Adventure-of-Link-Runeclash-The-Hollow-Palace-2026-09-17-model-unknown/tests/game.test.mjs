import test from 'node:test';
import assert from 'node:assert/strict';
import { GameWorld } from '../src/game.js';

function clearEnemies(world) {
  for (const e of world.enemies) e.alive = false;
}

function step(world, seconds, input = {}) {
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) world.update(dt, input);
}

test('player settles on ground and moves without falling through', () => {
  const world = new GameWorld();
  clearEnemies(world);
  world.debugSetPlayer(2.4, 3);
  step(world, 1.0, { moveX: 0 });
  assert.ok(Math.abs(world.player.y - 0.861) < 0.04, `y=${world.player.y}`);
  assert.equal(world.player.grounded, true);
});

test('step-up collision lets player climb palace stairs', () => {
  const world = new GameWorld();
  clearEnemies(world);
  world.debugSetPlayer(18.5, 0.861);
  step(world, 2.7, { moveX: 1 });
  assert.ok(world.player.x > 28, `x=${world.player.x}`);
  assert.ok(world.player.y > 4.6, `y=${world.player.y}`);
});

test('sun gate stays locked without key and opens after chest', () => {
  const world = new GameWorld();
  clearEnemies(world);
  world.debugSetPlayer(58.1, 0.9);
  assert.equal(world.interact(), true);
  assert.equal(world.doorUnlocked, false);

  world.debugSetPlayer(43.5, 4.86);
  assert.equal(world.interact(), true);
  assert.equal(world.keyCollected, true);

  world.debugSetPlayer(58.1, 0.9);
  assert.equal(world.interact(), true);
  assert.equal(world.doorUnlocked, true);
});

test('first level arrives from normal palace combat budget and upgrades a stat', () => {
  const world = new GameWorld();
  world._grantXp(100);
  assert.equal(world.player.level, 2);
  assert.equal(world.pausedForUpgrade, true);
  assert.equal(world.chooseUpgrade('attack'), true);
  assert.equal(world.player.attackLevel, 1);
  assert.equal(world.attackDamage, 15);
  assert.equal(world.pausedForUpgrade, false);
});

test('optional forge cache raises sword damage but is not required', () => {
  const world = new GameWorld();
  const baseDamage = world.attackDamage;
  world.debugSetPlayer(79.2, 4.95);
  assert.equal(world.interact(), true);
  assert.equal(world.player.swordTier, 2);
  assert.equal(world.attackDamage, baseDamage + 4);
});

test('base-level player damage is sufficient to defeat boss in a bounded number of clean hits', () => {
  const world = new GameWorld();
  const boss = world.boss;
  let hits = 0;
  while (boss.alive && hits < 20) {
    boss.invuln = 0;
    world._damageEnemy(boss, world.attackDamage, 0);
    hits++;
  }
  assert.equal(boss.alive, false);
  assert.ok(hits <= 12, `base boss hits=${hits}`);
});

test('guard substantially reduces frontal damage', () => {
  const world = new GameWorld();
  const p = world.player;
  p.facing = 1;
  p.guarding = true;
  const before = p.hp;
  world._hurtPlayer(20, p.x + 1, 4);
  assert.ok(before - p.hp <= 6, `damage=${before - p.hp}`);
});

test('checkpoint respawn restores health and preserves mission progress', () => {
  const world = new GameWorld();
  world.keyCollected = true;
  world.doorUnlocked = true;
  world.checkpoint = { x: 62.5, y: 0.86, name: 'Lower Hall' };
  world.player.hp = 1;
  world._hurtPlayer(50, world.player.x + 1, 0);
  assert.equal(world.player.hp, world.maxHp);
  assert.ok(Math.abs(world.player.x - 62.5) < 0.01);
  assert.equal(world.keyCollected, true);
  assert.equal(world.doorUnlocked, true);
});

test('boss defeat unlocks altar completion', () => {
  const world = new GameWorld();
  const boss = world.boss;
  boss.invuln = 0;
  world._damageEnemy(boss, 999, 0);
  assert.equal(world.bossDefeated, true);
  world.pausedForUpgrade = false; // boss XP can trigger a level in isolated test state
  world.debugSetPlayer(world.level.altar.x, world.level.altar.y);
  assert.equal(world.interact(), true);
  assert.equal(world.complete, true);
});

test('main lower route passes under the optional forge ledges without snagging', () => {
  const world = new GameWorld();
  clearEnemies(world);
  world.keyCollected = true;
  world.doorUnlocked = true;
  world.debugSetPlayer(61, 0.861);
  step(world, 7.5, { moveX: 1 });
  assert.ok(world.player.x > 96, `x=${world.player.x}`);
});

test('optional forge route is reachable with standard jump height', () => {
  const world = new GameWorld();
  clearEnemies(world);
  world.keyCollected = true;
  world.doorUnlocked = true;
  world.debugSetPlayer(63, 0.861);
  let landedUpper = false;
  for (let i = 0; i < 360; i++) {
    const p = world.player;
    const jump = (p.grounded && p.x > 65.2 && p.x < 68) || (p.grounded && p.y > 2.5 && p.x > 70 && p.x < 75.3);
    world.update(1 / 60, { moveX: p.x < 80 ? 1 : 0, jumpPressed: jump });
    if (p.grounded && p.y > 5 && p.x > 74 && p.x < 82) { landedUpper = true; break; }
  }
  assert.equal(landedUpper, true);
});
