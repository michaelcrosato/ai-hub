import * as THREE from "three/webgpu";

export const MAX_PARTS = 2400;
// Scratch vectors and colours handed to spawn(), which copies them at once.
const _P = new THREE.Vector3();
const _V = new THREE.Vector3();
const _C = new THREE.Color();
const FIRE_COLORS = [`#ff3b00`, `#ff8a00`, `#ffd000`, `#fff3a0`].map((c) => new THREE.Color(c));
const PUFF_A = new THREE.Color(`#ffffff`);
const PUFF_B = new THREE.Color(`#d9f4ff`);
const SPARK = new THREE.Color(`#fff2b0`);
export const Effects = class {
  mesh;
  parts = [];
  free = [];
  m = new THREE.Matrix4();
  q = new THREE.Quaternion();
  s = new THREE.Vector3();
  rings = [];
  flags = [];
  fireworks = [];
  onFirework = null;
  detail = 1; // kit quality tier: scales burst, confetti and firework particle counts
  constructor(e) {
    let t = new THREE.BoxGeometry(1, 1, 1),
      n = new THREE.MeshBasicMaterial({ color: `#ffffff` });
    this.mesh = new THREE.InstancedMesh(t, n, MAX_PARTS);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.setColorAt(0, new THREE.Color(`#fff`));
    e.add(this.mesh);
    for (let e = 0; e < MAX_PARTS; e++)
      this.free.push({
        p: new THREE.Vector3(),
        v: new THREE.Vector3(),
        life: 0,
        max: 1,
        size: 0.1,
        color: new THREE.Color(),
        grav: 0,
        drag: 0,
        spin: new THREE.Vector3(),
        rot: new THREE.Euler(),
        flutter: 0,
        shrink: true,
      });
    for (let t = 0; t < 6; t++) {
      let t = new THREE.Mesh(
        new THREE.RingGeometry(0.8, 1, 24),
        new THREE.MeshBasicMaterial({
          color: `#ffffff`,
          transparent: true,
          opacity: 0,
          side: 2,
          depthWrite: false,
        }),
      );
      t.rotation.x = -Math.PI / 2;
      t.visible = false;
      e.add(t);
      this.rings.push({ mesh: t, t: 1, max: 1, scale: 1 });
    }
    for (let t = 0; t < 3; t++) {
      let t = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.06, 0.4),
        new THREE.MeshLambertMaterial({ color: `#ffe600` }),
      );
      t.visible = false;
      t.castShadow = true;
      e.add(t);
      this.flags.push({
        mesh: t,
        p: new THREE.Vector3(),
        v: new THREE.Vector3(),
        active: false,
        landed: false,
      });
    }
  }
  spawn(e) {
    let t = this.free.pop();
    t &&
      (t.p.copy(e.p),
      t.v.copy(e.v),
      (t.life = e.life),
      (t.max = e.life),
      (t.size = e.size),
      t.color.set(e.color),
      (t.grav = e.grav ?? 18),
      (t.drag = e.drag ?? 0.5),
      (t.flutter = e.flutter ?? 0),
      (t.shrink = e.shrink ?? true),
      t.spin.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12),
      t.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6),
      this.parts.push(t));
  }
  hitBurst(e, t, n = 1) {
    let r = Math.round(14 * n * this.detail);
    for (let i = 0; i < r; i++) {
      let r = Math.random() * Math.PI * 2,
        a = (2 + Math.random() * 6) * n;
      this.spawn({
        p: _P.set(e.x, e.y + 0.8 + Math.random() * 0.6, e.z),
        v: _V.set(Math.cos(r) * a, 3 + Math.random() * 6 * n, Math.sin(r) * a),
        life: 0.6 + Math.random() * 0.6,
        size: 0.1 + Math.random() * 0.16,
        color: t[i % t.length],
      });
    }
    for (let t = 0; t < r / 2; t++)
      this.spawn({
        p: _P.set(e.x + (Math.random() - 0.5) * 0.8, e.y + 0.05, e.z + (Math.random() - 0.5) * 0.8),
        v: _V.set((Math.random() - 0.5) * 4, 2 + Math.random() * 4, (Math.random() - 0.5) * 4),
        life: 0.8,
        size: 0.1 + Math.random() * 0.1,
        color: Math.random() < 0.5 ? `#2f8f36` : `#5a3a1e`,
      });
  }
  ring(e, t, n = 4, r = 0.45) {
    let i = this.rings.find((e) => e.t >= e.max) ?? this.rings[0];
    i.mesh.position.set(e.x, 0.05, e.z);
    i.mesh.material.color.set(t);
    i.t = 0;
    i.max = r;
    i.scale = n;
    i.mesh.visible = true;
  }
  fire(e, t) {
    for (let n = 0; n < 2; n++)
      this.spawn({
        p: _P.set(
          e.x + (Math.random() - 0.5) * 0.5,
          e.y + 0.2 + Math.random() * 1.2,
          e.z + (Math.random() - 0.5) * 0.5,
        ),
        v: _V.set(
          -t.x * 0.2 + (Math.random() - 0.5),
          2 + Math.random() * 2.5,
          -t.z * 0.2 + (Math.random() - 0.5),
        ),
        life: 0.35 + Math.random() * 0.3,
        size: 0.14 + Math.random() * 0.16,
        color: FIRE_COLORS[Math.floor(Math.random() * 4)],
        grav: -3,
        drag: 2,
      });
  }
  turboPuff(e) {
    this.spawn({
      p: _P.set(e.x + (Math.random() - 0.5) * 0.3, e.y + 0.1, e.z + (Math.random() - 0.5) * 0.3),
      v: _V.set((Math.random() - 0.5) * 1.5, 0.8 + Math.random(), (Math.random() - 0.5) * 1.5),
      life: 0.35,
      size: 0.12,
      color: Math.random() < 0.5 ? PUFF_A : PUFF_B,
      grav: -1,
      drag: 3,
    });
  }
  confetti(e, t, n = 260) {
    const count = Math.round(n * this.detail);
    for (let r = 0; r < count; r++)
      this.spawn({
        p: _P.set(
          e.x + (Math.random() - 0.5) * 30,
          e.y + 12 + Math.random() * 14,
          e.z + (Math.random() - 0.5) * 30,
        ),
        v: _V.set((Math.random() - 0.5) * 2, -1 - Math.random(), (Math.random() - 0.5) * 2),
        life: 4 + Math.random() * 3,
        size: 0.18,
        color: t[r % t.length],
        grav: 0.6,
        drag: 0.8,
        flutter: 2 + Math.random() * 3,
        shrink: false,
      });
  }
  launchFireworks(e, t) {
    for (let n = 0; n < e; n++) {
      let e = Math.random() < 0.5 ? -1 : 1;
      this.fireworks.push({
        p: new THREE.Vector3((Math.random() - 0.5) * 60, 8, e * (60 + Math.random() * 15)),
        v: new THREE.Vector3((Math.random() - 0.5) * 4, 26 + Math.random() * 8, -e * (2 + Math.random() * 4)),
        fuse: 1 + Math.random() * 0.8 + n * 0.18,
        color: new THREE.Color(t[n % t.length]),
      });
    }
  }
  throwFlag(e, t) {
    let n = this.flags.find((e) => !e.active) ?? this.flags[0];
    n.active = true;
    n.landed = false;
    n.p.copy(e).setY(2.2);
    let r = 0.8;
    n.v.set((t.x - e.x) / r, 9, (t.z - e.z) / r);
    n.mesh.visible = true;
  }
  clearFlags() {
    for (let e of this.flags) {
      e.active = false;
      e.mesh.visible = false;
    }
  }
  clearAll() {
    for (let e of this.parts) this.free.push(e);
    this.parts.length = 0;
    this.fireworks.length = 0;
  }
  update(e) {
    for (let t = this.fireworks.length - 1; t >= 0; t--) {
      let n = this.fireworks[t];
      if (
        ((n.v.y -= 12 * e),
        n.p.addScaledVector(n.v, e),
        (n.fuse -= e),
        this.spawn({
          p: n.p,
          v: _V.set(0, -2, 0),
          life: 0.3,
          size: 0.12,
          color: SPARK,
          grav: 0,
        }),
        n.fuse <= 0)
      ) {
        this.fireworks.splice(t, 1);
        this.onFirework?.();
        const sparks = Math.round(70 * this.detail);
        for (let e = 0; e < sparks; e++) {
          _V.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
          this.spawn({
            p: n.p,
            v: _V.multiplyScalar(10 + Math.random() * 6),
            life: 1.2 + Math.random() * 0.6,
            size: 0.35,
            color: _C.copy(n.color).offsetHSL(0, 0, Math.random() * 0.2),
            grav: 5,
            drag: 1.2,
          });
        }
      }
    }
    let t = 0;
    for (let t = this.parts.length - 1; t >= 0; t--) {
      let n = this.parts[t];
      if (((n.life -= e), n.life <= 0 || n.p.y < -0.5)) {
        this.parts[t] = this.parts[this.parts.length - 1];
        this.parts.pop();
        this.free.push(n);
        continue;
      }
      n.v.y -= n.grav * e;
      n.v.multiplyScalar(Math.max(0, 1 - n.drag * e));
      n.flutter &&
        ((n.v.x += Math.sin(n.life * n.flutter * 3) * e * 2),
        (n.v.z += Math.cos(n.life * n.flutter * 2.3) * e * 2));
      n.p.addScaledVector(n.v, e);
      n.p.y < 0.03 && n.v.y < 0 && ((n.p.y = 0.03), (n.v.y *= -0.3), (n.v.x *= 0.6), (n.v.z *= 0.6));
      n.rot.x += n.spin.x * e;
      n.rot.y += n.spin.y * e;
      n.rot.z += n.spin.z * e;
    }
    for (let e of this.parts) {
      let n = e.shrink ? Math.min(1, (e.life / e.max) * 2.2) : 1;
      this.s.setScalar(e.size * n);
      this.q.setFromEuler(e.rot);
      this.m.compose(e.p, this.q, this.s);
      this.mesh.setMatrixAt(t, this.m);
      this.mesh.setColorAt(t, e.color);
      t++;
    }
    this.mesh.count = t;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor && (this.mesh.instanceColor.needsUpdate = true);
    for (let t of this.rings) {
      if (t.t >= t.max) {
        t.mesh.visible = false;
        continue;
      }
      t.t += e;
      let n = t.t / t.max,
        r = 0.3 + n * t.scale;
      t.mesh.scale.set(r, r, r);
      t.mesh.material.opacity = (1 - n) * 0.9;
    }
    for (let t of this.flags)
      t.active &&
        !t.landed &&
        ((t.v.y -= 20 * e),
        t.p.addScaledVector(t.v, e),
        t.p.y <= 0.04 && ((t.p.y = 0.04), (t.landed = true)),
        t.mesh.position.copy(t.p),
        t.mesh.rotation.set(t.p.y * 3, t.p.y * 2, 0));
  }
};
