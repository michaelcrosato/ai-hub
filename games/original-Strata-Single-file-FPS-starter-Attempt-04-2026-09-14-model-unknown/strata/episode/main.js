/** EDIT HERE: local weapons, objectives, HUD, and episode rules.
 * mount() can be called again after dispose(). Do not add a second frame loop:
 * the page calls game.frame(dt) from its one kit.start() loop.
 * Pure movement settings are in #strata-config. Geometry is in episode/level.js and episode/pump-house.js.
 */
import * as THREE from 'three/webgpu';
import { FpsGame } from '../fps/FpsGame.js';
import { Vitals, Weapon, rifleSpec } from '../fps/combat.js';
import { RAPIER } from '../engine/PhysicsWorld.js';
import { overlapping } from '../engine/BehaviorSystem.js';
import { promptLabel } from '../engine/Input.js';
import { yardLevel } from './level.js';
import { pumpLevel, registerEpisodeArt, validateSupply } from './pump-house.js';
import { YardSentries, DIFFICULTY, difficultyOf } from './local-ai.js';
import { createStarterSession, downloadText } from './session.js';

/** The two episodes of the sample campaign, in order. */
export const EPISODES = {
    fps: { id: 'fps', number: '01', title: 'Loading Bay', verb: 'Enter loading bay', flag: 'yard-cleared', next: 'pump',
        lead: 'Clear the sentries. Use cover. Open the north gate and reach the car.', build: config => yardLevel(config) },
    pump: { id: 'pump', number: '02', title: 'Pump House', verb: 'Enter pump house', flag: 'pump-cleared', next: null,
        lead: 'Raise the shutter, collect three signal cells, clear four sentries and reach the exit gate.', build: config => pumpLevel(config) },
};
export const episodeOrder = ['fps', 'pump'];

