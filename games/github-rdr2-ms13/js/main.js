// RED HARROW — main game: scenes, combat, camp hub, mission driver.
import { Honor, Cores, Wanted, Focus, CampLedger, HorseBond, Challenges,
  pokerWinner, shuffled, newDeck, freshSave, LEDGER_LINES } from './systems.js';
import { TILE, MAP_W, MAP_H, landmarkPos, buildMap } from './world.js';
import { npcStyle, makeRig, makeSprites, pickupSpriteFor, makeAnimal, isAnimalTag } from './actors.js';
import { MissionRunner, strangerMission, checkFail } from './missions.js';
import { drawHUD, drawObjectiveArrow } from './ui.js';
import { defineWestern, playSong } from './audio.js';

const E = window.My3D2dge;
const clampNum = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- Global state ----------
const G = {
  data: null, game: null, sprites: null,
  save: freshSave(),
  honor: new Honor(), cores: new Cores(), wanted: new Wanted(),
  focus: new Focus(), ledger: new CampLedger(), bond: new HorseBond(),
  challenges: new Challenges(),
  charById: new Map(), missionById: new Map(),
  talk: null, menu: null, overlay: null, paused: false,
  stats: { kills: 0, earned: 0 },
};

const CHAPTER_BIOME = { 1: 'snow', 2: 'grass', 3: 'grass', 4: 'city', 5: 'jungle', 6: 'forest', 7: 'grass', 8: 'grass' };
const CHAPTER_COUNTY = { 1: 'Whitecap Reach', 2: 'Cinderfield', 3: 'Cinderfield', 4: 'Giltmarch', 5: 'Isle of Crows', 6: 'Ironvale', 7: 'Ironvale', 8: 'Ironvale' };
const CHOICE_HONOR = { c5m8: [-1, 1], c6m14: [-1, 1], c6m18: [2, -1] };

function charName(id) { const c = G.charById.get(id); return c ? c.name : String(id).toLowerCase().replace(/_/g, ' '); }
function charRole(id) {
  const c = G.charById.get(id);
  return c ? c.role : '';
}
function allMissions() { return G.data.chapters.missions; }
function currentMission() { return allMissions()[G.save.mission] || null; }

function syncSaveToSystems() {
  G.honor = new Honor(G.save.honor);
  G.focus.level = G.save.focusLevel; G.focus.xp = G.save.focusXp;
  G.bond.level = G.save.bondLevel; G.bond.xp = G.save.bondXp;
  G.ledger.funds = G.save.ledger.funds;
  G.ledger.lines = { ...G.save.ledger.lines };
  G.challenges.rank = { ...G.save.challenges };
  if (G.save.cores) {
    G.cores.core = { ...G.save.cores.core };
    G.cores.ring = { ...G.save.cores.ring };
  }
}
function syncSystemsToSave() {
  G.save.honor = G.honor.v;
  G.save.focusLevel = G.focus.level; G.save.focusXp = G.focus.xp;
  G.save.bondLevel = G.bond.level; G.save.bondXp = G.bond.xp;
  G.save.ledger = { funds: G.ledger.funds, lines: { ...G.ledger.lines } };
  G.save.challenges = { ...G.challenges.rank };
  G.save.cores = { core: { ...G.cores.core }, ring: { ...G.cores.ring } };
}
function persist() { syncSystemsToSave(); E.store.set('redharrow:save', G.save); E.store.set('redharrow:stats', G.stats); }
function loadPersisted() {
  const s = E.store.get('redharrow:save', null);
  if (s) { G.save = { ...freshSave(), ...s }; syncSaveToSystems(); }
  const st = E.store.get('redharrow:stats', null);
  if (st) G.stats = st;
}

// Resolve a mission place name to a walkable world position (deterministic).
function resolvePlace(map, place, seed) {
  const p = landmarkPos(place, seed);
  for (let rad = 0; rad < 12; rad++) {
    for (let dy = -rad; dy <= rad; dy++) {
      for (let dx = -rad; dx <= rad; dx++) {
        const cx = Math.floor(p.x / TILE) + dx, cy = Math.floor(p.y / TILE) + dy;
        if (cx > 0 && cy > 0 && cx < MAP_W - 1 && cy < MAP_H - 1 && map.walkable(cx, cy)) {
          return { x: cx * TILE + 8, y: cy * TILE + 8 };
        }
      }
    }
  }
  return p;
}

function archetype(tag) {
  if (/COLE_RATTLER|AGENT_QUILL/.test(tag)) return { hp: 160, dmg: 12, speed: 62, ranged: true, xp: 60, boss: true };
  if (/GREY_MAW|OLD_IVORY/.test(tag)) return { hp: 220, dmg: 20, speed: 70, ranged: false, xp: 80, boss: true };
  if (/KETT_MORAN|GOV_CAZAL|COL_MARROW|DON_VECCHIO/.test(tag)) return { hp: 120, dmg: 10, speed: 60, ranged: true, xp: 50, boss: true };
  if (/RABBIT|HARE|TARGET/.test(tag)) return { hp: 6, dmg: 0, speed: 70, ranged: false, xp: 4, flees: true };
  if (/WOLF|COYOTE|GATOR|BEAR|BOAR|COUGAR|PANTHER/.test(tag)) return { hp: 30, dmg: 8, speed: 78, ranged: false, xp: 12 };
  if (/LAW|GUARD|DEPUTY|AGENT|BOUNTY|SHERIFF/.test(tag)) return { hp: 32, dmg: 8, speed: 58, ranged: true, xp: 10, law: true };
  if (/SOLDIER|OVERSEER/.test(tag)) return { hp: 36, dmg: 9, speed: 56, ranged: true, xp: 12 };
  return { hp: 26, dmg: 6, speed: 60, ranged: true, xp: 8 }; // bandits et al
}

function spawnEnemy(tag, x, y) {
  const a = archetype(tag);
  const animal = isAnimalTag(tag);
  const e = {
    tag, x, y, r: 5, hp: a.hp, maxhp: a.hp, dmg: a.dmg, speed: a.speed,
    ranged: a.ranged, xp: a.xp, law: !!a.law, boss: !!a.boss, flees: !!a.flees,
    body: new E.Body({ x, y, r: 5 }), shootT: 1 + Math.random() * 2, hitT: 0, facing: 0,
    rig: animal ? makeAnimal(E, tag) : makeRig(E, npcStyle(tag), 'gun'),
    animal, dead: false,
  };
  e.body.facing = 0;
  return e;
}

function spawnNpc(id, x, y, opts = {}) {
  const style = npcStyle(id);
  return {
    id, x, y, r: 5, name: charName(id), role: charRole(id),
    body: new E.Body({ x, y, r: 5 }), rig: makeRig(E, style, style === 'lady' || /JONAH|ADA_WARD/.test(id) ? null : 'gun'),
    facing: Math.PI / 2, station: opts.station || null, follows: false, talk: opts.talk || null,
  };
}

// ---------- Shared playfield ----------
function makePlayer(x, y, EPOV) {
  const body = new E.Body({ x, y, r: 5 });
  body.facing = 0;
  return {
    body, x, y, r: 5, facing: 0, hurt: 0, cool: 0, melee: new E.Combo(['jab', 'cross', 'uppercut'], { window: 0.35 }),
    rig: makeRig(E, 'player', 'gun'), aim: 0, pointing: false,
    horse: { x: x + 30, y: y + 10, mounted: false, dark: EPOV },
    tags: [], // focus-marked enemies
  };
}
function syncProxy(o) { o.x = o.body.x; o.y = o.body.y; return o; }

