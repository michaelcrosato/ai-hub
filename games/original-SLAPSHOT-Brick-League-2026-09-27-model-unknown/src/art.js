import { RINK, Random } from './math.js';
import { TEAMS } from './rosters.js';

/** Everything on the ice and in the stands is a coloured box: x/y/z centre, w/h/d size, Euler (YZX) rotation. */
export function brick(x, y, z, w, h, d, color, ry = 0, rx = 0, rz = 0) { return { x, y, z, w, h, d, color, ry, rx, rz }; }
export const COLORS = { ink: '#173746', navy: '#203e4c', ice: '#effcff', light: '#d4e7e9', coral: '#ff5745', cyan: '#35c7e9', lime: '#f0ff82', yellow: '#ffda73', white: '#ffffff' };

/** The venues. The rink, its rules and its physics are identical; only the building around it changes. */
export const VENUES = {
    brickyard: {
        id: 'brickyard', number: '01', name: 'THE BRICKYARD', title: 'The Brickyard', tagline: 'HOME OF THE HEAVY HITS', board: 'THE BRICKYARD  •  MAKE SOME NOISE',
        background: '#eaf2ef', sky: '#f5ffff', ground: '#8bacba', sun: '#fff6df', fill: '#a7e4ff',
        ice: { base: '#f1fcff', stripe: '#e9f7fb', title: 'BRICK LEAGUE', subtitle: 'SLAPSHOT  /  EST. 2026' },
        scoreboard: { x: 0, y: 8.315, z: -23.64, w: 18.2, h: 5.03 }
    },
    pond: {
        id: 'pond', number: '02', name: 'FROSTBITE POND', title: 'Frostbite Pond', tagline: 'THE NORTH COAST OUTDOOR CLASSIC', board: 'FROSTBITE POND  •  OUTDOOR CLASSIC',
        background: '#e6f0f4', sky: '#f2f8ff', ground: '#9fb6c8', sun: '#ffe7c7', fill: '#b9dcff',
        ice: { base: '#eefaff', stripe: '#e3f4fb', title: 'FROSTBITE POND', subtitle: 'NORTH COAST  /  OUTDOOR CLASSIC' },
        scoreboard: { x: 0, y: 6.25, z: -20.55, w: 14.2, h: 3.92 },
        snow: true
    }
};
export const VENUE_ORDER = ['brickyard', 'pond'];
export const venueOf = (id) => VENUES[id] ?? VENUES.brickyard;

/** Rounded dasher boards are assembled from short, tangent-aligned bricks. */
function dasherBoards(add, colors, posts) {
    const perimeter = [];
    const radius = RINK.corner, ax = RINK.halfLength - radius, az = RINK.halfWidth - radius;
    for (let corner = 0; corner < 4; corner++) {
        const cx = corner === 0 || corner === 3 ? ax : -ax, cz = corner < 2 ? az : -az;
        for (let s = 0; s <= 10; s++) {
            const a = corner * Math.PI / 2 + s / 10 * Math.PI / 2;
            perimeter.push([cx + Math.cos(a) * radius, cz + Math.sin(a) * radius]);
        }
    }
    for (let i = 0; i < perimeter.length; i++) {
        const a = perimeter[i], b = perimeter[(i + 1) % perimeter.length], x = (a[0] + b[0]) / 2, z = (a[1] + b[1]) / 2, len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const angle = -Math.atan2(b[1] - a[1], b[0] - a[0]);
        add(brick(x, .65, z, len + .07, 1.12, .3, colors.board, angle));
        add(brick(x, .14, z, len + .1, .17, .39, colors.kick, angle));
        add(brick(x, 1.25, z, len + .08, .14, .44, colors.cap, angle));
        if (posts && i % 2 === 0 && len < 4)
            add(brick(a[0], 2, a[1], .065, 1.45, .065, colors.post));
    }
}

