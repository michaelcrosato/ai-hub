import { distance, key, equipmentStats } from './model.js';
import { alive, teamOf, actionSpec, actionBlocked, inRange, affected, predict } from './abilities.js';
function value(engine, u, a, center) {
  const targets = affected(a, u, center, engine.b.units);
  let score = 0;
  for (const t of targets) {
    if (t.removed || t.airborne) continue;
    const p = predict(engine.db, u, t, a),
      friend = teamOf(t) === teamOf(u),
      chance = p.hit / 100;
    if (!chance) continue;
    if (p.revive && t.hp <= 0) {
      score += friend ? 100 : -100;
      continue;
    }
    if (t.hp <= 0) continue;
    if (p.amount) {
      if (p.mp)
        score +=
          (p.heal ? (friend ? 1 : -1) : friend ? -1 : 1) * Math.min(p.amount, p.heal ? t.maxMp - t.mp : t.mp) * 0.18 * chance;
      else if (p.heal) score += (friend ? 1 : -1.4) * Math.min(p.amount, t.maxHp - t.hp) * chance * (t.rescue ? 1.6 : 1);
      else score += (friend ? -2 : 1) * Math.min(p.amount, t.hp) * chance + (p.amount >= t.hp ? (friend ? -75 : 45) * chance : 0);
    }
    for (const s of a.add || []) {
      if (t.status[s]) continue;
      const good = ['Haste', 'Protect', 'Shell', 'Regen', 'Reraise', 'Reflect', 'Float', 'Faith', 'Quick'].includes(s);
      score +=
        (good === friend ? 1 : -1.5) *
        ({
          Haste: 17,
          Protect: 10,
          Shell: 8,
          Regen: 12,
          Reraise: 16,
          Petrify: 55,
          Dead: 60,
          Stop: 26,
          Poison: 13,
          Sleep: 25,
          "Don't Act": 25,
          Silence: t.maxMp > 35 ? 25 : 2,
        }[s] || 8) *
        chance;
    }
    for (const s of a.cancel || []) if (t.status[s]) score += (friend ? 1 : -1) * 15 * chance;
    if (a.name === 'Chakra' && friend) score += Math.min(t.maxMp - t.mp, u.pa * 2) * 0.5;
    if (a.name === 'Golem' && friend && engine.b.golem[u.team] === 0) score += 12;
    if (a.name === 'Yell' && friend && t.speed < (t.baseSpeed || t.speed) + 2) score += 13;
    if (a.name === 'Accumulate' && friend && t.pa < 12) score += 6;
    if (a.name === 'Scream' && friend && u.speed < (u.baseSpeed || u.speed) + 3) score += 25;
    if (a.name === 'MBarrier' && friend && !t.status.Haste) score += 40;
    if (a.name === 'Stigma Magic' && friend)
      score +=
        Object.keys(t.status).filter((s) =>
          ['Poison', 'Petrify', 'Silence', 'Confusion', 'Sleep', "Don't Act", "Don't Move"].includes(s),
        ).length * 18;
    if (a.name === 'Galaxy Stop' && !friend && !t.status.Stop) score += 45;
  }
  if (a.ctr > 0) score *= Math.max(0.45, 1 - a.ctr * 0.027);
  if (a.family === 'Item') score -= 2;
  if (a.name === 'Wish') score -= Math.ceil(u.maxHp * 0.2) * 0.4;
  if (a.family === 'WORK') score -= u.pa * 0.9;
  return score;
}
/** Search local positions and targets without changing the saved game state. */
export function choosePlan(engine) {
  const u = engine.active;
  if (!u) return null;
  const opponents = engine.b.units.filter((v) => alive(v) && teamOf(v) !== teamOf(u));
  const home = { x: u.x, z: u.z, h: u.h, terrain: u.terrain },
    originalMoved = u.moved,
    reachable = [...engine.reachable(u).values()];
  const actions = engine
    .actions(u)
    .filter(
      (a) =>
        !actionBlocked(engine.db, engine.state, u, a) &&
        !['Invitation', 'Gil Taking', 'Negotiate', 'Steal Exp.'].includes(a.name),
    );
  const regular = actions.filter((a) => a.family !== 'Throw'),
    throws = actions
      .filter((a) => a.family === 'Throw')
      .sort((a, b) => b.wp - a.wp)
      .slice(0, 5),
    usable = [...regular, ...throws];
  const centers = engine.b.units.filter((v) => !v.removed && !v.airborne).map((v) => ({ x: v.x, z: v.z, h: v.h }));
  let best = { score: -Infinity, pos: home, action: null, center: null };
  try {
    for (const pos of reachable) {
      Object.assign(u, { x: pos.x, z: pos.z, h: pos.h, terrain: pos.t || home.terrain });
      const nearest = opponents.length ? Math.min(...opponents.map((v) => distance(u, v))) : 0,
        danger = opponents.reduce((n, v) => n + (distance(v, u) <= 3 ? 1 : 0), 0);
      let approach = -nearest * 0.9 - pos.cost * 0.07;
      if (u.rescue) {
        const guards = engine.b.units.filter((v) => v.team === u.team && !v.guest && alive(v));
        approach = nearest * 0.45 - (guards.length ? Math.min(...guards.map((v) => distance(u, v))) : 0) * 0.4;
      }
      if (u.hp < u.maxHp * 0.3) approach -= danger * 1.8;
      if (!opponents.length && engine.b.objective === 'explore' && engine.b.grid.exit)
        approach = -distance(u, { x: engine.b.grid.exit[0], z: engine.b.grid.exit[1] }) * 10;
      if (!opponents.length && engine.b.objective === 'switches' && u.name === 'Ramza') {
        const target = engine.b.grid.switches.find((s) => !s.on);
        if (target) approach = -distance(u, target) * 10;
      }
      if (engine.b.grid.gateClosed) {
        const target = engine.b.grid.switches.find((s) => !s.on);
        if (target && u.name === 'Ramza') approach -= distance(u, target) * 1.5;
      }
      if (approach > best.score) best = { score: approach, pos: { ...pos }, action: null, center: null };
      if (u.acted || u.status["Don't Act"]) continue;
      for (const a of usable) {
        let cands = a.self ? [{ x: u.x, z: u.z, h: u.h }] : centers;
        if (a.area >= 999) cands = [{ x: u.x, z: u.z, h: u.h }];
        for (const c of cands) {
          if (!inRange(engine.db, u, a, c) || (a.line && c.x !== u.x && c.z !== u.z)) continue;
          const score = value(engine, u, a, c) + approach;
          if (score > best.score + 0.001) best = { score, pos: { ...pos }, action: a, center: { ...c } };
        }
      }
    }
  } finally {
    Object.assign(u, home);
    u.moved = originalMoved;
  }
  return best;
}
export function executePlan(engine, plan = choosePlan(engine)) {
  const u = engine.active;
  if (!u || !plan) return;
  if (distance(u, plan.pos) > 0 && !u.moved) engine.move(plan.pos.x, plan.pos.z);
  if (engine.b.result) return;
  if (plan.action && !u.acted) engine.act(plan.action.id, plan.center.x, plan.center.z, true);
  if (engine.b.result) return;
  const foes = engine.b.units.filter((v) => alive(v) && teamOf(v) !== teamOf(u)).sort((a, b) => distance(u, a) - distance(u, b));
  if (foes[0]) engine.face(u, foes[0]);
  engine.wait(u.facing);
}
