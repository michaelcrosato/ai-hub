/* Threads of the Last Dawn — deterministic, renderer-independent ATB combat.
 * Engine adapter: call Battle.update(dt) from My3D2dge.Game.start({update}).
 * The model owns copies of supplied combatants. Commit party HP/MP after battle.
 * Skill power is a multiplier. Status durations are in seconds of combat time.
 * wait:true freezes combat time while a command or target menu is open.
 */
(() => {
  'use strict';
  const Dawn = globalThis.Dawn = globalThis.Dawn || {};
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const num = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
  const living = unit => unit && unit.hp > 0;
  const BAD_STATUS = new Set(['poison', 'burn', 'slow']);
  const FRIEND_TARGETS = new Set(['self', 'ally', 'allAllies']);
  const TARGET_ALIASES = {
    single: 'enemy', singleEnemy: 'enemy', all: 'allEnemies',
    enemies: 'allEnemies', allies: 'allAllies', singleAlly: 'ally'
  };
  const BASIC = Object.freeze({ id: 'attack', name: 'Attack', cost: 0, power: 1,
    type: 'physical', target: 'enemy', element: 'physical' });
  const ITEMS = Object.freeze({
    tonic: { name: 'Tonic', type: 'heal', amount: 80, target: 'ally' },
    ether: { name: 'Ether', type: 'mp', amount: 30, target: 'ally' },
    phoenix: { name: 'Phoenix Seed', type: 'revive', power: 0.5, target: 'ally' },
    panacea: { name: 'Panacea', type: 'cleanse', target: 'ally' },
    elixir: { name: 'Elixir', type: 'restore', target: 'ally' }
  });

  function normalizeUnit(source, team, i, count, difficulty) {
    const unit = { ...source };
    unit.id = String(source.id || `${team}${i + 1}`);
    unit.uid = String(source.uid || (team === 'party' ? unit.id : `${unit.id}:${i}`));
    unit.team = team;
    unit.name = source.name || unit.id;
    unit.maxHp = Math.max(1, Math.round(num(source.maxHp, num(source.hp, 100))));
    unit.maxMp = Math.max(0, Math.round(num(source.maxMp, num(source.mp, 0))));
    unit.atk = Math.max(1, num(source.atk, 12));
    unit.mag = Math.max(1, num(source.mag, unit.atk));
    unit.def = Math.max(0, num(source.def, 6));
    unit.speed = Math.max(1, num(source.speed, 10));
    if (team === 'enemy') {
      const modifier = difficulty === 'story' ? 0.7 : difficulty === 'hard' ? 1.16 : 1;
      unit.maxHp = Math.round(unit.maxHp * (difficulty === 'story' ? 0.8 : difficulty === 'hard' ? 1.12 : 1));
      unit.atk *= modifier;
      unit.mag *= modifier;
    }
    unit.hp = clamp(Math.round(num(source.hp, unit.maxHp)), 0, unit.maxHp);
    unit.mp = clamp(Math.round(num(source.mp, unit.maxMp)), 0, unit.maxMp);
    unit.atb = living(unit) ? (team === 'party' ? 100 : clamp(num(source.atb, i * 8), 0, 100)) : 0;
    unit.status = { ...(source.status || {}) };
    unit.statusPower = {};
    unit.defending = false;
    unit.dotClock = 0;
    unit.skills = [...(source.skills || [])];
    unit.weak = [...(source.weak || [])];
    unit.resist = [...(source.resist || [])];
    unit.x = num(source.x, team === 'party' ? 0 : 100 + (i % 2) * 35);
    unit.y = num(source.y, (i - (count - 1) / 2) * 44);
    unit.pattern = [...(source.pattern || [])];
    unit.patternStep = 0;
    unit.phase = 0;
    unit.phaseName = '';
    unit.baseStats = { atk: unit.atk, mag: unit.mag, def: unit.def, speed: unit.speed };
    unit.intent = null;
    // Stagger is opt-in. Legacy enemies neither gain pressure nor draw extra RNG.
    unit.staggerMax = team === 'enemy' ? Math.max(0, num(source.staggerMax)) : 0;
    unit.stagger = 0;
    unit.staggerDuration = Math.max(0.35, num(source.staggerDuration, 3.5));
    unit.staggerRecovery = Math.max(0, num(source.staggerRecovery, 2));
    unit.breakRemaining = 0;
    unit.staggerCooldown = 0;
    return unit;
  }

  class Battle {
    constructor({ party = [], enemies = [], skills = {}, bond = 0,
      difficulty = 'standard', seed = 1, onEvent = null, items = {} } = {}) {
      this.skills = { attack: BASIC, ...skills };
      this.items = { ...ITEMS, ...items };
      this.difficulty = ['story', 'standard', 'hard'].includes(difficulty) ? difficulty : 'standard';
      this.party = party.map((u, i) => normalizeUnit(u, 'party', i, party.length, this.difficulty));
      this.enemies = enemies.map((u, i) => normalizeUnit(u, 'enemy', i, enemies.length, this.difficulty));
      this.bond = clamp(num(bond), 0, 100);
      this.seed = num(seed, 1) >>> 0;
      this.time = 0;
      this.turn = 0;
      this.result = null;
      this.log = [];
      this.events = [];
      this.onEvent = typeof onEvent === 'function' ? onEvent : null;
      this.fleeAttempts = 0;
      this.reward = null;
      this.checkResult();
      if (!this.result) {
        this.record('The threads converge. Choose your first action.');
        for (const enemy of this.enemies) if (living(enemy)) this.prepareIntent(enemy);
      }
    }

    random() {
      this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
      return this.seed / 4294967296;
    }

    unit(id) {
      if (id && typeof id === 'object') id = id.uid || id.id;
      return [...this.party, ...this.enemies].find(u => u.uid === id) ||
        [...this.party, ...this.enemies].find(u => u.id === id) || null;
    }

    record(message) {
      this.log.push(message);
      if (this.log.length > 12) this.log.shift();
    }

    emit(type, data = {}) {
      const event = { type, time: this.time, ...data };
      this.events.push(event);
      if (this.events.length > 80) this.events.shift();
      Dawn.CombatPolish?.observe(this, event);
      if (this.onEvent) this.onEvent(event);
      return event;
    }

    skill(value) {
      if (typeof value === 'string') {
        const spec = this.skills[value];
        return spec ? { ...spec, id: value } : null;
      }
      return value ? { ...value, id: value.id || 'enemy-action' } : null;
    }

    participants(actor, spec, partnerIds = []) {
      if (!actor || !spec) return [];
      const ids = spec.combo || spec.partners;
      if (ids && ids.length) {
        if (!ids.includes(actor.id) && !ids.includes(actor.uid)) return [];
        return ids.map(id => this.party.find(u => u.id === id || u.uid === id)).filter(Boolean);
      }
      // Explicit partners only apply to authored cooperative abilities.
      return [actor];
    }

    costs(spec, members) {
      return Object.fromEntries(members.map(u => [u.uid,
        Math.max(0, num(spec.costs?.[u.id], num(spec.costs?.[u.uid], num(spec.cost))))]));
    }

    canAct(actorId, skillId, partnerIds = []) {
      const actor = this.unit(actorId);
      const spec = this.skill(skillId);
      const fail = reason => ({ ok: false, reason, actor, spec, members: [], costs: {} });
      if (this.result) return fail('This battle has ended.');
      if (!actor || actor.team !== 'party') return fail('Choose a party member.');
      if (!living(actor)) return fail(`${actor.name} is down.`);
      if (!spec) return fail('This skill is unknown.');
      const isCombo = (spec.combo || spec.partners || []).length > 1;
      if (!isCombo && spec.id !== 'attack' && !actor.skills.includes(spec.id)) return fail(`${actor.name} has not learned this skill.`);
      const members = this.participants(actor, spec, partnerIds);
      if (!members.length || (isCombo && members.length !== (spec.combo || spec.partners).length)) return fail('The required partners are not in the party.');
      if (partnerIds.length && partnerIds.some(id => !members.some(u => u.id === id || u.uid === id))) return fail('These partners cannot use this skill.');
      const costs = this.costs(spec, members);
      for (const member of members) {
        if (!living(member)) return fail(`${member.name} is down.`);
        if (member.atb < 99.999) return fail(`${member.name} is not ready.`);
        if (member.mp < costs[member.uid]) return fail(`${member.name} needs ${costs[member.uid]} MP.`);
      }
      const bondCost = Math.max(0, num(spec.bondCost, members.length >= 3 ? 100 : 0));
      if (this.bond < bondCost) return fail(`This skill needs ${bondCost} bond.`);
      return { ok: true, reason: '', actor, spec, members, costs, bondCost };
    }

    available(actorId) {
      const actor = this.unit(actorId);
      if (!actor || actor.team !== 'party') return [];
      const ids = new Set(['attack', ...actor.skills]);
      for (const [id, spec] of Object.entries(this.skills)) {
        const combo = spec.combo || spec.partners;
        if (combo?.includes(actor.id) && combo.every(id => this.party.some(u => u.id === id))) ids.add(id);
      }
      return [...ids].filter(id => this.skills[id]).map(id => {
        const check = this.canAct(actor.uid, id);
        const spec = this.skill(id);
        const members = this.participants(actor, spec);
        return { ...spec, canUse: check.ok, reason: check.reason,
          costs: this.costs(spec, members), participants: members.map(u => u.uid) };
      });
    }

    resolveTargets(actorId, skillValue, targetId) {
      const actor = this.unit(actorId);
      const spec = this.skill(skillValue);
      if (!actor || !spec) return [];
      const type = TARGET_ALIASES[spec.target] || spec.target || 'enemy';
      const friends = actor.team === 'party' ? this.party : this.enemies;
      const foes = actor.team === 'party' ? this.enemies : this.party;
      const pool = FRIEND_TARGETS.has(type) ? friends : foes;
      const valid = u => spec.type === 'revive' ? u.hp <= 0 : living(u);
      const candidates = pool.filter(valid);
      if (type === 'self') return valid(actor) ? [actor] : [];
      if (type === 'allEnemies' || type === 'allAllies') return candidates;
      let target = targetId ? this.unit(targetId) : candidates[0];
      if (!target || !candidates.includes(target)) return [];
      if (type === 'circle') {
        const radius = Math.max(0, num(spec.radius, 62));
        return candidates.filter(u => Math.hypot(u.x - target.x, u.y - target.y) <= radius);
      }
      if (type === 'line') {
        const dx = target.x - actor.x, dy = target.y - actor.y;
        const length = Math.hypot(dx, dy) || 1;
        const width = Math.max(0, num(spec.width, 20));
        return candidates.filter(u => {
          const ux = u.x - actor.x, uy = u.y - actor.y;
          const forward = (ux * dx + uy * dy) / length;
          const distance = Math.abs(ux * dy - uy * dx) / length;
          return u === target || (forward >= 0 && distance <= width);
        });
      }
      return [target];
    }

    // UI queries use the same target rules as execution. These helpers never
    // consume a gauge, supply, random number, or combat event.
    itemSpec(itemId, inventory) {
      const spec = inventory?.__items?.[itemId] || this.items[itemId];
      if (!spec) return null;
      const item = { ...spec, ...(spec.effect || {}), id: itemId,
        target: spec.target || spec.effect?.target || 'ally' };
      if (item.type === 'elixir') item.type = 'restore';
      if (item.type === 'revive') item.power = num(item.power, num(item.amount, 0.5));
      return item;
    }

    validTargets(actorId, skillValue) {
      const actor = this.unit(actorId), spec = this.skill(skillValue);
      if (!actor || !spec) return [];
      const type = TARGET_ALIASES[spec.target] || spec.target || 'enemy';
      const friends = actor.team === 'party' ? this.party : this.enemies;
      const foes = actor.team === 'party' ? this.enemies : this.party;
      const pool = type === 'self' ? [actor] : FRIEND_TARGETS.has(type) ? friends : foes;
      return pool.filter(unit => (spec.type === 'revive' ? !living(unit) : living(unit)) &&
        this.resolveTargets(actor, spec, unit.uid).length > 0);
    }

    canUseItem(actorId, itemId, targetId, inventory) {
      const actor = this.unit(actorId), spec = this.itemSpec(itemId, inventory);
      const fail = reason => ({ ok: false, reason, actor, spec, targets: [] });
      if (this.result) return fail('This battle has ended.');
      if (!actor || actor.team !== 'party' || !living(actor)) return fail('Choose a living party member.');
      if (actor.atb < 99.999) return fail(`${actor.name} is not ready.`);
      if (!spec || !inventory || num(inventory[itemId]) < 1) return fail('That item is not available.');
      if (!['heal', 'mp', 'revive', 'cleanse', 'restore', 'support'].includes(spec.type))
        return fail('This item cannot be used in battle.');
      const targets = this.resolveTargets(actor, spec, targetId);
      if (!targets.length) return fail(spec.type === 'revive' ? 'Choose a fallen ally.' : 'Choose a valid ally.');
      return { ok: true, reason: '', actor, spec, targets };
    }

    previewAction(actorId, { skillId, itemId, targetId, inventory } = {}) {
      const actor = this.unit(actorId);
      const check = itemId ? this.canUseItem(actorId, itemId, targetId, inventory) :
        this.canAct(actorId, skillId || 'attack');
      const spec = check.spec;
      if (!actor || !spec) return { ok: false, reason: check.reason, legalTargets: [],
        targets: [], effects: [], costs: {}, participants: [], bondCost: 0 };
      const members = itemId ? [actor] : this.participants(actor, spec);
      const legalTargets = this.validTargets(actor, spec).map(u => u.uid);
      const targets = this.resolveTargets(actor, spec, targetId);
      const harmful = !['heal', 'mp', 'revive', 'restore', 'support', 'cleanse'].includes(spec.type);
      const element = spec.element || (spec.type === 'magic' ? 'spark' : 'physical');
      const nice = name => name.charAt(0).toUpperCase() + name.slice(1);
      const effects = targets.map(target => {
        const lines = [], removed = spec.dispel ? ['guard', 'haste', 'regen'].filter(k => target.status[k] > 0) : [];
        if (removed.length) lines.push('Removes ' + removed.map(nice).join(', ') + ' before the effect');
        if (harmful) {
          lines.push(nice(element) + ' damage');
          if (target.weak.includes(element)) lines.push('Weakness: increased damage');
          else if (target.resist.includes(element)) lines.push('Resistance: reduced damage');
          if (target.status.guard > 0 && !spec.dispel) lines.push('Guard reduces damage');
          const wards = this.wardSources(target);
          if (wards.length) lines.push('Ward: ' + wards.map(u => u.name).join(', '));
          if (target.breakRemaining > 0) lines.push('Broken: increased damage');
          if (target.staggerMax && !target.breakRemaining) lines.push(target.staggerCooldown > 0 ?
            'Pressure blocked while balance recovers' : 'Builds pressure');
        } else if (spec.type === 'revive') lines.push('Revives a fallen ally');
        else if (spec.type === 'restore') lines.push('Restores all HP and MP');
        else if (spec.type === 'heal') lines.push(target.hp === target.maxHp ? 'HP already full' : 'Restores HP');
        else if (spec.type === 'mp') lines.push(target.mp === target.maxMp ? 'MP already full' : 'Restores MP');
        if (spec.cleanse || spec.type === 'cleanse' || spec.type === 'restore') {
          const bad = [...BAD_STATUS].filter(k => target.status[k] > 0);
          lines.push(bad.length ? 'Clears ' + bad.map(nice).join(', ') : 'No harmful status to clear');
        }
        if (spec.dispel && !removed.length) lines.push('No protection to dispel');
        for (const [name, value] of Object.entries(spec.status || {})) {
          if (!['guard', 'haste', 'slow', 'poison', 'burn', 'regen'].includes(name)) continue;
          const detail = typeof value === 'object' ? value : { duration: value };
          const chance = clamp(num(detail.chance, 1), 0, 1);
          if (chance === 0) continue;
          lines.push((chance < 1 ? 'May apply ' : 'Applies ') + nice(name) +
            ' · ' + Math.max(0, num(detail.duration, num(detail.time, 8))) + ' s');
        }
        return { uid: target.uid, name: target.name, lines };
      });
      return { ok: check.ok && targets.length > 0,
        reason: check.reason || (!targets.length ? (spec.type === 'revive' ? 'Choose a fallen ally.' : 'Choose a valid target.') : ''),
        id: spec.id, name: spec.name, type: spec.type,
        targetType: TARGET_ALIASES[spec.target] || spec.target || 'enemy',
        legalTargets, targets: targets.map(u => u.uid), effects,
        costs: itemId ? {} : this.costs(spec, members), participants: members.map(u => u.uid),
        bondCost: itemId ? 0 : Math.max(0, num(spec.bondCost, members.length >= 3 ? 100 : 0)) };
    }

    act(actorId, skillId, targetId, partnerIds = []) {
      const check = this.canAct(actorId, skillId, partnerIds);
      if (!check.ok) return { ok: false, reason: check.reason };
      const { actor, spec, members, costs, bondCost } = check;
      const targets = this.resolveTargets(actor.uid, spec, targetId);
      if (!targets.length) return { ok: false, reason: spec.type === 'revive' ? 'Choose a fallen ally.' : 'Choose a valid target.' };
      // Validate every cost and target before changing any state.
      for (const member of members) {
        member.atb = 0;
        member.mp -= costs[member.uid];
        if (member.defending) { delete member.status.guard; member.defending = false; }
      }
      this.bond -= bondCost;
      this.turn++;
      this.record(`${members.map(u => u.name).join(' + ')}: ${spec.name || spec.id}.`);
      this.emit('cast', { actor: actor.uid, actors: members.map(u => u.uid),
        targets: targets.map(u => u.uid), skill: spec.id, name: spec.name,
        element: spec.element || 'physical', combo: members.length });
      this.applySkill(actor, spec, targets, members);
      if (!bondCost) this.bond = clamp(this.bond + (members.length > 1 ? 16 : 7), 0, 100);
      this.checkResult();
      return { ok: true, reason: '', targets: targets.map(u => u.uid) };
    }

    applySkill(actor, spec, targets, members = [actor]) {
      const type = spec.type || 'physical';
      const power = Math.max(0, num(spec.power, 1));
      const groupScale = members.length > 1 ? members.length * 0.9 : 1;
      const stat = key => members.reduce((total, u) => total + u[key], 0) / members.length;
      for (const target of targets) {
        if (type !== 'revive' && !living(target)) continue;
        if (spec.dispel && living(target)) this.dispel(target, actor);
        if (type === 'revive') {
          if (living(target)) continue;
          target.hp = clamp(Math.round(target.maxHp * (power || 0.5)), 1, target.maxHp);
          target.atb = 35;
          target.status = {};
          target.stagger = 0;
          target.breakRemaining = 0;
          target.staggerCooldown = 0;
          this.emit('heal', { actor: actor.uid, target: target.uid, amount: target.hp, skill: spec.id, revive: true });
          this.record(`${target.name} returns to the fight.`);
        } else if (type === 'heal') {
          const amount = num(spec.amount, Math.round((stat('mag') * 2 * power + 12) * groupScale));
          this.heal(actor, target, amount, spec.id);
        } else if (type === 'mp') {
          const amount = Math.min(target.maxMp - target.mp, Math.round(num(spec.amount, 25)));
          target.mp += amount;
          this.emit('heal', { actor: actor.uid, target: target.uid, amount, mp: true, skill: spec.id });
        } else if (type !== 'support' && type !== 'cleanse') {
          const magical = type === 'magic';
          const offence = stat(magical ? 'mag' : 'atk');
          const defence = target.def * (magical ? 0.42 : 0.7);
          const element = spec.element || (magical ? 'spark' : 'physical');
          const weak = target.weak.includes(element);
          const resist = target.resist.includes(element);
          const elementScale = weak ? 1.5 : resist ? 0.55 : 1;
          const guardScale = target.status.guard > 0 ? 0.42 : 1;
          const casting = target.intent?.stage === 'casting';
          const roll = 0.94 + this.random() * 0.12;
          const damage = Math.max(1, Math.round((offence * 2 * power * groupScale - defence) * elementScale * guardScale * roll));
          this.damage(actor, target, damage, { skill: spec.id, element, weak, resist,
            guarded: guardScale < 1, combo: members.length, charge: Boolean(spec.charge) });
          // One pressure award per target, not one per cooperating participant.
          const pressure = (Math.max(0, num(spec.stagger, magical ? 8 : 12)) +
            (weak ? 12 : 0) + (casting ? 8 : 0)) * (resist ? 0.5 : 1);
          this.addStagger(actor, target, pressure, { skill: spec.id });
          if (weak && actor.team === 'party') this.bond = clamp(this.bond + 4, 0, 100);
        }
        if (spec.cleanse || type === 'cleanse') this.cleanse(target);
        if (living(target) && spec.status) this.applyStatus(actor, target, spec.status);
        if (spec.drain && living(actor)) this.heal(actor, actor, Math.round(stat('mag') * power), spec.id);
      }
    }

    heal(actor, target, requested, skill) {
      const amount = Math.max(0, Math.min(target.maxHp - target.hp, Math.round(requested)));
      target.hp += amount;
      this.emit('heal', { actor: actor.uid, target: target.uid, amount, skill });
      return amount;
    }

    damage(actor, target, requested, details = {}) {
      if (!living(target)) return 0;
      const wardedBy = this.wardSources(target).map(unit => unit.uid);
      const broken = target.breakRemaining > 0;
      const amount = Math.min(target.hp, Math.max(1, Math.round(requested *
        (wardedBy.length ? 0.5 : 1) * (broken ? 1.25 : 1))));
      target.hp -= amount;
      this.emit('hit', { actor: actor?.uid || target.uid, target: target.uid, amount,
        dead: target.hp <= 0, ...details, ...(wardedBy.length ? { wardedBy } : {}),
        ...(broken ? { broken: true } : {}) });
      if (target.team === 'party') this.bond = clamp(this.bond + 3, 0, 100);
      if (!living(target)) {
        target.atb = 0;
        target.intent = null;
        target.status = {};
        target.stagger = 0;
        target.breakRemaining = 0;
        target.staggerCooldown = 0;
        this.emit('death', { actor: actor?.uid || target.uid, target: target.uid });
        this.record(`${target.name} falls.`);
      } else if (target.team === 'enemy' && target.boss) {
        this.checkPhase(target);
      }
      return amount;
    }

    wardSources(targetId) {
      const target = this.unit(targetId);
      if (!target || !living(target) || !target.guardedBy) return [];
      const ids = Array.isArray(target.guardedBy) ? target.guardedBy : [target.guardedBy];
      const allies = target.team === 'party' ? this.party : this.enemies;
      return allies.filter(unit => unit !== target && living(unit) &&
        (ids.includes(unit.id) || ids.includes(unit.uid)));
    }

    dispel(target, actor = null) {
      const removed = ['guard', 'haste', 'regen'].filter(name => target.status[name] > 0);
      for (const name of removed) { delete target.status[name]; delete target.statusPower[name]; }
      if (removed.includes('guard')) target.defending = false;
      this.emit('status', { actor: actor?.uid, target: target.uid, status: 'dispel', removed });
      return removed;
    }

    addStagger(actor, target, requested, details = {}) {
      if (actor?.team !== 'party' || target.team !== 'enemy' || !living(target) ||
        !target.staggerMax || target.breakRemaining > 0 || target.staggerCooldown > 0) return 0;
      const amount = Math.min(target.staggerMax - target.stagger,
        Math.max(0, Math.round(requested * (this.wardSources(target).length ? 0.5 : 1))));
      if (!amount) return 0;
      target.stagger += amount;
      this.emit('stagger', { actor: actor.uid, target: target.uid, amount,
        value: target.stagger, max: target.staggerMax, ...details });
      if (target.stagger >= target.staggerMax) {
        const intent = target.intent;
        const cancelled = intent?.name || null;
        target.intent = null;
        target.atb = 0;
        target.stagger = 0;
        target.breakRemaining = target.staggerDuration;
        this.record(`${target.name} breaks${cancelled ? `: ${cancelled} is interrupted` : ''}.`);
        this.emit('break', { actor: actor.uid, target: target.uid,
          duration: target.breakRemaining, cancelled,
          interrupted: intent ? { name: intent.name, stage: intent.stage,
            charge: intent.charge, type: intent.spec.type || 'physical',
            targets: [...intent.targets] } : null });
      }
      return amount;
    }

    tickStagger(unit, dt) {
      if (unit.breakRemaining > 0) {
        unit.breakRemaining = Math.max(0, unit.breakRemaining - dt);
        if (!unit.breakRemaining) {
          unit.staggerCooldown = unit.staggerRecovery;
          this.emit('status', { target: unit.uid, status: 'break-end', duration: unit.staggerCooldown });
        }
        return true;
      }
      unit.staggerCooldown = Math.max(0, unit.staggerCooldown - dt);
      return false;
    }

    applyStatus(actor, target, statuses) {
      for (const [name, value] of Object.entries(statuses)) {
        if (!['guard', 'haste', 'slow', 'poison', 'burn', 'regen'].includes(name)) continue;
        const detail = typeof value === 'object' ? value : { duration: value };
        const chance = clamp(num(detail.chance, 1), 0, 1);
        if (chance < 1 && this.random() >= chance) continue;
        const duration = Math.max(0, num(detail.duration, num(detail.time, 8)));
        target.status[name] = Math.max(num(target.status[name]), duration);
        target.statusPower[name] = Math.max(1, num(detail.power, Math.ceil(actor.mag * 0.2)));
        if (name === 'guard') target.defending = false;
        if (name === 'haste') delete target.status.slow;
        if (name === 'slow') delete target.status.haste;
        this.emit('status', { actor: actor.uid, target: target.uid, status: name, duration });
      }
    }

    cleanse(target) {
      const removed = [...BAD_STATUS].filter(name => target.status[name] > 0);
      for (const name of BAD_STATUS) delete target.status[name];
      this.emit('status', { target: target.uid, status: 'cleanse', removed });
    }

    defend(actorId) {
      const actor = this.unit(actorId);
      if (this.result) return { ok: false, reason: 'This battle has ended.' };
      if (!actor || actor.team !== 'party' || !living(actor)) return { ok: false, reason: 'Choose a living party member.' };
      if (actor.atb < 99.999) return { ok: false, reason: `${actor.name} is not ready.` };
      actor.atb = 0;
      actor.status.guard = 7;
      actor.defending = true;
      const amount = Math.min(actor.maxMp - actor.mp, Math.max(3, Math.ceil(actor.maxMp * 0.06)));
      actor.mp += amount;
      this.bond = clamp(this.bond + 8, 0, 100);
      this.turn++;
      this.record(`${actor.name} guards and restores ${amount} MP.`);
      this.emit('cast', { actor: actor.uid, targets: [actor.uid], skill: 'defend', name: 'Guard', combo: 1 });
      this.emit('heal', { actor: actor.uid, target: actor.uid, amount, mp: true, skill: 'defend' });
      return { ok: true, reason: '' };
    }

    useItem(actorId, itemId, targetId, inventory) {
      const check = this.canUseItem(actorId, itemId, targetId, inventory);
      if (!check.ok) return { ok: false, reason: check.reason };
      const { actor, spec: item, targets } = check;
      inventory[itemId]--;
      actor.atb = 0;
      if (actor.defending) { delete actor.status.guard; actor.defending = false; }
      this.turn++;
      this.record(`${actor.name} uses ${item.name || itemId}.`);
      this.emit('cast', { actor: actor.uid, targets: targets.map(u => u.uid), skill: itemId, name: item.name, item: true, combo: 1 });
      if (item.type === 'restore') {
        for (const target of targets) {
          this.heal(actor, target, target.maxHp, itemId);
          const amount = target.maxMp - target.mp;
          target.mp = target.maxMp;
          this.emit('heal', { actor: actor.uid, target: target.uid, amount, mp: true, skill: itemId });
          this.cleanse(target);
        }
      } else {
        this.applySkill(actor, item, targets);
      }
      this.bond = clamp(this.bond + 5, 0, 100);
      this.checkResult();
      return { ok: true, reason: '' };
    }

    flee() {
      if (this.result) return { ok: false, reason: 'This battle has ended.' };
      if (this.enemies.some(u => living(u) && u.boss)) return { ok: false, reason: 'You cannot leave this boss battle.' };
      if (!this.party.some(u => living(u) && u.atb >= 99.999)) return { ok: false, reason: 'A party member must be ready.' };
      // A guaranteed escape removes reload loops and keeps optional fights optional.
      this.fleeAttempts++;
      this.result = 'fled';
      this.record('The party escapes.');
      this.emit('fled');
      return { ok: true, reason: '' };
    }

    prepareIntent(enemy) {
      if (!living(enemy) || this.result || enemy.breakRemaining > 0) return;
      let value = enemy.pattern.length ? enemy.pattern[enemy.patternStep % enemy.pattern.length] : null;
      const spec = this.skill(value) || { ...BASIC, id: 'enemy-attack', name: 'Strike', telegraph: 0.9 };
      enemy.patternStep++;
      const targetType = TARGET_ALIASES[spec.target] || spec.target || 'enemy';
      const friends = FRIEND_TARGETS.has(targetType);
      const pool = (friends ? this.enemies : this.party).filter(u => spec.type === 'revive' ? !living(u) : living(u));
      let target = pool[Math.floor(this.random() * pool.length)];
      if (spec.aim === 'weakest' || spec.type === 'heal') target = [...pool].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (targetType === 'self') target = enemy;
      enemy.intent = {
        name: spec.name || 'Strike', skill: spec.id, spec, target: target?.uid || null,
        targets: this.resolveTargets(enemy.uid, spec, target?.uid).map(u => u.uid),
        charge: Boolean(spec.charge), stage: 'gathering',
        duration: Math.max(0.35, num(spec.telegraph, spec.charge ? 1.8 : 0.85)),
        remaining: Math.max(0.35, num(spec.telegraph, spec.charge ? 1.8 : 0.85))
      };
      this.emit('intent', { actor: enemy.uid, target: enemy.intent.target,
        targets: enemy.intent.targets, name: enemy.intent.name, charge: enemy.intent.charge });
    }

    enemyAct(enemy) {
      const intent = enemy.intent;
      if (!intent || !living(enemy)) return;
      const spec = intent.spec;
      let targets = this.resolveTargets(enemy.uid, spec, intent.target);
      // A defeated telegraphed target changes to a living target at execution.
      if (!targets.length) targets = this.resolveTargets(enemy.uid, spec, null);
      enemy.atb = 0;
      enemy.intent = null;
      if (targets.length) {
        this.record(`${enemy.name}: ${intent.name}.`);
        this.emit('cast', { actor: enemy.uid, targets: targets.map(u => u.uid),
          skill: spec.id, name: intent.name, element: spec.element || 'physical', charge: intent.charge, combo: 1 });
        this.applySkill(enemy, spec, targets);
      }
      this.checkResult();
      if (!this.result) this.prepareIntent(enemy);
    }

    checkPhase(enemy) {
      const phases = enemy.phases || [];
      let next = enemy.phase;
      for (let i = enemy.phase; i < phases.length; i++) {
        if (enemy.hp / enemy.maxHp <= num(phases[i].at, 0.5)) next = i + 1;
      }
      if (next === enemy.phase) return;
      const phase = phases[next - 1];
      enemy.phase = next;
      enemy.phaseName = phase.name || `Phase ${next + 1}`;
      for (const stat of ['atk', 'mag', 'def', 'speed']) enemy[stat] = enemy.baseStats[stat] * num(phase[`${stat}Mult`], 1);
      if (phase.pattern) { enemy.pattern = [...phase.pattern]; enemy.patternStep = 0; }
      if (phase.weak) enemy.weak = [...phase.weak];
      if (phase.resist) enemy.resist = [...phase.resist];
      if (phase.cleanse) this.cleanse(enemy);
      enemy.intent = null;
      enemy.atb = Math.min(enemy.atb, 60);
      this.record(`${enemy.name}: ${enemy.phaseName}.`);
      this.emit('phase', { actor: enemy.uid, phase: next, name: enemy.phaseName,
        weak: [...enemy.weak], resist: [...enemy.resist] });
      this.prepareIntent(enemy);
    }

    tickStatuses(unit, dt) {
      unit.dotClock += dt;
      while (unit.dotClock >= 1 && living(unit)) {
        unit.dotClock -= 1;
        for (const name of ['poison', 'burn']) {
          if (unit.status[name] > 0) {
            const amount = num(unit.statusPower[name], Math.max(2, Math.ceil(unit.maxHp * 0.018)));
            this.damage(null, unit, amount, { skill: name, element: name === 'burn' ? 'fire' : 'earth', status: true });
          }
        }
        if (living(unit) && unit.status.regen > 0) this.heal(unit, unit, num(unit.statusPower.regen, 5), 'regen');
      }
      for (const name of Object.keys(unit.status)) {
        unit.status[name] = Math.max(0, num(unit.status[name]) - dt);
        if (!unit.status[name]) {
          delete unit.status[name]; delete unit.statusPower[name];
          if (name === 'guard') unit.defending = false;
        }
      }
    }

    update(dt, { wait = false } = {}) {
      if (this.result || wait) return;
      let remaining = Math.max(0, num(dt));
      // Fine steps also make explicit headless advances safe for DOT and intents.
      while (remaining > 0 && !this.result) {
        const step = Math.min(remaining, 1 / 30);
        remaining -= step;
        this.time += step;
        for (const unit of [...this.party, ...this.enemies]) {
          if (!living(unit)) continue;
          this.tickStatuses(unit, step);
          if (!living(unit)) continue;
          if (this.tickStagger(unit, step)) continue;
          const old = unit.atb;
          const rate = (19 + unit.speed * 0.85) * (unit.status.haste > 0 ? 1.5 : 1) *
            (unit.status.slow > 0 ? (unit.boss ? 0.75 : 0.6) : 1) * (unit.team === 'enemy' ? 0.8 : 1);
          if (unit.team === 'party') {
            unit.atb = Math.min(100, unit.atb + rate * step);
            if (old < 100 && unit.atb >= 100) this.emit('ready', { actor: unit.uid });
          } else if (!this.result) {
            if (!unit.intent) this.prepareIntent(unit);
            if (unit.intent?.stage === 'casting') {
              unit.intent.remaining = Math.max(0, unit.intent.remaining - step);
              if (unit.intent.remaining <= 0) this.enemyAct(unit);
            } else {
              unit.atb = Math.min(100, unit.atb + rate * step);
              if (unit.atb >= 100 && unit.intent) {
                unit.intent.stage = 'casting';
                this.emit('intent', { actor: unit.uid, target: unit.intent.target,
                  targets: unit.intent.targets, name: unit.intent.name, charge: unit.intent.charge, stage: 'casting' });
              }
            }
          }
        }
        this.checkResult();
      }
    }

    checkResult() {
      if (this.result) return this.result;
      if (!this.party.some(living)) this.result = 'defeat';
      else if (!this.enemies.some(living)) this.result = 'victory';
      if (this.result) {
        for (const enemy of this.enemies) enemy.intent = null;
        this.record(this.result === 'victory' ? 'Victory. The thread is secure.' : 'The party falls. The timeline awaits another attempt.');
        this.emit(this.result, { bond: this.bond });
      }
      return this.result;
    }

    snapshot() {
      const simplify = unit => ({ id: unit.id, uid: unit.uid, name: unit.name,
        hp: unit.hp, maxHp: unit.maxHp, mp: unit.mp, maxMp: unit.maxMp,
        atb: Math.round(unit.atb * 100) / 100, status: { ...unit.status }, phase: unit.phase,
        weak: [...unit.weak], resist: [...unit.resist],
        staggerMax: unit.staggerMax, stagger: unit.stagger,
        breakRemaining: Math.round(unit.breakRemaining * 100) / 100,
        staggerCooldown: Math.round(unit.staggerCooldown * 100) / 100,
        wardedBy: this.wardSources(unit).map(ally => ally.uid),
        intent: unit.intent ? { name: unit.intent.name, target: unit.intent.target,
          targets: [...unit.intent.targets], stage: unit.intent.stage, charge: unit.intent.charge,
          remaining: Math.round(unit.intent.remaining * 100) / 100 } : null });
      return { time: Math.round(this.time * 100) / 100, turn: this.turn,
        result: this.result, bond: this.bond, seed: this.seed,
        party: this.party.map(simplify), enemies: this.enemies.map(simplify), log: [...this.log] };
    }
  }

  Dawn.Battle = Battle;
  Dawn.BattleItems = ITEMS;
})();
