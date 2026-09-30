/**
 * hud.js — the DOM overlay: title screen, field HUD (vitals, compass,
 * objective, relays, contracts), interaction prompt, toasts, the field
 * tablet (local map, territory atlas, contracts, inventory, guide) and the
 * button prompts, which follow the device in use (keyboard, gamepad, touch).
 * Every write is skipped when the value has not changed.
 */
import { wrapDegrees, compassLabel, mapPercent } from './data.js';

const byId = (id) => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Required UI element #${id} is missing.`);
  return el;
};

export const PROMPTS = {
  keyboard: { move: 'WASD', look: 'MOUSE', sprint: 'SHIFT', jump: 'SPACE', crouch: 'C / CTRL', interact: 'E', light: 'L', tablet: 'M', waypoint: 'N', transit: 'T', gear: 'X', deploy: 'G', recipe: 'K', medkit: 'H', save: 'R', quality: 'Q', pause: 'ESC / P', lab: 'F2' },
  gamepad: { move: 'L STICK', look: 'R STICK', sprint: 'L3', jump: 'A', crouch: 'B', interact: 'X', light: 'R3', tablet: 'Y', waypoint: 'TABLET', transit: 'TABLET', gear: 'LT', deploy: 'RB', recipe: 'RT', medkit: 'LB', save: 'START', quality: 'START', pause: 'START', lab: 'START' },
  touch: { move: 'LEFT STICK', look: 'DRAG', sprint: 'SPRINT', jump: 'JUMP', crouch: 'CROUCH', interact: 'USE', light: 'LIGHT', tablet: 'TABLET', waypoint: 'TABLET', transit: 'TABLET', gear: 'TABLET', deploy: 'TABLET', recipe: 'TABLET', medkit: 'TABLET', save: 'II MENU', quality: 'II MENU', pause: 'II', lab: 'II MENU' },
};

export const CONTROL_LABELS = {
  move: 'Move',
  look: 'Look',
  sprint: 'Sprint',
  jump: 'Jump',
  crouch: 'Crouch',
  interact: 'Interact',
  light: 'Field light',
  tablet: 'Field tablet',
  waypoint: 'Atlas waypoint',
  transit: 'Transit',
  gear: 'Cycle gear',
  deploy: 'Deploy gear',
  recipe: 'Cycle recipe',
  medkit: 'Use medkit',
  save: 'Save record',
  quality: 'Quality',
  pause: 'Pause menu',
  lab: 'GRID LAB',
};

const RIBBON = [
  { label: 'TRAVERSE', items: [['move'], ['look'], ['sprint'], ['jump'], ['crouch', true]] },
  { label: 'FIELD', items: [['interact'], ['light', true], ['waypoint', true], ['transit', true], ['gear', true], ['deploy', true], ['medkit', true], ['recipe', true]] },
  { label: 'ACCESS', items: [['tablet'], ['save', true], ['pause'], ['lab', false, true]] },
];

const TABLET_HINTS = {
  keyboard: 'N WAYPOINT · T TRANSIT · K RECIPE · X GEAR · G DEPLOY · H MEDKIT · M CLOSE',
  gamepad: 'STICK / D-PAD SELECT · A ACTIVATE · B OR Y CLOSE · LB MEDKIT · LT GEAR · RB DEPLOY · RT RECIPE',
  touch: 'TAP AN OPERATION · CLOSE TO RETURN TO THE FIELD',
};

function setBar(bar, value, number) {
  const v = Math.max(0, Math.min(100, Number.isFinite(number) ? number : 0));
  const rounded = Math.round(v);
  if (bar.dataset.v === String(rounded)) return;
  bar.dataset.v = String(rounded);
  bar.style.width = `${v}%`;
  value.textContent = String(rounded);
}

