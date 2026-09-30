// Crown of Emberfall on the shared 3D kit: boot, input routing and the loop.

import { boot } from 'kit/boot.js';
import { MAPS, ENEMIES, SETTINGS_KEY, DEFAULT_SETTINGS, CHALLENGE } from './data.js';
import { createWorld, shade } from './world3d.js';
import { createGame } from './game.js';
import { createUI } from './ui.js';
import { createAudio } from './audio.js';

// ---- settings (the original's key; old saves of it still load) ------------------

function loadSettings() {
  const out = { ...DEFAULT_SETTINGS };
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null');
    if (saved && typeof saved === 'object') {
      for (const k of ['music', 'sfx', 'reducedMotion']) if (typeof saved[k] === 'boolean') out[k] = saved[k];
      if (['slow', 'normal', 'fast'].includes(saved.textSpeed)) out.textSpeed = saved.textSpeed;
      if (CHALLENGE[saved.challenge]) out.challenge = saved.challenge;
      if (Number.isFinite(saved.zoom)) out.zoom = Math.min(1.6, Math.max(0.7, saved.zoom));
    }
  } catch {
    /* private mode or blocked storage: defaults */
  }
  try {
    if (new URLSearchParams(location.search).get('textSpeed') === 'instant') out.textSpeed = 'fast';
  } catch {
    /* no query string */
  }
  return out;
}
const settings = loadSettings();
let settingsTimer = 0;
function saveSettings() {
  clearTimeout(settingsTimer);
  settingsTimer = setTimeout(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      /* not persisted this time */
    }
  }, 250);
}

// ---- boot -----------------------------------------------------------------------

const kit = await boot({
  title: 'Crown of Emberfall',
  accent: '#ed5c63',
  background: '#243753',
  gear: 'none', // the adventure menu's Settings page and the title screen open the kit panel
  renderer: { alpha: true }, // the sky gradient is CSS behind the canvas, as in the original
  touch: { top: 'right', topOffset: 86 },
  input: {
    move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick' },
    confirm: { keys: ['Space', 'Enter', 'NumpadEnter', 'KeyZ', 'KeyE'], gamepad: ['A'], touch: 'A' },
    back: { keys: ['KeyX', 'KeyK', 'Backspace'], mouse: [2], gamepad: ['B'] },
    menu: { keys: ['Escape', 'KeyM', 'KeyP'], gamepad: ['Start'], touch: { label: 'Menu', slot: 'top' } },
    prev: { keys: ['KeyQ', 'Minus', 'NumpadSubtract'], gamepad: ['LB'] },
    next: { keys: ['KeyR', 'Equal', 'NumpadAdd'], gamepad: ['RB'] },
  },
});
kit.renderer.setClearColor(0x000000, 0);
const input = kit.input;

const scan = document.createElement('div');
scan.className = 'scanlines';
scan.setAttribute('aria-hidden', 'true');
document.body.append(scan);
const root = document.createElement('div');
document.body.append(root);

const audio = createAudio(() => settings);
const world = createWorld(kit);

let path = null; // tap-to-walk: { steps: [{x, y}], interact: {x, y} | null }
let ui = null;

const fx = {
  hitEnemy(dmg, crit) {
    world.hitEnemy(crit ? 1.5 : 1);
    ui?.flash('enemy');
    const p = world.enemyScreen();
    ui?.popup(crit ? `${dmg}!` : String(dmg), p.x, p.y, crit ? 'crit' : '');
    input.rumble(crit ? 0.45 : 0.25, crit ? 140 : 70);
  },
  hitPlayer(dmg, heavy) {
    world.hitPlayer(heavy ? 1.6 : 1);
    ui?.flash('player');
    ui?.popup(`-${dmg}`, kit.size.width * 0.5, kit.size.height * 0.6, 'hurt');
    input.rumble(heavy ? 0.9 : 0.55, heavy ? 320 : 160);
  },
  heal(n) {
    if (n > 0) ui?.popup(`+${n}`, kit.size.width * 0.5, kit.size.height * 0.6, 'heal');
  },
  enemyDown() {
    world.defeatEnemy();
    input.rumble(0.4, 180);
  },
  levelUp(level) {
    audio.jingle([523, 659, 784, 1046, 1318], 0.08, 0.2);
    ui?.popup(`Level ${level}!`, kit.size.width * 0.5, kit.size.height * 0.38, 'level');
    input.rumble(0.3, 220);
  },
  snap() {
    world.snap();
    path = null;
  },
  rumble(s, ms) {
    input.rumble(s, ms);
  },
};

