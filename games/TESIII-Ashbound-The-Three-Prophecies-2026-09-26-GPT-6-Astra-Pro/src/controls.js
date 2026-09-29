import { clamp } from './util.js';

/**
 * Every action the game reads, for boot({ input }). Keyboard keys are the game's own;
 * gamepad and touch follow the kit's standard bindings. Touch buttons appear in this
 * order and the first (attack) is the big one.
 */
export const ACTIONS = {
  move: { type: 'vector', keys: 'wasd', gamepad: 'leftStick+dpad', touch: 'stick' },
  // The game's keyboard look: the arrows turn and tilt the head, for playing without mouse capture.
  turn: { type: 'vector', keys: 'arrows', gamepad: [] },
  // Mouse look while captured, or while holding the right button when capture is unavailable.
  look: { type: 'look', mouse: 'drag', gamepad: 'rightStick', touch: 'drag' },
  attack: { mouse: [0], gamepad: ['RT'], touch: '†' },
  jump: { keys: ['Space'], gamepad: ['A'], touch: '↑' },
  cast: { keys: ['KeyF'], gamepad: ['LT'], touch: '✧' },
  sneak: { keys: ['ControlLeft', 'ControlRight'], gamepad: ['B'], touch: '↓' },
  interact: { keys: ['KeyE'], gamepad: ['X'], touch: 'Use' },
  run: { keys: ['ShiftLeft', 'ShiftRight'], gamepad: ['LS'] },
  strike: { keys: ['KeyV'] },
  inventory: { keys: ['KeyI'], gamepad: ['Y'] },
  journal: { keys: ['KeyJ'] },
  map: { keys: ['KeyM'] },
  rest: { keys: ['KeyR'], gamepad: ['Back'] },
  power: { keys: ['KeyP'] },
  healthPotion: { keys: ['KeyH'], gamepad: ['RS'] },
  magickaPotion: { keys: ['KeyG'] },
  nextWeapon: { keys: ['KeyQ'], gamepad: ['RB'] },
  nextSpell: { keys: ['KeyB'], gamepad: ['LB'] },
  slot1: { keys: ['Digit1'] },
  slot2: { keys: ['Digit2'] },
  slot3: { keys: ['Digit3'] },
  slot4: { keys: ['Digit4'] },
  pause: { keys: ['Escape'], gamepad: ['Start'] },
};

const FOCUSABLE = 'button:not(:disabled),input:not([hidden]):not(:disabled),select:not(:disabled),a[href]';

/**
 * The game's side of kit.input: movement and look for the fixed step, the charged
 * attack, one-shot commands, and gamepad / keyboard navigation of the game's DOM menus.
 */
