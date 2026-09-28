import { GameWorld, GAME_TITLE } from './game.js';
import { InputManager } from './input.js';
import { AudioManager } from './audio.js';

const $ = (s) => document.querySelector(s);
let canvas = $('#game');
const startOverlay = $('#start-overlay');
const startButton = $('#start-button');
const loadingText = $('#loading-text');
const backendBadge = $('#backend-badge');
const hud = $('#hud');
const bossHud = $('#boss-hud');
const toastEl = $('#toast');
const interactPrompt = $('#interact-prompt');
const levelOverlay = $('#level-overlay');
const completeOverlay = $('#complete-overlay');
const touchUi = $('#touch-ui');

const world = new GameWorld();
const audio = new AudioManager();
let rendererAdapter = null;
let input = null;
let started = false;
let lastTime = 0;
let accumulator = 0;
let toastUntil = 0;
const FIXED = 1 / 60;

function capabilityProbe() {
  const c = document.createElement('canvas');
  const gl2 = c.getContext('webgl2', { failIfMajorPerformanceCaveat: false });
  const gl1 = gl2 ? null : (c.getContext('webgl', { failIfMajorPerformanceCaveat: false }) || c.getContext('experimental-webgl'));
  return { webgpu: Boolean(navigator.gpu), webgl2: Boolean(gl2), webgl1: Boolean(gl1) };
}

function freshCanvas() {
  const next = canvas.cloneNode(false);
  canvas.replaceWith(next);
  canvas = next;
  return canvas;
}

async function bootRenderer() {
  const caps = capabilityProbe();
  loadingText.textContent = 'Preparing palace renderer…';
  if (caps.webgpu || caps.webgl2) {
    try {
      const { createModernRenderer } = await import('./renderer-modern.js');
      rendererAdapter = await createModernRenderer(canvas, world);
    } catch (firstError) {
      console.warn('Automatic modern renderer failed.', firstError);
      if (caps.webgl2) {
        try {
          freshCanvas();
          const { createModernRenderer } = await import('./renderer-modern.js');
          rendererAdapter = await createModernRenderer(canvas, world, { forceWebGL: true });
        } catch (forcedError) {
          console.warn('Forced WebGL2 backend failed.', forcedError);
        }
      }
    }
  }

  if (!rendererAdapter && (caps.webgl1 || caps.webgl2)) {
    freshCanvas();
    const { createLegacyRenderer } = await import('./renderer-legacy.js');
    rendererAdapter = await createLegacyRenderer(canvas, world);
  }

  if (!rendererAdapter) throw new Error('No compatible WebGPU, WebGL 2, or WebGL 1 renderer could start.');

  backendBadge.textContent = rendererAdapter.backend;
  backendBadge.classList.add('ready');
  setupInput();
  window.addEventListener('resize', () => rendererAdapter.resize());
  rendererAdapter.setAnimationLoop(frame);
  startButton.disabled = false;
  loadingText.textContent = `${rendererAdapter.backend} ready`;
}

function setupInput() {
  input = new InputManager({
    canvas,
    joystick: $('#joystick'),
    stick: $('#stick'),
    buttons: {
      jump: $('#btn-jump'), attack: $('#btn-attack'), guard: $('#btn-guard'),
      magic: $('#btn-magic'), interact: $('#btn-interact')
    },
    onZoom: (delta) => rendererAdapter?.adjustZoom(delta)
  });
}

function startGame() {
  if (!rendererAdapter || !input) return;
  started = true;
  world.start();
  audio.resume();
  startOverlay.classList.add('hidden');
  hud.classList.remove('hidden');
  touchUi.classList.remove('prestart');
  lastTime = 0;
  input.clear();
}

function restartGame() {
  world.reset();
  levelOverlay.classList.add('hidden');
  completeOverlay.classList.add('hidden');
  started = true;
  input?.clear();
  audio.resume();
  world.start();
}

function frame(ms) {
  const now = ms / 1000;
  const frameDt = lastTime ? Math.min(0.05, now - lastTime) : 0;
  lastTime = now;

  if (started && frameDt > 0 && !document.hidden) {
    accumulator = Math.min(accumulator + frameDt, 0.12);
    let consumed = false;
    while (accumulator >= FIXED) {
      const state = input.snapshot();
      world.update(FIXED, state);
      if (!consumed) {
        input.consumeTransient();
        consumed = true;
      }
      accumulator -= FIXED;
      if (world.pausedForUpgrade || world.complete) break;
    }
    processEvents();
    audio.update();
  }

  rendererAdapter?.render(world, Math.max(frameDt, 1 / 120));
  updateUi(now);
}

