/**
 * input.js — the kit actions Dustshot uses, and the adapter that turns them
 * into the simulation's input each frame.
 *
 *   keyboard + mouse   WASD/arrows move, the mouse aims, click / Space / J fires
 *   gamepad            left stick moves, right stick aims (and fires when pushed), RT / X fires
 *   touch              left thumb moves, right thumb aims and fires (the original twin-stick layout)
 */

export const ACTIONS = {
  move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick' },
  aim: { type: 'vector', gamepad: 'rightStick', touch: 'stick-right' },
  fire: { keys: ['Space', 'KeyJ'], mouse: [0], gamepad: ['RT', 'X'] },
  interact: { keys: ['KeyE'], gamepad: ['Y'], touch: 'Trade' },
  pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'], touch: { label: 'II', slot: 'top' } },
  confirm: { keys: ['Enter', 'NumpadEnter'], gamepad: ['A'] },
  back: { keys: ['Backspace'], gamepad: ['B'] },
  zoomIn: { keys: ['Equal', 'NumpadAdd'], gamepad: ['RB'] },
  zoomOut: { keys: ['Minus', 'NumpadSubtract'], gamepad: ['LB'] },
};

/** How far the aim stick must be pushed before it also pulls the trigger. */
const STICK_FIRE = 0.22;

export function createControls(kit, view) {
  const input = kit.input;
  const out = { moveX: 0, moveZ: 0, aimX: 0, aimZ: -1, aimMagnitude: 0, fire: false };
  let mouseAim = false;
  let lastX = input.pointer.x;
  let lastY = input.pointer.y;

  return {
    /** The simulation input for this frame (one shared object, no allocation). */
    read(player) {
      const mv = input.vector('move');
      out.moveX = mv.x;
      out.moveZ = -mv.y; // forward on the stick is north, toward -z

      const ptr = input.pointer;
      if (ptr.type !== 'touch' && (ptr.x !== lastX || ptr.y !== lastY)) mouseAim = true;
      lastX = ptr.x;
      lastY = ptr.y;

      const aim = input.vector('aim');
      const mag = Math.hypot(aim.x, aim.y);
      out.aimMagnitude = 0;
      if (mag > 0.16) {
        mouseAim = false;
        out.aimX = aim.x;
        out.aimZ = -aim.y;
        out.aimMagnitude = mag;
      } else if (mouseAim && input.source === 'keyboard') {
        const hit = view.groundPoint(ptr.nx, ptr.ny);
        if (hit) {
          const dx = hit.x - player.x;
          const dz = hit.z - player.z;
          const m = Math.hypot(dx, dz);
          if (m > 0.35) {
            out.aimX = dx / m;
            out.aimZ = dz / m;
            out.aimMagnitude = 1;
          }
        }
      }
      out.fire = input.down('fire') || mag > STICK_FIRE;
      return out;
    },
    reset() {
      out.moveX = out.moveZ = 0;
      out.aimMagnitude = 0;
      out.fire = false;
    },
  };
}
