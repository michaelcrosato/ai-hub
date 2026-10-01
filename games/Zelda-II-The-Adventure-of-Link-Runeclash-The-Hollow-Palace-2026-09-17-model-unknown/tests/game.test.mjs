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

// ---------------------------------------------------------------- upgrade pass additions

function runRight(world, seconds, { jumpWhen = () => false, stopAt = Infinity } = {}) {
  const dt = 1 / 60;
  let prevJump = false;
  for (let t = 0; t < seconds; t += dt) {
    const p = world.player;
    if (p.x >= stopAt) break;
    const want = jumpWhen(p);
    world.update(dt, { moveX: 1, jumpPressed: want && !prevJump });
    prevJump = want;
  }
}

test('a level-up choice offers the next level at once when enough experience is banked', () => {
  const world = new GameWorld();
  world._grantXp(320);
  assert.equal(world.player.level, 2);
  assert.equal(world.chooseUpgrade('vitality'), true);
  assert.equal(world.player.level, 3, 'second level arrives after the first choice');
  assert.equal(world.pausedForUpgrade, true);
  assert.equal(world.chooseUpgrade('focus'), true);
  assert.equal(world.pausedForUpgrade, false);
});

test('difficulty scales damage taken and enemy health', () => {
  const story = new GameWorld({ difficulty: 'story' });
  const hard = new GameWorld({ difficulty: 'hard' });
  story._hurtPlayer(20, story.player.x + 1, 0);
  hard._hurtPlayer(20, hard.player.x + 1, 0);
  assert.equal(80 - story.player.hp, 12);
  assert.equal(80 - hard.player.hp, 28);
  assert.ok(hard.boss.maxHp > story.boss.maxHp);
});

test('snapshot round-trip keeps progress, stats and the checkpoint', () => {
  const world = new GameWorld({ difficulty: 'hard' });
  world.keyCollected = true;
  world.doorUnlocked = true;
  world.player.attackLevel = 2;
  world.player.level = 3;
  world.enemies[0].alive = false;
  world.checkpoint = { x: 62.5, y: 0.86, name: 'Lower Hall' };
  world.checkpointIndex = 1;
  world.time = 123.4;
  const back = GameWorld.fromSnapshot(JSON.parse(JSON.stringify(world.snapshot())));
  assert.ok(back);
  assert.equal(back.diff.id, 'hard');
  assert.equal(back.doorUnlocked, true);
  assert.equal(back.player.attackLevel, 2);
  assert.equal(back.player.level, 3);
  assert.equal(back.enemies[0].alive, false);
  assert.equal(back.checkpoint.name, 'Lower Hall');
  assert.ok(Math.abs(back.player.x - 62.5) < 0.01);
  assert.equal(back.time, 123.4);
  assert.equal(GameWorld.fromSnapshot({ v: 9 }), null);
});

test('undercroft: lava burns and sets the player back on the near bank', () => {
  const world = new GameWorld({ palace: 'undercroft' });
  clearEnemies(world);
  world.debugSetPlayer(19.5, 0.5);
  step(world, 0.5, { moveX: 0 });
  assert.ok(world.player.hp < 80, `hp=${world.player.hp}`);
  assert.ok(world.player.x < 18, `x=${world.player.x}`);
  assert.equal(world.player.deaths, 0);
});

test('undercroft: the whole lower route can be run and jumped without lava', () => {
  const world = new GameWorld({ palace: 'undercroft' });
  clearEnemies(world);
  const jumpAt = [[17.0, 17.8], [43.0, 43.8], [54.2, 54.8]];
  runRight(world, 24, {
    stopAt: 95,
    jumpWhen: (p) => p.grounded && jumpAt.some(([a, b]) => p.x > a && p.x < b),
  });
  assert.ok(world.player.x >= 95, `x=${world.player.x}`);
  assert.equal(world.player.hp, world.maxHp, 'no burns on the way');
  assert.equal(world.player.deaths, 0);
});

test('undercroft: the gate holds until all three braziers burn, then opens', () => {
  const world = new GameWorld({ palace: 'undercroft' });
  clearEnemies(world);
  world.debugSetPlayer(95.2, 0.86);
  assert.equal(world.interact(), true);
  assert.equal(world.doorUnlocked, false);
  for (const b of world.level.braziers) {
    world.debugSetPlayer(b.x - 0.6, b.top + 0.86);
    assert.equal(world.interact(), true);
  }
  assert.equal(world.braziersLit.size, 3);
  assert.equal(world.doorUnlocked, true);
  clearEnemies(world);
  world.debugSetPlayer(94, 0.861);
  runRight(world, 4, { stopAt: 106.5 });
  assert.ok(world.player.x > 106, `x=${world.player.x}`);
  assert.ok(world.player.y > 3.5, `y=${world.player.y}`);
});

