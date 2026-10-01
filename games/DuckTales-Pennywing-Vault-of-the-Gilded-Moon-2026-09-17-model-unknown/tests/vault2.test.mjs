// Vault II (the Sunken Orrery) in the simulation: every required step on the
// way in and on the escape back is physically reachable, the optional arches
// and the cistern work, vents and the Warden behave, and a scripted run clears.
import assert from 'node:assert/strict';
import { GameSimulation, ventState } from '../src/game/core.js';
import { VAULT_II } from '../src/game/level2.js';

const quiet = () => {};
const H = 1 / 120;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function makeSim(opts = {}) {
  return new GameSimulation({ onEvent: quiet, level: VAULT_II, ...opts });
}

/** Stand Pennywing on a platform (at its current position) at x. */
function putOn(sim, id, x) {
  sim.updateColliders();
  const c = sim.colliderById.get(id);
  if (!c) throw new Error(`missing ${id}`);
  const p = sim.player;
  p.x = x ?? c.x;
  p.y = c.y + c.h / 2 + p.h / 2 + 0.001;
  p.vx = 0; p.vy = 0;
  p.grounded = true; p.groundId = id; p.pogo = false; p.invuln = 0;
}

/**
 * From `from` at x, jump (or pogo) toward `target`, steering in the air toward
 * its centre. With moving platforms, every start time over a cycle is tried.
 */
function reach(from, x, target, { pogo = false, frames = 480, setup, times = [0] } = {}) {
  for (const t0 of times) {
    const sim = makeSim();
    sim.hasGear = true;
    sim.time = t0;
    // Geometry only: patrolling enemies are timing obstacles, checked further down.
    for (const e of sim.enemyStates) e.alive = false;
    setup?.(sim);
    putOn(sim, from, typeof x === 'function' ? x(sim) : x);
    for (let i = 0; i < frames; i++) {
      const p = sim.player;
      const tgt = sim.colliderById.get(target);
      const moveX = clamp((tgt.x - p.x) * 1.6, -1, 1);
      sim.step(H, { moveX, jumpPressed: !pogo && i === 1, pogoHeld: pogo, pogoPressed: pogo && i === 1 });
      if (sim.player.groundId === target && i > 1) return { ok: true, sim, t0 };
      if (sim.deaths > 0) break;
    }
  }
  return { ok: false };
}

const cycle = (id) => {
  const m = VAULT_II.platforms.find((p) => p.id === id).moving;
  const period = (Math.PI * 2) / m.speed;
  const out = [];
  for (let t = 0; t < period; t += 0.05) out.push(t);
  return out;
};

const must = (label, r) => assert(r.ok, `${label} should be reachable`);

// ---- The way in.
must('start → pillar 1', reach('start-floor', 10.5, 'pillar-1'));
must('pillar 1 → pillar 2', reach('pillar-1', 14.0, 'pillar-2'));
must('pillar 2 → pillar 3', reach('pillar-2', 17.8, 'pillar-3'));
must('pillar 3 → pillar 4', reach('pillar-3', 21.5, 'pillar-4'));
must('pillar 4 → pillar 5', reach('pillar-4', 25.8, 'pillar-5'));
must('pillar 5 → colonnade exit', reach('pillar-5', 29.5, 'colonnade-exit'));
must('colonnade exit → aqueduct (over the cistern hole)', reach('colonnade-exit', 38.4, 'aqueduct'));
must('aqueduct → ledge', reach('aqueduct', 50.6, 'aqueduct-ledge'));
must('ledge → Springsmith hall', reach('aqueduct-ledge', 53.7, 'shrine-floor'));
must('cistern floor → step 1', reach('cistern-floor', 50.9, 'cistern-step-1'));
must('step 1 → step 2', reach('cistern-step-1', 52.9, 'cistern-step-2'));
must('step 2 → Springsmith hall', reach('cistern-step-2', 54.8, 'shrine-floor'));
must('cistern floor → key plinth', reach('cistern-floor', 47.9, 'key-plinth'));
must('Springsmith hall → carriage', reach('shrine-floor', 63.0, 'carriage', { times: cycle('carriage') }));
must('carriage → piston', reach('carriage', (s) => s.colliderById.get('carriage').x + 0.8, 'piston', { times: cycle('carriage') }));
must('piston → gate approach', reach('piston', (s) => s.colliderById.get('piston').x + 0.8, 'gate-approach', { times: cycle('piston') }));
must('vault step 1 → step 2', reach('vault-step-1', 101.5, 'vault-step-2', { setup: (s) => { s.boss.alive = false; } }));
must('vault step 2 → vault floor', reach('vault-step-2', 103.0, 'vault-floor', { setup: (s) => { s.boss.alive = false; } }));

