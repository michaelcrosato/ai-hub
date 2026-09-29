// Everything on the DOM side: the HUD, the business phone, dialogs, toasts,
// the setup screen, the pause menu and the controls help.

import {
  REGIONS,
  MODELS,
  BRANDS,
  SKILLS,
  LOCATIONS,
  CAMPAIGNS,
  DIFFICULTIES,
  ACHIEVEMENTS,
  TUTORIAL,
  SAVINGS_GOAL,
  SAVE_KEY,
  SKILL_CAP,
  COLLECTIVE_DUES,
} from './data.js';
import {
  $,
  $$,
  clamp,
  money,
  clockLabel,
  absMinute,
  dayTime,
  escapeHtml as esc,
  titleCase,
  xpForLevel,
  riskLabel,
  relativeTime,
  hoursLabel,
  uid,
  storageGet,
} from './util.js';

const MAX_TOASTS = 4;
const TOAST_SOUND = { success: 'success', warning: 'warning', danger: 'danger' };

/** Button prompts per input device. */
export const PROMPTS = {
  keyboard: { interact: 'E', travel: 'G', phone: 'Q', pause: 'Esc', speed: 'T', back: 'Esc', confirm: 'Enter' },
  gamepad: { interact: 'A', travel: 'X', phone: 'Y', pause: 'Start', speed: 'Back', back: 'B', confirm: 'A' },
  touch: { interact: 'Tap', travel: 'Go', phone: 'Phone', pause: 'Menu', speed: 'Speed', back: '×', confirm: 'Tap' },
};

export class UI {
  constructor(sound) {
    this.sound = sound;
    this.game = null;
    this.activeTab = 'leads';
    this.modalCallbacks = new Map();
    this.modalClosable = true;
    this.modalVersion = 0;
    this.phoneOpen = false;
    this.phoneFocus = false;
    this.source = 'keyboard';
    this.hudCache = new Map();
    this.el = {
      startScreen: $('#start-screen'),
      startCard: $('#start-screen .start-card'),
      startForm: $('#start-form'),
      continueButton: $('#continue-button'),
      startSettings: $('#start-settings'),
      startRecords: $('#start-records'),
      startRateInput: $('#start-rate-input'),
      startRateValue: $('#start-rate-value'),
      regionLabel: $('#region-label'),
      money: $('#money-stat'),
      energy: $('#energy-stat'),
      stress: $('#stress-stat'),
      health: $('#health-stat'),
      reputation: $('#rep-stat'),
      exposure: $('#exposure-stat'),
      clockTime: $('#clock-time'),
      clockDay: $('#clock-day'),
      objectiveTitle: $('#objective-title'),
      objectiveDetail: $('#objective-detail'),
      objectiveTime: $('#objective-time'),
      objectiveDistance: $('#objective-distance'),
      objectiveGo: $('#objective-go'),
      goalFill: $('#goal-progress-fill'),
      goalLabel: $('#goal-progress-label'),
      phonePanel: $('#phone-panel'),
      phoneTitle: $('#phone-title'),
      phoneContent: $('#phone-content'),
      phoneTabs: $('#phone-tabs'),
      leadCount: $('#lead-count'),
      phoneToggle: $('#phone-toggle'),
      phoneToggleCount: $('#phone-toggle-count'),
      phoneClose: $('#phone-close'),
      saveButton: $('#save-button'),
      timeControls: $('#time-controls'),
      menuButton: $('#menu-button'),
      interactionPrompt: $('#interaction-prompt'),
      interactionKey: $('#interaction-key'),
      interactionName: $('#interaction-name'),
      interactionHint: $('#interaction-hint'),
      movementHelp: $('#movement-help'),
      toastStack: $('#toast-stack'),
      modalBackdrop: $('#modal-backdrop'),
      modalCard: $('#modal-card'),
      modalKicker: $('#modal-kicker'),
      modalTitle: $('#modal-title'),
      modalBody: $('#modal-body'),
      modalActions: $('#modal-actions'),
      modalClose: $('#modal-close'),
      tutorial: $('#tutorial-card'),
      tutorialStep: $('#tutorial-step-label'),
      tutorialTitle: $('#tutorial-title'),
      tutorialCopy: $('#tutorial-copy'),
      tutorialDismiss: $('#tutorial-dismiss'),
      pauseScreen: $('#pause-screen'),
      pauseCard: $('#pause-screen .modal-card'),
      pauseSummary: $('#pause-summary'),
      pauseControls: $('#pause-controls'),
      pauseSound: $('#pause-sound'),
    };
    this.tutorialIndex = 0;
    this.bindEvents();
    this.refreshContinueButton();
  }

  setGame(game) {
    this.game = game;
  }

  /* ------------------------------------------------------------ events */

