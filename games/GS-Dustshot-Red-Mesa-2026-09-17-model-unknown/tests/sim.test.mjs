import assert from 'node:assert/strict';
import {
  createGameState, startMission, updateGame, WORLD, STAGES, buyUpgrade, upgradeStatus, UPGRADE_DEFS, shopItems,
  getBoss, snapshotPlayer, canUseShop,
} from '../src/sim.js';

let seed = 0xC1D3C0DE;
Math.random = () => {
  seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
  return (seed >>> 0) / 0x100000000;
};
const input = (moveX = 0, moveZ = 0, aimX = 0, aimZ = -1, fire = false) => ({ moveX, moveZ, aimX, aimZ, aimMagnitude: 1, fire });
function tick(s, inp, seconds) { for (let t = 0; t < seconds; t += 1 / 60) updateGame(s, inp, 1 / 60); }

/** A player who reached stage 2 with a modest kit: level 4, no equipment, no upgrades. */
function midKit() {
  const s = createGameState();
  const p = s.player;
  p.level = 4; p.damage = 12 * 1.07 ** 3; p.maxHp = 115; p.cash = 260; p.score = 9000;
  return snapshotPlayer(p);
}

/** Dodge sideways and shoot at the boss until the fight ends. */
function bossFight(s, limit = 60) {
  let elapsed = 0;
  while (s.status === 'playing' && elapsed < limit) {
    const b = getBoss(s);
    const dx = b ? b.x - s.player.x : 0;
    const dz = b ? b.z - s.player.z : -1;
    const m = Math.hypot(dx, dz) || 1;
    const dodge = Math.sin(elapsed * 1.5) > 0 ? 0.68 : -0.68;
    updateGame(s, input(dodge, 0, dx / m, dz / m, true), 1 / 60);
    elapsed += 1 / 60;
  }
  return elapsed;
}

// 1. Central street is traversable, and the warrant gate stops a player who missed the poster.
for (const stage of [0, 1]) {
  const s = createGameState({ stage }); startMission(s); s.player.hp = 9999; s.player.maxHp = 9999;
  s.player.armor = 0; // the walk checks the route, not the fights on it
  tick(s, input(0, -1), 26);
  const gate = s.world.bossGateZ;
  assert.ok(s.player.z > gate - 0.02 && s.player.z < gate + 0.75, `stage ${stage}: gate stop z=${s.player.z}`);
  assert.equal(s.posterFound, false);
  assert.equal(s.bossSpawned, false);
}

// 2. The hidden poster crate is breakable and the poster can be collected, in both stages.
for (const stage of [0, 1]) {
  const s = createGameState({ stage }); startMission(s); s.zonesSpawned = new Set([0, 1, 2, 3, 4, 5]); s.player.hp = 9999; s.player.maxHp = 9999;
  const crate = s.destructibles[0];
  assert.equal(crate.kind, 'posterCrate');
  s.player.x = Math.max(s.world.minX + 0.6, Math.min(s.world.maxX - 0.6, crate.x)); s.player.z = crate.z + 3.2;
  const dx = crate.x - s.player.x, dz = crate.z - s.player.z, m = Math.hypot(dx, dz);
  tick(s, input(0, 0, dx / m, dz / m, true), 1.5);
  assert.equal(crate.alive, false, `stage ${stage}: poster crate should break`);
  tick(s, input(dx / m, dz / m, 0, -1, false), 0.8);
  assert.equal(s.posterFound, true, `stage ${stage}: poster should be collected`);
}

// 3. Base equipment can beat Marshal Vex without any paid upgrade or level grind.
{
  const s = createGameState(); startMission(s); s.zonesSpawned = new Set([0, 1, 2, 3, 4, 5]); s.posterFound = true;
  s.player.x = 0; s.player.z = -86.2;
  updateGame(s, input(0, -1, 0, -1, false), 1 / 60);
  assert.equal(s.bossSpawned, true);
  const elapsed = bossFight(s, 40);
  assert.equal(s.status, 'victory', `base kit should clear boss; status=${s.status}, hp=${s.player.hp}, elapsed=${elapsed.toFixed(1)}`);
  assert.ok(elapsed > 5, `boss should not evaporate instantly (${elapsed.toFixed(1)}s)`);
  // The gate shut behind the player: no walking back out of the arena.
  assert.ok(s.player.z <= WORLD.bossGateZ + 0.2);
}

// 4. Upgrade economy: a normal early/mid-game cash amount buys one useful item, not the full shop.
{
  const s = createGameState(); startMission(s); s.player.cash = 250;
  assert.equal(buyUpgrade(s, 'quickdraw'), true);
  assert.equal(s.player.upgrades.quickdraw, 1);
  const lasting = shopItems(s).filter(([, d]) => !d.consumable).map(([, d]) => d.cost);
  assert.ok(s.player.cash < Math.min(...lasting), 'one purchase should not cascade into another immediately');
  assert.equal(buyUpgrade(s, 'quickdraw'), false, 'upgrades are one-time purchases');
  assert.equal(upgradeStatus(s, 'scatter'), 'unavailable', 'stage-2 stock is not sold in Cinder Creek');
}

