/**
 * gridlab.js — GRID LAB, the field-engineering console: runtime overrides
 * (invincibility, noclip, FOV), transit to any site, world clock and weather
 * control, an isolated campaign sandbox, render toggles, the chunk streamer,
 * and field-stamp authoring. It is a DOM panel; F2 opens it from the keyboard
 * and the pause menu opens it for controllers and touch.
 */
import { TIME_SCALES } from './sky.js';

const byId = (id) => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Required GRID LAB element #${id} is missing.`);
  return el;
};
const signed = (value, digits = 1) => `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(digits)}`;
const optionalNumber = (input) => (input.value.trim() === '' ? undefined : Number(input.value));
const SCALE_IDS = ['025', '05', '1', '2', '8', '24', '96'];
const SCALE_BUTTONS = TIME_SCALES.map((scale, i) => [scale, SCALE_IDS[i]]);
const QUALITY_IDS = ['low', 'medium', 'high', 'ultra'];
const FEATURES = [
  ['grid-lab-render-grade', 'grade', 'Colour grade'],
  ['grid-lab-render-shadows', 'shadows', 'Celestial shadows'],
  ['grid-lab-render-bloom', 'bloom', 'Bloom'],
  ['grid-lab-render-atmosphere', 'atmosphere', 'Atmospheric scatter'],
];

export class GridLab {
  constructor(actions) {
    this.actions = actions;
    this.root = byId('grid-lab');
    this.status = byId('grid-lab-status');
    this.logElement = byId('grid-lab-command-log');
    this.trace = byId('grid-lab-trace');
    this.commitButton = byId('grid-lab-commit');
    this.xInput = byId('grid-lab-x');
    this.yInput = byId('grid-lab-y');
    this.zInput = byId('grid-lab-z');
    this.yawInput = byId('grid-lab-yaw');
    this.travelSelect = byId('grid-lab-travel-target');
    this.search = byId('grid-lab-search');
    this.paneViewport = byId('grid-lab-panes');
    this.listeners = [];
    this.open = false;
    this.elapsed = Infinity;
    this.commitArmedUntil = 0;
    this.activeTab = 'player';
    this.onGlobalKey = (event) => {
      if (event.repeat) return;
      if (event.code === 'F2') {
        event.preventDefault();
        event.stopPropagation();
        if (this.open || this.actions.canOpen()) this.toggle();
      } else if (event.code === 'Escape' && this.open) {
        // The panel owns Escape while it is open, so the game does not also open its pause menu.
        event.preventDefault();
        event.stopPropagation();
        this.setOpen(false);
      }
    };
    document.addEventListener('keydown', this.onGlobalKey, true);
    this.populateTravelTargets();
    this.bindTabsAndSearch();
    this.bindAll();
  }

  get isOpen() {
    return this.open;
  }