  bindEvents() {
    const el = this.el;
    el.startRateInput.addEventListener('input', () => {
      el.startRateValue.textContent = money(Number(el.startRateInput.value));
    });
    el.startForm.addEventListener('change', (e) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement) || t.type !== 'radio') return;
      $$(`input[name="${t.name}"]`, el.startForm).forEach((radio) => radio.closest('.choice-card')?.classList.toggle('selected', radio.checked));
      this.sound.play('click');
    });
    el.startForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!this.game) return;
      const data = new FormData(el.startForm);
      this.game.startNew({
        playerName: String(data.get('playerName') || 'Alex').trim() || 'Alex',
        baseRate: Number(data.get('baseRate') || 250),
        region: String(data.get('region') || 'sunharbor'),
        model: String(data.get('model') || 'independent'),
        trait: String(data.get('trait') || 'connector'),
        difficulty: String(data.get('difficulty') || 'standard'),
      });
    });
    el.continueButton.addEventListener('click', () => this.game?.continueSaved());
    el.startSettings.addEventListener('click', () => this.game?.openSettings());
    el.saveButton.addEventListener('click', () => {
      if (this.game?.save(true)) this.toast('Career saved', 'Your current day, bookings, finances, and progression were stored.', 'success');
    });
    el.phoneTabs.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-tab]');
      if (!(tab instanceof HTMLButtonElement)) return;
      this.activeTab = tab.dataset.tab || 'leads';
      this.syncTabs();
      this.renderPhone();
      this.sound.play('click');
    });
    el.phoneContent.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!(btn instanceof HTMLButtonElement) || btn.disabled || !this.game) return;
      this.sound.play('click');
      this.handlePhoneAction(btn.dataset.action, btn.dataset.id, btn.dataset.value);
    });
    el.phoneContent.addEventListener('input', (e) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement) || !this.game || !t.matches('[data-business-rate]')) return;
      const readout = el.phoneContent.querySelector('[data-rate-readout]');
      if (readout) readout.textContent = money(Number(t.value));
      this.game.setBaseRate(Number(t.value), false);
    });
    el.phoneContent.addEventListener('change', (e) => {
      const t = e.target;
      if (t instanceof HTMLInputElement && this.game && t.matches('[data-business-rate]')) this.game.setBaseRate(Number(t.value), true);
    });
    el.phoneToggle.addEventListener('click', () => {
      this.setPhoneOpen(true);
      this.sound.play('open');
    });
    el.phoneClose.addEventListener('click', () => {
      this.setPhoneOpen(false);
      if (this.phoneFocus) this.game?.setPhoneFocus(false);
      else this.sound.play('close');
    });
    el.timeControls.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-speed]');
      if (btn instanceof HTMLButtonElement && this.game) {
        this.game.setSpeed(Number(btn.dataset.speed));
        this.sound.play('click');
      }
    });
    el.menuButton.addEventListener('click', () => this.game?.openPause());
    el.objectiveGo.addEventListener('click', () => this.game?.travelToObjective());
    el.interactionPrompt.addEventListener('click', () => this.game?.interactNearby());
    el.modalClose.addEventListener('click', () => this.requestCloseModal());
    el.modalBackdrop.addEventListener('click', (e) => {
      if (e.target === el.modalBackdrop) this.requestCloseModal();
    });
    el.modalCard.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-modal-action]');
      if (!(btn instanceof HTMLButtonElement) || btn.disabled) return;
      this.sound.play('click');
      this.modalCallbacks.get(btn.dataset.modalAction)?.();
    });
    el.tutorialDismiss.addEventListener('click', () => {
      this.hideTutorial();
      this.game?.dismissTutorial();
    });
    el.pauseScreen.addEventListener('click', (e) => {
      if (e.target === el.pauseScreen) {
        this.game?.closePause();
        return;
      }
      const btn = e.target.closest('[data-pause]');
      if (btn instanceof HTMLButtonElement) {
        this.sound.play('click');
        this.game?.pauseAction(btn.dataset.pause);
      }
    });
  }

  handlePhoneAction(action, id, value) {
    const game = this.game;
    switch (action) {
      case 'screen-lead':
        return game.screenLead(id);
      case 'negotiate-lead':
        return game.openNegotiation(id);
      case 'accept-lead':
        return game.acceptLead(id);
      case 'decline-lead':
        return game.declineLead(id);
      case 'refresh-leads':
        return game.runListingBoost();
      case 'set-booking-objective':
        return game.setBookingObjective(id);
      case 'cancel-booking':
        return game.cancelBooking(id);
      case 'start-booking':
        return game.tryStartBooking(id);
      case 'run-campaign':
        return game.runCampaign(value);
      case 'send-location':
        return game.guideToLocation(value);
      case 'change-model':
        return game.guideToLocation(value || 'agency', 'Change your operating model at an appropriate office.');
      case 'change-region':
        return game.guideToLocation('transit', 'Use Central Transit to relocate between fictional regions.');
      case 'visit-collective':
        return game.guideToLocation('collective', 'Harborlight Collective: peer alerts, mentoring, and workshops.');
      case 'train-skill':
        return game.guideToSkillTraining(id);
      case 'set-brand':
        return game.setBrandStyle(value);
      case 'client-detail':
        return game.showClientRecord(id);
      case 'reset-game':
        return game.confirmReset();
      case 'record-ending':
        return game.recordEnding('Financially independent exit');
      default:
        return undefined;
    }
  }

  /* ------------------------------------------------------------ screens */

  refreshContinueButton() {
    const hasSave = !!storageGet(SAVE_KEY);
    this.el.continueButton.classList.toggle('hidden', !hasSave);
    // A controller lands on Continue when there is a career to continue.
    this.el.continueButton.toggleAttribute('data-nav-default', hasSave);
    $('#start-button').toggleAttribute('data-nav-default', !hasSave);
  }

  showStartScreen(records) {
    this.el.startScreen.classList.remove('hidden');
    this.setPhoneOpen(false);
    this.setPhoneFocus(false);
    this.refreshContinueButton();
    this.renderStartRecords(records);
  }

  hideStartScreen() {
    this.el.startScreen.classList.add('hidden');
  }

  get isStartOpen() {
    return !this.el.startScreen.classList.contains('hidden');
  }

  renderStartRecords(records) {
    const box = this.el.startRecords;
    if (!records || !records.careers) {
      box.classList.add('hidden');
      return;
    }
    const best = records.bestGoal
      ? `${records.bestGoal.days} days (${esc(records.bestGoal.name)}, ${esc(DIFFICULTIES[records.bestGoal.difficulty]?.name || 'Standard')})`
      : 'Not reached yet';
    box.innerHTML = `
      <strong>Your records</strong>
      <span>Careers started: <b>${records.careers}</b></span>
      <span>Fastest savings goal: <b>${best}</b></span>
      <span>Most dates in one career: <b>${records.mostDates}</b></span>
      <span>Achievements earned: <b>${records.unlocked.length} / ${ACHIEVEMENTS.length}</b></span>`;
    box.classList.remove('hidden');
  }

  setPhoneOpen(open) {
    this.phoneOpen = !!open;
    this.el.phonePanel.classList.toggle('open', this.phoneOpen);
    this.game?.updateTouchControls();
  }

  /** Gamepad/keyboard focus on the phone: the stick then navigates it instead of walking. */
  setPhoneFocus(on) {
    this.phoneFocus = !!on;
    this.el.phonePanel.classList.toggle('is-focused', this.phoneFocus);
  }

  syncTabs() {
    $$('.phone-tab', this.el.phoneTabs).forEach((tab) => tab.classList.toggle('active', tab.dataset.tab === this.activeTab));
  }

  setSpeed(speed) {
    if (this.hudCache.get('speed') === speed) return;
    this.hudCache.set('speed', speed);
    $$('[data-speed]', this.el.timeControls).forEach((btn) => btn.classList.toggle('active', Number(btn.dataset.speed) === speed));
  }

  /** Write a HUD value only when it changed (no DOM churn five times a second). */
  put(key, node, text) {
    if (this.hudCache.get(key) === text) return;
    this.hudCache.set(key, text);
    node.textContent = text;
  }

  updateHUD(s) {
    if (!s) return;
    const region = REGIONS[s.region] || REGIONS.sunharbor;
    const model = MODELS[s.model] || MODELS.independent;
    const el = this.el;
    this.put('region', el.regionLabel, `${region.name} · ${model.name}`);
    this.put('money', el.money, money(s.money));
    this.put('energy', el.energy, String(Math.round(s.energy)));
    this.put('stress', el.stress, String(Math.round(s.stress)));
    this.put('health', el.health, String(Math.round(s.health)));
    this.put('rep', el.reputation, String(Math.round(s.reputation)));
    this.put('exposure', el.exposure, String(Math.round(s.exposure)));
    this.put('clock', el.clockTime, clockLabel(s.minutes));
    this.put('day', el.clockDay, `Day ${s.day}`);
    const leads = String(s.leads?.length ?? 0);
    this.put('leads', el.leadCount, leads);
    this.put('leadsToggle', el.phoneToggleCount, leads);
    const pct = `${clamp((Math.max(0, s.money) / SAVINGS_GOAL) * 100, 0, 100)}%`;
    if (this.hudCache.get('goalPct') !== pct) {
      this.hudCache.set('goalPct', pct);
      el.goalFill.style.width = pct;
    }
    this.put('goal', el.goalLabel, `Savings goal: ${money(Math.max(0, s.money))} / ${money(SAVINGS_GOAL)}`);
    // Low stats glow so trouble is visible before it becomes a crisis.
    this.flag('energy', el.energy, s.energy < 24);
    this.flag('stress', el.stress, s.stress > 67);
    this.flag('health', el.health, s.health < 52);
    this.flag('money', el.money, s.money < 0);
    this.setSpeed(s.speed);
  }

  flag(key, node, on) {
    const k = `warn-${key}`;
    if (this.hudCache.get(k) === on) return;
    this.hudCache.set(k, on);
    node.closest('.stat-item')?.classList.toggle('is-warning', on);
  }

  setObjective(o) {
    const el = this.el;
    this.put('objTitle', el.objectiveTitle, o.title);
    this.put('objDetail', el.objectiveDetail, o.detail);
    this.put('objTime', el.objectiveTime, o.time || 'No deadline');
    this.put('objDist', el.objectiveDistance, o.distance || '—');
    const canGo = !!o.locationId && o.distance !== 'You are here';
    if (this.hudCache.get('objGo') !== canGo) {
      this.hudCache.set('objGo', canGo);
      el.objectiveGo.classList.toggle('hidden', !canGo);
    }
  }

  showInteraction(id) {
    const loc = id ? LOCATIONS[id] : null;
    if (!loc) {
      this.el.interactionPrompt.classList.add('hidden');
      return;
    }
    this.el.interactionName.textContent = loc.name;
    this.el.interactionHint.textContent = loc.short;
    this.el.interactionPrompt.classList.remove('hidden');
  }

  /** Button prompts follow the last device used (keyboard, gamepad or touch). */
  setInputSource(source) {
    const src = PROMPTS[source] ? source : 'keyboard';
    this.source = src;
    const p = PROMPTS[src];
    this.el.interactionKey.textContent = p.interact;
    this.el.objectiveGo.textContent = src === 'touch' ? 'Go' : `Go · ${p.travel}`;
    const lines = {
      keyboard: ['Click ground or use WASD', 'E near a location · G to objective', 'Q phone · T speed · Esc menu'],
      gamepad: ['Left stick to walk', 'A at a doorway · X to objective', 'Y phone · Back speed · Start menu'],
      touch: ['Tap the ground or a building', 'Tap the prompt at a doorway', 'Pinch to zoom · Menu for options'],
    }[src];
    this.el.movementHelp.innerHTML = `<strong>Move</strong>${lines.map((l) => `<span>${esc(l)}</span>`).join('')}`;
    document.documentElement.dataset.input = src;
    if (!this.el.tutorial.classList.contains('hidden')) this.showTutorial(this.tutorialIndex);
    if (this.isPauseOpen && !this.el.pauseControls.classList.contains('hidden')) this.renderControlsHelp();
  }

  /* ------------------------------------------------------------ toasts */

  /** cue: a sound name from audio.js, null for silence, or undefined for the type's default. */
  toast(title, detail = '', type = 'info', ms = 4300, cue) {
    const node = document.createElement('div');
    node.className = `toast ${type}`;
    node.innerHTML = `<span class="toast-dot"></span><span><strong>${esc(title)}</strong>${detail ? `<span>${esc(detail)}</span>` : ''}</span>`;
    this.el.toastStack.appendChild(node);
    // Keep the stack short: the oldest notices leave first.
    const live = [...this.el.toastStack.children].filter((t) => !t.classList.contains('leaving'));
    for (let i = 0; i < live.length - MAX_TOASTS; i += 1) this.dismissToast(live[i]);
    setTimeout(() => this.dismissToast(node), ms);
    const sound = cue !== undefined ? cue : TOAST_SOUND[type];
    if (sound) this.sound.play(sound);
  }

  dismissToast(node) {
    if (!node.isConnected || node.classList.contains('leaving')) return;
    node.classList.add('leaving');
    setTimeout(() => node.remove(), 210);
  }

  /* ------------------------------------------------------------ dialogs */

  openModal({ kicker = 'City Companion', title, body = '', actions = [], closable = true }) {
    this.modalCallbacks.clear();
    this.modalClosable = closable;
    this.modalVersion += 1;
    const html =
      typeof body === 'function'
        ? body({
            button: (opts, cls = 'modal-choice') => this.modalButton(opts, cls),
            choiceGrid: (list, cls = 'modal-choice-grid') => `<div class="${cls}">${list.map((o) => this.modalButton(o, o.className || 'modal-choice')).join('')}</div>`,
          })
        : body;
    const el = this.el;
    const wasOpen = this.isModalOpen;
    el.modalKicker.textContent = kicker;
    el.modalTitle.textContent = title;
    el.modalBody.innerHTML = html;
    el.modalActions.innerHTML = actions.map((a) => this.modalButton(a, a.className || (a.primary ? 'primary' : 'secondary'))).join('');
    el.modalClose.classList.toggle('hidden', !closable);
    el.modalBackdrop.classList.remove('hidden');
    el.modalCard.scrollTop = 0;
    // Keyboard users Tab from inside the dialog; a controller gets focus from the menu navigation.
    if (this.source !== 'gamepad') el.modalCard.focus({ preventScroll: true });
    if (!wasOpen) this.sound.play('open');
    this.game?.onLayerChange();
  }

  modalButton(opts, cls) {
    const id = uid('modal-action');
    this.modalCallbacks.set(id, opts.onClick || (() => this.closeModal()));
    const meta = opts.meta ? `<span class="choice-meta"><span>${esc(opts.meta.left || '')}</span><span>${esc(opts.meta.right || '')}</span></span>` : '';
    const detail = opts.detail ? `<small>${esc(opts.detail)}</small>` : '';
    return `<button type="button" class="${cls}" data-modal-action="${id}" ${opts.disabled ? 'disabled' : ''} ${opts.navDefault ? 'data-nav-default' : ''}><strong>${esc(opts.label)}</strong>${detail}${meta}</button>`;
  }

  requestCloseModal() {
    if (this.modalClosable) {
      this.closeModal();
      this.sound.play('close');
    }
  }

  closeModal() {
    if (!this.isModalOpen) return;
    this.el.modalBackdrop.classList.add('hidden');
    this.modalCallbacks.clear();
    this.modalClosable = true;
    this.game?.onLayerChange();
  }

  get isModalOpen() {
    return !this.el.modalBackdrop.classList.contains('hidden');
  }

  /* ------------------------------------------------------------ pause menu */

  get isPauseOpen() {
    return !this.el.pauseScreen.classList.contains('hidden');
  }

  showPause(summary, soundOn) {
    this.el.pauseSummary.innerHTML = summary;
    this.el.pauseControls.classList.add('hidden');
    this.setSoundLabel(soundOn);
    this.el.pauseScreen.classList.remove('hidden');
    if (this.source !== 'gamepad') this.el.pauseCard.focus({ preventScroll: true });
    this.sound.play('open');
  }

  hidePause() {
    this.el.pauseScreen.classList.add('hidden');
  }

  setSoundLabel(on) {
    this.el.pauseSound.textContent = `Sound: ${on ? 'On' : 'Off'}`;
  }

  toggleControlsHelp() {
    const box = this.el.pauseControls;
    const show = box.classList.contains('hidden');
    if (show) this.renderControlsHelp();
    box.classList.toggle('hidden', !show);
    return show;
  }

  hideControlsHelp() {
    this.el.pauseControls.classList.add('hidden');
  }

  get isControlsHelpOpen() {
    return !this.el.pauseControls.classList.contains('hidden');
  }

  renderControlsHelp() {
    const rows = {
      keyboard: [
        ['Walk', 'WASD or arrow keys, or click the ground'],
        ['Use a location', 'E, Space or Enter at a doorway (or click the building)'],
        ['Walk to objective', 'G'],
        ['Business phone', 'Q (arrows move through it, Esc closes it)'],
        ['Time speed', 'T cycles Pause · 1× · 2× · 4×'],
        ['Zoom', 'Mouse wheel, + and −'],
        ['Menus', 'Arrows or Tab to move, Enter to choose, Esc to go back'],
        ['Pause menu', 'Esc or P · Settings: F9'],
      ],
      gamepad: [
        ['Walk', 'Left stick or D-pad'],
        ['Use a location', 'A at a doorway'],
        ['Walk to objective', 'X'],
        ['Business phone', 'Y (B closes it)'],
        ['Time speed', 'Back / View cycles Pause · 1× · 2× · 4×'],
        ['Zoom', 'LB and RB'],
        ['Menus', 'Stick or D-pad to move, A to choose, B to go back'],
        ['Pause menu', 'Start / Menu'],
      ],
      touch: [
        ['Walk', 'Tap the ground, or tap a building to walk to its door'],
        ['Use a location', 'Tap the prompt at the bottom, or the Visit button'],
        ['Walk to objective', 'Go on the objective card'],
        ['Business phone', 'Phone button, bottom right'],
        ['Time speed', 'Pause · 1× · 2× · 4× buttons, bottom left'],
        ['Zoom', 'Pinch'],
        ['Pause menu', 'Menu button, bottom left'],
      ],
    }[this.source] || [];
    this.el.pauseControls.innerHTML = `
      <h3 class="section-heading">${this.source === 'gamepad' ? 'Controller' : this.source === 'touch' ? 'Touch' : 'Keyboard and mouse'}</h3>
      <div class="control-group">${rows.map(([a, b]) => `<div class="detail-row"><span>${esc(a)}</span><strong>${esc(b)}</strong></div>`).join('')}</div>`;
  }

  /* ------------------------------------------------------------ tutorial */

  showTutorial(index, total = TUTORIAL.length) {
    const i = clamp(index, 0, TUTORIAL.length - 1);
    this.tutorialIndex = i;
    const step = TUTORIAL[i];
    this.el.tutorialStep.textContent = `Step ${i + 1} of ${total}`;
    this.el.tutorialTitle.textContent = step.title;
    this.el.tutorialCopy.textContent = step.copy[this.source] || step.copy.keyboard;
    this.el.tutorialDismiss.textContent = this.source === 'gamepad' ? 'Got it (B)' : 'Got it';
    this.el.tutorial.classList.remove('hidden');
  }

  hideTutorial() {
    this.el.tutorial.classList.add('hidden');
  }

  get isTutorialOpen() {
    return !this.el.tutorial.classList.contains('hidden');
  }

  /* ------------------------------------------------------------ phone */

  /** Re-render the phone, keeping keyboard/gamepad focus on the same control. */
  renderPhone() {
    const content = this.el.phoneContent;
    const active = document.activeElement;
    let focusKey = null;
    if (active && content.contains(active) && active.dataset) {
      focusKey = { action: active.dataset.action, id: active.dataset.id, value: active.dataset.value, rate: active.matches('[data-business-rate]') };
    }
    const scroll = content.scrollTop;
    if (!this.game?.state) {
      content.innerHTML =
        '<div class="empty-state"><div class="empty-state-icon">CC</div><strong>Start a career first</strong><p>Your leads, calendar, business controls, and skills will appear here.</p></div>';
      return;
    }
    const tabs = {
      leads: () => this.renderLeads(),
      calendar: () => this.renderCalendar(),
      business: () => this.renderBusiness(),
      skills: () => this.renderSkills(),
      record: () => this.renderRecord(),
    };
    this.el.phoneTitle.textContent = this.activeTab === 'record' ? 'Career record' : titleCase(this.activeTab);
    content.innerHTML = (tabs[this.activeTab] || tabs.leads)();
    content.scrollTop = scroll;
    if (focusKey) {
      const match = focusKey.rate
        ? content.querySelector('[data-business-rate]')
        : [...content.querySelectorAll('[data-action]')].find(
            (b) => b.dataset.action === focusKey.action && b.dataset.id === focusKey.id && b.dataset.value === focusKey.value && !b.disabled
          );
      if (match) {
        match.focus({ preventScroll: true });
        if (this.game?.nav?.marked) this.game.nav.mark(match);
      }
    }
  }

  renderLeads() {
    const s = this.game.state;
    const leads = [...s.leads].sort((a, b) => absMinute(a.requestedDay, a.requestedMinute) - absMinute(b.requestedDay, b.requestedMinute));
    const intro = `
      <div class="phone-section-intro">
        <p><strong>${leads.length} active ${leads.length === 1 ? 'lead' : 'leads'}</strong>Screen, price, and schedule from your phone. Physical dates still require travel.</p>
        <button type="button" class="small-action" data-action="refresh-leads" ${s.money < 45 ? 'disabled' : ''}>Boost · $45</button>
      </div>`;
    if (!leads.length) {
      return `${intro}<div class="empty-state"><div class="empty-state-icon">0</div><strong>No active inquiries</strong><p>Run a listing boost, improve your profile at Brightside Studio, or wait for the next daily refresh.</p></div>`;
    }
    const cards = leads.map((lead, i) => {
      const risk = lead.screened ? riskLabel(lead.effectiveRisk) : { label: 'Unknown', className: 'risk-medium' };
      const tags = lead.screened
        ? [
            ...lead.positiveFlags.map((f) => `<span class="tag positive">${esc(f)}</span>`),
            ...lead.warningFlags.map((f) => `<span class="tag ${lead.effectiveRisk >= 62 ? 'negative' : 'warning'}">${esc(f)}</span>`),
          ].join('')
        : `${lead.peerAlert ? '<span class="tag negative">Peer alert · flagged by the collective</span>' : ''}<span class="tag">Screening not completed</span>`;
      const avatarClass = lead.isRegular ? 'regular' : lead.isVip ? 'vip' : '';
      const initials = lead.name
        .split(/\s+/)
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
      const deposit = lead.depositPct > 0 ? `${lead.depositPct}% deposit` : 'No deposit set';
      return `
        <article class="phone-card ${i === 0 ? 'featured' : ''}">
          <div class="card-topline">
            <div class="avatar-line">
              <span class="client-avatar ${avatarClass}">${esc(initials)}</span>
              <span><strong>${esc(lead.name)}</strong><small>${esc(lead.archetypeLabel)} · ${esc(LOCATIONS[lead.venueId].name)}</small></span>
            </div>
            <span class="price-pill">${money(lead.proposedRate)}</span>
          </div>
          <p>${esc(lead.summary)}</p>
          <div class="card-meta">
            <span>${dayTime(lead.requestedDay, lead.requestedMinute)}</span>
            <span>${hoursLabel(lead.duration)}</span>
            <span>${deposit}</span>
          </div>
          <div class="tag-row">${tags}</div>
          <div class="card-meta"><span>Risk: <strong>${risk.label}</strong></span><span>Budget signal: ${esc(lead.budgetSignal)}</span></div>
          <div class="card-actions">
            <button type="button" class="card-action" data-action="screen-lead" data-id="${lead.id}" ${lead.screened ? 'disabled' : ''}>${lead.screened ? 'Screened' : 'Screen'}</button>
            <button type="button" class="card-action" data-action="negotiate-lead" data-id="${lead.id}">Negotiate</button>
            <button type="button" class="card-action primary-action" data-action="accept-lead" data-id="${lead.id}">Accept</button>
            <button type="button" class="card-action" data-action="decline-lead" data-id="${lead.id}">Decline</button>
          </div>
        </article>`;
    });
    return `${intro}<div class="card-list">${cards.join('')}</div>`;
  }

  renderCalendar() {
    const s = this.game.state;
    const now = absMinute(s.day, s.minutes);
    const upcoming = s.bookings.filter((b) => b.status === 'confirmed').sort((a, b) => absMinute(a.day, a.minute) - absMinute(b.day, b.minute));
    const history = s.bookings
      .filter((b) => b.status !== 'confirmed')
      .sort((a, b) => absMinute(b.day, b.minute) - absMinute(a.day, a.minute))
      .slice(0, 6);
    const summary = `
      <div class="summary-grid">
        <div class="summary-card"><span>Upcoming</span><strong>${upcoming.length}</strong></div>
        <div class="summary-card"><span>Completed</span><strong>${s.completedDates}</strong></div>
        <div class="summary-card"><span>Earned</span><strong>${money(s.totalEarned)}</strong></div>
        <div class="summary-card"><span>Regulars</span><strong>${s.clients.filter((c) => c.regular).length}</strong></div>
      </div>`;
    const upcomingHtml = !upcoming.length
      ? '<div class="empty-state"><div class="empty-state-icon">Cal</div><strong>No confirmed bookings</strong><p>Screen and accept a suitable lead to place it on your calendar.</p></div>'
      : `<div class="card-list">${upcoming
          .map((b) => {
            const start = absMinute(b.day, b.minute);
            const until = start - now;
            const due = until <= 60 && until >= -75;
            const ready = due && this.game.world.isNearLocation(b.venueId);
            return `
              <article class="booking-card upcoming ${due ? 'due' : ''}">
                <div class="booking-topline">
                  <span><strong>${esc(b.clientName)}</strong><small>${esc(LOCATIONS[b.venueId].name)} · ${hoursLabel(b.duration)}</small></span>
                  <span class="status-pill status-confirmed">Confirmed</span>
                </div>
                <p>${esc(b.summary)}</p>
                <div class="card-meta"><span>${dayTime(b.day, b.minute)}</span><span>${relativeTime(start, now)}</span><span>${money(b.rate)}</span></div>
                <div class="card-actions">
                  <button type="button" class="card-action ${ready ? 'primary-action' : ''}" data-action="${ready ? 'start-booking' : 'set-booking-objective'}" data-id="${b.id}">${ready ? 'Start date' : 'Set objective'}</button>
                  <button type="button" class="card-action" data-action="cancel-booking" data-id="${b.id}">Cancel</button>
                </div>
              </article>`;
          })
          .join('')}</div>`;
    const historyHtml = !history.length
      ? '<p class="phone-section-intro">Completed and cancelled bookings will appear here.</p>'
      : `<div class="card-list">${history
          .map((b) => {
            const cls = b.status === 'completed' ? 'status-completed' : b.status === 'missed' ? 'status-missed' : 'status-cancelled';
            return `
              <article class="booking-card">
                <div class="booking-topline">
                  <span><strong>${esc(b.clientName)}</strong><small>${dayTime(b.day, b.minute)} · ${esc(LOCATIONS[b.venueId].name)}</small></span>
                  <span class="status-pill ${cls}">${esc(titleCase(b.status))}</span>
                </div>
                ${b.review ? `<p>Review: ${'★'.repeat(b.review)}${'☆'.repeat(5 - b.review)} · Net ${money(b.netEarned || 0)}</p>` : `<p>${esc(b.outcomeNote || 'No completed review.')}</p>`}
              </article>`;
          })
          .join('')}</div>`;
    return `${summary}<h3 class="section-heading">Upcoming</h3>${upcomingHtml}<h3 class="section-heading">Recent history</h3>${historyHtml}`;
  }

  renderBusiness() {
    const s = this.game.state;
    const region = REGIONS[s.region];
    const model = MODELS[s.model];
    const brand = BRANDS[s.brandStyle];
    const pace = DIFFICULTIES[s.difficulty] || DIFFICULTIES.standard;
    const overhead = this.game.dailyOverhead();
    const clients = [...s.clients].sort((a, b) => b.lastDay - a.lastDay).slice(0, 5);
    const c = s.collective;
    return `
      <div class="summary-grid">
        <div class="summary-card"><span>Base rate</span><strong>${money(s.baseRate)}</strong></div>
        <div class="summary-card"><span>Profile quality</span><strong>${Math.round(s.profile)}%</strong></div>
        <div class="summary-card"><span>Visibility</span><strong>${Math.round(s.visibility)}%</strong></div>
        <div class="summary-card"><span>Safety readiness</span><strong>${Math.round(this.game.getSafetyScore())}%</strong></div>
      </div>

      <div class="control-group">
        <div class="control-label"><span>Published base rate</span><strong data-rate-readout>${money(s.baseRate)}</strong></div>
        <input type="range" min="150" max="700" step="25" value="${s.baseRate}" data-business-rate aria-label="Published base rate" />
        <p>Higher prices can improve earnings and positioning, but may lower conversion until reputation and profile quality catch up.</p>
      </div>

      <h3 class="section-heading">Positioning</h3>
      <div class="segmented-control">
        ${Object.entries(BRANDS)
          .map(([id, b]) => `<button type="button" data-action="set-brand" data-value="${id}" class="${s.brandStyle === id ? 'active' : ''}" title="${esc(b.description)}">${esc(b.name)}</button>`)
          .join('')}
      </div>
      <p class="phone-section-intro">Current positioning: <strong>${esc(brand.name)}</strong>. ${esc(brand.description)}</p>

      <h3 class="section-heading">Operating structure</h3>
      <div class="control-group">
        <div class="business-stat-row"><span>Region</span><strong>${esc(region.name)} · ${esc(region.policy)}</strong></div>
        <div class="business-stat-row"><span>Model</span><strong>${esc(model.name)}</strong></div>
        <div class="business-stat-row"><span>Commission</span><strong>${Math.round(model.commission * 100)}%</strong></div>
        <div class="business-stat-row"><span>Daily overhead</span><strong>${money(overhead)}</strong></div>
        <div class="business-stat-row"><span>Pace</span><strong>${esc(pace.name)}</strong></div>
        <div class="card-actions">
          <button type="button" class="card-action" data-action="change-model" data-value="agency">Visit management</button>
          <button type="button" class="card-action" data-action="change-region">Visit transit</button>
        </div>
      </div>

      <h3 class="section-heading">Peer support</h3>
      <div class="control-group">
        <div class="business-stat-row"><span>Harborlight Collective</span><strong>${c.member ? `Member · ${money(COLLECTIVE_DUES)}/day` : 'Not a member'}</strong></div>
        <div class="business-stat-row"><span>Standing</span><strong>${Math.round(c.standing)} / 100</strong></div>
        <div class="business-stat-row"><span>Newcomers mentored</span><strong>${c.mentored}</strong></div>
        <p>${c.member ? 'Peer alerts flag risky inquiries before you screen them, and the check-in network adds to safety readiness.' : 'Members get peer alerts on risky inquiries, a check-in network, and cheaper workshops.'}</p>
        <div class="card-actions"><button type="button" class="card-action" data-action="visit-collective">Visit the collective</button></div>
      </div>

      <h3 class="section-heading">Marketing campaigns</h3>
      <div class="card-list">
        ${Object.entries(CAMPAIGNS)
          .map(
            ([id, cp]) => `
          <article class="phone-card">
            <div class="card-topline"><strong>${esc(cp.name)}</strong><span class="price-pill">${money(cp.cost)}</span></div>
            <p>${esc(cp.detail)}</p>
            <div class="card-actions"><button type="button" class="card-action primary-action" data-action="run-campaign" data-value="${id}" ${s.money < cp.cost ? 'disabled' : ''}>Launch from phone</button></div>
          </article>`
          )
          .join('')}
      </div>

      <h3 class="section-heading">Client notes</h3>
      ${
        clients.length
          ? `<div class="card-list">${clients
              .map(
                (cl) => `
          <article class="client-note">
            <div class="card-topline" style="padding:11px 11px 0"><strong>${esc(cl.name)}</strong><span class="type-pill">${cl.blacklisted ? 'Blacklisted' : cl.regular ? 'Regular' : 'Past client'}</span></div>
            <p style="padding:0 11px">${esc(cl.note || 'No special notes recorded.')}</p>
            <div class="card-actions" style="padding:0 11px 11px"><button type="button" class="card-action" data-action="client-detail" data-id="${cl.id}">Open record</button></div>
          </article>`
              )
              .join('')}</div>`
          : '<div class="empty-state"><div class="empty-state-icon">CRM</div><strong>No client history yet</strong><p>Completed dates create private notes, reliability history, and regular-client opportunities.</p></div>'
      }

      <h3 class="section-heading">Career controls</h3>
      <button type="button" class="danger-action" style="min-height:38px;padding:0 13px" data-action="reset-game">Start a new career</button>`;
  }

  renderSkills() {
    const s = this.game.state;
    return `
      <div class="phone-section-intro"><p><strong>Skills improve through use and training.</strong>Each skill has a physical training location; successful professional choices also award experience.</p></div>
      ${Object.entries(SKILLS)
        .map(([id, skill]) => {
          const k = s.skills[id];
          const need = xpForLevel(k.level);
          const pct = k.level >= SKILL_CAP ? 100 : clamp((k.xp / need) * 100, 0, 100);
          const cost = 45 + k.level * 25;
          return `
        <article class="skill-card">
          <div class="skill-topline">
            <span><strong>${esc(skill.name)}</strong><small>${esc(skill.description)}</small></span>
            <span class="skill-level">Lv ${k.level}</span>
          </div>
          <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
          <div class="card-actions">
            <span class="skill-cost">${k.level >= SKILL_CAP ? 'Mastered' : `${Math.round(k.xp)} / ${need} XP · ${money(cost)}`}</span>
            <button type="button" class="card-action" data-action="train-skill" data-id="${id}" ${k.level >= SKILL_CAP ? 'disabled' : ''}>Train at ${esc(LOCATIONS[skill.location].name)}</button>
          </div>
        </article>`;
        })
        .join('')}`;
  }

  /** New tab: achievements, cross-career records, the ledger and the journal (both were recorded but never shown). */
  renderRecord() {
    const s = this.game.state;
    const records = this.game.records;
    const reviews = s.bookings.filter((b) => b.review);
    const avg = reviews.length ? reviews.reduce((t, b) => t + b.review, 0) / reviews.length : 0;
    const unlocked = ACHIEVEMENTS.filter((a) => s.achievements[a.id]);
    const summary = `
      <div class="summary-grid">
        <div class="summary-card"><span>Day</span><strong>${s.day}</strong></div>
        <div class="summary-card"><span>Dates</span><strong>${s.completedDates}</strong></div>
        <div class="summary-card"><span>Average review</span><strong>${avg ? avg.toFixed(1) : '—'}</strong></div>
        <div class="summary-card"><span>Achievements</span><strong>${unlocked.length} / ${ACHIEVEMENTS.length}</strong></div>
      </div>`;
    const ending =
      s.flags.goalReached && !s.flags.ending
        ? '<div class="control-group"><p>You reached the savings goal. You can record an exit ending at any time; the save stays playable.</p><div class="card-actions"><button type="button" class="card-action primary-action" data-action="record-ending">Record an exit ending</button></div></div>'
        : s.flags.ending
          ? `<div class="modal-banner">Ending recorded: <strong>${esc(s.flags.ending)}</strong></div>`
          : '';
    const achievements = `<div class="achievement-grid">${ACHIEVEMENTS.map((a) => {
      const day = s.achievements[a.id];
      return `<div class="achievement ${day ? 'unlocked' : ''}"><strong>${esc(a.name)}</strong><small>${esc(a.detail)}</small><span>${day ? `Day ${day}` : 'Locked'}</span></div>`;
    }).join('')}</div>`;
    const best = records.bestGoal ? `${records.bestGoal.days} days · ${esc(records.bestGoal.name)}` : 'Not reached yet';
    const recordsHtml = `
      <div class="control-group">
        <div class="business-stat-row"><span>Fastest savings goal</span><strong>${best}</strong></div>
        <div class="business-stat-row"><span>Most dates in one career</span><strong>${records.mostDates}</strong></div>
        <div class="business-stat-row"><span>Careers started</span><strong>${records.careers}</strong></div>
      </div>`;
    const ledger = s.ledger.slice(0, 8);
    const ledgerHtml = ledger.length
      ? `<div class="card-list">${ledger
          .map(
            (t) =>
              `<div class="ledger-row"><span><strong>${esc(t.label)}</strong><small>${dayTime(t.day, t.minute)}</small></span><b class="${t.amount >= 0 ? 'amount-in' : 'amount-out'}">${t.amount >= 0 ? '+' : '−'}${money(Math.abs(t.amount))}</b></div>`
          )
          .join('')}</div>`
      : '<p class="phone-section-intro">No transactions yet.</p>';
    const journal = s.journal.slice(0, 12);
    const journalHtml = journal.length
      ? `<div class="timeline">${journal
          .map((j) => `<div class="timeline-item"><span class="timeline-dot"></span><span><small>${dayTime(j.day, j.minute)}</small><strong>${esc(j.title)}</strong><small>${esc(j.detail)}</small></span></div>`)
          .join('')}</div>`
      : '';
    return `${summary}${ending}<h3 class="section-heading">Achievements</h3>${achievements}<h3 class="section-heading">Your records</h3>${recordsHtml}<h3 class="section-heading">Recent money</h3>${ledgerHtml}<h3 class="section-heading">Journal</h3>${journalHtml}`;
  }
}
