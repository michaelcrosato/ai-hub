/**
 * REMOTE COMMAND — rebuilt on the shared 3D kit.
 *
 * The original shipped as a React + react-three-fiber bundle with three.js
 * baked in. Everything the bundle did is here as plain modules: the DOM
 * command dashboard, the save format (remote-command-save-v1, versions 1–3
 * load), and the tactical globe, now drawn by kit.renderer (WebGPU with the
 * WebGL2 fallback).
 */

import * as THREE from 'three/webgpu';
import { boot } from 'kit/boot.js';
import { createPoints } from 'kit/points.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ================================================================== data */

const ASSETS = [
  { id: 'kestrel', name: 'Kestrel RQ-1', shortName: 'Kestrel', code: 'ISR / SOLO', domain: 'AIR', cost: 0, unlock: 1, power: 20, precision: 96, summary: 'Your original hand-flown reconnaissance drone. Quiet, precise, limited.', color: '#a8ff4f' },
  { id: 'dronePod', name: 'Drone Pod Mk II', shortName: 'Drone Pod', code: '8× AUTONOMOUS', domain: 'AIR', cost: 28000, unlock: 4, power: 46, precision: 91, summary: 'Eight coordinated airframes with independent task routing.', color: '#b7ff54' },
  { id: 'ghostwing', name: 'Ghostwing Relay', shortName: 'Ghostwing', code: 'EW / SIGNAL', domain: 'SIGNAL', cost: 52000, unlock: 8, power: 55, precision: 94, summary: 'A long-endurance signal and electronic-surveillance platform.', color: '#4ef2d3' },
  { id: 'specter', name: 'AC-130X Specter', shortName: 'Specter', code: 'HEAVY / AIR', domain: 'AIR', cost: 96000, unlock: 14, power: 82, precision: 84, summary: 'A remote-crewed airborne command platform for high-risk contracts.', color: '#ffd166' },
  { id: 'poseidon', name: 'Poseidon UUV Pack', shortName: 'Poseidon', code: '6× UNCREWED SEA', domain: 'SEA', cost: 145000, unlock: 22, power: 92, precision: 89, summary: 'Surface and subsurface autonomy for wide-area maritime control.', color: '#59b8ff' },
  { id: 'deterrence', name: 'ICBM Deterrence Cell', shortName: 'Deterrence', code: 'STRATEGIC / STANDBY', domain: 'STRATEGIC', cost: 420000, unlock: 34, power: 140, precision: 52, summary: 'A fictional strategic asset. Powerful leverage with severe escalation cost.', color: '#ff725e' },
  { id: 'orbital', name: 'Orbital Task Group', shortName: 'Space Force', code: 'ORBIT / NETWORK', domain: 'ORBIT', cost: 680000, unlock: 44, power: 165, precision: 98, summary: 'Inspection craft, sensors, and rapid-response orbital relays.', color: '#c9a7ff' },
];
const ASSET_BY_ID = Object.fromEntries(ASSETS.map((a) => [a.id, a]));
const PROOF_IDS = ['dronePod', 'ghostwing', 'specter', 'poseidon', 'deterrence', 'orbital'];
const DOMAINS = ['AIR', 'SIGNAL', 'SEA', 'STRATEGIC', 'ORBIT'];

// The six original contracts plus four new ones (03-G, 04-L, 09-P, 10-K). A negative
// escalation marks a STABILIZE contract: it cools the world down and rebuilds trust.
const MISSIONS = [
  { id: 'silent-lens', name: 'Silent Lens', code: 'CONTRACT 01-A', region: 'North Aster Corridor', brief: 'Map an unidentified convoy without being detected. Intelligence value is high; collateral tolerance is zero.', threat: 18, payout: 14500, intel: 8, rating: 3, trust: 2, escalation: 0, recommended: 'AIR', unlock: 1, lat: 39, lon: -74 },
  { id: 'dark-fiber', name: 'Dark Fiber', code: 'CONTRACT 02-C', region: 'Karsk Exclusion Ring', brief: 'Locate a mobile interference source and keep civilian networks online while the corridor reopens.', threat: 30, payout: 26000, intel: 12, rating: 4, trust: 1, escalation: 1, recommended: 'SIGNAL', unlock: 4, lat: 50, lon: 42 },
  { id: 'glass-meridian', name: 'Glass Meridian', code: 'CONTRACT 03-G', region: 'Veyra Ceasefire Line', brief: 'Verify that both sides are honoring a fragile ceasefire. Report what you see, exactly as you see it—nothing more.', threat: 26, payout: 17500, intel: 7, rating: 3, trust: 4, escalation: -3, recommended: 'AIR', unlock: 6, lat: 4, lon: 26 },
  { id: 'lantern-relay', name: 'Lantern Relay', code: 'CONTRACT 04-L', region: 'Sundari Delta', brief: 'Stand up emergency communications for a cyclone-struck delta. Nothing is armed; everything is watched, and remembered.', threat: 22, payout: 19000, intel: 6, rating: 3, trust: 5, escalation: -4, recommended: 'SIGNAL', unlock: 8, lat: 22, lon: 90 },
  { id: 'shield-tide', name: 'Shield Tide', code: 'CONTRACT 05-B', region: 'Pelagic Free Route', brief: 'Screen an aid flotilla through contested waters using only remote and autonomous systems.', threat: 42, payout: 48000, intel: 10, rating: 6, trust: 3, escalation: 1, recommended: 'SEA', unlock: 10, lat: -14, lon: 122 },
  { id: 'sky-bastion', name: 'Sky Bastion', code: 'CONTRACT 06-H', region: 'Aster High Airspace', brief: 'Hold a remote air corridor through a rolling sensor blackout. Heavy airborne command is authorized; ground forces are not.', threat: 64, payout: 76000, intel: 13, rating: 7, trust: 1, escalation: 2, recommended: 'AIR', unlock: 14, lat: 31, lon: 17 },
  { id: 'cold-current', name: 'Cold Current', code: 'CONTRACT 09-P', region: 'Tessaly Strait', brief: 'Shadow an unflagged submarine tender through a winter strait. Keep the contact; never close the distance.', threat: 58, payout: 88000, intel: 12, rating: 8, trust: 2, escalation: 1, recommended: 'SEA', unlock: 24, lat: 48, lon: 152 },
  { id: 'cobalt-umbrella', name: 'Cobalt Umbrella', code: 'CONTRACT 07-S', region: 'Boreal Warning Arc', brief: 'Hold a fictional missile-defense readiness posture. Strategic assets remain on standby; no launch authority is issued.', threat: 78, payout: 150000, intel: 16, rating: 10, trust: -1, escalation: 4, recommended: 'STRATEGIC', unlock: 26, lat: 64, lon: -18 },
  { id: 'aurora-watch', name: 'Aurora Watch', code: 'CONTRACT 08-O', region: 'High Orbit / Earth-77', brief: 'Identify a blind spot in the planetary sensor mesh before an unregistered object crosses it.', threat: 55, payout: 92000, intel: 18, rating: 8, trust: 2, escalation: 0, recommended: 'ORBIT', unlock: 40, lat: 12, lon: -155 },
  { id: 'kessler-sweep', name: 'Kessler Sweep', code: 'CONTRACT 10-K', region: 'Low Orbit / Debris Belt', brief: 'Map a debris cloud and nudge it clear of civilian satellites before the next cascade. Precision over power.', threat: 70, payout: 160000, intel: 20, rating: 11, trust: 3, escalation: -2, recommended: 'ORBIT', unlock: 46, lat: -38, lon: -118 },
];

// Flash contracts: short-lived priority signals, one template pool per domain.
const FLASH_TEMPLATES = {
  AIR: [
    { name: 'Kite Line', region: 'Oster Ridge', brief: 'A medevac helicopter went dark over broken ridges. Find the crew before the weather does, then talk the rescuers in.', trust: 3, escalation: -1 },
    { name: 'Paper Moon', region: 'Hallen Plateau', brief: 'An unmarked cargo flight keeps switching transponders. Shadow it to landing and photograph what comes off.', trust: 1, escalation: 0 },
  ],
  SIGNAL: [
    { name: 'Static Bloom', region: 'Port Kaval', brief: 'A jamming bloom is swallowing a port city’s traffic control. Find the source, map it, hand it to the harbor authority.', trust: 2, escalation: 0 },
    { name: 'Glass Choir', region: 'Senn Uplands', brief: 'Someone is spoofing election-night broadcasts. Triangulate the relays without touching a single one.', trust: 3, escalation: -1 },
  ],
  SEA: [
    { name: 'Salt Beacon', region: 'Brine Shelf', brief: 'A disabled ferry is drifting toward a mined channel. Escort it clear with uncrewed hulls and a very loud radio.', trust: 3, escalation: -1 },
    { name: 'Low Tide', region: 'Coral Verge', brief: 'Fishing fleets report a submerged contact under their nets. Identify it before someone decides to guess.', trust: 1, escalation: 0 },
  ],
  STRATEGIC: [
    { name: 'Quiet Hour', region: 'Meridian Talks', brief: 'Hold a visible standby posture for one hour while negotiators return to the table. No launch authority is issued.', trust: -1, escalation: 2 },
  ],
  ORBIT: [
    { name: 'Falling Star', region: 'Perigee Lane', brief: 'A decaying satellite is tumbling toward a populated coast. Track it and publish the footprint before the rumors do.', trust: 3, escalation: -1 },
    { name: 'Dark Neighbor', region: 'Geosync Belt', brief: 'An unregistered craft parked beside a weather satellite. Inspect from a respectful distance and log everything.', trust: 1, escalation: 1 },
  ],
};

// Campaign terms (difficulty). STANDARD is the original game's numbers.
const TERMS = {
  cadet: { id: 'cadet', name: 'CADET', credits: 24000, intel: 16, trust: 84, escalation: 3, success: 6, incident: -3, recovery: 1.35, blurb: 'Generous start, forgiving odds. For learning the network.', line: '$24K START // +6% SUCCESS' },
  standard: { id: 'standard', name: 'STANDARD', credits: 18000, intel: 12, trust: 78, escalation: 5, success: 0, incident: 0, recovery: 1, blurb: 'The contract as Kestrel Actual first signed it.', line: '$18K START // BASE ODDS' },
  hardline: { id: 'hardline', name: 'HARDLINE', credits: 14000, intel: 8, trust: 70, escalation: 10, success: -6, incident: 4, recovery: 0.6, blurb: 'Thin margins, loud mistakes, slow forgiveness.', line: '$14K START // −6% SUCCESS' },
};

const START_COUNTS = { kestrel: 1, dronePod: 0, ghostwing: 0, specter: 0, poseidon: 0, deterrence: 0, orbital: 0 };
const START_PROVEN = { kestrel: true, dronePod: false, ghostwing: false, specter: false, poseidon: false, deterrence: false, orbital: false };
const CONTINENTS = [
  [42, -105, 0.42, 0.65],
  [14, -82, 0.25, 0.48],
  [-15, -60, 0.31, 0.72],
  [51, 18, 0.53, 0.36],
  [25, 42, 0.43, 0.55],
  [38, 83, 0.72, 0.38],
  [7, 105, 0.44, 0.25],
  [-27, 134, 0.32, 0.45],
  [-1, 22, 0.38, 0.68],
];
const RANKS = [[44, 'SPACE COMMAND'], [34, 'STRATEGIC COMMAND'], [22, 'MARITIME COMMAND'], [14, 'AIR WING'], [4, 'DRONE CELL'], [0, 'INDEPENDENT']];
const ROES = ['restrained', 'standard', 'overmatch'];

