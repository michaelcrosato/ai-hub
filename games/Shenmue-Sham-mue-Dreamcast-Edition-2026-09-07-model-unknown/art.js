/* Sham-mue — texture tiles, the harbour itself, and every model the game poses.
   Content is the WebGL edition's, unchanged: the same builder calls, positions and colours.
   Textures are either JPEG files in ./textures or small canvas paintings made at load. */

import { PI, TAU, clamp, mix, add, mul, sub, cross, norm, rand, M, MeshBuilder } from './mesh.js';

/* ------------------------------------------------------------------ texture tiles */

export const T = {};
/** index → { name, file, draw(ctx) | null, alpha } ; index 0 is plain white (no texture). */
export const TILES = [];
function tile(name, draw, alpha = false) { TILES.push({ name, file: false, draw, alpha }); return TILES.length - 1; }
function file(name) { TILES.push({ name, file: true, draw: null, alpha: false }); return TILES.length - 1; }
function noise(name, base) {
  return tile(name, c => {
    c.fillStyle = base; c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 7500; i++) { const k = rand(); c.fillStyle = k > .5 ? 'rgba(255,255,235,' + (rand() * .14) + ')' : 'rgba(10,20,22,' + (rand() * .18) + ')'; const s = 1 + rand() * 2; c.fillRect(rand() * 256, rand() * 256, s, s); }
  });
}
function board(name, text, aspect = 3, bg = '#244849', fg = '#e4ddbb', subtext = '') {
  return tile(name, c => {
    const w = 600, h = w / aspect; c.scale(256 / w, 256 / h); c.fillStyle = bg; c.fillRect(0, 0, w, h); c.strokeStyle = fg; c.lineWidth = 2; c.strokeRect(8, 8, w - 16, h - 16);
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = fg;
    const ls = text.split('\n'), fs = Math.min(h * .50 / ls.length, 500 / Math.max(...ls.map(l => l.length)) * 1.55);
    c.font = 'bold ' + fs + 'px sans-serif'; ls.forEach((l, i) => c.fillText(l, w / 2, h * (subtext ? .40 : .50) + (i - (ls.length - 1) / 2) * fs * 1.2, w - 36));
    if (subtext) { c.font = Math.min(23, h * .17) + 'px sans-serif'; c.fillText(subtext, w / 2, h * .78, w - 32); }
    for (let i = 0; i < 100; i++) { c.fillStyle = 'rgba(217,204,166,.10)'; c.fillRect(rand() * w, rand() * h, rand() * 12, rand() * 3); }
  });
}

T.white = tile('white', null);
for (const n of ['concrete', 'asphalt', 'metal', 'roof', 'wood', 'brick', 'paint']) T[n] = file(n);
T.cloth = noise('cloth', '#dbd9cf');
T.water = noise('water', '#41676a');
T.glass = tile('glass', c => { const g = c.createLinearGradient(0, 0, 256, 256); g.addColorStop(0, '#96b7b8'); g.addColorStop(.5, '#58767a'); g.addColorStop(1, '#2d484e'); c.fillStyle = g; c.fillRect(0, 0, 256, 256); c.fillStyle = '#bdd2ce44'; c.beginPath(); c.moveTo(30, 0); c.lineTo(84, 0); c.lineTo(226, 256); c.lineTo(172, 256); c.fill(); });
T.windows = file('windows');
T.shutter = file('shutter');
T.hazard = tile('hazard', c => { c.fillStyle = '#d1b55c'; c.fillRect(0, 0, 256, 256); c.fillStyle = '#323d39'; for (let x = -256; x < 512; x += 64) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 32, 0); c.lineTo(x + 288, 256); c.lineTo(x + 256, 256); c.fill(); } });
T.wh1 = board('WH 01', '01', 1, '#c6c7b3', '#244449', 'WAREHOUSE');
T.wh3 = board('WH 03', '03', 1, '#c6c7b3', '#244449', 'WAREHOUSE');
T.wh8 = board('WH 08', '08', 1, '#b0b8a9', '#253f41', 'WAREHOUSE');
T.tea = board('tea', 'BREAKWATER TEA', 5, '#263e39', '#efdbaf', 'HOT TEA   ·   LUNCH   ·   SINCE 1962');
T.drink = board('drink', 'SUN POP', 2, '#a4382d', '#ffe6b5', 'COLD DRINKS  /  ¥100');
T.darts = board('darts', 'LUCKY DARTS', 2, '#b17836', '#f4e5bb', 'THREE THROWS · ¥50');
T.freight = board('freight', 'FREIGHT OFFICE', 3, '#234c57', '#dfdfbd', 'MANIFESTS · DAILY SCHEDULE');
T.bus = board('bus', 'NAGAMATSU', 3, '#d6dbc4', '#29474b', 'HARBOUR  /  TERMINUS');
T.storage = board('storage', 'KITA SHIPPING', 4, '#365863', '#e1d8b8', 'INTERNATIONAL FREIGHT');
T.safety = board('safety', 'SAFETY\nFIRST', 1, '#d8d9b8', '#244a41', 'KEEP CLEAR');
T.capsule = board('capsule', 'POCKET\nPORT', 1, '#d1ae5f', '#5b4538', 'CAPSULE TOYS · ¥100');
T.gate = board('gate', 'NAGAMATSU HARBOUR', 6, '#194348', '#e5d6a6', 'EAST GATE   /   AUTHORIZED VEHICLES ONLY');
T.tag = board('tag', 'KITA / 08', 2, '#d8c99b', '#354543', 'HANDLE WITH CARE');
T.menu = board('menu', 'TEA  ¥80\nFISH BUN  ¥80\nLUNCH  ¥350', .8, '#eee4c5', '#314444');
T.notice = tile('notice', c => { c.fillStyle = '#37534e'; c.fillRect(0, 0, 256, 256); for (let i = 0; i < 6; i++) { const x = 12 + (i % 3) * 80, y = 12 + Math.floor(i / 3) * 118; c.fillStyle = i === 1 ? '#eddfa7' : '#d3cdb1'; c.fillRect(x, y, 71, 107); c.fillStyle = '#5b6d68'; c.fillRect(x + 7, y + 10, 57, 6); for (let a = 0; a < 8; a++) c.fillRect(x + 7, y + 26 + a * 8, 35 + rand() * 22, 2); c.fillStyle = '#a24b3d'; c.beginPath(); c.arc(x + 53, y + 86, 9, 0, TAU); c.strokeStyle = '#a24b3d'; c.stroke(); } });
T.face = file('face');
T.lantern = board('lantern', '港\n茶', .6, '#d2a75d', '#672e24');
T.poster = board('poster', 'THE BLUE\nHORIZON', .75, '#386873', '#eee1b8', 'KOBE · DAILY FERRY');
T.door = board('door', 'OFFICE', 2, '#315052', '#d9d5b4');
for (const n of ['skinNew', 'hair', 'faceOlder', 'faceWoman', 'faceWorker', 'jacketFront', 'jacketBack', 'leather', 'denim', 'uniform', 'uniformFront', 'uniformBack', 'shopGlass', 'faceBlink', 'faceOlderBlink', 'faceWomanBlink']) T[n] = file(n);
T.contact = tile('contact', c => { const g = c.createRadialGradient(128, 128, 20, 128, 128, 120); g.addColorStop(0, 'rgba(10,12,15,.33)'); g.addColorStop(.4, 'rgba(10,12,15,.22)'); g.addColorStop(1, 'rgba(10,12,15,0)'); c.fillStyle = g; c.fillRect(0, 0, 256, 256); }, true);
T.dirt = tile('dirt', c => { const g = c.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, 'rgba(28,25,19,0)'); g.addColorStop(.6, 'rgba(36,34,23,.18)'); g.addColorStop(1, 'rgba(32,32,23,.63)'); c.fillStyle = g; c.fillRect(0, 0, 256, 256); for (let i = 0; i < 2000; i++) { c.fillStyle = 'rgba(25,26,21,' + (rand() * .14) + ')'; c.fillRect(rand() * 256, 120 + rand() * 136, rand() * 6, rand() * 22); } }, true);
for (const n of ['teaJapan', 'kita', 'work', 'postJapan', 'noEntry', 'shopSign', 'brake']) T[n] = file(n);
T.leaves = tile('leaves', c => { for (let i = 0; i < 280; i++) { const x = 128 + (rand() - .5) * 210, y = 128 + (rand() - .5) * 210, k = rand(); if ((x - 128) ** 2 + (y - 128) ** 2 > 115 ** 2) continue; c.fillStyle = ['#34463a', '#526149', '#79816a', '#374e42'][Math.floor(k * 4)]; c.beginPath(); c.ellipse(x, y, 5 + rand() * 11, 3 + rand() * 5, rand() * PI, 0, TAU); c.fill(); } }, true);
// New for the yard run: a banner in the same hand-painted board style.
T.yardrun = board('yardrun', 'YARD RUN', 4, '#d19a41', '#2d342f', 'GATES IN ORDER  ·  KEEP IT MOVING');

/* ------------------------------------------------------------------ the static harbour */

