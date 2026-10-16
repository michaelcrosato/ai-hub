// ASHVALE: a spiritual successor to The Legend of Zelda (NES), built on my-3D2dge.
// The land is nine screens, each with one cave. The data lives in game/data/ (rooms and links for each dungeon, the
// enemy table, the world builder and a solver). This file runs the game: gates, items, bosses, saves and the scenes.
(() => {
const E = My3D2dge, A = ASH;
const CELL = 16, RW = 12, RH = 8, ROOM_W = RW * CELL, ROOM_H = RH * CELL;
const cx = A.wcx, DUNGEON_COUNT = Object.keys(A.DUNGEONS).length;
const BOMB_RADIUS = 26, SHIELD_FRONT = 1.1, GATE_REACH = 18, WHISTLE_REACH = 90, SAVE_KEY = 'ashvale-save';
const ITEM_NAME = { sword: 'SWORD', bow: 'BOW', whistle: 'WHISTLE', candle: 'CANDLE', rod: 'MAGIC ROD', ladder: 'LADDER',
  raft: 'RAFT', magicKey: 'MAGIC KEY', ring: 'RED RING', silverArrow: 'SILVER ARROWS', compass: 'COMPASS', book: 'MAGIC BOOK' };
const ITEM_COLOR = { bow: '#c8a060', whistle: '#e0c040', candle: '#ff9a3a', rod: '#c060ff', ladder: '#a07040', raft: '#c8a070',
  magicKey: '#ff60ff', ring: '#ff4040', silverArrow: '#e8f0ff', compass: '#60ffb0', book: '#a060ff' };
const USABLE = ['bow', 'whistle', 'candle', 'rod'];

const game = new E.Game({ canvas: 'screen', res: 'nes', expand: true, view: 'threequarter', views: ['threequarter', 'overhead'],
  menu: { controls: { attack: 'Sword', skill: 'Bomb', dash: 'Use item', jump: 'Next item' } } });

// ---- art ----
const HEART_ROWS = ['.rr.rr.', 'rrrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'];
const HEART = E.sprite(HEART_ROWS, { r: '#e0404a' }, 1), HEART_EMPTY = E.sprite(HEART_ROWS, { r: '#3a2a34' }, 1);
const HEART_PICKUP = E.sprite(HEART_ROWS, { r: '#ff6a7a' }, 1);
const KEY = E.sprite(['.kk.', 'k..k', '.kk.', '..k.', '..kk'], { k: '#f0c040' }, 1);
const BOMB = E.sprite(['..f.', '.bb.', 'bbbb', 'bbbb', '.bb.'], { b: '#2a2a33', f: '#f0a030' }, 1);
const BOMB_PICKUP = E.sprite(['..f.', '.bb.', 'bbbb', 'bbbb', '.bb.'], { b: '#3a3a48', f: '#ffd060' }, 1);
const ARROW_PICKUP = E.sprite(['..w', '.w.', 'w..'], { w: '#e8d8a0' }, 1);
const ARROW = E.sprite(['..w', '.w.', 'w..'], { w: '#f0e6c0' }, 1);
const FIRE = E.sprite(['.o.', 'ooo', '.o.'], { o: '#ff8a3a' }, 1);
const gems = {};
const gem = c => gems[c] || (gems[c] = E.sprite(['.g.', 'gGg', '.g.'], { g: c, G: '#ffffff' }, 1));

const types = {
  1: { h: 30, top: '#8a8478', side: '#5a5448', face: 'stone' },
  2: { h: 26, top: '#2e6a34', side: '#3a2a1a', face: 'hedge', roof: 'leaves' },
  4: { h: 22, top: '#8a5a2a', side: '#5a3a1a', face: 'plank' },                       // D: locked door
  5: { h: 30, top: '#8a7a5a', side: '#5a4a34', face: 'rock' },                        // K: cracked wall
  6: { h: 22, top: '#6a6a7a', side: '#3a3a48', face: 'plank' },                       // G: raft gate
  7: { h: 40, top: '#2a5aa0', side: '#1a3a6a', face: 'stone' },                       // W: water (a ladder bridges it)
  8: { h: 22, top: '#2e7a34', side: '#244a22', face: 'hedge', roof: 'leaves' },      // B: bush (candle)
  9: { h: 30, top: '#6a5a8a', side: '#4a3a6a', face: 'stone' },                       // H: carved wall (whistle)
  10: { h: 24, top: '#7a3aa0', side: '#4a1a6a', face: 'plank' },                      // M: magic door
  11: { h: 26, top: '#4a4a58', side: '#2a2a34', face: 'stone' }                        // Q: guarded door (clear the room)
};
const floorLand = (x, y, tag) => tag === 'cave'
  ? E.tex.dirt(x, y, { base: '#2a2232', dark: '#1e1826', light: '#3a3044' })
  : E.tex.dirt(x, y, { base: '#4f8a3c', dark: '#3f7430', light: '#64a04c' });
const floorDungeon = (x, y, tag) => tag === 'spikes'
  ? E.tex.flagstone(x, y, { stones: ['#3a3a44', '#44444f'].map(E.hex), mortar: E.hex('#1a1a20'), hi: E.hex('#6a6a78'), lo: E.hex('#2a2a32'), speck: E.hex('#9a9aa8') })
  : E.tex.flagstone(x, y, { stones: ['#4b4559', '#554f64'].map(E.hex), mortar: E.hex('#221e2b'), hi: E.hex('#6f6782'), lo: E.hex('#322d3e'), speck: E.hex('#2a2634') });

// ---- state: everything that is saved ----
let S, L, hero, heroRig, sword, cool = 0, seed = 7, spawnSeq = 0;
const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const fresh = () => ({ hp: 3, maxHp: 3, keys: 0, bombs: 0, arrows: 0, silver: 0, items: {}, active: null,
  taken: {}, dead: {}, gates: {}, cleared: {}, won: false, at: null, ringTick: 0, iframes: 0 });
const save = () => { S.at = { x: S.at ? S.at.x : cx(A.START[0]), y: S.at ? S.at.y : cx(A.START[1]) }; E.store.set(SAVE_KEY, S); };
const loadSave = () => { try { return E.store.get(SAVE_KEY, null); } catch (e) { return null; } };

const roomOf = (x, y) => Math.floor(x / ROOM_W) + ',' + Math.floor(y / ROOM_H);
const cellOf = (x, y) => Math.floor(x / CELL) + ',' + Math.floor(y / CELL);
const caveId = (x, y) => Object.keys(A.DUNGEONS).find(id => A.caveTile(+id).join(',') === x + ',' + y);

// ---- levels ----
function worldLevel() {
  return {
    rows: A.landRows(), gates: [], spikes: [], boss: null, id: 0,
    pickups: [{ key: 'heart-field', kind: 'heart', x: cx(A.landCell(A.HEART_FIELD)[0]), y: cx(A.landCell(A.HEART_FIELD)[1]) }],
    enemies: A.SLIMES.map((s, i) => { const [gx, gy] = A.landCell(s); return { id: 'w' + i, kind: 'slime', x: cx(gx), y: cx(gy) }; })
  };
}

function load(name, at) {
  const isWorld = name === 'world';
  const data = isWorld ? worldLevel() : A.loadDungeon(+name.slice(1));
  const map = new E.TileMap({ rows: data.rows, legend: A.LEGEND, types, floorTex: isWorld ? floorLand : floorDungeon });
  L = { name, isWorld, id: data.id || 0, data, map, specials: {}, gates: [], pickups: [], enemies: [], bombs: [], shots: [], bolts: [],
    clearT: -1, intro: isWorld ? 0 : 2.2, title: data.name || 'THE LAND' };
  data.rows.forEach((row, y) => [...row].forEach((c, x) => {
    if (c === 'S') L.specials[x + ',' + y] = 'spikes';
    else if (c === 'X') L.specials[x + ',' + y] = 'exit';
    else if (c === 'C') L.specials[x + ',' + y] = { dungeon: +caveId(x, y) };
  }));
  L.gates = data.gates.map(g => {
    const opened = !!S.gates[name + ':' + g.id];
    if (opened) for (const [x, y] of g.cells) map.set(x, y, 0);
    return { ...g, opened };
  });
  for (const p of data.pickups) if (!S.taken[name + ':' + p.key]) L.pickups.push({ ...p, taken: false });
  for (const e of data.enemies) if (!S.dead[name + ':' + e.id]) L.enemies.push(makeEnemy(e, name));
  if (data.boss && !S.dead[name + ':' + data.boss.id]) L.enemies.push(makeEnemy(data.boss, name));
  hero = new E.Body({ x: at.x, y: at.y, r: 5 }); hero.facing = 0;
  heroRig = new E.Humanoid({ size: 1.2, build: 'heroic', weapon: 'sword', hood: true, outfit: 'coat', colors: { cloth: '#3a6a4a', cape: '#2a4a3a' } });
  sword = new E.Attack('slash', { reach: 11 });
  game.cam.room = [ROOM_W, ROOM_H];
  game.cam.bounds = v => map.bounds(v);
  game.follow(hero, { z: 0 });
}

function makeEnemy(e, lvl) {
  const spec = A.ENEMY[e.kind];
  const body = new E.Body({ x: e.x, y: e.y, r: spec.r });
  const blob = new E.Blob({ R: spec.R, colors: spec.colors, horns: spec.horns, wings: spec.wings, mouth: spec.mouth });
  const heads = e.heads || 3, hp = e.kind === 'gleeok' ? heads * 2 : spec.hp;
  const en = { id: e.id, key: lvl + ':' + e.id, kind: e.kind, spec, body, blob, r: spec.r, hp, maxHp: hp, heads, dead: false,
    t: 0, lunge: 0, stun: 0, shrunk: 0, facing: 0, dir: e.dir || 1, boss: !!spec.boss, state: {}, home: [e.x, e.y],
    swordHits: 0, vulnerable: false, eyeOpen: false, spawned: !!e.spawned };
  body.enemy = en;
  return en;
}

const ctx = {
  get hero() { return hero; },
  rand,
  shoot: (x, y, vx, vy) => L.shots.push({ x, y, vx, vy, t: 3 }),
  spawn: (kind, x, y) => L.enemies.push(makeEnemy({ id: 'spawn' + (++spawnSeq), kind, x, y, spawned: true }, L.name)),
  // a floor spot near (x, y), within r, for teleporting monsters
  spot(x, y, r) {
    for (let i = 0; i < 16; i++) {
      const a = rand() * Math.PI * 2, d = rand() * r, px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
      if (L.map.height(Math.floor(px / CELL), Math.floor(py / CELL)) === 0 && !L.specials[cellOf(px, py)]) return [px, py];
    }
    return null;
  }
};

// ---- gates ----
const gateNear = (g, x, y, reach) => g.cells.some(([gx, gy]) => Math.hypot(cx(gx) - x, cx(gy) - y) < reach);
const roomHasEnemies = (g) => {
  const room = roomOf(cx(g.cells[0][0]), cx(g.cells[0][1]));
  return L.enemies.some(e => !e.dead && !e.spec.invulnerable && roomOf(e.body.x, e.body.y) === room);
};
function openGate(g, how) {
  g.opened = true; S.gates[L.name + ':' + g.id] = true;
  for (const [x, y] of g.cells) { L.map.set(x, y, 0); game.particles.dust(cx(x), cx(y), 4, 4); }
  game.audio.sfx(how === 'bomb' ? 'explode' : 'select');
}
function updateGates() {
  for (const g of L.gates) {
    if (g.opened || g.active || g.need === 'bomb') continue;   // bomb walls open to bombs; active gates open when used
    if (g.need === 'clear') { if (gateNear(g, hero.x, hero.y, GATE_REACH) && !roomHasEnemies(g)) openGate(g); continue; }
    if (!gateNear(g, hero.x, hero.y, GATE_REACH)) continue;
    if (g.need === 'key') {
      if (S.items.magicKey) openGate(g);
      else if (S.keys > 0) { S.keys--; openGate(g); }
    } else if (S.items[g.need]) openGate(g);
  }
}

// ---- items ----
function giveItem(id) {
  S.items[id] = true;
  if (id === 'silverArrow') S.silver = Math.max(S.silver, 5);
  if (USABLE.includes(id) && !S.active) S.active = id;
  game.flash(ITEM_COLOR[id] || '#ffffff', .25);
  game.audio.sfx('confirm');
}
function useItem() {
  const id = S.active;
  if (!id || !S.items[id] || cool > 0) return;
  const dir = hero.facing, cs = Math.cos(dir), sn = Math.sin(dir);
  if (id === 'bow' || id === 'rod') {
    const ganon = L.enemies.some(e => e.kind === 'ganon' && e.vulnerable && !e.dead);
    let kind = 'bolt';
    if (id === 'bow') {
      if (ganon && S.silver > 0) { S.silver--; kind = 'silver'; }
      else if (S.arrows > 0) { S.arrows--; kind = 'arrow'; }
      else return;
    }
    L.bolts.push({ x: hero.x + cs * 8, y: hero.y + sn * 8, vx: cs * 170, vy: sn * 170, t: 1.2, kind });
    cool = id === 'bow' ? .3 : .4; game.audio.sfx('jump');
  } else if (id === 'whistle') {
    cool = .6; game.audio.sfx('select'); game.flash('#e0c040', .12);
    for (const g of L.gates) if (g.active && g.need === 'whistle' && !g.opened && gateNear(g, hero.x, hero.y, 26)) openGate(g);
    for (const e of L.enemies) if (e.kind === 'digdogger' && Math.hypot(e.body.x - hero.x, e.body.y - hero.y) < WHISTLE_REACH) e.shrunk = 4;
  } else if (id === 'candle') {
    cool = .5; game.particles.sparks(hero.x + cs * 10, hero.y + sn * 10, 6, 8, dir);
    for (const g of L.gates) if (g.active && g.need === 'candle' && !g.opened && gateNear(g, hero.x, hero.y, 26)) openGate(g);
  }
}

// ---- combat ----
const mouthsAlive = () => L.enemies.some(e => !e.dead && e.kind === 'mouth');
const shieldBlocks = en => Math.abs(A.angDiff(en.facing, Math.atan2(hero.y - en.body.y, hero.x - en.body.x))) < SHIELD_FRONT;
function hurtHero(from) {
  if (game.debug && game.debug.god) return;
  if (S.items.ring) { S.ringTick++; if (S.ringTick % 2 === 1) { E.knockback(from, hero, 90, 0); return; } }   // the red ring halves hits
  S.hp -= 1; game.flash('#ff5a4a', .2); game.shake(3); game.audio.sfx('hit');
  E.knockback(from, hero, 150, 0);
  if (S.hp <= 0) game.go('end');
}
function hurtEnemy(en, source) {
  const s = en.spec;
  const shrug = () => { game.particles.sparks(en.body.x, en.body.y, 4, 6); game.audio.sfx('hit'); };
  if (en.dead || s.invulnerable) return shrug();
  if (en.kind === 'digdogger' && en.shrunk <= 0) return shrug();
  if (s.shield && source === 'sword' && shieldBlocks(en)) return shrug();
  if (en.kind === 'dodongo' && en.stun <= 0 && source === 'sword') return shrug();
  if (en.kind === 'manhandla' && mouthsAlive() && source === 'sword') return shrug();
  if (en.kind === 'ghoma' && !en.eyeOpen) return shrug();
  if (en.kind === 'ghoma' && source !== 'arrow') return shrug();
  if (en.kind === 'ganon') {
    if (source === 'sword' && !en.vulnerable) {                                   // four sword hits break its shield
      en.swordHits++; if (en.swordHits >= 4) en.vulnerable = true;
      game.particles.impact(en.body.x, en.body.y, 6, 6); game.audio.sfx('hit'); E.knockback(hero, en.body, 120, 0); en.blob.kick(-.3);
      return;
    }
    if (source !== 'silver' || !en.vulnerable) return shrug();
  }
  en.hp -= source === 'silver' ? 99 : 1;
  E.knockback(hero, en.body, 140, 0); en.blob.kick(-0.35);
  game.particles.impact(en.body.x, en.body.y, 6, 6); game.audio.sfx('hit');
  if (en.hp <= 0) kill(en);
}
function kill(en) {
  en.dead = true;
  if (!en.spawned) S.dead[en.key] = true;
  game.particles.bits(en.body.x, en.body.y, 4, 10, [ '#e0e8ff', '#8a5a2a', '#4aa8e0' ]);
  game.audio.sfx('explode');
  if (en.boss) bossFallen(en);
}
function bossFallen(en) {
  if (L.clearT >= 0) return;
  L.clearT = 0; S.cleared[L.name] = true;
  S.maxHp += 1; S.hp = S.maxHp;                                             // a heart container for every boss
  game.flash('#ffffff', .4);
  if (L.id === DUNGEON_COUNT) S.won = true;
}
function explode(b) {
  game.particles.explosion(b.x, b.y, 0, 1); game.shake(3);
  for (const g of L.gates) {
    if (g.opened || g.need !== 'bomb' || !gateNear(g, b.x, b.y, BOMB_RADIUS)) continue;
    openGate(g, 'bomb');
    for (const [x, y] of g.cells) game.particles.bits(cx(x), cx(y), 4, 10, ['#8a7a5a', '#5a4a34']);
  }
  for (const en of L.enemies) {
    if (en.dead || Math.hypot(en.body.x - b.x, en.body.y - b.y) > BOMB_RADIUS) continue;
    if (en.kind === 'dodongo') { en.stun = 2.5; en.blob.kick(.5); game.audio.sfx('select'); }
    else if (en.spec.boss || en.spec.invulnerable) continue;
    else { en.hp -= 2; if (en.hp <= 0) kill(en); }
  }
}

// ---- scenes ----
const play = {
  enter(data) { load(data.name, data.at); },
  update(dt) {
    if (L.intro > 0) L.intro -= dt;
    if (L.clearT >= 0) {
      L.clearT += dt;
      if (L.clearT > 2.4) { if (S.won) game.go('ending'); else leaveDungeon(); }
      heroRig.update(dt, { x: hero.x, y: hero.y, z: hero.z, vx: 0, vy: 0, vz: 0, facing: hero.facing, air: false });
      return;
    }
    const I = game.input;
    S.iframes = Math.max(0, S.iframes - dt); cool = Math.max(0, cool - dt);
    if (!game.cam.moving) {
      const [mx, my] = I.move(), [dx, dy] = game.view.screenDirToGround(mx, my);
      hero.vx = dx * 70; hero.vy = dy * 70;
      if (dx || dy) hero.facing = Math.atan2(dy, dx);
      if (I.pressed('attack') && sword.start()) game.audio.sfx('jump');
      if (I.pressed('skill') && S.bombs > 0 && L.bombs.length < 2) {
        S.bombs -= 1;
        L.bombs.push({ x: hero.x + Math.cos(hero.facing) * 12, y: hero.y + Math.sin(hero.facing) * 12, t: 1.2 });
        game.audio.sfx('select');
      }
      if (I.pressed('dash')) useItem();
      if (I.pressed('jump')) cycleItem();
    } else { hero.vx = hero.vy = 0; }
    hero.update(dt, L.map);
    sword.update(dt);
    if (sword.active) sword.hits(L.enemies.filter(e => !e.dead).map(e => e.body), b => E.inArc(hero, hero.facing, b, 13, 1.1, 22), b => hurtEnemy(b.enemy, 'sword'));

    for (const b of L.bombs) { b.t -= dt; if (b.t <= 0) { explode(b); b.done = true; } }
    L.bombs = L.bombs.filter(b => !b.done);

    // bolts (arrows, the rod's magic) and the monsters' fire
    for (const b of L.bolts) {
      b.t -= dt; b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.t <= 0 || L.map.height(Math.floor(b.x / CELL), Math.floor(b.y / CELL)) > 0) { b.done = true; continue; }
      for (const en of L.enemies) {
        if (!en.dead && Math.hypot(en.body.x - b.x, en.body.y - b.y) < en.r + 3) { hurtEnemy(en, b.kind === 'bolt' ? 'bolt' : b.kind); b.done = true; break; }
      }
    }
    L.bolts = L.bolts.filter(b => !b.done);
    for (const s of L.shots) {
      s.t -= dt; s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.t <= 0 || L.map.height(Math.floor(s.x / CELL), Math.floor(s.y / CELL)) > 0) { s.done = true; continue; }
      if (S.iframes <= 0 && Math.hypot(hero.x - s.x, hero.y - s.y) < 7) { hurtHero({ x: s.x, y: s.y }); S.iframes = 1.2; s.done = true; }
    }
    L.shots = L.shots.filter(s => !s.done);

    // monsters act on the hero's screen only
    const here = roomOf(hero.x, hero.y);
    for (const en of L.enemies) {
      if (en.dead) continue;
      const inRoom = roomOf(en.body.x, en.body.y) === here;
      en.stun = Math.max(0, en.stun - dt); en.shrunk = Math.max(0, en.shrunk - dt);
      if (!inRoom || en.stun > 0) en.body.vx = en.body.vy = 0;
      else A.AI[en.spec.ai](en, ctx, dt);
      en.body.update(dt, L.map);
      const dxh = hero.x - en.body.x, dyh = hero.y - en.body.y, d = Math.hypot(dxh, dyh) || 1;
      if (en.spec.shield) en.facing = en.facing; else en.facing = Math.atan2(dyh, dxh);
      en.blob.update(dt, { look: [dxh / d, dyh / d], flap: en.spec.wings ? 1 : 0 });
      if (inRoom && en.stun <= 0 && !en.spec.invulnerable && S.iframes <= 0 && d < en.r + 6) { hurtHero(en.body); S.iframes = 1.2; }
    }
    L.enemies = L.enemies.filter(e => !e.dead);

    // spikes hurt whoever stands on them
    if (L.specials[cellOf(hero.x, hero.y)] === 'spikes' && S.iframes <= 0) { hurtHero({ x: hero.x - 1, y: hero.y }); S.iframes = 1.2; }

    for (const p of L.pickups) {
      if (p.taken || Math.hypot(hero.x - p.x, hero.y - p.y) > 9) continue;
      p.taken = true; S.taken[L.name + ':' + p.key] = true; take(p);
    }
    updateGates();

    // the cave: walk into it from the land; the exit: walk to the dungeon's west wall
    const spot = L.specials[cellOf(hero.x, hero.y)];
    if (spot && spot.dungeon) { enterDungeon(spot.dungeon); return; }
    if (spot === 'exit') { leaveDungeon(); return; }

    heroRig.update(dt, { x: hero.x, y: hero.y, z: hero.z, vx: hero.vx, vy: hero.vy, vz: 0, facing: hero.facing, air: false, attack: sword.state });
  },
  draw(r) {
    r.sky(L.isWorld ? ['#0c1a14', '#1f3a2a'] : ['#0a0a14', '#1a1a2e']);
    L.map.drawFloor(r); L.map.queueWalls(r);
    for (const p of L.pickups) {
      if (p.taken) continue;
      const spr = { key: KEY, bombs: BOMB_PICKUP, arrows: ARROW_PICKUP, heart: HEART_PICKUP, item: gem(ITEM_COLOR[p.item] || '#ffffff') }[p.kind];
      r.sprite(p.x, p.y, 4, spr, { anchor: 'center' });
    }
    for (const b of L.bombs) r.sprite(b.x, b.y, 4, BOMB, { anchor: 'center' });
    for (const b of L.bolts) r.sprite(b.x, b.y, 4, ARROW, { anchor: 'center' });
    for (const s of L.shots) r.sprite(s.x, s.y, 4, FIRE, { anchor: 'center' });
    for (const en of L.enemies) {
      r.shadow(en.body.x, en.body.y, en.r, .35, undefined, 0);
      r.actor(en.body.x, en.body.y, 0, (g, ox, oy) => en.blob.draw(g, ox, oy, r.view));
    }
    const blink = S.iframes > 0 && Math.floor(game.time * 12) % 2 === 0;
    if (!blink) {
      r.shadow(hero.x, hero.y, 7, .35, undefined, 0);
      r.actor(hero.x, hero.y, hero.z, (g, ox, oy) => heroRig.draw(g, ox, oy, r.view));
    }
    r.overlay(g => {
      for (let i = 0; i < S.maxHp; i++) E.px.sprite(g, i < S.hp ? HEART : HEART_EMPTY, 6 + i * 9, 6);
      E.font.text(g, 'KEYS ' + S.keys + '  BOMBS ' + S.bombs + '  ARROWS ' + S.arrows +
        '  SHARDS ' + Object.keys(S.cleared).length + '/' + DUNGEON_COUNT, 6, 18, '#ffe080');
      if (S.active) E.font.text(g, 'ITEM ' + ITEM_NAME[S.active] + ' (' + game.input.label('dash') + ')', 6, 28, ITEM_COLOR[S.active] || '#ffffff');
      if (L.intro > 0 && !L.isWorld) E.font.title(g, L.title.toUpperCase(), r.W / 2, r.H / 2 - 8, { scale: 2, align: 'center' });
      E.font.text(g, L.isWorld ? worldGoal() : goal(), 6, r.H - 12, '#ffffff');
    });
  }
};

