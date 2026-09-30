// quests.js — things to find and do: the eight named places to discover, 24
// wayfinder cairns (three around each place, found by walking or flying low past
// them) and three sky trials (ring courses along the river, through the canyon
// and one lap around Stillwater Lake) with a timer, medals and best times.
// Progress is kept per world seed.
import * as THREE from 'three/webgpu';
import { float, vec3, uv, positionWorld, cameraPosition, smoothstep, pow, normalWorld } from 'three/tsl';
import { CONFIG, LOCATIONS, hashString, seededRandom } from './terrain.js';
import { propMaterial, tinted, merged } from './world.js';

const JOURNAL_KEY = 'wildlands.journal.v1';
const DISCOVER_RADIUS = 900;
const CAIRN_REACH = 14;
const RING_RADIUS = 16;
const MISS_PENALTY = 5;
const CAIRNS_PER_PLACE = 3;

export const COURSES = Object.freeze([
  {
    id: 'river',
    name: 'Riverbend Run',
    blurb: 'Follow the river south and across Stillwater Lake.',
    axis: 'river',
    from: -2600,
    to: 2200,
    spacing: 320,
    lift: 22,
    color: '#8fe0da',
  },
  {
    id: 'canyon',
    name: 'Redstone Canyon Run',
    blurb: 'Low and fast between the terraced canyon walls.',
    axis: 'canyon',
    from: 400,
    to: 4560,
    spacing: 320,
    lift: 30,
    color: '#f2b27f',
  },
  {
    // A closed lap just inside the shoreline (the lake is an ellipse of 870 × 1280 m
    // around 720, 620). It starts on the west shore, a short flight from the valley,
    // and finishes back through the start gate.
    id: 'circuit',
    name: 'Stillwater Circuit',
    blurb: 'One lap of Stillwater Lake, low over the water.',
    axis: 'loop',
    cx: 720,
    cz: 620,
    rx: 870 * 0.78,
    rz: 1280 * 0.78,
    angle: Math.PI,
    spacing: 300,
    lift: 16,
    color: '#a9dcff',
  },
]);

export const MEDALS = Object.freeze([
  { id: 'gold', label: 'Gold', factor: 150 },
  { id: 'silver', label: 'Silver', factor: 120 },
  { id: 'bronze', label: 'Bronze', factor: 95 },
]);

