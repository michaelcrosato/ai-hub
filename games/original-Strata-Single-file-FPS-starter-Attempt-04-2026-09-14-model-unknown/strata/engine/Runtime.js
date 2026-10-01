import { Signals } from '../core/events.js';
import { Timeline } from '../core/clock.js';
import { radians } from '../core/math.js';
import { PhysicsWorld } from './PhysicsWorld.js';
import { Player } from './Player.js';
export class Runtime {
    data;
    playing;
    renderWorld;
    physics;
    signals = new Signals();
    timeline = new Timeline();
    instances = new Map();
    roots = [];
    player = null;
    target = null;
    /** What the player can do right now: '' (nothing), 'interact' (see `prompt`) or 'held' (drop / throw). */
    promptKind = '';
    prompt = '';
    complete = false;
    alive = true;
    /**
     * @param {object} [hooks] optional page hooks: { cue(kind) } plays a sound for a level event.
     */
    constructor(data, playing, renderWorld, input, prefabs, behaviors, assets, notify, hooks = {}) {
        this.data = data;
        this.playing = playing;
        this.renderWorld = renderWorld;
        this.physics = new PhysicsWorld({ x: 0, y: -data.player.gravity, z: 0 });
        try {
            for (const entity of data.entities) {
                const blueprint = prefabs.get(entity.prefab).build(entity), root = renderWorld.create(entity, blueprint, playing);
                this.roots.push(root);
                this.physics.create(entity, blueprint, root, playing);
                if (entity.model)
                    void assets.staticModel(entity.model).then(model => {
                        if (!this.alive)
                            return;
                        root.clear();
                        model.traverse(o => { o.userData.entityId = entity.id; });
                        root.add(model);
                    }).catch(error => {
                        if (this.alive)
                            notify(`Model load failed: ${String(error)}. Kept prefab visual.`);
                    });
            }
            if (playing) {
                const spawn = data.entities.find(e => e.components.some(c => c.type === 'spawn'));
                const spawnComponent = spawn.components.find(c => c.type === 'spawn');
                this.player = new Player(this.physics, input, renderWorld.camera, data.player, spawn.position, radians(Number(spawnComponent.yaw ?? 0)));
                const ctx = { physics: this.physics, player: this.player, signals: this.signals, timeline: this.timeline, notify, cue: kind => hooks.cue?.(kind), complete: () => { this.complete = true; } };
                for (const entity of this.physics.entities.values()) {
                    const list = [];
                    this.instances.set(entity.data.id, list);
                    for (const component of entity.data.components)
                        list.push(behaviors.create(component.type, entity, component, ctx));
                }
            }
            // Populate the broad phase once before the first character or interaction query.
            this.physics.step(1 / 60000);
        }
        catch (error) {
            this.dispose();
            throw error;
        }
    }
    fixedStep(dt, input) {
        if (!this.player)
            return;
        this.physics.beginStep();
        this.timeline.update(dt);
        this.signals.flush();
        if (input.consume('interact')) {
            if (this.player.held)
                this.player.drop();
            else if (this.target) {
                const behavior = this.instances.get(this.target)?.find(b => b.interact);
                if (behavior)
                    behavior.interact();
                else {
                    const entity = this.physics.entities.get(this.target);
                    if (entity)
                        this.player.grab(entity);
                }
            }
        }
        this.signals.flush();
        for (const list of this.instances.values())
            for (const b of list)
                b.beforeStep?.(dt);
        this.player.beforeStep(dt);
        this.physics.step(dt);
        this.player.afterStep();
        for (const list of this.instances.values())
            for (const b of list)
                b.afterStep?.(dt);
        this.signals.flush();
        this.updateTarget();
    }
    #interactive = c => {
        if (!c.isSensor())
            return true;
        const id = this.physics.owners.get(c.handle);
        return id !== undefined && this.instances.get(id)?.some(b => !!b.interact) === true;
    };
    updateTarget() {
        this.target = null;
        this.prompt = '';
        this.promptKind = '';
        const player = this.player;
        if (!player)
            return;
        if (player.held) {
            this.promptKind = 'held';
            return;
        }
        // Closest collider wins, so walls block interaction with objects behind them.
        const hit = this.physics.world.castRay(player.ray(), 3, true, undefined, undefined, player.collider, player.body, this.#interactive);
        if (!hit)
            return;
        const id = this.physics.owners.get(hit.collider.handle);
        if (!id)
            return;
        const interact = this.instances.get(id)?.find(b => b.interact);
        if (interact) {
            this.target = id;
            this.promptKind = 'interact';
            this.prompt = interact.prompt?.() ?? 'Interact';
        }
        else if (hit.collider.parent()?.isDynamic()) {
            this.target = id;
            this.promptKind = 'interact';
            this.prompt = 'Pick up crate';
        }
    }
    render(alpha, dt) {
        if (this.playing) {
            this.physics.interpolate(alpha);
            this.player?.render(alpha, dt);
            for (const list of this.instances.values())
                for (const b of list)
                    b.render?.(dt);
        }
    }
    dispose() {
        if (!this.alive)
            return;
        this.alive = false;
        for (const list of this.instances.values())
            for (const behavior of list)
                behavior.dispose?.();
        this.instances.clear();
        this.player?.dispose();
        this.player = null;
        this.signals.clear();
        this.timeline.clear();
        for (const root of this.roots)
            root.removeFromParent();
        this.roots.length = 0;
        this.physics.dispose();
    }
}
