import { owns, liveChildren, year, age } from './engine.js';
/**
 * The original low-poly home, built from boxes, cylinders and spheres. scene.js
 * merges these primitives into a few meshes; `target` makes a primitive
 * clickable (it opens that room's activities) and `glow` lights it up in the
 * evening (windows, lamps, screens).
 */
export const TARGETS = { stove: [-1.15, .56, -1.8], table: [-2.65, .56, -.1], sofa: [-1.0, .56, 1.25], chair: [.2, .56, 2.4], bed: [1.0, .56, -.35], desk: [2.9, .56, -.6], shelf: [-3.65, .56, 2.45], record: [-3.55, .56, .8], phone: [.6, .56, .65], laundry: [1.55, .56, 2.1], garden: [4.35, .02, 3.5], mailbox: [-.25, .02, 5.15], home: [-.15, .56, .7] };
const P = { cream: '#fff4d9', wood: '#ba8254', lightwood: '#e4b87c', mint: '#70b5a0', teal: '#428f88', pink: '#e99683', coral: '#dc7f6d', yellow: '#ecc365', blue: '#92bcc0', green: '#8bb46b', dark: '#476154', white: '#fffbed' };
export function builder() {
    const items = [];
    let origin = [0, 0, 0], yaw = 0, tag = null;
    function add(kind, x, y, z, w, h, d, color, extra = {}) { const c = Math.cos(yaw), s = Math.sin(yaw); const item = { kind, position: [origin[0] + x * c + z * s, origin[1] + y, origin[2] - x * s + z * c], size: [w, h, d], color, rotation: [extra.rx || 0, yaw + (extra.ry || 0), extra.rz || 0], target: extra.target || tag, ...extra }; items.push(item); return item; }
    const b = { items, box: (x, y, z, w, h, d, c, e) => add('box', x, y, z, w, h, d, c, e), cyl: (x, y, z, r, h, c, e = {}) => add('cylinder', x, y, z, r, h, e.bottom ?? r, c, { sides: 10, ...e }), sphere: (x, y, z, r, c, e = {}) => add('sphere', x, y, z, r, r, r, c, e), cone: (x, y, z, r, h, c, e = {}) => add('cylinder', x, y, z, 0, h, r, c, { sides: 7, ...e }), at: (pos, angle, target, fn) => { const o = origin, ya = yaw, ta = tag; const co = Math.cos(yaw), si = Math.sin(yaw); origin = [o[0] + pos[0] * co + pos[2] * si, o[1] + pos[1], o[2] - pos[0] * si + pos[2] * co]; yaw += angle; tag = target || tag; fn(); origin = o; yaw = ya; tag = ta; } };
    return b;
}
function legs(b, w, d, y, h, c = P.wood) { for (const x of [-w / 2, w / 2])
    for (const z of [-d / 2, d / 2])
        b.box(x, y, z, .08, h, .08, c); }
function plant(b, x, y, z, size = 1, flower = false) { b.at([x, y, z], 0, null, () => { b.cyl(0, .16 * size, 0, .19 * size, .3 * size, '#cf9370', { bottom: .14 * size, sides: 8 }); b.cyl(0, .33 * size, 0, .15 * size, .05 * size, '#75553c'); b.cyl(0, .57 * size, 0, .025 * size, .49 * size, '#568a58', { sides: 5 }); for (let i = 0; i < 5; i++) {
    const a = i * 2.4;
    b.sphere(Math.sin(a) * .14 * size, (.58 + (i % 2) * .1) * size, Math.cos(a) * .14 * size, .2 * size, flower ? ['#eab75b', '#de927c', '#f2ce6e'][i % 3] : ['#8bb965', '#6aa069', '#80ad63'][i % 3], { scale: [1, .65, .65], segments: 5 });
} }); }
function table(b, x, y, z, w = 1.4, d = .9, color = P.lightwood) { b.at([x, y, z], 0, 'table', () => { legs(b, w * .77, d * .7, .31, .62); b.box(0, .65, 0, w, .13, d, color); }); }
function chair(b, x, y, z, rot = 0, color = P.yellow, arm = false) { b.at([x, y, z], rot, 'chair', () => { legs(b, .45, .42, .24, .48); b.box(0, .5, 0, .61, .15, .6, color); b.box(0, .84, -.24, .63, .61, .12, color); if (arm) {
    b.box(-.34, .7, 0, .12, .35, .67, color);
    b.box(.34, .7, 0, .12, .35, .67, color);
    b.box(0, .6, 0, .55, .14, .5, '#e0bc70');
} }); }
function tree(b, x, z, size = 1, fall = false, snow = false, bloom = false) { b.at([x, 0, z], 0, null, () => { b.cyl(0, .85 * size, 0, .18 * size, 1.7 * size, '#b38b64', { sides: 7, bottom: .24 * size }); b.cyl(.18 * size, 1.25 * size, 0, .09 * size, .8 * size, '#b38b64', { rz: -.5, sides: 6 }); b.cyl(-.12 * size, 1.4 * size, .1, .09 * size, .7 * size, '#b38b64', { rz: .5, sides: 6 }); for (let i = 0; i < 5; i++) {
    const a = i * 2.4;
    const col = bloom ? ['#f2c9c4', '#eab0b6', '#f7dcd4'][i % 3] : fall ? ['#d5ad60', '#c99a50', '#e9bf6a'][i % 3] : ['#9bbd6a', '#85ac60', '#accb7b'][i % 3];
    b.sphere(Math.sin(a) * .5 * size, (2.05 + (i % 2) * .3) * size, Math.cos(a) * .4 * size, .87 * size, col, { segments: 7, rings: 4, scale: [1, 1.1, 1] });
    // Winter: a soft cap of snow on the higher clumps.
    if (snow && i % 2)
        b.sphere(Math.sin(a) * .5 * size, 3.19 * size, Math.cos(a) * .4 * size, .56 * size, '#f3f5ee', { segments: 7, rings: 3, scale: [1, .42, 1] });
} }); }
function fence(b, x, z, count, rot = 0) { b.at([x, 0, z], rot, null, () => { b.box((count - 1) * .48 / 2, .29, 0, (count - 1) * .48, .08, .09, P.cream); b.box((count - 1) * .48 / 2, .61, 0, (count - 1) * .48, .08, .09, P.cream); for (let i = 0; i < count; i++) {
    b.box(i * .48, .45, 0, .13, .87, .12, P.cream);
    b.cone(i * .48, .93, 0, .095, .13, P.cream, { sides: 4, ry: Math.PI / 4 });
} }); }
function books(b, x, y, z, count = 6) { const cols = ['#d77d67', '#e7bd62', '#8cb7b6', '#f2e2bc', '#809882', '#bc9ca0']; for (let i = 0; i < count; i++) {
    const h = .22 + (i % 3) * .08;
    b.box(x + i * .125, y + h / 2, z, .095, h, .2, cols[i % cols.length], { rz: i === 2 ? .12 : 0 });
} }
function bed(b, x, z, color = P.yellow, small = false) { const w = small ? 1.05 : 1.7; b.at([x, .56, z], 0, 'bed', () => { legs(b, w * .85, 1.8, .18, .35); b.box(0, .25, 0, w + .1, .25, 2.15, P.wood); b.box(0, .47, 0, w, .26, 2.12, P.white); b.box(0, .61, .26, w + .04, .12, 1.56, color); b.box(0, .7, -1.04, w + .14, 1.05, .13, color); for (const px of small ? [0] : [-.43, .43])
    b.box(px, .66, -.63, small ? .72 : .7, .16, .44, '#fffbed', { ry: px * .05 }); for (let i = 0; i < 4; i++)
    b.box(0, .676, .03 + i * .28, w + .05, .022, .06, i % 2 ? '#f3d487' : '#e0ab53'); b.box(0, .68, .76, w + .07, .08, .26, '#f0d289'); }); }
