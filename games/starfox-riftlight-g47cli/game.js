// Vesper Lane: a branched on-rails shooter. Couch controls (PS5-compatible pad):
// left stick or d-pad steer, Cross fire, Square burst, Circle or L1/R1 roll,
// R2 boost, L2 brake, Options pause. Keyboard: arrows or WASD steer, J/Z fire,
// K/X burst, L/C roll, Shift boost, Ctrl brake, Esc or P pause.
// Mouse: pointer offset steers, left fire, right burst, middle roll,
// wheel up boost, wheel down or the 5th button brake, 4th button pause.
// Touch: stick plus FIRE, BURST, ROLL, BOOST, BRAKE, PAUSE.
import { buildModel, Engine, mergeStaticMeshes, PALETTE, setLookLayer, THREE, toonMaterial, withUrlOptions } from './pixel-engine.js';
import { GAMEPAD_TO_KEYS, mapActions, sampleFromEngine } from './actions.js';
import { MODELS } from './models.js';
import { createSim } from './sim.js';

const { BoxGeometry, Color, Group, Mesh, Vector3 } = THREE;

const SEG = 18;
const SEGMENTS = 20;
const LOOK = {
  scene: [{ id: 'vignette', params: { intensity: 0.3 } }],
  actors: { pixel: { size: 2, outline: 0.7, crease: 0.12 }, filters: [] },
  environment: { pixel: { size: 2, outline: 0.4, crease: 0.08 }, filters: [] },
};
const SONG = {
  bpm: 132,
  tracks: {
    lead: { wave: 'square', duty: 0.25, decay: 0.16, volume: 0.07 },
    bass: { wave: 'triangle', decay: 0.22, volume: 0.08 },
  },
  patterns: {
    a: {
      lead: 'E5 . G5 . B5 . A5 . G5 . E5 . D5 . E5 .',
      bass: 'E2 . . . B2 . . . A2 . . . E2 . . .',
    },
  },
  order: ['a'],
};
const RETICLE = ['..ww..ww..', '.w..ww..w.', 'w........w', '..........', '..........', 'w........w', '.w......w.', '..ww..ww..'];
const CORRIDOR = {
  glass: { floor: 'navy', band: ['slate', 'blue'], ceil: 'ink', wall: 'plum', line: 'cyan', post: 'ink', span: 'mist', ambient: 'navy', sky: 'night' },
  cinder: { floor: 'red', band: ['orange', 'sand'], ceil: 'ink', wall: 'orange', line: 'sand', post: 'red', span: 'orange', ambient: 'red', sky: 'ink' },
  orbit: { floor: 'navy', band: ['teal', 'blue'], ceil: 'ink', wall: 'teal', line: 'cyan', post: 'mist', span: 'teal', ambient: 'teal', sky: 'navy' },
  kiln: { floor: 'ink', band: ['red', 'orange'], ceil: 'red', wall: 'orange', line: 'sand', post: 'red', span: 'sand', ambient: 'orange', sky: 'ink' },
  veil: { floor: 'navy', band: ['mist', 'teal'], ceil: 'navy', wall: 'teal', line: 'lime', post: 'mist', span: 'lime', ambient: 'navy', sky: 'night' },
};
const BOSS_TINT = {
  core: { hull: 'orange', plate: 'sand', jaw: 'red', eye: 'sand' },
  sequence: { hull: 'teal', plate: 'cyan', jaw: 'white', eye: 'lime' },
  window: { hull: 'red', plate: 'orange', jaw: 'sand', eye: 'sand' },
  tip: { hull: 'mist', plate: 'teal', jaw: 'white', eye: 'lime' },
};