export class Hud {
  constructor() {
    this.boot = byId('boot');
    this.bootStatus = byId('boot-status-text');
    this.enterButton = byId('enter-button');
    this.enterHint = byId('enter-hint');
    this.newButton = byId('new-button');
    this.controlsGrid = byId('controls-grid');
    this.hud = byId('hud');
    this.objective = byId('objective-text');
    this.challengeList = byId('challenge-list');
    this.contractMiniList = byId('contract-mini-list');
    this.renderer = byId('renderer-value');
    this.quality = byId('quality-value');
    this.fps = byId('fps-value');
    this.position = byId('position-value');
    this.compassLeft = byId('compass-left');
    this.compassMain = byId('compass-main');
    this.compassRight = byId('compass-right');
    this.interaction = byId('interaction');
    this.interactionKey = byId('interaction-key');
    this.interactionLabel = byId('interaction-label');
    this.interactionProgress = byId('interaction-progress');
    this.crosshair = byId('crosshair');
    this.toastElement = byId('toast');
    this.toastKicker = byId('toast-kicker');
    this.toastTitle = byId('toast-title');
    this.toastDetail = byId('toast-detail');
    this.lookHint = byId('look-hint');
    this.fatal = byId('fatal');
    this.fatalMessage = byId('fatal-message');
    this.tablet = byId('tablet');
    this.tabletHint = byId('tablet-hint');
    this.location = byId('location-value');
    this.biome = byId('biome-value');
    this.navigationTarget = byId('navigation-target');
    this.navigationBearing = byId('navigation-bearing');
    this.navigationDistance = byId('navigation-distance');
    this.worldTime = byId('world-time');
    this.weather = byId('weather-value');
    this.temperature = byId('temperature-value');
    this.wind = byId('wind-value');
    this.healthBar = byId('health-bar');
    this.healthValue = byId('health-value');
    this.staminaBar = byId('stamina-bar');
    this.staminaValue = byId('stamina-value');
    this.wetnessBar = byId('wetness-bar');
    this.wetnessValue = byId('wetness-value');
    this.coldBar = byId('cold-bar');
    this.coldValue = byId('cold-value');
    this.quickInventory = byId('quick-inventory');
    this.tabletContracts = byId('tablet-contracts');
    this.tabletInventory = byId('tablet-inventory');
    this.tabletGuide = byId('tablet-guide');
    this.contractTotal = byId('contract-total');
    this.inventoryWeight = byId('inventory-weight');
    this.guideTotal = byId('guide-total');
    this.tabletLocation = byId('tablet-location');
    this.tabletLight = byId('tablet-light');
    this.mapMarkers = byId('map-markers');
    this.mapPlayer = byId('map-player');
    this.atlasMarkers = byId('atlas-markers');
    this.atlasPlayer = byId('atlas-player');
    this.atlasWaypoint = byId('atlas-waypoint');
    this.atlasRevealed = byId('atlas-revealed');
    this.fieldOperations = byId('field-operations');
    this.fieldReputation = byId('field-reputation');
    this.gridLabIndicator = byId('grid-lab-indicator');
    this.ribbon = byId('control-ribbon');
    this.toastTimer = undefined;
    this.tabletOpen = false;
    this.cache = new Map();
    this.source = 'keyboard';
    this.enterHandler = null;
    this.newHandler = null;
  }

  /** True (and remembered) when `value` differs from the last one stored under `key`. */
  changed(key, value) {
    if (this.cache.get(key) === value) return false;
    this.cache.set(key, value);
    return true;
  }

  text(el, key, value) {
    if (this.changed(key, value)) el.textContent = value;
  }

  get isTabletOpen() {
    return this.tabletOpen;
  }

  /* ------------------------------------------------------------ title */

  setBootStatus(text) {
    this.bootStatus.textContent = text;
  }

  markReady({ hasSave, onEnter, onNew }) {
    if (this.enterHandler) this.enterButton.removeEventListener('click', this.enterHandler);
    if (this.newHandler) this.newButton.removeEventListener('click', this.newHandler);
    this.enterHandler = onEnter;
    this.newHandler = onNew;
    this.enterButton.disabled = false;
    this.enterButton.querySelector('span').textContent = hasSave ? 'CONTINUE EXPEDITION' : 'ENTER THE FRONTIER';
    this.enterButton.addEventListener('click', this.enterHandler);
    this.newButton.hidden = !hasSave;
    this.newButton.addEventListener('click', this.newHandler);
    this.setBootStatus(hasSave ? 'Field record found // continue where the last link dropped' : 'First rendered frame verified // field systems online');
  }

