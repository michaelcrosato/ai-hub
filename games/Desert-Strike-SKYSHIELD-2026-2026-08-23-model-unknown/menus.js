/**
 * menus.js — every screen outside the cockpit, as HTML builders. Buttons
 * carry data-action (and data-arg); settings are "cyclers" (one button per
 * setting: click or A steps forward, left/right step either way) so the
 * whole menu tree works with a mouse, a touch screen, a keyboard or a pad.
 */

import { MISSIONS, CREW, PORTRAITS, EPILOGUES, FINALE_ID, AREA_RATIO, THEATER_SIZE, TILE, isStream, clock } from './data.js';
import { esc } from './hud.js';

const pad2 = (n) => String(n).padStart(2, '0');
const pct = (v) => `${Math.round(v * 100)}%`;
const onOff = (v) => (v ? 'ON' : 'OFF');
const steps = (lo, hi, by) => {
  const out = [];
  for (let v = lo; v <= hi + 1e-9; v += by) out.push(Math.round(v * 100) / 100);
  return out;
};

export const CYCLERS = {
  difficulty: {
    label: 'DIFFICULTY',
    options: ['cadet', 'pilot', 'ace'],
    format: (v) => ({ cadet: 'CADET — forgiving', pilot: 'PILOT — intended', ace: 'ACE — severe' })[v],
  },
  pace: { label: 'DEPLOYMENT LENGTH', options: ['standard', 'rapid'], format: (v) => (v === 'rapid' ? 'RAPID — 20–35 min' : 'STANDARD — 1–2 hours') },
  masterVolume: { label: 'MASTER VOLUME', options: steps(0, 1, 0.1), format: pct },
  musicVolume: { label: 'MUSIC VOLUME', options: steps(0, 1, 0.1), format: pct },
  sfxVolume: { label: 'EFFECTS VOLUME', options: steps(0, 1, 0.1), format: pct },
  hudScale: { label: 'HUD SCALE', options: steps(0.8, 1.4, 0.1), format: pct },
  subtitles: { label: 'SUBTITLES', options: [true, false], format: onOff, toggle: true },
  cameraShake: { label: 'CAMERA SHAKE', options: [true, false], format: onOff, toggle: true },
  reducedMotion: { label: 'REDUCED MOTION', options: [false, true], format: onOff, toggle: true },
  aimAssist: { label: 'AIM ASSIST', options: [true, false], format: onOff, toggle: true },
  colorMode: { label: 'MARKER PALETTE', options: ['default', 'deuteranopia', 'tritanopia'], format: (v) => v.toUpperCase() },
  camera: { label: 'FLIGHT CAMERA', options: ['tactical', 'chase'], format: (v) => (v === 'chase' ? 'CHASE' : 'TACTICAL') },
};

/** The next value of a setting, dir = +1 / -1 (numbers snap to the nearest step first). */
export function cycleValue(key, current, dir) {
  const c = CYCLERS[key];
  let i = c.options.findIndex((o) => o === current);
  if (i < 0 && typeof current === 'number') {
    let best = Infinity;
    c.options.forEach((o, k) => {
      const d = Math.abs(o - current);
      if (d < best) {
        best = d;
        i = k;
      }
    });
  }
  if (i < 0) i = 0;
  const n = c.options.length;
  if (c.toggle) return c.options[(i + 1) % n];
  // Sliders stop at their ends; lists wrap.
  if (typeof c.options[0] === 'number') return c.options[Math.max(0, Math.min(n - 1, i + dir))];
  return c.options[(i + dir + n) % n];
}

export function cycler(key, settings, extraClass = '') {
  const c = CYCLERS[key];
  const v = settings[key];
  const sw = c.toggle ? ` role="switch" aria-checked="${!!v}"` : '';
  return `<button type="button" class="cycle ${extraClass}" data-cycle="${key}"${sw}><span>${c.label}</span><b><i data-dir="-1" aria-hidden="true">‹</i>${esc(c.format(v))}<i data-dir="1" aria-hidden="true">›</i></b></button>`;
}

