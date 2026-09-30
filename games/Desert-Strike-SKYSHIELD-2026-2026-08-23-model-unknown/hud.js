/**
 * hud.js — the flight screen's DOM: HUD, radar, briefing/debrief story
 * panels, pause, tactical map, failure dialog and the WHITE NOON tutorial.
 *
 * Built once per sortie; values are written only when they change, so the
 * 12 Hz HUD refresh does not churn layout.
 */

import { KIND_ICON, CREW, PORTRAITS, mapPercent, halfSize, sectorName, radarPlot, progressText, objectiveHint, isStream, STREAM_RADAR, LOCAL_RADAR, THEATER_SIZE, phaseAward, farpsFor } from './data.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const pad2 = (n) => String(n).padStart(2, '0');
const BLIPS = 16;

export class FlightUI {
  constructor(host, mission, getSettings, prompts) {
    this.mission = mission;
    this.getSettings = getSettings;
    this.prompts = prompts;
    this.cache = new Map();
    const s = getSettings();
    // Repair pads are marked on the radar too: in WHITE NOON the nearest one can be far away.
    this.farps = farpsFor(mission);
    const el = document.createElement('section');
    el.className = 'flight-screen';
    el.setAttribute('aria-label', `${mission.title} combat sortie`);
    el.innerHTML = `
      <div class="flight-playfield">
        <div class="flight-hud">
          <header class="hud-top">
            <div class="hud-mission"><span>${esc(mission.operation)}</span><strong>${esc(mission.title)}</strong><small data-h="phase"></small></div>
            <div class="objective-card">
              <p><span class="objective-symbol" data-h="symbol"></span><b data-h="otitle"></b></p>
              <strong data-h="detail"></strong>
              <div class="objective-progress"><i data-h="prog"></i></div>
              <small data-h="ptext"></small>
              <em data-h="ohint"></em>
            </div>
            <button class="pause-trigger" type="button" data-action="flight-pause" aria-label="Pause game">Ⅱ</button>
          </header>
          <div class="hud-compact" aria-hidden="true">
            <span>ARM <b data-h="cArm"></b></span><span>FUEL <b data-h="cFuel"></b></span><span>RKT <b data-h="cRkt"></b></span><span>FLR <b data-h="cFlr"></b></span><span>HEAT <b data-h="cHeat"></b></span>
          </div>
          <aside class="hud-left">
            ${bar('armor', 'AIRFRAME')}
            ${bar('fuel', 'FUEL')}
            <div class="readout"><span>ALT</span><b data-h="alt"></b><small>M</small></div>
            <div class="readout"><span>SPD</span><b data-h="spd"></b><small>KT</small></div>
          </aside>
          <aside class="hud-right">
            <div class="weapon-readout"><span>HYDRA · 70MM</span><strong data-h="rockets"></strong><small data-h="rktKey"></small></div>
            ${bar('heat', '20MM HEAT')}
            <div class="counter-row"><span>FLARES</span><b data-h="flares"></b><small data-h="flrKey"></small></div>
            <div class="counter-row"><span>HOSTILES</span><b data-h="enemies"></b><small>LIVE</small></div>
          </aside>
          <div class="reticle" data-h="reticle" aria-hidden="true"><i></i><span>+</span><i></i></div>
          <div class="missile-lock" data-h="lock" hidden><span>△</span><strong>MISSILE LOCK</strong><small data-h="lockKey"></small></div>
          <div class="resupply-prompt" data-h="resupply" hidden>FARP IN RANGE · HOLD <b data-h="svcKey"></b> TO REPAIR &amp; REARM</div>
          <div class="objective-action-feedback" data-h="note" role="status" aria-live="polite" hidden><b>CONTROL NOTE</b><span data-h="noteText"></span></div>
          <div class="radio-caption" data-h="radioBox" aria-live="assertive" ${s.subtitles ? '' : 'hidden'}>
            <img src="${PORTRAITS.systems}" alt="" aria-hidden="true" /><div><span>COMMS · PATCH</span><p data-h="radio"></p></div>
          </div>
          <div class="radar" data-h="radarBox">
            <div class="radar-grid"></div>
            ${'<i class="radar-farp" hidden></i>'.repeat(this.farps.length)}
            ${'<i class="radar-blip" hidden></i>'.repeat(BLIPS)}
            <span class="radar-player" style="left:50%;top:50%">△</span>
            <span class="radar-objective" data-h="robj">◇</span>
            <small data-h="rtext"></small>
          </div>
          <div class="hud-controls" data-h="controls"></div>
          <div class="hud-score"><span>SCORE</span><b data-h="score"></b><small data-h="alert"></small></div>
          <div class="kill-feed" aria-hidden="true">${'<span></span>'.repeat(4)}</div>
          <div class="damage-flash" data-h="flash" aria-hidden="true"></div>
          <div class="sr-only" role="status" aria-live="assertive" data-h="sr1"></div>
          <div class="sr-only" role="status" aria-live="polite" data-h="sr2"></div>
        </div>
        <div class="tutorial-card" data-h="tut" hidden><span data-h="tutHead"></span><p data-h="tutText"></p><i data-h="tutBar"></i></div>
      </div>
      <div class="overlay-host" data-h="overlay"></div>`;
    host.append(el);
    this.el = el;
    this.h = {};
    for (const n of el.querySelectorAll('[data-h]')) this.h[n.dataset.h] = n;
    this.hudEl = el.querySelector('.flight-hud');
    this.playfield = el.querySelector('.flight-playfield');
    this.blips = [...el.querySelectorAll('.radar-blip')];
    this.farpMarks = [...el.querySelectorAll('.radar-farp')];
    this.feedLines = [...el.querySelectorAll('.kill-feed span')];
    this.feedCursor = 0;
    this.flash = 0;
    this.flashShown = -1;
    this.reticleXY = [NaN, NaN, false, false];
    this.overlay = null;
    this.radioTimer = 0;
    this.applyPrompts();
  }

