import { radians } from '../core/math.js';
import { PhysicsWorld } from './PhysicsWorld.js';
import { Player } from './Player.js';

/** Level entities, their behaviors, the player, and the interaction target on one fixed clock. */
export class Runtime {
    data;
    renderWorld;
    physics;
    instances = new Map();
    roots = [];
    player = null;
    target = null;
    /** What the interact action would do right now, without the key (the HUD adds the device's label). */
    prompt = '';
    alive = true;
    constructor(data, renderWorld, input, prefabs, behaviors, notify) {
        this.data = data;
        this.renderWorld = renderWorld;
        this.physics = new PhysicsWorld(-data.player.gravity);
        try {
            for (const entity of data.entities) {
                const blueprint = prefabs.get(entity.prefab).build(entity), root = renderWorld.create(entity, blueprint);
                this.roots.push(root);
                this.physics.create(entity, blueprint, root);
            }
            const spawn = data.entities.find(e => e.components.some(c => c.type === 'spawn'));
            const spawnComponent = spawn.components.find(c => c.type === 'spawn');
            this.player = new Player(this.physics, input, renderWorld.camera, data.player, spawn.position, radians(Number(spawnComponent.yaw ?? 0)));
            const ctx = { physics: this.physics, player: this.player, notify };
            for (const entity of this.physics.entities.values()) {
                const list = [];
                this.instances.set(entity.data.id, list);
                for (const component of entity.data.components)
                    list.push(behaviors.create(component.type, entity, component, ctx));
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
        for (const list of this.instances.values())
            for (const b of list)
                b.beforeStep?.(dt);
        this.player.beforeStep(dt);
        this.physics.step(dt);
        this.player.afterStep();
        for (const list of this.instances.values())
            for (const b of list)
                b.afterStep?.(dt);
        this.updateTarget();
    }
    updateTarget() {
        this.target = null;
        this.prompt = '';
        const player = this.player;
        if (!player)
            return;
        if (player.held) {
            this.prompt = 'Drop / fire to throw';
            return;
        }
        // Closest collider wins, so walls block interaction with objects behind them.
        const hit = this.physics.world.castRay(player.ray(), 3, true, undefined, undefined, player.collider, player.body, c => !c.isSensor() || this.physics.owners.get(c.handle) !== undefined && this.instances.get(this.physics.owners.get(c.handle))?.some(b => !!b.interact) === true);
        if (!hit)
            return;
        const id = this.physics.owners.get(hit.collider.handle);
        if (!id)
            return;
        const interact = this.instances.get(id)?.find(b => b.interact);
        if (interact) {
            this.target = id;
            this.prompt = interact.prompt?.() ?? 'Interact';
        }
        // Loose vehicle debris is dynamic but belongs to a kinematic vehicle entity, which cannot be
        // carried. Offer a pick-up only when the owning entity itself is a dynamic body.
        else if (this.physics.entities.get(id)?.body.isDynamic()) {
            this.target = id;
            this.prompt = 'Pick up';
        }
    }
    render(alpha, dt) {
        this.physics.interpolate(alpha);
        this.player?.render(alpha, dt);
        for (const list of this.instances.values())
            for (const b of list)
                b.render?.(dt);
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
        for (const root of this.roots)
            root.removeFromParent();
        this.roots.length = 0;
        this.physics.dispose();
    }
}
