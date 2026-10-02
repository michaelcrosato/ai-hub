/**
 * Static GLB visuals (assets/name.glb next to the page). Explicit prefab colliders remain
 * the source of collision geometry. The glTF loader is only fetched when a level uses a model.
 */
export class Assets {
    loader = null;
    cache = new Map();
    async #gltf() {
        if (!this.loader) {
            const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
            this.loader ??= new GLTFLoader();
        }
        return this.loader;
    }
    async staticModel(url) {
        let promise = this.cache.get(url);
        if (!promise) {
            const loaded = this.#gltf().then(loader => loader.loadAsync(url)).then(gltf => {
                if (gltf.animations.length)
                    console.info(`${url}: this adapter loads static visuals only.`);
                gltf.scene.traverse(o => {
                    if (o.isMesh) {
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
        return template.clone(true);
    }
}
