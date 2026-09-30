// ui.js — the HUD, compass, minimap and world map, the pause screen, dialogs
// (settings, map, journal, controls, trial results) and button prompts that
// follow the input device.
import { CONFIG, VIEW, LOCATIONS } from './terrain.js';
import { MEDALS, formatTime } from './quests.js';

const $ = (id) => document.getElementById(id);
const GAME_DIALOGS = 'dialog:not(.kit-menu)';
const OPEN_DIALOGS = 'dialog[open]:not(.kit-menu)';
const clock = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
const BIOMES = {
  hills: 'Rolling hills',
  forest: 'Forest',
  plains: 'Plains',
  swamp: 'Swamp',
  canyon: 'Canyon',
  mountain: 'Mountains',
  snow: 'Snowfields',
  desert: 'Desert',
};
const HEADINGS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/** Controls as each device sees them: [what it does, keyboard/mouse, gamepad, touch]. */
const CONTROLS = [
  ['Move', 'W A S D / arrows', 'Left stick', 'Left thumb stick'],
  ['Look', 'Mouse (click to capture) or drag', 'Right stick', 'Drag on the right'],
  ['Faster (boost / run)', 'Shift', 'LS or RB', 'Fast'],
  ['Fly up / jump', 'Space or E', 'A or RT', 'Up'],
  ['Fly down', 'Q or C', 'B or LT', 'Down'],
  ['Fly / walk', 'F', 'Y', 'Walk / Fly'],
  ['Lantern', 'L', 'X', 'Lamp'],
  ['Map', 'M', 'View (Back)', 'Map'],
  ['Journal', 'J', 'LB', 'Pause menu'],
  ['World settings', 'O', 'Pause menu › World', 'Pause menu › World'],
  ['Save a picture', 'V', 'Pause menu › World', 'Pause menu › World'],
  ['Graphics', 'F9', 'Pause menu › Graphics', 'Pause menu › Graphics'],
  ['Hide / show HUD', 'H', '—', '—'],
  ['Pause', 'Esc or P', 'Start', 'II'],
  ['Menus', 'Arrows · Enter · Esc', 'D-pad · A · B', 'Tap'],
];

class WorldMap {
  constructor(game) {
    this.game = game;
    this.size = 384;
    this.span = 22000;
    this.center = { x: 0, z: 0 };
    this.bitmap = document.createElement('canvas');
    this.bitmap.width = this.bitmap.height = this.size;
    this.bctx = this.bitmap.getContext('2d');
    this.mini = $('minimap');
    this.miniCtx = this.mini.getContext('2d');
    this.large = $('world-map');
    this.largeCtx = this.large.getContext('2d');
    this.rebuild();
  }

  rebuild() {
    this.row = 0;
    this.complete = false;
    this.pixels = new ImageData(this.size, this.size);
    this.previousHeights = new Float64Array(this.size).fill(NaN);
    this.bctx.fillStyle = '#355549';
    this.bctx.fillRect(0, 0, this.size, this.size);
  }

  /** Shade a few rows of the terrain bitmap each frame, within a small time budget. */
  build() {
    const p = this.game.player.position;
    if (Math.abs(p.x - this.center.x) > 8500 || Math.abs(p.z - this.center.z) > 8500) {
      this.center.x = Math.round(p.x / 5000) * 5000;
      this.center.z = Math.round(p.z / 5000) * 5000;
      this.rebuild();
    }
    if (this.complete) return;
    const field = this.game.field;
    const step = this.span / this.size;
    const start = performance.now();
    const firstRow = this.row;
    while (this.row < this.size && (this.row === firstRow || performance.now() - start < 2.5)) {
      let prev = NaN;
      const z = this.center.z + (this.row / this.size - 0.5) * this.span;
      for (let col = 0; col < this.size; col++) {
        const x = this.center.x + (col / this.size - 0.5) * this.span;
        const s = field.sample(x, z);
        const c = s.water ? [0.21, 0.49, 0.5] : field.color(s);
        const dx = Number.isFinite(prev) ? (s.height - prev) / step : 0;
        const dz = Number.isFinite(this.previousHeights[col]) ? (s.height - this.previousHeights[col]) / step : 0;
        const light = s.water ? 1 : Math.max(0.56, Math.min(1.3, 0.91 - dx * 0.18 - dz * 0.13));
        const contour = !s.water && s.height % 65 < 6 ? 0.86 : 1;
        const i = (this.row * this.size + col) * 4;
        for (let k = 0; k < 3; k++) this.pixels.data[i + k] = Math.max(0, Math.min(255, c[k] * light * contour * 255));
        this.pixels.data[i + 3] = 255;
        prev = s.height;
        this.previousHeights[col] = s.height;
      }
      this.row++;
    }
    this.bctx.putImageData(this.pixels, 0, 0);
    this.complete = this.row === this.size;
  }