  /* -------------------------------------------- writes that skip unchanged values */

  text(key, v) {
    const s = String(v);
    if (this.cache.get(key) === s) return;
    this.cache.set(key, s);
    this.h[key].textContent = s;
  }

  width(key, pct) {
    const v = Math.round(Math.max(0, Math.min(100, pct)) * 2) / 2;
    if (this.cache.get(key) === v) return;
    this.cache.set(key, v);
    this.h[key].style.width = `${v}%`;
  }

  show(key, on) {
    const k = `show:${key}`;
    if (this.cache.get(k) === on) return;
    this.cache.set(k, on);
    this.h[key].hidden = !on;
  }

  cls(el, name, on, key) {
    const k = `cls:${key}`;
    if (this.cache.get(k) === on) return;
    this.cache.set(k, on);
    el.classList.toggle(name, on);
  }

  /* -------------------------------------------- phase + prompts */

  setPhase(index) {
    const m = this.mission;
    const ph = m.phases[index];
    this.phaseIndex = index;
    this.text('phase', `PHASE ${index + 1} / ${m.phases.length}`);
    this.h.symbol.className = `objective-symbol symbol-${ph.kind}`;
    this.text('symbol', ph.kind === 'eliminate' || ph.kind === 'boss' ? '◇' : ph.kind === 'extract' ? '▽' : '⬡');
    this.text('otitle', ph.title);
    this.text('detail', ph.detail);
    this.text('radio', ph.radio);
    this.radioTimer = 0;
    this.h.radioBox.classList.remove('is-faded');
    this.h.radioBox.hidden = !this.getSettings().subtitles;
  }

  applyPrompts() {
    const p = this.prompts();
    this.text('rktKey', p.rocket);
    this.text('flrKey', p.flare);
    this.text('svcKey', p.service);
    this.text('lockKey', `DEPLOY FLARES · ${p.flare}`);
    const c = [`${p.move} MOVE`, `${p.alt} ALTITUDE`, `${p.fire} CANNON`, `${p.rocket} ROCKETS`, `${p.flare} FLARES`, `${p.service} SERVICE`, `${p.boost} CRUISE`, `${p.camera} CAMERA`];
    const html = c.map((t) => `<span>${esc(t)}</span>`).join('');
    if (this.cache.get('controlsHtml') !== html) {
      this.cache.set('controlsHtml', html);
      this.h.controls.innerHTML = html;
    }
  }

  setSubtitles(on) {
    this.h.radioBox.hidden = !on;
  }

  /* -------------------------------------------- per-tick HUD */

