export const palette = { stone: '#e5d7bd', teal: '#50cbb2' };
const part = (shape, position, scale, color, extra = {}) => ({ shape, position, scale, color, ...extra });
const box = (position, scale, color) => part('box', position, scale, color);
const collider = (position, size, sensor = false) => ({ position, size, sensor });
export class Prefabs {
    items = new Map();
    register(prefab) {
        if (this.items.has(prefab.id))
            throw new Error(`Prefab already registered: ${prefab.id}`);
        this.items.set(prefab.id, prefab);
    }
    get(id) {
        const p = this.items.get(id);
        if (!p)
            throw new Error(`Unknown prefab: ${id}`);
        return p;
    }
    all() { return [...this.items.values()]; }
    get ids() { return new Set(this.items.keys()); }
    create(prefab, position, id) {
        const p = this.get(prefab);
        return { id, prefab, name: p.name, position: [...position], rotation: [0, 0, 0], scale: [1, 1, 1], components: structuredClone(p.components) };
    }
}
/** The structural block and the player start. The episode registers its own vehicles, officers, and station. */
export function createPrefabs() {
    const r = new Prefabs();
    const add = (id, name, group, summary, components, build) => r.register({ id, name, group, summary, components, build });
    add('block', 'Stone block', 'Structure', 'Solid modular block. Scale to make floors and walls.', [], e => ({ body: 'fixed', visuals: [box([0, .5, 0], [1, 1, 1], e.color ?? palette.stone)], colliders: [collider([0, .5, 0], [1, 1, 1])] }));
    add('spawn', 'Player start', 'Gameplay', 'Exactly one start is required per level.', [{ type: 'spawn', yaw: 0 }], () => ({ body: 'fixed', editorOnly: true, visuals: [part('ring', [0, .07, 0], [.65, .65, .65], palette.teal, { rotation: [90, 0, 0] }), part('cone', [0, .4, -.55], [.2, .6, .2], palette.teal, { rotation: [-90, 0, 0] })], colliders: [] }));
    return r;
}
