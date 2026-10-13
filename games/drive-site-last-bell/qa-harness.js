/* Internal browser test controls. Active only with ?qa in the URL.
 * The bot reads combat state. It sends actions through the normal input path.
 * Touch mode uses DOM PointerEvents and the real TouchControls bindings.
 * Synthetic events do not prove native capture or physical phone input.
 */
const api = window.__lastBellQA;
const { game, bout } = api;
const keyboardCodes = {
  left: 'KeyA', right: 'KeyD', duck: 'KeyS', guard: 'Space',
  leftHead: 'KeyJ', rightHead: 'KeyK', leftBody: 'KeyU', rightBody: 'KeyI',
  special: 'KeyL', recover: 'Space',
};
const panel = document.createElement('details');
panel.id = 'qaPanel';
panel.open = true;
panel.setAttribute('data-ui', '');
panel.style.cssText = 'position:fixed;top:6px;left:6px;z-index:100;width:min(720px,calc(100% - 12px));padding:6px;background:#102a31f5;border:1px solid #82b8ad;border-radius:4px;font:12px/1.4 Arial;color:#e7eeda;box-shadow:0 3px 12px #0006;';
panel.innerHTML = `
  <style>
    #qaPanel:not([open]) { top:auto!important;bottom:3px;left:50%!important;transform:translateX(-50%);width:auto!important;padding:0 7px!important; }
    #qaPanel:not([open]) .qa-expanded { display:none; }
  </style>
  <summary style="cursor:pointer;min-height:28px;line-height:28px;">QA<span class="qa-expanded"> test controls · <span id="qaStatus" role="status">Ready · keyboard</span></span></summary>
  <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding-top:6px;">
    <label style="display:flex;align-items:center;gap:6px;min-height:36px;padding:0 5px;"><input id="qaUseTouch" type="checkbox"> Use touch controls</label>
    <button id="qaTraining" type="button">Run training</button>
    <button id="qaBout" type="button">Run full bout</button>
    <button id="qaLose" type="button">Run idle loss</button>
    <button id="qaRecovery" type="button">Run recovery loss</button>
    <button id="qaStop" type="button">Stop input</button>
  </div>
  <p style="margin:6px 4px 2px;color:#bbd2c9;font-size:11px;">Runs use 3× speed. Touch sends pointer events to the visible game buttons. Rotate to pause. Use the game’s Resume button to continue. Collapse this panel to inspect the game.</p>`;
document.body.append(panel);
panel.querySelectorAll('button').forEach(button => {
  button.style.cssText = 'background:#335550;color:#f0efde;padding:8px;min-height:36px;border:1px solid #719289;border-radius:3px;font:12px Arial;cursor:pointer;';
});
const status = document.getElementById('qaStatus');
const useTouch = document.getElementById('qaUseTouch');
let mode = null, inputMode = 'keyboard', move = null, started = 0;
let samples = [], phases = new Set(), lessons = new Set(), pending = new Map();
let counts = emptyCounts(), controlSizes = new Map(), lastControlView = '';
let nextPointerId = 900000, pausedLastFrame = false;

function emptyCounts() {
  return {
    keyboardPresses: 0, keyboardReleases: 0,
    pointerDowns: 0, pointerUps: 0, pointerCancels: 0,
    touchAccepted: 0, touchRejected: 0, actions: {},
  };
}
function forceTouchView() {
  if (!api.settings.showTouch) {
    api.settings.showTouch = true;
    api.applySettings();
  }
}
useTouch.addEventListener('change', () => {
  if (useTouch.checked) forceTouchView();
  inputMode = useTouch.checked ? 'touch' : 'keyboard';
  panel.dataset.inputMode = inputMode;
  status.textContent = `Ready · ${inputMode}`;
});
panel.dataset.inputMode = inputMode;

