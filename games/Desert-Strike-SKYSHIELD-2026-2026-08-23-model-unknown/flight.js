/**
 * flight.js — one sortie: the flight scene, the combat simulation and the
 * phase flow (briefing → fly → debrief → next phase, retry, abort).
 *
 * The simulation is the original game's per-frame logic, rule for rule:
 * speeds, damage, cooldowns, spawn timers, aim cones, scoring and the
 * objective rules are unchanged. What changed is noted where it happens.
 */

import * as THREE from 'three/webgpu';
import {
  BIOMES,
  ENEMY_HP,
  ENEMY_COLOR,
  ENEMY_NAME,
  isStream,
  halfSize,
  farpsFor,
  entryPoint,
  spawnAnchors,
  escortPoint,
  phaseTargetCount,
  phaseAward,
  controlNote,
  pickTracked,
  hashString,
  lcg,
  clamp,
} from './data.js';
import { buildNightjar, buildEnemyModel, buildHealthBar, buildTrackMarker, buildObjectiveMarker, buildFarp, enemyColor } from './models.js';
import { createWorld, prewarmGroup } from './world.js';
import { Effects } from './effects.js';
import { FlightUI } from './hud.js';
import * as audio from './audio.js';
import { firstFocus } from './nav.js';

const PI = Math.PI;
const GROUND = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const ENEMY_KINDS = ['technical', 'sam', 'drone', 'tank', 'gunboat', 'jammer', 'boss'];
const HELD_ACTIONS = ['fire', 'rocket', 'flare', 'service', 'boost'];

export const markerColorFor = (mode) => (mode === 'deuteranopia' ? '#ffd166' : mode === 'tritanopia' ? '#ff87ab' : '#ffbd59');
export const threatColorFor = (mode) => (mode === 'deuteranopia' ? '#e76f51' : mode === 'tritanopia' ? '#ff7f50' : '#ff5c52');
const diffMul = (d, cadet, ace) => (d === 'cadet' ? cadet : d === 'ace' ? ace : 1);

export class Sortie {
  /**
   * env: { kit, camera, host, getSettings, prompts, onCheckpoint, onComplete, onAbort, openSettings, openManual, isModalOpen }
   * opts: { mission, startPhase, startStage, initialScore, initialPhaseScore, initialElapsed, upgrades }
   */
  constructor(env, opts) {
    this.env = env;
    this.kit = env.kit;
    this.camera = env.camera;
    const m = (this.m = opts.mission);
    this.stream = isStream(m);
    this.limit = halfSize(m) - 5;
    this.farps = farpsFor(m);
    this.upgrades = opts.upgrades;
    this.startPhase = clamp(opts.startPhase, 0, m.phases.length - 1);
    this.startStage = opts.startStage === 'debrief' ? 'debrief' : 'briefing';
    this.phaseIndex = this.startPhase;
    this.cumulative = opts.initialScore || 0;
    this.phaseScore = opts.initialPhaseScore || 0;
    this.elapsed = opts.initialElapsed || 0;
    this.phaseDone = this.startStage === 'debrief';
    this.retries = 0;
    this.story = this.startStage;
    this.paused = false;
    this.mapOpen = false;
    this.failure = null;
    this.deathTimer = 0;
    this.dirty = true;
    this.camMode = env.getSettings().camera;

    const settings = env.getSettings();
    this.markerColor = markerColorFor(settings.colorMode);
    this.threatColor = threatColorFor(settings.colorMode);

    this.buildScene();
    this.ui = new FlightUI(env.host, m, env.getSettings, env.prompts);
    this.hud = {
      armor: 100,
      fuel: 100,
      rockets: 24,
      flares: 8,
      heat: 0,
      altitude: 100,
      speed: 0,
      score: 0,
      totalScore: this.cumulative,
      alert: 0,
      progress: 0,
      target: 1,
      insideZone: false,
      lock: false,
      enemies: 0,
      playerX: 0,
      playerZ: 0,
      objectiveX: 0,
      objectiveZ: 0,
      phaseElapsed: 0,
      resupply: false,
      actionHint: null,
      blips: Array.from({ length: 16 }, () => ({ x: 0, z: 0, target: false })),
      blipCount: 0,
    };
    this.resetSim();
    this.startPhase_();
    this.showStory();
    this.prewarm();
  }

  /* ------------------------------------------------------------ scene */