const game = createGame({ settings: () => settings, audio, fx });

let confirmLabel = 'A';
const actions = {
  begin(name) {
    game.newJourney(name);
    ui.titleView = 'main';
  },
  load(slot) {
    if (game.load(slot)) {
      ui.titleView = 'main';
      input.settle();
    }
  },
  toTitle() {
    game.toTitle();
    ui.titleView = 'main';
    ui.quitArmed = false;
    path = null;
  },
  unlockAudio: () => audio.unlock(),
  sfx: (f, d, o) => audio.sfx(f, d, o),
  openKitSettings: () => kit.menu.open(),
  fullscreen() {
    try {
      if (document.fullscreenElement) document.exitFullscreen?.()?.catch?.(() => {});
      else document.documentElement.requestFullscreen?.()?.catch?.(() => {});
    } catch {
      /* not allowed here */
    }
  },
  settings: () => settings,
  setSetting(key, value) {
    settings[key] = value;
    saveSettings();
    game.ui.version += 1;
    audio.sfx(620, 0.04);
  },
  quit() {
    if (ui.quitArmed) actions.toTitle();
    else {
      ui.quitArmed = true;
      game.ui.version += 1;
    }
  },
  setConfirmLabel(label) {
    if (label === confirmLabel) return;
    confirmLabel = label;
    kit.touch?.setLabel('confirm', label);
  },
};

ui = createUI({ root, game, kit, world, actions });

// Sound starts on the first gesture; pause and hidden tabs silence it.
addEventListener('pointerdown', () => audio.unlock(), true);
addEventListener('keydown', () => audio.unlock(), true);
kit.onPause((p) => audio.pause(p || document.hidden));
document.addEventListener('visibilitychange', () => audio.pause(document.hidden || kit.paused));

// QA handle.
window.__emberfall = { game, world, kit, settings };

kit.loading.progress(0.8, 'Raising Hearthglen…');
await world.warm();

// ---- input helpers ----------------------------------------------------------------

const STEP_FIRST = 0.17; // hold a direction: a second step after this long…
const STEP_EVERY = 0.15; // …then one step per this long
const NAV_FIRST = 0.36;
const NAV_EVERY = 0.12;

/** The held direction from the move action, one axis at a time. */
function heldDir() {
  const v = input.vector('move');
  if (Math.hypot(v.x, v.y) < 0.4) return null;
  if (Math.abs(v.x) > Math.abs(v.y)) return v.x > 0 ? 'east' : 'west';
  return v.y > 0 ? 'north' : 'south';
}
const SCREEN = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };

// Which mouse button went down last on the canvas (right click is Back, not a walk order).
let lastButton = 0;
kit.canvas.addEventListener('pointerdown', (e) => (lastButton = e.button), true);

let walkDir = null;
let walkT = 0;
let navDir = null;
let navT = 0;
let pathT = 0;

// Breadth-first path over the current map. Exits and waiting bosses only as the last step.
function findPath(tx, ty, adjacent) {
  const s = game.state;
  const m = MAPS[s.mapId];
  const W = m.width;
  const H = m.height;
  const goal = (x, y) => (adjacent ? Math.abs(x - tx) + Math.abs(y - ty) === 1 : x === tx && y === ty);
  if (goal(s.x, s.y)) return [];
  const trigger = (x, y) => m.exits.some((e) => e.x === x && e.y === y) || m.bosses.some((b) => b.x === x && b.y === y && !s.flags.includes(b.flag));
  const prev = new Int32Array(W * H).fill(-1);
  const start = s.y * W + s.x;
  prev[start] = start;
  const queue = [start];
  let found = -1;
  for (let head = 0; head < queue.length && found < 0; head += 1) {
    const cur = queue[head];
    const cx = cur % W;
    const cy = (cur / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = ny * W + nx;
      if (prev[ni] !== -1 || !game.walkable(nx, ny)) continue;
      const isGoal = goal(nx, ny);
      if (!isGoal && trigger(nx, ny)) continue;
      prev[ni] = cur;
      if (isGoal) {
        found = ni;
        break;
      }
      queue.push(ni);
    }
  }
  if (found < 0) return null;
  const steps = [];
  for (let i = found; i !== start; i = prev[i]) steps.push({ x: i % W, y: (i / W) | 0 });
  return steps.reverse();
}

