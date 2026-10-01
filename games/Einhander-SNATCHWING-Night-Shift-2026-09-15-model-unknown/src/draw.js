// The effects layer: every glow, tracer, spark, ring, beam, searchlight and rain streak the
// old Canvas2D overlay drew, now drawn by the GPU as instanced quads in a screen-space layer
// that rides in front of the camera. Positions use the old projection maths (a 1280-wide
// logical screen, y down) so every effect sits exactly where it did. Only text stays on a
// small 2D canvas: floating scores, pod labels and warnings.

import * as THREE from 'three/webgpu';
import { FxBatch, fxMaterial } from './fx.js';
import { S, W, FOV, POD } from './state.js';
import { C, TAU, clamp } from './util.js';

const TAN = Math.tan((FOV * Math.PI) / 360);
const VP = new THREE.Matrix4();
const m = VP.elements;
const V = new THREE.Vector3();
const P0 = { x: 0, y: 0, s: 1, w: 1 };
const P1 = { x: 0, y: 0, s: 1, w: 1 };
const EXHAUST_Z = [-0.48, 0.51];

let overlay = null;
let ctx = null;
let labelsDrawn = false;
let pxScale = 1; // device pixels per logical pixel, for the thinnest strokes
const B = {};
export const batches = [];

/** Build the effect batches (children of the camera) and grab the text canvas. */
export function initDraw(camera, textCanvas) {
  const normal = fxMaterial(false);
  const add = fxMaterial(true);
  overlay = new THREE.Group();
  overlay.name = 'fx-layer';
  overlay.position.set(0, 0, -1);
  camera.add(overlay);
  const make = (key, material, capacity, order) => {
    const b = new FxBatch(material, capacity, order);
    B[key] = b;
    batches.push(b);
    overlay.add(b.mesh);
  };
  make('back', normal, 512, 10); // searchlights, traffic, rain, distant lamps
  make('ship', add, 32, 11); // the Magpie's exhaust (additive, like 'lighter')
  make('mid', normal, 1536, 12); // enemy lights, beams, telegraphs, pods
  make('shots', add, 3072, 13); // player fire (additive)
  make('top', normal, 4096, 14); // enemy fire, sparks, blasts, tethers, screen flashes
  ctx = textCanvas.getContext('2d');
}

/** One logical pixel of the layer = one pixel of the old 1280-wide overlay. */
export function resizeDraw() {
  const k = (2 * TAN) / S.H;
  overlay.scale.set(k, k, 1);
}

/** Take this frame's view-projection (after the camera moved). */
export function setView(camera, devicePxPerLogical) {
  VP.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  pxScale = devicePxPerLogical;
}

/** World point → logical screen pixels, with the old perspective scale `s` (pixels per unit). */
function project(x, y, z, out) {
  const w = m[3] * x + m[7] * y + m[11] * z + m[15];
  out.x = (((m[0] * x + m[4] * y + m[8] * z + m[12]) / w) * 0.5 + 0.5) * W;
  out.y = (0.5 - ((m[1] * x + m[5] * y + m[9] * z + m[13]) / w) * 0.5) * S.H;
  out.s = (S.H * 0.5) / (w * TAN);
  out.w = w;
  return out;
}

/** Logical screen pixels → the world point on the z = 0 flight plane. */
export function unproject(x, y, out) {
  const nx = (x / W) * 2 - 1;
  const ny = 1 - (y / S.H) * 2;
  const A = m[0] - nx * m[3];
  const Bv = m[4] - nx * m[7];
  const CC = nx * m[15] - m[12];
  const D = m[1] - ny * m[3];
  const E = m[5] - ny * m[7];
  const F = ny * m[15] - m[13];
  const det = A * E - Bv * D || 1e-9;
  out.x = (CC * E - Bv * F) / det;
  out.y = (A * F - CC * D) / det;
  return out;
}

// Screen (y down, origin top-left) → layer (y up, origin centre).
const X = (px) => px - W / 2;
const Y = (py) => S.H / 2 - py;

