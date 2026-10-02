import * as THREE from 'three/webgpu';
import { radians, vector } from '../core/math.js';

/**
 * Rapier 0.20 from the shared kit (boot({ physics: true }) → kit.RAPIER). A live binding:
 * PhysicsWorld.init() sets it before any world, player or behavior touches it.
 */
export let RAPIER = null;
const _euler = new THREE.Euler();

export class PhysicsWorld {
    static init(rapier) {
        RAPIER ??= rapier;
        if (!RAPIER)
            throw new Error('The physics engine did not load.');
    }
    world;
    entities = new Map();
    owners = new Map();
    deltas = new Map();
    #dynamic = null;
    constructor() {
        if (!RAPIER)
            throw new Error('Physics is not ready. Call PhysicsWorld.init() first.');
        // The workbench keeps its own gravity (24 m/s²) for crates; the player's comes from the level.
        this.world = new RAPIER.World({ x: 0, y: -24, z: 0 });
        this.world.timestep = 1 / 60;
        this.world.numSolverIterations = 6;
    }
    create(data, blueprint, root, playing) {
        const desc = blueprint.body === 'dynamic' && playing ? RAPIER.RigidBodyDesc.dynamic() : blueprint.body === 'kinematic' && playing ? RAPIER.RigidBodyDesc.kinematicPositionBased() : RAPIER.RigidBodyDesc.fixed();
        const rotation = new THREE.Quaternion().setFromEuler(_euler.set(...data.rotation.map(radians)));
        desc.setTranslation(...data.position).setRotation(rotation);
        if (blueprint.body === 'dynamic') {
            desc.setCcdEnabled(true).setLinearDamping(.25).setAngularDamping(.8);
        }
        const body = this.world.createRigidBody(desc), colliders = [];
        for (const c of blueprint.colliders) {
            const size = c.size.map((v, i) => v * data.scale[i] / 2);
            const offset = c.position.map((v, i) => v * data.scale[i]);
            const radius = Math.max(size[0], size[2]);
            const cd = c.shape === 'ball' ? RAPIER.ColliderDesc.ball(radius) : c.shape === 'capsule' ? RAPIER.ColliderDesc.capsule(Math.max(0, size[1] - radius), radius) : c.shape === 'cylinder' ? RAPIER.ColliderDesc.cylinder(size[1], radius) : RAPIER.ColliderDesc.cuboid(...size);
            cd.setTranslation(...offset).setFriction(c.friction ?? .75).setRestitution(c.restitution ?? .03).setDensity(c.density ?? 2);
            if (c.groups !== undefined)
                cd.setCollisionGroups(c.groups);
            if (c.sensor)
                cd.setSensor(true).setActiveCollisionTypes(RAPIER.ActiveCollisionTypes.ALL);
            const collider = this.world.createCollider(cd, body);
            colliders.push(collider);
            this.owners.set(collider.handle, data.id);
        }
        const position = new THREE.Vector3(...data.position);
        const entity = { data, root, body, colliders, previous: position.clone(), current: position.clone(), previousRotation: rotation.clone(), currentRotation: rotation.clone(), delta: new THREE.Vector3(), moving: !body.isFixed(), teleport: false };
        this.entities.set(data.id, entity);
        this.#dynamic = null;
        return entity;
    }
    /**
     * A fixed body that a behavior moves by hand (a platform placed every step). Rapier 0.20's
     * character controller sticks to kinematic ground (no walking on an idle platform, a
     * fraction of the speed on a moving one); on a fixed body it walks and rides normally.
     */
    placeByHand(entity) {
        entity.body.setBodyType(RAPIER.RigidBodyType.Fixed, true);
        entity.teleport = true;
        entity.moving = true;
    }
    /** Colliders of every dynamic body (crates), for pressure plates. */
    get dynamicColliders() {
        if (!this.#dynamic) {
            this.#dynamic = [];
            for (const e of this.entities.values())
                if (e.body.isDynamic())
                    this.#dynamic.push(...e.colliders);
        }
        return this.#dynamic;
    }
    beginStep() {
        this.deltas.clear();
        for (const e of this.entities.values()) {
            if (!e.moving)
                continue;
            e.previous.copy(e.current);
            e.previousRotation.copy(e.currentRotation);
        }
    }
    /** Move a door or platform to `position` this step and record how far it went (for riders). `position` is read at once. */
    move(entity, position) {
        const p = entity.body.translation();
        entity.delta.set(position.x - p.x, position.y - p.y, position.z - p.z);
        this.deltas.set(entity.body.handle, entity.delta);
        // Rapier copies x, y, z out of the vector straight away, so a reused Vector3 is fine.
        if (entity.teleport)
            entity.body.setTranslation(position, true);
        else
            entity.body.setNextKinematicTranslation(position);
    }
    step(dt) {
        this.world.timestep = dt;
        this.world.step();
        for (const e of this.entities.values()) {
            if (!e.moving)
                continue;
            const p = e.body.translation(), q = e.body.rotation();
            e.current.set(p.x, p.y, p.z);
            e.currentRotation.set(q.x, q.y, q.z, q.w);
            if (e.body.isDynamic() && p.y < -15) {
                e.body.setTranslation(vector(e.data.position), true);
                e.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
                e.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
                e.current.fromArray(e.data.position);
                e.previous.copy(e.current);
            }
        }
    }
    /** Fixed bodies never move: their roots keep the pose they were built with. */
    interpolate(alpha) {
        for (const e of this.entities.values()) {
            if (!e.moving)
                continue;
            e.root.position.lerpVectors(e.previous, e.current, alpha);
            e.root.quaternion.slerpQuaternions(e.previousRotation, e.currentRotation, alpha);
        }
    }
    dispose() { this.entities.clear(); this.owners.clear(); this.deltas.clear(); this.#dynamic = null; this.world.free(); }
}