function cycleItem() {
  const owned = USABLE.filter(id => S.items[id]);
  if (!owned.length) return;
  S.active = owned[(owned.indexOf(S.active) + 1) % owned.length];
  game.audio.sfx('select');
}

function take(p) {
  if (p.kind === 'key') S.keys += 1;
  else if (p.kind === 'bombs') S.bombs += p.amount;
  else if (p.kind === 'arrows') S.arrows += p.amount;
  else if (p.kind === 'heart') { S.maxHp += 1; S.hp = S.maxHp; game.flash('#ff8a9a', .2); }
  else if (p.kind === 'item') { giveItem(p.item); game.particles.text(p.x, p.y, 8, ITEM_NAME[p.item] || p.item, '#fff2c4', { scale: 1, bounce: true }); return; }
  game.audio.sfx('select');
}

function enterDungeon(id) {
  save();
  const d = A.loadDungeon(id);
  game.go('play', { name: 'd' + id, at: { x: d.start[0], y: d.start[1] } });
}
function leaveDungeon() {
  const id = L.id, [dx, dy] = A.caveDoorstep(id);
  S.at = { x: cx(dx), y: cx(dy) }; save();
  game.go('play', { name: 'world', at: S.at });
}

// the line at the bottom of the screen: what to do next in the dungeon, from its first closed gate
const NEED_HINT = {
  key: [['FIND A KEY', 'OPEN THE LOCKED DOOR'], () => S.keys > 0 || S.items.magicKey],
  bomb: [['FIND BOMBS', 'BOMB THE CRACKED WALL'], () => S.bombs > 0],
  raft: [['FIND THE RAFT', 'USE THE RAFT ACROSS THE WATER'], () => S.items.raft],
  ladder: [['FIND THE LADDER', 'LAY THE LADDER ACROSS THE WATER'], () => S.items.ladder],
  candle: [['FIND THE CANDLE', 'BURN THE BUSH WITH THE CANDLE'], () => S.items.candle],
  whistle: [['FIND THE WHISTLE', 'PLAY THE WHISTLE NEAR THE CARVED WALL'], () => S.items.whistle],
  magicKey: [['FIND THE MAGIC KEY', 'OPEN THE MAGIC DOOR'], () => S.items.magicKey],
  clear: [['DEFEAT THE GUARDS', 'DEFEAT THE GUARDS'], () => false]
};
function goal() {
  if (L.clearT >= 0 || S.cleared[L.name]) return 'LEAVE THE CAVE';
  const g = L.gates.find(x => !x.opened);
  if (!g) return L.data.bossHint || 'SLAY THE BOSS';
  const [[find, act], have] = NEED_HINT[g.need];
  return have() ? act : find;
}
function worldGoal() {
  const near = Object.keys(A.DUNGEONS).find(id => Math.hypot(cx(A.caveTile(+id)[0]) - hero.x, cx(A.caveTile(+id)[1]) - hero.y) < 48);
  if (near) return (S.cleared['d' + near] ? 'CAVE CLEARED: ' : 'CAVE: ') + A.DUNGEONS[near].name.toUpperCase();
  return 'FIND A CAVE';
}

