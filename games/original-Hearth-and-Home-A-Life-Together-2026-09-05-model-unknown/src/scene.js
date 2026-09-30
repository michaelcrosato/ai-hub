/**
 * scene.js — the home in 3D on the kit's renderer (WebGPU, WebGL2 fallback).
 *
 * The low-poly primitives from model.js are merged into a handful of meshes
 * (the whole house is one draw call) that share one node material. Vertex
 * attributes carry each primitive's colour, its clickable room (aTarget) and
 * whether it glows in the evening (aGlow), so hover highlights and lit
 * windows cost no extra materials. React calls sync() with the game state;
 * the kit loop calls frame() every frame.
 */
import * as THREE from 'three/webgpu';
import { attribute, uniform, color, float, abs, sin, time } from 'three/tsl';
import { buildHouse, buildPerson, buildDog, familyPeople, TARGETS } from './model.js';
import { age, owns } from './engine.js';

const TARGET_IDS = ['stove', 'table', 'sofa', 'chair', 'bed', 'desk', 'shelf', 'record', 'phone', 'laundry', 'garden', 'mailbox'];
const targetId = (name) => TARGET_IDS.indexOf(name) + 1;
const ONE = [1, 1, 1];
const TAU = Math.PI * 2;

const _euler = new THREE.Euler();
const _quat = new THREE.Quaternion();
const _pos = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _matrix = new THREE.Matrix4();
const _color = new THREE.Color();
const _v = new THREE.Vector3();
const _ndc = new THREE.Vector2();
const _obj = new THREE.Object3D();

function primitive(item) {
    const [w, h, d] = item.size;
    if (item.kind === 'box')
        return new THREE.BoxGeometry(w, h, d);
    if (item.kind === 'cylinder')
        return new THREE.CylinderGeometry(w, d, h, item.sides || 10);
    return new THREE.SphereGeometry(w, item.segments || 8, item.rings || 5);
}

