/* The Considered Hour — previews, combat feedback, and finite tactical medals.
 * Load after combat-content.js; call extendCombatPolish(App) after Hearth.
 * Metrics are transient and bounded. Only declared Boolean medal flags persist.
 */
(() => {
  'use strict';
  const D = globalThis.Dawn, C = D.Content;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const add = (list, value) => { if (!list.includes(value) && list.length < 40) list.push(value); };
  const increment = (object, key, amount = 1) => { object[key] = Math.min(1e9, (object[key] || 0) + amount); };
  const label = name => ({ guard: 'Guard', haste: 'Haste', regen: 'Regeneration', slow: 'Slow', poison: 'Poison', burn: 'Burn' }[name] || name);
  const medal = (trial, id, name, description, hint, rule, rank) => ({
    id, trial, flag: 'medal_' + id, name, description, hint, rule,
    reward: { gold: [35, 45, 60][rank], items: rank === 2 ? { haven_supplies: 1 } : {} }
  });
  C.trialMedals = [
    medal('trial_bell', 'bell_interrupt', 'Between Chimes', 'Interrupt a charged attack while the bell is casting it.', 'Keep a ready action for the CASTING notice. A break during preparation does not count.', 'charge', 0),
    medal('trial_bell', 'bell_window', 'Catch the Echo', 'Land three damaging hits while the bell is broken.', 'After a break, use the other ready travellers before its damage window closes.', 'broken', 1),
    medal('trial_bell', 'bell_care', 'A Quiet Hand', 'Win without using an item or letting a traveller fall.', 'Healing techniques and Defend are allowed. Defend restores MP.', 'care', 2),
    medal('trial_bulwark', 'bulwark_pin', 'Remove the Pin', 'Defeat the Ward Pin before dealing any damage to the wall.', 'Aim single attacks at the pin. A wide move can accidentally damage the protected wall.', 'pin', 0),
    medal('trial_bulwark', 'bulwark_open', 'An Open Door', 'Break the unprotected wall twice.', 'Once the pin is gone, follow the wall’s current weakness and wait through its recovery.', 'wall_breaks', 1),
    medal('trial_bulwark', 'bulwark_guard', 'Safe Foundations', 'Reduce three incoming hits with Guard and finish with no fallen travellers.', 'Iron Oath can protect the party. A guarded hit counts only when an enemy actually attacks.', 'guard', 2),
    medal('trial_mirror', 'mirror_dispel', 'Nothing Borrowed', 'Remove at least two of the reflection’s protections with one dispel.', 'After earning Unwrite, return with Nyx and use it while both Guard and Haste are present.', 'dispel', 0),
    medal('trial_mirror', 'mirror_faces', 'Read Every Face', 'Hit a weakness in each of the reflection’s three phases.', 'Earth or fire, then wind or spark, then void or earth. Different medals may use different parties.', 'mirror_phases', 1),
    medal('trial_mirror', 'mirror_precision', 'No Lost Strokes', 'Win without a resisted hit or a fallen traveller.', 'The live target preview shows resistance. Check again after each phase changes.', 'precision', 2),
    medal('trial_choir', 'choir_breathe', 'Room to Breathe', 'Interrupt the keeper while it is casting a healing song.', 'The keeper starts with a long healing chant. Build pressure, then hold a finishing hit for the cast.', 'healing', 0),
    medal('trial_choir', 'choir_voices', 'Let Them Answer', 'Defeat both voices before the keeper.', 'Spread early damage, then finish the High Voice and Low Voice before the Choir of One.', 'voices', 1),
    medal('trial_choir', 'choir_link', 'A Shared Refrain', 'Hit all three enemies with one damaging link.', 'Rainwheel and other wide links need both partners ready. Use the affected-target preview.', 'wide_link', 2),
    medal('trial_storm', 'storm_ground', 'Ground the Current', 'Dispel the signal’s Haste.', 'Bring Nyx with Unwrite. Wait for Current with No Ground or No End to the Wire.', 'haste', 0),
    medal('trial_storm', 'storm_shelter', 'Hold Fast', 'Guard all three hits of one charged party attack.', 'Protect everyone before a charge lands. Interrupting that charge prevents the guarded hits.', 'charge_guard', 1),
    medal('trial_storm', 'storm_weather', 'Turn the Weather', 'Apply Slow to the signal and interrupt one of its charged casts.', 'Groundwire slows it after Vale’s mastery is learned. Quiet Hour is another source of Slow.', 'slow_charge', 2),
    medal('trial_accord', 'accord_return', 'No Old Walls', 'Interrupt a revival chant and allow no enemy revival during the victory.', 'Defeat the ward, then save pressure for Raise the Old Wall or One Last Wall.', 'revival', 0),
    medal('trial_accord', 'accord_faces', 'A Door for Every Year', 'Hit a weakness in all three of the shelter’s phases.', 'Fire or wind, then water or earth, then fire, wind, or earth. The phase notice marks each change.', 'accord_phases', 1),
    medal('trial_accord', 'accord_links', 'Shelter Together', 'Use two different damaging links during the victory.', 'Choose a party with more than one link. Repeat uses of the same move count only once.', 'links', 2)
  ];
  C.trialMedalFlags = C.trialMedals.map(m => m.flag);

  function freshMetrics() {
    return { partyActions: 0, itemActions: 0, partyKOs: 0, guardedHits: 0,
      weaknessHits: 0, resistedHits: 0, brokenHits: 0, chargeInterrupts: 0,
      healInterrupts: 0, reviveInterrupts: 0, enemyRevives: 0, maxDispelled: 0,
      maxChargeGuards: 0, maxLinkTargets: 0, wardedHits: 0,
      linkSkills: [], defeatOrder: [], slowedEnemies: [],
      weakPhases: {}, damageByEnemy: {}, damageAtFirstDefeat: null,
      unwardedBreaks: {}, dispelled: {}, currentAction: null };
  }
  function feedback(b, text) {
    if (!text) return;
    b.feedback ||= [];
    b.feedback.push({ time: b.time, text });
    if (b.feedback.length > 4) b.feedback.shift();
  }
  function observe(b, e) {
    const m = b.metrics ||= freshMetrics(), actor = b.unit(e.actor), target = b.unit(e.target);
    if (e.type === 'cast') {
      m.currentAction = { actor: e.actor, skill: e.skill, combo: e.combo || 1,
        targets: [...(e.targets || [])].slice(0, 40), guards: 0, damaged: [], charge: !!e.charge };
      if (actor?.team === 'party') { m.partyActions++; if (e.item) m.itemActions++; }
    }
    if (e.type === 'hit' && target?.team === 'enemy') increment(m.damageByEnemy, target.uid, e.amount);
    if (e.type === 'hit' && actor?.team === 'party' && target?.team === 'enemy' && !e.status) {
      if (e.weak) { m.weaknessHits++; add(m.weakPhases[target.uid] ||= [], target.phase); }
      if (e.resist && !e.weak) m.resistedHits++;
      if (e.broken) m.brokenHits++;
      if (e.wardedBy?.length) m.wardedHits++;
      const action = m.currentAction;
      if (action?.actor === e.actor && action.skill === e.skill && action.combo > 1) {
        add(m.linkSkills, e.skill); add(action.damaged, target.uid);
        m.maxLinkTargets = Math.max(m.maxLinkTargets, action.damaged.length);
      }
      const notes = [e.weak ? 'Weakness' : e.resist ? 'Resisted' : '', e.guarded ? 'Guarded' : '', e.wardedBy?.length ? 'Ward' : '', e.broken ? 'Break window' : ''].filter(Boolean);
      if (notes.length) feedback(b, target.name + ' · ' + notes.join(' · ') + ' · −' + e.amount + ' HP');
    }
    if (e.type === 'hit' && actor?.team === 'enemy' && target?.team === 'party' && !e.status && e.guarded) {
      m.guardedHits++;
      const action = m.currentAction;
      if (e.charge && action?.actor === e.actor) { action.guards++; m.maxChargeGuards = Math.max(m.maxChargeGuards, action.guards); }
      feedback(b, target.name + ' guarded · −' + e.amount + ' HP');
    }
    if (e.type === 'death' && target?.team === 'party') m.partyKOs++;
    if (e.type === 'death' && target?.team === 'enemy') {
      if (!m.defeatOrder.length) m.damageAtFirstDefeat = { ...m.damageByEnemy };
      add(m.defeatOrder, target.id);
    }
    if (e.type === 'break' && target?.team === 'enemy') {
      if (!b.wardSources(target).length) increment(m.unwardedBreaks, target.uid);
      if (e.interrupted?.stage === 'casting') {
        if (e.interrupted.charge) m.chargeInterrupts++;
        if (e.interrupted.type === 'heal' && e.interrupted.targets.length) m.healInterrupts++;
        if (e.interrupted.type === 'revive' && e.interrupted.targets.length) m.reviveInterrupts++;
      }
      feedback(b, target.name + ' · ' + (e.interrupted?.stage === 'casting' ? 'Interrupted ' + e.cancelled : 'Off balance'));
    }
    if (e.type === 'heal') {
      if (target?.team === 'enemy' && e.revive) m.enemyRevives++;
      if (target?.team === 'party' && e.amount > 0)
        feedback(b, target.name + (e.revive ? ' returns · ' : ' · +') + e.amount + (e.mp ? ' MP' : ' HP'));
    }
    if (e.type === 'status' && target) {
      if (e.status === 'dispel' && target.team === 'enemy' && actor?.team === 'party') {
        m.maxDispelled = Math.max(m.maxDispelled, e.removed?.length || 0);
        for (const name of e.removed || []) increment(m.dispelled, name);
      }
      if (e.status === 'slow' && actor?.team === 'party' && target.team === 'enemy') add(m.slowedEnemies, target.id);
      if (['cleanse', 'dispel'].includes(e.status) && e.removed?.length)
        feedback(b, target.name + ' · ' + e.removed.map(label).join(', ') + ' removed');
      else if (['guard', 'haste', 'regen', 'slow', 'poison', 'burn'].includes(e.status))
        feedback(b, target.name + ' · ' + label(e.status) + ' · ' + Math.ceil(e.duration) + ' s');
    }
  }
  const enemyUid = (b, id) => b?.enemies.find(e => e.id === id)?.uid;
  function goal(row, b) {
    const m = b?.metrics || freshMetrics(), count = (n, target, word) => ({ met: n >= target, progress: `${Math.min(n, target)} / ${target} ${word}` });
    switch (row.rule) {
      case 'charge': return count(m.chargeInterrupts, 1, 'charged casts interrupted');
      case 'broken': return count(m.brokenHits, 3, 'hits during a break');
      case 'care': return { met: b?.result === 'victory' && m.itemActions === 0 && m.partyKOs === 0, progress: `${m.itemActions} items · ${m.partyKOs} travellers fallen` };
      case 'pin': return { met: m.defeatOrder[0] === 'trial_ward_pin' && !(m.damageAtFirstDefeat?.[enemyUid(b, 'trial_foundry_wall')]), progress: !m.defeatOrder.length ? 'Defeat the pin without touching the wall' : m.defeatOrder[0] === 'trial_ward_pin' && !(m.damageAtFirstDefeat?.[enemyUid(b, 'trial_foundry_wall')]) ? 'Pin removed before wall damage' : 'Try again: the wall was damaged too soon' };
      case 'wall_breaks': return count(m.unwardedBreaks[enemyUid(b, 'trial_foundry_wall')] || 0, 2, 'unprotected wall breaks');
      case 'guard': return { met: m.guardedHits >= 3 && m.partyKOs === 0, progress: `${Math.min(m.guardedHits, 3)} / 3 guarded hits · ${m.partyKOs} travellers fallen` };
      case 'dispel': return count(m.maxDispelled, 2, 'protections removed at once');
      case 'mirror_phases': return count(m.weakPhases[enemyUid(b, 'trial_mirror_self')]?.length || 0, 3, 'phases met with a weakness');
      case 'precision': return { met: b?.result === 'victory' && m.resistedHits === 0 && m.partyKOs === 0, progress: `${m.resistedHits} resisted hits · ${m.partyKOs} travellers fallen` };
      case 'healing': return count(m.healInterrupts, 1, 'healing casts interrupted');
      case 'voices': return { met: m.defeatOrder.slice(0, 2).includes('trial_high_voice') && m.defeatOrder.slice(0, 2).includes('trial_low_voice'), progress: m.defeatOrder.includes('trial_choir_keeper') && !m.defeatOrder.slice(0, 2).every(id => id !== 'trial_choir_keeper') ? 'Try again: the keeper fell before both voices' : `${['trial_high_voice', 'trial_low_voice'].filter(id => m.defeatOrder.includes(id)).length} / 2 voices defeated` };
      case 'wide_link': return count(m.maxLinkTargets, 3, 'enemies hit by one link');
      case 'haste': return count(m.dispelled.haste || 0, 1, 'Haste effects dispelled');
      case 'charge_guard': return count(m.maxChargeGuards, 3, 'guarded hits in one charge');
      case 'slow_charge': return { met: m.slowedEnemies.includes('trial_storm_return') && m.chargeInterrupts >= 1, progress: `${m.slowedEnemies.includes('trial_storm_return') ? 'Slow applied' : 'Apply Slow'} · ${Math.min(m.chargeInterrupts, 1)} / 1 charge interrupted` };
      case 'revival': return { met: m.reviveInterrupts >= 1 && m.enemyRevives === 0, progress: `${Math.min(m.reviveInterrupts, 1)} / 1 revival interrupted · ${m.enemyRevives} revivals allowed` };
      case 'accord_phases': return count(m.weakPhases[enemyUid(b, 'trial_accord_keeper')]?.length || 0, 3, 'phases met with a weakness');
      case 'links': return count(m.linkSkills.length, 2, 'different damaging links');
      default: return { met: false, progress: 'Unknown goal' };
    }
  }
  D.CombatPolish = { observe, freshMetrics, goal };

  D.extendCombatPolish = App => {
    const P = App.prototype;
    if (Object.hasOwn(P, 'combatPolishReady')) return;
    P.combatPolishReady = true;
    const base = { noteVictory: P.noteVictory, chooseItem: P.chooseItem, chooseSkill: P.chooseSkill };
    function selectLegal(app, spec) {
      if (!app.battle || app.battleMenu !== 'target' || !spec) return;
      const legal = app.battle.validTargets(app.selectedActor, spec);
      if (!legal.some(u => u.uid === app.selectedTarget)) app.selectedTarget = legal[0]?.uid || null;
      app.ui.dirty = true;
    }
    P.chooseItem = function (id) { base.chooseItem.call(this, id); selectLegal(this, this.battle?.itemSpec(id, this.state.inventory)); };
    P.chooseSkill = function (id) { base.chooseSkill.call(this, id); selectLegal(this, this.battle?.skills[id]); };
    P.trialMedalProgress = function (trialId, battle = this.battle) {
      const trial = C.eliteTrials.find(t => t.id === trialId);
      const live = trial && battle && (this.encounterId === trial.encounter || battle.trialId === trialId) ? battle : null;
      return C.trialMedals.filter(m => m.trial === trialId).map(m => ({ ...m,
        ...goal(m, live), earned: !!this.state?.flags[m.flag], live: !!live }));
    };
    P.noteVictory = function (encounter, battle) {
      const trial = C.eliteTrials.find(t => t.encounter === encounter.id);
      if (trial && (!battle || battle.result !== 'victory')) return;
      if (trial && battle?.trialMedalReceipt) return;
      base.noteVictory?.call(this, encounter, battle);
      if (!trial || !battle || battle.result !== 'victory' || !battle.metrics) return;
      battle.trialId = trial.id;
      const earned = C.trialMedals.filter(m => m.trial === trial.id && !this.state.flags[m.flag] && goal(m, battle).met);
      battle.trialMedalReceipt = { trial: trial.id, earned: earned.map(m => m.id), gold: 0, items: {} };
      // Flags are set before any reward is transferred. No delayed UI callback
      // owns a claim, and a repeated noteVictory cannot transfer this receipt.
      for (const m of earned) this.state.flags[m.flag] = true;
      for (const m of earned) {
        const gold = Math.max(0, Math.min(m.reward.gold, 1e9 - this.state.gold));
        this.state.gold += gold; battle.trialMedalReceipt.gold += gold;
        for (const [id, n] of Object.entries(m.reward.items)) {
          const amount = Math.max(0, Math.min(n, 1e6 - (this.state.inventory[id] || 0)));
          if (amount) { this.give(id, amount); increment(battle.trialMedalReceipt.items, id, amount); }
        }
      }
      this.trialMedalResult = { trial: trial.id, earned: earned.map(m => m.id), progress: this.trialMedalProgress(trial.id, battle), receipt: battle.trialMedalReceipt };
      if (earned.length) this.toast('Tactical medal' + (earned.length > 1 ? 's' : '') + ' · ' + earned.map(m => m.name).join(' · '), 8);
      this.ui.dirty = true;
    };
  };

  D.combatPolishPanel = (ui, type, arg) => {
    if (!['trials', 'trial-medals'].includes(type)) return null;
    const app = ui.app, button = ui.action.bind(ui), selected = typeof arg === 'string' ? arg : arg?.trial;
    const trials = selected ? C.eliteTrials.filter(t => t.id === selected) : C.eliteTrials;
    let html = '<p>Six familiar trials have eighteen tactical medals. Win the battle after meeting a goal to earn its reward once per journey. Trials still grant their original mastery and first-victory rewards. Replays grant no extra XP or equipment.</p>';
    html += '<p class="footer-note">Medals can be earned on separate attempts with different parties. Each trial matches your level. Wait mode pauses timers inside the move and target lists.</p>';
    for (const trial of trials) {
      const status = app.trialStatus(trial.id), record = app.state.trials[trial.id];
      const goals = app.trialMedalProgress(trial.id), earned = goals.filter(m => m.earned).length;
      const last = app.trialMedalResult?.trial === trial.id ? app.trialMedalResult : null;
      html += `<article class="trial-card"><span class="eyebrow">LEVEL ${trial.minLevel}+ · ${earned} / 3 MEDALS</span><h3>${esc(trial.name)}</h3><p>${esc(trial.rule)}</p><p class="mission-reward">First victory · ${esc(trial.reward)}</p>`;
      if (record) html += `<p>${record.wins} wins · Best ${record.bestSeconds.toFixed(1)} s · ${record.bestTurns} actions</p>`;
      if (last) html += '<p class="battle-feedback">Last result · ' + (last.earned.length ? last.earned.map(id => esc(C.trialMedals.find(m => m.id === id).name)).join(' · ') : 'No new medals. Check the goals below for the next attempt.') + '</p>';
      html += '<div class="medal-list">';
      for (const m of goals) {
        const result = last?.progress.find(p => p.id === m.id);
        const reward = m.reward.gold + ' crowns' + (m.reward.items.haven_supplies ? ' · 1 Haven Supply' : '');
        html += `<section class="medal-card ${m.earned ? 'earned' : ''}"><span class="eyebrow">${m.earned ? 'EARNED' : 'TACTICAL GOAL'}</span><h4>${esc(m.name)}</h4><p>${esc(m.description)}</p><p class="medal-progress">${m.earned ? 'Reward collected' : result ? esc(result.progress) : 'Complete during one victorious attempt'}</p><small>${esc(reward)}</small><details><summary>Tactical hint</summary><p>${esc(m.hint)}</p></details></section>`;
      }
      html += '</div>';
      if (!status.ok) html += '<p class="footer-note">' + esc(status.reason || 'Finish the current battle.') + '</p>';
      html += button(record ? 'Rematch this trial' : 'Begin this trial', () => app.startTrial(trial.id), { disabled: !status.ok, primary: status.ok });
      html += '</article>';
    }
    return { title: 'The Considered Hour', kicker: `${C.trialMedals.filter(m => app.state.flags[m.flag]).length} / 18 TACTICAL MEDALS`, html,
      footer: button('Party and equipment', () => ui.open('party')) + button('Mastery techniques', () => ui.open('mastery')) + button('Journey kit', () => ui.open('camp')) };
  };
})();
