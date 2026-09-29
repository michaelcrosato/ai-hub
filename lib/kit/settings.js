/**
 * settings.js — the graphics and control settings every 3D game shares.
 *
 * One set per device, kept in localStorage, so a player who turns the quality
 * down on their phone gets that choice in every game on the wall. Nothing
 * here touches the DOM, which keeps the tier logic testable under node.
 */

export const STORAGE_KEY = 'kit.settings.v1';
export const DEVICE_KEY = 'kit.device.v1';

/**
 * Quality tiers scale cost, never the art style: a game looks like itself on
 * every tier, just sharper or softer. Anything that defines a game's look
 * (bloom on a neon game, fog, outlines) stays on and gets cheaper instead.
 *
 * pixelRatio   upper bound on the drawing-buffer ratio (the screen's own
 *              devicePixelRatio is the other bound)
 * msaa         multisampled anti-aliasing on the main pass
 * shadowMapSize  resolution for the key light's shadow map
 * post         'lite' = one cheap pass at reduced resolution, 'full' = the
 *              game's whole chain at full resolution
 * detail       multiplier for counts a game controls (particles, crowd size,
 *              foliage, instanced props). 1 is the game's own baseline.
 * drawDistance multiplier for far planes / fog distance / LOD ranges.
 */
export const TIERS = Object.freeze({
  low: Object.freeze({ name: 'low', pixelRatio: 1, msaa: false, shadowMapSize: 512, post: 'lite', detail: 0.5, drawDistance: 0.7 }),
  medium: Object.freeze({ name: 'medium', pixelRatio: 1.5, msaa: false, shadowMapSize: 1024, post: 'lite', detail: 0.75, drawDistance: 0.85 }),
  high: Object.freeze({ name: 'high', pixelRatio: 2, msaa: true, shadowMapSize: 2048, post: 'full', detail: 1, drawDistance: 1 }),
  ultra: Object.freeze({ name: 'ultra', pixelRatio: 3, msaa: true, shadowMapSize: 4096, post: 'full', detail: 1.25, drawDistance: 1.25 }),
});

export const TIER_NAMES = Object.keys(TIERS);

export const DEFAULTS = Object.freeze({
  quality: 'auto', // 'auto' | 'low' | 'medium' | 'high' | 'ultra'
  resolution: 'auto', // 'auto' (dynamic) | number 0.5..1
  fpsCap: 0, // 0 = display rate, else 30 / 60
  backend: 'auto', // 'auto' | 'webgpu' | 'webgl2'
  advanced: false, // opt-in WebGPU device features and heavier effects
  showFps: false,
  touch: 'auto', // 'auto' | 'on' | 'off'
  touchScale: 1, // 0.8..1.3
  invertY: false,
  lookSensitivity: 1, // 0.25..3
  vibration: true,
});