// ---- The escape back (leftward).
must('gate approach → piston', reach('gate-approach', 76.0, 'piston', { times: cycle('piston') }));
must('piston → carriage', reach('piston', (s) => s.colliderById.get('piston').x - 0.8, 'carriage', { times: cycle('carriage') }));
must('carriage → Springsmith hall', reach('carriage', (s) => s.colliderById.get('carriage').x - 0.8, 'shrine-floor', { times: cycle('carriage') }));
must('hall → ledge', reach('shrine-floor', 55.8, 'aqueduct-ledge'));
must('ledge → aqueduct', reach('aqueduct-ledge', 52.8, 'aqueduct'));
must('aqueduct → colonnade exit', reach('aqueduct', 41.9, 'colonnade-exit'));
must('colonnade exit → pillar 5', reach('colonnade-exit', 30.6, 'pillar-5'));
must('pillar 5 → pillar 4', reach('pillar-5', 28.4, 'pillar-4'));
must('pillar 4 → pillar 3', reach('pillar-4', 24.2, 'pillar-3'));
must('pillar 3 → pillar 2', reach('pillar-3', 20.5, 'pillar-2'));
must('pillar 2 → pillar 1', reach('pillar-2', 16.6, 'pillar-1'));
must('pillar 1 → start', reach('pillar-1', 12.9, 'start-floor'));

// ---- The optional high arches (stock springstaff pogo).
must('start → arch A', reach('start-floor', 10.2, 'high-a', { pogo: true }));
must('arch A → B', reach('high-a', 12.9, 'high-b', { pogo: true }));
must('arch B → C', reach('high-b', 17.8, 'high-c', { pogo: true }));
must('arch C → D', reach('high-c', 22.6, 'high-d', { pogo: true }));
must('arch D → E', reach('high-d', 27.5, 'high-e', { pogo: true }));

// Every treasure sits within reach of somewhere Pennywing can stand or bounce.
{
  const tops = VAULT_II.platforms.map((p) => ({ ...p, top: p.y + p.h / 2 }));
  for (const item of [...VAULT_II.coins, ...VAULT_II.gems, ...VAULT_II.relics]) {
    const ok = tops.some((p) => {
      const range = p.moving ? p.moving.amp : 0;
      const xr = p.moving?.axis === 'x' ? range : 0;
      const yr = p.moving?.axis === 'y' ? range : 0;
      if (item.x < p.x - p.w / 2 - xr - 1.2 || item.x > p.x + p.w / 2 + xr + 1.2) return false;
      const stand = p.top + 0.64;
      return item.y > stand - 1.0 - yr && item.y < stand + 3.1 + 1.0 + yr;
    });
    assert(ok, `${item.id} at ${item.x},${item.y} is within reach of a platform`);
  }
}

// ---- The cistern: dropping in with BOUNCE held cracks the cache and lands safely.
{
  const sim = makeSim();
  putOn(sim, 'colonnade-exit', 38.0);
  let landed = false;
  for (let i = 0; i < 600; i++) {
    sim.step(H, { moveX: sim.player.x < 40.6 ? 0.55 : 0, pogoHeld: sim.player.vy < 0 && sim.player.y < -0.2 });
    if (sim.player.groundId === 'cistern-floor') { landed = true; break; }
  }
  assert(sim.broken.has('cistern-cache'), 'a bounce drop cracks the cistern cache');
  assert(landed, 'Pennywing lands on the cistern floor');
  assert.equal(sim.deaths, 0, 'the drop is safe');
}

// Walking over the plinth picks up the Star Key and opens the gate.
{
  const sim = makeSim();
  putOn(sim, 'key-plinth', 49.6);
  sim.step(H, {});
  assert.equal(sim.hasGear, true, 'Star Key collected from the plinth');
  sim.updateColliders();
  assert.equal(sim.gates.key.active, false, 'the orrery gate opens with the key');
}

