import { createGameState, startMission, updateGame, canUseShop, buyUpgrade, UPGRADE_DEFS, getBoss, getMissionSummary } from './sim.js';
import { createRenderSystem } from './render.js';
import { createFallback2D } from './fallback2d.js';
import { createInputSystem } from './input.js';
import { createAudioSystem } from './audio.js';

const $ = s => document.querySelector(s);
const canvas = $('#game');
const startScreen = $('#start-screen');
const loadingScreen = $('#loading-screen');
const loadingDetail = $('#loading-detail');
const hud = $('#hud');
const touchControls = $('#touch-controls');
const tutorial = $('#tutorial');
const pauseButton = $('#pause-button');
const tradeButton = $('#trade-button');
const shopModal = $('#shop-modal');
const pauseModal = $('#pause-modal');
const endScreen = $('#end-screen');
const damageFlash = $('#damage-flash');
const backendEl = $('#backend');
const qualityButton = $('#quality-button');

const QUERY = new URLSearchParams(location.search);
const STEP = 1 / 60;
let rendererSystem = null;
let inputSystem = null;
let state = null;
let loopStarted = false;
let lastTime = performance.now();
let accumulator = 0;
let paused = false;
let endedHandled = false;
let quality = safeStorageGet('dustshot-quality') || 'auto';
let careerXP = Number(safeStorageGet('dustshot-career-xp') || 0);
let renown = Math.min(6, Math.floor(careerXP / 1200));
const audio = createAudioSystem();

const qualityOrder = ['auto', 'high', 'low'];
updateQualityLabel();

$('#start-button').addEventListener('click', startGame);
qualityButton.addEventListener('click', () => {
  const i = qualityOrder.indexOf(quality);
  quality = qualityOrder[(i + 1) % qualityOrder.length];
  safeStorageSet('dustshot-quality', quality);
  rendererSystem?.setQuality?.(quality);
  updateQualityLabel();
});
pauseButton.addEventListener('click', openPause);
$('#resume-button').addEventListener('click', closePause);
$('#restart-button').addEventListener('click', () => { closePause(); restartMission(); });
tradeButton.addEventListener('click', openShop);
$('#shop-close').addEventListener('click', closeShop);
$('#replay-button').addEventListener('click', () => { endScreen.classList.add('hidden'); restartMission(); });

addEventListener('blur', () => {
  if (state?.status === 'playing' && !paused) openPause();
});
addEventListener('visibilitychange', () => {
  if (document.hidden && state?.status === 'playing' && !paused) openPause();
});

async function startGame() {
  startScreen.classList.add('hidden');
  loadingScreen.classList.remove('hidden');
  await audio.start();
  try {
    rendererSystem = await loadRenderer();
  } catch (err) {
    console.error(err);
    loadingDetail.textContent = '3D initialization failed. Starting the emergency 2D renderer.';
    rendererSystem = await createFallback2D(canvas);
  }
  backendEl.textContent = `Renderer: ${rendererSystem.backendLabel}`;
  inputSystem = createInputSystem({
    canvas,
    moveZone: $('#move-zone'), aimZone: $('#aim-zone'), moveKnob: $('#move-knob'), aimKnob: $('#aim-knob'),
    getRenderer: () => rendererSystem,
    getPlayer: () => state?.player,
  });
  loadingScreen.classList.add('hidden');
  beginMission();
  if (QUERY.has('debug')) window.__dustshot = { getState: () => state, getRenderer: () => rendererSystem, restart: restartMission, openShop };
  if (!loopStarted) {
    loopStarted = true;
    lastTime = performance.now();
    requestAnimationFrame(frame);
  }
}

async function loadRenderer() {
  const force2d = QUERY.has('fallback');
  const forceLegacy = QUERY.has('legacy');
  if (force2d) return createFallback2D(canvas);

  const probe = document.createElement('canvas');
  const hasWebGL2 = !!probe.getContext('webgl2');
  const hasWebGL1 = !!probe.getContext('webgl') || !!probe.getContext('experimental-webgl');

  if (!forceLegacy && (navigator.gpu || hasWebGL2)) {
    loadingDetail.textContent = navigator.gpu ? 'Starting Three.js r186 with WebGPU.' : 'Starting Three.js r186 with its WebGL2 backend.';
    try {
      const THREE = await import('three');
      let TSL = null, bloomFactory = null;
      try {
        const [tslModule, bloomModule] = await Promise.all([
          import('three/tsl'),
          import('three/addons/tsl/display/BloomNode.js'),
        ]);
        TSL = tslModule;
        bloomFactory = bloomModule.bloom || null;
      } catch (fxErr) {
        console.warn('TSL post effects unavailable. Continuing without bloom.', fxErr);
      }
      return await createRenderSystem({ canvas, THREE, TSL, bloomFactory, legacy: false, quality });
    } catch (modernErr) {
      console.warn('Modern Three.js renderer failed.', modernErr);
    }
  }

  if (hasWebGL1) {
    loadingDetail.textContent = 'Using the Three.js r162 WebGL1 compatibility renderer.';
    try {
      const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.162.0/build/three.module.js');
      return await createRenderSystem({ canvas, THREE, legacy: true, quality: 'low' });
    } catch (legacyErr) {
      console.warn('WebGL1 compatibility renderer failed.', legacyErr);
    }
  }

  loadingDetail.textContent = 'Using the emergency Canvas2D renderer.';
  return createFallback2D(canvas);
}

