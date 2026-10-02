import * as THREE from 'three/webgpu';
import { FixedClock } from '../core/clock.js';
import { Events } from '../core/events.js';
import { History } from '../core/history.js';
import { createPrefabs } from '../level/prefabs.js';
import { builtinSchemas, validateLevel } from '../level/schema.js';
import { RenderWorld } from './RenderWorld.js';
import { Input } from './Input.js';
import { Assets } from './Assets.js';
import { PhysicsWorld } from './PhysicsWorld.js';
import { Behaviors, registerBuiltins } from './BehaviorSystem.js';
import { Runtime } from './Runtime.js';
import { Sound } from './Sound.js';

/** Controller rumble (and phone haptics) per game cue: [strength, milliseconds]. */
const RUMBLE = { pad: [.5, 140], plate: [.15, 50], switch: [.2, 50], pickup: [.3, 90], checkpoint: [.2, 80], throw: [.3, 80], goal: [.6, 260], unlock: [.35, 160], deny: [.2, 90] };

/**
 * Modes: 'edit' (the workbench), 'play' (a running play test), 'paused', and 'done'
 * (the results card after reaching the exit). The kit owns the renderer, the loop and
 * the devices; the engine owns the document, its history and the play-test runtime.
 */
export class Engine {
    kit;
    events = new Events();
    prefabs = createPrefabs();
    schemas = builtinSchemas();
    behaviors = new Behaviors(this.schemas);
    assets = new Assets();
    clock = new FixedClock(60, 5);
    sound = new Sound();
    view;
    input;
    plugins = new Map();
    runtime;
    mode = 'edit';
    document;
    history;
    /** The level slot the document is saved to (see level/library.js). */
    slot = 'yard';
    /** save(slot, document) → boolean. The app wires this to the level library. */
    saver = null;
    /** 0 under prefers-reduced-motion. */
    motion = 1;
    /** The running play test: { time, finished, results }. */
    session = null;
    statTime = 0;
    statFrames = 0;
    debugElapsed = 0;
    debugLines = null;
    hooks = new Set();
    savedCamera = null;
    #lockedThisRun = false;
    #pauseGuard = 0;
    #hookErrors = new WeakSet();
    constructor(kit) {
        this.kit = kit;
        this.view = new RenderWorld(kit);
        this.input = new Input(kit.input);
        registerBuiltins(this.behaviors);
        this.motion = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1;
        document.addEventListener('pointerlockchange', () => {
            const locked = document.pointerLockElement === kit.canvas;
            if (locked && this.mode === 'play')
                this.#lockedThisRun = true;
            // Losing a captured mouse (Esc, switching windows, the settings panel) pauses the test.
            // The Esc that released it may still arrive as a pause press: ignore that one.
            else if (!locked && this.mode === 'play' && this.#lockedThisRun) {
                this.pause();
                this.#pauseGuard = performance.now() + 400;
            }
        });
        document.addEventListener('visibilitychange', () => {
            if (document.hidden)
                this.pause();
            this.clock.reset();
        });
        kit.onPause(paused => {
            this.sound.setPaused(paused);
            if (!paused)
                this.clock.reset();
        });
        // A click on the view during a test captures the mouse again (pointer lock needs a click).
        kit.canvas.addEventListener('click', () => this.captureMouse());
    }
    get playing() { return this.mode !== 'edit'; }
    /** Load the first level. The loop starts with run(), once the editor and panel exist. */
    start(data) {
        PhysicsWorld.init(this.kit.RAPIER);
        this.load(data, this.slot);
    }
    run() { this.kit.start(this.frame); }
    use(plugin) {
        if (this.plugins.has(plugin.id))
            throw new Error(`Plugin already installed: ${plugin.id}`);
        this.plugins.set(plugin.id, plugin.install(this));
    }
    onFrame(callback) { this.hooks.add(callback); return () => { this.hooks.delete(callback); }; }
    notice(message) { this.events.emit('notice', message); }
    #runtime(data, playing) {
        return new Runtime(data, playing, this.view, this.input, this.prefabs, this.behaviors, this.assets, m => this.notice(m), this.#cue, { motion: this.motion });
    }
    /** Replace the document (a level from the library or an import) and return to the editor. */
    load(raw, slot = this.slot) {
        const candidate = validateLevel(raw, this.prefabs.ids, this.schemas);
        const next = this.#runtime(candidate, false);
        this.runtime?.dispose();
        this.runtime = next;
        this.slot = slot;
        this.document = candidate;
        this.history = new History(candidate);
        this.session = null;
        this.savedCamera = null;
        this.view.environment(candidate.environment);
        this.view.fitShadow();
        this.events.emit('document', structuredClone(candidate));
        this.#setMode('edit');
        this.save();
    }
    commit(edit) {
        if (this.mode !== 'edit')
            return false;
        try {
            const draft = structuredClone(this.document);
            edit(draft);
            const valid = validateLevel(draft, this.prefabs.ids, this.schemas);
            if (JSON.stringify(valid) === JSON.stringify(this.document))
                return false;
            this.replace(valid);
            this.history.commit(valid);
            this.save();
            return true;
        }
        catch (error) {
            this.notice(error instanceof Error ? error.message : String(error));
            return false;
        }
    }
    replace(data) {
        const next = this.#runtime(data, false);
        this.runtime.dispose();
        this.runtime = next;
        this.document = structuredClone(data);
        this.view.environment(data.environment);
        this.view.fitShadow();
        this.events.emit('document', structuredClone(data));
    }
    undo() {
        if (this.mode === 'edit' && this.history.canUndo) {
            this.replace(this.history.undo());
            this.save();
        }
    }
    redo() {
        if (this.mode === 'edit' && this.history.canRedo) {
            this.replace(this.history.redo());
            this.save();
        }
    }
    save() {
        if (!this.saver?.(this.slot, this.document))
            this.notice('Local save is unavailable. Export the level to keep your changes.');
    }
    #setMode(mode) {
        this.mode = mode;
        const playing = mode === 'play';
        this.input.enabled = playing;
        this.input.clear();
        this.clock.reset();
        if (!playing)
            this.kit.input.unlockPointer();
        this.view.editorHelpers.visible = mode === 'edit';
        // On-screen controls only during a test; menus and the editor take taps directly.
        this.kit.touch?.suspend(!playing, 'strata');
        // The button that changed the mode must not also act in the new one.
        this.kit.input.settle();
        this.events.emit('mode', mode);
    }
    play() {
        if (this.mode === 'paused') {
            this.resume();
            return;
        }
        if (this.mode !== 'edit')
            return;
        this.savedCamera = { position: this.view.camera.position.clone(), rotation: this.view.camera.quaternion.clone(), fov: this.view.camera.fov };
        try {
            this.#startRun();
        }
        catch (error) {
            this.notice(error instanceof Error ? error.message : String(error));
            return;
        }
        // Within the click that started the test, so the browser grants pointer lock.
        this.captureMouse();
    }
    /** Start the test again from the spawn, with a fresh runtime and timer. */
    restart() {
        if (this.mode === 'edit')
            return;
        try {
            this.#startRun();
        }
        catch (error) {
            this.notice(error instanceof Error ? error.message : String(error));
            return;
        }
        this.captureMouse();
    }
    #startRun() {
        const next = this.#runtime(structuredClone(this.document), true);
        this.runtime.dispose();
        this.runtime = next;
        this.session = { time: 0, finished: false, results: null };
        this.#lockedThisRun = false;
        this.view.fitShadow();
        this.#setMode('play');
    }
    /**
     * Ask for pointer lock for mouse look. Without it (refused, touch, a gamepad, a page that
     * forbids it) the test simply runs: keys, sticks and touch still play, and a click on the
     * view tries again.
     */
    captureMouse() {
        if (this.mode !== 'play' || this.kit.input.pointerLocked)
            return;
        this.kit.input.lockPointer();
    }
    pause() {
        if (this.mode !== 'play')
            return;
        this.#setMode('paused');
    }
    /** Back to the test from the pause card, or from the results card ("keep exploring"). */
    resume() {
        if (this.mode !== 'paused' && this.mode !== 'done')
            return;
        this.#setMode('play');
        this.captureMouse();
    }
    stop() {
        if (this.mode === 'edit')
            return;
        this.replace(this.document);
        this.session = null;
        if (this.savedCamera) {
            this.view.camera.position.copy(this.savedCamera.position);
            this.view.camera.quaternion.copy(this.savedCamera.rotation);
            this.view.camera.fov = this.savedCamera.fov;
            this.view.camera.updateProjectionMatrix();
        }
        this.#setMode('edit');
    }
    #finish() {
        const s = this.session, stats = this.runtime.stats;
        s.finished = true;
        s.results = { time: s.time, cells: stats.cells, cellsTotal: stats.cellsTotal, respawns: stats.respawns, message: this.runtime.completeMessage };
        this.#setMode('done');
        this.events.emit('finish', s.results);
    }
    /** Game events from the runtime: sound, rumble, and HUD feedback (via the 'cue' event). */
    #cue = (name, info) => {
        this.sound.play(name, info);
        const r = RUMBLE[name];
        if (r)
            this.kit.input.rumble(r[0], r[1]);
        else if (name === 'land')
            this.kit.input.rumble(.15 + .35 * (info ?? 0), 60 + 60 * (info ?? 0));
        else if (name === 'respawn' && info !== 'manual')
            this.kit.input.rumble(.7, 200);
        this.events.emit('cue', { name, info });
    };
    setDebug(show) {
        if (!this.debugLines) {
            this.debugLines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true, opacity: .65 }));
            this.debugLines.frustumCulled = false;
            this.debugLines.renderOrder = 10;
            this.debugLines.visible = false;
            this.view.scene.add(this.debugLines);
        }
        if (show)
            this.#updateDebug();
        this.debugLines.visible = show;
        this.debugElapsed = 0;
    }
    /** Copy Rapier's debug lines into a reused buffer (grown only when the level gets bigger). */
    #updateDebug() {
        const data = this.runtime.physics.world.debugRender();
        const count = Math.floor(data.vertices.length / 3);
        let geometry = this.debugLines.geometry, position = geometry.getAttribute('position');
        if (!position || position.count < count) {
            const capacity = Math.max(2048, Math.ceil(count * 1.5));
            geometry.dispose();
            geometry = new THREE.BufferGeometry();
            position = new THREE.BufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage);
            geometry.setAttribute('position', position);
            geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage));
            this.debugLines.geometry = geometry;
        }
        const color = geometry.getAttribute('color'), rgb = color.array, rgba = data.colors;
        position.array.set(data.vertices.subarray(0, count * 3));
        for (let i = 0; i < count; i++) {
            rgb[i * 3] = rgba[i * 4];
            rgb[i * 3 + 1] = rgba[i * 4 + 1];
            rgb[i * 3 + 2] = rgba[i * 4 + 2];
        }
        position.needsUpdate = true;
        color.needsUpdate = true;
        geometry.setDrawRange(0, count);
    }
    frame = (dt) => {
        this.input.poll();
        // Pause and resume: Esc / P, Start, or the II pill.
        if (this.kit.input.pressed('pause')) {
            if (this.mode === 'play')
                this.pause();
            else if (this.mode === 'paused' && performance.now() > this.#pauseGuard)
                this.resume();
        }
        let alpha = 1;
        try {
            if (this.mode === 'play') {
                this.runtime.player?.look(this.input.look());
                alpha = this.clock.advance(dt, step => {
                    this.runtime.fixedStep(step, this.input);
                    if (this.session && !this.session.finished)
                        this.session.time += step;
                });
                if (this.runtime.complete && this.session && !this.session.finished)
                    this.#finish();
            }
            if (this.mode === 'play' || this.mode === 'edit')
                this.runtime.render(alpha, dt);
        }
        catch (error) {
            console.error(error);
            this.pause();
            this.notice(`Runtime stopped: ${error instanceof Error ? error.message : String(error)}`);
        }
        for (const hook of this.hooks) {
            try {
                hook(dt);
            }
            catch (error) {
                // Report a failing hook once; keep drawing.
                if (!this.#hookErrors.has(hook)) {
                    this.#hookErrors.add(hook);
                    console.error(error);
                }
            }
        }
        this.debugElapsed += dt;
        if (this.debugLines?.visible && this.debugElapsed > .1) {
            this.debugElapsed = 0;
            this.#updateDebug();
        }
        this.view.draw();
        this.statTime += dt;
        this.statFrames++;
        if (this.statTime > .5) {
            const info = this.view.renderer.info.render, motor = this.runtime.player?.motor;
            this.events.emit('stats', { fps: Math.round(this.statFrames / this.statTime), draws: info.drawCalls ?? info.calls, triangles: info.triangles, bodies: this.runtime.physics.world.bodies.len(), speed: motor ? Math.hypot(motor.vx, motor.vz) : 0, grounded: motor?.grounded ?? false, dropped: this.clock.droppedTime });
            this.statTime = 0;
            this.statFrames = 0;
        }
    };
}
