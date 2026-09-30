/**
 * relays.js — the three silent relays (free, ordered and timed signal
 * puzzles) and the Stillpoint hub whose beam wakes when all three answer.
 * Relay progress is saved on its own key, apart from the field record.
 */
import * as THREE from 'three/webgpu';
import { RELAYS, STORAGE } from './data.js';
import { StaticBatch, glowMaterial, prim } from './primitives.js';

class Relay {
  constructor(parent, definition, terrain, interactions, materials, collision, render, emit) {
    this.definition = definition;
    this.terrain = terrain;
    this.interactions = interactions;
    this.materials = materials;
    this.collision = collision;
    this.emit = emit;
    this.id = definition.id;
    this.title = definition.title;
    this.root = new THREE.Group();
    this.root.name = `Challenge / ${definition.title}`;
    parent.add(this.root);
    this.nodes = [];
    this.ownedMaterials = [];
    this.disposers = [];
    this.elapsed = 0;
    this.expectedIndex = 0;
    this.remainingTime = 0;
    this.started = false;
    this.isComplete = false;

    const [x, z] = definition.position;
    const ground = terrain.heightAt(x, z);
    const batch = new StaticBatch();
    batch.add('cylinder', materials.structure, [x, ground + 0.28, z], [8, 0.55, 8]);
    batch.add('cylinder', materials.structureAccent, [x, ground + 2.2, z], [1.3, 4.2, 1.3]);
    const crown = glowMaterial(`${definition.id} / core`, definition.color, 2.2);
    this.ownedMaterials.push(crown);
    batch.add('sphere', crown, [x, ground + 4.5, z], [1.15, 1.15, 1.15]);
    this.disposers.push(
      collision.addSurface({ id: `relay:${this.id}:foundation`, minX: x - 2.8, maxX: x + 2.8, minZ: z - 2.8, maxZ: z + 2.8, height: ground + 0.555 }),
      collision.add({ id: `relay:${this.id}:core`, minX: x - 0.65, maxX: x + 0.65, minZ: z - 0.65, maxZ: z + 0.65, minY: ground - 1, maxY: ground + 5 }),
    );
    this.beam = prim(this.root, 'box', materials.beam, [x, ground + 38, z], [0.22, 68, 0.22], { cast: false, receive: false, name: 'Relay sky beam' });
    this.beam.visible = true;
    this.disposers.push(render.addLight({ position: new THREE.Vector3(x, ground + 5, z), color: definition.color, intensity: 1.1, range: 25 }));
    this.buildNodes(batch);
    batch.build(this.root);
  }

  get complete() {
    return this.isComplete;
  }

