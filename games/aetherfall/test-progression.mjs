import assert from 'node:assert/strict';
import { BALANCE, levelFromXp, maxHpFor, attackFor, damageAfterArmor } from './src/balance.js';

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

console.log('progression: PASS', { mandatoryXp, optionalXp, chargedHits, l2TouchHits, l3ArmorTouchHits });