  point(x, z, size) {
    return { x: ((x - this.center.x) / this.span + 0.5) * size, y: ((z - this.center.z) / this.span + 0.5) * size };
  }

  marker(ctx, x, y, yaw, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-yaw);
    ctx.scale(scale, scale);
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#122f2d';
    ctx.fillStyle = '#eff3be';
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(6, 7);
    ctx.lineTo(0, 4);
    ctx.lineTo(-6, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawMini() {
    const ctx = this.miniCtx;
    const w = this.mini.width;
    const player = this.game.player;
    const view = 2700;
    const s = this.point(player.position.x, player.position.z, this.size);
    const crop = (view / this.span) * this.size;
    ctx.clearRect(0, 0, w, w);
    ctx.fillStyle = '#325647';
    ctx.fillRect(0, 0, w, w);
    ctx.drawImage(this.bitmap, s.x - crop / 2, s.y - crop / 2, crop, crop, 0, 0, w, w);
    ctx.strokeStyle = '#e4ead91f';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w / 2, 30);
    ctx.lineTo(w / 2, w - 30);
    ctx.moveTo(30, w / 2);
    ctx.lineTo(w - 30, w / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w / 2, w / 2, w * 0.3, 0, Math.PI * 2);
    ctx.stroke();
    // The current target (next ring, nearest cairn) as a small dot at the edge or inside.
    const target = this.game.quests.target(player.position);
    if (target) {
      const k = w / view;
      let tx = (target.x - player.position.x) * k;
      let tz = (target.z - player.position.z) * k;
      const r = Math.hypot(tx, tz);
      const edge = w * 0.44;
      if (r > edge) {
        tx = (tx / r) * edge;
        tz = (tz / r) * edge;
      }
      ctx.fillStyle = target.kind === 'ring' ? '#ffe28a' : '#f4f7d8';
      ctx.strokeStyle = '#152e25';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(w / 2 + tx, w / 2 + tz, 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fill();
    }
    this.marker(ctx, w / 2, w / 2, player.yaw, 1.6);
  }

  drawLarge() {
    const ctx = this.largeCtx;
    const w = this.large.width;
    const quests = this.game.quests;
    const progress = quests.progress;
    ctx.drawImage(this.bitmap, 0, 0, w, w);
    ctx.strokeStyle = '#e0e8d118';
    ctx.lineWidth = 1;
    for (let i = 1; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo((i * w) / 8, 0);
      ctx.lineTo((i * w) / 8, w);
      ctx.moveTo(0, (i * w) / 8);
      ctx.lineTo(w, (i * w) / 8);
      ctx.stroke();
    }
    const inside = (p) => p.x >= 0 && p.y >= 0 && p.x <= w && p.y <= w;
    // Cairns around places you have discovered: hollow until found.
    for (const c of quests.cairns) {
      if (!progress.places.includes(LOCATIONS[c.place].id)) continue;
      const p = this.point(c.x, c.z, w);
      if (!inside(p)) continue;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.PI / 4);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#152e25';
      ctx.fillStyle = c.found ? LOCATIONS[c.place].color : 'transparent';
      ctx.beginPath();
      ctx.rect(-4.5, -4.5, 9, 9);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = LOCATIONS[c.place].color;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.restore();
    }
    // Sky trial gates, and the course while a trial runs.
    for (const course of quests.courses) {
      const active = quests.trial?.course === course;
      if (active) {
        ctx.strokeStyle = `${course.color}aa`;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        course.rings.forEach((r, i) => {
          const p = this.point(r.x, r.z, w);
          if (i) ctx.lineTo(p.x, p.y);
          else ctx.moveTo(p.x, p.y);
        });
        ctx.stroke();
        ctx.setLineDash([]);
      }
      const g = this.point(course.rings[0].x, course.rings[0].z, w);
      if (!inside(g)) continue;
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#152e25';
      ctx.beginPath();
      ctx.arc(g.x, g.y, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = course.color;
      ctx.stroke();
      ctx.font = '13px Georgia';
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#152e25';
      ctx.strokeText(course.name, g.x, g.y - 15);
      ctx.fillStyle = '#f7e6c8';
      ctx.fillText(course.name, g.x, g.y - 15);
    }
    for (const loc of LOCATIONS) {
      const p = this.point(loc.x, loc.z, w);
      if (!inside(p)) continue;
      const known = progress.places.includes(loc.id);
      ctx.fillStyle = known ? loc.color : '#0000';
      ctx.strokeStyle = '#152e25';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (!known) {
        ctx.strokeStyle = loc.color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.font = '15px Georgia';
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#152e25';
      ctx.strokeText(loc.name, p.x, p.y + 23);
      ctx.fillStyle = known ? '#f0edcd' : '#c9cbb4';
      ctx.fillText(loc.name, p.x, p.y + 23);
    }
    const player = this.game.player;
    const me = this.point(player.position.x, player.position.z, w);
    this.marker(ctx, me.x, me.y, player.yaw, 1.5);
  }

  pick(clientX, clientY) {
    const r = this.large.getBoundingClientRect();
    return {
      x: this.center.x + ((clientX - r.left) / r.width - 0.5) * this.span,
      z: this.center.z + ((clientY - r.top) / r.height - 0.5) * this.span,
    };
  }
}

export class UI {
  constructor(game) {
    this.game = game;
    this.kit = game.kit;
    this.map = new WorldMap(game);
    this.firstReady = false;
    this.text = new Map();
    this.miniTimer = 0;
    this.markerLeft = '';
    this.trialText = '';
    this.source = null;
    this.noticeTimer = 0;
    const on = (id, type, fn) => $(id).addEventListener(type, fn);

    on('enter-button', 'click', () => game.resume(true));
    on('settings-button', 'click', () => this.open('settings'));
    on('map-button', 'click', () => this.open('map-dialog'));
    on('minimap-button', 'click', () => this.open('map-dialog'));
    on('journal-button', 'click', () => this.open('journal-dialog'));
    on('help-button', 'click', () => this.open('help-dialog'));
    on('mode-button', 'click', () => game.toggleMode());
    on('lamp-button', 'click', () => game.toggleLantern());
    on('menu-map', 'click', () => this.open('map-dialog'));
    on('menu-journal', 'click', () => this.open('journal-dialog'));
    on('menu-settings', 'click', () => this.open('settings'));
    on('menu-help', 'click', () => this.open('help-dialog'));
    on('menu-graphics', 'click', () => this.kit.menu.open());
    on('graphics-button', 'click', () => this.kit.menu.open());
    on('menu-abandon', 'click', () => {
      game.quests.abortTrial('Trial abandoned.');
      this.state(false);
    });
    on('quality', 'change', (e) => {
      game.setView(e.target.value);
      this.notice(`${VIEW[e.target.value]?.label || 'Balanced'} view distance.`);
    });
    on('time-slider', 'input', (e) => {
      game.lighting.hours = Number(e.target.value);
      $('time-output').value = clock(game.lighting.hours);
    });
    on('cycle', 'change', (e) => (game.lighting.cycle = e.target.checked));
    on('haze', 'change', (e) => (game.haze = e.target.checked));
    on('show-stats', 'change', (e) => {
      game.showStats = e.target.checked;
      $('fps').hidden = !game.showStats;
    });
    on('sound', 'change', (e) => {
      game.sound.setEnabled(e.target.checked);
      if (e.target.checked) {
        game.sound.start();
        game.sound.play('toggle');
      }
    });
    on('fly-speed', 'input', (e) => {
      game.player.speedMultiplier = Number(e.target.value);
      $('speed-output').value = this.speedLabel(game.player.speedMultiplier);
    });
    on('save-button', 'click', () => game.save(true));
    on('home-button', 'click', () => {
      this.closeAll();
      game.travel({ ...LOCATIONS[0], name: LOCATIONS[0].name });
    });
    on('photo-button', 'click', () => {
      this.closeAll();
      game.capture();
    });
    on('new-seed', 'click', () => {
      const seed = $('world-seed').value.trim();
      if (!seed) {
        this.notice('Enter a world seed.');
        return;
      }
      this.closeAll();
      game.resetSeed(seed);
      this.map.rebuild();
      this.syncSettings();
      this.notice('New terrain is loading.');
    });
    // Enter in the seed field applies it (the kit leaves text fields to the browser).
    on('world-seed', 'keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        $('new-seed').click();
      }
    });
    on('world-map', 'click', (e) => {
      const target = this.map.pick(e.clientX, e.clientY);
      this.closeAll();
      game.travel({ ...target, name: 'your chosen spot' });
    });
    on('retry-button', 'click', () => location.reload());
    on('results-retry', 'click', () => {
      const id = this.lastResults?.course.id;
      this.closeAll();
      if (id) game.quests.prepareTrial(id);
    });
    on('results-continue', 'click', () => {
      this.closeAll();
      game.resume(true);
    });

    for (const button of document.querySelectorAll('[data-close]')) {
      button.addEventListener('click', () => button.closest('dialog').close());
    }
    // Only the game's own dialogs: the kit's settings panel is a <dialog> too and closes itself.
    for (const dialog of document.querySelectorAll(GAME_DIALOGS)) {
      // A click on the backdrop closes the dialog.
      dialog.addEventListener('click', (e) => {
        if (e.target !== dialog) return;
        const r = dialog.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();
      });
      // However it closed (button, Escape in a text field, backdrop), the next frame starts clean.
      dialog.addEventListener('close', () => this.kit.input.settle());
    }
    for (const loc of LOCATIONS) {
      const b = document.createElement('button');
      b.className = 'destination';
      b.style.setProperty('--destination', loc.color);
      b.textContent = loc.name;
      const small = document.createElement('small');
      small.textContent = loc.biome;
      b.append(small);
      b.addEventListener('click', () => {
        this.closeAll();
        game.travel({ ...loc, altitude: loc.id === 'alpine' ? 190 : 90 });
      });
      $('destinations').append(b);
    }

    game.events.on('notice', (text) => this.notice(text));
    game.events.on('player:mode', () => this.updateMode());
    game.events.on('journal', () => {
      if ($('journal-dialog').open) this.renderJournal();
    });
    this.kit.input.onSourceChange((src) => this.setSource(src));
    this.setSource(this.kit.input.source);
    this.syncSettings();
    this.updateMode();
  }

