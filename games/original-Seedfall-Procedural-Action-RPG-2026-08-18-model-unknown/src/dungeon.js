import * as THREE from "three/webgpu";
import { DUNGEON_MODIFIERS, DUNGEON_NOUNS, ENEMY_TYPES } from "./data.js";
import { Rng, deriveSeed } from "./util.js";
import { disposeTree, mergeStatic } from "./world.js";

function roomBounds(s, e = 0) {
  return {
    minX: s.x - s.width / 2 - e,
    maxX: s.x + s.width / 2 + e,
    minZ: s.z - s.height / 2 - e,
    maxZ: s.z + s.height / 2 + e,
  };
}

function boundsOverlap(s, e) {
  return !(s.maxX < e.minX) && !(s.minX > e.maxX) && !(s.maxZ < e.minZ) && !(s.minZ > e.maxZ);
}

export class DungeonGenerator {
  generate(e) {
    let t = deriveSeed(e.seed, "dungeon-layout");
    let n = new Rng(t);
    let i = Math.max(1, e.danger);
    let r = Math.min(9, 5 + Math.floor(i / 3) + n.int(0, 2));
    let a = [];
    let o = [];
    let l = {
      id: `${e.id}:room:0`,
      x: 0,
      z: 0,
      width: 11,
      height: 9,
      kind: "entry",
    };
    a.push(l);
    let c = [
      {
        x: 1,
        z: 0,
      },
      {
        x: -1,
        z: 0,
      },
      {
        x: 0,
        z: 1,
      },
      {
        x: 0,
        z: -1,
      },
    ];
    let h = l;
    let u = n.pick(c);
    for (let p = 1; p < r; p += 1) {
      let x = p === r - 1;
      let y = x ? n.range(15, 18) : n.range(9, 14);
      let m = x ? n.range(14, 18) : n.range(8, 13);
      let f;
      for (let S = 0; S < 20 && !f; S += 1) {
        if (S > 0 && n.chance(0.62)) {
          u = n.pick(c);
        }
        let A = n.range(7, 11);
        let _ = {
          id: `${e.id}:room:${p}`,
          x: h.x + u.x * (h.width / 2 + y / 2 + A),
          z: h.z + u.z * (h.height / 2 + m / 2 + A),
          width: y,
          height: m,
          kind: x ? "boss" : p === r - 2 && n.chance(0.55) ? "treasure" : n.chance(0.18) ? "utility" : "combat",
        };
        if (a.every((w) => !boundsOverlap(roomBounds(w, 4), roomBounds(_)))) {
          f = _;
        }
      }
      if (!f) {
        u = {
          x: 1,
          z: 0,
        };
        f = {
          id: `${e.id}:room:${p}`,
          x: Math.max(...a.map((S) => S.x + S.width / 2)) + y / 2 + 9,
          z: h.z,
          width: y,
          height: m,
          kind: x ? "boss" : "combat",
        };
      }
      a.push(f);
      o.push({
        from: {
          x: h.x,
          z: h.z,
        },
        to: {
          x: f.x,
          z: f.z,
        },
      });
      h = f;
    }
    if (!a.some((p) => p.kind === "treasure")) {
      let p = [...a].reverse().find((x) => x.kind === "combat");
      if (p) {
        p.kind = "treasure";
      }
    }
    let d = e.modifier ?? n.pick(DUNGEON_MODIFIERS);
    return {
      id: e.id,
      seed: t,
      name: e.name || `${d} ${n.pick(DUNGEON_NOUNS[e.theme ?? "cave"])}`,
      theme: e.theme ?? "cave",
      modifier: d,
      level: i,
      rooms: a,
      corridors: o,
      entry: {
        x: l.x,
        z: l.z,
      },
      exit: {
        x: l.x,
        z: l.z - l.height / 2 + 1.8,
      },
      bossRoomId: a[a.length - 1].id,
    };
  }
  generateEnemySpawns(e, t) {
    let n = new Rng(deriveSeed(e.seed, "dungeon-enemies"));
    let i = [];
    for (let r of e.rooms) {
      if (r.kind === "entry" || r.kind === "utility" || r.kind === "treasure") {
        continue;
      }
      if (r.kind === "boss") {
        let c =
          e.theme === "arcane" ? "boss-rift-titan" : e.theme === "crypt" ? "boss-grave-matron" : "boss-stone-warden";
        i.push({
          id: `${e.id}:boss`,
          x: r.x,
          z: r.z,
          archetypeId: c,
          level: e.level + 1,
          elite: true,
          modifiers: [e.modifier],
          guardingPoiId: e.id,
        });
        continue;
      }
      let a = n.int(2, 3) + Math.floor(e.level / 5);
      let o = t.filter((c) => ENEMY_TYPES[c]);
      let l = o.length > 0 ? o : ["briar-wolf"];
      for (let c = 0; c < a; c += 1) {
        let h = n.pick(l);
        i.push({
          id: `${r.id}:enemy:${c}`,
          x: r.x + n.range(-r.width * 0.32, r.width * 0.32),
          z: r.z + n.range(-r.height * 0.32, r.height * 0.32),
          archetypeId: h,
          level: e.level + n.int(0, 1),
          elite: n.chance(0.08 + e.level * 0.01),
          modifiers: n.chance(0.12) ? [n.pick(["Frenzied", "Armored", "Volatile", "Chilling"])] : [],
          guardingPoiId: e.id,
        });
      }
    }
    return i;
  }
  isWalkable(e, t, n = 0.55) {
    for (let i of e.rooms) {
      if (
        t.x >= i.x - i.width / 2 + n &&
        t.x <= i.x + i.width / 2 - n &&
        t.z >= i.z - i.height / 2 + n &&
        t.z <= i.z + i.height / 2 - n
      ) {
        return true;
      }
    }
    for (let i of e.corridors) {
      let r = 2.2 - n;
      let a = Math.min(i.from.x, i.to.x) - r;
      let o = Math.max(i.from.x, i.to.x) + r;
      let l = Math.min(i.from.z, i.to.z) - r;
      let c = Math.max(i.from.z, i.to.z) + r;
      if (t.x >= a && t.x <= o && t.z >= l && t.z <= c) {
        return true;
      }
    }
    return false;
  }
}

