import * as THREE from "three/webgpu";
import { createWorld } from "kit/physics.js";
import { FIELD, PHYS } from "./config.js";

/** Rapier 0.20 namespace, handed over by main.js from kit.RAPIER before anything is built. */
export let RAPIER = null;
export function setRapier(r) {
  RAPIER = r;
}

export const groups = (e, t) => ((e & 65535) << 16) | (t & 65535);
export const GROUP_PLAYER = [groups(32, 353), groups(64, 225)];
export const GROUP_CARRIER = [groups(128, 65), groups(256, 33)];
export const GROUP_DOWN = groups(16, 1);
export const GROUP_BALL = groups(4, 9);
export const Physics = class {
  world;
  events;
  postHandles = new Set();
  groundHandles = new Set();
  onBallContact = null;
  ballHandle = -1;
  constructor() {
    // Arcade gravity in yards/s² (the field is laid out in yards), stepped at 60 Hz like the original.
    this.world = createWorld(RAPIER, { gravity: -PHYS.GRAVITY, hz: Math.round(1 / PHYS.DT) });
    this.events = new RAPIER.EventQueue(true);
    let n = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed()),
      r = (e, t, r) => {
        let i = this.world.createCollider(e.setCollisionGroups(t), n);
        return (r?.add(i.handle), i);
      },
      i = groups(1, 502);
    r(
      RAPIER.ColliderDesc.cuboid(120, 1, 120).setTranslation(0, -1, 0).setFriction(0.9).setRestitution(0.5),
      i,
      this.groundHandles,
    );
    r(RAPIER.ColliderDesc.cuboid(1, 4, 90).setTranslation(38.5, 4, 0), i);
    r(RAPIER.ColliderDesc.cuboid(1, 4, 90).setTranslation(-38.5, 4, 0), i);
    r(RAPIER.ColliderDesc.cuboid(60, 4, 1).setTranslation(0, 4, 71.5), i);
    r(RAPIER.ColliderDesc.cuboid(60, 4, 1).setTranslation(0, 4, -71.5), i);
    let a = groups(8, 4);
    for (let t of [-1, 1]) {
      let n = t * FIELD.END,
        i = (FIELD.UPRIGHT_TOP - FIELD.CROSSBAR) / 2;
      for (let t of [-FIELD.POST_HALF, FIELD.POST_HALF])
        r(
          RAPIER.ColliderDesc.cuboid(0.11, i, 0.11)
            .setTranslation(t, FIELD.CROSSBAR + i, n)
            .setRestitution(0.6),
          a,
          this.postHandles,
        );
      r(
        RAPIER.ColliderDesc.cuboid(FIELD.POST_HALF, 0.15, 0.15)
          .setTranslation(0, FIELD.CROSSBAR, n)
          .setRestitution(0.6),
        a,
        this.postHandles,
      );
      r(
        RAPIER.ColliderDesc.cuboid(0.25, 1.55, 0.25)
          .setTranslation(0, 1.55, n + t * 1.4)
          .setRestitution(0.4),
        a,
        this.postHandles,
      );
    }
  }
  step() {
    this.world.step(this.events);
    this.events.drainCollisionEvents((e, t, n) => {
      if (!n) return;
      let r = e === this.ballHandle ? t : t === this.ballHandle ? e : -1;
      r < 0 ||
        (this.postHandles.has(r)
          ? this.onBallContact?.(`post`)
          : this.groundHandles.has(r) && this.onBallContact?.(`ground`));
    });
  }
};
export const _ballTmp = new THREE.Vector3();
const _trailDir = new THREE.Vector3();
export const Ball = class {
  mesh = new THREE.Group();
  body;
  collider;
  state = `dead`;
  holder = null;
  kind = `pass`;
  thrower = null;
  target = null;
  landing = new THREE.Vector3();
  flightT = 0;
  flightDur = 1;
  pos = new THREE.Vector3();
  prev = new THREE.Vector3();
  vel = new THREE.Vector3();
  throwId = 0;
  bounces = 0;
  spin = 0;
  trail;
  constructor(e, t) {
    let n = new THREE.SphereGeometry(0.17, 8, 5);
    n.scale(1, 1, 1.75);
    let r = new THREE.MeshStandardMaterial({ color: `#8b4a1f`, roughness: 0.55, flatShading: true }),
      i = new THREE.MeshStandardMaterial({ color: `#ffffff`, roughness: 0.5 }),
      a = new THREE.Mesh(n, r);
    a.castShadow = true;
    this.mesh.add(a);
    let o = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.2), i);
    o.position.y = 0.165;
    this.mesh.add(o);
    for (let e of [-0.2, 0.2]) {
      let t = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.03), i);
      t.position.z = e;
      t.scale.set(0.9, 0.9, 1);
      this.mesh.add(t);
    }
    t.add(this.mesh);
    this.trail = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, 1),
      new THREE.MeshBasicMaterial({ color: `#fff7b0`, transparent: true, opacity: 0.5, depthWrite: false }),
    );
    this.trail.visible = false;
    t.add(this.trail);
    this.body = e.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(0, -10, 0)
        .setCcdEnabled(true)
        .setLinearDamping(0)
        .setAngularDamping(0.5),
    );
    this.collider = e.world.createCollider(
      RAPIER.ColliderDesc.ball(0.17)
        .setRestitution(0.55)
        .setFriction(0.7)
        .setDensity(0.4)
        .setCollisionGroups(GROUP_BALL)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      this.body,
    );
    e.ballHandle = this.collider.handle;
    this.body.setEnabled(false);
  }
  give(e) {
    this.holder && ((this.holder.hasBall = false), this.holder.refreshGroups());
    this.holder = e;
    e && ((e.hasBall = true), e.refreshGroups(), (this.state = `held`), this.body.setEnabled(false));
  }
  placeAt(e, t, n) {
    this.give(null);
    this.state = `placed`;
    this.body.setEnabled(false);
    this.pos.set(e, t, n);
    this.prev.copy(this.pos);
    this.vel.set(0, 0, 0);
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.set(0, 0, 0);
  }
  launch(e, t, n, r, i, a = 1) {
    this.give(null);
    this.state = n === `fumble` || n === `tip` || n === `onside` ? `loose` : `air`;
    this.kind = n;
    this.thrower = r;
    this.target = i;
    this.flightT = 0;
    this.flightDur = a;
    this.bounces = 0;
    this.throwId++;
    this.body.setEnabled(true);
    this.body.setTranslation({ x: e.x, y: e.y, z: e.z }, true);
    this.body.setLinvel({ x: t.x, y: t.y, z: t.z }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.pos.copy(e);
    this.prev.copy(e);
    this.vel.copy(t);
    this.spin = 0;
  }
  setLoose() {
    this.state = `loose`;
  }
  kill() {
    if (this.state === `air` || this.state === `loose`) {
      let e = this.body.translation();
      this.pos.set(e.x, e.y, e.z);
    }
    this.give(null);
    this.state = `dead`;
    this.body.setEnabled(false);
  }
  sync() {
    if (this.state === `air` || this.state === `loose`) {
      this.prev.copy(this.pos);
      let e = this.body.translation(),
        n = this.body.linvel();
      this.pos.set(e.x, e.y, e.z);
      this.vel.set(n.x, n.y, n.z);
      this.flightT += PHYS.DT;
    } else
      this.state === `held` &&
        this.holder &&
        (this.prev.copy(this.pos),
        this.holder.model.ballAnchor.getWorldPosition(_ballTmp),
        this.pos.copy(_ballTmp));
  }
  render(e) {
    if ((this.mesh.position.copy(this.pos), this.state === `held` && this.holder)) {
      this.holder.model.ballAnchor.getWorldPosition(this.mesh.position);
      this.mesh.rotation.set(0.5, this.holder.yaw, 0);
      this.trail.visible = false;
      return;
    }
    if (this.state === `air`) {
      let t = Math.hypot(this.vel.x, this.vel.z),
        n = Math.atan2(this.vel.x, this.vel.z),
        r = -Math.atan2(this.vel.y, t);
      if (
        ((this.spin += e * (this.kind === `pass` ? 30 : 12)),
        this.kind === `kick` || this.kind === `punt` || this.kind === `fg`
          ? this.mesh.rotation.set(this.spin, n, 0, `YXZ`)
          : this.mesh.rotation.set(r, n, this.spin, `YXZ`),
        t > 8)
      ) {
        this.trail.visible = true;
        let e = Math.min(3.5, t * 0.12);
        this.trail.scale.set(1, 1, e);
        this.trail.position.copy(this.pos).addScaledVector(_trailDir.copy(this.vel).normalize(), -e / 2);
        this.trail.rotation.set(r, n, 0, `YXZ`);
      } else this.trail.visible = false;
    } else if (((this.trail.visible = false), this.state === `loose`)) {
      let e = this.body.rotation();
      this.mesh.quaternion.set(e.x, e.y, e.z, e.w);
    }
  }
};
