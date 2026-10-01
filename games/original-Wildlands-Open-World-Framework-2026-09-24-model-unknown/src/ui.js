// ui.js — the HUD (place, compass, minimap, stream status), the world map, the
// journal, the pause/settings panel and the title screen. Text is written only
// when it changes; the maps are shaded a few rows per frame on a time budget.
import { BIOMES, DESTINATIONS, VIEWS, VERSION } from './config.js';

const HINTS = {
  keyboard: [['W A S D', 'Move'], ['SHIFT', 'Move faster'], ['F', 'Fly'], ['TAB', 'Map']],
  gamepad: [['L STICK', 'Move'], ['RB', 'Move faster'], ['Y', 'Fly'], ['VIEW', 'Map']],
  touch: [['STICK', 'Move'], ['RUN', 'Move faster'], ['FLY', 'Fly'], ['MAP', 'Map']],
};
const CONTROLS = {
  keyboard: [
    ['W A S D / arrows', 'Move'], ['Mouse', 'Look around (click to capture, or hold a button and drag)'], ['Shift', 'Run / fly faster'],
    ['Space or E', 'Jump / fly up'], ['Q or C', 'Fly down'], ['F', 'Switch walk / fly'], ['L', 'Switch torch on / off'],
    ['Tab or M / J', 'Map / field journal'], ['Esc, P or O', 'Pause and settings'], ['K / R', 'Save / return to start'],
    ['T / V', 'Day cycle / hide interface'], ['F9', 'Graphics'],
  ],
  gamepad: [
    ['Left stick / D-pad', 'Move'], ['Right stick', 'Look around'], ['RB or left-stick click', 'Run / fly faster'],
    ['A or RT', 'Jump / fly up'], ['B or LT', 'Fly down'], ['Y', 'Switch walk / fly'], ['X', 'Switch torch on / off'],
    ['View / LB', 'Map / field journal'], ['Start', 'Pause and settings'], ['In menus', 'D-pad moves, A selects, B goes back'],
  ],
  touch: [
    ['Left thumb', 'Move (the stick appears under your thumb)'], ['Drag on the right', 'Look around'], ['Jump / Up', 'Jump / fly up'],
    ['Down', 'Fly down (in flight)'], ['Run', 'Run / fly faster'], ['Fly, Torch', 'Switch walk / fly, torch on / off'],
    ['World map, Settings', 'Map and pause (top right)'],
  ],
};
const NOTES = {
  keyboard: 'WALK · FLY · EXPLORE &nbsp; / &nbsp; KEYBOARD + MOUSE',
  gamepad: 'WALK · FLY · EXPLORE &nbsp; / &nbsp; GAMEPAD',
  touch: 'WALK · FLY · EXPLORE &nbsp; / &nbsp; TOUCH',
};
const MODE_NOTICE = {
  keyboard: ['Flight mode. Space: up. Q: down. Shift: faster.', 'Walking mode. Space: jump. Shift: run.'],
  gamepad: ['Flight mode. A: up. B: down. RB: faster.', 'Walking mode. A: jump. RB: run.'],
  touch: ['Flight mode. Up and Down climb and descend. Run: faster.', 'Walking mode. Jump to jump. Run: run.'],
};
const PHOTO_NOTICE = {
  keyboard: 'Photo mode. Press V to show the interface.',
  gamepad: 'Photo mode. Press Start to show the interface.',
  touch: 'Photo mode. Tap the screen to show the interface.',
};

