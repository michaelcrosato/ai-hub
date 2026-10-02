export const palette = { stone: '#e5d7bd', dark: '#394943', grass: '#739b68', teal: '#50cbb2', orange: '#eaa16b', trunk: '#786950', leaf: '#63835b', pale: '#f2e7ca' };
const part = (shape, position, scale, color, extra = {}) => ({ shape, position, scale, color, ...extra });
const box = (position, scale, color) => part('box', position, scale, color);
const collider = (position, size, sensor = false) => ({ position, size, sensor });
/** Eight random hex digits. crypto.randomUUID only exists on secure (https / localhost) pages. */
export function shortId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID)
        return crypto.randomUUID().slice(0, 8);
    return Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
}
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
    create(prefab, position, id = `${prefab}-${shortId()}`) {
        const p = this.get(prefab);
        return { id, prefab, name: p.name, position: [...position], rotation: [0, 0, 0], scale: [1, 1, 1], components: structuredClone(p.components) };
    }
}
export function createPrefabs() {
    const r = new Prefabs();
    const add = (id, name, group, summary, components, build) => r.register({ id, name, group, summary, components, build });
    add('block', 'Stone block', 'Structure', 'Solid modular block. Scale to make floors and walls.', [], e => ({ body: 'fixed', visuals: [box([0, .5, 0], [1, 1, 1], e.color ?? palette.stone)], colliders: [collider([0, .5, 0], [1, 1, 1])] }));
    add('column', 'Stone column', 'Structure', 'A solid pillar with a cap and a foot.', [], e => ({ body: 'fixed', visuals: [box([0, .15, 0], [1.2, .3, 1.2], palette.dark), box([0, 1.6, 0], [.8, 2.6, .8], e.color ?? palette.stone), box([0, 3, 0], [1.3, .3, 1.3], palette.stone)], colliders: [collider([0, 1.6, 0], [1.2, 3.2, 1.2])] }));
    add('stairs', 'Stairs', 'Structure', 'Six 0.25 m steps. Tests automatic step climbing.', [], e => ({ body: 'fixed', visuals: Array.from({ length: 6 }, (_, i) => box([0, (i + 1) * .125, -i * .5], [2, (i + 1) * .25, .5], e.color ?? palette.stone)), colliders: Array.from({ length: 6 }, (_, i) => collider([0, (i + 1) * .125, -i * .5], [2, (i + 1) * .25, .5])) }));
    add('crate', 'Physics crate', 'Gameplay', 'Push, carry, drop, or throw a rigid body.', [], e => ({ body: 'dynamic', visuals: [box([0, .55, 0], [1.1, 1.1, 1.1], e.color ?? palette.orange), box([0, .55, .556], [.13, 1.05, .025], palette.dark), box([0, .55, -.556], [.13, 1.05, .025], palette.dark), box([0, 1.106, 0], [.13, .025, 1.1], palette.dark)], colliders: [collider([0, .55, 0], [1.1, 1.1, 1.1])] }));
    add('switch', 'Signal switch', 'Gameplay', 'Press E. Sends a true or false channel value.', [{ type: 'switch', channel: 'gate', label: 'Activate gate' }], e => ({ body: 'fixed', visuals: [box([0, .1, 0], [.9, .2, .9], palette.dark), box([0, .65, 0], [.5, 1, .5], palette.stone), box([0, 1.25, 0], [.85, .35, .65], e.color ?? palette.teal), part('sphere', [0, 1.48, 0], [.18, .18, .18], palette.pale, { emissive: .8 })], colliders: [collider([0, .75, 0], [.9, 1.5, .9])] }));
    // The plate: a low solid slab you can stand on, a top that sinks while pressed, and a sensor above it.
    add('plate', 'Pressure plate', 'Gameplay', 'Held down by the player or a crate. Sends its channel while pressed.', [{ type: 'plate', channel: 'plate', once: false }], e => ({ body: 'fixed', visuals: [box([0, .06, 0], [2, .12, 2], palette.dark), box([0, .15, 0], [1.6, .08, 1.6], e.color ?? palette.orange), part('ring', [0, .13, 0], [.95, .95, .95], palette.pale, { rotation: [90, 0, 0], emissive: .3 })], colliders: [collider([0, .06, 0], [2, .12, 2]), collider([0, .5, 0], [1.7, .7, 1.7], true)] }));
    add('door', 'Signal door', 'Gameplay', 'Moves on a local axis when its channel is active.', [{ type: 'door', channel: 'gate', distance: 3.6, speed: 2, axis: 'y' }], e => ({ body: 'kinematic', visuals: [box([0, 1.5, 0], [2.7, 3, .45], e.color ?? palette.dark), box([0, 1.5, .24], [.12, 2.8, .025], palette.teal), box([0, 2.65, .24], [2.4, .12, .025], palette.teal)], colliders: [collider([0, 1.5, 0], [2.7, 3, .45])] }));
    add('platform', 'Moving platform', 'Gameplay', 'A moving surface. Supports player transport.', [{ type: 'mover', axis: 'y', distance: 3, period: 5 }], e => ({ body: 'kinematic', visuals: [box([0, .15, 0], [3, .3, 3], e.color ?? palette.dark), box([0, .32, 0], [2.8, .04, 2.8], palette.teal)], colliders: [collider([0, .15, 0], [3, .3, 3])] }));
    add('trigger', 'Trigger volume', 'Gameplay', 'Sends a channel value on entry and exit.', [{ type: 'trigger', channel: 'zone', once: false }], e => ({ body: 'fixed', editorOnly: true, visuals: [part('box', [0, 1, 0], [2, 2, 2], e.color ?? palette.teal, { opacity: .18 })], colliders: [collider([0, 1, 0], [2, 2, 2], true)] }));
    add('pickup', 'Signal cell', 'Gameplay', 'Collect a cell to send a channel signal.', [{ type: 'pickup', channel: 'cell', label: 'Collect signal cell' }], e => ({ body: 'fixed', visuals: [part('rock', [0, 1, 0], [.33, .55, .33], e.color ?? palette.teal, { emissive: .45 }), part('ring', [0, .04, 0], [.55, .55, .55], palette.dark, { rotation: [90, 0, 0] })], colliders: [collider([0, 1, 0], [.7, 1.3, .7], true)] }));
    add('checkpoint', 'Checkpoint', 'Gameplay', 'Sets the player return point on entry.', [{ type: 'checkpoint', message: 'Checkpoint saved' }], e => ({ body: 'fixed', visuals: [box([0, .03, 0], [1.8, .06, 1.8], palette.dark), part('ring', [0, .08, 0], [.65, .65, .65], e.color ?? palette.teal, { rotation: [90, 0, 0], emissive: .4 })], colliders: [collider([0, .06, 0], [1.8, .12, 1.8]), collider([0, .8, 0], [1.8, 1.4, 1.8], true)] }));
    add('pad', 'Jump pad', 'Gameplay', 'Adds a controlled upward launch.', [{ type: 'pad', launchSpeed: 14 }], e => ({ body: 'fixed', visuals: [box([0, .08, 0], [2, .16, 2], palette.dark), part('cylinder', [0, .19, 0], [.75, .12, .75], e.color ?? palette.orange), part('ring', [0, .27, 0], [.48, .48, .48], palette.pale, { rotation: [90, 0, 0] })], colliders: [collider([0, .08, 0], [2, .16, 2]), collider([0, .4, 0], [1.8, .5, 1.8], true)] }));
    add('hazard', 'Hazard field', 'Gameplay', 'Returns the player to the checkpoint.', [{ type: 'hazard' }], e => ({ body: 'fixed', visuals: [box([0, .025, 0], [2, .05, 2], e.color ?? '#ce765e'), part('cone', [0, .3, 0], [.25, .5, .25], palette.dark)], colliders: [collider([0, .3, 0], [2, .6, 2], true)] }));
    add('goal', 'Exit gate', 'Gameplay', 'Completes the test when its channel is active.', [{ type: 'goal', channel: 'gate', requiresSignal: true, message: 'Test complete. Build what comes next.' }], e => ({ body: 'fixed', visuals: [box([-1.6, 2, 0], [.55, 4, .7], palette.stone), box([1.6, 2, 0], [.55, 4, .7], palette.stone), box([0, 4.05, 0], [3.8, .5, .9], palette.stone), part('box', [0, 1.95, 0], [2.7, 3.8, .05], e.color ?? palette.teal, { opacity: .18, emissive: .3 })], colliders: [collider([-1.6, 2, 0], [.55, 4, .7]), collider([1.6, 2, 0], [.55, 4, .7]), collider([0, 4.05, 0], [3.8, .5, .9]), collider([0, 1.5, 0], [2.6, 3, 1.1], true)] }));
    add('tree', 'Low-poly tree', 'Nature', 'Faceted foliage and a solid trunk.', [], e => ({ body: 'fixed', visuals: [part('cylinder', [0, 1, 0], [.23, 2, .23], palette.trunk), part('rock', [0, 2.65, 0], [1.6, 1.9, 1.6], e.color ?? palette.leaf), part('rock', [.6, 3.1, .3], [1.05, 1.3, 1.05], '#88a374')], colliders: [collider([0, 1, 0], [.48, 2, .48])] }));
    add('rock', 'Faceted rock', 'Nature', 'Decorative rock with a simple box collider.', [], e => ({ body: 'fixed', visuals: [part('rock', [0, .48, 0], [.9, .7, .8], e.color ?? '#91a18c')], colliders: [collider([0, .4, 0], [1.2, .8, 1.1])] }));
    add('spawn', 'Player start', 'Gameplay', 'Exactly one start is required per level.', [{ type: 'spawn', yaw: 0 }], () => ({ body: 'fixed', editorOnly: true, visuals: [part('ring', [0, .07, 0], [.65, .65, .65], palette.teal, { rotation: [90, 0, 0] }), part('cone', [0, .4, -.55], [.2, .6, .2], palette.teal, { rotation: [-90, 0, 0] })], colliders: [] }));
    return r;
}
