import { createWorld } from 'kit/physics.js';
import { RINK } from './math.js';

/**
 * Rapier 0.20 (loaded by kit/boot.js) owns free-puck dynamics: CCD, ice friction,
 * the rounded boards and the goal frames. Skaters use arcade kinematic motors in
 * Game, and possession is an explicit constraint, so the puck is the only body.
 * Gravity stays at the arcade -12 the puck was tuned for.
 */
export class RapierPhysics {
    name = 'Rapier 0.20';
    constructor(RAPIER) {
        this.RAPIER = RAPIER;
        this.world = createWorld(RAPIER, { gravity: -12, hz: 60 });
        const world = this.world;
        const fixed = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
        world.createCollider(RAPIER.ColliderDesc.cuboid(34, .2, 16).setTranslation(0, -.23, 0).setFriction(.035).setRestitution(.3), fixed);
        const points = [], r = RINK.corner, ax = RINK.halfLength - r, az = RINK.halfWidth - r;
        for (let corner = 0; corner < 4; corner++) {
            const cx = corner === 0 || corner === 3 ? ax : -ax, cz = corner < 2 ? az : -az;
            for (let i = 0; i <= 14; i++) {
                const t = corner * Math.PI / 2 + i / 14 * Math.PI / 2;
                points.push({ x: cx + Math.cos(t) * r, z: cz + Math.sin(t) * r });
            }
        }
        for (let i = 0; i < points.length; i++) {
            const a = points[i], b = points[(i + 1) % points.length], angle = -Math.atan2(b.z - a.z, b.x - a.x);
            const collider = RAPIER.ColliderDesc.cuboid(Math.hypot(b.x - a.x, b.z - a.z) / 2 + .05, 1.9, .16)
                .setTranslation((a.x + b.x) / 2, 1.9, (a.z + b.z) / 2)
                .setRotation({ x: 0, y: Math.sin(angle / 2), z: 0, w: Math.cos(angle / 2) })
                .setRestitution(.83).setFriction(.01);
            world.createCollider(collider, fixed);
        }
        for (const dir of [-1, 1]) {
            const x = dir * RINK.goal;
            for (const z of [-RINK.goalHalf, RINK.goalHalf]) {
                world.createCollider(RAPIER.ColliderDesc.cylinder(.64, .075).setTranslation(x, .64, z).setRestitution(.8), fixed);
                world.createCollider(RAPIER.ColliderDesc.cuboid(.62, .6, .04).setTranslation(x + dir * .65, .6, z).setRestitution(.2), fixed);
            }
            world.createCollider(RAPIER.ColliderDesc.cuboid(.04, .62, RINK.goalHalf).setTranslation(x + dir * 1.3, .62, 0).setRestitution(.2), fixed);
            world.createCollider(RAPIER.ColliderDesc.cuboid(.06, .06, RINK.goalHalf).setTranslation(x, 1.28, 0).setRestitution(.8), fixed);
        }
        this.body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, .15, 0).setCcdEnabled(true).setLinearDamping(.21).setAngularDamping(1).lockRotations());
        this.collider = world.createCollider(RAPIER.ColliderDesc.cylinder(.075, .17).setMass(.17).setRestitution(.62).setFriction(.025), this.body);
    }
    /** Advance the free puck by dt; a held puck only follows the carrier. Writes back into state in place. */
    step(dt, state, held) {
        this.body.setTranslation(state.position, true);
        this.body.setLinvel(state.velocity, true);
        if (held)
            return;
        this.world.timestep = dt;
        this.world.step();
        const p = this.body.translation(), v = this.body.linvel();
        const pos = state.position, vel = state.velocity;
        pos.x = p.x;
        pos.y = Math.max(.075, p.y);
        pos.z = p.z;
        vel.x = v.x;
        vel.y = v.y;
        vel.z = v.z;
    }
    dispose() { this.world.free(); }
}
