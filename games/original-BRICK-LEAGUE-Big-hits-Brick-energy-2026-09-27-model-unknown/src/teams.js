import { seeded } from './math.js';

const positions = ['CF', 'SS', 'DH', '1B', 'RF', '3B', 'LF', 'C', '2B', 'BN', 'BN', 'BN', 'BN', 'BN', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'];
const sluggers = [
  ['Jett Vega', 'THE JET'], ['Kai Torres', 'QUICKSILVER'], ['Rocco Rocket', 'BIG ENERGY'], ['Axel Stone', 'THE HAMMER'], ['Milo Cruz', 'SUNBURST'], ['Ruby Knox', 'HOT CORNER'], ['Ziggy Park', 'WILD THING'], ['Beau Banks', 'THE WALL'], ['Remy Reed', 'SPARK PLUG'],
  ['Theo Price', 'CLUTCH'], ['Ivy Fox', 'FAST TRACK'], ['Nico Bell', 'THE SWITCH'], ['Sage West', 'GOLD GLOVE'], ['Luca Lane', 'HIGH VOLTAGE'],
  ['Ace Rivera', 'THE HEAT'], ['Dax Wilder', 'WILD FIRE'], ['Nova Brooks', 'SUPERNOVA'], ['Kit Monroe', 'CURVEBALL'], ['Finn Atlas', 'THE GIANT'], ['Max Soleil', 'SUN RAY'], ['Jules Carter', 'ICE COLD'], ['Rio Chase', 'RIPTIDE'], ['Ash Phoenix', 'RISE UP'], ['Cleo Grant', 'THE CLOSER'], ['Troy Dash', 'FLASH'], ['Wren Cole', 'NIGHT SHIFT'],
];
const comets = [
  ['Luna Sterling', 'MOONSHOT'], ['Rex Rhodes', 'THE REX'], ['Blaze Bennett', 'ORBITAL'], ['Cody Cannon', 'CANNONBALL'], ['Arlo Frost', 'ICE MAN'], ['Jade Sparks', 'AFTERBURNER'], ['Ozzy Quinn', 'COMET TAIL'], ['Tank Wilson', 'THE TANK'], ['Eli Echo', 'SONIC BOOM'],
  ['Skye Vega', 'BLUE SKY'], ['Ezra Flint', 'FIRESTARTER'], ['Pip Baxter', 'THE PICKPOCKET'], ['Opal Hart', 'DIAMOND'], ['Leo Vale', 'STAR POWER'],
  ['Duke Thunder', 'THUNDERBOLT'], ['Pax Storm', 'THE STORM'], ['Iris Moon', 'ECLIPSE'], ['Chase Bolt', 'LIGHTNING'], ['Vera North', 'POLARIS'], ['Orion Nash', 'GALAXY'], ['Quinn Ryder', 'THE RIDER'], ['Rowan Steel', 'STEEL ARM'], ['Lex Mercer', 'THE MYSTERY'], ['Arden Shaw', 'NIGHTFALL'], ['Felix Kent', 'COMET EXPRESS'], ['Juno Hale', 'FINAL BOSS'],
];

function roster(id, names, seed) {
  const rng = seeded(seed);
  const skins = ['#f4c39c', '#b97b50', '#8f5339', '#d69a6d', '#f0d2b0', '#663e30'];
  return names.map(([name, nickname], i) => ({
    id: `${id}-${i}`,
    name,
    nickname,
    number: [7, 12, 99, 44, 23, 8, 21, 55, 4, 16, 31, 6, 28, 35, 1, 17, 24, 32, 45, 50, 61, 68, 72, 80, 87, 91][i],
    position: positions[i],
    hand: rng() > 0.3 ? 'R' : 'L',
    contact: Math.round(56 + rng() * 37),
    power: i === 2 ? 98 : Math.round(53 + rng() * 40),
    speed: i === 0 ? 97 : Math.round(53 + rng() * 39),
    field: Math.round(64 + rng() * 29),
    arm: i >= 14 ? Math.round(79 + rng() * 18) : Math.round(59 + rng() * 36),
    skin: skins[i % skins.length],
    hair: ['#302921', '#614031', '#1f2730', '#dfae47'][i % 4],
  }));
}

export const TEAMS = [
  { id: 'comets', name: 'COMETS', city: 'METRO CITY', short: 'MET', color: '#18bdb1', dark: '#123e44', accent: '#adf3df', symbol: '✦', motto: 'OUT OF THIS WORLD.', special: 'COMET CRUSH', roster: roster('met', comets, 224) },
  { id: 'sluggers', name: 'SLUGGERS', city: 'SUNSET CITY', short: 'SUN', color: '#fa6938', dark: '#672b27', accent: '#ffcf53', symbol: 'ϟ', motto: 'GO BIG. GO HOME.', special: 'BRICK BREAKER', roster: roster('sun', sluggers, 901) },
];

export const getPlayer = (team, id) => {
  const p = TEAMS[team].roster.find((q) => q.id === id);
  if (!p) throw new Error(`Unknown player ${id}`);
  return p;
};

/** The biggest bat in a team's starting nine: the Home Run Derby hitter. */
export function slugger(side) {
  return TEAMS[side].roster.slice(0, 9).reduce((a, b) => (b.power > a.power ? b : a));
}

/** Three derby rivals from a team's position players, weakest bat first (round 1) to strongest (the final). */
export function derbyRivals(side) {
  return TEAMS[side].roster
    .filter((p) => p.position !== 'P')
    .sort((a, b) => b.power - a.power)
    .slice(0, 3)
    .reverse();
}
