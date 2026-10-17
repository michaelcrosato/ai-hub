import { LOOK_PRESETS } from './pixel-engine.js';

const $ = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Number(n) || 0));
const money = n => '$' + Math.round(Number(n) || 0).toLocaleString('en-US');
const GLYPHS = { Enter: '✕', Space: '✕', Escape: '○', KeyR: '□', KeyF: '△', KeyV: 'L1', ShiftLeft: 'R1', KeyC: 'L2', KeyJ: 'R2', KeyM: 'VIEW', KeyW: 'R2', KeyS: 'L2' };
const KEYS = { Enter: 'ENTER', Space: 'SPACE', Escape: 'ESC', KeyR: 'R', KeyF: 'F', KeyV: 'V', ShiftLeft: 'SHIFT', KeyC: 'C', KeyJ: 'J', KeyM: 'M', KeyW: 'W', KeyS: 'S' };
const CHAPTERS = ['Borrowed Ignition', 'Terms of Service', 'Moving Assets', 'Public Record'];
const copy = {
  title: ['PORT SABLE / A CRIME STORY', 'SIGNAL\nDEBT', 'The city sold your future. Take back the receipt.'],
  pause: ['THE BREAKWATER', 'Take a breath.', 'Your next move is still yours.'],
  options: ['MAKE YOURSELF AT HOME', 'Options', 'Picture, sound & feel'],
  help: ['FIELD NOTES', 'Know the streets.', 'Every road is an option.'],
  map: ['PORT SABLE / DISTRICT 04', 'The Breakwater', 'Find a way through.'],
  brief: ['THE NEXT JOB', 'A little unfinished business.', ''],
  debrief: ['JOB COMPLETE', 'Debt paid.', 'One step closer to the truth.'],
  failure: ['THE PLAN CHANGED', 'Another way through.', 'Your last checkpoint is ready.'],
  replay: ['THE BREAKWATER TAPES', 'Run it back.', 'Choose a job to revisit.'],
  ending: ['TRANSMISSION COMPLETE', 'The city is listening.', 'Some debts belong in public.'],
};

