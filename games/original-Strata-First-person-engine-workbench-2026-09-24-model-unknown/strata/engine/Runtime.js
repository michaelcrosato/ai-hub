import { Signals } from '../core/events.js';
import { Timeline } from '../core/clock.js';
import { radians } from '../core/math.js';
import { PhysicsWorld } from './PhysicsWorld.js';
import { Player } from './Player.js';
export class Runtime {
    data;
    playing;
    renderWorld;
    physics = new PhysicsWorld();
    signals = new Signals();
    timeline = new Timeline();
    instances = new Map();
    roots = [];
    merged = [];
    player = null;
    target = null;
    /** What the player is looking at: null, 'use' (with promptText) or 'held'. */
    prompt = null;
    promptText = '';
    complete = false;
    completeMessage = '';
    alive = true;
    /** Run statistics for the results card. */
    stats = { cells: 0, cellsTotal: 0, respawns: 0 };
    #rayFilter = c => !c.isSensor() || this.#interactive(this.physics.owners.get(c.handle));
    /**
     * @param {(name: string, info?: any) => void} [cue]  sound, rumble and HUD feedback for game events
     * @param {{ motion?: number }} [options]  motion: 0 under prefers-reduced-motion
     */
    constructor(data, playing, renderWorld, input, prefabs, behaviors, assets, notify, cue = () => { }, options = {}) {
        this.data = data;
        this.playing = playing;
        this.renderWorld = renderWorld;
        try {
            for (const entity of data.entities) {
                const blueprint = prefabs.get(entity.prefab).build(entity), root = renderWorld.create(entity, blueprint, playing);
                this.roots.push(root);
                this.physics.create(entity, blueprint, root, playing);
                if (entity.components.some(c => c.type === 'pickup'))
                    this.stats.cellsTotal++;
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
                this.player.motion = options.motion ?? 1;
                this.player.cue = (name, info) => {
                    if (name === 'respawn')
                        this.stats.respawns++;
                    cue(name, info);
                };
                const ctx = { physics: this.physics, player: this.player, signals: this.signals, timeline: this.timeline, notify, complete: (message = '') => { this.complete = true; this.completeMessage = message; }, cue: (name, info) => {
                        if (name === 'pickup')
                            this.stats.cells++;
                        cue(name, info);
                    } };
                for (const entity of this.physics.entities.values()) {
                    const list = [];
                    this.instances.set(entity.data.id, list);
                    for (const component of entity.data.components)
                        list.push(behaviors.create(component.type, entity, component, ctx));
                }
                // Scenery that never moves becomes one mesh per material (far fewer draw calls).
                this.merged = renderWorld.mergeStatic(this.physics.entities.values());
            }
            // Populate the broad phase once before the first character or interaction query.
            this.physics.step(1 / 60000);
        }
        catch (error) {
            this.dispose();
            throw error;
        }
    }
    #interactive(id) {
        return id !== undefined && this.instances.get(id)?.some(b => !!b.interact) === true;
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
    updateTarget() {
        this.target = null;
        this.prompt = null;
        this.promptText = '';
        const player = this.player;
        if (!player)
            return;
        if (player.held) {
            this.prompt = 'held';
            return;
        }
        // Closest collider wins, so walls block interaction with objects behind them.
        const hit = this.physics.world.castRay(player.ray(), 3, true, undefined, undefined, player.collider, player.body, this.#rayFilter);
        if (!hit)
            return;
        const id = this.physics.owners.get(hit.collider.handle);
        if (!id)
            return;
        const interact = this.instances.get(id)?.find(b => b.interact);
        if (interact) {
            this.target = id;
            this.prompt = 'use';
            this.promptText = interact.prompt?.() ?? 'Interact';
        }
        else if (hit.collider.parent()?.isDynamic()) {
            this.target = id;
            this.prompt = 'use';
            this.promptText = 'Pick up crate';
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
        for (const mesh of this.merged) {
            mesh.removeFromParent();
            mesh.geometry.dispose();
        }
        this.merged.length = 0;
        this.physics.dispose();
    }
}
