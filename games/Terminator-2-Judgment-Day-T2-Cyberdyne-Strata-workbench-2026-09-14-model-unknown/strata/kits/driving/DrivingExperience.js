import { controls } from './Controls.js';
import { clamp, damp, random } from '../../core/numeric.js';
import { validateHandoff, jsonData } from '../../core/contracts.js';
import { mix } from '../../core/math3d.js';
const clock = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}.${Math.floor((t % 1) * 10)}`;
export const roadCenter = (s) => Math.sin(s * 0.01) * 7 + Math.sin(s * 0.026) * 2.3;
export const roadHeading = (s) => -Math.atan(roadCenter(s + 0.5) - roadCenter(s - 0.5));
export class DrivingExperience {
  constructor() {
    this.controls = controls;
    this.source = { version: 1, name: 'Switchback', length: 650, maxSpeed: 32, acceleration: 11, steering: 0.65 };
    this.time = 0;
    this.speed = 0;
    this.distance = 0;
    this.offset = 0;
    this.lateral = 0;
    this.health = 100;
    this.checkpoint = 0;
    this.hurt = 0;
    this.cameraMode = 0;
    this.completed = false;
  }
  validateDocument(raw) {
    const d = jsonData(raw);
    if (d.version !== 1 || typeof d.name !== 'string' || !d.name.trim() || d.name.length > 100) throw Error('Invalid driving document.');
    for (const [k, min, max] of [
      ['length', 200, 1200],
      ['maxSpeed', 10, 45],
      ['acceleration', 2, 25],
      ['steering', 0.15, 1.5],
    ])
      if (!Number.isFinite(d[k]) || d[k] < min || d[k] > max) throw Error(`${k} must be ${min} to ${max}.`);
    return { version: 1, name: d.name, length: d.length, maxSpeed: d.maxSpeed, acceleration: d.acceleration, steering: d.steering };
  }
  async mount(ctx, handoff) {
    this.ctx = ctx;
    this.state = validateHandoff(handoff);
    this.document = this.validateDocument(ctx.document || this.source);
    this.scene = ctx.scene;
    this.scene.environment = { sky: '#bbc8b5', fog: 0.009, sun: 1.25 };
    this.scene.shadowRadius = 45;
    this.playing = ctx.mode === 'play';
    const best = ctx.store?.get(`${ctx.manifest.id}.best`, null);
    this.best = best && Number.isFinite(best.seconds) && Number.isFinite(best.length) ? best : null;
    this.buildRoad();
    this.buildCar();
    if (ctx.local) this.restoreLocal(ctx.local);
    this.scene.camera = { position: [18, 16, 22], target: [0, 0, -12], fov: 52 };
    this.editor = {
      kind: 'driving',
      getDocument: () => structuredClone(this.document),
      validate: (d) => this.validateDocument(d),
      fields: [
        { key: 'length', label: 'Route length / m', min: 200, max: 1200, step: 50 },
        { key: 'maxSpeed', label: 'Top speed / m/s', min: 10, max: 45, step: 1 },
        { key: 'acceleration', label: 'Acceleration / m/s²', min: 2, max: 25, step: 1 },
        { key: 'steering', label: 'Steering response', min: 0.15, max: 1.5, step: 0.05 },
      ],
    };
    this.update(0, 1);
  }
  buildRoad() {
    const scene = this.scene,
      rng = random(40),
      length = this.document.length;
    scene.mesh('box', [0, -0.8, -length / 2], [600, 1, length + 300], '#9fae8b', [0, 0, 0], { castShadow: false });
    for (let s = 0; s <= length + 25; s += 4) {
      const x = roadCenter(s),
        yaw = (roadHeading(s) * 180) / Math.PI;
      scene.mesh('box', [x, -0.1, -s], [13.8, 0.18, 4.16], '#687d68', [0, yaw, 0], { castShadow: false });
      for (const side of [-1, 1]) {
        scene.mesh('box', [x + side * 7, 0.03, -s], [0.28, 0.16, 4.15], '#bdc59e', [0, yaw, 0]);
        if (s % 12 === 0) scene.mesh('box', [x + side * 7.7, 0.7, -s], [0.17, 1.4, 0.17], '#536e51');
      }
      if (s % 12 === 0) scene.mesh('box', [x, 0.005, -s], [0.12, 0.025, 2.4], '#d7d8ad', [0, yaw, 0], { castShadow: false });
    }
    for (let i = 0; i < 60; i++) {
      const s = rng() * length,
        side = i % 2 ? -1 : 1;
      scene.mesh(
        'rock',
        [roadCenter(s) + side * (15 + rng() * 65), 1, -s],
        [6 + rng() * 10, 5 + rng() * 14, 6 + rng() * 8],
        i % 3 ? '#839c77' : '#a9b490',
        [0, 0, 0],
        { background: true },
      );
      if (i % 3 === 0) {
        const x = roadCenter(s) + side * 12;
        scene.mesh('cylinder', [x, 1.5, -s], [0.2, 3, 0.2], '#756d51');
        scene.mesh('rock', [x, 4, -s], [2, 2.8, 2], '#728c60');
      }
    }
    this.gates = [0.25, 0.5, 0.75, 1].map((v) => length * v);
    for (const [i, s] of this.gates.entries()) {
      const x = roadCenter(s);
      for (const side of [-1, 1]) scene.mesh('box', [x + side * 7, 0, -s], [0.65, 6, 0.65], '#4f7056');
      scene.mesh('box', [x, 5.6, -s], [14.7, 0.55, 0.65], '#3d5b48');
      scene.label(i === 3 ? 'SIGNAL YARD  /  ARRIVAL' : `CHECKPOINT  /  0${i + 1}`, [x, 5.5, -s + 0.34], 9, 0.55, '#d8e9b5', '#344f3c');
    }
    this.obstacles = [0.16, 0.32, 0.47, 0.63, 0.78, 0.88].map((v, i) => ({
      distance: v * length,
      offset: [-2.8, 2.8, 0, -3, 3, -1.7][i],
      hit: false,
    }));
    for (const [i, o] of this.obstacles.entries()) {
      const x = roadCenter(o.distance) + o.offset;
      o.mesh = scene.mesh('box', [x, 0.55, -o.distance], [2.7, 1.1, 0.7], i % 2 ? '#d1ac78' : '#afba86');
      for (const side of [-0.85, 0.85]) scene.mesh('box', [x + side, 0.58, -o.distance + 0.36], [0.28, 0.95, 0.03], '#49644d');
    }
    scene.label('SWITCHBACK / NORTHBOUND', [0, 3.5, -4], 7, 0.6, '#e0e8bf', '#49674b');
  }
  buildCar() {
    const s = this.scene;
    this.car = s.group();
    const box = (p, sz, c) => s.part(this.car, 'box', p, sz, c);
    box([0, 0.65, 0], [1.9, 0.6, 3.9], '#b6ca8c');
    box([0, 1.18, 0.25], [1.65, 0.62, 1.9], '#46634d');
    box([0, 1.3, 1.23], [1.48, 0.33, 0.035], '#afc4ad');
    box([0, 1.3, -0.73], [1.48, 0.33, 0.035], '#afc4ad');
    box([0, 0.7, -1.97], [1.3, 0.12, 0.04], '#eedfb0');
    box([0, 0.65, 1.97], [1.4, 0.08, 0.035], '#c28c6b');
    this.wheels = [];
    for (const x of [-0.98, 0.98])
      for (const z of [-1.2, 1.2]) this.wheels.push(s.part(this.car, 'cylinder', [x, 0.38, z], [0.4, 0.2, 0.4], '#253b2d', [0, 0, 90]));
  }
  fixedUpdate(dt) {
    if (!this.playing || this.completed) return;
    this.time += dt;
    this.hurt = Math.max(0, this.hurt - dt);
    const input = this.ctx.input;
    if (input.consume('camera')) this.cameraMode = 1 - this.cameraMode;
    if (input.consume('reset')) this.reset();
    if (this.health <= 0) {
      this.speed = 0;
      return;
    }
    this.speed += input.axis('forward', 'back') * this.document.acceleration * dt;
    if (input.down('brake')) this.speed = damp(this.speed, 0, 4, dt);
    else this.speed *= Math.exp(-0.13 * dt);
    this.speed = clamp(this.speed, -8, this.document.maxSpeed);
    if (Math.abs(this.speed) < 0.04) this.speed = 0;
    const previous = this.distance;
    this.distance = clamp(this.distance + this.speed * dt, 0, this.document.length);
    this.lateral = damp(this.lateral, input.axis('right', 'left') * Math.abs(this.speed) * this.document.steering, 5, dt);
    this.offset += this.lateral * dt;
    if (Math.abs(this.offset) > 5.75) {
      this.offset = clamp(this.offset, -5.75, 5.75);
      this.lateral = 0;
      if (Math.abs(this.speed) > 5 && this.hurt === 0) this.damage(7);
      else if (Math.abs(this.speed) > 2) this.ctx.rumble?.(0.2, 60);
      this.speed *= Math.exp(-2 * dt);
    }
    for (const o of this.obstacles)
      if (
        !o.hit &&
        Math.max(previous, this.distance) >= o.distance - 2 &&
        Math.min(previous, this.distance) <= o.distance + 2 &&
        Math.abs(this.offset - o.offset) < 2.15
      ) {
        o.hit = true;
        this.damage(19);
        this.speed *= 0.3;
        o.mesh.rotation[2] = 20;
        this.ctx.audio.play('crash');
        this.ctx.rumble?.(0.85, 260);
      }
    for (const gate of this.gates)
      if (previous < gate && this.distance >= gate) {
        this.checkpoint = gate;
        this.ctx.audio.play('pickup');
        this.ctx.notify(gate === this.document.length ? 'Route complete. Loading the Signal Yard.' : 'Route checkpoint reached.');
      }
    if (this.distance >= this.document.length) {
      this.completed = true;
      this.state.story.escapeComplete = true;
      this.state.extensions['strata.driving'] = { health: this.health, seconds: Math.round(this.time) };
      // Best route time, kept in this browser per route length.
      const key = `${this.ctx.manifest.id}.best`,
        record = { length: this.document.length, seconds: this.time },
        previous = this.best && this.best.length === this.document.length ? this.best.seconds : null;
      if (previous === null || this.time < previous) {
        this.ctx.store?.set(key, record);
        this.best = record;
        this.ctx.notify(`New best route time: ${clock(this.time)}${previous === null ? '' : ` (was ${clock(previous)})`}.`);
        this.ctx.audio.play('best');
      } else this.ctx.notify(`Route time ${clock(this.time)}. Best ${clock(previous)}.`);
      this.ctx.requestExit('complete');
    }
  }
  damage(amount) {
    this.health = Math.max(0, this.health - amount);
    this.hurt = 0.7;
    this.ctx.audio.play('hurt');
    this.ctx.rumble?.(0.55, 180);
    if (!this.health) this.ctx.notify(`Vehicle disabled. Press ${this.ctx.input.label?.('reset') ?? 'R'} to restart at the route checkpoint.`);
  }
  reset() {
    this.distance = Math.max(0, this.checkpoint - 5);
    this.speed = 0;
    this.lateral = 0;
    this.offset = 0;
    this.health = 100;
    this.hurt = 0;
    this.ctx.input.clear();
  }
  update(dt) {
    const x = roadCenter(this.distance) + this.offset,
      z = -this.distance,
      yaw = roadHeading(this.distance);
    this.car.position = [x, 0, z];
    this.car.rotation = [0, (yaw * 180) / Math.PI - this.lateral * 1.3, -this.lateral * 0.35];
    for (const w of this.wheels) w.rotation[0] = this.distance * 100;
    this.scene.lightTarget = [x, 0, z];
    if (!this.playing) return;
    const pos = this.cameraMode ? [x, 1.7, z - 0.5] : [x + Math.sin(yaw) * 8, 4.4, z + Math.cos(yaw) * 8];
    const target = [roadCenter(this.distance + 12) + this.offset * 0.55, 1, -this.distance - 12];
    this.scene.camera.position = dt ? mix(this.scene.camera.position, pos, 1 - Math.exp(-8 * dt)) : pos;
    this.scene.camera.target = target;
    this.scene.camera.fov = 65 + Math.min(10, this.speed * 0.25);
  }
  hud() {
    return {
      kind: 'driving',
      health: this.health,
      speed: Math.round(Math.abs(this.speed) * 3.6),
      objective: 'Reach the Signal Yard.',
      detail: 'Steer around the barriers. Keep the vehicle on the road.',
      prompt: this.health <= 0 ? `${this.ctx.input.label?.('reset') ?? 'R'} / Restart at route checkpoint` : '',
      best: this.best && this.best.length === this.document.length ? clock(this.best.seconds) : '',
      distance: Math.round(this.distance),
      total: this.document.length,
      progress: this.distance / this.document.length,
      hurt: this.hurt,
      dead: this.health <= 0,
    };
  }
  exportState() {
    return validateHandoff(this.state);
  }
  saveLocal() {
    return {
      version: 1,
      distance: this.distance,
      offset: this.offset,
      speed: this.speed,
      health: this.health,
      checkpoint: this.checkpoint,
      time: this.time,
      hits: this.obstacles.map((o) => o.hit),
    };
  }
  restoreLocal(raw) {
    const d = jsonData(raw);
    if (d.version !== 1) throw Error('Unsupported driving checkpoint.');
    for (const [key, min, max] of [
      ['distance', 0, this.document.length],
      ['offset', -6, 6],
      ['speed', -8, 45],
      ['health', 0, 100],
      ['checkpoint', 0, this.document.length],
      ['time', 0, 1e9],
    ])
      if (!Number.isFinite(d[key]) || d[key] < min || d[key] > max) throw Error('Invalid driving checkpoint.');
    if (!Array.isArray(d.hits) || d.hits.length !== this.obstacles.length || !d.hits.every((v) => typeof v === 'boolean'))
      throw Error('Invalid obstacle state.');
    for (const k of ['distance', 'offset', 'speed', 'health', 'checkpoint', 'time']) this[k] = d[k];
    this.obstacles.forEach((o, i) => {
      o.hit = d.hits[i];
      if (o.hit) o.mesh.rotation[2] = 20;
    });
  }
  dispose() {
    this.obstacles = [];
    this.wheels = [];
  }
}
