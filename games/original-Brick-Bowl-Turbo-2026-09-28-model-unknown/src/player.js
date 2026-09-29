import * as THREE from "three/webgpu";
import { PlayerModel } from "./art.js";
import { PHYS, PLAYER } from "./config.js";
import { GROUP_CARRIER, GROUP_DOWN, GROUP_PLAYER, RAPIER } from "./physics.js";

export const _pv = new THREE.Vector3();
export const Player = class e {
  team;
  teamDef;
  physics;
  static nextId = 1;
  id = e.nextId++;
  model;
  body;
  collider;
  info;
  slot = ``;
  active = false;
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  yaw = 0;
  radius = PLAYER.RADIUS;
  halfH = 0.5;
  move = new THREE.Vector2();
  throttle = 1;
  turbo = false;
  faceTarget = null;
  action = `none`;
  actionT = 0;
  isDown = false;
  downT = 0;
  ragdoll = false;
  ragdollT = 0;
  stumbleT = 0;
  stunT = 0;
  airborne = false;
  engaged = null;
  engageT = 0;
  shedTime = 2;
  blockCooldown = 0;
  lastTackleTry = -99;
  catchAttemptId = -1;
  hasBall = false;
  role = { k: `idle` };
  human = null;
  onFire = false;
  celebrate = false;
  lateHitDone = false;
  speedMod = 1;
  idleT = 0;
  faceScratch = new THREE.Vector3(); // reused look-at target (no per-step allocation)
  speedScale = 1; // CPU difficulty speed, set per play by PlaySession
  constructor(e, n, r, i, a) {
    this.team = e;
    this.teamDef = n;
    this.physics = i;
    this.model = new PlayerModel(r);
    this.model.root.visible = false;
    a.add(this.model.root);
    let o = RAPIER.RigidBodyDesc.dynamic()
      .lockRotations()
      .setTranslation(0, -20, 0)
      .setGravityScale(PHYS.PLAYER_GRAVITY / PHYS.GRAVITY)
      .setCcdEnabled(false);
    this.body = i.world.createRigidBody(o);
    this.body.setEnabled(false);
  }
  get r() {
    return this.info.r;
  }
  bind(e) {
    this.info = e;
    this.model.setIdentity(this.teamDef, e);
    let t = Math.max(0.36, Math.min(0.52, PLAYER.RADIUS * (0.75 + e.size * 0.25)));
    if (this.collider && Math.abs(t - this.radius) < 0.001) return;
    this.collider && this.physics.world.removeCollider(this.collider, false);
    this.radius = t;
    this.halfH = 0.93 - t;
    let r = RAPIER.ColliderDesc.capsule(this.halfH, t)
      .setFriction(0.05)
      .setRestitution(0)
      .setDensity(1 + e.r.str / 45)
      .setCollisionGroups(GROUP_PLAYER[this.team]);
    this.collider = this.physics.world.createCollider(r, this.body);
  }
  get standY() {
    return this.halfH + this.radius;
  }
  setActive(e) {
    this.active = e;
    this.body.setEnabled(e);
    this.model.root.visible = e;
    e || this.body.setTranslation({ x: 0, y: -20, z: 0 }, false);
  }
  resetState() {
    this.action = `none`;
    this.actionT = 0;
    this.isDown = false;
    this.downT = 0;
    this.stumbleT = 0;
    this.stunT = 0;
    this.engaged = null;
    this.engageT = 0;
    this.blockCooldown = 0;
    this.hasBall = false;
    this.move.set(0, 0);
    this.turbo = false;
    this.faceTarget = null;
    this.celebrate = false;
    this.lateHitDone = false;
    this.lastTackleTry = -99;
    this.airborne = false;
    this.speedMod = 1;
    this.idleT = 0;
    this.ragdoll && this.endRagdoll();
    this.refreshGroups();
  }
  refreshGroups() {
    if (!this.collider) return;
    let e =
      this.isDown || this.ragdoll
        ? GROUP_DOWN
        : this.hasBall
          ? GROUP_CARRIER[this.team]
          : GROUP_PLAYER[this.team];
    this.collider.setCollisionGroups(e);
  }
  place(e, t, n) {
    this.resetState();
    this.body.setTranslation({ x: e, y: this.standY + 0.01, z: t }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    this.pos.set(e, 0, t);
    this.vel.set(0, 0, 0);
    this.yaw = n;
    this.model.root.position.set(e, 0, t);
    this.model.root.quaternion.identity();
    this.model.root.rotation.y = n;
    this.model.setMode(`idle`);
  }
  topSpeed() {
    return (
      (PLAYER.BASE_SPEED + (this.r.spd / 99) * PLAYER.SPEED_RANGE) *
      this.speedMod *
      this.speedScale *
      (this.onFire ? 1.08 : 1)
    );
  }
  canAct() {
    return this.active && !this.isDown && !this.ragdoll && this.action !== `dive`;
  }
  applyMovement(e) {
    if (!this.active) return;
    this.actionT += e;
    this.stumbleT > 0 && (this.stumbleT -= e);
    this.stunT > 0 && (this.stunT -= e);
    this.blockCooldown > 0 && (this.blockCooldown -= e);
    let t = this.body.linvel();
    if (this.ragdoll) {
      this.ragdollT -= e;
      return;
    }
    if (this.isDown) {
      this.downT -= e;
      this.body.setLinvel({ x: t.x * 0.8, y: Math.min(t.y, 0), z: t.z * 0.8 }, true);
      return;
    }
    let r = this.topSpeed() * (this.turbo ? PLAYER.TURBO_MULT : 1);
    this.stumbleT > 0 && (r *= 0.45);
    let i = PLAYER.ACCEL * (0.75 + this.r.agi / 200),
      a = this.move.x * r * this.throttle,
      o = this.move.y * r * this.throttle;
    this.action === `dive`
      ? ((i = 3), (a = t.x), (o = t.z), this.actionT > 0.35 && ((a *= 0.9), (o *= 0.9)))
      : this.action === `kneel` ||
          this.action === `kick` ||
          this.action === `spike` ||
          this.action === `celebrate` ||
          this.action === `wave`
        ? ((a = 0), (o = 0))
        : this.action === `throw` && this.actionT < 0.2 && ((a *= 0.3), (o *= 0.3));
    let s = t.x,
      c = t.z,
      l = a - s,
      u = o - c,
      d = Math.hypot(l, u),
      f = i * e * (this.airborne ? 0.25 : 1),
      p = Math.hypot(s, c),
      m = Math.hypot(a, o);
    if (p > 5 && m > 0.5) {
      let e = (s * a + c * o) / (p * m);
      e < 0.5 && (f *= 0.55 + 0.45 * Math.max(0, (e + 1) / 1.5));
    }
    d <= f ? ((s = a), (c = o)) : ((s += (l / d) * f), (c += (u / d) * f));
    this.body.setLinvel({ x: s, y: t.y, z: c }, true);
    let h = this.body.translation();
    this.airborne = h.y > this.standY + 0.12;
    let g = this.yaw;
    this.faceTarget
      ? (g = Math.atan2(this.faceTarget.x - h.x, this.faceTarget.z - h.z))
      : Math.hypot(s, c) > 0.6 && (g = Math.atan2(s, c));
    let _ = g - this.yaw;
    for (; _ > Math.PI; ) _ -= Math.PI * 2;
    for (; _ < -Math.PI; ) _ += Math.PI * 2;
    this.yaw += _ * Math.min(1, e * (this.action === `spin` ? 30 : 11));
  }
  jump(e) {
    if (this.airborne) return;
    let t = this.body.linvel();
    this.body.setLinvel({ x: t.x, y: e, z: t.z }, true);
    this.airborne = true;
  }
  impulse(e, t, n) {
    let r = this.body.linvel();
    this.body.setLinvel({ x: r.x + e, y: r.y + t, z: r.z + n }, true);
  }
  setAction(e) {
    this.action = e;
    this.actionT = 0;
  }
  knockDown(e = 1.4) {
    this.isDown ||
      this.ragdoll ||
      ((this.isDown = true),
      (this.downT = e),
      (this.action = `none`),
      (this.engaged = null),
      this.collider.setCollisionGroups(GROUP_DOWN));
  }
  launch(e, t, n) {
    if (this.ragdoll) return;
    this.ragdoll = true;
    this.ragdollT = 1.6 + n * 0.08;
    this.isDown = true;
    this.downT = this.ragdollT + 0.6;
    this.engaged = null;
    this.action = `none`;
    this.collider.setCollisionGroups(GROUP_DOWN);
    this.body.lockRotations(false, true);
    let r = Math.hypot(e, t) || 1;
    this.body.setLinvel({ x: (e / r) * n * 0.9, y: 5 + n * 0.55, z: (t / r) * n * 0.9 }, true);
    this.body.setAngvel(
      {
        x: (Math.random() - 0.5) * 14 + (t / r) * 10,
        y: (Math.random() - 0.5) * 10,
        z: (Math.random() - 0.5) * 14 - (e / r) * 10,
      },
      true,
    );
  }
  endRagdoll() {
    this.ragdoll = false;
    this.body.lockRotations(true, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    let e = this.body.translation();
    this.body.setTranslation({ x: e.x, y: this.standY, z: e.z }, true);
  }
  getUp() {
    this.ragdoll && this.endRagdoll();
    this.isDown = false;
    this.downT = 0;
    this.refreshGroups();
    this.model.setMode(`getup`);
    this.action = `none`;
    this.stunT = 0.4;
  }
  sync(e, t) {
    if (!this.active) return;
    let n = this.body.translation(),
      r = this.body.linvel();
    this.pos.set(n.x, 0, n.z);
    this.vel.set(r.x, 0, r.z);
    let i = this.model.root;
    if (this.ragdoll) {
      let t = this.body.rotation();
      i.quaternion.set(t.x, t.y, t.z, t.w);
      _pv.set(0, -this.standY, 0).applyQuaternion(i.quaternion);
      i.position.set(n.x + _pv.x, n.y + _pv.y, n.z + _pv.z);
      this.model.setMode(`ragdoll`);
      this.model.animate(e, 0, false);
      return;
    }
    i.quaternion.identity();
    i.rotation.y = this.yaw;
    i.position.set(n.x, n.y - this.standY, n.z);
    let a = Math.hypot(r.x, r.z),
      o = t ?? `idle`;
    t ||
      (o = this.isDown
        ? this.model.mode === `getup`
          ? `getup`
          : `down`
        : this.action === `dive`
          ? `dive`
          : this.action === `spin`
            ? `spin`
            : this.action === `throw`
              ? `throw`
              : this.action === `kick`
                ? `kick`
                : this.action === `kneel`
                  ? `kneel`
                  : this.action === `spike`
                    ? `spike`
                    : this.action === `stiffarm`
                      ? `stiffarm`
                      : this.action === `hurdle`
                        ? `hurdle`
                        : this.action === `handoff`
                          ? `handoff`
                          : this.action === `celebrate`
                            ? `celebrate`
                            : this.action === `wave`
                              ? `wave`
                              : this.action === `jump` || this.airborne
                                ? `jump`
                                : this.engaged && this.role.k !== `rush`
                                  ? `block`
                                  : a > 0.4
                                    ? `run`
                                    : this.model.mode === `getup` && this.model.modeT < 0.5
                                      ? `getup`
                                      : `idle`);
    this.model.setMode(o);
    this.model.animate(e, a, this.turbo);
  }
  dist(e) {
    let t = e instanceof THREE.Vector3 ? e : e.pos;
    return Math.hypot(t.x - this.pos.x, t.z - this.pos.z);
  }
  bodyY() {
    return this.body.translation().y - this.standY;
  }
};
