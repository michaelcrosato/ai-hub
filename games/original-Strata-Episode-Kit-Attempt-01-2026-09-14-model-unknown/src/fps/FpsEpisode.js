import * as THREE from 'three/webgpu';
import { FpsGame } from './FpsGame.js';
import { Vitals, Weapon } from './combat.js';
import { ShotEffects } from './effects.js';
import { RAPIER } from '../engine/PhysicsWorld.js';
import { Scope } from '../campaign/scope.js';
import { downloadText } from '../campaign/store.js';
import { applyScheme, fpsScheme, glyph, menuScheme } from '../schemes.js';
import { DEFAULT_BINDINGS, DIFFICULTIES, REBINDABLE, keyLabel, keysLabel, savePrefs, validCode } from '../prefs.js';
import { bestTime, formatTime, submitTime } from '../records.js';
import { warmUp } from '../warmup.js';

const $ = id => document.getElementById(id);
const _tip = new THREE.Vector3();
const _end = new THREE.Vector3();
const _ahead = new THREE.Vector3();
const round = (v, digits = 2) => Math.round(v * 10 ** digits) / 10 ** digits;
const finiteIn = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const ACTION_NAMES = { forward: 'Forward', back: 'Back', left: 'Left', right: 'Right', jump: 'Jump', sprint: 'Sprint', crouch: 'Crouch', interact: 'Use / carry', reload: 'Reload', respawn: 'Return to start' };

/**
 * One first-person episode on the FPS starter: the menu, HUD, rifle, vitals, pointer lock,
 * pause, checkpoint save, results and preferences. The episode passes its own level, its
 * own local AI (`setup`) and its own exits; nothing here knows about sentries or cars.
 *
 * @param {object} ctx   from the shell: kit, sun, sound, nav, session, prefs, notice, toPortal
 * @param {object} spec  id, eyebrow, title, menuEyebrow, intro, note, playLabel, countLabel,
 *                       level(), configure(registry, api), setup(api, saved)
 */
export async function createFpsEpisode(ctx, spec) {
    const scope = new Scope();
    try {
        return await build(ctx, spec, scope);
    }
    catch (error) {
        scope.dispose();
        throw error;
    }
}

