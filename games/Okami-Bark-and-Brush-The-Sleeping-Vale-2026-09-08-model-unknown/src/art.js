/* Bark & Brush — the painted art.
   Every tree, tuft, rock, lantern and mountain is drawn once into a canvas with the
   original brushwork, then packed into texture atlases for the three.js scene. */

export const TAU = Math.PI * 2;
export const PI = Math.PI;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;

/** The original's small seeded generator (mulberry32). */
export function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A canvas of logical size w×h, rendered at `scale` (lower tiers paint smaller textures). */
export function makeCanvas(w, h, fn, scale = 1) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * scale));
  c.height = Math.max(1, Math.round(h * scale));
  const g = c.getContext('2d');
  g.scale(c.width / w, c.height / h);
  fn(g, w, h);
  c.logicalWidth = w;
  c.logicalHeight = h;
  return c;
}

export function path2(c, pts, fill, strokeColor, width = 1) {
  c.beginPath();
  pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
  c.closePath();
  if (fill) {
    c.fillStyle = fill;
    c.fill();
  }
  if (strokeColor) {
    c.strokeStyle = strokeColor;
    c.lineWidth = width;
    c.stroke();
  }
}

export function ellipse(c, x, y, rx, ry, col, strokeColor = null, lw = 1) {
  c.beginPath();
  c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, TAU);
  c.fillStyle = col;
  c.fill();
  if (strokeColor) {
    c.strokeStyle = strokeColor;
    c.lineWidth = lw;
    c.stroke();
  }
}

export function paperTex() {
  return makeCanvas(256, 256, (c, w, h) => {
    c.fillStyle = '#eadbb9';
    c.fillRect(0, 0, w, h);
    const r = rng(44);
    for (let i = 0; i < 16000; i++) {
      const x = r() * w;
      const y = r() * h;
      c.fillStyle = r() < 0.5 ? '#927950' : '#fff9e8';
      c.globalAlpha = r() * 0.34;
      c.fillRect(x, y, r() * 1.5 + 0.3, r() * 1.5 + 0.3);
    }
    c.globalAlpha = 0.15;
    c.strokeStyle = '#927d53';
    for (let i = 0; i < 400; i++) {
      const x = r() * w;
      const y = r() * h;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + r() * 7, y + 1);
      c.stroke();
    }
  });
}

/* Blossom palettes: 0 cherry, 1 willow green, 2 moon plum (new, for the epilogue). */
const CROWNS = [
  { cols: ['#b76776', '#d9919c', '#f3bac0'], edge: '#795b59', fleck: '#985561', curl: '#764f5970', bud: '#e6a99b' },
  { cols: ['#718856', '#a4b770', '#bfcb89'], edge: '#4c6648', fleck: '#587749', curl: '#4c664870', bud: '#e6a99b' },
  { cols: ['#aeb0cf', '#d5d6ec', '#f4f3ff'], edge: '#65678a', fleck: '#7b7ea6', curl: '#65678a70', bud: '#eeeaf9' },
];

