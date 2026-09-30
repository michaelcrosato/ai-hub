/**
 * game.js — the career simulation and its interface: the heads-up display,
 * management panels, dialogs, dates, daily events, time and needs, and the
 * frame loop that hands input to either the menus or the city.
 *
 * Rebuilt from the original minified bundle: the logic and every line of
 * content are the original's, with readable names, bug fixes and additions.
 */

import { CAMPAIGNS, LOCATIONS, PACKAGES, REGIONS, SKILLS, STAFF, STRUCTURES } from './data.js';
import {
  addLeads,
  addTransaction,
  chance,
  clamp,
  clearSave,
  clock,
  createCareer,
  createLead,
  dailyOverhead,
  levelForXp,
  loadCareer,
  logJournal,
  money,
  pick,
  randInt,
  randRange,
  riskScore,
  saveCareer,
  uid,
  weekday,
  xpForLevel,
} from './career.js';
import { audio } from './audio.js';
import { createNav } from './nav.js';

/** The kit from boot() and the menu navigator, set by initGame(). */
let kit = null;
let nav = null;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const startScreen = $('#start-screen');
const managementPanel = $('#management-panel');
const panelScrim = $('#panel-scrim');
const modalRoot = $('#modal-root');
const dock = $('#dock');
const toastStack = $('#toast-stack');
const minimapCanvas = $('#minimap');
const minimapCtx = minimapCanvas.getContext('2d');
const saveImportInput = $('#save-import-input');
const hud = {
  topbar: $('#topbar'),
  hudLeft: $('#hud-left'),
  worldInfo: $('#world-info'),
  minimapWrap: $('#minimap-wrap'),
  interactionPrompt: $('#interaction-prompt'),
  bookingAlert: $('#booking-alert'),
  regionLabel: $('#region-label'),
  dayLabel: $('#day-label'),
  timeLabel: $('#time-label'),
  topStats: $('#top-stats'),
  playerName: $('#player-name-label'),
  levelLabel: $('#level-label'),
  portrait: $('#portrait-orb span'),
  needBars: $('#need-bars'),
  objectiveTitle: $('#objective-title'),
  objectiveText: $('#objective-text'),
  nearbyName: $('#nearby-name'),
  nearbyDescription: $('#nearby-description'),
  rainOverlay: $('#rain-overlay'),
  audioButton: $('#audio-button'),
};

const DOCK_TABS = [
  { id: 'dashboard', icon: '◆', label: 'Overview' },
  { id: 'clients', icon: 'C', label: 'Clients' },
  { id: 'calendar', icon: '▦', label: 'Bookings' },
  { id: 'business', icon: '$', label: 'Business' },
  { id: 'marketing', icon: '↗', label: 'Marketing' },
  { id: 'safety', icon: '◇', label: 'Safety' },
  { id: 'wellness', icon: '+', label: 'Wellness' },
  { id: 'regions', icon: '◎', label: 'Regions' },
  { id: 'career', icon: '▲', label: 'Career' },
  { id: 'journal', icon: '≡', label: 'Journal' },
];

/** The career being played (null on the title screen). */
let state = null;
/** The 3D city (world.js), built once at boot and reused for every career. */
let world = null;
let activePanel = null;
let modalOpen = false;
let dateSession = null;
let minimapTimer = 0;
let autosaveTimer = 0;
let reminderTimer = 0;
let pendingEvent = null;
/** A parsed save waiting for "Replace career" in the import dialog. */
let pendingImport = null;
/** Bookings that already had their "starting soon" / "running late" reminder. */
const remindedBookings = new Set();
/** Last HTML/text written to each HUD element, so unchanged values skip the DOM. */
const hudCache = new Map();

function setHtml(el, key, html) {
  if (hudCache.get(key) === html) return;
  hudCache.set(key, html);
  el.innerHTML = html;
}

function setText(el, key, text) {
  if (hudCache.get(key) === text) return;
  hudCache.set(key, text);
  el.textContent = text;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function possessive() {
  return state.pronouns === 'she' ? 'her' : state.pronouns === 'he' ? 'his' : 'their';
}

function riskClass(value) {
  return value >= 66 ? 'danger' : value >= 38 ? 'warn' : 'good';
}

function levelClass(value, inverted = false) {
  const score = inverted ? 100 - value : value;
  return score >= 65 ? 'good' : score >= 35 ? 'warn' : 'danger';
}

function initials(name) {
  return String(name)
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] || '')
    .join('')
    .toUpperCase();
}

function absMinute(day, minute) {
  return (day - 1) * 1440 + minute;
}

function nowMinute() {
  return absMinute(state.day, state.minute);
}

function findClient(id) {
  return (
    state.prospects.find((c) => c.id === id) ||
    state.clients.find((c) => c.id === id) ||
    state.blacklist.find((c) => c.id === id) ||
    null
  );
}

function findBooking(id) {
  return state.bookings.find((b) => b.id === id) || null;
}

function bookingClient(booking) {
  return (
    findClient(booking.clientId) || {
      id: booking.clientId,
      name: booking.clientName,
      initials: initials(booking.clientName),
      personality: 'Unknown',
      personalityId: 'reserved',
      bestStyle: 'measured',
      interests: ['conversation'],
      trust: 35,
      risk: booking.screenedRisk,
      dates: 0,
      lifetimeValue: 0,
    }
  );
}

function upcomingBookings() {
  const now = nowMinute();
  return state.bookings
    .filter((b) => b.status === 'scheduled' && absMinute(b.day, b.minute) >= now - 90)
    .sort((a, b) => absMinute(a.day, a.minute) - absMinute(b.day, b.minute));
}

function campaignLeadRate() {
  return state.marketing.active.reduce((total, entry) => {
    const campaign = CAMPAIGNS[entry.id];
    return total + (campaign ? campaign.leads / Math.max(1, campaign.duration) : 0);
  }, 0);
}

function staffSafety() {
  return Object.entries(state.business.staff).reduce(
    (total, [role, hired]) => total + (hired ? STAFF[role].safety : 0),
    0,
  );
}

function safetyIndex() {
  const protocolBonus = Object.values(state.protocols).filter(Boolean).length * 5;
  const structureBonus = STRUCTURES[state.business.structure].safety;
  const skillBonus = state.skills.safety * 8 + state.skills.screening * 5;
  const peerBonus = state.personal.peerSupport * 0.15;
  const penalty = state.legalHeat * 0.25 + state.player.stress * 0.1;
  return clamp(
    Math.round(40 + protocolBonus + structureBonus + staffSafety() + skillBonus + peerBonus - penalty),
  );
}

function normalizeCareer(saved) {
  const base = createCareer({
    name: saved.name || 'Alex Parker',
    pronouns: saved.pronouns || 'they',
    regionId: saved.regionId || 'pacific',
    backgroundId: saved.backgroundId || 'careful',
  });
  const merged = {
    ...base,
    ...saved,
    player: { ...base.player, ...(saved.player || {}) },
    skills: { ...base.skills, ...(saved.skills || {}) },
    business: {
      ...base.business,
      ...(saved.business || {}),
      prices: { ...base.business.prices, ...(saved.business?.prices || {}) },
      staff: { ...base.business.staff, ...(saved.business?.staff || {}) },
    },
    protocols: { ...base.protocols, ...(saved.protocols || {}) },
    marketing: { ...base.marketing, ...(saved.marketing || {}) },
    personal: { ...base.personal, ...(saved.personal || {}) },
    health: { ...base.health, ...(saved.health || {}) },
    goals: { ...base.goals, ...(saved.goals || {}) },
    storyFlags: { ...base.storyFlags, ...(saved.storyFlags || {}) },
    world: { ...base.world, ...(saved.world || {}) },
    settings: { ...base.settings, ...(saved.settings || {}) },
    trends: { ...base.trends, ...(saved.trends || {}) },
    daily: { ...base.daily, ...(saved.daily || {}) },
  };
  merged.storyFlags.milestones = { ...(merged.storyFlags.milestones || {}) };
  if (!REGIONS[merged.regionId]) merged.regionId = 'pacific';
  if (!Number.isFinite(merged.world.x) || !Number.isFinite(merged.world.z)) {
    merged.world.x = base.world.x;
    merged.world.z = base.world.z;
  }
  if (!Number.isFinite(merged.debt)) merged.debt = 0;
  // A reload in the middle of a date leaves no session to finish it: put the booking back.
  for (const booking of merged.bookings || []) {
    if (booking.status === 'in-progress') booking.status = 'scheduled';
  }
  merged.level = levelForXp(merged.xp || 0);
  return merged;
}

function populateStartScreen() {
  const select = $('#start-region');
  select.innerHTML = Object.values(REGIONS)
    .map(
      (region) =>
        `<option value="${region.id}">${escapeHtml(region.name)} — ${escapeHtml(region.short)}</option>`,
    )
    .join('');
  $('#title-notice').classList.add('hidden');
  const save = loadCareer();
  $('#continue-button').classList.toggle('hidden', !save);
  if (save) {
    $('#continue-button').textContent = `Continue ${save.name} · Day ${save.day}`;
  }
  disarmNewCareer();
}

/** "Begin career" over an existing save asks for a second press first. */
let newCareerArmed = false;
function disarmNewCareer() {
  newCareerArmed = false;
  $('#new-game-button').textContent = 'Begin career';
  $('#overwrite-warning').classList.add('hidden');
}

const HUD_ELEMENTS = () => [hud.topbar, hud.hudLeft, hud.worldInfo, hud.minimapWrap, dock];

function showHud() {
  HUD_ELEMENTS().forEach((el) => el.classList.remove('hidden'));
}

function hideHud() {
  HUD_ELEMENTS().forEach((el) => el.classList.add('hidden'));
  hud.bookingAlert.classList.add('hidden');
  hud.interactionPrompt.classList.add('hidden');
}

function startCareer(career) {
  state = normalizeCareer(career);
  routeTarget = null;
  pendingCounter = null;
  pendingEvent = null;
  dateSession = null;
  remindedBookings.clear();
  hudCache.clear();
  if (modalOpen) {
    modalRoot.innerHTML = '';
    modalOpen = false;
  }
  if (activePanel) closePanel();
  world.load(state);
  startScreen.classList.add('hidden');
  showHud();
  renderDock();
  updateHud(true);
  onNearbyChange(null);
  markTarget(nextBookingVenue());
  if (state.settings.audio) {
    audio.start().catch(() => {
      state.settings.audio = false;
      hud.audioButton.classList.remove('active');
    });
  }
  audio.setRain(state.world.weather === 'rain');
  hud.audioButton.classList.toggle('active', state.settings.audio);
  saveCareer(state);
  kit.input.settle();
  if (state.storyFlags.tutorialShown) {
    notify('Career loaded', `Day ${state.day} in ${REGIONS[state.regionId].name}.`, 'info');
  } else {
    state.storyFlags.tutorialShown = true;
    setTimeout(() => showTutorial(), 150);
  }
}

/** Leave the city for the title screen (the career stays saved). */
function returnToTitle({ keepSave = true } = {}) {
  if (state && keepSave) saveCareer(state);
  dateSession = null;
  pendingEvent = null;
  modalRoot.innerHTML = '';
  modalOpen = false;
  if (activePanel) closePanel();
  state = null;
  audio.stop();
  hideHud();
  startScreen.classList.remove('hidden');
  populateStartScreen();
  nav.clear();
  kit.input.settle();
}

function renderDock() {
  dock.innerHTML = DOCK_TABS.map((tab) => {
    let badge = '';
    if (tab.id === 'clients' && state.prospects.length) {
      badge = `<span class="badge">${state.prospects.length}</span>`;
    }
    if (tab.id === 'calendar') {
      const count = state.bookings.filter((b) => b.status === 'scheduled').length;
      if (count) {
        badge = `<span class="badge">${count}</span>`;
      }
    }
    if (tab.id === 'safety' && safetyIndex() < 55) {
      badge = '<span class="badge">!</span>';
    }
    return `
      <button class="dock-button ${activePanel === tab.id ? 'active' : ''}" data-action="open-panel" data-tab="${tab.id}" title="${tab.label}">
        <span class="dock-icon">${tab.icon}</span>
        <small>${tab.label}</small>
        ${badge}
      </button>
    `;
  }).join('');
}

function openPanel(tab = 'dashboard') {
  const switching = activePanel !== tab;
  activePanel = tab;
  managementPanel.classList.remove('hidden');
  panelScrim.classList.remove('hidden');
  renderDock();
  renderPanel(tab, { keepScroll: !switching });
  if (switching && kit?.input.source === 'gamepad') nav.focusFirst([managementPanel]);
}

function closePanel() {
  activePanel = null;
  managementPanel.classList.add('hidden');
  panelScrim.classList.add('hidden');
  renderDock();
  nav?.clear();
}

/** LB / RB (or Q / R) step through the management tabs. */
function cyclePanel(step) {
  const index = DOCK_TABS.findIndex((tab) => tab.id === activePanel);
  const next = DOCK_TABS[(index + step + DOCK_TABS.length) % DOCK_TABS.length];
  openPanel(next.id);
}

function panelFrame(title, subtitle, body) {
  return `
    <div class="panel-header">
      <div class="panel-title"><h2>${title}</h2><p>${subtitle}</p></div>
      <button class="panel-close" data-action="close-panel" aria-label="Close panel">×</button>
    </div>
    <div class="panel-body">${body}</div>
  `;
}

/**
 * Draw a management tab. Re-drawing the same tab after an action keeps the
 * scroll position and the highlighted control, so a purchase halfway down
 * the Business tab no longer jumps back to the top.
 */
function renderPanel(tab, { keepScroll = true } = {}) {
  if (!state) {
    return;
  }
  const body = managementPanel.querySelector('.panel-body');
  const scrollTop = keepScroll && body ? body.scrollTop : 0;
  const focused = document.activeElement;
  const focusKey =
    keepScroll && focused && managementPanel.contains(focused) && focused.dataset
      ? Object.entries(focused.dataset)
          .map(([k, v]) => `[data-${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}="${CSS.escape(v)}"]`)
          .join('')
      : '';
  const renderers = {
    dashboard: dashboardPanel,
    clients: clientsPanel,
    calendar: calendarPanel,
    business: businessPanel,
    marketing: marketingPanel,
    safety: safetyPanel,
    wellness: wellnessPanel,
    regions: regionsPanel,
    career: careerPanel,
    journal: journalPanel,
  };
  managementPanel.innerHTML = makeCardsFocusable((renderers[tab] || dashboardPanel)());
  const nextBody = managementPanel.querySelector('.panel-body');
  if (nextBody && scrollTop) nextBody.scrollTop = scrollTop;
  if (focusKey) {
    const again = managementPanel.querySelector(focusKey);
    if (again && !again.disabled) {
      again.focus({ preventScroll: true });
      if (kit?.input.source === 'gamepad') again.classList.add('nav-focus');
    }
  }
}

/** Clickable cards are <div>s: give them a tab stop and a button role. */
function makeCardsFocusable(html) {
  return html.replace(
    /<div class="([^"]*)"(\s+)data-action=/g,
    '<div class="$1" tabindex="0" role="button"$2data-action=',
  );
}

function notify(title, text, tone = 'info', duration = 4200) {
  const toast = document.createElement('div');
  toast.className = `toast ${tone}`;
  toast.innerHTML = `<strong>${escapeHtml(title)}</strong><p>${escapeHtml(text)}</p>`;
  toastStack.appendChild(toast);
  while (toastStack.children.length > 5) {
    toastStack.firstElementChild.remove();
  }
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(18px)';
    setTimeout(() => toast.remove(), 220);
  }, duration);
  audio.blip(tone === 'good' ? 'success' : tone === 'danger' ? 'danger' : 'soft');
}

function openModal({
  eyebrow = '',
  title,
  subtitle = '',
  body = '',
  footer = '',
  wide = false,
  closeable = true,
}) {
  modalOpen = true;
  modalRoot.innerHTML = makeCardsFocusable(`
    <div class="modal-backdrop" data-modal-backdrop="${closeable ? 'close' : 'locked'}">
      <section class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
        <div class="modal-header">
          ${eyebrow ? `<span class="eyebrow">${eyebrow}</span>` : ''}
          <h2>${title}</h2>
          ${subtitle ? `<p>${subtitle}</p>` : ''}
        </div>
        <div class="modal-body">${body}</div>
        ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
      </section>
    </div>
  `);
  modalRoot.dataset.closeable = closeable ? 'true' : 'false';
  nav?.clear();
  // A controller player gets the first choice highlighted straight away.
  if (kit?.input.source === 'gamepad') nav.focusFirst([modalRoot]);
}

/**
 * Close the open dialog. A date in progress cannot be closed. A daily event
 * that arrived while this dialog was open is shown next.
 */
function closeModal() {
  if (dateSession?.locked) {
    return;
  }
  modalRoot.innerHTML = '';
  modalOpen = false;
  dateSession = null;
  nav?.clear();
  kit?.input.settle();
  if (pendingEvent) {
    const queued = pendingEvent;
    pendingEvent = null;
    setTimeout(() => showDailyEvent(queued), 80);
  }
}

function showTutorial() {
  openModal({
    eyebrow: 'START HERE',
    title: 'A career is more than a calendar',
    subtitle: 'This prototype combines direct character control with a systems-driven management loop.',
    wide: true,
    body: `
      <div class="grid three">
        <div class="card"><h4>1 · Screen leads</h4><p>Open Clients, inspect risk signals, choose verification steps, negotiate a quote, and schedule the booking.</p></div>
        <div class="card"><h4>2 · Prepare and travel</h4><p>Use the city, not only menus. Visit home, the clinic, studio, peer network, venues, and the terminal. Reach bookings on time.</p></div>
        <div class="card"><h4>3 · Manage the date</h4><p>Conversation, composure, boundaries, logistics, and safety choices determine the result, review, tip, and future relationship.</p></div>
      </div>
      <div class="panel-section" style="margin-top:16px">
        <div class="section-heading"><div><h3>Controls</h3><p>Management pauses the clock. City movement resumes when panels and modals are closed.</p></div></div>
        <div class="grid four">${controlCards()}</div>
      </div>
      <div class="card" style="margin-top:12px"><h4>Content approach</h4><p>Every character is an adult. The game models professional companionship through conversation, consent, boundaries, scheduling, safety, money, wellbeing, and non-graphic outcomes.</p></div>
    `,
    footer: '<button class="primary" data-action="tutorial-finish">Open client leads</button>',
    closeable: false,
  });
}

/** The four control cards, worded for the device the player is using. */
function controlCards() {
  const source = kit?.input.source || 'keyboard';
  const cards =
    source === 'gamepad'
      ? [
          ['Left stick', 'Move through the city.'],
          ['Hold B or LT', 'Run while energy allows.'],
          ['Right stick · LB/RB', 'Orbit and zoom the camera.'],
          ['A · Y · Start', 'Interact, management, pause menu.'],
        ]
      : source === 'touch'
        ? [
            ['Left thumb', 'Drag to walk; push fully to run.'],
            ['Right side', 'Drag to orbit, pinch to zoom.'],
            ['Enter button', 'Appears beside a location.'],
            ['CAD · ☰', 'Management and the pause menu.'],
          ]
        : [
            ['WASD / arrows', 'Move through the city.'],
            ['Shift', 'Run while energy allows.'],
            ['Mouse drag · wheel', 'Orbit and zoom the camera.'],
            ['E · Tab · Esc', 'Interact, management, pause menu.'],
          ];
  return cards.map(([title, text]) => `<div class="card"><h4>${title}</h4><p>${text}</p></div>`).join('');
}

function showHelp() {
  openModal({
    eyebrow: 'CONTROLS & SETTINGS',
    title: 'How to play',
    subtitle: 'Adjust performance options at any time. Save data remains in this browser.',
    wide: true,
    body: `
      <div class="grid two">
        <div class="card">
          <h4>World controls</h4>
          <div class="stat-row"><span>Move</span><strong>WASD / arrows · left stick · left thumb</strong></div>
          <div class="stat-row"><span>Run</span><strong>Shift · B or LT · push the stick fully</strong></div>
          <div class="stat-row"><span>Interact</span><strong>E · A · Enter button</strong></div>
          <div class="stat-row"><span>Management</span><strong>Tab · Y · CAD button</strong></div>
          <div class="stat-row"><span>Switch tabs</span><strong>Q / R · LB / RB</strong></div>
          <div class="stat-row"><span>Camera</span><strong>Drag + wheel · right stick + LB/RB · drag + pinch</strong></div>
          <div class="stat-row"><span>Time speed</span><strong>T · View button</strong></div>
          <div class="stat-row"><span>Pause menu</span><strong>Esc / P · Start · ☰</strong></div>
        </div>
        <div class="card">
          <h4>Graphics</h4>
          <div class="switch-row"><div class="switch-copy"><strong>Bloom</strong><p>Neon glow and highlights</p></div><label class="switch"><input id="setting-bloom" type="checkbox" ${state.settings.bloom ? 'checked' : ''}><i></i></label></div>
          <div class="switch-row"><div class="switch-copy"><strong>Dynamic shadows</strong><p>Higher GPU cost</p></div><label class="switch"><input id="setting-shadows" type="checkbox" ${state.settings.shadows ? 'checked' : ''}><i></i></label></div>
          <div class="switch-row"><div class="switch-copy"><strong>Reduced motion</strong><p>Stops traffic, crowds, and weather particles</p></div><label class="switch"><input id="setting-motion" type="checkbox" ${state.settings.reducedMotion ? 'checked' : ''}><i></i></label></div>
          <div class="button-row"><button class="secondary" data-action="open-display-settings">Display, quality &amp; controls…</button></div>
        </div>
      </div>
      <div class="card" style="margin-top:12px"><h4>Simulation rules</h4><p>One real second advances roughly two in-game minutes at 1×. Panels pause time. Bookings have a 30-minute early arrival window and become missed 90 minutes after their start. A reminder sounds when a booking is an hour away. Region names and legal systems are fictionalized.</p></div>
    `,
    footer:
      '<button class="secondary" data-action="close-modal">Cancel</button><button class="primary" data-action="apply-settings">Apply settings</button>',
  });
}

/** Words for the "nothing nearby" hint, per input device. */
function roamHint() {
  const source = kit?.input.source;
  if (source === 'gamepad') return 'Left stick to move, hold B to run. Right stick orbits the camera.';
  if (source === 'touch') return 'Drag on the left to walk, push fully to run. Drag on the right to look.';
  return 'Move with WASD. Hold Shift to run. Drag to orbit the camera.';
}

/** The key shown in the "Enter …" prompt, per input device. */
function syncPromptKey() {
  const key = hud.interactionPrompt.querySelector('kbd');
  const source = kit?.input.source;
  key.textContent = source === 'gamepad' ? 'A' : source === 'touch' ? 'TAP' : 'E';
}

function onNearbyChange(location) {
  if (!state) {
    return;
  }
  syncPromptKey();
  if (location) {
    hud.nearbyName.textContent = location.name;
    hud.nearbyDescription.textContent = location.description;
    hud.interactionPrompt.classList.remove('hidden');
    hud.interactionPrompt.querySelector('span').textContent = `Enter ${location.name}`;
    kit.touch?.setShown('interact', true);
    kit.input.rumble(0.15, 40);
  } else {
    hud.nearbyName.textContent = 'Downtown';
    hud.nearbyDescription.textContent = roamHint();
    hud.interactionPrompt.classList.add('hidden');
    kit.touch?.setShown('interact', false);
  }
}

function currentObjective() {
  const next = upcomingBookings()[0];
  if (state.player.health < 45) {
    return ['Prioritize your health', 'Visit Harbour Health Clinic before taking another booking.'];
  }
  if (state.player.energy < 28 || state.player.stress > 78) {
    return ['Recover before working', 'Return home, visit the park, or book professional support.'];
  }
  if (state.player.hunger < 20) {
    return ['Eat something', 'Hunger is draining your energy. Eat at home or order food from Wellness.'];
  }
  if (next) {
    const minutesUntil = absMinute(next.day, next.minute) - nowMinute();
    return minutesUntil <= 120
      ? [
          `Reach ${LOCATIONS[next.venueId].name}`,
          `${next.clientName} is due ${minutesUntil < 0 ? `${Math.floor(-minutesUntil)} minutes ago` : `in ${Math.ceil(minutesUntil)} minutes`}.`,
        ]
      : [
          'Prepare the next booking',
          `${PACKAGES[next.packageId].short} with ${next.clientName} on Day ${next.day} at ${clock(next.minute)}.`,
        ];
  }
  return state.prospects.length
    ? ['Build your client list', 'Open Clients, screen a lead, and negotiate a booking.']
    : ['Generate new demand', 'Run a marketing campaign or network at a city venue.'];
}

/**
 * Refresh the heads-up display. It runs often (time passes every frame), so
 * each element is only written when its content actually changed.
 */
function updateHud(refreshDock = false) {
  if (!state) {
    return;
  }
  state.level = levelForXp(state.xp);
  const region = REGIONS[state.regionId];
  setText(hud.regionLabel, 'region', region.name);
  setText(hud.dayLabel, 'day', `${weekday(state.day)} · DAY ${state.day}`);
  setText(hud.timeLabel, 'time', clock(state.minute));
  setText(hud.playerName, 'name', state.name);
  setText(hud.levelLabel, 'level', `LEVEL ${state.level}`);
  setText(hud.portrait, 'portrait', initials(state.name));
  const stats = [
    ['Cash', money(state.money), state.money < 300 ? 'danger' : state.money < 900 ? 'warn' : 'good'],
    ['Reputation', `${Math.round(state.reputation)}/100`, levelClass(state.reputation)],
    ['Exposure', `${Math.round(state.exposure)}/100`, levelClass(state.exposure, true)],
    ['Legal heat', `${Math.round(state.legalHeat)}/100`, riskClass(state.legalHeat)],
    [
      'Today',
      money(state.daily.revenue - state.daily.expenses),
      state.daily.revenue >= state.daily.expenses ? 'good' : 'warn',
    ],
  ];
  setHtml(
    hud.topStats,
    'stats',
    stats
      .map(
        ([label, value, tone]) =>
          `<div class="top-stat"><span>${label}</span><strong class="${tone}">${value}</strong></div>`,
      )
      .join(''),
  );
  const needs = [
    ['Energy', state.player.energy, false],
    ['Stress', state.player.stress, true],
    ['Health', state.player.health, false],
    ['Hygiene', state.player.hygiene, false],
    ['Hunger', state.player.hunger, false],
  ];
  setHtml(
    hud.needBars,
    'needs',
    needs
      .map(([label, value, inverted]) => {
        const width = Math.round(inverted ? 100 - value : value);
        return `<div class="need-row"><span>${label}</span><div class="meter ${levelClass(value, inverted)}"><i style="width:${width}%"></i></div></div>`;
      })
      .join(''),
  );
  const [title, text] = currentObjective();
  setText(hud.objectiveTitle, 'objTitle', title);
  setText(hud.objectiveText, 'objText', text);
  updateBookingAlert();
  syncSpeedButtons();
  const rainy = state.world.weather === 'rain' && !state.settings.reducedMotion;
  if (hudCache.get('rain') !== rainy) {
    hudCache.set('rain', rainy);
    hud.rainOverlay.classList.toggle('active', rainy);
    audio.setRain(state.world.weather === 'rain');
  }
  if (refreshDock) {
    renderDock();
  }
}

