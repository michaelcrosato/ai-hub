import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Raycaster, Vector2 } from 'three/webgpu';

export class InputController {
  constructor(camera, canvas, onTap, onHover) {
    this.camera = camera; this.canvas = canvas; this.raycaster = new Raycaster(); this.pointer = new Vector2();
    this.controls = new OrbitControls(camera, canvas);
    this.controls.target.set(-0.5, 1.65, -0.4); this.controls.enableDamping = true; this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 3; this.controls.maxDistance = 75; this.controls.maxPolarAngle = Math.PI * 0.48;
    this.controls.minPolarAngle = Math.PI * 0.07; this.controls.enablePan = true;
    this.abort = new AbortController(); this.down = null; this.active = new Set();
    const opts = { signal: this.abort.signal };
    canvas.addEventListener('pointerdown', e => {
      this.active.add(e.pointerId);
      if (this.active.size === 1 && e.button === 0) this.down = { id: e.pointerId, x: e.clientX, y: e.clientY, time: performance.now(), moved: false };
      else this.down = null;
    }, opts);
    canvas.addEventListener('pointermove', e => {
      if (this.down && Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 7) this.down.moved = true;
      if (e.pointerType === 'mouse') onHover(this.rayAt(e.clientX, e.clientY));
    }, opts);
    canvas.addEventListener('pointerup', e => {
      if (this.down?.id === e.pointerId && !this.down.moved && performance.now() - this.down.time < 450)
        onTap(this.rayAt(e.clientX, e.clientY));
      this.active.delete(e.pointerId); this.down = null;
    }, opts);
    canvas.addEventListener('pointercancel', e => { this.active.delete(e.pointerId); this.down = null; }, opts);
    canvas.addEventListener('contextmenu', e => e.preventDefault(), opts);
  }
  rayAt(x, y) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1);
    this.camera.updateMatrixWorld(); this.raycaster.setFromCamera(this.pointer, this.camera); return this.raycaster;
  }
  update() { this.controls.update(); }
  dispose() { this.abort.abort(); this.controls.dispose(); }
}
