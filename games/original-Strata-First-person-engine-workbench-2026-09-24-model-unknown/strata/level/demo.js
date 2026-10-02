import { random } from '../core/math.js';
import { defaultMotor } from '../core/motor.js';
import { createPrefabs } from './prefabs.js';
/** All visible level objects are normal editable prefabs, not a hard-coded runtime scene. */
export function demoLevel() {
    const prefabs = createPrefabs(), entities = [];
    const add = (prefab, id, position, scale = [1, 1, 1], extra = {}) => {
        const e = Object.assign(prefabs.create(prefab, position, id), { scale }, extra);
        entities.push(e);
        return e;
    };
    add('block', 'island', [0, -1.9, 0], [34, 1.8, 30], { name: 'Island · foundation', color: '#718571' });
    add('block', 'grass', [0, -.16, 0], [33.7, .16, 29.7], { name: 'Meadow · floor', color: '#93a77a' });
    add('block', 'courtyard', [0, 0, 0], [17, .12, 18], { name: 'Courtyard · limestone', color: '#d2c9ab' });
    for (let i = 0; i < 8; i++)
        add('block', `path-${i}`, [0, .13, 11.8 - i * 2.35], [2.5, .07, 1.95], { name: `Path slab ${i + 1}`, color: '#e8ddc3' });
    add('spawn', 'player-start', [0, .25, 11.4]);
    add('checkpoint', 'start-checkpoint', [0, .2, 8.3]);
    add('switch', 'gate-switch', [-3.4, .12, 1.8], [1, 1, 1], { name: '01 · Gate switch' });
    add('door', 'main-door', [0, .12, -5.5], [1, 1, 1], { name: '02 · Signal door' });
    add('goal', 'exit', [0, .12, -6.3], [1, 1, 1], { name: '03 · Exit gate' });
    add('block', 'gate-left', [-4.8, .12, -5.5], [6.3, 3.6, .7], { name: 'West gate wall' });
    add('block', 'gate-right', [4.8, .12, -5.5], [6.3, 3.6, .7], { name: 'East gate wall' });
    for (const x of [-7.6, 7.6])
        for (const z of [-4.8, 4.7])
            add('column', `column-${x}-${z}`, [x, .12, z], [1, 1.25, 1]);
    add('block', 'lintel-left', [-7.6, 4.05, 0], [1, .4, 10.8]);
    add('block', 'lintel-right', [7.6, 4.05, 0], [1, .4, 10.8]);
    add('block', 'upper-deck', [10, 2, -5], [5, .35, 6], { name: 'Platform test · upper deck' });
    add('platform', 'lift', [10, .12, 1.3], [1, 1, 1], { name: 'Lift · vertical motion', components: [{ type: 'mover', axis: 'y', distance: 2, period: 6 }] });
    add('stairs', 'test-stairs', [-10, .02, 3], [1, 1, 1], { name: 'Step test' });
    add('block', 'step-deck', [-10, 1.5, -1], [3, .25, 3], { name: 'Step test · landing' });
    add('block', 'ramp', [5, .2, 5], [2, .25, 4], { name: 'Slope test · 18 degrees', rotation: [18, 0, 0] });
    for (let i = 0; i < 3; i++)
        add('crate', `crate-${i}`, [3.8 + (i % 2) * 1.3, .2 + Math.floor(i / 2) * 1.2, 1.2], [1, 1, 1], { name: `Physics crate ${i + 1}` });
    add('pickup', 'cell-1', [-10, 1.75, -1], [1, 1, 1], { name: 'Cell · step test' });
    add('pickup', 'cell-2', [10, 2.4, -5], [1, 1, 1], { name: 'Cell · lift test' });
    add('pad', 'jump-pad', [-5, .14, 5.3]);
    add('hazard', 'hazard-test', [11, .02, 8], [1.4, 1, 1.4]);
    // Border stones give the island a readable edge, without blocking all exploration.
    for (let i = 0; i < 9; i++) {
        add('block', `edge-back-${i}`, [-15 + i * 3.75, -.1, -14.4], [3.55, .48, .45], { color: '#a8b199', name: 'Boundary stone' });
        add('block', `edge-front-${i}`, [-15 + i * 3.75, -.1, 14.4], [3.55, .48, .45], { color: '#a8b199', name: 'Boundary stone' });
    }
    const rng = random(27);
    const trees = [[-13, 0, -9], [-14, 0, -4], [-13, 0, 8], [-9, 0, 11], [13, 0, -10], [14, 0, -1], [14, 0, 11], [6, 0, 12], [-5, 0, -11], [7, 0, -11]];
    trees.forEach((pos, i) => { const size = .85 + rng() * .45; add('tree', `tree-${i}`, pos, [size, size, size], { rotation: [0, rng() * 360, 0] }); });
    for (let i = 0; i < 18; i++) {
        const side = i % 2 ? -1 : 1, size = .4 + rng() * .65;
        add('rock', `rock-${i}`, [side * (11 + rng() * 4.4), 0, -12 + rng() * 24], [size, size, size], { rotation: [0, rng() * 360, 0] });
    }
    return { version: 1, name: 'The signal yard', description: 'A small place to test big ideas. Activate the switch. Open the gate. Try the movement lab.', objective: 'Find the switch. Open the gate.', seed: 27,
        environment: { sky: '#c5d7d0', fog: .008, sun: 3.1, exposure: 1.05, backdrop: true }, player: { ...defaultMotor }, entities };
}
