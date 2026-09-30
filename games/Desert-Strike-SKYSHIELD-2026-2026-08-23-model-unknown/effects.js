/**
 * effects.js — tracers, explosions and sparks from fixed pools.
 *
 * The original mounted a new mesh for every tracer and a new point light for
 * every explosion, which changed the scene's light count mid-fight (a shader
 * rebuild each time). Here every light, mesh and spark exists from the start
 * and is only moved, scaled and faded, so a firefight allocates nothing.
 */

import * as THREE from 'three/webgpu';

const UP = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _mat = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scl = new THREE.Vector3();

const TRACER_LIFE = 0.24;
const BLAST_LIFE = 0.8;

export class Effects {
  constructor(scene, sparkCount = 120) {
    this.scene = scene;
    const thin = new THREE.CylinderGeometry(0.025, 0.025, 1, 5);
    const thick = new THREE.CylinderGeometry(0.08, 0.025, 1, 5);
    this.geos = { thin, thick };
    const trMat = (c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.82, depthWrite: false });
    this.tracerMats = { cannon: trMat('#e9fff7'), rocket: trMat('#ffbd59'), enemy: trMat('#ff665f') };
    this.tracers = [];
    for (let i = 0; i < 48; i++) {
      const m = new THREE.Mesh(thin, this.tracerMats.cannon);
      m.visible = false;
      m.frustumCulled = false;
      scene.add(m);
      this.tracers.push({ mesh: m, life: 0 });
    }
    this.tracerCursor = 0;

    // Explosion flashes: a few lights (constant count) plus additive fireballs.
    this.lights = [];
    for (let i = 0; i < 3; i++) {
      const l = new THREE.PointLight('#ff7a42', 0, 12);
      scene.add(l);
      this.lights.push({ light: l, life: 0, peak: 22 });
    }
    this.lightCursor = 0;
    const ball = new THREE.SphereGeometry(1, 12, 8);
    this.geos.ball = ball;
    this.blasts = [];
    for (let i = 0; i < 12; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: '#ffae57', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
      const m = new THREE.Mesh(ball, mat);
      m.visible = false;
      scene.add(m);
      this.blasts.push({ mesh: m, mat, life: 0, size: 1 });
    }
    this.blastCursor = 0;