// ---- Vents: a cycle of off, sputter and scald; only the scald hurts.
{
  const v = VAULT_II.hazards.find((h) => h.id === 'vent-colonnade');
  const states = new Set();
  for (let t = 0; t < v.period; t += 0.05) states.add(ventState(v, t));
  assert.deepEqual([...states].sort(), [0, 1, 2], 'vent cycles through off, warning and scalding');
  const sim = makeSim();
  putOn(sim, 'colonnade-exit', v.x);
  sim.time = 0.3 - v.phase; // inside the on window
  const hp = sim.player.hp;
  sim.step(H, {});
  assert.equal(sim.player.hp, hp - 1, 'standing in a scalding vent hurts');
  const safe = makeSim();
  putOn(safe, 'colonnade-exit', v.x);
  safe.time = v.on + 0.2 - v.phase; // off window
  safe.step(H, {});
  assert.equal(safe.player.hp, hp, 'an idle vent is harmless');
}

// Jumping over a scalding vent from a running start clears it.
{
  const v = VAULT_II.hazards.find((h) => h.id === 'vent-gate');
  const sim = makeSim();
  sim.hasGear = true;
  for (const e of sim.enemyStates) e.alive = false;
  putOn(sim, 'gate-approach', 76.2);
  const hp = sim.player.hp;
  let jumped = false;
  for (let i = 0; i < 160; i++) {
    sim.time = (v.period * 10) - v.phase + 0.05; // hold the vent in its scalding window
    const press = !jumped && sim.player.x > v.x - 2.3;
    jumped ||= press;
    sim.step(H, { moveX: 1, jumpPressed: press });
  }
  assert(sim.player.x > v.x + 1, 'ran past the vent');
  assert.equal(sim.player.hp, hp, 'a jump clears a scalding vent');
}

// ---- Gearbats: a bounce from above grounds one; flying into it hurts.
{
  const sim = makeSim();
  const bat = sim.enemyStates.find((e) => e.id === 'bat-1');
  sim.player.x = bat.x; sim.player.y = bat.y + bat.h / 2 + 0.55; sim.player.vy = -5; sim.player.pogo = true; sim.player.invuln = 0;
  sim.updateEnemies(0);
  assert.equal(bat.alive, false, 'a pogo bounce grounds a Gearbat');
  assert(sim.player.vy > 9, 'and springs Pennywing back up');
  const sim2 = makeSim();
  const bat2 = sim2.enemyStates.find((e) => e.id === 'bat-1');
  sim2.player.x = bat2.x - 0.5; sim2.player.y = bat2.y - 0.5; sim2.player.vy = 4; sim2.player.invuln = 0;
  const hp = sim2.player.hp;
  sim2.updateEnemies(0);
  assert.equal(sim2.player.hp, hp - 1, 'touching a Gearbat from below hurts');
}

// ---- The Orrery Warden: six stock bounces or three with the Coil.
function wardenHit(sim) {
  const b = sim.boss;
  b.active = true; b.alive = true; b.mode = 'idle'; b.modeTimer = 99; b.invuln = 0; b.vx = 0; b.airborne = false; b.y = b.baseY;
  sim.player.x = b.x; sim.player.y = b.y + b.h / 2 + 0.34; sim.player.vy = -6; sim.player.pogo = true; sim.player.invuln = 0;
  sim.updateBoss(0);
}
{
  const sim = makeSim();
  sim.hasGear = true;
  for (let i = 0; i < 5; i++) { wardenHit(sim); assert.equal(sim.boss.alive, true); }
  wardenHit(sim);
  assert.equal(sim.boss.alive, false, 'stock staff topples the Warden in six bounces');
  assert.equal(sim.phase, 'crown');
  const up = makeSim({ profile: { staffLevel: 2 } });
  for (let i = 0; i < 3; i++) wardenHit(up);
  assert.equal(up.boss.alive, false, 'the Coil topples it in three');
}

