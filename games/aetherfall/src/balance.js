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
  },
  raider: { hp: 28, damage: 8, xp: 14, speed: 3.2, attackRange: 1.25, cooldown: 1.05 },
  spitter: { hp: 22, damage: 7, xp: 16, speed: 2.5, attackRange: 6.4, cooldown: 1.85 },
  boss: { hp: 218, touchDamage: 12, gustDamage: 9, xp: 100, speed: 2.65 },
  armorReduction: 0.16,
  coreXp: 24,
});

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
