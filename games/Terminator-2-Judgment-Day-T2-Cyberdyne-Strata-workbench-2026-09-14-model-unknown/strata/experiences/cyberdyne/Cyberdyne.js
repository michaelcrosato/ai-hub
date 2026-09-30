/* Strata cartridge: no independent render loop, no remote assets. */
import { add, sub, mul, norm, dot, compose, bounds, rayBox, cameraDirection, point, mm } from '../../core/math3d.js';
import { clamp, damp } from '../../core/numeric.js';
import { validateHandoff, jsonData } from '../../core/contracts.js';
import { defaultMotor, Motor } from '../../kits/fps/Motor.js';
import { glowTexture, textTexture, person, minigun, buildSet, helicopter, box, rod, rad } from './Models.js';
export const manifest = {
  protocol: 1,
  version: '2.0.0',
  id: 'cyberdyne',
  title: 'T2 / Cyberdyne',
  subtitle: 'First-person standoff. T-800 vision. Endless police waves.',
  kind: 'custom',
  slot: 'breach',
  accepts: ['strata.soldier/1'],
  capabilities: ['t2.minigun', 't2.vehicle-damage', 't2.police-withdrawal', 't2.first-person', 't2.machine-vision', 't2.endless-waves'],
  routes: { complete: '$finish' },
};
const defaults = [
  [-11, -14, 16],
  [-4, -17, -12],
  [4, -14, 25],
  [12, -19, -28],
  [-11, -26, -24],
  [-4, -29, 18],
  [4, -25, -15],
  [12, -31, 23],
];
export function sceneData() {
  const entities = [
    {
      id: 'office',
      name: 'Cyberdyne building and street',
      prefab: 'set',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: '#416278',
      components: [{ type: 'set' }],
    },
    {
      id: 't800',
      name: 'T-800 / start position',
      prefab: 'spawn',
      position: [0, 8, -0.2],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: '#1f2933',
      components: [{ type: 'spawn' }],
    },
  ];
  defaults.forEach(([x, z, a], i) => {
    entities.push({
      id: 'car-' + i,
      name: 'Patrol car ' + String(i + 1).padStart(2, '0'),
      prefab: 'policecar',
      position: [x, 0.08, z],
      rotation: [0, a + 180, 0],
      scale: [1, 1, 1],
      color: '#d6d9d8',
      components: [{ type: 'vehicle', health: 100 }],
    });
    for (let j = 0; j < 2; j++)
      entities.push({
        id: `officer-${i}-${j}`,
        name: `Officer ${i * 2 + j + 1}`,
        prefab: 'officer',
        position: [x + (j ? 2.8 : -2.6), 0.08, z + (j ? 1.8 : 2.0)],
        rotation: [0, 180, 0],
        scale: [1, 1, 1],
        color: '#21334d',
        components: [{ type: 'human', vehicle: 'car-' + i }],
      });
  });
  return {
    version: 1,
    name: 'Cyberdyne / No casualties',
    objective: 'Disable the patrol cars. Let the officers withdraw.',
    seed: 1991,
    environment: { sky: '#0b1a2c', fog: 0.009, sun: 0.5 },
    player: { ...defaultMotor, walkSpeed: 2.4, sprintSpeed: 3.8, jumpSpeed: 4.0, headBob: 0, fov: 70 },
    entities,
  };
}
const catalog = [
  { id: 'policecar', name: 'Patrol car', group: 'Scene' },
  { id: 'officer', name: 'Police officer', group: 'Scene' },
  { id: 'block', name: 'Solid block', group: 'Structure' },
];
const sizeFor = { policecar: [2.4, 2, 5.1], officer: [0.8, 2.3, 0.8], spawn: [1.2, 2.3, 1.2], set: [62, 27, 30], block: [1, 1, 1] };
function finite(v, n = 1e4) {
  return typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= n;
}
export function validateDocument(raw) {
  const d = jsonData(raw, 1024 * 1024);
  if (d.version !== 1 || !Array.isArray(d.entities) || d.entities.length > 220) throw Error('Use a version 1 scene with no more than 220 objects.');
  const ids = new Set();
  let spawns = 0;
  for (const e of d.entities) {
    if (typeof e.id !== 'string' || ids.has(e.id) || !sizeFor[e.prefab]) throw Error('Check each object ID and part type.');
    ids.add(e.id);
    for (const key of ['position', 'rotation', 'scale'])
      if (!Array.isArray(e[key]) || e[key].length !== 3 || !e[key].every((v) => finite(v))) throw Error('Each transform needs three valid numbers.');
    if (e.scale.some((v) => v < 0.01 || v > 100)) throw Error('Scale must be between 0.01 and 100.');
    if (!/^#[0-9a-f]{6}$/i.test(e.color) || !Array.isArray(e.components)) throw Error('Check object color and components.');
    if (e.prefab === 'spawn') spawns++;
    if (e.prefab === 'policecar') {
      const hp = e.components.find((c) => c.type === 'vehicle')?.health;
      if (hp !== undefined && (!finite(hp, 1000) || hp < 1)) throw Error('Vehicle health must be between 1 and 1000.');
    }
  }
  if (spawns !== 1) throw Error('Keep exactly one T-800 start position.');
  if (!d.entities.some((e) => e.prefab === 'policecar')) throw Error('Keep at least one patrol car.');
  d.player = { ...defaultMotor, ...d.player };
  for (const k of ['walkSpeed', 'sprintSpeed', 'jumpSpeed', 'fov', 'gravity', 'acceleration', 'headBob'])
    if (!finite(d.player[k], 200) || d.player[k] < 0) throw Error('Player settings must be valid positive numbers.');
  if (d.player.fov < 30 || d.player.fov > 110) throw Error('Field of view must be between 30 and 110.');
  return d;
}
import { VEHICLES, OFFICERS, PRESSURE, wavePlan } from './Waves.js';
import { makeVehicle, makeOfficer } from './Units.js';

const angleWrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const distance = (a, b) => Math.hypot(...sub(a, b));
export class Cyberdyne {
  constructor() {
    this.controls = {
      scheme: 'cyberdyne',
      captureMouse: false,
      bindings: {
        forward: ['KeyW'],
        back: ['KeyS'],
        left: ['KeyA'],
        right: ['KeyD'],
        sprint: ['ShiftLeft', 'ShiftRight'],
        crouch: ['ControlLeft', 'KeyC'],
        jump: ['Space'],
        fire: ['Mouse0'],
        aim: ['Mouse2'],
        scan: ['Tab', 'KeyV'],
        lock: ['KeyQ'],
        lookLeft: ['ArrowLeft'],
        lookRight: ['ArrowRight'],
        lookUp: ['ArrowUp'],
        lookDown: ['ArrowDown'],
      },
    };
  }
  async mount(ctx, handoff) {
    this.ctx = ctx;
    this.scene = ctx.scene;
    this.document = this.validateDocument(ctx.document || sceneData());
    this.state = validateHandoff(handoff);
    this.playing = ctx.mode === 'play';
    this.rngState = (this.document.seed || 1991) >>> 0;
    this.rng = () => {
      this.rngState = (Math.imul(1664525, this.rngState) + 1013904223) >>> 0;
      return this.rngState / 4294967296;
    };
    Object.assign(this, {
      time: 0,
      spin: 0,
      heat: 0,
      overheated: false,
      fireClock: 0,
      shots: 0,
      hits: 0,
      ammo: 1600,
      beltTimer: 0,
      integrity: 100,
      hurt: 0,
      hit: 0,
      completed: false,
      winDelay: 0,
      cameraMode: 1,
      scan: false,
      scanBoot: 0,
      demo: false,
      firing: false,
      flash: 0,
      recoil: 0,
      heldSafe: false,
      started: false,
      message: '',
      messageTime: 0,
      phase: 'scene',
      wave: 0,
      wavesCleared: 0,
      intermission: 0,
      sceneComplete: false,
      failed: false,
      score: 0,
      totalVehicles: 0,
      totalSafe: 0,
      unitSerial: 0,
      rosterVersion: 0,
      focusTime: 0,
      focusID: null,
      lockID: null,
      warning: '',
      focus: null,
      inCover: false,
      criticalHits: 0,
    });
    this.effects = [];
    this.cars = [];
    this.officers = [];
    this.entities = new Map();
    this.audioNodes = [];
    this.blockers = [];
    this.identified = new Set();
    this.mouse = [0, 0];
    this.currentPlan = null;
    this.scene.environment = {
      sky: this.document.environment?.sky || '#0b1a2c',
      fog: this.document.environment?.fog ?? 0.009,
      sun: 0.5,
      night: true,
      vision: false,
    };
    this.scene.shadowRadius = 75;
    this.scene.lightTarget = [0, 4, -22];
    this.glow = glowTexture(this.scene);
    this.policeTexture = textTexture(this.scene, 'POLICE', '#193148', '#d9e0dc');
    for (const d of this.document.entities) {
      if (d.prefab === 'policecar') {
        this.spawnVehicle(d, 'cruiser', { hp: d.components.find((c) => c.type === 'vehicle')?.health || 100 });
      } else if (d.prefab === 'officer') {
        this.spawnOfficer(d, 'patrol');
      } else {
        let model;
        if (d.prefab === 'set') model = buildSet(this.scene, this.glow);
        else if (d.prefab === 'spawn') model = person(this.scene, true);
        else {
          const root = this.scene.group();
          box(this.scene, root, [0, 0, 0], [1, 1, 1], d.color);
          model = { root };
        }
        this.setTransform(model.root, d);
        this.entities.set(d.id, { data: d, root: model.root, model, position: model.root.position });
        if (d.prefab === 'spawn') {
          this.hero = model;
          this.player = {
            position: [...d.position],
            yaw: d.rotation[1] * rad,
            pitch: -0.35,
            phase: 0,
            vy: 0,
            motor: new Motor(this.document.player),
          };
        } else this.addBlockers(model.root);
      }
    }
    // Cover on the balcony. These boxes also stop the aim ray and return fire.
    this.cover = this.scene.group();
    for (const x of [-8, 8]) box(this.scene, this.cover, [x, 8.65, 1.8], [2.6, 1.3, 0.65], '#536a7b');
    this.addBlockers(this.cover);
    this.gun = minigun(this.scene, this.glow);
    const g = this.gun.root;
    this.gun.arms.push(
      rod(this.scene, g, [-0.32, -0.37, 0.32], [-0.03, 0.43, 0.06], 0.23, '#1b2630'),
      box(this.scene, g, [0, 0.47, 0.04], [0.2, 0.15, 0.22], '#b98a6d'),
      rod(this.scene, g, [0.33, -0.56, 0.3], [0.07, -0.25, 0.33], 0.25, '#1e2933'),
      box(this.scene, g, [0.06, -0.22, 0.3], [0.2, 0.22, 0.2], '#b98a6d'),
    );
    this.heli = helicopter(this.scene, this.glow);
    this.heli.root.position = [-26, 26, -42];
    this.scene.pointLights = Array.from({ length: 8 }, () => ({ position: [0, 0, 0], color: [0, 0, 0], radius: 1 }));
    this.camera = { position: [0, 10, 0], target: [0, 1, -25], fov: this.document.player.fov };
    this.scene.camera = this.camera;
    this.editor = this.makeEditor();
    // Mouse (locked or not), right stick and touch drag all arrive through the host input's look().
    // Police pressure is fixed for a run; a saved run brings back its own.
    this.setPressure(ctx.settings.t2Pressure);
    if (ctx.local) this.restoreLocal(ctx.local);
    this.setCamera();
    this.updateCars(0);
    this.update(0);
  }
  validateDocument(raw) {
    return validateDocument(raw);
  }
  setTransform(root, d) {
    Object.assign(root, { position: [...d.position], rotation: [...d.rotation], scale: [...d.scale] });
  }
  makeEditor() {
    return {
      kind: 'custom',
      getDocument: () => structuredClone(this.document),
      validate: (d) => this.validateDocument(d),
      prefabs: () => catalog,
      create: (id, p) => ({
        id: id + '-' + crypto.randomUUID().slice(0, 8),
        name: catalog.find((c) => c.id === id)?.name || id,
        prefab: id,
        position: p,
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        color: id === 'policecar' ? '#d6d9d8' : '#344959',
        components: [{ type: id === 'policecar' ? 'vehicle' : id === 'officer' ? 'human' : 'solid' }],
      }),
      getEntity: (id) => this.entities.get(id),
      bounds: (id) => {
        const e = this.entities.get(id);
        return e ? this.entityBounds(e) : { min: [0, 0, 0], max: [1, 1, 1] };
      },
    };
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
      data: structuredClone(data),
      root: model.root,
      model,
      position: model.root.position,
      kind: 'vehicle',
      vehicleType: type,
      hp,
      maxHP: hp,
      disabled: false,
      fireTime: 0,
      smokeClock: 0,
      index: this.unitSerial++,
      arrival: options.arrival || 0,
      destination: options.destination ? [...options.destination] : null,
      arrived: !options.destination,
      attackClock: 3,
      orbit: options.orbit || 0,
      flightClock: 0,
      escaping: false,
      gone: false,
      wave: this.wave,
    };
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
      data: structuredClone(data),
      root: model.root,
      model,
      position: model.root.position,
      kind: 'human',
      officerType: type,
      fear: 0,
      mode: 'cover',
      safe: false,
      runPhase: 0,
      cooldown: 2.5 + this.rng() * 4,
      charge: 0,
      index: this.unitSerial++,
      vehicle: data.components.find((c) => c.type === 'human')?.vehicle,
      deployed: options.deployed ?? true,
      slot: options.slot || 0,
      baseY: data.position[1],
      wave: this.wave,
    };
    e.root.visible = e.deployed;
    this.officers.push(e);
    this.entities.set(data.id, e);
    this.rosterVersion++;
    return e;
  }
  entityBounds(e) {
    const size = e.kind === 'vehicle' ? VEHICLES[e.vehicleType].size : sizeFor[e.data.prefab] || [0.8, 2.3, 0.8];
    const center =
      e.vehicleType === 'helicopter'
        ? [0, 0, 1.1]
        : e.data.prefab === 'set'
          ? [0, 13, 0]
          : e.data.prefab === 'block'
            ? [0, 0, 0]
            : [0, size[1] / 2, 0];
    const m = mm(compose(e.root.position, e.root.rotation, e.root.scale), compose(center));
    return bounds(m, size);
  }
  eye() {
    return add(this.player.position, [0, this.player.motor.crouched ? 1.16 : 1.91, 0]);
  }
  look(dx, dy) {
    const s = this.ctx.settings;
    this.player.yaw = angleWrap(this.player.yaw - dx * (s.sensitivity || 0.002));
    this.player.pitch = clamp(this.player.pitch - dy * (s.sensitivity || 0.002) * (s.invertY ? -1 : 1), -1.28, 1.08);
  }
  beforeFrame() {
    if (!this.playing || this.demo || this.failed) return;
    const [dx, dy] = this.ctx.input.look();
    this.look(dx, dy);
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
    let best = null,
      dist = this.blockingDistance(ray.origin, ray.dir);
    for (const e of [...this.cars, ...this.officers]) {
      if (e.safe || e.gone || e.deployed === false || !e.root.visible) continue;
      const b = this.entityBounds(e),
        d = rayBox(ray.origin, ray.dir, b.min, b.max, dist);
      if (d !== null) {
        dist = d;
        best = e;
      }
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
    const delta = sub(target, origin),
      length = Math.hypot(...delta),
      dir = norm(delta);
    if (this.blockingDistance(origin, dir, length) < length - 0.12) return false;
    if (includeVehicles)
      for (const c of this.cars) {
        if (c === ignore || c.gone || !c.root.visible) continue;
        const b = this.entityBounds(c);
        const d = rayBox(origin, dir, b.min, b.max, length);
        if (d !== null && d < length - 0.25) return false;
      }
    return true;
  }
  visibleUnit(e) {
    if (e.safe || e.gone || e.deployed === false || !e.root.visible) return false;
    const center = this.center(e),
      b = this.entityBounds(e),
      top = [center[0], b.max[1] - 0.12, center[2]];
    return this.lineClear(this.eye(), center, e) || this.lineClear(this.eye(), top, e);
  }
  fixedUpdate(dt) {
    if (!this.playing || this.failed) return;
    this.time += dt;
    if (!this.started) {
      this.started = true;
      this.sparks(add(this.player.position, [0, 1, -1]), 12);
      this.noise(0.3, 0.2, 2800);
    }
    for (const key of ['hurt', 'hit', 'flash', 'messageTime', 'scanBoot']) this[key] = Math.max(0, this[key] - dt);
    this.recoil = damp(this.recoil, 0, 18, dt);
    this.fireClock = Math.max(-0.05, this.fireClock - dt);
    const input = this.ctx.input,
      p = this.player;
    if (input.consume('scan')) this.toggleVision();
    if (input.consume('lock')) this.toggleLock();
    if (this.demo) {
      this.demoTarget = this.cars.find((c) => !c.disabled && !c.gone && c.root.visible) || null;
      p.position[0] = 0;
      p.position[2] = -0.45;
      p.motor.crouched = false;
      if (this.demoTarget) {
        const dir = norm(sub(this.weakPoint(this.demoTarget), this.eye()));
        p.yaw = Math.atan2(-dir[0], -dir[2]);
        p.pitch = Math.asin(clamp(dir[1], -1, 1));
      }
    } else {
      p.yaw = angleWrap(p.yaw + input.axis('lookLeft', 'lookRight') * dt * 1.3);
      p.pitch = clamp(p.pitch + input.axis('lookUp', 'lookDown') * dt * 0.95, -1.28, 1.08);
      p.motor.grounded = p.position[1] <= 8.001;
      p.motor.crouched = input.down('crouch');
      const delta = p.motor.update(
        dt,
        { x: input.axis('right', 'left'), z: input.axis('back', 'forward'), sprint: input.down('sprint'), jump: input.consume('jump') },
        p.yaw,
      );
      const nx = clamp(p.position[0] + delta.x, -13.4, 13.4),
        nz = clamp(p.position[2] + delta.z, -0.6, 10.6);
      // Prevent walking through the two cover blocks.
      const obstruct = (x, z) => [-8, 8].some((cx) => Math.abs(x - cx) < 1.58 && Math.abs(z - 1.8) < 0.61 && p.position[1] < 9.25);
      if (!obstruct(nx, p.position[2])) p.position[0] = nx;
      if (!obstruct(p.position[0], nz)) p.position[2] = nz;
      p.position[1] = Math.max(8, p.position[1] + delta.y);
      if (p.position[1] === 8 && p.motor.vy < 0) p.motor.vy = 0;
      p.phase += Math.hypot(delta.x, delta.z) * 3;
      this.assistAim(dt);
    }
    this.setCamera();
    this.target = this.traceTarget(this.aimRay());
    this.heldSafe = this.target.entity?.kind === 'human';
    this.updateVision(dt);
    this.beltTimer = Math.max(0, this.beltTimer - dt);
    if (this.beltTimer === 0 && this.ammo === 0) this.ammo = 1600;
    const trigger = this.demo ? this.time > 2 && !!this.demoTarget : input.down('fire');
    this.spin = damp(this.spin, trigger ? 1 : 0, trigger ? 6 : 2.8, dt);
    this.firing = trigger && this.spin > 0.7 && !this.overheated && !this.beltTimer && !this.heldSafe && this.phase !== 'intermission';
    if (this.firing) {
      this.heat = Math.min(100, this.heat + 12 * dt);
      if (this.fireClock <= 0) {
        this.fireClock += 1 / 24;
        this.shoot();
      }
      this.rumbleClock = (this.rumbleClock || 0) - dt;
      if (this.rumbleClock <= 0 && !this.demo) {
        this.rumbleClock = 0.11;
        this.ctx.rumble?.(0.22 + this.heat / 400, 90);
      }
    } else this.heat = Math.max(0, this.heat - 28 * dt);
    if (this.heat >= 100) this.overheated = true;
    if (this.overheated && this.heat < 34) this.overheated = false;
    this.warning = '';
    this.updateCars(dt);
    this.updateOfficers(dt);
    this.updateFX(dt);
    this.updateSound(dt);
    this.updateWaves(dt);
    this.inCover = this.player.motor.crouched || this.player.position[2] > 2.4;
    if (this.integrity <= 0) {
      this.integrity = 0;
      this.failed = true;
      this.phase = 'failed';
      this.firing = false;
      this.spin = 0;
      this.flash = 0;
      this.lockID = null;
      this.message = 'SYSTEM FAILURE';
      this.messageTime = 10;
      this.recordBest();
      this.ctx.rumble?.(1, 600);
    }
  }
  /** Police pressure for this run. The best score is kept per pressure level. */
  setPressure(key) {
    this.pressure = PRESSURE[key] ? key : 'standard';
    this.best = this.readBest();
    this.startBest = this.best.score;
  }
  bestKey() {
    return this.pressure === 'standard' ? 'cyberdyne.best' : `cyberdyne.best.${this.pressure}`;
  }
  /** Best run in this browser: highest score, and the wave it reached. */
  readBest() {
    const b = this.ctx.store?.get(this.bestKey(), null);
    return b && Number.isFinite(b.score) && Number.isFinite(b.wave) ? { score: b.score, wave: b.wave } : { score: 0, wave: 0 };
  }
  recordBest() {
    if (this.demo) return false;
    const best = this.readBest();
    if (this.score > best.score || this.wave > best.wave) {
      this.best = { score: Math.max(best.score, this.score), wave: Math.max(best.wave, this.wave) };
      this.ctx.store?.set(this.bestKey(), this.best);
    }
    // A run that beat the record it started against is a new best, even if an earlier wave already saved it.
    this.newBest = this.score > this.startBest;
    return this.newBest;
  }
  setCamera() {
    if (!this.playing) return;
    this.cameraMode = 1;
    const eye = this.eye();
    this.camera.position = eye;
    this.camera.target = add(eye, mul(cameraDirection(this.player.yaw, this.player.pitch), 45));
    this.camera.fov = this.ctx.input.down('aim') ? (this.scan ? 40 : 49) : this.document.player.fov;
  }
  toggleVision() {
    this.scan = !this.scan;
    this.scanBoot = this.scan ? 0.35 : 0;
    this.lockID = null;
    this.focusID = null;
    this.focusTime = 0;
    this.scene.environment.vision = this.scan;
    this.ctx.audio.tone(this.scan ? 720 : 390, 0.11, 'triangle', 0.09, this.scan ? 1200 : 190);
  }
  updateVision(dt) {
    this.focus = this.target?.entity || null;
    if (!this.scan) return;
    const id = this.focus?.data.id || null;
    if (id !== this.focusID) {
      this.focusID = id;
      this.focusTime = 0;
    }
    if (id && !this.scanBoot) {
      this.focusTime = Math.min(0.65, this.focusTime + dt);
      if (this.focusTime >= 0.65 && !this.identified.has(id)) {
        this.identified.add(id);
        this.ctx.audio.tone(1000, 0.04, 'sine', 0.04, 1300);
      }
    }
    const lock = this.lockID && this.entities.get(this.lockID);
    if (this.lockID && (!lock || lock.disabled || lock.gone || !this.visibleUnit(lock))) this.lockID = null;
  }
  label(action) {
    return this.ctx.input.label?.(action) ?? action.toUpperCase();
  }
  toggleLock() {
    if (!this.scan) {
      this.message = `Press ${this.label('scan')} to start T-800 vision.`;
      this.messageTime = 2;
      return;
    }
    if (this.lockID) {
      this.lockID = null;
      return;
    }
    const e = this.focus;
    if (e?.kind === 'vehicle' && !e.disabled && this.identified.has(e.data.id) && this.visibleUnit(e)) {
      this.lockID = e.data.id;
      this.message = `TARGET LOCKED / HOLD ${this.label('aim')} TO ASSIST AIM`;
      this.ctx.rumble?.(0.2, 60);
    } else this.message = e?.kind === 'human' ? 'HUMAN / TARGET LOCK BLOCKED' : 'Keep a vehicle in the reticle until the scan is complete.';
    this.messageTime = 3;
  }
  assistAim(dt) {
    if (!this.scan || !this.lockID || !this.ctx.input.down('aim')) return;
    const e = this.entities.get(this.lockID);
    if (!e || e.disabled || !this.visibleUnit(e)) {
      this.lockID = null;
      return;
    }
    const d = norm(sub(this.weakPoint(e), this.eye())),
      yaw = Math.atan2(-d[0], -d[2]),
      pitch = Math.asin(clamp(d[1], -1, 1));
    this.player.yaw = angleWrap(this.player.yaw + angleWrap(yaw - this.player.yaw) * (1 - Math.exp(-10 * dt)));
    this.player.pitch = damp(this.player.pitch, pitch, 10, dt);
  }
  worldMuzzle() {
    const ray = this.aimRay(),
      right = [Math.cos(this.player.yaw), 0, -Math.sin(this.player.yaw)];
    return add(ray.origin, add(mul(ray.dir, 1.3), add(mul(right, 0.38), [0, -0.4, 0])));
  }
  shoot() {
    if (this.heldSafe || this.ammo <= 0 || this.failed || !this.target) return;
    this.ammo--;
    this.shots++;
    this.flash = 0.045;
    this.recoil = 0.055;
    this.state.stats.shots++;
    if (!this.ammo) this.beltTimer = 2.4;
    const t = this.target,
      e = t.entity;
    this.tracer(this.worldMuzzle(), t.point, '#ffdf9a', 0.052, 0.027);
    if (e?.kind === 'vehicle' && !e.disabled) {
      const ray = this.aimRay(),
        module = this.weakPoint(e),
        along = dot(sub(module, ray.origin), ray.dir);
      const weak = along > 0 && distance(add(ray.origin, mul(ray.dir, along)), module) < VEHICLES[e.vehicleType].radius;
      const damage = 4.6 * (weak ? 2.35 : 1);
      e.hp = Math.max(0, e.hp - damage);
      this.hit = 0.12;
      this.hits++;
      this.state.stats.hits++;
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
      if (o.fear > OFFICERS[o.officerType].resistance * (1 + this.wave * 0.025)) {
        o.mode = 'run';
        o.charge = 0;
      }
    }
    if (this.shots % 2 === 0) {
      const m = this.scene.mesh('box', add(this.eye(), [0.5, -0.6, 0]), [0.045, 0.04, 0.14], '#c1a66b', [0, this.rng() * 360, 25], {
        castShadow: false,
      });
      this.effects.push({ m, life: 1.3, total: 1.3, v: [1.8 + this.rng() * 2.4, 1.0 + this.rng(), this.rng() * 1.8], gravity: 9 });
      this.shotSound();
    }
  }
  applyDamageLook(e) {
    for (const p of e.model.panels || []) p.color = '#2a333c';
    for (const g of e.model.glass || []) g.visible = false;
    e.model.red.color = '#371b26';
    e.model.blue.color = '#182e40';
    for (const l of e.model.lamps || []) l.color = '#293746';
    for (const m of e.model.rider || []) m.visible = false;
    if (e.vehicleType === 'motorcycle') {
      // A disabled motorcycle lies on its side.
      e.root.rotation[2] = 74;
      e.root.position[1] = 0.12;
    } else if (e.vehicleType !== 'helicopter') {
      e.root.rotation[2] = 3;
      e.model.body.scale[1] *= 0.78;
    }
  }
  disable(e, silent = false) {
    if (e.disabled) return;
    e.disabled = true;
    e.hp = 0;
    e.fireTime = 0.01;
    this.applyDamageLook(e);
    this.totalVehicles++;
    this.score += VEHICLES[e.vehicleType].points + this.wave * 15;
    if (e.vehicleType === 'helicopter') {
      e.escaping = true;
      e.arrived = true;
    }
    for (const o of this.officers)
      if (o.vehicle === e.data.id) {
        o.fear = 3;
        o.mode = 'run';
        o.charge = 0;
        if (!o.deployed) this.deployOfficer(o, e);
      }
    if (this.lockID === e.data.id) this.lockID = null;
    if (silent) return;
    this.sparks(this.weakPoint(e), 22);
    for (let i = 0; i < 8; i++) this.puff(this.weakPoint(e), true);
    this.message = VEHICLES[e.vehicleType].name + (e.escaping ? ' withdrawing.' : ' disabled.');
    this.messageTime = 2.1;
    if (!this.demo) this.ctx.rumble?.(0.75, 240);
    this.ctx.audio.tone(66, 0.48, 'sawtooth', 0.26, 22);
    this.noise(0.55, 0.45, 250);
  }
  deployOfficer(o, car) {
    const side = o.slot % 2 ? 1 : -1,
      p = car.root.position;
    o.deployed = true;
    o.root.visible = true;
    o.root.position = [clamp(p[0] + side * (1.95 + o.slot * 0.25), -23, 23), 0.08, p[2] + 1.5];
    o.baseY = 0.08;
  }
  updateCars(dt) {
    for (const c of this.cars) {
      const spec = VEHICLES[c.vehicleType],
        p = c.root.position;
      if (c.arrival > 0) {
        c.arrival = Math.max(0, c.arrival - dt);
        c.root.visible = c.arrival === 0;
        continue;
      }
      c.root.visible = !c.gone;
      if (spec.air) {
        c.flightClock += dt;
        c.model.rotor.rotation[1] = this.time * 1700;
        c.model.rotor2.rotation[1] = this.time * 1700;
        if (c.escaping) {
          p[0] += (c.orbit ? 1 : -1) * dt * 7;
          p[1] += dt * 5;
          p[2] -= dt * 8;
          if (p[1] > 68) {
            c.gone = true;
            c.root.visible = false;
          }
        } else {
          const a = c.flightClock * 0.15 + c.orbit * 2.8;
          p[0] = Math.sin(a) * 23;
          p[1] = 16 + Math.sin(a * 0.7) * 3;
          p[2] = -35 + Math.cos(a) * 9;
          c.root.rotation[1] = Math.atan2(-this.player.position[0] + p[0], -this.player.position[2] + p[2]) / rad;
          c.arrived = true;
        }
      } else if (!c.arrived && !c.disabled && c.destination) {
        const v = sub(c.destination, p),
          l = Math.hypot(...v),
          travel = spec.speed * dt;
        if (l <= travel) {
          c.root.position = [...c.destination];
          c.arrived = true;
          c.root.rotation[1] = 180 + ((c.index % 3) - 1) * 12;
          if (spec.weave) c.root.rotation[2] = 0;
          for (const m of c.model.rider || []) m.visible = false;
          for (const o of this.officers) if (o.vehicle === c.data.id && !o.deployed) this.deployOfficer(o, c);
        } else {
          c.root.position = add(p, mul(v, travel / l));
          c.root.rotation[1] = Math.atan2(-v[0], -v[2]) / rad;
          if (spec.weave && l > 6) {
            // Motorcycles weave on the approach, which makes them harder to track.
            const w = Math.sin(this.time * 2.6 + c.index * 1.7) * spec.weave * dt;
            c.root.position[0] += (v[2] / l) * w;
            c.root.position[2] -= (v[0] / l) * w;
            c.root.rotation[2] = Math.sin(this.time * 2.6 + c.index * 1.7) * 14;
          } else if (spec.weave) c.root.rotation[2] = 0;
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
        if (c.smokeClock <= 0) {
          c.smokeClock = c.fireTime > 7 ? 0.55 : 0.2;
          this.puff(this.weakPoint(c), c.fireTime < 3.8);
        }
      }
    }
    const selected = [...this.cars.filter((c) => !c.disabled && c.root.visible), ...this.cars.filter((c) => c.disabled && !c.gone)].slice(0, 6),
      lights = this.scene.pointLights;
    for (let i = 0; i < 6; i++) {
      const c = selected[i];
      lights[i] = c
        ? {
            position: add(c.root.position, [0, 2.6, 0]),
            color: c.disabled ? [1.6, 0.45, 0.1] : Math.sin(this.time * 10 + c.index * 1.8) > 0 ? [2.2, 0.11, 0.18] : [0.08, 0.65, 2.4],
            radius: c.vehicleType === 'helicopter' ? 19 : 12,
          }
        : { position: [0, 0, 0], color: [0, 0, 0], radius: 1 };
    }
    lights[6] = { position: this.worldMuzzle(), color: this.flash > 0 ? [3.1, 1.6, 0.55] : [0, 0, 0], radius: 12 };
    lights[7] = { position: [0, 10, 5], color: [0.45, 0.72, 1.0], radius: 18 };
  }
  updateOfficers(dt) {
    const airBonus = this.cars.some((c) => c.vehicleType === 'helicopter' && !c.disabled) ? 1.2 : 1;
    for (const o of this.officers) {
      if (o.safe || !o.deployed) continue;
      const p = o.root.position,
        spec = OFFICERS[o.officerType];
      if (o.mode === 'run') {
        o.charge = 0;
        o.runPhase += dt * 12;
        const dx = (o.index % 2 ? 31 : -31) - p[0],
          dz = -65 - p[2],
          l = Math.hypot(dx, dz);
        if (l < 2) {
          o.safe = true;
          o.mode = 'safe';
          o.root.visible = false;
          this.totalSafe++;
          this.score += 25;
          continue;
        }
        p[0] += (dx / l) * 6.3 * dt;
        p[2] += (dz / l) * 6.3 * dt;
        p[1] = 0.08;
        o.root.rotation[1] = Math.atan2(-dx, -dz) / rad;
        for (const limb of o.model.legs) {
          limb.leg.rotation[0] = Math.sin(o.runPhase + (limb.side * Math.PI) / 2) * 33;
          limb.foot.position[2] = -0.09 + Math.sin(o.runPhase + (limb.side * Math.PI) / 2) * 0.2;
        }
        continue;
      }
      const toward = sub(this.eye(), add(p, [0, 1.6, 0]));
      o.root.rotation[1] = Math.atan2(-toward[0], -toward[2]) / rad;
      if (spec.advance && p[2] < -8 && this.phase === 'wave') {
        p[2] += spec.advance * dt;
        const tx = clamp(this.player.position[0] + (o.index % 2 ? 4 : -4), -20, 20);
        p[0] += Math.sign(tx - p[0]) * Math.min(Math.abs(tx - p[0]), dt * 0.35);
        o.runPhase += dt * 7;
        for (const leg of o.model.legs) leg.leg.rotation[0] = Math.sin(o.runPhase + leg.side) * 18;
      }
      o.fear = Math.max(0, o.fear - dt * 0.018);
      o.cooldown -= dt;
      const eye = add(p, [0, 1.75, 0]),
        canSee = this.lineClear(eye, this.eye(), this.entities.get(o.vehicle));
      if (!canSee || this.phase === 'intermission') {
        o.charge = 0;
        continue;
      }
      if (o.cooldown <= 0 && this.time > 4) {
        o.charge += dt;
        if (o.officerType === 'marksman') {
          this.warning = 'MARKSMAN AIMING / MOVE TO COVER';
          if (Math.floor(this.time * 15) % 3 === 0) this.tracer(eye, this.eye(), '#e43d42', 0.045, 0.012);
        }
        if (o.charge >= spec.charge) {
          o.charge = 0;
          const pressure = PRESSURE[this.pressure] || PRESSURE.standard;
          o.cooldown = (spec.interval + this.rng() * 1.2) / ((this.currentPlan?.rateScale || 1) * pressure.rate);
          const end = add(this.eye(), [(this.rng() - 0.5) * 1.2, (this.rng() - 0.5) * 0.5, 0]);
          this.tracer(eye, end, '#afc4d7', 0.07, 0.016);
          this.sparks(end, 2);
          const protection = this.player.motor.crouched ? 0.23 : 1;
          if (!this.demo && this.rng() < spec.accuracy * protection) {
            this.integrity = Math.max(0, this.integrity - spec.damage * (this.currentPlan?.damageScale || 1) * pressure.damage * airBonus);
            this.hurt = 0.24;
            this.ctx.rumble?.(o.officerType === 'marksman' ? 0.85 : 0.45, o.officerType === 'marksman' ? 260 : 140);
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
        o.fear = 3;
        o.mode = 'run';
        o.charge = 0;
        const car = this.entities.get(o.vehicle);
        if (!o.deployed && car) this.deployOfficer(o, car);
      }
    if (!this.officers.every((o) => o.safe)) return;
    this.winDelay += dt;
    if (this.winDelay < 1.2) return;
    if (this.wave === 0) {
      this.sceneComplete = true;
      this.state.story.cyberdyneCleared = true;
    } else {
      this.wavesCleared = this.wave;
      this.score += this.wave * 150;
    }
    this.phase = 'intermission';
    this.winDelay = 0;
    this.intermission = wavePlan(this.wave + 1).breakTime;
    this.integrity = Math.min(100, this.integrity + 28);
    this.ammo = 1600;
    this.beltTimer = 0;
    this.heat = 0;
    this.overheated = false;
    this.message = this.wave === 0 ? 'SCENE COMPLETE / NO CASUALTIES' : 'WAVE ' + this.wave + ' CLEAR / SYSTEM REPAIR +28%';
    this.messageTime = 4;
    this.ctx.audio.tone(460, 0.35, 'triangle', 0.16, 860);
    if (!this.demo) {
      this.recordBest();
      // Every cleared wave is a checkpoint: Continue on the title screen resumes here.
      this.ctx.checkpoint?.();
    }
  }
  clearRoster() {
    for (const e of [...this.cars, ...this.officers]) {
      for (const mesh of e.root.children) this.scene.remove(mesh);
      this.entities.delete(e.data.id);
    }
    for (const fx of this.effects) this.scene.remove(fx.m);
    this.effects = [];
    this.cars = [];
    this.officers = [];
    this.rosterVersion++;
    this.focus = null;
    this.focusID = null;
    this.focusTime = 0;
    this.lockID = null;
    this.identified.clear();
    this.target = null;
    this.demoTarget = null;
  }
  startWave(number) {
    const plan = wavePlan(number);
    this.clearRoster();
    this.wave = number;
    this.currentPlan = plan;
    this.phase = 'wave';
    this.intermission = 0;
    this.winDelay = 0;
    this.heli.root.visible = false;
    let ground = 0,
      air = 0,
      bike = 0;
    plan.types.forEach((type, index) => {
      const spec = VEHICLES[type],
        isAir = !!spec.air;
      let end, start;
      if (isAir) {
        end = [-22 + air * 44, 17, -33];
        start = [...end];
        air++;
      } else if (type === 'motorcycle') {
        // Motorcycle units flank the car line along the kerbs.
        const side = bike % 2 ? 1 : -1,
          row = Math.floor(bike / 2);
        end = [side * (18.5 - row * 1.5), 0.08, -8 - row * 13];
        start = [side * 52, 0.08, end[2] - 4];
        bike++;
      } else {
        const col = ground % 4,
          row = Math.floor(ground / 4);
        end = [-15 + col * 10, 0.08, -15 - row * 13];
        start = [index % 2 ? 52 : -52, 0.08, end[2] - 8];
        ground++;
      }
      const id = `wave-${number}-vehicle-${index}`;
      const data = {
        id,
        name: spec.name,
        prefab: 'policecar',
        position: start,
        rotation: [0, 180, 0],
        scale: [1, 1, 1],
        color: '#c4d0d5',
        components: [{ type: 'vehicle', health: spec.hp }],
      };
      const car = this.spawnVehicle(data, type, { hp: spec.hp * plan.healthScale, destination: end, arrival: index * 0.65, orbit: air - 1 });
      car.root.visible = car.arrival === 0;
      const crew = [...spec.crew];
      if (number >= 4 && index % 3 === 1 && crew.length) crew[crew.length - 1] = 'marksman';
      crew.forEach((unit, j) => {
        const od = {
          id: `${id}-officer-${j}`,
          name: OFFICERS[unit].name,
          prefab: 'officer',
          position: [...end],
          rotation: [0, 180, 0],
          scale: [1, 1, 1],
          color: '#21334d',
          components: [{ type: 'human', vehicle: id }],
        };
        this.spawnOfficer(od, unit, { deployed: false, slot: j });
      });
    });
    this.message = 'WAVE ' + number + ' / ' + plan.name.toUpperCase();
    this.messageTime = 4.5;
    this.ctx.notify(plan.notice);
  }
  tracer(a, b, color, life = 0.07, width = 0.023) {
    const g = this.scene.group(),
      m = rod(this.scene, g, a, b, width, color, { unlit: true, castShadow: false });
    this.effects.push({ m, life, total: life });
  }
  sparks(p, n = 8) {
    for (let i = 0; i < n; i++) {
      const m = this.scene.mesh(
        'box',
        p,
        [0.024, 0.024, 0.1 + this.rng() * 0.13],
        i % 3 ? '#ffbd67' : '#fff2b0',
        [this.rng() * 180, this.rng() * 180, 0],
        { unlit: true, castShadow: false },
      );
      this.effects.push({
        m,
        life: 0.2 + this.rng() * 0.5,
        total: 0.7,
        v: [(this.rng() - 0.5) * 9, 1 + this.rng() * 6, (this.rng() - 0.5) * 9],
        gravity: 8,
      });
    }
  }
  puff(p, flame = false) {
    const life = flame ? 0.3 + this.rng() * 0.5 : 2.2 + this.rng() * 1.8,
      sz = flame ? 0.25 + this.rng() * 0.45 : 0.35 + this.rng() * 0.35;
    const m = this.scene.mesh('sphere', p, [sz, sz, sz], flame ? (this.rng() > 0.4 ? '#ffad43' : '#db5122') : '#405365', [0, 0, 0], {
      unlit: flame,
      alpha: flame ? 0.82 : 0.48,
      castShadow: false,
    });
    this.effects.push({
      m,
      life,
      total: life,
      v: [0.3 + this.rng() * 0.8, flame ? 1.5 : 2.0 + this.rng(), (this.rng() - 0.5) * 0.6],
      grow: flame ? 0.8 : 1.2,
      fade: true,
    });
  }
  updateFX(dt) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.life -= dt;
      if (e.life <= 0) {
        this.scene.remove(e.m);
        this.effects.splice(i, 1);
        continue;
      }
      if (e.v) {
        e.m.position = add(e.m.position, mul(e.v, dt));
        if (e.gravity) e.v[1] -= e.gravity * dt;
      }
      if (e.grow) e.m.scale = e.m.scale.map((v) => v + e.grow * dt);
      if (e.fade) e.m.alpha = Math.min(0.65, (e.life / e.total) * 0.65);
    }
    while (this.effects.length > 260) this.scene.remove(this.effects.shift().m);
  }
  update(dt) {
    if (!this.hero) return;
    if (!this.playing) {
      this.gun.root.position = [0.52, 9.3, 0.4];
      return;
    }
    this.cameraMode = 1;
    this.setCamera();
    this.hero.root.visible = false;
    this.gun.root.position = [0.3, -0.4 + this.recoil, -0.83];
    this.gun.root.rotation = [-3, 0, -5];
    this.gun.root.scale = [0.5, 0.5, 0.5];
    for (const m of this.gun.root.children) {
      m.viewmodel = true;
      m.castShadow = false;
    }
    this.gun.root.visible = !this.failed;
    const angle = this.time * 65 * this.spin;
    for (const b of this.gun.barrels) {
      b.m.position[0] = b.tip.position[0] = Math.cos(b.a + angle) * 0.168;
      b.m.position[1] = b.tip.position[1] = Math.sin(b.a + angle) * 0.168;
    }
    for (const m of [this.gun.flash, this.gun.core, ...this.gun.spikes]) m.visible = this.flash > 0 && !this.failed;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 731);
    this.gun.flash.scale = [0.23 + pulse * 0.15, 0.2 + pulse * 0.1, 0.4 + pulse * 0.5];
    this.gun.spikes.forEach((m, i) => (m.rotation[2] = i * 72 + this.time * 1500));
    const h = this.heli;
    h.root.visible = this.wave === 0;
    h.root.position = [Math.sin(this.time * 0.075 - 0.6) * 31, 25 + Math.sin(this.time * 0.18) * 2, -49 + Math.cos(this.time * 0.075) * 11];
    h.root.rotation = [0, -30 + Math.sin(this.time * 0.08) * 50, -4];
    h.rotor.rotation[1] = h.rotor2.rotation[1] = this.time * 1700;
    this.scene.environment.vision = this.scan;
  }
  noise(duration = 0.09, volume = 0.2, freq = 650) {
    const a = this.ctx.audio,
      c = a.context;
    if (!c || c.state !== 'running') return;
    if (!this.noiseBuffer) {
      this.noiseBuffer = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const b = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < b.length; i++) b[i] = Math.random() * 2 - 1;
    }
    const src = c.createBufferSource(),
      filter = c.createBiquadFilter(),
      g = c.createGain();
    src.buffer = this.noiseBuffer;
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    g.gain.setValueAtTime(volume, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
    src.connect(filter);
    filter.connect(g);
    g.connect(a.gain);
    a.nodes.add(src);
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      g.disconnect();
      a.nodes.delete(src);
    };
    src.start(0, Math.random());
    src.stop(c.currentTime + duration);
  }
  shotSound() {
    this.noise(0.12, 0.65, 1400);
    this.ctx.audio.tone(90, 0.07, 'sawtooth', 0.19, 35);
  }
  updateSound(dt) {
    const a = this.ctx.audio,
      c = a.context;
    if (!c || c.state !== 'running') return;
    if (!this.siren) {
      const osc = c.createOscillator(),
        gain = c.createGain();
      osc.type = 'sine';
      osc.connect(gain);
      gain.connect(a.gain);
      gain.gain.value = 0.035;
      osc.start();
      this.audioNodes.push(osc, gain);
      this.siren = { osc, gain };
      const motor = c.createOscillator(),
        mg = c.createGain();
      motor.type = 'sawtooth';
      motor.connect(mg);
      mg.connect(a.gain);
      mg.gain.value = 0;
      motor.start();
      this.audioNodes.push(motor, mg);
      this.motorSound = { osc: motor, gain: mg };
    }
    const live = this.cars.filter((x) => !x.disabled).length / Math.max(1, this.cars.length);
    this.siren.osc.frequency.setTargetAtTime(520 + Math.sin(this.time * 2.3) * 220, c.currentTime, 0.05);
    this.siren.gain.gain.setTargetAtTime(0.045 * live, c.currentTime, 0.1);
    this.motorSound.osc.frequency.setTargetAtTime(38 + this.spin * 100, c.currentTime, 0.025);
    this.motorSound.gain.gain.setTargetAtTime(this.spin * 0.05, c.currentTime, 0.03);
  }
  hud() {
    return null;
  }
  exportState() {
    const d = validateHandoff(this.state);
    d.extensions.cyberdyne = {
      version: 2,
      shots: this.shots,
      vehiclesDisabled: this.totalVehicles,
      peopleSafe: this.totalSafe,
      casualties: 0,
      wave: this.wave,
      wavesCleared: this.wavesCleared,
      score: this.score,
      sceneComplete: this.sceneComplete,
      pressure: this.pressure,
    };
    return d;
  }
  saveLocal() {
    return jsonData(
      {
        version: 2,
        time: this.time,
        player: { position: [...this.player.position], yaw: this.player.yaw, pitch: this.player.pitch },
        integrity: this.integrity,
        ammo: this.ammo,
        shots: this.shots,
        hits: this.hits,
        heat: this.heat,
        overheated: this.overheated,
        beltTimer: this.beltTimer,
        phase: this.phase,
        wave: this.wave,
        wavesCleared: this.wavesCleared,
        sceneComplete: this.sceneComplete,
        failed: this.failed,
        intermission: this.intermission,
        winDelay: this.winDelay,
        score: this.score,
        totalVehicles: this.totalVehicles,
        totalSafe: this.totalSafe,
        scan: this.scan,
        identified: [...this.identified],
        lockID: this.lockID,
        unitSerial: this.unitSerial,
        rngState: this.rngState,
        criticalHits: this.criticalHits,
        pressure: this.pressure,
        cars: this.cars.map((c) => ({
          data: c.data,
          type: c.vehicleType,
          position: [...c.root.position],
          rotation: [...c.root.rotation],
          hp: c.hp,
          maxHP: c.maxHP,
          disabled: c.disabled,
          fireTime: c.fireTime,
          arrival: c.arrival,
          arrived: c.arrived,
          destination: c.destination,
          orbit: c.orbit,
          flightClock: c.flightClock,
          escaping: c.escaping,
          gone: c.gone,
          index: c.index,
        })),
        officers: this.officers.map((o) => ({
          data: o.data,
          type: o.officerType,
          position: [...o.root.position],
          rotation: [...o.root.rotation],
          mode: o.mode,
          safe: o.safe,
          fear: o.fear,
          deployed: o.deployed,
          slot: o.slot,
          baseY: o.baseY,
          cooldown: o.cooldown,
          charge: o.charge,
          runPhase: o.runPhase,
          index: o.index,
        })),
      },
      1024 * 1024,
    );
  }
  restoreLocal(raw) {
    const d = jsonData(raw, 1024 * 1024);
    if (d.version === 1) {
      this.restoreLegacy(d);
      return;
    }
    const vector = (v) => Array.isArray(v) && v.length === 3 && v.every((x) => finite(x));
    const nonnegative = (v) => finite(v, 1e12) && v >= 0;
    if (
      d.version !== 2 ||
      !vector(d.player?.position) ||
      !finite(d.player.yaw) ||
      !finite(d.player.pitch) ||
      !Number.isSafeInteger(d.wave) ||
      d.wave < 0 ||
      d.wave > 1000000 ||
      !['scene', 'wave', 'intermission', 'failed'].includes(d.phase)
    )
      throw Error('Invalid wave checkpoint.');
    for (const k of [
      'time',
      'integrity',
      'ammo',
      'shots',
      'hits',
      'heat',
      'beltTimer',
      'intermission',
      'winDelay',
      'score',
      'totalVehicles',
      'totalSafe',
      'wavesCleared',
      'unitSerial',
      'rngState',
      'criticalHits',
    ])
      if (!nonnegative(d[k])) throw Error('Invalid saved value: ' + k);
    if (
      d.integrity > 100 ||
      d.ammo > 1600 ||
      d.heat > 100 ||
      !Array.isArray(d.cars) ||
      d.cars.length > 75 ||
      !Array.isArray(d.officers) ||
      d.officers.length > 160
    )
      throw Error('Invalid checkpoint limits.');
    const ids = new Set();
    for (const u of [...d.cars, ...d.officers]) {
      if (
        !u.data ||
        typeof u.data.id !== 'string' ||
        ids.has(u.data.id) ||
        !vector(u.position) ||
        !vector(u.rotation) ||
        !vector(u.data.scale) ||
        u.data.scale.some((v) => v < 0.01 || v > 100) ||
        !Array.isArray(u.data.components)
      )
        throw Error('Invalid saved unit.');
      if (this.entities.has(u.data.id) && !['vehicle', 'human'].includes(this.entities.get(u.data.id).kind))
        throw Error('Saved unit ID conflicts with the level.');
      ids.add(u.data.id);
    }
    for (const k of ['scan', 'overheated', 'sceneComplete', 'failed']) if (typeof d[k] !== 'boolean') throw Error('Invalid saved flag.');
    if (d.pressure !== undefined && !Object.hasOwn(PRESSURE, d.pressure)) throw Error('Invalid saved pressure.');
    if (!Array.isArray(d.identified) || !d.identified.every((x) => typeof x === 'string') || (d.lockID !== null && typeof d.lockID !== 'string'))
      throw Error('Invalid saved vision data.');
    for (const c of d.cars)
      for (const k of ['disabled', 'arrived', 'escaping', 'gone']) if (typeof c[k] !== 'boolean') throw Error('Invalid saved vehicle flag.');
    for (const o of d.officers) for (const k of ['safe', 'deployed']) if (typeof o[k] !== 'boolean') throw Error('Invalid saved officer flag.');
    for (const c of d.cars)
      if (
        !VEHICLES[c.type] ||
        !nonnegative(c.hp) ||
        !nonnegative(c.maxHP) ||
        c.maxHP <= 0 ||
        c.hp > c.maxHP ||
        !nonnegative(c.arrival) ||
        !nonnegative(c.flightClock) ||
        !nonnegative(c.fireTime) ||
        !nonnegative(c.index) ||
        !finite(c.orbit) ||
        (c.destination !== null && !vector(c.destination))
      )
        throw Error('Invalid saved vehicle.');
    for (const o of d.officers)
      if (
        !OFFICERS[o.type] ||
        !['cover', 'run', 'safe'].includes(o.mode) ||
        !nonnegative(o.fear) ||
        !finite(o.cooldown, 1e12) ||
        !nonnegative(o.charge) ||
        !nonnegative(o.runPhase) ||
        !nonnegative(o.index) ||
        !nonnegative(o.slot) ||
        !finite(o.baseY)
      )
        throw Error('Invalid saved officer.');
    this.clearRoster();
    this.wave = d.wave;
    for (const c of d.cars) {
      const e = this.spawnVehicle(c.data, c.type, { hp: c.maxHP, destination: c.destination, arrival: c.arrival, orbit: c.orbit });
      for (const k of ['hp', 'maxHP', 'disabled', 'fireTime', 'arrival', 'arrived', 'flightClock', 'escaping', 'gone', 'index']) e[k] = c[k];
      e.root.position = [...c.position];
      e.root.rotation = [...c.rotation];
      e.root.visible = !e.gone && !e.arrival;
      if (e.arrived) for (const m of e.model.rider || []) m.visible = false;
      if (e.disabled) this.applyDamageLook(e);
    }
    for (const o of d.officers) {
      const e = this.spawnOfficer(o.data, o.type, { deployed: o.deployed, slot: o.slot });
      for (const k of ['mode', 'safe', 'fear', 'deployed', 'slot', 'baseY', 'cooldown', 'charge', 'runPhase', 'index']) e[k] = o[k];
      e.root.position = [...o.position];
      e.root.rotation = [...o.rotation];
      e.root.visible = e.deployed && !e.safe;
    }
    for (const k of [
      'time',
      'integrity',
      'ammo',
      'shots',
      'hits',
      'heat',
      'overheated',
      'beltTimer',
      'phase',
      'wave',
      'wavesCleared',
      'sceneComplete',
      'failed',
      'intermission',
      'winDelay',
      'score',
      'totalVehicles',
      'totalSafe',
      'scan',
      'unitSerial',
      'rngState',
      'criticalHits',
    ])
      this[k] = d[k];
    this.player.position = [...d.player.position];
    this.player.yaw = angleWrap(d.player.yaw);
    this.player.pitch = clamp(d.player.pitch, -1.28, 1.08);
    this.player.motor.reset();
    this.identified = new Set((d.identified || []).filter((id) => ids.has(id)));
    this.lockID = this.scan && d.cars.some((c) => c.data.id === d.lockID && !c.disabled) ? d.lockID : null;
    this.currentPlan = this.wave ? wavePlan(this.wave) : null;
    if (d.pressure !== undefined) this.setPressure(d.pressure);
    this.cameraMode = 1;
    this.started = true;
    this.scene.environment.vision = this.scan;
    this.setCamera();
  }
  restoreLegacy(d) {
    if (
      !Array.isArray(d.cars) ||
      d.cars.length !== this.cars.length ||
      !Array.isArray(d.officers) ||
      !Array.isArray(d.player?.position) ||
      d.player.position.length !== 3 ||
      !d.player.position.every((v) => finite(v)) ||
      !finite(d.player.yaw) ||
      !finite(d.player.pitch)
    )
      throw Error('The old checkpoint does not match this level.');
    for (const c of this.cars) {
      const v = d.cars.find((v) => v.id === c.data.id);
      if (!v || !finite(v.hp, 1000)) throw Error('Invalid saved vehicle.');
      c.hp = clamp(v.hp, 0, c.maxHP);
      if (v.disabled) this.disable(c, true);
    }
    for (const o of this.officers) {
      const v = d.officers.find((v) => v.id === o.data.id);
      if (!v || !Array.isArray(v.position) || v.position.length !== 3 || !v.position.every((x) => finite(x))) throw Error('Invalid saved officer.');
      o.root.position = [...v.position];
      o.mode = ['cover', 'run', 'safe'].includes(v.mode) ? v.mode : 'cover';
      o.safe = !!v.safe;
      o.fear = clamp(v.fear || 0, 0, 1);
      o.root.visible = !o.safe;
      if (o.safe) this.totalSafe++;
    }
    for (const k of ['time', 'integrity', 'ammo', 'shots', 'hits']) if (finite(d[k], 1e8)) this[k] = Math.max(0, d[k]);
    this.integrity = clamp(this.integrity, 0, 100);
    this.ammo = clamp(this.ammo, 0, 1600);
    Object.assign(this.player, d.player);
    this.cameraMode = 1;
    this.setCamera();
  }
  dispose() {
    for (const n of this.audioNodes || [])
      try {
        if (n.stop) n.stop();
        n.disconnect();
      } catch {}
    this.audioNodes = [];
    this.effects = [];
    this.entities?.clear();
  }
}
export function create() {
  return new Cyberdyne();
}