/** Rink-end goal frames and block-grid nets. */
function goals(add) {
    for (const sign of [-1, 1]) {
        const x = sign * RINK.goal;
        for (const z of [-RINK.goalHalf, RINK.goalHalf]) {
            add(brick(x, .66, z, .13, 1.32, .13, COLORS.coral));
            add(brick(x + sign * .67, .09, z, 1.4, .12, .12, COLORS.coral));
            for (let k = 0; k <= 5; k++)
                add(brick(x + sign * k * .24, .64, z, .032, 1.13, .032, '#a5c4ca'));
        }
        add(brick(x, 1.28, 0, .15, .13, RINK.goalHalf * 2 + .13, COLORS.coral));
        add(brick(x + sign * 1.2, .65, 0, .07, 1.2, 3.1, '#d1e7e8'));
        for (let k = -6; k <= 6; k++)
            add(brick(x + sign * 1.25, .66, k * .245, .035, 1.12, .035, '#729dab'));
        for (let k = 1; k < 5; k++)
            add(brick(x + sign * 1.27, k * .25, 0, .037, .028, 3, '#729dab'));
    }
}

const SKIN = ['#edbe88', '#9e6d50', '#e8a474', '#f6d6ac'];

function buildBrickyard() {
    const out = [], random = new Random(61);
    const add = (b) => { out.push(b); };
    add(brick(0, -1.15, 0, 83, 1.9, 47, '#c1d9db'));
    add(brick(0, -.35, 0, 78, .5, 43, '#e8f1eb'));
    // Four brick-built grandstands.
    for (const sign of [-1, 1]) {
        for (let row = 0; row < 4; row++) {
            const z = sign * (16.2 + row * 1.75), y = .7 + row * .95;
            for (let segment = 0; segment < 31; segment++)
                add(brick(-33.4 + segment * 2.225, y - .45, z, 2.24, .75 + row * .15, 1.7, row % 2 ? '#5b8090' : '#446776'));
            for (let col = 0; col < 30; col++) {
                if (col === 14 || col === 15)
                    continue;
                const x = -32.5 + col * 2.25, side = col < 15 ? 0 : 1, color = random.next() < .17 ? COLORS.yellow : random.next() < .12 ? '#f7fbeb' : TEAMS[side].color;
                add(brick(x, y + .25, z, 1.2, .42, .9, side === 0 ? '#b84139' : '#1c91ae'));
                if (random.next() > .17) {
                    add(brick(x, y + .88, z, .68, .86, .57, color));
                    add(brick(x, y + 1.55, z, .46, .47, .43, SKIN[Math.floor(random.next() * 4)]));
                    if (row % 2 === 0)
                        add(brick(x - .46, y + 1.18, z, .18, .66, .24, color, 0, 0, -.3));
                }
            }
        }
        add(brick(0, 4.1, sign * 22.7, 74, .45, .8, COLORS.navy));
        add(brick(0, 4.4, sign * 22.7, 74, .16, .9, sign < 0 ? COLORS.coral : COLORS.cyan));
    }
    for (const sign of [-1, 1]) {
        for (let row = 0; row < 3; row++) {
            const x = sign * (33.4 + row * 1.65), y = .9 + row * .95;
            for (let segment = 0; segment < 14; segment++)
                add(brick(x, y - .4, -12.5 + segment * 1.925, 1.65, 1 + row * .2, 1.95, '#547b8a'));
            for (let col = 0; col < 13; col++) {
                const z = -12 + col * 2;
                const color = sign < 0 ? COLORS.coral : COLORS.cyan;
                add(brick(x, y + .1, z, .9, .4, 1.15, sign < 0 ? '#a83d35' : '#1c90aa'));
                if (random.next() > .18) {
                    add(brick(x, y + .8, z, .58, .85, .6, random.next() > .2 ? color : COLORS.yellow));
                    add(brick(x, y + 1.42, z, .44, .45, .45, '#eab68a'));
                }
            }
        }
    }
    dasherBoards(add, { board: '#f8ffff', kick: '#efc953', cap: '#304e59', post: '#86aeb6' }, true);
    // Team benches and penalty boxes, safely outside the playing surface.
    for (const sign of [-1, 1]) {
        add(brick(sign * 10, .6, -14.5, 8.4, 1.15, 2.3, sign < 0 ? '#cf4940' : '#259ec0'));
        add(brick(sign * 10, 1.22, -14.5, 8.5, .13, 2.4, COLORS.white));
    }
    goals(add);
    // Back-wall video board, light gantries, and giant pennants.
    add(brick(0, 8.3, -24.2, 19, 5.5, 1, '#16313e'));
    add(brick(0, 5.55, -24.2, 20, .24, 1.5, COLORS.coral));
    for (const x of [-24, 24]) {
        add(brick(x, 7.2, -23.5, .5, 6.7, .5, '#355967'));
        add(brick(x, 10.6, -22.7, 7, .4, .6, '#23434f'));
        for (let j = -2; j <= 2; j++)
            add(brick(x + j * 1.25, 10.3, -22.1, .85, .5, .7, '#ffffda'));
        add(brick(x, 7.8, -23.2, 4.7, 4.8, .12, x < 0 ? COLORS.coral : COLORS.cyan));
        add(brick(x, 7.8, -23, .4, 3.3, .1, COLORS.lime, 0, 0, -.35));
    }
    return out;
}

