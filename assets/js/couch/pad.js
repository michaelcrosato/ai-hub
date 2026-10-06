/**
 * couch/pad.js — a controller on the couch, read through the Gamepad API's
 * standard mapping.
 *
 * The API has no events for buttons, only a snapshot to poll, so the couch
 * polls once a frame, and only while a pad is connected. What a snapshot
 * means is worked out by plain functions — which inputs are down, what
 * changed since the last frame, when a held direction repeats, when the exit
 * chord has been held long enough — so node --test can pin all of it down
 * without a pad or a browser. Only watchPads() touches the browser, and only
 * when called.
 */

/** Standard-mapping button indexes the couch reads. */
const BUTTON = { a: 0, b: 1, x: 2, y: 3, lb: 4, rb: 5, view: 8, menu: 9, up: 12, down: 13, left: 14, right: 15 };

/** What each input asks the couch to do. The same names the keyboard maps to. */
const ACTIONS = {
  a: 'press',
  b: 'back',
  x: 'fave',
  y: 'info',
  lb: 'prevRail',
  rb: 'nextRail',
  view: 'search',
  menu: 'surprise',
  up: 'up',
  down: 'down',
  left: 'left',
  right: 'right',
};

/** Held directions repeat: once on press, again after `delay`, then every `interval`. */
export const REPEAT = { delay: 380, interval: 110 };
const REPEATS = new Set(['up', 'down', 'left', 'right']);

/** How far the stick must lean to count as a direction, and how far back it
 *  must come to let go. The gap keeps a stick resting near the line from
 *  chattering on and off. */
const DEAD_ZONE = 0.5;
const RELEASE_ZONE = 0.35;

/** View and Menu held together this long leave a game. */
export const CHORD_MS = 1000;

const pressed = (button) => Boolean(button && (typeof button === 'object' ? button.pressed || button.value > 0.5 : button));

/**
 * One snapshot as named inputs. The D-pad and the left stick both steer; the
 * stick counts on its stronger axis only, so a lazy diagonal moves one way.
 * `was` is the previous result, for the stick's release zone.
 */
export function readInput(snapshot, was = {}) {
  const buttons = snapshot?.buttons || [];
  const [x = 0, y = 0] = snapshot?.axes || [];
  const input = {};
  for (const [name, index] of Object.entries(BUTTON)) input[name] = pressed(buttons[index]);

  const lean = (value, already) => Math.abs(value) >= (already ? RELEASE_ZONE : DEAD_ZONE);
  const sideways = Math.abs(x) >= Math.abs(y);
  const stick = {
    left: sideways && x < 0 && lean(x, was.stickLeft),
    right: sideways && x > 0 && lean(x, was.stickRight),
    up: !sideways && y < 0 && lean(y, was.stickUp),
    down: !sideways && y > 0 && lean(y, was.stickDown),
  };
  for (const [dir, on] of Object.entries(stick)) {
    input[`stick${dir[0].toUpperCase()}${dir.slice(1)}`] = on;
    input[dir] = input[dir] || on;
  }
  return input;
}

/** Several pads drive the couch together: an input is down if it is down on any. */
export function mergeInputs(inputs) {
  const out = {};
  for (const input of inputs) for (const [name, on] of Object.entries(input)) out[name] = out[name] || on;
  return out;
}

/**
 * What changed since the last frame, as actions. A button acts once when it
 * goes down; a direction also repeats while held. `held` is the state this
 * returns, passed back in on the next frame.
 */
export function padStep(held, input, now, { delay = REPEAT.delay, interval = REPEAT.interval } = {}) {
  const next = {};
  const actions = [];
  for (const name of Object.keys(ACTIONS)) {
    if (!input[name]) continue;
    const was = held[name];
    if (!was) {
      actions.push(ACTIONS[name]);
      next[name] = { since: now, fired: now };
      continue;
    }
    // The first repeat waits out the delay; every one after it, the interval.
    const due = was.fired === was.since ? was.since + delay : was.fired + interval;
    if (REPEATS.has(name) && now >= due) {
      actions.push(ACTIONS[name]);
      next[name] = { since: was.since, fired: now };
    } else {
      next[name] = was;
    }
  }
  return { held: next, actions };
}

/**
 * The way out of a game with no mouse: View and Menu held together for
 * CHORD_MS. Fires once per hold; both must come up before it can fire again.
 * `progress` runs 0 → 1 while the chord is held, for a ring to fill.
 */
export function chordStep(state, input, now, ms = CHORD_MS) {
  const both = Boolean(input.view && input.menu);
  if (!both) return { state: null, progress: 0, fired: false };
  const since = state?.since ?? now;
  const done = Boolean(state?.done);
  const progress = Math.min(1, (now - since) / ms);
  const fired = !done && progress >= 1;
  return { state: { since, done: done || fired }, progress: done ? 1 : progress, fired };
}

/**
 * Poll the pads while any is connected. `onAction(action)` gets each action
 * while the couch is listening; while a game is playing (`playing()` is true)
 * only the exit chord is read, through `onChord(progress, fired)`. `read`
 * returns the pads to poll: by default this window's, and the couch swaps in
 * the playing game's own frame, which is the one with focus then.
 */
export function watchPads({ onAction, onChord, onConnect, playing = () => false, read = () => navigator.getGamepads?.() || [] }) {
  let raf = 0;
  let held = {};
  let chord = null;
  let last = {};
  let connected = false;

  const pads = () => {
    try {
      return [...read()].filter((pad) => pad && pad.connected !== false);
    } catch {
      return [];
    }
  };

  function poll(now) {
    raf = 0;
    const list = pads();
    if (!list.length && !connected) return;
    const input = mergeInputs(list.map((pad) => readInput(pad, last)));
    last = input;

    // Held state is tracked through a game too, so a button still down when
    // the game closes is not read as a fresh press on the couch.
    const step = padStep(held, input, now);
    held = step.held;
    if (playing()) {
      const was = chord;
      const next = chordStep(chord, input, now);
      chord = next.state;
      if (next.progress > 0 || was) onChord?.(next.progress, next.fired);
    } else {
      chord = null;
      for (const action of step.actions) onAction(action);
    }
    raf = requestAnimationFrame(poll);
  }

  function update() {
    const now = pads().length > 0;
    if (now !== connected) {
      connected = now;
      onConnect?.(connected);
    }
    if (connected && !raf) raf = requestAnimationFrame(poll);
    if (!connected && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
      held = {};
      chord = null;
    }
  }

  addEventListener('gamepadconnected', update);
  addEventListener('gamepaddisconnected', update);
  update();

  return { connected: () => connected };
}
