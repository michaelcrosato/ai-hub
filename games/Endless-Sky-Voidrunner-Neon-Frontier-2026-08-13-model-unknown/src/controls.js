/**
 * controls.js — every input the game reads, as kit actions, plus the menu
 * navigation that lets a gamepad (or the arrow keys) drive the game's own
 * DOM screens: title, station, galaxy map, pause, settings and field guide.
 *
 * Keyboard keeps the original layout (WASD, mouse aim, Space/Shift boost,
 * Tab, R, E, Q, X, M, 1–4, wheel; F or J also fire). Gamepad and touch
 * follow the wall's standard bindings.
 */

export const ACTIONS = {
  move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick' },
  // Twin-stick aim; on touch the right stick also fires (as the original's did).
  aim: { type: 'vector', gamepad: 'rightStick', touch: 'stick-right' },
  fire: { keys: ['KeyF', 'KeyJ'], mouse: [0], gamepad: ['RT'] },
  boost: { keys: ['Space', 'ShiftLeft', 'ShiftRight'], gamepad: ['A'], touch: 'Boost' },
  missile: { keys: ['KeyK'], mouse: [2], gamepad: ['LT', 'B'], touch: 'Missile' },
  interact: { keys: ['KeyE'], gamepad: ['X'], touch: 'Use' },
  target: { keys: ['Tab'], gamepad: ['RB'], touch: 'Target' },
  scan: { keys: ['KeyR'], gamepad: ['Y'], touch: 'Scan' },
  repair: { keys: ['KeyQ'], gamepad: ['LS'], touch: { label: 'Repair', slot: 'top' } },
  ecm: { keys: ['KeyX'], gamepad: ['RS'], touch: { label: 'ECM', slot: 'top' } },
  weapon: { gamepad: ['LB'], touch: { label: 'Weapon', slot: 'top' } },
  weapon1: { keys: ['Digit1'] },
  weapon2: { keys: ['Digit2'] },
  weapon3: { keys: ['Digit3'] },
  weapon4: { keys: ['Digit4'] },
  map: { keys: ['KeyM'], gamepad: ['Back'], touch: { label: 'Map', slot: 'top' } },
  pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'], touch: { label: 'II', slot: 'top' } },
  // Menus (keyboard uses Enter/Escape/Tab natively; touch taps the buttons).
  confirm: { gamepad: ['A'] },
  back: { gamepad: ['B'] },
  tabPrev: { gamepad: ['LB'] },
  tabNext: { gamepad: ['RB'] },
};

/** What to print on a keycap for each action, per input device. */
const HINTS = {
  keyboard: {
    move: 'WASD',
    aim: '↖',
    fire: 'LMB',
    boost: 'SPACE',
    missile: 'RMB',
    interact: 'E',
    target: 'TAB',
    scan: 'R',
    repair: 'Q',
    ecm: 'X',
    weapon: '1–4',
    map: 'M',
    pause: 'ESC',
  },
  gamepad: {
    move: 'L-STICK',
    aim: 'R-STICK',
    fire: 'RT',
    boost: 'A',
    missile: 'LT',
    interact: 'X',
    target: 'RB',
    scan: 'Y',
    repair: 'L3',
    ecm: 'R3',
    weapon: 'LB',
    map: 'VIEW',
    pause: 'MENU',
  },
  touch: {
    move: 'LEFT STICK',
    aim: 'RIGHT STICK',
    fire: 'RIGHT STICK',
    boost: 'BOOST',
    missile: 'MISSILE',
    interact: 'USE',
    target: 'TARGET',
    scan: 'SCAN',
    repair: 'REPAIR',
    ecm: 'ECM',
    weapon: 'WEAPON',
    map: 'MAP',
    pause: 'II',
  },
};

