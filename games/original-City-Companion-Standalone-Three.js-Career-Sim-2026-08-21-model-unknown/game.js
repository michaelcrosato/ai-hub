// The career simulation: time, money, wellbeing, leads, bookings, the date
// encounter flow, locations, milestones and saving. It drives the world and
// the UI, and reads every control through kit.input actions.

import {
  SAVE_KEY,
  RECORDS_KEY,
  SAVE_VERSION,
  SAVINGS_GOAL,
  MINUTES_PER_SECOND,
  SKILL_CAP,
  COLLECTIVE_DUES,
  REGIONS,
  MODELS,
  BRANDS,
  SKILLS,
  LOCATIONS,
  CLIENT_NAMES,
  ARCHETYPES,
  POSITIVE_FLAGS,
  WARNING_FLAGS,
  SERIOUS_FLAGS,
  SCENARIOS,
  CAMPAIGNS,
  DIFFICULTIES,
  ACHIEVEMENTS,
} from './data.js';
import {
  clamp,
  pick,
  randInt,
  chance,
  shuffled,
  uid,
  money,
  clockLabel,
  absMinute,
  dayTime,
  escapeHtml as esc,
  xpForLevel,
  riskLabel,
  relativeTime,
  hoursLabel,
  storageGet,
  storageSet,
  storageRemove,
} from './util.js';
import { CityWorld } from './world.js';
import { UI } from './ui.js';
import { MenuNav } from './nav.js';

const ZERO = Object.freeze({ x: 0, y: 0 });
const SPEEDS = [0, 1, 2, 4];

