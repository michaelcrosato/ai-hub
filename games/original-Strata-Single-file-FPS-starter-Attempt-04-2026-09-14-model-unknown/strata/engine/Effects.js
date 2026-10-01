import * as THREE from 'three/webgpu';
import { createInstanced } from 'kit/instancing.js';

/**
 * Shot tracers, impact sparks and small glow markers in one instanced batch
 * with one unlit material, so every effect shares a single shader. Idle slots
 * are collapsed to zero size, which keeps the batch drawn (and compiled) from
 * the first frame: the first shot never stalls on a shader compile.
 */
const CAPACITY = 96;
const GLOWS = 12;
const TRACER = 1, SPARK = 2;
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _d = new THREE.Vector3();
const IDENTITY = new THREE.Quaternion();
const _tmpColor = new THREE.Color();

export class Effects {
    geometry = new THREE.BoxGeometry(1, 1, 1);
    material = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    mesh;
    particles = [];
    next = 0;
    glowCount = 0;
    lastGlowCount = 0;
    constructor(scene) {
        this.mesh = createInstanced(this.geometry, this.material, CAPACITY);
        this.mesh.name = 'effects';
        this.mesh.frustumCulled = false;
        this.mesh.castShadow = false;
        this.mesh.receiveShadow = false;
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        const white = new THREE.Color(1, 1, 1);
        for (let i = 0; i < CAPACITY; i++) {
            this.mesh.setMatrixAt(i, ZERO);
            this.mesh.setColorAt(i, white);
        }
        this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
        for (let i = 0; i < CAPACITY - GLOWS; i++)
            this.particles.push({ kind: 0, life: 0, max: 1, size: 0, active: false, a: new THREE.Vector3(), b: new THREE.Vector3(), v: new THREE.Vector3(), color: new THREE.Color() });
        scene.add(this.mesh);
    }
    #alloc() {
        const p = this.particles[this.next];
        this.next = (this.next + 1) % this.particles.length;
        return p;
    }
    /** A bright streak from `from` to `to` (world points) that thins out over `life` seconds. */
    tracer(from, to, color = 0xfff2b0, width = .035, life = .08) {
        const p = this.#alloc();
        p.kind = TRACER;
        p.a.copy(from);
        p.b.copy(to);
        p.color.set(color);
        p.size = width;
        p.life = p.max = life;
        p.active = true;
    }
    /** A handful of sparks that fly out from a point and fall. */
    burst(point, color = 0xffd27a, count = 6, speed = 3.2) {
        for (let i = 0; i < count; i++) {
            const p = this.#alloc();
            p.kind = SPARK;
            p.a.copy(point);
            const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
            p.v.set(r * Math.cos(a), Math.abs(u) * .8 + .4, r * Math.sin(a)).multiplyScalar(speed * (.45 + Math.random() * .55));
            p.color.set(color);
            p.size = .06 + Math.random() * .04;
            p.life = p.max = .22 + Math.random() * .16;
            p.active = true;
        }
    }
    /** A glowing cube for this frame only (a sentry's eye while it aims). */
    glow(position, color = 0xff4a3a, size = .14) {
        if (this.glowCount >= GLOWS)
            return;
        const i = this.glowCount++;
        _m.compose(position, IDENTITY, _s.set(size, size, size));
        this.mesh.setMatrixAt(i, _m);
        this.mesh.setColorAt(i, _tmpColor.set(color));
    }
    update(dt) {
        const mesh = this.mesh;
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i], slot = GLOWS + i;
            if (!p.active)
                continue;
            p.life -= dt;
            if (p.life <= 0) {
                p.active = false;
                mesh.setMatrixAt(slot, ZERO);
                continue;
            }
            const t = p.life / p.max;
            if (p.kind === TRACER) {
                _d.subVectors(p.b, p.a);
                const length = _d.length();
                if (length < 1e-4) {
                    mesh.setMatrixAt(slot, ZERO);
                    continue;
                }
                _q.setFromUnitVectors(Z_AXIS, _d.divideScalar(length));
                _p.addVectors(p.a, p.b).multiplyScalar(.5);
                const w = p.size * (.35 + .65 * t);
                _m.compose(_p, _q, _s.set(w, w, length));
            }
            else {
                p.v.y -= 9.8 * dt;
                p.a.addScaledVector(p.v, dt);
                const s = p.size * t;
                _m.compose(p.a, IDENTITY, _s.set(s, s, s));
            }
            mesh.setMatrixAt(slot, _m);
            mesh.setColorAt(slot, p.color);
        }
        for (let i = this.glowCount; i < this.lastGlowCount; i++)
            mesh.setMatrixAt(i, ZERO);
        this.lastGlowCount = this.glowCount;
        this.glowCount = 0;
        mesh.instanceMatrix.clearUpdateRanges();
        mesh.instanceMatrix.addUpdateRange(0, CAPACITY * 16);
        mesh.instanceMatrix.needsUpdate = true;
        mesh.instanceColor.clearUpdateRanges();
        mesh.instanceColor.addUpdateRange(0, CAPACITY * 3);
        mesh.instanceColor.needsUpdate = true;
    }
    dispose() {
        this.mesh.removeFromParent();
        this.mesh.dispose();
        this.geometry.dispose();
        this.material.dispose();
    }
}
