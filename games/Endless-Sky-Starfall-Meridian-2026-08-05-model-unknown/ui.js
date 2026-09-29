// Starfall Meridian — DOM helpers: cached HUD writes, the toast queue, device-aware
// button prompts and spatial menu navigation for gamepad and keyboard.

export const $ = (id) => document.getElementById(id);

/** textContent, written only when it changes. */
export function setText(el, text) {
  if (!el) return;
  const v = String(text);
  if (el.__text !== v) {
    el.__text = v;
    el.textContent = v;
  }
}

/** One inline style property, written only when it changes. */
export function setStyle(el, prop, value) {
  if (!el) return;
  const key = `__s_${prop}`;
  if (el[key] !== value) {
    el[key] = value;
    if (prop.startsWith('--')) el.style.setProperty(prop, value);
    else el.style[prop] = value;
  }
}

export function setClass(el, cls, on) {
  if (el && el.classList.contains(cls) !== !!on) el.classList.toggle(cls, !!on);
}

export function setHidden(el, hidden) {
  if (el && el.hidden !== !!hidden) el.hidden = !!hidden;
}

/** innerHTML, written only when the markup changes. */
export function setHTML(el, html) {
  if (el && el.__html !== html) {
    el.__html = html;
    el.innerHTML = html;
  }
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

export const fmt = (n) => Math.max(0, Math.round(n)).toLocaleString('en-CA');

/** Button prompts for the device the player is using (kit.input.source). */
export const KEYS = {
  keyboard: {
    fire: 'LMB',
    boost: '⇧',
    jump: 'J',
    dock: 'F',
    brake: 'SPACE',
    map: 'M',
    pause: 'ESC',
    fly: 'WASD',
    strafe: 'Q/E',
    tabs: 'Q/E',
  },
  gamepad: {
    fire: 'RT',
    boost: 'A',
    jump: 'LB',
    dock: 'Y',
    brake: 'B',
    map: 'BACK',
    pause: 'START',
    fly: 'LS',
    strafe: 'RS',
    tabs: 'LB/RB',
  },
  touch: {
    fire: 'FIRE',
    boost: 'BOOST',
    jump: 'JUMP',
    dock: 'DOCK',
    brake: 'BRAKE',
    map: 'MAP',
    pause: 'II',
    fly: 'STICK',
    strafe: 'STICK',
    tabs: 'TAP',
  },
};

export const keysFor = (source) => KEYS[source] || KEYS.keyboard;

/** The pause menu's controls list, per device. */
export function controlsHelp(source) {
  if (source === 'gamepad') {
    return [
      ['LS', 'Fly'],
      ['RS', 'Aim / twin-stick'],
      ['RT / X', 'Fire'],
      ['A', 'Afterburn'],
      ['B / LT', 'Brake'],
      ['Y', 'Dock / launch'],
      ['LB', 'Jump (hold)'],
      ['BACK', 'Map'],
      ['R3', 'Camera zoom'],
      ['START', 'Pause'],
    ];
  }
  if (source === 'touch') {
    return [
      ['STICK', 'Fly'],
      ['FIRE', 'Fire'],
      ['BOOST', 'Afterburn'],
      ['BRAKE', 'Brake'],
      ['DOCK', 'Dock (near port)'],
      ['JUMP', 'Jump (hold)'],
      ['MAP', 'Map'],
      ['PINCH', 'Camera zoom'],
    ];
  }
  return [
    ['W/S', 'Thrust'],
    ['A/D', 'Turn'],
    ['Q/E', 'Strafe'],
    ['MOUSE', 'Aim'],
    ['LMB / K', 'Fire'],
    ['SHIFT', 'Boost'],
    ['SPACE', 'Brake'],
    ['F', 'Dock / launch'],
    ['J', 'Jump (hold)'],
    ['M', 'Map'],
    ['WHEEL', 'Camera zoom'],
    ['F9', 'Settings'],
  ];
}

/** The game's own toast, now a short queue so messages do not overwrite each other. */
export function createToast(el, textEl) {
  const queue = [];
  let timer = 0;
  let showing = false;
  const next = () => {
    const msg = queue.shift();
    if (msg == null) {
      showing = false;
      el.classList.remove('visible');
      return;
    }
    showing = true;
    textEl.textContent = msg;
    el.classList.add('visible');
    timer = queue.length ? 2.2 : 3.2;
  };
  return {
    show(msg) {
      if (queue[queue.length - 1] === msg || (showing && textEl.textContent === msg && !queue.length)) {
        if (showing && !queue.length) timer = 3.2;
        return;
      }
      queue.push(msg);
      if (queue.length > 3) queue.splice(0, queue.length - 3);
      if (!showing) next();
    },
    /** Driven by wall-clock dt so messages clear even while the world is frozen. */
    update(dt) {
      if (!showing) return;
      timer -= dt;
      if (timer <= 0) next();
    },
  };
}

const FOCUSABLE = 'button, a[href]';

/** Spatial focus movement over a menu's buttons, for the D-pad, sticks and arrow keys. */
export function createNav(input) {
  let held = null;
  let repeat = 0;
  let marked = null;

  const candidates = (root) =>
    [...root.querySelectorAll(FOCUSABLE)].filter((b) => !b.disabled && !b.closest('[hidden]') && b.getClientRects().length > 0);

  const mark = (el) => {
    if (marked && marked !== el) marked.classList.remove('nav-focus');
    marked = el;
    el?.classList.add('nav-focus');
  };
  document.addEventListener('focusout', (e) => {
    if (e.target === marked) {
      marked.classList.remove('nav-focus');
      marked = null;
    }
  });
  // A mouse or finger takes over: drop the controller highlight.
  document.addEventListener('pointerdown', () => mark(null), true);

  const focusEl = (el, withMark = true) => {
    if (!el) return;
    try {
      el.focus({ preventScroll: false });
    } catch {
      el.focus();
    }
    el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    if (withMark) mark(el);
  };

  const defaultOf = (root, list) => {
    const d = root.querySelector('[data-default]');
    if (d && list.includes(d)) return d;
    return list[0] || null;
  };

  const move = (root, dir) => {
    const list = candidates(root);
    if (!list.length) return;
    const cur = document.activeElement;
    if (!cur || !list.includes(cur)) {
      focusEl(defaultOf(root, list));
      return;
    }
    const r0 = cur.getBoundingClientRect();
    const cx = r0.left + r0.width / 2;
    const cy = r0.top + r0.height / 2;
    let best = null;
    let bestScore = Infinity;
    for (const el of list) {
      if (el === cur) continue;
      const r = el.getBoundingClientRect();
      const dx = r.left + r.width / 2 - cx;
      const dy = r.top + r.height / 2 - cy;
      let main;
      let cross;
      if (dir === 'right') [main, cross] = [dx, dy];
      else if (dir === 'left') [main, cross] = [-dx, dy];
      else if (dir === 'down') [main, cross] = [dy, dx];
      else [main, cross] = [-dy, dx];
      if (main <= 4) continue;
      const score = main + Math.abs(cross) * 2.2;
      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    }
    if (best) focusEl(best);
  };

  return {
    focusEl,
    /** Put focus on the menu's default button (used when a controller opens a menu). */
    focusDefault(root, withMark = true) {
      const list = candidates(root);
      focusEl(defaultOf(root, list), withMark);
    },
    reset() {
      held = null;
      repeat = 0;
    },
    /** Once per frame while a menu is open. */
    update(dt, root) {
      const v = input.vector('nav');
      let dir = null;
      if (Math.abs(v.x) > Math.abs(v.y)) dir = v.x > 0.5 ? 'right' : v.x < -0.5 ? 'left' : null;
      else dir = v.y > 0.5 ? 'up' : v.y < -0.5 ? 'down' : null;
      if (dir !== held) {
        held = dir;
        repeat = 0.38;
        if (dir) move(root, dir);
      } else if (dir) {
        repeat -= dt;
        if (repeat <= 0) {
          repeat = 0.14;
          move(root, dir);
        }
      }
      if (input.pressed('confirm')) {
        const a = document.activeElement;
        if (a && root.contains(a) && a.matches(FOCUSABLE)) a.click();
        else this.focusDefault(root);
      }
    },
  };
}
