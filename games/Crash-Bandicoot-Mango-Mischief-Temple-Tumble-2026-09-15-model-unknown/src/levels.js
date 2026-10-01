/**
 * levels.js — the trails of Sunstone Island.
 *
 * Each level describes its path (centre line, width, chasms), its scenery
 * landmarks, the things on it (crates, mangoes, shards, enemies, hazards),
 * its hints, areas, guardian and look. world.js grows the scenery from it;
 * main.js places the objects through the small api passed to objects().
 *
 * The guardian position S anchors the end of every trail, exactly as in the
 * original: arena from S-17, trigger at S-14, checkpoint S-16, gate S+10,
 * finish S+13, portal S+15, trail end S+21.
 */

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ----------------------------------------------------------- 01 · Temple Tumble */

const templeCenter = (s) => Math.sin(s * 0.035) * 0.45;

const TEMPLE = {
  id: 'temple',
  num: '01',
  name: 'TEMPLE TUMBLE',
  title: 'Temple Tumble',
  blurb: 'Coast, deep green, old ruins and a very grumpy guardian.',
  seed: 196,
  length: 225,
  rel: false,
  center: templeCenter,
  halfWidth: (s) => (s > 187 ? 5.15 : 3.8),
  start: { x: 0, s: 4 },
  pits: [
    { a: 34, b: 38.2 },
    { a: 74, b: 78.5, bridge: true, bridgeX: 2 },
    { a: 104, b: 114, island: [108.15, 110.4] },
    { a: 146, b: 151, moving: [{}] },
  ],
  walls: [116, 128, 140, 152, 164, 176],
  paveFrom: 122,
  landmarks({ totem, arch, temple }) {
    totem(-4.8, 30, 4.0);
    totem(4.8, 30, 4.0);
    arch(52, 5.2);
    arch(126, 5.2);
    arch(187, 6.3);
    temple(204);
  },
  objects(o) {
    o.crate(0, 10, 'question');
    o.crate(-1.65, 15);
    o.crate(1.65, 15);
    o.crate(0, 20);
    o.crate(0, 20, 'question', 1.15);
    o.crate(2.3, 27, 'charm');
    o.fruits(0, 5.5, 8);
    o.fruits(-1.65, 16.8, 18.5);
    o.fruits(1.7, 22.5, 25.5);
    o.fruits(0, 29, 32.4);
    for (let s = 34.3; s < 38.5; s += 1.3) o.fruit(0, s, 1.1 + Math.sin(((s - 34) / 4.5) * Math.PI) * 1.6);
    o.enemy(-0.2, 25, 1.5);
    o.crate(-2.2, 43);
    o.crate(-2.2, 43, 'question', 1.15);
    o.crate(2.25, 48, 'bounce');
    o.crate(2.25, 51, 'question');
    o.crate(0, 57, 'check');
    o.fruits(0, 53, 55);
    o.fruits(-1.5, 61, 65);
    o.crate(-2.1, 65, 'question');
    o.crate(0, 83, 'boom');
    o.crate(-1.4, 83);
    o.crate(1.4, 83);
    o.crate(2.5, 87, 'question');
    o.crate(-2.1, 90);
    o.crate(-2.1, 90, 'question', 1.15);
    o.enemy(0.5, 94, 1.8);
    o.enemy(-1.2, 99, 1.3);
    o.fruits(2, 72, 80, 1.45);
    o.fruits(0, 98, 102);
    o.fruit(0, 106, 2.0);
    o.fruit(0, 109, 1.1);
    o.fruit(0, 112, 2.0);
    o.crate(0, 118, 'charm');
    o.crate(-2, 121, 'question');
    o.crate(2, 121, 'question');
    o.crate(0, 125, 'check');
    o.crate(2, 137);
    o.crate(-2, 138);
    o.crate(-2, 138, 'question', 1.15);
    o.fruits(0, 139, 144, 1.5);
    o.fruit(0, 148.5, 1.4);
    o.crate(0, 155, 'question');
    o.crate(-1.5, 159, 'boom');
    o.crate(0, 159);
    o.crate(1.5, 159, 'boom');
    o.crate(2.4, 170, 'bounce');
    o.crate(-2, 171, 'question');
    o.enemy(0, 174, 2.0);
    o.crate(-2, 180);
    o.crate(0, 180, 'charm');
    o.crate(2, 180);
    o.fruits(0, 182, 187, 1.5);
    o.shard(2.25, 49.2, 3.1);
    o.shard(-2.1, 91.4, 3.05);
    o.shard(2.4, 171, 3.0);
    o.log(68);
    o.log(164);
    o.rock(133);
  },
  hints: [
    ['spin', 7, 'Hold {SPIN} to spin. Crates do not stand a chance.', 5],
    ['jump', 28, 'Hold {JUMP} for a high jump. Keep moving to clear the gap.', 6],
    ['shard', 44, 'A <b>sun shard</b>! Jump from the crate to reach it.', 4],
    ['check', 54, 'Break the <b>gold C crate</b> to save your place.', 4],
    ['log', 62, '<b>Jump over the spiked log.</b> A spin will not stop it.', 5],
    ['boom', 79, 'Red means trouble. <b>Jump on TNT</b>, then get clear. Do not spin into it.', 6],
    ['island', 99, 'Two gaps ahead. <b>Land on the middle stone</b>, then jump again.', 6],
    ['boulder', 128, '<b>Dodge the rolling stone.</b> It is too big to spin away.', 5],
    ['moving', 140, 'The stone platform moves. <b>Jump onto it</b>, then jump to the trail.', 6],
  ],
  areas: [
    [39, '01 / THE COAST', 'A little trouble'],
    [125, '02 / THE DEEP GREEN', 'Into the thick of it'],
    [188, '03 / THE OLD RUINS', 'Watch your step'],
    [Infinity, '04 / THE TEMPLE', 'The locals are awake'],
  ],
  boss: {
    s: 204,
    name: 'THE GRUMPSTONE',
    hp: 3,
    windup: 1.8,
    stun: 3.6,
    waves: 1,
    intro: ['THE GRUMPSTONE', 'JUMP THE WAVE. SPIN WHEN IT RESTS.'],
    defeat: ['WHO’S GRUMPY NOW?', 'THE TEMPLE IS OPEN. GRAB THE SUNSTONE!'],
    palette: null,
  },
  finishToast: ['TEMPLE TAMED!', 'AND ONLY A LITTLE PROPERTY DAMAGE.'],
  resultTitle: 'TROUBLE.<br>WELL MADE.',
  resultText: 'The guardian is quiet. The temple is open.<br>Not bad for a little rascal.',
  look: { fog: [0.48, 0.69, 0.57], hemi: [0.68, 0.77, 0.67], sun: [0.5, 0.4, 0.27], sunDir: [-0.55, 0.9, 0.38] },
  relic: [75, 105, 150],
  melody: [659, 0, 784, 0, 880, 784, 0, 659, 523, 0, 587, 659, 0, 0, 440, 0, 523, 0, 659, 0, 784, 659, 0, 523, 440, 0, 523, 587, 0, 659, 0, 0],
};

