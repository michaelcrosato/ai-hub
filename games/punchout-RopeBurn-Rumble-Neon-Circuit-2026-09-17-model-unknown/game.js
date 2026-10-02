/**
 * RopeBurn Rumble — Neon Circuit.
 *
 * Boots the shared 3D kit, builds the ring (ring.js), runs bouts with the
 * fight rules in sim.js, and drives the cards, the HUD, the sound and every
 * input through kit.input actions (keyboard and mouse, gamepad, touch).
 */

import { boot } from 'kit/boot.js';
import { createRing } from './ring.js';
import {
  createFight,
  OPPONENTS,
  DIFFICULTY,
  GEAR,
  CORNER_BOOSTS,
  STORAGE_KEY,
  sanitizeMeta,
  isUnlocked,
  buyOrEquip,
  applyResult,
  opponentById,
  clamp,
} from './sim.js';

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fmtTime = (sec) => {
  const t = Math.max(0, Math.ceil(sec));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};
const fmtClock = (sec) => `${Math.floor(sec / 60)}:${(sec % 60).toFixed(1).padStart(4, '0')}`;
const fmtNum = (n) => Math.round(n).toLocaleString('en-US');

// ---- profile -----------------------------------------------------------------------------

function loadMeta() {
  try {
    return sanitizeMeta(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'));
  } catch {
    return sanitizeMeta(null);
  }
}
const meta = loadMeta();
function saveMeta() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
  } catch {
    /* private mode or full storage: progress lives for this session */
  }
}

// ---- DOM ---------------------------------------------------------------------------------

const ui = Object.fromEntries(
  [
    'stage', 'hud', 'foeName', 'foeHp', 'playerHp', 'playerStamina', 'playerRush', 'roundText', 'timerText', 'scoreText', 'rendererBadge', 'playerLevel', 'playerKD', 'foeKD',
    'announce', 'telegraph', 'prompts', 'flash',
    'intro', 'introEyebrow', 'circuit', 'introFoe', 'introFoeTag', 'introLevel', 'diffRow', 'diffDesc', 'gearRow', 'startBtn', 'gearBtn', 'helpBtn', 'settingsBtn', 'introHint',
    'tutorial', 'talkEyebrow', 'talkTitle', 'talkTip', 'talkGrid', 'fightBtn', 'talkBackBtn',
    'corner', 'cornerEyebrow', 'cornerTitle', 'cornerCopy', 'cornerStats', 'cornerChoices',
    'result', 'resultEyebrow', 'resultTitle', 'resultCopy', 'resultStats', 'resultCards', 'nextBtn', 'rematchBtn', 'labBtn', 'titleBtn',
    'lab', 'labWallet', 'labItems', 'labBackBtn',
    'pause', 'pauseInfo', 'resumeBtn', 'restartBtn', 'pauseHelpBtn', 'pauseSettingsBtn', 'soundBtn', 'quitBtn', 'backendInfo',
    'help', 'helpGrid', 'helpBackBtn',
    'getup', 'getupClock', 'getupFill', 'getupBtn', 'getupCount',
  ].map((k) => [k, $(k)])
);
const show = (el, yes = true) => el.classList.toggle('hidden', !yes);

// ---- boot --------------------------------------------------------------------------------

const kit = await boot({
  title: 'RopeBurn Rumble',
  mount: ui.stage,
  gear: 'none', // the title and pause menus have a Settings button (F9 works too)
  accent: '#ffd24a',
  background: '#080610',
  touch: { top: 'right', topOffset: 84 },
  input: {
    move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick' },
    // First touch button is the big one; CSS lifts Guard and Rush into the top row of the cluster.
    punchR: { keys: ['KeyK'], mouse: [2], gamepad: ['A', 'RB'], touch: 'R' },
    punchL: { keys: ['KeyJ'], mouse: [0], gamepad: ['X', 'LB'], touch: 'L' },
    guard: { keys: ['KeyL', 'ShiftLeft', 'ShiftRight'], gamepad: ['B', 'LT'], touch: 'Guard' },
    rush: { keys: ['Space'], gamepad: ['Y', 'RT'], touch: 'Rush' },
    pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'], touch: { label: 'II', slot: 'top' } },
    ok: { keys: ['Enter', 'NumpadEnter'], gamepad: ['A'] },
    back: { keys: ['Backspace'], gamepad: ['B'] },
    mute: { keys: ['KeyM'] },
  },
});
const input = kit.input;
const ring = createRing(kit);
ui.rendererBadge.textContent = `THREE r186 · ${kit.backend === 'webgpu' ? 'WEBGPU' : 'WEBGL2'}`;

// ---- audio: procedural, created on the first gesture ----------------------------------------

class AudioBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuf = null;
    this.crowdGain = null;
    this.crowdLevel = 0;
    this.enabled = true;
    this.suspended = false;
  }
  unlock() {
    if (!this.ctx) {
      const A = window.AudioContext || window.webkitAudioContext;
      if (!A) return;
      try {
        this.ctx = new A();
      } catch {
        return;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 0.28 : 0;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended' && !this.suspended) this.ctx.resume().catch(() => {});
  }
  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.28 : 0, this.ctx.currentTime, 0.02);
  }
  setSuspended(on) {
    this.suspended = on;
    if (!this.ctx) return;
    if (on && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
    else if (!on && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }
  noiseBuffer() {
    if (!this.noiseBuf) {
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    return this.noiseBuf;
  }
  tone(freq = 220, dur = 0.08, type = 'square', gain = 0.2, slide = 0, delay = 0) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }
  noise(dur = 0.06, gain = 0.2) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const s = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    s.buffer = this.noiseBuffer();
    g.gain.setValueAtTime(gain, t0);
    g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    s.connect(g);
    g.connect(this.master);
    s.start(t0, Math.random() * 0.8, dur + 0.02);
  }
  crowd(level) {
    if (!this.ctx) return;
    if (!this.crowdGain) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer();
      src.loop = true;
      const band = this.ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = 650;
      band.Q.value = 0.6;
      this.crowdGain = this.ctx.createGain();
      this.crowdGain.gain.value = 0;
      src.connect(band);
      band.connect(this.crowdGain);
      this.crowdGain.connect(this.master);
      src.start();
    }
    this.crowdLevel = level;
    const g = this.crowdGain.gain;
    g.cancelScheduledValues(this.ctx.currentTime);
    g.setTargetAtTime(level * 0.07, this.ctx.currentTime, 0.5);
  }
  cheer(amount = 1) {
    if (!this.crowdGain) return;
    const now = this.ctx.currentTime;
    const g = this.crowdGain.gain;
    g.cancelScheduledValues(now);
    g.setTargetAtTime(0.22 * amount, now, 0.06);
    g.setTargetAtTime(this.crowdLevel * 0.07, now + 0.7 + amount * 0.6, 0.8);
  }
  punch(heavy = false) {
    this.noise(heavy ? 0.12 : 0.07, heavy ? 0.42 : 0.28);
    this.tone(heavy ? 82 : 116, heavy ? 0.13 : 0.07, 'square', heavy ? 0.25 : 0.14, -35);
  }
  bell() {
    this.tone(940, 0.65, 'sine', 0.16, -180);
    this.tone(1410, 0.42, 'sine', 0.09, -220);
  }
  dodge() {
    this.noise(0.05, 0.07);
  }
  block() {
    this.tone(135, 0.035, 'square', 0.05, -20);
    this.noise(0.03, 0.06);
  }
  ko() {
    this.tone(180, 0.12, 'sawtooth', 0.16, -80);
    this.tone(120, 0.32, 'square', 0.16, -50, 0.11);
  }
  count() {
    this.tone(520, 0.06, 'square', 0.06);
  }
  click() {
    this.tone(660, 0.03, 'square', 0.035);
  }
}
const audio = new AudioBank();
audio.setEnabled(meta.sound);
// Audio may only start from a gesture: every key or tap (re)unlocks it.
addEventListener('pointerdown', () => audio.unlock(), true);
addEventListener('keydown', () => audio.unlock(), true);

// ---- prompts per input device --------------------------------------------------------------

const PROMPTS = {
  keyboard: { slip: 'A / D', duck: 'S', punch: 'J  K', body: 'S + J/K', guard: 'L / Shift', rush: 'Space', pause: 'Esc', zoom: 'Wheel', mute: 'M', confirm: 'Enter' },
  gamepad: { slip: 'LS ← →', duck: 'LS ↓', punch: 'X  A', body: '↓ + X/A', guard: 'B / LT', rush: 'Y / RT', pause: 'Start', zoom: '—', mute: '—', confirm: 'A' },
  touch: { slip: 'Stick ← →', duck: 'Stick ↓', punch: 'L  R', body: '↓ + L/R', guard: 'GUARD', rush: 'RUSH', pause: 'II', zoom: 'Pinch', mute: '—', confirm: 'Tap' },
};
const prompts = () => PROMPTS[input.source] || PROMPTS.keyboard;

function controlsGrid(full) {
  const p = prompts();
  const rows = [
    [p.slip, 'Slip straights and hooks.'],
    [p.duck, 'Duck hooks and haymakers.'],
    [p.punch, 'Left / right. Land in the late tell or after a miss.'],
    [p.body, 'Body shot: heavier on a recovering foe.'],
    [p.guard, 'Hold to block. Costs stamina; can break.'],
    [p.rush, 'Cash a full momentum meter.'],
  ];
  if (full) rows.push([p.pause, 'Pause menu.'], [p.zoom, 'Camera zoom.'], [p.mute, 'Sound on / off.']);
  return rows
    .filter((r) => r[0] !== '—')
    .map(([k, t]) => `<div><kbd>${esc(k)}</kbd><span>${esc(t)}</span></div>`)
    .join('');
}