const OP_MS = 8500;
const MAX_SLOTS = 6;
const FLASH_LIFE = 55;
const INQUIRY = { credits: 5000, intel: 3, trust: 8, escalation: 6, cooldown: 45 };
const SAVE_KEY = 'remote-command-save-v1';
const BEST_KEY = 'remote-command-best-v1';
const AUDIO_KEY = 'remote-command-audio-v1';

/* =============================================================== helpers */

const $ = (id) => document.getElementById(id);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const pad2 = (n) => String(n).padStart(2, '0');
const fmtStd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const fmtCompact = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0, notation: 'compact' });
const money = (n) => (n >= 1e6 ? fmtCompact : fmtStd).format(n);
const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '+0');
const clockText = (sec) => {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor(s / 60) % 60;
  return h ? `${h}:${pad2(m)}:${pad2(s % 60)}` : `${pad2(m)}:${pad2(s % 60)}`;
};
const rankFor = (rating) => RANKS.find(([min]) => rating >= min)[1];
const slotsFor = (rating) => Math.min(MAX_SLOTS, 1 + Math.floor(rating / 10));
const readJSON = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
const writeJSON = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode or full storage: the game still plays */
  }
};
const setText = (el, value) => {
  const v = String(value);
  if (el.textContent !== v) el.textContent = v;
};
const setDisabled = (el, v) => {
  if (el.disabled !== !!v) el.disabled = !!v;
};
const setWidth = (el, pct) => {
  const w = `${pct}%`;
  if (el.style.width !== w) el.style.width = w;
};
const setPressed = (el, on) => {
  el.classList.toggle('selected', on);
  const v = on ? 'true' : 'false';
  if (el.getAttribute('aria-pressed') !== v) el.setAttribute('aria-pressed', v);
};
const make = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

/** Latitude/longitude on the globe, the same mapping as the original. */
function latLon(lat, lon, r = 2.58, out = new THREE.Vector3()) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return out.set(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const angularDistance = (lat1, lon1, lat2, lon2) => {
  latLon(lat1, lon1, 1, _a);
  latLon(lat2, lon2, 1, _b);
  return (Math.acos(clamp(_a.dot(_b), -1, 1)) * 180) / Math.PI;
};

/* ================================================================= state */

function freshState(termsId = 'standard') {
  const t = TERMS[termsId] || TERMS.standard;
  return {
    terms: t.id,
    credits: t.credits,
    intel: t.intel,
    rating: 1,
    trust: t.trust,
    escalation: t.escalation,
    completed: 0,
    counts: { ...START_COUNTS },
    proven: { ...START_PROVEN },
    active: [],
    victoryDismissed: false,
    victoryAt: 0,
    time: 0,
    flash: null,
    flashIn: 45,
    flashSeq: 0,
    inquiryCd: 0,
    calmT: 0,
    mendT: 0,
    log: [],
  };
}

function sanitizeFlashMission(o) {
  if (!o || typeof o !== 'object' || !DOMAINS.includes(o.recommended)) return null;
  const num = (v, d, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : d);
  const str = (v, d, n = 80) => (typeof v === 'string' && v ? v.slice(0, n) : d);
  return {
    id: str(o.id, 'flash-0', 24),
    flash: true,
    name: str(o.name, 'Priority Signal'),
    code: str(o.code, 'FLASH CONTRACT'),
    region: str(o.region, 'Unregistered Sector'),
    brief: str(o.brief, '', 400),
    threat: Math.round(num(o.threat, 40, 1, 100)),
    payout: Math.round(num(o.payout, 20000, 0, 5e6)),
    intel: Math.round(num(o.intel, 5, 0, 99)),
    rating: Math.round(num(o.rating, 2, 0, 20)),
    trust: Math.round(num(o.trust, 1, -20, 20)),
    escalation: Math.round(num(o.escalation, 0, -20, 20)),
    recommended: o.recommended,
    unlock: 0,
    lat: num(o.lat, 0, -89, 89),
    lon: num(o.lon, 0, -180, 180),
  };
}

/** Load the save (versions 1 and 2 from the original game, 3 from this one). */
function loadSave() {
  const e = readJSON(SAVE_KEY);
  if (!e || ![1, 2, 3].includes(e.version)) return null;
  try {
    const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
    const s = freshState(TERMS[e.terms] ? e.terms : 'standard');
    const counts = e.counts && typeof e.counts === 'object' ? e.counts : {};
    for (const a of ASSETS) s.counts[a.id] = Math.max(a.id === 'kestrel' ? 1 : 0, Math.floor(num(counts[a.id], START_COUNTS[a.id])));
    const proven = e.proven && typeof e.proven === 'object' ? e.proven : {};
    for (const a of ASSETS) s.proven[a.id] = START_PROVEN[a.id] || proven[a.id] === true || (e.version === 1 && s.counts[a.id] > 0);
    const now = Date.now();
    s.active = (Array.isArray(e.active) ? e.active : []).flatMap((c) => {
      if (!c || typeof c !== 'object') return [];
      const mission = c.flash ? sanitizeFlashMission(c.flash) : MISSIONS.find((m) => m.id === c.missionId);
      const asset = ASSET_BY_ID[c.assetId];
      if (!mission || !asset) return [];
      // v1/v2 stored wall-clock end times; v3 stores game-time left (the clock stops while paused).
      const remaining = e.version >= 3 ? num(c.remaining, 0) : num(c.endsAt, 0) - now;
      return [{
        mission,
        assetId: asset.id,
        units: Math.max(1, Math.floor(num(c.units, 1))),
        remaining: clamp(remaining, 0, OP_MS),
        duration: OP_MS,
        successChance: clamp(num(c.successChance, 50), 0, 100),
        incidentChance: clamp(num(c.incidentChance, 10), 0, 100),
        roe: ROES.includes(c.roe) ? c.roe : 'standard',
      }];
    });
    s.credits = Math.max(0, num(e.credits, s.credits));
    s.intel = Math.max(0, Math.floor(num(e.intel, s.intel)));
    s.rating = Math.max(1, Math.floor(num(e.rating, 1)));
    s.trust = clamp(Math.round(num(e.trust, s.trust)), 0, 100);
    s.escalation = clamp(Math.round(num(e.escalation, s.escalation)), 0, 100);
    s.completed = Math.max(0, Math.floor(num(e.completed, 0)));
    s.victoryDismissed = e.victoryDismissed === true;
    s.victoryAt = Math.max(0, num(e.victoryAt, 0));
    s.time = Math.max(0, num(e.time, 0));
    s.flashIn = clamp(num(e.flashIn, 45), 0, 300);
    s.flashSeq = Math.max(0, Math.floor(num(e.flashSeq, 0)));
    s.inquiryCd = clamp(num(e.inquiryCd, 0), 0, INQUIRY.cooldown);
    if (e.flash && typeof e.flash === 'object') {
      const m = sanitizeFlashMission(e.flash.mission);
      const left = num(e.flash.expires, 0);
      if (m && left > 0) s.flash = { mission: m, expires: Math.min(FLASH_LIFE, left) };
    }
    if (Array.isArray(e.log)) {
      s.log = e.log
        .filter((l) => l && typeof l.text === 'string')
        .slice(-30)
        .map((l) => ({ t: num(l.t, 0), text: l.text.slice(0, 200), tone: ['good', 'bad'].includes(l.tone) ? l.tone : '' }));
    }
    return s;
  } catch {
    return null;
  }
}

function serialize() {
  const packFlash = (m) => ({ ...m });
  return {
    version: 3,
    terms: state.terms,
    credits: state.credits,
    intel: state.intel,
    rating: state.rating,
    trust: state.trust,
    escalation: state.escalation,
    completed: state.completed,
    counts: state.counts,
    proven: state.proven,
    active: state.active.map((op) => ({
      missionId: op.mission.id,
      flash: op.mission.flash ? packFlash(op.mission) : undefined,
      assetId: op.assetId,
      units: op.units,
      remaining: Math.max(0, Math.round(op.remaining)),
      successChance: op.successChance,
      incidentChance: op.incidentChance,
      roe: op.roe,
    })),
    victoryDismissed: state.victoryDismissed,
    victoryAt: state.victoryAt,
    time: Math.round(state.time * 10) / 10,
    flash: state.flash ? { mission: packFlash(state.flash.mission), expires: state.flash.expires } : null,
    flashIn: state.flashIn,
    flashSeq: state.flashSeq,
    inquiryCd: state.inquiryCd,
    log: state.log.slice(-20),
  };
}

const saved = loadSave();
let state = saved || freshState('standard');
const sel = { mission: MISSIONS[0].id, lastRegular: MISSIONS[0].id, asset: 'kestrel', roe: 'standard', intel: 0, formation: 1 };
let campaignLive = false; // becomes true once the player continues or starts a campaign
let dirty = true;
let opsDirty = true;
let saveDirty = false;
let saveClock = 0;
let needsRender = true;
let feedAt = 0;

/* ================================================================== boot */

const shell = $('shell');
const mapEl = $('mapCanvas');

const ACTIONS = {
  navUp: { keys: ['ArrowUp', 'KeyW'], gamepad: ['Up'] },
  navDown: { keys: ['ArrowDown', 'KeyS'], gamepad: ['Down'] },
  navLeft: { keys: ['ArrowLeft', 'KeyA'], gamepad: ['Left'] },
  navRight: { keys: ['ArrowRight', 'KeyD'], gamepad: ['Right'] },
  stick: { type: 'vector', gamepad: 'leftStick' },
  look: { type: 'look', mouse: 'drag', gamepad: 'rightStick', touch: 'drag' },
  confirm: { keys: ['Enter', 'NumpadEnter', 'Space'], gamepad: ['A'] },
  back: { keys: ['Backspace'], gamepad: ['B'] },
  pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'] },
  deploy: { keys: ['KeyF'], gamepad: ['X'] },
  protocol: { keys: ['KeyR'], gamepad: ['Y'] },
  prevMission: { keys: ['KeyQ'], gamepad: ['LB'] },
  nextMission: { keys: ['KeyE'], gamepad: ['RB'] },
  prevAsset: { keys: ['KeyZ'], gamepad: ['LT'] },
  nextAsset: { keys: ['KeyC'], gamepad: ['RT'] },
  formLess: { keys: ['Minus', 'NumpadSubtract', 'BracketLeft'] },
  formMore: { keys: ['Equal', 'NumpadAdd', 'BracketRight'] },
  intel0: { keys: ['Digit0', 'Numpad0'] },
  intel1: { keys: ['Digit1', 'Numpad1'] },
  intel2: { keys: ['Digit2', 'Numpad2'] },
  intel3: { keys: ['Digit3', 'Numpad3'] },
  buy: { keys: ['KeyB'] },
  inquiry: { keys: ['KeyI'] },
  briefing: { keys: ['KeyH', 'Slash'], gamepad: ['Back'] },
  mute: { keys: ['KeyM'] },
};

const kit = await boot({
  title: 'REMOTE COMMAND',
  mount: mapEl, // the globe lives in the map panel; the dashboard around it is DOM
  gear: 'none', // SETTINGS sits in the header, the title screen and the pause menu (F9 works too)
  touch: false, // every control is already a touch-sized DOM button; the globe takes drags
  accent: '#b6ff58',
  background: '#070a08',
  input: ACTIONS,
});
const input = kit.input;
kit.loading.progress(0.7, 'Plotting signals…');

// The globe sits inside a scrolling dashboard: keep it out of the Tab order (every action has a
// button), let vertical swipes scroll the page on phones, and let the wheel scroll the page.
kit.canvas.tabIndex = -1;
kit.canvas.setAttribute('aria-label', 'Operations globe');
kit.canvas.style.touchAction = 'pan-y';
mapEl.addEventListener('wheel', (e) => e.stopPropagation(), { capture: true, passive: true });

// Browser shortcuts (Ctrl/Cmd/Alt + key) stay with the browser. Letters like R, F and C are game
// hotkeys here, and the kit would otherwise swallow Ctrl+R, Ctrl+F or Ctrl+-/+ page zoom.
addEventListener(
  'keydown',
  (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) e.stopImmediatePropagation();
  },
  true
);

