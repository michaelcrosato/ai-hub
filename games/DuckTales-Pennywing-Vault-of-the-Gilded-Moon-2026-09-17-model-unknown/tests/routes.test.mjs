import assert from 'node:assert/strict';
import { GameSimulation } from '../src/game/core.js';
import { platforms } from '../src/game/level.js';

const topOf = (id) => {
  const p = platforms.find(v => v.id === id);
  if (!p) throw new Error(`missing ${id}`);
  return p;
};

function putOn(sim, id, x = null) {
  const p = topOf(id);
  sim.player.x = x ?? p.x;
  sim.player.y = p.y + p.h / 2 + sim.player.h / 2 + 0.01;
  sim.player.vx = 0; sim.player.vy = 0;
  sim.player.grounded = true; sim.player.groundId = id; sim.player.pogo = false;
}

function pogoTo(from, startX, target, moveX = 1) {
  const sim = new GameSimulation({ onEvent: () => {} });
  putOn(sim, from, startX);
  for (let i = 0; i < 360; i++) {
    sim.step(1 / 120, { moveX, pogoHeld: true, pogoPressed: i === 0 });
    if (sim.player.groundId === target) return true;
  }
  return false;
}

assert(pogoTo('start-floor', 10.2, 'upper-a'), 'start reaches high road');
assert(pogoTo('upper-a', 14.5, 'upper-b'), 'upper A reaches B');
assert(pogoTo('upper-b', 19.5, 'upper-c'), 'upper B reaches C');
assert(pogoTo('upper-c', 24.5, 'upper-d'), 'upper C reaches D');
assert(pogoTo('upper-d', 29.2, 'gear-perch'), 'upper D reaches Moon Gear perch');

// Lower cache: deliberately pogo onto the cracked floor, drop safely, then keep moving through the lower tunnel.
{
  const sim = new GameSimulation({ onEvent: () => {} });
  putOn(sim, 'main-floor-1a', 23.1);
  let broke = false, reachedLower = false, touchedStep = false, rejoined = false;
  for (let i = 0; i < 2600; i++) {
    const moveX = broke ? 0.68 : 0.2;
    sim.step(1 / 120, { moveX, pogoHeld: true, pogoPressed: i === 0 });
    if (sim.broken.has('crack-a')) broke = true;
    if (sim.player.groundId === 'treasure-floor') reachedLower = true;
    if (sim.player.groundId === 'treasure-step') touchedStep = true;
    if (reachedLower && sim.player.x > 40 && sim.player.y > -1.5) { rejoined = true; break; }
  }
  assert(broke, 'cracked cache opens with pogo');
  assert(reachedLower, 'player lands safely in treasure tunnel');
  assert(touchedStep, 'lower route uses the return ledges');
  assert(rejoined, 'lower route rejoins the main route without a forced death');
  assert.equal(sim.deaths, 0, 'lower route does not require damage or respawn');
}

console.log('routes.test.mjs: high route and lower detour are physically reachable');
