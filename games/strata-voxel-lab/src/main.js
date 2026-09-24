import * as THREE from 'three/webgpu';
import { VoxelWorld } from './voxel/world.js';
import { raycastVoxels } from './voxel/raycast.js';
import { carveSphere, removeFragment } from './voxel/edit.js';
import { MAT, PALETTE } from './voxel/palette.js';
import { VOXEL_SIZE, PROFILES, LIMITS, initialProfile } from './engine/config.js';
import { FixedStepClock } from './engine/clock.js';
import { WorkerClient } from './engine/worker-client.js';
import { ChunkRenderer } from './engine/chunks.js';
import { PhysicsEngine } from './engine/physics.js';
import { Viewport } from './engine/renderer.js';
import { voxelMaterial } from './engine/materials.js';
import { InputController } from './engine/input.js';
import { randomSeed } from './scene/garden.js';
import { AREAS, initialArea, createAreaAsync } from './scene/areas.js';
import { loadSettings, saveSettings, normaliseSetting, profileDefaults } from './engine/settings.js';
import { mountGraphicsPanel } from './ui/graphics-panel.js';

const $ = selector => document.querySelector(selector);
const format = n => new Intl.NumberFormat('en', { notation: n > 9999 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(n);
const TOOL_HELP = { orbit: 'Drag to orbit. Pinch or scroll to zoom.', break: 'Tap stone to break it. Drag to orbit.', add: 'Tap a fixed surface to add limestone.', push: 'Tap a loose piece to push it.' };

class StrataEngine {
  constructor() {
    try { this.storage = localStorage; } catch { this.storage = null; }
    this.preferences = loadSettings(this.storage);
    const query = new URLSearchParams(location.search);
    this.profile = query.has('profile') || query.has('quality') ? initialProfile() : this.preferences.profile;
    this.area = initialArea(); this.layout = null;
    this.worker = new WorkerClient(); this.world = new VoxelWorld();
    this.clock = new FixedStepClock(); this.busy = true; this.paused = false; this.stopped = false;
    this.tool = 'orbit'; this.radius = 0.625; this.lastHit = null; this.autoDamage = true;
    this.random = randomSeed(321); this.frameTimes = []; this.frameCount = 0; this.fps = 0;
    this.physicsMs = 0; this.editMs = 0; this.last = 0; this.lastStats = 0; this.lastHover = 0;
    this.abort = new AbortController(); this.raf = 0; this.changedShadows = true;
  }
  async init() {
    this.loading('Start the graphics device…', 8);
    this.view = await Viewport.create($('#viewport'), this.profile, message => this.fail(new Error(message)), this.preferences.graphics[this.profile]);
    this.material = voxelMaterial(this.view.materialUniforms);
    this.loading('Start the physics solver…', 20);
    this.physics = await PhysicsEngine.create(this.view.scene, this.material, LIMITS.maxBodies);
    this.loading('Build the area…', 24);
    this.layout = await createAreaAsync(this.world, this.area, progress => this.loading('Build terrain and structures…', 24 + progress * 20));
    this.view.decorate(this.layout); this.view.home(this.layout.focus); this.physics.setFloorExtent(Math.max(100, this.layout.size * 1.5));
    this.chunks = new ChunkRenderer(this.world, this.view.scene, this.material, this.physics, this.worker);
    await this.chunks.rebuild(progress => this.loading('Build surfaces and collision shapes…', 44 + progress * 49));
    this.cursor = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), new THREE.MeshBasicNodeMaterial({ color: 0xdb9b53, wireframe: true, transparent: true, opacity: 0.35, depthWrite: false }));
    this.cursor.visible = false; this.view.scene.add(this.cursor);
    this.input = new InputController(this.view.camera, this.view.renderer.domElement, ray => this.tap(ray), ray => this.hover(ray));
    this.configureArea(); this.bind(); this.busy = false; this.loading('Prepare lighting…', 97);
    this.view.render(0, true);
    $('#loading').classList.add('is-hidden'); $('#backend').textContent = this.view.backend;
    $('#quality').value = this.profile;
    $('#worker-status').textContent = this.worker.worker ? 'Worker' : 'Main-thread fallback';
    this.setTool('orbit'); this.setStatus('Ready', 'ready'); this.updateStats();
    this.last = performance.now(); this.lastStats = this.last; this.raf = requestAnimationFrame(t => this.frame(t));
    // A small explicit debug API makes automated browser checks possible.
    window.strata = { engine: this, stats: () => this.report(), impact: point => this.breakAt(point, this.radius),
      drop: () => this.drop(), reset: () => this.reset(), pause: value => this.setPaused(value),
      setArea: id => this.switchArea(id), setProfile: name => this.setProfile(name),
      setGraphics: patch => this.setGraphics(patch), overview: () => this.goTo(-1) };
  }
  loading(text, percent) { $('#loading-text').textContent = text; $('#load-bar').style.width = `${percent}%`; }
  setStatus(text, state = 'ready') { $('#status-text').textContent = text; $('#status-dot').dataset.state = state; }
  setTool(tool) {
    this.tool = tool; this.cursor.visible = false;
    document.querySelectorAll('[data-tool]').forEach(button => {
      const active = button.dataset.tool === tool; button.classList.toggle('selected', active); button.setAttribute('aria-pressed', String(active));
    });
    $('#interaction-help').textContent = TOOL_HELP[tool];
  }
  setPaused(value) {
    this.paused = value; this.clock.accumulator = 0;
    $('#pause').textContent = value ? 'Resume' : 'Pause'; $('#pause').setAttribute('aria-pressed', String(value));
    this.setStatus(value ? 'Physics paused' : 'Ready', value ? 'paused' : 'ready');
  }
  bind() {
    const opts = { signal: this.abort.signal };
    document.querySelectorAll('[data-tool]').forEach(button => button.addEventListener('click', () => this.setTool(button.dataset.tool), opts));
    $('#drop').addEventListener('click', () => this.drop(), opts);
    $('#reset').addEventListener('click', () => this.reset(), opts);
    $('#pause').addEventListener('click', () => this.setPaused(!this.paused), opts);
    $('#home').addEventListener('click', () => this.goTo(0), opts);
    $('#overview').addEventListener('click', () => this.goTo(-1), opts);
    $('#landmark').addEventListener('change', e => this.goTo(Number(e.target.value)), opts);
    document.querySelectorAll('[data-area]').forEach(button => button.addEventListener('click', () => this.switchArea(button.dataset.area), opts));
    $('#settings').addEventListener('click', () => {
      const open = $('#inspector').classList.toggle('open'); $('#settings').setAttribute('aria-expanded', String(open));
    }, opts);
    $('#quality').addEventListener('change', e => this.setProfile(e.target.value), opts);
    this.graphicsPanel = mountGraphicsPanel($('#graphics-controls'), () => this.view.graphics,
      (key, value) => this.setGraphics({ [key]: value }), this.abort.signal);
    $('#reset-graphics').addEventListener('click', () => {
      this.preferences.graphics[this.profile] = profileDefaults(this.profile);
      this.view.setProfile(this.profile, this.preferences.graphics[this.profile]); this.saveGraphics(); this.graphicsPanel.sync();
    }, opts);
    $('#radius').addEventListener('input', e => {
      this.radius = Number(e.target.value); $('#radius-value').textContent = `${this.radius.toFixed(3)} m`;
    }, opts);
    $('#max-bodies').addEventListener('input', e => {
      this.physics.maxBodies = Number(e.target.value); $('#max-bodies-value').textContent = e.target.value;
      while (this.physics.bodies.length > this.physics.maxBodies) { this.physics.remove(this.physics.bodies[0]); this.physics.culled++; }
      this.updateStats();
    }, opts);
    $('#debris-life').addEventListener('input', e => {
      this.physics.debrisSeconds = Number(e.target.value);
      $('#debris-life-value').textContent = this.physics.debrisSeconds ? `${this.physics.debrisSeconds} s` : 'No expiry';
    }, opts);
    $('#damage').addEventListener('change', e => { this.autoDamage = e.target.checked; this.physics.impactEvents.length = 0; }, opts);
    $('#report').addEventListener('click', () => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(this.report(), null, 2)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = 'strata-device-report.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    }, opts);
    window.addEventListener('resize', () => this.view.resize(), opts);
    window.addEventListener('keydown', e => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLButtonElement) return;
      const tool = { Digit1: 'orbit', Digit2: 'break', Digit3: 'add', Digit4: 'push' }[e.code];
      if (tool) this.setTool(tool);
      if (e.code === 'Space') { e.preventDefault(); this.drop(); }
      if (e.code === 'KeyP') this.setPaused(!this.paused);
      if (e.code === 'KeyR') this.reset();
    }, opts);
    document.addEventListener('visibilitychange', () => { this.last = performance.now(); this.clock.accumulator = 0; this.frameTimes.length = 0; }, opts);
    window.addEventListener('pagehide', () => this.dispose(), { ...opts, once: true });
  }
  saveGraphics() {
    this.preferences.profile = this.profile;
    this.preferences.graphics[this.profile] = { ...this.view.graphics };
    $('#save-status').textContent = saveSettings(this.storage, this.preferences) ? 'Settings saved on this browser.' : 'Settings apply to this session only.';
  }
  setProfile(name) {
    if (!Object.hasOwn(PROFILES, name)) throw new RangeError(`Unknown profile: ${name}`);
    this.preferences.graphics[this.profile] = { ...this.view.graphics };
    this.profile = name; this.view.setProfile(name, this.preferences.graphics[name]);
    $('#quality').value = name; this.graphicsPanel?.sync(); this.changedShadows = true; this.saveGraphics(); this.updateStats();
  }
  setGraphics(patch) {
    const next = { ...this.view.graphics };
    for (const [key, value] of Object.entries(patch)) next[key] = normaliseSetting(key, value);
    this.view.applyGraphics(next); this.graphicsPanel?.sync(); this.changedShadows = true; this.saveGraphics(); this.updateStats();
    return { ...this.view.graphics };
  }
  configureArea() {
    this.input.controls.maxDistance = Math.max(75, this.layout.size * 4);
    this.input.controls.target.fromArray(this.layout.focus); this.input.controls.update();
    const select = $('#landmark'); select.replaceChildren();
    this.layout.landmarks.forEach((landmark, index) => {
      const option = document.createElement('option'); option.value = index; option.textContent = landmark.name; select.append(option);
    });
    document.querySelectorAll('[data-area]').forEach(button => {
      const active = button.dataset.area === this.area; button.classList.toggle('selected', active); button.setAttribute('aria-pressed', String(active));
    });
    $('#scene-title').textContent = this.layout.title; $('#scene-description').textContent = this.layout.description;
    $('#area-size').textContent = `${this.layout.size} × ${this.layout.size} m`;
    $('#area-detail').textContent = `${this.layout.sites.length} garden${this.layout.sites.length === 1 ? '' : 's'} · ${this.layout.links.length} path links`;
  }
  goTo(index) {
    if (this.busy) return;
    const focus = index < 0 ? [0, 1.65, 0] : this.layout.landmarks[index]?.focus;
    if (!focus) return;
    this.input.controls.target.fromArray(focus); this.view.home(focus, index < 0); this.input.controls.update();
    this.lastHit = null; this.cursor.visible = false;
    if (index >= 0) $('#landmark').value = index;
  }
  voxelHit(ray) { return raycastVoxels(this.world, ray.ray.origin.toArray(), ray.ray.direction.toArray(), this.view.graphics.drawDistance); }
  hover(ray) {
    if (this.busy || performance.now() - this.lastHover < 32) return;
    this.lastHover = performance.now(); const hit = this.voxelHit(ray); this.lastHit = hit;
    this.cursor.visible = this.tool === 'break' && !!hit;
    if (hit) { this.cursor.position.fromArray(hit.point); this.cursor.scale.setScalar(this.radius); $('#material-name').textContent = PALETTE[hit.material].name; }
  }
  tap(ray) {
    if (this.busy || this.stopped || this.tool === 'orbit') return;
    const hit = this.voxelHit(ray); this.lastHit = hit;
    this.view.scene.updateMatrixWorld();
    const dynamic = ray.intersectObjects(this.physics.bodies.map(entry => entry.mesh), false)[0];
    const nearBody = dynamic && (!hit || dynamic.distance < hit.distance);
    if (this.tool === 'push') {
      if (nearBody) this.physics.impulse(dynamic.object.userData.physics, ray.ray.direction.toArray(), 5, dynamic.point.toArray());
      else this.setStatus('Tap a loose piece to push it.', 'paused');
    } else if (this.tool === 'break') {
      if (nearBody) this.shatterBody(dynamic.object.userData.physics, dynamic.point.toArray());
      else if (hit) this.breakAt(hit.point, this.radius);
    } else if (this.tool === 'add' && hit && !nearBody) this.addAt(hit);
  }
  async transaction(label, action) {
    if (this.busy || this.stopped) return;
    this.busy = true; this.cursor.visible = false; this.setStatus(label, 'busy');
    const start = performance.now();
    try {
      await action(); this.view.updateEmitters(this.world); this.changedShadows = true; this.physics.impactEvents.length = 0;
      this.setStatus(this.paused ? 'Physics paused' : 'Ready', this.paused ? 'paused' : 'ready');
    } catch (error) { this.fail(error); }
    finally { this.editMs = performance.now() - start; this.busy = false; this.clock.accumulator = 0; this.updateStats(); }
  }
  breakAt(point, radius) {
    return this.transaction('Rebuild the damaged area…', async () => {
      const removed = carveSphere(this.world, point, radius);
      if (!removed.count) return;
      const chips = await this.worker.run('shatter', removed);
      const falling = await this.worker.run('support-sparse', this.world.snapshotSparse());
      for (const fragment of falling) removeFragment(this.world, fragment);
      await this.chunks.rebuild();
      for (const fragment of [...falling, ...chips]) {
        const centre = fragment.origin.map((v, d) => (v + fragment.dims[d] / 2) * VOXEL_SIZE);
        const delta = new THREE.Vector3().fromArray(centre).sub(new THREE.Vector3().fromArray(point));
        const distance = delta.length(); delta.normalize().multiplyScalar(Math.max(0.2, 3.5 * (1 - distance / (radius * 3)))); delta.y += 1;
        this.physics.addFragment(fragment, delta.toArray());
      }
      this.physics.radialImpulse(point, radius * 4, 1.5); this.view.burst(point);
    });
  }
  shatterBody(entry, point) {
    return this.transaction('Split the loose piece…', async () => {
      const velocity = new THREE.Vector3().copy(entry.body.linvel()), angular = new THREE.Vector3().copy(entry.body.angvel());
      const position = entry.current.clone(), rotation = entry.currentQ.clone(), centre = entry.centre.clone();
      const pieces = await this.worker.run('shatter', { data: entry.voxelData.slice(), dims: entry.dims, origin: [0, 0, 0] });
      this.physics.remove(entry);
      for (const part of pieces) {
        const offset = new THREE.Vector3(...part.origin.map((v, d) => (v + part.dims[d] / 2) * VOXEL_SIZE)).sub(centre).applyQuaternion(rotation);
        const worldCentre = position.clone().add(offset);
        const v = velocity.clone().add(angular.clone().cross(offset));
        part.origin = worldCentre.toArray().map((value, d) => value / VOXEL_SIZE - part.dims[d] / 2);
        const child = this.physics.addFragment(part, v.toArray(), rotation);
        child?.body.setAngvel(angular, true);
      }
      this.physics.radialImpulse(point, 2.5, 2.4); this.view.burst(point);
    });
  }
  addAt(hit) {
    return this.transaction('Add a voxel block…', async () => {
      // Place a 3-cell cube completely outside the hit face. No embedded centre voxel.
      const normal = hit.normal.some(Boolean) ? hit.normal : [0, 1, 0];
      const start = hit.cell.map((v, d) => v + (normal[d] > 0 ? 1 : normal[d] < 0 ? -3 : -1));
      if (start.some((value, d) => value < this.layout.editBounds.min[d] || value + 3 > this.layout.editBounds.max[d])) return;
      // Reject placement inside a loose body. Check both simulation and displayed poses.
      const blockBounds = new THREE.Box3(new THREE.Vector3(...start).multiplyScalar(VOXEL_SIZE),
        new THREE.Vector3(...start.map(v => v + 3)).multiplyScalar(VOXEL_SIZE));
      for (const entry of this.physics.bodies) {
        const geometryBounds = entry.mesh.geometry.boundingBox;
        const matrix = new THREE.Matrix4().compose(entry.current, entry.currentQ, new THREE.Vector3(1, 1, 1));
        const simulated = geometryBounds.clone().applyMatrix4(matrix).expandByScalar(0.015);
        const displayed = new THREE.Box3().setFromObject(entry.mesh).expandByScalar(0.015);
        if (blockBounds.intersectsBox(simulated) || blockBounds.intersectsBox(displayed)) return;
      }
      for (let z = 0; z < 3; z++) for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
        const p = [start[0] + x, start[1] + y, start[2] + z];
        if (!this.world.get(...p)) this.world.set(...p, MAT.LIMESTONE);
      }
      await this.chunks.rebuild();
    });
  }
  drop() {
    return this.transaction('Create a physical voxel block…', async () => {
      const point = this.lastHit?.point || this.input.controls.target.toArray(), dims = [4, 4, 4], data = new Uint8Array(64).fill(MAT.COPPER);
      const fragment = await this.worker.run('fragment', { dims, data, count: 64,
        origin: [Math.round(point[0] / VOXEL_SIZE) - 2, Math.round(Math.max(5.5, point[1] + 4) / VOXEL_SIZE), Math.round(point[2] / VOXEL_SIZE) - 2] });
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.17, this.random() * 0.5, 0.12));
      this.physics.addFragment(fragment, [0.15, -1, 0], q);
    });
  }
  reset() { return this.switchArea(this.area, true); }
  switchArea(id, force = false) {
    if (!Object.hasOwn(AREAS, id)) throw new RangeError(`Unknown area: ${id}`);
    if (!force && id === this.area) return Promise.resolve();
    return this.transaction('Build the selected area…', async () => {
      $('#loading').classList.remove('is-hidden'); this.areaLoading = true;
      document.querySelectorAll('[data-area]').forEach(button => { button.disabled = true; });
      try {
        this.physics.clearDynamic(); this.chunks.dispose(); this.world = new VoxelWorld(); this.lastHit = null;
        this.loading('Build terrain and structures…', 2);
        this.layout = await createAreaAsync(this.world, id, progress => this.loading('Build terrain and structures…', 2 + progress * 35));
        this.view.decorate(this.layout); this.physics.setFloorExtent(Math.max(100, this.layout.size * 1.5));
        this.chunks = new ChunkRenderer(this.world, this.view.scene, this.material, this.physics, this.worker);
        await this.chunks.rebuild(progress => this.loading('Build surfaces and collision shapes…', 37 + progress * 59));
        this.area = id; this.configureArea(); this.view.home(this.layout.focus);
        this.clock.reset(); this.physics.culled = 0; this.physics.time = 0;
        this.frameTimes.length = 0; this.frameCount = 0; this.fps = 0; this.lastStats = performance.now();
      } finally {
        this.areaLoading = false; $('#loading').classList.add('is-hidden');
        document.querySelectorAll('[data-area]').forEach(button => { button.disabled = false; });
      }
    });
  }
  frame(now) {
    if (this.stopped) return;
    this.raf = requestAnimationFrame(t => this.frame(t));
    if (document.hidden) { this.last = now; return; }
    const elapsed = (now - this.last) / 1000;
    this.last = now; const dt = Math.min(elapsed, 0.25);
    if (this.areaLoading) { this.clock.accumulator = 0; return; }
    try {
      const start = performance.now();
      const state = this.clock.advance(elapsed, fixed => this.physics.step(fixed), this.busy || this.paused);
      this.physicsMs = performance.now() - start; this.physics.sync(state.alpha); this.input.update(); this.view.updateFocus(this.input.controls.target);
      const moving = this.changedShadows || (!this.paused && !this.busy && this.physics.awake > 0);
      this.view.render(dt, moving); this.changedShadows = false;
      this.frameCount++; this.frameTimes.push(elapsed * 1000); if (this.frameTimes.length > 240) this.frameTimes.shift();
      if (now - this.lastStats >= 750) {
        this.fps = this.frameCount * 1000 / (now - this.lastStats); this.frameCount = 0; this.lastStats = now; this.updateStats();
      }
      if (!this.busy && !this.paused) {
        const event = this.physics.impactEvents.shift(); this.physics.impactEvents.length = 0;
        if (event && this.autoDamage) {
          const hit = raycastVoxels(this.world, event.origin, event.velocity, event.reach);
          if (hit) this.breakAt(hit.point, event.radius);
        }
      }
    } catch (error) { this.fail(error); }
  }
  updateStats() {
    if (!this.physics || !this.view) return;
    $('#fps').textContent = this.fps ? Math.round(this.fps) : '—';
    $('#voxel-count').textContent = format(this.world.count);
    $('#triangle-count').textContent = format(this.chunks.triangles);
    $('#body-count').textContent = `${this.physics.bodies.length} / ${this.physics.maxBodies}`;
    $('#awake-count').textContent = `${this.physics.awake} awake`;
    $('#physics-ms').textContent = `${this.physicsMs.toFixed(1)} ms`;
    $('#scale-value').textContent = `${Math.round(this.view.scale * 100)}%${this.view.resolutionHardwareLimited ? ' · hardware limit' : ''}`;
    $('#resolution').textContent = `${this.view.renderer.domElement.width} × ${this.view.renderer.domElement.height}`;
    $('#collider-count').textContent = format(this.physics.staticCount);
  }
  report() {
    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    return { engine: 'Strata 0.2.0', date: new Date().toISOString(), userAgent: navigator.userAgent, secureContext: isSecureContext,
      backend: this.view?.backend, profile: this.profile, area: this.area, areaMetres: this.layout?.size, graphics: { ...this.view?.graphics }, fps: this.fps,
      p95FrameMs: sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : null,
      physicsCpuMsLastFrame: this.physicsMs, lastEditWallMs: this.editMs, droppedSimulationSeconds: this.clock.droppedSeconds,
      voxelMetres: VOXEL_SIZE, fixedStepHz: 60, staticVoxels: this.world.count,
      staticTriangles: this.chunks?.triangles, chunks: this.chunks?.meshes.size, staticColliders: this.physics?.staticCount,
      dynamicBodies: this.physics?.bodies.length, awakeBodies: this.physics?.awake, budgetCulledBodies: this.physics?.culled,
      debrisLifetimeSeconds: this.physics?.debrisSeconds, maxBodies: this.physics?.maxBodies,
      resolutionHardwareLimited: this.view?.resolutionHardwareLimited, actualShadowSize: this.view?.actualShadowSize,
      resolutionScale: this.view?.scale, pixelRatio: this.view?.dpr, worker: !!this.worker.worker,
      drawingBuffer: this.view ? [this.view.renderer.domElement.width, this.view.renderer.domElement.height] : null,
      note: 'Frame time is browser wall time. It is not a GPU timestamp or a temperature reading.' };
  }
  fail(error) {
    console.error(error); this.stopped = true; cancelAnimationFrame(this.raf);
    $('#loading').classList.add('is-hidden'); $('#error').hidden = false;
    $('#error-detail').textContent = error instanceof Error ? error.message : String(error);
    this.setStatus('Stopped. Reload to recover.', 'error');
  }
  dispose() {
    this.stopped = true; cancelAnimationFrame(this.raf); this.abort.abort(); this.input?.dispose();
    this.chunks?.dispose(); this.physics?.dispose(); this.worker.dispose(); this.material?.dispose(); this.view?.dispose();
    delete window.strata;
  }
}

export async function boot() {
  const engine = new StrataEngine();
  try { await engine.init(); } catch (error) { engine.fail(error); }
}
