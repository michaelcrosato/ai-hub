import assert from 'node:assert/strict';
import { BALANCE, DIFFICULTY, DIFFICULTY_ORDER, levelFromXp, maxHpFor, attackFor, damageAfterArmor } from './src/balance.js';

// Mandatory route: three spark carriers + Wind Core.
const mandatoryXp = BALANCE.raider.xp * 3 + BALANCE.coreXp;
assert.equal(levelFromXp(mandatoryXp), 2, 'Mandatory path should reach level 2, not require grinding.');
assert.equal(maxHpFor(2), 86);
assert.equal(attackFor(2, 2), 15);

// Optional route: modest exploration reaches level 3, but does not create a huge power gap.
const optionalXp = mandatoryXp + BALANCE.raider.xp * 2 + BALANCE.spitter.xp;
assert.equal(levelFromXp(optionalXp), 3);
assert.equal(attackFor(3, 2) - attackFor(2, 2), 2, 'Grinding bonus should be useful, not mandatory.');

// Boss should be viable without grinding and safer with optional armor.
const chargedL2 = Math.round(attackFor(2,2) * BALANCE.player.chargedMultiplier);
const chargedHits = Math.ceil(BALANCE.boss.hp / chargedL2);
assert.ok(chargedHits <= 10, `No-grind boss charged-hit count too high: ${chargedHits}`);
const l2TouchHits = Math.ceil(maxHpFor(2) / damageAfterArmor(BALANCE.boss.touchDamage, 0));
const l3ArmorTouchHits = Math.ceil(maxHpFor(3) / damageAfterArmor(BALANCE.boss.touchDamage, 1));
assert.ok(l2TouchHits >= 7, 'No-grind player should survive several mistakes.');
assert.ok(l3ArmorTouchHits > l2TouchHits, 'Optional armor must improve survivability.');

// Source-inspired but less grind-dependent: melee can still work on the boss, but stone armor favors charged wind shots.
const meleeL2Boss = Math.max(1, Math.round(attackFor(2,2) * .55));
assert.ok(Math.ceil(BALANCE.boss.hp / meleeL2Boss) > chargedHits * 2, 'Charged wind should be materially better against the boss.');

// The Hollow side path: its one-time rewards (three bells, the vault) are a boost, not a new tier.
const hollowXp = mandatoryXp + BALANCE.bellXp * 3 + BALANCE.vaultXp;
assert.ok(levelFromXp(hollowXp) <= 3, 'The Hollow alone should not push the player past level 3 before the boss.');
assert.ok(BALANCE.player.tempestSide > 0 && BALANCE.player.tempestSide < 1, 'Tempest side shots must be weaker than the main shot.');
assert.ok(BALANCE.bellWindow >= 20, 'Bells must hum long enough to run between them.');

// Difficulty scales foes in one direction only.
const [easy, normal, hard] = DIFFICULTY_ORDER.map((k) => DIFFICULTY[k]);
assert.ok(easy.damage < normal.damage && normal.damage < hard.damage, 'Damage must rise with difficulty.');
assert.ok(easy.hp < normal.hp && normal.hp < hard.hp, 'Foe life must rise with difficulty.');
assert.equal(normal.damage, 1);
assert.equal(normal.hp, 1);

console.log('progression: PASS', { mandatoryXp, optionalXp, hollowXp, chargedHits, l2TouchHits, l3ArmorTouchHits });
