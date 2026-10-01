/* GUNHAND: Midnight Repossession — game logic, HUD and menus.
   Original game, ported onto the shared 3D stack: the faceted craft are three.js meshes
   (gfx.js), input comes from kit actions, and the DOM HUD is unchanged in spirit. */

import * as THREE from 'three/webgpu';
import { boot } from 'kit/boot.js';
import { buildModels, colors } from './models.js';
import { createGfx, col, Z, ORDER } from './gfx.js';
import { Synth } from './audio.js';

// Canvas colours are raw sRGB numbers; keep three.js from converting them.
THREE.ColorManagement.enabled = false;

const W = 1440, H = 810, TAU = Math.PI * 2;
const $ = (id) => document.getElementById(id);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const dist = (a, b, c, d) => Math.hypot(a - c, b - d);

/* ------------------------------------------------------------------ storage */

const store = {
  get(k, fallback = null) {
    try {
      const v = localStorage.getItem(k);
      return v === null ? fallback : v;
    } catch {
      return fallback;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, String(v));
    } catch {
      /* private mode: progress lasts for this visit only */
    }
  },
  del(k) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
  json(k) {
    try {
      return JSON.parse(localStorage.getItem(k) || 'null');
    } catch {
      return null;
    }
  },
};

const bestKey = (op, d) => (op === 1 ? `gunhand_best_${d}` : `gunhand_best_op${op}_${d}`);
const timeKey = (op, d) => `gunhand_time_op${op}_${d}`;
const getBest = (op, d) => Number(store.get(bestKey(op, d))) || 0;
const getBestTime = (op, d) => Number(store.get(timeKey(op, d))) || 0;

const prefs = Object.assign({ difficulty: 'arcade', autoFire: true, shake: true, scan: true, volume: 45, sound: true, op: 1 }, store.json('gunhand_prefs') || {});
if (prefs.difficulty !== 'story') prefs.difficulty = 'arcade';
prefs.volume = clamp(Number(prefs.volume) || 0, 0, 100);
let unlocked = clamp(Number(store.get('gunhand_unlocked')) || 1, 1, 2);
if (prefs.op !== 2 || unlocked < 2) prefs.op = 1;
const savePrefs = () => store.set('gunhand_prefs', JSON.stringify(prefs));

function readSave() {
  const s = store.json('gunhand_save');
  if (!s || (s.op !== 1 && s.op !== 2) || !(s.cp > 0)) return null;
  if (s.op === 2 && unlocked < 2) return null;
  return { op: s.op, cp: Number(s.cp), difficulty: s.difficulty === 'story' ? 'story' : 'arcade' };
}

/* ------------------------------------------------------------------ DOM */

const UI = {};
[
  'shell', 'stage', 'uiRoot', 'scanlines', 'titleScreen', 'hud', 'manualScreen', 'pauseScreen', 'resultScreen', 'hullBars', 'reserveText', 'scoreText',
  'bestText', 'flightModeText', 'stageName', 'sectorLabel', 'progressTrack', 'progressFill', 'weaponText', 'ammoText', 'ammoFill', 'armText', 'weaponHint', 'empText',
  'autoText', 'comboText', 'comboFill', 'bossHud', 'bossName', 'bossPhase', 'bossFill', 'bossDetail', 'toast', 'toastTitle', 'toastSub', 'radio',
  'radioName', 'radioText', 'missionCard', 'chapterText', 'chapterTitle', 'chapterSub', 'warning', 'warningSub', 'startButton', 'continueButton',
  'manualButton', 'storyButton', 'arcadeButton', 'modeHint', 'op1Button', 'op2Button', 'opHint', 'opCode', 'opTitle', 'opTag', 'opRecord',
  'titleLocation', 'titleClock', 'closeManual', 'controlsList', 'controlsSource', 'autoOption', 'shakeOption', 'scanOption', 'volumeOption',
  'resumeButton', 'restartButton', 'pauseManualButton', 'pauseSettingsButton', 'exitButton', 'resultEyebrow', 'resultTitle', 'resultMessage',
  'rankLabel', 'rankText', 'resultScore', 'resultBest', 'resultTimeLabel', 'resultKills', 'resultSalvage', 'retryButton', 'nextOpButton',
  'resultExitButton', 'resultCopy', 'soundButton', 'fullButton', 'settingsButton', 'statusText', 'versionText', 'empKey', 'autoKey', 'pauseKey',
].forEach((id) => (UI[id] = $(id)));

/* ------------------------------------------------------------------ boot */

const kit = await boot({
  title: 'GUNHAND — Midnight Repossession',
  mount: UI.stage,
  gear: 'none', // SETTINGS lives in the top bar and the pause menu
  accent: '#ff7844',
  background: '#090e12',
  touch: { top: 'center', topOffset: 8 },
  input: {
    move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick' },
    pod: { keys: ['KeyK', 'KeyX'], mouse: [2], gamepad: ['B', 'RB'], touch: 'Pod' },
    fire: { keys: ['Space', 'KeyJ'], mouse: [0], gamepad: ['A', 'RT'], touch: 'Fire' },
    flip: { keys: ['KeyQ'], gamepad: ['X'], touch: 'Flip' },
    emp: { keys: ['KeyE'], gamepad: ['Y'], touch: 'EMP' },
    focus: { keys: ['ShiftLeft', 'ShiftRight'], gamepad: ['LT'] },
    auto: { keys: ['KeyT'], gamepad: ['Back'] },
    pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'], touch: { label: 'II', slot: 'top' } },
    confirm: { keys: ['Enter', 'NumpadEnter'], gamepad: ['A'] },
    back: { keys: ['Backspace'], gamepad: ['B'] },
    sound: { keys: ['KeyM'] },
    full: { keys: ['KeyF'] },
  },
});
const input = kit.input;
kit.loading.progress(0.7, 'Painting Nocturne City…');
const gfx = createGfx(kit, { W, H, models: buildModels() });
const F = gfx.L;
const audio = new Synth();

/* ------------------------------------------------------------------ state */

let state = 'title';
let difficulty = prefs.difficulty;
let soundOn = prefs.sound !== false;
let autoFire = prefs.autoFire !== false;
let shakeOn = prefs.shake !== false;
let manualOrigin = 'title';
let visualTime = 0;
let accumulator = 0;
let uiClock = 0;
let bestNow = 0;
let menuLock = 0;
let warmup = true;
let opId = prefs.op;

const G = {
  t: 0, time: 0, scroll: 0, score: 0, chain: 0, chainTime: 0, mult: 1, kills: 0, pods: 0, secrets: 0, deaths: 0, shots: 0, hits: 0, emp: 2,
  checkpoint: 0, events: 0, miniSpawned: false, miniDone: false, bossSpawned: false, bossDead: false, phase: 0, shake: 0, damage: 0, white: 0,
  toastTimer: 0, radioTimer: 0, chapterTimer: 0, warningTimer: 0, endTimer: 0, won: false, bonusGiven: false, respawn: 0,
};
const P = { x: 250, y: 400, vx: 0, vy: 0, hp: 3, maxhp: 3, reserve: 2, inv: 0, arm: 1, armPose: 1, gun: 'RAPID', ammo: 180, maxAmmo: 180, fire: 0, podFire: 0, tilt: 0, focus: false, alive: true };
let enemies = [], bullets = [], shots = [], pickups = [], particles = [], rings = [], floats = [];
const PODS = { RAPID: { ammo: 240, color: '#f6bc64', rate: 0.078, damage: 1.7 }, LANCE: { ammo: 72, color: '#8cf2e1', rate: 0.22, damage: 7.5 }, SWARM: { ammo: 54, color: '#cfadff', rate: 0.29, damage: 6 } };
const pointer = { active: false, x: 250, y: 400, lastX: 0, lastY: 0 };
const MAX_PARTICLES = kit.detail(750, 200);

/* ------------------------------------------------------------------ operations */

const OPS = [
  {
    id: 1, code: '01', title: 'NEON DESCENT', tag: 'CITY RAID', location: 'NOCTURNE CITY', clock: '03:17 / LOCAL',
    sectors: ['NEON DESCENT', 'FREIGHT CORRIDOR', 'THE COLLECTION'], firstSub: 'NOCTURNE CITY / LOWER AIRSPACE',
    cpNames: ['City entry', 'Freight corridor', 'Final boss'], midCP: 36, bossCP: 90, bossT: 90, phase1T: 37, phase2T: 64, length: 90,
    bossWarn: 'DEBT COLLECTOR / FINAL CHECKPOINT',
    waves: [
      { t: 3, f: () => formation(300, 3) },
      { t: 6.7, f: () => formation(460, 4) },
      { t: 10, f: () => spawn('carrier', 266, { pod: 'LANCE' }) },
      { t: 13, f: () => formation(240, 4) },
      { t: 16, f: () => { ad(184, 'NO FUN'); spawn('carrier', 490, { pod: 'SWARM', side: -1 }); } },
      { t: 19, f: () => { formation(420, 3); spawn('crawler', 643); } },
      { t: 22.5, f: () => formation(245, 5) },
      { t: 25.7, f: () => { spawn('carrier', 370, { pod: 'RAPID' }); spawn('carrier', 568, { x: W + 230, pod: 'LANCE', side: -1 }); } },
      { t: 29, f: () => { formation(197, 4); spawn('mine', 535); spawn('mine', 610, { x: W + 230 }); } },
      { t: 32, f: () => warning('WARDEN / ARMED PATROL CARRIER', 2.7) },
      { t: 35, f: () => spawn('mini', 367) },
      { t: 37, f: () => { G.phase = 1; chapter('02', 'FREIGHT CORRIDOR', 'ELEVATED TRANSIT / CHECKPOINT SAVED', 3.5); radio('The lower route is open. Keep those guns warm.'); dropPod(890, 410, 'LANCE'); dropRepair(1130, 560); } },
      { t: 39.5, f: () => formation(235, 4) },
      { t: 42.2, f: () => { spawn('crawler', 646, { pod: 'RAPID' }); spawn('carrier', 270, { pod: 'SWARM' }); } },
      { t: 45, f: () => { formation(458, 4); spawn('mine', 201, { x: W + 290 }); } },
      { t: 47.5, f: () => ad(564, 'PAY UP') },
      { t: 49, f: () => { spawn('carrier', 193, { pod: 'LANCE' }); spawn('carrier', 491, { x: W + 240, pod: 'RAPID' }); } },
      { t: 52, f: () => formation(350, 5) },
      { t: 55, f: () => { spawn('crawler', 640, { pod: 'SWARM' }); formation(200, 3); } },
      { t: 58, f: () => { for (let i = 0; i < 4; i++) spawn('mine', 250 + i * 100, { x: W + 110 + i * 100 }); dropPod(1490, 190, 'RAPID'); } },
      { t: 61, f: () => { spawn('carrier', 372, { pod: 'LANCE' }); formation(525, 4); } },
      { t: 64, f: () => { G.phase = 2; chapter('03', 'THE COLLECTION', 'CIVIC PERIMETER / WEAPONS FREE', 3.4); radio('Heavy footsteps on the bridge. That cannot be good.'); } },
      { t: 65.5, f: () => { formation(205, 4); spawn('carrier', 537, { pod: 'SWARM' }); } },
      { t: 68.5, f: () => { spawn('crawler', 643, { pod: 'LANCE' }); formation(375, 4); } },
      { t: 72, f: () => { ad(253, 'OBEY'); spawn('carrier', 541, { pod: 'RAPID' }); } },
      { t: 74.5, f: () => formation(218, 5) },
      { t: 77, f: () => { spawn('carrier', 315, { pod: 'SWARM' }); spawn('carrier', 564, { pod: 'LANCE', x: W + 210 }); } },
      { t: 80, f: () => { formation(396, 5); spawn('crawler', 645, { pod: 'RAPID' }); } },
      { t: 83, f: () => { spawn('mine', 246); spawn('mine', 453, { x: W + 190 }); dropRepair(1300, 585); dropPod(1500, 300, 'LANCE'); } },
      { t: 86.7, f: () => { warning('DEBT COLLECTOR / CLASS 09 ENFORCEMENT', 3); setCheckpoint(OP.bossCP); } },
      { t: 90, f: () => spawn('boss', 360) },
    ],
  },
  {
    id: 2, code: '02', title: 'INTEREST DUE', tag: 'TOWER RAID', location: 'SABLE HEIGHTS', clock: '04:40 / LOCAL',
    sectors: ['INTEREST DUE', 'THE VAULT LINE', 'FINAL NOTICE'], firstSub: 'SABLE HEIGHTS / FINANCIAL DISTRICT',
    cpNames: ['Tower approach', 'Vault line', 'Final boss'], midCP: 40, bossCP: 93, bossT: 93, phase1T: 41, phase2T: 67, length: 93,
    bossWarn: 'UNDERWRITER / FINAL CHECKPOINT',
    waves: [
      { t: 3, f: () => formation(260, 4) },
      { t: 6, f: () => { spawn('auditor', 220, { holdX: 1180 }); radio('Auditor drone. It draws a line before it shoots. Do not be on the line.', 'CONTROL / OPEN CHANNEL', 5); } },
      { t: 8.5, f: () => formation(470, 4) },
      { t: 11, f: () => { spawn('bailiff', 380); radio('Bailiff. That plate eats your fire. Wear it down, or punch straight through it with a Lance.', 'CONTROL / OPEN CHANNEL', 6); } },
      { t: 14.5, f: () => { formation(200, 3); spawn('auditor', 600, { holdX: 1100 }); } },
      { t: 17, f: () => { ad(170, 'PAY NOW'); spawn('carrier', 500, { pod: 'SWARM', side: -1 }); } },
      { t: 20, f: () => { spawn('crawler', 643, { pod: 'LANCE' }); formation(300, 4); } },
      { t: 23, f: () => { spawn('bailiff', 250); spawn('bailiff', 520, { x: W + 220 }); } },
      { t: 26.5, f: () => { spawn('auditor', 180, { holdX: 1220 }); spawn('auditor', 620, { holdX: 1150, x: W + 160 }); } },
      { t: 29.5, f: () => { formation(420, 5); spawn('mine', 230, { x: W + 200 }); } },
      { t: 32.5, f: () => { spawn('carrier', 300, { pod: 'RAPID' }); spawn('carrier', 560, { pod: 'LANCE', x: W + 230, side: -1 }); } },
      { t: 36, f: () => warning('ESCROW / ARMORED COURIER', 2.7) },
      { t: 39, f: () => spawn('mini', 367, { variant: 2 }) },
      { t: 41, f: () => { G.phase = 1; chapter('02', 'THE VAULT LINE', 'ELEVATED TRANSIT / CHECKPOINT SAVED', 3.5); radio('Vault line ahead. Their money moves by rail. So do their guns.'); dropPod(890, 400, 'SWARM'); dropRepair(1130, 560); } },
      { t: 43.5, f: () => formation(240, 4) },
      { t: 46, f: () => { spawn('bailiff', 450); spawn('auditor', 200, { holdX: 1200 }); } },
      { t: 49, f: () => { formation(520, 4); spawn('mine', 300, { x: W + 260 }); } },
      { t: 51.5, f: () => ad(560, 'BUY MORE') },
      { t: 53.5, f: () => { spawn('crawler', 645, { pod: 'SWARM' }); spawn('carrier', 230, { pod: 'LANCE' }); } },
      { t: 57, f: () => { spawn('auditor', 180, { holdX: 1220 }); spawn('auditor', 400, { holdX: 1120, x: W + 140 }); spawn('auditor', 620, { holdX: 1220, x: W + 280 }); } },
      { t: 60.5, f: () => formation(330, 5) },
      { t: 63, f: () => { spawn('bailiff', 300); spawn('bailiff', 560, { x: W + 200 }); dropPod(1490, 190, 'RAPID'); } },
      { t: 67, f: () => { G.phase = 2; chapter('03', 'FINAL NOTICE', 'SABLE TOWER / NO MORE EXTENSIONS', 3.4); radio('Something big is coming off the tower. It is printing money and ammunition.'); } },
      { t: 68.5, f: () => { formation(210, 4); spawn('carrier', 540, { pod: 'SWARM' }); } },
      { t: 71.5, f: () => { spawn('auditor', 300, { holdX: 1150 }); spawn('crawler', 643, { pod: 'RAPID' }); } },
      { t: 74.5, f: () => { ad(240, 'OWE MORE'); formation(470, 4); } },
      { t: 77, f: () => { spawn('bailiff', 380); for (let i = 0; i < 3; i++) spawn('mine', 220 + i * 190, { x: W + 120 + i * 120 }); } },
      { t: 80.5, f: () => { formation(200, 5); spawn('auditor', 600, { holdX: 1200, x: W + 200 }); } },
      { t: 83.5, f: () => { spawn('carrier', 320, { pod: 'LANCE' }); spawn('carrier', 560, { pod: 'RAPID', x: W + 210 }); dropRepair(1300, 585); } },
      { t: 87, f: () => { spawn('mine', 246); spawn('mine', 453, { x: W + 190 }); dropPod(1500, 300, 'LANCE'); } },
      { t: 89.5, f: () => { warning('UNDERWRITER / CIVIC CREDIT TOWER', 3); setCheckpoint(OP.bossCP); } },
      { t: 93, f: () => spawn('boss', 360, { variant: 2 }) },
    ],
  },
];
let OP = OPS[opId - 1];