export class GameUI {
  constructor(ctx, { onAction = () => {}, prepareAction = (action, value) => value } = {}) {
    this.ctx = ctx; this.onAction = onAction; this.prepareAction = prepareAction; this.screen = null; this.forceTouch = new URLSearchParams(location.search).has('touch'); this.mode = this.forceTouch || navigator.maxTouchPoints > 0 ? 'touch' : 'keyboard';
    this.preferences = { rumble: true, motion: true, steering: 1 };
    try { const saved = JSON.parse(localStorage.getItem('signal-debt-preferences')); if (saved) { this.preferences.rumble = saved.rumble !== false; this.preferences.motion = saved.motion !== false; this.preferences.steering = clamp(saved.steering ?? 1, 0.5, 1.5); } } catch {}
    this.root = $('div', 'sd-ui'); this.root.dataset.mode = this.mode; this.root.dataset.touch = String(this.forceTouch || this.mode === 'touch'); this.root.dataset.motion = String(this.preferences.motion); document.body.append(this.root);
    this.listeners = []; this.controls = []; this.selected = 0; this.previous = {}; this.held = {}; this.padSignature = ''; this.clock = 0; this.state = {}; this.menuKeyQueue = []; this.commandFrame = null; this.touchHeld = new Set();
    this.hud = $('section', 'sd-hud'); this.hud.setAttribute('aria-label', 'Game status');
    this.hud.innerHTML = `<div class="sd-objective"><div class="sd-eyebrow sd-chapter"></div><h2></h2><p class="sd-objective-text"></p><p class="sd-objective-detail"></p><div class="sd-progress-track"><i></i></div></div><div class="sd-status"><div class="sd-heat" aria-label="Security attention"></div><div class="sd-heat-state"></div><div class="sd-wallet"></div></div><div class="sd-radar"><div class="sd-map-caption"><span class="sd-location"></span><span>N ↑</span></div><canvas width="260" height="180" aria-label="Street map, player and destination"></canvas><div class="sd-health"><span>REN</span><i><b></b></i><strong></strong></div></div><div class="sd-equipment"><div class="sd-speed"></div><div class="sd-ammo"></div><div class="sd-vehicle-health"></div></div><div class="sd-subtitle" role="status"><strong></strong><span></span></div><div class="sd-prompt"></div><div class="sd-toast" role="status"></div><div class="sd-scan">SIGNAL SCAN / ACTIVE</div>`;
    this.root.append(this.hud); this.minimap = this.hud.querySelector('canvas');
    this.subtitleObserver = new ResizeObserver(entries => { const entry = entries[0], height = entry.borderBoxSize?.[0]?.blockSize ?? entry.target.getBoundingClientRect().height; this.root.style.setProperty('--sd-subtitle-height', `${height}px`); });
    this.subtitleObserver.observe(this.hud.querySelector('.sd-subtitle'));
    this.overlay = $('section', 'sd-overlay'); this.overlay.hidden = true; this.overlay.setAttribute('aria-modal', 'true'); this.overlay.setAttribute('role', 'dialog'); this.root.append(this.overlay);
    this.touch = $('div', 'sd-touch'); this.root.append(this.touch); this.createTouch();
    this.notice = $('div', 'sd-notice'); this.notice.setAttribute('role', 'status'); this.root.append(this.notice);
    this.listen(window, 'keydown', e => {
      this.setMode('keyboard');
      if (this.screen && !e.repeat) this.menuKeyQueue.push(e.code);
      if (this.screen && ['Enter', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Escape'].includes(e.code)) e.preventDefault();
      if (this.screen && e.code === 'Enter' && !e.repeat && this.controls[this.selected]?.action === 'fullscreen') { this.fullscreen(); this.suppressConfirm = this.clock + 0.2; }
    });
    this.listen(window, 'pointerdown', e => { this.setMode(e.pointerType === 'touch' || e.target.closest?.('.sd-touch') ? 'touch' : 'keyboard'); }, { passive: true });
    this.listen(window, 'blur', () => this.releaseTouch());
    this.listen(document, 'visibilitychange', () => { if (document.hidden) this.releaseTouch(); });
    this.listen(window, 'resize', () => this.drawMap(this.mapCanvas, true));
    this.ctx.input?.preventKeys?.add('Tab');
    this.renderHUD({});
  }

  listen(target, type, fn, options) { target.addEventListener(type, fn, options); this.listeners.push(() => target.removeEventListener(type, fn, options)); }
  bindActivation(button, activate) {
    let lastTouch = -Infinity;
    button.addEventListener('pointerup', event => {
      if (event.pointerType !== 'touch') return;
      const rect = button.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
      lastTouch = event.timeStamp; activate();
    });
    button.addEventListener('click', event => {
      if (event.pointerType === 'touch' || (event.detail !== 0 && event.timeStamp - lastTouch < 800)) return;
      activate();
    });
  }
  setMode(mode) { if (mode === this.mode) return; this.mode = mode; this.root.dataset.mode = mode; this.root.dataset.touch = String(this.forceTouch || mode === 'touch'); this.refreshGlyphs(); }
  key(code) { return this.mode === 'gamepad' ? GLYPHS[code] || code.replace('Key', '') : KEYS[code] || code.replace('Key', ''); }
  glyph(code) { const k = $('kbd', 'sd-key', this.key(code)); k.dataset.key = code; return k; }
  refreshGlyphs() { for (const k of this.root.querySelectorAll('[data-key]')) k.textContent = this.key(k.dataset.key); for (const label of this.root.querySelectorAll('.sd-help-table [data-keyboard]')) label.textContent = this.mode === 'gamepad' ? label.dataset.controller : label.dataset.keyboard; }
  emit(action, value) { this.ctx.audio?.unlock?.(); this.ctx.input?.clearQueued?.('Enter', 'Space', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'); if (this.ctx.input.playing) return; this.ctx.input.send({ type: 'ui-action', action, value: this.prepareAction(action, value) }); }

  show(screen, props = {}) {
    if (!copy[screen]) screen = 'pause';
    if (['options', 'help', 'map', 'replay'].includes(screen)) {
      if (!this.screen) delete this.previous[screen];
      else if (!['options', 'help', 'map', 'replay'].includes(this.screen)) this.previous[screen] = { screen: this.screen, props: this.props };
    }
    this.screen = screen; this.menuKeyQueue = []; this.props = props; this.confirmNew = false; this.selected = 0; this.controls = []; this.releaseTouch(); this.overlay.hidden = false; this.root.dataset.screen = screen; this.overlay.replaceChildren(); this.mapCanvas = null;
    const [eyebrow, title, subtitle] = copy[screen];
    const panel = $('div', `sd-panel sd-panel-${screen}`); this.panel = panel;
    const top = $('div', 'sd-menu-top'); top.append($('span', 'sd-brand', 'SD / 04'), $('span', 'sd-frequency', '88.4 FM · PORT SABLE')); panel.append(top);
    const header = $('header', 'sd-menu-header'); header.append($('div', 'sd-eyebrow', props.chapter || eyebrow));
    const h = $('h1', '', props.title || title); h.id = 'sd-menu-title'; header.append(h); this.overlay.setAttribute('aria-labelledby', h.id);
    header.append($('p', 'sd-menu-subtitle', props.subtitle ?? subtitle)); panel.append(header);
    const content = $('div', 'sd-menu-content'); panel.append(content); this.content = content;
    if (props.replay && ['brief', 'debrief', 'ending'].includes(screen)) content.append($('p', 'sd-replay-note', 'Replay · campaign checkpoint is preserved'));
    if (props.body) { const body = $('div', 'sd-body'); const lines = Array.isArray(props.body) ? props.body : String(props.body).split('\n'); for (const line of lines) body.append($('p', '', line)); content.append(body); }
    const buttons = $('nav', 'sd-menu-actions'); buttons.setAttribute('aria-label', screen + ' menu'); this.buttons = buttons;
    if (screen === 'title') {
      content.append($('p', 'sd-title-description', 'A wheelman. A stolen ledger.\nOne last night on the waterfront.'));
      if (props.canContinue || props.continue) this.button('Continue the story', 'continue');
      this.button((props.canContinue || props.continue) ? 'Start a new story' : 'Take the wheel', 'new');
      this.button('Options', 'options'); this.button('How to play', 'help'); this.button('Fullscreen', 'fullscreen');
      const stamp = $('div', 'sd-title-stamp'); stamp.innerHTML = '<span>FOUR JOBS</span><b>ONE DISTRICT.<br>NO CLEAN EXIT.</b><span>THE BREAKWATER TAPES</span>'; panel.append(stamp);
    } else if (screen === 'pause') {
      this.button('Back to the streets', 'resume'); this.button('District map', 'map'); this.button('How to play', 'help'); this.button('Options', 'options');
      this.button('Repair vehicle · $150', 'repair');
      this.button('Upgrade Cormorant · $600', 'upgrade');
      this.button('Courier run', 'courier');
      this.button('Replay a job', 'replay');
      this.button('Restart checkpoint', 'retry'); this.button('Return to title', 'quit');
    } else if (screen === 'options') this.buildOptions();
    else if (screen === 'help') { this.buildHelp(); this.button('Back', 'back'); }
    else if (screen === 'map') {
      const wrap = $('div', 'sd-full-map'); this.mapCanvas = $('canvas'); this.mapCanvas.width = 900; this.mapCanvas.height = 570; this.mapCanvas.setAttribute('aria-label', 'Breakwater district map'); wrap.append(this.mapCanvas); content.append(wrap);
      const legend = $('div', 'sd-map-legend'); legend.innerHTML = '<span><i class="player"></i>You</span><span><i class="target"></i>Destination</span><span><i class="enemy"></i>Security</span>'; content.append(legend); this.button('Back to the streets', 'back');
    } else if (screen === 'brief') {
      if (Number.isFinite(props.missionIndex)) content.append($('p', 'sd-mission-number', `JOB ${String(props.missionIndex + 1).padStart(2, '0')} / 04`));
      for (const choice of props.choices || []) this.button(choice.label, 'approach', choice.value, choice.description);
      this.button(props.choices?.length ? 'Begin with this approach' : 'Let’s do it', 'begin');
    } else if (screen === 'debrief') {
      if (props.reward !== undefined) { const reward = $('div', 'sd-reward'); reward.append($('span', 'sd-eyebrow', 'YOUR CUT'), $('strong', '', money(props.reward))); content.append(reward); }
      this.buildStats(props.stats); this.button(props.replay ? 'Return to story' : 'The next move', 'next'); if (!props.replay) this.button('Explore the district', 'resume');
    } else if (screen === 'replay') {
      CHAPTERS.forEach((name, i) => this.button(`${i + 1} · ${name}`, 'replay', i)); this.button('Back', 'back');
    } else if (screen === 'failure') { this.button('Retry checkpoint', 'retry'); this.button('Return to title', 'quit'); }
    else if (screen === 'ending') {
      this.buildStats(props.stats); this.button(props.replay ? 'Return to story' : 'Keep driving', 'resume');
      CHAPTERS.forEach((name, i) => this.button(`Replay ${i + 1} · ${name}`, 'replay', i)); this.button('Return to title', 'quit');
    }
    content.append(buttons);
    const footer = $('footer', 'sd-menu-footer'); const hints = $('span', 'sd-menu-hints'); hints.append(this.glyph('Enter'), document.createTextNode(' SELECT'), this.glyph('Escape'), document.createTextNode(' BACK')); footer.append(hints, $('span', 'sd-save-note', 'SAFE CHECKPOINTS SAVE AUTOMATICALLY')); panel.append(footer);
    this.overlay.append(panel); this.overlay.scrollTop = 0; this.select(0, false); this.refreshGlyphs(); this.drawMap(this.mapCanvas, true);
    // Require a release before a held gameplay button can activate a newly opened menu.
    this.primeHeld();
  }

  button(label, action, value, description, parent = this.buttons) {
    const button = $('button', 'sd-menu-button'); button.type = 'button'; button.dataset.action = action;
    const num = $('span', 'sd-action-index', String(this.controls.length + 1).padStart(2, '0')); const labelWrap = $('span', 'sd-action-label', label); button.append(num, labelWrap);
    if (description) labelWrap.append($('small', '', description)); button.append($('span', 'sd-action-arrow', '↗'));
    const control = { element: button, action, value }; const index = this.controls.length; this.controls.push(control); parent.append(button);
    button.addEventListener('pointerenter', () => this.select(index, false)); button.addEventListener('focus', () => { if (this.selected !== index) this.select(index, false); });
    this.bindActivation(button, () => { this.select(index, false); this.activate(control); }); return control;
  }

  buildStats(stats) {
    if (!stats) return; const block = $('dl', 'sd-stats');
    for (const [label, value] of Object.entries(stats)) {
      let display = String(value);
      if (typeof value === 'number' && Number.isFinite(value)) {
        if (/time|duration|elapsed/i.test(label)) { const seconds = Math.floor(Math.max(0, value)); display = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }
        else if (/cash|money|reward|earnings/i.test(label)) display = money(value);
        else display = value.toLocaleString('en-US', { maximumFractionDigits: 1 });
      }
      const item = $('div'); item.append($('dt', '', label.replace(/([A-Z])/g, ' $1')), $('dd', '', display)); block.append(item);
    } this.content.append(block);
  }

  buildHelp() {
    const rows = [
      ['Move / steer', 'WASD / arrows', 'Left stick'], ['Sprint', 'SHIFT', 'R1'], ['Interact / enter or exit vehicle', 'F', '△'], ['Fire weapon', 'J / left mouse', 'R2'], ['Aim weapon', 'C', 'L2'], ['Accelerate / brake / reverse', 'W / S', 'R2 / L2'], ['Reload', 'R', '□'], ['Recover vehicle (hold)', 'R · 1.6 SEC', '□ · 1.6 SEC'], ['Dodge / handbrake', 'SPACE', '✕'], ['Signal scan', 'V', 'L1'], ['District map', 'M', 'VIEW'], ['Pause / back', 'ESC', '○ / OPTIONS'],
    ];
    const table = $('div', 'sd-help-table'); for (const [action, keyboard, controller] of rows) { const row = $('div'), label = $('b', '', this.mode === 'gamepad' ? controller : keyboard); label.dataset.keyboard = keyboard; label.dataset.controller = controller; row.append($('span', '', action), label); table.append(row); } this.content.append(table);
    const tips = $('div', 'sd-help-notes'); tips.append($('p', '', 'Follow the orange marker. Hold aim to steady your shot; nearby threats are assisted. Solid buildings break security sightlines. Hide off the road until the search clears.'), $('p', '', 'Touch: drag the left stick to move or steer, then hold an action on the right. In a vehicle, use the separate throttle and brake pedals. Your last checkpoint preserves each completed stage.')); this.content.append(tips);
  }

  buildOptions() {
    const engine = this.ctx.engine; const audio = this.ctx.audio || engine?.audio; const values = engine?.settings?.values || {};
    const list = $('div', 'sd-options'); this.content.append(list);
    const option = (label, get, choices, set, formatter = v => String(v), group = '') => {
      if (group) list.append($('h2', 'sd-option-group', group));
      const control = this.button(label, 'setting', undefined, undefined, list); control.element.classList.add('sd-option');
      const display = $('span', 'sd-option-value'); control.element.querySelector('.sd-action-arrow').replaceWith(display);
      const current = () => { const v = get(); const idx = choices.findIndex(c => c === v); return idx < 0 ? 0 : idx; };
      const refresh = () => display.textContent = `‹  ${formatter(choices[current()])}  ›`;
      control.adjust = direction => { const i = (current() + direction + choices.length) % choices.length; set(choices[i]); refresh(); }; refresh();
    };
    const setting = (key, fallback) => () => this.ctx.engine?.settings?.values?.[key] ?? fallback;
    const set = key => value => engine?.settings?.set?.({ [key]: value });
    const looks = Object.keys(LOOK_PRESETS); const lookNames = v => v === 'none' ? 'Original' : v === 'no_filters' ? 'Clean' : v.replaceAll('_', ' ');
    option('Scene look', setting('look', 'none'), looks.length ? looks : ['none', 'no_filters'], set('look'), lookNames, 'PICTURE');
    option('Pixel rendering', setting('pixelArt', true), [true, false], set('pixelArt'), v => v ? 'On' : 'Off');
    option('Pixel size', setting('pixelSize', 'fine'), ['fine', 'chunky'], set('pixelSize'));
    option('Lighting quality', setting('quality', engine?.qualityOption ?? 'auto'), ['auto', 'low', 'medium', 'high'], set('quality'));
    option('Frame rate', setting('fps', engine?.maxFps ?? 60), [60, 30, 0], set('fps'), v => v ? `${v} FPS` : 'Display');
    option('Performance display', setting('debugInfo', engine?.debugShown ?? false), [false, true], set('debugInfo'), v => v ? 'On' : 'Off');
    for (const [i, channel] of ['master', 'sfx', 'music'].entries()) option(channel === 'sfx' ? 'Sound effects' : channel[0].toUpperCase() + channel.slice(1), () => Math.round((audio?.volume?.[channel] ?? 1) * 10) / 10, Array.from({ length: 11 }, (_, n) => n / 10), v => audio?.setVolume?.(channel, v), v => `${Math.round(v * 100)}%`, i === 0 ? 'SOUND' : '');
    const pref = key => value => { this.preferences[key] = value; this.root.dataset.motion = String(this.preferences.motion); try { localStorage.setItem('signal-debt-preferences', JSON.stringify(this.preferences)); } catch {} };
    option('Controller vibration', () => this.preferences.rumble, [true, false], pref('rumble'), v => v ? 'On' : 'Off', 'FEEL');
    option('Reduced motion', () => !this.preferences.motion, [false, true], value => pref('motion')(!value), v => v ? 'On' : 'Off');
    option('Steering sensitivity', () => this.preferences.steering, [0.5, 0.75, 1, 1.25, 1.5], pref('steering'), v => `${v.toFixed(2)}×`);
    this.button('Toggle fullscreen', 'fullscreen'); this.button('Back', 'back');
  }

  select(index, focus = true) {
    if (!this.controls.length) return; this.selected = (index + this.controls.length) % this.controls.length;
    this.controls.forEach((control, i) => { control.element.classList.toggle('is-selected', i === this.selected); control.element.tabIndex = i === this.selected ? 0 : -1; });
    const el = this.controls[this.selected].element;
    if (focus) { el.focus({ preventScroll: true }); el.scrollIntoView({ block: 'nearest', behavior: 'instant' }); }
  }
  activate(control = this.controls[this.selected]) {
    if (!control) return;
    if (control.action === 'setting') { control.adjust(1); return; }
    if (control.action === 'fullscreen') { this.fullscreen(); return; }
    if (control.action === 'replay' && control.value === undefined) { this.emit('replay-menu'); return; }
    if (control.action === 'back') { this.back(); return; }
    if (control.action === 'approach') { this.controls.filter(c => c.action === 'approach').forEach(c => c.element.classList.toggle('is-chosen', c === control)); this.emit('approach', control.value); return; }
    if (control.action === 'new' && (this.props.canContinue || this.props.continue) && !this.confirmNew) {
      this.confirmNew = true; control.element.querySelector('.sd-action-label').textContent = 'Replace saved story? Select again'; return;
    }
    this.confirmNew = false; this.emit(control.action, control.value);
  }
  back() { this.emit('back'); }
  navigateBack() {
    if (['options', 'help', 'map', 'replay'].includes(this.screen)) { const previous = this.previous[this.screen]; if (previous) this.show(previous.screen, previous.props); else this.onAction('resume'); return; }
    if (this.screen === 'title') { this.confirmNew = false; const control = this.controls.find(c => c.action === 'new'); if (control) control.element.querySelector('.sd-action-label').textContent = (this.props.canContinue || this.props.continue) ? 'Start a new story' : 'Take the wheel'; return; }
    if (this.screen === 'brief' || this.screen === 'failure') return;
    this.onAction('resume');
  }
  hide() { this.screen = null; this.menuKeyQueue = []; this.overlay.hidden = true; this.root.dataset.screen = ''; this.controls = []; this.mapCanvas = null; this.confirmNew = false; this.ctx.input?.clearQueued?.('Enter', 'Space', 'Escape'); if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); }

  pads() { try { return Array.from(navigator.getGamepads?.() || []).filter(pad => pad && pad.connected !== false); } catch { return []; } }
  menuState(pads = this.pads()) {
    const input = this.ctx.input; const down = (...keys) => input?.isDown?.(...keys) || false;
    const b = index => pads.some(p => p.buttons[index]?.pressed || p.buttons[index]?.value > 0.5);
    return {
      up: down('ArrowUp', 'KeyW') || b(12) || pads.some(p => (p.axes[1] || 0) < -0.55),
      down: down('ArrowDown', 'KeyS') || b(13) || pads.some(p => (p.axes[1] || 0) > 0.55),
      left: down('ArrowLeft', 'KeyA') || b(14) || pads.some(p => (p.axes[0] || 0) < -0.55),
      right: down('ArrowRight', 'KeyD') || b(15) || pads.some(p => (p.axes[0] || 0) > 0.55),
      confirm: down('Enter', 'Space') || b(0), back: down('Escape') || b(1) || b(9),
    };
  }
  primeHeld() { const state = this.menuState(); for (const [k, v] of Object.entries(state)) this.held[k] = v ? { next: this.clock + 0.4 } : null; }
  update(dt = 1 / 60) {
    this.clock += Math.min(0.1, Math.max(0, dt)); const pads = this.pads();
    const activePad = pads.find(p => p.buttons.some(b => b.pressed || b.value > 0.2) || p.axes.some(a => Math.abs(a) > 0.25));
    if (activePad) this.setMode('gamepad');
    if (this.noticeUntil && this.clock > this.noticeUntil) { this.notice.textContent = ''; this.noticeUntil = 0; }
    // Input commands are the sole boundary for game actions from DOM, touch and menus.
    // The engine may call tooling updates more than once; consume each render frame once.
    const frame = this.ctx.engine?.frame ?? this.ctx.input?.now ?? this.clock;
    if (this.commandFrame !== frame) {
      this.commandFrame = frame;
      for (const command of this.ctx.input.commands || []) {
        if (command?.type !== 'ui-action' || typeof command.action !== 'string') continue;
        if (command.action === 'back') this.navigateBack();
        else if (command.action === 'replay-menu') this.show('replay');
        else { if (['repair', 'upgrade', 'courier'].includes(command.action)) this.expectMenuFeedback = true; this.onAction(command.action, command.value); }
      }
    }
    if (!this.screen) return;
    const state = this.menuState(pads); const edges = [];
    const codes = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Enter: 'confirm', Space: 'confirm', Escape: 'back' };
    const queued = this.menuKeyQueue.splice(0).map(code => codes[code]).filter(Boolean);
    for (const [key, pressed] of Object.entries(state)) {
      if (!pressed) { this.held[key] = null; continue; }
      if (!this.held[key]) { this.held[key] = { next: this.clock + 0.38 }; edges.push(key); }
      else if (!['confirm', 'back'].includes(key) && this.clock >= this.held[key].next) { this.held[key].next = this.clock + 0.13; edges.push(key); }
    }
    for (const key of queued) if (!edges.includes(key)) edges.push(key);
    for (const key of edges) {
      if (key === 'up') this.select(this.selected - 1);
      else if (key === 'down') this.select(this.selected + 1);
      else if (key === 'left' || key === 'right') this.controls[this.selected]?.adjust?.(key === 'left' ? -1 : 1);
      else if (key === 'confirm' && this.clock > (this.suppressConfirm || 0)) { this.activate(); break; }
      else if (key === 'back') { this.back(); break; }
    }
    if (edges.length) this.ctx.input?.clearQueued?.('Enter', 'Space', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyS', 'KeyA', 'KeyD');
    if (this.screen === 'map') this.drawMap(this.mapCanvas, true);
  }

  renderHUD(state = {}) {
    this.state = state; this.lastState = state; const q = selector => this.hud.querySelector(selector); const text = (selector, value) => { const el = q(selector); const s = String(value ?? ''); if (el.textContent !== s) el.textContent = s; };
    const mission = state.mission || {}; text('.sd-chapter', (typeof mission.chapter === 'number' ? `JOB ${String(mission.chapter).padStart(2, '0')} / 04` : mission.chapter) || (mission.title ? 'ACTIVE JOB' : 'THE BREAKWATER')); text('.sd-objective h2', mission.title || 'The city is yours.'); text('.sd-objective-text', mission.objective || 'Explore the waterfront'); text('.sd-objective-detail', mission.detail || '');
    const progress = typeof mission.progress === 'number' ? clamp(mission.progress > 1 ? mission.progress / 100 : mission.progress, 0, 1) : 0; q('.sd-progress-track').hidden = !progress; q('.sd-progress-track i').style.width = `${progress * 100}%`;
    const heat = clamp(Math.ceil(state.heat || 0), 0, 3); const heatEl = q('.sd-heat'); const heatValue = '▰'.repeat(heat) + '▱'.repeat(3 - heat); if (heatEl.textContent !== heatValue) heatEl.textContent = heatValue; heatEl.dataset.level = heat;
    text('.sd-heat-state', heat ? state.heatState || 'SECURITY ALERT' : 'OFF THE RADAR'); text('.sd-wallet', money(state.cash)); text('.sd-location', state.location || 'BREAKWATER');
    const health = clamp(state.health ?? 100, 0, 100); q('.sd-health b').style.width = `${health}%`; q('.sd-health').classList.toggle('is-low', health < 30); text('.sd-health strong', `${Math.ceil(health)}`);
    text('.sd-speed', state.inVehicle ? `${Math.round(Math.abs(state.speed || 0))} KM/H` : ''); text('.sd-ammo', state.inVehicle ? 'BEHIND THE WHEEL' : `${state.ammo ?? 12} / ${state.reserve ?? 72}`); text('.sd-vehicle-health', state.inVehicle ? `BODY ${Math.ceil(clamp(state.vehicleHealth ?? 100, 0, 100))}%` : '');
    const sub = typeof state.subtitle === 'string' ? { text: state.subtitle } : state.subtitle || {}; text('.sd-subtitle strong', sub.speaker || ''); text('.sd-subtitle span', sub.text || ''); q('.sd-subtitle').hidden = !sub.text;
    const prompt = state.prompt; const signature = prompt ? `${prompt.text}|${prompt.key}|${this.mode}` : ''; if (signature !== this.promptSignature) { this.promptSignature = signature; const el = q('.sd-prompt'); el.replaceChildren(); if (prompt) el.append(this.glyph(prompt.key || 'KeyF'), $('span', '', prompt.text)); el.hidden = !prompt; }
    const toast = typeof state.toast === 'object' ? state.toast?.text : state.toast; text('.sd-toast', toast || ''); q('.sd-toast').hidden = !toast; if (this.screen && this.expectMenuFeedback && toast) { this.notify(toast); this.expectMenuFeedback = false; } q('.sd-scan').hidden = !state.scan;
    this.touch.dataset.vehicle = state.inVehicle ? 'true' : 'false'; this.drawMap(this.minimap, false);
  }

  drawMap(canvas, full = false) {
    if (!canvas) return; const c = canvas.getContext('2d'); if (!c) return; const { world = {}, position = { x: 0, z: 0 }, target, enemies = [] } = this.state || {};
    const w = canvas.width, h = canvas.height; c.clearRect(0, 0, w, h); c.fillStyle = '#172d31'; c.fillRect(0, 0, w, h);
    const roads = world.roads || {}; const xs = roads.xs || [-80, -40, 0, 40, 80]; const zs = roads.zs || [-80, -40, 0, 40, 80];
    const bound = Number(world.bounds) || Math.max(105, ...xs.map(Math.abs), ...zs.map(Math.abs)) + 22; const scale = full ? Math.min(w, h) / (bound * 2) : 1.9;
    const cx = full ? 0 : position.x || 0, cz = full ? 0 : position.z || 0; const tx = x => w / 2 + (x - cx) * scale, tz = z => h / 2 + (z - cz) * scale;
    c.fillStyle = '#e1d2b6'; c.fillRect(tx(-bound), tz(-bound), bound * 2 * scale, bound * 2 * scale);
    c.strokeStyle = '#a9977d'; c.lineWidth = Math.max(4, (roads.width || 10) * scale);
    for (const x of xs) { c.beginPath(); c.moveTo(tx(x), tz(-bound)); c.lineTo(tx(x), tz(bound)); c.stroke(); }
    for (const z of zs) { c.beginPath(); c.moveTo(tx(-bound), tz(z)); c.lineTo(tx(bound), tz(z)); c.stroke(); }
    c.fillStyle = '#506058'; for (const b of world.buildings || []) c.fillRect(tx(b.x - b.w / 2), tz(b.z - b.d / 2), b.w * scale, b.d * scale);
    if (target && Number.isFinite(target.x) && Number.isFinite(target.z)) {
      const x = clamp(tx(target.x), 9, w - 9), y = clamp(tz(target.z), 9, h - 9);
      c.strokeStyle = '#e66536'; c.lineWidth = full ? 3 : 2; c.setLineDash([5, 5]); c.beginPath(); c.moveTo(tx(position.x || 0), tz(position.z || 0)); c.lineTo(x, y); c.stroke(); c.setLineDash([]);
      c.fillStyle = '#e65527'; c.save(); c.translate(x, y); c.rotate(Math.PI / 4); c.fillRect(-5, -5, 10, 10); c.restore();
    }
    c.fillStyle = '#c43d36'; for (const e of enemies) { c.beginPath(); c.arc(tx(e.x), tz(e.z), full ? 4 : 3, 0, Math.PI * 2); c.fill(); }
    c.save(); c.translate(tx(position.x || 0), tz(position.z || 0)); c.rotate(Math.PI - (position.yaw || 0)); c.fillStyle = '#fff9e7'; c.strokeStyle = '#172d31'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -8); c.lineTo(6, 6); c.lineTo(0, 3); c.lineTo(-6, 6); c.closePath(); c.fill(); c.stroke(); c.restore();
    if (full) { c.fillStyle = '#233535'; c.font = 'bold 18px sans-serif'; c.textAlign = 'center'; const landmarks = Array.isArray(world.landmarks) ? world.landmarks : Object.entries(world.landmarks || {}).map(([name, l]) => ({ name, ...l })); for (const l of landmarks) if (Number.isFinite(l.x) && Number.isFinite(l.z)) { const label = (l.name || l.label || '').toUpperCase(); const half = c.measureText(label).width / 2; c.fillText(label, clamp(tx(l.x), tx(-bound) + half + 5, tx(bound) - half - 5), tz(l.z) - 12); } }
  }

  createTouch() {
    const top = $('div', 'sd-touch-top');
    for (const [label, action] of [['Ⅱ', 'pause'], ['MAP', 'map']]) { const b = $('button', '', label); b.type = 'button'; b.setAttribute('aria-label', action === 'pause' ? 'Pause game' : 'Open district map'); this.bindActivation(b, () => { this.setMode('touch'); this.emit(action === 'pause' ? 'pause' : 'map'); }); top.append(b); } this.touch.append(top);
    const stick = $('div', 'sd-touch-stick'); stick.setAttribute('role', 'group'); stick.setAttribute('aria-label', 'Movement joystick'); const knob = $('i'); stick.append(knob, $('span', '', 'MOVE')); this.touch.append(stick); this.stick = stick; this.knob = knob;
    let pointer = null;
    const move = e => { if (e.pointerId !== pointer || this.screen) return; const r = stick.getBoundingClientRect(); const radius = r.width * 0.34; let x = (e.clientX - r.left - r.width / 2) / radius, y = (r.top + r.height / 2 - e.clientY) / radius; const length = Math.hypot(x, y); if (length > 1) { x /= length; y /= length; } Object.assign(this.ctx.input.analog, { x, y }); knob.style.transform = `translate(${x * radius}px, ${-y * radius}px)`; };
    stick.addEventListener('pointerdown', e => { if (this.screen) return; pointer = e.pointerId; stick.setPointerCapture(pointer); this.setMode('touch'); e.preventDefault(); move(e); });
    stick.addEventListener('pointermove', move); const end = e => { if (e.pointerId !== pointer) return; pointer = null; Object.assign(this.ctx.input.analog, { x: 0, y: 0 }); knob.style.transform = ''; }; stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end); stick.addEventListener('lostpointercapture', end);
    const pad = $('div', 'sd-touch-actions'); this.touch.append(pad);
    for (const [label, code, type] of [['SCAN', 'KeyV', 'both'], ['RUN', 'ShiftLeft', 'foot'], ['DODGE', 'Space', 'foot'], ['RELOAD', 'KeyR', 'foot'], ['AIM', 'KeyC', 'foot'], ['FIRE', 'KeyJ', 'foot'], ['BRAKE', 'KeyS', 'drive'], ['GAS', 'KeyW', 'drive'], ['DRIFT', 'Space', 'drive'], ['RECOVER', 'KeyR', 'drive'], ['INTERACT', 'KeyF', 'both']]) {
      const button = $('button', `sd-touch-action sd-touch-${type}`, label); button.type = 'button'; button.dataset.code = code; button.setAttribute('aria-label', label.toLowerCase()); let id = null;
      button.addEventListener('pointerdown', e => { if (this.screen) return; e.preventDefault(); id = e.pointerId; button.setPointerCapture(id); this.setMode('touch'); this.touchHeld.add(code); this.ctx.input.setKey(code, true); button.classList.add('is-held'); });
      const release = e => { if (e.pointerId !== id) return; id = null; this.touchHeld.delete(code); this.ctx.input.setKey(code, false); button.classList.remove('is-held'); }; button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release); pad.append(button);
    }
  }
  releaseTouch() { for (const key of this.touchHeld) this.ctx.input?.setKey?.(key, false); this.touchHeld.clear(); if (this.ctx.input?.analog) Object.assign(this.ctx.input.analog, { x: 0, y: 0 }); if (this.knob) this.knob.style.transform = ''; for (const b of this.touch?.querySelectorAll('.is-held') || []) b.classList.remove('is-held'); }
  async fullscreen() {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); else throw Error('unavailable'); }
    catch {
      let automaticAllowed = false;
      try { automaticAllowed = (await navigator.permissions?.query({ name: 'fullscreen', allowWithoutGesture: true }))?.state === 'granted'; } catch {}
      this.notify(automaticAllowed ? 'Chrome briefly limits repeat fullscreen requests. Try again in five seconds.' : 'Fullscreen needs a click or key press on this browser.');
    }
  }
  notify(message) { this.notice.textContent = message; this.noticeUntil = this.clock + 5; }
  rumble(amount = 0.4, duration = 150) { if (!this.preferences.rumble) return; for (const pad of this.pads()) try { pad.vibrationActuator?.playEffect?.('dual-rumble', { duration, strongMagnitude: clamp(amount, 0, 1), weakMagnitude: clamp(amount * 0.65, 0, 1), startDelay: 0 })?.catch?.(() => {}); } catch {} }
  dispose() { this.subtitleObserver?.disconnect(); this.releaseTouch(); this.listeners.forEach(fn => fn()); this.root.remove(); }
}