/** A snowy pine: a trunk and four shrinking tiers, each wearing a snow cap. */
function pine(add, x, z, size, random) {
    const s = size, base = -.2, green = random.next() > .5 ? '#2f6f5b' : '#3b7d63', dark = '#285c4c';
    add(brick(x, base + .55 * s, z, .45 * s, 1.1 * s, .45 * s, '#7a5236'));
    for (let tier = 0; tier < 4; tier++) {
        const w = (2.5 - tier * .55) * s, y = base + (1.25 + tier * .8) * s;
        add(brick(x, y, z, w, .62 * s, w, tier % 2 ? dark : green, tier * .38));
        add(brick(x, y + .36 * s, z, w * .78, .14 * s, w * .78, '#f7fcff', tier * .38));
    }
    add(brick(x, base + 4.55 * s, z, .3 * s, .35 * s, .3 * s, '#f7fcff'));
}

/** A bundled-up fan on a snowbank: boots, coat, scarf, face, beanie with a pom-pom. */
function fan(add, x, y, z, team, random, facing = 0) {
    const coat = random.next() < .2 ? COLORS.yellow : TEAMS[team].color, scarf = random.next() > .5 ? TEAMS[team].accent : '#f7fbeb';
    add(brick(x, y + .22, z, .5, .44, .4, '#2c3f4a', facing));
    add(brick(x, y + .8, z, .7, .78, .56, coat, facing));
    add(brick(x, y + 1.25, z, .6, .16, .58, scarf, facing));
    add(brick(x, y + 1.55, z, .44, .44, .42, SKIN[Math.floor(random.next() * 4)], facing));
    add(brick(x, y + 1.84, z, .5, .2, .48, team === 0 ? TEAMS[0].dark : TEAMS[1].dark, facing));
    add(brick(x, y + 2.02, z, .16, .16, .16, '#ffffff', facing));
    if (random.next() > .55)
        add(brick(x + .42, y + 1.3, z, .16, .62, .2, coat, facing, 0, -.35));
}