/* ------------------------------------------------------------ chrome */

export function masthead() {
  return `<header class="masthead">
    <button type="button" class="wordmark" data-action="go-title" aria-label="Return to title screen"><span class="wing-mark">▽</span><span>SKYSHIELD</span><b>2026</b></button>
    <div class="mast-status"><span class="status-dot"></span> COMPACT LINK · SECURE <b>UTC 21:06</b></div>
  </header>`;
}

export function footer() {
  return `<footer class="footer-line"><span>FICTIONAL PLACES &amp; FACTIONS · THEMATIC PARALLELS ONLY</span><span>VQ-88 · BUILD 2.1</span></footer>`;
}

const head = (kicker, title, back) =>
  `<header class="screen-head"><button type="button" data-action="${back}">← BACK</button><div><p>${esc(kicker)}</p><h1>${esc(title)}</h1></div></header>`;

/* ------------------------------------------------------------ title */

export function titleScreen(state) {
  const s = state.save;
  const done = Math.round((s.completed.length / MISSIONS.length) * 100);
  const cp = s.checkpoint;
  const cpMission = cp && MISSIONS.find((m) => m.id === cp.missionId);
  return `<section class="title-screen" aria-labelledby="game-title">
    <div class="title-copy">
      <p class="eyebrow">MERIDIAN COMPACT EMERGENCY WING</p>
      <h1 id="game-title">SKYSHIELD <span>2026</span></h1>
      <p class="tagline">ONE BASIN. FOURTEEN OBJECTIVES.</p>
      <p class="lede">Deploy into WHITE NOON: a continent-scale desert theater built from deterministic mission tiles. Cross an invented basin of water infrastructure, drone freight yards, canyon roads, salt rail, and civic strongholds.</p>
      <div class="menu-stack" aria-label="Main menu">
        ${
          cp && cpMission
            ? `<button type="button" class="menu-button primary" data-action="continue" data-autofocus><span>CONTINUE DEPLOYMENT</span><small>${esc(cp.missionId.replaceAll('-', ' '))} · ${cp.stage === 'debrief' ? 'AFTER ACTION' : `PHASE ${cp.phaseIndex + 1}`}</small></button>`
            : ''
        }
        <button type="button" class="menu-button primary" data-action="new-campaign" ${cp ? '' : 'data-autofocus'}><span>NEW CAMPAIGN</span><small>START OPERATION WHITE NOON</small></button>
        <button type="button" class="menu-button" data-action="go-operations"><span>OPERATIONS</span><small>${done}% THEATER COMPLETE</small></button>
        <button type="button" class="menu-button" data-action="open-manual"><span>FIELD MANUAL</span><small>FLIGHT, WEAPONS &amp; SURVIVAL</small></button>
        <button type="button" class="menu-button" data-action="go-hangar"><span>HANGAR</span><small>${s.credits.toLocaleString()} UPGRADE CREDITS</small></button>
        <button type="button" class="menu-button" data-action="open-settings"><span>SETTINGS</span><small>CONTROL &amp; ACCESSIBILITY</small></button>
      </div>
    </div>
    <aside class="title-cast" aria-label="Nightjar crew">
      <p>MERIDIAN COMPACT · NIGHTJAR CREW</p>
      <div class="cast-portraits">
        <figure><img src="${PORTRAITS.pilot}" alt="Captain Mara Kestrel Vey" /><figcaption><span>01 · PILOT</span><b>KESTREL</b></figcaption></figure>
        <figure><img src="${PORTRAITS.systems}" alt="Ilya Patch Anwar" /><figcaption><span>02 · SYSTEMS</span><b>PATCH</b></figcaption></figure>
        <figure><img src="${PORTRAITS.command}" alt="Director Emi Sato" /><figcaption><span>03 · COMMAND</span><b>SATO</b></figcaption></figure>
      </div>
      <div class="title-airframe"><span>ASSIGNED AIRFRAME</span><b>${esc(CREW.aircraft)}</b><em class="safe">SORTIE READY</em></div>
    </aside>
  </section>`;
}