export function treeAsset(seed, alive = false, kind = 0, scale = 1) {
  return makeCanvas(
    640,
    820,
    (c) => {
      const r = rng(seed);
      const ink = '#31332e';
      const tips = [];
      const pal = CROWNS[kind] || CROWNS[0];
      c.lineCap = 'round';
      c.lineJoin = 'round';
      function limb(x, y, angle, len, width, depth) {
        const bend = (r() - 0.5) * 0.48;
        const ex = x + Math.sin(angle + bend) * len;
        const ey = y - Math.cos(angle + bend) * len;
        const mx = lerp(x, ex, 0.53) + Math.cos(angle) * len * 0.12;
        const my = lerp(y, ey, 0.53);
        c.strokeStyle = ink;
        c.lineWidth = width + 5;
        c.beginPath();
        c.moveTo(x, y);
        c.quadraticCurveTo(mx, my, ex, ey);
        c.stroke();
        c.strokeStyle = alive ? '#93865b' : '#746b65';
        c.lineWidth = width;
        c.beginPath();
        c.moveTo(x - 1, y);
        c.quadraticCurveTo(mx - 1, my, ex - 1, ey);
        c.stroke();
        if (width > 8) {
          c.strokeStyle = alive ? '#c4af72' : '#a69a84';
          c.lineWidth = width * 0.17;
          c.beginPath();
          c.moveTo(x - width * 0.18, y);
          c.quadraticCurveTo(mx - width * 0.15, my, ex - 2, ey);
          c.stroke();
        }
        if (depth > 0) {
          limb(ex, ey, angle - 0.42 - r() * 0.4, len * (0.56 + r() * 0.1), width * 0.58, depth - 1);
          limb(ex, ey, angle + 0.4 + r() * 0.4, len * (0.56 + r() * 0.1), width * 0.6, depth - 1);
          if (depth > 2) limb(lerp(x, ex, 0.6), lerp(y, ey, 0.6), angle + (r() > 0.5 ? 1 : -1) * 0.98, len * 0.6, width * 0.5, depth - 1);
        } else {
          tips.push([ex, ey, 45 + r() * 38]);
          if (!alive) {
            c.strokeStyle = ink;
            c.lineWidth = 2.2;
            c.beginPath();
            c.moveTo(ex, ey);
            c.bezierCurveTo(ex + 27, ey - 19, ex + 40, ey + 14, ex + 14, ey + 14);
            c.stroke();
          }
        }
      }
      // Broad roots and a twisted ink trunk.
      for (let i = 0; i < 7; i++) {
        const x = 320 + (i - 3) * 20;
        c.strokeStyle = ink;
        c.lineWidth = 8;
        c.beginPath();
        c.moveTo(321, 760);
        c.quadraticCurveTo(x, 783, x + (i - 3) * 13, 801 - r() * 8);
        c.stroke();
      }
      limb(320, 788, -0.055, 242, 44, 3);
      if (alive) {
        tips.sort((a, b) => a[1] - b[1]);
        for (let [x, y, s] of tips) {
          s *= 1.2;
          const colors = pal.cols;
          c.globalAlpha = 0.2;
          for (let j = 0; j < 5; j++) ellipse(c, x + (r() - 0.5) * 40, y + (r() - 0.5) * 20, s * 1.1, s * 0.63, colors[1]);
          c.globalAlpha = 1;
          const boundary = [];
          for (let j = 0; j < 48; j++) {
            const a = (j * TAU) / 48;
            const rr = 1 + 0.08 * Math.sin(a * 7) + 0.07 * Math.cos(a * 11) + (r() - 0.5) * 0.04;
            boundary.push([x + Math.cos(a) * s * rr, y + Math.sin(a) * s * 0.56 * rr]);
          }
          path2(c, boundary, colors[0], pal.edge, 2.1);
          c.save();
          c.beginPath();
          boundary.forEach((p, j) => (j ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
          c.closePath();
          c.clip();
          for (let j = 0; j < 14; j++) {
            const ax = x + (r() - 0.5) * s * 1.7;
            const ay = y + (r() - 0.5) * s * 0.75;
            const sz = s * (0.22 + r() * 0.34);
            c.globalAlpha = 0.42 + r() * 0.22;
            ellipse(c, ax, ay, sz, sz * 0.65, colors[1 + (j % 2)]);
          }
          c.globalAlpha = 1;
          for (let j = 0; j < 65; j++) {
            const ax = x + (r() - 0.5) * s * 1.9;
            const ay = y + (r() - 0.5) * s * 0.93;
            const sz = 1 + r() * 3;
            c.globalAlpha = 0.55;
            ellipse(c, ax, ay, sz, sz * 0.65, r() < 0.65 ? '#ffe7cf' : pal.fleck);
          }
          c.globalAlpha = 1;
          c.restore();
          c.strokeStyle = pal.curl;
          c.lineWidth = 1.5;
          for (let j = 0; j < 4; j++) {
            const xx = x + (j - 1.5) * s * 0.38;
            const yy = y + s * 0.3 + (r() - 0.5) * 10;
            c.beginPath();
            c.moveTo(xx - 6, yy);
            c.quadraticCurveTo(xx, yy + 9, xx + 7, yy + 1);
            c.stroke();
          }
        }
        // Small dangling blossoms on the bare lower branches.
        for (let i = 0; i < 36; i++) {
          const x = 130 + r() * 380;
          const y = 280 + r() * 265;
          ellipse(c, x, y, 3 + r() * 4, 2 + r() * 3, pal.bud);
        }
      } else {
        const g = c.createRadialGradient(320, 293, 1, 320, 293, 68);
        g.addColorStop(0, '#e9d899c0');
        g.addColorStop(1, '#e9d89900');
        c.fillStyle = g;
        c.fillRect(240, 215, 160, 160);
        ellipse(c, 320, 293, 13, 19, '#e6dca9', '#716345', 3);
        c.strokeStyle = '#faf0c7';
        c.lineWidth = 2;
        c.beginPath();
        c.arc(320, 292, 25, 0, TAU);
        c.stroke();
      }
      // Flecked bark, not a uniform vector surface.
      c.globalAlpha = 0.3;
      c.strokeStyle = '#302e26';
      for (let i = 0; i < 38; i++) {
        const y = 540 + r() * 220;
        const x = 303 + r() * 28;
        c.lineWidth = 0.7 + r() * 2;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + (r() - 0.5) * 10, y - 5 - r() * 18);
        c.stroke();
      }
      c.globalAlpha = 1;
    },
    scale
  );
}

export function grassAsset(seed, col, scale = 1) {
  return makeCanvas(
    150,
    150,
    (c) => {
      const r = rng(seed);
      c.lineCap = 'round';
      for (let i = 0; i < 24; i++) {
        const x = 72 + (r() - 0.5) * 35;
        const y = 146;
        const ex = x + (r() - 0.5) * 110;
        const ey = 55 + r() * 65;
        c.beginPath();
        c.moveTo(x, y);
        c.quadraticCurveTo(x + (ex - x) * 0.16, ey, ex, ey - 18);
        c.lineTo(x + 3, y);
        c.closePath();
        c.fillStyle = i % 4 === 0 ? '#334c3b' : col;
        c.fill();
      }
    },
    scale
  );
}

export function flowerAsset(seed, scale = 1) {
  return makeCanvas(
    200,
    130,
    (c) => {
      const r = rng(seed);
      for (let i = 0; i < 25; i++) {
        const x = 15 + r() * 175;
        const y = 40 + r() * 65;
        c.strokeStyle = '#4e7443';
        c.lineWidth = 1.7;
        c.beginPath();
        c.moveTo(x, y + 19);
        c.lineTo(x, y);
        c.stroke();
        const list = ['#f4d79a', '#efbbad', '#fbebc5', '#d97972'];
        const col = list[Math.floor(r() * list.length)];
        for (let j = 0; j < 5; j++) ellipse(c, x + Math.sin((j * TAU) / 5) * 4, y + Math.cos((j * TAU) / 5) * 4, 3.5, 3, col);
        ellipse(c, x, y, 1.5, 1.5, '#9a6838');
      }
    },
    scale
  );
}

export function rockAsset(seed, scale = 1) {
  return makeCanvas(
    260,
    220,
    (c) => {
      const r = rng(seed);
      let pts = [[16, 183], [24, 119], [75, 47], [156, 30], [218, 87], [244, 162], [213, 196], [99, 208]];
      pts = pts.map((p) => [p[0] + (r() - 0.5) * 15, p[1] + (r() - 0.5) * 12]);
      path2(c, pts, '#93977d', '#36483a', 4);
      path2(c, [pts[0], pts[1], pts[2], pts[3], [134, 104], [102, 185]], '#bdbe96');
      path2(c, [pts[3], pts[4], pts[5], pts[6], [172, 152]], '#707d67');
      c.strokeStyle = '#4b5a45';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(75, 65);
      c.lineTo(109, 104);
      c.lineTo(100, 151);
      c.moveTo(186, 91);
      c.lineTo(163, 136);
      c.lineTo(187, 154);
      c.stroke();
      for (let i = 0; i < 28; i++) {
        c.globalAlpha = 0.35;
        ellipse(c, 55 + r() * 141, 155 + r() * 30, 8 + r() * 14, 3 + r() * 5, '#5e7a49');
      }
      c.globalAlpha = 1;
    },
    scale
  );
}

/** Stone lantern. `lit` is the original's glowing lamp; unlit ones wait for a Kindle dot. */
export function lanternAsset(lit = true, scale = 1) {
  return makeCanvas(
    200,
    430,
    (c) => {
      path2(c, [[51, 400], [145, 400], [150, 379], [129, 364], [127, 246], [74, 246], [73, 363], [48, 382]], '#8e9979', '#3f4b39', 4);
      path2(c, [[68, 340], [92, 308], [89, 253], [76, 253]], '#bcc0a0');
      path2(c, [[54, 244], [148, 244], [143, 153], [61, 153]], '#b7b993', '#374c39', 4);
      path2(c, [[78, 225], [124, 225], [124, 169], [78, 169]], '#655c3d', '#374c39', 2);
      if (lit) {
        const g = c.createRadialGradient(101, 207, 1, 101, 207, 25);
        g.addColorStop(0, '#ffe7a0');
        g.addColorStop(1, '#bf944a');
        c.fillStyle = g;
        c.fillRect(85, 178, 31, 41);
      } else {
        c.fillStyle = '#3d3a2e';
        c.fillRect(85, 178, 31, 41);
        c.strokeStyle = '#6d6650';
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(90, 200);
        c.quadraticCurveTo(101, 190, 111, 204);
        c.stroke();
      }
      path2(c, [[32, 156], [101, 106], [168, 153], [141, 164], [57, 166]], '#718065', '#344536', 5);
      ellipse(c, 101, 101, 10, 14, '#a9ad83', '#344536', 3);
      ellipse(c, 98, 397, 62, 8, '#56644655');
      for (let i = 0; i < 12; i++) ellipse(c, 58 + i * 7, 383 + Math.sin(i) * 6, 6, 2, '#71834d');
    },
    scale
  );
}

export function bambooAsset(seed, scale = 1) {
  return makeCanvas(
    240,
    640,
    (c) => {
      const r = rng(seed);
      for (let i = 0; i < 4; i++) {
        const x = 66 + i * 35;
        const lean = (r() - 0.5) * 60;
        c.strokeStyle = '#344c39';
        c.lineWidth = 13;
        c.beginPath();
        c.moveTo(x, 635);
        c.lineTo(x + lean, 60 + r() * 95);
        c.stroke();
        c.strokeStyle = '#8d9f65';
        c.lineWidth = 8;
        c.stroke();
        for (let j = 0; j < 7; j++) {
          const y = 110 + j * 70;
          const xx = x + lean * (1 - y / 640);
          c.strokeStyle = '#263f31';
          c.lineWidth = 3;
          c.beginPath();
          c.moveTo(xx - 6, y);
          c.lineTo(xx + 6, y);
          c.stroke();
          for (let k = 0; k < 4; k++) {
            const dx = (r() > 0.5 ? 1 : -1) * (22 + r() * 36);
            const dy = -20 - r() * 25;
            path2(c, [[xx, y], [xx + dx * 0.5, y + dy * 0.8], [xx + dx, y + dy], [xx + dx * 0.65, y + dy * 0.4]], r() < 0.5 ? '#3f6242' : '#6f854d');
          }
        }
      }
    },
    scale
  );
}

export function gateAsset(scale = 1) {
  return makeCanvas(
    850,
    700,
    (c) => {
      for (const x of [180, 630]) {
        path2(c, [[x - 22, 676], [x + 25, 676], [x + 18, 121], [x - 18, 121]], '#4d6453', '#293d32', 6);
        path2(c, [[x - 28, 676], [x + 31, 676], [x + 30, 640], [x - 26, 639]], '#868e70', '#344d3a', 3);
      }
      path2(c, [[97, 167], [731, 167], [752, 132], [697, 136], [176, 136], [76, 129]], '#b3593d', '#3c4434', 6);
      path2(c, [[53, 97], [139, 117], [703, 116], [789, 91], [743, 144], [666, 151], [164, 151], [95, 140]], '#364c3f', '#273d32', 6);
      path2(c, [[120, 252], [717, 252], [715, 225], [123, 225]], '#b45a3e', '#394534', 5);
      c.strokeStyle = '#b59b66';
      c.lineWidth = 8;
      c.beginPath();
      c.moveTo(180, 193);
      c.quadraticCurveTo(425, 253, 630, 194);
      c.stroke();
      for (let i = 0; i < 7; i++) {
        const x = 240 + i * 55;
        const y = 209 + Math.sin((i / 6) * PI) * 20;
        path2(c, [[x, y], [x + 14, y + 6], [x + 5, y + 24], [x + 17, y + 27], [x + 2, y + 47], [x - 9, y + 40], [x + 1, y + 24], [x - 11, y + 17]], '#f1e4bd', '#746c4b', 1.7);
      }
      path2(c, [[380, 144], [463, 144], [458, 222], [385, 222]], '#d7b36c', '#3d4835', 4);
      c.strokeStyle = '#6b663f';
      c.lineWidth = 4;
      c.beginPath();
      c.arc(422, 181, 18, 0, TAU);
      c.moveTo(407, 183);
      c.lineTo(436, 183);
      c.stroke();
    },
    scale
  );
}

export function mountainAsset(seed, scale = 1) {
  return makeCanvas(
    2200,
    700,
    (c, w, h) => {
      const r = rng(seed);
      for (let layer = 0; layer < 4; layer++) {
        const base = 570 + layer * 31;
        let x = -170;
        while (x < w + 200) {
          const width = 260 + r() * 290;
          const peak = base - 130 - r() * (270 - layer * 44);
          const top = x + width * (0.45 + r() * 0.14);
          c.beginPath();
          c.moveTo(x - 100, h);
          c.lineTo(x - 100, base + 10);
          c.bezierCurveTo(x + width * 0.14, base + 14, top - width * 0.16, peak + 70, top, peak);
          c.bezierCurveTo(top + width * 0.12, peak - 33, top + width * 0.27, base - 45, x + width + 100, base + 40);
          c.lineTo(x + width + 100, h);
          c.closePath();
          c.fillStyle = ['#bac4ac', '#a3b49b', '#8fa78d', '#789978'][layer];
          c.fill();
          c.strokeStyle = ['#859d8360', '#75937377', '#5e845e70', '#486f5066'][layer];
          c.lineWidth = 2.3;
          c.beginPath();
          c.moveTo(x - 40, base);
          c.bezierCurveTo(x + width * 0.14, base + 5, top - width * 0.16, peak + 70, top, peak);
          c.bezierCurveTo(top + width * 0.12, peak - 33, top + width * 0.27, base - 45, x + width + 66, base + 34);
          c.stroke();
          c.globalAlpha = 0.2;
          for (let j = 0; j < 8; j++) {
            const u = j / 8;
            const xx = top + u * width * 0.32;
            const yy = peak + u * u * (base - peak) * 0.7;
            c.strokeStyle = j % 2 ? '#f2e9c1' : '#406e50';
            c.lineWidth = 1 + r() * 3;
            c.beginPath();
            c.moveTo(xx, yy + 13);
            c.bezierCurveTo(xx - 13, yy + 80, xx - 35, base - 10, xx - 70, base + 42);
            c.stroke();
          }
          c.globalAlpha = 1;
          x += width * 0.68;
        }
      }
    },
    scale
  );
}

/** The original's long, curled ink clouds with a dry-brush edge, as one wrapping strip. */
export function cloudStrip(scale = 1) {
  return makeCanvas(
    2400,
    200,
    (c) => {
      c.lineCap = 'round';
      const put = (x, y, k) => {
        c.save();
        c.translate(x, y);
        c.scale(k, k);
        c.strokeStyle = '#81967c73';
        c.lineWidth = 1.6;
        c.beginPath();
        c.moveTo(-100, 12);
        c.bezierCurveTo(-45, 3, -27, 17, 13, 8);
        c.bezierCurveTo(41, -5, 7, -19, -7, -5);
        c.bezierCurveTo(-15, 7, 32, 6, 91, 5);
        c.stroke();
        c.strokeStyle = '#f7edcba0';
        c.lineWidth = 3.4;
        c.beginPath();
        c.moveTo(-63, 20);
        c.bezierCurveTo(-5, 13, 88, 20, 122, 11);
        c.stroke();
        c.restore();
      };
      const spots = [[180, 60, 1.6], [640, 120, 1.25], [1020, 50, 1.8], [1460, 110, 1.35], [1880, 70, 1.55], [2250, 140, 1.1]];
      for (const [x, y, k] of spots) put(x, y, k);
    },
    scale
  );
}

/** White shapes tinted per particle: a petal ellipse and an ink diamond. */
export function particleShapes() {
  return makeCanvas(128, 64, (c) => {
    ellipse(c, 32, 32, 29, 29, '#ffffff');
    path2(c, [[96, 3], [81, 42], [96, 61], [113, 40]], '#ffffff');
  });
}

export function glowTex() {
  return makeCanvas(64, 64, (c) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 31);
    g.addColorStop(0, 'rgba(255,240,200,1)');
    g.addColorStop(0.35, 'rgba(255,215,140,.55)');
    g.addColorStop(1, 'rgba(255,200,120,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
  });
}

