/* These values are arcade game rules. They are not real weapon or vehicle data. */
export const VEHICLES = Object.freeze({
  cruiser: { name: 'Patrol car', hp: 100, size: [2.5, 2.05, 5.3], weak: [0, 1.16, -1.55], radius: 0.72, crew: ['patrol', 'patrol'], speed: 11, points: 100 },
  suv: { name: 'Police SUV', hp: 160, size: [2.65, 2.65, 5.5], weak: [0, 1.52, -1.7], radius: 0.7, crew: ['swat', 'patrol'], speed: 13, points: 180 },
  van: { name: 'SWAT van', hp: 220, size: [2.9, 3.1, 6.2], weak: [0, 1.45, -2.1], radius: 0.65, crew: ['swat', 'swat', 'shield'], speed: 9, points: 260 },
  armored: { name: 'Armored truck', hp: 330, size: [3.1, 3.35, 6.6], weak: [0, 1.8, -2.3], radius: 0.6, crew: ['shield', 'swat', 'marksman'], speed: 8, points: 400 },
  helicopter: { name: 'Police helicopter', hp: 240, size: [3.5, 2.6, 7.6], weak: [0, 0.8, 0.65], radius: 0.9, crew: [], speed: 9, points: 500, air: true },
});
export const OFFICERS = Object.freeze({
  patrol: { name: 'Patrol officer', interval: 4.5, damage: 1.6, accuracy: 0.19, resistance: 0.45, advance: 0, charge: 0.45 },
  swat: { name: 'SWAT officer', interval: 3.2, damage: 2.5, accuracy: 0.3, resistance: 0.9, advance: 1.15, charge: 0.6 },
  shield: { name: 'Shield officer', interval: 4.1, damage: 2.0, accuracy: 0.24, resistance: 1.5, advance: 0.72, charge: 0.8 },
  marksman: { name: 'Marksman', interval: 5.5, damage: 7.0, accuracy: 0.82, resistance: 0.7, advance: 0, charge: 1.5 },
});

/**
 * Difficulty only scales the police response; 'terminator' is the original balance.
 * damage/accuracy scale return fire, hp scales vehicle toughness, repair is the
 * integrity restored between waves and score scales the points earned.
 */
export const DIFFICULTIES = Object.freeze({
  recruit: { id: 'recruit', name: 'Recruit', blurb: 'Weaker return fire, faster repairs.', damage: 0.6, accuracy: 0.8, hp: 0.85, repair: 40, score: 0.75 },
  terminator: { id: 'terminator', name: 'Terminator', blurb: 'The original balance.', damage: 1, accuracy: 1, hp: 1, repair: 28, score: 1 },
  judgment: { id: 'judgment', name: 'Judgment Day', blurb: 'Tougher vehicles, sharper marksmen, little repair.', damage: 1.35, accuracy: 1.15, hp: 1.15, repair: 20, score: 1.5 },
});
export const DIFFICULTY_ORDER = ['recruit', 'terminator', 'judgment'];

export function wavePlan(number) {
  if (!Number.isSafeInteger(number) || number < 1 || number > 1000000) throw Error('Invalid wave number.');
  const count = Math.min(12, 3 + number);
  const names = ['Patrol response', 'Tactical response', 'Shield teams', 'Heavy response', 'Air support'];
  const unlocks = ['Patrol cars approach from both sides.', 'SWAT officers and police SUVs enter the street.', 'Shield teams arrive in SWAT vans.', 'Marksmen and armored trucks join the line.', 'Helicopters sweep the balcony with searchlights. Disable their drive modules.'];
  const types = [];
  for (let i = 0; i < count; i++) {
    let type = 'cruiser';
    if (number >= 2 && i % 2 === 0) type = 'suv';
    if (number >= 3 && i % 3 === 0) type = 'van';
    if (number >= 4 && i % 4 === 0) type = 'armored';
    types.push(type);
  }
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