/** Frostbite Pond: an outdoor rink on a frozen pond, ringed by snowbanks, pines, a warming hut and a wooden scoreboard. */
function buildPond() {
    const out = [], random = new Random(77);
    const add = (b) => { out.push(b); };
    // Snowfield, the icy shoreline of the pond, and the frozen surface the rink sits on.
    add(brick(0, -1.15, 0, 83, 1.9, 47, '#dfeef3'));
    add(brick(0, -.36, 0, 72, .5, 35.5, '#bfe0ec'));
    add(brick(0, -.33, 0, 69, .5, 33, '#d8eef5'));
    dasherBoards(add, { board: '#e2b07a', kick: '#8a5a3a', cap: '#5c3b26', post: '#5c3b26' }, true);
    // Snowbanks shovelled against the boards, lumpy on purpose.
    for (const sign of [-1, 1]) {
        for (let i = 0; i < 26; i++) {
            const x = -31 + i * 2.48 + random.between(-.3, .3), h = random.between(.7, 1.5);
            if (sign < 0 && Math.abs(x) > 4.5 && Math.abs(x) < 15.5)
                continue; // keep the benches clear
            add(brick(x, h / 2 - .1, sign * random.between(14.6, 15.4), random.between(2.4, 3.4), h, random.between(1.4, 2.1), random.next() > .3 ? '#f5fbfd' : '#e4f1f6', random.between(-.2, .2)));
        }
        for (let i = 0; i < 10; i++) {
            const z = -11 + i * 2.45 + random.between(-.2, .2), h = random.between(.7, 1.4);
            add(brick(sign * random.between(32.3, 33.1), h / 2 - .1, z, random.between(1.4, 2), h, random.between(2.4, 3.1), random.next() > .3 ? '#f5fbfd' : '#e4f1f6', random.between(-.15, .15)));
        }
    }
    // Fans along both long sides (the far side stands on a higher bank) and the two ends.
    for (const sign of [-1, 1]) {
        const z = sign * 16.8, y = sign < 0 ? .5 : -.1;
        if (sign < 0)
            add(brick(-2, .2, -16.9, 38, .7, 2.6, '#eef7fa'));
        for (let col = 0; col < 26; col++) {
            if (col >= 11 && col <= 14 && sign > 0)
                continue;
            if (random.next() > .78)
                continue;
            const x = -30 + col * 2.4 + random.between(-.35, .35);
            if (sign < 0 && (x < -20 || x > 17))
                continue; // the warming hut and the cocoa stand stand here
            fan(add, x, y, z + random.between(-.35, .35), x < 0 ? 0 : 1, random, random.between(-.3, .3));
        }
    }
    for (const sign of [-1, 1]) {
        for (let i = 0; i < 6; i++) {
            if (random.next() > .8)
                continue;
            fan(add, sign * 34.3, -.1, -8 + i * 3.2 + random.between(-.4, .4), sign < 0 ? 0 : 1, random, Math.PI / 2 + random.between(-.3, .3));
        }
    }
    // Pine forest behind the far side and around the ends.
    for (let i = 0; i < 14; i++)
        pine(add, -36 + i * 5.5 + random.between(-1.2, 1.2), -21 - random.between(0, 2.6), random.between(1.05, 1.55), random);
    for (const sign of [-1, 1])
        for (let i = 0; i < 4; i++)
            pine(add, sign * random.between(37.5, 39.5), -14 + i * 7.5 + random.between(-1, 1), random.between(.95, 1.35), random);
    // Warming hut: log walls, glowing windows, a snowy roof and a chimney.
    const hx = -25, hz = -18.4;
    for (let row = 0; row < 6; row++)
        for (const side of [-1, 1])
            add(brick(hx, .1 + row * .4, hz + side * 1.6, 6.2, .38, .38, row % 2 ? '#8d5b38' : '#a36c45'));
    for (let row = 0; row < 6; row++)
        for (const side of [-1, 1])
            add(brick(hx + side * 2.95, .1 + row * .4, hz, .38, .38, 3.6, row % 2 ? '#a36c45' : '#8d5b38'));
    add(brick(hx + 1.4, .9, hz + 1.82, 1.1, 1.8, .1, '#5c3b26'));
    add(brick(hx - 1.5, 1.45, hz + 1.82, 1.2, .8, .1, '#ffe08a'));
    add(brick(hx - 1.5, 1.45, hz + 1.86, .1, .8, .06, '#5c3b26'));
    add(brick(hx, 2.85, hz + .95, 6.9, .22, 2.4, '#6b4430', 0, .5));
    add(brick(hx, 2.85, hz - .95, 6.9, .22, 2.4, '#6b4430', 0, -.5));
    add(brick(hx, 3.0, hz + .98, 6.9, .14, 2.3, '#f7fcff', 0, .5));
    add(brick(hx, 3.0, hz - .98, 6.9, .14, 2.3, '#f7fcff', 0, -.5));
    add(brick(hx + 2, 3.6, hz - .6, .6, 1.4, .6, '#7b8d96'));
    add(brick(hx + 2, 4.35, hz - .6, .7, .14, .7, '#f7fcff'));
    // Wooden scoreboard on two posts (the score canvas hangs on its face).
    for (const x of [-6.4, 6.4]) {
        add(brick(x, 2.4, -20.9, .45, 4.8, .45, '#6b4430'));
        add(brick(x, .25, -20.9, 1.2, .5, 1.2, '#f5fbfd'));
    }
    add(brick(0, 6.25, -20.9, 15, 4.5, .5, '#5c3b26'));
    add(brick(0, 8.62, -20.9, 15.6, .26, .9, '#f7fcff'));
    add(brick(0, 3.88, -20.6, 15, .2, .3, COLORS.lime));
    // Benches and penalty boxes, rebuilt in planks.
    for (const sign of [-1, 1]) {
        add(brick(sign * 10, .55, -14.5, 8.4, 1.05, 2.3, sign < 0 ? '#c9574a' : '#2f9fbe'));
        add(brick(sign * 10, 1.13, -14.5, 8.5, .13, 2.4, '#e2b07a'));
    }
    goals(add);
    // Bunting strung between poles over the far boards, in both teams' colours.
    const flags = [COLORS.coral, COLORS.yellow, COLORS.cyan, COLORS.lime];
    for (const x of [-30, -10, 10, 30])
        add(brick(x, 2.4, -17.9, .22, 4.8, .22, '#6b4430'));
    for (let span = 0; span < 3; span++) {
        const x0 = -30 + span * 20;
        for (let k = 1; k < 16; k++) {
            const t = k / 16, x = x0 + t * 20, y = 4.6 - Math.sin(t * Math.PI) * 1.1;
            add(brick(x, y - .2, -17.9, .5, .45, .06, flags[(k + span) % 4], 0, 0, Math.PI / 4));
        }
    }
    // Fire barrels at the near corners, a hot cocoa stand and a snowman fan.
    for (const x of [-27.5, 27.5]) {
        add(brick(x, .6, 16.2, 1.1, 1.2, 1.1, '#3d5560'));
        add(brick(x, 1.25, 16.2, 1.15, .12, 1.15, '#2a3b44'));
        add(brick(x, 1.5, 16.2, .7, .5, .7, '#ff8a3d', .4));
        add(brick(x + .1, 1.85, 16.15, .4, .45, .4, '#ffd166', .9));
    }
    add(brick(21, .6, -17.6, 3.2, 1.2, 1.4, '#c9574a'));
    add(brick(21, 1.28, -17.6, 3.4, .14, 1.6, '#f7fcff'));
    add(brick(21, 2.3, -18.2, 3.6, .2, 1.2, '#ffda73', 0, -.3));
    for (const x of [19.6, 22.4])
        add(brick(x, 1.7, -18.2, .14, 1.2, .14, '#6b4430'));
    const sx = 31.8, sz = 13.6;
    add(brick(sx, .55, sz, 1.4, 1.1, 1.4, '#ffffff'));
    add(brick(sx, 1.45, sz, 1.05, .8, 1.05, '#ffffff', .2));
    add(brick(sx, 2.15, sz, .75, .65, .75, '#ffffff', .1));
    add(brick(sx - .5, 2.15, sz + .1, .38, .1, .1, '#ff8a3d', -.4));
    add(brick(sx, 2.58, sz, .85, .12, .85, '#203e4c'));
    add(brick(sx, 2.85, sz, .55, .45, .55, '#203e4c'));
    add(brick(sx, 1.85, sz, .9, .15, .9, COLORS.cyan, .2));
    return out;
}