function playerSpeed(P) { return P.horse.mounted ? 185 : 88; }

function updatePlayer(dt, S, P, map, allowCombat) {
  const inp = G.game.input;
  const m = inp.move();
  const d = G.game.view.screenDirToGround(m[0], m[1]);
  const sp = playerSpeed(P);
  P.body.vx = d[0] * sp; P.body.vy = d[1] * sp;
  P.body.update(dt, map);
  syncProxy(P);
  if (Math.hypot(d[0], d[1]) > 0.15) P.facing = Math.atan2(d[1], d[0]);
  // Aim: mouse ground point, else facing.
  const mg = G.game.mouseGround();
  P.pointing = false;
  if (mg) { P.aim = Math.atan2(mg[1] - P.y, mg[0] - P.x); }
  // Dash.
  if (inp.pressed('dash') && G.cores.ring.stamina > 15 && !P.horse.mounted) {
    G.cores.drain('stamina', 15);
    P.body.vx = Math.cos(P.facing) * 260; P.body.vy = Math.sin(P.facing) * 260;
    G.game.audio.sfx('dash');
    G.game.particles.dust(P.x, P.y, 0, 6);
  }
  P.cool -= dt; P.hurt -= dt; P.melee.update(dt);
  // Focus toggle.
  if (allowCombat && inp.pressed('skill') && !G.focus.active && G.focus.meter > 10) {
    G.focus.active = true; G.game.timeScale = 0.25; G.game.audio.sfx('focus');
  } else if (allowCombat && inp.pressed('skill') && G.focus.active) {
    resolveFocusTags(S, P);
  }
  if (G.focus.active) {
    G.focus.drain(dt * 4); // dt is game-time at 0.25 scale; drain in real time
    G.cores.drain('focus', dt * 6);
    if (G.focus.meter <= 0) resolveFocusTags(S, P);
  } else {
    G.focus.regen(dt);
    G.cores.restore('stamina', dt * 4);
  }
  // Attack.
  if (allowCombat && inp.buffered('attack')) {
    const victim = nearestEnemy(S.enemies, mg || { x: P.x + Math.cos(P.facing) * 40, y: P.y + Math.sin(P.facing) * 40 }, 30);
    if (G.focus.active) {
      if (victim && P.tags.length < G.focus.tagsAllowed() && !P.tags.includes(victim)) {
        P.tags.push(victim); inp.consume('attack'); G.game.audio.sfx('select');
        G.game.particles.glints(victim.x, victim.y, 10, 4, '#e8b83a');
      } else inp.consume('attack');
    } else if (victim && E.dist(P, victim) < 34) {
      if (P.melee.press()) {
        inp.consume('attack'); G.game.audio.sfx('punch');
        P.melee.hits(S.enemies.filter((e) => !e.dead), (t) => E.inArc(P, P.facing, syncProxy(t), 30, 1.2), (t) => {
          damageEnemy(S, P, t, 14, true);
        });
      }
    } else if (P.cool <= 0) {
      inp.consume('attack'); P.cool = 0.28; P.pointing = true;
      const ang = mg ? Math.atan2(mg[1] - P.y, mg[0] - P.x) : P.facing;
      P.facing = ang;
      S.shots.fire({ x: P.x, y: P.y, z: 14, vx: Math.cos(ang) * 340, vy: Math.sin(ang) * 340, r: 2, team: 'player', color: '#ffd83a', life: 1.2, dmg: 12 });
      G.game.audio.sfx('gunshot');
      G.game.particles.sparks(P.x + Math.cos(ang) * 10, P.y + Math.sin(ang) * 10, 14, 3);
      G.cores.train('stamina', 1);
    }
  }
  P.rig.update(dt, { x: P.x, y: P.y, z: 0, vx: P.body.vx, vy: P.body.vy, facing: P.facing, attack: P.melee.state, hurt: P.hurt > 0.4, point: P.pointing || G.focus.active });
  // Horse follows when rider is on foot.
  const H = P.horse;
  if (!H.mounted) {
    const dx = P.x - H.x, dy = P.y - H.y, dd = Math.hypot(dx, dy);
    if (dd > 60) { H.x += (dx / dd) * 120 * dt; H.y += (dy / dd) * 120 * dt; }
  } else { H.x = P.x; H.y = P.y + 2; G.bond.gain(dt * 2); }
}