  armNewExpedition(armed) {
    this.newButton.classList.toggle('is-armed', armed);
    this.newButton.querySelector('span').textContent = armed ? 'CONFIRM: ERASE THE FIELD RECORD' : 'NEW EXPEDITION';
  }

  enterGame() {
    this.boot.classList.remove('screen--visible');
    this.boot.setAttribute('aria-hidden', 'true');
    this.hud.classList.add('hud--visible');
    this.hud.setAttribute('aria-hidden', 'false');
  }

  /* ---------------------------------------------------------- prompts */

  /** Rebuild every prompt for 'keyboard' | 'gamepad' | 'touch'. */
  setInputSource(source) {
    const src = PROMPTS[source] ? source : 'keyboard';
    this.source = src;
    const p = PROMPTS[src];
    document.documentElement.dataset.input = src;
    this.text(this.interactionKey, 'ikey', p.interact);
    this.text(this.tabletHint, 'thint', TABLET_HINTS[src]);
    this.text(this.enterHint, 'ehint', src === 'gamepad' ? 'Press A to begin' : src === 'touch' ? 'Tap to begin' : 'Click to capture the mouse');

    this.controlsGrid.replaceChildren(
      ...Object.keys(CONTROL_LABELS)
        .filter((id) => !(src !== 'keyboard' && p[id] === p.pause && id !== 'pause' && id !== 'save'))
        .map((id) => {
          const cell = document.createElement('div');
          const key = document.createElement('kbd');
          key.textContent = p[id];
          const label = document.createElement('span');
          label.textContent = CONTROL_LABELS[id];
          cell.append(key, label);
          return cell;
        }),
    );

    const title = document.createElement('span');
    title.className = 'control-ribbon__title';
    title.textContent = src === 'gamepad' ? 'CONTROLLER' : 'CORE CONTROLS';
    const groups = RIBBON.map((group) => {
      const g = document.createElement('span');
      g.className = 'control-ribbon__group';
      g.setAttribute('role', 'group');
      const gl = document.createElement('span');
      gl.className = 'control-ribbon__group-label';
      gl.textContent = group.label;
      g.append(gl);
      for (const [id, secondary, dev] of group.items) {
        if (src === 'gamepad' && p[id] === 'TABLET') continue;
        const chip = document.createElement('span');
        chip.className = `control-chip${secondary ? ' control-chip--secondary' : ''}${dev ? ' control-chip--dev' : ''}`;
        const k = document.createElement('kbd');
        k.textContent = p[id];
        const l = document.createElement('span');
        l.textContent = CONTROL_LABELS[id].toUpperCase();
        chip.append(k, l);
        g.append(chip);
      }
      return g;
    });
    this.ribbon.replaceChildren(title, ...groups);
  }

  setLookHint(show) {
    if (this.changed('lookHint', show)) this.lookHint.classList.toggle('look-hint--visible', show);
  }

  /* -------------------------------------------------------------- HUD */

  setGridLab(active, panelOpen = false) {
    this.gridLabIndicator.classList.toggle('grid-lab-indicator--visible', active);
    this.hud.classList.toggle('hud--grid-lab', panelOpen);
    if (panelOpen) this.toggleTablet(false);
  }

  setCinematic(on) {
    this.hud.classList.toggle('hud--cinematic', on);
  }

  setMenuOpen(on) {
    this.hud.classList.toggle('hud--menu', on);
  }

  setObjective(text) {
    this.text(this.objective, 'objective', text);
  }

