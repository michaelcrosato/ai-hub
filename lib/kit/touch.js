/**
 * touch.js — on-screen controls built from a game's input actions.
 *
 *   touch: 'stick'        floating joystick on the left half (vector actions)
 *   touch: 'stick-right'  a second floating joystick on the right half (twin-stick aim)
 *   touch: 'drag'         look actions: drag anywhere free on the screen (handled by input.js)
 *   touch: 'Jump'         a round button in the bottom-right cluster; first one is the big one
 *   touch: { label: 'Map', slot: 'top' }   a small pill along the top edge
 *   touch: { pos: 'Gas', neg: 'Brake' }    axis actions: two buttons driving -1..1
 *
 * The joystick appears where the thumb lands, so it works for any hand size
 * and grip. Controls show on touch devices and hide as soon as a keyboard or
 * gamepad is used (setting 'auto'), or can be forced on or off.
 */

import { ensureStyle } from './ui.js';

const STICK_RADIUS = 58;

export function createTouchControls({ input, settings, root = document.body, top: topAlign = 'center', topOffset = 10 }) {
  ensureStyle();
  const layer = document.createElement('div');
  layer.className = 'kit-touch';
  layer.setAttribute('aria-hidden', 'true');
  root.append(layer);

  const cluster = document.createElement('div');
  cluster.className = 'kit-touch__cluster';
  const top = document.createElement('div');
  top.className = 'kit-touch__top';
  layer.append(cluster, top);
  const placeTop = (align, offset) => {
    top.dataset.align = align;
    top.style.setProperty('--kit-top-y', `${offset}px`);
  };
  placeTop(topAlign, topOffset);
  const suspended = new Set();

  const buttons = new Map();
  const cleanups = [];
  const haptic = () => {
    if (settings.get().vibration && navigator.vibrate) navigator.vibrate(8);
  };

  const hold = (el, onDown, onUp) => {
    const active = new Set();
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* synthetic */
      }
      active.add(e.pointerId);
      el.classList.add('is-down');
      haptic();
      onDown(e);
    });
    const end = (e) => {
      if (!active.delete(e.pointerId)) return;
      if (!active.size) {
        el.classList.remove('is-down');
        onUp(e);
      }
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('lostpointercapture', end);
  };

  const makeButton = (name, label, slot, onDown, onUp) => {
    const b = document.createElement('div');
    b.className = slot === 'top' ? 'kit-touch__pill' : 'kit-touch__btn';
    b.textContent = label;
    b.dataset.action = name;
    hold(b, onDown, onUp);
    (slot === 'top' ? top : cluster).append(b);
    return b;
  };

  const sticks = [];
  const makeStick = (name, side) => {
    const zone = document.createElement('div');
    zone.className = `kit-touch__zone kit-touch__zone--${side}`;
    const base = document.createElement('div');
    base.className = 'kit-touch__stick';
    const knob = document.createElement('div');
    knob.className = 'kit-touch__knob';
    base.append(knob);
    zone.append(base);
    layer.append(zone);

    let id = null;
    let cx = 0;
    let cy = 0;
    const set = (x, y) => {
      input.touch.vectors[name] = { x, y };
    };
    const rest = () => {
      base.classList.remove('is-active');
      base.style.left = '';
      base.style.top = '';
      knob.style.transform = '';
      set(0, 0);
    };
    zone.addEventListener('pointerdown', (e) => {
      if (id !== null) return;
      e.preventDefault();
      id = e.pointerId;
      try {
        zone.setPointerCapture(id);
      } catch {
        /* synthetic */
      }
      const r = zone.getBoundingClientRect();
      const scale = settings.get().touchScale || 1;
      const m = STICK_RADIUS * scale + 12;
      cx = Math.min(r.right - m, Math.max(r.left + m, e.clientX));
      cy = Math.min(r.bottom - m, Math.max(r.top + m, e.clientY));
      base.style.left = `${cx - r.left}px`;
      base.style.top = `${cy - r.top}px`;
      base.classList.add('is-active');
      move(e);
    });
    const move = (e) => {
      if (e.pointerId !== id) return;
      const R = STICK_RADIUS * (settings.get().touchScale || 1);
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
      const len = Math.hypot(dx, dy);
      if (len > R) {
        dx = (dx / len) * R;
        dy = (dy / len) * R;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      // A small dead band so a resting thumb does not creep.
      const n = Math.hypot(dx, dy) / R;
      const k = n < 0.12 ? 0 : (n - 0.12) / 0.88 / (n || 1);
      set((dx / R) * k, (-dy / R) * k);
    };
    zone.addEventListener('pointermove', move);
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      rest();
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
    sticks.push({ name, zone, rest });
  };

  const build = () => {
    cluster.textContent = '';
    top.textContent = '';
    layer.querySelectorAll('.kit-touch__zone').forEach((z) => z.remove());
    buttons.clear();
    sticks.length = 0;
    let primary = true;
    for (const a of input.actions.values()) {
      const t = a.touch;
      if (!t) continue;
      if (t === 'stick' || t === 'stick-right') {
        if (a.type === 'vector') makeStick(a.name, t === 'stick' ? 'left' : 'right');
        continue;
      }
      if (t === 'drag') continue;
      if (a.type === 'axis' && typeof t === 'object' && (t.pos || t.neg)) {
        const drive = { pos: false, neg: false };
        const sync = () => {
          input.touch.vectors[a.name] = { x: (drive.pos ? 1 : 0) - (drive.neg ? 1 : 0), y: 0 };
        };
        if (t.pos) buttons.set(`${a.name}+`, makeButton(a.name, t.pos, t.slot, () => ((drive.pos = true), sync()), () => ((drive.pos = false), sync())));
        if (t.neg) buttons.set(`${a.name}-`, makeButton(a.name, t.neg, t.slot, () => ((drive.neg = true), sync()), () => ((drive.neg = false), sync())));
        continue;
      }
      const label = typeof t === 'string' ? t : t.label || a.name;
      const slot = typeof t === 'object' ? t.slot || 'main' : 'main';
      const b = makeButton(
        a.name,
        label,
        slot,
        () => input.touch.buttons.add(a.name),
        () => input.touch.buttons.delete(a.name)
      );
      if (slot !== 'top' && primary) {
        b.classList.add('is-primary');
        primary = false;
      }
      buttons.set(a.name, b);
    }
    cluster.dataset.count = String(cluster.children.length);
  };

  let visible = false;
  const apply = () => {
    layer.classList.toggle('is-visible', visible);
    layer.style.setProperty('--kit-touch-scale', String(settings.get().touchScale || 1));
    if (!visible) {
      input.touch.buttons.clear();
      for (const s of sticks) s.rest();
    }
  };
  const decide = () => {
    const mode = settings.get().touch;
    if (mode === 'on') visible = true;
    else if (mode === 'off') visible = false;
    else visible = input.source === 'touch';
    apply();
  };

  build();
  // A touch-only device shows its controls before the first tap.
  const touchOnly = matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
  if (touchOnly && input.source !== 'gamepad') input.source = 'touch';
  decide();
  cleanups.push(input.onSourceChange(decide), settings.subscribe(decide));

  return {
    element: layer,
    get visible() {
      return visible;
    },
    /** Rebuild after input.define() adds or changes actions. */
    rebuild() {
      build();
      decide();
    },
    /** Change a button's label, e.g. 'Enter' near a car and 'Exit' inside it. */
    setLabel(name, label) {
      const b = buttons.get(name);
      if (b) b.textContent = label;
    },
    /** Show or hide one control, e.g. an action that only exists in some situations. */
    setShown(name, shown) {
      const b = buttons.get(name);
      if (b) b.hidden = !shown;
      for (const s of sticks) if (s.name === name) s.zone.hidden = !shown;
    },
    /**
     * Hide every control for a cutscene or a menu, and bring them back. Each
     * reason is tracked on its own, so the kit's settings panel closing does
     * not bring back controls the game hid for its own menu.
     */
    suspend(on, reason = 'game') {
      if (on) suspended.add(reason);
      else suspended.delete(reason);
      layer.classList.toggle('is-suspended', suspended.size > 0);
      if (suspended.size) {
        input.touch.buttons.clear();
        for (const s of sticks) s.rest();
      }
    },
    /** Move the top row of pills: align 'left' | 'center' | 'right', offset in px from the top edge. */
    placeTop(align = 'center', offset = 10) {
      placeTop(align, offset);
    },
    dispose() {
      cleanups.forEach((f) => f());
      layer.remove();
    },
  };
}