export const obstacles = [];
const obstacle = (x, z, w, d, id = '') => obstacles.push({ x, z, w, d, id });
let S = null;
function box(x, y, z, w, h, d, tx, col = '#fff', tile = 0) { S.box(x, y, z, w, h, d, tx, col, tile); }
function label(x, y, z, w, h, tx, yaw = 0, col = '#ffffff') { S.plane(x, y, z, w, h, tx, col, yaw); }
function groundRect(x, z, w, d, col, y = .025, tx = T.white) { S.push(x, y, z).rotateX(-PI / 2); if (tx === T.asphalt || tx === T.concrete) S.quad([-w / 2, -d / 2, 0], [w / 2, -d / 2, 0], [w / 2, d / 2, 0], [-w / 2, d / 2, 0], tx, col, w / 3, d / 3); else S.plane(0, 0, 0, w, d, tx, col); S.pop(); }
function warehouse(x, z, num, w = 18, d = 20, h = 7.2) {
  obstacle(x, z, w, d, 'warehouse'); box(x, h / 2, z, w, h, d, T.metal, '#e9e8e1', 3.0); box(x, .22, z, w + .25, .44, d + .25, T.concrete, '#8c9183', 2);
  S.quad([x - w / 2 - .5, h, z + d / 2 + .5], [x, h + 2.4, z + d / 2 + .5], [x, h + 2.4, z - d / 2 - .5], [x - w / 2 - .5, h, z - d / 2 - .5], T.roof, '#d4d5c2', 4, 7);
  S.quad([x, h + 2.4, z + d / 2 + .5], [x + w / 2 + .5, h, z + d / 2 + .5], [x + w / 2 + .5, h, z - d / 2 - .5], [x, h + 2.4, z - d / 2 - .5], T.roof, '#c0c8b9', 4, 7);
  S.tri([x - w / 2, h, z + d / 2], [x + w / 2, h, z + d / 2], [x, h + 2.4, z + d / 2], T.metal, '#c8cebd'); S.tri([x + w / 2, h, z - d / 2], [x - w / 2, h, z - d / 2], [x, h + 2.4, z - d / 2], T.metal, '#c8cebd');
  for (let dz = -d / 2 + .5; dz < d / 2; dz += 5) { box(x - w / 2 - .07, h / 2, z + dz, .2, h, .20, T.paint, '#727c70'); box(x + w / 2 + .07, h / 2, z + dz, .2, h, .2, T.paint, '#727c70'); }
  label(x - w / 2 - .12, 2.1, z, 7, 4.15, T.shutter, -PI / 2); label(x - w / 2 - .13, 5.55, z, 1.75, 1.75, num === 1 ? T.wh1 : num === 3 ? T.wh3 : T.wh8, -PI / 2);
  for (const a of [-1, 1]) label(x - w / 2 - .09, 5.5, z + a * 6.4, 4.4, 1.25, T.windows, -PI / 2);
  box(x - w / 2 - .17, 4.28, z, .4, .2, 7.5, T.paint, '#485d52'); groundRect(x - w / 2 - 1.3, z, 2.3, 7.4, '#bfc0a5', .027, T.hazard);
  label(x - w / 2 - .11, 1.3, z - 7.5, 1.1, 2.3, T.shutter, -PI / 2); label(x - w / 2 - .13, 2.9, z - 7.5, 1.25, .5, T.door, -PI / 2);
  for (const a of [-1, 1]) { box(x - w / 2 - .25, 1.2, z + a * 4, .12, 2.4, .12, T.paint, '#758677'); box(x - w / 2 - .4, 3.65, z + a * 4, .5, .12, .4, T.white, '#293d3c'); S.plane(x - w / 2 - .65, 3.57, z + a * 4, .1, .25, T.white, '#eee4aa', -PI / 2, 1); }
  box(x, .3, z + d / 2 + .08, w, .6, .12, T.concrete, '#626e64'); label(x, 6.7, z + d / 2 + .03, w * .6, 1.1, T.storage);
  for (const xx of [-1, 1]) { box(x + xx * w * .3, h + 1.1, z, 1.3, 1.4, 1.3, T.metal, '#818e80'); box(x + xx * w * .3, h + 1.87, z, 1.7, .16, 1.7, T.roof); }
}
export function crate(b, x, y, z, sz = 1.35, stamp = true) {
  b.box(x, y + sz / 2, z, sz, sz, sz, T.wood, '#f1e7d1', 0);
  for (const a of [-1, 1]) { b.box(x + a * sz * .4, y + sz / 2, z, sz * .09, sz + .02, sz + .03, T.wood, '#bfa374'); b.box(x, y + sz / 2, z + a * sz * .4, sz + .03, sz + .02, sz * .09, T.wood, '#c2a574'); }
  b.box(x, y + sz * .07, z, sz + .10, sz * .10, sz + .10, T.wood, '#8e7956'); if (stamp) b.plane(x, y + sz * .55, z + sz / 2 + .025, sz * .6, sz * .3, T.tag);
}
function containerCargo(x, y, z, color, yaw = 0) {
  S.push(x, y, z, yaw); S.box(0, 1.3, 0, 8, 2.6, 3.05, T.metal, color, 2);
  for (const zz of [-1.56, 1.56]) { S.box(0, .12, zz, 8.08, .22, .14, T.paint, color); S.box(0, 2.48, zz, 8.08, .20, .14, T.paint, color); for (const xx of [-3.9, 3.9]) S.box(xx, 1.3, zz, .15, 2.6, .14, T.paint, '#a4aaa0'); }
  S.plane(0, 1.5, 1.535, 4, .6, T.storage); S.pop(); if (y === 0) obstacle(x, z, yaw ? 3.1 : 8, yaw ? 8 : 3.1, 'container');
}
// Barrels and lamp poles now block like every other prop (they could be walked through before).
function barrel(x, z, c = '#596f70') { S.cylinder(x, .52, z, .35, .35, 1.04, T.paint, c, 12); for (const y of [.12, .50, .92]) S.cylinder(x, y, z, .365, .365, .07, T.white, '#344443', 12); obstacle(x, z, .72, .72, 'barrel'); }
function pole(x, z) { box(x, 5.4, z, .2, 10.8, .2, T.wood, '#677260'); box(x, 10.2, z, 2.5, .15, .2, T.paint, '#747768'); for (const a of [-1, 0, 1]) S.cylinder(x + a * .9, 10.4, z, .09, .09, .35, T.white, '#d4d3b7', 8); obstacle(x, z, .3, .3, 'pole'); }
function cable(a, b, sag = .7) { for (let i = 0; i < 16; i++) { const p = add(mul(a, 1 - i / 16), mul(b, i / 16)), q = add(mul(a, 1 - (i + 1) / 16), mul(b, (i + 1) / 16)); p[1] -= Math.sin(i / 16 * PI) * sag; q[1] -= Math.sin((i + 1) / 16 * PI) * sag; S.beam(p, q, .022, T.white, '#3e4c48'); } }
function crane(x, z, scale = 1) {
  S.push(x, 0, z);
  for (const a of [-1, 1]) for (const b of [-1, 1]) { S.beam([a * 2, 0, b * 2], [a * 1.15, 14 * scale, b * 1.15], .26, T.paint, '#a58c53'); for (let y = 1; y < 13 * scale; y += 3) { S.beam([a * 2, y, -1.7], [a * 1.3, y + 3, 1.4], .10, T.white, '#677264'); S.beam([-1.7, y, b * 2], [1.4, y + 3, b * 1.3], .10, T.white, '#677264'); } }
  S.box(0, 14 * scale, 0, 3.5, .7, 3.2, T.paint, '#b09a5e'); S.box(.9, 15 * scale, 0, 2, 1.6, 2.2, T.metal, '#b3a270'); S.plane(.9, 15.2, 1.11, 1.5, .9, T.glass);
  S.beam([0, 14.6 * scale, 0], [-13, 16 * scale, -3], .3, T.paint, '#b8a163'); S.beam([0, 16.2 * scale, 0], [-13, 16 * scale, -3], .2, T.paint, '#b8a163');
  for (let i = 0; i < 7; i++) { const a = i / 7, b = (i + 1) / 7; S.beam([-13 * a, 14.6 * scale + 1.4 * scale * a, -3 * a], [-13 * b, 16.2 * scale - .2 * scale * b, -3 * b], .09, T.paint, '#88794f'); }
  S.beam([-12, 16 * scale, -2.8], [-12, 6, -2.8], .036, T.white, '#344849'); S.cylinder(-12, 5.8, -2.8, .2, .16, .35, T.white, '#344849', 8); S.pop(); obstacle(x, z, 3.5, 3.5, 'crane');
}
function buildWorld() {
  // The quay, open water, and road markings.
  S.box(-154, -.75, -35, 242, .1, 540, T.water, '#b3c6bc', 25, 2); box(0, -.45, -3, 66, .9, 80, T.concrete, '#eeeeeb', 4); groundRect(1, -2, 24, 76, '#d4d4cf', .007, T.asphalt);
  for (let z = -39; z < 34; z += 5) { groundRect(1, z, .10, 2.5, '#c8bc88'); groundRect(-11.1, z, .08, 2.8, '#d0c297'); } groundRect(12.8, -2, .12, 76, '#b3ad87');
  for (let z = -39; z < 35; z += 4) { box(-32.65, .07, z, .55, .14, 3.9, T.hazard, '#cac0a0'); S.cylinder(-31.5, .38, z, .15, .19, .75, T.paint, '#424f4b', 8); if (z < 30) S.beam([-31.5, .66, z], [-31.5, .66, z + 4], .06, T.paint, '#737e70'); }
  for (let z = -32; z < 31; z += 12) { box(-12, .027, z, .45, .04, 1.1, T.white, '#344743'); for (let i = 0; i < 8; i++) box(-12, .053, z - .5 + i * .14, .47, .016, .04, T.paint, '#889386'); }
  for (let i = 0; i < 75; i++) { const x = rand() * 43 - 30, z = rand() * 75 - 40; S.push(x, .015, z, rand() * 6); S.tri([0, 0, 0], [rand() * 2 + .1, 0, rand() * .6], [.5, 0, .014], T.white, '#65746c'); S.pop(); }
  for (const [x, z, w, d] of [[-16, 9, 4, 1.2], [6, 7, 2.8, 1.1], [-5, -6, 3, 1.6], [-23, -7, 2.3, 1.1], [8, -23, 4, 1.4]]) { S.push(x, .02, z); S.sphere(0, 0, 0, w / 2, .008, d / 2, T.water, '#bbc3ad', 2, 11); S.pop(); }
  warehouse(25, 24, 1, 18, 20, 7.2); warehouse(25, 0, 3, 18, 22, 7.4); warehouse(25, -28, 8, 18, 24, 8.0);
  // Tea shop: canopy, hand-painted menu, stools, and small details.
  obstacle(-22, 22, 9, 6, 'tea'); box(-22, 1.65, 22, 9, 3.3, 6, T.brick, '#c2b59a', 2); box(-22, 3.55, 22, 9.8, .35, 6.8, T.roof, '#949c87', 3); label(-22, 2.85, 25.03, 8.2, 1.05, T.tea);
  for (const x of [-24.8, -21.8]) { label(x, 1.65, 25.05, 2.4, 1.4, T.glass); box(x, 1.02, 25.2, 2.7, .18, .35, T.wood, '#a9ad8b'); } label(-18.35, 1.35, 25.06, 1.2, 2.1, T.shutter); label(-26.4, 1.8, 25.08, .65, .95, T.menu);
  S.quad([-26.8, 2.68, 25.1], [-17.2, 2.68, 25.1], [-17.2, 2.34, 27.2], [-26.8, 2.34, 27.2], T.cloth, '#3f756e', 4, 1); for (let x = -26.6; x < -17.4; x += 1.2) { S.quad([x, 2.68, 25.11], [x + .5, 2.68, 25.11], [x + .5, 2.34, 27.21], [x, 2.34, 27.21], T.cloth, '#ceccb1'); }
  for (const x of [-26.5, -17.5]) { box(x, 1.17, 27.1, .075, 2.34, .075, T.paint, '#446158'); S.sphere(x + .25, 2.25, 26, .25, .4, .25, T.paint, '#e4b871'); S.plane(x + .25, 2.25, 26.24, .24, .5, T.lantern, '#fff', 0, 1); }
  box(-22, .73, 26.1, 4, .16, .72, T.wood, '#a59a75'); for (const x of [-23.5, -20.5]) { box(x, .35, 26.1, .12, .7, .3, T.wood); S.cylinder(x, .76, 26.05, .085, .085, .17, T.white, '#cdd5b2', 10); }
  for (const x of [-24.3, -22, -19.7]) { box(x, .5, 27.25, .58, .12, .58, T.wood, '#b4a87d'); for (const dx of [-.2, .2]) box(x + dx, .25, 27.25, .08, .5, .42, T.wood, '#6c7964'); }
  // Vending machine with glass display and lit rows of tiny cans.
  obstacle(-14.2, 24, 1.8, 1.4, 'vending'); box(-14.2, 1.3, 24, 1.8, 2.6, 1.4, T.paint, '#b14836'); label(-14.2, 2.15, 24.72, 1.6, .66, T.drink); label(-14.36, 1.35, 24.715, 1.25, 1.02, T.glass);
  for (let r = 0; r < 2; r++) for (let i = 0; i < 5; i++) { const x = -14.85 + i * .25, y = 1.12 + r * .42; S.cylinder(x, y, 24.77, .065, .065, .21, T.white, ['#c9ad60', '#b8c3b9', '#659ea0', '#a74a39', '#e0c98d'][i], 8); box(x, y - .17, 24.78, .1, .035, .015, T.white, '#ece1ad'); }
  box(-13.55, 1.3, 24.77, .14, .12, .1, T.white, '#d4c79b'); box(-14.35, .48, 24.73, .85, .2, .04, T.white, '#253c3d'); label(-14.25, 2.52, 24.74, 1.6, .1, T.white, 0, '#f5d091');
  obstacle(-11.3, 24, .85, .8, 'capsule'); box(-11.3, .55, 24, .8, 1.1, .75, T.paint, '#b7763e'); S.sphere(-11.3, 1.45, 24, .45, .47, .42, T.glass, '#d5d0a2'); label(-11.3, 1.02, 24.41, .68, .7, T.capsule); S.cylinder(-11.1, .68, 24.42, .07, .07, .07, T.white, '#d5d3b6');
  for (let i = 0; i < 8; i++) S.sphere(-11.55 + rand() * .45, 1.24 + rand() * .24, 24.12 + rand() * .12, .095, .09, .09, T.white, ['#b3523d', '#c9b267', '#719698'][i % 3]);
  // Darts alcove on the west side of the kiosk.
  box(-26.65, 1.1, 20.2, .7, 2.2, 1.7, T.paint, '#486766'); label(-27.01, 1.8, 20.2, 1.5, .6, T.darts, -PI / 2);
  S.push(-27.03, 1.06, 20.2, -PI / 2).rotateX(PI / 2); S.cylinder(0, 0, 0, .48, .48, .04, T.white, '#2f443e', 20); S.cylinder(0, -.024, 0, .32, .32, .045, T.white, '#c5c0a0', 20); S.cylinder(0, -.05, 0, .08, .08, .045, T.white, '#a1473c', 12); S.pop();
  groundRect(-28.8, 20.2, .1, 1.8, '#d5bf7d');
  // Gate office and barrier.
  obstacle(6.5, 30.6, 3.4, 3.2, 'guard'); box(6.5, 1.5, 30.6, 3.4, 3, 3.2, T.paint, '#c4c7b0'); box(6.5, 3.1, 30.6, 3.8, .2, 3.6, T.roof, '#84918a'); label(6.5, 1.85, 32.23, 2.8, 1.05, T.windows); label(4.77, 1.8, 30.6, 2.6, 1.1, T.windows, -PI / 2); label(6.5, 2.7, 32.25, 2.6, .5, T.bus); label(6.5, 1.2, 28.96, 1, 1.3, T.poster, PI);
  for (const x of [-9, 11]) { box(x, 3.6, 35, .28, 7.2, .28, T.paint, '#637f72'); box(x, .35, 35, .65, .7, .65, T.concrete); }
  label(1, 6.15, 35.02, 19.5, 2.5, T.gate); label(1, 6.15, 34.98, 19.5, 2.5, T.gate, PI);
  box(9.5, .65, 34, 1.1, 1.3, 1.1, T.paint, '#858975'); S.beam([9.5, 1.3, 34], [9.5, 5.3, 35.6], .14, T.hazard, '#d8c695');
  // Benches and bus stop.
  for (const x of [-28.5, 10]) { const z = x < 0 ? 29 : 22; box(x, .65, z, 3.3, .15, .75, T.wood, '#b4b494'); box(x, .95, z - .3, 3.3, .55, .11, T.wood, '#b4b494'); for (const dx of [-1.2, 1.2]) box(x + dx, .3, z, .12, .6, .65, T.white, '#415a52'); obstacle(x, z, 3.3, .8, 'bench'); }
  box(-6, 1.8, 33, .09, 3.6, .09, T.paint, '#a0ad9c'); label(-6, 2.9, 33.05, 1.1, 1.05, T.bus); label(-6, 1.8, 33.055, .7, 1.0, T.notice);
  // Work yard, destination, signs and shipping clutter.
  groundRect(9, -10, 6, 7, '#809487'); for (const x of [6, 12]) groundRect(x, -10, .12, 7, '#d9be77'); for (const z of [-13.5, -6.5]) groundRect(9, z, 6, .12, '#d9be77'); S.push(9, .04, -10).rotateX(-PI / 2); S.plane(0, 0, 0, 2.6, 2.6, T.wh3); S.pop();
  for (const z of [-21, -15]) { groundRect(-6, z, 10, .1, '#c7bc8f'); } for (const x of [-11, -1]) groundRect(x, -18, .1, 6, '#c7bc8f');
  label(15.72, 2.5, -5.4, 3.4, 1.1, T.freight, -PI / 2); label(15.70, 1.4, -5.4, 2.7, 1.4, T.notice, -PI / 2); label(15.7, 2.5, 8, 1.05, 1.2, T.safety, -PI / 2);
  containerCargo(-24, -0.0, -18, '#768d83'); containerCargo(-24, 2.65, -18, '#aa6d51'); containerCargo(-24, 0, -30, '#597987'); containerCargo(-24, 2.65, -30, '#aa9c73'); containerCargo(-22, 0, -7, '#9b7458');
  for (const [x, z, sz] of [[-17, -27, 1.4], [-17, -25, 1.6], [10, 7, 1.5], [13, 10, 1.2], [-22, 7, 1.5], [-24, 9, 1.3], [-19, -33, 1.4]]) { crate(S, x, 0, z, sz); obstacle(x, z, sz, sz, 'cargo'); } crate(S, 10, 1.5, 7, 1.25);
  for (const [x, z] of [[13, 12], [12, 13], [13.1, 13.2], [-29, 5], [-28, 5.3], [-18, -10], [-18.5, -9], [-29, -38]]) barrel(x, z);
  for (const [x, z] of [[-19, 9], [13, 16], [-16, -4]]) { for (let y = 0; y < .35; y += .12) { for (let i = 0; i < 5; i++) box(x - .6 + i * .3, y + .05, z, .22, .10, 1.5, T.wood, '#8b987e'); } obstacle(x, z, 1.5, 1.5, 'pallet'); }
  // Lamps, cables and cranes.
  for (const z of [-36, -12, 12]) { pole(-12.5, z); box(-12.5, 8.6, z, 2, .1, .12, T.paint, '#536f64'); box(-11.6, 8.45, z, .65, .14, .34, T.white, '#b9b597'); for (const a of [-.9, 0, .9]) if (z < 12) cable([-12.5 + a, 10.5, z], [-12.5 + a, 10.5, z + 24]); }
  crane(-28, -39, .95); crane(-28, 0, 1.05);
  // Fence at the north end.
  for (let x = -31; x < 34; x += 3) { box(x, 1.05, -41, .06, 2.1, .06, T.white, '#6d8377'); S.beam([x, .2, -41], [x + 3, 1.9, -41], .02, T.white, '#7b8d7e'); S.beam([x, 1.9, -41], [x + 3, .2, -41], .02, T.white, '#7b8d7e'); } box(1, 2, -41, 65, .035, .035, T.white, '#6b8072');
  // Distant port and hillside.
  for (let i = 0; i < 70; i++) { const x = -350 + i * 10, h = x => 23 + Math.sin(x * .024) * 9 + Math.sin(x * .052) * 3 + Math.sin(x * .113) * 1.8; S.quad([x, -6, -205], [x + 10, -6, -205], [x + 10, h(x + 10), -205], [x, h(x), -205], T.white, '#658585', 1, 1, 1); }
  box(20, 0, -65, 150, .5, 9, T.concrete, '#8c9b8d', 5);
}
function pipe(a, b, r = .04, col = '#686c60') { S.beam(a, b, r, T.paint, col); }
function windowFrame(x, y, z, w, h, yaw = 0) {
  S.push(x, y, z, yaw); S.box(0, 0, -.028, w + .13, h + .12, .06, T.paint, '#646d68'); S.plane(0, 0, .008, w, h, T.windows);
  for (const dx of [-w / 2, w / 2]) S.box(dx, 0, .018, .042, h, .034, T.paint, '#bdb9a6'); for (const dy of [-h / 2, h / 2]) S.box(0, dy, .018, w, .044, .034, T.paint, '#bdb9a6');
  S.box(0, -h / 2 - .045, .07, w + .18, .060, .18, T.paint, '#aaa793'); S.pop();
}
function plant(x, z, s = 1) {
  S.cylinder(x, .21 * s, z, .21 * s, .28 * s, .42 * s, T.paint, '#8b6950', 12); S.cylinder(x, .432 * s, z, .24 * s, .24 * s, .022 * s, T.wood, '#4d4937', 10);
  for (let i = 0; i < 5; i++) { const a = i / 5 * TAU, xx = x + Math.sin(a) * .12 * s, zz = z + Math.cos(a) * .12 * s; S.beam([x, .40 * s, z], [xx, .98 * s, zz], .016 * s, T.wood, '#536645'); S.plane(xx, .98 * s, zz, .63 * s, .72 * s, T.leaves, '#fff', a, 6); }
}
function bicycle(x, z, yaw) {
  S.push(x, 0, z, yaw);
  for (const zz of [-.66, .66]) { S.push(0, .34, zz).rotateZ(PI / 2); S.torus(0, 0, 0, .32, .026, T.white, '#292e2c', 24, 5); S.torus(0, 0, 0, .283, .011, T.white, '#b9b9a7', 24, 4); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; S.beam([0, 0, 0], [Math.sin(a) * .28, 0, Math.cos(a) * .28], .004, T.white, '#a4a9a4'); } S.pop(); }
  const nodes = [[0, .34, .66], [0, .79, .37], [0, .28, .10], [0, .83, -.44], [0, .34, -.66]];
  for (const [i, j] of [[0, 1], [1, 2], [2, 0], [1, 3], [3, 2], [3, 4]]) S.beam(nodes[i], nodes[j], .030, T.paint, '#467678');
  S.beam([0, .80, .35], [0, .93, .39], .03, T.white, '#b1b6b0'); S.roundBox(0, .95, .41, .19, .05, .30, .07, T.cloth, '#2b322d'); S.beam([0, .83, -.44], [0, 1.08, -.42], .021, T.white, '#bfc3b8'); S.beam([-.25, 1.08, -.42], [.25, 1.08, -.42], .022, T.white, '#c4c9c1'); for (const side of [-1, 1]) S.beam([side * .16, 1.08, -.42], [side * .25, 1.08, -.42], .031, T.white, '#303a35');
  S.box(0, .80, .80, .36, .025, .51, T.paint, '#9ca799'); S.beam([-.17, .8, 1.03], [-.06, .35, .66], .015, T.white, '#a9b1a4'); S.beam([.17, .8, 1.03], [.06, .35, .66], .015, T.white, '#a9b1a4'); S.pop(); obstacle(x, z, .6, 1.9, 'bicycle');
}
function pickup(x, z, yaw) {
  S.push(x, 0, z, yaw);
  S.roundBox(0, .63, 0, 1.7, .45, 4.10, .10, T.paint, '#b4c6bc'); S.roundBox(0, 1.10, -1.16, 1.69, .63, 1.47, .11, T.paint, '#d5dac9'); S.roundBox(0, 1.58, -1.08, 1.63, .55, 1.24, .11, T.paint, '#dde0cf'); S.box(0, 1.88, -1.08, 1.7, .06, 1.34, T.paint, '#c7cebf'); S.plane(0, 1.59, -1.708, 1.40, .40, T.glass, '#b5cece', PI, 4);
  for (const s of [-1, 1]) { S.plane(s * .851, 1.58, -1.05, .91, .40, T.glass, '#9db2b5', s * PI / 2, 4); S.box(s * .94, 1.45, -1.51, .15, .15, .1, T.paint, '#777f74'); S.box(s * .860, 1.22, -.62, .018, .038, .16, T.white, '#c6c7bd'); }
  S.box(0, .80, 1.01, 1.4, .11, 1.98, T.wood, '#c2bba1', 2); for (const s of [-1, 1]) S.box(s * .792, 1.03, .93, .1, .43, 2.08, T.paint, '#c4cbb9'); S.box(0, 1.03, 1.974, 1.57, .43, .08, T.paint, '#cad0bd'); S.box(0, .60, -2.10, 1.76, .15, .11, T.paint, '#838f85'); S.box(0, .86, -2.074, .83, .21, .015, T.white, '#35403a');
  for (const s of [-1, 1]) { S.box(s * .57, .91, -2.083, .33, .18, .02, T.white, '#dddac5', 0, 1); S.box(s * .75, .69, -2.085, .11, .11, .02, T.white, '#b87a39'); }
  for (const s of [-1, 1]) for (const zz of [-1.38, 1.30]) { S.push(s * .85, .40, zz).rotateZ(PI / 2); S.cylinder(0, 0, 0, .36, .36, .17, T.cloth, '#222a27', 20); S.cylinder(0, s < 0 ? .09 : -.09, 0, .19, .19, .021, T.paint, '#a4b2aa', 16); S.pop(); }
  crate(S, -.31, .87, .94, .66, false); crate(S, .36, .87, 1.11, .60, false); S.pop(); obstacle(x, z, 4.3, 1.9, 'truck');
}
function buildDetails() {
  // Water also lies beyond the gate, so no camera angle reveals an empty white edge.
  S.box(0, -.86, -20, 800, .05, 800, T.water, '#fff', 25, 2);
  // Warehouse foundations, frame joints, rain pipes, hooded lamps and electrical boxes.
  for (const [z, d, h] of [[24, 20, 7.2], [0, 22, 7.4], [-28, 24, 8]]) {
    box(15.94, .48, z, .18, .95, d + .08, T.concrete, '#7c817c', 2);
    S.plane(15.815, .94, z, d, 1.8, T.dirt, '#fff', -PI / 2, 5);
    for (let zz = z - d / 2 + .4; zz < z + d / 2; zz += 2.55) { box(15.84, 3.9, zz, .055, 6.9, .08, T.paint, '#a7ada2'); for (const y of [1.4, 4.5, 6.7]) box(15.80, y, zz, .034, .068, .14, T.paint, '#6c7770'); }
    for (const zz of [z - d / 2 + .3, z + d / 2 - .3]) { S.cylinder(15.48, h / 2, zz, .065, .065, h, T.paint, '#8a9183', 10); for (let y = 1; y < h; y += 1.4) box(15.48, y, zz, .18, .08, .18, T.paint, '#555e55'); pipe([15.48, .45, zz], [15.13, .19, zz], .09, '#747c6d'); }
    pipe([15.61, h + .06, z - d / 2], [15.61, h + .06, z + d / 2], .20, '#767f76'); pipe([15.70, 3.05, z - d / 2], [15.70, 3.05, z - 4.1], .026, '#68756c');
    for (const sign of [-1, 1]) {
      const zz = z + sign * 4.0; box(15.55, 2.01, zz, .13, 4.10, .15, T.paint, '#646c61'); box(15.40, 3.25, zz, .5, .34, .47, T.paint, '#3d4c46'); box(15.40, 3.058, zz, .39, .027, .38, T.white, '#e4d9b3', 0, 1);
      box(15.63, 1.75, z + sign * 8.6, .27, .64, .49, T.paint, '#788278'); S.plane(15.482, 1.78, z + sign * 8.6, .38, .43, T.work, '#d3ccb3', -PI / 2);
    }
    // Real framing in front of the upper panes, rather than just a flat decal.
    for (const zz of [z - 6.4, z + 6.4]) windowFrame(15.77, 5.5, zz, 4.4, 1.26, -PI / 2);
    label(15.66, 6.92, z, 4.75, .69, T.kita, -PI / 2);
    S.beam([15.45, 4.31, z - 3.9], [15.45, 4.31, z + 3.9], .12, T.paint, '#c2c1ad');
  }
  // Add actual locks, corner castings and seam rails to the freight containers.
  for (const [x, y, z] of [[-24, 0, -18], [-24, 2.65, -18], [-24, 0, -30], [-24, 2.65, -30], [-22, 0, -7]]) {
    for (const zz of [-1.42, 1.42]) for (const xx of [-3.88, 3.88]) box(x + xx, y + .15, z + zz, .21, .26, .20, T.paint, '#5a665d');
    for (const zz of [-.96, .96]) { pipe([x + 4.05, y + .20, z + zz], [x + 4.05, y + 2.4, z + zz], .07, '#c0c2ae'); for (const yy of [.5, 1.2, 2.1]) box(x + 4.07, y + yy, z + zz, .1, .12, .16, T.paint, '#616b5d'); box(x + 4.11, y + 1.2, z + zz, .04, .07, .44, T.paint, '#b5b59e'); }
    for (const zz of [-1.54, 1.54]) { S.plane(x, y + .62, z + zz, 7.7, 1.15, T.dirt, '#fff', zz < 0 ? PI : 0, 5); }
    label(x + 4.08, y + 2.11, z, .8, .29, T.kita, PI / 2);
  }
  // Tea shop upstairs: apartment windows, a shallow balcony, tiled roof and washing pole.
  box(-22, 5.04, 22, 9, 2.87, 6, T.paint, '#b8bbaf', 2.5); box(-22, 3.75, 25.14, 9.4, .32, .44, T.wood, '#a79c7b');
  for (const x of [-25, -21.9, -18.9]) {
    windowFrame(x, 5.23, 25.065, 1.93, 1.48); for (const side of [-1, 1]) box(x + side * 1.06, 5.23, 25.09, .16, 1.64, .08, T.wood, '#7e806b');
    box(x, 4.38, 25.48, 2.37, .08, .86, T.concrete, '#c2c1ad');
    for (let xx = x - 1.1; xx < x + 1.2; xx += .23) box(xx, 4.89, 25.83, .025, .95, .025, T.paint, '#637369'); box(x, 5.32, 25.83, 2.37, .043, .048, T.paint, '#6f7d72');
  }
  S.quad([-26.85, 6.52, 25.47], [-17.15, 6.52, 25.47], [-17.15, 7.63, 22], [-26.85, 7.63, 22], T.roof, '#c4c8c3', 3, 2);
  S.quad([-26.85, 7.63, 22], [-17.15, 7.63, 22], [-17.15, 6.52, 18.53], [-26.85, 6.52, 18.53], T.roof, '#bcc3bb', 3, 2);
  box(-22, 7.65, 22, 9.95, .15, .22, T.paint, '#758379');
  for (const x of [-26.87, -17.13]) pipe([x, 3.65, 25.04], [x, 6.55, 25.04], .09, '#778477');
  label(-22, 3.09, 25.125, 8.15, .96, T.teaJapan);
  for (const x of [-24.8, -21.8]) { S.plane(x, 1.66, 25.080, 2.37, 1.30, T.shopGlass, '#d6d6ba', 0, 4); box(x, 1.03, 25.22, 2.65, .10, .34, T.wood, '#cabd94'); }
  // Framed menus, noren cloth, tableware and small shelf goods.
  for (const x of [-18.79, -18.36, -17.94]) S.plane(x, 2.23, 25.30, .39, .55, T.cloth, '#3b6b6c');
  box(-26.92, 1.08, 26.4, .10, 1.67, .61, T.wood, '#737968'); label(-26.98, 1.20, 26.4, .61, 1.15, T.menu, -PI / 2);
  for (let i = 0; i < 5; i++) { const x = -23.8 + i * .81; S.cylinder(x, .849, 26.13, .08, .078, .17, T.paint, '#d9d7b9', 12); S.cylinder(x, .939, 26.13, .064, .064, .008, T.white, '#444936', 12); S.cylinder(x + .2, .785, 26.12, .135, .135, .022, T.paint, '#b5bfb2', 12); }
  for (const [x, z, s] of [[-26.9, 28.2, .9], [-17.0, 26.0, 1.0], [-28.7, 24.7, .8]]) plant(x, z, s);
  label(-26.58, 4.24, 24.92, .70, 1.05, T.postJapan, PI / 2);
  // Apartment air unit, brackets, wires and wall streaks.
  box(-26.58, 4.62, 21.1, .31, .64, 1.05, T.paint, '#c0c5b7'); for (let z = 20.68; z < 21.6; z += .09) box(-26.751, 4.62, z, .018, .45, .025, T.white, '#5b6a64'); pipe([-26.7, 4.38, 21.6], [-26.7, 3.8, 21.6], .04, '#b7bca9'); pipe([-26.7, 3.8, 21.6], [-26.7, 3.8, 24.4], .04, '#b7bca9');
  bicycle(-16.86, 21.2, .16); pickup(-22, 15.1, PI / 2);
  // Wheel stops, wood pallets and kerb seams ground the large props.
  for (const [x, z] of [[-10.4, 31.4], [-15.7, 17], [-15.7, 8], [-30.4, -16], [-30.4, -25]]) { box(x, .10, z, 1.45, .20, .25, T.concrete, '#a9ac9d'); }
  for (let z = -39; z < 35; z += 2.1) { box(13.05, .06, z, .27, .12, 2.02, T.concrete, '#c5c6b8'); }
  for (const [x, z] of [[13.8, -13.9], [13.6, -17], [-29.3, -20.4]]) { crate(S, x, 0, z, 1.1); obstacle(x, z, 1.1, 1.1, 'cargo'); }
  // Original notices make the port feel occupied without adding new quest targets.
  label(15.69, 1.63, -18.8, 1.4, .44, T.noEntry, -PI / 2); label(4.756, 1.03, 30.6, .85, .55, T.noEntry, -PI / 2); label(-14.2, .27, 24.751, 1.25, .20, T.drink);
  // A solid landing outside the east gate and a town backdrop beyond the playable boundary.
  box(0, -.27, 43, 69, .52, 17, T.asphalt, '#cccfc7', 4); groundRect(0, 38.8, 25, .13, '#c8c6ad');
  for (const [x, w, h, col] of [[-27, 9, 8, '#a8b2a6'], [-16, 10, 7, '#b4b3a1'], [-4, 9, 8.5, '#c0c2b3'], [8, 10, 7.4, '#a9b6b1'], [21, 12, 9, '#bbc0b4']]) {
    box(x, h / 2, 50.4, w, h, 9, T.paint, col, 3); box(x, h + .1, 50.4, w + .6, .20, 9.6, T.roof, '#909e95', 2); label(x, 3.1, 45.84, w * .8, .72, T.shopSign, PI); label(x, 1.44, 45.83, w * .73, 2.2, T.shutter, PI);
    for (let xx = x - w / 2 + 1.4; xx < x + w / 2; xx += 2.7) windowFrame(xx, h - 1.55, 45.82, 1.5, 1.7, PI);
  }
  for (const x of [-13, 13]) { pole(x, 44); cable([x, 10.4, 35], [x, 10.4, 44], .4); } cable([-13, 10.4, 44], [13, 10.4, 44], 1.0);
  // Distant cranes and factories replace the former row of bare cubes.
  for (let i = 0; i < 16; i++) {
    const x = -102 + i * 10.5, z = -96 - (i % 3) * 9, h = 5 + (i % 5) * 1.6, w = 7 + (i % 3); box(x, h / 2, z, w, h, 11, T.paint, ['#8c9f9e', '#a3aba1', '#8e9f9e'][i % 3], 4);
    box(x, h + .12, z, w + .5, .23, 11.4, T.roof, '#788c8b', 3); label(x, h - 1.7, z + 5.56, w * .84, 1.15, T.windows); for (const y of [1.5, 3]) if (h > 5) label(x, y, z + 5.57, w * .82, .8, T.windows);
    if (i % 3 === 0) { S.cylinder(x - 2, h + 3, z, .48, .44, 6, T.metal, '#81928e', 10); box(x - 2, h + 6.2, z, 1.15, .25, 1.15, T.paint, '#798b88'); }
  }
  crane(-51, -81, 1.10); crane(-81, -92, 1.22); crane(19, -89, .9);
  // A few trees above the fence, with alpha-cut leaves rather than solid green balls.
  for (const [x, z] of [[-30, 40], [-34, 30], [-33, -45], [38, -39]]) {
    S.beam([x, 0, z], [x + .2, 5.4, z], .23, T.wood, '#727769');
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU, xx = x + Math.sin(a) * 1.3, zz = z + Math.cos(a) * 1.3; S.beam([x, 3.2, z], [xx, 5.2, zz], .09, T.wood, '#777a64'); S.plane(xx, 5.7, zz, 4, 4, T.leaves, '#9dab87', a, 6); }
  }
}
/** Builds the whole static harbour once; returns the raw vertex array and fills `obstacles`. */
export function buildStatic() {
  S = new MeshBuilder(); obstacles.length = 0;
  buildWorld(); buildDetails();
  const a = S.a; S = null; return a;
}

