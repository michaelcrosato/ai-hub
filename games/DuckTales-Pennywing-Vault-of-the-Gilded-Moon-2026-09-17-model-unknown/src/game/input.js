export class InputController {
  constructor({ root, viewport, joystick, knob, jumpButton, pogoButton, useButton }) {
    this.root = root;
    this.viewport = viewport;
    this.joystick = joystick;
    this.knob = knob;
    this.jumpButton = jumpButton;
    this.pogoButton = pogoButton;
    this.useButton = useButton;
    this.keys = new Set();
    this.moveX = 0;
    this.jumpHeld = false;
    this.pogoHeld = false;
    this.jumpPressed = false;
    this.pogoPressed = false;
    this.interactPressed = false;
    this.zoomDelta = 0;
    this.joyPointer = null;
    this.joyCenter = { x: 0, y: 0 };
    this.surfacePointers = new Map();
    this.lastPinchDistance = null;
    this.abort = new AbortController();
    this.bind();
  }

  bind() {
    const { signal } = this.abort;
    const prevent = (e) => { if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code)) e.preventDefault(); };

    window.addEventListener('keydown', (e) => {
      prevent(e);
      if (e.repeat) return;
      this.keys.add(e.code);
      if (['Space','KeyZ','ArrowUp','KeyW'].includes(e.code)) { this.jumpHeld = true; this.jumpPressed = true; }
      if (['KeyX','KeyK','ShiftLeft','ShiftRight'].includes(e.code)) { this.pogoHeld = true; this.pogoPressed = true; }
      if (['KeyE','Enter'].includes(e.code)) this.interactPressed = true;
    }, { signal });

    window.addEventListener('keyup', (e) => {
      prevent(e);
      this.keys.delete(e.code);
      if (['Space','KeyZ','ArrowUp','KeyW'].includes(e.code)) this.jumpHeld = false;
      if (['KeyX','KeyK','ShiftLeft','ShiftRight'].includes(e.code)) this.pogoHeld = false;
    }, { signal });

    this.viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoomDelta += Math.sign(e.deltaY) * 0.7;
    }, { passive: false, signal });

    const updateClasses = () => {
      const coarse = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
      this.root.classList.toggle('coarse', coarse);
      this.root.classList.toggle('portrait', innerHeight > innerWidth);
    };
    updateClasses();
    window.addEventListener('resize', updateClasses, { signal });

    this.bindJoystick(signal);
    this.bindActionButton(this.jumpButton, 'jump', signal);
    this.bindActionButton(this.pogoButton, 'pogo', signal);
    this.bindActionButton(this.useButton, 'use', signal);
    this.bindPinch(signal);
  }

  bindJoystick(signal) {
    if (!this.joystick) return;
    const updateJoy = (e) => {
      const dx = e.clientX - this.joyCenter.x;
      const dy = e.clientY - this.joyCenter.y;
      const max = Math.max(34, this.joystick.clientWidth * 0.33);
      const len = Math.hypot(dx, dy) || 1;
      const scale = Math.min(1, max / len);
      const nx = dx * scale / max;
      const ny = dy * scale / max;
      this.moveX = Math.abs(nx) < 0.08 ? 0 : nx;
      this.knob.style.transform = `translate(calc(-50% + ${nx * max}px), calc(-50% + ${ny * max}px))`;
    };
    this.joystick.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      if (this.joyPointer != null) return;
      this.joyPointer = e.pointerId;
      this.joystick.setPointerCapture(e.pointerId);
      const r = this.joystick.getBoundingClientRect();
      this.joyCenter.x = r.left + r.width / 2;
      this.joyCenter.y = r.top + r.height / 2;
      updateJoy(e);
    }, { signal });
    this.joystick.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.joyPointer) return;
      e.preventDefault(); updateJoy(e);
    }, { signal });
    const end = (e) => {
      if (e.pointerId !== this.joyPointer) return;
      this.joyPointer = null;
      this.moveX = 0;
      this.knob.style.transform = 'translate(-50%, -50%)';
    };
    this.joystick.addEventListener('pointerup', end, { signal });
    this.joystick.addEventListener('pointercancel', end, { signal });
  }

  bindActionButton(el, type, signal) {
    if (!el) return;
    const down = (e) => {
      e.preventDefault(); e.stopPropagation();
      el.setPointerCapture?.(e.pointerId);
      el.classList.add('active');
      if (type === 'jump') { if (!this.jumpHeld) this.jumpPressed = true; this.jumpHeld = true; }
      if (type === 'pogo') { if (!this.pogoHeld) this.pogoPressed = true; this.pogoHeld = true; }
      if (type === 'use') this.interactPressed = true;
    };
    const up = (e) => {
      e.preventDefault(); e.stopPropagation();
      el.classList.remove('active');
      if (type === 'jump') this.jumpHeld = false;
      if (type === 'pogo') this.pogoHeld = false;
    };
    el.addEventListener('pointerdown', down, { signal });
    el.addEventListener('pointerup', up, { signal });
    el.addEventListener('pointercancel', up, { signal });
    el.addEventListener('contextmenu', (e) => e.preventDefault(), { signal });
  }

  bindPinch(signal) {
    const onDown = (e) => {
      if (e.target.closest?.('.mobile-controls, button')) return;
      this.surfacePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.surfacePointers.size === 2) this.lastPinchDistance = this.getPinchDistance();
    };
    const onMove = (e) => {
      if (!this.surfacePointers.has(e.pointerId)) return;
      this.surfacePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.surfacePointers.size === 2) {
        const d = this.getPinchDistance();
        if (this.lastPinchDistance != null) this.zoomDelta += (this.lastPinchDistance - d) * 0.018;
        this.lastPinchDistance = d;
      }
    };
    const onEnd = (e) => {
      this.surfacePointers.delete(e.pointerId);
      if (this.surfacePointers.size < 2) this.lastPinchDistance = null;
    };
    this.viewport.addEventListener('pointerdown', onDown, { signal });
    this.viewport.addEventListener('pointermove', onMove, { signal });
    this.viewport.addEventListener('pointerup', onEnd, { signal });
    this.viewport.addEventListener('pointercancel', onEnd, { signal });
  }

  getPinchDistance() {
    const [a,b] = [...this.surfacePointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  frame() {
    const keyboardX = (this.keys.has('ArrowRight') || this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('ArrowLeft') || this.keys.has('KeyA') ? 1 : 0);
    const out = {
      moveX: Math.max(-1, Math.min(1, Math.abs(this.moveX) > Math.abs(keyboardX) ? this.moveX : keyboardX)),
      jumpPressed: this.jumpPressed,
      jumpHeld: this.jumpHeld,
      pogoPressed: this.pogoPressed,
      pogoHeld: this.pogoHeld,
      interactPressed: this.interactPressed,
      zoomDelta: this.zoomDelta,
    };
    this.jumpPressed = false;
    this.pogoPressed = false;
    this.interactPressed = false;
    this.zoomDelta = 0;
    return out;
  }

  clearTransient() {
    this.jumpPressed = this.pogoPressed = this.interactPressed = false;
    this.zoomDelta = 0;
  }

  destroy() { this.abort.abort(); }
}
