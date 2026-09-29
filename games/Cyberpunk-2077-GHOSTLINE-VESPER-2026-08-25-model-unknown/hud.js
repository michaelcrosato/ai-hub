/**
 * hud.js — every screen of GHOSTLINE: the HUD, the start, pause, character,
 * journal, vendor, dialogue, breach, ending and death screens, the minimap and
 * the performance readout.
 *
 * Menus are plain DOM buttons. Mouse and touch click them directly; keyboard
 * and gamepad move a focus highlight with the kit's actions (navUp/navDown…,
 * confirm, back, pause), so every screen works with every device.
 */

import { WEAPONS, ABILITIES, SKILLS, QUESTS, FACTIONS, LANDMARKS, districtAt, byId } from './content.js';
import { HACK_GLYPHS } from './combat.js';

const LABELS = {
  keyboard: { interact: 'E', reload: 'R', medpatch: 'F', scan: 'Q', blink: 'Z', overload: 'X', cloak: 'C', decoy: 'V', blackout: 'B' },
  gamepad: { interact: 'X', reload: 'X', medpatch: '↓', scan: 'RB', blink: 'LB', overload: '↑', cloak: '→', decoy: '←', blackout: 'R3' },
  touch: { interact: 'USE', reload: 'RELOAD', medpatch: 'MED', scan: '', blink: '', overload: '', cloak: '', decoy: '', blackout: '' },
};
const MENU_MODES = new Set(['pause', 'character', 'journal', 'vendor', 'dialogue', 'ending']);

export class Hud {
  mode = 'start';
  started = false;
  hackActive = false;
  hitTimer = 0;
  mapTimer = 0;
  cooldownProvider = () => 0;
  hackState = null;
  focusIndex = 0;
  focusEl = null;
  focusLayer = null;
  stickHeld = 0;
  stickRepeat = 0;
  wasLocked = false;
  fps = 0;
  fpsTimer = 0;
  lastSource = null;
  touchUi = null;
  suspended = null;
  touchLayoutDirty = true;

