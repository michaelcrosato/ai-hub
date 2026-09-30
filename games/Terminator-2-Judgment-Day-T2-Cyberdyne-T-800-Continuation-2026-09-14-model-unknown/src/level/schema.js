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
export function builtinSchemas() {
    const schemas = new ComponentSchemas();
    schemas.register('spawn', data => numberField(data, 'yaw', -360, 360));
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
/** Reject invalid levels before allocating a physics world. */
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
            const type = text(c.type, 'Component type');
            if (types.has(type))
                throw new Error(`${id}: duplicate component ${type}.`);
            types.add(type);
            if (type === 'spawn')
                spawns++;
            schemas.validate(c);
            return structuredClone(c);
        });
        const result = { id, name: text(e.name, 'Entity name'), prefab,
            position: vec(e.position, `${id}.position`), rotation: vec(e.rotation, `${id}.rotation`, -3600, 3600),
            scale: vec(e.scale, `${id}.scale`, .05, 100), components };
        if (e.color !== undefined)
            result.color = color(e.color);
        return result;
    });
    if (spawns !== 1)
        throw new Error('The level must have exactly one spawn component.');
    const env = object(root.environment ?? {}, 'Environment');
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
            sun: finite(env.sun ?? 3, 0, 10, 'Sun intensity'), exposure: finite(env.exposure ?? 1.05, .2, 3, 'Exposure') },
        player, entities,
    };
}
