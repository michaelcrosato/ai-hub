// Ochre Veil: one memory in the Ochre Ward, a sun-bleached harbour street.
// Couch pad (PS5-compatible standard layout), mouse and keyboard, or touch.
//
//   Left stick / WASD / arrows     move          Right stick / mouse drag   look
//   Shift / L1 / L2 / HIGH         high profile (hold). Let go for low profile.
//   Space / Cross / JUMP           jump or climb
//   F / Circle / BLADE             hidden blade, pickpocket, or question
//   G / Square / COUNTER           counter a strike in its window
//   V / Triangle / EAGLE           eagle vision, once the tower is synced
//   Enter / Start / RESET          restart the memory
//   Fullscreen button              TV fullscreen
//
// Low profile walks, blends in the street crowd, and listens. High profile runs.
// Climb the sandstone face, cross the roof gap, and only the hay pile breaks a long fall.
import {
  addModelColliders,
  buildModel,
  compileClips,
  ContactShadow,
  DEFAULT_TEXEL,
  Engine,
  HERO_CLIPS,
  HERO_MODEL,
  HERO_RIG,
  mergeStaticMeshes,
  PALETTE,
  PlatformerCharacter,
  setLookLayer,
  TEXTURE_LIBRARY,
  textureMap,
  THREE,
  toonMaterial,
  withUrlOptions,
} from './pixel-engine.js';
import { GAMEPAD_KEYS, TOUCH_BUTTONS } from './rules/actions.js';
import { ALERT_AT, awarenessLabel, isBlendCover, stepAwareness } from './rules/awareness.js';
import { applyHealth, isBehind, MELEE_RANGE, resolveStrikeStep, strikePhase, yawForward } from './rules/blade.js';
import { BLEND_RADIUS, DISTRICT, EAVESDROP_TIME, inDisc, LETHAL_DROP, MAX_HEALTH } from './rules/district.js';
import { guardLos, stepGuard } from './rules/guards.js';
import { intelComplete, markDead, markTargetDead, reachEscape, restartMemory, revealIntel, statusLine, createMemory } from './rules/mission.js';
import { townsfolk, wardGuard } from './people.js';
import { classifyRole, SYNC_THRESHOLD } from './rules/vision.js';
import { markersFor } from './rules/viewpoint.js';
import {
  advanceRoute,
  bladeAt,
  chaseAfterKill,
  finishInvestigation,
  resolveKill,
  restartRoster,
  searcherActive,
  stepEavesdrop,
  tryInterrogation,
  tryPickpocket,
} from './rules/investigate.js';

const { BoxGeometry, Color, Mesh, PlaneGeometry, Vector3 } = THREE;

const SONG = {
  bpm: 76,
  tracks: {
    lead: { wave: 'triangle', decay: 0.35, volume: 0.1 },
    bass: { wave: 'square', duty: 0.25, decay: 0.3, volume: 0.07 },
    drum: { wave: 'noise', decay: 0.08, volume: 0.05 },
  },
  patterns: {
    a: {
      lead: 'A3 . C4 . E4 . D4 . C4 . A3 . G3 . A3 .',
      bass: 'A2 . . . E2 . . . D2 . . . A2 . . .',
      drum: 'C6 . C8 . C6 . . . C6 . C8 . C6 . . .',
    },
    b: {
      lead: 'G3 . Bb3 . D4 . C4 . Bb3 . G3 . F3 . G3 .',
      bass: 'G2 . . . D2 . . . C2 . . . G2 . . .',
      drum: 'C6 . . C8 C6 . . . C6 . . C8 C6 . . .',
    },
  },
  order: ['a', 'a', 'b', 'a'],
};

const CLIMB_STATES = new Set(['climb', 'hang', 'pullUp']);
const TINT = { foe: PALETTE.red, ally: PALETTE.cyan, civilian: PALETTE.white, target: PALETTE.orange };


const PROPS = [
  ['market-stall', [-2.35, 0, 6.85], { turn: 80 }],
  ['haystack', [3.2, 0, 8.8], {}],
  ['well', [3.55, 0, 16.35], { turn: 12 }],
  ['barrel', [-2.25, 0, 9.7], {}],
  ['crate', [-2.55, 0, 10.35], { turn: 18 }],
  ['amphora', [-1.85, 0, 11.15], {}],
  ['cart', [3.85, 0, 13.7], { turn: 110 }],
  ['lamp-post', [3.65, 0, 4.7], {}],
  ['column', [-1.5, 0, -9.1], { params: { height: 3.3 } }],
  ['column', [1.5, 0, -9.1], { params: { height: 3.3 } }],
  ['standard', [0, 0, -10.6], { palette: { cloth: 'red' } }],
  ['brazier', [7.6, 8.02, 16.4], {}],
  ['sack', [1.35, 0, 15.85], {}],
  ['planter', [1.55, 0, 3.45], {}],
  ['fountain', [0.3, 0, 29.1], {}],
  ['well', [17.2, 0, 40.4], { turn: 20 }],
  ['barrel', [21.2, 0, 38.6], {}],
  ['crate', [23.4, 0, 39.1], { turn: 12 }],
  ['amphora', [-19.4, 0, 8.4], {}],
  ['crate-stack', [-2.4, 0, 20.4], { turn: 8 }],
];

