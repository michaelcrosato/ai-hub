/*
 * T2 / Cyberdyne: the balcony standoff. Game rules carried over from the
 * Strata cartridge (Cyberdyne.js), plus the M79 tear-gas launcher and the
 * helicopter searchlights.
 */
import { add, sub, mul, norm, dot, compose, mm, bounds, rayBox, cameraDirection, point, distance, clamp, damp, angleWrap } from './math.js';
import { defaultMotor, Motor } from './motor.js';
import { glowTexture, textTexture, person, minigun, buildSet, helicopter, box, rod, rad, makeVehicle, makeOfficer, searchlight } from './models.js';
import { VEHICLES, OFFICERS, DIFFICULTIES, wavePlan } from './waves.js';

const defaults = [[-11, -14, 16], [-4, -17, -12], [4, -14, 25], [12, -19, -28], [-11, -26, -24], [-4, -29, 18], [4, -25, -15], [12, -31, 23]];
export function sceneData() {
  const entities = [
    { id: 'office', name: 'Cyberdyne building and street', prefab: 'set', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], color: '#416278', components: [{ type: 'set' }] },
    { id: 't800', name: 'T-800 / start position', prefab: 'spawn', position: [0, 8, -0.2], rotation: [0, 0, 0], scale: [1, 1, 1], color: '#1f2933', components: [{ type: 'spawn' }] },
  ];
  defaults.forEach(([x, z, a], i) => {
    entities.push({ id: 'car-' + i, name: 'Patrol car ' + String(i + 1).padStart(2, '0'), prefab: 'policecar', position: [x, 0.08, z], rotation: [0, a + 180, 0], scale: [1, 1, 1], color: '#d6d9d8', components: [{ type: 'vehicle', health: 100 }] });
    for (let j = 0; j < 2; j++) entities.push({ id: `officer-${i}-${j}`, name: `Officer ${i * 2 + j + 1}`, prefab: 'officer', position: [x + (j ? 2.8 : -2.6), 0.08, z + (j ? 1.8 : 2.0)], rotation: [0, 180, 0], scale: [1, 1, 1], color: '#21334d', components: [{ type: 'human', vehicle: 'car-' + i }] });
  });
  // crouchSpeed was left at the 2.6 default, so crouch-walking outran walking (2.4); now it is slower.
  return { version: 1, name: 'Cyberdyne / No casualties', objective: 'Disable the patrol cars. Let the officers withdraw.', seed: 1991, environment: { sky: '#0b1a2c', fog: 0.009, sun: 0.5 }, player: { ...defaultMotor, walkSpeed: 2.4, sprintSpeed: 3.8, crouchSpeed: 1.6, jumpSpeed: 4.0, headBob: 0, fov: 70 }, entities };
}
const sizeFor = { policecar: [2.4, 2, 5.1], officer: [0.8, 2.3, 0.8], spawn: [1.2, 2.3, 1.2], set: [62, 27, 30], block: [1, 1, 1] };
const finite = (v, n = 1e4) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= n;

/** M79 tear-gas launcher: non-lethal, drives officers out of an area. */
export const GAS = Object.freeze({ start: 3, max: 5, perWave: 2, cooldown: 1.1, speed: 24, lift: 2.5, gravity: 11, fuse: 4, life: 9, radius: 6.5 });
const LIGHT_FIRE = [1.6, 0.45, 0.1], LIGHT_RED = [2.2, 0.11, 0.18], LIGHT_BLUE = [0.08, 0.65, 2.4], LIGHT_OFF = [0, 0, 0];
const LAMP = [0, -0.83, -1.3];
const onBalcony = (p) => Math.abs(p[0]) < 15.3 && p[2] > -1.9 && p[2] < 12.2;

export class Cyberdyne {
  /**
   * ctx: { scene, audio, ctl, notify(text), emit(type, data), key(action), difficulty, reducedMotion, effectCap() }
   */
  constructor(ctx) {
    this.ctx = ctx;
  }

  mount(local = null) {
    const ctx = this.ctx;
    this.scene = ctx.scene;
    this.document = sceneData();
    this.diff = DIFFICULTIES[ctx.difficulty] || DIFFICULTIES.terminator;
    this.playing = true;
    this.rngState = (this.document.seed || 1991) >>> 0;
    this.rng = () => {
      this.rngState = (Math.imul(1664525, this.rngState) + 1013904223) >>> 0;
      return this.rngState / 4294967296;
    };
    Object.assign(this, {
      time: 0, spin: 0, heat: 0, overheated: false, fireClock: 0, shots: 0, hits: 0, ammo: 1600,
      beltTimer: 0, integrity: 100, hurt: 0, hit: 0, completed: false, winDelay: 0,
      scan: false, scanBoot: 0, demo: false, firing: false, flash: 0, recoil: 0, heldSafe: false,
      started: false, message: '', messageTime: 0, phase: 'scene', wave: 0, wavesCleared: 0,
      intermission: 0, sceneComplete: false, failed: false, score: 0, totalVehicles: 0, totalSafe: 0,
      unitSerial: 0, rosterVersion: 0, focusTime: 0, focusID: null, lockID: null, warning: '',
      focus: null, inCover: false, criticalHits: 0, target: null, demoTarget: null,
      gasRounds: GAS.start, gasCooldown: 0, gassed: 0, lit: false, stepId: 0, eyeH: 1.91,
    });
    this.effects = []; this.cars = []; this.officers = []; this.entities = new Map(); this.audioNodes = [];
    this.blockers = []; this.identified = new Set(); this.currentPlan = null; this.projectiles = []; this.clouds = [];
    this.siren = null; this.motorSound = null;
    this.scene.environment = { sky: this.document.environment.sky, fog: this.document.environment.fog, sun: 0.5, night: true, vision: false };
    this.scene.pointLights = Array.from({ length: 10 }, () => ({ position: [0, 0, 0], color: [0, 0, 0], radius: 1 }));
    this.glow = glowTexture(this.scene);
    this.policeTexture = textTexture(this.scene, 'POLICE', '#193148', '#d9e0dc');
    for (const d of this.document.entities) {
      if (d.prefab === 'policecar') this.spawnVehicle(d, 'cruiser', { hp: d.components.find((c) => c.type === 'vehicle')?.health || 100 });
      else if (d.prefab === 'officer') this.spawnOfficer(d, 'patrol');
      else {
        let model;
        if (d.prefab === 'set') model = buildSet(this.scene, this.glow);
        else if (d.prefab === 'spawn') model = person(this.scene, true);
        else { const root = this.scene.group(); box(this.scene, root, [0, 0, 0], [1, 1, 1], d.color); model = { root }; }
        this.setTransform(model.root, d);
        this.entities.set(d.id, { data: d, root: model.root, model, position: model.root.position });
        if (d.prefab === 'spawn') {
          // The T-800's own body is never on screen in first person.
          this.hero = model;
          model.root.visible = false;
          for (const m of model.root.children) this.scene.remove(m);
          this.player = { position: [...d.position], yaw: d.rotation[1] * rad, pitch: -0.35, phase: 0, vy: 0, motor: new Motor(this.document.player) };
        } else {
          this.addBlockers(model.root);
          // The street set never changes: its instances are written once.
          if (d.prefab === 'set') this.scene.freeze([...model.root.children, ...model.labels]);
        }
      }
    }
    // Cover on the balcony. These boxes also stop the aim ray and return fire.
    this.cover = this.scene.group();
    for (const x of [-8, 8]) box(this.scene, this.cover, [x, 8.65, 1.8], [2.6, 1.3, 0.65], '#536a7b');
    this.addBlockers(this.cover);
    this.scene.freeze(this.cover.children);
    this.gun = minigun(this.scene, this.glow);
    const g = this.gun.root;
    this.gun.arms.push(
      rod(this.scene, g, [-0.32, -0.37, 0.32], [-0.03, 0.43, 0.06], 0.23, '#1b2630'),
      box(this.scene, g, [0, 0.47, 0.04], [0.2, 0.15, 0.22], '#b98a6d'),
      rod(this.scene, g, [0.33, -0.56, 0.3], [0.07, -0.25, 0.33], 0.25, '#1e2933'),
      box(this.scene, g, [0.06, -0.22, 0.3], [0.2, 0.22, 0.2], '#b98a6d')
    );
    for (const m of g.children) { m.viewmodel = true; m.castShadow = false; }
    this.heli = helicopter(this.scene);
    this.heli.root.position = [-26, 26, -42];
    this.heliBeam = searchlight(this.scene, this.glow);
    this.camera = { position: [0, 10, 0], target: [0, 1, -25], fov: this.document.player.fov };
    this.fovTarget = this.document.player.fov;
    this.scene.camera = this.camera;
    if (local) this.restoreLocal(local);
    this.setCamera();
    this.updateCars(0);
    this.update(0);
  }

