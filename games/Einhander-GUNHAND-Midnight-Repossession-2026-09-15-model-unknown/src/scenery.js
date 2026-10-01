/* GUNHAND — painted textures for the 3D scene.
   The city layers, sky, haze, road tiles and the glyph/glow atlas are painted once
   with Canvas2D and handed to gfx.js as textures. Same painters as the original. */

export const W = 1440;
export const H = 810;
const TAU = Math.PI * 2;

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

function poly(c, p, fill, stroke, lw = 1) {
  c.beginPath();
  c.moveTo(p[0][0], p[0][1]);
  for (let i = 1; i < p.length; i++) c.lineTo(p[i][0], p[i][1]);
  c.closePath();
  if (fill) {
    c.fillStyle = fill;
    c.fill();
  }
  if (stroke) {
    c.lineWidth = lw;
    c.strokeStyle = stroke;
    c.stroke();
  }
}

function line(c, x1, y1, x2, y2, color, width = 1) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x2, y2);
  c.stroke();
}

function circle(c, x, y, r, color) {
  c.fillStyle = color;
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fill();
}

function glow(c, x, y, r, color, alpha = 1) {
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.globalAlpha = alpha;
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'transparent');
  c.fillStyle = g;
  c.fillRect(x - r, y - r, r * 2, r * 2);
  c.restore();
}

function neonText(c, txt, x, y, size, color, vertical = false) {
  c.save();
  c.shadowColor = color;
  c.shadowBlur = 15;
  c.fillStyle = color;
  c.font = `bold ${size}px monospace`;
  c.textAlign = 'center';
  if (vertical) for (let i = 0; i < txt.length; i++) c.fillText(txt[i], x, y + i * (size + 3));
  else c.fillText(txt, x, y);
  c.restore();
}

/** The original's linear congruential generator, so the city is the same every night. */
export function makeRng(seed) {
  return {
    next() {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    },
    r(a, b) {
      return a + this.next() * (b - a);
    },
  };
}

/* Colours per operation. Operation 01 is the original's palette, value for value. */
export const THEMES = {
  1: {
    seed: 27183,
    sky: ['#091623', '#1e3440', '#475b57', '#152c34'],
    star: '#bde1d032',
    band: '#526d6728',
    fog: ['#263f3d0c', '#83b2a821'],
    haze: ['#000c1700', '#88c6bd05', '#afd9b721', '#41625600'],
    veil: '#07141e1c',
    vignette: ['#030d130d', '#010811b0'],
    moon: { glow: '#89cfc215', disc: '#90ada673', shade: '#213a43' },
    search: ['#98d6c80e', '#8eead800'],
    traffic: ['#b8d2b787', '#faad7e', '#8bd8d0'],
    rain: '#9ec9c712',
    rainCount: 90,
    rainSpeed: 1,
    city: {
      far: '#172a35', mid: '#1c3039', near: '#182a31', sideFar: '#10242e', side: '#0d2029',
      topFar: '#263b46', top: '#37515b', rimFar: '#30434a', rim: '#5a6f6b', roof: '#45616a',
      antenna: '#3c545b', beacon: '#db715c', winFarA: '#75949465', winA: '#adc5ac88', winFarB: '#b8a47865',
      winB: '#d9b885aa', winC: '#72d9cfbb', winGlow: '#63d5d0', band: '#102029', bandLine: '#3b5055',
      pillarA: '#101f28', pillarB: '#14252c', signBox: '#091e29', neon: ['#e2a572', '#8cdbd3', '#d685ae'],
      signs: ['ION', 'ROOM', 'NOVA', '24H', 'VOID', 'CIVIC'], boardBox: '#0d1a25',
      boards: ['NOCTURNE', 'SABLE INC.', 'LOW LIFE', 'CIVIC 09', 'PAY / UP'], boardNeon: ['#83c9c3', '#d48981'],
      parapet: '#456062', railA: '#779693', railB: '#547c78', plaque: '#b19a6a', plaqueStripe: '#293638',
      baseFar: '#10232e', landmark: 'crane',
    },
    gantry: { strut: '#0c222c', strutLine: '#50685f', beam: '#132c35', beamLine: '#6a7a66', lights: '#a7c2a376' },
  },
  2: {
    seed: 52817,
    sky: ['#120f24', '#2e2647', '#6a4a5e', '#1b2232'],
    star: '#e8d6e828',
    band: '#7a586a22',
    fog: ['#3a2a440c', '#b88aa01c'],
    haze: ['#0c081700', '#c690b005', '#e7b0b51d', '#5a405200'],
    veil: '#120c1e1c',
    vignette: ['#0b06130d', '#07040fb0'],
    moon: { glow: '#f2b09a18', disc: '#d9a08c78', shade: '#3b2a43' },
    search: ['#e2a8c80e', '#f0b6d800'],
    traffic: ['#d8c2d287', '#f6a77e', '#a7b8f2'],
    rain: '#c7b8e016',
    rainCount: 130,
    rainSpeed: 1.25,
    city: {
      far: '#1d1d35', mid: '#232641', near: '#1f2236', sideFar: '#141629', side: '#12142a',
      topFar: '#2c2c48', top: '#433f60', rimFar: '#393a56', rim: '#6c6582', roof: '#55507a',
      antenna: '#4a4766', beacon: '#ff8a6a', winFarA: '#8f88b065', winA: '#c4b4d288', winFarB: '#c99d7a65',
      winB: '#f0b48aaa', winC: '#ef8fb6bb', winGlow: '#f08fbf', band: '#15172b', bandLine: '#4a4666',
      pillarA: '#141529', pillarB: '#1a1b30', signBox: '#100f22', neon: ['#f2b77a', '#8fb7ff', '#e27fa7'],
      signs: ['LOAN', 'BANK', 'CASH', '24H', 'DEBT', 'SABLE'], boardBox: '#121126',
      boards: ['SABLE BANK', 'CREDIT!', 'OWE LESS', 'INTEREST', 'PAY / UP'], boardNeon: ['#9fb4ff', '#f08fb0'],
      parapet: '#5a5478', railA: '#9890b8', railB: '#6c6690', plaque: '#c49a7a', plaqueStripe: '#2e2a40',
      baseFar: '#161631', landmark: 'tower',
    },
    gantry: { strut: '#17142a', strutLine: '#6c6188', beam: '#1d1a36', beamLine: '#8a7fa6', lights: '#f0b6d876' },
  },
};

