/**
 * ui.js — the broadcast overlay in plain DOM: HUD, Iona's host card and
 * captions, the ready room, pause, sponsor breaks, route doors, results and
 * the Signal Nine archive. Same markup and class names as the original React
 * build (so style.css carries over), plus controller/keyboard navigation:
 * navigate(), confirm() and back() are driven from kit.input actions.
 */

import { LEVELS, LEVEL_IDS, ENEMIES, WEAPONS, CONTRACTS, OVERTIME_THEME_WAVES, OVERTIME_BOSS_EVERY } from './data.js';
import { SPONSORS } from './lines.js';

/** Tiny element builder: h('div', { className, onClick, style, ...attrs }, ...children). */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value === undefined || value === null || value === false) continue;
      if (key === 'className') el.className = value;
      else if (key === 'style') {
        for (const [prop, v] of Object.entries(value)) {
          if (v === undefined || v === null) continue;
          if (prop.startsWith('--')) el.style.setProperty(prop, v);
          else el.style[prop] = v;
        }
      } else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
      else if (key === 'hidden' || key === 'disabled') el[key] = !!value;
      else if (key === 'value') el.value = value;
      else el.setAttribute(key, value === true ? '' : String(value));
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const child of children) {
    if (child === null || child === undefined || child === false || child === true) continue;
    if (Array.isArray(child)) append(el, child);
    else if (child instanceof Node) el.append(child);
    else el.append(document.createTextNode(String(child)));
  }
}

function setText(el, value) {
  const v = String(value);
  if (el._v !== v) {
    el._v = v;
    el.textContent = v;
  }
}

function setWidth(el, percent) {
  const v = `${Math.max(0, Math.min(100, percent)).toFixed(1)}%`;
  if (el._w !== v) {
    el._w = v;
    el.style.width = v;
  }
}

function setHidden(el, hidden) {
  if (el.hidden !== hidden) el.hidden = hidden;
}

const pad2 = (n) => String(n).padStart(2, '0');
export const scoreText = (n) =>
  Math.round(n).toLocaleString('en-US', { maximumFractionDigits: 0 }).padStart(6, '0');
