import * as THREE from 'three/webgpu';
import { BIOMES, WORLD, CAIRNS } from './config.js';
import { BEACON_LIMIT, BEACON_LIMIT_KIT } from './core.js';
import { evaluate } from './commissions.js';

const _dir = new THREE.Vector3(), _to = new THREE.Vector3(), _probe = new THREE.Vector3();

export class SurveySystem {
  constructor(scene, camera, terrain, nature, wildlife, rendering, bus, saved) {
    this.scene = scene; this.camera = camera; this.terrain = terrain; this.nature = nature; this.wildlife = wildlife; this.rendering = rendering; this.bus = bus;
    this.records = saved?.records || []; this.recordIds = new Set(this.records.map(r => r.id)); this.visited = new Set(saved?.visited || []);
    this.landmarks = new Set(saved?.landmarks || []); this.completed = new Set(saved?.completed || []); this.maxAltitude = saved?.maxAltitude || 0; this.finished = saved?.finished === true;
    this.beacons = []; this.waypoint = null; this.target = null; this.progress = 0; this.scanId = null; this.cooldown = 0; this.pulseTime = 0; this.revealed = []; this.pulseCooldown = 0; this.sampleTimer = 0; this.altitudeTimer = 0;
    this.perks = new Set(); this.plantBuffer = []; this.animalBuffer = [];
    this.markerMaterial = rendering.createMaterial({ color: 0xffbf60, emissive: 0xffa63a, emissiveIntensity: 0.3 }); this.markerGeometry = new THREE.CylinderGeometry(0.06, 0.09, 1.9, 6); this.capGeometry = new THREE.OctahedronGeometry(0.24);
    for (const b of saved?.beacons || []) this.addBeacon(b.x, b.z, b.id, false);
  }
  get beaconLimit() { return this.perks.has('beacons') ? BEACON_LIMIT_KIT : BEACON_LIMIT; }
  get pulseRecharge() { return this.perks.has('pulse') ? 4 : 6; }
  findTarget(player) {
    const origin = this.camera.position, direction = this.camera.getWorldDirection(_dir);
    const plants = this.nature.nearby(player.position, 170, this.plantBuffer), animals = this.wildlife.nearby(player.position, 170, this.animalBuffer);
    let best = null, bestScore = Infinity, bestDistance = 0;
    for (const list of [plants, animals]) for (const e of list) {
      const v = _to.set(e.x, e.height + (e.category === 'fauna' ? 0.8 : 0), e.z).sub(origin), along = v.dot(direction); if (along < 0 || along > 165) continue;
      const lateral = Math.sqrt(Math.max(0, v.lengthSq() - along * along)), limit = Math.max(e.radius || 1, along * 0.016);
      if (lateral > limit) continue; let blocked = false;
      for (let n = 1; n < 12; n++) { _probe.copy(origin).addScaledVector(v, n / 12); if (_probe.y < this.terrain.height(_probe.x, _probe.z) + 0.15) { blocked = true; break; } }
      if (blocked) continue; const score = along + lateral * 8; if (score < bestScore) { bestScore = score; best = e; bestDistance = Math.hypot(e.x - origin.x, e.height - origin.y, e.z - origin.z); }
    }
    if (best) {
      // Fauna is a live object; keep the id and a snapshot of what the card shows.
      return { id: best.id, name: best.name, category: best.category, x: best.x, z: best.z, height: best.height, radius: best.radius, biome: best.biome, description: best.description, distance: bestDistance };
    }
    for (let d = 3; d <= 230; d += 3) {
      _probe.copy(origin).addScaledVector(direction, d); const h = this.terrain.height(_probe.x, _probe.z), water = h < WORLD.water;
      if (_probe.y <= Math.max(h, WORLD.water)) {
        const b = this.terrain.kernel.biome(_probe.x, _probe.z, h), id = `${water ? 'water' : 'terrain'}:${Math.round(_probe.x / 40)},${Math.round(_probe.z / 40)}`;
        return { id, name: water ? 'Freshwater sample' : `${BIOMES[b]} terrain`, category: water ? 'water' : 'terrain', x: _probe.x, z: _probe.z, height: water ? WORLD.water : h, radius: 2, biome: b, distance: d, description: water ? 'Record water level and position.' : 'Record ground height, slope, and region.' };
      }
    }
    return null;
  }
  pulse(player) {
    if (this.pulseCooldown > 0) { this.bus.emit('notice', `Scanner ready in ${Math.ceil(this.pulseCooldown)} s.`); return false; }
    const wide = this.perks.has('pulse');
    this.pulseCooldown = this.pulseRecharge; this.pulseTime = 5; this.rendering.scanPulse = 0.001;
    const plants = this.nature.nearby(player.position, wide ? 142 : 95, this.plantBuffer), animals = this.wildlife.nearby(player.position, wide ? 225 : 150, this.animalBuffer);
    const px = player.position.x, pz = player.position.z;
    this.revealed = [...plants, ...animals].filter(e => !this.recordIds.has(e.id)).sort((a, b) => Math.hypot(a.x - px, a.z - pz) - Math.hypot(b.x - px, b.z - pz)).slice(0, 14);
    this.bus.emit('pulse'); this.bus.emit('notice', `${this.revealed.length} nearby survey targets detected.`);
    return true;
  }
  addBeacon(x, z, id = `beacon-${Date.now()}-${this.beacons.length}`, announce = true) {
    if (announce && this.beacons.length >= this.beaconLimit) { this.bus.emit('notice', 'Beacon limit reached. Remove a beacon from the field journal.'); return null; }
    const y = Math.max(this.terrain.height(x, z), WORLD.water), group = new THREE.Group(); group.position.set(x, y, z); const pole = new THREE.Mesh(this.markerGeometry, this.markerMaterial); pole.position.y = 0.95; const cap = new THREE.Mesh(this.capGeometry, this.markerMaterial); cap.position.y = 2.1; group.add(pole, cap); group.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; }); this.scene.add(group);
    const beacon = { id, x, z, mesh: group }; this.beacons.push(beacon); if (announce) { this.bus.emit('notice', `Beacon ${this.beacons.length} placed.`); this.bus.emit('beacon'); this.bus.emit('surveychange'); } return beacon;
  }
  removeBeacon(id) { const i = this.beacons.findIndex(b => b.id === id); if (i < 0) return; this.scene.remove(this.beacons[i].mesh); this.beacons.splice(i, 1); this.bus.emit('surveychange'); }
  setWaypoint(x, z, name = 'Waypoint') { this.waypoint = { x, z, name }; this.bus.emit('notice', `${name} set.`); this.bus.emit('waypoint', this.waypoint); }
  /** Check commissions; newly finished ones fire 'commission', and 'expeditioncomplete' once when all are done. */
  checkCommissions() {
    const results = evaluate(this);
    for (const r of results) if (r.done && !this.completed.has(r.commission.id)) { this.completed.add(r.commission.id); this.bus.emit('commission', r.commission); }
    if (!this.finished && results.every(r => r.done)) { this.finished = true; this.bus.emit('expeditioncomplete'); }
    return results;
  }
  update(dt, player, input, hour) {
    const ground = this.terrain.height(player.position.x, player.position.z), biome = this.terrain.kernel.biome(player.position.x, player.position.z, ground);
    if (!this.visited.has(biome)) { this.visited.add(biome); this.bus.emit('region', BIOMES[biome]); this.bus.emit('surveychange'); }
    this.cooldown = Math.max(0, this.cooldown - dt); this.pulseCooldown = Math.max(0, this.pulseCooldown - dt); this.pulseTime = Math.max(0, this.pulseTime - dt); this.sampleTimer -= dt;
    if (this.sampleTimer <= 0) { this.sampleTimer = 0.12; this.target = this.findTarget(player); }
    const target = this.target;
    if (input.down('record') && target && !this.recordIds.has(target.id) && this.cooldown === 0) {
      if (this.scanId !== target.id) { this.progress = 0; this.scanId = target.id; }
      const speed = this.perks.has('lens') ? 1 / 0.7 : 1;
      this.progress += dt * speed / (target.category === 'fauna' ? 1.3 : 0.9);
      if (this.progress >= 1) {
        const slope = Math.atan(Math.hypot(this.terrain.height(target.x + 2, target.z) - this.terrain.height(target.x - 2, target.z), this.terrain.height(target.x, target.z + 2) - this.terrain.height(target.x, target.z - 2)) / 4) * 180 / Math.PI;
        const record = { id: target.id, name: target.name, category: target.category, x: Math.round(target.x), z: Math.round(target.z), height: Math.round(target.height), biome: target.biome, slope: Math.round(slope), hour: Math.round(hour * 100) / 100, time: new Date().toISOString() };
        const newSpecies = (record.category === 'flora' || record.category === 'fauna') && !this.records.some(r => r.name === record.name);
        this.records.push(record); this.recordIds.add(record.id); this.progress = 0; this.scanId = null; this.cooldown = 0.5;
        this.revealed = this.revealed.filter(e => e.id !== record.id);
        this.bus.emit('record', { record, newSpecies }); this.bus.emit('surveychange');
      }
    } else { this.progress = 0; this.scanId = null; }
    if (this.waypoint && Math.hypot(player.position.x - this.waypoint.x, player.position.z - this.waypoint.z) < 8) { this.bus.emit('notice', `${this.waypoint.name} reached.`); this.waypoint = null; }
    // Landmark cairns and the altitude record are checked a few times a second.
    this.altitudeTimer -= dt;
    if (this.altitudeTimer <= 0) {
      this.altitudeTimer = 0.25; let changed = false;
      for (const c of CAIRNS) if (!this.landmarks.has(c.id) && Math.hypot(player.position.x - c.x, player.position.z - c.z) < 30) { this.landmarks.add(c.id); this.bus.emit('landmark', c); changed = true; }
      if (!player.fly && player.position.y > this.maxAltitude + 1) { const before = this.maxAltitude; this.maxAltitude = Math.round(player.position.y); if (before < 1500 && this.maxAltitude >= 1500) changed = true; }
      if (changed) this.bus.emit('surveychange');
    }
    for (const b of this.beacons) b.mesh.children[1].rotation.y += dt * 0.7;
  }
  get counts() { const unique = c => new Set(this.records.filter(r => r.category === c).map(r => r.name)).size; return { flora: unique('flora'), fauna: unique('fauna'), terrain: this.records.filter(r => r.category === 'terrain').length, water: this.records.filter(r => r.category === 'water').length, regions: this.visited.size, total: this.records.length }; }
  serialize() { return { records: this.records, visited: [...this.visited], beacons: this.beacons.map(({ id, x, z }) => ({ id, x, z })), landmarks: [...this.landmarks], completed: [...this.completed], maxAltitude: this.maxAltitude, finished: this.finished }; }
  dispose() { for (const b of this.beacons) this.scene.remove(b.mesh); this.markerGeometry.dispose(); this.capGeometry.dispose(); }
}