  setTransform(root, d) {
    Object.assign(root, { position: [...d.position], rotation: [...d.rotation], scale: [...d.scale] });
  }
  addBlockers(root) {
    const parent = compose(root.position, root.rotation, root.scale);
    for (const mesh of root.children) {
      if (mesh.shape !== 'box' || mesh.alpha < 1 || mesh.scale.some((x) => x < 0.14)) continue;
      this.blockers.push(bounds(mm(parent, compose(mesh.position, mesh.rotation, mesh.scale))));
    }
  }
  spawnVehicle(data, type = 'cruiser', options = {}) {
    const spec = VEHICLES[type];
    if (!spec) throw Error('Unknown vehicle type.');
    const model = makeVehicle(this.scene, type, this.policeTexture, this.glow);
    this.setTransform(model.root, data);
    if (type === 'cruiser') model.body.color = data.color;
    const hp = options.hp || spec.hp;
    const e = {
      data: structuredClone(data), root: model.root, model, position: model.root.position, kind: 'vehicle', vehicleType: type,
      hp, maxHP: hp, disabled: false, fireTime: 0, smokeClock: 0, index: this.unitSerial++, arrival: options.arrival || 0,
      destination: options.destination ? [...options.destination] : null, arrived: !options.destination,
      attackClock: 3, orbit: options.orbit || 0, flightClock: 0, escaping: false, gone: false, wave: this.wave,
    };
    if (spec.air) {
      e.beam = searchlight(this.scene, this.glow);
      e.beam.spot = [data.position[0], 0.1, -20];
    }
    this.cars.push(e);
    this.entities.set(data.id, e);
    this.rosterVersion++;
    return e;
  }
  spawnOfficer(data, type = 'patrol', options = {}) {
    if (!OFFICERS[type]) throw Error('Unknown officer type.');
    const model = makeOfficer(this.scene, type);
    this.setTransform(model.root, data);
    const e = {
      data: structuredClone(data), root: model.root, model, position: model.root.position, kind: 'human', officerType: type,
      fear: 0, mode: 'cover', safe: false, runPhase: 0, cooldown: 2.5 + this.rng() * 4, charge: 0,
      index: this.unitSerial++, vehicle: data.components.find((c) => c.type === 'human')?.vehicle,
      deployed: options.deployed ?? true, slot: options.slot || 0, baseY: data.position[1], wave: this.wave,
    };
    e.root.visible = e.deployed;
    this.officers.push(e);
    this.entities.set(data.id, e);
    this.rosterVersion++;
    return e;
  }
  /** World bounds of a unit. Cached per simulation step (stepId moves whenever units move). */
  entityBounds(e) {
    if (e._b && e._bs === this.stepId) return e._b;
    const size = e.kind === 'vehicle' ? VEHICLES[e.vehicleType].size : sizeFor[e.data.prefab] || [0.8, 2.3, 0.8];
    const center = e.vehicleType === 'helicopter' ? [0, 0, 1.1] : e.data.prefab === 'set' ? [0, 13, 0] : e.data.prefab === 'block' ? [0, 0, 0] : [0, size[1] / 2, 0];
    const m = mm(compose(e.root.position, e.root.rotation, e.root.scale), compose(center));
    e._b = bounds(m, size);
    e._bs = this.stepId;
    return e._b;
  }
  eye() {
    const p = this.player.position;
    return [p[0], p[1] + this.eyeH, p[2]];
  }
  /** Mouse, stick or touch look, already in radians (kit input applies sensitivity and invert). */
  look(dx, dy) {
    if (!this.playing || this.demo || this.failed) return;
    this.player.yaw = angleWrap(this.player.yaw - dx);
    this.player.pitch = clamp(this.player.pitch - dy, -1.28, 1.08);
  }
  aimRay() {
    return { origin: this.eye(), dir: cameraDirection(this.player.yaw, this.player.pitch) };
  }
  blockingDistance(origin, dir, max = 180) {
    let nearest = max;
    for (const b of this.blockers) {
      const d = rayBox(origin, dir, b.min, b.max, nearest);
      if (d !== null && d > 0.025) nearest = d;
    }
    return nearest;
  }
  traceTarget(ray) {
    let best = null, dist = this.blockingDistance(ray.origin, ray.dir);
    for (const list of [this.cars, this.officers])
      for (const e of list) {
        if (e.safe || e.gone || e.deployed === false || !e.root.visible) continue;
        const b = this.entityBounds(e), d = rayBox(ray.origin, ray.dir, b.min, b.max, dist);
        if (d !== null) { dist = d; best = e; }
      }
    return { entity: best, point: add(ray.origin, mul(ray.dir, dist)), distance: dist };
  }
  weakPoint(e) {
    return point(compose(e.root.position, e.root.rotation, e.root.scale), VEHICLES[e.vehicleType].weak);
  }
  center(e) {
    const b = this.entityBounds(e);
    return mul(add(b.min, b.max), 0.5);
  }
  lineClear(origin, target, ignore = null, includeVehicles = true) {
    const delta = sub(target, origin), len = Math.hypot(delta[0], delta[1], delta[2]), dir = norm(delta);
    if (this.blockingDistance(origin, dir, len) < len - 0.12) return false;
    if (includeVehicles)
      for (const c of this.cars) {
        if (c === ignore || c.gone || !c.root.visible) continue;
        const b = this.entityBounds(c);
        const d = rayBox(origin, dir, b.min, b.max, len);
        if (d !== null && d < len - 0.25) return false;
      }
    return true;
  }
  visibleUnit(e) {
    if (e.safe || e.gone || e.deployed === false || !e.root.visible) return false;
    const center = this.center(e), b = this.entityBounds(e), top = [center[0], b.max[1] - 0.12, center[2]];
    return this.lineClear(this.eye(), center, e) || this.lineClear(this.eye(), top, e);
  }