function baseCity(t, layer, rng, pal) {
  if (layer !== 0) return;
  for (let i = 0; i < 75; i++) {
    const x = rng.r(0, 2600), h = rng.r(80, 285);
    t.fillStyle = pal.baseFar;
    t.fillRect(x, 670 - h, rng.r(20, 48), h);
  }
}

/** One 2600 px wide parallax layer of the skyline (0 far, 1 mid, 2 near). */
function makeCity(layer, rng, pal) {
  const c = canvas(2600, 810);
  const t = c.getContext('2d');
  const far = layer === 0, mid = layer === 1;
  baseCity(t, layer, rng, pal);
  let x = -30;
  while (x < 2650) {
    let w = rng.r(far ? 45 : 85, far ? 135 : 215), h = rng.r(far ? 130 : 180, far ? 445 : 640);
    const base = far ? 650 : 710;
    let top = base - h;
    const z = rng.r(10, 32), col = far ? pal.far : mid ? pal.mid : pal.near;
    if (layer === 2) {
      h = rng.r(80, 280);
      top = base - h;
      w = rng.r(110, 250);
    }
    poly(t, [[x, base], [x, top], [x + w, top], [x + w, base]], col);
    poly(t, [[x + w, top], [x + w + z, top - z * 0.5], [x + w + z, base], [x + w, base]], far ? pal.sideFar : pal.side);
    poly(t, [[x, top], [x + z, top - z * 0.5], [x + w + z, top - z * 0.5], [x + w, top]], far ? pal.topFar : pal.top);
    t.fillStyle = far ? pal.rimFar : pal.rim;
    t.fillRect(x + 2, top + 2, w - 4, 2);
    if (rng.next() > 0.3) {
      const off = rng.r(8, w * 0.4), rw = rng.r(17, w * 0.5);
      t.fillStyle = col;
      t.fillRect(x + off, top - 15, rw, 15);
      t.fillStyle = pal.roof;
      t.fillRect(x + off, top - 16, rw, 2);
      if (rng.next() > 0.4) {
        line(t, x + off + rw * 0.5, top - 15, x + off + rw * 0.5, top - rng.r(30, 75), pal.antenna, 2);
        circle(t, x + off + rw * 0.5, top - 45, 2, pal.beacon);
      }
    }
    const step = far ? 10 : 13;
    for (let yy = top + 13; yy < base - 10; yy += step + 2) {
      for (let xx = x + 8; xx < x + w - 8; xx += step) {
        if (rng.next() < 0.53) {
          const co = rng.next();
          t.fillStyle = co < 0.58 ? (far ? pal.winFarA : pal.winA) : co < 0.89 ? (far ? pal.winFarB : pal.winB) : pal.winC;
          t.fillRect(xx, yy, far ? 3 : 5, far ? 3 : 5);
          if (!far && co > 0.91) {
            t.shadowBlur = 7;
            t.shadowColor = pal.winGlow;
            t.fillRect(xx, yy, 5, 5);
            t.shadowBlur = 0;
          }
        }
      }
    }
    if (!far) {
      t.fillStyle = pal.band;
      for (let yy = top + 51; yy < base; yy += rng.r(58, 105)) {
        t.fillRect(x, yy, w, 7);
        t.fillStyle = pal.bandLine;
        t.fillRect(x, yy + 7, w, 1);
        t.fillStyle = pal.band;
      }
      line(t, x + w * 0.32, top, x + w * 0.32, base, pal.pillarA, 4);
      line(t, x + w * 0.74, top, x + w * 0.74, base, pal.pillarB, 3);
      if (rng.next() > 0.56) {
        const nx = x + w * 0.8, nh = rng.r(70, 180), nw = rng.r(14, 27), ny = top + 40;
        t.fillStyle = pal.signBox;
        t.fillRect(nx - 3, ny - 8, nw + 6, nh + 12);
        const neon = rng.next() > 0.48 ? pal.neon[0] : rng.next() > 0.5 ? pal.neon[1] : pal.neon[2];
        t.strokeStyle = neon;
        t.globalAlpha = 0.6;
        t.strokeRect(nx, ny, nw, nh);
        t.globalAlpha = 1;
        neonText(t, pal.signs[Math.floor(rng.r(0, 6))], nx + nw / 2, ny + 18, 14, neon, true);
      }
    }
    if (mid && w > 155 && h > 300) {
      t.fillStyle = pal.boardBox;
      t.fillRect(x + 13, top + 32, w - 27, 46);
      neonText(t, pal.boards[Math.floor(rng.r(0, 5))], x + w / 2, top + 61, 16, rng.next() > 0.5 ? pal.boardNeon[0] : pal.boardNeon[1]);
    }
    if (layer === 2) {
      t.fillStyle = pal.parapet;
      t.fillRect(x, top + 8, w, 3);
      for (let i = 0; i < w; i += 27) {
        line(t, x + i, top - 9, x + i, top, pal.railA, 2);
        line(t, x + i, top - 9, x + i + 25, top - 9, pal.railB, 1);
      }
      if (rng.next() > 0.5) {
        t.fillStyle = pal.plaque;
        t.fillRect(x + 20, top + 21, 48, 16);
        for (let n = 0; n < 4; n++) poly(t, [[x + 21 + n * 12, top + 21], [x + 27 + n * 12, top + 21], [x + 21 + n * 12, top + 37], [x + 15 + n * 12, top + 37]], pal.plaqueStripe);
      }
    }
    x += w + rng.r(far ? 3 : 12, far ? 25 : 40);
  }
  if (mid && pal.landmark === 'crane') {
    // A distinctive elevated industrial crane.
    line(t, 1930, 150, 1930, 560, '#2c454d', 12);
    line(t, 1930, 155, 2340, 155, '#3b5760', 8);
    line(t, 1930, 115, 2190, 155, '#465961', 2);
    line(t, 1930, 115, 1955, 154, '#55696c', 2);
    line(t, 2255, 158, 2255, 320, '#47646a', 2);
    line(t, 1903, 530, 1930, 150, '#38545b', 4);
    for (let j = 0; j < 10; j++) {
      line(t, 1924, 168 + j * 33, 1937, 183 + j * 33, '#53696e', 2);
      line(t, 1937, 183 + j * 33, 1924, 201 + j * 33, '#53696e', 2);
    }
    for (let j = 0; j < 12; j++) poly(t, [[1930 + j * 32, 158], [1945 + j * 32, 173], [1962 + j * 32, 158]], null, '#405d63', 2);
    circle(t, 1930, 113, 3, '#ffa66e');
  } else if (mid && pal.landmark === 'tower') {
    // Sable Tower: the bank that holds every note in the city.
    poly(t, [[1880, 710], [1880, 120], [1960, 70], [2040, 120], [2040, 710]], '#1a1a33');
    poly(t, [[2040, 120], [2066, 108], [2066, 710], [2040, 710]], '#121229');
    line(t, 1960, 70, 1960, 8, '#4a4766', 3);
    circle(t, 1960, 12, 3, '#ff8a6a');
    for (let yy = 150; yy < 690; yy += 18) {
      for (let xx = 1892; xx < 2030; xx += 14) {
        if ((xx * 7 + yy * 3) % 5 < 3) {
          t.fillStyle = (xx + yy) % 7 === 0 ? '#ef8fb6bb' : '#c4b4d266';
          t.fillRect(xx, yy, 6, 6);
        }
      }
    }
    t.fillStyle = '#100f22';
    t.fillRect(1900, 170, 120, 40);
    neonText(t, 'SABLE', 1960, 198, 22, '#f2b77a');
  }
  return c;
}

