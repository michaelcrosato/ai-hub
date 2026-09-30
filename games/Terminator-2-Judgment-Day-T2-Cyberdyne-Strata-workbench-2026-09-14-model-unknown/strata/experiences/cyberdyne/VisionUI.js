import { sub, norm, dot, cross } from '../../core/math3d.js';
import { VEHICLES, OFFICERS } from './Waves.js';

/* Screen data comes from the running simulation, not from scripted labels. */
export class VisionUI {
  constructor(root) {
    this.root = root;
    this.canvas = root.querySelector('.t2-machine-layer');
    this.ctx = this.canvas.getContext('2d');
    this.lastTime = -1;
    this.lastRoster = -1;
    this.units = [];
    this.exp = null;
  }
  draw(e) {
    const w = this.root.clientWidth,
      h = this.root.clientHeight,
      c = this.ctx;
    const ratio = Math.min(globalThis.devicePixelRatio || 1, 1.5);
    if (this.canvas.width !== Math.round(w * ratio) || this.canvas.height !== Math.round(h * ratio)) {
      this.canvas.width = Math.round(w * ratio);
      this.canvas.height = Math.round(h * ratio);
    }
    c.setTransform(ratio, 0, 0, ratio, 0, 0);
    c.clearRect(0, 0, w, h);
    const cam = e.camera,
      forward = norm(sub(cam.target, cam.position)),
      right = norm(cross(forward, [0, 1, 0])),
      up = cross(right, forward),
      f = h / (2 * Math.tan((cam.fov * Math.PI) / 360));
    const project = (p) => {
      const d = sub(p, cam.position),
        z = dot(d, forward);
      return z > 0.08 ? [w / 2 + (dot(d, right) / z) * f, h / 2 - (dot(d, up) / z) * f, z] : null;
    };
    if (this.exp !== e || this.lastRoster !== e.rosterVersion || Math.abs(e.time - this.lastTime) > 0.1) {
      this.units = [...e.cars, ...e.officers].filter((u) => e.visibleUnit(u));
      this.exp = e;
      this.lastRoster = e.rosterVersion;
      this.lastTime = e.time;
    }
    const scan = e.scan;
    c.save();
    c.beginPath();
    c.rect(10, 91, w - 20, h - 215);
    if (scan) {
      const panel = this.root.querySelector('.t2-vision-panel');
      c.rect(panel.offsetLeft - 2, panel.offsetTop - 2, panel.offsetWidth + 4, panel.offsetHeight + 4);
    }
    c.clip('evenodd');
    c.font = '10px ui-monospace, monospace';
    c.textBaseline = 'top';
    for (const u of this.units) {
      if (u.safe || u.gone || !u.root.visible) continue;
      const selected = e.target?.entity === u,
        locked = u.data.id === e.lockID;
      if (!scan && !selected) continue;
      const b = e.entityBounds(u),
        points = [];
      for (const x of [b.min[0], b.max[0]])
        for (const y of [b.min[1], b.max[1]])
          for (const z of [b.min[2], b.max[2]]) {
            const p = project([x, y, z]);
            if (p) points.push(p);
          }
      if (points.length < 8) continue;
      let left = Math.min(...points.map((p) => p[0])),
        top = Math.min(...points.map((p) => p[1])),
        r = Math.max(...points.map((p) => p[0])),
        bottom = Math.max(...points.map((p) => p[1]));
      if (r < 10 || left > w - 10 || bottom < 92 || top > h - 112 || r - left > w * 0.8) continue;
      left = Math.max(12, left);
      r = Math.min(w - 12, r);
      top = Math.max(94, top);
      bottom = Math.min(h - 95, bottom);
      const human = u.kind === 'human',
        inactive = u.disabled || u.mode === 'run';
      c.strokeStyle = locked ? '#fff0d6' : human ? '#ffb49f' : inactive ? '#947970' : scan ? '#ff7661' : '#aac8d8';
      c.fillStyle = c.strokeStyle;
      c.globalAlpha = selected || locked ? 1 : human ? 0.57 : 0.72;
      c.lineWidth = selected || locked ? 1.5 : 1;
      const len = Math.min(12, (r - left) / 3, (bottom - top) / 3);
      c.beginPath();
      for (const [x, y, sx, sy] of [
        [left, top, 1, 1],
        [r, top, -1, 1],
        [left, bottom, 1, -1],
        [r, bottom, -1, -1],
      ]) {
        c.moveTo(x + sx * len, y);
        c.lineTo(x, y);
        c.lineTo(x, y + sy * len);
      }
      c.stroke();
      if (!scan) continue;
      const d = Math.round(Math.hypot(...sub(e.center(u), cam.position))),
        known = e.identified.has(u.data.id);
      const name = human ? OFFICERS[u.officerType].name : VEHICLES[u.vehicleType].name;
      // Keep labels on distant human units small to leave the street visible.
      if (!human || selected || locked) {
        const label = (locked ? 'LOCK / ' : u.disabled ? 'DISABLED / ' : '') + name.toUpperCase();
        c.fillStyle = '#200b09d9';
        c.fillRect(left, top - 18, Math.min(w - left - 8, c.measureText(label).width + 12), 16);
        c.fillStyle = locked ? '#fff0d6' : '#ffb4a0';
        c.fillText(label, left + 5, top - 16);
        if (!human) {
          const state = u.disabled ? 'OFFLINE' : known ? Math.ceil((u.hp / u.maxHP) * 100) + '% / ' + d + ' M' : d + ' M / UNSCANNED';
          c.fillText(state, left, bottom + 5);
          c.fillStyle = '#692a26';
          c.fillRect(left, bottom + 20, Math.max(20, r - left), 2);
          c.fillStyle = '#ffa58b';
          c.fillRect(left, bottom + 20, (Math.max(20, r - left) * u.hp) / u.maxHP, 2);
        }
      }
      if (!human && known && !u.disabled && (selected || locked)) {
        const p = project(e.weakPoint(u));
        if (p) {
          c.globalAlpha = 1;
          c.strokeStyle = '#fff4d0';
          c.beginPath();
          c.arc(p[0], p[1], 7, 0, Math.PI * 2);
          c.stroke();
          c.beginPath();
          c.moveTo(p[0] + 8, p[1]);
          c.lineTo(p[0] + 28, p[1] - 17);
          c.lineTo(p[0] + 116, p[1] - 17);
          c.stroke();
          c.fillStyle = '#fff0ce';
          c.fillText('DRIVE MODULE', p[0] + 32, p[1] - 31);
        }
      }
    }
    c.restore();
    c.globalAlpha = 1;
    if (scan) {
      // An orientation-aware contact display. It shows units in the scene within 75 m.
      const size = w < 900 ? 46 : 62,
        x = w - 55 - size,
        y = h - 220 - size;
      c.fillStyle = '#170807ab';
      c.beginPath();
      c.arc(x, y, size + 11, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#a0443980';
      c.lineWidth = 1;
      for (const radius of [size * 0.5, size]) {
        c.beginPath();
        c.arc(x, y, radius, 0, Math.PI * 2);
        c.stroke();
      }
      c.beginPath();
      c.moveTo(x - size, y);
      c.lineTo(x + size, y);
      c.moveTo(x, y - size);
      c.lineTo(x, y + size);
      c.stroke();
      c.fillStyle = '#ffddbf';
      c.beginPath();
      c.moveTo(x, y - 5);
      c.lineTo(x - 4, y + 5);
      c.lineTo(x + 4, y + 5);
      c.closePath();
      c.fill();
      const yaw = e.player.yaw;
      for (const u of [...e.cars, ...e.officers]) {
        if (u.safe || u.gone || u.deployed === false || u.arrival > 0) continue;
        const d = sub(u.root.position, e.player.position);
        if (Math.hypot(d[0], d[2]) > 75) continue;
        const px = x + ((d[0] * Math.cos(yaw) - d[2] * Math.sin(yaw)) / 75) * size;
        const py = y + ((d[0] * Math.sin(yaw) + d[2] * Math.cos(yaw)) / 75) * size;
        c.fillStyle = u.disabled ? '#80392d' : u.kind === 'human' ? '#ffe3c9' : '#ff6250';
        if (u.kind === 'human') {
          c.beginPath();
          c.arc(px, py, 1.6, 0, Math.PI * 2);
          c.fill();
        } else c.fillRect(px - 2, py - 2, 4, 4);
      }
      c.fillStyle = '#ffb69e';
      c.font = '9px ui-monospace, monospace';
      c.textAlign = 'center';
      c.fillText('CONTACTS / 75 M', x, y + size + 19);
      c.textAlign = 'left';
    }
  }
}