/* ------------------------------------------------------------ operations */

function recordRow(rec) {
  if (!rec || !rec.clears) return '';
  return `<div class="record-row" aria-label="Best results">
    <span>BEST GRADE <b>${esc(rec.bestGrade || '—')}</b></span>
    <span>BEST SCORE <b>${rec.bestScore.toLocaleString()}</b></span>
    <span>FASTEST <b>${rec.bestTime ? clock(rec.bestTime) : '—'}</b></span>
    <span>CLEARS <b>${rec.clears}</b></span>
  </div>`;
}

export function operationsScreen(state) {
  const s = state.save;
  const n = state.missionIndex;
  const x = MISSIONS[n];
  const stream = isStream(x);
  const rows = MISSIONS.map((z, P) => {
    const open = P < s.unlocked;
    const status = s.completed.includes(z.id) ? 'COMPLETE' : open ? z.estimate : z.reserve ? 'AFTER CAMPAIGN' : 'LOCKED';
    return `<button type="button" class="operation-row ${n === P ? 'selected' : ''} ${z.reserve ? 'is-reserve' : ''}" data-action="select-op" data-arg="${P}" ${open ? '' : 'disabled'} ${n === P ? 'data-autofocus' : ''}>
      <span class="op-index">${pad2(P + 1)}</span><span><b>${esc(z.title)}</b><small>${esc(z.region)}${z.reserve ? ' · RESERVE' : ''}</small></span><em>${esc(status)}</em></button>`;
  }).join('');
  return `<section class="screen-panel operations-screen">
    ${head('CAMPAIGN THEATER', 'FIVE FIRES, NO DECLARED WAR', 'go-title')}
    <div class="operation-layout">
      <nav class="operation-list" aria-label="Operations">${rows}</nav>
      <article class="operation-detail" style="--mission-accent:${esc(x.accent)}">
        <div class="map-plate ${stream ? 'is-desert-theater' : ''}">
          <span class="map-grid"></span><b>${esc(x.region)}</b><i>THREAT · ${esc(x.threat)}</i><div class="map-pulse"></div>
          ${stream ? `<div class="world-spec"><span>${THEATER_SIZE.toLocaleString()} × ${THEATER_SIZE.toLocaleString()}</span><small>${Math.round(AREA_RATIO)}× OLD MAP AREA · ${TILE}U MISSION TILES</small></div>` : ''}
        </div>
        <p class="eyebrow">${esc(x.operation)} · ${esc(x.date)}</p>
        <h2>${esc(x.title)}</h2>
        <p>${esc(x.synopsis)}</p>
        <dl class="detail-grid">
          <div><dt>EXPECTED</dt><dd>${esc(x.estimate)}</dd></div>
          <div><dt>PHASES</dt><dd>${x.phases.length}</dd></div>
          <div><dt>PRIMARY RISK</dt><dd>${esc(x.stakes)}</dd></div>
        </dl>
        ${recordRow(s.records[x.id])}
        <button type="button" class="solid-button" data-action="go-briefing" ${n >= s.unlocked ? 'disabled' : ''}>OPEN BRIEFING <span>→</span></button>
      </article>
    </div>
  </section>`;
}

/* ------------------------------------------------------------ briefing */