function tapToWalk() {
  const s = game.state;
  const p = input.pointer;
  if (!p.justDown || (p.type !== 'touch' && lastButton !== 0)) return;
  const tile = world.pick(p.nx, p.ny);
  if (!tile) return;
  const m = MAPS[s.mapId];
  const at = (list) => list.some((o) => o.x === tile.x && o.y === tile.y);
  const talky = at(m.npcs) || at(m.chests) || m.props.some((pr) => pr.x === tile.x && pr.y === tile.y && ['well', 'crystal', 'bellframe'].includes(pr.kind));
  let steps;
  let interact = null;
  if (talky) {
    steps = findPath(tile.x, tile.y, true);
    interact = tile;
  } else if (game.walkable(tile.x, tile.y)) steps = findPath(tile.x, tile.y, false);
  if (!steps) {
    audio.sfx(130, 0.035);
    return;
  }
  path = { steps, interact };
  pathT = 0;
  audio.unlock();
  const mark = world.project(tile.x, tile.y, 0.05);
  if (mark) ui.popup('◆', mark.x, mark.y, 'marker');
}

function followPath(dt) {
  const s = game.state;
  pathT -= dt;
  if (pathT > 0) return;
  if (path.steps.length) {
    const next = path.steps.shift();
    const dx = next.x - s.x;
    const dy = next.y - s.y;
    const dir = dx === 1 ? 'east' : dx === -1 ? 'west' : dy === 1 ? 'south' : dy === -1 ? 'north' : null;
    const mapBefore = s.mapId;
    if (!dir || Math.abs(dx) + Math.abs(dy) !== 1 || !game.move(dir) || game.state?.mode !== 'field' || s.mapId !== mapBefore) {
      path = null;
      return;
    }
    pathT = STEP_EVERY;
    return;
  }
  if (path.interact) {
    const dx = path.interact.x - s.x;
    const dy = path.interact.y - s.y;
    const dir = dx === 1 ? 'east' : dx === -1 ? 'west' : dy === 1 ? 'south' : 'north';
    if (s.facing !== dir) {
      s.facing = dir;
      game.ui.version += 1;
    }
    game.interact();
  }
  path = null;
}

function setZoom(z) {
  const next = Math.min(1.6, Math.max(0.7, z));
  if (Math.abs(next - settings.zoom) < 0.001) return;
  settings.zoom = next;
  saveSettings();
}

function themeFor(s) {
  if (!s) return 'town';
  if (s.mode === 'gameover') return 'none';
  if (s.mode === 'credits') return 'ending';
  if (s.mode === 'combat' && s.combat) return ENEMIES[s.combat.enemyId].boss ? 'boss' : 'battle';
  const m = MAPS[s.mapId];
  if (m.id === 'belfry') return 'belfry';
  return m.type === 'town' ? 'town' : m.type === 'dungeon' ? 'dungeon' : 'world';
}

// ---- per-frame input ----------------------------------------------------------------

