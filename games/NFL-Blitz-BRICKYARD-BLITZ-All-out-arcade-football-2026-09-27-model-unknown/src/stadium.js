// The Brickyard: every stadium brick and painted decal, plus the block-built players.
// Pure data: render.js turns it into three.js meshes. Coordinates are world units (yards),
// x across the field, z along it (end zones at z = ±50..60), y up.
import { Random } from './model.js';
import { TEAMS } from './data.js';

export function buildStadium() {
    const boxes = [], decals = [];
    const rng = new Random(10337);
    // fan: seat index for crowd bricks (body and head share one), so the crowd can jump together.
    const b = (x, y, z, w, h, d, color, fan = -1) => boxes.push({ x, y, z, w, h, d, color, fan });
    let seat = 0;
    const text = (text, x, y, z, size, color = '#ffffff', rotation = 0, ground = true) => decals.push({ text, x, y, z, size, color, rotation, ground });
    // Layered brick plinth, concourse, and regulation 120 x 53 1/3 yard surface.
    b(0, -3.6, 0, 106, 5, 157, '#254859');
    b(0, -1.7, 0, 84, 2, 144, '#638391');
    b(0, -0.7, 0, 67, 1.4, 134, '#e4ead6');
    b(0, -0.1, 0, 53.333, 0.24, 120, '#2b9a59');
    for (let z = -47.5; z < 50; z += 5)
        b(0, 0.04, z, 53.333, 0.08, 5, Math.round(z + 47.5) % 10 === 0 ? '#3fac68' : '#379f5e');
    b(0, 0.08, -55, 53.333, 0.09, 10, '#f36537');
    b(0, 0.08, 55, 53.333, 0.09, 10, '#24aebf');
    for (const x of [-26.667, 26.667])
        b(x, 0.13, 0, 0.45, 0.08, 120.8, '#f3f4d9');
    for (const z of [-60, -50, 50, 60])
        b(0, 0.14, z, 53.7, 0.08, 0.36, '#f3f4d9');
    for (let z = -45; z <= 45; z += 5)
        b(0, 0.16, z, 53.333, 0.035, 0.14, '#d6efcc');
    for (let z = -49; z < 50; z++) {
        if (z % 5 === 0)
            continue;
        for (const x of [-25.9, -3.083, 3.083, 25.9])
            b(x, 0.16, z, 0.66, 0.025, 0.13, '#d6efcc');
    }
    for (let z = -40; z <= 40; z += 10)
        for (const x of [-18.2, 18.2]) {
            const n = 50 - Math.abs(z);
            text(String(n), x, 0.2, z, 3.4, '#e3efce', x < 0 ? Math.PI / 2 : -Math.PI / 2);
        }
    text('I N F E R N O', 0, 0.21, -55, 4.5, '#ffead1');
    text('F R O S T B I T E', 0, 0.21, 55, 3.8, '#e5ffff', Math.PI);
    // Center-field mark: block B and a yellow lightning slash.
    b(0, 0.17, 0, 10.5, 0.035, 12, '#254f4a');
    text('B', 0, 0.22, -0.2, 11, '#f0ead0', 0);
    // The slash sits just under the painted B (the software renderer drew every decal over the turf).
    for (let i = 0; i < 4; i++)
        b(-3 + i * 2, 0.19, -4 + i * 2.3, 3, 0.03, 1.35, '#ffe17b');
    for (const x of [-26.35, 26.35])
        for (const z of [-50, 50])
            b(x, 0.48, z, 0.32, 0.75, 0.32, '#ff742e');
    // Goal posts: NFL 18 ft 6 in opening, 10 ft crossbar. Chunky arcade construction.
    for (const side of [-1, 1]) {
        b(0, 1.6, side * 61.3, 0.58, 3.2, 0.58, '#f4d94a');
        b(0, 3.2, side * 60.55, 0.58, 0.38, 2, '#f4d94a');
        b(0, 3.333, side * 60, 6.62, 0.35, 0.36, '#ffe775');
        for (const x of [-3.083, 3.083])
            b(x, 8.4, side * 60, 0.36, 10.4, 0.36, '#ffe775');
        b(0, 0.65, side * 61.3, 1, 1.3, 1, '#223b51');
    }
    // Field walls, LED ribbons and end-zone advertising.
    for (const side of [-1, 1]) {
        b(side * 31, 1.15, 0, 0.85, 2.3, 128, '#1c354b');
        b(side * 31, 2.36, 0, 1, 0.17, 128, '#c1d4bd');
        for (let z = -56; z < 65; z += 14)
            b(side * 30.5, 1.1, z, 0.1, 1.3, 10, z % 28 === 0 ? '#ff7338' : '#39c8d0');
        for (const z of [-64, 64])
            b(0, 1.3, z, 62, 2.6, 1, '#1b344a');
        // Tiered stands. Repeated blue, orange and cyan bricks form the audience.
        for (let row = 0; row < 5; row++) {
            const x = side * (35 + row * 3), y = 2 + row * 1.8;
            b(x, y - 0.4, 0, 3, 1.5, 134, '#42677c');
            b(x, y + 0.4, 0, 3.2, 0.18, 134, '#7fa7ae');
            for (let z = -62; z <= 62; z += 3.35) {
                if (Math.abs(z % 30) < 2)
                    continue;
                const col = rng.next() < 0.12 ? '#ffe4a1' : rng.next() < 0.5 ? '#fa763f' : rng.next() < 0.5 ? '#36c5d3' : '#284f69';
                b(x, y + 0.9, z, 1.35, 0.9, 1.2, col, seat);
                b(x, y + 1.62, z, 0.67, 0.65, 0.65, rng.next() < 0.5 ? '#e2ac79' : '#916849', seat++);
            }
        }
        for (let row = 0; row < 5; row++) {
            const z = side * (68 + row * 3), y = 2 + row * 1.8;
            b(0, y - 0.4, z, 67, 1.5, 3, '#42677c');
            b(0, y + 0.4, z, 67, 0.18, 3.2, '#7fa7ae');
            for (let x = -29; x <= 29; x += 3.4) {
                if (Math.abs(x) < 4 && side === 1)
                    continue;
                const col = rng.next() < 0.4 ? '#fa763f' : rng.next() < 0.7 ? '#36c5d3' : '#ffe0a3';
                b(x, y + 0.9, z, 1.25, 0.9, 1.25, col, seat);
                b(x, y + 1.62, z, 0.65, 0.65, 0.65, '#d6a67c', seat++);
            }
        }
        b(side * 48.4, 11.9, 0, 1.1, 1.4, 138, side === 1 ? '#ff703c' : '#42cdd6');
        b(0, 11.9, side * 82, 97, 1.4, 1.1, side === 1 ? '#ff703c' : '#42cdd6');
        // Team benches, drinks and chain crew.
        b(side * 29, 0.7, -15, 1.8, 0.55, 12, '#ece5ca');
        b(side * 29, 0.7, 15, 1.8, 0.55, 12, '#ece5ca');
        for (const z of [-22, 22]) {
            b(side * 29, 1, z, 1.1, 2, 1.1, '#ff8147');
            b(side * 29, 2.15, z, 1.3, 0.3, 1.3, '#eeeecc');
        }
    }
    // Scoreboard and two support towers.
    for (const x of [-11, 11])
        b(x, 12.8, 76, 1.4, 14, 1.8, '#203b51');
    b(0, 18.8, 75, 29, 11, 2, '#122b42');
    b(0, 24.5, 75, 31, 0.7, 2.3, '#ffe17b');
    text('BRICKYARD', 0, 21.5, 73.8, 2.4, '#ffe17b', 0, false);
    text('B L I T Z', 0, 17.7, 73.8, 3.2, '#f1efdb', 0, false);
    // Four floodlight rigs and structural stair blocks.
    for (const x of [-47, 47])
        for (const z of [-64, 64]) {
            b(x, 14, z, 1.1, 28, 1.1, '#b9cbd0');
            b(x, 28.5, z, 10, 3.5, 1.2, '#244456');
            for (let i = -3; i <= 3; i += 2)
                for (const y of [27.5, 29.1])
                    b(x + i, y, z - 0.7, 1.45, 1.12, 0.3, '#fff5c7');
        }
    for (let i = 0; i < 14; i++) {
        const x = rng.range(-110, 110), z = rng.range(95, 145), h = rng.range(6, 27);
        b(x, h / 2 - 2, z, rng.range(8, 15), h, 9, i % 2 ? '#87b0bb' : '#7ba5b4');
    }
    return { boxes, decals };
}