// The Warden hops after a charge and its landing sends sparks; a grounded
// Pennywing in their path is hurt, a jumping one is not.
{
  const sim = makeSim();
  sim.hasGear = true;
  putOn(sim, 'arena', 86.2);
  sim.step(H, {});
  assert.equal(sim.boss.active, true, 'entering the dome wakes the Warden');
  assert(sim.player.checkpointX > VAULT_II.arenaLeftGate.x, 'the dome checkpoint is inside the gate');
  let hopped = false, sparked = false;
  for (let i = 0; i < 120 * 12 && !sparked; i++) {
    sim.player.invuln = 5; // watch the pattern without taking hits
    sim.step(H, {});
    if (sim.boss.airborne) hopped = true;
    if (sim.sparks.length) sparked = true;
  }
  assert(hopped, 'the Warden hops after a charge');
  assert(sparked, 'its landing sends sparks along the floor');
  const s = sim.sparks[0];
  assert(Math.abs(s.y - (VAULT_II.boss.arena.floor + s.h / 2)) < 0.1, 'sparks run along the dome floor');

  // A grounded player in a spark's path takes a hit.
  const g = makeSim();
  g.hasGear = true; g.boss.active = true;
  putOn(g, 'arena', 90);
  g.sparks.push({ x: 89.2, y: 0.27, vx: 6, w: 0.55, h: 0.5, life: 1 });
  const hp = g.player.hp;
  for (let i = 0; i < 30; i++) g.step(H, {});
  assert.equal(g.player.hp, hp - 1, 'a spark hurts a grounded Pennywing');

  // A jump over the spark avoids it.
  const j = makeSim();
  j.hasGear = true; j.boss.active = true;
  putOn(j, 'arena', 90);
  j.sparks.push({ x: 88.0, y: 0.27, vx: 6, w: 0.55, h: 0.5, life: 1.2 });
  const hp2 = j.player.hp;
  for (let i = 0; i < 120; i++) j.step(H, { jumpPressed: i === 12 });
  assert.equal(j.player.hp, hp2, 'jumping clears a spark');
}

// ---- A scripted run: key, Warden, star, escape.
{
  const events = [];
  const sim = new GameSimulation({ onEvent: (e) => events.push(e), level: VAULT_II, seed: 11 });
  const visit = (x, y, frames = 4) => {
    sim.player.x = x; sim.player.y = y; sim.player.vx = 0; sim.player.vy = 0; sim.player.grounded = false;
    for (let i = 0; i < frames; i++) sim.step(1 / 60, {});
  };
  for (const c of VAULT_II.coins.slice(0, 10)) visit(c.x, c.y);
  visit(VAULT_II.relics[0].x, VAULT_II.relics[0].y);
  assert.equal(sim.hasGear, true, 'the Star Key is collected');
  visit(86.0, 0.7);
  assert.equal(sim.boss.active, true, 'the dome wakes after the gate');
  for (let i = 0; i < 6; i++) {
    const b = sim.boss;
    b.invuln = 0; b.mode = 'idle'; b.modeTimer = 99; b.vx = 0; b.airborne = false; b.y = b.baseY;
    sim.player.x = b.x; sim.player.y = b.y + b.h / 2 + 0.35; sim.player.vy = -7; sim.player.pogo = true; sim.player.invuln = 0;
    sim.updateBoss(0);
  }
  assert.equal(sim.boss.alive, false, 'Warden defeated');
  visit(VAULT_II.crown.x, VAULT_II.crown.y);
  assert.equal(sim.phase, 'escape', 'the star starts the escape');
  assert(sim.escapeTime > 69.5 && sim.escapeTime <= 70, 'a 70 second escape clock');
  for (const x of [100, 90, 80, 70, 58, 46, 35, 25, 13, 2.4]) {
    visit(x, 0.8, 3);
    if (sim.completed) break;
  }
  assert.equal(sim.completed, true, 'the escape reaches the entrance');
  const done = events.find((e) => e.type === 'complete');
  assert(done, 'completion is reported');
  assert.equal(done.stats.firstClear, true);
  assert.equal(sim.profile.records['vault-2'].normal.clears, 1, 'the record is kept per vault and difficulty');
}

// ---- Save and continue: a run exported at a checkpoint comes back the same.
{
  const sim = makeSim({ difficulty: 'daredevil' });
  putOn(sim, 'shrine-floor', 58);
  sim.step(H, {});
  sim.collected.add('coin-0');
  sim.runCoins = 40;
  sim.hasGear = true; sim.phase = 'guardian';
  const saved = JSON.parse(JSON.stringify(sim.exportRun()));
  const back = makeSim({ difficulty: 'daredevil' });
  assert.equal(back.importRun(saved), true);
  assert.equal(back.runCoins, 40);
  assert.equal(back.hasGear, true);
  assert(back.collected.has('coin-0'));
  assert.equal(back.player.x, VAULT_II.checkpoints.find((c) => c.id === 'springsmith').x, 'continues at the Springsmith');
  assert.equal(back.player.maxHp, 3, 'daredevil keeps one heart less');
  assert.equal(makeSim().importRun({ ...saved, level: 'vault-1' }), false, 'a save from another vault is refused');
}

console.log('vault2.test.mjs: the Sunken Orrery is reachable, fair and completable');
