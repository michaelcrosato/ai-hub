// Animals that get hungry, thirsty and tired, and walk (by A*) to food, water and rest.

import * as THREE from 'three/webgpu';
import { CONFIG, SPECIES, rng, rngAt, lerp, clamp } from './config.js';
import { BoxBatch, disposeMesh } from './world.js';

const NEIGHBOURS = [
  [4, 0],
  [-4, 0],
  [0, 4],
  [0, -4],
];
const DIRS8 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
];
const TAU = Math.PI * 2;
const cellKey = (x, z) => (x + 1048576) * 2097152 + (z + 1048576);

/** A* over 4 m cells: a list of waypoints ending at `to`, or null. */
export function findPath(world, from, to, radius = 0.6, maxNodes = 4400) {
  const sx = Math.floor(from.x / 4);
  const sz = Math.floor(from.z / 4);
  const gx = Math.floor(to.x / 4);
  const gz = Math.floor(to.z / 4);
  const heap = [];
  const best = new Map();
  const closed = new Set();
  const push = (node) => {
    heap.push(node);
    let i = heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (heap[parent].f <= node.f) break;
      heap[i] = heap[parent];
      i = parent;
    }
    heap[i] = node;
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      let i = 0;
      while (i * 2 + 1 < heap.length) {
        let c = i * 2 + 1;
        if (c + 1 < heap.length && heap[c + 1].f < heap[c].f) c++;
        if (last.f <= heap[c].f) break;
        heap[i] = heap[c];
        i = c;
      }
      heap[i] = last;
    }
    return top;
  };
  const guess = (x, z) => Math.hypot(x - gx, z - gz) * 1.6;
  push({ x: sx, z: sz, g: 0, f: guess(sx, sz), parent: null });
  best.set(cellKey(sx, sz), 0);
  let expanded = 0;
  while (heap.length && expanded++ < maxNodes) {
    const node = pop();
    const key = cellKey(node.x, node.z);
    if (closed.has(key)) continue;
    closed.add(key);
    if (node.x === gx && node.z === gz) {
      const path = [];
      for (let n = node; n.parent; n = n.parent) path.push({ x: n.x * 4 + 2, z: n.z * 4 + 2 });
      path.reverse();
      path.push({ x: to.x, z: to.z });
      return path;
    }
    const cx = node.x * 4 + 2;
    const cz = node.z * 4 + 2;
    const cy = world.groundAt(cx, cz);
    for (const [dx, dz] of DIRS8) {
      const nx = node.x + dx;
      const nz = node.z + dz;
      const nkey = cellKey(nx, nz);
      if (closed.has(nkey)) continue;
      const wx = nx * 4 + 2;
      const wz = nz * 4 + 2;
      if (
        !world.isWalkable(wx, wz, cy, radius) ||
        !world.isWalkable((cx + wx) / 2, (cz + wz) / 2, cy, radius) ||
        (dx && dz && (!world.isWalkable(cx + dx * 4, cz, cy, radius) || !world.isWalkable(cx, cz + dz * 4, cy, radius)))
      )
        continue;
      const g = node.g + Math.hypot(dx, dz) + Math.abs(world.groundAt(wx, wz) - cy) * 0.1;
      if (g >= (best.get(nkey) ?? Infinity)) continue;
      best.set(nkey, g);
      push({ x: nx, z: nz, g, f: g + guess(nx, nz), parent: node });
    }
  }
  return null;
}