function syncSpeedButtons() {
  if (hudCache.get('speed') === state.speed) return;
  hudCache.set('speed', state.speed);
  $$('.time-controls button').forEach((button) =>
    button.classList.toggle('active', Number(button.dataset.speed) === state.speed),
  );
}

function nextBookingVenue() {
  const next = upcomingBookings()[0];
  return next && absMinute(next.day, next.minute) - nowMinute() <= 240 ? next.venueId : null;
}

/** Highlight a location marker only when the target really changes. */
function markTarget(id) {
  if (hudCache.get('target') === (id || null)) return;
  hudCache.set('target', id || null);
  world?.setTarget(id);
}

function updateBookingAlert() {
  const next = upcomingBookings()[0];
  const minutesUntil = next ? absMinute(next.day, next.minute) - nowMinute() : 0;
  const rounded = minutesUntil >= 0 ? Math.ceil(minutesUntil) : Math.floor(minutesUntil);
  if (!next || rounded > 180 || rounded < -90) {
    if (hudCache.get('alertShown') !== false) {
      hudCache.set('alertShown', false);
      hud.bookingAlert.classList.add('hidden');
    }
    markTarget(routeTarget);
    return;
  }
  const venue = LOCATIONS[next.venueId];
  const countdown = rounded >= 0 ? `Starts in ${rounded} min` : `${Math.abs(rounded)} min late`;
  setHtml(
    hud.bookingAlert,
    'alert',
    `<strong>${escapeHtml(next.clientName)} · ${PACKAGES[next.packageId].short}</strong><p>${escapeHtml(venue.name)} · ${money(next.quote)} · screened risk ${next.screenedRisk}/100</p><div class="countdown">${countdown}</div>`,
  );
  if (hudCache.get('alertShown') !== true) {
    hudCache.set('alertShown', true);
    hud.bookingAlert.classList.remove('hidden');
  }
  markTarget(routeTarget || next.venueId);
}