const touchOnly = matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
if (touchOnly && input.source !== 'gamepad') input.source = 'touch';

/* ================================================================= audio */

const audio = (() => {
  let ctx = null;
  let out = null;
  let noiseBuf = null;
  let held = false;
  let muted = readJSON(AUDIO_KEY)?.muted === true;
  const start = () => {
    if (ctx) {
      if (ctx.state === 'suspended' && !held) ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      ctx = new AC();
    } catch {
      ctx = null;
      return;
    }
    out = ctx.createGain();
    out.gain.value = muted ? 0 : 0.5;
    out.connect(ctx.destination);
  };
  const tone = (freq, dur, { type = 'square', gain = 0.05, slide = 0, delay = 0 } = {}) => {
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(out);
    o.start(t0);
    o.stop(t0 + dur + 0.03);
  };
  const hiss = (dur, gain) => {
    if (!noiseBuf) {
      const n = Math.floor(ctx.sampleRate * 0.5);
      noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 900;
    f.Q.value = 0.8;
    const g = ctx.createGain();
    const t0 = ctx.currentTime;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(out);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  };
  const SFX = {
    tick: () => tone(1320, 0.035, { gain: 0.018 }),
    select: () => {
      tone(660, 0.06, { gain: 0.03 });
      tone(990, 0.08, { gain: 0.028, delay: 0.05 });
    },
    deny: () => tone(150, 0.16, { type: 'sawtooth', gain: 0.04 }),
    deploy: () => {
      tone(220, 0.35, { type: 'sawtooth', gain: 0.035, slide: 3 });
      tone(880, 0.12, { gain: 0.025, delay: 0.3 });
    },
    success: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, { type: 'triangle', gain: 0.06, delay: i * 0.07 })),
    incident: () => {
      hiss(0.28, 0.05);
      [523, 415].forEach((f, i) => tone(f, 0.18, { type: 'triangle', gain: 0.05, delay: i * 0.1 }));
    },
    fail: () => [392, 330, 262].forEach((f, i) => tone(f, 0.2, { type: 'sawtooth', gain: 0.035, delay: i * 0.09 })),
    buy: () => {
      tone(988, 0.07, { gain: 0.035 });
      tone(1319, 0.14, { gain: 0.035, delay: 0.07 });
    },
    promote: () => [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, { type: 'triangle', gain: 0.055, delay: i * 0.09 })),
    flash: () => [0, 0.18].forEach((d) => tone(1175, 0.1, { gain: 0.04, delay: d })),
    inquiry: () => {
      tone(440, 0.22, { type: 'sine', gain: 0.07 });
      tone(554, 0.28, { type: 'sine', gain: 0.06, delay: 0.12 });
    },
  };
  return {
    start,
    play(name) {
      if (!ctx || muted || held || ctx.state !== 'running') return;
      try {
        SFX[name]?.();
      } catch {
        /* a dropped sound is fine */
      }
    },
    get muted() {
      return muted;
    },
    setMuted(v) {
      muted = !!v;
      writeJSON(AUDIO_KEY, { muted });
      if (out) out.gain.value = muted ? 0 : 0.5;
    },
    hold(p) {
      held = p;
      if (!ctx) return;
      (p ? ctx.suspend() : ctx.resume()).catch(() => {});
    },
  };
})();
// Browsers only allow audio after a gesture; the context is made on the first one.
addEventListener('pointerdown', audio.start, true);
addEventListener('keydown', audio.start, true);
kit.onPause((p) => audio.hold(p));

/* ================================================================= globe */

const scene = new THREE.Scene();
scene.background = new THREE.Color('#050806');
scene.fog = new THREE.Fog('#050806', 8, 15);
const camera = kit.fitCamera(new THREE.PerspectiveCamera(38, 1, 0.1, 100));
camera.position.set(0, 0.25, 7.5);
camera.lookAt(0, 0, 0);
// The original ran through react-three-fiber, which defaults to ACES filmic tone mapping.
kit.renderer.toneMapping = THREE.ACESFilmicToneMapping;

scene.add(new THREE.AmbientLight(0xffffff, 0.65));
const sun = new THREE.DirectionalLight('#e8ffe0', 2.5);
sun.position.set(4, 3, 6);
scene.add(sun);
const rim = new THREE.PointLight('#4f87ff', 6, 9);
rim.position.set(-4, -1, 3);
scene.add(rim);

// Starfield: 420 fixed stars behind the globe (the same positions as the original).
const STAR_COUNT = 420;
const starPos = new Float32Array(STAR_COUNT * 3);
const starSize = new Float32Array(STAR_COUNT);
for (let i = 0; i < STAR_COUNT; i++) {
  const r = Math.sin(i * 91.771) * 43758.5453;
  const a = Math.sin(i * 37.331 + 2.7) * 31415.926;
  const l = Math.sin(i * 11.113 + 7.2) * 27182.818;
  starPos[i * 3] = (r - Math.floor(r) - 0.5) * 18;
  starPos[i * 3 + 1] = (a - Math.floor(a) - 0.5) * 11;
  starPos[i * 3 + 2] = -2 - (l - Math.floor(l)) * 8;
  const s = Math.sin(i * 7.77) * 1000;
  starSize[i] = 0.9 + (s - Math.floor(s)) * 0.9;
}
// Opaque and drawn first (see the kit README); the original's 72% opacity is baked into the colour.
const stars = createPoints({
  positions: starPos,
  sizes: starSize,
  sizeAttenuation: false,
  material: { color: new THREE.Color('#9ca6a0'), transparent: false, depthWrite: false },
});
stars.object.renderOrder = -1;
const applyStarDetail = () => stars.setCount(Math.min(STAR_COUNT, kit.detail(STAR_COUNT)));
applyStarDetail();
kit.onQuality(applyStarDetail);
scene.add(stars.object);

const globe = new THREE.Group();
globe.rotation.set(0.06, -0.16, -0.08);
scene.add(globe);
globe.add(new THREE.Mesh(new THREE.SphereGeometry(2.5, 64, 64), new THREE.MeshStandardMaterial({ color: '#111b18', roughness: 0.8, metalness: 0.2 })));
globe.add(new THREE.Mesh(new THREE.SphereGeometry(2.515, 28, 28), new THREE.MeshBasicMaterial({ color: '#47645a', wireframe: true, transparent: true, opacity: 0.18 })));

// Continents: nine flattened dodecahedra, merged into one mesh (one draw instead of nine).
const UP = new THREE.Vector3(0, 1, 0);
const ZAXIS = new THREE.Vector3(0, 0, 1);
{
  const base = new THREE.DodecahedronGeometry(0.62, 1);
  const parts = CONTINENTS.map(([lat, lon, sx, sz]) => {
    const p = latLon(lat, lon, 2.51);
    const q = new THREE.Quaternion().setFromUnitVectors(UP, p.clone().normalize());
    return base.clone().applyMatrix4(new THREE.Matrix4().compose(p, q, new THREE.Vector3(sx, 0.075, sz)));
  });
  base.dispose();
  globe.add(new THREE.Mesh(mergeGeometries(parts), new THREE.MeshStandardMaterial({ color: '#3c5244', roughness: 0.95 })));
  for (const p of parts) p.dispose();
}

// Signal markers: one slot per contract plus one for the flash contract. Each has its own
// point light, as in the original, but the pool is fixed so the light count never changes
// (a change would rebuild every lit material).
const markerGeo = new THREE.SphereGeometry(0.075, 18, 18);
const markerMats = {
  idle: new THREE.MeshBasicMaterial({ color: '#ffb65c' }),
  selected: new THREE.MeshBasicMaterial({ color: '#c6ff62' }),
  active: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
  flash: new THREE.MeshBasicMaterial({ color: '#ff725e' }),
};
const FLASH_SLOT = MISSIONS.length;
const markers = [];
for (let i = 0; i <= FLASH_SLOT; i++) {
  const mesh = new THREE.Mesh(markerGeo, markerMats.idle);
  const light = new THREE.PointLight('#ff8d5c', 0, 0.85);
  globe.add(mesh, light);
  markers.push({ mesh, light, mission: null, lat: null, lon: null, normal: new THREE.Vector3(), align: new THREE.Quaternion(), burst: 0 });
}

// Selection ring and flash ping, laid flat on the surface.
const ringSelect = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.007, 6, 48), new THREE.MeshBasicMaterial({ color: '#c6ff62', transparent: true, opacity: 0.85, depthWrite: false }));
const ringFlash = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.006, 6, 48), new THREE.MeshBasicMaterial({ color: '#ff725e', transparent: true, opacity: 0.8, depthWrite: false }));
globe.add(ringSelect, ringFlash);

// Uplink beams over contracts with a live link.
const beamGeo = new THREE.CylinderGeometry(0.004, 0.012, 1, 6, 1, true);
beamGeo.translate(0, 0.5, 0);
const beamMat = new THREE.MeshBasicMaterial({ color: '#b6ff58', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending });
const beams = [];
for (let i = 0; i < MAX_SLOTS + 1; i++) {
  const b = new THREE.Mesh(beamGeo, beamMat);
  b.visible = false;
  globe.add(b);
  beams.push(b);
}

// The orbiting force: every owned system circles the globe (instanced: three draws in total).
const orbit = new THREE.Group();
orbit.rotation.set(0.18, 0, -0.12);
globe.add(orbit);
const ORBIT_MAX = 26;
const orbitMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const orbitMeshes = {
  ORBIT: new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.075, 0), orbitMat, ORBIT_MAX),
  SEA: new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.035, 0.11, 4, 8), orbitMat, ORBIT_MAX),
  OTHER: new THREE.InstancedMesh(new THREE.ConeGeometry(0.055, 0.16, 4), orbitMat, ORBIT_MAX),
};
const white = new THREE.Color(0xffffff);
for (const im of Object.values(orbitMeshes)) {
  for (let i = 0; i < ORBIT_MAX; i++) im.setColorAt(i, white); // create instanceColor up front
  im.count = 0;
  im.frustumCulled = false;
  orbit.add(im);
}
const dummy = new THREE.Object3D();
const tmpColor = new THREE.Color();
let orbitKey = '';
function rebuildOrbit() {
  const items = [];
  for (const a of ASSETS) {
    const n = Math.min(state.counts[a.id], a.id === 'dronePod' ? 10 : 3);
    for (let r = 0; r < n; r++) items.push([a, r]);
  }
  items.length = Math.min(items.length, ORBIT_MAX);
  const total = Math.max(items.length, 1);
  for (const im of Object.values(orbitMeshes)) im.count = 0;
  items.forEach(([a, r], idx) => {
    const l = (idx / total) * Math.PI * 2 + r * 0.21;
    const u = 3.05 + (idx % 3) * 0.13;
    dummy.position.set(u * Math.cos(l), Math.sin(l * 2) * 0.18, -u * Math.sin(l));
    dummy.rotation.set(0, l, Math.PI / 2, 'YXZ');
    dummy.updateMatrix();
    const im = orbitMeshes[a.domain === 'ORBIT' ? 'ORBIT' : a.domain === 'SEA' ? 'SEA' : 'OTHER'];
    const k = im.count++;
    im.setMatrixAt(k, dummy.matrix);
    im.setColorAt(k, tmpColor.set(a.color));
  });
  for (const im of Object.values(orbitMeshes)) {
    im.instanceMatrix.needsUpdate = true;
    im.instanceColor.needsUpdate = true;
  }
}