function loadRecords() {
  const empty = { careers: 0, bestGoal: null, mostDates: 0, unlocked: [] };
  try {
    const raw = JSON.parse(storageGet(RECORDS_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return empty;
    return {
      careers: Number(raw.careers) || 0,
      bestGoal: raw.bestGoal && Number.isFinite(raw.bestGoal.days) ? raw.bestGoal : null,
      mostDates: Number(raw.mostDates) || 0,
      unlocked: Array.isArray(raw.unlocked) ? raw.unlocked : [],
    };
  } catch {
    return empty;
  }
}

export class Game {
  constructor(kit, sound) {
    this.kit = kit;
    this.input = kit.input;
    this.sound = sound;
    this.ui = new UI(sound);
    this.nav = new MenuNav(kit.input);
    // Menu layers, top first; each one's element takes gamepad/arrow navigation.
    this.layers = {
      pause: { kind: 'pause', root: this.ui.el.pauseCard, key: 'pause' },
      modal: { kind: 'modal', root: this.ui.el.modalCard, key: 0 },
      start: { kind: 'start', root: this.ui.el.startCard, key: 'start' },
      phone: { kind: 'phone', root: this.ui.el.phonePanel, key: 'phone' },
    };
    this.narrowQuery = matchMedia('(max-width: 700px)');
    this.records = loadRecords();
    this.state = null;
    this.started = false;
    this.hudTimer = 0;
    this.objectiveTimer = 0;
    this.phoneTimer = 0;
    this.autosaveTimer = 0;
    this.bookingTimer = 0;
    this.touchInteractShown = null;
    this.currentObjectiveLocation = null;
    this.nearLocation = null;
    this.resetSession();

    this.world = new CityWorld(kit, {
      onLocationArrival: (id) => this.handleLocationArrival(id),
      onProximityChange: (id) => {
        this.nearLocation = id;
        this.ui.showInteraction(id);
        this.updateTouchControls();
      },
      onPathBlocked: () => this.ui.toast('Route unavailable', 'Choose another nearby point or approach the entrance from a different side.', 'warning'),
      onMoveCommand: () => {
        this.noteMovement();
        this.sound.play('step');
      },
      onDistanceMoved: (d) => this.handleDistanceMoved(d),
    });

    this.ui.setGame(this);
    this.ui.renderPhone();
    this.ui.setInputSource(this.input.source);
    this.ui.renderStartRecords(this.records);
    this.input.onSourceChange((src) => this.ui.setInputSource(src));
    kit.onPause((paused) => this.sound.setPaused(paused));
    // Never lose progress to a closed tab.
    addEventListener('pagehide', () => this.save(false));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.save(false);
    });
    this.onLayerChange();
  }

  /** Per-session state that is not saved. */
  resetSession() {
    this.activeEncounter = null;
    this.manualObjectiveLocation = null;
    this.manualObjectiveDetail = '';
    this.manualObjectiveBookingId = null;
    this.pendingTraining = null;
    this.firstMovementNoted = false;
    this.burnoutActive = false;
  }

  /* ------------------------------------------------------------ state */

  createInitialState(opts) {
    const region = REGIONS[opts.region] ? opts.region : 'sunharbor';
    const model = MODELS[opts.model] ? opts.model : 'independent';
    const difficulty = DIFFICULTIES[opts.difficulty] ? opts.difficulty : 'standard';
    const skills = Object.fromEntries(Object.keys(SKILLS).map((k) => [k, { level: 1, xp: 0 }]));
    if (opts.trait === 'connector') skills.presence.level = 3;
    if (opts.trait === 'analyst') skills.insight.level = 3;
    if (opts.trait === 'operator') {
      skills.negotiation.level = 2;
      skills.branding.level = 2;
    }
    const cash = (model === 'independent' ? 920 : model === 'protected' ? 820 : 780) + DIFFICULTIES[difficulty].cashBonus;
    return {
      version: SAVE_VERSION,
      playerName: String(opts.playerName || 'Alex').slice(0, 18),
      region,
      model,
      trait: opts.trait,
      difficulty,
      brandStyle: 'warm',
      baseRate: clamp(Math.round((Number(opts.baseRate) || 250) / 25) * 25, 150, 700),
      day: 1,
      minutes: 480,
      speed: 1,
      money: cash,
      energy: 88,
      stress: 16,
      health: 94,
      reputation: 12,
      exposure: region === 'neoncenter' ? 13 : 8,
      visibility: 32 + MODELS[model].visibility,
      profile: 43,
      safetyBase: 34,
      safeCallBookings: model === 'protected' ? 3 : 0,
      datePrep: 0,
      schedulePrep: 0,
      compliancePressure: 0,
      skills,
      leads: [],
      bookings: [],
      clients: [],
      ledger: [],
      journal: [],
      completedDates: 0,
      declinedUnsafe: 0,
      totalEarned: 0,
      totalSpent: 0,
      totalDistance: 0,
      lastLeadRefreshDay: 1,
      demandBoostUntilDay: 0,
      playerPosition: { ...LOCATIONS.home.entry },
      collective: { member: false, joinedDay: 0, standing: 0, mentored: 0, reportedClientIds: [] },
      stats: { balancedStreak: 0, bestBalancedStreak: 0, regionsWorked: [], burnouts: 0 },
      achievements: {},
      flags: { goalReached: false, day14Review: false, tutorialDismissed: false, tutorialStage: 0, ending: null },
    };
  }

  /** Saves from the original build (version 1) load with the new fields filled in. */
  migrateState(saved) {
    const base = this.createInitialState({
      playerName: saved?.playerName || 'Alex',
      region: saved?.region || 'sunharbor',
      model: saved?.model || 'independent',
      trait: saved?.trait || 'connector',
      baseRate: saved?.baseRate || 250,
      difficulty: saved?.difficulty || 'standard',
    });
    const s = {
      ...base,
      ...saved,
      version: SAVE_VERSION,
      skills: { ...base.skills, ...(saved?.skills || {}) },
      flags: { ...base.flags, ...(saved?.flags || {}) },
      collective: { ...base.collective, ...(saved?.collective || {}) },
      stats: { ...base.stats, ...(saved?.stats || {}) },
      achievements: { ...(saved?.achievements || {}) },
      leads: Array.isArray(saved?.leads) ? saved.leads : [],
      bookings: Array.isArray(saved?.bookings) ? saved.bookings : [],
      clients: Array.isArray(saved?.clients) ? saved.clients : [],
      ledger: Array.isArray(saved?.ledger) ? saved.ledger : [],
      journal: Array.isArray(saved?.journal) ? saved.journal : [],
      playerPosition: saved?.playerPosition || base.playerPosition,
    };
    if (!REGIONS[s.region]) s.region = 'sunharbor';
    if (!MODELS[s.model]) s.model = 'independent';
    if (!BRANDS[s.brandStyle]) s.brandStyle = 'warm';
    if (!DIFFICULTIES[s.difficulty]) s.difficulty = 'standard';
    if (!SPEEDS.includes(s.speed)) s.speed = 1;
    if (!Array.isArray(s.collective.reportedClientIds)) s.collective.reportedClientIds = [];
    if (!Array.isArray(s.stats.regionsWorked)) s.stats.regionsWorked = [];
    // Leads saved by older builds could point at a venue that no longer exists.
    s.leads = s.leads.filter((l) => LOCATIONS[l.venueId]);
    return s;
  }

  startNew(opts) {
    this.state = this.createInitialState(opts);
    this.resetSession();
    this.started = true;
    this.records.careers += 1;
    this.saveRecords();
    const s = this.state;
    this.world.applyRegion(s.region);
    this.world.setPlayerPosition(s.playerPosition.x, s.playerPosition.z);
    this.generateLeads(4, { initial: true });
    this.addJournal('Career started', `${REGIONS[s.region].name} · ${MODELS[s.model].name} · ${DIFFICULTIES[s.difficulty].name} pace`);
    this.ui.hideStartScreen();
    this.ui.setPhoneOpen(false);
    this.ui.setPhoneFocus(false);
    this.ui.activeTab = 'leads';
    this.ui.syncTabs();
    this.ui.hudCache.clear();
    this.ui.updateHUD(s);
    this.ui.renderPhone();
    this.updateObjective(true);
    this.ui.showTutorial(0);
    this.ui.toast('Career started', `Welcome to ${REGIONS[s.region].name}, ${s.playerName}. Screen the new inquiries on your phone.`, 'success', 5200);
    this.save(false);
    this.onLayerChange();
  }

  continueSaved() {
    const raw = storageGet(SAVE_KEY);
    if (!raw) {
      this.ui.toast('No saved career', 'Start a new career to create a save file.', 'warning');
      return;
    }
    let loaded;
    try {
      loaded = this.migrateState(JSON.parse(raw));
    } catch (err) {
      console.error(err);
      this.ui.toast('Save could not be loaded', 'The stored data was invalid. A new career can still be started.', 'danger', 6200);
      return;
    }
    this.state = loaded;
    this.resetSession();
    this.started = true;
    const s = this.state;
    this.world.applyRegion(s.region);
    this.world.setPlayerPosition(s.playerPosition?.x ?? LOCATIONS.home.entry.x, s.playerPosition?.z ?? LOCATIONS.home.entry.z);
    this.ui.hideStartScreen();
    this.ui.setPhoneOpen(false);
    this.ui.setPhoneFocus(false);
    this.ui.syncTabs();
    this.ui.hudCache.clear();
    this.ui.updateHUD(s);
    this.ui.renderPhone();
    this.processBookings();
    this.updateObjective(true);
    if (!s.flags.tutorialDismissed && (s.flags.tutorialStage ?? 0) < 4) this.ui.showTutorial(s.flags.tutorialStage ?? 0);
    else this.ui.hideTutorial();
    this.ui.toast('Career loaded', `${REGIONS[s.region].name}, Day ${s.day} at ${clockLabel(s.minutes)}.`, 'success');
    this.onLayerChange();
  }

  save(manual = false) {
    if (!this.state || !this.started) return false;
    this.state.playerPosition = this.world.getPlayerPosition();
    let ok = false;
    try {
      ok = storageSet(SAVE_KEY, JSON.stringify(this.state));
    } catch (err) {
      console.error(err);
    }
    if (ok) this.ui.refreshContinueButton();
    else if (manual) this.ui.toast('Save failed', 'Browser storage is unavailable or full.', 'danger');
    return ok;
  }

  saveRecords() {
    storageSet(RECORDS_KEY, JSON.stringify(this.records));
  }

  /* ------------------------------------------------------------ frame and input */

  /** The menu layer on top, if any: its element takes gamepad/arrow navigation. */
  activeLayer() {
    const ui = this.ui;
    const L = this.layers;
    if (ui.isPauseOpen) return L.pause;
    if (ui.isModalOpen) {
      L.modal.key = ui.modalVersion;
      return L.modal;
    }
    if (ui.isStartOpen) return L.start;
    if (ui.phoneFocus) return L.phone;
    return null;
  }

  /** Can the character walk and use locations right now? Time must be running (as in the original). */
  canControl() {
    return !!(
      this.started &&
      this.state &&
      this.state.speed > 0 &&
      !this.burnoutActive &&
      !this.ui.isModalOpen &&
      !this.ui.isPauseOpen &&
      !this.ui.isStartOpen
    );
  }

  frame(dt) {
    const input = this.input;
    const zoom = input.zoom() + (input.down('zoomIn') ? dt * 7 : 0) - (input.down('zoomOut') ? dt * 7 : 0);
    const layer = this.activeLayer();
    this.nav.update(layer?.root ?? null, layer?.key ?? null);
    if (layer) this.handleMenuInput(layer);
    else this.handleWorldInput();

    const paused = this.ui.isPauseOpen;
    const controls = this.canControl();
    this.world.setControlsEnabled(controls);
    const worldInput = !layer || layer.kind === 'phone';
    const move = controls && !layer ? input.vector('move') : ZERO;
    const s = this.state;
    this.world.speedFactor = s ? (s.energy < 15 ? 0.72 : s.energy < 30 ? 0.88 : 1) : 1;
    if (worldInput && zoom) this.world.addZoom(zoom);
    this.world.update(dt, move, { frozen: paused });
    if (worldInput) {
      // A tap on the city while the phone has focus hands control back to walking.
      if (layer?.kind === 'phone' && input.pointer.justDown) this.setPhoneFocus(false);
      this.world.handlePointer(input, zoom);
    } else {
      this.world.pressStart = null;
    }
    if (this.started && s && !paused) this.update(dt);
    this.world.setTimeOfDay(s ? s.minutes : 480);
    this.world.render();
  }

  handleMenuInput(layer) {
    const input = this.input;
    const back = input.pressed('back');
    const pause = input.pressed('pause');
    if (layer.kind === 'pause') {
      if (back || pause) {
        if (this.ui.isControlsHelpOpen) this.ui.hideControlsHelp();
        else this.closePause();
      }
    } else if (layer.kind === 'modal') {
      if (back || pause) {
        if (this.ui.modalClosable) this.ui.requestCloseModal();
        else if (pause) this.openPause();
      }
    } else if (layer.kind === 'phone') {
      if (back || pause || input.pressed('phone')) this.setPhoneFocus(false);
    }
  }

  handleWorldInput() {
    const input = this.input;
    if (input.pressed('pause')) {
      this.openPause();
      return;
    }
    if (!this.started || !this.state) return;
    if (input.pressed('phone')) {
      this.setPhoneFocus(true);
      return;
    }
    if (input.pressed('back') && this.ui.isTutorialOpen) {
      this.ui.hideTutorial();
      this.dismissTutorial();
    }
    if (input.pressed('speed')) this.cycleSpeed();
    if (!this.canControl()) return;
    if (input.pressed('interact') || input.pressed('confirm')) this.interactNearby();
    if (input.pressed('travel')) this.travelToObjective();
  }

  /** Called whenever a menu opens or closes: touch controls hide behind menus, held buttons settle. */
  onLayerChange() {
    const menu = this.ui.isPauseOpen || this.ui.isModalOpen || this.ui.isStartOpen;
    this.kit.touch?.suspend(menu, 'game');
    this.input.settle();
    this.updateTouchControls();
  }

  updateTouchControls() {
    // Hidden while the phone sheet covers the bottom of a narrow screen.
    const sheet = this.ui.phoneFocus || (this.ui.phoneOpen && this.narrowQuery.matches);
    const show = !!this.nearLocation && this.canControl() && !sheet;
    if (show === this.touchInteractShown) return;
    this.touchInteractShown = show;
    this.kit.touch?.setShown('interact', show);
  }

  setPhoneFocus(on) {
    if (on && !this.started) return;
    if (!!on === this.ui.phoneFocus) return;
    this.ui.setPhoneFocus(on);
    // On narrow screens the phone is a sheet that has to slide up first.
    if (on) this.ui.setPhoneOpen(true);
    else if (this.ui.phoneOpen && this.narrowQuery.matches) this.ui.setPhoneOpen(false);
    this.sound.play(on ? 'open' : 'close');
    this.onLayerChange();
  }

  openPause() {
    if (this.ui.isPauseOpen) return;
    const s = this.state;
    const summary = s
      ? `<strong>${esc(s.playerName)}</strong> · ${esc(REGIONS[s.region].name)} · Day ${s.day}, ${clockLabel(s.minutes)} · ${money(s.money)}`
      : 'City Companion';
    this.ui.showPause(summary, this.sound.enabled);
    this.onLayerChange();
  }

  closePause() {
    if (!this.ui.isPauseOpen) return;
    this.ui.hidePause();
    this.sound.play('close');
    this.onLayerChange();
  }

  pauseAction(action) {
    switch (action) {
      case 'resume':
        this.closePause();
        break;
      case 'save':
        if (this.save(true)) this.ui.toast('Career saved', 'Your current day, bookings, finances, and progression were stored.', 'success');
        break;
      case 'controls':
        this.ui.toggleControlsHelp();
        break;
      case 'settings':
        this.openSettings();
        break;
      case 'sound':
        this.sound.setEnabled(!this.sound.enabled);
        this.ui.setSoundLabel(this.sound.enabled);
        this.sound.play('click');
        break;
      case 'title':
        this.quitToTitle();
        break;
      default:
        break;
    }
  }

  openSettings() {
    this.kit.menu.open();
  }

  quitToTitle() {
    this.save(false);
    this.ui.hidePause();
    this.ui.closeModal();
    this.state = null;
    this.started = false;
    this.resetSession();
    this.world.applyRegion('sunharbor');
    this.world.setPlayerPosition(LOCATIONS.home.entry.x, LOCATIONS.home.entry.z);
    this.world.setObjectiveLocation(null);
    this.ui.hideTutorial();
    this.ui.renderPhone();
    this.ui.showStartScreen(this.records);
    this.onLayerChange();
  }

  /* ------------------------------------------------------------ simulation tick */

  update(dt) {
    const s = this.state;
    if (!this.ui.isModalOpen && s.speed > 0 && !this.burnoutActive) {
      this.advanceClock(dt * MINUTES_PER_SECOND * s.speed, { passive: true, render: false });
    }
    if (!this.state) return;
    this.hudTimer += dt;
    this.objectiveTimer += dt;
    this.phoneTimer += dt;
    this.autosaveTimer += dt;
    this.bookingTimer += dt;
    if (this.bookingTimer >= 0.5) {
      this.bookingTimer = 0;
      this.processBookings();
      this.checkMilestones();
    }
    if (this.hudTimer >= 0.2) {
      this.hudTimer = 0;
      this.ui.updateHUD(this.state);
      this.updateTouchControls();
      document.body.classList.toggle('is-night', !!this.world.isNight);
    }
    if (this.objectiveTimer >= 0.75) {
      this.objectiveTimer = 0;
      this.updateObjective(false);
    }
    if (this.phoneTimer >= 4.5) {
      this.phoneTimer = 0;
      if (this.ui.activeTab === 'calendar') this.ui.renderPhone();
    }
    if (this.autosaveTimer >= 18) {
      this.autosaveTimer = 0;
      this.save(false);
    }
  }

  refreshUI(renderPhone = true) {
    if (!this.state) return;
    this.ui.updateHUD(this.state);
    if (renderPhone) this.ui.renderPhone();
    this.updateObjective(true);
  }

  setSpeed(speed) {
    if (!this.state) return;
    this.state.speed = SPEEDS.includes(speed) ? speed : 1;
    this.ui.setSpeed(this.state.speed);
    this.updateTouchControls();
  }

  cycleSpeed() {
    if (!this.state) return;
    const next = SPEEDS[(SPEEDS.indexOf(this.state.speed) + 1) % SPEEDS.length];
    this.setSpeed(next);
    this.sound.play('click');
    this.kit.toast(next === 0 ? 'Time paused' : `Time ${next}×`, 1100);
  }

  noteMovement() {
    if (!this.started || !this.state || this.firstMovementNoted) return;
    this.firstMovementNoted = true;
    if ((this.state.flags.tutorialStage ?? 0) <= 0) {
      this.state.flags.tutorialStage = 1;
      this.ui.showTutorial(1);
    }
  }

  handleDistanceMoved(distance) {
    const s = this.state;
    if (!s) return;
    s.totalDistance += distance;
    s.energy = clamp(s.energy - distance * 0.006, 0, 100);
    if (!this.firstMovementNoted && s.totalDistance > 0.7) this.noteMovement();
  }

  dismissTutorial() {
    if (this.state) this.state.flags.tutorialDismissed = true;
  }

  showTutorialStage(stage) {
    const s = this.state;
    if (!s || (s.flags.tutorialStage ?? 0) >= stage) return;
    s.flags.tutorialStage = stage;
    s.flags.tutorialDismissed = false;
    this.ui.showTutorial(clamp(stage, 0, 3));
  }

  /* ------------------------------------------------------------ stats and money */

  applyStats(d = {}) {
    const s = this.state;
    if (!s) return;
    for (const key of ['energy', 'stress', 'health', 'reputation', 'exposure', 'visibility', 'profile', 'safetyBase', 'compliancePressure']) {
      if (Number.isFinite(d[key])) s[key] = clamp(s[key] + d[key], 0, 100);
    }
  }

  recordTransaction(amount, label) {
    const s = this.state;
    if (!s) return;
    s.ledger.unshift({ id: uid('txn'), day: s.day, minute: Math.round(s.minutes), amount: Math.round(amount), label });
    s.ledger = s.ledger.slice(0, 30);
  }

  spend(amount, label, { allowNegative = false } = {}) {
    const s = this.state;
    if (!s || amount <= 0) return true;
    if (!allowNegative && s.money < amount) {
      this.ui.toast('Not enough cash', `${label} costs ${money(amount)}.`, 'warning');
      return false;
    }
    s.money -= amount;
    s.totalSpent += amount;
    this.recordTransaction(-amount, label);
    return true;
  }

  earn(amount, label) {
    const s = this.state;
    if (!s || amount <= 0) return;
    s.money += amount;
    s.totalEarned += amount;
    this.recordTransaction(amount, label);
  }

  addJournal(title, detail) {
    const s = this.state;
    if (!s) return;
    s.journal.unshift({ id: uid('journal'), day: s.day, minute: Math.round(s.minutes), title, detail });
    s.journal = s.journal.slice(0, 70);
  }

  addXP(skillId, amount) {
    const s = this.state;
    if (!s || !s.skills[skillId] || amount <= 0) return;
    const skill = s.skills[skillId];
    if (skill.level >= SKILL_CAP) return;
    skill.xp += amount;
    while (skill.level < SKILL_CAP && skill.xp >= xpForLevel(skill.level)) {
      skill.xp -= xpForLevel(skill.level);
      skill.level += 1;
      this.ui.toast(`${SKILLS[skillId].name} improved`, `Reached level ${skill.level}.`, 'success', 4300, 'level');
    }
    if (skill.level >= SKILL_CAP) skill.xp = 0;
  }

  dailyOverhead() {
    const s = this.state;
    if (!s) return 0;
    const pace = DIFFICULTIES[s.difficulty] || DIFFICULTIES.standard;
    const base = (REGIONS[s.region].dailyCost + MODELS[s.model].dailyRetainer) * pace.costMultiplier;
    return Math.round(base) + (s.collective.member ? COLLECTIVE_DUES : 0);
  }

  getSafetyScore() {
    const s = this.state;
    if (!s) return 0;
    const region = REGIONS[s.region];
    const model = MODELS[s.model];
    const safeCall = s.safeCallBookings > 0 ? 11 : 0;
    const stressPenalty = Math.max(0, s.stress - 45) * 0.16;
    const peers = s.collective.member ? 4 + Math.min(4, s.collective.standing / 25) : 0;
    return clamp(s.safetyBase + s.skills.safety.level * 4.5 + model.safety + region.safetyModifier + safeCall + peers - stressPenalty, 0, 100);
  }

  /* ------------------------------------------------------------ time */

  advanceClock(minutes, opts = {}) {
    const s = this.state;
    if (!s || minutes <= 0) return;
    let left = minutes;
    while (left > 0.001 && this.state) {
      const step = Math.min(left, 1440 - s.minutes);
      this.applyPassiveTimeEffects(step, opts.passive ?? false);
      s.minutes += step;
      left -= step;
      if (s.minutes >= 1439.999) {
        s.minutes = 0;
        s.day += 1;
        this.onNewDay();
      }
    }
    this.processBookings();
    if (opts.render !== false) this.refreshUI(true);
  }

  applyPassiveTimeEffects(minutes, passive) {
    const s = this.state;
    if (!s) return;
    const hours = minutes / 60;
    const pace = DIFFICULTIES[s.difficulty] || DIFFICULTIES.standard;
    const drain = (passive ? hours * 0.48 : hours * 0.22) * pace.drainMultiplier;
    s.energy = clamp(s.energy - drain, 0, 100);
    if (s.energy < 22) s.stress = clamp(s.stress + hours * 0.28, 0, 100);
    if (s.energy < 8) s.health = clamp(s.health - hours * 0.18, 0, 100);
    const clock = s.minutes % 1440;
    // Staying out in the small hours wears on you.
    if (passive && clock > 120 && clock < 360 && !this.world.isNearLocation('home')) s.stress = clamp(s.stress + hours * 0.24, 0, 100);
  }

  onNewDay() {
    const s = this.state;
    if (!s) return;
    const region = REGIONS[s.region];
    const cost = this.dailyOverhead();
    this.spend(cost, `Day ${s.day} operating costs`, { allowNegative: true });
    this.applyStats({ visibility: -2.2, profile: -0.45, stress: s.money < 0 ? 9 : -1, compliancePressure: -2 });
    const today = absMinute(s.day, 0);
    s.leads = s.leads.filter((l) => absMinute(l.requestedDay, l.requestedMinute) > today && s.day - l.createdDay <= 2);
    this.processClientCancellations();
    // Sustainable-pace streak (achievement).
    if (s.stress < 35 && s.health > 70) s.stats.balancedStreak += 1;
    else s.stats.balancedStreak = 0;
    s.stats.bestBalancedStreak = Math.max(s.stats.bestBalancedStreak, s.stats.balancedStreak);
    const target = Math.max(1, Math.round(2 * region.demand + s.visibility / 45));
    this.generateLeads(randInt(Math.max(1, target - 1), target + 1));
    this.runDailyEvent();
    this.addJournal('New day', `${money(cost)} operating costs charged. ${s.leads.length} active leads remain.`);
    this.ui.toast(`Day ${s.day}`, `${money(cost)} in operating costs. Check the phone for fresh inquiries.`, s.money < 0 ? 'warning' : 'info', 4300, 'day');
  }

  processClientCancellations() {
    const s = this.state;
    if (!s) return;
    const now = absMinute(s.day, s.minutes);
    for (const b of s.bookings) {
      if (b.status !== 'confirmed' || b.cancellationCheckedDay === s.day) continue;
      b.cancellationCheckedDay = s.day;
      if (absMinute(b.day, b.minute) - now < 480) continue;
      const p = 0.035 + b.risk / 1800 - (b.isRegular ? 0.02 : 0);
      if (!chance(clamp(p, 0.015, 0.1))) continue;
      b.status = 'cancelled';
      b.outcomeNote = 'Client cancelled under the stated policy; the deposit was retained.';
      this.applyStats({ stress: 2, visibility: -1 });
      this.addJournal('Client cancellation', `${b.clientName} cancelled the ${dayTime(b.day, b.minute)} booking.`);
      this.ui.toast('Booking cancelled by client', `${b.clientName} cancelled. The deposit remains under your policy.`, 'warning');
      if (this.manualObjectiveBookingId === b.id) this.manualObjectiveBookingId = null;
    }
  }

  runDailyEvent() {
    const s = this.state;
    if (!s) return;
    const r = Math.random();
    if (r < 0.18) {
      this.applyStats({ visibility: 6, exposure: 1 });
      this.generateLeads(1, { qualityBoost: 8 });
      this.ui.toast('Referral mention', 'A positive private referral improves visibility and creates a new inquiry.', 'success');
      this.addJournal('Referral mention', 'Visibility increased through word of mouth.');
    } else if (r < 0.32) {
      s.demandBoostUntilDay = s.day + 1;
      this.generateLeads(2);
      this.ui.toast('Busy city weekend', 'Local events temporarily increase demand for social bookings.', 'success');
      this.addJournal('Demand spike', 'Local events increased short-term demand.');
    } else if (r < 0.44 && s.exposure > 45) {
      this.applyStats({ exposure: 7, profile: -3, compliancePressure: 6 });
      this.ui.toast('Platform scrutiny', 'High visibility triggered a profile review. A privacy audit or business consultation can reduce pressure.', 'warning', 5800);
      this.addJournal('Platform scrutiny', 'Exposure increased and profile quality dipped.');
    } else if (r < 0.56) {
      this.addXP('insight', 12);
      this.applyStats({ safetyBase: 2 });
      this.ui.toast('Peer safety tip', 'A trusted contact shares a useful screening pattern.', 'success');
      this.addJournal('Peer advice', 'Insight experience and safety readiness improved.');
    } else if (r < 0.66) {
      this.applyStats({ stress: 5 });
      this.ui.toast('Personal-life pressure', 'An unexpected obligation adds stress. Time at home, the park, or the clinic can help.', 'warning');
      this.addJournal('Personal obligation', 'An unexpected obligation raised stress.');
    } else if (r < 0.76 && s.collective.member) {
      this.addXP('insight', 8);
      this.applyStats({ safetyBase: 1, stress: -2 });
      s.collective.standing = clamp(s.collective.standing + 2, 0, 100);
      this.ui.toast('Collective check-in', 'Harborlight members shared a new warning pattern at the morning check-in.', 'success');
      this.addJournal('Collective check-in', 'Insight and safety readiness improved.');
    }
  }

  processBookings() {
    const s = this.state;
    if (!s) return;
    const now = absMinute(s.day, s.minutes);
    let changed = false;
    // Inquiries whose requested time has passed can no longer be booked (the original let you
    // accept them, which produced an instantly missed booking).
    // (Runs every frame, so only build a new list when something actually expired.)
    if (s.leads.some((l) => absMinute(l.requestedDay, l.requestedMinute) <= now + 15)) {
      s.leads = s.leads.filter((l) => absMinute(l.requestedDay, l.requestedMinute) > now + 15);
      changed = true;
    }
    for (const b of s.bookings) {
      if (b.status !== 'confirmed') continue;
      const until = absMinute(b.day, b.minute) - now;
      if (until <= 60 && until > 0 && !b.notified) {
        b.notified = true;
        this.ui.toast('Booking in one hour', `${b.clientName} at ${LOCATIONS[b.venueId].name}.`, 'warning', 5200);
        this.input.rumble(0.2, 80);
      }
      if (until < -90 && !(this.activeEncounter && this.activeEncounter.bookingId === b.id)) {
        b.status = 'missed';
        b.outcomeNote = 'The booking window passed before arrival.';
        if (b.depositNet > 0) {
          s.money -= b.depositNet;
          s.totalEarned = Math.max(0, s.totalEarned - b.depositNet);
          this.recordTransaction(-b.depositNet, `Deposit refund · ${b.clientName}`);
        }
        this.applyStats({ reputation: -6, stress: 10, visibility: -2 });
        this.addJournal('Missed booking', `${b.clientName} at ${LOCATIONS[b.venueId].name}.`);
        this.ui.toast('Booking missed', `${b.clientName}'s booking window passed. The deposit was refunded.`, 'danger', 6200);
        this.input.rumble(0.6, 220);
        if (this.manualObjectiveBookingId === b.id) this.manualObjectiveBookingId = null;
        changed = true;
      }
    }
    if (changed) this.refreshUI(true);
  }

  /** A confirmed booking that an action of `minutes` at `locationId` would run into. */
  findTimeConflict(minutes, locationId) {
    const s = this.state;
    const now = absMinute(s.day, s.minutes);
    const end = now + minutes;
    return (
      s.bookings
        .filter((b) => b.status === 'confirmed')
        .sort((a, b) => absMinute(a.day, a.minute) - absMinute(b.day, b.minute))
        .find((b) => {
          const start = absMinute(b.day, b.minute);
          if (start + 90 <= now) return false;
          // Waiting at the booking's own venue is fine until the late window closes.
          const latest = b.venueId === locationId ? start + 60 : start - 20;
          return end > latest;
        }) || null
    );
  }

  confirmTimeConflict(booking, minutes, proceed, back) {
    this.ui.openModal({
      kicker: 'Calendar check',
      title: 'This runs into a booking',
      body: `<div class="modal-banner warning">This takes about ${hoursLabel(minutes)} and runs into ${esc(booking.clientName)} at ${esc(LOCATIONS[booking.venueId].name)} (${dayTime(booking.day, booking.minute)}). You may arrive late or miss it, which costs reputation and refunds the deposit.</div>`,
      actions: [
        {
          label: 'Go back',
          navDefault: true,
          onClick: () => {
            this.ui.closeModal();
            back?.();
          },
        },
        { label: 'Do it anyway', className: 'danger-action', onClick: proceed },
      ],
    });
  }

  /* ------------------------------------------------------------ leads */

  /** A client name not already used by a client or an open lead, so records never merge by accident. */
  freshClientName() {
    const s = this.state;
    const taken = new Set([...s.clients.map((c) => c.name), ...s.leads.map((l) => l.name)]);
    const free = CLIENT_NAMES.filter((n) => !taken.has(n));
    if (free.length) return pick(free);
    for (let i = 0; i < 20; i += 1) {
      const name = `${pick(CLIENT_NAMES)} ${String.fromCharCode(65 + randInt(0, 25))}.`;
      if (!taken.has(name)) return name;
    }
    return `${pick(CLIENT_NAMES)} ${randInt(2, 99)}`;
  }

  generateLeads(count, opts = {}) {
    const s = this.state;
    if (!s || count <= 0) return;
    const region = REGIONS[s.region];
    const model = MODELS[s.model];
    const brand = BRANDS[s.brandStyle];
    const pace = DIFFICULTIES[s.difficulty] || DIFFICULTIES.standard;
    const slots = [660, 780, 900, 1020, 1140, 1260, 1350];
    const regulars = s.clients.filter((c) => c.regular && !c.blacklisted);
    const n = Math.min(count, Math.max(0, 9 - s.leads.length));
    for (let i = 0; i < n; i += 1) {
      const initial = !!(opts.initial && i === 0);
      const regular = !opts.archetypeId && regulars.length > 0 && chance(0.2) ? pick(regulars) : null;
      const arch = regular
        ? ARCHETYPES.find((a) => a.id === 'quiet-regular')
        : (opts.archetypeId && ARCHETYPES.find((a) => a.id === opts.archetypeId)) || pick(ARCHETYPES);
      const vip = !regular && s.reputation >= 32 && chance(0.09 + s.reputation / 700);
      let day = s.day + randInt(0, 2);
      let minute = pick(slots);
      if (initial) {
        day = s.day;
        minute = Math.max(1020, Math.ceil((s.minutes + 240) / 30) * 30);
        if (minute > 1350) {
          day += 1;
          minute = 1080;
        }
      } else if (day === s.day && minute < s.minutes + 150) {
        day += 1;
      }
      const duration = initial ? 120 : pick(arch.duration);
      const demand = s.demandBoostUntilDay >= s.day ? 1.08 : 1;
      const repMult = 1 + s.reputation / 450;
      const noise = 0.92 + Math.random() * 0.18;
      const vipMult = vip ? 1.32 : 1;
      const profileMult = 0.86 + s.profile / 350;
      let rate = s.baseRate * region.rateMultiplier * profileMult * brand.rateMultiplier * arch.rate * (duration / 120) * repMult * noise * demand * vipMult;
      rate = Math.max(125, Math.round(rate / 25) * 25);
      let risk =
        randInt(16, 58) + arch.risk - Math.round(model.leadQuality * 28) - Math.round((opts.qualityBoost || 0) * 0.38) - (regular ? 17 : 0) + pace.riskOffset;
      if (initial) risk = 24;
      if (vip) risk += 4;
      risk = clamp(risk, 5, 88);
      const positives = shuffled(POSITIVE_FLAGS).slice(0, initial ? 3 : randInt(1, 3));
      const warnCount = initial ? 0 : risk > 48 ? randInt(1, 2) : chance(0.38) ? 1 : 0;
      const warnings = shuffled(WARNING_FLAGS).slice(0, warnCount);
      if (!initial && risk > 68 && chance(0.55)) warnings.push(pick(SERIOUS_FLAGS));
      const serious = warnings.some((w) => SERIOUS_FLAGS.includes(w));
      const deposit = warnings.includes('Avoids deposit discussion') ? 0 : regular ? 20 : 25;
      const budgetMax = Math.round((rate * (0.94 + Math.random() * 0.38)) / 25) * 25;
      const budgetSignal = budgetMax >= rate * 1.18 ? 'Strong' : budgetMax >= rate ? 'Aligned' : 'Tight';
      const preScreened = !!regular || (s.model === 'agency' && chance(0.3));
      let effectiveRisk = clamp(risk - (s.skills.insight.level * 1.6 + model.screening), 4, 92);
      // Pre-screened leads now carry the same penalty for serious flags as manual screening.
      if (preScreened && serious) effectiveRisk = clamp(effectiveRisk + 18, 4, 96);
      const name = regular?.name || this.freshClientName();
      const peerAlert = !preScreened && serious && s.collective.member && chance(0.45 + s.collective.standing / 200);
      s.leads.push({
        id: uid('lead'),
        sourceClientId: regular?.id || null,
        name,
        archetypeId: arch.id,
        archetypeLabel: regular ? 'Regular request' : vip ? 'VIP inquiry' : arch.label,
        summary: regular ? `${name} would like to arrange another calm, familiar date.` : arch.summary,
        duration,
        venueId: initial ? 'cafe' : pick(arch.venues),
        requestedDay: day,
        requestedMinute: minute,
        proposedRate: rate,
        budgetMax,
        budgetSignal,
        depositPct: deposit,
        baseRisk: risk,
        effectiveRisk,
        positiveFlags: preScreened ? positives : [],
        warningFlags: preScreened ? warnings : [],
        hiddenPositiveFlags: positives,
        hiddenWarningFlags: warnings,
        screened: preScreened,
        peerAlert,
        isRegular: !!regular,
        isVip: vip,
        createdDay: s.day,
        negotiationCount: 0,
        qualityBoost: opts.qualityBoost || 0,
      });
    }
    s.lastLeadRefreshDay = s.day;
  }

  findLead(id) {
    return this.state?.leads.find((l) => l.id === id) || null;
  }

  findBooking(id) {
    return this.state?.bookings.find((b) => b.id === id) || null;
  }

  leadGone() {
    this.ui.closeModal();
    this.ui.toast('Inquiry expired', 'The requested time has passed or the lead was removed.', 'info');
    this.refreshUI(true);
  }

  screenLead(id) {
    const lead = this.findLead(id);
    if (!lead) return this.leadGone();
    if (lead.screened) return;
    const s = this.state;
    const model = MODELS[s.model];
    lead.screened = true;
    lead.positiveFlags = [...lead.hiddenPositiveFlags];
    lead.warningFlags = [...lead.hiddenWarningFlags];
    const prep = s.schedulePrep > 0 ? 3 : 0;
    // "The next three screening or booking decisions gain a small preparation bonus": screening uses one.
    if (prep) s.schedulePrep -= 1;
    const cut = s.skills.insight.level * 1.8 + model.screening + prep + (s.collective.member ? 2 : 0);
    lead.effectiveRisk = clamp(lead.baseRisk - cut, 4, 94);
    if (lead.warningFlags.some((f) => SERIOUS_FLAGS.includes(f))) lead.effectiveRisk = clamp(lead.effectiveRisk + 18, 4, 96);
    this.applyStats({ energy: -1.5, stress: lead.effectiveRisk >= 70 ? 1 : -0.5 });
    this.addXP('insight', 14);
    this.advanceClock(25, { render: false });
    this.showTutorialStage(2);
    const risk = riskLabel(lead.effectiveRisk);
    const advice =
      lead.effectiveRisk >= 62
        ? 'Consider declining, changing the venue, or adding a SafeLine check-in before accepting.'
        : lead.effectiveRisk >= 34
          ? 'Clarify the plan and use a deposit before confirming.'
          : 'The inquiry has consistent information and can be considered for the calendar.';
    const good = lead.positiveFlags.map((f) => `<span class="tag positive">${esc(f)}</span>`).join('');
    const bad = lead.warningFlags.length
      ? lead.warningFlags.map((f) => `<span class="tag ${lead.effectiveRisk >= 62 ? 'negative' : 'warning'}">${esc(f)}</span>`).join('')
      : '<span class="tag positive">No material warning signs found</span>';
    this.ui.openModal({
      kicker: 'Screening result',
      title: `${lead.name} · ${risk.label} risk`,
      body: `
        <p>Screening combines the information supplied by the client, your Insight skill, and any support provided by your operating model.</p>
        <div class="modal-banner ${lead.effectiveRisk >= 62 ? 'danger' : lead.effectiveRisk >= 34 ? 'warning' : ''}">${esc(advice)}</div>
        <div class="tag-row">${good}${bad}</div>
        <div class="control-group">
          <div class="detail-row"><span>Requested fee</span><strong>${money(lead.proposedRate)}</strong></div>
          <div class="detail-row"><span>Deposit</span><strong>${lead.depositPct}%</strong></div>
          <div class="detail-row"><span>Venue</span><strong>${esc(LOCATIONS[lead.venueId].name)}</strong></div>
          <div class="detail-row"><span>Time</span><strong>${dayTime(lead.requestedDay, lead.requestedMinute)}</strong></div>
        </div>`,
      actions: [
        {
          label: 'Decline',
          className: 'danger-action',
          onClick: () => {
            this.ui.closeModal();
            this.declineLead(lead.id);
          },
        },
        { label: 'Negotiate', onClick: () => this.openNegotiation(lead.id) },
        {
          label: 'Accept',
          primary: true,
          onClick: () => {
            this.ui.closeModal();
            this.acceptLead(lead.id);
          },
        },
      ],
    });
    this.refreshUI(true);
    this.save(false);
  }

  openNegotiation(id) {
    const lead = this.findLead(id);
    if (!lead) return this.leadGone();
    const r = (m) => Math.round((lead.proposedRate * m) / 25) * 25;
    const clear = r(1);
    const premium = r(1.15);
    const flexible = r(0.95);
    const firm = r(1.25);
    this.ui.openModal({
      kicker: 'Price and terms',
      title: `Negotiate with ${lead.name}`,
      body: ({ choiceGrid }) => `
        <p>Set a clear total fee and deposit. A higher ask improves potential earnings but can reduce conversion when it exceeds the client’s budget signal.</p>
        <div class="control-group">
          <div class="detail-row"><span>Current proposal</span><strong>${money(lead.proposedRate)}</strong></div>
          <div class="detail-row"><span>Budget signal</span><strong>${esc(lead.budgetSignal)}</strong></div>
          <div class="detail-row"><span>Negotiation skill</span><strong>Level ${this.state.skills.negotiation.level}</strong></div>
        </div>
        ${choiceGrid([
          { label: `Clear terms · ${money(clear)}`, detail: 'Keep the fee and request a 25% deposit.', meta: { left: 'Balanced', right: '25% deposit' }, onClick: () => this.resolveNegotiation(lead.id, clear, 25, 'balanced') },
          { label: `Premium ask · ${money(premium)}`, detail: 'Price the schedule and positioning more firmly.', meta: { left: '+15%', right: '30% deposit' }, onClick: () => this.resolveNegotiation(lead.id, premium, 30, 'premium') },
          { label: `Flexible offer · ${money(flexible)}`, detail: 'Trade a small discount for easier conversion.', meta: { left: '-5%', right: '20% deposit' }, onClick: () => this.resolveNegotiation(lead.id, flexible, 20, 'flexible') },
          { label: `Hold firm · ${money(firm)}`, detail: 'A high-confidence ask with a meaningful chance of losing the lead.', meta: { left: '+25%', right: '35% deposit' }, onClick: () => this.resolveNegotiation(lead.id, firm, 35, 'assertive') },
        ])}`,
      actions: [{ label: 'Back', onClick: () => this.ui.closeModal() }],
    });
  }

  resolveNegotiation(id, fee, depositPct, style) {
    const lead = this.findLead(id);
    if (!lead) return this.leadGone();
    const s = this.state;
    lead.negotiationCount += 1;
    const ratio = fee / Math.max(1, lead.budgetMax);
    const styleMod = style === 'flexible' ? 0.12 : style === 'assertive' ? -0.1 : style === 'premium' ? -0.03 : 0.04;
    const depositDrag = lead.hiddenWarningFlags.includes('Avoids deposit discussion') ? depositPct / 180 : 0;
    const screenedMod = lead.screened ? 0.05 : -0.04;
    const regularMod = lead.isRegular ? 0.12 : 0;
    const p = clamp(
      0.78 + s.skills.negotiation.level * 0.035 + s.reputation * 0.002 + styleMod + screenedMod + regularMod - Math.max(0, ratio - 0.94) * 0.82 - depositDrag,
      0.08,
      0.96
    );
    const accepted = chance(p);
    this.addXP('negotiation', accepted ? 15 : 9);
    this.applyStats({ energy: -1, stress: accepted ? -0.5 : 1.5 });
    this.advanceClock(20, { render: false });
    if (!this.findLead(id)) return this.leadGone();
    if (accepted) {
      lead.proposedRate = fee;
      lead.depositPct = depositPct;
      lead.budgetSignal = fee <= lead.budgetMax ? 'Aligned' : 'Stretch';
      this.ui.openModal({
        kicker: 'Terms agreed',
        title: `${lead.name} accepted`,
        body: `
          <div class="modal-banner">The client accepted a total fee of <strong>${money(fee)}</strong> with a <strong>${depositPct}% deposit</strong>.</div>
          <p>You can confirm the booking now or leave the lead active while you review the calendar.</p>`,
        actions: [
          { label: 'Review leads', onClick: () => this.ui.closeModal() },
          {
            label: 'Accept booking',
            primary: true,
            onClick: () => {
              this.ui.closeModal();
              this.acceptLead(lead.id);
            },
          },
        ],
      });
      this.ui.toast('Negotiation accepted', `${lead.name} agreed to ${money(fee)}.`, 'success');
    } else if (chance(style === 'assertive' ? 0.32 : 0.62)) {
      const counter = Math.max(125, Math.round(Math.min(lead.budgetMax, lead.proposedRate) / 25) * 25);
      lead.proposedRate = counter;
      lead.depositPct = Math.min(depositPct, 20);
      this.ui.openModal({
        kicker: 'Counteroffer',
        title: `${lead.name} did not accept`,
        body: `<p>The client countered at <strong>${money(counter)}</strong> with a ${lead.depositPct}% deposit. The inquiry remains active.</p>`,
        actions: [
          { label: 'Leave active', onClick: () => this.ui.closeModal() },
          {
            label: 'Accept counter',
            primary: true,
            onClick: () => {
              this.ui.closeModal();
              this.acceptLead(lead.id);
            },
          },
        ],
      });
      this.ui.toast('Counteroffer received', `${lead.name} remains available at ${money(counter)}.`, 'warning');
    } else {
      s.leads = s.leads.filter((l) => l.id !== lead.id);
      this.ui.openModal({
        kicker: 'Lead closed',
        title: 'The client declined',
        body: '<p>The price and terms did not align. The calendar remains open for another inquiry.</p>',
        actions: [{ label: 'Close', primary: true, onClick: () => this.ui.closeModal() }],
      });
      this.ui.toast('Lead lost', 'The negotiation did not convert.', 'warning');
    }
    this.refreshUI(true);
    this.save(false);
  }

  declineLead(id) {
    const lead = this.findLead(id);
    if (!lead) return;
    const s = this.state;
    s.leads = s.leads.filter((l) => l.id !== id);
    if (lead.screened && lead.effectiveRisk >= 62) {
      s.declinedUnsafe += 1;
      this.addXP('safety', 8);
      this.applyStats({ stress: -1, safetyBase: 0.5 });
      this.ui.toast('High-risk lead declined', 'Clear boundaries and screening protect the long-term career.', 'success');
    } else {
      this.ui.toast('Lead declined', `${lead.name} was removed from active inquiries.`, 'info');
    }
    this.addJournal('Lead declined', `${lead.name} · ${money(lead.proposedRate)} · ${lead.screened ? `${riskLabel(lead.effectiveRisk).label} risk` : 'unscreened'}.`);
    this.refreshUI(true);
    this.save(false);
  }

  acceptLead(id, opts = {}) {
    const lead = this.findLead(id);
    if (!lead) return this.leadGone();
    if (!lead.screened && !opts.force) {
      this.ui.openModal({
        kicker: 'Screening recommended',
        title: 'Accept an unscreened inquiry?',
        body: `<div class="modal-banner warning">Without screening, warning signs and reliability information remain hidden. You can still proceed, but the encounter risk is less predictable.</div>${
          lead.peerAlert ? '<div class="modal-banner danger">Harborlight members have flagged this client. Screening is strongly advised.</div>' : ''
        }`,
        actions: [
          { label: 'Cancel', onClick: () => this.ui.closeModal() },
          {
            label: 'Screen first',
            navDefault: true,
            onClick: () => {
              this.ui.closeModal();
              this.screenLead(lead.id);
            },
          },
          {
            label: 'Accept unscreened',
            className: 'danger-action',
            onClick: () => {
              this.ui.closeModal();
              this.acceptLead(lead.id, { force: true });
            },
          },
        ],
      });
      return;
    }
    if (lead.screened && lead.effectiveRisk >= 68 && !opts.riskConfirmed) {
      this.ui.openModal({
        kicker: 'Elevated risk',
        title: 'Add safeguards or decline',
        body: `
          <div class="modal-banner danger">Screening rated this inquiry ${riskLabel(lead.effectiveRisk).label.toLowerCase()} risk. SafeLine support, a public venue, and a clear exit plan can reduce the practical risk.</div>
          <p>Choosing to decline has no reputation penalty.</p>`,
        actions: [
          {
            label: 'Decline',
            className: 'danger-action',
            onClick: () => {
              this.ui.closeModal();
              this.declineLead(lead.id);
            },
          },
          {
            label: 'Visit SafeLine',
            onClick: () => {
              this.ui.closeModal();
              this.guideToLocation('safety', 'Prepare additional safeguards before deciding.');
            },
          },
          {
            label: 'Accept with current plan',
            primary: true,
            onClick: () => {
              this.ui.closeModal();
              this.acceptLead(lead.id, { ...opts, force: true, riskConfirmed: true });
            },
          },
        ],
      });
      return;
    }
    const clash = this.findBookingConflict(lead.requestedDay, lead.requestedMinute, lead.duration);
    if (clash && !opts.conflictConfirmed) {
      this.ui.openModal({
        kicker: 'Calendar conflict',
        title: 'Bookings overlap',
        body: `<div class="modal-banner warning">This request overlaps ${esc(clash.clientName)} at ${dayTime(clash.day, clash.minute)}. Keeping both makes a missed booking likely.</div>`,
        actions: [
          { label: 'Cancel', onClick: () => this.ui.closeModal() },
          {
            label: 'Keep both anyway',
            className: 'danger-action',
            onClick: () => {
              this.ui.closeModal();
              this.acceptLead(lead.id, { ...opts, conflictConfirmed: true, force: true });
            },
          },
        ],
      });
      return;
    }
    this.confirmLeadAcceptance(lead);
  }

  findBookingConflict(day, minute, duration) {
    const start = absMinute(day, minute) - 45;
    const end = absMinute(day, minute) + duration + 45;
    return (
      this.state.bookings.find((b) => {
        if (b.status !== 'confirmed') return false;
        const bs = absMinute(b.day, b.minute) - 45;
        const be = absMinute(b.day, b.minute) + b.duration + 45;
        return start < be && end > bs;
      }) || null
    );
  }

  confirmLeadAcceptance(lead) {
    const s = this.state;
    const model = MODELS[s.model];
    const depositGross = Math.round(lead.proposedRate * (lead.depositPct / 100));
    const depositNet = Math.round(depositGross * (1 - model.commission));
    const booking = {
      id: uid('booking'),
      leadId: lead.id,
      sourceClientId: lead.sourceClientId,
      clientName: lead.name,
      archetypeId: lead.archetypeId,
      summary: lead.summary,
      day: lead.requestedDay,
      minute: lead.requestedMinute,
      duration: lead.duration,
      venueId: lead.venueId,
      rate: lead.proposedRate,
      depositPct: lead.depositPct,
      depositGross,
      depositNet,
      risk: lead.screened ? lead.effectiveRisk : clamp(lead.baseRisk + randInt(-8, 16), 5, 96),
      screened: lead.screened,
      warningFlags: lead.screened ? [...lead.warningFlags] : [],
      positiveFlags: lead.screened ? [...lead.positiveFlags] : [],
      isRegular: lead.isRegular,
      isVip: lead.isVip,
      status: 'confirmed',
      notified: false,
      review: null,
      netEarned: 0,
      commissionRate: model.commission,
      outcomeNote: '',
    };
    s.bookings.push(booking);
    s.leads = s.leads.filter((l) => l.id !== lead.id);
    if (depositNet > 0) this.earn(depositNet, `Deposit · ${lead.name}`);
    this.applyStats({ stress: -1, reputation: 0.5 });
    this.addJournal('Booking confirmed', `${lead.name} · ${dayTime(booking.day, booking.minute)} · ${LOCATIONS[booking.venueId].name} · ${money(booking.rate)}.`);
    this.manualObjectiveBookingId = booking.id;
    this.showTutorialStage(3);
    this.ui.activeTab = 'calendar';
    this.ui.syncTabs();
    this.refreshUI(true);
    this.ui.toast(
      'Booking confirmed',
      `${lead.name} is on the calendar. ${depositNet ? `${money(depositNet)} net deposit received.` : 'No deposit was received.'}`,
      'success',
      5600,
      depositNet ? 'cash' : 'success'
    );
    this.save(false);
  }

  runListingBoost() {
    if (!this.state || !this.spend(45, 'Listing boost')) return;
    this.applyStats({ visibility: 7, exposure: 2, energy: -1 });
    this.addXP('branding', 7);
    this.advanceClock(30, { render: false });
    this.generateLeads(randInt(1, 2));
    this.addJournal('Listing boost', 'Visibility increased and new inquiries were invited.');
    this.ui.toast('Listing refreshed', 'Visibility increased. New inquiries were added when demand allowed.', 'success');
    this.refreshUI(true);
    this.save(false);
  }

  runCampaign(id) {
    const c = CAMPAIGNS[id];
    if (!this.state || !c || !this.spend(c.cost, c.name)) return;
    this.applyStats({ visibility: c.visibility, exposure: c.exposure, profile: c.profile, energy: -1 });
    this.addXP('branding', 14 + c.leads * 2);
    this.advanceClock(35, { render: false });
    this.generateLeads(c.leads, { qualityBoost: c.qualityBoost });
    this.addJournal('Campaign launched', `${c.name} increased visibility by ${c.visibility}.`);
    this.ui.toast(c.name, `${c.leads} potential inquiries were targeted. Exposure increased by ${c.exposure}.`, 'success');
    this.refreshUI(true);
    this.save(false);
  }

  setBaseRate(value, commit) {
    const s = this.state;
    if (!s) return;
    const rate = clamp(Math.round(value / 25) * 25, 150, 700);
    s.baseRate = rate;
    if (commit) {
      this.addJournal('Published rate changed', `Base rate set to ${money(rate)}.`);
      this.ui.toast('Base rate updated', `New inquiries will price from ${money(rate)}.`, 'success');
      this.save(false);
    }
    this.ui.updateHUD(s);
  }

  setBrandStyle(id) {
    const s = this.state;
    if (!s || !BRANDS[id] || s.brandStyle === id) return;
    const from = BRANDS[s.brandStyle];
    const to = BRANDS[id];
    s.brandStyle = id;
    this.applyStats({ profile: -1, exposure: to.exposure - from.exposure });
    this.advanceClock(25, { render: false });
    this.addXP('branding', 6);
    this.addJournal('Positioning updated', `${to.name}: ${to.description}`);
    this.ui.toast('Positioning updated', `${to.name} will shape future pricing and review outcomes.`, 'success');
    this.refreshUI(true);
    this.save(false);
  }

  showClientRecord(id) {
    const c = this.state?.clients.find((cl) => cl.id === id);
    if (!c) return;
    this.ui.openModal({
      kicker: 'Private client record',
      title: c.name,
      body: `
        <div class="control-group">
          <div class="detail-row"><span>Status</span><strong>${c.blacklisted ? 'Blacklisted' : c.regular ? 'Regular' : 'Past client'}</strong></div>
          <div class="detail-row"><span>Completed dates</span><strong>${c.visits}</strong></div>
          <div class="detail-row"><span>Average review</span><strong>${c.averageRating ? `${c.averageRating.toFixed(1)} / 5` : 'No review'}</strong></div>
          <div class="detail-row"><span>Last date</span><strong>Day ${c.lastDay}</strong></div>
        </div>
        <div class="modal-banner ${c.blacklisted ? 'danger' : ''}">${esc(c.note || 'No special notes recorded.')}</div>
        <p>Client notes are private operational records. They affect future regular requests and screening confidence.</p>`,
      actions: [
        { label: 'Close', onClick: () => this.ui.closeModal() },
        {
          label: c.blacklisted ? 'Remove blacklist' : 'Blacklist',
          className: c.blacklisted ? 'secondary' : 'danger-action',
          onClick: () => {
            c.blacklisted = !c.blacklisted;
            if (c.blacklisted) c.regular = false;
            this.addJournal(c.blacklisted ? 'Client blacklisted' : 'Client restored', c.name);
            this.ui.closeModal();
            this.refreshUI(true);
            this.save(false);
          },
        },
      ],
    });
  }

  /* ------------------------------------------------------------ travel and locations */

  handleLocationArrival(id) {
    if (!this.started || !this.state || this.ui.isModalOpen) return;
    if (this.manualObjectiveLocation === id) {
      this.manualObjectiveLocation = null;
      this.manualObjectiveDetail = '';
    }
    this.interactLocation(id);
  }

  guideToLocation(id, detail = '') {
    if (!this.state || !LOCATIONS[id]) return;
    this.manualObjectiveLocation = id;
    this.manualObjectiveDetail = detail || LOCATIONS[id].description;
    this.manualObjectiveBookingId = null;
    this.world.moveToLocation(id);
    this.ui.setPhoneOpen(false);
    this.setPhoneFocus(false);
    this.updateObjective(true);
    const how = this.state.speed === 0 ? 'Time is paused: choose 1× or faster to start walking.' : 'Your character will route around buildings. Moving yourself overrides the route.';
    this.ui.toast(`Heading to ${LOCATIONS[id].name}`, how, 'info');
  }

  guideToSkillTraining(skillId) {
    if (!this.state || !SKILLS[skillId]) return;
    const loc = SKILLS[skillId].location;
    this.pendingTraining = skillId;
    if (this.world.isNearLocation(loc)) {
      this.interactLocation(loc);
      return;
    }
    this.guideToLocation(loc, `${SKILLS[skillId].trainingName} for ${SKILLS[skillId].name}.`);
  }

  setBookingObjective(id) {
    const b = this.findBooking(id);
    if (!b || b.status !== 'confirmed') return;
    this.manualObjectiveBookingId = b.id;
    this.manualObjectiveLocation = null;
    this.ui.setPhoneOpen(false);
    this.setPhoneFocus(false);
    this.updateObjective(true);
    const how = { keyboard: 'Press G', gamepad: 'Press X', touch: 'Tap Go' }[this.ui.source] || 'Use Go';
    this.ui.toast('Booking objective set', `${b.clientName} at ${LOCATIONS[b.venueId].name}. ${how} to walk there when ready.`, 'success');
  }

  /** New: walk to wherever the current objective points (G / X / the Go button). */
  travelToObjective() {
    if (!this.started || !this.state) return;
    if (this.state.speed === 0) {
      this.ui.toast('Time is paused', 'Choose 1× or faster to walk.', 'info');
      return;
    }
    if (!this.canControl()) return;
    const id = this.currentObjectiveLocation;
    if (!id) {
      this.ui.toast('Nothing to walk to', 'The current objective is a phone action.', 'info');
      return;
    }
    if (this.world.isNearLocation(id, 2.8)) {
      this.interactLocation(id);
      return;
    }
    this.world.moveToLocation(id);
    this.noteMovement();
    this.sound.play('step');
  }

  interactNearby() {
    if (this.nearLocation && this.canControl()) this.interactLocation(this.nearLocation);
  }

  interactLocation(id) {
    if (!this.started || !this.state || !id || !LOCATIONS[id] || this.ui.isModalOpen) return;
    if (!this.world.isNearLocation(id, 2.8)) {
      this.guideToLocation(id);
      return;
    }
    const loc = LOCATIONS[id];
    const s = this.state;
    const now = absMinute(s.day, s.minutes);
    const due = s.bookings
      .filter((b) => b.status === 'confirmed' && b.venueId === id)
      .filter((b) => {
        const d = absMinute(b.day, b.minute) - now;
        return d <= 90 && d >= -90;
      })
      .sort((a, b) => absMinute(a.day, a.minute) - absMinute(b.day, b.minute));
    const actions = this.getLocationActions(id);
    this.ui.openModal({
      kicker: loc.short,
      title: loc.name,
      body: ({ button }) => `
        <p>${esc(loc.description)}</p>
        ${
          due.length
            ? `
          <div class="modal-banner">
            <strong>Scheduled booking available</strong><br />
            ${esc(due[0].clientName)} · ${dayTime(due[0].day, due[0].minute)} · ${money(due[0].rate)}
          </div>
          <div class="location-actions">
            ${button(
              {
                label: `Start date with ${due[0].clientName}`,
                detail: 'Begin the abstracted encounter flow. Time pauses while choices are open.',
                meta: { left: clockLabel(due[0].minute), right: money(due[0].rate) },
                navDefault: true,
                onClick: () => this.tryStartBooking(due[0].id),
              },
              'location-action'
            )}
          </div>
          <h3 class="section-heading">Other actions</h3>`
            : ''
        }
        <div class="location-actions">
          ${actions
            .map((a) =>
              button(
                {
                  label: a.label,
                  detail: a.detail,
                  disabled: a.disabled,
                  meta: { left: a.cost ? money(a.cost) : 'Free', right: a.time ? hoursLabel(a.time) : 'Menu' },
                  onClick: () => this.performLocationAction(id, a),
                },
                'location-action'
              )
            )
            .join('')}
        </div>`,
      actions: [{ label: 'Leave', onClick: () => this.ui.closeModal() }],
    });
  }

  getLocationActions(id) {
    const s = this.state;
    const list = [];
    const add = (a) => list.push({ disabled: a.disabled ?? (a.cost ? s.money < a.cost : false), ...a });
    const training = (skillId) => {
      const k = s.skills[skillId];
      const cost = 45 + k.level * 25;
      return {
        id: `train-${skillId}`,
        label: SKILLS[skillId].trainingName,
        detail: k.level >= SKILL_CAP ? `${SKILLS[skillId].name} is mastered.` : `Gain ${SKILLS[skillId].name} experience. Current level: ${k.level}.`,
        cost,
        time: 120,
        custom: () => this.trainSkill(skillId),
        disabled: k.level >= SKILL_CAP || s.money < cost,
      };
    };
    const has = (actionId) => list.some((a) => a.id === actionId);
    if (this.pendingTraining && SKILLS[this.pendingTraining]?.location === id) add(training(this.pendingTraining));
    const c = s.collective;
    switch (id) {
      case 'home':
        add({ id: 'power-nap', label: 'Power nap', detail: 'Recover energy and lower stress without using the entire day.', cost: 0, time: 120, effect: () => this.applyStats({ energy: 30, stress: -7, health: 1 }), result: ['Rested', 'Energy recovered and stress decreased.'] });
        add({
          id: 'full-rest',
          label: 'Full rest',
          detail: 'Sleep, eat, and reset. Strong recovery, but eight hours pass.',
          cost: 18,
          time: 480,
          effect: () => {
            s.energy = 100;
            this.applyStats({ stress: -20, health: 7 });
          },
          result: ['Fully rested', 'Energy restored; health and stress improved.'],
        });
        add({
          id: 'plan-day',
          label: 'Plan the calendar',
          detail: 'Review routes, booking buffers, and screening notes.',
          cost: 0,
          time: 45,
          effect: () => {
            s.schedulePrep = 3;
            this.applyStats({ stress: -3 });
            this.addXP('insight', 12);
          },
          result: ['Schedule prepared', 'The next three screening or booking decisions gain a small preparation bonus.'],
        });
        add({
          id: 'wardrobe-prep',
          label: 'Presentation refresh',
          detail: 'Prepare a polished look and practical date kit.',
          cost: 65,
          time: 75,
          effect: () => {
            s.datePrep = clamp(s.datePrep + 9, 0, 24);
            this.applyStats({ profile: 5, exposure: 0.5 });
          },
          result: ['Presentation ready', 'Profile quality and next-date preparation improved.'],
        });
        break;
      case 'cafe':
        add({ id: 'meal', label: 'Have a proper meal', detail: 'Recover energy and support health between commitments.', cost: 24, time: 45, effect: () => this.applyStats({ energy: 16, health: 2, stress: -2 }), result: ['Meal finished', 'Energy and health improved.'] });
        if (!has('train-presence')) add(training('presence'));
        add({
          id: 'cafe-network',
          label: 'Professional networking',
          detail: 'Build low-pressure referrals and local venue familiarity.',
          cost: 28,
          time: 75,
          effect: () => {
            this.applyStats({ visibility: 7, reputation: 1, exposure: 1 });
            this.generateLeads(1, { qualityBoost: 8 });
            this.addXP('presence', 7);
          },
          result: ['New connections', 'Visibility increased and a potential inquiry was invited.'],
        });
        break;
      case 'studio':
        add({
          id: 'photo-session',
          label: 'Low-poly photo session',
          detail: 'Refresh profile visuals and improve conversion, with some added exposure.',
          cost: 145,
          time: 120,
          effect: () => {
            this.applyStats({ profile: 17, visibility: 14, exposure: 5, energy: -4 });
            this.addXP('branding', 22);
          },
          result: ['Profile refreshed', 'Profile quality and visibility rose; exposure also increased.'],
        });
        add({
          id: 'profile-rewrite',
          label: 'Rewrite the profile',
          detail: 'Clarify positioning, boundaries, schedule, and value proposition.',
          cost: 62,
          time: 90,
          effect: () => {
            this.applyStats({ profile: 9, visibility: 5, exposure: 1 });
            this.addXP('branding', 18);
          },
          result: ['Profile rewritten', 'Clearer messaging improved profile quality.'],
        });
        add({
          id: 'privacy-audit',
          label: 'Privacy audit',
          detail: 'Review devices, profile details, and separation between work and personal life.',
          cost: 88,
          time: 90,
          effect: () => {
            this.applyStats({ exposure: -14, compliancePressure: -6, stress: -4 });
            this.addXP('safety', 10);
          },
          result: ['Privacy tightened', 'Exposure and compliance pressure decreased.'],
        });
        if (!has('train-branding')) add(training('branding'));
        break;
      case 'clinic':
        add({ id: 'wellness', label: 'Routine wellness visit', detail: 'General health review and preventive care; all details remain abstracted.', cost: 78, time: 90, effect: () => this.applyStats({ health: 15, stress: -4, energy: 3 }), result: ['Wellness visit complete', 'Health improved and stress decreased.'] });
        add({
          id: 'counselling',
          label: 'Counselling session',
          detail: 'Reduce stress and build sustainable coping tools.',
          cost: 96,
          time: 90,
          effect: () => {
            this.applyStats({ stress: -24, health: 3 });
            this.addXP('resilience', 15);
          },
          result: ['Session complete', 'Stress decreased substantially.'],
        });
        add({ id: 'recovery-day', label: 'Structured recovery block', detail: 'A longer care session for low health, fatigue, or accumulated stress.', cost: 138, time: 240, effect: () => this.applyStats({ health: 23, energy: 27, stress: -19 }), result: ['Recovery complete', 'Health, energy, and stress improved.'] });
        break;
      case 'safety':
        add({
          id: 'safe-call',
          label: 'Set up SafeLine coverage',
          detail: 'Add check-ins and an escalation contact for the next three bookings.',
          cost: 48,
          time: 60,
          effect: () => {
            s.safeCallBookings = Math.max(s.safeCallBookings, 3);
            this.applyStats({ safetyBase: 5, stress: -2 });
            this.addXP('safety', 10);
          },
          result: ['SafeLine active', 'The next three bookings receive an additional safety modifier.'],
        });
        if (!has('train-safety')) add(training('safety'));
        add({ id: 'protection-consult', label: 'Review protection options', detail: 'Compare independent, protected, and agency operating structures.', cost: 0, time: 0, custom: () => this.openModelSelection() });
        break;
      case 'agency':
        add({ id: 'model-review', label: 'Review operating model', detail: 'Compare autonomy, commission, lead quality, overhead, and safety support.', cost: 0, time: 0, custom: () => this.openModelSelection() });
        if (!has('train-negotiation')) add(training('negotiation'));
        add({
          id: 'business-review',
          label: 'Business review',
          detail: 'Audit pricing, conversion, costs, and calendar capacity.',
          cost: 84,
          time: 90,
          effect: () => {
            this.applyStats({ profile: 4, visibility: 4, compliancePressure: -4, stress: -2 });
            this.addXP('negotiation', 12);
            this.addXP('branding', 12);
          },
          result: ['Business plan updated', 'Pricing, positioning, and compliance pressure improved.'],
        });
        add({ id: 'compliance-review', label: 'Compliance consultation', detail: 'Clarify local rules and reduce accumulated scrutiny without tactical evasion.', cost: 92, time: 90, effect: () => this.applyStats({ compliancePressure: -18, exposure: -6, stress: -3 }), result: ['Consultation complete', 'Compliance pressure and exposure decreased.'] });
        break;
      case 'lounge':
        add({
          id: 'date-prep',
          label: 'Prepare for a date',
          detail: 'Review client notes, boundaries, venue timing, and conversation ideas.',
          cost: 32,
          time: 45,
          effect: () => {
            s.datePrep = clamp(s.datePrep + 12, 0, 24);
            this.applyStats({ stress: -3, energy: -1 });
            this.addXP('insight', 5);
          },
          result: ['Date preparation complete', 'The next encounter receives a meaningful preparation bonus.'],
        });
        add({
          id: 'lounge-network',
          label: 'High-end networking',
          detail: 'Seek premium referrals at the cost of higher visibility and exposure.',
          cost: 58,
          time: 90,
          effect: () => {
            this.applyStats({ visibility: 11, reputation: 2, exposure: 4, energy: -3 });
            this.generateLeads(1, { qualityBoost: 12 });
            this.addXP('presence', 9);
          },
          result: ['Premium network expanded', 'Reputation and visibility increased.'],
        });
        add({ id: 'lounge-unwind', label: 'Unwind quietly', detail: 'Take a low-key break in a comfortable public space.', cost: 36, time: 90, effect: () => this.applyStats({ stress: -10, energy: 6 }), result: ['Break complete', 'Stress decreased and energy improved.'] });
        break;
      case 'gym':
        if (!has('train-resilience')) add(training('resilience'));
        add({
          id: 'workout',
          label: 'Focused workout',
          detail: 'Trade some immediate energy for long-term health and resilience experience.',
          cost: 34,
          time: 90,
          effect: () => {
            this.applyStats({ energy: -9, health: 7, stress: -5 });
            this.addXP('resilience', 18);
          },
          result: ['Workout complete', 'Health and resilience improved.'],
        });
        add({ id: 'recovery-session', label: 'Recovery session', detail: 'Mobility, hydration, and quiet recovery between bookings.', cost: 52, time: 60, effect: () => this.applyStats({ energy: 17, health: 3, stress: -7 }), result: ['Recovery complete', 'Energy and stress improved.'] });
        break;
      case 'park':
        add({
          id: 'decompress',
          label: 'Decompress',
          detail: 'Take a quiet walk and step away from the phone.',
          cost: 0,
          time: 60,
          effect: () => {
            this.applyStats({ stress: -12, energy: 3 });
            this.addXP('resilience', 8);
          },
          result: ['Mind cleared', 'Stress decreased.'],
        });
        add({ id: 'trusted-call', label: 'Call someone you trust', detail: 'Maintain personal connections and reduce the strain of a dual life.', cost: 0, time: 45, effect: () => this.applyStats({ stress: -8, health: 1 }), result: ['Connection restored', 'Personal support reduced stress.'] });
        add({
          id: 'journal',
          label: 'Journal and review notes',
          detail: 'Reflect on patterns, boundaries, and client reliability.',
          cost: 0,
          time: 40,
          effect: () => {
            this.applyStats({ stress: -4, exposure: -1 });
            this.addXP('insight', 15);
          },
          result: ['Notes reviewed', 'Insight increased and stress decreased.'],
        });
        if (!has('train-insight')) add(training('insight'));
        break;
      case 'transit':
        add({ id: 'region-move', label: 'Relocate to another region', detail: 'Compare market conditions and rebuild the client pipeline elsewhere.', cost: 0, time: 0, custom: () => this.openRegionSelection() });
        add({
          id: 'city-tour',
          label: 'Review city routes',
          detail: 'Learn venue routes and reduce travel stress for the next three bookings.',
          cost: 18,
          time: 60,
          effect: () => {
            s.schedulePrep = 3;
            this.applyStats({ stress: -2, safetyBase: 2 });
            this.addXP('insight', 8);
          },
          result: ['Routes reviewed', 'Schedule preparation and safety readiness improved.'],
        });
        break;
      case 'hotel':
        add({ id: 'wait-30', label: 'Wait in the lobby', detail: 'Pass thirty minutes while remaining near scheduled hotel bookings.', cost: 12, time: 30, effect: () => this.applyStats({ energy: 2, stress: -1 }), result: ['Wait complete', 'Thirty minutes passed.'] });
        add({
          id: 'quiet-workspace',
          label: 'Use the quiet workspace',
          detail: 'Review messages and calendar logistics away from home.',
          cost: 28,
          time: 60,
          effect: () => {
            s.schedulePrep = Math.max(s.schedulePrep, 2);
            this.applyStats({ stress: -2 });
            this.addXP('insight', 7);
          },
          result: ['Logistics reviewed', 'Calendar preparation improved.'],
        });
        break;
      case 'gallery': {
        // New venue.
        const evening = s.minutes >= 1020 && s.minutes <= 1320;
        add({
          id: 'exhibition',
          label: 'Tour the new exhibition',
          detail: 'A quiet hour with the new collection: calmer nerves and fresh conversation material.',
          cost: 16,
          time: 60,
          effect: () => {
            this.applyStats({ stress: -8, energy: 2 });
            this.addXP('presence', 8);
            this.addXP('insight', 4);
          },
          result: ['Exhibition toured', 'Stress eased and you have fresh conversation topics.'],
        });
        add({
          id: 'opening-night',
          label: 'Opening-night networking',
          detail: evening ? 'Meet collectors and culture fans. Invites a culture-focused inquiry.' : 'Opening nights run from 17:00 to 22:00.',
          cost: 34,
          time: 90,
          disabled: !evening || s.money < 34,
          effect: () => {
            this.applyStats({ visibility: 8, reputation: 1.5, exposure: 1, energy: -3 });
            this.generateLeads(1, { qualityBoost: 10, archetypeId: chance(0.5) ? 'arts-patron' : 'theatre-lover' });
            this.addXP('presence', 8);
          },
          result: ['Opening night', 'Visibility and reputation rose, and a culture fan asked about a booking.'],
        });
        add({
          id: 'sketch-room',
          label: 'Sketch in the quiet room',
          detail: 'A free creative break that helps you reset between commitments.',
          cost: 0,
          time: 45,
          effect: () => {
            this.applyStats({ stress: -5 });
            this.addXP('resilience', 6);
            this.addXP('branding', 4);
          },
          result: ['Creative break', 'A calmer head and a few fresh profile ideas.'],
        });
        add({ id: 'gallery-cafe', label: 'Wait in the gallery café', detail: 'Pass thirty minutes near scheduled gallery bookings.', cost: 8, time: 30, effect: () => this.applyStats({ energy: 2, stress: -1 }), result: ['Wait complete', 'Thirty minutes passed.'] });
        break;
      }
      case 'collective': {
        // New peer-support hub.
        if (!c.member) {
          add({
            id: 'join-collective',
            label: 'Join the collective',
            detail: `Peer alerts on risky inquiries, a check-in network, and cheaper workshops. Dues ${money(COLLECTIVE_DUES)} a day.`,
            cost: 60,
            time: 30,
            effect: () => {
              c.member = true;
              c.joinedDay = s.day;
              c.standing = Math.max(c.standing, 10);
              this.applyStats({ stress: -2, safetyBase: 2 });
            },
            result: ['Welcome to Harborlight', 'Peer alerts now flag risky inquiries before you screen them.'],
          });
        }
        add({
          id: 'support-circle',
          label: 'Peer support circle',
          detail: 'Talk shop and decompress with people who understand the work.',
          cost: 0,
          time: 60,
          effect: () => {
            this.applyStats({ stress: c.member ? -12 : -9, energy: 2 });
            this.addXP('resilience', 10);
            if (c.member) c.standing = clamp(c.standing + 3, 0, 100);
          },
          result: ['Support circle', 'Shared experience lowered stress.'],
        });
        const workshopCost = c.member ? 25 : 40;
        add({
          id: 'rights-workshop',
          label: 'Rights & safety workshop',
          detail: `Local rules, contracts, and de-escalation basics.${c.member ? ' Member price.' : ''}`,
          cost: workshopCost,
          time: 90,
          effect: () => {
            this.applyStats({ compliancePressure: -10, safetyBase: 3 });
            this.addXP('safety', 12);
            this.addXP('negotiation', 6);
          },
          result: ['Workshop complete', 'Compliance pressure fell and safety readiness rose.'],
        });
        if (c.member) {
          const unreported = s.clients.filter((cl) => cl.blacklisted && !c.reportedClientIds.includes(cl.id));
          add({
            id: 'share-report',
            label: 'Share a safety report',
            detail: unreported.length ? `Warn other members about ${unreported.length} blacklisted ${unreported.length === 1 ? 'client' : 'clients'}.` : 'No new blacklisted clients to report.',
            cost: 0,
            time: 30,
            disabled: !unreported.length,
            effect: () => {
              for (const cl of unreported) c.reportedClientIds.push(cl.id);
              c.standing = clamp(c.standing + 8 * unreported.length, 0, 100);
              this.applyStats({ safetyBase: 2, stress: -2 });
              this.addXP('insight', 8);
            },
            result: ['Report shared', 'Other members can now spot the pattern early. Your standing grew.'],
          });
          add({
            id: 'mentor',
            label: 'Mentor a newcomer',
            detail: s.reputation >= 25 ? 'Share screening and pricing habits with someone starting out.' : 'Needs 25 reputation.',
            cost: 0,
            time: 90,
            disabled: s.reputation < 25,
            effect: () => {
              c.mentored += 1;
              c.standing = clamp(c.standing + 6, 0, 100);
              this.applyStats({ reputation: 1.5, stress: -3, energy: -5 });
              this.addXP('presence', 12);
            },
            result: ['Mentoring session', 'Reputation and standing grew, and the newcomer left with a plan.'],
          });
          add({ id: 'leave-collective', label: 'Pause membership', detail: 'Stop the daily dues. Peer alerts stop until you rejoin.', cost: 0, time: 0, custom: () => this.leaveCollective() });
        }
        break;
      }
      default:
        break;
    }
    const seen = new Set();
    return list.filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)));
  }

  leaveCollective() {
    const s = this.state;
    if (!s?.collective.member) return;
    s.collective.member = false;
    this.ui.closeModal();
    this.addJournal('Collective membership paused', 'Daily dues stopped.');
    this.ui.toast('Membership paused', 'Harborlight dues stopped. You can rejoin at any time.', 'info');
    this.refreshUI(true);
    this.save(false);
  }

  performLocationAction(locId, action) {
    const s = this.state;
    if (!s || action.disabled) return;
    if (action.custom) {
      action.custom();
      return;
    }
    const clash = action.time && !action.confirmed ? this.findTimeConflict(action.time, locId) : null;
    if (clash) {
      this.confirmTimeConflict(
        clash,
        action.time,
        () => this.performLocationAction(locId, { ...action, confirmed: true }),
        () => this.interactLocation(locId)
      );
      return;
    }
    if (!this.spend(action.cost || 0, `${LOCATIONS[locId].name} · ${action.label}`)) return;
    this.ui.closeModal();
    this.applyStats({ energy: action.time > 180 ? -1 : 0 });
    this.advanceClock(action.time || 0, { render: false });
    action.effect?.();
    const [title, detail] = action.result || [action.label, 'Action completed.'];
    this.addJournal(title, detail);
    this.ui.toast(title, detail, 'success');
    if (this.pendingTraining && action.id === `train-${this.pendingTraining}`) this.pendingTraining = null;
    this.refreshUI(true);
    this.save(false);
  }

  trainSkill(skillId, confirmed = false) {
    const s = this.state;
    if (!s || !SKILLS[skillId]) return;
    const skill = SKILLS[skillId];
    const k = s.skills[skillId];
    if (k.level >= SKILL_CAP) {
      this.ui.toast('Skill mastered', `${skill.name} is already at the cap.`, 'info');
      return;
    }
    if (!this.world.isNearLocation(skill.location, 2.8)) {
      this.ui.closeModal();
      this.guideToSkillTraining(skillId);
      return;
    }
    const clash = confirmed ? null : this.findTimeConflict(120, skill.location);
    if (clash) {
      this.confirmTimeConflict(clash, 120, () => this.trainSkill(skillId, true), () => this.interactLocation(skill.location));
      return;
    }
    const cost = 45 + k.level * 25;
    if (!this.spend(cost, `${skill.name} training`)) return;
    this.ui.closeModal();
    this.advanceClock(120, { render: false });
    this.applyStats({ energy: -5, stress: skillId === 'resilience' ? -5 : 1, health: skillId === 'resilience' ? 2 : 0 });
    this.addXP(skillId, 62);
    this.pendingTraining = null;
    this.addJournal(`${skill.name} training`, `${skill.trainingName} completed at ${LOCATIONS[skill.location].name}.`);
    this.ui.toast('Training complete', `${skill.name} gained 62 XP.`, 'success');
    this.refreshUI(true);
    this.save(false);
  }

  openModelSelection() {
    const s = this.state;
    if (!s) return;
    const options = Object.entries(MODELS).map(([id, model]) => ({ id, model, setup: id === 'protected' ? 125 : id === 'agency' ? 90 : 0, current: s.model === id }));
    const back = this.nearLocation && ['agency', 'safety'].includes(this.nearLocation) ? this.nearLocation : 'agency';
    this.ui.openModal({
      kicker: 'Operating structure',
      title: 'Choose how to work',
      body: ({ choiceGrid }) => `
        <p>Operating models change commission, daily overhead, screening support, safety, visibility, and lead quality. Every model remains playable.</p>
        ${choiceGrid(
          options.map(({ id, model, setup, current }) => ({
            label: `${model.name}${current ? ' · Current' : ''}`,
            detail: model.description,
            disabled: current || s.money < setup,
            meta: { left: setup ? `${money(setup)} setup` : 'No setup fee', right: `${Math.round(model.commission * 100)}% cut${model.dailyRetainer ? ` · ${money(model.dailyRetainer)}/day` : ''}` },
            onClick: () => this.switchOperatingModel(id, setup),
          }))
        )}`,
      actions: [
        {
          label: 'Back',
          onClick: () => {
            this.ui.closeModal();
            this.interactLocation(back);
          },
        },
      ],
    });
  }

  switchOperatingModel(id, setup) {
    const s = this.state;
    if (!s || !MODELS[id] || s.model === id || !this.spend(setup, `${MODELS[id].name} setup`)) return;
    const from = MODELS[s.model];
    const to = MODELS[id];
    this.ui.closeModal();
    this.advanceClock(90, { render: false });
    s.model = id;
    if (id === 'protected') s.safeCallBookings = Math.max(s.safeCallBookings, 3);
    this.applyStats({ visibility: to.visibility - from.visibility, safetyBase: (to.safety - from.safety) * 0.18, stress: id === 'independent' ? 2 : -3 });
    this.addJournal('Operating model changed', `${from.name} → ${to.name}.`);
    this.ui.toast('Operating model changed', `${to.name}: ${to.description}`, 'success', 5800);
    this.refreshUI(true);
    this.save(false);
  }

  openRegionSelection() {
    const s = this.state;
    if (!s) return;
    const confirmed = s.bookings.filter((b) => b.status === 'confirmed');
    const blocked = confirmed.length > 0;
    this.ui.openModal({
      kicker: 'Regional market',
      title: 'Relocate your career',
      body: ({ choiceGrid }) => `
        <p>Relocation takes six hours, reduces local visibility, clears active leads, and creates a new regional pipeline.</p>
        ${blocked ? `<div class="modal-banner warning">Relocation is unavailable while ${confirmed.length} confirmed ${confirmed.length === 1 ? 'booking is' : 'bookings are'} on the calendar. Complete or cancel them first.</div>` : ''}
        ${choiceGrid(
          Object.entries(REGIONS).map(([id, r]) => ({
            label: `${r.name}${s.region === id ? ' · Current' : ''}`,
            detail: `${r.policy}. ${r.description}`,
            disabled: blocked || s.region === id || s.money < r.moveCost,
            meta: { left: money(r.moveCost), right: `${Math.round(r.rateMultiplier * 100)}% fee index` },
            onClick: () => this.switchRegion(id),
          }))
        )}`,
      actions: [
        {
          label: 'Back',
          onClick: () => {
            this.ui.closeModal();
            this.interactLocation('transit');
          },
        },
      ],
    });
  }

  switchRegion(id) {
    const s = this.state;
    if (!s || !REGIONS[id] || s.region === id || s.bookings.some((b) => b.status === 'confirmed')) return;
    const to = REGIONS[id];
    if (!this.spend(to.moveCost, `Relocation to ${to.name}`)) return;
    const from = REGIONS[s.region];
    this.ui.closeModal();
    this.advanceClock(360, { render: false });
    s.region = id;
    s.leads = [];
    this.applyStats({ visibility: -Math.max(10, s.visibility * 0.42), reputation: -2, exposure: -7, stress: 5 });
    s.visibility = Math.max(16, s.visibility);
    this.world.applyRegion(id);
    this.world.setPlayerPosition(LOCATIONS.transit.entry.x, LOCATIONS.transit.entry.z);
    this.generateLeads(4, { qualityBoost: 4 });
    this.manualObjectiveLocation = null;
    this.manualObjectiveBookingId = null;
    this.addJournal('Region changed', `${from.name} → ${to.name}. The local client pipeline was rebuilt.`);
    this.ui.toast(`Moved to ${to.name}`, `${to.policy}. Rates, demand, overhead, exposure, and safety conditions changed.`, 'success', 6500);
    this.refreshUI(true);
    this.save(false);
  }

  cancelBooking(id) {
    const b = this.findBooking(id);
    if (!b || b.status !== 'confirmed') return;
    const s = this.state;
    const short = (absMinute(b.day, b.minute) - absMinute(s.day, s.minutes)) / 60 < 12;
    const note = short
      ? 'Cancelling within twelve hours lowers reputation and increases stress.'
      : 'The deposit will be refunded. There is no major reputation penalty with adequate notice.';
    this.ui.openModal({
      kicker: 'Calendar change',
      title: `Cancel ${b.clientName}?`,
      body: `
        <div class="modal-banner ${short ? 'warning' : ''}">${esc(note)}</div>
        <div class="control-group">
          <div class="detail-row"><span>Booking</span><strong>${dayTime(b.day, b.minute)}</strong></div>
          <div class="detail-row"><span>Venue</span><strong>${esc(LOCATIONS[b.venueId].name)}</strong></div>
          <div class="detail-row"><span>Deposit refund</span><strong>${money(b.depositNet)}</strong></div>
        </div>`,
      actions: [
        { label: 'Keep booking', navDefault: true, onClick: () => this.ui.closeModal() },
        { label: 'Cancel booking', className: 'danger-action', onClick: () => this.confirmBookingCancellation(b.id, short) },
      ],
    });
  }

  confirmBookingCancellation(id, short) {
    const b = this.findBooking(id);
    const s = this.state;
    if (!b || b.status !== 'confirmed') return;
    this.ui.closeModal();
    b.status = 'cancelled';
    b.outcomeNote = 'Cancelled by the player before the scheduled date.';
    if (b.depositNet > 0) {
      s.money -= b.depositNet;
      s.totalEarned = Math.max(0, s.totalEarned - b.depositNet);
      this.recordTransaction(-b.depositNet, `Deposit refund · ${b.clientName}`);
    }
    this.applyStats({ reputation: short ? -4 : -0.5, stress: short ? 6 : 1, visibility: short ? -1 : 0 });
    this.addJournal('Booking cancelled', `${b.clientName} · ${dayTime(b.day, b.minute)}.`);
    if (this.manualObjectiveBookingId === b.id) this.manualObjectiveBookingId = null;
    this.ui.toast('Booking cancelled', `${money(b.depositNet)} was refunded.${short ? ' Reputation decreased.' : ''}`, short ? 'warning' : 'info');
    this.refreshUI(true);
    this.save(false);
  }

  /* ------------------------------------------------------------ the date */

  tryStartBooking(id) {
    const b = this.findBooking(id);
    if (!b || b.status !== 'confirmed') return;
    if (!this.world.isNearLocation(b.venueId, 2.8)) {
      this.ui.closeModal();
      this.guideToLocation(b.venueId, `Scheduled date with ${b.clientName}.`);
      this.manualObjectiveBookingId = b.id;
      this.updateObjective(true);
      return;
    }
    const s = this.state;
    const now = absMinute(s.day, s.minutes);
    const start = absMinute(b.day, b.minute);
    const until = start - now;
    if (until > 75) {
      const wait = Math.max(15, Math.round(until - 30));
      this.ui.openModal({
        kicker: 'Arrived early',
        title: `${b.clientName} is not due yet`,
        body: `<p>The booking begins ${relativeTime(start, now)}. Waiting keeps your character at ${esc(LOCATIONS[b.venueId].name)} and advances the clock.</p>`,
        actions: [
          { label: 'Leave', onClick: () => this.ui.closeModal() },
          {
            label: `Wait ${wait}m`,
            primary: true,
            onClick: () => {
              this.ui.closeModal();
              this.advanceClock(wait, { render: false });
              this.tryStartBooking(b.id);
            },
          },
        ],
      });
      return;
    }
    if (until < -90) {
      this.ui.closeModal();
      this.processBookings();
      return;
    }
    this.beginEncounter(b);
  }

  performSkillCheck(skillId, difficulty, bonus = 0) {
    if (!skillId) return { success: true, total: 100, margin: 20 };
    const s = this.state;
    const level = s.skills[skillId].level;
    const tired = Math.max(0, 52 - s.energy) * 0.22;
    const stressed = s.stress * 0.1;
    const unwell = Math.max(0, 60 - s.health) * 0.16;
    const prep = s.datePrep + (s.schedulePrep > 0 ? 3 : 0);
    const support = skillId === 'safety' ? (s.safeCallBookings > 0 ? 7 : 0) + MODELS[s.model].safety * 0.16 : 0;
    const total = 37 + Math.random() * 43 + level * 8.2 + prep + support + bonus - tired - stressed - unwell;
    return { success: total >= difficulty, total, margin: total - difficulty };
  }

  beginEncounter(b) {
    const s = this.state;
    const now = absMinute(s.day, s.minutes);
    const start = absMinute(b.day, b.minute);
    if (now < start) this.advanceClock(start - now, { render: false });
    const late = Math.max(0, now - start);
    const noShow = clamp(0.014 + b.risk / 2600 - (b.isRegular ? 0.012 : 0) - b.positiveFlags.length * 0.003, 0.005, 0.06);
    if (chance(noShow)) {
      b.status = 'cancelled';
      b.outcomeNote = 'Client did not arrive. The deposit was retained under the cancellation policy.';
      this.applyStats({ stress: 4, energy: -1, visibility: -0.5 });
      this.advanceClock(30, { render: false });
      this.addJournal('Client no-show', `${b.clientName} did not arrive at ${LOCATIONS[b.venueId].name}.`);
      this.ui.openModal({
        kicker: 'Booking outcome',
        title: 'Client no-show',
        body: `
          <div class="modal-banner warning">${esc(b.clientName)} did not arrive during the agreed window. The net deposit of ${money(b.depositNet)} was retained.</div>
          <p>No reputation penalty was applied. The reliability note was added to the client record.</p>`,
        actions: [{ label: 'Close', primary: true, onClick: () => this.ui.closeModal() }],
      });
      this.upsertClient(b, null, false, false, 'No-show recorded; require stronger confirmation for future requests.');
      if (this.manualObjectiveBookingId === b.id) this.manualObjectiveBookingId = null;
      this.refreshUI(true);
      this.save(false);
      return;
    }
    this.activeEncounter = {
      bookingId: b.id,
      score: clamp(52 + s.datePrep * 0.45 - late / 7, 32, 76),
      successes: 0,
      failures: 0,
      lateMinutes: late,
      feedback: '',
      feedbackType: 'info',
      scenarioId: null,
      regularPitch: false,
      askedReview: false,
      safeExit: false,
      noBlacklist: false,
      extensionMinutes: 0,
      extraFee: 0,
      notes: [],
    };
    this.showEncounterOpening(b);
  }

  showEncounterOpening(b) {
    const s = this.state;
    const risk = riskLabel(b.risk);
    this.ui.openModal({
      kicker: 'Date · Arrival',
      title: `Meet ${b.clientName}`,
      closable: false,
      body: ({ choiceGrid }) => `
        <div class="encounter-header">
          <span class="encounter-icon">${esc(b.clientName.slice(0, 2).toUpperCase())}</span>
          <span><strong>${esc(LOCATIONS[b.venueId].name)}</strong><small>${hoursLabel(b.duration)} plan · ${money(b.rate)} · ${risk.label} screened risk</small></span>
        </div>
        <p>All intimate details are abstracted. The encounter focuses on communication, boundaries, logistics, safety, and professional social skills.</p>
        ${choiceGrid([
          {
            label: 'Confirm the plan and boundaries',
            detail: 'Use Insight to make sure expectations still match the agreement.',
            meta: { left: 'Insight', right: 'Reliable start' },
            onClick: () => this.resolveEncounterChoice({ skill: 'insight', difficulty: 64, success: 11, fail: -2, note: 'Plan reconfirmed at arrival.' }, 'scenario'),
          },
          {
            label: 'Begin with a warm introduction',
            detail: 'Use Presence to create a comfortable, professional atmosphere.',
            meta: { left: 'Presence', right: 'Review bonus' },
            onClick: () => this.resolveEncounterChoice({ skill: 'presence', difficulty: 62, success: 11, fail: -2, note: 'Warm rapport established.' }, 'scenario'),
          },
          {
            label: 'Complete the SafeLine check-in',
            detail: 'Use Safety and support tools before settling into the date.',
            meta: { left: 'Safety', right: s.safeCallBookings > 0 ? 'Coverage active' : 'Self-managed' },
            onClick: () =>
              this.resolveEncounterChoice(
                { skill: 'safety', difficulty: this.state.safeCallBookings > 0 ? 57 : 67, success: 12, fail: -1, note: 'Safety check-in completed.' },
                'scenario'
              ),
          },
        ])}`,
      actions: [],
    });
  }

  chooseEncounterScenario(b) {
    const s = this.state;
    const flags = b.warningFlags || [];
    if (flags.some((f) => SERIOUS_FLAGS.includes(f)) || b.risk >= 73) return 'boundary';
    if (flags.some((f) => f.includes('Privacy'))) return 'privacy';
    if (flags.includes('Avoids deposit discussion') && chance(0.5)) return 'payment';
    if (b.archetypeId === 'last-minute') return chance(0.55) ? 'delay' : 'extension';
    const pool = ['conversation', 'conversation', 'extension', 'privacy', 'delay', 'venue', 'weather', 'fatigue', 'payment', 'acquaintance'];
    if (b.archetypeId === 'conference-guest' || b.archetypeId === 'returning-visitor') pool.push('fatigue');
    if (s.exposure > 40) pool.push('acquaintance');
    if (b.risk > 52) pool.push('boundary', 'boundary');
    return pick(pool);
  }

  resolveEncounterChoice(choice, next) {
    const enc = this.activeEncounter;
    const b = enc ? this.findBooking(enc.bookingId) : null;
    if (!enc || !b) return;
    if (choice.safeExit) {
      enc.safeExit = true;
      enc.noBlacklist = choice.blacklist === false;
      enc.notes.push(enc.noBlacklist ? 'Closed early after a payment problem.' : 'Used a safe exit after a boundary or privacy concern.');
      this.finishEncounter(true);
      return;
    }
    const check = choice.automatic ? { success: true, total: 100, margin: 20 } : this.performSkillCheck(choice.skill, choice.difficulty, choice.bonus || 0);
    enc.score += check.success ? choice.success : choice.fail;
    enc.successes += check.success ? 1 : 0;
    enc.failures += check.success ? 0 : 1;
    if (choice.skill) this.addXP(choice.skill, check.success ? 13 : 8);
    if (!check.success && choice.failStats) this.applyStats(choice.failStats);
    if (choice.note) enc.notes.push(choice.note);
    enc.feedback = check.success
      ? `${choice.skill ? SKILLS[choice.skill].name : 'Clear communication'} worked. The date remains aligned with the plan.`
      : 'The approach was less effective than intended, but the agreed boundary and exit options remain available.';
    enc.feedbackType = check.success ? 'info' : 'warning';
    if (!choice.automatic) {
      this.sound.play(check.success ? 'success' : 'warning');
      if (!check.success) this.input.rumble(0.3, 110);
    }
    if (choice.extension && check.success) {
      const fee = Math.max(25, Math.round((this.state.baseRate * (choice.extension / 120)) / 25) * 25);
      b.duration += choice.extension;
      b.rate += fee;
      enc.extensionMinutes += choice.extension;
      enc.extraFee += fee;
      enc.notes.push(`Paid extension added: ${choice.extension} minutes for ${money(fee)}.`);
    }
    if (choice.regularPitch && check.success) enc.regularPitch = true;
    if (choice.askedReview) enc.askedReview = true;
    if (next === 'scenario') {
      enc.scenarioId = this.chooseEncounterScenario(b);
      this.showEncounterScenario(b);
    } else if (next === 'closing') {
      this.showEncounterClosing(b);
    } else if (next === 'finish') {
      this.finishEncounter(false);
    }
  }

  showEncounterScenario() {
    const enc = this.activeEncounter;
    if (!enc) return;
    const sc = SCENARIOS[enc.scenarioId] || SCENARIOS.conversation;
    this.ui.openModal({
      kicker: 'Date · In progress',
      title: sc.title,
      closable: false,
      body: ({ choiceGrid }) => `
        ${enc.feedback ? `<div class="modal-banner ${enc.feedbackType === 'warning' ? 'warning' : ''}">${esc(enc.feedback)}</div>` : ''}
        <p>${esc(sc.copy)}</p>
        ${choiceGrid(
          sc.choices.map((a) => ({
            label: a.label,
            detail: a.detail,
            meta: {
              left: a.skill ? SKILLS[a.skill].name : 'No check',
              right: a.safeExit ? (a.blacklist === false ? 'Close early' : 'Safe exit') : a.extension ? `+${a.extension}m` : 'Continue',
            },
            onClick: () => this.resolveEncounterChoice(a, 'closing'),
          }))
        )}`,
      actions: [],
    });
  }

  showEncounterClosing() {
    const enc = this.activeEncounter;
    if (!enc) return;
    this.ui.openModal({
      kicker: 'Date · Closing',
      title: 'Finish professionally',
      closable: false,
      body: ({ choiceGrid }) => `
        ${enc.feedback ? `<div class="modal-banner ${enc.feedbackType === 'warning' ? 'warning' : ''}">${esc(enc.feedback)}</div>` : ''}
        <p>The date is reaching its agreed end. Choose how to close, handle feedback, and set expectations for future contact.</p>
        ${choiceGrid([
          {
            label: 'Close warmly and on time',
            detail: 'Use Presence to leave a clear, positive final impression.',
            meta: { left: 'Presence', right: 'Review quality' },
            onClick: () => this.resolveEncounterChoice({ skill: 'presence', difficulty: 64, success: 10, fail: -2, note: 'Professional close completed.' }, 'finish'),
          },
          {
            label: 'Request a verified private review',
            detail: 'Use Branding to convert the date into reputation, with added exposure.',
            meta: { left: 'Branding', right: '+Exposure' },
            onClick: () => {
              this.applyStats({ exposure: 2 });
              this.resolveEncounterChoice({ skill: 'branding', difficulty: 68, success: 10, fail: -2, askedReview: true, note: 'Private review requested.' }, 'finish');
            },
          },
          {
            label: 'Discuss a future regular arrangement',
            detail: 'Use Negotiation to set clear terms for repeat bookings.',
            meta: { left: 'Negotiation', right: 'Regular chance' },
            onClick: () => this.resolveEncounterChoice({ skill: 'negotiation', difficulty: 72, success: 9, fail: -2, regularPitch: true, note: 'Future booking terms discussed.' }, 'finish'),
          },
          {
            label: 'Keep the close simple',
            detail: 'Confirm payment, end on time, and avoid additional exposure.',
            meta: { left: 'No check', right: 'Low exposure' },
            onClick: () => this.resolveEncounterChoice({ skill: null, automatic: true, success: 6, fail: 0, note: 'Simple professional close.' }, 'finish'),
          },
        ])}`,
      actions: [],
    });
  }

  finishEncounter(early) {
    const enc = this.activeEncounter;
    const b = enc ? this.findBooking(enc.bookingId) : null;
    if (!enc || !b) return;
    const s = this.state;
    const commission = Number.isFinite(b.commissionRate) ? b.commissionRate : MODELS[s.model].commission;
    if (early) {
      const blacklist = !enc.noBlacklist;
      b.status = 'completed';
      b.safeExit = true;
      b.netEarned = b.depositNet;
      b.outcomeNote = blacklist ? 'Date ended early under the stated boundary and safety policy.' : 'Date closed early after a payment problem; the deposit was kept.';
      this.applyStats({ reputation: 0.5, stress: blacklist ? 5 : 3, energy: -5, safetyBase: 1 });
      this.addXP('safety', blacklist ? 20 : 10);
      if (s.safeCallBookings > 0) s.safeCallBookings -= 1;
      s.datePrep = 0;
      if (s.schedulePrep > 0) s.schedulePrep -= 1;
      this.advanceClock(45, { render: false });
      this.upsertClient(
        b,
        null,
        false,
        blacklist,
        blacklist ? 'Boundary concern recorded; client was blacklisted after a safe exit.' : 'Payment problem at the close; require the full deposit next time.'
      );
      this.addJournal(blacklist ? 'Safe exit' : 'Closed early', `${b.clientName} · ${LOCATIONS[b.venueId].name}. No reputation penalty applied.`);
      this.activeEncounter = null;
      if (this.manualObjectiveBookingId === b.id) this.manualObjectiveBookingId = null;
      this.ui.openModal({
        kicker: 'Date outcome',
        title: blacklist ? 'Safe exit completed' : 'Date closed early',
        closable: false,
        body: `
          <div class="modal-banner">${
            blacklist
              ? 'You ended the date when the agreement was not respected. Safety and boundary enforcement do not reduce reputation.'
              : 'You closed the date calmly when the payment could not be settled. The deposit covers your time.'
          }</div>
          <div class="outcome-grid">
            <div class="outcome-item"><span>Net retained</span><strong>${money(b.depositNet)}</strong></div>
            <div class="outcome-item"><span>Safety XP</span><strong>+${blacklist ? 20 : 10}</strong></div>
            <div class="outcome-item"><span>Reputation</span><strong>Stable</strong></div>
          </div>
          <p>${
            blacklist
              ? 'The client record was marked for review and blacklisted. You can change that later from Business → Client notes.'
              : 'A note was added to the client record so the next booking asks for the full deposit.'
          }</p>`,
        actions: [{ label: 'Close', primary: true, onClick: () => this.ui.closeModal() }],
      });
      this.refreshUI(true);
      this.save(false);
      return;
    }

    const brand = BRANDS[s.brandStyle];
    const score = clamp(enc.score + brand.reviewBonus + enc.successes * 1.5 - enc.failures, 20, 100);
    const stars = score >= 84 ? 5 : score >= 68 ? 4 : score >= 52 ? 3 : score >= 40 ? 2 : 1;
    const tipRate = stars === 5 ? 0.12 + Math.random() * 0.12 : stars === 4 ? 0.05 + Math.random() * 0.08 : stars === 3 ? Math.random() * 0.04 : 0;
    const tip = Math.round((b.rate * tipRate) / 5) * 5;
    const gross = b.rate + tip;
    const net = Math.round(gross * (1 - commission));
    const balance = Math.max(0, net - b.depositNet);
    if (balance > 0) this.earn(balance, `Booking payment · ${b.clientName}`);
    const region = REGIONS[s.region];
    const repDelta = (stars === 5 ? 4 : stars === 4 ? 2.2 : stars === 3 ? 0.3 : stars === 2 ? -2.5 : -5) * region.reputationFactor;
    const stress = clamp(b.risk / 14 - s.skills.resilience.level * 1.15 - score / 28, -5, 13);
    const energyCost = (b.duration / 60) * 6.4;
    const exposure = (stars >= 5 ? 1.5 : 0.4) * region.exposureFactor + (enc.askedReview ? 1.5 : 0);
    b.status = 'completed';
    b.review = stars;
    b.netEarned = net;
    b.tipGross = tip;
    b.finalScore = Math.round(score);
    b.outcomeNote = `${stars}-star outcome; net ${money(net)}.`;
    s.completedDates += 1;
    if (!s.stats.regionsWorked.includes(s.region)) s.stats.regionsWorked.push(s.region);
    this.applyStats({
      energy: -energyCost,
      stress,
      reputation: repDelta,
      exposure,
      health: s.energy - energyCost < 8 ? -2 : 0,
      visibility: stars >= 4 ? 2 : stars <= 2 ? -3 : 0,
    });
    this.addXP('presence', 10 + stars * 2);
    this.addXP('resilience', 5 + Math.max(0, Math.round(b.duration / 60)));
    if (s.safeCallBookings > 0) s.safeCallBookings -= 1;
    s.datePrep = 0;
    if (s.schedulePrep > 0) s.schedulePrep -= 1;
    this.upsertClient(b, stars, enc.regularPitch, false, this.createClientNote(b, enc, stars));
    this.advanceClock(b.duration, { render: false });
    this.addJournal('Date completed', `${b.clientName} · ${stars} stars · ${money(net)} net · ${LOCATIONS[b.venueId].name}.`);
    this.activeEncounter = null;
    if (this.manualObjectiveBookingId === b.id) this.manualObjectiveBookingId = null;
    if (s.completedDates > this.records.mostDates) {
      this.records.mostDates = s.completedDates;
      this.saveRecords();
    }
    const client = s.clients.find((c) => c.id === b.sourceClientId);
    this.ui.openModal({
      kicker: 'Date outcome',
      title: `${stars}-star date`,
      closable: false,
      body: `
        <div class="modal-banner ${stars <= 2 ? 'warning' : ''}">${
          stars >= 4
            ? 'Strong communication and preparation produced a positive outcome.'
            : stars === 3
              ? 'The date met the basic agreement, with room to improve preparation or pacing.'
              : 'The date was difficult. Review stress, energy, screening, and preparation before the next booking.'
        }</div>
        <div class="outcome-grid">
          <div class="outcome-item"><span>Net earned</span><strong>${money(net)}</strong></div>
          <div class="outcome-item"><span>Tip</span><strong>${money(tip)}</strong></div>
          <div class="outcome-item"><span>Review</span><strong>${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}</strong></div>
        </div>
        <div class="control-group">
          <div class="detail-row"><span>Gross fee</span><strong>${money(gross)}</strong></div>
          <div class="detail-row"><span>Operating cut</span><strong>${money(gross - net)}</strong></div>
          <div class="detail-row"><span>Encounter score</span><strong>${Math.round(score)} / 100</strong></div>
          <div class="detail-row"><span>Client status</span><strong>${client?.regular ? 'Regular' : 'Past client'}</strong></div>
        </div>`,
      actions: [{ label: 'Close', primary: true, onClick: () => this.ui.closeModal() }],
    });
    this.ui.toast('Date completed', `${money(net)} net earned. Reputation ${repDelta >= 0 ? '+' : ''}${repDelta.toFixed(1)}.`, stars >= 4 ? 'success' : stars <= 2 ? 'warning' : 'info', 6000, 'cash');
    if (stars >= 5) this.input.rumble(0.35, 140);
    this.refreshUI(true);
    this.save(false);
  }

  createClientNote(b, enc, stars) {
    const parts = [];
    if (b.isRegular) parts.push('Existing regular');
    if (b.screened) parts.push(`${riskLabel(b.risk).label.toLowerCase()} screened risk`);
    const scenarioNotes = {
      extension: 'extension terms discussed',
      privacy: 'privacy boundary reviewed',
      boundary: 'plan required firm clarification',
      venue: 'venue mix-up handled',
      payment: 'payment hiccup at the close',
      acquaintance: 'privacy moment in public',
      fatigue: 'plan adapted to client energy',
      weather: 'plans adapted to the weather',
    };
    if (scenarioNotes[enc.scenarioId]) parts.push(scenarioNotes[enc.scenarioId]);
    if (stars >= 4) parts.push('reliable payment and positive outcome');
    if (stars <= 2) parts.push('review before rebooking');
    return parts.length ? `${parts.join('; ')}.` : 'No special notes.';
  }

  upsertClient(b, rating, regularPitch, blacklist, note) {
    const s = this.state;
    let c = b.sourceClientId ? s.clients.find((cl) => cl.id === b.sourceClientId) : s.clients.find((cl) => cl.name === b.clientName);
    if (!c) {
      c = { id: uid('client'), name: b.clientName, visits: 0, ratingTotal: 0, ratingCount: 0, averageRating: 0, regular: false, blacklisted: false, lastDay: s.day, note: '' };
      s.clients.push(c);
    }
    if (b.status === 'completed' && !blacklist) c.visits += 1;
    c.lastDay = s.day;
    if (rating) {
      c.ratingTotal += rating;
      c.ratingCount += 1;
      c.averageRating = c.ratingTotal / c.ratingCount;
    }
    if (blacklist) {
      c.blacklisted = true;
      c.regular = false;
    } else if (!c.blacklisted && (b.isRegular || (rating >= 5 && chance(0.45)) || (regularPitch && rating >= 4 && chance(0.72)))) {
      c.regular = true;
    }
    c.note = note || c.note;
    b.sourceClientId = c.id;
  }

  /* ------------------------------------------------------------ objective and milestones */

  updateObjective() {
    const s = this.state;
    if (!s) return;
    const now = absMinute(s.day, s.minutes);
    const confirmed = s.bookings.filter((b) => b.status === 'confirmed').sort((a, b) => absMinute(a.day, a.minute) - absMinute(b.day, b.minute));
    const soon = confirmed.find((b) => {
      const d = absMinute(b.day, b.minute) - now;
      return d <= 120 && d >= -90;
    });
    let o = null;
    if (soon) {
      o = { title: `Meet ${soon.clientName}`, detail: `Travel to ${LOCATIONS[soon.venueId].name} and arrive within the booking window.`, time: relativeTime(absMinute(soon.day, soon.minute), now), locationId: soon.venueId };
    } else if (this.manualObjectiveBookingId) {
      const b = this.findBooking(this.manualObjectiveBookingId);
      if (b?.status === 'confirmed') {
        o = { title: `Prepare for ${b.clientName}`, detail: `${LOCATIONS[b.venueId].name} · ${dayTime(b.day, b.minute)} · ${money(b.rate)}.`, time: relativeTime(absMinute(b.day, b.minute), now), locationId: b.venueId };
      } else {
        this.manualObjectiveBookingId = null;
      }
    }
    if (!o && this.manualObjectiveLocation && LOCATIONS[this.manualObjectiveLocation]) {
      const loc = LOCATIONS[this.manualObjectiveLocation];
      o = { title: `Visit ${loc.name}`, detail: this.manualObjectiveDetail || loc.description, time: 'No deadline', locationId: this.manualObjectiveLocation };
    }
    if (!o && s.health < 52) o = { title: 'Prioritize health', detail: 'Visit the Wellbeing Clinic before taking on more demanding bookings.', time: 'Wellbeing priority', locationId: 'clinic' };
    else if (!o && s.energy < 24) o = { title: 'Recover at home', detail: 'Low energy reduces encounter checks and can create cascading stress.', time: 'Wellbeing priority', locationId: 'home' };
    else if (!o && s.stress > 67) o = { title: 'Lower accumulated stress', detail: 'Decompress in Garden Park, join a support circle at Harborlight, or schedule support at the clinic.', time: 'Wellbeing priority', locationId: 'park' };
    else if (!o && s.compliancePressure > 38) o = { title: 'Resolve compliance pressure', detail: 'Visit Northstar Agency for a consultation and reduce accumulated scrutiny.', time: 'Business priority', locationId: 'agency' };
    if (!o) {
      const unscreened = s.leads.find((l) => !l.screened);
      if (unscreened) o = { title: `Screen ${unscreened.name}`, detail: 'Open Leads on the phone and review reliability, payment, venue, privacy, and boundary signals.', time: 'Phone action', locationId: null };
    }
    if (!o && confirmed.length) {
      const next = confirmed[0];
      o = { title: 'Prepare for the next booking', detail: `Review notes or prepare at Skyglass Lounge before meeting ${next.clientName}.`, time: relativeTime(absMinute(next.day, next.minute), now), locationId: 'lounge' };
    }
    if (!o && !s.leads.length) o = { title: 'Generate new demand', detail: 'Improve the profile at Brightside Studio or launch a measured phone campaign.', time: 'No deadline', locationId: 'studio' };
    if (!o) {
      o = {
        title: 'Strengthen the business',
        detail: 'Improve profile quality at Brightside Studio or review rates and structure at Northstar Agency.',
        time: 'No deadline',
        locationId: s.profile < 70 ? 'studio' : 'agency',
      };
    }
    if (o.locationId) {
      const d = this.world.getDistanceToLocation(o.locationId);
      o.distance = d <= 2.8 ? 'You are here' : `~${Math.round(d * 65)} m`;
    } else {
      o.distance = 'Phone';
    }
    this.currentObjectiveLocation = o.locationId;
    this.world.setObjectiveLocation(o.locationId);
    this.ui.setObjective(o);
  }

  checkAchievements() {
    const s = this.state;
    for (const a of ACHIEVEMENTS) {
      if (s.achievements[a.id]) continue;
      let ok = false;
      try {
        ok = a.check(s);
      } catch {
        ok = false;
      }
      if (!ok) continue;
      s.achievements[a.id] = s.day;
      this.addJournal('Achievement unlocked', a.name);
      this.ui.toast(`Achievement · ${a.name}`, a.detail, 'success', 5200, 'achievement');
      if (!this.records.unlocked.includes(a.id)) {
        this.records.unlocked.push(a.id);
        this.saveRecords();
      }
      if (this.ui.activeTab === 'record') this.ui.renderPhone();
    }
  }

  checkMilestones() {
    const s = this.state;
    if (!s || this.ui.isModalOpen || this.ui.isPauseOpen) return;
    if (s.health <= 0 && !this.activeEncounter && !this.burnoutActive) {
      this.triggerBurnout();
      return;
    }
    if (s.money >= SAVINGS_GOAL && !s.flags.goalReached) {
      s.flags.goalReached = true;
      const best = this.records.bestGoal;
      const newRecord = !best || s.day < best.days;
      if (newRecord) {
        this.records.bestGoal = { days: s.day, name: s.playerName, difficulty: s.difficulty, region: s.region };
        this.saveRecords();
      }
      this.addJournal('Savings goal reached', `${money(s.money)} in available cash.`);
      this.checkAchievements();
      this.ui.openModal({
        kicker: 'Career milestone',
        title: 'Financial independence reached',
        body: `
          <div class="modal-banner">You reached the savings goal of ${money(SAVINGS_GOAL)} on Day ${s.day}. This unlocks a voluntary exit ending without forcing the career to stop.</div>
          ${newRecord ? `<div class="modal-banner record-banner">New record: your fastest savings goal${best ? ` (previous best: ${best.days} days)` : ''}.</div>` : ''}
          <div class="outcome-grid">
            <div class="outcome-item"><span>Cash</span><strong>${money(s.money)}</strong></div>
            <div class="outcome-item"><span>Dates</span><strong>${s.completedDates}</strong></div>
            <div class="outcome-item"><span>Reputation</span><strong>${Math.round(s.reputation)}</strong></div>
          </div>`,
        actions: [
          { label: 'Continue the career', onClick: () => this.ui.closeModal() },
          { label: 'Record an exit ending', primary: true, onClick: () => this.recordEnding('Financially independent exit') },
        ],
      });
      this.sound.play('achievement');
      this.save(false);
      return;
    }
    if (s.day >= 14 && !s.flags.day14Review) {
      s.flags.day14Review = true;
      const reviewed = s.bookings.filter((b) => b.review);
      const avg = reviewed.length ? reviewed.reduce((t, b) => t + b.review, 0) / reviewed.length : 0;
      this.ui.openModal({
        kicker: 'Two-week review',
        title: 'Career checkpoint',
        body: `
          <p>The career stays playable beyond Day 14. This checkpoint summarizes the direction your systems created.</p>
          <div class="outcome-grid">
            <div class="outcome-item"><span>Net earned</span><strong>${money(s.totalEarned)}</strong></div>
            <div class="outcome-item"><span>Average review</span><strong>${avg ? avg.toFixed(1) : '—'}</strong></div>
            <div class="outcome-item"><span>Unsafe leads declined</span><strong>${s.declinedUnsafe}</strong></div>
          </div>
          <div class="control-group">
            <div class="detail-row"><span>Operating model</span><strong>${esc(MODELS[s.model].name)}</strong></div>
            <div class="detail-row"><span>Region</span><strong>${esc(REGIONS[s.region].name)}</strong></div>
            <div class="detail-row"><span>Health / stress</span><strong>${Math.round(s.health)} / ${Math.round(s.stress)}</strong></div>
            <div class="detail-row"><span>Exposure</span><strong>${Math.round(s.exposure)}</strong></div>
            <div class="detail-row"><span>Achievements</span><strong>${Object.keys(s.achievements).length} / ${ACHIEVEMENTS.length}</strong></div>
          </div>`,
        actions: [{ label: 'Continue', primary: true, onClick: () => this.ui.closeModal() }],
      });
      this.save(false);
      return;
    }
    this.checkAchievements();
  }

  /** New: health at zero is no longer ignored. A day of care at the clinic, with its costs. */
  triggerBurnout() {
    const s = this.state;
    this.burnoutActive = true;
    this.world.clearPath();
    const cost = 150;
    this.input.rumble(0.8, 320);
    this.ui.openModal({
      kicker: 'Wellbeing',
      title: 'Burnout',
      closable: false,
      body: `
        <div class="modal-banner danger">Health reached zero. ${esc(s.playerName)} needs a full day of rest and care at the Wellbeing Clinic.</div>
        <p>Twelve hours pass, care costs ${money(cost)}, and any bookings in that window will be missed. Pace energy and stress to avoid a repeat: rest at home, eat at Lemon Café, and use the clinic before health runs out.</p>`,
      actions: [{ label: 'Recover at the clinic', primary: true, onClick: () => this.recoverFromBurnout(cost) }],
    });
  }

  recoverFromBurnout(cost) {
    const s = this.state;
    if (!s) return;
    this.ui.closeModal();
    this.world.setPlayerPosition(LOCATIONS.clinic.entry.x, LOCATIONS.clinic.entry.z);
    this.spend(cost, 'Clinic care', { allowNegative: true });
    this.advanceClock(720, { render: false });
    s.health = 45;
    s.energy = Math.max(s.energy, 70);
    this.applyStats({ stress: -20, reputation: -2 });
    s.stats.burnouts += 1;
    this.burnoutActive = false;
    this.addJournal('Burnout recovery', `A day of care at the Wellbeing Clinic (${money(cost)}).`);
    this.ui.toast('Back on your feet', 'Health restored to 45. Keep an eye on energy and stress.', 'info');
    this.refreshUI(true);
    this.save(false);
  }

  recordEnding(title) {
    const s = this.state;
    if (!s) return;
    s.flags.ending = title;
    this.addJournal('Ending recorded', title);
    const reviewed = s.bookings.filter((b) => b.review);
    const avg = reviewed.length ? reviewed.reduce((t, b) => t + b.review, 0) / reviewed.length : 0;
    const exits = s.bookings.filter((b) => b.safeExit).length;
    const best = this.records.bestGoal;
    this.ui.openModal({
      kicker: 'Ending recorded',
      title,
      closable: false,
      body: `
        <div class="modal-banner">${esc(s.playerName)} leaves the career with ${money(s.money)}, ${Math.round(s.reputation)} reputation, and a safety record shaped by the choices made during play.</div>
        <div class="outcome-grid">
          <div class="outcome-item"><span>Days</span><strong>${s.day}</strong></div>
          <div class="outcome-item"><span>Dates</span><strong>${s.completedDates}</strong></div>
          <div class="outcome-item"><span>Average review</span><strong>${avg ? avg.toFixed(1) : '—'}</strong></div>
        </div>
        <div class="control-group">
          <div class="detail-row"><span>Total earned</span><strong>${money(s.totalEarned)}</strong></div>
          <div class="detail-row"><span>Unsafe leads declined</span><strong>${s.declinedUnsafe}</strong></div>
          <div class="detail-row"><span>Safe exits used</span><strong>${exits}</strong></div>
          <div class="detail-row"><span>Burnouts</span><strong>${s.stats.burnouts}</strong></div>
          <div class="detail-row"><span>Achievements</span><strong>${Object.keys(s.achievements).length} / ${ACHIEVEMENTS.length}</strong></div>
          <div class="detail-row"><span>Fastest savings goal (all careers)</span><strong>${best ? `${best.days} days` : '—'}</strong></div>
        </div>
        <p>The save remains playable, so the career can continue after the ending.</p>`,
      actions: [
        { label: 'Back to title', onClick: () => this.quitToTitle() },
        { label: 'Keep playing', primary: true, onClick: () => this.ui.closeModal() },
      ],
    });
    this.save(false);
    this.ui.renderPhone();
  }

  confirmReset() {
    if (!this.state) return;
    this.ui.openModal({
      kicker: 'Career controls',
      title: 'Start over?',
      body: '<div class="modal-banner danger">This removes the current local save and returns to character setup. The action cannot be undone.</div>',
      actions: [
        { label: 'Keep career', navDefault: true, onClick: () => this.ui.closeModal() },
        { label: 'Delete and restart', className: 'danger-action', onClick: () => this.resetGame() },
      ],
    });
  }

  resetGame() {
    storageRemove(SAVE_KEY);
    this.ui.closeModal();
    this.state = null;
    this.started = false;
    this.resetSession();
    this.world.applyRegion('sunharbor');
    this.world.setPlayerPosition(LOCATIONS.home.entry.x, LOCATIONS.home.entry.z);
    this.world.setObjectiveLocation(null);
    this.ui.hideTutorial();
    this.ui.renderPhone();
    this.ui.showStartScreen(this.records);
    this.onLayerChange();
  }
}