function controlFor(action) {
  return action === 'recover'
    ? document.getElementById('recoverButton')
    : document.querySelector(`#touchControls [data-action="${action}"]`);
}
function controlSize(button, action) {
  if (!button) return null;
  const rect = button.getBoundingClientRect();
  const style = getComputedStyle(button);
  const visible = rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  const round = n => Math.round(n * 10) / 10;
  return {
    action, label: button.getAttribute('aria-label') || button.textContent.trim(),
    width: round(rect.width), height: round(rect.height),
    x: round(rect.x), y: round(rect.y), visible,
    inert: Boolean(button.closest('[inert]')), disabled: Boolean(button.disabled),
  };
}
function measureControls() {
  for (const action of Object.keys(keyboardCodes)) {
    const size = controlSize(controlFor(action), action);
    if (size?.visible) controlSizes.set(action, size);
  }
  const pause = controlSize(document.getElementById('pauseButton'), 'pause');
  if (pause?.visible) controlSizes.set('pause', pause);
}
function pointerEvent(type, token) {
  const rect = token.button.getBoundingClientRect();
  return new PointerEvent(type, {
    bubbles: true, cancelable: true, composed: true,
    pointerId: token.pointerId, pointerType: 'touch', isPrimary: token.primary,
    button: 0, buttons: type === 'pointerdown' ? 1 : 0,
    pressure: type === 'pointerdown' ? .5 : 0, width: 12, height: 12,
    clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
  });
}
function pressAction(action, hold = false) {
  if (pending.has(action)) return false;
  const token = { action, inputMode, time: hold ? Infinity : .025 };
  if (inputMode === 'touch') {
    const button = controlFor(action);
    const size = controlSize(button, action);
    // Wait for the visible control after a mode change.
    if (!size?.visible || size.inert || size.disabled) return false;
    token.button = button;
    token.pointerId = nextPointerId++;
    token.primary = ![...pending.values()].some(p => p.inputMode === 'touch');
    controlSizes.set(action, size);
    counts.pointerDowns++;
    button.dispatchEvent(pointerEvent('pointerdown', token));
    const accepted = api.touch.snapshot().pointers.some(p => p.pointerId === token.pointerId);
    if (!accepted) {
      counts.touchRejected++;
      counts.pointerCancels++;
      button.dispatchEvent(pointerEvent('pointercancel', token));
      return false;
    }
    counts.touchAccepted++;
  } else {
    token.code = keyboardCodes[action];
    game.input.press(token.code);
    counts.keyboardPresses++;
  }
  pending.set(action, token);
  counts.actions[action] = (counts.actions[action] || 0) + 1;
  return true;
}
function releaseAction(action, cancelled = false) {
  const token = pending.get(action);
  if (!token) return;
  pending.delete(action);
  if (token.inputMode === 'touch') {
    const type = cancelled ? 'pointercancel' : 'pointerup';
    if (cancelled) counts.pointerCancels++; else counts.pointerUps++;
    token.button.dispatchEvent(pointerEvent(type, token));
  } else {
    game.input.release(token.code);
    counts.keyboardReleases++;
  }
}
function releaseAll(cancelled = true) {
  for (const action of [...pending.keys()]) releaseAction(action, cancelled);
  api.touch?.clear();
  game.input.clear();
}
function begin(kind) {
  if (document.getElementById('startButton').disabled) {
    status.textContent = 'Wait for the ring art to load.';
    return;
  }
  releaseAll();
  inputMode = useTouch.checked ? 'touch' : 'keyboard';
  if (inputMode === 'touch') forceTouchView();
  mode = kind;
  move = null;
  samples = [];
  phases = new Set();
  lessons = new Set();
  counts = emptyCounts();
  controlSizes = new Map();
  lastControlView = '';
  started = performance.now();
  pausedLastFrame = false;
  delete panel.dataset.result;
  panel.dataset.inputMode = inputMode;
  useTouch.disabled = true;
  api.startBout(kind === 'training');
  game.timeScale = 3;
  status.textContent = `Running ${kind} · ${inputMode} · 3×`;
  panel.open = false;
}
document.getElementById('qaTraining').onclick = () => begin('training');
document.getElementById('qaBout').onclick = () => begin('bout');
document.getElementById('qaLose').onclick = () => begin('loss');
document.getElementById('qaRecovery').onclick = () => begin('recovery');
document.getElementById('qaStop').onclick = () => {
  releaseAll();
  mode = null;
  game.timeScale = 1;
  useTouch.disabled = false;
  api.setPaused(true);
  status.textContent = 'Stopped';
};
function finish() {
  releaseAll(false);
  const orderedSamples = [...samples].sort((a, b) => a - b);
  const summary = {
    test: mode, complete: true, inputMode,
    inputPath: inputMode === 'touch' ? 'DOM PointerEvent → TouchControls → Input → app → Bout' : 'Input → app → Bout',
    syntheticPointerEvents: inputMode === 'touch',
    inputCounts: counts, touch: api.touch?.snapshot(),
    state: bout.snapshot(), phases: [...phases], lessons: [...lessons],
    wallSeconds: (performance.now() - started) / 1000,
    engineErrors: game.errors,
    renderMedianMs: orderedSamples.length ? orderedSamples[Math.floor(orderedSamples.length / 2)] : null,
    viewport: { width: innerWidth, height: innerHeight },
    controls: [...controlSizes.values()],
  };
  panel.dataset.result = JSON.stringify(summary);
  status.textContent = `${mode} · ${inputMode}: ${bout.result ? bout.result.method + ' ' + (bout.result.won ? 'WIN' : 'LOSS') : 'COMPLETE'} · ${game.errors.length} errors`;
  mode = null;
  game.timeScale = 1;
  useTouch.disabled = false;
}
const originalUpdate = game.scene.update;
game.scene.update = dt => {
  for (const [action, token] of [...pending]) {
    token.time -= dt;
    if (token.time <= 0) releaseAction(action);
  }
  if (mode) {
    phases.add(bout.phase);
    if (bout.training) lessons.add(bout.lesson);
    if (bout.mode === 'playerDown' && bout.playerDowns < 3 && mode !== 'loss') {
      pressAction('recover', true);
    } else {
      releaseAction('recover');
    }
    if (bout.mode === 'fight' && mode !== 'loss' && mode !== 'recovery' && !bout.lessonPassed) {
      const enemy = bout.enemy;
      if (enemy.state === 'telegraph' && enemy !== move && enemy.duration - enemy.time < .095) {
        const defense = enemy.move.defense === 'either' ? 'left' : enemy.move.defense;
        if (pressAction(defense)) move = enemy;
      }
      const opening = (enemy.state === 'recover' && enemy.opening) || enemy.state === 'stagger';
      if (opening && enemy.duration - enemy.time > .22 && !bout.punch && !bout.playerAction && bout.punchCooldown <= 0) {
        if (!(bout.training && (bout.lesson === 0 || bout.lesson === 2))) {
          const target = enemy.state === 'stagger' ? 'head' : enemy.openTarget;
          const action = bout.focus >= 100 ? 'special' : `${bout.stats.thrown % 2 ? 'right' : 'left'}${target === 'body' ? 'Body' : 'Head'}`;
          pressAction(action);
        }
      }
    }
    if (bout.mode === 'result' || bout.mode === 'trainingDone') finish();
  }
  originalUpdate(dt);
};
const originalDraw = game.scene.draw;
game.scene.draw = renderer => {
  originalDraw(renderer);
  if (!mode) return;
  samples.push(game.stats.renderMs);
  const view = `${innerWidth}x${innerHeight}:${bout.mode}:${game.paused}`;
  if (view !== lastControlView) {
    lastControlView = view;
    measureControls();
  }
  if (game.paused !== pausedLastFrame) {
    pausedLastFrame = game.paused;
    if (game.paused) {
      releaseAll();
      status.textContent = `Paused · ${inputMode} · Use Resume in the game`;
    } else {
      status.textContent = `Running ${mode} · ${inputMode} · 3×`;
    }
  }
};