// View: the globe turns to face the selected signal; drag (or the right stick) spins it.
const view = { yaw: -0.16, pitch: 0.06, tYaw: -0.16, tPitch: 0.06, aimedId: null, dragging: 0 };
const TILT_Z = new THREE.Euler(0, 0, -0.08);
const _aim = new THREE.Vector3();
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
function aimAt(mission) {
  view.aimedId = mission.id;
  latLon(mission.lat, mission.lon, 1, _aim).applyEuler(TILT_Z);
  const yaw = -Math.atan2(_aim.x, _aim.z);
  const elevation = Math.atan2(_aim.y, Math.hypot(_aim.x, _aim.z));
  view.tYaw = view.yaw + wrapAngle(yaw - view.yaw);
  view.tPitch = 0.06 + clamp(elevation * 0.55, -0.45, 0.5);
}

function placeMarker(mk, m) {
  if (mk.lat === m.lat && mk.lon === m.lon) return;
  mk.lat = m.lat;
  mk.lon = m.lon;
  latLon(m.lat, m.lon, 2.58, mk.mesh.position);
  mk.light.position.copy(mk.mesh.position);
  mk.normal.copy(mk.mesh.position).normalize();
  mk.align.setFromUnitVectors(ZAXIS, mk.normal);
}

function syncMarkers(selectedId) {
  const liveIds = new Set(state.active.map((op) => op.mission.id));
  const flashMission = state.flash?.mission || state.active.find((op) => op.mission.flash)?.mission || null;
  for (let i = 0; i < markers.length; i++) {
    const mk = markers[i];
    const m = i === FLASH_SLOT ? flashMission : state.rating >= MISSIONS[i].unlock ? MISSIONS[i] : null;
    mk.mission = m;
    mk.mesh.visible = !!m;
    if (!m) {
      mk.light.intensity = 0;
      continue;
    }
    placeMarker(mk, m);
    const selected = m.id === selectedId;
    const live = liveIds.has(m.id);
    mk.mesh.material = live ? markerMats.active : selected ? markerMats.selected : m.flash ? markerMats.flash : markerMats.idle;
    mk.light.color.set(selected ? '#c6ff62' : m.flash ? '#ff725e' : '#ff8d5c');
    mk.light.intensity = selected ? 1.8 : m.flash ? 1.2 : 0.8;
  }
  let n = 0;
  for (const mk of markers) {
    if (mk.mission && liveIds.has(mk.mission.id) && n < beams.length) {
      const b = beams[n++];
      b.visible = true;
      b.position.copy(mk.normal).multiplyScalar(2.5);
      b.quaternion.setFromUnitVectors(UP, mk.normal);
    }
  }
  for (; n < beams.length; n++) beams[n].visible = false;
}

const markerFor = (id) => markers.find((mk) => mk.mission && mk.mission.id === id) || null;
const _spin = new THREE.Quaternion();
const _world = new THREE.Vector3();
const _toCam = new THREE.Vector3();

/** Screen position (CSS px over the canvas) of a marker, or null when it faces away. */
function markerScreen(mk, out) {
  mk.mesh.getWorldPosition(_world);
  _toCam.copy(camera.position).sub(_world).normalize();
  const facing = _toCam.dot(_aim.copy(_world).normalize());
  if (facing < 0.08) return null;
  _world.project(camera);
  out.x = (_world.x * 0.5 + 0.5) * kit.size.width;
  out.y = (-_world.y * 0.5 + 0.5) * kit.size.height;
  return out;
}
const _scr = { x: 0, y: 0 };
function pickMarker(px, py, radius) {
  let best = null;
  let bestD = radius;
  for (const mk of markers) {
    if (!mk.mission || !markerScreen(mk, _scr)) continue;
    const d = Math.hypot(_scr.x - px, _scr.y - py);
    if (d < bestD) {
      bestD = d;
      best = mk;
    }
  }
  return best;
}

/* ==================================================================== ui */

const ui = {};
for (const id of [
  'resCredits', 'resIntel', 'resTrust', 'rankTag', 'ratingValue', 'ratingBar', 'ratingNote', 'statSlots', 'statSystems',
  'statContracts', 'statProof', 'statEscalation', 'statTerms', 'btnInquiry', 'inquiryNote', 'mapCoord', 'mapSync',
  'globeTip', 'globeTipName', 'globeTipCode', 'flashStrip', 'flashCode', 'flashName', 'flashTime', 'missionTabs',
  'activityBand', 'feedText', 'feedTime', 'opsCount', 'opsEmpty', 'opsRow', 'cCode', 'cTag', 'cDomain', 'cName',
  'cRegion', 'cBrief', 'cThreat', 'cThreatBar', 'cReward', 'cIntel', 'cTrust', 'cRating', 'cEsc', 'assetSelector',
  'formLess', 'formMore', 'formValue', 'mSuccess', 'mIncident', 'btnDeploy', 'deployLabel', 'deployNote',
  'controlHint', 'arsenalSelected', 'arsenal', 'controlsTitle', 'controlsList', 'termsGrid', 'termsKicker',
  'termsText', 'termsConfirm', 'titleSave', 'titleContinue', 'titleNew', 'titleFoot', 'pauseTime', 'pauseTerms',
  'pauseBest', 'pauseSound', 'trafficLog', 'vRating', 'vContracts', 'vTrust', 'vEsc', 'vTime', 'promoToast', 'linkStatus',
]) ui[id] = $(id);
ui.roeButtons = [...document.querySelectorAll('#roeButtons button')];
ui.intelButtons = [...document.querySelectorAll('#intelButtons button')];
ui.victoryTitle = $('victory-title');
ui.termsTitle = $('terms-title');

// Mission tabs (built once, updated in place so focus survives).
const tabEls = new Map();
for (const m of MISSIONS) {
  const b = make('button');
  b.type = 'button';
  b.dataset.mission = m.id;
  if (m.escalation < 0) b.classList.add('stable');
  const i = make('i');
  const span = make('span');
  const small = make('small');
  span.append(small, make('strong', null, m.name));
  b.append(i, span);
  ui.missionTabs.append(b);
  tabEls.set(m.id, { b, i, small });
}

// Capability selector.
const pickEls = new Map();
for (const a of ASSETS) {
  const b = make('button');
  b.type = 'button';
  b.dataset.asset = a.id;
  const bar = make('i');
  bar.style.background = a.color;
  const span = make('span');
  span.append(make('strong', null, a.shortName), make('small', null, `${a.domain} // ${a.power} PWR`));
  const em = make('em');
  b.append(bar, span, em);
  ui.assetSelector.append(b);
  pickEls.set(a.id, { b, em });
}

// Arsenal cards.
const cardEls = new Map();
ASSETS.forEach((a, idx) => {
  const article = make('article');
  const main = make('button', 'asset-main');
  main.type = 'button';
  main.dataset.asset = a.id;
  const glyph = make('span', 'asset-glyph');
  glyph.style.color = a.color;
  glyph.setAttribute('aria-hidden', 'true');
  glyph.append(make('i'), make('i'), make('i'));
  const copy = make('span', 'asset-copy');
  copy.append(make('small', null, a.code), make('strong', null, a.name), make('em', null, a.summary));
  const owned = make('span', 'asset-owned');
  const ownedLabel = make('span', null, 'OWNED');
  const ownedCount = make('strong');
  owned.append(ownedLabel, ' ', ownedCount);
  main.append(make('span', 'asset-index', pad2(idx + 1)), glyph, copy, owned);
  const foot = make('div', 'asset-footer');
  foot.append(make('span', null, `PWR ${a.power} // PRC ${a.precision}`));
  let buy = null;
  if (a.cost === 0) foot.append(make('strong', null, 'ISSUED'));
  else {
    buy = make('button');
    buy.type = 'button';
    buy.dataset.buy = a.id;
    foot.append(buy);
  }
  article.append(main, foot);
  ui.arsenal.append(article);
  cardEls.set(a.id, { article, main, ownedLabel, ownedCount, buy });
});

// Terms (difficulty) choices.
let termsChoice = 'standard';
let termsMode = 'reset';
const termEls = new Map();
for (const t of Object.values(TERMS)) {
  const b = make('button');
  b.type = 'button';
  b.dataset.terms = t.id;
  b.append(make('strong', null, t.name), make('small', null, t.blurb), make('em', null, t.line));
  ui.termsGrid.append(b);
  termEls.set(t.id, b);
}

/* ============================================================== derived */

function currentMission() {
  const id = sel.mission;
  const m = MISSIONS.find((x) => x.id === id);
  if (m && state.rating >= m.unlock) return m;
  if (state.flash && state.flash.mission.id === id) return state.flash.mission;
  const op = state.active.find((o) => o.mission.id === id);
  if (op) return op.mission;
  // A lapsed or finished flash contract hands the view back to the last regular contract.
  const back = MISSIONS.find((x) => x.id === sel.lastRegular);
  if (back && state.rating >= back.unlock) return back;
  return MISSIONS.find((x) => state.rating >= x.unlock) || MISSIONS[0];
}

const busyUnits = (assetId) => state.active.reduce((n, op) => n + (op.assetId === assetId ? op.units : 0), 0);
const freeUnits = (assetId) => Math.max(0, state.counts[assetId] - busyUnits(assetId));
const victoryMet = () => state.rating >= 50 && state.completed >= 12 && PROOF_IDS.every((id) => state.proven[id]);
const canInquire = () =>
  state.inquiryCd <= 0 && state.credits >= INQUIRY.credits && state.intel >= INQUIRY.intel && (state.trust < 100 || state.escalation > 0);

function derive() {
  const mission = currentMission();
  const asset = ASSET_BY_ID[sel.asset] || ASSETS[0];
  const terms = TERMS[state.terms] || TERMS.standard;
  const slotCap = slotsFor(state.rating);
  const slots = state.trust < 20 ? 1 : slotCap;
  const free = freeUnits(asset.id);
  const maxForm = asset.id === 'dronePod' ? 24 : 3;
  const formation = Math.min(sel.formation, Math.max(1, Math.min(maxForm, free)));
  const available = free >= formation;
  const missionBusy = state.active.some((op) => op.mission.id === mission.id);
  const mismatch = asset.domain !== mission.recommended;
  const intelCommit = Math.min(sel.intel, state.intel);
  const roeMul = sel.roe === 'restrained' ? 0.86 : sel.roe === 'overmatch' ? 1.18 : 1;
  const power = asset.power * (1 + (formation - 1) * 0.68);
  const threat = mission.threat * (1 + state.escalation / 180);
  const success = Math.round(clamp(70 + (power * roeMul - threat) / 1.4 + 14 + intelCommit * 5 + terms.success, 42, 96));
  const incident = Math.round(
    clamp(
      mission.escalation * 4 +
        (100 - asset.precision) / 3 +
        state.escalation / 8 +
        (formation - 1) * 1.5 +
        (sel.roe === 'restrained' ? -5 : sel.roe === 'overmatch' ? 12 : 0) -
        intelCommit * 2 +
        terms.incident,
      2,
      48
    )
  );
  const owned = state.counts[asset.id] > 0;
  const canDeploy =
    !missionBusy &&
    state.active.length < slots &&
    owned &&
    state.rating >= asset.unlock &&
    available &&
    state.intel >= intelCommit &&
    !mismatch &&
    state.trust > 0 &&
    state.escalation < 100;
  const label = missionBusy
    ? 'LINK ACTIVE'
    : !owned
      ? 'NOT PROCURED'
      : mismatch
        ? `${mission.recommended} CAPABILITY REQUIRED`
        : state.trust <= 0
          ? 'MANDATE REVOKED'
          : state.escalation >= 100
            ? 'GLOBAL LOCKDOWN'
            : state.active.length >= slots
              ? 'CONTROL LIMIT'
              : available
                ? 'DEPLOY REMOTELY'
                : 'ASSET BUSY';
  return { mission, asset, slots, slotCap, free, maxForm, formation, available, missionBusy, mismatch, intelCommit, success, incident, canDeploy, label };
}

