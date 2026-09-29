import {
  copy,
  key,
  clamp,
  distance,
  createUnit,
  stats,
  awardJP,
  equipmentStats,
  stock,
  BUFFS,
  DEBUFFS,
  rngStep,
  defaultWeapon,
  jobMembers,
} from './model.js';
import { BOSSES, CHARACTERS, CAMPAIGN } from './content.js';
import { buildMap, tileAt, unitAt, reachable } from './maps.js';
import {
  alive,
  awake,
  teamOf,
  faithOf,
  actionSpec,
  selectableActions,
  actionBlocked,
  inRange,
  affected,
  predict,
  statusDuration,
  katanaItem,
  physicalDamage,
  weaponRange,
} from './abilities.js';
const harmful = DEBUFFS.concat(['Dead', 'Undead']);
function lineup(text) {
  return text.split('|').flatMap((s) => {
    const [name, n] = s.split('*');
    return Array.from({ length: +n || 1 }, () => name);
  });
}
export function battleUnit(db, source, team = 0, options = {}) {
  const u = copy(source),
    s = stats(db, u);
  Object.assign(u, s, {
    hp: s.maxHp,
    mp: s.maxMp,
    ct: 0,
    x: 0,
    z: 0,
    h: 0,
    terrain: 'P',
    facing: team === 0 ? 0 : 2,
    status: {},
    moved: false,
    acted: false,
    turns: 0,
    team,
    ...options,
  });
  u.baseBrave = u.brave;
  u.baseFaith = u.faith;
  u.baseSpeed = u.speed;
  for (const effect of equipmentStats(db, u).auto) u.status[effect] = 99999;
  if (['Skeleton', 'Living Bone', 'Bone Snatch', 'Ghoul', 'Gust', 'Revnant'].includes(u.job)) u.status.Undead = 99999;
  if (u.job === 'Steel Giant') u.status.Innocent = 99999;
  if (/Bomb|Grenade|Explosive/.test(u.job)) {
    u.absorb = ['Fire'];
    u.weak = ['Water'];
    u.half = ['Ice'];
  }
  if (/Goblin|Hydra|Hyudra|Tiamat/.test(u.job)) u.weak = ['Ice'];
  if (u.monster && !u.reaction) u.reaction = 'Counter';
  const effects = equipmentStats(db, u).effects;
  if (/Initial[^;]*Petrify/i.test(effects)) u.status.Petrify = 99999;
  if (/Initial[^;]*Reraise/i.test(effects)) u.status.Reraise = 99999;
  if (/Initial[^;]*Transparent/i.test(effects)) u.status.Transparent = 99999;
  return u;
}
function place(u, t) {
  u.x = t.x;
  u.z = t.z;
  u.h = t.h;
  u.terrain = t.t;
}
function enemy(db, name, level, i, def, phase = false) {
  const boss = BOSSES[name],
    monster = db.monster.has(name) || /Demon/.test(name);
  const u = createUnit(db, name, boss?.job || name, level, {
    ...boss,
    id: 'enemy-' + (phase ? 'p-' : '') + i,
    monster: monster || boss?.job === 'Lucavi',
    generic: false,
  });
  if (!u.equipment.weapon && !u.monster && u.job !== 'Monk' && u.job !== 'Mime')
    u.equipment.weapon = defaultWeapon(db, u.job, Math.max(1, level));
  if (!boss?.skills) {
    u.learned = [
      ...new Set([
        ...u.learned,
        ...jobMembers(db, u)
          .filter((m) => m.role === 'A')
          .sort((a, b) => a.jp - b.jp)
          .slice(0, 2 + Math.floor(level / 8))
          .map((m) => m.id),
      ]),
    ];
    if (monster)
      u.skills =
        db.monster.get(name)?.abilities ||
        (name === 'Apanda'
          ? ['ability-0ca', 'ability-0cb', 'ability-0ce']
          : /Archaic/.test(name)
            ? ['ability-0a6', 'ability-15c', 'ability-14e']
            : ['ability-0e5', 'ability-15d', 'ability-14c']);
  } else {
    u.skills = boss.skills;
    u.learned = [...new Set([...u.learned, ...boss.skills])];
  }
  const bu = battleUnit(db, u, 1, { boss: !!boss, weather: def.weather });
  if (boss) {
    if (boss.hp) bu.hp = bu.maxHp = boss.hp;
    else bu.hp = bu.maxHp = Math.floor(bu.maxHp * 1.45);
    for (const f of ['mp', 'pa', 'ma', 'speed']) if (boss[f] !== undefined) bu[f] = boss[f];
    if (boss.mp) bu.maxMp = boss.mp;
    bu.vulnerable = boss.vulnerable;
    bu.weak = boss.weak || bu.weak;
    if (boss.job === 'Lucavi') {
      bu.support = 'Short Charge';
      bu.move = 5;
      bu.jump = 5;
    }
    if (name === 'Elmdor' && def.id === 'battle-2-4k')
      for (const [slot, n] of [
        ['shield', 'Genji Shield'],
        ['head', 'Genji Helmet'],
        ['body', 'Genji Armor'],
        ['accessory', 'Genji Gauntlet'],
      ])
        bu.equipment[slot] = db.itemNamed(n)?.id || null;
    if (name === 'Balk' && def.id === 'battle-2-4t') bu.equipment.weapon = db.itemNamed('Blast Gun')?.id || bu.equipment.weapon;
  }
  if (def.enemyRare && name === 'Chemist') bu.equipment.weapon = db.itemNamed(def.enemyRare)?.id;
  if (name === 'Wiegraf' && def.duel && !phase) {
    bu.skills = ['ability-09c-lightning-stab', 'ability-066', 'ability-067'];
    bu.learned = [...bu.skills];
    bu.support = 'Maintenance';
    bu.speed = 8;
    bu.pa = 10;
    bu.ma = 6;
  }
  if (def.undead) bu.status.Undead = 99999;
  return bu;
}
export function createBattle(db, state, def, choices = {}) {
  const index = CAMPAIGN.findIndex((e) => e.id === def.id),
    party = state.party.filter((u) => state.selected.includes(u.id) && !u.away);
  const level = def.chapter === 0 ? 3 : Math.max(1, Math.floor((index < 0 ? state.progress : index) * 0.86) + 2),
    grid = buildMap(db, def);
  const b = {
    definitionId: def.id,
    grid,
    units: [],
    tick: 0,
    turnCount: 0,
    activeId: null,
    pending: [],
    phase: 0,
    reserves: [],
    events: [],
    log: [],
    result: null,
    objective: def.choice ? (choices.rescue ? 'rescue' : 'all') : def.objective,
    rescue: def.rescue || null,
    choice: choices,
    seed: state.seed,
    loot: [],
    poached: [],
    invited: [],
    rewarded: false,
    golem: [0, 0],
    actionCount: 0,
  };
  let sourceParty = party.length ? party : state.party.slice(0, 5);
  if (!sourceParty.some((u) => u.name === 'Ramza'))
    sourceParty = [state.party.find((u) => u.name === 'Ramza'), ...sourceParty.slice(0, 4)];
  for (const p of sourceParty) {
    const u = battleUnit(db, p, 0, { weather: def.weather });
    if (def.tutorial) {
      u.maxHp = Math.max(u.maxHp, 125);
      u.hp = u.maxHp;
      u.pa = Math.max(u.pa, 7);
    }
    if (state.options.difficulty === 'Story') {
      u.maxHp = Math.floor(u.maxHp * 1.4);
      u.hp = u.maxHp;
      u.pa += 2;
      u.ma += 2;
    }
    b.units.push(u);
  }
  if (def.duel) {
    b.reserves = b.units.filter((u) => u.name !== 'Ramza');
    b.units = b.units.filter((u) => u.name === 'Ramza');
  }
  const near = grid.spawns.map(([x, z]) => tileAt(grid, x, z)).filter(Boolean);
  b.units.forEach((u, i) => place(u, near[i] || grid.tiles.filter((t) => !t.blocked)[i]));
  const guestNames = [...new Set([...(def.guests || []), ...(def.rescue ? [def.rescue] : [])])];
  for (const name of guestNames) {
    if (b.units.some((u) => u.name === name)) continue;
    const p = createUnit(db, name, CHARACTERS[name]?.job || 'Squire', level, { id: 'guest-' + name, generic: false }),
      u = battleUnit(db, p, 0, { guest: true, rescue: name === def.rescue, weather: def.weather });
    if (u.rescue) {
      u.maxHp = Math.max(u.maxHp, 95 + level * 4);
      u.hp = u.maxHp;
    }
    const candidates = grid.tiles
      .filter((t) => !t.blocked && !unitAt(b, t.x, t.z) && t.t !== 'A')
      .sort(
        (a, c) =>
          Math.abs(a.z - (u.rescue ? grid.height * 0.45 : grid.height - 3)) -
          Math.abs(c.z - (u.rescue ? grid.height * 0.45 : grid.height - 3)) +
          Math.abs(a.x - grid.width / 2) * 0.05 -
          Math.abs(c.x - grid.width / 2) * 0.05,
      );
    place(u, candidates[0]);
    b.units.push(u);
  }
  const names = lineup(def.routeChoice && choices.north ? def.northEnemies : def.enemies);
  names.forEach((name, i) => {
    const u = enemy(db, name, def.scale ? Math.max(...state.party.map((p) => p.level)) : level, i, def);
    const candidates = grid.tiles
      .filter((t) => !t.blocked && !unitAt(b, t.x, t.z) && !['A', 'W', 'Q'].includes(t.t))
      .sort((a, c) => (a.z - c.z) * 4 + Math.abs(a.x - grid.width / 2) - Math.abs(c.x - grid.width / 2));
    const t = candidates[Math.min(i % 3, candidates.length - 1)];
    if (t) {
      place(u, t);
      b.units.push(u);
    }
  });
  if (def.duel) {
    const ramza = b.units.find((u) => u.name === 'Ramza'),
      w = b.units.find((u) => u.name === 'Wiegraf');
    if (ramza && w) {
      const t = grid.tiles.filter((t) => !t.blocked && distance(t, ramza) === 5)[0];
      if (t) place(w, t);
    }
  }
  if (def.gate) {
    const r = b.units.find((u) => u.name === 'Ramza'),
      t = grid.tiles.find((t) => t.z === 3 && t.x === 5 && !unitAt(b, t.x, t.z));
    if (r && t) place(r, t);
  }
  if (def.poisonStart) for (const u of b.units.filter((u) => u.team === 0)) u.status.Poison = 40;
  if (def.choice && choices.rescue) for (const u of b.units.filter((u) => u.team === 0)) u.brave = clamp(u.brave + 5, 0, 100);
  for (const u of b.units) u.ct = def.tutorial && u.name === 'Ramza' ? 100 : 0;
  state.battle = b;
  return b;
}
export class BattleEngine {
  constructor(db, state) {
    this.db = db;
    this.state = state;
    this.b = state.battle;
    if (!this.b) throw new Error('No active battle.');
    this.def = db.encounter.get(this.b.definitionId);
  }
  random() {
    return rngStep(this.b);
  }
  get active() {
    return this.b.units.find((u) => u.id === this.b.activeId);
  }
  event(type, data = {}) {
    this.b.eventCounter = (this.b.eventCounter || 0) + 1;
    this.b.events.push({ seq: this.b.eventCounter, type, time: this.b.tick, ...data });
    if (this.b.events.length > 180) this.b.events.shift();
  }
  log(text) {
    this.b.log.unshift(text);
    this.b.log = this.b.log.slice(0, 80);
  }
  tile(x, z) {
    return tileAt(this.b.grid, x, z);
  }
  reachable(u = this.active) {
    return reachable(this.db, this.b, u);
  }
  actions(u = this.active) {
    return selectableActions(this.db, this.state, u);
  }
  advance() {
    if (this.b.result || this.active) return this.active;
    for (let guard = 0; guard < 10000; guard++) {
      this.checkOutcome();
      if (this.b.result) return null;
      const ready = this.b.units
        .filter((u) => !u.removed && u.ct >= 100 && !u.airborne)
        .sort((a, b) => b.ct - a.ct || a.team - b.team);
      if (ready.length) {
        const u = ready[0];
        if (u.hp <= 0) {
          u.ct -= 100;
          this.deathTick(u);
          continue;
        }
        if (u.status.Petrify || u.status.Stop || u.status.Sleep) {
          u.ct = 0;
          continue;
        }
        u.moved = false;
        u.acted = false;
        u.undo = null;
        delete u.status.Defending;
        u.turns++;
        this.b.turnCount++;
        this.b.activeId = u.id;
        if (u.status.Poison) this.hurt(u, Math.max(1, Math.floor(u.maxHp / 8)), null, 'Poison', false);
        if (u.status.Regen) this.heal(u, Math.max(1, Math.floor(u.maxHp / 8)));
        if (u.brave < 10) u.status.Chicken = 99999;
        else delete u.status.Chicken;
        if (u.status.Chicken) u.brave = clamp(u.brave + 1, 0, 100);
        if (u.hp <= 0) {
          this.b.activeId = null;
          continue;
        }
        this.event('turn', { id: u.id });
        return u;
      }
      this.b.tick++;
      for (const u of this.b.units) {
        if (u.removed) continue;
        for (const [s, n] of Object.entries(u.status)) {
          if (n < 99999) {
            u.status[s]--;
            if (u.status[s] <= 0) {
              delete u.status[s];
              if (s === 'Death Sentence' && !equipmentStats(this.db, u).block.includes('Dead'))
                this.hurt(u, u.hp, null, 'Doom', false);
            }
          }
        }
        if (!u.status.Stop && !u.status.Petrify && !u.airborne) {
          let speed = u.speed;
          if (u.status.Haste) speed = Math.floor(speed * 1.5);
          if (u.status.Slow) speed = Math.floor(speed * 0.5);
          u.ct += Math.max(1, speed);
        }
      }
      const due = this.b.pending.filter((p) => p.at <= this.b.tick);
      this.b.pending = this.b.pending.filter((p) => p.at > this.b.tick);
      for (const p of due) {
        const caster = this.b.units.find((u) => u.id === p.casterId);
        if (!caster || caster.hp <= 0 || caster.removed) continue;
        if (
          caster.status.Sleep ||
          caster.status.Petrify ||
          caster.status["Don't Act"] ||
          (caster.status.Silence && p.action.mp > 0)
        ) {
          delete caster.status.Charging;
          caster.airborne = false;
          continue;
        }
        const target = p.targetId ? this.b.units.find((u) => u.id === p.targetId) : null,
          center = target ? { x: target.x, z: target.z, h: target.h } : p.center;
        if (p.action.family === 'Jump') caster.airborne = false;
        delete caster.status.Charging;
        this.resolve(caster, p.action, center);
        if (p.action.repeat && caster.performing === p.action.id && alive(caster))
          this.b.pending.push({ ...p, at: this.b.tick + p.action.ctr });
      }
    }
    this.b.result = {
      win: false,
      reason: 'The battle reached its safety limit. Restore the checkpoint and try a different approach.',
    };
    return null;
  }
  move(x, z) {
    const u = this.active;
    if (!u || this.b.result) return { ok: false, reason: 'No active turn.' };
    if (u.moved) return { ok: false, reason: 'Movement has already been used.' };
    const target = this.reachable(u).get(key(x, z));
    if (!target || distance(u, target) === 0) return { ok: false, reason: 'That tile is not reachable.' };
    const from = { x: u.x, z: u.z, h: u.h, terrain: u.terrain };
    u.undo = u.acted ? null : from;
    u.moved = true;
    if (target.chance && this.random() * 100 >= target.chance) {
      u.undo = null;
      this.event('miss', { id: u.id, text: 'Teleport failed' });
      return { ok: true };
    }
    if (u.performing) {
      u.performing = null;
      this.b.pending = this.b.pending.filter((p) => p.casterId !== u.id || !p.action.repeat);
    }
    place(u, target);
    this.face(u, from, true);
    this.event('move', { id: u.id, from, path: target.path, to: { x, z, h: u.h } });
    if (target.t === 'Q' && !u.status.Float) this.addStatus(u, 'Poison');
    if (u.movement === 'Move-HP Up') this.heal(u, Math.floor(u.maxHp / 10));
    if (u.movement === 'Move-MP Up') u.mp = clamp(u.mp + Math.floor(u.maxMp / 10), 0, u.maxMp);
    if (u.movement === 'Move-Get JP') this.gainJP(u, 10);
    if (u.movement === 'Move-Get Exp') u.exp += 10;
    if (['Move-HP Up', 'Move-MP Up', 'Move-Get JP', 'Move-Get Exp'].includes(u.movement) || target.t === 'Q') u.undo = null;
    if (this.explore(u)) u.undo = null;
    this.checkOutcome();
    return { ok: true };
  }
  undoMove() {
    const u = this.active;
    if (!u?.undo || u.acted) return false;
    place(u, { ...u.undo, t: u.undo.terrain });
    u.moved = false;
    u.undo = null;
    this.event('reset');
    return true;
  }
  face(u, target, reverse = false) {
    let dx = target.x - u.x,
      dz = target.z - u.z;
    if (reverse) {
      dx = -dx;
      dz = -dz;
    }
    if (dx || dz) u.facing = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 1 : 3) : dz > 0 ? 2 : 0;
  }
  wait(facing) {
    const u = this.active;
    if (!u) return false;
    if (facing !== undefined) u.facing = clamp(facing, 0, 3);
    const cost = u.moved && u.acted ? 100 : u.moved || u.acted ? 80 : 60;
    u.ct = Math.max(0, u.ct - cost);
    u.undo = null;
    this.b.activeId = null;
    this.event('wait', { id: u.id, cost });
    this.checkOutcome();
    return true;
  }
  act(id, x, z, lockUnit = false, extra = {}) {
    const u = this.active;
    if (!u) return { ok: false, reason: 'No active turn.' };
    const a = actionSpec(this.db, u, id, extra);
    if (!a) return { ok: false, reason: 'Unknown action.' };
    const error = actionBlocked(this.db, this.state, u, a);
    if (error) return { ok: false, reason: error };
    const t = this.tile(x, z);
    if (!t || !inRange(this.db, u, a, t)) return { ok: false, reason: 'Target outside range or height tolerance.' };
    if (a.line && x !== u.x && z !== u.z) return { ok: false, reason: 'Aim along a straight row or column.' };
    u.acted = true;
    u.undo = null;
    u.mp -= a.mp;
    this.b.actionCount++;
    this.state.stats.actions++;
    this.face(u, t);
    if (u.performing) {
      u.performing = null;
      this.b.pending = this.b.pending.filter((p) => p.casterId !== u.id || !p.action.repeat);
    }
    if (a.family === 'Item') {
      const item = this.db.itemNamed(a.name);
      if (item && u.team === 0 && !u.guest) this.state.inventory[item.id]--;
    }
    if (a.family === 'Throw' && u.team === 0 && !u.guest) this.state.inventory[a.itemId]--;
    const center = a.self ? { x: u.x, z: u.z, h: u.h } : { x, z, h: t.h };
    if (a.ctr > 0) {
      this.b.pending = this.b.pending.filter((p) => p.casterId !== u.id);
      const target =
        lockUnit && a.family !== 'Jump' && a.family !== 'Charge' && a.family !== 'LIMIT' ? unitAt(this.b, x, z, false) : null;
      this.b.pending.push({ casterId: u.id, action: a, center, targetId: target?.id, at: this.b.tick + a.ctr });
      u.status.Charging = a.ctr + 1;
      if (a.family === 'Jump') {
        u.airborne = true;
        delete u.status.Charging;
      }
      if (a.repeat) u.performing = a.id;
      this.log(`${u.name} prepares ${a.name} · ${a.ctr} CT ticks.`);
      this.event('charge', { id: u.id, action: a.name, center, delay: a.ctr });
    } else this.resolve(u, a, center);
    this.gainJP(u, 12);
    this.checkOutcome();
    return { ok: true };
  }
  gainJP(u, n) {
    if (u.team !== 0 || u.guest) return;
    const p = this.state.party.find((p) => p.id === u.id);
    if (!p) return;
    const amount = Math.floor(n * (u.support === 'Gained JP-UP' ? 1.5 : 1));
    awardJP(p, u.job, amount);
    awardJP(u, u.job, amount);
    p.exp += 10;
    if (p.exp >= 100) {
      p.exp -= 100;
      p.level = Math.min(99, p.level + 1);
      this.event('level', { id: u.id, text: 'LEVEL UP' });
    }
    for (const v of this.state.party.filter((v) => v.id !== p.id && this.state.selected.includes(v.id)))
      awardJP(v, u.job, Math.floor(amount / 4));
  }
  resolve(u, a, center, mimed = false) {
    if (!alive(u)) return;
    this.event('spell', { id: u.id, action: a.name, element: a.element, center, area: a.area });
    this.log(`${u.name} → ${a.name}`);
    let targets = affected(a, u, center, this.b.units);
    if (a.family === 'TRUTH' || a.family === 'UN-TRUTH' || /Triple Flame|Triple Thunder|Holy Bracelet/.test(a.name)) {
      const count = 1 + Math.floor(this.random() * 6),
        panels = this.b.grid.tiles.filter(
          (t) => distance(t, center) <= Math.max(1, a.area) && Math.abs(t.h - center.h) <= a.areaVertical,
        );
      targets = [];
      for (let i = 0; i < count; i++) {
        const tile = panels[Math.floor(this.random() * panels.length)];
        if (tile) {
          const t = unitAt(this.b, tile.x, tile.z, false);
          if (t) targets.push(t);
        }
      }
    }
    if (a.name === 'Golem') {
      this.b.golem[u.team] = u.maxHp;
      this.log(`Golem guards the company for ${u.maxHp} damage.`);
    }
    for (let t of targets) {
      if (t.removed || t.airborne) continue;
      if (a.reflect && t.status.Reflect) {
        const reflected = this.b.units.find((v) => v.id !== t.id && v.x === 2 * t.x - u.x && v.z === 2 * t.z - u.z);
        this.event('status', { id: t.id, text: 'REFLECT' });
        if (!reflected) continue;
        t = reflected;
      }
      const p = predict(this.db, u, t, a, () => this.random());
      if (this.random() * 100 >= p.hit) {
        this.event('miss', { id: t.id, text: p.hit === 0 ? 'Immune' : 'Miss' });
        continue;
      }
      const damaging = p.amount > 0 && !p.heal && !p.mp;
      if (p.revive && t.hp <= 0 && !t.status.Undead) {
        t.hp = Math.min(t.maxHp, p.amount);
        t.countdown = undefined;
        t.ct = 0;
        this.event('heal', { id: t.id, amount: p.amount });
      } else if (p.amount > 0) {
        if (p.mp) {
          t.mp = clamp(t.mp + (p.heal ? p.amount : -p.amount), 0, t.maxMp);
          if (p.drain) u.mp = clamp(u.mp + p.amount, 0, u.maxMp);
          this.event('float', { id: t.id, text: (p.heal ? '+' : '−') + p.amount + ' MP' });
        } else if (p.heal) this.heal(t, p.amount);
        else {
          let amount = p.amount;
          if (this.b.golem[t.team] > 0 && ['Attack', 'Jump', 'Throw', 'Charge'].includes(a.family)) {
            const absorbed = Math.min(amount, this.b.golem[t.team]);
            this.b.golem[t.team] -= absorbed;
            amount -= absorbed;
            this.event('float', { id: t.id, text: `Golem −${absorbed}` });
          }
          if (t.reaction === 'MP Switch' && t.mp > 0 && this.random() * 100 < t.brave) {
            t.mp = Math.max(0, t.mp - amount);
            this.event('float', { id: t.id, text: 'MP Switch' });
            amount = 0;
          }
          this.hurt(t, amount, u, a.name, a.family === 'Attack' || a.family === 'Jump' || a.family === 'Charge');
          if (p.drain) this.heal(u, amount);
          if (a.name === 'Wish') this.hurt(u, Math.ceil(u.maxHp / 5), null, 'Wish', false);
        }
      }
      if (a.name === 'Wish' && p.heal) this.hurt(u, Math.ceil(u.maxHp / 5), null, 'Wish', false);
      if (a.name === 'Energy') this.hurt(u, Math.ceil(u.maxHp / 4), null, 'Energy', false);
      if (a.name === 'Chakra')
        t.mp = clamp(t.mp + Math.floor(u.pa * (u.job === 'Monk' || u.support === 'Martial Arts' ? 1.5 : 1) * 2.5), 0, t.maxMp);
      if (a.name === 'Elixir') {
        t.hp = t.maxHp;
        t.mp = t.maxMp;
      }
      if (a.family === 'WORK' && p.amount > 0) this.hurt(u, Math.ceil(p.amount / 8), null, 'Work strain', false);
      this.applyUtility(u, t, a, p);
      if (a.cancel?.length) for (const s of a.cancel) if (s !== 'Dead') delete t.status[s];
      if (a.add?.length) {
        const additions = /Add any one/i.test(a.formula) ? [a.add[Math.floor(this.random() * a.add.length)]] : a.add;
        for (const s of additions) this.addStatus(t, s, u);
      }
      if (a.may?.length && t.hp > 0 && this.random() < 0.25)
        this.addStatus(t, a.may[Math.floor(this.random() * a.may.length)], u);
      if (a.name === 'Grand Cross' && t.hp > 0)
        for (const s of ['Petrify', 'Darkness', 'Confusion', 'Berserk', 'Frog', 'Poison', 'Sleep', 'Slow'])
          if (this.random() < 0.25) this.addStatus(t, s, u);
      if (t.hp > 0 && p.amount > 0 && !p.heal) {
        if (a.name === 'Zodiac' && t.job === 'Summoner') this.learnFromHit(t, 'ability-04b');
        if (a.name === 'Ultima' && t.name === 'Ramza' && t.job === 'Squire') this.learnFromHit(t, 'ability-09a');
        if (a.name.match(/ 4$/) && t.job === 'Wizard') this.learnFromHit(t, a.sourceId || a.id);
      }
      if (
        a.family === 'Attack' &&
        (u.job === 'Ninja' || u.support === 'Two Swords') &&
        alive(u) &&
        alive(t) &&
        (u.equipment.shield || !u.equipment.weapon)
      ) {
        const secondUnit = u.equipment.shield
          ? { ...u, equipment: { ...u.equipment, weapon: u.equipment.shield, shield: null } }
          : u;
        const second = predict(this.db, secondUnit, t, a, () => this.random());
        if (this.random() * 100 < second.hit) this.hurt(t, second.amount, u, 'Second blade', true);
      }
      if (
        t.hp > 0 &&
        damaging &&
        a.family === 'Attack' &&
        ['Dash', 'Throw Stone', 'Attack'].includes(a.name) &&
        this.random() < 0.12
      )
        this.knockback(u, t);
    }
    if (a.name === 'Self-Destruct') this.hurt(u, u.hp, null, 'Self-Destruct', false);
    if (a.family === 'DRAW OUT' && u.team === 0 && !u.guest && this.random() < 0.15) {
      const item = katanaItem(this.db, a);
      if (item && this.state.inventory[item.id] > 0) {
        this.state.inventory[item.id]--;
        this.log(`${item.name} broke after Draw Out.`);
      }
    }
    if (
      !mimed &&
      !u.guest &&
      u.team === 0 &&
      !['GUTS', 'HOLY SWORD', 'MIGHTY SWORD', 'LIMIT', 'WORK', 'SNIPE', 'MAGIC SWORD'].includes(a.family)
    )
      for (const mime of this.b.units.filter((v) => v.id !== u.id && v.team === u.team && v.job === 'Mime' && awake(v))) {
        const c = { x: mime.x + center.x - u.x, z: mime.z + center.z - u.z, h: center.h };
        this.resolve(mime, { ...a, mp: 0, ctr: 0 }, c, true);
      }
    this.checkOutcome();
  }
  learnFromHit(t, id) {
    if (t.learned.includes(id)) return;
    t.learned.push(id);
    const p = this.state.party.find((p) => p.id === t.id);
    if (p && !p.learned.includes(id)) p.learned.push(id);
    this.event('level', { id: t.id, text: `Learned ${this.db.action.get(id)?.name}!` });
    this.log(`${t.name} learned ${this.db.action.get(id)?.name} by surviving it.`);
  }
  applyUtility(u, t, a, p) {
    const name = a.name,
      f = a.formula || '';
    const direct = {
      Accumulate: ['pa', 1],
      Yell: ['speed', 1],
      'Cheer Up': ['brave', 5],
      Praise: ['brave', 4],
      Preach: ['faith', 4],
      Threaten: ['brave', -20],
      Solution: ['faith', -20],
      Foxbird: ['brave', -30],
      Chicken: ['brave', -50],
      'Speed Break': ['speed', -2],
      'Power Break': ['pa', -3],
      'Mind Break': ['ma', -3],
      'Speed Ruin': ['speed', -3],
      'Power Ruin': ['pa', -3],
      'Mind Ruin': ['ma', -3],
      'Slow Dance': ['speed', -1],
      'Polka Polka': ['pa', -1],
      Disillusion: ['ma', -1],
      'Cheer Song': ['speed', 1],
      'Battle Song': ['pa', 1],
      'Magic Song': ['ma', 1],
      Circle: ['ma', -2],
    };
    if (direct[name]) {
      const [field, n] = direct[name];
      t[field] = clamp(
        t[field] + n,
        field === 'brave' || field === 'faith' ? 0 : 1,
        field === 'brave' || field === 'faith' ? 100 : 50,
      );
      this.event('status', { id: t.id, text: `${field.toUpperCase()} ${n > 0 ? '+' : ''}${n}` });
    }
    if (name === 'Scream') {
      for (const s of ['pa', 'ma', 'speed']) t[s] = clamp(t[s] + 1, 1, 50);
      t.brave = clamp(t.brave + 10, 0, 100);
    }
    if (['Quick', 'Last Song'].includes(name)) t.ct = 100;
    if (['Persuade', 'Last Dance', 'Return 2'].includes(name)) t.ct = 0;
    if (name === 'Magic Break' || name === 'Magic Ruin') t.mp = Math.floor(t.mp / 2);
    if (name === 'MBarrier') for (const status of ['Protect', 'Shell', 'Haste', 'Regen', 'Reraise']) this.addStatus(t, status, u);
    const itemCures = {
      Antidote: ['Poison'],
      'Eye Drop': ['Darkness'],
      'Echo Grass': ['Silence'],
      "Maiden's Kiss": ['Frog'],
      Soft: ['Petrify'],
      'Holy Water': ['Undead', 'Blood Suck'],
      Remedy: DEBUFFS,
      Heal: ['Darkness', 'Silence', 'Poison'],
      'Choco Esuna': DEBUFFS,
      'Stigma Magic': DEBUFFS,
    };
    if (itemCures[name]) for (const s of itemCures[name]) delete t.status[s];
    if (['Invitation', 'Dragon Tame'].includes(name) && !t.boss && !t.guest && !t.invited) {
      t.team = u.team;
      t.invited = true;
      t.status = {};
      this.b.invited.push(t.id);
      this.event('reward', { id: t.id, text: 'RECRUITED' });
    }
    if (name === 'Gil Taking' || name === 'Negotiate') {
      const n = u.level * u.speed;
      if (u.team === 0) this.state.gil += n;
      this.event('reward', { id: u.id, text: `+${n} gil` });
    }
    if (name === 'Steal Exp.') u.exp += Math.min(t.exp || 0, u.speed + 5);
    if (name === 'Dragon LevelUp' && /Dragon/.test(t.job)) {
      t.level++;
      t.maxHp += 10;
      t.hp = Math.min(t.maxHp, t.hp + 10);
    }
    if (name === 'Dragon PowerUp' && /Dragon/.test(t.job))
      for (const st of ['Protect', 'Shell', 'Haste', 'Regen']) this.addStatus(t, st, u);
    if (name === 'Dragon Care' && /Dragon/.test(t.job)) {
      t.hp = t.maxHp;
      t.mp = t.maxMp;
      for (const s of DEBUFFS) delete t.status[s];
    }
    const equipmentSlot = /Helmet|Head|Blastar/.test(name)
      ? 'head'
      : /Armor|Shellbust/.test(name)
        ? 'body'
        : /Shield/.test(name)
          ? 'shield'
          : /Access|Icewolf/.test(name)
            ? 'accessory'
            : /Weapon|Hellcry/.test(name)
              ? 'weapon'
              : null;
    if (equipmentSlot && ['STEAL', 'BATTLE SKILL', 'MIGHTY SWORD'].includes(a.family)) {
      const id = t.equipment[equipmentSlot];
      if (t.support === 'Maintenance') {
        this.event('miss', { id: t.id, text: 'Maintenance' });
        return;
      }
      if (id) {
        const oldGear = equipmentStats(this.db, t);
        t.equipment[equipmentSlot] = null;
        const newGear = equipmentStats(this.db, t);
        for (const f of ['pa', 'ma', 'speed', 'move', 'jump']) t[f] = Math.max(1, t[f] + newGear[f] - oldGear[f]);
        t.maxHp = Math.max(1, t.maxHp + newGear.hp - oldGear.hp);
        t.hp = Math.min(t.hp, t.maxHp);
        t.maxMp = Math.max(0, t.maxMp + newGear.mp - oldGear.mp);
        t.mp = Math.min(t.mp, t.maxMp);
        for (const status of oldGear.auto)
          if (!newGear.auto.includes(status) && t.status[status] === 99999) delete t.status[status];
        const item = this.db.item.get(id);
        this.log(`${t.name}: ${item?.name} ${a.family === 'STEAL' ? 'stolen' : 'broken'}.`);
        this.event('reward', { id: t.id, text: a.family === 'STEAL' ? 'STOLEN' : 'BROKEN' });
        if (a.family === 'STEAL' && u.team === 0) {
          this.state.inventory[id] = (this.state.inventory[id] || 0) + 1;
          this.b.loot.push(id);
        }
      } else if (a.family === 'BATTLE SKILL')
        this.hurt(
          t,
          physicalDamage(this.db, u, t, () => this.random()),
          u,
          'Attack',
          true,
        );
    }
    if (name === 'Choco Cure' && !p.amount) this.heal(t, u.ma * 3 + u.pa * 3);
    if (name === 'Galaxy Stop') for (const s of ['Stop', "Don't Act", "Don't Move"]) this.addStatus(t, s, u);
    if (name === 'Finish Touch') this.addStatus(t, ['Dead', 'Petrify', 'Stop'][Math.floor(this.random() * 3)], u);
    if (name === 'Climhazzard') this.hurt(t, Math.max(0, t.maxHp - t.hp), u, name, false);
    if (name === 'Omnislash' || name === 'Meteorain')
      for (let i = 1; i < (name === 'Omnislash' ? 5 : 3) && alive(t); i++)
        this.hurt(t, Math.floor(u.ma * (name === 'Omnislash' ? 8 : 6)), u, name, false);
  }
  addStatus(t, s, source) {
    if (s === 'Dead') {
      if (!equipmentStats(this.db, t).block.includes('Dead') && (!t.boss || !t.vulnerable))
        this.hurt(t, t.hp, source, 'Death', false);
      return;
    }
    if (s === 'Invite') return;
    if (s === 'Quick') {
      t.ct = 100;
      return;
    }
    if (t.hp <= 0) return;
    if (equipmentStats(this.db, t).block.includes(s)) return;
    if (t.boss && t.vulnerable && !t.vulnerable.includes(s) && harmful.includes(s)) return;
    if (s === 'Petrify' && t.boss) return;
    const opposites = { Haste: 'Slow', Slow: 'Haste', Faith: 'Innocent', Innocent: 'Faith', Poison: 'Regen', Regen: 'Poison' };
    if (opposites[s]) delete t.status[opposites[s]];
    t.status[s] = statusDuration(s);
    this.event('status', { id: t.id, text: s });
    if (['Petrify', 'Sleep', 'Stop', "Don't Act"].includes(s)) {
      this.b.pending = this.b.pending.filter((p) => p.casterId !== t.id);
      delete t.status.Charging;
      t.performing = null;
      t.airborne = false;
    }
  }
  hurt(t, amount, source, label, react = true) {
    if (t.hp <= 0 || t.removed) return;
    amount = Math.max(0, Math.floor(amount));
    const before = t.hp;
    t.hp = Math.max(0, t.hp - amount);
    if (source?.team === 0) this.state.stats.damage += Math.min(before, amount);
    this.event('hit', { id: t.id, amount, from: source?.id, label });
    if (amount > 0) {
      delete t.status.Sleep;
      delete t.status.Charm;
    }
    if (t.hp <= 0) {
      t.countdown = 3;
      t.ct = 0;
      t.performing = null;
      t.airborne = false;
      delete t.status.Charging;
      this.b.pending = this.b.pending.filter((p) => p.casterId !== t.id);
      if (source?.support === 'Secret Hunt' && t.monster && ['Attack', 'Second blade'].includes(label)) {
        t.removed = true;
        this.b.poached.push(t.job);
        this.log(`${t.name} was poached. Visit a Fur Shop.`);
      }
      this.event('ko', { id: t.id });
      this.log(`${t.name} is down. Three personal turns remain to revive.`);
    } else if (amount > 0) {
      if (t.reaction === 'Speed Save' && this.random() * 100 < t.brave) t.speed++;
      if (t.reaction === 'A Save' && this.random() * 100 < t.brave) t.pa++;
      if (t.reaction === 'MA Save' && this.random() * 100 < t.brave) t.ma++;
      if (t.reaction === 'Dragon Spirit' && this.random() * 100 < t.brave) this.addStatus(t, 'Reraise');
      if (t.reaction === 'Regenerator' && this.random() * 100 < t.brave) this.addStatus(t, 'Regen');
      if (t.reaction === 'Sunken State' && this.random() * 100 < t.brave) this.addStatus(t, 'Transparent');
      if (t.reaction === 'Auto Potion' && this.random() * 100 < t.brave)
        for (const [name, n] of [
          ['Potion', 30],
          ['Hi-Potion', 70],
          ['X-Potion', 150],
        ]) {
          const item = this.db.itemNamed(name);
          if (t.team === 1 || t.guest || (item && this.state.inventory[item.id] > 0)) {
            if (t.team === 0 && !t.guest) this.state.inventory[item.id]--;
            this.heal(t, n);
            this.event('status', { id: t.id, text: 'Auto Potion' });
            break;
          }
        }
      if (t.reaction === 'HP Restore' && t.hp < t.maxHp * 0.2 && this.random() * 100 < t.brave) this.heal(t, t.maxHp);
      if (t.reaction === 'Damage Split' && source && this.random() * 100 < t.brave) {
        this.heal(t, Math.floor(amount / 2));
        this.hurt(source, Math.floor(amount / 2), null, 'Damage Split', false);
      }
      if (
        react &&
        source &&
        alive(source) &&
        distance(t, source) <= weaponRange(this.db, t, source).max &&
        ['Counter', 'Hamedo', 'Counter Tackle'].includes(t.reaction) &&
        this.random() * 100 < t.brave
      )
        this.hurt(
          source,
          physicalDamage(this.db, t, source, () => this.random()),
          t,
          'Counter',
          false,
        );
    }
  }
  heal(t, amount) {
    if (t.hp <= 0) return;
    const actual = Math.max(0, Math.min(amount, t.maxHp - t.hp));
    t.hp += actual;
    if (actual) this.event('heal', { id: t.id, amount: actual });
  }
  deathTick(u) {
    if (u.status.Reraise) {
      u.hp = Math.max(1, Math.floor(u.maxHp * 0.2));
      u.countdown = undefined;
      if (!Object.values(u.equipment).some((id) => this.db.item.get(id)?.name === 'Chantage')) delete u.status.Reraise;
      this.event('heal', { id: u.id, amount: u.hp });
      return;
    }
    if (u.guest) return;
    u.countdown = (u.countdown ?? 3) - 1;
    if (u.countdown <= 0) {
      if (u.status.Undead && this.random() < 0.5) {
        u.hp = Math.ceil(u.maxHp * 0.4);
        u.countdown = undefined;
        this.event('heal', { id: u.id, amount: u.hp });
        return;
      }
      u.removed = true;
      this.b.grid.opened.push({
        x: u.x,
        z: u.z,
        type: this.random() < 0.5 ? 'crystal' : 'chest',
        unitId: u.id,
        item: u.equipment.weapon,
      });
      this.event('crystal', { id: u.id });
      this.log(`${u.name} leaves a ${this.b.grid.opened.at(-1).type}.`);
    }
  }
  knockback(u, t) {
    const dx = t.x - u.x,
      dz = t.z - u.z,
      step = Math.abs(dx) > Math.abs(dz) ? [Math.sign(dx), 0] : [0, Math.sign(dz)],
      tile = this.tile(t.x + step[0], t.z + step[1]);
    if (!tile || tile.blocked || unitAt(this.b, tile.x, tile.z)) return;
    const fall = t.h - tile.h;
    place(t, tile);
    this.event('move', { id: t.id, to: tile, path: [tile] });
    if (fall > t.jump) this.hurt(t, Math.floor((t.maxHp * (fall - t.jump)) / 10), u, 'Fall', false);
  }
  explore(u) {
    let used = false;
    const g = this.b.grid;
    for (const s of g.switches)
      if (!s.on && s.x === u.x && s.z === u.z && u.team === 0 && u.name === 'Ramza') {
        s.on = true;
        g.gateClosed = false;
        used = true;
        this.event('reward', { id: u.id, text: 'GATE OPEN' });
        this.log('The switch is thrown.');
      }
    if (g.exit && g.exit[0] === u.x && g.exit[1] === u.z && !g.exitDiscovered) {
      g.exitDiscovered = true;
      used = true;
      this.log('A passage to the next floor is discovered.');
      this.event('reward', { id: u.id, text: 'EXIT FOUND' });
    }
    const treasure = g.treasures.find((t) => t.x === u.x && t.z === u.z && !t.taken);
    if (treasure && u.team === 0 && u.movement === 'Move-Find Item') {
      treasure.taken = true;
      used = true;
      const rare = this.random() * 100 >= u.brave,
        name = rare ? treasure.rare : treasure.common;
      let item = this.db.itemNamed(name, rare);
      if (!item && /Javelin|Escutcheon/.test(name))
        item = this.db.items
          .filter((i) => i.name.startsWith(name.split(' ')[0]))
          .sort((a, b) => (rare ? b.wp - a.wp || b.pe - a.pe : a.wp - b.wp || a.pe - b.pe))[0];
      if (item) {
        this.state.inventory[item.id] = (this.state.inventory[item.id] || 0) + 1;
        this.b.loot.push(item.id);
        this.event('reward', { id: u.id, text: item.name });
        this.log(`Found ${item.name}.`);
      }
    }
    for (const drop of g.opened)
      if (!drop.taken && drop.x === u.x && drop.z === u.z && u.team === 0) {
        drop.taken = true;
        used = true;
        if (drop.type === 'crystal') {
          u.hp = u.maxHp;
          u.mp = u.maxMp;
          this.gainJP(u, 40);
          this.event('reward', { id: u.id, text: 'CRYSTAL · HP/MP restored' });
        } else if (drop.item) {
          this.state.inventory[drop.item] = (this.state.inventory[drop.item] || 0) + 1;
          this.b.loot.push(drop.item);
          this.event('reward', { id: u.id, text: this.db.item.get(drop.item)?.name });
        }
      }
    return used;
  }
  checkOutcome() {
    if (this.b.result) return;
    const ramza = this.b.units.find((u) => u.name === 'Ramza' && u.team === 0),
      good = this.b.units.filter((u) => u.team === 0 && alive(u)),
      bad = this.b.units.filter((u) => teamOf(u) === 1 && alive(u)),
      rescue = this.b.units.find((u) => u.name === this.b.rescue && u.team === 0);
    if (ramza?.removed || !good.length || ((this.b.objective === 'rescue' || this.b.objective === 'roof') && rescue?.hp <= 0)) {
      this.b.result = {
        win: false,
        reason: rescue?.hp <= 0 ? `${rescue.name} could not be protected.` : 'The company has fallen.',
      };
      return;
    }
    const boss = this.b.units.find((u) => u.name === (this.b.phase ? this.def.phase?.boss : this.def.boss) && u.team === 1);
    let win = false;
    if (this.b.objective === 'phase') {
      if (!boss || boss.hp <= 0) {
        if (!this.b.phase && this.def.phase) {
          this.nextPhase();
          return;
        }
        win = true;
      }
    } else if (this.b.objective === 'boss') win = !boss || boss.hp <= 0;
    else if (this.b.objective === 'critical') win = !boss || boss.hp <= boss.maxHp * (this.def.critical ?? 0.2);
    else if (this.b.objective === 'roof') win = this.b.units.some((u) => u.team === 1 && u.hp <= u.maxHp * 0.2);
    else if (this.b.objective === 'assassins')
      win = this.b.units.some((u) => u.team === 1 && ['Celia', 'Lede'].includes(u.name) && u.hp <= u.maxHp * 0.2);
    else if (this.b.objective === 'switches') win = this.b.grid.switches.every((s) => s.on);
    else if (this.b.objective === 'explore') win = !bad.length && this.b.grid.exitDiscovered;
    else win = !bad.length;
    if (win) {
      this.b.result = { win: true, reason: 'Objective complete.' };
      this.b.pending = [];
      this.event('victory');
    }
  }
  nextPhase() {
    this.b.phase = 1;
    this.b.pending = [];
    this.b.activeId = null;
    this.b.units = this.b.units.filter((u) => u.team === 0);
    for (const u of this.b.units) {
      delete u.status.Charging;
      u.airborne = false;
    }
    for (const reserve of this.b.reserves) {
      const t = this.b.grid.tiles
        .filter((t) => !t.blocked && !unitAt(this.b, t.x, t.z) && t.z > this.b.grid.height / 2)
        .sort((a, b) => b.z - a.z)[0];
      if (t) {
        place(reserve, t);
        this.b.units.push(reserve);
      }
    }
    this.b.reserves = [];
    const names = lineup(this.def.phase.enemies),
      level = Math.max(...this.state.party.map((u) => u.level));
    names.forEach((name, i) => {
      const u = enemy(this.db, name, level, i, this.def, true);
      if (this.def.phase.hp !== undefined) u.hp = u.maxHp = this.def.phase.hp;
      const tile = this.b.grid.tiles
        .filter((t) => !t.blocked && !unitAt(this.b, t.x, t.z) && t.z < this.b.grid.height / 2)
        .sort((a, b) => a.z - b.z)[i];
      if (tile) {
        place(u, tile);
        this.b.units.push(u);
      }
    });
    this.log(`${this.def.phase.boss} emerges. Battle continues; accumulated buffs remain.`);
    this.event('phase', { name: this.def.phase.boss });
  }
  timeline(count = 8) {
    const events = this.b.pending.map((p) => ({
      id: p.casterId,
      name: p.action.name,
      ticks: Math.max(0, p.at - this.b.tick),
      spell: true,
      team: this.b.units.find((u) => u.id === p.casterId)?.team || 0,
    }));
    for (const u of this.b.units.filter(alive)) {
      if (u.status.Stop || u.airborne) continue;
      const sp = Math.max(1, Math.floor(u.speed * (u.status.Haste ? 1.5 : 1) * (u.status.Slow ? 0.5 : 1)));
      events.push({ id: u.id, name: u.name, ticks: Math.max(0, Math.ceil((100 - u.ct) / sp)), spell: false, team: teamOf(u) });
    }
    return events.sort((a, b) => a.ticks - b.ticks || Number(b.spell) - Number(a.spell)).slice(0, count);
  }
}
