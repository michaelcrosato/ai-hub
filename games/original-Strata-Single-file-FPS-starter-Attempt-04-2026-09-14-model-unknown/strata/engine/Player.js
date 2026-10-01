import * as THREE from 'three/webgpu';
import { Motor } from '../core/motor.js';
import { clamp, damp, vector } from '../core/math.js';
import { RAPIER } from './PhysicsWorld.js';

const _dir = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _offset = new THREE.Vector3();
const _velocity = new THREE.Vector3();
const STAND = 1.85, CROUCH = 1.15;

export class Player {
    physics;
    input;
    camera;
    motor;
    body;
    collider;
    controller;
    previous = new THREE.Vector3();
    current = new THREE.Vector3();
    yaw = 0;
    pitch = 0;
    held = null;
    checkpoint;
    checkpointYaw;
    /** onRespawn(reason): 'manual' (respawn key), 'fall', 'hazard', 'death' or 'checkpoint'. */
    onRespawn = null;
    heldGravity = 1;
    height = STAND;
    eye = 1.68;
    phase = 0;
    radius = .3;
    #ray = null;
    #standShape = null;
    #crouchShape = null;
    constructor(physics, input, camera, settings, spawn, yaw) {
        this.physics = physics;
        this.input = input;
        this.camera = camera;
        this.motor = new Motor({ ...settings });
        this.checkpoint = [...spawn];
        this.checkpointYaw = this.yaw = yaw;
        this.#standShape = new RAPIER.Capsule(STAND / 2 - this.radius, this.radius);
        this.#crouchShape = new RAPIER.Capsule(CROUCH / 2 - this.radius, this.radius);
        this.#ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 });
        this.body = physics.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(...spawn));
        this.collider = physics.world.createCollider(RAPIER.ColliderDesc.capsule(STAND / 2 - this.radius, this.radius).setTranslation(0, STAND / 2, 0).setFriction(0), this.body);
        this.controller = physics.world.createCharacterController(.025);
        this.controller.setMaxSlopeClimbAngle(settings.maxSlope * Math.PI / 180);
        this.controller.setMinSlopeSlideAngle((settings.maxSlope + 1) * Math.PI / 180);
        if (settings.stepHeight > 0)
            this.controller.enableAutostep(settings.stepHeight, .25, false);
        this.controller.enableSnapToGround(.25);
        this.controller.setApplyImpulsesToDynamicBodies(true);
        this.controller.setCharacterMass(75);
        this.previous.fromArray(spawn);
        this.current.fromArray(spawn);
        this.render(1, 0);
    }
    /**
     * Turn the view by this frame's look input (radians, from kit.input with the
     * player's sensitivity and invert-Y). The level's `sensitivity` scales it
     * relative to the starter's default of 0.002.
     */
    look(delta) {
        const scale = (this.motor.settings.sensitivity ?? .002) / .002;
        this.yaw -= delta.x * scale;
        this.pitch = clamp(this.pitch - delta.y * scale, -1.5, 1.5);
    }
    crouch(wants) {
        if (wants === this.motor.crouched)
            return;
        const p = this.body.translation();
        if (!wants) {
            const hit = this.physics.world.intersectionWithShape({ x: p.x, y: p.y + STAND / 2 + .04, z: p.z }, { x: 0, y: 0, z: 0, w: 1 }, this.#standShape, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, this.collider, this.body);
            if (hit)
                return;
        }
        this.motor.crouched = wants;
        this.height = wants ? CROUCH : STAND;
        this.collider.setShape(wants ? this.#crouchShape : this.#standShape);
        this.collider.setTranslationWrtParent({ x: 0, y: this.height / 2, z: 0 });
    }
    beforeStep(dt) {
        this.previous.copy(this.current);
        const move = this.input.movement();
        this.crouch(move.crouch);
        const displacement = this.motor.update(dt, move, this.yaw), p = this.body.translation();
        if (this.motor.grounded && this.motor.vy <= 0) {
            const ray = this.#ray;
            ray.origin.x = p.x; ray.origin.y = p.y + .1; ray.origin.z = p.z;
            ray.dir.x = 0; ray.dir.y = -1; ray.dir.z = 0;
            const support = this.physics.world.castRay(ray, .45, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, this.collider, this.body);
            const body = support?.collider.parent();
            const carry = body ? this.physics.deltas.get(body.handle) : undefined;
            if (carry) {
                displacement.x += carry.x;
                displacement.y += carry.y;
                displacement.z += carry.z;
            }
        }
        const heldHandle = this.held?.body.handle;
        this.controller.computeColliderMovement(this.collider, displacement, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, heldHandle === undefined ? undefined : c => c.parent()?.handle !== heldHandle);
        const corrected = this.controller.computedMovement();
        this.motor.grounded = this.controller.computedGrounded();
        if (this.motor.vy > 0 && corrected.y < displacement.y - .001)
            this.motor.vy = 0;
        if (this.motor.grounded && this.motor.vy < 0)
            this.motor.vy = 0;
        this.body.setNextKinematicTranslation({ x: p.x + corrected.x, y: p.y + corrected.y, z: p.z + corrected.z });
        this.updateHeld(dt);
        if (this.held && this.input.consume('throw')) {
            this.drop(true);
            // Keep holding the button after a throw and nothing fires until it is released.
            this.input.gateFire?.();
        }
        if (this.input.consume('respawn'))
            this.respawn('manual');
    }
    afterStep() {
        const p = this.body.translation();
        this.current.set(p.x, p.y, p.z);
        if (p.y < -10)
            this.respawn('fall');
    }
    render(alpha, dt) {
        const settings = this.motor.settings, speed = Math.hypot(this.motor.vx, this.motor.vz);
        this.eye = damp(this.eye, this.motor.crouched ? 1 : 1.68, 14, dt);
        this.phase += speed * dt * 1.7;
        const bob = this.motor.grounded ? Math.sin(this.phase * 2) * .035 * settings.headBob * Math.min(speed / 5, 1) : 0;
        this.camera.position.lerpVectors(this.previous, this.current, alpha);
        this.camera.position.y += this.eye + bob;
        this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
        const fov = damp(this.camera.fov, settings.fov + (this.input.down('sprint') && speed > 6 ? 5 : 0), 8, dt);
        if (Math.abs(fov - this.camera.fov) > 1e-4 || dt === 0) {
            this.camera.fov = fov;
            this.camera.updateProjectionMatrix();
        }
    }
    /**
     * The view ray from the eye. The same Ray object is reused on every call:
     * use it (castRay, pointAt) before asking for the next one.
     */
    ray() {
        _dir.set(0, 0, -1).applyEuler(_euler.set(this.pitch, this.yaw, 0, 'YXZ'));
        const p = this.body.translation(), ray = this.#ray;
        ray.origin.x = p.x; ray.origin.y = p.y + this.eye; ray.origin.z = p.z;
        ray.dir.x = _dir.x; ray.dir.y = _dir.y; ray.dir.z = _dir.z;
        return ray;
    }
    grab(entity) {
        if (!entity.body.isDynamic())
            return;
        this.drop();
        this.held = entity;
        this.heldGravity = entity.body.gravityScale();
        entity.body.setGravityScale(0, true);
    }
    drop(throwIt = false) {
        if (!this.held)
            return;
        const body = this.held.body;
        body.setGravityScale(this.heldGravity, true);
        if (throwIt) {
            const dir = this.ray().dir, m = body.mass() * 9;
            body.applyImpulse({ x: dir.x * m, y: dir.y * m, z: dir.z * m }, true);
        }
        this.held = null;
    }
    updateHeld(dt) {
        if (!this.held)
            return;
        const body = this.held.body, handle = body.handle, ray = this.ray();
        const wall = this.physics.world.castRay(ray, 2.5, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, this.collider, this.body, c => c.parent()?.handle !== handle);
        const distance = Math.max(.85, Math.min(2.3, (wall?.timeOfImpact ?? 3) - .7));
        const point = ray.pointAt(distance), p = body.worldCom(), v = body.linvel();
        _offset.set(point.x - p.x, point.y - p.y, point.z - p.z);
        if (_offset.length() > 4) {
            this.drop();
            return;
        }
        const impulse = _offset.multiplyScalar(55).sub(_velocity.set(v.x, v.y, v.z).multiplyScalar(12)).clampLength(0, 80).multiplyScalar(body.mass() * dt);
        body.applyImpulse({ x: impulse.x, y: impulse.y, z: impulse.z }, true);
        body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
    respawn(reason = 'manual') {
        this.drop();
        this.motor.reset();
        this.input.resetToggles?.();
        // Reset both policy and collision shape. A crouched death must not leave a short capsule.
        this.height = STAND;
        this.eye = 1.68;
        this.collider.setShape(this.#standShape);
        this.collider.setTranslationWrtParent({ x: 0, y: this.height / 2, z: 0 });
        this.body.setTranslation(vector(this.checkpoint), true);
        this.body.setNextKinematicTranslation(vector(this.checkpoint));
        this.previous.fromArray(this.checkpoint);
        this.current.fromArray(this.checkpoint);
        this.yaw = this.checkpointYaw;
        this.pitch = this.phase = 0;
        this.onRespawn?.(reason);
    }
    setCheckpoint(point) { this.checkpoint = [point[0], point[1] + .15, point[2]]; this.checkpointYaw = this.yaw; }
    dispose() { this.drop(); this.physics.world.removeCharacterController(this.controller); this.physics.world.removeRigidBody(this.body); }
}
