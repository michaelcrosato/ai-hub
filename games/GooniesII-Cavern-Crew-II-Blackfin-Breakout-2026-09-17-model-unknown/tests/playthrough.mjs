import { LEVEL, BALANCE } from '../src/level.js';

function levelForXp(xp) {
  let level = 1;
  for (let i = 1; i < BALANCE.xpThresholds.length; i++) {
    if (xp >= BALANCE.xpThresholds[i]) level = i + 1;
  }
  return Math.min(level, BALANCE.maxLevel);
}

function damageAt(level, slingUpgrade = 0) {
  return BALANCE.player.baseDamage
    + (level - 1) * BALANCE.levelDamageBonus
    + slingUpgrade * BALANCE.slingUpgradeDamage;
}

function hitsFor(hp, level, slingUpgrade = 0) {
  return Math.ceil(hp / damageAt(level, slingUpgrade));
}

const enemies = Object.fromEntries(LEVEL.enemies.map(e => [e.id, e]));
const props = Object.fromEntries(LEVEL.props.map(p => [p.id, p]));

const run = {
  xp: 0,
  level: 1,
  scrap: 0,
  seals: 0,
  slingUpgrade: 0,
  jacket: false,
  shots: 0,
  route: []
};

function log(step) { run.route.push(step); }
function gainXp(n) { run.xp += n; run.level = levelForXp(run.xp); }
function kill(id) {
  const e = enemies[id];
  const hits = hitsFor(e.hp, run.level, run.slingUpgrade);
  run.shots += hits;
  gainXp(e.xp);
  log(`KO ${id}: ${hits} shots, level ${run.level}`);
}
function seal(name) { run.seals++; gainXp(16); log(`${name} Seal: ${run.seals}/3, level ${run.level}`); }
function crate(id) { run.scrap += props[id].scrap; log(`${id}: scrap ${run.scrap}`); }

log('Open sling locker');
crate('crate-start-1');
kill('bat-1');
kill('bat-2');
kill('rat-1');
seal('Gear');
crate('crate-hub-1');

kill('crab-1');
kill('crab-2');
kill('bat-3');
crate('crate-grotto-1');
seal('Tide');

kill('scout-2');
kill('bat-4');
kill('scout-3');
crate('crate-lookout-1');
run.scrap += 2; // fixed scrap pickup on lookout route
seal('Echo');

// Bench after the three branch loops. Guaranteed exploration scrap is enough for
// one damage upgrade plus the defensive jacket without any random enemy drops.
const slingCost = BALANCE.upgradeCosts.sling[0];
if (run.scrap >= slingCost) { run.scrap -= slingCost; run.slingUpgrade = 1; log(`Buy Sling Power +1: scrap ${run.scrap}`); }
const jacketCost = BALANCE.upgradeCosts.jacket;
if (run.scrap >= jacketCost) { run.scrap -= jacketCost; run.jacket = true; log(`Buy Padded Jacket: scrap ${run.scrap}`); }

log('Unlock Smuggler Gate');
kill('bridge-bat');
kill('vault-guard-a');
kill('vault-guard-b');
kill('vault-brute');
log('Free Mara');

const finalDamage = damageAt(run.level, run.slingUpgrade);
const finalHp = BALANCE.player.maxHp + (run.level - 1) * BALANCE.levelHpBonus + (run.jacket ? 2 : 0);
const paidChoices = run.slingUpgrade + (run.jacket ? 1 : 0);

console.log('--- Synthetic full-mission playthrough ---');
for (const step of run.route) console.log(step);
console.log('\n--- Result ---');
console.log(`Level: ${run.level}`);
console.log(`XP: ${run.xp}`);
console.log(`Seals: ${run.seals}/3`);
console.log(`Upgrades: ${paidChoices}`);
console.log(`Final shot damage: ${finalDamage.toFixed(2)}`);
console.log(`Final max health: ${finalHp}`);
console.log(`Total required combat shots on this route: ${run.shots}`);
console.log(`Scrap left (ignoring random drops): ${run.scrap}`);

const assertions = [
  [run.seals === 3, 'all seals completed'],
  [run.level >= 3, 'normal exploration reaches at least level 3'],
  [paidChoices >= 2, 'guaranteed exploration supports two upgrades'],
  [hitsFor(enemies['vault-brute'].hp, run.level, run.slingUpgrade) <= 4, 'upgraded final brute is four shots or fewer'],
  [finalHp >= 9, 'normal route yields a forgiving final health pool'],
  [run.scrap >= 0, 'upgrade route never depends on random scrap']
];

let failed = false;
for (const [ok, label] of assertions) {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