const BUILDERS = { brickyard: buildBrickyard, pond: buildPond };
/** The static scenery for a venue, as a flat list of bricks. */
export function buildArena(venue = 'brickyard') {
    return (BUILDERS[venue] ?? buildBrickyard)();
}

/**
 * Dynamic bricks are written straight into the renderer's instance buffer through
 * emit(x, y, z, w, h, d, color, ry, rx, rz): no objects are created per frame.
 */
export function emitSkater(p, time, emit) {
    const t = TEAMS[p.team], skin = ['#f3c695', '#b78056', '#e9ad76', '#8b5a42'][p.id % 4];
    const a = p.angle, cs = Math.cos(a), sn = Math.sin(a), down = p.stun > 0;
    const scale = 1.22, bodyY = down ? -.55 : 0, px = p.x, pz = p.z;
    const add = (x, y, z, w, h, d, color, rx = 0, rz = 0) => {
        emit(px + (x * cs + z * sn) * scale, (y + bodyY) * scale, pz + (-x * sn + z * cs) * scale, w * scale, h * scale, d * scale, color, a, rx, rz);
    };
    const stride = p.turbo ? .28 : .18, leg = Math.sin(p.skating * 1.7) * stride;
    for (let sign = -1; sign <= 1; sign += 2) {
        const z = down ? .2 : sign * leg;
        add(sign * .26, .15, z + .08, .35, .23, .65, '#183442');
        add(sign * .26, .025, z + .1, .08, .06, .72, '#a8bac4');
        add(sign * .25, .44, z, p.goalie ? .52 : .29, .49, p.goalie ? .37 : .32, p.goalie ? '#f0f8e9' : t.color);
        add(sign * .25, .38, z + .01, p.goalie ? .53 : .3, .1, p.goalie ? .38 : .34, t.accent);
    }
    add(0, .76, 0, .83, .35, .5, '#1b3644');
    add(0, 1.15, 0, 1.01, .69, .59, t.color);
    add(0, .87, .01, 1.03, .15, .61, t.accent);
    add(0, 1.48, -.015, 1.25, .25, .6, t.color);
    // Stylized team crest on the chest.
    add(0, 1.21, .31, .26, .28, .03, t.accent, 0, -.25);
    add(0, 1.89, .015, .54, .5, .52, skin);
    add(0, 2.13, -.015, .7, .3, .7, p.goalie ? '#f0fcff' : t.color);
    add(0, 2.29, -.06, .36, .09, .4, p.goalie ? '#a9c4cf' : t.accent);
    add(0, 1.98, .31, .57, .095, .035, '#163643');
    add(-.65, 1.16, .12, .28, .54, .33, t.color, -.3);
    add(.65, 1.15, .27, .29, .56, .34, t.color, -.45);
    add(-.65, .84, .25, p.goalie ? .55 : .31, p.goalie ? .46 : .29, .37, p.goalie ? '#edf1de' : t.dark);
    add(.67, .82, .48, p.goalie ? .4 : .32, .32, .35, p.goalie ? '#eff5e2' : t.dark);
    if (p.charge > .3) {
        add(.74, 1.1 + p.charge * .45, .83, .08, 1.6, .08, '#263f48', -.7);
        add(.74, 1.7 + p.charge * .45, 1.43, .65, .12, .12, '#263f48');
    }
    else {
        add(.73, .68, .78, .08, 1.18, .08, '#35545d', .53);
        add(.52, .135, 1.12, .64, .13, .17, '#17323b');
        add(.26, .137, 1.12, .18, .145, .18, '#e5eee6');
    }
    if (down) {
        for (let i = 0; i < 3; i++) {
            const rot = time * 4 + i * Math.PI * 2 / 3;
            emit(px + Math.cos(rot) * .8, 2.4, pz + Math.sin(rot) * .8, .22, .16, .22, '#ffdf57', rot, 0, 0);
        }
    }
}

