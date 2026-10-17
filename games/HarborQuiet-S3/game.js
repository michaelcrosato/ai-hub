// Harbor Quiet — one district, one job.
//
// On foot: WASD / stick move, Space ✕ jump, C ○ crouch, J □ strike, G △ enter,
//   K or left mouse or R2 fire, right mouse or L2 aim, H or L1 Cold Read, R reload.
// In a car: stick / WASD throttle and steer (A left, D right), Space handbrake,
//   G exit, J horn, I or R1 next station, R2 drive-by.
// Q / E orbit the camera (the engine's third-person rig). Esc or Options pauses.
// Touch: left stick plus ✕ ○ □ △ R2 L2 L1.
import {
  Breakables, ContactShadow, Decals, ENGINE_VERSION, Engine, GrassField, HERO_CLIPS, HERO_MODEL, HERO_RIG,
  LOOK_PRESETS, NavGrid, PALETTE, PlatformerCharacter, Precipitation, RAPIER, THREE, Trail, Vehicle,
  WAVES_CALM, WaterSurface, addModelColliders, applySky, buildModel, compileClips, mergeStaticMeshes,
  readMoveInput, setLookLayer, skyAt, textureMap, toonMaterial, withUrlOptions,
} from './pixel-engine.js';
import { citizen, cruiser, lark, sedan, sidearm, van } from './models.js';
import { QUAY_FM, SALT_STATIC } from './songs.js';
import { MENU_ACT, MENU_LENGTH, createOverlay } from './ui.js';

const { BoxGeometry, CylinderGeometry, Mesh, Quaternion, Vector3 } = THREE;

const SOURCE_LINE = `Harbor Quiet-S3. Initial date: 2026-10-15. Source: Grand Theft Auto V, as a spiritual successor with original fiction, places, and audio. Engine: Pixel Engine ${ENGINE_VERSION} (build 2026-10-15 3f59c1e). Environment: Linux sandbox, Node 22, WebGPU browser; checks run in headless Chromium. Model: Grok 4.7 Build Browser Chat.`;

const SPAWN = [-24, 0, 2];
const CLINIC = [0, 0, 21];
const BAY = [-34.5, -14];
const SAFE = [-22.6, 2];
const RING = [
  [18, -14], [-18, -14], [-26, -8], [-26, 12], [-18, 16], [18, 16], [26, 10], [26, -8],
];
const LOOKS = ['neon_nights', 'noir', 'playstation', 'none', 'cel_cartoon'];
const QUALITY = ['auto', 'low', 'medium', 'high'];
const FPS = [60, 30, 0];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const hypot2 = (x, z) => Math.hypot(x, z);

function solids() {
  // Center x, z, full width, depth, height, palette name. Y sits on the ground.
  return [
    { x: -11, z: 1, w: 18, d: 18, h: 6, c: 'sand' },
    { x: 11, z: 1, w: 16, d: 16, h: 7, c: 'plum' },
    { x: -34.6, z: -19.2, w: 8, d: 2.4, h: 5, c: 'navy' },
    { x: -34.6, z: -8.8, w: 8, d: 2.4, h: 5, c: 'navy' },
    { x: -38.2, z: -14, w: 1.6, d: 13, h: 5, c: 'navy' },
    { x: 35, z: -2, w: 8, d: 20, h: 4.5, c: 'teal' },
    { x: 1, z: 27, w: 12, d: 6, h: 3.6, c: 'mist' },
  ];
}

function blockedCell(x, z, boxes) {
  if (z < -23.2 || z > 33.5 || x < -39 || x > 39) return true;
  for (const b of boxes) {
    if (Math.abs(x - b.x) < b.w / 2 + 0.4 && Math.abs(z - b.z) < b.d / 2 + 0.4) return true;
  }
  return false;
}

class HarborQuiet {
  name = 'Harbor Quiet';
  assets = [HERO_MODEL, 'assets/coin.glb'];

  constructor() {
    this.mode = 'title';
    this.menuFrom = 'title';
    this.menuI = 0;
    this.menuTick = 0;
    this.started = false;
    this.musicOn = false;
    this.station = 0;
    this.stations = [QUAY_FM, SALT_STATIC];
    this.stationName = ['QUAY FM', 'SALT STATIC'];
    this.stage = 'steal';
    this.cash = 240;
    this.heat = 0;
    this.cool = 0;
    this.hp = 100;
    this.armor = 0;
    this.focus = 3;
    this.mag = 12;
    this.reserve = 48;
    this.reload = 0;
    this.shotCd = 0;
    this.iframes = 0;
    this.crimeCd = 0;
    this.fenceCd = 0;
    this.airT = 0;
    this.stunt = false;
    this.cleared = false;
    this.armorGot = false;
    this.rammed = false;
    this.wasInBay = false;
    this.toast = '';
    this.toastT = 0;
    this.deadFrames = 0;
    this.ledgers = [false, false, false];
    this.lookI = 0;
    this.sound = 'med';
    this.forcedSteer = null;
    this.qaKeys = [];
    this.orbit = 0;
    this.camSnap = false;
    this.driving = null;
    this.prevSp = 0;
    this._feet = new Vector3();
    this._target = new Vector3();
    this._rayO = new Vector3();
    this._rayD = new Vector3();
    this._from = new Vector3();
    this._wp = new Vector3();
    this._wq = new Quaternion();
    this._flow = [0, 0];
    this.input = null;
    this.load();
  }

  load() {
    try {
      const s = JSON.parse(localStorage.getItem('harbor-quiet-s3') || 'null');
      if (!s || s.v !== 1) return;
      if (typeof s.cash === 'number') this.cash = s.cash;
      if (Array.isArray(s.ledgers)) this.ledgers = s.ledgers.map(Boolean).slice(0, 3);
      while (this.ledgers.length < 3) this.ledgers.push(false);
      this.stunt = !!s.stunt;
      this.cleared = !!s.cleared;
      this.armorGot = !!s.armorGot;
      if (this.cleared) this.stage = 'free';
    } catch { /* empty save is a new game */ }
  }

  save() {
    try {
      localStorage.setItem('harbor-quiet-s3', JSON.stringify({
        v: 1, cash: this.cash, ledgers: this.ledgers, stunt: this.stunt, cleared: this.cleared, armorGot: this.armorGot,
      }));
    } catch { /* private mode */ }
  }

  async setup(ctx) {
    this.ctx = ctx;
    const { scene, physics, palette } = ctx;
    applySky(ctx.engine, skyAt(17.7));
    if (ctx.engine.ambient.intensity < 0.75) ctx.engine.ambient.intensity = 0.95;

    const boxes = solids();
    this.boxes = boxes;
    const parts = [];
    const slab = (x, y, z, w, h, d, color, solid) => {
      if (solid) physics.addStaticBox({ position: [x, y, z], halfExtents: [w / 2, h / 2, d / 2] });
      const m = new Mesh(new BoxGeometry(w, h, d), toonMaterial(palette[color] ?? color));
      m.position.set(x, y, z);
      m.castShadow = m.receiveShadow = true;
      parts.push(m);
    };
    slab(0, -0.5, 6, 84, 1, 60, 'slate', true);
    slab(0, -2.1, -33, 84, 0.6, 16, 'navy', true);
    slab(0, 1.15, -23.6, 84, 2.3, 1.1, 'mist', true);
    slab(-41.2, 1.5, 6, 1.2, 3, 60, 'ink', true);
    slab(41.2, 1.5, 6, 1.2, 3, 60, 'ink', true);
    slab(0, 1.5, 35.4, 84, 3, 1.2, 'ink', true);
    // Asphalt reads darker than the stone ground. No collider: the ground already holds the cars.
    const road = (x, z, w, d) => slab(x, 0.045, z, w, 0.09, d, 'ink', false);
    road(-4, -14, 68, 8);
    road(-4, 16, 68, 8);
    road(-26, 1, 8, 38);
    road(26, 1, 8, 38);
    road(0, -20.6, 70, 4.2);
    for (const b of boxes) slab(b.x, b.h / 2, b.z, b.w, b.h, b.d, b.c, true);
    scene.add(...mergeStaticMeshes(parts));

    // Cobble strip on the quay, a texture so the promenade is not the same slab as the asphalt.
    const cobble = new Mesh(new BoxGeometry(60, 0.04, 3.2), toonMaterial(PALETTE.white, { map: textureMap('cobbles') }));
    cobble.position.set(0, 0.08, -21.2);
    cobble.receiveShadow = true;
    scene.add(cobble);

    const ramp = new Mesh(new BoxGeometry(3.2, 0.28, 6.5), toonMaterial(palette.sand));
    ramp.position.set(28.4, 0.72, 0);
    ramp.rotation.x = 0.4;
    ramp.castShadow = ramp.receiveShadow = true;
    scene.add(ramp);
    const rq = new Quaternion().setFromEuler(new THREE.Euler(0.4, 0, 0));
    const rampBody = physics.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(28.4, 0.72, 0).setRotation({ x: rq.x, y: rq.y, z: rq.z, w: rq.w }));
    physics.world.createCollider(RAPIER.ColliderDesc.cuboid(1.6, 0.14, 3.25), rampBody);