function refreshPrompts() {
  const p = prompts();
  document.documentElement.dataset.input = input.source;
  ui.introHint.textContent =
    input.source === 'touch'
      ? 'Touch: stick left/right to slip, down to duck · L / R punch · hold GUARD · RUSH when the meter is full · pinch to zoom.'
      : input.source === 'gamepad'
        ? 'Controller: left stick slips and ducks · X / A punch · hold B or LT to guard · Y or RT rush · Start pauses.'
        : 'Keyboard: A / D slip · S duck (hold for body shots) · J / K punch (or mouse buttons) · hold L guard · Space rush · Esc pauses.';
  ui.prompts.innerHTML = `<span><b>${esc(p.slip)}</b> slip</span><span><b>${esc(p.duck)}</b> duck</span><span><b>${esc(p.punch)}</b> punch</span><span><b>${esc(p.guard)}</b> guard</span><span><b>${esc(p.rush)}</b> rush</span><span><b>${esc(p.pause)}</b> pause</span>`;
  if (!ui.tutorial.classList.contains('hidden')) ui.talkGrid.innerHTML = controlsGrid(false);
  if (!ui.help.classList.contains('hidden')) ui.helpGrid.innerHTML = controlsGrid(true);
}
input.onSourceChange((src) => {
  refreshPrompts();
  if (src === 'gamepad') audio.unlock();
});

// ---- cards: a small stack, the top one is shown ----------------------------------------------

const CARDS = ['intro', 'tutorial', 'corner', 'result', 'lab', 'pause', 'help', 'getup'];
const PRIMARY = { intro: 'startBtn', tutorial: 'fightBtn', result: 'nextBtn', lab: 'labBackBtn', pause: 'resumeBtn', help: 'helpBackBtn', getup: 'getupBtn' };
let stack = ['intro'];
const top = () => stack[stack.length - 1] || null;

function renderStack() {
  const t = top();
  for (const id of CARDS) show(ui[id], id === t);
  kit.touch?.suspend(!!t, 'cards');
  input.settle();
  navHeld = '';
  // Cards that pop up mid-fight wait a beat before taking input, so a punch or rush mashed
  // as the bell rings doesn't pick a corner boost or skip the result.
  const late = t === 'corner' || t === 'result';
  focusDelay = late ? 0.45 : 0;
  for (const id of CARDS) ui[id].classList.toggle('arming', late && id === t);
  if (t && !late && input.source !== 'touch') focusPreferred(t);
  else document.activeElement?.blur?.();
  audio.setSuspended(isPaused());
}
function setStack(...ids) {
  stack = ids;
  renderStack();
}
function pushCard(id) {
  if (top() === id) return;
  stack.push(id);
  renderStack();
}
function popCard() {
  stack.pop();
  renderStack();
}
// Help opened from the pause menu sits on top of it, so 'pause' in the stack is the whole test.
const isPaused = () => stack.includes('pause');

// ---- menu navigation with stick, D-pad and arrows -------------------------------------------

let navHeld = '';
let navRepeat = 0;
let focusDelay = 0;
const navButtons = (card) => [...card.querySelectorAll('button')].filter((b) => !b.disabled && b.offsetParent !== null);

function focusEl(b) {
  if (!b) return;
  b.focus({ preventScroll: true });
  b.scrollIntoView?.({ block: 'nearest' });
}
function focusPreferred(id) {
  const card = ui[id];
  const items = navButtons(card);
  const pref = PRIMARY[id] && ui[PRIMARY[id]];
  focusEl(pref && items.includes(pref) ? pref : items.find((b) => b.classList.contains('primary')) || items[0]);
}
function focusMove(card, dx, dy) {
  const items = navButtons(card);
  if (!items.length) return;
  const cur = items.includes(document.activeElement) ? document.activeElement : null;
  if (!cur) {
    focusPreferred(top());
    return;
  }
  const r0 = cur.getBoundingClientRect();
  const cx = r0.left + r0.width / 2;
  const cy = r0.top + r0.height / 2;
  let best = null;
  let bestScore = Infinity;
  for (const b of items) {
    if (b === cur) continue;
    const r = b.getBoundingClientRect();
    const x = r.left + r.width / 2 - cx;
    const y = r.top + r.height / 2 - cy;
    const along = x * dx + y * dy;
    if (along <= 4) continue;
    const across = Math.abs(x * dy - y * dx);
    const score = along + across * 2;
    if (score < bestScore) {
      bestScore = score;
      best = b;
    }
  }
  if (!best) {
    const i = items.indexOf(cur);
    best = items[(i + (dx + dy > 0 ? 1 : -1) + items.length) % items.length];
  }
  focusEl(best);
  audio.click();
}

