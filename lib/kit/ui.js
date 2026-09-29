/**
 * ui.js — the few screens every 3D game shares: the loading card, the
 * settings panel (gear button, F9, or the game's own pause menu calling
 * kit.menu.open()), and the optional FPS readout.
 *
 * Everything is plain DOM with one injected stylesheet, prefixed kit-, and
 * works with mouse, touch and a gamepad (D-pad/stick to move, A to change,
 * B or Start to close).
 */

import { TIER_NAMES } from './settings.js';

const CSS = `
.kit-loading{position:fixed;inset:0;z-index:2147483600;display:grid;place-items:center;background:var(--kit-bg,#07090d);color:#e8eef6;font:500 15px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;transition:opacity .35s ease}
.kit-loading.is-done{opacity:0;pointer-events:none}
.kit-loading__card{width:min(420px,86vw);text-align:center}
.kit-loading__title{margin:0 0 18px;font-size:clamp(20px,4.6vw,30px);font-weight:750;letter-spacing:.02em;text-wrap:balance}
.kit-loading__bar{height:4px;border-radius:4px;background:rgba(255,255,255,.12);overflow:hidden}
.kit-loading__bar i{display:block;height:100%;width:0;background:var(--kit-accent,#7cc4ff);border-radius:inherit;transition:width .25s ease}
.kit-loading__status{margin:12px 0 0;min-height:1.4em;opacity:.7;font-size:13px}
.kit-loading__error{margin-top:16px;display:none;gap:10px;justify-content:center;flex-wrap:wrap}
.kit-loading.is-error .kit-loading__error{display:flex}
.kit-loading.is-error .kit-loading__bar{display:none}
.kit-btn{appearance:none;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.08);color:inherit;font:inherit;font-weight:650;padding:9px 16px;border-radius:10px;cursor:pointer}
.kit-btn:hover,.kit-btn:focus-visible,.kit-btn.is-focus{background:rgba(255,255,255,.18);outline:2px solid var(--kit-accent,#7cc4ff);outline-offset:1px}
.kit-gear{position:fixed;z-index:2147483500;width:38px;height:38px;border-radius:50%;border:1px solid rgba(255,255,255,.18);background:rgba(10,14,20,.42);color:#fff;display:grid;place-items:center;cursor:pointer;opacity:.55;transition:opacity .2s;-webkit-tap-highlight-color:transparent;padding:0}
.kit-gear:hover,.kit-gear:focus-visible{opacity:1}
.kit-gear svg{width:20px;height:20px}
.kit-gear--tr{top:calc(10px + env(safe-area-inset-top));right:calc(10px + env(safe-area-inset-right))}
.kit-gear--tl{top:calc(10px + env(safe-area-inset-top));left:calc(10px + env(safe-area-inset-left))}
.kit-gear--br{bottom:calc(10px + env(safe-area-inset-bottom));right:calc(10px + env(safe-area-inset-right))}
.kit-gear--bl{bottom:calc(10px + env(safe-area-inset-bottom));left:calc(10px + env(safe-area-inset-left))}
.kit-menu{position:fixed;inset:0;z-index:2147483550;display:none;place-items:center;width:100%;height:100%;max-width:none;max-height:none;margin:0;padding:0;border:0;background:rgba(3,5,9,.62);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);color:#e8eef6;font:500 14px/1.35 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
.kit-menu.is-open{display:grid}
.kit-menu::backdrop{background:transparent}
.kit-menu__panel{width:min(460px,94vw);max-height:min(640px,92vh);overflow:auto;background:rgba(14,18,26,.96);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:16px 16px 12px;box-shadow:0 20px 60px rgba(0,0,0,.5)}
.kit-menu h2{margin:0 0 2px;font-size:18px}
.kit-menu h3{margin:14px 0 6px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;opacity:.55}
.kit-menu__info{font-size:12px;opacity:.6;margin:0 0 4px}
.kit-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 8px;border-radius:9px}
.kit-row.is-focus{background:rgba(255,255,255,.08);outline:2px solid var(--kit-accent,#7cc4ff)}
.kit-row__label{flex:1}
.kit-row__label small{display:block;opacity:.55;font-size:11px}
.kit-row__value{display:flex;align-items:center;gap:4px}
.kit-row__value button{appearance:none;border:0;background:rgba(255,255,255,.08);color:inherit;font:inherit;border-radius:7px;min-width:30px;height:30px;cursor:pointer}
.kit-row__value output{min-width:92px;text-align:center;font-weight:650}
.kit-menu__foot{display:flex;gap:8px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap}
.kit-menu__reload{display:none}
.kit-menu.needs-reload .kit-menu__reload{display:inline-block}
.kit-fps{position:fixed;z-index:2147483400;left:calc(8px + env(safe-area-inset-left));bottom:calc(8px + env(safe-area-inset-bottom));font:600 11px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;color:#d9f99d;background:rgba(0,0,0,.55);padding:4px 7px;border-radius:6px;pointer-events:none;white-space:pre}
.kit-toast{position:fixed;z-index:2147483600;left:50%;top:calc(14px + env(safe-area-inset-top));transform:translateX(-50%);background:rgba(14,18,26,.94);color:#e8eef6;font:600 13px/1.3 system-ui,sans-serif;padding:9px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.14);max-width:90vw}
.kit-touch{position:fixed;inset:0;z-index:2147483000;pointer-events:none;display:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;--s:var(--kit-touch-scale,1);--kt-fg:#fff;--kt-bg:rgba(255,255,255,.12);--kt-bg-strong:rgba(255,255,255,.18);--kt-line:rgba(255,255,255,.34);--kt-down:rgba(255,255,255,.42);--kt-knob:rgba(255,255,255,.55);--kt-ring:rgba(255,255,255,.28);--kt-pill:rgba(10,14,20,.45)}
.kit-touch[data-theme=light]{--kt-fg:#111820;--kt-bg:rgba(20,28,40,.10);--kt-bg-strong:rgba(20,28,40,.16);--kt-line:rgba(20,28,40,.42);--kt-down:rgba(20,28,40,.30);--kt-knob:rgba(20,28,40,.45);--kt-ring:rgba(20,28,40,.35);--kt-pill:rgba(255,255,255,.55)}
.kit-touch.is-visible{display:block}
.kit-touch.is-suspended{display:none}
.kit-touch__zone{position:absolute;z-index:1;bottom:0;top:22%;pointer-events:auto;touch-action:none}
.kit-touch__zone--left{left:0;width:46%}
.kit-touch__zone--right{right:0;width:40%}
.kit-touch__stick{position:absolute;left:calc(76px * var(--s) + env(safe-area-inset-left));top:auto;bottom:calc(20px * var(--s) + env(safe-area-inset-bottom));width:calc(116px * var(--s));height:calc(116px * var(--s));margin:calc(-58px * var(--s)) 0 0 calc(-58px * var(--s));border-radius:50%;border:2px solid var(--kt-ring);background:var(--kt-bg);opacity:.3;transition:opacity .15s}
.kit-touch.no-hint .kit-touch__stick:not(.is-active){opacity:0}
.kit-touch__zone--right .kit-touch__stick{left:auto;right:calc(20px * var(--s) + env(safe-area-inset-right))}
.kit-touch__stick.is-active{opacity:1;bottom:auto;right:auto}
.kit-touch__knob{position:absolute;left:50%;top:50%;width:calc(52px * var(--s));height:calc(52px * var(--s));margin:calc(-26px * var(--s)) 0 0 calc(-26px * var(--s));border-radius:50%;background:var(--kt-knob);box-shadow:0 2px 10px rgba(0,0,0,.35)}
.kit-touch__cluster{position:absolute;z-index:2;right:calc(18px + env(safe-area-inset-right));bottom:calc(18px + env(safe-area-inset-bottom));display:grid;grid-template-columns:repeat(2,auto);gap:calc(12px * var(--s));align-items:end;justify-items:center;pointer-events:none;direction:rtl}
.kit-touch__btn{pointer-events:auto;touch-action:none;direction:ltr;width:calc(62px * var(--s));height:calc(62px * var(--s));border-radius:50%;display:grid;place-items:center;text-align:center;font:750 calc(11px * var(--s))/1.05 system-ui,sans-serif;letter-spacing:.04em;text-transform:uppercase;color:var(--kt-fg);background:var(--kt-bg);border:2px solid var(--kt-line);box-shadow:0 2px 12px rgba(0,0,0,.25);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);padding:4px;overflow:hidden}
.kit-touch__btn.is-primary{width:calc(80px * var(--s));height:calc(80px * var(--s));font-size:calc(13px * var(--s));background:var(--kt-bg-strong)}
.kit-touch__btn.is-down,.kit-touch__pill.is-down{background:var(--kt-down);transform:scale(.94)}
.kit-touch__btn[hidden],.kit-touch__pill[hidden]{display:none}
.kit-touch.is-lefty .kit-touch__zone--left{left:auto;right:0}
.kit-touch.is-lefty .kit-touch__zone--right{right:auto;left:0}
.kit-touch.is-lefty .kit-touch__zone--left .kit-touch__stick{left:auto;right:calc(20px * var(--s) + env(safe-area-inset-right))}
.kit-touch.is-lefty .kit-touch__stick.is-active{right:auto}
.kit-touch.is-lefty .kit-touch__cluster{right:auto;left:calc(18px + env(safe-area-inset-left));direction:ltr}
.kit-touch__top{position:absolute;z-index:2;top:calc(var(--kit-top-y,10px) + env(safe-area-inset-top));left:50%;transform:translateX(-50%);display:flex;gap:8px;pointer-events:none}
.kit-touch__top[data-align=left]{left:calc(10px + env(safe-area-inset-left));transform:none}
.kit-touch__top[data-align=right]{left:auto;right:calc(10px + env(safe-area-inset-right));transform:none}
.kit-touch__pill{pointer-events:auto;touch-action:none;padding:8px 14px;border-radius:999px;font:700 12px/1 system-ui,sans-serif;letter-spacing:.05em;text-transform:uppercase;color:var(--kt-fg);background:var(--kt-pill);border:1px solid var(--kt-line)}
@media (prefers-reduced-motion:reduce){.kit-loading,.kit-loading__bar i{transition:none}}
`;