function drawMinimap() {
  if (!state || !world) {
    return;
  }
  const ctx = minimapCtx;
  const size = minimapCanvas.width;
  const toMap = (coord) => ((coord + 145) / 290) * size;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = 'rgba(5,7,12,.82)';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(255,255,255,.12)';
  ctx.lineWidth = 10;
  [-70, 0, 70].forEach((line) => {
    ctx.beginPath();
    ctx.moveTo(0, toMap(line));
    ctx.lineTo(size, toMap(line));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(toMap(line), 0);
    ctx.lineTo(toMap(line), size);
    ctx.stroke();
  });
  const target = routeTarget || nextBookingVenue();
  // North (-Z) is up and +X is right: the same way round as the city seen from
  // the starting camera. (The old map was mirrored top to bottom.)
  Object.values(LOCATIONS).forEach((loc) => {
    const x = toMap(loc.x);
    const y = toMap(loc.z);
    ctx.beginPath();
    ctx.arc(x, y, loc.id === target ? 4.5 : 2.7, 0, Math.PI * 2);
    ctx.fillStyle = `#${loc.color.toString(16).padStart(6, '0')}`;
    ctx.fill();
    if (loc.id === target) {
      ctx.strokeStyle = 'rgba(255,255,255,.85)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  });
  const px = toMap(state.world.x);
  const py = toMap(state.world.z);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(Math.PI - world.player.rotation.y);
  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.lineTo(5, 6);
  ctx.lineTo(-5, 6);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#f19ac2';
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.restore();
}

function decayNeeds(minutes) {
  const player = state.player;
  player.energy = clamp(player.energy - minutes * 0.022);
  player.hunger = clamp(player.hunger - minutes * 0.032);
  player.hygiene = clamp(player.hygiene - minutes * 0.014);
  player.stress = clamp(
    player.stress + minutes * (state.bookings.some((b) => b.status === 'scheduled') ? 0.006 : 0.002),
  );
  if (player.hunger < 20) {
    player.energy = clamp(player.energy - minutes * 0.012);
  }
  if (player.energy < 20) {
    player.stress = clamp(player.stress + minutes * 0.01);
  }
  state.health.burnout = clamp(
    state.health.burnout +
      (Math.max(0, player.stress - 60) * minutes) / 18000 -
      (Math.max(0, 55 - player.stress) * minutes) / 30000,
  );
}

function advanceTime(minutes, { noNeedDecay = false } = {}) {
  if (!state || minutes <= 0) {
    return;
  }
  const before = nowMinute();
  if (!noNeedDecay) {
    decayNeeds(minutes);
  }
  state.minute += minutes;
  while (state.minute >= 1440) {
    state.minute -= 1440;
    startNewDay();
  }
  checkMissedBookings(before, nowMinute());
  updateHud();
}

function checkMissedBookings(from, to) {
  state.bookings.forEach((booking) => {
    if (booking.status !== 'scheduled') {
      return;
    }
    const start = absMinute(booking.day, booking.minute);
    if (to > start + 90 && from <= start + 90) {
      booking.status = 'missed';
      state.reputation = clamp(state.reputation - 6);
      state.player.stress = clamp(state.player.stress + 11);
      state.legalHeat = clamp(state.legalHeat + 1);
      const refund = Math.round((booking.depositAmount || 0) * 1.25);
      if (refund) {
        addTransaction(state, -refund, `Refund and inconvenience fee: ${booking.clientName}`, 'refund');
      }
      logJournal(
        state,
        'Booking missed',
        `${booking.clientName} was left waiting at ${LOCATIONS[booking.venueId].name}. Reputation fell and the deposit was refunded.`,
        'booking',
      );
      notify('Booking missed', `${booking.clientName} has cancelled after waiting 90 minutes.`, 'danger');
    }
  });
}

function startNewDay() {
  const endedDay = state.day;
  const datesToday = state.daily.dates;
  const overhead = dailyOverhead(state);
  addTransaction(state, -overhead, `Day ${endedDay} operating overhead`, 'overhead');
  state.trends.income.push(state.daily.revenue - state.daily.expenses);
  state.trends.income = state.trends.income.slice(-7);
  state.trends.reputation.push(Math.round(state.reputation));
  state.trends.reputation = state.trends.reputation.slice(-14);
  state.trends.risk.push(Math.round(state.legalHeat));
  state.trends.risk = state.trends.risk.slice(-14);
  state.day += 1;
  state.daily = { revenue: 0, expenses: 0, dates: 0, safeDates: 0 };
  state.business.weeklyBookings = state.day % 7 === 1 ? 0 : state.business.weeklyBookings;
  state.marketing.active = state.marketing.active
    .map((campaign) => ({ ...campaign, remaining: campaign.remaining - 1 }))
    .filter((campaign) => campaign.remaining > 0);
  const expired = state.prospects.filter((lead) => lead.expiresDay < state.day);
  state.prospects = state.prospects.filter((lead) => lead.expiresDay >= state.day);
  if (expired.length) {
    logJournal(
      state,
      'Leads expired',
      `${expired.length} unanswered ${expired.length === 1 ? 'enquiry' : 'enquiries'} moved on.`,
      'business',
    );
  }
  const structureLeads = STRUCTURES[state.business.structure].leads / 12;
  const managerLeads = state.business.staff.manager ? STAFF.manager.leads / 12 : 0;
  const campaignLeads = campaignLeadRate();
  const reputationLeads = state.reputation / 42;
  const demand = REGIONS[state.regionId].demand;
  const leadCount = clamp(
    Math.round(
      (1.2 + structureLeads + managerLeads + campaignLeads + reputationLeads) * demand + randRange(-1, 1),
    ),
    1,
    7,
  );
  const added = addLeads(state, leadCount);
  state.exposure = clamp(
    state.exposure -
      1.5 +
      state.marketing.active.reduce(
        (sum, campaign) => sum + Math.max(0, CAMPAIGNS[campaign.id]?.exposure || 0) / 12,
        0,
      ),
  );
  state.legalHeat = clamp(
    state.legalHeat - (REGIONS[state.regionId].legalRisk < 20 ? 2.2 : 1.2) + state.exposure / 130,
  );
  state.personal.secrecy = clamp(state.personal.secrecy + Math.max(0, datesToday) * 1.2 - 0.4);
  state.personal.relationship = clamp(
    state.personal.relationship - Math.max(0, state.personal.secrecy - 55) * 0.02,
  );
  state.player.hunger = clamp(state.player.hunger - 5);
  if (state.day - state.health.lastCheckDay > 7) {
    state.health.checkStatus = 'Due';
  }
  const region = REGIONS[state.regionId];
  if (region.weather === 'rain') {
    state.world.weather = chance(0.66) ? 'rain' : 'clear';
  } else if (region.weather === 'mist') {
    state.world.weather = chance(0.35) ? 'mist' : 'clear';
  } else {
    state.world.weather = chance(0.12) ? 'rain' : 'clear';
  }
  logJournal(
    state,
    `Day ${state.day} begins`,
    `${added} new ${added === 1 ? 'lead' : 'leads'} arrived. Daily overhead was ${money(overhead)}.`,
    'daily',
  );
  if (state.health.burnout >= 95) {
    queueEvent(burnoutEvent());
  } else if (state.health.burnout >= 80) {
    notify(
      'Burnout is critical',
      'Composure is slipping. Rest, therapy, or peer support before the next booking.',
      'danger',
      6000,
    );
  } else {
    maybeDailyEvent();
  }
  checkGoals();
  if (state.settings.autosave) {
    saveCareer(state);
  }
}

/** Show an event now, or after the dialog that is open. */
function queueEvent(event) {
  if (modalOpen) {
    pendingEvent = event;
  } else {
    showDailyEvent(event);
  }
}

/** Burnout at its limit forces a pause: the only choice is to stop for half a day. */
function burnoutEvent() {
  return {
    id: 'burnout',
    title: 'You hit a wall',
    text: 'Months of pressure land at once. You cannot take another booking until you have properly stopped for a while.',
    choices: [
      {
        label: 'Take twelve hours completely offline',
        effect: () => {
          advanceTime(720, { noNeedDecay: true });
          state.player.energy = clamp(Math.max(state.player.energy, 70));
          state.player.stress = clamp(state.player.stress - 30);
          state.health.burnout = clamp(state.health.burnout - 35);
          state.personal.relationship = clamp(state.personal.relationship + 3);
        },
        result: 'The forced pause cost time and any bookings inside it, but burnout eased.',
      },
    ],
  };
}

function maybeDailyEvent() {
  if (!chance(0.38)) {
    return;
  }
  const giftFrom = giftClient();
  const events = [
    {
      id: 'review-surge',
      title: 'A review starts circulating',
      text: 'A recent guest praised your discretion in a private forum. The attention could become demand or unwanted visibility.',
      choices: [
        {
          label: 'Lean into the momentum',
          effect: () => {
            state.reputation = clamp(state.reputation + 5);
            state.exposure = clamp(state.exposure + 8);
            addLeads(state, 3);
          },
          result: 'The profile surges. Better leads arrive, along with a larger public footprint.',
        },
        {
          label: 'Keep it private',
          effect: () => {
            state.reputation = clamp(state.reputation + 2);
            state.exposure = clamp(state.exposure - 2);
          },
          result: 'You accept the reputation boost without amplifying it.',
        },
      ],
    },
    {
      id: 'platform-policy',
      title: 'A platform changes its rules',
      text: 'Profile moderation becomes stricter overnight. You can rewrite your public copy or shift toward private referrals.',
      choices: [
        {
          label: 'Rewrite and comply',
          effect: () => {
            state.business.platformTrust = clamp(state.business.platformTrust + 6);
            state.marketing.quality = clamp(state.marketing.quality + 2);
            addTransaction(state, -60, 'Emergency profile rewrite', 'marketing');
          },
          result: 'The profile survives review and looks more polished.',
        },
        {
          label: 'Move to referrals',
          effect: () => {
            state.business.platformTrust = clamp(state.business.platformTrust - 8);
            state.personal.peerSupport = clamp(state.personal.peerSupport + 6);
            state.exposure = clamp(state.exposure - 4);
          },
          result: 'Reach drops, but the remaining enquiries are more private.',
        },
      ],
    },
    {
      id: 'peer-warning',
      title: 'The Lantern Network sends an alert',
      text: 'A peer recognizes details from one of your open enquiries and recommends extra verification.',
      choices: [
        {
          label: 'Follow the warning',
          effect: () => {
            const riskiest = [...state.prospects].sort((a, b) => b.risk - a.risk)[0];
            if (riskiest) {
              riskiest.flags.push(riskiest.hiddenFlag || 'Peer network warning');
              riskiest.hiddenFlag = null;
              riskiest.risk = clamp(riskiest.risk + 8);
            }
            state.personal.peerSupport = clamp(state.personal.peerSupport + 3);
          },
          result: 'The new information is attached to the client record.',
        },
        {
          label: 'Ask for a direct introduction',
          effect: () => {
            addTransaction(state, -40, 'Peer network contribution', 'safety');
            state.personal.peerSupport = clamp(state.personal.peerSupport + 8);
            addLeads(state, 1);
          },
          result: 'You strengthen the network and receive a vetted referral.',
        },
      ],
    },
    {
      id: 'personal-invite',
      title: `${state.personal.partnerName} plans a surprise evening`,
      text: 'A personal commitment now overlaps with your most profitable booking window.',
      choices: [
        {
          label: 'Protect the relationship',
          effect: () => {
            state.personal.relationship = clamp(state.personal.relationship + 8);
            state.personal.trust = clamp(state.personal.trust + 4);
            state.personal.secrecy = clamp(state.personal.secrecy - 5);
            state.player.stress = clamp(state.player.stress - 7);
          },
          result: 'The evening restores connection and makes the dual life easier to carry.',
        },
        {
          label: 'Keep the work window open',
          effect: () => {
            addLeads(state, 2);
            state.personal.relationship = clamp(state.personal.relationship - 5);
            state.personal.secrecy = clamp(state.personal.secrecy + 5);
          },
          result: 'More enquiries arrive, but the relationship absorbs the cost.',
        },
      ],
    },
    {
      id: 'enforcement',
      title: 'Visible enforcement increases downtown',
      text: 'The fictional regional authority announces a short compliance sweep around hotels and nightlife venues.',
      choices: [
        {
          label: 'Shift to public bookings',
          effect: () => {
            state.legalHeat = clamp(state.legalHeat - 2);
            state.business.prices.private = Math.max(
              PACKAGES.private.basePrice,
              state.business.prices.private - 20,
            );
          },
          result: 'You reduce exposure while the city is tense.',
        },
        {
          label: 'Hire temporary transport',
          effect: () => {
            addTransaction(state, -120, 'Temporary transport cover', 'safety');
            state.legalHeat = clamp(state.legalHeat - 5);
            state.player.stress = clamp(state.player.stress - 4);
          },
          result: 'Controlled arrivals and departures keep attention low.',
        },
      ],
    },
    {
      id: 'rent-review',
      title: 'The landlord sends a rent review',
      text: 'A letter proposes a higher rent from next month. There is room to negotiate, but it will cost something either way.',
      choices: [
        {
          label: 'Settle with a one-off payment',
          effect: () => {
            addTransaction(state, -90, 'Rent review settlement', 'housing');
            state.player.stress = clamp(state.player.stress - 3);
          },
          result: 'The landlord accepts a one-off payment instead of a permanent rise.',
        },
        {
          label: 'Push back and document everything',
          effect: () => {
            state.player.stress = clamp(state.player.stress + 7);
            state.business.privacy = clamp(state.business.privacy - 2);
            gainXp(8);
          },
          result:
            'The increase is withdrawn, but the back-and-forth was draining and drew attention to your comings and goings.',
        },
      ],
    },
    {
      id: 'journalist',
      title: 'A journalist asks for a comment',
      text: 'A feature on the city’s night economy is being written. The reporter has heard your professional name from a venue.',
      choices: [
        {
          label: 'Decline through a peer contact',
          effect: () => {
            state.exposure = clamp(state.exposure - 3);
            state.personal.peerSupport = clamp(state.personal.peerSupport + 2);
          },
          result: 'The Lantern Network steers the story elsewhere. Your name stays out of print.',
        },
        {
          label: 'Give an anonymous interview about safety',
          effect: () => {
            state.reputation = clamp(state.reputation + 3);
            state.exposure = clamp(state.exposure + 6);
            state.legalHeat = clamp(state.legalHeat + 2);
            gainXp(12);
          },
          result: 'The piece is thoughtful and widely read. Peers respect it; the attention is real.',
        },
      ],
    },
    {
      id: 'regular-gift',
      when: () => !!giftFrom,
      title: `${giftFrom?.name || 'A regular'} sends a gift`,
      text: 'An expensive, personal gift arrives at a venue with a handwritten note. It is kind, and it blurs a line.',
      choices: [
        {
          label: 'Return it with a warm, clear note',
          effect: () => {
            const client = giftFrom;
            if (client) {
              client.attachment = clamp(client.attachment - 8);
              client.trust = clamp(client.trust + 3);
            }
            state.player.stress = clamp(state.player.stress - 2);
          },
          result: 'The boundary lands gently. Trust grows and attachment eases.',
        },
        {
          label: 'Keep it and say thank you',
          effect: () => {
            const client = giftFrom;
            if (client) {
              client.attachment = clamp(client.attachment + 10);
              addTransaction(state, 120, `Gift from ${client.name}`, 'booking');
            }
          },
          result: 'The gift is worth something, and so is the expectation that now comes with it.',
        },
      ],
    },
    {
      id: 'peer-cover',
      title: 'A peer asks you to take over a client',
      text: 'Someone from the Lantern Network has to leave the city and wants a trusted colleague to take over a well-vetted client.',
      choices: [
        {
          label: 'Take the introduction',
          effect: () => {
            if (state.prospects.length < 14) {
              const lead = createLead(state);
              lead.risk = clamp(lead.risk - 16, 4, 94);
              lead.positives.push('Handed over by a trusted peer');
              state.prospects.push(lead);
            }
            state.personal.peerSupport = clamp(state.personal.peerSupport + 6);
            state.player.energy = clamp(state.player.energy - 4);
          },
          result: 'A low-risk enquiry joins your pipeline, and the network remembers the favour.',
        },
        {
          label: 'Decline kindly',
          effect: () => {
            state.personal.peerSupport = clamp(state.personal.peerSupport - 2);
            state.player.stress = clamp(state.player.stress - 2);
          },
          result: 'You protect your schedule. The peer understands, if a little disappointed.',
        },
      ],
    },
    {
      id: 'theatre-season',
      title: 'The Lyric Theatre opens its season',
      text: 'Opening week brings patrons, critics, and long suppers afterwards. A season pass puts you in the right foyers.',
      choices: [
        {
          label: 'Buy a season pass · $120',
          effect: () => {
            addTransaction(state, -120, 'Lyric Theatre season pass', 'marketing');
            state.marketing.reach = clamp(state.marketing.reach + 4);
            if (state.prospects.length < 14) {
              const lead = createLead(state, { packageId: 'theatre', desiredPackage: 'theatre' });
              lead.positives.push('Met in the Lyric Theatre foyer');
              state.prospects.push(lead);
            }
          },
          result: 'An arts patron asks about a theatre evening, and your profile reaches a new crowd.',
        },
        {
          label: 'Skip it this year',
          effect: () => {
            state.player.stress = clamp(state.player.stress - 1);
          },
          result: 'You keep the evening free and the money in the bank.',
        },
      ],
    },
  ];
  queueEvent(pick(events.filter((e) => !e.when || e.when())));
}

/** The regular with the strongest attachment (the one who sends gifts). */
function giftClient() {
  return (
    state.clients
      .filter((c) => c.status === 'regular')
      .sort((a, b) => (b.attachment || 0) - (a.attachment || 0))[0] || null
  );
}

function showDailyEvent(event) {
  openModal({
    eyebrow: `DAY ${state.day} EVENT`,
    title: event.title,
    subtitle: event.text,
    body: `<div class="choice-list">${event.choices.map((choice, index) => `<button class="choice-button" data-action="daily-event-choice" data-choice="${index}" data-event="${event.id}"><div><strong>${escapeHtml(choice.label)}</strong><p>Choose based on your current priorities; this can affect multiple systems.</p></div><span>DECIDE</span></button>`).join('')}</div>`,
    closeable: false,
  });
  modalRoot.dataset.dailyEvent = JSON.stringify({ id: event.id });
  pendingEvent = event;
}

function checkGoals() {
  if (state.bookings.some((b) => b.status === 'completed')) {
    state.goals.firstBooking = true;
  }
  if (state.clients.some((c) => c.status === 'regular')) {
    state.goals.regular = true;
  }
  if (state.business.prices.event >= 650 || state.business.prices.travel >= 1200) {
    state.goals.premium = true;
  }
  if (state.money >= 5000) {
    state.goals.emergencyFund = true;
  }
  if (state.reputation >= 70 && state.level >= 5) {
    state.storyFlags.expansionUnlocked = true;
  }
  // Milestones pay out once, as the Career tab promises.
  for (const [id, name, done] of MILESTONES) {
    if (done() && !state.storyFlags.milestones[id]) {
      state.storyFlags.milestones[id] = true;
      gainXp(60);
      notify('Milestone complete', `${name} · +60 XP`, 'good', 5000);
      logJournal(
        state,
        `Milestone: ${name}`,
        'A career milestone was reached and rewarded with experience.',
        'career',
      );
      kit?.input.rumble(0.35, 120);
    }
  }
}

const MILESTONES = [
  ['firstBooking', 'First professional booking', () => state.goals.firstBooking],
  ['safeFive', 'Five safe dates', () => state.goals.safeFive >= 5],
  ['regular', 'Trusted regular', () => state.goals.regular],
  ['premium', 'Premium positioning', () => state.goals.premium],
  ['emergencyFund', 'Emergency fund', () => state.goals.emergencyFund],
  ['debtFree', 'Debt cleared', () => state.debt <= 0],
];

function gainXp(amount) {
  const previousLevel = state.level;
  state.xp += Math.round(amount);
  state.level = levelForXp(state.xp);
  if (state.level > previousLevel) {
    const points = (state.level - previousLevel) * 2;
    state.skillPoints += points;
    notify('Level gained', `Level ${state.level}. ${points} skill points added.`, 'good');
    logJournal(
      state,
      `Reached level ${state.level}`,
      'New professional skills are available to learn.',
      'career',
    );
  }
}

/* ------------------------------------------------------------------ loop */

/** Which menu has the player's attention, if any. */
function menuState() {
  if (!startScreen.classList.contains('hidden')) return 'title';
  if (modalOpen) return 'modal';
  if (activePanel) return 'panel';
  return null;
}

function handleMenuInput(menu) {
  const input = kit.input;
  if (menu === 'title') {
    nav.update({ roots: [startScreen], scroll: startScreen });
    return;
  }
  if (menu === 'modal') {
    const closeable = modalRoot.dataset.closeable === 'true';
    nav.update({
      roots: [modalRoot],
      scroll: modalRoot.querySelector('.modal-body'),
      onBack: () => closeable && closeModal(),
    });
    if (modalOpen && closeable && input.pressed('pause')) closeModal();
    return;
  }
  nav.update({
    roots: [managementPanel, dock],
    scroll: managementPanel.querySelector('.panel-body'),
    onBack: closePanel,
  });
  if (!activePanel || modalOpen) return;
  if (input.pressed('pause') || input.pressed('manage')) closePanel();
  else if (input.pressed('prevTab')) cyclePanel(-1);
  else if (input.pressed('nextTab')) cyclePanel(1);
}

function handleWorldInput() {
  const input = kit.input;
  if (input.pressed('pause')) {
    showPauseMenu();
  } else if (input.pressed('manage')) {
    openPanel('dashboard');
  } else if (input.pressed('interact')) {
    interact();
  } else if (input.pressed('speed')) {
    cycleSpeed();
  }
}

function cycleSpeed() {
  const speeds = [0, 1, 3];
  state.speed = speeds[(speeds.indexOf(state.speed) + 1) % speeds.length];
  syncSpeedButtons();
  notify('Time speed', state.speed === 0 ? 'Clock paused.' : `${state.speed}× speed.`, 'info', 1600);
}

/** The on-screen stick and buttons hide whenever a menu is up. */
let touchSuspended = null;
function syncTouch(menu) {
  const suspend = !!menu;
  if (suspend === touchSuspended) return;
  touchSuspended = suspend;
  kit.touch?.suspend(suspend, 'game');
}

/** A chime an hour before each booking and a warning before it is missed. */
function checkReminders() {
  const now = nowMinute();
  for (const booking of state.bookings) {
    if (booking.status !== 'scheduled') continue;
    const until = absMinute(booking.day, booking.minute) - now;
    const venue = LOCATIONS[booking.venueId]?.name || 'the venue';
    if (until <= 60 && until > -60 && !remindedBookings.has(`${booking.id}:soon`)) {
      remindedBookings.add(`${booking.id}:soon`);
      notify(
        until > 0 ? `Booking in ${Math.ceil(until)} minutes` : 'Your client is waiting',
        `${booking.clientName} · ${PACKAGES[booking.packageId].short} at ${venue}, ${clock(booking.minute)}.`,
        'info',
        6000,
      );
      audio.chime();
      kit.input.rumble(0.25, 90);
    }
    if (until <= -60 && until > -90 && !remindedBookings.has(`${booking.id}:late`)) {
      remindedBookings.add(`${booking.id}:late`);
      notify(
        'Running very late',
        `${booking.clientName} cancels in ${Math.ceil(90 + until)} minutes unless you reach ${venue}.`,
        'danger',
        6000,
      );
      audio.chime();
      kit.input.rumble(0.5, 160);
    }
  }
}

/** One frame: menus or the city get the input, then the city moves and draws. */
function tick(dt) {
  const menu = menuState();
  if (menu) handleMenuInput(menu);
  else if (state) handleWorldInput();
  const now = menuState();
  syncTouch(now);
  if (!state) {
    // Behind the title card the city turns slowly under the night sky.
    world.idle(dt);
    world.render();
    return;
  }
  const blocked = !!now;
  world.tick(dt, state, blocked);
  if (!blocked && state.speed > 0) {
    advanceTime(Math.min(dt, 0.08) * state.speed * 2);
  }
  minimapTimer += dt;
  autosaveTimer += dt;
  reminderTimer += dt;
  if (minimapTimer > 0.09) {
    drawMinimap();
    minimapTimer = 0;
  }
  if (reminderTimer > 0.5) {
    checkReminders();
    reminderTimer = 0;
  }
  if (autosaveTimer > 25 && state.settings.autosave) {
    saveCareer(state);
    autosaveTimer = 0;
  }
  world.render();
}

function showPauseMenu() {
  openModal({
    eyebrow: 'PAUSED',
    title: 'City After Dark',
    subtitle: `${escapeHtml(state.name)} · ${weekday(state.day)} · Day ${state.day}, ${clock(state.minute)} · ${REGIONS[state.regionId].name}`,
    body: `<div class="choice-list">
      <button class="choice-button" data-action="close-modal"><div><strong>Resume</strong><p>Back to the city. The clock stays stopped while this menu is open.</p></div><span>RESUME</span></button>
      <button class="choice-button" data-action="open-help"><div><strong>How to play &amp; game settings</strong><p>Controls for keyboard, controller and touch; bloom, shadows, reduced motion.</p></div><span>HELP</span></button>
      <button class="choice-button" data-action="open-display-settings"><div><strong>Display, quality &amp; controls</strong><p>Quality tier, resolution, frame rate, touch layout, look speed, vibration.</p></div><span>SETTINGS</span></button>
      <button class="choice-button" data-action="toggle-audio"><div><strong>Ambient sound: ${state.settings.audio ? 'on' : 'off'}</strong><p>City drone, rain on glass, interface tones and booking chimes.</p></div><span>${state.settings.audio ? 'MUTE' : 'SOUND'}</span></button>
      <button class="choice-button" data-action="manual-save"><div><strong>Save now</strong><p>Autosave is ${state.settings.autosave ? 'on: every 25 seconds and each new day' : 'off'}.</p></div><span>SAVE</span></button>
      <button class="choice-button" data-action="quit-title"><div><strong>Save and quit to title</strong><p>Your career stays saved in this browser.</p></div><span>QUIT</span></button>
    </div>`,
  });
}

function dashboardPanel() {
  const next = upcomingBookings()[0];
  const today = state.bookings.filter(
    (a) => a.day === state.day && ['scheduled', 'completed', 'missed'].includes(a.status),
  );
  const weekNet = state.trends.income.reduce((a, o) => a + o, 0) + state.daily.revenue - state.daily.expenses;
  const safety = safetyIndex();
  const maxIncome = Math.max(1, ...state.trends.income.map((a) => Math.abs(a)));
  const todayList = today.length
    ? today
        .sort((a, o) => a.minute - o.minute)
        .map(
          (a) => `
    <div class="card interactive client-card" data-action="open-booking" data-booking="${a.id}">
      <div class="avatar">${clock(a.minute)}</div>
      <div class="client-main"><h4>${escapeHtml(a.clientName)} <span class="chip ${a.status === 'completed' ? 'good' : a.status === 'missed' ? 'danger' : 'info'}">${a.status}</span></h4><p>${PACKAGES[a.packageId].name} · ${LOCATIONS[a.venueId].name}</p></div>
      <div class="client-value"><strong>${money(a.quote)}</strong><small>risk ${a.screenedRisk}</small></div>
    </div>
  `,
        )
        .join('')
    : '<div class="empty-state"><strong>No bookings today</strong><p>Screen a lead, run a campaign, or use the city to generate new enquiries.</p></div>';
  return panelFrame(
    'Career overview',
    `${REGIONS[state.regionId].name} · Day ${state.day} · ${STRUCTURES[state.business.structure].name}`,
    `
    <section class="panel-section">
      <div class="grid four">
        <div class="card"><span class="eyebrow">AVAILABLE CASH</span><span class="big-number">${money(state.money)}</span><p>${money(dailyOverhead(state))} estimated daily overhead</p></div>
        <div class="card"><span class="eyebrow">WEEK NET</span><span class="big-number">${money(weekNet)}</span><div class="sparkline">${state.trends.income.map((a) => `<i style="height:${10 + (Math.abs(a) / maxIncome) * 26}px;opacity:${a < 0 ? 0.35 : 0.85}"></i>`).join('')}</div></div>
        <div class="card"><span class="eyebrow">REPUTATION</span><span class="big-number">${Math.round(state.reputation)}</span><p>${state.reviews.length} reviews · ${state.clients.filter((a) => a.status === 'regular').length} regulars</p></div>
        <div class="card"><span class="eyebrow">SAFETY INDEX</span><span class="big-number">${safety}</span><div class="progress ${levelClass(safety)}"><i style="width:${safety}%"></i></div></div>
      </div>
    </section>

    <section class="panel-section">
      <div class="section-heading"><div><h3>Next booking</h3><p>Preparation, travel, and timing affect the outcome before the date begins.</p></div>${next ? `<button class="section-action" data-action="open-booking" data-booking="${next.id}">OPEN BOOKING</button>` : ''}</div>
      ${
        next
          ? `
        <div class="card">
          <div class="client-card">
            <div class="avatar">${escapeHtml(next.clientInitials || initials(next.clientName))}</div>
            <div class="client-main"><h4>${escapeHtml(next.clientName)} · ${PACKAGES[next.packageId].short}</h4><p>Day ${next.day}, ${clock(next.minute)} · ${LOCATIONS[next.venueId].name} · ${next.duration} minutes</p><div class="meta-row"><span class="chip ${riskClass(next.screenedRisk)}">risk ${next.screenedRisk}</span><span class="chip ${next.prep.outfit ? 'good' : 'warn'}">${next.prep.outfit ? 'wardrobe ready' : 'wardrobe unprepared'}</span><span class="chip ${next.prep.confirmed ? 'good' : 'warn'}">${next.prep.confirmed ? 'confirmed' : 'confirmation due'}</span></div></div>
            <div class="client-value"><strong>${money(next.quote)}</strong><small>${money(next.depositAmount)} deposit</small></div>
          </div>
          <div class="button-row"><button class="primary" data-action="route-location" data-location="${next.venueId}">Set route</button><button class="secondary" data-action="open-booking" data-booking="${next.id}">Prepare booking</button></div>
        </div>
      `
          : '<div class="empty-state"><strong>Your calendar is open</strong><p>There are no scheduled bookings. Review new enquiries or invest in private referrals.</p><div class="button-row" style="justify-content:center"><button class="primary" data-action="open-panel" data-tab="clients">Review leads</button><button class="secondary" data-action="open-panel" data-tab="marketing">Market profile</button></div></div>'
      }
    </section>

    <section class="panel-section">
      <div class="section-heading"><div><h3>Today</h3><p>Completed and missed bookings remain visible in the daily record.</p></div></div>
      <div class="list">${todayList}</div>
    </section>

    <section class="panel-section">
      <div class="section-heading"><div><h3>Quick decisions</h3><p>Some actions require visiting their city location.</p></div></div>
      <div class="grid three">
        <div class="card"><h4>Client pipeline</h4><p>${state.prospects.length} open enquiries. The strongest current offer is ${money(Math.max(0, ...state.prospects.map((a) => a.offer)))}.</p><div class="button-row"><button class="secondary" data-action="open-panel" data-tab="clients">Screen clients</button></div></div>
        <div class="card"><h4>Wellbeing</h4><p>Energy ${Math.round(state.player.energy)}, stress ${Math.round(state.player.stress)}, health ${Math.round(state.player.health)}. Burnout risk is ${Math.round(state.health.burnout)}.</p><div class="button-row"><button class="secondary" data-action="route-location" data-location="home">Route home</button><button class="ghost" data-action="open-panel" data-tab="wellness">Review</button></div></div>
        <div class="card"><h4>Public footprint</h4><p>Exposure ${Math.round(state.exposure)} and legal heat ${Math.round(state.legalHeat)}. Platform trust is ${Math.round(state.business.platformTrust)}.</p><div class="button-row"><button class="secondary" data-action="open-panel" data-tab="safety">Risk controls</button></div></div>
      </div>
    </section>

    <section class="panel-section">
      <div class="section-heading"><div><h3>Long-term momentum</h3><p>Multiple viable paths are supported: premium independence, managed growth, agency ownership, or a funded exit.</p></div></div>
      <div class="grid two">
        <div class="card"><h4>Professional level ${state.level}</h4><div class="progress-wrap"><div class="progress-label"><span>${state.xp} XP</span><span>${xpForLevel(state.level)} next level</span></div><div class="progress"><i style="width:${clamp((state.xp / xpForLevel(state.level)) * 100)}%"></i></div></div><p>${state.skillPoints} unspent skill points.</p></div>
        <div class="card"><h4>Exit fund</h4><div class="progress-wrap"><div class="progress-label"><span>${money(state.money)}</span><span>$50,000</span></div><div class="progress good"><i style="width:${clamp(state.money / 500)}%"></i></div></div><p>Debt remaining: ${money(state.debt)}. A funded exit becomes available at $50,000 with the debt cleared.</p>${state.debt > 0 ? `<div class="button-row"><button class="secondary" data-action="repay-debt" data-amount="500" ${state.money < Math.min(500, state.debt) ? 'disabled' : ''}>Repay ${money(Math.min(500, state.debt))}</button><button class="ghost" data-action="repay-debt" data-amount="all" ${state.money < state.debt ? 'disabled' : ''}>Clear ${money(state.debt)}</button></div>` : '<div class="chip good" style="margin-top:10px">DEBT CLEARED</div>'}</div>
      </div>
    </section>
  `,
  );
}

function clientCard(client, isRecord = false) {
  const risk = riskScore(state, client);
  return `
    <div class="card interactive client-card" data-action="${isRecord ? 'open-client-record' : 'open-client'}" data-client="${client.id}">
      <div class="avatar">${escapeHtml(client.initials || initials(client.name))}</div>
      <div class="client-main">
        <h4>${escapeHtml(client.name)} <span class="chip ${isRecord ? 'good' : riskClass(risk)}">${isRecord ? `${client.dates} dates` : `risk ${risk}`}</span></h4>
        <p>${escapeHtml(client.archetype)} · ${escapeHtml(client.personality)} · ${PACKAGES[client.desiredPackage]?.short || 'Companionship'}</p>
        <div class="meta-row">
          ${
            client.positives
              ?.slice(0, 2)
              .map((text) => `<span class="chip good">${escapeHtml(text)}</span>`)
              .join('') || ''
          }
          ${
            client.flags
              ?.slice(0, 1)
              .map((text) => `<span class="chip danger">${escapeHtml(text)}</span>`)
              .join('') || ''
          }
        </div>
      </div>
      <div class="client-value"><strong>${isRecord ? money(client.lifetimeValue) : money(client.offer)}</strong><small>${isRecord ? 'lifetime' : `budget ${money(client.budget)}`}</small></div>
    </div>
  `;
}

function clientsPanel() {
  const leads = [...state.prospects].sort(
    (n, s) => s.offer / Math.max(1, s.risk) - n.offer / Math.max(1, n.risk),
  );
  const regulars = state.clients
    .filter((n) => n.status === 'regular')
    .sort((n, s) => s.lifetimeValue - n.lifetimeValue);
  const past = state.clients
    .filter((n) => n.status !== 'regular' && n.dates > 0)
    .sort((n, s) => s.trust - n.trust);
  return panelFrame(
    'Clients',
    `${leads.length} open enquiries · ${regulars.length} regulars · ${state.blacklist.length} blacklisted`,
    `
    <section class="panel-section">
      <div class="grid three">
        <div class="card"><span class="eyebrow">PIPELINE VALUE</span><span class="big-number">${money(leads.reduce((n, s) => n + s.offer, 0))}</span><p>Before screening costs and failed negotiations</p></div>
        <div class="card"><span class="eyebrow">AVG LEAD RISK</span><span class="big-number">${leads.length ? Math.round(leads.reduce((n, s) => n + riskScore(state, s), 0) / leads.length) : 0}</span><p>Based on standing protocols</p></div>
        <div class="card"><span class="eyebrow">REGULAR VALUE</span><span class="big-number">${money(regulars.reduce((n, s) => n + s.lifetimeValue, 0))}</span><p>Lifetime gross across trusted clients</p></div>
      </div>
    </section>

    <section class="panel-section">
      <div class="section-heading"><div><h3>Open enquiries</h3><p>Click a lead to review messages, signals, verification, quote, and schedule.</p></div><button class="section-action" data-action="source-leads">SOURCE LEADS · $60</button></div>
      <div class="list">${leads.length ? leads.map((n) => clientCard(n)).join('') : '<div class="empty-state"><strong>No open enquiries</strong><p>Run a campaign, ask for referrals, or source a new batch of marketplace leads.</p></div>'}</div>
    </section>

    <section class="panel-section">
      <div class="section-heading"><div><h3>Regular clients</h3><p>Trust lowers acquisition cost but can create attachment and boundary pressure over time.</p></div></div>
      <div class="list">${regulars.length ? regulars.map((n) => clientCard(n, true)).join('') : '<div class="empty-state"><strong>No regulars yet</strong><p>Strong dates, reliable boundaries, and thoughtful follow-up can convert compatible clients.</p></div>'}</div>
    </section>

    ${past.length ? `<section class="panel-section"><div class="section-heading"><div><h3>Past clients</h3><p>Completed clients who have not become regulars.</p></div></div><div class="list">${past.map((n) => clientCard(n, true)).join('')}</div></section>` : ''}
  `,
  );
}

function calendarPanel() {
  const days = Array.from({ length: 7 }, (n, s) => state.day + s);
  const active = state.bookings
    .filter((n) => ['scheduled', 'in-progress'].includes(n.status))
    .sort((n, s) => absMinute(n.day, n.minute) - absMinute(s.day, s.minute));
  const recent = state.bookings
    .filter((n) => ['completed', 'missed', 'cancelled', 'no-show'].includes(n.status))
    .slice(-8)
    .reverse();
  return panelFrame(
    'Bookings',
    `${active.length} active · time pauses while this panel is open`,
    `
    <section class="panel-section">
      <div class="section-heading"><div><h3>Seven-day calendar</h3><p>Bookings show scheduled start time. Travel and preparation must be handled separately.</p></div></div>
      <div class="calendar">
        ${days
          .map((day) => {
            const dayBookings = state.bookings.filter((r) => r.day === day && r.status !== 'cancelled');
            return `<div class="calendar-day ${day === state.day ? 'today' : ''}"><strong>${weekday(day)} · D${day}</strong>${
              dayBookings.length
                ? dayBookings
                    .sort((r, a) => r.minute - a.minute)
                    .map(
                      (r) =>
                        `<button class="calendar-booking ${r.status === 'missed' ? 'danger' : ''}" data-action="open-booking" data-booking="${r.id}">${clock(r.minute)}<br>${escapeHtml(r.clientName)}<br>${money(r.quote)}</button>`,
                    )
                    .join('')
                : '<p style="color:#596071;font-size:8px">OPEN</p>'
            }</div>`;
          })
          .join('')}
      </div>
    </section>

    <section class="panel-section">
      <div class="section-heading"><div><h3>Upcoming itinerary</h3><p>Risk values include screening, standing protocols, structure, and hired staff.</p></div></div>
      <div class="list">${
        active.length
          ? active
              .map(
                (n) => `
        <div class="card client-card interactive" data-action="open-booking" data-booking="${n.id}">
          <div class="avatar">D${n.day}<br><small>${clock(n.minute)}</small></div>
          <div class="client-main"><h4>${escapeHtml(n.clientName)} · ${PACKAGES[n.packageId].short}</h4><p>${LOCATIONS[n.venueId].name} · ${n.duration} min · ${money(n.depositAmount)} deposit held</p><div class="meta-row"><span class="chip ${riskClass(n.screenedRisk)}">risk ${n.screenedRisk}</span><span class="chip ${n.prep.outfit ? 'good' : 'warn'}">outfit</span><span class="chip ${n.prep.confirmed ? 'good' : 'warn'}">confirmation</span><span class="chip ${n.prep.route ? 'good' : 'warn'}">route</span></div></div>
          <div class="client-value"><strong>${money(n.quote)}</strong><small>${n.status}</small></div>
        </div>
      `,
              )
              .join('')
          : '<div class="empty-state"><strong>No active bookings</strong><p>New bookings are created by screening and negotiating with client leads.</p></div>'
      }</div>
    </section>

    ${recent.length ? `<section class="panel-section"><div class="section-heading"><div><h3>Recent outcomes</h3><p>Completed, cancelled, missed, and no-show records.</p></div></div><div class="list">${recent.map((n) => `<div class="card client-card interactive" data-action="open-booking" data-booking="${n.id}"><div class="avatar">${n.grade || '—'}</div><div class="client-main"><h4>${escapeHtml(n.clientName)} <span class="chip ${n.status === 'completed' ? 'good' : 'danger'}">${n.status}</span></h4><p>Day ${n.day} · ${PACKAGES[n.packageId].short} · ${LOCATIONS[n.venueId].name}</p></div><div class="client-value"><strong>${money(n.netEarned || n.depositAmount || 0)}</strong><small>net result</small></div></div>`).join('')}</div></section>` : ''}
  `,
  );
}

function businessPanel() {
  const structure = STRUCTURES[state.business.structure];
  const overhead = dailyOverhead(state);
  const avgPrice =
    Object.values(state.business.prices).reduce((n, s) => n + s, 0) /
    Object.values(state.business.prices).length;
  return panelFrame(
    'Business',
    `${structure.name} · ${Math.round(structure.cut * 100)}% booking cut · ${money(overhead)} daily overhead`,
    `
    <section class="panel-section">
      <div class="grid four">
        <div class="card"><span class="eyebrow">LIFETIME GROSS</span><span class="big-number">${money(state.business.grossLifetime)}</span><p>Before structure cuts and expenses</p></div>
        <div class="card"><span class="eyebrow">LIFETIME NET</span><span class="big-number">${money(state.business.netLifetime)}</span><p>Cash credited through completed activity</p></div>
        <div class="card"><span class="eyebrow">EXPENSES</span><span class="big-number">${money(state.business.expensesLifetime)}</span><p>Operating, staffing, health, and marketing</p></div>
        <div class="card"><span class="eyebrow">AVG LIST PRICE</span><span class="big-number">${money(avgPrice)}</span><p>Across all packages</p></div>
      </div>
    </section>

    <section class="panel-section">
      <div class="section-heading"><div><h3>Operating structure</h3><p>Structure changes lead volume, safety support, autonomy, overhead, and the cut from every booking.</p></div></div>
      <div class="grid three">
        ${Object.values(STRUCTURES)
          .map(
            (option) => `
          <div class="card ${state.business.structure === option.id ? 'selected' : 'interactive'}" ${state.business.structure !== option.id ? `data-action="switch-structure" data-structure="${option.id}"` : ''}>
            <h4>${option.name}</h4><p>${option.description}</p>
            <div class="meta-row"><span class="chip">${Math.round(option.cut * 100)}% cut</span><span class="chip ${option.safety ? 'good' : 'warn'}">+${option.safety} safety</span><span class="chip info">${option.autonomy} autonomy</span></div>
            ${state.business.structure === option.id ? '<div class="chip good" style="margin-top:10px">CURRENT</div>' : `<div class="button-row"><button class="secondary" data-action="switch-structure" data-structure="${option.id}">Switch · ${money(option.switchCost)}</button></div>`}
          </div>
        `,
          )
          .join('')}
      </div>
    </section>

    <section class="panel-section">
      <div class="section-heading"><div><h3>Package pricing</h3><p>Higher rates improve margins but reduce acceptance until reputation, branding, and negotiation catch up.</p></div></div>
      <div class="card">
        ${Object.values(PACKAGES)
          .map(
            (pkg) => `
          <div class="range-row"><label for="price-${pkg.id}">${pkg.name}<br><span style="color:#747c8e;font-size:8px">${pkg.duration} min</span></label><input id="price-${pkg.id}" type="range" min="${Math.round(pkg.basePrice * 0.65)}" max="${Math.round(pkg.basePrice * 2.4)}" step="10" value="${state.business.prices[pkg.id]}" data-price="${pkg.id}"><span class="range-value" id="price-value-${pkg.id}">${money(state.business.prices[pkg.id])}</span></div>
        `,
          )
          .join('')}
      </div>
    </section>

    <section class="panel-section">
      <div class="section-heading"><div><h3>Staff and contractors</h3><p>Hired staff charge daily until released. Their bonuses stack with your operating structure.</p></div></div>
      <div class="grid three">
        ${Object.values(STAFF)
          .map((role) => {
            const hired = state.business.staff[role.id];
            return `<div class="card ${hired ? 'selected' : ''}"><h4>${role.name}</h4><p>${role.description}</p><div class="meta-row"><span class="chip good">+${role.safety} safety</span>${role.leads ? `<span class="chip info">+${role.leads} lead power</span>` : ''}${role.negotiation ? `<span class="chip">+${role.negotiation} negotiation</span>` : ''}</div><div class="button-row"><button class="${hired ? 'danger-button' : 'secondary'}" data-action="toggle-staff" data-staff="${role.id}">${hired ? `Release · saves ${money(role.daily)}/day` : `Hire · ${money(role.hireCost)} + ${money(role.daily)}/day`}</button></div></div>`;
          })
          .join('')}
      </div>
    </section>

    <section class="panel-section">
      <div class="section-heading"><div><h3>Housing and privacy</h3><p>Housing determines daily cost, recovery quality, privacy, and whether private bookings can safely use home.</p></div></div>
      <div class="grid three">
        ${[
          {
            level: 1,
            name: 'Shared apartment',
            cost: 58,
            privacy: 45,
            text: 'Low cost, weak separation, no safe home bookings.',
          },
          {
            level: 2,
            name: 'Private apartment',
            cost: 92,
            privacy: 68,
            text: 'Better recovery and privacy; home bookings become viable with screening.',
          },
          {
            level: 3,
            name: 'Secure residence',
            cost: 145,
            privacy: 88,
            text: 'Controlled entry, concierge cover, and the strongest personal-life separation.',
          },
        ]
          .map(
            (home) =>
              `<div class="card ${state.business.housing === home.level ? 'selected' : 'interactive'}" ${state.business.housing !== home.level ? `data-action="upgrade-housing" data-level="${home.level}"` : ''}><h4>${home.name}</h4><p>${home.text}</p><div class="meta-row"><span class="chip">${money(Math.round(home.cost * REGIONS[state.regionId].costs))}/day</span><span class="chip good">${home.privacy} privacy</span></div>${state.business.housing === home.level ? '<div class="chip good" style="margin-top:10px">CURRENT</div>' : `<div class="button-row"><button class="secondary" data-action="upgrade-housing" data-level="${home.level}">Move · ${money(home.level * 550)}</button></div>`}</div>`,
          )
          .join('')}
      </div>
    </section>
  `,
  );
}

function marketingPanel() {
  const niches = [
    {
      id: 'approachable',
      name: 'Approachable',
      text: 'Wider lead pool, stronger coffee and dinner conversion.',
      effect: 'Broad demand',
    },
    {
      id: 'luxury',
      name: 'Luxury',
      text: 'Higher price tolerance, fewer leads, greater exposure expectations.',
      effect: 'Premium quotes',
    },
    {
      id: 'events',
      name: 'Event specialist',
      text: 'Stronger public-event outcomes and corporate referrals.',
      effect: 'Event demand',
    },
    {
      id: 'discreet',
      name: 'Discreet',
      text: 'Lower exposure and slower growth through private referrals.',
      effect: 'Lower heat',
    },
  ];
  return panelFrame(
    'Marketing',
    `${state.marketing.active.length} active campaigns · brand quality ${Math.round(state.marketing.quality)} · reach ${Math.round(state.marketing.reach)}`,
    `
    <section class="panel-section">
      <div class="grid four">
        <div class="card"><span class="eyebrow">BRAND QUALITY</span><span class="big-number">${Math.round(state.marketing.quality)}</span><div class="progress"><i style="width:${state.marketing.quality}%"></i></div></div>
        <div class="card"><span class="eyebrow">REACH</span><span class="big-number">${Math.round(state.marketing.reach)}</span><div class="progress"><i style="width:${state.marketing.reach}%"></i></div></div>
        <div class="card"><span class="eyebrow">PLATFORM TRUST</span><span class="big-number">${Math.round(state.business.platformTrust)}</span><div class="progress ${levelClass(state.business.platformTrust)}"><i style="width:${state.business.platformTrust}%"></i></div></div>
        <div class="card"><span class="eyebrow">PUBLIC EXPOSURE</span><span class="big-number">${Math.round(state.exposure)}</span><div class="progress ${riskClass(state.exposure)}"><i style="width:${state.exposure}%"></i></div></div>
      </div>
    </section>

    <section class="panel-section">
      <div class="section-heading"><div><h3>Positioning</h3><p>Your niche changes which leads appear and how clients interpret price, style, and discretion.</p></div></div>
      <div class="grid four">${niches.map((niche) => `<div class="card ${state.business.brand === niche.id ? 'selected' : 'interactive'}" data-action="set-brand" data-brand="${niche.id}"><h4>${niche.name}</h4><p>${niche.text}</p><div class="meta-row"><span class="chip ${state.business.brand === niche.id ? 'good' : ''}">${state.business.brand === niche.id ? 'CURRENT' : niche.effect}</span></div></div>`).join('')}</div>
    </section>

    <section class="panel-section">
      <div class="section-heading"><div><h3>Active campaigns</h3><p>Campaign effects are applied each morning until their duration ends.</p></div></div>
      <div class="list">${
        state.marketing.active.length
          ? state.marketing.active
              .map((entry) => {
                const campaign = CAMPAIGNS[entry.id];
                return `<div class="card client-card"><div class="avatar">${entry.remaining}D</div><div class="client-main"><h4>${campaign.name}</h4><p>${campaign.description}</p></div><div class="client-value"><strong>+${campaign.leads}</strong><small>lead power</small></div></div>`;
              })
              .join('')
          : '<div class="empty-state"><strong>No active campaigns</strong><p>Campaigns can increase demand, reputation, or premium lead quality, usually at the cost of cash or exposure.</p></div>'
      }</div>
    </section>

    <section class="panel-section">
      <div class="section-heading"><div><h3>Campaign catalogue</h3><p>Requirements are checked before purchase. Campaigns of the same type can be refreshed, not stacked.</p></div></div>
      <div class="grid two">${Object.values(CAMPAIGNS)
        .map((campaign) => {
          const eligible = campaign.requirement(state);
          const running = state.marketing.active.some((s) => s.id === campaign.id);
          return `<div class="card ${running ? 'selected' : ''}"><h4>${campaign.name}</h4><p>${campaign.description}</p><div class="meta-row"><span class="chip">${money(campaign.cost)}</span><span class="chip info">${campaign.duration} days</span><span class="chip good">+${campaign.leads} leads</span><span class="chip ${campaign.exposure > 6 ? 'danger' : campaign.exposure < 0 ? 'good' : 'warn'}">${campaign.exposure >= 0 ? '+' : ''}${campaign.exposure} exposure</span></div><div class="button-row"><button class="secondary" data-action="run-campaign" data-campaign="${campaign.id}" ${!eligible || state.money < campaign.cost ? 'disabled' : ''}>${running ? 'Refresh campaign' : 'Launch campaign'}</button></div>${eligible ? '' : '<p style="color:var(--warn)">Requires reputation 55 or an established referral base.</p>'}</div>`;
        })
        .join('')}</div>
    </section>

    <section class="panel-section">
      <div class="card"><h4>Procedural city option</h4><p>Visit Noir Photo Studio to create a premium photo set through the 3D world. It improves brand quality directly and can prepare future campaign performance.</p><div class="button-row"><button class="primary" data-action="route-location" data-location="studio">Route to studio</button></div></div>
    </section>
  `,
  );
}

function safetyPanel() {
  const protocols = [
    ['idCheck', 'Identity verification', 'Reduces impersonation and payment disputes.'],
    ['references', 'Peer references', 'Improves hidden-flag discovery but can reduce lead conversion.'],
    ['deposit', 'Deposit required', 'Filters low commitment and protects against no-shows.'],
    [
      'publicFirst',
      'Public first meeting',
      'Strong protection for new clients, with lower premium conversion.',
    ],
    ['safeCall', 'Safe-call protocol', 'A trusted contact checks the start, venue, and end time.'],
    ['liveLocation', 'Live location sharing', 'Improves emergency response but carries privacy trade-offs.'],
    ['codeWord', 'Duress code word', 'Unlocks stronger safe-exit options during difficult dates.'],
    [
      'noLastMinuteVenueChange',
      'No last-minute venue changes',
      'Reduces ambush risk and schedule disruption.',
    ],
  ];
  const upcoming = upcomingBookings().slice(0, 5);
  const riskiest = [...state.prospects].sort((n, s) => riskScore(state, s) - riskScore(state, n)).slice(0, 4);
  return panelFrame(
    'Safety',
    `Safety index ${safetyIndex()} · legal heat ${Math.round(state.legalHeat)} · peer support ${Math.round(state.personal.peerSupport)}`,
    `
    <section class="panel-section">
      <div class="grid four">
        <div class="card"><span class="eyebrow">SAFETY INDEX</span><span class="big-number">${safetyIndex()}</span><div class="progress ${levelClass(safetyIndex())}"><i style="width:${safetyIndex()}%"></i></div></div>
        <div class="card"><span class="eyebrow">LEGAL HEAT</span><span class="big-number">${Math.round(state.legalHeat)}</span><div class="progress ${riskClass(state.legalHeat)}"><i style="width:${state.legalHeat}%"></i></div></div>
        <div class="card"><span class="eyebrow">EMERGENCY CASH</span><span class="big-number">${money(Math.max(0, state.money - dailyOverhead(state) * 3))}</span><p>Cash after three days of overhead</p></div>
        <div class="card"><span class="eyebrow">BLACKLIST</span><span class="big-number">${state.blacklist.length}</span><p>Records excluded from future generation</p></div>
      </div>
    </section>

    <section class="panel-section">
      <div class="section-heading"><div><h3>Standing protocols</h3><p>These defaults pre-fill each screening decision. Client-specific choices can override them.</p></div></div>
      <div class="card">${protocols.map(([key, label, hint]) => `<div class="switch-row"><div class="switch-copy"><strong>${label}</strong><p>${hint}</p></div><label class="switch"><input type="checkbox" data-protocol="${key}" ${state.protocols[key] ? 'checked' : ''}><i></i></label></div>`).join('')}</div>
    </section>

    <section class="panel-section">
      <div class="section-heading"><div><h3>Upcoming booking risk</h3><p>Open a booking to add route planning, confirmation, wardrobe, or paid transport.</p></div></div>
      <div class="list">${upcoming.length ? upcoming.map((n) => `<div class="card client-card interactive" data-action="open-booking" data-booking="${n.id}"><div class="avatar">${n.screenedRisk}</div><div class="client-main"><h4>${escapeHtml(n.clientName)} · ${PACKAGES[n.packageId].short}</h4><p>Day ${n.day}, ${clock(n.minute)} · ${LOCATIONS[n.venueId].name}</p></div><div class="client-value"><strong class="${riskClass(n.screenedRisk)}">${n.screenedRisk < 35 ? 'LOW' : n.screenedRisk < 65 ? 'MEDIUM' : 'HIGH'}</strong><small>screened risk</small></div></div>`).join('') : '<div class="empty-state"><strong>No scheduled risk</strong><p>Your calendar has no active bookings.</p></div>'}</div>
    </section>

    <section class="panel-section">
      <div class="section-heading"><div><h3>Highest-risk enquiries</h3><p>Risk is not certainty. Use verification, boundaries, public venues, support, or decline when the trade-off is poor.</p></div><button class="section-action" data-action="route-location" data-location="safehub">VISIT LANTERN NETWORK</button></div>
      <div class="list">${riskiest.length ? riskiest.map((n) => clientCard(n)).join('') : '<div class="empty-state"><strong>No open enquiries</strong><p>There are no client records to audit.</p></div>'}</div>
    </section>

    <section class="panel-section">
      <div class="grid two">
        ${routeCard('Harbourline Legal Aid', `Legal heat is ${Math.round(state.legalHeat)}. A consultation, a rights workshop, or a privacy clean-up can bring pressure and exposure down.`, 'legal', 'Route to Legal Aid')}
        ${routeCard('The Lantern Network', 'Peer audits, safe-call membership, trusted referrals, and support circles.', 'safehub', 'Route to Lantern')}
      </div>
    </section>
  `,
  );
}

function routeCard(title, text, locationId, label) {
  return `<div class="card"><h4>${title}</h4><p>${text}</p><div class="button-row"><button class="secondary" data-action="route-location" data-location="${locationId}">${label}</button></div></div>`;
}

function wellnessPanel() {
  const player = state.player;
  const daysSinceCheck = state.day - state.health.lastCheckDay;
  return panelFrame(
    'Wellness & personal life',
    `Health ${Math.round(player.health)} · stress ${Math.round(player.stress)} · relationship ${Math.round(state.personal.relationship)}`,
    `
    <section class="panel-section">
      <div class="grid four">
        ${[
          ['Energy', player.energy, false],
          ['Stress', player.stress, true],
          ['Health', player.health, false],
          ['Hygiene', player.hygiene, false],
        ]
          .map(
            ([t, n, s]) =>
              `<div class="card"><span class="eyebrow">${t}</span><span class="big-number">${Math.round(n)}</span><div class="progress ${levelClass(n, s)}"><i style="width:${s ? 100 - n : n}%"></i></div></div>`,
          )
          .join('')}
      </div>
    </section>

    <section class="panel-section">
      <div class="section-heading"><div><h3>Recovery routes</h3><p>Walk to the location and interact (E, A, or the Enter button). Actions consume time and may have direct or long-term effects.</p></div></div>
      <div class="grid three">
        ${routeCard('Home recovery', 'Sleep, shower, eat, prepare wardrobe, manage privacy, or end the day.', 'home', 'Route home')}
        ${routeCard('Confidential clinic', `Routine check status: ${state.health.checkStatus}. Last visit ${daysSinceCheck ? `${daysSinceCheck} days ago` : 'today'}.`, 'clinic', 'Route to clinic')}
        ${routeCard('Fitness & recovery', 'Train stamina and presentation, or use a lower-intensity recovery session.', 'gym', 'Route to gym')}
        ${routeCard('Quiet walk', 'Lower stress and secrecy load without spending money.', 'park', 'Route to park')}
        ${routeCard('Peer support', 'Increase safety information, emotional support, and referral resilience.', 'safehub', 'Route to Lantern')}
        <div class="card"><h4>Immediate meal</h4><p>Order food wherever you are. Restores hunger and some energy, but costs more than eating at home.</p><div class="button-row"><button class="secondary" data-action="order-food">Order · $38</button></div></div>
      </div>
    </section>

    <section class="panel-section">
      <div class="section-heading"><div><h3>Personal relationship</h3><p>${escapeHtml(state.personal.partnerName)} currently knows: ${escapeHtml(state.personal.knows)}. Secrecy can protect short-term stability but increases stress and discovery pressure.</p></div></div>
      <div class="grid two">
        <div class="card"><h4>Connection with ${escapeHtml(state.personal.partnerName)}</h4><div class="stat-row"><span>Relationship</span><strong>${Math.round(state.personal.relationship)}</strong></div><div class="stat-row"><span>Trust</span><strong>${Math.round(state.personal.trust)}</strong></div><div class="stat-row"><span>Secrecy load</span><strong class="${riskClass(state.personal.secrecy)}">${Math.round(state.personal.secrecy)}</strong></div><div class="stat-row"><span>Family pressure</span><strong>${Math.round(state.personal.familyPressure)}</strong></div></div>
        <div class="card"><h4>Choose personal time</h4><p>These actions advance time immediately and can conflict with profitable evening hours.</p><div class="button-row"><button class="secondary" data-action="personal-time">Spend 3 hours together · $70</button><button class="secondary" data-action="honest-conversation">Have an honest conversation</button><button class="ghost" data-action="peer-call">Call a trusted peer</button></div></div>
      </div>
    </section>

    <section class="panel-section"><div class="card"><h4>Burnout</h4><div class="progress ${riskClass(state.health.burnout)}"><i style="width:${state.health.burnout}%"></i></div><p>Burnout rises through chronic stress, weak recovery, excessive bookings, and personal-life conflict. It lowers composure and can force a temporary career pause.</p></div></section>
  `,
  );
}

function regionsPanel() {
  const current = REGIONS[state.regionId];
  return panelFrame(
    'Regions',
    `${current.name} · ${current.legalModel}`,
    `
    <section class="panel-section">
      <div class="card"><h4>Fictionalized legal and market models</h4><p>These regions are designed for gameplay variety, not as legal guidance. Moving costs cash, resets most open leads, transfers only part of your reputation, and changes demand, overhead, exposure, safety, and enforcement pressure.</p></div>
    </section>
    <section class="panel-section">
      <div class="grid two">
        ${Object.values(REGIONS)
          .map((region) => {
            const isCurrent = region.id === state.regionId;
            return `<div class="card ${isCurrent ? 'selected' : ''}"><span class="eyebrow">${region.short}</span><h4 style="font-size:15px;margin-top:5px">${region.name}</h4><p>${region.description}</p><div class="stat-row"><span>Framework</span><strong>${region.legalModel}</strong></div><div class="stat-row"><span>Demand</span><strong>${Math.round(region.demand * 100)}</strong></div><div class="stat-row"><span>Cost index</span><strong>${Math.round(region.costs * 100)}</strong></div><div class="stat-row"><span>Legal pressure</span><strong class="${riskClass(region.legalRisk)}">${region.legalRisk}</strong></div><div class="stat-row"><span>Safety culture</span><strong>${region.safety}</strong></div><div class="stat-row"><span>Competition</span><strong>${region.competition}</strong></div>${isCurrent ? '<div class="chip good" style="margin-top:10px">CURRENT REGION</div>' : `<div class="button-row"><button class="primary" data-action="move-region" data-region="${region.id}" ${state.money < region.moveCost ? 'disabled' : ''}>Relocate · ${money(region.moveCost)}</button></div>`}</div>`;
          })
          .join('')}
      </div>
    </section>
    <section class="panel-section"><div class="card"><h4>Travel through the world</h4><p>Central Terminal is the in-world relocation point. Setting a route closes management and marks the terminal in the city.</p><div class="button-row"><button class="secondary" data-action="route-location" data-location="station">Route to terminal</button></div></div></section>
  `,
  );
}

function careerPanel() {
  const milestones = [
    ['firstBooking', 'First professional booking', 'Complete one date.', state.goals.firstBooking ? 100 : 0],
    [
      'safeFive',
      'Five safe dates',
      'Complete five dates without a safety incident.',
      Math.min(100, state.goals.safeFive * 20),
    ],
    ['regular', 'Trusted regular', 'Convert one client into a regular.', state.goals.regular ? 100 : 0],
    [
      'premium',
      'Premium positioning',
      'List an event at $650 or travel at $1,200.',
      state.goals.premium ? 100 : 0,
    ],
    [
      'emergencyFund',
      'Emergency fund',
      'Hold $5,000 in available cash.',
      state.goals.emergencyFund ? 100 : Math.min(100, state.money / 50),
    ],
    [
      'debtFree',
      'Debt cleared',
      'Repay the $3,200 you started with (Overview or here).',
      state.debt <= 0 ? 100 : clamp(((3200 - state.debt) / 3200) * 100),
    ],
  ];
  return panelFrame(
    'Career progression',
    `Level ${state.level} · ${state.xp} XP · ${state.skillPoints} skill points`,
    `
    <section class="panel-section">
      <div class="card"><div class="progress-label"><span>LEVEL ${state.level}</span><span>${state.xp} / ${xpForLevel(state.level)} XP</span></div><div class="progress"><i style="width:${clamp((state.xp / xpForLevel(state.level)) * 100)}%"></i></div><p>Experience comes from completed dates, screening, marketing, training, safe decisions, and difficult negotiations.</p></div>
    </section>

    <section class="panel-section">
      <div class="section-heading"><div><h3>Skill trees</h3><p>Upgrade cost equals the next skill rank. Maximum rank is 5.</p></div></div>
      <div class="grid three">${Object.values(SKILLS)
        .map((skill) => {
          const rank = state.skills[skill.id];
          const nextRank = rank + 1;
          return `<div class="card"><h4>${skill.name} · ${rank}/5</h4><p>${skill.description}</p><div class="progress-wrap"><div class="progress"><i style="width:${rank * 20}%"></i></div></div><div class="button-row"><button class="secondary" data-action="upgrade-skill" data-skill="${skill.id}" ${rank >= 5 || state.skillPoints < nextRank ? 'disabled' : ''}>Upgrade · ${nextRank} SP</button></div></div>`;
        })
        .join('')}</div>
    </section>

    <section class="panel-section">
      <div class="section-heading"><div><h3>Milestones</h3><p>Each milestone awards 60 XP once and clarifies progress without forcing a single correct playstyle.</p></div></div>
      <div class="grid two">${milestones.map(([, t, n, s]) => `<div class="card ${s >= 100 ? 'selected' : ''}"><h4>${t}</h4><p>${n}</p><div class="progress-wrap"><div class="progress ${s >= 100 ? 'good' : ''}"><i style="width:${s}%"></i></div></div>${s >= 100 ? '<div class="chip good" style="margin-top:8px">COMPLETE</div>' : ''}</div>`).join('')}</div>
    </section>

    <section class="panel-section">
      <div class="section-heading"><div><h3>Career paths and endings</h3><p>Endings remain optional. Continuing the open-ended simulation is always possible.</p></div></div>
      ${state.achievements.length ? `<div class="meta-row" style="margin-bottom:10px">${state.achievements.map((a) => `<span class="chip good">◆ ${escapeHtml(a)}</span>`).join('')}</div>` : ''}
      <div class="grid three">
        <div class="card"><h4>Funded exit</h4><p>Clear debt and build $50,000 to leave with financial independence and a protected private life. Debt remaining: ${money(state.debt)}.</p><div class="progress-wrap"><div class="progress good"><i style="width:${clamp(state.money / 500)}%"></i></div></div><div class="button-row">${state.debt > 0 ? `<button class="secondary" data-action="repay-debt" data-amount="all" ${state.money < state.debt ? 'disabled' : ''}>Clear debt · ${money(state.debt)}</button>` : ''}<button class="primary" data-action="career-ending" data-ending="exit" ${state.money < 50000 || state.debt > 0 ? 'disabled' : ''}>Choose funded exit</button></div></div>
        <div class="card"><h4>Boutique agency</h4><p>Reach level 5, reputation 70, and $25,000 to shift from individual work into protected management.</p><div class="progress-wrap"><div class="progress"><i style="width:${Math.min(100, (state.level / 5) * 30 + (state.reputation / 70) * 35 + (state.money / 25000) * 35)}%"></i></div></div><div class="button-row"><button class="primary" data-action="career-ending" data-ending="agency" ${state.level < 5 || state.reputation < 70 || state.money < 25000 ? 'disabled' : ''}>Launch agency</button></div></div>
        <div class="card"><h4>Sustainable independent</h4><p>Maintain reputation 80, safety 80, five regulars, and low legal heat to establish a stable long-term practice.</p><div class="progress-wrap"><div class="progress"><i style="width:${Math.min(100, state.reputation * 0.3 + safetyIndex() * 0.3 + state.clients.filter((e) => e.status === 'regular').length * 8 + (100 - state.legalHeat) * 0.1)}%"></i></div></div><div class="button-row"><button class="primary" data-action="career-ending" data-ending="sustainable" ${state.reputation < 80 || safetyIndex() < 80 || state.clients.filter((e) => e.status === 'regular').length < 5 || state.legalHeat > 25 ? 'disabled' : ''}>Settle into career</button></div></div>
      </div>
    </section>
  `,
  );
}

function journalPanel() {
  const transactions = state.finance.slice(0, 14);
  const entries = state.journal.slice(0, 22);
  return panelFrame(
    'Journal & save',
    `${state.journal.length} journal entries · ${state.finance.length} finance records`,
    `
    <section class="panel-section">
      <div class="grid three">
        <div class="card"><span class="eyebrow">SAVE STATUS</span><span class="big-number">LOCAL</span><p>${state.settings.autosave ? 'Autosave every 25 seconds and each new day' : 'Manual saving only'} · JSON files move between Sites, PWA, and desktop</p></div>
        <div class="card"><span class="eyebrow">TOTAL REVIEWS</span><span class="big-number">${state.reviews.length}</span><p>${state.reviews.length ? `${(state.reviews.reduce((t, n) => t + n.stars, 0) / state.reviews.length).toFixed(1)} average stars` : 'No published reviews yet'}</p></div>
        <div class="card"><span class="eyebrow">CAREER AGE</span><span class="big-number">${state.day}D</span><p>Created ${new Date(state.createdAt).toLocaleDateString()}</p></div>
      </div>
      <div class="button-row"><button class="primary" data-action="manual-save">Save now</button><button class="secondary" data-action="export-save">Export JSON</button><button class="secondary" data-action="import-save">Import JSON</button><button class="ghost" data-action="toggle-autosave">Autosave: ${state.settings.autosave ? 'on' : 'off'}</button><button class="danger-button" data-action="reset-save">Reset career</button></div>
    </section>

    <section class="panel-section">
      <div class="section-heading"><div><h3>Career journal</h3><p>Major choices, events, outcomes, moves, and risks are recorded automatically.</p></div></div>
      <div class="timeline">${entries.length ? entries.map((t) => `<div class="log-entry"><strong>${escapeHtml(t.title)}</strong><p>${escapeHtml(t.text)}</p><time>${weekday(t.day)} · Day ${t.day} · ${clock(t.minute)}</time></div>`).join('') : '<div class="empty-state"><strong>No journal entries</strong><p>Your story has not started recording events.</p></div>'}</div>
    </section>

    <section class="panel-section">
      <div class="section-heading"><div><h3>Recent transactions</h3><p>Positive amounts are income; negative amounts are expenses, refunds, or investments.</p></div></div>
      <div class="card">${transactions.length ? transactions.map((t) => `<div class="stat-row"><span>Day ${t.day} · ${clock(t.minute)} · ${escapeHtml(t.label)}</span><strong class="${t.amount >= 0 ? 'good' : 'danger'}">${t.amount >= 0 ? '+' : ''}${money(t.amount)}</strong></div>`).join('') : '<p>No transactions yet.</p>'}</div>
    </section>
  `,
  );
}

let pendingCounter = null;
let routeTarget = null;
function setRoute(locationId) {
  const loc = LOCATIONS[locationId];
  if (loc) {
    routeTarget = locationId;
    markTarget(locationId);
    if (activePanel) {
      closePanel();
    }
    if (modalOpen && !dateSession?.locked) {
      closeModal();
    }
    notify('Route set', `${loc.name} is marked in the city and on the minimap.`, 'info');
  }
}

function distanceTo(locationId) {
  const loc = LOCATIONS[locationId];
  if (!world || !loc) {
    return Infinity;
  }
  const dx = world.player.position.x - loc.x;
  const dz = world.player.position.z - loc.z;
  return Math.hypot(dx, dz);
}

function canAfford(amount) {
  if (state.money >= amount) {
    return true;
  }
  notify('Insufficient cash', `This action requires ${money(amount)}.`, 'danger');
  return false;
}

function refreshUi() {
  if (activePanel) {
    renderPanel(activePanel);
  }
  renderDock();
  updateHud(true);
}

function readScreeningOptions() {
  const checked = (key) => !!$(`#screen-${key}`)?.checked;
  return {
    idCheck: checked('idCheck'),
    references: checked('references'),
    deposit: checked('deposit'),
    publicFirst: checked('publicFirst'),
    safeCall: checked('safeCall'),
    security: checked('security'),
  };
}

function screeningCost(options) {
  let cost = 0;
  if (options.idCheck) {
    cost += 15;
  }
  if (options.references) {
    cost += 25;
  }
  if (options.safeCall && !state.protocols.safeCall) {
    cost += 10;
  }
  if (options.security && !state.business.staff.security && state.business.structure !== 'protected') {
    cost += 90;
  }
  return cost;
}

function updateScreeningPreview() {
  const clientId = $('[data-screening-client]')?.dataset.screeningClient;
  const client = findClient(clientId);
  if (!client) {
    return;
  }
  const options = readScreeningOptions();
  const risk = riskScore(state, client, options);
  const cost = screeningCost(options);
  const riskValue = $('#screen-risk-value');
  const riskBar = $('#screen-risk-bar');
  const costValue = $('#screen-cost-value');
  const quote = Number($('#screen-quote')?.value || client.offer);
  if (riskValue) {
    riskValue.textContent = `${risk}/100`;
    riskValue.className = `big-number ${riskClass(risk)}`;
  }
  if (riskBar) {
    riskBar.style.width = `${risk}%`;
    riskBar.parentElement.className = `progress ${riskClass(risk)}`;
  }
  if (costValue) {
    costValue.textContent = money(cost);
  }
  const quoteValue = $('#screen-quote-value');
  if (quoteValue) {
    quoteValue.textContent = money(quote);
  }
  const marginNote = $('#screen-margin-note');
  if (marginNote) {
    const ratio = quote / Math.max(1, client.budget);
    marginNote.textContent =
      ratio <= 0.95
        ? 'Comfortable for this client'
        : ratio <= 1.12
          ? 'Negotiable premium'
          : ratio <= 1.32
            ? 'Aggressive quote'
            : 'Low acceptance probability';
    marginNote.className = `chip ${ratio <= 1.12 ? 'good' : ratio <= 1.32 ? 'warn' : 'danger'}`;
  }
}

function openScreening(clientId) {
  const client = findClient(clientId);
  if (!client) {
    return;
  }
  const pkg = PACKAGES[client.desiredPackage];
  const options = {
    idCheck: client.screening?.idCheck || state.protocols.idCheck,
    references: client.screening?.references || state.protocols.references,
    deposit: client.screening?.deposit || state.protocols.deposit,
    publicFirst: client.screening?.publicFirst || state.protocols.publicFirst,
    safeCall: client.screening?.safeCall || state.protocols.safeCall,
    security:
      client.screening?.security || state.business.staff.security || state.business.structure === 'protected',
  };
  const venues = pkg.venues.filter((f) => f !== 'home' || state.business.housing >= 2);
  const dayOptions = Array.from({ length: 7 }, (f, h) => state.day + h)
    .map(
      (f) =>
        `<option value="${f}" ${f === Math.max(state.day, client.desiredDay) ? 'selected' : ''}>${weekday(f)} · Day ${f}</option>`,
    )
    .join('');
  const timeOptions = [];
  for (let hour = 10; hour <= 23; hour += 1) {
    [0, 30].forEach((half) => {
      const minute = hour * 60 + half;
      timeOptions.push(
        `<option value="${minute}" ${Math.abs(minute - client.desiredMinute) < 20 ? 'selected' : ''}>${clock(minute)}</option>`,
      );
    });
  }
  const flagChips = client.flags?.length
    ? client.flags.map((f) => `<span class="chip danger">${escapeHtml(f)}</span>`).join('')
    : '<span class="chip good">No known red flags</span>';
  const positiveChips =
    client.positives?.map((f) => `<span class="chip good">${escapeHtml(f)}</span>`).join('') || '';
  const defaultQuote = Math.round(Math.max(state.business.prices[pkg.id], client.offer) / 10) * 10;
  const maxQuote = Math.round(Math.max(state.business.prices[pkg.id] * 2.1, client.budget * 1.6) / 10) * 10;
  openModal({
    eyebrow: 'CLIENT SCREENING & NEGOTIATION',
    title: `${escapeHtml(client.name)} · ${escapeHtml(client.archetype)}`,
    subtitle: `Age ${client.age} · ${client.personality} · interested in ${pkg.name.toLowerCase()}. “${escapeHtml(client.message)}”`,
    wide: true,
    body: `
      <div data-screening-client="${client.id}"></div>
      <div class="grid two">
        <div class="card">
          <h4>Client signals</h4>
          <div class="meta-row">${positiveChips}${flagChips}</div>
          <div class="stat-row"><span>Stated budget</span><strong>${money(client.budget)}</strong></div>
          <div class="stat-row"><span>Initial offer</span><strong>${money(client.offer)}</strong></div>
          <div class="stat-row"><span>Reliability estimate</span><strong>${client.reliability}/100</strong></div>
          <div class="stat-row"><span>Interests</span><strong>${client.interests.map(escapeHtml).join(', ')}</strong></div>
          <p>Hidden or inaccurate information may remain until checks are run. Screening skill improves discovery.</p>
        </div>
        <div class="card">
          <h4>Risk preview</h4>
          <span class="big-number" id="screen-risk-value">${riskScore(state, client, options)}/100</span>
          <div class="progress ${riskClass(riskScore(state, client, options))}"><i id="screen-risk-bar" style="width:${riskScore(state, client, options)}%"></i></div>
          <div class="stat-row"><span>Screening cost</span><strong id="screen-cost-value">${money(screeningCost(options))}</strong></div>
          <div class="stat-row"><span>Standing safety index</span><strong>${safetyIndex()}</strong></div>
          <p>Risk changes the probability and severity of difficult events; it does not predetermine an outcome.</p>
        </div>
      </div>

      <div class="panel-section" style="margin-top:14px">
        <div class="section-heading"><div><h3>Verification and boundaries</h3><p>More checks improve safety but can cost money and reduce conversion with impatient clients.</p></div></div>
        <div class="card">
          ${[
            ['idCheck', 'Verify identity · $15', 'Checks identity consistency and payment details.'],
            [
              'references',
              'Contact references · $25',
              'Strongest hidden-flag check; slower for last-minute enquiries.',
            ],
            ['deposit', 'Require 20% deposit', 'Protects the slot and reduces no-show risk.'],
            ['publicFirst', 'Public first meeting', 'Requires a public venue for the first date.'],
            [
              'safeCall',
              `Safe-call coverage${state.protocols.safeCall ? '' : ' · $10'}`,
              'Records venue, timing, and expected checkout.',
            ],
            [
              'security',
              `Security coverage${state.business.staff.security || state.business.structure === 'protected' ? ' · included' : ' · $90'}`,
              'Visible pickup and emergency response.',
            ],
          ]
            .map(
              ([f, h, m]) =>
                `<div class="switch-row"><div class="switch-copy"><strong>${h}</strong><p>${m}</p></div><label class="switch"><input id="screen-${f}" data-screen-check="${f}" type="checkbox" ${options[f] ? 'checked' : ''}><i></i></label></div>`,
            )
            .join('')}
        </div>
      </div>

      <div class="panel-section">
        <div class="section-heading"><div><h3>Quote and schedule</h3><p>Price tolerance depends on budget, reputation, branding, trust, and negotiation skill.</p></div></div>
        <div class="card">
          <div class="range-row"><label>Quote</label><input id="screen-quote" type="range" min="${Math.round(pkg.basePrice * 0.65)}" max="${maxQuote}" step="10" value="${defaultQuote}" data-screen-quote><span class="range-value" id="screen-quote-value">${money(defaultQuote)}</span></div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:9px;margin-top:11px">
            <label><span class="eyebrow">DAY</span><select id="screen-day">${dayOptions}</select></label>
            <label><span class="eyebrow">TIME</span><select id="screen-time">${timeOptions.join('')}</select></label>
            <label><span class="eyebrow">VENUE</span><select id="screen-venue">${venues.map((f) => `<option value="${f}">${LOCATIONS[f].name}</option>`).join('')}</select></label>
          </div>
          <div class="meta-row" style="margin-top:11px"><span id="screen-margin-note" class="chip">Quote position</span><span class="chip info">${pkg.duration} minutes</span><span class="chip">${pkg.name}</span></div>
          <label style="display:grid;gap:6px;margin-top:12px"><span class="eyebrow">PRIVATE NOTES</span><textarea id="screen-notes" rows="2" placeholder="Preferences, boundaries, payment details, or follow-up notes">${escapeHtml(client.notes || '')}</textarea></label>
        </div>
      </div>
    `,
    footer: `<button class="danger-button" data-action="decline-client" data-client="${client.id}">Decline & blacklist option</button><button class="secondary" data-action="close-modal">Keep for later</button><button class="primary" data-action="book-client" data-client="${client.id}">Run checks & negotiate</button>`,
  });
  updateScreeningPreview();
}

function findConflict(day, minute, duration, ignoreId = null) {
  const start = absMinute(day, minute);
  const end = start + duration;
  return state.bookings.find((b) => {
    if (b.id === ignoreId || !['scheduled', 'in-progress'].includes(b.status)) {
      return false;
    }
    const otherStart = absMinute(b.day, b.minute);
    const otherEnd = otherStart + b.duration;
    return start < otherEnd + 30 && end + 30 > otherStart;
  });
}

function readScreeningForm(client) {
  const pkg = PACKAGES[client.desiredPackage];
  const options = readScreeningOptions();
  return {
    clientId: client.id,
    packageId: pkg.id,
    quote: Number($('#screen-quote').value),
    day: Number($('#screen-day').value),
    minute: Number($('#screen-time').value),
    venueId: $('#screen-venue').value,
    notes: $('#screen-notes').value.trim(),
    options,
    screenedRisk: riskScore(state, client, options),
    cost: screeningCost(options),
  };
}

function submitScreening(clientId) {
  const client = findClient(clientId);
  if (!client) {
    return;
  }
  const offer = readScreeningForm(client);
  const pkg = PACKAGES[offer.packageId];
  const conflict = findConflict(offer.day, offer.minute, pkg.duration);
  if (conflict) {
    notify('Calendar conflict', `${conflict.clientName} already occupies that time window.`, 'danger');
    return;
  }
  if (offer.day === state.day && offer.minute < state.minute + 30) {
    notify('Not enough lead time', 'Select a time at least 30 minutes from now.', 'danger');
    return;
  }
  if (!canAfford(offer.cost)) {
    return;
  }
  if (offer.cost) {
    addTransaction(state, -offer.cost, `Screening checks: ${client.name}`, 'screening');
  }
  client.notes = offer.notes;
  client.screening = { ...offer.options };
  if (
    client.hiddenFlag &&
    (offer.options.references || offer.options.idCheck) &&
    chance(0.48 + state.skills.screening * 0.1)
  ) {
    client.flags.push(client.hiddenFlag);
    client.hiddenFlag = null;
    client.risk = clamp(client.risk + 12);
    offer.screenedRisk = riskScore(state, client, offer.options);
    notify(
      'Hidden flag discovered',
      'Verification found information that materially raises the client risk.',
      'warn',
    );
  }
  const structure = STRUCTURES[state.business.structure];
  const overPrice = Math.max(0, offer.quote / Math.max(1, client.budget) - 1);
  const underPrice = Math.max(0, 1 - offer.quote / Math.max(1, client.budget)) * 0.15;
  const checkFriction =
    (offer.options.references ? 0.04 : 0) +
    (offer.options.publicFirst && client.desiredPackage !== 'coffee' ? 0.04 : 0);
  const depositFriction =
    offer.options.deposit && client.flags.includes('Pushes back on a deposit') ? 0.1 : 0;
  const brandBonus =
    state.business.brand === 'luxury' ? 0.07 : state.business.brand === 'approachable' ? 0.04 : 0.02;
  const acceptance = clamp(
    0.56 +
      state.skills.negotiation * 0.065 +
      state.player.charisma / 420 +
      structure.negotiation / 170 +
      (state.business.staff.manager ? 0.08 : 0) +
      client.trust / 600 +
      brandBonus +
      underPrice -
      overPrice * 1.25 -
      checkFriction -
      depositFriction,
    0.06,
    0.96,
  );
  gainXp(5 + Object.values(offer.options).filter(Boolean).length);
  if (chance(acceptance)) {
    confirmBooking(client, offer);
    return;
  }
  const counter = Math.round(Math.min(client.budget * randRange(0.92, 1.02), offer.quote * 0.92) / 10) * 10;
  if (counter >= offer.quote * 0.72 && chance(0.8)) {
    pendingCounter = { clientId, ...offer, quote: counter };
    openModal({
      eyebrow: 'COUNTEROFFER',
      title: `${escapeHtml(client.name)} will not accept ${money(offer.quote)}`,
      subtitle: `Your checks are complete. The client counters at ${money(counter)} for the same date, venue, and boundaries.`,
      body: `<div class="grid three"><div class="card"><span class="eyebrow">YOUR QUOTE</span><span class="big-number">${money(offer.quote)}</span></div><div class="card"><span class="eyebrow">COUNTER</span><span class="big-number">${money(counter)}</span></div><div class="card"><span class="eyebrow">SCREENED RISK</span><span class="big-number">${offer.screenedRisk}</span></div></div><div class="card" style="margin-top:12px"><h4>Negotiation context</h4><p>Walking away protects your rate positioning. Accepting fills the calendar and can create future trust. Screening costs are already spent.</p></div>`,
      footer:
        '<button class="secondary" data-action="reject-counter">Walk away</button><button class="primary" data-action="accept-counter">Accept counteroffer</button>',
      closeable: false,
    });
  } else {
    client.trust = clamp(client.trust - 5);
    client.expiresDay = Math.min(client.expiresDay, state.day + 1);
    logJournal(
      state,
      'Quote declined',
      `${client.name} declined a ${money(offer.quote)} quote after screening.`,
      'business',
    );
    closeModal();
    notify(
      'Negotiation failed',
      `${client.name} declined the quote. The enquiry remains open briefly.`,
      'warn',
    );
    refreshUi();
  }
}

function confirmBooking(client, offer) {
  const pkg = PACKAGES[offer.packageId];
  const depositRate = offer.options.deposit ? 0.2 : 0;
  const deposit = Math.round(offer.quote * depositRate);
  const wasRegular = client.status === 'regular';
  const booking = {
    id: uid('booking'),
    clientId: client.id,
    clientName: client.name,
    clientInitials: client.initials || initials(client.name),
    day: offer.day,
    minute: offer.minute,
    packageId: offer.packageId,
    venueId: offer.venueId,
    duration: pkg.duration,
    quote: offer.quote,
    depositAmount: deposit,
    screenedRisk: riskScore(state, client, offer.options),
    status: 'scheduled',
    createdDay: state.day,
    noShow: chance(
      clamp(
        (100 - client.reliability) / 330 -
          (offer.options.deposit ? 0.08 : 0) -
          (offer.options.idCheck ? 0.03 : 0),
        0.01,
        0.23,
      ),
    ),
    prep: {
      outfit: false,
      confirmed: false,
      route: false,
      safeCall: offer.options.safeCall,
      driver: state.business.staff.driver,
      security: offer.options.security,
    },
    notes: offer.notes,
    regularBefore: wasRegular,
    netEarned: 0,
    grade: null,
  };
  state.bookings.push(booking);
  state.prospects = state.prospects.filter((c) => c.id !== client.id);
  if (!state.clients.some((c) => c.id === client.id)) {
    state.clients.push(client);
  }
  client.status = wasRegular ? 'regular' : 'booked';
  client.trust = clamp(client.trust + 4);
  if (deposit) {
    addTransaction(state, deposit, `Deposit: ${client.name}`, 'booking');
  }
  logJournal(
    state,
    'Booking confirmed',
    `${client.name} booked ${pkg.name.toLowerCase()} for Day ${offer.day} at ${clock(offer.minute)}. Quote ${money(offer.quote)}; screened risk ${booking.screenedRisk}.`,
    'booking',
  );
  state.business.weeklyBookings += 1;
  closeModal();
  pendingCounter = null;
  notify(
    'Booking confirmed',
    `${client.name} · Day ${offer.day} at ${clock(offer.minute)} · ${money(offer.quote)}.`,
    'good',
  );
  openPanel('calendar');
  checkGoals();
}

function openDecline(clientId) {
  const client = findClient(clientId);
  if (client) {
    openModal({
      eyebrow: 'DECLINE ENQUIRY',
      title: `What should happen to ${escapeHtml(client.name)}?`,
      subtitle:
        'Declining protects time. Blacklisting prevents this record from returning in future lead generation.',
      body: `<div class="choice-list"><button class="choice-button" data-action="decline-only" data-client="${client.id}"><div><strong>Politely decline</strong><p>Remove the enquiry without adding a permanent safety record.</p></div><span>DECLINE</span></button><button class="choice-button" data-action="blacklist-lead" data-client="${client.id}"><div><strong>Decline and blacklist</strong><p>Use for repeated boundary pressure, inconsistent verification, threats, or serious red flags.</p></div><span>BLACKLIST</span></button><button class="choice-button" data-action="close-modal"><div><strong>Keep for later</strong><p>Return to the pipeline without changing the record.</p></div><span>CANCEL</span></button></div>`,
      closeable: true,
    });
  }
}

function openClientRecord(clientId) {
  const client = findClient(clientId);
  if (!client) {
    return;
  }
  const history = state.bookings
    .filter((n) => n.clientId === client.id)
    .sort((n, s) => absMinute(s.day, s.minute) - absMinute(n.day, n.minute));
  openModal({
    eyebrow: 'CLIENT RECORD',
    title: `${escapeHtml(client.name)} · ${escapeHtml(client.archetype)}`,
    subtitle: `${client.personality} · trust ${Math.round(client.trust)} · reliability ${Math.round(client.reliability)} · attachment ${Math.round(client.attachment)}`,
    wide: true,
    body: `
      <div class="grid three"><div class="card"><span class="eyebrow">DATES</span><span class="big-number">${client.dates}</span></div><div class="card"><span class="eyebrow">LIFETIME VALUE</span><span class="big-number">${money(client.lifetimeValue)}</span></div><div class="card"><span class="eyebrow">CURRENT RISK</span><span class="big-number">${riskScore(state, client)}</span></div></div>
      <div class="grid two" style="margin-top:12px"><div class="card"><h4>Known preferences</h4><p>Interests: ${client.interests.map(escapeHtml).join(', ')}.</p><div class="meta-row">${client.positives.map((n) => `<span class="chip good">${escapeHtml(n)}</span>`).join('')}${client.flags.map((n) => `<span class="chip danger">${escapeHtml(n)}</span>`).join('')}</div></div><div class="card"><h4>CRM notes</h4><textarea id="client-record-notes" rows="5">${escapeHtml(client.notes || '')}</textarea><div class="button-row"><button class="secondary" data-action="save-client-notes" data-client="${client.id}">Save notes</button></div></div></div>
      <div class="panel-section" style="margin-top:14px"><div class="section-heading"><div><h3>Booking history</h3><p>Trust and attachment can rise together. Strong boundaries are still required with regular clients.</p></div></div><div class="list">${history.length ? history.map((n) => `<div class="card client-card"><div class="avatar">${n.grade || '—'}</div><div class="client-main"><h4>Day ${n.day} · ${PACKAGES[n.packageId].short}</h4><p>${n.status} · ${LOCATIONS[n.venueId].name} · risk ${n.screenedRisk}</p></div><div class="client-value"><strong>${money(n.netEarned || n.depositAmount)}</strong><small>net</small></div></div>`).join('') : '<div class="empty-state"><strong>No completed history</strong><p>This record has not completed a booking.</p></div>'}</div></div>
    `,
    footer: `<button class="danger-button" data-action="blacklist-client-record" data-client="${client.id}">Blacklist</button><button class="secondary" data-action="close-modal">Close</button><button class="primary" data-action="rebook-client" data-client="${client.id}">Create new booking</button>`,
  });
}

function openBooking(bookingId) {
  const booking = findBooking(bookingId);
  if (!booking) {
    return;
  }
  const client = bookingClient(booking);
  const minutesUntil = absMinute(booking.day, booking.minute) - nowMinute();
  const canStart =
    booking.status === 'scheduled' &&
    minutesUntil <= 30 &&
    minutesUntil >= -90 &&
    distanceTo(booking.venueId) <= 6;
  const timing =
    booking.status === 'scheduled'
      ? minutesUntil >= 0
        ? `${Math.ceil(minutesUntil)} minutes until start`
        : `${Math.floor(-minutesUntil)} minutes late`
      : booking.status;
  openModal({
    eyebrow: 'BOOKING FILE',
    title: `${escapeHtml(booking.clientName)} · ${PACKAGES[booking.packageId].name}`,
    subtitle: `Day ${booking.day}, ${clock(booking.minute)} · ${LOCATIONS[booking.venueId].name} · ${timing}`,
    wide: true,
    body: `
      <div class="grid four"><div class="card"><span class="eyebrow">QUOTE</span><span class="big-number">${money(booking.quote)}</span><p>${money(booking.depositAmount)} deposit received</p></div><div class="card"><span class="eyebrow">SCREENED RISK</span><span class="big-number">${booking.screenedRisk}</span><div class="progress ${riskClass(booking.screenedRisk)}"><i style="width:${booking.screenedRisk}%"></i></div></div><div class="card"><span class="eyebrow">CLIENT TRUST</span><span class="big-number">${Math.round(client.trust)}</span><p>${client.personality} · ${client.dates} prior dates</p></div><div class="card"><span class="eyebrow">STATUS</span><span class="big-number" style="font-size:16px">${booking.status.toUpperCase()}</span><p>${timing}</p></div></div>
      <div class="panel-section" style="margin-top:14px"><div class="section-heading"><div><h3>Preparation</h3><p>Each item can improve performance, punctuality, or safety.</p></div></div><div class="grid three">
        <div class="card ${booking.prep.confirmed ? 'selected' : ''}"><h4>Client confirmation</h4><p>Confirm venue, timing, payment, and agreed scope.</p><div class="button-row"><button class="secondary" data-action="booking-confirm" data-booking="${booking.id}" ${booking.prep.confirmed || booking.status !== 'scheduled' ? 'disabled' : ''}>${booking.prep.confirmed ? 'Confirmed' : 'Send confirmation'}</button></div></div>
        <div class="card ${booking.prep.outfit ? 'selected' : ''}"><h4>Wardrobe & presentation</h4><p>Prepare at home. Costs $45 and 45 minutes; improves date quality.</p><div class="button-row"><button class="secondary" data-action="booking-outfit" data-booking="${booking.id}" ${booking.prep.outfit || booking.status !== 'scheduled' ? 'disabled' : ''}>${booking.prep.outfit ? 'Prepared' : distanceTo('home') <= 6 ? 'Prepare now' : 'Route home'}</button></div></div>
        <div class="card ${booking.prep.driver ? 'selected' : ''}"><h4>Transport</h4><p>Route planning is free. A driver costs $45 if not already retained.</p><div class="button-row"><button class="secondary" data-action="booking-route" data-booking="${booking.id}">${booking.prep.route ? 'Route marked' : 'Set route'}</button><button class="ghost" data-action="booking-driver" data-booking="${booking.id}" ${booking.prep.driver || booking.status !== 'scheduled' ? 'disabled' : ''}>${booking.prep.driver ? 'Driver booked' : 'Add driver · $45'}</button></div></div>
      </div></div>
      <div class="card"><h4>Client notes</h4><p>${escapeHtml(booking.notes || client.notes || 'No private notes recorded.')}</p><div class="meta-row"><span class="chip ${booking.prep.safeCall ? 'good' : 'warn'}">${booking.prep.safeCall ? 'safe-call active' : 'no safe-call'}</span><span class="chip ${booking.prep.security ? 'good' : 'warn'}">${booking.prep.security ? 'security coverage' : 'independent arrival'}</span><span class="chip">${PACKAGES[booking.packageId].duration} minutes</span></div></div>
      ${booking.status === 'completed' ? `<div class="card" style="margin-top:12px"><h4>Outcome</h4><div class="stat-row"><span>Grade</span><strong>${booking.grade}</strong></div><div class="stat-row"><span>Net earned</span><strong>${money(booking.netEarned)}</strong></div><div class="stat-row"><span>Review</span><strong>${booking.reviewStars || 0} stars</strong></div></div>` : ''}
    `,
    footer: `${booking.status === 'scheduled' ? `<button class="danger-button" data-action="cancel-booking" data-booking="${booking.id}">Cancel booking</button>` : ''}<button class="secondary" data-action="close-modal">Close</button>${canStart ? `<button class="primary" data-action="start-date" data-booking="${booking.id}">Begin date</button>` : booking.status === 'scheduled' ? `<button class="primary" data-action="booking-route" data-booking="${booking.id}">Route to venue</button>` : ''}`,
  });
}

function performActivity({
  title,
  text,
  cost = 0,
  minutes = 0,
  effects = {},
  xp = 0,
  journalType = 'wellness',
}) {
  if (cost > 0 && !canAfford(cost)) {
    return false;
  }
  if (cost) {
    addTransaction(state, -cost, title, journalType);
  }
  Object.entries(effects).forEach(([key, delta]) => {
    if (key in state.player) {
      state.player[key] = clamp(state.player[key] + delta);
    } else if (key in state.personal) {
      state.personal[key] = clamp(state.personal[key] + delta);
    } else if (key in state.health) {
      state.health[key] = clamp(state.health[key] + delta);
    } else if (key === 'reputation') {
      state.reputation = clamp(state.reputation + delta);
    } else if (key === 'exposure') {
      state.exposure = clamp(state.exposure + delta);
    } else if (key === 'legalHeat') {
      state.legalHeat = clamp(state.legalHeat + delta);
    } else if (key === 'marketingQuality') {
      state.marketing.quality = clamp(state.marketing.quality + delta);
    } else if (key === 'marketingReach') {
      state.marketing.reach = clamp(state.marketing.reach + delta);
    }
  });
  if (minutes) {
    advanceTime(minutes);
  }
  if (xp) {
    gainXp(xp);
  }
  logJournal(state, title, text, journalType);
  closeModal();
  notify(title, text, 'good');
  refreshUi();
  return true;
}

function openHome() {
  const next = upcomingBookings()[0];
  const laterToday = state.bookings.filter(
    (t) => t.status === 'scheduled' && t.day === state.day && t.minute > state.minute,
  );
  openModal({
    eyebrow: 'APARTMENT',
    title: 'Home, preparation, and privacy',
    subtitle: `Housing level ${state.business.housing} · privacy ${Math.round(state.business.privacy)} · ${laterToday.length} later booking${laterToday.length === 1 ? '' : 's'} today`,
    wide: true,
    body: `
      <div class="grid three">
        <div class="card"><h4>Shower and reset</h4><p>Restore hygiene and presentation. 30 minutes.</p><div class="button-row"><button class="secondary" data-action="home-shower">Shower</button></div></div>
        <div class="card"><h4>Rest</h4><p>Nap for 90 minutes. Restore energy and lower stress without advancing to the next day.</p><div class="button-row"><button class="secondary" data-action="home-rest">Nap</button></div></div>
        <div class="card"><h4>Eat at home</h4><p>Spend $14 and 30 minutes for a full meal.</p><div class="button-row"><button class="secondary" data-action="home-eat">Prepare meal</button></div></div>
        <div class="card ${next?.prep.outfit ? 'selected' : ''}"><h4>Prepare next wardrobe</h4><p>${next ? `${next.clientName} · ${PACKAGES[next.packageId].short}. Costs $45 and 45 minutes.` : 'No upcoming booking needs wardrobe preparation.'}</p><div class="button-row"><button class="secondary" data-action="home-prepare-next" ${!next || next.prep.outfit ? 'disabled' : ''}>${next?.prep.outfit ? 'Prepared' : 'Prepare'}</button></div></div>
        <div class="card"><h4>Personal reset</h4><p>Three private hours with no work messaging. Lowers stress, secrecy, and burnout.</p><div class="button-row"><button class="secondary" data-action="home-offline">Go offline</button></div></div>
        <div class="card"><h4>Sleep until 09:00</h4><p>Ends the current day, charges daily overhead, and restores core needs. Later bookings today will be missed.</p><div class="button-row"><button class="primary" data-action="home-end-day">End day</button></div></div>
      </div>
      <div class="card" style="margin-top:12px"><h4>Privacy state</h4><div class="stat-row"><span>Housing privacy</span><strong>${[0, 45, 68, 88][state.business.housing]}</strong></div><div class="stat-row"><span>Public exposure</span><strong>${Math.round(state.exposure)}</strong></div><div class="stat-row"><span>Personal secrecy load</span><strong>${Math.round(state.personal.secrecy)}</strong></div><p>Upgrade housing through Business to improve recovery quality and home-booking viability.</p></div>
    `,
    footer: '<button class="secondary" data-action="close-modal">Leave apartment</button>',
  });
}

function openClinic() {
  const daysSinceCheck = state.day - state.health.lastCheckDay;
  openModal({
    eyebrow: 'HARBOUR HEALTH CLINIC',
    title: 'Confidential health and recovery',
    subtitle: `Routine check: ${state.health.checkStatus} · last visit ${daysSinceCheck ? `${daysSinceCheck} days ago` : 'today'} · injury burden ${Math.round(state.health.injury)}`,
    body: `
      <div class="choice-list">
        <button class="choice-button" data-action="clinic-check"><div><strong>Routine confidential check · $120</strong><p>90 minutes. Restores health confidence, updates the check status, and supports client trust.</p></div><span>HEALTH +</span></button>
        <button class="choice-button" data-action="clinic-therapy"><div><strong>Therapy and decompression · $95</strong><p>60 minutes. Reduces stress, burnout, and trauma pressure without affecting public exposure.</p></div><span>STRESS −</span></button>
        <button class="choice-button" data-action="clinic-treatment" ${state.health.injury <= 0 ? 'disabled' : ''}><div><strong>Treat an injury · ${money(80 + state.health.injury * 4)}</strong><p>120 minutes. Clears injury penalties and restores physical health.</p></div><span>RECOVER</span></button>
      </div>
    `,
    footer: '<button class="secondary" data-action="close-modal">Leave clinic</button>',
  });
}

function openGym() {
  openModal({
    eyebrow: 'NORTHLINE FITNESS',
    title: 'Training and physical recovery',
    subtitle: `Stamina ${Math.round(state.player.stamina)} · presentation ${Math.round(state.player.presentation)} · energy ${Math.round(state.player.energy)}`,
    body: `
      <div class="choice-list">
        <button class="choice-button" data-action="gym-train"><div><strong>Structured training · $20</strong><p>90 minutes. Builds stamina and presentation, reduces stress, and consumes energy.</p></div><span>TRAIN</span></button>
        <button class="choice-button" data-action="gym-recover"><div><strong>Recovery session · $60</strong><p>60 minutes. Restores energy and reduces physical strain without improving long-term stats.</p></div><span>RECOVER</span></button>
        <button class="choice-button" data-action="gym-class"><div><strong>Confidence workshop · $85</strong><p>120 minutes. Builds charisma, composure experience, and social confidence.</p></div><span>SKILL</span></button>
      </div>
    `,
    footer: '<button class="secondary" data-action="close-modal">Leave gym</button>',
  });
}

function openStudio() {
  openModal({
    eyebrow: 'NOIR PHOTO STUDIO',
    title: 'Profile production and brand control',
    subtitle: `Brand quality ${Math.round(state.marketing.quality)} · reach ${Math.round(state.marketing.reach)} · exposure ${Math.round(state.exposure)}`,
    body: `
      <div class="choice-list">
        <button class="choice-button" data-action="studio-editorial"><div><strong>Editorial profile set · $350</strong><p>Three hours. Strong brand-quality gain, modest reputation, and some exposure.</p></div><span>PREMIUM</span></button>
        <button class="choice-button" data-action="studio-discreet"><div><strong>Discreet refresh · $190</strong><p>Two hours. Smaller quality gain with tighter metadata and lower public exposure.</p></div><span>PRIVATE</span></button>
        <button class="choice-button" data-action="studio-copy"><div><strong>Profile writing session · $120</strong><p>90 minutes. Improves platform trust and branding experience without new images.</p></div><span>CONVERT</span></button>
      </div>
    `,
    footer: '<button class="secondary" data-action="close-modal">Leave studio</button>',
  });
}

function openSafehub() {
  openModal({
    eyebrow: 'THE LANTERN NETWORK',
    title: 'Peer support and safety intelligence',
    subtitle: `Peer support ${Math.round(state.personal.peerSupport)} · ${state.blacklist.length} shared records · safety index ${safetyIndex()}`,
    body: `
      <div class="choice-list">
        <button class="choice-button" data-action="safehub-audit"><div><strong>Client-list safety audit · $40</strong><p>60 minutes. Reveals hidden information in the riskiest open enquiry when available.</p></div><span>AUDIT</span></button>
        <button class="choice-button" data-action="safehub-membership"><div><strong>Safe-call membership · $120</strong><p>Activates safe-call and duress-code defaults; improves peer support.</p></div><span>PROTECT</span></button>
        <button class="choice-button" data-action="safehub-referral"><div><strong>Trade trusted referrals · $75</strong><p>90 minutes. Generates one or two lower-risk leads and strengthens the network.</p></div><span>REFER</span></button>
        <button class="choice-button" data-action="safehub-support"><div><strong>Peer support circle · $25</strong><p>90 minutes. Reduces stress, burnout, and isolation without public exposure.</p></div><span>SUPPORT</span></button>
      </div>
    `,
    footer: '<button class="secondary" data-action="close-modal">Leave network</button>',
  });
}

function openPark() {
  openModal({
    eyebrow: 'GLASSHOUSE PARK',
    title: 'Quiet time away from work',
    subtitle: 'Public, low-cost recovery with a small energy cost.',
    body: '<div class="choice-list"><button class="choice-button" data-action="park-walk"><div><strong>Take a private walk</strong><p>45 minutes. Reduce stress and secrecy load while using a small amount of energy.</p></div><span>WALK</span></button><button class="choice-button" data-action="park-long"><div><strong>Spend the afternoon offline</strong><p>Three hours. Stronger stress and burnout recovery, but fewer hours remain for work.</p></div><span>RESET</span></button></div>',
    footer: '<button class="secondary" data-action="close-modal">Leave park</button>',
  });
}

function openLegalAid() {
  openModal({
    eyebrow: 'HARBOURLINE LEGAL AID',
    title: 'Advice, rights, and privacy',
    subtitle: `Legal heat ${Math.round(state.legalHeat)} · public exposure ${Math.round(state.exposure)} · ${REGIONS[state.regionId].legalModel}`,
    body: `
      <div class="choice-list">
        <button class="choice-button" data-action="legal-consult"><div><strong>Confidential consultation · $150</strong><p>60 minutes. A lawyer reviews your setup for this region's framework. Strongly lowers legal heat.</p></div><span>HEAT −</span></button>
        <button class="choice-button" data-action="legal-workshop"><div><strong>Know-your-rights workshop</strong><p>Two hours, free. Lowers legal heat a little, builds peer contacts and confidence.</p></div><span>LEARN</span></button>
        <button class="choice-button" data-action="legal-privacy"><div><strong>Privacy clean-up · $90</strong><p>90 minutes. Takedown requests and metadata scrubbing cut public exposure and tighten home privacy.</p></div><span>EXPOSURE −</span></button>
      </div>
      <p class="fine-print">Fictional legal services for gameplay. Nothing here is legal advice.</p>
    `,
    footer: '<button class="secondary" data-action="close-modal">Leave office</button>',
  });
}

function openVenue(location) {
  const scheduled = state.bookings.filter((t) => t.status === 'scheduled' && t.venueId === location.id);
  openModal({
    eyebrow: location.type === 'venue' ? 'VENUE' : 'CITY LOCATION',
    title: location.name,
    subtitle: location.description,
    body: `
      ${
        scheduled.length
          ? `<div class="card"><h4>Scheduled here</h4>${scheduled
              .slice(0, 3)
              .map(
                (t) =>
                  `<div class="stat-row"><span>Day ${t.day} · ${clock(t.minute)} · ${escapeHtml(t.clientName)}</span><strong>${money(t.quote)}</strong></div>`,
              )
              .join('')}</div>`
          : ''
      }
      <div class="choice-list" style="margin-top:${scheduled.length ? '12px' : '0'}">
        <button class="choice-button" data-action="venue-network" data-location="${location.id}"><div><strong>Network discreetly · $60</strong><p>90 minutes. May create a locally relevant lead, with some exposure.</p></div><span>NETWORK</span></button>
        <button class="choice-button" data-action="venue-scout" data-location="${location.id}"><div><strong>Scout entrances and exits</strong><p>30 minutes. Improves route preparation for future bookings at this venue.</p></div><span>PREPARE</span></button>
        ${
          location.id === 'theatre'
            ? '<button class="choice-button" data-action="theatre-matinee"><div><strong>Catch a matinee alone · $45</strong><p>Two hours in the dark with a good play. Lowers stress and secrecy load; a little conversation material for culture bookings.</p></div><span>UNWIND</span></button>'
            : ''
        }
      </div>
    `,
    footer: '<button class="secondary" data-action="close-modal">Return to city</button>',
  });
}

function interact() {
  if (!world || modalOpen || activePanel) {
    return;
  }
  const location = world.getNearbyLocation();
  if (!location) {
    return;
  }
  if (routeTarget === location.id) {
    routeTarget = null;
  }
  const due = state.bookings
    .filter((t) => t.status === 'scheduled' && t.venueId === location.id)
    .sort(
      (t, n) =>
        Math.abs(absMinute(t.day, t.minute) - nowMinute()) -
        Math.abs(absMinute(n.day, n.minute) - nowMinute()),
    )
    .find((t) => {
      const delta = absMinute(t.day, t.minute) - nowMinute();
      return delta <= 30 && delta >= -90;
    });
  if (due) {
    startDate(due.id);
    return;
  }
  switch (location.id) {
    case 'home':
      openHome();
      break;
    case 'clinic':
      openClinic();
      break;
    case 'gym':
      openGym();
      break;
    case 'studio':
      openStudio();
      break;
    case 'safehub':
      openSafehub();
      break;
    case 'park':
      openPark();
      break;
    case 'legal':
      openLegalAid();
      break;
    case 'agency':
      openPanel('business');
      break;
    case 'station':
      openPanel('regions');
      break;
    default:
      openVenue(location);
      break;
  }
}

function buildDatePhases(client, booking) {
  const topic = client.interests?.[0] || 'the city';
  let incident;
  const flags = client.flags || [];
  if (flags.some((flag) => flag.toLowerCase().includes('drinking'))) {
    incident = {
      title: 'The client seems impaired',
      text: 'Their speech and coordination no longer match the agreed plan. Continuing would make consent and logistics unreliable.',
      choices: [
        {
          label: 'End the date and activate the safe-call',
          description: 'Prioritize a controlled exit without debating the situation.',
          style: 'clear',
          skill: 'safety',
          attribute: 'streetSmarts',
          base: 0.72,
          effects: { boundaries: 14, composure: 5, score: 3 },
          fail: { composure: -8, stress: 8 },
          safety: true,
          exit: true,
        },
        {
          label: 'Move to a public lobby and reassess',
          description: 'Reduce isolation and arrange safe transport for both parties.',
          style: 'reassuring',
          skill: 'composure',
          attribute: 'resilience',
          base: 0.62,
          effects: { boundaries: 8, connection: 2, composure: 4 },
          fail: { boundaries: -8, stress: 7 },
          safety: true,
        },
        {
          label: 'Try to continue the original plan',
          description: 'Preserves the booking only if the situation is less serious than it appears.',
          style: 'flexible',
          skill: 'conversation',
          attribute: 'intuition',
          base: 0.25,
          effects: { connection: 5, score: 2 },
          fail: { boundaries: -18, composure: -12, stress: 14 },
          safety: true,
        },
      ],
    };
  } else if (
    flags.some((flag) => flag.toLowerCase().includes('venue') || flag.toLowerCase().includes('plan'))
  ) {
    incident = {
      title: 'A last-minute venue change is proposed',
      text: 'The new address was not screened and would disrupt the route and safe-call plan.',
      choices: [
        {
          label: 'Keep the original venue',
          description: 'State the agreed boundary and continue only under the screened plan.',
          style: 'clear',
          skill: 'safety',
          attribute: 'resilience',
          base: 0.68,
          effects: { boundaries: 12, score: 4, composure: 3 },
          fail: { connection: -7, stress: 5 },
          safety: true,
        },
        {
          label: 'Offer a public alternative',
          description: 'Protect safety while showing flexibility and preserving the date.',
          style: 'reassuring',
          skill: 'negotiation',
          attribute: 'intelligence',
          base: 0.62,
          effects: { boundaries: 9, connection: 5, score: 4 },
          fail: { connection: -6, composure: -4 },
          safety: true,
        },
        {
          label: 'Accept the change',
          description: 'High-risk flexibility that may please the client but defeats screening.',
          style: 'flexible',
          skill: 'conversation',
          attribute: 'charisma',
          base: 0.34,
          effects: { connection: 9, score: 2, boundaries: -10 },
          fail: { boundaries: -18, composure: -10, stress: 12 },
          safety: true,
        },
      ],
    };
  } else if (
    flags.some(
      (flag) => flag.toLowerCase().includes('secrecy') || flag.toLowerCase().includes('public profile'),
    )
  ) {
    incident = {
      title: 'Privacy expectations change mid-date',
      text: 'The client asks for a level of secrecy that conflicts with your safe-call and recordkeeping standards.',
      choices: [
        {
          label: 'Explain the non-negotiable safety record',
          description: 'Keep essential check-in data while limiting unnecessary details.',
          style: 'clear',
          skill: 'safety',
          attribute: 'intelligence',
          base: 0.7,
          effects: { boundaries: 12, connection: 2, score: 4 },
          fail: { connection: -8, stress: 4 },
          safety: true,
        },
        {
          label: 'Offer a privacy-preserving compromise',
          description: 'Keep the safe-call while switching off nonessential devices.',
          style: 'polished',
          skill: 'negotiation',
          attribute: 'intuition',
          base: 0.66,
          effects: { boundaries: 8, connection: 6, score: 5 },
          fail: { composure: -6, stress: 5 },
          safety: true,
        },
        {
          label: 'Disable all safety sharing',
          description: 'Maximizes client comfort but removes your support layer.',
          style: 'flexible',
          skill: 'conversation',
          attribute: 'charisma',
          base: 0.3,
          effects: { connection: 10, boundaries: -14 },
          fail: { boundaries: -20, stress: 13 },
          safety: true,
        },
      ],
    };
  } else if (flags.some((flag) => /payment|deposit/i.test(flag))) {
    incident = {
      title: 'The balance is disputed',
      text: 'Halfway through, the client suggests a lower total than the one agreed. The tone is friendly; the number is not.',
      choices: [
        {
          label: 'Restate the agreed rate calmly',
          description: 'Name the figure once, without apology, and move the evening on.',
          style: 'clear',
          skill: 'negotiation',
          attribute: 'intelligence',
          base: 0.66,
          effects: { boundaries: 10, composure: 3, score: 5 },
          fail: { connection: -6, stress: 5 },
        },
        {
          label: 'Pause and settle the balance now',
          description: 'Stop the date until payment matches the booking, then continue if it does.',
          style: 'polished',
          skill: 'safety',
          attribute: 'streetSmarts',
          base: 0.7,
          effects: { boundaries: 12, composure: 4, score: 3 },
          fail: { connection: -8, stress: 4 },
          safety: true,
        },
        {
          label: 'Let it go to keep the mood',
          description: 'Protects the atmosphere, teaches the client that terms are negotiable.',
          style: 'flexible',
          skill: 'conversation',
          attribute: 'charisma',
          base: 0.4,
          effects: { connection: 8, score: 1, boundaries: -9 },
          fail: { boundaries: -14, stress: 9, score: -3 },
        },
      ],
    };
  } else if (flags.some((flag) => /urgency|conflict/i.test(flag))) {
    incident = {
      title: 'The story stops adding up',
      text: 'Details the client gives tonight do not match what was said during screening. It may be nothing. It may not.',
      choices: [
        {
          label: 'Ask one calm, direct question',
          description: 'Give the client room to explain, and listen for what does not fit.',
          style: 'clear',
          skill: 'screening',
          attribute: 'intuition',
          base: 0.64,
          effects: { boundaries: 9, composure: 4, score: 4 },
          fail: { connection: -5, stress: 5 },
          safety: true,
        },
        {
          label: 'Check in quietly with your safe-call',
          description: 'Share the venue and a revised end time without changing your manner.',
          style: 'polished',
          skill: 'safety',
          attribute: 'streetSmarts',
          base: 0.72,
          effects: { boundaries: 11, composure: 6, score: 3 },
          fail: { composure: -5, stress: 4 },
          safety: true,
        },
        {
          label: 'Ignore it and stay charming',
          description: 'Keeps the evening smooth if the worry is unfounded.',
          style: 'playful',
          skill: 'conversation',
          attribute: 'charisma',
          base: 0.45,
          effects: { connection: 9, score: 3, boundaries: -6 },
          fail: { boundaries: -12, composure: -8, stress: 8 },
          safety: true,
        },
      ],
    };
  } else if (booking.packageId === 'theatre') {
    incident = {
      title: 'Intermission: a familiar face',
      text: 'In the foyer someone you know from another part of your life waves and starts across the room.',
      choices: [
        {
          label: 'Introduce your guest with practised discretion',
          description: 'A light, true-enough introduction and an easy exit back to your seats.',
          style: 'polished',
          skill: 'composure',
          attribute: 'presentation',
          base: 0.66,
          effects: { composure: 6, connection: 5, score: 6 },
          fail: { composure: -5, exposure: 2 },
        },
        {
          label: 'Step away to the bar until the bell',
          description: 'Avoid the encounter entirely and keep both lives separate.',
          style: 'clear',
          skill: 'safety',
          attribute: 'streetSmarts',
          base: 0.72,
          effects: { boundaries: 8, composure: 4, score: 3, exposure: -1 },
          fail: { connection: -5 },
        },
        {
          label: 'Talk about the play and own the moment',
          description: 'Confidence can make the meeting unremarkable. Or memorable.',
          style: 'playful',
          skill: 'conversation',
          attribute: 'charisma',
          base: 0.58,
          effects: { connection: 10, score: 6, exposure: 1 },
          fail: { connection: -4, exposure: 3 },
        },
      ],
    };
  } else {
    incident = {
      title: 'The client requests an extension',
      text: 'The date is going well, but the requested extra time was not included in the original quote.',
      choices: [
        {
          label: 'Offer a clear paid extension',
          description: 'State the additional rate and revised checkout time.',
          style: 'clear',
          skill: 'negotiation',
          attribute: 'intelligence',
          base: 0.66,
          effects: { boundaries: 9, connection: 4, score: 6, extension: 1 },
          fail: { connection: -5, stress: 3 },
        },
        {
          label: 'Decline warmly and keep the schedule',
          description: 'Protect energy and future commitments without making the ending abrupt.',
          style: 'reassuring',
          skill: 'conversation',
          attribute: 'charisma',
          base: 0.7,
          effects: { boundaries: 10, connection: 3, score: 4 },
          fail: { connection: -5 },
        },
        {
          label: 'Give the extra time for free',
          description: 'May strengthen attachment but weakens rate and time boundaries.',
          style: 'flexible',
          skill: 'composure',
          attribute: 'resilience',
          base: 0.58,
          effects: { connection: 10, score: 2, boundaries: -8 },
          fail: { composure: -6, stress: 6 },
        },
      ],
    };
  }
  return [
    {
      title: 'Arrival and first impression',
      text: `${client.name} is ${client.personality.toLowerCase()} and watches how you set the tone. The first minute establishes warmth, confidence, and boundaries.`,
      choices: [
        {
          label: 'Lead with polished confidence',
          description: 'Warm greeting, composed posture, and a clear social frame.',
          style: 'polished',
          skill: 'conversation',
          attribute: 'presentation',
          base: 0.62,
          effects: { connection: 8, composure: 5, score: 6 },
          fail: { connection: -4, composure: -3 },
        },
        {
          label: 'Confirm timing and the agreed plan',
          description: 'Start with clarity, venue details, and the scheduled checkout.',
          style: 'clear',
          skill: 'safety',
          attribute: 'intelligence',
          base: 0.68,
          effects: { boundaries: 11, composure: 4, score: 4 },
          fail: { connection: -4 },
        },
        {
          label: 'Open with playful spontaneity',
          description: 'Create immediate energy and let the evening feel less transactional.',
          style: 'playful',
          skill: 'conversation',
          attribute: 'charisma',
          base: 0.58,
          effects: { connection: 12, score: 5, boundaries: -2 },
          fail: { connection: -7, composure: -2 },
        },
      ],
    },
    {
      title: `Conversation turns to ${topic}`,
      text: `The client becomes more engaged when ${topic} comes up. You can deepen the connection, manage attention, or keep the conversation balanced.`,
      choices: [
        {
          label: `Ask an informed question about ${topic}`,
          description: 'Listen closely and use the answer to guide the next topic.',
          style: 'measured',
          skill: 'conversation',
          attribute: 'intelligence',
          base: 0.66,
          effects: { connection: 11, score: 7, composure: 2 },
          fail: { connection: -3 },
        },
        {
          label: 'Share a vivid personal story',
          description: 'Create emotional color while keeping professional details private.',
          style: 'playful',
          skill: 'conversation',
          attribute: 'charisma',
          base: 0.6,
          effects: { connection: 12, score: 6 },
          fail: { connection: -6, exposure: 2 },
        },
        {
          label: 'Read the room and include others',
          description: 'Useful at public venues where social awareness matters.',
          style: 'polished',
          skill: 'composure',
          attribute: 'intuition',
          base: 0.64,
          effects: { connection: 7, composure: 7, score: 7 },
          fail: { connection: -4, composure: -3 },
        },
      ],
    },
    {
      title: 'Manage the pace of the date',
      text: 'The planned itinerary is working, but energy, timing, and client mood are beginning to diverge.',
      choices: [
        {
          label: 'Follow the planned itinerary',
          description: 'Protect timing, payment expectations, and venue logistics.',
          style: 'polished',
          skill: 'composure',
          attribute: 'intelligence',
          base: 0.67,
          effects: { boundaries: 7, composure: 7, score: 6 },
          fail: { connection: -4 },
        },
        {
          label: 'Adapt to the client’s energy',
          description: 'Use intuition to change conversation and pacing without abandoning boundaries.',
          style: 'flexible',
          skill: 'conversation',
          attribute: 'intuition',
          base: 0.61,
          effects: { connection: 10, composure: 3, score: 6 },
          fail: { boundaries: -5, stress: 4 },
        },
        {
          label: 'Suggest a premium upgrade',
          description: 'Offer an agreed package extension or future booking at a clear rate.',
          style: 'clear',
          skill: 'negotiation',
          attribute: 'charisma',
          base: 0.55,
          effects: { connection: 4, boundaries: 5, score: 7, extension: 1 },
          fail: { connection: -8, score: -2 },
        },
      ],
    },
    incident,
    {
      title: 'Closing the date',
      text: 'The final minutes determine payment confidence, review tone, follow-up, and whether professional boundaries remain clear.',
      choices: [
        {
          label: 'Confirm payment and follow-up clearly',
          description: 'Close the business details before the emotional goodbye.',
          style: 'clear',
          skill: 'negotiation',
          attribute: 'intelligence',
          base: 0.72,
          effects: { boundaries: 9, score: 7, composure: 3 },
          fail: { stress: 4 },
        },
        {
          label: 'End with a warm personal goodbye',
          description: 'Prioritize emotional connection and the possibility of a regular relationship.',
          style: 'reassuring',
          skill: 'conversation',
          attribute: 'charisma',
          base: 0.66,
          effects: { connection: 11, score: 6, attachment: 2 },
          fail: { connection: -4 },
        },
        {
          label: 'Make a discreet, efficient departure',
          description: 'Minimize exposure and protect the next commitment.',
          style: 'polished',
          skill: 'safety',
          attribute: 'streetSmarts',
          base: 0.7,
          effects: { composure: 8, boundaries: 5, score: 5, exposure: -2 },
          fail: { connection: -5 },
        },
      ],
    },
  ];
}

function startDate(bookingId) {
  const booking = findBooking(bookingId);
  if (!booking || booking.status !== 'scheduled') {
    return;
  }
  const minutesUntil = absMinute(booking.day, booking.minute) - nowMinute();
  if (minutesUntil > 30 || minutesUntil < -90) {
    notify(
      'Outside arrival window',
      minutesUntil > 30
        ? `The booking begins in ${Math.ceil(minutesUntil)} minutes.`
        : 'The client has already waited too long.',
      'warn',
    );
    return;
  }
  if (distanceTo(booking.venueId) > 6) {
    setRoute(booking.venueId);
    return;
  }
  if (state.player.health < 20) {
    notify(
      'Too unwell to work',
      'Your health is too low to take this booking safely. Visit Harbour Health Clinic or rest first.',
      'danger',
      5500,
    );
    return;
  }
  const client = bookingClient(booking);
  if (booking.noShow) {
    handleNoShow(booking, client);
    return;
  }
  booking.status = 'in-progress';
  const prepBonus =
    (booking.prep.outfit ? 7 : 0) + (booking.prep.confirmed ? 5 : 0) + (booking.prep.route ? 2 : 0);
  dateSession = {
    locked: true,
    bookingId: booking.id,
    phaseIndex: 0,
    phases: buildDatePhases(client, booking),
    connection: clamp(38 + client.trust * 0.2 + state.skills.conversation * 3),
    boundaries: clamp(
      62 + state.skills.safety * 5 + state.skills.screening * 2 + (booking.prep.safeCall ? 4 : 0),
    ),
    composure: clamp(
      58 + state.player.resilience * 0.22 + state.skills.composure * 5 - state.player.stress * 0.25,
    ),
    score: clamp(
      48 +
        state.player.presentation * 0.18 +
        prepBonus +
        state.player.hygiene * 0.06 -
        Math.max(0, 35 - state.player.energy) * 0.35,
    ),
    incidents: 0,
    extensionUnits: 0,
    exposureDelta: 0,
    attachmentDelta: 0,
    stressDelta: 0,
    endedEarly: false,
    choices: [],
    lastOutcome: null,
  };
  routeTarget = null;
  closePanel();
  renderDatePhase();
}

function renderDatePhase() {
  const session = dateSession;
  if (!session) {
    return;
  }
  const booking = findBooking(session.bookingId);
  const client = bookingClient(booking);
  const phase = session.phases[session.phaseIndex];
  openModal({
    eyebrow: `DATE · PHASE ${session.phaseIndex + 1} OF ${session.phases.length}`,
    title: `${escapeHtml(client.name)} · ${PACKAGES[booking.packageId].short}`,
    subtitle: `${LOCATIONS[booking.venueId].name} · screened risk ${booking.screenedRisk} · all depictions remain non-graphic`,
    wide: true,
    closeable: false,
    body: `
      <div class="date-scene">
        <span class="phase">${session.lastOutcome ? 'OUTCOME / NEXT MOMENT' : 'CURRENT MOMENT'}</span>
        ${session.lastOutcome ? `<div class="card ${session.lastOutcome.success ? 'selected' : ''}" style="margin:8px 0 12px"><h4>${session.lastOutcome.success ? 'The choice lands well' : 'The moment becomes harder'}</h4><p>${escapeHtml(session.lastOutcome.text)}</p></div>` : ''}
        <h3>${phase.title}</h3><p>${phase.text}</p>
        <div class="date-meters"><div class="date-meter"><span>CONNECTION</span><strong>${Math.round(session.connection)}</strong></div><div class="date-meter"><span>BOUNDARIES</span><strong>${Math.round(session.boundaries)}</strong></div><div class="date-meter"><span>COMPOSURE</span><strong>${Math.round(session.composure)}</strong></div></div>
      </div>
      <div class="choice-list">${phase.choices.map((choice, index) => `<button class="choice-button" data-action="date-choice" data-choice="${index}"><div><strong>${choice.label}</strong><p>${choice.description}</p></div><span>${choice.skill.toUpperCase()}</span></button>`).join('')}</div>
    `,
  });
}

function applyDateEffects(effects = {}) {
  const session = dateSession;
  Object.entries(effects).forEach(([key, scaled]) => {
    if (['connection', 'boundaries', 'composure', 'score'].includes(key)) {
      session[key] = clamp(session[key] + scaled);
    } else if (key === 'stress') {
      session.stressDelta += scaled;
    } else if (key === 'exposure') {
      session.exposureDelta += scaled;
    } else if (key === 'attachment') {
      session.attachmentDelta += scaled;
    } else if (key === 'extension') {
      session.extensionUnits += scaled;
    }
  });
}

function chooseDateOption(index) {
  const session = dateSession;
  if (!session) {
    return;
  }
  const booking = findBooking(session.bookingId);
  const client = bookingClient(booking);
  const phase = session.phases[session.phaseIndex];
  const choice = phase.choices[index];
  if (!choice) {
    return;
  }
  const skillRank = state.skills[choice.skill] || 0;
  const attribute = state.player[choice.attribute] || 50;
  const styleBonus =
    choice.style === client.bestStyle
      ? 0.15
      : choice.style === 'clear' && client.personalityId === 'direct'
        ? 0.12
        : 0;
  const prepBonus =
    (booking.prep.confirmed ? 0.025 : 0) +
    (booking.prep.outfit ? 0.02 : 0) +
    (booking.prep.driver ? 0.02 : 0);
  const safetyBonus = choice.safety ? safetyIndex() / 620 : 0;
  const fatigue = state.player.stress / 520 + state.health.burnout / 700;
  const riskPenalty = choice.safety ? booking.screenedRisk / 520 : booking.screenedRisk / 1000;
  const successChance = clamp(
    choice.base +
      skillRank * 0.055 +
      attribute / 430 +
      styleBonus +
      prepBonus +
      safetyBonus -
      fatigue -
      riskPenalty,
    0.08,
    0.97,
  );
  const success = chance(successChance);
  applyDateEffects(success ? choice.effects : choice.fail);
  if (!success) {
    kit.input.rumble(choice.safety ? 0.45 : 0.25, 110);
  }
  if (choice.safety && !success) {
    session.incidents += 1;
  }
  if (choice.exit) {
    session.endedEarly = true;
    if (success) {
      session.incidents = Math.max(0, session.incidents - 1);
    }
  }
  session.choices.push({ phase: phase.title, choice: choice.label, success });
  const successText = choice.exit
    ? 'You execute a controlled exit and preserve the safety plan, even though the date ends early.'
    : `Your ${choice.style} approach matches the moment and keeps the date moving on workable terms.`;
  const failText = choice.safety
    ? 'The client resists the boundary and the moment becomes more stressful; your remaining support systems now matter more.'
    : 'The approach does not match the client or setting, and you have to recover the tone.';
  session.lastOutcome = { success, text: success ? successText : failText };
  session.phaseIndex += 1;
  if (
    session.endedEarly ||
    session.phaseIndex >= session.phases.length ||
    session.boundaries <= 12 ||
    session.composure <= 8
  ) {
    if (session.boundaries <= 12 || session.composure <= 8) {
      session.endedEarly = true;
    }
    finishDate();
  } else {
    renderDatePhase();
  }
}

function gradeFor(score) {
  return score >= 92 ? 'A+' : score >= 84 ? 'A' : score >= 74 ? 'B' : score >= 62 ? 'C' : 'D';
}

function reviewText(grade, client, session) {
  return session.endedEarly && session.incidents === 0
    ? 'Professional, clear, and serious about safety. The evening ended earlier than planned.'
    : grade === 'A+' || grade === 'A'
      ? `Exceptional company—polished, attentive, and easy to trust. ${client.name.split(' ')[0]} would book again.`
      : grade === 'B'
        ? 'A strong, well-managed date with good conversation and clear expectations.'
        : grade === 'C'
          ? 'The date was acceptable, though pacing and chemistry were uneven.'
          : 'The experience felt strained and did not match the expected plan.';
}

function finishDate() {
  const session = dateSession;
  const booking = findBooking(session.bookingId);
  const client = bookingClient(booking);
  const pkg = PACKAGES[booking.packageId];
  const average = (session.connection + session.boundaries + session.composure + session.score) / 4;
  const score = clamp(Math.round(average - session.incidents * 7 - (session.endedEarly ? 5 : 0)));
  const grade = gradeFor(score);
  const tipRate =
    grade === 'A+' ? 0.25 : grade === 'A' ? 0.17 : grade === 'B' ? 0.09 : grade === 'C' ? 0.03 : 0;
  const payFactor = session.endedEarly ? 0.62 : 1;
  const extensionPay =
    session.extensionUnits > 0 && !session.endedEarly
      ? Math.round((booking.quote / Math.max(1, pkg.duration)) * 60 * session.extensionUnits)
      : 0;
  const gross = Math.round(booking.quote * payFactor + extensionPay);
  const tip = Math.round(gross * tipRate * randRange(0.72, 1.24));
  const cut = Math.round(gross * STRUCTURES[state.business.structure].cut);
  const balance = Math.max(0, gross - booking.depositAmount) + tip - cut;
  addTransaction(state, balance, `Booking balance and tip: ${client.name}`, 'booking');
  state.business.grossLifetime += gross + tip;
  booking.netEarned = booking.depositAmount + balance;
  booking.grade = grade;
  booking.performance = score;
  booking.status = 'completed';
  booking.tip = tip;
  booking.structureCut = cut;
  const stars = clamp(Math.round(score / 20), 1, 5);
  booking.reviewStars = stars;
  const review = {
    id: uid('review'),
    clientId: client.id,
    day: state.day,
    stars,
    text: reviewText(grade, client, session),
  };
  state.reviews.unshift(review);
  state.reviews = state.reviews.slice(0, 80);
  const reputationDelta = (stars - 3) * 2.4 + (session.incidents === 0 ? 1.2 : -session.incidents * 1.8);
  state.reputation = clamp(state.reputation + reputationDelta);
  state.exposure = clamp(
    state.exposure + pkg.exposure + session.exposureDelta + (state.business.brand === 'discreet' ? -1 : 0),
  );
  state.legalHeat = clamp(
    state.legalHeat + (REGIONS[state.regionId].legalRisk * pkg.exposure) / 250 + session.incidents * 1.5,
  );
  client.dates += 1;
  client.lifetimeValue += gross + tip;
  client.trust = clamp(client.trust + (score - 55) * 0.22 - session.incidents * 5);
  client.attachment = clamp(
    client.attachment + Math.max(0, session.connection - 55) * 0.18 + session.attachmentDelta,
  );
  const becameRegular =
    client.status !== 'regular' &&
    client.trust >= 63 &&
    grade !== 'D' &&
    chance(0.28 + client.dates * 0.12 + state.skills.conversation * 0.05);
  if (becameRegular || booking.regularBefore) {
    client.status = 'regular';
  } else {
    client.status = 'past';
  }
  state.player.energy = clamp(state.player.energy - pkg.energy - session.extensionUnits * 7);
  state.player.stress = clamp(
    state.player.stress +
      pkg.stress +
      session.stressDelta +
      session.incidents * 7 -
      state.skills.composure * 1.5,
  );
  state.player.hygiene = clamp(state.player.hygiene - 12 - pkg.duration / 45);
  state.player.hunger = clamp(state.player.hunger - 8 - pkg.duration / 50);
  if (session.incidents > 0 && session.boundaries < 35) {
    const injury = randInt(2, 8) * session.incidents;
    state.player.health = clamp(state.player.health - injury);
    state.health.injury = clamp(state.health.injury + injury * 0.7);
  }
  state.health.burnout = clamp(
    state.health.burnout + pkg.duration / 95 + session.incidents * 3 - (grade === 'A+' ? 2 : 0),
  );
  state.daily.dates += 1;
  if (session.incidents === 0 || (session.endedEarly && session.boundaries >= 40)) {
    state.daily.safeDates += 1;
    state.goals.safeFive += 1;
  }
  gainXp(pkg.xp * (0.65 + score / 160) + (session.incidents === 0 ? 8 : 0));
  advanceTime(pkg.duration + session.extensionUnits * 60, { noNeedDecay: true });
  checkGoals();
  logJournal(
    state,
    `${grade} date with ${client.name}`,
    `${pkg.name} earned ${money(booking.netEarned)} net. Review: ${stars} stars. Screened risk was ${booking.screenedRisk}; safety incidents: ${session.incidents}.`,
    'booking',
  );
  if (becameRegular) {
    logJournal(
      state,
      'New regular client',
      `${client.name} asked to continue the professional relationship. Trust is now ${Math.round(client.trust)}.`,
      'client',
    );
  }
  const tone = grade === 'A+' || grade === 'A' ? 'good' : grade === 'D' ? 'danger' : 'warn';
  session.locked = false;
  openModal({
    eyebrow: 'DATE COMPLETE',
    title: `${escapeHtml(client.name)} · outcome`,
    subtitle: session.endedEarly
      ? 'The date ended early. Safety and boundary outcomes still influence the final evaluation.'
      : 'Performance combines connection, boundaries, composure, preparation, and risk management.',
    closeable: false,
    body: `
      <div class="result-hero"><div class="result-grade">${grade}</div><h3>${score}/100 overall</h3><p>${escapeHtml(review.text)}</p></div>
      <div class="grid four"><div class="card"><span class="eyebrow">NET EARNED</span><span class="big-number">${money(booking.netEarned)}</span><p>${money(tip)} tip · ${money(cut)} structure cut</p></div><div class="card"><span class="eyebrow">CONNECTION</span><span class="big-number">${Math.round(session.connection)}</span></div><div class="card"><span class="eyebrow">BOUNDARIES</span><span class="big-number">${Math.round(session.boundaries)}</span></div><div class="card"><span class="eyebrow">COMPOSURE</span><span class="big-number">${Math.round(session.composure)}</span></div></div>
      <div class="meta-row" style="justify-content:center;margin-top:12px"><span class="chip ${tone}">${stars} STAR REVIEW</span><span class="chip ${session.incidents ? 'danger' : 'good'}">${session.incidents} SAFETY INCIDENT${session.incidents === 1 ? '' : 'S'}</span>${becameRegular ? '<span class="chip good">NEW REGULAR</span>' : ''}${session.endedEarly ? '<span class="chip warn">ENDED EARLY</span>' : ''}</div>
    `,
    footer: '<button class="primary" data-action="close-date-result">Return to city</button>',
  });
  kit.input.rumble(grade === 'D' ? 0.6 : grade.startsWith('A') ? 0.35 : 0.2, grade === 'D' ? 220 : 120);
  audio.blip(grade === 'D' ? 'danger' : 'success');
  markTarget(nextBookingVenue());
  refreshUi();
}

function handleNoShow(booking, client) {
  booking.status = 'no-show';
  booking.netEarned = booking.depositAmount;
  client.reliability = clamp(client.reliability - 18);
  client.trust = clamp(client.trust - 12);
  client.status = client.status === 'regular' ? 'regular' : 'past';
  state.player.stress = clamp(state.player.stress + 5);
  advanceTime(30);
  const depositText =
    booking.depositAmount > 0
      ? `The ${money(booking.depositAmount)} deposit was retained.`
      : 'No payment was retained because no deposit was required.';
  logJournal(state, 'Client no-show', `${client.name} failed to arrive. ${depositText}`, 'booking');
  openModal({
    eyebrow: 'NO-SHOW',
    title: `${escapeHtml(client.name)} did not arrive`,
    subtitle: 'The arrival window passed without a verified message. The booking is closed.',
    body: `<div class="result-hero"><div class="result-grade">—</div><h3>${booking.depositAmount > 0 ? 'Deposit retained' : 'No payment retained'}</h3><p>No reputation penalty was applied. Client reliability and trust have fallen.</p></div><div class="grid three"><div class="card"><span class="eyebrow">RETAINED</span><span class="big-number">${money(booking.depositAmount)}</span></div><div class="card"><span class="eyebrow">TIME LOST</span><span class="big-number">30M</span></div><div class="card"><span class="eyebrow">RELIABILITY</span><span class="big-number">${Math.round(client.reliability)}</span></div></div>`,
    footer: '<button class="primary" data-action="close-modal">Return to city</button>',
    closeable: false,
  });
  refreshUi();
}

function confirmStructureSwitch(structureId) {
  const structure = STRUCTURES[structureId];
  if (structure && structure.id !== state.business.structure) {
    openModal({
      eyebrow: 'OPERATING MODEL',
      title: `Switch to ${structure.name}?`,
      subtitle: `${money(structure.switchCost)} setup cost · ${Math.round(structure.cut * 100)}% booking cut · ${money(structure.daily)} fixed daily structure cost`,
      body: `<div class="grid three"><div class="card"><span class="eyebrow">SAFETY BONUS</span><span class="big-number">+${structure.safety}</span></div><div class="card"><span class="eyebrow">LEAD POWER</span><span class="big-number">+${structure.leads}</span></div><div class="card"><span class="eyebrow">AUTONOMY</span><span class="big-number">${structure.autonomy}</span></div></div><div class="card" style="margin-top:12px"><h4>${structure.name}</h4><p>${structure.description}</p></div>`,
      footer: `<button class="secondary" data-action="close-modal">Cancel</button><button class="primary" data-action="confirm-structure" data-structure="${structure.id}" ${state.money < structure.switchCost ? 'disabled' : ''}>Confirm switch</button>`,
    });
  }
}

function confirmRegionMove(regionId) {
  const region = REGIONS[regionId];
  if (!region || region.id === state.regionId) {
    return;
  }
  const scheduled = state.bookings.filter((n) => n.status === 'scheduled');
  openModal({
    eyebrow: 'RELOCATION',
    title: `Move to ${region.name}?`,
    subtitle: `${money(region.moveCost)} relocation cost · reputation transfer ${Math.round(region.transfer * 100)}%`,
    wide: true,
    body: `<div class="grid four"><div class="card"><span class="eyebrow">DEMAND</span><span class="big-number">${Math.round(region.demand * 100)}</span></div><div class="card"><span class="eyebrow">COST INDEX</span><span class="big-number">${Math.round(region.costs * 100)}</span></div><div class="card"><span class="eyebrow">LEGAL PRESSURE</span><span class="big-number">${region.legalRisk}</span></div><div class="card"><span class="eyebrow">SAFETY CULTURE</span><span class="big-number">${region.safety}</span></div></div><div class="card" style="margin-top:12px"><h4>Consequences</h4><p>All open enquiries are lost. Scheduled bookings are cancelled and refunded. Reputation transfers at ${Math.round(region.transfer * 100)}%, the move consumes 12 hours, and the city is procedurally rebuilt with the new region’s atmosphere.</p>${scheduled.length ? `<div class="chip danger" style="margin-top:8px">${scheduled.length} ACTIVE BOOKING${scheduled.length === 1 ? '' : 'S'} WILL BE CANCELLED</div>` : ''}</div>`,
    footer: `<button class="secondary" data-action="close-modal">Stay in ${REGIONS[state.regionId].name}</button><button class="primary" data-action="confirm-region-move" data-region="${region.id}" ${state.money < region.moveCost ? 'disabled' : ''}>Relocate</button>`,
  });
}

function moveRegion(regionId) {
  const region = REGIONS[regionId];
  if (!region || !canAfford(region.moveCost)) {
    return;
  }
  state.bookings.forEach((b) => {
    if (b.status !== 'scheduled') {
      return;
    }
    b.status = 'cancelled';
    const refund = Math.round((b.depositAmount || 0) * 1.15);
    if (refund) {
      addTransaction(state, -refund, `Relocation cancellation: ${b.clientName}`, 'refund');
    }
  });
  const previous = REGIONS[state.regionId];
  addTransaction(state, -region.moveCost, `Relocation to ${region.name}`, 'travel');
  state.prospects = [];
  state.reputation = clamp(state.reputation * region.transfer);
  state.regionId = region.id;
  state.legalHeat = clamp(region.legalRisk * 0.24);
  state.exposure = clamp(state.exposure * 0.78);
  state.world.weather = region.weather;
  advanceTime(720);
  addLeads(state, 5);
  world.setRegion(region.id, state);
  world.teleport('station', 4);
  routeTarget = null;
  logJournal(
    state,
    'Region changed',
    `${state.name} relocated from ${previous.name} to ${region.name}. The client base and public profile must be rebuilt.`,
    'region',
  );
  closeModal();
  notify(
    'Relocation complete',
    `${region.name} now has different demand, costs, pressure, and safety conditions.`,
    'good',
  );
  openPanel('regions');
}

function confirmCancelBooking(bookingId) {
  const booking = findBooking(bookingId);
  if (!booking || booking.status !== 'scheduled') {
    return;
  }
  const hoursUntil = (absMinute(booking.day, booking.minute) - nowMinute()) / 60;
  const feeRate = hoursUntil >= 24 ? 0.08 : hoursUntil >= 6 ? 0.18 : 0.32;
  const cost = Math.round(booking.depositAmount + booking.quote * feeRate);
  openModal({
    eyebrow: 'CANCEL BOOKING',
    title: `Cancel ${escapeHtml(booking.clientName)}?`,
    subtitle: `Client-facing cancellation cost: ${money(cost)}. Reputation impact increases closer to the start time.`,
    body: `<div class="grid three"><div class="card"><span class="eyebrow">TIME REMAINING</span><span class="big-number">${Math.max(0, hoursUntil).toFixed(1)}H</span></div><div class="card"><span class="eyebrow">REFUND + FEE</span><span class="big-number">${money(cost)}</span></div><div class="card"><span class="eyebrow">REPUTATION HIT</span><span class="big-number">-${hoursUntil >= 24 ? 2 : hoursUntil >= 6 ? 4 : 7}</span></div></div>`,
    footer: `<button class="secondary" data-action="close-modal">Keep booking</button><button class="danger-button" data-action="confirm-cancel-booking" data-booking="${booking.id}" data-cost="${cost}" data-rep="${hoursUntil >= 24 ? 2 : hoursUntil >= 6 ? 4 : 7}">Cancel and refund</button>`,
  });
}

/** Record an achievement once. */
function achieve(name) {
  if (!state.achievements.includes(name)) {
    state.achievements.push(name);
  }
}

function unlockEnding(endingId) {
  const ending = {
    exit: {
      title: 'A funded exit',
      text: `${state.name} clears the remaining obligations, protects ${possessive()} private life, and leaves the career with enough capital to choose what comes next.`,
      effect: () => {
        achieve('Funded exit');
        state.storyFlags.endingSeen = true;
      },
    },
    agency: {
      title: 'The boutique agency',
      text: `${state.name} turns hard-earned screening, safety, and client knowledge into a small agency built around clear contracts and protected independence.`,
      effect: () => {
        achieve('Boutique agency founder');
        state.storyFlags.endingSeen = true;
        state.business.structure = 'agency';
      },
    },
    sustainable: {
      title: 'A sustainable independent career',
      text: `${state.name} establishes a selective, low-volume practice with regular clients, strong boundaries, and enough control to keep the work from consuming the rest of life.`,
      effect: () => {
        achieve('Sustainable independent');
        state.storyFlags.endingSeen = true;
      },
    },
  }[endingId];
  if (ending) {
    ending.effect();
    logJournal(state, ending.title, ending.text, 'ending');
    openModal({
      eyebrow: 'CAREER ENDING UNLOCKED',
      title: ending.title,
      subtitle: 'This ending is recorded, but the sandbox can continue from the same save.',
      body: `<div class="result-hero"><div class="result-grade">◆</div><h3>${ending.title}</h3><p>${escapeHtml(ending.text)}</p></div><div class="card"><h4>Career record</h4><div class="stat-row"><span>Days active</span><strong>${state.day}</strong></div><div class="stat-row"><span>Lifetime gross</span><strong>${money(state.business.grossLifetime)}</strong></div><div class="stat-row"><span>Completed dates</span><strong>${state.bookings.filter((n) => n.status === 'completed').length}</strong></div><div class="stat-row"><span>Safety index</span><strong>${safetyIndex()}</strong></div></div>`,
      footer: '<button class="primary" data-action="close-modal">Continue sandbox</button>',
      closeable: false,
    });
    saveCareer(state);
  }
}

/** Minutes until the next 09:00: later today after midnight, otherwise tomorrow. */
function minutesUntilMorning() {
  return state.minute < 540 ? 540 - state.minute : 1440 - state.minute + 540;
}

function sleepUntilMorning() {
  const minutes = minutesUntilMorning();
  advanceTime(minutes);
  state.player.energy = clamp(Math.max(state.player.energy, 93));
  state.player.stress = clamp(state.player.stress - 24);
  state.player.hygiene = clamp(Math.max(state.player.hygiene, 86));
  state.player.hunger = clamp(Math.max(state.player.hunger, 72));
  state.player.health = clamp(state.player.health + 3);
  state.health.burnout = clamp(state.health.burnout - 6);
  logJournal(state, 'A new morning', 'A full night at home restored energy and reduced stress.', 'wellness');
  closeModal();
  notify('Morning', `Day ${state.day} begins at 09:00.`, 'good');
  saveCareer(state);
  refreshUi();
}

function exportSave() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `city-after-dark-${state.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-day-${state.day}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  notify('Career exported', 'A JSON copy of the complete simulation state was created.', 'good');
}

/**
 * Load a save exported from this game. Replacing a career in progress asks
 * first, in the game's own dialog (so it works with a controller too).
 */
async function importSave(file) {
  if (!(file instanceof File)) {
    return;
  }
  try {
    const data = JSON.parse(await file.text());
    if (!data || data.version !== 1 || typeof data.name !== 'string' || !REGIONS[data.regionId]) {
      throw new Error('This is not a supported City After Dark save file.');
    }
    const career = normalizeCareer(data);
    if (state) {
      pendingImport = career;
      openModal({
        eyebrow: 'IMPORT SAVE',
        title: `Replace this career with ${escapeHtml(career.name)}?`,
        subtitle: `${escapeHtml(career.name)} · Day ${career.day} · ${REGIONS[career.regionId].name}. The current career will be overwritten unless you export it first.`,
        footer:
          '<button class="secondary" data-action="close-modal">Keep current career</button><button class="danger-button" data-action="import-confirm">Replace career</button>',
      });
      return;
    }
    saveCareer(career);
    startCareer(career);
    notify(
      'Career imported',
      `${career.name}'s Day ${career.day} career is now active on this device.`,
      'good',
    );
  } catch (err) {
    console.warn('Save import failed:', err);
    const message =
      err instanceof SyntaxError
        ? 'The selected file is not valid JSON.'
        : err?.message || 'The selected file could not be read.';
    if (state) {
      notify('Import failed', message, 'danger', 6000);
    } else {
      showTitleNotice(`Import failed: ${message}`);
    }
  }
}