/** Everything that changes between operations: sky, moon, skyline, haze, gantry. */
export function buildTheme(id) {
  const th = THEMES[id] || THEMES[1];
  const rng = makeRng(th.seed);
  // The original paints the three layers first and the stars after, from one sequence.
  const cities = [0, 1, 2].map((i) => makeCity(i, rng, th.city));
  const stars = Array.from({ length: 70 }, () => [rng.r(0, W), rng.r(12, 360), rng.r(0.3, 1.5)]);

  const sky = canvas(W, H);
  let c = sky.getContext('2d');
  let g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, th.sky[0]);
  g.addColorStop(0.35, th.sky[1]);
  g.addColorStop(0.72, th.sky[2]);
  g.addColorStop(1, th.sky[3]);
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  for (const s of stars) circle(c, s[0], s[1], s[2], th.star);
  for (let i = 0; i < 4; i++) {
    const y = 105 + i * 75;
    g = c.createLinearGradient(0, y - 8, 0, y + 45);
    g.addColorStop(0, 'transparent');
    g.addColorStop(0.4, th.band);
    g.addColorStop(1, 'transparent');
    c.fillStyle = g;
    c.fillRect(0, y - 8, W, 53);
  }

  // Haze layers only vary from top to bottom: a narrow strip stretched across is enough.
  const fog = canvas(4, H);
  c = fog.getContext('2d');
  g = c.createLinearGradient(0, 180, 0, 690);
  g.addColorStop(0, th.fog[0]);
  g.addColorStop(1, th.fog[1]);
  c.fillStyle = g;
  c.fillRect(0, 180, 4, 510);

  const veil = canvas(4, H);
  c = veil.getContext('2d');
  g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, th.haze[0]);
  g.addColorStop(0.52, th.haze[1]);
  g.addColorStop(0.78, th.haze[2]);
  g.addColorStop(1, th.haze[3]);
  c.fillStyle = g;
  c.fillRect(0, 0, 4, H);
  c.fillStyle = th.veil;
  c.fillRect(0, 0, 4, 688);

  const vignette = canvas(W / 2, H / 2);
  c = vignette.getContext('2d');
  c.scale(0.5, 0.5);
  g = c.createRadialGradient(W * 0.53, H * 0.47, 190, W * 0.5, H * 0.5, 870);
  g.addColorStop(0, 'transparent');
  g.addColorStop(0.65, th.vignette[0]);
  g.addColorStop(1, th.vignette[1]);
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);

  const moon = canvas(420, 420);
  c = moon.getContext('2d');
  glow(c, 210, 210, 210, th.moon.glow, 0.8);
  circle(c, 210, 210, 60, th.moon.disc);
  circle(c, 226, 195, 54, th.moon.shade);

  // The freight checkpoint gantry: one 1850 px period, 140 px tall (screen y -20…120).
  const gantry = canvas(1850, 140);
  c = gantry.getContext('2d');
  c.translate(0, 20);
  const gp = th.gantry;
  for (const xx of [0, 1850]) {
    poly(c, [[xx, -20], [xx + 47, -20], [xx + 190, 99], [xx + 148, 99]], gp.strut);
    line(c, xx + 50, 0, xx + 176, 94, gp.strutLine, 3);
    c.fillStyle = gp.beam;
    c.fillRect(xx + 137, 96, 1080, 21);
    line(c, xx + 139, 117, xx + 1216, 117, gp.beamLine, 2);
    for (let j = 0; j < 9; j++) {
      c.fillStyle = gp.lights;
      c.fillRect(xx + 190 + j * 120, 112, 35, 2);
    }
  }

  return { id, theme: th, sky, moon, cities, fog, veil, vignette, gantry };
}

