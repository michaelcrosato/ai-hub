import * as THREE from 'three/webgpu';
import { RAPIER } from './PhysicsWorld.js';
export class Behaviors {
    schemas;
    factories = new Map();
    constructor(schemas) {
        this.schemas = schemas;
    }
    register(type, validate, factory) {
        if (this.factories.has(type))
            throw new Error(`Behavior already registered: ${type}`);
        this.schemas.register(type, validate);
        this.factories.set(type, factory);
    }
    builtin(type, factory) { this.factories.set(type, factory); }
    create(type, e, data, ctx) {
        const factory = this.factories.get(type);
        if (!factory)
            throw new Error(`No behavior factory for ${type}.`);
        return factory(e, data, ctx);
    }
}
const num = (d, key, fallback) => typeof d[key] === 'number' ? d[key] : fallback;
const str = (d, key, fallback) => typeof d[key] === 'string' ? d[key] : fallback;
const overlapping = (e, ctx) => e.colliders.some(c => c.isSensor() && ctx.physics.world.intersectionPair(c, ctx.player.collider));
/** ctx.cue(name, info) drives sound, rumble and run statistics; a plugin's ctx may not have it. */
const cue = (ctx, name, info) => ctx.cue?.(name, info);
/** A door or mover: the local axis it travels along, in world space. */
function travelAxis(e, d) {
    const direction = new THREE.Vector3();
    direction[str(d, 'axis', 'y')] = 1;
    return direction.applyQuaternion(e.currentRotation);
}
export function registerBuiltins(registry) {
    registry.builtin('spawn', () => ({}));
    registry.builtin('switch', (e, d, ctx) => {
        let on = false;
        const channel = str(d, 'channel', 'gate');
        return { prompt: () => `${on ? 'Deactivate' : 'Activate'} · ${str(d, 'label', 'switch')}`, interact: () => {
                on = !on;
                ctx.signals.send(channel, on, e.data.id);
                ctx.notify(on ? 'Signal active' : 'Signal inactive');
                cue(ctx, 'switch', on);
            } };
    });
    registry.builtin('door', (e, d, ctx) => {
        e.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
        e.moving = true;
        const base = new THREE.Vector3(...e.data.position), direction = travelAxis(e, d), next = new THREE.Vector3();
        let open = false, offset = 0;
        const off = ctx.signals.on(str(d, 'channel', 'gate'), s => {
            const want = !!s.value;
            if (want !== open)
                cue(ctx, 'door', want);
            open = want;
        });
        return { beforeStep: dt => {
                const target = open ? num(d, 'distance', 3.6) : 0, diff = target - offset;
                if (Math.abs(diff) < 1e-6)
                    return;
                const nextOffset = offset + Math.sign(diff) * Math.min(Math.abs(diff), num(d, 'speed', 2) * dt);
                next.copy(base).addScaledVector(direction, nextOffset);
                // Stop a closing door before its next pose overlaps the player or a dynamic body.
                if (diff < 0) {
                    const current = e.body.translation(), dx = next.x - current.x, dy = next.y - current.y, dz = next.z - current.z;
                    const blocked = e.colliders.some(c => {
                        const pos = c.translation();
                        return !!ctx.physics.world.intersectionWithShape({ x: pos.x + dx, y: pos.y + dy, z: pos.z + dz }, c.rotation(), c.shape, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, c, e.body, other => other.handle === ctx.player.collider.handle || other.parent()?.isDynamic() === true);
                    });
                    if (blocked)
                        return;
                }
                offset = nextOffset;
                ctx.physics.move(e, next);
            }, dispose: off };
    });
    registry.builtin('mover', (e, d, ctx) => {
        // Surfaces the player rides are fixed bodies placed every step (see PhysicsWorld.placeByHand).
        ctx.physics.placeByHand(e);
        const base = new THREE.Vector3(...e.data.position), direction = travelAxis(e, d), next = new THREE.Vector3();
        let time = 0, enabled = !d.channel;
        const off = d.channel ? ctx.signals.on(String(d.channel), s => {
            if (s.value && !enabled)
                cue(ctx, 'mover', true);
            enabled = !!s.value;
        }) : () => { };
        return { beforeStep: dt => {
                if (enabled)
                    time += dt;
                const t = (1 - Math.cos(time / num(d, 'period', 5) * Math.PI * 2)) * .5;
                ctx.physics.move(e, next.copy(base).addScaledVector(direction, t * num(d, 'distance', 3)));
            }, dispose: off };
    });
    registry.builtin('trigger', (e, d, ctx) => {
        let inside = false, fired = false;
        return { afterStep: () => {
                const now = overlapping(e, ctx);
                if (now !== inside) {
                    inside = now;
                    if (!(d.once && fired)) {
                        ctx.signals.send(str(d, 'channel', 'zone'), now, e.data.id);
                        if (now)
                            fired = true;
                    }
                }
            } };
    });
    // New: held down by the player or any crate. Sends true while pressed and false when
    // released (or stays on after the first press with once: true).
    registry.builtin('plate', (e, d, ctx) => {
        let pressed = false, latched = false, sink = 0;
        const top = e.root.children[1];
        const baseY = top ? top.position.y : 0;
        const sensors = e.colliders.filter(c => c.isSensor());
        const world = ctx.physics.world;
        const weighed = () => sensors.some(s => world.intersectionPair(s, ctx.player.collider) || ctx.physics.dynamicColliders.some(c => world.intersectionPair(s, c)));
        return { afterStep: () => {
                if (latched)
                    return;
                const now = weighed();
                if (now === pressed)
                    return;
                pressed = now;
                if (pressed && d.once)
                    latched = true;
                ctx.signals.send(str(d, 'channel', 'plate'), pressed, e.data.id);
                cue(ctx, 'plate', pressed);
            }, render: dt => {
                sink = sink + ((pressed || latched ? 1 : 0) - sink) * Math.min(1, dt * 14);
                if (top)
                    top.position.y = baseY - sink * .045;
            } };
    });
    registry.builtin('pickup', (e, d, ctx) => {
        let collected = false, time = 0;
        const mesh = e.root.children[0];
        const collect = () => {
            if (collected)
                return;
            collected = true;
            e.root.visible = false;
            for (const c of e.colliders)
                c.setEnabled(false);
            ctx.signals.send(str(d, 'channel', 'cell'), true, e.data.id);
            ctx.notify('Signal cell collected');
            cue(ctx, 'pickup');
        };
        return { prompt: () => str(d, 'label', 'Collect cell'), interact: collect, afterStep: () => {
                if (overlapping(e, ctx))
                    collect();
            }, render: dt => {
                if (!collected && mesh) {
                    time += dt;
                    mesh.rotation.y = time;
                    mesh.position.y = 1 + Math.sin(time * 2) * .12;
                }
            } };
    });
    registry.builtin('checkpoint', (e, d, ctx) => {
        let active = false;
        return { afterStep: () => {
                if (!active && overlapping(e, ctx)) {
                    active = true;
                    ctx.player.setCheckpoint(e.data.position);
                    ctx.notify(str(d, 'message', 'Checkpoint saved'));
                    cue(ctx, 'checkpoint');
                }
            } };
    });
    registry.builtin('pad', (e, d, ctx) => {
        let cooldown = 0;
        return { afterStep: dt => {
                cooldown -= dt;
                if (cooldown <= 0 && overlapping(e, ctx)) {
                    ctx.player.motor.launch(num(d, 'launchSpeed', 14));
                    cooldown = .75;
                    cue(ctx, 'pad');
                }
            } };
    });
    registry.builtin('hazard', (e, _d, ctx) => ({ afterStep: () => {
            if (overlapping(e, ctx)) {
                ctx.player.respawn('hazard');
                ctx.notify('Returned to checkpoint');
            }
        } }));
    registry.builtin('goal', (e, d, ctx) => {
        let finished = false, wasInside = false;
        return { afterStep: () => {
                if (finished)
                    return;
                const inside = overlapping(e, ctx);
                if (inside && (!d.requiresSignal || ctx.signals.values.get(str(d, 'channel', 'gate')))) {
                    finished = true;
                    ctx.complete(str(d, 'message', 'Test complete'));
                    ctx.notify(str(d, 'message', 'Test complete'));
                    cue(ctx, 'goal');
                }
                else if (inside && !wasInside) {
                    // Say why nothing happens instead of failing silently.
                    ctx.notify(str(d, 'hint', 'The gate is locked. Its signal is off.'));
                    cue(ctx, 'deny');
                }
                wasInside = inside;
            } };
    });
    registry.builtin('counter', (e, d, ctx) => {
        let count = 0, done = false;
        const sources = new Set();
        const off = ctx.signals.on(str(d, 'channel', 'cell'), signal => {
            if (done || !signal.value || d.unique !== false && sources.has(signal.source))
                return;
            sources.add(signal.source);
            count++;
            if (count >= num(d, 'count', 2)) {
                done = true;
                ctx.signals.send(str(d, 'output', 'unlocked'), true, e.data.id);
                if (d.message)
                    ctx.notify(String(d.message));
                cue(ctx, 'unlock');
            }
        });
        return { dispose: off };
    });
    registry.builtin('logic', (e, d, ctx) => {
        const inputs = Array.isArray(d.inputs) ? d.inputs : [];
        let last;
        const update = () => {
            const output = inputs.length > 0 && (d.mode === 'any' ? inputs.some(channel => ctx.signals.values.get(channel) === true) : inputs.every(channel => ctx.signals.values.get(channel) === true));
            if (output !== last) {
                last = output;
                ctx.signals.send(str(d, 'output', 'result'), output, e.data.id);
                if (output && d.message) {
                    ctx.notify(String(d.message));
                    cue(ctx, 'unlock');
                }
            }
        };
        const off = inputs.map(channel => ctx.signals.on(channel, update));
        return { dispose: () => {
                for (const unsubscribe of off)
                    unsubscribe();
            } };
    });
    registry.builtin('relay', (e, d, ctx) => {
        const cancels = [];
        const off = ctx.signals.on(str(d, 'channel', 'in'), s => {
            const delay = num(d, 'delay', 0);
            if (delay === 0)
                ctx.signals.send(str(d, 'output', 'out'), s.value, e.data.id);
            else {
                let cancel;
                cancel = ctx.timeline.after(delay, () => {
                    ctx.signals.send(str(d, 'output', 'out'), s.value, e.data.id);
                    const index = cancels.indexOf(cancel);
                    if (index >= 0)
                        cancels.splice(index, 1);
                });
                cancels.push(cancel);
            }
        });
        return { dispose: () => {
                off();
                for (const cancel of cancels)
                    cancel();
            } };
    });
}