const CONFETTI = [COLORS.coral, COLORS.cyan, COLORS.lime, COLORS.yellow];
const MARKER = ['#edff7b', '#ffb13b'];

/**
 * Every moving brick for this frame: skaters, the puck, turbo spray, the Heatseeker
 * trail, goal confetti, falling snow and the floating marker over each human's skater.
 * opts: { snow: count, confetti: count }
 */
export function emitDynamic(game, emit, opts) {
    const visual = game.visual(), time = game.time;
    for (const p of visual.players)
        emitSkater(p, time, emit);
    const puck = visual.puck;
    emit(puck.x, puck.y + .015, puck.z, .42, .17, .42, '#0e2636', time * 2, 0, 0);
    for (const p of visual.players)
        if (p.turbo && p.stun <= 0) {
            for (let i = 0; i < 4; i++) {
                const t = (time * 6 + i * .27) % 1;
                emit(p.x - Math.sin(p.angle) * t * 2 + Math.sin(i * 4) * .6, .1 + Math.sin(t * Math.PI) * .45, p.z - Math.cos(p.angle) * t * 2 + Math.cos(i * 4) * .6, .1 + t * .2, .1, .22, '#bcf4ff', t * 4, 0, 0);
            }
        }
    if (game.fireTime > 0) {
        const v = game.puck.velocity, speed = Math.hypot(v.x, v.z) || 1;
        for (let i = 1; i < 9; i++)
            emit(puck.x - v.x / speed * i * .25, .2 + (i % 2) * .12, puck.z - v.z / speed * i * .25, .23 + i * .025, .3, .23, i % 2 ? '#ffae3f' : '#fff181', time * 3 + i, 0, 0);
    }
    if (game.phase === 'goal' || game.phase === 'final') {
        for (let i = 0; i < opts.confetti; i++) {
            const t = (time * .7 + i * .71) % 4;
            emit(Math.sin(i * 2.17) * 27, 9 - t * 2, Math.cos(i * 1.4) * 12, .22, .09, .42, CONFETTI[i % 4], i + t, t * 2, 0);
        }
    }
    if (opts.snow > 0) {
        // Deterministic flakes: each drifts down its own column and wraps back to the top.
        const clock = opts.clock;
        for (let i = 0; i < opts.snow; i++) {
            const speed = 1.1 + (i * .618 % 1) * .9, fall = (clock * speed + i * 1.37) % 14;
            const x = (i * 37.71 % 84) - 42 + Math.sin(clock * .6 + i) * .9, z = (i * 23.29 % 50) - 25 + Math.cos(clock * .45 + i * 1.3) * .6;
            const size = .09 + (i % 5) * .018;
            emit(x, 13 - fall, z, size, size, size, '#ffffff', clock * .8 + i, i, 0);
        }
    }
    // A floating chevron marks each human's controlled skater (lime for P1, orange for P2).
    if (game.phase !== 'attract' && game.phase !== 'replay' && game.phase !== 'final') {
        for (let team = 0; team < 2; team++) {
            if (!game.isHuman(team))
                continue;
            const p = game.players[game.selected[team]];
            if (!p?.active || p.goalie)
                continue;
            const color = MARKER[team === game.settings.team ? 0 : 1], bob = Math.sin(time * 5) * .12;
            emit(p.x, 3.55 + bob, p.z, .62, .16, .62, color, Math.PI / 4, 0, 0);
            emit(p.x, 3.32 + bob, p.z, .36, .16, .36, color, Math.PI / 4, 0, 0);
            emit(p.x, 3.12 + bob, p.z, .14, .14, .14, color, Math.PI / 4, 0, 0);
        }
    }
}

