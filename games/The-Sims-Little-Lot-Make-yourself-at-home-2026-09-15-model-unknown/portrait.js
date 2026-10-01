// portrait.js — the small HUD portraits (Mara in the resident card, June on the
// neighbour button). These are 2D illustrations painted from the same block
// faces as the 3D people, with the original fixed light, so they match them.

const cache = new Map();
function shade(hex, n) {
  const key = hex + ':' + Math.round(n * 100);
  let c = cache.get(key);
  if (c) return c;
  const v = parseInt(hex.replace('#', '').slice(0, 6), 16);
  const f = (x) => Math.round(Math.max(0, Math.min(255, x * n)));
  c = `rgb(${f((v >> 16) & 255)},${f((v >> 8) & 255)},${f(v & 255)})`;
  cache.set(key, c);
  return c;
}

/**
 * Paint face lists (local person space) into a canvas.
 * @param {HTMLCanvasElement} canvas
 * @param {Array<Array>} lists   face lists from build.js personParts()
 * @param {{unit:number, yaw?:number, se?:number, turn?:number}} view
 */
export function paintPortrait(canvas, lists, { unit, yaw = 0.28, se = 0.23, turn = 0.16 }) {
  const cx = canvas.getContext('2d');
  if (!cx) return;
  cx.clearRect(0, 0, canvas.width, canvas.height);
  const ca = Math.cos(yaw), sa = Math.sin(yaw), ce = Math.sqrt(1 - se * se);
  const tc = Math.cos(turn), ts = Math.sin(turn);
  const faces = [];
  for (const list of lists) {
    for (const f of list) {
      const v = f.v.map((p) => [p[0] * tc - p[2] * ts, p[1], p[0] * ts + p[2] * tc]);
      const a = v[0], b = v[1], c = v[2];
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
      const len = Math.hypot(n[0], n[1], n[2]) || 1;
      n = n.map((x) => x / len);
      if (n[0] * sa * ce + n[1] * se + n[2] * ca * ce < -0.001) continue;
      const pts = v.map((p) => ({
        x: (p[0] * ca - p[2] * sa) * unit,
        y: ((p[0] * sa + p[2] * ca) * se - p[1] * ce) * unit,
        d: (p[0] * sa + p[2] * ca) * ce + p[1] * se,
      }));
      const depth = pts.reduce((s, p) => s + p.d, 0) / pts.length;
      const light = 0.75 + Math.max(0, n[0] * -0.48 + n[1] * 0.82 + n[2] * 0.3) * 0.3;
      faces.push({ pts, depth, col: f.alpha < 1 ? f.col : shade(f.col, light), alpha: f.alpha });
    }
  }
  faces.sort((p, q) => p.depth - q.depth);
  cx.save();
  cx.translate(canvas.width / 2, canvas.height + 3);
  for (const f of faces) {
    cx.globalAlpha = f.alpha;
    cx.fillStyle = f.col;
    cx.beginPath();
    f.pts.forEach((p, i) => (i ? cx.lineTo(p.x, p.y) : cx.moveTo(p.x, p.y)));
    cx.closePath();
    cx.fill();
    if (f.alpha === 1) {
      cx.strokeStyle = f.col;
      cx.lineWidth = 0.35;
      cx.stroke();
    }
  }
  cx.restore();
  cx.globalAlpha = 1;
}