  constructor(root, kit, simulation, callbacks) {
    this.root = root;
    this.kit = kit;
    this.input = kit.input;
    this.simulation = simulation;
    this.callbacks = callbacks;
    const hasSave = callbacks.hasSave;
    root.innerHTML = `
      <div class="hud hidden" data-ui="hud">
        <div class="hud-top">
          <div class="hud-card">
            <div class="eyebrow">Vesper municipal ghostline</div>
            <div class="district" data-ui="district">Mercury Market</div>
            <div class="subtle" data-ui="district-subtitle"></div>
          </div>
          <div class="objective" data-ui="objective">NO ACTIVE JOB</div>
          <div class="hud-card right">
            <div class="eyebrow">Courier composite</div>
            <div><span data-ui="credits">0</span> \xA2 &nbsp; // &nbsp; LV <span data-ui="level">1</span></div>
            <div class="subtle">HEAT <span data-ui="heat">0</span>% \xB7 <span data-ui="weather">RAIN</span></div>
          </div>
        </div>
        <div class="crosshair" data-ui="crosshair"></div>
        <div class="prompt" data-ui="prompt"></div>
        <div class="notifications" data-ui="notifications"></div>
        <div class="hud-bottom">
          <div class="hud-card">
            <div class="eyebrow">Reconstructed vital mesh</div>
            <div class="bar-stack">
              <div class="bar-row"><span>BODY</span><div class="bar health"><i data-ui="health-bar"></i></div><span data-ui="health">100</span></div>
              <div class="bar-row"><span>WARD</span><div class="bar"><i data-ui="shield-bar"></i></div><span data-ui="shield">50</span></div>
              <div class="bar-row"><span>RAM</span><div class="bar energy"><i data-ui="energy-bar"></i></div><span data-ui="energy">100</span></div>
            </div>
          </div>
          <div class="hud-card verbs" style="min-width:320px;text-align:center">
            <div class="eyebrow">Implant verbs</div>
            <div class="subtle" data-ui="abilities">Q SCAN \xB7 Z BLINK \xB7 X OVERLOAD \xB7 C CLOAK \xB7 V DECOY</div>
          </div>
          <canvas class="minimap" data-ui="minimap" width="300" height="300"></canvas>
          <div class="hud-card right">
            <div class="eyebrow" data-ui="damage-type">KINETIC SIDEARM</div>
            <div class="district" data-ui="weapon">Kestrel-9</div>
            <div><span data-ui="magazine">14</span> / <span data-ui="reserve">84</span></div>
            <div class="subtle"><span data-ui="medpatch">3</span> MEDPATCH \xB7 <span data-ui="supply-keys">F USE \xB7 R RELOAD</span></div>
          </div>
        </div>
      </div>
      <div class="screen-noise"></div><div class="screen-scanlines"></div>
      <div class="start-screen" data-ui="start">
        <div class="start-content">
          <div class="eyebrow">three.js r186 // WebGPU-first</div>
          <h1 class="game-title">GHOSTLINE<span>VESPER</span></h1>
          <p class="tagline">You are a murdered courier rebuilt from memories the city seized as collateral. Recover three of five civic votes, decide who owns a dying intelligence, and choose which of your borrowed lives is real.</p>
          <div class="button-row">
            <button data-action="continue">${hasSave ? 'Continue ghostline' : 'Enter Vesper'}</button>
            ${hasSave ? '<button class="secondary" data-action="new">New reconstruction</button>' : ''}
          </div>
          <div class="control-grid">
            <b>WASD</b><span>Move</span><b>MOUSE</b><span>Aim / fire</span>
            <b>SHIFT</b><span>Sprint</span><b>CTRL</b><span>Crouch</span>
            <b>SPACE</b><span>Jump</span><b>E</b><span>Interact / breach</span>
            <b>Q Z X C V</b><span>Cyber abilities</span><b>TAB / K</b><span>Character</span>
          </div>
          <p class="subtle control-alt"><b>PAD</b> RT fire \xB7 LT aim \xB7 A jump \xB7 B crouch \xB7 X use / reload \xB7 Y weapon \xB7 L3 sprint \xB7 RB LB D-pad abilities \xB7 Start pause</p>
          <p class="subtle control-alt"><b>TOUCH</b> left thumb moves (push to the rim to sprint) \xB7 drag right to look \xB7 buttons fire, jump, use</p>
          <p class="subtle" data-ui="renderer">Preparing graphics device…</p>
        </div>
      </div>
      <div class="modal hidden" data-ui="modal"></div>
      <div class="dialogue-box hidden" data-ui="dialogue"></div>
      <div class="modal hidden" data-ui="hack"></div>
      <div class="death-screen hidden" data-ui="death">
        <div class="start-content">
          <div class="eyebrow" style="color:var(--danger)">Reconstruction integrity zero</div>
          <h1 class="game-title">FLATLINE<span>NOT FINAL</span></h1>
          <p class="tagline">The relay loft still has enough of you cached to try again. Vesper will keep the scars.</p>
          <button data-action="respawn">Reconstruct at safehouse</button>
        </div>
      </div>
    `;
    const el = (sel) => {
      const node = root.querySelector(sel);
      if (!(node instanceof HTMLElement)) throw Error(`Missing UI element: ${sel}`);
      return node;
    };
    this.hud = el('[data-ui="hud"]');
    this.start = el('[data-ui="start"]');
    this.modal = el('[data-ui="modal"]');
    this.dialogue = el('[data-ui="dialogue"]');
    this.hack = el('[data-ui="hack"]');
    this.prompt = el('[data-ui="prompt"]');
    this.objective = el('[data-ui="objective"]');
    this.notifications = el('[data-ui="notifications"]');
    this.death = el('[data-ui="death"]');
    this.crosshair = el('[data-ui="crosshair"]');
    this.map = el('[data-ui="minimap"]');
    this.mapContext = this.map.getContext('2d');
    this.refs = {};
    this.values = {};
    for (const node of this.hud.querySelectorAll('[data-ui]')) this.refs[node.dataset.ui] = node;

    root.querySelector('[data-action="continue"]')?.addEventListener('click', () => this.startGame());
    root.querySelector('[data-action="new"]')?.addEventListener('click', () => callbacks.onNewGame());
    root.querySelector('[data-action="respawn"]')?.addEventListener('click', () => this.respawn());
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    this.bindEvents();

    this.perf = document.createElement('div');
    this.perf.id = 'performance-overlay';
    this.perf.setAttribute('role', 'status');
    this.perf.setAttribute('aria-label', 'Game performance');
    document.body.append(this.perf);

    el('[data-ui="renderer"]').textContent = `${callbacks.getBackend().toUpperCase()} // ${callbacks.getQuality().toUpperCase()} // RTX 3060 target`;
  }

  /**
   * Capture the mouse for looking. Only a mouse player asks, and only inside a
   * gesture: a pad's A button is not one, and the browser would refuse.
   */
  lockMouse() {
    if (this.input.source !== 'keyboard' || this.input.pointerLocked) return;
    if (navigator.userActivation && !navigator.userActivation.isActive) return;
    // Not kit.input.lockPointer(): its fallback request leaves a promise rejection unhandled when the
    // browser refuses (Safari without window focus). The kit still tracks the lock via pointerlockchange.
    const canvas = this.kit.canvas;
    const plain = () => canvas.requestPointerLock?.()?.catch?.(() => {});
    try {
      canvas.requestPointerLock?.({ unadjustedMovement: true })?.catch?.(plain);
    } catch {
      /* not allowed here */
    }
  }

