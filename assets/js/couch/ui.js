/**
 * couch/ui.js — the pieces every Couch screen is built from: a game as a
 * tile, keycaps, the button prompts that follow whichever input you hold,
 * and a glide for scroll containers.
 */

import { h, icon, ICONS } from '../dom.js';
import { cabinetPalette, paletteVars } from '../color.js';
import { store } from '../store.js';

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** How long a row takes to glide to a new tile, and the rows to a new row. */
const SLIDE_MS = 320;

/** The View and Menu buttons, drawn the way controllers print them. */
export const PAD_GLYPHS = {
  view: 'M8 8h10v8H8zM6 6h10v2M6 6v8h2',
  menu: 'M7 8.5h10M7 12h10M7 15.5h10',
};

const star = () => icon(ICONS.star, { class: 'tile__fave', fill: 'currentColor' });

/**
 * A game as a 16:9 tile: its cover, its name on a shade at the foot, a star
 * when it is a favourite. Its own colours ride along for the focus glow.
 */
export function tile(game, { href }) {
  return h(
    'a',
    { class: 'tile', href, tabindex: '-1', dataset: { slug: game.slug }, style: paletteVars(cabinetPalette(game)) },
    h('img', { class: 'tile__art', src: game.cover, alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' }),
    h('span', { class: 'tile__name' }, game.name),
    // Only ever seen with dev settings showing everything, as on the wall.
    game.restricted === true && h('span', { class: 'tile__flag' }, 'Hidden'),
    store.isFave(game.slug) && star()
  );
}

/** Stars on the tiles already drawn, after a favourite changes. */
export function syncStars(root = document) {
  for (const el of root.querySelectorAll('.tile')) {
    const shown = el.querySelector('.tile__fave');
    const on = store.isFave(el.dataset.slug);
    if (on && !shown) el.append(star());
    else if (!on && shown) shown.remove();
  }
}

/** One input, drawn as a keycap; a mouse, touch or pad input as a rounder chip. */
export const keycap = (part) => h('kbd', { class: part.pointer ? 'cap cap--pointer' : 'cap' }, part.key);

/** Keycap parts and the words between them, as a run of inline nodes. */
export const keyRun = (parts) =>
  parts.map((part) => (part.key ? keycap(part) : h('span', { class: 'cap-join' }, part.text)));

/** The key, and the pad's button: a face button by its letter, Menu by its glyph. */
const PROMPTS = {
  play: ['Enter', 'A'],
  info: ['I', 'Y'],
  fave: ['F', 'X'],
  back: ['Esc', 'B'],
  surprise: ['R', PAD_GLYPHS.menu],
};

/**
 * What to press for an action, on the keyboard and on a pad. Both are drawn;
 * the body's data-prompts says which shows, so switching from keyboard to
 * controller never re-renders a thing.
 */
export function prompt(action) {
  const [key, button] = PROMPTS[action];
  return h(
    'span',
    { class: 'prompt', 'aria-hidden': 'true' },
    h('kbd', { class: 'prompt__key' }, key),
    button.length === 1 ? h('span', { class: 'prompt__pad' }, button) : icon(button, { class: 'prompt__pad' })
  );
}

const ease = (t) => 1 - (1 - t) ** 3;
const glides = new WeakMap();

/**
 * Scroll a container to a spot over `ms`, easing out like something with
 * weight. Native smooth scrolling cannot be timed; this can, and a new glide
 * picks up from wherever the last one had got to. A wheel or touch on the
 * container stops it, so a person's own scrolling always wins.
 */
export function glide(el, to, ms = SLIDE_MS) {
  glides.get(el)?.();
  const max = { left: el.scrollWidth - el.clientWidth, top: el.scrollHeight - el.clientHeight };
  const from = { left: el.scrollLeft, top: el.scrollTop };
  const target = {
    left: Math.max(0, Math.min(max.left, to.left ?? from.left)),
    top: Math.max(0, Math.min(max.top, to.top ?? from.top)),
  };
  if (ms <= 0 || reducedMotion() || (Math.abs(target.left - from.left) < 1 && Math.abs(target.top - from.top) < 1)) {
    el.scrollLeft = target.left;
    el.scrollTop = target.top;
    return;
  }
  const start = performance.now();
  let raf = 0;
  const stop = () => {
    cancelAnimationFrame(raf);
    glides.delete(el);
    el.removeEventListener('wheel', stop);
    el.removeEventListener('touchstart', stop);
  };
  const step = (now) => {
    const t = Math.min(1, (now - start) / ms);
    el.scrollLeft = from.left + (target.left - from.left) * ease(t);
    el.scrollTop = from.top + (target.top - from.top) * ease(t);
    if (t < 1) raf = requestAnimationFrame(step);
    else stop();
  };
  raf = requestAnimationFrame(step);
  glides.set(el, stop);
  el.addEventListener('wheel', stop, { passive: true });
  el.addEventListener('touchstart', stop, { passive: true });
}

/** A small message at the foot of the screen, above a playing game too. */
export function createToast(root) {
  let timer = 0;
  const hide = () => {
    clearTimeout(timer);
    root.classList.remove('is-on');
  };
  return {
    /** Show this for `ms`, or until hidden when `ms` is 0. */
    show(content, { ms = 2600 } = {}) {
      clearTimeout(timer);
      root.replaceChildren(h('div', { class: 'toast__card' }, content));
      root.classList.add('is-on');
      if (ms > 0) timer = setTimeout(hide, ms);
    },
    hide,
  };
}
