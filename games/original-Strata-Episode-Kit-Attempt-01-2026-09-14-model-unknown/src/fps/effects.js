import * as THREE from 'three/webgpu';

/**
 * Shot feedback for the first-person episodes: tracers, impact puffs and a muzzle flash.
 * Small fixed pools built at load (no allocation while playing), shared geometry and one
 * material per colour, so firing never creates materials or compiles shaders mid-game.
 */
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

export class ShotEffects {
    group = new THREE.Group();
    tracers = [];
    puffs = [];
    geometry = new THREE.BoxGeometry(1, 1, 1);
    puffGeometry = new THREE.IcosahedronGeometry(1, 0);
    materials;
    constructor(scene) {
        this.materials = {
            player: new THREE.MeshBasicMaterial({ color: '#ffe3a1', transparent: true, opacity: .85, depthWrite: false, fog: false }),
            enemy: new THREE.MeshBasicMaterial({ color: '#ff7a5c', transparent: true, opacity: .9, depthWrite: false, fog: false }),
            puff: new THREE.MeshBasicMaterial({ color: '#fff2c9', transparent: true, opacity: .75, depthWrite: false }),
        };
        for (let i = 0; i < 8; i++) {
            const mesh = new THREE.Mesh(this.geometry, this.materials.player);
            mesh.visible = false;
            mesh.frustumCulled = false;
            this.group.add(mesh);
            this.tracers.push({ mesh, life: 0 });
        }
        for (let i = 0; i < 8; i++) {
            const mesh = new THREE.Mesh(this.puffGeometry, this.materials.puff);
            mesh.visible = false;
            this.group.add(mesh);
            this.puffs.push({ mesh, life: 0 });
        }
        scene.add(this.group);
    }
    /** A streak from `from` to `to` (world positions) for a few frames. */
    tracer(from, to, kind = 'player') {
        const slot = this.tracers.reduce((a, b) => (a.life <= b.life ? a : b));
        const mesh = slot.mesh;
        mesh.material = this.materials[kind] ?? this.materials.player;
        _a.copy(from);
        _b.copy(to);
        const length = _a.distanceTo(_b);
        if (length < .05)
            return;
        mesh.position.addVectors(_a, _b).multiplyScalar(.5);
        mesh.lookAt(_b);
        mesh.scale.set(kind === 'enemy' ? .05 : .03, kind === 'enemy' ? .05 : .03, length);
        mesh.visible = true;
        slot.life = kind === 'enemy' ? .09 : .06;
    }
    puff(point) {
        const slot = this.puffs.reduce((a, b) => (a.life <= b.life ? a : b));
        slot.mesh.position.copy(point);
        slot.mesh.scale.setScalar(.06);
        slot.mesh.visible = true;
        slot.life = .16;
    }
    update(dt) {
        for (const t of this.tracers) {
            if (t.life <= 0)
                continue;
            t.life -= dt;
            if (t.life <= 0)
                t.mesh.visible = false;
        }
        for (const p of this.puffs) {
            if (p.life <= 0)
                continue;
            p.life -= dt;
            p.mesh.scale.setScalar(.06 + (.16 - Math.max(0, p.life)) * 1.4);
            if (p.life <= 0)
                p.mesh.visible = false;
        }
    }
    /**
     * Show one of each in view (at `point`, in front of the camera) while the episode compiles
     * its pipelines, so the first shot does not stall on a shader compile.
     */
    prewarm(on, point) {
        for (const t of [...this.tracers.slice(0, 2), ...this.puffs.slice(0, 1)]) {
            t.mesh.visible = on;
            if (on && point)
                t.mesh.position.copy(point);
        }
        this.tracers[1].mesh.material = on ? this.materials.enemy : this.materials.player;
    }
    dispose() {
        this.group.removeFromParent();
        this.geometry.dispose();
        this.puffGeometry.dispose();
        for (const m of Object.values(this.materials))
            m.dispose();
    }
}