function segmentMesh(index, look) {
  const spec = CORRIDOR[look];
  const band = index % 2 === 0 ? PALETTE[spec.band[0]] : PALETTE[spec.band[1]];
  const parts = [];
  const add = (w, h, d, x, y, z, color) => {
    const mesh = new Mesh(new BoxGeometry(w, h, d), toonMaterial(color));
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    parts.push(mesh);
  };
  add(18, 24, SEG, 0, -16.4, 0, PALETTE[spec.floor]);
  add(16.2, 0.22, SEG, 0, -4.18, 0, band);
  add(18, 16, SEG, 0, 12.2, 0, PALETTE[spec.ceil]);
  add(1.1, 28, SEG, -8.4, 0, 0, PALETTE[spec.wall]);
  add(1.1, 28, SEG, 8.4, 0, 0, PALETTE[spec.wall]);
  add(0.16, 0.1, SEG * 0.92, -5.2, -4.02, 0, PALETTE[spec.line]);
  add(0.16, 0.1, SEG * 0.92, 5.2, -4.02, 0, PALETTE[spec.line]);
  add(0.22, 7.4, 0.22, -7.4, 0, SEG * 0.28, PALETTE[spec.post]);
  add(0.22, 7.4, 0.22, 7.4, 0, -SEG * 0.22, PALETTE[spec.post]);
  if (index % 3 === 0) add(16.4, 0.45, 0.55, 0, 3.9, 0, PALETTE[spec.span]);
  const group = new Group();
  group.add(...mergeStaticMeshes(parts));
  return group;
}

function boxPool(scene, color, size) {
  const pool = [];
  pool.grow = (n) => {
    while (pool.length < n) {
      const mesh = new Mesh(new BoxGeometry(size[0], size[1], size[2]), toonMaterial(color));
      mesh.castShadow = true;
      mesh.visible = false;
      setLookLayer(mesh, 'actors');
      scene.add(mesh);
      pool.push(mesh);
    }
  };
  return pool;
}

class VesperLane {
  name = 'Vesper Lane';
  target = new Vector3();
  aim = new Vector3();
  sim = createSim();
  actions = mapActions();
  fireHeld = false;
  actors = new Map();
  corridors = {};
  look = 'glass';
  shotMeshes = null;
  allyShotMeshes = null;
  hostileMeshes = null;

  async setup(ctx) {
    const { scene, engine, audio } = ctx;
    this.scene = scene;
    this.engine = engine;
    engine.sun.intensity = 1.55;
    engine.ambient.intensity = 2.05;
    engine.ambient.color.setHex(PALETTE.navy);
    engine.setSunDirection([0.25, 0.86, -0.35]);
    scene.background = new Color(PALETTE.night);
    ctx.input.gamepadButtons = { ...GAMEPAD_TO_KEYS };
    ctx.input.preventKeys.add('KeyP');

    for (const look of Object.keys(CORRIDOR)) {
      const even = segmentMesh(0, look);
      const odd = segmentMesh(1, look);
      const meshes = [];
      for (let i = 0; i < SEGMENTS; i++) {
        const mesh = (i % 2 === 0 ? even : odd).clone();
        mesh.visible = look === 'glass';
        scene.add(mesh);
        meshes.push(mesh);
      }
      this.corridors[look] = meshes;
    }
    globalThis.__VESPER = this;

    this.craft = buildModel('lark', { catalog: MODELS }).object;
    setLookLayer(this.craft, 'actors');
    scene.add(this.craft);
    ctx.lights.request({ follow: this.craft, offset: [0, 0.5, 0.4], color: 0xb7ecff, intensity: 5, radius: 9, priority: 8 });

    this.waygate = buildModel('waygate', { catalog: MODELS }).object;
    setLookLayer(this.waygate, 'actors');
    scene.add(this.waygate);
    this.ally = buildModel('lark', { catalog: MODELS, palette: { hull: 'teal', wing: 'cyan', nose: 'white', glass: 'sand', hot: 'lime' } }).object;
    this.ally.scale.setScalar(0.92);
    setLookLayer(this.ally, 'actors');
    scene.add(this.ally);

    this.shotMeshes = boxPool(scene, PALETTE.cyan, [0.22, 0.22, 1.35]);
    this.allyShotMeshes = boxPool(scene, PALETTE.lime, [0.2, 0.2, 1.15]);
    this.hostileMeshes = boxPool(scene, PALETTE.red, [0.24, 0.24, 1.1]);

    audio.register('zap', { wave: 'square', duty: 0.125, freq: 1280, freqEnd: 240, decay: 0.07, volume: 0.16 });
    audio.register('burst', { wave: 'square', freq: 160, freqEnd: 40, decay: 0.38, volume: 0.35 });
    audio.register('roll', { wave: 'triangle', freq: 280, freqEnd: 840, decay: 0.16, volume: 0.14 });
    audio.register('hit', { wave: 'square', freq: 90, freqEnd: 42, decay: 0.18, volume: 0.28 });
    audio.register('pick', { wave: 'triangle', freq: 620, decay: 0.16, volume: 0.24, arp: [0, 7, 12], arpRate: 0.045 });
    audio.register('radio', { wave: 'square', duty: 0.5, freq: 740, decay: 0.09, volume: 0.12 });
    audio.playMusic(SONG);
    this.spawned = new Set();
  }