export class Controls {
  constructor(game, kit) {
    this.game = game;
    this.kit = kit;
    this.input = kit.input;
    this.chargeStart = null;
    this.captureUnavailable = false;
    this.lockClick = false;
    this.navDir = null;
    this.navRepeat = 0;
    this.useShown = null;
    const canvas = kit.canvas;
    // Pointer lock must be requested inside the click itself; the click that captures the mouse does not attack.
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0 || game.modal || !game.state) return;
      if (document.pointerLockElement === canvas || this.captureUnavailable) return;
      this.lockClick = true;
      this.input.lockPointer();
    });
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement) {
        this.captureUnavailable = false;
        return;
      }
      if (!game.modal && game.state) {
        this.clear();
        game.ui.pause();
      }
    });
    document.addEventListener('pointerlockerror', () =>
      setTimeout(() => {
        if (document.pointerLockElement || this.captureUnavailable) return;
        this.captureUnavailable = true;
        game.toast('Mouse capture unavailable. Hold right mouse to look, or use arrow keys.');
      }, 300),
    );
    const away = () => {
      this.clear();
      if (game.state && !game.modal) game.ui.pause();
    };
    addEventListener('blur', away);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) away();
    });
  }
  /** Drop a charging attack and treat whatever is held as already handled (after menus open or close). */
  clear() {
    this.chargeStart = null;
    this.input.settle();
  }
  /** Movement for the fixed step: x to the right, z backwards (W is -1), as the game's physics expects. */
  movement() {
    const i = this.input;
    const v = i.vector('move');
    return { x: v.x, z: -v.y, jump: i.down('jump'), sneak: i.down('sneak'), run: i.down('run') };
  }
  applyLook(s, dt) {
    const look = this.input.look('look');
    const turn = this.input.vector('turn');
    s.yaw -= look.x + turn.x * 1.8 * dt;
    s.pitch = clamp(s.pitch - look.y + turn.y * 1.4 * dt, -1.45, 1.45);
  }
  startCharge() {
    if (!this.game.modal) this.chargeStart = performance.now();
  }
  releaseCharge() {
    if (this.chargeStart === null) return;
    const charge = clamp((performance.now() - this.chargeStart) / 750, 0.12, 1);
    this.chargeStart = null;
    if (!this.game.modal) this.game.attack(charge);
  }
  /** Once per frame, before the simulation. */
  update(dt) {
    const g = this.game;
    const i = this.input;
    this.syncTouchLayout();
    if (i.pressed('pause')) {
      this.escape();
      return;
    }
    if (g.modal) {
      this.chargeStart = null;
      this.menu(dt);
      return;
    }
    if (!g.state) return;
    if (i.pressed('attack')) {
      if (this.lockClick) this.lockClick = false;
      else this.startCharge();
    }
    if (i.released('attack')) this.releaseCharge();
    const commands = [
      ['strike', () => g.attack(1)],
      ['interact', () => g.interact()],
      ['cast', () => g.cast()],
      ['inventory', () => g.ui.inventory()],
      ['journal', () => g.ui.journal()],
      ['map', () => g.ui.map()],
      ['rest', () => g.rest()],
      ['power', () => g.power()],
      ['healthPotion', () => g.quickPotion('health')],
      ['magickaPotion', () => g.quickPotion('magicka')],
      ['slot1', () => g.slot(1)],
      ['slot2', () => g.slot(2)],
      ['slot3', () => g.slot(3)],
      ['slot4', () => g.slot(4)],
      ['nextSpell', () => g.nextSpell()],
      ['nextWeapon', () => g.nextWeapon()],
    ];
    for (const [name, run] of commands) {
      if (g.modal || !g.state) break;
      if (i.pressed(name)) run();
    }
  }
  /** body.touch-ui (and touch-lefty) while the kit's touch controls show, so the HUD can make room. */
  syncTouchLayout() {
    const t = this.kit.touch;
    const on = !!t?.visible;
    const lefty = !!t?.element.classList.contains('is-lefty');
    if (on !== this.touchUi) {
      this.touchUi = on;
      document.body.classList.toggle('touch-ui', on);
    }
    if (lefty !== this.lefty) {
      this.lefty = lefty;
      document.body.classList.toggle('touch-lefty', lefty);
    }
  }
  /** The touch Use button only shows while the crosshair rests on something to use. */
  showUse(target) {
    const shown = !!target && !(target.type === 'enemy' && !target.docile);
    if (shown === this.useShown) return;
    this.useShown = shown;
    this.kit.touch?.setShown('interact', shown);
  }
  /** Esc / Start: pause and resume, or back to the title from its sub-screens. */
  escape() {
    const g = this.game;
    this.clear();
    if (!g.state) {
      if (g.ui.screen !== 'title') g.ui.title();
      return;
    }
    g.modal ? g.ui.resume() : g.ui.pause();
  }
  /** The game's DOM menus with a gamepad or keys: stick / D-pad / WASD / arrows move, A chooses, B goes back. */
  menu(dt) {
    const i = this.input;
    const m = i.vector('move');
    const t = i.vector('turn');
    const x = m.x + t.x;
    const y = m.y + t.y;
    let dir = null;
    if (Math.max(Math.abs(x), Math.abs(y)) > 0.5) dir = Math.abs(x) > Math.abs(y) ? (x > 0 ? 'right' : 'left') : y > 0 ? 'up' : 'down';
    if (!dir) this.navDir = null;
    else if (dir !== this.navDir) {
      this.navDir = dir;
      this.navRepeat = 0.38;
      this.step(dir);
    } else if ((this.navRepeat -= dt) <= 0) {
      this.navRepeat = 0.11;
      this.step(dir);
    }
    if (i.pressed('jump')) this.confirm();
    else if (i.pressed('sneak')) this.escape();
  }
  focusables() {
    const root = this.game.ui.root;
    return [...root.querySelectorAll(FOCUSABLE)].filter((n) => n.getClientRects().length && n.type !== 'file');
  }
  step(dir) {
    const items = this.focusables();
    if (!items.length) return;
    const cur = items.includes(document.activeElement) ? document.activeElement : null;
    if (!cur) {
      items[0].focus();
      return;
    }
    const horizontal = dir === 'left' || dir === 'right';
    // Sliders, lists and number fields change with left / right.
    if (horizontal && this.adjust(cur, dir === 'right' ? 1 : -1)) return;
    const r = cur.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const sign = dir === 'right' || dir === 'down' ? 1 : -1;
    let best = null;
    let bestScore = Infinity;
    for (const n of items) {
      if (n === cur) continue;
      const q = n.getBoundingClientRect();
      // Distance along the direction from the near edges, so wide rows and tall columns both work.
      const along = horizontal
        ? sign > 0
          ? q.left - r.right
          : r.left - q.right
        : sign > 0
          ? q.top - r.bottom
          : r.top - q.bottom;
      if (along < -2) continue;
      const nx = q.left + q.width / 2;
      const ny = q.top + q.height / 2;
      const across = horizontal ? Math.abs(ny - cy) : Math.abs(nx - cx);
      const overlap = horizontal ? q.bottom > r.top && q.top < r.bottom : q.right > r.left && q.left < r.right;
      const score = Math.max(0, along) + across * (overlap ? 0.5 : 2.5);
      if (score < bestScore) {
        bestScore = score;
        best = n;
      }
    }
    if (best) {
      best.focus();
      best.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }
  adjust(el, delta) {
    if (el.tagName === 'SELECT') {
      const n = el.options.length;
      if (!n) return true;
      el.selectedIndex = (el.selectedIndex + delta + n) % n;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    if (el.tagName === 'INPUT' && (el.type === 'range' || el.type === 'number')) {
      delta > 0 ? el.stepUp() : el.stepDown();
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    return false;
  }
  confirm() {
    const el = this.game.ui.root.contains(document.activeElement) ? document.activeElement : null;
    if (!el) {
      this.focusables()[0]?.focus();
      return;
    }
    if (el.tagName === 'SELECT') this.adjust(el, 1);
    else if (el.tagName === 'INPUT' && el.type !== 'checkbox') el.select?.();
    else el.click();
  }
}
