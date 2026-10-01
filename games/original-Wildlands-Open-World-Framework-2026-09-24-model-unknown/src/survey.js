// survey.js — the survey: 21 posts across the seven landscapes, each sending up a
// pale beam until you walk (or fly low) past it, plus a record of the landscapes
// you have set foot in. Progress is kept per world seed.
import * as THREE from 'three/webgpu';
import { CONFIG, SURVEY_SITES, BIOMES } from './config.js';
import { mergedProp, place } from './environment.js';

const RADIUS = 22;
const BEAM_HEIGHT = 380;

/** The nearest dry, fairly level ground to where a post was meant to stand. */
export function siteGround(gen, site) {
  let x = site.x;
  const z = site.z;
  if (site.river) x = gen.riverX(z);
  if (site.canyon) x = gen.canyonX(z);
  const ok = (px, pz) => {
    const h = gen.height(px, pz);
    if (h < CONFIG.seaLevel + 1.5) return false;
    return Math.abs(gen.height(px + 6, pz) - h) + Math.abs(gen.height(px, pz + 6) - h) <= 6;
  };
  for (let r = 0; r <= 600; r += 15) {
    const steps = r === 0 ? 1 : Math.max(8, Math.round(r / 12));
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2 + r * 0.37;
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (ok(px, pz)) return { x: px, z: pz };
    }
  }
  return { x, z };
}

