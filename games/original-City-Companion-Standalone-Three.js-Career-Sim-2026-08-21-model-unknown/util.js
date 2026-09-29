// Small helpers shared by the world, the UI and the simulation.

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const lerp = (a, b, t) => a + (b - a) * t;
export const pick = (list) => list[Math.floor(Math.random() * list.length)];
export const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
export const chance = (p) => Math.random() < p;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Fisher-Yates shuffle into a new array (the old sort-by-random was biased). */
export function shuffled(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

let idCounter = 0;
export const uid = (prefix = 'id') =>
  `${prefix}-${Date.now().toString(36)}-${(idCounter += 1).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// One formatter for the whole game (the original built a new Intl.NumberFormat on every call).
const moneyFormat = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
export const money = (value) => moneyFormat.format(Math.round(value));

/** 0..1439 minutes → "HH:MM". */
export function clockLabel(minutes) {
  const m = ((Math.floor(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Absolute minute count since the start of Day 1. */
export const absMinute = (day, minute) => (day - 1) * 1440 + minute;
export const dayTime = (day, minute) => `Day ${day}, ${clockLabel(minute)}`;

export const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

export const titleCase = (value) =>
  String(value)
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

export const groundDistance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/** Deterministic random numbers from a string seed (FNV-1a + mulberry-style mixing). */
export function seededRandom(seed) {
  let h = 2166136261;
  for (const c of seed) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 1831565813;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** XP needed to go from `level` to the next one. */
export const xpForLevel = (level) => 70 + level * 45;

export function riskLabel(risk) {
  if (risk < 34) return { label: 'Low', className: 'risk-low' };
  if (risk < 62) return { label: 'Moderate', className: 'risk-medium' };
  return { label: 'High', className: 'risk-high' };
}

/** "in 2h 10m", "15m late", "3h overdue"… from absolute minutes. */
export function relativeTime(target, now) {
  const diff = Math.round(target - now);
  if (diff < -60) return `${Math.abs(Math.round(diff / 60))}h overdue`;
  if (diff < 0) return `${Math.abs(diff)}m late`;
  if (diff < 60) return `in ${diff}m`;
  if (diff < 1440) return `in ${Math.floor(diff / 60)}h ${diff % 60}m`;
  return `in ${Math.floor(diff / 1440)}d ${Math.floor((diff % 1440) / 60)}h`;
}

export function hoursLabel(minutes) {
  return `${Math.round((minutes / 60) * 10) / 10}h`;
}

export function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function storageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function storageSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function storageRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
}