function beginMission() {
  renown = Math.min(6, Math.floor(careerXP / 1200));
  state = createGameState({ renown });
  state.player.cash += renown * 10;
  startMission(state);
  paused = false;
  endedHandled = false;
  accumulator = 0;
  inputSystem?.reset();
  hud.classList.remove('hidden');
  pauseButton.classList.remove('hidden');
  if (inputSystem?.coarse || innerWidth < 760) touchControls.classList.remove('hidden');
  else touchControls.classList.add('hidden');
  tutorial.classList.remove('hidden');
  tutorial.style.animation = 'none';
  void tutorial.offsetWidth;
  tutorial.style.animation = '';
  setTimeout(() => tutorial.classList.add('hidden'), 6200);
  endScreen.classList.add('hidden');
  shopModal.classList.add('hidden');
  pauseModal.classList.add('hidden');
  updateHUD();
  showToast(`RENOWN ${renown} — starting cash bonus $${renown * 10}`);
}

function restartMission() {
  beginMission();
}

function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;
  const input = inputSystem?.update() || { moveX: 0, moveZ: 0, aimX: 0, aimZ: -1, aimMagnitude: 0, fire: false };
  let frameEvents = [];

  if (state && !paused && state.status === 'playing') {
    if (inputSystem.consumeInteract() && canUseShop(state)) openShop();
    if (!paused) {
      accumulator = Math.min(accumulator + dt, STEP * 4);
      while (accumulator >= STEP) {
        updateGame(state, input, STEP);
        frameEvents.push(...state.events);
        accumulator -= STEP;
      }
    }
  } else {
    inputSystem?.consumeInteract();
    accumulator = 0;
  }

  if (state) {
    if (frameEvents.length) processEvents(frameEvents);
    state.events = frameEvents;
    rendererSystem?.render(state, dt);
    state.events = [];
    updateHUD();
    updateInteraction();
    if ((state.status === 'victory' || state.status === 'defeat') && !endedHandled) finishMission();
  }
  requestAnimationFrame(frame);
}

function processEvents(events) {
  audio.handle(events);
  for (const ev of events) {
    if (ev.type === 'playerHit') {
      damageFlash.classList.add('active');
      setTimeout(() => damageFlash.classList.remove('active'), 100);
    } else if (ev.type === 'posterFound') showToast('WARRANT FOUND — the stockade is open');
    else if (ev.type === 'gateDenied') showToast('LOCKED — search the town for the WANTED poster');
    else if (ev.type === 'levelUp') showToast(`LEVEL ${ev.level} — damage +7%, +5 max health`);
    else if (ev.type === 'equipment' && ev.kind === 'boots') showToast('SPURRED BOOTS — movement +12%');
    else if (ev.type === 'equipment' && ev.kind === 'silver') showToast('SILVER ROUNDS — damage +10%');
    else if (ev.type === 'bossIntro') showToast('MARSHAL VEX — $2,500 REWARD');
    else if (ev.type === 'bossEnrage') showToast('VEX CALLS FOR BACKUP');
  }
}

function updateHUD() {
  if (!state) return;
  const p = state.player;
  const hpRatio = p.maxHp ? p.hp / p.maxHp : 0;
  $('#health-fill').style.transform = `scaleX(${Math.max(0, hpRatio)})`;
  $('#health-text').textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
  $('#level-text').textContent = `LV ${p.level}`;
  $('#xp-text').textContent = `${Math.floor(p.xp)} / ${p.xpNeed} XP`;
  $('#xp-fill').style.transform = `scaleX(${Math.max(0, Math.min(1, p.xp / p.xpNeed))})`;
  $('#cash').textContent = `$${Math.floor(p.cash)}`;
  $('#score').textContent = String(Math.floor(p.score)).padStart(6, '0');
  $('#objective').textContent = state.objective;
  const boss = getBoss(state);
  if (boss) {
    $('#boss-hud').classList.remove('hidden');
    $('#boss-fill').style.transform = `scaleX(${Math.max(0, boss.hp / boss.maxHp)})`;
  } else $('#boss-hud').classList.add('hidden');
}