function processEvents() {
  for (const ev of world.drainEvents()) {
    if (ev.type === 'sound') audio.play(ev.name);
    else if (ev.type === 'burst') rendererAdapter?.spawnBurst(ev);
    else if (ev.type === 'toast') showToast(ev.text, ev.long ? 4.8 : 2.8);
    else if (ev.type === 'checkpoint') showToast(ev.text, 2.4);
    else if (ev.type === 'levelup') showLevelUp(ev.level);
    else if (ev.type === 'complete') showComplete();
  }
}

function showToast(text, seconds = 2.8) {
  toastEl.textContent = text;
  toastEl.classList.add('show');
  toastUntil = performance.now() / 1000 + seconds;
}

function showLevelUp(level) {
  $('#level-number').textContent = level;
  $('#upgrade-attack-value').textContent = `Sword ${world.attackDamage} → ${world.attackDamage + 3}`;
  $('#upgrade-vitality-value').textContent = `Max HP ${world.maxHp} → ${world.maxHp + 20}`;
  $('#upgrade-focus-value').textContent = `Max energy ${world.maxMana} → ${world.maxMana + 20}`;
  levelOverlay.classList.remove('hidden');
}

function chooseUpgrade(stat) {
  if (world.chooseUpgrade(stat)) {
    if (!world.pausedForUpgrade) levelOverlay.classList.add('hidden');
    processEvents();
  }
}

function showComplete() {
  const p = world.player;
  $('#complete-stats').textContent = `Level ${p.level} · ${p.deaths} checkpoint restores · ${world.gearCollected ? 'Ember Edge found' : 'base blade clear'}`;
  completeOverlay.classList.remove('hidden');
}

function updateUi(now) {
  if (toastUntil && now > toastUntil) toastEl.classList.remove('show');
  const p = world.player;
  const setBar = (id, value) => $(id).style.width = `${Math.max(0, Math.min(100, value * 100))}%`;
  setBar('#hp-fill', p.hp / world.maxHp);
  setBar('#mp-fill', p.mana / world.maxMana);
  setBar('#xp-fill', p.xp / world.xpToNext);
  $('#hp-text').textContent = `${Math.ceil(p.hp)}/${world.maxHp}`;
  $('#mp-text').textContent = `${Math.ceil(p.mana)}/${world.maxMana}`;
  $('#level-text').textContent = `LV ${p.level}`;
  $('#objective').textContent = world.objective;
  $('#gear-text').textContent = p.swordTier > 1 ? 'Ember Edge' : 'Palace Blade';

  const prompt = started ? world.interactionPrompt() : '';
  interactPrompt.textContent = prompt ? `${matchMedia('(pointer: coarse)').matches ? 'ACTION' : 'E'} · ${prompt}` : '';
  interactPrompt.classList.toggle('show', Boolean(prompt));
  $('#btn-interact').classList.toggle('contextual', Boolean(prompt));

  const boss = world.boss;
  const showBoss = boss?.alive && world.bossFight;
  bossHud.classList.toggle('show', Boolean(showBoss));
  if (showBoss) setBar('#boss-fill', boss.hp / boss.maxHp);
}

startButton.addEventListener('click', startGame);
$('#mute-button').addEventListener('click', (e) => {
  e.stopPropagation();
  const enabled = audio.toggle();
  e.currentTarget.textContent = enabled ? 'SOUND ON' : 'SOUND OFF';
});
$('#restart-button').addEventListener('click', restartGame);
$('#complete-restart').addEventListener('click', restartGame);
for (const button of document.querySelectorAll('[data-upgrade]')) {
  button.addEventListener('click', () => chooseUpgrade(button.dataset.upgrade));
}

document.addEventListener('visibilitychange', () => {
  lastTime = 0;
  accumulator = 0;
});

$('#game-title').textContent = GAME_TITLE;
bootRenderer().catch((err) => {
  console.error(err);
  loadingText.textContent = 'Renderer failed to start. This build needs internet access for its pinned three.js modules.';
  startButton.disabled = true;
  backendBadge.textContent = 'Renderer unavailable';
});
