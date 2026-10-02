import { defaultMotor } from '../core/motor.js';
export class ComponentSchemas {
    validators = new Map();
    register(type, validator) {
        if (this.validators.has(type))
            throw new Error(`Component already registered: ${type}`);
        this.validators.set(type, validator);
    }
    validate(data) {
        const validator = this.validators.get(data.type);
        if (!validator)
            throw new Error(`Unknown component: ${data.type}`);
        validator(data);
    }
}
export const numberField = (data, key, low, high) => {
    const n = data[key];
    if (n !== undefined && (typeof n !== 'number' || !Number.isFinite(n) || n < low || n > high))
        throw new Error(`${data.type}.${key} must be ${low} to ${high}.`);
};
export const textField = (data, key) => {
    const value = data[key];
    if (value !== undefined && (typeof value !== 'string' || value.length > 200))
        throw new Error(`${data.type}.${key} must be text of 200 characters or less.`);
};
export function builtinSchemas() {
    const schemas = new ComponentSchemas();
    for (const type of ['switch', 'door', 'mover', 'trigger', 'pickup', 'checkpoint', 'pad', 'hazard', 'goal', 'relay', 'counter', 'logic', 'spawn', 'plate']) {
        schemas.register(type, data => {
            for (const key of ['channel', 'output', 'label', 'message'])
                textField(data, key);
            for (const key of ['once', 'requiresSignal', 'unique']) {
                if (data[key] !== undefined && typeof data[key] !== 'boolean')
                    throw new Error(`${type}.${key} must be true or false.`);
            }
            numberField(data, 'speed', .05, 30);
            numberField(data, 'distance', .1, 30);
            numberField(data, 'period', .5, 60);
            numberField(data, 'delay', 0, 60);
            numberField(data, 'count', 1, 1000);
            if (data.count !== undefined && !Number.isInteger(data.count))
                throw new Error('counter.count must be an integer.');
            if (data.inputs !== undefined && (!Array.isArray(data.inputs) || data.inputs.length > 32 || data.inputs.some(v => typeof v !== 'string' || !v.trim() || v.length > 200)))
                throw new Error('logic.inputs must contain up to 32 channel names.');
            if (data.mode !== undefined && !['all', 'any'].includes(String(data.mode)))
                throw new Error('logic.mode must be all or any.');
            numberField(data, 'launchSpeed', 1, 30);
            numberField(data, 'yaw', -360, 360);
            if (data.axis !== undefined && !['x', 'y', 'z'].includes(String(data.axis)))
                throw new Error(`${type}.axis must be x, y, or z.`);
        });
    }
    return schemas;
}
function object(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error(`${label} must be an object.`);
    return value;
}
function finite(value, low, high, label) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < low || value > high)
        throw new Error(`${label} must be ${low} to ${high}.`);
    return value;
}
function text(value, label, max = 120) {
    if (typeof value !== 'string' || !value.trim() || value.length > max)
        throw new Error(`${label} must be non-empty text, at most ${max} characters.`);
    return value;
}
function vec(value, label, low = -10000, high = 10000) {
    if (!Array.isArray(value) || value.length !== 3)
        throw new Error(`${label} needs three numbers.`);
    return value.map(n => finite(n, low, high, label));
}
function color(value) {
    if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value))
        throw new Error('Colors must use #RRGGBB.');
    return value;
}
function json(value, depth = 0) {
    if (depth > 16)
        throw new Error('Component data is too deeply nested.');
    if (value === null || typeof value === 'string' || typeof value === 'boolean')
        return;
    if (typeof value === 'number' && Number.isFinite(value))
        return;
    if (Array.isArray(value)) {
        if (value.length > 1000)
            throw new Error('Component array is too large.');
        for (const v of value)
            json(v, depth + 1);
        return;
    }
    if (value && typeof value === 'object') {
        for (const [key, val] of Object.entries(value)) {
            if (['__proto__', 'constructor', 'prototype'].includes(key))
                throw new Error('Unsafe component key.');
            json(val, depth + 1);
        }
        return;
    }
    throw new Error('Component data must contain JSON values only.');
}
/** Reject invalid levels before replacing the current document or allocating a physics world. */
export function validateLevel(input, prefabs, schemas = builtinSchemas()) {
    const root = object(input, 'Level');
    if (root.version !== 1)
        throw new Error('Unsupported level version. Expected version 1.');
    if (!Array.isArray(root.entities) || root.entities.length > 3000)
        throw new Error('A level must have an entity array with at most 3000 items.');
    const ids = new Set();
    let spawns = 0;
    const entities = root.entities.map((item, i) => {
        const e = object(item, `Entity ${i}`);
        const id = text(e.id, 'Entity id');
        if (ids.has(id))
            throw new Error(`Duplicate entity id: ${id}`);
        ids.add(id);
        const prefab = text(e.prefab, 'Prefab');
        if (!prefabs.has(prefab))
            throw new Error(`Unknown prefab: ${prefab}`);
        if (!Array.isArray(e.components) || e.components.length > 24)
            throw new Error(`${id}: components must be an array with at most 24 entries.`);
        const types = new Set();
        const components = e.components.map(raw => {
            const c = object(raw, 'Component');
            json(c);
            const type = text(c.type, 'Component type');
            if (types.has(type))
                throw new Error(`${id}: duplicate component ${type}.`);
            types.add(type);
            if (type === 'spawn')
                spawns++;
            schemas.validate(c);
            return structuredClone(c);
        });
        if (types.has('door') && types.has('mover'))
            throw new Error(`${id}: use only one motion component per entity.`);
        const result = { id, name: text(e.name, 'Entity name'), prefab,
            position: vec(e.position, `${id}.position`), rotation: vec(e.rotation, `${id}.rotation`, -3600, 3600),
            scale: vec(e.scale, `${id}.scale`, .05, 100), components };
        if (e.color !== undefined)
            result.color = color(e.color);
        if (e.model !== undefined) {
            const model = text(e.model, 'Model URL', 500);
            // Models are local project assets. No scripts, remote tracking URLs, or arbitrary protocols.
            if (!/^(\.\/)?assets\/[a-zA-Z0-9_./-]+\.glb$/i.test(model) || model.includes('..'))
                throw new Error('Model path must be assets/name.glb.');
            result.model = model;
        }
        return result;
    });
    if (spawns !== 1)
        throw new Error('The level must have exactly one spawn component.');
    const env = object(root.environment ?? {}, 'Environment');
    if (env.backdrop !== undefined && typeof env.backdrop !== 'boolean')
        throw new Error('Environment backdrop must be true or false.');
    const settings = object(root.player ?? {}, 'Player');
    const player = { ...defaultMotor };
    const ranges = {
        walkSpeed: [.5, 20], sprintSpeed: [.5, 30], crouchSpeed: [.1, 15], acceleration: [1, 100],
        airAcceleration: [0, 100], friction: [0, 100], jumpSpeed: [1, 20], gravity: [1, 60],
        coyoteTime: [0, .4], jumpBuffer: [0, .4], stepHeight: [0, .5], maxSlope: [1, 65],
        fov: [50, 110], sensitivity: [.0002, .01], headBob: [0, 1],
    };
    for (const key of Object.keys(defaultMotor)) {
        if (settings[key] !== undefined)
            player[key] = finite(settings[key], ...ranges[key], `player.${key}`);
    }
    return {
        version: 1, name: text(root.name, 'Level name'), description: String(root.description ?? '').slice(0, 1000), objective: text(root.objective ?? 'Explore the level.', 'Objective', 160),
        seed: finite(root.seed ?? 7, 0, 2147483647, 'Seed'),
        environment: { sky: color(env.sky ?? '#c8d8d4'), fog: finite(env.fog ?? .009, 0, .08, 'Fog'),
            sun: finite(env.sun ?? 3, 0, 10, 'Sun intensity'), exposure: finite(env.exposure ?? 1.05, .2, 3, 'Exposure'), backdrop: env.backdrop !== false },
        player, entities,
    };
}
