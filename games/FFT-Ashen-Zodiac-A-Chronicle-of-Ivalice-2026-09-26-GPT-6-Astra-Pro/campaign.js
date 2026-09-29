import { CAMPAIGN, OPTIONAL, DISPATCHES, CHARACTERS } from './content.js';
import {
  copy,
  clamp,
  stock,
  recruit,
  createUnit,
  awardJP,
  equipmentStats,
  jobMembers,
  jobUnlocked,
  defaultWeapon,
  stats,
  rngStep,
} from './model.js';
export function finishBattle(db, s) {
  const b = s.battle;
  if (!b?.result || b.rewarded) return null;
  b.rewarded = true;
  const def = db.encounter.get(b.definitionId);
  if (!b.result.win) {
    s.stats.defeats++;
    return { win: false };
  }
  s.seed = b.seed;
  s.stats.victories++;
  const isStory = CAMPAIGN.some((e) => e.id === def.id),
    first = !s.completed.includes(def.id),
    level = Math.max(1, ...s.party.map((u) => u.level));
  const reward = {
    win: true,
    gil: Math.floor(650 + level * 125 + (def.boss ? 450 : 0)),
    jp: 100 + (def.chapter || 1) * 20,
    items: [],
    recruits: [],
    first,
  };
  s.gil += reward.gil;
  s.relics += def.boss ? 2 : 1;
  for (const u of b.units.filter((u) => u.team === 0 && !u.guest)) {
    let p = s.party.find((p) => p.id === u.id);
    if (!p && u.invited) {
      p = createUnit(db, u.name, u.job, u.level, { monster: u.monster, id: u.id });
      s.party.push(p);
      s.stats.recruits++;
      reward.recruits.push(u.name);
    }
    if (!p) continue;
    if (u.removed && s.options.permadeath && p.name !== 'Ramza' && !CHARACTERS[p.name]) {
      s.party = s.party.filter((v) => v.id !== p.id);
      s.selected = s.selected.filter((id) => id !== p.id);
      continue;
    }
    awardJP(p, u.job, reward.jp);
    p.brave = clamp(p.brave + Math.trunc((u.brave - u.baseBrave) / 4), 6, 97);
    p.faith = clamp(p.faith + Math.trunc((u.faith - u.baseFaith) / 4), 3, 93);
    p.equipment = copy(u.equipment);
    p.learned = [...new Set([...p.learned, ...u.learned])];
    if (isStory) p.level = Math.max(p.level, Math.floor(s.progress * 0.88) + 2);
  }
  // Reserve catch-up is an authored aid. It does not replace JP learning.
  if (isStory) for (const p of s.party) p.level = Math.max(p.level, Math.floor(s.progress * 0.65) + 1);
  if (first) s.completed.push(def.id);
  if (isStory && CAMPAIGN[s.progress]?.id === def.id) {
    s.progress++;
    s.chapter = CAMPAIGN[Math.min(s.progress, CAMPAIGN.length - 1)].chapter;
  }
  if (def.scenes?.length)
    for (let n = def.scenes[0]; n <= def.scenes[1]; n++) {
      const id = 'scene-' + String(n).padStart(3, '0');
      if (!s.discoveries.includes(id)) s.discoveries.push(id);
    }
  for (const name of def.recruit || []) {
    const u = recruit(db, s, name);
    if (u) reward.recruits.push(name);
  }
  if (def.id === 'battle-2-2b' && !b.choice.rescue) {
    s.party = s.party.filter((p) => p.name !== 'Boco');
    reward.recruits = reward.recruits.filter((n) => n !== 'Boco');
  }
  if (def.treasureReward) {
    const item = stock(s, db, def.treasureReward);
    if (item) reward.items.push(item.id);
    else s.discoveries.push(def.treasureReward);
  }
  if (def.id === 'battle-2-4g') {
    s.flags.flowerOffer = true;
    const u = s.party.find((p) => p.name === 'Orlandu');
    if (u) u.learned = [...new Set([...u.learned, 'ability-0a5', 'ability-09b', 'ability-09f'])];
  }
  if (def.id === 'battle-2-4m') s.flags.adramelk = true;
  if (def.id === 'battle-2-4p') s.flags.deepAvailable = true;
  if (def.id === 'optional-colliery-passage') {
    s.flags.reisRescued = true;
    const u = s.party.find((u) => u.name === 'Reis');
    if (u) {
      u.job = 'Holy Dragon';
      u.monster = true;
      u.skills = ['ability-0f8', 'ability-0f9', 'ability-0fa', 'ability-0ff'];
    }
  }
  if (def.id === 'optional-nelveska') {
    s.flags.reisHuman = true;
    const u = s.party.find((u) => u.name === 'Reis');
    if (u) {
      u.job = u.baseJob = 'Dragoner';
      u.monster = false;
    }
  }
  if (def.id === 'optional-zarghidas') s.flags.cloudRescued = true;
  if (def.dungeon === 9) s.flags.zodiacTrial = true;
  for (const monster of b.poached) {
    const poach = db.poaches.find((p) => p.monster === monster || p.monster === monster.replace('Chocobo', 'Yellow Chocobo'));
    if (poach) {
      const name = rngStep(s) < 0.15 ? poach.rare : poach.common,
        item = db.itemNamed(name);
      if (item) s.fur.push(item.id);
    }
  }
  const refill = s.chapter >= 4 ? 'X-Potion' : s.chapter >= 2 ? 'Hi-Potion' : 'Potion';
  for (const [n, qty] of [
    [refill, 3],
    ['Phoenix Down', 2],
    ['Ether', 1],
  ]) {
    const item = stock(s, db, n, qty);
    if (item) reward.items.push(item.id);
  }
  for (const n of def.reward || []) {
    const item = stock(s, db, n);
    if (item) reward.items.push(item.id);
  }
  if (def.ending) {
    s.flags.campaignWon = true;
    s.endingSeen = false;
  }
  advanceDays(db, s, 1);
  s.journal.unshift(`Day ${s.day}: Victory at ${def.name}. +${reward.gil} gil, +${reward.jp} JP.`);
  s.journal = s.journal.slice(0, 150);
  b.reward = reward;
  return reward;
}
export function advanceDays(db, s, n = 1) {
  s.day += n;
  for (const dispatch of s.dispatches.filter((d) => !d.finished && d.due <= s.day)) {
    const def = DISPATCHES.find((d) => d.id === dispatch.id),
      unit = s.party.find((u) => u.id === dispatch.unitId);
    dispatch.finished = true;
    const multiplier = unit?.job === def.job ? 1.4 : 1,
      gil = Math.floor(def.reward * multiplier);
    s.gil += gil;
    if (unit) {
      unit.away = false;
      awardJP(unit, unit.job, Math.floor(def.jp * multiplier));
    }
    s.journal.unshift(`${def.name}: ${unit?.name || 'The company'} returned. +${gil} gil.`);
    s.discoveries.push(def.name);
    s.relics++;
  }
  const monsters = s.party.filter((u) => u.monster && u.generic && !u.away);
  if (monsters.length && s.party.length < 24 && rngStep(s) < Math.min(0.65, 0.15 * n)) {
    const parent = monsters[Math.floor(rngStep(s) * monsters.length)],
      family = parent.job.includes('Chocobo')
        ? ['Chocobo', 'Black Chocobo', 'Red Chocobo']
        : ['Uribo', 'Porky', 'Wildbow'].includes(parent.job)
          ? ['Uribo', 'Porky', 'Wildbow']
          : parent.job.includes('Dragon')
            ? ['Dragon', 'Blue Dragon', 'Red Dragon']
            : [parent.job],
      job = family[Math.floor(rngStep(s) * family.length)],
      child = createUnit(db, `${job} hatchling`, job, parent.level, { monster: true });
    s.party.push(child);
    s.journal.unshift(`A ${job} hatched in camp.`);
  }
}
export function dispatchUnit(s, id, unitId) {
  const d = DISPATCHES.find((x) => x.id === id),
    u = s.party.find((x) => x.id === unitId);
  if (!d || !u || !u.generic || u.monster || u.away || s.gil < d.fee) return false;
  if (s.dispatches.some((x) => x.id === id && !x.finished)) return false;
  s.gil -= d.fee;
  u.away = true;
  s.selected = s.selected.filter((id) => id !== unitId);
  s.dispatches.push({ id, unitId, due: s.day + d.days, finished: false });
  return true;
}
export function optionalAvailable(s, e) {
  if (e.requires && !s.completed.includes(e.requires)) return false;
  if (e.unlock === 'colliery') return !!s.flags.beowulf;
  if (e.unlock === 'nelveska') return !!s.flags.nelveska;
  if (e.unlock === 'cloud') return !!s.flags.cloudSummoned;
  if (e.unlock === 'volcano') return !!s.flags.cloudRescued;
  if (e.unlock === 'rare') return s.chapter >= 4;
  if (e.unlock === 'deep') return !!s.flags.deep;
  if (e.dungeon !== undefined) return !!s.flags.deep;
  return e.requires ? s.completed.includes(e.requires) : true;
}
export function rumorActions(s) {
  const list = [],
    mustadio = s.party.some((u) => u.name === 'Mustadio');
  if (s.flags.flowerOffer && !s.flags.flower)
    list.push({
      id: 'flower',
      name: 'Zarghidas · Buy a flower',
      text: 'The flower seller offers a blossom for 1 gil. This small kindness is needed for Cloud’s route.',
    });
  if (s.flags.adramelk && mustadio && !s.flags.machine)
    list.push({
      id: 'machine',
      name: 'Goug · Visit Besrodio',
      text: 'Mustadio’s father has found an ancient machine. A Zodiac Stone stirs it.',
    });
  if (s.flags.machine && !s.flags.ghost)
    list.push({
      id: 'ghost',
      name: 'Goland · Ghost of Colliery',
      text: 'The miners speak of a pale dragon deep below the city.',
    });
  if (s.flags.ghost && !s.flags.beowulf)
    list.push({
      id: 'beowulf',
      name: 'Lesalia · Accept Beowulf',
      text: 'A Temple Knight asks to travel with you into the colliery.',
    });
  if (s.flags.reisRescued && !s.flags.worker8)
    list.push({
      id: 'worker8',
      name: 'Goug · Awaken Worker 8',
      text: 'The recovered stone gives the ancient construct a new purpose.',
    });
  if (s.flags.worker8 && s.flags.flower && !s.flags.nelveska)
    list.push({
      id: 'nelveska',
      name: 'Zeltennia · The Cursed Island',
      text: 'A rumor points to Nelveska Temple, where a guardian still obeys forgotten orders.',
    });
  if (s.flags.reisHuman && !s.flags.cloudSummoned)
    list.push({
      id: 'cloudSummoned',
      name: 'Goug · Activate the second machine',
      text: 'The machine draws a stranger across worlds. He vanishes toward Zarghidas.',
    });
  if (s.flags.deepAvailable && !s.flags.deep)
    list.push({
      id: 'deep',
      name: 'Warjilis · Listen at the tavern',
      text: 'A quarrel between adventurers reveals the entrance to the Deep Dungeon.',
    });
  return list;
}
export function takeRumor(db, s, id) {
  if (!rumorActions(s).some((r) => r.id === id)) return false;
  if (id === 'flower') {
    if (s.gil < 1) return false;
    s.gil--;
  }
  s.flags[id] = true;
  if (id === 'worker8') recruit(db, s, 'Worker 8');
  s.journal.unshift(`Rumor followed: ${id}.`);
  advanceDays(db, s);
  return true;
}
export function shopStock(db, s, relic = false) {
  const level = [7, 10, 24, 38, 99][s.chapter] || 99;
  return db.items
    .filter((i) =>
      relic
        ? i.rare && i.slot !== 'consumable'
        : (i.slot === 'consumable' || !i.rare || ((i.level || 0) < 40 && i.price > 100)) &&
          (i.level || 1) <= level &&
          i.price !== null,
    )
    .sort((a, b) => a.slot.localeCompare(b.slot) || (a.price || 0) - (b.price || 0));
}
export function buyItem(db, s, id, quantity = 1, mode = 'shop') {
  const item = db.item.get(id);
  quantity = clamp(Math.floor(quantity), 1, 99);
  if (!item) return false;
  if (mode === 'relic') {
    const cost = 2;
    if (s.relics < cost * quantity) return false;
    s.relics -= cost * quantity;
  } else {
    const cost = Math.max(1, item.price || 100) * (mode === 'fur' ? 0.5 : 1) * quantity;
    if (s.gil < cost) return false;
    s.gil -= Math.floor(cost);
  }
  s.inventory[id] = (s.inventory[id] || 0) + quantity;
  return true;
}
export function sellItem(db, s, id) {
  const item = db.item.get(id);
  if (!item || !(s.inventory[id] > 0)) return false;
  s.inventory[id]--;
  s.gil += Math.floor((item.price || 100) / 2);
  return true;
}
export function trainJob(db, s, u) {
  if (!u || u.away || u.monster || s.gil < 250) return false;
  s.gil -= 250;
  awardJP(u, u.job, 120);
  advanceDays(db, s, 1);
  return true;
}
export function hire(db, s, name, sex = 'M') {
  if (s.gil < 500 || s.party.length >= 24) return false;
  name = String(name).trim().slice(0, 20) || 'Recruit';
  s.gil -= 500;
  const u = createUnit(db, name, 'Squire', Math.max(1, Math.floor(s.progress * 0.65) + 1), { sex, generic: true });
  s.party.push(u);
  return u;
}