  setCooldownProvider(fn) {
    this.cooldownProvider = fn;
  }

  /* ---------------------------------------------------------------- per frame */

  update(dt) {
    this.hitTimer = Math.max(0, this.hitTimer - dt);
    this.crosshair.classList.toggle('hit', this.hitTimer > 0);
    this.updatePerf(dt);
    this.syncTouch();
    if (!this.started) return;
    const state = this.simulation.state;
    const p = state.player;
    const district = districtAt(p.position.x, p.position.z);
    const weapon = byId(WEAPONS, p.currentWeapon);
    const ammo = p.ammo[weapon.id] ?? { magazine: 0, reserve: 0 };
    this.text('district', district.name);
    this.text('district-subtitle', district.subtitle);
    this.text('credits', String(Math.round(p.credits)));
    this.text('level', String(p.level));
    this.text('heat', String(Math.round(state.districts[district.id].heat)));
    this.text('weather', state.weather.toUpperCase());
    this.text('health', String(Math.ceil(p.health)));
    this.text('shield', String(Math.ceil(p.shield)));
    this.text('energy', String(Math.ceil(p.energy)));
    this.bar('health-bar', p.health / p.maxHealth);
    this.bar('shield-bar', p.shield / p.maxShield);
    this.bar('energy-bar', p.energy / p.maxEnergy);
    this.text('weapon', weapon.name);
    this.text('damage-type', `${weapon.damageType.toUpperCase()} // SLOT ${p.unlockedWeapons.indexOf(weapon.id) + 1}`);
    this.text('magazine', String(ammo.magazine));
    this.text('reserve', String(ammo.reserve));
    this.text('medpatch', String(p.consumables.medpatch ?? 0));
    this.text('supply-keys', `${this.keyLabel('medpatch')} USE \xB7 ${this.keyLabel('reload')}${this.input.source === 'touch' ? '' : ' RELOAD'}`);
    this.renderObjective();
    this.renderAbilities();
    this.mapTimer -= dt;
    if (this.mapTimer <= 0) {
      this.mapTimer = 0.1;
      this.renderMinimap(state);
    }
  }

  get gameplayActive() {
    return this.started && this.mode === 'game' && !this.hackActive;
  }

  keyLabel(action) {
    return (LABELS[this.input.source] ?? LABELS.keyboard)[action] ?? '';
  }

  /** Writes only when the text changed (no layout churn every frame). */
  text(key, value) {
    if (this.values[key] === value) return;
    this.values[key] = value;
    const node = this.refs[key];
    if (node) node.textContent = value;
  }

  bar(key, fraction) {
    const value = `${Math.round(Math.max(0, Math.min(1, fraction)) * 1000) / 10}%`;
    if (this.values[key] === value) return;
    this.values[key] = value;
    const node = this.refs[key];
    if (node) node.style.width = value;
  }

  html(node, key, value) {
    if (this.values[key] === value) return;
    this.values[key] = value;
    node.innerHTML = value;
  }

  updatePerf(dt) {
    // The readout sits above the HUD but not over menus (the title screen names the renderer itself).
    const hide = !this.started || this.mode !== 'game' || this.hackActive;
    if (hide !== this.perf.hidden) this.perf.hidden = hide;
    if (dt > 0) {
      const now = 1 / dt;
      this.fps = this.fps === 0 ? now : this.fps + (now - this.fps) * 0.12;
    }
    this.fpsTimer -= dt;
    if (this.fpsTimer > 0) return;
    this.fpsTimer = 0.25;
    const fps = Math.round(this.fps);
    this.perf.textContent = `${fps} FPS  //  ${this.callbacks.getBackend().toUpperCase()}  //  ${this.callbacks.getQuality().toUpperCase()}`;
    this.perf.style.borderColor = fps < 30 ? '#ff4c64' : fps < 50 ? '#ffc857' : '#55f6ff';
  }

  /** Touch controls only during live gameplay; the HUD makes room for them. */
  syncTouch() {
    const touch = this.kit.touch;
    if (!touch) return;
    const suspend = !this.gameplayActive;
    if (suspend !== this.suspended) {
      this.suspended = suspend;
      touch.suspend(suspend);
      this.touchLayoutDirty = true;
    }
    const visible = touch.visible;
    if (visible !== this.touchUi) {
      this.touchUi = visible;
      document.body.classList.toggle('touch-ui', visible);
      this.touchLayoutDirty = true;
    }
    if (visible && !suspend && this.touchLayoutDirty) this.layoutTouch();
  }

