// Rail combat for Vesper Lane. No engine imports: tests step this directly.
import { LEVEL, STAGES } from './level.js';

const HIT_R = 0.72;
const SHOT_PAD = 1.35;
const PICK_R = 1.55;
const SOLID_PAD_X = 0.42;
const SOLID_PAD_Y = 0.36;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function hypot(x, y, z = 0) {
  return Math.hypot(x, y, z);
}

function spans(a0, a1, b, pad) {
  const lo = Math.min(a0, a1) - pad;
  const hi = Math.max(a0, a1) + pad;
  return b >= lo && b <= hi;
}

function pushFx(sim, type, at) {
  sim.fx.push(at ? { type, x: at.x, y: at.y, s: at.s } : { type });
  if (sim.fx.length > 24) sim.fx.shift();
}

export function createSim(options = {}) {
  const stageId = options.stageId || 'glass-trench';
  const sim = {
    level: STAGES[stageId] || LEVEL,
    stageId,
    route: [],
    t: 0,
    s: 0,
    prevS: 0,
    x: 0,
    y: 0,
    speed: (STAGES[stageId] || LEVEL).cruise,
    meter: 1,
    shields: (STAGES[stageId] || LEVEL).maxShields,
    bombs: (STAGES[stageId] || LEVEL).startBombs,
    upgrade: false,
    weaponTier: 0,
    wings: 2,
    rolling: 0,
    rollWait: 0,
    cool: 0,
    shots: [],
    incoming: [],
    live: [],
    done: new Set(),
    boss: null,
    checkpoint: null,
    allyCall: null,
    allySaved: false,
    branchBeacon: false,
    escortUntil: -1,
    escortArm: 0,
    escortShots: 0,
    hazardHits: 0,
    deaths: 0,
    score: 0,
    kills: 0,
    designatedKills: 0,
    deflected: 0,
    crashWhileRolling: 0,
    phase: 'play',
    paused: false,
    atEdge: false,
    edgeX: 0,
    edgeY: 0,
    aim: { x: 0, y: 0 },
    lastVolley: 0,
    boosting: false,
    braking: false,
    result: null,
    invuln: 0,
    meterLock: false,
    fx: [],
    _prev: { bomb: false, roll: false, pause: false },
  };
  sim.step = (dt, input) => step(sim, dt, input ?? {});
  loadStage(sim, stageId, false);
  return sim;
}

function carryOf(sim) {
  return {
    score: sim.score,
    bombs: sim.bombs,
    weaponTier: sim.weaponTier,
    upgrade: sim.upgrade,
    wings: sim.wings,
    shields: sim.shields,
    allySaved: sim.allySaved,
    branchBeacon: sim.branchBeacon,
    kills: sim.kills,
    designatedKills: sim.designatedKills,
    deaths: sim.deaths,
    escortShots: sim.escortShots,
    deflected: sim.deflected,
    hazardHits: sim.hazardHits,
    crashWhileRolling: sim.crashWhileRolling,
  };
}

function loadStage(sim, id, carry) {
  const stage = STAGES[id];
  const kept = carry ? carryOf(sim) : null;
  sim.level = stage;
  sim.stageId = id;
  if (!sim.route.includes(id)) sim.route.push(id);
  sim.s = 0;
  sim.prevS = 0;
  sim.x = 0;
  sim.y = 0;
  sim.speed = stage.cruise;
  sim.meter = 1;
  sim.meterLock = false;
  sim.checkpoint = null;
  sim.live = [];
  sim.done = new Set();
  sim.boss = null;
  sim.shots = [];
  sim.incoming = [];
  sim.rolling = 0;
  sim.rollWait = 0;
  sim.cool = 0;
  sim.invuln = 0;
  sim.allyCall = null;
  sim.escortUntil = -1;
  sim.escortArm = 0;
  sim.t = carry ? sim.t : 0;
  if (!carry) {
    sim.shields = stage.maxShields;
    sim.bombs = stage.startBombs;
    sim.weaponTier = 0;
    sim.upgrade = false;
    sim.wings = 2;
    sim.score = 0;
    sim.kills = 0;
    sim.designatedKills = 0;
    sim.allySaved = false;
    sim.branchBeacon = false;
    sim.escortShots = 0;
    sim.deaths = 0;
    sim.deflected = 0;
    sim.hazardHits = 0;
    sim.crashWhileRolling = 0;
  } else {
    Object.assign(sim, kept);
  }
}

