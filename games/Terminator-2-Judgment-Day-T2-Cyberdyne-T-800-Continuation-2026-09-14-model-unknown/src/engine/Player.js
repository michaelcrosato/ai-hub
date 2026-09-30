import * as THREE from 'three/webgpu';
import { Motor } from '../core/motor.js';
import { clamp, damp, vector } from '../core/math.js';
import { RAPIER } from './PhysicsWorld.js';
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
    onRespawn = null;
    heldGravity = 1;
    height = 1.85;
    eye = 1.68;
    phase = 0;
    radius = .3;
    /** Look-rate multiplier: optical zoom and gamepad/touch aim slowdown lower it. */
    lookScale = 1;
    /** Visual camera jolt (recoil, hits, explosions); never moves the aim ray. Decays by itself. */
    shake = 0;
    sprinting = false;
    constructor(physics, input, camera, settings, spawn, yaw) {
        this.physics = physics;
        this.input = input;
        this.camera = camera;
        this.motor = new Motor({ ...settings });
        this.checkpoint = [...spawn];
        this.checkpointYaw = this.yaw = yaw;
        this.body = physics.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(...spawn));
        this.collider = physics.world.createCollider(RAPIER.ColliderDesc.capsule(this.height / 2 - this.radius, this.radius).setTranslation(0, this.height / 2, 0).setFriction(0), this.body);
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
    /** Radians from kit.input (mouse, right stick, touch drag), with the kit's sensitivity and invert-Y applied. */
    look() {
        const l = this.input.look(), s = this.lookScale;
        this.yaw -= l.x * s;
        this.pitch = clamp(this.pitch - l.y * s, -1.5, 1.5);
    }
    crouch(wants) {
        if (wants === this.motor.crouched)
            return;
        const p = this.body.translation();
        if (!wants) {
            const hit = this.physics.world.intersectionWithShape({ x: p.x, y: p.y + 1.85 / 2 + .04, z: p.z }, { x: 0, y: 0, z: 0, w: 1 }, new RAPIER.Capsule(1.85 / 2 - this.radius, this.radius), RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, this.collider, this.body);
            if (hit)
                return;
        }
        this.motor.crouched = wants;
        this.height = wants ? 1.15 : 1.85;
        this.collider.setShape(new RAPIER.Capsule(this.height / 2 - this.radius, this.radius));
        this.collider.setTranslationWrtParent({ x: 0, y: this.height / 2, z: 0 });
    }
    beforeStep(dt) {
        this.previous.copy(this.current);
        const move = this.input.movement();
        this.crouch(move.crouch);
        this.sprinting = move.sprint && !this.motor.crouched;
        const displacement = this.motor.update(dt, move, this.yaw), p = this.body.translation();
        if (this.motor.grounded && this.motor.vy <= 0) {
            const ray = new RAPIER.Ray({ x: p.x, y: p.y + .1, z: p.z }, { x: 0, y: -1, z: 0 });
            const support = this.physics.world.castRay(ray, .45, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, this.collider, this.body);
            const body = support?.collider.parent();
            const carry = body ? this.physics.deltas.get(body.handle) : undefined;
            if (carry) {
                displacement.x += carry.x;
                displacement.y += carry.y;
                displacement.z += carry.z;
            }
        }
        this.controller.computeColliderMovement(this.collider, displacement, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, c => c.parent()?.handle !== this.held?.body.handle);
        const corrected = this.controller.computedMovement();
        this.motor.grounded = this.controller.computedGrounded();
        if (this.motor.vy > 0 && corrected.y < displacement.y - .001)
            this.motor.vy = 0;
        if (this.motor.grounded && this.motor.vy < 0)
            this.motor.vy = 0;
        this.body.setNextKinematicTranslation({ x: p.x + corrected.x, y: p.y + corrected.y, z: p.z + corrected.z });
        this.updateHeld(dt);
        if (this.held && this.input.consume('throw'))
            this.drop(true);
    }
    afterStep() {
        const p = this.body.translation();
        this.current.set(p.x, p.y, p.z);
        if (p.y < -10)
            this.respawn();
    }
    render(alpha, dt) {
        const settings = this.motor.settings, speed = Math.hypot(this.motor.vx, this.motor.vz);
        this.eye = damp(this.eye, this.motor.crouched ? 1 : 1.68, 14, dt);
        this.phase += speed * dt * 1.7;
        const bob = this.motor.grounded ? Math.sin(this.phase * 2) * .035 * settings.headBob * Math.min(speed / 5, 1) : 0;
        this.camera.position.lerpVectors(this.previous, this.current, alpha);
        this.camera.position.y += this.eye + bob;
        // Shake only while time runs, so a paused scene does not jitter.
        const jolt = dt > 0 ? this.shake * .02 : 0;
        this.shake = Math.max(0, this.shake - dt * 3);
        this.camera.rotation.set(this.pitch + (Math.random() - .5) * jolt, this.yaw + (Math.random() - .5) * jolt, 0, 'YXZ');
        // The sprint widening used to need 6 m/s, faster than the 5.8 m/s sprint, so it never showed.
        this.camera.fov = damp(this.camera.fov, settings.fov + (this.sprinting && speed > settings.walkSpeed + .4 ? 4 : 0), 8, dt);
        this.camera.updateProjectionMatrix();
    }
    ray() { const dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ')); const p = this.body.translation(); return new RAPIER.Ray({ x: p.x, y: p.y + this.eye, z: p.z }, dir); }
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
            const dir = this.ray().dir;
            body.applyImpulse({ x: dir.x * body.mass() * 9, y: dir.y * body.mass() * 9, z: dir.z * body.mass() * 9 }, true);
        }
        this.held = null;
    }
    updateHeld(dt) {
        if (!this.held)
            return;
        const body = this.held.body, ray = this.ray();
        const wall = this.physics.world.castRay(ray, 2.5, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, this.collider, this.body, c => c.parent()?.handle !== body.handle);
        const distance = Math.max(.85, Math.min(2.3, (wall?.timeOfImpact ?? 3) - .7));
        const point = ray.pointAt(distance), p = body.worldCom(), v = body.linvel();
        const offset = new THREE.Vector3(point.x - p.x, point.y - p.y, point.z - p.z);
        if (offset.length() > 4) {
            this.drop();
            return;
        }
        const impulse = offset.multiplyScalar(55).sub(new THREE.Vector3(v.x, v.y, v.z).multiplyScalar(12)).clampLength(0, 80).multiplyScalar(body.mass() * dt);
        body.applyImpulse(impulse, true);
        body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
    respawn() {
        this.drop();
        this.motor.reset();
        // Reset both policy and collision shape. A crouched death must not leave a short capsule.
        this.height = 1.85;
        this.eye = 1.68;
        this.collider.setShape(new RAPIER.Capsule(this.height / 2 - this.radius, this.radius));
        this.collider.setTranslationWrtParent({ x: 0, y: this.height / 2, z: 0 });
        this.body.setTranslation(vector(this.checkpoint), true);
        this.body.setNextKinematicTranslation(vector(this.checkpoint));
        this.previous.fromArray(this.checkpoint);
        this.current.fromArray(this.checkpoint);
        this.yaw = this.checkpointYaw;
        this.pitch = this.phase = 0;
        this.onRespawn?.();
    }
    setCheckpoint(point) { this.checkpoint = [point[0], point[1] + .15, point[2]]; this.checkpointYaw = this.yaw; }
    dispose() { this.drop(); this.physics.world.removeCharacterController(this.controller); this.physics.world.removeRigidBody(this.body); }
}
