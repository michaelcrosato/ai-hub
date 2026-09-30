import { FixedClock } from '../core/clock.js';
import { Scope } from '../engine/Scope.js';
import { createPrefabs } from '../level/prefabs.js';
import { builtinSchemas, validateLevel } from '../level/schema.js';
import { RenderWorld } from '../engine/RenderWorld.js';
import { Input } from '../engine/Input.js';
import { Behaviors, registerBuiltins } from '../engine/BehaviorSystem.js';
import { Runtime } from '../engine/Runtime.js';

/**
 * A play-only FPS runtime on the shared kit. The kit owns the renderer, the loop, and the
 * devices; this owns one scene, one physics world, and the running/paused state.
 * frame(dt) is called by the page from kit.start().
 */
export class FpsGame {
    options;
    scope = new Scope();
    clock = new FixedClock(60, 5);
    view;
    input;
    runtime;
    running = false;
    locked = false;
    skipCollect = false;
    constructor(kit, level, options = {}) {
        this.kit = kit;
        this.options = options;
        try {
            this.view = new RenderWorld(kit);
            this.scope.own(() => this.view.dispose());
            this.input = new Input(kit.input);
            const prefabs = createPrefabs(), schemas = builtinSchemas(), behaviors = new Behaviors(schemas);
            registerBuiltins(behaviors);
            options.configure?.({ prefabs, schemas, behaviors });
            const data = validateLevel(level, prefabs.ids, schemas);
            this.runtime = new Runtime(data, this.view, this.input, prefabs, behaviors, text => options.notice?.(text));
            this.scope.own(() => this.runtime.dispose());
            this.view.environment(data.environment);
            this.view.camera.fov = data.player.fov;
            this.view.camera.updateProjectionMatrix();
            // Mouse look uses pointer lock. Losing the lock (Esc, alt-tab) pauses, as before.
            this.scope.listen(document, 'pointerlockchange', () => {
                const locked = document.pointerLockElement === kit.canvas;
                if (this.locked && !locked && this.running)
                    this.pause();
                this.locked = locked;
            });
            this.scope.listen(document, 'visibilitychange', () => { if (document.hidden)
                this.pause(); });
            this.scope.listen(window, 'blur', () => this.pause());
            // Running without the lock (it was refused, or Chrome's re-lock delay after Esc): a click takes it.
            this.scope.listen(kit.canvas, 'pointerdown', event => {
                if (this.running && event.pointerType === 'mouse' && !this.locked)
                    kit.input.lockPointer();
            });
        }
        catch (error) {
            this.scope.dispose();
            throw error;
        }
    }
    get player() { return this.runtime.player; }
    /** Call from a click, tap, or pad press. Pointer lock is requested for mouse players only. */
    play() {
        if (this.scope.disposed || document.hidden)
            return;
        this.setRunning(true);
        if (this.kit.input.source === 'keyboard')
            this.kit.input.lockPointer();
    }
    setRunning(value) {
        if (this.running === value)
            return;
        this.running = value;
        this.input.enabled = value;
        this.input.clear();
        // The press that resumed (a pad's A on the menu) must not also reach the game this frame.
        this.skipCollect = value;
        this.clock.reset();
        // Held buttons (the one that resumed, or a trigger held into the pause) do not count as fresh presses.
        this.kit.input.settle();
        this.options.mode?.(value);
    }
    pause() {
        if (this.scope.disposed || !this.running)
            return;
        this.setRunning(false);
        this.kit.input.unlockPointer();
    }
    /** dt is the kit's frame time in seconds (already clamped to 0.1). */
    frame(dt) {
        if (this.scope.disposed)
            return;
        let alpha = 1;
        try {
            if (this.running) {
                if (this.skipCollect)
                    this.skipCollect = false;
                else
                    this.input.collect();
                this.player.look();
                let stepped = false;
                alpha = this.clock.advance(dt, step => {
                    stepped = true;
                    this.options.beforeStep?.(step, this);
                    this.runtime.fixedStep(step, this.input);
                    this.options.afterStep?.(step, this);
                });
                if (stepped)
                    this.input.flush();
            }
            const simDt = this.running ? dt : 0;
            this.runtime.render(alpha, simDt);
            this.options.render?.(simDt, this, dt);
            this.view.draw();
        }
        catch (error) {
            this.pause();
            this.options.notice?.(`Simulation stopped: ${String(error?.message ?? error)}`);
            // Rethrown so the kit records it in window.__kit.errors as well.
            throw error;
        }
    }
    dispose() {
        if (this.scope.disposed)
            return;
        this.pause();
        this.scope.dispose();
    }
}