/* =============================================================== render */

const lastRes = {};
const bumpTimers = {};
function bump(el, key, value, text) {
  const prev = lastRes[key];
  if (prev !== undefined && value !== prev) {
    el.classList.remove('gain', 'loss');
    el.classList.add(value > prev ? 'gain' : 'loss');
    clearTimeout(bumpTimers[key]);
    bumpTimers[key] = setTimeout(() => el.classList.remove('gain', 'loss'), 900);
  }
  lastRes[key] = value;
  setText(el, text);
}

function render() {
  const d = derive();
  const m = d.mission;
  sel.mission = m.id;
  if (sel.intel > state.intel) sel.intel = clamp(state.intel, 0, 3);
  if (view.aimedId !== m.id) aimAt(m);
  const liveIds = new Set(state.active.map((op) => op.mission.id));

  bump(ui.resCredits, 'credits', state.credits, money(state.credits));
  bump(ui.resIntel, 'intel', state.intel, pad2(state.intel));
  bump(ui.resTrust, 'trust', state.trust, `${state.trust}%`);

  // Operator profile.
  setText(ui.rankTag, rankFor(state.rating));
  setText(ui.ratingValue, state.rating);
  const maxed = d.slotCap >= MAX_SLOTS;
  setWidth(ui.ratingBar, maxed ? 100 : ((state.rating % 10) / 10) * 100);
  setText(
    ui.ratingNote,
    state.trust < 20 ? 'Low trust // one control slot' : maxed ? 'All control slots cleared' : `${10 - (state.rating % 10)} pts to next control slot`
  );
  setText(ui.statSlots, `${state.active.length} / ${d.slots}`);
  ui.statSlots.classList.toggle('hot', state.trust < 20);
  setText(ui.statSystems, pad2(Object.values(state.counts).reduce((n, c) => n + c, 0)));
  setText(ui.statContracts, pad2(state.completed));
  setText(ui.statProof, `${Object.values(state.proven).filter(Boolean).length} / 7`);
  setText(ui.statEscalation, `${state.escalation}%`);
  ui.statEscalation.classList.toggle('hot', state.escalation > 35);
  setText(ui.statTerms, (TERMS[state.terms] || TERMS.standard).name);
  setDisabled(ui.btnInquiry, !canInquire());
  setText(ui.linkStatus, state.escalation >= 100 ? 'EARTH-77 LOCKDOWN' : state.trust < 20 ? 'EARTH-77 LINK UNDER REVIEW' : 'EARTH-77 LINK SECURE');

  // Contract tabs and the flash strip.
  for (const mm of MISSIONS) {
    const t = tabEls.get(mm.id);
    const locked = state.rating < mm.unlock;
    setDisabled(t.b, locked);
    t.b.classList.toggle('locked', locked);
    t.b.classList.toggle('selected', m.id === mm.id);
    t.b.classList.toggle('live', liveIds.has(mm.id));
    setText(t.i, locked ? '—' : mm.threat);
    setText(t.small, locked ? `RATING ${mm.unlock}` : mm.code);
  }
  const fm = state.flash?.mission || null;
  ui.flashStrip.hidden = !fm;
  if (fm) {
    setText(ui.flashName, fm.name);
    setText(ui.flashCode, `${fm.code} // ${fm.recommended} // ${money(fm.payout)}`);
    ui.flashStrip.classList.toggle('selected', m.id === fm.id);
  }

  // Contract panel.
  setText(ui.cCode, m.code);
  setText(ui.cDomain, m.recommended);
  const tag = m.flash ? 'FLASH' : m.escalation < 0 ? 'STABILIZE' : '';
  ui.cTag.hidden = !tag;
  setText(ui.cTag, tag || 'STABILIZE');
  ui.cTag.classList.toggle('flash', !!m.flash);
  setText(ui.cName, m.name);
  setText(ui.cRegion, m.region);
  setText(ui.cBrief, m.brief);
  setText(ui.cThreat, `${m.threat}%`);
  setWidth(ui.cThreatBar, m.threat);
  setText(ui.cReward, money(m.payout));
  setText(ui.cIntel, `+${m.intel}`);
  setText(ui.cTrust, signed(m.trust));
  ui.cTrust.classList.toggle('bad', m.trust < 0);
  setText(ui.cRating, `+${m.rating}`);
  setText(ui.cEsc, signed(m.escalation));
  ui.cEsc.classList.toggle('good', m.escalation < 0);
  ui.cEsc.classList.toggle('bad', m.escalation > 0);

  for (const a of ASSETS) {
    const e = pickEls.get(a.id);
    e.b.hidden = state.counts[a.id] <= 0;
    setPressed(e.b, sel.asset === a.id);
    e.b.classList.toggle('match', a.domain === m.recommended);
    setText(e.em, `×${state.counts[a.id]}`);
  }
  for (const b of ui.roeButtons) setPressed(b, b.dataset.roe === sel.roe);
  for (const b of ui.intelButtons) {
    const v = Number(b.dataset.intel);
    setDisabled(b, state.intel < v);
    setPressed(b, v === sel.intel);
  }
  setText(ui.formValue, `${d.formation}×`);
  setDisabled(ui.formLess, d.formation <= 1);
  setDisabled(ui.formMore, d.formation >= Math.min(d.maxForm, d.free));
  setText(ui.mSuccess, `${d.success}%`);
  ui.mSuccess.classList.toggle('optimal', d.success >= 80);
  setText(ui.mIncident, `${d.incident}%`);
  ui.mIncident.classList.toggle('optimal', d.incident <= 10);
  setDisabled(ui.btnDeploy, !d.canDeploy);
  setText(ui.deployLabel, d.label);
  setText(ui.deployNote, `${d.intelCommit} intel committed // assets return automatically`);

  // Arsenal.
  for (const a of ASSETS) {
    const c = cardEls.get(a.id);
    const locked = state.rating < a.unlock;
    c.article.classList.toggle('selected', sel.asset === a.id);
    c.article.classList.toggle('locked', locked);
    const v = sel.asset === a.id ? 'true' : 'false';
    if (c.main.getAttribute('aria-pressed') !== v) c.main.setAttribute('aria-pressed', v);
    setText(c.ownedLabel, state.proven[a.id] ? 'PROVEN' : 'OWNED');
    setText(c.ownedCount, pad2(state.counts[a.id]));
    if (c.buy) {
      setDisabled(c.buy, locked || state.credits < a.cost);
      setText(c.buy, locked ? `RATING ${a.unlock}` : `BUY ${money(a.cost)}`);
    }
  }
  setText(ui.arsenalSelected, d.asset.name);

  if (opsDirty) buildOps();
  const key = ASSETS.map((a) => state.counts[a.id]).join(',');
  if (key !== orbitKey) {
    orbitKey = key;
    rebuildOrbit();
  }
  syncMarkers(m.id);
  setText(ui.mapCoord, `LAT ${m.lat.toFixed(3)} // LON ${m.lon.toFixed(3)}`);
  needsRender = true;
}

const opEls = [];
function buildOps() {
  opsDirty = false;
  const focusedId = ui.opsRow.contains(document.activeElement) ? document.activeElement.dataset.mission : null;
  ui.opsRow.textContent = '';
  opEls.length = 0;
  for (const op of state.active) {
    const asset = ASSET_BY_ID[op.assetId];
    const b = make('button');
    b.type = 'button';
    b.dataset.mission = op.mission.id;
    if (op.mission.flash) b.classList.add('flash');
    const who = make('span', null, `${op.units}× ${asset.code}`);
    who.style.color = asset.color;
    const bar = make('i');
    const left = make('small');
    b.append(who, make('strong', null, op.mission.name), bar, left);
    ui.opsRow.append(b);
    opEls.push({ op, b, bar, left, w: -1, s: -1 });
  }
  ui.opsRow.hidden = state.active.length === 0;
  ui.opsEmpty.hidden = state.active.length > 0;
  setText(ui.opsCount, pad2(state.active.length));
  if (focusedId) {
    const again = opEls.find((e) => e.op.mission.id === focusedId)?.b || opEls[0]?.b;
    if (again) again.focus({ preventScroll: true });
  }
}

/** Per-frame UI: countdowns and clocks, written only when they change. */
const tick = { sync: -1, feed: '', flash: -1, inquiry: -2 };
function tickUI() {
  for (const e of opEls) {
    const secs = Math.max(0, Math.ceil(e.op.remaining / 1000));
    const w = Math.max(3, Math.round((1 - e.op.remaining / e.op.duration) * 100));
    if (w !== e.w) {
      e.w = w;
      e.bar.style.width = `${w}%`;
    }
    if (secs !== e.s) {
      e.s = secs;
      e.left.textContent = `${secs}s TO REPORT`;
    }
  }
  const sync = Math.floor(state.time) % 60;
  if (sync !== tick.sync) {
    tick.sync = sync;
    ui.mapSync.textContent = pad2(sync);
  }
  const ago = state.time - feedAt;
  const feedLabel = ago < 4 ? 'NOW' : ago < 60 ? `${Math.floor(ago)}S AGO` : `${Math.floor(ago / 60)}M AGO`;
  if (feedLabel !== tick.feed) {
    tick.feed = feedLabel;
    ui.feedTime.textContent = feedLabel;
  }
  const fl = state.flash ? Math.ceil(state.flash.expires) : -1;
  if (fl !== tick.flash) {
    tick.flash = fl;
    if (fl >= 0) ui.flashTime.textContent = `${pad2(fl)}s`;
  }
  const cd = state.inquiryCd > 0 ? Math.ceil(state.inquiryCd) : 0;
  if (cd !== tick.inquiry) {
    tick.inquiry = cd;
    ui.inquiryNote.textContent = cd > 0 ? `ON RECORD // NEXT HEARING IN ${cd}s` : `${money(INQUIRY.credits)} + ${INQUIRY.intel} INTEL // +${INQUIRY.trust} TRUST −${INQUIRY.escalation} ESC`;
  }
}

/* ======================================================= feed and toasts */

function log(text, tone = '') {
  state.log.push({ t: Math.round(state.time), text, tone });
  if (state.log.length > 30) state.log.splice(0, state.log.length - 30);
}
function feed(text, tone = '') {
  setText(ui.feedText, text);
  ui.activityBand.classList.toggle('warn', tone === 'bad' || tone === 'warn');
  feedAt = state.time;
  tick.feed = '';
  log(text, tone === 'warn' ? 'bad' : tone);
}
let toastTimer = 0;
function promo(title, sub) {
  ui.promoToast.replaceChildren(document.createTextNode(title), make('small', null, sub));
  ui.promoToast.classList.add('show');
  toastTimer = 2.8;
}

/* =============================================================== actions */

function changed(save = true) {
  dirty = true;
  if (save) saveDirty = true;
}

function selectMission(id) {
  const prev = sel.mission;
  sel.mission = id;
  const m = currentMission();
  if (!m.flash) sel.lastRegular = m.id;
  // Match the capability to the contract when the current pick cannot fly it.
  const a = ASSET_BY_ID[sel.asset];
  if (!a || a.domain !== m.recommended || state.counts[a.id] <= 0) {
    const pick = ASSETS.filter((x) => x.domain === m.recommended && state.counts[x.id] > 0).sort(
      (x, y) => (freeUnits(y.id) > 0) - (freeUnits(x.id) > 0) || y.power - x.power
    )[0];
    if (pick) {
      sel.asset = pick.id;
      sel.formation = 1;
    }
  }
  aimAt(m);
  if (prev !== id) audio.play('select');
  changed(false);
}

function selectAsset(id) {
  if (!ASSET_BY_ID[id]) return;
  sel.asset = id;
  sel.formation = 1;
  audio.play('tick');
  changed(false);
}

