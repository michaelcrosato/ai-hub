import assert from 'node:assert/strict';
import { BALANCE, levelForXP, damageForLevel } from '../src/balance.js';

function simulate(route, { enemiesBeforeBoss = 2, useBorrowedAbility = true } = {}) {
  let xp = 0;
  let maxHP = BALANCE.baseHP;
  const gear = ['SPRING_SOLES'];

  xp += BALANCE.bellXP; // meadow bell
  xp += BALANCE.enemyXP * enemiesBeforeBoss;
  xp += BALANCE.bellXP; // either upper or lower branch bell

  if (route === 'upper') gear.push('GLOW_PIN');
  if (route === 'lower') { gear.push('BERRY_BROOCH'); maxHP += 1; }

  let level = levelForXP(xp);
  maxHP += Math.max(0, level - 1); // level-up heart rule
  const damage = damageForLevel(level) * (useBorrowedAbility ? 1 : 0.55);
  const bossActions = Math.ceil(BALANCE.bossHP / damage);

  xp += BALANCE.bossXP;
  xp += BALANCE.bellXP; // boss Dewbell
  const finishLevel = levelForXP(xp);

  return {
    route,
    preBossXP: xp - BALANCE.bossXP - BALANCE.bellXP,
    preBossLevel: level,
    bossActions,
    maxHP,
    gear,
    finishXP: xp,
    finishLevel,
    cooldown: BALANCE.abilityCooldown * (gear.includes('GLOW_PIN') ? 0.86 : 1)
  };
}

const upper = simulate('upper');
const lower = simulate('lower');
const minimal = simulate('lower', { enemiesBeforeBoss: 0, useBorrowedAbility: false });

assert.equal(upper.preBossLevel, 2, 'upper normal route should reach level 2');
assert.equal(lower.preBossLevel, 2, 'lower normal route should reach level 2');
assert.equal(upper.bossActions, 6, 'normal upper route boss target should be six actions');
assert.equal(lower.bossActions, 6, 'normal lower route boss target should be six actions');
assert.ok(upper.cooldown < BALANCE.abilityCooldown, 'upper gear should improve ability cadence');
assert.equal(lower.maxHP, BALANCE.baseHP + 2, 'lower gear plus level-up should provide two extra hearts');
assert.equal(upper.finishLevel, 3, 'normal route should reach level 3 by completion');
assert.ok(minimal.bossActions <= 14, 'zero-grind, zero-borrowed-ability route must remain feasible');
assert.equal(minimal.preBossLevel, 1, 'minimal route should not require a level-up before boss');

console.log(JSON.stringify({ upper, lower, minimal, status: 'route simulations passed' }, null, 2));