export const formatTime = (seconds) => {
  if (!Number.isFinite(seconds)) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`;
};

/** Progress on this device, per seed: places found, cairns found, best trial times (seconds). */
class JournalStore {
  constructor() {
    this.data = { version: 1, worlds: {} };
    try {
      const raw = JSON.parse(localStorage.getItem(JOURNAL_KEY));
      if (raw && raw.version === 1 && raw.worlds && typeof raw.worlds === 'object') {
        for (const [seed, w] of Object.entries(raw.worlds)) {
          if (typeof seed !== 'string' || !w || typeof w !== 'object') continue;
          this.data.worlds[seed] = {
            places: Array.isArray(w.places) ? w.places.filter((id) => LOCATIONS.some((l) => l.id === id)) : [],
            cairns: Array.isArray(w.cairns) ? w.cairns.filter((i) => Number.isInteger(i) && i >= 0 && i < LOCATIONS.length * CAIRNS_PER_PLACE) : [],
            trials: {},
            touched: Number.isFinite(w.touched) ? w.touched : 0,
          };
          for (const c of COURSES) {
            const t = w.trials?.[c.id];
            if (Number.isFinite(t) && t > 0) this.data.worlds[seed].trials[c.id] = t;
          }
        }
      }
    } catch {
      /* no saved journal, or storage is blocked */
    }
  }

  world(seed) {
    let w = this.data.worlds[seed];
    if (!w) {
      w = this.data.worlds[seed] = { places: [], cairns: [], trials: {}, touched: 0 };
      // Keep the twenty most recent worlds.
      const seeds = Object.keys(this.data.worlds);
      if (seeds.length > 20) {
        seeds.sort((a, b) => this.data.worlds[a].touched - this.data.worlds[b].touched);
        for (const s of seeds.slice(0, seeds.length - 20)) if (s !== seed) delete this.data.worlds[s];
      }
    }
    return w;
  }

  save(seed) {
    if (seed) this.world(seed).touched = Date.now();
    try {
      localStorage.setItem(JOURNAL_KEY, JSON.stringify(this.data));
    } catch {
      /* storage full or blocked: progress lasts for this visit */
    }
  }
}

const _v = new THREE.Vector3();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _c = new THREE.Color();
const _z = new THREE.Vector3(0, 0, 1);
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

export class Quests {
  constructor(game) {
    this.game = game;
    this.store = new JournalStore();
    this.root = new THREE.Group();
    this.root.name = 'Quests';
    game.scene.add(this.root);
    this.clock = 0;
    this.checkTimer = 0;
    this.trial = null;
    this.cairns = [];
    this.courses = [];

    // Cairn: four stacked stones in the rock palette, a floating crystal, a faint beam of light.
    this.stoneGeometry = merged([
      tinted(new THREE.DodecahedronGeometry(1, 0), '#8d9184', [0, 1.0, 0], [2.2, 1.2, 2.2]),
      tinted(new THREE.DodecahedronGeometry(1, 0), '#7f8577', [0.2, 2.7, -0.1], [1.6, 1, 1.6]),
      tinted(new THREE.DodecahedronGeometry(1, 0), '#969a8b', [-0.1, 4.0, 0.1], [1.15, 0.8, 1.15]),
      tinted(new THREE.DodecahedronGeometry(1, 0), '#878b7e', [0, 5.0, 0], [0.7, 0.6, 0.7]),
    ]);
    this.crystalGeometry = new THREE.OctahedronGeometry(1.1, 0);
    this.crystalGeometry.scale(1, 1.8, 1);
    this.crystalMaterial = new THREE.MeshBasicNodeMaterial();
    this.crystalMaterial.colorNode = vec3(normalWorld.y.mul(0.35).add(1.05));
    this.beamGeometry = new THREE.CylinderGeometry(1.1, 1.7, 420, 8, 1, true);
    this.beamGeometry.translate(0, 216, 0);
    this.beamMaterial = new THREE.MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      fog: false,
    });
    const dist = positionWorld.xz.sub(cameraPosition.xz).length();
    this.beamMaterial.opacityNode = float(0.34)
      .mul(smoothstep(25, 140, dist))
      .mul(float(1).sub(smoothstep(2400, 3800, dist)))
      .mul(pow(uv().y.oneMinus(), 1.6));
    // Rings: unlit, so they read at any time of day; fog still fades distant ones.
    this.ringGeometry = new THREE.TorusGeometry(RING_RADIUS, 1.4, 6, 28);
    this.ringMaterial = new THREE.MeshBasicNodeMaterial();

    this.rebuild(game.field);
  }

  get trialActive() {
    return !!this.trial;
  }

  get progress() {
    return this.store.world(this.game.field.seed);
  }

  /** Place cairns and courses for the current seed (heights come from the terrain). */
  rebuild(field) {
    if (this.trial) this.abortTrial(null);
    for (const o of [...this.root.children]) {
      this.root.remove(o);
      o.dispose?.();
    }
    this.field = field;

    this.cairns = [];
    LOCATIONS.forEach((loc, li) => {
      const rnd = seededRandom(hashString(`${field.seed}:${loc.id}:cairns`));
      for (let k = 0; k < CAIRNS_PER_PLACE; k++) {
        let spot = null;
        for (let attempt = 0; attempt < 18 && !spot; attempt++) {
          const angle = ((k + rnd() * 0.8) / CAIRNS_PER_PLACE) * Math.PI * 2;
          const radius = 380 + rnd() * 1100;
          const x = loc.x + Math.cos(angle) * radius;
          const z = loc.z + Math.sin(angle) * radius;
          const s = field.sample(x, z);
          if (s.water || s.height < CONFIG.waterLevel + 2) continue;
          const slope = (Math.abs(field.height(x + 6, z) - field.height(x - 6, z)) + Math.abs(field.height(x, z + 6) - field.height(x, z - 6))) / 12;
          if (slope > 0.7) continue;
          spot = { x, z };
        }
        if (!spot) spot = { x: loc.x + (k - 1) * 60, z: loc.z + 40 };
        const y = Math.max(field.ground(spot.x, spot.z), CONFIG.waterLevel) - 0.3;
        this.cairns.push({ index: li * CAIRNS_PER_PLACE + k, place: li, x: spot.x, y, z: spot.z, color: new THREE.Color(loc.color), flash: 0 });
      }
    });
    const n = this.cairns.length;
    this.stones = new THREE.InstancedMesh(this.stoneGeometry, propMaterial, n);
    this.crystals = new THREE.InstancedMesh(this.crystalGeometry, this.crystalMaterial, n);
    this.beams = new THREE.InstancedMesh(this.beamGeometry, this.beamMaterial, n);
    this.stones.castShadow = this.stones.receiveShadow = true;
    this.beams.renderOrder = 5;
    for (const mesh of [this.stones, this.crystals, this.beams]) {
      mesh.frustumCulled = false;
      this.root.add(mesh);
    }
    const found = new Set(this.progress.cairns);
    this.cairns.forEach((c, i) => {
      c.found = found.has(c.index);
      _m.makeRotationY(i * 1.7).setPosition(c.x, c.y, c.z);
      this.stones.setMatrixAt(i, _m);
      this.stones.setColorAt(i, _c.setRGB(0.9, 0.92, 0.88));
      this.crystals.setColorAt(i, c.color);
      this.beams.setColorAt(i, c.color);
      this.beams.setMatrixAt(i, c.found ? ZERO : _m.makeTranslation(c.x, c.y, c.z));
    });
    this.stones.instanceMatrix.needsUpdate = true;
    this.stones.instanceColor.needsUpdate = true;
    this.crystals.instanceColor.needsUpdate = true;
    this.beams.instanceColor.needsUpdate = true;
    this.beams.instanceMatrix.needsUpdate = true;
    this.updateCrystals();

    this.courses = COURSES.map((def) => this.buildCourse(field, def));
    const ringCount = this.courses.reduce((sum, c) => sum + c.rings.length, 0);
    this.rings = new THREE.InstancedMesh(this.ringGeometry, this.ringMaterial, ringCount);
    this.rings.frustumCulled = false;
    let slot = 0;
    for (const course of this.courses) {
      course.base = slot;
      slot += course.rings.length;
    }
    this.root.add(this.rings);
    this.refreshRings();
  }

  buildCourse(field, def) {
    const rings = [];
    const ring = (x, z) => rings.push({ x, z, y: 0, normal: new THREE.Vector3(), quaternion: new THREE.Quaternion() });
    if (def.axis === 'loop') {
      // Even steps around the ellipse (Ramanujan's perimeter); the last ring closes the lap at the gate.
      const a = def.rx;
      const b = def.rz;
      const h = (a - b) ** 2 / (a + b) ** 2;
      const perimeter = Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
      const n = Math.max(8, Math.round(perimeter / def.spacing));
      for (let i = 0; i <= n; i++) {
        const t = def.angle + (i / n) * Math.PI * 2;
        ring(def.cx + Math.cos(t) * a, def.cz + Math.sin(t) * b);
      }
    } else {
      for (let z = def.from; z <= def.to + 1e-6; z += def.spacing) ring(def.axis === 'river' ? field.riverX(z) : field.canyonX(z), z);
    }
    // Clear the ground at each ring and halfway to its neighbours.
    for (let i = 0; i < rings.length; i++) {
      const r = rings[i];
      let top = Math.max(field.height(r.x, r.z), CONFIG.waterLevel);
      for (const q of [rings[i - 1], rings[i + 1]]) if (q) top = Math.max(top, field.height((r.x + q.x) / 2, (r.z + q.z) / 2));
      r.y = top + def.lift;
    }
    let length = 0;
    for (let i = 0; i < rings.length; i++) {
      const a = rings[Math.max(0, i - 1)];
      const b = rings[Math.min(rings.length - 1, i + 1)];
      rings[i].normal.set(b.x - a.x, b.y - a.y, b.z - a.z).normalize();
      rings[i].quaternion.setFromUnitVectors(_z, rings[i].normal);
      if (i > 0) length += Math.hypot(rings[i].x - rings[i - 1].x, rings[i].y - rings[i - 1].y, rings[i].z - rings[i - 1].z);
    }
    const par = Object.fromEntries(MEDALS.map((m) => [m.id, length / m.factor]));
    return { ...def, rings, length, par, colorValue: new THREE.Color(def.color) };
  }

  medalFor(course, seconds) {
    for (const m of MEDALS) if (seconds <= course.par[m.id]) return m;
    return null;
  }

  /** Which rings show: every start gate, plus the whole course while its trial runs. */
  refreshRings() {
    for (const course of this.courses) {
      const active = this.trial?.course === course;
      course.rings.forEach((r, i) => {
        const shown = i === 0 ? !active || this.trial.next === 0 : active && i >= this.trial.next;
        if (!shown) {
          this.rings.setMatrixAt(course.base + i, ZERO);
          return;
        }
        _s.setScalar(i === 0 ? 1.25 : 1);
        _m.compose(_p.set(r.x, r.y, r.z), r.quaternion, _s);
        this.rings.setMatrixAt(course.base + i, _m);
      });
    }
    this.rings.instanceMatrix.needsUpdate = true;
    this.colorRings(this.clock);
  }

  colorRings(t) {
    for (const course of this.courses) {
      const active = this.trial?.course === course;
      course.rings.forEach((r, i) => {
        if (active && i === this.trial.next) {
          const pulse = 0.75 + Math.sin(t * 7) * 0.25;
          _c.setRGB(1.6 * pulse + 0.4, 1.35 * pulse + 0.35, 0.55);
        } else if (i === 0) {
          _c.copy(course.colorValue).multiplyScalar(1.3);
        } else {
          _c.copy(course.colorValue).multiplyScalar(0.8);
        }
        this.rings.setColorAt(course.base + i, _c);
      });
    }
    this.rings.instanceColor.needsUpdate = true;
  }

  updateCrystals() {
    const t = this.clock;
    this.cairns.forEach((c, i) => {
      if (c.found && c.flash <= 0) {
        this.crystals.setMatrixAt(i, ZERO);
        return;
      }
      const grow = c.flash > 0 ? 1 + (1 - c.flash) * 1.8 : 1;
      _p.set(c.x, c.y + 7.4 + Math.sin(t * 1.6 + i) * 0.35 + (c.flash > 0 ? (1 - c.flash) * 6 : 0), c.z);
      _q.setFromAxisAngle(_v.set(0, 1, 0), t * 0.8 + i);
      _s.setScalar(c.flash > 0 ? grow * c.flash : 1);
      _m.compose(_p, _q, _s);
      this.crystals.setMatrixAt(i, _m);
    });
    this.crystals.instanceMatrix.needsUpdate = true;
  }

  /** Every frame. `playing` is false while paused (the world still animates, nothing is collected). */
  update(dt, playing) {
    const game = this.game;
    this.root.position.set(-game.origin.x, 0, -game.origin.z);
    this.clock += dt;
    for (const c of this.cairns) if (c.flash > 0) c.flash = Math.max(0, c.flash - dt * 1.25);
    this.updateCrystals();
    // Only the next ring of a running trial pulses; otherwise the colours stay as refreshRings left them.
    if (this.trial) this.colorRings(this.clock);
    if (!playing) return;

    const p = game.player.position;
    for (const c of this.cairns) {
      if (c.found) continue;
      const dx = p.x - c.x;
      const dz = p.z - c.z;
      const dy = p.y - c.y;
      if (dx * dx + dz * dz < CAIRN_REACH * CAIRN_REACH && dy > -4 && dy < 18) this.collect(c);
    }

    this.checkTimer -= dt;
    if (this.checkTimer <= 0) {
      this.checkTimer = 0.5;
      const progress = this.progress;
      for (const loc of LOCATIONS) {
        if (progress.places.includes(loc.id)) continue;
        if (Math.hypot(p.x - loc.x, p.z - loc.z) < DISCOVER_RADIUS) this.discover(loc);
      }
    }

    if (this.trial) {
      this.trial.time += dt;
      const r = this.trial.course.rings[this.trial.next];
      if (r && Math.hypot(p.x - r.x, p.z - r.z) > 2500) this.abortTrial('You left the course. Trial abandoned.');
    }
  }

  /** Every fixed step while playing: did the player fly through a ring? */
  step(prev, cur) {
    if (this.game.player.mode !== 'fly') return;
    if (this.trial) {
      const course = this.trial.course;
      const ring = course.rings[this.trial.next];
      const hit = ring && this.cross(ring, prev, cur, this.trial.next === 0 ? 1.25 : 1);
      if (!hit) return;
      if (this.trial.next === 0) {
        if (hit !== 'pass') return;
        this.trial.time = 0;
        this.trial.started = true;
        this.game.sound.play('start');
        this.game.kit.input.rumble(0.35, 120);
        this.game.ui.notice(`${course.name}: go!`);
      } else if (hit === 'pass') {
        this.game.sound.play('ring', this.trial.next / course.rings.length);
        this.game.kit.input.rumble(0.25, 70);
      } else {
        this.trial.penalty += MISS_PENALTY;
        this.trial.missed++;
        this.game.sound.play('miss');
        this.game.kit.input.rumble(0.6, 160);
        this.game.ui.notice(`Missed ring ${this.trial.next} · +${MISS_PENALTY} s`);
      }
      this.trial.next++;
      if (this.trial.next >= course.rings.length) this.finishTrial();
      else this.refreshRings();
      return;
    }
    // No trial yet: flying through a start gate begins one.
    for (const course of this.courses) {
      if (this.cross(course.rings[0], prev, cur, 1.25) === 'pass') {
        this.beginTrial(course, true);
        return;
      }
    }
  }

  /** 'pass' through the ring, 'miss' when crossing its plane close by, otherwise null. */
  cross(ring, prev, cur, scale = 1) {
    const nx = ring.normal.x;
    const ny = ring.normal.y;
    const nz = ring.normal.z;
    const d0 = (prev.x - ring.x) * nx + (prev.y - ring.y) * ny + (prev.z - ring.z) * nz;
    const d1 = (cur.x - ring.x) * nx + (cur.y - ring.y) * ny + (cur.z - ring.z) * nz;
    if (!(d0 < 0 && d1 >= 0)) return null;
    const t = d0 / (d0 - d1);
    const off = Math.hypot(prev.x + (cur.x - prev.x) * t - ring.x, prev.y + (cur.y - prev.y) * t - ring.y, prev.z + (cur.z - prev.z) * t - ring.z);
    if (off <= RING_RADIUS * scale + 1.5) return 'pass';
    return off <= 140 ? 'miss' : null;
  }

  beginTrial(course, throughGate) {
    this.trial = { course, next: throughGate ? 1 : 0, time: 0, penalty: 0, missed: 0, started: throughGate };
    this.refreshRings();
    this.game.ui.trialChanged();
    if (throughGate) {
      this.game.sound.play('start');
      this.game.kit.input.rumble(0.35, 120);
      this.game.ui.notice(`${course.name}: go! Fly through every ring.`);
    }
  }

  /** From the journal: fly to the start gate, facing it; the timer starts at the gate. */
  prepareTrial(id) {
    const course = this.courses.find((c) => c.id === id);
    if (!course) return;
    const game = this.game;
    const gate = course.rings[0];
    const x = gate.x - gate.normal.x * 280;
    const z = gate.z - gate.normal.z * 280;
    const yaw = Math.atan2(-gate.normal.x, -gate.normal.z);
    if (game.player.mode !== 'fly') game.player.setMode('fly');
    game.travel({ x, z, y: gate.y, yaw, pitch: 0, name: course.name, keepTrial: true });
    this.beginTrial(course, false);
    game.ui.notice(`${course.name}: fly through the start gate to begin.`);
  }

  abortTrial(message) {
    if (!this.trial) return;
    this.trial = null;
    this.refreshRings();
    this.game.ui.trialChanged();
    if (message) this.game.ui.notice(message);
  }

  finishTrial() {
    const trial = this.trial;
    const course = trial.course;
    const total = trial.time + trial.penalty;
    const progress = this.progress;
    const previous = progress.trials[course.id];
    const record = !Number.isFinite(previous) || total < previous;
    if (record) {
      progress.trials[course.id] = total;
      this.store.save(this.game.field.seed);
    }
    this.trial = null;
    this.refreshRings();
    this.game.sound.play('finish');
    this.game.kit.input.rumble(0.5, 260);
    this.game.ui.trialChanged();
    this.game.ui.showResults({
      course,
      time: trial.time,
      penalty: trial.penalty,
      missed: trial.missed,
      total,
      best: record ? total : previous,
      record,
      medal: this.medalFor(course, total),
    });
  }

  collect(cairn) {
    cairn.found = true;
    cairn.flash = 1;
    const progress = this.progress;
    if (!progress.cairns.includes(cairn.index)) progress.cairns.push(cairn.index);
    this.store.save(this.game.field.seed);
    const i = this.cairns.indexOf(cairn);
    this.beams.setMatrixAt(i, ZERO);
    this.beams.instanceMatrix.needsUpdate = true;
    const place = LOCATIONS[cairn.place];
    const inPlace = this.cairns.filter((c) => c.place === cairn.place && c.found).length;
    const total = progress.cairns.length;
    this.game.sound.play('cairn');
    this.game.kit.input.rumble(0.45, 140);
    let text = `Wayfinder cairn · ${place.name} ${inPlace}/${CAIRNS_PER_PLACE}`;
    if (inPlace === CAIRNS_PER_PLACE) text = `${place.name} surveyed: all three cairns found`;
    if (total === this.cairns.length) text = 'Every wayfinder cairn found. The land is charted.';
    this.game.ui.notice(text);
    this.game.events.emit('journal');
  }

  discover(loc) {
    const progress = this.progress;
    if (progress.places.includes(loc.id)) return;
    progress.places.push(loc.id);
    this.store.save(this.game.field.seed);
    this.game.sound.play('discover');
    this.game.kit.input.rumble(0.2, 90);
    this.game.ui.notice(`Discovered · ${loc.name}`);
    this.game.events.emit('journal');
  }

  /** Mark the starting valley as known without a fanfare (it is where everyone begins). */
  knowStart() {
    const progress = this.progress;
    if (!progress.places.includes(LOCATIONS[0].id)) {
      progress.places.push(LOCATIONS[0].id);
      this.store.save(this.game.field.seed);
    }
  }

  /** Where the compass marker points: the next ring, or the nearest cairn still to find. */
  target(position) {
    if (this.trial) {
      const r = this.trial.course.rings[this.trial.next];
      return r ? { x: r.x, z: r.z, kind: 'ring', distance: Math.hypot(r.x - position.x, r.z - position.z) } : null;
    }
    let best = null;
    for (const c of this.cairns) {
      if (c.found) continue;
      const d = Math.hypot(c.x - position.x, c.z - position.z);
      if (d < 2500 && (!best || d < best.distance)) best = { x: c.x, z: c.z, kind: 'cairn', distance: d };
    }
    return best;
  }

  summary() {
    const progress = this.progress;
    return {
      places: progress.places.length,
      placesTotal: LOCATIONS.length,
      cairns: progress.cairns.length,
      cairnsTotal: this.cairns.length,
      trials: COURSES.filter((c) => Number.isFinite(progress.trials[c.id])).length,
      trialsTotal: COURSES.length,
    };
  }
}