export function ensureStyle() {
  if (typeof document === 'undefined' || document.getElementById('kit-style')) return;
  const style = document.createElement('style');
  style.id = 'kit-style';
  style.textContent = CSS;
  // First in <head>, so a game's own rules win over the kit's at equal specificity.
  document.head.prepend(style);
}

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

/* ---------------------------------------------------------------- loading */

export function createLoading({ title = document.title, accent, background } = {}) {
  ensureStyle();
  const root = el('div', 'kit-loading');
  root.setAttribute('role', 'status');
  if (accent) root.style.setProperty('--kit-accent', accent);
  if (background) root.style.setProperty('--kit-bg', background);
  const card = el('div', 'kit-loading__card');
  const h = el('h1', 'kit-loading__title', title.split(/\s+[—–|:-]\s+/)[0]);
  const bar = el('div', 'kit-loading__bar');
  const fill = el('i');
  bar.append(fill);
  const status = el('p', 'kit-loading__status', 'Starting…');
  const actions = el('div', 'kit-loading__error');
  card.append(h, bar, status, actions);
  root.append(card);
  document.body.append(root);
  let finished = false;

  return {
    element: root,
    progress(fraction, text) {
      if (finished) return;
      if (Number.isFinite(fraction)) fill.style.width = `${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%`;
      if (text) status.textContent = text;
    },
    done() {
      if (finished) return;
      finished = true;
      fill.style.width = '100%';
      root.classList.add('is-done');
      setTimeout(() => root.remove(), 400);
    },
    error(message, buttons = []) {
      root.classList.remove('is-done');
      root.classList.add('is-error');
      status.textContent = message;
      actions.textContent = '';
      for (const { label, onClick } of buttons) {
        const b = el('button', 'kit-btn', label);
        b.type = 'button';
        b.addEventListener('click', onClick);
        actions.append(b);
      }
      actions.querySelector('button')?.focus();
    },
    get finished() {
      return finished;
    },
  };
}

