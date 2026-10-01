import { defaultMotor } from '../../core/motor.js';
import { createPrefabs, palette } from '../../level/prefabs.js';

const SEA_WALL = '#6f847a';
const STONE = '#bfb497';

/** Art owned by this episode. Everything else comes from the starter's prefab set. */
export function registerBreakwaterArt(prefabs) {
    prefabs.register({ id: 'parked-car', name: 'Parked car', group: 'Decor', summary: 'The car from the Coast Road, parked.', components: [], build: () => ({ body: 'fixed',
            visuals: [
                { shape: 'box', position: [0, .65, 0], scale: [2, .7, 3.8], color: '#4b8c85' },
                { shape: 'box', position: [0, 1.2, -.2], scale: [1.65, .7, 1.9], color: '#253b3a' },
                { shape: 'box', position: [0, .8, -1.94], scale: [1.65, .18, .05], color: '#e6d493' },
                ...[-1, 1].flatMap(x => [-1.2, 1.2].map(z => ({ shape: 'box', position: [x, .4, z], scale: [.25, .65, .65], color: '#202c2b' }))),
            ], colliders: [{ position: [0, .8, 0], size: [2.3, 1.6, 4] }] }) });
    prefabs.register({ id: 'container', name: 'Freight container', group: 'Structure', summary: 'Too tall to jump. Stack a crate.', components: [], build: e => ({ body: 'fixed',
            visuals: [
                { shape: 'box', position: [0, 1.1, 0], scale: [2.4, 2.2, 5], color: e.color ?? '#b87757' },
                ...[-2, -1, 0, 1, 2].map(z => ({ shape: 'box', position: [1.21, 1.1, z], scale: [.04, 2, .12], color: '#8f5b44' })),
                ...[-2, -1, 0, 1, 2].map(z => ({ shape: 'box', position: [-1.21, 1.1, z], scale: [.04, 2, .12], color: '#8f5b44' })),
            ], colliders: [{ position: [0, 1.1, 0], size: [2.4, 2.2, 5] }] }) });
    prefabs.register({ id: 'bollard', name: 'Bollard', group: 'Decor', summary: 'A mooring post.', components: [], build: () => ({ body: 'fixed',
            visuals: [{ shape: 'cylinder', position: [0, .35, 0], scale: [.22, .7, .22], color: palette.dark }, { shape: 'cylinder', position: [0, .72, 0], scale: [.3, .08, .3], color: palette.dark }],
            colliders: [{ position: [0, .4, 0], size: [.5, .8, .5] }] }) });
    prefabs.register({ id: 'lamp-sentry', name: 'Lamp sentry', group: 'Gameplay', summary: 'Sweeps a lamp; fires at what the lamp finds.', components: [], build: () => ({ body: 'fixed',
            visuals: [
                { shape: 'box', position: [0, .3, 0], scale: [.9, .6, .9], color: '#253b3a' },
                { shape: 'box', position: [0, 1.05, 0], scale: [.35, 1, .35], color: '#dac7a3' },
                { shape: 'box', position: [0, 1.65, 0], scale: [.7, .45, .6], color: '#ad5446' },
                { shape: 'box', position: [0, 1.67, .31], scale: [.42, .24, .04], color: '#ffe39a', emissive: .9 },
                { shape: 'box', position: [.3, 1.48, .42], scale: [.14, .14, .6], color: '#253b3a' },
            ], colliders: [{ position: [0, .95, 0], size: [.9, 1.9, .7] }] }) });
    prefabs.register({ id: 'beacon', name: 'Beacon lamp', group: 'Gameplay', summary: 'The lighthouse lamp room.', components: [], build: () => ({ body: 'fixed',
            visuals: [
                { shape: 'box', position: [0, .15, 0], scale: [2.2, .3, 2.2], color: palette.dark },
                ...[-1, 1].flatMap(x => [-1, 1].map(z => ({ shape: 'box', position: [x * .85, 1.25, z * .85], scale: [.12, 1.9, .12], color: palette.dark }))),
                { shape: 'box', position: [0, 1.2, 0], scale: [1.5, 1.6, 1.5], color: '#cfe4dc', opacity: .28 },
                { shape: 'sphere', position: [0, 1.2, 0], scale: [.42, .42, .42], color: '#f5e7b8', emissive: .5 },
                { shape: 'box', position: [0, 2.3, 0], scale: [2, .25, 2], color: '#ad5446' },
                { shape: 'cone', position: [0, 2.75, 0], scale: [1.1, .7, 1.1], color: '#ad5446' },
            ], colliders: [{ position: [0, 1.4, 0], size: [2, 2.8, 2] }] }) });
    prefabs.register({ id: 'boat', name: 'Harbor launch', group: 'Decor', summary: 'The boat to the handoff.', components: [], build: () => ({ body: 'fixed',
            visuals: [
                { shape: 'box', position: [0, .6, 0], scale: [2.6, 1.2, 6.5], color: '#e9e2cf' },
                { shape: 'box', position: [0, 1.25, 0], scale: [2.7, .12, 6.6], color: '#4b8c85' },
                { shape: 'box', position: [0, 1.9, .9], scale: [1.8, 1.2, 2.2], color: '#f2e7ca' },
                { shape: 'box', position: [0, 2.1, -.25], scale: [1.6, .5, .05], color: '#253b3a' },
                { shape: 'cone', position: [0, .6, -3.6], scale: [1.3, 1.2, .9], color: '#e9e2cf', rotation: [-90, 0, 0] },
            ], colliders: [{ position: [0, 1, 0], size: [2.6, 2, 6.5] }] }) });
}