// Per-player state for pb(): set once per player, so the bricks below need no closures.
const P = { x: 0, z: 0, dir: 1, lift: 0, box: null };
const pb = (x, y, z, w, h, d, color) => P.box(P.x + x, y + P.lift, P.z + z * P.dir, w, h, d, color);

/**
 * Writes one block-built player through box(x, y, z, w, h, d, color): the same bricks,
 * sizes and colours as the original software renderer.
 */
export function writePlayer(a, time, box) {
    const team = TEAMS[a.team];
    const moving = Math.hypot(a.vx, a.vz), stride = Math.sin(time * 15 + a.id) * Math.min(0.38, moving * 0.055);
    const jump = Math.sin(a.jump * Math.PI) * 2.15;
    const lean = a.fallen > 0 ? 0.7 : 0;
    P.x = a.x;
    P.z = a.z;
    P.dir = a.facing;
    P.lift = jump * (1 - lean);
    P.box = box;
    if (a.fallen > 0) {
        pb(0, 0.54, 0, 2.2, 0.8, 2.25, team.color);
        pb(0, 0.75, 1.4, 1.8, 1.05, 1.4, team.color);
        pb(-0.55, 0.35, -1.4, 0.65, 0.7, 1.25, '#eff0d9');
        pb(0.55, 0.35, -1.4, 0.65, 0.7, 1.25, '#eff0d9');
        return;
    }
    pb(-0.49, 0.25, 0.14 + stride, 0.65, 0.45, 1.05, '#213d4e');
    pb(0.49, 0.25, 0.14 - stride, 0.65, 0.45, 1.05, '#213d4e');
    pb(-0.49, 0.91, stride, 0.66, 1.1, 0.73, '#f0efda');
    pb(0.49, 0.91, -stride, 0.66, 1.1, 0.73, '#f0efda');
    pb(-0.79, 0.92, stride, 0.13, 0.85, 0.75, team.color);
    pb(0.79, 0.92, -stride, 0.13, 0.85, 0.75, team.color);
    pb(0, 1.45, 0, 1.65, 0.3, 0.94, team.dark);
    pb(0, 2, 0, 1.9, 1.1, 1.16, team.color);
    pb(0, 2.39, 0, 2.55, 0.5, 1.24, team.color);
    const reach = a.action > 0 ? 0.7 : 0;
    pb(-1.12, 1.93, -stride, 0.58, 0.86, 0.67, team.color);
    pb(1.12, 2 + reach * 0.3, stride + reach, 0.58, 0.86, 0.67, team.color);
    pb(-1.14, 1.44, -stride, 0.49, 0.47, 0.52, '#d7a07a');
    pb(1.14, 1.5 + reach * 0.5, stride + reach, 0.49, 0.47, 0.52, '#d7a07a');
    pb(0, 3.13, 0, 1.83, 1.15, 1.71, team.color);
    pb(0, 3.74, 0, 1.25, 0.18, 1.19, team.color);
    pb(0, 3.1, 0.87, 1.31, 0.54, 0.12, '#173449');
    pb(0, 2.77, 0.96, 1.42, 0.13, 0.18, '#dce8df');
    pb(-0.65, 2.91, 0.96, 0.11, 0.42, 0.16, '#dce8df');
    pb(0.65, 2.91, 0.96, 0.11, 0.42, 0.16, '#dce8df');
    pb(0, 3.77, 0, 0.24, 0.06, 1.68, team.accent);
}

/** Everything that moves: players, the scrimmage and first-down lines, the ball, particles. */
export function writeDynamic(frame, box) {
    for (const a of frame.actors)
        writePlayer(a, frame.time, box);
    if (!frame.lobby) {
        box(0, 0.24, frame.spotZ, 53.2, 0.05, 0.19, '#36dbea');
        if (Math.abs(frame.targetZ) <= 50)
            box(0, 0.25, frame.targetZ, 53.2, 0.06, 0.24, '#ffe56c');
    }
    const b = frame.ball;
    box(b.x, b.y, b.z, 0.6, 0.48, 0.94, '#994a2a');
    box(b.x, b.y + 0.27, b.z, 0.15, 0.05, 0.57, '#ffeecf');
    for (const p of frame.particles)
        box(p.x, p.y, p.z, p.size, p.size, p.size, p.color);
}