function cycleMission(dir) {
  const list = [...(state.flash ? [state.flash.mission] : []), ...MISSIONS.filter((m) => state.rating >= m.unlock)];
  const i = list.findIndex((m) => m.id === sel.mission);
  const next = list[(i + dir + list.length) % list.length];
  if (next) selectMission(next.id);
}

function cycleAsset(dir) {
  const list = ASSETS.filter((a) => state.counts[a.id] > 0);
  const i = list.findIndex((a) => a.id === sel.asset);
  const next = list[(i + dir + list.length) % list.length];
  if (next) selectAsset(next.id);
}

function cycleRoe() {
  sel.roe = ROES[(ROES.indexOf(sel.roe) + 1) % ROES.length];
  audio.play('tick');
  changed(false);
}

function setIntel(v) {
  if (v > state.intel) {
    audio.play('deny');
    return;
  }
  sel.intel = v;
  audio.play('tick');
  changed(false);
}

function changeFormation(delta) {
  const d = derive();
  const next = clamp(d.formation + delta, 1, Math.max(1, Math.min(d.maxForm, d.free)));
  if (next === d.formation) {
    audio.play('deny');
    return;
  }
  sel.formation = next;
  audio.play('tick');
  changed(false);
}

function deploy() {
  const d = derive();
  if (!d.canDeploy) {
    audio.play('deny');
    return;
  }
  const { mission, asset } = d;
  if (asset.domain === 'STRATEGIC') {
    state.trust = Math.max(0, state.trust - 6);
    state.escalation = Math.min(100, state.escalation + 12);
  }
  if (sel.roe === 'overmatch') {
    state.trust = Math.max(0, state.trust - 2);
    state.escalation = Math.min(100, state.escalation + 5);
  }
  state.intel = Math.max(0, state.intel - d.intelCommit);
  state.active.push({
    mission,
    assetId: asset.id,
    units: d.formation,
    remaining: OP_MS,
    duration: OP_MS,
    successChance: d.success,
    incidentChance: d.incident,
    roe: sel.roe,
  });
  if (mission.flash && state.flash?.mission.id === mission.id) {
    state.flash = null;
    state.flashIn = nextFlashDelay();
  }
  feed(`${d.formation}× ${asset.shortName} deployed under ${sel.roe} protocol. Link stable.`);
  sel.intel = 0;
  sel.formation = 1;
  const mk = markerFor(mission.id);
  if (mk) mk.burst = 0.5;
  audio.play('deploy');
  input.rumble(0.35, 90);
  opsDirty = true;
  changed();
}

function buy(a) {
  if (!a || a.cost === 0) return;
  if (state.rating < a.unlock) {
    feed(`Command rating ${a.unlock} required for ${a.shortName}.`);
    audio.play('deny');
    return;
  }
  if (state.credits < a.cost) {
    feed(`${money(a.cost - state.credits)} more required to procure ${a.shortName}.`);
    audio.play('deny');
    return;
  }
  state.credits -= a.cost;
  state.counts[a.id] += 1;
  sel.asset = a.id;
  sel.formation = 1;
  feed(`${a.name} added to your remote force.`, 'good');
  audio.play('buy');
  input.rumble(0.2, 50);
  changed();
}

function inquiry() {
  if (!canInquire()) {
    audio.play('deny');
    return;
  }
  state.credits -= INQUIRY.credits;
  state.intel -= INQUIRY.intel;
  state.trust = Math.min(100, state.trust + INQUIRY.trust);
  state.escalation = Math.max(0, state.escalation - INQUIRY.escalation);
  state.inquiryCd = INQUIRY.cooldown;
  feed('Public inquiry held. Kestrel Actual answered every question on the record.', 'good');
  audio.play('inquiry');
  input.rumble(0.15, 60);
  changed();
}

function announceProgress(before, after) {
  if (rankFor(before) !== rankFor(after)) {
    promo(`PROMOTED // ${rankFor(after)}`, `COMMAND RATING ${after}`);
    audio.play('promote');
    input.rumble(0.4, 140);
    log(`Promoted to ${rankFor(after)}.`, 'good');
  }
  if (slotsFor(before) !== slotsFor(after)) log(`Control slot cleared: ${slotsFor(after)} simultaneous links.`, 'good');
  for (const a of ASSETS) if (before < a.unlock && after >= a.unlock) log(`Procurement cleared: ${a.name}.`, 'good');
  for (const m of MISSIONS) if (before < m.unlock && after >= m.unlock) log(`New contract decrypted: ${m.name}.`, 'good');
}

function resolveOp(op) {
  const m = op.mission;
  const incident = Math.random() * 100 <= op.incidentChance;
  const mk = markerFor(m.id);
  if (mk) mk.burst = 0.6;
  if (Math.random() * 100 <= op.successChance) {
    const before = state.rating;
    state.credits += m.payout;
    state.intel += m.intel;
    state.rating += m.rating;
    state.completed += 1;
    state.proven[op.assetId] = true;
    state.trust = clamp(state.trust + m.trust + (op.roe === 'restrained' ? 2 : 0) - (incident ? 5 : 0), 0, 100);
    state.escalation = clamp(state.escalation + m.escalation + (incident ? 4 : 0), 0, 100);
    if (incident) {
      feed(`${m.name} succeeded, but an autonomy incident damaged public confidence.`, 'warn');
      audio.play('incident');
      input.rumble(0.5, 160);
    } else {
      feed(`${m.name} complete. Clean handoff; ${money(m.payout)} transferred.`, 'good');
      audio.play('success');
      input.rumble(0.25, 70);
    }
    announceProgress(before, state.rating);
  } else {
    state.intel = Math.max(0, state.intel - 2);
    state.trust = Math.max(0, state.trust - 3);
    state.escalation = Math.min(100, state.escalation + 3);
    feed(`${m.name} was aborted. No assets lost, but confidence fell.`, 'bad');
    audio.play('fail');
    input.rumble(0.6, 200);
  }
}

/* ============================================================ simulation */

const nextFlashDelay = () => 60 + Math.random() * 50;

function spawnFlash() {
  const domains = [...new Set(ASSETS.filter((a) => state.counts[a.id] > 0).map((a) => a.domain))];
  const domain = domains[Math.floor(Math.random() * domains.length)] || 'AIR';
  const pool = FLASH_TEMPLATES[domain];
  const tpl = pool[Math.floor(Math.random() * pool.length)];
  let lat = 0;
  let lon = 0;
  for (let tries = 0; tries < 14; tries++) {
    lat = Math.round(-48 + Math.random() * 110);
    lon = Math.round(-180 + Math.random() * 360);
    if (MISSIONS.every((mm) => angularDistance(lat, lon, mm.lat, mm.lon) > 16)) break;
  }
  const r = state.rating;
  state.flashSeq += 1;
  const mission = {
    id: `flash-${state.flashSeq}`,
    flash: true,
    name: tpl.name,
    code: `FLASH ${pad2(state.flashSeq % 100)}-${domain[0]}`,
    region: tpl.region,
    brief: tpl.brief,
    threat: Math.round(clamp(16 + r * 1.05 + Math.random() * 12, 16, 84)),
    payout: Math.round(((8000 + r * 2600) * (1.35 + Math.random() * 0.3)) / 500) * 500,
    intel: 4 + Math.floor(Math.random() * 5),
    rating: 2 + Math.floor(r / 15),
    trust: tpl.trust,
    escalation: tpl.escalation,
    recommended: domain,
    unlock: 0,
    lat,
    lon,
  };
  state.flash = { mission, expires: FLASH_LIFE };
  feed(`FLASH: ${mission.name} // ${mission.region}. ${domain} capability requested.`, 'warn');
  audio.play('flash');
  input.rumble(0.2, 60);
  changed();
}

function simulate(dt) {
  state.time += dt;
  const ms = dt * 1000;
  let done = null;
  for (const op of state.active) {
    op.remaining -= ms;
    if (op.remaining <= 0) (done ||= []).push(op);
  }
  if (done) {
    state.active = state.active.filter((op) => op.remaining > 0);
    for (const op of done) resolveOp(op);
    opsDirty = true;
    changed();
  }

  // Flash contracts: one at a time, once the first contract is in.
  if (state.flash) {
    state.flash.expires -= dt;
    if (state.flash.expires <= 0) {
      const m = state.flash.mission;
      state.flash = null;
      state.flashIn = nextFlashDelay();
      feed(`Flash contract ${m.name} lapsed. Another operator took the call.`);
      changed();
    }
  } else if (state.rating >= 3 && !state.active.some((op) => op.mission.flash)) {
    state.flashIn -= dt;
    if (state.flashIn <= 0) spawnFlash();
  }

  // Quiet time cools escalation (down to the terms' baseline) and mends low trust, so a bad
  // run can always be recovered instead of locking the mandate forever.
  const terms = TERMS[state.terms] || TERMS.standard;
  state.calmT += dt;
  if (state.calmT >= 12 / terms.recovery) {
    state.calmT = 0;
    const hot = state.active.some((op) => op.roe === 'overmatch' || ASSET_BY_ID[op.assetId].domain === 'STRATEGIC');
    if (!hot && state.escalation > terms.escalation) {
      state.escalation -= 1;
      changed();
    }
  }
  state.mendT += dt;
  if (state.mendT >= 15 / terms.recovery) {
    state.mendT = 0;
    if (state.trust < 40) {
      state.trust += 1;
      changed();
    }
  }
  if (state.inquiryCd > 0) {
    state.inquiryCd = Math.max(0, state.inquiryCd - dt);
    if (state.inquiryCd === 0) changed(false);
  }
  checkVictory();
}

function checkVictory() {
  if (state.victoryDismissed || stack.includes('victory') || !victoryMet()) return;
  if (!state.victoryAt) {
    state.victoryAt = Math.max(1, Math.round(state.time));
    const best = readJSON(BEST_KEY) || {};
    const prev = best[state.terms];
    if (!(prev > 0) || state.victoryAt < prev) {
      best[state.terms] = state.victoryAt;
      writeJSON(BEST_KEY, best);
    }
    saveDirty = true;
  }
  const good = state.trust >= 60 && state.escalation <= 45;
  setText(ui.victoryTitle, good ? 'SUSTAINABLE COMMAND' : 'PYRRHIC DETERRENCE');
  setText(ui.vRating, state.rating);
  setText(ui.vContracts, state.completed);
  setText(ui.vTrust, `${state.trust}%`);
  setText(ui.vEsc, `${state.escalation}%`);
  const best = (readJSON(BEST_KEY) || {})[state.terms];
  ui.vTime.replaceChildren(
    `NETWORK COMPLETE IN `,
    make('b', null, clockText(state.victoryAt)),
    ` // ${(TERMS[state.terms] || TERMS.standard).name} TERMS // BEST `,
    make('b', null, best > 0 ? clockText(best) : '--:--')
  );
  openModal('victory');
  audio.play('promote');
  input.rumble(0.6, 300);
}

/* ============================================================== campaign */

function newCampaign(termsId) {
  state = freshState(termsId);
  sel.mission = sel.lastRegular = MISSIONS[0].id;
  sel.asset = 'kestrel';
  sel.roe = 'standard';
  sel.intel = 0;
  sel.formation = 1;
  campaignLive = true;
  opsDirty = true;
  feed(termsMode === 'begin' ? 'New encrypted contract received. Select an operation to begin.' : 'Contract record reset. Kestrel Actual is back on the line.');
  changed();
  saveNow();
}

function saveNow() {
  if (!campaignLive) return;
  writeJSON(SAVE_KEY, serialize());
  saveDirty = false;
  saveClock = 0;
}
function autosave(dt) {
  if (!campaignLive) return;
  saveClock += dt;
  if ((saveDirty && saveClock > 1) || ((state.active.length || state.flash) && saveClock > 5)) saveNow();
}
addEventListener('pagehide', saveNow);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) saveNow();
});