  update(dt) {
    this.elapsed += dt;
    if (this.definition.rule === 'timed' && this.started && !this.isComplete) {
      this.remainingTime -= dt;
      if (this.remainingTime <= 0) {
        this.resetNodes();
        this.started = false;
        this.remainingTime = 0;
        this.emit({ type: 'timeout', challengeId: this.id, title: this.title, detail: 'The circuit decayed. Start again at the first pylon.' });
      }
    }
    for (let i = 0; i < this.nodes.length; i += 1) {
      const node = this.nodes[i];
      const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * 2.1 + i * 1.7);
      node.glow.emissiveIntensity = node.solved ? 11 + pulse * 5 : 1.4 + pulse * 1.2;
    }
  }

  hudState() {
    let progress = `${this.nodes.filter((n) => n.solved).length}/${this.nodes.length}`;
    if (this.definition.rule === 'timed' && this.started && !this.isComplete) progress += ` • ${Math.max(0, Math.ceil(this.remainingTime))}s`;
    return { id: this.id, title: this.title, state: this.isComplete ? 'complete' : this.started ? 'active' : 'dormant', progress };
  }

  serialize() {
    return { complete: this.isComplete };
  }

  restore(data) {
    if (!data.complete) return;
    for (const node of this.nodes) node.solved = true;
    this.expectedIndex = this.nodes.length;
    this.started = true;
    this.isComplete = true;
    this.beam.visible = true;
  }

  destroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
    this.root.removeFromParent();
    for (const m of this.ownedMaterials) m.dispose();
    this.ownedMaterials.length = 0;
  }

  buildNodes(batch) {
    const [cx, cz] = this.definition.position;
    const timed = this.definition.rule === 'timed';
    const baseRadius = timed ? 11 : 10;
    for (let i = 0; i < this.definition.nodeCount; i += 1) {
      const angle = timed ? Math.PI * (0.15 + i * 0.35) : (i / this.definition.nodeCount) * Math.PI * 2 - Math.PI / 2;
      const radius = timed ? baseRadius + i * 4.5 : baseRadius;
      const x = cx + Math.cos(angle) * radius;
      const z = cz + Math.sin(angle) * radius;
      const ground = this.terrain.heightAt(x, z);
      batch.add('box', this.materials.structure, [x, ground + 1.55, z], [1.35, 3.1 + i * 0.18, 1.35]);
      batch.add('cone', this.materials.structureAccent, [x, ground + 3.35 + i * 0.18, z], [1.3, 1.1, 1.3]);
      const glow = glowMaterial(`${this.definition.id} / node ${i + 1}`, this.definition.color, 2);
      this.ownedMaterials.push(glow);
      const signal = prim(this.root, 'sphere', glow, [x, ground + 3.95 + i * 0.18, z], [0.58, 0.58, 0.58], { name: `Signal ${i + 1}` });
      for (let t = 0; t <= i; t += 1) batch.add('box', glow, [x - 0.42 + t * 0.28, ground + 1.65, z - 0.7], [0.11, 0.5, 0.07], null, false);
      this.disposers.push(this.collision.add({ id: `relay:${this.id}:stone:${i}`, minX: x - 0.675, maxX: x + 0.675, minZ: z - 0.675, maxZ: z + 0.675, minY: ground - 1, maxY: ground + 4 }));
      const node = { entity: signal, glow, solved: false };
      this.nodes.push(node);
      this.disposers.push(
        this.interactions.register({
          id: `${this.definition.id}:node:${i}`,
          entity: signal,
          label: () => this.nodeLabel(i),
          holdSeconds: this.definition.holdSeconds,
          enabled: () => !this.isComplete && !node.solved,
          interact: () => this.activateNode(i),
        }),
      );
    }
  }

  nodeLabel(index) {
    if (this.definition.rule === 'free') return `Scan shard ${index + 1}`;
    if (this.definition.rule === 'timed' && !this.started) return index === 0 ? 'Start circuit' : 'Circuit offline';
    return `Pulse glyph ${index + 1}`;
  }

  activateNode(index) {
    if (this.isComplete) return;
    const node = this.nodes[index];
    if (!node || node.solved) return;
    if (!this.started) {
      if (this.definition.rule === 'timed' && index !== 0) {
        this.emit({ type: 'rejected', challengeId: this.id, title: this.title, detail: 'The first marked pylon must carry the opening pulse.' });
        return;
      }
      this.started = true;
      if (this.definition.rule === 'timed') this.remainingTime = this.definition.timeLimit ?? 24;
      this.emit({ type: 'started', challengeId: this.id, title: this.title, detail: this.definition.subtitle });
    }
    if (this.definition.rule !== 'free' && index !== this.expectedIndex) {
      this.resetNodes();
      if (this.definition.rule === 'timed') this.remainingTime = this.definition.timeLimit ?? 24;
      this.emit({ type: 'rejected', challengeId: this.id, title: this.title, detail: 'Pattern rejected. The marked order has reset.' });
      return;
    }
    node.solved = true;
    if (this.definition.rule !== 'free') this.expectedIndex += 1;
    const solved = this.nodes.filter((n) => n.solved).length;
    if (solved === this.nodes.length) {
      this.isComplete = true;
      this.beam.visible = true;
      this.emit({ type: 'complete', challengeId: this.id, title: this.title, detail: 'Relay synchronized with the Stillpoint.', nodeIndex: index });
      return;
    }
    this.emit({ type: 'progress', challengeId: this.id, title: this.title, detail: `Signal ${solved} of ${this.nodes.length} accepted.`, nodeIndex: index });
  }

  resetNodes() {
    for (const node of this.nodes) node.solved = false;
    this.expectedIndex = 0;
  }
}

