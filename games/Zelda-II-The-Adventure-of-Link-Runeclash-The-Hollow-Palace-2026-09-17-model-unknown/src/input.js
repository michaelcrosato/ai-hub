const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export class InputManager {
  constructor({ canvas, joystick, stick, buttons, onZoom }) {
    this.canvas = canvas;
    this.joystick = joystick;
    this.stick = stick;
    this.buttons = buttons;
    this.onZoom = onZoom;

    this.keys = new Set();
    this.touchMoveX = 0;
    this.transient = { jumpPressed: false, attackPressed: false, magicPressed: false, interactPressed: false };
    this.guardTouch = false;
    this.joyPointer = null;
    this.joyCenter = { x: 0, y: 0 };
    this.canvasPointers = new Map();
    this.lastPinchDistance = 0;

    this._bindKeyboard();
    this._bindJoystick();
    this._bindButtons();
    this._bindPinch();
  }

  _bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      const code = e.code;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(code)) e.preventDefault();
      if (!this.keys.has(code)) {
        if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW') this.transient.jumpPressed = true;
        if (code === 'KeyJ' || code === 'KeyX') this.transient.attackPressed = true;
        if (code === 'KeyQ' || code === 'KeyC') this.transient.magicPressed = true;
        if (code === 'KeyE' || code === 'Enter') this.transient.interactPressed = true;
      }
      this.keys.add(code);
    }, { passive: false });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.onZoom?.(e.deltaY * 0.008);
    }, { passive: false });
  }

  _bindJoystick() {
    const zone = this.joystick;
    const handle = this.stick;
    const update = (e) => {
      const dx = e.clientX - this.joyCenter.x;
      const dy = e.clientY - this.joyCenter.y;
      const radius = Math.max(32, zone.getBoundingClientRect().width * 0.34);
      const len = Math.hypot(dx, dy) || 1;
      const scale = Math.min(1, radius / len);
      const sx = dx * scale;
      const sy = dy * scale;
      handle.style.transform = `translate(${sx}px, ${sy}px)`;
      this.touchMoveX = clamp(sx / radius, -1, 1);
    };
    zone.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.joyPointer !== null) return;
      this.joyPointer = e.pointerId;
      zone.setPointerCapture(e.pointerId);
      const r = zone.getBoundingClientRect();
      this.joyCenter.x = r.left + r.width / 2;
      this.joyCenter.y = r.top + r.height / 2;
      update(e);
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.joyPointer) update(e);
    });
    const end = (e) => {
      if (e.pointerId !== this.joyPointer) return;
      this.joyPointer = null;
      this.touchMoveX = 0;
      handle.style.transform = 'translate(0px, 0px)';
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
  }

  _bindButtons() {
    const map = {
      jump: 'jumpPressed',
      attack: 'attackPressed',
      magic: 'magicPressed',
      interact: 'interactPressed'
    };
    for (const [name, el] of Object.entries(this.buttons)) {
      if (!el) continue;
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.setPointerCapture?.(e.pointerId);
        el.classList.add('is-pressed');
        if (name === 'guard') this.guardTouch = true;
        else if (map[name]) this.transient[map[name]] = true;
      });
      const end = (e) => {
        e.preventDefault();
        el.classList.remove('is-pressed');
        if (name === 'guard') this.guardTouch = false;
      };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
      el.addEventListener('lostpointercapture', () => {
        el.classList.remove('is-pressed');
        if (name === 'guard') this.guardTouch = false;
      });
    }
  }

  _bindPinch() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      this.canvasPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.canvasPointers.size === 2) this.lastPinchDistance = this._pinchDistance();
    });
    c.addEventListener('pointermove', (e) => {
      if (!this.canvasPointers.has(e.pointerId)) return;
      this.canvasPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.canvasPointers.size === 2) {
        const d = this._pinchDistance();
        if (this.lastPinchDistance > 0) this.onZoom?.((this.lastPinchDistance - d) * 0.018);
        this.lastPinchDistance = d;
      }
    });
    const end = (e) => {
      this.canvasPointers.delete(e.pointerId);
      if (this.canvasPointers.size < 2) this.lastPinchDistance = 0;
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
  }

  _pinchDistance() {
    const pts = [...this.canvasPointers.values()];
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }

  snapshot() {
    const keyLeft = this.keys.has('KeyA') || this.keys.has('ArrowLeft');
    const keyRight = this.keys.has('KeyD') || this.keys.has('ArrowRight');
    const keyboardMove = (keyRight ? 1 : 0) - (keyLeft ? 1 : 0);
    return {
      moveX: Math.abs(this.touchMoveX) > 0.05 ? this.touchMoveX : keyboardMove,
      guardHeld: this.guardTouch || this.keys.has('KeyK') || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
      ...this.transient
    };
  }

  consumeTransient() {
    this.transient.jumpPressed = false;
    this.transient.attackPressed = false;
    this.transient.magicPressed = false;
    this.transient.interactPressed = false;
  }

  clear() {
    this.keys.clear();
    this.touchMoveX = 0;
    this.guardTouch = false;
    this.consumeTransient();
    this.stick.style.transform = 'translate(0px, 0px)';
  }
}
