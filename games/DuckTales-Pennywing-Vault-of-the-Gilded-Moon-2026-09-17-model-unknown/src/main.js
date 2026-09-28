import { GameSimulation, XP_THRESHOLDS } from './game/core.js';
import { InputController } from './game/input.js';
import { AudioEngine } from './game/audio.js';

const STORAGE_KEY = 'pennywing-vault-profile-v1';
const app = document.querySelector('#app');

app.innerHTML = `
  <main class="game-shell" id="gameShell">
    <div class="viewport" id="viewport" aria-label="3D game viewport"></div>
    <div class="vignette"></div><div class="scanlines"></div><div class="damage-flash" id="damageFlash"></div>

    <div class="topbar">
      <div class="hud-cluster">
        <div class="hud-pill health" id="health"></div>
        <div class="hud-pill">COINS <strong id="coins">0</strong></div>
        <div class="hud-pill">LV <strong id="level">1</strong></div>
        <div class="hud-pill mission-pill" id="mission">Find the Moon Gear</div>
        <div class="hud-pill renderer-badge" id="rendererBadge">Renderer: loading</div>
      </div>
      <button class="icon-btn" id="soundButton" aria-label="Toggle sound">SND</button>
    </div>
    <div class="progress-wrap"><div class="progress-bar" id="xpBar"></div></div>
    <div class="escape-timer" id="escapeTimer">EXIT 55.0</div>
    <div class="toast-stack" id="toasts"></div>
    <div class="objective-card hidden" id="objectiveCard">
      <div class="objective-kicker" id="objectiveKicker"></div>
      <div class="objective-title" id="objectiveTitle"></div>
      <div class="objective-sub" id="objectiveSub"></div>
    </div>

    <div class="mobile-controls" id="mobileControls">
      <div class="joy-base" id="joystick"><div class="joy-knob" id="joyKnob"></div></div>
      <div class="action-grid">
        <button class="action-btn use" id="useButton">USE</button>
        <button class="action-btn pogo" id="pogoButton">BOUNCE</button>
        <button class="action-btn jump" id="jumpButton">JUMP</button>
      </div>
    </div>
    <div class="desktop-hint">A/D or ←/→ move · Space jump · X/K bounce · E use · wheel zoom</div>
    <div class="rotate-hint">Landscape gives a wider view. Portrait remains fully playable.</div>

    <div class="modal-backdrop" id="splash">
      <section class="panel">
        <div class="eyebrow">A tiny treasure-platforming expedition</div>
        <h1><span class="title-mark">Pennywing</span><br>Vault of the Gilded Moon</h1>
        <p class="hero-line">Springstaff through a clockwork ruin, raid risky side routes, crack the vault sentinel, then get out before the chamber folds in.</p>
        <div class="feature-row">
          <div class="feature"><strong>BOUNCE TO FIGHT</strong><span>Hold BOUNCE while falling. Land on enemies and cracked caches with the staff extended.</span></div>
          <div class="feature"><strong>THREE ROUTES</strong><span>Safe main path, fast high road, and a dangerous lower treasure detour.</span></div>
          <div class="feature"><strong>UPGRADE MID-RUN</strong><span>Spend treasure at the Springsmith. Upgrades help, but the base kit can clear the mission.</span></div>
        </div>
        <button class="primary-btn" id="startButton">START EXPEDITION</button>
        <div class="mini-note">Mobile: left thumb moves; right thumb jumps/bounces. Pinch the playfield to zoom. Desktop: keyboard controls are shown after start. Original geometry, sounds, names, and level layout.</div>
      </section>
    </div>

    <div class="modal-backdrop hidden" id="upgradeModal">
      <section class="panel">
        <div class="eyebrow">Springsmith Workbench</div>
        <h2>Spend the haul</h2>
        <p>Upgrades are permanent across replays. The sentinel can still be beaten with the stock springstaff.</p>
        <div class="upgrade-grid" id="upgradeGrid"></div>
        <button class="secondary-btn" id="closeUpgrade">BACK TO VAULT</button>
      </section>
    </div>

    <div class="modal-backdrop hidden" id="completeModal">
      <section class="panel">
        <div class="eyebrow">Expedition Complete</div>
        <h2>The Gilded Moon is yours.</h2>
        <p>The vault is open for replay. Permanent gear and explorer XP carry forward.</p>
        <div class="stats-grid" id="completeStats"></div>
        <button class="primary-btn" id="replayButton">RUN THE VAULT AGAIN</button>
      </section>
    </div>

    <div class="modal-backdrop hidden" id="errorModal">
      <section class="panel">
        <div class="eyebrow">Renderer Error</div>
        <h2>Graphics could not start.</h2>
        <p id="errorText"></p>
        <button class="secondary-btn" onclick="location.reload()">RELOAD</button>
      </section>
    </div>
  </main>
`;