  /**
   * The HUD sits below the kit's pill row (which wraps differently on every
   * screen) and clear of the button cluster (whose size is a setting). Measured
   * once after anything that can move them, never every frame.
   */
  layoutTouch() {
    this.touchLayoutDirty = false;
    const s = this.kit.settings.get();
    const row = this.kit.touch.element.querySelector('.kit-touch__top');
    const style = document.body.style;
    style.setProperty('--pill-bottom', `${Math.round(row?.getBoundingClientRect().bottom ?? 34)}px`);
    // The idle stick ring: 116 px tall, 20 px up from the bottom, × touch scale.
    style.setProperty('--ring-reserve', `${Math.round(8 + 136 * (s.touchScale || 1))}px`);
    document.body.classList.toggle('touch-lefty', s.touchHand === 'left');
  }

  setPrompt(markup) {
    this.html(this.prompt, 'prompt', markup ?? '');
    this.prompt.classList.toggle('visible', !!markup && this.gameplayActive);
  }

  toast(message, tone = 'normal') {
    const node = document.createElement('div');
    node.className = `toast ${tone}`;
    node.textContent = message;
    this.notifications.prepend(node);
    while (this.notifications.children.length > 6) this.notifications.lastElementChild.remove();
    setTimeout(() => node.remove(), 3400);
  }

  /* ---------------------------------------------------------------- breach panel */