function findEvent(level, id) {
  for (const e of level.events) if (e.id === id) return e;
  return null;
}

function bombReach(sim, e) {
  return hypot(sim.x - e.x, sim.y - e.y, (sim.s - e.s) * 0.5) <= sim.level.bombRadius;
}

function killEnemy(sim, e) {
  if (e.dead) return;
  e.dead = true;
  e.hp = 0;
  sim.done.add(e.id);
  sim.kills += 1;
  if (e.designated) {
    sim.designatedKills += 1;
    sim.score += e.points;
  }
  pushFx(sim, 'boom', e);
  if (e.branch) sim.branchBeacon = true;
  if (e.allyThreat) {
    sim.allySaved = true;
    sim.allyCall = null;
    sim.escortUntil = sim.s + 150;
    sim.escortArm = 0.15;
  }
}

function damageCraft(sim, amount, { solid = false } = {}) {
  if (sim.invuln > 0 || sim.phase !== 'play') return false;
  sim.shields -= amount;
  sim.invuln = 0.45;
  pushFx(sim, 'hit');
  if (solid) {
    if (sim.rolling > 0) sim.crashWhileRolling += 1;
    if (sim.wings > 0) sim.wings -= 1;
    if (sim.wings < 2) {
      sim.upgrade = false;
      sim.weaponTier = 0;
    }
  }
  return true;
}

function finish(sim, outcome) {
  sim.phase = outcome;
  sim.result = {
    outcome,
    score: sim.score,
    designated: sim.designatedKills,
    kills: sim.kills,
    allySaved: sim.allySaved,
  };
  pushFx(sim, outcome === 'won' ? 'win' : 'die');
}

function restore(sim) {
  const cp = sim.checkpoint;
  const keep = new Set();
  for (const id of sim.done) {
    const ev = findEvent(sim.level, id);
    if (ev && ev.at < cp) keep.add(id);
  }
  sim.done = keep;
  sim.live = [];
  sim.boss = null;
  sim.shots = [];
  sim.incoming = [];
  sim.s = cp;
  sim.prevS = cp;
  sim.x = 0;
  sim.y = 0;
  sim.speed = sim.level.cruise;
  sim.meter = 1;
  sim.shields = sim.level.maxShields;
  sim.invuln = 0.9;
  sim.rolling = 0;
  sim.cool = 0;
  pushFx(sim, 'die');
}