  fixedUpdate(ctx, dt) {
    this.actions = mapActions(sampleFromEngine(ctx.input));
    if (ctx.input.consumePress('KeyK', 'KeyX')) this.actions.bomb = true;
    if (ctx.input.consumePress('KeyL', 'KeyC')) this.actions.roll = true;
    if (ctx.input.consumePress('Escape', 'KeyP')) this.actions.pause = true;
    const freshFire = this.actions.fire && !this.fireHeld;
    this.fireHeld = this.actions.fire;
    if (this.sim.phase !== 'play') {
      if (freshFire || ctx.input.consumePress('KeyJ', 'KeyZ')) this.restart();
      return;
    }
    this.sim.step(dt, this.actions);
  }

  restart() {
    this.sim = createSim();
    this.fireHeld = true;
    for (const mesh of this.actors.values()) mesh.visible = false;
  }

  update(ctx, dt) {
    const sim = this.sim;
    this.poseCraft(sim, dt);
    this.poseWorld(sim);
    this.poseActors(ctx, sim);
    this.playFx(ctx, sim);
    if (ctx.camera.preset === 'third') {
      ctx.camera.yaw = 0;
      ctx.camera.pitch = 0.26;
    }
    this.drawHud(ctx, sim);
  }

  poseCraft(sim) {
    const mesh = this.craft;
    if (!mesh) return;
    mesh.position.set(sim.x, sim.y, 0);
    const roll = sim.rolling > 0 ? (1 - sim.rolling / sim.level.rollTime) * Math.PI * 2 : 0;
    const side = Math.sign(this.actions.steerX) || 1;
    mesh.rotation.set(0, Math.PI, -this.actions.steerX * 0.45 + roll * side);
    const wingL = mesh.getObjectByName('wingL');
    const wingR = mesh.getObjectByName('wingR');
    if (wingL) wingL.visible = sim.wings >= 1;
    if (wingR) wingR.visible = sim.wings >= 2;
  }

  poseWorld(sim) {
    const look = CORRIDOR[sim.level.look] ? sim.level.look : 'glass';
    if (look !== this.look) {
      for (const [name, meshes] of Object.entries(this.corridors)) {
        const on = name === look;
        for (const mesh of meshes) mesh.visible = on;
      }
      this.look = look;
      const spec = CORRIDOR[look];
      this.engine.ambient.color.setHex(PALETTE[spec.ambient]);
      this.scene.background = new Color(PALETTE[spec.sky]);
    }
    const meshes = this.corridors[look];
    const base = Math.floor(sim.s / SEG);
    for (let i = 0; i < meshes.length; i++) {
      const index = base - 4 + i;
      const center = index * SEG + SEG / 2;
      meshes[i].position.set(0, 0, sim.s - center);
    }
  }

