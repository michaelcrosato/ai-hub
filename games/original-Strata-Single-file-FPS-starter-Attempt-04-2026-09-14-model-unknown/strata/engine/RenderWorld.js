import * as THREE from 'three/webgpu';
import { createPost } from 'kit/post.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { radians, random } from '../core/math.js';
import { Effects } from './Effects.js';

const SUN_DIRECTION = new THREE.Vector3(-20, 32, 18).normalize();
/** Prefabs whose visuals never move, hide or animate once built: safe to merge into one mesh per material. */
const STATIC_PREFABS = new Set(['block', 'stairs', 'column', 'tree', 'rock', 'hazard', 'checkpoint', 'pad', 'goal']);
/** Components that never touch an entity's visuals. */
const STATIC_COMPONENTS = new Set(['hazard', 'checkpoint', 'pad', 'goal', 'counter', 'logic', 'relay']);
const _box = new THREE.Box3();
const _sphere = new THREE.Sphere();

/**
 * Geometry and material ownership stays in this adapter. Prefabs contain plain data.
 * The renderer and its canvas belong to the shared kit (kit.renderer); a RenderWorld
 * owns one scene, camera and post chain, and can be disposed and rebuilt per mount.
 */
export class RenderWorld {
    kit;
    renderer;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(50, 1, .05, 350);
    entities = new THREE.Group();
    sun = new THREE.DirectionalLight(0xfff0d5, 3.1);
    shapes = new Map();
    materials = new Map();
    decorative = new THREE.Group();
    effects;
    post;
    exposure = 1.05;
    #off = [];
    #merged = [];
    constructor(kit) {
        this.kit = kit;
        this.renderer = kit.renderer;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.#off.push(kit.onResize((w, h) => {
            this.camera.aspect = w / Math.max(1, h);
            this.camera.updateProjectionMatrix();
        }));
        this.scene.add(this.entities, this.decorative, new THREE.HemisphereLight(0xe6efe1, 0x718275, 2.2));
        this.sun.position.copy(SUN_DIRECTION).multiplyScalar(42);
        this.sun.castShadow = true;
        this.sun.shadow.camera.left = -25;
        this.sun.shadow.camera.right = 25;
        this.sun.shadow.camera.top = 25;
        this.sun.shadow.camera.bottom = -25;
        this.sun.shadow.camera.far = 95;
        this.sun.shadow.normalBias = .04;
        this.sun.shadow.bias = -.0002;
        this.sun.shadow.radius = 2;
        // 2048 at the high tier, scaled by the quality tier (and on quality changes).
        const sizeShadow = () => this.sun.shadow.mapSize.setScalar(kit.shadowSize(2048));
        sizeShadow();
        this.#off.push(kit.onQuality(sizeShadow));
        this.scene.add(this.sun, this.sun.target);
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
        // The distant rocks around the sea: one merged mesh (same seed and placement as before).
        const rng = random(91), rocks = [], place = new THREE.Object3D();
        for (let i = 0; i < 18; i++) {
            const a = i / 18 * Math.PI * 2;
            place.position.set(Math.cos(a) * (65 + rng() * 45), -4, Math.sin(a) * (65 + rng() * 45));
            place.scale.set(8 + rng() * 18, 4 + rng() * 12, 8 + rng() * 13);
            place.updateMatrix();
            rocks.push(this.shapes.get('rock').clone().applyMatrix4(place.matrix));
        }
        const rockGeometry = mergeGeometries(rocks, false);
        for (const g of rocks)
            g.dispose();
        this.#merged.push(rockGeometry);
        this.decorative.add(new THREE.Mesh(rockGeometry, this.material('#a8bbaa', 0, 1)));
        this.effects = new Effects(this.scene);
        this.post = createPost(kit, this.scene, this.camera);
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
    environment(data) {
        this.decorative.visible = data.backdrop;
        this.scene.background = new THREE.Color(data.sky);
        this.scene.fog = new THREE.FogExp2(data.sky, data.fog);
        this.sun.intensity = data.sun;
        this.exposure = data.exposure;
    }
    /**
     * Merge the visuals of static scenery (fixed blocks, stairs, columns, plates, pads and
     * gates whose components never touch visuals) into one mesh per material: far fewer draw calls in
     * the main and shadow passes. Their entity roots stay, empty, for the physics records.
     */
    mergeStatic(entities) {
        const groups = new Map();
        for (const e of entities) {
            if (!STATIC_PREFABS.has(e.data.prefab) || e.data.components.some(c => !STATIC_COMPONENTS.has(c.type)) || e.data.model || !e.body.isFixed() || !e.root.visible)
                continue;
            e.root.updateMatrixWorld(true);
            for (const mesh of [...e.root.children]) {
                if (!mesh.isMesh || Array.isArray(mesh.material))
                    continue;
                let geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
                geometry.applyMatrix4(mesh.matrixWorld);
                for (const name of Object.keys(geometry.attributes))
                    if (!['position', 'normal', 'uv'].includes(name))
                        geometry.deleteAttribute(name);
                let list = groups.get(mesh.material);
                if (!list)
                    groups.set(mesh.material, list = []);
                list.push(geometry);
                e.root.remove(mesh);
            }
        }
        for (const [material, list] of groups) {
            const merged = mergeGeometries(list, false);
            for (const geometry of list)
                geometry.dispose();
            if (!merged)
                continue;
            merged.computeBoundingSphere();
            const mesh = new THREE.Mesh(merged, material);
            mesh.name = 'static scenery';
            mesh.castShadow = material.opacity === 1;
            mesh.receiveShadow = true;
            mesh.matrixAutoUpdate = false;
            this.entities.add(mesh);
            this.#merged.push(merged);
        }
    }
    /** Fit the sun's shadow camera around the level, so larger levels keep their shadows. */
    fitShadow() {
        _box.setFromObject(this.entities);
        if (_box.isEmpty())
            return;
        _box.getBoundingSphere(_sphere);
        const r = Math.max(8, _sphere.radius);
        this.sun.target.position.copy(_sphere.center);
        this.sun.position.copy(_sphere.center).addScaledVector(SUN_DIRECTION, r + 20);
        const cam = this.sun.shadow.camera;
        cam.left = -r; cam.right = r; cam.top = r; cam.bottom = -r;
        cam.near = .5; cam.far = 2 * r + 40;
        cam.updateProjectionMatrix();
    }
    draw(dt) {
        this.effects.update(dt);
        // The renderer is shared by every mount: apply this level's exposure each frame.
        this.renderer.toneMappingExposure = this.exposure;
        this.post.render();
    }
    dispose() {
        for (const off of this.#off)
            off();
        this.#off.length = 0;
        this.post.dispose();
        this.effects.dispose();
        const geometries = new Set([...this.shapes.values(), ...this.#merged]), materials = new Set(this.materials.values());
        this.decorative.traverse(o => {
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