  update(P, dt, touch) {
    const m = this.mission;
    const ph = m.phases[this.phaseIndex];
    const pct = Math.min(100, (P.progress / Math.max(1, P.target)) * 100);
    this.width('prog', pct);
    this.text('ptext', progressText(ph.kind, P.progress, P.target, P.insideZone));
    this.text('ohint', objectiveHint(ph.kind, P.insideZone));
    this.barValue('armor', P.armor, P.armor < 30);
    this.barValue('fuel', P.fuel, P.fuel < 20);
    this.barValue('heat', P.heat, P.heat > 82);
    this.text('alt', Math.round(P.altitude));
    this.text('spd', Math.round(P.speed));
    this.text('rockets', String(P.rockets).padStart(2, '0'));
    this.text('flares', P.flares);
    this.text('enemies', P.enemies);
    this.text('cArm', `${Math.round(P.armor)}%`);
    this.text('cFuel', `${Math.round(P.fuel)}%`);
    this.text('cRkt', P.rockets);
    this.text('cFlr', P.flares);
    this.text('cHeat', `${Math.round(P.heat)}%`);
    this.text('score', String(P.totalScore).padStart(8, '0'));
    this.text('alert', `ALERT ${Math.round(P.alert)}%`);
    this.cls(this.hudEl, 'is-locked', P.lock, 'locked');
    this.cls(this.h.cArm.parentElement, 'danger', P.armor < 30, 'carm');
    this.show('lock', P.lock);
    this.show('resupply', P.resupply);
    this.show('note', !!P.actionHint);
    if (P.actionHint) this.text('noteText', P.actionHint);
    this.text('sr1', P.lock ? 'Missile lock. Deploy flares.' : P.armor < 25 ? 'Critical airframe damage.' : '');
    this.text('sr2', !P.lock && P.armor >= 25 ? `${ph.title}. ${Math.floor(pct / 25) * 25} percent complete.` : '');

    // Radar: objective diamond plus hostile blips.
    const stream = isStream(m);
    const range = stream ? STREAM_RADAR : LOCAL_RADAR;
    const r = radarPlot(P.playerX, P.playerZ, P.objectiveX, P.objectiveZ, range);
    const key = `${r.left.toFixed(1)}|${r.top.toFixed(1)}|${Math.round(r.bearing)}|${r.offscreen}`;
    if (this.cache.get('robj') !== key) {
      this.cache.set('robj', key);
      const o = this.h.robj;
      o.style.left = `${r.left}%`;
      o.style.top = `${r.top}%`;
      o.style.rotate = `${r.bearing}deg`;
      o.classList.toggle('offscreen', r.offscreen);
    }
    const dist = Math.round(r.distance);
    this.text('rtext', `${stream ? sectorName(P.playerX, P.playerZ) : 'LOCAL'} · ${dist}U`);
    if (this.cache.get('rlabel') !== dist) {
      this.cache.set('rlabel', dist);
      this.h.radarBox.setAttribute('aria-label', `Tactical radar. Objective ${dist} units away.`);
    }
    for (let i = 0; i < this.farpMarks.length; i++) {
      const f = this.farps[i];
      const mark = this.farpMarks[i];
      const q = radarPlot(P.playerX, P.playerZ, f.x, f.z, range);
      if (q.offscreen) {
        if (!mark.hidden) mark.hidden = true;
        continue;
      }
      if (mark.hidden) mark.hidden = false;
      mark.style.left = `${q.left.toFixed(1)}%`;
      mark.style.top = `${q.top.toFixed(1)}%`;
    }
    for (let i = 0; i < BLIPS; i++) {
      const b = this.blips[i];
      const e = P.blips[i];
      if (!e || i >= P.blipCount) {
        if (!b.hidden) b.hidden = true;
        continue;
      }
      const q = radarPlot(P.playerX, P.playerZ, e.x, e.z, range);
      if (q.offscreen) {
        if (!b.hidden) b.hidden = true;
        continue;
      }
      if (b.hidden) b.hidden = false;
      b.style.left = `${q.left.toFixed(1)}%`;
      b.style.top = `${q.top.toFixed(1)}%`;
      b.classList.toggle('is-target', !!e.target);
    }

    // The radio caption fades after a while on touch screens, where space is tight.
    this.radioTimer += dt;
    this.cls(this.h.radioBox, 'is-faded', touch && this.radioTimer > 14, 'radioFade');
  }

