import * as THREE from 'three/webgpu';
import { bakeInstances } from 'kit/instancing.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { radians, random } from '../core/math.js';

/** Prefabs that never move, hide or animate: their parts can be merged into one mesh per material. */
const STATIC_PREFABS = new Set(['block', 'column', 'stairs', 'tree', 'rock', 'container', 'bollard', 'parked-car', 'boat']);
const KEEP = new Set(['position', 'normal', 'uv']);

const _toSun = new THREE.Vector3(-20, 32, 18).normalize();

/**
 * Geometry and material ownership stays in this adapter. Prefabs contain plain data.
 * It draws with the wall kit's renderer; the scene, camera and materials are its own.
 * The sun is shared by every scene on the page (one light, one shadow map): each world
 * borrows it while it is the one being drawn.
 */
export class RenderWorld {
    kit;
    sun;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(50, 1, .05, 350);
    entities = new THREE.Group();
    shapes = new Map();
    materials = new Map();
    decorative = new THREE.Group();
    hemisphere = new THREE.HemisphereLight(0xe6efe1, 0x718275, 2.2);
    sunIntensity = 3.1;
    exposure = 1.05;
    /** Follow the camera with the shadow box (long levels); a small level keeps it fixed. */
    followShadow = false;
    shadowExtent = 25;
    shadowCenter = new THREE.Vector3();
    offs = [];
    constructor(kit, sun) {
        this.kit = kit;
        this.sun = sun;
        this.scene.add(this.entities, this.decorative, this.hemisphere);
        this.shapes.set('box', new THREE.BoxGeometry(1, 1, 1));
        this.shapes.set('cylinder', new THREE.CylinderGeometry(1, 1, 1, 8));
        this.shapes.set('cone', new THREE.ConeGeometry(1, 1, 6));
        this.shapes.set('rock', new THREE.IcosahedronGeometry(1, 0));
        this.shapes.set('sphere', new THREE.IcosahedronGeometry(1, 1));
        this.shapes.set('ring', new THREE.TorusGeometry(1, .045, 4, 32));
        const sea = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000), new THREE.MeshStandardMaterial({ color: 0x99b7ac, roughness: 1 }));
        sea.rotation.x = -Math.PI / 2;
        sea.position.y = -5;
        sea.receiveShadow = true;
        this.decorative.add(sea);
        // Eighteen far rocks that never move: one baked mesh, one draw.
        const rng = random(91);
        const rocks = new THREE.InstancedMesh(this.shapes.get('rock'), this.material('#a8bbaa', 0, 1), 18);
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
        for (let i = 0; i < 18; i++) {
            const a = i / 18 * Math.PI * 2;
            p.set(Math.cos(a) * (65 + rng() * 45), -4, Math.sin(a) * (65 + rng() * 45));
            s.set(8 + rng() * 18, 4 + rng() * 12, 8 + rng() * 13);
            rocks.setMatrixAt(i, m.compose(p, q, s));
        }
        this.decorative.add(bakeInstances(rocks));
        this.offs.push(kit.onResize((w, h) => {
            this.camera.aspect = w / h;
            this.camera.updateProjectionMatrix();
        }));
    }
    material(color, emissive, opacity) {
        const key = `${color}/${emissive}/${opacity}`;
        let material = this.materials.get(key);
        if (!material) {
            material = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: .88, metalness: 0, emissive: color, emissiveIntensity: emissive, transparent: opacity < 1, opacity, depthWrite: opacity === 1 });
            this.materials.set(key, material);
        }
        return material;
    }
    create(data, blueprint, playing) {
        const root = new THREE.Group();
        root.name = data.name;
        root.userData.entityId = data.id;
        root.position.fromArray(data.position);
        root.rotation.set(...data.rotation.map(radians));
        root.scale.fromArray(data.scale);
        for (const p of blueprint.visuals) {
            const mesh = new THREE.Mesh(this.shapes.get(p.shape), this.material(p.color, p.emissive ?? 0, p.opacity ?? 1));
            mesh.position.fromArray(p.position);
            mesh.scale.fromArray(p.scale);
            if (p.rotation)
                mesh.rotation.set(...p.rotation.map(radians));
            mesh.castShadow = (p.opacity ?? 1) === 1;
            mesh.receiveShadow = true;
            mesh.userData.entityId = data.id;
            root.add(mesh);
        }
        root.visible = !(playing && blueprint.editorOnly);
        this.entities.add(root);
        return root;
    }
    /**
     * Merge the parts of every static entity into one mesh per material (opaque parts only).
     * A level of walls, floors and props is otherwise hundreds of draws, twice with shadows.
     * `entities`: { data, root } records; only plain fixed scenery without components is taken.
     */
    bakeStatic(entities) {
        const groups = new Map();
        this.entities.updateMatrixWorld(true);
        for (const e of entities) {
            if (!STATIC_PREFABS.has(e.data.prefab) || e.data.components.length || e.moving || !e.root.visible || e.data.model)
                continue;
            for (const mesh of [...e.root.children]) {
                if (!mesh.isMesh || mesh.material.transparent)
                    continue;
                const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
                for (const name of Object.keys(g.attributes))
                    if (!KEEP.has(name))
                        g.deleteAttribute(name);
                g.applyMatrix4(mesh.matrixWorld);
                let list = groups.get(mesh.material);
                if (!list)
                    groups.set(mesh.material, list = []);
                list.push(g);
                mesh.removeFromParent();
            }
        }
        for (const [material, list] of groups) {
            const merged = mergeGeometries(list, false);
            for (const g of list)
                g.dispose();
            if (!merged)
                continue;
            merged.computeBoundingSphere();
            const mesh = new THREE.Mesh(merged, material);
            mesh.castShadow = mesh.receiveShadow = true;
            mesh.matrixAutoUpdate = false;
            mesh.name = 'static scenery';
            this.entities.add(mesh);
        }
    }
    environment(data) {
        this.decorative.visible = data.backdrop;
        this.scene.background = new THREE.Color(data.sky);
        this.scene.fog = new THREE.FogExp2(data.sky, data.fog);
        this.sunIntensity = data.sun;
        this.exposure = data.exposure;
    }
    /** Borrow the shared sun: position, strength and shadow box for this world. */
    activate() {
        const sun = this.sun, cam = sun.shadow.camera, e = this.shadowExtent;
        const far = Math.round(this.sunDistance + e * 1.5 + 20);
        this.scene.add(sun, sun.target);
        sun.color.set(0xfff0d5);
        sun.intensity = this.sunIntensity;
        this.placeSun(this.shadowCenter.x, this.shadowCenter.z);
        if (cam.left !== -e || cam.far !== far) {
            cam.left = -e;
            cam.right = e;
            cam.top = e;
            cam.bottom = -e;
            cam.near = .5;
            cam.far = far;
            cam.updateProjectionMatrix();
        }
    }
    get sunDistance() { return 42 * Math.max(1, this.shadowExtent / 25); }
    placeSun(x, z) {
        const d = this.sunDistance;
        this.sun.target.position.set(x, 0, z);
        this.sun.position.set(x + _toSun.x * d, _toSun.y * d, z + _toSun.z * d);
    }
    draw() {
        if (this.sun.parent !== this.scene)
            this.activate();
        // Keep the shadow box around the player, snapped to whole metres so edges don't crawl.
        if (this.followShadow)
            this.placeSun(Math.round(this.camera.position.x), Math.round(this.camera.position.z));
        const r = this.kit.renderer;
        r.toneMappingExposure = this.exposure;
        r.render(this.scene, this.camera);
    }
    dispose() {
        for (const off of this.offs.splice(0))
            off();
        this.sun.removeFromParent();
        this.sun.target.removeFromParent();
        const geometries = new Set(this.shapes.values()), materials = new Set(this.materials.values());
        this.scene.traverse(o => {
            if (o.isMesh) {
                geometries.add(o.geometry);
                for (const m of Array.isArray(o.material) ? o.material : [o.material])
                    materials.add(m);
            }
        });
        for (const g of geometries)
            g.dispose();
        for (const m of materials)
            m.dispose();
        this.scene.clear();
    }
}
