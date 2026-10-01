import { FixedClock } from '../core/clock.js';
import { Scope } from '../kit/scope.js';
import { createPrefabs } from '../level/prefabs.js';
import { builtinSchemas, validateLevel } from '../level/schema.js';
import { RenderWorld } from '../engine/RenderWorld.js';
import { Input } from '../engine/Input.js';
import { Assets } from '../engine/Assets.js';
import { PhysicsWorld } from '../engine/PhysicsWorld.js';
import { Behaviors, registerBuiltins } from '../engine/BehaviorSystem.js';
import { Runtime } from '../engine/Runtime.js';
/**
 * A play-only FPS host on the shared kit. It does not import the editor or the campaign contract.
 * The page owns the one frame loop (kit.start) and calls game.frame(dt) from it.
 */
export class FpsGame {
    kit;
    options;
    scope = new Scope();
    clock = new FixedClock(60, 5);
    view;
    input;
    assets;
    runtime;
    running = false;
    completed = false;
    lastError = '';
    constructor(kit, level, options) {
        this.kit = kit;
        this.options = options;
        try {
            this.view = new RenderWorld(kit);
            this.scope.own(() => this.view.dispose());
            this.input = new Input(kit.input);
            this.scope.own(() => this.input.dispose());
            this.assets = new Assets();
            this.scope.own(() => this.assets.dispose());
            const prefabs = createPrefabs(), schemas = builtinSchemas(), behaviors = new Behaviors(schemas);
            registerBuiltins(behaviors);
            options.configure?.({ prefabs, schemas, behaviors });
            const data = validateLevel(level, prefabs.ids, schemas);
            this.runtime = new Runtime(data, true, this.view, this.input, prefabs, behaviors, this.assets, text => options.notice?.(text), { cue: kind => options.cue?.(kind) });
            this.scope.own(() => this.runtime.dispose());
            this.view.environment(data.environment);
            this.view.mergeStatic(this.runtime.physics.entities.values());
            this.view.fitShadow();
            this.view.camera.fov = data.player.fov;
            this.view.camera.updateProjectionMatrix();
            this.scope.listen(document, 'visibilitychange', () => { if (document.hidden)
                this.pause(); });
            this.scope.listen(window, 'blur', () => this.pause());
            this.scope.listen(window, 'pagehide', () => this.dispose());
        }
        catch (error) {
            this.scope.dispose();
            throw error;
        }
    }
    static async create(kit, level, options = {}) {
        await PhysicsWorld.init();
        return new FpsGame(kit, level, options);
    }
    get player() { return this.runtime.player; }
    /**
     * Start or resume. Call it from a click or a key press: with a mouse it also
     * captures the pointer for mouse look. Gamepad and touch play needs no capture.
     */
    play() {
        if (this.scope.disposed || document.hidden || this.completed)
            return;
        this.setRunning(true);
        // Buttons still held from the menu (a gamepad trigger, a mouse button) wait for a release.
        this.input.gateFire();
        if (this.kit.input.source === 'keyboard')
            this.kit.input.lockPointer();
    }
    setRunning(value) {
        if (this.running === value)
            return;
        this.running = value;
        this.input.enabled = value;
        this.input.clear();
        this.clock.reset();
        this.options.mode?.(value);
    }
    pause() {
        if (this.scope.disposed || !this.running)
            return;
        this.setRunning(false);
        this.kit.input.unlockPointer();
    }
    /** One rendered frame: input, fixed simulation steps while running, then drawing. */
    frame(dt) {
        if (this.scope.disposed)
            return;
        let alpha = 1;
        try {
            if (this.running) {
                this.input.poll();
                this.player.look(this.input.look());
                alpha = this.clock.advance(dt, step => {
                    // A step may pause the game (the exit, a menu); the rest of the frame's steps wait.
                    if (!this.running)
                        return;
                    this.options.beforeStep?.(step, this);
                    this.runtime.fixedStep(step, this.input);
                    this.options.afterStep?.(step, this);
                });
                if (this.runtime.complete && !this.completed) {
                    this.completed = true;
                    this.options.complete?.();
                }
            }
            const live = this.running ? dt : 0;
            this.runtime.render(alpha, live);
            this.options.render?.(live, this);
            this.view.draw(live);
        }
        catch (error) {
            this.pause();
            const text = String(error);
            if (text !== this.lastError) {
                this.lastError = text;
                this.options.notice?.(`Simulation stopped: ${text}`);
                console.error(error);
            }
        }
    }
    dispose() {
        if (this.scope.disposed)
            return;
        this.pause();
        this.scope.dispose();
    }
}
