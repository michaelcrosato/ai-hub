import * as THREE from 'three';
import { connectEpisode, downloadText } from '../../kit/browser.js';
import { FpsGame } from '../../fps/FpsGame.js';
import { Vitals, Weapon } from '../../fps/combat.js';
import { Sound } from '../../fps/sound.js';
import { RAPIER } from '../../engine/PhysicsWorld.js';
import { registerYardArt, yardLevel } from './level.js';
import { YardSentries } from './local-ai.js';
const el = (id) => document.getElementById(id);
const notice = (text) => { el('notice').textContent = text; el('status').textContent = text; };
let cleanup;
try {
    const { session, scope } = await connectEpisode('yard', new URL('../../campaign.json', location.href), notice);
    cleanup = () => scope.dispose();
    const vitals = new Vitals(), weapon = new Weapon(), sound = new Sound();
    scope.own(() => sound.dispose());
    let sentries, hitTime = 0, hurtTime = 0, kick = 0;
    const saved = session.local;
    if (typeof saved.health === 'number' && typeof saved.armor === 'number')
        vitals.restore({ health: saved.health, armor: saved.armor });
    if (!vitals.alive)
        vitals.reset();
    if (typeof saved.ammo === 'number' && typeof saved.reserve === 'number')
        weapon.restore({ ammo: saved.ammo, reserve: saved.reserve });
    const defeated = Array.isArray(saved.defeated) ? saved.defeated.filter((v) => typeof v === 'string') : [];
    const snapshot = () => ({ defeated: [...(sentries?.defeated ?? [])], health: vitals.health, armor: vitals.armor, ammo: weapon.ammo, reserve: weapon.reserve });
    const game = await FpsGame.create(el('viewport'), yardLevel(), {
        notice,
        mode: running => { el('menu').hidden = running; el('play').textContent = 'Resume'; },
        configure: ({ prefabs, behaviors }) => {
            registerYardArt(prefabs);
            behaviors.register('board-car', () => { }, () => ({
                prompt: () => sentries?.remaining === 0 ? 'Board car / load Coast Road' : 'Clear all sentries first',
                interact: () => {
                    if (sentries?.remaining !== 0) {
                        notice('Clear all sentries before leaving.');
                        return;
                    }
                    game.pause();
                    try {
                        session.complete('drive', { local: snapshot(), shared: { ...session.shared, 'yard-cleared': true, health: vitals.health, 'sentries-defeated': sentries.defeated.size } });
                    }
                    catch (error) {
                        notice(String(error));
                    }
                },
            }));
        },
        beforeStep: (dt, game) => {
            vitals.tick(dt);
            weapon.tick(dt);
            hitTime = Math.max(0, hitTime - dt);
            hurtTime = Math.max(0, hurtTime - dt);
            kick = Math.max(0, kick - dt * 3);
            if (game.input.consume('reload'))
                weapon.reload();
            if (!game.player.held && weapon.fire(game.input.consume('fire'), game.input.down('fire'))) {
                sound.cue('shot');
                kick = .08;
                const physics = game.runtime.physics;
                const hit = physics.world.castRay(game.player.ray(), weapon.spec.range, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, game.player.collider, game.player.body);
                if (hit) {
                    const id = physics.owners.get(hit.collider.handle);
                    if (id && sentries?.hit(id, weapon.spec.damage)) {
                        hitTime = .12;
                        sound.cue('hit');
                    }
                    const body = hit.collider.parent();
                    if (body?.isDynamic()) {
                        const ray = game.player.ray();
                        body.applyImpulseAtPoint({ x: ray.dir.x * 5, y: ray.dir.y * 5, z: ray.dir.z * 5 }, ray.pointAt(hit.timeOfImpact), true);
                    }
                }
                game.player.pitch = Math.min(1.5, game.player.pitch + .007);
            }
        },
        afterStep: dt => sentries?.step(dt),
        render: () => {
            el('health').textContent = String(Math.ceil(vitals.health));
            el('ammo').textContent = `${weapon.ammo} / ${weapon.reserve}`;
            el('weapon-state').textContent = weapon.reloading ? `Reloading ${Math.round(weapon.reloadProgress * 100)}%` : 'Rifle / R to reload';
            el('remaining').textContent = String(sentries?.remaining ?? 3);
            el('prompt').textContent = game.runtime.prompt;
            el('crosshair').classList.toggle('hit', hitTime > 0);
            el('damage').style.opacity = hurtTime > 0 ? '1' : '0';
            gun.position.z = -.75 + kick;
            gun.visible = !game.player.held;
            if (sentries?.remaining === 0)
                el('objective').textContent = 'Gate open. Reach the car. Press E to load Coast Road.';
        },
    });
    scope.own(() => game.dispose());
    game.player.onRespawn = () => { vitals.reset(); weapon.reset(); notice('Returned to the safe start. Sentry defeats remain.'); };
    sentries = new YardSentries(game, defeated, amount => {
        const result = vitals.damage(amount, .18);
        if (result.healthLost > 0) {
            hurtTime = .18;
            sound.cue('hurt');
        }
        if (result.killed)
            game.player.respawn();
    });
    // A small low-poly view model. It has no collision body and is local to this episode.
    const gun = new THREE.Group(), geometry = new THREE.BoxGeometry(1, 1, 1), material = new THREE.MeshStandardMaterial({ color: '#31463e', roughness: .9 });
    const accent = new THREE.MeshStandardMaterial({ color: '#e0bd76', roughness: .8 });
    const piece = (size, pos, m) => { const mesh = new THREE.Mesh(geometry, m); mesh.scale.set(...size); mesh.position.set(...pos); gun.add(mesh); };
    piece([.15, .17, .6], [0, 0, 0], material);
    piece([.07, .06, .4], [0, .04, -.4], material);
    piece([.11, .22, .12], [0, -.12, .12], accent);
    gun.position.set(.27, -.23, -.75);
    game.view.camera.add(gun);
    game.view.scene.add(game.view.camera);
    scope.own(() => { gun.removeFromParent(); geometry.dispose(); material.dispose(); accent.dispose(); });
    const apply = () => {
        const fov = Number(el('fov').value), sensitivity = Number(el('sensitivity').value) / 1000;
        game.player.motor.settings.fov = fov;
        game.player.motor.settings.sensitivity = sensitivity;
        game.player.motor.settings.headBob = Number(el('bob').value);
        game.input.invertY = el('invert').checked;
        game.view.quality(el('quality').checked);
        sound.volume = Number(el('volume').value);
        try {
            localStorage.setItem('strata.fps.preferences.v1', JSON.stringify({ fov, sensitivity, headBob: game.player.motor.settings.headBob, invertY: game.input.invertY, quality: el('quality').checked, volume: sound.volume, bindings: game.input.bindings }));
        }
        catch {
            notice('Preferences could not be saved. Current settings still apply.');
        }
    };
    try {
        const raw = localStorage.getItem('strata.fps.preferences.v1');
        if (raw) {
            const p = JSON.parse(raw);
            if (typeof p.fov === 'number' && p.fov >= 60 && p.fov <= 110)
                el('fov').value = String(p.fov);
            if (typeof p.sensitivity === 'number' && p.sensitivity >= .0005 && p.sensitivity <= .004)
                el('sensitivity').value = String(p.sensitivity * 1000);
            if (typeof p.headBob === 'number' && p.headBob >= 0 && p.headBob <= 1)
                el('bob').value = String(p.headBob);
            if (typeof p.volume === 'number' && p.volume >= 0 && p.volume <= .4)
                el('volume').value = String(p.volume);
            if (typeof p.invertY === 'boolean')
                el('invert').checked = p.invertY;
            if (typeof p.quality === 'boolean')
                el('quality').checked = p.quality;
            if (p.bindings && typeof p.bindings === 'object')
                for (const [action, codes] of Object.entries(p.bindings)) {
                    try {
                        game.input.bind(action, codes);
                    }
                    catch { /* Ignore an invalid saved action. */ }
                }
        }
    }
    catch {
        notice('Saved preferences were not valid. Defaults are in use.');
    }
    apply();
    for (const id of ['fov', 'sensitivity', 'bob', 'volume', 'invert', 'quality'])
        scope.listen(el(id), 'input', apply);
    let cancelRebind = null;
    for (const action of ['forward', 'back', 'left', 'right', 'jump', 'sprint', 'crouch', 'interact', 'reload', 'respawn']) {
        const button = document.createElement('button');
        const refresh = () => { button.textContent = `${action}: ${game.input.bindings[action].join('/')}`; };
        refresh();
        scope.listen(button, 'click', () => {
            cancelRebind?.();
            button.textContent = 'Press a key / Esc cancels';
            const listener = (event) => {
                event.preventDefault();
                event.stopImmediatePropagation();
                try {
                    if (event.code !== 'Escape') {
                        game.input.bind(action, [event.code]);
                        apply();
                    }
                }
                catch (error) {
                    notice(String(error));
                }
                cancelRebind?.();
            };
            cancelRebind = () => { window.removeEventListener('keydown', listener, true); refresh(); cancelRebind = null; };
            window.addEventListener('keydown', listener, true);
        });
        el('rebinds').append(button);
    }
    scope.own(() => cancelRebind?.());
    scope.listen(el('play'), 'click', () => { cancelRebind?.(); void sound.resume().catch(() => notice('Sound is not available.')); game.play(); });
    scope.listen(el('save'), 'click', () => { try {
        session.checkpoint(snapshot());
        notice('Checkpoint saved in this tab.');
    }
    catch (error) {
        notice(String(error));
    } });
    scope.listen(el('export'), 'click', () => { try {
        session.checkpoint(snapshot());
        downloadText('strata-run.json', session.export());
    }
    catch (error) {
        notice(String(error));
    } });
    el('play').disabled = false;
    el('play').textContent = 'Enter loading bay';
    el('save').disabled = false;
    notice('Ready. Select Enter loading bay to capture the mouse.');
    // Read-only diagnostics are present only when the page is opened with ?test=1.
    if (new URL(location.href).searchParams.has('test'))
        Object.assign(window, { strataTest: { game, vitals, weapon, sentries, session } });
}
catch (error) {
    try {
        cleanup?.();
    }
    catch (disposeError) {
        console.error(disposeError);
    }
    notice(`Episode start failed: ${String(error)}`);
    console.error(error);
}