async function build(ctx, spec, scope) {
    const { kit, sun, sound, nav, session, prefs } = ctx;
    const status = $('fps-status'), playBtn = $('fps-play'), saveBtn = $('fps-save');
    let quiet = false;
    const notice = text => {
        if (quiet)
            return;
        ctx.notice(text);
        status.textContent = text;
    };
    let state = 'loading', stateAt = performance.now(), ready = false, locked = false, wasLocked = false;
    let game = null, local = null, effects = null;
    let hitTime = 0, hurtTime = 0, kick = 0, flash = 0, wasReloading = false, pendingResult = null;
    let touchUse = false, cancelRebind = null, hudClock = 1;
    const hud = new Map();
    const setText = (id, text) => {
        if (hud.get(id) === text)
            return;
        hud.set(id, text);
        $(id).textContent = text;
    };

    // ---- DOM: this episode's titles on the shared first-person HUD and menu.
    $('fps-eyebrow').textContent = spec.eyebrow;
    $('fps-name').textContent = spec.title;
    $('fps-count-label').textContent = spec.countLabel;
    $('fps-menu-eyebrow').textContent = spec.menuEyebrow;
    $('fps-menu-title').textContent = spec.title;
    $('fps-menu-intro').textContent = spec.intro;
    $('fps-note').textContent = spec.note;
    playBtn.disabled = true;
    playBtn.textContent = 'Loading physics…';
    saveBtn.disabled = true;
    status.textContent = 'Loading three.js scene and Rapier.';
    $('fps-hud').hidden = false;
    $('fps-menu').hidden = false;
    $('results').hidden = true;
    scope.own(() => {
        $('fps-hud').hidden = true;
        $('fps-menu').hidden = true;
        $('results').hidden = true;
        $('fps-damage').style.opacity = '0';
    });
    applyScheme(kit, menuScheme());
    kit.touch?.suspend(true, 'strata-menu');
    scope.own(() => kit.touch?.suspend(false, 'strata-menu'));
    nav.set($('fps-menu'), { onBack: () => back() });
    scope.own(() => nav.set(null));

    // ---- Run state from this episode's checkpoint.
    const saved = session.local;
    const vitals = new Vitals(), weapon = new Weapon();
    try {
        if (typeof saved.health === 'number' && typeof saved.armor === 'number')
            vitals.restore({ health: saved.health, armor: saved.armor });
        if (!vitals.alive)
            vitals.reset();
        if (typeof saved.ammo === 'number' && typeof saved.reserve === 'number')
            weapon.restore({ ammo: saved.ammo, reserve: saved.reserve });
    }
    catch {
        vitals.reset();
        weapon.reset();
    }
    const stats = {
        elapsed: finiteIn(saved.elapsed, 0, 86400) ? saved.elapsed : 0,
        shots: Number.isSafeInteger(saved.shots) && saved.shots >= 0 ? saved.shots : 0,
        hits: Number.isSafeInteger(saved.hits) && saved.hits >= 0 ? saved.hits : 0,
        damage: finiteIn(saved.damage, 0, 1e6) ? saved.damage : 0,
        respawns: Number.isSafeInteger(saved.respawns) && saved.respawns >= 0 ? saved.respawns : 0,
    };
    if (stats.hits > stats.shots)
        stats.hits = stats.shots;
    const difficulty = () => DIFFICULTIES[prefs.difficulty] ?? DIFFICULTIES.standard;

    const api = {
        kit, sound, session, prefs, stats, vitals, weapon, notice, difficulty,
        get game() { return game; },
        get local() { return local; },
        get effects() { return effects; },
        /** Silence notices while restoring a checkpoint (replayed pickups, switches). */
        quietly(fn) {
            quiet = true;
            try {
                fn();
            }
            finally {
                quiet = false;
            }
        },
        rumble: (strength, ms) => kit.input.rumble(strength, ms),
        tracer: (from, to, kind) => effects?.tracer(from, to, kind),
        /** A local enemy hit the player. Difficulty scales it; death returns to the checkpoint. */
        damagePlayer(amount) {
            const result = vitals.damage(amount * difficulty().damage, .18);
            if (result.healthLost > 0 || result.armorLost > 0) {
                hurtTime = .18;
                stats.damage += result.healthLost;
                sound.cue('hurt');
                kit.input.rumble(.55, 140);
            }
            if (result.killed) {
                kit.input.rumble(1, 320);
                game.player.respawn();
                notice('You went down. Back at the last safe point.');
            }
            return result;
        },
        finish,
    };

    const snapshot = () => ({
        ...(local?.snapshot?.() ?? {}),
        health: vitals.health, armor: vitals.armor, ammo: weapon.ammo, reserve: weapon.reserve,
        elapsed: round(stats.elapsed), shots: stats.shots, hits: stats.hits, damage: Math.round(stats.damage), respawns: stats.respawns,
        checkpoint: game.player.checkpoint.map(v => round(v, 3)), checkpointYaw: round(game.player.checkpointYaw, 3),
    });
    const checkpoint = (message) => {
        if (!game)
            return false;
        try {
            session.checkpoint(snapshot());
            if (message)
                notice(message);
            return true;
        }
        catch (error) {
            notice(String(error.message ?? error));
            return false;
        }
    };

    // ---- Buttons that work while loading.
    scope.listen($('fps-portal'), 'click', () => {
        checkpoint();
        ctx.toPortal();
    });
    scope.listen($('fps-settings'), 'click', () => kit.menu.open());
    scope.listen($('fps-export'), 'click', () => {
        if (game && !checkpoint())
            return;
        downloadText('strata-run.json', session.export());
    });
    scope.listen(saveBtn, 'click', () => checkpoint('Checkpoint saved in this browser.'));
    scope.listen(playBtn, 'click', () => {
        cancelRebind?.();
        sound.unlock();
        sound.cue('confirm');
        resume(true);
    });
    scope.listen($('results-continue'), 'click', () => {
        if (!pendingResult)
            return;
        sound.cue('confirm');
        const r = pendingResult;
        try {
            session.complete(r.exit, { local: snapshot(), shared: { ...session.shared, ...r.shared, [`${spec.id}-seconds`]: round(stats.elapsed, 1) } });
        }
        catch (error) {
            $('results-status').textContent = String(error.message ?? error);
        }
    });

    // ---- The game.
    game = await FpsGame.create(kit, sun, spec.level(), {
        notice,
        event: (type, entity, extra) => {
            // The episode may veto the default feedback (a restored checkpoint replaying signals).
            if (local?.event?.(type, entity, extra) === false)
                return;
            const cue = { pickup: 'pickup', switch: 'switch', door: 'door', checkpoint: 'checkpoint', pad: 'pad', mover: 'door', hazard: 'hurt' }[type];
            if (cue)
                sound.cue(cue);
            if (type === 'pad' || type === 'hazard')
                kit.input.rumble(.35, 110);
        },
        configure: registry => spec.configure?.(registry, api),
        beforeStep: (dt, g) => beforeStep(dt, g),
        afterStep: dt => local?.step?.(dt),
        render: dt => render(dt),
        complete: () => local?.complete?.(),
    });
    scope.own(() => game.dispose());
    if (scope.disposed)
        return null;
    const player = game.player;
    player.motor.settings.headBob = prefs.headBob;
    player.motor.settings.fov = prefs.fov;
    game.view.followShadow = !!spec.followShadow;
    if (spec.shadowExtent)
        game.view.shadowExtent = spec.shadowExtent;

    local = spec.setup?.(api, saved) ?? null;
    scope.own(() => local?.dispose?.());
    // A saved checkpoint is a safe pose: re-enter there, not at an arbitrary physics pose.
    const cp = saved.checkpoint;
    if (Array.isArray(cp) && cp.length === 3 && cp.every(v => finiteIn(v, -1000, 1000))) {
        player.checkpoint = [...cp];
        if (finiteIn(saved.checkpointYaw, -100, 100))
            player.checkpointYaw = saved.checkpointYaw;
        player.respawn();
    }
    player.onRespawn = () => {
        vitals.reset();
        weapon.reset();
        stats.respawns++;
        notice(spec.respawnNotice ?? 'Returned to the last safe point.');
    };

    // ---- A small low-poly view model. No collision body; local to the first-person episodes.
    const gun = new THREE.Group(), gunGeometry = new THREE.BoxGeometry(1, 1, 1);
    const gunMaterial = new THREE.MeshStandardMaterial({ color: '#31463e', roughness: .9 });
    const accent = new THREE.MeshStandardMaterial({ color: '#e0bd76', roughness: .8 });
    const flashMaterial = new THREE.MeshBasicMaterial({ color: '#ffe7a8', fog: false });
    const piece = (size, pos, m) => { const mesh = new THREE.Mesh(gunGeometry, m); mesh.scale.set(...size); mesh.position.set(...pos); gun.add(mesh); return mesh; };
    piece([.15, .17, .6], [0, 0, 0], gunMaterial);
    piece([.07, .06, .4], [0, .04, -.4], gunMaterial);
    piece([.11, .22, .12], [0, -.12, .12], accent);
    const muzzle = piece([.09, .09, .12], [0, .04, -.66], flashMaterial);
    const tip = new THREE.Object3D();
    tip.position.set(0, .04, -.62);
    gun.add(tip);
    // One light that only lights up while firing; it exists from the start so firing never
    // changes the scene's light set (which would rebuild every material).
    const muzzleLight = new THREE.PointLight('#ffd58a', 0, 7, 2);
    muzzleLight.position.set(0, .05, -1.1);
    gun.add(muzzleLight);
    gun.position.set(.27, -.23, -.75);
    const camera = game.view.camera;
    camera.add(gun);
    game.view.scene.add(camera);
    effects = new ShotEffects(game.view.scene);
    scope.own(() => {
        gun.removeFromParent();
        gunGeometry.dispose();
        gunMaterial.dispose();
        accent.dispose();
        flashMaterial.dispose();
        effects.dispose();
    });

    // ---- Preferences panel.
    const fov = $('fps-fov'), bob = $('fps-bob'), volume = $('fps-volume'), diffBtn = $('fps-difficulty');
    fov.value = String(prefs.fov);
    bob.value = String(prefs.headBob);
    volume.value = String(prefs.volume);
    const showDifficulty = () => { diffBtn.textContent = difficulty().label; };
    showDifficulty();
    const applyPrefs = () => {
        prefs.fov = Number(fov.value);
        prefs.headBob = Number(bob.value);
        prefs.volume = Number(volume.value);
        player.motor.settings.fov = prefs.fov;
        player.motor.settings.headBob = prefs.headBob;
        sound.volume = prefs.volume;
        if (!savePrefs(prefs))
            status.textContent = 'Preferences could not be saved. Current settings still apply.';
    };
    for (const input of [fov, bob, volume])
        scope.listen(input, 'input', applyPrefs);
    scope.listen(diffBtn, 'click', () => {
        const keys = Object.keys(DIFFICULTIES);
        prefs.difficulty = keys[(keys.indexOf(prefs.difficulty) + 1) % keys.length];
        showDifficulty();
        applyPrefs();
    });

    const rebinds = $('fps-rebinds');
    rebinds.textContent = '';
    scope.own(() => { cancelRebind?.(); rebinds.textContent = ''; });
    const rebindButtons = new Map();
    const showBinding = action => { rebindButtons.get(action).textContent = `${ACTION_NAMES[action]}: ${keysLabel(prefs.bindings[action])}`; };
    for (const action of REBINDABLE) {
        const button = document.createElement('button');
        button.type = 'button';
        rebindButtons.set(action, button);
        showBinding(action);
        scope.listen(button, 'click', () => {
            cancelRebind?.();
            button.textContent = 'Press a key / Esc cancels';
            const listener = (event) => {
                event.preventDefault();
                event.stopImmediatePropagation();
                if (event.code !== 'Escape') {
                    if (validCode(event.code)) {
                        prefs.bindings[action] = [event.code];
                        applyPrefs();
                        refreshHelp();
                    }
                    else
                        status.textContent = `${keyLabel(event.code)} is reserved or not supported.`;
                }
                cancelRebind?.();
            };
            cancelRebind = () => { window.removeEventListener('keydown', listener, true); showBinding(action); cancelRebind = null; };
            window.addEventListener('keydown', listener, true);
        });
        rebinds.append(button);
    }
    scope.listen($('fps-rebind-reset'), 'click', () => {
        prefs.bindings = structuredClone(DEFAULT_BINDINGS);
        for (const action of REBINDABLE)
            showBinding(action);
        applyPrefs();
        refreshHelp();
    });

    // ---- Controls help and prompts follow the device in use.
    function refreshHelp() {
        const b = prefs.bindings, src = kit.input.source;
        const lines = src === 'gamepad' ? [
            'Left stick · Move　Right stick · Look　LS · Sprint',
            'A · Jump　B · Crouch (toggle)　Y · Use / Carry',
            'RT · Fire / Throw　X · Reload　Back · Return to start　Start · Pause',
        ] : src === 'touch' ? [
            'Left thumb · Move (push to the rim to sprint)　Drag on the right · Look',
            'Fire · Jump · Use · Reload · Crouch (toggle)',
            'Restart · Return to start　II · Pause',
        ] : [
            `${keysLabel([...b.forward, ...b.left, ...b.back, ...b.right].filter(c => c.startsWith('Key')))} · Move　${keysLabel(b.sprint)} · Sprint　${keysLabel(b.jump)} · Jump`,
            `${keysLabel(b.crouch)} · Crouch　${keysLabel(b.interact)} · Use / Carry　Click or J · Fire / Throw`,
            `${keysLabel(b.reload)} · Reload　${keysLabel(b.respawn)} · Return to start　Esc / P · Pause　F9 · Settings`,
        ];
        $('fps-controls').textContent = lines.join('\n');
        hud.delete('fps-prompt');
        hud.delete('fps-weapon-state');
    }
    refreshHelp();
    scope.own(kit.input.onSourceChange(() => refreshHelp()));

    // ---- Pause, resume and pointer lock.
    function openMenu() {
        if (state === 'results' || state === 'menu')
            return;
        state = 'menu';
        stateAt = performance.now();
        game.setRunning(false);
        kit.input.unlockPointer();
        $('fps-menu').hidden = false;
        applyScheme(kit, menuScheme());
        kit.touch?.suspend(true, 'strata-menu');
        nav.set($('fps-menu'), { onBack: () => back(), focus: ready ? playBtn : null });
        refreshHelp();
    }
    function back() {
        if ($('fps-details').open) {
            $('fps-details').open = false;
            $('fps-details').querySelector('summary').focus();
            return;
        }
        if (performance.now() - stateAt > 400)
            resume(false);
    }
    function resume(fromClick) {
        if (!ready || state === 'results' || state === 'play')
            return;
        state = 'play';
        stateAt = performance.now();
        $('fps-menu').hidden = true;
        applyScheme(kit, fpsScheme(prefs.bindings));
        kit.touch?.suspend(false, 'strata-menu');
        nav.set(null);
        game.setRunning(true);
        playBtn.textContent = 'Resume';
        if (fromClick && kit.input.source === 'keyboard')
            kit.input.lockPointer();
        kit.touch?.setShown('interact', false);
        touchUse = false;
    }
    scope.listen(document, 'pointerlockchange', () => {
        locked = document.pointerLockElement === kit.canvas;
        if (!locked && wasLocked && state === 'play')
            openMenu();
        wasLocked = locked;
    });
    // A mouse player whose capture was refused (or who resumed with the keyboard) clicks the
    // view to aim again; that click does not also fire.
    scope.listen(kit.canvas, 'pointerdown', (e) => {
        if (state !== 'play' || locked || e.pointerType !== 'mouse')
            return;
        game.controls.suppressFire = true;
        kit.input.lockPointer();
    });
    scope.listen(window, 'blur', () => { if (state === 'play') openMenu(); });
    scope.listen(document, 'visibilitychange', () => {
        if (document.hidden) {
            if (state === 'play')
                openMenu();
            checkpoint();
        }
    });
    scope.listen(window, 'pagehide', () => checkpoint());

    // ---- Simulation hooks.
    function beforeStep(dt, g) {
        vitals.tick(dt);
        weapon.tick(dt);
        stats.elapsed += dt;
        hitTime = Math.max(0, hitTime - dt);
        hurtTime = Math.max(0, hurtTime - dt);
        kick = Math.max(0, kick - dt * 3);
        if (wasReloading && !weapon.reloading)
            sound.cue('loaded');
        if (g.controls.consume('reload') && weapon.reload())
            sound.cue('reload');
        if (!g.player.held) {
            const pressed = g.controls.consume('fire');
            if (weapon.fire(pressed, g.controls.down('fire')))
                shoot(g);
            else if (pressed && weapon.ammo === 0 && !weapon.reloading) {
                sound.cue('empty');
                if (weapon.reserve === 0)
                    notice(`Out of ammunition. Return to start (${glyph(kit.input.source, 'respawn', keysLabel(prefs.bindings.respawn))}) to rearm.`);
            }
            // An empty magazine reloads itself when there is anything to load.
            if (weapon.ammo === 0 && weapon.reserve > 0 && !weapon.reloading && weapon.reload())
                sound.cue('reload');
        }
        wasReloading = weapon.reloading;
    }
    function shoot(g) {
        sound.cue('shot');
        kick = .08;
        flash = .05;
        stats.shots++;
        kit.input.rumble(.2, 45);
        const physics = g.runtime.physics, ray = g.player.ray();
        const hit = physics.world.castRay(ray, weapon.spec.range, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, g.player.collider, g.player.body);
        const point = ray.pointAt(hit ? hit.timeOfImpact : weapon.spec.range);
        _end.set(point.x, point.y, point.z);
        if (hit) {
            const id = physics.owners.get(hit.collider.handle);
            if (id && local?.hit?.(id, weapon.spec.damage)) {
                hitTime = .12;
                stats.hits++;
                sound.cue('hit');
            }
            const body = hit.collider.parent();
            if (body?.isDynamic())
                body.applyImpulseAtPoint({ x: ray.dir.x * 5, y: ray.dir.y * 5, z: ray.dir.z * 5 }, point, true);
            effects.puff(_end);
        }
        tip.getWorldPosition(_tip);
        effects.tracer(_tip, _end, 'player');
        g.player.pitch = Math.min(1.5, g.player.pitch + .007);
    }
    function render(dt) {
        const rt = game.runtime;
        effects.update(dt);
        flash = Math.max(0, flash - dt);
        muzzle.visible = flash > 0;
        muzzleLight.intensity = flash > 0 ? 5 : 0;
        gun.position.z = -.75 + kick;
        gun.visible = !player.held;
        const src = kit.input.source;
        // Text HUD ten times a second (strings are built, the DOM is touched only on change).
        hudClock += dt;
        if (hudClock >= .1 || dt === 0) {
            hudClock = 0;
            setText('fps-health', String(Math.ceil(vitals.health)));
            setText('fps-ammo', `${weapon.ammo} / ${weapon.reserve}`);
            setText('fps-weapon-state', weapon.reloading ? `Reloading ${Math.round(weapon.reloadProgress * 10) * 10}%` : `Rifle / ${glyph(src, 'reload', keysLabel(prefs.bindings.reload))} to reload`);
            setText('fps-count', local?.countText?.() ?? '');
            setText('fps-time', formatTime(stats.elapsed));
            setText('fps-objective', local?.objective?.() ?? spec.objective ?? '');
        }
        let prompt = '';
        if (state === 'play') {
            const use = glyph(src, 'interact', keysLabel(prefs.bindings.interact));
            if (rt.promptKind === 'held')
                prompt = `${use} · Drop　　${glyph(src, 'throw')} · Throw`;
            else if (rt.promptKind === 'interact')
                prompt = `${use} · ${rt.prompt}`;
            else if (src === 'keyboard' && !locked)
                prompt = 'Click the view to aim with the mouse';
            const wantUse = rt.promptKind !== '';
            if (wantUse !== touchUse) {
                touchUse = wantUse;
                kit.touch?.setShown('interact', wantUse);
            }
        }
        setText('fps-prompt', prompt);
        const crosshairHit = hitTime > 0;
        if (hud.get('crosshair') !== crosshairHit) {
            hud.set('crosshair', crosshairHit);
            $('fps-crosshair').classList.toggle('hit', crosshairHit);
        }
        const hurt = hurtTime > 0 ? '1' : '0';
        if (hud.get('hurt') !== hurt) {
            hud.set('hurt', hurt);
            $('fps-damage').style.opacity = hurt;
        }
        local?.render?.(dt);
    }

    // ---- Results.
    function finish(result) {
        if (state === 'results')
            return;
        state = 'results';
        stateAt = performance.now();
        game.setRunning(false);
        kit.input.unlockPointer();
        applyScheme(kit, menuScheme());
        kit.touch?.suspend(true, 'strata-menu');
        $('fps-menu').hidden = true;
        pendingResult = result;
        const previous = bestTime(spec.id);
        const record = submitTime(spec.id, stats.elapsed);
        const lines = [
            `Time　${formatTime(stats.elapsed)}${record.isNew ? (previous === null ? '　(first clear)' : '　NEW BEST') : `　(best ${formatTime(record.best)})`}`,
            `Accuracy　${stats.shots ? `${Math.round(stats.hits / stats.shots * 100)}% (${stats.hits} of ${stats.shots} shots)` : 'no shots fired'}`,
            `Damage taken　${Math.round(stats.damage)}　·　Returns to a safe point　${stats.respawns}`,
            ...(result.lines ?? []),
        ];
        const list = $('results-lines');
        list.textContent = '';
        for (const text of lines) {
            const li = document.createElement('li');
            li.textContent = text;
            list.append(li);
        }
        $('results-eyebrow').textContent = `${spec.eyebrow.split(' / ')[0]} / Episode complete`;
        $('results-title').textContent = result.title;
        $('results-continue').textContent = result.label;
        $('results-status').textContent = '';
        $('results').hidden = false;
        sound.cue('finish');
        kit.input.rumble(.4, 200);
        nav.set($('results'), { focus: $('results-continue') });
    }

    // ---- Warm up: compile the scene's pipelines with the shot effects in view.
    try {
        game.view.activate();
        player.render(1, 0);
        game.view.scene.updateMatrixWorld(true);
        _ahead.set(0, 0, -2).applyQuaternion(camera.quaternion).add(camera.position);
        effects.prewarm(true, _ahead);
        local?.prewarm?.(true);
        muzzle.visible = true;
        await warmUp(kit.renderer, game.view.scene, camera);
    }
    finally {
        effects.prewarm(false);
        local?.prewarm?.(false);
        muzzle.visible = false;
    }
    if (scope.disposed)
        return null;

    ready = true;
    state = 'menu';
    stateAt = performance.now();
    playBtn.disabled = false;
    playBtn.textContent = spec.playLabel;
    saveBtn.disabled = false;
    status.textContent = spec.readyText ?? `Ready. Select ${spec.playLabel} to begin.`;
    nav.set($('fps-menu'), { onBack: () => back(), focus: playBtn });

    if (new URL(location.href).searchParams.has('test'))
        Object.assign(window, { strataTest: { game, vitals, weapon, local, session } });

    return {
        id: spec.id,
        frame(dt) {
            const now = performance.now();
            if (state === 'play') {
                if (kit.input.pressed('pause') && now - stateAt > 250)
                    openMenu();
            }
            else if (state === 'menu' && ready && kit.input.pressed('pause') && now - stateAt > 400)
                resume(false);
            game.frame(dt);
        },
        /** The shell asks before leaving to the portal (checkpoint) and on dispose. */
        save: () => checkpoint(),
        dispose() {
            kit.input.unlockPointer();
            scope.dispose();
        },
    };
}