function menuFrame(dt) {
  const id = top();
  if (id === 'getup') {
    if (input.pressed('pause')) openPause();
    else if (input.pressed('punchL') || input.pressed('punchR') || input.pressed('rush') || input.pressed('ok')) tapGetUp();
    return;
  }
  if (focusDelay > 0) {
    focusDelay -= dt;
    if (focusDelay <= 0) {
      ui[id].classList.remove('arming');
      if (input.source !== 'touch') focusPreferred(id);
    }
    return;
  }
  const v = input.vector('move');
  let code = '';
  let dx = 0;
  let dy = 0;
  if (Math.max(Math.abs(v.x), Math.abs(v.y)) > 0.55) {
    if (Math.abs(v.x) > Math.abs(v.y)) dx = Math.sign(v.x);
    else dy = -Math.sign(v.y);
    code = `${dx},${dy}`;
  }
  if (code && code !== navHeld) {
    focusMove(ui[id], dx, dy);
    navHeld = code;
    navRepeat = 0.38;
  } else if (code) {
    navRepeat -= dt;
    if (navRepeat <= 0) {
      focusMove(ui[id], dx, dy);
      navRepeat = 0.13;
    }
  } else navHeld = '';

  if (input.pressed('ok')) {
    // A / Enter presses the focused button, or the card's main one when nothing has focus yet.
    let el = document.activeElement;
    if (!(el && el.tagName === 'BUTTON' && ui[id].contains(el) && !el.disabled)) {
      focusPreferred(id);
      el = document.activeElement;
    }
    if (el && el.tagName === 'BUTTON' && ui[id].contains(el) && !el.disabled) el.click();
  } else if (input.pressed('back') || input.pressed('pause')) {
    cardBack(id);
  }
}

function cardBack(id) {
  if (id === 'pause') resume();
  else if (id === 'help' || id === 'lab' || id === 'tutorial') popCard();
}

// ---- title screen ---------------------------------------------------------------------------

let opponent = opponentById(meta.opponent);
ring.setOpponent(opponent);

function bestLine(op) {
  const b = meta.best[op.id];
  if (!b || (!b.score && !b.wins)) return 'No record yet';
  return `Best ${fmtNum(b.score)}${b.ko ? ` · KO ${fmtClock(b.ko)}` : ''}${b.wins ? ` · ${b.wins}W` : ''}`;
}

function refreshIntro() {
  const champion = meta.beaten.includes(OPPONENTS[OPPONENTS.length - 1].id);
  ui.introEyebrow.textContent = `NEON CIRCUIT / ${opponent.bout}${champion ? ' · ★ CHAMPION' : ''}`;
  ui.introFoe.textContent = opponent.name;
  ui.introFoeTag.textContent = `${opponent.tag} · ${opponent.record}`;
  ui.introLevel.textContent = `Rookie Lv.${meta.level}`;
  ui.playerLevel.textContent = `ROOKIE LV.${meta.level}`;
  ui.gearRow.innerHTML = Object.values(meta.gear)
    .map((id) => `<span class="gear-chip">${esc(GEAR[id].name)}</span>`)
    .join('');
  ui.circuit.innerHTML = OPPONENTS.map((op, i) => {
    const open = isUnlocked(meta, op.id);
    const beaten = meta.beaten.includes(op.id);
    const sel = op.id === opponent.id;
    const label = open ? `<b>${esc(op.name)}</b><small>${esc(op.bout)} · ${esc(op.tag)}</small><em>${esc(bestLine(op))}</em>` : `<b>LOCKED</b><small>${esc(op.bout)}</small><em>Beat ${esc(OPPONENTS[i - 1].name)}</em>`;
    return `<button class="opp${sel ? ' selected' : ''}${beaten ? ' beaten' : ''}" data-opp="${op.id}" aria-pressed="${sel}" ${open ? '' : 'disabled'}>${label}</button>`;
  }).join('');
  ui.diffRow.innerHTML = Object.values(DIFFICULTY)
    .map((d) => `<button class="diff${d.id === meta.difficulty ? ' selected' : ''}" data-diff="${d.id}" aria-pressed="${d.id === meta.difficulty}">${d.label}</button>`)
    .join('');
  ui.diffDesc.textContent = DIFFICULTY[meta.difficulty].desc;
}

function selectOpponent(id) {
  if (!isUnlocked(meta, id)) return;
  opponent = opponentById(id);
  meta.opponent = id;
  saveMeta();
  ring.setOpponent(opponent);
  refreshIntro();
}

ui.circuit.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-opp]');
  if (!b) return;
  selectOpponent(b.dataset.opp);
  focusEl(ui.circuit.querySelector(`[data-opp="${b.dataset.opp}"]`));
});
ui.diffRow.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-diff]');
  if (!b || !DIFFICULTY[b.dataset.diff]) return;
  meta.difficulty = b.dataset.diff;
  saveMeta();
  refreshIntro();
  focusEl(ui.diffRow.querySelector(`[data-diff="${b.dataset.diff}"]`));
});

function openTalk() {
  const op = opponent;
  ui.talkEyebrow.textContent = `10-SECOND CORNER TALK · ${op.bout}`;
  ui.talkTitle.textContent = op.id === 'vera' ? 'MAKE HER MISS' : 'MAKE HIM MISS';
  ui.talkTip.textContent = op.talk;
  ui.talkGrid.innerHTML = controlsGrid(false);
}