const formatTime = (h) => { const hours = Math.floor(h), mins = Math.floor((h - hours) * 60); return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`; };
export const formatDuration = (s) => {
  s = Math.max(0, Math.round(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min ${String(sec).padStart(2, '0')} s`;
};
const escapeHTML = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** A terrain survey map: generated from the world itself, not an image. */
class WorldMap {
  constructor(canvas, generator, progressive) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.generator = generator; this.progressive = progressive;
    this.center = { x: 0, z: 0 }; this.span = 16000; this.ready = false; this.job = null;
    this.base = document.createElement('canvas'); this.base.width = canvas.width; this.base.height = canvas.height; this.baseCtx = this.base.getContext('2d');
    this.color = [0, 0, 0];
  }
  setGenerator(generator) { this.generator = generator; this.ready = false; this.job = null; }
  get busy() { return !!this.job; }
  /** Start shading a new view; work() does the rows a few at a time. */
  build(cx = this.center.x, cz = this.center.z, span = this.span) {
    const w = this.canvas.width, h = this.canvas.height;
    this.job = { cx, cz, span, y: 0, image: this.baseCtx.createImageData(w, h) };
    if (this.progressive) {
      // The big map fills in row by row over a plain background.
      this.center = { x: cx, z: cz }; this.span = span; this.ready = true;
      this.baseCtx.fillStyle = '#35463b'; this.baseCtx.fillRect(0, 0, w, h);
    }
  }
  work(budgetMs) {
    const job = this.job; if (!job) return;
    const w = this.canvas.width, h = this.canvas.height, gen = this.generator, d = job.image.data, c = this.color;
    const start = performance.now(), firstRow = job.y;
    while (job.y < h) {
      const y = job.y; let lastH = 0;
      for (let x = 0; x < w; x++) {
        const wx = job.cx + (x / w - 0.5) * job.span, wz = job.cz + (y / h - 0.5) * job.span * (h / w), s = gen.sample(wx, wz);
        if (s.water) { c[0] = 0.11; c[1] = 0.27; c[2] = 0.28; } else gen.color(wx, wz, s, c);
        let light = x ? Math.max(0.69, Math.min(1.18, 0.94 + (lastH - s.height) * 0.008)) : 1; lastH = s.height;
        if (!s.water && ((s.height + 4000) % 65) < 2.8) light *= 0.77;
        const i = (y * w + x) * 4; d[i] = Math.pow(c[0], 0.65) * 255 * light; d[i + 1] = Math.pow(c[1], 0.65) * 255 * light; d[i + 2] = Math.pow(c[2], 0.65) * 255 * light; d[i + 3] = 255;
      }
      job.y++;
      if (performance.now() - start > budgetMs) break;
    }
    if (this.progressive) this.baseCtx.putImageData(job.image, 0, 0, 0, firstRow, w, job.y - firstRow);
    if (job.y >= h) {
      if (!this.progressive) { this.baseCtx.putImageData(job.image, 0, 0); this.center = { x: job.cx, z: job.cz }; this.span = job.span; }
      this.ready = true; this.job = null;
    }
  }
  project(x, z) { const w = this.canvas.width, h = this.canvas.height; return { x: (0.5 + (x - this.center.x) / this.span) * w, y: h * 0.5 + (z - this.center.z) / this.span * w }; }
  unproject(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect(), sx = (clientX - rect.left) / rect.width * this.canvas.width, sy = (clientY - rect.top) / rect.height * this.canvas.height;
    return { x: this.center.x + (sx / this.canvas.width - 0.5) * this.span, z: this.center.z + (sy - this.canvas.height * 0.5) / this.canvas.width * this.span };
  }
  draw(player, waypoint, sites, labels) {
    const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
    ctx.fillStyle = '#35463b'; ctx.fillRect(0, 0, w, h); if (this.ready) ctx.drawImage(this.base, 0, 0);
    ctx.strokeStyle = 'rgba(229,236,206,.13)'; ctx.lineWidth = 1;
    for (let i = 1; i < 8; i++) { ctx.beginPath(); ctx.moveTo(i * w / 8, 0); ctx.lineTo(i * w / 8, h); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i * h / 8); ctx.lineTo(w, i * h / 8); ctx.stroke(); }
    if (labels) {
      ctx.font = '11px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      for (const dest of DESTINATIONS) { const p = this.project(dest.x, dest.z); ctx.fillStyle = '#f3e9c8'; ctx.strokeStyle = '#202e29'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.strokeText(dest.name, p.x + 9, p.y); ctx.fillText(dest.name, p.x + 9, p.y); }
    }
    // Survey posts: hollow until recorded, then filled.
    const r = labels ? 4.5 : 3.2;
    for (const s of sites) {
      const p = this.project(s.x, s.z); if (p.x < -8 || p.y < -8 || p.x > w + 8 || p.y > h + 8) continue;
      ctx.beginPath(); ctx.moveTo(p.x, p.y - r); ctx.lineTo(p.x + r, p.y); ctx.lineTo(p.x, p.y + r); ctx.lineTo(p.x - r, p.y); ctx.closePath();
      ctx.lineWidth = 1.5; ctx.strokeStyle = s.found ? '#2a1b12' : '#ffe3a0'; ctx.fillStyle = s.found ? '#d9773f' : 'rgba(32,46,41,.55)'; ctx.fill(); ctx.stroke();
    }
    if (waypoint) { const p = this.project(waypoint.x, waypoint.z); ctx.strokeStyle = '#ffe3a0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x, p.y - 8); ctx.lineTo(p.x + 6, p.y); ctx.lineTo(p.x, p.y + 8); ctx.lineTo(p.x - 6, p.y); ctx.closePath(); ctx.stroke(); }
    const p = this.project(player.position.x, player.position.z);
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(-player.yaw); ctx.fillStyle = '#fff3d1'; ctx.strokeStyle = '#27392e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  }
}

