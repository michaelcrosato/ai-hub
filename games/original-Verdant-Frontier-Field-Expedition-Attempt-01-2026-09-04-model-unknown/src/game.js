import * as THREE from 'three/webgpu';
import { VERSION, WORLD, DEFAULTS } from './config.js';
import { EventBus, SaveSystem, AudioSystem } from './core.js';
import { RenderingSystem } from './rendering.js';
import { TerrainSystem } from './terrain.js';
import { NatureSystem, WildlifeSystem } from './nature.js';
import { PlayerSystem } from './player.js';
import { SurveySystem } from './survey.js';
import { MapSystem } from './map.js';
import { UISystem } from './ui.js';
import { COMMISSIONS } from './commissions.js';

const TITLE_OFFSET = new THREE.Vector3(-18, 38, 36);

// Small, explicit systems form the public extension surface. Add features as
// systems that use this event bus and implement update(dt), serialize(), dispose().
export class Game {
  constructor(kit, options = {}) {
    this.kit = kit; this.options = options; this.bus = new EventBus(); this.storage = new SaveSystem(this.bus, options.storageKey); const saved = this.storage.read(); this.hasSave = !!saved;
    this.settings = { ...DEFAULTS, ...saved?.settings, ...options.settings }; if (!saved && matchMedia('(prefers-reduced-motion: reduce)').matches) this.settings.headBob = false;
    this.started = false; this.running = false; this.failed = false; this.fps = 60; this.dev = { enabled: false, freezeWildlife: false }; this.extensions = new Map(); this.accumulator = 0; this.saveTimer = 0; this.frame = 0; this.playTime = saved?.playTime || 0;
    this.perks = new Set();
    this.rendering = new RenderingSystem(kit, this.settings, this.bus);
    const terrainMaterial = this.rendering.createMaterial({ vertexColors: true, flatShading: true, roughness: 0.98 });
    this.terrain = new TerrainSystem(this.rendering.scene, terrainMaterial, this.bus);
    this.nature = new NatureSystem(this.rendering.scene, this.terrain, this.rendering);
    this.wildlife = new WildlifeSystem(this.rendering.scene, this.terrain, this.rendering);
    this.input = kit.input; this.audio = new AudioSystem(this.settings);
    this.player = new PlayerSystem(this.rendering.camera, this.input, this.terrain, this.nature, this.settings, this.bus, saved?.player); this.player.distance = saved?.distance || 0;
    if (!saved) { this.player.yaw = -0.43; this.player.pitch = -0.055; }
    this.survey = new SurveySystem(this.rendering.scene, this.rendering.camera, this.terrain, this.nature, this.wildlife, this.rendering, this.bus, saved?.survey);
    this.map = new MapSystem(document.getElementById('minimap'), document.getElementById('fullmap'), this.terrain, this.player, this.survey, this.bus);
    this.applyPerks();
    // Commissions are checked first whenever the survey changes (records, regions, cairns, altitude),
    // so the UI's journal refresh and save that follow already include the result.
    this.bus.on('surveychange', () => this.survey.checkCommissions());
    this.ui = new UISystem(this); this.terrain.plan(this.player.position, this.rendering.preset.distance, true);
    this.audioState = { speed: 0, grounded: false, swimming: false, altitude: 0, day: 1, lush: false, underwater: false };

    const bus = this.bus;
    bus.on('jump', () => this.audio.tone(110, 0.05, 0.12));
    bus.on('land', impact => { this.audio.tone(55, 0.10, 0.35); if (impact > 9) this.input.rumble(Math.min(0.8, impact / 22), 90); });
    bus.on('slide', () => this.input.rumble(0.25, 140));
    bus.on('pulse', () => this.input.rumble(0.35, 160));
    bus.on('beacon', () => { this.audio.tone(660, 0.14, 0.2); this.input.rumble(0.2, 60); });
    bus.on('preset', () => this.terrain.plan(this.player.position, this.rendering.preset.distance, true));
    bus.on('landmark', site => { this.audio.fanfare(); this.input.rumble(0.4, 180); bus.emit('notice', `Landmark reached: ${site.name}.`); });
    bus.on('commission', c => { this.applyPerks(); this.audio.fanfare(true); this.input.rumble(0.6, 260); });
    this.survey.checkCommissions();
    this.onPageHide = () => this.save(false); window.addEventListener('pagehide', this.onPageHide);
    // Losing focus or hiding the tab pauses the expedition.
    this.onBlur = () => { if (this.running) this.ui.open('pause'); };
    window.addEventListener('blur', this.onBlur);
    this.onVisibility = () => { if (document.hidden) { this.save(false); if (this.running) this.ui.open('pause'); } };
    document.addEventListener('visibilitychange', this.onVisibility);
    // The kit's settings panel pauses the loop; keep the sound in step with it.
    kit.onPause(p => { if (p) this.audio.pause(); else if (this.running) this.audio.resume(); });
  }
  applyPerks() {
    this.perks.clear(); for (const c of COMMISSIONS) if (this.survey.completed.has(c.id) && c.perk) this.perks.add(c.perk);
    this.player.perks = this.perks; this.survey.perks = this.perks; this.wildlife.fleeScale = this.perks.has('quiet') ? 0.5 : 1; this.rendering.lamp = this.perks.has('lamp');
  }
  serialize() { return { version: 1, seed: WORLD.seed, player: this.player.serialize(), settings: { ...this.settings }, survey: this.survey.serialize(), distance: this.player.distance, playTime: Math.round(this.playTime) }; }
  registerSystem(name, system) { if (typeof name !== 'string' || !name || !system || typeof system !== 'object') throw new Error('Provide a system name and object.'); if (this.extensions.has(name)) throw new Error(`System ${name} is already registered.`); system.init?.(this); this.extensions.set(name, system); return () => this.unregisterSystem(name); }
  unregisterSystem(name) { const system = this.extensions.get(name); if (!system) return; system.dispose?.(); this.extensions.delete(name); }
  save(announce = false) { if (this.player && this.survey && !this.resetting) return this.storage.write(this.serialize(), announce); return false; }
  /** Erase the save and start over at the field station. */
  reset() { this.resetting = true; this.storage.clear(); location.reload(); }
  diagnostics() {
    const r = this.kit.renderer, info = r.info;
    return { version: VERSION, threeRevision: THREE.REVISION, backend: this.kit.backend, tier: this.kit.tier.name, seed: WORLD.seed, capturedAt: new Date().toISOString(), settings: { ...this.settings }, player: this.player.serialize(), fps: this.fps, viewport: { width: innerWidth, height: innerHeight, pixelRatio: r.getPixelRatio() }, render: { calls: info.render.calls, triangles: info.render.triangles }, memory: { geometries: info.memory.geometries, textures: info.memory.textures }, terrain: { chunks: this.terrain.chunks.size, queued: this.terrain.queue.length, worker: !!this.terrain.worker, error: this.terrain.error }, natureCells: this.nature.cells.size, wildlife: this.wildlife.animals.length, notes: 'FPS is measured on this device.' };
  }
  /** One frame, driven by kit.start. */
  tick(dt) {
    if (this.failed) return;
    this.fps = THREE.MathUtils.lerp(this.fps, 1 / Math.max(0.001, dt), 0.035);
    try {
      this.terrain.update(this.player.position, this.rendering.preset.distance); this.nature.update(dt, this.player.position, this.rendering.preset.vegetation);
      let hadPhysics = false;
      if (this.running) {
        this.player.readInput();
        // A bounded 120 Hz fixed step keeps movement stable across display rates.
        this.accumulator = Math.min(this.accumulator + dt, 0.1); let steps = 0;
        while (this.accumulator >= 1 / 120 && steps < 12) { this.player.update(1 / 120); this.accumulator -= 1 / 120; steps++; hadPhysics = true; }
        if (!hadPhysics) this.player.applyCamera(dt);
        this.survey.update(dt, this.player, this.input, this.settings.time);
        const a = this.audioState, p = this.player; a.speed = p.speed; a.grounded = p.grounded || p.swimming; a.swimming = p.swimming; a.altitude = p.position.y; a.day = this.rendering.daylight; a.underwater = this.rendering.underwater > 0.5;
        if ((this.frame & 15) === 0) { const b = this.terrain.kernel.biome(p.position.x, p.position.z, this.terrain.height(p.position.x, p.position.z)); a.lush = b === 0 || b === 1 || b === 5; }
        this.audio.update(dt, a);
        for (const system of this.extensions.values()) system.update?.(dt, this);
        this.playTime += dt; this.saveTimer += dt; if (this.saveTimer > 20) { this.saveTimer = 0; this.save(false); }
      } else {
        this.accumulator = 0;
        if (!this.started) { const cam = this.rendering.camera; cam.position.copy(this.player.position).add(TITLE_OFFSET); cam.rotation.set(-0.11, -0.38 + Math.sin((this.options.visualTime ?? performance.now()) * 0.000035) * 0.035, 0, 'YXZ'); }
      }
      this.wildlife.update(dt, this.player, (this.started && !this.running) || this.dev.freezeWildlife || Number.isFinite(this.options.visualTime), this.rendering.isNight);
      this.rendering.update(Number.isFinite(this.options.visualTime) ? 0 : dt, this.player, !this.running); this.map.update(dt); this.rendering.render(); this.ui.update(dt); this.frame++;
    } catch (error) { this.fail(error); }
  }
  fail(error) {
    if (this.failed) return; this.failed = true; this.running = false; this.input?.unlockPointer(); this.audio?.pause(); this.save(false); console.error('Verdant Frontier:', error);
    this.kit.touch?.suspend(true, 'game');
    document.getElementById('error-panel').classList.remove('hidden'); document.getElementById('error-message').textContent = 'Something went wrong in the expedition. Your last saved expedition is kept.'; document.getElementById('error-detail').textContent = String(error?.message || error).slice(0, 800);
  }
  dispose() { this.kit.stop(); window.removeEventListener('pagehide', this.onPageHide); window.removeEventListener('blur', this.onBlur); document.removeEventListener('visibilitychange', this.onVisibility); this.save(false); for (const name of [...this.extensions.keys()]) this.unregisterSystem(name); this.audio.dispose(); this.survey.dispose(); this.wildlife.dispose(); this.nature.dispose(); this.terrain.dispose(); this.rendering.dispose(); }
}
