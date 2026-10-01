/* GUNHAND — faceted polygon models.
   Every craft is a list of flat faces: { v: [[x,y,z]…], c: [r,g,b], em: glowing, n: normal }.
   Model space: +x is the nose of the player ship, +y is up on screen, +z faces the camera.
   gfx.js turns each list into one BufferGeometry; nothing here touches three.js. */

export const TAU = Math.PI * 2;

export const colors = {
  pearl: '#bcc8bf', light: '#d4d7c6', slate: '#697c80', dark: '#283b45', shadow: '#17252c',
  orange: '#dc613f', red: '#98524b', gold: '#eac17c', teal: '#88e9d6', steel: '#829293',
};

export function rgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map((x) => x + x).join('');
  return [parseInt(hex.substr(0, 2), 16), parseInt(hex.substr(2, 2), 16), parseInt(hex.substr(4, 2), 16)];
}

function face(mesh, v, col, glowFace = false) {
  const a = v[0], b = v[1], c = v[2];
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const d = Math.hypot(nx, ny, nz) || 1;
  mesh.push({ v, c: rgb(col), em: glowFace, n: [nx / d, ny / d, nz / d] });
}

function box(m, x, y, z, w, h, d, col, accent) {
  const a = x - w / 2, b = x + w / 2, c = y - h / 2, e = y + h / 2, f = z - d / 2, g = z + d / 2;
  face(m, [[a, c, g], [b, c, g], [b, e, g], [a, e, g]], col);
  face(m, [[b, c, f], [a, c, f], [a, e, f], [b, e, f]], col);
  face(m, [[b, c, g], [b, c, f], [b, e, f], [b, e, g]], accent || col);
  face(m, [[a, c, f], [a, c, g], [a, e, g], [a, e, f]], col);
  face(m, [[a, e, g], [b, e, g], [b, e, f], [a, e, f]], col);
  face(m, [[a, c, f], [b, c, f], [b, c, g], [a, c, g]], col);
}

function extrude(m, points, z, d, col, front) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  if (area < 0) points = [...points].reverse();
  face(m, points.map((p) => [p[0], p[1], z + d / 2]), front || col);
  face(m, [...points].reverse().map((p) => [p[0], p[1], z - d / 2]), col);
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    face(m, [[a[0], a[1], z - d / 2], [b[0], b[1], z - d / 2], [b[0], b[1], z + d / 2], [a[0], a[1], z + d / 2]], col);
  }
}

function hull(m, rings, col, accent) {
  const n = 8;
  const rr = [];
  for (const r of rings) {
    const ring = [];
    for (let j = 0; j < n; j++) {
      const a = (TAU * j) / n + TAU / 16;
      ring.push([r[0], r[1] + Math.cos(a) * r[3], r[2] + Math.sin(a) * r[4]]);
    }
    rr.push(ring);
  }
  face(m, [...rr[0]].reverse(), accent || col);
  face(m, rr[rr.length - 1], col);
  for (let i = 0; i < rr.length - 1; i++) {
    for (let j = 0; j < n; j++) {
      const co = i === 0 && j === 3 && accent ? accent : col;
      face(m, [rr[i][j], rr[i][(j + 1) % n], rr[i + 1][(j + 1) % n], rr[i + 1][j]], co);
    }
  }
}

function rod(m, a, b, width, depth, col) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * width / 2, ny = (dx / len) * width / 2;
  extrude(m, [[a[0] + nx, a[1] + ny], [a[0] - nx, a[1] - ny], [b[0] - nx, b[1] - ny], [b[0] + nx, b[1] + ny]], (a[2] + b[2]) / 2, depth, col);
}

function joint(m, x, y, z, r, col) {
  const pts = [];
  for (let i = 0; i < 8; i++) pts.push([x + Math.cos((i * TAU) / 8) * r, y + Math.sin((i * TAU) / 8) * r]);
  extrude(m, pts, z, 7, col);
}