const title = {
  update() {
    const saved = !!loadSave();
    if (game.input.pressed('start') && saved) { S = loadSave(); game.go('play', { name: 'world', at: S.at || { x: cx(A.START[0]), y: cx(A.START[1]) } }); }
    else if (game.input.pressed(saved ? 'attack' : 'start')) begin();
  },
  draw(r) {
    r.sky(['#0c1a14', '#1f3a2a']);
    const m = Math.round(r.H / 2), saved = !!loadSave();
    r.overlay(g => E.font.title(g, 'ASHVALE', r.W / 2, m - 44, { scale: 3, align: 'center' }));
    const line = saved ? ('PRESS ' + game.input.label('start') + ' TO CONTINUE   ' + game.input.label('attack') + ' NEW GAME')
      : ('PRESS ' + game.input.label('start') + ' TO BEGIN');
    r.text(line.toUpperCase(), r.W / 2, m + 24, '#ffffff', { align: 'center', shadow: '#000' });
  }
};

const end = {
  update() { if (game.input.pressed('start')) game.go('title'); },
  draw(r) {
    r.sky(['#301010', '#6a2a2a']);
    const m = Math.round(r.H / 2);
    r.overlay(g => E.font.title(g, 'FALLEN', r.W / 2, m - 42, { scale: 3, align: 'center' }));
    r.text(('PRESS ' + game.input.label('start') + ' TO RETURN').toUpperCase(), r.W / 2, m + 28, '#ffffff', { align: 'center', shadow: '#000' });
  }
};

