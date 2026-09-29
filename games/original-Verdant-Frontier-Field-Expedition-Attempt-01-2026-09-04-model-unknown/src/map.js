import { WORLD, LANDMARKS, PALETTE } from './config.js';

const RGB = PALETTE.map(hex => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]);

export class MapSystem {
  constructor(miniCanvas, mapCanvas, terrain, player, survey, bus) {
    this.mini = miniCanvas; this.canvas = mapCanvas; this.terrain = terrain; this.player = player; this.survey = survey; this.bus = bus; this.open = false; this.center = { x: 0, z: 0 }; this.span = 10000; this.drag = null; this.mouse = { x: 0, z: 0 }; this.stamp = 0; this.showCenter = false;
    this.atlas = document.createElement('canvas'); this.atlas.width = this.atlas.height = 640; this.atlasReady = false; this.atlasRow = 0; this.atlasImage = this.atlas.getContext('2d').createImageData(640, 640); this.extent = 32768;
    this.local = document.createElement('canvas'); this.local.width = this.local.height = 160; this.localCenter = { x: Infinity, z: Infinity }; this.localSpan = 1200; this.localRow = 0; this.localImage = null; this.pixel = [0, 0, 0, 255];
    // The map is a DOM panel with its own pointer surface: drag to pan, tap for a waypoint, wheel or pinch to zoom.
    this.pointers = new Map(); this.pinch = 0;
    mapCanvas.addEventListener('pointerdown', e => {
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { this.canvas.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
      if (this.pointers.size === 2) { this.drag = null; this.pinch = this.pinchDistance(); return; }
      const r = this.canvas.getBoundingClientRect(); this.drag = { x: e.clientX, y: e.clientY, cx: this.center.x, cz: this.center.z, moved: false, w: r.width };
    });
    mapCanvas.addEventListener('pointermove', e => {
      const r = this.canvas.getBoundingClientRect(); this.mouse.x = this.center.x + ((e.clientX - r.left) / r.width - 0.5) * this.span; this.mouse.z = this.center.z + ((e.clientY - r.top) / r.height - 0.5) * this.span * r.height / r.width;
      const p = this.pointers.get(e.pointerId); if (p) { p.x = e.clientX; p.y = e.clientY; }
      if (this.pointers.size === 2) { const d = this.pinchDistance(); if (this.pinch > 0 && d > 0) this.zoom(this.pinch / d); this.pinch = d; return; }
      if (this.drag) { const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y; if (Math.hypot(dx, dy) > 5) this.drag.moved = true; this.center.x = this.drag.cx - dx / this.drag.w * this.span; this.center.z = this.drag.cz - dy / this.drag.w * this.span; this.clampCenter(); }
    });
    const end = e => {
      const wasPinch = this.pointers.size > 1; this.pointers.delete(e.pointerId); if (this.pointers.size < 2) this.pinch = 0;
      if (e.type === 'pointerup' && !wasPinch && this.drag && !this.drag.moved) { const p = this.fromScreen(e.clientX, e.clientY); if (Math.abs(p.x) <= WORLD.halfSize && Math.abs(p.z) <= WORLD.halfSize) this.survey.setWaypoint(p.x, p.z); }
      this.drag = null;
    };
    mapCanvas.addEventListener('pointerup', end); mapCanvas.addEventListener('pointercancel', end);
    mapCanvas.addEventListener('wheel', e => { e.preventDefault(); this.zoom(e.deltaY > 0 ? 1.2 : 1 / 1.2); }, { passive: false });
  }
  pinchDistance() { const [a, b] = [...this.pointers.values()]; return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0; }
  clampCenter() { this.center.x = Math.max(-WORLD.halfSize, Math.min(WORLD.halfSize, this.center.x)); this.center.z = Math.max(-WORLD.halfSize, Math.min(WORLD.halfSize, this.center.z)); }
  fromScreen(x, y) { const r = this.canvas.getBoundingClientRect(); return { x: this.center.x + ((x - r.left) / r.width - 0.5) * this.span, z: this.center.z + ((y - r.top) / r.width - r.height / r.width * 0.5) * this.span }; }
  zoom(factor) { this.span = Math.max(500, Math.min(34000, this.span * factor)); }
  /** Gamepad / keyboard panning, in fractions of the visible span per second. */
  pan(x, z, dt) { this.center.x += x * this.span * 0.6 * dt; this.center.z += z * this.span * 0.6 * dt; this.clampCenter(); }
  waypointAtCenter() { if (Math.abs(this.center.x) <= WORLD.halfSize && Math.abs(this.center.z) <= WORLD.halfSize) this.survey.setWaypoint(this.center.x, this.center.z); }
  centerPlayer() { this.center = { x: this.player.position.x, z: this.player.position.z }; }
  colorPixel(x, z, detail = false) {
    const k = this.terrain.kernel, h = k.height(x, z), b = k.biome(x, z, h), c = RGB[b], out = this.pixel;
    let r = c[0], g = c[1], blue = c[2];
    const shade = Math.max(0.58, Math.min(1.2, 0.9 + (k.height(x - 12, z - 12) - h) * 0.012)); r *= shade; g *= shade; blue *= shade;
    if (h > WORLD.water) { const spacing = detail ? 10 : 50, contour = h % spacing; if (contour < spacing * 0.09) { r *= 0.77; g *= 0.77; blue *= 0.77; } }
    out[0] = r; out[1] = g; out[2] = blue; return out;
  }
  buildAtlas() {
    if (this.atlasReady) return; const size = 640, end = Math.min(size, this.atlasRow + 8), data = this.atlasImage.data;
    for (let j = this.atlasRow; j < end; j++) for (let i = 0; i < size; i++) { const x = (i / size - 0.5) * this.extent, z = (j / size - 0.5) * this.extent; data.set(this.colorPixel(x, z), (j * size + i) * 4); }
    this.atlasRow = end; this.atlas.getContext('2d').putImageData(this.atlasImage, 0, 0, 0, 0, size, end); this.atlasReady = end === size;
  }
  buildLocal() {
    const p = this.player.position; if (Math.hypot(p.x - this.localCenter.x, p.z - this.localCenter.z) > 100 && !this.localImage) { this.localPending = { x: p.x, z: p.z }; this.localImage = this.local.getContext('2d').createImageData(160, 160); this.localRow = 0; }
    if (!this.localImage) return; const data = this.localImage.data, end = Math.min(160, this.localRow + 12), c = this.localPending;
    for (let j = this.localRow; j < end; j++) for (let i = 0; i < 160; i++) data.set(this.colorPixel(c.x + (i / 160 - 0.5) * this.localSpan, c.z + (j / 160 - 0.5) * this.localSpan, true), (j * 160 + i) * 4);
    // The finished tile and its centre switch together, so the detail layer never draws offset.
    this.localRow = end; if (end === 160) { this.local.getContext('2d').putImageData(this.localImage, 0, 0); this.localCenter = c; this.localImage = null; }
  }
  draw(canvas, center, span, mini) {
    const rect = canvas.getBoundingClientRect(); if (!rect.width || !rect.height) return; const dpr = Math.min(window.devicePixelRatio || 1, 2), w = Math.round(rect.width * dpr), h = Math.round(rect.height * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#172c28'; ctx.fillRect(0, 0, w, h);
    const scale = w / span, toScreen = (x, z) => ({ x: (x - center.x) * scale + w / 2, y: (z - center.z) * scale + h / 2 });
    const corner = toScreen(-this.extent / 2, -this.extent / 2); ctx.drawImage(this.atlas, corner.x, corner.y, this.extent * scale, this.extent * scale);
    if (mini && Number.isFinite(this.localCenter.x)) { const p = toScreen(this.localCenter.x - this.localSpan / 2, this.localCenter.z - this.localSpan / 2); ctx.imageSmoothingEnabled = true; ctx.drawImage(this.local, p.x, p.y, this.localSpan * scale, this.localSpan * scale); }
    const grid = mini ? 200 : span > 15000 ? 4000 : span > 7000 ? 2000 : span > 2500 ? 1000 : 200; ctx.strokeStyle = 'rgba(217,238,205,0.14)'; ctx.lineWidth = dpr * 0.5;
    for (let x = Math.floor((center.x - span / 2) / grid) * grid; x < center.x + span / 2; x += grid) { const p = toScreen(x, 0); ctx.beginPath(); ctx.moveTo(p.x, 0); ctx.lineTo(p.x, h); ctx.stroke(); }
    for (let z = Math.floor((center.z - span * h / w / 2) / grid) * grid; z < center.z + span * h / w / 2; z += grid) { const p = toScreen(0, z); ctx.beginPath(); ctx.moveTo(0, p.y); ctx.lineTo(w, p.y); ctx.stroke(); }
    ctx.textAlign = 'center';
    for (const mark of LANDMARKS) {
      const p = toScreen(mark.x, mark.z); if (p.x < 10 || p.x > w - 10 || p.y < 10 || p.y > h - 10) continue;
      const reached = this.survey.landmarks.has(mark.id);
      ctx.fillStyle = mark.type === 'station' ? '#ffcb7b' : reached ? '#f6bc70' : '#d5e1c6'; ctx.beginPath(); ctx.arc(p.x, p.y, (mini ? 2.5 : 3) * dpr, 0, Math.PI * 2); ctx.fill();
      if (!mini) { const label = reached ? `${mark.name} ✓` : mark.name; ctx.font = `600 ${12 * dpr}px system-ui`; ctx.strokeStyle = 'rgba(9,24,23,.75)'; ctx.lineWidth = 4 * dpr; ctx.strokeText(label, p.x, p.y - 11 * dpr); ctx.fillText(label, p.x, p.y - 11 * dpr); }
    }
    if (!mini) for (const record of this.survey.records) { const p = toScreen(record.x, record.z); ctx.fillStyle = '#bbe0c0'; ctx.fillRect(p.x - 2 * dpr, p.y - 2 * dpr, 4 * dpr, 4 * dpr); }
    for (let i = 0; i < this.survey.beacons.length; i++) { const b = this.survey.beacons[i], p = toScreen(b.x, b.z); ctx.strokeStyle = '#ffbc6b'; ctx.lineWidth = 1.5 * dpr; ctx.strokeRect(p.x - 4 * dpr, p.y - 4 * dpr, 8 * dpr, 8 * dpr); if (!mini) { ctx.fillStyle = '#ffcc8e'; ctx.font = `${12 * dpr}px system-ui`; ctx.fillText(`B${i + 1}`, p.x, p.y + 17 * dpr); } }
    const waypoint = this.survey.waypoint; if (waypoint) { const p = toScreen(waypoint.x, waypoint.z), player = toScreen(this.player.position.x, this.player.position.z); ctx.strokeStyle = '#ffbf70'; ctx.lineWidth = 1.5 * dpr; ctx.setLineDash([4 * dpr, 5 * dpr]); ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(p.x, p.y - 7 * dpr); ctx.lineTo(p.x + 6 * dpr, p.y); ctx.lineTo(p.x, p.y + 7 * dpr); ctx.lineTo(p.x - 6 * dpr, p.y); ctx.closePath(); ctx.stroke(); }
    const p = toScreen(this.player.position.x, this.player.position.z); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(-this.player.yaw);
    ctx.fillStyle = 'rgba(255,228,161,.12)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, mini ? 65 * dpr : 28 * dpr, -Math.PI / 2 - 0.65, -Math.PI / 2 + 0.65); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffe1a1'; ctx.strokeStyle = '#253a30'; ctx.lineWidth = 2 * dpr; ctx.beginPath(); ctx.moveTo(0, -9 * dpr); ctx.lineTo(6 * dpr, 6 * dpr); ctx.lineTo(0, 3 * dpr); ctx.lineTo(-6 * dpr, 6 * dpr); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    if (!mini && this.showCenter) { ctx.strokeStyle = '#ffe1a1'; ctx.lineWidth = 1.5 * dpr; ctx.beginPath(); ctx.moveTo(w / 2 - 12 * dpr, h / 2); ctx.lineTo(w / 2 + 12 * dpr, h / 2); ctx.moveTo(w / 2, h / 2 - 12 * dpr); ctx.lineTo(w / 2, h / 2 + 12 * dpr); ctx.stroke(); }
    ctx.fillStyle = '#e1e9d4'; ctx.font = `600 ${12 * dpr}px system-ui`; ctx.textAlign = 'left'; ctx.fillText('N', 12 * dpr, 21 * dpr);
    if (!mini) { const m = this.showCenter ? this.center : this.mouse; ctx.font = `${12 * dpr}px ui-monospace,monospace`; ctx.fillText(`${Math.round(m.x)} E / ${Math.round(-m.z)} N`, 20 * dpr, h - 20 * dpr); }
    const bar = mini ? 100 : span > 10000 ? 2000 : span > 3000 ? 1000 : 200; ctx.strokeStyle = '#d8e3c6'; ctx.lineWidth = 1.5 * dpr; ctx.beginPath(); ctx.moveTo(w - 20 * dpr - bar * scale, h - 23 * dpr); ctx.lineTo(w - 20 * dpr, h - 23 * dpr); ctx.stroke(); ctx.textAlign = 'right'; ctx.font = `${11 * dpr}px system-ui`; ctx.fillText(bar >= 1000 ? `${bar / 1000} km` : `${bar} m`, w - 20 * dpr, h - 30 * dpr);
  }
  update(dt) { this.buildAtlas(); this.buildLocal(); this.stamp += dt; if (this.stamp < 0.1) return; this.stamp = 0; this.draw(this.mini, { x: this.player.position.x, z: this.player.position.z }, 800, true); if (this.open) this.draw(this.canvas, this.center, this.span, false); }
}