function updateInteraction() {
  if (!state || paused || state.status !== 'playing') { tradeButton.classList.add('hidden'); return; }
  tradeButton.classList.toggle('hidden', !canUseShop(state));
}

function openShop() {
  if (!state || !canUseShop(state) || state.status !== 'playing') return;
  paused = true;
  inputSystem?.reset();
  shopModal.classList.remove('hidden');
  tradeButton.classList.add('hidden');
  renderShop();
}
function closeShop() { shopModal.classList.add('hidden'); paused = false; accumulator = 0; }

function renderShop() {
  const list = $('#upgrade-list');
  list.innerHTML = '';
  for (const [key, def] of Object.entries(UPGRADE_DEFS)) {
    const row = document.createElement('div'); row.className = 'upgrade';
    const copy = document.createElement('div'); copy.innerHTML = `<b>${def.label}</b><span>${def.detail}</span>`;
    const button = document.createElement('button');
    const owned = state.player.upgrades[key] > 0;
    button.textContent = owned ? 'OWNED' : `$${def.cost}`;
    button.disabled = owned || state.player.cash < def.cost;
    button.addEventListener('click', () => {
      if (buyUpgrade(state, key)) {
        audio.handle([{ type: 'upgrade', key }]);
        showToast(`${def.label.toUpperCase()} INSTALLED`);
        state.events = [];
        renderShop(); updateHUD();
      }
    });
    row.append(copy, button); list.append(row);
  }
  $('#shop-cash').textContent = `$${Math.floor(state.player.cash)}`;
}

function openPause() {
  if (!state || state.status !== 'playing' || !shopModal.classList.contains('hidden')) return;
  paused = true;
  inputSystem?.reset();
  pauseModal.classList.remove('hidden');
}
function closePause() { pauseModal.classList.add('hidden'); paused = false; accumulator = 0; }

function finishMission() {
  endedHandled = true;
  inputSystem?.reset();
  tradeButton.classList.add('hidden');
  pauseButton.classList.add('hidden');
  touchControls.classList.add('hidden');
  const summary = getMissionSummary(state);
  const earned = Math.floor(summary.score * 0.08 + summary.kills * 12);
  careerXP += earned;
  safeStorageSet('dustshot-career-xp', careerXP);
  renown = Math.min(6, Math.floor(careerXP / 1200));

  setTimeout(() => {
    const victory = state.status === 'victory';
    $('#end-kicker').textContent = victory ? 'BOUNTY COMPLETE' : 'TRAIL ENDED';
    $('#end-title').textContent = victory ? 'Cinder Creek is clear' : 'Marshal Vex keeps the town';
    $('#replay-button').textContent = victory ? 'RIDE AGAIN' : 'TRY AGAIN';
    $('#summary').innerHTML = [
      ['SCORE', summary.score.toLocaleString()],
      ['KILLS', summary.kills],
      ['ACCURACY', `${summary.accuracy}%`],
      ['TIME', formatTime(summary.time)],
      ['LEVEL', summary.level],
      ['DAMAGE TAKEN', summary.damageTaken],
    ].map(([label, value]) => `<div><b>${value}</b><span>${label}</span></div>`).join('');
    $('#renown-line').textContent = `Renown ${renown}. This run earned ${earned} career XP. Each Renown rank adds only $10 starting cash, so the combat curve does not require grinding.`;
    endScreen.classList.remove('hidden');
  }, state.status === 'victory' ? 900 : 550);
}

function showToast(message) {
  const t = $('#toast');
  t.textContent = message;
  t.classList.remove('hidden');
  t.style.animation = 'none';
  void t.offsetWidth;
  t.style.animation = '';
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => t.classList.add('hidden'), 1800);
}

function updateQualityLabel() { qualityButton.textContent = `QUALITY: ${quality.toUpperCase()}`; }
function formatTime(sec) { const m = Math.floor(sec / 60); const s = Math.floor(sec % 60); return `${m}:${String(s).padStart(2, '0')}`; }
function safeStorageGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function safeStorageSet(k, v) { try { localStorage.setItem(k, String(v)); } catch {} }

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