  bindAll() {
    const a = this.actions;
    this.bind('grid-lab-close', () => this.setOpen(false));
    this.bind('grid-lab-invincible', () => this.log(a.toggleInvincibility() ? 'Invincibility enabled // health locked at full' : 'Invincibility disabled // condition pressure restored'));
    this.bind('grid-lab-infinite-stamina', () => this.log(a.toggleInfiniteStamina() ? 'Infinite stamina enabled' : 'Stamina simulation restored'));
    this.bind('grid-lab-ground-speed', () => this.log(`Ground movement // ${a.cycleGroundSpeed()}`));
    this.bind('grid-lab-flight', () => this.log(a.toggleFlight() ? 'Noclip flight enabled // collision and gravity bypassed' : 'Noclip flight disabled // terrain contact restored'));
    this.bind('grid-lab-speed', () => this.log(`Flight velocity // ${a.cycleFlightSpeed()} M/S`));
    this.bind('grid-lab-flashlight', () => this.log(a.toggleFlashlight() ? 'Field light active' : 'Field light stowed'));
    this.bind('grid-lab-fov-down', () => this.log(`Camera field of view // ${Math.round(a.adjustFov(-5))}°`));
    this.bind('grid-lab-fov-up', () => this.log(`Camera field of view // ${Math.round(a.adjustFov(5))}°`));
    this.bind('grid-lab-fov-reset', () => this.log(`Camera field of view reset // ${Math.round(a.resetFov())}°`));
    this.bind('grid-lab-ground-snap', () => {
      a.snapToGround();
      this.log('Recovery complete // player snapped to walkable ground');
    });
    this.bind('grid-lab-travel', () => this.log(`Transit complete // ${a.travel(this.travelSelect.value)}`));
    this.bind('grid-lab-settlement', () => this.log(`Transit complete // ${a.nextSettlement()}`));
    this.bind('grid-lab-echo', () => this.log(`Echo approach // ${a.nextEcho()}`));
    this.bind('grid-lab-bookmark', () => this.log(a.bookmark()));
    this.bind('grid-lab-return-bookmark', () => this.log(a.returnBookmark()));
    this.bind('grid-lab-jump', () => {
      const x = Number(this.xInput.value);
      const z = Number(this.zInput.value);
      const y = optionalNumber(this.yInput);
      const yaw = optionalNumber(this.yawInput);
      this.log(
        a.jump(x, z, y, yaw)
          ? `Position injected // ${signed(x)} / ${y === undefined ? 'GROUND' : signed(y)} / ${signed(z)}${yaw === undefined ? '' : ` // ${Math.round(yaw)}°`}`
          : 'Position rejected // enter finite world coordinates',
      );
    });
    this.bind('grid-lab-freeze', () => this.log(a.toggleClock() ? 'World clock held' : 'World clock released'));
    this.bind('grid-lab-time-scale', () => this.log(`World time scale // ${a.cycleTimeScale()}X`));
    for (const [scale, id] of SCALE_BUTTONS) this.bind(`grid-lab-time-scale-${id}`, () => this.log(`World time scale // ${a.setTimeScale(scale)}X`));
    this.bind('grid-lab-time-mode', () => this.log(`World visual cadence // ${a.cycleTimeUpdateMode().toUpperCase()}`));
    this.bind('grid-lab-time-back', () => this.stepTime(-60, 'World time stepped backward one hour'));
    this.bind('grid-lab-time-forward', () => this.stepTime(60, 'World time stepped forward one hour'));
    this.bind('grid-lab-day-forward', () => this.stepTime(1440, 'World time stepped forward one day'));
    this.bind('grid-lab-dawn', () => this.setTime(360, 'Dawn'));
    this.bind('grid-lab-noon', () => this.setTime(720, 'Noon'));
    this.bind('grid-lab-dusk', () => this.setTime(1080, 'Dusk'));
    this.bind('grid-lab-midnight', () => this.setTime(0, 'Midnight'));
    this.bind('grid-lab-weather', () => this.log(`Weather authority // ${a.cycleWeather()}`));
    for (const id of ['auto', 'clear', 'overcast', 'rain', 'fog', 'wind']) this.bind(`grid-lab-weather-${id}`, () => this.log(`Weather authority // ${a.setWeather(id === 'auto' ? null : id)}`));
    this.bind('grid-lab-ai-freeze', () => this.log(a.toggleAiFreeze() ? 'Resident and wildlife motion frozen' : 'Resident and wildlife motion live'));
    this.bind('grid-lab-echo-freeze', () => this.log(a.toggleEchoFreeze() ? 'Whisperglass motion frozen' : 'Whisperglass motion live'));
    this.bind('grid-lab-kit', () => {
      a.grantKit();
      this.log('Bounded field kit issued to sandbox inventory');
    });
    this.bind('grid-lab-max-inventory', () => {
      a.maxInventory();
      this.log('All inventory stacks filled to their legal maximum');
    });
    this.bind('grid-lab-clear-inventory', () => {
      a.clearInventory();
      this.log('Sandbox inventory cleared');
    });
    this.bind('grid-lab-vitals', () => {
      a.resetVitals();
      this.log('Vitals normalized // 100 / 0 / 0');
    });
    for (const preset of ['healthy', 'injured', 'soaked', 'hypothermic', 'critical']) this.bind(`grid-lab-condition-${preset}`, () => this.log(`Condition preset // ${a.setCondition(preset)}`));
    this.bind('grid-lab-intel', () => {
      a.revealIntel();
      this.log('Atlas, Whisperglass bearings and field guide revealed inside sandbox');
    });
    this.bind('grid-lab-complete-contracts', () => {
      a.completeContracts();
      this.log('All sandbox contracts filed');
    });
    this.bind('grid-lab-reset-contracts', () => {
      a.resetContracts();
      this.log('Sandbox contracts reset to Field Calibration');
    });
    this.bind('grid-lab-respawn', () => {
      a.respawnResources();
      this.log('Authored gatherables respawned inside sandbox');
    });
    this.bind('grid-lab-relays', () => this.log(`Memory-only relay preview // ${a.cycleRelaySimulation()}`));
    this.bind('grid-lab-quality', () => this.log(`Render profile // ${a.cycleQuality()}`));
    for (const q of QUALITY_IDS) this.bind(`grid-lab-quality-${q}`, () => this.log(`Render profile // ${a.setQuality(q)}`));
    for (const [id, feature, label] of FEATURES) this.bind(id, () => this.log(`${label} // ${a.toggleRenderFeature(feature) ? 'ON' : 'OFF'}`));
    this.bind('grid-lab-view-radius', () => this.log(`Streaming view radius // ${a.cycleViewRadius()} chunks`));
    this.bind('grid-lab-build-budget', () => this.log(`Chunk build budget // ${a.cycleBuildBudget()} per frame`));
    this.bind('grid-lab-reload-chunks', () => {
      a.reloadChunks();
      this.log('Local chunk window dropped and deterministically rebuilt');
    });
    this.bind('grid-lab-cinematic', () => this.log(a.toggleCinematic() ? 'Cinematic visor // HUD suppressed' : 'Field visor // HUD restored'));
    this.bind('grid-lab-stamp-kind', () => this.log(`Stamp selected // ${a.cycleStamp().replaceAll('_', ' ')}`));
    this.bind('grid-lab-stamp-place', () => {
      const result = a.placeStamp();
      this.log(`${result.ok ? 'STAMP WRITTEN' : 'STAMP REJECTED'} // ${result.reason}`);
    });
    this.bind('grid-lab-stamp-undo', () => this.log(a.undoStamp()));
    this.bind('grid-lab-copy', () => this.copyTrace());
    this.bind('grid-lab-discard', () => {
      if (!window.confirm('Discard the isolated GRID LAB campaign sandbox? Persistent field-stamp layouts are kept.')) return;
      if (a.discard()) {
        this.status.textContent = 'SANDBOX DISCARDED // RELOADING FIELD RECORD';
        this.log('Sandbox discarded. Campaign, relay, and layout records were not touched.');
      }
    });
    this.bind('grid-lab-commit', () => this.commit());
  }

