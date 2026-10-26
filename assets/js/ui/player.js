/**
 * ui/player.js — the cabinet you are standing at.
 *
 * The game runs in a frame inside this page. Nothing is written into the game
 * document: the only contact is `addEventListener` on it, which is allowed
 * because the games are served from this same origin. That is what lets the
 * hub offer a way out without a single edit to a game file.
 *
 * The hub claims no keys while a game runs: every key belongs to the game.
 * The way out is the bar in the corner, three buttons: back to the wall, roll
 * another game, and ✕. A tap of ✕ folds the bar down to just the ✕ (a tap
 * brings it back); holding it takes the bar away entirely, until the hub is
 * reloaded, for a game that needs every pixel.
 */

import { h, clear, icon, ICONS } from '../dom.js';
import { cabinetPalette, paletteVars } from '../color.js';
import { store } from '../store.js';

const HOLD_MS = 700;
const IDLE_MS = 3500;
const RING = 2 * Math.PI * 10;

const FRAME_ALLOW = [
  'fullscreen',
  'autoplay',
  'gamepad',
  'pointer-lock',
  'accelerometer',
  'gyroscope',
  'magnetometer',
  'xr-spatial-tracking',
  'screen-wake-lock',
  'clipboard-write',
  'midi',
].join('; ');

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Options beyond the wall's: `src(build)` names the frame's address (a session
 * adds ?aihub=1), `onFrame(frame)` hands over each new frame before it loads,
 * `roll: false` drops the 🎲, and `honorStandalone: false` ignores this
 * device's plain-tab choices, which a session cannot play through.
 */
