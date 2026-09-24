import { RAPIER } from '../../engine/PhysicsWorld.js';
/** Deliberately local: sentries use sight and a fire timer. No shared AI framework. */
export class YardSentries {
    game;
    damagePlayer;
    actors = new Map();
    defeated = new Set();
    constructor(game, defeated, damagePlayer) {
        this.game = game;
        this.damagePlayer = damagePlayer;
        let index = 0;
        for (const [id] of game.runtime.physics.entities)
            if (id.startsWith('guard-'))
                this.actors.set(id, { health: 100, cooldown: 1 + index++ * .4 });
        for (const id of defeated)
            if (this.actors.has(id))
                this.disable(id);
        this.signal();
    }
    get remaining() { return this.actors.size - this.defeated.size; }
    hit(id, damage) {
        const actor = this.actors.get(id);
        if (!actor || this.defeated.has(id))
            return false;
        actor.health -= damage;
        if (actor.health <= 0) {
            this.disable(id);
            this.signal();
        }
        return true;
    }
    disable(id) {
        this.defeated.add(id);
        const entity = this.game.runtime.physics.entities.get(id);
        entity.root.visible = false;
        for (const collider of entity.colliders)
            collider.setEnabled(false);
    }
    signal() { this.game.runtime.signals.send('clear', this.remaining === 0, 'yard-ai'); }
    step(dt) {
        const physics = this.game.runtime.physics, target = this.game.player.body.translation();
        for (const [id, actor] of this.actors) {
            if (this.defeated.has(id))
                continue;
            actor.cooldown = Math.max(0, actor.cooldown - dt);
            const entity = physics.entities.get(id), origin = entity.body.translation();
            const dx = target.x - origin.x, dy = target.y + 1.1 - (origin.y + 1.45), dz = target.z - origin.z;
            const distance = Math.hypot(dx, dy, dz);
            if (distance > 19 || distance < .01 || actor.cooldown > 0)
                continue;
            const ray = new RAPIER.Ray({ x: origin.x, y: origin.y + 1.45, z: origin.z }, { x: dx / distance, y: dy / distance, z: dz / distance });
            const hit = physics.world.castRay(ray, distance + .4, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, entity.body);
            if (hit?.collider.handle === this.game.player.collider.handle) {
                actor.cooldown = 1.35;
                this.damagePlayer(9);
            }
        }
    }
}
