import * as THREE from 'three/webgpu';
import { RAPIER } from '../../engine/PhysicsWorld.js';
import { radians } from '../../core/math.js';

const _from = new THREE.Vector3();
const _to = new THREE.Vector3();
const angleTo = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

const RANGE = 22;          // metres a lamp reaches
const CONE = .45;          // half-angle of the lamp's beam: it only sees what it lights
const SWEEP = 1.0;         // radians either side of the sentry's post
const SWEEP_RATE = .55;    // sweep speed (phase radians per second)
const TRACK = 2.4;         // turn rate while tracking
const AIM = .2;            // lined up enough to fire
const GIVE_UP = 2.5;       // seconds without sight before it resumes the sweep

/**
 * Local to this episode, like the Loading Bay's sentries but with other rules: a lamp sentry
 * sweeps its post and sees only what its lamp lights. Once it finds the player it tracks
 * them and fires; break line of sight long enough and it goes back to sweeping. The lamp
 * cone is drawn, so the player can time a run past it or shoot it out.
 */
export class LampSentries {
    api;
    actors = new Map();
    defeated = new Set();
    cone;
    calm;
    alert;
    constructor(api, defeated) {
        this.api = api;
        const game = api.game;
        // One open cone shared by every lamp; two shared materials (calm and alert).
        const length = 7;
        this.cone = new THREE.ConeGeometry(Math.tan(CONE) * length, length, 18, 1, true);
        this.cone.translate(0, -length / 2, 0);
        this.cone.rotateX(-Math.PI / 2);
        this.calm = new THREE.MeshBasicMaterial({ color: '#ffe39a', transparent: true, opacity: .11, depthWrite: false, side: THREE.DoubleSide });
        this.alert = new THREE.MeshBasicMaterial({ color: '#ff7a5c', transparent: true, opacity: .17, depthWrite: false, side: THREE.DoubleSide });
        let index = 0;
        for (const [id, entity] of game.runtime.physics.entities) {
            if (!id.startsWith('lamp-'))
                continue;
            const pivot = new THREE.Group();
            pivot.rotation.order = 'YXZ';
            for (const child of [...entity.root.children])
                pivot.add(child);
            entity.root.add(pivot);
            const beam = new THREE.Mesh(this.cone, this.calm);
            beam.position.set(0, 1.67, .33);
            beam.rotation.x = .12;
            pivot.add(beam);
            const base = radians(entity.data.rotation[1]);
            this.actors.set(id, { health: 100, cooldown: .8, entity, pivot, beam, base, yaw: base, phase: index++ * 2.1, tracking: 0, flash: 0, fall: -1, ray: new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }) });
        }
        for (const id of defeated)
            if (this.actors.has(id))
                this.disable(id, true);
    }
    get remaining() { return this.actors.size - this.defeated.size; }
    hit(id, damage) {
        const actor = this.actors.get(id);
        if (!actor || this.defeated.has(id))
            return false;
        actor.health -= damage;
        actor.flash = .12;
        actor.tracking = Math.max(actor.tracking, GIVE_UP);
        if (actor.health <= 0) {
            this.disable(id);
            this.api.sound.cue('down');
            this.api.rumble(.45, 160);
            this.api.notice(this.remaining ? `Lamp sentry down. ${this.remaining} still sweeping.` : 'Every lamp sentry is down.');
        }
        return true;
    }
    disable(id, instant = false) {
        this.defeated.add(id);
        const actor = this.actors.get(id);
        for (const collider of actor.entity.colliders)
            collider.setEnabled(false);
        actor.beam.visible = false;
        if (instant)
            actor.entity.root.visible = false;
        else
            actor.fall = 0;
    }
    step(dt) {
        const game = this.api.game, physics = game.runtime.physics, player = game.player, target = player.body.translation();
        for (const [id, actor] of this.actors) {
            if (this.defeated.has(id))
                continue;
            actor.cooldown = Math.max(0, actor.cooldown - dt);
            const origin = actor.entity.body.translation();
            const dx = target.x - origin.x, dy = target.y + 1.1 - (origin.y + 1.67), dz = target.z - origin.z;
            const distance = Math.hypot(dx, dy, dz);
            const toPlayer = Math.atan2(dx, dz);
            const lit = distance <= RANGE && distance > .01 && Math.abs(angleTo(actor.yaw, toPlayer)) < CONE;
            let sees = false;
            if (lit || (actor.tracking > 0 && distance <= RANGE)) {
                const ray = actor.ray;
                ray.origin.x = origin.x;
                ray.origin.y = origin.y + 1.67;
                ray.origin.z = origin.z;
                ray.dir.x = dx / distance;
                ray.dir.y = dy / distance;
                ray.dir.z = dz / distance;
                const hit = physics.world.castRay(ray, distance + .4, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, actor.entity.body);
                sees = hit?.collider.handle === player.collider.handle;
            }
            if (sees && actor.tracking <= 0) {
                this.api.sound.cue('switch', .7);
                actor.cooldown = Math.max(actor.cooldown, .45 * this.api.difficulty().reload);
            }
            if (sees)
                actor.tracking = GIVE_UP;
            else
                actor.tracking = Math.max(0, actor.tracking - dt);
            if (actor.tracking > 0) {
                const turn = angleTo(actor.yaw, toPlayer);
                actor.yaw += Math.sign(turn) * Math.min(Math.abs(turn), TRACK * dt);
                if (sees && actor.cooldown === 0 && Math.abs(angleTo(actor.yaw, toPlayer)) < AIM) {
                    actor.cooldown = 1.2 * this.api.difficulty().reload;
                    const s = Math.sin(actor.yaw), c = Math.cos(actor.yaw);
                    _from.set(origin.x + c * .3 + s * .72, origin.y + 1.48, origin.z - s * .3 + c * .72);
                    _to.set(target.x, target.y + 1.1, target.z);
                    this.api.tracer(_from, _to, 'enemy');
                    this.api.damagePlayer(8);
                }
                // Resume the sweep from wherever tracking left the lamp.
                actor.phase = Math.asin(Math.max(-1, Math.min(1, angleTo(actor.base, actor.yaw) / SWEEP)));
            }
            else {
                actor.phase += SWEEP_RATE * dt;
                const want = actor.base + Math.sin(actor.phase) * SWEEP;
                const turn = angleTo(actor.yaw, want);
                actor.yaw += Math.sign(turn) * Math.min(Math.abs(turn), TRACK * dt);
            }
        }
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
            pivot.rotation.y = angleTo(actor.base, actor.yaw);
            const material = actor.tracking > 0 ? this.alert : this.calm;
            if (actor.beam.material !== material)
                actor.beam.material = material;
            actor.flash = Math.max(0, actor.flash - dt);
            pivot.scale.setScalar(1 + actor.flash * .5);
        }
    }
    /** Both beam materials in view while the episode compiles, so the first alert never stalls. */
    prewarm(on) {
        const first = this.actors.values().next().value;
        if (first && !this.defeated.has(first.entity.data.id))
            first.beam.material = on ? this.alert : this.calm;
    }
    dispose() {
        this.cone.dispose();
        this.calm.dispose();
        this.alert.dispose();
    }
}