export function formatTime(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const _from = new THREE.Vector3();
const _end = new THREE.Vector3();
const _dir = new THREE.Vector3();

/**
 * Build one episode on the shared kit and return its controls.
 * @param {object} kit       from kit/boot.js
 * @param {object} config    #strata-config
 * @param {object} options   { episode, fresh, sound, prefs, bindings, notice(text), mode(running), complete(result, summary) }
 */
export async function mount(kit, config = {}, options = {}) {
    const info = EPISODES[options.episode] ?? EPISODES.fps;
    const episodeId = info.id;
    const title = episodeId === 'fps' ? config.title ?? info.title : info.title;
    const el = id => {
        const node = document.getElementById(id);
        if (!node)
            throw new Error(`Required HUD element is missing: ${id}`);
        return node;
    };
    const hud = {
        title: el('hud-title'), objective: el('objective'), health: el('health'), remaining: el('remaining'), cells: el('cells'),
        cellsBox: el('cells-box'), time: el('hud-time'), ammo: el('ammo'), weaponState: el('weapon-state'), prompt: el('prompt'),
        crosshair: el('crosshair'), damage: el('damage'),
    };
    // HUD writes only when a value changes.
    const set = (node, value) => {
        if (node.__strataText !== value) {
            node.__strataText = value;
            node.textContent = value;
        }
    };
    const notice = text => options.notice?.(text);
    const sound = options.sound;
    const prefs = options.prefs ?? {};
    const label = action => promptLabel(action, kit.input.source, options.bindings);
    let game, sentries, completed = false, autosaveWarned = false;
    const stats = { time: 0, shots: 0, hits: 0, deaths: 0, difficulty: difficultyOf(prefs.difficulty).id };
    const summary = () => ({
        episode: episodeId, title, time: stats.time, shots: stats.shots, hits: stats.hits,
        accuracy: stats.shots ? stats.hits / stats.shots : 0, deaths: stats.deaths, difficulty: stats.difficulty,
        sentries: sentries?.total ?? 0, next: info.next,
    });
    const adapter = createStarterSession(config, result => {
        completed = true;
        // This is an in-page callback. It does not claim to load another page.
        options.complete?.(structuredClone(result), summary());
    }, notice, undefined, episodeId);
    const { session, scope } = adapter;
    try {
        const vitals = new Vitals(config.maxHealth ?? 100);
        const weapon = new Weapon({ ...rifleSpec, ...config.weapon });
        let hitTime = 0, hurtTime = 0, deadTime = 0, kick = 0, flashTime = 0;
        let saved = session.local;
        // A finished episode replays from the start; so does an explicit restart.
        if (options.fresh || saved.completed === true)
            saved = {};
        try {
            if (typeof saved.health === 'number' && typeof saved.armor === 'number')
                vitals.restore({ health: saved.health, armor: saved.armor });
            if (typeof saved.ammo === 'number' && typeof saved.reserve === 'number')
                weapon.restore({ ammo: saved.ammo, reserve: saved.reserve });
        }
        catch {
            vitals.reset();
            weapon.reset();
            notice('Part of the checkpoint was not valid. Health and ammunition were reset.');
        }
        if (!vitals.alive)
            vitals.reset();
        const strings = list => Array.isArray(list) ? list.filter(v => typeof v === 'string') : [];
        const defeated = strings(saved.defeated), collected = strings(saved.collected);
        if (saved.stats && typeof saved.stats === 'object') {
            for (const key of ['time', 'shots', 'hits', 'deaths'])
                if (Number.isFinite(saved.stats[key]) && saved.stats[key] >= 0)
                    stats[key] = saved.stats[key];
            if (DIFFICULTY[saved.stats.difficulty] && DIFFICULTY[saved.stats.difficulty].rank < difficultyOf(stats.difficulty).rank)
                stats.difficulty = saved.stats.difficulty;
        }
        const collectedIds = () => {
            const ids = [];
            for (const [id, list] of game?.runtime.instances ?? [])
                if (list.some(b => b.collected?.()))
                    ids.push(id);
            return ids;
        };
        const snapshot = () => ({
            defeated: [...(sentries?.defeated ?? defeated)], health: vitals.health, armor: vitals.armor,
            ammo: weapon.ammo, reserve: weapon.reserve, collected: collectedIds(),
            stats: { time: Math.round(stats.time * 100) / 100, shots: stats.shots, hits: stats.hits, deaths: stats.deaths, difficulty: stats.difficulty },
        });
        const autosave = () => {
            if (completed || session.transitioning)
                return;
            try {
                session.checkpoint(snapshot());
            }
            catch (error) {
                if (!autosaveWarned) {
                    autosaveWarned = true;
                    notice(`Autosave failed: ${String(error)}`);
                }
            }
        };
        const hurt = amount => {
            const result = vitals.damage(amount, .18);
            if (result.healthLost > 0) {
                hurtTime = .18;
                sound?.cue('hurt');
                kit.input.rumble(.5, 140);
            }
            if (result.killed) {
                stats.deaths++;
                deadTime = .7;
                sound?.cue('death');
                kit.input.rumble(.85, 320);
                game.player.respawn('death');
            }
        };
        const finish = () => {
            if (completed || session.transitioning)
                return;
            game.pause();
            sound?.cue('finish');
            try {
                session.complete('finish', {
                    local: { ...snapshot(), completed: true },
                    shared: { ...session.shared, [info.flag]: true, health: vitals.health, [episodeId === 'fps' ? 'sentries-defeated' : 'pump-sentries-defeated']: sentries?.defeated.size ?? 0 },
                });
            }
            catch (error) {
                notice(String(error));
            }
        };
        const shoot = g => {
            stats.shots++;
            kick = .08;
            flashTime = .05;
            sound?.cue('shot');
            kit.input.rumble(.16, 45);
            const physics = g.runtime.physics, range = weapon.spec.range, ray = g.player.ray();
            const hit = physics.world.castRay(ray, range, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, g.player.collider, g.player.body);
            const end = ray.pointAt(hit ? hit.timeOfImpact : range);
            _end.set(end.x, end.y, end.z);
            _dir.set(ray.dir.x, ray.dir.y, ray.dir.z);
            muzzle.getWorldPosition(_from);
            g.view.effects.tracer(_from, _end, 0xfff2b0, .03, .07);
            if (hit) {
                const id = physics.owners.get(hit.collider.handle);
                _end.addScaledVector(_dir, -.06);
                if (id && sentries?.hit(id, weapon.spec.damage)) {
                    hitTime = .12;
                    stats.hits++;
                    sound?.cue('hit');
                    g.view.effects.burst(_end, 0xff9b6a, 8, 3.6);
                }
                else
                    g.view.effects.burst(_end, 0xffd27a, 5, 2.6);
                const body = hit.collider.parent();
                if (body?.isDynamic())
                    body.applyImpulseAtPoint({ x: _dir.x * 5, y: _dir.y * 5, z: _dir.z * 5 }, { x: _end.x, y: _end.y, z: _end.z }, true);
            }
            g.player.pitch = Math.min(1.5, g.player.pitch + .007);
        };
        let cellBehaviors = [], lastPromptKind = null, lastHit = null, lastHurt = null, lastObjective = '';
        game = await FpsGame.create(kit, info.build(config), {
            notice,
            cue: kind => sound?.cue(kind),
            mode: running => {
                if (!session.transitioning)
                    options.mode?.(running);
            },
            configure: ({ prefabs, behaviors }) => {
                registerEpisodeArt(prefabs);
                behaviors.register('board-car', () => { }, () => ({
                    prompt: () => sentries?.remaining === 0 ? 'Drive out to the pump house' : 'Clear all sentries first',
                    interact: () => {
                        if (sentries?.remaining !== 0) {
                            notice('Clear all sentries before leaving.');
                            return;
                        }
                        finish();
                    },
                }));
                // Medkits and ammunition boxes: walk into one (or use it) when it would help.
                behaviors.register('supply', validateSupply, (entity, data, ctx) => {
                    let taken = false;
                    const health = data.kind === 'health', amount = data.amount ?? (health ? 40 : 24);
                    const full = () => health ? vitals.health >= vitals.maxHealth : weapon.reserve >= weapon.spec.reserve;
                    const take = (manual, quiet = false) => {
                        if (taken)
                            return;
                        if (!quiet && full()) {
                            if (manual)
                                ctx.notify(health ? 'Health is already full.' : 'Reserve ammunition is already full.');
                            return;
                        }
                        taken = true;
                        entity.root.visible = false;
                        for (const c of entity.colliders)
                            c.setEnabled(false);
                        if (quiet)
                            return;
                        if (health)
                            vitals.heal(amount);
                        else
                            weapon.reserve = Math.min(weapon.spec.reserve, weapon.reserve + amount);
                        ctx.notify(health ? `Medkit: +${amount} health` : `Ammunition: +${amount} rounds`);
                        ctx.cue('supply');
                        autosave();
                    };
                    return {
                        prompt: () => full() ? (health ? 'Medkit (health full)' : 'Ammunition (reserve full)') : (health ? 'Take medkit' : 'Take ammunition'),
                        interact: () => take(true),
                        afterStep: () => {
                            if (!taken && overlapping(entity, ctx))
                                take(false);
                        },
                        collected: () => taken,
                        restore: () => take(false, true),
                    };
                });
            },
            beforeStep: (dt, g) => {
                vitals.tick(dt);
                weapon.tick(dt);
                stats.time += dt;
                const current = difficultyOf(prefs.difficulty);
                if (current.rank < difficultyOf(stats.difficulty).rank)
                    stats.difficulty = current.id;
                if (g.input.consume('reload') && weapon.reload())
                    sound?.cue('reload');
                const held = !!g.player.held;
                const pressed = held ? false : g.input.consume('fire');
                if (!held && weapon.fire(pressed, g.input.down('fire')))
                    shoot(g);
                else if (pressed && weapon.ammo === 0 && !weapon.reloading)
                    sound?.cue(weapon.reload() ? 'reload' : 'empty');
            },
            afterStep: dt => sentries?.step(dt),
            render: (dt, g) => {
                hitTime = Math.max(0, hitTime - dt);
                hurtTime = Math.max(0, hurtTime - dt);
                deadTime = Math.max(0, deadTime - dt);
                kick = Math.max(0, kick - dt * 3);
                flashTime = Math.max(0, flashTime - dt);
                sentries?.render(dt);
                set(hud.health, String(Math.ceil(vitals.health)));
                set(hud.ammo, `${weapon.ammo} / ${weapon.reserve}`);
                set(hud.weaponState, weapon.reloading ? `Reloading ${Math.round(weapon.reloadProgress * 100)}%`
                    : weapon.ammo === 0 && weapon.reserve === 0 ? 'Rifle / out of ammunition' : `Rifle / ${label('reload')} to reload`);
                set(hud.remaining, String(sentries?.remaining ?? 0));
                set(hud.time, formatTime(stats.time));
                if (cellBehaviors.length)
                    set(hud.cells, `${cellBehaviors.filter(b => b.collected()).length} / ${cellBehaviors.length}`);
                const kind = g.runtime.promptKind;
                set(hud.prompt, kind === 'held' ? `${label('interact')} · Drop     /     ${label('fire')} · Throw` : kind ? `${label('interact')} · ${g.runtime.prompt}` : '');
                if (kind !== lastPromptKind) {
                    lastPromptKind = kind;
                    kit.touch?.setShown('interact', !!kind);
                }
                const hitOn = hitTime > 0;
                if (hitOn !== lastHit) {
                    lastHit = hitOn;
                    hud.crosshair.classList.toggle('hit', hitOn);
                }
                const hurtState = deadTime > 0 ? 'dead' : hurtTime > 0 ? 'hurt' : '';
                if (hurtState !== lastHurt) {
                    lastHurt = hurtState;
                    hud.damage.style.opacity = hurtState ? '1' : '0';
                    hud.damage.classList.toggle('dead', hurtState === 'dead');
                }
                const objective = objectiveText(g);
                if (objective !== lastObjective) {
                    lastObjective = objective;
                    hud.objective.textContent = objective;
                }
                // View model: walk bob (scaled by the head movement setting), recoil kick and muzzle flash.
                const motor = g.player.motor, speed = Math.hypot(motor.vx, motor.vz);
                const bob = motor.grounded ? Math.min(speed / 5, 1) * .012 * Math.min(1.5, (motor.settings.headBob ?? .2) / .2) : 0;
                gun.position.set(.27 + Math.sin(g.player.phase) * bob, -.23 - Math.abs(Math.cos(g.player.phase)) * bob * .6, -.75 + kick);
                gun.visible = !g.player.held;
                if (flashTime > 0) {
                    flash.scale.set(.09, .09, .16);
                    flash.rotation.z = Math.random() * Math.PI;
                }
                else
                    flash.scale.setScalar(.0001);
            },
            complete: () => finish(),
        });
        scope.own(() => game.dispose());
        const objectiveText = g => {
            const values = g.runtime.signals.values;
            if (episodeId === 'fps')
                return sentries?.remaining === 0 ? `Gate open. Reach the car. Press ${label('interact')} to drive out.`
                    // The authored objective names the keyboard key; show the button for the device in use.
                    : (config.objective ?? 'Clear three sentries. Reach the car. Press E to finish.').replace(/\bPress E\b/, `Press ${label('interact')}`);
            if (values.get('exit') === true)
                return 'Exit gate powered. Reach the gate.';
            if (values.get('power') === true)
                return 'Power restored. Clear the remaining sentries.';
            if (values.get('clear') === true)
                return 'Sentries down. Collect the remaining signal cells.';
            return g.runtime.data.objective;
        };
        game.player.onRespawn = reason => {
            if (reason === 'death') {
                vitals.reset();
                weapon.reset();
                notice('Taken down. Back at the last checkpoint with full health and a fresh rifle. Defeated sentries stay down.');
            }
            else if (reason === 'hazard')
                hurt(15);
            else if (reason === 'manual')
                notice('Returned to the last checkpoint.');
        };
        sentries = new YardSentries(game, defeated, amount => hurt(amount), {
            cue: kind => sound?.cue(kind),
            difficulty: () => difficultyOf(prefs.difficulty),
            onDefeat: () => {
                sound?.cue('kill');
                kit.input.rumble(.35, 120);
                hitTime = .22;
                if (sentries.remaining === 0)
                    notice(episodeId === 'fps' ? 'All sentries down. The north gate is opening.' : 'All sentries down.');
                autosave();
            },
        });
        // Restore cells and supplies taken before the checkpoint (their signals reach counters on the first step).
        for (const id of collected)
            for (const behavior of game.runtime.instances.get(id) ?? [])
                behavior.restore?.();
        for (const [id, list] of game.runtime.instances)
            for (const behavior of list)
                if (game.runtime.physics.entities.get(id)?.data.prefab === 'pickup' && behavior.collected)
                    cellBehaviors.push(behavior);
        hud.cellsBox.hidden = cellBehaviors.length === 0;
        scope.own(game.runtime.signals.on('cell', () => autosave()));
        scope.own(game.runtime.signals.on('power', s => {
            if (s.value === true)
                notice('All three cells are in. Power restored.');
        }));
        scope.own(game.runtime.signals.on('exit', s => {
            if (s.value === true) {
                notice('Exit gate powered. Reach the gate.');
                sound?.cue('checkpoint');
            }
        }));
        set(hud.title, title);
        kit.touch?.setShown('interact', false);
        // A local view model. It has no physics body.
        const gun = new THREE.Group(), geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshStandardMaterial({ color: '#31463e', roughness: .9 });
        const accent = new THREE.MeshStandardMaterial({ color: '#e0bd76', roughness: .8 });
        const flashMaterial = new THREE.MeshBasicMaterial({ color: '#ffe7a3', toneMapped: false });
        const piece = (size, pos, m) => {
            const mesh = new THREE.Mesh(geometry, m);
            mesh.scale.set(...size);
            mesh.position.set(...pos);
            gun.add(mesh);
            return mesh;
        };
        piece([.15, .17, .6], [0, 0, 0], material);
        piece([.07, .06, .4], [0, .04, -.4], material);
        piece([.11, .22, .12], [0, -.12, .12], accent);
        // The flash stays in the scene at a hair's width so its shader is ready before the first shot.
        const flash = piece([.0001, .0001, .0001], [0, .04, -.66], flashMaterial);
        const muzzle = new THREE.Object3D();
        muzzle.position.set(0, .04, -.62);
        gun.add(muzzle);
        gun.position.set(.27, -.23, -.75);
        game.view.camera.add(gun);
        game.view.scene.add(game.view.camera);
        scope.own(() => {
            gun.removeFromParent();
            geometry.dispose();
            material.dispose();
            accent.dispose();
            flashMaterial.dispose();
        });
        const applyPrefs = p => {
            const settings = game.player.motor.settings;
            if (Number.isFinite(p.fov))
                settings.fov = p.fov;
            if (Number.isFinite(p.headBob))
                settings.headBob = p.headBob;
            if (Number.isFinite(p.volume))
                sound?.setVolume(p.volume);
        };
        applyPrefs(prefs);
        // A restart (or a replay of a finished episode) replaces the stored checkpoint right away,
        // so leaving now cannot bring back the old run.
        if (options.fresh || session.local.completed === true)
            autosave();
        if (new URL(location.href).searchParams.has('test')) {
            window.strataTest = { game, vitals, weapon, sentries, session };
            scope.own(() => { delete window.strataTest; });
        }
        return {
            game, session, scope, episode: episodeId, info, title, persistence: adapter.persistence,
            get completed() { return completed; },
            get started() { return stats.time > 0 || defeated.length > 0; },
            play: () => game.play(),
            pause: () => game.pause(),
            returnToStart: () => game.player?.respawn('manual'),
            save() {
                session.checkpoint(snapshot());
                return adapter.persistence;
            },
            exportSave() {
                if (!session.transitioning)
                    session.checkpoint(snapshot());
                downloadText('strata-fps-save.json', session.export());
            },
            importSave: text => adapter.importSave(text),
            reset: () => adapter.reset(),
            applyPrefs,
            summary,
            frame: dt => game.frame(dt),
            dispose: () => scope.dispose(),
        };
    }
    catch (error) {
        try {
            scope.dispose();
        }
        catch (disposeError) {
            console.error(disposeError);
        }
        notice(`Starter failed: ${String(error)}`);
        throw error;
    }
}