  buildScene() {
    const m = this.m;
    const kit = this.kit;
    const b = BIOMES[m.biome];
    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color(b.sky);
    scene.fog = new THREE.Fog(b.fog, this.stream ? 60 : 34, this.stream ? 235 : 92);
    scene.add(new THREE.AmbientLight(b.ambient, m.biome === 'megacity' ? 0.48 : 0.78));
    const sun = (this.sun = new THREE.DirectionalLight(b.sun, 2.25));
    sun.castShadow = true;
    // Sized like kit.shadow(sun, 2048), but unsubscribed when the sortie ends.
    const sizeShadow = () => sun.shadow.mapSize.setScalar(kit.shadowSize(2048));
    sizeShadow();
    this.offQuality = kit.onQuality(sizeShadow);
    Object.assign(sun.shadow.camera, { left: -48, right: 48, top: 48, bottom: -48, near: 1, far: 150 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.normalBias = 0.03;
    sun.shadow.radius = 2;
    sun.target = new THREE.Object3D();
    scene.add(sun, sun.target);

    this.world = createWorld(scene, m);
    // One accent light moves to the nearest set piece that glows (field hospital, shelters),
    // so streaming tiles never changes how many lights the scene has.
    this.accent = new THREE.PointLight('#69d8cd', 0, 15);
    scene.add(this.accent);

    for (const f of this.farps) {
      const pad = buildFarp();
      pad.position.set(f.x, 0.08, f.z);
      scene.add(pad);
    }

    this.heli = buildNightjar(m.accent);
    scene.add(this.heli.group);
    this.effects = new Effects(scene, kit.detail(120));
    this.tracker = buildTrackMarker(this.markerColor);
    scene.add(this.tracker.group);
    this.pools = new Map();
    this.enemies = [];
    this.objectiveMarker = null;

    this.raycaster = new THREE.Raycaster();
    this.tmp = {
      ndc: new THREE.Vector2(),
      aim: new THREE.Vector3(),
      desired: new THREE.Vector3(),
      forward: new THREE.Vector3(),
      muzzle: new THREE.Vector3(),
      cam: new THREE.Vector3(),
      dir: new THREE.Vector3(),
      ai: new THREE.Vector3(),
      end: new THREE.Vector3(),
      proj: new THREE.Vector3(),
    };
    this.objective = new THREE.Vector3();
    this.phaseCenter = new THREE.Vector3();
  }

  /** Compile every material the sortie can show before the first shot is fired. */
  prewarm() {
    const group = new THREE.Group();
    group.position.set(0, -600, 0);
    const visuals = ENEMY_KINDS.map((k) => {
      const v = this.makeVisual(k);
      group.add(v.group, v.bar.group);
      return [k, v];
    });
    group.add(prewarmGroup());
    this.scene.add(group);
    this.effects.showAllForCompile();
    this.tracker.group.visible = true;
    const done = () => {
      group.removeFromParent();
      for (const [k, v] of visuals) this.release(k, v);
      this.effects.clear();
      this.tracker.group.visible = false;
      this.dirty = true;
    };
    this.kit.renderer
      .compileAsync(this.scene, this.camera)
      .catch(() => {})
      .finally(() => {
        if (!this.disposed) done();
      });
  }

  makeVisual(kind) {
    const color = enemyColor(kind, this.threatColor, ENEMY_COLOR);
    const model = buildEnemyModel(kind, this.m.biome, color);
    return { group: model.group, body: model.body, bar: buildHealthBar(kind === 'boss' ? 3 : 1.1, color) };
  }

  acquire(kind) {
    const list = this.pools.get(kind);
    const v = list?.pop() || this.makeVisual(kind);
    v.group.visible = true;
    v.bar.group.visible = true;
    v.body.scale.setScalar(1);
    this.scene.add(v.group, v.bar.group);
    return v;
  }

  release(kind, v) {
    v.group.removeFromParent();
    v.bar.group.removeFromParent();
    if (!this.pools.has(kind)) this.pools.set(kind, []);
    this.pools.get(kind).push(v);
  }

  /* ------------------------------------------------------------ simulation state */

  /** A fresh airframe at the checkpoint (sortie start and every retry). */
  resetSim() {
    const m = this.m;
    const entry = this.retries === 0 ? entryPoint(m, this.startPhase, this.startStage === 'debrief') : entryPoint(m, this.phaseIndex, false);
    const maxArmor = 100 + (this.upgrades.armor || 0) * 20;
    this.maxRockets = 24 + (this.upgrades.rockets || 0) * 6;
    this.player = {
      position: new THREE.Vector3(entry[0], 4.5, entry[1]),
      velocity: new THREE.Vector3(),
      yaw: PI,
      armor: maxArmor,
      maxArmor,
      fuel: 100,
      rockets: this.maxRockets,
      flares: 8,
      heat: 0,
      score: 0,
      alert: 0,
      lock: 0,
    };
    this.nextId = 1;
    this.dead = false;
    this.deathTimer = 0;
    this.heli.group.visible = true;
    this.heli.group.position.copy(this.player.position);
    this.heli.group.rotation.set(0, this.player.yaw + PI, 0);
    this.effects.clear();
    this.world.follow(this.player.position.x, this.player.position.z);
    this.updateAccent();
    this.snapCamera();
    this.lowArmorBeep = 0;
    this.lockBeep = 0;
    this.lastLock = false;
    this.mouseSeen = false;
    this.lastPointer = [NaN, NaN];
  }

  /** The original's per-phase reset and opening spawn. */
  startPhase_() {
    const m = this.m;
    const phase = (this.phase = m.phases[this.phaseIndex]);
    const settings = this.env.getSettings();
    this.targetCount = phaseTargetCount(phase, settings, m);
    this.progress = 0;
    this.phaseElapsed = 0;
    this.completed = false;
    this.spawnTimer = 2;
    this.nonTargetScore = 0;
    this.tracked = null;
    this.hint = { text: '', until: 0 };
    this.cd = { cannon: 0, rocket: 0, flare: 0, flareWindow: 0, service: 0, hud: 0 };
    const p = this.player;
    p.score = 0;
    p.alert = 0;
    p.lock = 0;
    p.heat = 0;
    p.velocity.set(0, 0, 0);
    this.phaseCenter.set(phase.location[0], 0, phase.location[1]);
    this.objective.copy(this.phaseCenter);
    for (const e of this.enemies) this.release(e.kind, e.visual);
    this.enemies.length = 0;
    this.effects.clear();

    if (phase.kind === 'boss') {
      const boss = this.spawn('boss', true);
      boss.position.copy(this.phaseCenter).setY(m.id === 'white-noon' ? 1.2 : m.biome === 'desert' ? 8 : m.biome === 'arctic' || m.biome === 'archipelago' ? 1.2 : 1);
      this.enemies.push(boss, this.spawn('sam', false), this.spawn('drone', false));
    } else if (phase.kind === 'eliminate') {
      for (let x = 0; x < Math.min(10, this.targetCount); x++) this.enemies.push(this.spawn(x % 4 === 0 ? 'sam' : phase.enemy, true, x > 5));
    } else {
      for (let x = 0; x < 6; x++) this.enemies.push(this.spawn(x % 3 === 0 ? phase.enemy : 'drone', false, true));
    }
    for (const e of this.enemies) this.placeVisual(e);

    this.objectiveMarker?.group.removeFromParent();
    this.objectiveMarker?.dispose();
    this.objectiveMarker = buildObjectiveMarker(phase.kind, this.markerColor);
    this.objectiveMarker.group.position.set(this.objective.x, 0.12, this.objective.z);
    this.scene.add(this.objectiveMarker.group);
    this.ui.setPhase(this.phaseIndex);
    this.emitHud(true);
    this.dirty = true;
  }

  /** The original spawn rule (seeded from mission, phase and enemy id). */
  spawn(kind, phaseTarget = false, far = false) {
    const m = this.m;
    const ph = this.phase;
    const r = lcg(hashString(`${m.id}-${ph.id}-${this.nextId}`));
    const ang = r() * PI * 2;
    const rad = (far ? 27 : 13) + r() * 13;
    const anchors = this.stream && ph.setpiece ? spawnAnchors(ph, far) : [];
    const anchor = anchors.length ? anchors[this.nextId % anchors.length] : null;
    const base = ph.kind === 'escort' && this.progress > 0 ? this.objective : this.phaseCenter;
    const useAnchor = anchor && ph.kind !== 'escort';
    const x = useAnchor ? anchor.x + (r() - 0.5) * 7 : base.x + Math.cos(ang) * rad;
    const z = useAnchor ? anchor.z + (r() - 0.5) * 7 : base.z + Math.sin(ang) * rad;
    const hp0 = ENEMY_HP[kind];
    const hp = kind === 'boss' ? hp0 * diffMul(this.env.getSettings().difficulty, 0.78, 1.2) : hp0;
    const y = kind === 'drone' ? 4.6 + r() * 4 : 0.8;
    const L = this.limit;
    return {
      id: this.nextId++,
      kind,
      position: new THREE.Vector3(clamp(x, -L, L), y, clamp(z, -L, L)),
      hp,
      maxHp: hp,
      yaw: ang,
      fireTimer: 1.2 + r() * 2.8,
      speed: kind === 'drone' ? 4.2 : kind === 'technical' ? 3.3 : kind === 'gunboat' ? 2.4 : 1.15,
      phaseTarget,
      flinch: 0,
      visual: null,
    };
  }

  placeVisual(e) {
    if (!e.visual) e.visual = this.acquire(e.kind);
    e.visual.group.position.copy(e.position);
    e.visual.group.rotation.y = e.yaw;
    e.visual.bar.set(e.hp / e.maxHp);
  }

  /* ------------------------------------------------------------ flow */

  showStory() {
    const root = this.ui.showStory({ index: this.phaseIndex, mode: this.story, phaseScore: this.phaseScore, cumulative: this.cumulative });
    this.kit.touch?.suspend(true, 'game');
    this.kit.input.settle();
    this.focusOverlay();
    audio.rotorStop();
    this.dirty = true;
    return root;
  }

  /**
   * Focus an overlay's first button (A / Enter presses it) without scrolling its panel.
   * Its buttons only work once everything held from flight has been let go: a trigger,
   * Space or A still held when a phase ends or the airframe goes down must not skip the
   * debrief or retry by itself (a focused button clicks when Space comes up).
   */
  focusOverlay() {
    this.overlayOpened = performance.now();
    this.overlayArmed = false;
    const el = firstFocus(this.ui.h.overlay);
    if (el) el.focus({ preventScroll: true });
  }

  /** Story button (briefing → fly, debrief → next phase). Ignores a held key carried in from flight. */
  storyAction() {
    if (!this.story || !this.overlayArmed || performance.now() - this.overlayOpened < 250) return;
    audio.sfx('confirm');
    if (this.story === 'briefing') {
      this.phaseDone = false;
      this.story = null;
      this.ui.closeOverlay();
      this.resumeFlight();
    } else this.advance();
  }

  resumeFlight() {
    this.kit.touch?.suspend(false, 'game');
    this.kit.input.settle();
    this.blockHeld();
    audio.rotorStart();
    this.dirty = true;
  }

  /**
   * Buttons still held from a menu (A to confirm, Space on a dialog) must be
   * released before they act in flight, so closing a dialog never fires a
   * flare or a burst of cannon by itself.
   */
  blockHeld() {
    this.blocked = this.blocked || new Set();
    for (const n of HELD_ACTIONS) if (this.kit.input.down(n)) this.blocked.add(n);
  }

  held(name) {
    const down = this.kit.input.down(name);
    if (this.blocked?.has(name)) {
      if (!down) this.blocked.delete(name);
      return false;
    }
    return down;
  }

  phaseComplete(score) {
    if (this.phaseDone) return;
    this.phaseDone = true;
    this.phaseScore = Math.max(0, Math.floor(score));
    this.env.onCheckpoint(this.phaseIndex, this.cumulative, 'debrief', this.phaseScore, this.elapsed);
    this.paused = false;
    this.mapOpen = false;
    this.story = 'debrief';
    this.kit.input.rumble(0.4, 160);
    this.showStory();
  }

  advance() {
    const m = this.m;
    const r = phaseAward(this.phaseIndex, m.phases.length, this.cumulative, this.phaseScore);
    if (r.complete || r.nextPhaseIndex === null) {
      this.story = null;
      this.env.onComplete(r.totalScore, this.elapsed);
      return;
    }
    this.cumulative = r.totalScore;
    this.env.onCheckpoint(r.nextPhaseIndex, r.totalScore, 'briefing', 0, this.elapsed);
    this.phaseScore = 0;
    this.phaseIndex = r.nextPhaseIndex;
    this.startPhase_();
    this.story = 'briefing';
    this.showStory();
  }

  retry() {
    this.phaseDone = false;
    this.failure = null;
    this.paused = false;
    this.mapOpen = false;
    this.phaseScore = 0;
    this.retries += 1;
    this.resetSim();
    this.startPhase_();
    this.story = 'briefing';
    this.showStory();
  }

  openPause() {
    if (this.story || this.failure || this.dead) return;
    this.paused = true;
    this.mapOpen = false;
    this.ui.showPause();
    this.focusOverlay();
    this.kit.touch?.suspend(true, 'game');
    this.kit.input.settle();
    audio.holdAudio(true);
    this.dirty = true;
  }

  resume() {
    this.paused = false;
    this.mapOpen = false;
    this.ui.closeOverlay();
    audio.holdAudio(false);
    this.resumeFlight();
  }

  openMap() {
    if (this.story || this.failure || this.dead) return;
    const p = this.player.position;
    this.mapOpen = true;
    this.ui.showMap({ index: this.phaseIndex, playerX: p.x, playerZ: p.z, objectiveX: this.objective.x, objectiveZ: this.objective.z });
    this.focusOverlay();
    this.kit.touch?.suspend(true, 'game');
    this.kit.input.settle();
    audio.holdAudio(true);
    this.dirty = true;
  }

  closeMap() {
    this.mapOpen = false;
    if (this.paused) {
      this.ui.showPause();
      this.focusOverlay();
      this.kit.input.settle();
      return;
    }
    this.ui.closeOverlay();
    audio.holdAudio(false);
    this.resumeFlight();
  }

  /** Pause if the player is flying (tab hidden, controller unplugged, settings panel). */
  autoPause() {
    if (this.flying) this.openPause();
  }

  get flying() {
    return !this.story && !this.paused && !this.mapOpen && !this.failure && !this.dead;
  }

  /** DOM actions from the flight screen (buttons carry data-action). */
  action(name) {
    if (name !== 'flight-pause' && this.ui.overlayOpen && !this.overlayArmed) return true;
    switch (name) {
      case 'flight-pause':
        this.openPause();
        return true;
      case 'story-go':
        this.storyAction();
        return true;
      case 'pause-resume':
        this.resume();
        return true;
      case 'pause-retry':
      case 'fail-retry':
        audio.holdAudio(false);
        this.retry();
        return true;
      case 'pause-map':
        this.mapOpen = true;
        this.ui.showMap({ index: this.phaseIndex, playerX: this.player.position.x, playerZ: this.player.position.z, objectiveX: this.objective.x, objectiveZ: this.objective.z });
        this.focusOverlay();
        this.kit.input.settle();
        return true;
      case 'map-close':
        this.closeMap();
        return true;
      case 'pause-abort':
      case 'fail-abort':
        audio.holdAudio(false);
        this.env.onAbort();
        return true;
      default:
        return false;
    }
  }

  /** 'back' pressed while an in-flight overlay has focus. */
  back() {
    if (this.mapOpen) this.closeMap();
    else if (this.paused) this.resume();
  }

  /* ------------------------------------------------------------ per frame */

  frame(dt, t) {
    const input = this.kit.input;
    const modal = this.env.isModalOpen();
    if (this.ui.overlayOpen && !this.overlayArmed && !input.down('fire') && !input.down('confirm') && !input.down('service')) this.overlayArmed = true;
    if (!modal && !this.story && !this.failure) {
      if (this.mapOpen) {
        if (input.pressed('map') || input.pressed('pause')) this.closeMap();
      } else if (this.paused) {
        if (input.pressed('pause')) this.resume();
      } else if (!this.dead) {
        if (input.pressed('pause')) this.openPause();
        else if (input.pressed('map')) this.openMap();
        else if (input.pressed('camera')) {
          this.camMode = this.camMode === 'tactical' ? 'chase' : 'tactical';
          this.env.onCameraMode?.(this.camMode);
          audio.sfx('ui');
        }
      }
    }

    if (this.flying && !modal) {
      this.step(dt, t);
      this.dirty = true;
    } else if (this.dead && !this.failure && !modal) {
      // A beat to watch the airframe go down before the failure dialog.
      this.deathTimer -= dt;
      this.effects.update(dt);
      this.followCamera(Math.min(dt, 0.05), t);
      this.dirty = true;
      if (this.deathTimer <= 0) {
        this.failure = this.deathCause;
        this.ui.showFailure(this.failure);
        this.focusOverlay();
        this.kit.touch?.suspend(true, 'game');
        this.kit.input.settle();
        audio.rotorStop();
      }
    }
    this.ui.frame(dt);
    if (this.dirty) {
      this.dirty = false;
      this.kit.renderer.render(this.scene, this.camera);
    }
  }

  step(dt, t) {
    const Z = Math.min(dt, 0.05);
    const input = this.kit.input;
    const settings = this.env.getSettings();
    const up = this.upgrades;
    const q = this.player;
    const ph = this.phase;
    const T = this.tmp;
    const cd = this.cd;
    this.phaseElapsed += Z;
    this.elapsed += Z;
    cd.cannon -= Z;
    cd.rocket -= Z;
    cd.flare -= Z;
    cd.flareWindow -= Z;
    cd.service -= Z;
    this.spawnTimer -= Z;
    cd.hud -= Z;

    // ---- movement (world-aligned in the tactical view, camera-relative in chase)
    const mv = input.vector('move');
    let mx = mv.x;
    let mz = -mv.y;
    const chase = this.camMode === 'chase';
    let fx = 0;
    let fz = -1;
    if (chase) {
      fx = q.position.x - this.camera.position.x;
      fz = q.position.z - this.camera.position.z;
      const fl = Math.hypot(fx, fz);
      if (fl > 0.01) {
        fx /= fl;
        fz /= fl;
      } else {
        fx = Math.sin(q.yaw);
        fz = Math.cos(q.yaw);
      }
      const wx = mv.x * -fz + mv.y * fx;
      const wz = mv.x * fx + mv.y * fz;
      mx = wx;
      mz = wz;
    }
    const mlen = Math.hypot(mx, mz);
    if (mlen > 1) {
      mx /= mlen;
      mz /= mlen;
    }
    const boost = this.held('boost') && q.fuel > 0;
    const speed = (this.stream ? (boost ? 27 : 16.5) : boost ? 15.5 : 10.5) * (1 + (up.avionics || 0) * 0.05);
    T.desired.set(mx * speed, 0, mz * speed);
    q.velocity.lerp(T.desired, 1 - Math.exp(-5.5 * Z));
    q.position.addScaledVector(q.velocity, Z);
    q.position.x = clamp(q.position.x, -this.limit, this.limit);
    q.position.z = clamp(q.position.z, -this.limit, this.limit);
    if (this.world.follow(q.position.x, q.position.z)) this.updateAccent();
    q.position.y = clamp(q.position.y + input.value('altitude') * Z * 5, 2.1, 12);
    q.fuel = Math.max(0, q.fuel - Z * (boost ? 0.085 : 0.017));

    // ---- facing: right stick, else the mouse on the ground, else the direction of travel
    let yawTarget = q.yaw;
    const aim = input.vector('aim');
    const src = input.source;
    if (Math.abs(aim.x) + Math.abs(aim.y) > 0.18) {
      let ax = aim.x;
      let az = -aim.y;
      if (chase) {
        ax = aim.x * -fz + aim.y * fx;
        az = aim.x * fx + aim.y * fz;
      }
      yawTarget = Math.atan2(ax, az);
    } else if (src === 'keyboard' && this.pointerAim()) {
      const dx = T.aim.x - q.position.x;
      const dz = T.aim.z - q.position.z;
      if (dx * dx + dz * dz > 2) yawTarget = Math.atan2(dx, dz);
    } else if (mx * mx + mz * mz > 0.05) {
      yawTarget = Math.atan2(mx, mz);
    }
    // Touch and controller have no free aim while strafing: holding fire turns the nose onto
    // the nearest hostile in range (the original simply could not turn without moving on touch).
    if (settings.aimAssist && src !== 'keyboard' && this.held('fire') && Math.abs(aim.x) + Math.abs(aim.y) <= 0.18) {
      const near = this.nearestHostile(34);
      if (near) yawTarget = Math.atan2(near.position.x - q.position.x, near.position.z - q.position.z);
    }
    const dy = Math.atan2(Math.sin(yawTarget - q.yaw), Math.cos(yawTarget - q.yaw));
    q.yaw += dy * Math.min(1, Z * 9);
    q.heat = Math.max(0, q.heat - Z * (0.24 + (up.cannon || 0) * 0.035));
    q.lock = Math.max(0, q.lock - Z);

    // ---- airframe pose: bank and pitch follow the local velocity
    const fwdX = Math.sin(q.yaw);
    const fwdZ = Math.cos(q.yaw);
    const vf = q.velocity.x * fwdX + q.velocity.z * fwdZ;
    const vl = q.velocity.x * -fwdZ + q.velocity.z * fwdX;
    const hg = this.heli.group;
    hg.position.copy(q.position);
    hg.rotation.y = q.yaw + PI;
    hg.rotation.z = THREE.MathUtils.lerp(hg.rotation.z, -vl * 0.018, Math.min(1, Z * 5));
    hg.rotation.x = THREE.MathUtils.lerp(hg.rotation.x, -vf * 0.012, Math.min(1, Z * 5));
    this.heli.spin(Z, settings.reducedMotion);
    this.rotorTimer = (this.rotorTimer || 0) - Z;
    if (this.rotorTimer <= 0) {
      this.rotorTimer = 0.12;
      audio.rotorStart(); // no-op while running; starts it if sound unlocked mid-flight
      audio.rotorSet(Math.min(1, q.velocity.length() / 27), boost);
    }

    // ---- camera
    this.followCamera(Z, t);

    // ---- weapons
    const fwd = T.forward.set(fwdX, 0, fwdZ);
    const muzzle = T.muzzle.copy(q.position).addScaledVector(fwd, 1.55);
    muzzle.y -= 0.18;
    const cone = settings.aimAssist ? 0.8 : 0.92;
    const coneTarget = this.coneTarget(34, cone);

    if (this.held('fire') && cd.cannon <= 0 && q.heat < 0.93) {
      cd.cannon = Math.max(0.075, 0.13 - (up.cannon || 0) * 0.01);
      q.heat += 0.075;
      if (coneTarget) this.damage(coneTarget, 19 + (up.cannon || 0) * 4, 'cannon', muzzle);
      else this.effects.tracer('cannon', muzzle, T.end.copy(muzzle).addScaledVector(fwd, 30));
      audio.sfx('cannon', 0.45);
    }
    if (this.held('rocket') && cd.rocket <= 0 && q.rockets > 0) {
      cd.rocket = 0.85;
      q.rockets--;
      const tgt = this.coneTarget(46, 0.55);
      if (tgt) {
        T.end.copy(tgt.position);
        this.damage(tgt, 118 + (up.rockets || 0) * 15, 'rocket', muzzle);
        for (let i = this.enemies.length - 1; i >= 0; i--) {
          const o = this.enemies[i];
          if (o !== tgt && o.hp > 0 && o.position.distanceTo(T.end) < 5.5) this.damage(o, 48, 'explosion');
        }
      } else {
        T.end.copy(muzzle).addScaledVector(fwd, 42);
        T.end.y = 0.3;
        this.effects.tracer('rocket', muzzle, T.end);
        this.effects.impact(T.end);
      }
      audio.sfx('rocket');
      this.kit.input.rumble(0.25, 70);
    }
    if (this.held('flare') && cd.flare <= 0 && q.flares > 0) {
      cd.flare = 1.3;
      cd.flareWindow = 1.4;
      q.flares--;
      q.lock = 0;
      q.alert = Math.max(0, q.alert - 12);
      for (const e of this.enemies) if (e.kind === 'sam') e.fireTimer = Math.max(e.fireTimer, 1.35);
      audio.sfx('alert', 0.5);
      audio.sfx('flare');
      this.flareBurst(q.position);
    }

    // ---- service at a FARP (hold), or a control note anywhere else
    const nearFarp = this.farps.some((f) => Math.hypot(q.position.x - f.x, q.position.z - f.z) < 6) && q.position.y < 5.2;
    const svc = this.held('service');
    if (nearFarp && svc && cd.service <= 0) {
      cd.service = 1;
      q.armor = Math.min(q.maxArmor, q.armor + 24);
      q.rockets = this.maxRockets;
      q.flares = 8;
      q.fuel = 100;
      audio.sfx('checkpoint');
      audio.sfx('service', 0.8);
      this.ui.feed('FARP · REPAIRED & REARMED', 'good');
    } else if (svc && cd.service <= 0) {
      cd.service = 1;
      this.hint = { text: controlNote(ph.kind, this.env.prompts().service), until: this.phaseElapsed + 3.2 };
      audio.sfx('alert', 0.22);
    }
    if (this.svcShown !== nearFarp) {
      // The touch SERVICE button only appears over a FARP (the kit's "show when relevant").
      this.svcShown = nearFarp;
      this.kit.touch?.setShown('service', nearFarp);
    }

    // ---- hostiles
    const diff = settings.difficulty;
    const dmgMul = diffMul(diff, 0.62, 1.34);
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const rn = T.ai.subVectors(q.position, e.position);
      const dist = rn.length();
      rn.y = 0;
      e.yaw = Math.atan2(rn.x, rn.z);
      if (dist < 36 && e.kind !== 'sam' && e.kind !== 'jammer' && e.kind !== 'boss') {
        rn.normalize();
        e.position.addScaledVector(rn, Z * e.speed * (dist < 7 ? -0.25 : 1));
      }
      if (e.kind === 'drone') e.position.y = 5 + Math.sin(t * 1.5 + e.id) * 1.4;
      e.fireTimer -= Z;
      if (dist < 43 && e.fireTimer < 0.72 && e.kind === 'sam' && cd.flareWindow <= 0) q.lock = Math.max(q.lock, 0.72);
      if (dist < (e.kind === 'sam' ? 43 : 25) && e.fireTimer <= 0) {
        e.fireTimer = (e.kind === 'boss' ? 1.8 : 2.8 + (e.id % 4) * 0.48) * diffMul(diff, 1.4, 0.78);
        const dmg = (e.kind === 'boss' ? 6 : e.kind === 'tank' || e.kind === 'sam' ? 3.2 : 1.8) * dmgMul;
        if (!(e.kind === 'sam' && cd.flareWindow > 0)) {
          q.armor = Math.max(0, q.armor - dmg);
          q.alert = Math.min(100, q.alert + 5);
          this.effects.tracer('enemy', e.position, q.position);
          audio.sfx('hit', 0.7);
          this.ui.damage(0.25 + dmg * 0.05);
          this.kit.input.rumble(Math.min(1, 0.25 + dmg * 0.08), 90);
          if (settings.cameraShake && !settings.reducedMotion) this.shake = Math.min(1, (this.shake || 0) + 0.35 + dmg * 0.05);
        }
      }
      e.flinch = Math.max(0, e.flinch - Z);
    }

    // ---- reinforcements
    const cap = diff === 'ace' ? 16 : diff === 'cadet' ? 9 : 12;
    if (this.spawnTimer <= 0 && this.enemies.length < cap) {
      this.spawnTimer = diff === 'ace' ? 5.5 : diff === 'cadet' ? 9.5 : 7.2;
      const remaining = this.targetCount - this.progress;
      let targets = 0;
      for (const e of this.enemies) if (e.phaseTarget) targets++;
      const needTarget = ph.kind === 'eliminate' && remaining > targets;
      const alt = ph.kind === 'boss' ? (this.nextId % 2 === 0 ? 'sam' : 'drone') : this.nextId % 4 === 0 ? 'sam' : ph.enemy;
      const e = this.spawn(needTarget ? ph.enemy : alt, needTarget, true);
      this.enemies.push(e);
      this.placeVisual(e);
    }

    // ---- objective
    if (ph.kind === 'eliminate' || ph.kind === 'boss') {
      const id = pickTracked(this.enemies, this.tracked, q.position.x, q.position.z);
      this.tracked = id;
      const tr = id === null ? null : this.enemies.find((e) => e.id === id);
      if (tr) this.objective.set(tr.position.x, 0, tr.position.z);
      else this.objective.copy(this.phaseCenter);
    } else if (ph.kind === 'escort') {
      escortPoint(ph, clamp(this.progress / this.targetCount, 0, 1), this.objective);
      this.objective.y = 0;
    } else this.objective.copy(this.phaseCenter);
    const zone = ph.kind === 'escort' ? 18 : ph.kind === 'survive' ? 21 : 9;
    const inside = Math.hypot(q.position.x - this.objective.x, q.position.z - this.objective.z) < zone && q.position.y < 9;
    if (ph.kind === 'secure' || ph.kind === 'extract') this.progress = clamp(this.progress + Z * (inside ? 1 : -0.22), 0, this.targetCount);
    if (ph.kind === 'escort') this.progress = clamp(this.progress + Z * (inside ? 1 : -0.1), 0, this.targetCount);
    if (ph.kind === 'survive') this.progress = clamp(this.progress + Z * (inside ? 1 : -0.08), 0, this.targetCount);
    this.inside = inside;

    if (!this.dead && q.armor <= 0) {
      this.die(q.lock > 0 ? 'Surface-to-air missile impact' : 'Airframe integrity lost');
      return;
    }
    if (!this.completed && this.progress >= this.targetCount) {
      this.completed = true;
      audio.sfx('checkpoint');
      this.phaseComplete(q.score);
      return;
    }
    q.alert = Math.max(0, q.alert - Z * 0.7);

    // ---- audio cues
    const locked = q.lock > 0;
    this.lockBeep -= Z;
    if (locked && (!this.lastLock || this.lockBeep <= 0)) {
      audio.sfx('lock');
      this.lockBeep = 0.6;
    }
    this.lastLock = locked;
    this.lowArmorBeep -= Z;
    if (q.armor / q.maxArmor < 0.25 && this.lowArmorBeep <= 0) {
      audio.sfx('warn');
      this.lowArmorBeep = 1.4;
    }
    let nearby = 0;
    for (const e of this.enemies) if (Math.abs(e.position.x - q.position.x) + Math.abs(e.position.z - q.position.z) < 60) nearby++;
    audio.setMusicIntensity(Math.min(1, q.alert / 60 + nearby * 0.08));

    // ---- visuals
    this.syncEnemies();
    this.updateTracker();
    this.objectiveMarker.group.position.set(this.objective.x, 0.12, this.objective.z);
    this.objectiveMarker.update(t, settings.reducedMotion, inside);
    this.effects.update(Z);
    this.reticle(coneTarget, muzzle, fwd);

    // ---- tutorial (WHITE NOON, first phase, first 40 s)
    if (this.m.id === 'white-noon' && this.phaseIndex === 0 && this.phaseElapsed < 40) this.ui.setTutorial(this.tutorialText(this.phaseElapsed), this.phaseElapsed);
    else this.ui.setTutorial(null);

    if (cd.hud <= 0) {
      cd.hud = 0.08;
      this.emitHud(false);
    }
  }

  followCamera(Z, t) {
    const q = this.player;
    const settings = this.env.getSettings();
    const c = this.tmp.cam;
    if (this.camMode === 'chase') c.set(q.position.x - Math.sin(q.yaw) * 11, q.position.y + 6.5, q.position.z - Math.cos(q.yaw) * 11);
    else c.set(q.position.x + 15, q.position.y + 24, q.position.z + 22);
    if (settings.cameraShake && !settings.reducedMotion) {
      let k = q.alert > 35 ? ((q.alert - 35) / 65) * 0.09 : 0;
      if (this.shake > 0) {
        k += this.shake * 0.35;
        this.shake = Math.max(0, this.shake - Z * 2.5);
      }
      if (k > 0) {
        c.x += Math.sin(t * 31) * k;
        c.y += Math.cos(t * 27) * k;
      }
    }
    this.camera.position.lerp(c, 1 - Math.exp(-4 * Z));
    this.camera.lookAt(q.position.x, q.position.y - 1.5, q.position.z);
    this.sun.position.set(q.position.x + 48, q.position.y + 70, q.position.z + 36);
    this.sun.target.position.set(q.position.x, 0, q.position.z);
    this.sun.target.updateMatrixWorld();
  }

  snapCamera() {
    const q = this.player;
    if (this.camMode === 'chase') this.camera.position.set(q.position.x - Math.sin(q.yaw) * 11, q.position.y + 6.5, q.position.z - Math.cos(q.yaw) * 11);
    else this.camera.position.set(q.position.x + 15, q.position.y + 24, q.position.z + 22);
    this.camera.lookAt(q.position.x, q.position.y - 1.5, q.position.z);
    this.sun.position.set(q.position.x + 48, q.position.y + 70, q.position.z + 36);
    this.sun.target.position.set(q.position.x, 0, q.position.z);
    this.sun.target.updateMatrixWorld();
  }

  /** Mouse over the canvas → the ground point under it (in tmp.aim). */
  pointerAim() {
    const p = this.kit.input.pointer;
    if (!p.over || p.type !== 'mouse') return false;
    if (p.nx !== this.lastPointer[0] || p.ny !== this.lastPointer[1]) {
      if (!Number.isNaN(this.lastPointer[0])) this.mouseSeen = true;
      this.lastPointer[0] = p.nx;
      this.lastPointer[1] = p.ny;
    }
    if (!this.mouseSeen) return false;
    this.tmp.ndc.set(p.nx, p.ny);
    this.raycaster.setFromCamera(this.tmp.ndc, this.camera);
    return !!this.raycaster.ray.intersectPlane(GROUND, this.tmp.aim);
  }

  /** Nearest hostile within range inside the nose cone (the original cannon/rocket rule). */
  coneTarget(range, cone) {
    const q = this.player;
    const d = this.tmp.dir;
    const fx = Math.sin(q.yaw);
    const fz = Math.cos(q.yaw);
    let best = null;
    let bestD = Infinity;
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      d.subVectors(e.position, q.position);
      const dist = d.length();
      d.y = 0;
      const h = Math.hypot(d.x, d.z) || 1;
      if (dist < range && (fx * d.x + fz * d.z) / h > cone && dist < bestD) {
        bestD = dist;
        best = e;
      }
    }
    return best;
  }