function spawnInto(sim, ev) {
  if (ev.kind === 'checkpoint' || ev.kind === 'ally') return;
  if (ev.kind === 'boss') {
    if (sim.boss || sim.done.has(ev.id)) return;
    if (sim.s < ev.at - 36) return;
    const pattern = ev.pattern || 'ahead';
    sim.boss = {
      id: ev.id,
      name: ev.name || ev.id,
      kind: 'boss',
      hp: ev.hp,
      maxHp: ev.hp,
      points: ev.points,
      designated: true,
      lead: ev.lead ?? sim.level.bossLead,
      dead: false,
      arm: 0.6,
      clock: 0,
      open: false,
      pattern,
      coreX: ev.coreX ?? 0,
      coreY: ev.coreY ?? 0,
      coreR: ev.coreR ?? 0.85,
      tipY: ev.tipY ?? 1.65,
      openFor: ev.openFor ?? 0.7,
      closedFor: ev.closedFor ?? 1.05,
      x: 0,
      y: 0.3,
      s: sim.s + (ev.lead ?? sim.level.bossLead),
      at: ev.at,
      nodes: pattern === 'sequence' ? [
        { id: 'left', x: -2.2, y: 0, hp: 2, maxHp: 2, open: true, dead: false },
        { id: 'right', x: 2.2, y: 0, hp: 2, maxHp: 2, open: false, dead: false },
        { id: 'heart', x: 0, y: 0.2, hp: 4, maxHp: 4, open: false, dead: false },
      ] : null,
    };
    return;
  }
  if (sim.done.has(ev.id) || sim.live.some((e) => e.id === ev.id)) return;
  if (sim.s < ev.at - sim.level.spawnAhead) return;
  if (sim.s > ev.at + sim.level.dropBehind) {
    sim.done.add(ev.id);
    return;
  }
  const common = { id: ev.id, kind: ev.kind, at: ev.at, x: ev.x ?? 0, y: ev.y ?? 0, s: ev.at };
  if (ev.kind === 'enemy') {
    sim.live.push({
      ...common,
      hp: ev.hp,
      maxHp: ev.hp,
      designated: !!ev.designated,
      points: ev.points ?? 0,
      shotEvery: ev.shotEvery ?? 0,
      allyThreat: !!ev.allyThreat,
      branch: !!ev.branch,
      escortMark: !!ev.escortMark,
      arm: 0.55,
      dead: false,
    });
  } else if (ev.kind === 'solid' || ev.kind === 'flare') {
    sim.live.push({
      ...common,
      hw: ev.w / 2,
      hh: ev.h / 2,
      damage: ev.damage,
      hit: false,
    });
  } else if (ev.kind === 'bomb' || ev.kind === 'upgrade' || ev.kind === 'lance' || ev.kind === 'mend') {
    sim.live.push({ ...common, taken: false, amount: ev.amount ?? 3 });
  }
}

function updateAlly(sim) {
  if (sim.allySaved) {
    sim.allyCall = null;
    return;
  }
  const ally = sim.level.events.find((e) => e.kind === 'ally');
  if (!ally) return;
  // Passing the hawk marks it done. Only a kill (killEnemy) sets allySaved.
  const threatGone = sim.done.has(ally.threat);
  if (!threatGone && sim.s >= ally.at - 48 && sim.s <= ally.at + 64) {
    if (!sim.allyCall) pushFx(sim, 'radio');
    sim.allyCall = { id: ally.id, threat: ally.threat, text: 'QUILL: CUT THE HAWK' };
  } else {
    sim.allyCall = null;
  }
}

function firePrimary(sim) {
  const level = sim.level;
  const tier = sim.wings >= 2 ? sim.weaponTier : 0;
  let offsets = [0];
  let damage = 1;
  if (tier === 1) offsets = [-level.twinGap, level.twinGap];
  if (tier >= 2) {
    offsets = [-level.twinGap, 0, level.twinGap];
    damage = 2;
  }
  sim.lastVolley = offsets.length;
  for (const offset of offsets) {
    const s = sim.s + 1.8;
    sim.shots.push({ x: sim.x + offset, y: sim.y, s, prevS: s, damage, player: true });
  }
  pushFx(sim, 'zap');
}

function fireEnemy(sim, e) {
  const s = e.s - 0.8;
  sim.incoming.push({ x: e.x, y: e.y, s, prevS: s, damage: 1 });
}

function fireBoss(sim) {
  const boss = sim.boss;
  // Weak-point bosses keep their shot lanes off the point the player has to hold.
  let lanes = [-2.15, 0, 2.15];
  if (boss.pattern === 'sequence' || boss.pattern === 'core') lanes = [-4.2, 4.2];
  else if (boss.pattern === 'tip') lanes = [-2.4, 2.4];
  for (const x of lanes) {
    const s = boss.s - 1.2;
    sim.incoming.push({ x, y: boss.y, s, prevS: s, damage: 1 });
  }
}