export class SurveySystem {
  constructor(app, material) {
    this.app = app; this.events = app.events; this.generator = app.generator;
    this.root = new THREE.Group(); this.root.name = 'survey'; app.scene.add(this.root);
    // One merged post (pole, instrument box, cairn stones) shared by every site; it uses
    // the terrain material, so the whole survey adds no new shader.
    const wood = 0x72543a, metal = 0x494c43, rock = 0x77766b;
    const parts = [
      [new THREE.CylinderGeometry(0.11, 0.16, 4.8, 5), wood, place(0, 2.4, 0)],
      [new THREE.BoxGeometry(0.65, 0.18, 0.5), metal, place(0, 1.6, 0)],
    ];
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; parts.push([new THREE.IcosahedronGeometry(0.42, 0), rock, place(Math.cos(a) * 0.62, 0.18, Math.sin(a) * 0.62, 0, a, 0, 1, 0.7, 1)]); }
    parts.push([new THREE.IcosahedronGeometry(0.34, 0), rock, place(0.1, 0.55, 0.05, 0, 0.4, 0, 1, 0.8, 1)]);
    this.postGeo = mergedProp(parts);
    this.flagGeo = new THREE.BoxGeometry(1.8, 0.85, 0.025); this.flagGeo.translate(0.9, 0, 0);
    this.flagOpen = new THREE.MeshStandardMaterial({ color: 0xddd0a3, roughness: 0.95, flatShading: true });
    this.flagDone = new THREE.MeshStandardMaterial({ color: 0xd9773f, roughness: 0.95, flatShading: true });
    this.beamGeo = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true); this.beamGeo.translate(0, 0.5, 0);
    this.beamMat = new THREE.MeshBasicMaterial({ color: 0xffe3a0, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    this.beamMat.name = 'survey beam';
    this.sites = SURVEY_SITES.map((def, index) => {
      const group = new THREE.Group(); group.name = `survey ${def.id}`;
      const post = new THREE.Mesh(this.postGeo, material); post.castShadow = post.receiveShadow = true;
      const flag = new THREE.Mesh(this.flagGeo, this.flagOpen); flag.position.set(0, 4.2, 0); flag.castShadow = true;
      const beam = new THREE.Mesh(this.beamGeo, this.beamMat); beam.position.y = 4.8; beam.frustumCulled = false; beam.renderOrder = 2;
      group.add(post, flag, beam); this.root.add(group);
      return { def, index, x: def.x, z: def.z, h: 0, group, flag, beam, found: false, distance: Infinity };
    });
    this.found = new Set(); this.biomes = new Set(); this.playTime = 0; this.completedAt = null; this.best = null; this.clock = 0;
    this.origin = { x: 0, z: 0 };
    this.placeSites(this.generator);
  }
  get total() { return this.sites.length; }
  get count() { return this.found.size; }
  placeSites(generator) {
    this.generator = generator;
    for (const site of this.sites) {
      const p = siteGround(generator, site.def);
      site.x = p.x; site.z = p.z; site.h = generator.groundHeight(p.x, p.z) - 0.15;
    }
    this.setOrigin(this.origin);
  }
  setOrigin(origin) {
    this.origin = { x: origin.x, z: origin.z };
    for (const s of this.sites) s.group.position.set(s.x - origin.x, s.h, s.z - origin.z);
  }
  /** Apply saved progress (or a fresh survey with null). */
  load(progress) {
    this.found = new Set(progress?.found || []); this.biomes = new Set(progress?.biomes || []);
    this.playTime = progress?.time || 0; this.completedAt = progress?.completedAt ?? null; this.best = progress?.best ?? null;
    for (const s of this.sites) this.mark(s, this.found.has(s.def.id));
  }
  toJSON() { return { found: [...this.found], biomes: [...this.biomes], time: Math.round(this.playTime), completedAt: this.completedAt, best: this.best }; }
  /** A new seed: posts move to that world's ground and its own progress loads. */
  reset(generator, progress) { this.placeSites(generator); this.load(progress); }
  mark(site, found) {
    site.found = found;
    site.flag.material = found ? this.flagDone : this.flagOpen;
    site.beam.visible = !found;
  }
  record(site) {
    if (site.found) return;
    this.found.add(site.def.id); this.mark(site, true);
    const count = this.count;
    this.events.emit('survey:found', { site, count, total: this.total });
    if (count === this.total && this.completedAt == null) {
      this.completedAt = this.playTime;
      if (this.best == null || this.playTime < this.best) this.best = this.playTime;
      this.events.emit('survey:complete', { time: this.playTime });
    }
  }
  /** The landscape under the player, from the HUD's terrain sample. */
  noteBiome(biome) {
    if (this.biomes.has(biome)) return;
    this.biomes.add(biome);
    this.events.emit('survey:biome', { biome, name: BIOMES[biome], count: this.biomes.size, total: BIOMES.length });
  }
  /** The closest post not yet recorded, or null when the survey is done. */
  nearestOpen() {
    let best = null;
    for (const s of this.sites) if (!s.found && (!best || s.distance < best.distance)) best = s;
    return best;
  }
  /** Forget this seed's survey (posts, landscapes and time; the best time stays). */
  clear() { const best = this.best; this.load(null); this.best = best; }
  update(dt, playing) {
    this.clock += dt;
    if (playing) this.playTime += dt;
    const p = this.app.player.position, feet = p.y - CONFIG.eyeHeight;
    this.beamMat.opacity = 0.24 + Math.sin(this.clock * 1.8) * 0.06;
    for (const s of this.sites) {
      const d = Math.hypot(p.x - s.x, p.z - s.z); s.distance = d;
      if (s.found) continue;
      // Beams keep a readable width far away and thin out as you arrive.
      const r = Math.min(16, Math.max(0.9, d / 520));
      s.beam.scale.set(r, BEAM_HEIGHT, r);
      if (d < 700) s.flag.rotation.y = Math.sin(this.clock * 1.6 + s.index) * 0.35;
      if (playing && d < RADIUS && Math.abs(feet - s.h) < 40) this.record(s);
    }
  }
  dispose() {
    this.root.removeFromParent(); this.postGeo.dispose(); this.flagGeo.dispose(); this.beamGeo.dispose();
    this.flagOpen.dispose(); this.flagDone.dispose(); this.beamMat.dispose();
  }
}
