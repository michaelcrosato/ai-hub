import { LEVEL, BALANCE, DIFFICULTY } from '../src/level.js';

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
const pickups = Object.fromEntries(LEVEL.pickups.map(p => [p.id, p]));

/** The intended route; `sideQuest` adds the secret pump room and Dex's rescue after the Tide Seal. */
function simulate({ sideQuest = false, difficulty = 'normal' } = {}) {
  const diff = DIFFICULTY[difficulty];
  const run = { xp: 0, level: 1, scrap: 0, seals: 0, slingUpgrade: 0, jacket: false, shots: 0, crew: 1, route: [] };
  const log = (step) => run.route.push(step);
  const gainXp = (n) => { run.xp += n; run.level = levelForXp(run.xp); };
  const kill = (id) => {
    const e = enemies[id];
    const hits = hitsFor(e.hp * diff.enemyHp, run.level, run.slingUpgrade);
    run.shots += hits;
    gainXp(e.xp);
    log(`KO ${id}: ${hits} shots, level ${run.level}`);
  };
  const seal = (name) => { run.seals++; gainXp(BALANCE.sealXp); log(`${name} Seal: ${run.seals}/3, level ${run.level}`); };
  const crate = (id) => { run.scrap += props[id].scrap; log(`${id}: scrap ${run.scrap}`); };

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

  if (sideQuest) {
    run.shots += LEVEL.walls.find(w => w.id === LEVEL.crackedId).hp;
    gainXp(BALANCE.crackedWallXp);
    log(`Break the cracked wall: level ${run.level}`);
    kill('crab-3');
    kill('bat-5');
    kill('spitter-1');
    kill('spitter-2');
    crate('crate-pump-1');
    run.scrap += pickups['scrap-b'].amount;
    gainXp(BALANCE.drainXp);
    log(`Turn three valves, pump room drains: level ${run.level}`);
    gainXp(BALANCE.dexXp);
    run.crew = 2;
    log(`Free Dex (Triple-Stone Pouch): level ${run.level}`);
  }

  kill('scout-2');
  kill('bat-4');
  kill('scout-3');
  crate('crate-lookout-1');
  run.scrap += pickups['scrap-a'].amount; // fixed scrap pickup on the lookout route
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

  run.finalDamage = damageAt(run.level, run.slingUpgrade);
  run.finalHp = BALANCE.player.maxHp + (run.level - 1) * BALANCE.levelHpBonus + (run.jacket ? 2 : 0) + diff.hpBonus;
  run.paidChoices = run.slingUpgrade + (run.jacket ? 1 : 0);
  run.bruteHits = hitsFor(enemies['vault-brute'].hp * diff.enemyHp, run.level, run.slingUpgrade);
  return run;
}

function report(name, run) {
  console.log(`--- ${name} ---`);
  for (const step of run.route) console.log(step);
  console.log(`Level ${run.level} · XP ${run.xp} · seals ${run.seals}/3 · crew ${run.crew}/2 · upgrades ${run.paidChoices}`);
  console.log(`Final shot damage ${run.finalDamage.toFixed(2)} · max health ${run.finalHp} · brute ${run.bruteHits} shots · combat shots ${run.shots} · scrap left ${run.scrap}\n`);
}

const main = simulate();
const full = simulate({ sideQuest: true });
const tough = simulate({ sideQuest: true, difficulty: 'tough' });
report('Main route (Normal)', main);
report('Main route + secret pump room (Normal)', full);
report('Main route + secret pump room (Tough)', tough);

const assertions = [
  [main.seals === 3, 'all seals completed'],
  [main.level >= 3, 'normal exploration reaches at least level 3'],
  [main.paidChoices >= 2, 'guaranteed exploration supports two upgrades'],
  [main.bruteHits <= 4, 'upgraded final brute is four shots or fewer'],
  [main.finalHp >= 9, 'normal route yields a forgiving final health pool'],
  [main.scrap >= 0, 'upgrade route never depends on random scrap'],
  [full.crew === 2 && full.level >= main.level, 'the side quest rescues Dex and never costs progression'],
  [full.scrap >= main.scrap, 'the side quest pays its own way in scrap'],
  [tough.bruteHits <= 7, 'Tough final brute stays a fight, not a grind']
];

let failed = false;
for (const [ok, label] of assertions) {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
