import fs from 'node:fs';
import path from 'node:path';
import {
  LEVEL,
  BALANCE,
  DIFFICULTY,
  floorHeightAt,
  circleHitsAabb
} from '../src/level.js';

let failures = 0;
const notes = [];
function check(condition, message) {
  if (!condition) {
    failures++;
    console.error(`FAIL: ${message}`);
  } else {
    console.log(`PASS: ${message}`);
  }
}

function activeWalls(gateOpen = false, crackedOpen = false) {
  return [...LEVEL.walls.filter(w => !(gateOpen && w.dynamic === 'gate') && !(crackedOpen && w.dynamic === 'cracked')), ...LEVEL.rails];
}

function blocked(x, z, radius = BALANCE.player.radius, gateOpen = false, crackedOpen = false) {
  const f = floorHeightAt(x, z);
  if (!f) return true;
  return activeWalls(gateOpen, crackedOpen).some((w) => {
    if (Math.abs((w.y || 0) - f.y) > 1.6 && !w.low) return false;
    return circleHitsAabb(x, z, radius, w);
  });
}

function testRoute(name, points, gateOpen = false, crackedOpen = false) {
  let ok = true;
  for (let p = 0; p < points.length - 1; p++) {
    const a = points[p], b = points[p + 1];
    const distance = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const steps = Math.max(1, Math.ceil(distance / 0.18));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = a[0] + (b[0] - a[0]) * t;
      const z = a[1] + (b[1] - a[1]) * t;
      if (!floorHeightAt(x, z) || blocked(x, z, BALANCE.player.radius * 0.92, gateOpen, crackedOpen)) {
        console.error(`  route ${name} blocked near (${x.toFixed(2)}, ${z.toFixed(2)})`);
        ok = false;
        break;
      }
    }
    if (!ok) break;
  }
  check(ok, `${name} exploration route remains walkable`);
}

// Basic placement integrity.
check(Boolean(floorHeightAt(LEVEL.spawn.x, LEVEL.spawn.z)), 'spawn is on a valid floor');
check(!blocked(LEVEL.spawn.x, LEVEL.spawn.z), 'spawn is not inside collision geometry');
for (const it of LEVEL.interactables) {
  check(Boolean(floorHeightAt(it.x, it.z)), `${it.id} is on a walkable floor footprint`);
}
for (const p of LEVEL.pickups) {
  check(Boolean(floorHeightAt(p.x, p.z)), `${p.id} pickup is on a floor footprint`);
}

// Corridor comfort: designed around a 1.1-unit-diameter player.
for (const f of LEVEL.floors.filter(f => f.kind === 'corridor' || f.kind === 'ramp')) {
  const clearWidth = Math.min(f.w, f.d);
  check(clearWidth >= BALANCE.player.radius * 2 + 2.2, `${f.id} has mobile-friendly clearance (${clearWidth.toFixed(1)}u)`);
}

// Mission route: exact center lines and turn points that represent intended play paths.
testRoute('start → sling locker', [
  [-5.5, 0], [-2, 0], [2, 0], [5.4, 2.0], [5.4, 5.6]
]);
testRoute('locker → hub', [
  [5.4, 5.6], [6.5, 2.5], [8.2, 0], [13.5, 0], [18.6, 0], [23.5, 0], [26, 0]
]);
testRoute('hub → Gear Seal', [
  [26, 0], [27.5, 1.5], [29.5, 2.2], [31.2, 5.9]
]);
testRoute('hub → flooded grotto → Tide Seal', [
  [26, 0], [26, 8.2], [26, 13.5], [26, 18.2], [26, 23], [26, 28]
]);
testRoute('hub → stairs → lookout → Echo Seal', [
  [26, 0], [26, -8.2], [26, -13.5], [26, -18.2], [26, -22], [26, -26.2], [26, -33], [30.5, -34], [35.4, -34.8]
]);
testRoute('open gate → bridge → rescue', [
  [26, 0], [33.5, 0], [42.0, 0], [44.0, 0], [51.5, 0], [59.7, 0], [64, 0], [68, 0], [72.1, 0]
], true);

// Secret side branch: the cracked grotto wall, the pump tunnel, the valves and Dex's cage.
testRoute('grotto → cracked wall → pump room', [
  [26, 28], [30, 30.5], [36, 31], [40, 31], [44, 31], [47.5, 31], [50, 31]
], false, true);
testRoute('pump room → valves → Dex', [
  [50, 31], [50.5, 26.6], [50, 31], [55, 31], [60.5, 29.2], [61.2, 29.0],
  [57.5, 30.5], [54, 33], [51.5, 35.6], [54, 33], [57.5, 33.2], [59.6, 34.8]
], false, true);
const cracked = LEVEL.walls.find(w => w.id === LEVEL.crackedId);
check(cracked?.dynamic === 'cracked' && cracked.hp > 0, 'cracked wall is a breakable collision barrier');
check(blocked(cracked.x - 0.6, cracked.z, 0.3, false, false), 'cracked wall blocks the pump tunnel until broken');
check(!blocked(cracked.x, cracked.z, 0.3, false, true), 'broken cracked wall leaves the pump tunnel open');
for (const id of LEVEL.valveIds) {
  const v = LEVEL.interactables.find(i => i.id === id);
  check(Boolean(v) && LEVEL.hazards.some(h => h.valve === id), `${id} exists and shuts off a steam vent`);
}
check(Boolean(LEVEL.floors.find(f => f.drains)?.water), 'pump room starts flooded');