  poseActors(ctx, sim) {
    const seen = new Set();
    const show = (id, modelId, x, y, s, spin = 0, scale = 1, palette = null) => {
      let mesh = this.actors.get(id);
      if (!mesh) {
        mesh = buildModel(modelId, { catalog: MODELS, ...(palette ? { palette } : {}) }).object;
        mesh.scale.setScalar(scale);
        setLookLayer(mesh, 'actors');
        ctx.scene.add(mesh);
        this.actors.set(id, mesh);
      }
      mesh.visible = true;
      mesh.position.set(x, y, sim.s - s);
      mesh.rotation.y = Math.PI + spin;
      seen.add(id);
      return mesh;
    };
    for (const e of sim.live) {
      if (e.kind === 'enemy') show(e.id, 'dart', e.x, e.y, e.s, 0, e.allyThreat ? 1.35 : 1);
      else if (e.kind === 'bomb') show(e.id, 'burst', e.x, e.y, e.s, sim.t * 2.4);
      else if (e.kind === 'upgrade') show(e.id, 'lens', e.x, e.y, e.s, sim.t * 2);
      else if (e.kind === 'lance') show(e.id, 'lens', e.x, e.y, e.s, sim.t * 2, 1.15, { hull: 'white', glass: 'lime', spark: 'sand' });
      else if (e.kind === 'mend') show(e.id, 'waygate', e.x, e.y - 0.4, e.s, sim.t, 0.34, { ring: 'lime', tick: 'white' });
      else if (e.kind === 'solid' || e.kind === 'flare') {
        let mesh = this.actors.get(e.id);
        if (!mesh) {
          const tall = e.kind === 'flare';
          mesh = new Mesh(
            new BoxGeometry(e.hw * 2, tall ? 8 : e.hh * 2, tall ? 1.2 : 1.4),
            toonMaterial(tall ? PALETTE.orange : PALETTE.mist),
          );
          mesh.castShadow = mesh.receiveShadow = true;
          setLookLayer(mesh, 'actors');
          ctx.scene.add(mesh);
          this.actors.set(e.id, mesh);
        }
        mesh.visible = true;
        mesh.position.set(e.x, e.kind === 'flare' ? 1.2 : e.y, sim.s - e.s);
        seen.add(e.id);
      }
    }
    if (sim.boss && !sim.boss.dead) {
      show(sim.boss.id, 'hull-warden', sim.boss.x, sim.boss.y, sim.boss.s, 0, 1, BOSS_TINT[sim.boss.pattern] || null);
      if (sim.boss.nodes) {
        for (const node of sim.boss.nodes) {
          if (node.dead) continue;
          const id = `${sim.boss.id}:${node.id}`;
          let mesh = this.actors.get(id);
          if (!mesh) {
            mesh = new Mesh(new BoxGeometry(0.8, 0.8, 0.8), toonMaterial(PALETTE.lime));
            mesh.castShadow = true;
            setLookLayer(mesh, 'actors');
            ctx.scene.add(mesh);
            this.actors.set(id, mesh);
          }
          mesh.material = toonMaterial(node.open ? PALETTE.lime : PALETTE.ink);
          mesh.visible = true;
          mesh.position.set(node.x, node.y, sim.s - sim.boss.s);
          seen.add(id);
        }
      }
    }
    const gate = sim.level.events.find((e) => e.kind === 'checkpoint');
    this.waygate.visible = !!gate && Math.abs(sim.s - gate.at) < 90;
    if (gate) this.waygate.position.set(0, 0, sim.s - gate.at);
    const ally = sim.level.events.find((e) => e.kind === 'ally');
    const escorting = sim.allySaved && sim.s < sim.escortUntil;
    const allyNear = !!ally && sim.s > ally.at - 55 && sim.s < ally.at + 36;
    this.ally.visible = escorting || allyNear;
    if (escorting) this.ally.position.set(sim.x - 1.7, sim.y + 0.55, -4.2);
    else if (ally) this.ally.position.set(ally.x, ally.y, sim.s - ally.at);
    this.ally.rotation.y = Math.PI;
    for (const [id, mesh] of this.actors) if (!seen.has(id)) mesh.visible = false;
    this.placeShots(this.shotMeshes, sim.shots.filter((shot) => !shot.ally), sim);
    this.placeShots(this.allyShotMeshes, sim.shots.filter((shot) => shot.ally), sim);
    this.placeShots(this.hostileMeshes, sim.incoming, sim);
  }

  placeShots(pool, shots, sim) {
    pool.grow(shots.length);
    for (let i = 0; i < pool.length; i++) {
      const shot = shots[i];
      pool[i].visible = !!shot;
      if (shot) pool[i].position.set(shot.x, shot.y, sim.s - shot.s);
    }
  }