/** A box-built animal facing -Z, feet at y = 0. */
function buildAnimal(species, data, material) {
  const b = new BoxBatch();
  const c = data.color;
  const sheep = species === 'sheep';
  const goat = species === 'goat';
  const bear = species === 'bear';
  b.add(0, 1.5, 0, 1.45, 1.5, 2.6, c);
  b.add(0, 2.15, -1.35, 1, 1.1, 1.15, c);
  b.add(0, 1.9, -2, 0.8, 0.55, 0.7, sheep ? 6644828 : goat ? 0xcac2b0 : bear ? 0x8f6b48 : c);
  const legs = sheep ? 7433313 : goat ? 0x746d62 : 6378303;
  for (const lx of [-0.48, 0.48]) for (const lz of [-0.85, 0.85]) b.add(lx, 0.5, lz, 0.32, 1.2, 0.4, legs);
  b.add(-0.3, 2.45, -1.87, 0.16, 0.16, 0.1, 2567716);
  b.add(0.3, 2.45, -1.87, 0.16, 0.16, 0.1, 2567716);
  if (species === 'deer') {
    for (const o of [-0.36, 0.36]) {
      b.add(o, 3.2, -1.1, 0.18, 1.6, 0.2, 7825742);
      b.add(o * 1.6, 3.6, -1.1, 0.65, 0.16, 0.2, 7825742);
    }
  } else if (species === 'rabbit') {
    for (const o of [-0.28, 0.28]) b.add(o, 3.15, -1.2, 0.32, 1.5, 0.4, c);
  } else if (goat) {
    for (const o of [-0.26, 0.26]) {
      b.add(o, 2.95, -1.2, 0.18, 0.75, 0.2, 0x5b5449);
      b.add(o, 3.25, -0.95, 0.18, 0.2, 0.5, 0x5b5449);
      b.add(o * 2.2, 2.5, -1.15, 0.4, 0.16, 0.22, c);
    }
    b.add(0, 1.45, -2.05, 0.28, 0.55, 0.22, 0xbdb5a2);
    b.add(0, 2.05, 1.35, 0.3, 0.35, 0.3, c);
  } else if (bear) {
    for (const o of [-0.42, 0.42]) b.add(o, 2.8, -1.2, 0.34, 0.32, 0.26, c);
    b.add(0, 2.35, -0.55, 1.25, 0.4, 1.1, c);
    b.add(0, 1.95, -2.36, 0.3, 0.2, 0.08, 2567716);
  } else {
    for (const o of [-0.45, 0.45]) b.add(o, 2.8, -1.1, 0.3, 0.5, 0.4, c);
  }
  if (species === 'fox') {
    b.add(0, 1.5, 2, 0.65, 0.7, 1.8, c);
    b.add(0, 1.5, 2.8, 0.7, 0.7, 0.5, 15194290);
  }
  const mesh = b.mesh(material);
  mesh.scale.setScalar(data.size);
  return mesh;
}

/** Which animals a spot can hold. */
function speciesFor(biome, groundY) {
  if (biome === 'farmland') return ['sheep', 'rabbit'];
  if (biome === 'swamp' || biome === 'tropical') return ['capybara', 'boar', 'rabbit'];
  if (biome === 'mountain') return groundY > 110 ? ['goat', 'goat', 'goat', 'rabbit'] : ['goat', 'deer', 'deer', 'rabbit', 'fox'];
  if (biome === 'forest') return ['deer', 'deer', 'rabbit', 'fox', 'boar', 'deer', 'rabbit', 'bear'];
  return ['deer', 'deer', 'rabbit', 'fox', 'boar'];
}

