import { v3, seeded, GRAVITY } from './math.js';
import { TEAMS } from './teams.js';

/**
 * Sunset Park and its players, described as coloured blocks. render.js turns the stadium
 * list into one merged mesh, and the figures into one instanced batch every frame.
 */
export const C = { grass: '#76b94a', grass2: '#86c65a', dirt: '#df9c61', chalk: '#fff6d8', brick: '#d66e4e', sky: '#b6e0df', navy: '#153b40' };
export const box = (x, y, z, w, h, d, color, ry = 0) => ({ kind: 'box', p: v3(x, y, z), s: v3(w, h, d), color, ry, shadow: true });
export const cyl = (x, y, z, r, h, color, segments = 16) => ({ kind: 'cylinder', p: v3(x, y, z), s: v3(r * 2, h, r * 2), color, segments, shadow: true });
export const poly = (points, color, y = 0) => ({ kind: 'polygon', p: v3(0, y, 0), s: v3(1, 1, 1), vertices: points, color, shadow: false });
export const label = (x, y, z, w, h, text, color = '#fef2ca', textColor = '#153b40', ry = 0) => ({ kind: 'label', p: v3(x, y, z), s: v3(w, h, 0.05), text, color, textColor, ry, unlit: true, shadow: false });
const arc = (r, from = -Math.PI / 4, to = Math.PI / 4, n = 32) => Array.from({ length: n + 1 }, (_, i) => v3(Math.sin(from + ((to - from) * i) / n) * r, 0, -Math.cos(from + ((to - from) * i) / n) * r));
/** A fan in the stands: the phase sets when it bounces once the crowd is on its feet. */
const fan = (o, phase) => ((o.crowd = phase), o);