/* ================================================================ modals */

const MODALS = { title: $('titleModal'), briefing: $('briefingModal'), terms: $('termsModal'), pause: $('pauseModal'), victory: $('victoryModal') };
const stack = [];
const returnFocus = [];
const isShown = (el) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
};

function syncInert() {
  shell.inert = stack.length > 0;
  const top = stack[stack.length - 1];
  for (const [name, el] of Object.entries(MODALS)) el.inert = !el.hidden && name !== top;
}

function openModal(name) {
  if (stack.includes(name)) return;
  const active = document.activeElement;
  returnFocus.push(active instanceof HTMLElement && active !== document.body ? active : null);
  stack.push(name);
  MODALS[name].hidden = false;
  syncInert();
  const target = [...MODALS[name].querySelectorAll('[data-autofocus]')].find((b) => !b.disabled && isShown(b)) || firstButton(MODALS[name]);
  target?.focus({ preventScroll: true });
  ui.globeTip.hidden = true;
  input.settle();
}

function closeModal(name) {
  const i = stack.indexOf(name);
  if (i < 0) return;
  stack.splice(i, 1);
  const back = returnFocus.splice(i, 1)[0];
  MODALS[name].hidden = true;
  syncInert();
  if (back && back.isConnected && !back.closest('[inert]') && isShown(back) && !back.disabled) back.focus({ preventScroll: true });
  input.settle();
  needsRender = true;
}

/** Escape / B / the close button: close the top modal if it may be closed. */
function dismissTop() {
  const top = stack[stack.length - 1];
  if (!top || top === 'title') return false;
  if (top === 'victory') {
    state.victoryDismissed = true;
    changed();
  }
  closeModal(top);
  audio.play('tick');
  return true;
}

function openTitle() {
  const hasSave = !!saved;
  if (hasSave) {
    ui.titleSave.replaceChildren(
      'CAMPAIGN ON FILE // RATING ',
      make('b', null, String(state.rating)),
      ' // ',
      make('b', null, String(state.completed)),
      ` CONTRACTS // ${(TERMS[state.terms] || TERMS.standard).name} TERMS // ${clockText(state.time)}`
    );
  } else ui.titleSave.textContent = 'NO CAMPAIGN ON FILE // KESTREL ACTUAL STANDING BY';
  ui.titleContinue.textContent = hasSave ? 'CONTINUE CAMPAIGN' : 'BEGIN CAMPAIGN';
  ui.titleNew.hidden = !hasSave;
  ui.titleFoot.textContent = `${kit.backendLabel.toUpperCase()} // THREE.JS R${THREE.REVISION} // EARTH-77 LINK READY`;
  openModal('title');
}

function openTerms(mode) {
  termsMode = mode;
  termsChoice = TERMS[state.terms] ? state.terms : 'standard';
  if (mode === 'begin') {
    setText(ui.termsKicker, 'CONTRACT TERMS');
    setText(ui.termsTitle, 'CHOOSE YOUR TERMS');
    setText(ui.termsText, 'Pick how forgiving Earth-77 will be. Terms hold for the whole campaign.');
    setText(ui.termsConfirm, 'BEGIN CAMPAIGN');
    ui.termsConfirm.className = 'go';
  } else {
    setText(ui.termsKicker, 'ARCHIVE CONTROL');
    setText(ui.termsTitle, 'RESET THE CONTRACT?');
    setText(ui.termsText, 'This clears your locally saved force, rating, and campaign progress. Earth-77 will return to day one.');
    setText(ui.termsConfirm, 'RESET CAMPAIGN');
    ui.termsConfirm.className = 'danger';
  }
  for (const [id, b] of termEls) setPressed(b, id === termsChoice);
  // A reset starts on CANCEL (as the original did), so a stray confirm never wipes a campaign.
  ui.termsConfirm.toggleAttribute('data-autofocus', mode === 'begin');
  $('termsCancel').toggleAttribute('data-autofocus', mode !== 'begin');
  openModal('terms');
}

function openPause() {
  if (!campaignLive || stack.length) return;
  setText(ui.pauseTime, clockText(state.time));
  setText(ui.pauseTerms, (TERMS[state.terms] || TERMS.standard).name);
  const best = (readJSON(BEST_KEY) || {})[state.terms];
  setText(ui.pauseBest, best > 0 ? clockText(best) : '--:--');
  syncSoundButton();
  const items = state.log.slice(-10).reverse().map((l) => {
    const li = make('li', l.tone || null);
    li.append(make('time', null, clockText(l.t)), make('span', null, l.text));
    return li;
  });
  if (!items.length) items.push(make('li', null, 'No traffic yet.'));
  ui.trafficLog.replaceChildren(...items);
  openModal('pause');
  audio.play('tick');
}

function syncSoundButton() {
  setText(ui.pauseSound, audio.muted ? 'SOUND: OFF' : 'SOUND: ON');
  ui.pauseSound.setAttribute('aria-pressed', audio.muted ? 'false' : 'true');
}
function toggleMute() {
  audio.setMuted(!audio.muted);
  syncSoundButton();
  audio.play('tick');
  kit.toast?.(audio.muted ? 'Sound off' : 'Sound on');
}

/* ======================================================= focus navigation */

const NAV_SEL = 'button:not([disabled])';
const navScope = () => (stack.length ? MODALS[stack[stack.length - 1]] : shell);
function firstButton(scope) {
  for (const b of scope.querySelectorAll(NAV_SEL)) if (isShown(b)) return b;
  return null;
}
function focusEl(el) {
  el.focus({ preventScroll: true, focusVisible: true });
  if (input.source === 'gamepad') el.classList.add('pad-focus');
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  audio.play('tick');
}
document.addEventListener('focusout', (e) => e.target?.classList?.remove('pad-focus'));

function focusDefault(scope) {
  let el = null;
  if (scope === shell) {
    el = [ui.btnDeploy, ui.missionTabs.querySelector('button.selected'), ui.flashStrip].find((b) => b && !b.disabled && !b.hidden && isShown(b));
  } else {
    el = [...scope.querySelectorAll('[data-autofocus]')].find((b) => !b.disabled && isShown(b));
  }
  el ||= firstButton(scope);
  if (el) focusEl(el);
}

/** Spatial navigation: the nearest enabled button in that direction, by edge distance. */
function navMove(dir) {
  const scope = navScope();
  const cur = document.activeElement;
  if (!cur || cur === document.body || !scope.contains(cur) || !cur.matches(NAV_SEL) || !isShown(cur)) {
    focusDefault(scope);
    return;
  }
  const r0 = cur.getBoundingClientRect();
  const cx = (r0.left + r0.right) / 2;
  const cy = (r0.top + r0.bottom) / 2;
  const vertical = dir === 'up' || dir === 'down';
  const sign = dir === 'up' || dir === 'left' ? -1 : 1;
  let best = null;
  let bestScore = Infinity;
  for (const b of scope.querySelectorAll(NAV_SEL)) {
    if (b === cur) continue;
    const r = b.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const bx = (r.left + r.right) / 2;
    const by = (r.top + r.bottom) / 2;
    if ((vertical ? by - cy : bx - cx) * sign <= 4) continue;
    const gap = vertical ? (sign > 0 ? r.top - r0.bottom : r0.top - r.bottom) : sign > 0 ? r.left - r0.right : r0.left - r.right;
    const across = vertical
      ? Math.max(0, Math.max(r.left, r0.left) - Math.min(r.right, r0.right))
      : Math.max(0, Math.max(r.top, r0.top) - Math.min(r.bottom, r0.bottom));
    const score = Math.max(0, gap) + across * 3 + (across > 0 ? 40 : 0) + Math.abs(vertical ? bx - cx : by - cy) * 0.05;
    if (score < bestScore) {
      bestScore = score;
      best = b;
    }
  }
  if (best) focusEl(best);
}

function pressFocused() {
  const scope = navScope();
  const el = document.activeElement;
  if (el && el !== document.body && scope.contains(el) && el.matches(NAV_SEL)) {
    el.click();
    return;
  }
  focusDefault(scope);
}

const NAV_DIRS = [
  ['navUp', 'up'],
  ['navDown', 'down'],
  ['navLeft', 'left'],
  ['navRight', 'right'],
];
const navRepeat = { dir: null, at: 0 };
function navInput() {
  const now = performance.now();
  let dir = null;
  for (const [name, d] of NAV_DIRS) {
    if (input.pressed(name)) {
      navMove(d);
      navRepeat.dir = d;
      navRepeat.at = now + 380;
      return;
    }
    if (input.down(name)) dir = d;
  }
  const v = input.vector('stick');
  if (!dir && Math.hypot(v.x, v.y) > 0.6) dir = Math.abs(v.x) > Math.abs(v.y) ? (v.x > 0 ? 'right' : 'left') : v.y > 0 ? 'up' : 'down';
  if (!dir) {
    navRepeat.dir = null;
    return;
  }
  if (dir !== navRepeat.dir) {
    navRepeat.dir = dir;
    navRepeat.at = now + 380;
    navMove(dir);
  } else if (now >= navRepeat.at) {
    navRepeat.at = now + 130;
    navMove(dir);
  }
}

/* ================================================================ prompts */

const PROMPTS = {
  keyboard: {
    title: 'CONTROLS // KEYBOARD & MOUSE',
    hint: 'F DEPLOY · Q/E CONTRACT · Z/C CAPABILITY · ESC PAUSE',
    rows: [
      ['Contract', 'Q / E'], ['Capability', 'Z / C'], ['Protocol', 'R'], ['Commit intel', '0 – 3'],
      ['Formation', '− / +'], ['Deploy', 'F'], ['Buy selected', 'B'], ['Public inquiry', 'I'],
      ['Move focus', 'ARROWS / WASD'], ['Press focused', 'ENTER / SPACE'], ['Spin globe', 'DRAG'], ['Select signal', 'CLICK'],
      ['Pause', 'ESC / P'], ['Briefing', 'H'], ['Sound', 'M'], ['Settings', 'F9'],
    ],
  },
  gamepad: {
    title: 'CONTROLS // GAMEPAD',
    hint: 'X DEPLOY · LB/RB CONTRACT · LT/RT CAPABILITY · START PAUSE',
    rows: [
      ['Move focus', 'D-PAD / L-STICK'], ['Press focused', 'A'], ['Back', 'B'], ['Deploy', 'X'],
      ['Protocol', 'Y'], ['Contract', 'LB / RB'], ['Capability', 'LT / RT'], ['Spin globe', 'R-STICK'],
      ['Pause', 'START'], ['Briefing', 'VIEW / BACK'],
    ],
  },
  touch: {
    title: 'CONTROLS // TOUCH',
    hint: 'TAP A SIGNAL · DRAG THE GLOBE SIDEWAYS TO SPIN',
    rows: [
      ['Select contract', 'TAP SIGNAL / TAB'], ['Spin globe', 'DRAG SIDEWAYS'], ['Deploy', 'DEPLOY BUTTON'],
      ['Scroll dashboard', 'SWIPE UP / DOWN'], ['Pause', 'PAUSE (CORNER)'], ['Settings', 'SETTINGS (CORNER)'],
    ],
  },
};
let promptSource = touchOnly ? 'touch' : input.source;
function applyPrompts() {
  const p = PROMPTS[promptSource] || PROMPTS.keyboard;
  setText(ui.controlHint, p.hint);
  setText(ui.controlsTitle, p.title);
  ui.controlsList.replaceChildren(
    ...p.rows.map(([k, v]) => {
      const div = make('div');
      div.append(make('span', null, k), make('kbd', null, v));
      return div;
    })
  );
}
input.onSourceChange((src) => {
  promptSource = src;
  applyPrompts();
});
// Taps on DOM buttons never reach the canvas, so the kit cannot see them: switch prompts here.
addEventListener(
  'pointerdown',
  (e) => {
    const src = e.pointerType === 'touch' ? 'touch' : e.pointerType === 'mouse' ? 'keyboard' : null;
    if (!src || src === promptSource) return;
    promptSource = src;
    if (src === 'touch' && input.source !== 'gamepad') input.source = 'touch'; // phone haptics follow touch
    applyPrompts();
  },
  true
);
applyPrompts();

