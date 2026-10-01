import { distance } from './math.js';

/** Track state changes. A route cache must not use an old door state. */
class DoorStates extends Map {
  constructor() {
    super();
    this.revision = 0;
  }
  set(id, value) {
    if (this.get(id) !== value) this.revision++;
    return super.set(id, value);
  }
  delete(id) {
    if (this.has(id)) this.revision++;
    return super.delete(id);
  }
  clear() {
    if (this.size) this.revision++;
    super.clear();
  }
}

class MinQueue {
  constructor() {
    this.heap = [];
  }
  get size() {
    return this.heap.length;
  }
  less(a, b) {
    return a.score < b.score || (a.score === b.score && a.order < b.order);
  }
  push(item) {
    const h = this.heap;
    h.push(item);
    let i = h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(item, h[p])) break;
      h[i] = h[p];
      i = p;
    }
    h[i] = item;
  }
  pop() {
    const h = this.heap;
    const top = h[0];
    const tail = h.pop();
    if (h.length) {
      let i = 0;
      while (true) {
        let c = i * 2 + 1;
        if (c >= h.length) break;
        if (c + 1 < h.length && this.less(h[c + 1], h[c])) c++;
        if (!this.less(h[c], tail)) break;
        h[i] = h[c];
        i = c;
      }
      h[i] = tail;
    }
    return top;
  }
}

/** One portal graph serves A* movement and Dijkstra sound paths. Windows never serve movement. */
export class Navigation {
  constructor(city) {
    this.city = city;
    this.edges = new Map();
    this.doorOpen = new DoorStates();
    this.cache = new Map();
    this.cacheRevision = -1;
    this.nodes = new Map(city.nodes.map((n) => [n.id, n]));
    for (const p of city.portals) {
      if (!this.edges.has(p.a)) this.edges.set(p.a, []);
      if (!this.edges.has(p.b)) this.edges.set(p.b, []);
      this.edges.get(p.a).push({ to: p.b, portal: p });
      this.edges.get(p.b).push({ to: p.a, portal: p });
    }
  }
  route(start, end, mode = 'walk') {
    if (!this.nodes.has(start) || !this.nodes.has(end)) return null;
    if (start === end) return { nodes: [start], portals: [], cost: 0 };
    if (this.cacheRevision !== this.doorOpen.revision) {
      this.cache.clear();
      this.cacheRevision = this.doorOpen.revision;
    }
    const key = `${mode}|${start}|${end}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const route = this.find(start, end, mode);
    if (this.cache.size >= 512) this.cache.delete(this.cache.keys().next().value);
    this.cache.set(key, route);
    return route;
  }
  find(start, end, mode) {
    const open = new MinQueue();
    const costs = new Map([[start, 0]]);
    const from = new Map();
    let order = 0;
    const goal = this.nodes.get(end).position;
    const h = (id) => (mode === 'walk' ? distance(this.nodes.get(id).position, goal) : 0);
    open.push({ id: start, g: 0, score: h(start), order: order++ });
    while (open.size) {
      const current = open.pop();
      if (current.g !== costs.get(current.id)) continue;
      if (current.id === end) {
        const nodes = [end];
        const portals = [];
        let id = end;
        while (id !== start) {
          const p = from.get(id);
          nodes.push(p.id);
          portals.push(p.portal);
          id = p.id;
        }
        return { nodes: nodes.reverse(), portals: portals.reverse(), cost: current.g };
      }
      const here = this.nodes.get(current.id).position;
      for (const e of this.edges.get(current.id) ?? []) {
        if (mode === 'walk' && !e.portal.walk) continue;
        const barrier = e.portal.door && !this.doorOpen.get(e.portal.door) ? (mode === 'walk' ? 3 : 36) : e.portal.kind === 'window' ? 28 : 0;
        const g = current.g + distance(here, this.nodes.get(e.to).position) + barrier;
        if (g < (costs.get(e.to) ?? Infinity)) {
          costs.set(e.to, g);
          from.set(e.to, { id: current.id, portal: e.portal });
          open.push({ id: e.to, g, score: g + h(e.to), order: order++ });
        }
      }
    }
    return null;
  }
  neighbours(id) {
    return (this.edges.get(id) ?? []).filter((e) => e.portal.walk).map((e) => e.to);
  }
}