/**
 * 03 / Breakwater Light. The car arrives at the harbor at dusk. Three signal cells power the
 * lighthouse lift (pickup → counter), the beacon on the roof opens the jetty gate after a
 * delay (switch → relay → door), and the boarding gate at the end of the jetty is the exit
 * (goal). Surf hazards, a shuttle platform over a gap, a jump pad to the crane deck and a
 * crate to stack on a container: the starter's own building blocks, used together.
 */
export function breakwaterLevel() {
    const prefabs = createPrefabs();
    registerBreakwaterArt(prefabs);
    const entities = [];
    const add = (type, id, p, scale = [1, 1, 1], color, rotation) => {
        const e = prefabs.create(type, p, id);
        e.scale = scale;
        if (color)
            e.color = color;
        if (rotation)
            e.rotation = rotation;
        entities.push(e);
        return e;
    };
    const set = (e, components) => { e.components = components; return e; };

    // ---- A: the quay, where the car stops.
    add('block', 'quay', [0, -.3, 6], [18, .3, 22], STONE);
    add('block', 'quay-wall', [0, -5, 6], [18, 4.7, 22], SEA_WALL);
    add('block', 'quay-back', [0, 0, 17.2], [18, 1.2, .5]);
    add('block', 'curb-w', [-8.8, 0, 6], [.4, .4, 22], SEA_WALL);
    add('block', 'curb-e', [8.8, 0, 6], [.4, .4, 22], SEA_WALL);
    add('spawn', 'start', [0, .1, 13]);
    add('parked-car', 'parked-car', [-5, 0, 12.5], [1, 1, 1], undefined, [0, 20, 0]);
    add('container', 'container-a', [5.5, 0, 4], [1, 1, 1], '#b87757');
    add('container', 'container-b', [5.5, 0, 10.5], [1, 1, 1], '#4b8c85');
    add('crate', 'crate-a', [2.4, .1, 7]);
    add('crate', 'crate-b', [-3, .1, 1.5]);
    for (const [i, x, z] of [[0, -8.2, -2], [1, -8.2, 8], [2, 8.2, -3.5], [3, 8.2, 15]])
        add('bollard', `bollard-${i}`, [x, 0, z]);
    for (let i = 0; i < 4; i++)
        add('block', `lane-${i}`, [0, -.035, 9 - i * 4], [.1, .05, 1.5], '#efcf75');
    add('pickup', 'cell-container', [5.5, 2.2, 3]);
    add('lamp-sentry', 'lamp-a', [-5.5, 0, -2], [1, 1, 1], undefined, [0, 90, 0]);

    // ---- B: the causeway, swept by surf.
    add('block', 'causeway', [0, -.3, -17], [4, .3, 24], STONE);
    add('block', 'causeway-wall', [0, -5, -17], [4, 4.7, 24], SEA_WALL);
    set(add('checkpoint', 'cp-causeway', [0, 0, -6.5]), [{ type: 'checkpoint', message: 'Checkpoint: the causeway' }]);
    const surf = [{ type: 'hazard', message: 'The surf knocked you back to the checkpoint.' }];
    set(add('hazard', 'surf-1', [-1, 0, -10.5], [1, 1, 1], '#7fb7bd'), surf);
    set(add('hazard', 'surf-2', [1, 0, -14.5], [1, 1, 1], '#7fb7bd'), surf);
    set(add('hazard', 'surf-3', [-1, 0, -19.5], [1, 1, 1], '#7fb7bd'), surf);
    set(add('hazard', 'surf-4', [1, 0, -24], [1, 1, 1], '#7fb7bd'), surf);
    add('pickup', 'cell-causeway', [-1, 0, -14.5]);

    // ---- C: the gap, crossed on a shuttle platform.
    set(add('platform', 'shuttle', [0, -.3, -33.5]), [{ type: 'mover', axis: 'z', distance: 3, period: 7 }]);

    // ---- D: the island and the lighthouse.
    add('block', 'island', [0, -.3, -46], [20, .3, 22], STONE);
    add('block', 'island-wall', [0, -5, -46], [20, 4.7, 22], SEA_WALL);
    set(add('checkpoint', 'cp-island', [0, 0, -37.2]), [{ type: 'checkpoint', message: 'Checkpoint: the island' }]);
    add('block', 'tower-s', [0, 0, -44.3], [6, 7, .6], palette.pale);
    add('block', 'tower-n', [0, 0, -49.7], [6, 7, .6], palette.pale);
    add('block', 'tower-w', [-2.7, 0, -47], [.6, 7, 4.8], palette.pale);
    add('block', 'tower-e', [2.7, 0, -47], [.6, 7, 4.8], palette.pale);
    add('block', 'tower-band', [0, 3.2, -44.3], [6.12, .6, .66], '#ad5446');
    add('block', 'tower-roof', [0, 7, -47], [7, .3, 7], palette.dark);
    add('block', 'roof-rail-n', [0, 7.3, -50.35], [7, .5, .2], palette.dark);
    add('block', 'roof-rail-s', [0, 7.3, -43.65], [7, .5, .2], palette.dark);
    add('block', 'roof-rail-w', [-3.4, 7.3, -47], [.2, .5, 6.5], palette.dark);
    add('beacon', 'beacon', [0, 7.3, -47.8]);
    set(add('switch', 'beacon-switch', [1.7, 7.3, -45.1], [1, 1, 1], '#ffd27a'), [{ type: 'beacon-switch' }]);
    set(add('checkpoint', 'cp-roof', [-1.7, 7.3, -45.1]), [{ type: 'checkpoint', message: 'Checkpoint: the lamp room roof' }]);
    // The service lift: dead until three cells power it, then it cycles up to the roof.
    set(add('platform', 'lift', [5.1, -.3, -47], [1, 1, 1], '#253b3a'), [{ type: 'mover', axis: 'y', distance: 7.3, period: 9, channel: 'power' }]);
    add('block', 'lift-mast', [6.75, 0, -47], [.3, 8, .3], palette.dark);
    // The crane deck: a jump pad up, a cell on top.
    add('column', 'crane-leg-a', [-7.8, 0, -42.3]);
    add('column', 'crane-leg-b', [-5.2, 0, -39.7]);
    add('block', 'crane-deck', [-6.5, 3, -41], [3.4, .3, 3.4], '#e4c789');
    add('block', 'crane-arm', [-6.5, 3.3, -44.2], [.4, .4, 3.4], '#e4c789');
    add('pad', 'crane-pad', [-6.5, 0, -36.9]);
    add('pickup', 'cell-crane', [-6.5, 3.3, -41]);
    add('lamp-sentry', 'lamp-b', [7, 0, -38.5], [1, 1, 1], undefined, [0, -70, 0]);
    add('lamp-sentry', 'lamp-c', [-6, 0, -53.5], [1, 1, 1], undefined, [0, 130, 0]);
    add('crate', 'crate-c', [-2, .1, -54]);
    add('tree', 'island-tree', [7.5, 0, -54.5], [1, 1, 1], '#5f8059');
    add('rock', 'island-rock-a', [-8.6, 0, -47], [1.4, 1.2, 1.6]);
    add('rock', 'island-rock-b', [8.7, 0, -42], [1.2, 1, 1.1]);
    // Signal logic that lives on no visible object (the trigger prefab is editor-only art).
    set(add('trigger', 'power-counter', [9, -3.5, -56]), [{ type: 'counter', channel: 'cell', count: 3, output: 'power' }]);
    set(add('trigger', 'dock-relay', [6, -3.5, -56]), [{ type: 'relay', channel: 'lamp', output: 'dock', delay: 1.5 }]);

    // ---- E: the jetty, the gate and the boat.
    add('block', 'jetty', [0, -.3, -63], [4, .3, 12], STONE);
    add('block', 'jetty-wall', [0, -5, -63], [4, 4.7, 12], SEA_WALL);
    set(add('door', 'jetty-gate', [0, 0, -59], [1.4, 1, 1]), [{ type: 'door', channel: 'dock', distance: 3.6, speed: 2.2, axis: 'y' }]);
    add('block', 'gate-post-w', [-2.15, 0, -59], [.5, 4, .7], palette.stone);
    add('block', 'gate-post-e', [2.15, 0, -59], [.5, 4, .7], palette.stone);
    set(add('goal', 'boarding-gate', [0, 0, -66.5]), [{ type: 'goal', channel: 'dock', requiresSignal: true, message: 'Boarding the launch.' }]);
    add('bollard', 'bollard-jetty', [-1.6, 0, -68.5]);
    add('boat', 'launch', [4.2, -5.3, -64.5], [1, 1, 1], undefined, [0, 8, 0]);

    return { version: 1, name: 'Breakwater Light', description: 'A first-person episode built from the starter\'s signal blocks.', objective: 'Power the lighthouse lift. Light the beacon. Board the launch.', seed: 73,
        environment: { sky: '#d9cdb4', fog: .0075, sun: 2.6, exposure: 1.02, backdrop: true }, player: { ...defaultMotor, headBob: .2 }, entities };
}