export class UISystem {
  constructor(app) {
    this.app = app; this.kit = app.kit; this.menu = null; this.hidden = false; this.waypoint = null;
    this.lastHUD = -Infinity; this.lastMap = -Infinity; this.lastMini = -Infinity; this.toastTimer = 0; this.text = new Map(); this.confirmReset = 0;
    this.$ = (id) => document.getElementById(id);
    this.mini = new WorldMap(this.$('mini-map'), app.generator, false);
    this.map = new WorldMap(this.$('world-map'), app.generator, true);
    this.abort = new AbortController(); const opt = { signal: this.abort.signal };
    const on = (id, type, fn) => this.$(id).addEventListener(type, fn, opt);
    this.$('version').textContent = `WORLD FRAMEWORK / ${VERSION}`;

    // A saved journey continues where it stopped; the second button starts at the overlook.
    this.$('start-home').hidden = !app.returning;
    on('start', 'click', () => app.start());
    on('start-home', 'click', () => app.start(DESTINATIONS[0]));
    on('settings-button', 'click', () => this.open('settings'));
    on('map-button', 'click', () => this.open('map'));
    on('mini-button', 'click', () => this.open('map'));
    for (const el of document.querySelectorAll('[data-close]')) el.addEventListener('click', () => this.close(), opt);
    on('resume-button', 'click', () => app.capture());
    on('resume-panel', 'click', () => this.close());
    on('journal-button', 'click', () => this.open('journal'));
    on('graphics-button', 'click', () => this.kit.menu.open());

    const view = this.$('view');
    view.innerHTML = Object.entries(VIEWS).map(([k, v]) => `<option value="${k}">${v.label} · ${v.distance / 1000} km view</option>`).join('');
    view.value = app.viewName;
    view.addEventListener('change', (e) => app.setView(e.target.value, true), opt);
    on('time', 'input', (e) => { app.environment.hours = Number(e.target.value); this.$('time-value').textContent = formatTime(app.environment.hours); });
    this.$('cycle').checked = app.environment.cycle; on('cycle', 'change', (e) => { app.environment.cycle = e.target.checked; });
    this.$('sensitivity').value = String(app.mouseScale * 0.0024);
    on('sensitivity', 'input', (e) => { app.mouseScale = Number(e.target.value) / 0.0024; app.savePrefs(); });
    this.$('speed').value = String(app.player.speedScale); this.$('speed-value').textContent = `${app.player.speedScale.toFixed(1)}×`;
    on('speed', 'input', (e) => { app.player.speedScale = Number(e.target.value); this.$('speed-value').textContent = `${Number(e.target.value).toFixed(1)}×`; app.savePrefs(); });
    this.$('sound').checked = app.sound.enabled; on('sound', 'change', (e) => { app.sound.setEnabled(e.target.checked); app.savePrefs(); });
    this.$('volume').value = String(app.sound.volume); on('volume', 'input', (e) => { app.sound.setVolume(Number(e.target.value)); app.savePrefs(); });
    this.$('seed').value = app.generator.seedText;
    on('new-world', 'click', () => {
      const seed = this.$('seed').value.trim().slice(0, 64);
      if (!seed) { this.notice('Enter a world seed first.'); return; }
      app.setSeed(seed); this.close();
    });
    on('save-button', 'click', () => app.save.write(app));
    on('export-button', 'click', () => app.save.export(app));
    on('import-button', 'click', () => this.$('import-file').click());
    on('import-file', 'change', async (e) => {
      try { const s = await app.save.import(e.target.files[0]); app.restore(s); this.notice('Save loaded.'); this.close(); }
      catch (error) { this.notice(error.message); }
      finally { e.target.value = ''; }
    });
    on('flight-button', 'click', () => app.toggleFlight());
    on('torch-button', 'click', () => app.toggleTorch());
    on('home-button', 'click', () => { app.teleport(DESTINATIONS[0]); this.close(); });
    on('photo-button', 'click', () => { this.close(); this.togglePhoto(); });

    const destinations = this.$('destinations');
    DESTINATIONS.forEach((dest, i) => {
      const b = document.createElement('button'); b.className = 'destination'; b.type = 'button';
      b.innerHTML = `<span class="dest-number">0${i + 1}</span><span><strong>${escapeHTML(dest.name)}</strong><small>${escapeHTML(dest.biome)}</small></span><span class="dest-arrow">↗</span>`;
      b.addEventListener('click', () => { app.teleport(dest); this.close(); }, opt);
      destinations.append(b);
    });
    on('world-map', 'click', (e) => {
      const p = this.map.unproject(e.clientX, e.clientY);
      if (e.shiftKey) { app.teleport({ ...p, lift: 180 }); this.close(); }
      else { this.waypoint = p; this.notice('Waypoint set. Hold Shift and click the map, or press Travel, to go there.'); }
    });
    on('map-travel', 'click', () => {
      if (!this.waypoint) { this.notice('Select a point on the map to set a waypoint first.'); return; }
      app.teleport({ x: this.waypoint.x, z: this.waypoint.z, lift: 180, name: this.waypoint.name }); this.close();
    });
    on('map-journal', 'click', () => this.open('journal'));
    on('map-center', 'click', () => this.map.build(app.player.position.x, app.player.position.z, this.map.span));
    on('map-home', 'click', () => this.map.build(0, 0, 16000));
    on('zoom-in', 'click', () => this.map.build(this.map.center.x, this.map.center.z, Math.max(2500, this.map.span / 1.6)));
    on('zoom-out', 'click', () => this.map.build(this.map.center.x, this.map.center.z, Math.min(80000, this.map.span * 1.6)));
    on('journal-reset', 'click', () => {
      const now = performance.now();
      if (now - this.confirmReset > 4000) { this.confirmReset = now; this.$('journal-reset').textContent = 'Press again to clear this survey'; return; }
      this.confirmReset = 0; app.survey.clear(); app.saveSurvey(); this.renderJournal(); this.notice('The survey for this world starts again.');
    });

    // Keys the kit leaves to form fields: Escape still closes a menu from a slider, list or
    // the seed box, and Tab keeps focus inside the open panel.
    window.addEventListener('keydown', (e) => {
      if (!this.menu) return;
      if (e.code === 'Escape' && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName || '')) { e.preventDefault(); this.close(false); return; }
      if (e.code === 'Tab') {
        e.preventDefault();
        const items = [...this.root.querySelectorAll('button,input:not([type=file]),select')].filter((el) => !el.disabled && !el.closest('[hidden]'));
        const i = items.indexOf(document.activeElement), next = (i + (e.shiftKey ? -1 : 1) + items.length) % items.length;
        items[next]?.focus();
      }
    }, opt);

