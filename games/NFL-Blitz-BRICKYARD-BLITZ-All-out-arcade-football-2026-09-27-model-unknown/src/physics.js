// Player and ball physics on Rapier 0.20 (loaded by the kit). Players are upright capsules
// driven by the simulation's velocities, so blockers and tacklers shove each other with real
// mass (heavier linemen win); the football is a dynamic ball that bounces on the turf.
// Catches, tackles and officiating stay with the simulation.
import { createWorld, physicsInfo } from 'kit/physics.js';

// Collision groups: membership in the high 16 bits, filter in the low 16.
const GROUND = 0x00040003; // ground: collides with players and the ball
const PLAYER = 0x00010005; // players: collide with players and the ground
const FOOTBALL = 0x00020004; // ball: collides with the ground only

export class RapierPhysics {
  constructor(RAPIER) {
    this.R = RAPIER;
    this.kind = `RAPIER ${physicsInfo.version}`;
    // Arcade gravity: the ball hangs and drops like a broadcast highlight (22 m/s²).
    this.world = createWorld(RAPIER, { gravity: -22, hz: 60 });
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(100, 0.2, 100).setTranslation(0, -0.2, 0).setFriction(0.7).setCollisionGroups(GROUND));
    this.bodies = new Map();
    this.football = null;
    this.lastMode = '';
    this.vel = { x: 0, y: 0, z: 0 };
    this.pos = { x: 0, y: 0, z: 0 };
  }

  /** A new formation: one capsule per player and a fresh ball. */
  reset(actors, ball) {
    const R = this.R;
    for (const body of this.bodies.values()) this.world.removeRigidBody(body);
    this.bodies.clear();
    if (this.football) this.world.removeRigidBody(this.football);
    for (const a of actors) {
      const body = this.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(a.x, 1.25, a.z).lockRotations().setLinearDamping(1).setCcdEnabled(true));
      this.world.createCollider(
        R.ColliderDesc.capsule(0.52, 0.72).setDensity(a.player.power / 40).setFriction(0).setRestitution(0).setCollisionGroups(PLAYER),
        body
      );
      this.bodies.set(a.id, body);
    }
    this.football = this.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(ball.x, ball.y, ball.z).setCcdEnabled(true));
    this.world.createCollider(R.ColliderDesc.ball(0.3).setRestitution(0.38).setFriction(0.45).setCollisionGroups(FOOTBALL), this.football);
    this.lastMode = '';
  }

  step(actors, ball, dt) {
    const R = this.R;
    this.world.timestep = dt;
    const v = this.vel;
    for (const a of actors) {
      const body = this.bodies.get(a.id);
      if (!body) continue;
      // Downed players leave the pile (no collisions) and slide on their own.
      if (a.fallen <= 0 && !body.isEnabled()) {
        this.pos.x = a.x;
        this.pos.y = 1.25;
        this.pos.z = a.z;
        body.setTranslation(this.pos, true);
      }
      body.setEnabled(a.fallen <= 0);
      if (a.fallen > 0) {
        a.x += a.vx * dt;
        a.z += a.vz * dt;
        continue;
      }
      v.x = a.vx;
      v.y = 0;
      v.z = a.vz;
      body.setLinvel(v, true);
    }
    const b = this.football;
    if (b) {
      if (this.lastMode !== ball.mode) {
        b.setBodyType(ball.mode === 'held' ? R.RigidBodyType.KinematicPositionBased : R.RigidBodyType.Dynamic, true);
        this.lastMode = ball.mode;
      }
      this.pos.x = ball.x;
      this.pos.y = ball.y;
      this.pos.z = ball.z;
      if (ball.mode === 'held') b.setNextKinematicTranslation(this.pos);
      else {
        b.setTranslation(this.pos, true);
        v.x = ball.vx;
        v.y = ball.vy;
        v.z = ball.vz;
        b.setLinvel(v, true);
      }
    }
    this.world.step();
    for (const a of actors) {
      const body = this.bodies.get(a.id);
      if (!body || a.fallen > 0) continue;
      const p = body.translation();
      a.x = p.x;
      a.z = p.z;
    }
    if (b && ball.mode !== 'held') {
      const p = b.translation();
      const lv = b.linvel();
      ball.x = p.x;
      ball.y = p.y;
      ball.z = p.z;
      ball.vx = lv.x;
      ball.vy = lv.y;
      ball.vz = lv.z;
    }
  }

  dispose() {
    this.world.free();
  }
}
