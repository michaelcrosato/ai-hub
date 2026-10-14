/* Cinder Choir: saved formations, item recovery, and optional practice level caps. */
(function (root) {
  'use strict';
  const CC = root.CC, R = CC.RPG;
  if (!R) throw new Error('Load the RPG rules before the journey rules.');
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const slots = ['weapon', 'armor', 'relic', 'echo'];
  const names = { current: 'Current level', matched: 'Matched level' };
  const fail = (reason, extra = {}) => ({ ok: false, reason, reasons: [reason], ...extra });
  const validSlot = slot => Number.isInteger(slot) && slot >= 0 && slot < 3;
  const allowed = state => (state.available || Object.keys(state.roster)).filter(id => own(R.heroes, id) && state.roster[id]);
  const itemName = id => R.equipment[id]?.name || R.echoes[id]?.name || id;
  function validLoadout(value) {
    if (value === null) return true;
    if (!object(value) || typeof value.name !== 'string' || !value.name.trim() || value.name.length > 32 || /[\x00-\x1f\x7f]/.test(value.name)) return false;
    if (!Array.isArray(value.party) || value.party.length < 1 || value.party.length > 4 || new Set(value.party).size !== value.party.length || Array.from(value.party).some(id => typeof id !== 'string' || !own(R.heroes, id))) return false;
    if (!object(value.gear) || Object.keys(value.gear).length !== value.party.length) return false;
    const echoes = [];
    for (const id of value.party) {
      const gear = value.gear[id];
      if (!object(gear) || Object.keys(gear).length !== 4 || slots.some(slot => !own(gear, slot))) return false;
      for (const slot of slots) {
        const item = gear[slot];
        if (item === null) continue;
        if (typeof item !== 'string' || (slot === 'echo' ? !own(R.echoes, item) : !own(R.equipment, item) || R.equipment[item].slot !== slot)) return false;
        if (slot === 'echo') echoes.push(item);
      }
    }
    return new Set(echoes).size === echoes.length;
  }
  function validate(state) {
    if (!object(state)) return false;
    if (state.journey === undefined) return true;
    const data = state.journey;
    return object(data) && data.version === 1 && Array.isArray(data.loadouts) && data.loadouts.length === 3 && [0, 1, 2].every(slot => own(data.loadouts, slot) && validLoadout(data.loadouts[slot]));
  }
  function ensure(state) {
    if (state.journey === undefined) state.journey = { version: 1, loadouts: [null, null, null] };
    return state.journey;
  }
  function saveLoadout(state, slot, name) {
    if (!R.validateSave(state)) return fail('The journey data is invalid.');
    if (!validSlot(slot)) return fail('Choose one of the three formation slots.');
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 32 || /[\x00-\x1f\x7f]/.test(name)) return fail('Use a name with 1 to 32 letters or symbols.');
    const available = allowed(state), missing = state.party.find(id => !available.includes(id));
    if (missing) return fail(R.heroes[missing].name + ' has not returned to the company.');
    const loadout = { name: name.trim(), party: state.party.slice(), gear: {} };
    for (const id of loadout.party) loadout.gear[id] = Object.fromEntries(slots.map(key => [key, state.roster[id][key] || null]));
    ensure(state).loadouts[slot] = loadout;
    return { ok: true, slot, name: loadout.name, loadout: R.copy(loadout), message: loadout.name + ' saved.' };
  }
  function removeLoadout(state, slot) {
    if (!R.validateSave(state) || !validSlot(slot)) return fail('Choose a valid formation slot.');
    ensure(state).loadouts[slot] = null;
    return { ok: true, slot, message: 'Saved formation removed.' };
  }
  function locked(state, options) {
    return options.partyLocked === true || !state.overworld?.active && (CC.DATA?.quests || []).some(quest => quest.finalBranch && quest.place === state.location);
  }
  function snapshotHero(state, next, id) {
    const before = R.getStats(state, id), after = R.getStats(next, id);
    return { id, name: R.heroes[id].name, gear: Object.fromEntries(slots.map(slot => [slot, next.roster[id][slot] || null])), hp: { before: before.hp, after: after.hp, max: after.maxHp }, mp: { before: before.mp, after: after.mp, max: after.maxMp } };
  }
  function signature(state, kind, input) {
    return JSON.stringify({ kind, input, party: state.party, available: state.available || null, teams: state.teams || null, mainParty: state.mainParty || null, location: state.location, world: Boolean(state.overworld?.active), roster: state.roster, echoes: state.echoes, flags: state.flags, bag: state.bag });
  }
  function prepareLoadout(state, slot, options = {}) {
    if (!R.validateSave(state)) return { receipt: fail('The journey data is invalid.') };
    if (!object(options) || own(options, 'partyLocked') && typeof options.partyLocked !== 'boolean') return { receipt: fail('Choose a valid formation context.') };
    if (!validSlot(slot)) return { receipt: fail('Choose one of the three formation slots.') };
    const loadout = state.journey?.loadouts[slot];
    if (!loadout) return { receipt: fail('This formation slot is empty.', { slot }) };
    if (locked(state, options)) return { receipt: fail('Leave the final team path before you restore a formation.', { slot, name: loadout.name }) };
    const available = allowed(state), reasons = [];
    for (const id of loadout.party) {
      if (!state.roster[id]) reasons.push(R.heroes[id].name + ' has not joined the company.');
      else if (!available.includes(id)) reasons.push(R.heroes[id].name + ' has not returned to the company.');
      else if (state.roster[id].hp <= 0) reasons.push('Revive ' + R.heroes[id].name + ' before you restore this formation.');
    }
    if (reasons.length) return { receipt: fail(reasons[0], { slot, name: loadout.name, reasons }) };
    const next = R.copy(state), moves = [], changed = new Set(loadout.party), teamMembers = new Set((state.teams || []).flat());
    const donors = available.filter(id => !loadout.party.includes(id) && !teamMembers.has(id));
    // Release the saved party together. A swap must not require a spare copy.
    for (const id of loadout.party) for (const slot of slots.slice(0, 3)) {
      const item = next.roster[id][slot];
      if (item) next.bag[item] = (next.bag[item] || 0) + 1;
      next.roster[id][slot] = null;
    }
    for (const id of loadout.party) for (const slot of slots) {
      const item = loadout.gear[id][slot];
      if (!item) { next.roster[id][slot] = null; continue; }
      if (slot === 'echo') {
        if (!state.echoes.includes(item)) { reasons.push(itemName(item) + ' has not joined the company.'); continue; }
        const holder = Object.keys(next.roster).find(hero => next.roster[hero].echo === item);
        if (holder && !loadout.party.includes(holder) && !donors.includes(holder)) { reasons.push(itemName(item) + ' is with ' + R.heroes[holder].name + ', who is missing or assigned to another final team.'); continue; }
        if (holder && holder !== id) { next.roster[holder].echo = null; changed.add(holder); moves.push({ id: item, item, name: itemName(item), slot, from: holder, to: id }); }
      } else {
        if (!(next.bag[item] > 0)) {
          const donor = donors.find(hero => next.roster[hero][slot] === item);
          if (donor) { next.roster[donor][slot] = null; changed.add(donor); moves.push({ id: item, item, name: itemName(item), slot, from: donor, to: id }); }
          else {
            const holder = Object.keys(state.roster).find(hero => !loadout.party.includes(hero) && state.roster[hero][slot] === item);
            reasons.push(holder ? 'A copy of ' + itemName(item) + ' is needed. ' + R.heroes[holder].name + ' is using a protected copy.' : 'A copy of ' + itemName(item) + ' is no longer owned.');
            continue;
          }
        } else next.bag[item]--;
      }
      next.roster[id][slot] = item;
    }
    if (reasons.length) return { receipt: fail(reasons[0], { slot, name: loadout.name, reasons }) };
    next.party = loadout.party.slice(); next.mainParty = next.party.slice();
    for (const id of changed) { const stats = R.getStats(next, id); next.roster[id].hp = stats.hp; next.roster[id].mp = stats.mp; }
    if (!R.validateSave(next)) return { receipt: fail('The restored gear would exceed an inventory limit.', { slot, name: loadout.name }) };
    const bagChanges = [...new Set([...Object.keys(state.bag), ...Object.keys(next.bag)])].filter(id => (state.bag[id] || 0) !== (next.bag[id] || 0)).map(id => ({ id, name: itemName(id), before: state.bag[id] || 0, after: next.bag[id] || 0 }));
    const receipt = { ok: true, slot, name: loadout.name, party: next.party.slice(), heroes: [...changed].map(id => snapshotHero(state, next, id)), moves, bagChanges, reasons: [], token: signature(state, 'loadout', { slot, loadout, partyLocked: options.partyLocked === true }) };
    return { next, receipt };
  }
  function loadoutPreview(state, slot, options) { return prepareLoadout(state, slot, options).receipt; }
  function applyLoadout(state, slot, token, options) {
    const { next, receipt } = prepareLoadout(state, slot, options);
    if (!receipt.ok) return receipt;
    if (typeof token !== 'string' || token !== receipt.token) return fail('The company or its gear changed. Review the formation again.');
    state.party = next.party; state.mainParty = next.mainParty; state.roster = next.roster; state.bag = next.bag;
    return { ...receipt, applied: true, message: receipt.name + ' restored.' };
  }
  function prepareRecovery(state, options = {}) {
    if (!R.validateSave(state)) return { receipt: fail('The journey data is invalid.') };
    if (!object(options) || Object.keys(options).some(key => key !== 'mp') || own(options, 'mp') && typeof options.mp !== 'boolean') return { receipt: fail('Choose HP recovery or HP and MP recovery.') };
    const next = R.copy(state), active = state.party.slice(), available = allowed(state), steps = [], wanted = { mp: options.mp === true };
    if (active.some(id => !available.includes(id))) return { receipt: fail('A companion has not returned to the company.') };
    function spend(item, id) {
      const before = R.getStats(next, id), result = R.useItem(next, item, id);
      if (!result.ok) return false;
      const after = R.getStats(next, id);
      steps.push({ item, target: id, name: R.items[item].name, hpBefore: before.hp, hpAfter: after.hp, mpBefore: before.mp, mpAfter: after.mp });
      return true;
    }
    // Revive first. Then give each item to the ally with the lowest HP ratio.
    for (const id of active) if (next.roster[id].hp <= 0 && next.bag.revive > 0) spend('revive', id);
    for (const item of wanted.mp ? ['tonic', 'ether'] : ['tonic']) {
      const key = item === 'tonic' ? 'hp' : 'mp', max = item === 'tonic' ? 'maxHp' : 'maxMp';
      while (next.bag[item] > 0) {
        const candidates = active.map(id => R.getStats(next, id)).filter(hero => hero.hp > 0 && hero[key] < hero[max]).sort((a, b) => a[key] / a[max] - b[key] / b[max] || active.indexOf(a.id) - active.indexOf(b.id));
        if (!candidates.length || !spend(item, candidates[0].id)) break;
      }
    }
    const heroes = active.map(id => snapshotHero(state, next, id));
    const unmet = heroes.flatMap(hero => hero.hp.after === 0 ? [hero.name + ' still needs Revive.'] : [...(hero.hp.after < hero.hp.max ? [hero.name + ' still needs HP.'] : []), ...(wanted.mp && hero.mp.after < hero.mp.max ? [hero.name + ' still needs MP.'] : [])]);
    const costs = ['revive', 'tonic', 'ether'].map(id => ({ id, name: R.items[id].name, count: (state.bag[id] || 0) - (next.bag[id] || 0), owned: state.bag[id] || 0, remaining: next.bag[id] || 0 })).filter(item => item.count > 0);
    const receipt = { ok: true, reason: steps.length ? '' : unmet.length ? 'The bag has no usable recovery items for this company.' : 'The company needs no recovery.', reasons: [], options: wanted, costs, steps, heroes, unmet, complete: unmet.length === 0, canApply: steps.length > 0, token: signature(state, 'recovery', wanted) };
    return { next, receipt };
  }
  function recoveryPreview(state, options) { return prepareRecovery(state, options).receipt; }
  function recover(state, options, token) {
    const { next, receipt } = prepareRecovery(state, options);
    if (!receipt.ok) return receipt;
    if (typeof token !== 'string' || token !== receipt.token) return fail('The company or its supplies changed. Review the recovery plan again.');
    if (!receipt.canApply) return fail(receipt.reason, { complete: receipt.complete });
    // The preview uses the same item resolver as a manual field item.
    state.roster = next.roster; state.bag = next.bag;
    return { ...receipt, applied: true, message: receipt.complete ? 'The company recovered.' : 'Recovery items used. Some companions still need care.' };
  }
  function battleProfile(state, encounter) {
    if (encounter.matchedLevel !== true) return { matchedLevel: false, levelMode: 'current', levelModeLabel: names.current, levelCap: null };
    const expected = CC.Undertide?.trialSpec(encounter.trialId, true);
    if (!expected || encounter.practice !== true || encounter.id !== expected.id || encounter.level !== expected.level || encounter.boss !== expected.boss || encounter.seed !== expected.seed || encounter.final === true || JSON.stringify(encounter.enemies) !== JSON.stringify(expected.enemies)) throw new Error('Matched level requires the exact repeat trial formation.');
    if (!CC.Undertide.trialStatus(state, encounter.trialId).practiceReady) throw new Error('Complete this trial story before matched-level practice.');
    return { matchedLevel: true, levelMode: 'matched', levelModeLabel: names.matched, levelCap: expected.level };
  }
  function battleStats(state, id, profile) {
    const current = R.getStats(state, id);
    if (!profile?.matchedLevel) return current;
    const level = Math.min(current.level, profile.levelCap), roster = { ...state.roster, [id]: { ...state.roster[id], level } }, stats = R.getStats({ ...state, roster }, id);
    stats.hp = current.hp <= 0 ? 0 : Math.max(1, Math.min(stats.maxHp, Math.round(current.hp / current.maxHp * stats.maxHp)));
    stats.mp = Math.min(stats.maxMp, Math.round(current.mp / current.maxMp * stats.maxMp));
    stats.campaignLevel = current.level;
    return stats;
  }
  CC.Journey = { version: '1.0.0', slots: 3, modeNames: names, ensure, validate, saveLoadout, removeLoadout, loadoutPreview, applyLoadout, recoveryPreview, recover, battleProfile, battleStats };
})(globalThis);
