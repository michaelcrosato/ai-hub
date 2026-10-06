/**
 * couch/stage.js — the backdrop: the focused game's stills, filling the
 * screen behind everything, cross-fading through its frames with a slow
 * drift, under a veil tinted by the game's own colours.
 *
 * Every still gets a fresh layer that fades in over the last one, which then
 * leaves. A layer is only shown once its image has decoded, so a slow load
 * never flashes half a picture, and a still that is no longer wanted by the
 * time it arrives is dropped unseen.
 */

import { h } from '../dom.js';
import { cabinetPalette } from '../color.js';
import { reducedMotion } from './ui.js';

/** How long each still holds before the next fades in. */
const STILL_MS = 4000;
/** How long focus must rest on a game before its stills load: holding an
 *  arrow passes over a dozen games without fetching any of them. */
const SETTLE_MS = 180;
/** Matches the cross-fade in couch.css. */
const FADE_MS = 600;

export function createStage(root) {
  const veil = h('div', { class: 'stage__veil' });
  root.append(veil);

  let game = null;
  let still = 0;
  let latest = null;
  let cycle = 0;
  let settle = 0;
  let paused = false;

  function paint(url) {
    const img = h('img', { src: url, alt: '', decoding: 'async' });
    const layer = h('div', { class: 'stage__shot' }, img);
    latest = layer;
    root.insertBefore(layer, veil);
    const reveal = () => {
      if (latest !== layer) return layer.remove();
      requestAnimationFrame(() => {
        layer.classList.add('is-on');
        for (const old of root.querySelectorAll('.stage__shot')) {
          if (old === layer) continue;
          old.classList.remove('is-on');
          setTimeout(() => old.remove(), FADE_MS + 60);
        }
      });
    };
    img.decode().then(reveal, reveal);
  }

  function tint(next) {
    const palette = cabinetPalette(next);
    root.style.setProperty('--tint-glow', palette.glow);
    root.style.setProperty('--tint-deep', palette.deep);
  }

  function schedule() {
    clearTimeout(cycle);
    const frames = game?.frames || [];
    if (paused || frames.length < 2 || reducedMotion()) return;
    cycle = setTimeout(() => {
      still = (still + 1) % frames.length;
      paint(frames[still]);
      schedule();
    }, STILL_MS);
  }

  function show(next) {
    if (!next || next === game) return;
    game = next;
    // The first still is the title screen, its name in large letters right
    // where the hero's words go. A still from play comes up first instead.
    const frames = next.frames || [];
    still = frames.length > 1 ? 1 : 0;
    tint(next);
    paint(frames[still] || next.cover);
    schedule();
  }

  return {
    /** Bring a game up behind everything; `now` skips the wait for focus to settle. */
    show(next, { now = false } = {}) {
      clearTimeout(settle);
      if (now) show(next);
      else settle = setTimeout(() => show(next), SETTLE_MS);
    },
    /** While a game is playing nothing behind it needs to move. */
    pause() {
      paused = true;
      clearTimeout(cycle);
      root.classList.add('is-paused');
    },
    resume() {
      paused = false;
      root.classList.remove('is-paused');
      schedule();
    },
  };
}
