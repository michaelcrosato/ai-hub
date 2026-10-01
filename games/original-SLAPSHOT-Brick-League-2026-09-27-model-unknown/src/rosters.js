const ember = [
    ['Jax Rocket', 9, 'C', 94, 96, 80, 94, 'The spark plug'], ['Nico Blaze', 17, 'LW', 96, 90, 76, 91, 'Breakaway artist'], ['Kai Riff', 88, 'RW', 88, 98, 82, 92, 'Top-shelf specialist'],
    ['Milo Dash', 12, 'C', 91, 85, 78, 89, 'Playmaker'], ['Finn Sparks', 24, 'LW', 93, 86, 79, 85, 'Quick release'], ['Remy Rush', 71, 'RW', 88, 89, 88, 84, 'Power forward'],
    ['Ash Sterling', 19, 'C', 86, 84, 89, 90, 'Two-way engine'], ['Axel Brick', 44, 'LW', 80, 86, 98, 80, 'The wrecking ball'], ['Leo Voltage', 7, 'RW', 95, 83, 80, 86, 'Speed merchant'],
    ['Cruz Flint', 29, 'C', 84, 80, 93, 85, 'Faceoff ace'], ['Bo Thunder', 55, 'LW', 79, 81, 97, 78, 'Heavy hitter'], ['Zane Fury', 13, 'RW', 87, 85, 91, 81, 'Forecheck menace'],
    ['Rex Stone', 4, 'LD', 85, 90, 97, 87, 'The wall'], ['Drew Cannon', 27, 'RD', 87, 95, 90, 86, 'Point cannon'], ['Tate Forge', 6, 'LD', 83, 84, 94, 84, 'Shutdown defender'], ['Cole Copper', 22, 'RD', 89, 85, 88, 89, 'Puck mover'], ['Oz Atlas', 32, 'LD', 79, 81, 99, 80, 'Immovable object'], ['Beau Ember', 64, 'RD', 88, 82, 88, 85, 'Rookie rocket'],
    ['Max Firewall', 30, 'G', 90, 30, 87, 96, 'The last line'], ['Eli Lock', 35, 'G', 87, 25, 85, 91, 'Cool under fire']
];
const frost = [
    ['Luca Frost', 10, 'C', 95, 91, 82, 98, 'Ice-cold captain'], ['Theo Glacier', 91, 'LW', 91, 96, 83, 91, 'Sniper'], ['Ace Alpine', 16, 'RW', 98, 87, 76, 92, 'Pure acceleration'],
    ['Noah Drift', 21, 'C', 92, 87, 81, 94, 'Silky hands'], ['Felix Snow', 11, 'LW', 89, 92, 83, 88, 'Net-front finisher'], ['Hugo Chill', 77, 'RW', 90, 90, 89, 85, 'Big-game player'],
    ['Arlo Blue', 18, 'C', 88, 85, 89, 92, 'Two-way wizard'], ['Sven North', 63, 'LW', 86, 88, 94, 83, 'Glacier force'], ['Enzo Ice', 8, 'RW', 97, 84, 79, 89, 'Fast lane'],
    ['Ivo Polar', 25, 'C', 85, 81, 93, 87, 'Draw specialist'], ['Otto Block', 46, 'LW', 80, 83, 99, 78, 'Brick house'], ['Benji Breeze', 14, 'RW', 93, 84, 86, 84, 'Relentless motor'],
    ['Viktor Peak', 5, 'LD', 84, 92, 98, 85, 'Blue-line boss'], ['Lars Current', 28, 'RD', 91, 91, 88, 92, 'Offensive dynamo'], ['Nils Ridge', 3, 'LD', 87, 86, 93, 86, 'Stay-at-home'], ['Otis Zero', 26, 'RD', 86, 89, 94, 84, 'Point patrol'], ['Silas Berg', 52, 'LD', 82, 84, 96, 82, 'Penalty killer'], ['Jude Flux', 72, 'RD', 92, 88, 82, 89, 'Young gun'],
    ['Henrik Freeze', 31, 'G', 94, 28, 89, 97, 'Absolute zero'], ['Ollie Vault', 40, 'G', 89, 25, 86, 92, 'Safe hands']
];
const make = (list, team) => list.map((p, i) => ({ id: team * 20 + i, name: p[0], number: p[1], position: p[2], speed: p[3], shot: p[4], check: p[5], skill: p[6], style: p[7] }));
export const TEAMS = [
    { id: 0, city: 'EMBER CITY', name: 'INFERNO', abbr: 'INF', color: '#ff5745', dark: '#ad2d30', accent: '#ffe982', motto: 'Bring the heat.', roster: make(ember, 0) },
    { id: 1, city: 'NORTH COAST', name: 'FROSTBITE', abbr: 'FRO', color: '#35c7e9', dark: '#167ba5', accent: '#e0fcff', motto: 'Cold. Blooded.', roster: make(frost, 1) }
];
export const playerById = (id) => TEAMS[id < 20 ? 0 : 1].roster[id % 20];