export function briefingScreen(state) {
  const x = MISSIONS[state.missionIndex];
  const cp = state.save.checkpoint;
  const resumable = cp && cp.missionId === x.id && (cp.phaseIndex > 0 || cp.stage === 'debrief');
  const phases = x.phases
    .map((z, P) => `<div><span>${P + 1}</span><p><b>${esc(z.title)}</b><small>${esc(z.detail)}</small></p><em>${z.checkpoint ? 'CP' : 'LZ'}</em></div>`)
    .join('');
  return `<section class="screen-panel briefing-screen">
    ${head(`${x.operation} // ${x.date}`, x.title, 'go-operations')}
    <div class="brief-grid">
      <article class="brief-copy">
        <p class="section-label">SITUATION</p>
        <p class="briefing-text">${esc(x.briefing)}</p>
        <p class="section-label">MISSION PROFILE</p>
        <div class="phase-list">${phases}</div>
      </article>
      <aside class="brief-side">
        <div class="intel-box"><p>PRIORITY TARGET</p><strong>${esc(x.boss)}</strong></div>
        <div class="crew-box"><p>FLIGHT CREW</p>
          <div class="crew-mini" aria-hidden="true"><img src="${PORTRAITS.pilot}" alt="" /><img src="${PORTRAITS.systems}" alt="" /><img src="${PORTRAITS.command}" alt="" /></div>
          <dl><div><dt>PILOT</dt><dd>${esc(CREW.pilot)}</dd></div><div><dt>SYSTEMS</dt><dd>${esc(CREW.systems)}</dd></div><div><dt>COMMAND</dt><dd>${esc(CREW.command)}</dd></div></dl>
        </div>
        <div class="select-label">${cycler('difficulty', state.settings, 'select-cycle')}</div>
        <div class="select-label">${cycler('pace', state.settings, 'select-cycle')}</div>
        ${
          resumable
            ? `<button type="button" class="launch-button" data-action="resume-op" data-autofocus>RESUME · ${cp.stage === 'debrief' ? 'AFTER ACTION' : `PHASE ${cp.phaseIndex + 1}`} <span>↗</span></button>
               <button type="button" class="launch-button is-secondary" data-action="launch">RESTART FROM PHASE 1 <span>↺</span></button>`
            : `<button type="button" class="launch-button" data-action="launch" data-autofocus>LAUNCH NIGHTJAR <span>↗</span></button>`
        }
      </aside>
    </div>
  </section>`;
}

/* ------------------------------------------------------------ debrief */

export function debriefScreen(state) {
  const n = state.missionIndex;
  const t = MISSIONS[n];
  const d = state.debrief;
  const final = t.id === FINALE_ID;
  const hasNext = !final && n + 1 < MISSIONS.length;
  const status = final ? 'ALL FRONTS SECURE' : t.reserve ? 'RESERVE OPERATION CLOSED' : 'NEXT OPERATION OPEN';
  return `<section class="screen-panel debrief-screen">
    <div class="debrief-card">
      <p class="eyebrow">${esc(t.operation)} · AFTER-ACTION REPORT</p>
      <div class="grade">${d.grade}</div>
      <h1>${esc(t.title)}<span>COMPLETE</span></h1>
      <p>${esc(EPILOGUES[t.id] || '')}</p>
      <dl>
        <div><dt>COMBAT SCORE</dt><dd>${d.score.toLocaleString()}${d.newBestScore ? ' <em>NEW BEST</em>' : ''}</dd></div>
        <div><dt>OBJECTIVES</dt><dd>${t.phases.length} / ${t.phases.length}</dd></div>
        <div><dt>UPGRADE CREDITS</dt><dd>+${d.reward.toLocaleString()}</dd></div>
        <div><dt>CAMPAIGN STATUS</dt><dd>${status}</dd></div>
        <div><dt>FLIGHT TIME</dt><dd>${d.time ? clock(d.time) : '—'}${d.newBestTime ? ' <em>NEW BEST</em>' : ''}</dd></div>
        <div><dt>DIFFICULTY</dt><dd>${esc(state.settings.difficulty.toUpperCase())} · ${esc(state.settings.pace.toUpperCase())}</dd></div>
      </dl>
      <div class="debrief-actions">
        <button type="button" data-action="debrief-hangar">VISIT HANGAR</button>
        <button type="button" class="primary" data-action="debrief-next" data-autofocus>${final ? 'VIEW EPILOGUE' : hasNext ? 'NEXT BRIEFING' : 'RETURN TO COMMAND'} →</button>
      </div>
    </div>
  </section>`;
}

/* ------------------------------------------------------------ hangar */

export const UPGRADES = [
  { id: 'armor', name: 'CERAMIC AIRFRAME', effect: '+20 maximum armor per tier' },
  { id: 'cannon', name: 'ACTIVE-BLEED CANNON', effect: 'Faster cooling and higher damage' },
  { id: 'rockets', name: 'EXTENDED HYDRA RACK', effect: '+6 rockets and blast tuning per tier' },
  { id: 'avionics', name: 'KITE-EYE AVIONICS', effect: 'Higher speed and target response' },
];
export const upgradeCost = (tier) => 1000 * (tier + 1);

export function hangarScreen(state) {
  const t = state.save;
  const cards = UPGRADES.map((a) => {
    const s = t.upgrades[a.id] || 0;
    const u = upgradeCost(s);
    const pips = [0, 1, 2].map((c) => `<i class="${c < s ? 'filled' : ''}"></i>`).join('');
    return `<article><p>SYSTEM · ${a.id.toUpperCase()}</p><h3>${a.name}</h3><span>${a.effect}</span><div class="tier-pips">${pips}</div>
      <button type="button" data-action="buy" data-arg="${a.id}" ${s >= 3 || t.credits < u ? 'disabled' : ''}>${s >= 3 ? 'MAXIMUM TIER' : `INSTALL · ${u.toLocaleString()} CR`}</button></article>`;
  }).join('');
  return `<section class="screen-panel hangar-screen">
    ${head('VQ-88 SYSTEMS BAY', 'NIGHTJAR HANGAR', 'hangar-back')}
    <div class="hangar-layout">
      <article class="hangar-airframe">
        <div class="wire-heli">VQ<span>88</span></div>
        <p>${esc(CREW.aircraft)}</p>
        <strong>AVAILABLE CREDITS · ${t.credits.toLocaleString()}</strong>
        <small>All operations are completable with the stock airframe. Upgrades are side-grade advantages and can never lock campaign progress.</small>
      </article>
      <div class="upgrade-grid">${cards}</div>
    </div>
  </section>`;
}

/* ------------------------------------------------------------ credits */

export function creditsScreen(state) {
  const reserve = MISSIONS.find((m) => m.reserve);
  const open = reserve && MISSIONS.indexOf(reserve) < state.save.unlocked && !state.save.completed.includes(reserve.id);
  return `<section class="credits-screen"><div>
    <p>MERIDIAN COMPACT · FINAL LOG</p>
    <h1>THE SKY<br />BELONGS TO<br /><span>EVERYONE.</span></h1>
    <p>Five emergencies ended without a new empire, a clean villain, or an easy answer. Oris exposes its manufactured water panic. Ordan’s grain moves under public manifests. Veyra keeps its paper archive. Namarq rewrites the polar treaty. Serea gives its peacekeeper a power switch.</p>
    ${open ? `<p class="credit-teaser">RESERVE TASKING RECEIVED · ${esc(reserve.operation)} ${esc(reserve.title)} IS OPEN IN OPERATIONS</p>` : ''}
    <p class="credit-line">SKYSHIELD: 2026 · AN ORIGINAL FICTIONAL GAME<br />DESIGN, CODE, STORY &amp; REALTIME ART</p>
    <button type="button" data-action="go-title" data-autofocus>RETURN TO TITLE</button>
  </div></section>`;
}

/* ------------------------------------------------------------ modals */

function modal(title, body, closeAction = 'close-modal') {
  const id = `modal-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return `<section class="modal-wrap"><div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="${id}">
    <header><div><p>VQ-88 NIGHTJAR</p><h2 id="${id}">${esc(title)}</h2></div><button type="button" data-action="${closeAction}" aria-label="Close">CLOSE ×</button></header>
    ${body}
  </div></section>`;
}

