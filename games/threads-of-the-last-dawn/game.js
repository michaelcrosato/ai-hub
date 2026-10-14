// GAME START — Threads of the Last Dawn. All engine calls use the public API.
(() => {
'use strict';
const E=My3D2dge,D=globalThis.Dawn,C=D.Content;
const clone=x=>JSON.parse(JSON.stringify(x));
const SAVE_PREFIX='threads-last-dawn-v1-';
const INPUT={up:['ArrowUp','KeyW','Pad12','PadAxisUp'],down:['ArrowDown','KeyS','Pad13','PadAxisDown'],left:['ArrowLeft','KeyA','Pad14','PadAxisLeft'],right:['ArrowRight','KeyD','Pad15','PadAxisRight'],start:['Enter','Pad9'],pause:['Escape','KeyP','Pad9'],confirm:['Enter','Space','KeyE','KeyZ','Pad0'],cancel:['Backspace','KeyX','Pad1'],interact:['KeyE','Space','Enter','Pad0'],run:['ShiftLeft','ShiftRight','Pad7'],journal:['KeyJ','Pad3'],bag:['KeyI'],party:['KeyC'],map:['KeyM','Pad2'],world:['KeyO','Pad8'],vehicle:['KeyV','Pad4'],kit:['KeyK'],cycle:['Tab','Pad5']};
let app;
const game=new E.Game({id:'threads-last-dawn',canvas:'screen',res:[480,300],view:'threequarter',views:['threequarter','topdown'],input:INPUT,fullscreen:'button',corner:false,bg:'#12313a',menu:{quit:'title',controls:{interact:'Talk / use / open',run:'Run',journal:'Journal',bag:'Inventory',party:'Party',map:'Atlas',world:'Enter the overworld',vehicle:'Change travel mode',kit:'Journey kit and crafting',cycle:'Next ready ally'},settings:[{key:'combatMode',label:'Battle timing',options:['Wait','Active'],value:'Wait'},{key:'battleSpeed',label:'Battle speed',options:['Normal','Fast'],value:'Normal'}]}});
const talk=new E.Dialog(game,{lines:3,speed:48,bg:'#102a32',border:'#a7bb9f',nameColor:'#e9c889',voice:'text'});
const shell=new E.Shell(game,{theme:{ink:'#e9e2c7',paper:'#102b32',accent:'#dfbf83',muted:'#8fafa3',danger:'#d79680',line:'#526d60',font:'Arial, sans-serif',titleFont:'Georgia, serif'},screens:{pause:{kicker:'THE HOURS CAN WAIT',title:'Rest a moment',actions:[['Save journey',()=>{shell.hide();app.ui.open('save');}],['Traveler’s journal',()=>{shell.hide();app.ui.open('journal');}]]},help:{kicker:'A TRAVELER’S GUIDE',title:'How to play',keys:[['WASD / arrows','Move'],['E / Space / Enter','Talk, open, or use'],['Shift','Run'],['J / C / I / M','Journal / party / bag / atlas'],['O / V / K','World map / travel mode / journey kit'],['Esc','Pause, settings, and controls']],sections:[['Explore','Use World (O) to leave a place and walk its age. Press E at a town or dungeon to enter. Use Travel (V on the world) to change modes after you restore a vehicle. Follow the current task. Talk to people marked with !. Walk near a gate, chest, enemy, or sign, then interact. You can also click the ground to walk there.'],['Battle','Select a ready ally, then a command and target. Gauges fill while you choose a command. Wait mode stops time inside a move or target list. Defend restores MP.'],['Team moves','Dual moves need both allies ready. Triple moves also need full Bond. Switch the three active allies from the Party panel outside combat.'],['Rest and save','Green shrines restore all HP and MP. Save in three slots. An autosave protects travel and battle progress. Export a save to keep a separate copy.'],['Change the future','Return to known ages. The Journal holds the main story, the Open Roads, the Far Shore, the Hearthbound Roads, the Small Hours, and six companion stories. Track a mission to see its next place on the atlas. Choices can change water, forests, towns, and routes in later ages.']]}}});

class App {
  constructor(){
    this.game=game;this.content=C;this.talk=talk;this.shell=shell;this.state=null;this.mode='title';this.world=null;this.hero=null;this.battle=null;
    this.rigs={};this.battleRigs={};this.anim={};this.followers=[];this.nearest=null;this.walkTarget=null;this.panel=null;this.encounterId=null;this.battleMenu='main';this.selectedActor=null;this.selectedSkill=null;this.selectedItem=null;this.selectedTarget=null;this.eventQueue=[];this.timeSinceUI=0;this.bannerTime=0;this.toastTimer=0;
    this.profile=E.store.get(SAVE_PREFIX+'profile',{endings:[],clears:0});this.ui=new D.UI(this);this.ui.init();
    for(const id of Object.keys(C.heroes))this.rigs[id]=D.makeRig(id);
  }
  fresh(plus=false,difficulty='standard'){
    let prior=(this.state?.ending||this.state?.flags.engine_stopped)?this.state:E.store.get(SAVE_PREFIX+'completed',null);
    const state={version:2,game:'threads-last-dawn',chapter:1,zone:C.meta.startZone||'bell_quay',x:0,y:0,flags:{},quests:{},opened:{},cleared:{},visited:[],unlocked:[],inventory:clone(C.meta.startInventory),gold:C.meta.startGold||100,xp:0,active:[...C.meta.startParty],roster:{},bond:0,playtime:0,battles:0,difficulty,ngPlus:0,ending:null,savedAt:null,travelMode:'foot',worldReturn:null,trackedMission:null,atlasDestination:null};
    if(plus&&prior){state.flags.ng_plus=true;state.ngPlus=(prior.ngPlus||0)+1;state.xp=prior.xp;state.gold=prior.gold;state.inventory=clone(prior.inventory);state.active=[...prior.active];state.roster=clone(prior.roster);}
    this.state=state;
    for(const id of C.meta.startParty)this.recruit(id,true);
    if(plus)for(const id of Object.keys(C.heroes))this.recruit(id,true);
    this.heal();return state;
  }
  begin(plus=false,difficulty='standard'){
    this.ui.close();this.fresh(plus,difficulty);this.mode='field';this.loadWorld(this.state.zone);game.go('field');
    if(!plus)this.eventQueue.push(()=>this.say(['The orchard did not bloom this year.','At dawn, every clock in Larkspur Quay stops. Only one keeps moving: the watch Mira has carried since her father died.','Soren waits by the road. There is still time to find the cause.','The World button opens the roads beyond each place. Follow the main story, or visit the Reedwake Mooring to help the coast. The Journal keeps both paths.'],{name:'The first quiet morning',hero:'mira'}));
    else this.toast('New Game + · Your levels and equipment remain. A new gate waits in the orchard.',6);
    this.save('auto',true);
  }
  stats(id){
    const h=C.heroes[id],s=this.state.roster[id];if(!h||!s)return null;
    const level=1+Math.floor(Math.sqrt(Math.max(0,this.state.xp)/45)),n=level-1;
    const out={...h,id,level,maxHp:h.maxHp+n*24,maxMp:h.maxMp+n*4,atk:h.atk+n*2.6,mag:h.mag+n*2.6,def:h.def+n*1.4,speed:h.speed};
    for(const itemId of Object.values(s.equipment||{})){const it=C.items[itemId];for(const [k,v]of Object.entries(it?.stats||{}))if(Number.isFinite(out[k]))out[k]+=v;}
    for(const k of ['maxHp','maxMp','atk','mag','def'])out[k]=Math.round(out[k]);
    out.hp=E.clamp(s.hp??out.maxHp,0,out.maxHp);out.mp=E.clamp(s.mp??out.maxMp,0,out.maxMp);
    out.skills=h.skills.filter((skill,index)=>level>=[1,1,3,5][index]);out.equipment=s.equipment||{};return out;
  }
  recruit(id,silent=false){
    if(!C.heroes[id]||this.state.roster[id])return;
    this.state.roster[id]={hp:C.heroes[id].maxHp,mp:C.heroes[id].maxMp,equipment:{weapon:null,armor:null,accessory:null}};
    if(this.state.active.length<3&&!this.state.active.includes(id))this.state.active.push(id);
    const h=this.stats(id);this.state.roster[id].hp=h.maxHp;this.state.roster[id].mp=h.maxMp;
    if(!silent)this.toast(C.heroes[id].name+' joins the journey. Open Party to choose your team.',5);
  }
  heal(){for(const id of Object.keys(this.state.roster)){const s=this.stats(id);this.state.roster[id].hp=s.maxHp;this.state.roster[id].mp=s.maxMp;}}
  meets(condition){
    if(!condition)return true;if(typeof condition==='string')return!!this.state?.flags[condition];
    if(Array.isArray(condition))return condition.every(c=>this.meets(c));if(!this.state)return false;
    if(condition.flags&&!condition.flags.every(f=>this.state.flags[f]))return false;
    if(condition.notFlags&&condition.notFlags.some(f=>this.state.flags[f]))return false;
    if(condition.chapterAtLeast&&this.state.chapter<condition.chapterAtLeast)return false;
    if(condition.chapterAtMost&&this.state.chapter>condition.chapterAtMost)return false;
    if(condition.quest&&this.state.quests[condition.quest]!=='complete')return false;
    if(condition.item&&!(this.state.inventory[condition.item]>0))return false;
    return true;
  }
  apply(effects=[]){
    let rebuild=false;const completedBefore=new Set((C.missions||[]).filter(m=>this.state.flags[m.completeFlag]).map(m=>m.id));
    for(const e of effects){
      if(!e||!this.meets(e.requires))continue;
      switch(e.type){
      case 'flag':this.state.flags[e.id]=e.value!==false;rebuild=true;break;
      case 'chapter':this.state.chapter=Math.max(this.state.chapter,e.value);this.toast('Chapter '+this.state.chapter+' · '+this.chapter().title,5);break;
      case 'recruit':this.recruit(e.id);break;
      case 'item':this.give(e.id,e.count||1);break;
      case 'gold':this.state.gold=Math.max(0,this.state.gold+(e.amount||0));break;
      case 'xp':{const before=this.stats(this.state.active[0]).level;this.state.xp+=Math.max(0,Math.round(e.amount||0));const levels=this.stats(this.state.active[0]).level-before;if(levels>0)for(const id of Object.keys(this.state.roster)){const h=this.stats(id);this.state.roster[id].hp=Math.min(h.maxHp,this.state.roster[id].hp+levels*24);this.state.roster[id].mp=Math.min(h.maxMp,this.state.roster[id].mp+levels*4);}break;}
      case 'unlock':if(!this.state.unlocked.includes(e.id))this.state.unlocked.push(e.id);break;
      case 'quest':this.state.quests[e.id]=e.status||'active';if(e.status==='complete')this.toast('Thread complete · '+(C.quests.find(q=>q.id===e.id)?.name||e.id),5);break;
      case 'heal':this.heal();break;
      case 'battle':this.eventQueue.push(()=>this.startBattle(e.id));break;
      case 'travel':this.eventQueue.push(()=>this.travel(e.id));break;
      case 'ending':this.eventQueue.push(()=>this.finish(e.id));break;
      }
    }
    const completed=(C.missions||[]).filter(m=>this.state.flags[m.completeFlag]&&!completedBefore.has(m.id));
    if(completed.length){this.toast('Mission complete · '+completed.map(m=>m.name).join(' · '),5);if(completed.some(m=>m.id===this.state.trackedMission))this.state.trackedMission=null;}
    if(!this.state.trackedMission){const started=(C.missions||[]).find(m=>this.missionStatus(m.id)==='active'&&effects.some(e=>e.type==='flag'&&m.steps.some(s=>s.flag===e.id)));if(started)this.state.trackedMission=started.id;}
    if(rebuild&&this.world&&!this.battle)this.rebuildWorld();this.save('auto',true);this.ui.dirty=true;
  }
  give(id,count=1){if(!id||!C.items[id])return;this.state.inventory[id]=(this.state.inventory[id]||0)+count;}
  chapter(){return C.chapters.find(c=>c.id===this.state?.chapter)||C.chapters[0];}
  missionStatus(id){
    const m=(C.missions||[]).find(m=>m.id===id);if(!m||!this.state)return'locked';
    if(this.state.flags[m.completeFlag])return'complete';
    if(!this.meets(m.requires))return'locked';
    return m.steps.some(s=>this.state.flags[s.flag])?'active':'available';
  }
  missionStep(id){const m=(C.missions||[]).find(m=>m.id===id);return m?.steps.find(s=>!this.state.flags[s.flag])||null;}
  trackMission(id){
    if(id!==null&&!['available','active'].includes(this.missionStatus(id)))return false;
    this.state.trackedMission=id;this.state.atlasDestination=null;this.ui.dirty=true;this.save('auto',true);return true;
  }
  objective(){
    const step=this.state?.trackedMission&&this.missionStep(this.state.trackedMission);if(step)return step;
    return this.chapter().objectives?.find(o=>!this.state.flags[o.flag])||{text:this.chapter().goal||'Follow the next path.',zone:this.chapter().entryZone};
  }
  destination(){return this.state.atlasDestination||this.objective().zone;}
  mapAccess(era){return this.state&&[...this.state.visited,...this.state.unlocked,this.state.zone].some(id=>C.zoneById[id]?.era===era);}
  markDestination(id){
    if(!C.zoneById[id]||C.zoneById[id].kind==='overworld')return false;
    this.state.atlasDestination=id;this.save('auto',true);this.ui.dirty=true;return true;
  }
  enterOverworld(){
    if(!this.world||this.battle||talk.open||this.mode!=='field')return false;
    if(this.world.isOverworld){this.ui.open('map');return true;}
    const pos=this.world.zone.worldPosition;if(!pos)return false;return this.travel(pos.zone,pos.x,pos.y+1);
  }
  travelModes(){return ['foot',...(this.state?.flags.transport_skiff?['skiff']:[]),...(this.state?.flags.transport_airship?['airship']:[])];}
  setTravelMode(mode){
    if(!this.world?.isOverworld||this.battle||!this.travelModes().includes(mode))return false;
    if(!this.world.canUseMode(mode,this.hero.x,this.hero.y)){this.toast(mode==='foot'?'Land on a road or open ground first.':'Move clear of the mountains first.',3);return false;}
    const previous=this.state.travelMode;this.world.setTravelMode(mode);
    if(!this.world.map.standable(this.hero.x,this.hero.y,0,this.hero.r)){this.world.setTravelMode(previous);this.toast('Move fully onto clear ground before you change travel mode.',3);return false;}
    this.state.travelMode=mode;this.walkTarget=null;this.hero.vx=this.hero.vy=0;
    this.toast({foot:'On foot · Follow roads and bridges.',skiff:'Coast Skiff · Travel over land and water.',airship:'Cloudglass airship · Fly over sea and mountains.'}[mode],3);this.save('auto',true);this.ui.dirty=true;return true;
  }
  cycleTravelMode(){
    if(!this.world?.isOverworld)return this.enterOverworld();
    const modes=this.travelModes(),index=modes.indexOf(this.state.travelMode);
    if(modes.length===1){this.ui.open('travel');return false;}
    for(let i=1;i<=modes.length;i++){const mode=modes[(index+i)%modes.length];if(mode!==this.state.travelMode&&this.world.canUseMode(mode,this.hero.x,this.hero.y))return this.setTravelMode(mode);}
    this.toast('Find open ground before you change travel mode.',3);return false;
  }
  loadWorld(id,tx,ty){
    const z=C.zones.find(z=>z.id===id);if(!z)throw new Error('Unknown zone: '+id);
    this.state.zone=id;
    for(const effect of z.onEnter||[])if(effect.type==='flag')this.state.flags[effect.id]=effect.value!==false;
    this.state.travelMode||='foot';this.world=z.kind==='overworld'?new D.Overworld(z,this.state.flags,this.state.travelMode):new D.World(z,this.state.flags);const s=z.spawn||{x:15,y:12};
    const x=tx===undefined?(this.state.x||((s.x+.5)*16)):(tx+.5)*16,y=ty===undefined?(this.state.y||((s.y+.5)*16)):(ty+.5)*16;
    this.hero=new E.Body({x,y,r:this.world.isOverworld?3.5:4.5,friction:0});this.hero.facing=Math.PI/2;this.hero.onGround=true;
    if(!this.world.map.standable(this.hero.x,this.hero.y,0,this.hero.r)){
      let safe=null,best=Infinity;for(let cy=1;cy<z.height-1;cy++)for(let cx=1;cx<z.width-1;cx++){const px=(cx+.5)*16,py=(cy+.5)*16,d=Math.hypot(px-x,py-y);if(d<best&&this.world.map.standable(px,py,0,this.hero.r)){safe=[px,py];best=d;}}
      if(safe){this.hero.x=safe[0];this.hero.y=safe[1];}
    }
    this.followers=this.state.active.slice(1).map((id,i)=>({id,x:x-(i+1)*12,y:y+8,z:0,vx:0,vy:0,facing:Math.PI/2}));
    this.walkTarget=null;this.nearest=null;this.syncWorldView();game.cam.bounds=v=>this.world.map.bounds(v);game.cam.smooth=.12;game.cam.offset=[0,this.world.isOverworld?-14:-24];game.cam.snap=true;game.focus(this.hero.x,this.hero.y,this.world.isOverworld?0:12);game.lights.enabled=false;
    if(!this.state.visited.includes(id))this.state.visited.push(id);
    this.world.update(0,this);game.audio.music(D.Music[z.era]||D.Music.bell642);this.ui.dirty=true;
  }
  syncWorldView(){const wide=!!this.world?.isOverworld;game.setView(wide?'topdown':'threequarter');game.setZoom(wide?0.85:this.world?.zone.dungeonId||this.world?.zone.hearthTheme?0.84:1);}
  rebuildWorld(){if(!this.world)return;const x=this.hero.x,y=this.hero.y;this.state.x=x;this.state.y=y;this.loadWorld(this.state.zone);}
  travel(id,tx,ty){
    if(this.battle||!C.zoneById[id])return false;
    const old=this.world?.zone,next=C.zoneById[id];
    if(next.kind==='overworld'&&tx===undefined){const p=old?.worldPosition?.zone===id?old.worldPosition:this.state.worldReturn?.zone===id?this.state.worldReturn:null;if(p){tx=p.x;ty=p.y+1;}}
    if(old?.kind==='overworld'&&next.kind!=='overworld'){const p=next.worldPosition;if(p)this.state.worldReturn={zone:p.zone,x:p.x,y:p.y};this.state.travelMode='foot';}
    if(this.state.atlasDestination===id)this.state.atlasDestination=null;
    this.ui.close();talk.close();this.state.x=0;this.state.y=0;this.loadWorld(id,tx,ty);
    game.audio.sfx('warp');game.flash('#c5dbbf',.22,.25);this.toast(this.world.zone.name+' · '+this.era().name,3);this.save('auto',true);return true;
  }
  era(){return C.eras.find(e=>e.id===this.world?.zone.era)||C.eras[0];}
  dialogue(id){
    let d=typeof id==='object'?id:C.dialogues[id];if(!d){this.say('The wind moves through the branches.');return;}
    if(d.variants){const v=d.variants.find(v=>this.meets(v.requires));if(v){if(v.dialogue)return this.dialogue(v.dialogue);d={...d,...v};}}
    if(d.onceFlag&&this.state.flags[d.onceFlag]){if(d.onRepeat)return this.dialogue(d.onRepeat);this.say(d.repeatLines||['There is still work to do. Follow the next thread.'],{name:d.speaker,hero:d.hero});return;}
    const choices=(d.choices||[]).filter(c=>this.meets(c.requires));
    this.say(d.lines||d.text||['...'],{name:d.speaker,hero:d.hero,choices:choices.map(c=>c.label),onChoice:i=>{
      const c=choices[i];if(!c)return;this.apply(c.effects);if(c.next)this.eventQueue.push(()=>this.dialogue(c.next));
    },onDone:()=>{if(d.onceFlag)this.state.flags[d.onceFlag]=true;this.apply(d.effects);if(d.next)this.eventQueue.push(()=>this.dialogue(d.next));}});
  }
  say(lines,{name='The hours',hero=null,choices=[],onChoice=null,onDone=null}={}){
    this.walkTarget=null;game.input.clear();talk.say(lines,{name,portrait:hero?this.rigs[hero]:null,choices:choices.length?choices:null,onChoice,onDone});this.ui.dirty=true;
  }
  interact(entity=this.nearest){
    if(!entity||this.battle||talk.open||this.panel)return false;
    this.walkTarget=null;
    if(!this.meets(entity.requires)){this.say(entity.lockedText||'This way is not open yet. Follow the current task in your journal.');return false;}
    const e=entity;
    if(e.variants){const v=e.variants.find(v=>this.meets(v.requires));if(v?.dialogue){this.dialogue(v.dialogue);return true;}}
    if(e.type==='exit'||e.type==='gate'){
      if(e.dialogue)this.dialogue(e.dialogue);else if(e.to)this.travel(e.to,e.tx,e.ty);else this.ui.open('map');
    }else if(e.type==='encounter'){this.startBattle(e.encounter||e.id);}
    else if(e.type==='chest'){
      if(this.state.opened[e.id])return false;this.state.opened[e.id]=true;for(const it of e.loot||[])this.give(it.id,it.count||1);if(e.item)this.give(e.item,e.count||1);this.state.gold+=e.gold||0;
      const names=(e.loot||[]).map(it=>(it.count>1?it.count+' × ':'')+(C.items[it.id]?.name||it.id));if(e.item)names.push(C.items[e.item]?.name||e.item);if(e.gold)names.push(e.gold+' crowns');
      game.audio.sfx('pickup');this.toast('Found '+(names.join(' · ')||'a keepsake'),4);this.apply(e.effects);this.save('auto',true);
    }else if(e.type==='shrine'){this.heal();game.audio.sfx('heal');game.particles.glints(e.x,e.y,18,24,'#b9e5b6');this.toast('The party rests. HP and MP restored. Journey saved.',4);this.save('auto',true);}
    else if(e.type==='discovery'){
      const flag=e.discoveryFlag||e.flag||'discovered_'+e.id,known=!!this.state.flags[flag];
      this.say(known?(e.foundLines||e.repeatLines||e.lines||e.text):(e.lines||e.text||'A trace of this age joins the atlas.'),{name:e.name||'A place to remember',onDone:()=>{if(!known){this.apply([{type:'flag',id:flag},...(e.effects||[]),...(e.gold?[{type:'gold',amount:e.gold}]:[])]);this.toast('Place found · '+e.name,4);}}});
    }
    else if(e.type==='shop')this.ui.open('shop',e);
    else if(e.type==='minigame')this.ui.open('bells',e);
    else if(e.type==='puzzle')this.ui.open('puzzle',e);
    else if(e.dialogue)this.dialogue(e.dialogue);
    else if(e.effects){this.apply(e.effects);this.say(e.text||'The thread changes.');}
    else this.say(e.lines||e.text||e.description||'There is a quiet sound below the stone.');
    return true;
  }
  walkTo(x,y,entity=null){if(this.mode!=='field'||this.battle||talk.open||this.panel)return;this.walkTarget={x,y,entity};this.world.flow.update(x,y);}
  startBattle(id){
    if(this.battle)return false;
    const enc=C.encounters[id];if(!enc)throw new Error('Unknown encounter: '+id);if(this.state.cleared[id]&&!enc.repeatable)return false;
    if(enc.requires&&!this.meets(enc.requires))return false;
    const start=()=>{
      this.noteEnemies?.(enc);this.save('auto',true);this.preBattle=clone(this.state);this.encounterId=id;this.walkTarget=null;this.ui.close();
      const cx=E.clamp(this.hero.x+20,164,344),cy=E.clamp(this.hero.y,136,228);this.battleCenter={x:cx,y:cy};
      const party=this.state.active.map((id,i)=>({...this.stats(id),x:cx-72+(i%2)*-14,y:cy+(i-(this.state.active.length-1)/2)*44}));
      const enemies=(D.encounterEnemies?D.encounterEnemies(enc,this.stats(this.state.active[0]).level):enc.enemies.map(id=>C.enemies[id])).map((enemy,i)=>({...enemy,x:cx+65+(i%2)*26,y:cy+(i-(enc.enemies.length-1)/2)*44}));
      this.battle=new D.Battle({party,enemies,skills:this.knownSkills?this.knownSkills():C.skills,items:C.items,bond:this.state.bond,difficulty:this.state.difficulty,seed:113+this.state.battles*71,onEvent:e=>this.battleEvent(e)});
      this.battleRigs={};for(const u of this.battle.party)this.battleRigs[u.uid]=this.rigs[u.id];for(const u of this.battle.enemies)this.battleRigs[u.uid]=D.makeEnemyRig(C.enemies[u.id]);
      this.selectedActor=this.battle.party.find(u=>u.hp>0)?.uid;this.battleMenu='main';this.selectedSkill=null;this.selectedItem=null;this.selectedTarget=null;this.anim={};this.resultTimer=0;
      game.audio.music(enc.boss?D.Music.boss:D.Music.battle);game.cam.bounds=null;game.cam.offset=[0,-29];game.focus(cx,cy,16);this.ui.dirty=true;
    };
    const intro=[...(enc.intro||[])];if(enc.enemies.some(id=>C.enemies[id].staggerMax)&&!this.state.flags.pressure_tutorial_seen){intro.push('These enemies have a pressure meter. Hit a weakness or use a pressure technique to fill it. A full meter stops their attack and gives a short damage window.','If an ally protects an enemy, defeat that ally first. The gold meter and live attack notice show when to act.');this.state.flags.pressure_tutorial_seen=true;}if(intro.length)this.say(intro,{name:enc.name,onDone:()=>this.eventQueue.push(start)});else start();return true;
  }
  battleEvent(e){
    // The constructor can emit intents before this.battle is assigned.
    const b=this.battle;if(!b)return;
    const from=b.unit(e.actor),to=b.unit(e.target),color={wind:'#b7e9c0',water:'#9acbea',fire:'#edb47c',earth:'#b8d191',void:'#c4a3df',spark:'#eee0a2'}[e.element]||'#e7d9ad';
    if(e.type==='cast'&&from){
      this.anim[from.uid]={left:.76,dur:.76,move:from.team==='enemy'?'overhead':({mira:'slash',brann:'twohand',soren:'cast',ilex:'cast',nyx:'spin',vale:'throw'}[from.id]||'slash')};
      game.audio.sfx('whoosh');game.particles.glints(from.x,from.y,23,10,color);
    }
    if(e.type==='hit'&&to){game.hitFx(to.x,to.y,14,{power:e.weak?1.1:.5,damage:e.amount,color,textScale:1,textZ:23,bounce:true});this.anim[to.uid]={left:.28,dur:.28,hurt:true};}
    if(e.type==='heal'&&to){const tint=e.mp?'#aad3ee':'#b6e2a1';game.particles.text(to.x,to.y,30,'+'+e.amount+(e.mp?' MP':''),tint);game.particles.glints(to.x,to.y,15,8,tint);game.audio.sfx('heal');}
    if(e.type==='break'&&to){game.shake(.7);game.particles.text(to.x,to.y,42,'BREAK','#efd68d');this.toast(to.name+' is off balance. Its attack stops.',3);}
    if(e.type==='phase'){game.shake(1.5);game.flash('#b5c8e6',.16,.2);this.toast(e.name||'The enemy changes its rhythm.',3);}
    if(e.type==='death'&&to)game.particles.smoke(to.x,to.y,9,12,{color:'#9baca1'});
  }
  selectActor(id){const u=this.battle?.unit(id);if(!u||u.team!=='party'||u.hp<=0)return;this.selectedActor=u.uid;this.battleMenu='main';this.selectedSkill=null;this.selectedItem=null;this.ui.dirty=true;}
  selectMenu(menu){this.battleMenu=menu;this.selectedSkill=null;this.selectedItem=null;this.selectedTarget=null;this.ui.dirty=true;}
  chooseSkill(id){
    const b=this.battle;if(!b)return;this.selectedSkill=id;this.selectedItem=null;const skill=b.skills[id];if(!skill)return;
    if(skill.target==='self'){this.chooseTarget(this.selectedActor);return;}
    this.battleMenu='target';const allies=['ally','allAllies'].includes(skill.target),targets=allies?b.party:b.enemies;this.selectedTarget=(targets.find(u=>skill.type==='revive'?u.hp===0:u.hp>0)||targets[0])?.uid;this.ui.dirty=true;
  }
  chooseItem(id){this.selectedSkill=null;this.selectedItem=id;this.battleMenu='target';this.selectedTarget=this.selectedActor;this.ui.dirty=true;}
  chooseTarget(id){
    const b=this.battle;if(!b)return;let result;
    if(this.selectedItem)result=b.useItem(this.selectedActor,this.selectedItem,id,this.state.inventory);
    else result=b.act(this.selectedActor,this.selectedSkill||'attack',id);
    if(!result.ok){this.toast(result.reason,2.5);return;}
    this.afterCommand();
  }
  afterCommand(){this.battleMenu='main';this.selectedSkill=null;this.selectedItem=null;this.selectedTarget=null;const ready=this.battle.party.find(u=>u.hp>0&&u.atb>=100);this.selectedActor=ready?.uid||this.battle.party.find(u=>u.hp>0)?.uid;this.ui.dirty=true;}
  defend(){const r=this.battle?.defend(this.selectedActor);if(!r?.ok){this.toast(r?.reason||'Choose a ready ally.');return;}this.afterCommand();}
  flee(){const r=this.battle?.flee();if(!r?.ok)this.toast(r?.reason||'There is no way out.',3);this.ui.dirty=true;}
  battleDone(){
    const b=this.battle,enc=C.encounters[this.encounterId];if(!b)return;
    this.state.bond=b.bond;for(const u of b.party){this.state.roster[u.id].hp=Math.max(1,u.hp);this.state.roster[u.id].mp=u.mp;}
    const result=b.result,id=this.encounterId;this.battle=null;this.encounterId=null;this.anim={};game.cam.bounds=v=>this.world.map.bounds(v);game.cam.offset=[0,-24];this.ui.dirty=true;
    if(result==='victory'){
      const repeated=!!this.state.cleared[id],xp=repeated?0:(enc.xp??20),gold=repeated?0:(enc.gold||0),before=this.stats(this.state.active[0]).level;this.noteVictory?.(enc,b);this.state.cleared[id]=true;this.state.battles++;this.state.xp+=xp;this.state.gold+=gold;
      if(!repeated)for(const it of enc.loot||[])this.give(it.id,it.count||1);
      const after=this.stats(this.state.active[0]).level;if(after>before){for(const charId of Object.keys(this.state.roster)){const s=this.stats(charId);this.state.roster[charId].hp=Math.min(s.maxHp,this.state.roster[charId].hp+(after-before)*24);this.state.roster[charId].mp=Math.min(s.maxMp,this.state.roster[charId].mp+(after-before)*4);}}
      game.audio.music('victory');if(!repeated)this.apply(enc.effects);
      const reward=repeated?'Trial complete · Your best result is saved.':`${xp} XP · ${gold} crowns${after>before?' · Party reaches level '+after:''}`;
      this.say([reward,...(repeated?['Practice changes no story rewards. Your party keeps what it learned.']:(enc.victory||['The path is clear.']))],{name:'Victory',hero:this.state.active[0],onDone:()=>{game.audio.music(D.Music[this.world.zone.era]);this.save('auto',true);}});
    }else if(result==='defeat'){
      game.audio.sfx('die');this.state=clone(this.preBattle);this.heal();this.ui.open('defeat',{encounter:id,name:enc.name});
    }else{game.audio.music(D.Music[this.world.zone.era]);this.toast('You returned to the path. The enemy remains.',3);}
    game.focus(this.hero.x,this.hero.y,12);
  }
  finish(id){
    this.state.ending=id;this.mode='ending';this.ui.endingPage=0;if(!this.profile.endings.includes(id))this.profile.endings.push(id);this.profile.clears=(this.profile.clears||0)+1;
    E.store.set(SAVE_PREFIX+'profile',this.profile);E.store.set(SAVE_PREFIX+'completed',clone(this.state));this.save('auto',true);game.go('ending');this.ui.dirty=true;
  }
  swap(id){
    if(!this.state.roster[id]||this.battle)return;
    if(this.state.active.includes(id)){if(this.state.active.length<=1)return;this.state.active=this.state.active.filter(v=>v!==id);}
    else if(this.state.active.length<3)this.state.active.push(id);else this.state.active[this.state.active.length-1]=id;
    this.followers=this.state.active.slice(1).map((v,i)=>({id:v,x:this.hero.x-i*12,y:this.hero.y+14,z:0,vx:0,vy:0,facing:Math.PI/2}));this.ui.dirty=true;this.save('auto',true);
  }
  equip(heroId,itemId,emptySlot=null){
    const hero=this.state.roster[heroId],it=itemId?C.items[itemId]:null;if(!hero||this.battle)return false;
    if(itemId&&(!it||!(this.state.inventory[itemId]>0)||it.hero&&it.hero!==heroId))return false;
    const slot=it?.slot||it?.kind||emptySlot;if(!['weapon','armor','accessory'].includes(slot))return false;
    const old=hero.equipment[slot];if(!itemId&&!old)return false;if(old)this.give(old);hero.equipment[slot]=itemId||null;if(itemId)this.state.inventory[itemId]--;
    const s=this.stats(heroId);hero.hp=Math.min(hero.hp,s.maxHp);hero.mp=Math.min(hero.mp,s.maxMp);game.audio.sfx('pickup');this.save('auto',true);this.ui.dirty=true;return true;
  }
  useFieldItem(id,target){
    const item=C.items[id],hero=this.state.roster[target];if(!item||!hero||!(this.state.inventory[id]>0))return false;const s=this.stats(target),e=item.effect||{};
    if(id==='tonic')hero.hp=Math.min(s.maxHp,hero.hp+(e.amount||90));else if(id==='ether')hero.mp=Math.min(s.maxMp,hero.mp+(e.amount||30));else if(id==='elixir'){hero.hp=s.maxHp;hero.mp=s.maxMp;}else if(id==='phoenix'){this.toast('All travelers can stand outside battle. Keep this seed for a battle.');return false;}else{this.toast('Use this item during a battle.');return false;}
    this.state.inventory[id]--;game.audio.sfx('heal');this.save('auto',true);return true;
  }
  save(slot='auto',quiet=false){
    if(!this.state||this.battle)return false;if(this.hero){this.state.x=this.hero.x;this.state.y=this.hero.y;}this.state.savedAt=new Date().toISOString();
    const ok=E.store.set(SAVE_PREFIX+slot,clone(this.state));if(!quiet)this.toast(ok?'Journey saved.':'Browser storage is unavailable. Use Export save to keep your progress.',ok?3:7);return ok;
  }
  readSave(slot){return E.store.get(SAVE_PREFIX+slot,null);}
  validateSave(value){
    const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),number=(v,max)=>Number.isFinite(v)&&v>=0&&v<=max;
    const known=(group,id)=>typeof id==='string'&&Object.hasOwn(group,id),zones=new Set(C.zones.map(z=>z.id));
    if(!record(value)||value.game!=='threads-last-dawn'||![1,2].includes(value.version)||!zones.has(value.zone)||!Number.isInteger(value.chapter)||value.chapter<1||value.chapter>8)return false;
    const zone=C.zoneById[value.zone];
    if(!number(value.xp,1e8)||!number(value.gold,1e9)||!number(value.x,zone.width*16)||!number(value.y,zone.height*16)||!number(value.bond,100)||!number(value.playtime,1e9)||!number(value.battles,1e7)||!number(value.ngPlus,1e5)||!['story','standard','hard'].includes(value.difficulty))return false;
    if(!['xp','gold','battles','ngPlus'].every(k=>Number.isInteger(value[k])))return false;
    if(!Array.isArray(value.active)||value.active.length<1||value.active.length>3||value.active.some(id=>!known(C.heroes,id))||new Set(value.active).size!==value.active.length)return false;
    if(!['roster','flags','inventory','opened','cleared','quests'].every(k=>record(value[k])))return false;
    if(!['visited','unlocked'].every(k=>Array.isArray(value[k])&&value[k].every(id=>zones.has(id))))return false;
    if(!['flags','opened','cleared'].every(k=>Object.values(value[k]).every(v=>typeof v==='boolean')))return false;
    if(value.version===2){
      if(!['foot','skiff','airship'].includes(value.travelMode)||value.travelMode==='skiff'&&!value.flags.transport_skiff||value.travelMode==='airship'&&!value.flags.transport_airship)return false;
      if(value.trackedMission!==null&&!(C.missions||[]).some(m=>m.id===value.trackedMission))return false;
      if(value.atlasDestination!==null&&!zones.has(value.atlasDestination))return false;
      const p=value.worldReturn;if(p!==null){const z=record(p)&&C.zoneById[p.zone];if(!z||z.kind!=='overworld'||!number(p.x,z.width-1)||!number(p.y,z.height-1))return false;}
    }
    if(!Object.entries(value.inventory).every(([id,count])=>known(C.items,id)&&Number.isInteger(count)&&number(count,1e6)))return false;
    if(!Object.entries(value.quests).every(([id,status])=>C.quests.some(q=>q.id===id)&&['active','complete'].includes(status)))return false;
    return Object.entries(value.roster).every(([id,h])=>known(C.heroes,id)&&record(h)&&number(h.hp,1e7)&&number(h.mp,1e7)&&record(h.equipment)&&Object.keys(h.equipment).every(slot=>['weapon','armor','accessory'].includes(slot))&&['weapon','armor','accessory'].every(slot=>{
      const itemId=h.equipment[slot];if(itemId===null)return true;const item=known(C.items,itemId)&&C.items[itemId];return item&&(item.slot||item.kind)===slot&&(!item.hero||item.hero===id);
    }))&&value.active.every(id=>Object.hasOwn(value.roster,id));
  }
  load(slotOrState){
    const s=typeof slotOrState==='string'?this.readSave(slotOrState):slotOrState;if(!this.validateSave(s)){this.toast('This save is not valid for this game.',4);return false;}
    this.ui.close();this.state=clone(s);this.state.opened||={};this.state.cleared||={};this.state.quests||={};this.state.visited||=[];this.state.unlocked||=[];
    if(this.state.version===1){this.state.version=2;this.state.travelMode='foot';this.state.worldReturn=null;this.state.trackedMission=null;this.state.atlasDestination=null;}
    this.state.ending=null;this.mode='field';this.battle=null;this.eventQueue=[];talk.close();this.loadWorld(this.state.zone);game.go('field');this.save('auto',true);return true;
  }
  toast(text,seconds=3){this.toastText=String(text);this.toastTimer=seconds;this.ui.dirty=true;}
  update(dt){
    if(!this.state)return;this.state.playtime+=dt;this.toastTimer=Math.max(0,this.toastTimer-dt);this.timeSinceUI+=dt;
    if(this.panel){this.ui.updatePanel();this.ui.update();return;}
    if(talk.open){this.world.update(dt,this);for(const [id,rig]of Object.entries(this.rigs))rig.update(dt,{facing:Math.PI/2});talk.update(dt);this.ui.update();return;}
    if(this.eventQueue.length){const fn=this.eventQueue.shift();fn();this.ui.update();return;}
    if(this.battle){
      const b=this.battle,I=game.input;
      if(I.pressed('cancel'))this.selectMenu('main');if(I.pressed('cycle')){const live=b.party.filter(u=>u.hp>0),i=live.findIndex(u=>u.uid===this.selectedActor);this.selectActor(live[(i+1)%live.length]?.uid);}
      this.ui.updateBattleKeyboard();
      const wait=game.settings.combatMode==='Wait'&&this.battleMenu!=='main';b.update(dt*(game.settings.battleSpeed==='Fast'?1.6:1),{wait});
      for(const u of [...b.party,...b.enemies]){const rig=this.battleRigs[u.uid],a=this.anim[u.uid];if(a){a.left-=dt;if(a.left<=0)delete this.anim[u.uid];}
        if(rig instanceof E.Humanoid)rig.update(dt,{x:u.x,y:u.y,z:0,facing:u.team==='party'?0:Math.PI,pose:u.hp<=0?'down':u.defending?'block':null,attack:a?.move?E.move(a.move,1-a.left/a.dur):null,hurt:a?.hurt?1:0,stance:'ready'});
        else rig.update(dt,{look:[u.team==='party'?1:-1,0],flap:.5,squash:a?.hurt?-.25:0});
      }
      if(b.result){this.resultTimer+=dt;if(this.resultTimer>.8)this.battleDone();}game.focus(this.battleCenter.x,this.battleCenter.y,16);this.ui.update();return;
    }
    const I=game.input;
    if(I.pressed('kit')){this.ui.open('camp');return;}if(I.pressed('journal')){this.ui.open('journal');return;}if(I.pressed('bag')){this.ui.open('bag');return;}if(I.pressed('party')){this.ui.open('party');return;}if(I.pressed('map')){this.ui.open('map');return;}if(I.pressed('world')){this.enterOverworld();return;}if(I.pressed('vehicle')){this.cycleTravelMode();return;}
    let [mx,my]=I.move(),[dx,dy]=game.view.screenDirToGround(mx,my);
    if(mx||my)this.walkTarget=null;
    if(this.walkTarget){const t=this.walkTarget,d=Math.hypot(t.x-this.hero.x,t.y-this.hero.y);if(d<(t.entity?19:5)){this.walkTarget=null;if(t.entity)this.interact(t.entity);dx=dy=0;}else{const dir=this.world.flow.dir(this.hero.x,this.hero.y,t.x,t.y);dx=dir[0];dy=dir[1];}}
    const speed=this.world.isOverworld?({foot:116,skiff:165,airship:240}[this.state.travelMode]||116)*(I.down('run')?1.3:1):(I.down('run')?104:73);this.hero.vx=dx*speed;this.hero.vy=dy*speed;this.hero.update(dt,this.world.map);if(dx||dy)this.hero.facing=Math.atan2(dy,dx);
    const actors=[{id:this.state.active[0],body:this.hero},...this.followers.map(b=>({id:b.id,body:b}))];let prev=this.hero;
    for(const f of this.followers){const d=Math.hypot(prev.x-f.x,prev.y-f.y),n=d>19?Math.min(d-19,88*dt):0;f.vx=d?(prev.x-f.x)/d*n/dt:0;f.vy=d?(prev.y-f.y)/d*n/dt:0;f.x+=f.vx*dt;f.y+=f.vy*dt;if(n)f.facing=Math.atan2(f.vy,f.vx);prev=f;}
    for(const a of actors){const b=a.body;this.rigs[a.id].update(dt,{x:b.x,y:b.y,z:b.z||0,vx:b.vx,vy:b.vy,facing:b.facing});}
    this.world.update(dt,this);
    const reachable=E.targets(this.hero,this.world.interactables(this),{range:21,dz:6});this.nearest=reachable[0]?.target||null;
    if(I.pressed('interact'))this.interact();
    game.focus(this.hero.x,this.hero.y,this.world.isOverworld?0:13);this.ui.update();
  }
  draw(r){
    if(!this.world){D.Art.drawTitle(r,game.time);return;}
    this.world.draw(r,this);
    if(this.battle){
      const b=this.battle;
      for(const u of [...b.party,...b.enemies]){
        const rig=this.battleRigs[u.uid];r.shadow(u.x,u.y,u.team==='enemy'&&u.boss?16:8,.35);
        if(u.hp<=0&&u.team==='enemy')continue;
        r.actor(u.x,u.y,0,(g,ox,oy)=>rig.draw(g,ox,oy,r.view),{xray:true,flash:this.anim[u.uid]?.hurt?'#f0d9b0':undefined,flashMix:.25,alpha:u.hp<=0?.4:1});
        if(u.uid===this.selectedActor&&u.hp>0)r.decal(g=>r.groundRing(u.x,u.y,12,'#e7cd87',.8));
        if(u.uid===this.selectedTarget)r.marker(u.x,u.y,rig.height|| (u.boss?58:44),{label:'TARGET',color:'#efdcab',offscreen:false});
      }
      if((this.selectedSkill||this.selectedItem)&&this.selectedTarget){const actor=b.unit(this.selectedActor),skill=this.selectedItem?b.itemSpec(this.selectedItem,this.state.inventory):b.skills[this.selectedSkill],targets=b.resolveTargets(actor,skill,this.selectedTarget);
        for(const target of targets)r.decal(g=>r.groundRing(target.x,target.y,14,'#e8cea0',.75));
        if(skill?.target==='circle'){const t=b.unit(this.selectedTarget);r.decal(g=>r.groundDisc(t.x,t.y,skill.radius||62,'#d5b781',.11));}
        if(skill?.target==='line'){const t=b.unit(this.selectedTarget);r.decal(g=>{const a=r.w(actor.x,actor.y,0),z=r.w(t.x,t.y,0);E.px.line(g,a[0],a[1],z[0],z[1],'#d5b781',2);});}
      }
    }else if(this.world.isOverworld){
      if(D.drawOverworldTraveler)D.drawOverworldTraveler(r,this.hero.x,this.hero.y,this.state.travelMode,this.state.active[0],game.time,this.hero.facing,Math.hypot(this.hero.vx,this.hero.vy)>1);
      const destination=D.worldEntrance?.(this.destination())||C.zoneById[this.destination()],pos=destination?.worldPosition;if(pos?.zone===this.state.zone)r.marker((pos.x+.5)*16,(pos.y+.5)*16,12,{color:'#f5d391',label:'',offscreen:'arrow'});
    }else{
      for(const {id,b}of [{id:this.state.active[0],b:this.hero},...this.followers.map(b=>({id:b.id,b}))]){r.shadow(b.x,b.y,7,.32);r.actor(b.x,b.y,b.z||0,(g,ox,oy)=>this.rigs[id].draw(g,ox,oy,r.view),{xray:{color:'#acc4ab',outline:'#e8edce'}});}
      const obj=this.objective(),destination=this.destination();if(destination!==this.state.zone&&!talk.open){const next=this.routeExitTo?.(destination);if(next)r.marker(next.x,next.y,36,{color:'#d9c181',label:'NEXT ROUTE',offscreen:'arrow'});}if(obj.zone===this.state.zone&&!talk.open){const target=this.objectiveEntity?.();if(target)r.marker(target.x,target.y,44,{color:'#d9c181',label:'',offscreen:'arrow'});}
    }
    talk.draw(r);
  }
  snapshot(){return{scene:game.sceneName,mode:this.mode,chapter:this.state?.chapter,zone:this.state?.zone,hero:this.hero?[this.hero.x,this.hero.y]:null,party:this.state?.active,level:this.state?this.stats(this.state.active[0]).level:0,flags:this.state?.flags,quests:this.state?.quests,missions:this.state?(C.missions||[]).filter(m=>this.state.flags[m.completeFlag]).length:0,travelMode:this.state?.travelMode,trackedMission:this.state?.trackedMission,battles:this.state?.battles,battle:this.battle?.snapshot()||null,dialogue:talk.open,panel:this.panel?.type,ending:this.state?.ending,errors:game.errors};}
}
D.extendJourney?.(App);
D.extendExpeditions?.(App);
D.extendHearth?.(App);
D.extendCombatPolish?.(App);
D.extendSmallHours?.(App);
app=new App();D.app=app;
game.debug={snapshot:()=>app.snapshot(),teleport(x,y){app.hero.x=x;app.hero.y=y;game.cam.snap=true;},app};
game.stateHash=()=>app.state?[app.state.zone,app.hero?.x,app.hero?.y,app.state.xp,app.battle?.turn,app.state.chapter]:['title'];
game.start({scene:'title',scenes:{title:{enter(){app.mode='title';app.battle=null;talk.close();app.ui.close();game.audio.music(D.Music.title);app.ui.update(true);},update(dt){if(app.panel)app.ui.updatePanel();else app.ui.updateTitleKeyboard();app.ui.update();},draw(r){D.Art.drawTitle(r,game.time);}},field:{pausable:true,view:'threequarter',views:['threequarter','topdown'],propSize:1.1,enter(){app.mode='field';if(!app.state){app.fresh();app.loadWorld(app.state.zone);}app.syncWorldView();app.ui.update(true);},update:dt=>app.update(dt),draw:r=>app.draw(r)},ending:{enter(){app.mode='ending';game.audio.music(D.Music.ending);app.ui.update(true);},update(){if(app.panel)app.ui.updatePanel();else app.ui.updateEndingKeyboard();app.ui.update();},draw:r=>D.Art.drawTitle(r,game.time)}}});
})();
// GAME END
