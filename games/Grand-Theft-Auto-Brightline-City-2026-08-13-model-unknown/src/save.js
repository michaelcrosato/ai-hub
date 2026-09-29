/**
 * save.js — reading, validating and writing Brightline saves and settings.
 * Every value read back from storage is checked against the game's content,
 * so a damaged or outdated save can never break the city. Storage keys are
 * the original game's, so existing saves keep working (the mission clock and
 * mission best times added later simply read as 0 from older saves).
 */
import { CITY, SPARKS, DISTRICTS, VEHICLE_TYPES, INVESTMENTS, ACTIVITIES, MISSIONS, DEFAULT_SETTINGS } from './data.js';

const SAVE_KEY = 'brightline-city-save-v2';
const BACKUP_KEY = 'brightline-city-save-backup-v2';
const LEGACY_KEY = 'brightline-city-save-v1';

function isRecord(i) {
  return typeof i == 'object' && i !== null && !Array.isArray(i);
}
function toNumber(i, e) {
  let t = Number(i);
  return Number.isFinite(t) ? t : e;
}
function clampNumber(i, e, t) {
  return Math.max(e, Math.min(t, i));
}
function stringList(i) {
  return Array.isArray(i) ? i.filter((e) => typeof e == 'string') : [];
}
function knownIds(i, e) {
  return [...new Set(stringList(i).filter((t) => e.has(t)))];
}
function parseJson(i) {
  if (!i) return null;
  try {
    return JSON.parse(i);
  } catch {
    return null;
  }
}
export function sanitizeSave(i) {
  if (!isRecord(i) || (i.version !== 1 && i.version !== 2) || !isRecord(i.player)) return null;
  let e = new Set(MISSIONS.map((te) => te.id)),
    t = new Set(DISTRICTS.map((te) => te.id)),
    r = new Set(ACTIVITIES.map((te) => te.id)),
    s = new Set(
      MISSIONS.flatMap((te) =>
        te.objectives.flatMap((ve) => [ve.grantsItemId, ve.requiresItemId].filter((ye) => !!ye)),
      ),
    ),
    n = new Set(VEHICLE_TYPES.filter((te) => te.price > 0).map((te) => `owned-${te.id}`)),
    a = new Set(INVESTMENTS.filter((te) => te.kind === 'property').map((te) => te.id)),
    o = new Set(['loop-garage-share', ...INVESTMENTS.filter((te) => te.kind === 'business').map((te) => te.id)]),
    l = new Set(SPARKS.map((te) => te.id)),
    c = knownIds(i.ownedVehicles, n);
  stringList(i.ownedVehicles).includes('owned-moxi') && !c.includes('owned-moxi') && c.push('owned-moxi');
  let f = knownIds(i.completedMissions, e),
    u = typeof i.missionId == 'string' && e.has(i.missionId) ? i.missionId : null,
    h = MISSIONS.find((te) => te.id === u),
    d =
      h &&
      typeof i.carriedMissionItem == 'string' &&
      s.has(i.carriedMissionItem) &&
      h.objectives.some((te) => te.grantsItemId === i.carriedMissionItem || te.requiresItemId === i.carriedMissionItem)
        ? i.carriedMissionItem
        : null,
    m = h ? clampNumber(Math.floor(toNumber(i.objectiveIndex, 0)), 0, h.objectives.length - 1) : 0,
    _ = h?.objectives[m],
    p = new Set(_?.points?.map((te) => te.id) ?? []),
    g = knownIds(i.objectiveProgress, p),
    v = _?.kind === 'transportNpc' ? (_.points ?? []).findIndex((te) => !g.includes(te.id)) : -1,
    S = Math.max(0, (_?.points?.length ?? 0) - 1),
    A =
      _?.kind === 'transportNpc'
        ? (_.points ?? []).map((te) => te.id).slice(0, Math.min(v === -1 ? (_.points ?? []).length : v, S))
        : g,
    T = h?.optionalObjectives ?? [],
    C = new Set(T.flatMap((te) => te.targetIds ?? [])),
    I = knownIds(i.missionOptionalProgress, C),
    M = isRecord(i.missionOptionalStates) ? i.missionOptionalStates : {},
    F = {};
  for (let te of T)
    if (te.kind === 'inspectAll') {
      let ve = te.targetIds ?? [];
      F[te.id] = ve.length > 0 && ve.every((ye) => I.includes(ye)) ? 'completed' : 'active';
    } else
      te.kind === 'avoidDetection' ? (F[te.id] = M[te.id] === 'failed' ? 'failed' : 'active') : (F[te.id] = 'active');
  let N =
      _?.kind === 'transportNpc' &&
      typeof i.missionPassengerId == 'string' &&
      i.missionPassengerId === _.requiredActorId
        ? i.missionPassengerId
        : null,
    D = h?.assets?.find(
      (te) => te.kind === 'vehicle' && te.id === (isRecord(i.missionVehicleState) ? i.missionVehicleState.id : ''),
    ),
    w = D?.kind === 'vehicle' ? VEHICLE_TYPES.find((te) => te.id === D.vehicleDefinitionId) : undefined,
    ee =
      D?.kind === 'vehicle' && isRecord(i.missionVehicleState)
        ? {
            id: D.id,
            x: clampNumber(toNumber(i.missionVehicleState.x, D.x), -CITY.width / 2 + 3, CITY.width / 2 - 3),
            z: clampNumber(toNumber(i.missionVehicleState.z, D.z), -CITY.depth / 2 + 3, CITY.depth / 2 - 3),
            yaw: clampNumber(toNumber(i.missionVehicleState.yaw, D.yaw), -Math.PI * 8, Math.PI * 8),
            health: clampNumber(
              toNumber(i.missionVehicleState.health, (w?.durability ?? 90) * (D.healthRatio ?? 1)),
              0,
              w?.durability ?? 250,
            ),
          }
        : null,
    U = ['clear', 'cloudy', 'rain', 'fog'].includes(String(i.weather)) ? i.weather : 'clear',
    j = ['isometric', 'third-person', 'first-person'].includes(String(i.cameraMode)) ? i.cameraMode : 'isometric',
    ue = new Map();
  if (Array.isArray(i.ownedVehicleStates))
    for (let te of i.ownedVehicleStates) {
      if (!isRecord(te) || typeof te.id != 'string' || !n.has(te.id) || !c.includes(te.id)) continue;
      let ve = VEHICLE_TYPES.find((ye) => `owned-${ye.id}` === te.id);
      ue.set(te.id, {
        id: te.id,
        x: clampNumber(toNumber(te.x, -67), -CITY.width / 2 + 3, CITY.width / 2 - 3),
        z: clampNumber(toNumber(te.z, 64), -CITY.depth / 2 + 3, CITY.depth / 2 - 3),
        yaw: clampNumber(toNumber(te.yaw, Math.PI / 2), -Math.PI * 8, Math.PI * 8),
        health: clampNumber(toNumber(te.health, ve?.durability ?? 90), 0, ve?.durability ?? 250),
      });
    }
  let ie = [...ue.values()],
    Q = {};
  if (isRecord(i.businessLevels))
    for (let te of INVESTMENTS.filter((ve) => ve.kind === 'business'))
      Q[te.id] = clampNumber(Math.floor(toNumber(i.businessLevels[te.id], 0)), 0, te.prices.length);
  let H = knownIds(i.ownedBusinesses, o);
  (H.includes('loop-garage-share') && !Q['loop-garage'] && (Q['loop-garage'] = 1),
    Q['loop-garage'] > 0 && !H.includes('loop-garage-share') && H.push('loop-garage-share'));
  let J = {};
  if (isRecord(i.propertyLevels))
    for (let te of INVESTMENTS.filter((ve) => ve.kind === 'property'))
      J[te.id] = clampNumber(Math.floor(toNumber(i.propertyLevels[te.id], 0)), 0, te.prices.length);
  let V = knownIds(i.ownedProperties, a);
  (V.includes('hush-house-loft') && !J['hush-house-loft'] && (J['hush-house-loft'] = 1),
    J['hush-house-loft'] > 0 && !V.includes('hush-house-loft') && V.push('hush-house-loft'));
  let L = {};
  if (isRecord(i.activityRecords))
    for (let [te, ve] of Object.entries(i.activityRecords))
      !r.has(te) ||
        !isRecord(ve) ||
        (L[te] = {
          completions: clampNumber(Math.floor(toNumber(ve.completions, 0)), 0, 1e4),
          bestTime: clampNumber(toNumber(ve.bestTime, 0), 0, 86400),
          bestCare: clampNumber(toNumber(ve.bestCare, 0), 0, 100),
        });
  let k = {};
  if (isRecord(i.factionStanding))
    for (let te of ['civic', 'couriers', 'makers', 'neighborhoods'])
      k[te] = clampNumber(toNumber(i.factionStanding[te], 0), -50, 50);
  let re = {};
  if (isRecord(i.missionRecords))
    for (let te of MISSIONS) {
      let ve = i.missionRecords[te.id];
      if (!isRecord(ve)) continue;
      let ye = new Set((te.optionalObjectives ?? []).map((ke) => ke.id));
      re[te.id] = {
        completions: clampNumber(Math.floor(toNumber(ve.completions, 0)), 0, 1e4),
        completedOptionals: knownIds(ve.completedOptionals, ye),
        bestTime: clampNumber(toNumber(ve.bestTime, 0), 0, 86400),
      };
    }
  let Y = isRecord(i.lawState)
    ? {
        wanted: clampNumber(Math.floor(toNumber(i.lawState.wanted, 0)), 0, 5),
        heat: clampNumber(toNumber(i.lawState.heat, 0), 0, 100),
        crimePressure: clampNumber(toNumber(i.lawState.crimePressure, 0), 0, 20),
        unseenTime: clampNumber(toNumber(i.lawState.unseenTime, 0), 0, 180),
        lastKnownX: clampNumber(
          toNumber(i.lawState.lastKnownX, toNumber(i.player.x, -49)),
          -CITY.width / 2 + 3,
          CITY.width / 2 - 3,
        ),
        lastKnownZ: clampNumber(
          toNumber(i.lawState.lastKnownZ, toNumber(i.player.z, -44)),
          -CITY.depth / 2 + 3,
          CITY.depth / 2 - 3,
        ),
      }
    : undefined;
  return {
    version: 2,
    player: {
      x: clampNumber(toNumber(i.player.x, -49), -CITY.width / 2 + 3, CITY.width / 2 - 3),
      y: 0.35,
      z: clampNumber(toNumber(i.player.z, -44), -CITY.depth / 2 + 3, CITY.depth / 2 - 3),
      health: clampNumber(toNumber(i.player.health, 100), 1, 100),
      armor: clampNumber(toNumber(i.player.armor, 0), 0, 100),
    },
    money: clampNumber(toNumber(i.money, 475), 0, 1e6),
    reputation: clampNumber(Math.floor(toNumber(i.reputation, 0)), 0, 1e4),
    timeOfDay: ((toNumber(i.timeOfDay, 9.25) % 24) + 24) % 24,
    weather: U,
    completedMissions: f,
    collected: knownIds(i.collected, l),
    ownedVehicles: c,
    ownedVehicleStates: ie,
    ownedBusinesses: H,
    ownedProperties: V,
    businessLevels: Q,
    propertyLevels: J,
    activityRecords: L,
    factionStanding: k,
    cameraMode: j,
    outfitIndex: clampNumber(Math.floor(toNumber(i.outfitIndex, 0)), 0, 3),
    discoveredDistricts: knownIds(i.discoveredDistricts, t),
    missionId: u,
    objectiveIndex: m,
    objectiveProgress: A,
    objectiveElapsed: clampNumber(toNumber(i.objectiveElapsed, 0), 0, 3600),
    missionElapsed: u ? clampNumber(toNumber(i.missionElapsed, 0), 0, 86400) : 0,
    objectiveHoldTime: clampNumber(toNumber(i.objectiveHoldTime, 0), 0, 3600),
    carriedMissionItem: d,
    missionOptionalProgress: I,
    missionOptionalStates: F,
    missionPassengerId: N,
    missionVehicleState: ee,
    lawState: Y,
    missionRecords: re,
    lastSavedAt: clampNumber(toNumber(i.lastSavedAt, Date.now()), 0, Number.MAX_SAFE_INTEGER),
  };
}
export function readSave(i) {
  let e = i.getItem(SAVE_KEY),
    t = sanitizeSave(parseJson(e));
  if (t) return { data: t, recovered: false, migrated: false, invalid: false };
  let r = i.getItem(BACKUP_KEY),
    s = sanitizeSave(parseJson(r));
  if (s) return { data: s, recovered: true, migrated: false, invalid: !!e };
  let n = i.getItem(LEGACY_KEY),
    a = sanitizeSave(parseJson(n));
  return a
    ? { data: a, recovered: false, migrated: true, invalid: !!e }
    : { data: null, recovered: false, migrated: false, invalid: !!(e || r || n) };
}
export function writeSave(i, e) {
  let t = sanitizeSave(e);
  if (!t) throw new Error('Refusing to write invalid Brightline save data.');
  let r = i.getItem(SAVE_KEY);
  (r && sanitizeSave(parseJson(r)) && i.setItem(BACKUP_KEY, r),
    i.setItem(SAVE_KEY, JSON.stringify(t)),
    i.removeItem(LEGACY_KEY));
}
export function clearSave(i) {
  (i.removeItem(SAVE_KEY), i.removeItem(BACKUP_KEY), i.removeItem(LEGACY_KEY));
}
function clampSetting(i, e, t, r) {
  let s = Number(i);
  return Number.isFinite(s) ? Math.min(r, Math.max(t, s)) : e;
}
export function normalizeSettings(i, e = DEFAULT_SETTINGS) {
  let t = ['performance', 'balanced', 'quality'].includes(String(i?.quality)) ? i.quality : e.quality,
    r = ['relaxed', 'standard', 'challenging'].includes(String(i?.difficulty)) ? i.difficulty : e.difficulty,
    s = ['default', 'deuteranopia', 'protanopia', 'tritanopia'].includes(String(i?.colorVision))
      ? i.colorVision
      : e.colorVision;
  return {
    quality: t,
    difficulty: r,
    masterVolume: clampSetting(i?.masterVolume, e.masterVolume, 0, 1),
    cameraSensitivity: clampSetting(i?.cameraSensitivity, e.cameraSensitivity, 0.5, 1.75),
    reducedMotion: i?.reducedMotion === undefined ? e.reducedMotion : !!i.reducedMotion,
    highContrast: i?.highContrast === undefined ? e.highContrast : !!i.highContrast,
    largeText: i?.largeText === undefined ? e.largeText : !!i.largeText,
    colorVision: s,
    tutorialHints: i?.tutorialHints === undefined ? e.tutorialHints : !!i.tutorialHints,
    onboardingComplete: i?.onboardingComplete === undefined ? e.onboardingComplete : !!i.onboardingComplete,
  };
}