const CLOTH = {
  sand: { cloth: 'sand', band: 'red', skin: 'orange', wrap: 'white' },
  white: { cloth: 'white', band: 'orange', skin: 'sand', wrap: 'mist' },
  mist: { cloth: 'mist', band: 'plum', skin: 'orange', wrap: 'sand' },
  orange: { cloth: 'orange', band: 'sand', skin: 'orange', wrap: 'red' },
  slate: { cloth: 'slate', band: 'sand', skin: 'orange', wrap: 'mist' },
  plum: { cloth: 'plum', band: 'sand', skin: 'orange', wrap: 'red' },
  teal: { cloth: 'teal', band: 'white', skin: 'orange', wrap: 'cyan' },
};

function texturedBox(w, h, d, texture) {
  const geo = new BoxGeometry(w, h, d);
  const tile = TEXTURE_LIBRARY.get(texture).size[0] / DEFAULT_TEXEL;
  const uv = geo.attributes.uv;
  const scale = Math.max(w, h, d) / tile;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * scale, uv.getY(i) * scale);
  const mesh = new Mesh(geo, toonMaterial(PALETTE.white, { map: textureMap(texture) }));
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

function paved(w, d, texture) {
  const tile = TEXTURE_LIBRARY.get(texture).size[0] / DEFAULT_TEXEL;
  const geo = new PlaneGeometry(w, d).rotateX(-Math.PI / 2);
  const uv = geo.attributes.uv.array;
  for (let i = 0; i < uv.length; i += 2) {
    uv[i] = (uv[i] * w) / tile;
    uv[i + 1] = (uv[i + 1] * d) / tile;
  }
  const mesh = new Mesh(geo, toonMaterial(PALETTE.white, { map: textureMap(texture) }));
  mesh.receiveShadow = true;
  return mesh;
}

function tintMesh(root, color) {
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    if (!obj.userData.baseMat) obj.userData.baseMat = obj.material;
    obj.material = color ? toonMaterial(color) : obj.userData.baseMat;
  });
}

class OchreVeil {
  name = 'Ochre Veil';
  assets = [HERO_MODEL];
  district = DISTRICT;
  memory = createMemory();
  awareness = 0;
  sync = 0;
  health = MAX_HEALTH;
  vision = false;
  visionPainted = false;
  blended = false;
  hiding = false;
  highProfile = false;
  fighting = false;
  combatPulse = 0;
  eavesdropT = 0;
  toast = '';
  toastT = 0;
  helpT = 9;
  leapT = 0;
  celebrated = false;
  wasGrounded = true;
  peakY = 0;
  syncedLight = false;
  target = new Vector3();
  feet = new Vector3();
  ground = new Vector3();
  eye = new Vector3();
  chest = new Vector3();
  aim = new Vector3();
  look = new Vector3();
  hurtFrom = new Vector3();
  basisRight = new Vector3();
  basisForward = new Vector3();
  input = {
    move: new Vector3(),
    walk: true,
    jump: false,
    jumpHeld: false,
    crouch: false,
    crouchPressed: false,
    grab: false,
    attack: false,
    wave: false,
    sit: false,
  };

