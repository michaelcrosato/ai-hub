/* These values are arcade game rules. They are not real weapon or vehicle data. */
export const VEHICLES = Object.freeze({
  cruiser: {
    name: 'Patrol car',
    hp: 100,
    size: [2.5, 2.05, 5.3],
    weak: [0, 1.16, -1.55],
    radius: 0.72,
    crew: ['patrol', 'patrol'],
    speed: 11,
    points: 100,
  },
  suv: { name: 'Police SUV', hp: 160, size: [2.65, 2.65, 5.5], weak: [0, 1.52, -1.7], radius: 0.7, crew: ['swat', 'patrol'], speed: 13, points: 180 },
  van: {
    name: 'SWAT van',
    hp: 220,
    size: [2.9, 3.1, 6.2],
    weak: [0, 1.45, -2.1],
    radius: 0.65,
    crew: ['swat', 'swat', 'shield'],
    speed: 9,
    points: 260,
  },
  armored: {
    name: 'Armored truck',
    hp: 330,
    size: [3.1, 3.35, 6.6],
    weak: [0, 1.8, -2.3],
    radius: 0.6,
    crew: ['shield', 'swat', 'marksman'],
    speed: 8,
    points: 400,
  },
  motorcycle: {
    name: 'Police motorcycle',
    hp: 70,
    size: [1.2, 1.75, 2.5],
    weak: [0, 0.74, -0.15],
    radius: 0.5,
    crew: ['patrol'],
    speed: 16,
    points: 140,
    weave: 2.2,
  },
  helicopter: {
    name: 'Police helicopter',
    hp: 240,
    size: [3.5, 2.6, 7.6],
    weak: [0, 0.8, 0.65],
    radius: 0.9,
    crew: [],
    speed: 9,
    points: 500,
    air: true,
  },
});
export const OFFICERS = Object.freeze({
  patrol: { name: 'Patrol officer', interval: 4.5, damage: 1.6, accuracy: 0.19, resistance: 0.45, advance: 0, charge: 0.45 },
  swat: { name: 'SWAT officer', interval: 3.2, damage: 2.5, accuracy: 0.3, resistance: 0.9, advance: 1.15, charge: 0.6 },
  shield: { name: 'Shield officer', interval: 4.1, damage: 2.0, accuracy: 0.24, resistance: 1.5, advance: 0.72, charge: 0.8 },
  marksman: { name: 'Marksman', interval: 5.5, damage: 7.0, accuracy: 0.82, resistance: 0.7, advance: 0, charge: 1.5 },
});
/** Police pressure (Settings): how hard and how often officers return fire. Each level keeps its own best score. */
export const PRESSURE = Object.freeze({
  relaxed: { label: 'Relaxed', damage: 0.6, rate: 0.8 },
  standard: { label: 'Standard', damage: 1, rate: 1 },
  relentless: { label: 'Relentless', damage: 1.35, rate: 1.2 },
});
export function wavePlan(number) {
  if (!Number.isSafeInteger(number) || number < 1 || number > 1000000) throw Error('Invalid wave number.');
  const count = Math.min(12, 3 + number);
  const names = ['Patrol response', 'Tactical response', 'Shield teams', 'Heavy response', 'Air support'];
  const unlocks = [
    'Patrol cars approach from both sides.',
    'SWAT officers, police SUVs and fast motorcycle units enter the street.',
    'Shield teams arrive in SWAT vans.',
    'Marksmen and armored trucks join the line.',
    'Helicopters identify your position. Disable their drive modules.',
  ];
  const types = [];
  for (let i = 0; i < count; i++) {
    let type = 'cruiser';
    if (number >= 2 && i % 2 === 0) type = 'suv';
    if (number >= 3 && i % 3 === 0) type = 'van';
    if (number >= 4 && i % 4 === 0) type = 'armored';
    types.push(type);
  }
  // Motorcycle units flank the line from wave 2: fast, weaving, lightly built.
  const bikes = number >= 2 ? Math.min(4, 1 + Math.floor((number - 2) / 2)) : 0;
  for (let i = 0; i < bikes; i++) types.push('motorcycle');
  if (number >= 5) types.push('helicopter');
  if (number >= 10) types.push('helicopter');
  return {
    number,
    name: names[number - 1] || 'Combined response',
    notice: unlocks[number - 1] || 'More units. Stronger vehicles. Faster return fire.',
    types,
    healthScale: 1 + 0.075 * (number - 1),
    damageScale: 1 + 0.065 * (number - 1),
    rateScale: Math.min(2.6, 1 + 0.04 * (number - 1)),
    repair: 28,
    breakTime: Math.max(6, 10 - number * 0.2),
  };
}
