export const BALANCE = Object.freeze({
  enemyXP: 18,
  bellXP: 25,
  bossXP: 70,
  level2XP: 70,
  level3XP: 170,
  baseHP: 5,
  baseDamage: 1,
  damagePerLevel: 0.18,
  bossHP: 7,
  bossContactDamage: 1,
  abilityCooldown: 0.68,
  moveSpeed: 8.2,
  jumpSpeed: 12.4,
  gravity: 32,
  hoverSeconds: 2.35
});

export function levelForXP(xp) {
  if (xp >= BALANCE.level3XP) return 3;
  if (xp >= BALANCE.level2XP) return 2;
  return 1;
}

export function damageForLevel(level) {
  return BALANCE.baseDamage * (1 + (level - 1) * BALANCE.damagePerLevel);
}