/** Merge model primitives into one indexed geometry. triTargets holds each triangle's room id (0 = none). */
function mergeItems(items) {
    const parts = [];
    let vertices = 0, indices = 0;
    for (const item of items) {
        const g = primitive(item);
        _euler.set(item.rotation[0], item.rotation[1], item.rotation[2]);
        _quat.setFromEuler(_euler);
        const sc = item.scale || ONE;
        _matrix.compose(_pos.fromArray(item.position), _quat, _scale.set(sc[0], sc[1], sc[2]));
        g.applyMatrix4(_matrix);
        parts.push([item, g]);
        vertices += g.attributes.position.count;
        indices += g.index.count;
    }
    const position = new Float32Array(vertices * 3), normal = new Float32Array(vertices * 3), colors = new Float32Array(vertices * 3);
    const target = new Float32Array(vertices), glow = new Float32Array(vertices);
    const index = vertices > 65535 ? new Uint32Array(indices) : new Uint16Array(indices);
    const triTargets = new Uint8Array(indices / 3);
    let vo = 0, io = 0;
    for (const [item, g] of parts) {
        const n = g.attributes.position.count;
        position.set(g.attributes.position.array, vo * 3);
        normal.set(g.attributes.normal.array, vo * 3);
        _color.set(item.color);
        const t = item.target ? targetId(item.target) : 0, gl = item.glow || 0;
        for (let i = 0; i < n; i++) {
            colors[(vo + i) * 3] = _color.r;
            colors[(vo + i) * 3 + 1] = _color.g;
            colors[(vo + i) * 3 + 2] = _color.b;
            target[vo + i] = t;
            glow[vo + i] = gl;
        }
        const src = g.index.array;
        for (let i = 0; i < src.length; i++)
            index[io + i] = src[i] + vo;
        triTargets.fill(t, io / 3, (io + src.length) / 3);
        vo += n;
        io += src.length;
        g.dispose();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aTarget', new THREE.BufferAttribute(target, 1));
    geometry.setAttribute('aGlow', new THREE.BufferAttribute(glow, 1));
    geometry.setIndex(new THREE.BufferAttribute(index, 1));
    geometry.computeBoundingSphere();
    return { geometry, triTargets };
}

function shadowed(mesh) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

const wrapAngle = (a) => a - TAU * Math.floor((a + Math.PI) / TAU);
const damp = (k, dt) => 1 - Math.exp(-k * dt);

export function createStage(kit) {
    const { renderer, input } = kit;
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    kit.canvas.setAttribute('aria-label', 'An interactive low-poly isometric view of your home. Every activity is also available in the activity menu.');

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 120);
    const size = { w: 1, h: 1 };
    let hover = null, hoverDirty = true, lastPX = -1, lastPY = -1;
    kit.onResize((w, h) => {
        size.w = w;
        size.h = h;
        camera.left = -w / 2;
        camera.right = w / 2;
        camera.top = h / 2;
        camera.bottom = -h / 2;
        hoverDirty = true;
    });

    // Lights (three.js r169 units from the original React Three Fiber scene; no legacy conversion needed).
    const ambient = new THREE.AmbientLight(0xffffff, 1.15);
    const hemi = new THREE.HemisphereLight('#fff4d4', '#90a180', 1.4);
    const sun = new THREE.DirectionalLight(0xffffff, 2.9);
    const SUN = new THREE.Vector3(-6, 15, 7);
    sun.position.copy(SUN);
    sun.castShadow = true;
    kit.shadow(sun, 2048);
    Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 40 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.025;
    sun.shadow.radius = 2;
    scene.add(ambient, hemi, sun, sun.target);
    const DAY = new THREE.Color(0xffffff), DUSK = new THREE.Color('#ffc58c');

    // A soft contact shadow on the page behind the diorama.
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.ShadowNodeMaterial({ opacity: 0.17, transparent: true }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.815;
    ground.receiveShadow = true;
    scene.add(ground);

    // One material for the house, the people and the dog.
    const uHover = uniform(0), uActive = uniform(0), uEvening = uniform(0), uMotion = uniform(1);
    const tid = attribute('aTarget', 'float'), glow = attribute('aGlow', 'float');
    const match = (u) => float(1).sub(abs(tid.sub(u)).min(1)).mul(u.min(1));
    const pulse = float(0.8).add(sin(time.mul(4)).mul(0.2).mul(uMotion));
    const material = new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.88, flatShading: true });
    material.emissiveNode = color(0xffe2a8).mul(match(uHover).mul(0.2).mul(pulse))
        .add(color(0xffd9a0).mul(match(uActive).mul(0.1)))
        .add(color(0xffc870).mul(glow.mul(uEvening).mul(0.85)));

    const house = shadowed(new THREE.Mesh(new THREE.BufferGeometry(), material));
    house.visible = false; // until the first sync() builds it
    let houseTargets = new Uint8Array(0), houseKey = '';
    scene.add(house);

    // People: one merged mesh each, in a group that walks, bobs and turns.
    const people = new Map();
    function person(id, params) {
        const key = JSON.stringify(params);
        let p = people.get(id);
        if (p && p.key === key)
            return p;
        if (!p) {
            p = { group: new THREE.Group(), mesh: null, key: '', pos: [0, 0, 0], angle: 0, placed: false, baseY: 0, facing: 0, busy: false };
            scene.add(p.group);
            people.set(id, p);
        }
        if (p.mesh) {
            p.group.remove(p.mesh);
            p.mesh.geometry.dispose();
        }
        p.mesh = shadowed(new THREE.Mesh(mergeItems(buildPerson(params)).geometry, material));
        p.group.add(p.mesh);
        p.key = key;
        return p;
    }

    // Biscuit the dog: body plus a tail on a pivot so it can wag.
    const dogParts = buildDog();
    const dog = { group: new THREE.Group(), tilt: new THREE.Group(), wag: new THREE.Group(), pos: new THREE.Vector3(), facing: 0, placed: false };
    dog.group.add(shadowed(new THREE.Mesh(mergeItems(dogParts.body).geometry, material)));
    dog.tilt.position.set(0, 0.36, -0.24);
    dog.tilt.rotation.x = -0.75;
    dog.tilt.add(dog.wag);
    dog.wag.add(shadowed(new THREE.Mesh(mergeItems(dogParts.tail).geometry, material)));
    dog.group.add(dog.tilt);
    dog.group.visible = false;
    scene.add(dog.group);

    // A little burst of sparkles where an activity finishes.
    const BURST = kit.detail(28, 10);
    const sparks = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.075, 0), new THREE.MeshBasicNodeMaterial({ color: 0xffffff }), BURST);
    sparks.frustumCulled = false;
    sparks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const SPARK_COLORS = ['#f2c764', '#e99683', '#9bc5a4', '#fff4d9', '#eab0b6'].map((c) => new THREE.Color(c));
    const particles = [];
    _obj.scale.setScalar(0);
    _obj.updateMatrix();
    for (let i = 0; i < BURST; i++) {
        particles.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0, max: 1, spin: 0 });
        sparks.setMatrixAt(i, _obj.matrix);
        sparks.setColorAt(i, SPARK_COLORS[i % SPARK_COLORS.length]);
    }
    scene.add(sparks);
    let sparksAlive = false;

    // View state: the angle and zoom the player asks for, and the smoothed ones on screen.
    const view = { angle: 0, zoom: 1, targetAngle: 0, targetZoom: 1 };
    const flags = { reduced: false, interactive: true, walking: false, hasDog: false, dayT: 0, evening: 0, eveningTarget: 0, synced: false };
    let playerTarget = TARGETS.home;
    const drag = { tracking: false, x: 0, y: 0, dist: 0 };
    const raycaster = new THREE.Raycaster();
    const handlers = { onSelect: null, onHover: null };

    function rebuildHouse(state, walls) {
        const { geometry, triTargets } = mergeItems(buildHouse(state, walls));
        house.geometry.dispose();
        house.geometry = geometry;
        house.visible = true;
        houseTargets = triTargets;
        hoverDirty = true;
    }

    function pick(nx, ny) {
        if (!house.geometry.index)
            return null;
        _ndc.set(nx, ny);
        raycaster.setFromCamera(_ndc, camera);
        for (const hit of raycaster.intersectObject(house, false)) {
            const t = houseTargets[hit.faceIndex];
            if (t)
                return TARGET_IDS[t - 1];
        }
        return null;
    }

    function setHover(t) {
        if (t === hover)
            return;
        hover = t;
        uHover.value = t ? targetId(t) : 0;
        kit.canvas.style.cursor = t ? 'pointer' : '';
        handlers.onHover?.(t);
    }

    function placeCamera() {
        const yaw = Math.PI / 4 + view.angle;
        camera.position.set(Math.sin(yaw) * 24, 17.8, Math.cos(yaw) * 24 + 0.7);
        camera.lookAt(0, 0.8, 0.7);
        camera.zoom = Math.min(size.w / 23, size.h / 17) * view.zoom;
        camera.updateProjectionMatrix();
    }

    function stepPerson(p, dt, t, target, angle) {
        const g = p.group;
        if (!p.placed) {
            g.position.set(target[0], target[1], target[2]);
            p.baseY = target[1];
            p.facing = angle;
            p.placed = true;
        }
        const dx = target[0] - g.position.x, dz = target[2] - g.position.z;
        const moving = Math.hypot(dx, dz) > 0.05;
        const k = Math.min(1, dt * 4);
        g.position.x += dx * k;
        g.position.z += dz * k;
        p.baseY += (target[1] - p.baseY) * Math.min(1, dt * 6);
        let bob = 0, wobble = 0;
        if (!flags.reduced) {
            if (moving)
                bob = Math.abs(Math.sin(t * 10)) * 0.04;
            else if (p.busy) {
                bob = Math.abs(Math.sin(t * 7)) * 0.018;
                wobble = Math.sin(t * 5.5) * 0.14;
            }
            else
                bob = Math.sin(t * 2) * 0.007;
        }
        g.position.y = p.baseY + bob;
        const desired = moving ? Math.atan2(dx, dz) : angle;
        p.facing += wrapAngle(desired - p.facing) * Math.min(1, dt * 5);
        g.rotation.y = p.facing + wobble;
        return moving;
    }

    function stepDog(dt, t, player) {
        if (!flags.hasDog) {
            dog.group.visible = false;
            dog.placed = false;
            return;
        }
        dog.group.visible = true;
        const g = player.group, facing = player.facing;
        // Beside the homemaker, a little behind: on the walk, trotting alongside.
        const side = flags.walking ? 0.42 : 0.55, back = flags.walking ? 0.05 : -0.2;
        _v.set(Math.cos(facing) * side + Math.sin(facing) * back, 0, -Math.sin(facing) * side + Math.cos(facing) * back);
        const tx = g.position.x + _v.x, tz = g.position.z + _v.z, ty = player.baseY + 0.04; // paws level with the homemaker's shoes
        if (!dog.placed) {
            dog.pos.set(tx, ty, tz);
            dog.facing = facing;
            dog.placed = true;
        }
        const dx = tx - dog.pos.x, dz = tz - dog.pos.z, dist = Math.hypot(dx, dz);
        const moving = dist > 0.08;
        const k = Math.min(1, dt * (flags.walking ? 4.5 : 3));
        dog.pos.x += dx * k;
        dog.pos.z += dz * k;
        dog.pos.y += (ty - dog.pos.y) * Math.min(1, dt * 6);
        const lookX = g.position.x - dog.pos.x, lookZ = g.position.z - dog.pos.z;
        const desired = moving ? Math.atan2(dx, dz) : Math.atan2(lookX, lookZ);
        dog.facing += wrapAngle(desired - dog.facing) * Math.min(1, dt * 6);
        const bob = flags.reduced ? 0 : moving ? Math.abs(Math.sin(t * 16)) * 0.035 : 0;
        dog.group.position.set(dog.pos.x, dog.pos.y + bob, dog.pos.z);
        dog.group.rotation.y = dog.facing;
        dog.wag.rotation.z = flags.reduced ? 0.25 : Math.sin(t * (moving ? 20 : 9)) * (moving ? 0.55 : 0.4);
    }

    function stepSparks(dt) {
        if (!sparksAlive)
            return;
        let alive = false;
        for (let i = 0; i < particles.length; i++) {
            const s = particles[i];
            if (s.life <= 0)
                continue;
            s.life -= dt;
            if (s.life <= 0) {
                _obj.scale.setScalar(0);
            }
            else {
                alive = true;
                s.v.y -= 2.2 * dt;
                s.p.addScaledVector(s.v, dt);
                _obj.position.copy(s.p);
                _obj.rotation.set(s.spin * s.life, s.spin * s.life * 0.7, 0);
                _obj.scale.setScalar(Math.min(1, s.life / s.max * 1.6));
            }
            _obj.updateMatrix();
            sparks.setMatrixAt(i, _obj.matrix);
        }
        sparks.instanceMatrix.needsUpdate = true;
        sparksAlive = alive;
    }

    function stepLight(dt) {
        flags.evening += (flags.eveningTarget - flags.evening) * Math.min(1, dt * 1.5);
        const ev = flags.evening;
        // The sun drifts a little across the day and sinks when the day is settled.
        const yaw = flags.dayT * 0.55;
        const c = Math.cos(yaw), s = Math.sin(yaw);
        sun.position.set(SUN.x * c + SUN.z * s, SUN.y - 5 * ev, -SUN.x * s + SUN.z * c);
        sun.intensity = 2.9 * (1 - 0.42 * ev);
        sun.color.lerpColors(DAY, DUSK, ev);
        hemi.intensity = 1.4 * (1 - 0.3 * ev);
        ambient.intensity = 1.15 * (1 - 0.25 * ev);
        uEvening.value = ev;
    }

    function stepInput(dt) {
        if (!flags.interactive) {
            drag.tracking = false;
            setHover(null);
            return;
        }
        const look = input.look('look');
        view.targetAngle -= look.x;
        view.targetAngle += input.value('turn') * 1.8 * dt;
        const z = input.zoom();
        if (z)
            view.targetZoom *= Math.exp(z * 0.12);
        if (input.down('zoomIn'))
            view.targetZoom *= Math.exp(1.1 * dt);
        if (input.down('zoomOut'))
            view.targetZoom *= Math.exp(-1.1 * dt);
        view.targetZoom = Math.min(1.55, Math.max(0.65, view.targetZoom));

        // A click or tap that did not drag the view picks a room.
        const p = input.pointer;
        if (p.justDown) {
            drag.tracking = true;
            drag.x = p.x;
            drag.y = p.y;
            drag.dist = 0;
        }
        if (drag.tracking)
            drag.dist = Math.max(drag.dist, Math.hypot(p.x - drag.x, p.y - drag.y));
        if (p.justUp && drag.tracking) {
            drag.tracking = false;
            if (drag.dist < 8) {
                const t = pick(p.nx, p.ny);
                if (t)
                    handlers.onSelect?.(t);
            }
        }
        if (p.down && drag.dist >= 8)
            kit.canvas.style.cursor = 'grabbing';
        else if (kit.canvas.style.cursor === 'grabbing')
            kit.canvas.style.cursor = hover ? 'pointer' : '';
        // Hover previews for a mouse.
        if (p.over && p.type !== 'touch' && !p.down) {
            if (hoverDirty || p.x !== lastPX || p.y !== lastPY) {
                lastPX = p.x;
                lastPY = p.y;
                hoverDirty = false;
                setHover(pick(p.nx, p.ny));
            }
        }
        else if (!p.over && hover)
            setHover(null);
    }

    const api = {
        scene,
        camera,
        handlers,
        /** Keep the scene in step with the game. Cheap to call on every React render. */
        sync({ state, walls, active, reduced, interactive }) {
            const key = [state.turn, state.owned.join(','), Math.floor(state.clutter / 12), state.stats.home < 30, walls, !!state.dayCounts.picnic, !!state.dayCounts.festive, !!state.counts.bulbs, !!state.counts.preserve].join('|');
            if (key !== houseKey) {
                houseKey = key;
                rebuildHouse(state, walls);
            }
            const self = person('self', { skin: state.profile.skin, color: '#74aaa0', apron: true, old: age(state) > 62 });
            self.busy = !!active;
            const wanted = new Set(['self']);
            for (const f of familyPeople(state)) {
                const p = person(f.id, f.params);
                p.pos = f.pos;
                p.angle = f.angle;
                p.group.scale.setScalar(f.scale);
                wanted.add(f.id);
            }
            for (const [id, p] of people)
                if (!wanted.has(id)) {
                    scene.remove(p.group);
                    p.mesh.geometry.dispose();
                    people.delete(id);
                }
            playerTarget = TARGETS[active?.target || 'home'] || TARGETS.home;
            uActive.value = active ? targetId(active.target) : 0;
            flags.walking = active?.id === 'walkdog';
            flags.hasDog = owns(state, 'dog');
            flags.reduced = !!reduced;
            uMotion.value = reduced ? 0 : 1;
            flags.interactive = !!interactive;
            flags.dayT = Math.max(0, Math.min(1, (480 - state.minutes) / 480));
            flags.eveningTarget = state.ended || state.finished ? 1 : Math.max(0, (flags.dayT - 0.7) / 0.3) * 0.35;
            if (!flags.synced) {
                flags.synced = true;
                flags.evening = flags.eveningTarget;
            }
        },
        /** Pre-build the GPU pipelines so the first frames do not stutter. */
        warm() {
            return renderer.compileAsync(scene, camera).catch(() => { });
        },
        rotate(d) { view.targetAngle += d; },
        zoomBy(d) { view.targetZoom = Math.min(1.55, Math.max(0.65, view.targetZoom + d)); },
        resetView() {
            view.angle = wrapAngle(view.angle);
            view.targetAngle = 0;
            view.targetZoom = 1;
        },
        /** Sparkles over a room when an activity finishes. */
        burst(target) {
            if (flags.reduced)
                return;
            const at = TARGETS[target] || TARGETS.home;
            for (let i = 0; i < particles.length; i++) {
                const s = particles[i];
                s.p.set(at[0] + (Math.random() - 0.5) * 0.5, at[1] + 1.1 + Math.random() * 0.4, at[2] + (Math.random() - 0.5) * 0.5);
                const a = Math.random() * TAU, sp = 0.4 + Math.random() * 0.9;
                s.v.set(Math.cos(a) * sp, 1.2 + Math.random() * 1.3, Math.sin(a) * sp);
                s.max = s.life = 0.8 + Math.random() * 0.6;
                s.spin = 4 + Math.random() * 6;
            }
            sparksAlive = true;
        },
        /** Set by the app: runs first every frame (its input handling). */
        beforeFrame: null,
        frame(dt, t) {
            api.beforeFrame?.(dt, t);
            stepInput(dt);
            const k = flags.reduced ? 1 : damp(10, dt);
            view.angle += (view.targetAngle - view.angle) * k;
            view.zoom += (view.targetZoom - view.zoom) * k;
            placeCamera();
            const self = people.get('self');
            if (self) {
                stepPerson(self, dt, t, playerTarget, 0.5);
                stepDog(dt, t, self);
            }
            for (const [id, p] of people)
                if (id !== 'self')
                    stepPerson(p, dt, t, p.pos, p.angle);
            stepSparks(dt);
            stepLight(dt);
            renderer.render(scene, camera);
        },
    };
    return api;
}
