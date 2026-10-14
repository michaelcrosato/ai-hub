/* The Far Reach: deterministic workshop, bonds, and enemy data.
 * Load after rpg.js. No browser, renderer, or storage access is required.
 */
(function (root) {
  'use strict';
  const CC = root.CC = root.CC || {}, R = CC.RPG;
  if (!R) throw new Error('Load rpg.js before frontier-systems.js.');
  if (CC.Frontier) return;
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const record = value => value && typeof value === 'object' && !Array.isArray(value);
  const quantity = value => Number.isInteger(value) && value > 0 && value <= 99;
  const MATERIALS = {
    brass: { name: 'Brass Parts', price: 65, source: 'Magnet Guards, rail work, and spare weapons.', description: 'Clean gears and plates for a strong frame.' },
    glass: { name: 'Tide Glass', price: 75, source: 'Saltglass Mites, Tide Seekers, and old relics.', description: 'Glass that holds a steady reflected note.' },
    thread: { name: 'Storm Thread', price: 70, source: 'Storm Harriers, sail repairs, and spare armor.', description: 'Strong thread taken from grounded storm sails.' },
    sap: { name: 'Root Resin', price: 65, source: 'Root Wardens and the work at Mosswake.', description: 'A living seal that closes under pressure.' },
    frost: { name: 'Frost Salt', price: 80, source: 'Frost Memories and the work at Pale Hearth.', description: 'Cold crystals that keep a circuit stable.' },
    stariron: { name: 'Star Iron', price: 260, source: 'Far Reach bosses, personal bonds, and hunts.', description: 'A rare metal used for the last part of a repair.' }
  };
  Object.entries(MATERIALS).forEach(([id, material]) => { material.id = id; });

  const BONDS = {
    iona: { name: 'A Light Kept', members: ['iona', 'brann'], skill: 'pair_lanternline', description: 'Iona and Brann join a voice and a shield. Strike every foe with sound and give the party Ward.' },
    brann: { name: 'Leave No One', members: ['brann', 'vale'], skill: 'pair_safepassage', description: 'Brann holds a safe path while Vale works. Heal the party and give it Ward and Barrier.' },
    sable: { name: 'A Door Shared', members: ['sable', 'tern'], skill: 'pair_crosswind', description: 'Sable opens a path for Tern. Pierce one foe, delay it, and apply extra Break pressure.' },
    oren: { name: 'Work by Choice', members: ['oren', 'rook'], skill: 'pair_opencircuit', description: 'Oren and Rook close a shared circuit. Strike all foes with lightning and apply extra Break pressure.' },
    mira: { name: 'The Reply', members: ['mira', 'iona'], skill: 'pair_returningsong', description: 'Mira leaves room for Iona to answer. Heal the party, remove harmful effects, and add Regen.' },
    tern: { name: 'Room to Breathe', members: ['tern', 'mira'], skill: 'pair_measuredbreath', description: 'Tern and Mira find a common time. Give the party Haste, Brave, and Focus.' },
    vale: { name: 'Mercy in Shadow', members: ['vale', 'sable'], skill: 'pair_shadowmercy', description: 'Vale and Sable recover what was taken. Strike all foes with dark power and restore party HP.' },
    rook: { name: 'Hands of Our Own', members: ['rook', 'brann'], skill: 'pair_ownhands', description: 'Rook and Brann set down an old order. Pierce one foe and give the party Barrier.' }
  };
  Object.entries(BONDS).forEach(([id, bond]) => Object.assign(bond, { id, hero: id, flag: 'f_bond_' + id }));
  const pairs = {
    pair_lanternline: { name: 'Lantern Line', bond: 'iona', kind: 'magic', target: 'allEnemies', element: 'sound', power: 2.7, partyStatus: 'ward' },
    pair_safepassage: { name: 'Safe Passage', bond: 'brann', kind: 'heal', target: 'allAllies', power: 2.2, status: 'ward', partyStatus: 'barrier' },
    pair_crosswind: { name: 'Crosswind', bond: 'sable', kind: 'physical', target: 'enemy', element: 'wind', power: 3.7, pierce: true, delay: 35, breakPower: 2 },
    pair_opencircuit: { name: 'Open Circuit', bond: 'oren', kind: 'magic', target: 'allEnemies', element: 'lightning', power: 2.8, pierce: true, breakPower: 2 },
    pair_returningsong: { name: 'Returning Song', bond: 'mira', kind: 'heal', target: 'allAllies', power: 2.5, cleanse: true, status: 'regen' },
    pair_measuredbreath: { name: 'Measured Breath', bond: 'tern', kind: 'buff', target: 'allAllies', status: 'haste', extraStatus: 'brave', partyStatus: 'focus' },
    pair_shadowmercy: { name: 'Mercy in Shadow', bond: 'vale', kind: 'magic', target: 'allEnemies', element: 'dark', power: 2.6, partyHeal: 0.2 },
    pair_ownhands: { name: 'Hands of Our Own', bond: 'rook', kind: 'physical', target: 'enemy', power: 4.0, pierce: true, breakPower: 1, partyStatus: 'barrier' }
  };
  Object.entries(pairs).forEach(([id, skill]) => {
    Object.assign(skill, { id, label: skill.name, members: BONDS[skill.bond].members.slice(), cost: 6, chorusCost: 40, duration: 3, description: BONDS[skill.bond].description + ' Both allies need 6 MP. The partner needs 50 ATB. Spend 40 Chorus.' });
    R.skills[id] = skill;
  });
  R.skills.drill.breakPower = 1; R.skills.shieldbash.breakPower = 1;

  const gear = {
    reach_ashsong: { name: 'Ashsong Blade', slot: 'weapon', atk: 42, mag: 20, element: 'sound', description: 'A blade that carries Iona’s own note. Physical strikes use sound.' },
    reach_harborlance: { name: 'Harbor Lance', slot: 'weapon', atk: 38, def: 13, hp: 60, description: 'A rebuilt guard lance. A broad grip leaves one hand free to help.' },
    reach_crossknife: { name: 'Crosswind Knife', slot: 'weapon', atk: 36, spd: 13, element: 'wind', description: 'A light knife made from a free sail ring. Physical strikes use wind.' },
    reach_coildriver: { name: 'Open Coil Driver', slot: 'weapon', atk: 41, mag: 13, breakPower: 1, description: 'A precise tool. Adds one Break pressure to each damaging action.' },
    reach_returnbell: { name: 'Answer Bell', slot: 'weapon', atk: 14, mag: 35, mp: 26, description: 'A bell with two clear tones and room for a reply.' },
    reach_windfists: { name: 'Stillwind Guards', slot: 'weapon', atk: 38, spd: 9, breakPower: 1, description: 'Light guards for a measured strike. Adds one Break pressure.' },
    reach_mercystaff: { name: 'Mercy Staff', slot: 'weapon', atk: 12, mag: 37, hp: 70, mp: 15, description: 'A field staff rebuilt around a steady healing note.' },
    reach_choicecannon: { name: 'Freehand Cannon', slot: 'weapon', atk: 43, mag: 19, element: 'lightning', description: 'Rook chooses where the circuit closes. Physical strikes use lightning.' },
    reach_bulkhead: { name: 'Harbor Plate', slot: 'armor', def: 29, hp: 130, resist: ['water'], description: 'Strong rescue plate. Reduce water damage by 45%.' },
    reach_sailcloth: { name: 'Storm Sail Coat', slot: 'armor', def: 22, spd: 9, hp: 70, resist: ['wind'], description: 'A light storm coat. Reduce wind damage by 45%.' },
    reach_cliniccoat: { name: 'Clinic Weave', slot: 'armor', def: 22, mag: 15, mp: 28, immune: ['poison', 'silence'], description: 'A clean field coat. Prevent Poison and Silence.' },
    reach_glassmantle: { name: 'Frostglass Mantle', slot: 'armor', def: 24, mag: 12, hp: 85, resist: ['ice', 'lightning'], description: 'A stable outer layer. Reduce ice and lightning damage by 45%.' },
    reach_pulsedial: { name: 'Pulse Dial', slot: 'relic', breakPower: 1, spd: 5, description: 'Read a foe’s weak seam. Add one Break pressure to each damaging action.' },
    reach_choruspin: { name: 'Company Pin', slot: 'relic', pairDiscount: 10, mag: 7, hp: 45, description: 'When its wearer leads a pair technique, spend 10 less Chorus.' },
    reach_weatherlocket: { name: 'Weather Locket', slot: 'relic', mag: 11, mp: 15, immune: ['slow', 'blind', 'silence'], description: 'A clear record of the present. Prevent Slow, Blind, and Silence.' },
    reach_rootsign: { name: 'Root Sign', slot: 'relic', def: 9, hp: 85, regen: true, description: 'A living piece of the restored marsh. Restore HP at the start of each turn.' }
  };
  const RECIPES = {};
  const weaponMaterials = { iona: ['glass', 'thread'], brann: ['brass', 'sap'], sable: ['thread', 'glass'], oren: ['brass', 'glass'], mira: ['glass', 'frost'], tern: ['thread', 'sap'], vale: ['sap', 'frost'], rook: ['brass', 'frost'] };
  const weaponIds = Object.keys(gear).slice(0, 8);
  Object.keys(BONDS).forEach((hero, index) => {
    const id = weaponIds[index], [main, second] = weaponMaterials[hero];
    RECIPES[id] = { id, gear: id, costs: { [main]: 4, [second]: 2, stariron: 2 }, gold: 300, requires: ['f_bond_' + hero], unlockText: 'Complete ' + R.heroes[hero].name + '’s Far Reach bond.', description: gear[id].description };
  });
  const extraCosts = {
    reach_bulkhead: { brass: 5, sap: 2, stariron: 2 }, reach_sailcloth: { thread: 5, glass: 2, stariron: 2 },
    reach_cliniccoat: { sap: 4, thread: 3, stariron: 2 }, reach_glassmantle: { frost: 4, glass: 3, stariron: 2 },
    reach_pulsedial: { brass: 3, glass: 3, stariron: 2 }, reach_choruspin: { thread: 3, glass: 3, stariron: 2 },
    reach_weatherlocket: { frost: 3, glass: 3, stariron: 2 }, reach_rootsign: { sap: 5, thread: 1, stariron: 2 }
  };
  Object.entries(extraCosts).forEach(([id, costs]) => { RECIPES[id] = { id, gear: id, costs, gold: 250, requires: ['e_reach_01'], unlockText: 'Complete the first Far Harbor expedition mission.', description: gear[id].description }; });
  Object.entries(gear).forEach(([id, item]) => {
    const recipe = RECIPES[id], main = Object.keys(recipe.costs).find(key => key !== 'stariron');
    R.equipment[id] = { id, ...item, price: 1600, craftOnly: true, salvage: { [main]: 1, stariron: 1 } };
  });

  const enemy = (name, hp, atk, mag, def, spd, weak, moves, color, shape, material, extra = {}) => ({ name, hp, atk, mag, def, spd, weak, moves, color, shape, breakMax: 4, drops: { [material]: 1 }, ...extra });
  const foes = {
    saltglass: enemy('Saltglass Mite', 190, 23, 19, 20, 29, ['earth', 'sound'], ['bite', 'frost', 'darkness'], '#9fd8d2', 'beetle', 'glass', { resist: ['ice'], hint: 'Earth and sound crack the glass. Weakness hits build Break faster.' }),
    galeharrier: enemy('Storm Harrier', 182, 24, 27, 14, 38, ['earth', 'ice'], ['gust', 'rend', 'spark'], '#a5cfe0', 'wing', 'thread', { hint: 'Earth and ice ground its wings. Break cancels the displayed attack.' }),
    rootward: enemy('Root Warden', 230, 27, 22, 20, 24, ['fire', 'wind'], ['poisonbite', 'stone', 'selfmend'], '#90bc7d', 'plant', 'sap', { breakMax: 5, resist: ['earth'], hint: 'Fire and wind open the roots. Remove Poison or wear a Clinic Weave.' }),
    magrail: enemy('Magnet Guard', 244, 29, 24, 26, 23, ['lightning', 'water'], ['gearcrush', 'charge', 'sweep'], '#d0a576', 'machine', 'brass', { breakMax: 5, hint: 'Lightning and water cross its armor. Drill adds extra Break pressure.' }),
    frostmemory: enemy('Frost Memory', 175, 17, 31, 15, 32, ['fire', 'sound'], ['freeze', 'hush', 'echo'], '#b2cee4', 'wisp', 'frost', { resist: ['ice'], hint: 'Fire and sound clear the cold memory. Bring a way to remove Silence.' }),
    tideseeker: enemy('Tide Seeker', 245, 27, 28, 19, 28, ['lightning', 'earth'], ['wave', 'poisonbite', 'rend'], '#6db5b4', 'serpent', 'glass', { breakMax: 5, resist: ['water'], hint: 'Lightning and earth stop its current. Water feeds its defense.' }),
    railjuggernaut: enemy('Rail Juggernaut', 1030, 32, 26, 27, 24, ['lightning', 'water'], ['charge', 'gearcrush', 'sweep', 'spark'], '#c6a575', 'machine', 'brass', { boss: true, breakMax: 8, phaseLabel: 'Live rails', drops: { brass: 3, stariron: 2 }, hint: 'Use lightning or water. Break Gather Power before the crushing blow.', phases: [{ at: .5, name: 'Grounded Rails', weak: ['earth', 'sound'], resist: ['lightning'], moves: ['charge', 'rupture', 'gearcrush', 'stone'], attack: 1.08, hint: 'The rails are grounded. Switch to earth or sound. Defend or Break before Rupture.' }] }),
    icememory: enemy('Winter Witness', 985, 24, 34, 21, 28, ['fire', 'sound'], ['freeze', 'hush', 'echo', 'selfmend'], '#bdd9eb', 'crystal', 'frost', { boss: true, breakMax: 7, resist: ['ice'], phaseLabel: 'Ice shell', drops: { frost: 3, stariron: 2 }, hint: 'Use fire or sound. Keep a Remedy ready for Silence.', phases: [{ at: .5, name: 'The Face Below', weak: ['light', 'lightning'], resist: ['ice', 'dark'], moves: ['charge', 'meteor', 'hush', 'echo'], magic: 1.08, hint: 'The shell is gone. Use light or lightning. Barrier reduces the falling stars.' }] }),
    stormmanta: enemy('Storm Manta', 1010, 29, 32, 20, 36, ['earth', 'ice'], ['gust', 'spark', 'charge', 'sweep'], '#a5c9de', 'wing', 'thread', { boss: true, breakMax: 8, phaseLabel: 'Open sails', drops: { thread: 3, stariron: 2 }, hint: 'Earth and ice catch the open sails. Watch its speed.', phases: [{ at: .5, name: 'Folded Sails', weak: ['fire', 'sound'], resist: ['wind'], moves: ['charge', 'rend', 'shriek', 'rupture'], speed: 3, hint: 'The sails have folded. Use fire or sound. Ward stops Rend; Barrier reduces Rupture.' }] }),
    tidemirror: enemy('Tidal Mirror', 1070, 25, 35, 24, 29, ['lightning', 'earth'], ['wave', 'frost', 'darkness', 'echo'], '#87c7cf', 'crystal', 'glass', { boss: true, breakMax: 8, resist: ['water'], phaseLabel: 'Bright tide', drops: { glass: 3, stariron: 2 }, hint: 'Use lightning or earth. Water meets a strong resistance.', phases: [{ at: .5, name: 'Inverted Tide', weak: ['dark', 'sound'], resist: ['light', 'water'], moves: ['hush', 'shade', 'charge', 'rupture'], magic: 1.08, hint: 'The reflection has turned. Switch to dark or sound. Remove Silence before the next spell.' }] }),
    rootcolony: enemy('Root Colony', 1120, 29, 29, 25, 24, ['fire', 'wind'], ['poisonbite', 'stone', 'selfmend', 'sweep'], '#8eb783', 'plant', 'sap', { boss: true, breakMax: 8, resist: ['earth'], phaseLabel: 'Open roots', drops: { sap: 3, stariron: 2 }, hint: 'Fire and wind open its outer roots. Bring poison protection.', phases: [{ at: .5, name: 'Closed Crown', weak: ['ice', 'light'], resist: ['earth', 'fire'], moves: ['charge', 'venom', 'sweep', 'selfmend'], attack: 1.1, hint: 'The roots have closed. Use ice or light. Break Rebuild to stop its repair.' }] }),
    weathercore: enemy('Weather Engine', 1270, 33, 37, 26, 29, ['lightning', 'sound'], ['spark', 'hush', 'charge', 'meteor'], '#d9bdac', 'star', 'brass', { boss: true, breakMax: 9, phaseLabel: 'Sky circuit', drops: { brass: 3, stariron: 3 }, hint: 'Lightning and sound disturb the forecast. Break or Defend before Starfall.', phases: [{ at: .5, name: 'The Present Sky', weak: ['earth', 'water'], resist: ['lightning', 'light'], moves: ['charge', 'rupture', 'wave', 'gearcrush'], attack: 1.08, magic: 1.08, hint: 'The sky circuit is off. Use earth or water. Barrier protects against Rupture; Ward stops Gear Crush.' }] })
  };
  Object.entries(foes).forEach(([id, foe]) => { R.enemies[id] = { id, ...foe, resist: foe.resist || [], steal: foe.boss ? 'ether' : ['machine', 'crystal'].includes(foe.shape) ? 'ether' : 'tonic' }; });

  function ensure(state) {
    if (!state.frontier) state.frontier = { version: 1, materials: {}, crafted: {}, bonds: {}, claimed: {} };
    const f = state.frontier;
    for (const key of ['materials', 'crafted', 'bonds', 'claimed']) if (!f[key]) f[key] = {};
    for (const id of Object.keys(MATERIALS)) if (!own(f.materials, id)) f.materials[id] = 0;
    for (const bond of Object.values(BONDS)) if (state.flags && state.flags[bond.flag]) f.bonds[bond.id] = true;
    return f;
  }
  function validate(state) {
    if (state.frontier === undefined) return true;
    const f = state.frontier;
    if (!record(f) || f.version !== 1 || !['materials', 'crafted', 'bonds', 'claimed'].every(key => record(f[key]))) return false;
    if (!Object.entries(f.materials).every(([id, n]) => own(MATERIALS, id) && Number.isInteger(n) && n >= 0 && n <= 999999)) return false;
    if (!Object.entries(f.crafted).every(([id, n]) => own(RECIPES, id) && Number.isInteger(n) && n >= 0 && n <= 999)) return false;
    if (!Object.entries(f.bonds).every(([id, value]) => own(BONDS, id) && value === true)) return false;
    if (Object.keys(f.claimed).length > 1000 || !Object.entries(f.claimed).every(([id, value]) => /^[a-z][a-z0-9_]{1,80}$/.test(id) && value === true)) return false;
    return true;
  }
  function bondIds(state) { return Object.values(BONDS).filter(bond => state.frontier?.bonds?.[bond.id] || state.flags?.[bond.flag]).map(bond => bond.id); }
  function workshopUnlocked(state) { return Boolean(state.flags?.e_reach_01); }
  function grantMaterials(state, amounts) {
    if (!record(amounts) || !Object.entries(amounts).every(([id, n]) => own(MATERIALS, id) && Number.isInteger(n) && n >= 0 && n <= 999999)) return { ok: false, reason: 'The material reward is invalid.' };
    const f = ensure(state);
    if (Object.entries(amounts).some(([id, n]) => f.materials[id] + n > 999999)) return { ok: false, reason: 'The material store is full.' };
    for (const [id, n] of Object.entries(amounts)) f.materials[id] += n;
    return { ok: true, materials: { ...amounts } };
  }
  function recipeStatus(state, id) {
    if (!own(RECIPES, id)) return { ok: false, unlocked: false, canCraft: false, reasons: ['This recipe is unknown.'], reason: 'This recipe is unknown.' };
    const recipe = RECIPES[id], f = state.frontier, unlocked = recipe.requires.every(flag => Boolean(state.flags?.[flag]));
    const materials = Object.entries(recipe.costs).map(([material, need]) => { const have = f?.materials?.[material] || 0; return { id: material, name: MATERIALS[material].name, have, need, missing: Math.max(0, need - have) }; });
    const reasons = [];
    if (!unlocked) reasons.push(recipe.unlockText);
    if (state.gold < recipe.gold) reasons.push('Need ' + recipe.gold + ' gold.');
    materials.filter(material => material.missing).forEach(material => reasons.push('Need ' + material.missing + ' more ' + material.name + '.'));
    if ((f?.crafted?.[id] || 0) >= 999 || (state.bag[recipe.gear] || 0) >= 999999) reasons.push('The equipment store is full.');
    return { ...recipe, ok: true, unlocked, canCraft: reasons.length === 0, reasons, reason: reasons[0] || '', materials, equipment: R.equipment[recipe.gear], made: f?.crafted?.[id] || 0 };
  }
  function craft(state, id) {
    const status = recipeStatus(state, id);
    if (!status.canCraft) return { ok: false, reason: status.reason };
    const f = ensure(state);
    for (const [material, n] of Object.entries(status.costs)) f.materials[material] -= n;
    state.gold -= status.gold; state.bag[status.gear] = (state.bag[status.gear] || 0) + 1; f.crafted[id] = (f.crafted[id] || 0) + 1;
    return { ok: true, recipe: id, gear: status.gear, count: 1, materials: { ...status.costs }, gold: status.gold };
  }
  function buyMaterial(state, id, count = 1) {
    if (!own(MATERIALS, id) || !quantity(count)) return { ok: false, reason: 'Choose a known material and a whole quantity from 1 to 99.' };
    if (!workshopUnlocked(state)) return { ok: false, reason: 'Open the Far Harbor workshop first.' };
    const price = MATERIALS[id].price * count;
    if (state.gold < price) return { ok: false, reason: 'Need ' + price + ' gold.' };
    const result = grantMaterials(state, { [id]: count });
    if (!result.ok) return result;
    state.gold -= price;
    return { ok: true, material: id, count, gold: price, materials: { [id]: count } };
  }
  function salvageYield(state, id, count = 1) {
    if (!own(R.equipment, id) || !quantity(count)) return { ok: false, reason: 'Choose equipment and a whole quantity from 1 to 99.' };
    if (!workshopUnlocked(state)) return { ok: false, reason: 'Open the Far Harbor workshop first.' };
    if ((state.bag[id] || 0) < count) return { ok: false, reason: 'Only unequipped items in the bag can be taken apart.' };
    const item = R.equipment[id], one = item.salvage || { [item.slot === 'weapon' ? 'brass' : item.slot === 'armor' ? 'thread' : 'glass']: 1 };
    return { ok: true, gear: id, count, materials: Object.fromEntries(Object.entries(one).map(([key, n]) => [key, n * count])) };
  }
  function salvage(state, id, count = 1) {
    const preview = salvageYield(state, id, count);
    if (!preview.ok) return preview;
    const award = grantMaterials(state, preview.materials);
    if (!award.ok) return award;
    state.bag[id] -= count;
    return { ...preview, awarded: { ...preview.materials } };
  }
  function onMissionComplete(state, task) {
    if (!task || !/^[a-z][a-z0-9_]{1,80}$/.test(task.id)) return { ok: false, reason: 'The mission reward is invalid.' };
    const reward = task.reward || {}, f = ensure(state);
    if (f.claimed[task.id]) return { ok: true, alreadyClaimed: true, materials: {} };
    if (reward.bond && !own(BONDS, reward.bond)) return { ok: false, reason: 'The companion bond is unknown.' };
    const result = grantMaterials(state, reward.materials || {});
    if (!result.ok) return result;
    if (reward.bond) f.bonds[reward.bond] = true;
    f.claimed[task.id] = true;
    const messages = [];
    const entries = Object.entries(result.materials).filter(([, count]) => count > 0);
    if (entries.length) messages.push('Materials received: ' + entries.map(([id, count]) => count + ' ' + MATERIALS[id].name).join(', ') + '.');
    if (reward.bond) messages.push(R.heroes[reward.bond].name + '’s bond is complete. ' + R.skills[BONDS[reward.bond].skill].name + ' is now available.');
    return { ok: true, materials: result.materials, bond: reward.bond || null, message: messages.join(' ') };
  }
  function onBattleSettled(state, battle, rewards) {
    const drops = {};
    for (const unit of battle.enemies) if (!unit.alive) for (const [id, n] of Object.entries(R.enemies[unit.baseId].drops || {})) drops[id] = (drops[id] || 0) + n;
    const result = grantMaterials(state, drops);
    rewards.materials = result.ok ? Object.entries(drops).map(([id, count]) => ({ id, count })) : [];
  }
  CC.Frontier = { version: '1.0.0', materials: MATERIALS, recipes: RECIPES, bonds: BONDS, enemyIds: Object.keys(foes), gearIds: Object.keys(gear), ensure, validate, bondIds, workshopUnlocked, grantMaterials, recipeStatus, craft, buyMaterial, salvageYield, salvage, onMissionComplete, onBattleSettled };
})(globalThis);
