// Balance numbers. Plain data so the checks in test/ can import it under Node.

export const BALANCE = Object.freeze({
  xpThresholds: [0, 120, 280],
  weapons: [
    { name: 'R-1', rate: 4.8, damage: 1.0, shots: 1, spread: 0 },
    { name: 'R-2', rate: 6.2, damage: 1.15, shots: 1, spread: 0 },
    { name: 'R-3', rate: 7.2, damage: 1.2, shots: 3, spread: 0.12 }
  ],
  // Timed S-FAN pickup: five-way spread at the current weapon's rate.
  spread: { name: 'S-FAN', shots: 5, spread: 0.12, damageScale: 0.8, duration: 14 },
  enemy: {
    grunt: { hp: 2, xp: 22, score: 120, cadence: 1.55, bulletSpeed: 7.2 },
    turret: { hp: 5, xp: 42, score: 260, cadence: 1.15, bulletSpeed: 8.1 },
    drone: { hp: 3, xp: 35, score: 210, cadence: 1.35, bulletSpeed: 7.6 },
    boss: { hp: 30, xp: 260, score: 2200, cadence: 0.85, bulletSpeed: 9.0 },
    // Operation 02 additions.
    mortar: { hp: 4, xp: 38, score: 240, cadence: 2.7, flight: 1.15, blast: 1.7 },
    sniper: { hp: 2, xp: 30, score: 220, cadence: 2.6, aim: 0.95, bulletSpeed: 16.5 },
    walker: { hp: 46, xp: 300, score: 3200, cadence: 1.05, bulletSpeed: 9.2, flight: 1.2, blast: 1.8 }
  },
  player: { maxHealth: 5, speed: 6.3, jump: 8.7, gravity: 23, grenades: 3 },
  grenade: { damage: 8, radius: 4.5, cooldown: 0.55 }
});

// Difficulty scales the enemy side and the player's vitals; Ranger is the original tuning.
export const DIFFICULTY = Object.freeze({
  recruit: { id: 'recruit', label: 'RECRUIT', note: '7 vitals · slower enemy fire', maxHealth: 7, cadence: 1.3, bulletSpeed: 0.85, bossHp: 0.85, score: 0.8 },
  ranger: { id: 'ranger', label: 'RANGER', note: '5 vitals · the intended mission', maxHealth: 5, cadence: 1, bulletSpeed: 1, bossHp: 1, score: 1 },
  veteran: { id: 'veteran', label: 'VETERAN', note: '4 vitals · faster fire · x1.5 score', maxHealth: 4, cadence: 0.8, bulletSpeed: 1.12, bossHp: 1.2, score: 1.5 }
});

export function levelForXp(xp) {
  return xp >= BALANCE.xpThresholds[2] ? 3 : xp >= BALANCE.xpThresholds[1] ? 2 : 1;
}