export class RelayNetwork {
  constructor({ scene, terrain, interactions, materials, collision, render, hud, soundscape, input, onVictory }) {
    this.terrain = terrain;
    this.interactions = interactions;
    this.materials = materials;
    this.collision = collision;
    this.hud = hud;
    this.soundscape = soundscape;
    this.input = input;
    this.onVictory = onVictory;
    this.hubDisposers = [];
    this.allComplete = false;
    this.hudSignature = '';
    this.devRelayCount = null;
    this.elapsed = 0;
    this.root = new THREE.Group();
    this.root.name = 'Relay network';
    scene.add(this.root);
    this.challenges = RELAYS.map((def) => new Relay(this.root, def, terrain, interactions, materials, collision, render, (event) => this.handleEvent(event)));
    this.hubGlow = glowMaterial('Stillpoint core', [0.34, 1, 0.78], 1.8);
    const hub = this.buildHub();
    this.hub = hub.root;
    this.hubBeam = hub.beam;
    this.hubCrown = hub.crown;
    this.restore();
    this.refreshState(false);
  }

  update(dt) {
    this.elapsed += dt;
    for (const relay of this.challenges) relay.update(dt);
    const pulse = 0.5 + Math.sin(this.elapsed * 1.5) * 0.5;
    this.hubGlow.emissiveIntensity = this.allComplete ? 18 + pulse * 8 : 1.5 + pulse;
    this.syncHud();
  }

  get completedIds() {
    return this.devRelayCount === null ? new Set(this.challenges.filter((c) => c.complete).map((c) => c.id)) : new Set(this.challenges.slice(0, this.devRelayCount).map((c) => c.id));
  }
  get completedCount() {
    return this.devRelayCount === null ? this.challenges.filter((c) => c.complete).length : this.devRelayCount;
  }
  get actualCompletedCount() {
    return this.challenges.filter((c) => c.complete).length;
  }
  get relaySimulationLabel() {
    return this.devRelayCount === null ? 'AUTO' : `${this.devRelayCount} / ${this.challenges.length}`;
  }
  /** Where the hub's crown is, for the vault entrance and the finale. */
  get hubPosition() {
    return this.hubCrown.getWorldPosition(new THREE.Vector3());
  }

  cycleDevRelaySimulation() {
    this.devRelayCount = this.devRelayCount === null ? 0 : this.devRelayCount >= this.challenges.length ? null : this.devRelayCount + 1;
    this.hubBeam.visible = this.devRelayCount === null ? this.allComplete : this.devRelayCount === this.challenges.length;
    this.syncHud(true);
    return this.relaySimulationLabel;
  }

  destroy() {
    for (const dispose of this.hubDisposers) dispose();
    for (const relay of this.challenges) relay.destroy();
    this.root.removeFromParent();
    this.hubGlow.dispose();
  }

  handleEvent(event) {
    switch (event.type) {
      case 'started':
        this.hud.showToast(event.title, event.detail, 'RELAY ACQUIRED');
        this.soundscape.ping(0);
        break;
      case 'progress':
        this.soundscape.ping((event.nodeIndex ?? 0) + 1);
        break;
      case 'rejected':
      case 'timeout':
        this.hud.showToast(event.title, event.detail, event.type === 'timeout' ? 'CIRCUIT LOST' : 'PATTERN REJECTED');
        this.soundscape.reject();
        this.input?.rumble(0.45, 140);
        break;
      case 'complete':
        this.hud.showToast(event.title, event.detail, 'RELAY RESTORED', 4000);
        this.soundscape.complete();
        this.input?.rumble(0.7, 260);
        this.save();
        this.refreshState(true);
        break;
      default:
        break;
    }
    this.syncHud(true);
  }

