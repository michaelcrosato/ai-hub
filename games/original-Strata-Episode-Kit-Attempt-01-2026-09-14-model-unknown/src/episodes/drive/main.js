import * as THREE from 'three/webgpu';
import { bakeInstances } from 'kit/instancing.js';
import { FixedClock } from '../../core/clock.js';
import { random } from '../../core/math.js';
import { Scope } from '../../campaign/scope.js';
import { downloadText } from '../../campaign/store.js';
import { applyScheme, driveScheme, menuScheme } from '../../schemes.js';
import { savePrefs } from '../../prefs.js';
import { bestTime, formatTime, submitTime } from '../../records.js';
import { CarModel } from './model.js';
import { warmUp } from '../../warmup.js';

const $ = id => document.getElementById(id);
const CHECKPOINT_Z = [4, -62, -129];
const FINISH_Z = -184;

/**
 * 02 / Coast Road. This episode owns its arcade vehicle model and circle-to-box collisions:
 * no Rapier, no weapons, no sentry AI. It reads the same small run contract as the others.
 */
export async function create(ctx) {
    const scope = new Scope();
    try {
        return await build(ctx, scope);
    }
    catch (error) {
        scope.dispose();
        throw error;
    }
}

async function build(ctx, scope) {
    const { kit, sun, sound, nav, session, prefs } = ctx;
    const status = $('drive-status'), playBtn = $('drive-play'), saveBtn = $('drive-save');
    const notice = (text) => { ctx.notice(text); status.textContent = text; };
    $('drive-hud').hidden = false;
    $('drive-menu').hidden = false;
    $('results').hidden = true;
    playBtn.disabled = true;
    playBtn.textContent = 'Loading road…';
    saveBtn.disabled = true;
    scope.own(() => {
        $('drive-hud').hidden = true;
        $('drive-menu').hidden = true;
        $('results').hidden = true;
    });
    applyScheme(kit, menuScheme());
    kit.touch?.suspend(true, 'strata-menu');
    scope.own(() => kit.touch?.suspend(false, 'strata-menu'));
    nav.set($('drive-menu'), { onBack: () => back() });
    scope.own(() => nav.set(null));

    // ---- Scene.
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#b5cfce');
    scene.fog = new THREE.FogExp2('#b5cfce', .009);
    const camera = new THREE.PerspectiveCamera(65, 1, .1, 400);
    scope.own(kit.onResize((w, h) => {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }));
    scene.add(new THREE.HemisphereLight('#e7f1dc', '#536b61', 2.3));
    const activateSun = () => {
        scene.add(sun, sun.target);
        sun.color.set('#fff0ce');
        sun.intensity = 3.2;
        const cam = sun.shadow.camera;
        if (cam.left !== -40 || cam.far !== 250) {
            cam.left = -40;
            cam.right = 40;
            cam.top = 40;
            cam.bottom = -40;
            cam.near = .5;
            cam.far = 250;
            cam.updateProjectionMatrix();
        }
    };
    activateSun();
    scope.own(() => { sun.removeFromParent(); sun.target.removeFromParent(); });

    const boxGeometry = new THREE.BoxGeometry(1, 1, 1), rockGeometry = new THREE.IcosahedronGeometry(1, 0);
    const materials = new Map();
    const material = (color) => {
        let m = materials.get(color);
        if (!m) {
            m = new THREE.MeshStandardMaterial({ color, roughness: .9, flatShading: true });
            materials.set(color, m);
        }
        return m;
    };
    scope.own(() => {
        boxGeometry.dispose();
        rockGeometry.dispose();
        for (const m of materials.values())
            m.dispose();
        scene.traverse(o => { if (o.isMesh && o.geometry !== boxGeometry && o.geometry !== rockGeometry) o.geometry.dispose(); });
        scene.clear();
    });

    // Static scenery never moves: collect it per colour and bake each colour into one mesh.
    const statics = new Map();
    const _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
    const staticBox = (x, y, z, w, h, d, color) => {
        let list = statics.get(color);
        if (!list)
            statics.set(color, list = []);
        list.push(new THREE.Matrix4().compose(_p.set(x, y, z), _q.identity(), _s.set(w, h, d)));
    };
    const bake = (geometry, color, list, cast, receive) => {
        const batch = new THREE.InstancedMesh(geometry, material(color), list.length);
        list.forEach((m, i) => batch.setMatrixAt(i, m));
        batch.castShadow = cast;
        batch.receiveShadow = receive;
        scene.add(bakeInstances(batch));
    };
    staticBox(0, -.6, -90, 90, 1, 240, '#799681');
    staticBox(0, -.02, -90, 20, .12, 220, '#596b64');
    staticBox(40, -1, -90, 55, .2, 400, '#7ba8aa');
    const barriers = [{ x: -10.5, z: -90, halfX: .5, halfZ: 110 }, { x: 10.5, z: -90, halfX: .5, halfZ: 110 }, { x: 0, z: 19, halfX: 11, halfZ: .5 }];
    for (const x of [-10.5, 10.5])
        staticBox(x, .5, -90, 1, 1, 220, '#cbbd97');
    for (let i = 0; i < 28; i++)
        staticBox(0, .06, 12 - i * 7.3, .16, .025, 3, '#ddc991');
    for (const [x, z] of [[-4, -35], [4, -72], [-4, -111], [4, -150]]) {
        barriers.push({ x, z, halfX: 3, halfZ: .7 });
        staticBox(x, .7, z, 6, 1.4, 1.4, '#b87757');
        staticBox(x, 1.42, z, 5.8, .05, 1.1, '#e4c789');
    }
    for (const z of [-57, -123]) {
        staticBox(0, .07, z, 19, .02, .5, '#93c6ac');
        staticBox(-8.5, 2, z, .2, 4, .2, '#d8dfbb');
        staticBox(8.5, 2, z, .2, 4, .2, '#d8dfbb');
    }
    staticBox(-8, 3, -185, .5, 6, .5, '#e9d59c');
    staticBox(8, 3, -185, .5, 6, .5, '#e9d59c');
    staticBox(0, 5.8, -185, 16, .5, .5, '#e9d59c');
    for (const [color, list] of statics)
        bake(boxGeometry, color, list, true, true);
    const rng = random(15), rocks = { '#81937d': [], '#a1ab8e': [] };
    for (let i = 0; i < 70; i++) {
        _p.set(-17 - rng() * 20, rng() * 4, 20 - rng() * 230);
        _s.set(4 + rng() * 8, 4 + rng() * 12, 4 + rng() * 8);
        rocks[i % 2 ? '#81937d' : '#a1ab8e'].push(new THREE.Matrix4().compose(_p, _q.identity(), _s));
    }
    for (const [color, list] of Object.entries(rocks))
        bake(rockGeometry, color, list, true, false);

    const car = new THREE.Group();
    scene.add(car);
    const carBox = (x, y, z, w, h, d, color) => {
        const mesh = new THREE.Mesh(boxGeometry, material(color));
        mesh.position.set(x, y, z);
        mesh.scale.set(w, h, d);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        car.add(mesh);
    };
    carBox(0, .7, 0, 2, .7, 3.8, '#4b8c85');
    carBox(0, 1.3, -.15, 1.65, .7, 1.8, '#283d3d');
    for (const x of [-1, 1])
        for (const z of [-1.2, 1.2])
            carBox(x, .42, z, .35, .7, .7, '#202c2b');
    carBox(0, .8, -1.94, 1.65, .18, .05, '#e6d493');

    // ---- Run state.
    const model = new CarModel(), previous = new THREE.Vector3(), current = new THREE.Vector3(), clock = new FixedClock(60, 5);
    const forward = new THREE.Vector3(), destination = new THREE.Vector3(), look = new THREE.Vector3();
    let previousYaw = 0, firstPerson = false, finish = false, shake = 0, cameraReady = false;
    let state = 'loading', stateAt = performance.now(), wasRunning = false;
    const local = session.local;
    let checkpoint = Number.isInteger(local.checkpoint) ? Math.max(0, Math.min(2, Number(local.checkpoint))) : 0;
    let integrity = typeof local.integrity === 'number' && Number.isFinite(local.integrity) ? Math.max(1, Math.min(100, local.integrity)) : 100;
    let elapsed = typeof local.elapsed === 'number' && Number.isFinite(local.elapsed) ? Math.max(0, Math.min(86400, local.elapsed)) : 0;
    const reset = () => {
        const hits = model.collisions, distance = model.distance;
        model.reset();
        model.collisions = hits;
        model.distance = distance;
        model.z = CHECKPOINT_Z[checkpoint];
        previous.set(model.x, 0, model.z);
        current.copy(previous);
        previousYaw = model.yaw;
        cameraReady = false;
    };
    if (typeof local.collisions === 'number' && Number.isSafeInteger(local.collisions) && local.collisions >= 0)
        model.collisions = Math.min(local.collisions, 1000000);
    if (typeof local.distance === 'number' && Number.isFinite(local.distance) && local.distance >= 0)
        model.distance = Math.min(local.distance, 10000000);
    reset();
    const snapshot = () => ({ checkpoint, integrity, elapsed: Math.round(elapsed * 100) / 100, collisions: model.collisions, distance: Math.round(model.distance * 10) / 10 });
    const save = (message) => {
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

    // ---- Menu, pause, results.
    const volume = $('drive-volume');
    volume.value = String(prefs.volume);
    scope.listen(volume, 'input', () => {
        prefs.volume = Number(volume.value);
        sound.volume = prefs.volume;
        savePrefs(prefs);
    });
    function refreshHelp() {
        const src = kit.input.source;
        $('drive-controls').textContent = (src === 'gamepad' ? [
            'Left stick · Steer　RT / A · Accelerate　LT · Reverse',
            'B / X · Brake　Y / RB · Change camera',
            'Back · Return to road checkpoint　Start · Pause',
        ] : src === 'touch' ? [
            'Left thumb · Steer　Gas · Rev · Brake buttons',
            'View · Change camera　Reset · Return to road checkpoint　II · Pause',
        ] : [
            'W / ↑ · Accelerate　S / ↓ · Reverse',
            'A / D · Steer　Space · Brake　V · Change camera',
            'R · Return to road checkpoint　Esc / P · Pause　F9 · Settings',
        ]).join('\n');
    }
    refreshHelp();
    scope.own(kit.input.onSourceChange(refreshHelp));
    function openMenu() {
        if (state !== 'play')
            return;
        state = 'menu';
        stateAt = performance.now();
        sound.engine(false);
        $('drive-menu').hidden = false;
        applyScheme(kit, menuScheme());
        kit.touch?.suspend(true, 'strata-menu');
        nav.set($('drive-menu'), { onBack: () => back(), focus: playBtn });
        refreshHelp();
    }
    function back() {
        if (state === 'menu' && performance.now() - stateAt > 400)
            resume();
    }
    function resume() {
        if (state !== 'menu' || finish)
            return;
        state = 'play';
        stateAt = performance.now();
        clock.reset();
        $('drive-menu').hidden = true;
        applyScheme(kit, driveScheme());
        kit.touch?.suspend(false, 'strata-menu');
        nav.set(null);
        playBtn.textContent = 'Resume';
    }
    scope.listen(playBtn, 'click', () => {
        sound.unlock();
        sound.cue('confirm');
        resume();
    });
    scope.listen(saveBtn, 'click', () => save('Road checkpoint saved in this browser.'));
    scope.listen($('drive-export'), 'click', () => {
        if (save())
            downloadText('strata-run.json', session.export());
    });
    scope.listen($('drive-settings'), 'click', () => kit.menu.open());
    scope.listen($('drive-portal'), 'click', () => {
        if (!finish)
            save();
        ctx.toPortal();
    });
    scope.listen(window, 'blur', () => openMenu());
    scope.listen(document, 'visibilitychange', () => {
        if (document.hidden) {
            openMenu();
            if (!finish)
                save();
        }
    });
    scope.listen(window, 'pagehide', () => { if (!finish) save(); });
    scope.own(() => sound.engine(false));

    let result = null;
    scope.listen($('results-continue'), 'click', () => {
        if (!result)
            return;
        sound.cue('confirm');
        try {
            session.complete('arrive', { local: snapshot(), shared: { ...session.shared, 'road-clear': true, 'car-integrity': integrity, 'drive-seconds': Math.round(elapsed), 'drive-collisions': model.collisions, 'drive-best': result.best } });
        }
        catch (error) {
            $('results-status').textContent = String(error.message ?? error);
        }
    });
    function arrive() {
        finish = true;
        state = 'results';
        sound.engine(false);
        sound.cue('finish');
        kit.input.rumble(.4, 200);
        applyScheme(kit, menuScheme());
        kit.touch?.suspend(true, 'strata-menu');
        const previousBest = bestTime('drive');
        const record = submitTime('drive', elapsed);
        result = { best: record.best };
        const lines = [
            `Time　${formatTime(elapsed)}${record.isNew ? (previousBest === null ? '　(first clear)' : '　NEW BEST') : `　(best ${formatTime(record.best)})`}`,
            `Impacts　${model.collisions}　·　Car integrity　${integrity}`,
            `Distance driven　${Math.round(model.distance)} m`,
        ];
        const list = $('results-lines');
        list.textContent = '';
        for (const text of lines) {
            const li = document.createElement('li');
            li.textContent = text;
            list.append(li);
        }
        $('results-eyebrow').textContent = '02 / Episode complete';
        $('results-title').textContent = 'Coast Road driven';
        $('results-continue').textContent = 'Continue to Breakwater Light';
        $('results-status').textContent = '';
        $('results').hidden = false;
        nav.set($('results'), { focus: $('results-continue') });
    }

    // ---- Simulation.
    const step = (dt) => {
        if (finish)
            return;
        previous.set(model.x, 0, model.z);
        previousYaw = model.yaw;
        const impacts = model.collisions;
        const steer = kit.input.vector('move').x;
        const throttle = kit.input.value('gas') - kit.input.value('rev');
        model.step(dt, { throttle, steer, brake: kit.input.down('brake') }, barriers);
        current.set(model.x, 0, model.z);
        elapsed += dt;
        if (model.collisions > impacts) {
            integrity -= 12;
            shake = .35;
            sound.cue('impact');
            kit.input.rumble(.7, 180);
            notice('Impact. Brake before steering around a barrier.');
        }
        if (integrity <= 0) {
            integrity = 100;
            reset();
            notice('Car reset at the road checkpoint.');
        }
        const reached = model.z < -123 ? 2 : model.z < -57 ? 1 : 0;
        if (reached > checkpoint) {
            checkpoint = reached;
            sound.cue('checkpoint');
            save(`Road checkpoint ${checkpoint} saved.`);
        }
        if (model.z < FINISH_Z && !finish)
            arrive();
    };

    const hudCache = new Map();
    const setText = (id, text) => {
        if (hudCache.get(id) === text)
            return;
        hudCache.set(id, text);
        $(id).textContent = text;
    };
    const best = bestTime('drive');
    setText('drive-best', best ? `Best ${formatTime(best)}` : 'No best time yet');
    /** Input, simulation, camera and HUD for one frame; draw() renders it. */
    const update = (dt) => {
        const now = performance.now();
        const running = state === 'play';
        if (running) {
            if (kit.input.pressed('pause') && now - stateAt > 250)
                openMenu();
            if (kit.input.pressed('camera'))
                firstPerson = !firstPerson;
            if (kit.input.pressed('reset')) {
                reset();
                notice('Back at the road checkpoint.');
            }
        }
        else if (state === 'menu' && kit.input.pressed('pause') && now - stateAt > 400)
            resume();
        if (running !== wasRunning) {
            wasRunning = running;
            clock.reset();
        }
        let alpha = 1;
        if (state === 'play')
            alpha = clock.advance(dt, step);
        car.position.lerpVectors(previous, current, alpha);
        car.rotation.y = previousYaw + (model.yaw - previousYaw) * alpha;
        forward.set(-Math.sin(car.rotation.y), 0, -Math.cos(car.rotation.y));
        const speed = Math.abs(model.speed);
        if (firstPerson) {
            camera.position.copy(car.position).addScaledVector(forward, .5);
            camera.position.y += 1.65;
            camera.lookAt(look.copy(camera.position).addScaledVector(forward, 20));
            car.visible = false;
        }
        else {
            car.visible = true;
            destination.copy(car.position).addScaledVector(forward, -8);
            destination.y += 4.5;
            camera.position.lerp(destination, cameraReady ? 1 - Math.exp(-8 * dt) : 1);
            camera.lookAt(look.copy(car.position).addScaledVector(forward, 4).setY(car.position.y + .9));
        }
        cameraReady = true;
        if (shake > 0) {
            shake = Math.max(0, shake - dt);
            camera.position.x += (Math.random() - .5) * shake * .5;
            camera.position.y += (Math.random() - .5) * shake * .3;
        }
        // A little more field of view at speed; the original fixed 65° felt slow at 100 km/h.
        const fov = 65 + Math.min(1, speed / 28) * 7;
        if (Math.abs(fov - camera.fov) > .05) {
            camera.fov += (fov - camera.fov) * Math.min(1, dt * 4);
            camera.updateProjectionMatrix();
        }
        sun.position.set(car.position.x - 25, 50, car.position.z + 10);
        sun.target.position.copy(car.position);
        if (state === 'play')
            sound.engine(true, speed / 28);
        setText('drive-speed', String(Math.round(speed * 3.6)));
        setText('drive-integrity', String(Math.max(0, integrity)));
        setText('drive-time', formatTime(elapsed));
    };
    const draw = () => {
        if (sun.parent !== scene)
            activateSun();
        kit.renderer.toneMappingExposure = 1;
        kit.renderer.render(scene, camera);
    };

    // ---- Warm up (camera and matrices in place, pipelines compiled), then hand over the menu.
    update(0);
    scene.updateMatrixWorld(true);
    await warmUp(kit.renderer, scene, camera);
    state = 'menu';
    stateAt = performance.now();
    playBtn.disabled = false;
    saveBtn.disabled = false;
    playBtn.textContent = 'Drive';
    nav.set($('drive-menu'), { onBack: () => back(), focus: playBtn });
    status.textContent = session.shared['yard-cleared'] === true
        ? 'Loading Bay complete. Progress arrived through the run contract.'
        : 'Direct launch. The driving episode also works without the first-person episode.';
    if (new URL(location.href).searchParams.has('test'))
        Object.assign(window, { strataTest: { model, session, get state() { return state; } } });

    return {
        id: 'drive',
        frame(dt) {
            update(dt);
            draw();
        },
        save: () => (finish ? true : save()),
        dispose: () => scope.dispose(),
    };
}
