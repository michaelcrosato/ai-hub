/**
 * echoes.js — the Whisperglass network: six rigid signal sculptures spread
 * across the territory. Recording one resolves the bearing to the next, which
 * then appears on the atlas as a transit destination.
 */
import * as THREE from 'three/webgpu';
import { ECHOES, bearingTo, formatDistance, compassLabel } from './data.js';
import { StaticBatch, prim } from './primitives.js';

export class WhisperglassNetwork {
  constructor({ scene, terrain, player, interactions, materials, hud, soundscape, input, isKnown, recordGuide }) {
    this.terrain = terrain;
    this.player = player;
    this.interactions = interactions;
    this.materials = materials;
    this.hud = hud;
    this.soundscape = soundscape;
    this.input = input;
    this.isKnown = isKnown;
    this.recordGuide = recordGuide;
    this.root = new THREE.Group();
    this.root.name = 'Whisperglass Echo Network';
    scene.add(this.root);
    this.residents = [];
    this.disposers = [];
    this.transitIndex = -1;
    this.elapsed = 0;
    this.frozen = false;
    for (const echo of ECHOES) this.buildEcho(echo);
  }

  get recordedCount() {
    return ECHOES.filter((e) => this.isKnown(e.entryId)).length;
  }
  get motionFrozen() {
    return this.frozen;
  }

  toggleMotionFreeze() {
    this.frozen = !this.frozen;
    return this.frozen;
  }

  update(dt) {
    if (this.frozen) return;
    this.elapsed += Math.max(0, Math.min(dt, 0.1));
    for (const r of this.residents) {
      if (!r.root.visible) continue;
      const pulse = 1 + Math.sin(this.elapsed * 1.35 + r.definition.phase) * 0.08;
      r.ring.scale.set(3.1 * pulse, 0.08, 3.1 * pulse);
      r.ring.rotation.y = ((this.elapsed * 9 + r.definition.phase * 24) * Math.PI) / 180;
    }
  }

  transitToNext() {
    this.transitIndex = (this.transitIndex + 1) % ECHOES.length;
    const echo = ECHOES[this.transitIndex];
    this.player.teleport(echo.x, echo.z + 6);
    return echo;
  }

  destroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
    this.root.removeFromParent();
  }

  buildEcho(echo) {
    const ground = Math.max(this.terrain.heightAt(echo.x, echo.z), this.terrain.seaLevel + 0.12);
    const root = new THREE.Group();
    root.name = `WHISPERGLASS // ${echo.name}`;
    root.position.set(echo.x, ground, echo.z);
    this.root.add(root);
    const batch = new StaticBatch();
    batch.add('cylinder', this.materials.structure, [0, 0.45, 0], [2.6, 0.9, 2.6]);
    for (let i = 0; i < 3; i += 1) {
      const a = echo.phase + (i * Math.PI * 2) / 3;
      batch.add('box', this.materials.structureAccent, [Math.cos(a) * 2.4, 1.15 + i * 0.28, Math.sin(a) * 2.4], [0.32, 1.6, 0.72], [0, (-a * 180) / Math.PI, i % 2 ? -11 : 11]);
    }
    batch.build(root);
    const shard = prim(root, 'cone', this.materials.lichenGlow, [0, 3.05, 0], [1.1, 5.2, 1.1], { cast: false, receive: false, rotation: [0, echo.phase * 37, 180], name: 'Rigid signal shard' });
    const ring = prim(root, 'cylinder', this.materials.fieldOrange, [0, 2.15, 0], [3.1, 0.08, 3.1], { cast: false, receive: false, name: 'Weather-memory ring' });
    this.residents.push({ definition: echo, root, ring });
    this.disposers.push(
      this.interactions.register({
        id: echo.id,
        entity: shard,
        label: () => (this.isKnown(echo.entryId) ? `${echo.name} recorded` : `Record ${echo.name}`),
        holdSeconds: 1.15,
        range: 5.5,
        enabled: () => !this.isKnown(echo.entryId),
        interact: () => this.record(echo),
      }),
    );
  }

  record(echo) {
    if (!this.recordGuide(echo.entryId)) return;
    const count = this.recordedCount;
    const all = count === ECHOES.length;
    this.soundscape.ping(count + 4);
    this.input?.rumble(0.35, 140);
    if (all) {
      this.hud.showToast(
        'The atlas has a below',
        'All six Whisperglass bearings converge beneath the Stillpoint. The sealed hatch on its foundation will answer now.',
        'IMPOSSIBLE COORDINATE',
        6500,
      );
      return;
    }
    const index = ECHOES.indexOf(echo);
    const next = ECHOES[index + 1] && !this.isKnown(ECHOES[index + 1].entryId) ? ECHOES[index + 1] : ECHOES.find((e) => !this.isKnown(e.entryId));
    if (next) {
      const p = this.player.worldPosition;
      const bearing = bearingTo(p, next);
      this.hud.showToast(
        echo.name,
        `Recorded (${count} / ${ECHOES.length}). Bearing resolved: ${next.name}, ${compassLabel(bearing)} ${formatDistance(Math.hypot(next.x - p.x, next.z - p.z))}. Set it as a waypoint on the atlas and transit.`,
        'WHISPERGLASS RECORDED',
        6000,
      );
    }
  }
}