  async setup(ctx) {
    const { scene, physics, engine } = ctx;
    engine.sun.color.setHex(PALETTE.sand);
    engine.sun.intensity = 1.45;
    engine.ambient.color.setHex(PALETTE.sand);
    engine.ambient.intensity = 0.72;
    engine.setSunDirection([0.45, 0.92, 0.22]);
    scene.background = new Color(PALETTE.sky);
    ctx.input.gamepadButtons = { ...GAMEPAD_KEYS };

    ctx.audio.register('blade', { wave: 'saw', freq: 720, freqEnd: 150, decay: 0.13, volume: 0.3 });
    ctx.audio.register('cloth', { wave: 'noise', freq: 700, decay: 0.1, volume: 0.16 });
    ctx.audio.playMusic(SONG, 'ward');

    const ground = DISTRICT.ground;
    physics.addStaticBox({
      position: ground.at,
      halfExtents: [ground.size[0] / 2, ground.size[1] / 2, ground.size[2] / 2],
    });
    const street = paved(ground.size[0], ground.size[2], 'flagstones');
    street.position.set(ground.at[0], 0.02, ground.at[2]);
    const meshes = [street];

    for (const solid of DISTRICT.solids) {
      const mesh = texturedBox(solid.size[0], solid.size[1], solid.size[2], solid.tex);
      mesh.position.set(solid.at[0], solid.at[1], solid.at[2]);
      meshes.push(mesh);
      const col = physics.addStaticBox({
        position: solid.at,
        halfExtents: [solid.size[0] / 2, solid.size[1] / 2, solid.size[2] / 2],
      });
      if (solid.climbable) physics.tag(col, 'climbable');
      if (solid.id === 'west-block' || solid.id === 'east-block') {
        const top = solid.at[1] + solid.size[1] / 2;
        const cap = new Mesh(
          new BoxGeometry(solid.size[0] - 0.25, 0.16, solid.size[2] - 0.25),
          toonMaterial(PALETTE.red),
        );
        cap.position.set(solid.at[0], top - 0.02, solid.at[2]);
        cap.castShadow = cap.receiveShadow = true;
        meshes.push(cap);
      }
    }
    for (const z of [7.1, 9.4, 11.2, 16.2, 18.4]) {
      const awning = new Mesh(new BoxGeometry(1.25, 0.08, 1.7), toonMaterial(z < 14 ? PALETTE.orange : PALETTE.plum));
      awning.position.set(4.9, 3.25, z);
      awning.castShadow = awning.receiveShadow = true;
      meshes.push(awning);
    }
    scene.add(...mergeStaticMeshes(meshes));

    this.propLights = [];
    for (const [id, at, opts] of PROPS) {
      const built = buildModel(id, { params: opts.params, palette: opts.palette, seed: 2 });
      built.object.position.set(at[0], at[1], at[2]);
      built.object.rotation.y = ((opts.turn ?? 0) * Math.PI) / 180;
      built.object.updateMatrixWorld();
      scene.add(built.object);
      addModelColliders(physics, built, at, built.object.rotation.y);
      if (built.light && (id === 'lamp-post' || id === 'brazier')) {
        const p = built.object.localToWorld(new Vector3(...built.light.at));
        this.propLights.push(ctx.lights.request({ ...built.light, position: [p.x, p.y, p.z] }));
      }
    }

    this.actors = [];
    const addActor = (def, palette, at, yaw, role, scale = 1) => {
      const built = buildModel(def, { palette });
      built.object.position.set(at[0], at[1], at[2]);
      built.object.rotation.y = yaw;
      if (scale !== 1) built.object.scale.setScalar(scale);
      setLookLayer(built.object, 'actors');
      built.object.userData.role = role;
      scene.add(built.object);
      return built.object;
    };

    this.crowd = DISTRICT.crowd.map((c) => ({
      ...c,
      x: c.at[0],
      y: c.at[1],
      z: c.at[2],
      yaw: c.yaw,
      walkT: 0,
      mesh: addActor(townsfolk, CLOTH[c.cloth] ?? CLOTH.sand, c.at, c.yaw, 'civilian'),
    }));
    for (const c of this.crowd) this.actors.push({ role: 'civilian', mesh: c.mesh, elevated: false });

    const pair = DISTRICT.eavesdrop.pair;
    this.listeners = pair.map((p, i) => {
      const mesh = addActor(townsfolk, i === 0 ? CLOTH.sand : CLOTH.white, p.at, p.yaw, 'civilian');
      this.actors.push({ role: 'civilian', mesh, elevated: false });
      return { ...p, mesh };
    });

    const pocket = DISTRICT.pickpocket;
    this.pocket = {
      ...pocket,
      mesh: addActor(townsfolk, CLOTH.orange, pocket.at, pocket.yaw, 'civilian'),
    };
    this.actors.push({ role: 'civilian', mesh: this.pocket.mesh, elevated: false });

    const talk = DISTRICT.interrogation;
    this.informant = {
      ...talk,
      mesh: addActor(townsfolk, CLOTH.teal, talk.at, talk.yaw, 'ally'),
    };
    this.actors.push({ role: 'ally', mesh: this.informant.mesh, elevated: false });

    const mark = DISTRICT.target;
    this.mark = {
      ...mark,
      dead: false,
      mesh: addActor(townsfolk, CLOTH.plum, mark.at, mark.yaw, 'target', 1.08),
    };
    this.actors.push({ role: 'target', mesh: this.mark.mesh, elevated: false });
    this.clock = 0;
    this.mark.x = this.mark.at[0];
    this.mark.y = this.mark.at[1];
    this.mark.z = this.mark.at[2];
    this.pocket.x = this.pocket.at[0];
    this.pocket.y = this.pocket.at[1];
    this.pocket.z = this.pocket.at[2];
    this.stepWalker(this.mark, this.mark.route);
    this.stepWalker(this.pocket, this.pocket.walk);

    this.guards = DISTRICT.guards.map((g) => {
      const mesh = addActor(wardGuard, { cloth: 'navy', band: g.elevated ? 'sand' : 'red', skin: 'orange', wrap: 'slate', staff: 'night' }, g.at, g.yaw, 'guard');
      this.actors.push({ role: 'guard', mesh, elevated: g.elevated });
      return {
        ...g,
        x: g.at[0],
        y: g.at[1],
        z: g.at[2],
        yaw: g.yaw,
        mode: 'patrol',
        broken: false,
        attackT: -1,
        stagger: 0,
        dead: false,
        patrolT: g.elevated ? 1.2 : 0,
        lastX: g.at[0],
        lastZ: g.at[2],
        geometric: false,
        mesh,
      };
    });

    const hero = await ctx.loadModel(HERO_MODEL, { castShadow: false });
    this.model = hero.scene;
    setLookLayer(this.model, 'actors');
    this.shadow = new ContactShadow(0.42);
    scene.add(this.model, this.shadow);
    const spawn = DISTRICT.spawn;
    this.hero = new PlatformerCharacter(physics, {
      position: spawn,
      lockDepth: ctx.camera.lockDepth,
    });
    this.hero.attachModel(this.model, compileClips(HERO_CLIPS, HERO_RIG, this.model), HERO_RIG);
    this.peakY = spawn[1];
  }