const MANUAL = [
  [
    'FLIGHT',
    [
      ['Planar movement', 'WASD / arrows', 'Left stick / D-pad', 'Stick (left side)'],
      ['Climb / descend', 'E / Q', 'RB / LB', 'UP / DN pills'],
      ['Desert cruise boost', 'Shift', 'L3 (left stick click)', 'BOOST'],
      ['Aim nose / reticle', 'Mouse', 'Right stick', 'Hold FIRE: auto-face'],
    ],
  ],
  [
    'COMBAT',
    [
      ['20mm cannon', 'Space / left click / J', 'RT or X', 'FIRE'],
      ['Hydra rockets', 'R / right click / K', 'LT', 'RKT'],
      ['Flare countermeasure', 'F', 'B', 'FLR'],
      ['Tactical / chase camera', 'Tab or C', 'R3 (right stick click)', 'CAM pill'],
    ],
  ],
  [
    'MISSION',
    [
      ['Service at a teal FARP', 'X (hold)', 'A (hold)', 'SERV (over a FARP)'],
      ['Full-theater map', 'M', 'View / Back', 'MAP pill'],
      ['Pause & checkpoint', 'Esc or P', 'Start / Menu', 'II pill'],
      ['Graphics & controls panel', 'F9', 'Pause → Graphics', 'Pause → Graphics'],
    ],
  ],
];