  /** The objective line is computed by the game from the whole campaign; this only tracks the network. */
  refreshState(announce) {
    const wasComplete = this.allComplete;
    this.allComplete = this.challenges.every((c) => c.complete);
    this.hubBeam.visible = this.devRelayCount === null ? this.allComplete : this.devRelayCount === this.challenges.length;
    if (this.allComplete && announce && !wasComplete) {
      this.hud.showToast('All relays answer', 'The Stillpoint is awake. Return to the central tower.', 'NETWORK SYNCHRONIZED', 5000);
      this.soundscape.finale();
    }
    this.syncHud(true);
  }

  get remainingCount() {
    return this.challenges.filter((c) => !c.complete).length;
  }

  syncHud(force = false) {
    const rows = this.challenges.map((relay, index) => {
      const row = relay.hudState();
      if (this.devRelayCount === null) return row;
      return {
        ...row,
        state: index < this.devRelayCount ? 'complete' : index === this.devRelayCount ? 'active' : 'dormant',
        progress: index < this.devRelayCount ? 'DEV COMPLETE' : index === this.devRelayCount ? 'DEV ACTIVE' : 'DEV DORMANT',
      };
    });
    let signature = '';
    for (const r of rows) signature += `${r.id}:${r.state}:${r.progress}|`;
    if (force || signature !== this.hudSignature) {
      this.hudSignature = signature;
      this.hud.setChallenges(rows);
    }
  }

  buildHub() {
    const root = new THREE.Group();
    root.name = 'Stillpoint / central hub';
    this.root.add(root);
    const ground = this.terrain.heightAt(0, 0);
    const batch = new StaticBatch();
    batch.add('cylinder', this.materials.structure, [0, ground + 0.35, 0], [11, 0.7, 11]);
    batch.add('cylinder', this.materials.structureAccent, [0, ground + 4.1, 0], [2.3, 7.8, 2.3]);
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      const x = Math.cos(a) * 7.4;
      const z = Math.sin(a) * 7.4;
      const h = this.terrain.heightAt(x, z);
      batch.add('box', i % 2 === 0 ? this.materials.structure : this.materials.structureAccent, [x, h + 1.4, z], [0.65, 2.8, 0.65], [0, (-a * 180) / Math.PI, i % 2 === 0 ? 5 : -5]);
      this.hubDisposers.push(this.collision.add({ id: `hub:marker:${i}`, minX: x - 0.35, maxX: x + 0.35, minZ: z - 0.35, maxZ: z + 0.35, minY: h - 1, maxY: h + 3 }));
    }
    batch.build(root);
    const crown = prim(root, 'sphere', this.hubGlow, [0, ground + 8.6, 0], [1.45, 1.45, 1.45], { name: 'Crown' });
    const beam = prim(root, 'box', this.materials.beam, [0, ground + 49, 0], [0.38, 82, 0.38], { cast: false, receive: false, name: 'Stillpoint beam' });
    beam.visible = false;
    this.hubDisposers.push(
      this.collision.addSurface({ id: 'hub:foundation', minX: -3.85, maxX: 3.85, minZ: -3.85, maxZ: 3.85, height: ground + 0.7 }),
      this.collision.add({ id: 'hub:core', minX: -1.15, maxX: 1.15, minZ: -1.15, maxZ: 1.15, minY: ground - 1, maxY: ground + 9.5 }),
      this.interactions.register({
        id: 'stillpoint:finale',
        entity: crown,
        label: 'Open the Stillpoint',
        holdSeconds: 1.5,
        range: 8,
        enabled: () => this.allComplete,
        interact: () => {
          this.soundscape.finale();
          this.onVictory();
        },
      }),
    );
    return { root, beam, crown };
  }

  save() {
    const data = { version: 1, challenges: Object.fromEntries(this.challenges.map((c) => [c.id, c.serialize()])) };
    try {
      localStorage.setItem(STORAGE.relays, JSON.stringify(data));
    } catch {
      /* storage refused: progress lasts for this session */
    }
  }

  restore() {
    try {
      const raw = localStorage.getItem(STORAGE.relays);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.version !== 1) return;
      for (const relay of this.challenges) {
        const saved = data.challenges?.[relay.id];
        if (saved) relay.restore(saved);
      }
    } catch {
      /* ignore a damaged relay record */
    }
  }
}