  update(dt) {
    if (!this.open) return;
    this.elapsed += dt;
    if (this.commitArmedUntil > 0 && performance.now() > this.commitArmedUntil) this.disarmCommit();
    if (this.elapsed >= 0.15) {
      this.elapsed = 0;
      this.refresh();
    }
  }

  destroy() {
    document.removeEventListener('keydown', this.onGlobalKey, true);
    for (const off of this.listeners) off();
    this.listeners.length = 0;
  }

  toggle() {
    if (!this.actions.sandboxActive()) this.actions.begin();
    this.setOpen(!this.open);
  }

  setOpen(open) {
    if (open && !this.actions.sandboxActive()) this.actions.begin();
    this.open = open;
    this.root.classList.toggle('grid-lab--visible', open);
    this.root.setAttribute('aria-hidden', String(!open));
    this.actions.onPanelChange(open);
    if (open) {
      this.selectTab(this.activeTab);
      this.status.textContent = 'SANDBOX ACTIVE // CAMPAIGN ISOLATED';
      this.log('GRID LAB linked. Runtime overrides remain active when you return to the field.');
      this.elapsed = Infinity;
      byId('grid-lab-close').focus();
    } else {
      this.disarmCommit();
    }
  }

  bind(id, handler) {
    const el = byId(id);
    el.addEventListener('click', handler);
    this.listeners.push(() => el.removeEventListener('click', handler));
  }

  bindTabsAndSearch() {
    for (const tab of this.root.querySelectorAll('[data-grid-tab]')) {
      const select = () => this.selectTab(tab.dataset.gridTab ?? 'player');
      tab.addEventListener('click', select);
      this.listeners.push(() => tab.removeEventListener('click', select));
    }
    const filter = () => {
      const term = this.search.value.trim().toLowerCase();
      this.root.classList.toggle('grid-lab--searching', term.length > 0);
      let matches = 0;
      for (const control of this.root.querySelectorAll('.dev-control')) {
        const show = term.length === 0 || (control.textContent ?? '').toLowerCase().includes(term) || control.id.toLowerCase().includes(term);
        control.hidden = !show;
        if (show) matches += 1;
      }
      for (const pane of this.root.querySelectorAll('[data-grid-pane]')) {
        const show = term.length === 0 ? pane.dataset.gridPane === this.activeTab : !!pane.querySelector('.dev-control:not([hidden])');
        pane.hidden = !show;
        pane.setAttribute('aria-hidden', String(!show));
      }
      if (term) this.log(`${matches} command${matches === 1 ? '' : 's'} match “${term}”`);
    };
    this.search.addEventListener('input', filter);
    this.listeners.push(() => this.search.removeEventListener('input', filter));
  }