/* --------------------------------------------------------- 02 · Sunset Scramble */

// The trail swings wider here, then straightens out for the arena.
const sunsetCenter = (s) => Math.sin(s * 0.03 + 1.2) * 0.9 * clamp((198 - s) / 8, 0, 1);

const SUNSET = {
  id: 'sunset',
  num: '02',
  name: 'SUNSET SCRAMBLE',
  title: 'Sunset Scramble',
  blurb: 'Tide flats, rope bridges, sliding stones and the Tidestone at dusk.',
  seed: 2402,
  length: 235,
  rel: true,
  center: sunsetCenter,
  halfWidth: (s) => (s > 197 ? 5.15 : 3.8),
  start: { x: sunsetCenter(4), s: 4 },
  pits: [
    { a: 27, b: 31 },
    { a: 58, b: 63, bridge: true, bridgeX: -2 },
    { a: 88, b: 92.2 },
    { a: 104, b: 113.5, island: [108, 110.2] },
    { a: 138, b: 143.5, moving: [{ ax: 1.55, speed: 1.1 }] },
    { a: 160, b: 169, moving: [{ s: 164.5, ax: 0, as: 2.6, speed: 0.8 }] },
    { a: 184, b: 188.2 },
  ],
  walls: [116, 128, 176],
  paveFrom: 150,
  palmFirst: 60,
  palmChance: 0.75,
  lanterns: { from: 8, to: 197, step: 9, sun: true },
  landmarks({ totem, arch, temple, off }) {
    totem(off(20) - 4.8, 20, 4.0);
    totem(off(20) + 4.8, 20, 4.0);
    arch(51, 5.2, off(51));
    arch(100, 5.2, off(100));
    arch(197, 6.3, 0);
    temple(214, true);
  },
  objects(o) {
    // 01 · The tide flats
    o.fruits(0, 4, 7);
    o.crate(0, 10, 'question');
    o.crate(-1.6, 14);
    o.crate(1.6, 14);
    o.crate(-1.6, 14, 'question', 1.15);
    o.enemy(0, 19, 1.4);
    o.fruits(1.6, 20.5, 24.5);
    for (let s = 27.3; s < 31; s += 1.2) o.fruit(0, s, 1.1 + Math.sin(((s - 27) / 4) * Math.PI) * 1.6);
    o.crate(-2.2, 34, 'charm');
    o.crate(0, 38, 'nitro');
    o.fruit(-1.9, 38);
    o.fruit(1.9, 38);
    o.crate(-1.8, 42);
    o.crate(-1.8, 42, 'question', 1.15);
    o.crate(2.2, 46, 'bounce');
    o.shard(2.2, 47.2, 3.1);
    o.crate(0, 50, 'question');
    o.fruits(-1.4, 50.5, 53);
    o.crate(0, 54, 'check');
    // 02 · The rope bridges
    o.fruits(-2, 58.6, 62.6, 1.3);
    o.enemy(0.6, 67, 1.6);
    o.crate(0, 71, 'boom');
    o.crate(-1.4, 71);
    o.crate(1.4, 71);
    o.crate(-2.1, 76, 'nitro');
    o.crate(2.1, 76, 'nitro');
    o.fruit(0, 76);
    o.log(80);
    o.crate(2.2, 84, 'question');
    for (let s = 88.3; s < 92.2; s += 1.3) o.fruit(0, s, 1.1 + Math.sin(((s - 88) / 4.2) * Math.PI) * 1.6);
    o.crate(-2.2, 95);
    o.crate(-2.2, 95, 'question', 1.15);
    o.shard(-2.2, 96.4, 3.05);
    o.crate(0, 99, 'check');
    // 03 · The stepping stones
    o.fruit(0, 106, 2.0);
    o.fruit(0, 109.1, 1.1);
    o.fruit(0, 111.8, 2.0);
    o.enemy(-0.4, 118, 1.6, 'hopper');
    o.crate(1.9, 121, 'question');
    o.crate(-1.9, 123);
    o.rock(128);
    o.crate(0, 132, 'charm');
    o.fruits(0, 133.5, 136.5, 1.5);
    o.fruit(0, 140.75, 1.4);
    o.crate(0, 147, 'check');
    o.crate(0, 153, 'boom');
    o.crate(-1.5, 153, 'nitro');
    o.crate(1.5, 153, 'nitro');
    o.fruits(-2.6, 151.5, 154.5, 1.5);
    o.enemy(1, 157, 1.4, 'hopper');
    o.fruit(0, 162, 1.4);
    o.fruit(0, 167, 1.4);
    o.shard(0, 164.5, 3.0);
    o.crate(2, 172, 'question');
    o.crate(-2, 172);
    o.log(176);
    o.enemy(0, 180, 2.1);
    for (let s = 184.3; s < 188.2; s += 1.3) o.fruit(0, s, 1.1 + Math.sin(((s - 184) / 4.2) * Math.PI) * 1.6);
    o.crate(-2, 191);
    o.crate(0, 191, 'charm');
    o.crate(2, 191);
    o.fruits(0, 192.5, 196, 1.5);
  },
  hints: [
    ['dusk', 6, 'Sunset run! {SPIN} spins, {JUMP} jumps. The Tidestone waits at the altar.', 5],
    ['gap', 23, 'Hold {JUMP} for a long jump over the tide gap.', 5],
    ['nitro', 33, 'Green <b>NITRO</b> crates go off at the slightest touch. <b>Steer clear.</b>', 6],
    ['shard', 43, 'A <b>sun shard</b> hangs over the bounce crate. Bounce high!', 4],
    ['bridge', 55, 'The rope bridge is on the <b>left</b>. Stay on the planks.', 5],
    ['chain', 68, '<b>Jump on TNT</b> to light it, then back off. The blast sets off crates nearby.', 6],
    ['stones', 100, 'Stepping stones. <b>Land on the middle stone</b>, then jump again.', 5],
    ['hopper', 114, '<b>Hoppers</b> leap high. Stomp them when they land, or spin them.', 6],
    ['chain2', 149, 'TNT between two NITROs. <b>Light it and run back.</b>', 6],
    ['slide', 156, 'This stone slides <b>forward and back</b>. Ride it across.', 6],
  ],
  areas: [
    [56, '01 / THE TIDE FLATS', 'Low tide, high spirits'],
    [100, '02 / THE ROPE BRIDGES', 'Mind the planks'],
    [197, '03 / THE STEPPING STONES', 'Hop to it'],
    [Infinity, '04 / THE SUN ALTAR', 'Last light'],
  ],
  boss: {
    s: 214,
    name: 'THE TIDESTONE',
    hp: 4,
    windup: 1.6,
    stun: 3.0,
    waves: 2,
    intro: ['THE TIDESTONE', 'TWO WAVES NOW. JUMP BOTH, THEN SPIN.'],
    defeat: ['THE TIDE HAS TURNED', 'THE ALTAR IS OPEN. GRAB THE SUNSTONE!'],
    palette: { body: 0x5f7d86, head: 0x86a3a6, mouth: 0x1f3a40, teeth: 0xe4dcc0, nose: 0xa3b9b0, brow: 0x23434b, feet: 0x3f5a60, ears: 0x4c6d72, leafA: 0x3d8a7a, leafB: 0x7fc0a0, arm: 0x6f8f95, fist: 0x89a7a8, eye: 0xffd27a },
  },
  finishToast: ['SUN SET. JOB DONE.', 'THE WHOLE ISLAND SAW THAT.'],
  resultTitle: 'LAST LIGHT.<br>BEST LIGHT.',
  resultText: 'The Tidestone sleeps and the altar glows.<br>Sunstone Island is officially tumbled.',
  look: { fog: [0.84, 0.57, 0.47], hemi: [0.72, 0.62, 0.66], sun: [0.62, 0.4, 0.24], sunDir: [-0.75, 0.6, 0.3] },
  relic: [85, 120, 170],
  melody: [587, 0, 698, 0, 784, 698, 0, 587, 523, 0, 587, 698, 0, 0, 440, 0, 494, 0, 587, 0, 659, 587, 0, 494, 440, 0, 494, 523, 0, 587, 0, 0],
};

export const LEVELS = [TEMPLE, SUNSET];