/** A one-line message on the title screen (import errors, deleted career). */
function showTitleNotice(text) {
  const el = $('#title-notice');
  el.textContent = text;
  el.classList.remove('hidden');
}

/** Every [data-action] button and card in the interface lands here. */
function handleAction(action, data, button) {
  if (button?.disabled) {
    return;
  }
  audio.blip('soft');
  switch (action) {
    case 'open-panel':
      openPanel(data.tab || 'dashboard');
      break;
    case 'close-panel':
      closePanel();
      break;
    case 'close-modal':
      closeModal();
      break;
    case 'tutorial-finish':
      closeModal();
      openPanel('clients');
      break;
    case 'apply-settings': {
      state.settings.bloom = $('#setting-bloom').checked;
      state.settings.shadows = $('#setting-shadows').checked;
      state.settings.reducedMotion = $('#setting-motion').checked;
      world.applySettings(state.settings);
      hudCache.delete('rain');
      updateHud();
      saveCareer(state);
      closeModal();
      notify(
        'Settings applied',
        'Bloom, shadows and motion are updated. Quality lives under Display settings.',
        'good',
      );
      break;
    }
    case 'open-help':
      showHelp();
      break;
    case 'open-display-settings':
      kit.menu.open();
      break;
    case 'toggle-audio':
      toggleAudio();
      showPauseMenu();
      break;
    case 'quit-title':
      returnToTitle();
      break;
    case 'import-confirm': {
      const career = pendingImport;
      pendingImport = null;
      if (career) {
        saveCareer(career);
        startCareer(career);
        notify(
          'Career imported',
          `${career.name}'s Day ${career.day} career is now active on this device.`,
          'good',
        );
      }
      break;
    }
    case 'repay-debt': {
      const amount = data.amount === 'all' ? state.debt : Math.min(Number(data.amount) || 0, state.debt);
      if (amount <= 0 || !canAfford(amount)) {
        break;
      }
      const clearing = amount >= state.debt;
      addTransaction(state, -amount, clearing ? 'Debt cleared' : 'Debt repayment', 'debt');
      state.debt = Math.max(0, state.debt - amount);
      logJournal(
        state,
        clearing ? 'Debt cleared' : 'Debt repayment',
        clearing
          ? 'The starting debt is fully repaid.'
          : `${money(amount)} repaid; ${money(state.debt)} remains.`,
        'business',
      );
      notify(
        clearing ? 'Debt cleared' : 'Debt repayment',
        clearing ? 'A funded exit opens once you hold $50,000.' : `${money(state.debt)} remains.`,
        'good',
      );
      checkGoals();
      refreshUi();
      break;
    }
    case 'theatre-matinee':
      performActivity({
        title: 'Matinee at the Lyric',
        text: 'Two quiet hours with a good play eased stress and secrecy, and gave you something new to talk about.',
        cost: 45,
        minutes: 120,
        effects: { stress: -14, secrecy: -5, charisma: 1 },
        xp: 6,
        journalType: 'wellness',
      });
      break;
    case 'legal-consult':
      performActivity({
        title: 'Legal consultation',
        text: 'A confidential review of your setup lowered legal pressure.',
        cost: 150,
        minutes: 60,
        effects: { legalHeat: -12, stress: -4 },
        xp: 10,
        journalType: 'safety',
      });
      break;
    case 'legal-workshop':
      performActivity({
        title: 'Know-your-rights workshop',
        text: 'Practical knowledge and new peer contacts lowered legal heat a little.',
        minutes: 120,
        effects: { legalHeat: -4, peerSupport: 3, stress: -3 },
        xp: 14,
        journalType: 'safety',
      });
      break;
    case 'legal-privacy': {
      if (!canAfford(90)) {
        break;
      }
      state.business.privacy = clamp(state.business.privacy + 3);
      performActivity({
        title: 'Privacy clean-up',
        text: 'Takedown requests and metadata scrubbing reduced your public footprint.',
        cost: 90,
        minutes: 90,
        effects: { exposure: -7 },
        xp: 8,
        journalType: 'safety',
      });
      break;
    }
    case 'source-leads': {
      if (!canAfford(60)) {
        break;
      }
      addTransaction(state, -60, 'Marketplace lead sourcing', 'marketing');
      const added = addLeads(state, 3);
      state.exposure = clamp(state.exposure + 2);
      advanceTime(30);
      logJournal(state, 'Lead batch sourced', `${added} new marketplace enquiries were added.`, 'marketing');
      notify('Leads sourced', `${added} enquiries added to the pipeline.`, 'good');
      refreshUi();
      break;
    }
    case 'open-client':
      openScreening(data.client);
      break;
    case 'open-client-record':
      openClientRecord(data.client);
      break;
    case 'decline-client':
      openDecline(data.client);
      break;
    case 'decline-only': {
      const client = findClient(data.client);
      state.prospects = state.prospects.filter((c) => c.id !== data.client);
      if (client) {
        logJournal(
          state,
          'Enquiry declined',
          `${client.name} was declined without a permanent blacklist entry.`,
          'client',
        );
      }
      closeModal();
      notify('Enquiry declined', 'The lead was removed from the pipeline.', 'info');
      refreshUi();
      break;
    }
    case 'blacklist-lead':
    case 'blacklist-client-record': {
      const client = findClient(data.client);
      if (!client) {
        break;
      }
      const cancelled = state.bookings.filter((b) => b.clientId === client.id && b.status === 'scheduled');
      let refunded = 0;
      cancelled.forEach((b) => {
        b.status = 'cancelled';
        if (b.depositAmount > 0) {
          refunded += b.depositAmount;
          addTransaction(state, -b.depositAmount, `Safety cancellation refund: ${b.clientName}`, 'refund');
        }
      });
      state.prospects = state.prospects.filter((c) => c.id !== client.id);
      state.clients = state.clients.filter((c) => c.id !== client.id);
      if (!state.blacklist.some((c) => c.id === client.id)) {
        state.blacklist.push({ ...client, status: 'blacklisted' });
      }
      logJournal(
        state,
        'Client blacklisted',
        `${client.name} was added to the permanent safety record.${cancelled.length ? ` ${cancelled.length} future booking${cancelled.length === 1 ? '' : 's'} cancelled${refunded ? ` with ${money(refunded)} refunded` : ''}.` : ''}`,
        'safety',
      );
      closeModal();
      markTarget(nextBookingVenue());
      notify(
        'Client blacklisted',
        cancelled.length
          ? `${client.name} was blocked and ${cancelled.length} future booking${cancelled.length === 1 ? '' : 's'} cancelled.`
          : `${client.name} will not return through lead generation.`,
        'warn',
      );
      refreshUi();
      break;
    }
    case 'book-client':
      submitScreening(data.client);
      break;
    case 'accept-counter': {
      const client = findClient(pendingCounter?.clientId);
      if (client && pendingCounter) {
        confirmBooking(client, pendingCounter);
      }
      break;
    }
    case 'reject-counter': {
      const client = findClient(pendingCounter?.clientId);
      if (client) {
        client.trust = clamp(client.trust - 3);
      }
      logJournal(
        state,
        'Counteroffer rejected',
        `${client?.name || 'The client'} did not meet the minimum rate.`,
        'business',
      );
      pendingCounter = null;
      closeModal();
      notify('Walked away', 'The rate boundary was protected; no booking was created.', 'info');
      refreshUi();
      break;
    }
    case 'save-client-notes': {
      const client = findClient(data.client);
      if (client) {
        client.notes = $('#client-record-notes').value.trim();
      }
      notify('Notes saved', 'The client record was updated.', 'good');
      break;
    }
    case 'rebook-client':
      closeModal();
      openScreening(data.client);
      break;
    case 'open-booking':
      openBooking(data.booking);
      break;
    case 'booking-route': {
      const booking = findBooking(data.booking);
      if (!booking) {
        break;
      }
      booking.prep.route = true;
      setRoute(booking.venueId);
      break;
    }
    case 'route-location':
      setRoute(data.location);
      break;
    case 'booking-confirm': {
      const booking = findBooking(data.booking);
      if (!booking || booking.prep.confirmed) {
        break;
      }
      booking.prep.confirmed = true;
      booking.screenedRisk = clamp(booking.screenedRisk - 2, 2, 96);
      const client = bookingClient(booking);
      client.trust = clamp(client.trust + 2);
      advanceTime(10);
      notify('Confirmation sent', 'Venue, time, payment, and scope were reconfirmed.', 'good');
      openBooking(booking.id);
      break;
    }
    case 'booking-outfit': {
      const booking = findBooking(data.booking);
      if (!booking || booking.prep.outfit) {
        break;
      }
      if (distanceTo('home') > 6) {
        setRoute('home');
        break;
      }
      if (!canAfford(45)) {
        break;
      }
      addTransaction(state, -45, `Wardrobe preparation: ${booking.clientName}`, 'presentation');
      booking.prep.outfit = true;
      state.player.hygiene = clamp(state.player.hygiene + 4);
      advanceTime(45);
      notify('Wardrobe prepared', 'Presentation quality will be higher during the date.', 'good');
      openBooking(booking.id);
      break;
    }
    case 'booking-driver': {
      const booking = findBooking(data.booking);
      if (!booking || booking.prep.driver || !canAfford(45)) {
        break;
      }
      addTransaction(state, -45, `Driver for ${booking.clientName}`, 'safety');
      booking.prep.driver = true;
      booking.screenedRisk = clamp(booking.screenedRisk - 8, 2, 96);
      notify('Driver booked', 'Lateness, travel stress, and arrival exposure are reduced.', 'good');
      openBooking(booking.id);
      break;
    }
    case 'cancel-booking':
      confirmCancelBooking(data.booking);
      break;
    case 'confirm-cancel-booking': {
      const booking = findBooking(data.booking);
      if (!booking) {
        break;
      }
      addTransaction(state, -Number(data.cost), `Cancellation: ${booking.clientName}`, 'refund');
      state.reputation = clamp(state.reputation - Number(data.rep));
      booking.status = 'cancelled';
      const client = bookingClient(booking);
      client.trust = clamp(client.trust - 14);
      logJournal(
        state,
        'Booking cancelled',
        `${booking.clientName} was refunded and compensated.`,
        'booking',
      );
      closeModal();
      notify('Booking cancelled', `${money(Number(data.cost))} was paid in refunds and fees.`, 'warn');
      refreshUi();
      break;
    }
    case 'start-date':
      startDate(data.booking);
      break;
    case 'switch-structure':
      confirmStructureSwitch(data.structure);
      break;
    case 'confirm-structure': {
      const structure = STRUCTURES[data.structure];
      if (!structure || !canAfford(structure.switchCost)) {
        break;
      }
      if (structure.switchCost) {
        addTransaction(state, -structure.switchCost, `Switch to ${structure.name}`, 'business');
      }
      state.business.structure = structure.id;
      if (structure.id === 'agency') {
        state.storyFlags.agencyUnlocked = true;
      }
      state.exposure = clamp(state.exposure + (structure.id === 'agency' ? 3 : -1));
      logJournal(
        state,
        'Operating model changed',
        `${state.name} now works as ${structure.name.toLowerCase()}.`,
        'business',
      );
      closeModal();
      notify('Structure changed', `${structure.name} is now active.`, 'good');
      openPanel('business');
      break;
    }
    case 'toggle-staff': {
      const role = STAFF[data.staff];
      if (!role) {
        break;
      }
      const hired = state.business.staff[role.id];
      if (!hired && !canAfford(role.hireCost)) {
        break;
      }
      if (hired) {
        state.business.staff[role.id] = false;
        notify('Contract ended', `${role.name} will no longer charge daily.`, 'info');
      } else {
        addTransaction(state, -role.hireCost, `Hire ${role.name}`, 'staff');
        state.business.staff[role.id] = true;
        notify('Staff hired', `${role.name} adds new operational support.`, 'good');
      }
      logJournal(
        state,
        hired ? 'Staff released' : 'Staff hired',
        `${role.name} ${hired ? 'left' : 'joined'} the operation.`,
        'business',
      );
      refreshUi();
      break;
    }
    case 'upgrade-housing': {
      const level = Number(data.level);
      const cost = level * 550;
      if (!canAfford(cost)) {
        break;
      }
      addTransaction(state, -cost, `Move to housing level ${level}`, 'housing');
      state.business.housing = level;
      state.business.privacy = [0, 45, 68, 88][level];
      state.personal.secrecy = clamp(state.personal.secrecy - level * 3);
      logJournal(
        state,
        'Housing changed',
        `Housing level ${level} improved privacy and recovery conditions.`,
        'personal',
      );
      notify('Housing changed', `Privacy is now ${state.business.privacy}.`, 'good');
      refreshUi();
      break;
    }
    case 'set-brand': {
      state.business.brand = data.brand;
      state.marketing.niche = data.brand;
      if (data.brand === 'discreet') {
        state.exposure = clamp(state.exposure - 2);
      }
      if (data.brand === 'luxury') {
        state.marketing.quality = clamp(state.marketing.quality + 1);
      }
      logJournal(state, 'Brand repositioned', `The profile now emphasizes ${data.brand}.`, 'marketing');
      notify('Positioning updated', `${data.brand} is now the active niche.`, 'good');
      refreshUi();
      break;
    }
    case 'run-campaign': {
      const campaign = CAMPAIGNS[data.campaign];
      if (!campaign || !campaign.requirement(state) || !canAfford(campaign.cost)) {
        break;
      }
      addTransaction(state, -campaign.cost, campaign.name, 'marketing');
      const running = state.marketing.active.find((entry) => entry.id === campaign.id);
      if (running) {
        running.remaining = campaign.duration;
      } else {
        state.marketing.active.push({ id: campaign.id, remaining: campaign.duration });
      }
      state.marketing.reach = clamp(state.marketing.reach + campaign.leads * 2);
      state.marketing.quality = clamp(state.marketing.quality + campaign.reputation);
      state.reputation = clamp(state.reputation + campaign.reputation * 0.5);
      state.exposure = clamp(state.exposure + campaign.exposure);
      const added = addLeads(state, Math.max(1, Math.round(campaign.leads / 2)));
      gainXp(12 + campaign.reputation * 2);
      logJournal(
        state,
        'Campaign launched',
        `${campaign.name} generated ${added} immediate leads and will run for ${campaign.duration} days.`,
        'marketing',
      );
      notify('Campaign active', `${campaign.name} generated ${added} immediate enquiries.`, 'good');
      refreshUi();
      break;
    }
    case 'order-food':
      performActivity({
        title: 'Food delivered',
        text: 'A full meal restored hunger and some energy.',
        cost: 38,
        minutes: 20,
        effects: { hunger: 48, energy: 8 },
        journalType: 'wellness',
      });
      break;
    case 'personal-time':
      performActivity({
        title: 'Protected personal time',
        text: `Three hours with ${state.personal.partnerName} improved connection and reduced secrecy pressure.`,
        cost: 70,
        minutes: 180,
        effects: { relationship: 9, trust: 4, secrecy: -7, stress: -8 },
        xp: 4,
        journalType: 'personal',
      });
      break;
    case 'honest-conversation': {
      const success = chance(
        0.48 + state.player.charisma / 300 + state.skills.conversation * 0.05 - state.personal.secrecy / 280,
      );
      performActivity(
        success
          ? {
              title: 'Honest conversation',
              text: `${state.personal.partnerName} did not find the conversation easy, but trust increased and secrecy fell.`,
              minutes: 120,
              effects: { trust: 10, relationship: 4, secrecy: -16, stress: -8 },
              xp: 12,
              journalType: 'personal',
            }
          : {
              title: 'Difficult conversation',
              text: `The disclosure created conflict with ${state.personal.partnerName}. Secrecy fell, but relationship stability and stress worsened.`,
              minutes: 120,
              effects: { trust: -4, relationship: -9, secrecy: -10, stress: 12 },
              xp: 8,
              journalType: 'personal',
            },
      );
      break;
    }
    case 'peer-call':
      performActivity({
        title: 'Peer support call',
        text: 'A trusted peer helped process the week and reinforced practical boundaries.',
        minutes: 45,
        effects: { peerSupport: 4, stress: -9, burnout: -3 },
        xp: 4,
        journalType: 'personal',
      });
      break;
    case 'move-region':
      confirmRegionMove(data.region);
      break;
    case 'confirm-region-move':
      moveRegion(data.region);
      break;
    case 'upgrade-skill': {
      const skill = data.skill;
      const rank = state.skills[skill];
      const cost = rank + 1;
      if (rank >= 5 || state.skillPoints < cost) {
        break;
      }
      state.skillPoints -= cost;
      state.skills[skill] += 1;
      logJournal(
        state,
        'Skill upgraded',
        `${SKILLS[skill].name} reached rank ${state.skills[skill]}.`,
        'career',
      );
      notify('Skill upgraded', `${SKILLS[skill].name} is now rank ${state.skills[skill]}.`, 'good');
      refreshUi();
      break;
    }
    case 'career-ending':
      unlockEnding(data.ending);
      break;
    case 'manual-save':
      if (saveCareer(state)) {
        notify('Saved', `Career saved on Day ${state.day} at ${clock(state.minute)}.`, 'good');
      } else {
        notify(
          'Save failed',
          'This browser blocked local storage. Use Export JSON to keep a copy.',
          'danger',
          6000,
        );
      }
      break;
    case 'export-save':
      exportSave();
      break;
    case 'import-save':
      saveImportInput?.click();
      break;
    case 'toggle-autosave':
      state.settings.autosave = !state.settings.autosave;
      if (state.settings.autosave) {
        saveCareer(state);
      }
      refreshUi();
      break;
    case 'reset-save': {
      openModal({
        eyebrow: 'RESET CAREER',
        title: 'Delete the local save?',
        subtitle: 'This permanently removes the current browser save. Export first if you want a backup.',
        body: '<div class="card"><h4>This cannot be undone in the game.</h4><p>The current city, clients, bookings, finances, journal, skills, and endings will be deleted.</p></div>',
        footer:
          '<button class="secondary" data-action="close-modal">Cancel</button><button class="danger-button" data-action="confirm-reset">Delete career</button>',
      });
      break;
    }
    case 'confirm-reset':
      // Leave for the title screen without the unload autosave writing it back.
      clearSave();
      returnToTitle({ keepSave: false });
      showTitleNotice('Career deleted. Start a new career when you are ready.');
      break;
    case 'daily-event-choice': {
      const event = pendingEvent;
      const choice = event?.choices?.[Number(data.choice)];
      if (!choice) {
        break;
      }
      // Close first: an effect may pass time and raise the next event itself.
      pendingEvent = null;
      modalRoot.innerHTML = '';
      modalOpen = false;
      nav.clear();
      kit.input.settle();
      choice.effect();
      logJournal(state, event.title, choice.result, 'event');
      notify(event.title, choice.result, 'info', 5500);
      refreshUi();
      break;
    }
    case 'home-shower':
      performActivity({
        title: 'Shower and presentation reset',
        text: 'Hygiene and presentation recovered before the next commitment.',
        minutes: 30,
        effects: { hygiene: 45, presentation: 2, stress: -3 },
        journalType: 'wellness',
      });
      break;
    case 'home-rest':
      performActivity({
        title: 'Rested at home',
        text: 'A short nap restored energy and lowered immediate stress.',
        minutes: 90,
        effects: { energy: 32, stress: -12, burnout: -2 },
        journalType: 'wellness',
      });
      break;
    case 'home-eat':
      performActivity({
        title: 'Meal at home',
        text: 'A quiet meal restored hunger and energy.',
        cost: 14,
        minutes: 30,
        effects: { hunger: 58, energy: 8 },
        journalType: 'wellness',
      });
      break;
    case 'home-prepare-next': {
      const next = upcomingBookings()[0];
      if (!next || next.prep.outfit || !canAfford(45)) {
        break;
      }
      addTransaction(state, -45, `Wardrobe preparation: ${next.clientName}`, 'presentation');
      next.prep.outfit = true;
      state.player.hygiene = clamp(state.player.hygiene + 5);
      advanceTime(45);
      closeModal();
      notify('Wardrobe prepared', `${next.clientName}'s booking now has a presentation bonus.`, 'good');
      break;
    }
    case 'home-offline':
      performActivity({
        title: 'Went offline',
        text: 'Three work-free hours reduced stress, secrecy, and burnout.',
        minutes: 180,
        effects: { stress: -18, secrecy: -8, burnout: -7, energy: 8 },
        journalType: 'personal',
      });
      break;
    case 'home-end-day': {
      // Every booking whose 90-minute grace ends before you wake up will be missed.
      const now = nowMinute();
      const wake = now + minutesUntilMorning();
      const later = state.bookings.filter((b) => {
        const graceEnds = absMinute(b.day, b.minute) + 90;
        return b.status === 'scheduled' && graceEnds > now && graceEnds < wake;
      });
      if (later.length) {
        openModal({
          eyebrow: 'END DAY',
          title: `Miss ${later.length} later booking${later.length === 1 ? '' : 's'}?`,
          subtitle:
            'Sleeping until morning will allow each unattended booking to pass its cancellation window.',
          body: `<div class="list">${later.map((b) => `<div class="card client-card"><div class="avatar">${clock(b.minute)}</div><div class="client-main"><h4>${escapeHtml(b.clientName)}</h4><p>${PACKAGES[b.packageId].short} · ${LOCATIONS[b.venueId].name}</p></div><div class="client-value"><strong>${money(b.quote)}</strong><small>will be missed</small></div></div>`).join('')}</div>`,
          footer:
            '<button class="secondary" data-action="close-modal">Stay awake</button><button class="danger-button" data-action="confirm-end-day">Sleep anyway</button>',
        });
      } else {
        sleepUntilMorning();
      }
      break;
    }
    case 'confirm-end-day':
      sleepUntilMorning();
      break;
    case 'clinic-check': {
      if (!canAfford(120)) {
        break;
      }
      state.health.lastCheckDay = state.day;
      state.health.checkStatus = 'Current';
      performActivity({
        title: 'Routine health check',
        text: 'The confidential check is current and physical health improved.',
        cost: 120,
        minutes: 90,
        effects: { health: 10, stress: -5 },
        xp: 10,
        journalType: 'health',
      });
      break;
    }
    case 'clinic-therapy':
      performActivity({
        title: 'Therapy and decompression',
        text: 'Professional support reduced stress and burnout pressure.',
        cost: 95,
        minutes: 60,
        effects: { stress: -24, burnout: -10, resilience: 1 },
        xp: 8,
        journalType: 'health',
      });
      break;
    case 'clinic-treatment': {
      const cost = 80 + state.health.injury * 4;
      if (!canAfford(cost)) {
        break;
      }
      const injury = state.health.injury;
      state.health.injury = 0;
      performActivity({
        title: 'Injury treated',
        text: 'Physical injury penalties were cleared through confidential treatment.',
        cost,
        minutes: 120,
        effects: { health: Math.max(8, injury) },
        xp: 6,
        journalType: 'health',
      });
      break;
    }
    case 'gym-train': {
      if (!canAfford(20)) {
        break;
      }
      state.player.stamina = clamp(state.player.stamina + 1.5);
      state.player.presentation = clamp(state.player.presentation + 1);
      performActivity({
        title: 'Structured training',
        text: 'Stamina and presentation improved through focused training.',
        cost: 20,
        minutes: 90,
        effects: { energy: -12, stress: -8 },
        xp: 10,
        journalType: 'wellness',
      });
      break;
    }
    case 'gym-recover':
      performActivity({
        title: 'Physical recovery session',
        text: 'Low-intensity recovery restored energy and reduced strain.',
        cost: 60,
        minutes: 60,
        effects: { energy: 24, stress: -8, health: 3 },
        xp: 4,
        journalType: 'wellness',
      });
      break;
    case 'gym-class': {
      // The stat only improves if the workshop is actually paid for.
      if (!canAfford(85)) {
        break;
      }
      state.player.charisma = clamp(state.player.charisma + 1.5);
      performActivity({
        title: 'Confidence workshop',
        text: 'Practice improved social confidence and professional composure.',
        cost: 85,
        minutes: 120,
        effects: { stress: -5 },
        xp: 18,
        journalType: 'career',
      });
      break;
    }
    case 'studio-editorial':
      // The new interest only arrives with a paid shoot (it used to arrive either way).
      if (!canAfford(350)) {
        break;
      }
      addLeads(state, 2);
      performActivity({
        title: 'Editorial profile set',
        text: 'Premium images strengthened brand quality and generated new interest.',
        cost: 350,
        minutes: 180,
        effects: { marketingQuality: 10, marketingReach: 5, reputation: 2, exposure: 5 },
        xp: 22,
        journalType: 'marketing',
      });
      break;
    case 'studio-discreet':
      performActivity({
        title: 'Discreet profile refresh',
        text: 'The profile improved while metadata and public exposure were reduced.',
        cost: 190,
        minutes: 120,
        effects: { marketingQuality: 6, exposure: -4 },
        xp: 14,
        journalType: 'marketing',
      });
      break;
    case 'studio-copy':
      if (!canAfford(120)) {
        break;
      }
      state.business.platformTrust = clamp(state.business.platformTrust + 9);
      performActivity({
        title: 'Profile copy rewritten',
        text: 'Clearer positioning improved platform trust and conversion.',
        cost: 120,
        minutes: 90,
        effects: { marketingQuality: 4, marketingReach: 2 },
        xp: 14,
        journalType: 'marketing',
      });
      break;
    case 'safehub-audit': {
      if (!canAfford(40)) {
        break;
      }
      const riskiest = [...state.prospects].sort((r, a) => a.risk - r.risk)[0];
      let finding = 'No hidden issue was found in the current lead list.';
      if (riskiest?.hiddenFlag) {
        riskiest.flags.push(riskiest.hiddenFlag);
        riskiest.hiddenFlag = null;
        riskiest.risk = clamp(riskiest.risk + 12);
        finding = `The network identified a hidden concern in ${riskiest.name}'s record.`;
      }
      performActivity({
        title: 'Peer safety audit',
        text: finding,
        cost: 40,
        minutes: 60,
        effects: { peerSupport: 3 },
        xp: 12,
        journalType: 'safety',
      });
      break;
    }
    case 'safehub-membership': {
      if (!canAfford(120)) {
        break;
      }
      state.protocols.safeCall = true;
      state.protocols.codeWord = true;
      performActivity({
        title: 'Safe-call membership',
        text: 'Safe-call and duress-code defaults are now active.',
        cost: 120,
        minutes: 45,
        effects: { peerSupport: 8 },
        xp: 14,
        journalType: 'safety',
      });
      break;
    }
    case 'safehub-referral': {
      if (!canAfford(75)) {
        break;
      }
      const count = randInt(1, 2);
      for (let k = 0; k < count; k += 1) {
        const lead = createLead(state);
        lead.risk = clamp(lead.risk - 14);
        lead.positives.push('Trusted Lantern referral');
        state.prospects.push(lead);
      }
      performActivity({
        title: 'Trusted referrals exchanged',
        text: `${count} lower-risk referral${count === 1 ? '' : 's'} entered the pipeline.`,
        cost: 75,
        minutes: 90,
        effects: { peerSupport: 4 },
        xp: 12,
        journalType: 'safety',
      });
      break;
    }
    case 'safehub-support':
      performActivity({
        title: 'Peer support circle',
        text: 'Shared experience reduced stress, burnout, and isolation.',
        cost: 25,
        minutes: 90,
        effects: { peerSupport: 6, stress: -16, burnout: -7 },
        xp: 6,
        journalType: 'personal',
      });
      break;
    case 'park-walk':
      performActivity({
        title: 'Private park walk',
        text: 'A quiet walk reduced stress and secrecy pressure.',
        minutes: 45,
        effects: { stress: -11, secrecy: -4, energy: -4 },
        journalType: 'wellness',
      });
      break;
    case 'park-long':
      performActivity({
        title: 'Offline afternoon',
        text: 'Several quiet hours restored perspective and reduced burnout.',
        minutes: 180,
        effects: { stress: -22, secrecy: -8, burnout: -9, energy: -6 },
        journalType: 'wellness',
      });
      break;
    case 'venue-network': {
      if (!canAfford(60)) {
        break;
      }
      if (state.prospects.length >= 14) {
        notify('Pipeline full', 'Answer or decline some enquiries before networking for more.', 'warn');
        break;
      }
      const packageFor = {
        cafe: 'coffee',
        restaurant: 'dinner',
        hotel: 'private',
        gala: 'event',
        theatre: 'theatre',
      };
      const lead = createLead(state, {
        packageId: packageFor[data.location] || 'dinner',
        desiredPackage: packageFor[data.location] || 'dinner',
      });
      lead.positives.push(`Met through ${LOCATIONS[data.location].name}`);
      state.prospects.push(lead);
      performActivity({
        title: 'Discreet venue networking',
        text: `${lead.name} entered the pipeline after a local introduction.`,
        cost: 60,
        minutes: 90,
        effects: { exposure: 3, reputation: 1 },
        xp: 10,
        journalType: 'marketing',
      });
      break;
    }
    case 'venue-scout': {
      const scheduled = state.bookings.filter((b) => b.status === 'scheduled' && b.venueId === data.location);
      scheduled.forEach((b) => {
        b.prep.route = true;
        b.screenedRisk = clamp(b.screenedRisk - 2, 2, 96);
      });
      performActivity({
        title: 'Venue route scouted',
        text: `${scheduled.length} future booking${scheduled.length === 1 ? '' : 's'} at ${LOCATIONS[data.location].name} gained better route preparation.`,
        minutes: 30,
        effects: { stress: -2 },
        xp: 5,
        journalType: 'safety',
      });
      break;
    }
    case 'date-choice':
      chooseDateOption(Number(data.choice));
      break;
    case 'close-date-result': {
      if (dateSession) {
        dateSession.locked = false;
      }
      closeModal();
      refreshUi();
      break;
    }
    default:
      break;
  }
}

