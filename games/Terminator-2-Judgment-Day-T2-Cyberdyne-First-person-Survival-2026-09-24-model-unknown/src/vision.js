import { sub, norm, dot, cross } from './math.js';
import { VEHICLES, OFFICERS } from './waves.js';

/* Target brackets and the contact display. Screen data comes from the running simulation, not from scripted labels. */
export class VisionUI {
  constructor(canvas, panel) {
    this.canvas = canvas;
    this.panel = panel;
    this.ctx = canvas.getContext('2d');
    this.w = 1;
    this.h = 1;
    this.lastTime = -1;
    this.lastRoster = -1;
    this.units = [];
    this.exp = null;
    this.panelRect = null;
    this.panelClock = 0;
    this.radarTop = false;
    this.ratio = 1;
    this.drawn = false;
  }
  resize(w, h) {
    this.w = w;
    this.h = h;
    const ratio = Math.min(globalThis.devicePixelRatio || 1, 1.5);
    this.ratio = ratio;
    this.canvas.width = Math.round(w * ratio);
    this.canvas.height = Math.round(h * ratio);
    this.panelRect = null;
    this.drawn = false; // resizing a canvas clears it
  }
  /** Force a new roster (new game or restored checkpoint). */
  reset() {
    this.exp = null;
    this.lastRoster = -1;
    this.panelRect = null;
  }
  draw(e, now) {
    const w = this.w, h = this.h, c = this.ctx;
    // Nothing to draw and nothing left on the layer: skip the full-screen clear.
    const busy = e.scan || !!e.target?.entity;
    if (!busy && !this.drawn) return;
    this.drawn = busy;
    c.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    c.clearRect(0, 0, w, h);
    const cam = e.camera, forward = norm(sub(cam.target, cam.position)), right = norm(cross(forward, [0, 1, 0])), up = cross(right, forward), f = h / (2 * Math.tan((cam.fov * Math.PI) / 360));
    const project = (p) => {
      const d = sub(p, cam.position), z = dot(d, forward);
      return z > 0.08 ? [w / 2 + (dot(d, right) / z) * f, h / 2 - (dot(d, up) / z) * f, z] : null;
    };
    const scan = e.scan;
    // Without vision only the unit under the reticle gets a bracket, so the visibility scan is skipped.
    if (scan && (this.exp !== e || this.lastRoster !== e.rosterVersion || Math.abs(e.time - this.lastTime) > 0.1)) {
      this.units = [...e.cars, ...e.officers].filter((u) => e.visibleUnit(u));
      this.exp = e;
      this.lastRoster = e.rosterVersion;
      this.lastTime = e.time;
    }
    const units = scan ? this.units : e.target?.entity ? [e.target.entity] : [];
    c.save();
    c.beginPath();
    c.rect(10, 91, w - 20, h - 215);
    if (scan) {
      // The panel rectangle is read from the layout twice a second, not every frame.
      if (!this.panelRect || now - this.panelClock > 0.5) {
        const p = this.panel;
        this.panelRect = [p.offsetLeft - 2, p.offsetTop - 2, p.offsetWidth + 4, p.offsetHeight + 4];
        this.panelClock = now;
      }
      c.rect(...this.panelRect);
    }
    c.clip('evenodd');
    c.font = '10px ui-monospace, monospace';
    c.textBaseline = 'top';
    for (const u of units) {
      if (u.safe || u.gone || !u.root.visible) continue;
      const selected = e.target?.entity === u, locked = u.data.id === e.lockID;
      if (!scan && !selected) continue;
      const b = e.entityBounds(u);
      let left = Infinity, top = Infinity, r = -Infinity, bottom = -Infinity, count = 0;
      for (const x of [b.min[0], b.max[0]])
        for (const y of [b.min[1], b.max[1]])
          for (const z of [b.min[2], b.max[2]]) {
            const p = project([x, y, z]);
            if (!p) continue;
            count++;
            if (p[0] < left) left = p[0];
            if (p[0] > r) r = p[0];
            if (p[1] < top) top = p[1];
            if (p[1] > bottom) bottom = p[1];
          }
      if (count < 8) continue;
      if (r < 10 || left > w - 10 || bottom < 92 || top > h - 112 || r - left > w * 0.8) continue;
      left = Math.max(12, left); r = Math.min(w - 12, r); top = Math.max(94, top); bottom = Math.min(h - 95, bottom);
      const human = u.kind === 'human', inactive = u.disabled || u.mode === 'run';
      c.strokeStyle = locked ? '#fff0d6' : human ? '#ffb49f' : inactive ? '#947970' : scan ? '#ff7661' : '#aac8d8';
      c.fillStyle = c.strokeStyle;
      c.globalAlpha = selected || locked ? 1 : human ? 0.57 : 0.72;
      c.lineWidth = selected || locked ? 1.5 : 1;
      const len = Math.min(12, (r - left) / 3, (bottom - top) / 3);
      c.beginPath();
      for (const [x, y, sx, sy] of [[left, top, 1, 1], [r, top, -1, 1], [left, bottom, 1, -1], [r, bottom, -1, -1]]) {
        c.moveTo(x + sx * len, y);
        c.lineTo(x, y);
        c.lineTo(x, y + sy * len);
      }
      c.stroke();
      if (!scan) continue;
      const ctr = e.center(u), d = Math.round(Math.hypot(ctr[0] - cam.position[0], ctr[1] - cam.position[1], ctr[2] - cam.position[2])), known = e.identified.has(u.data.id);
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
      // An orientation-aware contact display. It shows units in the scene within 75 m, and gas clouds.
      // With touch controls on screen it moves clear of the button cluster: under the top pills in
      // landscape, half-way down the right edge in portrait (the counts and alerts sit top-centre).
      const size = this.radarTop ? 36 : w < 900 ? 46 : 62;
      const x = w - (this.radarTop ? 26 : 55) - size;
      const y = this.radarTop ? (h > w ? h * 0.5 : 64 + size + 11) : h - 220 - size;
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
      c.moveTo(x - size, y); c.lineTo(x + size, y); c.moveTo(x, y - size); c.lineTo(x, y + size);
      c.stroke();
      c.fillStyle = '#ffddbf';
      c.beginPath();
      c.moveTo(x, y - 5); c.lineTo(x - 4, y + 5); c.lineTo(x + 4, y + 5);
      c.closePath();
      c.fill();
      const yaw = e.player.yaw, pp = e.player.position;
      const toMap = (dx, dz) => [x + ((dx * Math.cos(yaw) - dz * Math.sin(yaw)) / 75) * size, y + ((dx * Math.sin(yaw) + dz * Math.cos(yaw)) / 75) * size];
      for (const g of e.clouds) {
        const dx = g.p[0] - pp[0], dz = g.p[2] - pp[2];
        if (Math.hypot(dx, dz) > 75) continue;
        const [px, py] = toMap(dx, dz);
        c.fillStyle = '#d9c4b155';
        c.beginPath();
        c.arc(px, py, Math.max(2.5, (e.gasRadius(g) / 75) * size), 0, Math.PI * 2);
        c.fill();
      }
      for (const list of [e.cars, e.officers])
        for (const u of list) {
          if (u.safe || u.gone || u.deployed === false || u.arrival > 0) continue;
          const dx = u.root.position[0] - pp[0], dz = u.root.position[2] - pp[2];
          if (Math.hypot(dx, dz) > 75) continue;
          const [px, py] = toMap(dx, dz);
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
