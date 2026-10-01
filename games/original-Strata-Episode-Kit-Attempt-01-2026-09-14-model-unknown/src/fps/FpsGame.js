import { FixedClock } from '../core/clock.js';
import { createPrefabs } from '../level/prefabs.js';
import { builtinSchemas, validateLevel } from '../level/schema.js';
import { RenderWorld } from '../engine/RenderWorld.js';
import { Controls } from '../engine/Controls.js';
import { Assets } from '../engine/Assets.js';
import { PhysicsWorld } from '../engine/PhysicsWorld.js';
import { Behaviors, registerBuiltins } from '../engine/BehaviorSystem.js';
import { Runtime } from '../engine/Runtime.js';
/**
 * A play-only FPS starter. It does not import the editor or the campaign contract. The
 * wall's kit owns the renderer, the loop and the devices; this owns the level, the fixed
 * 60 Hz simulation and the view. The shell calls frame() once per rendered frame.
 */
export class FpsGame {
    options;
    kit;
    clock = new FixedClock(60, 5);
    view;
    controls;
    assets;
    runtime;
    data;
    running = false;
    completed = false;
    disposed = false;
    constructor(kit, sun, level, options) {
        this.kit = kit;
        this.options = options;
        try {
            this.view = new RenderWorld(kit, sun);
            this.controls = new Controls(kit.input);
            this.assets = new Assets();
            const prefabs = createPrefabs(), schemas = builtinSchemas(), behaviors = new Behaviors(schemas);
            registerBuiltins(behaviors);
            options.configure?.({ prefabs, schemas, behaviors });
            const data = validateLevel(level, prefabs.ids, schemas);
            this.data = data;
            this.runtime = new Runtime(data, true, this.view, this.controls, prefabs, behaviors, this.assets, text => options.notice?.(text), (type, entity, extra) => options.event?.(type, entity, extra));
            // Behaviors have claimed what moves; everything still fixed and plain is baked.
            this.view.bakeStatic(this.runtime.physics.entities.values());
            this.view.environment(data.environment);
            this.view.camera.fov = data.player.fov;
            this.view.camera.updateProjectionMatrix();
        }
        catch (error) {
            this.dispose();
            throw error;
        }
    }
    static async create(kit, sun, level, options = {}) {
        await PhysicsWorld.init();
        return new FpsGame(kit, sun, level, options);
    }
    get player() { return this.runtime.player; }
    setRunning(value) {
        if (this.disposed)
            return;
        this.running = value;
        this.controls.enabled = value;
        this.controls.clear();
        this.clock.reset();
        this.options.mode?.(value);
    }
    pause() { this.setRunning(false); }
    /** One rendered frame: simulate while running, always draw. */
    frame(dt) {
        if (this.disposed)
            return;
        let alpha = 1;
        try {
            if (this.running) {
                this.controls.poll();
                this.player.look();
                alpha = this.clock.advance(dt, step => {
                    this.options.beforeStep?.(step, this);
                    this.runtime.fixedStep(step, this.controls);
                    this.options.afterStep?.(step, this);
                });
                this.controls.stepsDone(this.clock.lastSteps);
                if (this.runtime.complete && !this.completed) {
                    this.completed = true;
                    this.options.complete?.();
                }
            }
            this.runtime.render(alpha, this.running ? dt : 0);
            this.options.render?.(this.running ? dt : 0, this);
        }
        catch (error) {
            this.pause();
            this.options.notice?.(`Simulation stopped: ${String(error)}`);
            console.error(error);
        }
        this.view.draw();
    }
    dispose() {
        if (this.disposed)
            return;
        this.disposed = true;
        this.running = false;
        if (this.controls)
            this.controls.enabled = false;
        this.runtime?.dispose();
        this.assets?.dispose();
        this.view?.dispose();
    }
}
