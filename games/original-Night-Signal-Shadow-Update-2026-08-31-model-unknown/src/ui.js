import { DEFAULT_BINDINGS, DIFFICULTIES, PAD_LABEL, TOUCH_LABEL, bindable, difficultyOf, keyLabel, validateSettings } from './config.js';
import { LOGS } from './logs.js';

const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const freshSeed = () => `NIGHT-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase()}`;
export const clock = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const labels = {
  forward: 'Move forward', back: 'Move back', left: 'Move left', right: 'Move right', interact: 'Use / open / hide',
  sprint: 'Run (hold)', crouch: 'Crouch (toggle)', flashlight: 'Flashlight', throw: 'Throw bottle', crank: 'Charge light (hold)',
  breath: 'Hold breath', journal: 'Map and notes', hints: 'Show / hide control hints',
};
const FOCUSABLE = 'button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]';
const SLIDER_FORMAT = {
  fov: (v) => `${Math.round(v)}°`,
  brightness: (v) => `${Math.round(v * 100)}%`,
  beamAngle: (v) => `${Math.round(v)}°`,
  volume: (v) => `${Math.round(v * 100)}%`,
};

export class UI {
  /**
   * @param {object} settings  the game's settings
   * @param {object} handlers  newGame, continueGame, resume, saveMenu, restart, settings, kitMenu
   * @param {object} opts      { backend: label for the renderer, isKitMenuOpen: () => bool }
   */
  constructor(settings, handlers, opts = {}) {
    this.handlers = handlers;
    this.backend = opts.backend || 'WebGPU';
    this.isKitMenuOpen = opts.isKitMenuOpen || (() => false);
    this.hasSave = false;
    this.records = null;
    this.parentPage = 'main';
    this.pauseReason = 'The city is paused.';
    this.screen = 'main';
    this.captionUntil = 0;
    this.toastUntil = 0;
    this.logUntil = 0;
    this.binding = null;
    this.source = 'keyboard';
    this.settings = settings;
    this.hudCache = new Map();
    this.root = document.createElement('div');
    this.root.id = 'night-signal-ui';
    this.hud = document.createElement('div');
    this.hud.className = 'hud';
    this.hud.hidden = true;
    this.root.append(this.hud);
    this.hud.innerHTML =
      '<div class="hud-top"><div><div class="objective" data-hud="objective"></div><div class="location" data-hud="location"></div></div><div class="hud-info" data-hud="info"></div></div>' +
      '<div class="crosshair"></div><div class="prompt" data-hud="prompt" hidden></div>' +
      `<div class="meters">${['battery', 'stamina', 'noise']
        .map((k) => `<div><div class="meter-label"><span>${k.toUpperCase()}</span><span data-hud="${k}-text"></span></div><div class="meter ${k}"><i data-hud="${k}"></i></div></div>`)
        .join('')}</div>` +
      '<div class="hints" data-hud="hints"></div><div class="hidden-state" data-hud="state"></div>' +
      '<div class="caption" role="status" aria-live="polite" data-hud="caption" hidden></div>' +
      '<div class="toast" role="status" data-hud="toast" hidden></div>' +
      '<div class="log-play" role="status" aria-live="polite" data-hud="log" hidden></div>';
    this.hudEls = {};
    for (const node of this.hud.querySelectorAll('[data-hud]')) this.hudEls[node.dataset.hud] = node;
    this.overlay = document.createElement('div');
    this.overlay.className = 'overlay';
    this.overlay.setAttribute('role', 'dialog');
    this.overlay.setAttribute('aria-modal', 'true');
    this.root.append(this.overlay);
    document.body.append(this.root);
    window.addEventListener('keydown', (e) => this.key(e));
    // A mouse or touch in the menus hides the gamepad focus ring again.
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse' && Math.abs(e.movementX) + Math.abs(e.movementY) > 2) this.root.classList.remove('pad-nav');
    });
    this.apply(settings);
  }

  el(selector) {
    const e = this.root.querySelector(selector);
    if (!e) throw new Error(`UI element not found: ${selector}`);
    return e;
  }
  click(id, fn) {
    this.el(`[data-action="${id}"]`).addEventListener('click', fn);
  }
  paint(screen, html) {
    this.screen = screen;
    this.binding = null;
    this.overlay.hidden = false;
    this.hud.hidden = true;
    this.overlay.innerHTML = html;
    this.overlay.scrollTop = 0;
    this.overlay.dataset.screen = screen;
    this.overlay.setAttribute('aria-label', screen === 'main' ? 'Night Signal main menu' : screen);
    // Focus the main action, never a text field (that would open a phone keyboard).
    queueMicrotask(() => (this.overlay.querySelector('.primary:not(:disabled)') || this.overlay.querySelector('button:not(:disabled)'))?.focus({ preventScroll: true }));
  }

  labelFor(action) {
    if (this.source === 'gamepad') return PAD_LABEL[action] || action;
    if (this.source === 'touch') return TOUCH_LABEL[action] || action;
    if (action === 'pause') return 'P';
    return keyLabel(this.settings.bindings[action] || DEFAULT_BINDINGS[action] || action);
  }

  main(hasSave = this.hasSave, records = this.records) {
    this.hasSave = hasSave;
    this.records = records;
    this.parentPage = 'main';
    const diff = this.settings.difficulty;
    const best = records && records.escapes ? `${records.escapes} ${records.escapes === 1 ? 'escape' : 'escapes'}${records.fastest ? ` · fastest ${clock(records.fastest)}` : ''}` : 'No escapes yet';
    this.paint(
      'main',
      `<main class="main-layout"><section class="intro"><div class="eyebrow">A CITY WITHOUT AN ANSWER / 01</div><h1 class="title"><span>NIGHT</span><span>SIGNAL</span></h1><p class="strap">Find a way out.<br>Leave as little sound as possible.</p><div class="rule"></div><div class="tags"><span class="tag">FIRST PERSON</span><span class="tag">PROCEDURAL CITY</span><span class="tag">SOUND-LED HORROR</span></div></section>` +
        `<section class="panel"><div class="panel-top"><h3>Enter the city</h3><span class="status">${escape(this.backend.toUpperCase())}</span></div>` +
        `<label class="field"><span>City seed</span><div class="row"><input id="city-seed" type="text" maxlength="80" value="${freshSeed()}" aria-label="City seed" autocomplete="off" spellcheck="false"><button data-action="seed" style="flex:0" aria-label="Make a new seed">↻</button></div></label>` +
        `<div class="row two"><label class="field"><span>City size</span><select id="city-size"><option value="3" selected>Small — 3 × 3</option><option value="5">Standard — 5 × 5</option><option value="7">Large — 7 × 7</option></select></label>` +
        `<label class="field"><span>Night</span><select id="difficulty">${Object.entries(DIFFICULTIES)
          .map(([id, d]) => `<option value="${id}" ${id === diff ? 'selected' : ''}>${escape(d.label)}</option>`)
          .join('')}</select></label></div>` +
        `<p class="diff-note muted" data-diff-note>${escape(difficultyOf(diff).note)}</p>` +
        `<div class="stack"><button class="primary wide" data-action="new">Start a new run →</button><button class="wide" data-action="continue" ${hasSave ? '' : 'disabled'}>Continue saved run</button><div class="row"><button data-action="settings">Settings</button><button data-action="controls">Controls</button></div></div>` +
        `<p class="note">Find three fuses. Restore power at the north exit.<br>Listen before you move. Doors can slow a threat.</p><p class="records muted">${escape(best)}</p></section></main>` +
        `<footer class="footer"><span>SHADOW UPDATE / ${escape(this.backend.toUpperCase())}</span><span>NO INSTALL / KEYBOARD, MOUSE, GAMEPAD OR TOUCH / HEADPHONES</span></footer>`
    );
    this.click('seed', () => {
      this.el('#city-seed').value = freshSeed();
    });
    this.el('#difficulty').addEventListener('change', (e) => {
      this.el('[data-diff-note]').textContent = difficultyOf(e.target.value).note;
      this.settings = validateSettings({ ...this.settings, difficulty: e.target.value });
      this.handlers.settings(this.settings);
    });
    this.click('new', () => {
      const seed = this.el('#city-seed').value.trim() || 'NIGHT-001';
      const size = Number(this.el('#city-size').value);
      this.handlers.newGame(seed, size, this.el('#difficulty').value);
    });
    this.click('continue', () => this.handlers.continueGame());
    this.click('settings', () => this.showSettings());
    this.click('controls', () => this.showControls());
  }

  pause(reason = 'The city is paused.', run = null) {
    this.parentPage = 'pause';
    this.pauseReason = reason;
    this.pauseRun = run || this.pauseRun;
    const r = this.pauseRun;
    const ready = reason.startsWith('City ready');
    const summary = r ? `<p class="run-line">${escape(difficultyOf(r.difficulty).label)} · seed ${escape(r.seed)} · ${r.fuses}/3 fuses · ${r.logs}/${r.logTotal} signal logs</p>` : '';
    this.paint(
      'pause',
      `<section class="dialog narrow panel"><div class="eyebrow">NIGHT SIGNAL / SAFE TO PAUSE</div><h2>${ready ? 'City ready' : 'Paused'}</h2><p class="muted">${escape(reason)}</p>${summary}` +
        `<div class="stack"><button class="primary" data-action="resume">Enter the city →</button>` +
        `<p class="muted small">Map and notes: <kbd>${escape(this.labelFor('journal'))}</kbd> in the city.</p>` +
        `<div class="row"><button data-action="settings">Settings</button><button data-action="controls">Controls</button></div>` +
        `<div class="row">${ready ? '' : '<button data-action="restart">Restart this city</button>'}<button data-action="save-menu">Return to menu</button></div></div>` +
        `<p class="note">The game clock and all threats stop in menus. Press P, Esc or Start to pause. Drag to look if the preview blocks mouse lock.</p></section>`
    );
    this.click('resume', () => this.handlers.resume());
    this.click('settings', () => this.showSettings());
    this.click('controls', () => this.showControls());
    this.click('save-menu', () => this.handlers.saveMenu());
    if (!ready) this.click('restart', () => this.handlers.restart());
  }

  loading(text) {
    this.paint('loading', `<section class="dialog narrow panel"><div class="eyebrow">NIGHT SIGNAL</div><h2>Build the city</h2><div class="loading"></div><p class="muted">${escape(text)}</p></section>`);
  }

  error(text) {
    this.paint(
      'error',
      `<section class="dialog narrow panel"><div class="eyebrow">START FAILED</div><h2>The city did not load.</h2><p>${escape(text)}</p><p class="muted">Reload the page. If it keeps failing, try another browser or a smaller city.</p><button class="primary" data-action="back">Return to menu</button></section>`
    );
    this.click('back', () => this.handlers.saveMenu());
  }

  /** The results screen. r: { won, seed, time, difficulty, size, fuses, logs, logTotal, spotted, thrown, best, newBest } */
  end(r) {
    this.parentPage = 'main';
    const diff = difficultyOf(r.difficulty).label;
    const sizeName = { 3: 'Small', 5: 'Standard', 7: 'Large' }[r.size] || '';
    const bestLine = r.won ? (r.newBest ? `<p class="best">New best for ${escape(diff)} / ${sizeName}.</p>` : r.best ? `<p class="muted">Best for ${escape(diff)} / ${sizeName}: ${clock(r.best)}</p>` : '') : '';
    this.paint(
      'end',
      `<section class="dialog narrow panel"><div class="eyebrow">${r.won ? 'EXIT REACHED' : 'SIGNAL LOST'}</div><h2>${r.won ? 'You got out.' : 'It found you.'}</h2>` +
        `<p class="muted">${r.won ? 'Behind you, the alarm still sounds.' : 'A closed door is not a guarantee. Make distance, break sight, then hide.'}</p><div class="rule"></div>` +
        `<dl class="results"><dt>Time</dt><dd>${clock(r.time)}</dd><dt>Night</dt><dd>${escape(diff)} / ${sizeName}</dd><dt>Fuses</dt><dd>${r.fuses} of 3</dd><dt>Signal logs</dt><dd>${r.logs} of ${r.logTotal}</dd><dt>Times seen</dt><dd>${r.spotted}</dd><dt>Bottles thrown</dt><dd>${r.thrown}</dd><dt>Seed</dt><dd>${escape(r.seed)}</dd></dl>${bestLine}` +
        `<div class="stack"><button class="${r.won ? '' : 'primary '}wide" data-action="retry">Try this city again</button><button class="${r.won ? 'primary ' : ''}wide" data-action="back">Return to menu →</button></div></section>`
    );
    this.click('retry', () => this.handlers.restart());
    this.click('back', () => this.handlers.saveMenu());
  }

  back() {
    if (this.parentPage === 'pause') this.pause(this.pauseReason);
    else this.main();
  }

  showSettings() {
    const s = this.settings;
    const slider = (key, label, min, max, step) =>
      `<label class="field"><span class="slider-label">${label}<output data-output="${key}">${SLIDER_FORMAT[key](s[key])}</output></span><input type="range" data-setting="${key}" aria-label="${label}" min="${min}" max="${max}" step="${step}" value="${s[key]}"></label>`;
    const check = (key, label) => `<label class="check"><input type="checkbox" data-setting="${key}" ${s[key] ? 'checked' : ''}><span>${label}</span></label>`;
    this.paint(
      'settings',
      `<section class="dialog panel"><header class="dialog-head"><div><div class="eyebrow">TUNE THE EXPERIENCE</div><h2>Settings</h2><p class="muted">Changes apply at once. The browser saves settings when local storage is available.</p></div><button data-action="back">Back</button></header>` +
        `<div class="settings-grid"><section><h3>Graphics</h3>` +
        `<button class="wide kit-link" data-action="kit">Quality, resolution, look speed and touch layout…</button>` +
        `${slider('fov', 'Field of view', 60, 110, 1)}${slider('brightness', 'Brightness', 0.7, 2, 0.05)}${slider('beamAngle', 'Flashlight beam width', 18, 50, 2)}${check('bloom', 'Bloom on bright surfaces')}` +
        `<p class="note">The player and moving objects cast shadows. The flashlight has a focused beam. Higher quality adds lamp shadows and sharper shadow maps.</p></section>` +
        `<section><h3>Sound</h3>${slider('volume', 'Master volume', 0, 1, 0.01)}<label class="field"><span>Sound range</span><select data-setting="range"><option value="full" ${s.range === 'full' ? 'selected' : ''}>Full range</option><option value="night" ${s.range === 'night' ? 'selected' : ''}>Night — softer loud sounds</option></select></label>${check('captions', 'Directional sound captions')}` +
        `<section class="settings-group"><h3>Comfort and display</h3>${check('hud', 'Show status display')}${check('hints', 'Show control hints')}${check('headBob', 'Small head movement while walking')}${check('flicker', 'Slow light flicker')}</section>` +
        `<p class="note">No camera shake or motion blur. Head movement and flicker are off by default. Sound volume does not change enemy hearing.</p></section></div></section>`
    );
    this.click('back', () => this.back());
    this.click('kit', () => this.handlers.kitMenu());
    this.overlay.querySelectorAll('[data-setting]').forEach((input) =>
      input.addEventListener(input instanceof HTMLInputElement && input.type === 'range' ? 'input' : 'change', () => {
        const key = input.dataset.setting;
        let value = input.value;
        if (input instanceof HTMLInputElement) value = input.type === 'checkbox' ? input.checked : Number(input.value);
        this.settings = validateSettings({ ...this.settings, [key]: value });
        const out = this.overlay.querySelector(`[data-output="${key}"]`);
        if (out && SLIDER_FORMAT[key]) out.value = SLIDER_FORMAT[key](this.settings[key]);
        this.handlers.settings(this.settings);
      })
    );
  }

  showControls() {
    const pad = [['Move', 'Left stick / D-pad'], ['Look', 'Right stick'], ['Use / open / hide', 'X'], ['Hold breath', 'A'], ['Crouch', 'B or R-stick click'], ['Flashlight', 'Y'], ['Throw bottle', 'RT or RB'], ['Charge light (hold)', 'LB or LT'], ['Run (toggle)', 'L-stick click'], ['Map and notes', 'Back / View'], ['Pause', 'Start / Menu']];
    const touch = [['Move', 'Stick on the left half'], ['Look', 'Drag anywhere else'], ['Use, Breath, Crouch, Light, Bottle', 'Buttons, bottom right'], ['Run (toggle), Crank (hold), Map, Pause', 'Pills along the top']];
    const table = (rows) => `<table class="key-table"><tbody>${rows.map(([a, b]) => `<tr><td>${a}</td><td><kbd>${b}</kbd></td></tr>`).join('')}</tbody></table>`;
    this.paint(
      'controls',
      `<section class="dialog panel"><header class="dialog-head"><div><div class="eyebrow">KEYBOARD + MOUSE / GAMEPAD / TOUCH</div><h2>Controls</h2><p class="muted">Mouse: look. Drag to look when mouse lock is blocked. Arrow keys also turn the view. Select a key below to change it.</p></div><button data-action="back">Back</button></header>` +
        `<div class="settings-grid"><div><h3>Keyboard</h3><table class="key-table"><tbody>${Object.keys(DEFAULT_BINDINGS)
          .map((action) => `<tr><td>${labels[action]}</td><td><button data-bind="${action}" aria-label="Change key: ${labels[action]}">${escape(keyLabel(this.settings.bindings[action]))}</button></td></tr>`)
          .join('')}<tr><td>Turn the view</td><td><kbd>Arrow keys</kbd></td></tr><tr><td>Pause / release mouse</td><td><kbd>Esc</kbd> <kbd>P</kbd></td></tr></tbody></table>` +
        `<p data-bind-status class="muted" role="status" style="margin-top:16px"></p><button data-action="reset">Reset controls</button></div>` +
        `<section><h3>Gamepad</h3>${table(pad)}<h3 style="margin-top:25px">Touch</h3>${table(touch)}` +
        `<h3 style="margin-top:25px">Stay quiet</h3><p>Walk on carpet when you can. Running and metal floors make more noise.</p><p>Crouch before you move a door to move it slowly. A threat can push a door open.</p><p>Use a locker to hide. Hold your breath when a threat is close. Low stamina can make you breathe loudly.</p><p>A threat that sees you hide can find your locker. A thrown bottle or a radio can draw it away.</p>` +
        `<h3 style="margin-top:25px">Keep the light working</h3><p>Hold the charge control to turn the crank. The light goes off, and the crank makes noise.</p><p class="muted">There is no jump, gun, or hand animation. Use the stairs. Move and listen.</p></section></div></section>`
    );
    this.click('back', () => this.back());
    this.click('reset', () => {
      this.settings = validateSettings({ ...this.settings, bindings: { ...DEFAULT_BINDINGS } });
      this.handlers.settings(this.settings);
      this.showControls();
    });
    this.overlay.querySelectorAll('[data-bind]').forEach((b) =>
      b.addEventListener('click', () => {
        this.binding = b.dataset.bind;
        this.el('[data-bind-status]').textContent = `Press a key for: ${labels[this.binding]}. Esc cancels.`;
        b.textContent = 'Press a key…';
      })
    );
  }

  key(e) {
    if (this.overlay.hidden || this.isKitMenuOpen()) return;
    if (this.binding) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.code === 'Escape') {
        this.showControls();
        return;
      }
      const conflict = Object.keys(this.settings.bindings).find((a) => a !== this.binding && this.settings.bindings[a] === e.code);
      if (!bindable(e.code) || conflict) {
        this.el('[data-bind-status]').textContent = conflict ? `That key is used for: ${labels[conflict]}.` : 'Use a letter, number, Shift, Ctrl, Alt, Space, or Tab. P and the arrow keys are reserved.';
        return;
      }
      this.settings = validateSettings({ ...this.settings, bindings: { ...this.settings.bindings, [this.binding]: e.code } });
      this.handlers.settings(this.settings);
      this.showControls();
      return;
    }
    if (e.code === 'Escape' && ['settings', 'controls'].includes(this.screen)) {
      e.preventDefault();
      this.back();
      return;
    }
    if ((e.code === 'Escape' || e.code === this.settings.bindings.journal) && this.screen === 'journal') {
      e.preventDefault();
      this.handlers.resume();
      return;
    }
    if (e.code === 'KeyP' && this.screen === 'pause' && !e.repeat) {
      e.preventDefault();
      this.handlers.resume();
      return;
    }
    if (e.code === 'Tab') {
      const focus = this.focusables();
      if (!focus.length) return;
      const first = focus[0];
      const last = focus[focus.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  focusables() {
    return [...this.overlay.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
  }

  /** Gamepad menu navigation: up/down (and left/right between buttons), sliders and lists change sideways. */
  navigate(dir, side) {
    this.root.classList.add('pad-nav');
    const list = this.focusables();
    if (!list.length) return;
    const cur = document.activeElement;
    let i = list.indexOf(cur);
    if (side && i >= 0) {
      if (cur.type === 'range') {
        const step = Number(cur.step) || 1;
        const v = Math.min(Number(cur.max), Math.max(Number(cur.min), Number(cur.value) + side * step));
        cur.value = String(v);
        cur.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }
      if (cur.tagName === 'SELECT') {
        cur.selectedIndex = (cur.selectedIndex + side + cur.options.length) % cur.options.length;
        cur.dispatchEvent(new Event('change', { bubbles: true }));
        return;
      }
    }
    const step = dir || side;
    if (!step) return;
    i = i < 0 ? 0 : (i + step + list.length) % list.length;
    list[i].focus();
    list[i].scrollIntoView?.({ block: 'nearest' });
  }

  /** Gamepad A in a menu. */
  activate() {
    this.root.classList.add('pad-nav');
    const el = document.activeElement;
    if (!el || !this.overlay.contains(el)) {
      this.focusables()[0]?.focus();
      return;
    }
    if (el.tagName === 'SELECT') {
      el.selectedIndex = (el.selectedIndex + 1) % el.options.length;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (el.type === 'range' || el.type === 'text') {
      // Sliders move sideways; the seed field keeps its text.
    } else el.click();
  }

  /** Gamepad B (or Start) in a menu. */
  cancel() {
    if (this.binding) return this.showControls();
    if (['settings', 'controls'].includes(this.screen)) return this.back();
    if (this.screen === 'journal' || this.screen === 'pause') return this.handlers.resume();
    if (this.screen === 'end' || this.screen === 'error') return this.handlers.saveMenu();
    return undefined;
  }

  journal(data) {
    this.parentPage = 'pause';
    const b = (id) => data.city.buildings.find((x) => x.id === id);
    const found = data.logs.map((id, n) => ({ n, entry: LOGS[n] })).filter((x) => x.entry);
    this.paint(
      'journal',
      `<section class="dialog panel"><header class="dialog-head"><div><div class="eyebrow">FIELD NOTES / GAME PAUSED</div><h2>Find a signal out</h2><p class="muted">Seed ${escape(data.city.seed)} / ${escape(data.city.fingerprint)} / ${escape(difficultyOf(data.difficulty).label)}</p></div><button data-action="resume">Close map</button></header>` +
        `<div class="journal-grid"><section><canvas class="map" width="480" height="480" aria-label="City map. Your marker is a circle. North exit is at the top."></canvas><p class="muted" style="margin-top:10px">Circle: you, with a tick for where you face. Solid blocks: places you entered. Small squares: signal logs you played.<br>North is at the top. The map does not show threats.</p></section>` +
        `<section><h3>Fuse locations</h3>${data.city.fuses
          .map((f) => {
            const place = b(f.building);
            const r = place.rooms.find((x) => x.id === f.room);
            return `<div class="clue ${data.collected.has(f.id) ? 'done' : ''}"><strong>Block ${String.fromCharCode(65 + place.lotX)}${place.lotZ + 1}</strong><br>${place.kind[0].toUpperCase() + place.kind.slice(1)} / floor ${r.floor + 1}${data.collected.has(f.id) ? ' / collected' : ''}</div>`;
          })
          .join('')}<div class="rule"></div><h3>The exit</h3><p>Use the switch at the north gate after you find all three fuses.</p><p>The alarm will run for ${data.alarm} seconds. Stay alive until the gate opens. Then go through it.</p><p class="note">Glass does not stop sight. Doors reduce sound, but they do not remove it.</p>` +
        `<div class="rule"></div><h3>Signal logs ${found.length} / ${data.logTotal}</h3>${
          found.length
            ? found.map(({ n, entry }) => `<div class="clue log"><strong>Log ${n + 1} — ${escape(entry.title)}</strong><br>${escape(entry.text)}</div>`).join('')
            : '<p class="muted">Tape recorders with a blinking light sit on room tables. Playing one makes a little sound.</p>'
        }</section></div></section>`
    );
    this.click('resume', () => this.handlers.resume());
    this.drawMap(this.el('.map'), data);
  }

  drawMap(canvas, data) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const city = data.city;
    const pad = 26;
    const scale = (480 - pad * 2) / (city.extent * 2);
    const map = (p) => [240 - p[0] * scale, 240 - p[2] * scale];
    const nodes = new Map(city.nodes.map((n) => [n.id, n]));
    ctx.fillStyle = '#0c1717';
    ctx.fillRect(0, 0, 480, 480);
    ctx.strokeStyle = '#32453e';
    ctx.lineWidth = 1;
    for (const link of city.portals) {
      if (link.kind !== 'open') continue;
      const a = nodes.get(link.a);
      const b = nodes.get(link.b);
      if (!a || !b || a.kind !== 'street' || b.kind !== 'street') continue;
      ctx.beginPath();
      ctx.moveTo(...map(a.position));
      ctx.lineTo(...map(b.position));
      ctx.stroke();
    }
    ctx.textAlign = 'center';
    ctx.font = '10px monospace';
    for (const b of city.buildings) {
      const [x, y] = map(b.center);
      ctx.fillStyle = data.explored.has(b.id) ? '#83997a' : '#273b33';
      ctx.fillRect(x - (b.width / 2) * scale, y - (b.depth / 2) * scale, b.width * scale, b.depth * scale);
      ctx.fillStyle = '#cdd9c9';
      ctx.fillText(`${String.fromCharCode(65 + b.lotX)}${b.lotZ + 1}`, x, y + 3);
    }
    ctx.fillStyle = '#8fe3ff';
    for (const l of data.logPlaces) {
      if (!data.logs.includes(l.id)) continue;
      const [x, y] = map(l.position);
      ctx.fillRect(x - 3, y - 3, 6, 6);
    }
    const exit = map(city.exit);
    ctx.fillStyle = '#e4b47b';
    ctx.fillRect(exit[0] - 8, exit[1] - 3, 16, 5);
    ctx.fillText('EXIT / N', exit[0], exit[1] - 10);
    const [x, y] = map(data.player);
    ctx.fillStyle = '#e1efd5';
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e1efd566';
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.stroke();
    // Facing: forward is (sin yaw, -cos yaw) in the world; the map mirrors both axes.
    ctx.strokeStyle = '#e1efd5';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - Math.sin(data.yaw) * 14, y + Math.cos(data.yaw) * 14);
    ctx.stroke();
  }

  play() {
    this.screen = 'play';
    this.overlay.hidden = true;
    this.hud.hidden = false;
    this.root.classList.remove('pad-nav');
    this.hudCache.clear();
    this.apply(this.settings);
  }

  setSource(src) {
    if (this.source === src) return;
    this.source = src;
    this.apply(this.settings);
  }

  apply(s) {
    this.settings = s;
    const hints = this.hudEls.hints;
    if (hints) {
      hints.hidden = !s.hints || this.source === 'touch';
      const k = (code) => `<kbd>${escape(code)}</kbd>`;
      if (this.source === 'gamepad') {
        hints.innerHTML = [['X', 'Use'], ['B', 'Crouch'], ['Y', 'Light'], ['RT', 'Bottle'], ['LB', 'Crank'], ['A', 'Breath'], ['L-stick', 'Run'], ['Back', 'Map'], ['Start', 'Pause']].map(([key, text]) => `<span>${k(key)} ${text}</span>`).join('');
      } else {
        hints.innerHTML =
          ['interact', 'crouch', 'flashlight', 'throw', 'journal', 'hints']
            .map((a) => `<span>${k(keyLabel(s.bindings[a]))} ${a === 'hints' ? 'Hide hints' : a === 'interact' ? 'Use' : a === 'journal' ? 'Map' : a === 'throw' ? 'Bottle' : labels[a].split(' (')[0]}</span>`)
            .join('') +
          `<span>${k(['forward', 'left', 'back', 'right'].map((a) => keyLabel(s.bindings[a])).join(' '))} Move</span><span>${k('Mouse / arrows')} Look</span><span>${k('P')} Pause</span>`;
      }
    }
    for (const sel of ['.hud-top', '.meters', '.crosshair']) {
      const node = this.hud.querySelector(sel);
      if (node) node.hidden = !s.hud;
    }
    if (!s.captions && this.hudEls.caption) this.hudEls.caption.hidden = true;
  }

  /** HUD values; DOM writes only when a value changes. */
  update(d) {
    const set = (key, value) => {
      if (this.hudCache.get(key) === value) return;
      this.hudCache.set(key, value);
      this.hudEls[key].textContent = value;
    };
    set('objective', d.phase === 'scavenge' ? (d.fuses === 3 ? 'ALL FUSES FOUND / GO TO THE NORTH GATE' : `FIND THREE FUSES / ${d.fuses} OF 3`) : d.phase === 'powering' ? `STAY ALIVE / GATE POWER IN ${Math.ceil(d.alarm)}s` : d.phase === 'escape' ? 'THE GATE IS OPEN / GO NORTH' : '');
    set('location', d.location);
    set('info', `${this.backend.toUpperCase()} / ${d.fps} FPS\n${d.lights} LOCAL LIGHTS / ${d.decoys} BOTTLES`);
    for (const [key, value] of [['battery', d.battery], ['stamina', d.stamina], ['noise', d.noise * 100]]) {
      const v = Math.round(Math.max(0, Math.min(100, value)));
      if (this.hudCache.get(`${key}-bar`) !== v) {
        this.hudCache.set(`${key}-bar`, v);
        this.hudEls[key].style.width = `${v}%`;
      }
      set(`${key}-text`, String(Math.round(value)));
    }
    const prompt = this.hudEls.prompt;
    if (prompt.hidden !== !d.prompt) prompt.hidden = !d.prompt;
    set('prompt', d.prompt);
    set('state', d.hidden ? (d.breath ? 'HIDDEN / BREATH HELD' : 'HIDDEN / LISTEN') : d.crank ? 'CHARGING / CRANK MAKES NOISE' : '');
    const now = performance.now();
    if (now > this.captionUntil && !this.hudEls.caption.hidden) this.hudEls.caption.hidden = true;
    if (now > this.toastUntil && !this.hudEls.toast.hidden) this.hudEls.toast.hidden = true;
    if (now > this.logUntil && !this.hudEls.log.hidden) this.hudEls.log.hidden = true;
  }

  caption(text) {
    if (!this.settings.captions) return;
    const e = this.hudEls.caption;
    e.textContent = text;
    e.hidden = false;
    this.captionUntil = performance.now() + 2300;
  }

  toast(text, duration = 4) {
    const e = this.hudEls.toast;
    e.textContent = text;
    e.hidden = false;
    this.toastUntil = performance.now() + duration * 1000;
  }

  /** A signal log plays: its transcript stays on screen for a while. */
  showLog(n, total) {
    const entry = LOGS[n];
    if (!entry) return;
    const e = this.hudEls.log;
    e.innerHTML = `<small>SIGNAL LOG ${n + 1} / ${total}</small><strong>${escape(entry.title)}</strong><span>${escape(entry.text)}</span>`;
    e.hidden = false;
    this.logUntil = performance.now() + 11000;
  }
}
