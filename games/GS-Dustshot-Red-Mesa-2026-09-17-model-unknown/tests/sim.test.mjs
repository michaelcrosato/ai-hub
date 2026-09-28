import assert from 'node:assert/strict';
import { createGameState, startMission, updateGame, WORLD, buyUpgrade, UPGRADE_DEFS, getBoss } from '../src/sim.js';

let seed = 0xC1D3C0DE;
Math.random = () => {
  seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
  return (seed >>> 0) / 0x100000000;
};
const input = (moveX=0, moveZ=0, aimX=0, aimZ=-1, fire=false) => ({ moveX, moveZ, aimX, aimZ, aimMagnitude: 1, fire });
function tick(s, inp, seconds) { for (let t=0; t<seconds; t+=1/60) updateGame(s, inp, 1/60); }

// 1. Central street is traversable, and the warrant gate stops a player who missed the poster.
{
  const s = createGameState(); startMission(s); s.player.hp = 9999; s.player.maxHp = 9999;
  tick(s, input(0,-1), 26);
  assert.ok(s.player.z > WORLD.bossGateZ - 0.02 && s.player.z < WORLD.bossGateZ + 0.75, `gate stop z=${s.player.z}`);
  assert.equal(s.posterFound, false);
  assert.equal(s.bossSpawned, false);
}

// 2. The hidden poster crate is breakable and the poster can be collected.
{
  const s = createGameState(); startMission(s); s.zonesSpawned = new Set([0,1,2,3,4,5]); s.player.hp = 9999; s.player.maxHp = 9999;
  s.player.x = WORLD.posterCrate.x; s.player.z = WORLD.posterCrate.z + 3.2;
  tick(s, input(0,0,0,-1,true), 1.3);
  assert.equal(s.destructibles[0].alive, false, 'poster crate should break');
  tick(s, input(0,-1,0,-1,false), .8);
  assert.equal(s.posterFound, true, 'poster should be collected');
}

// 3. Base equipment can beat the boss without any paid upgrade or level grind.
{
  const s = createGameState(); startMission(s); s.zonesSpawned = new Set([0,1,2,3,4,5]); s.posterFound = true;
  s.player.x = 0; s.player.z = -86.2;
  updateGame(s, input(0,-1,0,-1,false), 1/60);
  assert.equal(s.bossSpawned, true);
  let elapsed = 0;
  while (s.status === 'playing' && elapsed < 40) {
    const b = getBoss(s);
    const dx = b ? b.x - s.player.x : 0;
    const dz = b ? b.z - s.player.z : -1;
    const m = Math.hypot(dx,dz) || 1;
    const dodge = Math.sin(elapsed * 1.5) > 0 ? 0.68 : -0.68;
    updateGame(s, input(dodge, 0, dx/m, dz/m, true), 1/60);
    elapsed += 1/60;
  }
  assert.equal(s.status, 'victory', `base kit should clear boss; status=${s.status}, hp=${s.player.hp}, elapsed=${elapsed.toFixed(1)}`);
  assert.ok(elapsed > 5, `boss should not evaporate instantly (${elapsed.toFixed(1)}s)`);
}

// 4. Upgrade economy: a normal early/mid-game cash amount buys one useful item, not the full shop.
{
  const s = createGameState(); startMission(s); s.player.cash = 250;
  assert.equal(buyUpgrade(s, 'quickdraw'), true);
  assert.equal(s.player.upgrades.quickdraw, 1);
  assert.ok(s.player.cash < Math.min(...Object.values(UPGRADE_DEFS).map(x=>x.cost)), 'one purchase should not cascade into another immediately');
  assert.equal(buyUpgrade(s, 'quickdraw'), false, 'upgrades are one-time purchases');
}

console.log('Dustshot simulation checks passed.');
