export class EventBus {
  listeners = new Map();
  on(e, t) {
    let n = this.listeners.get(e) ?? new Set();
    n.add(t);
    this.listeners.set(e, n);
    return () => n.delete(t);
  }
  emit(e, t) {
    let n = this.listeners.get(e);
    if (n) {
      for (let i of n) {
        i(t);
      }
    }
  }
  clear() {
    this.listeners.clear();
  }
}

const TAU = Math.PI * 2;

export function clamp(s, e, t) {
  return Math.max(e, Math.min(t, s));
}

export function lerp(s, e, t) {
  return s + (e - s) * t;
}

function distanceSq2D(s, e) {
  let t = s.x - e.x;
  let n = s.z - e.z;
  return t * t + n * n;
}

export function distance2D(s, e) {
  return Math.sqrt(distanceSq2D(s, e));
}

export function normalize2D(s, e) {
  let t = Math.hypot(s, e);
  if (t < 0.000001) {
    return {
      x: 0,
      z: 0,
    };
  } else {
    return {
      x: s / t,
      z: e / t,
    };
  }
}

export function directionFromAngle(s) {
  return {
    x: Math.sin(s),
    z: Math.cos(s),
  };
}

export function angleOf(s, e) {
  return Math.atan2(s, e);
}

export function angleDelta(s, e) {
  let t = (e - s + Math.PI) % TAU;
  if (t < 0) {
    t += TAU;
  }
  return t - Math.PI;
}

export function formatCompact(s) {
  if (Math.abs(s) < 1000) {
    return Math.round(s).toString();
  } else {
    return `${(s / 1000).toFixed(s >= 10000 ? 0 : 1)}k`;
  }
}

export function distanceToSegment(s, e, t) {
  let n = t.x - e.x;
  let i = t.z - e.z;
  let r = n * n + i * i;
  if (r === 0) {
    return distance2D(s, e);
  }
  let a = clamp(((s.x - e.x) * n + (s.z - e.z) * i) / r, 0, 1);
  let o = {
    x: e.x + n * a,
    z: e.z + i * a,
  };
  return distance2D(s, o);
}

export function hashString(s) {
  let e = 2166136261;
  for (let t = 0; t < s.length; t += 1) {
    e ^= s.charCodeAt(t);
    e = Math.imul(e, 16777619);
  }
  e += e << 13;
  e ^= e >>> 7;
  e += e << 3;
  e ^= e >>> 17;
  e += e << 5;
  return e >>> 0;
}

export function hashInts(...s) {
  let e = 2654435769;
  for (let t of s) {
    let n = t | 0;
    n = Math.imul(n ^ (n >>> 16), 2146121005);
    n = Math.imul(n ^ (n >>> 15), 2221713035);
    n ^= n >>> 16;
    e ^= n + 2654435769 + (e << 6) + (e >>> 2);
  }
  return e >>> 0;
}

export function deriveSeed(s, ...e) {
  let t = s >>> 0;
  for (let n of e) {
    t = hashInts(t, typeof n == "string" ? hashString(n) : n);
  }
  return t >>> 0;
}

export class Rng {
  state;
  constructor(e) {
    this.state = typeof e == "string" ? hashString(e) : e >>> 0;
    if (this.state === 0) {
      this.state = 1831565813;
    }
  }
  next() {
    let e = (this.state += 1831565813);
    e = Math.imul(e ^ (e >>> 15), e | 1);
    e ^= e + Math.imul(e ^ (e >>> 7), e | 61);
    return ((e ^ (e >>> 14)) >>> 0) / 4294967296;
  }
  int(e, t) {
    return Math.floor(this.next() * (t - e + 1)) + e;
  }
  range(e, t) {
    return e + (t - e) * this.next();
  }
  chance(e) {
    return this.next() < e;
  }
  pick(e) {
    if (e.length === 0) {
      throw new Error("Cannot pick from an empty list");
    }
    return e[this.int(0, e.length - 1)];
  }
  weighted(e) {
    if (e.length === 0) {
      throw new Error("Cannot pick from an empty weighted list");
    }
    let t = e.reduce((i, r) => i + Math.max(0, r.weight), 0);
    if (t <= 0) {
      return e[0].value;
    }
    let n = this.range(0, t);
    for (let i of e) {
      n -= Math.max(0, i.weight);
      if (n <= 0) {
        return i.value;
      }
    }
    return e[e.length - 1].value;
  }
  shuffle(e) {
    let t = [...e];
    for (let n = t.length - 1; n > 0; n -= 1) {
      let i = this.int(0, n);
      [t[n], t[i]] = [t[i], t[n]];
    }
    return t;
  }
  fork(...e) {
    return new Rng(deriveSeed(this.state, ...e));
  }
}

function smoothstep01(s) {
  return s * s * (3 - s * 2);
}

function latticeValue(s, e, t) {
  return hashInts(s, e, t) / 4294967295;
}

function valueNoise(s, e, t, n = 1) {
  let i = e / n;
  let r = t / n;
  let a = Math.floor(i);
  let o = Math.floor(r);
  let l = smoothstep01(i - a);
  let c = smoothstep01(r - o);
  let h = latticeValue(s, a, o);
  let u = latticeValue(s, a + 1, o);
  let d = latticeValue(s, a, o + 1);
  let p = latticeValue(s, a + 1, o + 1);
  let x = h + (u - h) * l;
  let y = d + (p - d) * l;
  return x + (y - x) * c;
}

// The per-octave seeds of each noise layer never change, so they are hashed once.
const octaveSeeds = new Map();
function octaveSeed(s, c) {
  let list = octaveSeeds.get(s);
  if (!list) {
    if (octaveSeeds.size > 256) octaveSeeds.clear();
    list = [];
    octaveSeeds.set(s, list);
  }
  return (list[c] ??= deriveSeed(s, c));
}

export function fbm(s, e, t, n = 64, i = 4) {
  let r = 0;
  let a = 0.5;
  let o = 1;
  let l = 0;
  for (let c = 0; c < i; c += 1) {
    r += valueNoise(octaveSeed(s, c), e * o, t * o, n) * a;
    l += a;
    a *= 0.5;
    o *= 2;
  }
  return r / l;
}

export function randomSeedText() {
  let s = ["Ash", "Moon", "Iron", "Wild", "Storm", "Star", "Hollow", "Ember", "Frost", "Thorn"];
  let e = ["fall", "reach", "vale", "spire", "march", "wake", "song", "ward", "bloom", "rift"];
  let t = (Date.now() ^ Math.floor(Math.random() * 4294967295)) >>> 0;
  let n = new Rng(t);
  return `${n.pick(s)}${n.pick(e)}-${n.int(100, 999)}`;
}