/* ------------------------------------------------------------------ device prompts */

const PROMPTS = {
  keyboard: { pod: 'K / X', flip: 'Q', emp: 'E', auto: 'T', pause: 'ESC', fire: 'SPACE OR J', move: 'WASD or the arrow keys', podHold: 'Hold K' },
  gamepad: { pod: 'B / RB', flip: 'X', emp: 'Y', auto: 'BACK', pause: 'START', fire: 'A OR RT', move: 'the left stick', podHold: 'Hold B or RB' },
  touch: { pod: 'POD', flip: 'FLIP', emp: 'EMP', auto: 'MENU', pause: 'II', fire: 'FIRE', move: 'the stick or a drag', podHold: 'Hold POD' },
};
const CONTROL_ROWS = {
  keyboard: [
    ['Move', ['W A S D', '↑ ↓ ← →']], ['Fire primary gun', ['SPACE', 'J']], ['Fire gunpod', ['K', 'X']], ['Move arm above / below', ['Q']],
    ['EMP / clear nearby threats', ['E']], ['Slow movement / show hit point', ['SHIFT']], ['Auto fire / pause', ['T', 'ESC']],
    ['Mouse: fly / fire gunpod', ['HOLD LEFT', 'RIGHT']], ['Sound / full screen / settings', ['M', 'F', 'F9']],
  ],
  gamepad: [
    ['Move', ['LEFT STICK', 'D-PAD']], ['Fire primary gun', ['A', 'RT']], ['Fire gunpod', ['B', 'RB']], ['Move arm above / below', ['X']],
    ['EMP / clear nearby threats', ['Y']], ['Slow movement / show hit point', ['LT']], ['Auto fire / pause', ['BACK', 'START']],
    ['Menus: move / choose / back', ['D-PAD', 'A', 'B']],
  ],
  touch: [
    ['Move', ['STICK', 'DRAG']], ['Fire primary gun', ['AUTO', 'FIRE']], ['Fire gunpod', ['POD']], ['Move arm above / below', ['FLIP']],
    ['EMP / clear nearby threats', ['EMP']], ['Pause', ['II']],
  ],
};
const SOURCE_NAMES = { keyboard: 'KEYBOARD AND MOUSE', gamepad: 'CONTROLLER', touch: 'TOUCH' };
const prompts = () => PROMPTS[input.source] || PROMPTS.keyboard;
const startHint = () => {
  const p = prompts();
  return input.source === 'touch' ? `Fly with ${p.move}. ${p.podHold} to fire your gunpod.` : `Move with ${p.move}. ${p.podHold} to fire your gunpod.`;
};

function renderPrompts() {
  const p = prompts();
  setText(UI.weaponHint, `${p.pod} · FIRE POD   ${p.flip} · FLIP ARM`);
  setText(UI.empKey, p.emp);
  setText(UI.autoKey, p.auto);
  setText(UI.pauseKey, p.pause);
  const src = CONTROL_ROWS[input.source] ? input.source : 'keyboard';
  if (UI.controlsList.dataset.src !== src) {
    UI.controlsList.dataset.src = src;
    UI.controlsList.textContent = '';
    for (const [label, keys] of CONTROL_ROWS[src]) {
      const row = document.createElement('div');
      row.className = 'control-row';
      const name = document.createElement('span');
      name.textContent = label;
      const k = document.createElement('span');
      k.className = 'keys';
      for (const key of keys) {
        const kb = document.createElement('kbd');
        kb.textContent = key;
        k.append(kb);
      }
      row.append(name, k);
      UI.controlsList.append(row);
    }
    setText(UI.controlsSource, `SHOWING ${SOURCE_NAMES[src]} CONTROLS`);
  }
}

/* ------------------------------------------------------------------ small UI helpers */

function setText(el, v) {
  if (el && el._v !== v) {
    el._v = v;
    el.textContent = v;
  }
}
function setStyle(el, prop, v) {
  const k = `_s_${prop}`;
  if (el[k] !== v) {
    el[k] = v;
    el.style[prop] = v;
  }
}
function show(el, yes) {
  el.classList.toggle('hidden', !yes);
}
function scoreString(v) {
  return Math.floor(v).toString().padStart(7, '0');
}
function timeString(v) {
  return `${Math.floor(v / 60).toString().padStart(2, '0')}:${Math.floor(v % 60).toString().padStart(2, '0')}`;
}
function setDifficulty(d) {
  difficulty = d;
  prefs.difficulty = d;
  savePrefs();
  UI.arcadeButton.classList.toggle('selected', d === 'arcade');
  UI.storyButton.classList.toggle('selected', d === 'story');
  UI.arcadeButton.setAttribute('aria-pressed', d === 'arcade');
  UI.storyButton.setAttribute('aria-pressed', d === 'story');
  UI.modeHint.textContent = d === 'arcade' ? '3 HULL / 2 RESERVE SHIPS' : '6 HULL / SLOWER THREATS';
  renderTitle();
}
function setOperation(id) {
  if (id === 2 && unlocked < 2) {
    UI.opHint.textContent = 'LOCKED / CLEAR OPERATION 01 FIRST';
    audio.tone(160, 0.12, 'square', 0.03);
    return;
  }
  opId = id;
  OP = OPS[id - 1];
  prefs.op = id;
  savePrefs();
  gfx.setTheme(id);
  renderTitle();
}
function renderTitle() {
  UI.op1Button.classList.toggle('selected', opId === 1);
  UI.op2Button.classList.toggle('selected', opId === 2);
  UI.op1Button.setAttribute('aria-pressed', opId === 1);
  UI.op2Button.setAttribute('aria-pressed', opId === 2);
  UI.op2Button.classList.toggle('locked', unlocked < 2);
  UI.op2Button.textContent = unlocked < 2 ? '02 LOCKED' : '02 INTEREST DUE';
  UI.opHint.textContent = unlocked < 2 && opId === 1 ? 'CLEAR 01 TO UNLOCK 02' : OP.tag;
  UI.opCode.textContent = OP.code;
  UI.opTitle.textContent = OP.title;
  UI.opTag.textContent = OP.tag;
  UI.titleLocation.textContent = OP.location;
  UI.titleClock.textContent = OP.clock;
  const best = getBest(opId, difficulty);
  const time = getBestTime(opId, difficulty);
  UI.opRecord.textContent = best ? `BEST ${scoreString(best)}${time ? ` · CLEAR ${timeString(time)}` : ''} · ${difficulty.toUpperCase()}` : '1 PILOT  ·  3 GUNPODS  ·  NO BACKUP PLAN';
  const save = readSave();
  show(UI.continueButton, !!save);
  if (save) {
    const o = OPS[save.op - 1];
    const sector = save.cp >= o.bossCP - 1 ? 3 : 2;
    UI.continueButton.textContent = `CONTINUE · OP ${o.code} SECTOR 0${sector}`;
    UI.continueButton.title = `${o.title} / ${save.difficulty.toUpperCase()} / ${o.cpNames[sector - 1].toUpperCase()} CHECKPOINT`;
  }
}

function toast(title, sub = '', duration = 2.7) {
  UI.toastTitle.textContent = title;
  UI.toastSub.textContent = sub;
  G.toastTimer = duration;
  UI.toast.classList.add('show');
}
function radio(text, name = 'CONTROL / OPEN CHANNEL', duration = 5.2) {
  UI.radioText.textContent = text;
  UI.radioName.textContent = name;
  G.radioTimer = duration;
  UI.radio.classList.add('show');
}
function chapter(number, title, sub, duration = 4) {
  UI.chapterText.textContent = `OPERATION ${OP.code} / SECTOR ${number}`;
  UI.chapterTitle.textContent = title;
  UI.chapterSub.textContent = sub;
  G.chapterTimer = duration;
  UI.missionCard.classList.add('show');
}
function warning(text, duration = 3) {
  UI.warningSub.textContent = text;
  G.warningTimer = duration;
  UI.warning.classList.add('show');
  audio.tone(220, 0.3, 'square', 0.05);
  if (audio.ac) audio.tone(164, 0.5, 'square', 0.045, audio.ac.currentTime + 0.4);
}
function clearTransientUI() {
  for (const e of [UI.toast, UI.radio, UI.missionCard, UI.warning]) e.classList.remove('show');
  show(UI.bossHud, false);
  G.toastTimer = G.radioTimer = G.chapterTimer = G.warningTimer = 0;
}
function clearInput() {
  pointer.active = false;
  input.settle();
}
function touchFor(playing) {
  kit.touch?.suspend(!playing, 'game');
  kit.touch?.setShown('fire', !autoFire);
}
function blurMenus() {
  clearNavFocus();
  const a = document.activeElement;
  if (a && a !== document.body && UI.uiRoot.contains(a)) a.blur();
}

/* ------------------------------------------------------------------ flow */

function setCheckpoint(cp) {
  if (cp === G.checkpoint) return;
  G.checkpoint = cp;
  if (cp > 0) store.set('gunhand_save', JSON.stringify({ op: OP.id, cp, difficulty }));
}

function startGame(checkpoint = 0) {
  blurMenus();
  UI.titleScreen.inert = false;
  audio.init();
  OP = OPS[opId - 1];
  gfx.setTheme(opId);
  enemies = [];
  bullets = [];
  shots = [];
  pickups = [];
  particles = [];
  rings = [];
  floats = [];
  const midDone = checkpoint >= OP.midCP;
  const atBoss = checkpoint >= OP.bossCP - 1;
  Object.assign(G, {
    t: checkpoint, time: 0, scroll: checkpoint * 62, score: 0, chain: 0, chainTime: 0, mult: 1, kills: 0, pods: 0, secrets: 0, deaths: 0, shots: 0,
    hits: 0, emp: 2, checkpoint, events: 0, miniSpawned: midDone, miniDone: midDone, bossSpawned: false, bossDead: false,
    phase: atBoss ? 2 : midDone ? 1 : 0, shake: 0, damage: 0, white: 0, toastTimer: 0, radioTimer: 0, chapterTimer: 0, warningTimer: 0,
    endTimer: 0, won: false, bonusGiven: false, respawn: 0,
  });
  Object.assign(P, {
    x: 230, y: 410, vx: 0, vy: 0, hp: difficulty === 'story' ? 6 : 3, maxhp: difficulty === 'story' ? 6 : 3, reserve: 2, inv: 2.6, arm: 1, armPose: 1,
    gun: atBoss ? 'LANCE' : 'RAPID', ammo: atBoss ? 72 : 180, maxAmmo: atBoss ? 72 : 240, fire: 0.4, podFire: 0, tilt: 0, focus: false, alive: true,
  });
  while (G.events < OP.waves.length && OP.waves[G.events].t < checkpoint) G.events++;
  bestNow = getBest(OP.id, difficulty);
  clearTransientUI();
  clearInput();
  state = 'playing';
  show(UI.titleScreen, false);
  show(UI.hud, true);
  show(UI.pauseScreen, false);
  show(UI.resultScreen, false);
  show(UI.manualScreen, false);
  touchFor(true);
  accumulator = 0;
  audio.info.op = OP.id;
  audio.rewind();
  UI.hullBars.dataset.value = '';
  // The two ticks on the progress line mark where sectors 02 and 03 begin on this operation.
  UI.progressTrack.style.setProperty('--m1', `${((OP.phase1T / OP.length) * 100).toFixed(1)}%`);
  UI.progressTrack.style.setProperty('--m2', `${((OP.phase2T / OP.length) * 100).toFixed(1)}%`);
  syncHUD();
  if (atBoss) {
    warning(OP.bossWarn, 2);
    G.t = OP.bossT - 0.1;
  } else {
    chapter(checkpoint ? '02' : '01', checkpoint ? 'BACK ON THE CLOCK' : OP.sectors[0], checkpoint ? 'CHECKPOINT RESTORED / SCORE RESET' : OP.firstSub, 3.5);
    radio(startHint(), 'GH–01 / FLIGHT CHECK', 6);
  }
}

function continueSaved() {
  const save = readSave();
  if (!save) return renderTitle();
  if (save.difficulty !== difficulty) setDifficulty(save.difficulty);
  if (save.op !== opId) setOperation(save.op);
  startGame(save.cp);
}

function toTitle() {
  state = 'title';
  UI.titleScreen.inert = false;
  clearInput();
  show(UI.titleScreen, true);
  show(UI.hud, false);
  show(UI.pauseScreen, false);
  show(UI.resultScreen, false);
  show(UI.manualScreen, false);
  touchFor(false);
  clearTransientUI();
  G.phase = 0;
  G.damage = 0;
  G.white = 0;
  G.shake = 0;
  enemies = [];
  bullets = [];
  shots = [];
  particles = [];
  pickups = [];
  rings = [];
  floats = [];
  renderTitle();
  menuOpened(UI.startButton);
}

function pauseGame() {
  if (state !== 'playing') return;
  state = 'paused';
  clearInput();
  show(UI.pauseScreen, true);
  touchFor(false);
  UI.restartButton.textContent = G.checkpoint > 0 ? 'RESTART FROM CHECKPOINT' : 'RESTART OPERATION';
  menuOpened(UI.resumeButton);
}

function resumeGame() {
  if (state !== 'paused') return;
  blurMenus();
  state = 'playing';
  clearInput();
  show(UI.pauseScreen, false);
  touchFor(true);
  audio.init();
  if (audio.ac) audio.next = audio.ac.currentTime + 0.04;
}

function restartFromPause() {
  if (state !== 'paused') return;
  startGame(G.checkpoint);
}

