import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { Events } from '../core/events.js';
import { clamp, degrees, tuple } from '../core/math.js';
import { shortId } from '../level/prefabs.js';

const _offset = new THREE.Vector3();
const _spherical = new THREE.Spherical();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _pointer = new THREE.Vector2();
const _up = new THREE.Vector3(0, 1, 0);

/**
 * The workbench: orbit camera, selection and move/rotate/scale handles on the kit's canvas.
 * Mouse and touch drive OrbitControls and TransformControls directly; tool keys, menus and
 * the gamepad camera come through kit.input actions (see engine/Input.js).
 */
export class Editor {
    engine;
    orbit;
    transform;
    events = new Events();
    selected = null;
    snapping = true;
    box = new THREE.BoxHelper(undefined, 0xd3f4ae);
    pointerStart = new THREE.Vector2();
    dragHappened = false;
    raycaster = new THREE.Raycaster();
    /** Set by the panel: true while one of its menus is open, so editor keys and the pad rest. */
    blocked = () => false;
    constructor(engine) {
        this.engine = engine;
        const { camera, editorHelpers } = engine.view, canvas = engine.kit.canvas;
        this.orbit = new OrbitControls(camera, canvas);
        this.orbit.enableDamping = true;
        this.orbit.dampingFactor = .09;
        this.orbit.maxPolarAngle = Math.PI * .49;
        this.orbit.minDistance = 2;
        this.orbit.maxDistance = 130;
        this.transform = new TransformControls(camera, canvas);
        this.transform.setSize(.8);
        this.transform.setSpace('world');
        this.setSnap(true);
        editorHelpers.add(this.transform.getHelper(), this.box);
        this.box.visible = false;
        this.transform.addEventListener('dragging-changed', event => {
            this.orbit.enabled = !event.value && engine.mode === 'edit';
            if (event.value)
                this.dragHappened = true;
        });
        this.transform.addEventListener('objectChange', () => this.box.update());
        this.transform.addEventListener('mouseUp', () => {
            const object = this.transform.object;
            if (!object || !this.selected)
                return;
            const id = this.selected, position = tuple(object.position), rotation = [degrees(object.rotation.x), degrees(object.rotation.y), degrees(object.rotation.z)], scale = tuple(object.scale).map(n => Math.max(.05, n));
            const committed = engine.commit(d => {
                const e = d.entities.find(e => e.id === id);
                if (e) {
                    e.position = position;
                    e.rotation = rotation;
                    e.scale = scale;
                }
            });
            if (!committed) {
                const source = engine.document.entities.find(e => e.id === id);
                if (source) {
                    object.position.fromArray(source.position);
                    object.rotation.set(...source.rotation.map(value => value * Math.PI / 180));
                    object.scale.fromArray(source.scale);
                    this.box.update();
                }
            }
        });
        canvas.addEventListener('pointerdown', e => { this.pointerStart.set(e.clientX, e.clientY); this.dragHappened = false; });
        canvas.addEventListener('pointerup', e => {
            if (engine.mode !== 'edit' || e.button !== 0 || this.dragHappened || this.transform.axis || Math.hypot(e.clientX - this.pointerStart.x, e.clientY - this.pointerStart.y) > 5)
                return;
            const rect = canvas.getBoundingClientRect();
            _pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
            this.raycaster.setFromCamera(_pointer, camera);
            const hit = this.raycaster.intersectObjects(engine.view.entities.children, true).find(h => h.object.visible);
            this.select(hit ? String(hit.object.userData.entityId) : null);
        });
        // Undo, redo and duplicate use Ctrl / ⌘ chords, which actions cannot express.
        window.addEventListener('keydown', e => {
            if (engine.mode !== 'edit' || this.blocked() || !(e.ctrlKey || e.metaKey) || e.altKey || /INPUT|TEXTAREA|SELECT/.test(e.target?.tagName))
                return;
            if (e.code === 'KeyZ') {
                e.preventDefault();
                if (e.shiftKey)
                    engine.redo();
                else
                    engine.undo();
            }
            else if (e.code === 'KeyY') {
                e.preventDefault();
                engine.redo();
            }
            else if (e.code === 'KeyD') {
                e.preventDefault();
                this.duplicate();
            }
        });
        engine.events.on('document', () => this.select(this.selected));
        engine.events.on('mode', mode => {
            this.orbit.enabled = mode === 'edit';
            this.transform.enabled = mode === 'edit';
            if (mode === 'edit')
                this.select(this.selected);
            else {
                this.transform.detach();
                this.box.visible = false;
            }
        });
        engine.onFrame(dt => this.update(dt));
        this.home();
    }
    update(dt) {
        if (this.engine.mode !== 'edit')
            return;
        const k = this.engine.kit.input;
        if (!this.blocked()) {
            // Plain-key tools (ignored while typing in a field) and the gamepad.
            if (k.pressed('edFocus'))
                this.focus();
            if (k.pressed('edGrid'))
                this.toggleGrid();
            if (k.pressed('edMove'))
                this.setTool('translate');
            if (k.pressed('edRotate'))
                this.setTool('rotate');
            if (k.pressed('edScale'))
                this.setTool('scale');
            if (k.pressed('edDelete'))
                this.remove();
            if (k.pressed('edPrev'))
                this.cycle(-1);
            if (k.pressed('edNext'))
                this.cycle(1);
            if ((k.pressed('back') || k.pressed('pause')) && this.selected)
                this.select(null);
            this.#padCamera(dt);
        }
        this.orbit.update();
        if (this.selected)
            this.box.update();
    }
    /** Gamepad: right stick orbits, left stick pans across the ground, the triggers zoom. */
    #padCamera(dt) {
        const k = this.engine.kit.input;
        if (k.source !== 'gamepad')
            return;
        const look = k.look('look'), move = k.vector('move'), zoom = k.value('edZoom');
        if (!look.x && !look.y && !move.x && !move.y && !zoom)
            return;
        const camera = this.engine.view.camera, target = this.orbit.target;
        _offset.copy(camera.position).sub(target);
        _spherical.setFromVector3(_offset);
        _spherical.theta -= look.x;
        _spherical.phi = clamp(_spherical.phi - look.y, .05, this.orbit.maxPolarAngle);
        _spherical.radius = clamp(_spherical.radius * Math.exp(-zoom * dt * 1.8), this.orbit.minDistance, this.orbit.maxDistance);
        camera.getWorldDirection(_forward);
        _forward.y = 0;
        if (_forward.lengthSq() < 1e-6)
            _forward.set(0, 0, -1);
        _forward.normalize();
        _right.crossVectors(_forward, _up).normalize();
        const speed = Math.max(4, _spherical.radius) * .8 * dt;
        target.addScaledVector(_right, move.x * speed).addScaledVector(_forward, move.y * speed);
        _offset.setFromSpherical(_spherical);
        camera.position.copy(target).add(_offset);
        camera.lookAt(target);
    }
    select(id) {
        this.selected = id && this.engine.runtime.physics.entities.has(id) ? id : null;
        const entity = this.selected ? this.engine.runtime.physics.entities.get(this.selected) : undefined;
        this.transform.detach();
        this.box.visible = !!entity && this.engine.mode === 'edit';
        if (entity && this.engine.mode === 'edit') {
            this.transform.attach(entity.root);
            this.box.setFromObject(entity.root);
        }
        this.events.emit('selection', entity ? structuredClone(entity.data) : null);
    }
    /** Select the previous or next object in the level (gamepad shoulder buttons), and frame it. */
    cycle(direction) {
        const list = this.engine.document.entities;
        if (!list.length)
            return;
        const i = list.findIndex(e => e.id === this.selected);
        const next = i < 0 ? (direction > 0 ? 0 : list.length - 1) : (i + direction + list.length) % list.length;
        this.select(list[next].id);
        this.focus();
    }
    setTool(mode) {
        this.transform.setMode(mode);
        this.events.emit('tool', mode);
    }
    toggleGrid() {
        const grid = this.engine.view.grid;
        grid.visible = !grid.visible;
        this.events.emit('grid', grid.visible);
    }
    setSnap(on) { this.snapping = on; this.transform.setTranslationSnap(on ? .5 : null); this.transform.setRotationSnap(on ? Math.PI / 12 : null); this.transform.setScaleSnap(on ? .25 : null); }
    home() { this.engine.view.camera.fov = 48; this.engine.view.camera.position.set(31, 26, 35); this.orbit.target.set(0, 1, 0); this.orbit.update(); this.engine.view.camera.updateProjectionMatrix(); }
    focus() {
        const entity = this.selected ? this.engine.runtime.physics.entities.get(this.selected) : undefined;
        if (!entity) {
            this.home();
            return;
        }
        const box = new THREE.Box3().setFromObject(entity.root), center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3()).length();
        const direction = this.engine.view.camera.position.clone().sub(this.orbit.target).normalize();
        this.orbit.target.copy(center);
        this.engine.view.camera.position.copy(center).addScaledVector(direction, Math.max(4, size * 1.8));
        this.orbit.update();
    }
    add(prefab) {
        if (this.engine.mode !== 'edit')
            return;
        const point = this.orbit.target.clone();
        point.x = Math.round(point.x * 2) / 2;
        point.z = Math.round(point.z * 2) / 2;
        const ray = new THREE.Raycaster(new THREE.Vector3(point.x, 50, point.z), new THREE.Vector3(0, -1, 0));
        const surface = ray.intersectObjects(this.engine.view.entities.children, true).find(h => !this.engine.runtime.physics.entities.get(String(h.object.userData.entityId))?.data.components.some(c => ['trigger', 'spawn', 'pickup'].includes(c.type)));
        const entity = this.engine.prefabs.create(prefab, [point.x, (surface?.point.y ?? 0) + .04, point.z]);
        if (this.engine.commit(d => { d.entities.push(entity); })) {
            this.select(entity.id);
            this.engine.notice(`${entity.name} added. Use the handles to move it.`);
        }
    }
    duplicate() {
        const source = this.engine.document.entities.find(e => e.id === this.selected);
        if (!source)
            return;
        const copy = structuredClone(source);
        copy.id = `${copy.prefab}-${shortId()}`;
        copy.name += ' copy';
        copy.position[0] += 1.5;
        if (this.engine.commit(d => { d.entities.push(copy); }))
            this.select(copy.id);
    }
    remove() {
        if (!this.selected)
            return;
        const id = this.selected;
        if (this.engine.commit(d => { d.entities = d.entities.filter(e => e.id !== id); }))
            this.select(null);
    }
}
