import * as THREE from 'three/webgpu';
import { RAPIER } from '../engine/PhysicsWorld.js';

/** Sentry tuning per difficulty. Standard keeps the starter's original damage, fire rate and sight range. */
export const DIFFICULTY = {
    easy: { id: 'easy', label: 'Relaxed', rank: 0, damage: 6, cooldown: 1.7, range: 16, reaction: .9 },
    normal: { id: 'normal', label: 'Standard', rank: 1, damage: 9, cooldown: 1.35, range: 19, reaction: .55 },
    hard: { id: 'hard', label: 'Veteran', rank: 2, damage: 13, cooldown: 1, range: 23, reaction: .3 },
};
export const difficultyOf = id => DIFFICULTY[id] ?? DIFFICULTY.normal;

const EYE = 1.45, CHEST = 1.1, TAU = Math.PI * 2;
const wrap = a => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;
const _muzzle = new THREE.Vector3();
const _target = new THREE.Vector3();
const _visor = new THREE.Vector3();

/**
 * Deliberately local: sentries use sight, a short aim and a fire timer. No shared AI framework.
 * Sentries are fixed bodies; only their visuals turn (on a pivot), recoil and topple.
 */
export class YardSentries {
    game;
    damagePlayer;
    hooks;
    actors = new Map();
    defeated = new Set();
    time = 0;
    ray;
    /**
     * @param {object} [hooks] { cue(kind), difficulty() → DIFFICULTY entry, onDefeat(id) }
     */
    constructor(game, defeated, damagePlayer, hooks = {}) {
        this.game = game;
        this.damagePlayer = damagePlayer;
        this.hooks = hooks;
        this.ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
        let index = 0;
        for (const [id, entity] of game.runtime.physics.entities) {
            if (!id.startsWith('guard-'))
                continue;
            const pivot = new THREE.Group();
            pivot.rotation.order = 'YXZ';
            for (const child of [...entity.root.children])
                pivot.add(child);
            entity.root.add(pivot);
            this.actors.set(id, { health: 100, cooldown: 1 + index * .4, sightCheck: index * .025, sight: false, aim: 0, yaw: 0, targetYaw: 0, recoil: 0, dying: -1, phase: index * 1.7, pivot, entity });
            index++;
        }
        for (const id of defeated)
            if (this.actors.has(id))
                this.disable(id, true);
        this.signal();
    }
    get params() { return this.hooks.difficulty?.() ?? DIFFICULTY.normal; }
    get remaining() { return this.actors.size - this.defeated.size; }
    get total() { return this.actors.size; }
    hit(id, damage) {
        const actor = this.actors.get(id);
        if (!actor || this.defeated.has(id))
            return false;
        actor.health -= damage;
        actor.recoil = Math.max(actor.recoil, .7);
        // A sentry that is shot turns toward the shooter at once.
        const t = this.game.player.body.translation(), o = actor.entity.body.translation();
        actor.targetYaw = Math.atan2(t.x - o.x, t.z - o.z);
        actor.sightCheck = 0;
        if (actor.health <= 0) {
            this.disable(id);
            this.signal();
            this.hooks.onDefeat?.(id);
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
            actor.dying = 0;
    }
    signal() { this.game.runtime.signals.send('clear', this.remaining === 0, 'yard-ai'); }
    #lineOfSight(entity, origin, dx, dy, dz, distance) {
        const r = this.ray;
        r.origin.x = origin.x; r.origin.y = origin.y + EYE; r.origin.z = origin.z;
        r.dir.x = dx / distance; r.dir.y = dy / distance; r.dir.z = dz / distance;
        const hit = this.game.runtime.physics.world.castRay(r, distance + .4, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, entity.body);
        return hit?.collider.handle === this.game.player.collider.handle;
    }
    /** The gun's muzzle (local 0.35, 1, 0.725) at the sentry's current visual heading. */
    #muzzle(actor, origin) {
        const c = Math.cos(actor.yaw), s = Math.sin(actor.yaw);
        return _muzzle.set(origin.x + .35 * c + .725 * s, origin.y + 1, origin.z - .35 * s + .725 * c);
    }
    step(dt) {
        const player = this.game.player, p = this.params;
        for (const [id, actor] of this.actors) {
            if (this.defeated.has(id))
                continue;
            actor.cooldown = Math.max(0, actor.cooldown - dt);
            const target = player.body.translation(), origin = actor.entity.body.translation();
            const dx = target.x - origin.x, dy = target.y + CHEST - (origin.y + EYE), dz = target.z - origin.z;
            const distance = Math.hypot(dx, dy, dz);
            // Sight is checked ten times a second per sentry, staggered, not on every step.
            actor.sightCheck -= dt;
            if (actor.sightCheck <= 0) {
                actor.sightCheck = .1;
                const seen = distance <= p.range && distance > .01 && this.#lineOfSight(actor.entity, origin, dx, dy, dz, distance);
                if (seen && !actor.sight) {
                    actor.aim = 0;
                    this.hooks.cue?.('alert');
                }
                actor.sight = seen;
            }
            if (!actor.sight) {
                actor.aim = 0;
                continue;
            }
            actor.targetYaw = Math.atan2(dx, dz);
            actor.aim += dt;
            // A fresh sighting gives a short aim (the red eye) before the first shot.
            if (actor.aim < p.reaction || actor.cooldown > 0)
                continue;
            // Fire only along a clear line right now: the cached sight may be a tenth of a second old.
            if (distance > .01 && this.#lineOfSight(actor.entity, origin, dx, dy, dz, distance)) {
                actor.cooldown = p.cooldown;
                actor.recoil = 1;
                this.game.view.effects.tracer(this.#muzzle(actor, origin), _target.set(target.x, target.y + CHEST, target.z), 0xff7a52, .04, .1);
                this.hooks.cue?.('enemy');
                this.damagePlayer(p.damage, id);
            }
            else
                actor.sight = false;
        }
    }
    /** Visual only: turn, recoil, aim glow and the topple of a defeated sentry. */
    render(dt) {
        this.time += dt;
        const p = this.params, effects = this.game.view.effects;
        for (const [id, actor] of this.actors) {
            const pivot = actor.pivot;
            if (actor.dying >= 0) {
                if (actor.dying >= 1)
                    continue;
                actor.dying = Math.min(1, actor.dying + dt / .55);
                const t = actor.dying * actor.dying;
                pivot.rotation.x = -t * 1.45;
                pivot.position.y = -t * .25;
                if (actor.dying >= 1)
                    actor.entity.root.visible = false;
                continue;
            }
            if (this.defeated.has(id))
                continue;
            const goal = actor.sight ? actor.targetYaw : actor.targetYaw + Math.sin(this.time * .6 + actor.phase) * .35;
            const diff = wrap(goal - actor.yaw);
            actor.yaw += Math.sign(diff) * Math.min(Math.abs(diff), (actor.sight ? 5 : 1.2) * dt);
            actor.recoil = Math.max(0, actor.recoil - dt * 5);
            pivot.rotation.y = actor.yaw;
            pivot.rotation.x = -actor.recoil * .14;
            if (actor.sight && (actor.aim < p.reaction || actor.cooldown < .3)) {
                const o = actor.entity.root.position, c = Math.cos(actor.yaw), s = Math.sin(actor.yaw);
                _visor.set(o.x + .31 * s, o.y + 1.58, o.z + .31 * c);
                effects.glow(_visor, 0xff4a3a, Math.sin(this.time * 28) > 0 ? .15 : .12);
            }
        }
    }
}