  fixedUpdate(dt) {
    if (!this.playing || this.failed) return;
    this.stepId++;
    this.time += dt;
    if (!this.started) { this.started = true; this.sparks(add(this.player.position, [0, 1, -1]), 12); this.ctx.audio.noise(0.3, 0.2, 2800); }
    this.hurt = Math.max(0, this.hurt - dt);
    this.hit = Math.max(0, this.hit - dt);
    this.flash = Math.max(0, this.flash - dt);
    this.messageTime = Math.max(0, this.messageTime - dt);
    this.scanBoot = Math.max(0, this.scanBoot - dt);
    this.gasCooldown = Math.max(0, this.gasCooldown - dt);
    this.recoil = damp(this.recoil, 0, 18, dt);
    this.fireClock = Math.max(-0.05, this.fireClock - dt);
    const c = this.ctx.ctl, p = this.player;
    if (c.take('vision')) this.toggleVision();
    if (c.take('lock')) this.toggleLock();
    if (c.take('gas')) this.launchGas();
    if (this.demo) {
      this.demoTarget = this.cars.find((v) => !v.disabled && !v.gone && v.root.visible) || null;
      p.position[0] = 0; p.position[2] = -0.45; p.motor.crouched = false;
      if (this.demoTarget) {
        const dir = norm(sub(this.weakPoint(this.demoTarget), this.eye()));
        p.yaw = Math.atan2(-dir[0], -dir[2]);
        p.pitch = Math.asin(clamp(dir[1], -1, 1));
      }
    } else {
      p.motor.grounded = p.position[1] <= 8.001;
      p.motor.crouched = c.crouch;
      const delta = p.motor.update(dt, { x: c.moveX, z: c.moveZ, sprint: c.sprint, jump: c.take('jump') }, p.yaw);
      const nx = clamp(p.position[0] + delta.x, -13.4, 13.4), nz = clamp(p.position[2] + delta.z, -0.6, 10.6);
      // Prevent walking through the two cover blocks.
      const obstruct = (x, z) => (Math.abs(x + 8) < 1.58 || Math.abs(x - 8) < 1.58) && Math.abs(z - 1.8) < 0.61 && p.position[1] < 9.25;
      if (!obstruct(nx, p.position[2])) p.position[0] = nx;
      if (!obstruct(p.position[0], nz)) p.position[2] = nz;
      p.position[1] = Math.max(8, p.position[1] + delta.y);
      if (p.position[1] === 8 && p.motor.vy < 0) p.motor.vy = 0;
      p.phase += Math.hypot(delta.x, delta.z) * 3;
      this.assistAim(dt);
    }
    // Crouching lowers the view over a few frames instead of snapping.
    this.eyeH = damp(this.eyeH, p.motor.crouched ? 1.16 : 1.91, 16, dt);
    this.setCamera();
    this.target = this.traceTarget(this.aimRay());
    this.heldSafe = this.target.entity?.kind === 'human';
    this.updateVision(dt);
    this.beltTimer = Math.max(0, this.beltTimer - dt);
    if (this.beltTimer === 0 && this.ammo === 0) this.ammo = 1600;
    const trigger = this.demo ? this.time > 2 && !!this.demoTarget : c.fire;
    this.spin = damp(this.spin, trigger ? 1 : 0, trigger ? 6 : 2.8, dt);
    this.firing = trigger && this.spin > 0.7 && !this.overheated && !this.beltTimer && !this.heldSafe && this.phase !== 'intermission';
    if (this.firing) {
      this.heat = Math.min(100, this.heat + 12 * dt);
      if (this.fireClock <= 0) { this.fireClock += 1 / 24; this.shoot(); }
    } else this.heat = Math.max(0, this.heat - 28 * dt);
    if (this.heat >= 100) this.overheated = true;
    if (this.overheated && this.heat < 34) this.overheated = false;
    this.warning = '';
    this.updateCars(dt);
    this.stepId++;
    this.updateBeams(dt);
    this.updateOfficers(dt);
    this.stepId++;
    this.updateProjectiles(dt);
    this.updateClouds(dt);
    this.updateFX(dt);
    this.updateSound(dt);
    this.updateWaves(dt);
    this.inCover = this.player.motor.crouched || this.player.position[2] > 2.4;
    if (this.integrity <= 0) {
      this.integrity = 0; this.failed = true; this.phase = 'failed'; this.firing = false; this.spin = 0; this.flash = 0; this.lockID = null;
      this.message = 'SYSTEM FAILURE'; this.messageTime = 10;
      this.ctx.audio.tone(60, 0.9, 'sawtooth', 0.3, 24);
      this.ctx.emit('fail');
    }
  }