export function stadium() {
  const o = [];
  const r = seeded(729);
  const add = (...p) => o.push(...p);
  // The full stadium is built from original procedural geometry, not downloaded assets.
  add(box(0, -4.5, -37, 192, 4, 161, '#95cac0'), box(0, -2.6, -33, 137, 3, 124, '#397d62'));
  add(poly([v3(-63, 0, 20), v3(63, 0, 20), v3(68, 0, -68), v3(0, 0, -96), v3(-68, 0, -68)], '#bd9167', -0.95));
  add(poly([v3(0, 0, 5), ...arc(77, -Math.PI / 4 - 0.055, Math.PI / 4 + 0.055)], '#c48755', -0.35));
  for (let i = 0; i < 10; i++) {
    const a = arc(Math.min(74, (i + 1) * 7.5));
    const b = i ? arc(i * 7.5).reverse() : [v3()];
    add(poly([...b, ...a], i % 2 ? '#86be55' : '#76b64c', 0.015 + i * 0.001));
  }
  add(poly([v3(0, 0, 3), v3(24, 0, -18), v3(20, 0, -34), v3(0, 0, -43), v3(-20, 0, -34), v3(-24, 0, -18)], C.dirt, 0.08));
  add(poly([v3(0, 0, -6), v3(12.8, 0, -18.7), v3(0, 0, -32), v3(-12.8, 0, -18.7)], '#6caa43', 0.11));
  add(cyl(0, 0.1, -15.2, 3.0, 0.4, '#d9a471', 24), box(0, 0.33, -15.2, 1.8, 0.11, 0.5, C.chalk));
  // Chalk baselines and batter's boxes.
  for (const sign of [-1, 1]) {
    add(box(sign * 27, 0.135, -27, 0.22, 0.045, 76.4, C.chalk, (-sign * Math.PI) / 4));
    add(box(sign * 3, 0.14, 0.2, 0.14, 0.045, 3.6, C.chalk), box(sign * 1.35, 0.14, 0.2, 0.14, 0.045, 3.6, C.chalk));
    for (const z of [-1.6, 2]) add(box(sign * 2.2, 0.14, z, 1.8, 0.045, 0.14, C.chalk));
    add(box(sign * 25, 0.14, -13, 0.15, 0.05, 5, C.chalk, (-sign * Math.PI) / 4));
  }
  add(poly([v3(-0.8, 0, -0.7), v3(0.8, 0, -0.7), v3(0.8, 0, 0.3), v3(0, 0, 1), v3(-0.8, 0, 0.3)], C.chalk, 0.18));
  for (const [x, z] of [[18, -18], [0, -36], [-18, -18]]) add(box(x, 0.23, z, 1.65, 0.25, 1.65, C.chalk, Math.PI / 4));
  // Teal padded outfield wall with an amber cap.
  for (let i = 0; i < 36; i++) {
    const a = -Math.PI / 4 + ((i + 0.5) * Math.PI) / 2 / 36;
    add(box(Math.sin(a) * 75, 1.9, -Math.cos(a) * 75, 3.45, 3.8, 1.15, i % 6 === 0 ? '#24615b' : '#28736b', -a), box(Math.sin(a) * 75, 3.91, -Math.cos(a) * 75, 3.5, 0.3, 1.35, '#ffce59', -a));
  }
  add(label(0, 2.2, -74.3, 5, 1.8, '400', '#28736b', '#fff4c7'), label(-45, 2.2, -59.3, 4, 1.5, '325', '#28736b', '#fff4c7', Math.PI / 4), label(45, 2.2, -59.3, 4, 1.5, '325', '#28736b', '#fff4c7', -Math.PI / 4));
  // Grandstands. Block spectators form the colorful crowd.
  const crowd = ['#f8cc50', '#ee7152', '#40b6b0', '#f4ead3', '#254e61', '#76a8c9', '#da8c9c'];
  for (let row = 0; row < 6; row++)
    for (let i = 0; i < 54; i++) {
      const a = -0.88 + ((i + 0.5) * 1.76) / 54;
      const radius = 79 + row * 2.15;
      const x = Math.sin(a) * radius;
      const z = -Math.cos(a) * radius;
      const y = 2.4 + row * 1.4;
      add(box(x, y - 1.1, z, 2.8, 1.6, 2.4, row % 2 ? '#e2916c' : '#d77756', -a), box(x, y, z, 2, 0.55, 1.4, '#237f7b', -a));
      if (r() > 0.18) {
        const phase = 1 + ((i * 7 + row * 13) % 17) * 0.37;
        add(fan(box(x, y + 1.1, z, 0.9, 1.3, 0.65, crowd[Math.floor(r() * crowd.length)], -a), phase), fan(box(x, y + 2.05, z, 0.75, 0.65, 0.7, ['#efbf90', '#ad714c', '#784931'][Math.floor(r() * 3)], -a), phase));
      }
    }
  // Baseline bleachers, open concourse and dugouts.
  for (const sign of [-1, 1]) {
    for (let row = 0; row < 4; row++)
      for (let i = 0; i < 15; i++) {
        const x = sign * (14 + i * 2.25 + row * 1.8);
        const z = 8 - i * 2.25 + row * 1.8;
        const y = 1.6 + row * 1.5;
        add(box(x, y - 0.8, z, 2.7, 1.6, 2.7, '#d87c58', (sign * Math.PI) / 4), box(x, y + 0.2, z, 2, 0.5, 1.2, '#2b9991', (sign * Math.PI) / 4));
        if (r() > 0.15) {
          const phase = 1 + ((i * 5 + row * 11 + (sign > 0 ? 3 : 0)) % 13) * 0.45;
          add(fan(box(x, y + 1.2, z, 0.95, 1.35, 0.65, crowd[Math.floor(r() * crowd.length)], (sign * Math.PI) / 4), phase), fan(box(x, y + 2.13, z, 0.7, 0.7, 0.7, '#d9a273', (sign * Math.PI) / 4), phase));
        }
      }
    add(box(sign * 26, 2.5, -6, 18, 5, 5, '#c4664b', (sign * Math.PI) / 4), box(sign * 25, 5.15, -5, 20, 0.6, 6, '#f3cb82', (sign * Math.PI) / 4));
    add(label(sign * 24, 3.2, -3, 13, 2.3, sign === -1 ? 'COMETS' : 'SLUGGERS', sign === -1 ? '#153e45' : '#ed6d3c', '#fff2c5', (sign * Math.PI) / 4));
    add(box(sign * 53, 13, -53, 0.35, 26, 0.35, '#ffd55d'));
    add(box(sign * 54.6, 24, -53, 3.4, 4, 0.15, '#ffca48'));
  }
  // Left-field clubhouse: chunky brick blocks, aqua awnings, billboard.
  add(box(-49, 5, -73, 18, 10, 10, '#d27550'), box(-49, 10.2, -73, 20, 0.8, 12, '#ffce77'));
  for (let i = 0; i < 4; i++) add(box(-55 + i * 4, 5.5, -67.85, 2.2, 4, 0.15, '#275e62'), box(-55 + i * 4, 7.8, -67, 3.2, 0.4, 2, '#44bcb4'));
  add(label(-49, 11.8, -68, 19, 3, 'THE SUNSET CLUB', '#f7da90', '#923e2e'));
  // Center-field video board and structural brick piers.
  for (const x of [-11, 11]) add(box(x, 11, -91, 3.2, 22, 4, '#ca7450'));
  add(box(0, 23, -91, 34, 17, 3, '#e98559'), box(0, 23, -89.3, 31.8, 14.8, 0.5, '#163e42'));
  add(label(0, 28.8, -88.97, 28, 2, '★  BRICK LEAGUE  ★', '#163e42', '#8fe0c8'));
  add(label(0, 22.7, -88.91, 28, 9, 'GO BIG.\nGO HOME.', '#163e42', '#ffdc67'));
  add(label(0, 17.6, -88.92, 28, 1.5, 'SUNSET PARK  •  GOOD VIBES. BIG FLIES.', '#163e42', '#fff5d6'));
  // City skyline, boardwalk, kiosks, sculptural palms.
  for (let i = 0; i < 14; i++) {
    const x = -87 + i * 13;
    const h = 10 + r() * 18;
    add(box(x, h / 2 - 1, -107 - r() * 8, 9 + r() * 6, h, 9, '#83b6ae'));
    add(box(x, h, -110, 7, 0.8, 7, '#aad4c6'));
  }
  for (const [x, z, h] of [[-74, -40, 23], [-65, -78, 28], [72, -48, 24], [78, -83, 29], [-48, 15, 17], [49, 19, 20]]) {
    add(box(x, h / 2, z, 1.4, h, 1.4, '#b27b4f', 0.15));
    for (let j = 0; j < 7; j++) {
      const a = (j * Math.PI * 2) / 7;
      add(box(x + Math.cos(a) * 4, h + Math.sin(j) * 0.8, z + Math.sin(a) * 4, 10, 0.8, 2.1, j % 2 ? '#398b68' : '#4b9a6a', -a));
    }
    add(box(x, h + 1.2, z, 2, 2.2, 2, '#60a971'));
  }
  for (const [x, z] of [[-61, -18], [61, -18], [-62, -83], [62, -83]]) {
    add(box(x, 19, z, 1.1, 38, 1.1, '#e6cf9c'), box(x, 37.5, z, 9, 4, 1.1, '#254e50'));
    for (let j = 0; j < 4; j++) for (let k = 0; k < 2; k++) add(box(x - 3 + j * 2, 36.5 + k * 2, z + 0.7, 1.5, 1.2, 0.4, '#fff2b5'));
  }
  for (const [x, z] of [[-65, 7], [67, -3]]) {
    add(box(x, 2.5, z, 10, 5, 7, '#ecc18d'), box(x, 5.7, z, 12, 1.2, 9, '#f6dcaa'));
    add(label(x, 4, z + 3.6, 9, 2, 'SNACK SHACK', '#e77b4e', '#fff8df'));
  }
  // Clouds made from offset blocks; low contrast keeps the diamond readable.
  for (const [x, y, z] of [[-65, 42, -115], [48, 48, -125], [1, 48, -145], [-104, 31, -70]]) add(box(x, y, z, 15, 3, 7, '#e0f1e7'), box(x + 5, y + 2, z, 11, 4, 7, '#e7f5ec'), box(x - 6, y + 1, z, 7, 3, 6, '#e7f5ec'));
  return o;
}

