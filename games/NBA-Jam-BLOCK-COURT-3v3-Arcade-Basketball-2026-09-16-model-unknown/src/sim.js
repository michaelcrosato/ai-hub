/**
 * Block Court — the deterministic, renderer-independent arcade basketball simulation.
 *
 * Modes (Engine.mode):
 *   arcade    3v3 against the CPU, three minutes, first to 21
 *   league    the Night League: the same match rules against a ladder of rival crews
 *   practice  Shootaround: no defense, no clock, a feeder returns every make
 *   contest   3-Point Contest: five racks of five balls around the arc against the clock
 *
 * Nothing here touches the DOM or three.js, so it runs (and can be checked) under node.
 */

export const COURT = Object.freeze({ halfX: 14, halfZ: 7.5, hoopX: 12.35, rimY: 3.5, three: 6.3 });
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const dir = (team) => (team === 0 ? 1 : -1);
export const hoop = (team) => ({ x: dir(team) * COURT.hoopX, z: 0 });
const names = ['JET', 'DASH', 'BRICK', 'BLAZE', 'NOVA', 'TANK'];
const nums = ['01', '07', '23', '03', '11', '34'];

/**
 * How a CPU crew plays (team 1 only). Multipliers on the balanced baseline:
 * speed, steal attempt rate, steal chance bonus, extra shooting range, patience
 * before shooting, shot precision spread, how tight defenders mark, and whether
 * the ball handler sets up at the arc instead of driving.
 */
export const STYLES = Object.freeze({
  balanced: Object.freeze({ speed: 1, steal: 1, stealChance: 0, range: 0, patience: 1, precision: 1, mark: 1.35, arc: false }),
  lockdown: Object.freeze({ speed: 1.06, steal: 1.7, stealChance: 0.08, range: -0.4, patience: 1.3, precision: 1, mark: 1.05, arc: false }),
  sharp: Object.freeze({ speed: 1.08, steal: 0.75, stealChance: -0.05, range: 1.5, patience: 0.75, precision: 0.72, mark: 1.5, arc: true }),
});
const BASE_STYLE = STYLES.balanced;

/** 3-Point Contest racks around the right-hand arc, from the near corner to the far corner. */
export const RACKS = Object.freeze(
  [
    [12.6, 6.8, 'NEAR CORNER'],
    [8.0, 5.17, 'NEAR WING'],
    [5.55, 0, 'TOP OF THE KEY'],
    [8.0, -5.17, 'FAR WING'],
    [12.6, -6.8, 'FAR CORNER'],
  ].map(([x, z, name]) => Object.freeze({ x, z, name }))
);
/** Seconds on the contest clock per difficulty. */
export const DERBY_TIME = Object.freeze({ rookie: 70, pro: 60, allstar: 52 });

