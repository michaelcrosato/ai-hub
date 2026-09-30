import * as THREE from 'three/webgpu';
import { radians } from '../core/math.js';

/**
 * Scene, camera, and the level's shared shapes and materials. Drawing uses kit.renderer
 * (WebGPU, or WebGL2 as the fallback); sizing, pixel ratio, and shadow resolution follow the
 * kit's quality tier. Geometry and material ownership stays here. Prefabs contain plain data.
 */
export class RenderWorld {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(50, 1, .05, 350);
    entities = new THREE.Group();
    hemi = new THREE.HemisphereLight(0xe6efe1, 0x718275, 2.2);
    sun = new THREE.DirectionalLight(0xfff0d5, 3.1);
    shapes = new Map();
    materials = new Map();
    /** Set by the T-800 optics while they are on; otherwise the scene draws straight to the canvas. */
    drawOverride = null;
    constructor(kit) {
        this.kit = kit;
        this.renderer = kit.renderer;
        this.renderer.shadowMap.enabled = true;
        // The soft PCF variant is gone from WebGPURenderer; PCF with a radius gives the soft edge.
        this.renderer.shadowMap.type = THREE.PCFShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.scene.add(this.entities, this.hemi);
        this.sun.position.set(-20, 32, 18);
        this.sun.castShadow = true;
        this.sun.shadow.radius = 2.5;
        this.sun.shadow.camera.left = -25;
        this.sun.shadow.camera.right = 25;
        this.sun.shadow.camera.top = 25;
        this.sun.shadow.camera.bottom = -25;
        this.sun.shadow.camera.far = 95;
        this.sun.shadow.normalBias = .04;
        this.sun.shadow.bias = -.0002;
        // 2048 at high, scaled for the tier. r186 resizes the map from mapSize by itself.
        const sizeShadow = () => this.sun.shadow.mapSize.setScalar(kit.shadowSize(2048));
        sizeShadow();
        this.offQuality = kit.onQuality(sizeShadow);
        this.scene.add(this.sun);
        this.shapes.set('box', new THREE.BoxGeometry(1, 1, 1));
        this.shapes.set('cone', new THREE.ConeGeometry(1, 1, 6));
        this.shapes.set('ring', new THREE.TorusGeometry(1, .045, 4, 32));
        this.offResize = kit.onResize((w, h) => {
            this.camera.aspect = w / h;
            this.camera.updateProjectionMatrix();
        });
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
    create(data, blueprint) {
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
        root.visible = !blueprint.editorOnly;
        this.entities.add(root);
        return root;
    }
    environment(data) {
        this.scene.background = new THREE.Color(data.sky);
        this.scene.fog = new THREE.FogExp2(data.sky, data.fog);
        this.sun.intensity = data.sun;
        this.renderer.toneMappingExposure = data.exposure;
    }
    draw() {
        if (this.drawOverride)
            this.drawOverride();
        else
            this.renderer.render(this.scene, this.camera);
    }
    /** Releases this scene's resources. The kit owns the renderer and canvas, which stay. */
    dispose() {
        this.offResize?.();
        this.offQuality?.();
        for (const g of this.shapes.values())
            g.dispose();
        for (const m of this.materials.values())
            m.dispose();
        this.scene.clear();
    }
}