    this.water = new WaterSurface({ size: [88, 18], at: [0, -0.45, -33], waves: WAVES_CALM, opacity: 0.86, deep: 0x163044, shallow: 0x3c7594 });
    this.rain = new Precipitation({ kind: 'rain', count: 650, area: [48, 18, 48], color: 0xa9c0d0 });
    this.rain.intensity = 0.42;
    this.rain.wind.set(2.2, 0.4);
    this.grass = new GrassField({ area: [16, 9], at: [18, 0.05, 26], count: 650, base: 0x2f6a3c, tip: 0x9dcc6a });
    this.decals = new Decals(scene, { capacity: 64 });
    this.breaks = new Breakables(ctx);
    this.trail = new Trail({ width: 0.28, life: 0.45, color: PALETTE.ink, tail: PALETTE.slate, points: 18 });
    scene.add(this.water, this.rain, this.grass, this.trail);

    const dress = (id, x, z, yaw = 0, opts) => {
      const b = buildModel(id, opts);
      b.object.position.set(x, 0, z);
      b.object.rotation.y = yaw;
      scene.add(b.object);
      addModelColliders(physics, b, [x, 0, z], yaw);
      return b;
    };
    dress('lamp-post', -16, -20.4);
    dress('lamp-post', 0, -20.4);
    dress('lamp-post', 18, -20.4);
    dress('lamp-post', -16, 19.6);
    dress('lamp-post', 14, 22.4);
    dress('lamp-post', 26, 6);
    ctx.lights.request({ position: [-16, 2.3, -20.4], color: 0xffb060, intensity: 7, radius: 10 });
    ctx.lights.request({ position: [0, 2.3, -20.4], color: 0xffb060, intensity: 6, radius: 9 });
    ctx.lights.request({ position: [18, 2.3, -20.4], color: 0xffb060, intensity: 7, radius: 10 });
    ctx.lights.request({ position: [-16, 2.3, 19.6], color: 0xffc080, intensity: 6, radius: 9 });
    ctx.lights.request({ position: [14, 2.3, 22.4], color: 0xffc080, intensity: 6, radius: 9 });
    ctx.lights.request({ position: [26, 2.2, 6], color: 0xffb060, intensity: 5, radius: 8 });
    dress('oak', 20, 27, 0.4);
    dress('oak', 24, 24, 1.1);
    dress('park-bench', 8, 22.2, 0);
    dress('planter', 12, 21.2, 0, { params: { length: 1.6 } });
    dress('planter', 16, 21.2, 0, { params: { length: 1.4 } });
    dress('market-stall', 8, -20.5, Math.PI);
    dress('notice-board', -6, -20.2, Math.PI);
    dress('rope-coil', -28, -20.6);
    dress('crate-stack', -31.6, -18.2);
    dress('barrel', -30.2, -16.4);
    dress('crate', -30.4, -12.2);
    dress('hitching-post', -4, -11.2, Math.PI / 2);
    dress('signpost', -22, -10.5, 0.6);
    dress('path-lantern', 22, 20);
    dress('fence', 10, 20.6, 0, { params: { length: 6 } });
    dress('wide-window', -20.15, -2, Math.PI / 2, { params: { length: 3, height: 3 } });
    dress('wide-window', -20.15, 6, Math.PI / 2, { params: { length: 3, height: 3 } });
    dress('door', -20.15, 2.2, Math.PI / 2);
    dress('wide-window', 2.85, -4, -Math.PI / 2, { params: { length: 3, height: 3 } });

    const crossMat = toonMaterial(palette.white);
    const crossV = new Mesh(new BoxGeometry(0.16, 1.05, 0.1), crossMat);
    const crossH = new Mesh(new BoxGeometry(0.7, 0.16, 0.1), crossMat);
    crossV.position.set(-4.4, 2.15, 23.85);
    crossH.position.set(-4.4, 2.32, 23.85);
    scene.add(crossV, crossH);

    this.breaks.add({ at: [-31.2, 0.4, -16.6], size: [0.9, 0.8, 0.9], color: 'orange', cuts: [2, 2, 2] });
    this.breaks.add({ at: [-31.2, 0.4, -11.4], size: [0.9, 0.8, 0.9], color: 'red', cuts: [2, 2, 2] });

    const rows = [];
    for (let r = 0; r < 42; r++) {
      let s = '';
      for (let c = 0; c < 42; c++) {
        const x = -42 + (c + 0.5) * 2;
        const z = -42 + (r + 0.5) * 2;
        s += blockedCell(x, z, boxes) ? '#' : '.';
      }
      rows.push(s);
    }
    this.nav = NavGrid.fromRows(rows, { cell: 2, origin: [-42, 0, -42], blocked: '#' });

    this.colMap = new Map();
    this.rides = [];
    this.spawnRide(lark, { role: 'lark', at: [8, 0.95, -15.4], yaw: Math.PI / 2, power: 52, topSpeed: 22, grip: 2.7 });
    this.spawnRide(sedan, { role: 'parked', at: [-8, 0.95, -12.6], yaw: -Math.PI / 2, power: 36, topSpeed: 17 });
    this.spawnRide(van, { role: 'parked', at: [2, 1.05, 17.6], yaw: Math.PI / 2, power: 32, topSpeed: 14, mass: 11, wheel: 0.4 });
    this.spawnRide(sedan, { role: 'traffic', at: [-16, 0.95, -14], yaw: Math.PI, power: 30, topSpeed: 12, wp: 1 });
    this.spawnRide(van, { role: 'traffic', at: [8, 1.05, 16], yaw: Math.PI / 2, power: 28, topSpeed: 12, mass: 11, wheel: 0.4, wp: 5 });
    this.wardens = [
      this.spawnRide(cruiser, { role: 'warden', at: [0, -24, 0], yaw: 0, power: 48, topSpeed: 20, active: false }),
      this.spawnRide(cruiser, { role: 'warden', at: [4, -24, 0], yaw: 0, power: 48, topSpeed: 20, active: false }),
    ];

    const coin = await ctx.loadModel('assets/coin.glb', { castShadow: false });
    this.chips = [[-24, 0.85, -1.15], [16, 0.7, 23.2], [-8, 0.7, -20.6]].map(([x, y, z], i) => {
      const mesh = coin.scene.clone(true);
      mesh.position.set(x, y, z);
      setLookLayer(mesh, 'actors');
      mesh.visible = !this.ledgers[i];
      scene.add(mesh);
      return { mesh, x, z };
    });

    this.people = [];
    const coats = ['teal', 'plum', 'orange', 'green'];
    const spots = [[4, -12.2, 3], [-24, 8, 2.2], [14, 17.4, 2.4], [22, -15.5, 2]];
    for (let i = 0; i < spots.length; i++) {
      const [x, z, rad] = spots[i];
      this.people.push(this.makePerson(coats[i], x, z, { kind: 'ped', rad, hp: 40 }));
    }

    this.gunmen = [
      this.makePerson('red', -36, -15.2, { kind: 'gun', hp: 60, hidden: true }),
      this.makePerson('red', -36, -12.6, { kind: 'gun', hp: 60, hidden: true }),
      this.makePerson('plum', -32.4, -17.2, { kind: 'gun', hp: 70, hidden: true }),
    ];
    this.footWardens = [
      this.makePerson('navy', 0, 0, { kind: 'foot', hp: 80, hidden: true }),
      this.makePerson('navy', 2, 0, { kind: 'foot', hp: 80, hidden: true }),
    ];

