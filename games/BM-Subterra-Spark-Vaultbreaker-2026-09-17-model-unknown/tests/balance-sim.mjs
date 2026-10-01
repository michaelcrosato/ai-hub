// Balance check for Subterra Spark: Vaultbreaker. Run: node tests/balance-sim.mjs
// Reads the real area layouts and tables from src/areas.js (enemies, waves, pickups,
// loadouts, upgrades), replays the XP/salvage economy and checks that each area's
// mandatory route keeps the Tinker Pad and the boss within reach.
import { AREAS, ENEMY, UPGRADES, MAX_LEVEL, BASE_LOADOUT, AREA2_LOADOUT } from '../src/areas.js';

/** Run an area's build() against a recorder: only enemies, waves and pickups matter here. */
function layout(def) {
  const out = { enemies: [], waves: [], pickups: [] };
  const anything = new Proxy({}, { get: () => ({}) });
  let seed = def.seed;
  const B = new Proxy(
    {
      mat: anything,
      rand: () => ((seed = (seed * 16807) % 2147483647) / 2147483647),
      enemy: (id, x, z, type, area = 'external') => out.enemies.push({ id, type, area }),
      wave: (list) => out.waves.push(list.map(([id, , , type]) => ({ id, type, area: 'interior' }))),
      pickup: (id, x, z, type, amount) => out.pickups.push({ id, type, amount }),
    },
    { get: (t, k) => (k in t ? t[k] : () => ({})) }
  );
  def.build(B);
  return out;
}

function play(start, kills, salvage = 0) {
  const p = { ...start };
  p.scrap += salvage;
  for (const e of kills) {
    const base = ENEMY[e.type];
    if (!base) throw new Error(`unknown enemy type ${e.type}`);
    p.scrap += base.scrap;
    if (p.level >= MAX_LEVEL) continue;
    p.xp += base.xp + (e.area === 'interior' ? 2 : 0);
    while (p.xp >= p.nextXp && p.level < MAX_LEVEL) {
      p.xp -= p.nextXp;
      p.level++;
      p.nextXp = Math.round(p.nextXp * 1.55);
      p.maxHealth += 15;
      p.damageMul *= 1.1;
    }
    if (p.level >= MAX_LEVEL) p.xp = 0;
  }
  // Spend at the Tinker Pad in order while salvage allows.
  while (UPGRADES[p.weapon] && p.scrap >= UPGRADES[p.weapon].cost) p.scrap -= UPGRADES[p.weapon++].cost;
  p.damageMul = +p.damageMul.toFixed(3);
  return p;
}

const roverShot = (p) => 18 * p.damageMul * (p.weapon >= 1 ? 1.24 : 1);
const a1 = layout(AREAS[1]);
const a2 = layout(AREAS[2]);
const salvage = (L) => L.pickups.filter((x) => x.type === 'scrap').reduce((s, x) => s + x.amount, 0);
const interior = (L) => L.waves.flat();

const a1Min = play(BASE_LOADOUT, interior(a1));
const a1Full = play(BASE_LOADOUT, [...a1.enemies, ...interior(a1)], salvage(a1));
const a2Fresh = play(AREA2_LOADOUT, interior(a2));
const a2Carry = play({ ...a1Full, health: a1Full.maxHealth }, [...a2.enemies, ...interior(a2)], salvage(a2));
const report = {
  area1: {
    mandatory: { ...a1Min, moleArmoredShots: Math.ceil(360 / (roverShot(a1Min) * 0.46)) },
    combatHeavy: a1Full,
  },
  area2: {
    freshLoadoutMandatory: { ...a2Fresh, burrowerShots: Math.ceil(600 / roverShot(a2Fresh)) },
    carriedCombatHeavy: { ...a2Carry, burrowerShots: Math.ceil(600 / roverShot(a2Carry)) },
  },
};
console.log(JSON.stringify(report, null, 2));

const fail = (msg) => {
  throw new Error(msg);
};
if (a1Min.level < 2) fail('Area 01 mandatory route should reach level 2.');
if (a1Min.weapon < 1) fail('Area 01 vault clear should afford the Coil Barrel.');
if (a1Full.level < 3) fail('Area 01 exterior fights plus the vault should reach level 3.');
if (report.area1.mandatory.moleArmoredShots > 45) fail('Stock, no-grind M.O.L.E. time-to-kill is too high.');
if (a2Fresh.weapon < 1) fail('Area 02 from the standard loadout should afford at least the Coil Barrel.');
if (report.area2.freshLoadoutMandatory.burrowerShots > 32) fail('Burrower time-to-kill from the standard loadout is too high.');
if (a2Carry.level > MAX_LEVEL) fail('Level went past the cap.');
console.log('balance ok');
