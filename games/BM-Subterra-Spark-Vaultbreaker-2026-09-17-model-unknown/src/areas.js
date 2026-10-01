/**
 * areas.js — the two areas of Subterra Spark, as data plus a build function.
 *
 * build(B) places everything through the builder from main.js: static boxes,
 * cylinders and rocks (merged per material), colliders, lava, signs, the
 * vault bunker, the gate, enemies, waves and pickups. Exterior play happens
 * on a 70 × 38 plain around the origin; every vault interior is the room at
 * z = 80, entered on foot.
 */

/** A fresh Crawler at the start of Area 01. */
export const BASE_LOADOUT = { level: 1, xp: 0, nextXp: 40, maxHealth: 100, health: 100, scrap: 0, damageMul: 1, weapon: 0 };
export const MAX_LEVEL = 6;
/** Tinker Pad fittings, bought in order. */
export const UPGRADES = [
  { cost: 12, name: 'COIL BARREL MK II', toast: 'COIL BARREL MK II · DAMAGE +24%' },
  { cost: 16, name: 'ARC SPLITTER', toast: 'ARC SPLITTER · THREE-WAY FIRE' },
];
/** Once fully fitted, the Tinker Pad patches the hull for salvage. */
export const REPAIR = { cost: 5, amount: 50 };
/** Enemy stats before difficulty scaling (interior kills give +2 XP). */
export const ENEMY = {
  skitter: { hp: 34, speed: 2.15, radius: 0.72, xp: 10, scrap: 2 },
  turret: { hp: 48, speed: 0, radius: 0.72, xp: 10, scrap: 3 },
  hopper: { hp: 30, speed: 2.6, radius: 0.7, xp: 11, scrap: 2 },
  mortar: { hp: 44, speed: 0, radius: 0.8, xp: 12, scrap: 3 },
};

export const DIFFICULTY = {
  scout: { id: 'scout', label: 'SCOUT', note: 'Softer hits, slower fire', dmg: 0.65, fire: 1.25, hp: 0.85, boss: 0.85, loss: 1 },
  pilot: { id: 'pilot', label: 'PILOT', note: 'As designed', dmg: 1, fire: 1, hp: 1, boss: 1, loss: 2 },
  veteran: { id: 'veteran', label: 'VETERAN', note: 'Harder hits, faster fire', dmg: 1.35, fire: 0.85, hp: 1.15, boss: 1.2, loss: 3 },
};

/** Area 02 started without an Area 01 clear on this device: a fair, level-3 loadout. */
export const AREA2_LOADOUT = { level: 3, xp: 0, nextXp: 96, maxHealth: 130, health: 130, scrap: 8, damageMul: 1.21, weapon: 0 };

