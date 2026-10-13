/* Tidebell battle system. Uses the supplied my-3D2dge engine. */
(function (root) {
  'use strict';

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const foeData = {
    wisp: { name: 'Tide Wisp', hp: 58, attack: 13, defense: 2, weak: 'water', xp: 22, gold: 12 },
    bramble: { name: 'Salt Bramble', hp: 72, attack: 16, defense: 4, weak: 'fire', xp: 28, gold: 16 },
    sentinel: { name: 'Hollow Sentinel', hp: 96, attack: 19, defense: 7, weak: 'pierce', xp: 40, gold: 24 },
    boss: { name: 'Drowned Bellkeeper', hp: 390, attack: 27, defense: 8, weak: null, xp: 220, gold: 160 }
  };
  const arts = {
    orin: [{ key: 'ember', title: 'Ember Edge', cost: 4, icon: '✦', scope: 'One foe', desc: 'A fire strike. Burns through brambles.', element: 'fire', target: 'enemy' }],
    mira: [
      { key: 'undertow', title: 'Undertow', cost: 3, icon: '≈', scope: 'One foe', desc: 'A strong tide spell. Unravels wisps.', element: 'water', target: 'enemy' },
      { key: 'tideburst', title: 'Tide Burst', cost: 5, icon: '≋', scope: 'All foes', desc: 'A wide tide spell. Hits every foe.', element: 'water', target: 'all' }
    ],
    fen: [
      { key: 'mend', title: 'Mend', cost: 4, icon: '+', scope: 'Lowest HP ally', desc: 'Restores 40 HP or more to the weakest ally.', target: 'lowest' },
      { key: 'pierce', title: 'Piercing Shot', cost: 3, icon: '↗', scope: 'One foe', desc: 'A sharp shot. Ignores a raised shield.', element: 'pierce', target: 'enemy' }
    ]
  };
  const itemData = {
    herb: { title: 'Field herb', icon: '+', desc: 'Restore 45 HP to one living ally.', short: '+45 HP' },
    ether: { title: 'Moon dew', icon: '◇', desc: 'Restore 12 MP to one living ally.', short: '+12 MP' },
    revive: { title: 'Dawn seed', icon: '✧', desc: 'Raise one fallen ally with 60% HP.', short: 'Raise ally' }
  };

  class TideBattle {
    constructor(options) {
      this.options = options || {};
      this.game = this.options.game;
      if (!this.game) throw new Error('TideBattle needs a game.');
      this.E = root.My3D2dge;
      this.settings = this.options.settings || {};
      this.active = false;
      this.phase = 'idle';
      this.time = 0;
      this.effects = [];
      this._layoutDirty = true;
      this._buildUI();
      this._onResize = () => { this._layoutDirty = true; };
      root.addEventListener('resize', this._onResize);
      if (root.ResizeObserver) {
        this._observer = new ResizeObserver(this._onResize);
        this._observer.observe(this.stage);
      }
    }

    _buildUI() {
      this.host = document.getElementById('battleUI');
      if (!this.host) {
        this.host = document.createElement('section');
        this.host.id = 'battleUI';
        document.body.appendChild(this.host);
      }
      this.host.hidden = true;
      this.host.innerHTML = '<div class="tb-shell">' +
        '<header class="tb-banner"><div><span class="tb-eyebrow">THE TIDE REMEMBERS</span><h2 class="tb-title"></h2></div><div class="tb-round"></div></header>' +
        '<div class="tb-enemies" aria-label="Foes"></div>' +
        '<div class="tb-stage"><div class="tb-stage-note"></div><div class="tb-figure-buttons"></div></div>' +
        '<section class="tb-console" aria-label="Battle commands">' +
        '<div class="tb-party" aria-label="Your party"></div>' +
        '<div class="tb-work"><div class="tb-command-area"><div class="tb-command-head"><div class="tb-actor-label"></div><button class="tb-back" data-battle-action="back" aria-label="Go back">← Back</button></div><div class="tb-panel"></div></div>' +
        '<aside class="tb-side"><div class="tb-bond"><div><span>PARTY BOND</span><strong class="tb-bond-value"></strong></div><div class="tb-bond-track"><i></i></div><p>Stand together. Fill the bell.</p></div><div class="tb-log" role="log" aria-live="polite" aria-atomic="false"></div></aside></div>' +
        '<div class="tb-key-hint">Choose with arrows or the left stick. Confirm with Enter or ×. Back with Esc or ○.</div>' +
        '</section></div><div class="tb-float-layer" aria-hidden="true"></div><div class="tb-result" hidden></div>';
      this.shell = this.host.querySelector('.tb-shell');
      this.titleEl = this.host.querySelector('.tb-title');
      this.roundEl = this.host.querySelector('.tb-round');
      this.enemiesEl = this.host.querySelector('.tb-enemies');
      this.partyEl = this.host.querySelector('.tb-party');
      this.stage = this.host.querySelector('.tb-stage');
      this.stageNote = this.host.querySelector('.tb-stage-note');
      this.figureButtons = this.host.querySelector('.tb-figure-buttons');
      this.actorLabel = this.host.querySelector('.tb-actor-label');
      this.backButton = this.host.querySelector('.tb-back');
      this.panel = this.host.querySelector('.tb-panel');
      this.bondValue = this.host.querySelector('.tb-bond-value');
      this.bondFill = this.host.querySelector('.tb-bond-track i');
      this.logEl = this.host.querySelector('.tb-log');
      this.floatLayer = this.host.querySelector('.tb-float-layer');
      this.resultEl = this.host.querySelector('.tb-result');
      this.host.addEventListener('pointerdown', e => { if (e.target.closest('button')) e.stopPropagation(); });
      this.host.addEventListener('click', e => {
        const b = e.target.closest('button[data-battle-action]');
        if (!b || b.disabled || !this.active) return;
        e.preventDefault();
        e.stopPropagation();
        this._activate(b.dataset.battleAction);
      });
    }

    start(encounter, party, inventory, progress) {
      this.encounter = Object.assign({ id: 'encounter', name: 'The drowned road', enemies: ['wisp'], boss: false, canFlee: true }, encounter || {});
      this.party = party || [];
      if (!this.party.length) throw new Error('TideBattle needs a party.');
      this.inventory = inventory || { herb: 0, ether: 0, revive: 0, gold: 0 };
      this.progress = progress || { bond: 0 };
      this.progress.bond = clamp(Math.round(Number(this.progress.bond) || 0), 0, 100);
      for (const k of ['herb', 'ether', 'revive', 'gold']) this.inventory[k] = Math.max(0, Math.floor(Number(this.inventory[k]) || 0));
      this.party.forEach((p, i) => {
        p.id = p.id || ['orin', 'mira', 'fen'][i] || 'ally' + i;
        p.name = p.name || p.id;
        p.maxHp = Math.max(1, Number(p.maxHp) || 100);
        p.maxMp = Math.max(0, Number(p.maxMp) || 0);
        p.hp = clamp(Number.isFinite(p.hp) ? p.hp : p.maxHp, 0, p.maxHp);
        p.mp = clamp(Number.isFinite(p.mp) ? p.mp : p.maxMp, 0, p.maxMp);
        p.attack = Number(p.attack) || 20;
        p.defense = Number(p.defense) || 5;
        p.level = Number(p.level) || 1;
      });
      this.story = this.settings.difficulty === 'story';
      const enemyTypes = this.encounter.enemies && this.encounter.enemies.length ? this.encounter.enemies : [this.encounter.boss ? 'boss' : 'wisp'];
      this.enemies = enemyTypes.map((value, i) => {
        let type = typeof value === 'string' ? value.toLowerCase() : value.type || 'wisp';
        if (/boss|bell|keeper/.test(type)) type = 'boss';
        if (!foeData[type]) type = 'wisp';
        const data = foeData[type];
        const maxHp = Math.round(data.hp * (this.story ? .82 : 1));
        return Object.assign({}, data, { type, index: i, id: type + '-' + i, hp: maxHp, maxHp, phase: 1, hit: 0, deadAt: null, braced: false });
      });
      this.encounter.boss = !!this.encounter.boss || this.enemies.some(e => e.type === 'boss');
      if (this.encounter.boss) this.encounter.canFlee = false;
      this.active = true;
      this.time = 0;
      this.round = 1;
      this.effects = [];
      this.logs = [];
      this.guards = new Set();
      this.pending = null;
      this.wait = null;
      this.selectedEnemy = 0;
      this.selectedAlly = 0;
      this.navIndex = 0;
      this._done = false;
      this._chorusAt = undefined;
      this._phaseAt = undefined;
      this._enemyFlashAt = undefined;
      this._enemyFlashHeavy = false;
      this._portraitTime = 0;
      this._seed = 7;
      for (const c of String(this.encounter.id)) this._seed = (this._seed * 31 + c.charCodeAt(0)) >>> 0;
      this.floatLayer.innerHTML = '';
      this.resultEl.hidden = true;
      this.resultEl.innerHTML = '';
      this.host.hidden = false;
      this.host.classList.add('tb-active');
      this.host.classList.toggle('tb-boss-battle', this.encounter.boss);
      this._layoutDirty = true;
      this._makePortraits();
      this._log(this.encounter.boss ? 'The Bellkeeper raises its broken bell. Watch its next toll.' : 'The path falls silent. Your party stands together.', 'story');
      this._beginRound();
      this._sound('confirm');
      return this;
    }

    end() {
      this.active = false;
      this.phase = 'idle';
      this.wait = null;
      this.pending = null;
      this.effects.forEach(e => { if (e.el) e.el.remove(); });
      this.effects = [];
      this.host.classList.remove('tb-active');
      this.host.hidden = true;
      this.resultEl.hidden = true;
      if (this.game.input) this.game.input.consumeAll();
    }

    snapshot() {
      return {
        active: this.active, phase: this.phase, round: this.round,
        actor: this.actor ? this.actor.id : null,
        bond: this.progress ? this.progress.bond : 0,
        party: (this.party || []).map(p => ({ id: p.id, hp: p.hp, mp: p.mp, guard: this.guards && this.guards.has(p.id) })),
        enemies: (this.enemies || []).map(e => ({ id: e.id, type: e.type, hp: e.hp, phase: e.phase, intent: e.intent ? e.intent.text : '' }))
      };
    }

    get actor() { return this.party && this.party[this.actorIndex]; }

    _rand() {
      this._seed = (Math.imul(this._seed, 1664525) + 1013904223) >>> 0;
      return this._seed / 4294967296;
    }

    _sound(name) {
      try {
        if (typeof this.options.sound === 'function') this.options.sound(name);
        else this.game.audio.sfx(name);
      } catch (_) { /* Sound must not block a turn. */ }
    }

    _log(text, tone) {
      this.logs.push({ text, tone: tone || '' });
      if (this.logs.length > 60) this.logs.shift();
      this._renderLog();
    }

    _renderLog() {
      if (!this.logEl || !this.logs) return;
      this.logEl.innerHTML = this.logs.slice(-3).map(l => '<p class="' + esc(l.tone) + '">' + esc(l.text) + '</p>').join('');
    }

    _gainBond(amount) {
      const old = this.progress.bond;
      this.progress.bond = clamp(old + amount, 0, 100);
      if (old < 100 && this.progress.bond === 100) this._log('The bell is full. Bell Chorus is ready.', 'good');
    }

    _beginRound() {
      if (!this.active) return;
      if (this._checkEnd()) return;
      this.guards.clear();
      this.enemies.forEach(e => { e.intent = null; e.braced = false; if (e.hp > 0) this._setIntent(e); });
      this.turnOrder = this.party.map((p, i) => p.hp > 0 ? i : -1).filter(i => i >= 0);
      this.turnCursor = 0;
      this.actorIndex = this.turnOrder[0];
      this._setPhase('commands');
    }

    _setIntent(e) {
      if (e.type === 'boss') {
        if (this.round % 3 === 0) e.intent = { text: 'Great Toll · all allies', power: e.phase === 2 ? 1.48 : 1.22, all: true, danger: true };
        else if (e.phase === 2) e.intent = { text: 'Twin Knell · two allies', power: 1.00, twin: true, danger: false };
        else e.intent = { text: 'Bell strike · one ally', power: 1.04, danger: false };
      } else if (e.type === 'wisp') {
        e.intent = this.round % 3 === 0 ? { text: 'Cold swell · all allies', power: .72, all: true } : { text: 'Tide spark · one ally', power: 1 };
      } else if (e.type === 'bramble') {
        e.intent = { text: this.round % 2 === 0 ? 'Thorn strike · strong' : 'Vine lash · one ally', power: this.round % 2 === 0 ? 1.22 : 1 };
      } else {
        e.braced = this.round % 2 === 1;
        e.intent = { text: e.braced ? 'Shield raised · light strike' : 'Hammer strike · strong', power: e.braced ? .8 : 1.2 };
      }
    }

    _setPhase(phase) {
      this.phase = phase;
      this.navIndex = 0;
      this._render();
    }

    _delay(seconds, fn) { this.wait = { left: seconds, fn }; }

    update(dt) {
      if (!this.active) return;
      const speed = this.settings.battleSpeed === 2 ? 2 : 1;
      const step = Math.max(0, Math.min(.1, dt)) * speed;
      this.time += step;
      for (const e of this.enemies) e.hit = Math.max(0, e.hit - step);
      for (let i = this.effects.length - 1; i >= 0; i--) {
        const e = this.effects[i];
        e.age += step;
        if (e.age >= e.life) {
          if (e.el) e.el.remove();
          this.effects.splice(i, 1);
          continue;
        }
        if (e.el) {
          const card = this.partyEl.children[e.index];
          if (card) {
            const box = card.getBoundingClientRect();
            const hostBox = this.host.getBoundingClientRect();
            e.el.style.left = Math.round(box.left + box.width * .65 - hostBox.left) + 'px';
            e.el.style.top = Math.round(box.top - hostBox.top + 7) + 'px';
            const rise = this.settings.reducedMotion ? 0 : Math.min(24, e.age * 34);
            e.el.style.transform = 'translate(-50%,' + (-rise) + 'px)';
            e.el.style.opacity = String(Math.min(1, (e.life - e.age) * 3));
          }
        }
      }
      if (this.wait) {
        this.wait.left -= step;
        if (this.wait.left <= 0) {
          const fn = this.wait.fn;
          this.wait = null;
          fn();
        }
      }
      this._portraitTime = (this._portraitTime || 0) + dt;
      if (this._portraitTime > .12) {
        this._portraitTime = 0;
        this._drawPortraits();
      }
    }

    handle(action) {
      if (!this.active) return false;
      if (action === 'cancel') action = 'back';
      if (this.phase === 'victory') {
        if (action === 'confirm') this._completeWin();
        return true;
      }
      if (this.phase === 'animation' || this.phase === 'defeat' || this.phase === 'fleeing') return true;
      if (action === 'back') { this._back(); return true; }
      const horizontal = action === 'left' || action === 'right';
      const vertical = action === 'up' || action === 'down';
      if (this.phase === 'targetEnemy') {
        if (horizontal || vertical) {
          const live = this.enemies.filter(e => e.hp > 0).map(e => e.index);
          const at = live.indexOf(this.selectedEnemy);
          const delta = action === 'left' || action === 'up' ? -1 : 1;
          this.selectedEnemy = live[(at + delta + live.length) % live.length];
          this._sound('select');
          this._render();
        } else if (action === 'confirm') this._resolveEnemy(this.selectedEnemy);
        return true;
      }
      if (this.phase === 'targetAlly') {
        if (horizontal || vertical) {
          const valid = this.party.map((p, i) => this._validItemTarget(this.pending.item, p) ? i : -1).filter(i => i >= 0);
          const at = valid.indexOf(this.selectedAlly);
          const delta = action === 'left' || action === 'up' ? -1 : 1;
          if (valid.length) this.selectedAlly = valid[(at + delta + valid.length) % valid.length];
          this._sound('select');
          this._render();
        } else if (action === 'confirm') this._resolveAlly(this.selectedAlly);
        return true;
      }
      const buttons = Array.from(this.panel.querySelectorAll('button[data-nav]'));
      if (!buttons.length) return true;
      if (horizontal || vertical) {
        let delta = action === 'left' ? -1 : action === 'right' ? 1 : action === 'up' ? -(this.navCols || 1) : (this.navCols || 1);
        let candidate = (this.navIndex + delta + buttons.length * 4) % buttons.length;
        let steps = 0;
        while (buttons[candidate].disabled && steps++ < buttons.length) candidate = (candidate + (delta < 0 ? -1 : 1) + buttons.length) % buttons.length;
        if (!buttons[candidate].disabled) this.navIndex = candidate;
        this._markNav();
        this._sound('select');
      } else if (action === 'confirm') {
        const button = buttons[this.navIndex] || buttons.find(b => !b.disabled);
        if (button && !button.disabled) this._activate(button.dataset.battleAction);
      }
      return true;
    }

    _activate(key) {
      if (!this.active) return;
      if (key === 'victory') { if (this.phase === 'victory') this._completeWin(); return; }
      if (['animation', 'defeat', 'fleeing', 'victory'].includes(this.phase)) return;
      if (key === 'back') { this._back(); return; }
      if (key.startsWith('enemy:')) {
        const i = Number(key.slice(6));
        if (!this.enemies[i] || this.enemies[i].hp <= 0) return;
        this.selectedEnemy = i;
        if (this.phase === 'targetEnemy') this._resolveEnemy(i);
        else this._renderEnemies();
        return;
      }
      if (key.startsWith('ally:')) { if (this.phase === 'targetAlly') this._resolveAlly(Number(key.slice(5))); return; }
      if (key === 'resolveEnemy') { this._resolveEnemy(this.selectedEnemy); return; }
      if (key === 'resolveAlly') { this._resolveAlly(this.selectedAlly); return; }
      if (key === 'stay') { this._setPhase('commands'); return; }
      if (key === 'fleeNow') { if (this.phase === 'fleeConfirm') this._flee(); return; }
      if (!this.actor || this.actor.hp <= 0) { this._nextAlly(); return; }
      if (key === 'strike') {
        this.pending = { key: 'strike', title: 'Strike', target: 'enemy' };
        this.returnPhase = 'commands';
        this.selectedEnemy = this._livingEnemy(this.selectedEnemy);
        this._setPhase('targetEnemy');
      } else if (key === 'arts') this._setPhase('arts');
      else if (key === 'pack') this._setPhase('items');
      else if (key === 'guard') this._perform({ key: 'guard', title: 'Guard' });
      else if (key === 'chorus') { if (this.progress.bond >= 100) this._perform({ key: 'chorus', title: 'Bell Chorus', target: 'all' }); }
      else if (key === 'flee') { if (this.encounter.canFlee) this._setPhase('fleeConfirm'); }
      else if (key.startsWith('art:')) {
        const art = this._actorArts().find(a => a.key === key.slice(4));
        if (!art || this.actor.mp < art.cost) return;
        if (art.key === 'mend' && !this.party.some(p => p.hp > 0 && p.hp < p.maxHp)) return;
        if (art.target === 'enemy') {
          this.pending = art;
          this.returnPhase = 'arts';
          this.selectedEnemy = this._livingEnemy(this.selectedEnemy);
          this._setPhase('targetEnemy');
        } else this._perform(art);
      } else if (key.startsWith('item:')) {
        const item = key.slice(5);
        if (!itemData[item] || this.inventory[item] < 1) return;
        const valid = this.party.map((p, i) => this._validItemTarget(item, p) ? i : -1).filter(i => i >= 0);
        if (!valid.length) { this._log(item === 'revive' ? 'No ally has fallen.' : 'No ally needs this item.', 'story'); return; }
        this.pending = { key: 'item', item, title: itemData[item].title, target: 'ally' };
        this.selectedAlly = valid.sort((a, b) => item === 'ether' ? this.party[a].mp / Math.max(1, this.party[a].maxMp) - this.party[b].mp / Math.max(1, this.party[b].maxMp) : this.party[a].hp / this.party[a].maxHp - this.party[b].hp / this.party[b].maxHp)[0];
        this._setPhase('targetAlly');
      }
      this._sound('select');
    }

    _back() {
      if (this.phase === 'targetEnemy') this._setPhase(this.returnPhase || 'commands');
      else if (this.phase === 'targetAlly') this._setPhase('items');
      else if (this.phase !== 'commands') this._setPhase('commands');
      this._sound('cancel');
    }

    _actorArts() {
      if (!this.actor) return [];
      const id = String(this.actor.id).toLowerCase();
      if (arts[id]) return arts[id];
      const role = String(this.actor.role || '').toLowerCase();
      return /mage|tide/.test(role) ? arts.mira : /ranger|heal/.test(role) ? arts.fen : arts.orin;
    }

    _livingEnemy(index) { return this.enemies[index] && this.enemies[index].hp > 0 ? index : this.enemies.findIndex(e => e.hp > 0); }
    _validItemTarget(item, p) {
      if (item === 'revive') return p.hp <= 0;
      if (p.hp <= 0) return false;
      return item === 'ether' ? p.mp < p.maxMp : p.hp < p.maxHp;
    }

    _resolveEnemy(index) {
      if (this.phase !== 'targetEnemy' || !this.pending) return;
      index = this._livingEnemy(index);
      if (index < 0) { this._win(); return; }
      this._perform(this.pending, index);
    }

    _resolveAlly(index) {
      if (this.phase !== 'targetAlly' || !this.pending || !this.party[index] || !this._validItemTarget(this.pending.item, this.party[index])) return;
      this._perform(this.pending, index);
    }

    _perform(action, targetIndex) {
      const actor = this.actor;
      if (!actor || actor.hp <= 0) { this._nextAlly(); return; }
      if (action.cost && actor.mp < action.cost) { this._setPhase('commands'); return; }
      if (action.key === 'item' && this.inventory[action.item] < 1) { this._setPhase('items'); return; }
      this.phase = 'animation';
      this.pending = null;
      if (action.cost) actor.mp -= action.cost;
      if (action.key === 'guard') {
        this.guards.add(actor.id);
        const restored = Math.min(2, actor.maxMp - actor.mp);
        actor.mp += restored;
        this._gainBond(6);
        this._log(actor.name + ' guards. Damage is halved this round' + (restored ? '. +' + restored + ' MP.' : '.'), 'good');
        this._float('ally', this.actorIndex, 'GUARD', '#b9dcde');
        this._sound('key');
      } else if (action.key === 'item') {
        const target = this.party[targetIndex];
        if (!target || !this._validItemTarget(action.item, target)) { this._setPhase('items'); return; }
        this.inventory[action.item]--;
        if (action.item === 'ether') {
          const amount = Math.min(12, target.maxMp - target.mp);
          target.mp += amount;
          this._float('ally', targetIndex, '+' + amount + ' MP', '#baa9ff');
          this._log(actor.name + ' gives Moon dew to ' + target.name + '. +' + amount + ' MP.', 'good');
        } else if (action.item === 'revive') {
          target.hp = Math.max(1, Math.ceil(target.maxHp * .6));
          this._float('ally', targetIndex, 'RISE', '#c4ead7');
          this._log(target.name + ' rises with ' + target.hp + ' HP.', 'good');
        } else {
          const amount = this._heal(targetIndex, 45);
          this._log(actor.name + ' gives a Field herb to ' + target.name + '. +' + amount + ' HP.', 'good');
        }
        this._gainBond(5);
        this._sound('heal');
      } else if (action.key === 'mend') {
        const live = this.party.map((p, i) => p.hp > 0 ? i : -1).filter(i => i >= 0);
        const index = live.sort((a, b) => this.party[a].hp / this.party[a].maxHp - this.party[b].hp / this.party[b].maxHp)[0];
        const amount = this._heal(index, 38 + actor.level * 4);
        this._log(actor.name + ' uses Mend. ' + this.party[index].name + ' recovers ' + amount + ' HP.', 'good');
        this._gainBond(10);
        this._sound('heal');
      } else if (action.key === 'chorus') {
        this.progress.bond = 0;
        let total = 0;
        const power = 34 + this.party.reduce((sum, p) => sum + p.level, 0) * 1.2;
        this.enemies.filter(e => e.hp > 0).forEach(e => { total += this._damageEnemy(e, Math.round(power), 'chorus'); });
        this.party.forEach((p, i) => { if (p.hp > 0) this._heal(i, 25); });
        this._chorusAt = this.time;
        this._log('Bell Chorus rings out. ' + total + ' damage. Each living ally recovers 25 HP.', 'good');
        this._sound('secret');
      } else {
        const targets = action.target === 'all' ? this.enemies.filter(e => e.hp > 0) : [this.enemies[this._livingEnemy(targetIndex)]];
        let total = 0;
        let weak = false;
        for (const e of targets) {
          if (!e) continue;
          const defense = e.defense + (e.type === 'boss' && e.phase === 2 ? 3 : 0);
          let power;
          if (action.key === 'ember') power = actor.attack * 1.16 + 4 - defense * .55;
          else if (action.key === 'undertow') power = actor.attack * 1.22 + 7 - defense * .35;
          else if (action.key === 'tideburst') power = actor.attack * .8 + 6 - defense * .3;
          else if (action.key === 'pierce') power = actor.attack * 1.07 + 5 - defense * .1;
          else power = actor.attack + 2 - defense * .6;
          const weakness = action.element && e.weak === action.element;
          if (weakness && action.element !== 'pierce') power *= 1.55;
          if (e.braced && action.element !== 'pierce') power *= .55;
          const damage = Math.max(1, Math.round(power * (.94 + this._rand() * .12)));
          total += this._damageEnemy(e, damage, action.element || 'strike', weakness);
          weak = weak || weakness;
        }
        const targetName = action.target === 'all' ? 'all foes' : targets[0] ? targets[0].name : 'the foe';
        this._log(actor.name + ' uses ' + action.title + ' on ' + targetName + '. ' + total + ' damage.' + (weak ? ' Weak point!' : ''), weak ? 'good' : '');
        this._gainBond((action.cost ? 9 : 7) + (weak ? 4 : 0));
        this._sound(action.element === 'water' ? 'warp' : action.element === 'fire' ? 'explode' : 'hit');
      }
      this._render();
      this._delay(action.key === 'chorus' ? 1.05 : .68, () => {
        if (!this._checkEnd()) this._nextAlly();
      });
    }

    _heal(index, amount) {
      const p = this.party[index];
      if (!p || p.hp <= 0) return 0;
      const healed = Math.max(0, Math.min(Math.round(amount), p.maxHp - p.hp));
      p.hp += healed;
      this._float('ally', index, '+' + healed, '#a9edc1');
      return healed;
    }

    _damageEnemy(enemy, amount, kind, weak) {
      const damage = Math.min(enemy.hp, Math.max(1, Math.round(amount)));
      enemy.hp -= damage;
      enemy.hit = .42;
      this._float('enemy', enemy.index, String(damage), weak ? '#ffe6a6' : '#fff3de', weak ? 'WEAK' : '');
      this.effects.push({ kind: 'impact', element: kind, index: enemy.index, age: 0, life: .5, power: damage });
      if (enemy.type === 'boss' && enemy.hp > 0 && enemy.phase === 1 && enemy.hp <= enemy.maxHp * .5) {
        enemy.phase = 2;
        this._setIntent(enemy);
        this._phaseAt = this.time;
        this._log('The bell splits open. The Bellkeeper enters its second phase.', 'danger');
      }
      if (enemy.hp <= 0 && enemy.deadAt === null) {
        enemy.deadAt = this.time;
        enemy.intent = null;
      }
      return damage;
    }

    _float(kind, index, text, color, label) {
      const effect = { kind, index, text, color, label: label || '', age: 0, life: 1.25 };
      if (kind === 'ally') {
        const el = document.createElement('span');
        el.className = 'tb-damage';
        el.textContent = text;
        el.style.color = color;
        this.floatLayer.appendChild(el);
        effect.el = el;
      }
      this.effects.push(effect);
    }

    _nextAlly() {
      if (this._checkEnd()) return;
      this.turnCursor++;
      while (this.turnCursor < this.turnOrder.length && this.party[this.turnOrder[this.turnCursor]].hp <= 0) this.turnCursor++;
      if (this.turnCursor < this.turnOrder.length) {
        this.actorIndex = this.turnOrder[this.turnCursor];
        this._setPhase('commands');
      } else {
        this.actorIndex = -1;
        this.phase = 'animation';
        this.enemyOrder = this.enemies.filter(e => e.hp > 0).map(e => e.index);
        this.enemyCursor = 0;
        this._render();
        this._delay(.3, () => this._runEnemy());
      }
    }

    _runEnemy() {
      if (this._checkEnd()) return;
      while (this.enemyCursor < this.enemyOrder.length && this.enemies[this.enemyOrder[this.enemyCursor]].hp <= 0) this.enemyCursor++;
      if (this.enemyCursor >= this.enemyOrder.length) {
        this.round++;
        this._beginRound();
        return;
      }
      const enemy = this.enemies[this.enemyOrder[this.enemyCursor++]];
      const intent = enemy.intent || { text: 'Strike', power: 1 };
      const living = this.party.map((p, i) => p.hp > 0 ? i : -1).filter(i => i >= 0);
      const at = (this.round + enemy.index) % living.length;
      let targets = intent.all ? living : [living[at]];
      if (intent.twin && living.length > 1) targets.push(living[(at + 1) % living.length]);
      let total = 0;
      for (const index of targets) total += this._hurtAlly(index, enemy.attack * intent.power, enemy);
      this._log(enemy.name + ' uses ' + intent.text.split(' · ')[0] + '. ' + total + ' damage.' + (intent.danger ? ' The great toll fades.' : ''), 'danger');
      enemy.lastAttackAt = this.time;
      this._enemyFlashAt = this.time;
      this._enemyFlashHeavy = !!intent.danger;
      this._sound(intent.danger ? 'boom' : 'hurt');
      this._render();
      this._delay(intent.danger ? 1.0 : .72, () => { if (!this._checkEnd()) this._runEnemy(); });
    }

    _hurtAlly(index, power) {
      const p = this.party[index];
      if (!p || p.hp <= 0) return 0;
      let damage = Math.max(1, Math.round((power - p.defense * .7) * (.95 + this._rand() * .1) * (this.story ? .64 : 1)));
      if (this.guards.has(p.id)) damage = Math.max(1, Math.ceil(damage * .5));
      damage = Math.min(p.hp, damage);
      p.hp -= damage;
      this._float('ally', index, '−' + damage, this.guards.has(p.id) ? '#badbe5' : '#ffb4a6');
      this._gainBond(3);
      if (p.hp <= 0) this._log(p.name + ' has fallen. A Dawn seed can bring them back.', 'danger');
      return damage;
    }

    _checkEnd() {
      if (!this.active || this._done) return true;
      if (this.enemies.every(e => e.hp <= 0)) { this._win(); return true; }
      if (this.party.every(p => p.hp <= 0)) { this._lose(); return true; }
      return false;
    }

    _win() {
      if (this.phase === 'victory' || this._done) return;
      this.phase = 'victory';
      this.wait = null;
      this.actorIndex = -1;
      this.reward = {
        encounter: this.encounter,
        xp: this.enemies.reduce((n, e) => n + e.xp, 0),
        gold: this.enemies.reduce((n, e) => n + e.gold, 0),
        turns: this.round
      };
      this._log(this.encounter.boss ? 'The last toll falls silent. The tide can breathe again.' : 'The way is clear. Your party carries on.', 'good');
      this._render();
      this.resultEl.hidden = false;
      this.resultEl.innerHTML = '<div class="tb-result-card"><div class="tb-result-sigil">✧</div><p class="tb-eyebrow">' + (this.encounter.boss ? 'THE BELL FALLS SILENT' : 'THE WAY IS CLEAR') + '</p><h2>' + (this.encounter.boss ? 'A promise kept.' : 'Together, onward.') + '</h2><p>' + (this.encounter.boss ? 'The Bellkeeper rests. The broken tide begins to turn.' : 'Your party wins the encounter.') + '</p><div class="tb-rewards"><div><strong>' + this.reward.xp + '</strong><span>XP each</span></div><div><strong>' + this.reward.gold + '</strong><span>Shells</span></div><div><strong>' + this.round + '</strong><span>' + (this.round === 1 ? 'Round' : 'Rounds') + '</span></div></div><button class="tb-continue" data-battle-action="victory">Continue <span>→</span></button></div>';
      this._sound('powerup');
    }

    _completeWin() {
      if (this.phase !== 'victory' || this._done) return;
      this._done = true;
      const reward = this.reward;
      this.end();
      if (typeof this.options.onWin === 'function') this.options.onWin(reward);
    }

    _lose() {
      if (this.phase === 'defeat' || this._done) return;
      this.phase = 'defeat';
      this.actorIndex = -1;
      this._log('The tide closes in. Your party must try again.', 'danger');
      this._render();
      this._sound('die');
      this._delay(1.0, () => {
        if (this._done) return;
        this._done = true;
        const result = { encounter: this.encounter, turns: this.round };
        this.end();
        if (typeof this.options.onLose === 'function') this.options.onLose(result);
      });
    }

    _flee() {
      if (!this.encounter.canFlee || this.encounter.boss) return;
      this.phase = 'fleeing';
      this._log('Your party withdraws to the path. Your wounds remain.', 'story');
      this._render();
      this._sound('whoosh');
      this._delay(.55, () => {
        if (this._done) return;
        this._done = true;
        const result = { encounter: this.encounter, turns: this.round };
        this.end();
        if (typeof this.options.onFlee === 'function') this.options.onFlee(result);
      });
    }

    _button(key, title, sub, icon, disabled, extra) {
      return '<button class="tb-command ' + (extra || '') + '" data-nav data-battle-action="' + esc(key) + '"' + (disabled ? ' disabled' : '') + '><span class="tb-command-icon" aria-hidden="true">' + esc(icon || '◇') + '</span><span><strong>' + esc(title) + '</strong><small>' + esc(sub) + '</small></span></button>';
    }

    _render() {
      if (!this.active) return;
      this.titleEl.textContent = this.encounter.boss ? 'Drowned Bellkeeper' : this.encounter.name;
      this.roundEl.innerHTML = '<span>ROUND</span><strong>' + this.round + '</strong>';
      this.host.dataset.phase = this.phase;
      this._renderEnemies();
      this._renderParty();
      this._renderPanel();
      this._renderLog();
      this.bondValue.textContent = this.progress.bond + ' / 100';
      this.bondFill.style.width = this.progress.bond + '%';
      this.host.classList.toggle('tb-bond-ready', this.progress.bond >= 100);
      const heavy = this.enemies.some(e => e.hp > 0 && e.intent && e.intent.danger);
      this.stageNote.textContent = this.phase === 'targetEnemy' ? 'Choose a foe' : this.phase === 'targetAlly' ? 'Choose an ally below' : heavy && this.phase !== 'victory' ? 'A great toll is coming. Guard to reduce its damage.' : '';
      this.stageNote.classList.toggle('tb-warning', heavy && this.phase !== 'targetEnemy' && this.phase !== 'targetAlly');
      this._layoutDirty = true;
    }

    _renderEnemies() {
      this.enemiesEl.innerHTML = this.enemies.map(e => {
        const selected = this.phase === 'targetEnemy' && e.index === this.selectedEnemy;
        const weakness = e.weak === 'water' ? 'Tide weak' : e.weak === 'fire' ? 'Fire weak' : e.weak === 'pierce' ? 'Pierce shield' : e.phase === 2 ? 'Phase II' : 'Ancient guardian';
        return '<button class="tb-enemy-card' + (selected ? ' tb-selected' : '') + (e.hp <= 0 ? ' tb-fallen' : '') + (e.intent && e.intent.danger ? ' tb-heavy' : '') + '" data-battle-action="enemy:' + e.index + '" aria-label="' + esc(e.name + ', ' + e.hp + ' of ' + e.maxHp + ' HP. ' + (e.intent ? e.intent.text : 'Defeated')) + '"' + (e.hp <= 0 ? ' disabled' : '') + '><div class="tb-enemy-top"><strong>' + esc(e.name) + '</strong><span>' + esc(weakness) + '</span></div><div class="tb-enemy-meter"><i style="width:' + (e.hp / e.maxHp * 100) + '%"></i></div><div class="tb-enemy-bottom"><span>' + esc(e.hp <= 0 ? 'Defeated' : e.intent ? e.intent.text : '') + '</span><b>' + e.hp + '<em> / ' + e.maxHp + '</em></b></div></button>';
      }).join('');
      this.figureButtons.innerHTML = this.enemies.map((e, i) => '<button class="tb-figure-button" data-battle-action="enemy:' + i + '" style="left:' + ((i + .5) / this.enemies.length * 100) + '%;width:' + (84 / this.enemies.length) + '%" aria-label="Select ' + esc(e.name) + '"' + (e.hp <= 0 || this.phase !== 'targetEnemy' ? ' disabled' : '') + '></button>').join('');
    }

    _renderParty() {
      this.partyEl.innerHTML = this.party.map((p, i) => {
        const acting = i === this.actorIndex && p.hp > 0 && this.phase !== 'victory';
        const selected = this.phase === 'targetAlly' && i === this.selectedAlly;
        const hp = clamp(p.hp / p.maxHp * 100, 0, 100);
        const guard = this.guards.has(p.id);
        return '<div class="tb-party-card' + (acting ? ' tb-acting' : '') + (selected ? ' tb-selected' : '') + (p.hp <= 0 ? ' tb-fallen' : '') + '" style="--ally-color:' + esc(p.color || ['#e4b878', '#b6a2d6', '#a8c89c'][i % 3]) + '"><div class="tb-portrait"><canvas width="40" height="44" data-portrait="' + i + '" aria-hidden="true"></canvas></div><div class="tb-party-info"><div class="tb-party-name"><strong>' + esc(p.name) + '</strong><span>' + (p.hp <= 0 ? 'FALLEN' : guard ? 'GUARD' : acting ? 'ACTING' : 'LV ' + p.level) + '</span></div><div class="tb-health-row"><span>HP</span><div class="tb-hp-track"><i style="width:' + hp + '%;' + (hp < 26 ? 'background:#df8b77' : '') + '"></i></div><b>' + p.hp + '<em> / ' + p.maxHp + '</em></b></div><div class="tb-magic-row"><span>MP</span><div class="tb-mp-track"><i style="width:' + (p.maxMp ? p.mp / p.maxMp * 100 : 0) + '%"></i></div><b>' + p.mp + '<em> / ' + p.maxMp + '</em></b></div></div></div>';
      }).join('');
      this._drawPortraits();
    }

    _renderPanel() {
      const p = this.actor;
      this.backButton.hidden = !['arts', 'items', 'targetEnemy', 'targetAlly', 'fleeConfirm'].includes(this.phase);
      this.actorLabel.innerHTML = p ? '<span class="tb-actor-dot" style="background:' + esc(p.color || '#dfbb80') + '"></span><strong>' + esc(p.name) + '</strong><span>' + (this.phase === 'commands' ? 'Choose a command' : this.phase === 'arts' ? 'Choose an art' : this.phase === 'items' ? 'Choose an item' : this.phase === 'targetEnemy' ? this.pending ? esc(this.pending.title) : 'Choose a foe' : this.phase === 'targetAlly' ? this.pending ? esc(this.pending.title) : 'Choose an ally' : this.phase === 'fleeConfirm' ? 'Leave the fight?' : 'Acts') + '</span>' : '<strong>' + (this.phase === 'victory' ? 'Victory' : this.phase === 'defeat' ? 'Your party has fallen' : 'The foes act') + '</strong><span>' + (this.phase === 'animation' ? 'Watch the next intent' : '') + '</span>';
      this.navCols = 3;
      let html = '';
      if (this.phase === 'commands') {
        html = '<div class="tb-command-grid">' +
          this._button('strike', 'Strike', 'One foe · Free', '↗') +
          this._button('arts', 'Arts', 'Skills & spells', '✦') +
          this._button('guard', 'Guard', 'Half damage · +2 MP', '◇') +
          this._button('pack', 'Pack', 'Heal, restore, revive', '+') +
          this._button('chorus', 'Bell Chorus', this.progress.bond >= 100 ? 'All foes + party heal' : 'Needs 100 bond', '✧', this.progress.bond < 100, 'tb-chorus-command') +
          this._button('flee', 'Withdraw', this.encounter.canFlee ? 'Return to the path' : 'The bell bars escape', '↳', !this.encounter.canFlee) + '</div>';
      } else if (this.phase === 'arts') {
        this.navCols = 2;
        html = '<div class="tb-art-grid">' + this._actorArts().map(a => this._button('art:' + a.key, a.title + ' · ' + a.cost + ' MP', a.scope + ' — ' + a.desc, a.icon, p.mp < a.cost || (a.key === 'mend' && !this.party.some(q => q.hp > 0 && q.hp < q.maxHp)))) .join('') + '</div><p class="tb-panel-note">' + p.mp + ' MP available. Guard restores 2 MP.</p>';
      } else if (this.phase === 'items') {
        html = '<div class="tb-item-grid">' + Object.keys(itemData).map(k => this._button('item:' + k, itemData[k].title + ' ×' + this.inventory[k], itemData[k].desc, itemData[k].icon, this.inventory[k] < 1)).join('') + '</div><p class="tb-panel-note">Choose an item, then choose its ally.</p>';
      } else if (this.phase === 'targetEnemy') {
        const e = this.enemies[this.selectedEnemy];
        const weak = e && this.pending && e.weak === this.pending.element;
        html = '<div class="tb-target-prompt"><div><span class="tb-panel-kicker">EXACT TARGET</span><strong>' + esc(e ? e.name : 'Choose a foe') + '</strong><p>' + (weak ? 'Weak point. This art is effective.' : e && e.braced && this.pending && this.pending.element !== 'pierce' ? 'Its raised shield reduces this attack.' : 'Select a foe above, or confirm this target.') + '</p></div><button class="tb-target-confirm" data-battle-action="resolveEnemy">' + esc(this.pending && this.pending.title || 'Strike') + ' <span>→</span></button></div>';
      } else if (this.phase === 'targetAlly') {
        this.navCols = this.party.length;
        html = '<div class="tb-ally-targets">' + this.party.map((q, i) => '<button class="tb-ally-target' + (i === this.selectedAlly ? ' tb-nav' : '') + '" data-battle-action="ally:' + i + '"' + (!this._validItemTarget(this.pending.item, q) ? ' disabled' : '') + '><strong>' + esc(q.name) + '</strong><span>' + (this.pending.item === 'ether' ? q.mp + ' / ' + q.maxMp + ' MP' : q.hp + ' / ' + q.maxHp + ' HP') + '</span><small>' + (this._validItemTarget(this.pending.item, q) ? itemData[this.pending.item].short : q.hp <= 0 ? 'Needs Dawn seed' : this.pending.item === 'revive' ? 'Still standing' : 'Already full') + '</small></button>').join('') + '</div><p class="tb-panel-note">Select the ally who will receive ' + esc(this.pending.title) + '.</p>';
      } else if (this.phase === 'fleeConfirm') {
        this.navCols = 2;
        html = '<div class="tb-flee-prompt"><p>Return to the path? Your wounds and used items remain.</p><div>' + this._button('stay', 'Stay', 'Continue the fight', '◇') + this._button('fleeNow', 'Withdraw', 'No reward', '↳') + '</div></div>';
      } else {
        const message = this.phase === 'victory' ? 'Your party stands together.' : this.phase === 'defeat' ? 'A new attempt waits beyond the tide.' : this.phase === 'fleeing' ? 'Your party returns to the path.' : this.actor ? this.actor.name + ' acts…' : 'The foes take their turn…';
        html = '<div class="tb-waiting"><span class="tb-wait-sigil">✧</span><strong>' + esc(message) + '</strong><p>' + (this.phase === 'animation' ? 'Your next command will follow.' : '') + '</p></div>';
      }
      this.panel.innerHTML = html;
      this._markNav();
    }

    _markNav() {
      const buttons = Array.from(this.panel.querySelectorAll('button[data-nav]'));
      if (buttons.length && (!buttons[this.navIndex] || buttons[this.navIndex].disabled)) this.navIndex = Math.max(0, buttons.findIndex(b => !b.disabled));
      buttons.forEach((button, i) => button.classList.toggle('tb-nav', i === this.navIndex && !button.disabled));
    }

    _makePortraits() {
      const E = this.E;
      this.portraits = this.party.map((p, i) => new E.Humanoid({
        build: 'chibi', size: 1, weapon: null, style: 'hd',
        hair: { style: i === 1 ? 'long' : i === 2 ? 'ponytail' : 'short' },
        hood: i === 2,
        colors: { cloth: p.color || ['#bd8751', '#8674a7', '#758765'][i % 3], hair: ['#59372c', '#ece6d2', '#4b3f32'][i % 3], skin: ['#e6b28a', '#efc7aa', '#bb8f69'][i % 3], pants: '#343943' }
      }));
    }

    _drawPortraits() {
      if (!this.portraits || !this.party) return;
      this.partyEl.querySelectorAll('canvas[data-portrait]').forEach(cv => {
        const i = Number(cv.dataset.portrait);
        const rig = this.portraits[i];
        const p = this.party[i];
        if (!rig || !p) return;
        const g = cv.getContext('2d');
        g.imageSmoothingEnabled = false;
        g.clearRect(0, 0, cv.width, cv.height);
        if (root.TideArt && typeof root.TideArt.portrait === 'function') {
          root.TideArt.portrait(g, 0, 0, p.id, 44);
          return;
        }
        rig.update(.12, { x: 0, y: 0, z: 0, facing: Math.PI / 2, pose: p.hp <= 0 ? 'down' : '' });
        rig.drawPortrait(g, 0, 2, 40, { zoom: 3.3, turn: i === 1 ? -.2 : .3, frame: false, tint: p.hp <= 0 ? '#53606d' : null });
      });
    }

    _measure(r) {
      const key = r.W + ':' + r.H;
      if (!this._layoutDirty && this._lastSize === key) return;
      this._layoutDirty = false;
      this._lastSize = key;
      const sc = this.game.screen;
      const rect = this.stage.getBoundingClientRect();
      const a = sc.clientToScreen(rect.left, rect.top);
      const b = sc.clientToScreen(rect.right, rect.bottom);
      const top = a[1] - sc.iy;
      const bottom = b[1] - sc.iy;
      this.layout = { left: a[0] - sc.ix, right: b[0] - sc.ix, top, bottom, width: b[0] - a[0], height: Math.max(34, bottom - top) };
      this.layout.baseY = bottom - Math.min(13, this.layout.height * .12);
      this.positions = this.enemies.map((e, i) => {
        const cell = this.layout.width / this.enemies.length;
        const nativeH = e.type === 'boss' ? 154 : e.type === 'sentinel' ? 118 : e.type === 'bramble' ? 89 : 69;
        const nativeW = e.type === 'boss' ? 154 : e.type === 'sentinel' ? 84 : e.type === 'bramble' ? 92 : 58;
        const scale = Math.max(.25, Math.min(2.4, (this.layout.height - 17) / nativeH, cell * .74 / nativeW));
        return { x: this.layout.left + cell * (i + .5), y: this.layout.baseY, scale, height: nativeH * scale };
      });
    }

    draw(r) {
      if (!this.active) return;
      this._measure(r);
      const E = this.E;
      const px = E.px;
      const g = r.ctx;
      const W = r.W + 2;
      const H = r.H + 2;
      const t = this.settings.reducedMotion ? 0 : this.time;
      const lay = this.layout;
      const horizon = lay.top + lay.height * .25;
      const hash = n => { const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
      px.rect(g, 0, 0, W, H, '#101b2a');
      for (let i = 0; i < 8; i++) px.rect(g, 0, horizon * i / 8, W, horizon / 8 + 1, ['#101827', '#142032', '#172638', '#1a2c3d', '#1c3242', '#203949', '#254452', '#2a4a56'][i]);
      const moonX = W * .76;
      const moonY = Math.max(18, horizon * .52);
      px.blend(g, .13, 'add', () => px.disc(g, moonX, moonY, 26, '#b0d0c3'));
      px.disc(g, moonX, moonY, 13, '#9eb9af');
      px.disc(g, moonX + 5, moonY - 3, 11, '#253d4a');
      for (let i = 0; i < 21; i++) {
        const x = hash(i + 2) * W;
        const y = hash(i + 55) * Math.max(1, horizon - 5);
        if (hash(i + 700) > .3) px.dot(g, x, y, i % 3 ? '#627b80' : '#a1b9ac');
      }
      // Broken walls rise behind the water.
      for (let i = 0; i < 9; i++) {
        const x = i * W / 8 - 12;
        const h = 20 + hash(i + 90) * 32;
        px.rect(g, x, horizon - h, 17 + hash(i + 7) * 18, h + 9, '#1a2c39');
        px.rect(g, x + 2, horizon - h, 3, h, '#2c414b');
        for (let j = 1; j < 4; j++) px.line(g, x + 2, horizon - h + j * 12, x + 26, horizon - h + j * 12, '#111f2b');
      }
      px.rect(g, 0, horizon, W, H - horizon, '#233f47');
      for (let i = 0; i < 28; i++) {
        const y = horizon + (i + .2) / 28 * Math.max(1, H - horizon);
        const x = hash(i + 127) * W;
        const wave = Math.sin(t * .7 + i * 1.7) * 4;
        px.rect(g, x + wave, y, 8 + hash(i + 90) * 32, i % 5 === 0 ? 2 : 1, i % 3 ? '#31525a' : '#49676a');
        if (i % 4 === 0) px.rect(g, x + wave + 5, y + 3, 13, 1, '#182f3a');
      }
      const pillar = (x, width, height) => {
        const base = lay.baseY + 13;
        px.poly(g, [[x, base], [x, base - height], [x + 4, base - height - 5], [x + width - 3, base - height - 5], [x + width, base - height], [x + width, base]], '#202f36');
        px.rect(g, x + 3, base - height + 2, Math.max(1, width * .24), height - 2, '#3c5154');
        px.rect(g, x + width - 4, base - height, 4, height, '#152831');
        for (let y = base - 9; y > base - height; y -= 14) px.line(g, x + 2, y, x + width - 2, y, '#132932');
        px.rect(g, x - 3, base - 4, width + 6, 6, '#1a3038');
        px.rect(g, x - 3, base - 4, width + 6, 1, '#4f6260');
      };
      pillar(-3, 20, Math.min(100, lay.height + 25));
      pillar(W - 18, 21, Math.min(116, lay.height + 39));

      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i];
        const p = this.positions[i];
        if (!p) continue;
        const radius = (e.type === 'boss' ? 46 : 31) * p.scale;
        const depth = Math.max(5, radius * .24);
        px.ell(g, p.x, p.y + 5, radius + 8, depth + 3, '#182e37');
        const stones = [[p.x - radius, p.y - 1], [p.x - radius * .68, p.y - depth], [p.x + radius * .7, p.y - depth], [p.x + radius, p.y], [p.x + radius * .73, p.y + depth], [p.x - radius * .74, p.y + depth]];
        px.poly(g, stones.map(q => [q[0], q[1] + 4]), '#172a31');
        px.poly(g, stones, '#4a6260');
        px.line(g, p.x - radius * .74, p.y + depth, p.x + radius * .73, p.y + depth, '#718078');
        px.line(g, p.x - radius * .3, p.y - depth + 1, p.x - radius * .1, p.y + depth - 1, '#30494c');
        px.line(g, p.x + radius * .36, p.y - depth + 1, p.x + radius * .23, p.y + depth - 1, '#30494c');
        if (e.hp <= 0 && this.time - e.deadAt > .7) continue;
        const selected = this.phase === 'targetEnemy' && this.selectedEnemy === i;
        if (selected) {
          px.blend(g, .38, 'add', () => px.ell(g, p.x, p.y, radius * .84, depth * .87, '#b59d61'));
          px.line(g, p.x - radius * .62, p.y + depth + 4, p.x + radius * .62, p.y + depth + 4, '#e4c480');
        }
        let x = p.x;
        let y = p.y - 2;
        if (!this.settings.reducedMotion && e.hit > 0) x += Math.sin(e.hit * 75) * e.hit * 9;
        if (!this.settings.reducedMotion && e.lastAttackAt !== undefined && this.time - e.lastAttackAt < .35) y += Math.sin((this.time - e.lastAttackAt) / .35 * Math.PI) * 7;
        g.save();
        if (e.hp <= 0) g.globalAlpha = clamp(1 - (this.time - e.deadAt) / .7, 0, 1);
        if (root.TideArt && typeof root.TideArt.enemy === 'function') root.TideArt.enemy(g, x, y, e.type, t, p.scale);
        else this._fallbackEnemy(g, x, y, e.type, t, p.scale);
        g.restore();
        px.reset(g);
        if (selected) {
          const ay = Math.max(lay.top + 4, p.y - p.height - 7) + (this.settings.reducedMotion ? 0 : Math.sin(t * 5) * 1.5);
          px.poly(g, [[p.x - 4, ay], [p.x + 4, ay], [p.x, ay + 5]], '#f1d394');
        }
        if (e.braced && e.hp > 0) {
          px.polyDither(g, [[p.x - 12 * p.scale, y - 35 * p.scale], [p.x, y - 41 * p.scale], [p.x + 12 * p.scale, y - 35 * p.scale], [p.x + 10 * p.scale, y - 14 * p.scale], [p.x, y - 6 * p.scale], [p.x - 10 * p.scale, y - 14 * p.scale]], '#a7c6c8', .17);
        }
      }

      for (const effect of this.effects) {
        const p = this.positions[effect.index];
        if (!p) continue;
        const u = effect.age / effect.life;
        if (effect.kind === 'enemy') {
          const lift = this.settings.reducedMotion ? 0 : Math.sin(Math.min(1, effect.age / .55) * Math.PI * .7) * 12;
          const y = p.y - p.height * .6 - lift;
          const scale = r.W > 380 ? 2 : 1;
          g.save();
          g.globalAlpha = Math.min(1, (effect.life - effect.age) * 4);
          E.font.text(g, effect.text, p.x + 10, y, effect.color, { align: 'center', scale, outline: '#12222e' });
          if (effect.label) E.font.text(g, effect.label, p.x + 10, y - 10, '#e7c681', { align: 'center', font: 'tiny', outline: '#12222e' });
          g.restore();
          px.reset(g);
        } else if (effect.kind === 'impact') {
          const c = effect.element === 'water' ? '#93d2e5' : effect.element === 'fire' ? '#f0b16d' : effect.element === 'chorus' ? '#d8e8b5' : '#eee1b1';
          const cy = p.y - p.height * .5;
          const rad = (6 + u * 24) * p.scale;
          for (let j = 0; j < 8; j++) {
            const a = j * Math.PI / 4 + (effect.element === 'water' ? u * .8 : 0);
            const x = p.x + Math.cos(a) * rad;
            const y = cy + Math.sin(a) * rad * .65;
            px.blend(g, Math.max(0, 1 - u), 'add', () => {
              px.line(g, x, y, x + Math.cos(a) * (5 - u * 4), y + Math.sin(a) * (5 - u * 4), c, u < .35 ? 2 : 1);
            });
          }
          if (u < .3) px.blend(g, .5 * (1 - u * 3), 'add', () => px.disc(g, p.x, cy, 5 * p.scale, '#fff3d1'));
        }
      }
      if (this._chorusAt !== undefined && this.time - this._chorusAt < 1) {
        const u = this.time - this._chorusAt;
        const radius = u * W * .7;
        px.blend(g, (1 - u) * .4, 'add', () => {
          for (let k = 0; k < 36; k++) {
            const a = k / 36 * Math.PI * 2;
            px.disc(g, W / 2 + Math.cos(a) * radius, lay.baseY - 20 + Math.sin(a) * radius * .35, 1, '#dbe7b5');
          }
        });
      }
      if (!this.settings.reducedMotion && this._enemyFlashAt !== undefined) {
        const age = this.time - this._enemyFlashAt;
        if (age < .22) px.blend(g, (1 - age / .22) * (this._enemyFlashHeavy ? .13 : .06), 'normal', () => px.rect(g, 0, 0, W, H, '#d79777'));
      }
    }

    _fallbackEnemy(g, x, y, type, t, s) {
      const px = this.E.px;
      const boss = type === 'boss';
      const h = (boss ? 72 : 35) * s;
      const w = (boss ? 27 : 17) * s;
      const c = type === 'wisp' ? '#97cad1' : type === 'bramble' ? '#87996a' : '#788f94';
      px.ell(g, x, y - h * .48, w, h * .45, '#192e3a');
      px.ell(g, x - s, y - h * .5, w - 2 * s, h * .42, c);
      px.disc(g, x - w * .25, y - h * .68, Math.max(1, 2 * s), '#e8d498');
      px.disc(g, x + w * .25, y - h * .68, Math.max(1, 2 * s), '#e8d498');
      px.rect(g, x - w * .3, y - h * .43, w * .6, 3 * s, '#233542');
    }
  }

  root.TideBattle = TideBattle;
})(typeof window !== 'undefined' ? window : globalThis);
