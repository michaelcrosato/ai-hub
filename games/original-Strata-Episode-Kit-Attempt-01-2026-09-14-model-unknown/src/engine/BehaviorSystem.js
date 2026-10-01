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
const overlapping = (e, ctx) => e.colliders.some(c => c.isSensor() && c.isEnabled() && ctx.physics.world.intersectionPair(c, ctx.player.collider));
/** Tell the episode something happened (sound, rumble, HUD). Episodes may ignore it. */
const emit = (ctx, type, e, extra) => ctx.event?.(type, e, extra);
export function registerBuiltins(registry) {
    registry.builtin('spawn', () => ({}));
    registry.builtin('switch', (e, d, ctx) => {
        let on = false;
        const channel = str(d, 'channel', 'gate');
        const set = (value) => { on = value; ctx.signals.send(channel, on, e.data.id); ctx.notify(on ? 'Signal active' : 'Signal inactive'); emit(ctx, 'switch', e, on); };
        return { prompt: () => `${on ? 'Deactivate' : 'Activate'} · ${str(d, 'label', 'switch')}`, interact: () => set(!on), get on() { return on; }, set };
    });
    registry.builtin('door', (e, d, ctx) => {
        e.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
        ctx.physics.markMoving(e);
        const base = new THREE.Vector3(...e.data.position), direction = new THREE.Vector3();
        const next = new THREE.Vector3(), delta = new THREE.Vector3(), probe = { x: 0, y: 0, z: 0 };
        direction[str(d, 'axis', 'y')] = 1;
        direction.applyQuaternion(e.currentRotation);
        let open = false, offset = 0, announced = false;
        const off = ctx.signals.on(str(d, 'channel', 'gate'), s => {
            open = s.value;
            if (open && !announced) {
                announced = true;
                emit(ctx, 'door', e, true);
            }
            if (!open)
                announced = false;
        });
        const blocker = other => other.handle === ctx.player.collider.handle || other.parent()?.isDynamic() === true;
        return { beforeStep: dt => {
                const target = open ? num(d, 'distance', 3.6) : 0, diff = target - offset;
                if (diff === 0)
                    return;
                const nextOffset = offset + Math.sign(diff) * Math.min(Math.abs(diff), num(d, 'speed', 2) * dt);
                next.copy(base).addScaledVector(direction, nextOffset);
                // Stop a closing door before its next pose overlaps the player or a dynamic body.
                if (diff < 0) {
                    const current = e.body.translation();
                    delta.set(next.x - current.x, next.y - current.y, next.z - current.z);
                    const blocked = e.colliders.some(c => {
                        const pos = c.translation();
                        probe.x = pos.x + delta.x;
                        probe.y = pos.y + delta.y;
                        probe.z = pos.z + delta.z;
                        return !!ctx.physics.world.intersectionWithShape(probe, c.rotation(), c.shape, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, c, e.body, blocker);
                    });
                    if (blocked)
                        return;
                }
                offset = nextOffset;
                ctx.physics.move(e, next);
            }, get open() { return open; }, dispose: off };
    });
    registry.builtin('mover', (e, d, ctx) => {
        // A surface the player stands on moves as a fixed body placed every step. Rapier 0.20's
        // character controller sticks to kinematic ground (no walking on an idle platform, half
        // speed on a moving one); on a fixed body it walks, rides up, down and sideways.
        e.body.setBodyType(RAPIER.RigidBodyType.Fixed, true);
        e.teleport = true;
        ctx.physics.markMoving(e);
        const base = new THREE.Vector3(...e.data.position), direction = new THREE.Vector3(), next = new THREE.Vector3();
        direction[str(d, 'axis', 'y')] = 1;
        direction.applyQuaternion(e.currentRotation);
        let time = 0, enabled = !d.channel;
        const off = d.channel ? ctx.signals.on(String(d.channel), s => {
            if (s.value && !enabled)
                emit(ctx, 'mover', e, true);
            enabled = s.value;
        }) : () => { };
        return { beforeStep: dt => {
                if (enabled)
                    time += dt;
                const t = (1 - Math.cos(time / num(d, 'period', 5) * Math.PI * 2)) * .5;
                next.copy(base).addScaledVector(direction, t * num(d, 'distance', 3));
                ctx.physics.move(e, next);
            }, get enabled() { return enabled; }, dispose: off };
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
        const collect = (quiet = false) => {
            if (collected)
                return;
            collected = true;
            e.root.visible = false;
            for (const c of e.colliders)
                c.setEnabled(false);
            ctx.signals.send(str(d, 'channel', 'cell'), true, e.data.id);
            if (!quiet) {
                ctx.notify('Signal cell collected');
                emit(ctx, 'pickup', e);
            }
        };
        return { prompt: () => str(d, 'label', 'Collect cell'), interact: () => collect(), collect, get collected() { return collected; }, afterStep: () => {
                if (!collected && overlapping(e, ctx))
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
                    emit(ctx, 'checkpoint', e);
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
                    emit(ctx, 'pad', e);
                }
            } };
    });
    registry.builtin('hazard', (e, d, ctx) => ({ afterStep: () => {
            if (overlapping(e, ctx)) {
                ctx.player.respawn();
                ctx.notify(str(d, 'message', 'Returned to checkpoint'));
                emit(ctx, 'hazard', e);
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
        return { get count() { return count; }, dispose: off };
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
