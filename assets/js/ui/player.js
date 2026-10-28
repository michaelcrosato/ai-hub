/**
 * ui/player.js — the cabinet you are standing at.
 *
 * The game runs in a frame inside this page. Nothing is written into the game
 * document: the only contact is `addEventListener` on it, which is allowed
 * because the games are served from this same origin. That is what lets the
 * hub offer a way out without a single edit to a game file.
 *
 * The hub claims no keys while a game runs: every key belongs to the game.
 * The way out is the bar in the corner: ✕ at the far left, 🎲 next to it, ←
 * at the far right. ✕ closes the game, but only when held until its ring
 * fills and then confirmed, so a stray click never ends a game. 🎲 rolls
 * another one. A tap of ← folds the bar down to just the ← (a tap brings it
 * back); holding it takes the bar away entirely, until the hub is reloaded,
 * for a game that needs every pixel.
 *
 * A controller reaches the bar too: holding Create + Options for a second
 * hands the bar to it (the D-pad moves, Cross presses, Circle leaves). Games
 * leave Options alone while Create is held (lib/hub/README.md §12).
 */

import { h, clear, icon, ICONS } from '../dom.js';
import { cabinetPalette, paletteVars } from '../color.js';
import { store } from '../store.js';
import { startPlay, stopPlay } from '../account/plays.js';
import { askAfterPlay } from '../account/thumbs.js';

const HOLD_MS = 700;
const IDLE_MS = 3500;
const RING = 2 * Math.PI * 10;
/** Create + Options held this long hands the bar to the controller. */
const COMBO_MS = 1000;
const PAD = { cross: 0, circle: 1, create: 8, options: 9, up: 12, down: 13, left: 14, right: 15 };

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
 * `canRoll()` says whether the 🎲 shows (asked again on refresh()),
 * `confirmExit()` words the ✕'s confirmation ({ title, detail, action }),
 * `keepFocus()` keeps the keyboard on the page while the frame loads (a card
 * over the game), `honorStandalone: false` ignores this device's plain-tab
 * choices, which a session cannot play through, and `askToRate: false` skips
 * the thumbs prompt after a game closes.
 */
