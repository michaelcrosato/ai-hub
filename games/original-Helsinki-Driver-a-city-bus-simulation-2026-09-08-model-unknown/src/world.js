import { Path, SpatialHash, boundsOf, right, add, scale, distance, rng, pointInPolygon } from './math.js';

export function validateWorld(data) {
  if (data?.schemaVersion !== 1) throw new Error('Unsupported city schema; expected schemaVersion 1.');
  if (!data.route?.points?.length || !Array.isArray(data.roads) || !Array.isArray(data.route.stops)) throw new Error('City data needs route points, stops and roads.');
  for (const p of data.route.points) if (!Array.isArray(p) || p.length < 2 || !p.every(Number.isFinite)) throw new Error('Invalid route coordinate.');
  if (data.route.points.length > 150000 || data.buildings?.length > 100000) throw new Error('City pack exceeds the supported prototype budget. Import a route corridor, not the entire region.');
  if (data.route.stops.length < 2) throw new Error('At least two stops are required.');
  return data;
}

/** The passengers with a scripted conversation, by stop and place in the queue: [stop, slot, kind]. */
const DEFAULT_SPECIALS = [[0, 0, 'regular'], [0, 1, 'ordinary'], [1, 0, 'contactless'], [2, 0, 'pram'], [2, 1, 'ticket'], [3, 0, 'slow'], [4, 0, 'wheelchair']];

export class World {
  constructor(data) {
    this.data = validateWorld(data); this.meta = data.metadata; this.route = new Path(data.route.points);
    this.roads = data.roads.map((r) => ({ ...r, path: new Path(r.points), speedLimit: Number(r.speedLimit) || 30, width: Number(r.width) || 9 }));
    this.roadHash = new SpatialHash(70);
    this.roads.forEach((r) => { const b = boundsOf(r.points), pad = r.width / 2 + 8; this.roadHash.insert(r, [b[0] - pad, b[1] - pad, b[2] + pad, b[3] + pad]); });
    this.buildings = (data.buildings || []).map((b) => ({ ...b, bounds: boundsOf(b.footprint) }));
    this.buildingHash = new SpatialHash(70); this.buildings.forEach((b) => this.buildingHash.insert(b, b.bounds));
    this.stops = data.route.stops.map((s, i) => {
      const projection = this.route.project(s.dock || s.point); const at = Number.isFinite(s.s) ? s.s : projection.s;
      const q = this.route.sample(at);
      return { ...s, id: String(s.id ?? i), s: at, dock: s.dock || q.point, yaw: s.yaw ?? q.yaw, index: i, arrival: Number(s.arrival) || 0, departure: Number(s.departure) || 0 };
    });
    this.stops.sort((a, b) => a.s - b.s);
    this.signals = (data.signals || []).map((s, i) => ({ ...s, id: s.id || `signal-${i}`, s: s.s ?? this.route.project(s.point).s, offset: s.offset ?? i * 17 }));
    this.crossings = (data.crossings || []).map((s, i) => ({ ...s, id: s.id || `crossing-${i}`, s: s.s ?? this.route.project(s.point).s }));
    this.stopSigns = (data.stopSigns || []).map((s, i) => {
      const q = this.route.project(s.point);
      return { ...s, id: s.id || `stop-sign-${i}`, s: s.s ?? q.s, yaw: s.yaw ?? q.yaw };
    });
    this.turns = data.turns || [];
    this.specials = Array.isArray(data.route.specials) ? data.route.specials : DEFAULT_SPECIALS;
    this.props = this.makeProps();
    this.propHash = new SpatialHash(60); this.props.cars.forEach((c) => this.propHash.insert(c, [c.point[0] - 4, c.point[1] - 4, c.point[0] + 4, c.point[1] + 4]));
    this.totalBounds = boundsOf(this.roads.flatMap((r) => r.points));
  }
  nearestRoad(p) {
    let best = null; let d = Infinity;
    for (const road of this.roadHash.query(p, 25)) {
      const q = road.path.project(p), edge = q.distance - road.width / 2;
      if (edge < d) { d = edge; best = { road, ...q, edge }; }
    }
    return best;
  }
  makeProps() {
    const random = rng(2404070), trees = [], lamps = [], cars = [];
    const isBuilding = (p) => this.buildingHash.query(p, 1).some((b) => pointInPolygon(p, b.footprint));
    for (const road of this.roads) {
      if (road.kind === 'motorway') continue;
      for (let s = 20; s < road.path.length - 15; s += 34) {
        const q = road.path.sample(s), r = right(q.yaw);
        for (const side of [-1, 1]) {
          const p = add(q.point, scale(r, side * (road.width / 2 + 2.4)));
          const onOther = this.roadHash.query(p, 10).some((o) => o !== road && o.path.project(p).distance < o.width / 2 + 2);
          const nearStop = this.stops.some((st) => distance(st.point, p) < 12);
          if (onOther || nearStop || isBuilding(p)) continue;
          lamps.push({ point: p, yaw: q.yaw, side });
          if (road.rail || random() > 0.6) trees.push({ point: add(p, scale(q.dir, 8)), height: 7 + random() * 5, seed: random() * 100000 });
          // Park outside the running lane, only where sufficient verge exists.
          const carPoint = add(q.point, scale(r, side * (road.width / 2 + 1.15)));
          if (random() > 0.64 && !road.rail && road.kind !== 'pedestrian' && !isBuilding(carPoint)) cars.push({ id: `parked-${cars.length}`, point: carPoint, yaw: q.yaw + (side < 0 ? Math.PI : 0), color: Math.floor(random() * 6) });
        }
      }
    }
    for (const [i, park] of (this.data.parks || []).entries()) {
      const b = boundsOf(park.polygon); let attempts = 0;
      while (attempts++ < Math.min(40, ((b[2] - b[0]) * (b[3] - b[1])) / 200)) {
        const p = [b[0] + random() * (b[2] - b[0]), b[1] + random() * (b[3] - b[1])];
        if (pointInPolygon(p, park.polygon) && !isBuilding(p)) trees.push({ point: p, height: 6 + random() * 6, seed: i * 47 + attempts });
      }
    }
    return { trees, lamps, cars };
  }
  at(s) { return this.route.sample(s); }
}