/* ------------------------------------------------------------------ wiring */

/** Ambient sound on or off (top-bar ♪ button and the pause menu). */
function toggleAudio() {
  if (!state) {
    return;
  }
  state.settings.audio = !state.settings.audio;
  if (state.settings.audio) {
    audio.start().catch(() => {
      state.settings.audio = false;
      hud.audioButton.classList.remove('active');
      notify('Audio unavailable', 'This browser cannot play the ambient soundscape.', 'warn');
    });
    audio.setRain(state.world.weather === 'rain');
  } else {
    audio.stop();
  }
  hud.audioButton.classList.toggle('active', state.settings.audio);
  saveCareer(state);
}

function beginNewCareer() {
  if (loadCareer() && !newCareerArmed) {
    // A second press confirms: the saved career will be replaced.
    newCareerArmed = true;
    $('#new-game-button').textContent = 'Overwrite saved career';
    $('#overwrite-warning').classList.remove('hidden');
    return;
  }
  const name = $('#start-name').value.trim() || 'Alex Parker';
  const pronouns = $('#start-pronouns').value;
  const regionId = $('#start-region').value;
  const backgroundId = $('#start-background').value;
  startCareer(createCareer({ name, pronouns, regionId, backgroundId }));
}

function wireDom() {
  populateStartScreen();
  $('#import-save-button').addEventListener('click', () => saveImportInput?.click());
  $('#new-game-button').addEventListener('click', beginNewCareer);
  $('#continue-button').addEventListener('click', () => {
    const save = loadCareer();
    if (save) {
      startCareer(save);
    }
  });
  // Changing the form after the overwrite warning resets the confirmation.
  for (const id of ['#start-name', '#start-pronouns', '#start-region', '#start-background']) {
    $(id).addEventListener('input', () => newCareerArmed && disarmNewCareer());
  }
  $('#brand-button').addEventListener('click', () => {
    if (state) {
      openPanel('dashboard');
    }
  });
  $('#help-button').addEventListener('click', () => {
    if (state) {
      showHelp();
    }
  });
  $('#menu-button').addEventListener('click', () => {
    if (state && !modalOpen) {
      if (activePanel) closePanel();
      showPauseMenu();
    }
  });
  $('#settings-button').addEventListener('click', () => kit.menu.open());
  $('#audio-button').addEventListener('click', toggleAudio);
  // The prompt itself can be clicked or tapped, as well as E / A / the Enter button.
  hud.interactionPrompt.addEventListener('click', () => {
    if (state && !menuState()) {
      interact();
    }
  });
  const compactTime = matchMedia('(max-width: 480px)');
  $$('.time-controls button').forEach((button) => {
    button.addEventListener('click', () => {
      if (!state) {
        return;
      }
      // Narrow phones show one time button that cycles through the speeds.
      if (compactTime.matches) {
        cycleSpeed();
        return;
      }
      state.speed = Number(button.dataset.speed);
      syncSpeedButtons();
    });
  });
  panelScrim.addEventListener('click', closePanel);

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const backdrop = target.closest('[data-modal-backdrop]');
    if (
      target === backdrop &&
      backdrop instanceof HTMLElement &&
      backdrop.dataset.modalBackdrop === 'close'
    ) {
      closeModal();
      return;
    }
    // Buttons and the clickable cards (client leads, bookings, brands, homes)
    // all carry data-action. The old handler only accepted <button>s, so the
    // lead cards in the Clients tab could never be opened.
    const control = target.closest('[data-action]');
    if (control instanceof HTMLElement && state && !control.matches('[disabled], [aria-disabled="true"]')) {
      handleAction(control.dataset.action, control.dataset, control);
    }
  });

  // Enter / Space on a focused card acts like a click (buttons do this natively).
  document.addEventListener('keydown', (event) => {
    const el = event.target;
    if (
      (event.code === 'Enter' || event.code === 'NumpadEnter' || event.code === 'Space') &&
      el instanceof HTMLElement &&
      el.matches('[role="button"][data-action]')
    ) {
      event.preventDefault();
      el.click();
    }
  });

  document.addEventListener('input', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !state) {
      return;
    }
    if (input.matches('[data-price]')) {
      const packageId = input.dataset.price;
      if (!packageId) {
        return;
      }
      state.business.prices[packageId] = Number(input.value);
      const label = $(`#price-value-${packageId}`);
      if (label) {
        label.textContent = money(input.value);
      }
      checkGoals();
    }
    if (input.matches('[data-screen-check], [data-screen-quote]')) {
      updateScreeningPreview();
    }
  });

  document.addEventListener('change', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    if (input === saveImportInput) {
      const [file] = input.files || [];
      importSave(file);
      input.value = '';
      return;
    }
    if (state && input.matches('[data-protocol]')) {
      const key = input.dataset.protocol;
      if (!key) {
        return;
      }
      state.protocols[key] = input.checked;
      notify(
        'Protocol updated',
        `${input.closest('.switch-row')?.querySelector('strong')?.textContent || 'Safety setting'} is now ${input.checked ? 'active' : 'inactive'}.`,
        input.checked ? 'good' : 'warn',
      );
      refreshUi();
    }
  });

  // Save when the tab is hidden or closed (mobile browsers rarely fire beforeunload).
  const saveNow = () => {
    if (state?.settings.autosave) {
      saveCareer(state);
    }
  };
  window.addEventListener('pagehide', saveNow);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) saveNow();
    audio.suspend(document.hidden);
  });
}