    // Sparks and debris: one instanced mesh, simulated on the CPU.
    const sparkGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
    this.geos.spark = sparkGeo;
    this.sparkMat = new THREE.MeshBasicMaterial({ color: '#ffd08a' });
    this.sparkMesh = new THREE.InstancedMesh(sparkGeo, this.sparkMat, sparkCount);
    this.sparkMesh.frustumCulled = false;
    this.sparkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.sparks = [];
    _mat.makeScale(0, 0, 0);
    for (let i = 0; i < sparkCount; i++) {
      this.sparkMesh.setMatrixAt(i, _mat);
      this.sparks.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, spin: 0 });
    }
    this.sparkCursor = 0;
    this.sparksLive = 0;
    scene.add(this.sparkMesh);
  }

  /** kind: 'cannon' | 'rocket' | 'enemy'. */
  tracer(kind, from, to) {
    const t = this.tracers[this.tracerCursor];
    this.tracerCursor = (this.tracerCursor + 1) % this.tracers.length;
    _dir.subVectors(to, from);
    const len = _dir.length();
    if (len < 0.01) return;
    const m = t.mesh;
    m.geometry = kind === 'rocket' ? this.geos.thick : this.geos.thin;
    m.material = this.tracerMats[kind] || this.tracerMats.cannon;
    m.position.addVectors(from, to).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(UP, _dir.multiplyScalar(1 / len));
    m.scale.set(1, len, 1);
    m.visible = true;
    t.life = TRACER_LIFE;
  }

  explosion(at, big = false) {
    const L = this.lights[this.lightCursor];
    this.lightCursor = (this.lightCursor + 1) % this.lights.length;
    L.light.position.copy(at);
    L.life = BLAST_LIFE;
    L.peak = big ? 60 : 22;
    L.light.distance = big ? 30 : 12;
    L.light.intensity = L.peak;

    const b = this.blasts[this.blastCursor];
    this.blastCursor = (this.blastCursor + 1) % this.blasts.length;
    b.mesh.position.copy(at);
    b.life = big ? 1.4 : BLAST_LIFE;
    b.max = b.life;
    b.size = big ? 6.5 : 2.2;
    b.mesh.visible = true;

    const n = big ? 40 : 12;
    for (let i = 0; i < n; i++) {
      const s = this.sparks[this.sparkCursor];
      this.sparkCursor = (this.sparkCursor + 1) % this.sparks.length;
      const a = Math.random() * Math.PI * 2;
      const up = 3 + Math.random() * (big ? 12 : 7);
      const out = 2 + Math.random() * (big ? 11 : 6);
      s.x = at.x;
      s.y = at.y + 0.2;
      s.z = at.z;
      s.vx = Math.cos(a) * out;
      s.vz = Math.sin(a) * out;
      s.vy = up;
      s.max = s.life = 0.5 + Math.random() * (big ? 1.2 : 0.6);
      s.spin = Math.random() * 10;
    }
    this.sparksLive = 2.5;
  }

  /** A small puff where a rocket that found nothing hits the ground. */
  impact(at) {
    const b = this.blasts[this.blastCursor];
    this.blastCursor = (this.blastCursor + 1) % this.blasts.length;
    b.mesh.position.copy(at);
    b.life = b.max = 0.45;
    b.size = 1.3;
    b.mesh.visible = true;
  }

  update(dt) {
    for (const t of this.tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      if (t.life <= 0) t.mesh.visible = false;
    }
    for (const L of this.lights) {
      if (L.life <= 0) continue;
      L.life -= dt;
      const k = Math.max(0, L.life / BLAST_LIFE);
      L.light.intensity = L.life > 0 ? L.peak * k * k : 0;
    }
    for (const b of this.blasts) {
      if (b.life <= 0) continue;
      b.life -= dt;
      if (b.life <= 0) {
        b.mesh.visible = false;
        b.mat.opacity = 0;
        continue;
      }
      const f = 1 - b.life / b.max;
      b.mesh.scale.setScalar(b.size * (0.3 + 0.7 * Math.sqrt(f)));
      b.mat.opacity = 0.9 * (1 - f);
    }
    if (this.sparksLive > 0) {
      this.sparksLive -= dt;
      for (let i = 0; i < this.sparks.length; i++) {
        const s = this.sparks[i];
        if (s.life <= 0) continue;
        s.life -= dt;
        s.vy -= 16 * dt;
        s.x += s.vx * dt;
        s.y = Math.max(0.05, s.y + s.vy * dt);
        s.z += s.vz * dt;
        const k = s.life > 0 ? s.life / s.max : 0;
        _pos.set(s.x, s.y, s.z);
        _quat.setFromAxisAngle(UP, s.spin * k);
        _scl.setScalar(k);
        _mat.compose(_pos, _quat, _scl);
        this.sparkMesh.setMatrixAt(i, _mat);
      }
      this.sparkMesh.instanceMatrix.needsUpdate = true;
    }
  }

  /** Hide everything (retry, phase change). */
  clear() {
    for (const t of this.tracers) {
      t.life = 0;
      t.mesh.visible = false;
    }
    for (const L of this.lights) {
      L.life = 0;
      L.light.intensity = 0;
    }
    for (const b of this.blasts) {
      b.life = 0;
      b.mesh.visible = false;
    }
    _mat.makeScale(0, 0, 0);
    for (let i = 0; i < this.sparks.length; i++) {
      this.sparks[i].life = 0;
      this.sparkMesh.setMatrixAt(i, _mat);
    }
    this.sparkMesh.instanceMatrix.needsUpdate = true;
    this.sparksLive = 0;
  }

  /** Make every pooled object visible for one compile pass, then call clear(). */
  showAllForCompile() {
    for (const t of this.tracers.slice(0, 2)) t.mesh.visible = true;
    this.tracers[1].mesh.geometry = this.geos.thick;
    for (const b of this.blasts) b.mesh.visible = true;
  }

  dispose() {
    for (const t of this.tracers) t.mesh.removeFromParent();
    for (const L of this.lights) L.light.removeFromParent();
    for (const b of this.blasts) {
      b.mesh.removeFromParent();
      b.mat.dispose();
    }
    this.sparkMesh.removeFromParent();
    this.sparkMesh.dispose();
    for (const g of Object.values(this.geos)) g.dispose();
    for (const m of Object.values(this.tracerMats)) m.dispose();
    this.sparkMat.dispose();
  }
}