/* ---------------------------------------------------------------- toast */

export function toast(text, ms = 2600) {
  ensureStyle();
  const t = el('div', 'kit-toast', text);
  document.body.append(t);
  setTimeout(() => t.remove(), ms);
}

/* ---------------------------------------------------------------- fps */

export function createFpsMeter() {
  ensureStyle();
  const node = el('div', 'kit-fps');
  node.hidden = true;
  document.body.append(node);
  return {
    set(text) {
      node.textContent = text;
    },
    show(on) {
      node.hidden = !on;
    },
  };
}

/* ---------------------------------------------------------------- menu */

const GEAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';

const pct = (v) => `${Math.round(v * 100)}%`;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Rows: [key, label, hint, options, format, needsReload]
 * options is the list the value cycles through.
 */
function rows() {
  return [
    ['h', 'Graphics'],
    ['quality', 'Quality', 'Auto picks for this device', ['auto', ...TIER_NAMES], (v, ctx) => (v === 'auto' ? `Auto (${cap(ctx.tier)})` : cap(v)), false],
    ['resolution', 'Resolution', 'Auto lowers it to hold the frame rate', ['auto', 1, 0.85, 0.75, 0.6, 0.5], (v) => (v === 'auto' ? 'Auto' : pct(v)), false],
    ['fpsCap', 'Frame rate', 'Cap it to save battery', [0, 60, 30], (v) => (v ? `${v} fps` : 'Display'), false],
    ['backend', 'Renderer', 'WebGPU, falling back to WebGL2', ['auto', 'webgpu', 'webgl2'], (v, ctx) => (v === 'auto' ? `Auto (${ctx.backendLabel})` : v === 'webgpu' ? 'WebGPU' : 'WebGL2'), true],
    ['advanced', 'Advanced WebGPU', 'All device features and heavier effects', [false, true], (v) => (v ? 'On' : 'Off'), true],
    ['showFps', 'Show FPS', null, [false, true], (v) => (v ? 'On' : 'Off'), false],
    ['h', 'Controls'],
    ['touch', 'Touch controls', null, ['auto', 'on', 'off'], (v) => cap(v), false],
    ['touchScale', 'Touch size', null, [0.8, 0.9, 1, 1.15, 1.3], pct, false],
    ['touchHand', 'Touch layout', 'Which thumb gets the stick', ['right', 'left'], (v) => (v === 'left' ? 'Stick right' : 'Stick left'), false],
    ['lookSensitivity', 'Look speed', null, [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3], (v) => `${v}×`, false],
    ['invertY', 'Invert look Y', null, [false, true], (v) => (v ? 'On' : 'Off'), false],
    ['vibration', 'Vibration', null, [false, true], (v) => (v ? 'On' : 'Off'), false],
  ];
}

