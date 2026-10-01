// Shared helpers and defaults. Pure: no browser, renderer or physics dependencies.

export const other = (t) => (t === 0 ? 1 : 0);
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/** Small deterministic PRNG (mulberry32), so rosters and the stadium are the same every visit. */
export class Random {
  constructor(seed = 721854) {
    this.seed = seed;
  }
  next() {
    this.seed = (this.seed + 0x6d2b79f5) | 0;
    let t = Math.imul(this.seed ^ (this.seed >>> 15), 1 | this.seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) {
    return a + (b - a) * this.next();
  }
  int(a, b) {
    return Math.floor(this.range(a, b + 1));
  }
}

export const DEFAULT_SETTINGS = {
  team: 0,
  quarterSeconds: 180,
  difficulty: 'pro',
  postseason: false,
  sound: true,
  reducedMotion: false,
  camera: 'broadcast',
  // 'screen': up on the stick is up the screen for every player; 'team': up is toward the end zone your side attacks.
  controls: 'screen',
};

export const emptyInput = () => ({
  x: 0,
  z: 0,
  turbo: false,
  action: false,
  jump: false,
  pass: -1,
  switch: false,
  snap: false,
  lateral: false,
  throwaway: false,
  timeout: false,
  pause: false,
});