const ending = {
  enter() { this.t = 0; },
  update(dt) { this.t += dt; if (game.input.pressed('start') || this.t > 30) game.go('title'); },
  draw(r) {
    r.sky(['#103020', '#2a6a48']);
    const m = Math.round(r.H / 2);
    r.overlay(g => E.font.title(g, 'THE TRIFORCE IS WHOLE', r.W / 2, m - 46, { scale: 2, align: 'center' }));
    r.text('GANON IS DEFEATED', r.W / 2, m - 4, '#ffffff', { align: 'center', shadow: '#000' });
    r.text('ASHVALE: A SPIRITUAL SUCCESSOR', r.W / 2, m + 14, '#d0ffe0', { align: 'center', shadow: '#000' });
    r.text(('PRESS ' + game.input.label('start') + ' TO RETURN').toUpperCase(), r.W / 2, m + 34, '#ffffff', { align: 'center', shadow: '#000' });
  }
};

function begin() { S = fresh(); S.items = {}; game.go('play', { name: 'world', at: { x: cx(A.START[0]), y: cx(A.START[1]) } }); }

S = fresh();
// a handle for tests and tools (node game/test.mjs; tools/check.mjs prints snapshot())
game.debug = {
  god: false,
  snapshot: () => ({
    scene: game.sceneName, level: L && L.name, hero: hero ? [hero.x, hero.y].map(v => Math.round(v * 10) / 10) : null,
    hp: S.hp, maxHp: S.maxHp, keys: S.keys, bombs: S.bombs, arrows: S.arrows, silver: S.silver, active: S.active,
    items: Object.keys(S.items).filter(k => S.items[k]), cleared: Object.keys(S.cleared), won: S.won,
    enemies: L ? L.enemies.map(e => ({ id: e.id, kind: e.kind, x: Math.round(e.body.x), y: Math.round(e.body.y), hp: e.hp,
      stun: Math.round(e.stun * 10) / 10, shrunk: Math.round(e.shrunk * 10) / 10, vulnerable: e.vulnerable, swordHits: e.swordHits,
      eyeOpen: e.eyeOpen, shed: (e.state && e.state.heads) || 0 })) : [],
    gates: L ? L.gates.map(g => ({ id: g.id, letter: g.letter, need: g.need, opened: !!g.opened })) : [],
    goal: L ? (L.isWorld ? worldGoal() : goal()) : null, bombsOut: L ? L.bombs.length : 0, shots: L ? L.shots.length : 0
  }),
  teleport(x, y, facing = hero.facing) { Object.assign(hero, { x, y, z: 0, vx: 0, vy: 0, vz: 0, facing }); },
  // jump straight into a dungeon with the items already owned (for tests)
  enter(id, items = []) {
    S = fresh(); for (const it of items) giveItem(it);
    const [sx, sy] = A.loadDungeon(id).start;
    game.go('play', { name: 'd' + id, at: { x: sx, y: sy } });
  },
  save: () => save(), load: () => loadSave()
};
game.start({ scenes: { title, play, end, ending }, scene: 'title' });
})();
