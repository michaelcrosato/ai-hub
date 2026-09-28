import { defaultMotor } from '../../core/motor.js';
import { createPrefabs } from '../../level/prefabs.js';
export function registerYardArt(prefabs) {
    prefabs.register({ id: 'sentry', name: 'Local sentry', group: 'Gameplay', summary: 'An actor owned by this episode.', components: [], build: () => ({ body: 'fixed',
            visuals: [
                { shape: 'box', position: [0, .65, 0], scale: [.75, 1.3, .55], color: '#ad5446' },
                { shape: 'box', position: [0, 1.55, 0], scale: [.6, .5, .55], color: '#dac7a3' },
                { shape: 'box', position: [0, 1.58, .29], scale: [.45, .12, .04], color: '#253b3a' },
                { shape: 'box', position: [.35, 1, .4], scale: [.18, .18, .65], color: '#253b3a' },
            ], colliders: [{ position: [0, .9, 0], size: [.85, 1.8, .65] }] }) });
    prefabs.register({ id: 'car', name: 'Escape car', group: 'Gameplay', summary: 'Use this object to load the driving page.', components: [{ type: 'board-car' }], build: () => ({ body: 'fixed',
            visuals: [
                { shape: 'box', position: [0, .65, 0], scale: [2, .7, 3.8], color: '#4b8c85' },
                { shape: 'box', position: [0, 1.2, -.2], scale: [1.65, .7, 1.9], color: '#253b3a' },
                ...[-1, 1].flatMap(x => [-1.2, 1.2].map(z => ({ shape: 'box', position: [x, .4, z], scale: [.25, .65, .65], color: '#202c2b' }))),
            ], colliders: [{ position: [0, .8, 0], size: [2.3, 1.6, 4] }] }) });
}
export function yardLevel() {
    const prefabs = createPrefabs();
    registerYardArt(prefabs);
    const entities = [];
    const add = (type, id, p, scale = [1, 1, 1], color) => {
        const e = prefabs.create(type, p, id);
        e.scale = scale;
        if (color)
            e.color = color;
        entities.push(e);
        return e;
    };
    add('block', 'floor', [0, -.3, -1], [25, .3, 43], '#bfb497');
    add('block', 'left-wall', [-12, 0, -1], [.6, 4, 34]);
    add('block', 'right-wall', [12, 0, -1], [.6, 4, 34]);
    add('block', 'rear-wall', [0, 0, 16], [24, 4, .6]);
    add('block', 'gate-left', [-7, 0, -14], [10, 4, .6]);
    add('block', 'gate-right', [7, 0, -14], [10, 4, .6]);
    const gate = add('door', 'escape-door', [0, 0, -14], [1.4, 1, 1]);
    gate.components = [{ type: 'door', channel: 'clear', distance: 3.6, speed: 2.2, axis: 'y' }];
    add('spawn', 'start', [0, .1, 12]);
    add('block', 'cover-a', [-4, 0, 5], [4, 1.25, 1.8], '#6f847a');
    add('block', 'cover-b', [3, 0, -1], [3.5, 1.25, 1.8], '#6f847a');
    add('block', 'cover-c', [-3, 0, -7], [3.5, 1.3, 1.8], '#6f847a');
    add('crate', 'crate-a', [7, .1, 8]);
    add('crate', 'crate-b', [-7, .1, 0]);
    add('stairs', 'steps', [-8, 0, 9]);
    add('block', 'step-deck', [-8, 1.5, 4.6], [3, .2, 2.6]);
    add('block', 'crouch-roof', [8, 1.4, 11.5], [4, .2, 2]);
    add('sentry', 'guard-a', [5, 0, 5]);
    add('sentry', 'guard-b', [-5, 0, -3]);
    add('sentry', 'guard-c', [4, 0, -10]);
    add('car', 'escape-car', [0, 0, -19]);
    for (let i = 0; i < 7; i++)
        add('block', `lane-${i}`, [0, .01, 11 - i * 4], [.1, .015, 1.5], '#efcf75');
    return { version: 1, name: 'Loading Bay', description: 'A small FPS episode with local sentry rules.', objective: 'Clear three sentries. Reach the car. Press E to drive.', seed: 41,
        environment: { sky: '#c6d7d2', fog: .009, sun: 2.8, exposure: 1.05, backdrop: false }, player: { ...defaultMotor, headBob: .2 }, entities };
}