  playFx(ctx, sim) {
    for (const fx of sim.fx) {
      const type = fx.type ?? fx;
      const at = fx.s != null ? this.aim.set(fx.x, fx.y, sim.s - fx.s) : this.craft.position;
      if (type === 'zap') ctx.audio.play('zap', { volume: 0.14 });
      else if (type === 'boom') {
        ctx.audio.play('burst', { volume: 0.3 });
        ctx.particles.burst('impact', at, { count: 10 });
      } else if (type === 'hit') {
        ctx.audio.play('hit');
        ctx.engine.shake.add(0.45);
        ctx.engine.hitstop(0.045);
        ctx.particles.burst('sparkle', this.craft.position, { count: 8, colors: ['red', 'sand'] });
      } else if (type === 'pick') {
        ctx.audio.play('pick');
        ctx.particles.burst('sparkle', at, { count: 12, colors: ['cyan', 'white'] });
      } else if (type === 'roll') ctx.audio.play('roll', { volume: 0.12 });
      else if (type === 'radio') ctx.audio.play('radio');
      else if (type === 'win') ctx.audio.play('fanfare');
      else if (type === 'die') ctx.audio.play('hit', { pitch: -4 });
    }
    sim.fx.length = 0;
  }

  drawHud(ctx, sim) {
    const hud = ctx.hud;
    const wide = hud.width >= 300;
    const scale = wide ? 3 : 2;
    const barW = Math.min(wide ? 150 : 96, hud.width - 16);
    const shieldColor = sim.shields <= 2 ? 'red' : 'lime';
    hud.clear();
    hud.text(8, 8, 'SHIELDS', { scale, color: 'sand', shadow: 'ink' });
    hud.rect(8, 8 + scale * 8, barW, wide ? 14 : 10, 'ink');
    hud.rect(8, 8 + scale * 8, Math.max(0, barW * (sim.shields / sim.level.maxShields)), wide ? 14 : 10, shieldColor);
    const bombsY = 8 + scale * 8 + (wide ? 20 : 16);
    hud.text(8, bombsY, 'BURST', { scale, color: 'orange', shadow: 'ink' });
    const pip = wide ? 12 : 8;
    for (let i = 0; i < sim.level.maxBombs; i++) {
      hud.rect(8 + i * (pip + 4), bombsY + scale * 8, pip, pip, i < sim.bombs ? 'orange' : 'navy');
    }
    const weapon = sim.weaponTier >= 2 ? 'LANCE' : sim.weaponTier >= 1 ? 'LENS' : 'DRIVE';
    hud.text(8, wide ? 36 : 28, weapon, { anchor: 'bottom-left', scale, color: 'cyan', shadow: 'ink' });
    hud.rect(8, wide ? 18 : 12, barW, wide ? 16 : 11, 'navy', 'bottom-left');
    const meterColor = sim.meter <= 0 ? 'red' : sim.boosting ? 'sand' : 'cyan';
    hud.rect(8, wide ? 18 : 12, Math.max(0, barW * sim.meter), wide ? 16 : 11, meterColor, 'bottom-left');
    hud.sprite(0, 0, RETICLE, { w: 'white' }, { anchor: 'center', scale: wide ? 2 : 1 });
    const stageName = sim.level.name.toUpperCase().split(' ');
    const stageScale = 2;
    if (hud.width < 700 && stageName.length > 1) {
      hud.text(8, 8, stageName[0], { anchor: 'top-right', scale: stageScale, color: 'white', shadow: 'ink' });
      hud.text(8, 8 + stageScale * 9, stageName.slice(1).join(' '), { anchor: 'top-right', scale: stageScale, color: 'white', shadow: 'ink' });
    } else {
      hud.text(8, 8, stageName.join(' '), { anchor: 'top-right', scale: stageScale, color: 'white', shadow: 'ink' });
    }
    if (sim.atEdge) {
      const side = sim.edgeX > 0 ? 'right' : sim.edgeX < 0 ? 'left' : 'top';
      if (sim.edgeX !== 0) hud.rect(0, 0, 6, hud.height, 'red', sim.edgeX > 0 ? 'right' : 'left');
      if (sim.edgeY !== 0) hud.rect(0, 0, hud.width, 6, 'red', sim.edgeY > 0 ? 'top' : 'bottom-left');
      hud.text(0, wide ? 48 : 36, side === 'top' ? 'EDGE' : 'EDGE', { anchor: 'top', scale, color: 'red', shadow: 'ink' });
    }
    if (sim.boss && !sim.boss.dead) {
      hud.text(0, 8, sim.boss.name.toUpperCase(), { anchor: 'top', scale, color: 'plum', shadow: 'ink' });
      const bossW = Math.min(barW, hud.width * 0.46);
      const bossH = wide ? 12 : 8;
      const bossY = 8 + scale * 8;
      const fillW = bossW * (sim.boss.hp / sim.boss.maxHp);
      hud.rect(0, bossY, bossW, bossH, 'ink', 'top');
      if (fillW > 0) hud.rect(-bossW / 2 + fillW / 2, bossY, fillW, bossH, 'red', 'top');
    }
    if (sim.allyCall) hud.text(0, wide ? 42 : 30, sim.allyCall.text, { anchor: 'center', scale: wide ? 2 : 1, color: 'sand', shadow: 'navy' });
    if (sim.paused) hud.text(0, 0, 'PAUSED', { anchor: 'center', scale: scale + 1, color: 'white', shadow: 'navy' });
    if (sim.phase === 'won') {
      hud.text(0, -28, 'LANE CLEAR', { anchor: 'center', scale, color: 'sand', shadow: 'navy' });
      hud.text(0, 8, `SCORE ${sim.result.score}`, { anchor: 'center', scale, color: 'white', shadow: 'ink' });
      hud.text(0, 8 + scale * 10, `MARKS ${sim.result.designated}`, { anchor: 'center', scale: wide ? 2 : 1, color: 'cyan', shadow: 'ink' });
      hud.text(0, 8 + scale * 18, sim.result.allySaved ? 'QUILL SAFE' : 'QUILL LOST', { anchor: 'center', scale: wide ? 2 : 1, color: 'lime', shadow: 'ink' });
    } else if (sim.phase === 'lost') {
      hud.text(0, -16, 'SHIP LOST', { anchor: 'center', scale: scale, color: 'red', shadow: 'ink' });
      hud.text(0, 18, 'FIRE TO REFLY', { anchor: 'center', scale: wide ? 2 : 1, color: 'sand', shadow: 'ink' });
    } else if (sim.t < 4 && !sim.paused) {
      hud.text(0, wide ? 58 : 78, 'STICK STEER', { anchor: 'bottom', scale: wide ? 2 : 1, color: 'mist', shadow: 'ink' });
    }
  }