  nearestHostile(range) {
    const q = this.player;
    let best = null;
    let bestD = range;
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const d = e.position.distanceTo(q.position);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  damage(e, amount, kind, from = this.player.position) {
    if (e.hp <= 0) return;
    e.hp -= amount;
    e.flinch = 0.12;
    if (kind === 'explosion') this.effects.explosion(e.position);
    else this.effects.tracer(kind, from, e.position);
    if (e.visual) e.visual.bar.set(Math.max(0, e.hp) / e.maxHp);
    if (e.hp > 0) return;
    const boss = e.kind === 'boss';
    this.effects.explosion(e.position, boss);
    const pts = boss ? 5000 : e.kind === 'tank' || e.kind === 'sam' ? 500 : 250;
    const isTarget = e.phaseTarget || boss;
    const gain = isTarget ? pts : this.nonTargetScore < 1500 ? Math.min(100, pts) : 0;
    if (!isTarget) this.nonTargetScore += gain;
    this.player.score += gain;
    if (this.phase.kind === 'eliminate' && e.phaseTarget) this.progress += 1;
    if (this.phase.kind === 'boss' && boss) this.progress = 1;
    const i = this.enemies.indexOf(e);
    if (i >= 0) this.enemies.splice(i, 1);
    if (e.visual) this.release(e.kind, e.visual);
    e.visual = null;
    audio.sfx('hit');
    audio.sfx(boss ? 'bigboom' : 'boom', boss ? 1 : 0.7);
    this.kit.input.rumble(boss ? 1 : 0.2, boss ? 450 : 60);
    if (boss) this.shake = 1;
    this.ui.feed(`${ENEMY_NAME[e.kind]} DOWN${gain ? ` +${gain}` : ''}`, isTarget ? 'target' : '');
  }

  die(cause) {
    this.dead = true;
    this.deathCause = cause;
    this.deathTimer = 1.1;
    this.effects.explosion(this.player.position, true);
    this.heli.group.visible = false;
    this.kit.touch?.suspend(true, 'game');
    audio.sfx('bigboom');
    audio.rotorStop();
    this.kit.input.rumble(1, 600);
    this.ui.setTutorial(null);
    this.emitHud(true);
  }

  flareBurst(at) {
    // Flares read as a quick spray of sparks behind the aircraft.
    this.tmp.end.copy(at);
    this.tmp.end.y -= 0.6;
    this.effects.impact(this.tmp.end);
  }

  syncEnemies() {
    const camQ = this.camera.quaternion;
    for (const e of this.enemies) {
      const v = e.visual;
      if (!v) continue;
      v.group.position.copy(e.position);
      v.group.rotation.y = e.yaw;
      v.body.scale.setScalar(1 + e.flinch * 1.2);
      v.bar.group.position.set(e.position.x, e.position.y + (e.kind === 'boss' ? 4 : 1.8), e.position.z);
      v.bar.group.quaternion.copy(camQ);
    }
  }

  updateTracker() {
    const tr = this.tracked === null ? null : this.enemies.find((e) => e.id === this.tracked);
    const g = this.tracker.group;
    g.visible = !!tr;
    if (!tr) return;
    this.tracker.setBoss(tr.kind === 'boss');
    g.position.set(tr.position.x, tr.position.y + (tr.kind === 'drone' ? 0 : 0.7), tr.position.z);
    g.quaternion.copy(this.camera.quaternion);
  }

  updateAccent() {
    const p = this.player?.position;
    let best = null;
    let bestD = 160;
    for (const s of this.world.lights) {
      const d = p ? Math.hypot(s.x - p.x, s.z - p.z) : 0;
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    if (best) {
      this.accent.position.set(best.x, best.y, best.z);
      this.accent.color.set(best.color);
      this.accent.intensity = best.intensity;
      this.accent.distance = best.distance;
    } else this.accent.intensity = 0;
  }

  /** The reticle marks where the cannon will hit: the target in the cone, else 22 units ahead. */
  reticle(target, muzzle, fwd) {
    const v = this.tmp.proj;
    if (target) v.copy(target.position);
    else v.copy(muzzle).addScaledVector(fwd, 22);
    v.project(this.camera);
    const size = this.kit.size;
    const visible = v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2;
    this.ui.setReticle(((v.x + 1) / 2) * size.width, ((1 - v.y) / 2) * size.height, visible, !!target);
  }

  tutorialText(e) {
    const p = this.env.prompts();
    return e < 10
      ? ['CONTINENT-SCALE THEATER', `The Oris Basin is about 100× the old map area; press ${p.map} for the full mission-tile overview`]
      : e < 20
        ? ['FIRST TARGET', 'The amber marker tracks the active drone picket—it is not a landing zone']
        : e < 30
          ? ['ENGAGE', `Face the marked hostile and fire with ${p.fire}; use ${p.rocket} for rockets`]
          : ['CRUISE + SERVICE', `Hold ${p.boost} for desert cruise. ${p.service} works only over a teal FARP to repair and rearm`];
  }

  emitHud(force) {
    const q = this.player;
    const P = this.hud;
    P.armor = (q.armor / q.maxArmor) * 100;
    P.fuel = q.fuel;
    P.rockets = q.rockets;
    P.flares = q.flares;
    P.heat = q.heat * 100;
    P.altitude = q.position.y * 22;
    P.speed = q.velocity.length() * 13;
    P.score = q.score;
    P.totalScore = this.cumulative + q.score;
    P.alert = q.alert;
    P.progress = this.progress;
    P.target = this.targetCount;
    P.insideZone = !!this.inside;
    P.lock = q.lock > 0;
    P.enemies = this.enemies.length;
    P.playerX = q.position.x;
    P.playerZ = q.position.z;
    P.objectiveX = this.objective.x;
    P.objectiveZ = this.objective.z;
    P.phaseElapsed = this.phaseElapsed;
    P.resupply = this.farps.some((f) => Math.hypot(q.position.x - f.x, q.position.z - f.z) < 6) && q.position.y < 5.2;
    P.actionHint = this.hint.until > this.phaseElapsed ? this.hint.text : null;
    let n = 0;
    for (const e of this.enemies) {
      if (n >= P.blips.length) break;
      const b = P.blips[n++];
      b.x = e.position.x;
      b.z = e.position.z;
      b.target = e.phaseTarget || e.kind === 'boss';
    }
    P.blipCount = n;
    this.ui.update(P, force ? 0 : 0.08, this.kit.input.source === 'touch');
  }

  /* ------------------------------------------------------------ settings & teardown */

  settingsChanged() {
    const s = this.env.getSettings();
    this.camMode = s.camera;
    this.ui.setSubtitles(s.subtitles);
    this.ui.applyPrompts();
    const marker = markerColorFor(s.colorMode);
    if (marker !== this.markerColor) {
      // Marker palette changed from the pause menu: rebuild the amber (or palette) markers.
      this.markerColor = marker;
      this.tracker.group.removeFromParent();
      this.tracker = buildTrackMarker(marker);
      this.scene.add(this.tracker.group);
      this.objectiveMarker.group.removeFromParent();
      this.objectiveMarker.dispose();
      this.objectiveMarker = buildObjectiveMarker(this.phase.kind, marker);
      this.objectiveMarker.group.position.set(this.objective.x, 0.12, this.objective.z);
      this.scene.add(this.objectiveMarker.group);
    }
    this.dirty = true;
  }

  dispose() {
    this.disposed = true;
    this.offQuality?.();
    audio.rotorStop();
    this.kit.touch?.suspend(false, 'game');
    this.kit.touch?.setShown('service', false);
    this.ui.dispose();
    this.world.dispose();
    this.effects.dispose();
    this.objectiveMarker?.dispose();
    this.scene.clear();
  }
}
