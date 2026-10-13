/* Wayfarer: The Glass Tide — accessible, responsive campaign menus.
 * The host owns state changes. This module only draws menus and sends commands.
 */
(function (root) {
  'use strict';
  const D = root.WayfarerData, Rules = root.WayfarerRules;
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const whole = v => Math.max(0, Math.ceil(Number(v) || 0));
  const material = key => D.materialNames[key] || key;
  const time = seconds => { const m = Math.floor((seconds || 0) / 60); return m >= 60 ? Math.floor(m / 60) + 'h ' + m % 60 + 'm' : m + 'm ' + Math.floor((seconds || 0) % 60) + 's'; };
  const button = (label, command, value, css = 'small-button', disabled = false, attrs = '') =>
    '<button type="button" class="' + css + '" data-nav data-menu-command="' + esc(command) + '"' + (value === undefined ? '' : ' data-menu-value="' + esc(JSON.stringify(value)) + '"') + (disabled ? ' disabled' : '') + ' ' + attrs + '>' + esc(label) + '</button>';
  const tabButton = (label, kind, selected = false) => '<button type="button" data-nav data-menu-tab="' + esc(kind) + '" class="' + (selected ? 'selected' : '') + '"' + (selected ? ' aria-current="page"' : '') + '>' + esc(label) + '</button>';
  const card = (title, copy) => '<section class="info-card"><h3>' + esc(title) + '</h3><div style="font-size:12px;line-height:1.7;color:#a9c0b6">' + copy + '</div></section>';
  const line = (label, value) => '<div class="stat-line"><span>' + esc(label) + '</span><strong>' + esc(value) + '</strong></div>';
  const summaryStat = (value, label) => '<div class="result-stat"><strong>' + esc(value) + '</strong><span>' + esc(label) + '</span></div>';
  const TITLES = {journal:'Journey journal',party:'Your companions',craft:'Field workshop',settings:'Make yourself at home',guide:'How to play',credits:'About the journey',map:'Area map',world:'The Windward Reach',puzzle:'The Sky Relay',ending:'The tide is quiet',defeat:'A light still waits', 'new-confirm':'Begin a new journey?'};
  const MAJOR_LANDMARKS = ['coast','refuge','spire','westBeacon','eastBeacon','waycamp'];
  const exploredCells = s => new Set((s.world?.explored||[]).filter(n=>Number.isInteger(n)&&n>=0&&n<192));
  const charted = s => Math.floor(exploredCells(s).size/192*100);
  const worldTab = () => '<button type="button" class="small-button gold" data-nav data-menu-tab="world">Open world map</button>';
  const bossDown = (s,o,z) => (o.bossId==='loom'||o.id==='loom'||z?.id==='spire') ? !!s.flags.loomDefeated : !!s.flags.bossDefeated;
  const NOTES = [{name:'Leaf',symbol:'♧'},{name:'Sun',symbol:'☀'},{name:'Star',symbol:'✦'}];
  const BONDS = {
    sera: {
      title:'Sera · The light we carry', place:'Speak with Sera beside the quay bench.',
      shelter:{name:'A place of shelter',effect:'Once per battle, Sera restores 40 HP to the party when an ally falls below 25% health.',ending:'Sera keeps a lantern ready for the next lost traveller.'},
      courage:{name:'The courage to leave',effect:'Your bond adds 10% to all party damage.',ending:'Sera chooses to walk the next unknown road with you.'}
    },
    orren: {
      title:'Orren · More than a survey', place:'Speak with Orren at the aqueduct survey camp.',
      trust:{name:'A place among friends',effect:'Start each battle with 25 extra Resonance.',ending:'Orren follows your lead. A place among friends is enough.'},
      truth:{name:'A truth to share',effect:'Each boss core stays exposed for 7 seconds instead of 5.',ending:'Orren begins a new survey. This time, every finding will be shared.'}
    }
  };

  class WayfarerUI {
    constructor(api) {
      if (!api || typeof api.getState !== 'function' || typeof api.onCommand !== 'function') throw new Error('WayfarerUI needs campaign state and command handlers.');
      this.api = api;
      this.modal = document.getElementById('modal');
      this.panel = document.getElementById('modal-panel');
      if (!this.modal || !this.panel) throw new Error('The game menu elements are missing.');
      this._kind = null; this.options = {}; this._previousFocus = null; this._lastSignature = ''; this._busy = false;
      this.panel.setAttribute('tabindex', '-1');
      this._onClick = e => {
        const target = e.target && e.target.closest ? e.target.closest('[data-menu-command],[data-menu-tab]') : null;
        if (!target || !this.panel.contains(target) || target.disabled || this._busy) return;
        e.preventDefault(); e.stopPropagation();
        if (target.dataset.menuTab) { this.open(target.dataset.menuTab); return; }
        let value;
        try { value = target.hasAttribute('data-menu-value') ? JSON.parse(target.dataset.menuValue) : undefined; }
        catch (_) { value = target.dataset.menuValue; }
        const kind = this.kind;
        try {
          const result = this.api.onCommand(target.dataset.menuCommand, value);
          if (result && typeof result.then === 'function') {
            this._busy = true;
            Promise.resolve(result).finally(() => { this._busy = false; if (this.isOpen && this.kind === kind) this.refresh(); });
          } else if (this.isOpen && this.kind === kind) this.refresh();
        } catch (error) { this._busy = false; throw error; }
      };
      this._onTab = e => {
        if (!this.isOpen || e.key !== 'Tab') return;
        const list = Array.from(this.panel.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled)')).filter(el => !el.closest('[hidden]'));
        if (!list.length) { e.preventDefault(); this.panel.focus(); return; }
        const current = list.indexOf(document.activeElement), next = e.shiftKey ? (current <= 0 ? list.length - 1 : current - 1) : (current + 1) % list.length;
        e.preventDefault(); e.stopPropagation(); list[next].focus();
      };
      this.panel.addEventListener('click', this._onClick);
      this.panel.addEventListener('keydown', this._onTab);
    }
    get kind() { return this._kind; }
    get isOpen() { return this._kind !== null && !this.modal.hidden; }
    open(kind, options = {}) {
      if (!TITLES[kind]) throw new Error('Unknown game menu: ' + kind);
      if (!this.isOpen) this._previousFocus = document.activeElement;
      this._kind = kind; this.options = options || {}; this._lastSignature = '';
      this.modal.hidden = false;
      this.modal.setAttribute('aria-label', TITLES[kind]);
      this.modal.setAttribute('aria-labelledby', 'menu-title');
      this.panel.scrollTop = 0;
      this.refresh();
      const initial = this.panel.querySelector('[data-initial-focus]:not(:disabled)') || this.panel.querySelector('[data-nav]:not(:disabled)');
      if (initial) initial.focus({preventScroll:true}); else this.panel.focus({preventScroll:true});
      return this;
    }
    close() {
      this._kind = null; this.options = {}; this._lastSignature = ''; this.modal.hidden = true; this._busy = false;
      const prior = this._previousFocus;
      if (prior && prior.isConnected && !prior.closest('[hidden]')) prior.focus({preventScroll:true});
      else { const screen = document.getElementById('screen'); if (screen) screen.focus({preventScroll:true}); }
      return this;
    }
    refresh() {
      if (!this.isOpen) return this;
      const s = this.api.getState(), z = this.api.getZone ? this.api.getZone() : D.zones[s.zone];
      const battle = this.api.isBattle ? !!this.api.isBattle() : false;
      const signature = JSON.stringify([this.kind,s,this.options,z && z.id,battle,!!document.fullscreenElement,document.body.className]);
      if (signature === this._lastSignature) return this;
      this._lastSignature = signature;
      const scroll = this.panel.scrollTop, active = document.activeElement;
      const focus = active && this.panel.contains(active) ? {command:active.dataset.menuCommand,value:active.dataset.menuValue,tab:active.dataset.menuTab,index:Array.from(this.panel.querySelectorAll('[data-nav]')).filter(b=>!b.disabled).indexOf(active)} : null;
      const titleMode = this.api.getMode && this.api.getMode() === 'title';
      const special = ['ending','defeat','new-confirm','puzzle'].includes(this.kind);
      const chapterTwo=!!s.flags.chapterTwoStarted;
      const kicker = this.kind === 'craft' ? 'MAKE SOMETHING USEFUL' : this.kind === 'puzzle' ? 'THREE NOTES FOR A SLEEPING SEA' : this.kind === 'credits' ? 'WAYFARER · THE GLASS TIDE' : this.kind === 'defeat' ? 'THE JOURNEY IS NOT OVER' : this.kind === 'ending' ? (s.flags.chapterTwoComplete?'CHAPTER II COMPLETE':'CHAPTER I COMPLETE') : chapterTwo ? 'CHAPTER II · A SKY WORTH SHARING' : 'CHAPTER I · THE TIDE THAT REMEMBERS';
      const heading=this.kind==='ending'&&s.flags.chapterTwoComplete?'The sky roads are open':TITLES[this.kind];
      const close = !['ending','defeat','new-confirm'].includes(this.kind) ? button('×','resume',undefined,'close',false,'aria-label="Close menu"') : '';
      let html = '<header class="modal-heading"><div><span class="overline">' + kicker + '</span><h2 id="menu-title">' + esc(heading) + '</h2></div>' + close + '</header>';
      if (!special) {
        const tabs = titleMode ? [['How to play','guide'],['Settings','settings'],['About','credits']] : [['Journal','journal'],['Party','party'],['Workshop','craft'],['Map','map'],['Settings','settings'],['Guide','guide']];
        if(!titleMode&&chapterTwo)tabs.splice(4,0,['World','world']);
        html += '<nav class="menu-tabs" aria-label="Game menu">' + tabs.map(([name,kind])=>tabButton(name,kind,this.kind===kind)).join('') + '</nav>';
      }
      html += this._body(s,z,battle);
      if (!special) {
        const checkpoint = D.zones[s.checkpoint && s.checkpoint.zone] || D.zones.quay;
        const note = titleMode ? 'KEYBOARD · TOUCH · CONTROLLER' : 'CHECKPOINT · ' + checkpoint.name.toUpperCase();
        html += '<footer class="menu-footer"><span>' + esc(note) + '</span><div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">' + (!titleMode && battle ? button('Leave this fight','retreat',undefined,'small-button danger') : '') + (!titleMode ? button('Title screen','title') : '') + button(titleMode?'Back':'Resume journey','resume',undefined,'small-button gold') + '</div></footer>';
      }
      this.panel.innerHTML = html;
      this.panel.querySelectorAll('[data-portrait]').forEach(c => { if (root.WayfarerArt) root.WayfarerArt.portrait(c,c.dataset.portrait); });
      if (this.kind === 'world'||(this.kind==='map'&&z?.id==='overworld')) this._drawWorldMap(s,D.zones.overworld);
      else if (this.kind === 'map') this._drawMap(s,z);
      this.panel.scrollTop = scroll;
      if (focus) {
        const match = Array.from(this.panel.querySelectorAll('[data-menu-command],[data-menu-tab]')).find(b=>!b.disabled && b.dataset.menuCommand===focus.command && b.dataset.menuValue===focus.value && b.dataset.menuTab===focus.tab);
        const nav = Array.from(this.panel.querySelectorAll('[data-nav]')).filter(b=>!b.disabled);
        const fallback = focus.index >= 0 ? nav[Math.min(focus.index,nav.length-1)] : null;
        if (match || fallback) (match || fallback).focus({preventScroll:true});
      }
      return this;
    }
    _body(s,z,battle) {
      switch (this.kind) {
        case 'journal': return this._journal(s);
        case 'party': return this._party(s);
        case 'craft': return this._craft(s,battle);
        case 'settings': return this._settings(s);
        case 'guide': return this._guide(s);
        case 'credits': return this._credits();
        case 'map': return this._map(s,z,battle);
        case 'world': return this._world(s,D.zones.overworld,battle);
        case 'puzzle': return this._puzzle(s);
        case 'ending': return this._ending(s);
        case 'defeat': return this._defeat(s);
        case 'new-confirm': return this._newConfirm(s);
        default: return '';
      }
    }
    _supplies(s,consumables=false) {
      const keys = consumables ? ['herb','ore','shard','tonic','tea'] : ['herb','ore','shard'];
      return '<div class="supply-bar" aria-label="Supplies">' + keys.map(k=>'<span>'+esc(material(k))+' <b>'+whole(s.inventory[k])+'</b></span>').join('') + '</div>';
    }
    _bond(s,id,ending=false) {
      const data = BONDS[id], chosen = data[s.flags[id+'Bond']];
      if (ending) return card(data.title,chosen?esc(chosen.ending):esc(data.place));
      return card(data.title,chosen?'<strong style="color:var(--gold)">'+esc(chosen.name)+'</strong><br>'+esc(chosen.effect):esc(data.place)+'<br><span style="color:#829e97">This quiet moment is still waiting.</span>');
    }
    _equipment(s) {
      return '<section class="info-card"><h3>Party equipment</h3>' + line('Prism edge',s.equipment.edge?'Equipped · +'+(s.party[0].rank>0?6:4)+' attack':'Not made') + line('Tideward charm',s.equipment.ward?'Equipped · +25 maximum HP':'Not made') + (s.flags.chapterTwoStarted||s.equipment.focus?line('Stormglass focus',s.equipment.focus?'Equipped · +3 attack, +15 energy':'Not made'):'') + '<p style="margin-top:10px">Each crafted tool improves the whole party.</p></section>';
    }
    _journal(s) {
      const f=s.flags, relays=f.relays || [], beacons=f.windBeacons||[], second=!!f.chapterTwoStarted, steps=second?[
        {done:f.maraMet,current:!f.maraMet,title:'Meet Mara at Windfall Refuge',hint:'The Windward Reach · follow the road to the warm windows'},
        {done:beacons.includes('windWest'),current:f.maraMet&&!beacons.includes('windWest'),title:'Align the western wind beacon',hint:'The Windward Reach · clear the western guardians'},
        {done:beacons.includes('windEast'),current:f.maraMet&&!beacons.includes('windEast'),title:'Align the eastern wind beacon',hint:'The Windward Reach · clear the eastern guardians'},
        {done:f.loomDefeated,current:f.maraMet&&beacons.length>=2&&!f.loomDefeated,title:'Stop the Tempest Loom',hint:'Stormglass Spire · clear the approach and rest at the last lantern'},
        {done:f.chapterTwoComplete,current:f.loomDefeated&&!f.chapterTwoComplete,title:'Restore the Skyheart',hint:'Stormglass Spire · beyond the Loom'}
      ]:[
        {done:f.quest,current:!f.quest,title:'Speak with Keeper Ada',hint:'Larkspur Quay · village square'},
        {done:relays.includes('reedRelay'),current:f.quest&&!relays.includes('reedRelay'),title:'Restore the Reed Relay',hint:'Glassfen · clear the reed guardians'},
        {done:relays.includes('stoneRelay'),current:f.quest&&!relays.includes('stoneRelay'),title:'Restore the Stone Relay',hint:'Sunken Aqueduct · west court'},
        {done:relays.includes('skyRelay'),current:f.quest&&!relays.includes('skyRelay'),title:'Tune the Sky Relay',hint:'Sunken Aqueduct · east court'},
        {done:f.bossDefeated,current:relays.length>=3&&!f.bossDefeated,title:'Defeat the Glass Warden',hint:'The Tide Observatory · follow the upper road'},
        {done:f.complete,current:f.bossDefeated&&!f.complete,title:'Restore the Heart of the Tide',hint:'The Tide Observatory · beyond the Warden'}
      ];
      const nextChapter=f.complete&&!second?card('A new signal','A second signal reaches the coast. Take your companions and supplies into the Windward Reach.<br><br>'+button('Follow the new signal','begin-chapter-two',undefined,'small-button gold')):'';
      const world=second?card('Your chart of the Reach',line('Charted ground',charted(s)+'%')+line('World seed',String((s.world?.seed||0)>>>0))+'<p style="margin:10px 0">The same seed keeps the same roads. Walk to reveal nearby ground and discover places.</p>'+worldTab()):'';
      return '<div class="menu-grid"><section><p class="section-label">THE ROAD AHEAD</p><h3 class="quest-title">'+(second?'A Sky Worth Sharing':'A sea that will not sleep')+'</h3><p class="body-copy">'+esc(Rules.objective(s))+'</p><div class="quest-list">'+steps.map(q=>'<div class="quest-row '+(q.done?'done':q.current?'current':'')+'"><span aria-hidden="true">'+(q.done?'✓':q.current?'◇':'·')+'</span><div>'+esc(q.title)+'<small>'+esc(q.hint)+'</small></div></div>').join('')+'</div>'+nextChapter+'<p class="section-label" style="margin-top:26px">QUIET MOMENTS</p>'+this._bond(s,'sera')+this._bond(s,'orren')+'</section><aside>'+card('A shared journey',line('Party level',s.level)+line('Experience',s.level>=10?'Maximum level':whole(s.xp)+' / '+Rules.nextXp(s))+line('Skill points',s.sp)+line('Journey time',time(s.stats.seconds))+line('Encounters cleared',(f.cleared||[]).length)+(second?line('Chapter I','Complete'):'')) +world+this._equipment(s)+card('Keep a lantern lit','Rest at a camp lantern to restore health and energy. It also sets your return checkpoint.')+'</aside></div>';
    }
    _party(s) {
      const tonicAmount=70+s.party[1].rank*6,fullHp=s.party.every((p,i)=>p.hp>=Rules.maxHp(s,i)),fullMp=s.party.every((p,i)=>p.mp>=Rules.maxMp(s,i)),cap=Rules.rankCap(s);
      const skillNotes=[
        'Each rank adds 2 attack. Rank 1 also adds 2 to the party’s Prism edge bonus.',
        'Each rank adds 2 attack and 6 tonic healing. Rank 2 brews two tonics for the same cost.',
        'Each rank adds 2 attack and 8 maximum energy.'
      ];
      return '<div class="supply-bar"><span>Shared level <b>'+s.level+'</b></span><span>Experience <b>'+(s.level>=10?'MAX':whole(s.xp)+' / '+Rules.nextXp(s))+'</b></span><span>Skill points <b>'+s.sp+'</b></span><span>Resonance <b>'+whole(s.link)+'%</b></span></div><div class="party-menu-grid">'+D.heroes.map((h,i)=>{
        const p=s.party[i],hp=Rules.maxHp(s,i),mp=Rules.maxMp(s,i),rank=clamp(p.rank,0,cap),isLeader=i===s.leader;
        return '<section class="hero-sheet '+(isLeader?'active':'')+'" style="--hero:'+esc(h.color)+'"><header class="hero-sheet-head"><canvas width="48" height="48" data-portrait="'+esc(h.id)+'" aria-label="'+esc(h.name)+' portrait"></canvas><div><h3>'+esc(h.name)+'</h3><span class="role">'+esc(h.role.toUpperCase())+'</span></div></header><div style="grid-column:1 / -1">'+line('Health',whole(p.hp)+' / '+hp)+'<div class="hp-track" role="progressbar" aria-label="'+esc(h.name)+' health" aria-valuenow="'+whole(p.hp)+'" aria-valuemin="0" aria-valuemax="'+hp+'"><i style="width:'+clamp(p.hp/hp*100,0,100)+'%"></i></div>'+line('Energy',whole(p.mp)+' / '+mp)+'<div class="mp-track" role="progressbar" aria-label="'+esc(h.name)+' energy" aria-valuenow="'+whole(p.mp)+'" aria-valuemin="0" aria-valuemax="'+mp+'"><i style="width:'+clamp(p.mp/mp*100,0,100)+'%"></i></div>'+line('Attack',Rules.attack(s,i))+line(h.art,h.cost+' energy')+'</div><p>'+esc(h.desc)+'</p><section class="skill-box"><h4>'+esc(h.skill)+' · rank '+rank+' / '+cap+'</h4><small>'+esc(skillNotes[i])+'</small><div class="skill-dots" aria-label="Rank '+rank+' of '+cap+'">'+('◆'.repeat(rank)+'◇'.repeat(cap-rank))+'</div>'+button(rank>=cap?'Fully learned':s.sp<2?'Learn · need 2 SP':'Learn next rank · 2 SP','upgrade',i,'small-button gold',rank>=cap||s.sp<2)+'</section>'+button(isLeader?'Current leader':p.hp<=0?'Fallen · use a tonic':'Make leader','leader',i,'small-button',isLeader||p.hp<=0)+'</section>';
      }).join('')+'</div><div class="guide-notes">'+card('Sunleaf tonic · '+whole(s.inventory.tonic)+' in your pack','Restore '+tonicAmount+' HP to each standing ally. Revive a fallen ally with 35 HP.<br><br>'+button('Use tonic','use','tonic','small-button gold',!s.inventory.tonic||fullHp))+card('Starlight tea · '+whole(s.inventory.tea)+' in your pack','Restore 40 energy to each ally.<br><br>'+button('Drink tea','use','tea','small-button gold',!s.inventory.tea||fullMp))+'</div>'+this._equipment(s);
    }
    _craft(s,battle=false) {
      return this._supplies(s,true)+'<p class="body-copy">'+(battle?'Craft after the battle. You can review recipes and costs now.':'Choose a recipe. Equipment helps every companion. Supplies are used only when you make an item.')+'</p><div class="recipe-grid">'+D.recipes.map(r=>{
        const check=Rules.canCraft(s,r.id),made=!!(r.unique&&s.equipment[r.id]);
        const count=r.id==='tonic'&&s.party[1].rank>=2?2:1;
        let description=r.description;
        if(r.id==='tonic')description='Restore '+(70+s.party[1].rank*6)+' HP to each standing ally. Revive a fallen ally with 35 HP.';
        if(r.id==='edge')description='All party attacks deal '+(s.party[0].rank>0?6:4)+' more damage.'+(s.party[0].rank>0?' Bladecraft is included.':' Learn Bladecraft to add 2 more.');
        const result=r.unique?'Result: '+r.name+' · equipped for the party':'Result: '+count+' × '+r.name;
        const costs=Object.entries(r.cost).map(([key,n])=>'<span class="'+((s.inventory[key]||0)<n?'missing':'')+'">'+esc(material(key))+' '+whole(s.inventory[key])+' / '+n+'</span>').join('');
        return '<article class="recipe-card"><span class="tag">'+esc(r.tag)+'</span><h3>'+esc(r.name)+'</h3><p>'+esc(description)+'</p><p style="min-height:0;color:var(--gold);font-size:11px">'+esc(result)+'</p>'+(r.id==='tonic'&&count===2?'<p style="min-height:0;font-size:10px;color:var(--aqua)">Herblore rank 2: double yield.</p>':'')+'<div class="recipe-cost" aria-label="Materials owned and required">'+costs+'</div>'+button(made?'Already equipped':battle?'Craft after the battle':check.ok?'Make '+(count>1?count+' tonics':r.name):check.reason,'craft',r.id,'small-button '+(check.ok&&!battle?'gold':''),battle||!check.ok)+'</article>';
      }).join('')+'</div>';
    }
    _settings(s) {
      const o=s.options,fs=!!(document.fullscreenElement||document.webkitFullscreenElement),gameMode=document.body.classList.contains('wayfarer-game-mode')||document.body.classList.contains('game-mode');
      const option=(title,help,controls)=>'<div class="option-row"><div><label>'+esc(title)+'</label><small>'+esc(help)+'</small></div><div style="display:flex;align-items:center;gap:7px;flex-shrink:0">'+controls+'</div></div>';
      const toggle=(key,label,value)=>button(label,'option',{key,value},'',false,'aria-label="'+esc(key+': '+label)+'"');
      const choices=['balanced','focus','guard'], tactics={balanced:'Balanced',focus:'Focus',guard:'Guard'}, nextTactics=choices[(choices.indexOf(o.tactics)+1)%choices.length];
      const volume=clamp(Number(o.volume),0,1),zoom=clamp(Number(o.zoom)||1,.75,1.5);
      const stepper=(key,value,min,max,step,label)=>button('−','option',{key,value:Math.max(min,Math.round((value-step)*100)/100)},'',value<=min,'aria-label="Decrease '+esc(key)+'"')+'<span style="min-width:36px;text-align:center;font-size:11px;color:var(--gold)">'+esc(label)+'</span>'+button('+','option',{key,value:Math.min(max,Math.round((value+step)*100)/100)},'',value>=max,'aria-label="Increase '+esc(key)+'"');
      return '<div class="options-grid">'+
        option('Difficulty',o.difficulty==='story'?'Story gives the party more room to recover.':'Normal uses the standard encounter balance.',toggle('difficulty',o.difficulty==='story'?'Story':'Normal',o.difficulty==='story'?'normal':'story'))+
        option('Automatic basic attacks','Attack nearby foes while you move. Touch play always uses this aid.',toggle('autoAttack',o.autoAttack?'On':'Off',!o.autoAttack))+
        option('Companion tactics',o.tactics==='focus'?'Companions focus on the leader’s nearby target.':o.tactics==='guard'?'Companions stay close. Sera heals sooner.':'Companions attack and use their arts. Sera restores health.',toggle('tactics',tactics[o.tactics]||'Balanced',nextTactics))+
        option('Music','Original music follows the current area and battle.',toggle('music',o.music?'On':'Off',!o.music))+
        option('Volume','Set the sound level.',stepper('volume',volume,0,1,.1,Math.round(volume*100)+'%'))+
        option('View size','A wider view shows more ground. Pinch also changes this setting.',stepper('zoom',zoom,.75,1.5,.125,Math.round(zoom*100)+'%'))+
        option('Reduce motion','Reduce camera movement and interface motion.',toggle('reduceMotion',o.reduceMotion?'On':'Off',!o.reduceMotion))+
        option('Full screen',fs?'The game fills the screen.':'Use full screen where the browser supports it.',toggle('fullscreen',fs?'Exit':'Enter',!fs))+
        option('Phone game mode','Keep input in the game and request a screen wake lock where supported.',toggle('gameMode',gameMode?'On':'Enter',!gameMode))+
        '</div><p class="body-copy" style="margin-top:20px">Game mode blocks page scrolling and browser zoom on the play surface. System navigation gestures can still leave the game.</p>';
    }
    _guide(s) {
      const row=(action,key,pad,touch)=>'<tr><td>'+action+'</td><td>'+key+'</td><td>'+pad+'</td><td>'+touch+'</td></tr>';
      return '<p class="guide-intro">Lead three companions from the coast to the open sky. Restore the tide in Chapter I. Then chart the Windward Reach, align its beacons, and stop the Tempest Loom in Chapter II.</p><table class="control-table"><thead><tr><th scope="col">ACTION</th><th scope="col">KEYBOARD / MOUSE</th><th scope="col">PS5 CONTROLLER</th><th scope="col">TOUCH</th></tr></thead><tbody>'+
        row('Move','WASD / arrows','Left stick / D-pad','Drag on free ground')+
        row('Attack','J / Space / left click','Cross × in battle','Automatic in range')+
        row('Character art','K / right click','Square □','Tap the art button')+
        row('Evade','L / Shift','Circle ○','Tap »')+
        row('Interact','E / Enter','Cross × in the field','Tap the context button')+
        row('Change leader','Q','L1','Tap a portrait')+
        row('Convergence','R','Triangle △','Tap Convergence')+
        row('Use a tonic','H','R1','Tap the tonic button')+
        row('Journal / pause','Esc / Tab','Options','Tap ☰')+
        row('Maps','M / Journal → World','Journal → Map / World','Tap ⌖ / World tab')+
        row('Full screen','F','Settings → Full screen','Tap ⛶')+
        '</tbody></table><div class="guide-notes">'+
        card('A party, together','Control one companion at a time. The others follow and fight with you. Change leaders to use another art. Open the journal to pause and plan.')+
        card('Read the danger','Enemy attacks mark the ground before they strike. Move clear. Each boss briefly stabilises its guard between breaks. When that timer ends, use arts to expose its core.')+
        card('Three different arts','Iona’s Tidecut hits nearby foes or sends a distant arc. Sera’s Sunmend heals the party. Orren’s Prism pulse breaks armour and stops foes briefly.')+
        card('Build Resonance','Fight together to fill the Resonance meter. At 100%, use Convergence for a powerful party attack. Keep energy ready for the next opening.')+
        card('Make the next step easier','Collect sunleaf, copper, and glass shards. Make tonics, tea, and equipment. Spend shared skill points in the Party menu. Each rank costs 2 SP.')+
        card('Take the quiet moments','Speak with Sera at the quay bench. Speak with Orren at the survey camp. Each choice adds a useful party benefit and changes their closing words.')+
        card('Phone game mode','Drag from any free point on the play surface. No fixed stick is needed. Move and press an action with separate fingers. Pinch with two fingers to change the view. Basic attacks are automatic in range.')+
        card('Stay in the game','Enter game mode from Settings. Supported browsers can use full screen and a screen wake lock. Page scrolling is blocked on the play surface. Menus can scroll. System gestures cannot be fully blocked.')+
        card('Controller setup','Pair a DualSense controller with your device by USB or Bluetooth. Press a button after the page opens. The browser must expose a standard gamepad mapping.')+
        card('Keep your checkpoint','Rest at a camp lantern to restore health and energy. Use the journal to check your checkpoint. A defeat lets you retry from that point.')+
        card('A Sky Worth Sharing','Complete Chapter I, then choose Follow the new signal in the ending or journal. Meet Mara at Windfall Refuge. Align both wind beacons. Clear the spire approach, rest, and face the Tempest Loom. Restore the Skyheart to finish Chapter II.')+
        card('Chart the Reach','The world map marks six major places from the start. Walk to reveal the land around you. Optional finds appear after discovery. The seed fixes the roads for this journey, and your chart is saved.')+
        card('Return to a known road','Open the World tab from any area in Chapter II. Travel buttons work at discovered travel points outside battle. The spire still needs Mara and both beacons. Nearby camp lanterns offer a safe place to prepare.')+
        card('Room to grow','Chapter II raises each skill cap to five. Make the Stormglass focus with three copper and four glass shards. It adds 3 attack and 15 maximum energy to every companion.')+
        '</div>';
    }
    _credits() {
      return '<div class="credits-copy"><p><strong style="color:var(--gold)">Wayfarer: The Glass Tide</strong> is an original party action RPG. Two chapters follow Iona, Sera, and Orren from Larkspur Quay to the Windward Reach, Windfall Refuge, and Stormglass Spire.</p><h3>A familiar spirit. A new coast.</h3><p>The design reference is the original <em>Star Ocean</em> for the Super Famicom / SNES, released in 1996. Active party battles, quiet companion scenes, item creation, and lost technology informed this game’s design.</p><p>The setting, story, character designs, portraits, environment art, encounter data, and music were made for this game. No Star Ocean art, music, dialogue, maps, or character names are used.</p><h3>Engine and technology</h3><p>Built with <a href="https://github.com/michaelcrosato/my-3d2dge" target="_blank" rel="noopener noreferrer" data-nav>my-3D2dge</a> by <strong>Michael Crosato</strong>, under the MIT License. This edition adds the campaign, menus, controls, audio score, and world art. Character motion uses the engine’s procedural rigs.</p><p>The game runs in the browser with Canvas, Web Audio, Pointer Events, and the Gamepad API. All required game assets are packaged with the game.</p><h3>Explore the project</h3><p><a href="expansion-report.html" target="_blank" rel="noopener noreferrer" data-nav>Read the expansion and verification report</a><br><a href="design-report.html" target="_blank" rel="noopener noreferrer" data-nav>Read the original design and research report</a><br><a href="wayfarer-source.zip" download data-nav>Download the complete source</a></p><h3>Research and design references</h3><p><a href="https://shrines.rpgclassics.com/snes/so1/" target="_blank" rel="noopener noreferrer" data-nav>RPGClassics · Star Ocean shrine and game guide</a><br><a href="https://en.wikipedia.org/wiki/Star_Ocean_(video_game)" target="_blank" rel="noopener noreferrer" data-nav>Star Ocean · game history and systems</a><br><a href="https://shmuplations.com/starocean/" target="_blank" rel="noopener noreferrer" data-nav>Shmuplations · 1996 developer interview</a></p><p>This independent game is not affiliated with tri-Ace or Square Enix. Star Ocean and its related names belong to their respective owners.</p><p class="engine-credit">MY-3D2DGE · MIT LICENSE · ORIGINAL CHAPTER CONTENT</p></div>';
    }
    _map(s,z,battle=false) {
      if(z.id==='overworld')return this._world(s,z,battle);
      const locations=(z.exits||[]).map(e=>{
        const gate=e.requiresRelays&&s.flags.relays.length<3?'Restore all three relays to open the gate.':e.requiresChapterOne&&!s.flags.complete?'Restore the Heart of the Tide to follow this signal.':e.requiresBeacons&&(!s.flags.maraMet||(s.flags.windBeacons||[]).length<2)?'Meet Mara and align both wind beacons.':'';
        return '<div class="quest-row"><span>↗</span><div>'+esc(D.zones[e.target]?.name||e.label)+(gate?'<small>'+esc(gate)+'</small>':'')+'</div></div>';
      }).join('');
      const route=s.flags.chapterTwoStarted?'The Windward Reach connects the coast, Windfall Refuge, two wind beacons, and Stormglass Spire. Use the World tab to see your chart and travel to known places.':'Larkspur Quay → Glassfen → Sunken Aqueduct → The Tide Observatory. Return along the same roads when you need supplies or a quiet moment.';
      return '<p class="section-label">'+esc(z.name.toUpperCase())+'</p><p class="body-copy">'+esc(Rules.objective(s))+'</p>'+(s.flags.chapterTwoStarted?'<div style="margin-bottom:16px">'+worldTab()+'</div>':'')+'<canvas class="map-canvas" id="area-map-canvas" aria-label="Map of '+esc(z.name)+'. White marks the party. Gold diamonds mark relays. Green crosses mark camp lanterns."></canvas><div class="map-key"><span><b style="color:#fff2c7">●</b> Party</span><span><b style="color:#e4be7b">◆</b> Relay</span><span><b style="color:#88d9b3">+</b> Camp</span><span><b style="color:#dbcbb3">□</b> Supplies</span><span><b style="color:#dca1ab">●</b> Companion</span><span><b style="color:#d67f72">◇</b> Encounter</span><span><b style="color:#d6e9d3">↗</b> Exit</span></div><div class="guide-notes">'+card('Paths from here','<div class="quest-list">'+locations+'</div>')+card('The route',route)+'</div>';
    }
    _world(s,z,battle=false) {
      if(!s.flags.chapterTwoStarted)return card('A signal beyond the coast','Restore the Heart of the Tide, then follow the new signal to open the world map.');
      if(!z||z.placeholder)return card('The chart is being prepared','Resume the journey to enter the Windward Reach.');
      const discovered=new Set(s.world?.discovered||[]),beacons=s.flags.windBeacons||[];
      const major=MAJOR_LANDMARKS.map(id=>(z.landmarks||[]).find(p=>p.id===id)).filter(Boolean);
      const optional=(z.landmarks||[]).filter(p=>!MAJOR_LANDMARKS.includes(p.id)&&discovered.has(p.id));
      const kindNames={coast:'Boat to Larkspur Quay',refuge:'Village and workshop',spire:'Spire and Skyheart',beacon:'Wind beacon',camp:'Camp lantern',gather:'Gathering place',chest:'Supply chest',lore:'Survey record'};
      const landmarkCard=p=>{
        const known=discovered.has(p.id),isMajor=MAJOR_LANDMARKS.includes(p.id),aligned=p.id==='westBeacon'?beacons.includes('windWest'):p.id==='eastBeacon'?beacons.includes('windEast'):false;
        const locked=p.id==='spire'&&(!s.flags.maraMet||beacons.length<2);
        const enabled=known&&!!p.fastTravel&&!battle&&!locked;
        const state=aligned?'Beacon aligned':p.id==='spire'&&s.flags.chapterTwoComplete?'Skyheart restored':known?'Discovered':'Known location · not yet visited';
        const label=!p.fastTravel?'Explore on foot':!known?'Visit to unlock travel':battle?'Travel after the battle':locked?'Meet Mara and align both beacons':'Travel here';
        return '<section class="info-card world-landmark"><h3>'+(isMajor?(MAJOR_LANDMARKS.indexOf(p.id)+1)+'. ':'')+esc(p.name)+'</h3><p>'+esc(kindNames[p.kind]||'A place in the Reach')+'</p><p class="landmark-state" style="color:'+(known?'var(--aqua)':'var(--muted)')+'">'+esc(state)+'</p>'+(isMajor?button(label,'fast-travel',p.id,'small-button'+(enabled?' gold':''),!enabled):'')+'</section>';
      };
      const legend=Object.values(z.biomes?.legend||{}).map(b=>'<span><b style="color:'+esc(b.color)+'">■</b> '+esc(b.name)+'</span>').join('');
      return '<p class="section-label">A SKY WORTH SHARING</p><p class="body-copy">'+esc(Rules.objective(s))+'</p><div class="supply-bar"><span>World seed <b>'+esc(String((s.world?.seed??z.seed??0)>>>0))+'</b></span><span>Charted ground <b>'+charted(s)+'%</b></span><span>Wind beacons <b>'+beacons.length+' / 2</b></span></div><div class="world-map-layout"><canvas class="map-canvas" id="world-map-canvas" role="img" aria-label="Chart of the Windward Reach. Numbered pins match the landmark list below. Dark ground is unexplored. A white diamond marks the party."></canvas><div class="map-key world-map-legend">'+legend+'<span><b style="color:#d2ba80">━</b> Road / bridge</span><span><b style="color:#fff2c7">◆</b> Party</span><span><b style="color:#a7ddc4">●</b> Discovered place</span><span><b style="color:#d9c59b">○</b> Known destination</span><span><b style="color:#29434b">■</b> Unexplored ground</span></div></div><p class="body-copy">Walk to chart nearby ground. The six major destinations are marked from the start. Other places appear after you find them. Travel is available at discovered travel points outside battle.</p><p class="section-label">MAJOR DESTINATIONS</p><div class="guide-notes world-landmark-grid">'+major.map(landmarkCard).join('')+'</div>'+(optional.length?'<p class="section-label" style="margin-top:22px">PLACES YOU FOUND</p><div class="guide-notes world-landmark-grid">'+optional.map(landmarkCard).join('')+'</div>':'');
    }
    _drawWorldMap(s,z) {
      const c=this.panel.querySelector('#world-map-canvas');if(!c||!z||z.placeholder)return;
      const scale=5,pad=18,tile=z.tile||16;c.width=z.w*scale+pad*2;c.height=z.h*scale+pad*2;
      const g=c.getContext('2d'),seen=exploredCells(s),discovered=new Set(s.world?.discovered||[]);g.imageSmoothingEnabled=false;
      g.fillStyle='#142c35';g.fillRect(0,0,c.width,c.height);
      const colors={'.':'#8c9c6c',':':'#d2ba80','~':'#426d80','=':'#dbbd86','s':'#a5aaa0',',':'#b9b58b','d':'#838a85','^':'#657779'};
      for(let y=0;y<z.h;y++)for(let x=0;x<z.w;x++){
        const cell=Math.floor(y/8)*16+Math.floor(x/8),terrain=z.tiles[y][x],biome=z.biomes?.tiles?.[y]?.[x];
        g.fillStyle=seen.has(cell)?(['.',',','d'].includes(terrain)?z.biomes?.legend?.[biome]?.color||colors[terrain]:colors[terrain]||colors['.']):((Math.floor(x/8)+Math.floor(y/8))%2?'#243f47':'#29434b');
        g.fillRect(pad+x*scale,pad+y*scale,scale,scale);
      }
      const point=(x,y)=>[Math.round(pad+x/tile*scale),Math.round(pad+y/tile*scale)];
      g.font='bold 18px sans-serif';g.textAlign='center';g.textBaseline='middle';
      for(const p of z.landmarks||[]){
        const index=MAJOR_LANDMARKS.indexOf(p.id),known=discovered.has(p.id);if(index<0&&!known)continue;
        const [x,y]=point(p.x,p.y),aligned=p.id==='westBeacon'?(s.flags.windBeacons||[]).includes('windWest'):p.id==='eastBeacon'?(s.flags.windBeacons||[]).includes('windEast'):false;
        g.beginPath();g.arc(x,y,index>=0?14:6,0,Math.PI*2);g.fillStyle=aligned?'#b4e4b6':known?'#a7ddc4':'#243e47';g.fill();g.strokeStyle=known?'#173e3f':'#d9c59b';g.lineWidth=2;g.stroke();
        if(index>=0){g.fillStyle=known?'#173e3f':'#f1ddb3';g.fillText(String(index+1),x,y+.5);}
      }
      const runtime=this.api.getParty?this.api.getParty():[];
      const party=s.zone==='overworld'?(runtime[s.leader]||s.position||z.spawn):(z.landmarks||[]).find(p=>p.id===(s.zone==='refuge'?'refuge':s.zone==='spire'?'spire':'coast'));
      if(party){const [x,y]=point(party.x,party.y);g.fillStyle='#17363c';g.beginPath();g.moveTo(x,y-9);g.lineTo(x+8,y);g.lineTo(x,y+9);g.lineTo(x-8,y);g.closePath();g.fill();g.strokeStyle='#fff2c7';g.lineWidth=3;g.stroke();g.fillStyle='#fff2c7';g.fillRect(x-2,y-2,4,4);}
      g.strokeStyle='#789c99';g.lineWidth=1;g.strokeRect(pad-.5,pad-.5,z.w*scale+1,z.h*scale+1);
    }
    _drawMap(s,z) {
      const c=this.panel.querySelector('#area-map-canvas');if(!c||!z)return;
      const scale=6,pad=12;c.width=z.w*scale+pad*2;c.height=z.h*scale+pad*2;const g=c.getContext('2d');g.imageSmoothingEnabled=false;
      g.fillStyle='#142f38';g.fillRect(0,0,c.width,c.height);
      const colors={'.':'#577958',':':'#b8a473','~':'#286672','=':'#ba935e','s':'#7c8e7d',',':'#c5b980','d':'#395752','^':'#304a4b'};
      for(let y=0;y<z.tiles.length;y++)for(let x=0;x<z.tiles[y].length;x++){g.fillStyle=colors[z.tiles[y][x]]||colors['.'];g.fillRect(pad+x*scale,pad+y*scale,scale,scale);}
      const point=(x,y)=>[Math.round(pad+x/(z.tile||16)*scale),Math.round(pad+y/(z.tile||16)*scale)];
      const square=(x,y,n,color)=>{g.fillStyle=color;g.fillRect(x-n,y-n,n*2+1,n*2+1);};
      const diamond=(x,y,n,color)=>{g.fillStyle=color;for(let yy=-n;yy<=n;yy++){const w=n-Math.abs(yy);g.fillRect(x-w,y+yy,w*2+1,1);}};
      for(const p of z.props||[]){const [x,y]=point(p.x,p.y);if(['house','workshop'].includes(p.type)){square(x,y-9,9,'#2a504d');g.fillStyle='#668d73';g.fillRect(x-9,y-18,18,9);g.fillStyle='#d2b687';g.fillRect(x-7,y-8,14,8);}else if(p.type==='tree'||p.type==='pine'){diamond(x,y-3,5,'#315841');}else if(p.type==='ruin'){square(x,y,2,'#b5b995');}else if(p.type==='engine'){for(let i=0;i<180;i++){const a=i/180*Math.PI*2;const [xx,yy]=point(p.x+Math.cos(a)*121,p.y+Math.sin(a)*121);square(xx,yy,0,'#cabb89');}}}
      for(const encounter of z.groups||[]){if((s.flags.cleared||[]).includes(encounter.id)||(encounter.boss&&bossDown(s,encounter,z)))continue;const [x,y]=point(encounter.x,encounter.y);diamond(x,y,4,'#263e3e');diamond(x,y,3,'#d17f73');diamond(x,y,1,'#54775a');}
      for(const o of z.objects||[]){
        if((s.flags.collected||[]).includes(o.id)&&['chest','gather'].includes(o.type))continue;
        if(o.type==='heart'&&!bossDown(s,o,z))continue;
        if(o.type==='boss'&&bossDown(s,o,z))continue;
        const [x,y]=point(o.x,o.y);
        if(o.type==='relay'){diamond(x,y,5,'#183e43');diamond(x,y,3,(s.flags.relays||[]).includes(o.id)?'#a4e2bb':'#efcb83');}
        else if(o.type==='camp'){square(x,y,4,'#24483f');g.fillStyle='#b1ecc4';g.fillRect(x-1,y-4,3,9);g.fillRect(x-4,y-1,9,3);}
        else if(o.type==='chest'||o.type==='gather'){square(x,y,3,'#263f3e');square(x,y,2,'#e7d1a2');square(x,y,1,'#876f4d');}
        else if(o.type==='bond'){square(x,y,4,'#304842');diamond(x,y,3,s.flags[o.hero+'Bond']?'#a3bd95':'#e6a2b2');}
        else if(o.type==='npc'){square(x,y,3,'#284c43');square(x,y,2,'#c9e7ae');}
        else if(o.type==='heart'){diamond(x,y,5,'#2a4945');diamond(x,y,3,'#c0f4d1');}
      }
      for(const e of z.exits||[]){const [x,y]=point(e.x,e.y);square(x,y,5,'#294c45');g.fillStyle='#e0efcc';g.fillRect(x-1,y-4,3,9);g.fillRect(x-3,y-3,7,2);square(x,y-5,0,'#fff1c6');}
      const runtime=this.api.getParty?this.api.getParty():[],leader=runtime[s.leader]||runtime.find(p=>p.id===D.heroes[s.leader].id)||s.position||z.spawn;
      const [x,y]=point(leader.x,leader.y);diamond(x,y,7,'#152f37');diamond(x,y,5,'#fff4cf');diamond(x,y,2,'#4fac9b');
      g.strokeStyle='#b2c398';g.lineWidth=1;g.strokeRect(pad-.5,pad-.5,z.w*scale+1,z.h*scale+1);
    }
    _puzzle(s) {
      const progress=Array.isArray(this.options.progress)?this.options.progress:[],known=(s.flags.read||[]).includes('aquaLore');
      return '<p class="guide-intro" style="text-align:center">Choose three notes to restore the relay. A wrong note clears the sequence.</p><p class="puzzle-notes">'+(known?'Survey note: Leaf → Sun → Star':'The survey plate nearby records the order.')+'</p><div class="puzzle-buttons">'+NOTES.map((n,i)=>'<button type="button" data-nav data-menu-command="puzzle-note" data-menu-value="'+i+'"'+(i===0?' data-initial-focus':'')+' aria-label="Play '+n.name+' note"><span aria-hidden="true">'+n.symbol+'</span><b>'+n.name+'</b></button>').join('')+'</div><div class="puzzle-progress" aria-label="'+progress.length+' of 3 notes entered">'+[0,1,2].map(i=>progress[i]===undefined?'◇':NOTES[progress[i]]?.symbol||'◆').join('')+'</div><p class="body-copy" role="status" aria-live="polite" style="text-align:center;min-height:24px">'+esc(this.options.message||(progress.length?progress.length+' of 3 notes are in place.':'The glass waits for a clear signal.'))+'</p><footer class="menu-footer"><span>SKY RELAY · SUNKEN AQUEDUCT</span>'+button('Step away','resume')+'</footer>';
    }
    _ending(s) {
      const f=s.flags,bonds=Number(!!f.seraBond)+Number(!!f.orrenBond),second=!!f.chapterTwoComplete,begin=f.complete&&!f.chapterTwoStarted;
      const story=second?'Both beacons carry a steady light. The Tempest Loom is quiet. You restore the Skyheart and leave the sky roads open to everyone.':'The relays carry a steady tone. Larkspur’s tide returns. You leave the observatory together. A new signal reaches the coast.';
      const note=second?'Return to the Reach to chart more ground, visit the refuge, and follow the roads you have yet to explore.':'Ada’s boat can now reach the Windward Reach. Follow the new signal when you are ready. You can also return to the coast for supplies and quiet moments.';
      const progress=second?summaryStat('2 / 2','CHAPTERS COMPLETE')+summaryStat((f.windBeacons||[]).length+' / 2','WIND BEACONS')+summaryStat(charted(s)+'%','REACH CHARTED'):summaryStat(f.relays.length+' / 3','RELAYS RESTORED');
      return '<div class="ending-hero"><div class="ending-symbol" aria-hidden="true">✦</div><h2>'+(second?'A Sky Worth Sharing.':'A shore worth returning to.')+'</h2><p>'+esc(story)+'</p></div><div class="results-grid">'+summaryStat(time(s.stats.seconds),'JOURNEY TIME')+summaryStat(s.stats.kills,'FOES DEFEATED')+summaryStat(s.stats.arts,'ARTS USED')+summaryStat(s.stats.links,'PARTY LINKS')+summaryStat(s.stats.crafts,'ITEMS MADE')+summaryStat(s.level,'PARTY LEVEL')+progress+summaryStat(bonds+' / 2','QUIET MOMENTS')+'</div><div class="guide-notes">'+this._bond(s,'sera',true)+this._bond(s,'orren',true)+'</div><p class="body-copy" style="text-align:center;margin-top:14px">'+esc(note)+'</p><div class="ending-actions">'+(begin?button('Follow the new signal','begin-chapter-two',undefined,'small-button gold',false,'data-initial-focus'):'')+button(second?'Explore the Reach':'Keep exploring','continue-explore',undefined,'small-button'+(begin?'':' gold'),false,begin?'':'data-initial-focus')+'<button type="button" class="small-button" data-nav data-menu-tab="new-confirm">Begin a new journey</button>'+button('Title screen','title')+'</div>';
    }
    _defeat(s) {
      const cp=D.zones[s.checkpoint&&s.checkpoint.zone]||D.zones.quay;
      return '<div class="ending-hero"><div class="ending-symbol" aria-hidden="true">◇</div><h2>The signal still reaches you.</h2><p>Your companions have fallen. Return to your checkpoint and try again.</p></div>'+card('Your checkpoint',esc(cp.name))+'<p class="body-copy" style="text-align:center">Watch the marked ground. Keep Sera’s energy ready, and use tonics before the party falls.</p><div class="ending-actions">'+button('Retry from checkpoint','retry',undefined,'small-button gold',false,'data-initial-focus')+button('Title screen','title')+'</div>';
    }
    _newConfirm(s) {
      const progress=s.flags.chapterTwoStarted?'Chapter II is '+(s.flags.chapterTwoComplete?'complete':'in progress')+'. You have charted '+charted(s)+'% of the Reach.':'You have restored '+s.flags.relays.length+' of 3 relays.';
      return '<p class="body-copy">A new journey will replace your current progress and create a new world seed. Your current party is level '+s.level+'. '+esc(progress)+'</p><div class="ending-actions">'+button('Keep current journey','resume',undefined,'small-button gold',false,'data-initial-focus')+button('Start a new journey','restart',undefined,'small-button danger')+'</div>';
    }
    destroy() {
      this.close();this.panel.removeEventListener('click',this._onClick);this.panel.removeEventListener('keydown',this._onTab);
    }
  }
  root.WayfarerUI=WayfarerUI;
})(typeof window!=='undefined'?window:globalThis);