/* ================================================================ wiring */

ui.missionTabs.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-mission]');
  if (b && !b.disabled) selectMission(b.dataset.mission);
});
ui.flashStrip.addEventListener('click', () => state.flash && selectMission(state.flash.mission.id));
ui.opsRow.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-mission]');
  if (b) selectMission(b.dataset.mission);
});
ui.assetSelector.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-asset]');
  if (b) selectAsset(b.dataset.asset);
});
ui.arsenal.addEventListener('click', (e) => {
  const buyBtn = e.target.closest('button[data-buy]');
  if (buyBtn) {
    buy(ASSET_BY_ID[buyBtn.dataset.buy]);
    return;
  }
  const main = e.target.closest('button[data-asset]');
  if (main) selectAsset(main.dataset.asset);
});
for (const b of ui.roeButtons)
  b.addEventListener('click', () => {
    sel.roe = b.dataset.roe;
    audio.play('tick');
    changed(false);
  });
for (const b of ui.intelButtons) b.addEventListener('click', () => setIntel(Number(b.dataset.intel)));
ui.formLess.addEventListener('click', () => changeFormation(-1));
ui.formMore.addEventListener('click', () => changeFormation(1));
ui.btnDeploy.addEventListener('click', deploy);
ui.btnInquiry.addEventListener('click', inquiry);

$('btnPause').addEventListener('click', openPause);
$('btnBriefing').addEventListener('click', () => openModal('briefing'));
$('btnSettings').addEventListener('click', () => kit.menu.open());
$('btnReset').addEventListener('click', () => openTerms('reset'));
for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => closeModal(b.dataset.close));

ui.titleContinue.addEventListener('click', () => {
  if (saved) {
    campaignLive = true;
    closeModal('title');
    feed(`Link restored. ${state.active.length ? `${state.active.length} active link${state.active.length > 1 ? 's' : ''} resumed.` : 'Kestrel Actual is back on the line.'}`);
    changed();
  } else openTerms('begin');
});
ui.titleNew.addEventListener('click', () => openTerms('reset'));
$('titleBriefing').addEventListener('click', () => openModal('briefing'));
$('titleSettings').addEventListener('click', () => kit.menu.open());

ui.termsGrid.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-terms]');
  if (!b) return;
  termsChoice = b.dataset.terms;
  for (const [id, el] of termEls) setPressed(el, id === termsChoice);
  audio.play('tick');
});
ui.termsConfirm.addEventListener('click', () => {
  const firstTime = termsMode === 'begin';
  newCampaign(termsChoice);
  for (const name of ['terms', 'victory', 'pause', 'title']) closeModal(name);
  audio.play('deploy');
  if (firstTime) openModal('briefing');
});

$('pauseBriefing').addEventListener('click', () => openModal('briefing'));
$('pauseSettings').addEventListener('click', () => kit.menu.open());
ui.pauseSound.addEventListener('click', toggleMute);
$('pauseReset').addEventListener('click', () => openTerms('reset'));
$('victoryContinue').addEventListener('click', () => {
  state.victoryDismissed = true;
  closeModal('victory');
  changed();
});
$('victoryNew').addEventListener('click', () => openTerms('reset'));

/* ============================================================ input loop */

function handleInput() {
  if (input.pressed('mute')) toggleMute();
  if (input.pressed('pause')) {
    if (stack.length) dismissTop();
    else openPause();
  } else if (input.pressed('back')) {
    if (stack.length) dismissTop();
    else if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  }
  navInput();
  if (input.pressed('confirm')) pressFocused();
  if (stack.length || !campaignLive) return;
  if (input.pressed('briefing')) {
    openModal('briefing');
    return;
  }
  if (input.pressed('deploy')) deploy();
  if (input.pressed('protocol')) cycleRoe();
  if (input.pressed('prevMission')) cycleMission(-1);
  if (input.pressed('nextMission')) cycleMission(1);
  if (input.pressed('prevAsset')) cycleAsset(-1);
  if (input.pressed('nextAsset')) cycleAsset(1);
  if (input.pressed('formLess')) changeFormation(-1);
  if (input.pressed('formMore')) changeFormation(1);
  for (let i = 0; i < 4; i++) if (input.pressed(`intel${i}`)) setIntel(i);
  if (input.pressed('buy')) buy(ASSET_BY_ID[sel.asset]);
  if (input.pressed('inquiry')) inquiry();
}

/* ========================================================= globe update */

const press = { on: false, x: 0, y: 0, moved: 0, cancelled: false };
kit.canvas.addEventListener('pointercancel', () => {
  press.cancelled = true; // the page took the gesture (a scroll): not a tap
});
const tipState = { id: null, flash: -1, x: -1, y: -1, flip: false };

function updateGlobe(dt, t) {
  const interactive = stack.length === 0 && campaignLive;
  const p = input.pointer;
  let hovered = null;

  if (interactive) {
    const lk = input.look('look');
    if (lk.x || lk.y) {
      const f = input.source === 'gamepad' ? 0.6 : input.source === 'touch' ? 0.8 : 1.3;
      view.tYaw += lk.x * f;
      view.tPitch = clamp(view.tPitch + lk.y * f * 0.8, -0.7, 0.8);
      view.dragging = 0.25;
    }
    if (p.justDown) Object.assign(press, { on: true, x: p.x, y: p.y, moved: 0, cancelled: false });
    if (press.on && p.down) press.moved = Math.max(press.moved, Math.hypot(p.x - press.x, p.y - press.y));
    if (p.justUp && press.on) {
      press.on = false;
      if (!press.cancelled && press.moved < 8) {
        scene.updateMatrixWorld();
        const mk = pickMarker(p.x, p.y, p.type === 'touch' ? 34 : 22);
        if (mk) selectMission(mk.mission.id);
      }
    }
    if (p.over && !p.down && p.type === 'mouse') hovered = pickMarker(p.x, p.y, 22);
    const cursor = p.down && press.moved >= 8 ? 'grabbing' : hovered ? 'pointer' : 'grab';
    if (kit.canvas.style.cursor !== cursor) kit.canvas.style.cursor = cursor;
  } else press.on = false;

  view.dragging = Math.max(0, view.dragging - dt);
  const k = 1 - Math.exp(-(view.dragging > 0 ? 12 : 3.2) * dt);
  view.yaw += (view.tYaw - view.yaw) * k;
  view.pitch += (view.tPitch - view.pitch) * k;
  globe.rotation.set(view.pitch, view.yaw + Math.sin(t * 0.09) * 0.05, -0.08);
  orbit.rotation.y += dt * 0.06;

  const selectedId = sel.mission;
  let selMk = null;
  let flashMk = null;
  for (const mk of markers) {
    const m = mk.mission;
    if (!m) continue;
    const selected = m.id === selectedId;
    if (selected) selMk = mk;
    if (m.flash) flashMk = mk;
    let s = (selected ? 1.45 : 1) * (1 + Math.sin(t * (m.flash ? 6.4 : 3.2) + m.threat) * 0.16);
    if (mk.burst > 0) {
      mk.burst = Math.max(0, mk.burst - dt);
      s *= 1 + mk.burst * 1.6;
    }
    mk.mesh.scale.setScalar(s);
  }
  ringSelect.visible = !!selMk;
  if (selMk) {
    ringSelect.position.copy(selMk.normal).multiplyScalar(2.53);
    ringSelect.quaternion.copy(selMk.align).multiply(_spin.setFromAxisAngle(ZAXIS, t * 0.8));
    ringSelect.scale.setScalar(1 + Math.sin(t * 3.2) * 0.06);
  }
  ringFlash.visible = !!flashMk && !!state.flash;
  if (ringFlash.visible) {
    const ping = (t * 0.9) % 1;
    ringFlash.position.copy(flashMk.normal).multiplyScalar(2.53);
    ringFlash.quaternion.copy(flashMk.align);
    ringFlash.scale.setScalar(0.6 + ping * 1.8);
    ringFlash.material.opacity = 0.85 * (1 - ping);
  }
  for (const b of beams) if (b.visible) b.scale.set(1, 0.42 + Math.sin(t * 7 + b.position.x * 5) * 0.08, 1);

  // Label on the hovered signal, or on the selected one.
  const tipMk = interactive ? hovered || selMk : null;
  let shown = false;
  if (tipMk) {
    globe.updateMatrixWorld();
    if (markerScreen(tipMk, _scr)) {
      shown = true;
      const m = tipMk.mission;
      const live = state.active.some((op) => op.mission.id === m.id);
      const fl = m.flash && state.flash?.mission.id === m.id ? Math.ceil(state.flash.expires) : -1;
      if (tipState.id !== m.id || tipState.flash !== fl || tipState.live !== live) {
        tipState.id = m.id;
        tipState.flash = fl;
        tipState.live = live;
        ui.globeTipName.textContent = m.name;
        ui.globeTipCode.textContent = live ? 'LINK ACTIVE' : fl >= 0 ? `FLASH // ${fl}s // ${m.recommended}` : `${m.code} // ${m.recommended}`;
        ui.globeTip.classList.toggle('flash', !!m.flash);
      }
      const x = Math.round(_scr.x);
      const y = Math.round(_scr.y);
      const flip = x > kit.size.width - 170;
      if (x !== tipState.x || y !== tipState.y || flip !== tipState.flip) {
        tipState.x = x;
        tipState.y = y;
        tipState.flip = flip;
        ui.globeTip.style.transform = `translate(${x}px, ${y}px) translate(${flip ? 'calc(-100% - 14px)' : '14px'}, -130%)`;
      }
    }
  }
  if (ui.globeTip.hidden === shown) ui.globeTip.hidden = !shown;
}

/* ================================================================= start */

kit.onResize(() => {
  needsRender = true;
});
let mapVisible = true;
if ('IntersectionObserver' in window) {
  new IntersectionObserver((entries) => {
    mapVisible = entries[entries.length - 1].isIntersecting;
    if (mapVisible) needsRender = true;
  }).observe(mapEl);
}

// First paint with every marker material and effect in view, so no shader compiles mid-game.
render();
markers.forEach((mk, i) => {
  placeMarker(mk, MISSIONS[i % MISSIONS.length]);
  mk.mesh.visible = true;
  mk.mesh.material = Object.values(markerMats)[i % 4];
});
ringSelect.visible = ringFlash.visible = true;
for (const b of beams) b.visible = true;
kit.loading.progress(0.9, 'Compiling the theatre…');
try {
  await kit.renderer.compileAsync(scene, camera);
} catch {
  /* compiling ahead is only an optimisation */
}
kit.renderer.render(scene, camera);
for (const b of beams) b.visible = false;
render();
feedAt = state.time;
if (saved) setText(ui.feedText, state.log.length ? state.log[state.log.length - 1].text : 'Link restored.');
openTitle();

kit.start((dt, t) => {
  handleInput();
  if (campaignLive && stack.length === 0) simulate(dt);
  if (dirty) {
    dirty = false;
    render();
  }
  tickUI();
  updateGlobe(dt, t);
  if ((mapVisible && stack.length === 0) || needsRender) {
    needsRender = false;
    kit.renderer.render(scene, camera);
  }
  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) ui.promoToast.classList.remove('show');
  }
  autosave(dt);
});
