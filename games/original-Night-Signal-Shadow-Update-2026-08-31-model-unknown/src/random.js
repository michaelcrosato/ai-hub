/** Stable seed hashing. Do not use Math.random for world data. */
export function hashSeed(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return hash >>> 0;
}

export class Random {
  constructor(seed) {
    this.state = typeof seed === 'string' ? hashSeed(seed) : seed >>> 0;
  }
  next() {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(min, max) {
    return min + Math.floor(this.next() * (max - min + 1));
  }
  range(min, max) {
    return min + (max - min) * this.next();
  }
  chance(p) {
    return this.next() < p;
  }
  pick(values) {
    if (!values.length) throw new Error('Cannot select from an empty list.');
    return values[this.int(0, values.length - 1)];
  }
  shuffle(values) {
    const a = [...values];
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}