ui.startBtn.addEventListener('click', () => {
  openTalk();
  setStack('intro', 'tutorial');
});
ui.talkBackBtn.addEventListener('click', () => popCard());
ui.fightBtn.addEventListener('click', () => startBout());
ui.gearBtn.addEventListener('click', openLab);
ui.labBtn.addEventListener('click', openLab);
ui.labBackBtn.addEventListener('click', () => popCard());
ui.helpBtn.addEventListener('click', openHelp);
ui.pauseHelpBtn.addEventListener('click', openHelp);
ui.helpBackBtn.addEventListener('click', () => popCard());
ui.settingsBtn.addEventListener('click', () => kit.menu.open());
ui.pauseSettingsBtn.addEventListener('click', () => kit.menu.open());

function openHelp() {
  ui.helpGrid.innerHTML = controlsGrid(true);
  pushCard('help');
}

// ---- corner lab -----------------------------------------------------------------------------

function openLab() {
  renderLab();
  pushCard('lab');
}
function renderLab() {
  ui.labWallet.textContent = `Credits ${meta.credits} · XP ${meta.xp} · Level ${meta.level}. Gear changes are modest so skill remains the main path to a win.`;
  ui.labItems.innerHTML = Object.entries(GEAR)
    .map(([id, g]) => {
      const owned = meta.owned.includes(id);
      const equipped = meta.gear[g.slot] === id;
      const locked = !owned && g.req && !meta.beaten.includes(g.req);
      const label = equipped ? 'EQUIPPED' : owned ? 'EQUIP' : locked ? 'LOCKED' : `BUY ${g.cost}`;
      const note = locked ? ` · beat ${opponentById(g.req).name}` : '';
      return `<div class="lab-item"><div><b>${esc(g.name)}</b><small>${esc(g.desc)}${esc(note)}</small></div><button data-gear="${id}" class="${equipped ? 'equipped' : ''}" ${locked || (!owned && meta.credits < g.cost) ? 'disabled' : ''}>${label}</button></div>`;
    })
    .join('');
}
ui.labItems.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-gear]');
  if (!b) return;
  const id = b.dataset.gear;
  const out = buyOrEquip(meta, id);
  if (out === 'bought' || out === 'equipped') {
    saveMeta();
    audio.click();
    refreshIntro();
    renderLab();
    focusEl(ui.labItems.querySelector(`[data-gear="${id}"]`));
  }
});

// ---- the bout -------------------------------------------------------------------------------

let fight = null;
let hitStop = 0;
let slowMo = 0;
let promptT = 0;
let pendingResult = null;
let latchX = false;
let latchY = false;
const buffer = { verb: null, arg: 0, body: false, t: 0 };

function startBout() {
  const diff = DIFFICULTY[meta.difficulty] || DIFFICULTY.pro;
  if (!meta.talkSeen) {
    meta.talkSeen = true;
    saveMeta();
  }
  fight = createFight({ opponent, difficulty: diff, meta, onEvent: onFightEvent });
  ring.reset();
  ring.setOpponent(opponent);
  hitStop = slowMo = 0;
  pendingResult = null;
  buffer.verb = null;
  latchX = latchY = false;
  promptT = 12;
  ui.foeName.textContent = opponent.name;
  ui.playerLevel.textContent = `ROOKIE LV.${meta.level}`;
  hideTelegraph();
  show(ui.hud, true);
  setStack();
  placePausePill();
  audio.unlock();
  audio.crowd(0.6);
  fight.begin();
  updateHUD();
}

function placePausePill() {
  // The pause pill sits under the HUD on the right, clear of both fighter panels.
  if (ui.hud.classList.contains('hidden')) return;
  const r = ui.hud.getBoundingClientRect();
  kit.touch?.placeTop('right', Math.round(r.bottom + 8));
}
kit.onResize(() => requestAnimationFrame(placePausePill));

function openPause() {
  if (!fight || fight.state.mode === 'result' || isPaused()) return;
  const s = fight.state;
  ui.pauseInfo.textContent = `Round ${s.round} · ${fmtTime(s.time)} left · vs ${opponent.name} · ${DIFFICULTY[meta.difficulty].label}`;
  ui.soundBtn.textContent = `SOUND: ${meta.sound ? 'ON' : 'OFF'}`;
  ui.backendInfo.textContent = `${kit.backendLabel} · three.js r186`;
  pushCard('pause');
}
function resume() {
  stack = stack.filter((id) => id !== 'pause' && id !== 'help');
  renderStack();
}
ui.resumeBtn.addEventListener('click', resume);
ui.restartBtn.addEventListener('click', () => {
  fight?.abandon();
  startBout();
});
ui.quitBtn.addEventListener('click', () => {
  fight?.abandon();
  fight = null;
  toTitle();
});
ui.soundBtn.addEventListener('click', () => {
  toggleSound();
  ui.soundBtn.textContent = `SOUND: ${meta.sound ? 'ON' : 'OFF'}`;
});
function toggleSound() {
  meta.sound = !meta.sound;
  saveMeta();
  audio.setEnabled(meta.sound);
  kit.toast(meta.sound ? 'Sound on' : 'Sound off', 1200);
}