function openManual() {
  manualOrigin = state;
  if (state === 'playing') {
    pauseGame();
    manualOrigin = 'paused';
  }
  state = 'manual';
  UI.titleScreen.inert = true;
  renderPrompts();
  show(UI.manualScreen, true);
  show(UI.pauseScreen, false);
  touchFor(false);
  menuOpened(UI.closeManual);
}

function closeManual() {
  if (state !== 'manual') return;
  UI.titleScreen.inert = false;
  show(UI.manualScreen, false);
  state = manualOrigin === 'paused' ? 'paused' : 'title';
  if (state === 'paused') {
    show(UI.pauseScreen, true);
    menuOpened(UI.pauseManualButton);
  } else menuOpened(UI.manualButton);
}

function finish(won) {
  if (state !== 'playing') return;
  state = 'result';
  G.won = won;
  clearInput();
  touchFor(false);
  if (won) {
    const bonus = P.hp * 1000 + P.reserve * 2500 + G.secrets * 1500;
    G.score += bonus;
    G.bonusGiven = true;
  }
  const old = getBest(OP.id, difficulty);
  const newBest = G.score > old;
  if (newBest) store.set(bestKey(OP.id, difficulty), Math.floor(G.score));
  const best = Math.max(old, G.score);
  let newTime = false;
  let unlockedNow = false;
  if (won) {
    const bt = getBestTime(OP.id, difficulty);
    if (!bt || G.time < bt) {
      store.set(timeKey(OP.id, difficulty), G.time.toFixed(2));
      newTime = !!bt;
    }
    const save = readSave();
    if (save && save.op === OP.id) store.del('gunhand_save');
    if (OP.id === 1 && unlocked < 2) {
      unlocked = 2;
      store.set('gunhand_unlocked', 2);
      unlockedNow = true;
    }
  }
  const rank = won ? (G.secrets === 3 && G.deaths === 0 ? 'S' : G.score >= 50000 || G.deaths === 0 ? 'A' : G.score > 20000 ? 'B' : 'C') : '—';
  const bestTime = getBestTime(OP.id, difficulty);
  UI.resultEyebrow.textContent = won ? `OPERATION ${OP.code} / RAID COMPLETE` : `OPERATION ${OP.code} / SIGNAL LOST`;
  UI.resultTitle.textContent = won ? (OP.id === 1 ? 'DEBT. SETTLED.' : 'ACCOUNT. CLOSED.') : 'OUT OF HAND.';
  UI.resultMessage.textContent = won
    ? OP.id === 1 ? 'Blockade cleared. The city owes you one.' : 'The Underwriter is scrap. Every note in Sable Heights just went blank.'
    : 'Your ship was lost. Retry from your last checkpoint with a new ship.';
  UI.rankLabel.textContent = won ? 'FLIGHT RANK' : 'FLIGHT ENDED';
  UI.rankText.textContent = rank;
  UI.resultScore.textContent = scoreString(G.score);
  UI.resultBest.textContent = scoreString(best);
  UI.resultTimeLabel.textContent = won && bestTime ? `TARGETS / TIME (BEST ${timeString(bestTime)})` : 'TARGETS / FLIGHT TIME';
  UI.resultKills.innerHTML = `${G.kills} <small>/ ${timeString(G.time)}</small>`;
  UI.resultSalvage.innerHTML = `${G.pods} <small>/ ${G.secrets} OF 3</small>`;
  UI.retryButton.innerHTML = won ? 'RAID AGAIN <span class="arrow">↗</span>' : 'RETRY CHECKPOINT <span class="arrow">↗</span>';
  show(UI.nextOpButton, won && OP.id === 1);
  const cpName = OP.cpNames[G.checkpoint >= OP.bossCP - 1 ? 2 : G.checkpoint >= OP.midCP ? 1 : 0];
  UI.resultCopy.textContent = won
    ? `${newBest ? 'NEW BEST SCORE. ' : ''}${newTime ? 'NEW BEST TIME. ' : ''}${unlockedNow ? 'OPERATION 02 UNLOCKED. ' : ''}Hull and reserve bonuses added. One arm. A very expensive night for someone else.`
    : `${cpName} checkpoint ready. A retry restores your ship and resets your score. The checkpoint is saved for CONTINUE.`;
  show(UI.resultScreen, true);
  show(UI.bossHud, false);
  menuLock = performance.now() + 700;
  menuOpened(won && OP.id === 1 && unlockedNow ? UI.nextOpButton : UI.retryButton);
  if (won) {
    audio.tone(220, 0.5, 'triangle', 0.12);
    if (audio.ac) {
      audio.tone(330, 0.6, 'triangle', 0.1, audio.ac.currentTime + 0.2);
      audio.tone(440, 0.8, 'sine', 0.1, audio.ac.currentTime + 0.4);
    }
  }
}

function retry() {
  startGame(G.won ? 0 : G.checkpoint);
}

function nextOperation() {
  if (unlocked < 2) return;
  setOperation(2);
  startGame(0);
}

/* ------------------------------------------------------------------ spawning */

function spawn(type, y, opts = {}) {
  const e = {
    id: Math.random(), type, x: W + 100, y, baseY: y, vx: opts.vx || 0, age: 0, fire: rand(0.9, 1.8), hp: 1, maxhp: 1, r: 20, flash: 0, dead: false,
    pod: null, podHp: 0, podMax: 9, podLost: false, podSide: opts.side || 1, score: 150, variant: 1, ...opts,
  };
  if (type === 'scout') {
    e.hp = e.maxhp = 4;
    e.r = 24;
    e.speed = opts.speed || rand(170, 205);
    e.score = 160;
  }
  if (type === 'carrier') {
    e.hp = e.maxhp = 18;
    e.r = 43;
    e.speed = opts.speed || 86;
    e.pod = opts.pod || 'RAPID';
    e.podHp = e.podMax = 9;
    e.score = 650;
    e.fire = 1.5;
  }
  if (type === 'crawler') {
    e.hp = e.maxhp = 24;
    e.r = 46;
    e.speed = 78;
    e.pod = opts.pod || 'LANCE';
    e.podSide = -1;
    e.podHp = e.podMax = 9;
    e.score = 800;
  }
  if (type === 'mine') {
    e.hp = e.maxhp = 4;
    e.r = 19;
    e.speed = opts.speed || 88;
    e.score = 230;
    e.fire = 1.8;
  }
  if (type === 'auditor') {
    e.hp = e.maxhp = 7;
    e.r = 26;
    e.score = 420;
    e.holdX = opts.holdX || 1150;
    e.mode = 0;
    e.lock = 0;
    e.aimX = 0;
    e.aimY = 0;
    e.shotsLeft = difficulty === 'story' ? 2 : 3;
    e.fire = 0.7;
  }
  if (type === 'bailiff') {
    e.hp = e.maxhp = 14;
    e.r = 34;
    e.speed = opts.speed || 64;
    e.score = 900;
    e.shield = e.shieldMax = difficulty === 'story' ? 20 : 26;
    e.shieldFlash = 0;
    e.fire = 1.6;
  }
  if (type === 'mini') {
    const v2 = e.variant === 2;
    e.hp = e.maxhp = v2 ? (difficulty === 'story' ? 230 : 310) : difficulty === 'story' ? 205 : 280;
    e.r = 98;
    e.speed = 0;
    e.pod = v2 ? 'LANCE' : 'SWARM';
    e.podHp = e.podMax = 26;
    e.podSide = 1;
    e.score = v2 ? 6000 : 5500;
    e.fire = 2.2;
    e.x = 1600;
    e.targetX = 1120;
    G.miniSpawned = true;
    show(UI.bossHud, true);
    UI.bossName.textContent = v2 ? 'ESCROW / ARMORED COURIER' : 'WARDEN / PATROL CARRIER';
    if (v2) radio('Escrow is hauling a Lance pod and laying mines behind it. Pry the pod loose.', 'CONTROL / PRIORITY CHANNEL', 5);
    else radio('That patrol carrier has a useful gun. Take it apart.', 'CONTROL / PRIORITY CHANNEL', 5);
  }
  if (type === 'boss') {
    const v2 = e.variant === 2;
    e.r = 100;
    e.x = v2 ? 1650 : 1630;
    e.targetX = v2 ? 1150 : 1148;
    e.y = 362;
    e.baseY = 362;
    e.phase = 1;
    if (v2) {
      e.hp = e.maxhp = difficulty === 'story' ? 520 : 700;
      e.score = 20000;
      e.fire = 1.6;
      e.guns = [
        { hp: 70, maxhp: 70, flash: 0, dead: false, fire: 1.8, x: -104, y: -86, kind: 'gun' },
        { hp: 70, maxhp: 70, flash: 0, dead: false, fire: 2.4, x: -86, y: 92, kind: 'gun' },
        { hp: 60, maxhp: 60, flash: 0, dead: false, fire: 3, x: 74, y: -190, kind: 'battery' },
      ];
      e.spiral = 0;
      e.spiralT = 0;
      e.colClock = 6;
      e.colState = 0;
      e.colTimer = 0;
      e.cols = [0, 0];
      UI.bossName.textContent = 'UNDERWRITER / CIVIC CREDIT TOWER';
      radio('Two gun mounts, a mortar on the tower and a ledger core. Break the mounts first.', 'CONTROL / FINAL APPROACH', 5.5);
    } else {
      e.hp = e.maxhp = difficulty === 'story' ? 460 : 620;
      e.score = 16000;
      e.fire = 1.4;
      e.guns = [
        { hp: 76, maxhp: 76, flash: 0, dead: false, fire: 1.8, y: -78, x: -91, kind: 'gun' },
        { hp: 76, maxhp: 76, flash: 0, dead: false, fire: 2.4, y: 94, x: -70, kind: 'gun' },
      ];
      e.beamClock = 5;
      e.beamState = 0;
      e.beamTimer = 0;
      e.beamY = 400;
      UI.bossName.textContent = 'DEBT COLLECTOR / CIVIC ENFORCEMENT';
      radio('Two gun mounts. One core. You know what to do.', 'CONTROL / FINAL APPROACH', 5.5);
    }
    G.bossSpawned = true;
    setCheckpoint(OP.bossCP);
    show(UI.bossHud, true);
  }
  enemies.push(e);
  return e;
}
function formation(y, n = 4, kind = 'scout', spacing = 69) {
  for (let i = 0; i < n; i++) spawn(kind, y + i * 25, { x: W + 100 + i * spacing, phase: i * 0.55, speed: 177, baseY: y + i * 25 });
}
function ad(y, text) {
  return spawn('ad', y, { hp: 7, maxhp: 7, r: 44, score: 700, x: W + 80, text, words: text.split(' '), speed: 98 });
}
function dropPod(x, y, type) {
  pickups.push({ x, y, vx: -65, vy: -28, type, r: 23, age: 0, life: 17, magnet: false });
}
function dropRepair(x, y) {
  pickups.push({ x, y, vx: -77, vy: 0, type: 'REPAIR', r: 20, age: 0, life: 18, magnet: false });
}
function burst(x, y, n = 20, color = '#ffae70', speed = 220, big = false) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), v = rand(speed * 0.2, speed);
    particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.22, big ? 1.3 : 0.75), max: big ? 1.3 : 0.75, size: rand(1.2, big ? 7 : 4), color, type: i % 4 === 0 ? 'debris' : 'spark', rot: rand(0, TAU), spin: rand(-6, 6) });
  }
  rings.push({ x, y, r: 4, life: big ? 0.6 : 0.28, max: big ? 0.6 : 0.28, speed: big ? 245 : 155, color });
  glowFlash(x, y, big ? 65 : 32, color);
}
function glowFlash(x, y, r, color) {
  particles.push({ x, y, vx: 0, vy: 0, life: 0.15, max: 0.15, size: r, color, type: 'flash' });
}
function popText(x, y, text, color = '#e1e7bc', size = 15) {
  floats.push({ x, y, text, color, size, life: 1.3, max: 1.3 });
}

/* ------------------------------------------------------------------ combat */

const BIG = new Set(['mini', 'boss', 'carrier', 'crawler', 'bailiff']);

