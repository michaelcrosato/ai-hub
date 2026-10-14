// Vesper Lane routes. Distances are metres along each stage's own rail.
// Stage 1 keeps the Glass Trench layout. A killed signal buoy picks Cinder Run;
// missing it picks Pale Orbit. Each route is three stages and ends on its own boss.

const TUNING = {
  cruise: 18,
  boostMul: 1.8,
  brakeMul: 0.38,
  accel: 36,
  laneX: 5.2,
  laneY: 3.3,
  steer: 11,
  maxShields: 6,
  startBombs: 3,
  maxBombs: 5,
  bombRadius: 4,
  shotCooldown: 0.14,
  shotSpeed: 92,
  twinGap: 0.32,
  enemyShotSpeed: 34,
  rollTime: 0.5,
  rollCooldown: 0.35,
  meterDrain: 0.42,
  meterRegen: 0.28,
  spawnAhead: 72,
  dropBehind: 14,
  bossLead: 24,
};

function stage(extra) {
  return { ...TUNING, ...extra };
}

export const STAGES = {
  'glass-trench': stage({
    id: 'glass-trench',
    name: 'Glass Trench',
    look: 'glass',
    next: (sim) => (sim.branchBeacon ? 'cinder-run' : 'pale-orbit'),
    events: [
      { kind: 'bomb', at: 16, x: 0, y: 0, id: 'burst-a' },
      { kind: 'bomb', at: 24, x: 0, y: 0.55, id: 'burst-b' },
      { kind: 'bomb', at: 32, x: 0, y: -0.4, id: 'burst-c' },
      { kind: 'upgrade', at: 52, x: 0, y: 0.25, id: 'twin-lens' },
      { kind: 'enemy', at: 72, x: 0.45, y: 0, id: 'cluster-a', hp: 3, designated: false, points: 0, shotEvery: 0 },
      { kind: 'enemy', at: 73, x: 4.9, y: 0, id: 'cluster-far', hp: 3, designated: false, points: 0, shotEvery: 0 },
      { kind: 'enemy', at: 74, x: -0.65, y: 0.25, id: 'cluster-b', hp: 3, designated: false, points: 0, shotEvery: 0 },
      { kind: 'solid', at: 84, x: -4.55, y: 0, w: 2.3, h: 3.2, id: 'wall-left', damage: 6 },
      { kind: 'enemy', at: 102, x: 0, y: 0, id: 'fodder-1', hp: 1, designated: false, points: 0, shotEvery: 0 },
      { kind: 'solid', at: 118, x: 4.4, y: 0, w: 2.3, h: 2.2, id: 'roll-rib', damage: 2 },
      { kind: 'enemy', at: 128, x: 0, y: 2.55, id: 'signal-buoy', hp: 1, designated: false, points: 0, shotEvery: 0, branch: true },
      { kind: 'enemy', at: 150, x: 0, y: 0.35, id: 'mark-1', hp: 1, designated: true, points: 100, shotEvery: 0.95 },
      { kind: 'solid', at: 192, x: 0, y: 0, w: 1.8, h: 2.2, id: 'rib-a', damage: 2 },
      { kind: 'solid', at: 218, x: 0, y: 0, w: 1.8, h: 2.2, id: 'rib-b', damage: 2 },
      { kind: 'solid', at: 244, x: 0, y: 0, w: 1.8, h: 2.2, id: 'rib-c', damage: 2 },
      { kind: 'enemy', at: 236, x: -3.05, y: 0.2, id: 'fodder-2', hp: 1, designated: false, points: 0, shotEvery: 1.15 },
      { kind: 'ally', at: 270, x: 1.1, y: 1.35, id: 'quill', threat: 'pin-hawk' },
      { kind: 'enemy', at: 270, x: 0, y: 0.7, id: 'pin-hawk', hp: 2, designated: true, points: 300, shotEvery: 0.9, allyThreat: true },
      { kind: 'enemy', at: 318, x: 1.15, y: 1.25, id: 'straggler', hp: 1, designated: false, points: 0, shotEvery: 0, escortMark: true },
      { kind: 'checkpoint', at: 340, id: 'waygate' },
      { kind: 'solid', at: 392, x: 4.55, y: 0, w: 2.6, h: 2.8, id: 'anvil-1', damage: 3 },
      { kind: 'solid', at: 424, x: 4.55, y: 0, w: 2.6, h: 2.8, id: 'anvil-2', damage: 3 },
      { kind: 'lance', at: 470, x: 0, y: 0, id: 'lance-prism' },
      { kind: 'enemy', at: 488, x: 0, y: -0.45, id: 'mark-2', hp: 2, designated: true, points: 200, shotEvery: 1 },
      { kind: 'enemy', at: 528, x: 2.35, y: 1.05, id: 'fodder-3', hp: 1, designated: false, points: 0, shotEvery: 1.1 },
      { kind: 'enemy', at: 566, x: -2.55, y: -0.7, id: 'fodder-4', hp: 1, designated: false, points: 0, shotEvery: 1.1 },
      { kind: 'solid', at: 624, x: -2.15, y: 0, w: 2, h: 2, id: 'rib-d', damage: 2 },
      { kind: 'solid', at: 668, x: 1.45, y: 1.1, w: 1.8, h: 1.7, id: 'rib-e', damage: 2 },
      { kind: 'enemy', at: 736, x: 0, y: 0.15, id: 'mark-3', hp: 3, designated: true, points: 200, shotEvery: 0.85 },
      { kind: 'boss', at: 860, id: 'hull-warden', name: 'Hull Warden', hp: 18, points: 1000, lead: 24, designated: true, pattern: 'ahead' },
    ],
  }),
  'cinder-run': stage({
    id: 'cinder-run',
    name: 'Cinder Run',
    look: 'cinder',
    next: 'kiln-heart',
    events: [
      { kind: 'flare', at: 24, x: 4.2, y: 0, w: 2.4, h: 2.6, id: 'heat-column', damage: 2 },
      { kind: 'mend', at: 46, x: 0, y: 0, id: 'mend-ring', amount: 3 },
      { kind: 'enemy', at: 48, x: 4.2, y: 0, id: 'cinder-dart', hp: 2, designated: false, points: 0, shotEvery: 0.45 },
      { kind: 'enemy', at: 110, x: -2.4, y: 0.4, id: 'cinder-mark', hp: 1, designated: true, points: 150, shotEvery: 0 },
      { kind: 'checkpoint', at: 140, id: 'cinder-gate' },
      { kind: 'solid', at: 188, x: 0, y: 0, w: 2.8, h: 3, id: 'cinder-stop', damage: 6 },
      { kind: 'boss', at: 250, id: 'cinder-maw', name: 'Cinder Maw', hp: 6, points: 800, lead: 22, designated: true, pattern: 'core', coreX: 0, coreY: 0, coreR: 0.85 },
    ],
  }),
  'pale-orbit': stage({
    id: 'pale-orbit',
    name: 'Pale Orbit',
    look: 'orbit',
    next: 'veil-yard',
    events: [
      { kind: 'enemy', at: 40, x: 2.2, y: 0.2, id: 'orbit-skiff', hp: 1, designated: true, points: 120, shotEvery: 1.1 },
      { kind: 'enemy', at: 96, x: -2.8, y: -0.4, id: 'orbit-dust', hp: 1, designated: false, points: 0, shotEvery: 0 },
      { kind: 'checkpoint', at: 130, id: 'orbit-ring' },
      { kind: 'solid', at: 176, x: -3.6, y: 0, w: 2.2, h: 2.4, id: 'orbit-rib', damage: 2 },
      { kind: 'boss', at: 240, id: 'pale-lantern', name: 'Pale Lantern', hp: 8, points: 800, lead: 22, designated: true, pattern: 'sequence' },
    ],
  }),
  'kiln-heart': stage({
    id: 'kiln-heart',
    name: 'Kiln Heart',
    look: 'kiln',
    next: null,
    events: [
      { kind: 'enemy', at: 36, x: 0, y: 1.1, id: 'kiln-spark', hp: 1, designated: true, points: 100, shotEvery: 0 },
      { kind: 'solid', at: 78, x: 2.6, y: 0, w: 2, h: 2, id: 'kiln-rib', damage: 2 },
      { kind: 'checkpoint', at: 110, id: 'kiln-gate' },
      { kind: 'boss', at: 190, id: 'kiln-crown', name: 'Kiln Crown', hp: 6, points: 1200, lead: 20, designated: true, pattern: 'window', openFor: 0.7, closedFor: 1.05 },
    ],
  }),
  'veil-yard': stage({
    id: 'veil-yard',
    name: 'Veil Yard',
    look: 'veil',
    next: null,
    events: [
      { kind: 'enemy', at: 34, x: -1.6, y: 0, id: 'veil-mote', hp: 1, designated: false, points: 0, shotEvery: 0.8 },
      { kind: 'solid', at: 72, x: 0, y: -1.2, w: 2.2, h: 1.6, id: 'veil-rib', damage: 2 },
      { kind: 'checkpoint', at: 108, id: 'veil-gate' },
      { kind: 'boss', at: 188, id: 'veil-needle', name: 'Veil Needle', hp: 6, points: 1200, lead: 20, designated: true, pattern: 'tip', tipY: 1.65 },
    ],
  }),
};

export const LEVEL = STAGES['glass-trench'];

export function eventById(id, stage = LEVEL) {
  return stage.events.find((e) => e.id === id) ?? null;
}