  setChallenges(rows) {
    this.challengeList.replaceChildren(
      ...rows.map((row) => {
        const div = document.createElement('div');
        div.className = `challenge-row challenge-row--${row.state}`;
        const icon = document.createElement('i');
        const label = document.createElement('span');
        label.textContent = `${row.title}${row.progress ? ` // ${row.progress}` : ''}`;
        div.append(icon, label);
        return div;
      }),
    );
  }

  setEnvironment(env) {
    this.text(this.worldTime, 'time', env.time);
    this.text(this.weather, 'weather', env.weather.toUpperCase());
    this.text(this.temperature, 'temp', env.temperature);
    this.text(this.wind, 'wind', env.wind);
    if (this.changed('phase', env.phase)) document.documentElement.dataset.phase = env.phase;
  }

  setFrontierState(e) {
    setBar(this.healthBar, this.healthValue, e.health);
    setBar(this.staminaBar, this.staminaValue, e.stamina);
    setBar(this.wetnessBar, this.wetnessValue, e.wetness);
    setBar(this.coldBar, this.coldValue, e.cold);
    this.text(this.location, 'location', e.location.toUpperCase());
    this.text(this.biome, 'biome', e.biome.toUpperCase());
    this.text(this.tabletLocation, 'tabletLocation', e.location.toUpperCase());
    if (this.changed('flashlight', e.flashlight)) {
      this.tabletLight.textContent = e.flashlight ? 'FIELD LIGHT ON' : 'FIELD LIGHT OFF';
      this.tabletLight.classList.toggle('is-active', e.flashlight);
    }
    if (e.target) {
      this.text(this.navigationTarget, 'navTarget', e.target.name.toUpperCase());
      this.text(this.navigationBearing, 'navBearing', `${String(Math.round(wrapDegrees(e.target.bearing)) % 360).padStart(3, '0')}°`);
      this.text(this.navigationDistance, 'navDistance', e.target.distance);
    }

    const quick = e.inventory.slice(0, 5);
    if (this.changed('quick', quick.map((s) => `${s.id}:${s.quantity}`).join('|'))) {
      this.quickInventory.replaceChildren(
        ...quick.map((s) => {
          const span = document.createElement('span');
          const count = document.createElement('i');
          count.textContent = String(s.quantity);
          span.append(count, s.name.toUpperCase());
          return span;
        }),
      );
    }
    if (this.changed('inventory', e.inventory.map((s) => `${s.id}:${s.quantity}`).join('|'))) {
      this.tabletInventory.replaceChildren(
        ...e.inventory.map((s) => {
          const row = document.createElement('div');
          row.className = 'inventory-row';
          row.innerHTML = `<span><i>${s.category}</i>${s.name}</span><strong>${s.quantity}</strong>`;
          return row;
        }),
      );
      if (e.inventory.length === 0) this.tabletInventory.append(this.emptyRow('No carried field inventory'));
    }
    this.text(this.inventoryWeight, 'weight', `${e.weight.toFixed(1)} KG`);

    const filed = e.contracts.filter((c) => c.complete).length;
    this.text(this.contractTotal, 'contractTotal', `${filed} / ${e.contracts.length}`);
    if (this.changed('contracts', e.contracts.map((c) => `${c.id}:${c.status}:${c.completed}:${c.next}`).join('|'))) {
      this.contractMiniList.replaceChildren(
        ...e.contracts
          .filter((c) => c.status !== 'locked')
          .map((c) => {
            const div = document.createElement('div');
            div.className = `contract-mini ${c.complete ? 'is-complete' : ''} ${c.status === 'ready' ? 'is-ready' : ''}`;
            div.textContent = `${c.code} // ${c.completed}/${c.total}`;
            return div;
          }),
      );
      this.tabletContracts.replaceChildren(
        ...e.contracts.map((c) => {
          const card = document.createElement('article');
          card.className = `contract-card is-${c.status}`;
          card.innerHTML = `<header><i>${c.code}</i><strong>${c.title}</strong><span>${c.completed}/${c.total}</span></header><p>${c.next}</p>`;
          return card;
        }),
      );
    }

    const known = e.guide.filter((g) => g.known).length;
    this.text(this.guideTotal, 'guideTotal', `${known} / ${e.guide.length}`);
    if (this.changed('guide', e.guide.map((g) => (g.known ? 1 : 0)).join(''))) {
      this.tabletGuide.replaceChildren(
        ...e.guide.map((g) => {
          const row = document.createElement('article');
          row.className = `guide-row ${g.known ? 'is-known' : ''}`;
          row.innerHTML = g.known ? `<i>${g.category.toUpperCase()}</i><strong>${g.name}</strong><p>${g.note}</p>` : '<i>UNRESOLVED</i><strong>— FIELD RECORD LOCKED —</strong>';
          return row;
        }),
      );
    }

    this.mapPlayer.style.left = `${mapPercent(e.player.x, e.mapHalfExtent)}%`;
    this.mapPlayer.style.top = `${mapPercent(e.player.z, e.mapHalfExtent)}%`;
    if (this.changed('markers', e.markers.map((m) => `${m.id}:${m.discovered ? 1 : 0}${m.complete ? 1 : 0}`).join('|'))) {
      this.mapMarkers.replaceChildren(
        ...e.markers.map((m) => {
          const div = document.createElement('div');
          div.className = `map-marker map-marker--${m.kind}${m.complete ? ' is-complete' : ''}${m.discovered ? ' is-discovered' : ''}`;
          div.style.left = `${mapPercent(m.x, e.mapHalfExtent)}%`;
          div.style.top = `${mapPercent(m.z, e.mapHalfExtent)}%`;
          div.title = m.name;
          div.innerHTML = `<i></i><span>${m.discovered || m.kind === 'relay' ? m.name : 'UNVERIFIED'}</span>`;
          return div;
        }),
      );
    }

    this.atlasPlayer.style.left = `${mapPercent(e.player.x, e.atlasHalfExtent)}%`;
    this.atlasPlayer.style.top = `${mapPercent(e.player.z, e.atlasHalfExtent)}%`;
    this.text(this.atlasRevealed, 'atlasRevealed', `${e.atlasRevealed} / ${e.atlasTotal} LINKS`);
    if (this.changed('atlas', e.atlasMarkers.map((m) => `${m.id}:${m.revealed ? 1 : 0}${m.selected ? 1 : 0}${m.recorded ? 1 : 0}`).join('|'))) {
      this.atlasMarkers.replaceChildren(
        ...e.atlasMarkers.map((m) => {
          const div = document.createElement('div');
          div.className = `atlas-marker atlas-marker--${m.tier}${m.revealed ? ' is-revealed' : ''}${m.selected ? ' is-selected' : ''}${m.recorded ? ' is-recorded' : ''}`;
          div.style.left = `${mapPercent(m.x, e.atlasHalfExtent)}%`;
          div.style.top = `${mapPercent(m.z, e.atlasHalfExtent)}%`;
          div.title = m.revealed ? m.name : 'Unresolved territory link';
          return div;
        }),
      );
    }
    this.text(
      this.atlasWaypoint,
      'waypoint',
      e.waypoint ? `${e.waypoint.name.toUpperCase()} // ${e.waypoint.distance} // ${e.waypoint.economy.toUpperCase()}` : 'NO WAYPOINT // CYCLE A DESTINATION, RESTORE RELAYS TO REVEAL THE ATLAS',
    );
    const ops = `${e.selectedRecipe.label}|${e.selectedRecipe.station}|${e.selectedRecipe.ready}|${e.selectedRecipe.ingredients}|${e.selectedGear.name}|${e.selectedGear.quantity}|${e.deployments}|${e.echoes}`;
    if (this.changed('ops', ops)) {
      this.fieldOperations.innerHTML = `
      <div><i>RECIPE // SELECTED</i><strong>${e.selectedRecipe.label}</strong><span>${e.selectedRecipe.station.toUpperCase()} · ${e.selectedRecipe.ready ? 'READY' : e.selectedRecipe.ingredients}</span></div>
      <div><i>DEPLOYABLE // SELECTED</i><strong>${e.selectedGear.name}</strong><span>${e.selectedGear.quantity} READY · ${e.deployments} IN FIELD</span></div>
      <div><i>WHISPERGLASS NETWORK</i><strong>${e.echoes} / 6 ECHOES</strong><span>${e.echoes >= 6 ? 'ALL BEARINGS MEET BELOW THE STILLPOINT' : 'EACH ECHO RESOLVES THE NEXT BEARING'}</span></div>`;
    }
    this.text(this.fieldReputation, 'reputation', `MERIDIAN STANDING ${String(e.reputation).padStart(3, '0')}`);
  }