test('undercroft: a slash and a spark both kindle braziers', () => {
  const world = new GameWorld({ palace: 'undercroft' });
  clearEnemies(world);
  const [first, second] = world.level.braziers;
  world.debugSetPlayer(first.x - 1.0, first.top + 0.861);
  world.player.facing = 1;
  world.update(1 / 60, { attackPressed: true });
  step(world, 0.3, {});
  assert.ok(world.braziersLit.has(first.id), 'slash');
  world.debugSetPlayer(second.x - 5, second.top + 0.861);
  world.player.facing = 1;
  world.update(1 / 60, { magicPressed: true });
  step(world, 1.0, {});
  assert.ok(world.braziersLit.has(second.id), 'spark');
});

test('undercroft: brazier ledge and vessel ledge are reachable with a standard jump', () => {
  const world = new GameWorld({ palace: 'undercroft' });
  clearEnemies(world);
  world.debugSetPlayer(67.5, 0.861);
  let onBrazierLedge = false;
  let onVesselLedge = false;
  for (let i = 0; i < 420; i++) {
    const p = world.player;
    const jump = (p.grounded && p.x > 69.2 && p.x < 72) || (p.grounded && p.y > 2.5 && p.x > 74 && p.x < 79.3);
    world.update(1 / 60, { moveX: p.x < 84 ? 1 : 0, jumpPressed: jump });
    if (p.grounded && p.y > 2.6 && p.y < 3.4) onBrazierLedge = true;
    if (p.grounded && p.y > 5) { onVesselLedge = true; break; }
  }
  assert.equal(onBrazierLedge, true);
  assert.equal(onVesselLedge, true);
  world.debugSetPlayer(world.level.vesselChest.x, world.level.vesselChest.y + 0.3);
  assert.equal(world.interact(), true);
  assert.equal(world.maxHp, 100);
});

test('undercroft: forge floor passes under both ledges without snagging', () => {
  const world = new GameWorld({ palace: 'undercroft' });
  clearEnemies(world);
  world.doorUnlocked = true;
  world.debugSetPlayer(68.2, 0.861);
  step(world, 5.5, { moveX: 1 });
  assert.ok(world.player.x > 95, `x=${world.player.x}`);
});

test('undercroft: the golem stays inside its arena and fights without NaN', () => {
  const world = new GameWorld({ palace: 'undercroft' });
  for (const e of world.enemies) if (!e.isBoss) e.alive = false;
  world.doorUnlocked = true;
  world.debugSetPlayer(112, 3.86);
  let hurt = false;
  for (let i = 0; i < 60 * 25; i++) {
    const before = world.player.hp;
    world.update(1 / 60, { moveX: i % 240 < 120 ? 0.6 : -0.6, jumpPressed: i % 50 === 0 });
    if (world.player.hp < before || world.player.deaths > 0) hurt = true;
    const g = world.boss;
    assert.ok(Number.isFinite(g.x) && Number.isFinite(g.y), 'finite');
    assert.ok(g.x > 108 && g.x < 142, `golem x=${g.x}`);
    assert.ok(g.y > 3.5 && g.y < 9, `golem y=${g.y}`);
  }
  assert.equal(hurt, true, 'the golem threatens the player');
});

test('undercroft: golem falls within a fair number of hits for a carried-over hero', () => {
  const world = new GameWorld({ palace: 'undercroft', carry: { level: 3, attackLevel: 1, swordTier: 2 } });
  const golem = world.boss;
  let hits = 0;
  while (golem.alive && hits < 30) {
    golem.invuln = 0;
    world._damageEnemy(golem, world.attackDamage, 0);
    hits++;
  }
  assert.equal(golem.alive, false);
  assert.ok(hits <= 12, `hits=${hits}`);
  world.pausedForUpgrade = false;
  world.debugSetPlayer(world.level.altar.x, world.level.altar.y);
  assert.equal(world.interact(), true);
  assert.equal(world.complete, true);
});

test('undercroft: a wisp dives at a player standing below it', () => {
  const world = new GameWorld({ palace: 'undercroft' });
  for (const e of world.enemies) if (e.id !== 'wisp-u1') e.alive = false;
  world.debugSetPlayer(25.5, 0.861);
  let hurt = false;
  for (let i = 0; i < 60 * 8 && !hurt; i++) {
    const before = world.player.hp;
    world.update(1 / 60, { moveX: 0 });
    if (world.player.hp < before) hurt = true;
    const w = world.enemies.find((e) => e.id === 'wisp-u1');
    assert.ok(w.y > 0.2, `wisp y=${w.y}`);
  }
  assert.equal(hurt, true);
});