/* ------------------------------------------------------------------ models the game moves */

export function forkChassis(p) {
  p.roundBox(0, .50, .22, 1.74, .25, 2.43, .15, T.paint, '#3e4848');
  p.roundBox(0, .80, .73, 1.65, .70, 1.35, .21, T.paint, '#d19a41', 4);
  p.roundBox(0, .89, 1.07, 1.64, .65, .66, .22, T.paint, '#d69f44', 4);
  p.plane(0, .99, 1.413, .67, .55, T.brake); p.box(0, .52, 1.44, 1.38, .16, .08, T.paint, '#384a47');
  for (const s of [-1, 1]) { p.box(s * .68, 1.11, 1.415, .12, .09, .035, T.white, '#a53e31', 0, 1); p.box(s * .76, .85, .42, .08, .03, .66, T.paint, '#ecba63'); p.roundBox(s * .77, .64, -.40, .20, .12, 1.05, .045, T.paint, '#60706a'); for (let z = -.84; z < 0; z += .12) p.box(s * .88, .71, z, .1, .022, .035, T.white, '#b3ae8f'); }
  p.box(0, .79, -.28, 1.34, .10, 1.19, T.paint, '#394c48');
  p.roundBox(0, 1.08, .33, .67, .19, .66, .075, T.leather, '#474c47'); p.roundBox(0, 1.36, .61, .67, .60, .14, .06, T.leather, '#484d47');
  for (const s of [-1, 1]) for (const z of [-.60, .73]) { p.box(s * .655, 1.87, z, .069, 1.96, .069, T.paint, '#354743'); }
  for (const s of [-1, 1]) { p.box(s * .72, 2.80, .07, .095, .09, 1.54, T.paint, '#4d5a4e'); p.box(0, 2.80, .07 + s * .74, 1.51, .09, .095, T.paint, '#4d5a4e'); }
  for (let z = -.56; z < .7; z += .19) p.box(0, 2.80, z, 1.46, .041, .055, T.paint, '#586554');
  p.box(0, 2.84, .07, 1.5, .017, 1.53, T.paint, '#a59669');
  for (const s of [-1, 1]) { p.roundBox(s * .67, 2.67, -.69, .20, .16, .20, .033, T.paint, '#526359'); p.plane(s * .67, 2.67, -.801, .145, .10, T.white, '#e9dfb4', PI, 1); }
  p.cylinder(.40, 2.94, .50, .096, .082, .17, T.paint, '#cb7b35', 16); p.cylinder(.40, 2.849, .50, .12, .12, .028, T.white, '#48524b', 16);
  // Outer rails, chains, hydraulic ram, hose and carriage.
  for (const s of [-1, 1]) { p.box(s * .55, 1.47, -1.08, .13, 2.68, .21, T.paint, '#3b4c49'); p.box(s * .455, 1.48, -1.155, .066, 2.47, .076, T.white, '#acb3a5'); for (let y = .4; y < 2.5; y += .13) p.box(s * .23, y, -1.16, .025, .057, .032, T.white, '#454f48'); }
  p.box(0, 2.77, -1.07, 1.24, .12, .21, T.paint, '#53624f'); p.cylinder(0, 1.58, -1.035, .065, .06, 2.10, T.white, '#c1c5b7', 12); p.cylinder(0, .99, -1.035, .10, .09, 1.13, T.paint, '#60746a', 12);
  p.beam([-.28, .90, -.20], [-.28, 1.47, -.60], .048, T.paint, '#536054'); p.push(-.28, 1.50, -.61).rotateX(-.65); p.torus(0, 0, 0, .214, .019, T.white, '#263833', 24, 6); for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; p.beam([0, 0, 0], [Math.sin(a) * .21, 0, Math.cos(a) * .21], .018, T.white, '#4d5c50'); } p.pop();
  p.box(.48, 1.01, -.40, .27, .19, .34, T.paint, '#525e50'); for (let i = 0; i < 2; i++) { p.beam([.43 + i * .12, 1.05, -.48], [.43 + i * .12, 1.46, -.60], .018, T.white, '#adbaa9'); p.ellipsoid(.43 + i * .12, 1.46, -.60, .033, .043, .033, T.white, '#263b33', 4, 8); }
  // The four tyres, fixed to the chassis exactly as the WebGL edition posed them.
  for (const s of [-1, 1]) for (const z of [-.73, .96]) { p.push(s * .84, .41, z).rotateZ(PI / 2); forkTire(p, s); p.pop(); }
}
function forkTire(p, s) {
  p.cylinder(0, 0, 0, .394, .394, .26, T.cloth, '#27302c', 24); p.torus(0, s < 0 ? .13 : -.13, 0, .276, .087, T.cloth, '#303631', 24, 6); p.cylinder(0, s < 0 ? .178 : -.178, 0, .211, .211, .034, T.paint, '#ba8635', 20);
  for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; p.push(Math.sin(a) * .390, 0, Math.cos(a) * .390, a); p.box(0, 0, 0, .085, .276, .026, T.white, '#40453c'); p.pop(); }
  for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; p.cylinder(Math.sin(a) * .113, s < 0 ? .204 : -.204, Math.cos(a) * .113, .018, .018, .012, T.white, '#c3c1a8', 6); }
}
export function forkCarriage(p) {
  p.box(0, .45, -1.25, 1.27, .89, .075, T.paint, '#526156'); p.box(0, .86, -1.31, 1.30, .06, .05, T.white, '#a8b19b');
  for (const s of [-1, 1]) { p.box(s * .43, .03, -1.93, .135, .070, 1.68, T.paint, '#a4aa92'); p.box(s * .43, .36, -1.18, .133, .73, .10, T.paint, '#a4ac97'); }
}
export function catModel(b) {
  b.sphere(0, .26, 0, .15, .18, .30, T.cloth, '#c2aa73'); b.sphere(0, .50, -.18, .14, .15, .13, T.cloth, '#d7c9a4');
  for (const side of [-1, 1]) { b.tri([side * .12, .58, -.24], [side * .03, .58, -.24], [side * .11, .74, -.2], T.cloth, '#ad966f'); b.sphere(side * .059, .51, -.30, .019, .025, .014, T.white, '#30403c', 3, 6); b.box(side * .11, .1, -.13, .065, .2, .10, T.cloth, '#d4caae'); }
  b.beam([0, .20, .25], [.18, .35, .49], .08, T.cloth, '#9c8964');
}
/** A unit beam along +Y; posed each frame between two points (the cat's tail tip). */
export function tailTip(b) { b.beam([0, -.5, 0], [0, .5, 0], .065, T.cloth, '#9c8964'); }
export function catBowl(b) { b.cylinder(-28.05, .07, 26.9, .17, .20, .12, T.white, '#b9b7a0', 10); b.cylinder(-28.05, .135, 26.9, .15, .15, .01, T.white, '#786e51', 10); }
export function shipModel(b) {
  b.taper(0, 1.7, 0, 5.2, 7.5, 3.4, 27, 34, T.paint, '#344f58'); b.box(0, 3.37, 0, 7.4, .25, 33.7, T.paint, '#9a9a7e'); b.box(0, 4.9, 8, 6, 3.1, 8, T.paint, '#bdc4ae'); b.box(0, 6.8, 9, 5.8, .8, 4.8, T.paint, '#e0d7b8'); b.plane(0, 6.8, 6.59, 5.2, .64, T.windows, '#fff', PI);
  for (const x of [-2.95, 2.95]) b.plane(x, 5.4, 8, 6, 1.2, T.windows, '#ffffff', x < 0 ? -PI / 2 : PI / 2);
  b.box(0, 7.45, 10, 6.3, .13, 5.1, T.roof, '#72857a'); b.cylinder(0, 8.1, 11, .7, .7, 1.6, T.paint, '#a7553a', 12); b.cylinder(0, 8.8, 11, .71, .71, .35, T.white, '#304644', 12);
  b.beam([0, 3.5, -7], [0, 12.5, -7], .13, T.white, '#aaa989'); b.beam([0, 11, -7], [0, 5, -15], .055, T.white, '#687d72'); b.beam([0, 11, -7], [0, 5, 4], .055, T.white, '#687d72');
  for (let z = -14; z < 5; z += 7) { b.box(0, 4.3, z, 5.5, 1.7, 5.5, T.metal, ['#9b8661', '#667e76', '#896957'][(z + 14) / 7], 2); }
  for (const x of [-3.6, 3.6]) { for (let z = -15; z <= 15; z += 3) { b.box(x, 3.93, z, .04, 1, .04, T.white, '#b6c0a7'); if (z < 15) b.beam([x, 4.4, z], [x, 4.4, z + 3], .035, T.white, '#b6c0a7'); } }
}
export function crateModel(b) { crate(b, 0, 0, 0, 1.35); }
export function crateMarker(b) { const s = .86; for (const a of [-1, 1]) { b.box(a * s, .035, 0, .055, .015, 1.8, T.white, '#d5bd7e', 0, 1); b.box(0, .035, a * s, 1.8, .015, .055, T.white, '#d5bd7e', 0, 1); } }
export function warnRing(b, col = '#c38b58') { const r = .65; for (let i = 0; i < 24; i++) { const a = i / 24 * TAU, d = (i + 1) / 24 * TAU; b.quad([Math.sin(a) * r, 0, Math.cos(a) * r], [Math.sin(d) * r, 0, Math.cos(d) * r], [Math.sin(d) * (r + .07), 0, Math.cos(d) * (r + .07)], [Math.sin(a) * (r + .07), 0, Math.cos(a) * (r + .07)], T.white, col, 1, 1, 1); } }
export function flagModel(b) { b.quad([0, 0, 0], [1.5, .03, 0], [1.5, -.65, 0], [0, -.68, 0], T.cloth, '#bd8c68'); }
export function contactModel(b) { b.plane(0, 0, 0, .95, .60, T.contact, '#fff', 0, 5); }
export function qtePallet(b) { b.box(7.2, .26, -12.8, 3, .52, 1, T.wood, '#aa9568'); }
export function qteBoom(b) { b.beam([3, 1.7, -25.7], [11, 1.7, -25.7], .24, T.hazard, '#d3b572'); b.box(11, .8, -25.7, .16, 1.6, .16, T.paint, '#6f8679'); }
export function passBox(b) { b.box(.36, .9, -.18, .13, .25, .24, T.paint, '#ded4a2'); }
/** New: a yard-run gate, built like the harbour's own signage (posts, hazard banner, painted board). */
export function raceGate(b) {
  for (const s of [-1, 1]) { b.box(s * 2.7, .12, 0, .55, .24, .55, T.concrete, '#8c9183'); b.box(s * 2.7, 1.45, 0, .16, 2.7, .16, T.paint, '#d19a41'); b.box(s * 2.7, 2.83, 0, .26, .08, .26, T.paint, '#394c48'); }
  b.box(0, 2.62, 0, 5.56, .36, .06, T.hazard, '#ffffff', 0); b.plane(0, 2.14, .04, 2.6, .62, T.yardrun); b.plane(0, 2.14, -.04, 2.6, .62, T.yardrun, '#ffffff', PI);
  for (const s of [-1, 1]) for (const z of [-.55, .55]) b.box(s * 2.7, .02, z, .5, .01, .12, T.white, '#d5bd7e', 0, 1);
}
/** New: the floating marker above the next yard-run gate. */
export function raceBeacon(b) {
  const top = [0, .55, 0], bot = [0, -.55, 0], ring = [[.32, 0, 0], [0, 0, .32], [-.32, 0, 0], [0, 0, -.32]];
  for (let i = 0; i < 4; i++) { const a = ring[i], c = ring[(i + 1) % 4]; b.tri(top, a, c, T.white, '#e7cea0', undefined, 1); b.tri(bot, c, a, T.white, '#c9a86a', undefined, 1); }
}