/** A hanging ink veil for the old gate (dissolves when the epilogue opens). */
export function veilTex() {
  return makeCanvas(256, 320, (c, w, h) => {
    const r = rng(311);
    c.lineCap = 'round';
    for (let i = 0; i < 70; i++) {
      const x = r() * w;
      c.strokeStyle = r() < 0.7 ? '#2b3a33' : '#4a5a4c';
      c.globalAlpha = 0.18 + r() * 0.3;
      c.lineWidth = 6 + r() * 22;
      c.beginPath();
      c.moveTo(x, -10);
      c.bezierCurveTo(x + (r() - 0.5) * 30, h * 0.35, x + (r() - 0.5) * 40, h * 0.7, x + (r() - 0.5) * 24, h * (0.75 + r() * 0.3));
      c.stroke();
    }
    c.globalAlpha = 1;
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.8, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,1)');
    c.globalCompositeOperation = 'destination-out';
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = 'source-over';
  });
}

/**
 * Shelf-pack canvases into one atlas. Returns the canvas, a uv rect per key
 * ([u0, v0, uw, vh], v measured from the bottom as three.js samples a flipped canvas)
 * and each item's logical aspect (width / height).
 */
export function packAtlas(entries, maxW = 4096, pad = 8) {
  const items = entries.slice().sort((a, b) => b.canvas.height - a.canvas.height);
  let x = pad;
  let y = pad;
  let rowH = 0;
  let W = 0;
  const placed = [];
  for (const it of items) {
    const w = it.canvas.width;
    const h = it.canvas.height;
    if (x + w + pad > maxW && x > pad) {
      x = pad;
      y += rowH + pad;
      rowH = 0;
    }
    placed.push({ it, x, y });
    x += w + pad;
    rowH = Math.max(rowH, h);
    W = Math.max(W, x);
  }
  const H = y + rowH + pad;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  const rects = {};
  const aspect = {};
  for (const { it, x: px, y: py } of placed) {
    g.drawImage(it.canvas, px, py);
    const w = it.canvas.width;
    const h = it.canvas.height;
    rects[it.key] = [px / W, 1 - (py + h) / H, w / W, h / H];
    aspect[it.key] = (it.canvas.logicalWidth || w) / (it.canvas.logicalHeight || h);
  }
  return { canvas, rects, aspect };
}