    const arm = new Mesh(new BoxGeometry(0.45, 0.7, 0.45), toonMaterial(palette.mist));
    arm.position.set(0, 0.4, 22.1);
    setLookLayer(arm, 'actors');
    scene.add(arm);
    this.armorMesh = arm;
    this.armorMesh.visible = !this.armorGot;

    this.marker = new Mesh(new CylinderGeometry(0.18, 0.18, 7, 6), toonMaterial(palette.cyan));
    setLookLayer(this.marker, 'actors');
    scene.add(this.marker);

    const hero = await ctx.loadModel(HERO_MODEL, { castShadow: false });
    this.model = hero.scene;
    setLookLayer(this.model, 'actors');
    this.shadow = new ContactShadow(0.42);
    scene.add(this.model, this.shadow);
    this.hero = new PlatformerCharacter(physics, { position: SPAWN, lockDepth: false });
    this.hero.attachModel(this.model, compileClips(HERO_CLIPS, HERO_RIG, this.model), HERO_RIG);
    this.hero.facing = Math.PI;

    const gun = buildModel(sidearm);
    this.gun = gun.object;
    setLookLayer(this.gun, 'actors');
    scene.add(this.gun);

    ctx.audio.register('shot', { wave: 'square', freq: 220, freqEnd: 70, decay: 0.09, volume: 0.28, crush: 6, layers: [{ wave: 'noise', freq: 1400, decay: 0.08, volume: 0.22 }] });
    ctx.audio.register('siren', { wave: 'square', duty: 0.5, freq: 620, freqEnd: 880, sweepTime: 0.35, decay: 0.4, volume: 0.2 });
    ctx.audio.register('horn', { wave: 'saw', freq: 180, freqEnd: 160, decay: 0.28, volume: 0.22 });
    ctx.audio.register('clang', { wave: 'square', freq: 240, freqEnd: 90, decay: 0.12, volume: 0.2 });
    this.siren = ctx.audio.loop('siren', { volume: 0 });

    ctx.particles.register('muzzle', { count: [2, 3], life: [0.04, 0.09], speed: [1, 3], gravity: 0, size: [1, 2], colors: ['sand', 'white'] });
    ctx.particles.register('exhaust', { count: [1, 2], life: [0.3, 0.5], speed: [0.4, 1], gravity: -0.4, size: [1, 2], colors: ['mist', 'slate'] });

    // The engine's defaults are a platformer. Harbor Quiet remaps the pad onto the TV verbs.
    ctx.input.gamepadButtons = {
      0: 'Space', 1: 'KeyC', 2: 'KeyJ', 3: 'KeyG', 4: 'KeyH', 5: 'KeyR', 6: 'KeyL', 7: 'KeyK',
      8: 'KeyM', 9: 'Escape', 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight',
    };
    ctx.input.preventKeys.add('Escape');

    this.ui = createOverlay(SOURCE_LINE);
    this.ui.onAct((act) => {
      if (act === 'fullscreen') { this.toggleFs(); return; }
      ctx.input.send({ act });
    });
    this._onKey = (e) => {
      if (e.repeat || this.mode === 'play' || this.mode === 'dead') return;
      const act = MENU_ACT[this.mode]?.[this.menuI];
      if (act === 'fullscreen' && (e.code === 'Space' || e.code === 'Enter')) {
        this.fsFromKey = true;
        this.toggleFs();
      }
    };
    window.addEventListener('keydown', this._onKey);
    ctx.engine.timeScale = 0;
    if (new URLSearchParams(location.search).has('play')) this.begin();

