import * as THREE from 'three';
import { radians, random } from '../core/math.js';
/** Geometry and material ownership stays in this adapter. Prefabs contain plain data. */
export class RenderWorld {
    host;
    renderer;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(50, 1, .05, 350);
    entities = new THREE.Group();
    editorHelpers = new THREE.Group();
    grid = new THREE.GridHelper(34, 34, 0xb7d1ba, 0x95ad98);
    sun = new THREE.DirectionalLight(0xfff0d5, 3.1);
    shapes = new Map();
    materials = new Map();
    resize;
    decorative = new THREE.Group();
    pixelRatio = 1.5;
    constructor(host) {
        this.host = host;
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.pixelRatio));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.domElement.setAttribute('aria-label', '3D level viewport');
        this.renderer.domElement.tabIndex = 0;
        host.prepend(this.renderer.domElement);
        this.scene.add(this.entities, this.editorHelpers, this.decorative, new THREE.HemisphereLight(0xe6efe1, 0x718275, 2.2));
        this.sun.position.set(-20, 32, 18);
        this.sun.castShadow = true;
        this.sun.shadow.mapSize.set(2048, 2048);
        this.sun.shadow.camera.left = -25;
        this.sun.shadow.camera.right = 25;
        this.sun.shadow.camera.top = 25;
        this.sun.shadow.camera.bottom = -25;
        this.sun.shadow.camera.far = 95;
        this.sun.shadow.normalBias = .04;
        this.sun.shadow.bias = -.0002;
        this.scene.add(this.sun);
        this.grid.position.y = .135;
        this.grid.material.transparent = true;
        this.grid.material.opacity = .16;
        this.editorHelpers.add(this.grid);
        this.grid.visible = false;
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
        const rng = random(91);
        for (let i = 0; i < 18; i++) {
            const rock = new THREE.Mesh(this.shapes.get('rock'), this.material('#a8bbaa', 0, 1));
            const a = i / 18 * Math.PI * 2;
            rock.position.set(Math.cos(a) * (65 + rng() * 45), -4, Math.sin(a) * (65 + rng() * 45));
            rock.scale.set(8 + rng() * 18, 4 + rng() * 12, 8 + rng() * 13);
            this.decorative.add(rock);
        }
        this.resize = new ResizeObserver(() => this.setSize());
        this.resize.observe(host);
        this.setSize();
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
        this.renderer.toneMappingExposure = data.exposure;
    }
    setSize() { const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight); this.renderer.setSize(w, h); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
    quality(high) { this.pixelRatio = high ? 1.5 : 1; this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.pixelRatio)); this.renderer.shadowMap.enabled = high; this.setSize(); }
    draw() { this.renderer.render(this.scene, this.camera); }
    dispose() {
        this.resize.disconnect();
        this.sun.shadow.dispose();
        this.grid.geometry.dispose();
        for (const m of Array.isArray(this.grid.material) ? this.grid.material : [this.grid.material])
            m.dispose();
        this.renderer.dispose();
        this.renderer.domElement.remove();
        const geometries = new Set(this.shapes.values()), materials = new Set(this.materials.values());
        this.decorative.traverse(o => {
            if (o instanceof THREE.Mesh) {
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