function toTitle() {
  pendingResult = null;
  ring.reset();
  show(ui.hud, false);
  hideTelegraph();
  show(ui.prompts, false);
  audio.crowd(0.15);
  refreshIntro();
  setStack('intro');
}
ui.titleBtn.addEventListener('click', () => {
  fight = null;
  toTitle();
});
ui.rematchBtn.addEventListener('click', () => startBout());
ui.nextBtn.addEventListener('click', () => {
  const next = OPPONENTS[OPPONENTS.indexOf(opponent) + 1];
  if (next && isUnlocked(meta, next.id)) {
    selectOpponent(next.id);
    fight = null;
    ring.reset();
    show(ui.hud, false);
    openTalk();
    setStack('intro', 'tutorial');
  }
});

// Get-up: tap the button (pointer, the moment it goes down) or mash any punch.
function tapGetUp() {
  fight?.getUpTap();
}
ui.getupBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  tapGetUp();
});
ui.getupBtn.addEventListener('click', (e) => {
  if (e.detail === 0) tapGetUp(); // Enter / Space on the focused button
});

// Corner boosts between rounds.
ui.cornerChoices.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-boost]');
  if (!b || !fight) return;
  if (fight.takeCorner(b.dataset.boost)) {
    setStack();
    placePausePill();
  }
});

function showCorner(round) {
  const s = fight.state;
  const r = s.rounds[round - 1];
  ui.cornerEyebrow.textContent = `ROUND ${round} COMPLETE`;
  ui.cornerTitle.textContent = 'PICK ONE CORNER BOOST';
  ui.cornerCopy.textContent = `Temporary for this bout. ${opponent.talk}`;
  ui.cornerStats.innerHTML = `<span>Landed <b>${Math.round(r.dealt)}</b> dmg</span><span>Took <b>${Math.round(r.taken)}</b> dmg</span><span>Knockdowns <b>${r.fKD}–${r.pKD}</b></span>`;
  ui.cornerChoices.innerHTML = CORNER_BOOSTS.map((c) => `<button class="choice" data-boost="${c.id}"><b>${c.title}</b><span>${c.desc}</span><small>TAKE IT →</small></button>`).join('');
  setStack('corner');
}

function showResult(r) {
  const gain = applyResult(meta, r);
  saveMeta();
  refreshIntro();
  show(ui.hud, false);
  show(ui.prompts, false);
  hideTelegraph();
  const op = opponentById(r.opponent);
  ui.resultEyebrow.textContent = r.win ? `${op.bout} COMPLETE` : 'BOUT OVER';
  ui.resultTitle.textContent = r.win ? (gain.champion ? 'CIRCUIT CHAMPION!' : 'YOU TAKE THE CIRCUIT') : r.draw ? "IT'S A DRAW" : `${op.name.split(' ')[0]} HOLDS THE RING`;
  const lines = [`${r.reason}.`];
  if (r.win) lines.push(`+${gain.xpGain} XP and +${gain.creditGain} credits.`);
  else lines.push(`+${gain.xpGain} training XP, +${gain.creditGain} credits. Learn the tells and counter late in the windup.`);
  if (gain.levelUp) lines.push(`Level up: Rookie Lv.${gain.level}!`);
  if (gain.unlocked) lines.push(`${gain.unlocked.name} (${gain.unlocked.bout}) is now open.`);
  if (gain.newScore) lines.push('New best score!');
  if (gain.newKO) lines.push('Fastest knockout yet!');
  ui.resultCopy.textContent = lines.join(' ');
  const acc = r.thrown ? Math.round((r.landed / r.thrown) * 100) : 0;
  ui.resultStats.innerHTML = [
    [r.landed, 'LANDED'],
    [r.counters, 'COUNTERS'],
    [r.dodges, 'DODGES'],
    [fmtNum(r.score), 'SCORE'],
    [`${acc}%`, 'ACCURACY'],
    [fmtClock(r.time), 'FIGHT TIME'],
  ]
    .map(([v, l]) => `<div><b>${v}</b><small>${l}</small></div>`)
    .join('');
  ui.resultCards.textContent = r.cards ? `Scorecard: you ${r.cards.player} – ${r.cards.foe} ${op.name}` : '';
  show(ui.resultCards, !!r.cards);
  const next = OPPONENTS[OPPONENTS.indexOf(op) + 1];
  const canNext = r.win && next && isUnlocked(meta, next.id);
  show(ui.nextBtn, !!canNext);
  if (canNext) ui.nextBtn.textContent = `CONTINUE TO ${next.bout}`;
  audio.crowd(r.win ? 0.5 : 0.2);
  setStack('result');
}

