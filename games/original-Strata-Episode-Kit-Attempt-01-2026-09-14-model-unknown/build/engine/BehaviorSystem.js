import * as THREE from 'three';
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
export function registerBuiltins(registry) {
    registry.builtin('spawn', () => ({}));
    registry.builtin('switch', (e, d, ctx) => {
        let on = false;
        const channel = str(d, 'channel', 'gate');
        return { prompt: () => `${on ? 'Deactivate' : 'Activate'} · ${str(d, 'label', 'switch')}`, interact: () => { on = !on; ctx.signals.send(channel, on, e.data.id); ctx.notify(on ? 'Signal active' : 'Signal inactive'); } };
    });
    registry.builtin('door', (e, d, ctx) => {
        e.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
        const base = new THREE.Vector3(...e.data.position), direction = new THREE.Vector3();
        direction[str(d, 'axis', 'y')] = 1;
        direction.applyQuaternion(e.currentRotation);
        let open = false, offset = 0;
        const off = ctx.signals.on(str(d, 'channel', 'gate'), s => { open = s.value; });
        return { beforeStep: dt => {
                const target = open ? num(d, 'distance', 3.6) : 0, diff = target - offset;
                const nextOffset = offset + Math.sign(diff) * Math.min(Math.abs(diff), num(d, 'speed', 2) * dt);
                const next = base.clone().addScaledVector(direction, nextOffset);
                // Stop a closing door before its next pose overlaps the player or a dynamic body.
                if (diff < 0) {
                    const current = e.body.translation(), delta = next.clone().sub(new THREE.Vector3(current.x, current.y, current.z));
                    const blocked = e.colliders.some(c => {
                        const pos = c.translation();
                        return !!ctx.physics.world.intersectionWithShape({ x: pos.x + delta.x, y: pos.y + delta.y, z: pos.z + delta.z }, c.rotation(), c.shape, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, c, e.body, other => other.handle === ctx.player.collider.handle || other.parent()?.isDynamic() === true);
                    });
                    if (blocked)
                        return;
                }
                offset = nextOffset;
                ctx.physics.move(e, next);
            }, dispose: off };
    });
    registry.builtin('mover', (e, d, ctx) => {
        e.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
        const base = new THREE.Vector3(...e.data.position), direction = new THREE.Vector3();
        direction[str(d, 'axis', 'y')] = 1;
        direction.applyQuaternion(e.currentRotation);
        let time = 0, enabled = !d.channel;
        const off = d.channel ? ctx.signals.on(String(d.channel), s => { enabled = s.value; }) : () => { };
        return { beforeStep: dt => {
                if (enabled)
                    time += dt;
                const t = (1 - Math.cos(time / num(d, 'period', 5) * Math.PI * 2)) * .5;
                ctx.physics.move(e, base.clone().addScaledVector(direction, t * num(d, 'distance', 3)));
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
                }
            } };
    });
    registry.builtin('hazard', (e, _d, ctx) => ({ afterStep: () => {
            if (overlapping(e, ctx)) {
                ctx.player.respawn();
                ctx.notify('Returned to checkpoint');
            }
        } }));
    registry.builtin('goal', (e, d, ctx) => {
        let finished = false;
        return { afterStep: () => {
                if (!finished && overlapping(e, ctx) && (!d.requiresSignal || ctx.signals.values.get(str(d, 'channel', 'gate')))) {
                    finished = true;
                    ctx.complete();
                    ctx.notify(str(d, 'message', 'Test complete'));
                }
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