// 5. Stage 2 is clearable with a modest carried kit: level 4, no upgrades, no equipment.
{
  const s = createGameState({ stage: 1, carry: midKit() }); startMission(s);
  assert.equal(s.player.level, 4);
  assert.equal(s.player.hp, s.player.maxHp, 'a new stage starts at full health');
  s.zonesSpawned = new Set([0, 1, 2, 3, 4, 5]); s.posterFound = true;
  s.player.x = 0; s.player.z = -86.2;
  updateGame(s, input(0, -1, 0, -1, false), 1 / 60);
  assert.equal(getBoss(s)?.kind, 'mae');
  const elapsed = bossFight(s, 60);
  assert.equal(s.status, 'victory', `mid kit should clear Iron Mae; status=${s.status}, hp=${s.player.hp}, elapsed=${elapsed.toFixed(1)}`);
  assert.ok(elapsed > 8, `Iron Mae should take a while (${elapsed.toFixed(1)}s)`);
  assert.ok(s.player.hp < s.player.maxHp, 'Iron Mae should land some hits');
}

// 6. Dynamite lands where it was thrown and hurts a player who stands still; kegs chain and clear outlaws.
{
  const s = createGameState({ stage: 1 }); startMission(s); s.zonesSpawned = new Set([0, 1, 2, 3, 4, 5]);
  s.player.x = 0; s.player.z = 0;
  s.enemies.length = 0;
  // A dynamiter right ahead, ready to throw.
  updateGame(s, input(), 1 / 60);
  const before = s.player.hp;
  s.bombs.push({ id: 999, kind: 'dynamite', x0: 0, z0: -8, tx: 0, tz: 0, x: 0, z: -8, t: 0, dur: 0.5, radius: 1.75, damage: 15, owner: 1, dead: false });
  tick(s, input(), 0.7);
  assert.ok(s.player.hp < before, 'standing on the mark should hurt');
  assert.equal(s.bombs.length, 0);

  const k = createGameState({ stage: 1 }); startMission(k); k.zonesSpawned = new Set([0, 1, 2, 3, 4, 5]);
  const keg = k.destructibles.find((d) => d.kind === 'keg');
  k.player.x = keg.x; k.player.z = keg.z + 6;
  k.enemies.push({ id: 500, kind: 'grunt', x: keg.x + 1, z: keg.z, radius: 0.48, hp: 40, maxHp: 40, speed: 0, fireTimer: 99, strafeSeed: 0, chargeTimer: 0, charging: 0, phaseTimer: 0, dead: false });
  tick(k, input(0, 0, 0, -1, true), 0.6);
  assert.equal(keg.alive, false, 'the keg should blow');
  assert.equal(k.enemies.find((e) => e.id === 500), undefined, 'the outlaw beside it should be gone');
}

// 7. Carry-over: what a player earns in Cinder Creek rides into Red Mesa Pass, and the stage-2 shop opens.
{
  const s = createGameState(); startMission(s);
  s.player.cash = 600; buyUpgrade(s, 'twinEagle'); s.player.equipment.boots = true; s.player.speed *= 1.12;
  const next = createGameState({ stage: 1, carry: snapshotPlayer(s.player) });
  assert.equal(next.player.upgrades.twinEagle, 1);
  assert.equal(next.player.equipment.boots, true);
  assert.ok(Math.abs(next.player.damage - 15) < 1e-9);
  assert.equal(next.player.cash, 310);
  next.player.x = next.world.shop.x; next.player.z = next.world.shop.z; startMission(next);
  assert.equal(canUseShop(next), true);
  assert.equal(upgradeStatus(next, 'tonic'), 'full', 'tonic needs missing health');
  next.player.hp -= 50;
  assert.equal(buyUpgrade(next, 'tonic'), true);
  assert.equal(buyUpgrade(next, 'scatter'), false, '$220 left is not enough for the scattergun');
  next.player.cash += 200;
  assert.equal(buyUpgrade(next, 'scatter'), true);
  assert.equal(next.player.projectileCount, 3);
  assert.ok(UPGRADE_DEFS.tonic.consumable);
}

// 8. Every spawn point and pickup sits outside the colliders.
for (const stage of STAGES) {
  const inside = (x, z, r) => stage.colliders.some((c) => Math.abs(x - c.x) < c.w / 2 + r && Math.abs(z - c.z) < c.d / 2 + r);
  for (const zone of stage.zones) for (const [kind, x, z] of zone.pack) assert.ok(!inside(x, z, 0.45), `${stage.id}: ${kind} at ${x},${z} spawns in a collider`);
  for (const [kind, x, z] of stage.equipment.items) assert.ok(!inside(x, z, 0.3), `${stage.id}: ${kind} sits in a collider`);
  for (const c of stage.crates) assert.ok(!inside(c.x, c.z, 0.2), `${stage.id}: ${c.kind} sits in a collider`);
  assert.ok(!inside(stage.world.shop.x, stage.world.shop.z, 0.4), `${stage.id}: the shop spot is blocked`);
}

console.log('Dustshot simulation checks passed.');
