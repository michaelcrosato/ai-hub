import { clamp, equipped, equipmentStats, distance, BUFFS, DEBUFFS, STATUS_NAMES, jobMembers, isMonster } from './model.js';
import { ELEMENTS } from './content.js';
const permanent = new Set(['Petrify', 'Undead', 'Oil', 'Reraise', 'Invite', 'Blood Suck']);
const durations = {
  Haste: 32,
  Slow: 32,
  Stop: 20,
  Sleep: 60,
  Poison: 40,
  Regen: 36,
  Protect: 36,
  Shell: 36,
  Reflect: 32,
  "Don't Move": 24,
  "Don't Act": 24,
  Charm: 32,
  Darkness: 45,
  Silence: 40,
  Confusion: 32,
  Berserk: 40,
  Frog: 60,
  Faith: 32,
  Innocent: 32,
  Float: 40,
  Transparent: 32,
  'Death Sentence': 36,
};
export function statusDuration(name) {
  return permanent.has(name) ? 99999 : durations[name] || 32;
}
export const alive = (u) => u.hp > 0 && !u.removed && !u.status?.Petrify;
export const awake = (u) => alive(u) && !u.status.Sleep && !u.status.Stop && !u.airborne;
export const teamOf = (u) => (u.status?.Charm || u.status?.['Blood Suck'] ? 1 - u.team : u.team);
export const faithOf = (u) => (u.status?.Innocent || u.job === 'Steel Giant' ? 0 : u.status?.Faith ? 100 : u.faith);
export function zodiac(a, b) {
  if (a.sign === 12 || b.sign === 12) return 1;
  const delta = (a.sign - b.sign + 12) % 12;
  if (delta === 4 || delta === 8) return 1.25;
  if (delta === 3 || delta === 9) return 0.75;
  if (delta === 6) return a.sex === 'X' || b.sex === 'X' ? 1 : a.sex !== b.sex ? 1.5 : 0.5;
  return 1;
}
export function weaponRange(db, u, target = u) {
  const w = db.item.get(u.equipment.weapon),
    f = w?.family || '',
    hd = (u.h || 0) - (target.h || 0);
  if (/Crossbow/i.test(f)) return { min: 3, max: 4, vertical: 99 };
  if (/Bow/i.test(f)) return { min: 3, max: Math.max(3, 5 + Math.floor(hd / 2)), vertical: 99 };
  if (/Gun/i.test(f)) return { min: 3, max: 8, vertical: 99 };
  if (/Spear|Stick|Dictionary|Fabric|Harp|Cloth|Instrument/i.test(f)) return { min: 1, max: 2, vertical: 3 };
  return { min: 1, max: 1, vertical: 2 };
}
export function physicalDamage(db, u, t, rand = () => 0.5, charge = 0) {
  const w = db.item.get(u.equipment.weapon),
    f = w?.family || '',
    wp = w?.wp || 0;
  let pa = u.pa + charge,
    sp = u.speed,
    ma = u.ma;
  if (u.support === 'Attack UP') pa = Math.floor((pa * 4) / 3);
  if (u.status.Berserk) pa = Math.floor(pa * 1.5);
  if (u.status.Frog || u.status.Chicken) return 1;
  if (!wp) {
    if (u.job === 'Monk' || u.job === 'Mime' || u.support === 'Martial Arts') pa = Math.floor(pa * 1.5);
    return Math.floor((pa * u.brave) / 100) * pa;
  }
  if (/Gun/.test(f)) {
    if (/Blaze|Glacier|Blast/.test(w.name)) {
      const r = rand(),
        q = r < 0.7 ? 14 : r < 0.9 ? 18 : 24;
      return Math.floor((faithOf(u) * faithOf(t) * wp * q) / 10000);
    }
    return wp * wp;
  }
  let xa = pa;
  if (/Knife|Knives|Daggers|Ninja|Longbows/.test(f)) xa = Math.floor((pa + sp) / 2);
  if (/Knight Sword|Katana/.test(f)) xa = Math.floor((pa * u.brave) / 100);
  if (/Staff|Staves|Stick/.test(f)) xa = ma;
  if (/Harp|Fabric|Dictionary|Cloths|Instruments/.test(f)) xa = Math.floor((pa + ma) / 2);
  if (/Axe|Flail|Hammers|Bag/.test(f)) xa = 1 + Math.floor(rand() * pa);
  if (u.support === 'Two Hands') xa *= 2;
  return xa * wp;
}
export function facingClass(u, t) {
  const dx = u.x - t.x,
    dz = u.z - t.z;
  const forward = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ][t.facing || 0];
  const dot = dx * forward[0] + dz * forward[1];
  return dot > 0 ? 'front' : dot < 0 ? 'back' : 'side';
}
export function evasion(db, u, t, magic = false, action = {}) {
  if (t.status.Sleep || t.status.Stop || t.status.Petrify || t.status.Charging || t.airborne) return 0;
  if (!magic && u.support === 'Concentrate') return 0;
  const side = facingClass(u, t);
  let chance = 1;
  const shield = db.item.get(t.equipment.shield),
    accessory = db.item.get(t.equipment.accessory);
  const double = t.status.Defending ? 2 : t.reaction === 'Abandon' ? 2 : 1;
  if (magic) {
    chance *= 1 - clamp((shield?.me || 0) * double, 0, 100) / 100;
    chance *= 1 - clamp((accessory?.me || 0) * double, 0, 100) / 100;
  } else {
    if (side === 'front') chance *= 1 - clamp((t.evade || 5) * double * (u.status.Darkness ? 2 : 1), 0, 100) / 100;
    if (side !== 'back' && shield) chance *= 1 - clamp((shield.pe || shield.evade || 0) * double, 0, 100) / 100;
    if (accessory) chance *= 1 - clamp((accessory.pe || 0) * double, 0, 100) / 100;
    if (t.reaction === 'Weapon Guard') chance *= 1 - clamp((db.item.get(t.equipment.weapon)?.evade || 0) * double, 0, 100) / 100;
    if (t.reaction === 'Blade Grasp' && ['Attack', 'Jump', 'Charge', 'Throw'].includes(action.family))
      chance *= 1 - t.brave / 100;
    if (t.reaction === 'Arrow Guard' && action.family === 'Attack' && /Bow/.test(db.item.get(u.equipment.weapon)?.family || ''))
      chance *= 1 - t.brave / 100;
  }
  return clamp(1 - chance, 0, 1);
}
/** Parse arithmetic only. Never evaluate guide strings as JavaScript. */
export function arithmetic(text, vars, random = () => 0.5) {
  const normalized = text
    .replace(/\bCaster_MaxHP\b/g, 'C_MaxHP')
    .replace(/\bTarget_MaxHP\b/g, 'T_MaxHP')
    .replace(/\bTarget_MaxMP\b/g, 'T_MaxMP')
    .replace(/\bCaster_Lv\b/g, 'Lv')
    .replace(/\bCaster_Sp\b/g, 'Sp')
    .replace(/\bCaster_MaxMP\b/g, 'C_MaxMP')
    .replace(/\bRU\s*\{/g, 'ceil(')
    .replace(/\bmin\s*\{/g, 'min(')
    .replace(/\bmax\s*\{/g, 'max(')
    .replace(/\}/g, ')');
  const toks = [];
  const re = /\s*(\.\.|\d+(?:\.\d+)?|[A-Za-z_]+|[+\-*/()[\],])/gy;
  let m;
  while ((m = re.exec(normalized))) {
    const s = m[1];
    if (/^[A-Za-z_]/.test(s) && !(s in vars) && !['ceil', 'min', 'max'].includes(s)) break;
    toks.push(s);
  }
  let p = 0;
  function atom() {
    const tok = toks[p++];
    if (tok === undefined) return 0;
    if (tok === '-') return -atom();
    if (tok === '+') return atom();
    if (tok === '(' || tok === '[') {
      const v = expr();
      if (toks[p] === ')' || toks[p] === ']') p++;
      return tok === '[' ? Math.trunc(v) : v;
    }
    if (['ceil', 'min', 'max'].includes(tok)) {
      p++;
      const a = expr();
      let b = 0;
      if (toks[p] === ',') {
        p++;
        b = expr();
      }
      if (toks[p] === ')') p++;
      return tok === 'ceil' ? Math.ceil(a) : tok === 'min' ? Math.min(a, b) : Math.max(a, b);
    }
    if (tok in vars) return vars[tok];
    return +tok || 0;
  }
  function mul() {
    let v = atom();
    while (['*', '/'].includes(toks[p])) {
      const op = toks[p++],
        n = atom();
      v = op === '*' ? v * n : n ? v / n : 0;
    }
    return v;
  }
  function expr() {
    let v = mul();
    while (['+', '-', '..'].includes(toks[p])) {
      const op = toks[p++],
        n = mul();
      v = op === '+' ? v + n : op === '-' ? v - n : Math.floor(v + random() * (n - v + 1));
    }
    return v;
  }
  const value = expr();
  return Number.isFinite(value) ? value : 0;
}
function statusList(text) {
  return [...STATUS_NAMES, 'Quick'].filter((s) =>
    new RegExp('(^|[ ,:&])' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=$|[ ,.;(])', 'i').test(text),
  );
}
const healingNames =
  /^(Cure|Raise|Reraise|Regen|Protect|Shell|Wall|Esuna|Haste|Float|Reflect|Quick|Moogle|Fairy|Golem|Carbunkle|Murasame|Kiyomori|Masamune|Chakra|Revive|Stigma Magic|Heal|Wish|Yell|Cheer Up|Scream|Accumulate|Praise|Preach|Pray Faith|Dragon Care|Dragon PowerUp|Dragon LevelUp|Choco Cure|Choco Esuna|Spirit of Life|Magic Spirit|Protect Spirit|Clam Spirit|Leaf Dance|Energy|MBarrier)/;
export function actionSpec(db, u, id, extra = {}) {
  if (id === 'attack')
    return {
      id,
      name: 'Attack',
      family: 'Attack',
      damageType: 'physical',
      range: weaponRange(db, u).max,
      vertical: 2,
      area: 0,
      areaVertical: 2,
      mp: 0,
      ctr: 0,
      evade: true,
      enemy: true,
      element: equipmentStats(db, u).element,
      ...extra,
    };
  if (id === 'jump')
    return {
      id,
      name: 'Jump',
      family: 'Jump',
      damageType: 'physical',
      range: Math.max(2, ...u.learned.map((x) => +(db.action.get(x)?.name.match(/^Level Jump\s*(\d+)/)?.[1] || 0))),
      vertical: 99,
      area: 0,
      areaVertical: 99,
      mp: 0,
      ctr: Math.max(1, Math.floor(50 / u.speed)),
      evade: false,
      enemy: true,
      ...extra,
    };
  if (id.startsWith('throw:')) {
    const item = db.item.get(id.slice(6));
    return {
      id,
      name: `Throw ${item?.name || 'weapon'}`,
      family: 'Throw',
      damageType: 'physical',
      itemId: item?.id,
      range: u.move,
      vertical: 99,
      area: 0,
      areaVertical: 99,
      mp: 0,
      ctr: 0,
      evade: true,
      enemy: true,
      wp: item?.wp || 4,
      element: item?.name.includes('Fire')
        ? 'Fire'
        : item?.name.includes('Water')
          ? 'Water'
          : item?.name.includes('Lightning')
            ? 'Lightning'
            : '',
      ...extra,
    };
  }
  if (id.startsWith('math:')) {
    const [, spell, attribute, divisor] = id.split(':');
    return {
      ...actionSpec(db, u, spell),
      id,
      sourceId: spell,
      name: `${attribute} ${divisor} · ${db.action.get(spell)?.name}`,
      family: 'Math',
      math: { attribute, divisor },
      range: 999,
      vertical: 99,
      mp: 0,
      ctr: 0,
      reflect: false,
      ...extra,
    };
  }
  const a = db.action.get(id);
  if (!a) return null;
  const text = a.formula || '';
  let range = /^Auto/i.test(a.range)
    ? 0
    : +(a.range.match(/\d+(?:\.\d+)?/)?.[0] || a.description.match(/\*\*Range:\*\*\s*(\d+)/)?.[1] || 4);
  let area = Math.max(0, +(a.area.match(/^\d+/)?.[0] || 1) - 1),
    av = +(a.area.match(/v(\d+)/)?.[1] ?? 99),
    v = +(a.range.match(/v(\d+)/)?.[1] ?? 99);
  if (!a.range) {
    const effect = a.description.match(/\*\*Effect:\*\* (\d+)(?:, Vertical (\d+))?/);
    if (effect) {
      area = +effect[1] - 1;
      av = +(effect[2] ?? 99);
    }
  }
  const add = statusList(
    text.match(/(?:^| )Add(?::| any one of the following:)\s*(.*?)(?= Success| You | Caster | If |$)/i)?.[1] || '',
  );
  const cancel = statusList(text.match(/Cancel:\s*(.*?)(?= Success| You | Caster | If | Restore|$)/i)?.[1] || '');
  const may = statusList(text.match(/May add:\s*(.*?)(?= Critical| Caster| You |$)/i)?.[1] || '');
  let family = a.group,
    heal = healingNames.test(a.name) || family === 'SING';
  if (a.name.startsWith('Charge +')) {
    family = 'Charge';
    range = weaponRange(db, u).max;
    area = 0;
  }
  if (
    a.kind === 'direct' &&
    /Potion|Ether|Elixir|Antidote|Eye Drop|Echo Grass|Maiden|Soft|Holy Water|Remedy|Phoenix Down/.test(a.name)
  ) {
    family = 'Item';
    range = u.job === 'Chemist' || u.support === 'Throw Item' ? 4 : 1;
    v = 3;
    heal = true;
  }
  if (['SING', 'DANCE', 'STARRY HEAVEN'].includes(family) || ['Golem', 'Carbunkle'].includes(a.name)) {
    range = 999;
    area = 999;
    av = 99;
  }
  if (family === 'DRAW OUT' && !['Kikuichimoji'].includes(a.name)) {
    range = 0;
    area = Math.max(area, 2);
    av = 3;
  }
  if (a.name === 'Accumulate' || a.name === 'Scream') {
    range = 0;
    area = 0;
  }
  const element = ELEMENTS[a.element] || (a.element === 'wpn' ? equipmentStats(db, u).element : '');
  const spec = {
    ...a,
    family,
    range,
    vertical: v,
    area,
    areaVertical: av,
    mp: a.mp,
    ctr: u.support === 'Short Charge' && a.ctr > 0 ? Math.max(1, Math.ceil(a.ctr / 2)) : a.ctr,
    heal,
    enemy: !heal,
    add,
    cancel,
    may,
    element,
    self: range === 0,
    teamOnly: ['SUMMON MAGIC', 'DRAW OUT', 'SING', 'DANCE', 'STARRY HEAVEN'].includes(family),
    repeat: ['SING', 'DANCE'].includes(family),
    line: ['Earth Slash', 'Kikuichimoji'].includes(a.name),
    formula: text,
    ...extra,
  };
  if (u.support === 'Half of MP') spec.mp = Math.floor(spec.mp / 2);
  if (spec.line) {
    spec.range = 8;
    spec.area = 0;
    spec.vertical = 3;
  }
  if (spec.repeat) spec.ctr = +(text.match(/every (\d+) clockticks/)?.[1] || 6);
  if (a.name === 'Sand Storm') spec.add = ['Darkness'];
  return spec;
}
export function selectableActions(db, state, u) {
  if (u.status.Frog || u.status.Chicken || u.status.Berserk) return [actionSpec(db, u, 'attack')];
  let ids = [];
  if (u.monster) {
    ids = db.monster.get(u.job)?.abilities || u.skills || [];
  } else {
    const primary = jobMembers(db, u)
      .filter((m) => m.role === 'A' || m.role === 'E')
      .map((m) => m.id);
    const secondary = jobMembers(db, u, u.secondary === 'Item' ? 'Chemist' : u.secondary)
      .filter((m) => m.role === 'A' || m.role === 'E')
      .map((m) => m.id);
    ids = [...primary, ...secondary].filter((id) => u.learned.includes(id));
  }
  if (u.skills) ids.push(...u.skills);
  if (u.name === 'Ramza' && u.job === 'Squire' && u.learned.includes('ability-09a')) ids.push('ability-09a');
  const result = [actionSpec(db, u, 'attack')];
  const physicalDirect =
    /^Level Jump|^Vertical Jump|^CT$|^Level$|^Exp$|^Height$|^Prime Number$|^[345]$|^Knife$|^Sword$|^Hammer$|^Katana$|^Ninja Sword$|^Axe$|^Spear$|^Stick$|^Knight Sword$|^Dictionary$|^Ball$|^Shuriken$/;
  for (const id of [...new Set(ids)]) {
    const a = db.action.get(id);
    if (!a || physicalDirect.test(a.name)) continue;
    const spec = actionSpec(db, u, id);
    if (spec) result.push(spec);
  }
  if (u.job === 'Lancer' || u.secondary === 'Lancer' || u.skills?.includes('jump')) result.push(actionSpec(db, u, 'jump'));
  if (u.job === 'Ninja' || u.secondary === 'Ninja') {
    const names = new Set(ids.map((id) => db.action.get(id)?.name));
    for (const item of db.items)
      if ((state.inventory[item.id] || 0) > 0 && (item.slot === 'throw' || item.slot === 'weapon')) {
        if (item.slot === 'throw' || names.has(item.family.replace(/s$/, ''))) result.push(actionSpec(db, u, 'throw:' + item.id));
      }
  }
  return result.filter((a) => a && !(a.family === 'ELEMENTAL' && !geomancyMatches(a.name, u.terrain)));
}
const geomancy = {
  P: 'Pitfall',
  W: 'Water Ball',
  H: 'Hell Ivy',
  C: 'Carve Model',
  L: 'Local Quake',
  K: 'Kamaitachi',
  D: 'Demon Fire',
  Q: 'Quicksand',
  S: 'Sand Storm',
  B: 'Blizzard',
  G: 'Gusty Wind',
  A: 'Lava Ball',
};
export function geomancyMatches(name, terrain) {
  return geomancy[terrain || 'P'] === name;
}
export function katanaItem(db, a) {
  return (
    db.itemNamed(a.name === 'Asura' ? 'Asura Knife' : a.name === 'Koutetsu' ? 'Kotetsu Knife' : a.name) ||
    db.items.find((i) => i.name.toLowerCase().includes(a.name.toLowerCase().slice(0, 5)) && i.family === 'Katana')
  );
}
export function actionBlocked(db, state, u, a) {
  if (!a) return 'Unknown action.';
  if (u.acted) return 'This unit has already acted.';
  if (!alive(u) || u.status.Sleep || u.status.Stop || u.status["Don't Act"]) return 'This unit cannot act.';
  if (u.status.Silence && a.mp > 0) return 'Silenced.';
  if (u.mp < a.mp) return 'Not enough MP.';
  if (a.math) {
    const attr = 'ability-direct-' + a.math.attribute.toLowerCase(),
      div = 'ability-direct-' + (a.math.divisor === 'Prime' ? 'prime-number' : a.math.divisor);
    if (!u.learned.includes(attr) || !u.learned.includes(div)) return 'Learn the calculation attribute and divisor first.';
    if (!db.action.get(a.sourceId)?.calc || !u.learned.includes(a.sourceId)) return 'This spell cannot be calculated.';
  }
  if (a.family === 'Item' && u.team === 0 && !u.guest) {
    const item = db.itemNamed(a.name);
    if (!item || (state.inventory[item.id] || 0) < 1) return 'None in stock.';
  }
  if (a.family === 'Throw' && u.team === 0 && !u.guest && !(state.inventory[a.itemId] > 0)) return 'None in stock.';
  if (a.family === 'DRAW OUT' && u.team === 0 && !u.guest) {
    const item = katanaItem(db, a);
    if (!item || (state.inventory[item.id] || 0) < 1) return 'Requires a spare katana in inventory.';
  }
  if (
    ['HOLY SWORD', 'MIGHTY SWORD', 'DARK SWORD', 'MAGIC SWORD'].includes(a.family) &&
    !db.item.get(u.equipment.weapon)?.family.includes('Sword')
  )
    return 'Requires an equipped sword.';
  if (a.family === 'LIMIT' && db.item.get(u.equipment.weapon)?.name !== 'Materia Blade')
    return 'Cloud needs Materia Blade equipped.';
  return '';
}
export function inRange(db, u, a, t) {
  const d = distance(u, t);
  if (a.self) return d === 0;
  if (a.family === 'Attack' || a.family === 'Charge') {
    const r = weaponRange(db, u, t);
    return d >= r.min && d <= r.max && Math.abs(u.h - t.h) <= r.vertical;
  }
  return d <= a.range && Math.abs(u.h - t.h) <= a.vertical;
}
export function affected(a, caster, center, units) {
  if (a.math) {
    return units.filter((t) => {
      const val =
        a.math.attribute === 'CT'
          ? Math.floor(t.ct)
          : a.math.attribute === 'Height'
            ? t.h
            : a.math.attribute === 'Exp'
              ? t.exp
              : t.level;
      if (!Number.isInteger(val)) return false;
      const d = a.math.divisor;
      if (d === 'Prime')
        return (
          val >= 2 &&
          Array.from({ length: Math.max(0, Math.floor(Math.sqrt(val)) - 1) }, (_, i) => i + 2).every((n) => val % n !== 0)
        );
      return val % +d === 0;
    });
  }
  return units.filter((t) => {
    if (t.removed || t.airborne) return false;
    if (a.teamOnly && (a.heal ? teamOf(t) !== teamOf(caster) : teamOf(t) === teamOf(caster))) return false;
    if (a.line) {
      const dx = center.x - caster.x,
        dz = center.z - caster.z,
        tx = t.x - caster.x,
        tz = t.z - caster.z;
      return (
        ((dx === 0 && tx === 0 && Math.sign(tz) === Math.sign(dz)) ||
          (dz === 0 && tz === 0 && Math.sign(tx) === Math.sign(dx))) &&
        distance(caster, t) <= 8 &&
        Math.abs(t.h - caster.h) <= 3
      );
    }
    return distance(t, center) <= a.area && Math.abs(t.h - (center.h || 0)) <= a.areaVertical;
  });
}
export function predict(db, u, t, a, random = () => 0.5) {
  let pa = u.pa,
    ma = u.ma,
    sp = u.speed;
  const gear = equipmentStats(db, u),
    tg = equipmentStats(db, t);
  if (a.family === 'PUNCH ART' || (['STEAL', 'TALK SKILL'].includes(a.family) && u.support === 'Martial Arts')) {
    if (u.job === 'Monk' || u.support === 'Martial Arts') {
      pa = Math.floor(pa * 1.5);
      ma = Math.floor(ma * 1.5);
      sp = Math.floor(sp * 1.5);
    }
  }
  if (u.support === 'Magic AttackUP' && a.damageType === 'magical') ma = Math.floor((ma * 4) / 3);
  if (u.support === 'Attack UP' && a.damageType === 'physical') pa = Math.floor((pa * 4) / 3);
  if (a.element && gear.strengthen.some((e) => e.toLowerCase() === a.element.toLowerCase())) {
    ma = Math.floor((ma * 5) / 4);
    pa = Math.floor((pa * 5) / 4);
  }
  const vars = {
    PA: pa,
    MA: ma,
    Sp: sp,
    Speed: sp,
    WP: db.item.get(u.equipment.weapon)?.wp || 0,
    Br: u.brave,
    CFa: faithOf(u),
    TFa: faithOf(t),
    Lv: u.level,
    T_MaxHP: t.maxHp,
    T_MaxMP: t.maxMp,
    C_MaxHP: u.maxHp,
    C_MaxMP: u.maxMp,
  };
  let amount = 0,
    hit = 100,
    heal = false,
    mp = false,
    drain = false,
    revive = false;
  const f = a.formula || '';
  const success = f.match(/Success%\s*=\s*(.+)/)?.[1];
  if (success) hit = arithmetic(success, vars, random);
  if (a.family === 'Attack' || a.family === 'Charge')
    amount = physicalDamage(db, u, t, random, a.family === 'Charge' ? +(a.name.match(/\d+/)?.[0] || 1) : 0);
  else if (a.family === 'Jump')
    amount = physicalDamage(db, u, t, random) * (db.item.get(u.equipment.weapon)?.family === 'Spears' ? 1.5 : 1);
  else if (a.family === 'Throw') amount = u.speed * a.wp;
  else if (a.family === 'Item') {
    const heals = { Potion: 30, 'Hi-Potion': 70, 'X-Potion': 150, Ether: 20, 'Hi-Ether': 50, Elixir: t.maxHp };
    amount = heals[a.name] || 0;
    heal = true;
    mp = /Ether/.test(a.name);
    revive = a.name === 'Phoenix Down';
    if (revive) amount = Math.max(1, Math.floor(t.maxHp * 0.2));
  } else if (a.name === 'Wish') {
    amount = Math.ceil(u.maxHp * 0.4);
    heal = true;
  } else if (a.name === 'Chakra') {
    amount = pa * 5;
    heal = true;
  } else if (a.name === 'Revive') {
    amount = Math.ceil(t.maxHp * 0.2);
    heal = true;
    revive = true;
  } else if (a.name === 'Raise' || a.name === 'Raise 2') {
    amount = a.name === 'Raise' ? Math.ceil(t.maxHp * 0.5) : t.maxHp;
    heal = true;
    revive = true;
  } else if (a.name === 'Murasame') {
    amount = ma * 12;
    heal = true;
  } else if (a.name === 'Energy') {
    amount = Math.ceil(u.maxHp / 2);
    heal = true;
  } else if (a.name === 'Golem') {
    amount = u.maxHp;
    heal = true;
  } else if (a.name === 'Self-Destruct') {
    amount = u.maxHp - u.hp;
  } else if (
    a.name === 'Goblin Punch' ||
    a.name === 'Lifebreak' ||
    a.name === 'Difference' ||
    a.name === 'Shock!' ||
    a.name === 'Blade Beam'
  ) {
    amount = u.maxHp - u.hp;
  } else if (/Demi|Lich|Life Drain|^Drain$|Spell Absorb|Aspel/.test(a.name)) {
    const fraction = /Lich|Demi 2/.test(a.name) ? 0.5 : /Spell Absorb/.test(a.name) ? 0.33 : 0.25;
    mp = /Spell Absorb|Aspel/.test(a.name);
    amount = Math.ceil((mp ? t.maxMp : t.maxHp) * fraction);
    drain = /Drain|Absorb|Aspel/.test(a.name);
  } else {
    let expression = f.match(/(?:Damage(?: to (?:HP|MP|target))?\s*[:=]|Restore|Heals?)\s*([^\n]+)/i)?.[1];
    if (expression) {
      if (expression.startsWith('HP')) expression = expression.slice(2);
      amount = arithmetic(expression, vars, random);
      heal = /^(Restore|Heal)/i.test(f);
      mp = /^(Damage to MP|Restore[^]*?\] MP)/i.test(f);
    }
  }
  if (revive && t.hp > 0 && !t.status.Undead) hit = 0;
  if (!revive && t.hp <= 0) hit = 0;
  if (a.name === 'Steal Heart' && u.sex === t.sex) hit = 0;
  if (a.family === 'TALK SKILL' && isMonster(db, t) && u.job !== 'Mediator' && u.support !== 'Monster Talk') hit = 0;
  if (t.job === 'Steel Giant' && a.damageType === 'magical' && a.family !== 'DRAW OUT') hit = 0;
  if (a.name === 'Seal Evil' && !t.status.Undead) hit = 0;
  if (a.name === 'Invitation' && (t.boss || t.guest || t.invited)) hit = 0;
  const z = zodiac(u, t);
  if (a.family !== 'Item' && !['Wish', 'Golem', 'Murasame', 'Energy'].includes(a.name)) {
    if (!/Demi|Lich|Drain|Absorb|Aspel|Self-Destruct|Lifebreak|Difference|Shock/.test(a.name)) amount *= z;
    if (success && !/Ignores zodiac/.test(f)) hit *= z;
  }
  if (a.evade) hit *= 1 - evasion(db, u, t, a.damageType === 'magical', a);
  if (!heal && amount > 0) {
    if (a.damageType === 'physical' && (t.status.Protect || t.support === 'Defense UP')) amount = Math.floor((amount * 2) / 3);
    if (a.damageType === 'magical' && (t.status.Shell || t.support === 'Magic DefendUP')) amount = Math.floor((amount * 2) / 3);
    if (t.status.Charging) amount = Math.floor(amount * 1.5);
    if (t.status.Sleep) amount = Math.floor(amount * 1.5);
  }
  if (a.element) {
    const matches = (list) => list?.some((el) => el.toLowerCase() === a.element.toLowerCase());
    if (matches(tg.absorb) || matches(t.absorb)) {
      amount = -amount;
      heal = !heal;
    }
    if (matches(tg.half) || matches(t.half)) amount *= 0.5;
    if (matches(tg.weak) || matches(t.weak)) amount *= 2;
    if (matches(tg.block) || matches(t.cancel)) amount = 0;
    if (a.element === 'Earth' && (t.status.Float || t.movement === 'Fly')) amount = 0;
    if (u.weather === 'rain') {
      if (a.element === 'Fire') amount *= 0.75;
      if (a.element === 'Lightning') amount *= 1.25;
    }
    if (u.weather === 'snow' && a.element === 'Ice') amount *= 1.25;
  }
  if (heal && t.status.Undead && !mp) {
    heal = false;
    if (a.family === 'Item' && a.name === 'Phoenix Down') amount = t.maxHp;
  }
  if (t.boss && a.add?.length && t.vulnerable && a.add.every((s) => !t.vulnerable.includes(s) && !BUFFS.includes(s))) hit = 0;
  if (a.add?.length && a.add.every((s) => tg.block.includes(s))) hit = 0;
  return {
    amount: clamp(Math.abs(Math.floor(amount)), 0, 999),
    hit: clamp(Math.floor(hit), 0, 100),
    heal,
    mp,
    drain,
    revive,
    side: facingClass(u, t),
  };
}
