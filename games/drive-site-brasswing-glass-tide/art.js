/* BRASSWING · Operation Glass Tide
 * Original procedural pixel art. Requires My3D2dge before this script.
 * All coordinates are sprite centers; background fills W × H. Time is seconds,
 * scroll is world pixels. Scales are rasterized to whole screen pixels.
 * background / player / enemy / miniboss / boss / portrait are stateless draws.
 * Static scenery is cached in small repeating Canvas layers; animations never
 * use randomness. No images, fonts, gradients, paths, or external dependencies.
 */
(() => {
  'use strict';
  const E = window.My3D2dge;
  if (!E || !E.px) throw new Error('BRASSWING art requires My3D2dge.');
  const px = E.px;
  const C = Object.freeze({
    ink: '#102a39', deep: '#173747', shade: '#294958', steel: '#527381',
    steelLight: '#839c9e', silver: '#b8c0ac', ivory: '#ede0b7', cream: '#fff1c8',
    brassDark: '#8a6341', brass: '#bd914e', gold: '#e5b965', paleGold: '#ffe3a0',
    tealDark: '#28545f', teal: '#3d8890', glass: '#78c7bd', glassLight: '#c4e8cd',
    coralDark: '#8d4951', coral: '#d97462', coralLight: '#efa078', hot: '#ffce83',
    red: '#ed6754', smoke: '#53656d'
  });
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mod = (v, n) => ((v % n) + n) % n;
  const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const R = (g, x, y, w, h, c) => px.rect(g, Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), c);
  const L = (g, x0, y0, x1, y1, c, w = 1) => px.line(g, x0, y0, x1, y1, c, Math.max(1, Math.round(w)));
  const P = (g, pts, c) => px.poly(g, pts, c);

  // A point transform, rather than Canvas rotation, keeps angled sprites crisp.
  function pen(g, x, y, scale = 1, angle = 0, flash = false) {
    const s = Math.max(.25, Number(scale) || 1), ca = Math.cos(angle), sa = Math.sin(angle);
    const point = (a, b) => [Math.round(x + (a * ca - b * sa) * s), Math.round(y + (a * sa + b * ca) * s)];
    const col = c => flash && c !== C.ink && c !== C.deep ? C.cream : c;
    const poly = (pts, c) => P(g, pts.map(q => point(q[0], q[1])), col(c));
    const rect = (a, b, w, h, c) => {
      if (Math.abs(sa) < .001 && ca > 0) {
        const q = point(a, b); R(g, q[0], q[1], w * s, h * s, col(c));
      } else poly([[a, b], [a + w, b], [a + w, b + h], [a, b + h]], c);
    };
    return {
      r: rect, p: poly,
      l: (a, b, c, d, color, w = 1) => { const q = point(a, b), v = point(c, d); L(g, q[0], q[1], v[0], v[1], col(color), w * s); },
      d: (a, b, radius, color) => { const q = point(a, b); px.disc(g, q[0], q[1], Math.max(.5, radius * s), col(color)); },
      e: (a, b, rx, ry, color) => { const q = point(a, b); px.ell(g, q[0], q[1], rx * s, ry * s, col(color)); },
      dot: (a, b, color) => rect(a, b, 1, 1, color)
    };
  }

  function exhaust(p, x, y, time, size = 1, dir = -1, hot = false) {
    const pulse = [0, 3, 1, 4][mod(Math.floor(time * 19), 4)];
    const len = (10 + pulse) * size, h = 3 * size;
    p.p([[x, y - h], [x + dir * (len - 3), y - size], [x + dir * (len + 3), y], [x + dir * (len - 4), y + 2 * size], [x, y + h]], hot ? C.coral : C.teal);
    p.p([[x, y - 2 * size], [x + dir * len, y], [x, y + 2 * size]], hot ? C.gold : C.glass);
    p.r(dir < 0 ? x - 4 * size : x, y - size, 4 * size, 2 * size, C.cream);
    if (pulse > 2) p.r(x + dir * (len + 6), y, 2 * size, size, hot ? C.coralLight : C.glass);
  }

  function player(g, x, y, { time = 0, bank = 0, frame = 'kite', thrust = true, hit = false, scale = 1 } = {}) {
    const p = pen(g, x, y, scale, 0, hit);
    const b = Math.round(clamp(bank, -1, 1) * 4);
    const needle = frame === 'needle' || frame === 'swift';
    const manta = frame === 'manta' || frame === 'heavy';
    const wing = manta ? C.teal : needle ? C.coral : C.brass;
    const wingHi = manta ? C.glass : needle ? C.coralLight : C.gold;
    const wingDark = manta ? C.tealDark : needle ? C.coralDark : C.brassDark;
    if (thrust) {
      if (manta) { exhaust(p, -22, -4, time, .8, -1, true); exhaust(p, -22, 4, time + .17, .8, -1, true); }
      else exhaust(p, -23, 1, time, needle ? .8 : 1, -1, true);
    }
    // Far wing and stabilizer, then a sculpted fuselage, then the near wing.
    p.p([[-23, -5], [-16, -6], [-19, -12 + b], [-13, -13 + b], [-1, -5], [10, -4], [12, 2], [-18, 6], [-25, 4]], C.ink);
    p.p([[-17, -6], [-17, -11 + b], [-13, -11 + b], [-5, -4], [-12, 0]], wingDark);
    p.l(-16, -11 + b, -6, -4, wingHi);
    p.r(-21, -4, 6, 8, C.steel);
    p.r(-24, -2, 3, 6, C.deep);
    p.r(-23, -2, 1, 5, C.silver);
    if (manta) {
      p.p([[-17, -4], [-12, -17 + b], [-4, -16 + b], [6, -3], [7, 3], [-4, 16 + b], [-14, 17 + b], [-17, 5]], C.ink);
      p.p([[-14, -4], [-10, -15 + b], [-5, -14 + b], [4, -3]], wingDark);
      p.l(-10, -15 + b, -5, -14 + b, wingHi, 2);
    }
    p.p([[-21, -4], [-3, -5], [3, -8], [11, -7], [22, -3], [28, 0], [27, 3], [14, 7], [-17, 6], [-23, 3]], C.ink);
    p.p([[-20, -3], [-4, -4], [4, -6], [13, -5], [25, 0], [22, 3], [-17, 4], [-21, 2]], C.ivory);
    p.p([[-17, 2], [17, 1], [24, 2], [13, 5], [-17, 5]], C.steel);
    p.l(-17, -3, -4, -4, C.cream);
    p.r(-14, -2, 3, 4, wingDark);
    p.r(-10, -2, 1, 4, C.silver);
    p.p([[0, -4], [4, -7], [10, -6], [15, -3], [13, 0], [0, 0]], C.deep);
    p.p([[2, -4], [5, -6], [10, -5], [12, -3], [11, -1], [2, -1]], C.teal);
    p.l(4, -5, 9, -5, C.glassLight);
    p.l(10, -4, 12, -3, C.glass);
    p.r(7, -5, 1, 4, C.tealDark);
    p.p([[15, -3], [24, -1], [26, 1], [18, 2], [16, 0]], C.cream);
    p.r(21, 2, 3, 1, C.coral);
    const bottom = (manta ? 17 : needle ? 10 : 13) + b;
    p.p([[-13, 0], [-6, -1], [needle ? 14 : 10, bottom - 3], [-4, bottom + 1], [-13, 5]], C.ink);
    p.p([[-12, 1], [-6, 0], [7, bottom - 3], [-4, bottom - 1], [-11, 5]], wing);
    p.p([[-11, 5], [-4, bottom - 1], [5, bottom - 2], [-6, 4]], wingDark);
    p.l(-6, 1, 7, bottom - 3, wingHi);
    p.l(-9, 1, -2, bottom - 3, wingHi);
    p.p([[1, bottom - 4], [5, bottom - 4], [7, bottom - 3], [2, bottom - 2]], C.ivory);
    p.l(-6, 5, -3, 8, C.cream);
    p.l(-4, 5, -1, 8, C.cream);
    p.r(-18, 4, 5, 2, C.coral);
    p.r(-19, -9 + b, 3, 2, C.coral);
    p.r(-3, -1, 3, 2, C.silver);
    p.r(4, 4, 8, 1, C.deep);
    p.dot(14, 3, C.paleGold);
  }

  function scout(p, time) {
    exhaust(p, 14, 1, time, .65, 1);
    p.p([[-19, 0], [-10, -5], [-1, -5], [5, -11], [12, -11], [9, -3], [16, -2], [17, 4], [9, 5], [12, 12], [5, 11], [-2, 6], [-11, 5]], C.ink);
    p.p([[-17, 0], [-9, -4], [2, -3], [13, -1], [13, 3], [-8, 4]], C.coral);
    p.p([[-13, 2], [12, 1], [13, 4], [-8, 4]], C.coralDark);
    p.p([[0, -4], [6, -9], [10, -9], [7, -3]], C.steel);
    p.p([[0, 4], [6, 10], [9, 10], [6, 4]], C.steel);
    p.l(3, -5, 6, -8, C.steelLight);
    p.p([[-10, -2], [-4, -3], [-1, -1], [-1, 1], [-10, 1]], C.deep);
    p.r(-9, -2, 5, 1, C.glass);
    p.r(3, 0, 6, 1, C.coralLight);
    p.r(12, -1, 3, 4, C.silver);
    p.r(-18, 0, 3, 2, C.ivory);
    p.dot(7, 7, C.gold);
  }
  function interceptor(p, time) {
    exhaust(p, 19, -5, time, .6, 1);
    exhaust(p, 19, 6, time + .1, .6, 1);
    p.p([[-25, 1], [-12, -4], [-1, -5], [8, -15], [16, -15], [12, -5], [21, -6], [22, -1], [17, 2], [22, 6], [19, 11], [11, 7], [17, 16], [7, 15], [-3, 7], [-12, 6]], C.ink);
    p.p([[-2, -4], [9, -13], [14, -13], [9, -3]], C.coral);
    p.l(8, -12, 12, -12, C.coralLight);
    p.p([[-4, 4], [9, 13], [14, 14], [9, 4]], C.coralDark);
    p.p([[-23, 1], [-10, -3], [5, -3], [15, 0], [13, 4], [-10, 5]], C.steel);
    p.l(-13, -2, 6, -2, C.steelLight);
    p.p([[-13, 0], [-8, -2], [-2, -1], [0, 1], [-10, 2]], C.glass);
    p.r(-9, -1, 4, 1, C.glassLight);
    p.r(11, -6, 9, 4, C.deep);
    p.r(11, 5, 9, 4, C.deep);
    p.r(13, -6, 5, 1, C.silver);
    p.r(13, 5, 5, 1, C.silver);
    p.r(-24, 1, 5, 1, C.ivory);
    p.r(2, 1, 5, 2, C.coral);
    p.l(2, 6, 8, 11, C.coralLight);
  }
  function bomber(p, time) {
    exhaust(p, 26, -10, time, 1, 1, true);
    exhaust(p, 26, 11, time + .1, 1, 1, true);
    p.p([[-30, -2], [-21, -8], [-5, -8], [3, -18], [18, -18], [20, -14], [28, -14], [29, -5], [24, 0], [28, 6], [28, 16], [17, 16], [14, 20], [-2, 17], [-9, 10], [-23, 8], [-30, 3]], C.ink);
    p.p([[-6, -6], [4, -16], [17, -16], [17, -9], [12, -2]], C.steel);
    p.p([[-8, 7], [1, 15], [14, 17], [16, 10], [8, 3]], C.steel);
    p.l(3, -15, 15, -15, C.steelLight);
    p.p([[-28, -1], [-19, -6], [-2, -6], [16, -2], [16, 5], [-17, 7], [-28, 3]], C.silver);
    p.p([[-26, 3], [-10, 3], [-3, 6], [-18, 6]], C.steel);
    p.p([[-23, -1], [-17, -4], [-8, -4], [-5, -1], [-7, 2], [-22, 2]], C.deep);
    p.r(-19, -3, 9, 2, C.teal);
    p.r(-18, -3, 5, 1, C.glass);
    p.r(-15, -3, 1, 5, C.deep);
    for (const yy of [-12, 9]) {
      p.p([[13, yy - 2], [25, yy - 2], [27, yy], [26, yy + 6], [12, yy + 6], [10, yy + 3]], C.coralDark);
      p.r(15, yy - 1, 9, 2, C.coral);
      p.r(23, yy, 4, 5, C.deep);
      p.r(24, yy, 1, 5, C.steelLight);
    }
    for (let i = 0; i < 3; i++) { p.r(-4 + i * 5, 5, 3, 7, C.ink); p.r(-4 + i * 5, 6, 2, 4, C.brass); p.r(-4 + i * 5, 6, 2, 1, C.gold); }
    p.r(-27, 0, 4, 2, C.cream);
    p.r(0, -4, 6, 2, C.coral);
    p.dot(6, -12, C.ivory);
    p.dot(8, -12, C.ivory);
  }
  function turret(p, time, angle = 0) {
    p.p([[-16, 8], [-11, 3], [-9, -4], [8, -5], [13, 3], [17, 8], [17, 13], [-16, 13]], C.ink);
    p.p([[-13, 8], [-9, 4], [10, 4], [14, 9], [12, 11], [-13, 11]], C.steel);
    p.r(-9, 11, 20, 2, C.deep);
    p.p([[-10, 1], [-7, -8], [5, -9], [11, -3], [10, 5], [-9, 5]], C.steelLight);
    p.p([[-9, 1], [10, 0], [9, 5], [-9, 5]], C.steel);
    p.r(-3, -7, 7, 2, C.coral);
    const bx = -Math.cos(angle) * 22, by = -Math.sin(angle) * 22 - 2;
    p.l(-3, -2, bx, by, C.ink, 6);
    p.l(-3, -3, bx, by - 1, C.steelLight, 3);
    p.l(bx + Math.cos(angle) * 3, by, bx, by, C.deep, 5);
    p.d(-2, -2, 4, C.deep); p.d(-2, -2, 2, C.brass);
    p.r(6, 1, 3, 2, Math.sin(time * 4) > 0 ? C.coralLight : C.coralDark);
    for (const xx of [-10, -2, 6]) p.r(xx, 9, 3, 1, C.silver);
  }
  function missileBoat(p, time) {
    p.p([[-31, 3], [-22, 13], [19, 13], [31, 4], [28, 0], [-23, 0]], C.ink);
    p.p([[-27, 4], [-20, 10], [18, 10], [27, 4]], C.steel);
    p.l(-25, 3, 26, 3, C.steelLight);
    p.r(-19, 7, 34, 2, C.coralDark);
    p.r(7, -10, 13, 11, C.steel);
    p.r(9, -9, 9, 2, C.glass);
    p.r(13, -9, 1, 4, C.deep);
    p.r(15, -17, 1, 7, C.ink);
    p.l(11, -16, 20, -16, C.steelLight);
    p.r(14, -18, 3, 2, Math.sin(time * 3) > 0 ? C.coral : C.coralDark);
    for (let i = 0; i < 3; i++) {
      const xx = -14 + i * 7;
      p.p([[xx, 0], [xx - 6, -10], [xx - 4, -14], [xx - 1, -13], [xx + 6, -1]], C.ink);
      p.l(xx - 4, -10, xx + 2, -1, C.ivory, 3);
      p.l(xx - 4, -10, xx - 2, -7, C.coral, 3);
      p.r(xx, -2, 5, 3, C.steel);
    }
    p.r(-29, 14, 22, 1, '#91b1ae'); p.r(9, 14, 25, 1, '#668c94');
    p.r(30 + mod(Math.floor(time * 8), 3), 10, 8, 1, '#759a9c');
  }
  function mine(p, time) {
    const a0 = Math.floor(time * 5) * .08;
    for (let i = 0; i < 8; i++) {
      const a = i * TAU / 8 + a0;
      p.l(Math.cos(a) * 6, Math.sin(a) * 6, Math.cos(a) * 12, Math.sin(a) * 12, C.ink, 3);
      p.d(Math.cos(a) * 11, Math.sin(a) * 11, 1, C.steelLight);
    }
    p.d(0, 0, 9, C.ink); p.d(0, 0, 7, C.steel); p.d(-1, -1, 5, C.deep);
    p.l(-5, -5, -2, -6, C.silver);
    p.d(0, 0, 3, C.coralDark); p.d(0, 0, Math.sin(time * 6) > 0 ? 2 : 1, C.coralLight);
    p.dot(-1, -1, C.cream);
  }
  function enemy(g, type, x, y, { time = 0, flash = false, angle = 0 } = {}) {
    const ground = type === 'turret' || type === 'missileBoat';
    const p = pen(g, x, y, 1, ground ? 0 : angle, flash);
    if (type === 'interceptor') interceptor(p, time);
    else if (type === 'bomber') bomber(p, time);
    else if (type === 'turret') turret(p, time, angle);
    else if (type === 'missileBoat') missileBoat(p, time);
    else if (type === 'mine') mine(p, time);
    else scout(p, time);
  }

  function rivets(p, x, y, n, step = 7, color = C.steelLight) {
    for (let i = 0; i < n; i++) p.dot(x + i * step, y, color);
  }
  function vents(p, x, y, n, color = C.deep, vertical = false) {
    for (let i = 0; i < n; i++) p.r(x + (vertical ? 0 : i * 4), y + (vertical ? i * 4 : 0), vertical ? 7 : 2, vertical ? 2 : 6, color);
  }
  function damageSmoke(p, x, y, time, offset = 0) {
    for (let k = 0; k < 4; k++) {
      const q = mod(time * 10 + k * 6 + offset, 25), xx = x + q * .45, yy = y - q;
      p.r(xx, yy, 4 + k % 2 * 2, 3 + k % 3, k % 2 ? C.smoke : C.shade);
    }
    p.p([[x - 3, y + 2], [x - 1, y - 8 - Math.floor(mod(time * 8, 3))], [x + 2, y - 3], [x + 5, y - 5], [x + 4, y + 2]], C.coral);
    p.r(x, y - 3, 2, 5, C.hot);
  }
  function miniboss(g, x, y, { time = 0, hit = false, hp = 1 } = {}) {
    const p = pen(g, x, y, 1, 0, hit);
    exhaust(p, 63, -10, time, 1.5, 1, true);
    exhaust(p, 66, 10, time + .08, 1.6, 1, true);
    p.p([[-72, -3], [-56, -15], [-27, -19], [-13, -27], [21, -25], [32, -35], [48, -35], [55, -23], [65, -20], [70, -9], [68, 15], [52, 22], [10, 22], [-3, 32], [-35, 29], [-46, 17], [-65, 11]], C.ink);
    p.p([[-68, -3], [-52, -12], [-28, -15], [28, -15], [40, -24], [58, -19], [65, -9], [64, 12], [48, 18], [-30, 16], [-58, 7]], C.steel);
    p.p([[-28, 2], [64, 1], [64, 12], [48, 18], [-30, 16], [-48, 10]], C.shade);
    p.p([[-68, -3], [-50, -12], [-31, -14], [-33, -4], [-53, 4], [-59, 6]], C.ivory);
    p.l(-60, -5, -36, -12, C.cream);
    p.p([[-32, -17], [-13, -24], [18, -22], [25, -15]], C.coralDark);
    p.l(-22, -19, 18, -20, C.coral);
    p.p([[28, -16], [33, -32], [46, -32], [51, -22], [53, -16]], C.steelLight);
    p.p([[31, -25], [34, -29], [44, -29], [48, -24], [47, -22], [32, -22]], C.deep);
    p.r(34, -27, 9, 2, C.glass);
    p.r(37, -36, 2, 5, C.ink); p.r(38, -39, 1, 4, C.steelLight);
    p.r(36, -40, 5, 1, C.coral);
    p.p([[-32, 15], [-22, 25], [-3, 28], [5, 20]], C.coralDark);
    p.l(-23, 20, -7, 25, C.coral);
    p.r(-53, 8, 22, 9, C.ink); p.r(-50, 9, 19, 5, C.steelLight);
    p.r(-61, 10, 19, 4, C.deep); p.r(-61, 10, 17, 1, C.ivory);
    p.r(-40, -19, 17, 7, C.deep); p.r(-49, -18, 17, 3, C.steelLight);
    p.r(-49, -17, 3, 2, C.ink);
    p.p([[-21, -10], [8, -10], [13, -4], [8, 8], [-21, 8], [-26, 2]], C.deep);
    p.p([[-19, -8], [6, -8], [9, -3], [6, 5], [-18, 5], [-22, 1]], C.coralDark);
    p.l(-17, -6, 5, -6, C.coral);
    for (let i = 0; i < 5; i++) p.r(-17 + i * 5, -3, 2, 7, C.ink);
    p.r(-15, -3, 2, 2, C.gold); p.r(-5, -3, 2, 2, C.gold); p.r(5, -3, 2, 2, C.gold);
    p.r(19, -7, 15, 15, C.deep); p.r(21, -5, 11, 11, C.brassDark);
    p.r(24, -3, 5, 7, C.gold); p.r(25, -2, 3, 3, C.paleGold);
    p.l(36, -9, 55, -9, C.steelLight);
    vents(p, 40, -5, 5);
    p.r(58, -15, 8, 10, C.deep); p.r(60, -15, 2, 10, C.silver);
    p.r(59, 5, 8, 11, C.deep); p.r(61, 5, 2, 11, C.silver);
    rivets(p, -24, 12, 11, 7);
    rivets(p, -20, -13, 6, 7);
    if (hp < .66) { p.p([[15, 12], [19, 6], [28, 8], [24, 15]], C.ink); damageSmoke(p, 19, -17, time); }
    if (hp < .33) { p.r(44, 4, 8, 7, C.ink); damageSmoke(p, 44, 5, time, 9); }
  }

  function weaponPod(p, x, y, alive, time, bottom = false) {
    if (!alive) {
      p.p([[x - 18, y - 8], [x + 19, y - 8], [x + 12, y + 7], [x - 12, y + 10]], C.ink);
      p.r(x - 6, y - 6, 14, 9, C.shade);
      p.l(x - 12, y + 4, x - 4, y - 3, C.coralDark);
      p.r(x + 3, y - 3, 3, 5, C.brass);
      damageSmoke(p, x, y, time, bottom ? 6 : 0);
      return;
    }
    p.r(x - 10, y + (bottom ? -15 : 7), 25, 10, C.deep);
    p.p([[x - 22, y - 7], [x - 10, y - 12], [x + 15, y - 12], [x + 23, y - 5], [x + 20, y + 8], [x - 13, y + 10], [x - 23, y + 4]], C.ink);
    p.p([[x - 20, y - 5], [x - 9, y - 10], [x + 14, y - 10], [x + 20, y - 4], [x + 17, y + 5], [x - 12, y + 7], [x - 20, y + 2]], C.steel);
    p.p([[x - 17, y - 5], [x - 9, y - 9], [x + 13, y - 9], [x + 17, y - 5]], C.silver);
    p.r(x - 36, y - 3, 29, 8, C.ink);
    p.r(x - 36, y - 3, 27, 3, C.steelLight);
    p.r(x - 34, y + 1, 21, 2, C.steel);
    p.r(x - 39, y - 4, 6, 10, C.deep);
    p.r(x - 38, y - 3, 2, 7, C.coralDark);
    p.r(x - 12, y + 3, 15, 3, C.coralDark);
    p.r(x + 5, y - 3, 8, 7, C.deep);
    p.r(x + 7, y - 2, 4, 2, alive < .4 ? C.red : C.gold);
    p.l(x + 15, y - 2, x + 15, y + 4, C.steelLight);
    rivets(p, x - 8, y - 6, 3, 6, C.cream);
  }
  function iris(p, x, y, time, phase, open) {
    p.d(x, y, 24, C.ink);
    p.d(x, y, 22, C.brassDark);
    p.d(x, y, 20, C.gold);
    p.d(x, y, 17, C.deep);
    p.l(x - 13, y - 17, x + 6, y - 20, C.paleGold, 2);
    for (let i = 0; i < 8; i++) {
      const a = i * TAU / 8, dx = Math.cos(a), dy = Math.sin(a);
      p.r(x + dx * 21 - 1, y + dy * 21 - 1, 2, 2, C.silver);
      p.l(x + dx * 17, y + dy * 17, x + dx * 19, y + dy * 19, C.ink, 2);
    }
    if (open) {
      p.d(x, y, 14, phase > 1 ? C.coralDark : C.tealDark);
      p.d(x, y, 11, phase > 1 ? C.coral : C.teal);
      p.d(x, y, 8, C.gold); p.d(x, y, 5, C.paleGold); p.d(x - 1, y - 1, 3, C.cream);
      const a0 = Math.floor(time * 8) * .12;
      for (let i = 0; i < 6; i++) {
        const a = a0 + i * TAU / 6;
        p.l(x + Math.cos(a) * 10, y + Math.sin(a) * 10, x + Math.cos(a) * 15, y + Math.sin(a) * 15, C.glassLight, 2);
      }
    } else {
      const a0 = Math.floor(time * 2) * .025;
      for (let i = 0; i < 6; i++) {
        const a = i * TAU / 6 + a0;
        const v = (r, q) => [x + Math.cos(a + q) * r, y + Math.sin(a + q) * r];
        p.p([v(3, .45), v(15, -.1), v(17, .7), v(10, 1.2)], i % 2 ? C.steel : C.steelLight);
        const u = v(14, 0), w = v(4, .4); p.l(u[0], u[1], w[0], w[1], C.silver);
      }
      p.d(x, y, 4, C.ink); p.d(x, y, 2, phase > 1 ? C.coral : C.glass);
    }
    p.r(x - 8, y + 23, 16, 3, C.ink);
    for (let i = 0; i < 5; i++) p.r(x - 7 + i * 3, y + 24, 2, 1, open ? C.hot : C.coralDark);
  }
  function boss(g, x, y, { time = 0, phase = 1, hit = false, upper = 1, lower = 1, coreOpen = false } = {}) {
    const p = pen(g, x, y, 1, 0, hit);
    const hot = phase > 1;
    for (const yy of [-19, 3, 25]) exhaust(p, 93, yy, time + yy * .01, hot ? 2.1 : 1.65, 1, hot);
    // The command bridge rises aft; the keel and forward armor are unequal.
    p.p([[-102, -5], [-83, -25], [-43, -29], [-26, -40], [5, -41], [17, -56], [45, -56], [55, -42], [73, -43], [91, -29], [99, -19], [102, 31], [78, 40], [22, 44], [4, 61], [-26, 57], [-43, 33], [-80, 29], [-99, 16]], C.ink);
    p.p([[-97, -4], [-81, -21], [-43, -25], [-22, -35], [13, -34], [24, -45], [45, -46], [55, -36], [72, -37], [86, -26], [94, -17], [96, 27], [77, 35], [15, 37], [-37, 27], [-79, 24], [-95, 14]], C.steel);
    p.p([[-91, 8], [-46, 2], [17, 12], [94, 11], [96, 27], [77, 35], [15, 37], [-37, 27], [-79, 24]], C.shade);
    p.p([[-98, -3], [-80, -21], [-55, -24], [-58, -12], [-79, -2], [-85, 15], [-95, 13]], C.ivory);
    p.l(-91, -4, -78, -18, C.cream, 2);
    p.l(-77, -20, -59, -22, C.cream);
    p.p([[-95, 15], [-84, 5], [-71, 11], [-57, 14], [-59, 22], [-78, 23]], C.steelLight);
    p.p([[-51, -23], [-27, -34], [8, -33], [0, -25]], C.silver);
    p.l(-38, -28, -23, -32, C.cream);
    p.p([[16, -36], [22, -52], [43, -52], [51, -39], [51, -29], [20, -28]], C.shade);
    p.p([[21, -43], [25, -49], [40, -49], [46, -42], [44, -37], [21, -37]], C.deep);
    p.r(25, -46, 16, 3, C.teal); p.r(26, -46, 13, 1, C.glass);
    p.r(30, -46, 1, 7, C.steel); p.r(37, -46, 1, 7, C.steel);
    p.r(28, -59, 2, 7, C.ink); p.r(29, -66, 1, 8, C.steelLight);
    p.l(23, -62, 37, -62, C.ink); p.l(27, -64, 33, -64, C.steelLight);
    p.r(28, -66, 3, 2, hot ? C.coral : C.gold);
    p.r(43, -59, 1, 8, C.ink); p.r(40, -58, 7, 1, C.steelLight);
    p.p([[4, 34], [18, 39], [2, 56], [-23, 52], [-33, 35]], C.coralDark);
    p.p([[-23, 35], [-1, 37], [8, 42], [0, 48], [-17, 46]], C.coral);
    p.l(-20, 35, 0, 38, C.coralLight);
    p.r(31, -26, 42, 7, C.deep); p.r(33, -25, 38, 2, C.silver);
    p.r(34, -21, 5, 2, C.glass); p.r(43, -21, 5, 2, C.glass); p.r(52, -21, 5, 2, C.glass);
    p.p([[24, -12], [40, -17], [71, -16], [80, -7], [80, 19], [66, 27], [28, 25]], C.deep);
    p.p([[29, -9], [41, -13], [68, -12], [74, -6], [74, 15], [64, 20], [30, 19]], C.steel);
    p.r(36, -8, 25, 3, C.silver);
    p.r(37, -3, 30, 14, C.ink);
    vents(p, 39, -1, 7, hot ? C.coralDark : C.tealDark);
    for (let i = 0; i < 7; i++) p.r(39 + i * 4, 1, 2, 2, hot ? C.coral : C.teal);
    p.r(34, 15, 25, 2, C.coralDark);
    p.r(37, 15, 4, 2, C.coral); p.r(47, 15, 4, 2, C.coral);
    p.l(18, -16, 20, 24, C.deep, 2);
    p.l(22, -13, 23, 19, C.steelLight);
    p.r(80, -26, 12, 16, C.deep); p.r(82, -25, 3, 14, C.silver);
    p.r(83, -5, 12, 16, C.deep); p.r(85, -4, 3, 14, C.silver);
    p.r(82, 17, 13, 16, C.deep); p.r(84, 18, 3, 13, C.silver);
    p.r(89, -24, 4, 12, C.shade); p.r(92, -2, 4, 11, C.shade); p.r(92, 20, 3, 10, C.shade);
    p.r(-63, -11, 13, 15, C.deep);
    p.r(-61, -9, 9, 3, C.coralDark); p.r(-61, -3, 9, 3, C.coralDark);
    p.r(-62, 12, 12, 6, C.deep); p.r(-61, 12, 10, 1, C.silver);
    p.r(-85, -1, 3, 3, C.deep); p.r(-82, -6, 3, 3, C.deep);
    rivets(p, -51, -20, 7, 9); rivets(p, -45, 23, 7, 8); rivets(p, 29, 30, 6, 9);
    p.p([[-12, -25], [1, -28], [7, -25], [-6, -22]], C.brass);
    p.l(-7, -25, -3, -25, C.paleGold);
    iris(p, -22, 2, time, phase, coreOpen);
    weaponPod(p, -40, -42, upper, time, false);
    weaponPod(p, -30, 46, lower, time + .13, true);
    if (hot) {
      p.r(66, -30, 3, 5, C.coral); p.r(71, -27, 3, 4, C.coral);
      if (phase > 2) damageSmoke(p, 59, -34, time, 13);
    }
  }

  function portrait(g, x, y, { pilot = 0, scale = 1 } = {}) {
    const p = pen(g, x, y, scale), who = mod(Math.floor(pilot), 3);
    const skin = [C.coralLight, '#b97859', '#e8b984'][who];
    const shadow = ['#b16f59', '#835647', '#b48364'][who];
    const trim = [C.brass, C.coral, C.teal][who];
    p.r(-18, -20, 36, 40, C.ink); p.r(-17, -19, 34, 38, C.steel);
    p.r(-16, -18, 32, 36, C.deep);
    p.p([[-16, 3], [10, -18], [15, -18], [15, 3], [-4, 18], [-16, 18]], C.tealDark);
    p.r(-14, -15, 1, 6, C.steel); p.r(-13, -16, 6, 1, C.steel);
    p.p([[-15, 18], [-13, 11], [-6, 7], [6, 7], [13, 11], [15, 18]], C.ink);
    p.p([[-13, 18], [-11, 12], [-4, 9], [5, 9], [11, 12], [13, 18]], trim);
    p.r(-4, 5, 8, 8, shadow); p.r(-2, 6, 5, 6, skin);
    p.p([[-11, -8], [-8, -14], [4, -15], [10, -10], [11, 1], [6, 9], [-3, 10], [-10, 5]], C.ink);
    p.p([[-8, -6], [-5, -11], [5, -11], [9, -7], [9, 2], [5, 7], [-2, 8], [-7, 3]], skin);
    p.p([[5, -8], [9, -6], [9, 2], [5, 7], [-1, 8], [0, 5], [5, 3]], shadow);
    if (who === 0) {
      p.p([[-11, -6], [-9, -13], [-4, -16], [5, -16], [10, -11], [10, -6], [5, -8], [-3, -10], [-7, -4]], C.steel);
      p.l(-6, -14, 3, -15, C.ivory, 2);
      p.r(-1, -14, 3, 5, trim); p.r(-11, -5, 4, 9, C.ink); p.r(-10, -4, 3, 6, C.coral);
      p.r(-5, -3, 4, 1, C.ink); p.r(4, -3, 3, 1, C.ink);
      p.r(-4, -2, 2, 1, C.cream); p.r(5, -2, 1, 1, C.cream);
      p.r(1, 0, 2, 2, shadow); p.r(1, 4, 4, 1, C.coralDark);
      p.l(-8, 3, -3, 6, C.ink); p.r(-3, 5, 4, 2, C.ink);
    } else if (who === 1) {
      p.p([[-10, -6], [-8, -13], [-3, -16], [6, -14], [10, -9], [9, -6], [4, -10], [-2, -10]], C.ink);
      p.r(-8, -12, 12, 2, C.steel);
      p.r(-7, -4, 7, 4, C.ink); p.r(2, -4, 7, 4, C.ink); p.r(0, -3, 2, 1, C.steel);
      p.r(-6, -3, 4, 1, C.glass); p.r(3, -3, 4, 1, C.glass);
      p.p([[-6, 3], [-1, 5], [4, 3], [8, 1], [5, 7], [-1, 9], [-5, 6]], C.ink);
      p.r(-1, 3, 4, 1, skin); p.r(-12, -3, 4, 7, C.coralDark);
      p.r(10, -4, 2, 5, C.steelLight);
    } else {
      p.p([[-10, -5], [-10, -12], [-5, -16], [5, -16], [11, -11], [10, -5], [6, -7], [3, -11], [-2, -9], [-5, -4]], C.brassDark);
      p.l(-7, -12, 1, -14, C.gold, 2); p.l(3, -14, 7, -11, C.gold, 2);
      p.r(-9, -10, 18, 3, C.deep); p.r(-7, -10, 6, 2, C.glass); p.r(2, -10, 6, 2, C.glass);
      p.r(-5, -3, 4, 1, C.ink); p.r(3, -3, 4, 1, C.ink);
      p.r(-4, -2, 1, 1, C.cream); p.r(4, -2, 1, 1, C.cream);
      p.r(1, 0, 2, 2, shadow); p.r(0, 4, 5, 1, C.coralDark);
      p.r(-10, -3, 3, 7, C.teal); p.r(-9, -2, 1, 3, C.glass);
    }
    p.p([[-6, 9], [-1, 12], [-4, 17], [-9, 11]], C.ivory);
    p.p([[5, 9], [1, 12], [4, 17], [9, 12]], C.ivory);
    p.r(-2, 14, 4, 4, C.deep); p.r(-12, 14, 3, 1, C.gold);
    p.r(-16, 17, 32, 1, trim);
  }

  // BACKDROP --------------------------------------------------------------
  const cache = new Map(), TILE = 1536;
  function canvas(w, h) {
    let cv;
    if (typeof OffscreenCanvas !== 'undefined') cv = new OffscreenCanvas(w, h);
    else if (typeof document !== 'undefined') { cv = document.createElement('canvas'); cv.width = w; cv.height = h; }
    else return null;
    return cv;
  }
  function sceneryPen(g, H) { return pen(g, 0, 0, H / 360); }
  function cloud(p, x, y, width, seed, lit, mid, shade) {
    const k = width / 100;
    p.p([[x, y + 8], [x + 7 * k, y + 4], [x + 19 * k, y + 4], [x + 23 * k, y], [x + 43 * k, y], [x + 48 * k, y - 3], [x + 62 * k, y - 3], [x + 69 * k, y + 1], [x + 87 * k, y + 1], [x + 91 * k, y + 5], [x + 103 * k, y + 5], [x + 111 * k, y + 10], [x + 99 * k, y + 13], [x + 16 * k, y + 13]], mid);
    p.r(x + 26 * k, y, 18 * k, 2, lit); p.r(x + 48 * k, y - 3, 14 * k, 2, lit);
    p.r(x + 3 * k, y + 8, 31 * k, 2, shade); p.r(x + 35 * k, y + 11, 56 * k, 2, shade);
    p.r(x + 69 * k, y + 4, 20 * k, 1, lit);
    p.r(x - 17 * k, y + 13, 33 * k, 1, shade);
    p.r(x + 80 * k, y + 15, 37 * k, 1, shade);
    if (seed % 2) p.r(x + 13 * k, y + 18, 69 * k, 1, shade);
  }
  function crane(p, x, y, h, color, hi, facing = 1) {
    p.r(x, y - h, 3, h, color);
    p.l(x + 1, y - h + 5, x + facing * 40, y - h + 5, color, 3);
    p.l(x + 1, y - h + 5, x + facing * 24, y - h + 17, color);
    p.l(x + 1, y - h + 7, x + facing * 22, y - h + 7, hi);
    p.l(x + facing * 34, y - h + 5, x + facing * 34, y - 12, color);
    p.r(x + facing * 34 - 2, y - 13, 5, 3, color);
    p.r(x - 4, y - 3, 11, 3, color);
    p.r(x - 5, y - h + 7, 11, 7, color);
  }
  function island(p, x, y, w, h, seed, colors) {
    const [top, face, dark, light] = colors;
    const pts = [[x - 12, y + 10], [x + w * .04, y - h * .27], [x + w * .18, y - h * .32], [x + w * .25, y - h * .76], [x + w * .43, y - h], [x + w * .59, y - h * .87], [x + w * .67, y - h * .43], [x + w * .86, y - h * .38], [x + w, y + 4], [x + w * .88, y + 15], [x + w * .31, y + 18]];
    p.p(pts, face);
    p.p([[x + w * .18, y - h * .3], [x + w * .25, y - h * .73], [x + w * .43, y - h], [x + w * .58, y - h * .86], [x + w * .51, y - h * .7], [x + w * .34, y - h * .68], [x + w * .26, y - h * .2]], top);
    p.p([[x + w * .43, y - h], [x + w * .51, y - h * .7], [x + w * .47, y + 14], [x + w * .28, y + 14], [x + w * .33, y - h * .64]], dark);
    p.p([[x + w * .64, y - h * .42], [x + w * .74, y - h * .29], [x + w * .71, y + 13], [x + w * .58, y + 14]], dark);
    p.l(x + w * .25, y - h * .73, x + w * .42, y - h + 1, light);
    p.l(x + w * .45, y - h + 2, x + w * .57, y - h * .85, light);
    for (let j = 0; j < 5; j++) {
      const xx = x + w * (.14 + hash(seed + j) * .72), yy = y - h * hash(seed + j + 17) * .25;
      p.r(xx, yy, 8 + hash(seed + j + 8) * 18, 1, top);
      p.l(xx + 3, yy + 2, xx, yy + 6, dark);
    }
  }
  function buildings(p, x, y, width, seed, far = false) {
    const color = far ? '#355865' : '#183b4c', hi = far ? '#66848a' : '#365967';
    p.r(x, y, width, 24, color); p.r(x, y, width, 2, hi);
    const count = Math.floor(width / 17);
    for (let i = 0; i < count; i++) {
      const xx = x + i * 18, hh = 5 + Math.floor(hash(seed + i) * 15);
      p.r(xx, y - hh, 13 + i % 3 * 2, hh, color);
      p.r(xx + 1, y - hh, 11, 1, hi);
      if (i % 3 === 0) { p.r(xx + 5, y - hh - 10, 3, 10, color); p.r(xx + 5, y - hh - 10, 3, 1, hi); }
      if (i % 2 === 0) for (let j = 0; j < 3; j++) p.r(xx + 2 + j * 4, y - 4, 2, 1, '#a98d73');
    }
    for (let i = 0; i < width; i += 24) { p.r(x + i + 3, y + 8, 15, 1, hi); p.r(x + i + 7, y + 12, 2, 5, '#112f41'); }
  }
  function buildScenery(W, H, sector) {
    const s = mod(sector, 4), unit = H / 360, tileWidth = Math.round(TILE * unit);
    const sky = canvas(W, H), clouds = canvas(tileWidth, H), far = canvas(tileWidth, H), mid = canvas(tileWidth, H), port = canvas(tileWidth, H);
    if (!sky || !clouds || !far || !mid || !port) return null;
    const ctx = cv => { const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; return g; };
    let g = ctx(sky), p = sceneryPen(g, H);
    const skyColors = [
      ['#bc8280', '#d29184', '#e4a28a', '#efb493', '#f5c39d', '#f8d1a6'],
      ['#a4777d', '#bf8680', '#d99888', '#e9ad91', '#f3bc99', '#f3cba3'],
      ['#8d7c88', '#ac8990', '#c39b97', '#d9ad9e', '#e3bca6', '#ecccb0'],
      ['#a56f79', '#bc7e7a', '#d38f7e', '#e49f85', '#f0b28e', '#f6c495']
    ][s];
    const bands = [0, 47, 91, 134, 179, 223, 264];
    for (let i = 0; i < 6; i++) R(g, 0, bands[i] * unit, W, (bands[i + 1] - bands[i]) * unit + 1, skyColors[i]);
    // Sparse hand-placed transition pixels soften bands without a gradient.
    for (let i = 1; i < 6; i++) for (let xx = 0; xx < W; xx += 8) {
      R(g, xx + (i % 2) * 4, bands[i] * unit - 2, 2, 1, skyColors[i]);
      R(g, xx + 3, bands[i] * unit + 1, 2, 1, skyColors[i - 1]);
    }
    const sunX = W / unit * (s === 2 ? .78 : .73), sunY = s === 2 ? 139 : 122;
    p.d(sunX, sunY, s === 2 ? 28 : 34, '#ffdfab');
    p.d(sunX - 1, sunY - 2, s === 2 ? 25 : 31, '#ffe5b3');
    p.r(sunX - 35, sunY + 15, 70, 2, skyColors[3]);
    p.r(sunX - 30, sunY + 23, 60, 3, skyColors[3]);
    p.r(sunX - 23, sunY + 30, 46, 2, skyColors[3]);
    R(g, 0, 254 * unit, W, 106 * unit, '#6e8791');
    R(g, 0, 267 * unit, W, 93 * unit, '#5c7b89');
    R(g, 0, 287 * unit, W, 73 * unit, '#496d7c');
    R(g, 0, 315 * unit, W, 45 * unit, '#365968');
    R(g, 0, 345 * unit, W, 15 * unit, '#2a4d5d');
    R(g, 0, 254 * unit, W, 2 * unit, '#b7b2a3');
    g = ctx(clouds); p = sceneryPen(g, H);
    for (let i = 0; i < 8; i++) {
      const xx = i * 207 - 40 + hash(i + 91) * 35, yy = 64 + hash(i + 13) * 94;
      cloud(p, xx, yy, 60 + hash(i + 18) * 76, i, '#eab096', '#d2998d', '#c18b86');
    }
    cloud(p, 28, 206, 147, 2, '#f7c79f', '#eab399', '#dba590');
    cloud(p, 742, 187, 122, 3, '#f7c79f', '#e7b298', '#dba590');
    g = ctx(far); p = sceneryPen(g, H);
    for (let i = 0; i < 7; i++) {
      const xx = i * 246 + 14, yy = 253 + hash(i + 8) * 5, ww = 160 + hash(i + s * 19) * 105;
      const hh = 11 + hash(i + 43 + s * 3) * 30;
      p.p([[xx - 16, yy + 8], [xx + 9, yy - 3], [xx + ww * .21, yy - hh * .3], [xx + ww * .37, yy - hh], [xx + ww * .61, yy - hh * .65], [xx + ww * .76, yy - hh * .14], [xx + ww, yy + 6]], '#8b9695');
      p.p([[xx + 15, yy + 7], [xx + ww * .3, yy - hh * .3], [xx + ww * .47, yy - hh * .55], [xx + ww * .64, yy - hh * .17], [xx + ww, yy + 7]], '#778b8c');
      if (i % 2 === s % 2) {
        p.r(xx + ww * .67, yy - 11, 20, 15, '#81908f');
        p.r(xx + ww * .67 + 5, yy - 18, 3, 10, '#81908f');
        p.r(xx + ww * .67 + 17, yy - 15, 2, 8, '#81908f');
      }
    }
    g = ctx(mid); p = sceneryPen(g, H);
    for (let i = 0; i < 5; i++) {
      const xx = i * 346 + 44 + s * 37, ww = 185 + hash(i + s * 7) * 108;
      const yy = 292 + hash(i + 11) * 12, hh = 25 + hash(i + 56 + s) * (s === 3 ? 36 : 25);
      island(p, xx, yy, ww, hh, i + 13 * s, ['#557c81', '#3c6470', '#2d5261', '#7d9690']);
      const topY = Math.max(264, yy - hh * .38 - 7);
      if ((i + s) % 2 === 0) {
        buildings(p, xx + ww * .6, topY + 8, ww * .23, i + s * 41, true);
        p.r(xx + ww * .72, topY - 8, 4, 12, '#3f6370');
        p.r(xx + ww * .72 - 1, topY - 8, 6, 1, '#82928b');
      }
      p.r(xx - 4, yy + 19, ww * .85, 1, '#6f8e93');
      p.r(xx + 19, yy + 22, ww * .54, 1, '#507884');
    }
    g = ctx(port); p = sceneryPen(g, H);
    for (let i = 0; i < 4; i++) {
      const xx = i * 422 + 135 - s * 55, ww = s === 1 ? 240 : 172 + hash(i + 73) * 45, yy = 333 + hash(i + 17) * 19;
      p.p([[xx - 38, 360], [xx - 23, yy + 7], [xx + 7, yy], [xx + ww, yy], [xx + ww + 37, 360]], '#183b4c');
      buildings(p, xx, yy - 4, ww - 10, i + s * 87);
      p.r(xx - 20, yy + 2, ww + 44, 3, '#294e5d');
      for (let j = 0; j < 6; j++) p.r(xx + j * 29, yy + 8, 6, 25, '#112f40');
      crane(p, xx + 23, yy - 3, 49 + i % 2 * 9, '#203f50', '#55707a', 1);
      if (s !== 0 || i % 2) crane(p, xx + ww - 22, yy - 3, 39, '#203f50', '#55707a', -1);
      // Spherical storage tanks are built from hard-edged pixel ellipses.
      p.e(xx + ww * .55, yy - 11, 15, 12, '#1c3e4e');
      p.e(xx + ww * .55 - 2, yy - 14, 12, 7, '#345663');
      p.r(xx + ww * .55 - 16, yy - 11, 32, 9, '#1c3e4e');
      p.l(xx + ww * .55 - 10, yy - 21, xx + ww * .55 + 1, yy - 23, '#648087');
      const tower = xx + ww * .77;
      p.r(tower, yy - 47, 7, 43, '#193b4c');
      for (let j = 0; j < 3; j++) p.r(tower - 3, yy - 41 + j * 12, 13, 2, '#315361');
      p.r(tower + 1, yy - 48, 5, 2, '#b69475');
      p.r(tower + 3, yy - 56, 1, 9, '#294957');
      p.r(xx + 51, yy - 21, 20, 3, '#315361');
      p.l(xx + 58, yy - 23, xx + 58, yy - 30, '#315361');
      p.r(xx + 53, yy - 32, 11, 2, '#315361');
      for (let j = 0; j < 3; j++) { p.r(xx + ww * .17 + j * 16, yy - 8, 12, 4, '#315361'); p.r(xx + ww * .17 + j * 16, yy - 8, 12, 1, '#687b7c'); }
    }
    // A small atmospheric flock; fixed world positions, without sparkle noise.
    for (let i = 0; i < 4; i++) { const xx = 934 + i * 11, yy = 232 - (i % 3) * 3; p.l(xx, yy, xx + 2, yy + 1, '#718585'); p.l(xx + 2, yy + 1, xx + 4, yy, '#718585'); }
    return { sky, clouds, far, mid, port, unit, tileWidth };
  }
  function tiled(g, cv, offset, W) {
    const width = cv.width, start = -mod(Math.floor(offset), width);
    for (let x = start; x < W; x += width) g.drawImage(cv, x, 0);
  }
  function background(g, { W = 640, H = 360, time = 0, scroll = 0, sector = 0, reduced = false } = {}) {
    W = Math.max(1, Math.round(W)); H = Math.max(1, Math.round(H));
    const s = mod(Math.floor(sector), 4), key = W + ':' + H + ':' + s;
    let layers = cache.get(key);
    if (!layers) {
      layers = buildScenery(W, H, s);
      if (layers) { cache.set(key, layers); if (cache.size > 5) cache.delete(cache.keys().next().value); }
    }
    if (!layers) { R(g, 0, 0, W, H, '#e4a28a'); return; }
    const t = reduced ? 0 : time, u = H / 360;
    const savedSmooth = g.imageSmoothingEnabled;
    g.imageSmoothingEnabled = false;
    g.drawImage(layers.sky, 0, 0);
    tiled(g, layers.clouds, scroll * .035 + t * .7, W);
    tiled(g, layers.far, scroll * .095, W);
    // Broad warm reflections, then steel-blue wind streaks; integer positions.
    const sunX = W * (s === 2 ? .78 : .73);
    for (let i = 0; i < 16; i++) {
      const yy = (260 + i * 5) * u, width = (14 + i * 3 + hash(i + 19) * 18) * u;
      const drift = Math.sin(t * .5 + i * 2.3) * 5 * u;
      R(g, sunX + drift - width * .5, yy, width, 1, i < 5 ? '#c1b5a0' : i < 10 ? '#859992' : '#648583');
      if (i % 3 === 0) R(g, sunX + drift + width * .65, yy + 2, width * .3, 1, '#8c9d96');
    }
    for (let i = 0; i < (reduced ? 33 : 57); i++) {
      const yy = (259 + hash(i + 483) * 99) * u;
      const xx = mod(hash(i + 48) * (W + 80) - scroll * (.16 + (yy / H) * .11) - t * (1 + i % 3), W + 80) - 40;
      R(g, xx, yy, (5 + hash(i + 721) * 23) * u, 1, i % 4 === 0 ? '#7b979b' : i % 3 === 0 ? '#4f7481' : '#365e70');
    }
    tiled(g, layers.mid, scroll * .28, W);
    tiled(g, layers.port, scroll * .56, W);
    g.imageSmoothingEnabled = savedSmooth;
    px.reset(g);
  }

  window.BrasswingArt = Object.freeze({ background, player, enemy, miniboss, boss, portrait, palette: C });
})();