  speedLabel(v) {
    return `${Number(v).toFixed(2).replace(/0$/, '')}×`;
  }

  /** Write text only when it changed (no layout work for identical HUD values). */
  set(id, value) {
    if (this.text.get(id) === value) return;
    this.text.set(id, value);
    $(id).textContent = value;
  }

  topDialog() {
    const open = document.querySelectorAll(OPEN_DIALOGS);
    return open.length ? open[open.length - 1] : null;
  }

  open(id) {
    const game = this.game;
    game.pause();
    this.closeAll();
    this.syncSettings();
    if (id === 'map-dialog') this.map.drawLarge();
    if (id === 'journal-dialog') this.renderJournal();
    if (id === 'help-dialog') this.renderHelp();
    $(id).showModal();
  }

  toggle(id) {
    if ($(id).open) $(id).close();
    else this.open(id);
  }

  closeAll() {
    for (const d of document.querySelectorAll(OPEN_DIALOGS)) d.close();
  }

  /** Playing (HUD, no menu) or paused (the entry screen with its menu). */
  state(playing) {
    const game = this.game;
    $('entry').hidden = playing;
    document.body.classList.toggle('playing', playing);
    if (playing) document.body.classList.remove('hud-hidden');
    this.kit.touch?.suspend(!playing, 'pause');
    $('entry-menu').hidden = !game.started;
    $('menu-abandon').hidden = !game.quests.trialActive;
    if (game.started && !playing) {
      this.set('entry-caption', game.quests.trialActive ? 'The clock is stopped.' : 'Take your time.');
      this.set('entry-help', this.source === 'gamepad' ? 'A to continue · B to close menus' : this.source === 'touch' ? 'Tap Continue exploring to return.' : 'Enter or Esc to continue.');
    } else if (!game.started) {
      // A returning explorer sees how far the journal has come.
      const sum = game.returning ? game.quests.summary() : null;
      const lead = this.source === 'gamepad' ? 'Press A to enter. ' : '';
      this.set(
        'entry-help',
        sum
          ? `${lead}Places ${sum.places}/${sum.placesTotal} · Cairns ${sum.cairns}/${sum.cairnsTotal} · Trials ${sum.trials}/${sum.trialsTotal}`
          : `${lead}Fly over the valley. Choose your own direction.`
      );
    }
    this.refreshEnter();
  }