/* ------------------------------------------------------------------ characters */

/** Everything that decides how a person looks (the WebGL edition's style key). */
export function charStyle(ch) {
  const hero = !!ch.hero, woman = ch.id === 'hana' || ch.id === 'walker3', older = ch.id === 'mori' || ch.name === 'Enomoto' || ch.id === 'daichi';
  const coat = hero ? '#ffffff' : ch.coat || '#6c6a5e', pants = hero ? '#ffffff' : ch.pants || '#526172', hair = ch.hair || '#28251f';
  const st = {
    hero, woman, older, coat, pants, hair, cap: ch.cap, vest: ch.vest, hana: ch.id === 'hana',
    jacket: hero ? T.jacketFront : T.uniformFront, back: hero ? T.jacketBack : T.uniformBack, sleeve: hero ? T.leather : T.uniform,
    skin: hero || woman ? '#ffffff' : older ? '#e8d6c2' : '#f0e5d9',
    face: hero ? T.face : woman ? T.faceWoman : older ? T.faceOlder : T.faceWorker,
    blinkFace: woman ? T.faceWomanBlink : older ? T.faceOlderBlink : T.faceBlink
  };
  st.key = [hero, woman, older, coat, pants, hair, ch.cap, ch.vest, st.hana].join('|');
  st.farKey = 'far' + [ch.coat, ch.pants, ch.cap, woman].join('|');
  return st;
}
export const CHAR = {
  pelvis(p, st) {
    p.rings([[.84, .18, .115], [.91, .207, .137], [1.00, .198, .135]], T.denim, T.denim, st.pants, 16);
    p.rings([[.979, .200, .137], [1.015, .198, .137]], T.leather, T.leather, st.hero ? '#4f392d' : '#414643', 16);
    p.box(0, 1.00, -.141, .046, .026, .008, T.white, '#b9b3a1');
  },
  // Clothing has shaped thighs, knees and cuffs rather than straight cylinders.
  thigh(p, st) { p.rings([[-.44, .092, .101], [-.36, .098, .105], [-.23, .113, .126], [-.08, .127, .141], [.035, .126, .13]], T.denim, T.denim, st.pants, 16); for (let i = 7; i < p.a.length; i += 13) p.a[i] *= .52; },
  shin(p, st) {
    p.rings([[-.405, .085, .096], [-.37, .093, .100], [-.30, .093, .103], [-.18, .094, .110], [-.055, .089, .098], [.03, .093, .103]], T.denim, T.denim, st.pants, 16); for (let i = 7; i < p.a.length; i += 13) p.a[i] = .52 + p.a[i] * .48;
    p.push(0, -.443, -.061); p.m = M.mul(p.m, M.sc(.85, .86, .88));
    p.roundBox(0, -.023, -.032, .192, .045, .342, .053, T.paint, st.hero ? '#dddacb' : '#aaa99b');
    p.rings([[-.010, .092, .164, -.032], [.025, .096, .159, -.034], [.080, .087, .129, -.019], [.120, .065, .085, .018]], T.uniform, T.uniform, st.hero ? '#9ca69d' : '#40443e', 16, 0);
    // Toe, welt, separate lace strips, and a padded heel.
    p.roundBox(0, .064, -.130, .151, .013, .090, .025, T.paint, st.hero ? '#d0d1c0' : '#71756c');
    for (let j = 0; j < 4; j++) p.beam([-.040, .113 - j * .007, -.027 - j * .025], [.040, .113 - j * .007, -.025 - j * .025], .009, T.white, st.hero ? '#e9e3d3' : '#a9ab9d', .010);
    p.pop();
  },
  torso(p, st) {
    const w = st.woman ? .92 : 1, hero = st.hero;
    p.rings([[.996, .195 * w, .127], [1.035, .205 * w, .142], [1.13, .210 * w, .150], [1.27, .237 * w, .165], [1.40, .262 * w, .164], [1.48, .255 * w, .148], [1.535, .204 * w, .104], [1.568, .096, .072]], st.jacket, st.back, st.coat, 24, hero ? 4 : 0, true);
    // Raised collar and shirt opening give the neckline a real silhouette.
    p.rings([[1.508, .064, .060], [1.650, .062, .061]], T.skinNew, T.skinNew, st.skin, 16);
    for (const s of [-1, 1]) {
      p.tri([s * .084, 1.575, -.052], [s * .17, 1.516, -.112], [s * .078, 1.44, -.161], hero ? T.leather : T.uniform, st.coat, [[.1, .1], [.9, .15], [.5, .9]], hero ? 4 : 0);
      if (!hero) p.tri([s * .010, 1.541, -.09], [s * .075, 1.515, -.105], [s * .037, 1.448, -.151], T.cloth, '#dad7c8');
    }
    if (st.hana) {
      const rows = [[.66, .185, -.158], [.88, .189, -.159], [1.07, .178, -.165], [1.26, .113, -.168]];
      for (let j = 0; j < rows.length - 1; j++) for (let i = 0; i < 8; i++) { const a = -1 + i / 4, c = -1 + (i + 1) / 4, r = rows[j], u = rows[j + 1]; const pp = (row, x) => [x * row[1], row[0], row[2] - .028 * (1 - x * x)]; p.smoothQuad([pp(r, a), pp(r, c), pp(u, c), pp(u, a)], [[a * .3, 0, -1], [c * .3, 0, -1], [c * .3, 0, -1], [a * .3, 0, -1]], [[i / 8, 1 - j / 3], [(i + 1) / 8, 1 - j / 3], [(i + 1) / 8, 1 - (j + 1) / 3], [i / 8, 1 - (j + 1) / 3]], T.uniform, '#cfc5a3'); }
      for (const side of [-1, 1]) p.beam([side * .10, 1.27, -.164], [side * .095, 1.524, -.105], .03, T.cloth, '#b9b396', .018);
      p.plane(0, .951, -.197, .22, .16, T.uniform, '#bcb494', PI);
    }
    if (st.vest) {
      p.plane(-.17, 1.25, -.166, .08, .38, T.cloth, '#dec27d', PI); p.plane(.17, 1.25, -.166, .08, .38, T.cloth, '#dec27d', PI);
      p.plane(0, 1.27, .168, .43, .07, T.cloth, '#e0c478');
    }
  },
  // The face is a curved surface with a jaw, cheek bones, sockets and a projected nose.
  head(p, st, face) {
    const woman = st.woman, hero = st.hero, skin = st.skin;
    const profile = [[1.605, .056, .069], [1.626, .087, .090], [1.652, .106, .100], [1.681, .120, .108], [1.711, .129, .117], [1.741, .139, .119], [1.771, .142, .114], [1.800, .139, .116], [1.826, .138, .120], [1.853, .134, .121], [1.880, .124, .116], [1.906, .092, .093], [1.923, .032, .037]], sides = 32;
    const point = (j, i) => {
      const a = -PI + i / sides * TAU, r = profile[j]; const x = Math.sin(a) * r[1] * (woman ? .96 : 1); let z = -Math.cos(a) * r[2] + .012;
      if (Math.cos(a) > 0) { const nose = Math.exp(-((x / .027) ** 2) - ((r[0] - 1.743) / .033) ** 2) * .050; const ridge = Math.exp(-((x / .022) ** 2) - ((r[0] - 1.782) / .045) ** 2) * .016; const eye = Math.exp(-(((Math.abs(x) - .061) / .033) ** 2) - ((r[0] - 1.809) / .013) ** 2) * .010; z -= nose + ridge - eye; }
      return [x, r[0], z];
    };
    const normal = (j, i) => { const a = point(j, (i - 1 + sides) % sides), c = point(j, (i + 1) % sides), lo = point(Math.max(0, j - 1), i), hi = point(Math.min(profile.length - 1, j + 1), i); return norm(cross(sub(hi, lo), sub(c, a))); };
    for (let j = 0; j < profile.length - 1; j++) for (let i = 0; i < sides; i++) {
      const front = Math.cos(-PI + (i + .5) / sides * TAU) > .12;
      const pts = [point(j, i), point(j, i + 1), point(j + 1, i + 1), point(j + 1, i)];
      p.smoothQuad(pts, [normal(j, i), normal(j, i + 1), normal(j + 1, i + 1), normal(j + 1, i)], pts.map(v => front ? [clamp(.5 + v[0] / .40, .001, .999), clamp((1.946 - v[1]) / .36, .001, .999)] : [.3 + v[0], v[1] * 2 % 1]), front ? face : T.skinNew, front ? '#fff' : skin);
    }
    for (const s of [-1, 1]) { p.ellipsoid(s * .144, 1.77, .010, .023, .047, .023, T.skinNew, skin, 6, 10); p.ellipsoid(s * .157, 1.77, -.003, .010, .027, .014, T.skinNew, '#c4afa0', 4, 8); }
    // A textured cap of individually shaped hair bands replaces the old block and spikes.
    const n = 24, rows = 8;
    const hairProfile = [[1.58, .081, .070], [1.66, .112, .098], [1.73, .145, .120], [1.80, .155, .135], [1.85, .156, .135], [1.90, .144, .127], [1.94, .119, .106], [1.969, .078, .071], [1.987, .033, .031], [1.992, .003, .003]];
    const hp = (j, i) => { const a = i / n * TAU, fr = Math.max(0, Math.cos(a)), bk = Math.max(0, -Math.cos(a)), edge = (woman ? 1.625 : 1.711) + (woman ? .278 : .193) * Math.pow(fr, .66) - bk * .041, t = j / rows, y = mix(edge, woman ? 1.974 : 1.991, t); let k = hairProfile.findIndex(r => r[0] >= y); k = clamp(k, 1, hairProfile.length - 1); const l = hairProfile[k - 1], h = hairProfile[k], u = (y - l[0]) / (h[0] - l[0]), rx = mix(l[1], h[1], u), rz = mix(l[2], h[2], u), variation = 1 + .014 * Math.sin(i * 4.13 + j * 1.22); return [Math.sin(a) * rx * variation, y + Math.sin(i * 3.17) * .004 * (1 - t), -Math.cos(a) * rz * variation + .012]; };
    for (let j = 0; j < rows; j++) for (let i = 0; i < n; i++) { const pts = [hp(j, i), hp(j, i + 1), hp(j + 1, i + 1), hp(j + 1, i)], ns = pts.map(q => norm([q[0] / .022, (q[1] - 1.82) / .026, (q[2] - .012) / .019])); p.smoothQuad(pts, ns, [[i / n, 1 - j / rows], [(i + 1) / n, 1 - j / rows], [(i + 1) / n, 1 - (j + 1) / rows], [i / n, 1 - (j + 1) / rows]], T.hair, hero ? '#666157' : '#777166'); }
    if (hero) { for (let i = 0; i < 13; i++) { const a = i / 13 * TAU, x = Math.sin(a) * .083, z = Math.cos(a) * .065; const tip = [x * .85 + .008, 1.983 + Math.sin(i * 2.4) * .018, z + .018]; p.tri([x - .018, 1.954, z - .016], [x + .018, 1.952, z - .010], tip, T.hair, '#39352f'); p.tri([x + .018, 1.952, z - .01], [x, 1.953, z + .025], tip, T.hair, '#39352f'); } }
    if (woman) { for (const side of [-1, 1]) p.ellipsoid(side * .133, 1.716, .041, .039, .123, .095, T.hair, '#635950', 6, 10); }
    if (st.cap) { p.rings([[1.884, .147, .142], [1.935, .151, .147], [1.97, .138, .133], [1.998, .075, .077], [2.005, .004, .004]], T.uniform, T.uniform, st.cap, 20); p.roundBox(0, 1.899, -.141, .263, .016, .154, .061, T.uniform, st.cap); p.box(0, 1.958, -.142, .034, .026, .009, T.white, '#baa875'); }
    for (let i = 0; i < p.a.length; i += 13) { p.a[i] *= .80; p.a[i + 1] = 1.575 + (p.a[i + 1] - 1.575) * .70; p.a[i + 2] *= .85; const nx = p.a[i + 3] / .80, ny = p.a[i + 4] / .70, nz = p.a[i + 5] / .85, ll = Math.hypot(nx, ny, nz) || 1; p.a[i + 3] = nx / ll; p.a[i + 4] = ny / ll; p.a[i + 5] = nz / ll; }
  },
  upperArm(p, st) { p.rings([[-.315, .075, .079], [-.26, .090, .087], [-.15, .100, .098], [-.035, .108, .108], [.028, .078, .074]], st.sleeve, st.sleeve, st.coat, 16, st.hero ? 4 : 0); },
  forearm(p, st) {
    p.rings([[-.315, .060, .055], [-.270, .073, .071], [-.200, .081, .078], [-.085, .085, .083], [.026, .076, .080]], st.sleeve, st.sleeve, st.coat, 16, st.hero ? 4 : 0);
    p.rings([[-.318, .061, .057], [-.278, .067, .063]], T.leather, T.leather, st.hero ? '#49372c' : st.coat, 16);
    p.ellipsoid(0, -.352, -.003, .054, .066, .029, T.skinNew, st.skin, 6, 10);
    for (let f = 0; f < 4; f++) { const len = [.040, .052, .050, .037][f]; p.ellipsoid(-.038 + f * .024, -.403, -.012, .010, len, .013, T.skinNew, st.skin, 4, 7); }
    p.ellipsoid(-.058, -.360, -.017, .018, .036, .017, T.skinNew, st.skin, 4, 8);
  },
  // The simpler far-away figure, used beyond twelve metres.
  farBody(p, ch, woman) {
    p.rings([[.96, .17, .11], [1.12, .18, .135], [1.37, .223, .135], [1.50, .196, .095], [1.535, .065, .06]], T.uniformFront, T.uniformBack, ch.coat || '#65746e', 10, 0, true);
    p.rings([[1.52, .054, .052], [1.62, .054, .052]], T.skinNew, T.skinNew, '#fff', 8); p.ellipsoid(0, 1.735, 0, .112, .145, .108, T.skinNew, '#fff', 6, 10);
    p.plane(0, 1.75, -.093, .184, .210, woman ? T.faceWoman : T.faceOlder, '#fff', PI); p.ellipsoid(0, 1.814, .02, .12, .09, .11, T.hair, '#4d4943', 4, 10);
    if (ch.cap) { p.cylinder(0, 1.839, .005, .117, .10, .081, T.uniform, ch.cap, 10); p.box(0, 1.814, -.096, .191, .012, .13, T.uniform, ch.cap); }
  },
  farLeg(p, ch) { p.rings([[-.84, .074, .078], [-.47, .080, .088], [-.21, .100, .115], [.02, .107, .112]], T.denim, T.denim, ch.pants || '#66747a', 10); p.roundBox(0, -.870, -.044, .153, .095, .282, .04, T.paint, '#7e8780'); },
  farArm(p, ch) { p.rings([[-.61, .046, .048], [-.31, .069, .07], [-.035, .077, .078], [.02, .044, .046]], T.uniform, T.uniform, ch.coat || '#65746e', 10); p.ellipsoid(0, -.655, 0, .044, .065, .023, T.skinNew, '#fff', 4, 6); }
};
