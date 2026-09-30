export const BALANCE = Object.freeze({
  xpThresholds: [0, 40, 95, 180],
  maxLevel: 4,
  player: {
    baseHp: 72,
    hpPerLevel: 14,
    baseAttack: 9,
    attackPerLevel: 2,
    swordTierAttack: 4,
    speed: 7.6,
    dashSpeed: 19.5,
    dashDuration: 0.18,
    dashCooldown: 0.72,
    invulnAfterHit: 0.58,
    meleeRange: 2.65,
    meleeCooldown: 0.31,
    chargeSeconds: 0.66,
    chargedMultiplier: 1.82,
    // Tempest Ring (Hollow vault): the two side shots of a charged volley deal this share.
    tempestSide: 0.5,
  },
  raider: { hp: 28, damage: 8, xp: 14, speed: 3.2, attackRange: 1.25, cooldown: 1.05 },
  spitter: { hp: 22, damage: 7, xp: 16, speed: 2.5, attackRange: 6.4, cooldown: 1.85 },
  // Hollow Terraces: digs toward the player, surfaces to bite, and is only vulnerable above ground.
  burrower: { hp: 26, damage: 9, xp: 15, speed: 2.4, attackRange: 1.55, cooldown: 1.25 },
  boss: { hp: 218, touchDamage: 12, gustDamage: 9, xp: 100, speed: 2.65 },
  armorReduction: 0.16,
  coreXp: 24,
  bellXp: 8,
  // Seconds a rung windbell keeps humming; all three must hum at once to open the Hollow vault.
  bellWindow: 30,
  vaultXp: 30,
  healDrop: 12,
  // Field foes return this long after they fall, once the player is out of sight of their post.
  respawnSeconds: 75,
});

// Difficulty scales what the foes do, never the route: the same world, items and bosses.
export const DIFFICULTY = Object.freeze({
  easy: Object.freeze({ label: 'EASY', damage: 0.65, hp: 0.85, bell: 1.35 }),
  normal: Object.freeze({ label: 'NORMAL', damage: 1, hp: 1, bell: 1 }),
  hard: Object.freeze({ label: 'HARD', damage: 1.35, hp: 1.2, bell: 0.8 }),
});
export const DIFFICULTY_ORDER = ['easy', 'normal', 'hard'];

export function levelFromXp(xp) {
  let level = 1;
  for (let i = 1; i < BALANCE.xpThresholds.length; i++) {
    if (xp >= BALANCE.xpThresholds[i]) level = i + 1;
  }
  return Math.min(level, BALANCE.maxLevel);
}

export function maxHpFor(level) {
  return BALANCE.player.baseHp + (level - 1) * BALANCE.player.hpPerLevel;
}

export function attackFor(level, swordTier = 1) {
  return BALANCE.player.baseAttack + (level - 1) * BALANCE.player.attackPerLevel + (swordTier - 1) * BALANCE.player.swordTierAttack;
}

export function damageAfterArmor(raw, armorTier = 0) {
  const factor = armorTier > 0 ? 1 - BALANCE.armorReduction : 1;
  return Math.max(1, Math.round(raw * factor));
}