const $ = (id) => document.getElementById(id);
const shell = $('gameShell');
const viewport = $('viewport');
const splash = $('splash');
const startButton = $('startButton');
const healthEl = $('health');
const coinsEl = $('coins');
const levelEl = $('level');
const missionEl = $('mission');
const rendererBadge = $('rendererBadge');
const xpBar = $('xpBar');
const escapeTimer = $('escapeTimer');
const toasts = $('toasts');
const objectiveCard = $('objectiveCard');
const upgradeModal = $('upgradeModal');
const upgradeGrid = $('upgradeGrid');
const completeModal = $('completeModal');
const completeStats = $('completeStats');
const soundButton = $('soundButton');

let profile = loadProfile();
let sim = new GameSimulation({ profile, onEvent: handleGameEvent });
let input = null;
let graphics = null;
let audio = new AudioEngine();
let running = false;
let paused = true;
let lastTime = performance.now();
let objectiveTimer = null;
let currentSnapshot = sim.getSnapshot();

function loadProfile() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
}
function saveProfile(next) {
  profile = { ...next };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); } catch {}
}

function handleGameEvent(event) {
  if (event.type === 'profile') saveProfile(event.profile);
  if (event.type === 'toast') showToast(event.text, event.tone || '');
  if (event.type === 'objective') showObjective(event);
  if (event.type === 'sfx') audio.sfx(event.name);
  if (event.type === 'damage') flashDamage();
  if (event.type === 'openUpgrade') openUpgrade();
  if (event.type === 'complete') showComplete(event.stats);
}

function showToast(text, tone = '') {
  const el = document.createElement('div');
  el.className = `toast ${tone}`;
  el.textContent = text;
  toasts.appendChild(el);
  while (toasts.children.length > 3) toasts.firstElementChild.remove();
  setTimeout(() => el.remove(), 2600);
}

function showObjective({ kicker = '', title = '', sub = '' }) {
  $('objectiveKicker').textContent = kicker;
  $('objectiveTitle').textContent = title;
  $('objectiveSub').textContent = sub;
  objectiveCard.classList.remove('hidden');
  clearTimeout(objectiveTimer);
  objectiveTimer = setTimeout(() => objectiveCard.classList.add('hidden'), 3900);
}

function flashDamage() {
  const el = $('damageFlash');
  el.classList.add('on');
  setTimeout(() => el.classList.remove('on'), 120);
  if (navigator.vibrate) navigator.vibrate(28);
}

function openUpgrade() {
  if (!running || sim.completed) return;
  paused = true;
  input?.clearTransient();
  renderUpgradeGrid();
  upgradeModal.classList.remove('hidden');
}

function renderUpgradeGrid() {
  const info = sim.getUpgradeInfo();
  const card = (key, item) => `
    <article class="upgrade-card">
      <h3>${item.name}</h3>
      <p>${item.description}</p>
      <div class="upgrade-meta"><span>Gear level ${item.level}</span><span>${item.maxed ? 'MAX' : item.cost + ' coins'}</span></div>
      <button class="upgrade-btn" data-upgrade="${key}" ${item.maxed || sim.runCoins < item.cost ? 'disabled' : ''}>${item.maxed ? 'INSTALLED' : 'INSTALL'}</button>
    </article>`;
  upgradeGrid.innerHTML = card('staff', info.staff) + card('coat', info.coat);
  upgradeGrid.querySelectorAll('[data-upgrade]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const result = sim.buyUpgrade(btn.dataset.upgrade);
      if (!result.ok && result.reason === 'coins') showToast('Not enough coins for that upgrade.', 'bad');
      renderUpgradeGrid();
      updateHud(sim.getSnapshot());
    });
  });
}

$('closeUpgrade').addEventListener('click', () => {
  upgradeModal.classList.add('hidden'); paused = false; lastTime = performance.now();
});

function showComplete(stats) {
  paused = true;
  completeStats.innerHTML = `
    <div class="stat"><small>Time</small><strong>${formatTime(stats.time)}</strong></div>
    <div class="stat"><small>Treasure found</small><strong>${stats.treasure}%</strong></div>
    <div class="stat"><small>Explorer level</small><strong>${stats.level}</strong></div>
    <div class="stat"><small>Falls / knockouts</small><strong>${stats.deaths}</strong></div>
  `;
  completeModal.classList.remove('hidden');
}