  showHack(h) {
    this.hackActive = h !== null;
    if (!h) {
      this.hackState = null;
      this.hack.classList.add('hidden');
      if (this.started && this.mode === 'game' && this.input.source === 'keyboard' && this.wasLocked && !this.input.pointerLocked) this.pause();
      return;
    }
    if (!this.hackState || this.hackState.name !== h.name || this.hackState.length !== h.glyphs.length) {
      this.hack.innerHTML = `
      <div class="panel hack-box">
        <div class="eyebrow">ICE countermeasure // ${h.name}</div>
        <h2>THREAD THE SIGNAL</h2>
        <div class="hack-sequence">${h.glyphs.map((g) => `<span class="hack-token">${g}</span>`).join('')}</div>
        <p class="subtle" data-hack="status"></p>
        <div class="hack-pad">${HACK_GLYPHS.map((g) => `<button class="hack-key" data-dir="${g.code}" aria-label="${g.code}">${g.glyph}</button>`).join('')}</div>
      </div>`;
      for (const b of this.hack.querySelectorAll('[data-dir]'))
        b.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          this.callbacks.onHackPress(b.dataset.dir);
        });
      this.hackState = { name: h.name, length: h.glyphs.length, progress: -1, status: '' };
      this.hack.classList.remove('hidden');
    }
    if (this.hackState.progress !== h.progress) {
      this.hackState.progress = h.progress;
      this.hack.querySelectorAll('.hack-token').forEach((t, i) => t.classList.toggle('done', i < h.progress));
    }
    const status = `INTEGRITY ${'◆'.repeat(h.integrity)}${'◇'.repeat(3 - h.integrity)} \xA0 // \xA0 TRACE ${h.timeRemaining.toFixed(1)}s`;
    if (status !== this.hackState.status) {
      this.hackState.status = status;
      this.hack.querySelector('[data-hack="status"]').textContent = status;
    }
  }

  /* ---------------------------------------------------------------- screens */

  startGame() {
    if (this.started) return;
    this.started = true;
    this.mode = 'game';
    this.start.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.callbacks.onStart();
    this.input.settle?.();
    this.lockMouse();
  }

  pause() {
    if (!this.started || this.mode !== 'game') return;
    this.mode = 'pause';
    this.input.unlockPointer();
    const stats = this.callbacks.getStats();
    this.showModal(`
      <div class="panel">
        <div class="eyebrow">Simulation suspended</div><h2>PAUSE // VESPER WAITS</h2>
        <div class="panel-grid">
          <div class="panel-section"><h3>Runtime</h3><p>${this.callbacks.getBackend().toUpperCase()} \xB7 ${Math.round(this.fps)} FPS \xB7 ${stats.draws} draws \xB7 ${stats.triangles.toLocaleString()} triangles</p><p>${this.callbacks.getActiveCells()} cells \xB7 ${this.callbacks.getEnemyCount()} actors \xB7 ${this.callbacks.getEngagedCount()} alerted</p></div>
          <div class="panel-section"><h3>Graphics: ${this.callbacks.getQuality().toUpperCase()}</h3><p>Bloom, grading, volumetric haze and vignette stay on at every quality level; lower levels render fewer pixels and smaller shadows.</p><div class="button-row"><button data-action="settings">Graphics settings</button></div></div>
        </div>
        <div class="button-row" style="margin-top:16px"><button data-action="resume">Resume</button><button data-action="save">Save</button><button data-action="character">Character</button><button data-action="journal">Journal</button></div>
      </div>`);
    this.on('[data-action="resume"]', () => this.resume());
    this.on('[data-action="save"]', () => this.callbacks.onSave());
    this.on('[data-action="character"]', () => this.openCharacter());
    this.on('[data-action="journal"]', () => this.openJournal());
    this.on('[data-action="settings"]', () => this.callbacks.openSettings());
    this.focusIndex = 1; // Resume
  }

  on(selector, fn) {
    this.modal.querySelector(selector)?.addEventListener('click', fn);
  }

  resume() {
    this.mode = 'game';
    this.modal.classList.add('hidden');
    this.dialogue.classList.add('hidden');
    this.death.classList.add('hidden');
    this.input.settle?.();
    this.lockMouse();
  }

  openCharacter(keepFocus = false) {
    this.mode = 'character';
    if (!keepFocus) this.focusIndex = 0;
    this.input.unlockPointer();
    const state = this.simulation.state;
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `<div class="eyebrow">Insight available // ${state.player.skillPoints}</div><h2>IMPLANT DISCIPLINES</h2><div class="panel-grid" data-skill-grid></div><div class="button-row" style="margin-top:16px"><button data-action="back">Back</button></div>`;
    const grid = panel.querySelector('[data-skill-grid]');
    for (const discipline of ['edge', 'ghost', 'circuit', 'chrome', 'voice']) {
      const section = document.createElement('div');
      section.className = 'panel-section';
      section.innerHTML = `<h3>${discipline.toUpperCase()}</h3>`;
      for (const skill of SKILLS.filter((s) => s.discipline === discipline)) section.append(this.skillButton(skill));
      grid.append(section);
    }
    this.modal.replaceChildren(panel);
    this.modal.classList.remove('hidden');
    panel.querySelector('[data-action="back"]')?.addEventListener('click', () => this.backToPause());
  }

  skillButton(skill) {
    const wrap = document.createElement('div');
    wrap.style.marginBottom = '10px';
    const rank = this.simulation.state.player.skills[skill.id] ?? 0;
    const check = this.simulation.progression.canPurchase(skill.id);
    wrap.innerHTML = `<p style="margin:0 0 5px"><strong>${skill.name}</strong> <span class="subtle">${rank}/${skill.maxRank}</span><br>${skill.description}</p>`;
    const button = document.createElement('button');
    button.textContent = check.allowed ? 'Install rank' : (check.reason ?? 'Locked');
    button.disabled = !check.allowed;
    button.addEventListener('click', () => {
      if (this.simulation.progression.purchase(skill.id)) this.openCharacter(true);
    });
    wrap.append(button);
    return wrap;
  }

  openJournal() {
    this.mode = 'journal';
    this.input.unlockPointer();
    const sections = [];
    for (const quest of QUESTS) {
      const q = this.simulation.state.quests[quest.id];
      if (!q) continue;
      const stage = quest.stages[q.stage];
      sections.push(`<div class="panel-section"><div class="eyebrow">${quest.category} // ${q.status}</div><h3>${quest.title}</h3><p>${quest.summary}</p><p>${stage ? stage.text : 'Resolved.'}</p></div>`);
    }
    const factions = FACTIONS.map(
      (f) =>
        `<div class="panel-section"><h3 style="color:${f.color}">${f.name}</h3><p>REPUTATION ${this.simulation.state.factions[f.id].reputation} \xB7 FAVORS ${this.simulation.state.factions[f.id].favors}<br>${f.promise}</p></div>`
    ).join('');
    this.showModal(
      `<div class="panel"><div class="eyebrow">World state and active work</div><h2>GHOSTLINE JOURNAL</h2><div class="panel-grid">${sections.join('') || '<div class="panel-section"><p>No jobs tracked. Find Sable near the Static Lantern.</p></div>'}${factions}</div><div class="button-row" style="margin-top:16px"><button data-action="back">Back</button></div></div>`
    );
    this.on('[data-action="back"]', () => this.backToPause());
  }

  openVendor(keepFocus = false) {
    this.mode = 'vendor';
    this.input.unlockPointer();
    const prices = { maw: 450, needleline: 900, furnace: 700 };
    const p = this.simulation.state.player;
    const stock = Object.entries(prices)
      .map(([id, price]) => {
        const w = byId(WEAPONS, id);
        const owned = p.unlockedWeapons.includes(id);
        return `<div class="panel-section"><div class="eyebrow">${w.damageType}</div><h3>${w.name}</h3><p>${w.description}</p><button data-buy-weapon="${id}" ${owned ? 'disabled' : ''}>${owned ? 'Owned' : `${price} \xA2`}</button></div>`;
      })
      .join('');
    this.showModal(
      `<div class="panel"><div class="eyebrow">Night Market // balance ${p.credits} \xA2</div><h2>UNLICENSED HARDWARE</h2><div class="panel-grid">${stock}<div class="panel-section"><h3>Field supplies</h3><p>Refill every unlocked weapon reserve or buy a medpatch.</p><div class="button-row"><button data-buy-ammo>80 \xA2 ammo</button><button data-buy-med>50 \xA2 medpatch</button></div></div></div><div class="button-row" style="margin-top:16px"><button data-action="close">Leave</button></div></div>`,
      keepFocus
    );
    for (const b of this.modal.querySelectorAll('[data-buy-weapon]'))
      b.addEventListener('click', () => {
        const id = b.dataset.buyWeapon;
        if (!this.simulation.unlockWeapon(id, prices[id] ?? 0)) this.toast('Insufficient credits', 'bad');
        this.openVendor(true);
      });
    this.on('[data-buy-ammo]', () => {
      if (p.credits < 80) return this.toast('Insufficient credits', 'bad');
      p.credits -= 80;
      for (const id of p.unlockedWeapons) {
        const ammo = p.ammo[id];
        if (ammo) ammo.reserve = byId(WEAPONS, id).reserve;
      }
      this.toast('Ammunition reserves restored', 'good');
      this.openVendor(true);
    });
    this.on('[data-buy-med]', () => {
      if (p.credits < 50) return this.toast('Insufficient credits', 'bad');
      p.credits -= 50;
      p.consumables.medpatch = (p.consumables.medpatch ?? 0) + 1;
      this.toast('Medpatch acquired', 'good');
      this.openVendor(true);
    });
    this.on('[data-action="close"]', () => this.resume());
  }

  openDialogue(nodeId) {
    this.mode = 'dialogue';
    this.input.unlockPointer();
    this.renderDialogue(this.simulation.getDialogueNode(nodeId));
  }

  renderDialogue(node) {
    this.dialogue.classList.remove('hidden');
    this.dialogue.innerHTML = `<div class="speaker">${node.speaker}</div><div class="dialogue-text">${node.text}</div><div class="choices"></div>`;
    const list = this.dialogue.querySelector('.choices');
    for (const choice of node.choices) {
      const b = document.createElement('button');
      b.textContent = choice.text;
      b.disabled = !this.simulation.dialogueChoiceAvailable(choice);
      b.addEventListener('click', () => {
        this.simulation.applyDialogueChoice(choice);
        if (choice.next) this.renderDialogue(this.simulation.getDialogueNode(choice.next));
        else if (this.mode !== 'ending') this.resume();
      });
      list.append(b);
    }
    this.focusIndex = 0;
  }

  showEnding() {
    const ending = String(this.simulation.state.flags.ending ?? 'unknown');
    const lines = {
      coalition: 'The keys scatter across neighborhood relays. Vesper becomes an argument no one can end—and no one can own.',
      sever: 'The civic mind goes quiet. For the first time in a century, the city must remember itself without a machine deciding which memories matter.',
      merge: 'You become the voice behind every streetlight. Millions of borrowed lives wake inside you, and the distinction between courier and city finally disappears.',
      decentralize: 'The seed publishes. Every citizen becomes a voting node, every memory its own witness. Vesper survives by becoming impossible to seize.',
    };
    this.mode = 'ending';
    this.input.unlockPointer();
    this.dialogue.classList.add('hidden');
    this.showModal(
      `<div class="start-content"><div class="eyebrow">Whiteout averted // ${ending}</div><h1 class="game-title">VESPER<span>REMEMBERS</span></h1><p class="tagline">${lines[ending] ?? 'The city accepts an outcome it had no model for.'}</p><p class="subtle">The open world remains playable. District state, jobs, builds and recently cleared encounters persist; ambient patrols repopulate over time.</p><div class="button-row"><button data-action="continue-world">Continue in Vesper</button><button data-action="save-ending">Save ending</button></div></div>`
    );
    this.on('[data-action="continue-world"]', () => this.resume());
    this.on('[data-action="save-ending"]', () => this.callbacks.onSave());
  }

  respawn() {
    this.mode = 'game';
    this.hackActive = false;
    this.death.classList.add('hidden');
    this.hack.classList.add('hidden');
    this.modal.classList.add('hidden');
    this.dialogue.classList.add('hidden');
    this.callbacks.onRespawn();
    this.input.settle?.();
    this.lockMouse();
  }

  backToPause() {
    this.mode = 'game';
    this.modal.classList.add('hidden');
    this.pause();
  }

  showModal(markup, keepFocus = false) {
    this.modal.innerHTML = markup;
    this.modal.classList.remove('hidden');
    if (!keepFocus) this.focusIndex = 0;
  }

  /* ---------------------------------------------------------------- menu input */

  /** Keyboard/gamepad control of whatever screen is up. Called after gameplay each frame. */
  handleInput(input, dt) {
    if (this.hackActive) return;
    if (this.started && this.mode === 'game') {
      if (input.pressed('pause')) this.pause();
      else if (input.pressed('character')) this.openCharacter();
      else if (input.pressed('journal')) this.openJournal();
      this.clearFocus();
      return;
    }
    const layer = this.activeLayer();
    if (!layer) {
      this.clearFocus();
      return;
    }
    if (layer !== this.focusLayer) {
      this.focusLayer = layer;
      this.focusIndex = Math.max(0, this.focusIndex);
    }
    const buttons = [...layer.querySelectorAll('button')].filter((b) => !b.disabled && b.offsetParent !== null && !b.classList.contains('hack-key'));
    if (!buttons.length) return;

    let step = 0;
    if (input.pressed('navUp') || input.pressed('navLeft')) step = -1;
    if (input.pressed('navDown') || input.pressed('navRight')) step = 1;
    if (input.source === 'gamepad') {
      const v = input.vector('move');
      const dir = v.y > 0.6 || v.x < -0.6 ? -1 : v.y < -0.6 || v.x > 0.6 ? 1 : 0;
      this.stickRepeat -= dt;
      if (dir === 0) this.stickHeld = 0;
      else if (dir !== this.stickHeld || this.stickRepeat <= 0) {
        step = dir;
        this.stickRepeat = dir !== this.stickHeld ? 0.38 : 0.14;
        this.stickHeld = dir;
      }
    }
    // A mouse click or Tab may have moved DOM focus; follow it.
    const active = buttons.indexOf(document.activeElement);
    if (step === 0 && active >= 0) this.focusIndex = active;
    this.focusIndex = Math.max(0, Math.min(buttons.length - 1, this.focusIndex + step));
    const focused = buttons[this.focusIndex];
    if (focused !== this.focusEl) {
      this.focusEl?.classList.remove('is-focus');
      this.focusEl = focused;
      focused.classList.add('is-focus');
      focused.scrollIntoView?.({ block: 'nearest' });
    }
    // Once the player navigates (or a button already holds focus), DOM focus follows the
    // highlight, so Enter/Space click it natively; until then they arrive as 'confirm'.
    if ((step !== 0 || active >= 0) && document.activeElement !== focused) focused.focus({ preventScroll: true });
    document.body.classList.toggle('menu-touch', input.source === 'touch');

    // A on a pad, or Enter/Space before any button holds DOM focus.
    if (input.pressed('confirm')) {
      focused.click();
      return;
    }
    const back = input.pressed('back');
    const escape = input.pressed('pause');
    if (!back && !escape) return;
    // Esc and Start leave the menu (as the original Esc did); B steps back one screen.
    if (this.mode === 'character' || this.mode === 'journal') back ? this.backToPause() : this.resume();
    else if (this.mode === 'pause' || this.mode === 'vendor' || this.mode === 'dialogue') this.resume();
  }

  activeLayer() {
    if (!this.started) return this.start;
    if (this.mode === 'death') return this.death;
    if (this.mode === 'dialogue') return this.dialogue;
    if (MENU_MODES.has(this.mode)) return this.modal;
    return null;
  }

  clearFocus() {
    if (!this.focusEl) return;
    this.focusEl.classList.remove('is-focus');
    if (document.activeElement === this.focusEl) this.focusEl.blur();
    this.focusEl = null;
    this.focusLayer = null;
  }

  onPointerLockChange = () => {
    const locked = this.input.pointerLocked || document.pointerLockElement === this.kit.canvas;
    if (locked) {
      this.wasLocked = true;
      return;
    }
    // Losing the mouse (Esc in the browser) pauses, as before; pads and touch never lock.
    if (this.wasLocked && this.started && this.mode === 'game' && !this.hackActive) this.pause();
  };

  /* ---------------------------------------------------------------- HUD pieces */

  renderObjective() {
    const tracked = this.simulation.quests.getTracked();
    if (!tracked) {
      this.html(this.objective, 'objective', '<span class="eyebrow">OPEN WORLD</span><br>Find contacts, gigs, vote relays and changing patrol pressure.');
      return;
    }
    const count = tracked.required > 1 ? ` // ${tracked.progress}/${tracked.required}` : '';
    this.html(this.objective, 'objective', `<span class="eyebrow">${tracked.quest.title}</span><br>${tracked.objective.text.replace(/\s\(0\/\d+\)\.?$/, '')}${count}`);
  }

  renderAbilities() {
    const skills = this.simulation.state.player.skills;
    const label = (a) => {
      const cd = this.cooldownProvider(a.id);
      const key = this.keyLabel(a.id);
      return `${key ? `${key} ` : ''}${cd > 0 ? cd.toFixed(1) : a.name.toUpperCase()}`;
    };
    const parts = ABILITIES.slice(0, 5).map(label);
    if ((skills['circuit.blackout'] ?? 0) > 0) {
      const cd = this.cooldownProvider('blackout');
      const key = this.keyLabel('blackout');
      parts.push(`${key ? `${key} ` : ''}${cd > 0 ? cd.toFixed(1) : 'BLACKOUT'}`);
    }
    this.text('abilities', parts.join(' \xB7 '));
  }

  renderMinimap(state) {
    const ctx = this.mapContext;
    if (!ctx) return;
    const size = this.map.width;
    const half = size / 2;
    const scale = 1.45;
    const me = state.player.position;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(3, 7, 17, .92)';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(85, 246, 255, .12)';
    ctx.lineWidth = 1;
    for (let o = -128; o <= 128; o += 32) {
      ctx.beginPath();
      ctx.moveTo(half + o * scale, 0);
      ctx.lineTo(half + o * scale, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, half + o * scale);
      ctx.lineTo(size, half + o * scale);
      ctx.stroke();
    }
    for (const l of LANDMARKS) {
      const x = (l.position.x - me.x) * scale;
      const z = (l.position.z - me.z) * scale;
      if (Math.abs(x) > half || Math.abs(z) > half) continue;
      ctx.fillStyle = l.color;
      ctx.beginPath();
      ctx.arc(half + x, half + z, l.kind === 'core' ? 6 : 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    const job = this.objectiveLandmark(state);
    if (job) {
      const x = (job.position.x - me.x) * scale;
      const z = (job.position.z - me.z) * scale;
      const edge = half - 16;
      const k = Math.min(1, edge / Math.max(Math.abs(x), Math.abs(z), 1));
      const px = half + x * k;
      const pz = half + z * k;
      ctx.save();
      ctx.translate(px, pz);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = job.color;
      ctx.lineWidth = 3;
      ctx.fillRect(-5, -5, 10, 10);
      ctx.strokeRect(-7, -7, 14, 14);
      ctx.restore();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('JOB', Math.min(size - 25, px + 9), Math.max(12, pz - 7));
    }
    const yaw = (state.player.yaw * Math.PI) / 180;
    ctx.save();
    ctx.translate(half, half);
    ctx.rotate(-yaw);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(7, 8);
    ctx.lineTo(0, 5);
    ctx.lineTo(-7, 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  objectiveLandmark(state) {
    const tracked = this.simulation.quests.getTracked();
    if (!tracked) return null;
    const { objective } = tracked;
    let list = LANDMARKS.filter((l) => l.objectiveTarget === objective.target);
    if (objective.type === 'choose' && objective.target === 'ending') list = LANDMARKS.filter((l) => l.kind === 'core');
    list = list.filter((l) => l.kind !== 'terminal' || !state.collected.includes(`landmark:${l.id}`));
    const me = state.player.position;
    const d2 = (l) => (l.position.x - me.x) ** 2 + (l.position.z - me.z) ** 2;
    return list.reduce((best, l) => (!best || d2(l) < d2(best) ? l : best), null);
  }

  bindEvents() {
    const events = this.simulation.events;
    events.on('toast', ({ message, tone }) => this.toast(message, tone ?? 'normal'));
    events.on('combat:hit', () => {
      this.hitTimer = 0.12;
    });
    events.on('player:damaged', () => {
      this.crosshair.animate([{ filter: 'drop-shadow(0 0 15px #ff335c)' }, { filter: '' }], { duration: 220 });
    });
    events.on('dialogue:open', ({ nodeId }) => this.openDialogue(nodeId));
    events.on('vendor:open', () => this.openVendor());
    events.on('player:died', () => {
      this.mode = 'death';
      this.hackActive = false;
      this.input.unlockPointer();
      this.hack.classList.add('hidden');
      this.modal.classList.add('hidden');
      this.dialogue.classList.add('hidden');
      this.death.classList.remove('hidden');
    });
    events.on('quest:completed', ({ quest }) => {
      if (quest.id === 'city-vote') setTimeout(() => this.showEnding(), 120);
    });
  }

  destroy() {
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    this.perf.remove();
    this.root.replaceChildren();
  }
}