/** Paint the rink markings (into `canvas` when given; resizing it also clears it). */
export function rinkCanvas(venue = 'brickyard', canvas = document.createElement('canvas')) {
    const v = venueOf(venue).ice;
    canvas.width = 2440;
    canvas.height = 1040;
    const c = canvas.getContext('2d');
    c.scale(40, 40);
    c.translate(RINK.halfLength, RINK.halfWidth);
    const path = () => { c.beginPath(); c.roundRect(-30.5, -13, 61, 26, 8.5); };
    path();
    c.fillStyle = v.base;
    c.fill();
    c.save();
    path();
    c.clip();
    c.fillStyle = v.stripe;
    for (let x = -29; x < 30; x += 4)
        c.fillRect(x, -13, 2, 26);
    const stroke = (color, width) => { c.strokeStyle = color; c.lineWidth = width; };
    const line = (x1, z1, x2, z2) => { c.beginPath(); c.moveTo(x1, z1); c.lineTo(x2, z2); c.stroke(); };
    const circle = (x, z, r) => { c.beginPath(); c.arc(x, z, r, 0, Math.PI * 2); c.stroke(); };
    stroke('#ee7174', .14);
    line(0, -13, 0, 13);
    stroke('#3c9ac8', .3);
    line(-RINK.blue, -13, -RINK.blue, 13);
    line(RINK.blue, -13, RINK.blue, 13);
    stroke('#6ab3d4', .12);
    circle(0, 0, 4.57);
    for (const side of [-1, 1]) {
        stroke('#e78588', .13);
        line(side * RINK.goal, -12, side * RINK.goal, 12);
        for (const z of [-RINK.dotZ, RINK.dotZ]) {
            circle(side * RINK.faceoff, z, 4.57);
            c.beginPath();
            c.arc(side * RINK.faceoff, z, .28, 0, Math.PI * 2);
            c.fillStyle = '#df6c76';
            c.fill();
            for (const sign of [-1, 1]) {
                line(side * RINK.faceoff + sign * .6, z - .8, side * RINK.faceoff + sign * .6, z + .8);
            }
            c.beginPath();
            c.arc(side * (RINK.blue - 1.5), z, .25, 0, Math.PI * 2);
            c.fill();
        }
        c.fillStyle = '#b3e6f4';
        c.beginPath();
        c.ellipse(side * RINK.goal, 0, 1.83, 2.1, 0, Math.PI / 2, Math.PI * 1.5, side < 0);
        c.closePath();
        c.fill();
        c.stroke();
        // Goalie trapezoid.
        line(side * RINK.goal, -3.35, side * 30.5, -4.25);
        line(side * RINK.goal, 3.35, side * 30.5, 4.25);
    }
    c.save();
    c.rotate(-Math.PI / 2);
    c.fillStyle = '#b7d1da';
    c.font = `900 ${v.title.length > 12 ? 1.3 : 1.65}px Arial`;
    c.textAlign = 'center';
    c.fillText(v.title, 0, -.4);
    c.font = 'bold .7px Arial';
    c.fillText(v.subtitle, 0, 1);
    c.restore();
    c.fillStyle = '#6aa5ba';
    c.beginPath();
    c.arc(0, 0, .25, 0, Math.PI * 2);
    c.fill();
    c.font = '900 1.3px Arial';
    c.textAlign = 'center';
    c.fillStyle = '#e7b9b6';
    c.fillText('BRING THE HEAT', -15.5, .5);
    c.fillStyle = '#a4cfde';
    c.fillText('STAY FROSTY', 15.5, .5);
    // Faint skate scratches make the surface feel like ice, without external textures.
    const random = new Random(501);
    stroke('#dceef2', .018);
    for (let i = 0; i < 200; i++) {
        const x = random.between(-28, 28), z = random.between(-12, 12);
        line(x, z, x + random.between(.3, 2), z + .2);
    }
    if (venue === 'pond') {
        // Natural ice: pale frost patches and a few hairline cracks.
        const frost = new Random(902);
        c.fillStyle = '#f7fdff';
        for (let i = 0; i < 26; i++) {
            c.globalAlpha = .35;
            c.beginPath();
            c.ellipse(frost.between(-28, 28), frost.between(-11, 11), frost.between(.8, 2.6), frost.between(.4, 1.3), frost.between(0, 3), 0, Math.PI * 2);
            c.fill();
        }
        c.globalAlpha = 1;
        stroke('#cfe6ee', .03);
        for (let i = 0; i < 14; i++) {
            let x = frost.between(-27, 27), z = frost.between(-11, 11);
            c.beginPath();
            c.moveTo(x, z);
            for (let k = 0; k < 4; k++) {
                x += frost.between(-1.6, 1.6);
                z += frost.between(-1.1, 1.1);
                c.lineTo(x, z);
            }
            c.stroke();
        }
    }
    c.restore();
    return canvas;
}

