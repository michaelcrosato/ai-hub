import { SYSTEM, SHIP, DIFFICULTY } from './content.js';
import { clamp, rng, route, cargoUsed } from './core.js';
const TAU = Math.PI * 2;
const angleDiff = (a, b) => ((((a - b + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const segmentDistance = (a, b, p) => {
  const dx = b.x - a.x,
    dz = b.z - a.z,
    l = dx * dx + dz * dz;
  const t = l ? clamp(((p.x - a.x) * dx + (p.z - a.z) * dz) / l, 0, 1) : 0;
  return Math.hypot(a.x + t * dx - p.x, a.z + t * dz - p.z);
};
export const PORT = { x: 0, z: -24 };
export const SCAN = { x: 24, z: -13 };
/** How close the ship must be to the beacon (or the relay) to scan it. */
export const SCAN_RANGE = 13;
/** The simulation is independent of DOM and renderer; movement is integrated by Physics (Rapier). */
export class Simulation {
  constructor(model, physics, hooks = {}) {
    this.model = model;
    this.physics = physics;
    this.hooks = hooks;
    this.entities = new Map();
    this.shots = [];
    this.effects = [];
    this.target = null;
    this.paused = true;
    this.time = 0;
    this.uid = 0;
    this.cooldown = 0;
    this.missileCooldown = 0;
    this.autopilot = null;
    this.jump = null;
    this.route = [];
    this.scanProgress = 0;
    this.scanInRange = false;
    this.destroyed = false;
    this.alertCooldown = 0;
    this.lastHit = -10;
    this.pendingBoss = null;
    this.settings = { aimAssist: true, flightAssist: true, reducedMotion: false, difficulty: 'standard' };
    this._p = { x: 0, z: 0, angle: 0 };
    this._q = { x: 0, z: 0, angle: 0 };
    this._snap = { entities: [], shots: null, effects: null, player: { x: 0, z: 0, angle: 0 }, time: 0, jump: null, scanProgress: 0, target: null };
  }
  get s() {
    return this.model.s;
  }
  get st() {
    return this.model.st;
  }
  get player() {
    return this.physics.position('player');
  }
  get difficulty() {
    return DIFFICULTY[this.settings.difficulty] || DIFFICULTY.standard;
  }
  emit(name, ...args) {
    this.hooks[name]?.(...args);
  }
  tell(t, type = 'info') {
    this.model.tell(t, type);
  }
  addActor(id, type, options = {}) {
    const e = { id, type, age: 0, hp: 100, maxHp: 100, team: 'neutral', radius: 1.8, angle: 0, cooldown: 1, thrust: 0, ...options };
    const spec = {
      x: e.x || 0,
      z: e.z || 0,
      radius: e.radius,
      mass: e.mass || 18,
      sensor: type !== 'asteroid',
      damping: type === 'asteroid' ? 0.1 : 0,
      vx: e.vx || 0,
      vz: e.vz || 0,
      angle: e.angle,
    };
    let body = this.physics.add(id, spec);
    // Decorative debris never crowds out a ship, a mission target or an ore pickup.
    if (!body && type !== 'debris') {
      this.freeDebris();
      body = this.physics.add(id, spec);
    }
    if (!body) return null;
    this.entities.set(id, e);
    return e;
  }
  freeDebris() {
    for (const e of this.entities.values()) if (e.type === 'debris') this.remove(e.id);
  }
  remove(id) {
    this.entities.delete(id);
    this.physics.remove(id);
    if (this.target === id) this.target = null;
  }
  loadSystem({ launch = false, restore = false } = {}) {
    this.physics.clear();
    this.entities.clear();
    this.shots.length = 0;
    this.effects.length = 0;
    this.target = null;
    this.autopilot = null;
    this.jump = null;
    this.scanProgress = 0;
    this.scanComplete = false;
    this.scanInRange = false;
    this.destroyed = false;
    this.cooldown = 0;
    this.pendingBoss = null;
    const st = this.st;
    const saved = restore ? this.s.position : null;
    this.addActor('player', 'player', {
      x: saved?.x ?? 5,
      z: saved?.z ?? 11,
      angle: saved?.angle ?? 0,
      ship: this.s.ship,
      team: 'player',
      mass: st.mass,
      radius: st.scale * 1.5,
    });
    const r = rng(this.s.system),
      sy = SYSTEM[this.s.system];
    // Persistent gameplay density is identical on all quality tiers. Only decorative debris scales.
    for (let i = 0; i < 18; i++) {
      const a = r() * TAU,
        rad = 24 + r() * 57,
        x = Math.cos(a) * rad,
        z = Math.sin(a) * rad;
      if (dist({ x, z }, PORT) < 13) continue;
      this.addActor(`rock-${i}`, 'asteroid', {
        x,
        z,
        radius: 1.4 + r() * 2.1,
        hp: 45,
        maxHp: 45,
        mass: 30 + r() * 60,
        angle: r() * TAU,
        ore: i % 4 === 0 ? 'gems' : 'heavy',
        spin: (r() - 0.5) * 0.15,
        variant: i % 3,
      });
    }
    for (let i = 0; i < 2; i++)
      this.addActor(`trader-${i}`, 'ship', {
        ship: i ? 'barge' : 'shuttle',
        x: -30 + i * 58,
        z: 10 + i * 14,
        team: 'neutral',
        hp: 170,
        maxHp: 170,
        radius: 2.3,
        angle: i ? 2.2 : -0.6,
        waypoint: { x: i ? -55 : 55, z: i ? -10 : 5 },
        label: i ? 'Southern freighter' : 'Independent shuttle',
      });
    for (let i = 0; i < this.s.escorts.length; i++) {
      const ship = this.s.escorts[i],
        base = SHIP[ship.ship];
      this.addActor(ship.id, 'ship', {
        ship: ship.ship,
        x: 5 + (i % 2 ? 1 : -1) * (7 + Math.floor(i / 2) * 5),
        z: 20 + Math.floor(i / 2) * 5,
        team: 'ally',
        hp: ship.hull,
        maxHp: base.hull,
        damage: 10 + base.guns * 6,
        radius: base.scale * 1.6,
        fleet: true,
        label: base.name,
      });
    }
    const q = this.model.quest,
      active = this.s.activeStory && q?.to === this.s.system;
    let missionCount = active ? Math.max(0, (q.enemies || 0) - this.s.storyProgress) : 0;
    if (active && q.kind === 'scan') {
      this.addActor('courier', 'ship', {
        ship: 'blackbird',
        x: SCAN.x,
        z: SCAN.z,
        team: 'neutral',
        hp: 220,
        maxHp: 220,
        radius: 2,
        label: 'Syndicate courier · SCAN',
      });
    }
    if (active && q.kind === 'escort' && !this.s.convoyLost) {
      this.addActor('convoy', 'ship', {
        ship: 'mule',
        x: 2,
        z: 22,
        team: 'ally',
        hp: 450,
        maxHp: 450,
        damage: 9,
        radius: 2.5,
        convoy: true,
        label: 'Relief convoy',
      });
    }
    if (active && ['battle', 'finale'].includes(q.kind)) {
      for (let i = 0; i < 2; i++)
        this.addActor(`allied-${i}`, 'ship', {
          ship: 'firebird',
          x: i ? -9 : 17,
          z: 16,
          team: 'ally',
          hp: 410,
          maxHp: 410,
          damage: 19,
          radius: 2.2,
          label: 'Joint task force',
        });
    }
    for (let i = 0; i < missionCount; i++)
      this.spawnEnemy(i, {
        mission: ['escort', 'battle', 'finale'].includes(q.kind),
        pug: q.kind === 'battle' || q.kind === 'finale',
        label: q.kind === 'finale' ? 'Pug relay defender' : q.kind === 'battle' ? 'Pug blockade ship' : 'Pirate interceptor',
      });
    let spawned = missionCount;
    for (const j of this.s.jobs.filter((j) => j.to === this.s.system && j.kind === 'bounty'))
      for (let i = j.progress; i < j.enemies; i++) this.spawnEnemy(spawned++, { jobId: j.id, label: 'Bounty target' });
    // Side-expedition hunts: raiders first, then (for the Corsair) the flagship once its escorts fall.
    let hunting = false;
    for (const h of this.s.side.filter((x) => x.kind === 'hunt' && x.to === this.s.system && x.progress < x.enemies)) {
      hunting = true;
      const raiders = h.boss ? h.enemies - 1 : h.enemies;
      for (let i = h.progress; i < raiders; i++) this.spawnEnemy(spawned++, { huntId: h.id, label: h.boss ? 'Corsair escort' : 'Farpoint raider' });
      if (h.boss) this.pendingBoss = h.id;
    }
    if (!active && !hunting && sy.danger > 0 && this.s.story > 0 && sy.id !== 'epsilon')
      for (let i = 0; i < Math.min(2, sy.danger); i++)
        this.spawnEnemy(i, { far: true, label: sy.faction === 'Pirate' ? 'Fringe raider' : 'Opportunist pirate' });
    this.paused = this.s.docked && !launch;
    this.emit('system', sy);
    this.emit('refresh');
  }
  spawnEnemy(i, opts) {
    const a = (i / 4) * TAU - 0.8,
      rad = opts.far ? 57 : 30,
      hp = Math.round((opts.pug ? 230 : 110) * this.difficulty.enemyHp);
    return this.addActor(`enemy-${++this.uid}`, 'ship', {
      ship: opts.pug ? 'bastion' : 'sparrow',
      x: Math.cos(a) * rad,
      z: -20 + Math.sin(a) * rad,
      team: 'hostile',
      hp,
      maxHp: hp,
      damage: opts.pug ? 14 : 10,
      radius: opts.pug ? 2.6 : 1.7,
      angle: Math.PI,
      cooldown: 1 + i * 0.3,
      ...opts,
    });
  }
  /** The Corsair's flagship drops out of hyperspace ahead of the player. */
  spawnBoss(huntId) {
    const p = this.player,
      a = Math.atan2(p.x, -p.z) + 0.6,
      hp = Math.round(950 * this.difficulty.enemyHp);
    const boss = this.addActor(`boss-${++this.uid}`, 'ship', {
      ship: 'bastion',
      boss: true,
      team: 'hostile',
      x: clamp(p.x - Math.sin(a) * 38, -150, 150),
      z: clamp(p.z + Math.cos(a) * 38, -150, 150),
      hp,
      maxHp: hp,
      damage: 15,
      radius: 3.6,
      angle: a,
      cooldown: 2.2,
      volley: 3.5,
      huntId,
      label: 'The Corsair · flagship',
      salvage: 6500,
      prize: 'bastion',
    });
    if (!boss) return;
    this.effects.push({ id: `fx-${++this.uid}`, x: boss.x, z: boss.z, age: 0, life: 0.9, color: 'orange', type: 'burst' });
    this.tell('Hyperspace flash: the Corsair’s flagship is on the scanner. Disable it!', 'warn');
    this.target = boss.id;
    this.emit('boss', boss);
    this.emit('refresh');
  }
  launch() {
    this.s.docked = false;
    this.model.nextDay();
    this.s.position = { x: 5, z: 10, angle: 0 };
    this.loadSystem({ launch: true });
    this.paused = false;
    this.model.save();
    this.emit('launch');
    this.tell('Departure cleared. Safe travels, Captain.');
  }
  setRoute(id) {
    const r = this.hooks.route?.(id);
    if (r === null) return;
    this.route = r || [];
    this.emit('refresh');
    return this.route;
  }
  startJump() {
    if (this.s.docked || this.destroyed) return;
    if (this.route.length) {
      // The plotted course may be stale (a rescue tow or a detour since): re-plot it from here.
      const fresh = route(this.s.system, this.route.at(-1), this.s);
      this.route = fresh || [];
      if (!fresh) this.tell('The plotted course is no longer reachable. Plot a new one on the star chart.', 'warn');
    }
    if (!this.route.length) {
      this.emit('map');
      return;
    }
    if (this.s.fuel < 1) {
      this.tell('Insufficient jump fuel. Land for free refueling, or press H to hail a rescue ship.', 'warn');
      return;
    }
    this.autopilot = 'jump';
    this.jump = { to: this.route[0], time: 0 };
    this.tell(`Preparing jump to ${SYSTEM[this.route[0]].name}.`);
    this.emit('sound', 'jump');
  }
  land() {
    if (this.s.docked || this.destroyed) return;
    if (this.s.system === 'epsilon' && this.s.activeStory && !this.model.storyReady())
      return this.tell('Relay landing denied. Defeat the defenders and scan the relay first.', 'warn');
    this.autopilot = 'land';
    this.jump = null;
    this.tell('Landing approach engaged. Movement keys cancel autopilot.');
  }
  board() {
    const p = this.player;
    let best = null,
      bestD = Infinity;
    for (const e of this.entities.values()) {
      if (!e.disabled) continue;
      const d = dist(p, this.physics.position(e.id, 1, this._q));
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    if (!best) return this.tell('No disabled ships to board. Deplete an enemy’s shields and hull first.');
    this.target = best.id;
    this.autopilot = 'board';
    this.jump = null;
    this.tell('Boarding approach engaged.');
  }
  hail() {
    if (this.s.docked) return this.emit('port', 'spaceport');
    if (this.s.fuel >= this.st.fuel) return this.tell('Nearby captain: “Your tanks look full. Fly safe!”');
    const charge = Math.min(200, this.s.credits);
    this.s.credits -= charge;
    this.s.fuel = Math.min(this.st.fuel, this.s.fuel + 2);
    this.tell(`A passing merchant transfers two fuel units. ${charge} credits.`, 'reward');
    this.emit('sound', 'reward');
  }
  /** The closest active ship of a team (a linear scan; runs every frame for missiles and allies). */
  nearest(team = 'hostile', from = this.player) {
    let best = null,
      bestD = Infinity;
    for (const e of this.entities.values()) {
      if (e.team !== team || e.disabled) continue;
      const d = dist(from, this.physics.position(e.id, 1, this._q));
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }
  cycleTarget() {
    const all = [...this.entities.values()].filter((e) => e.team === 'hostile' || e.disabled);
    if (!all.length) {
      this.target = null;
      return;
    }
    const i = all.findIndex((e) => e.id === this.target);
    this.target = all[(i + 1) % all.length].id;
    this.emit('sound', 'ui');
  }
  steer(id, target, speed, dt, turn = 3) {
    const p = this.physics.position(id, 1, this._q),
      e = this.entities.get(id);
    if (!e) return;
    const dx = target.x - p.x,
      dz = target.z - p.z,
      d = Math.hypot(dx, dz),
      v = this.physics.velocity(id);
    const desired = clamp(d * 1.6, 0, speed);
    let vx = d > 0 ? (dx / d) * desired : 0,
      vz = d > 0 ? (dz / d) * desired : 0;
    this.physics.setVelocity(id, v.x + (vx - v.x) * Math.min(1, dt * 2.4), v.z + (vz - v.z) * Math.min(1, dt * 2.4));
    const aim = Math.atan2(dx, -dz);
    e.angle += clamp(angleDiff(aim, e.angle), -turn * dt, turn * dt);
    this.physics.setAngle(id, e.angle);
    e.thrust = desired > 0.5 ? 1 : 0;
  }
  fire(e, missile = false, spread = 0) {
    if (e.disabled) return;
    const p = this.physics.position(e.id),
      v = this.physics.velocity(e.id),
      isPlayer = e.id === 'player',
      st = this.st;
    if (isPlayer) {
      if (this.s.heat >= 96 || this.s.energy < st.energyPerShot) return;
      if (missile && (!st.launcher || !this.s.ammo || this.missileCooldown > 0)) return;
      if (!missile && this.cooldown > 0) return;
      if (missile) {
        this.s.ammo--;
        this.missileCooldown = 0.8;
        this.s.heat += 7;
      } else {
        this.cooldown = 0.19;
        this.s.energy -= st.energyPerShot;
        this.s.heat += st.heatPerShot;
      }
    }
    if (this.shots.length >= 100) return;
    let angle = e.angle + spread;
    if (isPlayer && this.settings.aimAssist) {
      const enemy = this.entities.get(this.target) || this.nearest();
      if (enemy && !enemy.disabled && enemy.team === 'hostile') {
        const ep = this.physics.position(enemy.id),
          ev = this.physics.velocity(enemy.id),
          lead = dist(p, ep) / 80;
        const a = Math.atan2(ep.x + ev.x * lead - p.x, -(ep.z + ev.z * lead - p.z));
        if (Math.abs(angleDiff(a, angle)) < 0.22) angle = a;
      }
    }
    const speed = missile ? 40 : 82,
      dx = Math.sin(angle),
      dz = -Math.cos(angle),
      radius = missile ? 0.45 : 0.2;
    this.shots.push({
      id: ++this.uid,
      x: p.x + dx * (e.boss ? 4.2 : 2.6),
      z: p.z + dz * (e.boss ? 4.2 : 2.6),
      px: p.x,
      pz: p.z,
      vx: dx * speed + v.x * 0.6,
      vz: dz * speed + v.z * 0.6,
      angle,
      life: missile ? 4 : 1.0,
      team: isPlayer ? 'player' : e.team,
      owner: e.id,
      damage: missile ? 95 : isPlayer ? st.damage : e.damage || 10,
      missile,
      radius,
      hit: false,
    });
    if (isPlayer) {
      this.emit('sound', missile ? 'missile' : 'laser');
      if (missile) this.emit('rumble', 0.35, 90);
    }
  }
  burst(p, color = 'orange', count = 8) {
    this.effects.push({ id: `fx-${++this.uid}`, x: p.x, z: p.z, age: 0, life: 0.65, color, type: 'burst' });
    const actual = Math.min(count, this.physics.limit - this.physics.bodies.size - 4);
    for (let i = 0; i < actual; i++) {
      const a = (i / count) * TAU + this.time,
        n = 3 + (i % 4) * 2;
      this.addActor(`debris-${++this.uid}`, 'debris', {
        x: p.x,
        z: p.z,
        vx: Math.cos(a) * n,
        vz: Math.sin(a) * n,
        radius: 0.22,
        mass: 0.3,
        hp: 1,
        life: 0.8 + (i % 3) * 0.2,
        color,
        angle: a,
      });
    }
    this.emit('sound', 'hit');
  }
  damage(e, amount) {
    if (e.id === 'player') {
      amount *= this.difficulty.incoming;
      const absorbed = Math.min(this.s.shield, amount);
      this.s.shield -= absorbed;
      this.s.hull -= amount - absorbed;
      this.lastHit = this.time;
      this.emit('hit', amount, absorbed < amount);
      if (this.s.hull <= 0) {
        this.s.hull = 0;
        this.destroyed = true;
        this.autopilot = null;
        this.jump = null;
        this.burst(this.player, 'orange', 18);
        this.emit('destroyed');
      }
      return;
    }
    e.hp -= amount;
    if (e.type === 'asteroid' && e.hp <= 0) {
      const p = this.physics.position(e.id);
      this.burst(p, 'amber', 6);
      this.remove(e.id);
      this.addActor(`ore-${++this.uid}`, 'pickup', {
        x: p.x,
        z: p.z,
        radius: 0.65,
        mass: 0.4,
        ore: e.ore,
        amount: e.ore === 'gems' ? 1 : 3,
        life: 180,
        team: 'neutral',
      });
      return;
    }
    if (e.team === 'hostile' && !e.disabled && e.hp <= e.maxHp * 0.22) {
      e.disabled = true;
      e.hp = Math.max(1, e.hp);
      this.physics.setVelocity(e.id, 0, 0);
      this.model.kill(e.mission, e.jobId, e.huntId);
      this.burst(this.physics.position(e.id), 'cyan', e.boss ? 12 : 5);
      if (e.boss) {
        this.tell('The Corsair’s flagship is dead in space. Press B to board it, then land at Farpoint.', 'reward');
        this.emit('rumble', 0.9, 420);
      } else this.tell('Target disabled. Press B to board, salvage, or capture.');
      this.emit('refresh');
    } else if (e.hp <= 0) {
      this.burst(this.physics.position(e.id), 'orange', 10);
      if (e.fleet) {
        this.s.escorts = this.s.escorts.filter((s) => s.id !== e.id);
        this.tell(`${e.label} has been lost.`, 'warn');
      }
      if (e.convoy) {
        this.s.storyProgress = 0;
        this.tell('The relief convoy was lost. Return to Dschubba to reassemble it.', 'warn');
        this.s.convoyLost = true;
      }
      this.remove(e.id);
    }
  }
  resolveBoard(mode) {
    const e = this.entities.get(this.target);
    if (!e?.disabled) return 'The target is no longer available.';
    if (dist(this.player, this.physics.position(e.id)) > 9) return 'Move closer to the disabled ship.';
    const error =
      mode === 'capture' ? this.model.capture(e.prize || (e.ship === 'bastion' ? 'firebird' : 'sparrow')) : (this.model.salvage(e.salvage), null);
    if (error) return error;
    const position = this.physics.position(e.id);
    this.remove(e.id);
    if (mode === 'capture') {
      const escort = this.s.escorts.at(-1),
        base = SHIP[escort.ship];
      this.addActor(escort.id, 'ship', {
        ...position,
        ship: escort.ship,
        team: 'ally',
        hp: escort.hull,
        maxHp: base.hull,
        damage: 10 + base.guns * 6,
        radius: base.scale * 1.6,
        fleet: true,
        label: base.name,
      });
    }
    this.model.save();
    this.emit('refresh');
    return null;
  }
  update(dt, input = {}) {
    if (this.paused || this.s.docked || this.destroyed) return;
    this.physics.begin();
    this.time += dt;
    this.s.playTime += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.missileCooldown = Math.max(0, this.missileCooldown - dt);
    const st = this.st,
      player = this.entities.get('player'),
      p = this.physics.position('player', 1, this._p);
    this.alertCooldown -= dt;
    this.s.heat = Math.max(0, this.s.heat - st.cooling * dt);
    this.s.energy = Math.min(st.energy, this.s.energy + st.regen * dt);
    if (this.time - this.lastHit > 4) this.s.shield = Math.min(st.shield, this.s.shield + (5 + (this.s.outfits.shield || 0) * 2) * dt);
    if (st.scoop) this.s.fuel = Math.min(st.fuel, this.s.fuel + dt / 27);
    const moving = input.thrust || input.brake || input.turn || input.stick || input.aim || input.face;
    if (moving && this.autopilot) {
      this.autopilot = null;
      this.jump = null;
    }
    if (this.pendingBoss) {
      const h = this.s.side.find((x) => x.id === this.pendingBoss);
      if (!h || h.progress >= h.enemies) this.pendingBoss = null;
      else if (h.progress >= h.enemies - 1) {
        this.pendingBoss = null;
        this.spawnBoss(h.id);
      }
    }
    if (this.autopilot === 'land') {
      this.steer('player', PORT, st.speed, dt, st.turn);
      const v = this.physics.velocity('player');
      if (dist(p, PORT) < 3.8 && Math.hypot(v.x, v.z) < 5) {
        if (this.s.convoyLost && this.model.quest?.kind === 'escort' && this.s.system === 'alniyat') this.s.storyProgress = 0;
        this.autopilot = null;
        const debrief = this.model.land();
        this.paused = true;
        this.emit('land', debrief);
        return;
      }
    } else if (this.autopilot === 'board') {
      const e = this.entities.get(this.target);
      if (!e?.disabled) this.autopilot = null;
      else {
        const t = this.physics.position(e.id);
        this.steer('player', t, st.speed, dt, st.turn);
        const v = this.physics.velocity('player');
        if (dist(p, t) < 7 && Math.hypot(v.x, v.z) < 6) {
          this.physics.setVelocity('player', 0, 0);
          this.autopilot = null;
          this.emit('board', e);
        }
      }
    } else if (this.autopilot === 'jump' && this.jump) {
      const v = this.physics.velocity('player');
      this.physics.setVelocity('player', v.x * Math.exp(-5 * dt), v.z * Math.exp(-5 * dt));
      player.thrust = 0;
      if (Math.hypot(v.x, v.z) < 3) this.jump.time += dt;
      if (this.jump.time >= 2.1) {
        const to = this.jump.to;
        this.s.fuel = Math.max(0, this.s.fuel - 1);
        this.model.arrive(to);
        this.route.shift();
        this.loadSystem({ launch: true });
        this.emit('jump');
        this.tell(`Arrived in ${SYSTEM[to].name}.`);
        this.model.save();
        return;
      }
    } else {
      player.thrust = 0;
      let thrust = input.thrust ? 1 : 0;
      const turnRate = st.turn * dt;
      if (input.aim) {
        const a = Math.atan2(input.aim.x - p.x, -(input.aim.z - p.z));
        player.angle += clamp(angleDiff(a, player.angle), -turnRate, turnRate);
      } else if (input.stick) {
        // Absolute steering (touch stick, controller left stick): face the stick, thrust by how far it is pushed.
        const a = Math.atan2(input.stick.x, -input.stick.z);
        player.angle += clamp(angleDiff(a, player.angle), -turnRate, turnRate);
        const push = clamp(Math.hypot(input.stick.x, input.stick.z), 0, 1);
        // Turn on the spot first when the stick points well behind the ship.
        thrust = Math.max(thrust, Math.abs(angleDiff(a, player.angle)) > 2.2 ? 0 : push);
      } else if (input.face) {
        // Controller right stick: point the nose without thrusting (like holding the right mouse button).
        const a = Math.atan2(input.face.x, -input.face.z);
        player.angle += clamp(angleDiff(a, player.angle), -turnRate, turnRate);
      } else if (input.assistAim && this.settings.aimAssist) {
        const n = this.entities.get(this.target);
        const t = n && n.team === 'hostile' && !n.disabled ? n : this.nearest();
        if (t) {
          const tp = this.physics.position(t.id, 1, this._q);
          const a = Math.atan2(tp.x - p.x, -(tp.z - p.z));
          player.angle += clamp(angleDiff(a, player.angle), -turnRate, turnRate);
        } else player.angle += (input.turn || 0) * turnRate;
      } else player.angle += (input.turn || 0) * turnRate;
      this.physics.setAngle('player', player.angle);
      const boost = !!input.boost && !!st.boost && this.s.energy > 10 && this.s.heat < 85;
      if (thrust) {
        const strength = st.thrust * (boost ? 1.8 : 1) * thrust;
        this.physics.impulse('player', Math.sin(player.angle) * strength * st.mass * dt, -Math.cos(player.angle) * strength * st.mass * dt);
        player.thrust = boost ? 2 : thrust;
        if (boost) {
          this.s.energy = Math.max(0, this.s.energy - dt * 25);
          this.s.heat += dt * 16;
        }
      }
      const v = this.physics.velocity('player'),
        speed = Math.hypot(v.x, v.z),
        max = st.speed * (boost ? 1.55 : 1);
      let damping = input.brake ? Math.exp(-4 * dt) : this.settings.flightAssist && !thrust ? Math.exp(-0.28 * dt) : 1;
      if (speed > max) damping = Math.min(damping, max / speed);
      this.physics.setVelocity('player', v.x * damping, v.z * damping);
    }
    if (input.fire) this.fire(player);
    if (input.missile) this.fire(player, true);
    // Finite-size systems are open space: a gentle navigation correction, not invisible damage.
    if (Math.hypot(p.x, p.z) > 220 && !this.autopilot) {
      this.steer('player', { x: 0, z: 0 }, st.speed, dt, st.turn);
      if (this.alertCooldown <= 0) {
        this.tell('Navigation computer: returning to the local traffic lanes.');
        this.alertCooldown = 12;
      }
    }
    const holdRoom = cargoUsed(this.s) < st.cargo;
    for (const e of this.entities.values()) {
      if (e.id === 'player') continue;
      e.age += dt;
      if (e.life && e.age > e.life) {
        this.remove(e.id);
        continue;
      }
      if (e.type === 'debris') {
        e.angle += dt * 2;
        this.physics.setAngle(e.id, e.angle);
        continue;
      }
      if (e.type === 'asteroid') {
        e.angle += e.spin * dt;
        this.physics.setAngle(e.id, e.angle);
        continue;
      }
      const ep = this.physics.position(e.id);
      if (e.type === 'pickup') {
        // A small tractor pull makes collecting ore forgiving at speed (only while the hold has room).
        const d = dist(ep, p);
        if (d < 4 && this.model.pickOre(e.ore, e.amount)) {
          this.remove(e.id);
          this.emit('sound', 'pickup');
        } else if (d > 1 && d < 9 && holdRoom) {
          this.physics.setVelocity(e.id, ((p.x - ep.x) / d) * 6, ((p.z - ep.z) / d) * 6);
          e.pulled = true;
        } else if (e.pulled) {
          this.physics.setVelocity(e.id, 0, 0);
          e.pulled = false;
        }
        continue;
      }
      if (e.disabled) {
        e.thrust = 0;
        continue;
      }
      e.cooldown -= dt;
      if (e.team === 'hostile') {
        // Target whichever of the player and the allied ships is closest.
        let tp = p,
          td = dist(ep, p);
        for (const a of this.entities.values()) {
          if (a.team !== 'ally' || a.disabled) continue;
          const ap = this.physics.position(a.id);
          const d = dist(ep, ap);
          if (d < td) {
            td = d;
            tp = ap;
          }
        }
        if (td < 90) {
          const d = td,
            orbit = 0.4 * Math.sin(this.time * 0.8 + e.age),
            a = Math.atan2(tp.x - ep.x, -(tp.z - ep.z));
          e.angle += clamp(angleDiff(a, e.angle), -(e.boss ? 1.5 : 2.2) * dt, (e.boss ? 1.5 : 2.2) * dt);
          this.physics.setAngle(e.id, e.angle);
          const far = e.boss ? 30 : 23,
            near = e.boss ? 17 : 13,
            direction = d > far ? 1 : d < near ? -1 : 0,
            pace = e.boss ? 9 : 12;
          const vx = Math.sin(a) * direction * pace + Math.cos(a) * orbit * 5,
            vz = -Math.cos(a) * direction * pace + Math.sin(a) * orbit * 5;
          const v = this.physics.velocity(e.id);
          this.physics.setVelocity(e.id, v.x + (vx - v.x) * dt * 2, v.z + (vz - v.z) * dt * 2);
          e.thrust = direction > 0 ? 1 : 0.3;
          const aligned = Math.abs(angleDiff(a, e.angle)) < 0.24;
          if (e.boss) {
            // The flagship fires a three-gun spread, and a pair of homing missiles every few seconds.
            e.volley -= dt;
            if (d < 70 && e.cooldown <= 0 && aligned) {
              for (const s of [-0.13, 0, 0.13]) this.fire(e, false, s);
              e.cooldown = 1.25;
            }
            if (d < 75 && e.volley <= 0) {
              this.fire(e, true, -0.35);
              this.fire(e, true, 0.35);
              e.volley = 5.5;
            }
          } else if (d < 62 && e.cooldown <= 0 && aligned) {
            this.fire(e, e.pug && Math.floor(e.age) % 7 === 0);
            e.cooldown = e.pug ? 0.9 : 1.1;
          }
        }
      } else if (e.team === 'ally') {
        const target = this.nearest('hostile', ep),
          order = this.s.fleetOrder;
        if (target && (!e.fleet || order === 'attack' || (order === 'defend' && dist(ep, p) < 45))) {
          const t = this.physics.position(target.id),
            d = dist(ep, t);
          if (d > 23) this.steer(e.id, t, 22, dt);
          else this.physics.setVelocity(e.id, 0, 0);
          e.angle = Math.atan2(t.x - ep.x, -(t.z - ep.z));
          this.physics.setAngle(e.id, e.angle);
          if (d < 60 && e.cooldown <= 0) {
            this.fire(e);
            e.cooldown = 0.6;
          }
        } else if (order !== 'hold' || !e.fleet) this.steer(e.id, { x: p.x + (e.id.length % 2 ? 7 : -7), z: p.z + 9 }, st.speed, dt);
        else {
          this.physics.setVelocity(e.id, 0, 0);
          e.thrust = 0;
        }
      } else if (e.waypoint) {
        this.steer(e.id, e.waypoint, 9, dt, 1.4);
        if (dist(ep, e.waypoint) < 4) e.waypoint = { x: -e.waypoint.x, z: -e.waypoint.z };
      }
    }
    this.physics.step(dt);
    const pl = this.physics.position('player', 1, this._p);
    for (const shot of this.shots) {
      shot.px = shot.x;
      shot.pz = shot.z;
      shot.life -= dt;
      if (shot.missile) {
        const target = shot.team === 'hostile' ? this.entities.get('player') : this.nearest('hostile', shot);
        if (target) {
          const t = this.physics.position(target.id, 1, this._q),
            a = Math.atan2(t.x - shot.x, -(t.z - shot.z));
          shot.angle += clamp(angleDiff(a, shot.angle), -dt * 2.8, dt * 2.8);
          shot.vx = Math.sin(shot.angle) * 48;
          shot.vz = -Math.cos(shot.angle) * 48;
        }
        if (shot.team === 'hostile' && st.antimissile && dist(shot, pl) < 13) {
          shot.hit = true;
          this.effects.push({ id: `fx-${++this.uid}`, x: shot.x, z: shot.z, age: 0, life: 0.35, color: 'cyan', type: 'burst' });
        }
      }
      shot.x += shot.vx * dt;
      shot.z += shot.vz * dt;
      if (shot.hit) continue;
      const friendly = shot.team === 'player' || shot.team === 'ally';
      for (const e of this.entities.values()) {
        if (e.id === shot.owner || e.type === 'debris' || e.type === 'pickup' || e.disabled) continue;
        const valid = e.type === 'asteroid' || (friendly ? e.team === 'hostile' : e.team === 'ally' || e.id === 'player');
        if (!valid) continue;
        if (segmentDistance({ x: shot.px, z: shot.pz }, shot, this.physics.position(e.id, 1, this._q)) < e.radius + shot.radius) {
          shot.hit = true;
          this.damage(e, shot.damage);
          this.effects.push({ id: `fx-${++this.uid}`, x: shot.x, z: shot.z, age: 0, life: 0.22, color: friendly ? 'cyan' : 'orange', type: 'spark' });
          if (friendly && shot.team === 'player' && e.type !== 'asteroid') this.emit('hitConfirm', e);
          break;
        }
      }
    }
    // Compact in place: no new arrays every step.
    let n = 0;
    for (const s of this.shots) if (s.life > 0 && !s.hit) this.shots[n++] = s;
    this.shots.length = n;
    n = 0;
    for (const fx of this.effects) if ((fx.age += dt) < fx.life) this.effects[n++] = fx;
    this.effects.length = n;
    const q = this.model.quest,
      scanTarget = this.s.activeStory && q?.to === this.s.system && q.kind === 'finale' ? PORT : SCAN;
    const scanPossible = dist(pl, scanTarget) < SCAN_RANGE;
    const finalLocked = q?.kind === 'finale' && this.s.activeStory && q.to === this.s.system && this.s.storyProgress < 4;
    this.scanInRange = scanPossible && !finalLocked;
    if (input.scan && scanPossible && !finalLocked) {
      this.scanProgress = Math.min(1, this.scanProgress + dt / (this.st.scanner ? 1.5 : 2.5));
      if (this.scanProgress >= 1 && !this.scanComplete) {
        this.scanComplete = true;
        if (this.s.activeStory && q?.to === this.s.system && ['scan', 'finale'].includes(q.kind)) {
          this.model.completeScan();
          this.tell(
            q.kind === 'finale'
              ? 'Relay offline. Land to complete your journey.'
              : 'Courier manifest secured. Land to archive the evidence.',
            'reward',
          );
          this.emit('sound', 'reward');
        } else if (this.model.survey()) this.emit('sound', 'reward');
        this.emit('refresh');
      }
    } else {
      if (input.scan && finalLocked && scanPossible && this.alertCooldown <= 0) {
        this.tell(`The relay is shielded while its defenders fly: ${this.s.storyProgress} / 4 disabled.`, 'warn');
        this.alertCooldown = 4;
      }
      this.scanProgress = Math.max(0, this.scanProgress - dt * 0.3);
      if (!input.scan) this.scanComplete = false;
    }
    if (this.s.heat > 86 && this.alertCooldown <= 0) {
      this.tell('Weapons overheating. Release fire to cool, or fit a better cooler.', 'warn');
      this.alertCooldown = 8;
    }
    const pos = this.s.position || (this.s.position = { x: 0, z: 0, angle: 0 });
    pos.x = pl.x;
    pos.z = pl.z;
    pos.angle = player.angle;
    for (const escort of this.s.escorts) {
      const e = this.entities.get(escort.id);
      if (e) escort.hull = Math.max(1, e.hp);
    }
  }
  /**
   * What the view draws this frame. The entity list holds the live entity
   * objects with their interpolated render position written into rx / rz / ra
   * (the simulation's own x/z/angle are left alone), so nothing is copied.
   */
  snapshot(alpha = 1) {
    const snap = this._snap,
      list = snap.entities;
    list.length = 0;
    for (const e of this.entities.values()) {
      const r = this.physics.position(e.id, alpha, this._q);
      e.rx = r.x;
      e.rz = r.z;
      e.ra = r.angle;
      list.push(e);
    }
    this.physics.position('player', alpha, snap.player);
    snap.shots = this.shots;
    snap.effects = this.effects;
    snap.time = this.time;
    snap.jump = this.jump;
    snap.scanProgress = this.scanProgress;
    snap.target = this.target;
    return snap;
  }
}