export function manualModal(source) {
  const col = source === 'gamepad' ? 2 : source === 'touch' ? 3 : 1;
  const label = source === 'gamepad' ? 'CONTROLLER' : source === 'touch' ? 'TOUCH' : 'KEYBOARD & MOUSE';
  const body = `<div class="manual-grid">
    ${MANUAL.map(
      ([title, rows]) =>
        `<article><h3>${title}</h3>${rows.map((r) => `<p><b>${esc(r[col])}</b> — ${esc(r[0])}</p>`).join('')}</article>`
    ).join('')}
    <article class="manual-wide"><h3>OBJECTIVES</h3>
      <p>Amber diamonds track hostile targets — face them and fire.</p>
      <p>Amber rings activate automatically when you enter low (below 200 m).</p>
      <p>Flares break missile locks; the cannon overheats past 93% — let it breathe.</p>
      <p>Showing ${label} prompts · prompts follow the last device you used.</p>
    </article>
  </div>`;
  return modal('FIELD MANUAL', body);
}

export function settingsModal(settings, inFlight) {
  const keys = ['masterVolume', 'musicVolume', 'sfxVolume', 'hudScale', 'difficulty', 'camera', 'subtitles', 'cameraShake', 'reducedMotion', 'aimAssist', 'colorMode'];
  const body = `<div class="settings-grid">
    ${keys.map((k) => cycler(k, settings)).join('')}
    <button type="button" class="settings-kit" data-action="open-kit"><span>GRAPHICS &amp; CONTROLS</span><b>QUALITY · TOUCH · VIBRATION ›</b></button>
    ${inFlight ? '' : '<p class="settings-note">Deployment length is chosen in each operation’s briefing.</p>'}
  </div>`;
  return modal('SETTINGS / ACCESSIBILITY', body);
}

export function confirmModal() {
  return `<section class="modal-wrap"><div class="modal-panel confirm-panel" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
    <header><div><p>VQ-88 NIGHTJAR</p><h2 id="confirm-title">START A NEW CAMPAIGN?</h2></div></header>
    <p class="confirm-copy">Current mission progress, unlocks and upgrades will be erased. Best records are kept.</p>
    <div class="confirm-actions"><button type="button" data-action="close-modal" data-autofocus>KEEP MY CAMPAIGN</button><button type="button" class="primary" data-action="confirm-new">ERASE &amp; START</button></div>
  </div></section>`;
}