function kill(e, bonus = true) {
  if (e.dead) return;
  e.dead = true;
  const big = BIG.has(e.type);
  burst(e.x, e.y, e.type === 'boss' ? 100 : big ? 45 : 20, e.type === 'ad' ? '#ffc57f' : '#ffba7a', big ? 310 : 190, big);
  audio.explosion(big);
  if (big) input.rumble(e.type === 'boss' ? 1 : 0.35, e.type === 'boss' ? 700 : 140);
  G.shake = Math.max(G.shake, e.type === 'boss' ? 18 : big ? 7 : 3);
  if (bonus) {
    G.kills++;
    G.chain++;
    G.chainTime = 4;
    G.mult = Math.pow(2, Math.min(4, Math.floor(G.chain / 4)));
    const pts = e.score * G.mult;
    G.score += pts;
    popText(e.x, e.y - 30, '+' + pts, undefined, big ? 20 : 14);
  }
  if (e.pod && !e.podLost) dropPod(e.x - 10, e.y + e.podSide * 42, e.pod);
  if (e.type === 'ad') {
    G.secrets++;
    G.score += 2000;
    toast('AD BREAK / ' + G.secrets + ' OF 3', 'PUBLIC NOTICE: YOU ARE NOT LISTENING.', 2.5);
    if (G.secrets === 3) {
      G.score += 10000;
      toast('SECRET BONUS / +10,000', 'ALL THREE ADS REMOVED.', 4);
    }
  }
  if (e.type === 'mini') {
    G.miniDone = true;
    setCheckpoint(OP.midCP);
    G.t = Math.max(G.t, OP.midCP);
    show(UI.bossHud, false);
    bullets = [];
    P.hp = Math.min(P.maxhp, P.hp + 1);
    G.emp = Math.min(3, G.emp + 1);
    toast(e.variant === 2 ? 'ESCROW RELEASED / CHECKPOINT SAVED' : 'PATROL REMOVED / CHECKPOINT SAVED', 'HULL +1 · EMP +1', 3.5);
    burst(e.x - 75, e.y + 30, 40, '#d2edb1', 360, true);
  }
  if (e.type === 'boss') {
    G.bossDead = true;
    G.endTimer = 5.5;
    bullets = [];
    pickups = [];
    P.inv = 8;
    show(UI.bossHud, false);
    for (const o of enemies) if (o !== e) o.dead = true;
    G.score += G.secrets === 3 ? 3000 : 0;
    if (e.variant === 2) radio('Ledger is ash. Every debt in the tower just defaulted. Come home.', 'CONTROL / ALL CLEAR', 5);
    else radio('Your account is now closed. Come home.', 'CONTROL / ALL CLEAR', 5);
    G.white = 0.8;
  }
}
function detachPod(e) {
  if (e.podLost) return;
  e.podLost = true;
  const pos = enemyPodPos(e);
  burst(pos.x, pos.y, 22, PODS[e.pod].color, 210);
  dropPod(pos.x, pos.y, e.pod);
  G.score += 400 * G.mult;
  popText(pos.x, pos.y - 28, 'GUN SEIZED', '#b6f4d6', 13);
  audio.explosion(false);
  input.rumble(0.3, 90);
}
const _pod = { x: 0, y: 0 };
function enemyPodPos(e) {
  if (e.type === 'crawler') {
    _pod.x = e.x - 16;
    _pod.y = e.y - 46;
  } else if (e.type === 'mini') {
    _pod.x = e.x - 38;
    _pod.y = e.y + 62;
  } else {
    _pod.x = e.x - 10;
    _pod.y = e.y + e.podSide * 45;
  }
  return _pod;
}
function breakShield(e) {
  if (e.shield <= 0 && e.shieldBroken) return;
  e.shield = 0;
  e.shieldBroken = true;
  burst(e.x - 36, e.y, 26, '#c9e3dc', 230);
  G.score += 300 * G.mult;
  popText(e.x - 36, e.y - 48, 'SHIELD DOWN', '#b6f4d6', 13);
  audio.shieldBreak();
  input.rumble(0.25, 80);
}
function collect(item) {
  item.dead = true;
  if (item.type === 'REPAIR') {
    const restored = Math.min(2, P.maxhp - P.hp);
    P.hp += restored;
    G.score += 300;
    toast(restored ? 'FIELD REPAIR' : 'SPARE PARTS', restored ? 'HULL RESTORED +' + restored : '+300 POINTS', 2.3);
    burst(P.x, P.y, 16, '#b8f9c2', 130);
    audio.pickup();
    input.rumble(0.2, 60);
    return;
  }
  P.gun = item.type;
  P.ammo = PODS[P.gun].ammo;
  P.maxAmmo = P.ammo;
  P.podFire = 0.12;
  G.pods++;
  G.score += 250 * G.mult;
  toast(P.gun + ' / ACQUIRED', 'ENEMY PROPERTY. NEW MANAGEMENT.', 2.2);
  burst(P.x, P.y + P.armPose * 35, 22, PODS[P.gun].color, 190);
  audio.pickup();
  input.rumble(0.25, 80);
}
function hitPlayer(amount = 1) {
  if (P.inv > 0 || !P.alive || G.bossDead) return;
  P.hp -= amount;
  G.damage = 0.85;
  G.shake = 11;
  P.inv = 1.9;
  G.chain = 0;
  G.chainTime = 0;
  G.mult = 1;
  audio.damage();
  input.rumble(0.7, 220);
  burst(P.x, P.y, 28, '#ff956c', 200);
  if (P.hp <= 0) {
    G.deaths++;
    P.alive = false;
    pointer.active = false;
    burst(P.x, P.y, 65, '#ffd68c', 390, true);
    audio.explosion(true);
    input.rumble(1, 450);
    bullets = [];
    if (P.reserve > 0) {
      P.reserve--;
      G.respawn = 1.7;
      radio('Signal restored. Reserve ship on approach.', 'GH–01 / RECOVERY SYSTEM', 3.5);
    } else {
      G.endTimer = 2.1;
      G.won = false;
    }
  }
}
function flipArm() {
  if (state !== 'playing' || !P.alive) return;
  P.arm *= -1;
  audio.tone(180, 0.09, 'triangle', 0.045, 0, 300);
}
function useEMP() {
  if (state !== 'playing' || G.emp <= 0 || !P.alive || G.bossDead) return;
  G.emp--;
  G.white = 0.65;
  G.shake = 13;
  P.inv = Math.max(P.inv, 1.1);
  audio.emp();
  input.rumble(0.6, 300);
  rings.push({ x: P.x, y: P.y, r: 20, life: 1, max: 1, speed: 1500, color: '#9df4e4', emp: true });
  for (const b of bullets) if (Math.random() < 0.35) burst(b.x, b.y, 3, '#b0ecd8', 75);
  bullets = [];
  for (const e of enemies) {
    if (e.dead || e.x > W + 70) continue;
    if (e.type === 'boss') {
      e.hp -= 43;
      e.flash = 0.7;
      if (e.variant === 2) {
        e.colState = 0;
        e.colClock = 3;
      } else {
        e.beamState = 0;
        e.beamClock = 3;
      }
      for (const gun of e.guns) {
        if (!gun.dead) {
          gun.hp -= 18;
          if (gun.hp <= 0) breakBossGun(e, gun);
        }
      }
    } else {
      e.hp -= e.type === 'mini' ? 45 : 35;
      e.flash = 1;
      if (e.type === 'auditor') e.lock = 0;
    }
    if (e.hp <= 0) kill(e);
  }
  toast('ELECTROMAGNETIC PULSE', 'THREAT FIELD CLEARED', 1.8);
}
function breakBossGun(e, g) {
  if (g.dead) return;
  g.dead = true;
  const x = e.x + g.x, y = e.y + g.y;
  burst(x, y, 45, '#ffd09b', 300, true);
  const drop = g.kind === 'battery' ? 'SWARM' : g.y < 0 ? 'LANCE' : e.variant === 2 ? 'RAPID' : 'SWARM';
  dropPod(x - 40, clamp(y, 150, 640), drop);
  G.score += 2000 * G.mult;
  G.shake = 9;
  audio.explosion(true);
  input.rumble(0.6, 200);
  const left = e.guns.filter((q) => !q.dead).length;
  toast(g.kind === 'battery' ? 'MORTAR DESTROYED' : 'GUN MOUNT DESTROYED', left ? (left === 1 ? 'ONE MOUNT REMAINS' : `${left} MOUNTS REMAIN`) : 'CORE EXPOSED / ALL WEAPONS FREE', 2);
}
function enemyBullet(x, y, vx, vy, r = 6, type = 'orb', color = '#ffab76', ay = 0) {
  if (x < -25 || x > W + 85) return;
  const slow = difficulty === 'story' ? 0.75 : 1;
  bullets.push({ x, y, px: x, py: y, vx: vx * slow, vy: vy * slow, ay: ay * slow * slow, r, type, color, life: 11, age: 0 });
}
function aim(x, y, speed, offset = 0) {
  const a = Math.atan2(P.y - y, P.x - x) + offset;
  return [Math.cos(a) * speed, Math.sin(a) * speed];
}
function fireAimed(x, y, speed = 210, count = 1, spread = 0.18, r = 6) {
  for (let i = 0; i < count; i++) {
    const v = aim(x, y, speed, (i - (count - 1) / 2) * spread);
    enemyBullet(x, y, v[0], v[1], r);
  }
}
function firePrimary() {
  if (P.fire > 0 || !P.alive) return;
  P.fire = 0.112;
  for (const y of [-6, 6]) {
    shots.push({ x: P.x + 52, y: P.y + y, px: P.x + 45, py: P.y + y, vx: 1050, vy: 0, r: 3, dmg: 1, type: 'needle', life: 1.4, color: '#abecda', hit: new Set(), counted: false });
    G.shots++;
  }
  glowFlash(P.x + 52, P.y, 12, '#bfffe4');
  audio.shot();
}
function firePod() {
  if (P.podFire > 0 || !P.gun || P.ammo <= 0 || !P.alive) return;
  const spec = PODS[P.gun], x = P.x + 38, y = P.y + P.armPose * 40;
  P.podFire = spec.rate;
  P.ammo--;
  audio.pod(P.gun);
  if (P.gun === 'RAPID') {
    const vv = P.arm === -1 ? [-12, 12] : [-98, 98];
    for (const v of vv) {
      shots.push({ x, y: y + v * 0.025, px: x, py: y, vx: 1140, vy: v, r: 4, dmg: spec.damage, type: 'rapid', life: 1.4, color: spec.color, hit: new Set(), counted: false });
      G.shots++;
    }
    glowFlash(x + 9, y, 19, spec.color);
  } else if (P.gun === 'LANCE') {
    shots.push({ x, y, px: x, py: y, vx: 1550, vy: P.arm === 1 ? 170 : 0, r: 8, dmg: spec.damage, type: 'lance', life: 1.3, color: spec.color, hit: new Set(), counted: false });
    G.shots++;
    G.shake = Math.max(G.shake, 1.7);
  } else {
    for (let i = 0; i < 2; i++) {
      shots.push({ x: x - 7, y: y + i * 8 - 4, px: x, py: y, vx: P.arm === -1 ? 290 : 165, vy: P.arm === -1 ? (i - 0.5) * 100 : 90 + i * 90, r: 5, dmg: spec.damage, type: 'missile', life: 4, color: spec.color, hit: new Set(), counted: false, target: null });
      G.shots++;
    }
  }
  if (P.ammo <= 0) {
    P.ammo = 0;
    toast('GUNPOD EMPTY', 'PRIMARY GUN STILL ONLINE. FIND A NEW POD.', 2.5);
  }
}
function segmentHit(ax, ay, bx, by, cx, cy, r) {
  const dx = bx - ax, dy = by - ay, d = dx * dx + dy * dy;
  const u = d === 0 ? 0 : clamp(((cx - ax) * dx + (cy - ay) * dy) / d, 0, 1);
  return (ax + u * dx - cx) ** 2 + (ay + u * dy - cy) ** 2 < r * r;
}
function hitShot(s, e, part = null) {
  const key = part ? e.id + part : e.id;
  if (s.hit.has(key)) return false;
  s.hit.add(key);
  if (!s.counted) {
    s.counted = true;
    G.hits++;
  }
  const spark = s.type === 'lance' ? 8 : 3;
  burst(s.x, s.y, spark, part === 'shield' ? '#d8f4ec' : s.color, 105);
  if (part === 'pod') {
    e.podHp -= s.dmg;
    e.flash = 0.4;
    if (e.podHp <= 0) detachPod(e);
  } else if (part === 'shield') {
    e.shield -= s.dmg;
    e.shieldFlash = 0.6;
    audio.clank();
    if (e.shield <= 0) breakShield(e);
  } else if (part && part.startsWith('gun')) {
    const gun = e.guns[Number(part.slice(3))];
    gun.hp -= s.dmg;
    gun.flash = 0.8;
    if (gun.hp <= 0) breakBossGun(e, gun);
  } else {
    let dmg = s.dmg;
    if (e.type === 'boss') {
      let guns = 0;
      for (const g of e.guns) if (!g.dead) guns++;
      if (e.guns.length === 3) dmg *= guns === 3 ? 0.3 : guns === 2 ? 0.42 : guns === 1 ? 0.7 : 1.28;
      else dmg *= guns === 2 ? 0.38 : guns === 1 ? 0.7 : 1.28;
    }
    e.hp -= dmg;
    e.flash = 0.72;
    if (e.hp <= 0) kill(e);
  }
  if (s.type !== 'lance') s.dead = true;
  return true;
}

/* ------------------------------------------------------------------ updates */

/** Drop finished entries in place, so a busy fight does not build new arrays every step. */
function sweep(list, keep) {
  let j = 0;
  for (let i = 0; i < list.length; i++) {
    const v = list[i];
    if (keep(v)) list[j++] = v;
  }
  list.length = j;
  return list;
}
const notDead = (o) => !o.dead;
const hasLife = (o) => o.life > 0;

function updateEnemies(dt) {
  for (const e of enemies) {
    if (e.dead) continue;
    e.age += dt;
    e.fire -= dt;
    e.flash = Math.max(0, e.flash - dt * 6);
    if (e.type === 'scout') {
      e.x -= e.speed * dt;
      e.y = e.baseY + Math.sin(e.age * 2.6 + (e.phase || 0)) * 30;
      if (e.fire <= 0 && e.x < W - 85 && e.x > P.x + 140) {
        fireAimed(e.x - 29, e.y, 205);
        e.fire = 2.3;
      }
    } else if (e.type === 'carrier') {
      e.x -= e.speed * dt;
      e.y = e.baseY + Math.sin(e.age * 1.65) * 28;
      if (e.fire <= 0 && e.x < W - 85 && e.x > 230) {
        const pp = enemyPodPos(e);
        if (!e.podLost) {
          fireAimed(pp.x - 29, pp.y, e.pod === 'RAPID' ? 245 : 205, e.pod === 'RAPID' ? 3 : 2, 0.13, 6);
          e.fire = e.pod === 'RAPID' ? 1.2 : 1.65;
        } else {
          fireAimed(e.x - 50, e.y, 190);
          e.fire = 2.2;
        }
      }
    } else if (e.type === 'crawler') {
      e.x -= e.speed * dt;
      e.y = e.baseY + Math.sin(e.age * 9) * 1.5;
      if (e.fire <= 0 && e.x < W - 70 && e.x > 90) {
        const pp = enemyPodPos(e);
        fireAimed(pp.x - 30, pp.y, e.podLost ? 190 : 240, e.podLost ? 1 : 3, 0.14, 6);
        e.fire = e.podLost ? 2.5 : 1.7;
      }
    } else if (e.type === 'mine') {
      e.x -= e.speed * dt;
      e.y = e.baseY + Math.sin(e.age * 2) * 18;
      if (e.fire <= 0 && e.x < W - 85 && e.x > 110) {
        for (let i = 0; i < 7; i++) {
          const a = (TAU * i) / 7 + 0.15;
          enemyBullet(e.x, e.y, Math.cos(a) * 140, Math.sin(a) * 140, 5, 'orb', '#e6a992');
        }
        e.fire = 3.5;
      }
    } else if (e.type === 'ad') {
      e.x -= e.speed * dt;
    } else if (e.type === 'auditor') {
      updateAuditor(e, dt);
    } else if (e.type === 'bailiff') {
      e.shieldFlash = Math.max(0, (e.shieldFlash || 0) - dt * 5);
      e.x -= (e.shield > 0 ? e.speed : e.speed * 1.9) * dt;
      e.y = e.baseY + Math.sin(e.age * 1.3) * 22;
      if (e.fire <= 0 && e.x < W - 85 && e.x > 160) {
        if (e.shield > 0) {
          fireAimed(e.x - 12, e.y - 34, 200, 2, 0.2, 6);
          fireAimed(e.x - 12, e.y + 34, 200, 2, 0.2, 6);
          e.fire = 2.1;
        } else {
          fireAimed(e.x - 30, e.y, 240, 3, 0.12, 6);
          e.fire = 1.3;
        }
      }
    } else if (e.type === 'mini') {
      e.x = lerp(e.x, e.targetX, dt * 1.05);
      e.y = 367 + Math.sin(e.age * 0.73) * 120;
      if (e.variant === 2) updateEscrow(e, dt);
      else {
        if (e.fire <= 0 && e.age > 2.2) {
          if (Math.floor(e.age / 4) % 2 === 0) {
            fireAimed(e.x - 107, e.y - 7, 215, 5, 0.17, 7);
            fireAimed(e.x - 70, e.y + 40, 255, 1);
          } else {
            for (let i = 0; i < 9; i++) {
              const a = Math.PI - 0.82 + i * 0.205;
              enemyBullet(e.x - 100, e.y, Math.cos(a) * 185, Math.sin(a) * 185, 6);
            }
          }
          e.fire = e.hp < e.maxhp * 0.45 ? 0.82 : 1.25;
        }
        if (e.age > 6 && Math.floor((e.age - dt) / 8) !== Math.floor(e.age / 8)) spawn('scout', e.y + 70, { x: e.x + 70, speed: 220 });
      }
    } else if (e.type === 'boss') {
      if (e.variant === 2) updateUnderwriter(e, dt);
      else updateBoss(e, dt);
    }
    if (e.type !== 'ad' && e.type !== 'boss' && e.type !== 'mini' && P.alive && P.inv <= 0 && e.x > -80 && dist(P.x, P.y, e.x, e.y) < e.r + 10) hitPlayer();
    if (e.type === 'mini' && P.alive && dist(P.x, P.y, e.x, e.y) < e.r + 7) hitPlayer();
    if (e.x < -180 || e.y < -160 || e.y > H + 160) e.dead = true;
  }
  sweep(enemies, notDead);
}