export const clockText = (seconds) => {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const RISK_LEVEL = { LOW: 1, MEDIUM: 2, HIGH: 3, EXTREME: 4 };
const DIRECTION_ORDER = ['NORTH', 'EAST', 'SOUTH', 'WEST'];
const DIRECTION_LABEL = { NORTH: 'N ↑', EAST: 'E →', SOUTH: 'S ↓', WEST: 'W ←' };
const STYLE_TITLES = {
  unread: 'PATTERN UNRESOLVED',
  vanguard: 'VANGUARD',
  survivor: 'SURVIVOR',
  demolition: 'DEMOLITION',
  ghost: 'GHOST',
  specialist: 'SPECIALIST',
  tactician: 'TACTICIAN',
};
const FREQUENCY_LABELS = { minimal: 'STORY ONLY', standard: 'BALANCED', full: 'FULL BROADCAST' };
const OVERTIME_COLOR = '#ffd15c';

/** Button prompts for the ready room and the pause card, by the last input used. */
const CONTROLS = {
  keyboard: [
    ['WASD', 'MOVE'],
    ['MOUSE', 'AIM + FIRE'],
    ['SPACE', 'DASH'],
    ['E / Q', 'SCREEN WIPE'],
  ],
  gamepad: [
    ['L-STICK', 'MOVE'],
    ['R-STICK · RT', 'AIM + FIRE'],
    ['A · LB', 'DASH'],
    ['B · LT', 'SCREEN WIPE'],
  ],
  touch: [
    ['LEFT THUMB', 'MOVE'],
    ['RIGHT THUMB', 'AIM + FIRE'],
    ['DASH', 'DASH'],
    ['WIPE', 'SCREEN WIPE'],
  ],
};
const CONTROLS_EXTRA = {
  keyboard: [
    ['J / CLICK', 'FIRE'],
    ['K / R-CLICK', 'WIPE'],
    ['ESC / P', 'PAUSE'],
    ['F9', 'SETTINGS'],
  ],
  gamepad: [
    ['X', 'FIRE'],
    ['RB', 'DASH'],
    ['START', 'PAUSE'],
    ['B', 'BACK'],
  ],
  touch: [['II', 'PAUSE']],
};
const SOURCE_NOTE = {
  keyboard: 'KEYBOARD + MOUSE // GAMEPAD AND TWIN-STICK TOUCH AUTO-DETECTED',
  gamepad: 'CONTROLLER LIVE // D-PAD OR STICK TO BROWSE, A TO CONFIRM',
  touch: 'TWIN-STICK TOUCH // LEFT THUMB MOVES, RIGHT THUMB AIMS AND FIRES',
};

function hostStatus(phase, speaking) {
  if (speaking) return 'ON AIR';
  if (phase === 'paused') return 'FEED HELD';
  if (phase === 'route') return 'ROUTE OPEN';
  if (phase === 'upgrade') return 'SPONSOR BREAK';
  if (phase === 'gameover') return 'POST SHOW';
  if (phase === 'menu') return 'STANDBY';
  return 'MONITORING';
}

function timeFormat(ms) {
  return new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(ms);
}

export class GameUI {
  /**
   * @param {HTMLElement} root   where the game shell goes
   * @param {object} handlers    what the buttons do (see main.js)
   */
  constructor(root, handlers) {
    this.handlers = handlers;
    this.state = {
      phase: 'boot',
      backend: null,
      tier: 'high',
      hud: null,
      snapshot: null,
      hostSettings: { voice: true, captions: true, portrait: true, frequency: 'standard', volume: 0.78 },
      progress: null,
      selected: 1,
      sfx: true,
      reducedMotion: false,
      contract: 'standard',
      upgrades: [],
      choices: [],
      result: null,
      archiveOpen: false,
      source: 'keyboard',
    };
    this.overlayDirty = false;
    this.hostKey = '';
    this.eraseArmed = false;
    this.build(root);
    // Pointer users do not need the controller focus ring.
    addEventListener('pointerdown', () => this.clearPadFocus(), true);
  }

  /* ------------------------------------------------------------------ shell */

  build(root) {
    this.canvas = h('canvas', { className: 'render-canvas', 'aria-label': '3D game arena' });
    this.systemBackend = h('span', null, 'GPU // WARMING');
    this.systemDot = h('span', { className: 'live-dot' });
    this.systemTier = h('span', null, 'HIGH FX');
    this.systemFps = h('span', { className: 'fps-readout', hidden: true }, '60 FPS');
    this.hostEl = h('section', { className: 'broadcast-host', 'aria-label': 'Live broadcast host Iona Quade', hidden: true });
    this.impactLayer = h('div', { className: 'impact-layer', 'aria-hidden': 'true' });
    this.overlaySlot = h('div', { className: 'overlay-slot' });
    this.archiveSlot = h('div', { className: 'overlay-slot' });
    this.buildHud();
    this.stage = h(
      'div',
      { className: 'game-stage' },
      this.canvas,
      h('div', { className: 'arena-vignette', 'aria-hidden': 'true' }),
      h('div', { className: 'scanlines', 'aria-hidden': 'true' }),
      h(
        'div',
        { className: 'safe-frame', 'aria-hidden': 'true' },
        h('span', { className: 'corner corner-tl' }),
        h('span', { className: 'corner corner-tr' }),
        h('span', { className: 'corner corner-bl' }),
        h('span', { className: 'corner corner-br' }),
      ),
      h(
        'div',
        { className: 'system-strip', 'aria-label': 'Rendering status' },
        this.systemDot,
        this.systemBackend,
        h('span', { className: 'system-divider' }),
        this.systemTier,
        this.systemFps,
      ),
      this.hostEl,
      this.hudLayer,
      this.impactLayer,
      this.overlaySlot,
      this.archiveSlot,
    );
    this.shell = h('main', { className: 'game-shell phase-boot', 'aria-label': 'Neon Gauntlet arcade game' }, this.stage);
    root.append(this.shell);
  }

  buildHud() {
    const r = (this.refs = {});
    this.hudLayer = h(
      'section',
      { className: 'hud-layer', 'aria-label': 'Game status', hidden: true },
      h(
        'div',
        { className: 'hud-top hud-panel score-panel' },
        h('span', { className: 'hud-label' }, 'LIVE SCORE'),
        (r.score = h('strong', null, '000000')),
        (r.best = h('span', { className: 'best-score' }, 'BEST 000000')),
      ),
      (r.objectivePanel = h(
        'div',
        { className: 'hud-top objective-panel' },
        (r.roomChip = h('div', { className: 'room-chip' }, '')),
        (r.objective = h('strong', null, '')),
        (r.mechanic = h('span', null, '')),
      )),
      h(
        'div',
        { className: 'hud-top hud-panel stats-panel' },
        h('div', null, h('span', { className: 'hud-label' }, 'KILLS'), (r.kills = h('strong', null, '000'))),
        h('div', null, h('span', { className: 'hud-label' }, 'RATING'), (r.rating = h('strong', null, '1.0×'))),
        (r.pauseButton = h(
          'button',
          { className: 'pause-button', type: 'button', 'aria-label': 'Pause game', onClick: () => this.handlers.pause() },
          'II',
        )),
      ),
      (r.combo = h(
        'div',
        { className: 'combo-badge', 'aria-live': 'polite', hidden: true },
        h('span', null, 'COMBO'),
        (r.comboValue = h('strong', null, '0')),
        (r.comboBar = h('i')),
      )),
      (r.boss = h(
        'div',
        { className: 'boss-hud', hidden: true },
        h('div', { className: 'boss-heading' }, (r.bossKicker = h('span', null, 'FINAL GUEST')), (r.bossName = h('strong')), (r.bossHp = h('span'))),
        h('div', { className: 'boss-track' }, (r.bossBar = h('i'))),
      )),
      h(
        'div',
        { className: 'hud-bottom health-panel hud-panel' },
        h(
          'div',
          { className: 'health-copy' },
          h('span', { className: 'hud-label' }, 'SIGNAL INTEGRITY'),
          (r.health = h('strong', null, '100')),
          (r.maxHealth = h('span', null, '/ 100')),
        ),
        h('div', { className: 'meter health-meter' }, (r.healthBar = h('i'))),
        h(
          'div',
          { className: 'dash-row' },
          h('span', null, 'DASH'),
          h('div', { className: 'meter dash-meter' }, (r.dashBar = h('i'))),
          (r.dashState = h('span', null, 'READY')),
        ),
      ),
      h(
        'div',
        { className: 'hud-bottom weapon-panel hud-panel' },
        h(
          'div',
          null,
          h('span', { className: 'hud-label' }, 'ON-AIR LOADOUT'),
          (r.weapon = h('strong', null, 'PULSE-9')),
          (r.weaponTimer = h('span', { className: 'weapon-timer', hidden: true })),
        ),
        h(
          'div',
          { className: 'bomb-stock' },
          h('span', null, 'SCREEN WIPE'),
          (r.bombs = h('strong', null, '◆ ◆')),
        ),
      ),
    );
  }

  /* ------------------------------------------------------------------ state setters */

  setBackend(backend) {
    this.state.backend = backend;
    this.systemDot.classList.add('ready');
    setText(this.systemBackend, backend === 'webgpu' ? 'WEBGPU // LIVE' : 'WEBGL2 // COMPAT');
    if (this.state.phase === 'menu') this.refreshMenu();
  }

  setTier(name) {
    this.state.tier = name;
    setText(this.systemTier, `${name.toUpperCase()} FX`);
    if (this.state.phase === 'menu') this.refreshMenu();
  }

  setFps(fps) {
    if (this.state.phase === 'playing') setText(this.systemFps, `${fps} FPS`);
  }

  setSource(source) {
    if (this.state.source === source) return;
    this.state.source = source;
    if (this.state.phase === 'menu') this.refreshMenu();
    if (this.state.phase === 'paused' || this.state.phase === 'upgrade') this.invalidateOverlay();
  }

  setTheme(def) {
    this.stage.style.setProperty('--level-accent', def.accent);
    this.stage.style.setProperty('--level-secondary', def.secondary);
  }

  setPhase(phase) {
    const previous = this.state.phase;
    this.state.phase = phase;
    this.shell.className = `game-shell phase-${phase}${this.state.reducedMotion ? ' reduced-motion' : ''}`;
    setHidden(this.hudLayer, !(phase === 'playing' || phase === 'paused' || phase === 'route' || phase === 'upgrade'));
    setHidden(this.refs.pauseButton, phase !== 'playing');
    setHidden(this.systemFps, phase !== 'playing');
    if (phase !== 'playing') this.shell.classList.remove('critical-signal');
    if (previous !== phase) {
      this.clearPadFocus();
      this.eraseArmed = false;
      this.invalidateOverlay();
    }
    this.updateAccent();
    this.renderHost();
  }

  setHud(hud) {
    this.state.hud = hud;
    const r = this.refs;
    setText(r.score, scoreText(hud.score));
    setText(r.best, `BEST ${scoreText(hud.best)}`);
    const chip = hud.overtime
      ? `OVERTIME // WAVE ${pad2(hud.wave)}${hud.bossRoom ? ' // ENCORE' : ''}`
      : `LEVEL ${pad2(hud.level)} // ${hud.bossRoom ? 'BOSS' : `ROOM ${pad2(Math.min(5, hud.room))} / 05`}`;
    setText(r.roomChip, chip);
    r.roomChip.classList.toggle('overtime', !!hud.overtime);
    r.roomChip.classList.toggle('prize', !!hud.prizeRound);
    setText(r.objective, hud.objective);
    r.objectivePanel.classList.toggle('prize-live', !!hud.prizeRound);
    r.objectivePanel.classList.toggle('prize-final', !!hud.prizeRound && hud.prizeClock <= 5);
    setText(r.mechanic, `${hud.mechanicLabel} // AIRTIME ${clockText(hud.elapsed)}`);
    setText(r.kills, String(hud.kills).padStart(3, '0'));
    setText(r.rating, `${hud.multiplier.toFixed(1)}×`);
    setHidden(r.combo, !(hud.combo > 1));
    if (hud.combo > 1) {
      setText(r.comboValue, hud.combo);
      const scale = `scaleX(${Math.max(0, Math.min(1, hud.combo / 35))})`;
      if (r.comboBar._t !== scale) {
        r.comboBar._t = scale;
        r.comboBar.style.transform = scale;
      }
    }
    const bossShown = hud.bossMaxHealth > 0;
    setHidden(r.boss, !bossShown);
    if (bossShown) {
      setText(r.bossKicker, hud.overtime ? 'ENCORE GUEST' : 'FINAL GUEST');
      setText(r.bossName, hud.bossName);
      setText(r.bossHp, `${Math.ceil(hud.bossHealth)} HP`);
      setWidth(r.bossBar, (hud.bossHealth / Math.max(1, hud.bossMaxHealth)) * 100);
    }
    setText(r.health, Math.ceil(hud.health));
    setText(r.maxHealth, `/ ${hud.maxHealth}`);
    setWidth(r.healthBar, (hud.health / Math.max(1, hud.maxHealth)) * 100);
    setWidth(r.dashBar, hud.dash * 100);
    setText(r.dashState, hud.dash >= 0.99 ? 'READY' : 'CHARGING');
    setText(r.weapon, hud.weapon);
    setHidden(r.weaponTimer, !(hud.weaponTime > 0));
    if (hud.weaponTime > 0) setText(r.weaponTimer, `${hud.weaponTime.toFixed(1)}s`);
    if (r.bombs._n !== hud.bombs) {
      r.bombs._n = hud.bombs;
      setText(r.bombs, Array.from({ length: Math.max(0, hud.bombs) }, () => '◆').join(' ') || 'EMPTY');
      r.bombs.parentElement.setAttribute('aria-label', `${hud.bombs} screen wipes remaining`);
    }
    const critical = this.state.phase === 'playing' && hud.health > 0 && hud.health / Math.max(1, hud.maxHealth) <= 0.3;
    this.shell.classList.toggle('critical-signal', critical);
    if (this.state.phase !== 'menu') this.updateAccent();
  }

  /** A floating score, a broadcast banner, or the red damage flash. */
  impact(event) {
    const banner = event.kind === 'wave' || event.kind === 'streak' || event.kind === 'bomb';
    const el = banner
      ? h('div', { className: `broadcast-impact ${event.kind}` }, h('span', null, 'NEON NETWORK // LIVE'), h('strong', null, event.text))
      : event.kind === 'hurt'
        ? h('div', { className: 'damage-flash' }, h('strong', null, event.text))
        : h(
            'div',
            { className: `world-impact ${event.kind}`, style: { left: `${event.x ?? 50}%`, top: `${event.y ?? 50}%`, color: event.color } },
            event.text,
          );
    this.impactLayer.append(el);
    while (this.impactLayer.childElementCount > 11) this.impactLayer.firstElementChild.remove();
    setTimeout(() => el.remove(), banner ? 1250 : 720);
  }

  setSnapshot(snapshot) {
    const previous = this.state.snapshot;
    this.state.snapshot = snapshot;
    this.renderHost();
    if (this.state.archiveOpen && this.archiveKey(snapshot) !== this.archiveShownKey) this.renderArchive(true);
    const p = this.state.phase;
    if (p === 'menu' && previous && (previous.profile.archiveBreach !== snapshot.profile.archiveBreach || previous.voiceStatus !== snapshot.voiceStatus || previous.history.length !== snapshot.history.length))
      this.refreshMenu();
    if ((p === 'paused' || p === 'gameover') && this.replayButtons) {
      for (const b of this.replayButtons) b.disabled = snapshot.history.length === 0;
    }
    if (p === 'upgrade' && previous?.sponsor !== snapshot.sponsor) this.invalidateOverlay();
    if (p === 'gameover' && previous?.profile.style !== snapshot.profile.style) this.invalidateOverlay();
  }

  setHostSettings(settings) {
    this.state.hostSettings = settings;
    this.hostKey = '';
    this.renderHost();
    if (this.state.phase === 'menu') this.refreshMenu();
  }

  setProgress(progress) {
    this.state.progress = progress;
    if (this.state.phase === 'menu') this.refreshMenu();
  }

  setSelected(selected) {
    this.state.selected = selected;
    this.updateAccent();
    if (this.state.phase === 'menu') this.refreshMenu();
  }

  setOptions({ sfx, reducedMotion, contract }) {
    if (sfx !== undefined) this.state.sfx = sfx;
    if (reducedMotion !== undefined) this.state.reducedMotion = reducedMotion;
    if (contract !== undefined) this.state.contract = contract;
    this.shell.classList.toggle('reduced-motion', this.state.reducedMotion);
    if (this.state.phase === 'menu') this.refreshMenu();
  }

  setUpgrades(list) {
    this.state.upgrades = list;
    this.invalidateOverlay();
  }

  setChoices(list) {
    this.state.choices = list;
    if (this.state.phase === 'route') this.invalidateOverlay();
  }

  setResult(result) {
    this.state.result = result;
    this.invalidateOverlay();
  }

  updateAccent() {
    const s = this.state;
    let accent = s.hud?.themeAccent ?? LEVELS[1].accent;
    if (s.phase === 'menu' || s.phase === 'boot') accent = s.selected === 'overtime' ? OVERTIME_COLOR : LEVELS[s.selected]?.accent ?? accent;
    if (this.shell._accent !== accent) {
      this.shell._accent = accent;
      this.shell.style.setProperty('--level-accent', accent);
    }
  }

  /* ------------------------------------------------------------------ host */

  renderHost() {
    const s = this.state;
    const snap = s.snapshot;
    const t = s.hostSettings;
    const el = this.hostEl;
    if (!snap || s.phase === 'boot' || (!t.portrait && !t.captions)) {
      setHidden(el, true);
      this.hostKey = '';
      return;
    }
    setHidden(el, false);
    const line = snap.line;
    const showCaption = t.captions && !!line;
    const sponsor = line?.sponsorId ? SPONSORS[line.sponsorId] : snap.sponsor;
    el.className = [
      'broadcast-host',
      `emotion-${snap.emotion}`,
      snap.speaking ? 'host-speaking' : '',
      showCaption ? 'host-has-line' : '',
      t.portrait ? '' : 'host-caption-only',
      line ? `host-kind-${line.kind} host-speaker-${line.speaker}` : '',
    ]
      .filter(Boolean)
      .join(' ');
    if (sponsor) el.style.setProperty('--host-accent', sponsor.color);
    else el.style.removeProperty('--host-accent');
    const status = t.voice && snap.voiceStatus === 'unavailable' ? 'CAPTIONS ONLY' : hostStatus(s.phase, snap.speaking);
    const key = [line?.instanceId ?? '', t.portrait, t.captions, sponsor?.id ?? '', snap.chapter.number].join('|');
    if (key !== this.hostKey) {
      this.hostKey = key;
      const byline = line
        ? line.kind === 'advertisement'
          ? `IONA QUADE // ${sponsor?.name ?? 'NETWORK SPONSOR'} // PAID FICTIONAL TRANSMISSION`
          : line.kind === 'story'
            ? 'IONA QUADE // OFF SCRIPT'
            : line.speaker === 'network'
              ? 'NETWORK CONTROL // AUTOMATED'
              : 'IONA QUADE // SIGNAL NINE'
        : 'IONA QUADE // SIGNAL NINE';
      this.hostLive = [];
      this.hostStatusEl = null;
      const children = [];
      if (showCaption)
        children.push(
          h(
            'div',
            { className: 'host-caption', 'aria-live': 'polite', 'aria-atomic': 'true' },
            line.kind === 'advertisement' && sponsor
              ? h(
                  'div',
                  { className: 'host-sponsor-slate' },
                  h('span', null, sponsor.category),
                  h('strong', null, sponsor.name),
                  h('small', null, sponsor.tagline),
                )
              : null,
            h('div', { className: 'host-caption-head' }, h('span', null, line.label), h('i', { 'aria-hidden': 'true' })),
            h('p', null, line.text),
            h('small', null, byline),
          ),
        );
      if (t.portrait) {
        const liveA = h('i');
        const liveB = h('i');
        this.hostLive = [liveA, liveB];
        this.hostStatusEl = h('span', null, status);
        children.push(
          h(
            'div',
            { className: 'host-card' },
            h('div', { className: 'host-channel' }, h('span', null, 'CH 09'), h('small', null, `ARC 0${snap.chapter.number}`), liveA),
            h(
              'div',
              { className: 'host-portrait', 'aria-hidden': 'true' },
              h('div', { className: 'host-scan', 'aria-hidden': 'true' }),
              h('div', { className: 'host-reticle', 'aria-hidden': 'true' }),
              h('div', { className: 'host-waveform', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i'), h('i')),
            ),
            h(
              'div',
              { className: 'host-identity' },
              h('span', null, 'SIGNAL NINE // HOST'),
              h('strong', null, 'IONA QUADE'),
              h('small', null, liveB, this.hostStatusEl),
            ),
          ),
        );
      }
      el.replaceChildren(...children);
    }
    for (const dot of this.hostLive) dot.className = snap.speaking ? 'live' : '';
    if (this.hostStatusEl) setText(this.hostStatusEl, status);
  }

  /* ------------------------------------------------------------------ overlays */

  invalidateOverlay() {
    if (this.overlayDirty) return;
    this.overlayDirty = true;
    // Render after the engine finishes this call (phase, upgrades and results arrive together).
    queueMicrotask(() => {
      this.overlayDirty = false;
      this.renderOverlay();
    });
  }

  renderOverlay() {
    const p = this.state.phase;
    this.replayButtons = null;
    this.menu = null;
    let node = null;
    if (p === 'menu') node = this.buildMenu();
    else if (p === 'paused') node = this.buildPause();
    else if (p === 'route') node = this.buildRoute();
    else if (p === 'upgrade') node = this.buildUpgrade();
    else if (p === 'gameover' && this.state.result) node = this.buildResult();
    const focusedNav = document.activeElement?.dataset?.nav;
    const hadPadFocus = document.activeElement?.classList?.contains('pad-focus');
    this.overlaySlot.replaceChildren(...(node ? [node] : []));
    this.restoreFocus(this.overlaySlot, focusedNav, hadPadFocus);
  }

  restoreFocus(root, nav, pad) {
    if (!nav) return;
    const again = root.querySelector(`[data-nav="${CSS.escape(nav)}"]`);
    if (again && !again.disabled) {
      again.focus({ preventScroll: true });
      if (pad) again.classList.add('pad-focus');
    }
  }

  /* ---- ready room */

  buildMenu() {
    const m = (this.menu = {});
    m.eyebrow = h('div', { className: 'eyebrow' });
    m.intro = h('p');
    m.campaign = h('section', { className: 'campaign-select', 'aria-labelledby': 'campaign-select-heading' });
    m.start = h('button', {
      className: 'start-button',
      type: 'button',
      'data-nav': 'start',
      'data-default': '',
      onClick: () => this.handlers.start(),
    });
    m.console = h('aside', { className: 'menu-console' });
    const node = h(
      'section',
      { className: 'menu-overlay', 'data-confirm': 'click' },
      h(
        'div',
        { className: 'menu-hero' },
        m.eyebrow,
        h('h1', null, h('span', null, 'NEON'), ' GAUNTLET'),
        m.intro,
        m.campaign,
        m.start,
        h(
          'div',
          { className: 'run-specs' },
          h('span', null, h('strong', null, '05'), ' COMBAT ROOMS'),
          h('span', null, h('strong', null, '2–3'), ' PHYSICAL EXITS'),
          h('span', null, h('strong', null, '01'), ' UNIQUE BOSS'),
          h('span', null, h('strong', null, '04'), ' CAMPAIGN LEVELS ADDED'),
        ),
      ),
      m.console,
    );
    this.fillMenu();
    return node;
  }

  /** Update the ready room in place (keeps its entrance animation and the focused control). */
  refreshMenu() {
    if (!this.menu) return;
    const nav = document.activeElement?.dataset?.nav;
    const pad = document.activeElement?.classList?.contains('pad-focus');
    const scroll = this.overlaySlot.firstElementChild?.scrollTop ?? 0;
    this.fillMenu();
    if (this.overlaySlot.firstElementChild) this.overlaySlot.firstElementChild.scrollTop = scroll;
    this.restoreFocus(this.overlaySlot, nav, pad);
  }

  fillMenu() {
    const m = this.menu;
    const s = this.state;
    const progress = s.progress;
    if (!progress) return;
    const breach = !!s.snapshot?.profile.archiveBreach;
    const overtime = s.selected === 'overtime';
    const def = overtime ? null : LEVELS[s.selected];
    m.eyebrow.className = `eyebrow ${breach ? 'breach' : ''}`;
    m.eyebrow.replaceChildren(
      h('span', null, breach ? 'SIGNAL NINE // ARCHIVE BREACH' : overtime ? 'OVERTIME // THE FEED KEEPS RUNNING' : def.kicker),
      h('i'),
    );
    setText(
      m.intro,
      overtime
        ? 'The show was supposed to end. The Network sold more airtime. Survive wave after wave while the floors, the hostiles and the guests keep changing.'
        : def.introLine,
    );
    m.campaign.replaceChildren(...this.campaignRail());
    const label = overtime
      ? 'START OVERTIME'
      : progress.completedLevels.includes(s.selected)
        ? 'REPLAY LEVEL'
        : s.selected === 1
          ? 'START CAMPAIGN'
          : 'ENTER LEVEL';
    m.start.disabled = !s.backend;
    m.start.replaceChildren(h('span', null, label), h('i', null, '↗'));
    m.console.replaceChildren(...this.menuConsole());
  }

  campaignRail() {
    const s = this.state;
    const progress = s.progress;
    const overtimeOpen = progress.completedLevels.length > 0;
    const rail = LEVEL_IDS.map((id) => {
      const def = LEVELS[id];
      const locked = id > progress.highestUnlockedLevel;
      const cleared = progress.completedLevels.includes(id);
      const live = s.selected === id;
      return h(
        'li',
        { className: cleared ? 'cleared' : locked ? 'locked' : 'open' },
        h(
          'button',
          {
            type: 'button',
            disabled: locked,
            'aria-pressed': live ? 'true' : 'false',
            'aria-label': `Level ${id}: ${def.name}. ${locked ? 'Locked' : cleared ? 'Cleared' : 'Available'}.`,
            'data-nav': `level-${id}`,
            style: { '--level-color': def.accent },
            onClick: () => this.handlers.select(id),
          },
          h('span', null, pad2(id)),
          h('strong', null, def.shortName),
          h('i', { 'aria-hidden': 'true' }, locked ? 'LOCK' : cleared ? '✓' : live ? 'LIVE' : 'OPEN'),
        ),
      );
    });
    rail.push(
      h(
        'li',
        { className: `overtime ${overtimeOpen ? 'open' : 'locked'}` },
        h(
          'button',
          {
            type: 'button',
            disabled: !overtimeOpen,
            'aria-pressed': s.selected === 'overtime' ? 'true' : 'false',
            'aria-label': overtimeOpen ? 'Overtime: endless waves.' : 'Overtime. Locked: clear level 1 to open it.',
            'data-nav': 'level-overtime',
            style: { '--level-color': OVERTIME_COLOR },
            onClick: () => this.handlers.select('overtime'),
          },
          h('span', null, 'OT'),
          h('strong', null, 'OVERTIME'),
          h('i', { 'aria-hidden': 'true' }, overtimeOpen ? (s.selected === 'overtime' ? 'LIVE' : 'ENDLESS') : 'CLEAR 01'),
        ),
      ),
    );
    return [
      h(
        'div',
        { className: 'campaign-select-heading' },
        h('span', { id: 'campaign-select-heading' }, 'CAMPAIGN TRANSMISSION'),
        h('strong', null, `${progress.completedLevels.length}/5 LEVELS CLEARED`),
      ),
      h('ol', { className: 'campaign-rail' }, rail),
      this.levelBrief(),
    ];
  }

  levelBrief() {
    const s = this.state;
    const progress = s.progress;
    if (s.selected === 'overtime') {
      const record = progress.overtimeBestWave
        ? `WAVE ${pad2(progress.overtimeBestWave)} · ${scoreText(progress.overtimeBest)}`
        : 'NO RECORD YET';
      return h(
        'div',
        { className: 'campaign-level-brief', style: { '--level-color': OVERTIME_COLOR } },
        h(
          'div',
          null,
          h('small', null, 'OVERTIME // ENDLESS BROADCAST'),
          h('strong', null, 'OVERTIME'),
          h('p', null, 'No exit door. Every floor, every hostile, every guest, until the signal drops.'),
        ),
        h(
          'dl',
          null,
          h('div', null, h('dt', null, 'FORMAT'), h('dd', null, 'ENDLESS WAVES')),
          h('div', null, h('dt', null, 'FLOORS'), h('dd', null, `ROTATE EVERY ${OVERTIME_THEME_WAVES} WAVES`)),
          h('div', null, h('dt', null, 'ENCORE'), h('dd', null, `A BOSS EVERY ${OVERTIME_BOSS_EVERY} WAVES`)),
          h('div', null, h('dt', null, 'RECORD'), h('dd', null, record)),
        ),
      );
    }
    const def = LEVELS[s.selected];
    const best = progress.bestByLevel[s.selected];
    const time = progress.bestTimeByLevel?.[s.selected];
    return h(
      'div',
      { className: 'campaign-level-brief', style: { '--level-color': def.accent } },
      h(
        'div',
        null,
        h('small', null, `LEVEL ${pad2(s.selected)} // ${def.kicker}`),
        h('strong', null, def.name),
        h('p', null, def.challenge),
      ),
      h(
        'dl',
        null,
        h('div', null, h('dt', null, 'CHALLENGE'), h('dd', null, def.mechanicName)),
        h('div', null, h('dt', null, 'WEAPON'), h('dd', null, WEAPONS[def.signatureWeapon].label)),
        h('div', null, h('dt', null, 'HOSTILES'), h('dd', null, def.enemies.map((e) => ENEMIES[e].label).join(' · '))),
        h('div', null, h('dt', null, 'BOSS'), h('dd', null, def.bossName)),
        h('div', null, h('dt', null, 'BEST SCORE'), h('dd', null, best ? scoreText(best) : '—')),
        h('div', null, h('dt', null, 'BEST CLEAR'), h('dd', null, time ? clockText(time) : '—')),
      ),
    );
  }

  menuConsole() {
    const s = this.state;
    const t = s.hostSettings;
    const snap = s.snapshot;
    const source = CONTROLS[s.source] ? s.source : 'keyboard';
    const contract = CONTRACTS[s.contract] ?? CONTRACTS.standard;
    const history = snap?.history.length ?? 0;
    const voiceStatus = snap?.voiceStatus ?? 'loading';
    return [
      h(
        'header',
        null,
        h('span', null, 'CONTESTANT BRIEF'),
        h('strong', null, s.selected === 'overtime' ? 'READY // OVERTIME' : `READY LEVEL ${pad2(s.selected)}`),
      ),
      h(
        'div',
        { className: 'control-grid' },
        CONTROLS[source].map(([key, label]) => h('div', null, h('kbd', null, key), h('span', null, label))),
      ),
      h('p', { className: 'controller-note' }, SOURCE_NOTE[source]),
      h(
        'div',
        { className: 'setting-row contract-row' },
        h('label', null, 'CONTRACT'),
        h(
          'button',
          {
            type: 'button',
            className: 'cycle',
            'data-nav': 'contract',
            'aria-label': `Contract: ${contract.label}. Change difficulty.`,
            onClick: () => this.handlers.cycleContract(),
          },
          `‹ ${contract.label} ›`,
        ),
        h('small', { className: 'contract-note' }, contract.note),
      ),
      h(
        'div',
        { className: 'setting-row' },
        h('label', null, 'VISUAL PROFILE'),
        h(
          'button',
          { type: 'button', className: 'cycle', 'data-nav': 'settings', onClick: () => this.handlers.openSettings() },
          `${s.tier.toUpperCase()} // SETTINGS ⚙`,
        ),
      ),
      h(
        'div',
        { className: 'toggle-row' },
        h(
          'button',
          { type: 'button', className: s.sfx ? 'active' : '', 'aria-pressed': String(s.sfx), 'data-nav': 'sfx', onClick: () => this.handlers.toggleSfx() },
          h('i'),
          ' SFX',
        ),
        h(
          'button',
          {
            type: 'button',
            className: s.reducedMotion ? 'active' : '',
            'aria-pressed': String(s.reducedMotion),
            'data-nav': 'motion',
            onClick: () => this.handlers.toggleMotion(),
          },
          h('i'),
          ' REDUCED MOTION',
        ),
      ),
      h(
        'div',
        { className: 'broadcast-config' },
        h(
          'div',
          { className: 'broadcast-config-head' },
          h('span', null, 'BROADCAST HOST // IONA QUADE'),
          h(
            'button',
            { type: 'button', 'data-nav': 'hear', onClick: () => this.handlers.hearIona() },
            t.voice ? 'HEAR IONA' : 'ENABLE + TEST',
            ' ',
            h('i', null, '▶'),
          ),
        ),
        h(
          'div',
          { className: 'broadcast-toggles' },
          ['voice', 'captions', 'portrait'].map((key) =>
            h(
              'button',
              {
                type: 'button',
                className: t[key] ? 'active' : '',
                'aria-pressed': String(!!t[key]),
                'data-nav': `host-${key}`,
                onClick: () => this.handlers.hostSetting({ [key]: !t[key] }),
              },
              h('i'),
              ` ${key.toUpperCase()}`,
            ),
          ),
        ),
        h(
          'div',
          { className: 'broadcast-frequency' },
          h('label', null, 'CALL FREQUENCY'),
          h(
            'button',
            {
              type: 'button',
              className: 'cycle',
              'data-nav': 'frequency',
              'aria-label': `Call frequency: ${FREQUENCY_LABELS[t.frequency]}`,
              onClick: () => {
                const order = ['minimal', 'standard', 'full'];
                this.handlers.hostSetting({ frequency: order[(order.indexOf(t.frequency) + 1) % order.length] });
              },
            },
            `‹ ${FREQUENCY_LABELS[t.frequency] ?? 'BALANCED'} ›`,
          ),
        ),
        h(
          'div',
          { className: 'broadcast-volume' },
          h('label', { for: 'host-volume' }, 'HOST VOLUME'),
          h('input', {
            id: 'host-volume',
            type: 'range',
            min: '0',
            max: '1',
            step: '0.05',
            value: String(t.volume),
            'data-nav': 'volume',
            onInput: (e) => this.handlers.hostSetting({ volume: Number(e.target.value) }, true),
          }),
          h('span', { className: 'volume-readout' }, `${Math.round(t.volume * 100)}%`),
        ),
        h(
          'div',
          { className: 'broadcast-archive-actions' },
          h('button', { type: 'button', 'data-nav': 'archive', onClick: () => this.handlers.openArchive() }, 'OPEN SIGNAL ARCHIVE'),
          h(
            'button',
            { type: 'button', 'data-nav': 'replay', disabled: history === 0, onClick: () => this.handlers.replayLast() },
            'REPLAY LAST',
          ),
        ),
        h(
          'small',
          null,
          voiceStatus === 'ready'
            ? 'DEVICE VOICE READY'
            : voiceStatus === 'loading'
              ? 'VOICE BANK LOADING'
              : 'VOICE UNAVAILABLE // CAPTIONS ACTIVE',
          ' // FICTIONAL SPONSORS',
        ),
      ),
      h(
        'footer',
        null,
        h('span', null, s.backend === 'webgpu' ? 'WEBGPU RENDER PIPELINE' : 'WEBGL2 RENDER PIPELINE'),
        h('span', null, `ADAPTIVE FX // ${s.tier.toUpperCase()}`),
      ),
    ];
  }

  /** Volume slider moved: update its readout without rebuilding the console. */
  setVolumeReadout(volume) {
    const out = this.overlaySlot.querySelector('.volume-readout');
    if (out) setText(out, `${Math.round(volume * 100)}%`);
    this.state.hostSettings = { ...this.state.hostSettings, volume };
  }

  /* ---- pause */

  controlsHelp() {
    const source = CONTROLS[this.state.source] ? this.state.source : 'keyboard';
    const rows = [...CONTROLS[source], ...(CONTROLS_EXTRA[source] ?? [])];
    return h(
      'div',
      { className: 'controls-help', 'aria-label': 'Controls' },
      rows.map(([key, label]) => h('div', null, h('kbd', null, key), h('span', null, label))),
    );
  }

  buildPause() {
    const history = this.state.snapshot?.history.length ?? 0;
    const replay = h(
      'button',
      { type: 'button', 'data-nav': 'replay', disabled: history === 0, onClick: () => this.handlers.replayLast() },
      'REPLAY LAST CALL',
    );
    this.replayButtons = [replay];
    return h(
      'section',
      { className: 'modal-overlay pause-overlay', 'data-confirm': 'click' },
      h(
        'div',
        { className: 'modal-card' },
        h('span', { className: 'modal-kicker' }, 'BROADCAST HELD'),
        h('h2', null, 'PAUSED'),
        h('p', null, 'The arena is frozen. Your combo is safe.'),
        h(
          'div',
          { className: 'modal-actions' },
          h('button', { type: 'button', className: 'primary', 'data-nav': 'resume', 'data-default': '', onClick: () => this.handlers.resume() }, 'RESUME SHOW'),
          h('button', { type: 'button', 'data-nav': 'settings', onClick: () => this.handlers.openSettings() }, 'SETTINGS'),
          h('button', { type: 'button', 'data-nav': 'archive', onClick: () => this.handlers.openArchive() }, 'SIGNAL NINE ARCHIVE'),
          replay,
          h('button', { type: 'button', 'data-nav': 'restart', onClick: () => this.handlers.restart() }, 'RESTART RUN'),
          h('button', { type: 'button', 'data-nav': 'menu', onClick: () => this.handlers.menu() }, 'READY ROOM'),
        ),
        this.controlsHelp(),
      ),
    );
  }

  /* ---- route doors */

  buildRoute() {
    const s = this.state;
    const hud = s.hud;
    const choices = s.choices;
    if (!hud || !choices.length) return null;
    const sorted = [...choices].sort((a, b) => DIRECTION_ORDER.indexOf(a.direction) - DIRECTION_ORDER.indexOf(b.direction));
    const destination = choices[0]?.destination;
    const bossGate = choices.length === 1 && destination === 'boss';
    const levelGate = choices.length === 1 && destination === 'nextLevel';
    const exitGate = choices.length === 1 && destination === 'campaignExit';
    const cleared = hud.roomsCleared;
    const next = cleared + 1;
    const title = exitGate
      ? 'SIGNAL NINE EXIT OPEN'
      : levelGate
        ? `LEVEL ${pad2(choices[0]?.level)} GATE OPEN`
        : bossGate
          ? `${hud.bossName} GATE OPEN`
          : hud.overtime
            ? `WAVE ${pad2(cleared)} CLEARED`
            : 'MOVE THROUGH A DOOR';
    const subtitle = exitGate
      ? 'TURN AROUND // CROSS THE DOOR THAT WAS SEALED'
      : levelGate
        ? 'CROSS THE THRESHOLD // THE NEXT LEVEL LOADS BEYOND IT'
        : bossGate
          ? hud.overtime
            ? 'CROSS THE THRESHOLD // AN ENCORE GUEST IS WAITING'
            : 'CROSS THE FINAL THRESHOLD // THE LEVEL BOSS IS WAITING'
          : 'COMBAT PAUSED // THE RETURN DOOR IS SEALED';
    const progress = hud.overtime
      ? null
      : h(
          'ol',
          { className: 'route-progress', 'aria-label': 'Level route progress' },
          [1, 2, 3, 4, 5].map((n) =>
            h(
              'li',
              {
                className: n <= cleared ? 'cleared' : n === next ? 'next' : '',
                'aria-label': `Room ${n}${n <= cleared ? ' cleared' : n === next ? ' next' : ''}`,
              },
              h('span', null, pad2(n)),
              n <= cleared ? h('i', { 'aria-hidden': 'true' }, '✓') : null,
            ),
          ),
          h(
            'li',
            {
              className: `boss-stop ${levelGate || exitGate ? 'cleared' : cleared >= 5 ? 'next' : ''}`,
              'aria-label': `Boss room${levelGate || exitGate ? ' cleared' : cleared >= 5 ? ' next' : ''}`,
            },
            h('span', null, 'BOSS'),
          ),
        );
    const prompt = s.source === 'gamepad' ? 'LEFT STICK' : s.source === 'touch' ? 'LEFT THUMB' : 'WASD · ARROWS';
    return h(
      'section',
      {
        className: `route-door-overlay ${bossGate ? 'boss-route' : ''} ${levelGate ? 'level-exit-route' : ''} ${exitGate ? 'campaign-exit-route' : ''}`,
        'aria-live': 'polite',
        'aria-label': exitGate
          ? 'Campaign exit open'
          : levelGate
            ? `Level ${choices[0]?.level} gate open`
            : bossGate
              ? `${hud.bossName} boss gate open`
              : 'Room clear, directional exits open',
      },
      h(
        'header',
        { className: 'route-door-heading' },
        h(
          'div',
          { className: 'route-kicker' },
          h('span', null, hud.overtime ? `OVERTIME // ${hud.levelName}` : `LEVEL ${pad2(hud.level)} // ${hud.levelName}`),
          h('i'),
          h('strong', null, exitGate || levelGate ? 'BOSS CLEARED' : hud.overtime ? `WAVE ${pad2(cleared)} // ${hud.roomName}` : `ROOM ${pad2(cleared)} // ${hud.roomName}`),
        ),
        h('h2', null, title),
        h('p', null, subtitle),
        progress,
      ),
      h(
        'div',
        { className: 'route-compass', 'aria-label': 'Open arena doors' },
        sorted.map((door) => this.doorCard(door)),
        !exitGate
          ? h(
              'div',
              { className: `route-return-lock door-${hud.backDirection.toLowerCase()}` },
              h('strong', null, DIRECTION_LABEL[hud.backDirection]),
              h('span', null, 'RETURN LOCKED'),
            )
          : null,
        h(
          'div',
          { className: 'route-center-prompt', 'aria-hidden': 'true' },
          h('span', null, prompt),
          h('strong', null, 'WALK INTO AN OPEN GATE'),
        ),
      ),
    );
  }

  doorCard(door) {
    const lit = RISK_LEVEL[door.risk] ?? 1;
    const where =
      door.destination === 'nextLevel'
        ? `LEVEL ${pad2(door.level)}`
        : door.destination === 'campaignExit'
          ? 'CAMPAIGN EXIT'
          : door.kicker?.startsWith('OVERTIME')
            ? door.kind === 'boss'
              ? `WAVE ${pad2(door.depth)} // ENCORE`
              : `WAVE ${pad2(door.depth)}`
            : `ROOM ${door.kind === 'boss' ? 'BOSS' : pad2(door.depth)}`;
    return h(
      'article',
      {
        className: `route-door-card door-${door.direction.toLowerCase()}`,
        style: { '--route-accent': door.accent },
        'aria-label': `${door.direction} door, ${where}, ${door.name}. Risk ${door.risk}. ${door.danger}. Reward: ${door.reward}. Walk through this door to enter.`,
      },
      h('header', null, h('strong', null, DIRECTION_LABEL[door.direction]), h('span', null, 'CROSS THRESHOLD')),
      h('div', { className: 'route-door-room' }, h('small', null, where), h('h3', null, door.name)),
      door.sponsorId ? h('span', { className: 'route-door-sponsor' }, 'SPONSORED // ', SPONSORS[door.sponsorId].name) : null,
      h(
        'div',
        { className: 'route-door-risk' },
        h('span', null, door.risk, ' RISK'),
        h('i', { 'aria-hidden': 'true' }, [0, 1, 2, 3].map((v) => h('b', { className: v < lit ? 'lit' : '' }))),
      ),
      h(
        'dl',
        null,
        h('div', null, h('dt', null, 'HOSTILES'), h('dd', null, door.danger)),
        h('div', null, h('dt', null, 'GUARANTEED'), h('dd', null, door.reward)),
      ),
      h(
        'button',
        {
          type: 'button',
          className: 'route-assist-button',
          'aria-label': `Assisted walk to the ${door.direction.toLowerCase()} door for ${door.name}`,
          onClick: () => this.handlers.assistRoute(door.id),
        },
        'ASSISTED WALK ↗',
      ),
    );
  }

  /* ---- sponsor break */

  buildUpgrade() {
    const s = this.state;
    const sponsor = s.snapshot?.sponsor;
    const hint =
      s.source === 'gamepad'
        ? 'D-PAD OR STICK TO BROWSE // A TO SIGN'
        : s.source === 'touch'
          ? 'TAP AN OFFER TO SIGN'
          : 'CLICK OR PRESS 1 · 2 · 3 TO SIGN';
    return h(
      'section',
      { className: 'modal-overlay upgrade-overlay', 'data-confirm': 'focus' },
      sponsor
        ? h(
            'div',
            { className: 'sponsor-bumper', style: { '--sponsor-color': sponsor.color } },
            h('span', null, 'PAID FICTIONAL TRANSMISSION // ', sponsor.category),
            h('strong', null, sponsor.name),
            h('p', null, sponsor.tagline),
          )
        : null,
      h(
        'div',
        { className: 'upgrade-heading' },
        h('span', null, 'SPONSOR BREAK // PICK ONE'),
        h('h2', null, 'CHOOSE YOUR ADVANTAGE'),
        h('p', null, 'Combat airtime is stopped. The crowd is not.'),
      ),
      h(
        'div',
        { className: 'upgrade-grid' },
        s.upgrades.map((u, i) =>
          h(
            'button',
            {
              type: 'button',
              className: 'upgrade-card',
              'data-nav': `upgrade-${u.id}`,
              'data-default': i === 0 ? '' : undefined,
              onClick: () => this.handlers.selectUpgrade(u.id),
            },
            h('span', { className: 'upgrade-number' }, '0', i + 1),
            h('i', null, u.icon),
            h('small', null, u.kicker),
            h('strong', null, u.name),
            h('p', null, u.description),
            h('b', null, 'TAKE UPGRADE ↗'),
          ),
        ),
      ),
      h('p', { className: 'upgrade-hint' }, hint),
    );
  }

  /** Keyboard 1–3 in the sponsor break. */
  pickUpgrade(index) {
    const u = this.state.upgrades[index];
    if (u && this.state.phase === 'upgrade') this.handlers.selectUpgrade(u.id);
  }

  /* ---- results */

  buildResult() {
    const s = this.state;
    const g = s.result;
    const profile = s.snapshot?.profile;
    const kicker = g.victory
      ? 'ALL FIVE LEVELS COMPLETE'
      : g.overtime
        ? `OVERTIME // WAVE ${pad2(g.wave)} REACHED`
        : `LEVEL ${pad2(g.level)} // SIGNAL TERMINATED`;
    const bossLine = g.victory
      ? 'FORECAST PRIME DEFEATED // CAMPAIGN CLEARED'
      : g.overtime
        ? `${g.encores} ENCORE ${g.encores === 1 ? 'GUEST' : 'GUESTS'} DOWN // BEST WAVE ${pad2(Math.max(g.bestWave, g.wave))}`
        : `${g.bossName} STILL HOLDS THIS LEVEL`;
    const archive = h('button', { type: 'button', 'data-nav': 'archive', onClick: () => this.handlers.openArchive() }, 'OPEN SIGNAL ARCHIVE');
    return h(
      'section',
      { className: 'modal-overlay result-overlay', 'data-confirm': 'click' },
      h(
        'div',
        { className: `result-card ${g.victory ? 'victory' : 'defeat'}` },
        h('span', { className: 'modal-kicker' }, kicker),
        h('h2', null, g.victory ? 'THE EXIT IS YOURS' : 'YOU’RE OFF AIR'),
        h('p', { className: 'result-boss-line' }, bossLine),
        g.newBest ? h('div', { className: 'new-best' }, 'NEW NETWORK RECORD') : null,
        profile?.archiveBreach ? h('div', { className: 'archive-breach-result' }, 'SIGNAL NINE // EXIT ROUTE OPEN') : null,
        h('div', { className: 'final-score' }, h('span', null, 'FINAL SCORE'), h('strong', null, scoreText(g.score))),
        h(
          'div',
          { className: 'result-stats' },
          h('div', null, h('span', null, 'KILLS'), h('strong', null, g.kills)),
          h('div', null, h('span', null, 'MAX CHAIN'), h('strong', null, g.maxCombo)),
          g.overtime
            ? h('div', null, h('span', null, 'WAVES CLEARED'), h('strong', null, g.roomsCleared))
            : h('div', null, h('span', null, 'ROOMS CLEARED'), h('strong', null, g.roomsCleared, '/5')),
          h('div', null, h('span', null, 'AIRTIME'), h('strong', null, clockText(g.time))),
          h('div', null, h('span', null, 'SIGNATURE'), h('strong', null, g.favoriteWeapon)),
          h('div', null, h('span', null, 'BEST'), h('strong', null, scoreText(g.best))),
        ),
        h(
          'p',
          { className: 'result-note' },
          `CONTRACT // ${g.contract}`,
          !g.overtime && g.bestTime ? ` · BEST CLEAR ${clockText(g.bestTime)}` : '',
        ),
        h(
          'div',
          { className: 'iona-run-read' },
          h('span', null, "IONA'S READ // PATTERN FILED"),
          h('strong', null, (profile?.style ?? 'unread').toUpperCase()),
          h('p', null, g.damageTaken, ' damage absorbed · ', g.dashesUsed, ' dashes · ', g.bombsUsed, ' wipes'),
        ),
        h(
          'div',
          { className: 'modal-actions result-actions' },
          h(
            'button',
            { type: 'button', className: 'primary', 'data-nav': 'retry', 'data-default': '', onClick: () => this.handlers.restart() },
            g.overtime ? 'RETRY OVERTIME' : g.victory ? 'REPLAY FINAL LEVEL' : 'RETRY LEVEL',
          ),
          archive,
          h('button', { type: 'button', 'data-nav': 'menu', onClick: () => this.handlers.menu() }, 'READY ROOM'),
        ),
      ),
    );
  }

  /* ------------------------------------------------------------------ Signal Nine archive */

  openArchive() {
    this.state.archiveOpen = true;
    this.eraseArmed = false;
    this.renderArchive(false);
  }

  closeArchive() {
    this.state.archiveOpen = false;
    this.archiveSlot.replaceChildren();
    this.archiveShell = null;
    this.clearPadFocus();
  }

  /** What the archive shows; it only rebuilds when this changes (not on every caption). */
  archiveKey(snap) {
    const p = snap.profile;
    return [snap.history.length, snap.history.at(-1)?.instanceId ?? '', p.runs, p.wins, p.losses, p.trust, p.style, p.storyCursor, p.archiveBreach].join('|');
  }

  renderArchive(keepScroll) {
    const snap = this.state.snapshot;
    if (!snap) return;
    this.archiveShownKey = this.archiveKey(snap);
    const grid = this.archiveShell?.querySelector('.archive-grid');
    const log = this.archiveShell?.querySelector('.transcript-log');
    const gridScroll = keepScroll && grid ? grid.scrollTop : 0;
    const logScroll = keepScroll && log ? log.scrollTop : 0;
    const nav = document.activeElement?.dataset?.nav;
    const pad = document.activeElement?.classList?.contains('pad-focus');
    const content = this.archiveContent(snap);
    if (!this.archiveShell) {
      this.archiveShell = h('div', { className: 'archive-shell' });
      this.archiveSlot.replaceChildren(
        h(
          'section',
          { className: 'archive-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'archive-title', 'data-confirm': 'click' },
          this.archiveShell,
        ),
      );
      this.archiveShell.replaceChildren(...content);
      const close = this.archiveShell.querySelector('.archive-close');
      close?.focus({ preventScroll: true });
      return;
    }
    this.archiveShell.replaceChildren(...content);
    const g2 = this.archiveShell.querySelector('.archive-grid');
    const l2 = this.archiveShell.querySelector('.transcript-log');
    if (g2) g2.scrollTop = gridScroll;
    if (l2) l2.scrollTop = logScroll;
    this.restoreFocus(this.archiveSlot, nav, pad);
  }

  archiveContent(i) {
    const sponsors = Object.values(SPONSORS);
    const erase = h(
      'button',
      {
        type: 'button',
        className: `archive-reset ${this.eraseArmed ? 'confirming' : ''}`,
        'data-nav': 'erase',
        onClick: () => {
          if (!this.eraseArmed) {
            this.eraseArmed = true;
            this.renderArchive(true);
            return;
          }
          this.eraseArmed = false;
          this.handlers.resetMemory();
        },
      },
      this.eraseArmed ? 'CONFIRM: ERASE EVERYTHING' : "ERASE IONA'S MEMORY",
    );
    return [
      h(
        'header',
        { className: 'archive-header' },
        h('div', null, h('span', null, 'SIGNAL NINE // UNAUTHORIZED LOCAL ARCHIVE'), h('h2', { id: 'archive-title' }, 'IONA REMEMBERS')),
        h(
          'button',
          { type: 'button', className: 'archive-close', 'data-nav': 'close', 'data-default': '', onClick: () => this.handlers.closeArchive() },
          'CLOSE ',
          h('i', { 'aria-hidden': 'true' }, '×'),
        ),
      ),
      h(
        'div',
        { className: 'archive-grid' },
        h(
          'section',
          { className: `archive-profile ${i.profile.archiveBreach ? 'breach-active' : ''}`, 'aria-labelledby': 'iona-file-title' },
          h('div', { className: 'archive-portrait', 'aria-hidden': 'true' }),
          h(
            'div',
            { className: 'archive-profile-copy' },
            h('span', { id: 'iona-file-title' }, 'HOST FILE // CONTESTANT NINE'),
            h('h3', null, 'IONA QUADE'),
            h(
              'p',
              null,
              'Signal Nine host. Former predictive-safety architect. The voice that found seventeen people a way out during the Black Minute.',
            ),
            h(
              'dl',
              null,
              h('div', null, h('dt', null, 'RUNS REMEMBERED'), h('dd', null, i.profile.runs)),
              h('div', null, h('dt', null, 'WINS / LOSSES'), h('dd', null, i.profile.wins, ' / ', i.profile.losses)),
              h('div', null, h('dt', null, 'TRUST'), h('dd', null, i.profile.trust, '%')),
              h('div', null, h('dt', null, 'YOUR PATTERN'), h('dd', null, STYLE_TITLES[i.profile.style] ?? STYLE_TITLES.unread)),
              h('div', null, h('dt', null, 'ARCHIVE'), h('dd', null, i.chapter.revealed, ' / ', i.chapter.total)),
              h('div', null, h('dt', null, 'EXIT STATUS'), h('dd', null, i.profile.archiveBreach ? 'ROUTE OPEN' : 'BURIED')),
            ),
          ),
        ),
        h(
          'section',
          { className: 'archive-chapter', 'aria-labelledby': 'archive-chapter-title' },
          h(
            'div',
            { className: 'archive-section-head' },
            h('div', null, h('span', null, i.chapter.kicker, ' // ACTIVE THREAD'), h('h3', { id: 'archive-chapter-title' }, i.chapter.title)),
            h('strong', null, pad2(i.chapter.revealed), ' / ', i.chapter.total),
          ),
          h('p', null, i.chapter.summary),
          i.profile.archiveBreach
            ? h(
                'div',
                { className: 'archive-breach-banner' },
                h('span', null, 'SIGNAL NINE // NINE-SECOND WINDOW'),
                h('strong', null, 'ARCHIVE BREACH'),
                h(
                  'p',
                  null,
                  "Three Executive contradictions verified. One deleted evacuation route is answering Iona's uplink.",
                ),
              )
            : null,
          h(
            'div',
            { className: 'archive-progress', 'aria-label': `${i.chapter.revealed} of ${i.chapter.total} transmissions recovered` },
            h('i', { style: { width: `${(i.chapter.revealed / i.chapter.total) * 100}%` } }),
          ),
          h(
            'div',
            { className: 'dossier-list' },
            i.dossier.map((file, n) =>
              h(
                'article',
                { className: file.unlocked ? 'unlocked' : 'locked' },
                h('span', null, 'FILE ', pad2(n + 1)),
                h('h4', null, file.unlocked ? file.title : 'ENCRYPTED'),
                h('p', null, file.unlocked ? file.text : 'Continue disrupting the forecast to recover this record.'),
              ),
            ),
          ),
        ),
        h(
          'section',
          { className: 'archive-sponsors', 'aria-labelledby': 'sponsor-registry-title' },
          h(
            'div',
            { className: 'archive-section-head' },
            h('div', null, h('span', null, 'DISCLOSURE LOG // FICTIONAL IN-UNIVERSE BRANDS'), h('h3', { id: 'sponsor-registry-title' }, 'SPONSOR REGISTRY')),
          ),
          h(
            'div',
            { className: 'sponsor-registry' },
            sponsors.map((s) =>
              h(
                'article',
                { style: { '--sponsor-color': s.color } },
                h('i', { 'aria-hidden': 'true' }),
                h('span', null, s.category),
                h('h4', null, s.name),
                h('p', null, s.tagline),
              ),
            ),
          ),
        ),
        h(
          'section',
          { className: 'archive-transcript', 'aria-labelledby': 'transcript-title' },
          h(
            'div',
            { className: 'archive-section-head' },
            h('div', null, h('span', null, 'THIS SESSION // ', i.history.length, ' CAPTURED CALLS'), h('h3', { id: 'transcript-title' }, 'LIVE TRANSCRIPT')),
            h(
              'button',
              { type: 'button', 'data-nav': 'replay', disabled: i.history.length === 0, onClick: () => this.handlers.replayLast() },
              'REPLAY LAST ',
              h('i', null, '▶'),
            ),
          ),
          h(
            'div',
            { className: 'transcript-log', role: 'log', 'aria-live': 'off' },
            i.history.length === 0
              ? h('p', { className: 'transcript-empty' }, 'No calls captured yet. Start a run to open the channel.')
              : i.history.map((line) =>
                  h(
                    'article',
                    { className: `transcript-line kind-${line.kind}` },
                    h(
                      'div',
                      null,
                      h('span', null, timeFormat(line.timestamp)),
                      h('strong', null, line.speaker === 'iona' ? 'IONA' : line.speaker.toUpperCase()),
                      h('small', null, line.kind.toUpperCase()),
                    ),
                    h('p', null, line.text),
                  ),
                ),
          ),
        ),
      ),
      h(
        'footer',
        { className: 'archive-footer' },
        h('p', null, 'Stored only in this browser. The public slate still reports every attempt as a debut.'),
        erase,
      ),
    ];
  }

  /* ------------------------------------------------------------------ controller / keyboard navigation */

  /** The container a controller is navigating right now (null during combat). */
  navRoot() {
    if (this.state.archiveOpen) return this.archiveSlot;
    const p = this.state.phase;
    if (p === 'menu' || p === 'paused' || p === 'upgrade' || p === 'gameover') return this.overlaySlot;
    return null;
  }

  focusables(root) {
    return [...root.querySelectorAll('button:not([disabled]), input[type="range"]')].filter(
      (el) => el.getClientRects().length > 0,
    );
  }

  focusEl(el) {
    if (!el) return;
    this.clearPadFocus();
    el.focus({ preventScroll: true });
    el.classList.add('pad-focus');
    el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }

  clearPadFocus() {
    for (const el of document.querySelectorAll('.pad-focus')) el.classList.remove('pad-focus');
  }

  /** Move focus to the nearest control in a direction (dx, dy: -1, 0 or 1; dy -1 is up). */
  navigate(dx, dy) {
    const root = this.navRoot();
    if (!root) return false;
    const list = this.focusables(root);
    if (!list.length) return false;
    const current = document.activeElement;
    if (!list.includes(current)) {
      this.focusEl(root.querySelector('[data-default]:not([disabled])') ?? list[0]);
      return true;
    }
    if (current.type === 'range' && dx !== 0 && dy === 0) {
      const step = Number(current.step) || 0.05;
      const value = Math.max(Number(current.min), Math.min(Number(current.max), Number(current.value) + dx * step));
      current.value = String(value);
      current.dispatchEvent(new Event('input', { bubbles: true }));
      current.classList.add('pad-focus');
      return true;
    }
    const a = current.getBoundingClientRect();
    const ax = a.left + a.width / 2;
    const ay = a.top + a.height / 2;
    let best = null;
    let bestScore = Infinity;
    for (const el of list) {
      if (el === current) continue;
      const b = el.getBoundingClientRect();
      const ddx = b.left + b.width / 2 - ax;
      const ddy = b.top + b.height / 2 - ay;
      const along = dx !== 0 ? ddx * dx : ddy * dy;
      if (along <= 2) continue;
      const across = dx !== 0 ? Math.abs(ddy) : Math.abs(ddx);
      const score = along + across * 2.2;
      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    }
    if (best) this.focusEl(best);
    else current.classList.add('pad-focus');
    return true;
  }

  /** A (or Enter): press the focused control, or the screen's main one. */
  confirm() {
    const root = this.navRoot();
    if (!root) return;
    const current = document.activeElement;
    if (current && root.contains(current) && current.matches('button:not([disabled])')) {
      current.click();
      return;
    }
    const fallback = root.querySelector('[data-default]:not([disabled])') ?? this.focusables(root)[0];
    if (!fallback) return;
    const mode = root.querySelector('[data-confirm]')?.dataset.confirm;
    if (mode === 'click' && fallback.matches('button')) fallback.click();
    else this.focusEl(fallback);
  }

  /** B (or Escape): close the archive, or leave the pause card. */
  back() {
    if (this.state.archiveOpen) {
      this.handlers.closeArchive();
      return;
    }
    if (this.state.phase === 'paused') this.handlers.resume();
  }
}