function tinyCar(b, x, z) { b.at([x, .05, z], 0, null, () => { b.box(0, .44, 0, 2.55, .43, 1.07, '#6da9ac'); b.box(0, .78, 0, 1.4, .52, .97, '#9cc8c4'); b.box(-.48, .81, 0, .53, .31, 1.005, '#dcf0e6', { rz: .1 }); b.box(.22, .84, 0, .57, .27, 1.008, '#dbece1'); b.box(.85, .61, 0, .84, .11, 1.04, '#84bab6'); b.box(-1.17, .49, 0, .18, .07, 1.1, P.cream); b.box(1.26, .32, 0, .09, .14, 1.12, P.cream); for (const xx of [-.83, .84])
    for (const zz of [-.53, .53]) {
        b.cyl(xx, .23, zz, .27, .15, '#46534d', { rx: Math.PI / 2, sides: 12 });
        b.cyl(xx, .23, zz * 1.12, .12, .018, P.cream, { rx: Math.PI / 2, sides: 10 });
    } for (const zz of [-.35, .35])
    b.box(1.3, .53, zz, .05, .16, .2, '#fff2ba', { glow: .8 }); }); }
export function buildHouse(s, walls = true) {
    const b = builder(), spring = s.turn % 4 === 0, summer = s.turn % 4 === 1, fall = s.turn % 4 === 2, winter = s.turn % 4 === 3;
    const lawn = winter ? '#c6d3ac' : fall ? '#c1cc91' : '#b6ce99';
    // A small piece of the neighborhood, like a keepsake on a shelf.
    b.box(0, -.48, .55, 15.6, .6, 12.8, '#d4c4a0');
    b.box(0, -.14, .55, 15.65, .12, 12.85, lawn);
    b.box(0, -.052, 6.38, 15.6, .065, 1.08, '#bac1af');
    b.box(0, -.01, 5.81, 15.6, .09, .14, '#e5dfc7');
    for (let x = -6.6; x < 7; x += 2.15)
        b.box(x, -.006, 6.35, .85, .008, .045, '#eae8cd');
    b.box(-.15, .02, 4.7, 1.55, .08, 2.05, '#e8d6b4');
    for (let z = 3.75; z < 5.65; z += .47)
        b.box(-.15, .073, z, 1.33, .01, .025, '#c8bca1');
    b.box(-.15, .2, 3.24, 1.8, .35, .55, '#d5bb95');
    b.box(-.15, .08, 3.62, 1.95, .18, .4, '#e4cfac');
    b.box(-.5, .23, -.2, 8.32, .55, 6.68, '#c2a381');
    b.box(-.5, .53, -.2, 8.13, .13, 6.53, '#ead0a6');
    // Warm, finely divided floorboards.
    for (let z = -3.28; z < 3.03; z += .34)
        b.box(-.5, .605, z, 8.04, .012, .018, '#d5b889');
    for (let iz = 0; iz < 19; iz++)
        for (let ix = 0; ix < 4; ix++)
            b.box(-4.35 + ix * 2.05 + (iz % 2) * .6, .607, -3.13 + iz * .34, .017, .009, .32, '#d9bd92');
    for (let x = -4.3; x < -.65; x += .55)
        for (let z = -3.14; z < -.25; z += .55)
            b.box(x, .62, z, .548, .025, .548, (Math.round((x + 4.3) / .55) + Math.round((z + 3.14) / .55)) % 2 ? '#a8c9b7' : '#f4eccd', { target: 'stove' });
    for (let x = 1.7; x < 3.4; x += .48)
        for (let z = .1; z < 2.91; z += .48)
            b.box(x, .623, z, .475, .03, .475, (Math.round((x - 1.7) / .48) + Math.round((z - .1) / .48)) % 2 ? '#cee0d2' : '#f3f0d8', { target: 'laundry' });
    // Cutaway walls. Lower front edges keep the interior fully legible.
    if (walls) {
        b.box(-.5, 1.89, -3.46, 8.3, 2.57, .16, '#f8e9c9');
        b.box(-4.61, 1.89, -.2, .17, 2.57, 6.7, '#f1dfbe');
        b.box(-.5, 3.19, -3.46, 8.42, .1, .23, '#d4b18a');
        b.box(-4.61, 3.19, -.2, .23, .1, 6.75, '#d4b18a');
        b.box(-.62, 1.37, -2.39, .12, 1.51, 2.02, '#f7e9d0');
        // Kitchen window and yellow curtains.
        b.box(-2.62, 2.31, -3.34, 1.61, 1.14, .08, '#fffbed');
        b.box(-2.62, 2.31, -3.28, 1.39, .94, .035, '#b2d9d2', { glow: 1 });
        b.box(-2.62, 2.31, -3.24, .055, 1.02, .05, '#fffbed');
        b.box(-2.62, 2.31, -3.24, 1.45, .045, .05, '#fffbed');
        b.box(-2.62, 1.71, -3.22, 1.86, .12, .23, P.cream);
        b.box(-3.52, 2.27, -3.22, .28, 1.22, .12, '#ebc463');
        b.box(-1.72, 2.27, -3.22, .28, 1.22, .12, '#ebc463');
        for (let dx of [-3.58, -3.45, -1.79, -1.65])
            b.box(dx, 2.27, -3.14, .03, 1.2, .015, '#d9b04e');
        b.box(-2.62, 2.94, -3.19, 2.05, .055, .07, P.wood);
        plant(b, -2.36, 1.77, -3.08, .43);
        // A bedroom picture and a small wall clock.
        b.box(1.22, 2.25, -3.32, 1.08, .8, .055, P.wood);
        b.box(1.22, 2.25, -3.278, .96, .68, .025, '#a8c3a4');
        b.cyl(1.47, 2.42, -3.25, .13, .015, '#edd381', { rx: Math.PI / 2, sides: 12 });
        b.box(1.1, 2.08, -3.25, .5, .18, .018, '#759e8d');
        b.cyl(-.93, 2.58, -3.27, .24, .07, '#d79970', { rx: Math.PI / 2, sides: 16 });
        b.cyl(-.93, 2.58, -3.218, .205, .025, P.cream, { rx: Math.PI / 2, sides: 16 });
        b.box(-.93, 2.64, -3.193, .017, .13, .015, P.dark);
        b.box(-.87, 2.58, -3.19, .12, .015, .015, P.dark);
    }
    b.box(-.5, .76, 3.095, 8.27, .29, .12, '#f6e4c2');
    b.box(3.6, .77, -.2, .12, .3, 6.56, '#f6e4c2');
    b.box(-4.51, .73, -.2, .08, .2, 6.43, '#fff5db');
    b.box(-.5, .7, -3.35, 8.13, .14, .07, '#fff6df');
    // The kitchen: cabinets, basin, stove, fridge and a little breakfast table.
    for (let x of [-3.95, -3.15, -2.35]) {
        b.box(x, 1.035, -2.91, .76, .79, .77, '#87b6a6', { target: 'stove' });
        b.box(x, 1.46, -2.91, .8, .1, .85, P.cream, { target: 'stove' });
        b.box(x, 1.03, -2.507, .69, .65, .025, '#91c0ac');
        b.box(x, 1.25, -2.473, .21, .035, .025, '#e8d6ae');
    }
    b.box(-2.33, 1.522, -2.91, .52, .025, .49, '#79978e');
    b.box(-2.33, 1.541, -2.91, .39, .015, .35, '#b1d4ca');
    b.cyl(-2.33, 1.7, -3.17, .031, .32, '#b8bba6', { sides: 8 });
    b.box(-2.33, 1.85, -3.09, .04, .035, .18, '#b8bba6');
    b.at([-1.24, .6, -2.91], 0, 'stove', () => { b.box(0, .46, 0, .93, .88, .82, '#f4e8c8'); b.box(0, .92, 0, .97, .08, .85, '#fdf3d7'); b.box(0, .43, .421, .74, .51, .027, '#7b9b92'); b.box(0, .46, .44, .58, .35, .016, '#475e59'); b.box(0, .71, .446, .52, .035, .025, P.cream); for (let x of [-.29, -.1, .1, .29])
        b.cyl(x, .8, .427, .04, .035, '#697c6f', { rx: Math.PI / 2, sides: 8 }); for (let x of [-.23, .23])
        for (let z of [-.2, .2]) {
            b.cyl(x, .978, z, .133, .02, '#6c7969', { sides: 12 });
            b.cyl(x, .99, z, .074, .012, '#929889', { sides: 10 });
        } b.cyl(-.23, 1.11, -.2, .155, .21, '#d89373', { sides: 10 }); b.cyl(-.23, 1.23, -.2, .17, .025, P.cream, { sides: 10 }); b.sphere(-.23, 1.28, -.2, .036, P.wood); });
    b.at([-4.06, .6, -1.32], 0, 'stove', () => { b.box(0, .9, 0, .88, 1.81, .8, '#88b9ad'); b.box(0, 1.49, .41, .83, .49, .055, '#a0cabb'); b.box(0, .68, .41, .83, 1.08, .055, '#9bc5b5'); b.box(.29, 1.36, .465, .045, .19, .055, P.cream); b.box(.29, .97, .465, .045, .29, .055, P.cream); b.box(-.18, .98, .465, .19, .18, .007, '#eee2b3', { rz: .13 }); });
    table(b, -2.55, .61, -.43, 1.32, .83);
    chair(b, -3.44, .61, -.4, Math.PI / 2, P.yellow);
    chair(b, -1.65, .61, -.45, -Math.PI / 2, P.yellow);
    for (const xx of [-2.91, -2.2]) {
        b.cyl(xx, 1.343, -.43, .15, .026, P.white, { sides: 14, target: 'table' });
        b.box(xx, 1.37, -.43, .13, .04, .13, '#cf9c58');
    }
    b.cyl(-2.58, 1.44, -.63, .11, .21, P.teal, { sides: 10, target: 'table' });
    b.cone(-2.44, 1.45, -.63, .055, .16, P.teal, { rz: -1.08 });
    // Cozy living room: woven rug, coral sofa, flowers, books and records.
    b.box(-2.02, .64, 1.48, 3.79, .033, 2.68, '#d4dcc0', { target: 'sofa' });
    b.box(-2.02, .662, 1.48, 3.51, .016, 2.42, '#679f95', { target: 'sofa' });
    for (let z of [.38, 2.57])
        b.box(-2.02, .675, z, 3.51, .008, .055, '#e6dfb8');
    b.at([-2.31, .64, .74], 0, 'sofa', () => { legs(b, 2.32, .67, .14, .28); b.box(0, .37, 0, 2.8, .42, .93, P.coral); b.box(0, .78, -.37, 2.79, .84, .2, '#eaa08a'); for (let x of [-1.33, 1.33])
        b.box(x, .6, .04, .22, .61, .99, '#e99a84'); for (let x of [-.84, 0, .84])
        b.box(x, .61, .1, .8, .16, .72, '#f0ae97'); b.box(-.89, .89, -.19, .45, .4, .13, '#f5d78a', { rz: -.1 }); b.box(.88, .89, -.18, .4, .37, .13, '#9ac8b6', { rz: .14 }); });
    table(b, -2.23, .65, 2.06, 1.36, .76, '#e8bf87');
    b.box(-2.45, 1.393, 2.11, .39, .045, .27, '#86b3ba', { ry: .2 });
    b.box(-2.45, 1.418, 2.11, .31, .008, .21, '#ecedce', { ry: .2 });
    plant(b, -1.94, 1.39, 2.02, .35, true);
    chair(b, .12, .64, 2.14, -.45, owns(s, 'comfortable') ? '#dfbb65' : '#87b5a0', true);
    b.at([-4.27, .64, 1.73], Math.PI / 2, 'shelf', () => { b.box(0, .73, -.16, 1.5, 1.47, .09, '#bd8c5b'); for (let x of [-.76, .76])
        b.box(x, .75, 0, .09, 1.5, .36, P.lightwood); for (let y of [.1, .57, 1.08, 1.5])
        b.box(0, y, 0, 1.58, .075, .39, P.lightwood); books(b, -.59, .16, .025, 9); books(b, -.57, .62, .01, 7); b.box(.44, 1.27, .05, .26, .3, .19, '#d99c73'); plant(b, -.44, 1.53, 0, .48); });
    b.at([-4.07, .64, .31], Math.PI / 2, 'record', () => { legs(b, .8, .42, .2, .4); b.box(0, .57, 0, 1.07, .52, .6, P.lightwood); b.box(0, .86, 0, 1.14, .08, .65, P.wood); if (owns(s, 'television')) {
        b.box(0, 1.19, 0, .89, .57, .42, '#ad885f');
        b.box(-.07, 1.2, .225, .59, .42, .025, '#bed1bc', { glow: .7 });
        b.box(.35, 1.32, .23, .055, .07, .03, P.cream);
        b.box(.35, 1.12, .23, .055, .07, .03, P.cream);
        b.box(.12, 1.71, 0, .02, .45, .02, P.dark, { rz: .35 });
    }
    else {
        b.box(0, .96, 0, .78, .14, .5, '#ead9b0');
        b.cyl(-.15, 1.043, 0, .18, .02, '#506158', { sides: 14 });
        b.cyl(-.15, 1.056, 0, .055, .01, P.coral, { sides: 10 });
        b.box(.14, 1.072, .03, .035, .025, .24, '#d1b276', { ry: .6 });
    } });
    if (owns(s, 'radio')) {
        b.box(-3.87, 1.67, -3.03, .57, .32, .26, '#bc825b');
        b.box(-3.92, 1.67, -2.88, .31, .21, .035, '#e5d2a5');
        for (let x = -4.05; x < -3.8; x += .045)
            b.box(x, 1.67, -2.853, .012, .19, .01, '#ac9878');
        b.cyl(-3.64, 1.63, -2.867, .046, .035, '#f3ddb0', { rx: Math.PI / 2, sides: 10 });
    }
    // Bedroom and a sunny writing corner.
    bed(b, 1.22, -1.78, P.yellow);
    table(b, 2.69, .6, -2.57, .63, .63);
    b.cyl(2.69, 1.49, -2.57, .075, .45, '#b09162');
    b.cone(2.69, 1.83, -2.57, .28, .36, '#f9e1a5', { sides: 10, glow: 1 });
    b.box(3.07, 1.51, -1.18, .72, 1.81, .9, '#a9c2ae', { target: 'bed' });
    b.box(3.07, 1.54, -.71, .66, 1.63, .035, '#b5cdb7');
    b.box(3.07, 1.5, -.679, .023, 1.54, .018, '#92ad97');
    for (const x of [2.99, 3.15])
        b.cyl(x, 1.44, -.655, .029, .03, P.cream, { rx: Math.PI / 2, sides: 6 });
    b.box(2.53, .69, -.02, 1.96, .16, .11, '#f2e7cb');
    table(b, 2.62, .64, .21, 1.31, .69);
    b.box(2.56, 1.38, .2, .38, .015, .28, P.white, { ry: .1 });
    b.box(2.6, 1.4, .2, .02, .025, .27, '#74998d', { ry: -.5 });
    if (owns(s, 'computer')) {
        b.box(2.53, 1.67, .08, .53, .49, .38, '#e3d7b8');
        b.box(2.53, 1.69, .281, .41, .32, .012, '#7d9b92');
        b.box(2.53, 1.4, .51, .55, .045, .22, '#dbd2b5');
    }
    else if (owns(s, 'sewing')) {
        b.box(2.55, 1.44, .13, .52, .065, .3, '#444f48');
        b.box(2.7, 1.64, .13, .16, .36, .19, '#52675b');
        b.box(2.49, 1.78, .13, .48, .16, .17, '#52675b');
        b.box(2.31, 1.63, .13, .09, .22, .15, '#52675b');
        b.cyl(2.59, 1.97, .13, .045, .16, '#e29c7b', { sides: 6 });
    }
    // Bathroom: a little enamel tub, basin, towels and a hamper.
    b.at([2.76, .64, 2.07], 0, 'laundry', () => { b.box(0, .33, 0, 1.18, .61, 1.57, '#f4efd9'); b.box(0, .65, 0, 1.08, .08, 1.5, P.white); b.box(0, .696, 0, .81, .024, 1.22, '#a7c7ba'); b.box(0, .7, .05, .65, .025, 1.01, '#c5dfd0'); b.cyl(.37, .84, -.55, .025, .28, '#b7b599'); b.box(.29, .99, -.55, .2, .03, .035, '#b7b599'); b.box(-.52, .71, .26, .16, .065, .58, '#e8b76e'); });
    if (owns(s, 'washer')) {
        b.box(1.48, 1.07, 2.53, .8, .85, .76, '#efe7cc', { target: 'laundry' });
        b.cyl(1.48, 1.04, 2.925, .26, .04, '#a0b7ab', { rx: Math.PI / 2, sides: 14, target: 'laundry' });
        b.cyl(1.48, 1.04, 2.955, .2, .021, '#799c94', { rx: Math.PI / 2, sides: 14 });
        b.box(1.48, 1.4, 2.931, .69, .13, .026, '#d4dcc9');
        b.cyl(1.66, 1.41, 2.958, .04, .026, '#b3b09a', { rx: Math.PI / 2, sides: 8 });
    }
    else {
        b.cyl(1.35, .96, 2.62, .32, .62, '#bf986c', { bottom: .27, sides: 10, target: 'laundry' });
        b.cyl(1.35, 1.29, 2.62, .31, .045, '#d4b388', { sides: 10 });
        b.box(1.37, 1.31, 2.66, .46, .07, .3, '#f7ecd3', { ry: .15 });
    }
    table(b, .63, .64, .24, .48, .46);
    b.box(.63, 1.4, .24, .31, .11, .25, owns(s, 'phone') ? '#ca896d' : '#cfaf6f', { target: 'phone' });
    b.box(.63, 1.49, .23, .41, .08, .12, '#f2dfb5', { target: 'phone' });
    // Flowers, trees, a drying line, and the neighborly picket fence.
    tree(b, -6.05, -2.55, 1.1, fall, winter, spring);
    tree(b, 5.75, -4.37, .9, fall, winter);
    tree(b, -6.28, 3.17, .81, fall, winter);
    fence(b, -7.1, 5.47, 12);
    fence(b, 1.54, 5.47, 12);
    fence(b, -7.18, -1.8, 13, Math.PI / 2);
    b.at([1.12, 0, 5.11], 0, 'mailbox', () => { b.box(0, .56, 0, .14, 1.14, .14, '#bc9870'); b.box(0, 1.25, 0, .49, .4, .43, '#d28f76'); b.cone(0, 1.52, 0, .36, .19, '#d28f76', { sides: 4, ry: Math.PI / 4 }); b.box(0, 1.25, .23, .37, .27, .026, '#ebb497'); b.box(.29, 1.47, 0, .07, .32, .028, '#eab956'); });
    for (let i = 0; i < 30; i++) {
        const x = -6.8 + ((i * 173) % 138) / 10, z = i < 15 ? -4.95 + ((i * 23) % 9) / 10 : 4.77 + ((i * 13) % 4) / 10;
        if (Math.abs(x) < 1.5 && z > 4)
            continue;
        b.cyl(x, .15, z, .014, .28, '#669857', { sides: 4 });
        const cc = ['#f2c764', '#f6e6b5', '#e39884'][i % 3];
        b.sphere(x, .32, z, .092, cc, { segments: 6, rings: 3 });
        b.sphere(x - .13, .17, z, .09, '#8caf68', { scale: [1, .4, .6], segments: 5, rings: 3 });
    }
    // Expansion wing: different furniture as children grow.
    if (owns(s, 'room')) {
        b.box(4.95, .23, -1.89, 2.62, .55, 3.44, '#c2a381');
        b.box(4.95, .55, -1.89, 2.59, .13, 3.42, '#dfd6b5');
        if (walls) {
            b.box(4.95, 1.85, -3.53, 2.71, 2.48, .15, '#e6c1a5');
            b.box(4.95, 3.13, -3.53, 2.74, .1, .21, '#d3b18b');
        }
        b.box(6.26, .74, -1.87, .12, .25, 3.42, '#f6e3c3');
        if (liveChildren(s).some(c => year(s) - c.born < 3)) {
            b.at([5.0, .61, -2.22], 0, 'bed', () => { legs(b, 1.0, 1.65, .24, .48); b.box(0, .53, 0, 1.1, .18, 1.82, '#f2e4ba'); b.box(0, .64, 0, .94, .07, 1.65, '#e1b4a3'); for (let z = -.81; z <= .81; z += .23)
                for (let x of [-.54, .54])
                    b.box(x, .97, z, .04, .67, .04, '#f7e9c4'); for (let x of [-.54, .54])
                b.box(x, 1.31, 0, .07, .07, 1.83, '#f7e9c4'); for (let z of [-.9, .9])
                b.box(0, 1, z, 1.13, .7, .07, '#f7e9c4'); });
        }
        else if (liveChildren(s).length)
            bed(b, 4.93, -2.15, '#bdabae', true);
        else {
            chair(b, 4.85, .62, -2.1, .1, '#97b8aa', true);
            table(b, 5.77, .61, -2.1, .6, .6);
            plant(b, 5.77, 1.31, -2.1, .5);
        }
        for (let i = 0; i < 4; i++)
            b.box(4.2 + i * .3, .71, -.61 + (i % 2) * .25, .23, .22, .23, ['#b5c5c5', '#e2b77e', '#d8917e', '#95b598'][i], { ry: i * .4, target: 'bed' });
    }
    if (owns(s, 'workshop')) {
        b.box(4.97, .24, .99, 2.62, .55, 2.34, '#c2a381');
        b.box(4.97, .55, .99, 2.61, .12, 2.34, '#e6cbaa');
        b.box(6.27, .75, .99, .12, .25, 2.32, P.cream);
        table(b, 5.37, .64, .35, 1.31, .71);
        b.box(5.4, 1.38, .31, .7, .02, .47, '#afd0ba');
        b.cyl(5.75, 1.53, .1, .12, .3, '#dcae79', { sides: 8 });
        chair(b, 5.19, .61, 1.32, 0, P.blue);
        books(b, 4.23, .65, .1, 7);
    }
    if (owns(s, 'sunroom')) {
        b.box(-5.75, .22, .19, 2.2, .52, 3.32, '#d0b792');
        b.box(-5.75, .55, .19, 2.19, .12, 3.3, '#e8d3a5');
        for (let z of [-1.4, 1.8])
            b.box(-6.75, 1.65, z, .12, 2.12, .12, P.cream);
        b.box(-6.75, 2.74, .2, .15, .15, 3.4, P.cream);
        chair(b, -5.72, .62, .76, .5, '#d9af66', true);
        plant(b, -5.79, .62, -.87, .9);
    }
    // Washing outside remains useful even after the house grows.
    b.at([5.2, 0, 3.06], 0, 'laundry', () => { for (const x of [-1.15, 1.15])
        b.cyl(x, 1.09, 0, .043, 2.18, '#e6d8b7', { sides: 6 }); b.box(0, 2.13, 0, 2.34, .025, .026, '#7e8c72'); b.box(-.65, 1.79, 0, .64, .67, .028, '#fff7df'); b.box(.16, 1.86, 0, .51, .51, .027, '#a3c8b8'); b.box(.7, 1.87, 0, .42, .48, .028, '#ebbf80'); for (const x of [-.92, -.4, -.03, .36, .56, .84])
        b.box(x, 2.1, 0, .027, .09, .046, '#b08e60'); });
    if (owns(s, 'gardenbeds')) {
        for (const z of [3.96, 4.77]) {
            b.box(4.96, .13, z, 2.17, .29, .6, '#b78e60', { target: 'garden' });
            b.box(4.96, .287, z, 1.99, .035, .46, '#866c49');
            for (let i = 0; i < 6; i++) {
                const x = 4.13 + i * .32;
                b.cone(x, .43, z, .13, .31, '#87ad65', { sides: 6, target: 'garden' });
                b.sphere(x + .05, .39, z, .11, '#a0bf71', { segments: 5, rings: 3 });
            }
        }
    }
    else
        for (let i = 0; i < 5; i++)
            b.sphere(4.13 + i * .45, .22, 4.4, .32, ['#a5bc77', '#91ac6c'][i % 2], { segments: 6, rings: 3, scale: [1, .6, 1] });
    if (owns(s, 'accessible')) {
        b.box(-.17, .14, 3.73, 1.88, .13, 1.72, '#dcc49b', { rx: .17 });
        for (let x of [-1.1, .75]) {
            b.box(x, .76, 3.6, .045, .7, .045, P.wood);
            b.box(x, 1.1, 3.67, .055, .055, 1.54, P.wood, { rx: .15 });
        }
    }
    if (owns(s, 'freezer'))
        b.box(4.2, .43, 4.62, .83, .83, .6, '#e8e6c9', { target: 'stove' });
    if (owns(s, 'vacuum')) {
        b.box(1.0, .77, 2.86, .3, .18, .44, '#be9771');
        b.box(1.0, 1.17, 2.69, .14, .75, .19, '#dbb977', { rx: .3 });
    }
    if (s.clutter > 35) {
        for (let i = 0; i < Math.min(7, Math.floor(s.clutter / 12)); i++)
            b.box(-.59 + (i % 3) * .33, .71, 1.64 + Math.floor(i / 3) * .33, .26, .22, .24, ['#c9ad7c', '#a7bca4', '#dcba8b'][i % 3], { ry: i * .4, target: 'sofa' });
    }
    if (s.stats.home < 30)
        for (let i = 0; i < 5; i++)
            b.box(-3 + (i % 3) * 1.01, .68, 2.72 - i * .27, .26, .025, .24, '#ddd4b2', { ry: i * .7, target: 'sofa' });
    tinyCar(b, -4.62, 6.36);
    seasons(b, s, walls, { spring, summer, fall, winter });
    return b.items;
}
/** Seasonal set dressing and the traces the seasonal traditions leave behind. */
function seasons(b, s, walls, { spring, summer, fall, winter }) {
    const counts = s.counts || {}, today = s.dayCounts || {};
    if (winter)
        for (const [x, z, r] of [[-5.6, 1.2, .9], [5.9, -2.6, .8], [3.2, 4.9, .7], [-2.9, 5.0, .8], [6.4, 1.4, .6], [-6.4, -4.2, .7], [2.2, -4.6, .75]])
            b.sphere(x, -.07, z, r, '#eef2e8', { scale: [1, .12, .8], segments: 8, rings: 3 });
    // Bulbs, once planted, come back every spring and stay through the summer.
    if (counts.bulbs && (spring || summer)) {
        const tulips = ['#e0655a', '#f2c764', '#e98fa6'];
        const rows = [[-1.35, [3.95, 4.3, 4.65, 5.0, 5.35]], [1.05, [3.95, 4.3, 4.65]]];
        rows.forEach(([x, zs], r) => zs.forEach((z, i) => {
            b.cyl(x, .1, z, .014, .3, '#669857', { sides: 4, target: 'garden' });
            b.sphere(x + .07, .02, z, .07, '#7fae62', { scale: [1, .35, .6], segments: 5, rings: 3 });
            b.cyl(x, .29, z, .075, .13, tulips[(i + r) % 3], { bottom: .045, sides: 6, target: 'garden' });
        }));
    }
    // A summer picnic leaves its blanket out on the lawn for the rest of the day.
    if (summer && today.picnic) {
        b.at([-3.3, 0, 4.15], .12, 'garden', () => {
            b.box(0, -.07, 0, 1.7, .02, .95, '#f4ead2');
            for (const x of [-.6, -.2, .2, .6])
                b.box(x, -.058, 0, .14, .006, .95, '#d9776a');
            for (const z of [-.3, 0, .3])
                b.box(0, -.056, z, 1.7, .006, .12, '#e39a8c');
            b.box(.52, .05, -.16, .42, .22, .3, '#c49a62');
            b.box(.52, .17, -.16, .44, .03, .32, '#d8b27a');
            b.cyl(.52, .25, -.16, .012, .3, '#9c7448', { rx: Math.PI / 2, sides: 5 });
            for (const [x, z] of [[-.35, .15], [-.05, -.2]])
                b.cyl(x, -.05, z, .13, .015, P.white, { sides: 12 });
            b.cyl(-.55, .06, -.12, .075, .24, '#f2df8a', { sides: 8 });
            b.sphere(-.35, -.01, .15, .06, '#e8a25a', { segments: 6, rings: 3 });
        });
    }
    // Autumn pumpkins by the steps, and jars on the counter once the preserves are put up.
    if (fall)
        for (const [x, z, r] of [[-1.45, 3.62, .17], [-1.72, 3.9, .12], [1.12, 3.58, .15]]) {
            b.sphere(x, -.08 + r * .75, z, r, '#e0913f', { scale: [1, .75, 1], segments: 8, rings: 5, target: 'garden' });
            b.cyl(x, -.08 + r * 1.5 + .03, z, .02, .08, '#6c7d4a', { sides: 5 });
        }
    if (counts.preserve) {
        ['#c8574f', '#e39a3f', '#8aa25a', '#b0476a'].forEach((col, i) => {
            const x = -3.42 + i * .16;
            b.cyl(x, 1.585, -3.0, .055, .15, col, { sides: 8, target: 'stove' });
            b.cyl(x, 1.672, -3.0, .058, .025, P.cream, { sides: 8 });
        });
    }
    // Winter festivities: a little tree in the living-room corner and paper chains along the wall.
    if (winter && today.festive) {
        b.at([-3.72, .64, 2.62], 0, 'sofa', () => {
            b.cyl(0, .12, 0, .16, .24, '#c9744f', { bottom: .12, sides: 8 });
            b.cone(0, .52, 0, .38, .5, '#5f8f63', { sides: 8 });
            b.cone(0, .84, 0, .32, .42, '#6b9c6c', { sides: 8 });
            b.cone(0, 1.12, 0, .22, .36, '#78a877', { sides: 8 });
            b.cone(0, 1.36, 0, .1, .16, '#ecc365', { sides: 5, glow: 1 });
            [[.28, .45, .1], [-.22, .5, .2], [.05, .62, -.3], [.2, .8, -.12], [-.18, .86, .12], [.08, 1.05, .15]].forEach(([x, y, z], i) =>
                b.sphere(x, y, z, .045, ['#d7695c', '#ecc365', '#8cb7b6'][i % 3], { segments: 6, rings: 3, glow: .9 }));
            for (let i = 0; i < 3; i++)
                b.box(-.3 + i * .3, .06, -.42 - (i % 2) * .08, .16, .12, .16, ['#d7695c', '#8cb7b6', '#ecc365'][i], { ry: i * .5 });
        });
        if (walls)
            for (let i = 0; i < 26; i++) {
                const x = -4.35 + i * .3, sag = Math.sin((i % 5) / 5 * Math.PI) * .12;
                b.box(x, 3.02 - sag, -3.33, .2, .06, .04, ['#d7695c', '#ecc365', '#8cb7b6', '#a8c3a4'][i % 4], { rz: (i % 2 ? .3 : -.3) });
            }
    }
}
/** Biscuit the dog: a body and a separate tail (so it can wag), facing +z, feet at y 0. */
export function buildDog() {
    const body = builder(), tail = builder(), fur = '#c9a06a', light = '#ead2a8', dark = '#8a6440';
    body.box(0, .3, 0, .26, .22, .5, fur);
    body.box(0, .28, .2, .22, .2, .14, light);
    for (const x of [-.085, .085])
        for (const z of [-.17, .17]) {
            body.cyl(x, .11, z, .038, .22, fur, { sides: 6 });
            body.box(x, .02, z + .02, .075, .04, .09, light);
        }
    body.box(0, .47, .31, .2, .18, .2, fur);
    body.box(0, .425, .44, .11, .09, .13, light);
    body.box(0, .455, .505, .045, .035, .03, '#3f3a35');
    for (const x of [-.055, .055])
        body.sphere(x, .51, .415, .018, '#3f3a35', { segments: 6, rings: 3 });
    for (const x of [-.1, .1])
        body.box(x, .5, .27, .05, .14, .09, dark, { rz: x > 0 ? -.4 : .4 });
    body.box(0, .39, .27, .215, .045, .11, '#d7695c');
    body.sphere(0, .35, .33, .025, '#ecc365', { segments: 6, rings: 3 });
    tail.cyl(0, .09, 0, .022, .18, fur, { sides: 5, bottom: .03 });
    tail.sphere(0, .18, 0, .03, light, { segments: 5, rings: 3 });
    return { body: body.items, tail: tail.items };
}
export function buildPerson({ skin = '#d5a078', color = '#73aaa1', hair = '#695044', apron = true, child = false, old = false } = {}) {
    const b = builder();
    const sk = skin, ha = old ? '#d2ccb9' : hair;
    for (let x of [-.095, .095]) {
        b.cyl(x, .25, 0, .064, .36, apron ? sk : '#777f78', { sides: 6 });
        b.box(x, .081, .065, .135, .09, .24, '#756252');
    }
    if (apron) {
        b.cyl(0, .54, 0, .16, .44, color, { bottom: .3, sides: 8 });
        b.cyl(0, .88, 0, .185, .32, color, { bottom: .17, sides: 8 });
        b.box(0, .64, .245, .29, .3, .035, '#fbf1d7');
        b.box(0, .88, .177, .22, .22, .032, '#fbf1d7');
    }
    else {
        b.box(0, .57, 0, .34, .37, .27, '#70857e');
        b.cyl(0, .87, 0, .215, .37, color, { bottom: .19, sides: 8 });
        b.box(0, 1.06, .07, .08, .06, .18, '#f3e4c9');
    }
    b.cyl(0, 1.12, 0, .066, .15, sk, { sides: 7 });
    b.sphere(0, 1.34, 0, .238, sk, { segments: 9, rings: 6, scale: [.92, 1.07, .9] });
    b.sphere(0, 1.44, -.043, .243, ha, { segments: 8, rings: 4, scale: [.98, .64, .92] });
    if (apron && !old)
        b.sphere(0, 1.33, -.17, .123, ha, { segments: 6, rings: 4 });
    for (const x of [-.067, .067])
        b.sphere(x, 1.365, .193, .019, '#4e5044', { segments: 6, rings: 3 });
    b.sphere(0, 1.307, .216, .032, sk, { segments: 6, rings: 3 });
    b.box(0, 1.24, .193, .046, .012, .012, '#b68068');
    for (const x of [-.255, .255]) {
        b.cyl(x, .84, 0, .075, .27, color, { sides: 7, rz: x > 0 ? .13 : -.13 });
        b.cyl(x * 1.07, .625, .02, .052, .23, sk, { sides: 7, rz: x > 0 ? .13 : -.13 });
        b.sphere(x * 1.1, .495, .022, .061, sk, { segments: 6, rings: 4 });
    }
    return b.items;
}
export function familyPeople(s) { const people = []; if (s.partnerAlive)
    people.push({ id: 'partner', pos: [-3.48, .64, 1.06], angle: .55, scale: .95, params: { skin: '#c99775', color: '#d5ac68', apron: false, old: age(s) > 62 } }); liveChildren(s).forEach((c, i) => { const a = year(s) - c.born; people.push({ id: c.name, pos: [.48 + i * .55, .62, 1.65], angle: -.6, scale: a < 3 ? .43 : a < 8 ? .56 : a < 13 ? .71 : .86, params: { skin: s.profile.skin, color: i ? '#c18e97' : '#8daabe', apron: false, child: true } }); }); if (s.grandchild && liveChildren(s).length === 0)
    people.push({ id: 'visitor', pos: [.58, .62, 1.82], angle: -.4, scale: .48, params: { skin: '#d6a484', color: '#d7b366', apron: false } }); return people; }
