import { FixedClock } from '../core/clock.js';
import { Events } from '../core/events.js';
import { ExperienceManager } from '../core/ExperienceManager.js';
import { freshState, validateCheckpoint } from '../core/contracts.js';
import { Store } from '../core/Store.js';
import { Scope } from '../core/Scope.js';
import { Input, LOOK_UNIT } from './Input.js';
import { Renderer } from './Renderer.js';
import { AudioBus } from './Audio.js';

/** Sentry difficulty: how hard their shots land and how long they aim. */
export const DIFFICULTY = {
  relaxed: { label: 'Relaxed', damage: 0.6, aim: 1.35 },
  standard: { label: 'Standard', damage: 1, aim: 1 },
  veteran: { label: 'Veteran', damage: 1.45, aim: 0.8 },
};

/** Chapters the player can always start from the chapter list. */
const OPEN = ['foundry', 'foundry-alt'];

/**
 * The host owns the frame loop (the kit's), the renderer, input and audio. Exactly one experience
 * is active at a time; the host connects their exits and carries the shared player state. It also
 * keeps the player's progress: chapters reached, the checkpoint, and best chapter times.
 */
export class Host {
  status = 'loading';
  events = new Events();
  scope = new Scope();
  clock = new FixedClock(60, 5);
  pendingExit = null;
  running = true;
  busy = false;
  logs = [];
  fps = 0;
  frameCount = 0;
  statsTime = 0;
  lockRequestedAt = -1e9;
  pausedAt = -1e9;
  lastHandoff = null;
  entryHandoff = null;
  constructor(kit, registry) {
    this.kit = kit;
    this.canvas = kit.canvas;
    this.registry = registry;
    this.store = new Store();
    const saved = this.store.get('settings', {}) || {};
    this.settings = {
      volume: 0.25,
      motion: true,
      muted: false,
      difficulty: 'standard',
      bindings: {},
      ...saved,
      // Look speed and invert-Y live in the shared kit settings (controls panel).
      sensitivity: LOOK_UNIT,
      invertY: false,
    };
    if (!DIFFICULTY[this.settings.difficulty]) this.settings.difficulty = 'standard';
    delete this.settings.quality;
    const reached = this.store.get('reached', []);
    this.reached = new Set([...OPEN, ...(Array.isArray(reached) ? reached.filter((id) => typeof id === 'string') : [])]);
    this.renderer = new Renderer(kit);
    this.audio = new AudioBus();
    this.audio.setVolume(this.settings.volume);
    this.audio.setMuted(this.settings.muted);
    this.input = new Input(kit);
    this.input.applyBindings(this.settings.bindings);
    this.manager = new ExperienceManager(registry, {
      renderer: this.renderer,
      input: this.input,
      audio: this.audio,
      settings: this.settings,
      store: this.store,
      notify: (t) => this.notify(t),
      rumble: (strength, ms) => kit.input.rumble(strength, ms),
      requestExit: (exit, serial) => {
        if (!this.pendingExit) this.pendingExit = { exit, serial };
      },
    });
    this.scope.on(document, 'pointerlockchange', () => {
      if (this.status === 'play' && this.experience?.controls?.captureMouse && document.pointerLockElement !== this.canvas && kit.input.source === 'keyboard')
        this.pause();
    });
    this.scope.on(document, 'visibilitychange', () => {
      if (document.hidden) this.pause();
      this.clock.reset();
    });
    this.scope.on(window, 'blur', () => {
      if (this.status === 'play') this.pause();
    });
    this.scope.on(window, 'keydown', (e) => {
      if (/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName)) return;
      if (e.code === 'F5') {
        e.preventDefault();
        this.saveCheckpoint();
      }
      // F9 opens the shared settings panel, so the checkpoint loads from F8.
      if (e.code === 'F8') {
        e.preventDefault();
        void this.loadCheckpoint();
      }
    });
    // The kit's settings panel pauses the loop: hold the audio with it.
    kit.onPause((paused) => {
      if (paused) this.audio.pause();
      else if (this.status === 'play') this.audio.resume();
    });
    kit.start((dt) => this.tick(dt));
  }
  get active() {
    return this.manager.active;
  }
  get experience() {
    return this.active?.instance;
  }
  get manifest() {
    return this.active?.manifest;
  }
  get difficulty() {
    return DIFFICULTY[this.settings.difficulty] || DIFFICULTY.standard;
  }
  setStatus(status) {
    this.status = status;
    // On-screen touch controls only while an experience is being played.
    this.kit.touch?.suspend(status !== 'play', 'game');
    if (status !== 'play') this.audio.engineOff();
    this.events.emit('status', status);
  }
  notify(text) {
    this.logs.unshift({ time: new Date().toLocaleTimeString(), text });
    this.logs.length = Math.min(this.logs.length, 50);
    this.events.emit('notice', text);
  }
  /** A pointer-driven FPS needs the mouse captured before play; a gamepad or touch player does not. */
  needsCapture(instance) {
    // A lock asked for a moment ago is usually still on its way: do not stop for it.
    const requested = performance.now() - this.lockRequestedAt < 1500;
    return !!instance?.controls?.captureMouse && this.kit.input.source === 'keyboard' && document.pointerLockElement !== this.canvas && !requested;
  }
  /** Chapters reached in a run (the first chapter and its variant are always open). */
  isReached(id) {
    return this.reached.has(id);
  }
  markReached(id) {
    if (this.reached.has(id)) return;
    this.reached.add(id);
    this.store.set('reached', [...this.reached].filter((x) => !OPEN.includes(x)));
  }
  /** Best chapter times in seconds, by experience id. */
  chapterBests() {
    const b = this.store.get('chapter-best', {});
    return b && typeof b === 'object' && !Array.isArray(b) ? b : {};
  }
  async load(id, { mode = 'play', handoff = freshState(), local = null, ready = true, document = null } = {}) {
    if (this.busy) return false;
    this.busy = true;
    const before = this.status;
    this.input.enabled = false;
    this.input.clear();
    this.pendingExit = null;
    this.setStatus('loading');
    try {
      const record = await this.manager.replace(id, { mode, handoff, local, document });
      this.input.bind(record.instance.controls);
      // Restart replays this chapter with the state the player brought into it.
      this.entryHandoff = handoff;
      // Build the batches and compile their shaders behind the loading card, not on the first frames.
      await this.renderer.warm(record.scene);
      this.clock.reset();
      this.markReached(id);
      this.events.emit('loaded', record);
      this.setStatus(ready ? 'ready' : this.needsCapture(record.instance) ? 'paused' : 'play');
      this.input.enabled = this.status === 'play';
      if (this.status === 'play') {
        this.kit.input.settle();
        this.audio.resume();
      }
      this.notify(`${record.manifest.title}. ${record.manifest.subtitle || ''}`.trim());
      return true;
    } catch (error) {
      console.error(error);
      this.setStatus(this.active ? (before === 'ready' ? 'ready' : 'paused') : 'error');
      if (globalThis.document.pointerLockElement) globalThis.document.exitPointerLock();
      this.notify(`Load failed: ${error.message}`);
      this.events.emit('error', error);
      return false;
    } finally {
      this.busy = false;
      this.events.emit('status', this.status);
    }
  }
  capture() {
    if (!this.experience?.controls?.captureMouse) return;
    // The kit skips this on touch and quietly falls back when the browser refuses the lock.
    this.lockRequestedAt = performance.now();
    this.kit.input.lockPointer();
  }
  async play() {
    if (this.busy) return;
    this.audio.unlock();
    this.capture();
    if (['ready', 'paused'].includes(this.status)) {
      this.input.clear();
      this.kit.input.settle();
      this.clock.reset();
      this.setStatus('play');
      this.input.enabled = true;
      this.audio.resume();
    }
  }
  pause() {
    if (this.status !== 'play') return;
    this.input.enabled = false;
    this.input.clear();
    this.clock.reset();
    this.pausedAt = performance.now();
    this.setStatus('paused');
    this.audio.pause();
    if (document.pointerLockElement) document.exitPointerLock();
  }
  /** The pause action (Esc, P, Start, the II pill): close a dialog, pause, or resume. */
  pauseAction() {
    const dialog = document.getElementById('dialog');
    if (dialog?.open) {
      dialog.close();
      return;
    }
    if (this.status === 'play') this.pause();
    // Esc also ends the mouse lock, which pauses first: that same press must not resume at once.
    else if (this.status === 'paused' && performance.now() - this.pausedAt > 350) void this.play();
  }
  async restart() {
    if (this.busy) return;
    if (document.pointerLockElement) document.exitPointerLock();
    return this.load(this.manifest.id, { mode: 'play', ready: true, handoff: this.entryHandoff ?? freshState() });
  }
  /** The handoff for the next cartridge, with this chapter's play time added to the run record. */
  handoffWithTime() {
    const handoff = this.experience.exportState();
    const prev = handoff.extensions['strata.run'];
    const run = prev && typeof prev === 'object' && prev.times && typeof prev.times === 'object' ? prev : { times: {} };
    const id = this.manifest.id,
      time = Math.round((Number(this.experience.time) || 0) * 10) / 10;
    run.times[id] = time;
    handoff.extensions['strata.run'] = run;
    // A finished chapter can set a best time, whether it was played in a run or on its own.
    const bests = this.chapterBests(),
      previous = Number(bests[id]) || 0,
      isBest = time > 0 && (!previous || time < previous);
    if (isBest) {
      bests[id] = time;
      this.store.set('chapter-best', bests);
    }
    this.events.emit('chapter', { id, title: this.manifest.title, time, previous, isBest });
    return handoff;
  }
  async route(exit, serial) {
    if (this.active?.serial !== serial) return;
    const target = this.manifest.routes?.[exit];
    if (!target) {
      this.notify(`Unknown exit: ${exit}. Define this route in the manifest.`);
      return;
    }
    const handoff = this.handoffWithTime();
    this.lastHandoff = handoff;
    if (target === '$finish' || !this.registry.entries.has(target)) {
      this.input.enabled = false;
      this.input.clear();
      if (document.pointerLockElement) document.exitPointerLock();
      this.setStatus('complete');
      // The end of the line: the train's horn, then the completion chime.
      if (target === '$finish') this.audio.play('horn');
      this.audio.play('complete');
      this.events.emit('complete', handoff);
      this.notify(target === '$finish' ? 'Sequence complete.' : `Standalone exit reached. This cartridge requested ${target}.`);
      return;
    }
    // The next chapter starts from a fresh checkpoint, so Continue resumes there.
    if (await this.load(target, { mode: 'play', handoff, ready: false })) this.saveCheckpoint(true);
  }
  saveCheckpoint(silent = false) {
    if (!this.experience || !['play', 'paused', 'ready'].includes(this.status)) {
      if (!silent) this.notify('Checkpoints are saved while a chapter is open.');
      return false;
    }
    if (this.experience.dead) {
      if (!silent) this.notify('Checkpoint not saved while the player is down.');
      return false;
    }
    try {
      const data = {
        version: 1,
        experience: this.manifest.id,
        handoff: this.experience.exportState(),
        local: this.experience.saveLocal?.() ?? null,
        document: this.experience.document ?? null,
      };
      validateCheckpoint(data);
      const persisted = this.store.set('checkpoint', data);
      if (!silent) this.notify(persisted ? 'Checkpoint saved in this browser.' : 'Checkpoint kept in memory. Browser storage is unavailable.');
      this.events.emit('checkpoint', data);
      return true;
    } catch (e) {
      if (!silent) this.notify(`Checkpoint not saved: ${e.message}`);
      return false;
    }
  }
  /** The saved checkpoint, if any, without loading it. */
  checkpointInfo() {
    const raw = this.store.get('checkpoint');
    if (!raw || typeof raw.experience !== 'string' || !this.registry.entries.has(raw.experience)) return null;
    return raw;
  }
  async loadCheckpoint() {
    const raw = this.store.get('checkpoint');
    if (!raw) {
      this.notify('No saved checkpoint is available.');
      return false;
    }
    try {
      const c = validateCheckpoint(raw);
      this.registry.get(c.experience);
      return await this.load(c.experience, { mode: 'play', handoff: c.handoff, local: c.local, document: c.document, ready: true });
    } catch (e) {
      this.notify(`Checkpoint not loaded: ${e.message}`);
      return false;
    }
  }
  settingsChanged() {
    this.audio.setVolume(this.settings.volume);
    this.audio.setMuted(this.settings.muted);
    this.input.applyBindings(this.settings.bindings);
    // eslint-disable-next-line no-unused-vars
    const { sensitivity, invertY, ...persist } = this.settings;
    this.store.set('settings', persist);
    this.events.emit('settings', this.settings);
  }
  fail(error) {
    this.input.enabled = false;
    this.setStatus('error');
    if (document.pointerLockElement) document.exitPointerLock();
    this.notify(error.message);
    this.events.emit('error', error);
  }
  tick(dt) {
    if (!this.running) return;
    const exp = this.experience;
    try {
      this.input.poll();
      if (this.kit.input.pressed('pause')) this.pauseAction();
      if (exp) {
        let alpha = 1;
        if (this.status === 'play' && !this.busy) {
          exp.beforeFrame?.();
          alpha = this.clock.advance(dt, (step) => {
            if (!this.pendingExit) exp.fixedUpdate(step);
          });
        }
        exp.update(this.status === 'play' ? dt : 0, alpha);
        this.events.emit('frame', { dt, alpha });
        this.renderer.render(this.active.scene);
      } else this.events.emit('frame', { dt, alpha: 1 });
      this.frameCount++;
      this.statsTime += dt;
      if (this.statsTime >= 0.5) {
        this.fps = Math.round(this.frameCount / this.statsTime);
        this.frameCount = 0;
        this.statsTime = 0;
        this.events.emit('stats', { fps: this.fps, ...this.renderer.stats, dropped: this.clock.droppedTime });
      }
      if (this.pendingExit && !this.busy) {
        const { exit, serial } = this.pendingExit;
        this.pendingExit = null;
        void this.route(exit, serial);
      }
    } catch (error) {
      console.error(error);
      this.fail(error);
    }
  }
  async dispose() {
    this.running = false;
    this.kit.stop();
    this.scope.dispose();
    this.input.dispose();
    this.audio.dispose();
    await this.manager.dispose();
    this.renderer.dispose();
    this.events.clear();
  }
}
