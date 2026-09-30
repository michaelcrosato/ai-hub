import { makeID } from '../core/id.js';
import { History } from '../core/history.js';
import { Scope } from '../core/Scope.js';
import { cameraRay, rayBox, add, mul, sub, compose, bounds } from '../core/math3d.js';
export class Workbench {
  selected = null;
  tool = 'orbit';
  snap = true;
  histories = new Map();
  scope = new Scope();
  markers = [];
  drag = null;
  distance = 44;
  yaw = 0.73;
  pitch = 0.61;
  target = [0, 1, 0];
  constructor(host, onChange) {
    this.host = host;
    this.onChange = onChange;
    this.scope.own(
      host.events.on('loaded', () => {
        const d = host.experience?.editor?.getDocument();
        if (d && !this.histories.has(host.manifest.id)) this.histories.set(host.manifest.id, new History(d, 60));
        this.markers = [];
        if (host.status !== 'play') this.select(this.selected);
        this.home();
        this.onChange();
      }),
    );
    this.scope.own(
      host.events.on('frame', ({ dt }) => {
        if (host.status !== 'edit') return;
        this.cameraInput(dt);
        this.updateCamera();
      }),
    );
    const canvas = host.canvas;
    // Two fingers on the canvas pinch-zoom (read from the kit); they must not also orbit.
    this.pointers = new Set();
    this.scope.on(canvas, 'pointerdown', (e) => {
      this.pointers.add(e.pointerId);
      if (this.pointers.size > 1) {
        this.drag = null;
        this.multi = true;
        return;
      }
      this.down(e);
    });
    this.scope.on(window, 'pointermove', (e) => {
      if (!this.multi) this.move(e);
    });
    const release = (e) => {
      this.pointers.delete(e.pointerId);
      if (this.multi) {
        if (!this.pointers.size) this.multi = false;
        return;
      }
      void this.up(e);
    };
    this.scope.on(window, 'pointerup', release);
    this.scope.on(window, 'pointercancel', release);
    this.scope.on(window, 'keydown', (e) => {
      if (host.status !== 'edit' || /INPUT|TEXTAREA|SELECT/.test(e.target?.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
        e.preventDefault();
        void this.history(e.shiftKey ? 'redo' : 'undo');
      } else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyD') {
        e.preventDefault();
        void this.duplicate();
      } else if (e.code === 'Delete' || e.code === 'Backspace') {
        e.preventDefault();
        void this.remove();
      } else if (e.code === 'KeyF') this.focus();
      else if (e.code === 'KeyQ') this.setTool('orbit');
      else if (e.code === 'KeyW') this.setTool('move');
      else if (e.code === 'KeyE') this.setTool('rotate');
      else if (e.code === 'KeyR') this.setTool('scale');
    });
  }
  get api() {
    return this.host.experience?.editor;
  }
  get historyState() {
    return this.histories.get(this.host.manifest?.id);
  }
  setTool(t) {
    this.tool = t;
    this.onChange();
  }
  /** Wheel and pinch zoom from the kit; a gamepad orbits with the right stick and zooms with the triggers. */
  cameraInput(dt) {
    const k = this.host.kit.input;
    const zoom = k.wheel * 0.1 + k.pinch * 0.25;
    if (zoom) this.distance = Math.max(3, Math.min(160, this.distance * Math.exp(-zoom)));
    if (k.source === 'gamepad') {
      const look = k.look('look');
      this.yaw -= look.x * 1.2;
      this.pitch = Math.max(0.08, Math.min(1.5, this.pitch - look.y * 1.2));
      const t = k.value('gas');
      if (t) this.distance = Math.max(3, Math.min(160, this.distance * Math.exp(-t * dt * 1.6)));
    }
  }
  updateCamera() {
    const c = this.host.active?.scene.camera;
    if (!c) return;
    c.position = add(this.target, [
      Math.sin(this.yaw) * Math.cos(this.pitch) * this.distance,
      Math.sin(this.pitch) * this.distance,
      Math.cos(this.yaw) * Math.cos(this.pitch) * this.distance,
    ]);
    c.target = [...this.target];
    c.fov = 48;
  }
  home() {
    this.target = [0, 1, 0];
    this.distance = this.host.manifest?.kind === 'driving' ? 38 : 53;
    this.yaw = 0.68;
    this.pitch = 0.67;
    if (this.host.status === 'edit') this.updateCamera();
  }
  focus() {
    const e = this.api?.getEntity?.(this.selected);
    if (!e) {
      this.home();
      return;
    }
    this.target = add(e.position, [0, 1, 0]);
    this.distance = 10;
  }
  ray(e) {
    const rect = this.host.canvas.getBoundingClientRect();
    return {
      origin: this.host.active.scene.camera.position,
      dir: cameraRay(
        this.host.active.scene.camera,
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        1 - ((e.clientY - rect.top) / rect.height) * 2,
        rect.width / rect.height,
      ),
    };
  }
  plane(e, y = 0) {
    const { origin, dir } = this.ray(e);
    if (Math.abs(dir[1]) < 0.0001) return null;
    const t = (y - origin[1]) / dir[1];
    return t >= 0 ? add(origin, mul(dir, t)) : null;
  }
  pick(e) {
    const doc = this.api?.getDocument();
    if (!doc?.entities) return null;
    const ray = this.ray(e);
    let result = null,
      distance = Infinity;
    for (const entity of doc.entities) {
      const b = this.api.bounds(entity.id),
        d = rayBox(ray.origin, ray.dir, b.min, b.max, distance);
      if (d !== null) {
        distance = d;
        result = entity.id;
      }
    }
    return result;
  }
  down(e) {
    if (this.host.status !== 'edit' || this.host.busy || e.target !== this.host.canvas) return;
    const hit = this.pick(e);
    if (e.button === 0 && this.tool !== 'orbit' && hit) this.select(hit);
    const entity = this.api?.getEntity?.(this.selected),
      transform = e.button === 0 && this.tool !== 'orbit' && entity;
    this.drag = {
      x: e.clientX,
      y: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
      button: e.button,
      hit,
      transform,
      entity,
      start: entity ? structuredClone(entity.data) : null,
      plane: entity ? this.plane(e, entity.position[1]) : null,
      moved: false,
    };
  }
  move(e) {
    const d = this.drag;
    if (!d || this.host.status !== 'edit') return;
    const dx = e.clientX - d.x,
      dy = e.clientY - d.y;
    d.x = e.clientX;
    d.y = e.clientY;
    if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 3) d.moved = true;
    if (d.transform) {
      const root = d.entity.root;
      if (this.tool === 'move') {
        const p = this.plane(e, d.start.position[1]);
        if (p && d.plane) {
          root.position = add(d.start.position, sub(p, d.plane));
          if (this.snap) root.position = root.position.map((v) => Math.round(v * 2) / 2);
        }
      }
      if (this.tool === 'rotate') root.rotation = [0, d.start.rotation[1] + (e.clientX - d.startX) * 0.5, 0];
      if (this.tool === 'scale') {
        const factor = Math.max(0.1, 1 + (e.clientX - d.startX) * 0.01);
        root.scale = d.start.scale.map((v) => Math.max(0.05, v * factor));
      }
      this.showSelection();
    } else if (d.button === 2 || e.shiftKey) {
      const a = this.yaw,
        amount = this.distance * 0.0015;
      this.target[0] += (-dx * Math.cos(a) + dy * Math.sin(a)) * amount;
      this.target[2] += (dx * Math.sin(a) + dy * Math.cos(a)) * amount;
    } else {
      this.yaw -= dx * 0.006;
      this.pitch = Math.max(0.08, Math.min(1.5, this.pitch + dy * 0.005));
    }
  }
  async up(e) {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    if (this.host.status !== 'edit') return;
    if (d.transform && d.moved) {
      const root = d.entity.root,
        pos = [...root.position],
        rot = [...root.rotation],
        scale = [...root.scale],
        id = this.selected;
      await this.commit((doc) => {
        const entity = doc.entities.find((x) => x.id === id);
        if (entity) {
          entity.position = pos;
          entity.rotation = rot;
          entity.scale = scale;
        }
      });
    } else if (!d.moved && d.button === 0) this.select(d.hit);
  }
  select(id) {
    this.selected = this.api?.getEntity?.(id) ? id : null;
    this.showSelection();
    this.onChange();
  }
  showSelection() {
    const scene = this.host.active?.scene;
    if (!scene) return;
    for (const m of this.markers) scene.remove(m);
    this.markers = [];
    if (this.host.active?.mode !== 'edit') return;
    const entity = this.api?.getEntity?.(this.selected);
    if (!entity) return;
    const root = entity.root,
      box = bounds(compose(root.position, root.rotation, root.scale), [1.1, 2, 1.1]);
    let b = this.api.bounds(this.selected);
    if (this.drag?.transform) b = box;
    const center = b.min.map((v, i) => (v + b.max[i]) / 2),
      size = b.min.map((v, i) => Math.max(0.15, b.max[i] - v) + 0.1);
    for (let axis = 0; axis < 3; axis++)
      for (const a of [-1, 1])
        for (const c of [-1, 1]) {
          const others = [0, 1, 2].filter((i) => i !== axis),
            p = [...center],
            s = [0.025, 0.025, 0.025];
          p[others[0]] += (a * size[others[0]]) / 2;
          p[others[1]] += (c * size[others[1]]) / 2;
          s[axis] = size[axis];
          this.markers.push(scene.mesh('box', p, s, '#d4efae', [0, 0, 0], { unlit: true, castShadow: false }));
        }
  }
  async commit(edit) {
    if (this.host.status !== 'edit' || this.host.busy) return;
    const doc = this.api?.getDocument();
    if (!doc) return;
    const camera = { target: [...this.target], distance: this.distance, yaw: this.yaw, pitch: this.pitch };
    try {
      edit(doc);
      const valid = this.api.validate(doc);
      const hist = this.historyState;
      const ok = await this.host.applyDocument(valid);
      if (ok) hist?.commit(valid);
    } catch (e) {
      this.host.notify(e.message);
    }
    Object.assign(this, camera);
    this.select(this.selected);
    this.onChange();
  }
  async history(action) {
    const h = this.historyState;
    if (!h || this.host.status !== 'edit' || this.host.busy || (action === 'undo' && !h.canUndo) || (action === 'redo' && !h.canRedo)) return;
    const cursor = h.cursor,
      camera = { target: [...this.target], distance: this.distance, yaw: this.yaw, pitch: this.pitch };
    const doc = h[action]();
    if (!(await this.host.applyDocument(doc))) h.cursor = cursor;
    Object.assign(this, camera);
    this.select(this.selected);
    this.onChange();
  }
  async add(prefab) {
    const entity = this.api?.create?.(prefab, [Math.round(this.target[0] * 2) / 2, 0.16, Math.round(this.target[2] * 2) / 2]);
    if (!entity) return;
    await this.commit((d) => d.entities.push(entity));
    this.select(entity.id);
  }
  async duplicate() {
    if (!this.selected) return;
    const original = this.api.getDocument().entities.find((e) => e.id === this.selected);
    if (!original) return;
    const copy = structuredClone(original);
    copy.id = `${copy.prefab}-${makeID().slice(0, 8)}`;
    copy.name += ' copy';
    copy.position[0] += 1.5;
    await this.commit((d) => d.entities.push(copy));
    this.select(copy.id);
  }
  async remove() {
    if (!this.selected) return;
    const id = this.selected;
    await this.commit((d) => {
      d.entities = d.entities.filter((e) => e.id !== id);
    });
    this.select(null);
  }
  dispose() {
    this.scope.dispose();
  }
}