export function createPlayer(
  root,
  {
    onExit,
    onRoll,
    backLabel = 'Back to the wall',
    src = (build) => build.path,
    onFrame = null,
    roll = true,
    honorStandalone = true,
  }
) {
  let session = null;
  let pageTitle = document.title;
  /** The bar: 'open', 'folded' to just the ✕, or 'gone' until a reload. */
  let bar = 'open';

  /* --- the ✕: a tap folds the bar, a hold takes it away ------------------- */

  function setBar(next) {
    bar = next;
    root.classList.toggle('is-folded', bar === 'folded');
    root.classList.toggle('is-bare', bar === 'gone');
  }

  function cancelHold() {
    if (!session?.hold) return;
    cancelAnimationFrame(session.hold.raf);
    session.hold = null;
    session.arc?.setAttribute('stroke-dashoffset', RING);
  }

  function beginHold(event) {
    if (!session || session.hold) return;
    event.preventDefault();
    const started = performance.now();
    const step = (now) => {
      if (!session?.hold) return;
      const progress = Math.min(1, (now - started) / HOLD_MS);
      session.arc.setAttribute('stroke-dashoffset', String(RING * (1 - progress)));
      if (progress >= 1) {
        session.hold.done = true;
        setBar('gone');
        return;
      }
      session.hold.raf = requestAnimationFrame(step);
    };
    session.hold = { raf: requestAnimationFrame(step), done: false };
  }

  /** Let go: a short press was a tap, which folds or unfolds the bar. */
  function endHold() {
    if (!session?.hold) return;
    const held = session.hold.done;
    cancelHold();
    if (!held) setBar(bar === 'folded' ? 'open' : 'folded');
  }

  /* --- chrome that gets out of the way ---------------------------------- */

  function wake() {
    if (!session) return;
    root.classList.remove('is-idle');
    clearTimeout(session.idle);
    session.idle = setTimeout(() => root.classList.add('is-idle'), IDLE_MS);
  }

  /**
   * Listen on the game's own document. No node is added, moved or removed —
   * if this throws (a framebusting game, a sandboxed frame), the corner tab
   * and the browser Back button still work, so it fails quietly.
   */
  function listenInside(frame) {
    let doc;
    try {
      doc = frame.contentDocument;
      if (!doc) return;
    } catch {
      return;
    }
    const bind = (type, fn, opts) => {
      doc.addEventListener(type, fn, opts);
      session?.unbind.push(() => doc.removeEventListener(type, fn, opts));
    };
    bind('mousemove', onInnerMove, { passive: true });
    bind('touchstart', onInnerTouch, { passive: true });
  }

  function onInnerMove(event) {
    if (event.clientY < 90) wake();
  }

  // Without this a phone has no way to bring the exit tab back once it hides:
  // there is no mousemove on a touch screen, and no keyboard for the hotkeys.
  function onInnerTouch(event) {
    if ((event.touches?.[0]?.clientY ?? 999) < 90) wake();
  }

  /* --- opening ---------------------------------------------------------- */

  function standalonePanel(game, build) {
    // Either this one game was sent to a plain tab, or dev settings send them all.
    const everyGame = store.dev().alwaysStandalone && !store.prefersStandalone(game.slug);
    return h(
      'div',
      { class: 'player__bail' },
      h('h2', {}, `${game.name} opens on its own page`),
      h(
        'p',
        {},
        everyGame
          ? 'Dev settings are set to open every game in a plain tab, with nothing wrapped around it.'
          : 'You asked for this one to run outside the hub, so it gets a plain tab of its own with nothing wrapped around it.'
      ),
      h('a', { href: build.path, target: '_blank', rel: 'noopener' }, 'Open it now'),
      h(
        'button',
        {
          type: 'button',
          onclick: () => {
            if (everyGame) store.setDev({ alwaysStandalone: false });
            else store.setStandalone(game.slug, false);
            open(game, build);
          },
        },
        everyGame ? 'Play inside the hub again' : 'Try it inside the hub again'
      )
    );
  }

  function open(game, build, { fromTile = null } = {}) {
    close({ silent: true });

    const palette = cabinetPalette(game);
    root.hidden = false;
    document.body.classList.add('is-playing');
    Object.entries(paletteVars(palette)).forEach(([k, v]) => root.style.setProperty(k, v));
    clear(root);

    if (honorStandalone && (store.prefersStandalone(game.slug) || store.dev().alwaysStandalone)) {
      const { el: barEl, arc } = exitBar();
      root.append(barEl, standalonePanel(game, build));
      session = { game, build, arc, unbind: [], idle: 0, hold: null };
      return;
    }

    const frame = h('iframe', {
      class: 'player__frame',
      src: src(build),
      title: game.name,
      allow: FRAME_ALLOW,
      allowfullscreen: true,
      referrerpolicy: 'no-referrer',
    });

    const crt = h('div', { class: 'player__crt', 'aria-hidden': 'true' });
    const { el: barEl, arc } = exitBar();
    root.append(frame, crt, barEl);

    session = { game, build, frame, crt, arc, unbind: [], idle: 0, hold: null };
    onFrame?.(frame);

    frame.addEventListener('load', () => {
      crt.classList.add('is-off');
      listenInside(frame);
      frame.focus();
      try {
        frame.contentWindow?.focus();
      } catch {
        /* cross-origin after a redirect; the corner tab still works */
      }
    });

    pageTitle = document.title;
    document.title = `${game.name} — AI Hub`;
    store.recordPlay(game.slug);
    wake();

    if (fromTile && !reducedMotion()) zoomFrom(fromTile);
  }

  /** Back to where you came from, roll another game, and the ✕ with its hold ring. */
  function exitBar() {
    const arc = h('circle', {
      class: 'arc',
      cx: 12,
      cy: 12,
      r: 10,
      'stroke-dasharray': RING,
      'stroke-dashoffset': RING,
    });
    const tool = (cls, label, glyph, props = {}) =>
      h(
        'button',
        { type: 'button', class: `player__tool ${cls}`, 'aria-label': label, title: label, ...props },
        glyph
      );
    const el = h(
      'div',
      { class: 'player__exit' },
      tool('player__back', backLabel, icon(ICONS.back), { onclick: onExit }),
      roll && tool('player__roll', 'Roll: play another random game', icon(ICONS.dice), { onclick: () => onRoll() }),
      tool(
        'player__fold',
        'Tap to fold this bar away, hold to remove it until you reload',
        [h('svg', { class: 'player__ring', viewBox: '0 0 24 24', 'aria-hidden': 'true' }, arc), icon(ICONS.close)],
        {
          onpointerdown: beginHold,
          onpointerup: endHold,
          onpointerleave: cancelHold,
          onpointercancel: cancelHold,
          oncontextmenu: (event) => event.preventDefault(),
          onkeydown: (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setBar(bar === 'folded' ? 'open' : 'folded');
            }
          },
        }
      )
    );
    return { el, arc };
  }

  function zoomFrom(tile) {
    const rect = tile.getBoundingClientRect();
    root.animate(
      [
        {
          transform: `translate(${rect.left}px, ${rect.top}px) scale(${rect.width / innerWidth}, ${rect.height / innerHeight})`,
          opacity: 0.35,
        },
        { transform: 'none', opacity: 1 },
      ],
      { duration: 360, easing: 'cubic-bezier(.22,.61,.36,1)' }
    );
  }

  /* --- closing ---------------------------------------------------------- */

  function close({ silent = false, toTile = null } = {}) {
    if (!session) {
      root.hidden = true;
      return;
    }
    cancelHold();
    clearTimeout(session.idle);
    for (const off of session.unbind) {
      try {
        off();
      } catch {
        /* the frame may already be gone */
      }
    }

    // Released before any animation so the wall can be scrolled back into
    // place while the overlay is still shrinking over it.
    document.body.classList.remove('is-playing');

    // Removing the frame is what actually stops the game: its audio context,
    // timers and animation frames all die with it. It goes before the exit
    // animation, so a heavy game falls silent at once instead of fighting the
    // animation for the main thread.
    session.frame?.remove();

    const finish = () => {
      clear(root);
      root.hidden = true;
      root.classList.remove('is-idle');
      document.title = pageTitle;
      session = null;
    };

    if (silent || !toTile || reducedMotion()) return finish();

    const rect = toTile.getBoundingClientRect();
    const shrink = root.animate(
      [
        { transform: 'none', opacity: 1 },
        {
          transform: `translate(${rect.left}px, ${rect.top}px) scale(${rect.width / innerWidth}, ${rect.height / innerHeight})`,
          opacity: 0,
        },
      ],
      { duration: 300, easing: 'cubic-bezier(.55,.06,.68,.19)' }
    );
    shrink.finished.then(finish, finish);
  }

  addEventListener(
    'mousemove',
    (event) => {
      if (session && event.clientY < 90) wake();
    },
    { passive: true }
  );
  addEventListener(
    'touchstart',
    (event) => {
      if (session) onInnerTouch(event);
    },
    { passive: true }
  );

  return {
    open,
    close,
    isOpen: () => Boolean(session),
    current: () => session?.game || null,
    currentBuild: () => session?.build || null,
  };
}