/** Every model the game draws, by name. */
export function buildModels() {
  const models = {};
  let m = [];

  // GH-01, the player's salvage fighter.
  hull(m, [[-48, 0, 0, 6, 8], [-30, 0, 0, 11, 14], [8, 1, 0, 13, 13], [38, 0, 0, 7, 8], [64, -2, 0, 1, 1]], colors.pearl, colors.orange);
  for (const z of [-25, 25]) {
    hull(m, [[-53, -2, z, 8, 8], [-32, -2, z, 11, 10], [-6, -2, z, 8, 8], [6, -1, z, 3, 4]], colors.slate, colors.dark);
    box(m, -41, -2, z, 10, 19, 18, colors.pearl);
    box(m, -54, -2, z, 4, 12, 12, colors.dark);
    box(m, -55, -2, z + 1, 1, 7, 8, colors.teal);
    extrude(m, [[-42, 7], [-38, 31], [-22, 25], [-10, 7]], z, 3, colors.pearl, colors.pearl);
    extrude(m, [[-38, 22], [-37, 30], [-23, 24], [-18, 17]], z + 2, 1, colors.orange);
  }
  extrude(m, [[-33, -4], [-23, -11], [12, -12], [39, -5], [5, -5]], 0, 68, colors.dark);
  extrude(m, [[-28, 0], [-9, 5], [25, -2], [-4, -6]], 29, 4, colors.pearl);
  extrude(m, [[-28, 0], [-9, 5], [25, -2], [-4, -6]], -29, 4, colors.pearl);
  extrude(m, [[-5, 13], [4, 25], [20, 22], [36, 7], [20, 10]], 1, 12, '#183d43', '#6fa4a0');
  face(m, [[19, 13, 7], [31, 10, 7], [18, 21, 7], [6, 24, 7]], '#acf9df', true);
  box(m, 24, -8, 15, 38, 4, 4, colors.dark);
  box(m, 47, -8, 15, 16, 3, 3, colors.pearl);
  box(m, 24, -8, -15, 38, 4, 4, colors.dark);
  box(m, 47, -8, -15, 16, 3, 3, colors.pearl);
  box(m, -8, 4, 14, 10, 6, 2, colors.orange);
  box(m, -9, 6, 15.5, 6, 1, 1, colors.gold);
  box(m, -25, 8, 15, 13, 2, 2, colors.shadow);
  // Raised cockpit, bolted armor, and an exposed gun rail.
  extrude(m, [[-5, 14], [5, 27], [19, 23], [32, 10], [18, 11]], 8, 3, '#294d54', '#365963');
  face(m, [[17, 14, 10], [27, 12, 10], [18, 21, 10], [6, 24, 10]], '#8bdac9', true);
  rod(m, [-28, -4, 30], [-5, -4, 30], 2, 2, '#b9cabe');
  box(m, -34, 1, 34, 5, 4, 2, '#c8c5ad');
  for (const xx of [-29, -23, -17]) box(m, xx, 5, 34, 3, 7, 2, '#273f49');
  extrude(m, [[6, 0], [27, -1], [37, -5], [10, -8]], 14, 1, '#465f66', '#526b70');
  for (const xx of [10, 20, 30]) joint(m, xx, -4, 16, 1.1, '#d1d1b5');
  box(m, -42, -2, 35, 5, 14, 2, '#dc714b');
  box(m, 0, -11, 13, 23, 3, 3, '#203843');
  models.player = m;

  // The three gunpods.
  for (const type of ['RAPID', 'LANCE', 'SWARM']) {
    m = [];
    if (type === 'RAPID') {
      box(m, -2, 0, 0, 40, 16, 15, colors.dark);
      box(m, -7, 2, 0, 23, 18, 17, colors.slate);
      box(m, -11, 2, 10, 13, 10, 5, colors.gold);
      for (const z of [-5, 5]) {
        box(m, 24, 0, z, 25, 5, 5, colors.pearl);
        box(m, 38, 0, z, 6, 6, 6, colors.dark);
      }
      box(m, 1, 10, 0, 18, 4, 13, colors.pearl);
    } else if (type === 'LANCE') {
      hull(m, [[-27, 0, 0, 8, 9], [-14, 0, 0, 11, 12], [17, 0, 0, 8, 8], [36, 0, 0, 4, 5]], colors.dark, colors.pearl);
      box(m, -2, 6, 10, 27, 4, 3, colors.teal);
      box(m, -2, -6, 10, 27, 4, 3, colors.teal);
      box(m, 30, 0, 0, 10, 13, 14, colors.slate);
      box(m, 36, 0, 0, 3, 7, 8, colors.teal);
      for (const x of [-18, -11, -4]) box(m, x, 1, 13, 2, 15, 3, colors.slate);
    } else {
      box(m, -2, 0, 0, 43, 22, 21, colors.slate);
      extrude(m, [[15, -11], [28, -8], [28, 8], [15, 11]], 0, 22, colors.dark);
      for (const yy of [-6, 6]) {
        for (const zz of [-6, 6]) {
          box(m, 29, yy, zz, 2, 7, 7, '#1e2535');
          box(m, 30, yy, zz, 2, 3, 3, '#cca9f2');
        }
      }
      box(m, -13, 12, 0, 20, 3, 24, colors.pearl);
      box(m, -9, 0, 13, 24, 10, 2, colors.orange);
    }
    models[type] = m;
  }

  m = [];
  hull(m, [[-38, 0, 0, 2, 3], [-18, 0, 0, 8, 10], [4, 0, 0, 13, 12], [28, 0, 0, 8, 8]], '#78908d', colors.dark);
  extrude(m, [[-6, 6], [17, 31], [27, 28], [20, -2]], 0, 4, colors.red);
  extrude(m, [[-6, -6], [17, -26], [28, -21], [20, 3]], 0, 4, colors.dark);
  box(m, 5, 0, 13, 18, 9, 3, colors.dark);
  box(m, -11, 0, 12, 8, 5, 4, '#ffb478');
  box(m, 28, 0, 0, 4, 8, 10, colors.orange);
  models.scout = m;

  m = [];
  hull(m, [[-58, 0, 0, 3, 5], [-33, 4, 0, 19, 19], [15, 4, 0, 25, 25], [50, 2, 0, 16, 17]], '#6d8388', '#2e3d4c');
  extrude(m, [[-28, 12], [-11, 26], [24, 24], [41, 12]], 0, 44, colors.pearl);
  extrude(m, [[9, 22], [28, 51], [43, 46], [45, 9]], -17, 5, colors.dark);
  box(m, 38, 0, 29, 27, 17, 14, colors.slate);
  box(m, 52, 0, 29, 6, 10, 10, colors.orange);
  box(m, -29, 8, 21, 16, 7, 4, '#f6b479');
  box(m, -4, 5, 26, 15, 13, 3, colors.red);
  for (const x of [7, 15, 23]) box(m, x, 3, 27, 3, 11, 2, colors.dark);
  models.carrier = m;

  m = [];
  extrude(m, [[-49, -15], [-42, 16], [-15, 31], [23, 23], [48, -3], [42, -16]], 0, 42, '#698387');
  box(m, 0, -15, 0, 91, 19, 49, colors.dark);
  for (const z of [-27, 27]) {
    extrude(m, [[-40, -23], [-51, -9], [-33, 4], [36, 4], [50, -10], [33, -23]], z, 11, colors.shadow);
    for (const x of [-30, -12, 8, 28]) joint(m, x, -10, z + 6, 9, colors.slate);
  }
  box(m, -27, 17, 22, 16, 7, 3, colors.gold);
  box(m, 24, 20, 0, 12, 30, 8, colors.dark);
  box(m, 24, 35, 0, 11, 3, 7, colors.orange);
  models.crawler = m;

  m = [];
  joint(m, 0, 0, 0, 19, colors.dark);
  joint(m, 0, 0, 6, 13, colors.slate);
  joint(m, 0, 0, 11, 6, colors.orange);
  for (let a = 0; a < TAU - 1e-6; a += TAU / 4) {
    const x = Math.cos(a), y = Math.sin(a);
    rod(m, [x * 15, y * 15, 0], [x * 32, y * 32, 0], 7, 7, colors.pearl);
  }
  models.mine = m;

  m = [];
  extrude(m, [[-110, -24], [-100, 28], [-65, 58], [32, 52], [101, 22], [110, -20], [71, -44], [-72, -44]], 0, 68, '#667a7d');
  extrude(m, [[-105, 20], [-85, 37], [-45, 40], [-51, 16]], 39, 5, colors.pearl);
  box(m, -48, 24, 45, 48, 7, 5, colors.orange);
  box(m, 27, 48, 0, 75, 18, 67, colors.dark);
  for (const z of [-49, 49]) {
    hull(m, [[-38, -21, z, 14, 15], [54, -21, z, 19, 18], [98, -21, z, 12, 12]], colors.dark, colors.slate);
    box(m, 103, -21, z, 6, 14, 13, colors.orange);
  }
  box(m, 5, 6, 40, 51, 31, 5, colors.dark);
  box(m, 5, 6, 44, 29, 8, 4, colors.gold);
  for (const x of [-17, 0, 17, 34]) box(m, x, -15, 41, 5, 6, 2, colors.slate);
  models.mini = m;

  m = [];
  extrude(m, [[-69, 69], [-34, 99], [54, 89], [91, 52], [102, -31], [66, -80], [-29, -70], [-70, -29], [-96, 13]], 0, 95, '#859692');
  extrude(m, [[-66, 61], [-28, 92], [50, 80], [64, 50], [12, 35], [-75, 30]], 53, 16, colors.pearl);
  extrude(m, [[38, 29], [90, 43], [99, -31], [67, -62], [41, -33]], 57, 13, colors.dark);
  extrude(m, [[-65, -30], [-27, -65], [42, -57], [58, -36], [3, -20]], 55, 18, colors.slate);
  box(m, -67, 25, 67, 42, 15, 6, colors.shadow);
  box(m, -74, 25, 71, 29, 5, 3, colors.orange);
  box(m, 25, 63, 66, 19, 19, 3, colors.orange);
  box(m, 25, 64, 68, 11, 3, 1, colors.gold);
  for (const x of [-28, -15, -2]) box(m, x, 73, 64, 6, 20, 6, colors.dark);
  box(m, 60, 7, 72, 15, 38, 3, colors.slate);
  for (const y of [-10, 1, 12]) box(m, 60, y, 75, 12, 4, 1, colors.shadow);
  joint(m, -34, -3, 55, 34, colors.shadow);
  joint(m, -34, -3, 61, 25, colors.slate);
  joint(m, -34, -3, 68, 18, '#695349');
  joint(m, -34, -3, 73, 9, colors.gold);
  box(m, 55, 104, -20, 6, 43, 6, colors.dark);
  box(m, 55, 127, -20, 10, 5, 8, colors.orange);
  box(m, 91, 43, 0, 37, 65, 65, colors.dark);
  box(m, 110, 39, 0, 10, 38, 49, colors.slate);
  extrude(m, [[-65, 59], [-29, 88], [43, 80], [47, 73], [-26, 78], [-55, 50]], 63, 2, '#e0dfc6', '#b9c9bb');
  extrude(m, [[69, 39], [87, 38], [94, -25], [82, -39], [74, -12]], 65, 2, '#354d56', '#3c555c');
  extrude(m, [[-23, -47], [23, -44], [36, -49], [-20, -59]], 70, 3, '#334d54');
  for (const xx of [-52, -18, 40]) joint(m, xx, 60, 73, 2.6, '#334951');
  for (const yy of [-16, -8, 0, 8, 16]) box(m, 79, yy, 72, 9, 3, 2, '#9cac9c');
  for (const xx of [-20, -9, 2, 13]) box(m, xx, -51, 74, 5, 7, 2, '#d2b47d');
  box(m, 12, 30, 62, 31, 2, 2, '#273e4a');
  box(m, 7, 24, 63, 20, 2, 2, '#273e4a');
  joint(m, -34, -3, 76, 5, '#ffdfac');
  models.boss = m;

  m = [];
  extrude(m, [[-54, -15], [-60, 7], [-29, 24], [20, 23], [42, 8], [42, -12], [16, -23], [-25, -22]], 0, 42, colors.dark);
  extrude(m, [[-25, 21], [-10, 28], [26, 22], [36, 8], [-27, 8]], 26, 8, colors.pearl);
  box(m, -43, -2, 0, 64, 17, 18, colors.slate);
  box(m, -79, -2, 0, 19, 22, 23, colors.dark);
  box(m, -85, -2, 14, 5, 11, 3, colors.orange);
  box(m, 18, 0, 31, 25, 13, 4, colors.orange);
  for (const x of [-10, 0, 10]) box(m, x, 4, 29, 3, 8, 2, colors.dark);
  joint(m, 18, -12, -3, 17, colors.slate);
  models.bossGun = m;

  /* ---- Operation 02 crafts, built the same way. */

  // Auditor: a flat sniper drone that locks on before it fires.
  m = [];
  extrude(m, [[-30, 0], [-6, 14], [24, 8], [30, 0], [24, -8], [-6, -14]], 0, 16, '#5d7177');
  extrude(m, [[-4, 13], [8, 25], [22, 23], [18, 8]], 0, 4, colors.dark);
  extrude(m, [[-4, -13], [8, -23], [20, -21], [18, -8]], 0, 4, colors.dark);
  box(m, 8, 0, 9, 26, 6, 2, colors.pearl);
  box(m, 26, 0, 0, 8, 10, 10, colors.orange);
  joint(m, -21, 0, 4, 8, colors.shadow);
  joint(m, -21, 0, 9, 5, '#a8433a');
  {
    const pts = [];
    for (let i = 0; i < 8; i++) pts.push([-21 + Math.cos((i * TAU) / 8) * 2.8, Math.sin((i * TAU) / 8) * 2.8, 13]);
    face(m, pts, '#ffcfae', true);
  }
  for (const x of [0, 8, 16]) box(m, x, 4.5, 8.5, 2, 3, 1, colors.gold);
  models.auditor = m;

  // Bailiff: an armoured gunship that hides behind a shield plate.
  m = [];
  hull(m, [[-30, 0, 0, 12, 13], [-10, 2, 0, 20, 20], [26, 2, 0, 18, 18], [48, 0, 0, 9, 10]], '#5e7378', colors.dark);
  extrude(m, [[-8, 16], [6, 34], [30, 30], [40, 14]], 0, 26, colors.pearl);
  for (const z of [-18, 18]) {
    box(m, 40, -10, z, 22, 10, 10, colors.slate);
    box(m, 52, -10, z, 4, 7, 7, colors.orange);
  }
  box(m, 10, -18, 0, 30, 6, 22, colors.dark);
  box(m, -2, 4, 19, 16, 6, 3, '#f6b479');
  for (const x of [12, 20, 28]) box(m, x, 4, 21, 3, 9, 2, colors.dark);
  models.bailiff = m;

  m = [];
  extrude(m, [[-7, -40], [4, -35], [9, 0], [4, 35], [-7, 40], [-2, 0]], 0, 30, '#7d8f8c', '#8fa19c');
  for (const y of [-26, -8, 10, 28]) extrude(m, [[-4, y - 5], [3, y - 3], [3, y + 3], [-4, y + 1]], 16, 2, colors.orange);
  box(m, 5, 0, 15, 3, 54, 2, colors.gold);
  box(m, 9, 0, 0, 6, 20, 18, colors.dark);
  models.bailiffShield = m;

  // The Underwriter: Civic Credit's flying tower, Operation 02's final boss.
  m = [];
  extrude(m, [[-100, -20], [-92, 30], [-60, 52], [40, 56], [96, 36], [108, -12], [80, -50], [-60, -48]], 0, 80, '#62737a');
  extrude(m, [[20, 50], [30, 128], [70, 128], [86, 46]], -6, 44, colors.dark);
  box(m, 50, 114, 18, 34, 10, 4, colors.orange);
  box(m, 50, 100, 18, 34, 4, 3, colors.gold);
  for (const y of [66, 78, 90]) box(m, 50, y, 17, 28, 4, 2, '#d9c58c');
  extrude(m, [[-96, 24], [-80, 44], [-40, 46], [-48, 24]], 44, 6, colors.pearl);
  extrude(m, [[-58, -44], [-20, -60], [50, -58], [64, -40], [0, -30]], 42, 10, colors.slate);
  for (const z of [-46, 46]) {
    hull(m, [[-30, -40, z, 12, 12], [60, -40, z, 16, 16], [100, -40, z, 10, 10]], colors.dark, colors.slate);
    box(m, 104, -40, z, 6, 12, 12, colors.orange);
  }
  joint(m, -64, 2, 42, 30, colors.shadow);
  joint(m, -64, 2, 48, 22, colors.slate);
  joint(m, -64, 2, 54, 15, '#4f3a52');
  joint(m, -64, 2, 59, 8, colors.gold);
  box(m, 10, 22, 42, 60, 8, 4, colors.gold);
  box(m, 70, 2, 42, 30, 40, 4, colors.slate);
  for (const y of [-12, 0, 12]) box(m, 70, y, 45, 24, 4, 2, colors.shadow);
  for (const x of [-20, -4, 12, 28]) box(m, x, -48, 48, 6, 8, 2, '#d2b47d');
  box(m, -30, 60, 0, 6, 30, 6, colors.dark);
  box(m, -30, 77, 0, 10, 4, 8, colors.orange);
  extrude(m, [[-92, 2], [-84, 20], [-74, 20], [-80, 2]], 44, 3, '#e0dfc6');
  joint(m, -64, 2, 63, 4, '#ffdfac');
  models.underwriter = m;

  // Ledger battery: the Underwriter's lobbing mortar on top of its tower.
  m = [];
  box(m, 0, 0, 0, 46, 22, 30, colors.dark);
  box(m, -4, 12, 0, 34, 6, 26, colors.slate);
  for (const x of [-14, -2, 10]) {
    box(m, x, 18, 6, 6, 12, 6, '#1e2535');
    box(m, x, 25, 6, 4, 3, 4, '#ffb478');
  }
  box(m, 24, -2, 16, 6, 10, 3, colors.orange);
  joint(m, 0, -12, 0, 12, colors.slate);
  models.battery = m;

  /* ---- Unit parts for articulated limbs (arm, boss legs, struts). Coloured per draw. */
  m = [];
  box(m, 0, 0, 0, 1, 1, 1, '#ffffff');
  models.ubox = m;
  m = [];
  joint(m, 0, 0, 0, 1, '#ffffff');
  models.ujoint = m;
  m = [];
  // The Debt Collector's foot: x relative to the foot, y in world units (the road at 686 px).
  extrude(m, [[-44, -686], [-37, -666], [21, -659], [38, -675], [35, -686]], 0, 48, '#ffffff');
  models.foot = m;

  return models;
}