  setCamera() {
    if (!this.playing) return;
    const eye = this.eye();
    const dir = cameraDirection(this.player.yaw, this.player.pitch);
    // A small kick when hit (off when the player asks for reduced motion). The aim ray is not shaken.
    const k = this.ctx.reducedMotion ? 0 : this.hurt * 1.6;
    this.camera.position = eye;
    this.camera.target = [eye[0] + dir[0] * 45 + Math.sin(this.time * 83) * k, eye[1] + dir[1] * 45 + Math.cos(this.time * 67) * k, eye[2] + dir[2] * 45];
    this.fovTarget = this.ctx.ctl.aim ? (this.scan ? 40 : 49) : this.document.player.fov;
  }
  toggleVision() {
    this.scan = !this.scan;
    this.scanBoot = this.scan ? 0.35 : 0;
    this.lockID = null; this.focusID = null; this.focusTime = 0;
    this.scene.environment.vision = this.scan;
    this.ctx.audio.tone(this.scan ? 720 : 390, 0.11, 'triangle', 0.09, this.scan ? 1200 : 190);
  }
  updateVision(dt) {
    this.focus = this.target?.entity || null;
    if (!this.scan) return;
    const id = this.focus?.data.id || null;
    if (id !== this.focusID) { this.focusID = id; this.focusTime = 0; }
    if (id && !this.scanBoot) {
      this.focusTime = Math.min(0.65, this.focusTime + dt);
      if (this.focusTime >= 0.65 && !this.identified.has(id)) { this.identified.add(id); this.ctx.audio.tone(1000, 0.04, 'sine', 0.04, 1300); }
    }
    const lock = this.lockID && this.entities.get(this.lockID);
    if (this.lockID && (!lock || lock.disabled || lock.gone || !this.visibleUnit(lock))) this.lockID = null;
  }
  toggleLock() {
    if (!this.scan) { this.message = `Press ${this.ctx.key('vision')} to start T-800 vision.`; this.messageTime = 2; return; }
    if (this.lockID) { this.lockID = null; return; }
    const e = this.focus;
    if (e?.kind === 'vehicle' && !e.disabled && this.identified.has(e.data.id) && this.visibleUnit(e)) {
      this.lockID = e.data.id;
      this.message = `TARGET LOCKED / HOLD ${this.ctx.key('aim').toUpperCase()} TO ASSIST AIM`;
    } else this.message = e?.kind === 'human' ? 'HUMAN / TARGET LOCK BLOCKED' : 'Keep a vehicle in the reticle until the scan is complete.';
    this.messageTime = 3;
  }
  assistAim(dt) {
    if (!this.scan || !this.lockID || !this.ctx.ctl.aim) return;
    const e = this.entities.get(this.lockID);
    if (!e || e.disabled || !this.visibleUnit(e)) { this.lockID = null; return; }
    const d = norm(sub(this.weakPoint(e), this.eye())), yaw = Math.atan2(-d[0], -d[2]), pitch = Math.asin(clamp(d[1], -1, 1));
    this.player.yaw = angleWrap(this.player.yaw + angleWrap(yaw - this.player.yaw) * (1 - Math.exp(-10 * dt)));
    this.player.pitch = damp(this.player.pitch, pitch, 10, dt);
  }
  worldMuzzle() {
    const ray = this.aimRay(), right = [Math.cos(this.player.yaw), 0, -Math.sin(this.player.yaw)];
    return add(ray.origin, add(mul(ray.dir, 1.3), add(mul(right, 0.38), [0, -0.4, 0])));
  }
  shoot() {
    if (this.heldSafe || this.ammo <= 0 || this.failed || !this.target) return;
    this.ammo--; this.shots++; this.flash = 0.045; this.recoil = 0.055;
    if (!this.ammo) this.beltTimer = 2.4;
    const t = this.target, e = t.entity;
    this.tracer(this.worldMuzzle(), t.point, '#ffdf9a', 0.052, 0.027);
    if (e?.kind === 'vehicle' && !e.disabled) {
      const ray = this.aimRay(), module = this.weakPoint(e), along = dot(sub(module, ray.origin), ray.dir);
      const weak = along > 0 && distance(add(ray.origin, mul(ray.dir, along)), module) < VEHICLES[e.vehicleType].radius;
      const damage = 4.6 * (weak ? 2.35 : 1);
      e.hp = Math.max(0, e.hp - damage);
      this.hit = 0.12; this.hits++;
      if (weak) this.criticalHits++;
      this.sparks(t.point, weak ? 7 : 4);
      if (e.hp === 0) this.disable(e);
    } else if (t.distance < 150) this.sparks(t.point, 3);
    for (const o of this.officers) {
      if (o.safe || !o.deployed || o.mode === 'run') continue;
      const dist = distance(o.root.position, t.point);
      if (dist > 7.5) continue;
      // Suppression is an arcade morale value. Human hit points are not used.
      o.fear += 0.11 + (7.5 - dist) * 0.024;
      if (o.fear > OFFICERS[o.officerType].resistance * (1 + this.wave * 0.025)) { o.mode = 'run'; o.charge = 0; }
    }
    if (this.shots % 2 === 0) {
      const m = this.scene.mesh('box', add(this.eye(), [0.5, -0.6, 0]), [0.045, 0.04, 0.14], '#c1a66b', [0, this.rng() * 360, 25], { castShadow: false });
      this.effects.push({ m, life: 1.3, total: 1.3, v: [1.8 + this.rng() * 2.4, 1.0 + this.rng(), this.rng() * 1.8], gravity: 9 });
      this.shotSound();
    }
    this.ctx.emit('shot');
  }
  applyDamageLook(e) {
    for (const p of e.model.panels || []) p.color = '#2a333c';
    for (const g of e.model.glass || []) g.visible = false;
    e.model.red.color = '#371b26';
    e.model.blue.color = '#182e40';
    for (const l of e.model.lamps || []) l.color = '#293746';
    if (e.vehicleType !== 'helicopter') { e.root.rotation[2] = 3; e.model.body.scale[1] *= 0.78; }
  }
  points(n) {
    return Math.round(n * this.diff.score);
  }
  disable(e, silent = false) {
    if (e.disabled) return;
    e.disabled = true; e.hp = 0; e.fireTime = 0.01;
    this.applyDamageLook(e);
    this.totalVehicles++;
    this.score += this.points(VEHICLES[e.vehicleType].points + this.wave * 15);
    if (e.vehicleType === 'helicopter') { e.escaping = true; e.arrived = true; }
    for (const o of this.officers) if (o.vehicle === e.data.id) { o.fear = 3; o.mode = 'run'; o.charge = 0; if (!o.deployed) this.deployOfficer(o, e); }
    if (this.lockID === e.data.id) this.lockID = null;
    if (silent) return;
    const wp = this.weakPoint(e);
    this.sparks(wp, 22);
    for (let i = 0; i < 8; i++) this.puff(wp, true);
    this.message = VEHICLES[e.vehicleType].name + (e.escaping ? ' withdrawing.' : ' disabled.');
    this.messageTime = 2.1;
    this.ctx.audio.tone(66, 0.48, 'sawtooth', 0.26, 22);
    this.ctx.audio.noise(0.55, 0.45, 250);
    this.ctx.emit('disable', e);
  }
  deployOfficer(o, car) {
    const side = o.slot % 2 ? 1 : -1, p = car.root.position;
    o.deployed = true; o.root.visible = true;
    o.root.position = [clamp(p[0] + side * (1.95 + o.slot * 0.25), -23, 23), 0.08, p[2] + 1.5];
    o.baseY = 0.08;
  }
  setLight(l, pos, color, radius, dy = 0) {
    l.position[0] = pos[0]; l.position[1] = pos[1] + dy; l.position[2] = pos[2];
    l.color[0] = color[0]; l.color[1] = color[1]; l.color[2] = color[2];
    l.radius = radius;
  }
  updateCars(dt) {
    for (const c of this.cars) {
      const spec = VEHICLES[c.vehicleType], p = c.root.position;
      if (c.arrival > 0) { c.arrival = Math.max(0, c.arrival - dt); c.root.visible = c.arrival === 0; continue; }
      c.root.visible = !c.gone;
      if (spec.air) {
        c.flightClock += dt;
        c.model.rotor.rotation[1] = this.time * 1700;
        c.model.rotor2.rotation[1] = this.time * 1700;
        if (c.escaping) {
          p[0] += (c.orbit ? 1 : -1) * dt * 7; p[1] += dt * 5; p[2] -= dt * 8;
          if (p[1] > 68) { c.gone = true; c.root.visible = false; }
        } else {
          const a = c.flightClock * 0.15 + c.orbit * 2.8;
          p[0] = Math.sin(a) * 23; p[1] = 16 + Math.sin(a * 0.7) * 3; p[2] = -35 + Math.cos(a) * 9;
          c.root.rotation[1] = Math.atan2(-this.player.position[0] + p[0], -this.player.position[2] + p[2]) / rad;
          c.arrived = true;
        }
      } else if (!c.arrived && !c.disabled && c.destination) {
        const v = sub(c.destination, p), l = Math.hypot(v[0], v[1], v[2]), travel = spec.speed * dt;
        if (l <= travel) {
          c.root.position = [...c.destination];
          c.position = c.root.position;
          c.arrived = true;
          c.root.rotation[1] = 180 + ((c.index % 3) - 1) * 12;
          for (const o of this.officers) if (o.vehicle === c.data.id && !o.deployed) this.deployOfficer(o, c);
        } else {
          p[0] += (v[0] * travel) / l; p[1] += (v[1] * travel) / l; p[2] += (v[2] * travel) / l;
          c.root.rotation[1] = Math.atan2(-v[0], -v[2]) / rad;
        }
      }
      const flash = Math.sin(this.time * 10 + c.index * 1.8) > 0;
      if (!c.disabled) {
        c.model.red.color = flash ? '#ff3653' : '#51202e';
        c.model.blue.color = flash ? '#1f3c62' : '#399dff';
        if (!spec.air) c.model.reflection.color = flash ? '#c73553' : '#256fc4';
      } else if (!c.gone) {
        c.fireTime += dt;
        c.smokeClock -= dt;
        if (c.smokeClock <= 0) { c.smokeClock = c.fireTime > 7 ? 0.55 : 0.2; this.puff(this.weakPoint(c), c.fireTime < 3.8); }
      }
    }
    // Six roof-light slots: active vehicles first, then burning wrecks.
    const lights = this.scene.pointLights;
    let n = 0;
    for (const c of this.cars) {
      if (n >= 6) break;
      if (!c.disabled && c.root.visible) this.carLight(lights[n++], c);
    }
    for (const c of this.cars) {
      if (n >= 6) break;
      if (c.disabled && !c.gone) this.carLight(lights[n++], c);
    }
    for (; n < 6; n++) this.setLight(lights[n], LIGHT_OFF, LIGHT_OFF, 1);
    this.setLight(lights[6], this.worldMuzzle(), this.flash > 0 ? [3.1, 1.6, 0.55] : LIGHT_OFF, 12);
    this.setLight(lights[7], [0, 10, 5], [0.45, 0.72, 1.0], 18);
  }
  carLight(l, c) {
    const color = c.disabled ? LIGHT_FIRE : Math.sin(this.time * 10 + c.index * 1.8) > 0 ? LIGHT_RED : LIGHT_BLUE;
    this.setLight(l, c.root.position, color, c.vehicleType === 'helicopter' ? 19 : 12, 2.6);
  }