  barValue(key, value, danger) {
    this.text(`${key}Val`, `${Math.round(value)}%`);
    this.width(`${key}Fill`, value);
    this.cls(this.h[`${key}Bar`], 'danger', danger, `${key}Danger`);
  }

  /* -------------------------------------------- frame-rate feedback */

  setReticle(x, y, visible, locked) {
    const r = this.reticleXY;
    if (Math.abs(r[0] - x) < 0.5 && Math.abs(r[1] - y) < 0.5 && r[2] === visible && r[3] === locked) return;
    r[0] = x;
    r[1] = y;
    r[2] = visible;
    r[3] = locked;
    const el = this.h.reticle;
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
    el.style.opacity = visible ? '' : '0';
    el.classList.toggle('is-on-target', locked);
  }

  damage(amount) {
    this.flash = Math.min(1, this.flash + amount);
  }

  frame(dt) {
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.2);
    const v = Math.round(this.flash * 40) / 40;
    if (v !== this.flashShown) {
      this.flashShown = v;
      this.h.flash.style.opacity = String(v * 0.55);
    }
  }

  feed(text, tone = '') {
    const el = this.feedLines[this.feedCursor];
    this.feedCursor = (this.feedCursor + 1) % this.feedLines.length;
    el.textContent = text;
    el.className = tone;
    el.getAnimations?.().forEach((a) => a.cancel());
    el.animate?.(
      [
        { opacity: 0, transform: 'translateY(6px)' },
        { opacity: 1, transform: 'none', offset: 0.1 },
        { opacity: 1, offset: 0.75 },
        { opacity: 0 },
      ],
      { duration: 2600, fill: 'forwards' }
    );
  }

  setTutorial(content, elapsed) {
    if (!content) {
      this.show('tut', false);
      return;
    }
    this.show('tut', true);
    this.text('tutHead', `TUTORIAL · ${content[0]}`);
    this.text('tutText', content[1]);
    this.width('tutBar', ((elapsed % 8) / 8) * 100);
  }

  /* -------------------------------------------- overlays */

  get overlayOpen() {
    return !!this.overlay;
  }

  closeOverlay() {
    this.h.overlay.textContent = '';
    this.overlay = null;
    this.playfield.removeAttribute('inert');
  }

  openOverlay(name, html) {
    this.h.overlay.innerHTML = html;
    this.overlay = name;
    this.playfield.setAttribute('inert', '');
    return this.h.overlay.firstElementChild;
  }

  /** The mid-sortie briefing (before a phase) or debrief (after one). */
  showStory({ index, mode, phaseScore, cumulative }) {
    const m = this.mission;
    const c = m.phases[index];
    const prev = m.phases[index - 1];
    const next = m.phases[index + 1];
    const debrief = mode === 'debrief';
    const last = index === m.phases.length - 1;
    const speaker = debrief
      ? c.kind === 'extract'
        ? CREW.pilot
        : c.kind === 'secure' || c.kind === 'escort'
          ? CREW.systems
          : CREW.command
      : c.kind === 'boss' || c.kind === 'extract'
        ? CREW.command
        : index % 2
          ? CREW.systems
          : CREW.command;
    const initials = speaker
      .split(' ')
      .filter((w) => !w.startsWith('‘'))
      .map((w) => w[0])
      .join('')
      .slice(0, 2);
    const portrait = speaker === CREW.pilot ? PORTRAITS.pilot : speaker === CREW.systems ? PORTRAITS.systems : PORTRAITS.command;
    const role = speaker === CREW.pilot ? 'NIGHTJAR PILOT' : speaker === CREW.systems ? 'SYSTEMS / INTELLIGENCE' : 'MERIDIAN COMMAND';
    const situation = index === 0 ? m.synopsis : prev.storyBeat;
    const action = debrief ? (last ? 'CLOSE OPERATION' : `CONTINUE TO PHASE ${pad2(index + 2)}`) : `COMMENCE PHASE ${pad2(index + 1)}`;
    const award = phaseAward(index, m.phases.length, cumulative, phaseScore);
    const half = halfSize(m);
    const ox = mapPercent(c.location[0], half);
    const oy = mapPercent(c.location[1], half);
    const p = this.prompts();
    const rail = m.phases
      .map((r, n) => {
        const done = n < index || (debrief && n === index);
        return `<li class="${done ? 'done' : n === index ? 'active' : ''}"><i>${done ? '✓' : pad2(n + 1)}</i><span>${esc(r.title)}</span></li>`;
      })
      .join('');
    const html = `
      <div class="phase-story-overlay ${debrief ? 'is-debrief' : 'is-briefing'}" style="--phase-accent:${esc(m.accent)}">
        <section class="phase-story-panel" role="dialog" aria-modal="true" aria-labelledby="phase-story-title" aria-describedby="phase-story-objective phase-story-dialogue phase-story-intel">
          <header class="phase-story-header">
            <div><p>${esc(m.operation)} · ${esc(m.region)}</p><strong>${debrief ? 'AFTER-ACTION LINK' : 'TACTICAL BRIEFING'}</strong></div>
            <span>PHASE ${pad2(index + 1)} / ${pad2(m.phases.length)}</span>
          </header>
          <div class="phase-story-layout">
            <div class="phase-story-graphic biome-${m.biome} kind-${c.kind} ${debrief ? 'is-complete' : ''}" style="--objective-x:${ox}%;--objective-y:${oy}%" role="img" aria-label="Animated tactical plot for ${esc(c.title)}">
              <div class="story-map-grid"></div><div class="story-contours"></div><div class="story-scan"></div>
              <span class="story-map-label label-north">N ↑</span>
              <span class="story-map-label label-sector">GRID ${pad2(index + 11)}-${esc(m.biome.slice(0, 3).toUpperCase())}</span>
              <div class="story-character-card" aria-hidden="true"><img src="${portrait}" alt="" /><div><span>${role}</span><b>${esc(speaker)}</b></div></div>
              <div class="story-route"><i></i><i></i><i></i><i></i><i></i></div>
              <span class="story-aircraft"><b>△</b><small>VQ-88</small></span>
              <span class="story-objective"><i></i><b>${KIND_ICON[c.kind]}</b><small>${c.kind.toUpperCase()}</small></span>
              <div class="story-threats"><i></i><i></i><i></i><i></i></div>
              <div class="story-graphic-status"><span>${debrief ? 'SECTOR RESOLVED' : 'LIVE MISSION MODEL'}</span><b>${debrief ? '100%' : 'SYNCING'}</b></div>
            </div>
            <div class="phase-story-copy">
              <p class="phase-story-kicker">${debrief ? 'OBJECTIVE COMPLETE' : 'INCOMING TASKING'}</p>
              <h2 id="phase-story-title" tabindex="-1">${esc(c.title)}</h2>
              <p id="phase-story-objective" class="phase-story-objective"><span>${KIND_ICON[c.kind]}</span>${esc(c.detail)}</p>
              <div class="phase-comms">
                <div class="phase-avatar" aria-hidden="true"><span>${esc(initials)}</span><img src="${portrait}" alt="" /><i></i><i></i><i></i></div>
                <blockquote id="phase-story-dialogue"><cite>COMMS · ${esc(speaker)}</cite>${esc(debrief ? c.conclusion : c.radio)}</blockquote>
              </div>
              <div id="phase-story-intel" class="phase-intel"><span>${debrief ? 'STORY UPDATE' : 'CURRENT SITUATION'}</span><p>${esc(debrief ? c.storyBeat : situation)}</p></div>
              ${
                debrief
                  ? `<div class="phase-next-beat"><span>${next ? 'NEXT TASKING' : 'OPERATION OUTCOME'}</span><p><b>${esc(next ? next.title : m.title)}</b>${esc(next ? next.detail : 'Return to command for the full after-action report.')}</p></div>`
                  : ''
              }
              <footer class="phase-story-actions">
                <div>${
                  debrief
                    ? `<span>PHASE SCORE</span><b>+${award.phaseAward.toLocaleString()}</b><small>TOTAL · ${award.totalScore.toLocaleString()}</small>`
                    : `<span>THREAT PROFILE</span><b>${esc(m.threat)}</b><small>${esc(m.stakes)}</small>`
                }</div>
                <button class="primary" type="button" data-action="story-go" data-autofocus>${action}<small>${esc(p.confirm)}</small><span>→</span></button>
              </footer>
            </div>
          </div>
          <ol class="phase-story-rail" aria-label="Operation phase progress">${rail}</ol>
        </section>
      </div>`;
    return this.openOverlay('story', html);
  }

  showPause() {
    return this.openOverlay(
      'pause',
      `<div class="game-overlay"><div class="game-dialog" role="dialog" aria-modal="true" aria-labelledby="pause-title">
        <p>SORTIE SUSPENDED</p><h2 id="pause-title">PAUSED</h2>
        <button type="button" class="primary" data-action="pause-resume" data-autofocus>RESUME FLIGHT</button>
        <button type="button" data-action="pause-retry">RETRY PHASE</button>
        <button type="button" data-action="pause-map">TACTICAL MAP</button>
        <button type="button" data-action="open-settings">SETTINGS / ACCESSIBILITY</button>
        <button type="button" data-action="open-kit">GRAPHICS &amp; CONTROLS</button>
        <button type="button" data-action="open-manual">FIELD MANUAL</button>
        <button type="button" data-action="pause-abort">ABORT TO BRIEFING</button>
        <small>Simulation, mission clocks and hostile AI are frozen.</small>
      </div></div>`
    );
  }

  showFailure(cause) {
    return this.openOverlay(
      'failure',
      `<div class="game-overlay danger-overlay"><div class="game-dialog" role="dialog" aria-modal="true" aria-labelledby="failure-title">
        <p>AIRFRAME DOWN</p><h2 id="failure-title">SORTIE FAILED</h2><strong>${esc(cause)}</strong>
        <button type="button" class="primary" data-action="fail-retry" data-autofocus>RETRY CHECKPOINT</button>
        <button type="button" data-action="fail-abort">RETURN TO BRIEFING</button>
        <small>Checkpoint progress is preserved. Transient enemies and ordnance will reset.</small>
      </div></div>`
    );
  }

  showMap({ index, playerX, playerZ, objectiveX, objectiveZ }) {
    const m = this.mission;
    const stream = isStream(m);
    const half = halfSize(m);
    const pos = (x, z) => `left:${mapPercent(x, half)}%;top:${mapPercent(z, half)}%`;
    const nodes = m.phases
      .map((c, d) => `<span class="map-node ${d < index ? 'done' : d === index ? 'active' : ''}" style="${pos(c.location[0], c.location[1])}">${pad2(d + 1)}</span>`)
      .join('');
    const farps = farpsFor(m)
      .map((f) => `<span class="map-farp" style="${pos(f.x, f.z)}" title="FARP"></span>`)
      .join('');
    const list = m.phases
      .map(
        (c, d) =>
          `<li class="${d === index ? 'active' : d < index ? 'done' : ''}"><span>${pad2(d + 1)}</span><p><b>${esc(c.title)}</b><small>${d < index ? 'COMPLETE' : d === index ? esc(c.detail) : 'PENDING'}</small></p></li>`
      )
      .join('');
    const p = this.prompts();
    return this.openOverlay(
      'map',
      `<div class="game-overlay tactical-overlay"><section class="tactical-panel" role="dialog" aria-modal="true" aria-labelledby="map-title">
        <header><div><p>LIVE TACTICAL PLOT · ${stream ? `${THEATER_SIZE.toLocaleString()}U THEATER` : 'LOCAL THEATER'}</p><h2 id="map-title">${esc(m.title)}</h2></div>
        <button type="button" data-action="map-close" data-autofocus>CLOSE MAP · ${esc(p.map)}</button></header>
        <div class="tactical-body">
          <div class="large-map ${stream ? 'desert-overview' : ''}">
            <div class="map-contours"></div>
            ${farps}
            <span class="map-objective" style="${pos(objectiveX, objectiveZ)}">◇</span>
            <span class="map-player" style="${pos(playerX, playerZ)}">△ NIGHTJAR</span>
            ${nodes}
            <div class="map-scale">${stream ? `SECTOR ${sectorName(playerX, playerZ)} · PROCEDURAL TILE STREAM` : 'LOCAL MISSION GRID'}</div>
          </div>
          <ol aria-label="Mission objectives">${list}</ol>
        </div>
      </section></div>`
    );
  }

  dispose() {
    this.el.remove();
  }
}

function bar(key, label) {
  return `<div class="hud-bar" data-h="${key}Bar"><p><span>${label}</span><b data-h="${key}Val"></b></p><div><i data-h="${key}Fill"></i></div></div>`;
}