/** The mound is raised; figures standing on it stand on its top. */
const MOUND_TOP = 0.3;
const onMound = (p) => Math.hypot(p.x, p.z + 15.2) < 3.1;

/**
 * One block character. `out.box(x, y, z, w, h, d, color, ry, rz)` receives every block in world
 * space; `out.mark(x, z)` is called for the selected fielder. Nothing is allocated per block.
 */
export function drawFigure(f, out) {
  const team = TEAMS[f.team];
  const c = f.role === 'umpire' ? '#354449' : team.color;
  const trim = f.role === 'umpire' ? '#263637' : team.dark;
  const run = Math.sin(f.motion) * 0.23;
  const a = f.ry;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const p = f.p;
  const lift = p.y + (onMound(p) ? MOUND_TOP : 0);
  const b = (x, y, z, w, h, d, color, rz = 0) => out.box(p.x + x * ca + z * sa, y + lift, p.z - x * sa + z * ca, w, h, d, color, a, rz);
  // Compact proportions read clearly from the broadcast camera.
  b(-0.43, 0.75, run, 0.6, 1.25, 0.65, '#f8eccf');
  b(0.43, 0.75, -run, 0.6, 1.25, 0.65, '#f8eccf');
  b(-0.43, 0.2, 0.22 + run, 0.75, 0.4, 1.0, trim);
  b(0.43, 0.2, 0.22 - run, 0.75, 0.4, 1.0, trim);
  b(0, 1.95, 0, 1.6, 1.65, 0.95, c);
  b(0, 1.22, 0, 1.67, 0.22, 1.01, trim);
  b(0, 3.2, 0, 1.35, 1.2, 1.25, f.skin);
  b(0, 3.91, 0, 1.51, 0.4, 1.42, trim);
  b(0, 3.71, 0.78, 1.58, 0.17, 0.65, trim);
  b(-0.29, 3.25, 0.64, 0.12, 0.14, 0.04, '#293034');
  b(0.29, 3.25, 0.64, 0.12, 0.14, 0.04, '#293034');
  if (f.role === 'batter') {
    const sw = f.swing || 0;
    const ba = -0.4 + sw * 3.4;
    b(0.92, 2.35, 0.35, 0.5, 0.6, 0.5, f.skin);
    b(-0.8, 2.3, 0.38, 0.5, 0.6, 0.5, f.skin);
    b(1.15 + Math.sin(ba) * 1.2, 3.45 - Math.abs(sw) * 0.7, Math.cos(ba) * 0.6, 0.24, 2.8, 0.24, '#f6cb78', -0.5 - sw * 1.5);
  } else {
    b(-1.03, 2.0 + run, 0, 0.5, 1.3, 0.55, c);
    b(1.03, 2.0 - run, 0, 0.5, 1.3, 0.55, c);
    b(-1.03, 1.32 + run, 0.2, 0.72, 0.6, 0.73, '#95613b');
    b(1.03, 1.32 - run, 0, 0.45, 0.44, 0.45, f.skin);
  }
  if (f.selected) out.mark(p.x, p.z);
}

