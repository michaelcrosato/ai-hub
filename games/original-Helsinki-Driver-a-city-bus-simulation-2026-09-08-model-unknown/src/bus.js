import * as THREE from 'three/webgpu';
import { box, cylinder, beam, makeLabel, drawLabel, canvasTexture, mergeChildren } from './mesh.js';
import { makePerson } from './city.js';
import { setLegacy } from './materials.js';

const LAMP_OFF = 0x3a2a12, LAMP_ON = 0xffa63a, TAIL = 0xc43125, BRAKE = 0xff4a30;

export class BusGraphics {
  constructor(scene, mats, world) {
    this.mats = mats; this.root = new THREE.Group(); this.root.name = 'Bus'; scene.add(this.root); this.shell = new THREE.Group(); this.root.add(this.shell);
    const g = this.shell, m = mats;
    // Indicator and brake lamps change colour (a uniform) while driving; their own materials keep that local.
    this.indicatorMats = [new THREE.MeshBasicMaterial({ toneMapped: false }), new THREE.MeshBasicMaterial({ toneMapped: false })];
    this.brakeMat = new THREE.MeshBasicMaterial({ toneMapped: false });
    for (const mat of this.indicatorMats) setLegacy(mat.color, LAMP_OFF); setLegacy(this.brakeMat.color, TAIL);
    // Generic 12 m low-floor electric bus, not a scanned commercial vehicle.
    box(g, m.busBlue, 2.53, 0.57, 11.84, 0, 0.89, 0, true); box(g, m.dark, 2.3, 0.3, 9.4, 0, 0.34, 0.4, true);
    box(g, m.interior, 2.44, 0.12, 11.65, 0, 0.49, 0); box(g, m.busWhite, 2.53, 0.21, 11.72, 0, 3.02, 0, true);
    box(g, m.busWhite, 1.63, 0.33, 3.0, 0, 3.26, 1.5, true); box(g, m.dark, 1.41, 0.07, 2.75, 0, 3.46, 1.5, true);
    box(g, m.driverGlass, 0.025, 1.61, 10.7, -1.265, 2.09, 0.23); for (const z of [-5.78, -3.7, -1.4, 0.9, 3.2, 5.66]) box(g, m.busWhite, 0.09, 1.71, 0.095, -1.24, 2.08, z);
    box(g, m.dark, 0.095, 1.61, 0.095, -1.16, 2.13, -5.73);
    box(g, m.dark, 0.095, 1.61, 0.095, 1.16, 2.13, -5.73);
    box(g, m.glass, 2.28, 1.53, 0.025, 0, 2.09, -5.81);
    box(g, m.busWhite, 2.44, 0.25, 0.1, 0, 2.93, -5.79, true); box(g, m.busBlue, 2.45, 0.38, 0.14, 0, 1.22, -5.84, true);
    box(g, m.black, 2.0, 0.24, 0.09, 0, 0.66, -5.97, true);
    for (const x of [-0.9, 0.9]) { box(g, m.dark, 0.44, 0.25, 0.055, x, 0.99, -5.96, true); box(g, m.lights, 0.32, 0.11, 0.061, x, 0.99, -6.0, true); box(g, m.lights, 0.055, 0.27, 0.053, x * 1.21, 1.07, -5.98); }
    box(g, m.busWhite, 2.48, 1.4, 0.09, 0, 2.12, 5.81); box(g, m.window, 2.04, 0.87, 0.025, 0, 2.22, 5.87);
    for (const x of [-1.06, 1.06]) box(g, this.brakeMat, 0.13, 0.5, 0.05, x, 1.0, 5.97, true);
    // Turn indicators at the four corners (left = index 0).
    for (const [i, x] of [[0, -1.2], [1, 1.2]]) for (const z of [-5.93, 5.93]) box(g, this.indicatorMats[i], 0.16, 0.09, 0.05, x, 1.32, z);
    for (const [z, len] of [[-2.7, 2.63], [3.25, 4.55]]) { box(g, m.sideGlass, 0.025, 1.56, len, 1.265, 2.1, z); for (const zz of [z - len / 2, z + len / 2]) box(g, m.busWhite, 0.09, 1.67, 0.1, 1.24, 2.08, zz); }
    // Cut-out door areas, with the blue waist visually masked by glass leaves.
    this.doors = [];
    for (const [name, z, width] of [['front', -4.85, 1.24], ['rear', 0.32, 1.4]]) {
      const assembly = new THREE.Group(); assembly.position.set(1.27, 0, z); g.add(assembly); const leaves = [];
      for (const side of [-1, 1]) {
        const leaf = new THREE.Group(); leaf.position.z = (side * width) / 4; assembly.add(leaf);
        box(leaf, m.dark, 0.08, 2.38, width / 2 - 0.025, 0, 1.58, 0, true); box(leaf, m.glass, 0.085, 1.76, width / 2 - 0.08, 0.005, 1.82, 0); box(leaf, m.busBlue, 0.089, 0.39, width / 2 - 0.075, 0, 0.78, 0);
        beam(leaf, m.rail, [-0.075, 1.04, -0.16], [-0.075, 2.1, -0.16], 0.018, 6); leaves.push({ leaf, side });
      }
      this.doors.push({ name, assembly, leaves, width });
    }
    this.ramp = box(g, m.metal, 0.96, 0.055, 1.29, 1.7, 0.5, 0.32); this.ramp.visible = false;
    this.wheels = [];
    for (const z of [-3.55, 2.35]) for (const x of [-1.2, 1.2]) {
      const wheel = new THREE.Group(); wheel.position.set(x, 0.51, z); g.add(wheel); const spin = new THREE.Group(); wheel.add(spin);
      const tire = cylinder(spin, m.rubber, 0.505, 0.505, 0.26, 0, 0, 0, 24); tire.rotation.z = Math.PI / 2;
      const rim = cylinder(spin, m.metal, 0.305, 0.305, 0.277, 0, 0, 0, 16); rim.rotation.z = Math.PI / 2;
      const hub = cylinder(spin, m.dark, 0.14, 0.14, 0.292, 0, 0, 0, 12); hub.rotation.z = Math.PI / 2;
      this.wheels.push({ mesh: wheel, spin, front: z < 0 });
    }
    // Floor, seats, hand rails. Interior is not animated beyond doors and boarding poses.
    for (let row = 0; row < 7; row++) for (const side of [-1, 1]) {
      const z = -2.65 + row * 1.06; if (side === 1 && Math.abs(z - 0.32) < 1.1) continue;
      for (const col of [0, 1]) { const x = side * (0.7 + col * 0.29); box(g, m.seat, 0.32, 0.1, 0.48, x, 0.98, z, true); const back = box(g, m.seat, 0.33, 0.56, 0.09, x, 1.28, z + 0.23, true); back.rotation.x = -0.07; box(g, m.metal, 0.065, 0.46, 0.065, x, 0.7, z + 0.14); }
    }
    for (const z of [-3.2, -1.3, 1.4, 3.5]) for (const x of [-0.55, 0.55]) beam(g, m.rail, [x, 0.6, z], [x, 2.8, z], 0.022, 7);
    for (const x of [-0.61, 0.61]) beam(g, m.rail, [x, 2.73, -3.45], [x, 2.73, 4.7], 0.022, 7);
    box(g, m.interior, 2.24, 0.045, 10.4, 0, 2.88, 0.3); for (const x of [-0.85, 0.85]) box(g, m.lights, 0.045, 0.015, 9.5, x, 2.845, 0.5);
    // Driver's workstation.
    box(g, m.dash, 2.3, 0.32, 0.54, 0, 1.21, -5.4, true); box(g, m.dash, 1.13, 0.22, 0.78, -0.62, 1.13, -5.0, true);
    box(g, m.dash, 0.29, 0.62, 1.55, -1.05, 0.93, -4.64, true); box(g, m.seat, 0.53, 0.13, 0.6, -0.72, 0.94, -4.0, true); box(g, m.seat, 0.55, 0.75, 0.15, -0.72, 1.34, -3.77, true);
    this.wheelRoot = new THREE.Group(); this.wheelRoot.position.set(-0.66, 1.37, -4.92); this.wheelRoot.rotation.x = -0.62; g.add(this.wheelRoot);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.285, 0.027, 10, 40), m.rubber); this.wheelRoot.add(ring);
    for (const a of [0, Math.PI * 0.67, Math.PI * 1.33]) { const spoke = box(this.wheelRoot, m.dash, 0.037, 0.24, 0.05, Math.sin(a) * 0.135, Math.cos(a) * 0.135, 0, true); spoke.rotation.z = -a; }
    box(this.wheelRoot, m.dash, 0.17, 0.145, 0.07, 0, 0, 0.01, true);
    this.instrumentCanvas = document.createElement('canvas'); this.instrumentCanvas.width = 1024; this.instrumentCanvas.height = 512; this.instrumentTexture = canvasTexture(this.instrumentCanvas, false); this.instrumentKey = '';
    const dashPanel = new THREE.Mesh(new THREE.PlaneGeometry(0.79, 0.38), new THREE.MeshBasicMaterial({ map: this.instrumentTexture, toneMapped: false })); dashPanel.position.set(-0.62, 1.44, -5.3); dashPanel.rotation.x = -0.1; g.add(dashPanel);
    const tabletTex = makeLabel(['TICKET / LIPPU', 'Select zones · Valitse vyöhykkeet', 'AB     ABC     BC', 'Tap card on reader'], 512, 512, { background: '#172a36', color: '#d9e7e9', size: 45 });
    const tablet = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.37), new THREE.MeshBasicMaterial({ map: tabletTex, toneMapped: false })); tablet.position.set(0.54, 1.51, -5.11); tablet.rotation.y = -0.35; g.add(tablet); box(g, m.dark, 0.33, 0.4, 0.04, 0.55, 1.5, -5.14, true);
    for (let i = 0; i < 6; i++) { box(g, m.black, 0.065, 0.025, 0.09, -1.06, 1.255, -4.72 + i * 0.14, true); box(g, i % 2 ? m.lights : m.busBlue, 0.02, 0.008, 0.035, -1.06, 1.273, -4.72 + i * 0.14); }
    this.destCanvas = document.createElement('canvas'); this.destCanvas.width = 1024; this.destCanvas.height = 256; this.destTexture = canvasTexture(this.destCanvas, false); this.setRoute(world);
    const dest = new THREE.Mesh(new THREE.PlaneGeometry(2.08, 0.39), new THREE.MeshBasicMaterial({ map: this.destTexture, toneMapped: false })); dest.position.set(0, 2.8, -5.87); dest.rotation.y = Math.PI; g.add(dest);
    this.wipers = [];
    for (const x of [-0.64, 0.59]) { const pivot = new THREE.Group(); pivot.position.set(x, 1.4, -5.83); g.add(pivot); beam(pivot, m.black, [0, 0, 0], [0.05, 0.73, 0], 0.012, 5); beam(pivot, m.black, [-0.15, 0.72, 0], [0.21, 0.76, 0], 0.011, 5); this.wipers.push(pivot); }
    for (const side of [-1, 1]) { beam(g, m.dark, [side * 1.15, 2.7, -5.52], [side * 1.54, 2.66, -5.4], 0.031, 7); box(g, m.dark, 0.18, 0.62, 0.29, side * 1.58, 2.42, -5.33, true); box(g, m.metal, 0.145, 0.51, 0.026, side * 1.58, 2.42, -5.16, true); }
    // Headlamp beam for the evening; its intensity follows the weather and the light switch (never toggled visible).
    this.headlight = new THREE.SpotLight(0xffffff, 0, 70, 0.52, 0.65, 1.2); setLegacy(this.headlight.color, 0xfff1d8); this.headlight.position.set(0, 1.05, -6.1); this.headlight.target.position.set(0, -0.6, -30); this.root.add(this.headlight, this.headlight.target);
    this.mergeStatic();
    this.riders = new Map(); this.indicatorOn = [false, false]; this.braking = false; this.tick = 0;
  }
  /** About 140 static parts become one mesh per material (draw calls drop from ~150 to ~20). */
  mergeStatic() { mergeChildren(this.shell, new Set([this.ramp])); }
  setRoute(world) { drawLabel(this.destCanvas, [`${world.data.route.number}   ${world.data.route.headsign}`, 'HELSINKI · HELSINGFORS'], { background: '#0b1418', color: '#f0c887', size: 76 }); this.destTexture.needsUpdate = true; }
  update(sim, dt) {
    const b = sim.bus, g = this.root; g.position.set(b.x, -b.kneel * 0.1, b.z); g.rotation.set(0, -b.yaw, 0); this.shell.rotation.z = b.kneel * 0.025; this.wheelRoot.rotation.z = -b.steer * 4.3;
    for (const w of this.wheels) { w.mesh.rotation.y = w.front ? -b.steer : 0; w.spin.rotation.x -= (b.v * dt) / 0.505; }
    for (const d of this.doors) { const open = b[d.name]; for (const { leaf, side } of d.leaves) { leaf.position.x = open * 0.19; leaf.position.z = side * (d.width / 4 + open * d.width * 0.36); leaf.rotation.y = side * open * 0.23; } }
    this.ramp.visible = b.ramp > 0.01; this.ramp.scale.x = Math.max(0.01, b.ramp); this.ramp.position.x = 1.28 + 0.46 * b.ramp; this.ramp.rotation.z = -0.17 * b.ramp;
    for (let i = 0; i < this.wipers.length; i++) this.wipers[i].rotation.z = b.wipers ? 0.82 + Math.sin(sim.time * 3.6 + i * 0.05) * 0.64 : 1.46;
    // Indicators blink in step with the cab tick; hazards light both sides.
    const blink = Math.floor(sim.time * 2.6) % 2 === 0;
    for (let i = 0; i < 2; i++) { const on = blink && (b.hazards || b.indicator === (i ? 'right' : 'left')); if (on !== this.indicatorOn[i]) { this.indicatorOn[i] = on; setLegacy(this.indicatorMats[i].color, on ? LAMP_ON : LAMP_OFF); } }
    const braking = b.brakePressure > 0.08; if (braking !== this.braking) { this.braking = braking; setLegacy(this.brakeMat.color, braking ? BRAKE : TAIL); }
    let i = 0; const tick = ++this.tick;
    for (const p of sim.passengers) {
      let m = this.riders.get(p.id); if (!m) { m = makePerson(this.mats, `rider-${p.id}`, p.coat, p.kind); m.scale.set(1, 0.76, 1); this.root.add(m); this.riders.set(p.id, m); }
      m.userData.seen = tick; const side = i % 2 ? -1 : 1; m.position.set(side * 0.77, 0.08, -2.3 + Math.floor(i / 2) * 0.94); i++;
    }
    // Riders who got off leave the bus (they used to stay as hidden meshes).
    for (const [id, m] of this.riders) if (m.userData.seen !== tick) { this.root.remove(m); this.riders.delete(id); }
    const key = `${Math.round(sim.speed)}|${b.parking ? 'P' : b.gear}|${b.engine}|${Math.round(b.battery)}|${b.air.toFixed(1)}|${sim.passengers.length}|${b.frontTarget}|${b.rearTarget}|${b.belt}`;
    if (key !== this.instrumentKey) { this.instrumentKey = key; this.drawInstruments(sim); }
  }
  clearRiders() { for (const m of this.riders.values()) this.root.remove(m); this.riders.clear(); }
  drawInstruments(sim) {
    const c = this.instrumentCanvas, ctx = c.getContext('2d'), b = sim.bus;
    ctx.fillStyle = '#101d23'; ctx.fillRect(0, 0, c.width, c.height); ctx.strokeStyle = '#31434c'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(275, 259, 183, 0.8 * Math.PI, 2.2 * Math.PI); ctx.stroke();
    ctx.strokeStyle = '#5fb6cb'; ctx.beginPath(); ctx.arc(275, 259, 183, 0.8 * Math.PI, (0.8 + 1.4 * Math.min(sim.speed / 80, 1)) * Math.PI); ctx.stroke();
    ctx.textAlign = 'center'; ctx.fillStyle = '#ebf3f3'; ctx.font = '600 146px Arial'; ctx.fillText(Math.round(sim.speed), 275, 290); ctx.font = '30px Arial'; ctx.fillStyle = '#98aeb5'; ctx.fillText('km/h', 275, 337);
    ctx.font = '600 88px Arial'; ctx.fillStyle = b.parking ? '#f8b06b' : '#ebf3f3'; ctx.fillText(b.parking ? 'P' : b.gear, 730, 164);
    ctx.font = '30px Arial'; ctx.fillStyle = '#a7cbc4'; ctx.fillText(`${b.engine ? 'READY' : 'POWER OFF'}   ${Math.round(b.battery)}%`, 730, 222); ctx.fillText(`${b.air.toFixed(1)} bar  ·  ${sim.passengers.length} riders`, 730, 274);
    ctx.font = '29px Arial'; ctx.fillStyle = b.frontTarget || b.rearTarget ? '#f2b677' : '#75c8a8'; ctx.fillText(`${b.frontTarget ? 'FRONT OPEN' : 'FRONT CLOSED'}`, 730, 338); ctx.fillText(`${b.rearTarget ? 'MIDDLE OPEN' : 'MIDDLE CLOSED'}`, 730, 379);
    ctx.fillStyle = b.belt ? '#92c2b2' : '#f09677'; ctx.fillText(b.belt ? 'BELT SECURED' : 'FASTEN BELT', 730, 440); this.instrumentTexture.needsUpdate = true;
  }
}
