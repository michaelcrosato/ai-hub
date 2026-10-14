/* Game-specific RPG interface. Standard pause, settings, and controls use E.Shell. */
(() => {
'use strict';
const D=globalThis.Dawn=globalThis.Dawn||{},E=My3D2dge;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct=(v,m)=>Math.max(0,Math.min(100,100*v/Math.max(1,m))).toFixed(1);
class UI {
  constructor(app){this.app=app;this.dom=typeof document!=='undefined';this.dirty=true;this.cache={};this.portraits={};this.actions={};this.focusIndex=0;this.lastRefresh=0;this.panelTab=null;}
  el(id){return this.dom?document.getElementById(id):null;}
  html(id,value){if(!this.dom||this.cache[id]===value)return;const e=this.el(id);if(e)e.innerHTML=value;this.cache[id]=value;}
  text(id,value){const e=this.el(id);if(e&&e.textContent!==String(value))e.textContent=value;}
  hide(id,yes){const e=this.el(id);if(e)e.hidden=!!yes;}
  init(){
    if(!this.dom)return;const a=this.app;
    this.el('new-game').onclick=()=>this.newJourney();this.el('continue-game').onclick=()=>a.load('auto');this.el('new-game-plus').onclick=()=>this.newJourney(true);
    this.el('help-button').onclick=()=>{this.close();a.shell.show('help');};this.el('settings-button').onclick=()=>{this.close();a.game.menu('settings');};
    this.el('about-button').onclick=()=>this.open('about');this.el('brand').onclick=e=>{e.preventDefault();if(a.mode==='title')return;this.open('returnTitle');};
    this.el('panel-close').onclick=()=>this.close();this.el('panel-backdrop').onclick=e=>{if(e.target===this.el('panel-backdrop'))this.close();};
    this.el('panel').onclick=e=>{const b=e.target.closest('[data-action]');if(b&&!b.disabled)this.actions[b.dataset.action]?.();};
    this.el('field-hud').onclick=e=>{const b=e.target.closest('[data-ui]');if(b){if(b.dataset.ui==='world')a.enterOverworld();else this.open(b.dataset.ui);}};
    this.el('combat-party').onclick=e=>{const b=e.target.closest('[data-actor]');if(b)a.selectActor(b.dataset.actor);};
    this.el('combat-commands').onclick=e=>{const b=e.target.closest('[data-command]');if(b&&!b.disabled)this.command(b.dataset.command,b.dataset.value);};
    this.el('enemy-strip').onclick=e=>{const b=e.target.closest('[data-target]');if(!b)return;if(a.battleMenu==='target')a.chooseTarget(b.dataset.target);else{a.selectedTarget=b.dataset.target;this.dirty=true;}};
    this.el('battle-mode').onclick=()=>{a.game.settings.set('combatMode',a.game.settings.combatMode==='Wait'?'Active':'Wait');this.dirty=true;};
    this.el('ending-overlay').onclick=e=>{const b=e.target.closest('[data-ending-action]');if(b)this.endingAction(b.dataset.endingAction);};
    a.game.input.bindButtons(this.el('game-frame'));
    this.el('screen').addEventListener('pointerup',e=>{
      if(e.pointerType==='touch'||e.button!==0||a.mode!=='field'||a.battle||a.talk.open||a.panel)return;
      const p=a.game.screen.clientToScreen(e.clientX,e.clientY),q=p&&a.game.view.toGround(p[0],p[1]);if(!q)return;
      const close=a.world.interactables(a).map(o=>({o,d:Math.hypot(o.x-q[0],o.y-q[1])})).sort((x,y)=>x.d-y.d)[0];
      a.walkTo(close?.d<22?close.o.x:q[0],close?.d<22?close.o.y:q[1],close?.d<22?close.o:null);
    });
    this.el('import-save').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>250000)throw Error('File is too large.');const data=JSON.parse(await file.text());if(!a.load(data))throw Error('Save format is not valid.');a.toast('Journey imported.',3);}catch(error){a.toast(error.message,5);}e.target.value='';};
    const resize=()=>{a.game.screen.setOptions({res:window.innerWidth<700?[360,300]:[480,300]});a.game.screen.setScale('fill');};resize();window.addEventListener('resize',resize);
  }
  portrait(id){
    if(!this.dom)return'';if(this.portraits[id])return this.portraits[id];const rig=this.app.rigs[id];if(!rig)return'';
    const cv=E.mkCanvas(52,60),g=E.ctx2d(cv);rig.update(0,{facing:Math.PI/2,expr:'smile'});rig.drawPortrait(g,0,2,52,{bg:'#163a3c',shadow:false});const url=cv.toDataURL();this.portraits[id]=url;return url;
  }
  portraitHTML(id,cls='portrait'){return`<img class="${cls}" src="${this.portrait(id)}" alt="${esc(this.app.content.heroes[id]?.name||id)}">`;}
  newJourney(plus=false){if(!this.dom){this.app.begin(plus);return;}this.open('difficulty',{plus});}
  updateTitleKeyboard(){
    const I=this.app.game.input;if(!this.dom){if(I.pressed('start')||I.pressed('confirm'))this.newJourney();return;}
    const buttons=['new-game','continue-game','new-game-plus'].map(id=>this.el(id)).filter(b=>b&&!b.hidden&&!b.disabled);if(!buttons.length)return;
    let index=buttons.indexOf(document.activeElement);if(index<0)index=Math.max(0,buttons.findIndex(b=>b.id==='continue-game'));
    const moved=I.repeat('down')||I.repeat('right')||I.pressed('cycle'),back=I.repeat('up')||I.repeat('left');if(moved)index=(index+1)%buttons.length;if(back)index=(index+buttons.length-1)%buttons.length;
    if(moved||back)buttons[index].focus({preventScroll:true});if(I.pressed('start')||I.pressed('confirm')){buttons[index].click();I.consumeAll();}
  }
  update(force=false){
    if(!this.dom)return;const a=this.app,now=a.game.real;
    if(!force&&!this.dirty&&now-this.lastRefresh<.12)return;this.lastRefresh=now;this.dirty=false;
    const title=a.mode==='title',ending=a.mode==='ending',field=a.mode==='field',battle=!!a.battle,dialog=a.talk.open;
    this.el('app').className=title?'is-title':battle?'is-battle':ending?'is-ending':'is-field';
    this.hide('title-overlay',!title);this.hide('field-hud',!field||battle||dialog);this.hide('battle-hud',!battle);this.hide('dialog-tools',!dialog);this.hide('ending-overlay',!ending);
    this.hide('touch-pad',!field||battle||dialog||!!a.panel||!window.matchMedia('(pointer:coarse)').matches);
    const save=a.readSave('auto');this.hide('continue-game',!a.validateSave(save));this.hide('new-game-plus',!a.profile.endings.length);
    this.hide('toast',a.toastTimer<=0);if(a.toastTimer>0)this.text('toast',a.toastText);
    if(title){this.text('status-text',`The Small Hours · New side stories · Clearer paths and battles`);this.text('title-key-hint',a.validateSave(save)?'PRESS ENTER TO CONTINUE':'PRESS ENTER TO BEGIN');return;}
    if(ending){this.ending();return;}if(!a.state)return;
    this.text('status-text',`${a.state.gold} crowns · ${a.state.battles} battles won · ${Math.floor(a.state.playtime/60)} min`);
    this.text('era-label',`${a.era().year==='Outside time'?'':a.era().year+' · '}${a.era().name.toUpperCase()}`);
    const tracked=a.content.missions?.find(m=>m.id===a.state.trackedMission);
    this.text('place-label',a.world.zone.name);this.text('chapter-label',tracked?'MISSION · '+tracked.name.toUpperCase():`CHAPTER ${String(a.state.chapter).padStart(2,'0')} · ${a.chapter().title.toUpperCase()}`);this.text('objective-label',a.objective().text);
    this.hide('world-mini',!a.world.isOverworld);this.hide('travel-status',!a.world.isOverworld);
    if(a.world.isOverworld){this.text('travel-status',({foot:'On foot',skiff:'Coast Skiff',airship:'Cloudglass airship'}[a.state.travelMode]||'On foot')+' · '+a.game.input.label('vehicle')+' to change');this.html('world-mini',this.atlasSVG(a.state.zone,{mini:true})+'<span>Open atlas</span>');}
    this.hide('prompt',!a.nearest);if(a.nearest){const e=a.nearest;const names={npc:'Talk to ',chest:'Open chest',shrine:'Rest and save',gate:'Enter ',exit:'Enter ',shop:'Browse supplies',puzzle:'Inspect ',encounter:'Face ',minigame:'Play the bell game',field:'Use ability at ',mechanism:'Adjust ',camp:'Rest at ',craft:'Craft at ',trials:'Enter ',project:'Build at ',cook:'Cook at ',forage:'Gather at ',delivery:'Deliver to ',note:'Read ',discovery:'Read the story of '};const name=e.name||a.content.encounters[e.encounter]?.name||a.content.zones.find(z=>z.id===e.to)?.name||'';this.html('prompt',`<span class="key">${esc(a.game.input.label('interact'))}</span><span>${esc((names[e.type]||'Inspect ')+(['chest','shrine','shop','minigame'].includes(e.type)?'':name))}</span>`);}
    this.html('party-strip',a.state.active.map(id=>{const s=a.stats(id);return`<div class="party-mini">${this.portraitHTML(id)}<div class="unit-name">${esc(s.name)}<span class="unit-level">LV ${s.level}</span></div><div><div class="meter"><i style="width:${pct(s.hp,s.maxHp)}%"></i></div><div class="meter mp"><i style="width:${pct(s.mp,s.maxMp)}%"></i></div></div><div class="meter-numbers"><span>${s.hp} / ${s.maxHp}</span><span>${s.mp} MP</span></div></div>`;}).join(''));
    if(battle)this.battle();
  }
  battle(){
    const a=this.app,b=a.battle;if(!b)return;const C=a.content;
    const statusName=name=>({guard:'Guard',haste:'Haste',regen:'Regen',slow:'Slow',poison:'Poison',burn:'Burn'}[name]||name);
    const selectedSpec=a.selectedItem?b.itemSpec(a.selectedItem,a.state.inventory):b.skills[a.selectedSkill];
    const legal=a.battleMenu==='target'&&selectedSpec?b.validTargets(a.selectedActor,selectedSpec):[];
    if(a.battleMenu==='target'&&!legal.some(v=>v.uid===a.selectedTarget))a.selectedTarget=legal[0]?.uid||null;
    const legalIds=new Set(legal.map(v=>v.uid));
    this.text('encounter-label',C.encounters[a.encounterId]?.name||'The threads converge');this.text('bond-label',`BOND ${Math.floor(b.bond)} / 100`);this.text('battle-mode',a.game.settings.combatMode.toUpperCase());
    const partyKey=b.party.map(u=>[u.id,u.hp,u.mp,a.selectedActor,u.defending,Math.floor(u.atb/100),Object.entries(u.status).map(([name,time])=>name+Math.ceil(time)).join(',')].join(':')).join('|');
    if(this.cache.partyKey!==partyKey){this.cache.partyKey=partyKey;this.html('combat-party',b.party.map(u=>`<button class="combat-unit ${u.uid===a.selectedActor?'selected ':''}${u.atb>=100?'ready ':''}${u.hp<=0?'dead':''}" data-actor="${esc(u.uid)}">${this.portraitHTML(u.id)}<div><span class="unit-name">${esc(u.name)}</span><div class="meter"><i style="width:${pct(u.hp,u.maxHp)}%"></i></div><div class="meter-numbers"><span>${u.hp} / ${u.maxHp}</span><span class="status-pills">${esc(Object.entries(u.status).map(([name,time])=>statusName(name)+' '+Math.ceil(time)+' s').join(' · '))}</span></div><div class="meter atb"><i data-atb="${esc(u.uid)}" style="width:${u.atb}%"></i></div></div><span class="mp-value">${u.mp}<small> MP</small></span></button>`).join(''));}
    for(const u of b.party){const meter=this.el('combat-party')?.querySelector(`[data-atb="${u.uid}"]`);if(meter)meter.style.width=u.atb+'%';}
    this.html('enemy-strip',b.enemies.filter(u=>u.hp>0).map(u=>{
      const intent=u.intent;let targets=intent?b.resolveTargets(u,intent.spec,intent.target):[];
      if(intent&&!targets.length)targets=b.resolveTargets(u,intent.spec,null);
      const threat=targets.map(v=>v.name).join(', ');
      return `<button class="enemy-card ${u.uid===a.selectedTarget?'targeting':''}" data-target="${esc(u.uid)}" ${a.battleMenu==='target'&&!legalIds.has(u.uid)?'disabled':''}><span class="enemy-info"><span>${esc(u.name)}</span><span>${u.hp}</span></span><div class="meter"><i style="width:${pct(u.hp,u.maxHp)}%"></i></div><div class="intent">${esc(intent?.name||'Gathering strength')}${u.phaseName?' · '+esc(u.phaseName):''}</div>${threat?'<div class="threat-tag">→ '+esc(threat)+'</div>':''}<div class="intent ${intent?.stage==='casting'?'cast-now':''}">${u.breakRemaining>0?'ATTACK STOPPED':intent?.stage==='casting'?'CASTING · '+intent.remaining.toFixed(1)+' s':'Preparing · '+Math.floor(u.atb)+'%'}</div>${Object.keys(u.status).length?'<div class="enemy-status">'+Object.entries(u.status).map(([name,time])=>esc(statusName(name))+' '+Math.ceil(time)+' s').join(' · ')+'</div>':''}<div class="intent">Weak: ${esc(u.weak.length?u.weak.join(', '):'none')}${u.resist.length?' · Resists: '+esc(u.resist.join(', ')):''}</div>${u.staggerMax?`<div class="meter stagger"><i style="width:${pct(u.breakRemaining>0?u.staggerMax:u.stagger,u.staggerMax)}%"></i></div><div class="intent break-label">${u.breakRemaining>0?'BROKEN · '+u.breakRemaining.toFixed(1)+' s':u.staggerCooldown>0?'Recovering balance · '+u.staggerCooldown.toFixed(1)+' s':`Pressure ${Math.round(u.stagger)} / ${u.staggerMax}`}</div>`:''}${b.wardSources(u.uid).length?'<div class="intent">Protected by '+esc(b.wardSources(u.uid).map(v=>v.name).join(', '))+'</div>':''}</button>`;
    }).join(''));
    const recent=(b.feedback||[]).filter(e=>b.time-e.time<6).slice(-2);
    this.text('battle-log',recent.length?recent.map(e=>e.text).join('  ·  '):b.log.slice(-2).join('  ·  '));
    const u=b.unit(a.selectedActor);if(!u)return;
    const trial=C.eliteTrials?.find(t=>t.encounter===a.encounterId);
    const cmd=(label,kind,val,sub='',cost='',disabled=false,selected=false)=>`<button class="cmd${selected?' target-selected':''}" data-command="${kind}" data-value="${esc(val)}" ${disabled?'disabled':''}><span><strong>${esc(label)}</strong>${sub?'<br><small>'+esc(sub)+'</small>':''}</span>${cost?'<span class="cost">'+esc(cost)+'</span>':''}</button>`;
    const moveCost=s=>Object.entries(s.costs||{}).map(([id,n])=>(s.participants?.length>1?(b.unit(id)?.name||id)+' ':'')+n+' MP').join(' · ')+((s.bondCost??(s.combo?.length===3?100:0))?' · '+(s.bondCost??100)+' Bond':'');
    let html=`<div class="cmd-title"><span>${esc(u.name)}${u.atb<100?' · Gauge filling':' · Ready'}</span>${a.battleMenu!=='main'?'<button data-command="back">← Back</button>':trial?'<button data-command="menu" data-value="goals">Tactical goals</button>':''}</div>`;
    if(b.result)html+=`<div class="cmd-title">${b.result==='victory'?'The path is clear.':b.result==='defeat'?'The thread is not broken.':'Leaving the battle...'}</div>`;
    else if(a.battleMenu==='main'){
      html+=cmd('Attack','skill','attack','One enemy','',u.atb<100||u.hp<=0)+cmd('Techniques','menu','skills','Single attacks and healing')+cmd('Link','menu','links','Dual and triple techniques')+cmd('Items','menu','items','Use a supply')+cmd('Defend','defend','','Reduce damage. Recover MP.','',u.atb<100||u.hp<=0)+cmd(a.expeditionActive?.()?'Abandon route':'Retreat','flee','',a.expeditionActive?.()?'Lose the unbanked haul':'Leave this encounter','',C.encounters[a.encounterId]?.boss&&!a.expeditionActive?.());
    }else if(a.battleMenu==='skills'||a.battleMenu==='links'){
      const skills=b.available(u.uid).filter(s=>a.battleMenu==='links'?s.combo?.length>1:!s.combo&&s.id!=='attack');
      html+=skills.map(s=>cmd(s.name,'skill',s.id,s.canUse?(s.description||s.target):s.reason,moveCost(s),!s.canUse)).join('');
      if(!skills.length)html+='<p class="cmd-title">This party has no known link. Try a different team.</p>';
    }else if(a.battleMenu==='items'){
      const items=Object.keys(a.state.inventory).filter(id=>C.items[id]?.kind==='consumable'&&a.state.inventory[id]>0);
      html+=items.map(id=>{const check=b.canUseItem(u.uid,id,null,a.state.inventory);return cmd(C.items[id].name,'item',id,check.ok?(C.items[id].description||''):check.reason,`×${a.state.inventory[id]}`,!check.ok);}).join('');
      if(!items.length)html+='<p class="cmd-title">No battle supplies remain.</p>';
    }else if(a.battleMenu==='target'){
      const preview=b.previewAction(u.uid,{skillId:a.selectedSkill,itemId:a.selectedItem,targetId:a.selectedTarget,inventory:a.state.inventory});
      const shape={enemy:'One enemy',ally:'One ally',self:'Self',line:'Line',circle:'Nearby group',allEnemies:'All enemies',allAllies:'All allies'}[preview.targetType]||'Choose a target';
      html+=`<div class="cmd-title">${esc(selectedSpec?.name)} · ${esc(shape)}</div>`;
      if(preview.effects.length)html+='<div class="battle-preview" aria-live="polite"><strong>'+esc(preview.effects.length+' affected'+(moveCost(preview)?' · '+moveCost(preview):''))+'</strong>'+preview.effects.map(e=>`<div class="preview-target"><b>${esc(e.name)}</b><small>${esc(e.lines.join(' · '))}</small></div>`).join('')+'</div>';
      if(!legal.length)html+='<p class="cmd-title">'+esc(preview.reason||'No valid targets remain.')+'</p>';
      html+=legal.map(t=>cmd(t.name,'target',t.uid,`${t.hp} / ${t.maxHp} HP · ${t.mp} / ${t.maxMp} MP`,t.uid===a.selectedTarget?'Previewing':'',false,t.uid===a.selectedTarget)).join('');
      html+='<p class="footer-note">Focus or point at a target to preview who is affected. Confirm to act.</p>';
    }else if(a.battleMenu==='goals'&&trial){
      html+='<p class="footer-note">Meet each goal and win this attempt. Earned rewards are never paid twice.</p><div class="medal-list">';
      for(const m of a.trialMedalProgress?.(trial.id)||[])html+=`<div class="medal-card ${m.earned?'earned':''}"><b>${esc(m.name)}</b><p>${esc(m.description)}</p><small class="medal-progress">${m.earned?'Already earned':esc(m.progress)+(m.met?' · Goal met; finish the battle':'')}</small></div>`;
      html+='</div>';
    }
    this.html('combat-commands','<div class="cmd-grid">'+html+'</div>');
    const commands=this.el('combat-commands');
    if(commands){const focus=e=>{const node=e.target.closest?.('[data-command="target"]');if(node)this.previewBattleTarget(node.dataset.value);};commands.onfocusin=focus;commands.onpointerover=focus;}
    const enemies=this.el('enemy-strip');
    if(enemies){const focus=e=>{const node=e.target.closest?.('[data-target]');if(node&&!node.disabled)this.previewBattleTarget(node.dataset.target);};enemies.onfocusin=focus;enemies.onpointerover=focus;}
  }
  previewBattleTarget(id){
    const a=this.app,b=a.battle;if(!b||a.battleMenu!=='target')return false;
    const spec=a.selectedItem?b.itemSpec(a.selectedItem,a.state.inventory):b.skills[a.selectedSkill];
    if(!spec||!b.validTargets(a.selectedActor,spec).some(u=>u.uid===id))return false;
    if(a.selectedTarget!==id){a.selectedTarget=id;this.dirty=true;}
    return true;
  }
  command(type,value){const a=this.app;if(type==='skill')a.chooseSkill(value);else if(type==='menu')a.selectMenu(value);else if(type==='item')a.chooseItem(value);else if(type==='target')a.chooseTarget(value);else if(type==='defend')a.defend();else if(type==='flee')a.flee();else if(type==='back')a.selectMenu('main');this.dirty=true;this.update(true);}
  updateBattleKeyboard(){
    if(!this.dom||!this.app.battle)return;const a=this.app,I=a.game.input,buttons=[...this.el('combat-commands').querySelectorAll('button:not(:disabled)')];if(!buttons.length)return;
    const context=[a.selectedActor,a.battleMenu,a.selectedSkill,a.selectedItem].join(':');
    if(this.battleFocusContext!==context){
      this.battleFocusContext=context;
      const selected=buttons.findIndex(node=>node.dataset.command==='target'&&node.dataset.value===a.selectedTarget);
      this.focusIndex=selected>=0?selected:Math.max(0,buttons.findIndex(node=>node.dataset.command!=='back'&&node.dataset.value!=='goals'));
    }
    const focused=buttons.indexOf(document.activeElement);if(focused>=0)this.focusIndex=focused;
    this.focusIndex%=buttons.length;let moved=false;
    if(I.repeat('down')||I.repeat('right')){this.focusIndex=(this.focusIndex+1)%buttons.length;moved=true;}
    if(I.repeat('up')||I.repeat('left')){this.focusIndex=(this.focusIndex+buttons.length-1)%buttons.length;moved=true;}
    const button=buttons[this.focusIndex];
    if(moved)button.focus({preventScroll:true});
    if(button.dataset.command==='target')this.previewBattleTarget(button.dataset.value);
    if(I.pressed('confirm')){button.click();I.consumeAll();}
  }
  atlasPlaces(worldId){return this.app.content.zones.filter(z=>!z.overworldParent&&z.worldPosition?.zone===worldId).sort((a,b)=>a.worldPosition.y-b.worldPosition.y||a.worldPosition.x-b.worldPosition.x);}
  atlasSVG(worldId,{mini=false}={}){
    const a=this.app,data=D.getOverworldData?.(worldId,a.state.flags);if(!data)return'';
    const {w,h,terrain}=data;this.mapTerrainCache||=new WeakMap();let ground=this.mapTerrainCache.get(terrain);
    if(!ground){const paths={};for(let y=0;y<h;y++)for(let x=0;x<w;){const id=terrain[y*w+x];let end=x+1;while(end<w&&terrain[y*w+end]===id)end++;paths[id]=(paths[id]||'')+`M${x} ${y}h${end-x}v1H${x}z`;x=end;}
      ground=Object.entries(paths).map(([id,path])=>`<path fill="${esc(data.legend?.[id]?.color||data.palette?.[id]||'#406862')}" d="${path}"/>`).join('');this.mapTerrainCache.set(terrain,ground);
    }
    let marks='';const target=D.worldEntrance?.(a.destination())?.id||a.destination();
    for(const [i,z]of this.atlasPlaces(worldId).entries()){const {x,y}=z.worldPosition,seen=a.state.visited.includes(z.id),open=a.meets(z.overworldRequires),selected=z.id===target;
      if(selected)marks+=`<circle cx="${x+.5}" cy="${y+.5}" r="2.3" fill="none" stroke="#f9d594" stroke-width=".5"/>`;
      marks+=`<circle cx="${x+.5}" cy="${y+.5}" r="${mini?.9:1.35}" fill="${seen?'#f4d494':open?'#b5cbb0':'#415863'}" stroke="#102b36" stroke-width=".45"/>`;
      if(!mini)marks+=`<text x="${x+.5}" y="${y+1.15}" text-anchor="middle" font-size="2" font-weight="bold" fill="#132c32">${i+1}</text>`;
    }
    if(!mini)for(const region of data.regions||[])if(Number.isFinite(region.x)&&Number.isFinite(region.y)){const attr=`x="${region.x}" y="${region.y}" text-anchor="middle" font-family="Arial, sans-serif" font-size="2.1" letter-spacing=".15"`;marks+=`<text ${attr} fill="none" stroke="#163241" stroke-width=".42" stroke-linejoin="round">${esc(region.name)}</text><text ${attr} fill="#e0e6cc">${esc(region.name)}</text>`;}
    const current=a.state.zone===worldId?{x:a.hero.x/16,y:a.hero.y/16}:a.world.zone.worldPosition?.zone===worldId?{x:a.world.zone.worldPosition.x+.5,y:a.world.zone.worldPosition.y+.5}:null;
    if(current){const close=this.atlasPlaces(worldId).some(z=>Math.hypot(current.x-z.worldPosition.x-.5,current.y-z.worldPosition.y-.5)<3.5),y=current.y+(close?3.5:0);
      if(close)marks+=`<path d="M${current.x.toFixed(2)} ${current.y.toFixed(2)}v2" stroke="#fff6db" stroke-width=".35"/><circle cx="${current.x.toFixed(2)}" cy="${current.y.toFixed(2)}" r=".35" fill="#fff6db"/>`;
      marks+=`<path d="M${current.x.toFixed(2)} ${(y-1.5).toFixed(2)}l1.1 2.8-1.1-.65-1.1.65z" fill="#fff6db" stroke="#234254" stroke-width=".35"/>`;
    }
    return `<svg class="${mini?'mini-map-svg':'atlas-map'}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(a.content.zoneById[worldId]?.name||'World map')}. Gold circles show known places. The white arrow shows your position." xmlns="http://www.w3.org/2000/svg"><g shape-rendering="crispEdges">${ground}</g>${marks}${mini?'':`<g fill="#e2d3ac" font-size="2.3" text-anchor="middle"><text x="${w-5}" y="5">N</text><path d="M${w-5} 6l-.8 2h1.6z"/></g>`}<rect x=".4" y=".4" width="${w-.8}" height="${h-.8}" fill="none" stroke="#a4b193" stroke-width=".65"/></svg>`;
  }
  requirementText(condition){
    if(!condition)return'Follow the road to this place.';const a=this.app;
    if(typeof condition==='string')condition={flags:[condition]};if(Array.isArray(condition))return condition.map(c=>this.requirementText(c)).join(' ');
    const needs=[];if(condition.chapterAtLeast>a.state.chapter)needs.push('Reach chapter '+condition.chapterAtLeast+'.');
    for(const flag of condition.flags||[])if(!a.state.flags[flag]){const m=a.content.missions?.find(m=>m.completeFlag===flag);needs.push(m?'Finish “'+m.name+'”.':flag==='transport_skiff'?'Complete the skiff mission at Open Keel Yard.':flag==='transport_airship'?'Complete the flight mission at Cloudglass Hangar.':flag==='bridge_seed'?'Plant the Bridge Seed at the First Falls.':flag==='orchard_seen'?'Speak to Tessa in the Orchard of Hours.':'Advance the main story in this age.');}
    return [...new Set(needs)].join(' ')||'Finish the prior mission in this region.';
  }
  missionHTML(era,campaign='roads'){
    const a=this.app,C=a.content,S=a.state;let html='<div class="panel-tabs">';
    for(const e of C.eras)html+=this.action(e.name,()=>this.open('journal',{tab:campaign==='roads'?'missions':campaign,era:e.id}),{cls:'era-tab'+(era===e.id?' active':'')});html+='</div>';
    const missions=(C.missions||[]).filter(m=>m.era===era&&(campaign==='roads'?!['depths','hearth','small'].includes(m.campaign):m.campaign===campaign)),finished=missions.filter(m=>S.flags[m.completeFlag]).length;
    html+=`<p>${finished} / ${missions.length} missions complete. Select a mission to put its next step on the field screen and the atlas.</p>`;
    const view=this.missionFilter||'open';html+='<div class="panel-tabs mission-filters">';
    for(const [id,label]of [['open','Open tasks'],['all','All missions'],['complete','Completed']])html+=this.action(label,()=>{this.missionFilter=id;this.open('journal',{tab:campaign==='roads'?'missions':campaign,era});},{cls:'era-tab'+(view===id?' active':'')});html+='</div>';
    const visible=missions.filter(m=>view==='all'||view==='complete'?view==='all'||a.missionStatus(m.id)==='complete':['available','active'].includes(a.missionStatus(m.id))).sort((x,y)=>({active:0,available:1,locked:2,complete:3}[a.missionStatus(x.id)]-({active:0,available:1,locked:2,complete:3}[a.missionStatus(y.id)])));
    if(!visible.length)html+='<p class="empty-state">No missions in this view. Select All missions to see what opens later.</p>';
    for(const m of visible){const status=a.missionStatus(m.id),step=a.missionStep(m.id),tracked=S.trackedMission===m.id,done=status==='complete',locked=status==='locked';
      html+=`<article class="mission-row ${done?'complete ':''}${tracked?'tracked':''}"><div class="mission-heading"><span class="eyebrow">${tracked?'TRACKED':status.toUpperCase()}</span><span>${m.steps.filter(s=>S.flags[s.flag]).length} / ${m.steps.length} steps</span></div><h3>${esc(m.name)}</h3><p>${esc(m.summary||m.description)}</p>`;
      if(locked)html+=`<p class="footer-note">${esc(m.requiresText||this.requirementText(m.requires))}</p>`;
      else if(!done&&step)html+=`<div class="mission-next"><span class="eyebrow">NEXT STEP</span><p>${esc(step.text)}<br><small>${esc(C.zoneById[step.zone]?.name||'Follow the marked road')}</small></p></div>`;
      if(status==='active'||done)html+='<details><summary>All steps</summary>'+m.steps.map(s=>`<div class="journal-step ${S.flags[s.flag]?'done':''}"><span>${S.flags[s.flag]?'✓':'◇'}</span><span>${esc(s.text)}<br><small>${esc(C.zoneById[s.zone]?.name||'')}</small></span></div>`).join('')+'</details>';
      const reward=typeof m.reward==='string'?m.reward:m.rewardText;if(reward)html+=`<p class="mission-reward">Reward · ${esc(reward)}</p>`;
      if(!locked&&!done)html+='<div class="mission-actions">'+this.action(tracked?'Follow main story':'Track mission',()=>{a.trackMission(tracked?null:m.id);this.open('journal',{tab:campaign==='roads'?'missions':campaign,era});},{primary:!tracked})+this.action('Show on atlas',()=>{a.trackMission(m.id);this.open('map',{era:C.zoneById[step?.zone]?.era||era});})+'</div>';
      html+='</article>';
    }
    return html;
  }
  action(label,fn,{primary=false,disabled=false,cls='panel-button'}={}){const key='a'+Object.keys(this.actions).length;this.actions[key]=fn;return`<button class="${cls}${primary?' primary':''}" data-action="${key}" ${disabled?'disabled':''}>${esc(label)}</button>`;}
  close(){
    this.app.panel=null;if(this.app.game.scene?.pausable===false&&this.app.mode==='field')this.app.game.scene.pausable=true;
    this.hide('panel-backdrop',true);this.actions={};this.app.game.input.clear();if(this.dom)this.el('screen')?.focus({preventScroll:true});this.dirty=true;
  }
  open(type,arg){
    const a=this.app;if(a.battle&&!['about','credits'].includes(type))return;
    a.panel={type,arg};a.walkTarget=null;if(a.mode==='field'&&a.game.scene)a.game.scene.pausable=false;a.game.input.clear();this.actions={};this.focusIndex=0;
    if(type==='puzzle'){this.puzzleEntity=arg;this.puzzleStep=0;}
    if(type==='bells'){this.bellEntity=arg;this.bellStep=0;this.bellPattern=arg.pattern||[0,2,1,3];}
    if(!this.dom)return;this.hide('panel-backdrop',false);let title='',kicker='TRAVELER’S JOURNAL',html='',footer='';const C=a.content,S=a.state;
    const custom=D.smallHoursPanel?.(this,type,arg)||D.combatPolishPanel?.(this,type,arg)||D.hearthPanel?.(this,type,arg)||D.expeditionPanel?.(this,type,arg)||D.journeyPanel?.(this,type,arg);
    if(custom){({title,kicker,html,footer}=custom);}
    else if(type==='difficulty'){
      title=arg?.plus?'Travel the threads again':'Choose your pace';kicker=arg?.plus?'NEW GAME +':'A NEW JOURNEY';html='<p>Follow eight chapters across four ages. The story and its endings are the same in every mode.</p><div class="panel-grid">';
      for(const [id,name,desc]of [['story','Story','More gentle battles. Explore at your own pace.'],['standard','Standard','A balanced journey. Use team moves and enemy weaknesses.'],['hard','Tactician','Stronger enemies. Guard, heal, and plan each link.']])html+=`<div class="panel-card"><h3>${name}</h3><p>${desc}</p>${this.action('Begin · '+name,()=>a.begin(!!arg?.plus,id),{primary:id==='standard'})}</div>`;
      html+='</div><p class="footer-note">Three manual save slots and one autosave. The browser keeps your progress on this device.</p>';
    }else if(type==='journal'){
      const tab=arg?.tab||this.journalTab||'story';this.journalTab=tab;title='The threads we follow';kicker='STORY · PEOPLE · THE OPEN ROADS';
      const roads=(C.missions||[]).filter(m=>!['depths','hearth','small'].includes(m.campaign)),depths=(C.missions||[]).filter(m=>m.campaign==='depths'),hearth=(C.missions||[]).filter(m=>m.campaign==='hearth'),small=(C.missions||[]).filter(m=>m.campaign==='small'),count=roads.filter(m=>S.flags[m.completeFlag]).length;html='<div class="panel-tabs journal-tabs">';
      for(const [id,label]of [['story','Main story'],['missions',`Open Roads · ${count}/${roads.length}`],['depths',`Far Shore · ${depths.filter(m=>S.flags[m.completeFlag]).length}/${depths.length}`],['hearth',`Hearthbound · ${hearth.filter(m=>S.flags[m.completeFlag]).length}/${hearth.length}`],['small',`Small Hours · ${small.filter(m=>S.flags[m.completeFlag]).length}/${small.length}`],['companions','Companion threads']])html+=this.action(label,()=>this.open('journal',{tab:id}),{cls:'era-tab'+(tab===id?' active':'')});html+='</div>';
      if(tab==='story'){
        html+=`<span class="eyebrow">CHAPTER ${S.chapter} / 8</span><h3>${esc(a.chapter().title)}</h3><p>${esc(a.chapter().summary)}</p>`;
        for(const o of a.chapter().objectives||[])html+=`<div class="journal-step ${S.flags[o.flag]?'done':''}"><span>${S.flags[o.flag]?'✓':'◇'}</span><span>${esc(o.text)} <small>— ${esc(C.zoneById[o.zone]?.name||o.zone)}</small></span></div>`;
        html+='<p class="footer-note">The Open Roads adds a separate story across the five world maps. Help each region, then bring its people together in the Fold. You can complete these missions before the final choice.</p>';
        if(S.trackedMission)html+=this.action('Follow main story',()=>{a.trackMission(null);this.close();},{primary:true});
      }else if(['missions','depths','hearth','small'].includes(tab)){if(tab==='small')html+='<p>Return to the people you met on the main road. Help with a lost key, an unfinished song, a forgotten apology, and a shift that never ended. Eighteen side stories share the existing world.</p>';if(tab==='hearth')html+='<p>A travelling town owes years it never borrowed. Follow six character stories, rebuild Wayfarer Haven, and challenge the collector who claims its future. Start in the Age of Bells from Chapter 2.</p>';if(tab==='depths')html+='<p>A passage is pulling living places into a sea between worlds. Follow Keva at the Sunken Chart House, recover four anchors, and find the people left beyond the shore.</p>';html+=this.missionHTML(arg?.era||a.world.zone.era,tab==='missions'?'roads':tab);}
      else for(const q of C.quests){const done=!!S.flags[q.completeFlag];html+=`<div class="quest-row ${done?'complete':''}"><h3>${done?'✓ ':''}${esc(q.name)}</h3><p>${esc(q.description)}</p>`;if(S.chapter<(q.startChapter||1))html+=`<small>Opens in chapter ${q.startChapter}.</small>`;else for(const st of q.steps||[])html+=`<div class="journal-step ${S.flags[st.flag]?'done':''}"><span>${S.flags[st.flag]?'✓':'◇'}</span><span>${esc(st.text)}<br><small>${esc(C.zoneById[st.zone]?.name||st.zone)}</small></span></div>`;html+='</div>';}
      footer=this.action('Nearby work',()=>this.open('nearby'))+this.action('Journey kit',()=>this.open('camp'))+this.action('Open atlas',()=>this.open('map'))+this.action('Back to the journey',()=>this.close(),{primary:true});
    }else if(type==='map'){
      const eraId=C.eras.some(e=>e.id===arg?.era)?arg.era:a.world.zone.era,era=C.eras.find(e=>e.id===eraId),worldId=C.overworldByEra?.[eraId],world=C.zoneById[worldId],accessible=a.mapAccess(eraId),places=this.atlasPlaces(worldId);
      title='An atlas of borrowed hours';kicker='THE OPEN ROADS · FIVE WORLD MAPS';html='<div class="panel-tabs atlas-tabs">';
      for(const e of C.eras)html+=this.action(e.year==='Outside time'?'The Fold':String(e.year)+' · '+e.name,()=>this.open('map',{era:e.id}),{cls:'era-tab'+(eraId===e.id?' active':'')});html+='</div>';
      html+=`<div class="atlas-heading"><div><span class="eyebrow">${esc(era.year)}</span><h3>${esc(world?.name||era.name)}</h3></div><span class="tag">${places.filter(z=>S.visited.includes(z.id)).length} / ${places.length} places found</span></div>`;
      if(!accessible)html+='<p class="atlas-lock">Reach this age through the main story. Its world map will open when you arrive.</p>';
      if(accessible){html+=this.atlasSVG(worldId);html+='<div class="atlas-legend"><span>▲ You are here</span><span>● Gold: visited</span><span>◎ Ring: marked route</span></div><p>Walk the world to find new places. Use Travel for places you already know. Press E at a landmark to enter.</p><div class="atlas-actions">'+this.action(S.zone===worldId?'Return to the world':'Explore this world',()=>S.zone===worldId?this.close():a.travel(worldId),{primary:true})+this.action('Travel modes',()=>this.open('travel'))+this.action('Missions in this age',()=>this.open('journal',{tab:'missions',era:eraId}))+'</div><div class="atlas-places">';
        for(const [i,z]of places.entries()){const visited=S.visited.includes(z.id),open=a.meets(z.overworldRequires),fast=visited||S.unlocked.includes(z.id),selected=(D.worldEntrance?.(a.destination())?.id||a.destination())===z.id;
          html+=`<article class="atlas-place ${selected?'marked ':''}${S.zone===z.id?'current':''}"><span class="atlas-number">${i+1}</span><div><span class="eyebrow">${S.zone===z.id?'YOU ARE HERE':visited?'VISITED':open?'UNEXPLORED':'ROAD CLOSED'}</span><h3>${esc(z.name)}</h3><p>${esc(z.description)}</p>${!open?'<small>'+esc(this.requirementText(z.overworldRequires))+'</small>':''}<div class="atlas-place-actions">${this.action(selected?'Route marked':'Mark route',()=>{a.markDestination(z.id);this.open('map',{era:eraId});},{disabled:!open})}${this.action(S.zone===z.id?'Current place':'Travel',()=>a.travel(z.id),{disabled:!fast||S.zone===z.id})}</div></div></article>`;
        }html+='</div>';
      }
      if(S.atlasDestination)footer=this.action('Clear marked route',()=>{S.atlasDestination=null;a.save('auto',true);this.open('map',{era:eraId});});footer+=this.action('Back to the journey',()=>this.close(),{primary:true});
    }else if(type==='travel'){
      title='Choose how to travel';kicker='LAND · SEA · SKY';html='<p>Travel modes work on the world maps. Find dry ground before you leave a vehicle. The skiff can cross land and water. The airship can cross mountains.</p><div class="panel-grid travel-cards">';
      const modes=a.travelModes();
      for(const [id,name,desc,unlock]of [['foot','On foot','Walk roads, woods, and bridges.','Available from the start.'],['skiff','Coast Skiff','Cross rivers and sea. Its runners also move over land.','Complete the second coast mission at the Bell shipyard.'],['airship','Cloudglass airship','Fly over water and mountains. Land at open ground.','Complete the third courier mission at the Ash Cloud Hangar.']]){
        const available=modes.includes(id),current=S.travelMode===id&&a.world.isOverworld,landing=a.world.isOverworld&&a.world.canUseMode(id,a.hero.x,a.hero.y);
        html+=`<div class="panel-card ${current?'current':''}"><span class="eyebrow">${current?'IN USE':available?'READY':'LOCKED'}</span><h3>${name}</h3><p>${desc}</p><small>${available?'Press '+esc(a.game.input.label('vehicle'))+' on the world to change modes.':unlock}</small><br>${this.action(current?'Current mode':'Use '+name,()=>{a.setTravelMode(id);this.close();},{disabled:!available||!landing||current,primary:available&&!current})}</div>`;
      }html+='</div>';if(!a.world.isOverworld)footer=this.action('Enter the overworld',()=>a.enterOverworld(),{primary:true});else footer=this.action('Open atlas',()=>this.open('map'))+this.action('Back to the world',()=>this.close(),{primary:true});
    }else if(type==='party'){
      title='The people in this hour';kicker=`ACTIVE PARTY · ${S.active.length} / 3`;
      html='<p>Select up to three travelers. With three active, a new traveler replaces the third. Open a character to change equipment.</p><div class="panel-grid">';
      for(const id of Object.keys(S.roster)){const s=a.stats(id),active=S.active.includes(id);html+=`<div class="panel-card ${active?'current':''}"><div class="hero-header">${this.portraitHTML(id)}<div><span class="eyebrow">${esc(s.title)}</span><h3>${esc(s.name)} <small>Lv ${s.level}</small></h3><small>${esc(s.role)}</small></div></div><div class="meter"><i style="width:${pct(s.hp,s.maxHp)}%"></i></div><div class="meter-numbers"><span>${s.hp} / ${s.maxHp} HP</span><span>${s.mp} / ${s.maxMp} MP</span></div><br>${this.action(active?'Active · remove':'Add to party',()=>{a.swap(id);this.open('party');},{disabled:active&&S.active.length===1})} ${this.action('Equipment',()=>this.open('hero',id))}</div>`;}html+='</div>';
    }else if(type==='hero'){
      const s=a.stats(arg);title=s.name;kicker=s.title.toUpperCase();html=`<div class="hero-header">${this.portraitHTML(arg)}<p>${esc(s.bio)}</p></div><div class="stat-grid">${[['Level',s.level],['Attack',s.atk],['Magic',s.mag],['Defence',s.def],['Speed',s.speed],['Max HP',s.maxHp]].map(([l,v])=>`<span>${l}<b>${v}</b></span>`).join('')}</div><h3>Equipment</h3>`;
      for(const slot of ['weapon','armor','accessory']){const current=s.equipment[slot];html+=`<div class="inventory-row"><div class="item-copy"><span class="eyebrow">${slot.toUpperCase()}</span><h3>${esc(C.items[current]?.name||'Travel clothes')}</h3><small>${esc(C.items[current]?.description||'No item equipped.')}</small></div>${this.action('Change',()=>this.open('equip',{hero:arg,slot}))}</div>`;}
      html+='<h3>Techniques</h3>';s.skills.forEach(id=>{const sk=C.skills[id];html+=`<div class="inventory-row"><div class="item-copy"><h3>${esc(sk.name)} <small>${sk.cost} MP</small></h3><small>${esc(sk.description)}</small></div></div>`;});footer=this.action('All travelers',()=>this.open('party'));
    }else if(type==='equip'){
      title='Choose '+arg.slot;kicker=C.heroes[arg.hero].name.toUpperCase();const items=Object.values(C.items).filter(it=>(it.slot||it.kind)===arg.slot&&(!it.hero||it.hero===arg.hero)&&S.inventory[it.id]>0);
      html=items.length?items.map(it=>`<div class="inventory-row"><div class="item-copy"><h3>${esc(it.name)}</h3><small>${esc(it.description)}</small><br>${Object.entries(it.stats||{}).map(([k,v])=>`<span class="tag">${esc(k)} +${v}</span>`).join('')}</div>${this.action('Equip',()=>{a.equip(arg.hero,it.id);this.open('hero',arg.hero);})}</div>`).join(''):'<p>No suitable item is in your bag. Visit a shop or search for treasure.</p>';
      footer=this.action('Back',()=>this.open('hero',arg.hero))+this.action('Unequip',()=>{a.equip(arg.hero,null,arg.slot);this.open('hero',arg.hero);},{disabled:!S.roster[arg.hero].equipment[arg.slot]});
    }else if(type==='bag'){
      title='Everything we carry';kicker=`INVENTORY · ${S.gold} CROWNS`;
      const items=Object.values(C.items).filter(it=>S.inventory[it.id]>0);html=items.map(it=>`<div class="inventory-row"><div class="item-copy"><span class="eyebrow">${esc(it.kind||'KEY ITEM')}</span><h3>${esc(it.name)} <small>× ${S.inventory[it.id]}</small></h3><small>${esc(it.description)}</small></div>${it.kind==='meal'?this.action('Share meal',()=>{a.eatMeal(it.id);this.open('bag');},{disabled:a.hearthBusy()}):it.kind==='consumable'?this.action('Use',()=>this.open('use',{item:it.id})):''}</div>`).join('')||'<p>The bag is empty.</p>';
      footer=this.action('Equipment',()=>this.open('party'));
    }else if(type==='use'){
      title='Use '+C.items[arg.item].name;html='<div class="panel-grid">'+Object.keys(S.roster).map(id=>{const h=a.stats(id);return`<div class="panel-card"><h3>${esc(h.name)}</h3><p>${h.hp} / ${h.maxHp} HP<br>${h.mp} / ${h.maxMp} MP</p>${this.action('Use on '+h.name,()=>{a.useFieldItem(arg.item,id);this.open('bag');})}</div>`;}).join('')+'</div>';
    }else if(type==='shop'){
      title=arg.name||'Supplies for the road';kicker=`SHOP · ${S.gold} CROWNS`;const stock=arg.stock||arg.items||['tonic','ether','phoenix','panacea'];
      html=stock.map(id=>{const it=C.items[id];if(!it)return'';return`<div class="inventory-row"><div class="item-copy"><h3>${esc(it.name)} <small>Owned ${S.inventory[id]||0}</small></h3><small>${esc(it.description)}</small><br>${Object.entries(it.stats||{}).map(([k,v])=>`<span class="tag">${k} +${v}</span>`).join('')}</div>${this.action(`${it.price} crowns`,()=>{if(S.gold>=it.price){S.gold-=it.price;a.give(id);a.game.audio.sfx('coin');a.save('auto',true);this.open('shop',arg);}},{disabled:S.gold<it.price})}</div>`;}).join('');
      footer=this.action('Equipment',()=>this.open('party'));
    }else if(type==='save'){
      title='Keep this moment';kicker='SAVE YOUR JOURNEY';html='<p>Manual slots are separate from autosave. Export a file to keep a copy outside this browser.</p>';
      for(const slot of ['auto','1','2','3']){const s=a.readSave(slot);html+=`<div class="save-row"><div><h3>${slot==='auto'?'Autosave':'Slot '+slot}</h3><small>${s?`${esc(C.zones.find(z=>z.id===s.zone)?.name||s.zone)} · Chapter ${s.chapter}<br>${esc(new Date(s.savedAt).toLocaleString())}`:'Empty slot'}</small></div><div class="buttons">${slot!=='auto'?this.action('Save here',()=>{a.save(slot);this.open('save');},{disabled:!S}):''}${this.action('Load',()=>a.load(slot),{disabled:!a.validateSave(s)})}</div></div>`;}
      footer=this.action('Import save',()=>this.el('import-save').click())+this.action('Export save',()=>this.export(),{disabled:!S,primary:true});
    }else if(type==='defeat'){
      title='The thread is not broken';kicker='A CHANCE TO TRY AGAIN';html='<p>The party returns to the moment before the battle. Your HP and MP are restored. You lose no items or crowns.</p><p>Use Defend to restore MP. Try a healing link or change your party before the next attempt.</p>';
      footer=this.action('Return to the path',()=>{a.game.audio.music(D.Music[a.world.zone.era]);this.close();})+this.action('Try the battle again',()=>{this.close();a.startBattle(arg.encounter);},{primary:true});
    }else if(type==='returnTitle'){
      title='Return to the title?';kicker='PAUSE YOUR JOURNEY';html='<p>Your current journey will be saved before you return.</p>';footer=this.action('Keep playing',()=>this.close())+this.action('Save and return',()=>{a.save('auto',true);this.close();a.game.go('title');},{primary:true});
    }else if(type==='bells'){
      title=arg.name||'The four-bell refrain';kicker='A REFRAIN TO REMEMBER';this.bellStep=0;this.bellPattern=arg.pattern||[0,2,1,3];this.bellEntity=arg;
      const refrain=this.bellPattern.map(i=>['LOW','MID','HIGH','CLEAR'][i]).join(' · '),paid=!!S.flags[arg.flag||'bell_game_won'];
      html='<p>'+esc(arg.hint||'Read or listen to the refrain, then ring the bells in order.')+'</p><p class="bell-score">'+esc(refrain)+'</p><p>'+esc(paid?'This reward is already claimed. Play again for practice.':arg.rewardText||'The first correct refrain earns 20 crowns.')+'</p><p id="bell-hint">0 / '+this.bellPattern.length+' clear notes</p><div class="panel-grid">';
      ['Low','Mid','High','Clear'].forEach((n,i)=>html+=this.action(n,()=>this.ring(i),{cls:'panel-card'}));html+='</div>';footer=this.action('Hear the refrain',()=>{this.bellPattern.forEach((v,i)=>setTimeout(()=>a.game.audio.sfx({wave:'sine',freq:[330,440,550,660][v],dur:.45,vol:.13}),i*400));});
    }else if(type==='puzzle'){
      title=arg.name||'A lock of four hours';kicker='READ THE MARKS';this.puzzleStep=0;this.puzzleEntity=arg;html=`<p>${esc(arg.hint||'First the seed. Then the bell. Then the glass. Last the ash.')}</p><p id="puzzle-hint">Choose the symbols in order.</p><div class="panel-grid">`;
      (arg.symbols||['Seed','Bell','Glass','Ash']).forEach((v,i)=>html+=this.action(v,()=>this.puzzle(i),{cls:'panel-card'}));html+='</div>';
    }else if(type==='about'||type==='credits'){
      title=type==='credits'?'The hands behind the hours':'Threads of the Last Dawn';kicker='AN ORIGINAL ROLE-PLAYING GAME';
      html='<p>An original, finite adventure inspired by the design of Chrono Trigger for SNES. The story, characters, maps, title art, boss art, and music are new. Humanoids, common creatures, and props use the engine drawing systems.</p><h3>The Small Hours · Version 1.4.0</h3><p>Eight main chapters. Five full world maps. Five dungeons with twenty-five rooms. Eighty-four expansion missions. Eighteen Small Hours side stories in familiar places. Sixteen field notes and eighteen tactical trial medals. Fifteen new Hearthbound places. Six travelers and six companion quests. Four endings. New Game +. Field abilities, crafting, mastery skills, and six elite trials. A growing town with twelve project stages. Eight meals, gathering paths, three party loadouts, and six repeatable five-stage expeditions.</p><h3>Credits</h3><p>Game design, code, world art, and music: created in this ChatGPT session.<br>Engine: my-3D2dge by Michael Crosato, under the MIT License.</p><h3>Source information</h3><table class="source-table"><tr><th>Initial Date</th><td>2026-10-11</td></tr><tr><th>SOURCE</th><td>Chrono Trigger (SNES)</td></tr><tr><th>GAME ENGINE</th><td>my-3D2dge 0.24.0<br>Commit 240dc2fe39b14fc5cc1ebbed796c29dd827d8ab6</td></tr><tr><th>Environment</th><td>ChatGPT cloud workspace. Linux x86_64. Bash CLI. Canvas 2D and Web Audio browser game.</td></tr><tr><th>Model and Effort Level</th><td>GPT-6 Astra Pro. Reasoning effort level cannot be confirmed.</td></tr></table><h3>Source files</h3><p><a href="threads-of-the-last-dawn-source.zip" download>Download the complete source</a><br><a href="README.md" target="_blank" rel="noopener">Read the source guide</a><br><a href="docs/EXPANSION.md" target="_blank" rel="noopener">Read the full expansion walkthrough</a></p><p><a href="docs/DEPTHS.md" target="_blank" rel="noopener">Read The Far Shore walkthrough</a></p><p><a href="docs/HEARTHBOUND.md" target="_blank" rel="noopener">Read The Hearthbound Roads walkthrough</a><br><a href="docs/EXPEDITIONS.md" target="_blank" rel="noopener">Read the expedition guide</a><br><a href="docs/HEARTH-SYSTEMS.md" target="_blank" rel="noopener">Read the town, cooking, and loadout guide</a></p><p><a href="docs/SMALL-HOURS.md" target="_blank" rel="noopener">Read The Small Hours walkthrough</a><br><a href="docs/SMALL-HOURS-SYSTEMS.md" target="_blank" rel="noopener">Read the route and preparation guide</a><br><a href="docs/COMBAT-POLISH.md" target="_blank" rel="noopener">Read the battle and trial medal guide</a></p><h3>Research references</h3><p><a href="https://shrines.rpgclassics.com/snes/ct/walkthrough.shtml" target="_blank" rel="noopener">RPGClassics SNES walkthrough</a><br><a href="https://guides.gamercorner.net/ct/systems/" target="_blank" rel="noopener">Gamer Corner: game systems</a><br><a href="https://www.chronowiki.org/wiki/Tech" target="_blank" rel="noopener">Chrono Wiki: techniques</a><br><a href="https://www.chronowiki.org/wiki/List_of_Chrono_Trigger_endings" target="_blank" rel="noopener">Chrono Wiki: endings</a></p><h3>Controls and access</h3><p>Keyboard, controller, and touch input. Rebind controls from Settings. Use reduced motion, volume, and screen settings in the standard engine menu.</p><p>Browser interaction and live audio still need a device check. Logic and engine rendering were checked in Linux without a browser.</p>';
      footer=this.action('Close',()=>this.close(),{primary:true});
    }
    this.text('panel-title',title);this.text('panel-kicker',kicker);this.el('panel-body').innerHTML=html;this.el('panel-footer').innerHTML=footer||this.action('Back to the journey',()=>this.close(),{primary:true});this.el('panel-body').scrollTop=0;
    const focus=this.el('panel-body').querySelector('button.primary:not(:disabled)')||this.el('panel-body').querySelector('button:not(:disabled)')||this.el('panel-footer').querySelector('button:not(:disabled)');focus?.focus({preventScroll:true});this.focusIndex=[...this.el('panel').querySelectorAll('button:not(:disabled)')].indexOf(focus);this.dirty=true;
  }
  ring(i){
    const a=this.app,e=this.bellEntity||{},pattern=this.bellPattern||[0,2,1,3];
    if(a.panel?.type!=='bells'||a.battle||a.expeditionActive?.()||!a.meets(e.requires)||!Number.isInteger(i)||i<0||i>3)return false;
    a.game.audio.sfx({wave:'sine',freq:[330,440,550,660][i],dur:.45,vol:.13});
    if(i===pattern[this.bellStep]){this.bellStep++;this.text('bell-hint','Clear notes: '+this.bellStep+' / '+pattern.length);if(this.bellStep===pattern.length){const flag=e.flag||'bell_game_won',paid=!!a.state.flags[flag];if(!paid)a.apply([{type:'flag',id:flag},...(e.effects||[{type:'gold',amount:20}])]);this.text('bell-hint',paid?'The refrain is complete. No second reward is paid.':e.rewardText||'The refrain is complete. The keeper gives you 20 crowns.');this.bellStep=0;}return true;}
    this.bellStep=0;this.text('bell-hint','That note does not fit. Start again: '+pattern.map(n=>['LOW','MID','HIGH','CLEAR'][n]).join(' · ')+'.');return false;
  }
  puzzle(i){const p=this.puzzleEntity;if(this.app.panel?.type!=='puzzle'||!p||!this.app.meets(p.requires)||p.hideIf&&this.app.meets(p.hideIf))return;const seq=p.sequence||[0,1,2,3];if(i===seq[this.puzzleStep]){this.puzzleStep++;this.text('puzzle-hint',`${this.puzzleStep} / ${seq.length} seals open.`);if(this.puzzleStep===seq.length){this.app.apply(p.effects);this.app.toast('The four hours agree. The lock opens.',4);this.close();}}else{this.puzzleStep=0;this.text('puzzle-hint','The first seal closes. Read the marks again.');}}
  export(){const a=this.app;if(!a.state)return;if(a.battle||a.expeditionCheckpoint?.()===false){a.toast('Reach an expedition checkpoint before exporting your save.',4);return false;}a.save('auto',true);const blob=new Blob([JSON.stringify(a.state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='threads-of-the-last-dawn-save.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
  updatePanel(){if(!this.dom)return;const I=this.app.game.input;if(I.pressed('cancel')||I.pressed('pause')){this.close();return;}const buttons=[...this.el('panel').querySelectorAll('button:not(:disabled)')];if(I.repeat('down')||I.repeat('right')){this.focusIndex=(this.focusIndex+1)%buttons.length;buttons[this.focusIndex]?.focus();}if(I.repeat('up')||I.repeat('left')){this.focusIndex=(this.focusIndex+buttons.length-1)%buttons.length;buttons[this.focusIndex]?.focus();}if(I.pressed('confirm')){const e=document.activeElement;if(buttons.includes(e))e.click();I.consumeAll();}}
  endingAction(action){
    const a=this.app;if(action==='plus')this.newJourney(true);else if(action==='credits')this.open('credits');else if(action==='next'){this.endingPage=Math.min((this.endingPages||1)-1,(this.endingPage||0)+1);this.ending();}else if(action==='prev'){this.endingPage=Math.max(0,(this.endingPage||0)-1);this.ending();}else if(action==='return'){a.state.ending=null;a.mode='field';a.game.go('field');a.travel('fold_crown');}a.game.input.consumeAll();
  }
  updateEndingKeyboard(){
    if(!this.dom)return;const I=this.app.game.input,buttons=[...this.el('ending-overlay').querySelectorAll('button:not(:disabled)')];if(!buttons.length)return;
    let index=buttons.indexOf(document.activeElement);if(index<0)index=Math.max(0,buttons.findIndex(b=>['next','plus'].includes(b.dataset.endingAction)));
    if(I.repeat('down')||I.repeat('right')||I.pressed('cycle'))index=(index+1)%buttons.length;
    if(I.repeat('up')||I.repeat('left'))index=(index+buttons.length-1)%buttons.length;
    if(document.activeElement!==buttons[index])buttons[index].focus({preventScroll:true});if(I.pressed('confirm')){buttons[index].click();I.consumeAll();}
  }
  ending(){
    const a=this.app,id=a.state.ending,end=Array.isArray(a.content.endings)?a.content.endings.find(e=>e.id===id):a.content.endings[id];if(!end)return;
    const quests=a.content.quests.filter(q=>a.state.flags[q.completeFlag]).length,paragraphs=(end.lines||[]).map(s=>`<p>${esc(s)}</p>`);
    for(const [hero,p]of Object.entries(end.epilogues||{})){const complete=a.meets(p.requires);paragraphs.push(`<p><strong>${esc(a.content.heroes[hero]?.name)}</strong> · ${esc(complete?p.complete:p.base)}</p>`);}
    const pages=Math.max(1,Math.ceil(paragraphs.length/2)),page=Math.min(this.endingPage||0,pages-1),last=page===pages-1;this.endingPages=pages;
    this.html('ending-overlay',`<div class="ending-copy"><div class="eyebrow">${a.profile.endings.length} / 4 ENDINGS DISCOVERED · PAGE ${page+1} / ${pages}</div><h2>${esc(end.title)}</h2><p><em>${esc(end.subtitle||'')}</em></p>${paragraphs.slice(page*2,page*2+2).join('')}<div class="ending-stats"><span>${quests} / 6 threads restored</span><span>${a.state.battles} battles won</span><span>${Math.floor(a.state.playtime/60)} minutes</span></div>${page>0?'<button class="secondary-button" data-ending-action="prev">← Previous</button>':''}${!last?'<button class="gold-button" data-ending-action="next">The next thread <span>→</span></button>':'<button class="gold-button" data-ending-action="plus">New Game + <span>↗</span></button><button class="secondary-button" data-ending-action="credits">Credits and sources</button>'}${last&&id!=='early'?'<button class="text-button" data-ending-action="return">Return before the choice</button>':''}</div>`);
    this.text('status-text','The journey is complete. A new thread awaits.');
  }
}
D.UI=UI;
})();