  toggleTablet(open) {
    this.tabletOpen = open ?? !this.tabletOpen;
    this.tablet.classList.toggle('tablet--visible', this.tabletOpen);
    this.tablet.setAttribute('aria-hidden', String(!this.tabletOpen));
    this.hud.classList.toggle('hud--tablet', this.tabletOpen);
    this.setInteraction(null);
    return this.tabletOpen;
  }

  setInteraction(label, progress = 0) {
    const visible = label !== null && !this.tabletOpen;
    if (this.changed('iVisible', visible)) {
      this.interaction.classList.toggle('interaction--visible', visible);
      this.crosshair.classList.toggle('crosshair--hot', visible);
    }
    if (label) this.text(this.interactionLabel, 'iLabel', label.toUpperCase());
    const width = Math.round(Math.max(0, Math.min(1, progress)) * 100);
    if (this.changed('iProgress', width)) this.interactionProgress.style.width = `${width}%`;
  }

  showToast(title, detail, kicker = 'FIELD LOG', ms = 3200) {
    window.clearTimeout(this.toastTimer);
    this.toastKicker.textContent = kicker;
    this.toastTitle.textContent = title;
    this.toastDetail.textContent = detail;
    this.toastElement.classList.add('toast--visible');
    this.toastTimer = window.setTimeout(() => {
      this.toastTimer = undefined;
      this.toastElement.classList.remove('toast--visible');
    }, ms);
  }