const ENUMS = {
  quality: ['auto', ...TIER_NAMES],
  backend: ['auto', 'webgpu', 'webgl2'],
  touch: ['auto', 'on', 'off'],
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Coerce anything read from storage (or a URL) into a valid settings object. */
export function sanitize(raw) {
  const out = { ...DEFAULTS };
  if (!raw || typeof raw !== 'object') return out;
  for (const [key, allowed] of Object.entries(ENUMS)) {
    if (allowed.includes(raw[key])) out[key] = raw[key];
  }
  if (raw.resolution === 'auto') out.resolution = 'auto';
  else if (Number.isFinite(+raw.resolution) && raw.resolution !== null && raw.resolution !== '') out.resolution = clamp(+raw.resolution, 0.5, 1);
  if ([0, 30, 60].includes(+raw.fpsCap)) out.fpsCap = +raw.fpsCap;
  for (const key of ['advanced', 'showFps', 'invertY', 'vibration']) {
    if (typeof raw[key] === 'boolean') out[key] = raw[key];
  }
  if (Number.isFinite(+raw.touchScale) && raw.touchScale !== null) out.touchScale = clamp(+raw.touchScale, 0.8, 1.3);
  if (Number.isFinite(+raw.lookSensitivity) && raw.lookSensitivity !== null) out.lookSensitivity = clamp(+raw.lookSensitivity, 0.25, 3);
  return out;
}

/**
 * The tier 'auto' resolves to. Phones and tablets start on medium (a Galaxy
 * S25-class device holds 60 fps there with room for the game); desktops start
 * on high (tuned for an RTX 3060-class card). Ultra is only ever chosen by hand.
 */
export function autoTier({ coarsePointer = false, screenMin = 1080, memory = 8, cores = 8 } = {}) {
  const handheld = coarsePointer && screenMin < 1100;
  if (handheld) return memory && memory < 4 ? 'low' : 'medium';
  if ((memory && memory < 4) || (cores && cores < 4)) return 'medium';
  return 'high';
}

/** Resolve the tier object for a settings value plus the device it runs on. */
export function resolveTier(quality, device = {}) {
  const name = TIER_NAMES.includes(quality) ? quality : autoTier(device);
  return TIERS[name];
}

/**
 * Drawing-buffer pixel ratio: the smaller of the screen's ratio and the tier's
 * cap, times the resolution scale (fixed, or the dynamic one in 'auto').
 */
export function pixelRatioFor(tier, devicePixelRatio = 1, scale = 1) {
  const base = Math.min(devicePixelRatio || 1, tier.pixelRatio);
  return Math.max(0.5, base * clamp(scale, 0.25, 1));
}

/**
 * Which backend to ask for. 'auto' means WebGPU when the browser has it,
 * unless WebGPU already failed on this device (a lost or crashing device is
 * remembered, so the next load goes straight to WebGL2).
 */
export function chooseBackend(setting, { hasWebGPU = false, webgpuFailed = false } = {}) {
  if (setting === 'webgl2') return 'webgl2';
  if (!hasWebGPU) return 'webgl2';
  if (setting === 'webgpu') return 'webgpu';
  return webgpuFailed ? 'webgl2' : 'webgpu';
}

/**
 * URL overrides for testing both paths without touching storage:
 * ?kit-backend=webgl2  ?kit-quality=low  ?kit-fps=1  ?kit-advanced=1
 */
export function urlOverrides(search = '') {
  const q = new URLSearchParams(search);
  const out = {};
  if (q.has('kit-backend')) out.backend = q.get('kit-backend');
  if (q.has('kit-quality')) out.quality = q.get('kit-quality');
  if (q.has('kit-fps')) out.showFps = q.get('kit-fps') !== '0';
  if (q.has('kit-advanced')) out.advanced = q.get('kit-advanced') !== '0';
  if (q.has('kit-touch')) out.touch = q.get('kit-touch');
  return out;
}

function safeStorage() {
  try {
    const s = globalThis.localStorage;
    const probe = '__kit_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

/**
 * A small observable store. Changes persist immediately; subscribers get
 * (settings, changedKeys). URL overrides apply for this page load only.
 */
export function createSettings({ search = globalThis.location?.search || '' } = {}) {
  const storage = safeStorage();
  let saved = {};
  try {
    saved = JSON.parse(storage?.getItem(STORAGE_KEY) || '{}');
  } catch {
    saved = {};
  }
  let persisted = sanitize(saved);
  const overrides = urlOverrides(search);
  let current = sanitize({ ...persisted, ...overrides });
  const listeners = new Set();

  const api = {
    get: () => current,
    set(patch) {
      const next = sanitize({ ...current, ...patch });
      const changed = Object.keys(next).filter((k) => next[k] !== current[k]);
      if (!changed.length) return current;
      current = next;
      persisted = sanitize({ ...persisted, ...Object.fromEntries(changed.map((k) => [k, next[k]])) });
      try {
        storage?.setItem(STORAGE_KEY, JSON.stringify(persisted));
      } catch {
        /* private mode: settings last for this page only */
      }
      for (const fn of listeners) fn(current, changed);
      return current;
    },
    reset() {
      return api.set({ ...DEFAULTS });
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    overridden: (key) => key in overrides,
  };
  return api;
}

/** A WebGPU failure keeps 'auto' on WebGL2 for three days, then it tries again. */
export const FAILURE_MEMORY_MS = 3 * 24 * 3600 * 1000;
export const webgpuFailedRecently = (memory, now = Date.now()) =>
  !!memory?.webgpuFailed && now - memory.webgpuFailed < FAILURE_MEMORY_MS;

/** Per-device memory that is not a setting: did WebGPU fail here before? */
export const deviceMemory = {
  read() {
    try {
      return JSON.parse(safeStorage()?.getItem(DEVICE_KEY) || '{}') || {};
    } catch {
      return {};
    }
  },
  write(patch) {
    try {
      const s = safeStorage();
      s?.setItem(DEVICE_KEY, JSON.stringify({ ...deviceMemory.read(), ...patch }));
    } catch {
      /* nothing to remember with */
    }
  },
};