  reset(ctx) {
    const opening = restartRoster(DISTRICT);
    this.memory = opening.memory;
    this.awareness = 0;
    this.sync = 0;
    this.health = MAX_HEALTH;
    this.vision = false;
    this.visionPainted = false;
    this.combatPulse = 0;
    this.eavesdropT = 0;
    this.toast = '';
    this.toastT = 0;
    this.leapT = 0;
    this.celebrated = false;
    this.wasGrounded = true;
    this.fighting = false;
    this.blended = false;
    this.hiding = false;
    for (const actor of this.actors) tintMesh(actor.mesh, null);
    const spawn = DISTRICT.spawn;
    this.hero.teleport(spawn);
    this.peakY = spawn[1];
    this.clock = 0;
    this.mark.dead = !opening.markAlive;
    this.mark.mesh.visible = opening.markAlive;
    this.mark.mesh.rotation.x = 0;
    this.stepWalker(this.mark, this.mark.route);
    this.stepWalker(this.pocket, this.pocket.walk);
    this.mark.mesh.position.set(this.mark.x, this.mark.y, this.mark.z);
    for (const g of this.guards) {
      const home = opening.guards.find((row) => row.id === g.id);
      g.x = home?.x ?? g.at[0];
      g.y = home?.y ?? g.at[1];
      g.z = home?.z ?? g.at[2];
      g.mode = home?.mode ?? 'patrol';
      g.broken = false;
      g.attackT = -1;
      g.stagger = 0;
      g.dead = false;
      g.mesh.visible = true;
      g.mesh.rotation.x = 0;
      g.mesh.rotation.z = 0;
    }
    for (const c of this.crowd) {
      c.x = c.at[0];
      c.y = c.at[1];
      c.z = c.at[2];
      c.walkT = 0;
    }
    this.stepCrowd();
    if (this.towerLight) {
      this.towerLight.release();
      this.towerLight = null;
    }
    this.syncedLight = false;
    ctx.engine.timeScale = 1;
  }

  readInput(ctx) {
    const axis = ctx.input.moveAxis();
    const basis = ctx.camera.groundBasis();
    this.basisRight.copy(basis.right);
    this.basisForward.copy(basis.forward);
    let x = axis.x;
    let y = axis.y;
    const mag = Math.hypot(x, y);
    if (mag > 1) {
      x /= mag;
      y /= mag;
    }
    const input = this.input;
    input.move.set(
      this.basisRight.x * x + this.basisForward.x * y,
      0,
      this.basisRight.z * x + this.basisForward.z * y,
    );
    this.highProfile = ctx.input.isDown('ShiftLeft') || ctx.input.isDown('ShiftRight');
    input.walk = !this.highProfile;
    input.jump = ctx.input.consumePress('Space');
    input.jumpHeld = ctx.input.isDown('Space');
    input.crouch = false;
    input.crouchPressed = false;
    input.grab = false;
    input.attack = false;
    input.wave = false;
    input.sit = false;
    return {
      assassinate: ctx.input.consumePress('KeyF'),
      counter: ctx.input.consumePress('KeyG'),
      eagle: ctx.input.consumePress('KeyV'),
      restart: ctx.input.consumePress('Enter'),
    };
  }

  raySees(ctx, guard) {
    this.eye.set(guard.x, guard.y + 1.45, guard.z);
    this.chest.set(this.feet.x, this.feet.y + 1.05, this.feet.z);
    this.aim.copy(this.chest).sub(this.eye);
    const dist = this.aim.length();
    if (dist < 0.4) return true;
    this.aim.multiplyScalar(1 / dist);
    const hit = ctx.physics.castRay(this.eye, this.aim, dist);
    if (!hit) return true;
    return hit.collider === this.hero.collider || hit.distance >= dist - 0.4;
  }

  fixedUpdate(ctx, dt) {
    const press = this.readInput(ctx);
    if (press.restart) {
      this.reset(ctx);
      this.input.move.set(0, 0, 0);
      this.input.jump = false;
      this.input.jumpHeld = false;
    }
    const ended = this.memory.won || this.memory.lost;
    if (ended) {
      this.input.move.set(0, 0, 0);
      this.input.jump = false;
      this.input.jumpHeld = false;
    }
    if (press.eagle) this.vision = !this.vision;

    this.hero.feetInto(this.feet);
    const lowProfile = !this.highProfile;
    this.blended = lowProfile && this.crowd.some((c) => isBlendCover(c) && !c.dead && Math.hypot(this.feet.x - c.x, this.feet.z - c.z) <= BLEND_RADIUS && Math.abs(this.feet.y - c.y) < 1.4);
    this.hiding = lowProfile && Math.abs(this.feet.y) < 1.4 && (inDisc(this.feet.x, this.feet.z, DISTRICT.hiding) || inDisc(this.feet.x, this.feet.z, DISTRICT.quayHide));

    if (this.combatPulse > 0) this.combatPulse = Math.max(0, this.combatPulse - dt);

    this.clock = (this.clock ?? 0) + dt;
    this.stepCrowd(dt);
    this.stepWalker(this.pocket, this.pocket.walk);
    if (!this.mark.dead) this.stepWalker(this.mark, this.mark.route);
    this.stepGuards(ctx, dt, press.counter);

    if (!ended && press.assassinate) this.useBlade(ctx, lowProfile);
    if (!ended) this.listen(ctx, dt, lowProfile);

    const climbing = CLIMB_STATES.has(this.hero.state);
    this.fighting = this.combatPulse > 0 || this.guards.some((g) => !g.dead && g.attackT >= 0);
    let inView = false;
    for (const guard of this.guards) {
      guard.geometric = !guard.dead && this.raySees(ctx, guard);
      if (guard.geometric) inView = true;
    }
    const conspicuous = this.highProfile || (climbing && inView) || this.fighting;
    this.awareness = stepAwareness(this.awareness, {
      dt,
      blended: this.blended,
      hiding: this.hiding,
      highProfile: this.highProfile,
      climbingInView: climbing && inView,
      fighting: this.fighting,
      unseen: !inView && !conspicuous,
    });
    const exposed = this.highProfile || climbing || this.fighting || this.awareness >= ALERT_AT;
    for (const guard of this.guards) {
      if (guard.dead) continue;
      const los = guardLos({
        chasing: guard.mode === 'chase',
        geometric: guard.geometric,
        exposed,
        hiding: this.hiding,
        blended: this.blended,
      });
      const next = stepGuard(guard, { los, hiding: this.hiding });
      guard.mode = next.mode;
      guard.broken = next.broken;
      if (los) {
        guard.lastX = this.feet.x;
        guard.lastZ = this.feet.z;
      }
    }

    if (!ended && this.sync < SYNC_THRESHOLD && this.feet.y > 11.4 && inDisc(this.feet.x, this.feet.z, DISTRICT.viewpoint)) {
      this.sync = SYNC_THRESHOLD;
      this.toast = 'THE WARD OPENS';
      this.toastT = 2.4;
      ctx.audio.play('fanfare', { volume: 0.45, pitch: -5 });
    }
    if (!ended && inDisc(this.feet.x, this.feet.z, DISTRICT.escape) && Math.abs(this.feet.y) < 1.5) {
      this.memory = reachEscape(this.memory);
    }

    this.hero.fixedUpdate(dt, this.input);
    this.hero.feetInto(this.feet);
    this.checkLanding(ctx);

    if (this.memory.won && !this.celebrated) {
      this.celebrated = true;
      this.hero.celebrate();
      ctx.audio.play('fanfare');
    }
  }