function glow(b, x, y, r, color, alpha = 1) {
  if (r <= 0 || x < -r || x > W + r || y < -r || y > S.H + r) return;
  b.glow(X(x), Y(y), 0, r, color, alpha);
}
function line(b, x1, y1, x2, y2, color, width = 2, alpha = 1, dashes = 0) {
  // Strokes thinner than about a device pixel keep their coverage as fainter, wider quads.
  const dev = width * pxScale;
  if (dev < 1.2) {
    alpha *= dev / 1.2;
    width = 1.2 / pxScale;
  }
  b.line(X(x1), Y(y1), X(x2), Y(y2), 0, width, color, alpha, dashes);
}
function ring(b, x, y, r, width, color, alpha = 1, dashes = 0) {
  if (r <= 0) return;
  b.ring(X(x), Y(y), 0, r, width, color, alpha, dashes);
}
function disc(b, x, y, r, color, alpha = 1) {
  b.disc(X(x), Y(y), 0, r, color, alpha);
}
function rect(b, x, y, w, h, rot, color, alpha = 1) {
  b.rect(X(x), Y(y), 0, w, h, -rot, color, alpha);
}
const wrapX = (x, lo, period) => x - period * Math.floor((x - lo) / period);

// ---------------------------------------------------------------- text
function text(str, x, y, font, color, align = 'center', alpha = 1, shadow = false) {
  if (!labelsDrawn) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    labelsDrawn = true;
  }
  ctx.globalAlpha = alpha;
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  if (shadow) {
    ctx.shadowColor = '#06131b';
    ctx.shadowBlur = 5;
  }
  ctx.fillText(str, x, y);
  if (shadow) ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- the frame
/**
 * Fill every batch for this frame. `takeLabel` is the prompt shown on reachable pods
 * ('[E] TAKE / ', '[B] TAKE / ' or 'TAKE / '), following the player's device.
 */