export function scoreboardCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    return canvas;
}

export function paintScoreboard(canvas, game, venue = 'brickyard') {
    const c = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
    c.fillStyle = venue === 'pond' ? '#2a2018' : '#122e3c';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#efff82';
    c.font = 'bold 23px Arial';
    c.textAlign = 'center';
    c.fillText(venueOf(venue).board, w / 2, 37);
    c.fillStyle = '#ff6453';
    c.font = '900 52px Arial';
    c.fillText('INFERNO', 195, 128);
    c.fillStyle = '#51d9f4';
    c.fillText('FROSTBITE', 823, 128);
    c.fillStyle = '#ffffff';
    c.font = '900 91px Arial';
    c.fillText(`${game.score[0]} : ${game.score[1]}`, 512, 144);
    c.fillStyle = '#a2c0cd';
    c.font = 'bold 27px Arial';
    const shootout = game.phase === 'duel' || game.phase === 'duel-result' || game.phase === 'shootout-intro';
    c.fillText(game.phase === 'attract' ? 'BIG HITS. BRIGHT LIGHTS.' : shootout ? (game.duelIsShootout ? 'SHOOTOUT' : 'PENALTY SHOT') : `${game.overtime ? 'OVERTIME' : 'PERIOD ' + game.period}  •  ${Math.floor(game.clock / 60)}:${Math.floor(game.clock % 60).toString().padStart(2, '0')}`, 512, 213);
}