  stepWalker(person, route) {
    if (!route || route.length < 2) return;
    const spot = advanceRoute(route, this.clock, 0.62);
    person.x = spot.x;
    person.y = spot.y;
    person.z = spot.z;
    person.yaw = spot.yaw;
    person.moving = spot.moving;
  }

  stepCrowd() {
    for (const person of this.crowd) this.stepWalker(person, person.walk);
  }

  stepGuards(ctx, dt, counterPressed) {
    for (const guard of this.guards) {
      if (guard.dead) continue;
      if (guard.searcher && !searcherActive(this.awareness)) {
        guard.mode = 'patrol';
        guard.broken = false;
        guard.x = guard.at[0];
        guard.y = guard.at[1];
        guard.z = guard.at[2];
        guard.attackT = -1;
        continue;
      }
      if (guard.stagger > 0) {
        guard.stagger -= dt;
        guard.attackT = -1;
      }
      if (guard.mode === 'chase') {
        const dx = guard.lastX - guard.x;
        const dz = guard.lastZ - guard.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 1.2) {
          const step = Math.min(dist, 3.4 * dt);
          guard.x += (dx / dist) * step;
          guard.z += (dz / dist) * step;
          guard.yaw = Math.atan2(dx, dz);
        } else {
          guard.yaw = Math.atan2(this.feet.x - guard.x, this.feet.z - guard.z);
        }
        if (guard.roof) {
          guard.x = Math.min(guard.roof.maxX, Math.max(guard.roof.minX, guard.x));
          guard.z = Math.min(guard.roof.maxZ, Math.max(guard.roof.minZ, guard.z));
          guard.y = guard.homeY;
        } else {
          guard.y = guard.homeY;
        }
      } else if (guard.stagger <= 0) {
        guard.patrolT += dt * 0.42;
        const u = (Math.sin(guard.patrolT) + 1) / 2;
        const [a, b] = guard.patrol;
        guard.x = a[0] + (b[0] - a[0]) * u;
        guard.z = a[2] + (b[2] - a[2]) * u;
        guard.y = guard.homeY;
        guard.yaw = Math.cos(guard.patrolT) >= 0 ? 0 : Math.PI;
      }

      const dx = this.feet.x - guard.x;
      const dz = this.feet.z - guard.z;
      const near = Math.hypot(dx, dz) <= MELEE_RANGE && Math.abs(this.feet.y - guard.y) < 1.35;
      if (guard.mode === 'chase' && near && guard.stagger <= 0 && !this.memory.lost) {
        if (guard.attackT < 0) guard.attackT = 0;
        const before = strikePhase(guard.attackT);
        guard.attackT += dt;
        const phase = strikePhase(guard.attackT);
        const strike = resolveStrikeStep({ before, phase, pressed: counterPressed });
        if (strike.kind === 'punish') {
          guard.stagger = 1.15;
          guard.attackT = -1;
          const away = Math.hypot(guard.x - this.feet.x, guard.z - this.feet.z) || 1;
          guard.x += ((guard.x - this.feet.x) / away) * 0.7;
          guard.z += ((guard.z - this.feet.z) / away) * 0.7;
          this.combatPulse = Math.max(this.combatPulse, 1.1);
          ctx.audio.play('punch');
          ctx.engine.hitstop(0.07);
          ctx.engine.shake.add(0.28);
        } else if (strike.kind === 'hit') {
          this.hurtPlayer(ctx, guard.x, guard.z, strike.damage);
        }
        if (guard.attackT >= 0 && strikePhase(guard.attackT) === 'done') guard.attackT = -1;
      } else if (!near) {
        guard.attackT = -1;
      }
    }
  }

  hurtPlayer(ctx, fromX, fromZ, damage) {
    if (this.memory.lost || this.memory.won || damage <= 0) return;
    const knocked = this.hero.hurt(this.hurtFrom.set(fromX - this.feet.x, 0, fromZ - this.feet.z));
    if (!knocked) return;
    const next = applyHealth(this.health, damage);
    this.health = next.health;
    this.combatPulse = Math.max(this.combatPulse, 0.8);
    ctx.audio.play('hurt');
    ctx.engine.shake.add(0.4);
    if (next.loss) {
      this.memory = markDead(this.memory);
      ctx.engine.screen.flash('red', { duration: 0.22 });
    }
  }

  useBlade(ctx, lowProfile) {
    const feet = { x: this.feet.x, y: this.feet.y, z: this.feet.z };
    const flags = { lowProfile, blended: this.blended, airborne: !this.hero.grounded, highProfile: this.highProfile };
    if (!this.mark.dead) {
      const query = bladeAt({ x: this.mark.x, y: this.mark.y, z: this.mark.z, yaw: this.mark.yaw }, feet, flags);
      if (query.dead) {
        this.mark.dead = true;
        const seen = this.guards.find((g) => g.geometric && !g.dead && !(g.searcher && !searcherActive(this.awareness)));
        const killed = resolveKill(this.memory, { seen: !!seen });
        this.memory = killed.memory;
        if (killed.forceChase && seen) {
          const [forced] = chaseAfterKill([seen], { forceChase: true, seenId: seen.id });
          seen.mode = forced.mode;
          seen.broken = forced.broken;
        }
        this.combatPulse = Math.max(this.combatPulse, 1.3);
        ctx.audio.play('blade');
        ctx.audio.play('cloth');
        ctx.engine.hitstop(0.09);
        ctx.engine.shake.add(0.2);
        ctx.particles.burst('impact', this.mark.mesh.position, { count: 10 });
        this.toast = this.memory.spoiled ? 'TOO SOON' : 'THE MARK FALLS';
        this.toastT = 2;
        return;
      }
    }
    for (const guard of this.guards) {
      if (guard.dead || (guard.searcher && !searcherActive(this.awareness))) continue;
      const query = bladeAt(guard, feet, flags);
      if (!query.dead) continue;
      guard.dead = true;
      guard.mode = 'patrol';
      guard.attackT = -1;
      this.combatPulse = Math.max(this.combatPulse, 1.2);
      ctx.audio.play('blade');
      ctx.engine.hitstop(0.08);
      ctx.particles.burst('impact', guard.mesh.position, { count: 8 });
      return;
    }
    if (!this.memory.intel.pickpocket) {
      const mark = this.pocket;
      const dx = feet.x - mark.x;
      const dz = feet.z - mark.z;
      const facing = yawForward(mark.yaw ?? 0);
      const attempt = tryPickpocket({
        lowProfile,
        behind: isBehind(facing.x, facing.z, dx, dz),
        moving: !!mark.moving,
        inRange: Math.hypot(dx, dz) <= mark.radius && Math.abs(feet.y - (mark.y ?? 0)) < 1.3,
      });
      if (attempt.ok) {
        const done = finishInvestigation(this.memory, this.awareness, 'pickpocket', revealIntel);
        this.memory = done.memory;
        this.awareness = done.awareness;
        ctx.audio.play('coin');
        this.toast = 'A NAME';
        this.toastT = 1.8;
        return;
      }
    }
    if (!this.memory.intel.interrogation) {
      const attempt = tryInterrogation({
        lowProfile,
        pressed: true,
        inRange: inDisc(feet.x, feet.z, DISTRICT.interrogation) && Math.abs(feet.y) < 1.3,
      });
      if (attempt.ok) {
        const done = finishInvestigation(this.memory, this.awareness, 'interrogation', revealIntel);
        this.memory = done.memory;
        this.awareness = done.awareness;
        ctx.audio.play('coin', { pitch: -6 });
        this.toast = 'A PLACE';
        this.toastT = 1.8;
      }
    }
  }

  listen(ctx, dt, lowProfile) {
    const chasing = this.guards.some((g) => g.mode === 'chase' && !g.dead);
    const heard = stepEavesdrop(this.eavesdropT, {
      dt,
      lowProfile,
      inSpot: inDisc(this.feet.x, this.feet.z, DISTRICT.eavesdrop) && Math.abs(this.feet.y) < 1.3,
      chasing,
      done: this.memory.intel.eavesdrop,
      need: EAVESDROP_TIME,
    });
    this.eavesdropT = heard.progress;
    if (!heard.complete) return;
    const done = finishInvestigation(this.memory, this.awareness, 'eavesdrop', revealIntel);
    this.memory = done.memory;
    this.awareness = done.awareness;
    ctx.audio.play('coin', { pitch: 3, volume: 0.6 });
    this.toast = 'A GRUDGE';
    this.toastT = 1.8;
  }

  checkLanding(ctx) {
    const grounded = this.hero.grounded;
    const y = this.feet.y;
    if (!grounded) {
      if (y > this.peakY) this.peakY = y;
    } else if (!this.wasGrounded) {
      const drop = this.peakY - y;
      this.peakY = y;
      if (drop >= LETHAL_DROP && !this.memory.lost && !this.memory.won) {
        if (inDisc(this.feet.x, this.feet.z, DISTRICT.leap)) {
          this.leapT = 1.6;
          ctx.audio.play('land');
          ctx.particles.burst('dust', this.feet, { count: 14 });
        } else {
          this.health = 0;
          this.memory = markDead(this.memory);
          this.hero.hurt(this.hurtFrom.set(0, 0, 1));
          ctx.audio.play('hurt');
          ctx.engine.shake.add(0.55);
          ctx.engine.screen.flash('white', { duration: 0.18 });
        }
      }
    } else {
      this.peakY = y;
    }
    this.wasGrounded = grounded;
  }

  update(ctx, dt) {
    this.hero.updateVisual(this.model, dt, ctx.physics.alpha);
    const feet = this.model.position;
    const ground = ctx.physics.groundBelow(this.ground.set(feet.x, feet.y + 0.2, feet.z), 30, this.hero.body);
    if (ground) this.shadow.place(feet.x, ground.y, feet.z, feet.y - ground.y);
    else this.shadow.place(feet.x, 0, feet.z, feet.y);

    for (const person of this.crowd) {
      person.mesh.position.set(person.x, person.y, person.z);
      person.mesh.rotation.y = person.yaw;
    }
    this.pocket.mesh.position.set(this.pocket.x, this.pocket.y ?? 0, this.pocket.z);
    this.pocket.mesh.rotation.x = 0;
    this.pocket.mesh.rotation.y = this.pocket.yaw ?? 0;
    if (this.mark.dead) {
      this.mark.mesh.rotation.x = Math.PI / 2;
      this.mark.mesh.position.y = 0.35;
    } else {
      this.mark.mesh.rotation.x = 0;
      this.mark.mesh.position.set(this.mark.x, this.mark.y ?? 0, this.mark.z);
      this.mark.mesh.rotation.y = this.mark.yaw ?? 0;
    }
    for (const guard of this.guards) {
      guard.mesh.position.set(guard.x, guard.y, guard.z);
      guard.mesh.rotation.y = guard.yaw;
      if (guard.dead) {
        guard.mesh.rotation.x = Math.PI / 2;
        guard.mesh.position.y = guard.homeY + 0.3;
      }
    }

    const painted = this.vision && this.sync >= SYNC_THRESHOLD;
    if (painted !== this.visionPainted) {
      this.visionPainted = painted;
      for (const actor of this.actors) {
        const kind = painted ? classifyRole(actor.role, this.sync) : null;
        tintMesh(actor.mesh, kind ? TINT[kind] : null);
      }
    }

    if (!this.syncedLight && this.sync >= SYNC_THRESHOLD) {
      this.syncedLight = true;
      this.towerLight = ctx.lights.request({
        position: [DISTRICT.viewpoint.at[0], DISTRICT.viewpoint.at[1] + 1.2, DISTRICT.viewpoint.at[2]],
        color: 0xffc56a,
        intensity: 7,
        radius: 8,
        flicker: 'torch',
      });
    }

    const look = this.nearestLook();
    this.hero.lookAt = look ? this.look.set(look.x, (look.y ?? 0) + 1.3, look.z) : null;

    if (this.toastT > 0) this.toastT -= dt;
    if (this.helpT > 0) this.helpT -= dt;
    if (this.leapT > 0) this.leapT -= dt;
    this.drawHud(ctx);
  }

  nearestLook() {
    let best = null;
    let bestD = 6;
    const consider = (x, y, z) => {
      const d = Math.hypot(this.feet.x - x, this.feet.z - z);
      if (d < bestD) {
        bestD = d;
        best = { x, y, z };
      }
    };
    if (!this.mark.dead) consider(this.mark.x, this.mark.y, this.mark.z);
    for (const guard of this.guards) if (!guard.dead && guard.mode === 'chase') consider(guard.x, guard.y, guard.z);
    return best;
  }

  drawHud(ctx) {
    const hud = ctx.hud;
    hud.clear();
    const narrow = hud.width < 240;
    const touchOn = ctx.engine.touch?.visible === true;
    const phase = this.memory.phase.toUpperCase();
    hud.text(6, 6, `PHASE ${phase}`, { color: 'sand' });
    hud.text(6, 16, awarenessLabel(this.awareness), { color: this.awareness >= ALERT_AT ? 'red' : 'white' });
    hud.rect(6, 26, 42, 4, 'ink');
    hud.rect(6, 26, Math.max(0, (42 * this.awareness) / 100), 4, this.awareness >= ALERT_AT ? 'red' : 'orange');
    hud.text(6, 34, `SYNC ${this.sync >= SYNC_THRESHOLD ? '1' : '0'}`, { color: 'sky' });
    hud.text(6, 44, this.highProfile ? 'HIGH' : 'LOW', { color: this.highProfile ? 'orange' : 'lime' });
    for (let i = 0; i < MAX_HEALTH; i++) hud.rect(48 + i * 8, 44, 6, 6, i < this.health ? 'red' : 'ink');
    const intel = this.memory.intel;
    const secrets = ['eavesdrop', 'pickpocket', 'interrogation'];
    secrets.forEach((kind, i) => {
      hud.rect(6 + i * 10, 56, 8, 5, intel[kind] ? 'lime' : 'ink');
    });
    const secretText = this.sync >= SYNC_THRESHOLD ? 'LISTEN PICK TALK' : `SECRETS ${secrets.filter((k) => intel[k]).length}/3`;
    if (!(narrow && this.sync >= SYNC_THRESHOLD)) hud.text(40, 55, secretText, { color: 'mist' });

    const goal = this.goalLine();
    hud.text(0, touchOn ? 122 : narrow ? 78 : 8, goal, { anchor: 'top', color: this.memory.won ? 'lime' : this.memory.lost ? 'red' : 'sand' });
    if (this.toastT > 0 && this.toast) hud.text(0, 42, this.toast, { anchor: 'top', color: 'white' });
    if (this.leapT > 0) hud.text(0, 56, 'THE HAY HOLDS', { anchor: 'top', color: 'sand' });
    if (this.vision && this.sync < SYNC_THRESHOLD) hud.text(0, 70, 'EAGLE NEEDS THE TOWER', { anchor: 'top', color: 'sky' });
    if (this.visionPainted) {
      hud.text(6, 58, 'FOE', { color: 'red' });
      hud.text(28, 58, 'ALLY', { color: 'cyan' });
      hud.text(54, 58, 'CIVILIAN', { color: 'white' });
      hud.text(6, 68, 'TARGET', { color: 'orange' });
    }
    if (this.eavesdropT > 0 && !intel.eavesdrop) {
      hud.rect(6, 78, 40, 3, 'ink');
      hud.rect(6, 78, 40 * (this.eavesdropT / EAVESDROP_TIME), 3, 'sand');
    }
    const hint = this.hintLine();
    const lift = touchOn ? 108 : 0;
    if (hint) hud.text(0, 8 + lift, hint, { anchor: 'bottom', color: 'sand' });
    if (this.helpT > 0 && !touchOn) {
      if (narrow) {
        hud.text(0, 64, 'F BLADE', { anchor: 'bottom', color: 'mist' });
        hud.text(0, 52, 'G COUNTER  V EAGLE', { anchor: 'bottom', color: 'mist' });
      } else hud.text(0, 20, 'F BLADE  G COUNTER  V EAGLE', { anchor: 'bottom', color: 'mist' });
    }
    if (this.memory.won || this.memory.lost || this.memory.spoiled) {
      hud.text(0, 34 + lift, 'ENTER RETRIES', { anchor: 'bottom', color: 'white' });
    }
    this.drawMap(hud, narrow, touchOn);
  }

  goalLine() {
    const memory = this.memory;
    if (memory.lost) return 'DESYNCHRONISED';
    if (memory.won) return 'MEMORY SEALED';
    if (memory.spoiled) return 'TOO SOON';
    if (memory.phase === 'escape') return 'REACH THE GATE';
    if (memory.phase === 'hunt') return 'THE MARK IS YOURS';
    if (!intelComplete(memory)) return 'LEARN THE WARD';
    return 'THE OCHRE WARD';
  }

  hintLine() {
    if (this.memory.won || this.memory.lost) return '';
    const x = this.feet.x;
    const z = this.feet.z;
    if (!this.memory.intel.eavesdrop && inDisc(x, z, DISTRICT.eavesdrop)) return 'STAY LOW AND LISTEN';
    if (!this.memory.intel.pickpocket && Math.hypot(x - this.pocket.x, z - this.pocket.z) < 2.2) return 'BEHIND THE WALKER';
    if (!this.memory.intel.interrogation && inDisc(x, z, DISTRICT.interrogation)) return 'LOW PROFILE, THEN BLADE';
    if (this.memory.phase === 'hunt' && Math.hypot(x - this.mark.x, z - this.mark.z) < 3) return 'BEHIND HIM, OR FROM ABOVE';
    if (this.memory.phase === 'escape') return 'THE GATE IS BEHIND YOU';
    if (this.hiding) return 'HIDDEN';
    if (this.blended) return 'BLENDED';
    return '';
  }

  drawMap(hud, narrow, touchOn) {
    const w = hud.width;
    const h = hud.height;
    if (!(w > 40 && h > 40)) return;
    const x0 = touchOn || !narrow ? 6 : w - 46;
    const y0 = touchOn ? 74 : h - 48;
    const mw = 40;
    const mh = 40;
    hud.rect(x0, y0, mw, mh, 'ink');
    const minX = -24;
    const maxX = 28;
    const minZ = -17;
    const maxZ = 53;
    const dot = (wx, wz, color) => {
      const u = (wx - minX) / (maxX - minX);
      const v = (wz - minZ) / (maxZ - minZ);
      hud.rect(x0 + 1 + u * (mw - 4), y0 + 1 + (1 - v) * (mh - 4), 2, 2, color);
    };
    dot(this.feet.x, this.feet.z, 'white');
    if (this.sync < SYNC_THRESHOLD) return;
    const shown = new Set(markersFor(true));
    if (shown.has('eavesdrop')) dot(DISTRICT.eavesdrop.at[0], DISTRICT.eavesdrop.at[2], 'sand');
    if (shown.has('pickpocket')) dot(this.pocket.x, this.pocket.z, 'orange');
    if (shown.has('interrogation')) dot(DISTRICT.interrogation.at[0], DISTRICT.interrogation.at[2], 'cyan');
    if (shown.has('target')) dot(this.mark.x, this.mark.z, 'red');
    if (this.memory.phase === 'escape' || this.memory.won) dot(DISTRICT.escape.at[0], DISTRICT.escape.at[2], 'lime');
  }

  cameraTarget() {
    const p = this.model?.position;
    if (!p) return this.target.set(DISTRICT.spawn[0], 1, DISTRICT.spawn[2]);
    return this.target.set(p.x, p.y + 1.1, p.z);
  }

  onCameraChange(ctx) {
    this.hero?.setLockDepth(ctx.camera.lockDepth);
    if (this.model) this.model.visible = !ctx.camera.hidesTarget;
  }

  status() {
    return statusLine(this.memory, this.awareness, this.sync);
  }
}

await Engine.start(
  new OchreVeil(),
  withUrlOptions({
    container: document.getElementById('app'),
    aspect: 'fill',
    touchButtons: TOUCH_BUTTONS,
    touchBar: false,
    camera: { preset: 'third', yaw: 180, pitch: 18, distance: 8.4, zoom: 1.05 },
    background: PALETTE.sky,
  }),
);
