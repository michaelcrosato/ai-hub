/**
 * save.js — player settings and campaign progress in localStorage, with the
 * original's validation (so an old or hand-edited save can never break a run).
 * Keys are unchanged from the original build, so existing progress carries over.
 */

import { MISSIONS, FINALE_ID, GRADE_RANK } from './data.js';

const SETTINGS_KEY = 'skyshield-settings';
const CAMPAIGN_KEY = 'skyshield-campaign';

export const DEFAULT_SETTINGS = Object.freeze({
  difficulty: 'pilot',
  pace: 'standard',
  masterVolume: 0.8,
  musicVolume: 0.55,
  sfxVolume: 0.8,
  subtitles: true,
  cameraShake: true,
  reducedMotion: false,
  hudScale: 1,
  aimAssist: true,
  colorMode: 'default',
  camera: 'tactical',
});

const UPGRADE_IDS = ['armor', 'cannon', 'rockets', 'avionics'];

export function freshCampaign() {
  return {
    version: 2,
    unlocked: 1,
    completed: [],
    credits: 0,
    upgrades: { armor: 0, cannon: 0, rockets: 0, avionics: 0 },
    checkpoint: undefined,
    lastMissionId: undefined,
    records: {},
  };
}

function read(key) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode or full storage: progress lasts for this visit only */
  }
}

const num = (v, fallback, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback);
const bool = (v, fallback) => (typeof v === 'boolean' ? v : fallback);

export function loadSettings() {
  const t = read(SETTINGS_KEY);
  const d = DEFAULT_SETTINGS;
  return {
    ...d,
    difficulty: ['cadet', 'pilot', 'ace'].includes(t.difficulty) ? t.difficulty : d.difficulty,
    pace: t.pace === 'standard' || t.pace === 'rapid' ? t.pace : d.pace,
    masterVolume: num(t.masterVolume, d.masterVolume, 0, 1),
    musicVolume: num(t.musicVolume, d.musicVolume, 0, 1),
    sfxVolume: num(t.sfxVolume, d.sfxVolume, 0, 1),
    hudScale: num(t.hudScale, d.hudScale, 0.8, 1.4),
    subtitles: bool(t.subtitles, d.subtitles),
    cameraShake: bool(t.cameraShake, d.cameraShake),
    reducedMotion: bool(t.reducedMotion, d.reducedMotion),
    aimAssist: bool(t.aimAssist, d.aimAssist),
    colorMode: t.colorMode === 'deuteranopia' || t.colorMode === 'tritanopia' ? t.colorMode : 'default',
    camera: t.camera === 'chase' ? 'chase' : 'tactical',
  };
}

export const saveSettings = (s) => write(SETTINGS_KEY, s);

function cleanRecords(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const m of MISSIONS) {
    const r = raw[m.id];
    if (!r || typeof r !== 'object') continue;
    out[m.id] = {
      bestScore: num(r.bestScore, 0, 0, 1e9) | 0,
      bestGrade: GRADE_RANK[r.bestGrade] ? r.bestGrade : null,
      bestTime: typeof r.bestTime === 'number' && Number.isFinite(r.bestTime) && r.bestTime > 0 ? r.bestTime : null,
      clears: num(r.clears, 0, 0, 1e6) | 0,
    };
  }
  return out;
}

export function loadCampaign() {
  const t = read(CAMPAIGN_KEY);
  const ids = new Set(MISSIONS.map((m) => m.id));
  const completed = Array.isArray(t.completed) ? [...new Set(t.completed.filter((v) => typeof v === 'string' && ids.has(v)))] : [];
  const rawUp = t.upgrades && typeof t.upgrades === 'object' && !Array.isArray(t.upgrades) ? t.upgrades : {};
  const upgrades = Object.fromEntries(UPGRADE_IDS.map((k) => [k, typeof rawUp[k] === 'number' ? Math.min(3, Math.max(0, Math.floor(rawUp[k]))) : 0]));

  // Checkpoint validation, as the original did it: the mission must exist, the phase must
  // resolve, and a checkpoint from an older revision of a mission is dropped.
  const a = t.checkpoint && typeof t.checkpoint === 'object' ? t.checkpoint : null;
  const m = a && typeof a.missionId === 'string' ? MISSIONS.find((v) => v.id === a.missionId) : undefined;
  const phaseId = a && typeof a.phaseId === 'string' ? a.phaseId : null;
  const phaseIndexRaw = a && typeof a.phaseIndex === 'number' ? Math.floor(a.phaseIndex) : 0;
  const firstRevision = m && (m.revision || 1) === 1;
  const p = m ? (phaseId ? m.phases.findIndex((v) => v.id === phaseId) : firstRevision ? Math.min(m.phases.length - 1, Math.max(0, phaseIndexRaw)) : -1) : -1;
  const sameRevision = m && (a?.missionRevision === undefined ? firstRevision : a.missionRevision === (m.revision || 1));
  const checkpoint =
    a && m && p >= 0 && sameRevision
      ? {
          missionId: m.id,
          missionRevision: m.revision || 1,
          phaseId: m.phases[p].id,
          phaseIndex: p,
          score: typeof a.score === 'number' && Number.isFinite(a.score) ? Math.max(0, Math.floor(a.score)) : 0,
          stage: a.stage === 'debrief' ? 'debrief' : 'briefing',
          phaseScore: a.stage === 'debrief' && typeof a.phaseScore === 'number' && Number.isFinite(a.phaseScore) ? Math.max(0, Math.floor(a.phaseScore)) : 0,
          elapsed: typeof a.elapsed === 'number' && Number.isFinite(a.elapsed) ? Math.max(0, a.elapsed) : 0,
        }
      : undefined;

  let unlocked = Math.min(MISSIONS.length, Math.max(1, typeof t.unlocked === 'number' ? Math.floor(t.unlocked) : 1));
  // Saves from before the reserve operation existed: finishing the campaign opens it.
  const finale = MISSIONS.findIndex((v) => v.id === FINALE_ID);
  if (completed.includes(FINALE_ID)) unlocked = Math.max(unlocked, Math.min(MISSIONS.length, finale + 2));

  return {
    version: 2,
    unlocked,
    completed,
    credits: typeof t.credits === 'number' && Number.isFinite(t.credits) ? Math.max(0, Math.floor(t.credits)) : 0,
    upgrades,
    checkpoint,
    lastMissionId: typeof t.lastMissionId === 'string' && ids.has(t.lastMissionId) ? t.lastMissionId : undefined,
    records: cleanRecords(t.records),
  };
}

export const saveCampaign = (c) => write(CAMPAIGN_KEY, c);
