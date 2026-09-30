/**
 * interaction.js — look-at-and-hold interactions. The best target is the one
 * nearest the centre of view within its range; short actions fire on a press,
 * longer ones fill a hold bar.
 */
import * as THREE from 'three/webgpu';
import { PLAYER } from './data.js';

const _eye = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _target = new THREE.Vector3();

export class Interactions {
  constructor(camera, input, hud) {
    this.camera = camera;
    this.input = input;
    this.hud = hud;
    this.targets = new Map();
    this.selectedId = null;
    this.holdProgress = 0;
    this.onInteract = null; // (target) => void, for feedback (rumble, sound)
    this.onCandidate = null; // (hasCandidate) => void, e.g. to show the touch Use button
    this.hadCandidate = false;
  }

  /** target: { id, entity: Object3D, label: string|() => string, holdSeconds?, range?, enabled?: () => bool, interact: () => void } */
  register(target) {
    if (this.targets.has(target.id)) throw new Error(`Interaction target "${target.id}" already exists.`);
    this.targets.set(target.id, target);
    return () => this.targets.delete(target.id);
  }

  clearPrompt() {
    this.selectedId = null;
    this.holdProgress = 0;
    this.hud.setInteraction(null);
    this.setCandidate(false);
  }

  setCandidate(has) {
    if (has === this.hadCandidate) return;
    this.hadCandidate = has;
    this.onCandidate?.(has);
  }

  update(dt) {
    const found = this.findCandidate();
    const id = found?.target.id ?? null;
    if (id !== this.selectedId) {
      this.selectedId = id;
      this.holdProgress = 0;
    }
    this.setCandidate(!!found);
    if (!found) {
      this.hud.setInteraction(null);
      return;
    }
    const target = found.target;
    const hold = Math.max(0, target.holdSeconds ?? 0);
    const label = typeof target.label === 'function' ? target.label() : target.label;
    if (hold <= 0.2) {
      this.hud.setInteraction(label, 0);
      if (this.input.pressed('interact')) this.fire(target);
      return;
    }
    if (this.input.down('interact')) {
      this.holdProgress += dt / hold;
      if (this.holdProgress >= 1) {
        this.holdProgress = 0;
        this.fire(target);
      }
    } else {
      this.holdProgress = Math.max(0, this.holdProgress - dt * 2.4);
    }
    this.hud.setInteraction(label, this.holdProgress);
  }

  fire(target) {
    target.interact();
    this.onInteract?.(target);
  }

  destroy() {
    this.targets.clear();
    this.hud.setInteraction(null);
  }

  findCandidate() {
    this.camera.getWorldPosition(_eye);
    this.camera.getWorldDirection(_forward);
    // Aiming with a stick or a thumb is coarser than a mouse: allow a slightly wider cone.
    const cone = this.input.source === 'keyboard' ? 0.965 : 0.955;
    let best = null;
    let bestScore = -Infinity;
    for (const target of this.targets.values()) {
      if (target.enabled?.() === false) continue;
      const entity = target.entity;
      if (!entity.parent) continue;
      entity.updateWorldMatrix(true, false);
      _target.setFromMatrixPosition(entity.matrixWorld).sub(_eye);
      const distance = _target.length();
      if (distance > (target.range ?? PLAYER.interactionRange) || distance < 0.01) continue;
      const facing = _target.multiplyScalar(1 / distance).dot(_forward);
      if (facing < cone) continue;
      const score = facing - distance * 0.012;
      if (score > bestScore) {
        best = { target, score };
        bestScore = score;
      }
    }
    return best;
  }
}