const DUNGEON_PALETTES = {
  cave: {
    floor: 0x484944,
    wall: 0x66665f,
    accent: 0xa6a378,
  },
  crypt: {
    floor: 0x34383b,
    wall: 0x666b70,
    accent: 0x8fb0a2,
  },
  mine: {
    floor: 0x4a4036,
    wall: 0x62584c,
    accent: 0xd49d52,
  },
  ruins: {
    floor: 0x45494b,
    wall: 0x77786f,
    accent: 0x8fac8d,
  },
  arcane: {
    floor: 0x302b3c,
    wall: 0x51455f,
    accent: 0xc06cdb,
  },
};

export class Dungeon {
  constructor(e) {
    this.data = e;
    this.group.name = `dungeon:${e.id}`;
    this.build();
  }
  data;
  group = new THREE.Group();
  generator = new DungeonGenerator();
  materials = [];
  exitRing = null;
  isWalkable(e, t = 0.55) {
    return this.generator.isWalkable(this.data, e, t);
  }
  getRoomAt(e) {
    return this.data.rooms.find((t) => Math.abs(e.x - t.x) <= t.width / 2 && Math.abs(e.z - t.z) <= t.height / 2);
  }
  dispose() {
    disposeTree(this.group);
    for (const m of this.materials) m.dispose();
    this.group.removeFromParent();
  }
  build() {
    let e = DUNGEON_PALETTES[this.data.theme] ?? DUNGEON_PALETTES.cave;
    // One material per surface for the whole dungeon (the original cloned one per mesh).
    let t = new THREE.MeshLambertMaterial({ color: e.floor, flatShading: true });
    let n = new THREE.MeshLambertMaterial({ color: e.wall, flatShading: true });
    let i = new THREE.MeshBasicMaterial({ color: e.accent, transparent: true, opacity: 0.78 });
    this.materials = [t, n, i];
    for (const m of this.materials) m.userData.shared = true;
    for (let o of this.data.corridors) {
      let l = o.to.x - o.from.x;
      let c = o.to.z - o.from.z;
      let h = Math.hypot(l, c) + 3.4;
      let u = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.18, h), t);
      u.position.set((o.from.x + o.to.x) / 2, -0.08, (o.from.z + o.to.z) / 2);
      u.rotation.y = Math.atan2(l, c);
      this.group.add(u);
    }
    for (let o of this.data.rooms) {
      let l = new THREE.Mesh(new THREE.BoxGeometry(o.width, 0.22, o.height), t);
      l.position.set(o.x, -0.1, o.z);
      this.group.add(l);
      this.addBoundary(o, n);
      this.addRoomDetails(o, i, n);
    }
    // Floors, walls and trim become one mesh each; the exit ring stays animated.
    mergeStatic(this.group);
    this.exitRing = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.18, 7, 24), i);
    this.exitRing.rotation.x = Math.PI / 2;
    this.exitRing.position.set(this.data.exit.x, 0.18, this.data.exit.z);
    this.exitRing.name = "dungeon-exit";
    this.group.add(this.exitRing);
  }
  /** The accent light over the entry hall (the scene keeps one light, so nothing recompiles). */
  placeLight(light) {
    let e = DUNGEON_PALETTES[this.data.theme] ?? DUNGEON_PALETTES.cave;
    light.color.setHex(e.accent);
    light.intensity = 11;
    light.distance = 90;
    light.decay = 2;
    light.position.set(this.data.entry.x, 8, this.data.entry.z);
  }
  update(dt, t) {
    if (!this.exitRing) return;
    this.exitRing.rotation.z += dt * 0.8;
    const s = 1 + Math.sin(t * 2.6) * 0.05;
    this.exitRing.scale.set(s, s, 1);
  }
  addBoundary(e, t) {
    let n = e.kind === "boss" ? 1.1 : 0.72;
    let i = 0.35;
    let r = 4.8;
    let a = new Set();
    for (let h of this.data.corridors) {
      let u;
      if (Math.abs(h.from.x - e.x) < 0.001 && Math.abs(h.from.z - e.z) < 0.001) {
        u = h.to;
      }
      if (Math.abs(h.to.x - e.x) < 0.001 && Math.abs(h.to.z - e.z) < 0.001) {
        u = h.from;
      }
      if (!u) {
        continue;
      }
      let d = u.x - e.x;
      let p = u.z - e.z;
      if (Math.abs(d) > Math.abs(p)) {
        a.add(d > 0 ? "east" : "west");
      } else {
        a.add(p > 0 ? "south" : "north");
      }
    }
    let o = (h, u, d, p) => {
      if (h <= 0.05 || u <= 0.05) {
        return;
      }
      let x = new THREE.Mesh(new THREE.BoxGeometry(h, n, u), t);
      x.position.set(d, n / 2 - 0.02, p);
      this.group.add(x);
    };
    let l = (h, u) => {
      if (!u) {
        o(e.width, i, e.x, h);
        return;
      }
      let d = Math.max(0, (e.width - r) / 2);
      let p = r / 2 + d / 2;
      o(d, i, e.x - p, h);
      o(d, i, e.x + p, h);
    };
    let c = (h, u) => {
      if (!u) {
        o(i, e.height, h, e.z);
        return;
      }
      let d = Math.max(0, (e.height - r) / 2);
      let p = r / 2 + d / 2;
      o(i, d, h, e.z - p);
      o(i, d, h, e.z + p);
    };
    l(e.z - e.height / 2, a.has("north"));
    l(e.z + e.height / 2, a.has("south"));
    c(e.x - e.width / 2, a.has("west"));
    c(e.x + e.width / 2, a.has("east"));
  }
  addRoomDetails(e, t, n) {
    if (e.kind === "boss") {
      let i = new THREE.Mesh(
        new THREE.RingGeometry(Math.min(e.width, e.height) * 0.22, Math.min(e.width, e.height) * 0.35, 12),
        t,
      );
      i.rotation.x = -Math.PI / 2;
      i.position.set(e.x, 0.05, e.z);
      this.group.add(i);
    }
    if (e.kind === "treasure") {
      let i = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.5, 0.5, 8), n);
      i.position.set(e.x, 0.22, e.z);
      this.group.add(i);
      let r = new THREE.Mesh(new THREE.OctahedronGeometry(0.65, 0), t);
      r.position.set(e.x, 1.1, e.z);
      this.group.add(r);
    }
    if (e.kind === "combat" || e.kind === "utility") {
      for (let i = 0; i < 3; i += 1) {
        let r = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 1.4 + i * 0.18, 6), n);
        let a = (i / 3) * Math.PI * 2 + e.x * 0.1;
        r.position.set(
          e.x + Math.sin(a) * Math.min(3, e.width * 0.28),
          0.7,
          e.z + Math.cos(a) * Math.min(3, e.height * 0.28),
        );
        this.group.add(r);
      }
    }
  }
}
