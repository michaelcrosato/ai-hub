/** EDIT HERE: the second episode, Pump House. Built only from the starter's own prefabs and components. */
import { defaultMotor } from '../core/motor.js';
import { createPrefabs } from '../level/prefabs.js';
import { registerYardArt } from './level.js';

/** Supply crates. Component data: { type: 'supply', kind: 'health' | 'ammo', amount }. */
export function validateSupply(data) {
    if (!['health', 'ammo'].includes(String(data.kind)))
        throw new Error('supply.kind must be health or ammo.');
    if (data.amount !== undefined && (!Number.isInteger(data.amount) || data.amount < 1 || data.amount > 200))
        throw new Error('supply.amount must be an integer from 1 to 200.');
}

export function registerPumpArt(prefabs) {
    prefabs.register({ id: 'medkit', name: 'Medkit', group: 'Gameplay', summary: 'Restores health. Walk into it or press Use.', components: [{ type: 'supply', kind: 'health', amount: 40 }], build: () => ({ body: 'fixed',
            visuals: [
                { shape: 'box', position: [0, .22, 0], scale: [.7, .44, .5], color: '#e9e4d2' },
                { shape: 'box', position: [0, .24, .255], scale: [.34, .1, .02], color: '#c84b3c' },
                { shape: 'box', position: [0, .24, .255], scale: [.1, .3, .02], color: '#c84b3c' },
                { shape: 'box', position: [0, .47, 0], scale: [.24, .06, .1], color: '#394943' },
            ], colliders: [{ position: [0, .6, 0], size: [1.3, 1.2, 1.3], sensor: true }] }) });
    prefabs.register({ id: 'ammo-box', name: 'Ammunition box', group: 'Gameplay', summary: 'Refills rifle reserve ammunition.', components: [{ type: 'supply', kind: 'ammo', amount: 24 }], build: () => ({ body: 'fixed',
            visuals: [
                { shape: 'box', position: [0, .18, 0], scale: [.8, .36, .45], color: '#6f7f4a' },
                { shape: 'box', position: [0, .26, 0], scale: [.82, .06, .47], color: '#efcf75' },
                { shape: 'box', position: [0, .39, 0], scale: [.3, .06, .1], color: '#394943' },
            ], colliders: [{ position: [0, .6, 0], size: [1.3, 1.2, 1.3], sensor: true }] }) });
}

/** Every prefab the two episodes use: the yard's sentry and car, and the supply crates. */
export function registerEpisodeArt(prefabs) {
    registerYardArt(prefabs);
    registerPumpArt(prefabs);
}

