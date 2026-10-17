// Plain checkpoint data only. No DOM/storage access occurs while this module loads.
import { MISSIONS } from './missions.js';

export const SAVE_KEY = 'signal-debt-save-v1';
export const VEHICLE_IDS = Object.freeze(['loaner', 'cormorant', 'freighter', 'marina', 'market']);
const vehicleIds = new Set(VEHICLE_IDS);
const dangerousKeys = new Set(['__proto__', 'prototype', 'constructor']);
const own = (object, key) => {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
};
const number = (value, low = 0, high = Number.MAX_SAFE_INTEGER) => typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high;
const integer = (value, low, high) => number(value, low, high) && Number.isInteger(value);
const boolean = value => typeof value === 'boolean';
const record = value => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return Reflect.ownKeys(value).every(key => typeof key === 'string' && !dangerousKeys.has(key) && Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value'));
};
// Array.every skips holes; explicit own-property checks prevent sparse data passing validation.
const denseArray = (value, max, exact) => {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > max || (exact !== undefined && value.length !== exact)) return false;
  if (Reflect.ownKeys(value).length !== value.length + 1) return false;
  for (let i = 0; i < value.length; i++) if (!Object.hasOwn(value, i) || !Object.hasOwn(Object.getOwnPropertyDescriptor(value, i), 'value')) return false;
  return true;
};
const coordinate = (value, axis) => number(value, axis === 'y' ? -5 : -265, axis === 'y' ? 80 : 265);
const position = value => denseArray(value, 3, 3) && coordinate(own(value, '0'), 'x') && coordinate(own(value, '1'), 'y') && coordinate(own(value, '2'), 'z');
const point = value => record(value) && ['x', 'y', 'z'].every(axis => coordinate(own(value, axis), axis));

function storyData(raw, playTime) {
  if (!record(raw)) return null;
  const mission = own(raw, 'mission'), stage = own(raw, 'stage');
  if (!integer(mission, 0, MISSIONS.length - 1)) return null;
  const stageCount = MISSIONS[mission].stages.length;
  if (!integer(stage, 0, stageCount)) return null;
  const active = own(raw, 'active'), finished = own(raw, 'finished'), completed = own(raw, 'completed');
  if (!boolean(active) || !boolean(finished) || !integer(completed, 0, MISSIONS.length)) return null;
  const terminal = stage === stageCount;
  // A completed job is a valid save. It must resume as free roam / the next briefing,
  // never call enterStage on a missing objective or pay the completed job again.
  if (terminal && (active || completed < mission + 1)) return null;
  if (finished !== (mission === MISSIONS.length - 1 && terminal)) return null;
  if (finished && (active || completed !== MISSIONS.length)) return null;
  const progress = own(raw, 'progress'), stageTime = own(raw, 'stageTime'), wave = own(raw, 'wave'), approach = own(raw, 'approach');
  if (!number(progress) || !number(stageTime) || !integer(wave, 0, Number.MAX_SAFE_INTEGER) || !['jam', 'diversion'].includes(approach)) return null;
  const rawHistory = own(raw, 'history');
  if (!denseArray(rawHistory, 1000)) return null;
  const history = [];
  for (let i = 0; i < rawHistory.length; i++) {
    const item = own(rawHistory, String(i));
    if (!record(item)) return null;
    const m = own(item, 'mission'), s = own(item, 'stage'), label = own(item, 'label'), elapsed = own(item, 'elapsed');
    if (!integer(m, 0, MISSIONS.length - 1) || !integer(s, 0, MISSIONS[m].stages.length - 1) || typeof label !== 'string' || !label.length || label.length > 512 || !number(elapsed, 0, playTime)) return null;
    history.push({ mission: m, stage: s, label, elapsed });
  }
  return { mission, stage, active, finished, progress, stageTime, wave, completed, approach, history };
}

/** Return a fresh, validated checkpoint with only supported fields; malformed data is null. */
export function validateSave(raw) {
  try {
    if (!record(raw) || own(raw, 'version') !== 1) return null;
    const health = own(raw, 'health'), ammo = own(raw, 'ammo'), reserve = own(raw, 'reserve'), cash = own(raw, 'cash'), playTime = own(raw, 'playTime');
    if (!number(health, 0, 100) || !integer(ammo, 0, 12) || !integer(reserve, 0, Number.MAX_SAFE_INTEGER) || !integer(cash, 0, Number.MAX_SAFE_INTEGER) || !number(playTime)) return null;
    const story = storyData(own(raw, 'story'), playTime);
    if (!story) return null;
    const player = own(raw, 'player'), ride = own(raw, 'ride'), rawRides = own(raw, 'rides');
    if (!position(player) || (ride !== null && !vehicleIds.has(ride)) || !denseArray(rawRides, VEHICLE_IDS.length, VEHICLE_IDS.length)) return null;
    const seen = new Set(), rides = [];
    for (let i = 0; i < rawRides.length; i++) {
      const item = own(rawRides, String(i));
      if (!record(item)) return null;
      const id = own(item, 'id'), at = own(item, 'at'), yaw = own(item, 'yaw'), integrity = own(item, 'integrity'), upgraded = own(item, 'upgraded');
      if (!vehicleIds.has(id) || seen.has(id) || !position(at) || !number(yaw, -Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER) || !number(integrity, 0, 100) || !boolean(upgraded)) return null;
      seen.add(id); rides.push({ id, at: [...at], yaw, integrity, upgraded });
    }
    const rawCaches = own(raw, 'cacheTaken');
    if (!denseArray(rawCaches, 6)) return null;
    const cacheTaken = [], cacheIds = new Set();
    for (let i = 0; i < rawCaches.length; i++) { const id = own(rawCaches, String(i)); if (!integer(id, 0, 5) || cacheIds.has(id)) return null; cacheIds.add(id); cacheTaken.push(id); }
    const intercepted = own(raw, 'interceptPosition');
    if (intercepted !== undefined && intercepted !== null && !point(intercepted)) return null;
    const interceptPosition = intercepted == null ? null : { x: own(intercepted, 'x'), y: own(intercepted, 'y'), z: own(intercepted, 'z') };
    return { version: 1, story, health, ammo, reserve, cash, playTime, player: [...player], ride, rides, cacheTaken, interceptPosition };
  } catch { return null; }
}

/** Missing, corrupt, unsupported, or inaccessible browser storage acts like no save. */
export function readSave(storage, key = SAVE_KEY) {
  try {
    const target = storage === undefined ? globalThis.localStorage : storage;
    if (typeof target?.getItem !== 'function') return null;
    const text = target.getItem(key);
    if (typeof text !== 'string' || text.length > 1_000_000) return null;
    return validateSave(JSON.parse(text));
  } catch { return null; }
}

/** Validate before writing, so malformed state cannot overwrite an existing checkpoint. */
export function writeSave(data, storage, key = SAVE_KEY) {
  try {
    const validated = validateSave(data);
    if (!validated) return false;
    const target = storage === undefined ? globalThis.localStorage : storage;
    if (typeof target?.setItem !== 'function') return false;
    target.setItem(key, JSON.stringify(validated));
    return true;
  } catch { return false; }
}
