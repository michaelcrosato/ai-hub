/** The episode settings (formerly #strata-config). Movement and weapon values are the original balance. */
export const CONFIG = Object.freeze({
  title: 'Cyberdyne / Continued',
  objective: 'Disable the opening police line. Continue through response waves. Tab: T-800 vision.',
  saveId: 't2-cyberdyne-v2',
  seed: 1991,
  maxHealth: 100,
  environment: { sky: '#071421', fog: 0.006, sun: 0.55, exposure: 1.05 },
  player: {
    walkSpeed: 3.8, sprintSpeed: 5.8, crouchSpeed: 2.2, acceleration: 30, airAcceleration: 10, friction: 28,
    jumpSpeed: 5, gravity: 24, coyoteTime: 0.11, jumpBuffer: 0.14, stepHeight: 0.32, maxSlope: 46,
    fov: 76, sensitivity: 0.002, headBob: 0.15,
  },
  weapon: { capacity: 600, reserve: 3600, interval: 1 / 30, reloadTime: 3.2, damage: 9, range: 170, automatic: true },
});