/**
 * Surf that washes over the causeway on a timer. The starter's hazard component returns the
 * player to the checkpoint; this local rule only switches its sensor on while a wave is up
 * and draws the foam rising first, so the crossing is a matter of timing.
 */
export class Surf {
    waves = [];
    geometry = new THREE.BoxGeometry(1, 1, 1);
    material = new THREE.MeshStandardMaterial({ color: '#e8f4f0', roughness: .4, transparent: true, opacity: .72, depthWrite: false });
    time = 0;
    constructor(game, ids) {
        ids.forEach((id, i) => {
            const entity = game.runtime.physics.entities.get(id);
            if (!entity)
                return;
            const foam = new THREE.Mesh(this.geometry, this.material);
            foam.scale.set(2, .01, 2);
            foam.position.set(0, .005, 0);
            entity.root.add(foam);
            this.waves.push({ entity, foam, offset: i * 1.15, active: true });
        });
    }
    step(dt) {
        this.time += dt;
        const cycle = 4.6;
        for (const w of this.waves) {
            const u = (this.time + w.offset) % cycle;
            const active = u < 1.5;
            if (active !== w.active) {
                w.active = active;
                for (const c of w.entity.colliders)
                    if (c.isSensor())
                        c.setEnabled(active);
            }
            // Foam: rises in the last 0.7 s before a wave, stands while it is active, then drains.
            const h = active ? 1.1 : u > cycle - .7 ? (u - (cycle - .7)) / .7 * .5 : Math.max(0, 1.1 - (u - 1.5) * 3);
            w.height = Math.max(.01, h);
        }
    }
    render() {
        for (const w of this.waves) {
            w.foam.scale.y = w.height ?? .01;
            w.foam.position.y = (w.height ?? .01) / 2;
        }
    }
    dispose() {
        this.geometry.dispose();
        this.material.dispose();
    }
}

/** The lighthouse lamp: a rotating pair of light cones once the beacon is lit. */
export class BeaconBeam {
    group = new THREE.Group();
    geometry;
    material = new THREE.MeshBasicMaterial({ color: '#fff4c2', transparent: true, opacity: .2, depthWrite: false, side: THREE.DoubleSide });
    lamp = null;
    lit = false;
    time = 0;
    /** `root`: the beacon prefab's root object (in a level, or in the portal's diorama). */
    constructor(root) {
        const length = 34;
        this.geometry = new THREE.ConeGeometry(2.2, length, 20, 1, true);
        this.geometry.translate(0, -length / 2, 0);
        this.geometry.rotateX(-Math.PI / 2);
        for (const sign of [1, -1]) {
            const cone = new THREE.Mesh(this.geometry, this.material);
            cone.rotation.y = sign > 0 ? 0 : Math.PI;
            this.group.add(cone);
        }
        this.group.visible = false;
        if (root) {
            this.group.position.set(0, 1.2, 0);
            root.add(this.group);
            // The lamp sphere inside the glass of the beacon prefab.
            this.lamp = root.children.find(c => c.geometry?.type === 'IcosahedronGeometry' && c.scale.x < .5) ?? null;
        }
    }
    light() { this.lit = true; this.group.visible = true; }
    dark() { this.lit = false; this.group.visible = false; }
    render(dt) {
        if (!this.lit)
            return;
        this.time += dt;
        this.group.rotation.y = this.time * .9;
        if (this.lamp)
            this.lamp.scale.setScalar(.42 + Math.sin(this.time * 6) * .03);
    }
    prewarm(on) { if (!this.lit) this.group.visible = on; }
    dispose() {
        this.group.removeFromParent();
        this.geometry.dispose();
        this.material.dispose();
    }
}
