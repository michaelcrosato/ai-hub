/** Original compact balance. Names/archetypes reference OpenRA's Red Alert rules,
 * not a claim of compatibility or identical original-game statistics. */
export const TITLE = 'IRON SIGNAL';
export const MODEL = 'GPT-6 Astra Pro';
export const GENERATED = 'September 26, 2026';
export const VERSION = '1.1.0';
export const STEP = 1 / 60;
export const WORLD = { width: 100, height: 84, cell: 2 };
export const POPULATION = 90;
/** Cosmetic physics budget at the 'high' tier; kit.detail() scales it for other tiers. */
export const PHYSICS_BUDGET = { bodies: 192, debris: 64 };
/** Game speed multipliers (simulation seconds per real second). */
export const SPEEDS = { 1: 'Normal', 1.5: 'Fast', 2: 'Faster' };
export const DIFFICULTIES = {
  story: { label: 'Field training', damage: 0.68, interval: 1.35, credits: 7500 },
  normal: { label: 'Commander', damage: 1, interval: 1, credits: 6000 },
  veteran: { label: 'Veteran', damage: 1.2, interval: 0.78, credits: 5000 }
};
const unit = (name, code, cost, time, hp, speed, range, damage, reload, extra = {}) => ({
  name, code, cost, time, hp, speed, range, damage, reload,
  kind: 'unit', category: 'infantry', needs: 'barracks', armor: 'light', radius: 0.45,
  sight: 14, weapon: 'rifle', targets: ['ground'], ...extra
});
const building = (name, code, cost, time, hp, size, power, extra = {}) => ({
  name, code, cost, time, hp, size, power, kind: 'building', category: 'structures',
  armor: 'structure', radius: Math.max(...size) / 2, sight: 15, needs: 'conyard', ...extra
});
export const TYPES = {
  mcv: unit('Mobile construction vehicle', 'MCV', 2000, 24, 950, 3.4, 0, 0, 1, { category: 'vehicles', needs: 'factory', armor: 'heavy', radius: 1.1, sight: 17, role: 'deploy', tip: 'Select, then Deploy [D]. Establishes a construction yard.' }),
  rifle: unit('Rifle infantry', 'RFL', 100, 3, 90, 3.4, 8, 10, 0.75, { tip: 'Cheap infantry screen. Strong against soldiers; weak against armor.' }),
  rocket: unit('Rocket soldier', 'RKT', 240, 5, 90, 3.1, 12, 30, 2, { weapon: 'rocket', targets: ['ground','air','naval'], tip: 'Anti-tank and anti-air support. Protect them with riflemen.' }),
  grenadier: unit('Grenadier', 'GRN', 180, 4, 115, 3.5, 8, 25, 1.6, { weapon: 'grenade', splash: 2.3, faction: 'soviet', tip: 'Explosive anti-infantry specialist with splash damage.' }),
  engineer: unit('Engineer', 'ENG', 400, 7, 80, 3.3, 0, 0, 1, { role: 'capture', tip: 'Right-click neutral or enemy structures to capture. Can repair friendly buildings.' }),
  medic: unit('Field medic', 'MED', 220, 5, 85, 3.4, 7, 0, 1, { role: 'heal', faction: 'allies', tip: 'Automatically heals nearby infantry. Keep behind your front line.' }),
  commando: unit('Commando', 'CMD', 1200, 14, 260, 4.2, 10, 55, 0.9, { needs: 'tech', producer: 'barracks', role: 'demolish', faction: 'allies', sight: 17, tip: 'Elite infantry. Cuts down soldiers at range; order it onto an enemy structure to plant charges and demolish it.' }),
  ranger: unit('Ranger', 'RNG', 450, 8, 240, 6.2, 10, 14, 0.6, { category: 'vehicles', needs: 'factory', radius: 0.8, sight: 21, tip: 'Fast reconnaissance and anti-infantry fire. Reveals a wide area.' }),
  light: unit('Light tank', 'LT', 650, 10, 420, 4.8, 12, 33, 1.5, { category: 'vehicles', needs: 'factory', armor: 'heavy', radius: 0.9, weapon: 'cannon', faction: 'allies', tip: 'Mobile armor. Flank artillery or raid enemy harvesters.' }),
  medium: unit('Medium tank', 'MT', 850, 12, 670, 3.7, 13, 48, 1.7, { category: 'vehicles', needs: 'factory', armor: 'heavy', radius: 1, weapon: 'cannon', faction: 'allies', tip: 'Main battle tank. Strong against vehicles and structures.' }),
  heavy: unit('Heavy tank', 'HT', 1000, 14, 820, 3.2, 13, 64, 1.9, { category: 'vehicles', needs: 'factory', armor: 'heavy', radius: 1.1, weapon: 'cannon', faction: 'soviet', tip: 'Twin-barrel Soviet armor. Heavy firepower, slower movement.' }),
  mammoth: unit('Mammoth tank', 'MMT', 1700, 22, 1350, 2.5, 14, 90, 2.1, { category: 'vehicles', needs: 'tech', producer: 'factory', armor: 'heavy', radius: 1.3, weapon: 'cannon', faction: 'soviet', targets: ['ground','air'], tip: 'Heavy breakthrough tank. Slowly repairs itself below half health.' }),
  teslaTank: unit('Tesla tank', 'TTK', 1350, 16, 700, 3.6, 11, 95, 2.4, { category: 'vehicles', needs: 'tech', producer: 'factory', armor: 'heavy', radius: 1.05, weapon: 'tesla', targets: ['ground','naval'], faction: 'soviet', tip: 'Shock armor: a mobile tesla coil that wrecks vehicles and infantry at close range.' }),
  artillery: unit('Artillery', 'ART', 700, 12, 270, 3, 23, 70, 3.1, { category: 'vehicles', needs: 'radar', producer: 'factory', radius: 0.95, weapon: 'shell', splash: 3.5, minRange: 5, tip: 'Long-range siege with splash damage. Vulnerable at close range.' }),
  harvester: unit('Ore harvester', 'HAR', 1000, 16, 950, 3.3, 0, 0, 1, { category: 'vehicles', needs: 'factory', armor: 'heavy', radius: 1.15, role: 'harvest', tip: 'Automatically harvests ore and returns it to a refinery. Protect your economy.' }),
  longbow: unit('Longbow', 'LBW', 1200, 18, 340, 7.5, 15, 52, 1.8, { category: 'air', needs: 'helipad', armor: 'air', radius: 0.9, weapon: 'rocket', domain: 'air', faction: 'allies', tip: 'Airborne anti-armor support. Ignores terrain; vulnerable to SAMs.' }),
  hind: unit('Hind gunship', 'HND', 1100, 17, 420, 6.5, 13, 20, 0.5, { category: 'air', needs: 'helipad', armor: 'air', radius: 1, weapon: 'rifle', domain: 'air', faction: 'soviet', tip: 'Armored helicopter with excellent anti-infantry fire.' }),
  destroyer: unit('Destroyer', 'DST', 1100, 18, 750, 4.5, 20, 58, 2, { category: 'naval', needs: 'shipyard', armor: 'naval', radius: 1.2, weapon: 'rocket', domain: 'naval', targets: ['ground','air','naval'], faction: 'allies', tip: 'Versatile warship. Escorts cruisers, fights submarines and aircraft.' }),
  cruiser: unit('Cruiser', 'CRS', 1700, 24, 1150, 3, 32, 115, 3.7, { category: 'naval', needs: 'tech', producer: 'shipyard', armor: 'naval', radius: 1.5, weapon: 'shell', splash: 4, domain: 'naval', targets: ['ground','naval'], faction: 'allies', tip: 'Long-range coastal bombardment. Needs a destroyer escort.' }),
  submarine: unit('Attack submarine', 'SUB', 850, 14, 620, 4.1, 19, 95, 2.7, { category: 'naval', needs: 'shipyard', armor: 'naval', radius: 1.1, weapon: 'torpedo', domain: 'naval', targets: ['naval'], faction: 'soviet', tip: 'Powerful torpedoes against ships. Cannot attack inland targets.' }),
  conyard: building('Construction yard', 'CY', 0, 0, 1800, [7,6], 10, { generation: 40, noBuild: true, tip: 'Your base headquarters. Build structures nearby. Losing every yard and MCV is defeat.' }),
  power: building('Power plant', 'PWR', 350, 7, 700, [4,4], 0, { generation: 160, tip: 'Generates 160 power. Low power slows production and disables powered defenses.' }),
  advancedPower: building('Advanced power', 'AP', 750, 12, 1000, [5,5], 0, { generation: 400, needs: 'radar', tip: 'High-output reactor. Generates 400 power.' }),
  barracks: building('Barracks', 'BAR', 500, 9, 900, [5,4], 25, { needs: 'power', tip: 'Trains infantry, engineers, and support troops.' }),
  refinery: building('Ore refinery', 'REF', 1400, 14, 1150, [6,6], 35, { needs: 'power', tip: 'Receives ore. Comes with a free harvester. The backbone of your economy.' }),
  factory: building('War factory', 'WAR', 1300, 17, 1400, [7,6], 45, { needs: 'refinery', tip: 'Produces vehicles. Right-click ground while selected to set a rally point.' }),
  radar: building('Radar dome', 'RAD', 900, 12, 800, [5,5], 55, { needs: 'refinery', tip: 'Unlocks artillery, aircraft, and enemy contacts on the minimap. Requires power.' }),
  repair: building('Service depot', 'REP', 650, 10, 900, [6,5], 30, { needs: 'factory', tip: 'Automatically repairs nearby vehicles for credits. Bring veterans home.' }),
  pillbox: building('Pillbox', 'PBX', 450, 7, 600, [3,3], 10, { category: 'defense', needs: 'barracks', range: 13, damage: 18, reload: 0.5, weapon: 'rifle', targets: ['ground'], tip: 'Cheap anti-infantry base defense. Operates even during low power.' }),
  tesla: building('Tesla coil', 'TLS', 1100, 15, 750, [3,3], 85, { category: 'defense', needs: 'radar', range: 16, damage: 125, reload: 2.7, weapon: 'tesla', targets: ['ground','naval'], powered: true, tip: 'Devastating anti-armor defense. Goes offline when power is insufficient.' }),
  sam: building('SAM battery', 'SAM', 600, 9, 550, [3,3], 25, { category: 'defense', needs: 'radar', range: 22, damage: 70, reload: 1.8, weapon: 'rocket', targets: ['air'], powered: true, tip: 'Anti-air only. Protects the base from helicopters.' }),
  helipad: building('Helipad', 'HEL', 800, 11, 850, [6,6], 40, { needs: 'radar', tip: 'Produces helicopters. Air units ignore rivers, cliffs, and walls.' }),
  shipyard: building('Naval yard', 'NAV', 900, 12, 1100, [6,6], 40, { needs: 'refinery', coast: true, tip: 'Place across a coastline, within 22m of your base. Builds warships.' }),
  tech: building('Technology center', 'TEC', 1500, 20, 950, [6,5], 70, { needs: 'radar', tip: 'Unlocks advanced units and research. Also enables the support strike.' }),
  silo: building('Missile silo', 'SIL', 1800, 24, 1300, [5,5], 80, { needs: 'tech', tip: 'Charges a precision missile strike every 100 seconds. Target a visible area.' }),
  oil: building('Oil derrick', 'OIL', 0, 0, 900, [4,4], 0, { noBuild: true, capturable: true, tip: 'Capture with an engineer for recurring income.' }),
  relay: building('Communications relay', 'COM', 0, 0, 1000, [4,4], 0, { noBuild: true, capturable: true, sight: 23, tip: 'Capture with an engineer to obtain intelligence and a credit bonus.' }),
  lab: building('Research outpost', 'LAB', 0, 0, 1100, [5,5], 0, { noBuild: true, capturable: true, tip: 'Capture with an engineer for field upgrades and campaign intelligence.' }),
  tower: building('Broadcast tower', 'BRD', 0, 0, 2600, [4,4], 0, { noBuild: true, noSell: true, sight: 20, tip: 'Guides the evacuation convoy through the pass. It must stand until the convoy is clear.' })
};
export const UPGRADES = {
  armor: { name: 'Composite armor', code: 'ARM', cost: 1100, time: 25, needs: 'tech', category: 'research', kind: 'upgrade', tip: 'All forces receive 20% less damage. One-time research.' },
  weapons: { name: 'Improved munitions', code: 'DMG', cost: 1100, time: 25, needs: 'tech', category: 'research', kind: 'upgrade', tip: 'All weapons deal 20% more damage. One-time research.' },
  logistics: { name: 'Field logistics', code: 'LOG', cost: 900, time: 22, needs: 'radar', category: 'research', kind: 'upgrade', tip: 'Harvesters carry 50% more ore. All production is 15% faster.' }
};
export const CATALOG = { ...TYPES, ...UPGRADES };
export const CATEGORIES = [
  ['structures','Base'], ['defense','Defense'], ['infantry','Infantry'],
  ['vehicles','Armor'], ['air','Air'], ['naval','Navy'], ['research','Research']
];
export const MISSIONS = [
  { id: 'foothold', number: '01', name: 'A quiet frontier', region: 'NORTHRIDGE VALLEY', biome: 'temperate', subtitle: 'Establish. Reconnoiter. Break through.',
    briefing: 'The valley has fallen silent. An enemy command post controls the crossings, and our northern relay is off the air. Deploy your construction vehicle, bring the ore fields online, and build a force to reopen the frontier.',
    guidance: 'Deploy the MCV [D]. Build a power plant, refinery, barracks, and war factory. An engineer must capture the gold communications relay. Destroy the enemy construction yard to finish the operation.',
    primary: ['Establish a construction yard', 'Capture the northern communications relay', 'Destroy the enemy command post'],
    secondary: 'Capture the oil derrick for recurring income.', base: [18,64], enemy: [80,19], cash: 6000,
    wave: 70, tier: 1, winText: 'The relay is back online. Across the valley, the first civilian broadcasts cut through the static. But the signal points north—to a fortified naval station.' },
  { id: 'breakwater', number: '02', name: 'The iron coast', region: 'GREYHARBOR APPROACH', biome: 'coast', subtitle: 'Control the shore. Cut the supply line.',
    briefing: 'Enemy submarines are choking the coast. Greyharbor supplies the entire northern front. Establish a naval yard, coordinate armor with coastal bombardment, and eliminate the harbor command network.',
    guidance: 'The sea lies east of the coastal road. Build a naval yard near the water. Destroy the marked radar dome and naval yard. Capturing the inland research outpost grants improved munitions.',
    primary: ['Destroy the harbor radar', 'Destroy the enemy naval yard'], secondary: 'Capture the research outpost to recover improved munitions.',
    base: [20,64], enemy: [59,17], cash: 6800, wave: 62, tier: 2,
    winText: 'The harbor falls quiet. The blockade is broken, but intercepted orders reveal one final threat: a missile complex hidden beyond the snow line.' },
  { id: 'last-signal', number: '03', name: 'The last signal', region: 'WHITE PEAK COMPLEX', biome: 'snow', subtitle: 'One final transmission. No second chance.',
    briefing: 'Two missile silos are preparing a coordinated launch. Advance through the frozen passes, break the defensive grid, and silence the launch network before the countdown reaches zero. This ends here.',
    guidance: 'Destroy both marked missile silos and the enemy construction yard. An engineer can capture the relay to delay the launch by 180 seconds. Aircraft can bypass the river, but SAM batteries guard the approach.',
    primary: ['Destroy both missile silos', 'Destroy the complex headquarters'], secondary: 'Capture the relay to delay the launch by three minutes.',
    base: [18,64], enemy: [80,18], cash: 7400, wave: 55, tier: 3, deadline: 720,
    winText: 'The countdown stops. For a moment, there is only wind across the snow. Then the field radio crackles: “All stations, stand down.” The frontier is open. The last signal is yours.' },
  { id: 'ember-pass', number: '04', name: 'The long night', region: 'EMBER RIDGE PASS', biome: 'autumn', subtitle: 'Epilogue. Hold the pass. Bring them home.', epilogue: true,
    briefing: 'Not everyone heard the stand-down order. A remnant battlegroup is marching on Ember Ridge, where the last evacuation convoy is still crossing the pass. Our broadcast tower guides the trucks through the smoke. Hold the pass until the convoy is clear, then break the remnant command post.',
    guidance: 'The remnant attacks early and often, and every wave goes for the broadcast tower. Two passes cut through the ridge: hold them with pillboxes, Tesla coils, and armor, and keep a service depot close. When the convoy is clear, reinforcements stop and the command post is exposed.',
    primary: ['Protect the broadcast tower until the convoy is clear', 'Destroy the remnant command post'], secondary: 'Capture the research outpost to recover improved munitions.',
    base: [20,56], enemy: [82,20], cash: 7000, wave: 45, tier: 4, hold: 540,
    winText: 'The last trucks roll out of the pass as dawn breaks over the ridge. The remnant command post is silent, and for the first time in months every channel on the band is clear. Go home, commander.' }
];
export const FACTIONS = { allies: { name: 'Allied command', color: 0x61bfb8, enemy: 'soviet' }, soviet: { name: 'Soviet command', color: 0xd7654c, enemy: 'allies' } };
export const domain = e => TYPES[e.type].domain || 'ground';