export function pumpLevel(config = {}) {
    const prefabs = createPrefabs();
    registerEpisodeArt(prefabs);
    const entities = [];
    const add = (type, id, p, scale = [1, 1, 1], color) => {
        const e = prefabs.create(type, p, id);
        e.scale = scale;
        if (color)
            e.color = color;
        entities.push(e);
        return e;
    };
    const PANEL = '#6f847a', DARK = '#394943', TEAL = '#4b8c85', DECK = '#8e9a86', PYLON = '#50cbb2';
    // Shell: 30 m by 52 m, open to the sky and the harbour.
    add('block', 'floor', [0, -.3, -6], [30, .3, 52], '#b3ab92');
    add('block', 'west-wall', [-15, 0, -6], [.6, 4, 52]);
    add('block', 'east-wall', [15, 0, -6], [.6, 4, 52]);
    add('block', 'south-wall', [0, 0, 20], [30, 4, .6]);
    add('block', 'north-wall', [0, 0, -32], [30, 4, .6]);

    // Intake yard: the start, a sentry, cell A behind crates, and the shutter switch up on a deck.
    add('spawn', 'start', [0, .1, 16]);
    add('tree', 'planter-west', [-12.5, 0, 18]);
    add('tree', 'planter-east', [12.5, 0, 18]);
    add('block', 'cover-a', [-5, 0, 9], [4, 1.25, 1.8], PANEL);
    add('block', 'cover-b', [5, 0, 5], [3.5, 1.25, 1.8], PANEL);
    add('stairs', 'deck-steps', [-11, 0, 15]);
    add('block', 'switch-deck', [-11, 1.5, 9.9], [4, .2, 4.4]);
    const shutterSwitch = add('switch', 'shutter-switch', [-11, 1.7, 8.6]);
    shutterSwitch.components = [{ type: 'switch', channel: 'shutter', label: 'Raise the pump hall shutter' }];
    add('crate', 'crate-a', [10.8, .1, 11]);
    add('crate', 'crate-b', [12.4, .1, 11.4]);
    add('pickup', 'cell-a', [13.2, 0, 9.3]);
    add('medkit', 'medkit-a', [-13.4, 0, 2]);
    add('sentry', 'guard-a', [6, 0, 2.2]);
    for (let i = 0; i < 4; i++)
        add('block', `lane-${i}`, [0, .01, 12 - i * 3], [.1, .05, 1.5], '#efcf75');
    add('block', 'divider-west', [-8.75, 0, 0], [12.5, 4, .6]);
    add('block', 'divider-east', [8.75, 0, 0], [12.5, 4, .6]);
    const shutter = add('door', 'shutter', [0, 0, 0], [1.9, 1, 1]);
    shutter.components = [{ type: 'door', channel: 'shutter', distance: 3.6, speed: 2.2, axis: 'y' }];

    // Pump hall: pumps and overhead pipe, a jump pad and a lift to the catwalk with cell B.
    add('block', 'pump-housing-a', [6.5, 0, -6], [4, 2.4, 3], TEAL);
    add('block', 'pump-cap-a', [6.5, 2.4, -6], [1.2, 1.2, 1.2], DARK);
    add('block', 'pump-housing-b', [6.5, 0, -11.5], [4, 2.4, 3], TEAL);
    add('block', 'pump-cap-b', [6.5, 2.4, -11.5], [1.2, 1.2, 1.2], DARK);
    add('block', 'pipe-post-south', [10.5, 0, -5], [.25, 2.6, .25], DARK);
    add('block', 'pipe-post-north', [10.5, 0, -12.5], [.25, 2.6, .25], DARK);
    add('block', 'pipe-run', [10.5, 2.6, -8.75], [.6, .6, 8.5], DARK);
    add('column', 'hall-column', [-3, 0, -6]);
    add('sentry', 'guard-b', [11.5, 0, -13.2]);
    add('ammo-box', 'ammo-a', [12.8, 0, -3]);
    add('checkpoint', 'checkpoint-b', [-1, 0, -11]);
    const pad = add('pad', 'pad-a', [-6.5, 0, -10.5]);
    pad.components = [{ type: 'pad', launchSpeed: 14 }];
    add('block', 'catwalk', [-11.5, 3, -10.5], [7, .25, 5], DECK);
    add('pickup', 'cell-b', [-13, 3.25, -10.5]);
    const lift = add('platform', 'lift', [-11.5, 0, -6.5]);
    lift.components = [{ type: 'mover', axis: 'y', distance: 3, period: 6 }];

    // Hazard strip across the hall. Sprint and jump it, or clear the crates off the east walkway.
    for (let i = 0; i < 14; i++)
        add('hazard', `hazard-${i}`, [-14 + i * 2, 0, -16], [1, 1, 1.2]);
    add('crate', 'crate-c', [14.1, .1, -15.6]);
    add('crate', 'crate-d', [14.1, .1, -16.8]);
    add('crate', 'crate-e', [14.1, 1.25, -16.2]);

    // Exit court: two sentries (one on a deck), cell C, the power pylon and the exit gate.
    add('checkpoint', 'checkpoint-c', [3, 0, -19.5]);
    add('block', 'cover-c', [0, 0, -22], [4, 1.25, 1.6], PANEL);
    add('block', 'cover-d', [-8.5, 0, -20.5], [3, 1.25, 1.6], PANEL);
    add('stairs', 'deck-steps-north', [8, 0, -21.75]);
    add('block', 'sentry-deck', [8, 0, -26], [4, 1.5, 3], DECK);
    add('sentry', 'guard-c', [-5, 0, -25]);
    add('sentry', 'guard-d', [8, 1.5, -26.6]);
    add('pickup', 'cell-c', [-12.5, 0, -27.5]);
    add('medkit', 'medkit-b', [13, 0, -22]);
    const power = add('column', 'power-pylon', [12.5, 0, -30], [1, 1, 1], PYLON);
    power.components = [{ type: 'counter', channel: 'cell', count: 3, output: 'power' }];
    const logic = add('column', 'exit-pylon', [-12.5, 0, -30], [1, 1, 1], PYLON);
    logic.components = [{ type: 'logic', inputs: ['power', 'clear'], mode: 'all', output: 'exit' }];
    const gate = add('goal', 'exit-gate', [0, 0, -30]);
    gate.components = [{ type: 'goal', channel: 'exit', requiresSignal: true, message: 'Pump house cleared.' }];

    return { version: 1, name: 'Pump House', description: 'A harbour pump station with three signal cells, a hazard strip and four sentries.',
        objective: 'Collect three signal cells. Clear four sentries. Reach the exit gate.', seed: 43,
        environment: { sky: '#bccfd4', fog: .01, sun: 2.6, exposure: 1, backdrop: true }, player: { ...defaultMotor, headBob: .2, ...config.player }, entities };
}
