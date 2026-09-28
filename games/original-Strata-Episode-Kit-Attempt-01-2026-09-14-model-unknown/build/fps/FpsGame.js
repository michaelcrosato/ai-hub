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
/** A play-only FPS starter. It does not import the editor or the campaign contract. */
export class FpsGame {
    options;
    scope = new Scope();
    clock = new FixedClock(60, 5);
    view;
    input;
    assets;
    runtime;
    running = false;
    frame = 0;
    lastTime = 0;
    completed = false;
    constructor(host, level, options) {
        this.options = options;
        try {
            this.view = new RenderWorld(host);
            this.scope.own(() => this.view.dispose());
            this.input = new Input(this.view.renderer.domElement);
            this.scope.own(() => this.input.dispose());
            this.input.bind('respawn', ['KeyT']);
            this.assets = new Assets();
            this.scope.own(() => this.assets.dispose());
            const prefabs = createPrefabs(), schemas = builtinSchemas(), behaviors = new Behaviors(schemas);
            registerBuiltins(behaviors);
            options.configure?.({ prefabs, schemas, behaviors });
            const data = validateLevel(level, prefabs.ids, schemas);
            this.runtime = new Runtime(data, true, this.view, this.input, prefabs, behaviors, this.assets, text => options.notice?.(text));
            this.scope.own(() => this.runtime.dispose());
            this.view.environment(data.environment);
            this.view.camera.fov = data.player.fov;
            this.view.camera.updateProjectionMatrix();
            this.view.editorHelpers.visible = false;
            this.scope.listen(document, 'pointerlockchange', () => {
                this.setRunning(document.pointerLockElement === this.input.canvas && !document.hidden);
            });
            this.scope.listen(document, 'pointerlockerror', () => {
                this.pause();
                options.notice?.('Mouse capture was denied. Select the play button to try again.');
            });
            this.scope.listen(document, 'visibilitychange', () => { if (document.hidden)
                this.pause(); this.lastTime = 0; });
            this.scope.listen(window, 'blur', () => this.pause());
            this.scope.listen(this.input.canvas, 'webglcontextlost', event => {
                event.preventDefault();
                this.pause();
                options.notice?.('Graphics context lost. Reload this page to recover.');
            });
            this.scope.listen(window, 'pagehide', () => this.dispose());
            this.scope.own(() => cancelAnimationFrame(this.frame));
            this.frame = requestAnimationFrame(this.tick);
        }
        catch (error) {
            this.scope.dispose();
            throw error;
        }
    }
    static async create(host, level, options = {}) {
        await PhysicsWorld.init();
        return new FpsGame(host, level, options);
    }
    get player() { return this.runtime.player; }
    /** Call from a click. The physics module must already be ready. */
    play() {
        if (this.scope.disposed || document.hidden)
            return;
        try {
            const result = this.input.canvas.requestPointerLock();
            void Promise.resolve(result).catch(error => {
                this.pause();
                this.options.notice?.(`Mouse capture failed. Open this page in a separate tab. ${String(error)}`);
            });
        }
        catch (error) {
            this.pause();
            this.options.notice?.(`Mouse capture failed: ${String(error)}`);
        }
    }
    setRunning(value) {
        this.running = value;
        this.input.enabled = value;
        this.input.clear();
        this.clock.reset();
        this.lastTime = 0;
        this.options.mode?.(value);
    }
    pause() {
        if (this.scope.disposed)
            return;
        this.setRunning(false);
        if (document.pointerLockElement === this.input.canvas)
            document.exitPointerLock();
    }
    tick = (now) => {
        if (this.scope.disposed)
            return;
        const dt = this.lastTime === 0 ? 0 : Math.min((now - this.lastTime) / 1000, .25);
        this.lastTime = now;
        let alpha = 1;
        try {
            if (this.running) {
                this.player.look();
                alpha = this.clock.advance(dt, step => {
                    this.options.beforeStep?.(step, this);
                    this.runtime.fixedStep(step, this.input);
                    this.options.afterStep?.(step, this);
                });
                if (this.runtime.complete && !this.completed) {
                    this.completed = true;
                    this.options.complete?.();
                }
            }
            this.runtime.render(alpha, this.running ? dt : 0);
            this.options.render?.(this.running ? dt : 0, this);
            this.view.draw();
        }
        catch (error) {
            this.pause();
            this.options.notice?.(`Simulation stopped: ${String(error)}`);
            console.error(error);
        }
        this.frame = requestAnimationFrame(this.tick);
    };
    dispose() {
        if (this.scope.disposed)
            return;
        this.pause();
        this.scope.dispose();
    }
}