// ---- fight feedback ---------------------------------------------------------------------------

function announce(text, ms = 750) {
  ui.announce.querySelector('span').textContent = text;
  show(ui.announce, true);
  // Restart the slam animation for back-to-back calls.
  const span = ui.announce.querySelector('span');
  span.style.animation = 'none';
  void span.offsetWidth;
  span.style.animation = '';
  clearTimeout(announce.t);
  announce.t = setTimeout(() => show(ui.announce, false), ms);
}
function flash(strength = 0.65, color = '#fff') {
  ui.flash.style.background = color;
  ui.flash.style.transition = 'none';
  ui.flash.style.opacity = strength;
  requestAnimationFrame(() => {
    ui.flash.style.transition = 'opacity .12s';
    ui.flash.style.opacity = 0;
  });
}
const GLYPH = { straight: '!', hook: '⌄', upper: '↑', haymaker: '▼' };
function showTelegraph(a) {
  ui.telegraph.textContent = GLYPH[a.kind] || '!';
  ui.telegraph.style.marginLeft = `${a.side * 42}px`;
  ui.telegraph.classList.toggle('big', a.kind === 'haymaker');
  show(ui.telegraph, true);
}
function hideTelegraph() {
  show(ui.telegraph, false);
}

function onFightEvent(type, d) {
  ring.event(type, d);
  switch (type) {
    case 'round':
      audio.bell();
      announce(`ROUND ${d.round}`, d.round === 1 ? 1000 : 850);
      break;
    case 'bell':
      audio.bell();
      hideTelegraph();
      break;
    case 'tell':
      showTelegraph(d.attack);
      if (d.attack.kind === 'haymaker') audio.tone(70, 0.5, 'sawtooth', 0.08, 40);
      break;
    case 'feint':
    case 'attack':
    case 'stun':
      hideTelegraph();
      break;
    case 'slip':
      audio.dodge();
      if (d.attack.kind === 'haymaker') announce('DUCKED IT!', 520);
      break;
    case 'hit': {
      const heavy = d.attack.damage >= 20;
      audio.punch(heavy);
      input.rumble(d.guarded ? 0.25 : heavy ? 0.85 : 0.5, d.guarded ? 60 : heavy ? 170 : 110);
      flash(d.guarded ? 0.14 : 0.35, d.guarded ? '#9fe8ff' : '#ff5a6a');
      if (d.broke) announce('GUARD BREAK!', 700);
      break;
    }
    case 'blocked':
      audio.block();
      break;
    case 'land':
      audio.punch(d.counter);
      input.rumble(d.counter ? 0.5 : 0.2, d.counter ? 90 : 45);
      flash(d.rush ? 0.85 : d.counter ? 0.55 : 0.23);
      if (d.counter) {
        audio.cheer(0.5);
        if (!d.rush) {
          announce(d.attack?.kind === 'haymaker' ? 'BIG COUNTER!' : 'COUNTER!', 420);
          hitStop = 0.06;
        }
      }
      break;
    case 'rush':
      announce('ROPEBURN RUSH!', 650);
      audio.punch(true);
      input.rumble(0.6, 220);
      break;
    case 'dodge':
    case 'duck':
      audio.dodge();
      break;
    case 'foeDown':
      hideTelegraph();
      audio.ko();
      audio.cheer(1);
      announce(d.final ? 'TKO!' : 'DOWN!', 450);
      input.rumble(0.9, 260);
      slowMo = d.final ? 0.9 : 0.4;
      break;
    case 'foeCount':
      audio.count();
      announce(String(d.n), 430);
      break;
    case 'foeRise':
      announce('FIGHT!', 650);
      break;
    case 'playerDown':
      hideTelegraph();
      audio.ko();
      audio.cheer(0.6);
      announce('DOWN!', 900);
      input.rumble(1, 380);
      flash(0.5, '#ff3d58');
      break;
    case 'getupShow':
      ui.getupFill.style.width = '0%';
      ui.getupCount.textContent = `0 / ${d.need}`;
      pushCard('getup');
      break;
    case 'getupTap':
      ui.getupCount.textContent = `${d.count} / ${d.need}`;
      ui.getupFill.style.width = `${Math.min(100, (d.count / d.need) * 100)}%`;
      audio.tone(180 + d.count * 30, 0.035, 'square', 0.07);
      input.rumble(0.2, 30);
      break;
    case 'playerRise':
      stack = stack.filter((id) => id !== 'getup');
      renderStack();
      announce('BACK UP!', 650);
      break;
    case 'corner':
      showCorner(d.round);
      break;
    case 'end':
      pendingResult = { result: d.result, t: d.result.ko ? 0.9 : 0.7 };
      break;
  }
}

// ---- HUD (DOM writes only on change) -----------------------------------------------------------

