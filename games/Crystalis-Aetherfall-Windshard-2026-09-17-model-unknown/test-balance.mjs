import { BALANCE, levelFromXp, maxHpFor, attackFor, damageAfterArmor } from './src/balance.js';

function hitsToKill(hp, dmg){ return Math.ceil(hp/dmg); }
const requiredXp = BALANCE.raider.xp * 3 + BALANCE.coreXp;
const requiredLevel = levelFromXp(requiredXp);
const optionalXp = requiredXp + BALANCE.raider.xp * 2 + BALANCE.spitter.xp;
const optionalLevel = levelFromXp(optionalXp);
const requiredAtk = attackFor(requiredLevel,2);
const optionalAtk = attackFor(optionalLevel,2);
const chargedRequired = Math.round(requiredAtk * BALANCE.player.chargedMultiplier);
const chargedOptional = Math.round(optionalAtk * BALANCE.player.chargedMultiplier);

console.log(JSON.stringify({
  requiredPath: {xp:requiredXp, level:requiredLevel, hp:maxHpFor(requiredLevel), attack:requiredAtk, charged:chargedRequired, bossChargedHits:hitsToKill(BALANCE.boss.hp,chargedRequired), bossTouchHitsToDeath:hitsToKill(maxHpFor(requiredLevel),damageAfterArmor(BALANCE.boss.touchDamage,0))},
  optionalPath: {xp:optionalXp, level:optionalLevel, hp:maxHpFor(optionalLevel), attack:optionalAtk, charged:chargedOptional, bossChargedHits:hitsToKill(BALANCE.boss.hp,chargedOptional), bossTouchHitsToDeathWithArmor:hitsToKill(maxHpFor(optionalLevel),damageAfterArmor(BALANCE.boss.touchDamage,1))}
}, null, 2));
