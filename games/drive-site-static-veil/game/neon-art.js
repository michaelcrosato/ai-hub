/*
 * VEIL // Original procedural scenery for my-3D2dge.
 * Load after my-3d2dge.js. No external assets or gameplay state are required.
 *
 * Prop: { type, x, y, z=0, scale=1, color?, label?, sublabel?, active=true,
 *         orientation=0, phase=0, light=true, damaged=false, width?,
 *         hostile=false, reducedMotion=false, bias=0 }
 * orientation is a quarter turn: 0, 1, 2, or 3. 'y' also means 1.
 * type: console, server, pylon, dish, transformer, sign, camera, drone,
 *       bollard, vent, antenna, crate.
 * drawProp returns false when the prop is outside the view.
 * drawDecor draws an array and returns its visible prop count.
 * rain and waypoint are visual effects only.
 * Sign examples: label:'ORISON'; label:'MEMORY / IS PROPERTY';
 *                label:'NINTH RELAY', width:54.
 */
(function (root) {
  'use strict';
  const E = root.My3D2dge;
  const px = E.px;
  const C = Object.freeze({
    ink: '#07111d', deep: '#0c1b29', steel: '#162e40', top: '#294658',
    edge: '#527084', pale: '#aecad0', cyan: '#64ffda', blue: '#50bfd7',
    amber: '#f4be5c', red: '#f27472', white: '#dcfff4', shadow: '#040b13'
  });
  const HEIGHTS = { console: 25, server: 40, pylon: 58, dish: 64,
    transformer: 27, sign: 53, camera: 43, drone: 34, bollard: 15,
    vent: 9, antenna: 71, crate: 14 };
  const ALIAS = { rack: 'server', serverRack: 'server', terminal: 'console',
    signboard: 'sign', comms: 'dish', relay: 'pylon', dock: 'bollard' };

  function drawProp(r, prop, time = 0) {
    if (!prop) return false;
    const type = ALIAS[prop.type || prop.kind] || prop.type || prop.kind || 'crate';
    const x = Number(prop.x) || 0, y = Number(prop.y) || 0, z = Number(prop.z) || 0;
    const s = E.clamp(Number(prop.scale) || 1, .35, 3);
    const h = (HEIGHTS[type] || 30) * s;
    if (!r.visible(x, y, z, 100 * s, 50, h * r.view.scale + 35)) return false;
    const on = prop.active !== false;
    const hue = prop.color || (type === 'transformer' || type === 'bollard' ? C.amber : C.cyan);
    const phase = Number(prop.phase) || x * .073 + y * .027;
    const t = time + phase;
    const quarter = prop.orientation === 'y' ? 1 : (Number(prop.orientation) || 0) & 3;
    const co = [1, 0, -1, 0][quarter], si = [0, 1, 0, -1][quarter];
    const world = (u, v, w) => [x + (u * co - v * si) * s, y + (u * si + v * co) * s, z + w * s];
    const P = (u, v, w) => r.w(...world(u, v, w));
    const screenScale = r.view.scale * s;
    const pixelWidth = n => Math.max(1, Math.round(n * screenScale));
    const body = g => {
      const B = (u0, v0, w0, u1, v1, w1, top = C.top, side = C.steel) => {
        const a = world(u0, v0, w0), b = world(u1, v1, w1);
        r.box(g, Math.min(a[0], b[0]), Math.min(a[1], b[1]), a[2],
          Math.max(a[0], b[0]), Math.max(a[1], b[1]), b[2], top, side);
      };
      const L = (a, b, color = C.edge, width = 1) => {
        const aa = P(...a), bb = P(...b);
        px.line(g, aa[0], aa[1], bb[0], bb[1], color, pixelWidth(width));
      };
      const F = (points, color) => px.poly(g, points.map(q => P(...q)), color);
      const dot = (u, v, w, color, radius = 1) => {
        const a = P(u, v, w); px.disc(g, a[0], a[1], Math.max(.5, radius * screenScale), color);
      };
      switch (type) {
        case 'console': {
          B(-8, -6, 0, 8, 6, 3, C.edge, C.deep);
          B(-5, -4, 3, 5, 4, 14, C.top, C.steel);
          B(-9, -6, 14, 9, 5, 18, C.top, C.deep);
          F([[-8, -5, 25], [8, -5, 25], [8, 3, 18], [-8, 3, 18]], C.edge);
          F([[-7, -4.5, 24], [7, -4.5, 24], [7, 2, 18.9], [-7, 2, 18.9]], C.ink);
          L([-8, 5, 16], [8, 5, 16], C.edge);
          for (let i = 0; i < 5; i++) L([-6 + i * 2.8, 3.5, 18.2], [-5 + i * 2.8, 3.5, 18.2], C.pale);
          B(4.5, 5, 4, 7, 6, 9, C.steel, C.ink);
          L([-3, 4.1, 9], [3, 4.1, 9], C.edge);
          break;
        }
        case 'server': {
          B(-7, -5, 0, 7, 5, 3, C.edge, C.deep);
          B(-6, -4, 3, 6, 4, 39, C.top, C.deep);
          B(-6.6, 4, 4, -4.7, 5.3, 37, C.top, C.edge);
          B(4.7, 4, 4, 6.6, 5.3, 37, C.top, C.edge);
          for (let k = 0; k < 6; k++) {
            B(-4.5, 4, 5 + k * 5, 4.5, 5.2, 9 + k * 5, C.steel, C.ink);
            L([-3, 5.4, 6.5 + k * 5], [1, 5.4, 6.5 + k * 5], C.edge);
          }
          for (let k = 0; k < 3; k++) L([-4 + k * 4, -3, 39.1], [-4 + k * 4, 3, 39.1], C.ink);
          L([-3, -5, 2], [-9, -9, 1], C.ink, 1.5);
          L([-9, -9, 1], [-12, -9, 1], C.edge);
          break;
        }
        case 'pylon': {
          B(-10, -10, 0, 10, 10, 4, C.top, C.deep);
          B(-7, -7, 4, 7, 7, 9, C.edge, C.steel);
          B(-4, -4, 9, 4, 4, 48, C.top, C.deep);
          for (const h0 of [15, 28, 41]) B(-6, -6, h0, 6, 6, h0 + 3, C.edge, C.steel);
          B(-2, -2, 48, 2, 2, 58, C.pale, C.edge);
          for (const side of [-1, 1]) {
            L([side * 4, 0, 12], [side * 9, 0, 7], C.edge, 1.5);
            L([0, side * 4, 12], [0, side * 9, 7], C.edge, 1.5);
          }
          break;
        }
        case 'dish': {
          B(-9, -8, 0, 9, 8, 5, C.edge, C.deep);
          B(-3, -3, 5, 3, 3, 34, C.top, C.steel);
          L([-8, -6, 4], [0, 0, 28], C.edge, 1.5);
          L([8, 6, 4], [0, 0, 28], C.top, 2);
          const ring = [], inner = [];
          for (let i = 0; i < 16; i++) {
            const a = i / 16 * Math.PI * 2;
            ring.push([Math.cos(a) * 18, Math.sin(a) * 5 - 2, 43 + Math.sin(a) * 14]);
            inner.push([Math.cos(a) * 15, Math.sin(a) * 4.5 - 2.2, 43 + Math.sin(a) * 11.5]);
          }
          F(ring, C.edge); F(inner, C.deep);
          for (let i = 0; i < 16; i += 2) L(ring[i], [0, 4, 41], i % 4 ? C.steel : C.top);
          L([-15, -2, 43], [0, 17, 48], C.edge);
          L([15, -2, 43], [0, 17, 48], C.edge);
          L([0, -7, 29], [0, 17, 48], C.top);
          B(-1.5, 15, 47, 1.5, 19, 51, C.pale, C.steel);
          L([0, 0, 56], [0, 0, 64], C.edge);
          break;
        }
        case 'transformer': {
          B(-13, -9, 0, 13, 9, 3, C.edge, C.deep);
          B(-11, -7, 3, 11, 7, 20, C.top, C.steel);
          B(-12, -8, 19, 12, 8, 22, C.edge, C.deep);
          for (let k = 0; k < 7; k++) L([-9 + k * 3, 7.1, 5], [-9 + k * 3, 7.1, 17], C.ink, 1.2);
          for (const u of [-7, 7]) {
            B(u - 2, -3, 22, u + 2, 1, 27, C.pale, C.steel);
            L([u, -1, 27], [u, -8, 30], C.edge, 1.5);
          }
          for (let k = 0; k < 6; k++) {
            const u = -10 + k * 3.5;
            F([[u, 8.1, 20], [u + 1.8, 8.1, 20], [u + 3.3, 8.1, 22], [u + 1.5, 8.1, 22]], C.amber);
          }
          F([[-3, 7.2, 11], [0, 7.2, 16], [3, 7.2, 11]], C.amber);
          L([0, 7.3, 12], [0, 7.3, 14], C.ink);
          break;
        }
        case 'sign': {
          const width = E.clamp(Number(prop.width) || 46, 22, 90);
          const post = Math.min(16, width * .32);
          B(-post - 1, -1.5, 0, -post + 1, 1.5, 39, C.edge, C.steel);
          B(post - 1, -1.5, 0, post + 1, 1.5, 39, C.edge, C.steel);
          B(-post - 4, -3, 0, -post + 4, 3, 2, C.top, C.deep);
          B(post - 4, -3, 0, post + 4, 3, 2, C.top, C.deep);
          const a = P(0, 0, 43), w = Math.round(width * screenScale), hh = Math.round(18 * screenScale);
          px.rect(g, a[0] - w / 2 - 2, a[1] - hh / 2 - 2, w + 4, hh + 4, C.edge);
          px.rect(g, a[0] - w / 2, a[1] - hh / 2, w, hh, C.ink);
          px.rect(g, a[0] - w / 2, a[1] + hh / 2 - 2, w, 2, C.top);
          for (const side of [-1, 1]) px.rect(g, a[0] + side * (w / 2 - 3) - 1, a[1] - hh / 2 + 3, 2, 2, C.pale);
          break;
        }
        case 'camera': {
          B(-2, -2, 0, 2, 2, 36, C.top, C.steel);
          B(-4, -4, 0, 4, 4, 3, C.edge, C.deep);
          L([0, 0, 34], [7, 0, 39], C.edge, 2);
          B(4, -3, 37, 14, 3, 43, C.pale, C.top);
          B(13, -2.2, 38, 16, 2.2, 42, C.ink, C.deep);
          L([5, -3, 43], [13, -3, 43], C.edge);
          break;
        }
        case 'drone': {
          const hover = 23 + (prop.reducedMotion ? 0 : Math.sin(t * 1.4) * 1.3);
          B(-4, -3, hover - 3, 4, 3, hover + 2, C.edge, C.steel);
          for (const side of [-1, 1]) {
            L([side * 3, 0, hover], [side * 12, 0, hover + 2], C.top, 2);
            const a = P(side * 12, 0, hover + 2);
            px.ell(g, a[0], a[1], 5.5 * screenScale, 2.2 * screenScale, C.ink);
            px.ell(g, a[0], a[1], 4 * screenScale, 1.25 * screenScale, C.edge);
            const sweep = (Math.floor(t * 14) & 1) ? 3 : 5;
            px.line(g, a[0] - sweep * screenScale, a[1], a[0] + sweep * screenScale, a[1], C.top);
          }
          B(-2, 2, hover - 6, 2, 5, hover - 2, C.deep, C.ink);
          L([-3, -1, hover + 2], [-5, -3, hover + 7], C.edge);
          break;
        }
        case 'bollard': {
          B(-4, -4, 0, 4, 4, 2, C.top, C.deep);
          B(-2.5, -2.5, 2, 2.5, 2.5, 13, C.top, C.steel);
          B(-3, -3, 8, 3, 3, 10, C.amber, C.amber);
          B(-3, -3, 13, 3, 3, 15, C.edge, C.deep);
          L([-1, 3.1, 8], [1, 3.1, 10], C.ink);
          break;
        }
        case 'vent': {
          B(-10, -7, 0, 10, 7, 5, C.top, C.deep);
          B(-11, -8, 5, 11, 8, 7, C.edge, C.steel);
          B(-9, -6, 7, 9, 6, 7.5, C.ink, C.deep);
          for (let k = 0; k < 7; k++) L([-8, -5 + k * 1.7, 8], [8, -5 + k * 1.7, 8], C.top, 1.1);
          for (const u of [-10, 10]) for (const v of [-7, 7]) dot(u, v, 7.1, C.pale, .5);
          break;
        }
        case 'antenna': {
          B(-6, -6, 0, 6, 6, 4, C.edge, C.deep);
          L([0, 0, 4], [0, 0, 70], C.edge, 1.5);
          for (const k of [-1, 1]) {
            L([k * 5, 0, 4], [0, 0, 29], C.top);
            L([0, k * 5, 4], [0, 0, 29], C.top);
          }
          for (const h0 of [39, 49, 58]) {
            const w = h0 === 39 ? 14 : h0 === 49 ? 11 : 7;
            L([-w, 0, h0], [w, 0, h0], C.pale);
            L([-w, 0, h0], [-w, 0, h0 + 6], C.edge);
            L([w, 0, h0], [w, 0, h0 + 6], C.edge);
          }
          B(-4, 2, 7, 4, 5, 18, C.top, C.steel);
          break;
        }
        case 'crate':
        default: {
          B(-7, -6, 0, 7, 6, 13, C.top, C.steel);
          B(-8, -7, 12, 8, 7, 14, C.edge, C.deep);
          for (const u of [-5, 5]) {
            L([u, -6.1, 0], [u, -6.1, 13], C.edge);
            L([u, 6.1, 0], [u, 6.1, 13], C.edge);
            L([u, -6, 14.1], [u, 6, 14.1], C.steel, 1.5);
          }
          F([[-2, 6.2, 5], [2, 6.2, 5], [2, 6.2, 9], [-2, 6.2, 9]], prop.damaged ? C.red : C.amber);
          L([-7, 2, 5], [-7, 4, 8], C.deep);
          break;
        }
      }
    };
    r.queue(x, y, z, body, { solid: true, hides: type !== 'vent', bias: prop.bias || 0 });

    const hasGlow = on && !['vent', 'crate'].includes(type);
    if (hasGlow) {
      r.queue(x, y, z, g => {
        px.glow(g, 1);
        const L = (a, b, color = hue, width = 1) => {
          const aa = P(...a), bb = P(...b);
          px.line(g, aa[0], aa[1], bb[0], bb[1], color, pixelWidth(width));
        };
        const lamp = (u, v, w, rad = 1, color = hue, halo = 0) => {
          const a = P(u, v, w);
          if (halo) r.glowDisc(g, a[0], a[1], halo * screenScale, color, .2);
          px.disc(g, a[0], a[1], rad * screenScale, color);
          if (rad > .8) px.dot(g, a[0], a[1], C.white);
        };
        if (type === 'console') {
          for (let i = 0; i < 3; i++) L([-5.5, -3 + i * 1.7, 22.7 - i * 1.35], [i === 1 ? 1 : 5.5, -3 + i * 1.7, 22.7 - i * 1.35], i === 1 ? C.pale : hue);
          lamp(5, 4, 18.5, .6, C.amber);
        } else if (type === 'server') {
          for (let k = 0; k < 6; k++) {
            lamp(3, 5.4, 7 + k * 5, .55, (Math.floor(t * 3) + k) % 5 ? hue : C.amber);
            L([-3, 5.4, 8 + k * 5], [k % 2 ? -1 : 1, 5.4, 8 + k * 5], k % 3 ? C.blue : hue);
          }
        } else if (type === 'pylon') {
          for (const h0 of [17, 30, 43]) {
            const pts = [[-6, -6, h0], [6, -6, h0], [6, 6, h0], [-6, 6, h0], [-6, -6, h0]];
            for (let i = 1; i < pts.length; i++) L(pts[i - 1], pts[i], hue);
          }
          lamp(0, 0, 58, 1.3, hue, 10);
        } else if (type === 'dish') {
          lamp(0, 19, 49, 1, hue, 6);
          if (Math.floor(t * 1.4) % 3) lamp(0, 0, 64, .9, C.amber, 4);
        } else if (type === 'transformer') {
          lamp(-8, 7.2, 17, .65, hue);
          L([6, 7.2, 16], [9, 7.2, 16], C.cyan);
        } else if (type === 'sign') {
          const center = P(0, 0, 43), label = String(prop.label || 'ORISON');
          const lines = label.includes('/') ? label.split('/').map(q => q.trim()) : label.split('\n');
          const maxW = ((Number(prop.width) || 46) - 7) * screenScale;
          const fontScale = Math.max(1, Math.min(3, Math.floor(maxW / Math.max(...lines.map(q => E.font.width(q))))));
          const lh = E.font.lineHeight({ scale: fontScale });
          const cy = center[1] - (lines.length * lh - 2) / 2;
          for (let k = 0; k < lines.length; k++) E.font.text(g, lines[k], center[0], cy + k * lh, k ? C.pale : hue, { align: 'center', scale: fontScale, outline: false });
          if (prop.sublabel && lines.length === 1) E.font.text(g, String(prop.sublabel), center[0], cy + lh + 1, C.pale, { align: 'center', font: 'tiny', outline: false });
          const a = P(0, 0, 43), ww = (Number(prop.width) || 46) * screenScale;
          px.line(g, a[0] - ww / 2 + 4, a[1] - 9 * screenScale + 2, a[0] + ww / 2 - 4, a[1] - 9 * screenScale + 2, hue);
        } else if (type === 'camera') {
          lamp(16.1, 0, 40, 1.15, prop.hostile ? C.red : hue, 5);
        } else if (type === 'drone') {
          const hover = 23 + (prop.reducedMotion ? 0 : Math.sin(t * 1.4) * 1.3);
          lamp(0, 5.2, hover - 4, 1.15, prop.hostile ? C.red : hue, 5);
          lamp(-12, 0, hover + 2, .6, hue);
          lamp(12, 0, hover + 2, .6, hue);
        } else if (type === 'bollard') {
          L([-2, 3.1, 14], [2, 3.1, 14], hue, 1.2);
        } else if (type === 'antenna' && Math.floor(t * 1.1) % 3) {
          lamp(0, 0, 70, .8, C.amber, 5);
        }
      }, { emissive: true, noInfo: false, bias: (prop.bias || 0) + .004 });
      if (prop.light !== false && ['console', 'server', 'pylon', 'sign'].includes(type)) {
        const radius = type === 'pylon' ? 46 : type === 'sign' ? 39 : 28;
        if (r.game.lights.list.length < 12) r.game.lights.add(x, y, z + (type === 'sign' ? 43 * s : h * .6), radius * s, type === 'pylon' ? .32 : .2, { color: hue });
      }
    }
    if (type === 'drone') r.shadow(x, y, 9 * s, .24, C.shadow, z);
    return true;
  }

  function drawDecor(r, decorArray, time = 0) {
    let visible = 0;
    for (const p of decorArray || []) if (drawProp(r, p, time)) visible++;
    return visible;
  }

  function rain(r, time = 0, reducedMotion = false) {
    if (reducedMotion) return;
    r.overlay(g => {
      const W = r.W, H = r.H;
      px.blend(g, .25, 'normal', () => {
        const count = Math.min(74, Math.floor(W * H / 5000));
        for (let i = 0; i < count; i++) {
          const seed = E.hash2(i, 713), speed = 60 + seed * 80;
          const yy = (E.hash2(i, 91) * (H + 20) + time * speed) % (H + 20) - 10;
          const xx = (E.hash2(i, 319) * (W + 35) + time * speed * .16) % (W + 35) - 15;
          px.line(g, xx, yy, xx + 1, yy + 4 + Math.floor(seed * 4), i % 4 ? '#6e96a7' : '#b0c4cc');
        }
      });
    });
  }

  function waypoint(r, x, y, label = '', time = 0, options = {}) {
    const z = options.z || 0, color = options.color || C.cyan;
    const motion = options.reducedMotion ? 0 : Math.sin(time * 2.6) * 1.5;
    r.decal(() => {
      const rad = 8 + (options.reducedMotion ? 0 : (Math.sin(time * 2) + 1) * .5);
      r.groundRing(x, y, rad, color, .6, z);
    });
    r.queue(x, y, z + 1, g => {
      const a = r.w(x, y, z + 8 + motion), sc = r.view.scale;
      px.glow(g, 1);
      px.poly(g, [[a[0] - 3 * sc, a[1] - 3 * sc], [a[0] + 3 * sc, a[1] - 3 * sc], [a[0], a[1]]], color);
    }, { emissive: true, bias: .1 });
    if (label) r.overlay(g => {
      const a = r.w(x, y, z + 15 + motion);
      if (a[0] < 15 || a[0] > r.W - 15 || a[1] < 12 || a[1] > r.H - 20) return;
      const text = String(label).toUpperCase(), width = E.font.width(text) + 10;
      px.blend(g, .875, 'normal', () => px.rect(g, a[0] - width / 2, a[1] - 9, width, 12, C.ink));
      E.font.text(g, text, a[0], a[1] - 6, color, { align: 'center', outline: false });
    });
  }

  root.VeilArt = Object.freeze({ drawProp, drawDecor, rain, waypoint, colors: C,
    types: Object.freeze(Object.keys(HEIGHTS)), version: '1.0.0' });
})(window);