function handleInput(dt) {
  const s = game.state;
  const navRoot = ui.navRoot();

  // Back / menu: the original's X, M and Esc all did this.
  if (input.pressed('menu') || input.pressed('back')) {
    if (!s) {
      if (ui.titleView !== 'main') ui.setTitleView('main');
    } else {
      path = null;
      if (s.mode === 'menu') ui.quitArmed = false;
      game.cancel();
    }
  }

  // Tabs in menus and shops; zoom on the road.
  const prev = input.pressed('prev');
  const next = input.pressed('next');
  if (prev || next) {
    if (s?.mode === 'menu') ui.cycleTab(next ? 1 : -1);
    else if (s?.mode === 'shop' && !s.activeShop.startsWith('inn:')) ui.setShopTab(game.ui.shopTab === 'buy' ? 'sell' : 'buy');
    else if (s?.mode === 'field' || !s) setZoom(settings.zoom * (next ? 1.15 : 1 / 1.15));
  }
  if (s?.mode === 'field') {
    const z = input.zoom();
    if (z) setZoom(settings.zoom * 2 ** (z * 0.25));
  }

  // Directions: walk on the road, move focus in menus.
  const dir = heldDir();
  if (navRoot) {
    walkDir = null;
    if (dir && dir !== navDir) {
      navT = NAV_FIRST;
      ui.navMove(...SCREEN[dir]);
    } else if (dir) {
      navT -= dt;
      if (navT <= 0) {
        navT = NAV_EVERY;
        ui.navMove(...SCREEN[dir]);
      }
    }
    navDir = dir;
  } else {
    navDir = null;
    if (s?.mode === 'field') {
      if (dir) path = null;
      if (dir && dir !== walkDir) {
        walkT = STEP_FIRST;
        game.move(dir);
      } else if (dir) {
        walkT -= dt;
        if (walkT <= 0) {
          walkT = STEP_EVERY;
          game.move(dir);
        }
      }
      walkDir = dir;
    } else walkDir = null;
  }

  // Confirm.
  if (input.pressed('confirm')) {
    if (navRoot) {
      if (!ui.navConfirm()) {
        if (s?.mode === 'combat' && game.ui.combatView === 'root') game.combatAction('attack');
        else if (s?.mode === 'gameover') game.rise();
        else ui.focusDefault(true);
      }
    } else if (s?.mode === 'dialogue') game.advanceDialogue();
    else if (s?.mode === 'field') {
      path = null;
      game.interact();
    }
  }

  // Tap or click the ground to walk there; during dialogue a tap anywhere turns the page.
  if (s?.mode === 'field' && game.state?.mode === 'field') {
    tapToWalk();
    if (path && !dir) followPath(dt);
  } else {
    path = null;
    const p = input.pointer;
    if (s?.mode === 'dialogue' && p.justDown && (p.type === 'touch' || lastButton === 0)) game.advanceDialogue();
  }
}

// ---- the loop ----------------------------------------------------------------------

const view = { mapId: 'hearthglen', x: 7, y: 11, facing: 'north', flags: [], openedChests: [], combat: null, reducedMotion: false, zoom: 1, talkTo: null, title: true };
const combatView = { enemyId: '', phase: 1 };
const NONE = [];
let skyFor = '';
let touchSuspended = null;

kit.start((dt, t) => {
  if (input.source === 'gamepad' && !audio.ready && (input.pressed('confirm') || input.pressed('menu') || input.pressed('back'))) audio.unlock();
  handleInput(dt);
  game.tick(dt);

  const s = game.state;
  // Touch controls belong to the road; menus, dialogue and battles are tapped directly.
  const suspend = !(s && s.mode === 'field');
  if (suspend !== touchSuspended) {
    touchSuspended = suspend;
    kit.touch?.suspend(suspend, 'game');
  }

  audio.setTheme(themeFor(s));
  audio.update();

  view.reducedMotion = !!settings.reducedMotion;
  view.zoom = settings.zoom;
  if (s) {
    view.title = false;
    view.mapId = s.mapId;
    view.x = s.x;
    view.y = s.y;
    view.facing = s.facing;
    view.flags = s.flags;
    view.openedChests = s.openedChests;
    if (s.mode === 'combat' && s.combat) {
      combatView.enemyId = s.combat.enemyId;
      combatView.phase = s.combat.phase;
      view.combat = combatView;
    } else view.combat = null;
    const talking = s.mode === 'dialogue' || s.mode === 'shop' ? game.facingTarget() : null;
    view.talkTo = talking?.kind === 'npc' ? talking.npc.id : null;
  } else {
    view.title = true;
    view.mapId = 'hearthglen';
    view.x = 7;
    view.y = 11;
    view.facing = 'north';
    view.flags = NONE;
    view.openedChests = NONE;
    view.combat = null;
    view.talkTo = null;
  }
  const sky = MAPS[view.mapId].sky;
  if (sky !== skyFor) {
    skyFor = sky;
    document.body.style.background = `linear-gradient(${sky}, ${shade(sky, 0.22)})`;
  }

  world.update(dt, t, view);
  ui.update();
  world.render();
});
