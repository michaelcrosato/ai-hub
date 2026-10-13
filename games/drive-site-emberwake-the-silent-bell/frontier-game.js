/* Playable frontier scenes, using the supplied my-3d2dge engine and combat rules. */
(function(root){
 'use strict';
 const E=root.My3D2dge,A=root.EW,Art=root.EWFrontierArt,T=Art.TILE_SIZE;
 const $=id=>document.getElementById(id),show=(id,on=true)=>$(id).classList.toggle('hidden',!on);
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const btn=(label,action,primary=false,disabled=false,extra='')=>'<button data-frontier="'+action+'" class="'+(primary?'primary':'')+'" '+(disabled?'disabled ':'')+extra+'>'+label+'</button>';
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const INPUT={up:['KeyW','ArrowUp','Pad12'],down:['KeyS','ArrowDown','Pad13'],left:['KeyA','ArrowLeft','Pad14'],right:['KeyD','ArrowRight','Pad15'],interact:['KeyE','Pad0'],mount:['KeyM','Pad3'],turnLeft:['KeyQ','Pad4'],turnRight:['KeyR','Pad5'],run:['ShiftLeft','ShiftRight'],pause:['Escape','Pad9']};
 const SCORE={bpm:76,steps:2,tracks:[{wave:'sine',vol:.14,notes:'D5 - - - A4 - F5 - | E5 - - - D5 - - - | G5 - F5 - E5 - D5 - | A4 - - - D5 - - -'},{wave:'triangle',vol:.07,notes:'D3 - A3 - F4 - A3 - | C3 - G3 - E4 - G3 - | Bb2 - F3 - D4 - F3 - | A2 - E3 - A3 - - -'}]};
 class FrontierGame{
  constructor(options){
   this.options=options;this.active=false;this.world=null;this.expedition=null;this.modal=false;this.battle=null;this.near=null;this.uiClock=0;this.saveClock=0;this.sound=false;this.target=null;this.units={};this.events=[];this.event=null;this.busy=false;this.displayHP={};this.battleFinished=false;
   this.hero=A.makeUnit('mira',0,0);this.companion=A.makeUnit('oren',0,0);this.morrow=new A.Mech('morrow');
   this.portrait=$('frontier-stage').clientWidth<560;
   this.game=new E.Game({canvas:$('frontier-canvas'),res:this.portrait?[480,620]:[768,480],fit:'contain',view:new E.View('frontier','Frontier',45,34,1.35,1),bg:'#173641',input:INPUT});
   this.game.pauseOverlay=false;this.game.cam.smooth=.13;this.game.audio.setVolume(.3);this.game.audio.mute(true);this.game.input.touchEnabled=false;
   this.game.start({update:dt=>this.update(dt),draw:r=>this.draw(r)});
   this.bind();
  }
  get isInBattle(){return !!this.battle;}
  notify(text){this.options.notify?.(text);}
  changed(){this.options.onChange?.(this.expedition);}
  setExpedition(world,expedition){
   this.world=world;this.expedition=expedition;this.battle=null;this.busy=false;this.event=null;this.events=[];this.closeModal();this.target=null;this.near=null;Art.clearCache(world);if(expedition){this.place();this.fieldView();this.renderHUD();}else{this.active=false;this.game.paused=true;this.game.audio.stopMusic();}
  }
  place(){const p=this.expedition.state.position;this.hero.x=p.x*T;this.hero.y=p.y*T;this.hero.vx=this.hero.vy=0;this.companion.x=this.hero.x-12;this.companion.y=this.hero.y+12;this.game.cam.snap=true;}
  show(){this.active=true;this.game.paused=false;this.game.input.use(INPUT);this.game.input.clear();this.game.screen.resize();if(this.battle)this.battleView();else{this.expedition.ensurePosition();this.place();this.fieldView();}if(this.sound)this.game.audio.music(SCORE);$('frontier-canvas').focus({preventScroll:true});this.renderHUD();}
  hide(){if(this.battle){this.notify('Finish the encounter, or retreat to camp, before opening the atlas.');return false;}this.active=false;this.game.paused=true;this.game.input.clear();this.game.input.use({});this.game.audio.stopMusic();this.closeModal();this.changed();return true;}
  fieldView(){if(!this.expedition)return;this.game.yaw=0;this.game.setView(new E.View('frontier','Frontier',45,34,this.expedition.state.mounted?1.05:1.4,1));this.game.cam.offset=[0,this.portrait?0:26];this.game.focus(this.hero.x,this.hero.y,8);this.game.cam.snap=true;}
  bind(){
   $('mount-button').addEventListener('click',()=>this.mount());$('camp-button').addEventListener('click',()=>this.askReturn());
   $('frontier-help-button').addEventListener('click',()=>this.help());$('frontier-interact').addEventListener('click',()=>this.interact());$('touch-frontier-use').addEventListener('click',()=>this.interact());
   for(const el of document.querySelectorAll('[data-direction]')){
    const action=el.dataset.direction,code='Act:'+action;
    el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture(e.pointerId);if(this.active&&!this.modal&&!this.battle)this.game.input.press(code);});
    for(const ev of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(ev,()=>this.game.input.release(code));
   }
   $('frontier-canvas').addEventListener('pointerdown',e=>{
    if(!this.active||this.battle||this.modal||e.button!==0||e.pointerType==='touch')return;
    const [sx,sy]=this.game.screen.clientToScreen(e.clientX,e.clientY),p=this.game.view.toGround(sx,sy);
    if(this.walkable(p[0],p[1])){this.target=p;this.game.input.clear();}
   });
   $('frontier-stage').addEventListener('click',e=>{const b=e.target.closest('[data-frontier]');if(b&&!b.disabled)this.action(b.dataset.frontier,b);});
   document.addEventListener('keydown',e=>{
    if(!this.active)return;
    if(!this.modal&&/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)){this.game.input.clear();e.stopPropagation();return;}
    if(this.modal){
     if(e.key==='Tab'){const els=[...$('frontier-modal').querySelectorAll('button:not([disabled]),select,input')];if(els.length){const first=els[0],last=els[els.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}
     if(e.code==='Escape'){e.preventDefault();e.stopPropagation();if(this.modalClosable)this.closeModal();}return;
    }
    if(!this.battle||e.repeat||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;
    if(e.code==='Enter'&&e.target.closest?.('button,a'))return;
    const gear=this.battle.kind==='gear',actions={Digit1:gear?'strike':'q1',Digit2:gear?'lance':'q2',Digit3:gear?'finish':'q3',Digit4:gear?'charge':null,Enter:gear?'strike':'attack',KeyG:gear?'charge':'guard',KeyV:gear?'boost':'skill',KeyI:gear?'repair':'item',Backspace:'undo',KeyT:'next-target'};
    if(actions[e.code]){e.preventDefault();this.action(actions[e.code]);}
   });
   if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>{
    if(!this.active)return;const next=$('frontier-stage').clientWidth<560;
    if(next!==this.portrait){this.portrait=next;this.game.screen.setOptions({res:next?[480,620]:[768,480]});if(this.battle)this.battleView();else this.fieldView();}else this.game.screen.resize();
   }).observe($('frontier-stage'));
  }
  walkable(x,y){if(!this.world)return false;const radius=this.expedition.state.mounted?7:4;return [[0,0],[radius,0],[-radius,0],[0,radius],[0,-radius]].every(p=>this.world.tile((x+p[0])/T,(y+p[1])/T).passable);}
  update(dt){
   if(!this.active||!this.expedition)return;
   if(this.modal||!$('forge-dialog').classList.contains('hidden')){this.game.input.clear();return;}
   if(!this.battle&&/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName||'')){this.game.input.clear();return;}
   if(this.battle){this.updateBattle(dt);return;}
   const I=this.game.input,s=this.expedition.state;
   if(I.pressed('pause')){this.help();return;}if(I.pressed('mount'))this.mount();if(I.pressed('interact')){this.interact();if(this.modal||this.battle)return;}
   if(I.pressed('turnLeft')){this.game.rotateView(-90);this.target=null;}if(I.pressed('turnRight')){this.game.rotateView(90);this.target=null;}
   const v=I.move();let d=[0,0];if(Math.hypot(...v)>.05){d=this.game.view.screenDirToGround(v[0],v[1]);this.target=null;}
   else if(this.target){const dx=this.target[0]-this.hero.x,dy=this.target[1]-this.hero.y,n=Math.hypot(dx,dy);if(n<4)this.target=null;else d=[dx/n,dy/n];}
   const speed=s.mounted?135:I.down('run')?115:77,oldX=this.hero.x,oldY=this.hero.y;
   const x=this.hero.x+d[0]*speed*dt,y=this.hero.y+d[1]*speed*dt;
   if(this.walkable(x,this.hero.y))this.hero.x=x;if(this.walkable(this.hero.x,y))this.hero.y=y;
   this.hero.vx=(this.hero.x-oldX)/dt;this.hero.vy=(this.hero.y-oldY)/dt;
   const moving=Math.hypot(this.hero.vx,this.hero.vy)>1;if(moving){this.hero.facing=Math.atan2(this.hero.vy,this.hero.vx);this.expedition.setPosition(this.hero.x/T,this.hero.y/T);}else if(this.target&&Math.hypot(...d)>.1)this.target=null;
   this.hero.z=Art.elevation(this.world.tile(this.hero.x/T,this.hero.y/T));this.hero.rig.update(dt,{...this.hero});
   const followX=this.hero.x-Math.cos(this.hero.facing)*20,followY=this.hero.y-Math.sin(this.hero.facing)*20,dx=followX-this.companion.x,dy=followY-this.companion.y;
   const k=Math.min(1,dt*5);this.companion.vx=dx*5;this.companion.vy=dy*5;this.companion.x+=dx*k;this.companion.y+=dy*k;this.companion.z=this.hero.z;if(Math.hypot(dx,dy)>2)this.companion.facing=Math.atan2(dy,dx);this.companion.rig.update(dt,{...this.companion});
   this.morrow.update(dt,{walk:moving,facing:this.hero.facing});this.game.focus(this.hero.x,this.hero.y,8);
   this.uiClock+=dt;this.saveClock+=moving?dt:0;
   if(this.uiClock>.25){this.uiClock=0;this.findNear();this.renderHUD();this.options.onStats?.(this.world.stats());}
   if(this.saveClock>8){this.saveClock=0;this.changed();}
  }
  findNear(){
   const p=this.expedition.state.position,s=this.expedition.state;
   let nearest=null,distance=3.4;
   for(const f of [{...s.camp,id:'camp',kind:'camp',name:'Wayfarer Camp'},...s.nodes.map(n=>({...n,kind:'mission-relay'})),...this.world.sitesInRect(Math.floor(p.x-4),Math.floor(p.y-4),Math.ceil(p.x+4),Math.ceil(p.y+4),20)]){
    const d=Math.hypot(p.x-f.x-.5,p.y-f.y-.5);if(d<distance){nearest=f;distance=d;}
   }this.near=nearest;
  }
  renderHUD(){
   if(!this.expedition)return;const s=this.expedition.state,n=this.expedition.nextNode;
   $('expedition-objective').textContent=s.completed?'The frontier is open':n?'Reach '+n.name:'Return to Wayfarer Camp';
   $('expedition-progress').textContent=this.expedition.restored+' / 3 relays online · '+s.stats.renown+' renown';
   $('mount-button').innerHTML=(s.mounted?'Leave Morrow':'Board Morrow')+' <kbd>M</kbd>';
   const vitals=s.mounted?[{name:'Morrow',hp:s.gear.hp,max:s.module==='aegis'?680:600,small:Math.round(s.gear.fuel)+' fuel · '+s.module}]:Object.entries(s.party).map(([id,p])=>({...p,name:id==='mira'?'Mira':'Oren',small:p.ep+' / '+p.maxEp+' EP'}));
   $('frontier-party').innerHTML=vitals.map(p=>'<div class="vital-card"><strong>'+p.name+'</strong><div class="bar"><i style="width:'+p.hp/p.max*100+'%"></i></div><small>'+p.hp+' / '+p.max+' HP · '+p.small+'</small></div>').join('');
   const tile=this.world.tile(s.position.x,s.position.y),dist=n?Math.ceil(Math.hypot(n.x+.5-s.position.x,n.y+.5-s.position.y)):Math.ceil(Math.hypot(s.camp.x+.5-s.position.x,s.camp.y+.5-s.position.y));
   $('frontier-coordinates').textContent=Math.floor(s.position.x)+', '+Math.floor(s.position.y)+' · '+root.EWWorld.BIOMES[tile.biome].label;
   $('frontier-status').textContent=(n?n.name:'Camp')+' · '+dist+' tiles away · '+s.inventory.kits+' field kits';
   show('frontier-interact',!!this.near&&!this.battle);if(this.near)$('frontier-interact').textContent='E · '+(this.near.kind==='camp'?'Rest at camp':this.near.completed?'Read restored relay':this.near.name);
   show('frontier-hud',!this.battle);show('frontier-battle',!!this.battle);
  }
  mount(){if(!this.active||this.modal||this.battle)return;this.expedition.toggleMount();this.game.audio.sfx('powerup',{vol:.4});this.target=null;this.fieldView();this.renderHUD();this.changed();}
  openModal(html,closable=true){this.modal=true;this.modalClosable=closable;this.target=null;this.game.input.clear();$('frontier-modal').innerHTML='<div class="dialog-card">'+html+'</div>';const heading=$('frontier-modal').querySelector('h2');if(heading){heading.id='frontier-dialog-title';$('frontier-modal').setAttribute('aria-labelledby',heading.id);}show('frontier-modal');$('frontier-modal').querySelector('button,select')?.focus({preventScroll:true});}
  closeModal(){this.modal=false;show('frontier-modal',false);this.game?.input.clear();if(this.active)$('frontier-canvas').focus({preventScroll:true});}
  help(){
   if(!this.active)return;
   this.openModal('<div class="eyebrow">FIELD GUIDE</div><h2>A road for every voice.</h2><p>Follow the gold roads from camp. Restore Amber, Glass, then Dawn. Return to camp to complete the expedition. You can survey the wider world before or after extraction.</p><p><strong>Move:</strong> WASD, arrows, or click clear ground. Hold Shift to run. <strong>E</strong> uses a nearby site. <strong>M</strong> boards Morrow. <strong>Q / R</strong> turns the camera. Touch controls appear on touch devices.</p><p><strong>Human combat:</strong> choose 1, 2, 3 then Strike for Bellbreaker. Unused AP carry to the next turn, up to 3. Guard restores EP. Oren heals the party. Read the enemy intent.</p><p><strong>Morrow:</strong> build Drive, then use Dawn Break. Brace before Bellfall to reduce damage, restore fuel, and cool heat. Boost increases damage and heat. The last relay needs Morrow even if you arrive on foot.</p><p>Return to camp restores the party. Defeat lets you retry from the encounter checkpoint. Saving during combat keeps that checkpoint.</p><div class="dialog-buttons">'+btn('Continue','close',true)+btn('Sound '+(this.sound?'on':'off'),'sound')+(this.battle?btn('Retreat to camp','retreat'):'')+'</div>');
  }
  askReturn(){if(!this.active||this.modal)return;this.openModal('<div class="eyebrow">WAYFARER CAMP</div><h2>Return to camp?</h2><p>The party will return to the camp and recover. Restored relays and survey records stay in your expedition.</p><div class="dialog-buttons">'+btn('Return and rest','retreat',true)+btn('Keep exploring','close')+'</div>');}
  camp(){
   const s=this.expedition.state;
   this.openModal('<div class="eyebrow">WAYFARER CAMP</div><h2>A light on the frontier.</h2><p>Oren tends the fire. Morrow waits beside the supply crates. Rest here, fit a module, or return after restoring all three relays.</p><p><strong>Module:</strong> '+esc(s.module)+'. Balanced uses standard armor. Aegis raises integrity to 680. Coil adds attack power and restores more fuel when you Brace.</p><div class="dialog-buttons">'+btn('Rest and resupply','rest',true)+btn('Balanced','module-balanced')+btn('Aegis','module-aegis')+btn('Coil','module-coil')+'</div><div class="dialog-buttons">'+(this.expedition.restored===3&&!s.completed?btn('Complete expedition','extract',true):'')+btn('Leave camp','close')+'</div>');
  }
  interact(){
   if(!this.active||this.modal||this.battle)return;this.findNear();const n=this.near;if(!n){this.notify('Move closer to a camp, relay, or named location.');return;}
   if(n.kind==='camp'){this.camp();return;}
   if(n.kind==='mission-relay'){
    if(n.completed){this.openModal('<div class="eyebrow">SIGNAL RESTORED</div><h2>'+esc(n.name)+'</h2><p>The relay answers in a clear tone. Its route is part of the network again.</p><div class="dialog-buttons">'+btn('Continue','close',true)+'</div>');return;}
    if(this.expedition.nextNode.id!==n.id){this.notify('Restore '+this.expedition.nextNode.name+' first.');return;}
    this.openModal('<div class="eyebrow">'+(n.scenario==='gear'?'MACHINE ENCOUNTER':'RELAY ENCOUNTER')+'</div><h2>'+esc(n.name)+'</h2><p>'+esc(n.description)+'</p><p>'+(n.scenario==='gear'?'The Relay Colossus carries an unstable core. Watch its intent. Brace before Bellfall, manage heat, and build Drive for Dawn Break.':'A guardian holds the signal closed. Build named strike sequences and watch the next attack. Your checkpoint is kept here.')+'</p><div class="dialog-buttons">'+btn(n.scenario==='gear'?'Pilot Morrow':'Face the guardian','encounter-'+n.id,true)+btn('Prepare first','close')+'</div>');return;
   }
   const result=this.expedition.visit(n);this.changed();this.openModal('<div class="eyebrow">'+esc(n.kind.toUpperCase())+'</div><h2>'+esc(n.name)+'</h2><p>'+esc(n.description)+'</p><p>'+(result.ok?esc(result.benefit)+' <strong>+'+result.reward+' renown.</strong>':esc(result.reason))+'</p><div class="dialog-buttons">'+btn('Continue','close',true)+'</div>');
  }
  startBattle(descriptor){
   this.closeModal();this.battle=new A.Battle(descriptor.scenario,descriptor.state);this.battleNode=descriptor.node;this.battleFinished=false;this.busy=false;this.events=[];this.event=null;this.displayHP={};this.units={};
   const names=descriptor.scenario==='gear'?['Relay Colossus']:descriptor.scenario==='hall'?['Glass Warden','Signal Drone']:['Amber Sentry'];this.battle.enemies.forEach((e,i)=>e.name=names[i]);
   const places={mira:[-74,13],oren:[-51,70],warden:[93,21],drone:[83,-39],morrow:[-85,28],cantor:[103,10]};
   for(const p of [...this.battle.party,...this.battle.enemies]){
    const loc=places[p.id],u=this.battle.kind==='gear'?{id:p.id,x:loc[0],y:loc[1],z:0,mech:new A.Mech(p.id)}:A.makeUnit(p.id,...loc);u.home=loc.slice();u.facing=this.battle.party.includes(p)?0:Math.PI;u.dead=p.hp<=0;u.hurt=0;this.units[p.id]=u;this.displayHP[p.id]=p.hp;
   }
   this.battleView();this.renderHUD();this.renderBattle();this.changed();
  }
  battleView(){const gear=this.battle.kind==='gear';this.game.yaw=0;this.game.setView(new E.View('frontier-battle','Relay battle',gear?14:20,gear?27:29,gear?(this.portrait?1.1:1.55):(this.portrait?1.45:2.05),1));this.game.cam.offset=[0,this.portrait?-60:-48];this.game.cam.snap=true;this.game.focus(17,6,gear?36:23);}
  renderBattle(){
   const b=this.battle;if(!b)return;const gear=b.kind==='gear',a=b.actor;
   const focused=$('frontier-battle').contains(document.activeElement)?document.activeElement:null,focusAction=focused?.dataset.frontier,focusIndex=focused?.dataset.index;
   const enemies=b.enemies.map((e,i)=>this.displayHP[e.id]<=0?'':'<button class="enemy-card '+(b.target===i?'active':'')+'" data-frontier="target" data-index="'+i+'" '+(this.busy?'disabled':'')+'><strong>'+esc(e.name)+'</strong><div class="bar red"><i style="width:'+this.displayHP[e.id]/e.max*100+'%"></i></div><small>'+this.displayHP[e.id]+' / '+e.max+' HP · '+(e.stagger?'BROKEN':'Guard '+e.poise+'/'+e.maxPoise)+'</small><small class="intent">NEXT · '+esc((this.intentBefore||b.intent).find(v=>v.id===e.id)?.name||b.enemyIntent(e).name)+'</small></button>').join('');
   const party=b.party.map(p=>'<div><strong>'+p.name+'</strong> · '+this.displayHP[p.id]+' / '+p.max+(gear?' integrity':' HP · '+p.ep+' EP')+'</div>').join('');
   let command;
   if(this.busy)command='<div class="eyebrow">'+(gear?'MACHINE IN MOTION':'SEQUENCE IN MOTION')+'</div><div class="battle-event" role="status">'+esc(this.event?.name||'The relay answers')+'</div><div class="battle-event-note">'+(this.event?.type==='hit'?'Impact · '+this.event.amount+' damage':'Watch the next action.')+'</div><div class="battle-utilities">'+btn('Skip animation','skip')+'</div>';
   else if(!gear){const remain=b.ap-b.spent;command='<div class="command-heading"><strong>'+a.name+' · build a sequence</strong><span>'+remain+' / '+b.ap+' AP</span></div><div class="sequence-preview">'+(b.seq.length?b.seq.join(' · ')+' — ':'')+esc(b.preview())+'</div><div class="battle-commands">'+btn('1 · Jab<small>1 AP</small>','q1',false,remain<1)+btn('2 · Palm<small>2 AP</small>','q2',false,remain<2)+btn('3 · Kick<small>3 AP</small>','q3',false,remain<3)+btn('Strike<small>Enter</small>','attack',true,!b.seq.length)+'</div><div class="battle-utilities">'+btn('Undo','undo',false,!b.seq.length)+btn('Guard · +8 EP','guard')+btn(a.id==='oren'?'Quiet Current · 12 EP':'Ember Pulse · 12 EP','skill',false,a.ep<12)+btn('Kit · '+b.inventory.kits,'item',false,!b.inventory.kits||b.party.every(p=>p.hp>=p.max))+btn('Sequences','sequences')+btn('Guide / retreat','guide')+'</div>';}
   else{const extra=b.boost?10:0,hot=b.heat>=85;command='<div class="command-heading"><strong>Morrow · pilot command</strong><span>Drive '+b.drive+' / 3 · Phase '+b.phase+'</span></div><div class="gear-gauges"><div>FUEL '+Math.round(b.fuel)+'<div class="bar"><i style="width:'+b.fuel+'%"></i></div></div><div>HEAT '+b.heat+(hot?' · VENT':'')+'<div class="bar '+(b.heat>=70?'red':'gold')+'"><i style="width:'+b.heat+'%"></i></div></div></div><div class="battle-commands">'+btn('Iron Reach<small>'+(18+extra)+' fuel · +1 Drive</small>','strike',false,hot||b.fuel<18+extra)+btn('Resonance Lance<small>'+(26+extra)+' fuel · break guard</small>','lance',false,hot||b.fuel<26+extra)+btn('Dawn Break<small>'+(30+extra)+' fuel · 2+ Drive</small>','finish',true,hot||b.fuel<30+extra||b.drive<2)+btn('Brace<small>Fuel up · heat down</small>','charge')+'</div><div class="battle-utilities">'+btn('Boost '+(b.boost?'ON':'OFF'),'boost')+btn('Repair cell · '+b.repairs,'repair',false,!b.repairs||a.hp>=a.max)+btn('Guide / retreat','guide')+'</div>';}
   $('frontier-battle').innerHTML='<div class="battle-top"><div class="battle-title">'+esc(this.battleNode.name)+'<small>ROUND '+b.round+' · '+(gear?'MACHINE COMBAT':'CLOSE COMBAT')+'</small></div><div class="enemy-cards">'+enemies+'</div></div><div class="battle-panel"><div class="battle-party">'+party+'</div>'+command+'</div>';
   if(focusAction){const selector='[data-frontier="'+focusAction+'"]'+(focusIndex!==undefined?'[data-index="'+focusIndex+'"]':'');const replacement=$('frontier-battle').querySelector(selector);(replacement&&!replacement.disabled?replacement:$('frontier-battle').querySelector('button:not([disabled])'))?.focus({preventScroll:true});}
  }
  command(cmd){if(!this.battle||this.busy||this.modal)return;const before=this.battle.intent,result=this.battle.command(cmd);if(!result.ok){this.notify(result.reason);return;}if(result.free){this.renderBattle();return;}this.intentBefore=before;this.busy=true;this.events=result.events.slice();this.nextEvent();}
  resetUnits(){for(const u of Object.values(this.units)){u.x=u.home[0];u.y=u.home[1];u.attack=null;u.pose=u.dead?'die':u.guarding?'guard':null;}}
  nextEvent(){
   this.resetUnits();this.eventTime=0;this.event=this.events.shift()||null;
   if(!this.event){this.busy=false;this.intentBefore=null;this.renderBattle();if(this.battle.result)this.finishBattle();return;}
   const e=this.event,u=this.units[e.from];e.duration=(e.type==='hit'?(e.gear?.66:e.finisher?.65:.38):e.type==='phase'?.95:.4)*(this.game.reduceMotion?.55:1);e.applied=false;
   if(e.type==='hit'&&u){u.guarding=false;u.attack=new E.Attack(e.move||'cross',{wind:e.duration*.27,active:e.duration*.24,recover:e.duration*.49});u.attack.start();}
   if(['cast','charge'].includes(e.type)&&u)u.pose='cast';if(e.type==='guard'&&u){u.guarding=true;u.pose='guard';}
   if(e.type==='phase')e.name='The relay core opens';if(e.type==='victory')e.name='Signal restored';this.renderBattle();
  }
  applyEvent(e){
   e.applied=true;const to=this.units[e.to];
   if(e.type==='hit'&&to){this.displayHP[e.to]=e.hp;to.hurt=.3;this.game.hitFx(to.x,to.y,e.gear?55:22,{power:e.finisher?1.6:1,damage:e.amount,color:e.ether?'#8bd9c1':'#efbd79',sound:e.gear?'boom':e.ether?'laser':'punch',textScale:e.gear?2:1,textZ:24});}
   if(e.type==='heal'&&to){this.displayHP[e.to]=e.hp;to.dead=false;this.game.particles.text(to.x,to.y,38,'+'+e.amount,'#a9e4c5');this.game.audio.sfx('heal',{vol:.5});}
   if(e.type==='down'&&to){to.dead=true;to.pose='die';}
   if(e.type==='break'&&to){this.game.particles.text(to.x,to.y,46,'BREAK','#efc278');this.game.audio.sfx('bump',{vol:.5});}
   if(e.type==='victory')this.game.audio.sfx('powerup',{vol:.6});this.renderBattle();
  }
  updateBattle(dt){
   if(this.event){const e=this.event;this.eventTime+=dt;const progress=clamp(this.eventTime/e.duration,0,1),from=this.units[e.from],to=this.units[e.to];
    if(e.type==='hit'&&from&&to&&from!==to&&!e.ether){const dx=to.home[0]-from.home[0],dy=to.home[1]-from.home[1],len=Math.hypot(dx,dy)||1,travel=Math.max(0,len-(this.battle.kind==='gear'?68:29)),k=progress<.3?1-Math.pow(1-progress/.3,3):progress>.72?1-(progress-.72)/.28:1;from.x=from.home[0]+dx/len*travel*k;from.y=from.home[1]+dy/len*travel*k;}
    if(!e.applied&&progress>=.43)this.applyEvent(e);if(this.eventTime>=e.duration)this.nextEvent();
   }
   for(const u of Object.values(this.units)){u.hurt=Math.max(0,(u.hurt||0)-dt);u.attack?.update(dt);const from=this.event?.from===u.id,progress=this.event?clamp(this.eventTime/this.event.duration,0,1):0;
    if(u.mech)u.mech.update(dt,{facing:u.facing,pose:u.dead?'hurt':from&&this.event?.type==='hit'?(this.event.ether?'cast':'attack'):u.pose==='cast'?'cast':u.guarding?'guard':'idle',action:progress,hit:u.hurt});
    else u.rig.update(dt,{...u,attack:u.attack?.state,pose:u.dead?'die':u.pose,stance:u.dead?null:'guard',hurt:u.hurt>0});
   }
  }
  skipAnimation(){if(!this.battle||!this.busy)return;for(const p of [...this.battle.party,...this.battle.enemies]){this.displayHP[p.id]=p.hp;this.units[p.id].dead=p.hp<=0;this.units[p.id].guarding=p.guard;}this.events=[];this.event=null;this.busy=false;this.intentBefore=null;this.resetUnits();this.game.hitstop=0;this.game.shakeAmt=0;this.renderBattle();if(this.battle.result)this.finishBattle();}
  finishBattle(){
   if(this.battleFinished)return;this.battleFinished=true;
   if(this.battle.result==='defeat'){this.openModal('<div class="eyebrow">SIGNAL LOST</div><h2>The road is still here.</h2><p>Retry with the supplies you had at the start of this encounter, or return to camp. Story mode reduces incoming damage.</p><div class="dialog-buttons">'+btn('Retry encounter','retry',true)+btn('Retry in Story mode','retry-story')+btn('Return to camp','retreat')+'</div>',false);return;}
   const result=this.expedition.resolveBattle(this.battle);if(!result.ok){this.notify(result.reason);this.endBattle();return;}this.changed();
   this.openModal('<div class="eyebrow">RELAY RESTORED</div><h2>'+esc(result.node.name)+'</h2><p>The signal crosses the new road. '+(result.allRestored?'All three relays answer. Return to Wayfarer Camp to complete the expedition.':'The next relay is ready to answer.')+'</p><div class="score-grid"><div><strong>'+this.battle.turns+'</strong><span>Party turns</span></div><div><strong>'+this.battle.breaks+'</strong><span>Guard breaks</span></div><div><strong>+'+result.reward+'</strong><span>Renown</span></div></div><p>One field kit recovered. Human encounters also restore some HP and EP.</p><div class="dialog-buttons">'+btn('Continue expedition','after-battle',true)+'</div>',false);
  }
  endBattle(){this.battle=null;this.event=null;this.events=[];this.busy=false;this.units={};this.closeModal();this.place();this.fieldView();this.findNear();this.renderHUD();this.changed();}
  action(action,el){
   if(action==='close'){if(this.modalClosable)this.closeModal();return;}if(action==='guide'){this.help();return;}
   if(action==='sound'){this.sound=!this.sound;this.game.audio.mute(!this.sound);if(this.sound)this.game.audio.music(SCORE);else this.game.audio.stopMusic();this.help();return;}
   if(action==='retreat'){this.expedition.returnToCamp();this.endBattle();this.notify('Camp restored the party, Morrow, and at least three field kits.');return;}
   if(action==='rest'){this.expedition.rest();this.changed();this.renderHUD();this.notify('The party and Morrow are ready.');this.closeModal();return;}
   if(action.startsWith('module-')){this.expedition.setModule(action.slice(7));this.changed();this.renderHUD();this.camp();return;}
   if(action==='extract'){
    if(!this.expedition.extract())return;this.changed();const s=this.expedition.state;this.openModal('<div class="eyebrow">EXPEDITION COMPLETE</div><h2>The roads carry a voice.</h2><p>Three relays answer the morning. The frontier remains open for exploration. Create another expedition from the atlas when you are ready.</p><div class="score-grid"><div><strong>'+s.stats.renown+'</strong><span>Renown</span></div><div><strong>'+s.stats.surveys+'</strong><span>Sites surveyed</span></div><div><strong>'+Math.round(s.stats.distance)+'</strong><span>Tiles traveled</span></div></div><div class="dialog-buttons">'+btn('Keep exploring','close',true)+btn('Open atlas','atlas')+'</div>');this.renderHUD();return;
   }
   if(action==='atlas'){this.closeModal();this.options.onAtlas?.();return;}
   if(action.startsWith('encounter-')){try{this.startBattle(this.expedition.beginEncounter(action.slice(10)));}catch(e){this.notify(e.message);}return;}
   if(action==='after-battle'){this.endBattle();return;}
   if(action==='retry'||action==='retry-story'){if(action==='retry-story'){this.expedition.pending.snapshot.difficulty='story';this.expedition.state.difficulty='story';}this.startBattle(this.expedition.retryEncounter());return;}
   if(action==='sequences'){this.openModal('<div class="eyebrow">STRIKE SEQUENCES</div><h2>A rhythm with purpose.</h2>'+A.combos.map(c=>'<p><strong>'+c.name+' · '+c.seq.split('').join(' · ')+'</strong><br>'+c.effect+'</p>').join('')+'<p>Each turn starts with six AP. Save up to three unused AP as Reserve. Guard restores EP and grants three Reserve.</p><div class="dialog-buttons">'+btn('Return to battle','close',true)+'</div>');return;}
   if(!this.battle||this.modal)return;if(action==='skip'){this.skipAnimation();return;}if(this.busy)return;
   if(/^q[123]$/.test(action)){if(this.battle.queue(Number(action[1]))){this.game.audio.sfx('select',{vol:.4});this.renderBattle();}return;}
   if(action==='undo'){this.battle.undo();this.renderBattle();return;}if(action==='target'){this.battle.select(Number(el.dataset.index));this.renderBattle();return;}
   if(action==='next-target'){for(let i=1;i<=this.battle.enemies.length;i++)if(this.battle.select((this.battle.target+i)%this.battle.enemies.length))break;this.renderBattle();return;}
   this.command(action);
  }
  draw(r){
   if(!this.active||!this.world||!this.expedition)return;
   if(this.battle){A.drawBattleFloor(r,this.battle.kind,this.game.time);for(const u of Object.values(this.units)){if(u.mech)u.mech.draw(r,u.x,u.y,0,1);else if(u.id==='drone'){if(!u.dead)A.drawDrone(r,u);}else A.drawHuman(r,u);}return;}
   const s=this.expedition.state;Art.render(this.game,this.world,this.hero,this.game.time,{radius:16,visited:new Set(s.visits)});
   for(const n of [{...s.camp,kind:'camp'},...s.nodes.map(n=>({...n,kind:'relay'}))])if(Math.hypot((n.x+.5)*T-this.hero.x,(n.y+.5)*T-this.hero.y)<500)Art.drawSite(r,n.kind,(n.x+.5)*T,(n.y+.5)*T,this.game.time,{z:0,active:n.id===this.expedition.nextNode?.id,completed:n.completed});
   if(s.mounted)this.morrow.draw(r,this.hero.x,this.hero.y,this.hero.z,.72);else{A.drawHuman(r,this.companion);A.drawHuman(r,this.hero);}
   const target=this.expedition.nextNode||{...s.camp,name:'Wayfarer Camp'},p=r.w((target.x+.5)*T,(target.y+.5)*T,15),cx=r.W/2,cy=r.H/2;
   r.overlay(g=>{const dx=p[0]-cx,dy=p[1]-cy,len=Math.hypot(dx,dy),mx=r.W*.39,my=r.H*.26,k=Math.min(1,mx/Math.max(1,Math.abs(dx)),my/Math.max(1,Math.abs(dy))),x=cx+dx*k,y=cy+dy*k;
    if(len<25||s.completed)return;g.save();g.translate(x,y);g.rotate(Math.atan2(dy,dx));g.fillStyle='#f0c27f';g.beginPath();g.moveTo(8,0);g.lineTo(-5,-5);g.lineTo(-2,0);g.lineTo(-5,5);g.closePath();g.fill();g.restore();
   });
  }
 }
 root.EWFrontierGame=FrontierGame;
})(window);
