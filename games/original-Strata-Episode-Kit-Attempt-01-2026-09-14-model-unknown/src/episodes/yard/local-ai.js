import * as THREE from 'three/webgpu';
import { RAPIER } from '../../engine/PhysicsWorld.js';

const _from = new THREE.Vector3();
const _to = new THREE.Vector3();
const TURN = 4.2;          // radians per second while tracking the player
const AIM = .35;           // must face the player within this before firing
const angleTo = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

/**
 * Deliberately local: sentries use sight and a fire timer. No shared AI framework.
 * A sentry turns to face what it sees and fires once it is lined up, so the player can
 * read the threat; a defeated one topples instead of vanishing.
 */
export class YardSentries {
    api;
    actors = new Map();
    defeated = new Set();
    constructor(api, defeated) {
        this.api = api;
        const game = api.game;
        let index = 0;
        for (const [id, entity] of game.runtime.physics.entities) {
            if (!id.startsWith('guard-'))
                continue;
            // The visual parts turn on a pivot; the fixed body (and its box collider) stays put.
            const pivot = new THREE.Group();
            pivot.rotation.order = 'YXZ';
            for (const child of [...entity.root.children])
                pivot.add(child);
            entity.root.add(pivot);
            this.actors.set(id, { health: 100, cooldown: 1 + index++ * .4, entity, pivot, yaw: 0, targetYaw: 0, alert: 0, flash: 0, fall: -1, ray: new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }) });
        }
        for (const id of defeated)
            if (this.actors.has(id))
                this.disable(id, true);
        this.signal();
    }
    get remaining() { return this.actors.size - this.defeated.size; }
    hit(id, damage) {
        const actor = this.actors.get(id);
        if (!actor || this.defeated.has(id))
            return false;
        actor.health -= damage;
        actor.flash = .12;
        // Being shot turns a sentry toward the shooter even if it had not seen them.
        actor.alert = Math.max(actor.alert, .8);
        if (actor.health <= 0) {
            this.disable(id);
            this.signal();
            this.api.sound.cue('down');
            this.api.rumble(.45, 160);
            this.api.notice(this.remaining ? `Sentry down. ${this.remaining} left.` : 'All sentries down. The north gate is opening.');
        }
        return true;
    }
    disable(id, instant = false) {
        this.defeated.add(id);
        const actor = this.actors.get(id);
        for (const collider of actor.entity.colliders)
            collider.setEnabled(false);
        if (instant)
            actor.entity.root.visible = false;
        else
            actor.fall = 0;
    }
    signal() { this.api.game.runtime.signals.send('clear', this.remaining === 0, 'yard-ai'); }
    step(dt) {
        const game = this.api.game, physics = game.runtime.physics, player = game.player, target = player.body.translation();
        for (const [id, actor] of this.actors) {
            if (this.defeated.has(id))
                continue;
            actor.cooldown = Math.max(0, actor.cooldown - dt);
            actor.alert = Math.max(0, actor.alert - dt);
            const origin = actor.entity.body.translation();
            const dx = target.x - origin.x, dy = target.y + 1.1 - (origin.y + 1.45), dz = target.z - origin.z;
            const distance = Math.hypot(dx, dy, dz);
            let sees = false;
            if (distance <= 19 && distance > .01) {
                const ray = actor.ray;
                ray.origin.x = origin.x;
                ray.origin.y = origin.y + 1.45;
                ray.origin.z = origin.z;
                ray.dir.x = dx / distance;
                ray.dir.y = dy / distance;
                ray.dir.z = dz / distance;
                const hit = physics.world.castRay(ray, distance + .4, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, actor.entity.body);
                sees = hit?.collider.handle === player.collider.handle;
            }
            if (sees)
                actor.alert = 1.2;
            if (sees || actor.alert > 0)
                actor.targetYaw = Math.atan2(dx, dz);
            const turn = angleTo(actor.yaw, actor.targetYaw);
            actor.yaw += Math.sign(turn) * Math.min(Math.abs(turn), TURN * dt);
            if (sees && actor.cooldown === 0 && Math.abs(angleTo(actor.yaw, actor.targetYaw)) < AIM) {
                actor.cooldown = 1.35 * this.api.difficulty().reload;
                this.muzzle(actor, origin, _from);
                _to.set(target.x, target.y + 1.1, target.z);
                this.api.tracer(_from, _to, 'enemy');
                this.api.damagePlayer(9);
            }
        }
    }
    /** The sentry's gun tip in world space for its current facing. */
    muzzle(actor, origin, out) {
        const s = Math.sin(actor.yaw), c = Math.cos(actor.yaw);
        return out.set(origin.x + c * .35 + s * .73, origin.y + 1, origin.z - s * .35 + c * .73);
    }
    render(dt) {
        for (const [id, actor] of this.actors) {
            const pivot = actor.pivot;
            if (this.defeated.has(id)) {
                if (actor.fall < 0 || !actor.entity.root.visible)
                    continue;
                actor.fall += dt;
                pivot.rotation.x = -(Math.min(1, actor.fall / .45) ** 2) * Math.PI / 2;
                if (actor.fall > 1.2)
                    actor.entity.root.visible = false;
                continue;
            }
            pivot.rotation.y = actor.yaw;
            actor.flash = Math.max(0, actor.flash - dt);
            pivot.scale.setScalar(1 + actor.flash * .5);
        }
    }
}