export const AREAS = {
  1: {
    id: 1,
    seed: 3301,
    code: 'AREA 01',
    name: 'CINDER AQUIFER',
    chip: 'Cinder Aquifer',
    vault: 'VAULT 03',
    item: 'PHASE CAPACITOR',
    itemShort: 'CAPACITOR',
    boss: 'mole',
    bossName: 'M.O.L.E. EXCAVATION ENGINE',
    par: 300,
    blurb:
      'Drive the Crawler through a sealed aquifer, breach a buried vault on foot, recover its capacitor, and crack the excavation engine guarding the route below.',
    clearTitle: 'VAULT<br><em>BREACHED</em>',
    palette: { bg: 0x07161c, fog: 0.021, sky: 0xb9f4ff, ground: 0x17210f, hemi: 1.4, sun: 0xffe3b7, sunI: 3.5 },
    checkpoints: { start: [-27, 0], route: [-7.5, 0], item: [4, 8], gate: [16.6, 0] },
    text: {
      start: 'Blast the magenta crystal nest blocking the east passage.',
      route: 'Crystal nest shattered. Find Vault 03 on the upper route and go inside on foot.',
      inVault: 'Clear Vault 03. Recover its phase capacitor.',
      vaultClear: 'Vault clear. Grab the exposed capacitor, then return to the surface.',
      haveItem: 'Phase capacitor secured. Return to the surface and power the east gate.',
      exited: 'Bring the phase capacitor to the east gate terminal.',
      gate: 'Gate open. Cross into the core-lift arena and destroy the M.O.L.E. engine.',
      complete: 'Mission complete. Core-lift route secured.',
    },
    toasts: { route: 'ROUTE OPEN · VAULT SIGNAL FOUND', gate: 'PHASE GATE DISCHARGED', intro: 'AREA 01 · CINDER AQUIFER' },
    build(B) {
      const { mat, rand } = B;
      B.light(0, 0x25d9ff, 40, 28, -8, 7, 0);
      B.light(1, 0xffa644, 32, 24, 0, 5, 80);
      B.light(2, 0xff5252, 35, 25, 26, 5, 0);

      // Exterior floor and water channels.
      B.box(0, -0.65, 0, 70, 1, 38, mat.soil, { cast: false });
      B.water(-5, -0.06, -14.5, 60, 0.18, 3.5);
      B.water(7, -0.08, 14.2, 52, 0.16, 3.2);
      for (let x = -30; x <= 32; x += 3.2) {
        B.rock(x + (rand() - 0.5), -18 + rand() * 0.9, 0.9 + rand() * 0.65, mat.darkRock);
        B.rock(x + (rand() - 0.5), 18 - rand() * 0.9, 0.9 + rand() * 0.65, mat.darkRock);
      }
      for (let z = -15; z <= 15; z += 3.4) {
        B.rock(-34 + rand() * 0.8, z, 0.95 + rand() * 0.65, mat.darkRock);
        B.rock(34 - rand() * 0.8, z, 0.95 + rand() * 0.65, mat.darkRock);
      }
      B.edges();

      // Start platform.
      B.platform(-27, 0, mat.cyan, 0x44e9ff);
      B.sign('VAULT →', -23, -4.8, -0.25);

      // First choke point: rocky wall and the destructible crystal nest.
      for (let z = -16; z <= -3.6; z += 2.2) {
        B.rock(-11 + rand() * 0.7, z, 1.2);
        B.collider(-11, z, 2.6, 2.4);
      }
      for (let z = 3.6; z <= 16; z += 2.2) {
        B.rock(-11 + rand() * 0.7, z, 1.2);
        B.collider(-11, z, 2.6, 2.4);
      }
      B.crystals(-11);

      // Bridge and bunker route.
      for (let i = 0; i < 7; i++) B.box(-5.6 + i * 1.6, 0.02, 7.4, 1.4, 0.3, 5.8, i % 2 ? mat.metal : mat.darkMetal);
      B.box(-5.3, 0.75, 4.65, 12, 0.16, 0.16, mat.metal);
      B.box(-5.3, 0.75, 10.15, 12, 0.16, 0.16, mat.metal);
      B.collider(-5.3, 4.65, 12, 0.22, 'external', { blocks: false });
      B.collider(-5.3, 10.15, 12, 0.22, 'external', { blocks: false });
      for (let x = -10.5; x < 0.5; x += 1.6) {
        B.box(x, 0.38, 4.65, 0.12, 0.75, 0.12, mat.metal);
        B.box(x, 0.38, 10.15, 0.12, 0.75, 0.12, mat.metal);
      }
      B.sign('VAULT 03', -1.2, 11.4, -0.55);
      B.bunker(3.5, 12.8, 1);

      // East gate wall, force field and terminal.
      B.gateWall(14, mat.gate, mat.rock, 'gate');
      B.terminal(11.4, -3.2);
      B.sign('CORE LIFT →', 16.8, 5.6, 0.45);

      // Upgrade station.
      B.tinker(8.5, -11);
      B.sign('TINKER PAD', 5.4, -12.6, 0.25);

      // Boss arena.
      B.arena(26, 0, mat.darkMetal, mat.orange, mat.metal);

      // Vault 03 interior.
      B.room(mat.rock, mat.darkMetal);
      for (const [x, z] of [[-5, 76], [5, 76], [-5, 84], [5, 84]]) B.pillar(x, z, mat.metal);
      B.box(0, 0.08, 80, 5.2, 0.18, 5.2, mat.metal);
      B.sign('CAPACITOR', -6.8, 86.8, 0);
      B.itemAt(0, 80);

      B.enemy('e0', -5, -3.8, 'skitter');
      B.enemy('e1', -2, 11.8, 'turret');
      B.enemy('e2', 5.4, -6.2, 'skitter');
      B.enemy('e3', 8, 5.6, 'skitter');
      B.enemy('e4', 10.4, -12.2, 'turret');
      B.wave([
        ['i0', -6, 75.2, 'skitter'],
        ['i1', 0, 74.7, 'turret'],
        ['i2', 6, 76, 'turret'],
        ['i3', -6, 83.8, 'skitter'],
        ['i4', 0, 82.4, 'skitter'],
        ['i5', 6, 83.4, 'skitter'],
      ]);
      B.pickup('p0', -20, -10, 'scrap', 4);
      B.pickup('p1', -4, -11, 'health', 24);
      B.pickup('p2', 7, 13, 'scrap', 5);
      B.pickup('p3', 10, -14, 'scrap', 5);
    },
  },

  2: {
    id: 2,
    seed: 7702,
    code: 'AREA 02',
    name: 'EMBER FOUNDRY',
    chip: 'Ember Foundry',
    vault: 'VAULT 07',
    item: 'COOLANT CORE',
    itemShort: 'COOLANT',
    boss: 'worm',
    bossName: 'T.H.R.E.S.H. BURROWER',
    par: 420,
    blurb:
      'The core lift drops into a flooded foundry of lava. Knock out the slag pylons, cross the trench of Vault 07 on foot for its coolant core, and dig out the burrower below.',
    clearTitle: 'FOUNDRY<br><em>SILENCED</em>',
    palette: { bg: 0x170b09, fog: 0.022, sky: 0xffc9a8, ground: 0x200c06, hemi: 1.25, sun: 0xffb27a, sunI: 3.1 },
    checkpoints: { start: [-27, 0], route: [-1.5, 6.5], item: [4, -8], gate: [16.6, 0] },
    text: {
      start: 'A heat field seals the foundry. Destroy both slag pylons that feed it.',
      pylon: 'One slag pylon down. Find the other one; it is across the lava river.',
      route: 'Heat field down. Vault 07 lies south of the lava pool. Go inside on foot.',
      inVault: 'Clear Vault 07. Two security waves guard the coolant core.',
      vaultClear: 'Vault clear. Cross the trench for the coolant core, then return to the surface.',
      haveItem: 'Coolant core secured. Return to the surface and cool the east gate.',
      exited: 'Bring the coolant core to the heat-gate terminal.',
      gate: 'Gate cooled. Enter the foundry core and stop the T.H.R.E.S.H. burrower.',
      complete: 'Foundry core silenced. The deep lift is clear.',
    },
    toasts: { route: 'HEAT FIELD DOWN · VAULT 07 FOUND', gate: 'HEAT GATE VENTED', intro: 'AREA 02 · EMBER FOUNDRY' },
    build(B) {
      const { mat, rand } = B;
      B.light(0, 0xff6a2a, 46, 30, -14, 6, 0);
      B.light(1, 0xff8a3a, 30, 24, 0, 5, 80);
      B.light(2, 0xff3b2a, 38, 26, 26, 5, 0);

      // Basalt floor ringed with rock.
      B.box(0, -0.65, 0, 70, 1, 38, mat.basalt, { cast: false });
      for (let x = -30; x <= 32; x += 3.2) {
        B.rock(x + (rand() - 0.5), -18 + rand() * 0.9, 0.9 + rand() * 0.65, mat.darkRock);
        B.rock(x + (rand() - 0.5), 18 - rand() * 0.9, 0.9 + rand() * 0.65, mat.darkRock);
      }
      for (let z = -15; z <= 15; z += 3.4) {
        B.rock(-34 + rand() * 0.8, z, 0.95 + rand() * 0.65, mat.darkRock);
        B.rock(34 - rand() * 0.8, z, 0.95 + rand() * 0.65, mat.darkRock);
      }
      B.edges();

      // The core lift lands here.
      B.platform(-27, 0, mat.amber, 0xffb24a);
      B.sign('FOUNDRY →', -23, -4.8, -0.25, { edge: '#ff9a48' });

      // Lava river with a railed bridge. The Crawler shrugs lava off; on foot it burns.
      B.lava(-18, -9.6, 3, 15.2);
      B.lava(-18, 9.6, 3, 15.2);
      for (let i = 0; i < 3; i++) B.box(-19.6 + i * 1.6, 0.02, 0, 1.4, 0.3, 4.4, i % 2 ? mat.metal : mat.darkMetal);
      for (const z of [-2.2, 2.2]) {
        B.box(-18, 0.75, z, 4.8, 0.16, 0.16, mat.metal);
        B.collider(-18, z, 4.8, 0.22, 'external', { blocks: false });
        for (const x of [-20.2, -18.6, -17, -15.8]) B.box(x, 0.38, z, 0.12, 0.75, 0.12, mat.metal);
      }
      for (let i = 0; i < 6; i++) B.rock(-18 + (rand() - 0.5) * 2.6, -16 + i * 6.4 + (i > 2 ? 0 : -0.5), 0.5 + rand() * 0.3, mat.slag);

      // Two slag pylons feed the heat field.
      B.pylon('pyA', -24, -12.5);
      B.pylon('pyB', -10, 12.5);
      B.sign('SLAG PYLON', -27.5, -8.6, 0.2, { edge: '#ff9a48' });

      // The heat-field wall.
      B.gateWall(-5, mat.heatGate, mat.slag, 'route');
      B.sign('HEAT FIELD', -8.2, 4.6, -0.2, { edge: '#ff9a48' });

      // Central lava pool with a rim of slag.
      B.lava(3, 0, 6, 6);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const x = 3 + Math.cos(a) * 4.1;
        const z = Math.sin(a) * 4.1;
        B.rock(x, z, 0.38 + rand() * 0.2, mat.slag);
        B.collider(x, z, 0.9, 0.9, 'external', { blocks: false });
      }

      // Vault 07, door facing north.
      B.bunker(3.5, -12.8, -1);
      B.sign('VAULT 07', -1.2, -11.4, 0.55, { edge: '#ff9a48' });

      // Tinker pad on the north ledge.
      B.tinker(8.5, 11);
      B.sign('TINKER PAD', 5.4, 12.6, -0.25, { edge: '#ff9a48' });

      // East heat gate and its terminal.
      B.gateWall(14, mat.heatGate, mat.slag, 'gate');
      B.terminal(11.4, 3.2);
      B.sign('FOUNDRY CORE →', 16.8, -5.6, -0.45, { edge: '#ff9a48' });

      // Burrower arena with two lava vents.
      B.arena(26, 0, mat.slag, mat.amber, mat.metal);
      B.lava(23.5, -5.2, 2.2, 2.2);
      B.lava(29, 4.6, 2.2, 2.2);

      // Vault 07 interior: a lava trench with two walkways.
      B.room(mat.slag, mat.darkMetal);
      B.lava(-7.9, 80, 3, 2, 'interior');
      B.lava(0, 80, 8.8, 2, 'interior');
      B.lava(7.9, 80, 3, 2, 'interior');
      B.box(-5.4, 0.05, 80, 2, 0.22, 2.6, mat.metal);
      B.box(5.4, 0.05, 80, 2, 0.22, 2.6, mat.metal);
      for (const [x, z] of [[-6, 85.5], [6, 85.5], [-2.5, 74.5], [2.5, 74.5]]) B.pillar(x, z, mat.metal);
      B.sign('COOLANT CORE', -6.8, 86.8, 0, { edge: '#ff9a48' });
      B.itemAt(0, 73.4);

      B.enemy('e0', -22, 6.5, 'hopper');
      B.enemy('e1', -25, -7.5, 'skitter');
      B.enemy('e2', -8, 8, 'mortar');
      B.enemy('e3', -13, 14.5, 'hopper');
      B.enemy('e4', 1.5, -7.5, 'skitter');
      B.enemy('e5', 9, -6.5, 'mortar');
      B.enemy('e6', 6, 9, 'turret');
      B.enemy('e7', 11.5, 14.5, 'hopper');
      B.wave([
        ['i0', -6, 75.6, 'skitter'],
        ['i1', 6, 76.2, 'hopper'],
        ['i2', 0, 76.6, 'turret'],
        ['i3', -7, 83.4, 'skitter'],
        ['i4', 7.2, 83, 'hopper'],
      ]);
      B.wave([
        ['j0', -6.5, 72.6, 'mortar'],
        ['j1', 6.5, 72.6, 'mortar'],
        ['j2', -3.2, 77.2, 'hopper'],
        ['j3', 3.2, 77.2, 'hopper'],
      ]);
      B.pickup('p0', -30, -14, 'scrap', 4);
      B.pickup('p1', -12, -15, 'health', 24);
      B.pickup('p2', -2, 15, 'scrap', 5);
      B.pickup('p3', 11, -15, 'scrap', 5);
      B.pickup('p4', 12, 6.5, 'health', 20);
      B.pickup('p5', 8.2, 87, 'health', 20, 'interior');
    },
  },
};
