import assert from 'node:assert/strict';
import { BALANCE, levelForXP, damageForLevel } from '../src/balance.js';

// Normal no-grind route: two required bells and two naturally placed enemies before the arena.
const normalXP = BALANCE.bellXP * 2 + BALANCE.enemyXP * 2;
assert.equal(normalXP, 86);
assert.equal(levelForXP(normalXP), 2, 'normal route should reach level 2 before boss');

// Minimal route: player can avoid every normal enemy and still reach the boss at level 1.
const minimalXP = BALANCE.bellXP * 2;
assert.equal(levelForXP(minimalXP), 1);
const level1Hits = Math.ceil(BALANCE.bossHP / damageForLevel(1));
assert.ok(level1Hits <= 7, 'boss must remain feasible without grinding');

// Level 2 improves the fight but does not trivialize it.
const level2Hits = Math.ceil(BALANCE.bossHP / damageForLevel(2));
assert.ok(level2Hits >= 6 && level2Hits <= level1Hits, 'level 2 should smooth boss difficulty');

// Berry Brooch route creates a durable option without making HP excessive.
assert.ok(BALANCE.baseHP + 2 <= 8, 'expected combined level/gear HP should remain bounded');

console.log(JSON.stringify({ normalXP, minimalXP, level1Hits, level2Hits, status: 'balance checks passed' }, null, 2));