export function createPlayer(
  root,
  {
    onExit,
    onRoll,
    backLabel = 'Back to the wall',
    src = (build) => build.path,
    onFrame = null,
    canRoll = () => true,
    confirmExit = () => ({ title: 'Close this game?', detail: `${backLabel}.`, action: 'Close the game' }),
    keepFocus = () => false,
    honorStandalone = true,
    askToRate = true,
  }
) {
  let session = null;
  let pageTitle = document.title;
  /** The bar: 'open', 'folded' to just the ←, or 'gone' until a reload. */
  let bar = 'open';

  function setBar(next) {
    bar = next;
    root.classList.toggle('is-folded', bar === 'folded');
    root.classList.toggle('is-bare', bar === 'gone');
  }

  /* --- holding: ✕ fills its ring to ask, ← fills its ring to go --------- */

  function cancelHold() {
    if (!session?.hold) return;
    cancelAnimationFrame(session.hold.raf);
    session.hold.arc.setAttribute('stroke-dashoffset', RING);
    session.hold = null;
  }

  /** Start filling a button's ring; `done` runs when it is full. */
  function beginHold(button, done) {
    if (!session || session.hold) return;
    const arc = button.querySelector('.arc');
    const started = performance.now();
    const step = (now) => {
      if (!session?.hold) return;
      const progress = Math.min(1, (now - started) / HOLD_MS);
      arc.setAttribute('stroke-dashoffset', String(RING * (1 - progress)));
      if (progress >= 1) {
        session.hold.done = true;
        done();
        return;
      }
      session.hold.raf = requestAnimationFrame(step);
    };
    session.hold = { button, arc, started, onFull: done, raf: requestAnimationFrame(step), done: false };
  }

  /** Let go of a held button: true when it was held long enough, even if a slow page never drew the full ring. */
  function endHold(button) {
    const hold = session?.hold;
    if (!hold || hold.button !== button) return null;
    const held = hold.done || performance.now() - hold.started >= HOLD_MS;
    cancelHold();
    if (held && !hold.done) hold.onFull();
    return held;
  }

  /** ← let go before its ring filled was a tap: fold or unfold the bar. */
  const releaseFold = (button) => {
    if (endHold(button) === false) setBar(bar === 'folded' ? 'open' : 'folded');
  };

  /* --- ✕: held, then confirmed ------------------------------------------ */

  function askToExit() {
    if (!session || session.ask) return;
    const words = confirmExit();
    const close = () => {
      session?.ask?.remove();
      if (session) session.ask = null;
      if (pad.owned) pad.focus(0);
      else refocusGame();
    };
    const card = h(
      'div',
      { class: 'player__ask', role: 'alertdialog', 'aria-modal': 'true', 'aria-label': words.title, onkeydown: (e) => e.key === 'Escape' && close() },
      h(
        'div',
        { class: 'player__ask-card' },
        h('h2', {}, words.title),
        words.detail && h('p', {}, words.detail),
        h(
          'div',
          { class: 'player__ask-actions' },
          h('button', { type: 'button', class: 'player__ask-go', onclick: () => { close(); onExit(); } }, words.action),
          h('button', { type: 'button', class: 'player__ask-stay', onclick: close }, 'Keep playing')
        )
      )
    );
    session.ask = card;
    root.append(card);
    card.querySelector('.player__ask-stay').focus();
  }

  function refocusGame() {
    if (!session?.frame || keepFocus()) return;
    session.frame.focus();
    try {
      session.frame.contentWindow?.focus();
    } catch {
      /* cross-origin after a redirect */
    }
  }

  /* --- chrome that gets out of the way ---------------------------------- */

  function wake() {
    if (!session) return;
    root.classList.remove('is-idle');
    clearTimeout(session.idle);
    session.idle = setTimeout(() => !pad.owned && root.classList.add('is-idle'), IDLE_MS);
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
      const { el: barEl } = exitBar();
      root.append(barEl, standalonePanel(game, build));
      session = { game, build, unbind: [], idle: 0, hold: null, ask: null };
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
    const { el: barEl } = exitBar();
    root.append(frame, crt, barEl);

    session = { game, build, frame, crt, unbind: [], idle: 0, hold: null, ask: null };
    onFrame?.(frame);
    cancelAnimationFrame(pad.raf);
    pad.raf = requestAnimationFrame(pad.tick);

    frame.addEventListener('load', () => {
      crt.classList.add('is-off');
      listenInside(frame);
      refocusGame();
    });

    pageTitle = document.title;
    document.title = `${game.name} — AI Hub`;
    store.recordPlay(game.slug);
    startPlay({ slug: game.slug, build: build.id ?? null });
    wake();

    if (fromTile && !reducedMotion()) zoomFrom(fromTile);
  }

  /**
   * ✕ (hold, then confirm), 🎲, a slot for whoever opened the game (a
   * session's round line), and ← (tap folds, hold hides), left to right.
   */
  function exitBar() {
    const ring = () =>
      h(
        'svg',
        { class: 'player__ring', viewBox: '0 0 24 24', 'aria-hidden': 'true' },
        h('circle', { class: 'arc', cx: 12, cy: 12, r: 10, 'stroke-dasharray': RING, 'stroke-dashoffset': RING })
      );
    const tool = (cls, label, glyph, props = {}) =>
      h('button', { type: 'button', class: `player__tool ${cls}`, 'aria-label': label, title: label, ...props }, glyph);
    /** Pointer and keyboard both hold: a key held down fills the ring like a press. */
    const holdable = (onFull, onRelease) => ({
      onpointerdown: (event) => {
        event.preventDefault();
        beginHold(event.currentTarget, onFull);
      },
      onpointerup: (event) => onRelease(event.currentTarget),
      onpointerleave: cancelHold,
      onpointercancel: cancelHold,
      oncontextmenu: (event) => event.preventDefault(),
      onkeydown: (event) => {
        if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) {
          event.preventDefault();
          beginHold(event.currentTarget, onFull);
        }
      },
      onkeyup: (event) => {
        if (event.key === 'Enter' || event.key === ' ') onRelease(event.currentTarget);
      },
    });
    const el = h(
      'div',
      { class: 'player__exit' },
      tool('player__close', `Hold to close: ${backLabel.toLowerCase()}`, [ring(), icon(ICONS.close)], holdable(askToExit, endHold)),
      tool('player__roll', 'Roll: play another random game', icon(ICONS.dice), { onclick: () => onRoll(), hidden: !canRoll() }),
      h('div', { class: 'player__slot' }),
      tool(
        'player__fold',
        'Tap to fold this bar away, hold to remove it until you reload',
        [ring(), icon(ICONS.back)],
        holdable(() => setBar('gone'), releaseFold)
      )
    );
    return { el };
  }

  /* --- the controller: Create + Options hands it the bar ---------------- */

  const pad = {
    owned: false,
    at: 0,
    comboSince: null,
    was: [],
    raf: 0,
    /** Every pad the game and this page can see: the frame's own, then ours. */
    read() {
      const lists = [];
      try {
        lists.push(session?.frame?.contentWindow?.navigator?.getGamepads?.() || []);
      } catch {
        /* a cross-origin frame keeps its pads to itself */
      }
      lists.push(navigator.getGamepads?.() || []);
      for (const list of lists) for (const p of list) if (p && p.connected) return p;
      return null;
    },
    buttons() {
      const list = [...(session?.ask ? session.ask.querySelectorAll('button') : root.querySelectorAll('.player__exit button'))];
      return list.filter((b) => !b.hidden && b.offsetParent !== null && !b.disabled);
    },
    focus(i) {
      const list = pad.buttons();
      if (!list.length) return;
      pad.at = (i + list.length) % list.length;
      for (const b of root.querySelectorAll('.is-pad')) b.classList.remove('is-pad');
      list[pad.at].classList.add('is-pad');
      list[pad.at].focus({ preventScroll: true });
    },
    take() {
      pad.owned = true;
      pad.before = bar;
      root.classList.add('has-pad');
      root.classList.remove('is-idle', 'is-folded', 'is-bare');
      pad.focus(0);
    },
    leave() {
      pad.owned = false;
      cancelHold();
      root.classList.remove('has-pad');
      for (const b of root.querySelectorAll('.is-pad')) b.classList.remove('is-pad');
      session?.ask?.querySelector('.player__ask-stay')?.click();
      setBar(pad.before ?? bar);
      wake();
      refocusGame();
    },
    tick() {
      pad.raf = requestAnimationFrame(pad.tick);
      if (!session) return;
      const p = pad.read();
      const now = p ? p.buttons.map((b) => b.pressed) : [];
      const down = (i) => now[i] && !pad.was[i];
      if (!pad.owned) {
        if (now[PAD.create] && now[PAD.options]) {
          pad.comboSince ??= performance.now();
          if (performance.now() - pad.comboSince >= COMBO_MS) {
            pad.comboSince = null;
            pad.take();
          }
        } else pad.comboSince = null;
      } else {
        const list = pad.buttons();
        if (down(PAD.left) || down(PAD.up)) pad.focus(pad.at - 1);
        if (down(PAD.right) || down(PAD.down)) pad.focus(pad.at + 1);
        const button = list[pad.at];
        if (down(PAD.cross) && button) {
          // The ✕ and ← keep their hold under Cross too.
          if (button.matches('.player__close, .player__fold')) {
            beginHold(button, button.matches('.player__close') ? askToExit : () => { setBar('gone'); pad.leave(); });
          } else button.click();
        }
        if (!now[PAD.cross] && pad.was[PAD.cross] && session.hold) {
          const held = session.hold.button;
          if (held.matches('.player__fold')) releaseFold(held);
          else endHold(held);
        }
        if (down(PAD.circle)) {
          if (session.ask) session.ask.querySelector('.player__ask-stay').click();
          else pad.leave();
        }
      }
      pad.was = now;
    },
  };

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
    cancelAnimationFrame(pad.raf);
    if (pad.owned) {
      pad.owned = false;
      root.classList.remove('has-pad');
    }
    clearTimeout(session.idle);
    const seconds = stopPlay();
    if (askToRate && !silent) askAfterPlay(session.game, seconds);
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
    /** Where a caller's own line goes in the bar, between the 🎲 and the ←. */
    slot: () => root.querySelector('.player__slot'),
    /** Ask canRoll() again: a session's host can change mid-game. */
    refresh() {
      const roll = root.querySelector('.player__roll');
      if (roll) roll.hidden = !canRoll();
    },
  };
}