  refreshEnter() {
    const game = this.game;
    const ready = game.ready && !game.failed;
    $('enter-button').disabled = !ready;
    this.set('enter-label', !ready ? 'Preparing world' : game.started ? 'Continue exploring' : game.returning ? 'Resume exploring' : 'Enter world');
  }

  ready() {
    this.refreshEnter();
    if (!this.firstReady) {
      this.firstReady = true;
      this.kit.loading.progress(1, 'Ready');
      this.kit.loading.done();
    }
  }

  notice(text) {
    const el = $('notice');
    el.textContent = text;
    el.classList.add('visible');
    clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => el.classList.remove('visible'), 3400);
  }

  syncSettings() {
    const game = this.game;
    $('quality').value = game.viewName;
    $('time-slider').value = game.lighting.hours;
    $('time-output').value = clock(game.lighting.hours);
    $('cycle').checked = game.lighting.cycle;
    $('haze').checked = game.haze;
    $('fly-speed').value = game.player.speedMultiplier;
    $('speed-output').value = this.speedLabel(game.player.speedMultiplier);
    $('show-stats').checked = game.showStats;
    $('fps').hidden = !game.showStats;
    $('sound').checked = game.sound.enabled;
    $('world-seed').value = game.field.seed;
    this.set('seed-label', game.field.seed === CONFIG.seed ? 'WORLD 1048' : `SEED ${game.field.seed.slice(0, 20)}`);
    this.set('distance-label', `${(game.view.distance / 1000).toFixed(1)} KM VIEW`);
  }

  updateMode() {
    const player = this.game.player;
    const fly = player.mode === 'fly';
    this.set('mode-label', fly ? 'Free flight' : player.swimming ? 'Swimming' : 'On foot');
    if (this.shownMode === player.mode) return;
    this.shownMode = player.mode;
    this.set('mode-button-label', fly ? 'Walk' : 'Fly');
    this.kit.touch?.setLabel('mode', fly ? 'Walk' : 'Fly');
    // On foot there is nothing to descend to: the Down button goes away.
    this.kit.touch?.setShown('down', fly);
  }

  lanternChanged(on) {
    $('lamp-button').setAttribute('aria-pressed', String(on));
    this.kit.touch?.button('lantern')?.classList.toggle('is-on', on);
  }

  /** Button prompts for the device in use. */
  setSource(src) {
    if (src === this.source) return;
    this.source = src;
    document.body.dataset.input = src;
    const hint = $('control-hint');
    const rows =
      src === 'gamepad'
        ? [['LS', 'Move'], ['RS', 'Look'], ['A', 'Up / jump'], ['B', 'Down'], ['Y', 'Fly / walk'], ['Start', 'Pause']]
        : [['W A S D', 'Move'], ['Shift', 'Faster'], ['Q E', 'Down / up'], ['Esc', 'Pause']];
    hint.replaceChildren(
      ...rows.map(([keys, label]) => {
        const span = document.createElement('span');
        for (const k of keys.split(' ')) {
          const kbd = document.createElement('kbd');
          kbd.textContent = k;
          span.append(kbd);
        }
        span.append(` ${label}`);
        return span;
      })
    );
    for (const el of document.querySelectorAll('.toolbar kbd')) el.hidden = src !== 'keyboard';
    if ($('help-dialog').open) this.renderHelp();
    if (!this.game.playing) this.state(false);
  }

  renderHelp() {
    const col = this.source === 'gamepad' ? 2 : this.source === 'touch' ? 3 : 1;
    const list = $('controls-list');
    list.replaceChildren(
      ...CONTROLS.filter((row) => row[col] !== '—').map((row) => {
        const div = document.createElement('div');
        const dt = document.createElement('dt');
        dt.textContent = row[0];
        const dd = document.createElement('dd');
        dd.textContent = row[col];
        div.append(dt, dd);
        return div;
      })
    );
    this.set('help-device', this.source === 'gamepad' ? 'GAMEPAD' : this.source === 'touch' ? 'TOUCH' : 'KEYBOARD & MOUSE');
    this.set(
      'help-note',
      this.source === 'touch'
        ? 'Use the left thumb stick to move and drag the view to look. Up, Down and Fast sit on the right; the map, lantern and pause are along the top.'
        : this.source === 'gamepad'
          ? 'In menus, the D-pad moves between buttons, A selects and B goes back. Fly through a glowing start gate to begin a sky trial.'
          : 'Click the world to capture the mouse; if that is not available, drag to look. Fly through a glowing start gate to begin a sky trial.'
    );
  }

  renderJournal() {
    const quests = this.game.quests;
    const progress = quests.progress;
    const sum = quests.summary();
    this.set('journal-summary', `Places ${sum.places}/${sum.placesTotal} · Cairns ${sum.cairns}/${sum.cairnsTotal} · Trials ${sum.trials}/${sum.trialsTotal}`);
    const places = $('journal-places');
    places.replaceChildren(
      ...LOCATIONS.map((loc, li) => {
        const known = progress.places.includes(loc.id);
        const found = quests.cairns.filter((c) => c.place === li && c.found).length;
        const row = document.createElement('li');
        row.className = `journal-place${known ? ' is-known' : ''}`;
        row.style.setProperty('--destination', loc.color);
        const name = document.createElement('span');
        name.className = 'journal-name';
        name.textContent = known ? loc.name : 'Undiscovered place';
        const small = document.createElement('small');
        small.textContent = known ? loc.biome : 'Explore to find it';
        name.append(small);
        const pips = document.createElement('span');
        pips.className = 'journal-pips';
        pips.setAttribute('aria-label', `${found} of 3 cairns found`);
        for (let i = 0; i < 3; i++) {
          const pip = document.createElement('i');
          if (i < found) pip.className = 'is-found';
          pips.append(pip);
        }
        row.append(name, pips);
        return row;
      })
    );
    const trials = $('journal-trials');
    trials.replaceChildren(
      ...quests.courses.map((course) => {
        const best = progress.trials[course.id];
        const medal = Number.isFinite(best) ? quests.medalFor(course, best) : null;
        const row = document.createElement('div');
        row.className = 'journal-trial';
        row.style.setProperty('--destination', course.color);
        const info = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = course.name;
        const blurb = document.createElement('small');
        const parts = [course.blurb, `${course.rings.length - 1} rings · ${(course.length / 1000).toFixed(1)} km`];
        parts.push(Number.isFinite(best) ? `Best ${formatTime(best)}${medal ? ` · ${medal.label}` : ''}` : 'Not flown yet');
        parts.push(`Gold under ${formatTime(course.par.gold)}`);
        blurb.textContent = parts.join(' · ');
        info.append(title, blurb);
        const go = document.createElement('button');
        go.className = 'secondary';
        go.textContent = 'Fly to start';
        go.addEventListener('click', () => {
          this.closeAll();
          this.game.quests.prepareTrial(course.id);
        });
        row.append(info, go);
        return row;
      })
    );
  }

  showResults(r) {
    this.lastResults = r;
    this.set('results-title', r.course.name);
    this.set('results-time', formatTime(r.total));
    const detail = [`Flight ${formatTime(r.time)}`];
    if (r.missed) detail.push(`${r.missed} missed ${r.missed === 1 ? 'ring' : 'rings'} +${r.penalty} s`);
    else detail.push('Every ring');
    this.set('results-detail', detail.join(' · '));
    this.set('results-best', r.record ? 'New best time' : `Best ${formatTime(r.best)}`);
    const medal = $('results-medal');
    medal.dataset.medal = r.medal?.id || 'none';
    this.set('results-medal', r.medal ? `${r.medal.label} medal` : `Bronze under ${formatTime(r.course.par.bronze)}`);
    const next = r.medal ? MEDALS[MEDALS.indexOf(r.medal) - 1] : MEDALS[MEDALS.length - 1];
    this.set('results-next', next && r.medal ? `${next.label} under ${formatTime(r.course.par[next.id])}` : r.medal ? 'The best there is.' : 'Boost with Fast between rings.');
    this.open('results-dialog');
  }

  trialChanged() {
    const trial = this.game.quests.trial;
    $('trial-hud').hidden = !trial;
    $('menu-abandon').hidden = !trial;
    this.trialText = '';
    if (trial) this.set('trial-name', trial.course.name.toUpperCase());
  }

  /** Every frame: trial clock, compass marker, minimap. */
  frame(dt) {
    const game = this.game;
    const quests = game.quests;
    const trial = quests.trial;
    if (trial) {
      const tenths = trial.started ? Math.floor((trial.time + trial.penalty) * 10) : -1;
      const key = `${tenths}|${trial.next}`;
      if (key !== this.trialText) {
        this.trialText = key;
        this.set('trial-time', trial.started ? formatTime(trial.time + trial.penalty) : 'Ready');
        this.set('trial-rings', trial.started ? `Ring ${Math.min(trial.next, trial.course.rings.length - 1)} / ${trial.course.rings.length - 1}` : 'Fly through the start gate');
        const best = quests.progress.trials[trial.course.id];
        this.set('trial-best', Number.isFinite(best) ? `Best ${formatTime(best)}` : `Gold ${formatTime(trial.course.par.gold)}`);
      }
    }

    // Compass marker: where the next ring or the nearest cairn lies, within ±90° of the view.
    const p = game.player.position;
    const target = quests.target(p);
    let left = '';
    if (target) {
      const bearing = Math.atan2(target.x - p.x, -(target.z - p.z));
      let rel = bearing + game.player.yaw;
      rel = Math.atan2(Math.sin(rel), Math.cos(rel));
      if (Math.abs(rel) < Math.PI / 2) left = `${(50 + (rel / (Math.PI / 2)) * 50).toFixed(1)}%`;
      const kind = target.kind;
      if (this.markerKind !== kind) {
        this.markerKind = kind;
        $('compass-marker').dataset.kind = kind;
      }
    }
    if (left !== this.markerLeft) {
      this.markerLeft = left;
      const m = $('compass-marker');
      m.hidden = !left;
      if (left) m.style.left = left;
    }

    this.miniTimer -= dt;
    this.map.build();
    if (this.miniTimer <= 0) {
      this.miniTimer = 1 / 30;
      this.map.drawMini();
      if ($('map-dialog').open) this.map.drawLarge();
    }
  }

  /** Five times a second: place names, coordinates, clock, loading state. */
  update() {
    const game = this.game;
    const p = game.player.position;
    const s = game.field.sample(p.x, p.z);
    let near = LOCATIONS[0];
    let nearDist = Infinity;
    for (const loc of LOCATIONS) {
      const d = Math.hypot(loc.x - p.x, loc.z - p.z);
      if (d < nearDist) {
        nearDist = d;
        near = loc;
      }
    }
    this.set('location-name', nearDist < 2300 ? near.name : s.water ? 'Open Water' : BIOMES[s.biome]);
    this.set('biome-label', s.water && s.biome !== 'swamp' ? 'RIVERS & LAKES' : BIOMES[s.biome].toUpperCase());
    this.set(
      'coordinates',
      `${Math.abs(Math.round(p.x)).toLocaleString()} ${p.x < 0 ? 'W' : 'E'} / ${Math.abs(Math.round(p.z)).toLocaleString()} ${p.z < 0 ? 'N' : 'S'}`
    );
    this.set('altitude', `${Math.round(p.y).toLocaleString()} M`);
    const deg = ((((-game.player.yaw * 180) / Math.PI) % 360) + 360) % 360;
    const h = Math.round(deg / 45) % 8;
    this.set('heading', HEADINGS[h]);
    this.set('compass-left', HEADINGS[(h + 7) % 8]);
    this.set('compass-right', HEADINGS[(h + 1) % 8]);
    this.set('bearing', `${String(Math.round(deg) % 360).padStart(3, '0')}°`);
    const time = clock(game.lighting.hours);
    this.set('clock', time);
    if ($('settings').open) {
      $('time-output').value = time;
      if (game.lighting.cycle && document.activeElement !== $('time-slider')) $('time-slider').value = game.lighting.hours;
    }
    if (game.showStats) {
      this.set('fps', `${Math.round(game.fps)} FPS · ${game.world.stats.tiles} tiles · ${game.world.stats.objects.toLocaleString()} objects`);
    }
    const queued = game.world.stats.queued;
    $('stream-status').hidden = game.ready && !game.streamingPaused && queued === 0;
    this.set('stream-status', !game.ready || game.streamingPaused ? 'Loading terrain…' : 'Loading distant terrain…');
    if (!game.ready) {
      this.refreshEnter();
      if (!this.firstReady) {
        const tiles = game.world.stats.tiles;
        this.kit.loading.progress(
          0.62 + game.world.progress(p) * 0.36,
          tiles < 16 ? 'Shaping the land' : queued > 70 ? 'Growing the forests' : 'Opening the view'
        );
      }
    }
    this.updateMode();
  }
}
