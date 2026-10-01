import { formatTime, boundsOf } from './math.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Button prompts for the HUD controls bar, per input device. */
const PROMPTS = {
  keyboard: { engine: 'E', belt: 'B', gear: 'N', parking: 'P', front: 'F', rear: 'G', kneel: 'K', ramp: 'R', mirror: 'Q', 'indicator-left': 'Z', 'indicator-right': 'C', camera: 'V', help: 'F2', pause: 'Esc', map: 'M' },
  gamepad: { engine: 'D↑', belt: 'D↓', gear: 'X', parking: 'Y', front: 'A', rear: 'B', kneel: 'D←', ramp: 'D→', mirror: 'R3', 'indicator-left': 'LB', 'indicator-right': 'RB', camera: 'View', help: 'Menu', pause: 'Menu', map: 'Menu' },
};
const CONTROL_STATE = {
  engine: (b) => b.engine, belt: (b) => b.belt, gear: (b) => b.gear === 'D', parking: (b) => b.parking, front: (b) => b.frontTarget, rear: (b) => b.rearTarget,
  kneel: (b) => b.kneelTarget, ramp: (b) => b.rampTarget, 'indicator-left': (b) => b.indicator === 'left', 'indicator-right': (b) => b.indicator === 'right',
};
const FOCUSABLE = 'button, select, input, a[href]';