function updateAuditor(e, dt) {
  const lensX = e.x - 23;
  if (e.mode === 0) {
    e.x = lerp(e.x, e.holdX, Math.min(1, dt * 2.2));
    e.y = e.baseY + Math.sin(e.age * 1.7) * 10;
    if (Math.abs(e.x - e.holdX) < 14) {
      e.mode = 1;
      e.fire = 0.45;
    }
  } else if (e.mode === 1) {
    e.x = lerp(e.x, e.holdX, Math.min(1, dt * 2));
    e.y = e.baseY + Math.sin(e.age * 1.7) * 10;
    if (e.lock > 0) {
      e.lock -= dt;
      // Tracks the ship for most of the charge, then freezes the line: that is the cue to move.
      if (e.lock > 0.38 && P.alive) {
        e.aimX = P.x;
        e.aimY = P.y;
      }
      if (e.lock <= 0) {
        const a = Math.atan2(e.aimY - e.y, e.aimX - lensX);
        enemyBullet(lensX, e.y, Math.cos(a) * 640, Math.sin(a) * 640, 7, 'bolt', '#ff8f6a');
        glowFlash(lensX, e.y, 26, '#ffb08a');
        audio.tone(980, 0.12, 'sawtooth', 0.04, 0, 240);
        e.shotsLeft--;
        e.fire = 1.3;
        if (e.shotsLeft <= 0) e.mode = 2;
      }
    } else if (e.fire <= 0 && P.alive && e.x < W - 40) {
      e.lock = difficulty === 'story' ? 1.3 : 1.05;
      e.aimX = P.x;
      e.aimY = P.y;
      audio.lock();
    }
  } else {
    e.x -= 330 * dt;
    e.y += Math.sin(e.age * 3) * 40 * dt;
  }
}

function updateEscrow(e, dt) {
  if (e.fire <= 0 && e.age > 2.2) {
    const cycle = Math.floor(e.age / 4) % 3;
    if (cycle === 0) {
      fireAimed(e.x - 107, e.y - 7, 225, 5, 0.15, 7);
    } else if (cycle === 1) {
      spawn('mine', clamp(e.y + rand(-70, 70), 180, 620), { x: e.x - 70, speed: 120 });
      fireAimed(e.x - 70, e.y + 40, 255, 1);
    } else {
      for (let i = 0; i < 12; i++) {
        const a = (TAU * i) / 12 + e.age * 0.4;
        enemyBullet(e.x - 70, e.y, Math.cos(a) * 170, Math.sin(a) * 170, 6, 'orb', '#ffb49a');
      }
    }
    e.fire = e.hp < e.maxhp * 0.45 ? 0.95 : 1.35;
  }
  if (e.age > 6 && Math.floor((e.age - dt) / 9) !== Math.floor(e.age / 9)) spawn('auditor', e.y > 367 ? 200 : 600, { x: e.x + 80, holdX: 960 });
}

function updateBoss(e, dt) {
  e.x = lerp(e.x, e.targetX, dt * 0.8);
  e.y = 362 + Math.sin(e.age * 0.72) * 17;
  if (e.age < 3) return;
  const newPhase = e.hp < e.maxhp * 0.5 ? 2 : 1;
  if (newPhase !== e.phase) {
    e.phase = newPhase;
    toast('ENFORCEMENT OVERRIDE', 'BEAM SYSTEM ONLINE. WATCH THE RED LINE.', 3);
    radio('That beam needs time to charge. Move out of its path.', 'CONTROL / THREAT WARNING', 4.5);
    G.shake = 9;
    burst(e.x - 30, e.y, 45, '#ff8d68', 280, true);
  }
  for (let i = 0; i < e.guns.length; i++) {
    const g = e.guns[i];
    g.flash = Math.max(0, g.flash - dt * 6);
    if (g.dead) continue;
    g.fire -= dt;
    if (g.fire <= 0) {
      const x = e.x + g.x - 67, y = e.y + g.y;
      fireAimed(x, y, e.phase === 2 ? 235 : 205, e.phase === 2 ? 5 : 3, 0.13, 7);
      g.fire = e.phase === 2 ? 1.5 : 2.05;
      glowFlash(x, y, 28, '#ffba82');
    }
  }
  if (e.fire <= 0) {
    const offset = e.age * 0.24;
    for (let i = 0; i < 8; i++) {
      const a = Math.PI - 0.9 + i * 0.25 + (e.phase === 2 ? Math.sin(offset) * 0.15 : 0);
      enemyBullet(e.x - 69, e.y, Math.cos(a) * (e.phase === 2 ? 205 : 169), Math.sin(a) * (e.phase === 2 ? 205 : 169), 6);
    }
    e.fire = e.phase === 2 ? 1.45 : 2.25;
  }
  e.beamClock -= dt;
  if (e.beamState === 0 && e.beamClock <= 0) {
    e.beamState = 1;
    e.beamTimer = e.phase === 2 ? 1.1 : 1.45;
    e.beamY = clamp(P.y, 158, 644);
    audio.tone(130, 0.7, 'sawtooth', 0.06, 0, 410);
  } else if (e.beamState === 1) {
    e.beamTimer -= dt;
    if (e.beamTimer <= 0) {
      e.beamState = 2;
      e.beamTimer = 0.75;
      audio.hiss(0.65, 0.19, 2200);
      audio.tone(80, 0.65, 'sawtooth', 0.07);
      G.shake = 7;
      input.rumble(0.4, 200);
    }
  } else if (e.beamState === 2) {
    e.beamTimer -= dt;
    if (P.x < e.x - 55 && Math.abs(P.y - e.beamY) < 23) hitPlayer();
    if (e.beamTimer <= 0) {
      e.beamState = 0;
      e.beamClock = e.phase === 2 ? 4.2 : 6.2;
    }
  }
  if (e.phase === 2 && Math.floor((e.age - dt) / 7) !== Math.floor(e.age / 7)) {
    spawn('scout', 200, { x: W + 60 });
    spawn('scout', 600, { x: W + 130 });
  }
  if (P.alive && P.x > e.x - 112 && P.y > e.y - 110 && P.y < 700) hitPlayer();
}

/** The Underwriter: gun mounts, a lobbing mortar, a spiral from the ledger core and, at half health, column strikes. */
function updateUnderwriter(e, dt) {
  e.x = lerp(e.x, e.targetX, dt * 0.8);
  e.y = 362 + Math.sin(e.age * 0.55) * 70;
  if (e.age < 3) return;
  const newPhase = e.hp < e.maxhp * 0.5 ? 2 : 1;
  if (newPhase !== e.phase) {
    e.phase = newPhase;
    e.colClock = 1.5;
    toast('FORECLOSURE PROTOCOL', 'COLUMN STRIKES ONLINE. WATCH THE MARKED LANES.', 3);
    radio('It marks a lane before it drops the hammer. Keep moving sideways.', 'CONTROL / THREAT WARNING', 4.5);
    G.shake = 9;
    burst(e.x - 30, e.y, 45, '#ff8d68', 280, true);
  }
  const p2 = e.phase === 2;
  for (let i = 0; i < e.guns.length; i++) {
    const g = e.guns[i];
    g.flash = Math.max(0, g.flash - dt * 6);
    if (g.dead) continue;
    g.fire -= dt;
    if (g.fire > 0) continue;
    const x = e.x + g.x, y = e.y + g.y;
    if (g.kind === 'battery') {
      for (let k = 0; k < 5; k++) enemyBullet(x - 20, y - 10, -(110 + k * 48) * (p2 ? 1.12 : 1), -150 - k * 14, 7, 'lob', '#ffc07a', 300);
      g.fire = p2 ? 2.5 : 3.3;
      glowFlash(x - 20, y - 10, 30, '#ffc07a');
      audio.tone(200, 0.2, 'square', 0.04, 0, 90);
    } else {
      fireAimed(x - 60, y, p2 ? 235 : 205, p2 ? 5 : 3, 0.13, 7);
      g.fire = p2 ? 1.6 : 2.1;
      glowFlash(x - 60, y, 28, '#ffba82');
    }
  }
  // Ledger core: a fan of notes in phase 1, a two-arm spiral in phase 2.
  const coreX = e.x - 88, coreY = e.y - 3;
  if (!p2) {
    if (e.fire <= 0) {
      for (let i = 0; i < 12; i++) {
        const a = Math.PI - 0.95 + i * 0.17 + Math.sin(e.age) * 0.1;
        enemyBullet(coreX, coreY, Math.cos(a) * 175, Math.sin(a) * 175, 6, 'orb', '#ffd28a');
      }
      e.fire = 2.4;
    }
  } else {
    const active = e.age % 5 < 2.6;
    e.spiralT -= dt;
    if (active && e.spiralT <= 0) {
      e.spiral += 0.37;
      for (const arm of [0, Math.PI]) {
        const a = e.spiral + arm;
        enemyBullet(coreX, coreY, Math.cos(a) * 165, Math.sin(a) * 165, 6, 'orb', '#ffd28a');
      }
      e.spiralT = difficulty === 'story' ? 0.15 : 0.11;
    }
    e.colClock -= dt;
    if (e.colState === 0 && e.colClock <= 0) {
      e.colState = 1;
      e.colTimer = difficulty === 'story' ? 1.4 : 1.15;
      e.cols[0] = clamp(P.x, 90, 960);
      e.cols[1] = clamp(P.x + (P.x > 520 ? -230 : 230), 90, 960);
      audio.tone(130, 0.7, 'sawtooth', 0.06, 0, 410);
    } else if (e.colState === 1) {
      e.colTimer -= dt;
      if (e.colTimer <= 0) {
        e.colState = 2;
        e.colTimer = 0.6;
        audio.hiss(0.6, 0.19, 2200);
        audio.tone(80, 0.6, 'sawtooth', 0.07);
        G.shake = 7;
        input.rumble(0.4, 200);
      }
    } else if (e.colState === 2) {
      e.colTimer -= dt;
      for (const c of e.cols) if (Math.abs(P.x - c) < 25) hitPlayer();
      if (e.colTimer <= 0) {
        e.colState = 0;
        e.colClock = 4.6;
      }
    }
    if (Math.floor((e.age - dt) / 9) !== Math.floor(e.age / 9)) {
      spawn('auditor', 200, { x: W + 60, holdX: 990 });
      spawn('auditor', 600, { x: W + 140, holdX: 1010 });
    }
  }
}

function updateShots(dt) {
  for (const s of shots) {
    if (s.dead) continue;
    s.life -= dt;
    s.px = s.x;
    s.py = s.y;
    if (s.type === 'missile') {
      if (!s.target || s.target.dead || s.target.x < P.x - 150) {
        s.target = null;
        let bestD = 1e9;
        for (const e of enemies) {
          if (e.dead || e.x < s.x - 70 || e.type === 'ad') continue;
          const d = dist(s.x, s.y, e.x, e.y);
          if (d < bestD) {
            bestD = d;
            s.target = e;
          }
        }
      }
      if (s.target) {
        const a = Math.atan2(s.target.y - s.y, s.target.x - s.x), speed = 530;
        s.vx = lerp(s.vx, Math.cos(a) * speed, dt * 5.1);
        s.vy = lerp(s.vy, Math.sin(a) * speed, dt * 5.1);
      } else {
        s.vx = lerp(s.vx, 590, dt * 3);
        s.vy *= 1 - dt * 0.9;
      }
      if (Math.random() < 0.65) particles.push({ x: s.x - 6, y: s.y, vx: -25, vy: rand(-9, 9), life: 0.23, max: 0.23, size: 4, color: '#b7a1e2', type: 'smoke' });
    }
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    for (const e of enemies) {
      if (e.dead || s.dead || e.x > W + 100 || ((e.type === 'mini' || e.type === 'boss') && e.age < 2.7)) continue;
      if (e.type === 'boss') {
        let intercepted = false;
        for (let i = 0; i < e.guns.length; i++) {
          const gun = e.guns[i];
          const gx = e.x + gun.x - (gun.kind === 'battery' ? 0 : 20), gr = gun.kind === 'battery' ? 34 : 40;
          if (!gun.dead && segmentHit(s.px, s.py, s.x, s.y, gx, e.y + gun.y, gr + s.r)) {
            intercepted = hitShot(s, e, 'gun' + i);
            if (s.dead) break;
          }
        }
        const cx = e.x + (e.variant === 2 ? -20 : -25), cr = e.variant === 2 ? 92 : 89;
        if (!s.dead && !intercepted && segmentHit(s.px, s.py, s.x, s.y, cx, e.y, cr + s.r)) hitShot(s, e);
      } else {
        if (e.shield > 0 && segmentHit(s.px, s.py, s.x, s.y, e.x - 36, e.y, 36 + s.r)) {
          hitShot(s, e, 'shield');
          if (s.dead) break;
        }
        if (e.pod && !e.podLost) {
          const pp = enemyPodPos(e);
          if (segmentHit(s.px, s.py, s.x, s.y, pp.x, pp.y, 20 + s.r)) {
            hitShot(s, e, 'pod');
            if (s.dead) break;
          }
        }
        if (segmentHit(s.px, s.py, s.x, s.y, e.x, e.y, e.r + s.r)) hitShot(s, e);
      }
    }
    if (s.life <= 0 || s.x > W + 200 || s.x < -120 || s.y < -80 || s.y > H + 80) s.dead = true;
  }
  sweep(shots, notDead);
  for (const b of bullets) {
    b.px = b.x;
    b.py = b.y;
    if (b.ay) b.vy += b.ay * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.age += dt;
    b.life -= dt;
    if (P.alive && P.inv <= 0 && segmentHit(b.px, b.py, b.x, b.y, P.x, P.y, b.r + 8)) {
      hitPlayer();
      b.dead = true;
    }
    // Lobbed mortar rounds may arc above the field before they fall back in.
    const top = b.ay ? -120 : 85;
    if (b.life <= 0 || b.x < -70 || b.x > W + 100 || b.y < top || b.y > 744) b.dead = true;
  }
  sweep(bullets, notDead);
}

function updateParticles(dt) {
  for (const p of particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.type === 'debris') {
      p.vy += 190 * dt;
      p.rot += p.spin * dt;
    } else if (p.type !== 'flash') {
      p.vx *= 1 - dt * 1.5;
      p.vy *= 1 - dt * 1.5;
    }
  }
  sweep(particles, hasLife);
  if (particles.length > MAX_PARTICLES) particles.splice(0, particles.length - MAX_PARTICLES);
  for (const r of rings) {
    r.life -= dt;
    r.r += r.speed * dt;
  }
  sweep(rings, hasLife);
  for (const f of floats) {
    f.life -= dt;
    f.y -= 27 * dt;
    f.x -= 18 * dt;
  }
  sweep(floats, hasLife);
}

function updatePickups(dt) {
  for (const item of pickups) {
    item.age += dt;
    item.life -= dt;
    if (P.alive && dist(item.x, item.y, P.x, P.y) < 142) {
      item.magnet = true;
      item.vx = lerp(item.vx, (P.x - item.x) * 8, dt * 10);
      item.vy = lerp(item.vy, (P.y - item.y) * 8, dt * 10);
    } else {
      // Bug fix: the magnet line used to stay drawn after the ship flew out of range.
      item.magnet = false;
      item.vx = lerp(item.vx, -80, dt * 0.7);
      item.vy = Math.sin(item.age * 3) * 14;
    }
    item.x += item.vx * dt;
    item.y += item.vy * dt;
    item.y = clamp(item.y, 136, 660);
    if (P.alive && dist(item.x, item.y, P.x, P.y) < 38) collect(item);
    if (item.x < -90 || item.life <= 0) item.dead = true;
  }
  sweep(pickups, notDead);
}

