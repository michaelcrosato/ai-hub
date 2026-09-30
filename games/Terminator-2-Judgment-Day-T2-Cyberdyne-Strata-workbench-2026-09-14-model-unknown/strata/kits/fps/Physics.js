import { compose, mm, bounds, rayBox, add, mul } from '../../core/math3d.js';
const EPS = 0.0005;
export function overlaps(a, b) {
  return a.min.every((v, i) => v < b.max[i] - EPS && a.max[i] > b.min[i] + EPS);
}
export function characterBox(p, r = 0.3, h = 1.85) {
  return { min: [p[0] - r, p[1], p[2] - r], max: [p[0] + r, p[1] + h, p[2] + r] };
}
// This kit deliberately uses axis-aligned collision boxes. Rotation uses conservative world bounds.
// It is not a general rigid-body solver. A cartridge can supply a different physics implementation.
export class BoxWorld {
  entities = [];
  colliders = [];
  constructor(gravity = 24) {
    this.gravity = gravity;
  }
  add(data, blueprint, root) {
    const e = {
      data,
      blueprint,
      root,
      position: [...data.position],
      rotation: [...data.rotation],
      velocity: [0, 0, 0],
      delta: [0, 0, 0],
      dynamic: blueprint.body === 'dynamic',
      kinematic: blueprint.body === 'kinematic',
      active: true,
      colliders: [],
      state: {},
    };
    this.entities.push(e);
    for (const c of blueprint.colliders)
      e.colliders.push({ entity: e, source: c, sensor: !!c.sensor, min: [0, 0, 0], max: [0, 0, 0], enabled: true });
    this.colliders.push(...e.colliders);
    this.sync(e);
    return e;
  }
  sync(e) {
    const matrix = compose(e.position, e.rotation, e.data.scale);
    e.root.position = [...e.position];
    e.root.rotation = [...e.rotation];
    for (const c of e.colliders) {
      const b = bounds(mm(matrix, compose(c.source.position)), c.source.size);
      c.min = b.min;
      c.max = b.max;
    }
  }
  ray(origin, dir, distance = 100, { ignore = null, sensors = false, predicate = null } = {}) {
    let best = null;
    for (const c of this.colliders) {
      if (!c.enabled || !c.entity.active || c.entity === ignore || (c.sensor && !sensors) || (predicate && !predicate(c))) continue;
      const t = rayBox(origin, dir, c.min, c.max, best?.distance ?? distance);
      if (t !== null && (!best || t < best.distance)) best = { collider: c, entity: c.entity, distance: t, point: add(origin, mul(dir, t)) };
    }
    return best;
  }
  blocked(box, ignore = null) {
    return this.colliders.some((c) => c.enabled && c.entity.active && !c.sensor && c.entity !== ignore && overlaps(box, c));
  }
  sweep(box, axis, amount, ignore = null) {
    let value = amount,
      hit = null;
    for (const c of this.colliders) {
      if (!c.enabled || !c.entity.active || c.sensor || c.entity === ignore) continue;
      let other = true;
      for (let i = 0; i < 3; i++) if (i !== axis && (box.max[i] <= c.min[i] + EPS || box.min[i] >= c.max[i] - EPS)) other = false;
      if (!other) continue;
      if (amount > 0 && box.max[axis] <= c.min[axis] + EPS && box.max[axis] + value > c.min[axis]) {
        value = Math.max(0, c.min[axis] - box.max[axis] - EPS);
        hit = c;
      }
      if (amount < 0 && box.min[axis] >= c.max[axis] - EPS && box.min[axis] + value < c.max[axis]) {
        value = Math.min(0, c.max[axis] - box.min[axis] + EPS);
        hit = c;
      }
    }
    return { amount: value, hit };
  }
  moveCharacter(position, displacement, { radius = 0.3, height = 1.85, stepHeight = 0.32, grounded = false, ignore = null, push = false } = {}) {
    const p = [...position];
    let ground = null,
      ceiling = false;
    for (const axis of [0, 2, 1]) {
      let box = characterBox(p, radius, height),
        result = this.sweep(box, axis, displacement[axis], ignore);
      if (axis !== 1 && result.hit && grounded && stepHeight > 0) {
        const rise = result.hit.max[1] - p[1] + EPS * 2;
        if (rise > 0 && rise <= stepHeight + EPS) {
          const raised = [...p];
          raised[1] += rise;
          if (!this.blocked(characterBox(raised, radius, height), ignore)) {
            const step = this.sweep(characterBox(raised, radius, height), axis, displacement[axis], ignore);
            if (Math.abs(step.amount) > Math.abs(result.amount) + EPS) {
              p[1] = raised[1];
              result = step;
            }
          }
        }
      }
      p[axis] += result.amount;
      if (axis === 1 && result.hit) {
        if (displacement[1] < 0) ground = result.hit;
        else ceiling = true;
      }
      if (push && axis !== 1 && result.hit?.entity.dynamic) result.hit.entity.velocity[axis] += Math.sign(displacement[axis]) * 1.2;
    }
    return { position: p, grounded: !!ground, ground: ground?.entity ?? null, ceiling };
  }
  step(dt, held = null) {
    for (const e of this.entities) {
      if (!e.active || !e.dynamic || e === held) continue;
      e.velocity[1] = Math.max(-40, e.velocity[1] - this.gravity * dt);
      for (const axis of [0, 2, 1]) {
        const solid = e.colliders.find((c) => !c.sensor);
        if (!solid) continue;
        const result = this.sweep(solid, axis, e.velocity[axis] * dt, e);
        e.position[axis] += result.amount;
        if (result.hit) {
          e.velocity[axis] = axis === 1 && e.velocity[axis] < -2 ? -e.velocity[axis] * 0.12 : 0;
        }
        this.sync(e);
      }
      e.velocity[0] *= Math.exp(-2.5 * dt);
      e.velocity[2] *= Math.exp(-2.5 * dt);
      if (e.position[1] < -20) {
        e.position = [...e.data.position];
        e.velocity = [0, 0, 0];
        this.sync(e);
      }
    }
  }
  dispose() {
    this.entities = [];
    this.colliders = [];
  }
}
