import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { radians, vector } from '../core/math.js';
export { RAPIER };
export class PhysicsWorld {
    static ready;
    static async init() { await (this.ready ??= RAPIER.init()); }
    world;
    entities = new Map();
    owners = new Map();
    deltas = new Map();
    constructor(gravity = { x: 0, y: -24, z: 0 }) {
        if (![gravity.x, gravity.y, gravity.z].every(Number.isFinite))
            throw new Error('Invalid gravity.');
        this.world = new RAPIER.World(gravity);
        this.world.timestep = 1 / 60;
        this.world.numSolverIterations = 6;
    }
    create(data, blueprint, root, playing) {
        const desc = blueprint.body === 'dynamic' && playing ? RAPIER.RigidBodyDesc.dynamic() : blueprint.body === 'kinematic' && playing ? RAPIER.RigidBodyDesc.kinematicPositionBased() : RAPIER.RigidBodyDesc.fixed();
        const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(...data.rotation.map(radians)));
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
        const entity = { data, root, body, colliders, previous: position.clone(), current: position.clone(), previousRotation: rotation.clone(), currentRotation: rotation.clone() };
        this.entities.set(data.id, entity);
        return entity;
    }
    beginStep() {
        this.deltas.clear();
        for (const e of this.entities.values()) {
            e.previous.copy(e.current);
            e.previousRotation.copy(e.currentRotation);
        }
    }
    move(entity, position) {
        const p = entity.body.translation();
        this.deltas.set(entity.body.handle, position.clone().sub(new THREE.Vector3(p.x, p.y, p.z)));
        entity.body.setNextKinematicTranslation(position);
    }
    step(dt) {
        this.world.timestep = dt;
        this.world.step();
        for (const e of this.entities.values()) {
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
    interpolate(alpha) {
        for (const e of this.entities.values()) {
            e.root.position.lerpVectors(e.previous, e.current, alpha);
            e.root.quaternion.slerpQuaternions(e.previousRotation, e.currentRotation, alpha);
        }
    }
    dispose() { this.entities.clear(); this.owners.clear(); this.deltas.clear(); this.world.free(); }
}