  /* ---------------------------------------------------------------- searchlights */

  placeBeam(b, from, to, radius) {
    const d = [from[0] - to[0], from[1] - to[1], from[2] - to[2]], l = Math.hypot(d[0], d[1], d[2]) || 1;
    b.root.position = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2];
    b.root.rotation = [Math.atan2(-d[1], d[2]) / rad, Math.asin(clamp(d[0] / l, -1, 1)) / rad, 0];
    b.cone.scale = [radius, l, radius];
    b.pool.position = [to[0], to[1] + 0.02, to[2]];
  }
  lampOf(root) {
    return point(compose(root.position, root.rotation, root.scale), LAMP);
  }
  /** Police helicopters track the T-800 with a searchlight. Anyone standing in it is easier to hit. */
  updateBeams(dt) {
    this.lit = false;
    if (this.wave === 0) return;
    const lights = this.scene.pointLights, pp = this.player.position;
    let slot = 8;
    for (const c of this.cars) {
      const b = c.beam;
      if (!b) continue;
      const active = !c.disabled && !c.gone && c.root.visible && c.arrival === 0;
      b.root.visible = active;
      b.pool.visible = active;
      if (!active) continue;
      const lamp = this.lampOf(c.root);
      // Aim at the balcony with a slow sweep, so moving keeps the T-800 out of the light.
      const tx = pp[0] + Math.sin(this.time * 1.3 + c.index) * 1.4, tz = pp[2] + Math.cos(this.time * 1.05 + c.index) * 1.1;
      const dx = tx - b.spot[0], dz = tz - b.spot[2], dl = Math.hypot(dx, dz);
      const step = Math.min(dl, (this.phase === 'wave' ? 3.6 : 1.5) * dt);
      if (dl > 1e-6) { b.spot[0] += (dx / dl) * step; b.spot[2] += (dz / dl) * step; }
      b.spot[1] = onBalcony(b.spot) ? 8.02 : 0.1;
      this.placeBeam(b, lamp, b.spot, 2.1);
      b.lit = !this.demo && Math.hypot(b.spot[0] - pp[0], b.spot[2] - pp[2]) < 2.3 && this.lineClear(lamp, this.eye(), c, false);
      if (b.lit) this.lit = true;
      if (slot < 10) this.setLight(lights[slot++], b.spot, [1.15, 1.25, 1.4], 7, 2.4);
    }
    for (; slot < 10; slot++) this.setLight(lights[slot], LIGHT_OFF, LIGHT_OFF, 1);
    if (this.lit) this.warning = 'SEARCHLIGHT / YOU ARE LIT / MOVE OR TAKE COVER';
  }

  updateOfficers(dt) {
    const airBonus = this.cars.some((c) => c.vehicleType === 'helicopter' && !c.disabled) ? 1.2 : 1;
    const accuracy = this.diff.accuracy * (this.lit ? 1.35 : 1);
    for (const o of this.officers) {
      if (o.safe || !o.deployed) continue;
      const p = o.root.position, spec = OFFICERS[o.officerType];
      if (o.mode !== 'run' && this.inGas(p)) { o.fear = 3; o.mode = 'run'; o.charge = 0; this.gassed++; }
      if (o.mode === 'run') {
        o.charge = 0;
        o.runPhase += dt * 12;
        const dx = (o.index % 2 ? 31 : -31) - p[0], dz = -65 - p[2], l = Math.hypot(dx, dz);
        if (l < 2) { o.safe = true; o.mode = 'safe'; o.root.visible = false; this.totalSafe++; this.score += this.points(25); continue; }
        p[0] += (dx / l) * 6.3 * dt; p[2] += (dz / l) * 6.3 * dt; p[1] = 0.08;
        o.root.rotation[1] = Math.atan2(-dx, -dz) / rad;
        for (const limb of o.model.legs) {
          limb.leg.rotation[0] = Math.sin(o.runPhase + (limb.side * Math.PI) / 2) * 33;
          limb.foot.position[2] = -0.09 + Math.sin(o.runPhase + (limb.side * Math.PI) / 2) * 0.2;
        }
        continue;
      }
      const eyeP = this.eye();
      o.root.rotation[1] = Math.atan2(-(eyeP[0] - p[0]), -(eyeP[2] - p[2])) / rad;
      if (spec.advance && p[2] < -8 && this.phase === 'wave') {
        p[2] += spec.advance * dt;
        const tx = clamp(this.player.position[0] + (o.index % 2 ? 4 : -4), -20, 20);
        p[0] += Math.sign(tx - p[0]) * Math.min(Math.abs(tx - p[0]), dt * 0.35);
        o.runPhase += dt * 7;
        for (const leg of o.model.legs) leg.leg.rotation[0] = Math.sin(o.runPhase + leg.side) * 18;
      }
      o.fear = Math.max(0, o.fear - dt * 0.018);
      o.cooldown -= dt;
      const eye = [p[0], p[1] + 1.75, p[2]], canSee = this.lineClear(eye, eyeP, this.entities.get(o.vehicle));
      if (!canSee || this.phase === 'intermission') { o.charge = 0; continue; }
      if (o.cooldown <= 0 && this.time > 4) {
        o.charge += dt;
        if (o.officerType === 'marksman') {
          this.warning = 'MARKSMAN AIMING / MOVE TO COVER';
          if (Math.floor(this.time * 15) % 3 === 0) this.tracer(eye, eyeP, '#e43d42', 0.045, 0.012);
        }
        if (o.charge >= spec.charge) {
          o.charge = 0;
          o.cooldown = (spec.interval + this.rng() * 1.2) / (this.currentPlan?.rateScale || 1);
          const end = add(eyeP, [(this.rng() - 0.5) * 1.2, (this.rng() - 0.5) * 0.5, 0]);
          this.tracer(eye, end, '#afc4d7', 0.07, 0.016);
          this.sparks(end, 2);
          const protection = this.player.motor.crouched ? 0.23 : 1;
          if (!this.demo && this.rng() < spec.accuracy * protection * accuracy) {
            this.integrity = Math.max(0, this.integrity - spec.damage * (this.currentPlan?.damageScale || 1) * airBonus * this.diff.damage);
            this.hurt = 0.24;
            this.ctx.audio.play('hurt');
            this.ctx.emit('hurt', spec.damage);
          }
        }
      }
    }
  }
  updateWaves(dt) {
    if (this.phase === 'intermission') {
      this.intermission = Math.max(0, this.intermission - dt);
      if (this.intermission === 0) this.startWave(this.wave + 1);
      return;
    }
    if (!this.cars.every((c) => c.disabled)) return;
    for (const o of this.officers)
      if (!o.safe) {
        o.fear = 3; o.mode = 'run'; o.charge = 0;
        const car = this.entities.get(o.vehicle);
        if (!o.deployed && car) this.deployOfficer(o, car);
      }
    if (!this.officers.every((o) => o.safe)) return;
    this.winDelay += dt;
    if (this.winDelay < 1.2) return;
    if (this.wave === 0) this.sceneComplete = true;
    else { this.wavesCleared = this.wave; this.score += this.points(this.wave * 150); }
    const repair = this.diff.repair;
    this.phase = 'intermission'; this.winDelay = 0; this.intermission = wavePlan(this.wave + 1).breakTime;
    this.integrity = Math.min(100, this.integrity + repair); this.ammo = 1600; this.beltTimer = 0; this.heat = 0; this.overheated = false;
    this.gasRounds = Math.min(GAS.max, this.gasRounds + GAS.perWave);
    this.message = this.wave === 0 ? 'SCENE COMPLETE / NO CASUALTIES' : `WAVE ${this.wave} CLEAR / SYSTEM REPAIR +${repair}%`;
    this.messageTime = 4;
    this.ctx.audio.tone(460, 0.35, 'triangle', 0.16, 860);
    this.ctx.emit('waveClear');
  }
  removeUnit(e) {
    for (const mesh of e.root.children) this.scene.remove(mesh);
    if (e.beam) {
      for (const mesh of e.beam.root.children) this.scene.remove(mesh);
      this.scene.remove(e.beam.pool);
    }
    this.entities.delete(e.data.id);
  }
  clearRoster() {
    for (const e of this.cars) this.removeUnit(e);
    for (const e of this.officers) this.removeUnit(e);
    for (const fx of this.effects) this.scene.remove(fx.m);
    for (const pr of this.projectiles) this.scene.remove(pr.m);
    this.effects = []; this.cars = []; this.officers = []; this.projectiles = []; this.clouds = [];
    this.rosterVersion++; this.focus = null; this.focusID = null; this.focusTime = 0; this.lockID = null;
    this.identified.clear(); this.target = null; this.demoTarget = null; this.lit = false;
  }
  startWave(number) {
    const plan = wavePlan(number);
    this.clearRoster();
    this.wave = number; this.currentPlan = plan;
    this.phase = 'wave'; this.intermission = 0; this.winDelay = 0; this.heli.root.visible = false;
    let ground = 0, air = 0;
    plan.types.forEach((type, index) => {
      const spec = VEHICLES[type], isAir = !!spec.air;
      let end, start;
      if (isAir) { end = [-22 + air * 44, 17, -33]; start = [...end]; air++; }
      else { const col = ground % 4, row = Math.floor(ground / 4); end = [-15 + col * 10, 0.08, -15 - row * 13]; start = [index % 2 ? 52 : -52, 0.08, end[2] - 8]; ground++; }
      const id = `wave-${number}-vehicle-${index}`;
      const data = { id, name: spec.name, prefab: 'policecar', position: start, rotation: [0, 180, 0], scale: [1, 1, 1], color: '#c4d0d5', components: [{ type: 'vehicle', health: spec.hp }] };
      const car = this.spawnVehicle(data, type, { hp: spec.hp * plan.healthScale * this.diff.hp, destination: end, arrival: index * 0.65, orbit: air - 1 });
      car.root.visible = car.arrival === 0;
      const crew = [...spec.crew];
      if (number >= 4 && index % 3 === 1 && crew.length) crew[crew.length - 1] = 'marksman';
      crew.forEach((unit, j) => {
        const od = { id: `${id}-officer-${j}`, name: OFFICERS[unit].name, prefab: 'officer', position: [...end], rotation: [0, 180, 0], scale: [1, 1, 1], color: '#21334d', components: [{ type: 'human', vehicle: id }] };
        this.spawnOfficer(od, unit, { deployed: false, slot: j });
      });
    });
    this.message = 'WAVE ' + number + ' / ' + plan.name.toUpperCase();
    this.messageTime = 4.5;
    this.ctx.notify(plan.notice);
    this.ctx.emit('waveStart', number);
  }

  /* ---------------------------------------------------------------- M79 tear gas */

  launchGas() {
    if (this.demo) return;
    if (this.phase === 'intermission') { this.message = 'LINE CLEAR / HOLD THE GAS FOR THE NEXT WAVE'; this.messageTime = 2; return; }
    if (this.gasCooldown > 0) return;
    if (this.gasRounds <= 0) { this.message = 'M79 EMPTY / TWO ROUNDS AFTER EACH WAVE'; this.messageTime = 2.2; this.ctx.audio.play('empty'); return; }
    this.gasRounds--;
    this.gasCooldown = GAS.cooldown;
    const ray = this.aimRay(), right = [Math.cos(this.player.yaw), 0, -Math.sin(this.player.yaw)];
    const start = add(ray.origin, add(mul(ray.dir, 0.9), add(mul(right, -0.35), [0, -0.25, 0])));
    const v = add(mul(ray.dir, GAS.speed), [0, GAS.lift, 0]);
    const m = this.scene.mesh('cylinder', start, [0.09, 0.22, 0.09], '#8f9a8c', [90, 0, 0], { castShadow: false });
    this.projectiles.push({ m, p: start, v, life: GAS.fuse, trail: 0 });
    this.recoil = 0.08;
    this.ctx.audio.play('launch');
    this.ctx.emit('gas');
  }
  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= dt;
      const next = add(pr.p, mul(pr.v, dt));
      pr.v[1] -= GAS.gravity * dt;
      const seg = sub(next, pr.p), len = Math.hypot(seg[0], seg[1], seg[2]);
      let hit = null;
      if (len > 1e-6) {
        const dir = mul(seg, 1 / len);
        let best = this.blockingDistance(pr.p, dir, len);
        for (const c of this.cars) {
          if (c.gone || !c.root.visible) continue;
          const b = this.entityBounds(c), d = rayBox(pr.p, dir, b.min, b.max, best);
          if (d !== null && d < best) best = d;
        }
        if (best < len) hit = add(pr.p, mul(dir, Math.max(0, best - 0.05)));
      }
      if (!hit && next[1] <= 0.12) hit = [next[0], 0.12, next[2]];
      if (!hit && pr.life <= 0) hit = next;
      if (hit) {
        this.scene.remove(pr.m);
        this.projectiles.splice(i, 1);
        this.burstGas(hit);
        continue;
      }
      pr.p = next;
      pr.m.position = [...next];
      pr.m.rotation[0] += dt * 540;
      pr.trail -= dt;
      if (pr.trail <= 0) { pr.trail = 0.05; this.gasPuff(next, 0.18, 0.9, 0.3); }
    }
  }
  burstGas(p) {
    const cloud = { p: [p[0], Math.max(0.1, p[1]), p[2]], age: 0, puffClock: 0 };
    this.clouds.push(cloud);
    for (let i = 0; i < 9; i++) this.gasPuff(add(cloud.p, [(this.rng() - 0.5) * 2.4, this.rng() * 0.8, (this.rng() - 0.5) * 2.4]), 0.8 + this.rng() * 0.5, 3 + this.rng(), 0.46);
    this.sparks(cloud.p, 4);
    this.ctx.audio.play('burst');
  }
  gasRadius(c) {
    return Math.min(GAS.radius, 1.5 + c.age * 4);
  }
  inGas(p) {
    for (const c of this.clouds) {
      const r = this.gasRadius(c);
      if (Math.hypot(p[0] - c.p[0], p[2] - c.p[2]) < r && p[1] > c.p[1] - 3 && p[1] < c.p[1] + 4) return true;
    }
    return false;
  }
  updateClouds(dt) {
    for (let i = this.clouds.length - 1; i >= 0; i--) {
      const c = this.clouds[i];
      c.age += dt;
      if (c.age >= GAS.life) { this.clouds.splice(i, 1); continue; }
      c.puffClock -= dt;
      if (c.puffClock <= 0 && c.age < GAS.life - 2) {
        c.puffClock = 0.24;
        const r = this.gasRadius(c) * 0.7, a = this.rng() * Math.PI * 2, d = Math.sqrt(this.rng()) * r;
        this.gasPuff([c.p[0] + Math.cos(a) * d, c.p[1] + 0.2 + this.rng() * 0.6, c.p[2] + Math.sin(a) * d], 0.9 + this.rng() * 0.6, 3 + this.rng() * 1.2, 0.4);
      }
    }
  }
  gasPuff(p, size, life, alpha) {
    const m = this.scene.mesh('sphere', p, [size, size * 0.8, size], this.rng() > 0.5 ? '#b3bfb7' : '#9aa7a0', [0, this.rng() * 360, 0], { alpha, castShadow: false });
    this.effects.push({ m, life, total: life, v: [(this.rng() - 0.5) * 0.5, 0.25 + this.rng() * 0.25, (this.rng() - 0.5) * 0.5], grow: 0.7, fade: true, maxAlpha: alpha });
  }

  /* ---------------------------------------------------------------- effects */

  tracer(a, b, color, life = 0.07, width = 0.023) {
    const g = this.scene.group(), m = rod(this.scene, g, a, b, width, color, { unlit: true, castShadow: false });
    this.effects.push({ m, life, total: life });
  }
  sparks(p, n = 8) {
    for (let i = 0; i < n; i++) {
      const m = this.scene.mesh('box', p, [0.024, 0.024, 0.1 + this.rng() * 0.13], i % 3 ? '#ffbd67' : '#fff2b0', [this.rng() * 180, this.rng() * 180, 0], { unlit: true, castShadow: false });
      this.effects.push({ m, life: 0.2 + this.rng() * 0.5, total: 0.7, v: [(this.rng() - 0.5) * 9, 1 + this.rng() * 6, (this.rng() - 0.5) * 9], gravity: 8 });
    }
  }
  puff(p, flame = false) {
    const life = flame ? 0.3 + this.rng() * 0.5 : 2.2 + this.rng() * 1.8, sz = flame ? 0.25 + this.rng() * 0.45 : 0.35 + this.rng() * 0.35;
    const m = this.scene.mesh('sphere', p, [sz, sz, sz], flame ? (this.rng() > 0.4 ? '#ffad43' : '#db5122') : '#405365', [0, 0, 0], { unlit: flame, alpha: flame ? 0.82 : 0.48, castShadow: false });
    this.effects.push({ m, life, total: life, v: [0.3 + this.rng() * 0.8, flame ? 1.5 : 2.0 + this.rng(), (this.rng() - 0.5) * 0.6], grow: flame ? 0.8 : 1.2, fade: true });
  }
  updateFX(dt) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.life -= dt;
      if (e.life <= 0) { this.scene.remove(e.m); this.effects.splice(i, 1); continue; }
      if (e.v) {
        const p = e.m.position;
        p[0] += e.v[0] * dt; p[1] += e.v[1] * dt; p[2] += e.v[2] * dt;
        if (e.gravity) e.v[1] -= e.gravity * dt;
      }
      if (e.grow) { const s = e.m.scale, g = e.grow * dt; s[0] += g; s[1] += g; s[2] += g; }
      if (e.fade) { const a = e.maxAlpha ?? 0.65; e.m.alpha = Math.min(a, (e.life / e.total) * a); }
    }
    // The effect budget follows the quality tier (260 at high, as before).
    const cap = this.ctx.effectCap ? this.ctx.effectCap() : 260;
    while (this.effects.length > cap) this.scene.remove(this.effects.shift().m);
  }

  /** Per rendered frame: weapon animation, the scenery helicopter and the smoothed zoom. */
  update(dt) {
    if (!this.hero) return;
    if (dt > 0) this.camera.fov = damp(this.camera.fov, this.fovTarget, 14, dt);
    this.setCamera();
    const gun = this.gun;
    gun.root.position = [0.3, -0.4 + this.recoil, -0.83];
    gun.root.rotation = [-3, 0, -5];
    gun.root.scale = [0.5, 0.5, 0.5];
    gun.root.visible = !this.failed;
    const angle = this.time * 65 * this.spin;
    for (const b of gun.barrels) {
      b.m.position[0] = b.tip.position[0] = Math.cos(b.a + angle) * 0.168;
      b.m.position[1] = b.tip.position[1] = Math.sin(b.a + angle) * 0.168;
    }
    const showFlash = this.flash > 0 && !this.failed;
    gun.flash.visible = gun.core.visible = showFlash;
    for (const m of gun.spikes) m.visible = showFlash;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 731);
    gun.flash.scale = [0.23 + pulse * 0.15, 0.2 + pulse * 0.1, 0.4 + pulse * 0.5];
    gun.spikes.forEach((m, i) => (m.rotation[2] = i * 72 + this.time * 1500));
    const h = this.heli;
    h.root.visible = this.wave === 0;
    h.root.position = [Math.sin(this.time * 0.075 - 0.6) * 31, 25 + Math.sin(this.time * 0.18) * 2, -49 + Math.cos(this.time * 0.075) * 11];
    h.root.rotation = [0, -30 + Math.sin(this.time * 0.08) * 50, -4];
    h.rotor.rotation[1] = h.rotor2.rotation[1] = this.time * 1700;
    // The opening scene's helicopter sweeps the street with its searchlight (scenery only).
    const hb = this.heliBeam, sweeping = this.wave === 0;
    hb.root.visible = hb.pool.visible = sweeping;
    if (sweeping) {
      hb.spot[0] = Math.sin(this.time * 0.23) * 17;
      hb.spot[1] = 0.1;
      hb.spot[2] = -30 + Math.cos(this.time * 0.19) * 15;
      this.placeBeam(hb, this.lampOf(h.root), hb.spot, 2.4);
      const lights = this.scene.pointLights;
      this.setLight(lights[8], hb.spot, [0.85, 0.95, 1.1], 8, 2.4);
      this.setLight(lights[9], LIGHT_OFF, LIGHT_OFF, 1);
    }
    this.scene.environment.vision = this.scan;
  }

  shotSound() {
    this.ctx.audio.noise(0.12, 0.65, 1400);
    this.ctx.audio.tone(90, 0.07, 'sawtooth', 0.19, 35);
  }
  updateSound() {
    const a = this.ctx.audio, c = a.context;
    if (!c || c.state !== 'running') return;
    if (!this.siren) {
      const osc = c.createOscillator(), gain = c.createGain();
      osc.type = 'sine';
      osc.connect(gain);
      gain.connect(a.gain);
      gain.gain.value = 0.035;
      osc.start();
      this.audioNodes.push(osc, gain);
      this.siren = { osc, gain };
      const motor = c.createOscillator(), mg = c.createGain();
      motor.type = 'sawtooth';
      motor.connect(mg);
      mg.connect(a.gain);
      mg.gain.value = 0;
      motor.start();
      this.audioNodes.push(motor, mg);
      this.motorSound = { osc: motor, gain: mg };
    }
    let live = 0;
    for (const x of this.cars) if (!x.disabled) live++;
    live /= Math.max(1, this.cars.length);
    this.siren.osc.frequency.setTargetAtTime(520 + Math.sin(this.time * 2.3) * 220, c.currentTime, 0.05);
    this.siren.gain.gain.setTargetAtTime(0.045 * live, c.currentTime, 0.1);
    this.motorSound.osc.frequency.setTargetAtTime(38 + this.spin * 100, c.currentTime, 0.025);
    this.motorSound.gain.gain.setTargetAtTime(this.spin * 0.05, c.currentTime, 0.03);
  }
  /** Silence the loops (siren, spin motor) while the game is paused or over. */
  quiet() {
    const c = this.ctx.audio.context;
    if (!c || !this.siren) return;
    this.siren.gain.gain.setTargetAtTime(0, c.currentTime, 0.05);
    this.motorSound.gain.gain.setTargetAtTime(0, c.currentTime, 0.05);
  }

  /* ---------------------------------------------------------------- checkpoints */

  saveLocal() {
    return {
      version: 3, time: this.time, player: { position: [...this.player.position], yaw: this.player.yaw, pitch: this.player.pitch },
      integrity: this.integrity, ammo: this.ammo, shots: this.shots, hits: this.hits, heat: this.heat, overheated: this.overheated, beltTimer: this.beltTimer,
      phase: this.phase, wave: this.wave, wavesCleared: this.wavesCleared, sceneComplete: this.sceneComplete, failed: this.failed,
      intermission: this.intermission, winDelay: this.winDelay, score: this.score, totalVehicles: this.totalVehicles, totalSafe: this.totalSafe,
      scan: this.scan, identified: [...this.identified], lockID: this.lockID, unitSerial: this.unitSerial, rngState: this.rngState,
      criticalHits: this.criticalHits, gasRounds: this.gasRounds, gassed: this.gassed,
      clouds: this.clouds.map((c) => ({ p: [...c.p], age: c.age })),
      cars: this.cars.map((c) => ({
        data: c.data, type: c.vehicleType, position: [...c.root.position], rotation: [...c.root.rotation],
        hp: c.hp, maxHP: c.maxHP, disabled: c.disabled, fireTime: c.fireTime, arrival: c.arrival, arrived: c.arrived, destination: c.destination,
        orbit: c.orbit, flightClock: c.flightClock, escaping: c.escaping, gone: c.gone, index: c.index, spot: c.beam ? [...c.beam.spot] : null,
      })),
      officers: this.officers.map((o) => ({
        data: o.data, type: o.officerType, position: [...o.root.position], rotation: [...o.root.rotation],
        mode: o.mode, safe: o.safe, fear: o.fear, deployed: o.deployed, slot: o.slot, baseY: o.baseY, cooldown: o.cooldown, charge: o.charge, runPhase: o.runPhase, index: o.index,
      })),
    };
  }
  restoreLocal(d) {
    const vector = (v) => Array.isArray(v) && v.length === 3 && v.every((x) => finite(x));
    const nonnegative = (v) => finite(v, 1e12) && v >= 0;
    if (!d || d.version !== 3 || !vector(d.player?.position) || !finite(d.player.yaw) || !finite(d.player.pitch) || !Number.isSafeInteger(d.wave) || d.wave < 0 || d.wave > 1000000 || !['scene', 'wave', 'intermission'].includes(d.phase)) throw Error('Invalid wave checkpoint.');
    for (const k of ['time', 'integrity', 'ammo', 'shots', 'hits', 'heat', 'beltTimer', 'intermission', 'winDelay', 'score', 'totalVehicles', 'totalSafe', 'wavesCleared', 'unitSerial', 'rngState', 'criticalHits', 'gasRounds', 'gassed']) if (!nonnegative(d[k])) throw Error('Invalid saved value: ' + k);
    if (d.integrity <= 0 || d.integrity > 100 || d.ammo > 1600 || d.heat > 100 || d.gasRounds > GAS.max || !Array.isArray(d.cars) || d.cars.length > 75 || !Array.isArray(d.officers) || d.officers.length > 160 || !Array.isArray(d.clouds) || d.clouds.length > 12) throw Error('Invalid checkpoint limits.');
    const ids = new Set();
    for (const u of [...d.cars, ...d.officers]) {
      if (!u.data || typeof u.data.id !== 'string' || ids.has(u.data.id) || !vector(u.position) || !vector(u.rotation) || !vector(u.data.scale) || u.data.scale.some((v) => v < 0.01 || v > 100) || !Array.isArray(u.data.components)) throw Error('Invalid saved unit.');
      if (this.entities.has(u.data.id) && !['vehicle', 'human'].includes(this.entities.get(u.data.id).kind)) throw Error('Saved unit ID conflicts with the level.');
      ids.add(u.data.id);
    }
    for (const k of ['scan', 'overheated', 'sceneComplete']) if (typeof d[k] !== 'boolean') throw Error('Invalid saved flag.');
    if (!Array.isArray(d.identified) || !d.identified.every((x) => typeof x === 'string') || (d.lockID !== null && typeof d.lockID !== 'string')) throw Error('Invalid saved vision data.');
    for (const c of d.cars) for (const k of ['disabled', 'arrived', 'escaping', 'gone']) if (typeof c[k] !== 'boolean') throw Error('Invalid saved vehicle flag.');
    for (const o of d.officers) for (const k of ['safe', 'deployed']) if (typeof o[k] !== 'boolean') throw Error('Invalid saved officer flag.');
    for (const c of d.cars) if (!VEHICLES[c.type] || !nonnegative(c.hp) || !nonnegative(c.maxHP) || c.maxHP <= 0 || c.hp > c.maxHP || !nonnegative(c.arrival) || !nonnegative(c.flightClock) || !nonnegative(c.fireTime) || !nonnegative(c.index) || !finite(c.orbit) || (c.destination !== null && !vector(c.destination)) || (c.spot != null && !vector(c.spot))) throw Error('Invalid saved vehicle.');
    for (const o of d.officers) if (!OFFICERS[o.type] || !['cover', 'run', 'safe'].includes(o.mode) || !nonnegative(o.fear) || !finite(o.cooldown, 1e12) || !nonnegative(o.charge) || !nonnegative(o.runPhase) || !nonnegative(o.index) || !nonnegative(o.slot) || !finite(o.baseY)) throw Error('Invalid saved officer.');
    for (const c of d.clouds) if (!vector(c.p) || !nonnegative(c.age)) throw Error('Invalid saved gas cloud.');
    this.clearRoster();
    this.wave = d.wave;
    for (const c of d.cars) {
      const e = this.spawnVehicle(c.data, c.type, { hp: c.maxHP, destination: c.destination, arrival: c.arrival, orbit: c.orbit });
      for (const k of ['hp', 'maxHP', 'disabled', 'fireTime', 'arrival', 'arrived', 'flightClock', 'escaping', 'gone', 'index']) e[k] = c[k];
      e.root.position = [...c.position]; e.position = e.root.position; e.root.rotation = [...c.rotation];
      e.root.visible = !e.gone && !e.arrival;
      if (e.beam && c.spot) e.beam.spot = [...c.spot];
      if (e.disabled) this.applyDamageLook(e);
    }
    for (const o of d.officers) {
      const e = this.spawnOfficer(o.data, o.type, { deployed: o.deployed, slot: o.slot });
      for (const k of ['mode', 'safe', 'fear', 'deployed', 'slot', 'baseY', 'cooldown', 'charge', 'runPhase', 'index']) e[k] = o[k];
      e.root.position = [...o.position]; e.position = e.root.position; e.root.rotation = [...o.rotation];
      e.root.visible = e.deployed && !e.safe;
    }
    for (const k of ['time', 'integrity', 'ammo', 'shots', 'hits', 'heat', 'overheated', 'beltTimer', 'phase', 'wave', 'wavesCleared', 'sceneComplete', 'intermission', 'winDelay', 'score', 'totalVehicles', 'totalSafe', 'scan', 'unitSerial', 'rngState', 'criticalHits', 'gasRounds', 'gassed']) this[k] = d[k];
    this.failed = false;
    this.clouds = d.clouds.map((c) => ({ p: [...c.p], age: Math.min(c.age, GAS.life), puffClock: 0 }));
    this.player.position = [...d.player.position];
    this.player.yaw = angleWrap(d.player.yaw);
    this.player.pitch = clamp(d.player.pitch, -1.28, 1.08);
    this.player.motor.reset();
    this.identified = new Set(d.identified.filter((id) => ids.has(id)));
    this.lockID = this.scan && d.cars.some((c) => c.data.id === d.lockID && !c.disabled) ? d.lockID : null;
    this.currentPlan = this.wave ? wavePlan(this.wave) : null;
    this.heli.root.visible = this.wave === 0;
    this.started = true;
    this.stepId++;
    this.scene.environment.vision = this.scan;
    this.setCamera();
  }

  dispose() {
    for (const n of this.audioNodes)
      try {
        if (n.stop) n.stop();
        n.disconnect();
      } catch {
        /* already stopped */
      }
    this.audioNodes = [];
    this.siren = this.motorSound = null;
    this.effects = [];
    this.entities?.clear();
  }
}