  cameraTarget() {
    const craft = this.craft;
    if (!craft) return this.target.set(0, 0.4, 0);
    return this.target.set(craft.position.x, craft.position.y + 1.55, craft.position.z);
  }

  status() {
    const sim = this.sim;
    return `${sim.phase} s ${sim.s.toFixed(0)} sh ${sim.shields} score ${sim.score}`;
  }
}

const touchButtons = [
  { label: 'FIRE', code: 'KeyJ', hint: 'shot', at: { corner: 'bottom-right', x: 92, y: 96, size: 86 } },
  { label: 'BURST', code: 'KeyK', hint: 'bomb', at: { corner: 'bottom-right', x: 176, y: 52, size: 64 } },
  { label: 'ROLL', code: 'KeyL', hint: 'roll', at: { corner: 'bottom-right', x: 48, y: 176, size: 64 } },
  { label: 'BOOST', code: 'ShiftLeft', hint: 'fast', at: { corner: 'bottom-right', x: 168, y: 150, size: 60 } },
  { label: 'BRAKE', code: 'ControlLeft', hint: 'slow', at: { corner: 'bottom-left', x: 168, y: 48, size: 60 } },
  { label: 'PAUSE', code: 'Escape', hint: 'pause', at: { corner: 'top-right', x: 40, y: 40, size: 52 } },
];

await Engine.start(new VesperLane(), withUrlOptions({
  container: document.getElementById('app'),
  camera: { preset: 'third', distance: 8.4, fov: 46, stiffness: 18, zoom: 1 },
  look: LOOK,
  aspect: 'fill',
  background: PALETTE.night,
  debugKeys: false,
  touchBar: false,
  touchButtons,
}));