export class Engine {
  constructor(seed = 7654321) {
    this.seed = seed >>> 0;
    this.listeners = [];
    this.state = 'menu';
    this.mode = 'arcade';
    this.difficulty = 'rookie';
    this.demo = false;
    this.elapsed = 0;
    this.input = { x: 0, z: 0, sprint: false };
    this.players = [];
    this.controlled = 0;
    this.events = [];
    this.style = BASE_STYLE;
    this.styleName = 'balanced';
    this.derby = null;
    this.start({ demo: true });
  }
  /** 'match' (arcade and league), 'practice' or 'contest'. */
  get rules() {
    return this.mode === 'practice' ? 'practice' : this.mode === 'contest' ? 'contest' : 'match';
  }
  random() {
    let x = this.seed;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.seed = x >>> 0;
    return this.seed / 4294967296;
  }
  on(fn) {
    this.listeners.push(fn);
    return () => this.listeners.splice(this.listeners.indexOf(fn), 1);
  }
  emit(type, data = {}) {
    const e = { type, ...data };
    this.events.push(e);
    if (this.events.length > 120) this.events.shift();
    for (const fn of this.listeners) fn(e);
  }
  start({ mode = 'arcade', difficulty = 'rookie', demo = false, style = 'balanced' } = {}) {
    this.mode = mode;
    this.difficulty = difficulty;
    this.demo = demo;
    this.state = 'playing';
    this.styleName = STYLES[style] ? style : 'balanced';
    this.style = STYLES[this.styleName];
    const rules = this.rules;
    this.scores = [0, 0];
    this.time = rules === 'contest' ? DERBY_TIME[difficulty] || DERBY_TIME.pro : 180;
    this.shotClock = 24;
    this.elapsed = 0;
    this.suddenDeath = false;
    this.buzzerPending = false;
    this.freeze = 0;
    this.pendingTeam = 0;
    this.hot = [0, 0];
    this.fire = [0, 0];
    this.controlled = demo ? -1 : 0;
    this.possession = 0;
    this.stats = [0, 1].map(() => ({ attempts: 0, made: 0, threes: 0, dunks: 0, steals: 0, blocks: 0, rebounds: 0, assists: 0, money: 0 }));
    this.charging = false;
    this.chargeTime = 0;
    this.charge = 0;
    this.lastPass = null;
    this.players = Array.from({ length: 6 }, (_, id) => ({
      id,
      team: id < 3 ? 0 : 1,
      index: id % 3,
      name: names[id],
      number: nums[id],
      x: 0,
      z: 0,
      vx: 0,
      vz: 0,
      angle: id < 3 ? Math.PI / 2 : -Math.PI / 2,
      stamina: 1,
      cooldown: 0,
      stun: 0,
      protect: 0,
      jump: 0,
      jumpTime: 0,
      jumpDuration: 0.62,
      jumpMax: 0.8,
      action: 'idle',
      actionTime: 0,
      run: 0,
      aiAge: 0,
      aiPlan: this.random(),
      sprinting: false,
      active: rules === 'match' || (rules === 'practice' ? id < 3 : id === 0),
    }));
    this.ball = { mode: 'held', owner: 0, x: 0, y: 1, z: 0, age: 0, vx: 0, vy: 0, vz: 0, lock: 0, shotTeam: 0 };
    this.derby = null;
    this.resetPositions(0, true);
    if (rules === 'contest') this.setupDerby();
    this.emit('start', { mode, demo });
  }
  resetPositions(team, initial = false) {
    const d = dir(team);
    const offense = initial ? [[-5, 1], [-1, -4], [0, 4]] : [[-10.2, 0], [-5.5, -4.4], [-4.1, 4.1]];
    const defense = initial ? [[4, 1], [7, -3.6], [9, 3.2]] : [[0, 0], [3, -3.8], [5.8, 3.8]];
    for (const p of this.players) {
      const spot = p.team === team ? offense[p.index] : defense[p.index];
      p.x = d * spot[0];
      p.z = spot[1];
      p.vx = p.vz = 0;
      p.aiAge = 0;
      p.protect = 0.75;
      p.stun = 0;
      p.jump = 0;
      p.jumpTime = 0;
      p.actionTime = 0;
      p.action = 'idle';
    }
    this.giveBall(team * 3, { silent: true });
    this.shotClock = 24;
    if (team === 0 && !this.demo) this.controlled = 0;
    this.charging = false;
    this.charge = 0;
    this.lastPass = null;
    this.updateHeldBall();
  }
  /** Contest: the shooter starts beside the first rack; the ball waits on the rack. */
  setupDerby() {
    this.derby = { rack: 0, shot: 0, racks: [[], [], [], [], []], taken: [0, 0, 0, 0, 0], done: false };
    const p = this.players[0];
    p.x = RACKS[0].x - 0.6;
    p.z = RACKS[0].z - 0.4;
    p.vx = p.vz = 0;
    this.possession = 0;
    Object.assign(this.ball, { mode: 'rack', owner: -1, age: 0 });
    this.updateBall(0);
  }
  giveBall(id, { silent = false, rebound = false } = {}) {
    const p = this.players[id];
    if (!p || !p.active) return;
    const oldTeam = this.possession;
    const previous = this.players[this.ball.owner];
    if (previous && previous.action === 'charge') previous.action = 'idle';
    this.ball.mode = 'held';
    this.ball.owner = id;
    this.ball.age = 0;
    this.ball.lock = 0;
    this.possession = p.team;
    p.protect = 0.8;
    p.aiAge = 0;
    p.action = 'idle';
    if (oldTeam !== p.team) this.shotClock = 24;
    // An offensive rebound tops the shot clock up to 14; it never takes time away.
    else if (rebound) this.shotClock = Math.max(this.shotClock, 14);
    if (p.team === 0 && !this.demo) this.controlled = id;
    if (rebound) {
      this.stats[p.team].rebounds++;
      this.emit('rebound', { team: p.team, player: id });
    }
    if (!silent) this.emit('possession', { team: p.team, player: id });
    this.charging = false;
    this.charge = 0;
  }
  setInput(x, z, sprint = false) {
    const l = Math.hypot(x, z);
    this.input.x = l > 1 ? x / l : x;
    this.input.z = l > 1 ? z / l : z;
    this.input.sprint = !!sprint;
  }
  startCharge() {
    if (this.state !== 'playing' || this.freeze > 0 || this.demo) return;
    const p = this.players[this.controlled];
    if (!p) return;
    if (this.ball.mode !== 'held' || this.ball.owner !== p.id) {
      // On defense the shoot button jumps to block or swipes, as in the arcade original.
      if (this.rules !== 'contest') this.defend();
      return;
    }
    if (p.stun > 0) return;
    if (this.rules !== 'contest' && dist(p, hoop(0)) < 2.25 && p.stamina > 0.15) {
      this.shoot(p.id, 0.765, true);
      return;
    }
    this.charging = true;
    this.chargeTime = 0;
    this.charge = 0;
    p.action = 'charge';
    this.emit('charge', { player: p.id });
  }
  releaseCharge() {
    if (!this.charging) return;
    const p = this.players[this.controlled];
    if (p && this.ball.mode === 'held' && this.ball.owner === p.id) this.shoot(p.id, this.charge, false);
    this.charging = false;
  }
  cancelCharge() {
    this.charging = false;
    this.charge = 0;
    const p = this.players[this.controlled];
    if (p && p.action === 'charge') p.action = 'idle';
  }
  contest(p) {
    let c = 0;
    for (const q of this.players)
      if (q.team !== p.team && q.active) {
        const dd = dist(p, q);
        if (dd < 2.6) c += Math.max(0, 1 - dd / 2.6) * (q.jump > 0.2 ? 1.3 : 1);
      }
    return clamp(c, 0, 1);
  }
  shoot(id, charge = 0.765, forceDunk = false) {
    const p = this.players[id];
    if (this.ball.mode !== 'held' || this.ball.owner !== id || this.freeze > 0) return false;
    const h = hoop(p.team);
    const d = dist(p, h);
    const dunk = forceDunk && d < 2.8;
    const perfect = Math.abs(charge - 0.765) <= 0.085;
    const quality = clamp(1 - Math.abs(charge - 0.765) / 0.72, 0, 1);
    const contest = this.contest(p);
    let chance = clamp(1.04 - Math.max(0, d - 2.6) * 0.053, 0.14, 0.97) * (0.2 + 0.8 * quality) - contest * 0.26;
    if (this.difficulty === 'rookie' && p.team === 0) chance += 0.11;
    if (this.fire[p.team] > 0) chance += 0.18;
    if (perfect && d < 9 && contest < 0.68) chance = 1;
    if (dunk) chance = 0.99 - contest * 0.08;
    const made = this.random() < clamp(chance, 0.06, 1);
    const three = d > COURT.three && !dunk;
    const missA = this.random() * Math.PI * 2;
    const missR = 0.49 + this.random() * 0.3;
    let duration = dunk ? 0.58 : clamp(0.72 + d * 0.048, 0.85, 1.75);
    if (this.rules === 'contest') duration *= 0.82;
    Object.assign(this.ball, {
      mode: 'shot',
      owner: -1,
      age: 0,
      shotTeam: p.team,
      shooter: id,
      startX: p.x,
      startY: dunk ? 2.15 : 2.12 + p.jump,
      startZ: p.z,
      targetX: h.x + (made ? 0 : Math.cos(missA) * missR),
      targetZ: made ? 0 : Math.sin(missA) * missR,
      duration,
      arc: dunk ? 1.8 : 1.75 + d * 0.07,
      made,
      points: three ? 3 : 2,
      dunk,
      perfect,
      contest,
      charge,
      originX: p.x,
      originZ: p.z,
    });
    this.charging = false;
    this.charge = 0;
    p.action = dunk ? 'dunk' : 'shoot';
    p.actionTime = dunk ? 0.9 : 0.64;
    this.jump(p, dunk ? 1.6 : 0.65, dunk ? 0.88 : 0.7);
    p.angle = Math.atan2(h.x - p.x, -p.z);
    p.cooldown = 0.8;
    if (dunk) p.stamina = Math.max(0.05, p.stamina - 0.15);
    this.stats[p.team].attempts++;
    this.emit('shot', { player: id, team: p.team, perfect, charge, contest, dunk, points: three ? 3 : 2 });
    return true;
  }
  choosePassTarget(p) {
    const move = this.input;
    const l = Math.hypot(move.x, move.z);
    const h = hoop(p.team);
    let best = null;
    let bestScore = -Infinity;
    for (const q of this.players)
      if (q.team === p.team && q.id !== p.id && q.active) {
        const dd = dist(p, q);
        const aim = l > 0.2 ? ((q.x - p.x) * move.x + (q.z - p.z) * move.z) / (dd || 1) : 0;
        const score = aim * 6 + (dist(p, h) - dist(q, h)) * 0.25 + (1 - this.contest(q)) * 2 - dd * 0.04;
        if (score > bestScore) {
          best = q;
          bestScore = score;
        }
      }
    return best;
  }
  pass(targetId = null, ownerId = null) {
    if (this.state !== 'playing' || this.freeze > 0 || this.ball.mode !== 'held') return false;
    const p = this.players[this.ball.owner];
    if (ownerId === null && !this.demo && p.team !== 0) return false;
    // A teammate holding the ball passes to you when you call for it.
    if (ownerId === null && p.id !== this.controlled && p.team === 0) targetId = this.controlled;
    const q = targetId === null ? this.choosePassTarget(p) : this.players[targetId];
    if (!q || q.id === p.id || q.team !== p.team || !q.active) return false;
    this.cancelCharge();
    Object.assign(this.ball, { mode: 'pass', owner: -1, age: 0, startX: p.x, startY: 1.45, startZ: p.z, target: q.id, passer: p.id, duration: 0.2 + dist(p, q) * 0.026 });
    this.lastPass = { from: p.id, to: q.id, time: this.elapsed };
    p.action = 'pass';
    p.actionTime = 0.35;
    p.cooldown = 0.55;
    this.emit('pass', { from: p.id, to: q.id, team: p.team });
    return true;
  }
  switchPlayer() {
    if (this.demo || this.state !== 'playing' || this.rules === 'contest') return;
    this.cancelCharge();
    const mates = this.players.filter((p) => p.team === 0 && p.active && p.id !== this.controlled);
    let target;
    if (this.possession !== 0 || this.ball.mode === 'loose') {
      target = mates.sort((a, b) => dist(a, this.ball) - dist(b, this.ball))[0];
    } else {
      target = mates.find((p) => p.id === (this.controlled + 1) % 3) || mates[0];
    }
    if (target) {
      this.controlled = target.id;
      this.emit('switch', { player: target.id });
    }
  }
  jump(p, height = 0.85, duration = 0.65) {
    p.jumpTime = duration;
    p.jumpDuration = duration;
    p.jumpMax = height;
  }
  defend(id = this.controlled, ai = false) {
    if (this.state !== 'playing' || this.freeze > 0 || this.rules === 'contest') return false;
    const p = this.players[id];
    if (!p || p.cooldown > 0 || p.stun > 0 || !p.active) return false;
    p.cooldown = ai ? 1.5 : 0.72;
    p.action = 'steal';
    p.actionTime = 0.36;
    const b = this.ball;
    if (b.mode === 'held') {
      const q = this.players[b.owner];
      if (q.team === p.team) return false;
      const dd = dist(p, q);
      const base = this.difficulty === 'rookie' ? 0.28 : 0.46;
      const chance = ai ? base + (p.team === 1 ? this.style.stealChance : 0) : 0.82;
      if (dd < 1.8 && q.protect <= 0 && this.random() < chance) {
        q.stun = 0.35;
        this.stats[p.team].steals++;
        this.lastPass = null;
        this.giveBall(p.id);
        this.emit('steal', { player: p.id, team: p.team });
        return true;
      }
    } else if (b.mode === 'shot' && b.shotTeam !== p.team && b.age / b.duration < 0.44 && dist(p, this.players[b.shooter]) < 2.6) {
      this.jump(p, 1.3, 0.65);
      b.mode = 'loose';
      b.lock = 0.25;
      b.vx = dir(p.team) * 4;
      b.vy = 3.5;
      b.vz = (this.random() - 0.5) * 5;
      b.age = 0;
      this.stats[p.team].blocks++;
      this.emit('block', { player: p.id, team: p.team });
      return true;
    } else if (b.mode !== 'held') {
      this.jump(p, 1, 0.65);
    }
    if (!ai) this.emit('reach', { player: p.id });
    return false;
  }
  updateHeldBall() {
    const b = this.ball;
    const p = this.players[b.owner];
    if (!p) return;
    const hand = this.charging && p.id === this.controlled;
    b.x = p.x + Math.sin(p.angle) * 0.42 + Math.cos(p.angle) * 0.29;
    b.z = p.z + Math.cos(p.angle) * 0.42 - Math.sin(p.angle) * 0.29;
    b.y = hand ? 1.7 + this.charge * 0.48 + p.jump : 0.35 + Math.abs(Math.sin(this.elapsed * 10.5)) * 1.04 + p.jump;
  }
  aiTarget(p, dt) {
    const d = dir(p.team);
    const b = this.ball;
    const h = hoop(p.team);
    const ownH = hoop(1 - p.team);
    const have = this.possession === p.team;
    const st = p.team === 1 ? this.style : BASE_STYLE;
    const held = b.mode === 'held';
    const owner = held ? this.players[b.owner] : null;
    if (p.stun > 0) return { x: p.x, z: p.z, speed: 0 };
    if (this.rules !== 'match' && p.team === 1) return { x: p.x, z: p.z, speed: 0 };
    if (held && owner.id === p.id) {
      if (p.team === 0 && !this.demo) {
        if (p.aiAge > 0.3 && this.controlled >= 0) this.pass(this.controlled, p.id);
        return { x: p.x, z: p.z, speed: 0 };
      }
      const distance = dist(p, h);
      const cont = this.contest(p);
      const wait = st.patience;
      if (p.aiAge > 1.05 * wait && p.cooldown <= 0) {
        if (distance < 2.25) {
          this.shoot(p.id, 0.75, true);
          return { x: p.x, z: p.z, speed: 0 };
        }
        const shotRange = (this.difficulty === 'allstar' ? 7.7 : 6.6) + st.range;
        if ((distance < 4.9 && p.aiAge > 1.65 * wait) || (distance < shotRange && cont < 0.5 && p.aiAge > 2.9 * wait) || this.shotClock < 2.2) {
          const precision = (this.difficulty === 'rookie' ? 0.28 : this.difficulty === 'pro' ? 0.19 : 0.12) * st.precision;
          this.shoot(p.id, 0.765 + (this.random() - 0.5) * precision, false);
          return { x: p.x, z: p.z, speed: 0 };
        }
        if (p.aiAge > 2.1 * wait && cont > 0.47 && this.random() < dt * 0.9) {
          const mates = this.players.filter((q) => q.team === p.team && q.id !== p.id && q.active).sort((a, c) => this.contest(a) - this.contest(c));
          if (mates[0] && this.contest(mates[0]) < cont - 0.12) this.pass(mates[0].id, p.id);
        }
      }
      const lane = Math.sin(p.aiPlan * 8 + this.elapsed * 0.5) * 2.1;
      // Sharpshooters set up behind the arc while the shot clock is young; everyone else drives.
      const depth = st.arc && this.shotClock > 9 ? 6.9 : 2.6;
      const speed = (this.difficulty === 'allstar' ? 5.5 : this.difficulty === 'pro' ? 5.05 : 4.6) * st.speed;
      return { x: h.x - d * depth, z: depth > 3 ? lane * 1.6 : lane, speed };
    }
    if (b.mode === 'loose' || (b.mode === 'shot' && b.age / b.duration > 0.55)) {
      const tx = b.mode === 'shot' ? b.targetX : b.x;
      const tz = b.mode === 'shot' ? b.targetZ : b.z;
      return { x: tx - d * (p.index * 0.32), z: tz + (p.index - 1) * 0.8, speed: 5.25 * st.speed };
    }
    if (have) {
      const ox = owner ? owner.x : b.x;
      const progress = clamp(ox * d + 3.8 + p.index * 0.8, -5, 10.2);
      let z = p.index === 1 ? -4.6 : p.index === 2 ? 4.6 : 0;
      z += Math.sin(this.elapsed * 0.65 + p.id * 2) * 0.55;
      return { x: d * progress, z, speed: 5.1 * st.speed };
    }
    const opponents = this.players.filter((q) => q.team !== p.team && q.active);
    let mark = opponents[p.index] || opponents[0];
    if (owner && mark) {
      const defenders = this.players.filter((q) => q.team === p.team && q.active).sort((a, c) => dist(a, owner) - dist(c, owner));
      if (defenders[0].id === p.id) {
        mark = owner;
        const rate = (this.difficulty === 'rookie' ? 0.4 : 0.9) * st.steal;
        if (dist(p, owner) < 1.65 && p.cooldown <= 0 && owner.protect <= 0 && this.random() < dt * rate) this.defend(p.id, true);
      } else if (mark.id === owner.id) mark = opponents.find((q) => q.id !== owner.id && q.index !== defenders[0].index) || mark;
    }
    if (!mark) return { x: p.x, z: p.z, speed: 0 };
    const dx = ownH.x - mark.x;
    const dz = -mark.z;
    const len = Math.hypot(dx, dz) || 1;
    return { x: mark.x + (dx / len) * st.mark, z: mark.z + (dz / len) * st.mark, speed: (this.difficulty === 'rookie' ? 4.15 : 4.85) * st.speed };
  }
  update(dt) {
    if (this.state !== 'playing') return;
    dt = clamp(dt, 0, 0.05);
    this.elapsed += dt;
    const rules = this.rules;
    for (let t = 0; t < 2; t++) this.fire[t] = Math.max(0, this.fire[t] - dt);
    if (this.freeze > 0) {
      this.freeze -= dt;
      this.animatePlayers(dt);
      this.updateBall(dt);
      if (this.freeze <= 0 && this.state === 'playing') {
        if (rules === 'match' && (this.scores[0] >= 21 || this.scores[1] >= 21 || this.suddenDeath || this.time <= 0) && this.scores[0] !== this.scores[1]) {
          this.end();
          return;
        }
        if (rules === 'practice') this.feedShooter();
        else {
          this.resetPositions(this.pendingTeam);
          this.emit('inbound', { team: this.pendingTeam });
        }
      }
      return;
    }
    if (rules === 'match') {
      if (!this.suddenDeath) this.time = Math.max(0, this.time - dt);
      if (this.ball.mode === 'held' || this.ball.mode === 'pass') this.shotClock = Math.max(0, this.shotClock - dt);
      if (this.time <= 0 && !this.suddenDeath) {
        if (this.ball.mode === 'shot') this.buzzerPending = true;
        else {
          this.resolveBuzzer();
          if (this.state !== 'playing') return;
        }
      }
      if (this.shotClock <= 0 && (this.ball.mode === 'held' || this.ball.mode === 'pass')) {
        const to = 1 - this.possession;
        this.cancelCharge();
        this.lastPass = null;
        this.resetPositions(to);
        this.emit('violation', { team: to });
        return;
      }
    } else if (rules === 'contest' && this.derby && !this.derby.done) {
      this.time = Math.max(0, this.time - dt);
      // A ball released before the horn still counts; anything else ends the round.
      if (this.time <= 0 && this.ball.mode !== 'shot') {
        this.finishDerby();
        return;
      }
    }
    if (this.charging) {
      this.chargeTime += dt;
      this.charge = clamp(this.chargeTime / 0.95, 0, 1);
      if (this.chargeTime > 1.24) this.releaseCharge();
    }
    for (const p of this.players) {
      if (!p.active) continue;
      p.aiAge += dt;
      let mx = 0;
      let mz = 0;
      let speed = 0;
      if (p.id === this.controlled && !this.demo) {
        if (rules === 'contest') {
          // The shooter runs to the next rack by itself and plants there.
          const s = RACKS[Math.min(4, this.derby.rack)];
          const dx = s.x - p.x;
          const dz = s.z - p.z;
          const l = Math.hypot(dx, dz);
          speed = l < 0.16 ? 0 : 8.6 * clamp(l / 0.6, 0, 1);
          if (l > 0.06) {
            mx = dx / l;
            mz = dz / l;
          }
          p.sprinting = l > 1;
          p.stamina = 1;
        } else {
          mx = this.input.x;
          mz = this.input.z;
          p.sprinting = this.input.sprint && p.stamina > 0.035 && Math.hypot(mx, mz) > 0.1;
          speed = p.sprinting ? 8.1 : 5.7;
          if (this.charging) speed *= 0.28;
          p.stamina = clamp(p.stamina + (p.sprinting && this.fire[p.team] <= 0 ? -0.24 : 0.19) * dt, 0, 1);
        }
      } else {
        const t = this.aiTarget(p, dt);
        const dx = t.x - p.x;
        const dz = t.z - p.z;
        const l = Math.hypot(dx, dz);
        speed = t.speed * clamp(l / 0.6, 0, 1);
        if (l > 0.06) {
          mx = dx / l;
          mz = dz / l;
        }
        p.stamina = clamp(p.stamina + 0.15 * dt, 0, 1);
        p.sprinting = false;
      }
      if (p.stun > 0 || p.action === 'dunk') speed = 0;
      const smoothing = 1 - Math.exp(-dt * 14);
      p.vx += (mx * speed - p.vx) * smoothing;
      p.vz += (mz * speed - p.vz) * smoothing;
      p.x = clamp(p.x + p.vx * dt, -13.5, 13.5);
      p.z = clamp(p.z + p.vz * dt, -7, 7);
      if (Math.hypot(p.vx, p.vz) > 0.22 && p.action !== 'shoot') {
        const angle = Math.atan2(p.vx, p.vz);
        const delta = Math.atan2(Math.sin(angle - p.angle), Math.cos(angle - p.angle));
        p.angle += delta * Math.min(1, dt * 14);
      }
    }
    // Soft contacts let players set screens without trapping a ball carrier.
    for (let i = 0; i < 6; i++)
      for (let j = i + 1; j < 6; j++) {
        const a = this.players[i];
        const b = this.players[j];
        if (!a.active || !b.active) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const dd = Math.hypot(dx, dz);
        if (dd < 0.78 && dd > 0.001) {
          const push = (0.78 - dd) * 0.42;
          const nx = dx / dd;
          const nz = dz / dd;
          a.x = clamp(a.x - nx * push, -13.5, 13.5);
          a.z = clamp(a.z - nz * push, -7, 7);
          b.x = clamp(b.x + nx * push, -13.5, 13.5);
          b.z = clamp(b.z + nz * push, -7, 7);
        }
      }
    if (rules === 'contest') this.updateDerby();
    this.animatePlayers(dt);
    this.updateBall(dt);
  }
  /** Contest: the planted shooter picks up the next ball from the rack. */
  updateDerby() {
    const d = this.derby;
    if (!d || d.done || this.ball.mode !== 'rack' || d.rack > 4) return;
    const p = this.players[0];
    const s = RACKS[d.rack];
    if (Math.hypot(s.x - p.x, s.z - p.z) > 0.2) return;
    d.taken[d.rack] = d.shot + 1;
    this.giveBall(0, { silent: true });
    const h = hoop(0);
    p.angle = Math.atan2(h.x - p.x, -p.z);
    p.vx = p.vz = 0;
    this.updateHeldBall();
    this.emit('rackBall', { rack: d.rack, shot: d.shot, money: d.shot === 4 });
  }
  animatePlayers(dt) {
    for (const p of this.players) {
      p.cooldown = Math.max(0, p.cooldown - dt);
      p.protect = Math.max(0, p.protect - dt);
      p.stun = Math.max(0, p.stun - dt);
      p.actionTime = Math.max(0, p.actionTime - dt);
      if (p.actionTime === 0 && p.action !== 'charge') p.action = 'idle';
      if (p.jumpTime > 0) {
        p.jumpTime = Math.max(0, p.jumpTime - dt);
        p.jump = Math.sin((1 - p.jumpTime / p.jumpDuration) * Math.PI) * p.jumpMax;
      } else p.jump = 0;
      p.run += Math.hypot(p.vx, p.vz) * dt * 2.7;
    }
  }
  updateBall(dt) {
    const b = this.ball;
    b.age += dt;
    if (b.mode === 'held') {
      this.updateHeldBall();
      return;
    }
    if (b.mode === 'rack') {
      const r = RACKS[Math.min(4, this.derby ? this.derby.rack : 0)];
      b.x = r.x;
      b.z = r.z;
      b.y = 0.6;
      return;
    }
    if (b.mode === 'pass') {
      const q = this.players[b.target];
      const t = clamp(b.age / b.duration, 0, 1);
      b.x = b.startX + (q.x - b.startX) * t;
      b.z = b.startZ + (q.z - b.startZ) * t;
      b.y = 1.45 + Math.sin(t * Math.PI) * 0.6;
      if (t > 0.2 && t < 0.86) {
        for (const p of this.players)
          if (p.active && p.team !== q.team && dist(p, b) < 0.49 && p.protect <= 0) {
            this.stats[p.team].steals++;
            this.lastPass = null;
            this.giveBall(p.id);
            this.emit('steal', { player: p.id, team: p.team });
            return;
          }
      }
      if (t >= 1) {
        this.giveBall(q.id);
        this.emit('catch', { player: q.id });
      }
      return;
    }
    if (b.mode === 'shot') {
      const t = clamp(b.age / b.duration, 0, 1);
      b.x = b.startX + (b.targetX - b.startX) * t;
      b.z = b.startZ + (b.targetZ - b.startZ) * t;
      b.y = b.startY + (COURT.rimY - b.startY) * t + 4 * b.arc * t * (1 - t);
      if (b.dunk) {
        const p = this.players[b.shooter];
        p.x = b.originX + (b.targetX - dir(p.team) * 0.6 - b.originX) * Math.min(t * 1.45, 1);
        p.z = b.originZ * (1 - t);
      }
      if (t >= 1) {
        if (this.rules === 'contest') this.derbyShot(b.made);
        else if (b.made) this.scoreBasket();
        else {
          const team = b.shotTeam;
          this.hot[team] = 0;
          b.mode = 'loose';
          b.lock = 0.42;
          b.age = 0;
          b.vx = -dir(team) * (2.1 + this.random() * 3.4);
          b.vz = (this.random() - 0.5) * 7;
          b.vy = 2.1 + this.random() * 1.6;
          this.emit('miss', { team, player: b.shooter });
          if (this.buzzerPending) this.resolveBuzzer();
        }
      }
      return;
    }
    if (b.mode === 'score') {
      b.y = Math.max(0.27, b.y - dt * 6.5);
      b.x += b.vx * dt;
      b.z += b.vz * dt;
      return;
    }
    if (b.mode === 'loose') {
      b.lock = Math.max(0, b.lock - dt);
      b.vy -= 13 * dt;
      b.x += b.vx * dt;
      b.z += b.vz * dt;
      b.y += b.vy * dt;
      if (b.y < 0.27) {
        b.y = 0.27;
        b.vy = Math.abs(b.vy) * 0.58;
        b.vx *= 0.8;
        b.vz *= 0.8;
        this.emit('bounce', { volume: Math.min(1, b.vy / 4) });
      }
      if (Math.abs(b.x) > 13.65) {
        b.x = clamp(b.x, -13.65, 13.65);
        b.vx *= -0.7;
      }
      if (Math.abs(b.z) > 7.12) {
        b.z = clamp(b.z, -7.12, 7.12);
        b.vz *= -0.7;
      }
      if (b.lock <= 0) {
        const possible = this.players.filter((p) => p.active && dist(p, b) < 1.0 && b.y < 1.75 + p.jump).sort((a, c) => dist(a, b) - dist(c, b));
        if (possible[0]) this.giveBall(possible[0].id, { rebound: true });
      }
      // Safety recovery: a loose ball never leaves the match without a way back.
      if (b.mode === 'loose' && b.age > 8) {
        const q = this.players.filter((p) => p.active).sort((a, c) => dist(a, b) - dist(c, b))[0];
        this.giveBall(q.id, { rebound: true });
      }
    }
  }
  scoreBasket() {
    const b = this.ball;
    const t = b.shotTeam;
    this.scores[t] += b.points;
    this.stats[t].made++;
    if (b.points === 3) this.stats[t].threes++;
    if (b.dunk) this.stats[t].dunks++;
    if (this.lastPass && this.lastPass.to === b.shooter && this.elapsed - this.lastPass.time < 5) this.stats[t].assists++;
    this.hot[t]++;
    if (this.hot[t] >= 3) {
      this.fire[t] = 15;
      this.hot[t] = 0;
      this.emit('fire', { team: t });
    }
    // A made buzzer-beater settles the buzzer here; leaving it pending re-ran sudden death on a later miss.
    this.buzzerPending = false;
    b.mode = 'score';
    b.y = COURT.rimY;
    b.vx = dir(t) * 0.3;
    b.vz = 0;
    b.age = 0;
    this.freeze = b.dunk ? 1.18 : 0.92;
    this.pendingTeam = this.rules === 'practice' ? 0 : 1 - t;
    this.emit('score', { team: t, player: b.shooter, points: b.points, dunk: b.dunk, perfect: b.perfect, scores: [...this.scores] });
  }
  /** Shootaround: after a make the feeder under the rim passes the ball back to the shooter's spot. */
  feedShooter() {
    const s = this.players[this.ball.shooter];
    if (!s || !s.active || s.team !== 0) {
      this.resetPositions(0);
      return;
    }
    const h = hoop(0);
    this.cancelCharge();
    Object.assign(this.ball, { mode: 'pass', owner: -1, age: 0, startX: h.x - 0.5, startY: 1.45, startZ: 0, target: s.id, passer: -1, duration: 0.25 + dist(h, s) * 0.03 });
    this.emit('feed', { player: s.id });
  }
  /** Contest: score one ball, then the next ball comes off the rack (or the round ends). */
  derbyShot(made) {
    const d = this.derby;
    const b = this.ball;
    const money = d.shot === 4;
    const points = made ? (money ? 2 : 1) : 0;
    d.racks[d.rack].push(points);
    this.scores[0] += points;
    if (made) {
      this.stats[0].made++;
      this.stats[0].threes++;
      if (money) this.stats[0].money++;
    }
    this.emit('derbyShot', { made, money, points, rack: d.rack, shot: d.shot, x: b.x, y: b.y, z: b.z, perfect: b.perfect, total: this.scores[0] });
    d.shot++;
    if (d.shot >= 5) {
      const rackPoints = d.racks[d.rack].reduce((a, v) => a + v, 0);
      d.shot = 0;
      d.rack++;
      if (d.rack < 5) this.emit('rackDone', { rack: d.rack - 1, points: rackPoints });
    }
    Object.assign(b, { mode: 'rack', owner: -1, age: 0 });
    if (d.rack >= 5 || this.time <= 0) this.finishDerby();
  }
  finishDerby() {
    if (!this.derby || this.derby.done) return;
    this.derby.done = true;
    this.end();
  }
  resolveBuzzer() {
    this.buzzerPending = false;
    if (this.scores[0] === this.scores[1]) {
      this.suddenDeath = true;
      this.shotClock = Math.max(this.shotClock, 14);
      this.emit('overtime');
    } else this.end();
  }
  end() {
    if (this.demo) {
      this.start({ demo: true, difficulty: this.difficulty, style: this.styleName });
      return;
    }
    this.state = 'over';
    this.cancelCharge();
    const derby = this.derby ? { racks: this.derby.racks.map((r) => [...r]), score: this.scores[0] } : null;
    this.emit('end', { mode: this.mode, winner: this.scores[0] > this.scores[1] ? 0 : 1, scores: [...this.scores], stats: this.stats, derby });
  }
  pause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.cancelCharge();
      this.setInput(0, 0, false);
      this.emit('pause');
    }
  }
  resume() {
    if (this.state === 'paused') {
      this.state = 'playing';
      this.emit('resume');
    }
  }
  resetPractice() {
    if (this.rules === 'practice' && this.state === 'playing') {
      this.freeze = 0;
      this.resetPositions(0, true);
      this.emit('inbound', { team: 0 });
    }
  }
}