function updatePlayer(dt) {
  P.inv = Math.max(0, P.inv - dt);
  P.fire -= dt;
  P.podFire -= dt;
  P.armPose = lerp(P.armPose, P.arm, Math.min(1, dt * 12));
  if (!P.alive) {
    if (G.respawn > 0) {
      G.respawn -= dt;
      if (G.respawn <= 0) {
        Object.assign(P, { alive: true, hp: P.maxhp, x: 160, y: 400, vx: 0, vy: 0, inv: 3, gun: 'RAPID', ammo: 180, maxAmmo: 240 });
        pointer.active = false;
        burst(P.x, P.y, 24, '#a5e8d7', 110);
        G.shake = 3;
      }
    }
    return;
  }
  if (G.bossDead) {
    P.vx = lerp(P.vx, 190, dt * 0.7);
    P.x += P.vx * dt;
    P.y = lerp(P.y, 360, dt);
    P.tilt = lerp(P.tilt, 0, dt * 4);
    return;
  }
  const mv = input.vector('move');
  const mx = mv.x, my = -mv.y;
  P.focus = input.down('focus');
  const speed = P.focus ? 205 : 415;
  if (pointer.active) {
    const dx = pointer.x - P.x, dy = pointer.y - P.y;
    P.vx = clamp(dx * 9, -speed * 1.28, speed * 1.28);
    P.vy = clamp(dy * 9, -speed * 1.28, speed * 1.28);
  } else {
    P.vx = lerp(P.vx, mx * speed, Math.min(1, dt * 14));
    P.vy = lerp(P.vy, my * speed, Math.min(1, dt * 14));
  }
  P.x = clamp(P.x + P.vx * dt, 57, G.bossSpawned ? 995 : W - 81);
  P.y = clamp(P.y + P.vy * dt, 143, 658);
  P.tilt = lerp(P.tilt, -P.vy * 0.00048, dt * 8);
  if (autoFire || input.down('fire') || pointer.active) firePrimary();
  if (input.down('pod')) firePod();
}

const UI_TIMERS = [
  ['toastTimer', UI.toast],
  ['radioTimer', UI.radio],
  ['chapterTimer', UI.missionCard],
  ['warningTimer', UI.warning],
];

function update(dt) {
  if (state !== 'playing') return;
  G.time += dt;
  G.scroll += dt * (G.bossSpawned ? 23 : G.miniSpawned && !G.miniDone ? 40 : 69);
  const miniBlocking = G.miniSpawned && !G.miniDone;
  if (!miniBlocking && !G.bossSpawned) G.t += dt;
  while (G.events < OP.waves.length && G.t >= OP.waves[G.events].t) OP.waves[G.events++].f();
  G.shake = Math.max(0, G.shake - dt * 19);
  G.damage = Math.max(0, G.damage - dt * 1.7);
  G.white = Math.max(0, G.white - dt * 1.9);
  if (G.chainTime > 0) {
    G.chainTime -= dt;
    if (G.chainTime <= 0) {
      G.chain = 0;
      G.mult = 1;
    }
  }
  for (const [timer, el] of UI_TIMERS) {
    if (G[timer] > 0) {
      G[timer] -= dt;
      if (G[timer] <= 0) el.classList.remove('show');
    }
  }
  updatePlayer(dt);
  updateEnemies(dt);
  updateShots(dt);
  updatePickups(dt);
  updateParticles(dt);
  if (state !== 'playing') return;
  if (G.bossDead) {
    if (Math.random() < dt * 9) burst(rand(930, 1260), rand(290, 650), 20, '#ffaa71', rand(170, 320), true);
    G.endTimer -= dt;
    if (G.endTimer <= 0) finish(true);
  } else if (!P.alive && P.reserve === 0 && G.respawn <= 0 && G.endTimer > 0) {
    G.endTimer -= dt;
    if (G.endTimer <= 0) finish(false);
  }
}

/* ------------------------------------------------------------------ drawing */

const C = (s) => col(s);
const C_EXH_A = col('#7fe5cfaa'), C_EXH_B = col('#e7ffeccc');

function exhaust(b, x, y, size = 1, color = '#a9f3db', power = 1) {
  const len = (32 + Math.sin(visualTime * 61) * 7) * size * power;
  b.tri(x + 2, y - 4 * size, x - len, y, x + 2, y + 4 * size, C_EXH_A);
  b.tri(x + 2, y - 2 * size, x - len * 0.72, y, x + 2, y + 2 * size, C_EXH_B);
  b.glow(x - 10 * size, y, 24 * size, C(color), 0.3);
}

function strokeRect(b, x, y, w, h, c, width = 1, a = 1) {
  b.line(x - width / 2, y, x + w + width / 2, y, c, width, a);
  b.line(x - width / 2, y + h, x + w + width / 2, y + h, c, width, a);
  b.line(x, y, x, y + h, c, width, a);
  b.line(x + w, y, x + w, y + h, c, width, a);
}

function drawPlayer(x = P.x, y = P.y, scale = 1, menu = false) {
  if (!P.alive && !menu) return;
  const tilt = menu ? -0.03 : P.tilt, rx = menu ? 0.35 : 0.3, ry = menu ? -0.33 : -0.2;
  const arm = menu ? 1 : P.armPose;
  const alpha = !menu && P.inv > 0 && Math.floor(P.inv * 13) % 2 === 0 ? 0.45 : 1;
  const o = ORDER.player;
  gfx.frame(x, y, scale, rx, ry, tilt, Z.player);
  const back = F.playerBack.a;
  back.alpha = alpha;
  const power = menu ? 1.5 : 1 + Math.max(0, P.vx) / 1000;
  let p = gfx.pt(-57, -2, -25);
  exhaust(back, p.x, p.y, scale, '#8ae2d4', power);
  p = gfx.pt(-57, -2, 25);
  exhaust(back, p.x, p.y, scale, '#9bf5df', menu ? 1.55 : power);
  back.alpha = 1;
  // The articulated arm, in the ship's own frame.
  gfx.joint(-12, -10 * arm, 20, 8, colors.slate, 0, alpha, o);
  gfx.rod(-12, -10 * arm, 20, -24, -30 * arm, 20, 7, 8, colors.dark, 0, alpha, o);
  gfx.joint(-24, -30 * arm, 20, 6, colors.pearl, 0, alpha, o);
  gfx.rod(-24, -30 * arm, 20, 12, -38 * arm, 20, 6, 7, colors.slate, 0, alpha, o);
  gfx.box(10, -38 * arm, 20, 19, 7, 8, colors.dark, 0, alpha, o);
  gfx.model('player', x, y, scale, rx, ry, tilt, 0, alpha, Z.player, o);
  if (menu || P.gun) {
    p = gfx.pt(16, -42 * arm, 20);
    gfx.model(menu ? 'LANCE' : P.gun, p.x, p.y, scale * 0.91, rx, ry, tilt, 0, alpha * (!menu && P.ammo <= 0 ? 0.55 : 1), p.z + 6 * scale, o);
  }
  if (menu) return;
  const fn = F.playerFront.n, fa = F.playerFront.a;
  fn.alpha = fa.alpha = alpha;
  if (P.inv > 0) fn.ellipse(x, y, 67, 44, 0, C('#ade4d46b'), 1.2);
  if (P.focus) {
    fa.glow(x, y, 19, C('#90f5ea'), 0.5);
    fn.circle(x, y, 5, C('#102834'));
    fn.circle(x, y, 2.8, C('#e4fff5'));
    fn.ring(x, y, 8, C('#a4f9d5'), 1);
  }
  fn.alpha = fa.alpha = 1;
}

function drawBossLeg(e, side) {
  const front = side === 1, x = e.x + (front ? 31 : 60), hipY = e.y + 69;
  const step = Math.sin(e.age * 1.9 + (front ? 0 : Math.PI));
  const kx = x - 60 + step * 24, ky = hipY + 113;
  const fx = x + step * 48 - 8, fy = 686;
  const z = Z.boss + side * 15, fl = e.flash * 0.3;
  gfx.rodW(x, hipY, kx, ky, z, 31, 31, front ? '#788d8d' : '#354d58', fl);
  gfx.rodW(kx, ky, fx, fy - 17, z, 22, 22, front ? '#c0c6b5' : '#546e70', fl);
  gfx.jointW(x, hipY, z, 25, colors.dark, fl);
  gfx.jointW(kx, ky, z, 22, front ? colors.slate : colors.dark, fl);
  gfx.footW(fx, z, front ? '#6e8685' : '#263d48', fl);
  if (front) {
    const d = F.bossDecal.n;
    d.line(x - 8, hipY + 24, kx - 12, ky - 10, C('#e0d5b355'), 4);
    d.line(kx + 11, ky + 17, fx + 11, 660, C('#263d43'), 5);
    d.circle(kx, ky, 7, C('#d6b785'));
    d.circle(kx, ky, 3, C('#1d3941'));
  }
}

function drawGunMounts(e, anchors) {
  const en = F.enemyFront.n;
  for (let i = 0; i < e.guns.length; i++) {
    const gun = e.guns[i], xx = e.x + gun.x, yy = e.y + gun.y;
    if (gun.dead) {
      burstSmoke(xx, yy);
      continue;
    }
    const fl = gun.flash;
    if (gun.kind === 'battery') {
      gfx.rodW(e.x + 64, e.y - 140, xx, yy + 8, Z.boss + 40, 16, 16, '#465b61', fl * 0.3);
      gfx.model('battery', xx, yy, 1.2, 0.19, 0.11, 0, fl, 1, Z.boss + 70);
      en.rect(xx - 28, yy - 30, (56 * gun.hp) / gun.maxhp, 2, C('#ff9867'));
      continue;
    }
    let a = Math.atan2(P.y - yy, P.x - xx) - Math.PI;
    a = clamp(a < -Math.PI ? a + TAU : a, -0.34, 0.34);
    const an = anchors[i];
    gfx.rodW(e.x + an[0], e.y + an[1], xx + 32, yy, Z.boss + 110, 22, 22, '#465b61', fl * 0.3);
    gfx.jointW(xx + 27, yy, Z.boss + 125, 17, '#a6afa0', fl * 0.3);
    gfx.model('bossGun', xx, yy, 1.2, 0.19, 0.12, -a, fl, 1, Z.boss + 150);
    en.rect(xx - 33, yy - 39, (57 * gun.hp) / gun.maxhp, 2, C('#ff9867'));
  }
}

function drawCore(e, lx, ly, lz, scale) {
  gfx.frame(e.x, e.y, scale, 0.19, 0.11, 0, Z.boss);
  const core = gfx.pt(lx, ly, lz);
  const exposed = e.guns.every((g) => g.dead);
  F.enemyFront.a.glow(core.x, core.y, exposed ? 54 : 31, C(exposed ? '#b9ffe0' : '#ffb176'), exposed ? 0.43 : 0.2);
  if (exposed) {
    F.enemyFront.n.circle(core.x, core.y, 14, C('#abf6d5'));
    F.enemyFront.n.circle(core.x, core.y, 6, C('#effff0'));
  }
}

const BOSS_ANCHORS = [[10, -50], [10, 47]];
const UW_ANCHORS = [[-40, -50], [-30, 52], [0, 0]];

function drawEnemy(e) {
  const eb = F.enemyBack.a, en = F.enemyFront.n, ea = F.enemyFront.a, z = Z.enemy;
  switch (e.type) {
    case 'scout':
      exhaust(eb, e.x + 34, e.y, 0.8, '#ffc083', -0.8);
      gfx.model('scout', e.x, e.y, 1.08, 0.24, 0.16, Math.sin(e.age * 2.6) * 0.08, e.flash, 1, z);
      break;
    case 'carrier':
      exhaust(eb, e.x + 57, e.y, 1, '#ff9975', -1);
      gfx.model('carrier', e.x, e.y, 1.13, 0.28, 0.17, Math.sin(e.age * 1.6) * 0.04, e.flash, 1, z);
      if (!e.podLost) {
        const pp = enemyPodPos(e);
        gfx.rodW(e.x + 12, e.y + e.podSide * 17, pp.x, pp.y, z + 45, 6, 6, '#8b9d97', e.flash * 0.5);
        gfx.model(e.pod, pp.x, pp.y, 0.82, 0.2, -0.1, Math.PI, e.flash * 0.5, 1, z + 60);
      }
      if (e.x < W - 50) drawEnemyHealth(e);
      break;
    case 'crawler':
      gfx.model('crawler', e.x, e.y, 1.15, 0.28, 0.17, 0, e.flash, 1, z);
      if (!e.podLost) {
        const pp = enemyPodPos(e);
        gfx.rodW(e.x + 4, e.y - 14, pp.x + 8, pp.y, z + 45, 8, 8, '#99b1a5', e.flash * 0.4);
        gfx.model(e.pod, pp.x, pp.y, 0.98, 0.28, 0.1, Math.PI, e.flash * 0.4, 1, z + 60);
      }
      drawEnemyHealth(e);
      break;
    case 'mine':
      gfx.model('mine', e.x, e.y, 1, 0.2, 0.1, e.age * 0.6, e.flash, 1, z);
      ea.glow(e.x, e.y, 29, C('#ffb377'), 0.2);
      break;
    case 'auditor':
      exhaust(eb, e.x + 30, e.y, 0.7, '#ff9a8a', -0.7);
      gfx.model('auditor', e.x, e.y, 1.05, 0.26, 0.18, Math.sin(e.age * 1.7) * 0.05, e.flash, 1, z);
      if (e.lock > 0) {
        const lx = e.x - 23, ly = e.y;
        let dx = e.aimX - lx, dy = e.aimY - ly;
        const len = Math.hypot(dx, dy) || 1;
        dx /= len;
        dy /= len;
        const frozen = e.lock <= 0.38;
        const ex = lx + dx * 1700, ey = ly + dy * 1700;
        if (frozen) {
          const blink = Math.sin(visualTime * 40) > 0 ? 1 : 0.55;
          ea.line(lx, ly, ex, ey, C('#ff6a4a'), 7, 0.22 * blink);
          en.line(lx, ly, ex, ey, C('#ffd0a8'), 2, blink);
        } else dashedLine(en, lx, ly, ex, ey, C('#ff9568aa'), 2, 14, 9);
        en.ring(e.aimX, e.aimY, 13, C('#ffb08a'), 1.5, 0.85);
        ea.glow(lx, ly, 22, C('#ff8f6a'), 0.5);
      }
      drawEnemyHealth(e);
      break;
    case 'bailiff':
      exhaust(eb, e.x + 58, e.y - 10, 0.9, '#ff9975', -1);
      gfx.model('bailiff', e.x, e.y, 1.1, 0.26, 0.16, Math.sin(e.age * 1.3) * 0.04, e.flash, 1, z);
      if (e.shield > 0) {
        gfx.model('bailiffShield', e.x - 36, e.y, 1.1, 0.2, 0.3, Math.sin(e.age * 1.3) * 0.04, Math.max(e.shieldFlash * 0.6, e.flash * 0.3), 1, z + 70);
        en.rect(e.x - 62, e.y - 62, 52, 3, C('#0c202799'));
        en.rect(e.x - 62, e.y - 62, 52 * clamp(e.shield / e.shieldMax, 0, 1), 3, C('#9fe3d6'));
      }
      drawEnemyHealth(e);
      break;
    case 'mini': {
      const v2 = e.variant === 2;
      for (const y of [-28, 35]) exhaust(eb, e.x + 115, e.y + y, 1.5, v2 ? '#ff9a8a' : '#ffba77', -1.6);
      gfx.model('mini', e.x, e.y, 1.3, 0.31, 0.13, Math.sin(e.age) * 0.035, e.flash, 1, z, 0, v2 ? '#e7c4c4' : null);
      if (!e.podLost) {
        const pp = enemyPodPos(e);
        gfx.rodW(e.x - 20, e.y + 38, pp.x, pp.y, z + 70, 10, 10, '#899b95', e.flash * 0.4);
        gfx.model(e.pod, pp.x, pp.y, 1.25, 0.22, 0.1, Math.PI, e.flash * 0.4, 1, z + 90);
      }
      ea.glow(e.x - 90, e.y - 20, 28, C(v2 ? '#ff8a9a' : '#ffa875'), 0.22);
      break;
    }
    case 'boss':
      if (e.variant === 2) drawUnderwriter(e);
      else drawDebtCollector(e);
      break;
    case 'ad': {
      const w = 80, h = 81;
      en.line(e.x + 19, e.y + 37, e.x + 19, 689, C('#496864'), 6);
      en.line(e.x + 20, e.y + 37, e.x + 20, 689, C('#0e222b'), 3);
      en.rect(e.x - w / 2 - 6, e.y - h / 2 - 6, w + 12, h + 12, C('#142c30'));
      strokeRect(ea, e.x - w / 2, e.y - h / 2, w, h, C('#ff9c65'), 9, 0.2);
      strokeRect(en, e.x - w / 2, e.y - h / 2, w, h, C('#ffb879'), 2);
      en.text(e.words[0], e.x, e.y - 7, 21, C(e.flash ? '#fff5d5' : '#e3b787'), 'center');
      en.text(e.words[1] || '//', e.x, e.y + 19, 22, C('#ffdca9'), 'center');
      en.text('PUBLIC NOTICE', e.x, e.y + 55, 8, C('#caa385'), 'center');
      if (e.flash) en.rect(e.x - w / 2, e.y - h / 2, w, h, C('#ffe6bd55'));
      break;
    }
  }
}

