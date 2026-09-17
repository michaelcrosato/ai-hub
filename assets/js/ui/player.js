/**
 * ui/player.js — the cabinet you are standing at.
 *
 * The game runs in a frame inside this page. Nothing is written into the game
 * document: the only contact is `addEventListener` on it, which is allowed
 * because the games are served from this same origin. That is what lets the
 * hub offer a way out without a single edit to a game file.
 *
 * The listeners never call preventDefault. All four sample games bind Escape
 * themselves, so a tap must still reach the game's own pause menu — only a
 * sustained hold means "leave".
 */

import { h, clear, icon, ICONS } from '../dom.js';
import { cabinetPalette, paletteVars } from '../color.js';
import { store } from '../store.js';

const HOLD_MS = 700;
const IDLE_MS = 3500;
const RING = 2 * Math.PI * 28;

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

export function createPlayer(root, { onExit }) {
  let session = null;
  let pageTitle = document.title;

  /* --- leaving ---------------------------------------------------------- */

  function cancelHold() {
    if (!session?.hold) return;
    cancelAnimationFrame(session.hold.raf);
    session.hold = null;
    session.holdLayer.classList.remove('is-on');
    session.arc.setAttribute('stroke-dashoffset', RING);
  }

  function beginHold() {
    if (!session || session.hold) return;
    const started = performance.now();
    session.holdLayer.classList.add('is-on');
    const step = (now) => {
      if (!session?.hold) return;
      const progress = Math.min(1, (now - started) / HOLD_MS);
      session.arc.setAttribute('stroke-dashoffset', String(RING * (1 - progress)));
      if (progress >= 1) return onExit();
      session.hold.raf = requestAnimationFrame(step);
    };
    session.hold = { raf: requestAnimationFrame(step) };
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
    bind('keydown', onKeyDown);
    bind('keyup', onKeyUp);
    bind('mousemove', onInnerMove, { passive: true });
    bind('touchstart', onInnerTouch, { passive: true });
    bind('blur', cancelHold, true);
  }

  function onInnerMove(event) {
    if (event.clientY < 90) wake();
  }

  // Without this a phone has no way to bring the exit tab back once it hides:
  // there is no mousemove on a touch screen, and no keyboard for the hotkeys.
  function onInnerTouch(event) {
    if ((event.touches?.[0]?.clientY ?? 999) < 90) wake();
  }

  function onKeyDown(event) {
    if (event.key === 'Escape' && !event.repeat) beginHold();
    else if (event.code === 'Backquote' && !event.metaKey && !event.ctrlKey) onExit();
  }

  function onKeyUp(event) {
    if (event.key === 'Escape') cancelHold();
  }

  /* --- opening ---------------------------------------------------------- */

  function standalonePanel(game, build) {
    return h(
      'div',
      { class: 'player__bail' },
      h('h2', {}, `${game.name} opens on its own page`),
      h(
        'p',
        {},
        'You asked for this one to run outside the hub, so it gets a plain tab of its own with nothing wrapped around it.'
      ),
      h('a', { href: build.path, target: '_blank', rel: 'noopener' }, 'Open it now'),
      h(
        'button',
        {
          type: 'button',
          onclick: () => {
            store.setStandalone(game.slug, false);
            open(game, build);
          },
        },
        'Try it inside the hub again'
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

    if (store.prefersStandalone(game.slug)) {
      root.append(exitBar(game, build, { standalone: true }), standalonePanel(game, build));
      session = { game, build, unbind: [], idle: 0 };
      return;
    }

    const frame = h('iframe', {
      class: 'player__frame',
      src: build.path,
      title: game.name,
      allow: FRAME_ALLOW,
      allowfullscreen: true,
      referrerpolicy: 'no-referrer',
    });

    const crt = h('div', { class: 'player__crt', 'aria-hidden': 'true' });

    const arc = h('circle', {
      class: 'arc',
      cx: 32,
      cy: 32,
      r: 28,
      'stroke-dasharray': RING,
      'stroke-dashoffset': RING,
    });

    const holdLayer = h(
      'div',
      { class: 'player__hold', 'aria-hidden': 'true' },
      h(
        'svg',
        { viewBox: '0 0 64 64' },
        h('circle', { class: 'track', cx: 32, cy: 32, r: 28 }),
        arc
      ),
      h('p', {}, 'Keep holding to leave')
    );

    root.append(frame, crt, exitBar(game, build, {}), holdLayer);

    session = { game, build, frame, crt, arc, holdLayer, unbind: [], idle: 0, hold: null };

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

  function exitBar(game, build, { standalone = false }) {
    return h(
      'div',
      { class: 'player__exit' },
      h(
        'button',
        { type: 'button', class: 'player__leave', onclick: onExit },
        icon(ICONS.back),
        'Back to the wall'
      ),
      !standalone && h('kbd', {}, 'hold Esc'),
      !standalone &&
        h(
          'a',
          {
            class: 'player__pop',
            href: build.path,
            target: '_blank',
            rel: 'noopener',
            'aria-label': 'Open this game in a plain tab and remember that choice',
            title: 'Open in a plain tab, and remember that choice for this game',
            onclick: () => store.setStandalone(game.slug, true),
          },
          icon(ICONS.external)
        )
    );
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

    const finish = () => {
      clear(root);
      root.hidden = true;
      root.classList.remove('is-idle');
      document.title = pageTitle;
      session = null;
    };

    // Clearing the node is what actually stops the game: its audio context,
    // timers and animation frames all die with the frame.
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

  addEventListener('keydown', (event) => {
    if (!session) return;
    if (event.key === 'Escape' && !event.repeat) beginHold();
    else if (event.code === 'Backquote') onExit();
  });
  addEventListener('keyup', (event) => {
    if (session && event.key === 'Escape') cancelHold();
  });
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
  addEventListener('blur', cancelHold);

  return {
    open,
    close,
    isOpen: () => Boolean(session),
    current: () => session?.game || null,
    currentBuild: () => session?.build || null,
  };
}