$('replayButton').addEventListener('click', () => {
  completeModal.classList.add('hidden');
  sim.resetRun();
  currentSnapshot = sim.getSnapshot();
  paused = false; lastTime = performance.now();
  showObjective({ kicker:'Moon-Vault Expedition', title:'Find the Moon Gear', sub:'Try a different route. Permanent gear carries forward.' });
});

soundButton.addEventListener('click', async () => {
  await audio.start();
  const muted = audio.toggleMuted();
  soundButton.textContent = muted ? 'MUTE' : 'SND';
  showToast(muted ? 'Sound muted' : 'Sound on');
});

startButton.addEventListener('click', startGame, { once: true });

async function startGame() {
  startButton.disabled = true;
  startButton.textContent = 'STARTING GRAPHICS…';
  await audio.start();
  try {
    graphics = await chooseRenderer();
    rendererBadge.textContent = `Renderer: ${graphics.backend}`;
    input = new InputController({
      root: shell,
      viewport,
      joystick: $('joystick'), knob: $('joyKnob'),
      jumpButton: $('jumpButton'), pogoButton: $('pogoButton'), useButton: $('useButton')
    });
    splash.classList.add('hidden');
    paused = false; running = true; lastTime = performance.now();
    showObjective({ kicker:'Moon-Vault Expedition', title:'Find the Moon Gear', sub:'High road for speed. Low route for enough treasure to buy upgrades early.' });
    requestAnimationFrame(loop);
  } catch (err) {
    console.error(err);
    $('errorText').textContent = `${err?.message || err}. This game needs WebGPU, WebGL 2, or WebGL 1 with JavaScript modules enabled.`;
    $('errorModal').classList.remove('hidden');
    splash.classList.add('hidden');
  }
}

async function chooseRenderer() {
  const params = new URLSearchParams(location.search);
  const forceLegacy = params.get('legacy') === '1';
  const forceWebGL2 = params.get('webgl2') === '1';
  const gl2Probe = document.createElement('canvas');
  const gl1Probe = document.createElement('canvas');
  const gl2 = !forceLegacy && gl2Probe.getContext('webgl2');
  const gl1 = gl1Probe.getContext('webgl') || gl1Probe.getContext('experimental-webgl');

  if (!forceLegacy && (navigator.gpu || gl2)) {
    try {
      const { createModernRenderer } = await import('./game/modernRenderer.js');
      return await createModernRenderer(viewport, { forceWebGL: forceWebGL2 });
    } catch (err) {
      console.warn('Modern renderer failed, trying WebGL 1 fallback.', err);
      if (!gl1) throw err;
    }
  }
  if (gl1) {
    const { createLegacyRenderer } = await import('./game/legacyRenderer.js');
    return await createLegacyRenderer(viewport);
  }
  throw new Error('No supported GPU browser API was found.');
}

function loop(now) {
  if (!running) return;
  const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;
  const frameInput = input?.frame() || {};
  if (!paused && !document.hidden) currentSnapshot = sim.step(dt, frameInput);
  else currentSnapshot = sim.getSnapshot();
  graphics.render(currentSnapshot, sim.time, frameInput);
  updateHud(currentSnapshot);
  requestAnimationFrame(loop);
}

function updateHud(s) {
  const full = '♥'.repeat(Math.max(0, s.player.hp));
  const empty = '♥'.repeat(Math.max(0, s.player.maxHp - s.player.hp));
  healthEl.innerHTML = `${full}<span class="empty">${empty}</span>`;
  coinsEl.textContent = s.runCoins;
  levelEl.textContent = s.profile.level;
  missionEl.textContent = s.missionText;
  const lvl = s.profile.level;
  const base = XP_THRESHOLDS[Math.min(lvl - 1, XP_THRESHOLDS.length - 1)] || 0;
  const next = XP_THRESHOLDS[lvl] ?? (base + 160);
  xpBar.style.transform = `scaleX(${Math.max(0, Math.min(1, (s.profile.xp - base) / Math.max(1, next - base)))})`;
  escapeTimer.classList.toggle('visible', s.phase === 'escape');
  escapeTimer.textContent = `EXIT ${Math.max(0, s.escapeTime).toFixed(1)}`;
  $('useButton').style.opacity = s.canInteract ? '1' : '.42';
  $('useButton').textContent = s.canInteract ? 'SHOP' : 'USE';
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

window.addEventListener('blur', () => { lastTime = performance.now(); });
document.addEventListener('visibilitychange', () => { lastTime = performance.now(); });