/** Highway road tile (160 px period, screen y 688…810) and rail-post tile (111 px period, y 675…715), at 2×. */
export function buildRoadTiles() {
  const road = canvas(320, 244);
  let c = road.getContext('2d');
  c.scale(2, 2);
  c.translate(0, -688);
  poly(c, [[0, 688], [160, 688], [160, 741], [0, 741]], '#0c1c25');
  poly(c, [[0, 688], [160, 688], [160, 710], [0, 710]], '#52645b');
  line(c, 0, 689, 160, 689, '#7e8c6f', 2);
  line(c, 0, 699, 160, 699, '#182c31', 3);
  for (const x of [-160, 0, 160]) {
    poly(c, [[x, 692], [x + 62, 692], [x + 28, 708], [x - 35, 708]], '#9eaa8870');
    c.fillStyle = '#15282d';
    c.fillRect(x, 711, 146, 25);
    line(c, x, 711, x + 146, 711, '#698578', 1);
    c.fillStyle = '#537268';
    c.fillRect(x + 18, 718, 43, 3);
    c.fillStyle = '#acc3a1';
    c.fillRect(x + 78, 719, 7, 3);
    c.fillStyle = '#162931';
    c.fillRect(x + 11, 741, 16, 80);
    line(c, x + 20, 747, x + 75, 809, '#2e4543', 5);
  }
  line(c, 0, 737, 160, 737, '#768477', 2);
  line(c, 0, 744, 160, 744, '#040f18', 7);
  line(c, 0, 758, 160, 758, '#2d4c4d', 8);
  line(c, 0, 759, 160, 759, '#768c7455', 1);
  line(c, 0, 790, 160, 790, '#152a35', 24);

  const posts = canvas(222, 80);
  c = posts.getContext('2d');
  c.scale(2, 2);
  c.translate(0, -675);
  for (const x of [-111, 0, 111]) {
    line(c, x, 677, x, 689, '#95b59a', 2);
    line(c, x, 677, x + 110, 677, '#748f7a', 2);
    circle(c, x + 55, 711, 2, '#bdf0c9');
  }
  return { road, posts };
}