  updateTelemetry(t) {
    this.text(this.renderer, 'renderer', t.renderer);
    this.text(this.quality, 'quality', t.quality);
    this.text(this.fps, 'fps', `${Math.round(t.fps)} FPS`);
    const x = `${t.x >= 0 ? '+' : '−'}${Math.abs(t.x).toFixed(1).padStart(5, '0')}`;
    const z = `${t.z >= 0 ? '+' : '−'}${Math.abs(t.z).toFixed(1).padStart(5, '0')}`;
    this.text(this.position, 'position', `${x} / ${z}`);
    const heading = wrapDegrees(t.heading);
    this.text(this.compassMain, 'compassMain', compassLabel(heading));
    this.text(this.compassLeft, 'compassLeft', compassLabel(heading - 45));
    this.text(this.compassRight, 'compassRight', compassLabel(heading + 45));
    const rotate = Math.round(heading);
    if (this.changed('mapRotate', rotate)) this.mapPlayer.style.transform = `translate(-50%, -50%) rotate(${rotate}deg)`;
  }

  showFatal(error) {
    this.boot.classList.remove('screen--visible');
    this.hud.classList.remove('hud--visible');
    this.fatal.classList.add('screen--visible');
    this.fatal.setAttribute('aria-hidden', 'false');
    this.fatalMessage.textContent = error instanceof Error ? `${error.message}\n\n${error.stack ?? ''}` : String(error);
  }

  destroy() {
    if (this.enterHandler) this.enterButton.removeEventListener('click', this.enterHandler);
    if (this.newHandler) this.newButton.removeEventListener('click', this.newHandler);
    this.enterHandler = null;
    this.newHandler = null;
    window.clearTimeout(this.toastTimer);
    this.toastTimer = undefined;
  }

  emptyRow(text) {
    const p = document.createElement('p');
    p.className = 'empty-row';
    p.textContent = text;
    return p;
  }
}
