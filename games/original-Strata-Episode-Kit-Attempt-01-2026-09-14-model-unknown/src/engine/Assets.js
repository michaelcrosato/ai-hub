import * as THREE from 'three/webgpu';
/** Static GLB visuals. Explicit prefab colliders remain the source of collision geometry. */
export class Assets {
    loader;
    cache = new Map();
    disposed = false;
    async staticModel(url) {
        if (this.disposed)
            throw new Error('Asset store was disposed.');
        let promise = this.cache.get(url);
        if (!promise) {
            const loaded = (this.loader ??= import('three/addons/loaders/GLTFLoader.js').then(({ GLTFLoader }) => new GLTFLoader())).then(loader => loader.loadAsync(url)).then(gltf => {
                if (gltf.animations.length)
                    console.info(`${url}: this adapter loads static visuals only.`);
                gltf.scene.traverse(o => {
                    if (o instanceof THREE.Mesh) {
                        o.castShadow = true;
                        o.receiveShadow = true;
                    }
                });
                return gltf.scene;
            }).catch(error => { this.cache.delete(url); throw error; });
            this.cache.set(url, loaded);
            promise = loaded;
        }
        const template = await promise;
        if (this.disposed)
            throw new Error('Asset store was disposed.');
        return template.clone(true);
    }
    free(root) {
        const geometries = new Set(), materials = new Set(), textures = new Set();
        root.traverse(o => {
            if (o instanceof THREE.Mesh) {
                geometries.add(o.geometry);
                for (const m of Array.isArray(o.material) ? o.material : [o.material])
                    materials.add(m);
            }
        });
        for (const m of materials) {
            for (const value of Object.values(m))
                if (value instanceof THREE.Texture)
                    textures.add(value);
            m.dispose();
        }
        for (const g of geometries)
            g.dispose();
        for (const t of textures)
            t.dispose();
    }
    dispose() {
        this.disposed = true;
        for (const promise of this.cache.values())
            void promise.then(root => this.free(root)).catch(() => { });
        this.cache.clear();
    }
}
