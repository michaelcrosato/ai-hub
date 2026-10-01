import { damp, distance, Path, right, forward, add, scale, wrapAngle, rng } from './math.js';

/** Timings are synthetic. OSM/HSL do not supply live Helsinki signal phases. */
export function signalPhase(seconds, offset = 0, axis = 0) {
  const p = (((seconds + offset + axis * 36) % 72) + 72) % 72;
  return p < 26 ? 'green' : p < 29 ? 'amber' : p < 70 ? 'red' : 'red-amber';
}
export function signalAllows(phase) { return phase === 'green'; }

export class TrafficSystem {
  constructor(world, density = 1) {
    this.world = world; this.cars = []; this.random = rng(761240); this.busBody = [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]];
    // The player route is a continuous lane path; the pack's other roads add local traffic.
    const route = world.route;
    const count = Math.round(5 * density);
    for (let i = 0; i < count; i++) this.cars.push({ id: `route-car-${i}`, path: route, s: 160 + i * (route.length / Math.max(2, count)), v: 5, target: 8.3, yaw: 0, point: [0, 0], onRoute: true, color: i % 6, waiting: false, retired: false });
    const candidates = world.roads.filter((r) => r.path.length > 170 && r.kind !== 'pedestrian' && r.kind !== 'footway');
    for (let i = 0; i < Math.round(6 * density) && candidates.length; i++) {
      const road = candidates[(i * 3 + 1) % candidates.length], reverse = !road.oneway && i % 2 === 0;
      const points = reverse ? [...road.points].reverse() : road.points;
      const base = new Path(points), offset = road.oneway ? 0 : road.rail ? 4.5 : Math.min(2.2, road.width * 0.22);
      const pp = []; for (let s = 0; s < base.length; s += 6) pp.push(base.sample(s, offset).point); pp.push(base.sample(base.length, offset).point);
      const path = new Path(pp);
      this.cars.push({ id: `local-car-${i}`, path, s: 35 + this.random() * (path.length - 65), v: 3, target: Math.min((road.speedLimit / 3.6) * 0.8, 9), yaw: 0, point: [0, 0], onRoute: false, color: (i + 2) % 6, waiting: false, retired: false });
    }
    this.cars.forEach((c) => { const p = c.path.sample(c.s); c.point = p.point; c.yaw = p.yaw; });
    this.walkers = world.crossings.map((c, i) => ({ id: `walker-${i}`, crossing: c, active: false, waiting: false, done: false, t: 0, point: add(c.point, scale(right(c.yaw), -c.width * 0.5 - 1.5)), enabled: i % 3 !== 2 }));
  }
  update(dt, sim) {
    const bus = sim.bus, busPoint = [bus.x, bus.z];
    // Points along the bus body: a car whose lane the bus straddles (in a junction, pulling out) waits for it.
    const bf = forward(bus.yaw);
    for (let k = 0; k < 5; k++) { const d = (k - 2) * 2.8; this.busBody[k][0] = bus.x + bf[0] * d; this.busBody[k][1] = bus.z + bf[1] * d; }
    for (const c of this.cars) {
      if (c.retired) {
        // A car that left the corridor at the end of its road comes back at the start once that is out of view.
        if (distance(c.path.points[0], busPoint) > 150) { c.retired = false; c.s = 5; c.v = 3; c.haltedAt = null; const p = c.path.sample(c.s); c.point = p.point; c.yaw = p.yaw; }
        continue;
      }
      let target = c.target; const ahead = 22 + (c.v * c.v) / 5;
      for (const sig of this.world.signals) {
        const turn = Math.abs(wrapAngle(sig.yaw - c.yaw));
        if (turn < 1.1) {
          const q = c.path.project(sig.point, c.s, ahead + 10), ds = q.s - c.s - 2.5;
          if (q.distance < 5 && ds > -0.5 && ds < ahead && !signalAllows(signalPhase(sim.time, sig.offset))) target = Math.min(target, Math.sqrt(Math.max(0, ds - 2) * 3.8));
        } else if (sig.intersection) {
          // Cross and oncoming traffic stop short of the junction on their own phase (cross streets run 36 s out of step),
          // far enough back that the 12 m bus can swing through the corner past them.
          const q = c.path.project(sig.intersection, c.s, ahead + 22), ds = q.s - c.s - 13;
          const phase = signalPhase(sim.time, sig.offset, turn < 2.05 ? 1 : 0);
          if (q.distance < 6 && ds > -0.5 && ds < ahead && !signalAllows(phase)) target = Math.min(target, Math.sqrt(Math.max(0, ds - 1) * 3.8));
        }
      }
      // Stop signs: come to a halt at the line, then go once the way looks clear.
      for (const sign of this.world.stopSigns) {
        const q = c.path.project(sign.point, c.s, ahead + 10), ds = q.s - c.s - 2.5;
        if (q.distance < 5 && Math.abs(wrapAngle(sign.yaw - c.yaw)) < 1.1 && c.haltedAt !== sign.id) {
          if (ds > -0.5 && ds < ahead) target = Math.min(target, Math.sqrt(Math.max(0, ds - 0.2) * 3.8));
          if (ds > -0.5 && ds < 1.6 && c.v < 0.4) c.haltedAt = sign.id;
        }
      }
      for (const other of this.cars) if (other !== c && !other.retired && Math.abs(wrapAngle(other.yaw - c.yaw)) < 0.55) {
        const q = c.path.project(other.point, c.s, 45), gap = q.s - c.s - 5;
        if (q.distance < 2.4 && gap > -0.5 && gap < 25) target = Math.min(target, Math.max(0, (gap - 3) * 0.62));
      }
      const bp = c.path.project(busPoint, c.s, 55), gap = bp.s - c.s - 8;
      if (bp.distance < 2.7 && gap > -0.6 && gap < 40) target = Math.min(target, Math.max(0, (gap - 3) * 0.5));
      else if (distance(c.point, busPoint) < 45) {
        for (const pt of this.busBody) {
          const q = c.path.project(pt, c.s, 40), g = q.s - c.s - 4;
          if (q.distance < 2.9 && g > -1 && g < 30) target = Math.min(target, Math.max(0, (g - 2) * 0.5));
        }
      }
      // A conservative courtesy yield to an indicating bus, never a forced cut-in.
      if (bus.indicator === 'left' && Math.abs(bus.v) < 1 && bp.distance < 5 && gap > -1 && gap < 35) target = 0;
      for (const w of this.walkers) if (w.waiting || w.active) {
        const q = c.path.project(w.crossing.point, c.s, ahead + 5), d = q.s - c.s - 4;
        if (q.distance < 8 && d > -0.4 && d < ahead) target = Math.min(target, Math.sqrt(Math.max(0, d - 2) * 3.8));
      }
      c.waiting = target < 0.4; c.v = damp(c.v, target, target < c.v ? 2.1 : 0.55, dt); c.s += c.v * dt;
      if (c.s > c.path.length - 2) {
        // At the end of its road the car turns off out of the corridor. It used to park there for as long as the
        // bus was near, blocking the junction (T2 turns right across such an end).
        if (distance(c.point, busPoint) > 150 && distance(c.path.points[0], busPoint) > 150) { c.s = 5; c.v = 3; c.haltedAt = null; }
        else { c.retired = true; c.v = 0; c.waiting = false; continue; }
      }
      const p = c.path.sample(c.s); c.point = p.point; c.yaw = p.yaw;
    }
    for (const w of this.walkers) {
      if (!w.enabled || w.done) continue;
      const c = w.crossing, delta = c.s - sim.routePosition;
      if (!w.waiting && !w.active && delta > 10 && delta < 90) { w.waiting = true; w.t = 0; }
      if (w.waiting) {
        w.t += dt;
        const sufficientlyClear = delta > 65 || delta < -14 || (Math.abs(bus.v) < 0.7 && delta > 6);
        if (w.t > 2.5 && sufficientlyClear) { w.waiting = false; w.active = true; w.t = 0; }
      }
      if (w.active) {
        w.t += dt; const traversed = w.t * 1.2;
        w.point = add(c.point, scale(right(c.yaw), -c.width * 0.5 - 1.5 + traversed));
        if (traversed > c.width + 3) { w.active = false; w.done = true; }
      }
    }
  }
}