function drawDebtCollector(e) {
  drawBossLeg(e, -1);
  drawBossLeg(e, 1);
  gfx.model('boss', e.x, e.y, 1.38, 0.19, 0.11, Math.sin(e.age * 0.72) * 0.015, e.flash, 1, Z.boss);
  drawGunMounts(e, BOSS_ANCHORS);
  drawCore(e, -34, -3, 73, 1.38);
  if (e.beamState) {
    const en = F.enemyFront.n, ea = F.enemyFront.a;
    const y = e.beamY, x = e.x - 84;
    if (e.beamState === 1) {
      dashedLine(en, 0, y, x, y, C('#ff9568aa'), 2, 14, 9);
      en.rect(0, y - 23, x, 46, C('#ff835316'));
      en.text('BEAM LOCK', 90, y - 30, 11, C('#ffc28d'));
      for (let j = 0; j < 5; j++) en.circle(x - 25 + Math.cos(visualTime * 8 + j * 1.25) * 25, y + Math.sin(visualTime * 8 + j * 1.25) * 25, 3, C('#ffe0af'));
      ea.glow(x, y, 50, C('#ffae71'), 0.6);
    } else {
      const rr = 22 + Math.sin(visualTime * 88) * 3;
      ea.rect(0, y - rr - 18, x, rr * 2 + 36, C('#ff72433c'));
      ea.rect(0, y - rr, x, rr * 2, C('#ff9a799c'));
      ea.rect(0, y - rr * 0.45, x, rr * 0.9, C('#ffe6bd'));
      ea.rect(0, y - 4, x, 8, C('#fffdf2'));
      ea.glow(x, y, 80, C('#ffc18a'), 0.6);
    }
  }
}

function drawUnderwriter(e) {
  const eb = F.enemyBack.a;
  for (const y of [48, 62]) exhaust(eb, e.x + 150, e.y + y, 1.6, '#ffba77', -1.7);
  exhaust(eb, e.x + 128, e.y - 120, 1.1, '#ffd28a', -1.2);
  gfx.model('underwriter', e.x, e.y, 1.38, 0.19, 0.11, Math.sin(e.age * 0.55) * 0.02, e.flash, 1, Z.boss);
  drawGunMounts(e, UW_ANCHORS);
  drawCore(e, -64, 2, 63, 1.38);
  if (e.colState) {
    const en = F.enemyFront.n, ea = F.enemyFront.a;
    for (const cx of e.cols) {
      if (e.colState === 1) {
        dashedLine(en, cx, 85, cx, 688, C('#ff9568aa'), 2, 14, 9);
        en.rect(cx - 25, 85, 50, 603, C('#ff835316'));
        en.text('FORECLOSURE', cx, 108, 11, C('#ffc28d'), 'center');
        for (let j = 0; j < 4; j++) en.circle(cx + Math.cos(visualTime * 8 + j * 1.57) * 22, 140 + Math.sin(visualTime * 8 + j * 1.57) * 22, 3, C('#ffe0af'));
        ea.glow(cx, 140, 44, C('#ffae71'), 0.55);
      } else {
        const rr = 22 + Math.sin(visualTime * 88) * 3;
        ea.rect(cx - rr - 18, 60, rr * 2 + 36, 630, C('#ff72433c'));
        ea.rect(cx - rr, 60, rr * 2, 630, C('#ff9a799c'));
        ea.rect(cx - rr * 0.45, 60, rr * 0.9, 630, C('#ffe6bd'));
        ea.rect(cx - 4, 60, 8, 630, C('#fffdf2'));
        ea.glow(cx, 688, 80, C('#ffc18a'), 0.6);
      }
    }
  }
}

function dashedLine(b, x1, y1, x2, y2, c, width, dash, gap) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 1) return;
  const dx = (x2 - x1) / len, dy = (y2 - y1) / len;
  for (let s = 0; s < len; s += dash + gap) {
    const e = Math.min(len, s + dash);
    b.line(x1 + dx * s, y1 + dy * s, x1 + dx * e, y1 + dy * e, c, width);
  }
}

function burstSmoke(x, y) {
  if (state === 'playing' && Math.random() < 0.2) particles.push({ x, y, vx: rand(-26, 6), vy: rand(-45, -10), life: 0.8, max: 0.8, size: rand(12, 25), color: '#4f6563', type: 'smoke' });
}

function drawEnemyHealth(e) {
  if (e.hp >= e.maxhp) return;
  const n = F.enemyFront.n;
  n.rect(e.x - 26, e.y - e.r - 17, 52, 3, C('#0c202799'));
  n.rect(e.x - 26, e.y - e.r - 17, 52 * clamp(e.hp / e.maxhp, 0, 1), 3, C('#e8a979'));
}

const C_REPAIR_BG = col('#243d3e'), C_REPAIR_LINE = col('#c7edba'), C_REPAIR_X = col('#d2efbe');
function drawPickups() {
  const bn = F.pickBack.n, ba = F.pickBack.a, fn = F.pickFront.n;
  for (const p of pickups) {
    const c = C(p.type === 'REPAIR' ? '#bce8b2' : PODS[p.type].color);
    const fade = p.life < 3 && Math.sin(visualTime * 19) < 0 ? 0.35 : 1;
    bn.alpha = ba.alpha = fn.alpha = fade;
    ba.glow(p.x, p.y, 52, c, 0.15);
    bn.ellipse(p.x, p.y, 43, 29, Math.sin(p.age * 2) * 0.1, c, 1, 1, 9, 8);
    if (p.type === 'REPAIR') {
      const x = p.x, y = p.y;
      fn.poly([x - 16, y - 12, x + 10, y - 12, x + 17, y - 4, x + 17, y + 12, x - 16, y + 12], C_REPAIR_BG);
      fn.line(x - 16, y - 12, x + 10, y - 12, C_REPAIR_LINE, 1);
      fn.line(x + 10, y - 12, x + 17, y - 4, C_REPAIR_LINE, 1);
      fn.line(x + 17, y - 4, x + 17, y + 12, C_REPAIR_LINE, 1);
      fn.line(x + 17, y + 12, x - 16, y + 12, C_REPAIR_LINE, 1);
      fn.line(x - 16, y + 12, x - 16, y - 12, C_REPAIR_LINE, 1);
      fn.rect(x - 3, y - 9, 6, 18, C_REPAIR_X);
      fn.rect(x - 9, y - 3, 18, 6, C_REPAIR_X);
    } else {
      gfx.model(p.type, p.x, p.y, 0.78, 0.3, Math.sin(p.age * 2) * 0.3, Math.sin(p.age * 3) * 0.07, 0, fade, Z.pickup, ORDER.pickup);
    }
    fn.text(p.type, p.x, p.y - 43, 12, c, 'center');
    if (p.magnet && P.alive) {
      const mx = (p.x + P.x) / 2 + rand(-7, 7), my = (p.y + P.y) / 2 + rand(-7, 7);
      fn.line(p.x, p.y, mx, my, c, 1, 0.6);
      fn.line(mx, my, P.x, P.y + P.armPose * 25, c, 1, 0.6);
    }
  }
  bn.alpha = ba.alpha = fn.alpha = 1;
}

const C_LANCE = [col('#70eed421'), col('#82ebd670'), col('#dafff0')];
const C_MISSILE = col('#eadcfd'), C_MTRAIL = col('#bb94ef'), C_HALO = col('#ff845725'), C_CORE = col('#fff3cc');
function drawShots() {
  const b = F.shots.a;
  for (const s of shots) {
    if (s.type === 'lance') {
      const m = Math.hypot(s.vx, s.vy) || 1, dx = s.vx / m, dy = s.vy / m, len = 88;
      b.line(s.x - dx * len, s.y - dy * len, s.x + dx * 18, s.y + dy * 18, C_LANCE[0], 22);
      b.line(s.x - dx * len, s.y - dy * len, s.x + dx * 15, s.y + dy * 15, C_LANCE[1], 10);
      b.line(s.x - dx * len, s.y - dy * len, s.x + dx * 12, s.y + dy * 12, C_LANCE[2], 3.5);
    } else if (s.type === 'missile') {
      const a = Math.atan2(s.vy, s.vx), ca = Math.cos(a), sa = Math.sin(a);
      b.tri(s.x + ca * 9, s.y + sa * 9, s.x - ca * 7 + sa * 4, s.y - sa * 7 - ca * 4, s.x - ca * 6 - sa * 4, s.y - sa * 6 + ca * 4, C_MISSILE);
      b.line(s.x - ca * 7, s.y - sa * 7, s.x - ca * 21, s.y - sa * 21, C_MTRAIL, 3);
    } else {
      const len = s.type === 'rapid' ? 26 : 19, c = C(s.color);
      b.line(s.x - len, s.y, s.x + 6, s.y, c, 9, 0x40 / 255);
      b.line(s.x - len, s.y, s.x + 6, s.y, c, s.type === 'rapid' ? 3.4 : 2.2);
    }
  }
  for (const bl of bullets) {
    const c = C(bl.color);
    if (bl.type === 'bolt') {
      const m = Math.hypot(bl.vx, bl.vy) || 1, dx = bl.vx / m, dy = bl.vy / m;
      b.line(bl.x - dx * 46, bl.y - dy * 46, bl.x + dx * 6, bl.y + dy * 6, c, 12, 0.3);
      b.line(bl.x - dx * 40, bl.y - dy * 40, bl.x + dx * 4, bl.y + dy * 4, c, 5);
      b.circle(bl.x, bl.y, 4, C_CORE);
    } else {
      b.circle(bl.x, bl.y, bl.r + 6, C_HALO);
      b.circle(bl.x, bl.y, bl.r, c);
      b.circle(bl.x, bl.y, bl.r * 0.48, C_CORE);
    }
  }
}

const C_DEBRIS = col('#9ba393'), C_EMP_IN = col('#d3ffdf'), C_SHADOW = col('#a4cfb510');
function drawEffects() {
  const n = F.fx.n, a = F.fx.a;
  for (const p of particles) {
    const al = clamp(p.life / p.max, 0, 1);
    const c = C(p.color);
    if (p.type === 'flash') a.glow(p.x, p.y, p.size * (2 - al), c, al);
    else if (p.type === 'smoke') n.circle(p.x, p.y, p.size * (1.5 - al * 0.5), c, (0x55 / 255) * al);
    else if (p.type === 'debris') {
      // A tumbling shard: three corners rotated by p.rot around the particle.
      const s = p.size, cr = Math.cos(p.rot), sr = Math.sin(p.rot);
      const ax = p.x - s * cr + (s / 2) * sr, ay = p.y - s * sr - (s / 2) * cr;
      const bx = p.x + s * cr - (s / 3) * sr, by = p.y + s * sr + (s / 3) * cr;
      const qx = p.x + (s / 2) * cr - s * sr, qy = p.y + (s / 2) * sr + s * cr;
      n.tri(ax, ay, bx, by, qx, qy, C_DEBRIS, al);
      n.line(ax, ay, bx, by, c, 1, al);
    } else a.line(p.x, p.y, p.x - p.vx * 0.033, p.y - p.vy * 0.033, c, p.size * 0.55, al);
  }
  for (const r of rings) {
    const al = clamp(r.life / r.max, 0, 1) * 0.75;
    n.ring(r.x, r.y, r.r, C(r.color), r.emp ? 5 : 2, al);
    if (r.emp) n.ring(r.x, r.y, r.r * 0.94, C_EMP_IN, 1, al);
  }
  for (const f of floats) n.text(f.text, f.x, f.y, f.size, C(f.color), 'center', Math.min(1, f.life * 2));
  if (P.alive && state === 'playing' && P.y > 590) n.sprite(P.x + 18 - 80, 690 - 7, P.x + 18 + 80, 690 + 7, n.atlas.disc, C_SHADOW);
}

function drawTitle() {
  const x = 1045 + Math.sin(visualTime * 0.55) * 13, y = 389 + Math.sin(visualTime * 0.92) * 13;
  const n = F.title.n, a = F.title.a;
  const ring = C('#86c7b817'), tick = C('#acd1ba4d');
  n.ring(x, y, 207, ring, 1);
  n.arc(x, y, 192, -0.25, 0.8, ring, 1);
  n.arc(x, y, 192, 2.5, 3.1, ring, 1);
  for (let i = 0; i < 4; i++) {
    const xx = x + Math.cos((i * Math.PI) / 2) * 222, yy = y + Math.sin((i * Math.PI) / 2) * 222;
    n.line(xx - 5, yy, xx + 5, yy, tick, 1);
    n.line(xx, yy - 5, xx, yy + 5, tick, 1);
  }
  a.glow(x - 15, y, 230, C('#70c5b020'), 0.4);
  drawPlayer(x, y, 3.28, true);
  n.text('GH–01 / SALVAGE-CLASS INTERCEPTOR', 991, 271, 9, C('#9ec7b3a0'), 'center');
}

function titleVisual() {
  return state === 'title' || (state === 'manual' && manualOrigin === 'title');
}