function bossVulnerable(boss, x, y) {
  const pattern = boss.pattern || 'ahead';
  if (pattern === 'ahead') return Math.abs(x) < 5.3 && Math.abs(y - boss.y) < 3;
  if (pattern === 'core') return Math.hypot(x - boss.coreX, y - boss.coreY) <= boss.coreR;
  if (pattern === 'window') return !!boss.open && Math.abs(x) < 5.3 && Math.abs(y - boss.y) < 3;
  if (pattern === 'tip') return y >= boss.tipY && Math.abs(x) < 5.3;
  return false;
}

function hurtBoss(sim, x, y, amount) {
  const boss = sim.boss;
  if (!boss || boss.dead || amount <= 0) return false;
  if (boss.pattern === 'sequence') {
    const node = boss.nodes?.find((n) => n.open && !n.dead);
    if (!node || Math.hypot(x - node.x, y - node.y) > HIT_R) return false;
    node.hp -= amount;
    if (node.hp <= 0) {
      node.hp = 0;
      node.dead = true;
      node.open = false;
      const order = ['left', 'right', 'heart'];
      const next = boss.nodes.find((n) => n.id === order[order.indexOf(node.id) + 1]);
      if (next) next.open = true;
      if (node.id === 'heart') defeatBoss(sim);
    }
    return true;
  }
  if (!bossVulnerable(boss, x, y)) return false;
  boss.hp -= amount;
  if (boss.hp <= 0) defeatBoss(sim);
  return true;
}

function tickEscort(sim, dt) {
  if (!sim.allySaved || sim.s >= sim.escortUntil) return;
  sim.escortArm -= dt;
  if (sim.escortArm > 0) return;
  const target = sim.live.find((e) => e.kind === 'enemy' && !e.dead && e.escortMark)
    || sim.live.find((e) => e.kind === 'enemy' && !e.dead && e.s > sim.s - 2);
  if (!target) return;
  sim.escortArm = 0.28;
  const s = target.s - 1.2;
  sim.shots.push({ x: target.x, y: target.y, s, prevS: s, damage: 1, player: true, ally: true });
  sim.escortShots += 1;
}

function resolveStage(sim) {
  if (!sim.boss?.dead || sim.phase !== 'play') return;
  const spec = sim.level.next;
  const next = typeof spec === 'function' ? spec(sim) : spec;
  if (next && STAGES[next]) loadStage(sim, next, true);
  else finish(sim, 'won');
}