  selectTab(name) {
    const tabs = [...this.root.querySelectorAll('[data-grid-tab]')];
    if (!tabs.some((t) => t.dataset.gridTab === name)) return;
    this.activeTab = name;
    this.search.value = '';
    this.root.classList.remove('grid-lab--searching');
    for (const control of this.root.querySelectorAll('.dev-control')) control.hidden = false;
    for (const tab of tabs) {
      const active = tab.dataset.gridTab === name;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    }
    for (const pane of this.root.querySelectorAll('[data-grid-pane]')) {
      const show = pane.dataset.gridPane === name;
      pane.hidden = !show;
      pane.setAttribute('aria-hidden', String(!show));
    }
    this.paneViewport.scrollTop = 0;
  }

  populateTravelTargets() {
    const groups = new Map();
    for (const target of this.actions.travelTargets) {
      let group = groups.get(target.group);
      if (!group) {
        group = document.createElement('optgroup');
        group.label = target.group;
        groups.set(target.group, group);
        this.travelSelect.append(group);
      }
      const option = document.createElement('option');
      option.value = target.id;
      option.textContent = `${target.label} // ${Math.round(target.x)}, ${Math.round(target.z)}`;
      group.append(option);
    }
  }

  setTime(minuteOfDay, label) {
    this.actions.setTime(minuteOfDay);
    this.log(`Chronology pinned // ${label.toUpperCase()}`);
  }

  stepTime(minutes, message) {
    this.actions.stepTime(minutes);
    this.log(message);
  }

  commit() {
    const now = performance.now();
    if (this.commitArmedUntil <= now) {
      this.commitArmedUntil = now + 5000;
      this.commitButton.textContent = 'CONFIRM COMMIT';
      this.commitButton.classList.add('is-armed');
      this.log('Commit armed for five seconds // activate again to replace the campaign record');
      return;
    }
    if (this.actions.commit()) {
      this.status.textContent = 'COMMIT COMPLETE // RELOADING CAMPAIGN';
      this.commitButton.textContent = 'COMMITTED';
      this.commitButton.disabled = true;
      this.log('Normalized campaign state committed. Relay, layout, and runtime overrides remained separate.');
    } else {
      this.disarmCommit();
      this.log('Commit failed // browser storage rejected the write');
    }
  }

  disarmCommit() {
    this.commitArmedUntil = 0;
    if (!this.commitButton.disabled) this.commitButton.textContent = 'COMMIT SANDBOX';
    this.commitButton.classList.remove('is-armed');
  }

  log(message) {
    this.logElement.textContent = message;
    this.elapsed = Infinity;
  }

  setState(buttonId, stateId, active, text) {
    const button = byId(buttonId);
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
    byId(stateId).textContent = text;
  }

  setSelected(id, active) {
    const el = byId(id);
    el.classList.toggle('is-active', active);
    el.setAttribute('aria-pressed', String(active));
  }