/**
 * One white atlas for every 2D effect: monospace glyphs (40 px), a soft radial glow,
 * a hard disc and a solid cell. The effect batches tint it per vertex.
 */
export function buildAtlas() {
  const size = 512;
  const cv = canvas(size, size);
  const c = cv.getContext('2d');
  const font = 40;
  c.font = `${font}px monospace`;
  const adv = Math.max(18, Math.ceil(c.measureText('M').width));
  const cw = adv + 8;
  const ch = 54;
  const base = 41;
  const chars = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~–—×·◆◇↗…';
  const perRow = Math.floor(size / cw);
  const glyphs = new Map();
  c.fillStyle = '#fff';
  c.textBaseline = 'alphabetic';
  c.textAlign = 'left';
  let i = 0;
  for (const chr of chars) {
    const gx = (i % perRow) * cw;
    const gy = Math.floor(i / perRow) * ch;
    if (gy + ch > 380) break;
    c.fillText(chr, gx + 4, gy + base);
    glyphs.set(chr, { x: gx, y: gy });
    i++;
  }
  // Soft glow: alpha falls linearly from the centre to the rim, like the original's radial gradients.
  const g = c.createRadialGradient(64, 448, 0, 64, 448, 60);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fillRect(0, 384, 128, 128);
  // Hard disc.
  c.fillStyle = '#fff';
  c.beginPath();
  c.arc(168, 424, 28, 0, TAU);
  c.fill();
  // Solid cell.
  c.fillRect(214, 390, 28, 28);
  return {
    canvas: cv,
    size,
    font,
    adv,
    cw,
    ch,
    base,
    pad: 4,
    glyphs,
    glow: [64 - 60, 448 - 60, 64 + 60, 448 + 60],
    disc: [168 - 28, 424 - 28, 168 + 28, 424 + 28],
    white: [228, 404],
  };
}