/** Every moving block of a frame: players, the landing-spot ring and the confetti. */
export function drawDynamic(frame, out, particles = true) {
  for (const f of frame.figures) drawFigure(f, out);
  if (frame.target) {
    const p = frame.target;
    for (let j = 0; j < 12; j++) {
      const a = (j * Math.PI) / 6;
      out.box(p.x + Math.cos(a) * 2.2, 0.2, p.z + Math.sin(a) * 2.2, 0.65, 0.06, 0.25, '#fff2bf', -a, 0);
    }
  }
  if (frame.aim) drawAimGuide(frame.aim, particles ? frame.time : 0, out);
  if (particles) for (const q of frame.particles) out.box(q.p.x, q.p.y, q.p.z, q.size, q.size, q.size, q.color, q.life * 2, 0);
}

/**
 * Where a perfectly timed swing sends the ball: a dotted arc of chalk-gold blocks off the
 * plate, using the same spray and launch-angle maths as contact() (the stick moves it).
 */
function drawAimGuide(aim, time, out) {
  const theta = aim.spray * 0.26;
  const launch = ((26 + aim.loft * 18) * Math.PI) / 180;
  const speed = 30;
  const h = Math.cos(launch) * speed;
  const vx = Math.sin(theta) * h;
  const vz = -Math.cos(theta) * h;
  const vy = Math.sin(launch) * speed;
  // A gentle travelling pulse along the dots, so the guide reads as a direction.
  const pulse = (time * 2.2) % 1;
  for (let j = 1; j <= 8; j++) {
    const t = j * 0.07;
    const k = Math.max(0, 1 - Math.abs(j / 8 - pulse) * 4);
    const s = 0.26 + k * 0.14;
    out.box(vx * t, 1.45 + vy * t - 0.5 * GRAVITY * t * t, vz * t, s, s, s, j % 2 ? '#ffd23f' : '#fff3c5', theta, 0);
  }
}