  refresh() {
    const t = this.actions.telemetry();
    const values = {
      'grid-lab-renderer': t.renderer,
      'grid-lab-quality-value': t.quality,
      'grid-lab-fps': `${Math.round(t.fps)} FPS // ${(1000 / Math.max(1, t.fps)).toFixed(1)} MS`,
      'grid-lab-draws': String(t.drawCalls),
      'grid-lab-triangles': t.triangles.toLocaleString(),
      'grid-lab-chunks': `${t.loadedChunks} LIVE / ${t.pendingChunks} QUEUED${t.worker ? ' // WORKER' : ' // MAIN THREAD'}`,
      'grid-lab-position': `${signed(t.x)} / ${signed(t.y)} / ${signed(t.z)}`,
      'grid-lab-heading': `${String(Math.round(t.heading) % 360).padStart(3, '0')}°`,
      'grid-lab-movement': t.movement,
      'grid-lab-environment': `${t.worldTime} // ${t.weather}`,
      'grid-lab-celestial': t.celestial,
      'grid-lab-condition': `${Math.round(t.health)} H / ${Math.round(t.wetness)} W / ${Math.round(t.cold)} C`,
      'grid-lab-intel-value': `${t.guideKnown} / ${t.guideTotal} GUIDE // ${t.echoCount} / 6 ECHOES`,
      'grid-lab-inventory': `${t.inventoryTotal} ITEMS`,
      'grid-lab-progression': `${t.contractCount} / ${t.contractTotal} CONTRACTS // RELAYS ${t.relayState}`,
      'grid-lab-stamps': `${t.stampCount} / 128 // ${t.selectedStamp.replaceAll('_', ' ').toUpperCase()}`,
    };
    for (const [id, value] of Object.entries(values)) byId(id).textContent = value;
    this.setState('grid-lab-invincible', 'grid-lab-invincible-state', t.invincible, t.invincible ? 'ON' : 'OFF');
    this.setState('grid-lab-infinite-stamina', 'grid-lab-stamina-state', t.infiniteStamina, t.infiniteStamina ? 'LOCKED 100' : 'OFF');
    this.setState('grid-lab-flight', 'grid-lab-flight-state', t.flight, t.flight ? 'ON' : 'OFF');
    this.setState('grid-lab-flashlight', 'grid-lab-flashlight-state', t.flashlight, t.flashlight ? 'ON' : 'OFF');
    this.setState('grid-lab-freeze', 'grid-lab-freeze-state', t.clockFrozen, t.clockFrozen ? 'HELD' : 'RUNNING');
    this.setState('grid-lab-ai-freeze', 'grid-lab-ai-state', t.aiFrozen, t.aiFrozen ? 'FROZEN' : 'LIVE');
    this.setState('grid-lab-echo-freeze', 'grid-lab-echo-state', t.echoFrozen, t.echoFrozen ? 'FROZEN' : 'LIVE');
    this.setState('grid-lab-cinematic', 'grid-lab-cinematic-state', t.cinematic, t.cinematic ? 'ON' : 'OFF');
    byId('grid-lab-ground-speed-state').textContent = t.groundSpeed;
    byId('grid-lab-flight-speed-state').textContent = `${t.flightSpeed} M/S`;
    byId('grid-lab-fov-state').textContent = `${Math.round(t.fov)}°`;
    byId('grid-lab-time-scale-state').textContent = `${t.timeScale}X`;
    for (const [scale, id] of SCALE_BUTTONS) this.setSelected(`grid-lab-time-scale-${id}`, t.timeScale === scale);
    byId('grid-lab-time-mode-state').textContent = t.timeUpdateMode === 'smooth' ? 'SMOOTH // FRAME' : 'STEPPED // 4 HZ';
    this.setSelected('grid-lab-time-mode', t.timeUpdateMode === 'smooth');
    byId('grid-lab-relay-state').textContent = t.relayState;
    byId('grid-lab-radius-state').textContent = `${t.viewRadius} CHUNKS // FAR ${(t.drawDistance / 1000).toFixed(1)} KM`;
    byId('grid-lab-budget-state').textContent = `${t.buildBudget} / FRAME`;
    this.setSelected('grid-lab-ground-speed', !t.groundSpeed.startsWith('NORMAL'));
    for (const id of ['auto', 'clear', 'overcast', 'rain', 'fog', 'wind']) this.setSelected(`grid-lab-weather-${id}`, t.weatherMode === id.toUpperCase());
    for (const q of QUALITY_IDS) this.setSelected(`grid-lab-quality-${q}`, t.qualityId === q);
    for (const [id, feature] of FEATURES) this.setState(id, `${id}-state`, t.renderFeatures[feature], t.renderFeatures[feature] ? 'ON' : 'OFF');
    this.trace.textContent = JSON.stringify(
      {
        schema: 'stillpoint-grid-trace:v3',
        renderer: { backend: t.renderer, quality: t.quality, features: t.renderFeatures },
        player: {
          position: { x: Number(t.x.toFixed(2)), y: Number(t.y.toFixed(2)), z: Number(t.z.toFixed(2)), heading: Number(t.heading.toFixed(1)) },
          movement: t.movement,
          groundSpeed: t.groundSpeed,
          invincible: t.invincible,
          infiniteStamina: t.infiniteStamina,
          fov: Math.round(t.fov),
        },
        stream: { loaded: t.loadedChunks, pending: t.pendingChunks, nearRadius: t.viewRadius, drawDistance: t.drawDistance, buildBudget: t.buildBudget, worker: t.worker },
        frame: { fps: Math.round(t.fps), drawCalls: t.drawCalls, triangles: t.triangles },
        environment: { time: t.worldTime, weather: t.weather, source: t.weatherMode, frozen: t.clockFrozen, scale: t.timeScale, cadence: t.timeUpdateMode },
        simulation: { aiFrozen: t.aiFrozen, echoFrozen: t.echoFrozen, relayPreview: t.relayState },
        content: { guideKnown: t.guideKnown, echoes: t.echoCount, stamps: t.stampCount, contracts: t.contractCount },
      },
      null,
      2,
    );
  }

  async copyTrace() {
    try {
      await navigator.clipboard.writeText(this.trace.textContent ?? '');
      this.log('Normalized trace copied');
    } catch {
      this.log('Clipboard unavailable // trace remains selectable');
    }
  }
}