/**
 * @param {object} opts
 * @param {object} opts.settings    the settings store
 * @param {() => object} opts.context  { tier, backendLabel, info } for labels
 * @param {'tr'|'tl'|'br'|'bl'|'none'} [opts.gear]
 * @param {(open: boolean) => void} [opts.onToggle]
 */
export function createMenu({ settings, context, gear = 'tr', onToggle, title = 'Settings' }) {
  ensureStyle();
  // A <dialog> shown modally sits in the top layer, above a game's own modal dialogs.
  const root = el('dialog', 'kit-menu');
  root.setAttribute('aria-label', title);
  root.addEventListener('cancel', (e) => {
    e.preventDefault();
    api.close();
  });
  const panel = el('div', 'kit-menu__panel');
  root.append(panel);
  document.body.append(root);

  let gearBtn = null;
  if (gear !== 'none') {
    gearBtn = el('button', `kit-gear kit-gear--${gear}`);
    gearBtn.type = 'button';
    gearBtn.setAttribute('aria-label', 'Settings');
    gearBtn.innerHTML = GEAR;
    gearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      api.toggle();
    });
    gearBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
    document.body.append(gearBtn);
  }

  const startValues = { ...settings.get() };
  let focusables = [];
  let focus = 0;
  let open = false;

  const render = () => {
    const s = settings.get();
    const ctx = context();
    panel.textContent = '';
    panel.append(el('h2', null, title));
    panel.append(el('p', 'kit-menu__info', ctx.info || ''));
    focusables = [];
    for (const r of rows()) {
      if (r[0] === 'h') {
        panel.append(el('h3', null, r[1]));
        continue;
      }
      const [key, label, hint, options, format] = r;
      const row = el('div', 'kit-row');
      const lab = el('div', 'kit-row__label', label);
      if (hint) lab.append(el('small', null, hint));
      const value = el('div', 'kit-row__value');
      const prev = el('button', null, '‹');
      const out = el('output', null, format(s[key], ctx));
      const next = el('button', null, '›');
      prev.type = next.type = 'button';
      prev.setAttribute('aria-label', `Previous ${label}`);
      next.setAttribute('aria-label', `Next ${label}`);
      const step = (dir) => {
        const cur = settings.get()[key];
        let i = options.findIndex((o) => o === cur);
        if (i < 0) i = 0;
        const n = options[(i + dir + options.length) % options.length];
        settings.set({ [key]: n });
      };
      prev.addEventListener('click', () => step(-1));
      next.addEventListener('click', () => step(1));
      out.addEventListener('click', () => step(1));
      value.append(prev, out, next);
      row.append(lab, value);
      row.step = step;
      panel.append(row);
      focusables.push(row);
    }
    const foot = el('div', 'kit-menu__foot');
    const reload = el('button', 'kit-btn kit-menu__reload', 'Reload to apply');
    reload.type = 'button';
    reload.addEventListener('click', () => location.reload());
    const reset = el('button', 'kit-btn', 'Defaults');
    reset.type = 'button';
    reset.addEventListener('click', () => settings.reset());
    const close = el('button', 'kit-btn', 'Close');
    close.type = 'button';
    close.addEventListener('click', () => api.close());
    foot.append(reload, reset, close);
    panel.append(foot);
    focusables.push(reload, reset, close);
    const needsReload = !!ctx.needsReload || rows().some((r) => r[5] && settings.get()[r[0]] !== startValues[r[0]]);
    root.classList.toggle('needs-reload', needsReload);
    paintFocus();
  };

  const visibleFocusables = () => focusables.filter((f) => f.offsetParent !== null);
  const paintFocus = () => {
    const list = visibleFocusables();
    focusables.forEach((f) => f.classList.remove('is-focus'));
    if (!list.length) return;
    focus = Math.max(0, Math.min(list.length - 1, focus));
    list[focus].classList.add('is-focus');
    list[focus].scrollIntoView?.({ block: 'nearest' });
  };

  settings.subscribe(() => open && render());

  root.addEventListener('pointerdown', (e) => {
    if (e.target === root) api.close();
  });

  const onKey = (e) => {
    if (e.code === 'F9') {
      e.preventDefault();
      api.toggle();
      return;
    }
    if (!open) return;
    e.stopPropagation();
    if (e.code === 'Escape') {
      e.preventDefault();
      api.close();
    } else if (e.code === 'ArrowDown' || e.code === 'ArrowUp') {
      e.preventDefault();
      focus += e.code === 'ArrowDown' ? 1 : -1;
      paintFocus();
    } else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
      e.preventDefault();
      visibleFocusables()[focus]?.step?.(e.code === 'ArrowRight' ? 1 : -1);
    } else if (e.code === 'Enter' || e.code === 'Space') {
      const f = visibleFocusables()[focus];
      if (f?.step) {
        e.preventDefault();
        f.step(1);
      }
    }
  };
  window.addEventListener('keydown', onKey, true);

  // Gamepad navigation while open (the game loop is paused, so poll here).
  let padPrev = {};
  let padRepeat = 0;
  const pollPad = () => {
    if (!open) return;
    const pad = [...(navigator.getGamepads?.() || [])].find(Boolean);
    if (pad) {
      const b = (i) => !!pad.buttons[i]?.pressed;
      const ay = pad.axes[1] || 0;
      const ax = pad.axes[0] || 0;
      const now = {
        up: b(12) || ay < -0.6,
        down: b(13) || ay > 0.6,
        left: b(14) || ax < -0.6,
        right: b(15) || ax > 0.6,
        a: b(0),
        back: b(1) || b(9),
      };
      const edge = (k) => now[k] && !padPrev[k];
      const t = performance.now();
      const held = (k) => now[k] && t > padRepeat;
      if (edge('back')) {
        padPrev = now;
        api.close();
        return;
      }
      const list = visibleFocusables();
      if (edge('up') || edge('down') || ((now.up || now.down) && held(now.up ? 'up' : 'down'))) {
        focus += now.down ? 1 : -1;
        paintFocus();
        padRepeat = t + (edge('up') || edge('down') ? 380 : 140);
      }
      if (edge('left') || edge('right')) list[focus]?.step?.(now.right ? 1 : -1);
      if (edge('a')) {
        const f = list[focus];
        if (f?.step) f.step(1);
        else f?.click?.();
      }
      padPrev = now;
    }
    requestAnimationFrame(pollPad);
  };

  const api = {
    get isOpen() {
      return open;
    },
    open() {
      if (open) return;
      open = true;
      focus = 0;
      render();
      try {
        root.showModal();
      } catch {
        root.setAttribute('open', '');
      }
      root.classList.add('is-open');
      padPrev = { a: true, back: true };
      requestAnimationFrame(pollPad);
      onToggle?.(true);
    },
    close() {
      if (!open) return;
      open = false;
      root.classList.remove('is-open');
      if (root.open) root.close?.();
      root.removeAttribute('open');
      onToggle?.(false);
    },
    toggle() {
      open ? api.close() : api.open();
    },
    /** Move or hide the gear: 'tr' | 'tl' | 'br' | 'bl' | 'none'. */
    setGear(corner) {
      if (!gearBtn) return;
      gearBtn.hidden = corner === 'none';
      if (corner !== 'none') gearBtn.className = `kit-gear kit-gear--${corner}`;
    },
    element: root,
  };
  return api;
}