/** The field guide's controls page, per input device. */
export const CONTROL_ROWS = {
  keyboard: [
    ['WASD / arrows', 'Strafe across the gameplay plane'],
    ['Pointer + LMB', 'Aim independently and fire primary weapon'],
    ['1\u20134 / wheel', 'Select a fitted weapon mount'],
    ['RMB', 'Launch a homing Starbreaker missile'],
    ['Space / Shift', 'Boost while energy remains'],
    ['Tab', 'Cycle nearby targets'],
    ['R', 'Scan a locked ship or nearby anomaly'],
    ['E', 'Dock, mine, collect, scan, or board contextually'],
    ['Q', 'Deploy emergency repair drones when fitted'],
    ['X', 'Break missile locks with ECM or point defense'],
    ['M', 'Open the galaxy map'],
    ['Esc', 'Pause or close the current overlay'],
  ],
  gamepad: [
    ['L-stick / D-pad', 'Strafe across the gameplay plane'],
    ['R-stick + RT', 'Aim independently and fire primary weapon'],
    ['LB', 'Select the next fitted weapon mount'],
    ['LT / B', 'Launch a homing Starbreaker missile'],
    ['A', 'Boost while energy remains'],
    ['RB', 'Cycle nearby targets'],
    ['Y', 'Scan a locked ship or nearby anomaly'],
    ['X', 'Dock, mine, collect, scan, or board contextually'],
    ['L3', 'Deploy emergency repair drones when fitted'],
    ['R3', 'Break missile locks with ECM or point defense'],
    ['View', 'Open the galaxy map'],
    ['Menu / B', 'Pause or close the current overlay'],
  ],
  touch: [
    ['Left stick', 'Strafe across the gameplay plane'],
    ['Right stick', 'Aim independently; push past halfway to fire'],
    ['Weapon', 'Select the next fitted weapon mount'],
    ['Missile', 'Launch a homing Starbreaker missile'],
    ['Boost', 'Boost while energy remains'],
    ['Target', 'Cycle nearby targets'],
    ['Scan', 'Scan a locked ship or nearby anomaly'],
    ['Use', 'Dock, mine, collect, scan, or board contextually'],
    ['Repair', 'Deploy emergency repair drones when fitted'],
    ['ECM', 'Break missile locks with ECM or point defense'],
    ['Map', 'Open the galaxy map'],
    ['II', 'Pause or close the current overlay'],
  ],
};

export function hint(source, action) {
  return (HINTS[source] ?? HINTS.keyboard)[action] ?? HINTS.keyboard[action] ?? action.toUpperCase();
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const visible = (el) => {
  if (el.closest('[hidden]')) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
};

/** Set a form control's value so React's onChange sees it. */
function setNativeValue(el, value) {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, String(value));
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
}

/**
 * Spatial focus navigation for the game's overlay screens. Driven once per
 * frame from the kit loop while a menu is up.
 */
export class MenuNavigator {
  constructor(input) {
    this.input = input;
    this.lastDir = null;
    this.repeatAt = 0;
    this.handlers = null;
    addEventListener('keydown', (e) => {
      if (!this.active) return;
      const root = this.root();
      if (!root) return;
      // The kit leaves keys alone while a form control has focus, so Escape on the
      // settings toggles, slider or quality picker would do nothing: close from here.
      if (e.code === 'Escape' && e.target?.matches?.('select, input:not([type=text]):not([type=search]):not([type=number])')) {
        e.preventDefault();
        this.handlers?.back();
        return;
      }
      // The kit keeps Tab for targeting, so walk the focus order here in menus.
      if (e.code !== 'Tab') return;
      e.preventDefault();
      const list = this.focusables(root);
      if (!list.length) return;
      const i = list.indexOf(document.activeElement);
      this.focus(list[(i + (e.shiftKey ? -1 : 1) + list.length) % list.length]);
    });
    addEventListener('pointerdown', () => document.querySelector('.pad-focus')?.classList.remove('pad-focus'), true);
  }

  root() {
    return document.querySelector('.overlay-screen');
  }

  focusables(root) {
    return [...root.querySelectorAll(FOCUSABLE)].filter(visible);
  }

  focus(el) {
    if (!el) return;
    document.querySelector('.pad-focus')?.classList.remove('pad-focus');
    try {
      el.focus({ focusVisible: true });
    } catch {
      el.focus();
    }
    el.classList.add('pad-focus');
    el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }

  /** Focus the first control of a screen that just opened. */
  focusFirst() {
    const root = this.root();
    if (!root) return;
    const list = this.focusables(root);
    if (list.length && !list.includes(document.activeElement)) {
      try {
        list[0].focus({ preventScroll: true });
      } catch {
        list[0].focus();
      }
    }
  }