    const game = this;
    window.__controlsTest = {
      getYaw: () => (game.driving ? game.driving.car.yaw : game.hero.facing),
      getSpeed: () => (game.driving ? game.driving.car.speed : game.hero.speed),
      setSteer: (v) => { game.forcedSteer = v; },
      setKeys: (codes) => {
        for (const c of game.qaKeys) ctx.input.setKey(c, false);
        game.qaKeys = [...codes];
        for (const c of game.qaKeys) ctx.input.setKey(c, true);
      },
      enterNearest: () => { game.begin(); game.tryEnter(true); },
    };
  }

  spawnRide(def, o) {
    const built = buildModel(def);
    const mesh = built.object;
    setLookLayer(mesh, 'actors');
    mesh.traverse((n) => { if (n.isMesh) n.castShadow = true; });
    const wheels = [];
    const geo = new CylinderGeometry(o.wheel ?? 0.36, o.wheel ?? 0.36, 0.22, 8);
    geo.rotateZ(Math.PI / 2);
    const mat = toonMaterial(PALETTE.night);
    for (let i = 0; i < 4; i++) {
      const w = new Mesh(geo, mat);
      w.castShadow = true;
      mesh.add(w);
      wheels.push(w);
    }
    this.ctx.scene.add(mesh);
    const car = new Vehicle(this.ctx.physics, {
      at: o.at, yaw: o.yaw ?? 0, power: o.power ?? 32, topSpeed: o.topSpeed ?? 15,
      mass: o.mass ?? 8, grip: o.grip ?? 2.6, size: [0.8, 0.26, 1.65],
      wheelRadius: o.wheel ?? 0.36, suspension: 0.42, stiffness: 640, steer: 0.6,
    });
    this.ctx.physics.bind(car.body, mesh);
    const ride = { car, mesh, wheels, hp: 100, role: o.role, wp: o.wp ?? 0, stuck: 0, active: o.active !== false, horn: 0 };
    if (!ride.active) {
      car.body.setEnabled(false);
      mesh.visible = false;
    }
    const n = car.body.numColliders();
    for (let i = 0; i < n; i++) this.colMap.set(car.body.collider(i).handle, { kind: 'car', ride });
    this.rides.push(ride);
    return ride;
  }

  makePerson(coat, x, z, o) {
    const built = buildModel(citizen, { palette: { coat, skin: 'sand', hair: coat === 'navy' ? 'ink' : 'plum', shoe: 'night', shade: 'ink' } });
    const mesh = built.object;
    setLookLayer(mesh, 'actors');
    mesh.position.set(x, 0, z);
    mesh.visible = !o.hidden;
    this.ctx.scene.add(mesh);
    return {
      mesh, x, z, homeX: x, homeZ: z, rad: o.rad ?? 0, hp: o.hp ?? 40, max: o.hp ?? 40,
      alive: !o.hidden, kind: o.kind, phase: x * 0.3, cool: 0, hidden: !!o.hidden,
    };
  }

  begin() {
    this.mode = 'play';
    if (!this.musicOn) {
      this.ctx.audio.playMusic(this.stations[this.station], 'radio');
      this.musicOn = true;
    }
    this.applyScale();
  }

  pause() {
    if (this.mode !== 'play') return;
    this.mode = 'pause';
    this.menuI = 0;
    this.applyScale();
  }

  back() {
    this.mode = this.menuFrom === 'pause' ? 'pause' : 'title';
    this.menuI = 0;
    this.applyScale();
  }

  applyScale() {
    const e = this.ctx?.engine;
    if (!e) return;
    if (this.mode !== 'play') e.timeScale = 0;
    else if (this.focusOn) e.timeScale = 0.42;
    else e.timeScale = 1;
  }

  toggleFs() {
    const el = document.documentElement;
    if (!document.fullscreenElement) el.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
  }

  optionText() {
    const v = this.ctx.engine.settings.values;
    const fps = v.fps ?? 60;
    return {
      look: LOOKS[this.lookI].replaceAll('_', ' '),
      pixel: v.pixelArt === false ? 'Off' : 'On',
      size: v.pixelSize === 'chunky' ? 'Chunky' : 'Fine',
      quality: v.quality ?? 'auto',
      fps: fps === 0 ? 'Display' : String(fps),
      sound: this.sound,
      debug: v.debugInfo ? 'On' : 'Off',
    };
  }

  tweak(act, dir) {
    const s = this.ctx.engine.settings;
    const v = s.values;
    if (act === 'look') {
      this.lookI = (this.lookI + dir + LOOKS.length) % LOOKS.length;
      const name = LOOKS[this.lookI];
      this.ctx.engine.setLook(LOOK_PRESETS[name] ?? LOOK_PRESETS.none);
      s.set({ look: name });
    } else if (act === 'pixel') s.set({ pixelArt: v.pixelArt === false });
    else if (act === 'size') s.set({ pixelSize: v.pixelSize === 'chunky' ? 'fine' : 'chunky' });
    else if (act === 'quality') {
      const cur = QUALITY.indexOf(v.quality ?? 'auto');
      s.set({ quality: QUALITY[(Math.max(0, cur) + dir + QUALITY.length) % QUALITY.length] });
    } else if (act === 'fps') {
      const cur = FPS.indexOf(v.fps ?? 60);
      s.set({ fps: FPS[(Math.max(0, cur) + dir + FPS.length) % FPS.length] });
    } else if (act === 'sound') {
      const order = ['low', 'med', 'high'];
      const i = (order.indexOf(this.sound) + dir + 3) % 3;
      this.sound = order[i];
      this.ctx.audio.setVolume('master', [0.35, 0.75, 1][i]);
    } else if (act === 'debug') s.set({ debugInfo: !v.debugInfo });
  }

  confirm() {
    const act = MENU_ACT[this.mode]?.[this.menuI];
    if (!act) return;
    if (act === 'fullscreen') {
      if (!this.fsFromKey) this.toggleFs();
      return;
    }
    this.onAct(act);
  }

  onAct(act) {
    if (act === 'start' || act === 'resume') this.begin();
    else if (act === 'pause') this.pause();
    else if (act === 'options') { this.menuFrom = this.mode === 'play' ? 'pause' : this.mode; this.mode = 'options'; this.menuI = 0; }
    else if (act === 'controls') { this.menuFrom = this.mode === 'play' ? 'pause' : this.mode; this.mode = 'controls'; this.menuI = 0; }
    else if (act === 'back') this.back();
    else if (act === 'restart') location.reload();
    else if (act === 'reset') {
      this.ctx.engine.settings.reset();
      this.ctx.audio.resetVolumes();
      this.sound = 'med';
      this.lookI = 0;
    } else if (act === 'fullscreen') this.toggleFs();
    this.applyScale();
  }

  say(text) { this.toast = text; this.toastT = 3.2; }

  pos() {
    if (this.driving) {
      const t = this.driving.car.body.translation();
      this._feet.set(t.x, t.y, t.z);
      return this._feet;
    }
    return this.hero.feetInto(this._feet);
  }

  addHeat(n) {
    const next = clamp(this.heat + n, 0, 4);
    if (next !== this.heat) this.say(next > this.heat ? `HEAT ${next}` : `HEAT ${next}`);
    this.heat = next;
    this.cool = 0;
    this.syncWardens();
  }

  syncWardens() {
    const want = this.heat <= 0 ? 0 : this.heat === 1 ? 1 : 2;
    for (let i = 0; i < this.wardens.length; i++) {
      const w = this.wardens[i];
      if (i < want && !w.active) this.deployWarden(w, i);
      if (i >= want && w.active && this.heat === 0) {
        w.active = false;
        w.car.body.setEnabled(false);
        w.mesh.visible = false;
      }
    }
  }

  deployWarden(w, i) {
    const p = this.pos();
    let best = RING[0];
    let bestD = -1;
    for (const r of RING) {
      const d = hypot2(r[0] - p.x, r[1] - p.z);
      if (d > bestD) { bestD = d; best = r; }
    }
    const yaw = Math.atan2(p.x - best[0], p.z - best[1]);
    w.car.body.setEnabled(true);
    w.mesh.visible = true;
    w.active = true;
    w.hp = 100;
    w.car.reset([best[0] + i * 2.4, 0.95, best[1]], yaw);
  }

  tryEnter(force) {
    if (this.driving) return;
    const p = this.pos();
    let best = null;
    let bestD = force ? 30 : 3.3;
    for (const r of this.rides) {
      if (!r.active || r.hp <= 0) continue;
      const t = r.car.body.translation();
      const d = hypot2(t.x - p.x, t.z - p.z);
      if (d < bestD && (force || Math.abs(r.car.speed) < 6)) { best = r; bestD = d; }
    }
    if (!best) return false;
    this.driving = best;
    const seat = best.car.body.translation();
    this.hero.body.setEnabled(false);
    this.hero.body.setTranslation({ x: seat.x, y: -40, z: seat.z }, true);
    this.model.visible = false;
    this.gun.visible = false;
    this.prevSp = Math.abs(best.car.speed);
    if (best.role === 'lark' && this.stage === 'steal') {
      this.stage = 'deliver';
      this.say('Bay it. West warehouse.');
    } else if (this.witnessNear() && this.crimeCd <= 0 && best.role !== 'lark') {
      this.addHeat(1);
      this.crimeCd = 3;
    }
    return true;
  }

  tryExit() {
    const r = this.driving;
    if (!r) return;
    const t = r.car.body.translation();
    const yaw = r.car.yaw;
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);
    this.hero.body.setEnabled(true);
    this.hero.teleport([t.x + rx * 2.4, 0.1, t.z + rz * 2.4]);
    this.hero.facing = yaw;
    this.model.visible = true;
    this.driving = null;
  }

  witnessNear() {
    const p = this.pos();
    return this.people.some((a) => a.alive && hypot2(a.x - p.x, a.z - p.z) < 18);
  }

  hurt(amount, sx, sz) {
    if (this.iframes > 0 || this.mode !== 'play' || this.hp <= 0) return;
    let d = amount;
    if (!this.driving && (this.crouch || String(this.hero.state).toLowerCase().includes('crouch'))) d *= 0.55;
    if (this.armor > 0) {
      const use = Math.min(this.armor, d);
      this.armor -= use;
      d -= use;
    }
    this.hp -= d;
    this.iframes = 0.55;
    this.ctx.audio.play('hurt');
    this.ctx.engine.shake.add(0.4);
    this.ctx.engine.screen.flash(PALETTE.red, { duration: 0.1 });
    if (!this.driving && sx != null) {
      const p = this.pos();
      this.hero.hurt(this._from.set(sx - p.x, 0, sz - p.z));
    }
    if (this.hp <= 0) this.blackout();
  }

  blackout() {
    this.hp = 0;
    this.mode = 'dead';
    this.deadFrames = 0;
    const loss = Math.max(40, Math.round(this.cash * 0.08));
    this.cash = Math.max(0, this.cash - loss);
    this.loss = loss;
    this.heat = 0;
    this.syncWardens();
    if (this.driving) this.tryExit();
    this.save();
    this.applyScale();
  }

  respawn() {
    this.hp = 100;
    this.armor = 0;
    this.iframes = 1.6;
    this.hero.body.setEnabled(true);
    this.hero.teleport([CLINIC[0], 0.1, CLINIC[2]]);
    this.hero.facing = Math.PI;
    this.model.visible = true;
    this.mode = 'play';
    if (this.stage === 'ambush') this.raiseGunmen();
    this.say('Reach Clinic. They kept a cut.');
    this.applyScale();
  }

  raiseGunmen() {
    const spots = [[-36, -15.2], [-36, -12.6], [-32.4, -17.2]];
    this.gunmen.forEach((g, i) => {
      g.alive = true;
      g.hidden = false;
      g.hp = g.max;
      g.x = spots[i][0];
      g.z = spots[i][1];
      g.mesh.visible = true;
      g.cool = 0.6;
    });
  }

  fire() {
    if (this.reload > 0 || this.shotCd > 0) return;
    if (this.mag <= 0) { this.reload = 0.95; return; }
    this.mag--;
    this.shotCd = 0.28;
    const ctx = this.ctx;
    const p = this.pos();
    ctx.camera.rayAt(0, 0, this._rayO, this._rayD);
    const spread = this.aiming ? 0.012 : 0.055;
    this._rayD.x += ctx.random.range(-spread, spread);
    this._rayD.y += ctx.random.range(-spread, spread);
    this._rayD.z += ctx.random.range(-spread, spread);
    this._rayD.normalize();
    this._rayO.set(p.x, (this.driving ? p.y : p.y) + 1.25, p.z);
    ctx.particles.burst('muzzle', this._rayO);
    ctx.audio.play('shot', { pitch: ctx.random.range(-1, 1), volume: 0.7 });
    const ignore = this.driving ? this.driving.car.body : this.hero.body;
    const hit = ctx.physics.castRay(this._rayO, this._rayD, 70, [], ignore);
    let actorHit = null;
    let actorT = 70;
    const actors = [...this.people, ...this.gunmen, ...this.footWardens];
    for (const a of actors) {
      if (!a.alive) continue;
      const ox = a.x - this._rayO.x;
      const oy = 0.9 - (this._rayO.y - (a.mesh.position.y));
      const oz = a.z - this._rayO.z;
      const t = ox * this._rayD.x + (0.9) * this._rayD.y + oz * this._rayD.z;
      if (t < 0 || t > actorT) continue;
      const px = this._rayO.x + this._rayD.x * t;
      const py = this._rayO.y + this._rayD.y * t;
      const pz = this._rayO.z + this._rayD.z * t;
      const dx = a.x - px;
      const dy = 0.9 - py;
      const dz = a.z - pz;
      if (dx * dx + dy * dy + dz * dz < 0.42 * 0.42) { actorHit = a; actorT = t; }
    }
    const wallT = hit ? hit.distance : 99;
    if (actorHit && actorT < wallT) {
      this.damageActor(actorHit, 28);
      ctx.particles.burst('impact', [actorHit.x, 1, actorHit.z]);
    } else if (hit) {
      const info = this.colMap.get(hit.collider.handle);
      if (info?.kind === 'car') this.damageCar(info.ride, 12);
      else {
        const br = this.breaks.blocks.find((b) => b.collider && b.collider.handle === hit.collider.handle && !b.broken);
        if (br) this.breaks.break(br, hit.point, 7);
        else this.decals.add('scorch', hit.point, hit.normal, { size: 0.45, color: PALETTE.ink, life: 8 });
      }
    }
    if (this.crimeCd <= 0) { this.addHeat(1); this.crimeCd = 4; }
    if (this.mag === 0 && this.reserve > 0) this.reload = 0.95;
  }

  damageActor(a, d) {
    if (!a.alive) return;
    a.hp -= d;
    this.ctx.audio.play('punch', { volume: 0.4 });
    if (a.hp > 0) return;
    a.alive = false;
    a.mesh.visible = false;
    this.ctx.particles.burst('smoke', [a.x, 0.8, a.z], { count: 10 });
    this.ctx.engine.hitstop(0.04);
    if (a.kind === 'ped') { this.cash += 15; this.addHeat(1); }
    if (a.kind === 'foot') this.addHeat(1);
    if (a.kind === 'gun' && this.gunmen.every((g) => !g.alive) && this.stage === 'ambush') {
      this.stage = 'escape';
      this.addHeat(0);
      this.heat = Math.max(this.heat, 2);
      this.say('Bay is clear. Lose the wardens.');
      this.syncWardens();
    }
  }

  damageCar(ride, d) {
    ride.hp = Math.max(0, ride.hp - d);
    this.ctx.particles.burst('smoke', ride.mesh.position, { count: 6 });
    if (ride.hp <= 0 && ride.role === 'warden') {
      ride.active = false;
      ride.car.body.setEnabled(false);
      ride.mesh.visible = false;
      const foot = this.footWardens.find((f) => !f.alive);
      if (foot) {
        const t = ride.car.body.translation();
        foot.alive = true;
        foot.hidden = false;
        foot.hp = foot.max;
        foot.x = t.x;
        foot.z = t.z;
        foot.mesh.visible = true;
      }
      this.addHeat(1);
    }
  }

  driveInput(ride, dt) {
    const ax = this.ctx.input.moveAxis();
    let steer = this.forcedSteer != null ? this.forcedSteer : ax.x;
    let throttle = ax.y;
    let brake = false;
    const sp = ride.car.speed;
    if (throttle < 0 && sp > 2) { brake = true; throttle = 0; }
    const handbrake = this.ctx.input.isDown('Space');
    if (this.focusOn) steer = clamp(steer * 1.15, -1, 1);
    ride.car.drive({ throttle, steer, brake, handbrake }, dt);
  }

  aiRide(ride, dt, px, pz, chase) {
    const t = ride.car.body.translation();
    if (Math.abs(ride.car.speed) < 0.45) ride.stuck += dt;
    else ride.stuck = 0;
    if (ride.stuck > 2.4) {
      const w = RING[ride.wp % RING.length];
      ride.car.reset([w[0], 0.95, w[1]], Math.atan2(px - w[0], pz - w[1]));
      ride.stuck = 0;
      ride.wp = (ride.wp + 1) % RING.length;
      return;
    }
    let tx;
    let tz;
    if (chase && hypot2(px - t.x, pz - t.z) < 26) { tx = px; tz = pz; }
    else {
      const w = RING[ride.wp % RING.length];
      tx = w[0];
      tz = w[1];
      if (hypot2(tx - t.x, tz - t.z) < 4) ride.wp = (ride.wp + 1) % RING.length;
    }
    const desired = Math.atan2(tx - t.x, tz - t.z);
    const diff = wrap(desired - ride.car.yaw);
    const steer = clamp(-diff / 0.5, -1, 1);
    const dist = hypot2(px - t.x, pz - t.z);
    let throttle = chase ? 0.92 : 0.78;
    let brake = Math.abs(diff) > 1;
    if (chase && dist < 7) { throttle = 0.25; brake = true; }
    ride.car.drive({ throttle, steer, brake, handbrake: false }, dt);
  }

  fixedUpdate(ctx, dt) {
    if (this.mode !== 'play') return;
    this.iframes = Math.max(0, this.iframes - dt);
    this.shotCd = Math.max(0, this.shotCd - dt);
    this.reload = Math.max(0, this.reload - dt);
    this.crimeCd = Math.max(0, this.crimeCd - dt);
    this.fenceCd = Math.max(0, this.fenceCd - dt);
    if (this.reload > 0 && this.reserve > 0 && this.mag < 12) {
      /* fills at the end of the timer */
    }
    if (this.reload === 0 && this._reloading) {
      const need = 12 - this.mag;
      const take = Math.min(need, this.reserve);
      this.mag += take;
      this.reserve -= take;
      this._reloading = false;
    }
    if (this.reload > 0) this._reloading = true;

    const aiming = ctx.input.isDown('KeyL') || ctx.input.isDown('MouseRight');
    this.aiming = aiming;
    this.focusHeld = ctx.input.isDown('KeyH') && this.focus > 0;
    this.crouch = ctx.input.isDown('KeyC');

    if (!this.driving) {
      this.input = readMoveInput(ctx, this.hero, this.input);
      if (aiming) this.input.move.multiplyScalar(0.55);
      if (this.focusHeld) this.input.move.multiplyScalar(0.85);
      this.hero.fixedUpdate(dt, this.input);
      this.crouch = this.crouch || !!this.input.crouch;
      if (ctx.input.consumePress('KeyG')) {
        if (!this.tryEnter(false) && this.stage === 'free') {
          const p = this.pos();
          if (hypot2(p.x - SAFE[0], p.z - SAFE[1]) < 3.2) {
            this.stage = 'steal';
            this.rammed = false;
            const larkRide = this.rides.find((r) => r.role === 'lark');
            larkRide.hp = 100;
            larkRide.car.reset([8, 0.95, -15.4], Math.PI / 2);
            this.say('Another Lark. Salt Row.');
          }
        }
      }
      if (ctx.input.consumePress('KeyR') && this.reload === 0 && this.mag < 12 && this.reserve > 0) this.reload = 0.95;
      if (ctx.input.consumePress('KeyK') || ctx.input.consumePress('MouseLeft')) this.fire();
      if (ctx.input.consumePress('KeyJ')) {
        const p = this.pos();
        const fx = Math.sin(this.hero.facing);
        const fz = Math.cos(this.hero.facing);
        for (const a of [...this.people, ...this.gunmen, ...this.footWardens]) {
          if (!a.alive) continue;
          const dx = a.x - p.x;
          const dz = a.z - p.z;
          if (dx * dx + dz * dz < 2.2 && dx * fx + dz * fz > 0.2) this.damageActor(a, 26);
        }
      }
    } else {
      this.driveInput(this.driving, dt);
      if (ctx.input.consumePress('KeyG')) this.tryExit();
      if (ctx.input.consumePress('KeyK') || ctx.input.consumePress('MouseLeft')) this.fire();
      if (ctx.input.consumePress('KeyJ') && this.driving.horn <= 0) {
        ctx.audio.play('horn');
        this.driving.horn = 0.45;
      }
      if (ctx.input.consumePress('KeyI') || ctx.input.consumePress('KeyR')) {
        this.station = (this.station + 1) % this.stations.length;
        ctx.audio.playMusic(this.stations[this.station], 'radio');
      }
      this.driving.horn = Math.max(0, this.driving.horn - dt);
      const sp = Math.abs(this.driving.car.speed);
      const drop = this.prevSp - sp;
      if (drop > 8) {
        this.damageCar(this.driving, drop * 1.4);
        this.hurt(drop * 0.55);
        ctx.audio.play('clang');
        ctx.engine.shake.add(0.3);
      }
      this.prevSp = sp;
    }

    const p = this.pos();
    for (const r of this.rides) {
      if (!r.active || r === this.driving) continue;
      if (r.role === 'traffic') this.aiRide(r, dt, p.x, p.z, false);
      else if (r.role === 'warden') this.aiRide(r, dt, p.x, p.z, true);
      else r.car.drive({ throttle: 0, steer: 0, brake: true }, dt);
    }

    this.stepActors(dt, p);
    this.stepMission(dt, p);
    this.stepHeat(dt, p);
    this.stepPickups(p);

    if (p.y < -0.7) this.hurt(100);
  }

  stepActors(dt, p) {
    this.nav.flowTo(p.x, p.z);
    const slide = (a, dx, dz) => {
      const nx = a.x + dx;
      const nz = a.z + dz;
      if (this.nav.walkable(nx, nz)) { a.x = nx; a.z = nz; }
      else if (this.nav.walkable(nx, a.z)) a.x = nx;
      else if (this.nav.walkable(a.x, nz)) a.z = nz;
    };
    for (const a of this.people) {
      if (!a.alive) continue;
      if (this.heat > 0 || this.crimeCd > 2) {
        const dx = a.x - p.x;
        const dz = a.z - p.z;
        const l = hypot2(dx, dz) || 1;
        slide(a, (dx / l) * 3.2 * dt, (dz / l) * 3.2 * dt);
      } else {
        a.phase += dt * 0.55;
        const nx = a.homeX + Math.cos(a.phase) * a.rad;
        const nz = a.homeZ + Math.sin(a.phase * 0.7) * 0.8;
        if (this.nav.walkable(nx, nz)) { a.x = nx; a.z = nz; }
      }
    }
    for (const a of this.footWardens) {
      if (!a.alive) continue;
      if (this.nav.flowDirection(a.x, a.z, this._flow)) slide(a, this._flow[0] * 3.4 * dt, this._flow[1] * 3.4 * dt);
      this.hostileshoot(a, p, dt, 16, 8);
    }
    for (const a of this.gunmen) {
      if (!a.alive) continue;
      const dx = p.x - a.x;
      const dz = p.z - a.z;
      const dist = hypot2(dx, dz);
      if (dist > 8) slide(a, (dx / dist) * 2.2 * dt, (dz / dist) * 2.2 * dt);
      this.hostileshoot(a, p, dt, 18, 9);
    }
    if (!this.driving) {
      for (const r of this.rides) {
        if (!r.active) continue;
        const t = r.car.body.translation();
        if (hypot2(t.x - p.x, t.z - p.z) < 1.55 && Math.abs(r.car.speed) > 7) this.hurt(22, t.x, t.z);
      }
    }
    for (const a of this.people) {
      if (!a.alive) continue;
      for (const r of this.rides) {
        if (!r.active) continue;
        const t = r.car.body.translation();
        if (hypot2(t.x - a.x, t.z - a.z) < 1.5 && Math.abs(r.car.speed) > 5) {
          this.damageActor(a, 80);
          break;
        }
      }
    }
  }

  hostileshoot(a, p, dt, range, dmg) {
    a.cool -= dt;
    const dist = hypot2(a.x - p.x, a.z - p.z);
    if (dist > range || a.cool > 0) return;
    const see = this.sees(a.x, 1.2, a.z, p.x, p.y + 1, p.z);
    if (!see) return;
    a.cool = a.kind === 'gun' ? 0.85 : 1;
    this.ctx.audio.play('shot', { volume: 0.35, pitch: -2 });
    this.ctx.particles.burst('muzzle', [a.x, 1.2, a.z]);
    this.hurt(dmg, a.x, a.z);
  }

  sees(x, y, z, tx, ty, tz) {
    const dx = tx - x;
    const dy = ty - y;
    const dz = tz - z;
    const len = Math.hypot(dx, dy, dz) || 1;
    this._rayO.set(x, y, z);
    this._rayD.set(dx / len, dy / len, dz / len);
    const hit = this.ctx.physics.castRay(this._rayO, this._rayD, len, [], this.driving?.car.body);
    return !hit || hit.distance > len - 1.3;
  }

  stepMission(dt, p) {
    const lark = this.rides.find((r) => r.role === 'lark');
    const inBay = this.driving === lark && hypot2(p.x - BAY[0], p.z - BAY[1]) < 5;
    if (this.stage === 'deliver' && inBay) {
      this.stage = 'ambush';
      this.raiseGunmen();
      this.heat = Math.max(this.heat, 2);
      this.syncWardens();
      this.say('They were waiting. Clear them, or ram out.');
    }
    if (this.stage === 'ambush' && this.wasInBay && !inBay && this.driving === lark && this.gunmen.some((g) => g.alive)) {
      this.stage = 'escape';
      this.rammed = true;
      this.heat = Math.max(this.heat, 3);
      this.damageCar(lark, 18);
      this.syncWardens();
      this.say('You punched through. Lose them.');
    }
    this.wasInBay = inBay || (this.stage === 'ambush' && inBay);
    if (this.stage === 'escape' && this.heat === 0) {
      this.stage = 'payout';
      this.say('Quiet. Collect at the rooms.');
    }
    if (this.stage === 'payout' && !this.driving && hypot2(p.x - SAFE[0], p.z - SAFE[1]) < 3) {
      const cond = clamp(lark.hp / 100, 0.15, 1);
      const pay = Math.round(1800 * cond) + 500 + (this.rammed ? 0 : 450);
      this.cash += pay;
      this.stage = 'free';
      this.cleared = true;
      this.save();
      this.ctx.audio.play('fanfare');
      this.ctx.particles.burst('sparkle', [p.x, 1.4, p.z], { count: 24 });
      this.say(`Moss pays $${pay}. The reach is open.`);
    }
    if (this.stage === 'free' && this.driving && this.fenceCd <= 0 && hypot2(p.x - BAY[0], p.z - BAY[1]) < 5 && this.driving.hp > 25) {
      this.cash += 200;
      this.fenceCd = 20;
      this.save();
      this.ctx.audio.play('coin');
      this.say('Fenced. $200.');
    }
  }

  stepHeat(dt, p) {
    if (this.heat <= 0) return;
    let seen = false;
    const watchers = [
      ...this.wardens.filter((w) => w.active).map((w) => ({ x: w.car.body.translation().x, z: w.car.body.translation().z, y: 1.2 })),
      ...this.footWardens.filter((a) => a.alive),
      ...this.gunmen.filter((a) => a.alive),
    ];
    for (const w of watchers) {
      const dist = hypot2(w.x - p.x, w.z - p.z);
      if (dist < 22 && this.sees(w.x, w.y ?? 1.2, w.z, p.x, p.y + 1, p.z)) seen = true;
    }
    this.spotted = seen;
    if (seen) this.cool = 0;
    else {
      this.cool += dt;
      if (this.cool > 7) {
        this.heat -= 1;
        this.cool = 0;
        this.say(this.heat ? `HEAT ${this.heat}` : 'You lost them.');
        if (this.heat === 0) this.syncWardens();
      }
    }
    for (const w of this.wardens) {
      if (!w.active || this.heat < 2) continue;
      const t = w.car.body.translation();
      const dist = hypot2(t.x - p.x, t.z - p.z);
      w.shoot = (w.shoot ?? 0) - dt;
      if (dist < 20 && w.shoot <= 0 && this.sees(t.x, t.y + 0.6, t.z, p.x, p.y + 1, p.z)) {
        w.shoot = 0.9;
        this.ctx.audio.play('shot', { volume: 0.3, pitch: -3 });
        this.hurt(7, t.x, t.z);
      }
    }
  }

  stepPickups(p) {
    if (this.driving) return;
    this.chips.forEach((c, i) => {
      if (this.ledgers[i]) return;
      if (hypot2(c.x - p.x, c.z - p.z) < 1.25) {
        this.ledgers[i] = true;
        c.mesh.visible = false;
        this.cash += 150;
        this.ctx.audio.play('coin');
        this.ctx.particles.burst('sparkle', c.mesh.position);
        this.say('Ledger chip. $150.');
        this.save();
      }
    });
    if (!this.armorGot && hypot2(p.x - 0, p.z - 22.1) < 1.3) {
      this.armorGot = true;
      this.armor = Math.min(100, this.armor + 50);
      this.armorMesh.visible = false;
      this.ctx.audio.play('coin', { pitch: 4 });
      this.say('Clinic vest.');
      this.save();
    }
  }

  update(ctx, dt) {
    const real = ctx.engine.timeScale > 0 ? dt / ctx.engine.timeScale : dt;
    this.fsFromKey = false;
    for (const c of ctx.input.commands) if (c && c.act) this.onAct(c.act);

    if (this.mode !== 'play' && this.mode !== 'dead') {
      if (ctx.input.wasPressed('ArrowUp')) this.menuI--;
      if (ctx.input.wasPressed('ArrowDown')) this.menuI++;
      const ax = ctx.input.moveAxis();
      if (Math.abs(ax.y) > 0.6) {
        this.menuTick++;
        if (this.menuTick % 14 === 1) this.menuI += ax.y > 0 ? -1 : 1;
      } else this.menuTick = 0;
      const n = MENU_LENGTH[this.mode] || 1;
      this.menuI = (this.menuI % n + n) % n;
      if (ctx.input.wasPressed('ArrowLeft')) this.tweak(MENU_ACT[this.mode][this.menuI], -1);
      if (ctx.input.wasPressed('ArrowRight')) this.tweak(MENU_ACT[this.mode][this.menuI], 1);
      if (ctx.input.wasPressed('Space') || ctx.input.wasPressed('Enter')) this.confirm();
      if (ctx.input.wasPressed('KeyC') && this.mode !== 'title') this.back();
      this.ui.setFocus(this.mode, this.menuI);
      this.ui.optionLabels(this.optionText());
    }
    if (ctx.input.wasPressed('Escape')) {
      if (this.mode === 'play') this.pause();
      else if (this.mode === 'pause') this.begin();
      else if (this.mode === 'options' || this.mode === 'controls') this.back();
    }

    if (this.mode === 'dead') {
      this.deadFrames++;
      if (this.deadFrames > 130) this.respawn();
    }

    if (this.mode === 'play') {
      this.focusOn = this.focusHeld && this.focus > 0.05;
      if (this.focusOn) this.focus = Math.max(0, this.focus - real);
      else this.focus = Math.min(3, this.focus + real * 0.38);
      if (this.focus <= 0) this.focusOn = false;
    } else this.focusOn = false;
    this.applyScale();

    if (this.model.visible) {
      this.hero.updateVisual(this.model, dt, ctx.physics.alpha);
      const feet = this.model.position;
      const g = ctx.physics.groundBelow(this._target.set(feet.x, feet.y + 0.2, feet.z), 8, this.hero.body);
      this.shadow.visible = !!g;
      if (g) this.shadow.place(feet.x, g.y, feet.z, feet.y - g.y);
      const face = this.hero.facing;
      const rx = Math.cos(face);
      const rz = -Math.sin(face);
      this.gun.visible = true;
      this.gun.position.set(feet.x + rx * 0.32, feet.y + 1.02, feet.z + rz * 0.32);
      this.gun.rotation.set(0.4, face, 0.2);
    } else {
      this.shadow.visible = false;
      this.gun.visible = false;
    }

    for (const r of this.rides) {
      if (!r.mesh.visible) continue;
      for (let i = 0; i < 4; i++) {
        r.car.wheelPose(i, this._wp, this._wq, true);
        r.wheels[i].position.copy(this._wp);
        r.wheels[i].quaternion.copy(this._wq);
      }
    }

    const tnow = ctx.time;
    for (const a of [...this.people, ...this.gunmen, ...this.footWardens]) {
      if (!a.mesh.visible) continue;
      a.mesh.position.set(a.x, Math.sin(tnow * 6 + a.phase) * 0.03, a.z);
      const dx = (this.driving ? this.pos().x : this.hero.feetInto(this._feet).x) - a.x;
      const dz = this.pos().z - a.z;
      if (dx * dx + dz * dz > 0.04) a.mesh.rotation.y = Math.atan2(dx, dz);
    }
    for (const c of this.chips) if (c.mesh.visible) c.mesh.rotation.y += dt * 2.4;

    this.water.update(ctx.time);
    this.rain.update(dt, ctx.camera.focus);
    this.grass.update(ctx.time);
    this.grass.push(0, this.model.position, this.model.visible ? 0.8 : 0);
    this.decals.update(dt);
    this.breaks.update(dt, this.hero.groundCollider);
    if (this.driving && (this.ctx.input.isDown('Space') || this.driving.car.slip > 2.4) && Math.abs(this.driving.car.speed) > 4) {
      const t = this.driving.car.body.translation();
      const yaw = this.driving.car.yaw;
      this.trail.push(this._target.set(t.x - Math.sin(yaw) * 1.4, 0.08, t.z - Math.cos(yaw) * 1.4), ctx.time);
    }
    this.trail.update(ctx.time, ctx.camera.camera);
    if (this.driving && ctx.input.moveAxis().y > 0.4 && Math.random() < dt * 8) {
      // exhaust is cosmetic; Math.random would desync replays, so use a fork once
    }
    this.puff = (this.puff ?? 0) - dt;
    if (this.driving && this.puff <= 0 && ctx.input.moveAxis().y > 0.3) {
      this.puff = 0.12;
      const t = this.driving.car.body.translation();
      const yaw = this.driving.car.yaw;
      ctx.particles.burst('exhaust', [t.x - Math.sin(yaw) * 1.7, t.y - 0.2, t.z - Math.cos(yaw) * 1.7]);
    }

    if (this.driving && this.mode === 'play') {
      let contact = false;
      for (let i = 0; i < 4; i++) if (this.driving.car.controller.wheelIsInContact(i)) contact = true;
      if (!contact && Math.abs(this.driving.car.speed) > 7) this.airT += dt;
      else {
        if (this.airT > 0.5 && !this.stunt) {
          this.stunt = true;
          this.cash += 250;
          this.save();
          this.say('Stunt. $250.');
          ctx.audio.play('fanfare', { volume: 0.6 });
          ctx.engine.screen.shockwave(this.pos(), { radius: 0.35 });
        }
        this.airT = 0;
      }
    }

    this.followCam(ctx, dt);
    this.placeMarker();
    if (this.toastT > 0) this.toastT -= dt;
    const near = this.nearestWarden();
    if (this.siren) {
      const vol = this.heat > 0 ? clamp(0.45 - near.d / 90, 0, 0.4) : 0;
      this.siren.set({ volume: vol, pan: clamp(near.x / 24, -1, 1) });
    }
    this.drawHud(ctx);
    this.drawMap();
    this.ui.searching(this.heat > 0 && !this.spotted);
    this.ui.root.classList.toggle('touch', !!document.querySelector('.touch-ui'));
  }

  nearestWarden() {
    const p = this.pos();
    let d = 99;
    let x = 0;
    for (const w of this.wardens) {
      if (!w.active) continue;
      const t = w.car.body.translation();
      const dd = hypot2(t.x - p.x, t.z - p.z);
      if (dd < d) { d = dd; x = t.x - p.x; }
    }
    return { d, x };
  }

  followCam(ctx, dt) {
    const rig = ctx.camera;
    if (rig.preset !== 'third' || typeof rig.yaw !== 'number') return;
    const yaw = this.driving ? this.driving.car.yaw : this.hero.facing;
    if (!this.camSnap) { rig.yaw = yaw + Math.PI; this.camSnap = true; }
    const md = ctx.input.mouseDelta;
    if (Math.abs(md.x) + Math.abs(md.y) > 1.2) this.orbit = 0.85;
    if (ctx.input.isDown('KeyQ') || ctx.input.isDown('KeyE')) this.orbit = 0.4;
    this.orbit = Math.max(0, this.orbit - dt);
    if (this.orbit === 0 && this.mode === 'play') {
      const want = yaw + Math.PI;
      const d = wrap(want - rig.yaw);
      rig.yaw += d * (1 - Math.exp(-3.2 * Math.max(dt, 0.001)));
    }
    const wantD = this.aiming ? 4.4 : this.driving ? 9.2 : 7.4;
    if (typeof rig.baseDistance === 'number') rig.baseDistance += (wantD - rig.baseDistance) * Math.min(1, dt * 4);
  }

  objective() {
    const lark = this.rides.find((r) => r.role === 'lark');
    if (this.stage === 'steal') return { x: 8, z: -15.4, k: 'JOB', t: 'Take the amber Lark on Salt Row.' };
    if (this.stage === 'deliver') return { x: BAY[0], z: BAY[1], k: 'JOB', t: 'Bay the Lark in the west warehouse.' };
    if (this.stage === 'ambush') return { x: BAY[0], z: BAY[1], k: 'JOB', t: 'Clear the bay, or ram the Lark out.' };
    if (this.stage === 'escape') return { x: this.pos().x, z: this.pos().z, k: 'HEAT', t: 'Break their line of sight until the heat dies.' };
    if (this.stage === 'payout') return { x: SAFE[0], z: SAFE[1], k: 'JOB', t: 'Collect from the rooms on the west road.' };
    return { x: BAY[0], z: BAY[1], k: 'FREE', t: lark ? 'Fence a car at the bay. △ at the rooms runs the job again.' : 'The reach is open.' };
  }

  placeMarker() {
    const o = this.objective();
    const hide = this.stage === 'escape' || this.stage === 'free';
    this.marker.visible = !hide && this.mode === 'play';
    this.marker.position.set(o.x, 3.4 + Math.sin(this.ctx.time * 2) * 0.25, o.z);
  }

  drawHud() {
    const o = this.objective();
    const screen = this.mode === 'dead' ? 'dead' : this.mode;
    this.ui.screen(screen);
    const lark = this.rides.find((r) => r.role === 'lark');
    const inLark = this.driving?.role === 'lark';
    const kph = this.driving ? Math.abs(this.driving.car.speed) * 3.6 : 0;
    const cond = inLark ? `  LARK ${Math.round(this.driving.hp)}%` : '';
    const weapon = this.driving ? `${Math.round(kph)} KM/H${cond}` : `SIDEARM ${this.mag}/${this.reserve}${this.reload > 0 ? '  RELOAD' : ''}`;
    const hints = this.driving
      ? '✕ handbrake   △ exit   □ horn   R2 fire   L1 Cold Read   R1 station'
      : '✕ jump   ○ crouch   □ strike   △ ride   R2 fire   L2 aim   L1 Cold Read';
    this.ui.hud({
      cash: `$${this.cash}`,
      kicker: o.k,
      obj: o.t,
      toast: this.toastT > 0 ? this.toast : '',
      radio: this.driving ? this.stationName[this.station] : (this.heat && !this.spotted ? 'SEARCHING' : ''),
      hints,
      meta: `${weapon}   FOCUS`,
      hp: clamp(this.hp, 0, 100),
      arm: clamp(this.armor, 0, 100),
      focus: (this.focus / 3) * 100,
      heat: this.heat,
      dead: this.loss ? `You wake at Reach Clinic. They kept $${this.loss}.` : 'You wake at Reach Clinic.',
    });
  }

  drawMap() {
    const g = this.ui.map;
    const cv = this.ui.mapCanvas;
    const w = cv.width;
    const h = cv.height;
    const X = (x) => ((x + 42) / 84) * w;
    const Y = (z) => ((z + 42) / 84) * h;
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#171b22';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#243246';
    g.fillRect(X(-42), Y(-40), X(42) - X(-42), Y(-23) - Y(-40));
    g.fillStyle = '#2a2e36';
    g.fillRect(X(-38), Y(-18), X(34) - X(-38), Y(-10) - Y(-18));
    g.fillRect(X(-38), Y(12), X(34) - X(-38), Y(20) - Y(12));
    g.fillRect(X(-30), Y(-18), X(-22) - X(-30), Y(20) - Y(-18));
    g.fillRect(X(22), Y(-18), X(30) - X(22), Y(20) - Y(-18));
    g.fillStyle = '#3a342c';
    for (const b of this.boxes) g.fillRect(X(b.x - b.w / 2), Y(b.z - b.d / 2), (b.w / 84) * w, (b.d / 84) * h);
    const dot = (x, z, color, r) => {
      g.fillStyle = color;
      g.beginPath();
      g.arc(X(x), Y(z), r, 0, Math.PI * 2);
      g.fill();
    };
    this.chips.forEach((c, i) => { if (!this.ledgers[i]) dot(c.x, c.z, '#e4a23a', 2.5); });
    for (const r of this.rides) {
      if (!r.active || !r.mesh.visible) continue;
      const t = r.car.body.translation();
      dot(t.x, t.z, r.role === 'warden' ? '#d24b4b' : r.role === 'lark' ? '#e4a23a' : '#9aa3b2', r === this.driving ? 0 : 2.2);
    }
    if (this.heat > 0 && !this.spotted) {
      g.strokeStyle = 'rgba(210,75,75,.7)';
      for (const w of this.wardens) {
        if (!w.active) continue;
        const t = w.car.body.translation();
        const yaw = w.car.yaw;
        g.beginPath();
        g.moveTo(X(t.x), Y(t.z));
        g.lineTo(X(t.x + Math.sin(yaw - 0.45) * 14), Y(t.z + Math.cos(yaw - 0.45) * 14));
        g.lineTo(X(t.x + Math.sin(yaw + 0.45) * 14), Y(t.z + Math.cos(yaw + 0.45) * 14));
        g.closePath();
        g.stroke();
      }
    }
    const o = this.objective();
    if (this.stage !== 'escape') dot(o.x, o.z, '#7dcec4', 3);
    const p = this.pos();
    const yaw = this.driving ? this.driving.car.yaw : this.hero.facing;
    g.save();
    g.translate(X(p.x), Y(p.z));
    g.rotate(Math.atan2(Math.cos(yaw), Math.sin(yaw)));
    g.fillStyle = '#efe6d4';
    g.beginPath();
    g.moveTo(6, 0);
    g.lineTo(-4, 4);
    g.lineTo(-4, -4);
    g.closePath();
    g.fill();
    g.restore();
  }

  cameraTarget() {
    const p = this.model?.position;
    if (this.driving) {
      const t = this.driving.car.body.translation();
      return this._target.set(t.x, t.y + 0.7, t.z);
    }
    if (!p) return this._target.set(SPAWN[0], 1, SPAWN[2]);
    return this._target.set(p.x, p.y + 1.1, p.z);
  }

  onCameraChange(ctx) {
    this.hero?.setLockDepth(false);
    if (this.model) this.model.visible = !ctx.camera.hidesTarget && !this.driving;
  }

  status() {
    const chips = this.ledgers.filter(Boolean).length;
    const p = this.hero ? this.pos() : { x: 0, z: 0 };
    return `${this.mode} ${this.stage} heat ${this.heat} cash ${this.cash} ledgers ${chips}/3 hp ${Math.ceil(this.hp)} @${Math.round(p.x)},${Math.round(p.z)}`;
  }

  fingerprint() {
    return this.status();
  }

  dispose() {
    this.ui?.dispose();
    if (this._onKey) window.removeEventListener('keydown', this._onKey);
  }
}

await Engine.start(new HarborQuiet(), withUrlOptions({
  container: document.getElementById('app'),
  camera: { preset: 'third', distance: 7.6, fov: 46, pitch: 16 },
  look: LOOK_PRESETS.neon_nights,
  background: PALETTE.night,
  settings: false,
  debugKeys: { resolution: 'F2' },
  touchButtons: [
    { label: '✕', code: 'Space', hint: 'jump' },
    { label: '○', code: 'KeyC', hint: 'crouch' },
    { label: '□', code: 'KeyJ', hint: 'strike' },
    { label: '△', code: 'KeyG', hint: 'ride' },
    { label: 'R2', code: 'KeyK', hint: 'fire' },
    { label: 'L2', code: 'KeyL', hint: 'aim' },
    { label: 'L1', code: 'KeyH', hint: 'focus' },
  ],
}));