    this.unsubscribers = [
      app.events.on('notice', (message) => this.notice(message)),
      app.events.on('error', (e) => this.notice(e.message)),
      app.events.on('player:mode', () => this.updateMode()),
      app.events.on('survey:found', () => { this.text.delete('survey-count'); if (this.menu === 'journal') this.renderJournal(); }),
    ];
    this.unsubscribers.push(this.kit.input.onSourceChange((src) => this.setPrompts(src)));
    this.setPrompts(this.kit.input.source);
    this.updateMode(); this.updateTorch();
  }
  get root() { return this.menu ? this.$(`${this.menu}-panel`) : null; }
  /** Write text only when it changed. */
  set(id, text) { if (this.text.get(id) === text) return; this.text.set(id, text); this.$(id).textContent = text; }
  setPrompts(src) {
    const source = HINTS[src] ? src : 'keyboard';
    this.$('hints').innerHTML = HINTS[source].map(([k, label]) => `<span><span class="key">${k}</span>${label}</span>`).join('');
    this.$('controls-table').innerHTML = CONTROLS[source].map(([k, label]) => `<tr><td>${k}</td><td>${label}</td></tr>`).join('');
    this.$('welcome-note').innerHTML = NOTES[source];
    this.$('sensitivity-row').hidden = source !== 'keyboard';
    this.updateResumeHint();
  }
  notice(message, ms = 4200) {
    const el = this.$('notice'); el.textContent = String(message); el.classList.add('visible');
    clearTimeout(this.toastTimer); this.toastTimer = setTimeout(() => el.classList.remove('visible'), ms);
  }
  modeNotice() { const src = MODE_NOTICE[this.kit.input.source] || MODE_NOTICE.keyboard; this.notice(this.app.player.mode === 'fly' ? src[0] : src[1]); }
  open(menu) {
    const app = this.app;
    if (!app.started) return;
    if (this.hidden) this.togglePhoto();
    const opening = this.menu !== menu;
    this.menu = menu;
    // The key or button that opened the menu (or Esc that released the mouse) must not also close it.
    this.kit.input.unlockPointer(); this.kit.input.settle(); this.kit.touch?.suspend(true, 'pause-menu');
    this.$('modal-shade').hidden = false;
    for (const name of ['settings', 'map', 'journal']) this.$(`${name}-panel`).hidden = name !== menu;
    if (menu === 'map' && !this.map.ready && !this.map.busy) this.map.build();
    if (menu === 'journal') { this.confirmReset = 0; this.$('journal-reset').textContent = 'Clear this survey'; this.renderJournal(); }
    if (menu === 'settings') {
      this.$('time').value = app.environment.hours; this.$('cycle').checked = app.environment.cycle; this.$('time-value').textContent = formatTime(app.environment.hours);
      this.$('view').value = app.viewName; this.$('seed').value = app.generator.seedText;
    }
    this.updateResumeHint();
    if (opening) {
      const root = this.root, target = root.querySelector('[data-nav-default]') || root.querySelector('button:not([data-close])');
      try { target?.focus({ preventScroll: true }); } catch { target?.focus(); }
    }
    app.events.emit('ui:menu', menu);
  }
  /** Close the open panel. capture: ask for mouse capture again (a click on Resume or ×). */
  close(capture = true) {
    if (!this.menu) return;
    this.menu = null;
    this.$('modal-shade').hidden = true;
    for (const name of ['settings', 'map', 'journal']) this.$(`${name}-panel`).hidden = true;
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur?.();
    this.kit.touch?.suspend(false, 'pause-menu');
    this.app.afterMenu();
    if (capture) this.app.capture();
    this.updateResumeHint();
    this.app.events.emit('ui:menu', null);
  }
  /** "Click to continue" shows for mouse players who are playing without mouse capture. */
  updateResumeHint() {
    const app = this.app, show = app.started && !this.menu && !this.hidden && this.kit.input.source === 'keyboard' && !document.pointerLockElement;
    this.$('resume-hint').classList.toggle('visible', show);
  }
  togglePhoto() {
    this.hidden = !this.hidden; document.body.classList.toggle('photo', this.hidden);
    this.kit.touch?.suspend(this.hidden, 'photo');
    if (this.hidden) this.notice(PHOTO_NOTICE[this.kit.input.source] || PHOTO_NOTICE.keyboard, 3000);
    this.updateResumeHint();
  }
  updateMode() {
    const fly = this.app.player.mode === 'fly';
    this.$('mode-label').textContent = fly ? 'FLIGHT' : 'ON FOOT';
    this.$('flight-button').textContent = fly ? 'Switch to walking' : 'Switch to flight';
    const touch = this.kit.touch;
    if (touch) { touch.setLabel('rise', fly ? 'Up' : 'Jump'); touch.setLabel('fly', fly ? 'Walk' : 'Fly'); touch.setShown('sink', fly); }
  }
  updateTorch() {
    const on = this.app.environment.torchOn;
    this.$('torch-button').textContent = on ? 'Torch on' : 'Torch off';
    this.kit.touch?.setLabel('torch', on ? 'Torch ●' : 'Torch');
  }
  /** The title screen: progress, then the start buttons. */
  updateWelcome() {
    const app = this.app, prog = app.terrain.progress, pct = Math.round(prog * 100);
    const fill = `${pct}%`; if (this.text.get('load-fill') !== fill) { this.text.set('load-fill', fill); this.$('load-fill').style.width = fill; }
    if (app.terrain.readyNear) {
      const start = this.$('start');
      if (start.disabled) {
        start.disabled = false; this.$('start-home').disabled = false;
        start.innerHTML = `${app.returning ? 'Continue the journey' : 'Enter the wild'} <span>↗</span>`;
        this.$('engine-status').hidden = true;
        if (this.kit.input.source === 'gamepad') start.focus();
      }
      this.set('load-label', prog >= 1 ? 'THE WORLD IS READY' : `THE HORIZON IS LOADING · ${pct}%`);
    } else this.set('load-label', `SURVEYING THE WORLD · ${pct}%`);
  }
  update(elapsed, fps) {
    const app = this.app, p = app.player.position;
    if (!app.started) this.updateWelcome();
    // The world map shades faster while it is open; the minimap takes a small slice.
    this.map.work(this.menu === 'map' ? 9 : 0.5);
    this.mini.work(this.menu ? 1 : 2);
    if (elapsed - this.lastHUD > 0.12) {
      this.lastHUD = elapsed;
      const s = app.here;
      let nearest = null, dist = Infinity;
      for (const d of DESTINATIONS) { const r = Math.hypot(p.x - d.x, p.z - d.z); if (r < dist) { dist = r; nearest = d; } }
      let post = null;
      for (const site of app.survey.sites) if (site.distance < 80 && (!post || site.distance < post.distance)) post = site;
      this.set('place', post ? post.def.name : dist < 700 ? nearest.name : BIOMES[s.biome]);
      this.set('biome', BIOMES[s.biome].toUpperCase());
      this.set('coordinates', `${Math.round(p.x).toLocaleString()} E  /  ${Math.round(-p.z).toLocaleString()} N`);
      this.set('altitude', `${Math.round(p.y)} m`);
      this.set('clock', formatTime(app.environment.hours));
      this.set('day-symbol', app.environment.daylight > 0.5 ? '☀' : '☾');
      this.set('distance-value', `${(app.view.distance / 1000).toFixed(0)} km`);
      this.set('survey-count', `${app.survey.count}/${app.survey.total}`);
      this.set('travelled', `${(app.player.travelled / 1000).toFixed(2)} km explored`);
      const stats = app.terrain.stats;
      this.set('debug', `${Math.round(fps)} FPS   ${stats.tiles} TILES   ${stats.objects.toLocaleString()} OBJECTS   ${app.kit.renderer.info.render.calls} DRAWS   ${app.kit.backendLabel}`);
      this.set('stream-state', stats.pending ? `STREAMING ${stats.pending}` : 'WORLD STREAM ACTIVE');
      this.$('stream-dot').classList.toggle('loading', !!stats.pending);
      if (this.menu === 'settings') this.set('settings-stats', `${stats.tiles} terrain sections · ${stats.objects.toLocaleString()} objects · ${stats.workers} workers · ${app.kit.backendLabel}`);
      const heading = (((-app.player.yaw) * 180 / Math.PI) % 360 + 360) % 360;
      this.drawCompass(heading, p);
      if (this.waypoint && Math.hypot(this.waypoint.x - p.x, this.waypoint.z - p.z) < 30 && app.playing) { this.waypoint = null; this.notice('Waypoint reached.'); }
      this.set('waypoint-label', this.waypoint ? `WAYPOINT  ${Math.round(Math.hypot(this.waypoint.x - p.x, this.waypoint.z - p.z)).toLocaleString()} m` : '');
    }
    if (elapsed - this.lastMini > 1 && !this.mini.busy) {
      const moved = Math.hypot(p.x - this.mini.center.x, p.z - this.mini.center.z);
      if (!this.mini.ready || moved > 320) this.mini.build(p.x, p.z, 4200);
      this.lastMini = elapsed;
    }
    if (elapsed - this.lastMap > 0.12) {
      this.lastMap = elapsed;
      if (!this.hidden) this.mini.draw(app.player, this.waypoint, app.survey.sites, false);
      if (this.menu === 'map') this.map.draw(app.player, this.waypoint, app.survey.sites, true);
    }
  }
  /** The heading strip, with the waypoint and the nearest unrecorded survey post marked. */
  drawCompass(heading, p) {
    const c = this.$('compass'); if (!c.getClientRects().length) return;
    const ctx = c.getContext('2d'), w = c.width / 2, h = c.height / 2;
    ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.clearRect(0, 0, w, h); ctx.textAlign = 'center'; ctx.font = '10px system-ui';
    for (let offset = -90; offset <= 90; offset += 5) {
      const deg = Math.round(heading / 5) * 5 + offset, delta = ((deg - heading + 540) % 360) - 180, x = w / 2 + delta * 2.45; if (x < 12 || x > w - 12) continue;
      const d = ((deg % 360) + 360) % 360, major = d % 45 === 0; ctx.globalAlpha = Math.max(0, 1 - Math.abs(delta) / 95); ctx.strokeStyle = '#f2efdf'; ctx.beginPath(); ctx.moveTo(x, major ? 23 : 28); ctx.lineTo(x, 33); ctx.stroke();
      if (major) { const labels = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' }; ctx.fillStyle = d === 0 ? '#eed2a1' : '#f2efdf'; ctx.fillText(labels[d], x, 15); }
    }
    const mark = (tx, tz, color, size) => {
      const bearing = (Math.atan2(tx - p.x, -(tz - p.z)) * 180 / Math.PI + 360) % 360;
      const delta = ((bearing - heading + 540) % 360) - 180, clamped = Math.max(-68, Math.min(68, delta)), x = w / 2 + clamped * 2.45;
      ctx.globalAlpha = Math.abs(delta) > 68 ? 0.5 : 1; ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(x, 36 - size); ctx.lineTo(x + size, 36); ctx.lineTo(x, 36 + size); ctx.lineTo(x - size, 36); ctx.closePath(); ctx.fill();
    };
    const open = this.app.survey.nearestOpen();
    if (open) mark(open.x, open.z, '#cfe3d6', 3);
    if (this.waypoint) mark(this.waypoint.x, this.waypoint.z, '#ffe3a0', 4);
    ctx.globalAlpha = 1; ctx.fillStyle = '#eed2a1'; ctx.beginPath(); ctx.moveTo(w / 2 - 3, 39); ctx.lineTo(w / 2 + 3, 39); ctx.lineTo(w / 2, 34); ctx.closePath(); ctx.fill();
  }
  /** The field journal: survey posts, landscapes, time in the field. */
  renderJournal() {
    const app = this.app, s = app.survey, p = app.player.position;
    this.$('journal-summary').innerHTML = [
      `<span><b>${s.count}</b> / ${s.total} posts recorded</span>`,
      `<span><b>${s.biomes.size}</b> / ${BIOMES.length} landscapes</span>`,
      `<span><b>${(app.player.travelled / 1000).toFixed(1)}</b> km explored</span>`,
      `<span><b>${formatDuration(s.playTime)}</b> in the field</span>`,
    ].join('');
    const banner = this.$('journal-banner');
    if (s.completedAt != null) {
      banner.hidden = false;
      banner.innerHTML = `<div class="eyebrow">SURVEY COMPLETE</div><strong>Every post in ${escapeHTML(app.generator.seedText)} is recorded.</strong><span>Finished after ${formatDuration(s.completedAt)} in the field${s.best != null ? ` · best ${formatDuration(s.best)}` : ''}.</span>`;
    } else if (s.best != null) {
      banner.hidden = false;
      banner.innerHTML = `<div class="eyebrow">SURVEY RECORD</div><span>Best complete survey of this world: ${formatDuration(s.best)}.</span>`;
    } else banner.hidden = true;
    this.$('journal-landscapes').innerHTML = BIOMES.map((name, i) => `<span class="chip${s.biomes.has(i) ? ' seen' : ''}">${s.biomes.has(i) ? '◆' : '◇'} ${name}</span>`).join('');
    const list = this.$('journal-list'); list.textContent = '';
    for (const site of s.sites) {
      const b = document.createElement('button'); b.type = 'button'; b.className = `journal-entry${site.found ? ' found' : ''}`;
      const dist = Math.hypot(site.x - p.x, site.z - p.z), far = dist >= 1000 ? `${(dist / 1000).toFixed(1)} km` : `${Math.round(dist)} m`;
      b.innerHTML = `<span class="dest-number">${String(site.index + 1).padStart(2, '0')}</span><span><strong>${escapeHTML(site.def.name)}</strong><small>${escapeHTML(site.def.landscape)} · ${site.found ? escapeHTML(site.def.note) : far}</small></span><span class="dest-arrow">${site.found ? 'Travel ↗' : 'Waypoint ◇'}</span>`;
      b.addEventListener('click', () => {
        if (site.found) {
          app.teleport({ x: site.x + 6, z: site.z + 8, yaw: Math.atan2(6, 8), pitch: -0.1, name: site.def.name });
        } else {
          this.waypoint = { x: site.x, z: site.z, name: site.def.name };
          this.notice(`Waypoint set: ${site.def.name}, ${far} away.`);
        }
        this.close();
      }, { signal: this.abort.signal });
      list.append(b);
    }
  }
  resetMaps() {
    this.mini.setGenerator(this.app.generator); this.map.setGenerator(this.app.generator); this.lastMini = -Infinity;
    this.$('seed').value = this.app.generator.seedText; this.waypoint = null;
  }
  dispose() { this.abort.abort(); clearTimeout(this.toastTimer); for (const off of this.unsubscribers) off(); }
}