// Gate ordering and placement.
const gate = LEVEL.walls.find(w => w.id === LEVEL.gateId);
check(Boolean(gate?.dynamic === 'gate'), 'Smuggler Gate is a dynamic collision barrier');
check(blocked(gate.x, gate.z, 0.2, false), 'gate blocks the route before seals are used');
check(!activeWalls(true).some(w => w.id === LEVEL.gateId), 'gate collision is removed after unlock');
check(LEVEL.interactables.filter(x => x.type === 'seal').length === 3, 'mission has exactly three required seals');

// Stairs: 3 units over 8 horizontal units = 20.6 degrees, comfortable for camera/movement.
const stair = LEVEL.floors.find(f => f.id === 'stone-stairs');
const rise = Math.abs(stair.ramp.y1 - stair.ramp.y0);
const run = Math.abs(stair.ramp.to - stair.ramp.from);
const angle = Math.atan2(rise, run) * 180 / Math.PI;
check(angle < 24, `stone stair slope is controlled (${angle.toFixed(1)}°)`);

// Progression tuning. Objective XP alone reaches level 2; normal route reaches level 3 before final vault.
const objectiveXp = 3 * BALANCE.sealXp;
const preGateEnemyXp = LEVEL.enemies.filter(e => e.x < 43 && !e.optional).reduce((s, e) => s + e.xp, 0);
const normalPreGateXp = objectiveXp + preGateEnemyXp;
check(objectiveXp >= BALANCE.xpThresholds[1], `three seals alone reach level 2 (${objectiveXp} XP)`);
check(normalPreGateXp >= BALANCE.xpThresholds[2], `normal pre-gate combat can reach level 3 (${normalPreGateXp} XP)`);

const brute = LEVEL.enemies.find(e => e.type === 'brute');
const ungroundedDamage = BALANCE.player.baseDamage + BALANCE.levelDamageBonus; // level 2, no paid upgrades
const bruteHits = Math.ceil(brute.hp / ungroundedDamage);
const bruteTime = Math.max(0, bruteHits - 1) * BALANCE.player.shotCooldown;
check(bruteHits <= 8, `final brute needs at most 8 level-2 shots without paid upgrades (${bruteHits})`);
check(bruteTime < 3.2, `final brute base time-to-hit is not grind-gated (${bruteTime.toFixed(2)}s)`);

const guaranteedScrap = LEVEL.props.filter(p => p.breakable && !p.optional).reduce((s, p) => s + (p.scrap || 0), 0)
  + LEVEL.pickups.filter(p => p.type === 'scrap' && !p.optional).reduce((s, p) => s + p.amount, 0);
check(guaranteedScrap >= BALANCE.upgradeCosts.sling[0] + BALANCE.upgradeCosts.jacket,
  `guaranteed exploration scrap supports two meaningful upgrade choices (${guaranteedScrap})`);

// Difficulty: Normal is the original tuning; Tough still never turns the brute into a grind.
check(DIFFICULTY.normal.enemyHp === 1 && DIFFICULTY.normal.hpBonus === 0 && DIFFICULTY.normal.scrapLoss === 2, 'Normal difficulty keeps the original tuning');
const toughBruteHits = Math.ceil(brute.hp * DIFFICULTY.tough.enemyHp / (ungroundedDamage + BALANCE.slingUpgradeDamage));
check(toughBruteHits <= 9, `Tough brute stays beatable with one sling upgrade (${toughBruteHits} level-2 shots)`);

// UI wiring: every element id the game looks up must exist in index.html.
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const code = fs.readFileSync(path.join(root, 'src/game.js'), 'utf8') + fs.readFileSync(path.join(root, 'src/main.js'), 'utf8');
const refs = [...code.matchAll(/(?:getElementById|\$)\(['"]([\w-]+)['"]\)/g)].map(m => m[1]);
const missing = [...new Set(refs)].filter(id => !new RegExp(`id=["']${id}["']`).test(html));
check(refs.length > 20 && missing.length === 0, `all UI element IDs are wired (${missing.length ? missing.join(', ') : 'none missing'})`);
check(html.includes('<button id="start-button"'), 'the start screen has a real Start button');

// Rendering stack: the wall's shared three.js r186 + kit, nothing from a CDN.
check(/"three\/webgpu"\s*:\s*"\/lib\/three\/three\.webgpu\.js"/.test(html), 'index.html carries the standard import map');
check(fs.readFileSync(path.join(root, 'src/main.js'), 'utf8').includes("from 'kit/boot.js'"), 'the game boots through kit/boot.js');
const allSource = html + code + fs.readFileSync(path.join(root, 'src/models.js'), 'utf8');
check(!/cdn\.jsdelivr|unpkg\.com|WebGLRenderer/.test(allSource), 'no CDN copy of three.js and no WebGLRenderer');

console.log('\n--- Tuning summary ---');
console.log(`Pre-gate XP on normal clear: ${normalPreGateXp}`);
console.log(`Guaranteed exploration scrap: ${guaranteedScrap}`);
console.log(`Level-2/no-upgrade brute hits: ${bruteHits}`);
console.log(`Stair slope: ${angle.toFixed(1)}°`);

if (failures) {
  console.error(`\n${failures} validation failure(s).`);
  process.exit(1);
}
console.log('\nAll mission, path, UI, and progression checks passed.');
