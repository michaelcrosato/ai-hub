import { test } from "./conditions.mjs";

export class WorldService {
  constructor(runtime, adapter) {
    this.runtime = runtime;
    this.adapter = adapter;
    this.maps = new Map();
    this.flows = new Map();
    this.bodies = new Map();
  }
  get state() {
    return this.runtime.state;
  }
  location(id = this.state.scene) {
    const location = this.runtime.definition.locations.find((l) => l.id === id);
    if (!location) throw new Error(`Unknown scene: ${id}`);
    return location;
  }
  entities(scene = this.state.scene) {
    return Object.values(this.state.entities).filter(
      (e) => e.scene === scene && this.isPresent(e),
    );
  }
  isPresent(entity) {
    if (
      entity.active === false ||
      entity.vehicle ||
      entity.handedOver ||
      !test(entity.visible, this.state)
    )
      return false;
    if (["surface", "prop"].includes(entity.kind)) {
      const exhibit = Object.entries(this.runtime.definition.evidence).find(
        ([id, spec]) => (spec.entity || id) === entity.id,
      );
      if (
        exhibit &&
        !["statement", "observation", "comparison"].includes(exhibit[1].kind) &&
        this.state.evidence[exhibit[0]]?.holder &&
        this.state.evidence[exhibit[0]].holder !== "scene"
      )
        return false;
    }
    return true;
  }
  solidShapes(id = this.state.scene) {
    const loc = this.location(id);
    return [
      ...(loc.buildings || []),
      ...(loc.props || []).filter((p) => p.solid),
      ...(loc.gates || []).filter((g) => !test(g.openWhen, this.state)),
      ...this.entities(id).filter((e) => e.kind === "door" && !e.open),
      ...this.entities(id)
        .filter(
          (e) => e.solid && ["prop", "container", "surface"].includes(e.kind),
        )
        .map((e) => ({ ...e, x: e.x - e.w / 2, y: e.y - e.d / 2 })),
    ];
  }
  map(id = this.state.scene) {
    const loc = this.location(id),
      shapes = this.solidShapes(id);
    const signature = JSON.stringify(
      shapes.map((p) => [p.id, p.x, p.y, p.w, p.d, p.h]),
    );
    const cached = this.maps.get(id);
    if (cached?.signature === signature) return cached.map;
    const types = Object.fromEntries(
      shapes.map((p, i) => [
        i + 1,
        {
          h: p.h || 32,
          top: p.roof || p.color || "#74847f",
          side: p.color || "#546862",
        },
      ]),
    );
    const E = this.adapter.E;
    const map = new E.TileMap({
      w: Math.ceil(loc.size.w / 16),
      h: Math.ceil(loc.size.h / 16),
      types,
      floorTex: (x, y, tag) => {
        const colors = {
          concrete: [120, 139, 131],
          road: [57, 66, 71],
          wood: [116, 101, 78],
          grass: [74, 99, 78],
          water: [33, 75, 85],
          tile: [148, 146, 125],
        };
        const c = colors[tag] || colors.concrete,
          shade = ((Math.floor(x / 4) * 13 + Math.floor(y / 4) * 7) % 7) - 3;
        return c.map((n) => n + shade);
      },
      ao: 4,
    });
    const bounds = loc.bounds || { x: 0, y: 0, w: loc.size.w, h: loc.size.h };
    for (let cy = 0; cy < map.h; cy++)
      for (let cx = 0; cx < map.w; cx++) {
        const x = cx * 16 + 8,
          y = cy * 16 + 8;
        const floor = [...(loc.floors || [])]
          .reverse()
          .find((f) => x >= f.x && y >= f.y && x < f.x + f.w && y < f.y + f.d);
        map.setFloor(cx, cy, floor?.tag || "concrete", !!floor?.blocked);
        if (
          x < bounds.x ||
          y < bounds.y ||
          x >= bounds.x + bounds.w ||
          y >= bounds.y + bounds.h
        )
          map.block(cx, cy, true);
      }
    shapes.forEach((p, i) =>
      map.fill(
        Math.floor(p.x / 16),
        Math.floor(p.y / 16),
        Math.ceil(p.w / 16),
        Math.ceil(p.d / 16),
        i + 1,
      ),
    );
    this.maps.set(id, { signature, map });
    // FlowFields reference their map; discard them after a door/gate rebuild.
    for (const key of this.flows.keys())
      if (key.startsWith(id + ":")) this.flows.delete(key);
    return map;
  }
  canSee(from, to, options) {
    if (from.scene !== to.scene) return false;
    if ((to.kind === "door" && !to.open) || to.solid) {
      // A closed door occludes its far side, but its near face remains an interaction target.
      const left = to.x - (to.kind === "door" ? 0 : to.w / 2),
        top = to.y - (to.kind === "door" ? 0 : to.d / 2);
      const x = Math.max(left, Math.min(from.x, left + (to.w || 16))),
        y = Math.max(top, Math.min(from.y, top + (to.d || 16)));
      const d = Math.hypot(from.x - x, from.y - y) || 1;
      return this.map(from.scene).sight(
        from,
        { ...to, x: x + ((from.x - x) / d) * 2, y: y + ((from.y - y) / d) * 2 },
        options,
      );
    }
    return this.map(from.scene).sight(from, to, options);
  }
  clearAt(x, y, r = 7, scene = this.state.scene, ignore = []) {
    if (!this.map(scene).standable(x, y, 0, r)) return false;
    const player = this.state.player;
    const colliders = [
      ...this.entities(scene),
      ...(player.scene === scene && !player.vehicle
        ? [{ ...player, kind: "person" }]
        : []),
    ];
    return !colliders.some(
      (e) =>
        !ignore.includes(e.id) &&
        ["person", "vehicle"].includes(e.kind) &&
        Math.hypot(e.x - x, e.y - y) <
          r + (e.r || (e.kind === "vehicle" ? 20 : 7)),
    );
  }
  move(entity, vx, vy, dt, { ignore = [], dynamic = true } = {}) {
    const map = this.map(entity.scene),
      old = { x: entity.x, y: entity.y };
    let body = this.bodies.get(entity.id);
    if (!body) {
      body = this.adapter.body({
        x: entity.x,
        y: entity.y,
        r: entity.r || (entity.kind === "vehicle" ? 20 : 7),
      });
      this.bodies.set(entity.id, body);
    }
    Object.assign(body, { x: entity.x, y: entity.y, z: entity.z || 0, vx, vy });
    body.update(dt, map);
    let hit = !!body.hitWall;
    if (
      dynamic &&
      !this.clearAt(body.x, body.y, body.r, entity.scene, [
        entity.id,
        ...ignore,
      ])
    ) {
      // Axis slide retains collision and allows walking past a person instead of vibrating against them.
      if (
        this.clearAt(body.x, old.y, body.r, entity.scene, [
          entity.id,
          ...ignore,
        ])
      )
        body.y = old.y;
      else if (
        this.clearAt(old.x, body.y, body.r, entity.scene, [
          entity.id,
          ...ignore,
        ])
      )
        body.x = old.x;
      else {
        body.x = old.x;
        body.y = old.y;
      }
      hit = true;
    }
    Object.assign(entity, {
      x: body.x,
      y: body.y,
      z: body.z,
      vx: (body.x - old.x) / dt,
      vy: (body.y - old.y) / dt,
    });
    if (Math.hypot(entity.vx, entity.vy) > 1 && !entity.aiming)
      entity.facing = Math.atan2(entity.vy, entity.vx);
    return { hit, moved: Math.hypot(entity.x - old.x, entity.y - old.y) };
  }
  toward(entity, destination, dt, speed = 68, options = {}) {
    const d = Math.hypot(destination.x - entity.x, destination.y - entity.y);
    if (d <= (options.stop || 5)) {
      entity.vx = entity.vy = 0;
      return { arrived: true, moved: 0 };
    }
    const map = this.map(entity.scene),
      key = `${entity.scene}:${entity.id}`;
    if (!this.flows.has(key)) this.flows.set(key, this.adapter.flow(map));
    const flow = this.flows.get(key);
    flow.update(destination.x, destination.y);
    let direction = flow.dir(entity.x, entity.y, destination.x, destination.y);
    // Flow cells lead to their centers. Close a clear final segment toward the actual anchor,
    // otherwise an actor can stop beside a vehicle that happens to overlap that cell center.
    const radius = entity.r || (entity.kind === "vehicle" ? 20 : 7);
    const dx = (destination.x - entity.x) / d,
      dy = (destination.y - entity.y) / d;
    if (
      [-radius, 0, radius].every((offset) =>
        map.los(
          entity.x - dy * offset,
          entity.y + dx * offset,
          destination.x - dy * offset,
          destination.y + dx * offset,
        ),
      )
    )
      direction = [dx, dy];
    if (!flow.next(entity.x, entity.y) && !map.sight(entity, destination))
      return { arrived: false, stuck: true, moved: 0 };
    const step = Math.min(speed, d / dt);
    let result = this.move(
      entity,
      direction[0] * step,
      direction[1] * step,
      dt,
      options,
    );
    if (result.moved < dt && result.hit) {
      const angle = Math.atan2(direction[1], direction[0]);
      for (const turn of [0.6, -0.6, 1.2, -1.2, Math.PI / 2, -Math.PI / 2]) {
        const vx = Math.cos(angle + turn) * step,
          vy = Math.sin(angle + turn) * step;
        if (
          this.clearAt(
            entity.x + vx * dt,
            entity.y + vy * dt,
            radius,
            entity.scene,
            [entity.id, ...(options.ignore || [])],
          )
        ) {
          result = this.move(entity, vx, vy, dt, options);
          break;
        }
      }
    }
    return { ...result, arrived: false, stuck: result.moved < dt };
  }
  nearestAnchor(entity) {
    return [
      ...(this.location(entity.scene).recovery ||
        Object.values(this.location(entity.scene).anchors)),
    ]
      .sort(
        (a, b) =>
          Math.hypot(entity.x - a.x, entity.y - a.y) -
          Math.hypot(entity.x - b.x, entity.y - b.y),
      )
      .find((p) =>
        this.clearAt(p.x, p.y, entity.r || 20, entity.scene, [entity.id]),
      );
  }
  objectiveTarget(id = this.runtime.objective.target) {
    if (id === "radio" || id === "player") return this.state.player;
    const target = this.state.entities[id];
    if (!target || target.scene === this.state.scene) return target;
    const edges = [];
    for (const interaction of this.runtime.definition.interactions || []) {
      const entity = this.state.entities[interaction.entity],
        action = this.runtime.actions[interaction.action];
      for (const effect of action?.effects || [])
        if (entity && effect.op === "transition")
          edges.push({ from: entity.scene, to: effect.scene, entity });
    }
    const queue = [{ scene: this.state.scene, via: null }],
      seen = new Set();
    while (queue.length) {
      const next = queue.shift();
      if (seen.has(next.scene)) continue;
      seen.add(next.scene);
      if (next.scene === target.scene)
        return { ...next.via, leadsTo: target.scene };
      for (const edge of edges)
        if (edge.from === next.scene)
          queue.push({ scene: edge.to, via: next.via || edge.entity });
    }
    return null;
  }
}