export function drawEffects(takeLabel) {
  const wasDrawn = labelsDrawn;
  labelsDrawn = false;
  for (const b of batches) b.begin();
  const H = S.H;
  const t = S.cityClock;
  const pl = S.player;
  const sc = S.scenery;

  // Searchlight cones and fine rain sit below all flight effects.
  for (let i = 0; i < 3; i++) {
    const a = project(-19 + i * 21, -12, -22, P0);
    const b = project(-24 + i * 21 + Math.sin(t * 0.16 + i) * 15, 26, -25, P1);
    B.back.cone(X(a.x), Y(a.y), X(b.x), Y(b.y), 0, 110, '#7ac1d3', 0.04);
  }
  for (const tr of sc.traffic) {
    const p = project(tr.x, tr.y, tr.z, P0);
    line(B.back, p.x, p.y, p.x + 7, p.y, tr.c, 1, 0.5);
    glow(B.back, p.x, p.y, 9, tr.c, 0.3);
  }
  for (let i = 0; i < 70; i++) {
    const x = (((i * 191.7 - t * 135) % W) + W) % W;
    const y = (((i * 97.4 + t * 370) % H) + H) % H;
    line(B.back, x, y, x - 5, y + 13, '#81adb7', 0.7, 0.16);
  }
  // Distant lights stay dim.
  if (S.route === 0) {
    const off = sc.L2.off;
    for (const f of sc.front) {
      const p = project(wrapX(f.pivot - off, -f.period / 2, f.period), 1, f.z + 2.5, P0);
      glow(B.back, p.x, p.y, 50, '#5cbdc7', 0.1);
    }
  } else {
    const off = sc.quay.off;
    for (const l of sc.lamps) {
      const p = project(wrapX(l.pivot - off, l.lo, l.period) + l.dx, l.y, l.z, P0);
      glow(B.back, p.x, p.y, 40, '#efbe82', 0.12);
    }
  }

  drawShip();

  // Enemy engines, beams and warnings. Hostile projectiles get strong warm cores later.
  for (const e of S.enemies) {
    if (e.dead) continue;
    const ty = e.type;
    if (ty !== 'turret' && ty !== 'mine' && !e.isBoss) {
      const p = project(e.x + (ty === 'carrier' || ty === 'minelayer' ? 1.8 : 1), e.y, 0, P0);
      glow(B.mid, p.x, p.y, 15, ty === 'carrier' || ty === 'minelayer' ? C.purple : C.red, 0.5);
    }
    if (ty === 'carrier') {
      const u = project(e.x, e.y - 1.85, 0.5, P0);
      text('◆ ' + e.weapon, u.x, u.y, '11px monospace', POD[e.weapon].color);
    } else if (ty === 'mine') {
      const p = project(e.x, e.y, 0.4, P0);
      const armed = e.arm >= 0;
      const blink = armed ? (Math.sin(e.t * 34) > 0 ? 1 : 0.25) : 0.35 + 0.3 * Math.sin(e.t * 5);
      glow(B.mid, p.x, p.y, 12, C.red, blink * 0.8);
      if (armed) {
        const k = 1 - e.arm / e.armMax;
        ring(B.mid, p.x, p.y, p.s * (0.6 + 2.1 * k), 1.2, C.red, 0.55 * (1 - k * 0.5));
      }
    } else if (ty === 'lancer' && e.state === 'lock') {
      // The lane it is about to charge down.
      const k = 1 - e.lock / e.lockMax;
      const p1 = project(-23, e.lane, 0, P0);
      const p2 = project(e.x - 1.6, e.lane, 0, P1);
      line(B.mid, p1.x, p1.y, p2.x, p2.y, C.red, 1.5, 0.3 + k * 0.5, Math.abs(p2.x - p1.x) / 19);
      line(B.mid, p1.x, p1.y - 9, p2.x, p2.y - 9, C.red, 1, 0.12);
      line(B.mid, p1.x, p1.y + 9, p2.x, p2.y + 9, C.red, 1, 0.12);
      glow(B.mid, p2.x, p2.y, 22 + k * 30, C.red, 0.6);
    }
    if (e.beam) {
      const b = e.beam;
      const p1 = project(-23, b.y, 0, P0);
      const p2 = project(e.x - 2, b.y, 0, P1);
      if (b.t > b.charge) {
        glow(B.mid, p2.x, p2.y, 115, C.amber, 0.9);
        line(B.mid, p1.x, p1.y, p2.x, p2.y, '#ff633c', 31, 0.14);
        line(B.mid, p1.x, p1.y, p2.x, p2.y, '#ffb278', 16, 0.7);
        line(B.mid, p1.x, p1.y, p2.x, p2.y, '#fff1d2', 7, 1);
      } else {
        const charge = b.t / b.charge;
        line(B.mid, p1.x, p1.y, p2.x, p2.y, C.red, 1.5, 0.4 + charge * 0.4, Math.abs(p2.x - p1.x) / 19);
        line(B.mid, p1.x, p1.y - 12, p2.x, p2.y - 12, C.red, 1, 0.15);
        line(B.mid, p1.x, p1.y + 12, p2.x, p2.y + 12, C.red, 1, 0.15);
        glow(B.mid, p2.x, p2.y, 35 + charge * 55, C.red, 0.7);
        text('BEAM CHARGING', p2.x - 16, p2.y - 22, '11px monospace', C.red, 'right');
      }
    }
    if (ty === 'dredge' && e.hook) {
      const p = project(e.tipX, e.tipY, 0.5, P0);
      glow(B.mid, p.x, p.y, 26 + Math.sin(e.t * 9) * 5, '#ff7359', 0.6);
    }
  }

  for (const p of S.pickups) {
    if (p.taken) continue;
    const sp = project(p.x, p.y, 0.5, P0);
    const near = Math.hypot(p.x - pl.x, p.y - pl.y) < 7.1;
    const col = p.type === 'REPAIR' ? C.mint : POD[p.type].color;
    const r = sp.s * 0.9;
    const a = p.life < 3 ? 0.4 + 0.4 * Math.sin(p.t * 14) : 0.85;
    glow(B.mid, sp.x, sp.y, r * 1.4, col, 0.25);
    ring(B.mid, sp.x, sp.y, r, 1.3, col, a, (TAU * r) / 11);
    text((near ? takeLabel : '') + p.type, sp.x, sp.y - r - 11, 'bold 12px monospace', col, 'center', a);
  }

  for (const b of S.shots) {
    const p = project(b.x, b.y, 0.3, P0);
    const kind = b.kind;
    const col = kind === 'rivet' ? '#ffe0a2' : kind === 'missile' ? C.purple : kind === 'scatter' ? C.lime : C.cyan;
    if (kind === 'missile') {
      const tr = b.trail;
      if (tr.length > 1) {
        project(tr[0][0], tr[0][1], 0.3, P1);
        let px = P1.x;
        let py = P1.y;
        for (let i = 1; i < tr.length; i++) {
          const q = project(tr[i][0], tr[i][1], 0.3, P1);
          line(B.shots, px, py, q.x, q.y, C.purple, 2, 0.45);
          px = q.x;
          py = q.y;
        }
      }
      glow(B.shots, p.x, p.y, 17, col, 0.8);
      const q = project(b.x - b.vx * 0.012, b.y - b.vy * 0.012, 0.3, P1);
      line(B.shots, p.x, p.y, q.x, q.y, '#e7e8ff', 4);
    } else {
      const rail = kind === 'rail';
      let q;
      if (kind === 'scatter') {
        const sp = Math.hypot(b.vx, b.vy) || 1;
        q = project(b.x - (b.vx / sp) * 0.45, b.y - (b.vy / sp) * 0.45, 0.3, P1);
      } else q = project(b.x - (rail ? 3.5 : kind === 'rivet' ? 0.75 : 0.7), b.y, 0.3, P1);
      line(B.shots, p.x, p.y, q.x, q.y, col, rail ? 10 : 7, 0.1);
      line(B.shots, p.x, p.y, q.x, q.y, col, rail ? 3.5 : 2.6, 0.9);
      if (rail) line(B.shots, p.x, p.y, q.x, q.y, '#edffff', 1.6);
      glow(B.shots, p.x, p.y, rail ? 19 : kind === 'scatter' ? 8 : 10, col, 0.7);
    }
  }

  for (const b of S.bullets) {
    const p = project(b.x, b.y, 0.4, P0);
    glow(B.top, p.x, p.y, 17, b.color, 0.75);
    disc(B.top, p.x, p.y, Math.max(3.2, b.r * p.s), b.color);
    disc(B.top, p.x - 1, p.y - 1, Math.max(1.3, b.r * p.s * 0.4), '#fff2ce');
  }
  for (const q of S.particles) {
    const s = project(q.x, q.y, q.z, P0);
    const alpha = clamp(q.life / q.max, 0, 1);
    if (q.debris) rect(B.top, s.x, s.y, 5, 3, q.life * 16 + q.vx, '#92a4a5', alpha);
    else {
      const e = project(q.x - q.vx * 0.045, q.y - q.vy * 0.045, q.z, P1);
      line(B.top, s.x, s.y, e.x, e.y, q.color, Math.max(1, s.s * q.size * 0.5), alpha);
      glow(B.top, s.x, s.y, Math.max(3, s.s * q.size * 2), q.color, alpha * 0.6);
    }
  }
  for (const r of S.rings) {
    const p = project(r.x, r.y, 0.5, P0);
    const a = clamp(r.life / r.max, 0, 1);
    if (r.kind === 'blast') {
      glow(B.top, p.x, p.y, p.s * r.size * (1.8 - a), C.amber, a * 0.85);
      glow(B.top, p.x, p.y, p.s * r.size * 0.42, '#fff5cd', a);
      ring(B.top, p.x, p.y, p.s * r.r, 2, C.amber, a * 0.5);
    } else ring(B.top, p.x, p.y, p.s * r.r, r.kind === 'pulse' ? 4 : 1.2, C.mint, a * (r.kind === 'scan' ? 0.25 : 0.8));
  }
  for (const tt of S.tethers) {
    const p = project(pl.x, pl.y - 0.5, 0.4, P0);
    const q = project(tt.x, tt.y, 0.4, P1);
    const a = tt.life / tt.max;
    line(B.top, p.x, p.y, q.x, q.y, C.mint, 2, a);
    glow(B.top, q.x, q.y, 26, C.mint, a);
  }
  for (const f of S.floats) {
    const p = project(f.x, f.y, 0.7, P0);
    text(f.text, p.x, p.y, (f.size >= 17 ? 'bold ' : '') + f.size + 'px monospace', f.color, 'center', clamp(f.life / 0.4, 0, 1), true);
  }
  if (S.flash > 0) rect(B.top, W / 2, H / 2, W, H, 0, '#ff603b', S.flash * 0.18);
  if (S.pulseFlash > 0) rect(B.top, W / 2, H / 2, W, H, 0, '#98ffda', S.pulseFlash * 0.16);

  for (const b of batches) b.end();
  if (wasDrawn && !labelsDrawn) ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

/** The Magpie's twin exhausts (additive) and the focus ring. */
function drawShip() {
  const node = S.playerNode;
  if (node.visible) {
    node.updateMatrixWorld();
    const k = node.scale.x;
    for (const z of EXHAUST_Z) {
      V.set(-2.05, -0.16, z).applyMatrix4(node.matrixWorld);
      const p = project(V.x, V.y, V.z, P0);
      V.set(-2.85 - Math.random() * 0.3, -0.16, z).applyMatrix4(node.matrixWorld);
      const q = project(V.x, V.y, V.z, P1);
      glow(B.ship, p.x, p.y, p.s * 0.55 * k, C.cyan, 0.75);
      line(B.ship, p.x, p.y, q.x, q.y, '#3783c5', p.s * 0.21 * k, 0.5);
      line(B.ship, p.x, p.y, q.x, q.y, '#a4f4fc', p.s * 0.067 * k, 0.9);
    }
  }
  const pl = S.player;
  if (S.mode === 'play' && !pl.dead && (S.ctl.focus || pl.inv > 0)) {
    const p = project(pl.x, pl.y, 0.7, P0);
    ring(B.mid, p.x, p.y, p.s * 0.27, 1, C.mint, 0.75);
    rect(B.mid, p.x, p.y, 4, 4, 0, '#e9fff4', 0.75);
  }
}
