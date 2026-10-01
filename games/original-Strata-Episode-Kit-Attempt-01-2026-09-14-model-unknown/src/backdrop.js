import { RenderWorld } from './engine/RenderWorld.js';
import { createPrefabs } from './level/prefabs.js';
import { builtinSchemas, validateLevel } from './level/schema.js';
import { warmUp } from './warmup.js';

/**
 * The view behind the collection and the handoff: an episode's level drawn as a diorama
 * (its own prefabs and art, no physics, no rules) with a slow orbiting camera. A diorama
 * loads its level module on first use.
 */
const DIORAMAS = {
    breakwater: {
        load: () => import('./episodes/breakwater/level.js'),
        art: m => m.registerBreakwaterArt, level: m => m.breakwaterLevel, local: ['beacon-switch'],
        center: [0, 0, -30], radius: 52, height: 22, extent: 46, decor: -26,
    },
};

export function createBackdrop(kit, sun) {
    const built = new Map();
    let current = null, angle = .7, wanted = null;

    async function build(name) {
        const def = DIORAMAS[name];
        const mod = await def.load();
        const view = new RenderWorld(kit, sun);
        const prefabs = createPrefabs();
        def.art(mod)(prefabs);
        const schemas = builtinSchemas();
        for (const type of def.local)
            schemas.register(type, () => { });
        const data = validateLevel(def.level(mod)(), prefabs.ids, schemas);
        const roots = new Map();
        for (const e of data.entities)
            roots.set(e.id, view.create(e, prefabs.get(e.prefab).build(e), true));
        view.bakeStatic(data.entities.map(e => ({ data: e, root: roots.get(e.id), moving: false })));
        view.environment(data.environment);
        view.shadowExtent = def.extent;
        view.shadowCenter.set(def.center[0], 0, def.center[2]);
        if (def.decor !== undefined)
            view.decorative.position.z = def.decor;
        view.camera.fov = 50;
        view.camera.far = 600;
        view.camera.updateProjectionMatrix();
        const entry = { def, view, roots, beam: null };
        if (name === 'breakwater') {
            const { BeaconBeam } = await import('./episodes/breakwater/local-ai.js');
            entry.beam = new BeaconBeam(roots.get('beacon'));
        }
        view.activate();
        view.scene.updateMatrixWorld(true);
        place(entry, 0);
        await warmUp(kit.renderer, view.scene, view.camera);
        return entry;
    }

    function place(entry, dt) {
        const { center, radius, height } = entry.def;
        angle += dt * .045;
        const cam = entry.view.camera;
        cam.position.set(center[0] + Math.sin(angle) * radius, height, center[2] + Math.cos(angle) * radius);
        cam.lookAt(center[0], 1.5, center[2]);
        entry.beam?.render(dt);
    }

    return {
        /** Show this diorama (built on first use). `lit` turns the breakwater beacon on. */
        async use(name, { lit = false } = {}) {
            wanted = name;
            let entry = built.get(name);
            if (!entry) {
                const promise = build(name);
                built.set(name, promise);
                entry = await promise;
                built.set(name, entry);
            }
            else if (entry instanceof Promise)
                entry = await entry;
            if (lit)
                entry.beam?.light();
            else
                entry.beam?.dark();
            if (wanted === name)
                current = entry;
            return entry;
        },
        frame(dt) {
            if (!current)
                return;
            place(current, dt);
            current.view.draw();
        },
    };
}