function setBar(el, v) {
  const k = Math.round(clamp(v, 0, 1) * 500);
  if (el._v !== k) {
    el._v = k;
    el.style.transform = `scaleX(${k / 500})`;
  }
}
function setText(el, v) {
  if (el._t !== v) {
    el._t = v;
    el.textContent = v;
  }
}
let rushReady = null;
function updateHUD() {
  const s = fight.state;
  setBar(ui.foeHp, s.foeHp / s.foeMax);
  setBar(ui.playerHp, s.playerHp / 100);
  setBar(ui.playerStamina, s.stamina / s.staminaMax);
  setBar(ui.playerRush, s.rush / 100);
  setText(ui.roundText, `R${s.round}`);
  setText(ui.timerText, fmtTime(s.time));
  setText(ui.scoreText, fmtNum(s.score));
  setText(ui.playerKD, `KD ${s.playerKD}`);
  setText(ui.foeKD, `KD ${s.foeKD}`);
  const ready = s.rush >= 100;
  if (ready !== rushReady) {
    rushReady = ready;
    ui.hud.classList.toggle('rush-ready', ready);
    kit.touch?.button('rush')?.classList.toggle('is-ready', ready);
    if (ready && s.mode === 'fight') {
      audio.tone(660, 0.08, 'triangle', 0.08, 0);
      audio.tone(990, 0.12, 'triangle', 0.07, 0, 0.07);
    }
  }
  if (getupCard() && s.mode === 'playerDown') {
    const n = Math.min(10, Math.max(1, Math.ceil((5 - s.getupT) / 0.5)));
    setText(ui.getupClock, String(n));
  }
}
const getupCard = () => !ui.getup.classList.contains('hidden');

// ---- in-fight input ---------------------------------------------------------------------------

function fightFrame(dt) {
  const s = fight.state;
  if (input.pressed('pause')) {
    openPause();
    return;
  }
  const z = input.zoom();
  if (z) ring.setZoom(clamp(ring.zoom * Math.exp(-z * 0.08), 0.82, 1.22));
  if (s.mode !== 'fight') {
    fight.setGuard(false);
    buffer.verb = null;
    return;
  }
  const v = input.vector('move');
  const body = v.y < -0.42;
  const want = (verb, arg = 0) => {
    buffer.verb = verb;
    buffer.arg = arg;
    buffer.body = body;
    buffer.t = 0.12;
  };
  if (Math.abs(v.x) > 0.58) {
    if (!latchX) {
      latchX = true;
      want('slip', Math.sign(v.x));
    }
  } else if (Math.abs(v.x) < 0.25) latchX = false;
  if (v.y < -0.58) {
    if (!latchY) {
      latchY = true;
      want('duck');
    }
  } else if (v.y > -0.25) latchY = false;
  if (input.pressed('punchL')) want('punch', -1);
  if (input.pressed('punchR')) want('punch', 1);
  if (input.pressed('rush')) want('rush');

  // A press that can't happen yet (mid-slip, mid-punch) waits a moment instead of vanishing.
  if (buffer.verb) {
    let done = false;
    if (buffer.verb === 'slip') done = fight.slip(buffer.arg);
    else if (buffer.verb === 'duck') done = fight.duck();
    else if (buffer.verb === 'punch') done = fight.punch(buffer.arg, buffer.body);
    else if (buffer.verb === 'rush') done = fight.rush() || s.rush < 100;
    buffer.t -= dt;
    if (done || buffer.t <= 0) buffer.verb = null;
  }
  fight.setGuard(input.down('guard'));
}

// ---- the loop ---------------------------------------------------------------------------------

kit.onPause((p) => audio.setSuspended(p || isPaused()));
document.addEventListener('visibilitychange', () => {
  if (document.hidden && fight && !top() && fight.state.mode !== 'result') openPause();
});

refreshIntro();
refreshPrompts();
renderStack();

kit.start((rawDt) => {
  if (input.pressed('mute')) toggleSound();
  if (top()) menuFrame(rawDt);
  else if (fight) fightFrame(rawDt);

  const paused = isPaused();
  let dt = paused ? 0 : rawDt;
  if (!paused && hitStop > 0) {
    hitStop -= rawDt;
    dt = 0;
  }
  if (!paused && slowMo > 0) {
    slowMo -= rawDt;
    dt *= 0.35;
  }
  if (fight && !paused) {
    fight.update(dt);
    if (fight.state.mode !== 'result') updateHUD();
  }
  if (pendingResult && !paused) {
    pendingResult.t -= rawDt;
    if (pendingResult.t <= 0) {
      const r = pendingResult.result;
      pendingResult = null;
      showResult(r);
    }
  }
  // The controls strip shows for the first seconds of a bout (not on touch: the buttons say it).
  if (!paused && fight && !top() && promptT > 0) promptT -= rawDt;
  const wantPrompts = promptT > 0 && !!fight && !top() && input.source !== 'touch';
  if (wantPrompts === ui.prompts.classList.contains('hidden')) show(ui.prompts, wantPrompts);

  ring.update(paused ? 0 : dt + (hitStop > 0 ? rawDt * 0.15 : 0), fight ? fight.state : null);
  ring.render();
});
