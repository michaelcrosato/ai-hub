// Aim-to-interact: the crosshair ray finds a fixture to switch or a prop to carry.
// Carried props float in front of the camera, stop short of walls and drop onto
// whatever is below them.
import * as THREE from 'three/webgpu';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export class Interactions {
  constructor({ camera, player, lightControls, carryables, occluders, flashlight, onLightChanged, onCarryChanged }) {
    this.camera = camera;
    this.player = player;
    this.occluders = occluders;
    this.flashlight = flashlight;
    this.onLightChanged = onLightChanged;
    this.onCarryChanged = onCarryChanged;
    this.raycaster = new THREE.Raycaster();
    this.carryRaycaster = new THREE.Raycaster();
    this.screenCenter = new THREE.Vector2(0, 0);
    this.targetByRoot = new Map();
    this.spawnTransforms = new Map();
    this.roots = [];
    this.aimOrigin = new THREE.Vector3();
    this.aimDirection = new THREE.Vector3();
    this.desiredPosition = new THREE.Vector3();
    this.targetWorldPosition = new THREE.Vector3();
    this.dropOrigin = new THREE.Vector3();
    this.down = new THREE.Vector3(0, -1, 0);
    this.targetHits = [];
    this.carryHits = [];
    this.carryBounds = new Map();
    this.casterChanges = [];
    this.casterChangeCount = 0;
    this.activeTarget = null;
    this.held = null;
    this.transformDirty = false;
    this.hudVersion = 0;
    this.targetTimer = 0;

    for (const c of lightControls) this.register({ root: c.root, light: c });
    for (const c of carryables) this.register({ root: c.root, carryable: c, light: c.light });
    this.raycastRoots = [...this.roots, ...occluders];
    const box = new THREE.Box3();
    const size = new THREE.Vector3();
    for (const c of carryables) {
      this.spawnTransforms.set(c.root, { position: c.root.position.clone(), quaternion: c.root.quaternion.clone() });
      c.root.updateWorldMatrix(true, true);
      box.setFromObject(c.root);
      c.root.getWorldPosition(this.targetWorldPosition);
      const halfSize = box.getSize(size).clone().multiplyScalar(0.5);
      const centerOffset = box.getCenter(new THREE.Vector3()).sub(this.targetWorldPosition);
      this.carryBounds.set(c.root, { centerOffset, halfSize, radius: halfSize.length() });
    }
  }

  register(entry) {
    const existing = this.targetByRoot.get(entry.root);
    if (existing) {
      existing.light ??= entry.light;
      existing.carryable ??= entry.carryable;
      return;
    }
    this.targetByRoot.set(entry.root, { ...entry });
    this.roots.push(entry.root);
  }

  /** E / X / Switch: toggle the aimed (or carried) light. Returns the control that changed. */
  toggleLight() {
    const control = this.activeTarget?.light ?? this.held?.light;
    if (!control) return null;
    const on = !control.isEnabled();
    control.setEnabled(on);
    this.onLightChanged(control, on);
    this.hudVersion += 1;
    return control;
  }

  /** G / Y / Carry: pick up the aimed prop, or drop the carried one. */
  toggleCarry() {
    if (this.held) {
      const label = this.held.label;
      this.dropHeld();
      this.onCarryChanged?.(false, label);
      return true;
    }
    if (this.activeTarget?.carryable) {
      this.held = this.activeTarget.carryable;
      this.activeTarget = null;
      this.hudVersion += 1;
      this.onCarryChanged?.(true, this.held.label);
      return true;
    }
    return false;
  }

  toggleFlashlight() {
    const on = !this.flashlight.isEnabled();
    this.flashlight.setEnabled(on);
    this.onLightChanged(this.flashlight, on);
    this.hudVersion += 1;
  }

  /** Move the carried prop towards the aim point, short of any wall. */
  fixedUpdate(dt) {
    const dirty = this.transformDirty;
    this.transformDirty = false;
    if (!this.held) return dirty;
    const root = this.held.root;
    const x = root.position.x;
    const y = root.position.y;
    const z = root.position.z;
    this.player.getAimRay(this.aimOrigin, this.aimDirection);
    this.carryRaycaster.set(this.aimOrigin, this.aimDirection);
    this.carryRaycaster.near = 0;
    this.carryRaycaster.far = 2.7;
    this.carryHits.length = 0;
    const hit = this.carryRaycaster.intersectObjects(this.occluders, true, this.carryHits)[0];
    const bounds = this.carryBounds.get(root);
    const extent =
      Math.abs(this.aimDirection.x) * bounds.halfSize.x +
      Math.abs(this.aimDirection.y) * bounds.halfSize.y +
      Math.abs(this.aimDirection.z) * bounds.halfSize.z +
      bounds.centerOffset.dot(this.aimDirection) +
      0.06;
    const reach = hit ? Math.max(0, hit.distance - extent) : 2.7;
    this.desiredPosition.copy(this.aimDirection).multiplyScalar(reach).add(this.aimOrigin);
    this.desiredPosition.x = clamp(this.desiredPosition.x, -30.5, 30.5);
    this.desiredPosition.y = clamp(this.desiredPosition.y - this.held.dropY * 0.35, this.held.dropY + 0.1, 4.6);
    this.desiredPosition.z = clamp(this.desiredPosition.z, -30.5, 30.5);
    this.desiredPosition.lerpVectors(root.position, this.desiredPosition, 1 - Math.exp(-16 * dt));
    const moved = Math.abs(this.desiredPosition.x - x) > 1e-4 || Math.abs(this.desiredPosition.y - y) > 1e-4 || Math.abs(this.desiredPosition.z - z) > 1e-4;
    if (moved) {
      this.queueCasterChange(root);
      root.position.copy(this.desiredPosition);
      root.updateMatrixWorld(true);
      this.queueCasterChange(root);
    }
    return dirty || moved;
  }

  /** What the crosshair points at, within reach. `active` is false while the game is paused. */
  updateTarget(dt, active) {
    if (!active) {
      if (this.activeTarget) {
        this.activeTarget = null;
        this.hudVersion += 1;
      }
      return;
    }
    // 20 Hz is plenty for a prompt and saves raycasts through the whole house.
    this.targetTimer -= dt;
    if (this.targetTimer > 0) return;
    this.targetTimer = 0.05;
    this.raycaster.setFromCamera(this.screenCenter, this.camera);
    this.targetHits.length = 0;
    const hits = this.raycaster.intersectObjects(this.raycastRoots, true, this.targetHits);
    let root = null;
    let light = null;
    let carryable = null;
    for (const h of hits) {
      let o = h.object;
      while (o && !this.targetByRoot.has(o)) o = o.parent;
      if (!o) break; // the first thing hit is a wall or furniture: it hides everything behind
      const entry = this.targetByRoot.get(o);
      if (entry.root === this.held?.root) continue;
      entry.root.getWorldPosition(this.targetWorldPosition);
      const dist = this.targetWorldPosition.distanceTo(this.player.getPosition());
      if (entry.light && dist <= entry.light.maxDistance) light = entry.light;
      if (!this.held && entry.carryable && dist <= entry.carryable.pickupDistance) carryable = entry.carryable;
      if (light || carryable) root = entry.root;
      break;
    }
    if (light !== (this.activeTarget?.light ?? null) || carryable !== (this.activeTarget?.carryable ?? null)) {
      this.activeTarget = root ? { root, light, carryable } : null;
      this.hudVersion += 1;
    }
  }

  dropHeld() {
    if (!this.held) return;
    const root = this.held.root;
    this.queueCasterChange(root);
    const bounds = this.carryBounds.get(root);
    this.dropOrigin.copy(root.position);
    this.carryRaycaster.set(this.dropOrigin, this.down);
    this.carryRaycaster.near = 0;
    this.carryRaycaster.far = Number.POSITIVE_INFINITY;
    this.carryHits.length = 0;
    const floorY = this.carryRaycaster.intersectObjects(this.occluders, true, this.carryHits)[0]?.point.y ?? 0;
    root.position.y = floorY + bounds.halfSize.y - bounds.centerOffset.y;
    root.updateMatrixWorld(true);
    this.queueCasterChange(root);
    this.transformDirty = true;
    this.held = null;
    this.hudVersion += 1;
  }

  /** Put every carried prop back where it started. */
  reset() {
    this.held = null;
    this.activeTarget = null;
    for (const [root, t] of this.spawnTransforms) {
      if (root.position.equals(t.position) && root.quaternion.equals(t.quaternion)) continue;
      this.queueCasterChange(root);
      root.position.copy(t.position);
      root.quaternion.copy(t.quaternion);
      root.updateMatrixWorld(true);
      this.queueCasterChange(root);
      this.transformDirty = true;
    }
    this.hudVersion += 1;
  }

  queueCasterChange(root) {
    const bounds = this.carryBounds.get(root);
    let change = this.casterChanges[this.casterChangeCount];
    if (!change) {
      change = { position: new THREE.Vector3(), radius: bounds.radius };
      this.casterChanges.push(change);
    }
    root.getWorldPosition(change.position);
    change.position.add(bounds.centerOffset);
    change.radius = bounds.radius;
    this.casterChangeCount += 1;
  }

  consumeCasterChanges(fn) {
    for (let i = 0; i < this.casterChangeCount; i += 1) fn(this.casterChanges[i].position, this.casterChanges[i].radius);
    this.casterChangeCount = 0;
  }

  /** What the prompt should offer: { light, carry, drop, held }. */
  describe() {
    const held = this.held;
    return {
      light: held ? this.activeTarget?.light || held.light || null : this.activeTarget?.light || null,
      carry: held ? null : this.activeTarget?.carryable || null,
      held: held || null,
    };
  }
}
