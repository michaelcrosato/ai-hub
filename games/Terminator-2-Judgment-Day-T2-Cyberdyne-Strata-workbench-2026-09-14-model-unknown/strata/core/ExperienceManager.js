import { Scope } from './Scope.js';
import { validateHandoff, accepts } from './contracts.js';
// A staged load keeps the old experience intact until the replacement is ready.
// Experience code is trusted application code. This is lifecycle isolation, not a security sandbox.
export class ExperienceManager {
  active = null;
  queue = Promise.resolve();
  serial = 0;
  constructor(registry, services) {
    this.registry = registry;
    this.services = services;
  }
  replace(id, options) {
    const run = () => this.perform(id, options);
    const promise = this.queue.then(run, run);
    this.queue = promise.catch(() => {});
    return promise;
  }
  async perform(id, { mode = 'play', handoff, document = null, local = null } = {}) {
    const entry = this.registry.get(id),
      state = validateHandoff(handoff);
    accepts(entry.manifest, state);
    const scope = new Scope();
    const scene = this.services.renderer.createScene();
    scope.own(() => scene.dispose());
    const record = { manifest: entry.manifest, scope, scene, instance: null, mode, serial: ++this.serial };
    try {
      const module = await entry.load();
      if (typeof module.create !== 'function') throw Error('The cartridge has no create() factory.');
      record.instance = module.create();
      for (const name of ['mount', 'fixedUpdate', 'update', 'exportState', 'dispose'])
        if (typeof record.instance[name] !== 'function') throw Error(`The cartridge needs ${name}().`);
      const ctx = {
        ...this.services,
        scope,
        scene,
        mode,
        document: document ? structuredClone(document) : null,
        local: local ? structuredClone(local) : null,
        manifest: entry.manifest,
        requestExit: (exit) => {
          if (this.active === record) this.services.requestExit(exit, record.serial);
        },
        notify: (text) => this.services.notify(String(text)),
      };
      await record.instance.mount(ctx, state);
      const previous = this.active;
      this.active = record;
      if (previous) await this.release(previous);
      return record;
    } catch (error) {
      await this.release(record);
      throw error;
    }
  }
  async release(record) {
    try {
      await record.instance?.dispose();
    } catch (error) {
      console.error('Cartridge disposal failed:', error);
    } finally {
      record.scope.dispose();
    }
  }
  async dispose() {
    await this.queue;
    if (this.active) {
      const old = this.active;
      this.active = null;
      await this.release(old);
    }
  }
}
