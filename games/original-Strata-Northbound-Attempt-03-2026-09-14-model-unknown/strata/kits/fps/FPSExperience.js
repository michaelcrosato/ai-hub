import { controls } from './Controls.js';
import { Motor } from './Motor.js';
import { createPrefabs, palette } from './Prefabs.js';
import { validateLevel, builtinSchemas } from './Schema.js';
import { BoxWorld, characterBox, overlaps } from './Physics.js';
import { createVisual, buildGun } from './Visuals.js';
import { Weapons } from './Weapons.js';
import { Signals } from '../../core/events.js';
import { clamp, damp, random } from '../../core/numeric.js';
import { add, sub, mul, norm, length, mix, cameraDirection } from '../../core/math3d.js';
import { validateHandoff, jsonData } from '../../core/contracts.js';
const capital = (text) => text.charAt(0).toUpperCase() + text.slice(1);
/** 'access-card' → 'an access card'. */
const keyName = (id) => {
  const name = String(id || 'key').replace(/[-_]+/g, ' ');
  return `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`;
};
export class FPSExperience {
  constructor(data) {
    this.controls = controls;
    this.source = data;
    this.prefabs = createPrefabs();
    this.schemas = builtinSchemas();
    this.effects = [];
    this.time = 0;
    this.signals = new Signals();
    this.pendingSignals = [];
    this.held = null;
    this.hitMarker = 0;
    this.hurt = 0;
    this.deathTimer = 0;
    this.allCleared = false;
    this.idleStep = 0;
    this.target = null;
    this.prompt = '';
    this.enemyList = [];
    this.lamps = [];
  }
  /** The player is down (waiting to respawn). */
  get dead() {
    return !!this.state && this.state.player.health <= 0;
  }
  /** Mission settings from the level document, with the Foundry's original behaviour as defaults. */
  get mission() {
    return this.document.mission || {};
  }
  validateDocument(raw) {
    const d = validateLevel(raw, this.prefabs.ids, this.schemas);
    if (d.entities.some((e) => e.model)) throw Error('This box-physics kit does not load GLB models. Use a custom asset adapter.');
    return d;
  }
  async mount(ctx, handoff) {
    this.ctx = ctx;
    this.document = this.validateDocument(ctx.document || this.source);
    this.state = validateHandoff(handoff);
    this.rng = random(this.document.seed);
    this.scene = ctx.scene;
    this.scene.environment = {
      sky: this.document.environment.sky,
      fog: this.document.environment.fog,
      sun: this.document.environment.sun / 2.4,
    };
    this.world = new BoxWorld(this.document.player.gravity);
    this.entities = new Map();
    this.playing = ctx.mode === 'play';
    for (const d of this.document.entities) {
      const bp = this.prefabs.get(d.prefab).build(d),
        root = createVisual(this.scene, d, bp, this.playing),
        e = this.world.add(d, bp, root);
      this.entities.set(d.id, e);
      const enemy = d.components.find((c) => c.type === 'enemy');
      e.state = {
        health: enemy?.health ?? 78,
        active: false,
        collected: false,
        inside: false,
        fired: false,
        count: 0,
        sources: [],
        offset: 0,
        phase: 0,
        cooldown: 1.2,
        charge: 0,
      };
      for (const c of d.components) this.installSignals(e, c);
    }
    // The key light's shadow box covers the whole level (32 m around the origin fits the original
    // levels; the depot reaches 34).
    let reach = 0;
    for (const e of this.entities.values())
      for (const c of e.colliders) reach = Math.max(reach, Math.hypot(Math.max(-c.min[0], c.max[0]), Math.max(-c.min[2], c.max[2])));
    this.scene.shadowRadius = Math.min(60, Math.max(32, Math.ceil(reach)));
    // Mission notices: a line of text (and a chime) the first time a channel turns on.
    const announced = new Set();
    for (const [channel, notice] of Object.entries(this.mission.notices || {}))
      this.signals.on(channel, (sig) => {
        if (!sig.value || announced.has(channel) || !this.playing) return;
        announced.add(channel);
        ctx.notify(notice.text);
        ctx.audio.play(notice.sound || 'gate');
      });
    this.spawn = this.document.entities.find((e) => e.components.some((c) => c.type === 'spawn'));
    const c = this.spawn.components.find((c) => c.type === 'spawn');
    this.player = {
      position: [...this.spawn.position],
      previous: [...this.spawn.position],
      yaw: ((c.yaw || 0) * Math.PI) / 180,
      pitch: 0,
      height: 1.85,
      eye: 1.68,
      motor: new Motor({ ...this.document.player }),
      ground: null,
      phase: 0,
      checkpoint: { position: [...this.spawn.position], yaw: ((c.yaw || 0) * Math.PI) / 180 },
    };
    if (this.playing && !ctx.local && this.world.blocked(characterBox(add(this.player.position, [0, 0.005, 0]), 0.3, 1.85)))
      throw Error('The player start is inside a solid object. Move the start marker before testing.');
    this.weapons = new Weapons(
      this.state,
      (spec) => this.shoot(spec),
      (name) => ctx.audio.play(name),
      (strength, ms) => ctx.rumble?.(strength, ms),
    );
    this.enemyList = this.enemies();
    this.enemyTotal = this.enemyList.length;
    this.gun = buildGun(this.scene);
    this.gun.root.visible = this.playing;
    this.decorate();
    if (ctx.local) this.restoreLocal(ctx.local);
    this.scene.camera = this.playing
      ? { position: this.eyePosition(), target: add(this.eyePosition(), this.direction()), fov: this.document.player.fov }
      : { position: [31, 26, 35], target: [0, 1, 0], fov: 48 };
    this.updateTarget();
    this.update(0, 1);
  }
  decorate() {
    const s = this.scene;
    if (this.document.environment.backdrop) {
      s.mesh('box', [0, -2.5, 0], [240, 1, 240], '#8b9d85', [0, 0, 0], { castShadow: false });
      const rng = random(93);
      for (let i = 0; i < 22; i++) {
        const a = (i / 22) * Math.PI * 2,
          d = 55 + rng() * 45;
        s.mesh('rock', [Math.cos(a) * d, -1, Math.sin(a) * d], [8 + rng() * 10, 7 + rng() * 12, 8 + rng() * 13], '#889e87', [0, 0, 0], {
          background: true,
        });
      }
    }
    if (this.document.name.includes('Foundry')) {
      s.label('STRATA / FIELD SYSTEMS', [0, 3.4, -16.72], 7, 0.6, '#dbe6bf', '#344b3b');
      s.label('07', [-12.2, 2.75, -9.65], 1.8, 1.1, '#dddec0', '#506854', [0, 90, 0]);
      s.label('EXIT  >', [8, 1.8, -15.66], 3, 0.5, '#d6e6b8', '#314a39');
      // A label's plane sits half a unit along its local Z: this floor marking used to float 0.6 m up.
      s.label('KEEP CLEAR', [0, -0.465, 1], 4, 0.6, '#859568', '#c9c9a7', [-90, 0, 0]);
    }
    for (const l of this.document.labels || []) s.label(l.text, l.position, l.width, l.height, l.color, l.background, l.rotation);
  }
  installSignals(e, c) {
    const state = e.state,
      send = (channel, value = true) => this.signals.send(channel, value, e.data.id);
    if (c.type === 'door' || c.type === 'mover') this.signals.on(c.channel || 'gate', (s) => (state.active = s.value));
    if (c.type === 'counter')
      this.signals.on(c.channel || 'cell', (s) => {
        if (!s.value || state.fired || (c.unique !== false && state.sources.includes(s.source))) return;
        state.sources.push(s.source);
        state.count++;
        if (state.count >= (c.count ?? 2)) {
          state.fired = true;
          send(c.output || 'unlocked');
        }
      });
    if (c.type === 'logic')
      for (const channel of c.inputs || [])
        this.signals.on(channel, () => {
          const value =
            (c.inputs || []).length > 0 &&
            (c.mode === 'any' ? (c.inputs || []).some((x) => this.signals.values.get(x)) : (c.inputs || []).every((x) => this.signals.values.get(x)));
          if (value !== state.active) {
            state.active = value;
            send(c.output || 'result', value);
          }
        });
    if (c.type === 'lamp') {
      // Recolours the entity's lamp parts while its channel is on (floodlights, signals, cabinet lamps).
      const parts = e.root.children.filter((m) => m.lamp),
        off = c.off || parts[0]?.color || '#5e5c50',
        on = c.on || '#fff0bf';
      const paint = (value) => {
        for (const m of parts) m.color = value ? on : off;
      };
      paint(false);
      this.lamps.push({ channel: c.channel || 'power', paint });
      this.signals.on(c.channel || 'power', (s) => paint(!!s.value));
    }
    if (c.type === 'relay')
      this.signals.on(c.channel || 'in', (s) => {
        if ((c.delay || 0) === 0) send(c.output || 'out', s.value);
        else this.pendingSignals.push({ at: this.time + c.delay, channel: c.output || 'out', value: s.value, source: e.data.id });
      });
  }
  enemies() {
    return [...this.entities.values()].filter((e) => e.data.components.some((c) => c.type === 'enemy'));
  }
  aliveEnemies() {
    let n = 0;
    for (const e of this.enemyList) if (e.active && e.state.health > 0) n++;
    return n;
  }
  /** Sentry tuning from the player's difficulty setting (host settings). */
  get difficulty() {
    const d = { relaxed: { damage: 0.6, aim: 1.35 }, veteran: { damage: 1.45, aim: 0.8 } }[this.ctx.settings?.difficulty];
    return d || { damage: 1, aim: 1 };
  }
  eyePosition() {
    return add(this.player.position, [0, this.player.eye, 0]);
  }
  direction() {
    return cameraDirection(this.player.yaw, this.player.pitch);
  }
  beforeFrame() {
    if (!this.playing || this.state.player.health <= 0) return;
    const [dx, dy] = this.ctx.input.look(),
      s = this.ctx.settings;
    this.player.yaw -= dx * (s.sensitivity ?? this.document.player.sensitivity);
    this.player.pitch = clamp(this.player.pitch - dy * (s.sensitivity ?? this.document.player.sensitivity) * (s.invertY ? -1 : 1), -1.48, 1.48);
  }
  fixedUpdate(dt) {
    if (!this.playing) return;
    this.time += dt;
    this.hitMarker = Math.max(0, this.hitMarker - dt);
    this.hurt = Math.max(0, this.hurt - dt);
    if (this.pendingSignals.length) {
      let keep = 0;
      for (const task of this.pendingSignals) {
        if (task.at <= this.time) this.signals.send(task.channel, task.value, task.source);
        else this.pendingSignals[keep++] = task;
      }
      this.pendingSignals.length = keep;
    }
    this.signals.flush();
    for (const e of this.entities.values()) {
      e.delta = [0, 0, 0];
      if (e.active) this.moveMechanism(e, dt);
    }
    if (this.state.player.health <= 0) {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) this.respawn();
    } else {
      this.movePlayer(dt);
      this.updateTarget();
      if (this.ctx.input.consume('interact')) this.interact();
      // Hands full: the weapon stays down while an object is carried.
      this.weapons.update(dt, this.ctx.input, !this.held);
      if (this.ctx.input.consume('respawn')) this.respawn();
    }
    this.world.step(dt, this.held);
    for (const e of this.entities.values())
      if (e.active) {
        for (const c of e.data.components) {
          if (c.type === 'enemy') this.updateEnemy(e, c, dt);
          else this.updateBehavior(e, c, dt);
        }
      }
    this.signals.flush();
    if (this.enemyTotal && !this.allCleared && this.aliveEnemies() === 0) {
      const m = this.mission;
      this.allCleared = true;
      this.signals.send(m.clearSignal || 'gate', true, 'mission');
      this.state.story[m.clearFlag || 'foundryCleared'] = true;
      this.ctx.notify(m.clearMessage || 'All sentries disabled. The exit gate is open.');
      this.ctx.audio.play('gate');
    }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const fx = this.effects[i];
      fx.life -= dt;
      if (fx.velocity) {
        const p = fx.mesh.position;
        p[0] += fx.velocity[0] * dt;
        p[1] += fx.velocity[1] * dt;
        p[2] += fx.velocity[2] * dt;
        fx.velocity[1] -= 12 * dt;
      }
      if (fx.life <= 0) {
        this.scene.remove(fx.mesh);
        this.effects.splice(i, 1);
      }
    }
    this.updateTarget();
    // Touch shows Use and Throw only while they do something.
    this.ctx.input.context?.('use', !!this.target || !!this.held);
    this.ctx.input.context?.('throw', !!this.held);
  }
  movePlayer(dt) {
    const p = this.player,
      input = this.ctx.input;
    p.previous = [...p.position];
    const move = {
      x: input.axis('right', 'left'),
      z: input.axis('back', 'forward'),
      sprint: input.down('sprint'),
      crouch: input.down('crouch'),
      jump: input.consume('jump'),
    };
    if (move.crouch !== p.motor.crouched) {
      const h = move.crouch ? 1.15 : 1.85;
      if (move.crouch || !this.world.blocked(characterBox(add(p.position, [0, 0.015, 0]), 0.3, h), this.held)) {
        p.height = h;
        p.motor.crouched = move.crouch;
      }
    }
    const delta = p.motor.update(dt, move, p.yaw),
      d = [delta.x, delta.y, delta.z];
    if (p.motor.grounded && p.ground?.delta) {
      for (let i = 0; i < 3; i++) d[i] += p.ground.delta[i];
    }
    const result = this.world.moveCharacter(p.position, d, {
      height: p.height,
      stepHeight: p.motor.settings.stepHeight,
      grounded: p.motor.grounded,
      ignore: this.held,
      push: true,
    });
    p.position = result.position;
    p.motor.grounded = result.grounded;
    p.ground = result.ground;
    if (result.ceiling && p.motor.vy > 0) p.motor.vy = 0;
    if (result.grounded && p.motor.vy < 0) p.motor.vy = 0;
    if (p.position[1] < -12) this.damage(100);
    p.eye = damp(p.eye, p.motor.crouched ? 1 : 1.68, 14, dt);
    const speed = Math.hypot(p.motor.vx, p.motor.vz);
    p.phase += speed * dt;
    if (p.motor.grounded && speed > 1 && p.phase - this.idleStep > 2.2) {
      this.idleStep = p.phase;
      this.ctx.audio.play('step');
    }
    this.updateHeld(dt);
    if (input.consume('throw') && this.held) {
      this.held.velocity = mul(this.direction(), 12);
      this.held = null;
    }
  }
  updateHeld(dt) {
    if (!this.held) return;
    const e = this.held,
      eye = this.eyePosition(),
      dir = this.direction(),
      hit = this.world.ray(eye, dir, 3, { ignore: e }),
      distance = Math.max(0.75, Math.min(2.25, (hit?.distance ?? 3) - 0.75));
    const target = add(eye, mul(dir, distance));
    target[1] -= 0.55;
    e.position = mix(e.position, target, 1 - Math.exp(-14 * dt));
    e.velocity = [0, 0, 0];
    this.world.sync(e);
  }
  moveMechanism(e, dt) {
    for (const c of e.data.components) {
      if (c.type !== 'door' && c.type !== 'mover') continue;
      let offset = e.state.offset;
      if (c.type === 'door') {
        const target = e.state.active ? (c.distance ?? 3.6) : 0;
        offset += Math.sign(target - offset) * Math.min(Math.abs(target - offset), (c.speed ?? 2) * dt);
      } else {
        if (!c.channel || e.state.active) e.state.phase += dt;
        offset = (1 - Math.cos((e.state.phase / (c.period ?? 5)) * Math.PI * 2)) * 0.5 * (c.distance ?? 3);
      }
      const axis = { x: 0, y: 1, z: 2 }[c.axis || 'y'],
        next = [...e.data.position];
      next[axis] += offset;
      const delta = sub(next, e.position);
      if (c.type === 'door' && offset < e.state.offset) {
        const pb = characterBox(this.player.position, 0.3, this.player.height);
        if (e.colliders.some((b) => overlaps(pb, { min: add(b.min, delta), max: add(b.max, delta) }))) continue;
      }
      e.delta = delta;
      e.position = next;
      e.state.offset = offset;
      this.world.sync(e);
    }
  }
  playerOverlaps(e) {
    const box = characterBox(this.player.position, 0.3, this.player.height);
    return e.colliders.some((c) => c.enabled && c.sensor && overlaps(box, c));
  }
  updateBehavior(e, c, dt) {
    const inside = this.playerOverlaps(e),
      s = e.state;
    if (c.type === 'trigger' && inside !== s.inside) {
      s.inside = inside;
      if (!(c.once && s.fired)) {
        this.signals.send(c.channel || 'zone', inside, e.data.id);
        if (inside) s.fired = true;
      }
    }
    if (c.type === 'checkpoint' && inside && !s.active) {
      s.active = true;
      this.player.checkpoint = { position: add(e.position, [0, 0.16, 0]), yaw: this.player.yaw };
      this.ctx.notify(c.message || 'Checkpoint set.');
      this.ctx.audio.play('checkpoint');
    }
    if (c.type === 'pad') {
      s.cooldown = Math.max(0, s.cooldown - dt);
      if (inside && !s.cooldown) {
        this.player.motor.launch(c.launchSpeed ?? 14);
        s.cooldown = 0.8;
      }
    }
    if (c.type === 'hazard' && inside && this.state.player.health > 0) this.damage(100);
    if ((c.type === 'pickup' || c.type === 'supply') && inside && !s.collected) this.collect(e, c);
    if (c.type === 'goal' && inside && !s.fired && (!c.requiresSignal || this.signals.values.get(c.channel || 'gate'))) {
      s.fired = true;
      // 'yardComplete' for the Signal Yard, as before; every other cartridge gets its own flag.
      this.state.story[`${this.ctx.manifest?.id || 'yard'}Complete`] = true;
      if (c.message) this.ctx.notify(c.message);
      this.ctx.requestExit('complete');
    }
    if ((c.type === 'supply' || c.type === 'pickup') && !s.collected && e.root.children[0]) {
      e.root.children[0].rotation[1] = this.time * 45;
    }
  }
  collect(e, c) {
    if (e.state.collected) return;
    if (c.type === 'supply') {
      if (c.kind === 'health') {
        if (this.state.player.health >= 100) return;
        this.state.player.health = Math.min(100, this.state.player.health + (c.amount ?? 35));
      }
      if (c.kind === 'ammo') for (const a of Object.values(this.state.player.ammo)) a.reserve = Math.min(9999, a.reserve + (c.amount ?? 48));
      if (c.kind === 'key' && !this.state.player.inventory.includes(c.key || 'access-card')) this.state.player.inventory.push(c.key || 'access-card');
    } else this.signals.send(c.channel || 'cell', true, e.data.id);
    e.state.collected = true;
    e.root.visible = false;
    for (const col of e.colliders) col.enabled = false;
    this.ctx.audio.play('pickup');
    this.ctx.notify(c.type === 'supply' ? `${e.data.name} collected.` : 'Signal cell collected.');
  }
  updateTarget() {
    this.target = null;
    this.prompt = '';
    const key = (action) => this.ctx.input.label?.(action) || action.toUpperCase();
    if (this.held) {
      this.prompt = `${key('interact')} / Drop object    ${key('throw')} / Throw`;
      return;
    }
    const hit = this.world.ray(this.eyePosition(), this.direction(), 3.4, {
      sensors: true,
      predicate: (col) => !col.sensor || col.entity.data.components.some((c) => ['supply', 'pickup', 'exit'].includes(c.type)),
    });
    if (!hit) return;
    const e = hit.entity;
    if (e.state.collected) return;
    const c = e.data.components.find((c) => ['switch', 'pickup', 'supply', 'exit'].includes(c.type));
    if (c?.type === 'switch') {
      const label = c.label || 'switch';
      // A one-way switch (a breaker, a lever) that is already on has nothing left to do.
      if (c.once && e.state.active) {
        this.prompt = `${capital(label)} / On`;
        return;
      }
      this.target = { e, c };
      this.prompt = this.hasKey(c)
        ? `${key('interact')} / ${!c.once && e.state.active ? 'Deactivate' : 'Activate'} ${label}`
        : `${capital(label)} / Needs ${keyName(c.requiresKey)}`;
    } else if (c) {
      this.target = { e, c };
      this.prompt =
        c.type === 'exit'
          ? c.requiresClear && this.aliveEnemies() > 0
            ? 'Disable the remaining sentries.'
            : `${key('interact')} / Enter vehicle`
          : `${key('interact')} / Collect ${e.data.name}`;
    } else if (e.dynamic) {
      this.target = { e, c: null };
      this.prompt = `${key('interact')} / Carry object`;
    }
  }
  interact() {
    if (this.held) {
      this.held = null;
      return;
    }
    if (!this.target) return;
    const { e, c } = this.target;
    if (!c) {
      this.held = e;
      return;
    }
    if (c.type === 'switch') {
      if (c.once && e.state.active) return;
      if (!this.hasKey(c)) {
        this.ctx.notify(`The ${c.label || 'switch'} needs ${keyName(c.requiresKey)}.`);
        this.ctx.audio.play('denied');
        return;
      }
      e.state.active = c.once ? true : !e.state.active;
      this.signals.send(c.channel || 'gate', e.state.active, e.data.id);
      this.paintSwitch(e);
      this.ctx.audio.play(c.requiresKey ? 'accepted' : 'gate');
      this.ctx.rumble?.(0.25, 70);
    }
    if (c.type === 'pickup' || c.type === 'supply') this.collect(e, c);
    if (c.type === 'exit' && (!c.requiresClear || this.aliveEnemies() === 0)) {
      this.state.story.enteredVehicle = true;
      this.ctx.requestExit(c.exit || 'escape');
    }
  }
  /** A switch with requiresKey works only while that item is in the shared inventory. */
  hasKey(c) {
    return !c.requiresKey || this.state.player.inventory.includes(c.requiresKey);
  }
  /** A switch's lamp shows its state: pale while off, green while on. */
  paintSwitch(e) {
    const light = e.root.children.find((m) => m.shape === 'sphere');
    if (light) light.color = e.state.active ? '#a6efc6' : palette.pale;
  }
  trace(start, end, color = '#ede7b3', life = 0.06) {
    const d = sub(end, start),
      len = length(d);
    if (len < 0.001) return;
    const mesh = this.scene.mesh(
      'box',
      mix(start, end, 0.5),
      [0.018, 0.018, len],
      color,
      [(-Math.asin(d[1] / len) * 180) / Math.PI, (Math.atan2(d[0], d[2]) * 180) / Math.PI, 0],
      { unlit: true, castShadow: false },
    );
    this.effects.push({ mesh, life });
  }
  shoot(spec) {
    if (this.held) return;
    const origin = this.eyePosition(),
      dir = this.direction(),
      hit = this.world.ray(origin, dir, spec.range);
    this.trace(add(origin, add(mul(dir, 0.5), [0.17, -0.12, 0])), hit?.point || add(origin, mul(dir, spec.range)));
    if (!hit) return;
    const enemy = hit.entity.data.components.find((c) => c.type === 'enemy');
    if (enemy && hit.entity.state.health > 0) {
      const headshot = hit.point[1] - hit.entity.position[1] > 1.4;
      hit.entity.state.health -= spec.damage * (headshot ? 1.6 : 1);
      this.state.stats.hits++;
      this.hitMarker = 0.15;
      this.ctx.audio.play('hit');
      if (hit.entity.state.health <= 0) this.kill(hit.entity);
    } else if (hit.entity.dynamic) hit.entity.velocity = add(hit.entity.velocity, mul(dir, 3));
    for (let i = 0; i < 4; i++) {
      const mesh = this.scene.mesh('box', hit.point, [0.045, 0.045, 0.045], enemy ? '#d8b276' : '#e0dfbd', [0, 0, 0], {
        castShadow: false,
      });
      this.effects.push({
        mesh,
        life: 0.3 + this.rng() * 0.25,
        velocity: [(this.rng() - 0.5) * 4, 1 + this.rng() * 3, (this.rng() - 0.5) * 4],
      });
    }
  }
  kill(e) {
    e.state.health = 0;
    e.active = false;
    for (const c of e.colliders) c.enabled = false;
    e.root.rotation = [82, e.rotation[1], 0];
    e.root.position = add(e.position, [0, 0.2, 0]);
    this.state.stats.kills++;
    this.signals.send('enemy-killed', true, e.data.id);
    this.ctx.audio.play('down');
    this.ctx.rumble?.(0.45, 140);
  }
  damage(amount) {
    if (this.state.player.health <= 0) return;
    this.state.player.health = Math.max(0, this.state.player.health - amount);
    this.hurt = 0.38;
    this.ctx.audio.play('hurt');
    this.ctx.rumble?.(Math.min(1, 0.3 + amount / 40), amount >= 100 ? 320 : 160);
    if (this.state.player.health === 0) {
      this.deathTimer = 1.4;
      this.held = null;
      this.ctx.notify('Player down. Returning to the checkpoint.');
    }
  }
  respawn() {
    const p = this.player;
    p.position = [...p.checkpoint.position];
    p.previous = [...p.position];
    p.yaw = p.checkpoint.yaw;
    p.pitch = 0;
    p.height = 1.85;
    p.eye = 1.68;
    p.motor.reset();
    p.ground = null;
    this.state.player.health = 100;
    this.deathTimer = 0;
    this.held = null;
    this.weapons.reloadRemaining = 0;
    for (const a of Object.values(this.state.player.ammo)) if (a.mag === 0) a.reserve = Math.max(a.reserve, 24);
    this.ctx.input.clear();
    this.ctx.audio.play('pickup');
  }
  updateEnemy(e, c, dt) {
    const p = this.player,
      delta = sub(p.position, e.position),
      dist = Math.hypot(delta[0], delta[2]),
      eye = add(e.position, [0, 1.45, 0]),
      toPlayer = sub(this.eyePosition(), eye),
      dir = norm(toPlayer),
      s = e.state;
    s.cooldown = Math.max(0, s.cooldown - dt);
    const blocker = this.world.ray(eye, dir, length(toPlayer), { ignore: e });
    const visible = this.state.player.health > 0 && dist < (c.range ?? 22) && (!blocker || blocker.distance >= length(toPlayer) - 0.1);
    s.mode = visible ? 'engage' : 'patrol';
    if (visible) {
      e.rotation[1] = (Math.atan2(-delta[0], -delta[2]) * 180) / Math.PI;
      if (dist > 7) {
        const result = this.world.moveCharacter(e.position, [(delta[0] / dist) * (c.speed ?? 1.8) * dt, -0.2, (delta[2] / dist) * (c.speed ?? 1.8) * dt], {
          radius: 0.43,
          height: 1.76,
          grounded: true,
          ignore: e,
          stepHeight: 0.28,
        });
        e.position = result.position;
      }
      if (!s.cooldown && dist > 1) {
        const level = this.difficulty;
        s.charge += dt;
        if (s.charge >= 0.42 * level.aim) {
          s.charge = 0;
          s.cooldown = (1.3 + this.rng() * 0.45) * level.aim;
          this.damage(Math.round((c.damage ?? 8) * level.damage));
          this.trace(eye, this.eyePosition(), '#d9956a', 0.11);
        }
      }
    } else {
      s.charge = 0;
      const target = add(e.data.position, [Math.sin(this.time * 0.5 + e.data.position[0]) * 1.5, 0, Math.cos(this.time * 0.5) * 1.2]),
        d = sub(target, e.position),
        l = Math.hypot(d[0], d[2]);
      if (l > 0.1) {
        e.rotation[1] = (Math.atan2(-d[0], -d[2]) * 180) / Math.PI;
        e.position = this.world.moveCharacter(e.position, [(d[0] / l) * 0.55 * dt, -0.2, (d[2] / l) * 0.55 * dt], {
          radius: 0.43,
          height: 1.76,
          grounded: true,
          ignore: e,
        }).position;
      }
    }
    if (e.root.children[2]) e.root.children[2].color = s.charge > 0 ? '#f4ce76' : visible ? '#d68865' : '#b4c7a5';
    this.world.sync(e);
  }
  update(dt, alpha = 1) {
    if (!this.playing) return;
    const p = this.player,
      eye = add(mix(p.previous, p.position, alpha), [0, p.eye, 0]),
      bob = this.ctx.settings.motion === false ? 0 : Math.sin(p.phase * 3.4) * 0.02 * this.document.player.headBob * (p.motor.grounded ? 1 : 0);
    eye[1] += bob;
    const aiming = this.ctx.input.down('aim'),
      cam = this.scene.camera;
    cam.position = eye;
    cam.target = add(eye, this.direction());
    cam.fov = damp(cam.fov, aiming ? 55 : this.document.player.fov, 12, dt || 0.016);
    this.gun.root.position = [
      aiming ? 0.0 : 0.24,
      -0.21 - bob - (this.weapons.reloadRemaining ? Math.sin((this.weapons.reloadRemaining / this.weapons.spec.reload) * Math.PI) * 0.2 : 0),
      -0.3 + this.weapons.recoil,
    ];
    this.gun.root.rotation = [this.weapons.recoil * 90, 0, 0];
    this.gun.root.scale = this.weapons.id === 'pistol' ? [0.86, 0.9, 0.7] : [1, 1, 1];
    this.gun.root.visible = this.state.player.health > 0;
    this.gun.flash.visible = this.weapons.flash > 0;
  }
  hud() {
    return {
      kind: 'fps',
      health: this.state.player.health,
      weapon: this.weapons.spec.name,
      mag: this.weapons.ammo.mag,
      reserve: this.weapons.ammo.reserve,
      reloading: this.weapons.reloadRemaining > 0,
      ...this.objective(),
      prompt: this.prompt,
      hit: this.hitMarker > 0,
      hurt: this.hurt,
      dead: this.state.player.health <= 0,
      speed: Math.hypot(this.player.motor.vx, this.player.motor.vz),
      kills: this.state.stats.kills,
    };
  }
  /** The HUD objective: mission stages when the level defines them, otherwise the original texts. */
  objective() {
    const m = this.mission,
      alive = this.aliveEnemies();
    if (Array.isArray(m.stages) && m.stages.length) {
      const stage = m.stages.find((st) => !st.signal || !this.signals.values.get(st.signal)) || m.stages[m.stages.length - 1];
      let text = stage.text;
      const counter = stage.signal && this.counterFor(stage.signal);
      if (counter) text += ` / ${Math.min(counter.state.count, counter.need)} of ${counter.need}`;
      else if (stage.signal && stage.signal === m.clearSignal && this.enemyTotal) text += ` / ${this.enemyTotal - alive} of ${this.enemyTotal}`;
      return { objective: text, detail: stage.detail || m.detail || this.document.objective };
    }
    if (this.enemyTotal)
      return {
        objective: alive ? `Disable the sentries. / ${this.enemyTotal - alive} of ${this.enemyTotal}` : 'Enter the escape vehicle.',
        detail: m.detail || 'Clear the foundry. Leave through the north gate.',
      };
    return { objective: this.document.objective, detail: m.detail || 'Use the switch, moving platform, and signal cells.' };
  }
  /** The counter entity whose output is this channel, with its target count. */
  counterFor(channel) {
    if (!this.counters) {
      this.counters = new Map();
      for (const e of this.entities.values())
        for (const c of e.data.components) if (c.type === 'counter') this.counters.set(c.output || 'unlocked', { state: e.state, need: c.count ?? 2 });
    }
    return this.counters.get(channel) || null;
  }
  exportState() {
    return validateHandoff(this.state);
  }
  saveLocal() {
    return jsonData({
      version: 1,
      time: this.time,
      player: { position: this.player.position, yaw: this.player.yaw, pitch: this.player.pitch, checkpoint: this.player.checkpoint },
      entities: [...this.entities.values()].map((e) => ({
        id: e.data.id,
        position: e.position,
        rotation: e.rotation,
        velocity: e.velocity,
        active: e.active,
        state: e.state,
      })),
      signals: [...this.signals.values],
      pending: this.pendingSignals,
      allCleared: this.allCleared,
    });
  }
  restoreLocal(raw) {
    const local = jsonData(raw);
    if (local.version !== 1 || !Number.isFinite(local.time) || local.time < 0 || local.time > 1e9) throw Error('Invalid FPS checkpoint.');
    const vector = (p) => Array.isArray(p) && p.length === 3 && p.every((v) => Number.isFinite(v) && Math.abs(v) <= 10000);
    if (
      !vector(local.player?.position) ||
      !vector(local.player?.checkpoint?.position) ||
      !Number.isFinite(local.player.yaw) ||
      !Number.isFinite(local.player.pitch) ||
      !Number.isFinite(local.player.checkpoint.yaw)
    )
      throw Error('Invalid checkpoint position.');
    if (!Array.isArray(local.entities) || local.entities.length !== this.entities.size) throw Error('Checkpoint does not match the level.');
    const ids = new Set();
    for (const saved of local.entities) {
      const e = this.entities.get(saved.id);
      if (!e || ids.has(saved.id) || !vector(saved.position) || !vector(saved.rotation) || !vector(saved.velocity) || typeof saved.active !== 'boolean')
        throw Error('Invalid saved object.');
      ids.add(saved.id);
      const st = saved.state;
      for (const k of ['health', 'count', 'offset', 'phase', 'cooldown', 'charge'])
        if (!Number.isFinite(st?.[k]) || Math.abs(st[k]) > 1e9) throw Error('Invalid saved behavior.');
      for (const k of ['active', 'collected', 'inside', 'fired']) if (typeof st[k] !== 'boolean') throw Error('Invalid saved behavior flag.');
      if (!Array.isArray(st.sources) || !st.sources.every((x) => typeof x === 'string')) throw Error('Invalid saved signal sources.');
      e.position = saved.position;
      e.rotation = saved.rotation;
      e.velocity = saved.velocity;
      e.active = saved.active;
      Object.assign(e.state, st);
      this.world.sync(e);
      if (st.collected || !saved.active) {
        for (const col of e.colliders) col.enabled = false;
        e.root.visible = !st.collected;
        if (!saved.active) {
          e.root.rotation[0] = 82;
          e.root.position[1] += 0.2;
        }
      }
    }
    if (
      !Array.isArray(local.signals) ||
      !local.signals.every((x) => Array.isArray(x) && x.length === 2 && typeof x[0] === 'string' && typeof x[1] === 'boolean') ||
      !Array.isArray(local.pending) ||
      !local.pending.every((x) => Number.isFinite(x.at) && typeof x.channel === 'string' && typeof x.value === 'boolean' && typeof x.source === 'string')
    )
      throw Error('Invalid saved signals.');
    Object.assign(this.player, local.player, { previous: [...local.player.position] });
    this.time = local.time;
    this.signals.values = new Map(local.signals);
    this.pendingSignals = local.pending;
    this.allCleared = !!local.allCleared;
    for (const lamp of this.lamps) lamp.paint(!!this.signals.values.get(lamp.channel));
    for (const e of this.entities.values()) if (e.data.components.some((c) => c.type === 'switch')) this.paintSwitch(e);
  }
  dispose() {
    this.held = null;
    this.effects = [];
    this.lamps = [];
    this.signals.clear();
    this.world?.dispose();
  }
}
