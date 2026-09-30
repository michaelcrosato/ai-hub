import { controls } from './Controls.js';
import { Motor } from './Motor.js';
import { createPrefabs } from './Prefabs.js';
import { validateLevel, builtinSchemas } from './Schema.js';
import { BoxWorld, characterBox, overlaps } from './Physics.js';
import { createVisual, buildGun } from './Visuals.js';
import { Weapons } from './Weapons.js';
import { Signals } from '../../core/events.js';
import { clamp, damp, random } from '../../core/numeric.js';
import { add, sub, mul, norm, length, mix, cameraDirection, compose, bounds } from '../../core/math3d.js';
import { validateHandoff, jsonData } from '../../core/contracts.js';
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
    this.scene.environment = { sky: this.document.environment.sky, fog: this.document.environment.fog, sun: this.document.environment.sun / 2.4 };
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
    );
    this.enemyList = this.enemies();
    this.enemyTotal = this.enemyList.length;
    this.hasExit = this.document.entities.some((e) => e.components.some((c) => c.type === 'exit'));
    this.gun = buildGun(this.scene);
    this.gun.root.visible = this.playing;
    this.decorate();
    if (ctx.local) this.restoreLocal(ctx.local);
    this.scene.camera = this.playing
      ? { position: this.eyePosition(), target: add(this.eyePosition(), this.direction()), fov: this.document.player.fov }
      : { position: [31, 26, 35], target: [0, 1, 0], fov: 48 };
    this.editor = this.makeEditor();
    this.updateTarget();
    this.update(0, 1);
  }
  makeEditor() {
    return {
      getDocument: () => structuredClone(this.document),
      validate: (d) => this.validateDocument(d),
      prefabs: () => this.prefabs.all(),
      create: (id, p) => this.prefabs.create(id, p),
      getEntity: (id) => this.entities.get(id),
      bounds: (id) => {
        const e = this.entities.get(id);
        return e?.colliders.find((c) => !c.sensor) || e?.colliders[0] || bounds(compose(e?.position || [0, 0, 0]), [1, 1, 1]);
      },
    };
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
    if (this.document.name.includes('Vault')) {
      s.label('CYBERDYNE SYSTEMS / SECTOR 4', [0, 3.3, 22.43], 8, 0.6, '#d9e4e6', '#2f4550', [0, 180, 0]);
      s.label('SECURITY SCAN  >  STAND ON THE RING', [-5.4, 3.3, 9.37], 6.4, 0.5, '#dbe8d6', '#314a41');
      s.label('POWER / 3 CELLS', [-8.6, 3.3, -13.62], 5.4, 0.55, '#e6d7b4', '#4a4234');
      s.label('VAULT 04', [8.6, 3.3, -13.62], 4.2, 0.55, '#e6d7b4', '#4a4234');
      s.label('CATWALK / LIFT', [14.34, 3.6, -1], 4, 0.45, '#d5e2cf', '#34483d', [0, -90, 0]);
    }
    if (this.document.name.includes('Foundry')) {
      s.label('STRATA / FIELD SYSTEMS', [0, 3.4, -16.72], 7, 0.6, '#dbe6bf', '#344b3b');
      s.label('07', [-12.2, 2.75, -9.65], 1.8, 1.1, '#dddec0', '#506854', [0, 90, 0]);
      s.label('EXIT  >', [8, 1.8, -15.66], 3, 0.5, '#d6e6b8', '#314a39');
      s.label('KEEP CLEAR', [0, 0.135, 1], 4, 0.6, '#859568', '#c9c9a7', [-90, 0, 0]);
    }
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
          if (c.message) {
            this.ctx.notify(c.message);
            this.ctx.audio.play('gate');
          }
        } else if (c.message) this.ctx.notify(`Signal ${state.count} of ${c.count ?? 2}.`);
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
            if (value && c.message) {
              this.ctx.notify(c.message);
              this.ctx.audio.play('gate');
              this.ctx.rumble?.(0.45, 220);
            }
          }
        });
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
    for (const task of this.pendingSignals.filter((t) => t.at <= this.time)) this.signals.send(task.channel, task.value, task.source);
    this.pendingSignals = this.pendingSignals.filter((t) => t.at > this.time);
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
      this.weapons.update(dt, this.ctx.input);
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
      this.allCleared = true;
      this.signals.send('gate', true, 'mission');
      this.state.story[this.hasExit ? 'foundryCleared' : `${this.ctx.manifest.id}Cleared`] = true;
      this.ctx.notify(this.document.clearedMessage || 'All sentries disabled. The exit gate is open.');
      this.ctx.audio.play('gate');
    }
    for (const fx of [...this.effects]) {
      fx.life -= dt;
      if (fx.velocity) {
        fx.mesh.position = add(fx.mesh.position, mul(fx.velocity, dt));
        fx.velocity[1] -= 12 * dt;
      }
      if (fx.life <= 0) {
        this.scene.remove(fx.mesh);
        this.effects.splice(this.effects.indexOf(fx), 1);
      }
    }
    this.updateTarget();
    // Touch shows Use only when something is in reach, and Throw only while carrying.
    this.ctx.input.setShown?.('use', !!this.target || !!this.held);
    this.ctx.input.setShown?.('throw', !!this.held);
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
      this.ctx.audio.play('pickup');
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
      this.state.story[`${this.ctx.manifest.id}Complete`] = true;
      this.ctx.rumble?.(0.5, 250);
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
    const L = (a) => this.ctx.input.label?.(a) ?? a;
    if (this.held) {
      this.prompt = `${L('interact')} / Drop object    ${L('throw')} / Throw`;
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
    if (c) {
      this.target = { e, c };
      this.prompt =
        c.type === 'exit'
          ? c.requiresClear && this.aliveEnemies() > 0
            ? 'Disable the remaining sentries.'
            : `${L('interact')} / Enter vehicle`
          : c.type === 'switch'
            ? `${L('interact')} / ${e.state.active ? 'Deactivate' : 'Activate'} ${c.label || 'switch'}`
            : `${L('interact')} / Collect ${e.data.name}`;
    } else if (e.dynamic) {
      this.target = { e, c: null };
      this.prompt = `${L('interact')} / Carry object`;
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
      e.state.active = !e.state.active;
      this.signals.send(c.channel || 'gate', e.state.active, e.data.id);
      this.ctx.audio.play('gate');
    }
    if (c.type === 'pickup' || c.type === 'supply') this.collect(e, c);
    if (c.type === 'exit' && (!c.requiresClear || this.aliveEnemies() === 0)) {
      this.state.story.enteredVehicle = true;
      this.ctx.requestExit(c.exit || 'escape');
    }
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
    this.ctx.rumble?.(spec.automatic ? 0.14 : 0.22, 45);
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
      if (hit.entity.state.health <= 0) {
        this.kill(hit.entity);
        this.ctx.rumble?.(0.4, 110);
      }
    } else if (hit.entity.dynamic) hit.entity.velocity = add(hit.entity.velocity, mul(dir, 3));
    for (let i = 0; i < 4; i++) {
      const mesh = this.scene.mesh('box', hit.point, [0.045, 0.045, 0.045], enemy ? '#d8b276' : '#e0dfbd', [0, 0, 0], { castShadow: false });
      this.effects.push({ mesh, life: 0.3 + this.rng() * 0.25, velocity: [(this.rng() - 0.5) * 4, 1 + this.rng() * 3, (this.rng() - 0.5) * 4] });
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
  }
  damage(amount) {
    if (this.state.player.health <= 0) return;
    this.state.player.health = Math.max(0, this.state.player.health - amount);
    this.hurt = 0.38;
    this.ctx.audio.play('hurt');
    this.ctx.rumble?.(Math.min(1, 0.35 + amount / 40), 170);
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
        const result = this.world.moveCharacter(
          e.position,
          [(delta[0] / dist) * (c.speed ?? 1.8) * dt, -0.2, (delta[2] / dist) * (c.speed ?? 1.8) * dt],
          { radius: 0.43, height: 1.76, grounded: true, ignore: e, stepHeight: 0.28 },
        );
        e.position = result.position;
      }
      if (!s.cooldown && dist > 1) {
        s.charge += dt;
        if (s.charge >= 0.42) {
          s.charge = 0;
          s.cooldown = 1.3 + this.rng() * 0.45;
          this.damage(c.damage ?? 8);
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
      objective: this.objective(),
      detail:
        this.document.detail || (this.hasExit ? 'Clear the foundry. Leave through the north gate.' : 'Use the switch, moving platform, and signal cells.'),
      prompt: this.prompt,
      hit: this.hitMarker > 0,
      hurt: this.hurt,
      dead: this.state.player.health <= 0,
      speed: Math.hypot(this.player.motor.vx, this.player.motor.vz),
      kills: this.state.stats.kills,
    };
  }
  objective() {
    const alive = this.aliveEnemies(),
      total = this.enemyTotal;
    if (total && this.hasExit) return alive ? `Disable the sentries. / ${total - alive} of ${total}` : 'Enter the escape vehicle.';
    if (total && alive) return `${this.document.objective} / Sentries ${total - alive} of ${total}`;
    return this.document.objective;
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
      if (
        !e ||
        ids.has(saved.id) ||
        !vector(saved.position) ||
        !vector(saved.rotation) ||
        !vector(saved.velocity) ||
        typeof saved.active !== 'boolean'
      )
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
      !local.pending.every(
        (x) => Number.isFinite(x.at) && typeof x.channel === 'string' && typeof x.value === 'boolean' && typeof x.source === 'string',
      )
    )
      throw Error('Invalid saved signals.');
    Object.assign(this.player, local.player, { previous: [...local.player.position] });
    this.time = local.time;
    this.signals.values = new Map(local.signals);
    this.pendingSignals = local.pending;
    this.allCleared = !!local.allCleared;
  }
  dispose() {
    this.held = null;
    this.effects = [];
    this.signals.clear();
    this.world?.dispose();
  }
}
