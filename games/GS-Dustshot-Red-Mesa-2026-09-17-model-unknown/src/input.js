export function createInputSystem({ canvas, moveZone, aimZone, moveKnob, aimKnob, getRenderer, getPlayer }) {
  const input = { moveX: 0, moveZ: 0, aimX: 0, aimZ: -1, aimMagnitude: 0, fire: false, interactPressed: false };
  const keys = new Set();
  let movePointer = null, aimPointer = null;
  let mouseDown = false;
  let mouseX = innerWidth / 2, mouseY = innerHeight / 2;
  let hasMouseAim = false;
  const canvasTouches = new Map();
  let pinchDistance = 0, pinchZoom = 1;

  const coarse = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;

  function setStick(zone, knob, ev, type) {
    const rect = zone.getBoundingClientRect();
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    let dx = ev.clientX - cx, dy = ev.clientY - cy;
    const radius = Math.max(28, rect.width * .32);
    const m = Math.hypot(dx, dy);
    if (m > radius) { dx = dx / m * radius; dy = dy / m * radius; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const nx = dx / radius, ny = dy / radius;
    const mag = Math.min(1, Math.hypot(nx, ny));
    if (type === 'move') {
      input.moveX = nx;
      input.moveZ = ny;
    } else {
      input.aimX = nx;
      input.aimZ = ny;
      input.aimMagnitude = mag;
      input.fire = mag > .16;
    }
  }

  function resetStick(knob, type) {
    knob.style.transform = 'translate(0,0)';
    if (type === 'move') { input.moveX = 0; input.moveZ = 0; }
    else { input.aimMagnitude = 0; input.fire = false; }
  }

  function bindStick(zone, knob, type) {
    zone.addEventListener('pointerdown', ev => {
      if (ev.pointerType === 'mouse' && !coarse) return;
      ev.preventDefault(); ev.stopPropagation();
      zone.setPointerCapture(ev.pointerId);
      if (type === 'move') movePointer = ev.pointerId; else aimPointer = ev.pointerId;
      setStick(zone, knob, ev, type);
    });
    zone.addEventListener('pointermove', ev => {
      const id = type === 'move' ? movePointer : aimPointer;
      if (ev.pointerId !== id) return;
      ev.preventDefault(); ev.stopPropagation(); setStick(zone, knob, ev, type);
    });
    const end = ev => {
      const id = type === 'move' ? movePointer : aimPointer;
      if (ev.pointerId !== id) return;
      ev.preventDefault(); ev.stopPropagation();
      if (type === 'move') movePointer = null; else aimPointer = null;
      resetStick(knob, type);
    };
    zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
  }
  bindStick(moveZone, moveKnob, 'move');
  bindStick(aimZone, aimKnob, 'aim');

  addEventListener('keydown', ev => {
    keys.add(ev.code);
    if (ev.code === 'KeyE') input.interactPressed = true;
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(ev.code)) ev.preventDefault();
  });
  addEventListener('keyup', ev => keys.delete(ev.code));

  canvas.addEventListener('pointermove', ev => {
    if (ev.pointerType === 'mouse') { mouseX = ev.clientX; mouseY = ev.clientY; hasMouseAim = true; }
    if (canvasTouches.has(ev.pointerId)) {
      canvasTouches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (canvasTouches.size >= 2) updatePinch();
    }
  });
  canvas.addEventListener('pointerdown', ev => {
    if (ev.pointerType === 'mouse') { mouseDown = ev.button === 0; mouseX = ev.clientX; mouseY = ev.clientY; hasMouseAim = true; }
    else {
      canvasTouches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (canvasTouches.size === 2) {
        const pts = [...canvasTouches.values()];
        pinchDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        pinchZoom = getRenderer()?.getZoom?.() || 1;
      }
    }
  });
  canvas.addEventListener('pointerup', ev => { if (ev.pointerType === 'mouse') mouseDown = false; canvasTouches.delete(ev.pointerId); pinchDistance = 0; });
  canvas.addEventListener('pointercancel', ev => { canvasTouches.delete(ev.pointerId); pinchDistance = 0; });
  canvas.addEventListener('wheel', ev => {
    ev.preventDefault();
    const r = getRenderer(); if (!r?.setZoom) return;
    r.setZoom((r.getZoom?.() || 1) * Math.exp(-ev.deltaY * .001));
  }, { passive: false });
  canvas.addEventListener('contextmenu', ev => ev.preventDefault());

  function updatePinch() {
    if (!pinchDistance || canvasTouches.size < 2) return;
    const pts = [...canvasTouches.values()];
    const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    getRenderer()?.setZoom?.(pinchZoom * (d / pinchDistance));
  }

  function update() {
    let kx = 0, kz = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) kx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) kx += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) kz -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) kz += 1;
    if (kx || kz) { const m = Math.hypot(kx, kz); input.moveX = kx / m; input.moveZ = kz / m; }
    else if (movePointer === null) { input.moveX = 0; input.moveZ = 0; }

    if (!coarse && hasMouseAim) {
      const r = getRenderer(); const p = getPlayer();
      const hit = r?.screenToGround?.(mouseX, mouseY);
      if (hit && p) {
        const dx = hit.x - p.x, dz = hit.z - p.z, m = Math.hypot(dx, dz) || 1;
        input.aimX = dx / m; input.aimZ = dz / m; input.aimMagnitude = 1;
      }
      input.fire = mouseDown || keys.has('Space');
    } else if (!coarse && keys.has('Space')) input.fire = true;
    return input;
  }

  function consumeInteract() { const v = input.interactPressed; input.interactPressed = false; return v; }
  function reset() { keys.clear(); movePointer = null; aimPointer = null; mouseDown = false; resetStick(moveKnob, 'move'); resetStick(aimKnob, 'aim'); }
  return { input, update, consumeInteract, reset, coarse };
}
