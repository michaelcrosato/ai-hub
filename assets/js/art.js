/**
 * art.js — procedural screen art.
 *
 * A wall of 100+ games needs 100+ distinguishable images and there are no
 * screenshots by default. Each game gets one of six attract-mode patterns,
 * picked by a hash of its slug and drawn entirely in its own colours, so the
 * art is stable across visits and distinct from its neighbours without anyone
 * drawing anything.
 *
 * A game's own favicon, when it has one, is laid over the art as its emblem.
 * `covers/<slug>.png` overrides all of this — see ui/cabinet.js.
 */

import { h } from './dom.js';
import { hashInt, fnv1a } from './color.js';

const W = 120;
const H = 90;

/** mulberry32 — small, fast, and identical every time for a given slug. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const n = (v, places = 1) => Number(v.toFixed(places));

function starfield(r, gradient) {
  const stars = [];
  for (let i = 0; i < 34; i++) {
    stars.push(
      h('circle', {
        cx: n(r() * W),
        cy: n(r() * 74),
        r: n(0.3 + r() * 1.05, 2),
        fill: 'var(--g-light)',
        opacity: n(0.22 + r() * 0.72, 2),
      })
    );
  }
  return [
    h('ellipse', { cx: 60, cy: 104, rx: 70, ry: 30, fill: `url(#${gradient})` }),
    ...stars,
    h('circle', {
      cx: n(22 + r() * 74),
      cy: n(14 + r() * 22),
      r: n(4 + r() * 8),
      fill: 'var(--g-glow)',
      opacity: 0.55,
    }),
  ];
}

function gridHorizon(r, gradient) {
  const vanish = 38;
  const parts = [
    h('ellipse', { cx: 60, cy: vanish + 2, rx: 30, ry: 14, fill: `url(#${gradient})` }),
    h('circle', { cx: 60, cy: vanish - 4, r: n(8 + r() * 5), fill: 'var(--g-glow)', opacity: 0.6 }),
  ];
  for (let x = -100; x <= 220; x += 20) {
    parts.push(
      h('line', { x1: 60, y1: vanish, x2: x, y2: H, stroke: 'var(--g-glow)', 'stroke-width': 0.5, opacity: 0.6 })
    );
  }
  for (let k = 1; k <= 8; k++) {
    const y = vanish + k ** 1.9 * 1.05;
    if (y > H) break;
    parts.push(
      h('line', { x1: 0, y1: n(y), x2: W, y2: n(y), stroke: 'var(--g-glow)', 'stroke-width': 0.5, opacity: 0.45 })
    );
  }
  parts.push(h('line', { x1: 0, y1: vanish, x2: W, y2: vanish, stroke: 'var(--g-light)', 'stroke-width': 0.7, opacity: 0.85 }));
  return parts;
}

function rings(r) {
  const cx = 60;
  const cy = 86;
  const parts = [];
  for (let i = 1; i <= 7; i++) {
    parts.push(
      h('circle', {
        cx,
        cy,
        r: i * 11.5,
        fill: 'none',
        stroke: i % 3 === 0 ? 'var(--g-light)' : 'var(--g-glow)',
        'stroke-width': i % 3 === 0 ? 0.8 : 0.5,
        opacity: n(0.9 - i * 0.09, 2),
      })
    );
  }
  for (let i = 0; i < 4; i++) {
    parts.push(
      h('circle', { cx: n(14 + r() * 92), cy: n(16 + r() * 56), r: n(1 + r() * 1.4, 2), fill: 'var(--g-light)', opacity: 0.9 })
    );
  }
  return parts;
}

function skyline(r) {
  const parts = [];
  const count = 17;
  const width = W / count;
  for (let i = 0; i < count; i++) {
    const height = 14 + r() * 58;
    parts.push(
      h('rect', {
        x: n(i * width + 0.6),
        y: n(H - height),
        width: n(width - 1.2),
        height: n(height),
        fill: i % 4 === 1 ? 'var(--g-light)' : 'var(--g-glow)',
        opacity: n(0.3 + r() * 0.55, 2),
      })
    );
  }
  parts.push(h('line', { x1: 0, y1: H - 0.5, x2: W, y2: H - 0.5, stroke: 'var(--g-light)', 'stroke-width': 1, opacity: 0.7 }));
  return parts;
}

function orbits(r, gradient) {
  const cx = 60;
  const cy = 45;
  const parts = [h('ellipse', { cx, cy, rx: 52, ry: 40, fill: `url(#${gradient})` })];
  for (let i = 0; i < 4; i++) {
    const rx = 18 + i * 11;
    const ry = n(5 + r() * 9);
    const angle = n(r() * 180);
    parts.push(
      h('ellipse', {
        cx,
        cy,
        rx,
        ry,
        fill: 'none',
        stroke: 'var(--g-glow)',
        'stroke-width': 0.6,
        opacity: n(0.85 - i * 0.12, 2),
        transform: `rotate(${angle} ${cx} ${cy})`,
      })
    );
    parts.push(
      h('circle', {
        cx: n(cx + Math.cos((angle * Math.PI) / 180) * rx),
        cy: n(cy + Math.sin((angle * Math.PI) / 180) * rx * 0.4),
        r: 1.6,
        fill: 'var(--g-light)',
      })
    );
  }
  parts.push(h('circle', { cx, cy, r: 5.5, fill: 'var(--g-light)', opacity: 0.95 }));
  return parts;
}

function chevrons(r) {
  const parts = [];
  for (let i = -3; i < 9; i++) {
    const x = i * 17 + r() * 4;
    parts.push(
      h('polygon', {
        points: `${n(x)},${H} ${n(x + 13)},${H} ${n(x + 13 + 30)},0 ${n(x + 30)},0`,
        fill: i % 3 === 0 ? 'var(--g-light)' : 'var(--g-glow)',
        opacity: n(0.16 + (i % 5) * 0.11, 2),
      })
    );
  }
  return parts;
}

const PATTERNS = [starfield, gridHorizon, rings, skyline, orbits, chevrons];

/** An <svg> element sized to the cabinet screen, drawn in the game's colours. */
export function screenArt(game) {
  const seed = fnv1a(game.slug);
  const draw = PATTERNS[hashInt(game.slug, PATTERNS.length)];
  const gradientId = `bloom-${game.slug.replace(/[^a-z0-9-]/g, '')}`;

  const svg = h(
    'svg',
    { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'xMidYMid slice', 'aria-hidden': 'true', focusable: 'false' },
    h(
      'defs',
      {},
      h(
        'radialGradient',
        { id: gradientId },
        h('stop', { offset: '0%', 'stop-color': 'var(--g-glow)', 'stop-opacity': '.85' }),
        h('stop', { offset: '100%', 'stop-color': 'var(--g-glow)', 'stop-opacity': '0' })
      )
    ),
    draw(rng(seed), gradientId)
  );

  if (game.icon) {
    svg.append(
      h('image', {
        href: game.icon,
        x: 47,
        y: 32,
        width: 26,
        height: 26,
        opacity: 0.95,
        preserveAspectRatio: 'xMidYMid meet',
      })
    );
  }

  return svg;
}
