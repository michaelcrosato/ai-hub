import { random } from '../core/math.js';
import { defaultMotor } from '../core/motor.js';
import { createPrefabs } from './prefabs.js';
/**
 * Sandbox 02. Built only from the workbench's own prefabs and signal parts, so every
 * object here can be selected, moved and rewired in the editor like the signal yard.
 *
 *   plate (crate on it) ──► plate door
 *   3 × cell ──► counter ──► "cells" ─┐
 *   uplink switch ──► relay 2.5 s ──► "uplink-late" ─┴► logic (all) ──► "exit" ──► exit door + gate
 *   bridge wake zone (trigger, once) ──► sliding bridge
 */
export function quarryLevel() {
    const prefabs = createPrefabs(), entities = [];
    const add = (prefab, id, position, scale = [1, 1, 1], extra = {}) => {
        const e = Object.assign(prefabs.create(prefab, position, id), { scale }, extra);
        entities.push(e);
        return e;
    };
    const wall = '#c9bfa2', gravel = '#a3ab8a', bed = '#6f7f6c';
    // Ground: the main quarry floor (x -16..16, z -28..16) and an outcrop east of a gap.
    add('block', 'quarry-bed', [0, -1.9, -6], [32, 1.8, 44], { name: 'Quarry · foundation', color: bed });
    add('block', 'quarry-floor', [0, -.16, -6], [31.7, .16, 43.7], { name: 'Quarry · gravel floor', color: gravel });
    add('block', 'outcrop-bed', [27, -1.9, -6], [8, 1.8, 8], { name: 'Outcrop · foundation', color: bed });
    add('block', 'outcrop-floor', [27, -.16, -6], [7.8, .16, 7.8], { name: 'Outcrop · floor', color: gravel });
    // 01 · Arrival. The plate door only stays open while something heavy sits on the plate.
    add('block', 'arrival-court', [0, 0, 10], [12, .1, 11], { name: 'Arrival · limestone court', color: '#d2c9ab' });
    add('spawn', 'player-start', [0, .2, 13.5]);
    add('checkpoint', 'arrival-checkpoint', [0, .1, 10.6], [1, 1, 1], { name: 'Arrival checkpoint' });
    add('plate', 'crate-plate', [-12, 0, 13], [1, 1, 1], { name: '01 · Pressure plate', components: [{ type: 'plate', channel: 'plate', once: false, label: 'Plate door' }] });
    for (let i = 0; i < 4; i++)
        add('block', `plate-path-${i}`, [-7.4 - i * 1.25, .02, 12.2 + i * .25], [1, .05, .9], { name: `Plate path ${i + 1}`, color: '#e8ddc3' });
    for (let i = 0; i < 3; i++)
        add('crate', `crate-${i}`, [9 + (i % 2) * 1.3, .1 + Math.floor(i / 2) * 1.15, 9.5 - Math.floor(i / 2) * .1], [1, 1, 1], { name: `Physics crate ${i + 1}` });
    add('block', 'plate-wall-west', [-8.675, 0, 4], [14.65, 4.2, .7], { name: 'Plate wall · west', color: wall });
    add('block', 'plate-wall-east', [8.675, 0, 4], [14.65, 4.2, .7], { name: 'Plate wall · east', color: wall });
    add('door', 'plate-door', [0, 0, 4], [1, 1, 1], { name: '02 · Plate door', components: [{ type: 'door', channel: 'plate', distance: 3.8, speed: 2.6, axis: 'y' }] });
    // 02 · The terraces: three signal cells, three different tests.
    add('checkpoint', 'terrace-checkpoint', [0, 0, 1.4], [1, 1, 1], { name: 'Terrace checkpoint' });
    for (const x of [-3.2, 3.2])
        add('column', `door-column-${x}`, [x, 0, 2.6], [1, 1.25, 1], { name: 'Gate column' });
    // West: a jump pad throws you onto a high ledge.
    add('block', 'pad-ledge', [-12.5, 0, -6], [6, 3.2, 6], { name: 'Pad ledge · 3.2 m', color: '#b9b496' });
    add('pad', 'ledge-pad', [-6.5, 0, -6], [1, 1, 1], { name: 'Jump pad · ledge' });
    add('pickup', 'cell-ledge', [-13, 3.2, -6], [1, 1, 1], { name: 'Cell · pad ledge' });
    add('rock', 'ledge-rock', [-14.4, 3.2, -8], [.8, .8, .8], { rotation: [0, 40, 0] });
    // East: the bridge wakes when you walk up to the edge, then slides across the gap.
    add('trigger', 'bridge-wake', [14.3, 0, -6], [1.5, 1.5, 3], { name: 'Bridge wake zone', components: [{ type: 'trigger', channel: 'bridge', once: true }] });
    add('platform', 'bridge', [17.5, -.3, -6], [1, 1, 1], { name: '03 · Sliding bridge', components: [{ type: 'mover', axis: 'x', distance: 4, period: 7, channel: 'bridge' }] });
    add('pickup', 'cell-outcrop', [28.5, 0, -6], [1, 1, 1], { name: 'Cell · outcrop' });
    add('hazard', 'outcrop-sweeper', [27, .02, -9.2], [3.6, 1, .5], { name: 'Sweeper · timed hazard', components: [{ type: 'hazard' }, { type: 'mover', axis: 'z', distance: 6.4, period: 4.5 }] });
    // North-west: stairs, a landing and three stepping stones, each 0.85 m higher.
    add('stairs', 'climb-stairs', [-10, 0, -11], [1, 1, 1], { name: 'Climb · stairs' });
    add('block', 'climb-landing', [-10, 1.5, -15.25], [3, .25, 3], { name: 'Climb · landing' });
    add('block', 'stone-1', [-6.6, 0, -15.6], [1.6, 2.6, 1.6], { name: 'Stepping stone · 2.6 m', color: '#d8cfb2' });
    add('block', 'stone-2', [-3.9, 0, -17.4], [1.6, 3.45, 1.6], { name: 'Stepping stone · 3.45 m', color: '#d8cfb2' });
    add('block', 'stone-3', [-1.2, 0, -19.2], [1.8, 4.3, 1.8], { name: 'Stepping stone · 4.3 m', color: '#d8cfb2' });
    add('pickup', 'cell-stone', [-1.2, 4.3, -19.2], [1, 1, 1], { name: 'Cell · stone climb' });
    // 03 · Relay yard: a lift to the uplink deck.
    add('platform', 'relay-lift', [9, 0, -19], [1, 1, 1], { name: '04 · Relay lift', components: [{ type: 'mover', axis: 'y', distance: 3.3, period: 6 }] });
    add('block', 'uplink-deck', [13, 3.3, -19], [5, .3, 6], { name: 'Uplink deck', color: '#cfc5a6' });
    for (const x of [11.2, 14.8])
        for (const z of [-21.4, -16.6])
            add('column', `deck-column-${x}-${z}`, [x, 0, z], [1, 1.03, 1], { name: 'Deck column' });
    add('switch', 'uplink-switch', [14, 3.6, -19], [1, 1, 1], { name: '05 · Uplink switch', components: [{ type: 'switch', channel: 'uplink', label: 'Engage uplink' }] });
    // Logic parts. Editor-only volumes that carry no trigger, just the signal rules.
    add('trigger', 'cell-counter', [-13, 0, -26.2], [.6, .6, .6], { name: 'Logic · cell counter (3)', color: '#eaa16b', components: [{ type: 'counter', channel: 'cell', count: 3, output: 'cells', message: 'All three cells collected. Power is on.' }] });
    add('trigger', 'uplink-relay', [-10, 0, -26.2], [.6, .6, .6], { name: 'Logic · uplink relay (2.5 s)', color: '#eaa16b', components: [{ type: 'relay', channel: 'uplink', output: 'uplink-late', delay: 2.5 }] });
    add('trigger', 'exit-logic', [-7, 0, -26.2], [.6, .6, .6], { name: 'Logic · power and uplink', color: '#eaa16b', components: [{ type: 'logic', inputs: ['cells', 'uplink-late'], mode: 'all', output: 'exit', message: 'Relay online. The exit door is open.' }] });
    // 04 · Exit.
    add('block', 'exit-wall-west', [-8.675, 0, -24], [14.65, 4.2, .7], { name: 'Exit wall · west', color: wall });
    add('block', 'exit-wall-east', [8.675, 0, -24], [14.65, 4.2, .7], { name: 'Exit wall · east', color: wall });
    add('door', 'exit-door', [0, 0, -24], [1, 1, 1], { name: '06 · Exit door', components: [{ type: 'door', channel: 'exit', distance: 3.8, speed: 2, axis: 'y' }] });
    add('goal', 'exit', [0, 0, -26.2], [1, 1, 1], { name: '07 · Exit gate', components: [{ type: 'goal', channel: 'exit', requiresSignal: true, message: 'Relay online. Quarry test complete.', hint: 'The exit needs all three cells and the uplink.' }] });
    // Edges and planting.
    for (let i = 0; i < 9; i++)
        add('block', `edge-front-${i}`, [-15 + i * 3.75, -.1, 15.6], [3.55, .48, .45], { color: '#a8b199', name: 'Boundary stone' });
    const rng = random(53);
    const trees = [[-14, 0, 14.2], [-14.6, 0, 7], [14.2, 0, 14.6], [14.6, 0, 1.5], [-14.6, 0, -1], [14.6, 0, -12.5], [-14.4, 0, -21], [13.5, 0, -27]];
    trees.forEach((pos, i) => { const size = .8 + rng() * .45; add('tree', `tree-${i}`, pos, [size, size, size], { rotation: [0, rng() * 360, 0] }); });
    // Placed by hand so none sits in a wall, a trigger or the bridge approach.
    const rocks = [[-14.8, 11.2], [-15.2, 3], [-13.9, -10.8], [-15, -14.2], [-14.2, -18], [14.9, 10.8], [15.3, 6.5], [14.6, -1.2], [15.2, -14.8], [15.5, -23], [-15.5, -26.5], [6.5, -27]];
    rocks.forEach(([x, z], i) => { const size = .45 + rng() * .55; add('rock', `rock-${i}`, [x, 0, z], [size, size, size], { rotation: [0, rng() * 360, 0] }); });
    return { version: 1, name: 'The quarry relay', description: 'A crate-and-signal course. Built from the same parts as the yard: a pressure plate, a sliding bridge, a jump-pad ledge, a stone climb and a delayed relay.', objective: 'Weigh down the plate. Power the relay.', seed: 53,
        environment: { sky: '#c9d6cf', fog: .0085, sun: 3.2, exposure: 1.05, backdrop: true }, player: { ...defaultMotor }, entities };
}
