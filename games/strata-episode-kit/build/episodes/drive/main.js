import * as THREE from 'three';
import { FixedClock } from '../../core/clock.js';
import { random } from '../../core/math.js';
import { connectEpisode, downloadText } from '../../kit/browser.js';
import { CarModel } from './model.js';
const el = (id) => document.getElementById(id);
const notice = (text) => { el('notice').textContent = text; el('status').textContent = text; };
let cleanup;
try {
    const { session, scope } = await connectEpisode('drive', new URL('../../campaign.json', location.href), notice);
    cleanup = () => scope.dispose();
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el('viewport').append(renderer.domElement);
    scope.own(() => { renderer.dispose(); renderer.domElement.remove(); });
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#b5cfce');
    scene.fog = new THREE.FogExp2('#b5cfce', .009);
    const camera = new THREE.PerspectiveCamera(65, 1, .1, 400), sun = new THREE.DirectionalLight('#fff0ce', 3.2);
    sun.position.set(-25, 50, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -40;
    sun.shadow.camera.right = 40;
    sun.shadow.camera.top = 40;
    sun.shadow.camera.bottom = -40;
    sun.shadow.camera.far = 250;
    scene.add(sun, sun.target, new THREE.HemisphereLight('#e7f1dc', '#536b61', 2.3));
    scope.own(() => sun.shadow.dispose());
    const boxGeometry = new THREE.BoxGeometry(1, 1, 1), rockGeometry = new THREE.IcosahedronGeometry(1, 0);
    const materials = new Map();
    const material = (color) => { let m = materials.get(color); if (!m) {
        m = new THREE.MeshStandardMaterial({ color, roughness: .9, flatShading: true });
        materials.set(color, m);
    } return m; };
    const box = (x, y, z, w, h, d, color, parent = scene) => { const mesh = new THREE.Mesh(boxGeometry, material(color)); mesh.position.set(x, y, z); mesh.scale.set(w, h, d); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh; };
    scope.own(() => { boxGeometry.dispose(); rockGeometry.dispose(); for (const m of materials.values())
        m.dispose(); scene.clear(); });
    box(0, -.6, -90, 90, 1, 240, '#799681');
    box(0, -.02, -90, 20, .12, 220, '#596b64');
    box(40, -1, -90, 55, .2, 400, '#7ba8aa');
    const barriers = [{ x: -10.5, z: -90, halfX: .5, halfZ: 110 }, { x: 10.5, z: -90, halfX: .5, halfZ: 110 }, { x: 0, z: 19, halfX: 11, halfZ: .5 }];
    for (const x of [-10.5, 10.5])
        box(x, .5, -90, 1, 1, 220, '#cbbd97');
    for (let i = 0; i < 28; i++)
        box(0, .06, 12 - i * 7.3, .16, .025, 3, '#ddc991');
    for (const [x, z] of [[-4, -35], [4, -72], [-4, -111], [4, -150]]) {
        barriers.push({ x, z, halfX: 3, halfZ: .7 });
        box(x, .7, z, 6, 1.4, 1.4, '#b87757');
        box(x, 1.42, z, 5.8, .05, 1.1, '#e4c789');
    }
    const rng = random(15);
    for (let i = 0; i < 70; i++) {
        const rock = new THREE.Mesh(rockGeometry, material(i % 2 ? '#81937d' : '#a1ab8e'));
        rock.position.set(-17 - rng() * 20, rng() * 4, 20 - rng() * 230);
        rock.scale.set(4 + rng() * 8, 4 + rng() * 12, 4 + rng() * 8);
        rock.castShadow = true;
        scene.add(rock);
    }
    for (const z of [-57, -123]) {
        box(0, .07, z, 19, .02, .5, '#93c6ac');
        box(-8.5, 2, z, .2, 4, .2, '#d8dfbb');
        box(8.5, 2, z, .2, 4, .2, '#d8dfbb');
    }
    box(-8, 3, -185, .5, 6, .5, '#e9d59c');
    box(8, 3, -185, .5, 6, .5, '#e9d59c');
    box(0, 5.8, -185, 16, .5, .5, '#e9d59c');
    const car = new THREE.Group();
    scene.add(car);
    box(0, .7, 0, 2, .7, 3.8, '#4b8c85', car);
    box(0, 1.3, -.15, 1.65, .7, 1.8, '#283d3d', car);
    for (const x of [-1, 1])
        for (const z of [-1.2, 1.2])
            box(x, .42, z, .35, .7, .7, '#202c2b', car);
    box(0, .8, -1.94, 1.65, .18, .05, '#e6d493', car);
    const model = new CarModel(), previous = new THREE.Vector3(), clock = new FixedClock(60, 5), keys = new Set();
    let previousYaw = 0, running = false, frame = 0, lastTime = 0, firstPerson = false, finish = false;
    let checkpoint = Number.isInteger(session.local.checkpoint) ? Math.max(0, Math.min(2, Number(session.local.checkpoint))) : 0;
    let integrity = typeof session.local.integrity === 'number' ? Math.max(1, Math.min(100, session.local.integrity)) : 100;
    let elapsed = typeof session.local.elapsed === 'number' ? Math.max(0, Math.min(86400, session.local.elapsed)) : 0;
    const reset = () => { const hits = model.collisions, distance = model.distance; model.reset(); model.collisions = hits; model.distance = distance; model.z = [4, -62, -129][checkpoint]; previous.set(model.x, 0, model.z); previousYaw = model.yaw; };
    if (typeof session.local.collisions === 'number' && Number.isSafeInteger(session.local.collisions) && session.local.collisions >= 0)
        model.collisions = Math.min(session.local.collisions, 1000000);
    if (typeof session.local.distance === 'number' && session.local.distance >= 0)
        model.distance = Math.min(session.local.distance, 10000000);
    reset();
    const save = () => session.checkpoint({ checkpoint, integrity, elapsed, collisions: model.collisions, distance: model.distance });
    const setRunning = (value) => { running = value; keys.clear(); clock.reset(); lastTime = 0; el('menu').hidden = value; };
    const pause = () => setRunning(false);
    const resize = new ResizeObserver(() => { const width = innerWidth, height = innerHeight; renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); });
    resize.observe(el('viewport'));
    scope.own(() => resize.disconnect());
    scope.listen(window, 'keydown', event => {
        const e = event;
        if (/INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target?.tagName) && !running)
            return;
        if (e.code === 'Escape') {
            pause();
            return;
        }
        if (!running)
            return;
        if (['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyR', 'KeyV'].includes(e.code))
            e.preventDefault();
        if (!e.repeat && e.code === 'KeyV')
            firstPerson = !firstPerson;
        if (!e.repeat && e.code === 'KeyR')
            reset();
        keys.add(e.code);
    });
    scope.listen(window, 'keyup', event => keys.delete(event.code));
    scope.listen(window, 'blur', pause);
    scope.listen(document, 'visibilitychange', () => { if (document.hidden)
        pause(); });
    scope.listen(renderer.domElement, 'webglcontextlost', event => { event.preventDefault(); pause(); notice('Graphics context lost. Reload this page.'); });
    scope.listen(el('play'), 'click', () => { setRunning(true); el('play').blur(); });
    scope.listen(el('save'), 'click', () => { try {
        save();
        notice('Road checkpoint saved in this tab.');
    }
    catch (error) {
        notice(String(error));
    } });
    scope.listen(el('export'), 'click', () => { try {
        save();
        downloadText('strata-run.json', session.export());
    }
    catch (error) {
        notice(String(error));
    } });
    const tick = (now) => {
        if (scope.disposed)
            return;
        const dt = lastTime === 0 ? 0 : Math.min((now - lastTime) / 1000, .25);
        lastTime = now;
        let alpha = 1;
        if (running && !finish)
            alpha = clock.advance(dt, step => {
                previous.set(model.x, 0, model.z);
                previousYaw = model.yaw;
                const impacts = model.collisions;
                model.step(step, { throttle: Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown')), steer: Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft')), brake: keys.has('Space') }, barriers);
                elapsed += step;
                if (model.collisions > impacts) {
                    integrity -= 12;
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
                    try {
                        save();
                        notice(`Road checkpoint ${checkpoint} saved.`);
                    }
                    catch (error) {
                        notice(String(error));
                    }
                }
                if (model.z < -184) {
                    finish = true;
                    pause();
                    try {
                        session.complete('arrive', { local: { checkpoint, integrity, elapsed, collisions: model.collisions, distance: model.distance }, shared: { ...session.shared, 'road-clear': true, 'car-integrity': integrity, 'drive-seconds': Math.round(elapsed), 'drive-collisions': model.collisions } });
                    }
                    catch (error) {
                        finish = false;
                        notice(String(error));
                    }
                }
            });
        car.position.lerpVectors(previous, new THREE.Vector3(model.x, 0, model.z), alpha);
        car.rotation.y = previousYaw + (model.yaw - previousYaw) * alpha;
        const forward = new THREE.Vector3(-Math.sin(car.rotation.y), 0, -Math.cos(car.rotation.y));
        if (firstPerson) {
            camera.position.copy(car.position).add(new THREE.Vector3(0, 1.65, 0)).addScaledVector(forward, .5);
            camera.lookAt(camera.position.clone().addScaledVector(forward, 20));
            car.visible = false;
        }
        else {
            car.visible = true;
            const destination = car.position.clone().addScaledVector(forward, -8).add(new THREE.Vector3(0, 4.5, 0));
            camera.position.lerp(destination, lastTime === now && dt === 0 ? 1 : 1 - Math.exp(-8 * dt));
            camera.lookAt(car.position.clone().add(new THREE.Vector3(0, .9, 0)).addScaledVector(forward, 4));
        }
        sun.position.set(car.position.x - 25, 50, car.position.z + 10);
        sun.target.position.copy(car.position);
        el('speed').textContent = String(Math.round(Math.abs(model.speed) * 3.6));
        el('integrity').textContent = String(Math.max(0, integrity));
        renderer.render(scene, camera);
        frame = requestAnimationFrame(tick);
    };
    scope.own(() => cancelAnimationFrame(frame));
    frame = requestAnimationFrame(tick);
    el('play').disabled = false;
    el('save').disabled = false;
    el('play').textContent = 'Drive';
    notice(session.shared['yard-cleared'] === true ? 'Loading bay complete. Progress arrived through the page contract.' : 'Direct launch. The driving episode also works without the FPS episode.');
    if (new URL(location.href).searchParams.has('test'))
        Object.assign(window, { strataTest: { model, session, renderer, pause, get running() { return running; } } });
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