/**
 * Start the game on a booted kit and a built city.
 * @param {object} kitRef  from boot()
 * @param {import('./world.js').City} cityRef
 */
export function initGame(kitRef, cityRef) {
  kit = kitRef;
  world = cityRef;
  nav = createNav(kit);
  world.onNearbyChange = onNearbyChange;
  wireDom();
  kit.touch?.setShown('interact', false);
  kit.onPause((paused) => audio.suspend(paused));
  kit.input.onSourceChange(() => {
    if (!state) {
      updateTitleControls();
      return;
    }
    syncPromptKey();
    if (!world.getNearbyLocation()) {
      hud.nearbyDescription.textContent = roamHint();
    }
  });
  updateTitleControls();
  kit.start(tick);
}

/** The controls strip under the title card follows the input device. */
function updateTitleControls() {
  const source = kit.input.source;
  const strip = $('.start-controls');
  strip.innerHTML =
    source === 'gamepad'
      ? '<span><kbd>L</kbd> move</span><span><kbd>B</kbd> run</span><span><kbd>A</kbd> interact</span><span><kbd>Y</kbd> management</span><span><kbd>START</kbd> menu</span>'
      : source === 'touch'
        ? '<span>Left thumb: walk</span><span>Right side: look</span><span>Enter button: interact</span><span>CAD: management</span>'
        : '<span><kbd>WASD</kbd> move</span><span><kbd>SHIFT</kbd> run</span><span><kbd>E</kbd> interact</span><span><kbd>TAB</kbd> management</span><span><kbd>ESC</kbd> menu</span>';
}