function render() {
  gfx.begin();
  const shaking = shakeOn && G.shake > 0 && state === 'playing';
  gfx.shake(shaking ? rand(-G.shake, G.shake) : 0, shaking ? rand(-G.shake, G.shake) * 0.62 : 0);
  const onTitle = titleVisual();
  // Bug fix: the manual opened from the title used to jump the skyline to the last raid's scroll.
  const scroll = onTitle ? visualTime * 18 + 320 : G.scroll;
  const gantry = G.phase >= 1 && !onTitle ? clamp((G.t - OP.phase1T) / 7, 0, 1) : 0;
  gfx.background(scroll, visualTime, gantry);
  if (onTitle) drawTitle();
  else {
    for (const e of enemies) drawEnemy(e);
    drawPickups();
    drawShots();
    drawPlayer();
    drawEffects();
  }
  gfx.effects(G.damage > 0 && !onTitle ? G.damage : 0, G.white > 0 && state === 'playing' ? G.white : 0);
  if (warmup) {
    gfx.warm();
    warmup = false;
  }
  gfx.end();
  gfx.render();
}

/* ------------------------------------------------------------------ HUD */

function syncHUD() {
  if (state === 'title') return;
  const hullKey = P.hp + '/' + P.maxhp;
  if (UI.hullBars.dataset.value !== hullKey) {
    UI.hullBars.innerHTML = Array.from({ length: P.maxhp }, (_, i) => `<i class="${i >= P.hp ? 'empty' : ''}"></i>`).join('');
    UI.hullBars.dataset.value = hullKey;
  }
  setText(UI.reserveText, '× ' + P.reserve.toString().padStart(2, '0'));
  setText(UI.flightModeText, difficulty.toUpperCase() + ' / ' + timeString(G.time));
  setText(UI.scoreText, scoreString(G.score));
  setText(UI.bestText, 'BEST ' + scoreString(Math.max(G.score, bestNow)));
  setText(UI.stageName, OP.sectors[G.phase] || OP.sectors[0]);
  setText(UI.sectorLabel, `OPERATION ${OP.code} / SECTOR 0${G.phase + 1}`);
  setStyle(UI.progressFill, 'width', Math.min(100, (G.t / OP.length) * 100).toFixed(1) + '%');
  setText(UI.armText, 'GUNPOD / ' + (P.arm === 1 ? 'LOWER ARM' : 'UPPER ARM'));
  setText(UI.weaponText, P.gun || 'UNARMED');
  setText(UI.ammoText, P.ammo.toString().padStart(3, '0'));
  setStyle(UI.ammoText, 'color', P.ammo === 0 ? '#f08f6b' : PODS[P.gun]?.color || '#aae6d2');
  setStyle(UI.ammoFill, 'width', ((P.ammo / Math.max(1, P.maxAmmo)) * 100).toFixed(1) + '%');
  setStyle(UI.ammoFill, 'background', PODS[P.gun]?.color || '#99decc');
  setText(UI.empText, '◆ '.repeat(G.emp) + '◇ '.repeat(Math.max(0, 2 - G.emp)));
  setText(UI.autoText, autoFire ? 'AUTO' : 'MANUAL');
  UI.autoText.classList.toggle('active', autoFire);
  if (UI.comboText._m !== G.mult) {
    UI.comboText._m = G.mult;
    UI.comboText.innerHTML = '<small>×</small> ' + G.mult.toString().padStart(2, '0');
  }
  setStyle(UI.comboFill, 'width', Math.max(0, (G.chainTime / 4) * 100).toFixed(1) + '%');
  const b = enemies.find((e) => e.type === 'boss' || e.type === 'mini');
  if (b) {
    show(UI.bossHud, true);
    setStyle(UI.bossFill, 'width', (clamp(b.hp / b.maxhp, 0, 1) * 100).toFixed(1) + '%');
    setText(UI.bossPhase, 'PHASE 0' + (b.phase || 1));
    setText(
      UI.bossDetail,
      b.type === 'mini'
        ? b.variant === 2 ? 'BREAK THE COURIER / SEIZE ITS LANCE' : 'REMOVE THE PATROL / SEIZE ITS GUN'
        : b.guns.every((g) => g.dead) ? 'CORE EXPOSED / ALL WEAPONS FREE'
        : b.variant === 2 ? 'BREAK THE MOUNTS. OPEN THE LEDGER.' : 'BREAK THE GUNS. EXPOSE THE CORE.'
    );
  }
}

/* ------------------------------------------------------------------ input */

function updateSoundLabel() {
  UI.soundButton.innerHTML = (soundOn ? 'SOUND ON' : 'SOUND OFF') + ' <kbd>M</kbd>';
}
function toggleSound() {
  audio.init();
  soundOn = !soundOn;
  audio.setEnabled(soundOn);
  prefs.sound = soundOn;
  savePrefs();
  updateSoundLabel();
}
function setAuto(on, announce = false) {
  autoFire = on;
  UI.autoOption.checked = on;
  prefs.autoFire = on;
  savePrefs();
  kit.touch?.setShown('fire', !autoFire);
  if (announce && state === 'playing') toast('PRIMARY FIRE / ' + (autoFire ? 'AUTO' : 'MANUAL'), autoFire ? 'FOCUS ON YOUR FLIGHT.' : `HOLD ${prompts().fire} TO FIRE.`, 1.8);
}
async function fullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    else document.body.classList.toggle('fullscreen');
  } catch {
    document.body.classList.toggle('fullscreen');
  }
}

const _gp = { x: 0, y: 0 };
/** Mouse: hold the left button to steer toward the cursor. Touch: drag anywhere free to fly, like the original. */
function readPointer() {
  const p = input.pointer;
  if (!P.alive) {
    pointer.active = false;
    return;
  }
  const g = gfx.toGame(p.x, p.y, _gp);
  if (p.type === 'mouse') {
    pointer.active = p.down && input.mouseButtons.has(0);
    if (pointer.active) {
      pointer.x = g.x;
      pointer.y = g.y;
    }
    return;
  }
  if (p.justDown) {
    pointer.active = true;
    pointer.lastX = g.x;
    pointer.lastY = g.y;
    pointer.x = P.x;
    pointer.y = P.y;
  } else if (p.down && pointer.active) {
    pointer.x = clamp(pointer.x + (g.x - pointer.lastX) * 1.12, 57, W - 81);
    pointer.y = clamp(pointer.y + (g.y - pointer.lastY) * 1.12, 143, 658);
    pointer.lastX = g.x;
    pointer.lastY = g.y;
  }
  if (!p.down) pointer.active = false;
}

/* Menus answer to the D-pad / stick / arrows, A / Enter, B / Backspace and Start / Esc. */
const MENUS = {
  title: { root: () => UI.titleScreen, confirm: () => startGame(0), back: null, pause: null },
  manual: { root: () => UI.manualScreen, confirm: closeManual, back: closeManual, pause: closeManual },
  paused: { root: () => UI.pauseScreen, confirm: resumeGame, back: resumeGame, pause: resumeGame },
  result: { root: () => UI.resultScreen, confirm: retry, back: null, pause: null },
};
const nav = { dir: 0, next: 0 };
let navFocused = null;

function clearNavFocus() {
  navFocused?.classList.remove('nav-focus');
  navFocused = null;
}
function markFocus(el) {
  clearNavFocus();
  if (!el) return;
  el.focus({ preventScroll: true });
  if (input.source !== 'touch') {
    el.classList.add('nav-focus');
    navFocused = el;
  }
}
function focusables(root) {
  return [...root.querySelectorAll('button, input')].filter((el) => !el.disabled && el.getClientRects().length > 0);
}
function menuOpened(primary) {
  clearNavFocus();
  if (input.source === 'gamepad' && primary && primary.getClientRects().length) markFocus(primary);
}
function menuInput() {
  const menu = MENUS[state];
  if (!menu) return;
  if (performance.now() < menuLock) {
    nav.dir = 0;
    return;
  }
  if (input.pressed('pause') && menu.pause) return menu.pause();
  if (input.pressed('back') && menu.back) return menu.back();
  const root = menu.root();
  const mv = input.vector('move');
  let dir = 0, horizontal = false;
  if (Math.abs(mv.y) > 0.5 && Math.abs(mv.y) >= Math.abs(mv.x)) dir = mv.y > 0 ? -1 : 1;
  else if (Math.abs(mv.x) > 0.5) {
    dir = mv.x > 0 ? 1 : -1;
    horizontal = true;
  }
  const now = performance.now();
  if (dir && (dir !== nav.dir || now >= nav.next)) {
    nav.next = now + (dir !== nav.dir ? 380 : 130);
    const list = focusables(root);
    const cur = list.indexOf(document.activeElement);
    const el = list[cur];
    if (horizontal && el && el.type === 'range') {
      el.value = clamp(Number(el.value) + dir * 5, Number(el.min), Number(el.max));
      el.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (list.length) {
      const i = cur < 0 ? (dir > 0 ? 0 : list.length - 1) : (cur + dir + list.length) % list.length;
      markFocus(list[i]);
      audio.menu();
    }
  }
  nav.dir = dir;
  if (input.pressed('confirm')) {
    const list = focusables(root);
    const el = list.includes(document.activeElement) ? document.activeElement : null;
    if (el) el.click();
    else menu.confirm();
  }
}

function handleInput() {
  if (input.pressed('sound')) toggleSound();
  if (input.pressed('full')) fullscreen();
  if (state === 'playing') {
    if (input.pressed('pause')) return pauseGame();
    if (input.pressed('flip')) flipArm();
    if (input.pressed('emp')) useEMP();
    if (input.pressed('auto')) setAuto(!autoFire, true);
    readPointer();
  } else menuInput();
}

/* ------------------------------------------------------------------ loop */

function frame(rawDt) {
  const dt = Math.min(rawDt, 0.05);
  handleInput();
  if (titleVisual() || state === 'playing') visualTime += dt;
  audio.info.playing = state === 'playing';
  audio.info.t = G.t;
  audio.info.boss = G.bossSpawned;
  if (state === 'playing') {
    accumulator += dt;
    let steps = 0;
    while (accumulator >= 1 / 60 && steps < 5) {
      update(1 / 60);
      accumulator -= 1 / 60;
      steps++;
    }
    if (steps === 5) accumulator = 0;
    audio.tick();
    uiClock += dt;
    if (uiClock > 0.1) {
      syncHUD();
      uiClock = 0;
    }
  } else accumulator = 0;
  render();
}

/* ------------------------------------------------------------------ wiring */

UI.startButton.addEventListener('click', () => startGame(0));
UI.continueButton.addEventListener('click', continueSaved);
UI.manualButton.addEventListener('click', openManual);
UI.closeManual.addEventListener('click', closeManual);
UI.storyButton.addEventListener('click', () => setDifficulty('story'));
UI.arcadeButton.addEventListener('click', () => setDifficulty('arcade'));
UI.op1Button.addEventListener('click', () => setOperation(1));
UI.op2Button.addEventListener('click', () => setOperation(2));
UI.resumeButton.addEventListener('click', resumeGame);
UI.restartButton.addEventListener('click', restartFromPause);
UI.pauseManualButton.addEventListener('click', openManual);
UI.pauseSettingsButton.addEventListener('click', () => kit.menu.open());
UI.exitButton.addEventListener('click', toTitle);
UI.resultExitButton.addEventListener('click', toTitle);
UI.retryButton.addEventListener('click', retry);
UI.nextOpButton.addEventListener('click', nextOperation);
UI.soundButton.addEventListener('click', toggleSound);
UI.fullButton.addEventListener('click', fullscreen);
UI.settingsButton.addEventListener('click', () => {
  if (state === 'playing') pauseGame();
  kit.menu.open();
});
UI.autoOption.addEventListener('change', (e) => setAuto(e.target.checked));
UI.shakeOption.addEventListener('change', (e) => {
  shakeOn = e.target.checked;
  prefs.shake = shakeOn;
  savePrefs();
});
UI.scanOption.addEventListener('change', (e) => {
  UI.scanlines.style.display = e.target.checked ? '' : 'none';
  prefs.scan = e.target.checked;
  savePrefs();
});
UI.volumeOption.addEventListener('input', (e) => {
  audio.setVolume(Number(e.target.value) / 100);
  prefs.volume = Number(e.target.value);
  savePrefs();
});
// Escape inside the manual's checkboxes and slider (the kit leaves form fields alone).
UI.manualScreen.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && e.target instanceof HTMLInputElement) {
    e.preventDefault();
    closeManual();
  }
});
// Sound can only start after a gesture: every key, click or tap wakes it (gamepads cannot).
addEventListener('pointerdown', () => audio.init(), { capture: true });
addEventListener('keydown', () => audio.init(), { capture: true });
addEventListener('blur', () => {
  if (state === 'playing') pauseGame();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') pauseGame();
});
document.addEventListener('fullscreenchange', () => document.body.classList.toggle('fullscreen', !!document.fullscreenElement));
// The settings panel pauses the loop: hold the music, and land on the pause menu afterwards.
kit.onPause((paused) => {
  if (paused && state === 'playing') pauseGame();
  audio.hold(paused);
});
input.onSourceChange(() => {
  renderPrompts();
  if (input.source === 'touch') clearNavFocus();
});

// The HUD layer is a fixed 1440 × 810 sheet scaled to the stage.
let uiScale = 1;
kit.onResize((w) => {
  uiScale = w / W;
  UI.uiRoot.style.transform = `scale(${uiScale})`;
  requestAnimationFrame(updateTouchLift);
});
/**
 * Keep the HUD clear of the on-screen thumbs (the kit publishes the space they take).
 * When they cover the bottom row of the stage, that row docks under the top row instead
 * of floating up into the middle of the play field.
 */
function updateTouchLift() {
  const on = document.documentElement.classList.contains('kit-touch-on');
  let overlap = 0;
  if (on) {
    const tb = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--kit-touch-bottom')) || 0;
    const r = UI.stage.getBoundingClientRect();
    overlap = Math.max(0, tb - (innerHeight - r.bottom)) / Math.max(0.05, uiScale);
  }
  UI.shell.classList.toggle('touch-on', on);
  UI.shell.classList.toggle('hud-docked', overlap > 30);
}
new MutationObserver(() => requestAnimationFrame(updateTouchLift)).observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });

audio.onFail = () => {
  soundOn = false;
  updateSoundLabel();
};

/* ------------------------------------------------------------------ start */

audio.volume = prefs.volume / 100;
audio.enabled = soundOn;
UI.volumeOption.value = String(prefs.volume);
UI.autoOption.checked = autoFire;
UI.shakeOption.checked = shakeOn;
UI.scanOption.checked = prefs.scan !== false;
UI.scanlines.style.display = prefs.scan !== false ? '' : 'none';
updateSoundLabel();
UI.statusText.textContent = `${kit.backendLabel.toUpperCase()} / READY`;
UI.versionText.textContent = `GH—01 / BUILD 2.0 · ${kit.backendLabel.toUpperCase()}`;
setDifficulty(difficulty);
if (opId !== 1) gfx.setTheme(opId);
renderTitle();
renderPrompts();
touchFor(false);
updateTouchLift();
kit.start(frame);

/* A small inspection surface for deterministic local quality checks. */
if (location.search.includes('test')) {
  window.__gh = {
    G, P,
    get state() {
      return state;
    },
    start: startGame,
    setOperation,
    step: update,
    render,
    snapshot: () => ({
      state, op: OP.id, ship: { ...P }, mission: { ...G },
      enemies: enemies.map((e) => ({ type: e.type, variant: e.variant, x: e.x, y: e.y, hp: e.hp, pod: e.pod, podLost: e.podLost, shield: e.shield })),
      bullets: bullets.length, shots: shots.length, pickups: pickups.map((p) => ({ type: p.type, x: p.x, y: p.y })),
    }),
  };
}