export class UI {
  constructor(world, callbacks) {
    this.callbacks = callbacks; this.modalOpen = false; this.modalKind = null; this.toastUntil = 0; this.subtitleUntil = 0; this.dialogueId = null; this.lastUI = 0; this.mapExpanded = false; this.source = 'keyboard';
    this.cache = new Map(); this.controlButtons = [...document.querySelectorAll('#controls button')];
    document.querySelectorAll('[data-action]').forEach((el) => el.addEventListener('click', () => callbacks.action(el.dataset.action)));
    $('modal-close').onclick = () => this.closeModal(); $('modal').addEventListener('click', (e) => { if (e.target === $('modal')) this.closeModal(); });
    this.setWorld(world);
  }
  /** Write text only when it changed (no DOM churn every HUD tick). */
  text(id, value) { value = String(value); if (this.cache.get(id) === value) return; this.cache.set(id, value); $(id).textContent = value; }
  setWorld(world) {
    this.world = world; const d = world.data; const trained = world.meta.quality === 'training-reconstruction';
    $('menu-route').textContent = d.route.number; $('menu-title').textContent = world.meta.title; $('menu-subtitle').textContent = world.meta.subtitle || d.route.headsign;
    $('route-length').textContent = `${(world.route.length / 1000).toFixed(1)} KM · ${world.stops.length} STOPS`;
    $('scenario-note').textContent = trained ? 'Training reconstruction, not an official HSL line. Real street names; approximate layout, authored stops and scenery.' : 'Imported HSL / OpenStreetMap corridor. Verified source coordinates; inferred lane positions, scenery and signal timings. See Data & realism.';
    $('data-tag').textContent = trained ? 'TRAINING RECONSTRUCTION · NOT AN OFFICIAL HSL ROUTE' : 'HSL + © OPENSTREETMAP CONTRIBUTORS · INFERRED SCENERY'; $('route-number').textContent = d.route.number;
    this.cache.clear(); this.dialogueId = null;
  }
  showMenu() { $('hud').classList.add('hidden'); $('menu').classList.remove('hidden'); this.closeModal(false); requestAnimationFrame(() => $('begin').focus({ preventScroll: true })); }
  begin() { $('menu').classList.add('hidden'); $('hud').classList.remove('hidden'); this.cache.clear(); this.dialogueId = null; document.activeElement?.blur?.(); }
  get menuOpen() { return !$('menu').classList.contains('hidden'); }
  get dialogueOpen() { return !$('dialogue').classList.contains('hidden'); }
  toast(message, type = 'info') { if (!message) return; $('toast').textContent = message; $('toast').className = type === 'violation' ? 'violation' : ''; this.toastUntil = performance.now() + 5500; }
  events(events) {
    for (const e of events) {
      if (e.type === 'complete') { this.callbacks.results(); continue; }
      if (['driver', 'passenger', 'ambient', 'announcement', 'alighted'].includes(e.type) && e.message) {
        $('subtitle').classList.remove('hidden'); $('subtitle').querySelector('span').textContent = e.speaker || (e.type === 'driver' ? 'Driver' : e.type === 'announcement' ? 'On-board announcement' : 'Passenger');
        $('subtitle').querySelector('p').textContent = e.message; this.subtitleUntil = performance.now() + 6000;
      } else if (!['interaction', 'boarded', 'switch', 'horn', 'pause', 'interaction-close', 'impact', 'departed'].includes(e.type)) this.toast(e.message, e.type);
    }
  }
  /** Keyboard, controller or touch prompts on the controls bar and in the dialogue. */
  setSource(source) {
    this.source = source; document.documentElement.dataset.input = source; const map = PROMPTS[source] || PROMPTS.keyboard;
    for (const el of document.querySelectorAll('[data-action]')) { const k = el.querySelector('kbd'); if (k && map[el.dataset.action]) k.textContent = map[el.dataset.action]; }
    $('choices-hint').textContent = source === 'gamepad' ? 'D-pad to choose · A to answer' : source === 'touch' ? 'Tap a reply' : 'Press 1, 2 or 3';
  }
  update(sim, graphics, kitLabel) {
    const now = performance.now(); if (now - this.lastUI < 90) return; this.lastUI = now;
    const b = sim.bus, s = sim.currentStop, dist = s ? Math.max(0, s.s - sim.routePosition) : 0;
    const start = this.world.data.route.startTime || '08:15:00'; const parts = typeof start === 'string' ? start.split(':').map(Number) : [], t0 = typeof start === 'number' ? start : parts[0] * 3600 + parts[1] * 60 + (parts[2] || 0);
    this.text('speed', Math.round(sim.speed)); this.text('limit', sim.speedLimit);
    const over = sim.speed > sim.speedLimit + 1; if (this.cache.get('over') !== over) { this.cache.set('over', over); $('speed').style.color = over ? '#f2b799' : ''; }
    this.text('gear', b.parking ? 'P' : b.gear); this.text('ready', b.starting ? 'STARTING' : b.engine ? (sim.immobilized ? 'INTERLOCK' : 'READY') : 'POWER OFF');
    this.text('battery', `${Math.round(b.battery)}%`); this.text('riders', sim.passengers.length); this.text('score', sim.overall); this.text('clock', formatTime(t0 + sim.time));
    this.text('schedule', sim.departureWait > 0 && sim.docking().ok ? `Departure in ${Math.ceil(sim.departureWait)} s` : sim.arrivalDelta > 60 ? `${Math.floor(sim.arrivalDelta / 60)} min after planned arrival` : 'Safety before the schedule');
    this.text('stop-name', s?.name || 'End of the line'); this.text('stop-distance', dist < 15 ? 'At stop' : dist > 1000 ? `${(dist / 1000).toFixed(1)} km` : `${Math.round(dist)} m`);
    this.text('stop-count', `${Math.min(sim.stopIndex + 1, this.world.stops.length)} / ${this.world.stops.length}`); this.text('street-name', sim.roadInfo?.road.name || 'Off mapped road');
    this.text('status-text', sim.status); $('stop-request').classList.toggle('hidden', !sim.stopRequested);
    this.text('telemetry', `${Math.round(graphics.fps)} FPS · ${graphics.calls} calls · ${kitLabel} · ${graphics.mode.toUpperCase()} · F2 help`);
    for (const el of this.controlButtons) { const fn = CONTROL_STATE[el.dataset.action]; const state = !!(fn && fn(b)); if (el.classList.contains('active') !== state) { el.classList.toggle('active', state); el.setAttribute('aria-pressed', String(state)); } }
    if (now > this.toastUntil) $('toast').classList.add('hidden'); else $('toast').classList.remove('hidden');
    if (now > this.subtitleUntil) $('subtitle').classList.add('hidden');
    const interaction = sim.interaction;
    if (interaction) {
      $('dialogue').classList.remove('hidden'); $('route-panel').classList.add('hidden'); $('subtitle').classList.add('hidden');
      if (this.dialogueId !== interaction) {
        this.dialogueId = interaction; $('speaker').textContent = interaction.speaker; $('dialogue-text').textContent = interaction.text; $('choices').replaceChildren();
        interaction.choices.forEach((c, i) => { const button = document.createElement('button'), key = document.createElement('kbd'), text = document.createElement('span'); key.textContent = i + 1; text.textContent = c.text; button.append(key, text); button.onclick = () => this.callbacks.action(`reply-${i}`); $('choices').append(button); });
      }
      for (const btn of $('choices').children) btn.disabled = sim.speed > 0.5;
    } else if (this.dialogueId !== null || $('route-panel').classList.contains('hidden')) {
      if (this.dialogueId && $('choices').contains(document.activeElement)) document.activeElement.blur();
      $('dialogue').classList.add('hidden'); $('route-panel').classList.remove('hidden'); this.dialogueId = null;
    }
    const mirrors = graphics.mirrorsActive; for (const el of document.querySelectorAll('.mirror-label')) el.classList.toggle('hidden', !mirrors);
    this.drawMap($('mini-map'), sim, false); if (this.mapExpanded && $('full-map')) this.drawMap($('full-map'), sim, true);
  }
  drawMap(canvas, sim, full = false) {
    const ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height; ctx.fillStyle = '#112631'; ctx.fillRect(0, 0, w, h);
    const world = this.world, bus = [sim.bus.x, sim.bus.z], bounds = full ? boundsOf(world.route.points) : [bus[0] - 225, bus[1] - 165, bus[0] + 225, bus[1] + 165];
    const factor = Math.min((w - 40) / (bounds[2] - bounds[0] + 50), (h - 32) / (bounds[3] - bounds[1] + 50)), cx = (bounds[0] + bounds[2]) / 2, cz = (bounds[1] + bounds[3]) / 2;
    const px = (q) => w / 2 + (q[0] - cx) * factor, py = (q) => h / 2 + (q[1] - cz) * factor;
    const drawLine = (points, color, width) => { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.beginPath(); points.forEach((q, i) => (i ? ctx.lineTo(px(q), py(q)) : ctx.moveTo(px(q), py(q)))); ctx.stroke(); };
    ctx.fillStyle = '#213944';
    for (const b of world.buildings) {
      if (b.bounds[0] > bounds[2] + 50 || b.bounds[2] < bounds[0] - 50 || b.bounds[1] > bounds[3] + 50 || b.bounds[3] < bounds[1] - 50) continue;
      ctx.beginPath(); b.footprint.forEach((q, i) => (i ? ctx.lineTo(px(q), py(q)) : ctx.moveTo(px(q), py(q)))); ctx.closePath(); ctx.fill();
    }
    for (const road of world.roads) drawLine(road.points, '#3b5460', Math.max(1, road.width * factor)); drawLine(world.route.points, '#74d0d0', full ? 4 : 5);
    world.stops.forEach((s, i) => {
      const x = px(s.dock), y = py(s.dock); ctx.beginPath(); ctx.arc(x, y, i === sim.stopIndex ? 6 : 4, 0, Math.PI * 2); ctx.fillStyle = i < sim.stopIndex ? '#5e8e89' : i === sim.stopIndex ? '#f6e9bc' : '#d4e9e5'; ctx.fill();
      ctx.strokeStyle = '#183941'; ctx.lineWidth = 2; ctx.stroke(); if (full) { ctx.font = '18px Arial'; ctx.fillStyle = '#d9e7e9'; ctx.fillText(`${i + 1} · ${s.name}`, x + 12, y - 8); }
    });
    ctx.save(); ctx.translate(px(bus), py(bus)); ctx.rotate(sim.bus.yaw); ctx.fillStyle = '#f3eddb'; ctx.strokeStyle = '#132b38'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(8, 9); ctx.lineTo(0, 5); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    ctx.font = full ? '18px Arial' : '17px Arial'; ctx.fillStyle = '#89a9b6'; ctx.fillText('N ↑', w - 47, 26);
  }
  // ---- modals
  openModal(html, { pause = true, kind = 'info' } = {}) {
    if (pause && !this.modalOpen) this.callbacks.hold();
    $('modal-content').innerHTML = html; $('modal').classList.remove('hidden'); this.modalOpen = true; this.modalKind = kind; this.callbacks.modal?.(true);
    const first = $('modal-content').querySelector('.primary') || $('modal-close'); requestAnimationFrame(() => first.focus({ preventScroll: true }));
  }
  closeModal(resume = true) {
    if (!this.modalOpen) return;
    this.mapExpanded = false; this.modalOpen = false; this.modalKind = null; $('modal').classList.add('hidden'); document.activeElement?.blur?.();
    this.callbacks.modal?.(false); if (resume) this.callbacks.unhold();
  }
  help(source = this.source) {
    const keyboard = `<div class="control-table"><div>Throttle / service brake<span><kbd>W</kbd><kbd>S</kbd></span></div><div>Steer / emergency brake<span><kbd>A</kbd><kbd>D</kbd><kbd>Space</kbd></span></div><div>Power / driver belt<span><kbd>E</kbd><kbd>B</kbd></span></div><div>Drive–neutral / reverse<span><kbd>N</kbd><kbd>X</kbd></span></div><div>Front / middle door<span><kbd>F</kbd><kbd>G</kbd></span></div><div>Parking / kneeling / ramp<span><kbd>P</kbd><kbd>K</kbd><kbd>R</kbd></span></div><div>Left / right indicator<span><kbd>Z</kbd><kbd>C</kbd></span></div><div>Mirrors / next-stop announcement<span><kbd>Q</kbd><kbd>T</kbd></span></div><div>Lights / wipers / horn<span><kbd>L</kbd><kbd>U</kbd><kbd>H</kbd></span></div><div>Camera / map / pause<span><kbd>V</kbd><kbd>M</kbd><kbd>Esc</kbd></span></div><div>Answer a rider<span><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd></span></div><div>Look around / centre view<span><kbd>drag</kbd><kbd>double-click</kbd></span></div></div>`;
    const gamepad = `<div class="control-table"><div>Throttle / brake<span><kbd>RT</kbd><kbd>LT</kbd></span></div><div>Steer / look around<span><kbd>L stick</kbd><kbd>R stick</kbd></span></div><div>Power / driver belt<span><kbd>D↑</kbd><kbd>D↓</kbd></span></div><div>Drive–neutral / reverse<span><kbd>X</kbd><kbd>hold X</kbd></span></div><div>Front / middle door<span><kbd>A</kbd><kbd>B</kbd></span></div><div>Parking brake<span><kbd>Y</kbd></span></div><div>Kneel / ramp<span><kbd>D←</kbd><kbd>D→</kbd></span></div><div>Left / right indicator<span><kbd>LB</kbd><kbd>RB</kbd></span></div><div>Mirror check / horn<span><kbd>R3</kbd><kbd>L3</kbd></span></div><div>Camera / pause menu<span><kbd>View</kbd><kbd>Menu</kbd></span></div><div>Answer a rider<span><kbd>D↑↓</kbd><kbd>A</kbd></span></div><div>Lights, wipers, map, announcements<span><kbd>Menu</kbd></span></div></div>`;
    const touch = `<div class="control-table"><div>Steer, throttle and brake<span><kbd>left thumb stick</kbd></span></div><div>Look around<span><kbd>drag on the right</kbd></span></div><div>Bus controls<span><kbd>buttons bar</kbd></span></div><div>Pause, map and cab switches<span><kbd>Ⅱ</kbd></span></div></div>`;
    const tabs = [['keyboard', 'Keyboard & mouse', keyboard], ['gamepad', 'Controller', gamepad], ['touch', 'Touch', touch]];
    const order = [...tabs].sort((a, b) => (a[0] === source ? -1 : b[0] === source ? 1 : 0));
    this.openModal(`<div class="eyebrow">DRIVER'S HANDBOOK</div><h2>A calm start. A safe departure.</h2><div class="checklist"><p>Start the bus (power), fasten the belt, and leave the parking brake applied. The bus starts already aligned at the first stop.</p><p>Open the front door. Answer the first rider. Wait for boarding and any requested settling time. Open the middle door for alighting.</p><p>Once service is complete, close the doors. Check mirrors, signal left, select drive, release the parking brake, then ease forward. Cancel the indicator once you are in lane.</p></div>${order.map(([id, label, body], i) => `<h3>${label}${i === 0 ? ' · in use' : ''}</h3>${body}`).join('')}<p>Steering-wheel force feedback is not implemented. Controllers rumble on contact if vibration is on in Settings.</p><h3>Accessible boarding</h3><p>Stop and apply parking brake → lower the bus (kneel) → open middle door → deploy ramp. Let the rider board, retract the ramp, close doors, and raise the bus. The ramp interlock prevents premature operation. Check the ramp again when that rider alights. Riders with heavy luggage from the ferries ask you to kneel the bus too.</p><h3>Drive the route, not the clock</h3><p>Brake early for signals, STOP signs and zebra crossings. Signals and speed limits in the training packs are authored. Turn indicators, mirrors, complete stop service, gentle driving and road positioning affect your score. The prototype does not implement every Finnish traffic rule or replace driver training.</p><div class="actions"><button class="primary" data-close>Back to the cab ↗</button></div>`, { kind: 'help' });
    this.bindClose();
  }
  bindClose() { for (const el of $('modal-content').querySelectorAll('[data-close]')) el.onclick = () => this.closeModal(); }
  data() {
    const m = this.world.meta;
    this.openModal(`<div class="eyebrow">PROVENANCE / REALISM</div><h2>Know what is real.</h2><h3>${esc(m.title)}</h3><p>${esc(m.description)}</p><p><strong>Data class:</strong> ${esc(m.quality)}<br><strong>Origin:</strong> ${esc(m.origin?.lat)}, ${esc(m.origin?.lon)} · local metres, flat terrain.<br><strong>Retrieved / created:</strong> ${esc(m.retrievedAt || m.created || 'not recorded')}<br><strong>Licence:</strong> ${esc(m.license)}</p><h3>Installed in this build</h3><p>Two driveable training routes (T1 Bulevardi, T2 South Harbour), a physical-size generic electric bus, first-person cab and live rear views, simple AI traffic that keeps to signals and gives way to the bus, low-poly static-pose people, independent doors, kneeling and ramp, scored stop service, fictional passenger conversations, four weathers including an evening light, three shift types and local save/resume with best scores. Building façades, foliage and vehicle surfaces are procedurally authored.</p><h3>Not a surveyed whole-city digital twin</h3><p>The bundled T1 and T2 routes are training reconstructions, not HSL services. The original project's importer can build packs from actual HSL GTFS stop identities, positions, timetables and route shapes, and OpenStreetMap roads and building footprints; it is not part of this build. Lane offsets, untagged heights, kerbs, props, signal cycles and traffic behaviours remain inferred. OpenStreetMap can be incomplete or outdated. Aerial city mesh is not included. Terrain, tram operations, complete lane-level intersection priorities, live traffic and weather, full bus dynamics, crash deformation and human skeletal animation are not implemented.</p><p>Source documentation: HSL open data and on-board guidance; OpenStreetMap contributors (ODbL); City of Helsinki 3D data (CC BY 4.0, not bundled); Three.js (MIT).</p><div class="actions"><button class="primary" data-close>Close ↗</button></div>`, { kind: 'data' });
    this.bindClose();
  }
  pause(sim, audio, opts) {
    this.openModal(`<div class="eyebrow">SHIFT PAUSED</div><h2>Take a moment.</h2><p>${esc(sim.currentStop?.name || 'End of the line')} · ${Math.round(sim.bus.odometer)} metres driven · score ${sim.overall}. Your position is saved at every stop you leave; saves restore the bus stationary, in neutral, with parking brake applied. Traffic is regenerated; this is not an exact replay.</p>
      <div class="actions"><button id="continue" class="primary">Continue driving ↗</button><button id="save" class="secondary">Save position</button><button id="practice" class="secondary">Reset at current stop</button><button id="report" class="secondary">Shift report</button><button id="route-map" class="secondary">Route map</button></div>
      <h3>Cab switches</h3><div class="actions switches"><button class="secondary" data-cab="lights">Lights ${sim.bus.lights ? 'on' : 'off'}</button><button class="secondary" data-cab="wipers">Wipers ${sim.bus.wipers ? 'on' : 'off'}</button><button class="secondary" data-cab="hazards">Hazards ${sim.bus.hazards ? 'on' : 'off'}</button><button class="secondary" data-cab="announce">Announce next stop</button><button class="secondary" data-cab="reverse">Reverse ${sim.bus.gear === 'R' ? 'on' : 'off'}</button></div>
      <div class="settings"><label><input id="sound" type="checkbox" ${audio.enabled ? 'checked' : ''}> Sound</label><label><input id="voice" type="checkbox" ${audio.voice ? 'checked' : ''}> Optional local system speech</label><label><input id="mirror-option" type="checkbox" ${this.callbacks.mirrors() ? 'checked' : ''}> Render live mirrors</label></div>
      <div class="actions"><button id="help-open" class="secondary">Controls</button><button id="settings-open" class="secondary">Graphics &amp; input settings</button><button id="export" class="secondary">Export shift report</button><button id="quit" class="secondary">Return to menu</button></div>
      <p>Subtitles are always available. Optional speech uses an installed local browser voice only; no microphone, hosted voice service, AI account or API key is used.</p>`, { kind: 'pause' });
    $('continue').onclick = () => this.closeModal(); $('save').onclick = () => this.callbacks.save(); $('practice').onclick = () => { sim.practiceReset(); this.closeModal(); };
    $('report').onclick = () => this.results(sim, opts?.best); $('route-map').onclick = () => this.map(sim); $('export').onclick = () => this.callbacks.export();
    $('quit').onclick = () => this.callbacks.quit(); $('help-open').onclick = () => this.help(); $('settings-open').onclick = () => this.callbacks.settings();
    $('sound').onchange = (e) => this.callbacks.setSound(e.target.checked); $('voice').onchange = (e) => this.callbacks.setVoice(e.target.checked); $('mirror-option').onchange = (e) => this.callbacks.setMirrors(e.target.checked);
    for (const el of $('modal-content').querySelectorAll('[data-cab]')) el.onclick = () => { const r = this.callbacks.cab(el.dataset.cab); if (el.dataset.cab !== 'announce') el.textContent = `${el.textContent.split(' ')[0]} ${r ? 'on' : 'off'}`; };
  }
  map(sim) {
    this.mapExpanded = true;
    this.openModal(`<div class="eyebrow">ROUTE ${esc(this.world.data.route.number)}</div><h2>${esc(this.world.meta.title)}</h2><canvas id="full-map" width="1300" height="860"></canvas><p>${this.world.meta.quality === 'training-reconstruction' ? 'Training geometry — not a navigation map of real Helsinki.' : 'HSL route data · © OpenStreetMap contributors. Lane positions are inferred.'}</p><div class="actions"><button class="primary" data-close>Close map ↗</button></div>`, { kind: 'map' });
    this.mapExpanded = true; this.drawMap($('full-map'), sim, true); this.bindClose();
  }
  results(sim, best = null) {
    const served = sim.served.filter((s) => s.status === 'served').length, done = sim.completed;
    const title = sim.practice ? 'Practice run' : sim.endReason === 'pedestrian' ? 'Shift stopped.' : done ? 'Your shift, in review.' : 'Progress so far.';
    const bestLine = best ? `<p class="best-line">${best.isNew ? '<b>New best for this route and shift type!</b> ' : ''}Best overall: <b>${best.overall}</b>${best.time ? ` · ${Math.round(best.time / 60)} min` : ''}.</p>` : '';
    this.openModal(`<div class="eyebrow">${done ? 'END OF SHIFT' : 'SHIFT REPORT'} · ${esc(this.world.data.route.number)} · ${esc(sim.difficulty.label)}</div><h2>${title}</h2><p>${Math.round(sim.bus.odometer)} m driven · ${Math.round(sim.time / 60)} minutes · ${served} of ${this.world.stops.length} stops served · overall <b>${sim.overall}</b>. ${done && sim.endReason !== 'pedestrian' ? 'Secure the bus before leaving the cab.' : ''}</p>${bestLine}
      <div class="score-grid">${Object.entries(sim.scores).map(([k, v]) => `<div><b>${Math.round(v)}</b><span>${esc(k.toUpperCase())}</span></div>`).join('')}</div>
      <table class="report-table"><thead><tr><th>Stop</th><th>Service</th><th>Departure vs plan</th></tr></thead><tbody>${sim.served.map((s) => `<tr><td>${esc(s.name)}</td><td>${esc(s.status)}</td><td>${s.delay > 0 ? '+' : ''}${Math.round(s.delay)} s</td></tr>`).join('')}</tbody></table>
      <h3>Recorded events</h3><p>${sim.log.length ? sim.log.slice(-8).map((e) => `${formatTime(e.time)} · ${esc(e.message)}`).join('<br>') : 'No scored incidents recorded.'}</p>
      <div class="actions">${done ? '<button id="again" class="primary">Drive this shift again ↗</button><button id="next-route" class="secondary">Drive the other route</button><button id="to-menu" class="secondary">Return to menu</button>' : '<button class="primary" data-close>Continue driving ↗</button>'}<button id="report-export" class="secondary">Export JSON report</button></div>
      <p>Scores assess the implemented simulation rules, not legal certification or professional driving competence.</p>`, { kind: done ? 'results' : 'report' });
    $('report-export').onclick = () => this.callbacks.export(); this.bindClose();
    if (done) { $('again').onclick = () => this.callbacks.again(); $('next-route').onclick = () => this.callbacks.nextRoute(); $('to-menu').onclick = () => this.callbacks.quit(); }
  }
  // ---- controller and arrow-key navigation for the menu, modals and the rider dialogue
  navRoot() { if (this.modalOpen) return $('modal'); if (this.menuOpen) return $('menu'); if (this.dialogueOpen) return $('choices'); return null; }
  focusables(root) { return [...root.querySelectorAll(FOCUSABLE)].filter((el) => !el.disabled && el.getClientRects().length && !el.closest('.hidden')); }
  navMove(dx, dy) {
    const root = this.navRoot(); if (!root) return false; const items = this.focusables(root); if (!items.length) return false;
    const current = items.includes(document.activeElement) ? document.activeElement : null;
    if (!current) { items[0].focus({ preventScroll: false }); return true; }
    if (dx && current.tagName === 'SELECT') { const n = current.options.length; current.selectedIndex = (current.selectedIndex + dx + n) % n; current.dispatchEvent(new Event('change', { bubbles: true })); return true; }
    const a = current.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2; let best = null, bestScore = Infinity;
    for (const el of items) {
      if (el === current) continue; const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, ddx = x - ax, ddy = y - ay;
      const along = dx ? ddx * dx : ddy * dy, across = dx ? Math.abs(ddy) : Math.abs(ddx); if (along < 4) continue;
      const score = along + across * 2.2; if (score < bestScore) { bestScore = score; best = el; }
    }
    if (!best) { const i = items.indexOf(current), step = dx || dy; best = items[(i + step + items.length) % items.length]; }
    best.focus(); best.scrollIntoView?.({ block: 'nearest' }); return true;
  }
  navConfirm() {
    const root = this.navRoot(); if (!root) return false; const el = document.activeElement;
    if (!el || !root.contains(el) || el === document.body) return this.navMove(0, 1);
    if (el.tagName === 'SELECT') { const n = el.options.length; el.selectedIndex = (el.selectedIndex + 1) % n; el.dispatchEvent(new Event('change', { bubbles: true })); return true; }
    el.click(); return true;
  }
}