function step(sim, dt, input) {
  const bombEdge = !!input.bomb && !sim._prev.bomb;
  const rollEdge = !!input.roll && !sim._prev.roll;
  const pauseEdge = !!input.pause && !sim._prev.pause;
  sim._prev.bomb = !!input.bomb;
  sim._prev.roll = !!input.roll;
  sim._prev.pause = !!input.pause;
  if (pauseEdge && sim.phase === 'play') sim.paused = !sim.paused;
  if (sim.paused || sim.phase !== 'play') return;

  const level = sim.level;
  sim.t += dt;
  sim.prevS = sim.s;
  if (sim.rolling > 0) sim.rolling = Math.max(0, sim.rolling - dt);
  if (sim.rollWait > 0) sim.rollWait = Math.max(0, sim.rollWait - dt);
  if (sim.invuln > 0) sim.invuln = Math.max(0, sim.invuln - dt);
  if (sim.cool > 0) sim.cool = Math.max(0, sim.cool - dt);

  const wantBoost = !!input.boost && !input.brake;
  const wantBrake = !!input.brake && !input.boost;
  if (!wantBoost && !wantBrake) sim.meterLock = false;
  else if (sim.meter <= 0) sim.meterLock = true;
  const allow = !sim.meterLock && sim.meter > 0;
  sim.boosting = wantBoost && allow;
  sim.braking = wantBrake && allow;
  if (sim.boosting || sim.braking) sim.meter = Math.max(0, sim.meter - level.meterDrain * dt);
  else if (!wantBoost && !wantBrake) sim.meter = Math.min(1, sim.meter + level.meterRegen * dt);
  const target = sim.boosting ? level.cruise * level.boostMul : sim.braking ? level.cruise * level.brakeMul : level.cruise;
  const stepA = level.accel * dt;
  sim.speed += clamp(target - sim.speed, -stepA, stepA);
  if (sim.speed < level.cruise * level.brakeMul) sim.speed = level.cruise * level.brakeMul;
  sim.s += sim.speed * dt;

  const steerX = clamp(input.steerX ?? 0, -1, 1);
  const steerY = clamp(input.steerY ?? 0, -1, 1);
  sim.x += steerX * level.steer * dt;
  sim.y += steerY * level.steer * dt;
  sim.edgeX = 0;
  sim.edgeY = 0;
  sim.atEdge = false;
  if (sim.x > level.laneX) {
    sim.x = level.laneX;
    sim.edgeX = 1;
    sim.atEdge = true;
  } else if (sim.x < -level.laneX) {
    sim.x = -level.laneX;
    sim.edgeX = -1;
    sim.atEdge = true;
  }
  if (sim.y > level.laneY) {
    sim.y = level.laneY;
    sim.edgeY = 1;
    sim.atEdge = true;
  } else if (sim.y < -level.laneY) {
    sim.y = -level.laneY;
    sim.edgeY = -1;
    sim.atEdge = true;
  }
  sim.aim.x = sim.x;
  sim.aim.y = sim.y;

  if (rollEdge && sim.rolling <= 0 && sim.rollWait <= 0) {
    sim.rolling = level.rollTime;
    sim.rollWait = level.rollTime + level.rollCooldown;
    pushFx(sim, 'roll');
  }
  if (input.fire && sim.cool <= 0) {
    sim.cool = level.shotCooldown;
    firePrimary(sim);
  }
  if (bombEdge && sim.bombs > 0) {
    sim.bombs -= 1;
    pushFx(sim, 'boom');
    for (const e of sim.live) {
      if (e.kind === 'enemy' && !e.dead && bombReach(sim, e)) killEnemy(sim, e);
    }
    if (sim.boss && !sim.boss.dead && bombReach(sim, sim.boss)) hurtBoss(sim, sim.x, sim.y, 8);
    sim.incoming = sim.incoming.filter((shot) => hypot(sim.x - shot.x, sim.y - shot.y, (sim.s - shot.s) * 0.5) > level.bombRadius);
  }

  for (const ev of level.events) spawnInto(sim, ev);

  for (const e of sim.live) {
    if (e.kind !== 'enemy' || e.dead) continue;
    if (sim.s > e.s + level.dropBehind) {
      e.dead = true;
      sim.done.add(e.id);
      continue;
    }
    if (e.shotEvery > 0 && sim.s < e.s) {
      e.arm -= dt;
      if (e.arm <= 0) {
        e.arm = e.shotEvery;
        fireEnemy(sim, e);
      }
    }
  }

  if (sim.boss && !sim.boss.dead) {
    sim.boss.s = sim.s + sim.boss.lead;
    if (sim.boss.pattern === 'window') {
      sim.boss.clock += dt;
      const period = sim.boss.closedFor + sim.boss.openFor;
      sim.boss.open = period > 0 && sim.boss.clock % period >= sim.boss.closedFor;
    }
    sim.boss.arm -= dt;
    if (sim.boss.arm <= 0) {
      sim.boss.arm = 0.82;
      fireBoss(sim);
    }
  }

  tickEscort(sim, dt);

  for (const shot of sim.shots) {
    shot.prevS = shot.s;
    shot.s += level.shotSpeed * dt;
  }
  for (const shot of sim.incoming) {
    shot.prevS = shot.s;
    shot.s -= level.enemyShotSpeed * dt;
  }

  for (const shot of sim.shots) {
    if (shot.spent) continue;
    for (const e of sim.live) {
      if (e.kind !== 'enemy' || e.dead) continue;
      if (!spans(shot.prevS, shot.s, e.s, SHOT_PAD)) continue;
      if (hypot(shot.x - e.x, shot.y - e.y) > HIT_R) continue;
      shot.spent = true;
      e.hp -= shot.damage;
      if (e.hp <= 0) killEnemy(sim, e);
      break;
    }
    if (shot.spent || !sim.boss || sim.boss.dead) continue;
    if (spans(shot.prevS, shot.s, sim.boss.s, 2.4) && hurtBoss(sim, shot.x, shot.y, shot.damage)) shot.spent = true;
  }
  sim.shots = sim.shots.filter((shot) => !shot.spent && shot.s < sim.s + 140);

  const kept = [];
  for (const shot of sim.incoming) {
    const close = spans(shot.prevS, shot.s, sim.s, 1.05) && hypot(shot.x - sim.x, shot.y - sim.y) <= HIT_R;
    if (!close) {
      if (shot.s > sim.s - 30) kept.push(shot);
      continue;
    }
    if (sim.rolling > 0) {
      sim.deflected += 1;
      pushFx(sim, 'roll');
      continue;
    }
    damageCraft(sim, shot.damage);
  }
  sim.incoming = kept;

  for (const e of sim.live) {
    if ((e.kind === 'solid' || e.kind === 'flare') && !e.hit && spans(sim.prevS, sim.s, e.at, 1.25)) {
      if (Math.abs(sim.x - e.x) <= e.hw + SOLID_PAD_X && Math.abs(sim.y - e.y) <= e.hh + SOLID_PAD_Y) {
        e.hit = true;
        sim.done.add(e.id);
        if (e.kind === 'flare') {
          if (damageCraft(sim, e.damage)) sim.hazardHits += 1;
        } else {
          damageCraft(sim, e.damage, { solid: true });
        }
      }
    } else if ((e.kind === 'bomb' || e.kind === 'upgrade' || e.kind === 'lance' || e.kind === 'mend') && !e.taken && spans(sim.prevS, sim.s, e.at, 1.5)) {
      if (hypot(sim.x - e.x, sim.y - e.y) <= PICK_R) {
        e.taken = true;
        sim.done.add(e.id);
        pushFx(sim, 'pick');
        if (e.kind === 'bomb') sim.bombs = Math.min(level.maxBombs, sim.bombs + 1);
        else if (e.kind === 'mend') sim.shields = Math.min(level.maxShields, sim.shields + (e.amount ?? 3));
        else if (sim.wings === 2 && e.kind === 'lance') {
          sim.upgrade = true;
          sim.weaponTier = 2;
        } else if (sim.wings === 2 && e.kind === 'upgrade') {
          sim.upgrade = true;
          sim.weaponTier = Math.max(sim.weaponTier, 1);
        }
      }
    }
  }
  sim.live = sim.live.filter((e) => {
    if (e.kind === 'enemy') return !e.dead;
    if (e.kind === 'solid' || e.kind === 'flare') return !e.hit && sim.s < e.at + level.dropBehind;
    return !e.taken && sim.s < e.at + level.dropBehind;
  });

  for (const ev of level.events) {
    if (ev.kind === 'checkpoint' && sim.checkpoint == null && sim.s >= ev.at) sim.checkpoint = ev.at;
  }
  updateAlly(sim);

  if (sim.shields <= 0) {
    sim.shields = 0;
    sim.deaths += 1;
    if (sim.checkpoint != null) restore(sim);
    else finish(sim, 'lost');
    return;
  }
  resolveStage(sim);
}

function defeatBoss(sim) {
  if (!sim.boss || sim.boss.dead) return;
  sim.boss.hp = 0;
  sim.boss.dead = true;
  sim.done.add(sim.boss.id);
  sim.kills += 1;
  sim.designatedKills += 1;
  sim.score += sim.boss.points;
  pushFx(sim, 'boom', sim.boss);
}