function nearestEnemy(enemies, pt, maxD) {
  let best = null, bd = maxD;
  for (const e of enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - pt.x, e.y - pt.y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

function resolveFocusTags(S, P) {
  G.focus.active = false; G.game.timeScale = 1;
  for (const t of P.tags) {
    if (t.dead) continue;
    G.game.particles.sparks(t.x, t.y, 12, 8);
    G.game.audio.sfx('gunshot');
    damageEnemy(S, P, t, 30, false, true);
  }
  P.tags = [];
}

function damageEnemy(S, P, e, dmg, melee, focusKill) {
  if (e.dead) return;
  e.hp -= dmg * (e.boss ? 0.7 : 1); e.hitT = 0.15;
  G.game.hitFx(e.x, e.y, 8, { damage: Math.round(dmg), angle: P.facing });
  if (e.hp <= 0) {
    e.dead = true; G.stats.kills += 1;
    G.game.particles.explosion(e.x, e.y, 6, 0.7);
    G.game.audio.sfx('die');
    G.focus.gain(focusKill ? 20 : 8);
    G.cores.train('health', 2);
    if (e.law) { G.wanted.crime(S.county, 1); G.honor.add(-1); G.game.audio.sfx('wanted'); }
    if (S.onKill) S.onKill(e);
  } else {
    G.game.audio.sfx('hit');
    E.knockback(P, e.body, melee ? 200 : 60, 0);
  }
  syncProxy(e);
}

function updateEnemies(dt, S, P, map, flow) {
  flow.update(P.x, P.y);
  const inp = G.game.input;
  void inp;
  for (const e of S.enemies) {
    if (e.dead) continue;
    const d = E.dist(P, e);
    let mvx = 0, mvy = 0;
    if (e.flees) {
      if (d < 120) { const a = Math.atan2(e.y - P.y, e.x - P.x); mvx = Math.cos(a); mvy = Math.sin(a); }
    } else if (e.ranged && d < 230) {
      // Hold and shoot when the shot is clear.
      if (map.los(e.x, e.y, P.x, P.y)) {
        e.facing = Math.atan2(P.y - e.y, P.x - e.x);
        e.shootT -= dt;
        if (e.shootT <= 0 && d > 40) {
          e.shootT = 1.6 + Math.random();
          const v = E.pattern.aim(e, P, 170);
          S.shots.fire({ x: e.x, y: e.y, z: 14, vx: v[0], vy: v[1], r: 2, team: 'foe', color: '#ff6080', life: 2, dmg: e.dmg });
          G.game.audio.sfx('shoot');
        }
      } else { const dir = flow.dir(e.x, e.y, P.x, P.y); mvx = dir[0]; mvy = dir[1]; }
    } else if (!e.ranged && d < 300) {
      const dir = flow.dir(e.x, e.y, P.x, P.y); mvx = dir[0]; mvy = dir[1];
      if (d < 16) {
        e.shootT -= dt;
        if (e.shootT <= 0) { e.shootT = 1.1; hurtPlayer(S, P, e.dmg, e); }
      }
    } else if (d >= 230 && d < 520) {
      const dir = flow.dir(e.x, e.y, P.x, P.y); mvx = dir[0]; mvy = dir[1];
    }
    e.body.vx = E.approach(e.body.vx, mvx * e.speed, 400 * dt);
    e.body.vy = E.approach(e.body.vy, mvy * e.speed, 400 * dt);
    e.body.update(dt, map);
    syncProxy(e);
    e.hitT -= dt;
    if (Math.hypot(mvx, mvy) > 0.1) e.facing = Math.atan2(mvy, mvx);
    if (e.animal) e.rig.update(dt, { look: [mvx, mvy], walk: Math.hypot(mvx, mvy) > 0.1 ? 1 : 0, squash: Math.sin(G.game.time * 8 + e.x) * 0.12 });
    else e.rig.update(dt, { x: e.x, y: e.y, z: 0, vx: e.body.vx, vy: e.body.vy, facing: e.facing, hurt: e.hitT > 0.08, point: e.ranged && d < 230 });
  }
  E.prune(S.enemies, (e) => e.dead && (e.gone = (e.gone || 0) + dt) > 0.5);
}

function hurtPlayer(S, P, dmg, from) {
  if (P.hurt > 0 || G.cores.dead) return;
  P.hurt = 0.8;
  G.cores.drain('health', dmg);
  G.game.audio.sfx('hurt'); G.game.shake(3); G.game.flash('#ff4040', 0.15);
  if (from) E.knockback(from, P.body, 160, 0);
  if (G.cores.dead && S.onDeath) S.onDeath();
}

function updateBullets(dt, S, P, map) {
  S.shots.update(dt, map);
  S.shots.hit(S.enemies.filter((e) => !e.dead).map(syncProxy), (b, t) => {
    damageEnemy(S, P, t, b.dmg || 10, false);
    G.game.particles.sparks(b.x, b.y, 8, 3);
  }, 'player');
  if (S.shots.hit([syncProxy(P)], () => {}, 'foe')) {
    hurtPlayer(S, P, 8, null);
  }
}

function drawField(r, S, P, skyOverride) {
  const sky = skyOverride || S.sky;
  r.sky(sky);
  S.map.drawFloor(r);
  S.map.queueWalls(r);
  for (const k of S.pickups) {
    if (k.taken) continue;
    r.sprite(k.x, k.y, 0, k.spr, { anchor: 'center' });
  }
  for (const n of S.npcs) {
    r.shadow(n.x, n.y, 6);
    r.actor(n.x, n.y, 0, (g, ox, oy) => n.rig.draw(g, ox, oy, r.view));
    if (n.mark) r.textAt(n.x, n.y, 34, '!', '#ffd83a');
  }
  for (const e of S.enemies) {
    if (e.dead) continue;
    r.shadow(e.x, e.y, 6);
    r.actor(e.x, e.y, 0, (g, ox, oy) => e.rig.draw(g, ox, oy, r.view), { flash: e.hitT > 0 ? '#ffffff' : undefined });
    if (P.tags.includes(e)) r.textAt(e.x, e.y, 34, '✕', '#ff4040');
    else if (e.boss) r.textAt(e.x, e.y, 34, '★', '#ff4040');
  }
  // Horse under rider.
  const H = P.horse;
  r.shadow(H.x, H.y, 7);
  r.sprite(H.x, H.y, 0, H.dark ? G.sprites.horseDark : G.sprites.horse, { anchor: 'center' });
  r.shadow(P.x, P.y, 6);
  r.actor(P.x, P.y, H.mounted ? 6 : 0, (g, ox, oy) => P.rig.draw(g, ox, oy, r.view), { alpha: P.hurt > 0 ? 0.6 : 1 });
  S.shots.draw(r);
}

// ---------- Overlays: poker, fishing, journal ----------
function openPoker(stake, onDone) {
  const deck = shuffled(newDeck());
  G.overlay = { kind: 'poker', stake, deck, di: 10, mine: deck.slice(0, 5), foe: deck.slice(5, 10), stage: 'bet', msg: 'Your call, rider.', result: 0 };
  G.menu = new E.Menu(G.game, ['Stand pat', 'Draw three cards', 'Fold'], {
    title: `POKER — $10 TABLE (bet $${stake})`,
    onPick: (i) => {
      const o = G.overlay;
      if (i === 2) { G.save.cash = Math.max(0, (G.save.cash || 0) - stake); o.result = -1; o.msg = 'You fold. The table laughs.'; o.stage = 'show'; }
      else {
        if (i === 1) { o.mine = [o.mine[0], o.mine[1], o.deck[o.di++], o.deck[o.di++], o.deck[o.di++]]; }
        const w = pokerWinner(o.mine, o.foe);
        o.result = w;
        if (w > 0) { G.save.cash += stake * 2; G.stats.earned += stake * 2; o.msg = 'You take the pot!'; G.game.audio.sfx('cash'); }
        else if (w < 0) { G.save.cash = Math.max(0, G.save.cash - stake); o.msg = 'The house takes it.'; }
        else o.msg = 'Push. Nobody wins.';
        o.stage = 'show';
      }
      G.menu = new E.Menu(G.game, ['Continue'], { title: 'POKER', onPick: () => { const cb = G.overlay.onDone; G.overlay = null; G.menu = null; persist(); if (cb) cb(); } });
    },
    onCancel: () => { const cb = G.overlay.onDone; G.overlay = null; G.menu = null; if (cb) cb(); },
  });
  G.overlay.onDone = onDone;
}

function updatePoker(dt) {
  void dt;
  if (G.menu) G.menu.update();
}
function drawPoker(r) {
  const o = G.overlay;
  r.overlay((g) => {
    E.ui.box(g, 40, 40, r.W - 80, 130, { bg: '#0e2a14' });
    E.font.text(g, 'FIVE-CARD DRAW', r.W / 2, 48, '#ffe08a', { align: 'center', outline: false });
    E.font.text(g, `You:  ${o.mine.join(' ')}`, r.W / 2, 66, '#ffffff', { align: 'center', outline: false });
    E.font.text(g, o.stage === 'show' ? `Foe:  ${o.foe.join(' ')}` : 'Foe:  ?? ?? ?? ?? ??', r.W / 2, 82, '#ffb0a0', { align: 'center', outline: false });
    E.font.text(g, o.msg, r.W / 2, 100, '#ffe08a', { align: 'center', outline: false });
    E.font.text(g, `Cash: $${G.save.cash}`, r.W / 2, 116, '#a0e8a0', { align: 'center', outline: false });
  });
  if (G.menu) G.menu.draw(r);
}

function openFishing(need, onDone) {
  G.overlay = { kind: 'fish', pos: 0, dir: 1, speed: 0.9, caught: 0, need, msg: 'Strike when the float crosses the ripple! (ATTACK)', onDone };
}
function updateFishing(dt) {
  const o = G.overlay;
  o.pos += o.dir * o.speed * dt;
  if (o.pos > 1) { o.pos = 1; o.dir = -1; }
  if (o.pos < 0) { o.pos = 0; o.dir = 1; }
  const inp = G.game.input;
  if (inp.pressed('attack') || inp.pressed('confirm')) {
    if (o.pos > 0.42 && o.pos < 0.58) {
      o.caught += 1; o.speed += 0.15; G.game.audio.sfx('coin');
      o.msg = `Caught one! (${o.caught}/${o.need})`;
      if (o.caught >= o.need) { const cb = o.onDone; G.overlay = null; persist(); if (cb) cb(); }
    } else { o.msg = 'It slipped away...'; G.game.audio.sfx('bump'); }
  }
  if (inp.pressed('cancel')) { const cb = o.onDone; G.overlay = null; if (cb) cb(); }
}
function drawFishing(r) {
  const o = G.overlay;
  r.overlay((g) => {
    E.ui.box(g, 60, 70, r.W - 120, 80, { bg: '#0a1a2a' });
    E.font.text(g, 'FISHING', r.W / 2, 78, '#7ab8d8', { align: 'center', outline: false });
    E.px.rect(g, 80, 100, r.W - 160, 10, '#1a3a5a');
    E.px.rect(g, 80 + (r.W - 160) * 0.42, 100, (r.W - 160) * 0.16, 10, '#40d8a8');
    E.px.rect(g, 80 + (r.W - 160) * o.pos - 2, 97, 4, 16, '#ffd83a');
    E.font.text(g, o.msg, r.W / 2, 118, '#ffffff', { align: 'center', outline: false });
  });
}

function openJournal() { G.overlay = { kind: 'journal' }; }
function updateJournal() {
  const inp = G.game.input;
  if (inp.pressed('confirm') || inp.pressed('cancel') || inp.pressed('pause')) G.overlay = null;
}
function drawJournal(r) {
  const m = currentMission();
  r.overlay((g) => {
    E.ui.box(g, 30, 20, r.W - 60, r.H - 40, { bg: '#141020' });
    E.font.text(g, 'JOURNAL OF CADE HOLLIS', r.W / 2, 28, '#ffe08a', { align: 'center', outline: false });
    const lines = [
      `Chapter ${G.save.chapter} — missions done: ${G.save.mission}/104`,
      m ? `Next: ${m.t} (${charName(m.g)})` : 'Story complete — the territory is quiet.',
      `Honor: ${G.honor.v} (${G.honor.rank()})   Cash: $${G.save.cash}`,
      `Focus: ${G.focus.level}   Horse bond: ${G.bond.name()}   Bounty owed: $${G.wanted.total}`,
      `Kills: ${G.stats.kills}   Earned: $${G.stats.earned}   Relics: ${G.save.relics}/30`,
      `Challenges: ${G.challenges.total()}/90   Stranger parts: ${G.save.strangersDone.length}`,
    ];
    lines.forEach((ln, i) => E.font.text(g, ln, r.W / 2, 48 + i * 14, '#ffffff', { align: 'center', outline: false }));
    E.font.text(g, 'ENTER/click: close', r.W / 2, r.H - 34, '#a0a0b8', { align: 'center', outline: false });
  });
}

function updateOverlay(dt) {
  if (!G.overlay) return false;
  if (G.overlay.kind === 'poker') updatePoker(dt);
  else if (G.overlay.kind === 'fish') updateFishing(dt);
  else if (G.overlay.kind === 'journal') updateJournal();
  return true;
}
function drawOverlay(r) {
  if (!G.overlay) return;
  if (G.overlay.kind === 'poker') drawPoker(r);
  else if (G.overlay.kind === 'fish') drawFishing(r);
  else if (G.overlay.kind === 'journal') drawJournal(r);
}

function openPause(inMission) {
  G.paused = true;
  const items = ['Resume', 'Journal'];
  if (inMission) items.push('Abandon mission');
  items.push('Quit to title');
  G.menu = new E.Menu(G.game, items, {
    title: 'PAUSED',
    onPick: (i, item) => {
      const label = typeof item === 'string' ? item : item.label;
      if (label === 'Resume') { G.paused = false; G.menu = null; }
      else if (label === 'Journal') { G.paused = false; G.menu = null; openJournal(); }
      else if (label === 'Abandon mission') { G.paused = false; G.menu = null; G.focus.active = false; G.game.timeScale = 1; G.game.go('camp'); }
      else { G.paused = false; G.menu = null; G.focus.active = false; G.game.timeScale = 1; persist(); G.game.go('title'); }
    },
    onCancel: () => { G.paused = false; G.menu = null; },
  });
}

// ---------- Camp scene ----------
const campScene = {
  pausable: false,
  enter() {
    const m = currentMission();
    const ch = m ? m.ch : 8;
    G.save.chapter = ch;
    const biome = CHAPTER_BIOME[ch] || 'grass';
    const built = buildMap(E, biome, 1000 + ch);
    const camp = resolvePlace(built.map, 'CAMP', 1000 + ch);
    const EPOV = ch >= 7;
    this.S = {
      map: built.map, flow: built.flow, sky: built.sky, county: CHAPTER_COUNTY[ch] || 'Cinderfield',
      enemies: [], npcs: [], pickups: [], shots: new E.Bullets(G.game), stations: [],
      P: makePlayer(camp.x, camp.y, EPOV),
    };
    this.ch = ch;
    // Gang NPCs around the fire with banter.
    const gangIds = ['SILAS_VANE', 'FATHER_ANSEL', 'ELI_WARD', 'JUNE_CALLOWAY', 'OLD_BODIE', 'WIDOW_KARN', 'HUNTER_GREY', 'THEO_COLE'];
    gangIds.forEach((id, i) => {
      const a = (i / gangIds.length) * Math.PI * 2;
      const n = spawnNpc(id, camp.x + Math.cos(a) * 46, camp.y + Math.sin(a) * 36);
      n.talk = banterFor(id, ch);
      this.S.npcs.push(n);
    });
    // Stations ring.
    const defs = [
      ['giver', 'Mission', 0, -64], ['ledger', 'Ledger', 56, -28], ['shop', 'Store', 56, 28],
      ['stable', 'Stable', 0, 64], ['bed', 'Bedroll', -56, 28], ['post', 'Post office', -56, -28],
      ['poker', 'Card table', 88, 0], ['stranger', 'Stranger', -88, 0],
    ];
    for (const [kind, label, dx, dy] of defs) this.S.stations.push({ kind, label, x: camp.x + dx, y: camp.y + dy });
    G.game.follow(this.S.P);
    G.game.cam.bounds = (v) => built.map.bounds(v);
    playSong(G.game.audio, ch === 4 ? 'town' : 'ride');
    G.talk = new E.Dialog(G.game);
  },
  update(dt) {
    if (G.talk.update(dt)) return;
    if (G.paused) { if (G.menu) G.menu.update(); return; }
    if (updateOverlay(dt)) return;
    if (G.menu) { G.menu.update(); return; }
    const inp = G.game.input;
    if (inp.pressed('pause')) { openPause(false); return; }
    if (inp.pressed('viewcycle')) G.game.nextView();
    const S = this.S, P = S.P;
    updatePlayer(dt, S, P, S.map, false);
    for (const n of S.npcs) n.rig.update(dt, { x: n.x, y: n.y, z: 0, vx: 0, vy: 0, facing: n.facing });
    G.wanted.tick(dt, true);
    // Interact: horse, NPCs, stations.
    if (inp.pressed('interact')) {
      if (E.dist(P, P.horse) < 30) {
        P.horse.mounted = !P.horse.mounted;
        G.game.audio.sfx(P.horse.mounted ? 'jump' : 'land');
        if (P.horse.mounted) G.game.note('Mounted — ride with WASD', 1.5);
      } else {
        const n = nearestNpc(S.npcs, P, 30);
        const st = nearestStation(S.stations, P, 26);
        if (n && (!st || E.dist(P, n) < E.dist(P, st))) talkTo(n, null);
        else if (st) useStation(st);
      }
    }
    G.game.follow(P);
  },
  draw(r) {
    drawField(r, this.S, this.S.P);
    for (const st of this.S.stations) {
      r.groundRing(st.x, st.y, 9, '#7ab8d8', 0.8);
      r.textAt(st.x, st.y, 30, st.label, '#7ab8d8');
    }
    const m = currentMission();
    drawHUD(r, E, hudState(), {
      chapter: this.ch,
      tracker: m ? `Next: ${m.t} — see ${charName(m.g === 'AUTO' ? 'SILAS_VANE' : m.g)}` : 'Story complete',
      hint: 'WASD move · E interact · F focus · ESC pause',
    });
    G.talk.draw(r);
    if (G.menu) G.menu.draw(r);
    drawOverlay(r);
  },
};

function hudState() {
  return { cores: G.cores, honor: G.honor, wanted: G.wanted, cash: G.save.cash, focus: G.focus };
}
function nearestNpc(npcs, P, maxD) {
  let best = null, bd = maxD;
  for (const n of npcs) { const d = E.dist(P, n); if (d < bd) { bd = d; best = n; } }
  return best;
}
function nearestStation(stations, P, maxD) {
  let best = null, bd = maxD;
  for (const s of stations) { const d = Math.hypot(P.x - s.x, P.y - s.y); if (d < bd) { bd = d; best = s; } }
  return best;
}
function banterFor(id, ch) {
  const lines = {
    SILAS_VANE: ['Tahiti, Cade. One last score and we vanish.', 'I have a PLAN. We just need money.'],
    FATHER_ANSEL: ['A con is just a story men pay to believe.', 'Easy, Cade. Think before you shoot.'],
    ELI_WARD: ['One day I am out of this life. You watch.', 'You ever think about... not running?'],
    JUNE_CALLOWAY: ['Nobody is taking anything from me ever again.', 'You need a gun? I am a gun.'],
    OLD_BODIE: ['Lumbago. Terrible lumbago.', 'I have got years of leisure ahead of me.'],
    WIDOW_KARN: ['Tent, stew, order. In that order.', 'You track mud in my camp, you answer to me.'],
    HUNTER_GREY: ['The herd moved north. The law moves south.', 'Quiet now. Listen to the territory.'],
    THEO_COLE: ['I am ready for the big jobs, Cade!', 'Did you see that shot? Tell me you saw it.'],
  };
  const l = lines[id] || ['The fire is warm. The coffee is not.'];
  return [l[ch % l.length]];
}
function talkTo(n, onDone) {
  G.talk.say(n.talk || [`${n.name} nods at you.`], { name: n.name.toUpperCase(), onDone: onDone || (() => {}) });
  G.game.audio.sfx('blip');
}

function useStation(st) {
  const m = currentMission();
  if (st.kind === 'giver') {
    if (!m) { G.talk.say(['The territory is quiet, Cade. Ride easy.'], { name: 'SILAS VANE' }); return; }
    const giver = m.g === 'AUTO' ? 'SILAS_VANE' : m.g;
    G.talk.say([`"${m.t}."`, m.b, 'Are you riding out?'], {
      name: charName(giver).toUpperCase(),
      choices: ['Ride out', 'Not yet'],
      onChoice: (i) => { if (i === 0) { persist(); G.game.go('mission', { mission: m }); } },
    });
  } else if (st.kind === 'ledger') {
    const items = ['Donate $25', ...LEDGER_LINES.map((l) => `Fund ${l} ($${G.ledger.cost(l) === Infinity ? 'MAX' : G.ledger.cost(l)})`), 'Leave'];
    G.menu = new E.Menu(G.game, items, {
      title: `LEDGER — funds $${G.ledger.funds}`,
      onPick: (i) => {
        if (i === 0) {
          if (G.save.cash >= 25) { G.save.cash -= 25; G.ledger.funds += 25; G.honor.add(1); G.game.audio.sfx('cash'); }
          else G.game.audio.sfx('cancel');
        } else if (i < items.length - 1) {
          const line = LEDGER_LINES[i - 1];
          if (G.ledger.buy(line)) { G.game.audio.sfx('powerup'); G.game.note(`${line} funded!`, 2); }
          else G.game.audio.sfx('cancel');
        }
        G.menu = null; persist();
      },
      onCancel: () => { G.menu = null; },
    });
  } else if (st.kind === 'shop') {
    const disc = G.honor.discount();
    const food = Math.max(1, Math.round(5 * (1 - disc / 100)));
    const tonic = Math.max(1, Math.round(12 * (1 - disc / 100)));
    G.menu = new E.Menu(G.game, [`Hot meal $${food} (restore)`, `Tonic $${tonic} (full cores)`, 'Leave'], {
      title: "SIMMS' STORE",
      onPick: (i, item) => {
        void item;
        if (i === 0 && G.save.cash >= food) { G.save.cash -= food; G.cores.restore('health', 60); G.cores.restore('stamina', 60); G.game.audio.sfx('heal'); }
        else if (i === 1 && G.save.cash >= tonic) { G.save.cash -= tonic; G.cores.rest(); G.game.audio.sfx('powerup'); }
        else G.game.audio.sfx('cancel');
        G.menu = null; persist();
      },
      onCancel: () => { G.menu = null; },
    });
  } else if (st.kind === 'stable') {
    G.menu = new E.Menu(G.game, ['Brush horse (bond+)', 'Buy oats $3 (bond++)', 'Leave'], {
      title: `STABLE — ${G.bond.name()} (${G.bond.perks().join(', ')})`,
      onPick: (i) => {
        if (i === 0) { G.bond.gain(12); G.game.audio.sfx('heal'); }
        else if (i === 1 && G.save.cash >= 3) { G.save.cash -= 3; G.bond.gain(25); G.game.audio.sfx('cash'); }
        G.menu = null; persist();
      },
      onCancel: () => { G.menu = null; },
    });
  } else if (st.kind === 'bed') {
    G.cores.rest(); G.game.audio.sfx('heal'); G.game.note('Rested. Cores restored.', 2); persist();
  } else if (st.kind === 'post') {
    const counties = Object.entries(G.wanted.bounties).filter(([, v]) => v > 0);
    if (!counties.length) { G.talk.say(['No bounties on your head. Stay sweet.'], { name: 'POST CLERK' }); return; }
    G.menu = new E.Menu(G.game, [...counties.map(([c, v]) => `Pay ${c} $${v}`), 'Leave'], {
      title: 'POST OFFICE',
      onPick: (i) => {
        if (i < counties.length) {
          const [c] = counties[i];
          if (G.wanted.pay(c, G.save)) G.game.audio.sfx('cash'); else G.game.audio.sfx('cancel');
        }
        G.menu = null; persist();
      },
      onCancel: () => { G.menu = null; },
    });
  } else if (st.kind === 'poker') {
    if (G.save.cash < 10) { G.talk.say(['Come back with $10, rider.'], { name: 'DEALER' }); return; }
    openPoker(10, null);
  } else if (st.kind === 'stranger') {
    const next = nextStrangerPart();
    if (!next) { G.talk.say(['No strangers need help right now.'], { name: 'STRANGER' }); return; }
    const sm = strangerMission(next.arc, next.part, G.data.characters);
    G.talk.say([`"${next.arc.t}."`, next.arc.b, `Part ${next.part} of ${next.arc.parts}. Help out?`], {
      name: 'STRANGER',
      choices: ['Help out', 'Walk away'],
      onChoice: (i) => { if (i === 0) G.game.go('mission', { mission: sm, stranger: { arc: next.arc.id, part: next.part } }); },
    });
  }
}

function nextStrangerPart() {
  for (const arc of G.data.strangers.strangers) {
    for (let p = 1; p <= arc.parts; p++) {
      if (!G.save.strangersDone.includes(`${arc.id}:${p}`)) return { arc, part: p };
    }
  }
  return null;
}

// ---------- Mission scene: runs every mission in data ----------
const missionScene = {
  pausable: false,
  enter(data) {
    const mission = data.mission;
    const ch = mission.ch || 2;
    const seed = hashId(mission.id);
    const biome = mission.ch === 0 ? 'grass' : (CHAPTER_BIOME[ch] || 'grass');
    const built = buildMap(E, biome, seed);
    const camp = resolvePlace(built.map, 'CAMP', seed);
    const EPOV = ch >= 7;
    this.M = {
      mission, stranger: data.stranger || null, ch, seed, county: CHAPTER_COUNTY[ch] || 'Cinderfield',
      map: built.map, flow: built.flow, sky: built.sky,
      enemies: [], npcs: [], pickups: [], shots: new E.Bullets(G.game),
      P: makePlayer(camp.x, camp.y, EPOV),
      runner: new MissionRunner(mission),
      elapsed: 0, strayT: 0, seen: false, target: null, trickleT: 0, lawT: 0,
      huntNeed: 0, huntCount: 0, opened: false, over: false,
      places: new Map(),
    };
    const S = this.M;
    S.onKill = (e) => this.onKill(e);
    S.onDeath = () => { if (!S.over) { S.runner.fail('You died'); this.showFail(); } };
    // Pre-resolve every goto/escort-target place.
    for (const [verb, a, b] of mission.o) {
      if (verb === 'goto' || verb === 'defend') S.places.set(a, resolvePlace(S.map, a, seed));
      if (verb === 'escort') S.places.set(b, resolvePlace(S.map, b, seed));
    }
    G.game.follow(S.P);
    G.game.cam.bounds = (v) => built.map.bounds(v);
    const hot = mission.o.some(([v]) => v === 'kill' || v === 'defend');
    playSong(G.game.audio, hot ? 'battle' : 'ride');
    G.talk = new E.Dialog(G.game);
    G.game.note(`${mission.t}`, 2.5);
    this.spawnObjective();
  },
  place(name) {
    const S = this.M;
    if (!S.places.has(name)) S.places.set(name, resolvePlace(S.map, name, S.seed));
    return S.places.get(name);
  },
  clearField() {
    const S = this.M;
    S.enemies = []; S.npcs = []; S.pickups = []; S.shots.clear();
    S.P.tags = [];
  },
  spawnObjective() {
    const S = this.M;
    S.opened = false;
    const c = S.runner.current();
    if (!c) return;
    const [verb, a, b] = c;
    S.target = null;
    if (verb === 'goto' || verb === 'defend') S.target = this.place(a);
    else if (verb === 'escort') {
      const npc = spawnNpc(a, S.P.x + 40, S.P.y);
      npc.follows = true; npc.mark = true;
      npc.talk = ['Stay close. We move together.'];
      S.npcs.push(npc);
      S.target = this.place(b);
      S.escortId = a;
    } else if (verb === 'talk') {
      const lp = resolvePlace(S.map, 'TALK_' + a, S.seed + S.runner.i);
      const npc = spawnNpc(a, lp.x, lp.y);
      npc.mark = true;
      npc.talk = [S.mission.b, '...'];
      S.npcs.push(npc);
      S.target = { x: lp.x, y: lp.y };
    } else if (verb === 'kill') {
      const lp = this.place('BATTLE_' + a + S.runner.i);
      for (let i = 0; i < b; i++) {
        const ang = (i / b) * Math.PI * 2;
        const e = spawnEnemy(a, lp.x + Math.cos(ang) * 70, lp.y + Math.sin(ang) * 50);
        S.enemies.push(e);
      }
      S.target = lp;
    } else if (verb === 'collect') {
      const lp = this.place('CACHE_' + a + S.runner.i);
      for (let i = 0; i < b; i++) {
        const ang = (i / Math.max(b, 1)) * Math.PI * 2;
        S.pickups.push({ item: a, x: lp.x + Math.cos(ang) * 60, y: lp.y + Math.sin(ang) * 44, spr: pickupSpriteFor(G.sprites, a), taken: false });
      }
      S.target = lp;
    } else if (verb === 'play' && a === 'HUNT') {
      S.huntNeed = 3; S.huntCount = 0;
      const lp = this.place('HUNTGROUND' + S.runner.i);
      const kinds = ['RABBIT', 'DEER', 'RABBIT'];
      kinds.forEach((k, i) => S.enemies.push(spawnEnemy('HUNT_' + k, lp.x + (i - 1) * 60, lp.y + (i % 2) * 40)));
      S.target = lp;
    } else if (verb === 'mount') {
      S.target = { x: S.P.horse.x, y: S.P.horse.y, horse: true };
    }
  },
  onKill(e) {
    const S = this.M;
    if (e.tag.startsWith('HUNT_')) {
      S.huntCount += 1;
      if (S.huntCount >= S.huntNeed) this.advanced(S.runner.notify({ t: 'play', game: 'HUNT' }));
      return;
    }
    this.advanced(S.runner.notify({ t: 'kill', tag: e.tag }));
  },
  advanced(res) {
    const S = this.M;
    if (res === 'advanced') {
      G.game.audio.sfx('powerup');
      G.game.note('Objective complete — checkpoint', 1.6);
      this.clearField();
      this.spawnObjective();
    } else if (res === 'done') this.complete();
  },
  update(dt) {
    const S = this.M;
    if (G.talk.update(dt)) return;
    if (G.paused) { if (G.menu) G.menu.update(); return; }
    if (updateOverlay(dt)) return;
    if (G.menu) { G.menu.update(); return; }
    const inp = G.game.input;
    if (inp.pressed('pause')) { openPause(true); return; }
    if (inp.pressed('viewcycle')) G.game.nextView();
    if (S.over) return;
    const P = S.P;
    S.elapsed += dt;
    // One-shot objective openers (choice / pay / poker / fishing).
    const c = S.runner.current();
    if (c && !S.opened) {
      const [verb, a] = c;
      if (verb === 'choice') {
        S.opened = true;
        G.talk.say([c[0] === 'choice' ? a : '', 'Choose — the territory remembers.'], {
          name: 'CADE HOLLIS', choices: [c[2], c[3] || 'Say nothing'],
          onChoice: (i) => {
            const dh = (CHOICE_HONOR[S.mission.id] || [0, 0])[i] || 0;
            if (dh !== 0) { G.honor.add(dh); G.game.audio.sfx(dh > 0 ? 'honor_up' : 'honor_down'); }
            this.advanced(S.runner.notify({ t: 'choice', idx: i }));
          },
        });
      } else if (verb === 'pay') {
        S.opened = true;
        G.menu = new E.Menu(G.game, [`Pay $${a}`, 'Not now'], {
          title: 'PAY UP',
          onPick: (i) => {
            if (i === 0 && G.save.cash >= a) {
              G.save.cash -= a; G.game.audio.sfx('cash');
              this.advanced(S.runner.notify({ t: 'pay', amount: a }));
            } else if (i === 0) G.game.audio.sfx('cancel');
            G.menu = null;
          },
          onCancel: () => { G.menu = null; },
        });
      } else if (verb === 'play' && a === 'POKER') {
        S.opened = true;
        openPoker(10, () => this.advanced(S.runner.notify({ t: 'play', game: 'POKER' })));
      } else if (verb === 'play' && a === 'FISH') {
        S.opened = true;
        openFishing(1, () => this.advanced(S.runner.notify({ t: 'play', game: 'FISH' })));
      }
    }
    if (G.talk.update(dt) || G.menu || G.overlay) { if (G.menu) G.menu.update(); return; }
    // Core sim.
    updatePlayer(dt, S, P, S.map, true);
    updateEnemies(dt, S, P, S.map, S.flow);
    updateBullets(dt, S, P, S.map);
    // Runner tick events.
    const cc = S.runner.current();
    if (cc) {
      const [verb, a, b] = cc;
      if (verb === 'goto' && S.target && Math.hypot(P.x - S.target.x, P.y - S.target.y) < 26) {
        this.advanced(S.runner.notify({ t: 'reach', place: a }));
      } else if (verb === 'defend' && S.target) {
        const near = Math.hypot(P.x - S.target.x, P.y - S.target.y) < 110;
        this.advanced(S.runner.notify({ t: 'tick', dt, near }));
        S.trickleT -= dt;
        if (S.trickleT <= 0 && S.enemies.filter((e) => !e.dead).length < 6) {
          S.trickleT = 3;
          const tag = defendTag(S.mission);
          const ang = Math.random() * Math.PI * 2;
          S.enemies.push(spawnEnemy(tag, S.target.x + Math.cos(ang) * 150, S.target.y + Math.sin(ang) * 110));
        }
      } else if (verb === 'wait') {
        this.advanced(S.runner.notify({ t: 'tick', dt }));
      } else if (verb === 'mount' && P.horse.mounted) {
        this.advanced(S.runner.notify({ t: 'mount' }));
      }
      void b;
    }
    // Pickups.
    for (const k of S.pickups) {
      if (!k.taken && Math.hypot(P.x - k.x, P.y - k.y) < 15) {
        k.taken = true; G.game.audio.sfx('pickup');
        this.advanced(S.runner.notify({ t: 'collect', item: k.item }));
      }
    }
    // Escort followers.
    for (const n of S.npcs) {
      n.rig.update(dt, { x: n.x, y: n.y, z: 0, vx: n.body.vx, vy: n.body.vy, facing: n.facing });
      if (!n.follows) continue;
      const d = Math.hypot(P.x - n.x, P.y - n.y);
      if (d > 52) {
        const dir = S.flow.dir(n.x, n.y, P.x, P.y);
        n.body.vx = dir[0] * 80; n.body.vy = dir[1] * 80;
        n.facing = Math.atan2(dir[1], dir[0]);
      } else { n.body.vx = 0; n.body.vy = 0; }
      n.body.update(dt, S.map);
      n.x = n.body.x; n.y = n.body.y;
      const ecc = S.runner.current();
      if (ecc && ecc[0] === 'escort' && S.target && Math.hypot(n.x - S.target.x, n.y - S.target.y) < 30) {
        this.advanced(S.runner.notify({ t: 'escort', id: n.id, place: ecc[2] }));
      }
    }
    // Interact: horse + talk.
    if (inp.pressed('interact')) {
      if (E.dist(P, P.horse) < 30) {
        P.horse.mounted = !P.horse.mounted;
        G.game.audio.sfx(P.horse.mounted ? 'jump' : 'land');
      } else {
        const n = nearestNpc(S.npcs, P, 32);
        if (n) {
          G.talk.say(n.talk || [`${n.name} nods.`], {
            name: n.name.toUpperCase(),
            onDone: () => {
              const tcc = S.runner.current();
              if (tcc && tcc[0] === 'talk' && tcc[1] === n.id) this.advanced(S.runner.notify({ t: 'talk', id: n.id }));
            },
          });
        }
      }
    }
    // Fail conditions.
    const hasSeen = S.mission.f.some(([k]) => k === 'seen');
    if (hasSeen && !S.seen) {
      S.seen = S.enemies.some((e) => !e.dead && Math.hypot(P.x - e.x, P.y - e.y) < 150 && S.map.los(e.x, e.y, P.x, P.y));
      if (S.seen) G.game.note('SPOTTED!', 2);
    }
    if (S.target && Math.hypot(P.x - S.target.x, P.y - S.target.y) > 280) S.strayT += dt;
    else S.strayT = Math.max(0, S.strayT - dt);
    const failReason = checkFail(S.mission.f, { dead: G.cores.dead, stars: G.wanted.stars, seen: S.seen, elapsed: S.elapsed, stray: S.strayT });
    if (failReason && !S.over) { S.runner.fail(failReason); this.showFail(); }
    // Wanted: heat decays when no foe near; law trickles in when hot.
    const foeNear = S.enemies.some((e) => !e.dead && Math.hypot(P.x - e.x, P.y - e.y) < 220);
    G.wanted.tick(dt, !foeNear);
    if (G.wanted.stars > 0) {
      S.lawT -= dt;
      if (S.lawT <= 0 && S.enemies.filter((e) => !e.dead).length < 7) {
        S.lawT = 7;
        const ang = Math.random() * Math.PI * 2;
        S.enemies.push(spawnEnemy('LAW', P.x + Math.cos(ang) * 190, P.y + Math.sin(ang) * 140));
      }
    }
    G.game.follow(P);
  },
  showFail() {
    const S = this.M;
    S.over = true;
    G.focus.active = false; G.game.timeScale = 1;
    G.game.audio.sfx('die');
    playSong(G.game.audio, 'somber');
    G.menu = new E.Menu(G.game, ['Retry from checkpoint', 'Abandon to camp'], {
      title: `FAILED — ${S.runner.failed || '...'}`,
      onPick: (i) => {
        G.menu = null;
        if (i === 0) {
          S.runner.retry();
          S.elapsed = 0; S.strayT = 0; S.seen = false; S.over = false;
          G.cores.rest();
          this.clearField();
          this.spawnObjective();
        } else G.game.go('camp');
      },
      onCancel: () => {},
    });
  },
  complete() {
    const S = this.M;
    if (S.over) return;
    S.over = true;
    G.focus.active = false; G.game.timeScale = 1;
    const r = S.mission.r || { cash: 0, honor: 0 };
    G.save.cash = Math.max(-500, G.save.cash + (r.cash || 0));
    if (r.cash > 0) G.stats.earned += r.cash;
    if (r.honor) { G.honor.add(r.honor); G.game.audio.sfx(r.honor > 0 ? 'honor_up' : 'honor_down'); }
    if (r.cash > 0) G.game.audio.sfx('cash');
    if (S.stranger) {
      G.save.strangersDone.push(`${S.stranger.arc}:${S.stranger.part}`);
    } else {
      G.save.mission = Math.min(G.save.mission + 1, allMissions().length);
    }
    persist();
    playSong(G.game.audio, 'victory');
    const last = !S.stranger && G.save.mission >= allMissions().length;
    G.talk.say([`"${S.mission.t}" — done.`, rewardLine(r), last ? 'The territory is quiet at last.' : 'Ride back to camp when ready.'], {
      name: 'RED HARROW',
      choices: last ? ['Finish'] : ['Return to camp'],
      onChoice: () => { G.game.go(last ? 'end' : 'camp'); },
    });
  },
  draw(r) {
    const S = this.M;
    drawField(r, S, S.P);
    if (S.target && !S.target.horse) drawObjectiveArrow(r, E, G.game, S.target.x, S.target.y);
    else if (S.target && S.target.horse) drawObjectiveArrow(r, E, G.game, S.P.horse.x, S.P.horse.y);
    drawHUD(r, E, hudState(), {
      chapter: S.ch === 0 ? G.save.chapter : S.ch,
      tracker: `${S.mission.t} — ${S.runner.describe(charName)}`,
      hint: 'WASD move · click/J shoot · F focus · E talk · ESC pause',
    });
    G.talk.draw(r);
    if (G.menu) G.menu.draw(r);
    drawOverlay(r);
  },
};

function defendTag(mission) {
  const kill = mission.o.find(([v]) => v === 'kill');
  return kill ? kill[1] : 'BANDIT';
}
function rewardLine(rr) {
  const parts = [];
  if (rr.cash > 0) parts.push(`+$${rr.cash}`);
  if (rr.cash < 0) parts.push(`-$${-rr.cash}`);
  if (rr.honor > 0) parts.push(`honor +${rr.honor}`);
  if (rr.honor < 0) parts.push(`honor ${rr.honor}`);
  return parts.length ? `Reward: ${parts.join(', ')}` : 'No reward but survival.';
}
function hashId(id) {
  let h = 7;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 100000;
}

// ---------- Boot / title / how-to / ending ----------
const bootScene = {
  enter() { this.status = 'Loading the territory...'; this.failed = false; this.load(); },
  async load() {
    try {
      const get = (f) => fetch(`data/${f}`).then((r) => { if (!r.ok) throw new Error(f); return r.json(); });
      const [chapters, characters, strangers, arms, horses, beasts, challenges, map] = await Promise.all(
        ['chapters.json', 'characters.json', 'strangers.json', 'arms.json', 'horses.json', 'beasts.json', 'challenges.json', 'map.json'].map(get));
      G.data = { chapters, characters, strangers, arms, horses, beasts, challenges, map };
      for (const c of [...characters.gang, ...characters.foes, ...characters.supporting]) G.charById.set(c.id, c);
      for (const m of chapters.missions) G.missionById.set(m.id, m);
      G.sprites = makeSprites(E);
      defineWestern(G.game.audio);
      loadPersisted();
      G.game.go('title');
    } catch (err) {
      this.failed = true;
      this.status = `Could not load game data (${err.message}). Serve over HTTP: python3 -m http.server 8000`;
    }
  },
  update() {},
  draw(r) {
    r.sky(['#101010', '#30281e']);
    r.overlay((g) => {
      E.font.title(g, 'RED HARROW', r.W / 2, 80, { scale: 3, align: 'center' });
      E.font.text(g, this.status, r.W / 2, 130, '#ffe08a', { align: 'center', outline: false });
    });
  },
};

const titleScene = {
  enter() {
    playSong(G.game.audio, 'title');
    const hasSave = !!E.store.get('redharrow:save', null);
    G.menu = new E.Menu(G.game, ['New game', hasSave ? 'Continue' : { label: 'Continue', disabled: true }, 'How to play'], {
      title: 'RED HARROW',
      onPick: (i) => {
        G.menu = null;
        if (i === 0) {
          G.save = freshSave(); G.stats = { kills: 0, earned: 0 };
          G.honor = new Honor(); G.cores = new Cores(); G.wanted = new Wanted();
          G.focus = new Focus(); G.ledger = new CampLedger(); G.bond = new HorseBond();
          G.challenges = new Challenges();
          persist();
          G.game.go('camp');
        } else if (i === 1) { loadPersisted(); G.game.go('camp'); }
        else G.game.go('how');
      },
    });
  },
  update() { if (G.menu) G.menu.update(); },
  draw(r) {
    r.sky(['#1a0f14', '#7a3a20', '#e8a85a']);
    r.starfield({ count: 40, height: 0.4 });
    r.overlay((g) => {
      E.font.title(g, 'RED HARROW', r.W / 2, 52, { scale: 4, align: 'center' });
      E.font.text(g, 'Harrow Territory, 1904 — one last score', r.W / 2, 92, '#ffe08a', { align: 'center', outline: false });
    });
    if (G.menu) G.menu.draw(r);
    r.text('an original western — headphones on', r.W / 2, r.H - 14, '#a08a78', { align: 'center' });
  },
};

const howScene = {
  update() { if (G.game.input.pressed('cancel') || G.game.input.pressed('confirm')) G.game.go('title'); },
  draw(r) {
    r.sky(['#101010', '#2a2018']);
    const lines = [
      'MOVE  WASD / arrows        SHOOT  click / J',
      'FOCUS (slow-mo)  F or right-click — mark, release to fire',
      'DASH  Space (on foot)      TALK / MOUNT  E',
      'PAUSE  ESC                 CAMERA  V cycles views',
      '',
      'Ride the gold arrow. Talk (!) to start objectives.',
      'Checkpoints save every objective. The camp has',
      'ledger, store, stable, post office, cards, strangers.',
      'Honor opens discounts; bounties bring lawmen.',
    ];
    r.overlay((g) => {
      E.font.text(g, 'HOW TO RIDE', r.W / 2, 30, '#ffe08a', { align: 'center', outline: false });
      lines.forEach((ln, i) => E.font.text(g, ln, r.W / 2, 56 + i * 13, '#ffffff', { align: 'center', outline: false }));
      E.font.text(g, 'ENTER: back to title', r.W / 2, r.H - 20, '#a0a0b8', { align: 'center', outline: false });
    });
  },
};

const endScene = {
  enter() { playSong(G.game.audio, 'victory'); },
  update() { if (G.game.input.pressed('confirm') || G.game.input.pressed('start')) G.game.go('title'); },
  draw(r) {
    r.sky(['#1a0f14', '#e8a85a']);
    r.overlay((g) => {
      E.font.title(g, 'THE TERRITORY IS QUIET', r.W / 2, 60, { scale: 2, align: 'center' });
      E.font.text(g, `Missions: 104/104   Stranger parts: ${G.save.strangersDone.length}`, r.W / 2, 110, '#ffffff', { align: 'center', outline: false });
      E.font.text(g, `Honor: ${G.honor.rank()}   Kills: ${G.stats.kills}   Earned: $${G.stats.earned}`, r.W / 2, 126, '#ffffff', { align: 'center', outline: false });
      E.font.text(g, 'Thank you for riding with the Harrow gang.', r.W / 2, 150, '#ffe08a', { align: 'center', outline: false });
      E.font.text(g, 'ENTER: title', r.W / 2, r.H - 20, '#a0a0b8', { align: 'center', outline: false });
    });
  },
};

// ---------- Start ----------
G.game = new E.Game({
  canvas: 'screen', res: 'wide', view: 'threequarter', views: ['threequarter', 'topdown'], bg: '#000',
  input: {
    up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
    attack: ['Mouse0', 'KeyJ', 'KeyZ'], skill: ['KeyF', 'KeyK', 'Mouse2', 'KeyL'],
    dash: ['Space'], interact: ['KeyE'], viewcycle: ['KeyV'],
    start: ['Enter'], pause: ['Escape', 'KeyP'], confirm: ['Enter', 'Space', 'KeyJ'], cancel: ['Escape', 'Backspace'],
  },
});
G.debugScene = 'boot';
const _rhGo = G.game.go.bind(G.game);
G.game.go = (name, ...rest) => { G.debugScene = name; return _rhGo(name, ...rest); };
G.game.start({ scene: 'boot', scenes: { boot: bootScene, title: titleScene, how: howScene, camp: campScene, mission: missionScene, end: endScene } });
// Test hook (single-player local game): exposes state for the Node smoke harness.
window.__RH__ = G;