export class Wildlife {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.animals = [];
    this.resources = new Map();
    this.time = 0;
    this.nextId = 0;
    this.spawnCenter = null;
    this.maxAnimals = CONFIG.maxAnimals;
    // One material for every animal and berry bush: colours live in the instances.
    this.material = new THREE.MeshStandardMaterial({ roughness: 1 });
  }

  populate(center) {
    // Horizontal distance: climbing or diving in flight does not call for new animals.
    if (this.spawnCenter && Math.hypot(this.spawnCenter.x - center.x, this.spawnCenter.z - center.z) < 130) return;
    this.spawnCenter = (this.spawnCenter || new THREE.Vector3()).copy(center);
    this.animals = this.animals.filter((a) => {
      if (Math.hypot(a.x - center.x, a.z - center.z) < 320) return true;
      this.scene.remove(a.mesh);
      disposeMesh(a.mesh);
      return false;
    });
    for (const [key, res] of this.resources) {
      if (Math.hypot(res.x - center.x, res.z - center.z) <= 500) continue;
      if (res.mesh) {
        this.scene.remove(res.mesh);
        disposeMesh(res.mesh);
      }
      this.resources.delete(key);
    }
    const rand = rngAt(Math.floor(center.x / 96), Math.floor(center.z / 96), this.world.seed + 706);
    let tries = 0;
    while (this.animals.length < this.maxAnimals && tries++ < 400) {
      const x = center.x + (rand() - 0.5) * 390;
      const z = center.z + (rand() - 0.5) * 390;
      const s = this.world.sample(x, z);
      const highest = s.biome === 'mountain' ? 300 : 140;
      if (
        !this.world.isWalkable(x, z) ||
        s.groundY > highest ||
        s.biome === 'city' ||
        s.biome === 'canyon' ||
        !NEIGHBOURS.some(([dx, dz]) => this.world.isWalkable(x + dx, z + dz, s.groundY))
      )
        continue;
      const pool = speciesFor(s.biome, s.groundY);
      const species = pool[Math.floor(rand() * pool.length)];
      const data = SPECIES[species];
      const id = this.nextId++;
      const mesh = buildAnimal(species, data, this.material);
      const animal = {
        id,
        species,
        data,
        x,
        z,
        y: s.groundY,
        px: x,
        py: s.groundY,
        pz: z,
        heading: 0,
        hunger: 0.1 + rand() * 0.6,
        thirst: 0.1 + rand() * 0.6,
        fatigue: 0.1 + rand() * 0.7,
        state: 'wander',
        target: null,
        path: [],
        retryWater: 0,
        retryFood: 0,
        stateTime: 0,
        decision: (id % 5) * 0.2,
        blocked: 0,
        resourceId: null,
        rng: rng(id + this.world.seed),
        mesh,
      };
      mesh.position.set(x, s.groundY, z);
      mesh.userData.animalId = id;
      this.scene.add(mesh);
      this.animals.push(animal);
    }
  }

  food(animal) {
    const found = [];
    for (let i = -2; i <= 2; i++) {
      for (let j = -2; j <= 2; j++) {
        const gx = Math.floor(animal.x / 16) + i;
        const gz = Math.floor(animal.z / 16) + j;
        const id = `${animal.data.diet}:${gx}:${gz}`;
        const x = gx * 16 + 8;
        const z = gz * 16 + 8;
        if (!this.world.isWalkable(x, z)) continue;
        if (!this.resources.has(id)) {
          const res = { id, x, z, quantity: 1, kind: animal.data.diet, mesh: null };
          if (res.kind === 'berries') {
            const b = new BoxBatch();
            const y = this.world.groundAt(x, z);
            b.add(x, y + 1.5, z, 3, 3, 3, 5536075);
            b.add(x - 1, y + 3, z, 1, 0.8, 1, 10313058);
            b.add(x + 1, y + 2.8, z + 1, 1, 0.8, 1, 12415089);
            res.mesh = b.mesh(this.material);
            this.scene.add(res.mesh);
          }
          this.resources.set(id, res);
        }
        const res = this.resources.get(id);
        if (res.quantity > 0.1) found.push({ id: res.id, x: res.x, z: res.z, kind: 'food' });
      }
    }
    found.sort((a, b) => Math.hypot(a.x - animal.x, a.z - animal.z) - Math.hypot(b.x - animal.x, b.z - animal.z));
    return found[0] || null;
  }

  water(animal) {
    const w = this.world;
    let best = null;
    let bestDist = Infinity;
    const consider = (x, z, dist) => {
      if (dist >= bestDist) return;
      const s = w.sample(x, z);
      if (s.wet || s.groundY - s.waterY > 4 || !w.isWalkable(x, z)) return;
      best = { x, z, kind: 'water' };
      bestDist = dist;
    };
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const pond = w.pondAt(animal.x + i * 480, animal.z + j * 480);
        if (!pond) continue;
        for (let k = 0; k < 24; k++) {
          for (const off of [14, 18, 22]) {
            const a = (k / 24) * TAU;
            const x = pond.x + Math.cos(a) * (pond.radius + off);
            const z = pond.z + Math.sin(a) * (pond.radius + off);
            consider(x, z, Math.hypot(x - animal.x, z - animal.z));
          }
        }
      }
    }
    for (let dz = -100; dz <= 100; dz += 12) {
      const z = animal.z + dz;
      const rx = w.riverX(z);
      for (const side of [-1, 1]) {
        for (let off = 16; off <= 44; off += 2) {
          const x = rx + off * side;
          consider(x, z, Math.hypot(animal.x - x, animal.z - z));
        }
      }
    }
    for (let k = 0; k < 32; k++) {
      const a = (k / 32) * TAU;
      for (const r of [16, 32, 64]) {
        if (r >= bestDist) continue;
        const x = animal.x + Math.cos(a) * r;
        const z = animal.z + Math.sin(a) * r;
        if (!NEIGHBOURS.some(([dx, dz]) => w.sample(x + dx, z + dz).wet)) continue;
        consider(x, z, r);
      }
    }
    return best;
  }

  wander(animal) {
    for (let i = 0; i < 12; i++) {
      const x = animal.x + (animal.rng() - 0.5) * 32;
      const z = animal.z + (animal.rng() - 0.5) * 32;
      if (this.world.isWalkable(x, z, animal.y)) return { x, z, kind: 'wander' };
    }
    return null;
  }

  assign(animal, target, state) {
    if (!target) return false;
    const path = findPath(this.world, animal, target, animal.data.size * 0.45);
    if (!path) return false;
    animal.target = target;
    animal.path = path;
    animal.state = state;
    return true;
  }

  decide(a) {
    if (a.thirst > 0.9 && this.time > a.retryWater && a.state !== 'drink' && a.state !== 'seekWater') {
      a.target = null;
      a.path = [];
      a.state = 'wander';
    }
    if (a.target || a.state === 'eat' || a.state === 'drink' || a.state === 'sleep') return;
    if (a.thirst > 0.65 && this.time > a.retryWater) {
      if (this.assign(a, this.water(a), 'seekWater')) return;
      a.retryWater = this.time + 45;
    }
    if (a.hunger > 0.6 && this.time > a.retryFood) {
      if (this.assign(a, this.food(a), 'seekFood')) return;
      a.retryFood = this.time + 12;
    }
    if (a.fatigue > 0.72 && this.world.isWalkable(a.x, a.z)) {
      a.state = 'sleep';
      a.stateTime = 0;
      return;
    }
    this.assign(a, this.wander(a), 'wander');
  }

  /** One fixed simulation step (CONFIG.simulationStep seconds). */
  update(dt) {
    this.time += dt;
    for (const res of this.resources.values()) res.quantity = Math.min(1, res.quantity + dt * 0.012);
    for (const a of this.animals) {
      a.px = a.x;
      a.py = a.y;
      a.pz = a.z;
      a.stateTime += dt;
      a.decision -= dt;
      const rates = a.data.rates;
      a.hunger = clamp(a.hunger + rates[0] * dt, 0, 1);
      a.thirst = clamp(a.thirst + rates[1] * dt, 0, 1);
      a.fatigue = clamp(a.fatigue + rates[2] * dt, 0, 1);
      if (a.state === 'eat') {
        const res = this.resources.get(a.resourceId);
        if (!res || res.quantity < 0.01) {
          a.state = 'wander';
          a.target = null;
        } else {
          const bite = Math.min(res.quantity, dt * 0.09);
          res.quantity -= bite;
          a.hunger = Math.max(0, a.hunger - bite);
          if (a.hunger < 0.17) {
            a.state = 'wander';
            a.target = null;
          }
        }
      } else if (a.state === 'drink') {
        a.thirst = Math.max(0, a.thirst - dt * 0.11);
        if (a.thirst < 0.13) {
          a.state = 'wander';
          a.target = null;
        }
      } else if (a.state === 'sleep') {
        a.fatigue = Math.max(0, a.fatigue - dt * 0.05);
        if (a.fatigue < 0.12 || (a.thirst > 0.92 && this.time > a.retryWater)) {
          a.state = 'wander';
          a.target = null;
        }
      }
      if (a.decision <= 0) {
        this.decide(a);
        a.decision = 1 + (a.id % 5) * 0.04;
      }
      if (a.target) this.walk(a, dt);
    }
  }

  walk(a, dt) {
    let next = a.path?.[0] || a.target;
    let dx = next.x - a.x;
    let dz = next.z - a.z;
    let dist = Math.hypot(dx, dz);
    // Reached a waypoint: aim for the next one in the same step (no pause at every corner).
    while (dist < 0.2 && a.path?.length > 1) {
      a.path.shift();
      next = a.path[0];
      dx = next.x - a.x;
      dz = next.z - a.z;
      dist = Math.hypot(dx, dz);
    }
    if (dist < 1.8 && (!a.path || a.path.length <= 1)) {
      const kind = a.target.kind;
      a.resourceId = a.target.id ?? null;
      a.target = null;
      a.state = kind === 'food' ? 'eat' : kind === 'water' ? 'drink' : 'wander';
      a.stateTime = 0;
      return;
    }
    const stride = Math.min(dist, a.data.speed * dt);
    const nx = a.x + (dx / dist) * stride;
    const nz = a.z + (dz / dist) * stride;
    if (this.world.isWalkable(nx, nz, a.y, a.data.size * 0.45)) {
      a.x = nx;
      a.z = nz;
      a.y = this.world.groundAt(nx, nz);
      a.blocked = 0;
      a.heading = Math.atan2(-dx, -dz);
      return;
    }
    // Blocked: sidestep, and give up on the target after three seconds.
    a.blocked += dt;
    const side = a.id % 2 ? 1 : -1;
    const sx = a.x - (dz / dist) * stride * side;
    const sz = a.z + (dx / dist) * stride * side;
    if (this.world.isWalkable(sx, sz, a.y)) {
      a.x = sx;
      a.z = sz;
      a.y = this.world.groundAt(sx, sz);
    }
    if (a.blocked > 3) {
      if (a.state === 'seekWater') a.retryWater = this.time + 45;
      if (a.state === 'seekFood') a.retryFood = this.time + 12;
      a.target = null;
      a.path = [];
      a.state = 'wander';
      a.blocked = 0;
      a.decision = 2;
    }
  }

  /**
   * Place the meshes between the last two simulation steps (alpha 0..1), so
   * animals glide instead of hopping five times a second.
   */
  render(alpha, time, dt) {
    const turn = Math.min(1, dt * 8);
    const squash = Math.min(1, dt * 5);
    for (const a of this.animals) {
      const m = a.mesh;
      const bob = a.target ? Math.sin(time * 8 + a.id) * 0.1 : 0;
      m.position.set(lerp(a.px, a.x, alpha), lerp(a.py, a.y, alpha) + bob, lerp(a.pz, a.z, alpha));
      let d = a.heading - m.rotation.y;
      d = ((((d + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
      m.rotation.y += d * turn;
      const sy = a.data.size * (a.state === 'sleep' ? 0.48 : 1);
      m.scale.y += (sy - m.scale.y) * squash;
      m.rotation.x = a.state === 'eat' || a.state === 'drink' ? 0.12 : 0;
    }
  }

  nearby(pos) {
    return [...this.animals].sort((a, b) => Math.hypot(a.x - pos.x, a.z - pos.z) - Math.hypot(b.x - pos.x, b.z - pos.z));
  }

  reset() {
    for (const a of this.animals) {
      this.scene.remove(a.mesh);
      disposeMesh(a.mesh);
    }
    for (const res of this.resources.values()) {
      if (!res.mesh) continue;
      this.scene.remove(res.mesh);
      disposeMesh(res.mesh);
    }
    this.animals = [];
    this.resources.clear();
    this.spawnCenter = null;
    this.nextId = 0;
    this.time = 0;
  }
}