  /**
   * @param {{ back: () => void, map: () => void }} handlers
   */
  update(handlers) {
    this.handlers = handlers;
    const root = this.root();
    if (!root) return;
    const input = this.input;
    const v = input.vector('move');
    const dir = Math.abs(v.x) > Math.abs(v.y) ? (v.x > 0.5 ? 'right' : v.x < -0.5 ? 'left' : null) : v.y > 0.5 ? 'up' : v.y < -0.5 ? 'down' : null;
    const now = performance.now();
    if (dir && (dir !== this.lastDir || now >= this.repeatAt)) {
      this.repeatAt = now + (dir !== this.lastDir ? 380 : 130);
      this.step(dir, root);
    }
    this.lastDir = dir;

    if (input.pressed('confirm')) {
      const el = document.activeElement;
      if (el && root.contains(el) && el !== document.body) el.click();
      else this.focus(this.focusables(root)[0]);
    }
    if (input.pressed('tabPrev')) this.cycleTabs(root, -1);
    if (input.pressed('tabNext')) this.cycleTabs(root, 1);
    if (input.pressed('back') || input.pressed('pause')) handlers.back();
    else if (input.pressed('map')) handlers.map();
  }

  step(dir, root) {
    const list = this.focusables(root);
    if (!list.length) return;
    const cur = document.activeElement;
    if (!list.includes(cur)) {
      this.focus(list[0]);
      return;
    }
    // Sliders and pickers take left/right as a value change.
    if ((dir === 'left' || dir === 'right') && cur.matches('input[type=range]')) {
      const stepSize = Number(cur.step) || 1;
      const next = Math.min(Number(cur.max), Math.max(Number(cur.min), Number(cur.value) + (dir === 'right' ? stepSize : -stepSize)));
      setNativeValue(cur, Math.round(next * 1000) / 1000);
      return;
    }
    if ((dir === 'left' || dir === 'right') && cur instanceof HTMLSelectElement) {
      const i = Math.min(cur.options.length - 1, Math.max(0, cur.selectedIndex + (dir === 'right' ? 1 : -1)));
      setNativeValue(cur, cur.options[i].value);
      return;
    }
    const a = cur.getBoundingClientRect();
    const ax = a.left + a.width / 2;
    const ay = a.top + a.height / 2;
    let best = null;
    let bestScore = Infinity;
    for (const el of list) {
      if (el === cur) continue;
      const b = el.getBoundingClientRect();
      const bx = b.left + b.width / 2;
      const by = b.top + b.height / 2;
      let main;
      let cross;
      if (dir === 'down') {
        main = b.top - a.bottom;
        cross = Math.max(0, Math.max(a.left, b.left) - Math.min(a.right, b.right)) + Math.abs(bx - ax) * 0.25;
        if (by <= ay + 1) continue;
      } else if (dir === 'up') {
        main = a.top - b.bottom;
        cross = Math.max(0, Math.max(a.left, b.left) - Math.min(a.right, b.right)) + Math.abs(bx - ax) * 0.25;
        if (by >= ay - 1) continue;
      } else if (dir === 'right') {
        main = b.left - a.right;
        cross = Math.max(0, Math.max(a.top, b.top) - Math.min(a.bottom, b.bottom)) + Math.abs(by - ay) * 0.25;
        if (bx <= ax + 1) continue;
      } else {
        main = a.left - b.right;
        cross = Math.max(0, Math.max(a.top, b.top) - Math.min(a.bottom, b.bottom)) + Math.abs(by - ay) * 0.25;
        if (bx >= ax - 1) continue;
      }
      const score = Math.max(-40, main) + cross * 3;
      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    }
    if (!best && (dir === 'down' || dir === 'up')) {
      // Wrap around the list at either end.
      best = dir === 'down' ? list[0] : list[list.length - 1];
    }
    this.focus(best);
  }

  /** LB/RB step through a screen's tab bar (station services, guide pages). */
  cycleTabs(root, delta) {
    const nav = root.querySelector('.dock-nav, .guide-nav');
    if (!nav) return;
    const tabs = [...nav.querySelectorAll('button:not([disabled])')].filter((b) => b.hasAttribute('aria-selected') || b.hasAttribute('aria-pressed'));
    if (!tabs.length) return;
    let i = tabs.findIndex((b) => b.classList.contains('is-active'));
    if (i < 0) i = 0;
    const next = tabs[(i + delta + tabs.length) % tabs.length];
    next.click();
    this.focus(next);
  }
}
